import type { SynthCue } from "./AudioTypes";

type AudioContextConstructor = new () => AudioContext;

interface Envelope {
  attack: number;
  decay: number;
  volume: number;
}

export class SynthAudioEngine {
  private static readonly masterGain = 0.28;

  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly lastPlayedAt = new Map<string, number>();
  private muted = false;
  private volume = 1;

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMasterGain();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyMasterGain();
  }

  unlock() {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume();
    }
  }

  play(cue: SynthCue) {
    const context = this.ensureContext();
    const master = this.master;
    if (!context || !master) return;

    const key = this.normalizeKey(cue.key);
    if (!this.canPlay(key, context.currentTime)) return;

    switch (key) {
      case "weapon_pulse_rifle":
        this.playTone({ frequency: 420, endFrequency: 880, type: "square", envelope: { attack: 0.004, decay: 0.07, volume: 0.2 }, cue });
        break;
      case "weapon_rail_lance":
        this.playTone({ frequency: 110, endFrequency: 1180, type: "sawtooth", envelope: { attack: 0.006, decay: 0.22, volume: 0.28 }, cue });
        this.playNoise({ envelope: { attack: 0.002, decay: 0.09, volume: 0.1 }, cue, filterFrequency: 2600 });
        break;
      case "weapon_shock_burst":
        this.playTone({ frequency: 72, endFrequency: 38, type: "sine", envelope: { attack: 0.002, decay: 0.28, volume: 0.42 }, cue });
        this.playNoise({ envelope: { attack: 0.004, decay: 0.18, volume: 0.22 }, cue, filterFrequency: 1200 });
        break;
      case "ability_throw":
        this.playTone({ frequency: 210, endFrequency: 92, type: "triangle", envelope: { attack: 0.004, decay: 0.16, volume: 0.14 }, cue });
        this.playNoise({ envelope: { attack: 0.002, decay: 0.12, volume: 0.12 }, cue, filterFrequency: 820 });
        break;
      case "enemy_repair_drone":
        this.playTone({ frequency: 880, endFrequency: 240, type: "triangle", envelope: { attack: 0.003, decay: 0.13, volume: 0.16 }, cue });
        break;
      case "enemy_clamp_bot":
        this.playTone({ frequency: 190, endFrequency: 92, type: "square", envelope: { attack: 0.002, decay: 0.12, volume: 0.2 }, cue });
        this.playNoise({ envelope: { attack: 0.002, decay: 0.06, volume: 0.1 }, cue, filterFrequency: 1800 });
        break;
      case "enemy_shield_tech":
        this.playTone({ frequency: 620, endFrequency: 1300, type: "sine", envelope: { attack: 0.004, decay: 0.16, volume: 0.18 }, cue });
        break;
      case "enemy_signal_turret":
        this.playTone({ frequency: 1120, endFrequency: 560, type: "triangle", envelope: { attack: 0.002, decay: 0.1, volume: 0.14 }, cue });
        break;
      case "enemy_custodian_elite":
        this.playTone({ frequency: 86, endFrequency: 54, type: "sawtooth", envelope: { attack: 0.01, decay: 0.34, volume: 0.28 }, cue });
        this.playNoise({ envelope: { attack: 0.01, decay: 0.18, volume: 0.12 }, cue, filterFrequency: 650 });
        break;
      case "enemy_hit":
        this.playNoise({ envelope: { attack: 0.001, decay: 0.045, volume: 0.105 }, cue, filterFrequency: 3600 });
        break;
      case "enemy_destroyed":
        this.playTone({ frequency: 320, endFrequency: 58, type: "sawtooth", envelope: { attack: 0.004, decay: 0.3, volume: 0.22 }, cue });
        this.playNoise({ envelope: { attack: 0.002, decay: 0.22, volume: 0.14 }, cue, filterFrequency: 1400 });
        break;
      case "player_hit":
        this.playTone({ frequency: 120, endFrequency: 76, type: "sawtooth", envelope: { attack: 0.002, decay: 0.16, volume: 0.2 }, cue });
        break;
      case "system_low_health":
        this.playTone({ frequency: 760, endFrequency: 760, type: "square", envelope: { attack: 0.006, decay: 0.24, volume: 0.16 }, cue });
        this.playTone({ frequency: 380, endFrequency: 380, type: "square", envelope: { attack: 0.08, decay: 0.22, volume: 0.12 }, cue, delay: 0.1 });
        break;
      case "elite_warning":
        this.playTone({ frequency: 54, endFrequency: 72, type: "sawtooth", envelope: { attack: 0.02, decay: 0.55, volume: 0.3 }, cue });
        break;
      case "assist_reorient":
        this.playTone({ frequency: 360, endFrequency: 720, type: "triangle", envelope: { attack: 0.004, decay: 0.1, volume: 0.12 }, cue });
        break;
      case "ui_upgrade_select":
        this.playTone({ frequency: 520, endFrequency: 980, type: "sine", envelope: { attack: 0.006, decay: 0.18, volume: 0.16 }, cue });
        break;
      case "ui_revive":
        this.playTone({ frequency: 180, endFrequency: 640, type: "triangle", envelope: { attack: 0.02, decay: 0.42, volume: 0.2 }, cue });
        break;
      case "ui_death":
        this.playTone({ frequency: 140, endFrequency: 42, type: "sawtooth", envelope: { attack: 0.01, decay: 0.5, volume: 0.22 }, cue });
        break;
      case "archive_panel_open":
        this.playTone({ frequency: 180, endFrequency: 320, type: "triangle", envelope: { attack: 0.01, decay: 0.22, volume: 0.14 }, cue });
        this.playNoise({ envelope: { attack: 0.003, decay: 0.09, volume: 0.06 }, cue, filterFrequency: 1800 });
        break;
      case "archive_tile_slide":
        this.playTone({ frequency: 360, endFrequency: 430, type: "triangle", envelope: { attack: 0.002, decay: 0.055, volume: 0.07 }, cue });
        break;
      case "archive_tile_merge":
        this.playTone({ frequency: 260, endFrequency: 620, type: "sine", envelope: { attack: 0.004, decay: 0.16, volume: 0.13 }, cue });
        this.playTone({ frequency: 520, endFrequency: 780, type: "triangle", envelope: { attack: 0.03, decay: 0.12, volume: 0.08 }, cue, delay: 0.035 });
        break;
      case "archive_identity_stamp":
        this.playTone({ frequency: 98, endFrequency: 72, type: "sawtooth", envelope: { attack: 0.004, decay: 0.16, volume: 0.18 }, cue });
        this.playTone({ frequency: 740, endFrequency: 1040, type: "sine", envelope: { attack: 0.018, decay: 0.22, volume: 0.12 }, cue, delay: 0.04 });
        break;
      case "archive_denied":
        this.playTone({ frequency: 210, endFrequency: 148, type: "square", envelope: { attack: 0.003, decay: 0.1, volume: 0.1 }, cue });
        break;
      case "archive_rollback":
        this.playTone({ frequency: 260, endFrequency: 70, type: "sawtooth", envelope: { attack: 0.006, decay: 0.28, volume: 0.16 }, cue });
        this.playNoise({ envelope: { attack: 0.004, decay: 0.16, volume: 0.08 }, cue, filterFrequency: 900 });
        break;
      case "archive_unlock":
        this.playTone({ frequency: 220, endFrequency: 740, type: "sine", envelope: { attack: 0.015, decay: 0.34, volume: 0.15 }, cue });
        this.playTone({ frequency: 440, endFrequency: 1180, type: "triangle", envelope: { attack: 0.04, decay: 0.28, volume: 0.1 }, cue, delay: 0.08 });
        break;
      case "gallery_reader_open":
        this.playTone({ frequency: 150, endFrequency: 268, type: "sine", envelope: { attack: 0.02, decay: 0.4, volume: 0.13 }, cue });
        this.playNoise({ envelope: { attack: 0.01, decay: 0.16, volume: 0.04 }, cue, filterFrequency: 900 });
        break;
      case "gallery_card_tick":
        this.playTone({ frequency: 540, endFrequency: 620, type: "triangle", envelope: { attack: 0.002, decay: 0.05, volume: 0.07 }, cue });
        break;
      case "gallery_correct_stamp":
        this.playTone({ frequency: 320, endFrequency: 720, type: "sine", envelope: { attack: 0.005, decay: 0.18, volume: 0.13 }, cue });
        this.playTone({ frequency: 640, endFrequency: 980, type: "triangle", envelope: { attack: 0.03, decay: 0.16, volume: 0.08 }, cue, delay: 0.04 });
        break;
      case "gallery_wrong_deny":
        this.playTone({ frequency: 196, endFrequency: 132, type: "square", envelope: { attack: 0.003, decay: 0.12, volume: 0.1 }, cue });
        break;
      case "gallery_door_release":
        this.playTone({ frequency: 210, endFrequency: 700, type: "sine", envelope: { attack: 0.016, decay: 0.36, volume: 0.15 }, cue });
        this.playTone({ frequency: 420, endFrequency: 1120, type: "triangle", envelope: { attack: 0.04, decay: 0.3, volume: 0.1 }, cue, delay: 0.08 });
        break;
      case "system_exit_open":
      case "system_transition":
      case "system_victory":
        this.playTone({ frequency: 240, endFrequency: 740, type: "sine", envelope: { attack: 0.02, decay: 0.5, volume: 0.17 }, cue });
        break;
      default:
        this.playTone({ frequency: 440, endFrequency: 520, type: "triangle", envelope: { attack: 0.004, decay: 0.08, volume: 0.08 }, cue });
        break;
    }
  }

  private ensureContext() {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;

    const browserWindow = window as Window &
      typeof globalThis & {
        webkitAudioContext?: AudioContextConstructor;
      };
    const AudioContextCtor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextCtor) return null;

    const context = new AudioContextCtor();
    const master = context.createGain();
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.applyMasterGain();
    return context;
  }

  private applyMasterGain() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : SynthAudioEngine.masterGain * this.volume;
  }

  private canPlay(key: string, now: number) {
    const cooldown = key === "enemy_hit" ? 0.045 : key === "weapon_pulse_rifle" ? 0.045 : key === "player_hit" ? 0.12 : 0.02;
    const last = this.lastPlayedAt.get(key) ?? -Infinity;
    if (now - last < cooldown) return false;
    this.lastPlayedAt.set(key, now);
    return true;
  }

  private normalizeKey(key: string) {
    if (key === "enemy_custodian_elite") return "enemy_custodian_elite";
    return key;
  }

  private playTone({
    frequency,
    endFrequency,
    type,
    envelope,
    cue,
    delay = 0,
  }: {
    frequency: number;
    endFrequency: number;
    type: OscillatorType;
    envelope: Envelope;
    cue: SynthCue;
    delay?: number;
  }) {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = this.createPanner(cue.pan);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + envelope.decay);
    this.shapeGain(gain.gain, now, envelope, cue.intensity);
    oscillator.connect(gain);
    this.connectToMaster(gain, panner, master);
    oscillator.start(now);
    oscillator.stop(now + envelope.attack + envelope.decay + 0.03);
  }

  private playNoise({
    envelope,
    cue,
    filterFrequency,
  }: {
    envelope: Envelope;
    cue: SynthCue;
    filterFrequency: number;
  }) {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const now = context.currentTime;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * (envelope.attack + envelope.decay + 0.04)), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const panner = this.createPanner(cue.pan);
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = filterFrequency;
    filter.Q.value = 0.85;
    this.shapeGain(gain.gain, now, envelope, cue.intensity);
    source.connect(filter);
    filter.connect(gain);
    this.connectToMaster(gain, panner, master);
    source.start(now);
    source.stop(now + envelope.attack + envelope.decay + 0.04);
  }

  private shapeGain(gain: AudioParam, now: number, envelope: Envelope, intensity: number) {
    const volume = envelope.volume * Math.max(0.1, Math.min(1.8, intensity));
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0.0001, now);
    gain.linearRampToValueAtTime(volume, now + envelope.attack);
    gain.exponentialRampToValueAtTime(0.0001, now + envelope.attack + envelope.decay);
  }

  private createPanner(pan: number) {
    const context = this.context;
    if (!context || !("createStereoPanner" in context)) return null;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    return panner;
  }

  private connectToMaster(source: AudioNode, panner: StereoPannerNode | null, master: GainNode) {
    if (panner) {
      source.connect(panner);
      panner.connect(master);
      return;
    }
    source.connect(master);
  }
}
