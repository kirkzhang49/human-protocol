/**
 * 示例：手写一个 4-谜题密室「夜班档案室」，走完整确定性管线证明它可玩。
 *
 *   BuilderProject  → compileBuilderProjectToLevel → validateLevelConfig
 *                   → extractConfigCard → copy-scan
 *
 * 线性逃脱：A出生 → B大厅 → C供能(circuit_grid) → D监控(surveillance_match)
 *           → E档案(archive_merge) → F电梯(color_sequence)。每道门由一座谜题解锁。
 * 这就是未来 AI patch planner 产出 patch 后必须跑通的那条管线。零 runtime 改动。
 *
 * Run:
 *   NODE_OPTIONS="--import ./scripts/ai/lib/asset-register.mjs" \
 *   tsx --tsconfig tsconfig.app.json \
 *   scripts/ai/demoEscapeRoom.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import type { BuilderProject } from "../../src/build/BuilderTypes";
import { compileBuilderProjectToLevel } from "../../src/build/compileBuilderProjectToLevel";
import { validateLevelConfig } from "../../src/game/config/ConfigValidator";
import { extractConfigCard } from "./extractConfigCard";
import { scanPlayerFacingText } from "./copyScan";

export const nightArchiveProject: BuilderProject = {
  schemaVersion: "hp.builder.v1",
  projectId: "demo_night_archive",
  title: "夜班档案室",
  rooms: [
    { id: "room_intake", label: "夜班接收台", style: "sterile", center: [0, 19], size: [10, 6] },
    { id: "room_hall", label: "档案走廊", style: "hazard", center: [0, 12], size: [10, 8] },
    { id: "room_power", label: "供能壁龛", style: "maintenance", center: [0, 4], size: [10, 8] },
    { id: "room_watch", label: "监控间", style: "sterile", center: [0, -4], size: [10, 8] },
    { id: "room_archive", label: "身份档案舱", style: "museum", center: [0, -12], size: [10, 8] },
    { id: "room_lift", label: "闭馆电梯", style: "exit", center: [0, -19], size: [10, 6] },
  ],
  doors: [
    { id: "door_ab", fromRoomId: "room_intake", toRoomId: "room_hall", lockType: "none" },
    { id: "door_bc", fromRoomId: "room_hall", toRoomId: "room_power", lockType: "puzzle_complete", puzzleKind: "circuit_grid", puzzleRoomId: "room_hall", doorFamily: "industrial" },
    { id: "door_cd", fromRoomId: "room_power", toRoomId: "room_watch", lockType: "puzzle_complete", puzzleKind: "surveillance_match", puzzleRoomId: "room_power", doorFamily: "clinic" },
    { id: "door_de", fromRoomId: "room_watch", toRoomId: "room_archive", lockType: "puzzle_complete", puzzleKind: "archive_merge", puzzleRoomId: "room_watch", doorFamily: "reclamation" },
    { id: "door_ef", fromRoomId: "room_archive", toRoomId: "room_lift", lockType: "puzzle_complete", puzzleKind: "color_sequence", puzzleRoomId: "room_archive", doorFamily: "elevator" },
  ],
  puzzles: [
    { id: "pz_power", kind: "circuit_grid", linkedDoorId: "door_bc", roomId: "room_hall", position: [0, 11], rotationY: 0 },
    { id: "pz_watch", kind: "surveillance_match", linkedDoorId: "door_cd", roomId: "room_power", position: [0, 3], rotationY: 0 },
    { id: "pz_merge", kind: "archive_merge", linkedDoorId: "door_de", roomId: "room_watch", position: [0, -5], rotationY: 0, archiveTargetValue: 256 },
    {
      id: "pz_color",
      kind: "color_sequence",
      linkedDoorId: "door_ef",
      roomId: "room_archive",
      position: [0, -13],
      rotationY: 0,
      components: [
        { id: "orb_a", role: "orb_cyan", roomId: "room_archive", position: [-3, -11] },
        { id: "orb_b", role: "orb_red", roomId: "room_archive", position: [3, -11] },
        { id: "orb_c", role: "orb_yellow", roomId: "room_archive", position: [0, -10] },
      ],
    },
  ],
  props: [
    { id: "p1", modelKey: "room_table_utility", roomId: "room_intake", position: [3.2, 20], rotationY: 0, scale: 1 },
    { id: "p2", modelKey: "room_locker_low", roomId: "room_intake", position: [-3.4, 20.4], rotationY: Math.PI / 2, scale: 1 },
    { id: "p3", modelKey: "room_fuse_box", roomId: "room_hall", position: [-3.6, 13.2], rotationY: Math.PI / 2, scale: 1 },
    { id: "p4", modelKey: "room_crate_stack", roomId: "room_hall", position: [3.4, 13.6], rotationY: 0.3, scale: 1 },
    { id: "p5", modelKey: "room_maintenance_supply_cabinet", roomId: "room_power", position: [-3.6, 5.4], rotationY: Math.PI / 2, scale: 1 },
    { id: "p6", modelKey: "room_fuse_box", roomId: "room_power", position: [3.6, 5.6], rotationY: -Math.PI / 2, scale: 1 },
    { id: "p7", modelKey: "room_museum_wall_label_panel", roomId: "room_watch", position: [-3.6, -2.6], rotationY: Math.PI / 2, scale: 1 },
    { id: "p8", modelKey: "room_museum_display_case_tool", roomId: "room_archive", position: [-3.4, -13.4], rotationY: 0, scale: 1 },
    { id: "p9", modelKey: "room_museum_archive_column", roomId: "room_archive", position: [3.6, -13.6], rotationY: 0, scale: 1 },
    { id: "p10", modelKey: "room_fake_family_photo_wall", roomId: "room_archive", position: [0, -15], rotationY: 0, scale: 1 },
    { id: "p11", modelKey: "light_residential_lamp_warm", roomId: "room_lift", position: [2.4, -20], rotationY: 0, scale: 1 },
  ],
  pickups: [
    { id: "kit_a", kind: "repairKit", roomId: "room_power", position: [-2.4, 5.8] },
    { id: "cell_a", kind: "coreCell", roomId: "room_watch", position: [2.6, -5.4] },
  ],
  robots: [
    { id: "r1", roomId: "room_hall", archetype: "repair_drone", count: 1 },
    { id: "r2", roomId: "room_watch", archetype: "clamp_bot", count: 2 },
  ],
  story: {
    templateId: "museum_archive",
    victoryLine: "夜班记录：档案舱已闭馆，最后一名访客身份待归档。",
    transitionLine: "电梯门合上时，登记灯由红转灭。",
  },
  exitRoomId: "room_lift",
  lighting: { ambient: 0.55, keyColor: "#bfe9ff", keyIntensity: 0.9, fog: 0.4, bloom: 0.5, shadow: 0.5 },
};

// ── 跑管线 + 打报告 ──
const { level, issues } = compileBuilderProjectToLevel(nightArchiveProject);

console.log(`\n=== 编译「${nightArchiveProject.title}」 ===`);
console.log(`compile issues: ${issues.length}`);
for (const i of issues) console.log(`  ✗ ${i.path}: ${i.message}`);

if (!level) {
  console.log("\n编译失败（level=null），先修上面的 issue。");
  process.exit(1);
}

const report = validateLevelConfig(level);
console.log(`\n=== 校验 ===`);
console.log(`validatorOk: ${report.ok}  errors: ${report.errors.length}  warnings: ${report.warnings.length}`);
for (const e of report.errors) console.log(`  ✗ [${e.code}] ${e.path}: ${e.message}`);
for (const w of report.warnings.slice(0, 8)) console.log(`  · [${w.code}] ${w.path}: ${w.message}`);

const exitRoomReachable = report.graph.reachability.rooms.includes(report.graph.exitRoomId ?? "");
console.log(`\n=== 可解性（explainPuzzle 图模拟）===`);
console.log(`出口房间可达: ${exitRoomReachable}`);
console.log(`锁链: ${report.graph.locks.map((l) => `${l.fromRoomId}→${l.toRoomId}[${l.lockType}]`).join("  ")}`);
console.log(`谜题(全部应可达): ${report.graph.puzzles.map((p) => `${p.type}@${p.roomId}`).join("  ")}`);
// ⚠️ builder 编译关卡的出口解锁接在 room_entered→unlock_exit 事件上，静态图模拟不跑 events，
// 所以 reachability.exitUnlocked 注定 false（运行时进电梯间即解锁）。playable 判定用"出口房间可达"。
console.log(`(reachability.exitUnlocked=${report.graph.reachability.exitUnlocked} 是静态盲区，非缺陷)`);

const card = extractConfigCard(level);
console.log(`\n=== ConfigCard 摘要 ===`);
console.log(`房间: ${card.roomsGraph.roomCount}  spawn: ${card.roomsGraph.spawnRoomId}  exit: ${card.roomsGraph.exitRoomId}`);
console.log(`谜题链: ${card.puzzleChain.map((p) => p.kind + (p.reachableFromSpawn ? "" : "[不可达!]")).join(" → ")}`);
console.log(`难度: ${JSON.stringify(card.riskMetrics.difficulty)}`);
console.log(`灯光: ${card.visualStory.lightingPreset}  母题命中: ${card.visualStory.motifsHit.join("/") || "(无)"}`);
console.log(`资产 modelKey 数: ${card.assetCoverage.distinctModelKeys}`);

const violations = scanPlayerFacingText(level).filter((h) => h.word);
console.log(`\n=== 玩家可见禁词 ===`);
console.log(violations.length === 0 ? "✓ 干净" : violations.map((v) => `  ✗ [${v.word}] ${v.path}: ${v.text}`).join("\n"));

const playable =
  issues.length === 0 &&
  report.ok &&
  exitRoomReachable &&
  card.puzzleChain.length === 4 &&
  card.puzzleChain.every((p) => p.reachableFromSpawn) &&
  violations.length === 0;
console.log(`\n=== 结论 ===`);
console.log(
  playable
    ? "✓ 可玩：编译0错 + 校验通过 + 出口房间可达 + 4 谜题全可达 + 文案干净"
    : "✗ 还不可玩，见上面",
);

if (process.argv.includes("--emit")) {
  mkdirSync("data/ai", { recursive: true });
  writeFileSync("data/ai/demo-night-archive.builder.json", JSON.stringify(nightArchiveProject, null, 2));
  console.log("\n已写出可导入 /build 的工件：data/ai/demo-night-archive.builder.json");
}
