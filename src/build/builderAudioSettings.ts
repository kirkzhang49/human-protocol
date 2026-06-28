/**
 * Minimal audio preferences for the /build editor. The builder runs as a
 * separate route from the game (App.tsx) and has no settings panel yet, so it
 * keeps its own volume/mute in localStorage.
 *
 * FUTURE: when the builder gains a settings UI, surface these (or fold them into
 * the game's GameSettings musicVolume/master) and drop this module.
 */
export interface BuilderAudioSettings {
  /** Effective music volume, 0..1. */
  volume: number;
  muted: boolean;
}

const STORAGE_KEY = "human-protocol-builder-audio-v1";

const defaults: BuilderAudioSettings = {
  volume: 0.5,
  muted: false,
};

function clamp01(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return defaults.volume;
  return Math.max(0, Math.min(1, number));
}

export function loadBuilderAudioSettings(): BuilderAudioSettings {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<BuilderAudioSettings>;
    return {
      volume: clamp01(parsed.volume ?? defaults.volume),
      muted: parsed.muted === true,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveBuilderAudioSettings(settings: BuilderAudioSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: clamp01(settings.volume), muted: settings.muted === true }),
    );
  } catch {
    // Non-critical; keep in-memory values.
  }
}
