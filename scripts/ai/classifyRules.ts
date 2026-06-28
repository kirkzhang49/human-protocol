/**
 * 规则分类器（Phase 1，零模型）。
 *
 * 纯函数 classify(card) → ClassificationResult：arc / 房间角色 / 难度 / 节奏 /
 * 视觉完整度 / 解密结构 / 风险标签 / 母题。全部基于 ConfigCard 的确定性派生，
 * 既是给作者的即时体检，也是 LLM 的对照基线与 fallback（设计文档 §2）。
 *
 * Run:  scripts/ai/run.sh classifyRules.ts            # 全 20 关一览表
 *       scripts/ai/run.sh classifyRules.ts level_05_reclamation_core   # 单关详情(JSON)
 */
import type { ConfigCard } from "./extractConfigCard";

export type Arc =
  | "maintenance" | "fake_home" | "museum" | "clinic" | "reclamation"
  | "cyber" | "surveillance" | "power" | "counterfeit_home" | "black_clinic"
  | "smoke" | "unknown";

export type RoomRole = "spawn" | "lock_hub" | "puzzle_room" | "robot_room" | "key_room" | "exit" | "reveal_room" | "side_room";

export interface ClassificationResult {
  arc: Arc;
  arcConfidence: number;
  roomRoles: Record<string, RoomRole>;
  difficulty: { exploration: number; puzzle: number; combat: number; routeComplexity: number };
  difficultyOverall: number;
  pacing: string[];
  visualCompleteness: number; // 0..1
  puzzleStructure: { count: number; chainDepth: number; kinds: string[]; gatingPattern: string[] };
  riskTags: string[];
  motifsHit: string[];
}

const ARC_RULES: Array<[RegExp, Arc]> = [
  [/black_clinic|black_diagnos/i, "black_clinic"],
  [/counterfeit|fake_home_market|伪宅/i, "counterfeit_home"],
  [/power_district|配电|供能/i, "power"],
  [/surveillance|监控/i, "surveillance"],
  [/cyber|foyer|霓虹/i, "cyber"],
  [/reclamation|回收/i, "reclamation"],
  [/memory_clinic|clinic|诊所|memory/i, "clinic"],
  [/museum|博物馆/i, "museum"],
  [/residential|fake_home|居住|住户/i, "fake_home"],
  [/maintenance|维修/i, "maintenance"],
  [/^smoke_|smoke/i, "smoke"],
];

function inferArc(id: string): { arc: Arc; confidence: number } {
  if (/^smoke_/i.test(id)) return { arc: "smoke", confidence: 1 }; // 前缀最高优先级，盖过机制名
  for (const [re, arc] of ARC_RULES) if (re.test(id)) return { arc, confidence: arc === "smoke" ? 1 : 0.95 };
  return { arc: "unknown", confidence: 0 };
}

function inferRoomRole(
  room: ConfigCard["roomsGraph"]["rooms"][number],
  spawnRoomId: string | null,
  exitRoomId: string | null,
): RoomRole {
  if (room.id === spawnRoomId) return "spawn";
  if (room.id === exitRoomId) return room.mood === "reveal" ? "reveal_room" : "exit";
  if (room.mood === "boss") return "robot_room";
  if (room.doorDegree >= 3) return "lock_hub";
  if (room.hasPuzzle) return "puzzle_room";
  if (room.hasKeyItem) return "key_room";
  if (room.hasRobots || room.mood === "combat") return "robot_room";
  if (room.mood === "reveal") return "reveal_room";
  return "side_room";
}

function inferPacing(card: ConfigCard): string[] {
  const tags: string[] = [];
  const { waveCount, estimatedActiveEnemies } = card.robotsCombat;
  const puzzles = card.puzzleChain.length;
  const rooms = card.roomsGraph.roomCount;
  const maxDegree = Math.max(0, ...card.roomsGraph.rooms.map((r) => r.doorDegree));

  if (waveCount >= 5 || estimatedActiveEnemies >= 12) tags.push("combat_heavy");
  if (puzzles >= 2 && waveCount <= 3) tags.push("puzzle_focused");
  if (rooms >= 7) tags.push("exploration");
  if (card.robotsCombat.bossPhaseCount > 0) tags.push("boss_finale");
  tags.push(maxDegree >= 3 ? "hub_spoke" : "linear");
  if (tags.length === 1) tags.unshift("balanced");
  return tags;
}

/** 视觉完整度（0..1）—— level 层近似式（设计文档 §2.4 的可用版）。 */
function visualCompleteness(card: ConfigCard): number {
  const rooms = Math.max(1, card.roomsGraph.roomCount);
  const hasLighting = card.visualStory.lightingPreset ? 1 : 0;
  const materialCoverage = card.visualStory.roomsWithMaterials / rooms;
  const propDensity = Math.min(1, card.assetCoverage.distinctModelKeys / (rooms * 2));
  const assetWarnings = card.riskMetrics.warningCodes.filter((c) => c.startsWith("asset.")).length;
  const noAssetGaps = assetWarnings === 0 ? 1 : 0;
  const motifs = card.visualStory.motifsHit.length >= 2 ? 1 : 0;
  const score = 0.3 * hasLighting + 0.25 * materialCoverage + 0.2 * propDensity + 0.15 * noAssetGaps + 0.1 * motifs;
  return Math.round(score * 100) / 100;
}

