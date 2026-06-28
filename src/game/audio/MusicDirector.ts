import type { MusicManifest, MusicState, StingerKey } from "./MusicTypes";

type AudioContextConstructor = new () => AudioContext;

const DEFAULT_CROSSFADE_SEC = 1.2; // within the requested 0.8–1.8s band
const MIN_CROSSFADE_SEC = 0.8;
const MAX_CROSSFADE_SEC = 1.8;
const DUCK_GAIN = 0.34;
const DUCK_SMOOTHING_SEC = 0.18;
const STINGER_MAX_SEC = 6; // safety release if a stinger never fires "ended"

interface Voice {
  audio: HTMLAudioElement;
  gain: GainNode | null; // null when Web Audio is unavailable (element.volume fallback)
  url: string;
  baseGain: number;
}

/**
 * Multi-track background-music layer. Crossfades between named music states,
 * ducks for one-shot stingers, and obeys master/music volume + platform mute.
 *
 * Design notes:
 * - Audio only starts after `unlock()` (a real user gesture); autoplay
 *   rejection is swallowed.
 * - `setState()` is cheap and idempotent — calling it every frame with the same
 *   state does nothing, so it never restarts a track.
 * - Voices are cached per URL, so oscillating between states (combat ↔ explore)
 *   reuses elements instead of leaking a new one each switch.
 * - Volume / mute / duck apply at a shared music bus; crossfades apply at each
 *   voice gain. Stingers route around the bus so ducking does not mute them.
 */
export class MusicDirector {
  private readonly manifest: MusicManifest;
  private readonly crossfadeSec: number;

  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private readonly voices = new Map<string, Voice>();

  private current: Voice | null = null;
  private currentState: MusicState = "silent";
  private desiredState: MusicState = "silent";

  private unlocked = false;
  private muted = false;
  private paused = false;
  private volume = 0.32;
  private duckGain = 1;

  constructor(manifest: MusicManifest, options: { crossfadeSec?: number } = {}) {
    this.manifest = manifest;
    this.crossfadeSec = clamp(options.crossfadeSec ?? DEFAULT_CROSSFADE_SEC, MIN_CROSSFADE_SEC, MAX_CROSSFADE_SEC);
  }

