/**
 * ConfigCard 提取器（Phase 0）。
 *
 * 把一个 LevelDefinition 规范化成有损但稳定的 ConfigCard IR ——
 * 模型的唯一输入。纯函数，复用现有纯函数 explainPuzzle + validateLevelConfig，
 * 不重写任何图算法。零 runtime 依赖（无 React/DOM）。
 *
 * 设计见 docs/human-protocol-local-ai-config-planner.md §1。
 *
 * Run (single level):
 *   tsx --tsconfig tsconfig.app.json \
 *     scripts/ai/extractConfigCard.ts <levelId>
 */
import type { LevelDefinition } from "../../src/game/config/schema/levelConfig";
import { validateLevelConfig } from "../../src/game/config/ConfigValidator";
import { explainPuzzle } from "../../src/game/config/validation/puzzleGraphValidator";
import { scanPlayerFacingText, type CopyScanHit } from "./copyScan";

export interface ConfigCard {
  meta: {
    sourceLayer: "level";
    id: string;
    title: string;
    authoringProfile: "internal" | "generated";
    schemaVersions: { map: string | null; levelRoot: null };
  };
  roomsGraph: {
    roomCount: number;
    rooms: Array<{
      id: string;
      label: string;
      mood: string;
      aesthetic: string | null;
      ambientPressure: number | null;
      hasPuzzle: boolean;
      hasRobots: boolean;
      hasKeyItem: boolean;
      hasStory: boolean;
      doorDegree: number;
    }>;
    spawnRoomId: string | null;
    exitRoomId: string | null;
    adjacency: Array<[string, string]>;
    criticalPathRoomIds: string[];
    optionalRoomIds: string[];
    maxBacktrackSeconds: number | null;
    mobileReadableDoorCount: number | null;
  };
  doorLockChain: Array<{
    doorId: string;
    from: string;
    to: string;
    lockType: string;
    requires: string[];
    blocksCriticalPath: boolean;
  }>;
  puzzleChain: Array<{
    puzzleId: string;
    kind: string;
    roomId: string;
    linkedDoorId: string | null;
    unlocksExit: boolean;
    requires: string[];
    reachableFromSpawn: boolean;
  }>;
  routeSwitchGraph: {
    switchCount: number;
    campaignRouteCount: number;
    choiceCount: number;
  };
  pickups: {
    keyItems: Array<{ id: string; roomId: string; requiredForDoorIds: string[] }>;
    repairKitCount: number;
    coreCellCount: number;
    storyPickups: string[];
  };
  robotsCombat: {
    waveCount: number;
    enemiesByArchetype: Record<string, number>;
    tiers: string[];
    estimatedActiveEnemies: number;
    bossPhaseCount: number;
    rewards: string[];
    combatRoomIds: string[];
  };
  visualStory: {
    lightingPreset: string | null;
    roomsWithMaterials: number;
    storyPresent: boolean;
    hasArticles: boolean;
    hasQuizzes: boolean;
    motifsHit: string[];
  };
  assetCoverage: {
    distinctModelKeys: number;
    modelKeys: string[];
    decalKinds: string[];
    // resolvedTriple / webgpuMapped 需要 generatedBuilderAssetCatalog + raw-webgpu manifest，Phase 0 暂留 null。
    resolvedTriple: null;
    webgpuMapped: null;
  };
  riskMetrics: {
    validatorOk: boolean;
    errorCodes: string[];
    warningCodes: string[];
    exitReachable: boolean;
    /** 出口房间是否在可达集合里——比 exitReachable(=exitUnlocked) 对 builder 编译关卡更鲁棒（出口靠 room_entered 事件解锁，静态模拟不跑 events）。 */
    exitRoomReachable: boolean;
    exitInteractionReady: boolean;
    unreachablePuzzles: string[];
    copyScanViolations: CopyScanHit[];
    difficulty: { exploration: number; puzzle: number; combat: number; routeComplexity: number };
  };
}

/** 设施母题（故事圣经 §5）——命中 ≥2 个才算有叙事身份。 */
const MOTIFS = ["维护", "假家", "展柜", "记忆", "回收", "监控", "供电", "全家福", "黑诊所", "档案", "看护", "手术"];

function roomContaining(spawn: readonly number[], level: LevelDefinition): string | null {
  const rooms = level.map?.rooms ?? [];
  for (const room of rooms) {
    const [cx, , cz] = room.bounds.center;
    const [sx, , sz] = room.bounds.size;
    if (Math.abs(spawn[0] - cx) <= sx / 2 + 0.01 && Math.abs(spawn[2] - cz) <= sz / 2 + 0.01) {
      return room.id;
    }
  }
  return null;
}