function inferGatingPattern(card: ConfigCard): string[] {
  const types = new Set(card.doorLockChain.map((l) => l.lockType));
  const out: string[] = [];
  if (types.has("key_item")) out.push("sequential_key");
  if (types.has("puzzle_complete")) out.push("puzzle_gate");
  if (types.has("inventory_count")) out.push("multi_key_hub");
  if (types.has("survive_wave")) out.push("survive_gate");
  if (types.has("objective_complete")) out.push("objective_gate");
  if (out.length >= 3) out.push("mixed_chain");
  return out.length ? out : ["open"];
}

/** 沿关键路径的锁定门数量 = 顺序闸门深度。 */
function chainDepth(card: ConfigCard): number {
  return card.doorLockChain.filter((l) => l.blocksCriticalPath && l.lockType !== "none").length;
}

function riskTags(card: ConfigCard): string[] {
  const m = card.riskMetrics;
  const tags: string[] = [];
  if (!m.validatorOk) tags.push("config_invalid");
  if (!m.exitRoomReachable) tags.push("no_exit");
  if (m.unreachablePuzzles.length) tags.push("key_unreachable");
  if (m.copyScanViolations.length) tags.push("player_facing_debug_words");
  if (!card.visualStory.storyPresent) tags.push("missing_story");
  if (card.visualStory.motifsHit.length < 2) tags.push("weak_narrative_identity");
  if (visualCompleteness(card) < 0.5) tags.push("too_little_visual_identity");
  if (m.warningCodes.includes("budget.enemy.high") || card.robotsCombat.estimatedActiveEnemies >= 14) tags.push("too_much_combat");
  if (!card.visualStory.lightingPreset && card.meta.sourceLayer === "level") tags.push("no_named_lighting_preset");
  // 谜题单调：≥3 座却全同种类，缺变化感。
  const kinds = new Set(card.puzzleChain.map((p) => p.kind));
  if (card.puzzleChain.length >= 3 && kinds.size === 1) tags.push("monotonous_puzzles");
  // 死胡同空房：非出生/出口、只有一扇门、且无谜题/钥匙/机器人——浪费空间。
  const deadEnd = card.roomsGraph.rooms.find(
    (r) =>
      r.id !== card.roomsGraph.spawnRoomId &&
      r.id !== card.roomsGraph.exitRoomId &&
      r.doorDegree <= 1 &&
      r.mood !== "reveal" &&
      !r.hasPuzzle && !r.hasKeyItem && !r.hasRobots && !r.hasStory,
  );
  if (deadEnd) tags.push("dead_end_room");
  return tags;
}

export function classify(card: ConfigCard): ClassificationResult {
  const { arc, confidence } = inferArc(card.meta.id);
  const roomRoles: Record<string, RoomRole> = {};
  for (const room of card.roomsGraph.rooms) {
    roomRoles[room.id] = inferRoomRole(room, card.roomsGraph.spawnRoomId, card.roomsGraph.exitRoomId);
  }
  const d = card.riskMetrics.difficulty;
  return {
    arc,
    arcConfidence: confidence,
    roomRoles,
    difficulty: d,
    difficultyOverall: Math.round(((d.exploration + d.puzzle + d.combat + d.routeComplexity) / 4) * 10) / 10,
    pacing: inferPacing(card),
    visualCompleteness: visualCompleteness(card),
    puzzleStructure: {
      count: card.puzzleChain.length,
      chainDepth: chainDepth(card),
      kinds: [...new Set(card.puzzleChain.map((p) => p.kind))],
      gatingPattern: inferGatingPattern(card),
    },
    riskTags: riskTags(card),
    motifsHit: card.visualStory.motifsHit,
  };
}

// ── CLI ──
const invokedDirectly = process.argv[1]?.endsWith("classifyRules.ts");
if (invokedDirectly) {
  const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
  const { extractConfigCard } = await import("./extractConfigCard");
  const wantId = process.argv[2];

  if (wantId) {
    const level = humanProtocolBasePack.levels.find((l) => l.id === wantId);
    if (!level) { console.error(`level not found: ${wantId}`); process.exit(1); }
    console.log(JSON.stringify(classify(extractConfigCard(level)), null, 2));
  } else {
    console.log("arc            | overall | E P C R | pacing                         | puzzles(kinds)            | risks");
    console.log("-".repeat(132));
    for (const level of humanProtocolBasePack.levels) {
      const c = classify(extractConfigCard(level));
      const d = c.difficulty;
      const row = [
        c.arc.padEnd(14),
        String(c.difficultyOverall).padStart(6),
        ` ${d.exploration} ${d.puzzle} ${d.combat} ${d.routeComplexity}`,
        c.pacing.join(",").slice(0, 30).padEnd(30),
        `${c.puzzleStructure.count}(${c.puzzleStructure.kinds.join("/")})`.slice(0, 25).padEnd(25),
        c.riskTags.join(",") || "—",
      ].join(" | ");
      console.log(`${level.id.padEnd(0)}\n  ${row}`);
    }
  }
}
