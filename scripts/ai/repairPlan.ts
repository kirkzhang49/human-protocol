/**
 * 🔧 确定性修复规划器（/build「修复」按钮的 headless 大脑，零模型）。
 *
 * 输入一个 BuilderProject → 跑体检 → 把每条可修问题映射成**精确 typed 修复操作**，
 * 应用到克隆 → 重编译 → 重体检，**只在 compile+validate 仍过且分数不降时**才保留。
 * 这就是设计文档 §7 的「修复」契约的纯逻辑实现：模型不参与，建议先预览、用户点了才应用。
 *
 * /build 的 React「修复」按钮将来只需：planRepairs(project) 拿建议 → 展示 before/after →
 * 用户确认 → applyRepairs(project, picked)。**不在 React 里加任何 AI 分支**。
 *
 * Run:
 *   scripts/ai/run.sh demoEscapeRoom.ts --emit
 *   scripts/ai/run.sh repairPlan.ts --project data/ai/demo-night-archive.builder.json          # 看建议
 *   scripts/ai/run.sh repairPlan.ts --project data/ai/demo-night-archive.builder.json --apply   # 应用 + 写 *.repaired.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { BuilderProject } from "../../src/build/BuilderTypes";
import { compileBuilderProjectToLevel } from "../../src/build/compileBuilderProjectToLevel";
import { healthReport, type HealthReport } from "./healthCheck";

export interface RepairOp { op: string; target: string; detail: string }
export interface RepairSuggestion {
  id: string;
  finding: string;
  group: "叙事" | "布局" | "灯光材质" | "可玩性修复";
  rationale: string;
  ops: RepairOp[];
  apply: (project: BuilderProject) => void;
}

const STYLE_TEMPLATE: Record<string, string> = {
  museum: "museum_archive", maintenance: "maintenance_incident", residential: "false_family",
  sterile: "memory_clinic", hazard: "surveillance_trial", core: "reclamation_core",
};
const STYLE_PROPS: Record<string, string[]> = {
  maintenance: ["room_maintenance_supply_cabinet", "room_fuse_box", "room_crate_stack"],
  sterile: ["room_table_utility", "room_locker_low"],
  hazard: ["room_crate_stack", "room_fuse_box"],
  residential: ["room_fake_family_photo_wall", "light_residential_lamp_warm"],
  museum: ["room_museum_display_case_tool", "room_museum_archive_column", "room_museum_wall_label_panel"],
  core: ["room_museum_archive_column"],
  exit: ["light_residential_lamp_warm"],
};
// 策划好的设施口吻线索（copy-scan 干净、命中母题）。模型阶段会替换/丰富，这里是确定性兜底。
const CLUE_BY_TEMPLATE: Record<string, { title: string; clue: string; hint: string }> = {
  museum_archive: { title: "档案残页", clue: "登记时间早于出生。", hint: "再核对一次相框。" },
  memory_clinic: { title: "疗程记录", clue: "这段记忆维护过三次。", hint: "看护台还亮着。" },
  reclamation_core: { title: "回收单", clue: "库存编号仍在移动。", hint: "核对身份片。" },
  maintenance_incident: { title: "检修工单", clue: "有一段记录被涂黑了。", hint: "翻到背面。" },
  false_family: { title: "住户登记", clue: "这里从来没有人住过。", hint: "再看那张全家福。" },
  surveillance_trial: { title: "监控时间戳", clue: "第六台摄像头从未接线。", hint: "比对两段画面。" },
};
const FORBIDDEN_FIX: Record<string, string> = { 大门: "闸门", 节点: "接驳口", 三锁: "封锁", 流程: "工单", 官卡: "登记", Boss: "主控", demo: "样间", builder: "工棚" };

function dominantStyle(project: BuilderProject): string {
  const count: Record<string, number> = {};
  for (const r of project.rooms) count[r.style] = (count[r.style] ?? 0) + 1;
  return Object.entries(count).filter(([s]) => s !== "exit").sort((a, b) => b[1] - a[1])[0]?.[0] ?? "museum";
}

export function planRepairs(project: BuilderProject, health: HealthReport): RepairSuggestion[] {
  const out: RepairSuggestion[] = [];
  const tags = new Set(health.findings.map((f) => f.tag));

  if (tags.has("missing_story")) {
    const style = dominantStyle(project);
    const templateId = STYLE_TEMPLATE[style] ?? "museum_archive";
    const clue = CLUE_BY_TEMPLATE[templateId] ?? CLUE_BY_TEMPLATE.museum_archive;
    // 选一个故事感最强房间里的 prop 挂线索（museum/residential 优先），否则第一个 prop。
    const preferRooms = new Set(project.rooms.filter((r) => ["museum", "residential", "core"].includes(r.style)).map((r) => r.id));
    const target = project.props.find((p) => preferRooms.has(p.roomId)) ?? project.props[0];
    out.push({
      id: "ensure_story",
      finding: "missing_story",
      group: "叙事",
      rationale: `挂一条「${clue.title}」线索到「${target?.modelKey ?? "?"}」→ 编译出 article，storyPresent 转真`,
      ops: [
        ...(project.story?.templateId ? [] : [{ op: "set_story_template", target: "story", detail: templateId }]),
        { op: "set_prop_story", target: target?.id ?? "?", detail: `${clue.title}｜${clue.clue}` },
      ],
      apply: (p) => {
        if (!p.story?.templateId) p.story = { ...(p.story ?? {}), templateId };
        const t = p.props.find((x) => x.id === target?.id);
        if (t) t.story = { title: clue.title, clue: clue.clue, hint: clue.hint };
      },
    });
  }

  if (tags.has("too_little_visual_identity")) {
    const sparse = project.rooms.filter((r) => project.props.filter((p) => p.roomId === r.id).length < 2);
    if (sparse.length) {
      out.push({
        id: "enrich_visual",
        finding: "too_little_visual_identity",
        group: "布局",
        rationale: `给 ${sparse.length} 个稀疏房间各补 1 件风格道具，提升视觉完整度`,
        ops: sparse.map((r) => ({ op: "add_prop", target: r.id, detail: (STYLE_PROPS[r.style] ?? STYLE_PROPS.sterile)[0] })),
        apply: (p) => {
          let n = 0;
          for (const r of p.rooms) {
            if (p.props.filter((x) => x.roomId === r.id).length >= 2) continue;
            const key = (STYLE_PROPS[r.style] ?? STYLE_PROPS.sterile)[0];
            p.props.push({ id: `fix_prop_${n++}`, modelKey: key, roomId: r.id, position: [r.center[0] + r.size[0] * 0.28, r.center[1] + r.size[1] * 0.28], rotationY: 0, scale: 1 });
          }
        },
      });
    }
  }

  if (tags.has("player_facing_debug_words")) {
    out.push({
      id: "fix_forbidden_label",
      finding: "player_facing_debug_words",
      group: "可玩性修复",
      rationale: "把房间/门 label 里的禁词替换成设施名词白名单同义词",
      ops: [{ op: "rename_labels", target: "rooms+doors", detail: Object.entries(FORBIDDEN_FIX).map(([a, b]) => `${a}→${b}`).join(" ") }],
      apply: (p) => {
        const fix = (s: string) => Object.entries(FORBIDDEN_FIX).reduce((acc, [a, b]) => acc.split(a).join(b), s);
        for (const r of p.rooms) r.label = fix(r.label);
        for (const d of p.doors as any[]) if (d.label) d.label = fix(d.label);
      },
    });
  }

  return out;
}

export interface RepairRun {
  before: HealthReport;
  after: HealthReport;
  applied: RepairSuggestion[];
  rejected: Array<{ id: string; reason: string }>;
  repaired: BuilderProject;
}

/** 逐条试应用：每条都重编译+重体检，只保留"仍合法且分数不降、问题减少"的。 */
export function applyRepairs(project: BuilderProject, suggestions: RepairSuggestion[]): RepairRun | { error: string } {
  const base = compileBuilderProjectToLevel(project);
  if (!base.level) return { error: "原工程编译失败：" + base.issues.map((i) => i.message).join("; ") };
  const before = healthReport(base.level);

  let current: BuilderProject = structuredClone(project);
  const applied: RepairSuggestion[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];
  let runningHealth = before;

  for (const sug of suggestions) {
    const trial = structuredClone(current);
    try { sug.apply(trial); } catch (e) { rejected.push({ id: sug.id, reason: "apply 抛错: " + (e as Error).message }); continue; }
    const c = compileBuilderProjectToLevel(trial);
    if (!c.level || c.issues.length) { rejected.push({ id: sug.id, reason: "重编译产生问题: " + c.issues.map((i) => i.message).join("; ") }); continue; }
    const h = healthReport(c.level);
    const newBlocker = h.findings.some((f) => f.severity === "blocker") && !runningHealth.findings.some((f) => f.severity === "blocker");
    if (!h.playable || newBlocker || h.score < runningHealth.score) {
      rejected.push({ id: sug.id, reason: `应用后分 ${h.score} < ${runningHealth.score} 或不可玩` });
      continue;
    }
    current = trial; runningHealth = h; applied.push(sug);
  }

  return { before, after: runningHealth, applied, rejected, repaired: current };
}

