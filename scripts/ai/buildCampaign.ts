/**
 * 🏗️ 用密室编译器重做 L1-5（零模型，构造即合法）。
 *
 * 每关 = 一个手调 BuilderProject → compileBuilderProjectToLevel → validate → 体检。
 * 难度递增（谜题数/房间/战斗 L1→L5 逐级↑），主题化资产，视觉丰富。
 * 编译器不产 decal → L1 的人体/手/脊柱 reference decal **编译后合并**回 map.decals（你的要求：图要留）。
 * L3 保留 工具/影像/身体 三展厅，但用三种不同谜题做得更好玩。
 *
 * Run:  scripts/ai/run.sh buildCampaign.ts            # 全 5 关编译+体检汇总
 *       scripts/ai/run.sh buildCampaign.ts --emit     # 另写 data/ai/campaign/level0N.builder.json + .level.json
 *       scripts/ai/run.sh buildCampaign.ts --emit-ts  # 另写 /build「官卡」下拉 devRemakeProjects.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { BuilderProject, BuilderPuzzleKind, BuilderRoomStyle, BuilderPuzzleInstance } from "../../src/build/BuilderTypes";
import { compileBuilderProjectToLevel } from "../../src/build/compileBuilderProjectToLevel";
import type { LevelDefinition } from "../../src/game/config/schema/levelConfig";
import { healthReport } from "./healthCheck";

interface DecalDef { id: string; roomId: string; kind: string; position: [number, number, number]; size: [number, number]; opacity: number; label: string; tags: string[] }
interface RoomSpec { name: string; style: BuilderRoomStyle; depth?: number; width?: number }
interface LevelSpec {
  id: string; title: string;
  rooms: RoomSpec[];                 // [0]=spawn …中间=谜题房… [last]=exit
  puzzleKinds: BuilderPuzzleKind[];  // 长度 = 谜题数（= rooms.length-2），各不同
  surviveDoorIndexes?: number[];     // door index j: clear robots in fromRoom before opening
  props: string[];                   // 主题 modelKey 池
  heroProps?: { room: number; key: string; id?: string; position?: [number, number]; rotationY?: number; scale?: number; story?: true }[]; // 指定房放指定 hero 资产（如 L1 维护件）
  puzzleHosts?: { puzzleId: string; propId: string; label: string; radius?: number }[];
  lighting: NonNullable<BuilderProject["lighting"]>;
  storyTemplate: string;
  storyClue: { title: string; clue: string; hint: string };
  robots: { room: number; archetype: BuilderProject["robots"][number]["archetype"]; count: number; tier?: any }[];
  decals?: (mainRoomId: string) => DecalDef[]; // 编译后合并（L1）
  pickups?: { room: number; kind: "key_item" | "repairKit" | "coreCell" }[];
}

const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const shuffle = <T,>(arr: T[], r: () => number) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ARCHIVE_TARGETS = [128, 256, 512, 1024];

function buildProject(spec: LevelSpec, seed: number): BuilderProject {
  const r = rng(seed);
  const W = 12;
  const rooms: BuilderProject["rooms"] = [];
  let topZ = 0;
  spec.rooms.forEach((rs, i) => {
    const depth = rs.depth ?? (i === spec.rooms.length - 1 ? 6 : 9);
    const width = rs.width ?? W;
    const cz = topZ - depth / 2;
    rooms.push({ id: `${spec.id}_r${i}`, label: rs.name, style: rs.style, center: [0, cz], size: [width, depth] });
    topZ -= depth;
  });

  const doors: BuilderProject["doors"] = [];
  const puzzles: BuilderPuzzleInstance[] = [];
  const families = ["industrial", "clinic", "reclamation", "elevator", "residential"] as const;
  const surviveDoorIndexes = new Set(spec.surviveDoorIndexes ?? []);
  let puzzleIndex = 0;
  for (let j = 0; j < rooms.length - 1; j++) {
    const from = rooms[j], to = rooms[j + 1];
    if (j === 0) { doors.push({ id: `${spec.id}_d${j}`, fromRoomId: from.id, toRoomId: to.id, lockType: "none" }); continue; }
    if (surviveDoorIndexes.has(j)) {
      doors.push({ id: `${spec.id}_d${j}`, fromRoomId: from.id, toRoomId: to.id, lockType: "survive_wave", doorFamily: families[(j - 1) % families.length] });
      continue;
    }
    const kind = spec.puzzleKinds[puzzleIndex++];
    doors.push({ id: `${spec.id}_d${j}`, fromRoomId: from.id, toRoomId: to.id, lockType: "puzzle_complete", puzzleKind: kind, puzzleRoomId: from.id, doorFamily: families[(j - 1) % families.length] });
    const pz: BuilderPuzzleInstance = { id: `${spec.id}_pz${j}`, kind, linkedDoorId: `${spec.id}_d${j}`, roomId: from.id, position: [0, from.center[1]], rotationY: 0 };
    if (kind === "archive_merge") pz.archiveTargetValue = ARCHIVE_TARGETS[Math.floor(r() * ARCHIVE_TARGETS.length)];
    if (kind === "color_sequence") {
      const cz = from.center[1];
      pz.components = [
        { id: `${pz.id}_o0`, role: "orb_cyan", roomId: from.id, position: [-3.5, cz + 1.6] },
        { id: `${pz.id}_o1`, role: "orb_red", roomId: from.id, position: [3.5, cz + 1.6] },
        { id: `${pz.id}_o2`, role: "orb_yellow", roomId: from.id, position: [0, cz + 2.6] },
      ];
    }
    puzzles.push(pz);
  }

  // 道具：每间 3 件（避开中心 console，四周布置）+ hero 资产。
  const props: BuilderProject["props"] = [];
  let pn = 0;
  rooms.forEach((room, i) => {
    const isExit = i === rooms.length - 1;
    if (isExit) return;
    if (!spec.props.length) return;
    const pool = shuffle(spec.props, r);
    const spots: [number, number][] = [[-W * 0.34, room.size[1] * 0.32], [W * 0.34, -room.size[1] * 0.32], [-W * 0.34, -room.size[1] * 0.3]];
    spots.forEach((off, k) => props.push({ id: `${spec.id}_p${pn++}`, modelKey: pool[k % pool.length], roomId: room.id, position: [room.center[0] + off[0], room.center[1] + off[1]], rotationY: (k % 2 ? -1 : 1) * Math.PI / 2, scale: 1 }));
  });
  for (const hp of spec.heroProps ?? []) {
    const room = rooms[hp.room]; if (!room) continue;
    props.push({
      id: hp.id ?? `${spec.id}_hp${pn++}`,
      modelKey: hp.key,
      roomId: room.id,
      position: hp.position ?? [room.center[0] + (r() - 0.5) * 4, room.center[1] + (r() - 0.5) * 4],
      rotationY: hp.rotationY ?? 0,
      scale: hp.scale ?? 1,
      ...(hp.story ? { story: { title: spec.storyClue.title, clue: spec.storyClue.clue, hint: spec.storyClue.hint } } : {}),
    });
  }
  // 故事线索优先挂到显式 story hero prop；否则回落到第一个主题房 prop。
  const storyProp = props.find((p) => p.roomId === rooms[1].id && p.story) ?? props.find((p) => p.roomId === rooms[1].id);
  if (storyProp) storyProp.story = { title: spec.storyClue.title, clue: spec.storyClue.clue, hint: spec.storyClue.hint };

  for (const host of spec.puzzleHosts ?? []) {
    const puzzle = puzzles.find((candidate) => candidate.id === host.puzzleId);
    const prop = props.find((candidate) => candidate.id === host.propId);
    if (!puzzle || !prop) continue;
    puzzle.roomId = prop.roomId;
    puzzle.position = [prop.position[0], prop.position[1]];
    puzzle.sourceInteraction = {
      type: "terminal",
      radius: host.radius ?? 1.7,
      visualKey: "none",
      materialKey: "terminal_cyan",
      label: host.label,
      hostPropId: prop.id,
    };
  }

  const robots: BuilderProject["robots"] = spec.robots.map((rb, i) => ({ id: `${spec.id}_rb${i}`, roomId: rooms[rb.room]?.id ?? rooms[1].id, archetype: rb.archetype, count: rb.count, ...(rb.tier ? { tier: rb.tier } : {}) }));
  const pickups: BuilderProject["pickups"] = (spec.pickups ?? []).map((pk, i) => ({ id: `${spec.id}_pk${i}`, kind: pk.kind, roomId: rooms[pk.room]?.id ?? rooms[1].id, position: [rooms[pk.room]?.center[0] - 2 ?? -2, (rooms[pk.room]?.center[1] ?? 0) - 2] }));

  return {
    schemaVersion: "hp.builder.v1", projectId: spec.id, title: spec.title,
    rooms, doors, props, puzzles, robots, pickups,
    story: { templateId: spec.storyTemplate, victoryLine: spec.storyClue.clue, transitionLine: "电梯门合拢，登记灯熄灭。" },
    exitRoomId: rooms[rooms.length - 1].id, lighting: spec.lighting,
  };
}

/** 编译后把 decal 合并进 map.decals（编译器不产 decal）。 */
function mergeDecals(level: LevelDefinition, project: BuilderProject, spec: LevelSpec): LevelDefinition {
  if (!spec.decals || !level.map) return level;
  const mainRoomId = project.rooms[0].id;
  return { ...level, map: { ...level.map, decals: spec.decals(mainRoomId) as any } };
}

