import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import rootMenuBg from "../assets/gui/root-menu/hp-root-menu-bg.jpg";
import {
  loadGameSettings,
  normalizeLanguage,
  saveGameSettings,
  type GameLanguage,
  type GameSettings,
} from "../game/core/GameSettings";
import { playerStrings } from "../i18n/playerStrings";
import { RootMenuFlowBackground } from "./RootMenuFlowBackground";
import { useRootMenuMusic } from "./useRootMenuMusic";

function go(url: string) {
  if (typeof window !== "undefined") window.location.assign(url);
}

// Crisp facility-terminal chrome that lifts the active access slot: brass corner
// ticks + cyan edge keyline + edge beam + soft bloom. Idle it nearly vanishes so
// the painted frame in the art carries the slot.
function SlotChrome() {
  return (
    <>
      <span className="rm-slot-scrim" aria-hidden="true" />
      <span className="rm-slot-frame" aria-hidden="true" />
      <span className="rm-slot-bloom" aria-hidden="true" />
      <span className="rm-beam" aria-hidden="true" />
      <span className="rm-br rm-br-tl" aria-hidden="true" />
      <span className="rm-br rm-br-tr" aria-hidden="true" />
      <span className="rm-br rm-br-bl" aria-hidden="true" />
      <span className="rm-br rm-br-br" aria-hidden="true" />
    </>
  );
}

interface ActionDef {
  key: string;
  cls: string;
  label: string;
  hint: string;
  onClick: () => void;
}

