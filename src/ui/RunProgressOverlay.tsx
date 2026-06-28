import { upgradeById } from "../game/config/upgradePool";
import { localizedConfigText, localizedObjective, localizedPresentationObjective, localizedWavePresentation } from "../game/config/LevelLocalization";
import type { LevelObjectiveDefinition, LevelObjectiveGuidanceDefinition, Vec3Tuple } from "../game/config/schema/levelConfig";
import type { GameMode, RewardPulseState } from "../game/core/GameMode";
import type { GameWorld } from "../game/core/GameWorld";
import type { GameLanguage } from "../game/core/GameSettings";
import { buildArchetypeLabel, playerStrings, type BuildArchetypeKey } from "../i18n/playerStrings";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface RunProgressOverlayProps {
  world: GameWorld;
}

interface RunProgressSnapshot {
  visible: boolean;
  mode: GameMode;
  waveLabel: string;
  waveProgress: string;
  objectiveTitle: string;
  objectiveDetail: string;
  guidance: ObjectiveGuidanceSnapshot | null;
  memoryFragments: number;
  killStreak: number;
  bestKillStreak: number;
  streakPercent: number;
  upgradeCount: number;
  buildName: string;
  rewardPulse: RewardPulseState | null;
  language: GameLanguage;
}

interface ObjectiveGuidanceSnapshot {
  label: string;
  detail: string;
  distanceText: string | null;
  urgency: "normal" | "puzzle" | "danger" | "exit";
}

export function RunProgressOverlay({ world }: RunProgressOverlayProps) {
  const snapshot = usePolledSnapshot(() => readRunProgress(world), 110, sameRunProgressSnapshot);

  if (!snapshot.visible) return null;

  return (
    <>
      <section className={`run-progress${snapshot.guidance ? " has-guidance" : ""}`} aria-label={playerStrings(snapshot.language).runProgress.sectionAria}>
        <div className="run-objective">
          <strong>{snapshot.objectiveTitle}</strong>
        </div>
        <div className="run-progress-meter" aria-hidden="true">
          <span style={{ "--streak": `${snapshot.streakPercent}%` } as React.CSSProperties} />
        </div>
        {snapshot.guidance ? (
          <div className={`run-guidance ${snapshot.guidance.urgency} compact-guidance`}>
            <span>{snapshot.language === "en" ? "Next" : "下一步"}</span>
            <strong>
              <b>{snapshot.guidance.label}</b>
              {snapshot.guidance.distanceText ? <small>{snapshot.guidance.distanceText}</small> : null}
            </strong>
          </div>
        ) : null}
        {snapshot.killStreak > 1 ? <div className="chain-chip">{snapshot.language === "en" ? `${snapshot.killStreak} streak` : `${snapshot.killStreak} 连杀`}</div> : null}
      </section>
      {snapshot.rewardPulse ? (
        <div className={`reward-pulse ${snapshot.rewardPulse.rarity}`} aria-live="polite">
          <span>{snapshot.rewardPulse.label}</span>
          <strong>{snapshot.rewardPulse.detail}</strong>
        </div>
      ) : null}
    </>
  );
}

function readRunProgress(world: GameWorld): RunProgressSnapshot {
  const activeWaveId = world.session.activeWaveId;
  let total = 0;
  let alive = 0;
  if (activeWaveId) {
    for (const enemy of world.enemies) {
      if (enemy.waveId !== activeWaveId) continue;
      total += 1;
      if (enemy.isAlive) alive += 1;
    }
  }
  const defeated = Math.max(0, total - alive);
  const visible = world.session.mode !== "title";

  return {
    visible,
    mode: world.session.mode,
    waveLabel: activeWaveId ? friendlyWaveLabel(world, activeWaveId) : nextWaveLabel(world),
    waveProgress: activeWaveId ? `${defeated}/${Math.max(1, total)}` : idleProgressText(world),
    objectiveTitle: locationTitle(world),
    objectiveDetail: objectiveDetail(world),
    guidance: objectiveGuidance(world),
    memoryFragments: world.session.memoryFragments,
    killStreak: world.session.killStreak,
    bestKillStreak: world.session.bestKillStreak,
    streakPercent: world.session.killStreak > 1 ? Math.round((world.session.killStreakRemaining / world.level.economy.killStreakWindowSec) * 100) : 0,
    upgradeCount: world.session.appliedUpgradeIds.length,
    buildName: buildName(world.session.appliedUpgradeIds, world.settings.language),
    rewardPulse: world.session.rewardPulse,
    language: world.settings.language,
  };
}

