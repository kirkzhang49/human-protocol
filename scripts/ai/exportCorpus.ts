/**
 * 语料导出器（Phase 0）。
 *
 * 把 basePack 的 20 关导成 JSONL：每行 { id, source, card, classification, health }。
 * 这是分类基线评测、相似检索、以及 §12 训练数据的地基。
 * 默认只导官方 + smoke；私有草稿不导（隐私）。
 *
 * Run:  scripts/ai/run.sh exportCorpus.ts            # → data/ai/corpus.jsonl
 *       scripts/ai/run.sh exportCorpus.ts --stdout   # 打到标准输出
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { extractConfigCard } from "./extractConfigCard";
import { classify } from "./classifyRules";
import { healthReport } from "./healthCheck";

const OUT = "data/ai/corpus.jsonl";

const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");

const rows = humanProtocolBasePack.levels.map((level) => {
  const card = extractConfigCard(level);
  return {
    id: level.id,
    source: level.id.startsWith("smoke_") ? "smoke" : "official",
    card,
    classification: classify(card),
    health: healthReport(level),
  };
});

const jsonl = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

if (process.argv.includes("--stdout")) {
  process.stdout.write(jsonl);
} else {
  mkdirSync("data/ai", { recursive: true });
  writeFileSync(OUT, jsonl);
  const playable = rows.filter((r) => r.health.playable).length;
  const avgScore = Math.round(rows.reduce((s, r) => s + r.health.score, 0) / rows.length);
  const byArc: Record<string, number> = {};
  for (const r of rows) byArc[r.classification.arc] = (byArc[r.classification.arc] ?? 0) + 1;
  console.log(`✓ 写出 ${rows.length} 行 → ${OUT}`);
  console.log(`  可玩 ${playable}/${rows.length}  平均质量分 ${avgScore}`);
  console.log(`  arc 分布: ${Object.entries(byArc).map(([a, n]) => `${a}:${n}`).join("  ")}`);
}
