/**
 * 🪶 双语玩家故事生成器 —— model-free 兜底 + 连模型，二合一。
 *
 *   generateStory({arc, motifs, roomContext, title?}, {preferModel}) → { draft, source }
 *
 * - 连模型：Qwen3-4B（Ollama），story.v1.md 口吻 + few-shot 范例 + schema/双语 copy-scan 校验 + 重试。
 * - model-free：从 storyCorpus 的官方双语 gold 按 arc 取范例兜底——**没有模型也能产出合法双语故事**。
 * 两条路输出都过 copy-scan（中英），脏的不放行。烘进 LevelLocalization 由调用方完成。
 *
 * Run:  scripts/ai/run.sh generateStory.ts museum            # model-free（无 Ollama 时）
 *       scripts/ai/run.sh generateStory.ts museum --model    # 优先连模型，失败自动兜底
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildStoryExemplars, STORY_SYSTEM_PROMPT, type StoryBackgroundDraft, type StoryExemplar } from "./storyCorpus";
import { findForbiddenWord } from "./copyScan";
import { chatJson, isModelAvailable, MODEL_INFO, type ChatMessage } from "./modelClient";
import type { Schema } from "./lib/miniSchema";

const here = dirname(fileURLToPath(import.meta.url));
const storySchema = JSON.parse(readFileSync(join(here, "schemas/storyBackground.schema.json"), "utf8")) as Schema;

export interface StoryRequest { arc: string; motifs: string[]; roomContext: string[]; title?: string }
export interface StoryResult { draft: StoryBackgroundDraft; source: "model" | "fallback" }

function copyScanClean(d: StoryBackgroundDraft): { clean: boolean; hit?: string } {
  for (const b of [d.title, d.premise, d.facilityLine, d.victoryLine]) {
    for (const s of [b?.zh, b?.en]) { const w = s && findForbiddenWord(s); if (w) return { clean: false, hit: w }; }
  }
  return { clean: true };
}

let _exemplars: StoryExemplar[] | null = null;
async function exemplars(): Promise<StoryExemplar[]> {
  if (_exemplars) return _exemplars;
  const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
  _exemplars = buildStoryExemplars(humanProtocolBasePack.levels).filter((e) => e.copyScanClean);
  return _exemplars;
}

/** model-free：按 arc 取官方双语范例兜底（保证合法、on-voice、干净）。 */
async function fallbackDraft(req: StoryRequest): Promise<StoryBackgroundDraft> {
  const ex = await exemplars();
  const match = ex.find((e) => e.arc === req.arc) ?? ex.find((e) => e.enDiffers) ?? ex[0];
  const base = match.draft;
  // 用请求的 title 覆盖（若给），其余沿用范例——确定性、可控。
  return { ...base, title: req.title ? { zh: req.title, en: base.title.en } : base.title, motifsUsed: req.motifs.length ? req.motifs : base.motifsUsed };
}

/** 连模型：story.v1.md + 2 条 few-shot + 请求 → schema/copy-scan 校验，脏/失败返回 null。 */
async function modelDraft(req: StoryRequest): Promise<StoryBackgroundDraft | null> {
  const ex = await exemplars();
  const shots = ex.filter((e) => e.enDiffers).slice(0, 2); // 真双语范例最佳
  const messages: ChatMessage[] = [{ role: "system", content: STORY_SYSTEM_PROMPT }];
  for (const s of shots) {
    messages.push({ role: "user", content: JSON.stringify({ arc: s.arc, motifs: s.draft.motifsUsed, roomContext: s.roomContext }) });
    messages.push({ role: "assistant", content: JSON.stringify(s.draft) });
  }
  messages.push({ role: "user", content: JSON.stringify({ arc: req.arc, motifs: req.motifs, roomContext: req.roomContext }) });

  const out = await chatJson<StoryBackgroundDraft>(messages, storySchema, { retries: 2 });
  if (!out) return null;
  if (!copyScanClean(out).clean) return null; // 模型混进禁词 → 视为失败
  return out;
}

export async function generateStory(req: StoryRequest, opts: { preferModel?: boolean } = {}): Promise<StoryResult> {
  if (opts.preferModel && (await isModelAvailable())) {
    const d = await modelDraft(req);
    if (d) return { draft: d, source: "model" };
  }
  return { draft: await fallbackDraft(req), source: "fallback" };
}

// ── CLI ──
if (process.argv[1]?.endsWith("generateStory.ts")) {
  const args = process.argv.slice(2);
  const arc = args.find((a) => !a.startsWith("--")) ?? "museum";
  const preferModel = args.includes("--model");
  const ex = await exemplars();
  const sample = ex.find((e) => e.arc === arc) ?? ex[0];
  const req: StoryRequest = { arc, motifs: sample.draft.motifsUsed, roomContext: sample.roomContext };

  if (preferModel) console.log(`(优先连模型：${MODEL_INFO.model} @ ${MODEL_INFO.base}，不可达则自动兜底)`);
  const { draft, source } = await generateStory(req, { preferModel });
  console.log(`\n🪶 双语故事（arc=${arc}，来源=${source === "model" ? "模型" : "model-free 兜底"}）`);
  const show = (k: string, b: { zh: string; en: string }) => { console.log(`  ${k}`); console.log(`    zh: ${b.zh}`); console.log(`    en: ${b.en}`); };
  show("title", draft.title); show("premise", draft.premise); show("facilityLine", draft.facilityLine); show("victoryLine", draft.victoryLine);
  console.log(`  motifs: ${draft.motifsUsed.join("、")}`);
  console.log(`\n  copy-scan: ${copyScanClean(draft).clean ? "✓ 干净" : "✗ " + copyScanClean(draft).hit}`);
}
