import type { InteractionPromptState, SpawnWarningState } from "../game/core/GameMode";
import { localizedExit } from "../game/config/LevelLocalization";
import type { GameWorld } from "../game/core/GameWorld";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface MissionOverlayProps {
  world: GameWorld;
}

interface MissionSnapshot {
  mode: string;
  healthPercent: number;
  exitUnlocked: boolean;
  exitCueReady: boolean;
  exitDistance: number;
  spawnWarning: SpawnWarningState | null;
  interactionPrompt: InteractionPromptState | null;
}

export function MissionOverlay({ world }: MissionOverlayProps) {
  const snapshot = usePolledSnapshot(() => readMission(world), 160, sameMissionSnapshot);

  const lowHealth = snapshot.mode === "playing" && snapshot.healthPercent <= 35;
  const showExit = snapshot.mode === "playing" && snapshot.exitUnlocked && snapshot.exitCueReady;

  return (
    <>
      {lowHealth ? (
        <div className="critical-warning" aria-live="polite">
          <span>{world.settings.language === "en" ? "Barely holding on" : "快撑不住了"}</span>
        </div>
      ) : null}
      {snapshot.mode === "playing" && snapshot.spawnWarning ? (
        <div className="mission-cue spawn-warning-cue" aria-live="polite">
          <span>{snapshot.spawnWarning.label}</span>
          <strong>{snapshot.spawnWarning.detail}</strong>
        </div>
      ) : null}
      {showExit ? (
        <div className="mission-cue" aria-live="polite">
          <span>{localizedExit(world.level, world.settings.language).unlockedLabel}</span>
          <strong>
            {world.settings.language === "en" ? "" : "距"}
            {localizedExit(world.level, world.settings.language).distanceLabel} {Math.max(0, Math.round(snapshot.exitDistance))}m
          </strong>
        </div>
      ) : null}
      {snapshot.mode === "playing" && snapshot.interactionPrompt ? (
        <div className={snapshot.interactionPrompt.canInteract ? "interaction-cue" : "interaction-cue locked"} aria-live="polite">
          <kbd>{snapshot.interactionPrompt.controlLabel}</kbd>
          <span>{snapshot.interactionPrompt.label}</span>
          <strong>{snapshot.interactionPrompt.detail}</strong>
        </div>
      ) : null}
    </>
  );
}

function readMission(world: GameWorld): MissionSnapshot {
  const exit = world.level.exit;
  const dx = world.player.position.x - exit.position[0];
  const dz = world.player.position.z - exit.position[2];
  return {
    mode: world.session.mode,
    healthPercent: aliveHealthPercent(world.player.health, world.player.maxHealth),
    exitUnlocked: world.session.exitUnlocked,
    exitCueReady: isExitCueReady(world),
    exitDistance: Math.round(Math.hypot(dx, dz)),
    spawnWarning: world.session.spawnWarning,
    interactionPrompt: world.session.interactionPrompt,
  };
}

function isExitCueReady(world: GameWorld) {
  if (!world.session.exitUnlocked) return false;
  const activeObjective = world.activeObjective();
  return !activeObjective || activeObjective.type === "reach_exit";
}

function aliveHealthPercent(health: number, maxHealth: number) {
  if (health <= 0 || maxHealth <= 0) return 0;
  return Math.max(1, Math.round((health / maxHealth) * 100));
}

function sameMissionSnapshot(current: MissionSnapshot, next: MissionSnapshot) {
  return (
    current.mode === next.mode &&
    current.healthPercent === next.healthPercent &&
    current.exitUnlocked === next.exitUnlocked &&
    current.exitCueReady === next.exitCueReady &&
    current.exitDistance === next.exitDistance &&
    current.spawnWarning?.id === next.spawnWarning?.id &&
    current.interactionPrompt?.id === next.interactionPrompt?.id &&
    current.interactionPrompt?.label === next.interactionPrompt?.label &&
    current.interactionPrompt?.detail === next.interactionPrompt?.detail &&
    current.interactionPrompt?.controlLabel === next.interactionPrompt?.controlLabel &&
    current.interactionPrompt?.canInteract === next.interactionPrompt?.canInteract
  );
}