// ── CLI ──
if (process.argv[1]?.endsWith("repairPlan.ts")) {
  const args = process.argv.slice(2);
  const path = args[args.indexOf("--project") + 1];
  if (!path) { console.error("用法: repairPlan.ts --project <builder.json> [--apply] [--json]"); process.exit(1); }
  const project = JSON.parse(readFileSync(path, "utf8")) as BuilderProject;
  const compiled = compileBuilderProjectToLevel(project);
  if (!compiled.level) { console.error("编译失败:\n" + compiled.issues.map((i) => "  ✗ " + i.message).join("\n")); process.exit(1); }
  const health = healthReport(compiled.level);
  const suggestions = planRepairs(project, health);

  if (args.includes("--apply")) {
    const run = applyRepairs(project, suggestions);
    if ("error" in run) { console.error(run.error); process.exit(1); }
    if (args.includes("--json")) { console.log(JSON.stringify({ before: run.before, after: run.after, applied: run.applied.map((s) => ({ id: s.id, ops: s.ops })), rejected: run.rejected }, null, 2)); }
    else {
      console.log(`\n🔧 修复「${project.title}」`);
      console.log(`   分数 ${run.before.score} → ${run.after.score}   问题 ${run.before.findings.length} → ${run.after.findings.length}`);
      for (const s of run.applied) console.log(`   ✓ 应用 ${s.id}（修 ${s.finding}）：${s.rationale}`);
      for (const r of run.rejected) console.log(`   ✗ 拒 ${r.id}：${r.reason}`);
    }
    const outPath = path.replace(/\.json$/, ".repaired.json");
    writeFileSync(outPath, JSON.stringify(("repaired" in run ? run.repaired : project), null, 2));
    console.log(`\n已写出修复后工程 → ${outPath}`);
  } else {
    if (args.includes("--json")) console.log(JSON.stringify(suggestions.map((s) => ({ id: s.id, finding: s.finding, group: s.group, rationale: s.rationale, ops: s.ops })), null, 2));
    else {
      console.log(`\n🔧 修复建议「${project.title}」（当前分 ${health.score}，${health.findings.length} 问题）`);
      if (!suggestions.length) console.log("   ✓ 无可自动修复项");
      for (const s of suggestions) {
        console.log(`\n   [${s.group}] ${s.id} — 修 ${s.finding}`);
        console.log(`     ${s.rationale}`);
        for (const op of s.ops) console.log(`       · ${op.op}(${op.target}) ${op.detail}`);
      }
      console.log(`\n   预览模式。加 --apply 才会试应用（每条都重编译+重体检，分数不降才保留）。`);
    }
  }
}
