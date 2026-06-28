import { useEffect } from "react";
import { localizedUpgrade, localizedUpgradeRarity } from "../game/config/UpgradeLocalization";
import { upgradeById, type UpgradeDefinition } from "../game/config/upgradePool";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface UpgradeChoiceOverlayProps {
  world: GameWorld;
}

interface UpgradeSnapshot {
  visible: boolean;
  choices: UpgradeDefinition[];
  language: GameLanguage;
}

const emptyChoices: UpgradeDefinition[] = [];

export function UpgradeChoiceOverlay({ world }: UpgradeChoiceOverlayProps) {
  const snapshot = usePolledSnapshot(() => readSnapshot(world), 140, sameUpgradeSnapshot);

  useEffect(() => {
    if (snapshot.visible) {
      releaseDesktopPointerLock();
    }
  }, [snapshot.visible]);

  if (!snapshot.visible) return null;

  return (
    <section className="upgrade-overlay" aria-label={snapshot.language === "en" ? "Upgrade choice" : "升级选择"}>
      <div className="upgrade-shell">
        <div className="overlay-title">
          <span>{snapshot.language === "en" ? "Body stress response" : "身体应激反应"}</span>
          <strong>{snapshot.language === "en" ? "Choose one" : "选择一项"}</strong>
        </div>
        <div className="upgrade-grid">
          {snapshot.choices.map((choice) => (
            <button
              className={`upgrade-card ${choice.rarity.toLowerCase()}`}
              key={choice.id}
              type="button"
              onClick={() => {
                world.chooseUpgrade(choice.id);
                requestDesktopPointerLock();
              }}
            >
              <span className={`upgrade-symbol ${choice.category}`} aria-hidden="true" />
              <span className="upgrade-rarity">{localizedUpgradeRarity(choice.rarity, snapshot.language)} · {choice.role}</span>
              <strong>{choice.title}</strong>
              <span>{choice.description}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function readSnapshot(world: GameWorld): UpgradeSnapshot {
  if (world.session.mode !== "upgrade" || world.session.pendingUpgradeIds.length === 0) {
    return {
      visible: false,
      choices: emptyChoices,
      language: world.settings.language,
    };
  }

  const choices: UpgradeDefinition[] = [];
  for (const id of world.session.pendingUpgradeIds) {
    const upgrade = upgradeById.get(id);
    if (upgrade) choices.push(localizedUpgrade(upgrade, world.settings.language));
  }

  return {
    visible: world.session.mode === "upgrade" && choices.length > 0,
    choices,
    language: world.settings.language,
  };
}

function sameUpgradeSnapshot(current: UpgradeSnapshot, next: UpgradeSnapshot) {
  if (current.visible !== next.visible) return false;
  if (current.language !== next.language) return false;
  if (current.choices.length !== next.choices.length) return false;
  for (let index = 0; index < current.choices.length; index += 1) {
    if (current.choices[index].id !== next.choices[index].id) return false;
  }
  return true;
}