function clampLevel(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function extractConfigCard(level: LevelDefinition): ConfigCard {
  const report = validateLevelConfig(level);
  const graph = explainPuzzle(level);
  const map = level.map;
  const rooms = map?.rooms ?? [];
  const doors = map?.doors ?? [];
  const keyItems = map?.keyItems ?? [];

  // 每房间归属统计。
  const puzzleRoomIds = new Set((level.puzzles ?? []).map((p) => p.roomId));
  // 战斗房间：把波次引用到的 spawnGroup 的 center/positions 落到所在房间。
  const spawnGroupById = new Map((level.spawnGroups ?? []).map((g) => [g.id, g]));
  const referencedGroupIds = new Set<string>();
  for (const wave of level.waves ?? []) {
    for (const e of wave.enemies ?? []) if (e.from) referencedGroupIds.add(e.from);
    for (const r of (wave as any).reinforcements ?? []) if (r.from) referencedGroupIds.add(r.from);
  }
  const robotRoomIds = new Set<string>();
  for (const gid of referencedGroupIds) {
    const g = spawnGroupById.get(gid);
    const at = g?.center ?? g?.positions?.[0];
    if (!at) continue;
    const rid = roomContaining(at, level);
    if (rid) robotRoomIds.add(rid);
  }
  const keyRoomIds = new Set(keyItems.map((k) => k.roomId));
  // "有内容"房：含 article / 大屏 / 带 story 的道具 / 有意义交互（检视·终端·记忆回响·开关·维修台·阅读等，
  // 这些常靠 objective_complete 锁 gate 进度，房间度数=1 但功能必需）。用于排除"真死胡同空房"。
  const storyRoomIds = new Set<string>();
  for (const a of (level.articles ?? []) as any[]) if (a.roomId) storyRoomIds.add(a.roomId);
  for (const b of (level.bigScreens ?? []) as any[]) if (b.roomId) storyRoomIds.add(b.roomId);
  for (const p of (map?.props ?? []) as any[]) if (p.story && p.roomId) storyRoomIds.add(p.roomId);
  for (const it of (map?.interactions ?? []) as any[]) {
    if (it.roomId && it.type && !["door_panel", "exit"].includes(it.type)) storyRoomIds.add(it.roomId);
  }
  const doorDegree = new Map<string, number>();
  for (const d of doors) {
    doorDegree.set(d.fromRoomId, (doorDegree.get(d.fromRoomId) ?? 0) + 1);
    doorDegree.set(d.toRoomId, (doorDegree.get(d.toRoomId) ?? 0) + 1);
  }

  const reachablePuzzles = new Set(graph.reachability.puzzles);

  // combat 聚合。
  const enemiesByArchetype: Record<string, number> = {};
  const tiers = new Set<string>();
  const rewards = new Set<string>();
  for (const wave of level.waves ?? []) {
    rewards.add(wave.reward);
    for (const e of wave.enemies ?? []) {
      enemiesByArchetype[e.archetype] = (enemiesByArchetype[e.archetype] ?? 0) + (e.count ?? 0);
      if (e.tier) tiers.add(e.tier);
    }
  }

  // 资产 modelKey 收集（player-facing 资产标识）。
  const modelKeys = new Set<string>();
  for (const p of map?.props ?? []) if (p.modelKey) modelKeys.add(p.modelKey);
  for (const d of doors) if (d.visualKey) modelKeys.add(d.visualKey);
  for (const k of keyItems) if (k.visualKey) modelKeys.add(k.visualKey);

  // 母题命中（在玩家可见文本里扫，不扫 id/key）。
  const playerText = scanPlayerFacingText(level)
    .map((h) => h.text)
    .join("\n");
  const allStory = [
    level.title,
    ...(level.articles ?? []).flatMap((a: any) => [a.title, ...(a.pages ?? []).map((pg: any) => pg.body ?? pg.text)]),
    ...(level.dialogues ?? []).flatMap((d: any) => (d.lines ?? []).map((l: any) => l.text)),
    playerText,
  ]
    .filter(Boolean)
    .join("\n");
  const motifsHit = MOTIFS.filter((m) => allStory.includes(m));

  const copyScanViolations = scanPlayerFacingText(level).filter((h) => h.word);

  const puzzleCount = (level.puzzles ?? []).length;
  const switchCount = (level.switches ?? []).length;
  const routeCount = (level.campaignRoutes ?? []).length;
  const lockTypesUsed = new Set(graph.locks.map((l) => l.lockType)).size;

  return {
    meta: {
      sourceLayer: "level",
      id: level.id,
      title: level.title,
      authoringProfile: level.authoringProfile ?? "internal",
      schemaVersions: { map: map?.schemaVersion ?? null, levelRoot: null },
    },
    roomsGraph: {
      roomCount: rooms.length,
      rooms: rooms.map((r) => ({
        id: r.id,
        label: r.label,
        mood: r.mood,
        aesthetic: r.aesthetic?.style ?? null,
        ambientPressure: r.ambientPressure ?? null,
        hasPuzzle: puzzleRoomIds.has(r.id),
        hasRobots: robotRoomIds.has(r.id),
        hasKeyItem: keyRoomIds.has(r.id),
        hasStory: storyRoomIds.has(r.id),
        doorDegree: doorDegree.get(r.id) ?? 0,
      })),
      spawnRoomId: roomContaining(level.spawnPoint, level),
      exitRoomId: graph.exitRoomId,
      adjacency: doors.map((d) => [d.fromRoomId, d.toRoomId] as [string, string]),
      criticalPathRoomIds: [...(map?.navigation.criticalPathRoomIds ?? [])],
      optionalRoomIds: [...(map?.navigation.optionalRoomIds ?? [])],
      maxBacktrackSeconds: map?.navigation.maxBacktrackSeconds ?? null,
      mobileReadableDoorCount: map?.navigation.mobileReadableDoorCount ?? null,
    },
    doorLockChain: graph.locks.map((l) => ({
      doorId: l.doorId,
      from: l.fromRoomId,
      to: l.toRoomId,
      lockType: l.lockType,
      requires: [...l.requires],
      blocksCriticalPath: l.blocksCriticalPath,
    })),
    puzzleChain: graph.puzzles.map((p) => ({
      puzzleId: p.puzzleId,
      kind: p.type,
      roomId: p.roomId,
      linkedDoorId: p.opensDoorId ?? p.unlocksDoorId ?? null,
      unlocksExit: p.unlocksExit,
      requires: [...p.requires],
      reachableFromSpawn: reachablePuzzles.has(p.puzzleId),
    })),
    routeSwitchGraph: {
      switchCount,
      campaignRouteCount: routeCount,
      choiceCount: (level.choices ?? []).length,
    },
    pickups: {
      keyItems: keyItems.map((k) => ({
        id: k.id,
        roomId: k.roomId,
        requiredForDoorIds: [...(k.requiredForDoorIds ?? [])],
      })),
      repairKitCount: (map?.pickups ?? []).filter((p) => p.type === "repairKit").length,
      coreCellCount: (map?.pickups ?? []).filter((p) => p.type === "coreCell").length,
      storyPickups: (level.pickups?.storyPickups ?? []).map((s) => s.type),
    },
    robotsCombat: {
      waveCount: (level.waves ?? []).length,
      enemiesByArchetype,
      tiers: [...tiers],
      estimatedActiveEnemies: report.budget.estimatedActiveEnemies,
      bossPhaseCount: (level.bossPhases ?? []).length,
      rewards: [...rewards],
      combatRoomIds: [...robotRoomIds],
    },
    visualStory: {
      lightingPreset: map?.presentation?.lightingPreset ?? map?.presentation?.overrides?.lightingPreset ?? null,
      roomsWithMaterials: rooms.filter((r) => r.floorMaterialKey || r.wallMaterialKey).length,
      storyPresent: Boolean((level.articles ?? []).length || (level.dialogues ?? []).length),
      hasArticles: Boolean((level.articles ?? []).length),
      hasQuizzes: Boolean((level.quizzes ?? []).length),
      motifsHit,
    },
    assetCoverage: {
      distinctModelKeys: modelKeys.size,
      modelKeys: [...modelKeys].sort(),
      decalKinds: [...new Set((map?.decals ?? []).map((d) => d.kind))],
      resolvedTriple: null,
      webgpuMapped: null,
    },
    riskMetrics: {
      validatorOk: report.ok,
      errorCodes: report.errors.map((e) => e.code),
      warningCodes: report.warnings.map((w) => w.code),
      exitReachable: graph.reachability.exitUnlocked,
      exitRoomReachable: graph.exitRoomId ? graph.reachability.rooms.includes(graph.exitRoomId) : false,
      exitInteractionReady: graph.reachability.exitInteractionReady,
      unreachablePuzzles: graph.puzzles.filter((p) => !reachablePuzzles.has(p.puzzleId)).map((p) => p.puzzleId),
      copyScanViolations,
      difficulty: {
        exploration: clampLevel(rooms.length <= 3 ? 0 : rooms.length <= 5 ? 1 : rooms.length <= 7 ? 2 : 3, 0, 3),
        puzzle: clampLevel(puzzleCount === 0 ? 0 : puzzleCount === 1 ? 1 : puzzleCount === 2 ? 2 : 3, 0, 3),
        combat: clampLevel(
          Math.round(report.budget.estimatedActiveEnemies / 4) + ((level.bossPhases ?? []).length ? 1 : 0),
          0,
          3,
        ),
        // 注意：campaignRoutes 是全战役共享常量(=3)，不计入单关复杂度；
        // 真正的路线复杂度来自 route 开关 + 分支选择 + 锁链分叉。
        routeComplexity: clampLevel(
          switchCount + ((level.choices ?? []).length ? 1 : 0) + Math.max(0, lockTypesUsed - 1),
          0,
          3,
        ),
      },
    },
  };
}

// ── CLI ──
const invokedDirectly = process.argv[1]?.endsWith("extractConfigCard.ts");
if (invokedDirectly) {
  const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
  const wantId = process.argv[2];
  const level = wantId
    ? humanProtocolBasePack.levels.find((l) => l.id === wantId)
    : humanProtocolBasePack.levels[0];
  if (!level) {
    console.error(`level not found: ${wantId}. Available: ${humanProtocolBasePack.levels.map((l) => l.id).join(", ")}`);
    process.exit(1);
  }
  console.log(JSON.stringify(extractConfigCard(level), null, 2));
}
