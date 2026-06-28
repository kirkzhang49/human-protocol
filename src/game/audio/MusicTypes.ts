/** Logical background-music states the MusicDirector can be asked to play. */
export type MusicState =
  | "build"
  | "explore"
  | "puzzle"
  | "combat"
  | "boss"
  | "exit"
  | "transition"
  | "victory"
  | "silent";

/** One-shot music flourishes that briefly duck the looping bed. */
export type StingerKey = "exitUnlock" | "levelTransition" | "victory";

export interface MusicTrackResolution {
  /** Music state this resolution backs. */
  state: MusicState;
  /** Bundler URL for the loop, or null when no file is present (→ silence). */
  url: string | null;
  /** Base playback gain (0..1) before master/music volume is applied. */
  gain: number;
  /** Whether the bed loops (always true except `silent`). */
  loop: boolean;
}

export interface StingerResolution {
  /** Bundler URL, or null when the user has not provided the stinger yet. */
  url: string | null;
  /** Base playback gain (0..1) before master/music volume is applied. */
  gain: number;
}

export interface MusicManifest {
  /** Resolve the looping bed for a music state. */
  trackFor(state: MusicState): MusicTrackResolution;
  /** Resolve a one-shot stinger. */
  stingerFor(stinger: StingerKey): StingerResolution;
  /** Every resolved (present) audio URL — handy for optional preloading. */
  resolvedUrls(): string[];
}
