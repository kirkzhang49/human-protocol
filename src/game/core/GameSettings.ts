export type GameLanguage = "zh" | "en";

export interface GameSettings {
  language: GameLanguage;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  /** Touch look-pad sensitivity multiplier (mouse aim is unaffected). */
  touchLookSensitivity: number;
}

const SETTINGS_STORAGE_KEY = "human-protocol-settings-v1";

const defaultSettings: GameSettings = {
  language: "zh",
  masterVolume: 0.82,
  musicVolume: 0.72,
  sfxVolume: 0.86,
  // Matches the previously hardcoded look-pad multiplier so touch feel is unchanged.
  touchLookSensitivity: 1.15,
};

export function loadGameSettings(): GameSettings {
  if (typeof window === "undefined") return { ...defaultSettings };

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const urlLanguage = readUrlLanguageOverride();
    if (!raw) return { ...defaultSettings, ...(urlLanguage ? { language: urlLanguage } : {}) };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const settings = normalizeSettings(parsed);
    return urlLanguage ? { ...settings, language: urlLanguage } : settings;
  } catch {
    const urlLanguage = readUrlLanguageOverride();
    return { ...defaultSettings, ...(urlLanguage ? { language: urlLanguage } : {}) };
  }
}

export function saveGameSettings(settings: GameSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // Settings persistence is non-critical; keep the in-memory values.
  }
}

export function normalizeLanguage(value: unknown): GameLanguage {
  return value === "en" ? "en" : "zh";
}

export function normalizeVolume(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

export const TOUCH_LOOK_SENSITIVITY_MIN = 0.4;
export const TOUCH_LOOK_SENSITIVITY_MAX = 2.5;

export function normalizeTouchLookSensitivity(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return defaultSettings.touchLookSensitivity;
  return Math.max(TOUCH_LOOK_SENSITIVITY_MIN, Math.min(TOUCH_LOOK_SENSITIVITY_MAX, number));
}

function normalizeSettings(settings: Partial<GameSettings>): GameSettings {
  return {
    language: normalizeLanguage(settings.language),
    masterVolume: normalizeVolume(settings.masterVolume ?? defaultSettings.masterVolume),
    musicVolume: normalizeVolume(settings.musicVolume ?? defaultSettings.musicVolume),
    sfxVolume: normalizeVolume(settings.sfxVolume ?? defaultSettings.sfxVolume),
    touchLookSensitivity: normalizeTouchLookSensitivity(
      settings.touchLookSensitivity ?? defaultSettings.touchLookSensitivity,
    ),
  };
}

function readUrlLanguageOverride(): GameLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("lang") ?? params.get("gameLang") ?? params.get("locale") ?? params.get("hpLang");
    if (value === "en") return "en";
    if (value === "zh" || value === "zh-CN" || value === "cn") return "zh";
  } catch {
    return null;
  }
  return null;
}
