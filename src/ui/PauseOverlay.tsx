import { useEffect, type CSSProperties } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import { TOUCH_LOOK_SENSITIVITY_MAX, TOUCH_LOOK_SENSITIVITY_MIN } from "../game/core/GameSettings";
import type { GameMode } from "../game/core/GameMode";
import type { GameWorld } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface PauseOverlayProps {
  world: GameWorld;
}

interface PauseSnapshot {
  paused: boolean;
  mode: GameMode;
  language: GameLanguage;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  touchLookSensitivity: number;
}

const copyByLanguage = {
  zh: {
    eyebrow: "暂停",
    title: "维修舱暂停",
    settingsTitle: "系统设置",
    close: "关闭",
    resume: "继续游戏",
    restart: "重开本关",
    mainMenu: "返回主页面",
    language: "语言",
    audio: "音量",
    master: "总音量",
    music: "音乐",
    sfx: "音效",
    control: "操控",
    touchLook: "触屏视角灵敏度",
    zh: "中文",
    en: "English",
  },
  en: {
    eyebrow: "Paused",
    title: "Maintenance Bay Paused",
    settingsTitle: "System Settings",
    close: "Close",
    resume: "Resume",
    restart: "Restart Level",
    mainMenu: "Main Menu",
    language: "Language",
    audio: "Audio",
    master: "Master",
    music: "Music",
    sfx: "SFX",
    control: "Controls",
    touchLook: "Touch look sensitivity",
    zh: "中文",
    en: "English",
  },
} satisfies Record<GameLanguage, Record<string, string>>;

export function PauseOverlay({ world }: PauseOverlayProps) {
  const snapshot = usePolledSnapshot(() => readPauseSnapshot(world), 90, samePauseSnapshot);
  const copy = copyByLanguage[snapshot.language];

  useEffect(() => {
    document.documentElement.lang = snapshot.language === "zh" ? "zh-CN" : "en";
  }, [snapshot.language]);

  useEffect(() => {
    if (snapshot.paused) {
      releaseDesktopPointerLock();
    }
  }, [snapshot.paused]);

  if (!snapshot.paused || (snapshot.mode !== "playing" && snapshot.mode !== "title")) return null;
  const playing = snapshot.mode === "playing";

  return (
    <section className="pause-overlay" aria-label={playing ? copy.title : copy.settingsTitle}>
      <div className="pause-panel">
        <div className="pause-header">
          <span>{copy.eyebrow}</span>
          <strong>{playing ? copy.title : copy.settingsTitle}</strong>
        </div>

        <div className="pause-actions">
          <button
            className="pause-primary"
            type="button"
            onClick={() => {
              world.resumeFromPause();
              if (playing) requestDesktopPointerLock();
            }}
          >
            {playing ? copy.resume : copy.close}
          </button>
          {playing ? (
            <button
              type="button"
              onClick={() => {
                world.restartFromDeath();
                world.resumeFromPause();
                requestDesktopPointerLock();
              }}
            >
              {copy.restart}
            </button>
          ) : null}
          <button type="button" className="pause-main-menu" onClick={() => window.location.assign("/")}>
            {copy.mainMenu}
          </button>
        </div>

        <div className="pause-section">
          <span className="pause-section-title">{copy.language}</span>
          <div className="pause-language" role="group" aria-label={copy.language}>
            <button
              className={snapshot.language === "zh" ? "active" : ""}
              type="button"
              aria-pressed={snapshot.language === "zh"}
              onClick={() => world.setLanguage("zh")}
            >
              {copy.zh}
            </button>
            <button
              className={snapshot.language === "en" ? "active" : ""}
              type="button"
              aria-pressed={snapshot.language === "en"}
              onClick={() => world.setLanguage("en")}
            >
              {copy.en}
            </button>
          </div>
        </div>

        <div className="pause-section">
          <span className="pause-section-title">{copy.audio}</span>
          <VolumeRow label={copy.master} value={snapshot.masterVolume} onChange={(value) => world.setMasterVolume(value)} />
          <VolumeRow label={copy.music} value={snapshot.musicVolume} onChange={(value) => world.setMusicVolume(value)} />
          <VolumeRow label={copy.sfx} value={snapshot.sfxVolume} onChange={(value) => world.setSfxVolume(value)} />
        </div>

        <div className="pause-section">
          <span className="pause-section-title">{copy.control}</span>
          <SensitivityRow
            label={copy.touchLook}
            value={snapshot.touchLookSensitivity}
            onChange={(value) => world.setTouchLookSensitivity(value)}
          />
        </div>
      </div>
    </section>
  );
}

function VolumeRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const percentage = Math.round(value * 100);

  return (
    <label className="pause-volume">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={percentage}
        onChange={(event) => onChange(Number(event.currentTarget.value) / 100)}
        style={{ "--volume": `${percentage}%` } as CSSProperties}
      />
      <strong>{percentage}</strong>
    </label>
  );
}

function SensitivityRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const span = TOUCH_LOOK_SENSITIVITY_MAX - TOUCH_LOOK_SENSITIVITY_MIN;
  const fill = Math.round(((value - TOUCH_LOOK_SENSITIVITY_MIN) / span) * 100);
  const steps = Math.round((value - TOUCH_LOOK_SENSITIVITY_MIN) / 0.05);
  const maxSteps = Math.round(span / 0.05);

  return (
    <label className="pause-volume">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={maxSteps}
        step={1}
        value={steps}
        onChange={(event) => onChange(TOUCH_LOOK_SENSITIVITY_MIN + Number(event.currentTarget.value) * 0.05)}
        style={{ "--volume": `${fill}%` } as CSSProperties}
      />
      <strong>{value.toFixed(2)}×</strong>
    </label>
  );
}

function readPauseSnapshot(world: GameWorld): PauseSnapshot {
  return {
    paused: world.paused,
    mode: world.session.mode,
    language: world.settings.language,
    masterVolume: world.settings.masterVolume,
    musicVolume: world.settings.musicVolume,
    sfxVolume: world.settings.sfxVolume,
    touchLookSensitivity: world.settings.touchLookSensitivity,
  };
}

function samePauseSnapshot(current: PauseSnapshot, next: PauseSnapshot) {
  return (
    current.paused === next.paused &&
    current.mode === next.mode &&
    current.language === next.language &&
    current.masterVolume === next.masterVolume &&
    current.musicVolume === next.musicVolume &&
    current.sfxVolume === next.sfxVolume &&
    current.touchLookSensitivity === next.touchLookSensitivity
  );
}
