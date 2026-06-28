import type { GameWorld } from "../core/GameWorld";
import { isEnemyVisibleToPlayerRoom } from "../core/RoomReachability";
import type { MusicState } from "./MusicTypes";

/** Modes that put a hard puzzle/reading modal on screen. */
const PUZZLE_OVERLAY_MODES = new Set([
  "article",
  "quiz",
  "toolCalibration",
  "sequencePlayback",
  "circuitGrid",
  "surveillance",
  "valveMatrix",
  "archiveMerge",
  "galleryReading",
  "routeSwitch",
]);

const BOSS_TIERS = new Set(["elite", "leader", "boss"]);

export interface MusicStateContext {
  /** True for a short window after a recent puzzle interaction in free play. */
  recentPuzzle: boolean;
}

/**
 * Maps live game state to a music state. Terminal/modal modes win first, then
 * boss > combat > puzzle > exit-flag > explore (matching the requested rules).
 * Build BGM is driven separately by the /build editor, not here.
 */
export function resolveMusicState(world: GameWorld, ctx: MusicStateContext): MusicState {
  const mode = world.session.mode;

  if (mode === "title" || mode === "death") return "silent";
  if (mode === "victory") return "victory";
  if (mode === "transition") return "transition";
  if (mode === "exitCinematic") return "exit";
  if (PUZZLE_OVERLAY_MODES.has(mode)) return "puzzle";

  if (isBossActive(world)) return "boss";
  if (isCombatActive(world)) return "combat";
  if (ctx.recentPuzzle || world.activeObjective()?.guidance?.urgency === "puzzle") return "puzzle";
  if (world.session.exitUnlocked) return "exit";
  return "explore";
}

function isBossActive(world: GameWorld): boolean {
  for (const enemy of world.enemies) {
    if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
    if (enemy.isAlive && BOSS_TIERS.has(enemy.tier)) return true;
  }
  return false;
}

function isCombatActive(world: GameWorld): boolean {
  for (const enemy of world.enemies) {
    if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
    if (enemy.isAlive) return true;
  }
  // A wave is declared but its enemies have not spawned yet — still pressure.
  return world.session.activeWaveId !== null;
}
