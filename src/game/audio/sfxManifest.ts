/**
 * Maps audio-cue keys to optional sample filenames under
 * src/assets/audio/sfx/. The SampleSfxPlayer plays a sample when present and
 * otherwise lets the SynthAudioEngine cover the cue. Discovery is build-time via
 * import.meta.glob, so dropping a file in makes it play with no code change.
 */
const sfxFiles = import.meta.glob("../../assets/audio/sfx/*.{mp3,ogg,wav}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const sfxByName = new Map<string, string>();
for (const [path, url] of Object.entries(sfxFiles)) {
  const file = path.slice(path.lastIndexOf("/") + 1);
  sfxByName.set(file.replace(/\.(mp3|ogg|wav)$/i, ""), url);
}

/** Cue key → sample basename (without extension). */
const SFX_FILE_BY_KEY: Record<string, string> = {
  // puzzle feedback
  archive_panel_open: "puzzle-open",
  gallery_reader_open: "puzzle-open",
  archive_tile_slide: "puzzle-select",
  gallery_card_tick: "puzzle-select",
  archive_tile_merge: "puzzle-merge",
  archive_identity_stamp: "puzzle-merge",
  gallery_correct_stamp: "puzzle-correct",
  archive_denied: "puzzle-wrong",
  gallery_wrong_deny: "puzzle-wrong",
  archive_unlock: "puzzle-success",
  archive_rollback: "puzzle-fail",
  gallery_door_release: "door-open",
  // exit / doors / system
  system_exit_open: "door-open",
  system_transition: "transition",
  system_victory: "victory",
  // ui / buttons / pickups
  ui_confirm: "button-press",
  ui_start: "button-press",
  ui_upgrade_select: "pickup",
  ui_revive: "revive",
  ui_death: "death",
  // weapons
  weapon_pulse_rifle: "weapon-pulse",
  weapon_rail_lance: "weapon-rail",
  weapon_shock_burst: "weapon-shock",
  // hits
  player_hit: "player-hit",
  enemy_hit: "enemy-hit",
  // robot death
  enemy_destroyed: "robot-death",
};

/** Resolved sample URL for a cue key, or null (caller falls back to the synth). */
export function sfxSampleUrl(key: string): string | null {
  const name = SFX_FILE_BY_KEY[key];
  if (!name) return null;
  return sfxByName.get(name) ?? null;
}

/** Every resolved (present) sample URL — for optional preloading. */
export function resolvedSfxUrls(): string[] {
  const urls = new Set<string>();
  for (const key of Object.keys(SFX_FILE_BY_KEY)) {
    const url = sfxSampleUrl(key);
    if (url) urls.add(url);
  }
  return [...urls];
}
