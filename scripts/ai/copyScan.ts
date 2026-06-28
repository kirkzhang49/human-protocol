/**
 * 玩家可见文案禁词扫描（Phase 1）。
 *
 * 故事圣经 §6：以下词不许出现在玩家可见文本——
 *   demo、v1、Boss、三锁、大门、节点、流程、官卡、generated、builder
 *   以及引擎/配置词：wave、spawn、config、HUD…
 *
 * ⚠️ 关键：**只扫玩家可见字段**（title/label/message/对白/objective/article），
 * 绝不扫 id / modelKey / visualKey / trigger / lightingPreset —— 那些字段里合法地含
 * "wave"/"spawn"/"config"，扫了全是误报。来源字段白名单写死在 collectPlayerFacingText 里。
 */
import type { LevelDefinition } from "../../src/game/config/schema/levelConfig";

export interface CopyScanHit {
  path: string;
  text: string;
  /** 命中的禁词；undefined = 干净（仅作为可见文本语料返回）。 */
  word?: string;
}

/** 英文引擎/调试词（词边界，不区分大小写）。 */
const FORBIDDEN_EN = /\b(demo|v\d+|boss|generated|builder|wave|spawn|config|hud)\b/i;
/** 中文设施外/调试词（子串）。 */
const FORBIDDEN_ZH = ["三锁", "大门", "节点", "流程", "官卡"];

function findForbidden(text: string): string | undefined {
  const en = text.match(FORBIDDEN_EN);
  if (en) return en[0];
  for (const zh of FORBIDDEN_ZH) if (text.includes(zh)) return zh;
  return undefined;
}

/** 单串禁词检查（供故事生成/语料校验复用，中英通用）。返回命中的禁词或 undefined。 */
export function findForbiddenWord(text: string): string | undefined {
  return typeof text === "string" ? findForbidden(text) : undefined;
}

/** 收集所有玩家可见文本片段（白名单字段）。 */
function collectPlayerFacingText(level: LevelDefinition): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const push = (path: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) out.push({ path, text: value });
  };

  push("title", level.title);

  const map = level.map;
  for (const r of map?.rooms ?? []) push(`room[${r.id}].label`, r.label);
  for (const d of map?.doors ?? []) {
    push(`door[${d.id}].label`, d.label);
    push(`door[${d.id}].lock.lockedMessage`, (d.lock as any)?.lockedMessage);
    push(`door[${d.id}].lock.unlockedMessage`, (d.lock as any)?.unlockedMessage);
  }
  for (const k of map?.keyItems ?? []) push(`keyItem[${k.id}].label`, k.label);

  for (const o of level.objectiveChain ?? []) {
    const oo = o as any;
    push(`objective[${oo.id}].title`, oo.title);
    push(`objective[${oo.id}].detail`, oo.detail);
    push(`objective[${oo.id}].guidance.label`, oo.guidance?.label);
    push(`objective[${oo.id}].guidance.detail`, oo.guidance?.detail);
  }

  for (const dlg of level.dialogues ?? []) {
    const lines = (dlg as any).lines ?? [];
    lines.forEach((l: any, i: number) => push(`dialogue[${(dlg as any).id ?? "?"}].line[${i}]`, l?.text));
  }

  for (const p of level.puzzles ?? []) push(`puzzle[${(p as any).id}].label`, (p as any).label);

  for (const a of level.articles ?? []) {
    const aa = a as any;
    push(`article[${aa.id}].title`, aa.title);
    (aa.pages ?? []).forEach((pg: any, i: number) => push(`article[${aa.id}].page[${i}]`, pg?.body ?? pg?.text));
  }

  const pres = level.presentation as any;
  if (pres) {
    push("presentation.defaultWaveStartMessage", pres.defaultWaveStartMessage);
    push("presentation.reinforcementMessage", pres.reinforcementMessage);
    const waveLabels = Array.isArray(pres.waveLabels) ? pres.waveLabels : Object.values(pres.waveLabels ?? {});
    waveLabels.forEach((w: any, i: number) => push(`presentation.waveLabels[${i}]`, w?.label ?? w));
    const objectives = Array.isArray(pres.objectives) ? pres.objectives : Object.values(pres.objectives ?? {});
    objectives.forEach((o: any, i: number) => {
      push(`presentation.objectives[${i}].title`, o?.title);
      push(`presentation.objectives[${i}].detail`, o?.detail);
    });
  }

  return out;
}

/** 返回所有可见文本片段；命中禁词的带 `word`。 */
export function scanPlayerFacingText(level: LevelDefinition): CopyScanHit[] {
  return collectPlayerFacingText(level).map(({ path, text }) => {
    const word = findForbidden(text);
    return word ? { path, text, word } : { path, text };
  });
}

// ── CLI ──
const invokedDirectly = process.argv[1]?.endsWith("copyScan.ts");
if (invokedDirectly) {
  const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
  let total = 0;
  for (const level of humanProtocolBasePack.levels) {
    const hits = scanPlayerFacingText(level).filter((h) => h.word);
    if (hits.length) {
      total += hits.length;
      console.log(`\n✗ ${level.id} (${hits.length})`);
      for (const h of hits) console.log(`  [${h.word}] ${h.path}: ${h.text}`);
    }
  }
  console.log(total === 0 ? "\n✓ copy-scan clean across all levels" : `\n${total} violations`);
}