function objectiveGuidance(world: GameWorld): ObjectiveGuidanceSnapshot | null {
  if (world.session.mode !== "playing") return null;
  const activeObjective = world.activeObjective();
  if (!activeObjective) {
    if (!world.session.exitUnlocked) return null;
    return buildGuidance(world, {
      targetType: "exit",
      label: localizedPresentationObjective(world.level, "exitUnlocked", world.settings.language).title,
      detail: localizedPresentationObjective(world.level, "exitUnlocked", world.settings.language).detail,
      urgency: "exit",
    });
  }

  const explicit = activeObjective.guidance;
  const fallback = explicit ?? deriveGuidanceFromObjective(activeObjective);
  if (!fallback) return null;
  if (fallback.targetType === "exit" && !world.session.exitUnlocked) return null;
  return buildGuidance(world, fallback, activeObjective);
}

function buildGuidance(
  world: GameWorld,
  guidance: LevelObjectiveGuidanceDefinition,
  objective?: LevelObjectiveDefinition,
): ObjectiveGuidanceSnapshot | null {
  const target = guidanceTarget(world, guidance);
  const distance = target ? Math.round(Math.hypot(world.player.position.x - target[0], world.player.position.z - target[2])) : null;
  const targetLabel = guidance.label ?? inferredGuidanceLabel(world, guidance) ?? objective?.hudLabel ?? objective?.title;
  const detail = guidance.detail ?? objective?.detail ?? "";
  if (!targetLabel && !detail) return null;

  return {
    label: localizedConfigText(world.level, world.settings.language, targetLabel ?? ""),
    detail: localizedConfigText(world.level, world.settings.language, detail),
    distanceText: distance === null ? null : `${distance}m`,
    urgency: guidance.urgency ?? inferredUrgency(objective),
  };
}

function deriveGuidanceFromObjective(objective: LevelObjectiveDefinition): LevelObjectiveGuidanceDefinition | null {
  const trigger = objective.completesWhen;
  if (trigger.type === "key_collected") return { targetType: "key_item", targetId: trigger.id };
  if (trigger.type === "interaction_completed") return { targetType: "interaction", targetId: trigger.id, urgency: objective.type === "reach_exit" ? "exit" : "normal" };
  if (trigger.type === "door_opened") return { targetType: "door", targetId: trigger.id };
  if (trigger.type === "room_entered") return { targetType: "room", targetId: trigger.id };
  if (trigger.type === "puzzle_completed") return { targetType: "puzzle", targetId: trigger.id, urgency: "puzzle" };
  if (trigger.type === "wave_completed") return { targetType: "wave", targetId: trigger.id, urgency: "danger" };
  if (trigger.type === "exit_unlocked") return { targetType: "exit", urgency: "exit" };
  return null;
}

function guidanceTarget(world: GameWorld, guidance: LevelObjectiveGuidanceDefinition): Vec3Tuple | null {
  const map = world.level.map;
  if (guidance.targetType === "exit") return world.level.exit.position;
  if (!map || !guidance.targetId) return null;

  if (guidance.targetType === "room") return map.rooms.find((room) => room.id === guidance.targetId)?.bounds.center ?? null;
  if (guidance.targetType === "door") return map.doors.find((door) => door.id === guidance.targetId)?.position ?? null;
  if (guidance.targetType === "key_item") {
    const item = map.keyItems.find((candidate) => candidate.id === guidance.targetId);
    return item ? world.keyItemPosition(item) as Vec3Tuple : null;
  }
  if (guidance.targetType === "interaction") return map.interactions.find((interaction) => interaction.id === guidance.targetId)?.position ?? null;
  if (guidance.targetType === "puzzle") {
    const puzzle = world.level.puzzles?.find((candidate) => candidate.id === guidance.targetId);
    const room = puzzle ? map.rooms.find((candidate) => candidate.id === puzzle.roomId) : null;
    return room?.bounds.center ?? null;
  }
  if (guidance.targetType === "wave") {
    const wave = world.level.waves.find((candidate) => candidate.id === guidance.targetId);
    const room = wave ? roomForWave(world, wave) : null;
    if (room) return room.bounds.center;
    const firstGroup = wave?.enemies[0]?.from;
    const group = firstGroup ? world.level.spawnGroups.find((candidate) => candidate.id === firstGroup) : null;
    return group?.center ?? group?.positions?.[0] ?? null;
  }
  return null;
}