// ── 5 关定义（难度递增）──
const MAINT = ["room_rm_maint_broken_cradle", "room_rm_maint_gantry_hoist", "room_rm_maint_tool_wall", "room_fuse_box", "room_crate_stack", "room_locker_low"];
const MUSEUM = ["room_museum_archive_column", "room_museum_wall_label_panel", "room_museum_low_barrier", "room_museum_glass_vitrine_specimen"];
const CLINIC = ["room_table_utility", "room_locker_low", "room_museum_display_case_tool", "room_museum_wall_label_panel"];
const CORE = ["room_museum_archive_column", "room_crate_stack", "room_museum_display_case_tool", "room_museum_low_barrier"];

const SPECS: LevelSpec[] = [
  { // L1 维修舱：保留维护仓+decal，2 谜题（原 1，多加 1），低战斗
    id: "rb_l1", title: "维修舱·重制", storyTemplate: "maintenance_incident",
    rooms: [{ name: "维修主舱", style: "maintenance", width: 14, depth: 10 }, { name: "配电壁龛", style: "maintenance" }, { name: "工具间", style: "hazard" }, { name: "检修电梯", style: "exit" }],
    puzzleKinds: ["circuit_grid", "valve_matrix"],
    props: MAINT, heroProps: [{ room: 0, key: "room_rm_maint_weapon_cradle" }, { room: 0, key: "room_rm_maint_cable_spine" }, { room: 0, key: "room_rm_maint_coolant_drums" }, { room: 1, key: "room_rm_maint_battery_rack" }],
    lighting: { ambient: 0.5, keyColor: "#6fe3c2", keyIntensity: 0.85, fog: 0.4, bloom: 0.5, shadow: 0.55 },
    storyClue: { title: "检修工单", clue: "档案残缺：有一段记录被涂黑了。", hint: "翻到背面。" },
    robots: [{ room: 2, archetype: "repair_drone", count: 1 }],
    pickups: [{ room: 1, kind: "repairKit" }],
    // 主舱 center[0,-5] size[14,10] → 左墙 x≈-6.8、眼高 y≈1.8、房内 z（与旧关同样三张参考图）。
    decals: (rid) => [
      { id: "rb_l1_decal_body", roomId: rid, kind: "human_body_reference", position: [-6.8, 1.78, -3.0], size: [0.82, 1.22], opacity: 0.84, label: "人体比例参考", tags: ["remake", "level01", "wall_reference"] },
      { id: "rb_l1_decal_hand", roomId: rid, kind: "human_hand_reference", position: [-6.8, 1.86, -4.3], size: [0.72, 1.06], opacity: 0.84, label: "手部资产参考", tags: ["remake", "level01", "wall_reference"] },
      { id: "rb_l1_decal_spine", roomId: rid, kind: "human_spine_reference", position: [-6.8, 1.74, -5.6], size: [0.68, 1.0], opacity: 0.84, label: "脊柱映射参考", tags: ["remake", "level01", "wall_reference"] },
    ],
  },
  { // L2 居住模拟间：3 谜题，中等
    id: "rb_l2", title: "居住模拟间·重制", storyTemplate: "false_family",
    rooms: [{ name: "恢复前厅", style: "sterile", depth: 8 }, { name: "起居室", style: "residential" }, { name: "照护间", style: "residential" }, { name: "灯控间", style: "hazard" }, { name: "撤离电梯", style: "exit" }],
    surviveDoorIndexes: [1],
    puzzleKinds: ["circuit_grid", "color_sequence"],
    props: [], lighting: { ambient: 0.58, keyColor: "#ffd9a8", keyIntensity: 0.9, fog: 0.32, bloom: 0.48, shadow: 0.5 },
    storyClue: { title: "住户登记", clue: "没有脸的照片：这里从来没有人住过。", hint: "再看那张全家福。" },
    robots: [{ room: 2, archetype: "custodian_elite", count: 1 }, { room: 1, archetype: "repair_drone", count: 1 }],
    pickups: [{ room: 1, kind: "repairKit" }],
  },
  { // L3 人类博物馆：工具/影像/身体 三展厅，4 谜题，更好玩
    id: "rb_l3", title: "人类博物馆·重制", storyTemplate: "museum_archive",
    rooms: [{ name: "展厅入口", style: "sterile", depth: 8 }, { name: "工具展厅", style: "museum" }, { name: "影像展厅", style: "museum" }, { name: "身体展厅", style: "museum" }, { name: "中央档案", style: "core" }, { name: "撤离电梯", style: "exit" }],
    puzzleKinds: ["circuit_grid", "surveillance_match", "color_sequence", "archive_merge"],
    props: MUSEUM,
    heroProps: [
      { room: 1, key: "room_museum_last_human_tool_vitrine", id: "rb_l3_tool_last_human_tool_vitrine", position: [0, -14.95], rotationY: 0.04, story: true },
      { room: 2, key: "room_museum_voice_archive_case", id: "rb_l3_voice_archive_case_asset", position: [0, -23.0], rotationY: -0.08 },
      { room: 3, key: "room_museum_skeleton_vitrine", id: "rb_l3_body_skeleton_vitrine_asset", position: [-2.8, -30.85], rotationY: -0.08 },
    ],
    puzzleHosts: [
      { puzzleId: "rb_l3_pz1", propId: "rb_l3_tool_last_human_tool_vitrine", label: "工具档案校准", radius: 1.9 },
    ],
    lighting: { ambient: 0.56, keyColor: "#d6ebe8", keyIntensity: 0.98, fog: 0.34, bloom: 0.52, shadow: 0.5 },
    storyClue: { title: "展柜记录", clue: "展柜记录：最后人类不是姓名，是协议。", hint: "再核对一次相框。" },
    robots: [{ room: 3, archetype: "clamp_bot", count: 2 }, { room: 4, archetype: "custodian_elite", count: 1, tier: "elite" }],
    pickups: [{ room: 2, kind: "coreCell" }],
  },
  { // L4 记忆诊所：4 谜题，难 + 更多战斗
    id: "rb_l4", title: "记忆诊所·重制", storyTemplate: "memory_clinic",
    rooms: [{ name: "候诊间", style: "sterile", depth: 8 }, { name: "童年疗椅", style: "sterile" }, { name: "救援疗椅", style: "sterile" }, { name: "躯体台", style: "hazard" }, { name: "治疗剧场", style: "core" }, { name: "出院电梯", style: "exit" }],
    puzzleKinds: ["valve_matrix", "circuit_grid", "surveillance_match", "color_sequence"],
    props: CLINIC, lighting: { ambient: 0.6, keyColor: "#cfe7ff", keyIntensity: 0.92, fog: 0.3, bloom: 0.45, shadow: 0.5 },
    storyClue: { title: "疗程记录", clue: "治疗记录：我是人，是一层可以被维护的记忆。", hint: "看护台还亮着。" },
    robots: [{ room: 3, archetype: "clamp_bot", count: 2 }, { room: 4, archetype: "custodian_elite", count: 1, tier: "elite" }, { room: 2, archetype: "repair_drone", count: 2 }],
    pickups: [{ room: 1, kind: "repairKit" }, { room: 3, kind: "coreCell" }],
  },
  { // L5 回收核心：5 谜题，最难 + boss
    id: "rb_l5", title: "回收核心·重制", storyTemplate: "reclamation_core",
    rooms: [{ name: "核心入口", style: "core", depth: 8 }, { name: "北制动间", style: "core" }, { name: "东供能间", style: "hazard" }, { name: "西回收间", style: "core" }, { name: "内场平台", style: "core" }, { name: "身份档案", style: "museum" }, { name: "撤离竖井", style: "exit" }],
    puzzleKinds: ["circuit_grid", "valve_matrix", "surveillance_match", "archive_merge", "color_sequence"],
    props: CORE, lighting: { ambient: 0.5, keyColor: "#ff8f6b", keyIntensity: 0.98, fog: 0.46, bloom: 0.58, shadow: 0.5 },
    storyClue: { title: "回收单", clue: "身份档案：H-0 仍在移动。", hint: "核对身份片。" },
    robots: [{ room: 2, archetype: "shield_tech", count: 1, tier: "leader" }, { room: 4, archetype: "custodian_elite", count: 2, tier: "elite" }, { room: 1, archetype: "clamp_bot", count: 2 }, { room: 3, archetype: "repair_drone", count: 2 }],
    pickups: [{ room: 1, kind: "coreCell" }, { room: 3, kind: "repairKit" }],
  },
];