export function RootMenuPage() {
  const [settings, setSettings] = useState<GameSettings>(() => loadGameSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const language = settings.language;
  const strings = playerStrings(language).rootMenu;
  useRootMenuMusic(settings.masterVolume, settings.musicVolume);
  const lat = language === "en" ? "rm-lat" : undefined;

  const persist = useCallback((next: GameSettings) => {
    setSettings(next);
    saveGameSettings(next);
  }, []);

  const setLanguage = useCallback(
    (next: GameLanguage) => {
      const normalized = normalizeLanguage(next);
      persist({ ...loadGameSettings(), language: normalized });
      if (typeof document !== "undefined") {
        document.documentElement.lang = normalized === "zh" ? "zh-CN" : "en";
      }
    },
    [persist],
  );

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const handleExit = useCallback(() => {
    window.close();
    window.setTimeout(() => setExitOpen(true), 120);
  }, []);

  // Show a short "facility access" loading sweep, then navigate (the destination
  // page does its own boot — this just makes the hand-off feel intentional).
  const launch = useCallback(
    (url: string, label: string) => {
      setLoading((current) => {
        if (current) return current;
        window.setTimeout(() => go(url), 880);
        return label;
      });
    },
    [],
  );

  const actions: ActionDef[] = [
    { key: "start", cls: "rm-slot1 rm-slot--primary", label: strings.start, hint: strings.startHint, onClick: () => launch("/play?level=level_01_maintenance_bay", strings.start) },
    { key: "build", cls: "rm-slot2", label: strings.build, hint: strings.buildHint, onClick: () => launch("/build", strings.build) },
    { key: "settings", cls: "rm-slot3", label: strings.settings, hint: strings.settingsHint, onClick: () => setSettingsOpen(true) },
    { key: "exit", cls: "rm-slot4 rm-slot--muted", label: strings.exit, hint: strings.exitHint, onClick: handleExit },
  ];

  return (
    <div className="root-menu" ref={rootRef}>
      <div className="root-menu-bg" style={{ "--root-menu-bg": `url(${rootMenuBg})` } as CSSProperties} />
      <RootMenuFlowBackground className="root-menu-flow" />
      <div className="root-menu-overlay" aria-hidden="true" />
      <div className="root-menu-vignette" aria-hidden="true" />

      <header className="root-menu-top">
        <div className="root-menu-brand">
          <strong className={lat}>{strings.brand}</strong>
          <span>{strings.tagline}</span>
        </div>
        <button
          type="button"
          className="root-menu-lang"
          onClick={() => setLanguage(language === "en" ? "zh" : "en")}
          aria-label={strings.langToggleAria}
          title={strings.langToggleAria}
        >
          {strings.langToggle}
        </button>
      </header>

      <div className="rm-slot-layer">
        <div className="rm-slot-stage">
          {actions.map((action) => (
            <button key={action.key} type="button" className={`rm-slot ${action.cls}`} onClick={action.onClick}>
              <SlotChrome />
              <span className="rm-slot-content">
                <span className={`rm-slot-label ${lat ?? ""}`}>{action.label}</span>
                <span className="rm-slot-hint">{action.hint}</span>
              </span>
              <span className="rm-slot-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rm-loading" role="status" aria-live="polite">
          <div className="rm-loading-panel">
            <ModalBrackets />
            <span className={`rm-loading-tag ${lat ?? ""}`}>{strings.loading}</span>
            <strong className="rm-loading-label">{loading}</strong>
            <div className="rm-loading-bar"><i /></div>
          </div>
          <div className="rm-loading-sweep" aria-hidden="true" />
        </div>
      ) : null}

      {settingsOpen ? (
        <RootSettingsModal
          settings={settings}
          strings={strings}
          lat={lat}
          onLanguage={setLanguage}
          onVolume={(key, value) => persist({ ...settings, [key]: value })}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {exitOpen ? (
        <div className="root-menu-modal-scrim" role="dialog" aria-modal="true" onClick={() => setExitOpen(false)}>
          <div className="root-menu-modal" onClick={(event) => event.stopPropagation()}>
            <ModalBrackets />
            <h3 className={lat}>{strings.exitTitle}</h3>
            <p>{strings.exitBody}</p>
            <div className="root-menu-modal-actions">
              <button type="button" className="root-menu-modal-btn" onClick={() => setExitOpen(false)}>
                <span className={lat}>{strings.close}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModalBrackets() {
  return (
    <>
      <span className="rm-br rm-br-tl" aria-hidden="true" />
      <span className="rm-br rm-br-tr" aria-hidden="true" />
      <span className="rm-br rm-br-bl" aria-hidden="true" />
      <span className="rm-br rm-br-br" aria-hidden="true" />
    </>
  );
}

type VolumeKey = "masterVolume" | "musicVolume" | "sfxVolume";

function RootSettingsModal({
  settings,
  strings,
  lat,
  onLanguage,
  onVolume,
  onClose,
}: {
  settings: GameSettings;
  strings: ReturnType<typeof playerStrings>["rootMenu"];
  lat: string | undefined;
  onLanguage: (language: GameLanguage) => void;
  onVolume: (key: VolumeKey, value: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const volumes: { key: VolumeKey; label: string }[] = [
    { key: "masterVolume", label: strings.masterVolume },
    { key: "musicVolume", label: strings.musicVolume },
    { key: "sfxVolume", label: strings.sfxVolume },
  ];

  return (
    <div className="root-menu-modal-scrim" role="dialog" aria-modal="true" aria-label={strings.settingsTitle} onClick={onClose}>
      <div className="root-menu-modal" onClick={(event) => event.stopPropagation()}>
        <ModalBrackets />
        <h3 className={lat}>{strings.settingsTitle}</h3>

        <div className="root-menu-field">
          <label className={lat}>{strings.language}</label>
          <div className="root-menu-lang-choice">
            <button type="button" className={settings.language === "zh" ? "active" : ""} aria-pressed={settings.language === "zh"} onClick={() => onLanguage("zh")}>
              中文
            </button>
            <button type="button" className={settings.language === "en" ? "active" : ""} aria-pressed={settings.language === "en"} onClick={() => onLanguage("en")}>
              English
            </button>
          </div>
        </div>

        {volumes.map((volume) => (
          <div className="root-menu-field" key={volume.key}>
            <label className={lat} htmlFor={`root-${volume.key}`}>
              {volume.label} <span className="root-menu-field-value">{Math.round(settings[volume.key] * 100)}</span>
            </label>
            <input
              id={`root-${volume.key}`}
              type="range"
              min={0}
              max={100}
              value={Math.round(settings[volume.key] * 100)}
              onChange={(event) => onVolume(volume.key, Number(event.target.value) / 100)}
            />
          </div>
        ))}

        <div className="root-menu-modal-actions">
          <button type="button" className="root-menu-modal-btn" onClick={onClose}>
            <span className={lat}>{strings.close}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
