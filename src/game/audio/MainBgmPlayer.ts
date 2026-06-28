export class MainBgmPlayer {
  private audio: HTMLAudioElement | null = null;
  private active = false;
  private muted = false;
  private unlocked = false;
  private volume = 0.32;
  private lastPlayAttemptAt = -Infinity;

  constructor(private readonly sourceUrl: string) {}

  unlock() {
    this.unlocked = true;
    this.sync();
  }

  setActive(active: boolean) {
    this.active = active;
    this.sync();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.audio) {
      this.audio.muted = muted;
    }
    this.sync();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  private sync() {
    const audio = this.ensureAudio();
    if (!audio) return;

    audio.muted = this.muted;
    if (!this.active || this.muted || !this.unlocked) {
      if (!audio.paused) audio.pause();
      return;
    }

    if (!audio.paused) return;
    const now = performance.now();
    if (now - this.lastPlayAttemptAt < 800) return;
    this.lastPlayAttemptAt = now;
    void audio.play().catch(() => undefined);
  }

  private ensureAudio() {
    if (typeof window === "undefined") return null;
    if (this.audio) return this.audio;

    const audio = new Audio(this.sourceUrl);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = this.volume;
    audio.setAttribute("playsinline", "true");
    this.audio = audio;
    return audio;
  }
}