  /** Call after a user gesture. Resumes the context and starts the desired bed. */
  unlock() {
    if (this.unlocked) {
      this.resumeContext();
      return;
    }
    this.unlocked = true;
    this.ensureContext();
    this.resumeContext();
    if (this.currentState !== this.desiredState || !this.current) {
      this.applyState(this.desiredState);
    } else if (this.current && !this.paused) {
      this.startVoice(this.current);
    }
  }

  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    this.applyBusGain();
  }

  /** Effective music volume (already master × music). */
  setVolume(volume: number) {
    const next = clamp(volume, 0, 1);
    if (next === this.volume) return;
    this.volume = next;
    this.applyBusGain();
  }

  /** Pause/resume playback with the game (mirrors prior bgm-pauses-on-pause behavior). */
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!this.current) return;
    if (paused) {
      pauseSafely(this.current.audio);
    } else if (this.unlocked) {
      void this.current.audio.play().catch(noop);
    }
  }

  /** Request a music state. Idempotent — safe to call every frame. */
  setState(state: MusicState) {
    this.desiredState = state;
    if (!this.unlocked) return;
    if (state === this.currentState) return;
    this.applyState(state);
  }

  /** Play a one-shot stinger and duck the bed under it. No-op before unlock. */
  playStinger(key: StingerKey) {
    if (!this.unlocked) return;
    const resolution = this.manifest.stingerFor(key);
    if (!resolution.url) return;

    const audio = new Audio(resolution.url);
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");

    const ctx = this.ensureContext();
    if (ctx) {
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = this.muted ? 0 : clamp(this.volume * resolution.gain, 0, 1);
      source.connect(gain);
      gain.connect(ctx.destination); // around the bus → not affected by duck
    } else {
      audio.volume = this.muted ? 0 : clamp(this.volume * resolution.gain, 0, 1);
    }

    this.duck();
    void audio.play().catch(noop);

    const release = () => this.releaseDuck();
    audio.addEventListener("ended", release, { once: true });
    window.setTimeout(release, STINGER_MAX_SEC * 1000);
  }

  /** Fade everything out and tear down. Use when leaving the host screen. */
  dispose() {
    if (this.current) this.fadeOut(this.current);
    this.current = null;
    this.currentState = "silent";
    this.desiredState = "silent";
    const ctx = this.context;
    if (ctx) {
      window.setTimeout(() => void ctx.close().catch(noop), this.crossfadeSec * 1000 + 150);
    }
    this.context = null;
    this.musicBus = null;
    this.voices.clear();
  }

  /** Immediately silence the director, used before opening another audio-owning window. */
  stopNow() {
    for (const voice of this.voices.values()) {
      pauseSafely(voice.audio);
      try {
        voice.audio.currentTime = 0;
      } catch {
        // Some browsers reject seeking before metadata is ready; paused is enough.
      }
    }
    this.current = null;
    this.currentState = "silent";
    this.desiredState = "silent";
    const ctx = this.context;
    if (ctx) {
      void ctx.close().catch(noop);
    }
    this.context = null;
    this.musicBus = null;
    this.voices.clear();
  }

  private applyState(state: MusicState) {
    this.currentState = state;
    const track = this.manifest.trackFor(state);
    const previous = this.current;

    if (previous && (!track.url || previous.url !== track.url)) {
      this.fadeOut(previous);
    }

    if (!track.url) {
      this.current = null;
      return;
    }

    const voice = this.voiceFor(track.url, track.gain, track.loop);
    if (previous && previous.url === track.url) {
      // Same file backs both states (e.g. explore fallback) — keep it playing.
      this.current = voice;
      return;
    }
    this.current = voice;
    if (this.unlocked && !this.paused) {
      this.startVoice(voice);
    }
  }

  private voiceFor(url: string, baseGain: number, loop: boolean): Voice {
    const existing = this.voices.get(url);
    if (existing) {
      existing.baseGain = baseGain;
      existing.audio.loop = loop;
      return existing;
    }
    const audio = new Audio(url);
    audio.loop = loop;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");

    const ctx = this.ensureContext();
    let gain: GainNode | null = null;
    if (ctx && this.musicBus) {
      const source = ctx.createMediaElementSource(audio);
      gain = ctx.createGain();
      gain.gain.value = 0.0001;
      source.connect(gain);
      gain.connect(this.musicBus);
    } else {
      audio.volume = 0;
    }
    const voice: Voice = { audio, gain, url, baseGain };
    this.voices.set(url, voice);
    return voice;
  }

  private startVoice(voice: Voice) {
    void voice.audio.play().catch(noop);
    const ctx = this.context;
    if (ctx && voice.gain) {
      const now = ctx.currentTime;
      const param = voice.gain.gain;
      param.cancelScheduledValues(now);
      param.setValueAtTime(Math.max(0.0001, param.value), now);
      param.linearRampToValueAtTime(Math.max(0.0001, voice.baseGain), now + this.crossfadeSec);
    } else {
      voice.audio.volume = this.elementVolume(voice.baseGain);
    }
  }

  private fadeOut(voice: Voice) {
    const ctx = this.context;
    if (ctx && voice.gain) {
      const now = ctx.currentTime;
      const param = voice.gain.gain;
      param.cancelScheduledValues(now);
      param.setValueAtTime(Math.max(0.0001, param.value), now);
      param.linearRampToValueAtTime(0.0001, now + this.crossfadeSec);
      window.setTimeout(() => {
        if (this.current !== voice) pauseSafely(voice.audio);
      }, this.crossfadeSec * 1000 + 80);
    } else {
      pauseSafely(voice.audio);
    }
  }

  private duck() {
    this.duckGain = DUCK_GAIN;
    this.applyBusGain();
  }

  private releaseDuck() {
    this.duckGain = 1;
    this.applyBusGain();
  }

  private applyBusGain() {
    const target = this.muted ? 0 : this.volume * this.duckGain;
    if (this.musicBus && this.context) {
      const now = this.context.currentTime;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setTargetAtTime(Math.max(0.0001, target), now, DUCK_SMOOTHING_SEC);
    } else if (this.current && !this.current.gain) {
      this.current.audio.volume = this.elementVolume(this.current.baseGain);
    }
  }

  private elementVolume(baseGain: number) {
    return clamp((this.muted ? 0 : this.volume * this.duckGain) * baseGain, 0, 1);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;
    const browserWindow = window as Window & typeof globalThis & { webkitAudioContext?: AudioContextConstructor };
    const Ctor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const bus = ctx.createGain();
    bus.connect(ctx.destination);
    this.context = ctx;
    this.musicBus = bus;
    this.applyBusGain();
    return ctx;
  }

  private resumeContext() {
    if (this.context && this.context.state === "suspended") {
      void this.context.resume().catch(noop);
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pauseSafely(audio: HTMLAudioElement) {
  try {
    if (!audio.paused) audio.pause();
  } catch {
    // ignore — element may be detached
  }
}

function noop() {
  return undefined;
}