function inferredGuidanceLabel(world: GameWorld, guidance: LevelObjectiveGuidanceDefinition) {
  const map = world.level.map;
  if (guidance.targetType === "exit") return localizedPresentationObjective(world.level, "exitUnlocked", world.settings.language).title;
  if (!map || !guidance.targetId) return null;
  if (guidance.targetType === "room") return map.rooms.find((room) => room.id === guidance.targetId)?.label;
  if (guidance.targetType === "door") return map.doors.find((door) => door.id === guidance.targetId)?.label;
  if (guidance.targetType === "key_item") return map.keyItems.find((item) => item.id === guidance.targetId)?.label;
  if (guidance.targetType === "interaction") return map.interactions.find((interaction) => interaction.id === guidance.targetId)?.label;
  if (guidance.targetType === "puzzle") return world.level.puzzles?.find((puzzle) => puzzle.id === guidance.targetId)?.label;
  if (guidance.targetType === "wave") return friendlyWaveLabel(world, guidance.targetId);
  return null;
}

function inferredUrgency(objective?: LevelObjectiveDefinition): ObjectiveGuidanceSnapshot["urgency"] {
  if (!objective) return "normal";
  if (objective.type === "reach_exit") return "exit";
  if (objective.type === "boss_dead" || objective.type === "survive_wave") return "danger";
  if (objective.type === "custom") return "puzzle";
  return "normal";
}

function locationTitle(world: GameWorld) {
  if (world.session.mode === "upgrade") return localizedPresentationObjective(world.level, "upgrade", world.settings.language).title;
  const map = world.level.map;
  if (!map?.rooms.length) return localizedPresentationObjective(world.level, "default", world.settings.language).title;
  const currentRoomId = world.session.mapProgress.currentRoomId;
  const currentRoom = currentRoomId ? map.rooms.find((room) => room.id === currentRoomId) : null;
  const nearestRoom = currentRoom ?? nearestPlayerRoom(world);
  return localizedConfigText(world.level, world.settings.language, nearestRoom?.label ?? world.level.title);
}

