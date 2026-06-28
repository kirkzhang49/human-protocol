/**
 * 🎲 随机密室生成器 API（Phase 1，零模型，构造即合法）。
 *
 * 给定 seed + 参数 → 产出一个**保证可玩**的 BuilderProject：种子驱动选主题/谜题种类/房间/道具，
 * 沿"线性脊柱"几何布局（每段门由一座不同谜题解锁，已被 demo 验证合法），再 compile+validate+体检，
 * 不够好就用 repairPlan 兜底。纯函数，无模型。这是给玩家"随机来一间"的引擎。
 *
 * API:  generateRoom({ seed, puzzleCount?, arc? }) → { project, level, health }
 * Run:  scripts/ai/run.sh generateRoom.ts [seed] [puzzleCount] [arc]   # 生成并体检
 *       scripts/ai/run.sh generateRoom.ts 7 4 museum --emit            # 写 data/ai/generated-<seed>.builder.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { BuilderProject, BuilderPuzzleKind, BuilderPuzzleInstance } from "../../src/build/BuilderTypes";
import { compileBuilderProjectToLevel } from "../../src/build/compileBuilderProjectToLevel";
import type { LevelDefinition } from "../../src/game/config/schema/levelConfig";
import { healthReport, type HealthReport } from "./healthCheck";
import { planRepairs, applyRepairs } from "./repairPlan";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Theme {
  arc: string;
  spawnStyle: BuilderProject["rooms"][number]["style"];
  bodyStyle: BuilderProject["rooms"][number]["style"];
  storyTemplate: string;
  lighting: NonNullable<BuilderProject["lighting"]>;
  props: string[];
  roomNames: string[];
  title: string;
  doorFamily: NonNullable<BuilderProject["doors"][number]["doorFamily"]>;
}

const THEMES: Record<string, Theme> = {
  museum: { arc: "museum", spawnStyle: "sterile", bodyStyle: "museum", storyTemplate: "museum_archive", doorFamily: "industrial",
    lighting: { ambient: 0.55, keyColor: "#d6ebe8", keyIntensity: 0.95, fog: 0.35, bloom: 0.5, shadow: 0.5 },
    props: ["room_museum_display_case_tool", "room_museum_archive_column", "room_museum_wall_label_panel", "room_museum_low_barrier"],
    roomNames: ["展厅入口", "工具展柜", "影像展区", "身份展台", "中央档案", "标本回廊"], title: "人类博物馆·夜场" },
  clinic: { arc: "clinic", spawnStyle: "sterile", bodyStyle: "sterile", storyTemplate: "memory_clinic", doorFamily: "clinic",
    lighting: { ambient: 0.6, keyColor: "#cfe7ff", keyIntensity: 0.9, fog: 0.3, bloom: 0.45, shadow: 0.5 },
    props: ["room_table_utility", "room_locker_low", "room_terminal_wall", "room_museum_wall_label_panel"],
    roomNames: ["候诊间", "童年疗椅", "救援疗椅", "躯体台", "治疗剧场", "看护回廊"], title: "记忆诊所·夜班" },
  maintenance: { arc: "maintenance", spawnStyle: "maintenance", bodyStyle: "hazard", storyTemplate: "maintenance_incident", doorFamily: "industrial",
    lighting: { ambient: 0.5, keyColor: "#6fe3c2", keyIntensity: 0.85, fog: 0.4, bloom: 0.5, shadow: 0.55 },
    props: ["room_maintenance_supply_cabinet", "room_fuse_box", "room_crate_stack", "room_locker_low"],
    roomNames: ["维修主舱", "配电壁龛", "工具间", "管线井", "检修平台", "废件道"], title: "维修舱·检修夜" },
  reclamation: { arc: "reclamation", spawnStyle: "core", bodyStyle: "core", storyTemplate: "reclamation_core", doorFamily: "reclamation",
    lighting: { ambient: 0.5, keyColor: "#ff8f6b", keyIntensity: 0.95, fog: 0.45, bloom: 0.55, shadow: 0.5 },
    props: ["room_museum_archive_column", "room_crate_stack", "room_terminal_wall", "room_museum_low_barrier"],
    roomNames: ["核心入口", "北制动间", "东供能间", "西回收间", "内场平台", "身份档案"], title: "回收核心·夜循环" },
  surveillance: { arc: "surveillance", spawnStyle: "sterile", bodyStyle: "hazard", storyTemplate: "surveillance_trial", doorFamily: "clinic",
    lighting: { ambient: 0.52, keyColor: "#bfe9ff", keyIntensity: 0.9, fog: 0.38, bloom: 0.5, shadow: 0.5 },
    props: ["room_terminal_wall", "room_museum_wall_label_panel", "room_fuse_box", "room_locker_low"],
    roomNames: ["接收台", "监控走廊", "比对间", "档案墙", "中控台", "回放室"], title: "监控档案区·夜审" },
};
const ARCS = Object.keys(THEMES);

const PUZZLE_KINDS: BuilderPuzzleKind[] = ["circuit_grid", "surveillance_match", "archive_merge", "valve_matrix", "gallery_reading", "color_sequence"];
const ARCHIVE_TARGETS = [128, 256, 512, 1024];

export interface GenerateParams { seed: number; puzzleCount?: number; arc?: string }
export interface GeneratedRoom { project: BuilderProject; level: LevelDefinition; health: HealthReport; seed: number; repaired: boolean }

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function buildProject(p: GenerateParams): BuilderProject {
  const rng = mulberry32(p.seed);
  const puzzleCount = Math.max(3, Math.min(5, p.puzzleCount ?? 3 + Math.floor(rng() * 3)));
  const arc = p.arc && THEMES[p.arc] ? p.arc : ARCS[Math.floor(rng() * ARCS.length)];
  const theme = THEMES[arc];
  const roomCount = puzzleCount + 2; // spawn + puzzleCount + exit

  // 竖直脊柱：每间 10×8，相邻满边贴合（z 递减）。
  const W = 10, D = 8, EXIT_D = 6;
  const rooms: BuilderProject["rooms"] = [];
  let topZ = 0;
  for (let i = 0; i < roomCount; i++) {
    const isSpawn = i === 0, isExit = i === roomCount - 1;
    const depth = isExit ? EXIT_D : D;
    const centerZ = topZ - depth / 2;
    rooms.push({
      id: `r${i}`,
      label: isExit ? "撤离电梯" : theme.roomNames[Math.min(i, theme.roomNames.length - 1)],
      style: isSpawn ? theme.spawnStyle : isExit ? "exit" : theme.bodyStyle,
      center: [0, centerZ], size: [W, depth],
    });
    topZ -= depth;
  }

  const kinds = shuffled(PUZZLE_KINDS, rng).slice(0, puzzleCount); // 不同种类 → 变化感；color_sequence 至多一座
  const doors: BuilderProject["doors"] = [];
  const puzzles: BuilderPuzzleInstance[] = [];
  for (let j = 0; j < roomCount - 1; j++) {
    const from = rooms[j], to = rooms[j + 1];
    if (j === 0) { doors.push({ id: `d${j}`, fromRoomId: from.id, toRoomId: to.id, lockType: "none" }); continue; }
    const kind = kinds[j - 1];
    doors.push({ id: `d${j}`, fromRoomId: from.id, toRoomId: to.id, lockType: "puzzle_complete", puzzleKind: kind, puzzleRoomId: from.id, doorFamily: theme.doorFamily });
    const pz: BuilderPuzzleInstance = { id: `pz${j}`, kind, linkedDoorId: `d${j}`, roomId: from.id, position: [0, from.center[1]], rotationY: 0 };
    if (kind === "archive_merge") pz.archiveTargetValue = ARCHIVE_TARGETS[Math.floor(rng() * ARCHIVE_TARGETS.length)];
    if (kind === "color_sequence") {
      const cz = from.center[1];
      pz.components = [
        { id: `${pz.id}_o0`, role: "orb_cyan", roomId: from.id, position: [-3, cz + 1.4] },
        { id: `${pz.id}_o1`, role: "orb_red", roomId: from.id, position: [3, cz + 1.4] },
        { id: `${pz.id}_o2`, role: "orb_yellow", roomId: from.id, position: [0, cz + 2.2] },
      ];
    }
    puzzles.push(pz);
  }

  // 道具：每间 2 件（避开中心 console，放四角偏移），出口放一盏灯。
  const props: BuilderProject["props"] = [];
  let pn = 0;
  for (const room of rooms) {
    const isExit = room.id === `r${roomCount - 1}`;
    if (isExit) { props.push({ id: `p${pn++}`, modelKey: "light_residential_lamp_warm", roomId: room.id, position: [room.center[0] + 2, room.center[1]], rotationY: 0, scale: 1 }); continue; }
    const pool = shuffled(theme.props, rng);
    props.push({ id: `p${pn++}`, modelKey: pool[0], roomId: room.id, position: [room.center[0] - W * 0.32, room.center[1] + room.size[1] * 0.3], rotationY: Math.PI / 2, scale: 1 });
    props.push({ id: `p${pn++}`, modelKey: pool[1 % pool.length], roomId: room.id, position: [room.center[0] + W * 0.32, room.center[1] - room.size[1] * 0.3], rotationY: -Math.PI / 2, scale: 1 });
  }
  // 给一个 body 房 prop 挂故事线索（避免 missing_story）。
  const storyProp = props.find((p) => p.roomId === rooms[1].id);
  if (storyProp) storyProp.story = { title: "登记残页", clue: "时间戳早于出生。", hint: "再核对一次。" };

  // 轻战斗：中段 1-2 个机器人。
  const robots: BuilderProject["robots"] = [
    { id: "rb0", roomId: rooms[1].id, archetype: "repair_drone", count: 1 },
  ];
  if (puzzleCount >= 4) robots.push({ id: "rb1", roomId: rooms[Math.floor(roomCount / 2)].id, archetype: "clamp_bot", count: 1 + Math.floor(rng() * 2) });

  return {
    schemaVersion: "hp.builder.v1",
    projectId: `gen_${p.seed}`,
    title: `${theme.title} #${p.seed}`,
    rooms, doors, props, puzzles, robots,
    pickups: [{ id: "kit0", kind: "repairKit", roomId: rooms[1].id, position: [rooms[1].center[0] - 2, rooms[1].center[1] - 2] }],
    story: { templateId: theme.storyTemplate, victoryLine: "夜场记录：该编号仍在登记表上移动。", transitionLine: "电梯门合拢，登记灯熄灭。" },
    exitRoomId: rooms[roomCount - 1].id,
    lighting: theme.lighting,
  };
}

export function generateRoom(p: GenerateParams): GeneratedRoom {
  let project = buildProject(p);
  let compiled = compileBuilderProjectToLevel(project);
  if (!compiled.level) throw new Error(`生成器产出非法工程(seed=${p.seed}): ${compiled.issues.map((i) => i.message).join("; ")}`);
  let health = healthReport(compiled.level);
  let repaired = false;

  // 自愈：若有可修问题，跑确定性修复器兜底。
  const suggestions = planRepairs(project, health);
  if (suggestions.length) {
    const run = applyRepairs(project, suggestions);
    if (!("error" in run) && run.applied.length) { project = run.repaired; repaired = true; compiled = compileBuilderProjectToLevel(project); health = run.after; }
  }
  return { project, level: compiled.level!, health, seed: p.seed, repaired };
}

// ── CLI ──
if (process.argv[1]?.endsWith("generateRoom.ts")) {
  const args = process.argv.slice(2);
  const batchIdx = args.indexOf("--batch");
  if (batchIdx >= 0) {
    const n = Number(args[batchIdx + 1] ?? 30);
    let ok = 0; const fails: string[] = []; const scores: number[] = [];
    for (let s = 1; s <= n; s++) {
      try {
        const g = generateRoom({ seed: s * 13 + 1 });
        scores.push(g.health.score);
        const clean = g.health.playable && g.health.findings.every((f) => f.severity !== "blocker");
        if (clean) ok++; else fails.push(`seed ${s * 13 + 1}: ${g.health.findings.map((f) => f.tag).join(",")}`);
      } catch (e) { fails.push(`seed ${s * 13 + 1}: ERR ${(e as Error).message.slice(0, 70)}`); }
    }
    console.log(`随机生成批量验证：可玩 ${ok}/${n}  平均分 ${Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length))}`);
    if (fails.length) { console.log("未过：\n  " + fails.join("\n  ")); process.exit(1); }
    else console.log("✓ 全部可玩、无 BLOCKER");
    process.exit(0);
  }
  const pos = args.filter((a) => !a.startsWith("--"));
  const seed = pos[0] ? Number(pos[0]) : Math.floor(Date.now() % 100000);
  const puzzleCount = pos[1] ? Number(pos[1]) : undefined;
  const arc = pos[2];
  const g = generateRoom({ seed, puzzleCount, arc });
  const h = g.health;
  console.log(`\n🎲 生成「${g.project.title}」 seed=${g.seed}${g.repaired ? "（已自愈）" : ""}`);
  console.log(`   裁决: ${h.playable ? "✓ 可玩" : "✗ 被阻断"}   分: ${h.score}/100   arc: ${h.arc}`);
  console.log(`   房间 ${g.project.rooms.length}  谜题 ${h.puzzleStructure.count}(${h.puzzleStructure.kinds.join("/")})  链深 ${h.puzzleStructure.chainDepth}`);
  console.log(`   难度 探索${h.difficulty.exploration} 解谜${h.difficulty.puzzle} 战斗${h.difficulty.combat} 路线${h.difficulty.routeComplexity}`);
  for (const f of h.findings) console.log(`   ${f.severity === "blocker" ? "✗" : f.severity === "warning" ? "⚠" : "·"} ${f.tag}`);
  if (args.includes("--emit")) {
    mkdirSync("data/ai", { recursive: true });
    const out = `data/ai/generated-${g.seed}.builder.json`;
    writeFileSync(out, JSON.stringify(g.project, null, 2));
    console.log(`\n已写出 → ${out}（可导入 /build）`);
  }
}