export function buildCampaign() {
  return SPECS.map((spec, i) => {
    const project = buildProject(spec, 100 + i);
    const compiled = compileBuilderProjectToLevel(project);
    let level = compiled.level;
    if (level) level = mergeDecals(level, project, spec);
    const health = level ? healthReport(level) : null;
    return { spec, project, level, issues: compiled.issues, health };
  });
}

// ── CLI ──
if (process.argv[1]?.endsWith("buildCampaign.ts")) {
  const results = buildCampaign();
  const emit = process.argv.includes("--emit");
  if (emit) mkdirSync("data/ai/campaign", { recursive: true });
  console.log("关  | 编译 | 校验 | 可玩 | 分  | 难度(探/解/战/线) | 谜题 | decal | 标题");
  console.log("-".repeat(96));
  for (const res of results) {
    const h = res.health;
    const d = h?.difficulty;
    const decals = (res.level?.map as any)?.decals?.length ?? 0;
    console.log(
      `${res.spec.id} | ${res.issues.length === 0 ? "✓" : "✗" + res.issues.length} | ${h?.playable ? "✓" : "—"}   | ${h?.playable ? "✓" : "✗"}   | ${String(h?.score ?? "-").padStart(3)} | ${d ? `${d.exploration} ${d.puzzle} ${d.combat} ${d.routeComplexity}`.padEnd(16) : "-".padEnd(16)} | ${String(h?.puzzleStructure.count ?? "-")}    | ${decals}     | ${res.spec.title}`,
    );
    for (const iss of res.issues) console.log(`     ✗ ${iss.path}: ${iss.message}`);
    if (h) for (const f of h.findings.filter((x) => x.severity !== "info")) console.log(`     ${f.severity === "blocker" ? "✗" : "⚠"} ${f.tag}`);
    if (emit && res.level) {
      writeFileSync(`data/ai/campaign/${res.spec.id}.builder.json`, JSON.stringify(res.project, null, 2));
      writeFileSync(`data/ai/campaign/${res.spec.id}.level.json`, JSON.stringify(res.level, null, 2));
    }
  }
  const allOk = results.every((r) => r.issues.length === 0 && r.health?.playable);
  console.log("-".repeat(96));
  console.log(allOk ? "✅ 全 5 关：编译0错 + 可玩" : "❌ 有关卡未过，见上");
  if (emit) console.log("已写出 data/ai/campaign/rb_l{1-5}.{builder,level}.json");

  // 生成 app 可导入的 dev 数据模块（供 /build「官卡」下拉的「重制关」分组动态 import）。
  if (process.argv.includes("--emit-ts")) {
    const entries = results.filter((r) => r.level).map((r) => `  { id: ${JSON.stringify(r.spec.id)}, label: ${JSON.stringify(r.spec.title)}, project: ${JSON.stringify(r.project)} },`);
    const content =
      `// AUTO-GENERATED by scripts/ai/buildCampaign.ts --emit-ts — dev-only 重制 L1-5（供 /build「官卡 ▾」下拉）。请勿手改；改了跑 buildCampaign 重生成。\n` +
      `import type { BuilderProject } from "./BuilderTypes";\n\n` +
      `export const devRemakeProjects = ([\n${entries.join("\n")}\n] as unknown) as { id: string; label: string; project: BuilderProject }[];\n`;
    writeFileSync("src/build/devRemakeProjects.ts", content);
    console.log("已写出 src/build/devRemakeProjects.ts（dev 重制关数据，BuildPage 动态 import）");
  }
}
