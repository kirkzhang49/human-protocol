/**
 * ✅ 一键自检整套 AI 工具（CI 守门）。
 *
 * 四道关全绿才退 0：① 全 20 关玩家文案禁词扫描；② ConfigCard/分类 schema 契约；
 * ③ guardrail 负样本自测（注入破坏必须被逮到）；④ 全 20 关体检无被阻断。
 * 任一红 → 退非 0。任何人改了提取器/分类器/校验逻辑，跑这个就知道有没有破东西。
 *
 * Run:  scripts/ai/run.sh selfCheck.ts
 */
import { scanPlayerFacingText } from "./copyScan";
import { healthReport } from "./healthCheck";
import { runSchemaCheck } from "./validateSchemas";
import { runNegatives } from "./negatives";

const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
const levels = humanProtocolBasePack.levels;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

// ① 禁词扫描
{
  const offenders = levels
    .map((l) => ({ id: l.id, hits: scanPlayerFacingText(l).filter((h) => h.word) }))
    .filter((x) => x.hits.length);
  results.push({
    name: "玩家文案禁词扫描",
    ok: offenders.length === 0,
    detail: offenders.length === 0 ? "20 关干净" : offenders.map((o) => `${o.id}(${o.hits.length})`).join(", "),
  });
}

// ② schema 契约
{
  const { errors, detail } = await runSchemaCheck();
  results.push({ name: "ConfigCard/分类 schema 契约", ok: errors === 0, detail: errors === 0 ? "20 关契约符合" : detail.join("; ") });
}

// ③ guardrail 负样本
{
  const { caught, applicable } = await runNegatives(false);
  results.push({ name: "guardrail 负样本自测", ok: caught === applicable, detail: `${caught}/${applicable} 破坏被逮到` });
}

// ④ 体检无被阻断
{
  const reports = levels.map((l) => healthReport(l));
  const blocked = reports.filter((r) => !r.playable);
  const avg = Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length);
  results.push({
    name: "全 20 关体检",
    ok: blocked.length === 0,
    detail: blocked.length === 0 ? `全部可玩，平均质量分 ${avg}` : `被阻断: ${blocked.map((r) => r.id).join(", ")}`,
  });
}

console.log("AI 工具自检\n" + "=".repeat(48));
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(28)} ${r.detail}`);
const allOk = results.every((r) => r.ok);
console.log("=".repeat(48));
console.log(allOk ? "✅ 全绿——工具链健康" : "❌ 有红——见上");
if (!allOk) process.exit(1);
