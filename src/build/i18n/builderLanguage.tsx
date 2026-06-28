// Language source for the /build level builder.
//
// The builder is a standalone page outside the game's GameWorld, so it cannot read
// world.settings. It reuses the same persisted GameSettings language (localStorage +
// ?lang URL override) and exposes it via context. Plain-DOM builder components call
// useBuilderLanguage(); components rendered under an r3f <Canvas> must receive the
// language/strings as PROPS instead (the r3f reconciler is a separate React tree, so
// context does not cross the Canvas boundary).
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { loadGameSettings, normalizeLanguage, saveGameSettings, type GameLanguage } from "../../game/core/GameSettings";

export interface BuilderLanguageValue {
  language: GameLanguage;
  setLanguage: (language: GameLanguage) => void;
  toggleLanguage: () => void;
}

const BuilderLanguageContext = createContext<BuilderLanguageValue | null>(null);

export const BuilderLanguageProvider = BuilderLanguageContext.Provider;

function initialBuilderLanguage(): GameLanguage {
  if (typeof window === "undefined") return "zh";
  try {
    return loadGameSettings().language;
  } catch {
    return "zh";
  }
}

// Owns the builder language state + persistence. Call once in BuildPage and feed the
// result to <BuilderLanguageProvider value={...}>.
export function useBuilderLanguageState(): BuilderLanguageValue {
  const [language, setLanguageState] = useState<GameLanguage>(initialBuilderLanguage);

  const setLanguage = useCallback((next: GameLanguage) => {
    const normalized = normalizeLanguage(next);
    setLanguageState(normalized);
    try {
      saveGameSettings({ ...loadGameSettings(), language: normalized });
    } catch {
      // Persistence is non-critical; keep the in-memory value.
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = normalized === "zh" ? "zh-CN" : "en";
    }
  }, []);

  return useMemo<BuilderLanguageValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "en" ? "zh" : "en"),
    }),
    [language, setLanguage],
  );
}

// Plain-DOM builder components only. Do NOT call under an r3f <Canvas> — pass props.
export function useBuilderLanguage(): BuilderLanguageValue {
  const value = useContext(BuilderLanguageContext);
  if (!value) {
    return { language: "zh", setLanguage: () => {}, toggleLanguage: () => {} };
  }
  return value;
}