function nearestPlayerRoom(world: GameWorld) {
  const rooms = world.level.map?.rooms;
  if (!rooms?.length) return null;
  let nearest = rooms[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const room of rooms) {
    const dx = world.player.position.x - room.bounds.center[0];
    const dz = world.player.position.z - room.bounds.center[2];
    const distance = dx * dx + dz * dz;
    if (distance < nearestDistance) {
      nearest = room;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function objectiveDetail(world: GameWorld) {
  if (world.session.mode === "upgrade") return localizedPresentationObjective(world.level, "upgrade", world.settings.language).detail;
  const activeObjective = world.activeObjective();
  if (activeObjective) return localizedObjective(world.level, activeObjective, world.settings.language).detail;
  if (!world.session.hasRod) return localizedPresentationObjective(world.level, "preRod", world.settings.language).detail;
  if (!world.session.hasPistol) return localizedPresentationObjective(world.level, "prePistol", world.settings.language).detail;
  if (world.session.exitUnlocked) return localizedPresentationObjective(world.level, "exitUnlocked", world.settings.language).detail;
  if (world.session.activeWaveId) {
    const wave = world.level.presentation.waves.find((candidate) => candidate.id === world.session.activeWaveId);
    return wave
      ? localizedWavePresentation(world.level, wave, world.settings.language).objectiveDetail
      : localizedPresentationObjective(world.level, "default", world.settings.language).detail;
  }
  return localizedPresentationObjective(world.level, "default", world.settings.language).detail;
}

function nextWaveLabel(world: GameWorld) {
  if (world.session.exitUnlocked) return progressObjective(world, "exitUnlocked").progressLabel;
  if (world.session.mode === "upgrade") return progressObjective(world, "upgrade").progressLabel;
  const activeObjective = world.activeObjective();
  if (activeObjective?.hudLabel) return localizedObjective(world.level, activeObjective, world.settings.language).hudLabel ?? activeObjective.hudLabel;
  const nextWave = world.level.waves[world.session.waveIndex];
  return nextWave
    ? `${world.settings.language === "en" ? "Next " : "下一波 "}${friendlyWaveLabel(world, nextWave.id)}`
    : world.settings.language === "en" ? "Complete" : "关卡完成";
}

function friendlyWaveLabel(world: GameWorld, waveId: string) {
  const label = world.level.presentation.waveLabels[waveId];
  if (label && label !== waveId) return localizedConfigText(world.level, world.settings.language, label);

  const wavePresentation = world.level.presentation.waves.find((wave) => wave.id === waveId);
  if (wavePresentation?.label && wavePresentation.label !== waveId) {
    return localizedWavePresentation(world.level, wavePresentation, world.settings.language).label;
  }

  const wave = world.level.waves.find((candidate) => candidate.id === waveId);
  const room = wave ? roomForWave(world, wave) : null;
  if (room?.label) return localizedConfigText(world.level, world.settings.language, room.label);

  const firstGroupId = wave?.enemies[0]?.from;
  const firstGroup = firstGroupId ? world.level.spawnGroups.find((group) => group.id === firstGroupId) : null;
  if (firstGroup?.label) return localizedConfigText(world.level, world.settings.language, firstGroup.label);

  if (rawConfigIdsEnabled()) return waveId;
  return world.settings.language === "en" ? "Enemy wave" : "敌对单位";
}

function rawConfigIdsEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const debug = params.get("debug");
  return debug === "1" || debug === "config" || debug === "graph" || params.get("rawIds") === "1";
}

function roomForWave(world: GameWorld, wave: { roomId?: string; enemies: readonly { from: string }[] }) {
  const rooms = world.level.map?.rooms;
  if (!rooms?.length) return null;
  if (wave.roomId) return rooms.find((room) => room.id === wave.roomId) ?? null;
  for (const spawn of wave.enemies) {
    if (!spawn.from.startsWith("sg_")) continue;
    const roomId = spawn.from.slice(3);
    const room = rooms.find((candidate) => candidate.id === roomId);
    if (room) return room;
  }
  return null;
}

function idleProgressText(world: GameWorld) {
  if (world.session.mode === "upgrade") return progressObjective(world, "upgrade").progressText;
  if (world.session.exitUnlocked) return progressObjective(world, "exitUnlocked").progressText;
  if (world.session.waveStartDelay > 0) return `${world.session.waveStartDelay.toFixed(1)}s`;
  return "--";
}

function progressObjective(world: GameWorld, key: "upgrade" | "exitUnlocked") {
  return localizedPresentationObjective(world.level, key, world.settings.language) as {
    title: string;
    detail: string;
    progressLabel: string;
    progressText: string;
  };
}

function buildName(appliedUpgradeIds: string[], language: GameLanguage) {
  return buildArchetypeLabel(buildArchetypeKey(appliedUpgradeIds), language);
}

function buildArchetypeKey(appliedUpgradeIds: string[]): BuildArchetypeKey {
  if (appliedUpgradeIds.length === 0) return "unformed";
  let blade = 0;
  let gun = 0;
  let ultimate = 0;
  let core = 0;
  let story = 0;
  for (const id of appliedUpgradeIds) {
    const upgrade = upgradeById.get(id);
    if (!upgrade) continue;
    if (upgrade.category === "blade") blade += 1;
    else if (upgrade.category === "gun") gun += 1;
    else if (upgrade.category === "ultimate") ultimate += 1;
    else if (upgrade.category === "core") core += 1;
    else if (upgrade.category === "story") story += 1;
  }
  if (blade > 0 && gun > 0) return "rodPistol";
  if (blade > 0 && ultimate > 0) return "meleeCell";
  if (gun > 0 && ultimate > 0) return "firepowerCell";
  if (core > 0 && gun > 0) return "survivalGunner";
  if (core > 0 && blade > 0) return "survivalRod";
  const primary = primaryBuildCategory(blade, gun, ultimate, core, story);
  if (primary === "blade") return "labRod";
  if (primary === "gun") return "pistolControl";
  if (primary === "ultimate") return "cellBurst";
  if (primary === "core") return "survivalRoute";
  if (primary === "story") return "anomalousEcho";
  return "support";
}

function primaryBuildCategory(blade: number, gun: number, ultimate: number, core: number, story: number) {
  let category = "assist";
  let count = 0;
  if (blade > count) {
    category = "blade";
    count = blade;
  }
  if (gun > count) {
    category = "gun";
    count = gun;
  }
  if (ultimate > count) {
    category = "ultimate";
    count = ultimate;
  }
  if (core > count) {
    category = "core";
    count = core;
  }
  if (story > count) {
    category = "story";
  }
  return category;
}

function sameRunProgressSnapshot(current: RunProgressSnapshot, next: RunProgressSnapshot) {
  return (
    current.visible === next.visible &&
    current.mode === next.mode &&
    current.waveLabel === next.waveLabel &&
    current.waveProgress === next.waveProgress &&
    current.objectiveTitle === next.objectiveTitle &&
    current.objectiveDetail === next.objectiveDetail &&
    current.guidance?.label === next.guidance?.label &&
    current.guidance?.detail === next.guidance?.detail &&
    current.guidance?.distanceText === next.guidance?.distanceText &&
    current.guidance?.urgency === next.guidance?.urgency &&
    current.memoryFragments === next.memoryFragments &&
    current.killStreak === next.killStreak &&
    current.bestKillStreak === next.bestKillStreak &&
    current.streakPercent === next.streakPercent &&
    current.upgradeCount === next.upgradeCount &&
    current.buildName === next.buildName &&
    current.rewardPulse?.id === next.rewardPulse?.id &&
    current.language === next.language
  );
}
