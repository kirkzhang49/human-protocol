import mainBgmUrl from "../../assets/audio/music/last-human-bay.mp3";
import type { MusicManifest, MusicState, MusicTrackResolution, StingerKey, StingerResolution } from "./MusicTypes";

/**
 * Build-time discovery of user-droppable music + stinger files. Missing files
 * simply do not appear in these records, so the game keeps compiling and
 * playing before any Suno tracks land. See src/assets/audio/README.md for the
 * drop-in contract.
 */
const musicFiles = import.meta.glob("../../assets/audio/music/*.{mp3,ogg,wav}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const stingerFiles = import.meta.glob("../../assets/audio/stingers/*.{mp3,ogg,wav}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function indexByBasename(files: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, url] of Object.entries(files)) {
    const file = path.slice(path.lastIndexOf("/") + 1);
    const name = file.replace(/\.(mp3|ogg|wav)$/i, "");
    map.set(name, url);
  }
  return map;
}

const musicByName = indexByBasename(musicFiles);
const stingerByName = indexByBasename(stingerFiles);

/** Preferred filename(s) per state; first present wins. */
const STATE_FILES: Record<MusicState, readonly string[]> = {
  build: ["build-workshop-loop"],
  explore: ["hp-explore-loop"],
  puzzle: ["hp-puzzle-loop"],
  combat: ["hp-combat-loop"],
  boss: ["hp-boss-loop"],
  exit: ["hp-exit-loop"],
  transition: ["hp-transition-loop"],
  victory: ["hp-victory-loop"],
  silent: [],
};

/** Base gain per state (relative mix, before master/music volume). */
const STATE_GAIN: Record<MusicState, number> = {
  build: 0.85,
  explore: 0.8,
  puzzle: 0.72,
  combat: 0.92,
  boss: 1,
  exit: 0.85,
  transition: 0.82,
  victory: 0.95,
  silent: 0,
};

/** Fallback URL when no state-named file exists. `explore` keeps the bundled bed. */
const STATE_DEFAULT_URL: Partial<Record<MusicState, string>> = {
  explore: mainBgmUrl,
  combat: mainBgmUrl,
  boss: mainBgmUrl,
};

const STINGER_FILES: Record<StingerKey, string> = {
  exitUnlock: "exit-unlock-stinger",
  levelTransition: "level-transition-stinger",
  victory: "victory-stinger",
};

function resolveStateUrl(state: MusicState): string | null {
  for (const name of STATE_FILES[state]) {
    const url = musicByName.get(name);
    if (url) return url;
  }
  return STATE_DEFAULT_URL[state] ?? null;
}

export const musicManifest: MusicManifest = {
  trackFor(state: MusicState): MusicTrackResolution {
    return {
      state,
      url: resolveStateUrl(state),
      gain: STATE_GAIN[state],
      loop: state !== "silent",
    };
  },
  stingerFor(stinger: StingerKey): StingerResolution {
    return {
      url: stingerByName.get(STINGER_FILES[stinger]) ?? null,
      gain: 0.95,
    };
  },
  resolvedUrls(): string[] {
    const urls = new Set<string>();
    for (const state of Object.keys(STATE_FILES) as MusicState[]) {
      const url = resolveStateUrl(state);
      if (url) urls.add(url);
    }
    for (const key of Object.keys(STINGER_FILES) as StingerKey[]) {
      const url = stingerByName.get(STINGER_FILES[key]);
      if (url) urls.add(url);
    }
    return [...urls];
  },
};
