import type { SynthCue } from "./AudioTypes";
import { sfxSampleUrl } from "./sfxManifest";

type AudioContextConstructor = new () => AudioContext;

/**
 * Result of attempting to play a sample for a cue:
 * - "played": a sample fired.
 * - "suppressed": a sample exists but was throttled by the per-key cooldown.
 * - "absent": no usable sample (missing / still decoding / decode failed) — the
 *   caller should fall back to the SynthAudioEngine for this cue.
 */
export type SampleSfxResult = "played" | "suppressed" | "absent";

/**
 * Plays short mp3/ogg/wav samples for audio-cue keys, with rough stereo pan and
 * intensity. Decodes lazily and caches buffers. Anything without a present,
 * decoded sample returns "absent" so the procedural synth covers the cue —
 * guaranteeing the game always makes sound.
 */
export class SampleSfxPlayer {
  private static readonly masterGain = 0.9;

  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 1;

  private readonly buffers = new Map<string, AudioBuffer | null>(); // null = decoding
  private readonly failed = new Set<string>(); // permanent decode failures
  private readonly lastPlayedAt = new Map<string, number>();

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMasterGain();
  }

  setVolume(volume: number) {
    this.volume = clamp01(volume);
    this.applyMasterGain();
  }

  unlock() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  play(cue: SynthCue): SampleSfxResult {
    const url = sfxSampleUrl(cue.key);
    if (!url || this.failed.has(url)) return "absent";

    const ctx = this.ensureContext();
    if (!ctx || !this.master) return "absent";

    const buffer = this.buffers.get(url);
    if (buffer === undefined) {
      // Never seen: kick off decode and let the synth cover this first instance
      // so there is no silent gap. The sample takes over once decoded.
      this.load(url);
      return "absent";
    }
    if (buffer === null) return "absent"; // currently decoding
    if (!this.canPlay(cue.key, ctx.currentTime)) return "suppressed";

    this.playBuffer(ctx, this.master, buffer, cue);
    return "played";
  }

  private playBuffer(ctx: AudioContext, master: GainNode, buffer: AudioBuffer, cue: SynthCue) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = clamp(cue.intensity, 0.1, 1.8);

    source.connect(gain);
    if ("createStereoPanner" in ctx) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(cue.pan, -1, 1);
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    source.start();
  }

  private load(url: string) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.buffers.set(url, null); // mark decoding
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((decoded) => {
        this.buffers.set(url, decoded);
      })
      .catch(() => {
        // Permanent fallback to synth for this file.
        this.buffers.delete(url);
        this.failed.add(url);
      });
  }

  private canPlay(key: string, now: number) {
    const cooldown =
      key === "enemy_hit"
        ? 0.045
        : key === "weapon_pulse_rifle"
          ? 0.045
          : key === "player_hit"
            ? 0.12
            : key === "enemy_destroyed"
              ? 0.05
              : 0.02;
    const last = this.lastPlayedAt.get(key) ?? -Infinity;
    if (now - last < cooldown) return false;
    this.lastPlayedAt.set(key, now);
    return true;
  }

  private applyMasterGain() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : SampleSfxPlayer.masterGain * this.volume;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;
    const browserWindow = window as Window & typeof globalThis & { webkitAudioContext?: AudioContextConstructor };
    const Ctor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    this.context = ctx;
    this.master = master;
    this.applyMasterGain();
    return ctx;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}
