/**
 * 🧰 训练集汇编（Phase 0→4 桥，零模型）。
 *
 * 把四个任务族聚合成统一 SFT JSONL（messages 格式，§12），去重 + train/val 切分 + manifest：
 *   classify  ← 20 关 ConfigCard → ClassificationResult（规则分类 silver；官方关进 val 做 eval）
 *   risk      ← 负样本：被破坏的 ConfigCard → 命中的风险标签（synthetic）
 *   story     ← 10 关双语 gold（storyCorpus；8 train / 2 val）
 *   plan      ← 退化房间→repairPlan 的修复 ops（synthetic 演示；真 gold 来自 /build 采纳回路）
 * 只有过了确定性墙（copy-scan 干净等）的样本入集。**一旦攒够 accepted gold，换掉 silver/synthetic 即可开训。**
 *
 * Run:  scripts/ai/run.sh trainPrep.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { LevelDefinition } from "../../src/game/config/schema/levelConfig";
import { extractConfigCard } from "./extractConfigCard";
import { classify } from "./classifyRules";
import { MUTATIONS } from "./negatives";
import { generateRoom } from "./generateRoom";
import { healthReport } from "./healthCheck";
import { planRepairs } from "./repairPlan";
import { compileBuilderProjectToLevel } from "../../src/build/compileBuilderProjectToLevel";

interface SftRecord {
  task: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  meta: Record<string, unknown>;
  split: "train" | "val";
}

const SYS = {
  classify: "你是密室 config 分类器。给定 ConfigCard(JSON)，只返回 ClassificationResult(JSON)：arc / roomRoles / difficulty / pacing / visualCompleteness / puzzleStructure / riskTags / motifsHit。",
  risk: "你是密室 config 风险检查器。给定 ConfigCard(JSON)，只返回该配置命中的风险标签数组(JSON string[])，如 no_exit / key_unreachable / player_facing_debug_words 等。",
  plan: "你是 /build 修复规划器。给定密室体检问题，只返回 typed 修复 ops 数组(JSON)，每条 {op,target,detail}。所有 op 必须可由确定性管线 compile+validate 通过。",
};

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
const levels = humanProtocolBasePack.levels;

const records: SftRecord[] = [];
const seen = new Set<string>();
function push(task: string, user: string, assistant: string, meta: Record<string, unknown>, split: "train" | "val") {
  const key = `${task}:${hash(user)}`;
  if (seen.has(key)) return;
  seen.add(key);
  records.push({ task, messages: [{ role: "system", content: (SYS as any)[task] ?? "" }, { role: "user", content: user }, { role: "assistant", content: assistant }], meta, split });
}

// ── classify：官方进 val，smoke 进 train ──
for (const level of levels) {
  const card = extractConfigCard(level);
  const split = level.id.startsWith("level_") ? "val" : "train";
  push("classify", JSON.stringify(card), JSON.stringify(classify(card)), { levelId: level.id, source: "silver" }, split);
}

// ── risk：负样本（破坏合法关 → 风险标签）──
const riskBases = ["level_03_human_museum", "level_05_reclamation_core", "level_01_maintenance_bay"]
  .map((id) => levels.find((l) => l.id === id)!).filter(Boolean);
for (const base of riskBases) {
  for (const mut of MUTATIONS) {
    if (!mut.applies(base)) continue;
    const broken = structuredClone(base) as any;
    try {
      mut.mutate(broken);
      const card = extractConfigCard(broken as LevelDefinition); // 极端破坏可能抛错→跳过
      push("risk", JSON.stringify(card), JSON.stringify(classify(card).riskTags), { baseId: base.id, mutation: mut.name, source: "synthetic" }, "train");
    } catch { /* 破坏太狠连提取都崩 = 已被系统拦下，不作训练样本 */ }
  }
}

// ── story：双语 gold（动态 import，对本地化崩溃优雅降级）──
try {
  const { buildStoryExemplars, STORY_SYSTEM_PROMPT } = await import("./storyCorpus");
  const exemplars = buildStoryExemplars(levels).filter((e) => e.copyScanClean);
  exemplars.forEach((e, i) => {
    const user = JSON.stringify({ arc: e.arc, motifs: e.draft.motifsUsed, roomContext: e.roomContext });
    const key = `story:${hash(user)}`;
    if (seen.has(key)) return; seen.add(key);
    records.push({ task: "story", messages: [{ role: "system", content: STORY_SYSTEM_PROMPT }, { role: "user", content: user }, { role: "assistant", content: JSON.stringify(e.draft) }], meta: { levelId: e.levelId, source: "gold", enDiffers: e.enDiffers }, split: i < 8 ? "train" : "val" });
  });
} catch (e) {
  console.warn(`⚠ story 族跳过：本地化 import 失败（疑似并发 agent 正在改 src/game/config/localization/）—\n  ${(e as Error).message}`);
}

// ── plan：退化生成房 → repairPlan 修复 ops（synthetic 演示）──
for (const seed of [11, 23, 37]) {
  const g = generateRoom({ seed });
  const degraded = structuredClone(g.project) as any;
  for (const p of degraded.props) delete p.story; // 制造 missing_story
  const compiled = compileBuilderProjectToLevel(degraded);
  if (!compiled.level) continue;
  const h = healthReport(compiled.level);
  const suggestions = planRepairs(degraded, h);
  if (!suggestions.length) continue;
  const user = JSON.stringify({ arc: h.arc, findings: h.findings.map((f) => f.tag), roomCount: degraded.rooms.length });
  const assistant = JSON.stringify(suggestions.flatMap((s) => s.ops));
  push("plan", user, assistant, { seed, source: "synthetic" }, "train");
}

// ── 写出 ──
mkdirSync("data/ai/train", { recursive: true });
const byTask: Record<string, SftRecord[]> = {};
for (const r of records) (byTask[r.task] ??= []).push(r);
for (const [task, recs] of Object.entries(byTask)) {
  writeFileSync(`data/ai/train/${task}.jsonl`, recs.map((r) => JSON.stringify(r)).join("\n") + "\n");
}
writeFileSync("data/ai/train/all.jsonl", records.map((r) => JSON.stringify(r)).join("\n") + "\n");
const manifest = {
  total: records.length,
  byTask: Object.fromEntries(Object.entries(byTask).map(([t, r]) => [t, { total: r.length, train: r.filter((x) => x.split === "train").length, val: r.filter((x) => x.split === "val").length }])),
  note: "silver=规则分类 / synthetic=负样本&退化修复 / gold=双语故事+(将来)作者采纳修复。开训前用 accepted gold 替换 silver/synthetic。",
};
writeFileSync("data/ai/train/manifest.json", JSON.stringify(manifest, null, 2));

console.log(`🧰 训练集汇编：${records.length} 条`);
for (const [t, c] of Object.entries(manifest.byTask)) console.log(`  ${t.padEnd(9)} 共 ${(c as any).total}  (train ${(c as any).train} / val ${(c as any).val})`);
console.log(`\n✓ 写出 data/ai/train/{${Object.keys(byTask).join(",")}}.jsonl + all.jsonl + manifest.json`);
console.log(`  ${manifest.note}`);
