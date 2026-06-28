import { Vector3 } from "three";
import { MusicDirector } from "../audio/MusicDirector";
import { musicManifest } from "../audio/musicManifest";
import { resolveMusicState } from "../audio/resolveMusicState";
import { SampleSfxPlayer } from "../audio/SampleSfxPlayer";
import { SynthAudioEngine } from "../audio/SynthAudioEngine";
import type { AudioCueEvent, SynthCue } from "../audio/AudioTypes";
import type { GameMode } from "../core/GameMode";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { clamp } from "../core/math";

/** Cues that imply the player is actively engaging a puzzle (free-play beds). */
const PUZZLE_CUE_KEYS = new Set([
  "archive_panel_open",
  "archive_tile_slide",
  "archive_tile_merge",
  "archive_identity_stamp",
  "archive_denied",
  "archive_unlock",
  "archive_rollback",
  "gallery_reader_open",
  "gallery_card_tick",
  "gallery_correct_stamp",
  "gallery_wrong_deny",
  "gallery_door_release",
]);

/** How long a puzzle interaction keeps the puzzle bed in free play. */
const RECENT_PUZZLE_SEC = 6;

export class AudioSystem implements GameSystem {
  runWhenPaused = true;

  private readonly engine = new SynthAudioEngine();
  private readonly sampleSfx = new SampleSfxPlayer();
  private readonly music = new MusicDirector(musicManifest);
  private readonly toCue = new Vector3();
  private readonly right = new Vector3();
  private previousCritical = false;
  private previousExitUnlocked = false;
  private previousMode: GameMode = "title";
  private recentPuzzleUntil = 0;
  private unlockListenersInstalled = false;

  constructor() {
    this.installUnlockListeners();
  }

  update(world: GameWorld) {
    this.installUnlockListeners();

    const muted = world.platform.isAudioMuted();
    const masterVolume = world.settings.masterVolume;
    const sfxVolume = masterVolume * world.settings.sfxVolume;

    this.engine.setMuted(muted);
    this.engine.setVolume(sfxVolume);
    this.sampleSfx.setMuted(muted);
    this.sampleSfx.setVolume(sfxVolume);
    this.music.setMuted(muted);
    this.music.setVolume(masterVolume * world.settings.musicVolume);
    this.music.setPaused(world.paused);

    this.processAudioEvents(world);
    this.updateMusicState(world);
    this.updateCriticalCue(world);
  }

  private installUnlockListeners() {
    if (this.unlockListenersInstalled || typeof window === "undefined") return;
    this.unlockListenersInstalled = true;
    const unlock = () => {
      this.engine.unlock();
      this.sampleSfx.unlock();
      this.music.unlock();
    };
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
  }

  private processAudioEvents(world: GameWorld) {
    const events = world.drainAudioEvents();
    if (events.length === 0) return;
    const now = performance.now() / 1000;
    for (const event of events) {
      if (PUZZLE_CUE_KEYS.has(event.key)) {
        this.recentPuzzleUntil = now + RECENT_PUZZLE_SEC;
      }
      this.playEvent(world, event);
    }
  }

  private updateMusicState(world: GameWorld) {
    const now = performance.now() / 1000;
    const recentPuzzle = now < this.recentPuzzleUntil && world.session.mode === "playing";
    this.music.setState(resolveMusicState(world, { recentPuzzle }));

    // One-shot stingers on rising edges (independent of the looping bed).
    const mode = world.session.mode;
    if (world.session.exitUnlocked && !this.previousExitUnlocked) {
      this.music.playStinger("exitUnlock");
    }
    if (mode === "transition" && this.previousMode !== "transition") {
      this.music.playStinger("levelTransition");
    }
    if (mode === "victory" && this.previousMode !== "victory") {
      this.music.playStinger("victory");
    }
    this.previousExitUnlocked = world.session.exitUnlocked;
    this.previousMode = mode;
  }

  private updateCriticalCue(world: GameWorld) {
    const critical = world.session.mode === "playing" && world.player.health <= world.player.maxHealth * 0.34;
    if (critical && !this.previousCritical) {
      this.playCue({ key: "system_low_health", intensity: 1, pan: 0 });
    }
    this.previousCritical = critical;
  }

  private playEvent(world: GameWorld, event: AudioCueEvent) {
    const spatial = event.position ? this.spatialize(world, event) : { pan: 0, falloff: 1 };
    this.playCue({
      key: event.key,
      intensity: event.intensity * spatial.falloff,
      pan: spatial.pan,
    });
  }

  /** Prefer a sample; fall back to the procedural synth when none is present. */
  private playCue(cue: SynthCue) {
    if (this.sampleSfx.play(cue) === "absent") {
      this.engine.play(cue);
    }
  }

  private spatialize(world: GameWorld, event: AudioCueEvent) {
    if (!event.position) return { pan: 0, falloff: 1 };

    this.toCue.copy(event.position).sub(world.player.position).setY(0);
    const distance = Math.max(0.001, this.toCue.length());
    this.toCue.multiplyScalar(1 / distance);
    this.right.set(Math.cos(world.player.rotationY), 0, Math.sin(world.player.rotationY));

    return {
      pan: clamp(this.toCue.dot(this.right), -1, 1) * 0.72,
      falloff: clamp(1 - distance / 26, 0.24, 1),
    };
  }
}
