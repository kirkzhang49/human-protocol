/**
 * Schema 自检（Phase 0）。
 *
 * 对 20 关现场抽 ConfigCard + 分类结果，逐一对 schemas/*.json 校验。
 * 保证 IR 契约稳定——下游（语料 JSONL、检索、训练、其它 agent/工具）能安全消费。
 *
 * Run:  scripts/ai/run.sh validateSchemas.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractConfigCard } from "./extractConfigCard";
import { classify } from "./classifyRules";
import { validate, type Schema } from "./lib/miniSchema";

const here = dirname(fileURLToPath(import.meta.url));
const cardSchema = JSON.parse(readFileSync(join(here, "schemas/configCard.schema.json"), "utf8")) as Schema;
const clsSchema = JSON.parse(readFileSync(join(here, "schemas/classification.schema.json"), "utf8")) as Schema;

export async function runSchemaCheck(): Promise<{ errors: number; detail: string[] }> {
  const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
  const detail: string[] = [];
  let errors = 0;
  for (const level of humanProtocolBasePack.levels) {
    const card = extractConfigCard(level);
    const cls = classify(card);
    const errs = [
      ...validate(cardSchema, card).map((e) => `card${e.path.slice(1)}: ${e.message}`),
      ...validate(clsSchema, cls).map((e) => `cls${e.path.slice(1)}: ${e.message}`),
    ];
    if (errs.length) {
      errors += errs.length;
      detail.push(`✗ ${level.id}`, ...errs.map((e) => `    ${e}`));
    }
  }
  return { errors, detail };
}

// ── CLI ──
if (process.argv[1]?.endsWith("validateSchemas.ts")) {
  const { errors, detail } = await runSchemaCheck();
  for (const line of detail) console.log(line);
  if (errors === 0) console.log(`✓ schema 自检通过：20 关的 ConfigCard + ClassificationResult 全部符合契约`);
  else { console.log(`\n✗ ${errors} 处 schema 违例`); process.exit(1); }
}
