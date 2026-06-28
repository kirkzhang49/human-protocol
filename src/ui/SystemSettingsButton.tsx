import type { GameMode } from "../game/core/GameMode";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface SystemSettingsButtonProps {
  world: GameWorld;
}

interface SettingsButtonSnapshot {
  mode: GameMode;
  paused: boolean;
  language: GameLanguage;
}

export function SystemSettingsButton({ world }: SystemSettingsButtonProps) {
  const snapshot = usePolledSnapshot(() => ({
    mode: world.session.mode,
    paused: world.paused,
    language: world.settings.language,
  }), 120, sameSnapshot);

  if (snapshot.paused || snapshot.mode === "upgrade" || snapshot.mode === "choice" || snapshot.mode === "transition") return null;

  const label = snapshot.language === "en" ? "Settings" : "设置";

  return (
    <button
      className="system-settings-button"
      type="button"
      aria-label={label}
      onClick={() => world.openSettings()}
      onPointerDown={() => world.openSettings()}
    >
      <span aria-hidden="true">⚙</span>
      <strong>{label}</strong>
    </button>
  );
}

function sameSnapshot(current: SettingsButtonSnapshot, next: SettingsButtonSnapshot) {
  return current.mode === next.mode && current.paused === next.paused && current.language === next.language;
}
