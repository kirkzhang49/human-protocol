/**
 * 双语故事 gold 抽取器（Phase 0，model-free）。
 *
 * 从 10 关官方关 + LevelLocalization 抽出**中英文并列**的故事样本：
 *   → data/ai/train/story.exemplars.json  （few-shot 范例 + model-free 兜底素材池）
 *   → data/ai/train/story.jsonl           （§12 的 SFT messages 格式，将来 LoRA 用）
 * 一份数据两用：现在当 few-shot，将来当微调 gold。全程零模型、copy-scan 双语校验。
 *
 * Run:  scripts/ai/run.sh storyCorpus.ts
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { LevelDefinition } from "../../src/game/config/schema/levelConfig";
import { localizedLevelTitle, localizedExit, localizedDialogue } from "../../src/game/config/LevelLocalization";
import { extractConfigCard } from "./extractConfigCard";
import { classify } from "./classifyRules";
import { findForbiddenWord } from "./copyScan";

export interface Bilingual { zh: string; en: string }
export interface StoryBackgroundDraft {
  title: Bilingual; premise: Bilingual; facilityLine: Bilingual; victoryLine: Bilingual; motifsUsed: string[];
}
export interface StoryExemplar {
  levelId: string; arc: string; roomContext: string[]; draft: StoryBackgroundDraft;
  enDiffers: boolean; copyScanClean: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
export const STORY_SYSTEM_PROMPT = readFileSync(join(here, "prompts/story.v1.md"), "utf8");

function bi(level: LevelDefinition, pick: (l: LevelDefinition) => string): Bilingual {
  const zh = pick(level) ?? "";
  // EN：用 localized* 的英文覆盖；下面针对各字段单独取。
  return { zh, en: zh };
}

function extractDraft(level: LevelDefinition): { draft: StoryBackgroundDraft; enDiffers: boolean } {
  const title: Bilingual = { zh: localizedLevelTitle(level, "zh"), en: localizedLevelTitle(level, "en") };
  const exitEn = localizedExit(level, "en");
  const victoryLine: Bilingual = { zh: level.exit.victoryMessage ?? "", en: exitEn.victoryMessage ?? level.exit.victoryMessage ?? "" };

  const sys = (level.dialogues ?? []).find((d) => d.tone === "system");
  const reveal = (level.dialogues ?? []).find((d) => d.tone === "reveal");
  const facilityLine: Bilingual = sys
    ? { zh: sys.line, en: localizedDialogue(level, sys, "en").line }
    : { zh: level.exit.unlockMessage ?? "", en: exitEn.unlockMessage ?? level.exit.unlockMessage ?? "" };
  const premise: Bilingual = reveal
    ? { zh: reveal.line, en: localizedDialogue(level, reveal, "en").line }
    : { zh: level.exit.transitionMessage ?? "", en: exitEn.transitionMessage ?? level.exit.transitionMessage ?? "" };

  const card = extractConfigCard(level);
  const draft: StoryBackgroundDraft = { title, premise, facilityLine, victoryLine, motifsUsed: card.visualStory.motifsHit };
  const enDiffers = [title, premise, facilityLine, victoryLine].some((b) => b.en && b.en !== b.zh);
  return { draft, enDiffers };
}

export function buildStoryExemplars(levels: readonly LevelDefinition[]): StoryExemplar[] {
  return levels
    .filter((l) => l.id.startsWith("level_"))
    .map((level) => {
      const card = extractConfigCard(level);
      const { draft, enDiffers } = extractDraft(level);
      const allStrings = [draft.title, draft.premise, draft.facilityLine, draft.victoryLine].flatMap((b) => [b.zh, b.en]);
      const copyScanClean = allStrings.every((s) => !findForbiddenWord(s));
      return {
        levelId: level.id,
        arc: classify(card).arc,
        roomContext: card.roomsGraph.rooms.map((r) => r.label),
        draft,
        enDiffers,
        copyScanClean,
      };
    });
}

/** SFT 训练样本（messages 格式，§12）。仅 copy-scan 干净的入集。 */
function toSftRecord(ex: StoryExemplar) {
  return {
    task: "story",
    messages: [
      { role: "system", content: STORY_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ arc: ex.arc, motifs: ex.draft.motifsUsed, roomContext: ex.roomContext }) },
      { role: "assistant", content: JSON.stringify(ex.draft) },
    ],
    meta: { levelId: ex.levelId, source: "gold", lang: "zh+en", enDiffers: ex.enDiffers, copyScanClean: ex.copyScanClean },
  };
}

// ── CLI ──
if (process.argv[1]?.endsWith("storyCorpus.ts")) {
  const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
  const exemplars = buildStoryExemplars(humanProtocolBasePack.levels);
  const clean = exemplars.filter((e) => e.copyScanClean);
  const bilingual = exemplars.filter((e) => e.enDiffers);

  mkdirSync("data/ai/train", { recursive: true });
  writeFileSync("data/ai/train/story.exemplars.json", JSON.stringify(exemplars, null, 2));
  writeFileSync("data/ai/train/story.jsonl", clean.map((e) => JSON.stringify(toSftRecord(e))).join("\n") + "\n");

  console.log(`双语故事 gold：${exemplars.length} 关  （copy-scan 干净 ${clean.length}，真双语EN ${bilingual.length}）`);
  for (const e of exemplars) {
    console.log(`\n[${e.arc}] ${e.levelId}${e.copyScanClean ? "" : "  ⚠禁词"}${e.enDiffers ? "" : "  (EN 缺失/同中文)"}`);
    console.log(`  title    zh: ${e.draft.title.zh}   en: ${e.draft.title.en}`);
    console.log(`  victory  zh: ${e.draft.victoryLine.zh}`);
    console.log(`           en: ${e.draft.victoryLine.en}`);
  }
  console.log(`\n✓ 写出 data/ai/train/story.exemplars.json（few-shot/兜底素材）+ story.jsonl（SFT，${clean.length} 条）`);
}
