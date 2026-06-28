import { useEffect } from "react";
import { localizedChoice } from "../game/config/LevelLocalization";
import type { LevelChoiceDefinition } from "../game/config/schema/levelConfig";
import type { GameWorld } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface ChoiceEventOverlayProps {
  world: GameWorld;
}

interface ChoiceSnapshot {
  visible: boolean;
  choice: LevelChoiceDefinition | null;
}

export function ChoiceEventOverlay({ world }: ChoiceEventOverlayProps) {
  const snapshot = usePolledSnapshot(() => readSnapshot(world), 140, sameChoiceSnapshot);

  useEffect(() => {
    if (snapshot.visible) {
      releaseDesktopPointerLock();
    }
  }, [snapshot.visible]);

  if (!snapshot.visible || !snapshot.choice) return null;
  const choice = localizedChoice(world.level, snapshot.choice, world.settings.language);

  return (
    <section className="upgrade-overlay choice-overlay" aria-label={world.settings.language === "en" ? "Story choice" : "剧情选择"}>
      <div className="upgrade-shell choice-shell">
        <div className="overlay-title">
          <span>{choice.systemLabel ?? (world.settings.language === "en" ? "Route Choice" : "路线选择")}</span>
          <strong>{choice.title}</strong>
        </div>
        <p className="choice-detail">{choice.detail}</p>
        <div className="upgrade-grid choice-grid">
          {choice.options.map((option) => (
            <button
              className={`upgrade-card choice-card ${option.tone ?? "system"}`}
              key={option.id}
              type="button"
              onClick={() => {
                world.chooseRuntimeChoice(option.id);
                if (world.session.mode === "playing") requestDesktopPointerLock();
              }}
            >
              <span className={`upgrade-symbol ${choiceToneIcon(option.tone)}`} aria-hidden="true" />
              <span className="upgrade-rarity">{choiceToneLabel(option.tone, world.settings.language)}</span>
              <strong>{option.label}</strong>
              {option.routeDeltas?.length ? (
                <span className="choice-route-tag">{option.routeDeltas.map(routeDeltaText).join(" / ")}</span>
              ) : null}
              <span>{option.detail}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function readSnapshot(world: GameWorld): ChoiceSnapshot {
  if (world.session.mode !== "choice") {
    return { visible: false, choice: null };
  }
  return {
    visible: true,
    choice: world.activeChoice(),
  };
}

function sameChoiceSnapshot(current: ChoiceSnapshot, next: ChoiceSnapshot) {
  return current.visible === next.visible && current.choice?.id === next.choice?.id;
}

function choiceToneIcon(tone: string | undefined) {
  if (tone === "reveal") return "story";
  if (tone === "threat") return "ultimate";
  if (tone === "player") return "core";
  return "assist";
}

function choiceToneLabel(tone: string | undefined, language: string) {
  if (language === "en") {
    if (tone === "reveal") return "Archive route";
    if (tone === "threat") return "Risk route";
    if (tone === "player") return "Self route";
    return "System route";
  }
  if (tone === "reveal") return "档案路线";
  if (tone === "threat") return "风险路线";
  if (tone === "player") return "自我路线";
  return "系统路线";
}

function routeDeltaText(delta: { routeId: string; label?: string; amount: number }) {
  const prefix = delta.amount > 0 ? "+" : "";
  return `${delta.label ?? delta.routeId} ${prefix}${delta.amount}`;
}
