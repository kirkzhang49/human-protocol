// i18n coverage QA — fails if any campaign level still renders Chinese in English mode.
//
// The game is Chinese-primary; English is produced at render time. Structured copy
// (title/exit/flow/objectives/dialogues/waves/choices/articles/quizzes) is translated
// by the localized* helpers via englishByLevel; inline strings (door labels, lock
// messages, puzzle/switch/bigscreen/pickup text, reward pulses, spawn labels, etc.)
// are translated by localizedConfigText via the per-level + common text dictionaries.
//
// This script loads every campaign level the way the UI does and reports any English
// output that still contains CJK characters. Run: npm run i18n:qa
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CJK = /[㐀-鿿豈-﫿]/;

function hasCjk(value) {
  return typeof value === "string" && CJK.test(value);
}

// Config keys whose string values never reach the player UI (builder-only or
// geometry/authoring metadata). They are excluded from the inline coverage walk.
// `props`/`rooms` carry 3D placement labels shown only in the /build inspector;
// environmentStates[].label is looked up by id and never displayed.
const NON_RENDERED_KEYS = new Set(["authoringMetadata", "props", "rooms"]);

// Recursively collect every string value reachable from `node`.
function collectStrings(node, out, skipBuilderOnly = false) {
  if (node == null) return out;
  if (typeof node === "string") {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out, skipBuilderOnly);
    return out;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (skipBuilderOnly && NON_RENDERED_KEYS.has(key)) continue;
      collectStrings(value, out, skipBuilderOnly);
    }
  }
  return out;
}

async function main() {
  const server = await createServer({
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
    root: repoRoot,
  });

  const leaks = [];
  try {
    const [{ humanProtocolBasePack }, loc] = await Promise.all([
      server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
      server.ssrLoadModule("/src/game/config/LevelLocalization.ts"),
    ]);

    const levelsById = new Map(humanProtocolBasePack.levels.map((lv) => [lv.id, lv]));

    for (const levelId of humanProtocolBasePack.campaignLevelIds) {
      const level = levelsById.get(levelId);
      if (!level) continue;
      const levelLeaks = [];
      const safe = (fn) => {
        try {
          return fn();
        } catch {
          return undefined;
        }
      };

      // Structured fields are translated by the localized* helpers via englishByLevel
      // (NOT by configText). We check those exact fields directly and exclude their
      // source zh from the inline pass — so a structured leak can only be fixed in
      // englishByLevel, never masked by a stray text-dict entry. `structuredFieldZh`
      // is every zh value that lives in a structured field (covered or not).
      const structuredFieldZh = new Set();
      // Check a structured helper's specific field values for CJK; record sources.
      const checkFields = (sourceVals, outputVals) => {
        for (const v of sourceVals) if (hasCjk(v)) structuredFieldZh.add(v);
        for (const v of outputVals) if (hasCjk(v)) levelLeaks.push({ zh: v, en: v, structured: true });
      };

      const title = level.title;
      checkFields([title], [safe(() => loc.localizedLevelTitle(level, "en"))]);

      const exitFields = (e) =>
        e ? [e.unlockedLabel, e.distanceLabel, e.unlockMessage, e.transitionMessage, e.victoryMessage] : [];
      checkFields(exitFields(level.exit), exitFields(safe(() => loc.localizedExit(level, "en"))));

      // flow is fully structured.
      checkFields(collectStrings(level.presentation.flow, []), collectStrings(safe(() => loc.localizedFlow(level, "en")), []));

      const objFields = (o) => (o ? [o.title, o.detail, o.progressLabel, o.progressText] : []);
      for (const key of Object.keys(level.presentation.objectives ?? {})) {
        checkFields(objFields(level.presentation.objectives[key]), objFields(safe(() => loc.localizedPresentationObjective(level, key, "en"))));
      }
      const chainFields = (o) => (o ? [o.title, o.detail, o.hudLabel] : []);
      for (const objective of level.objectiveChain ?? []) {
        checkFields(chainFields(objective), chainFields(safe(() => loc.localizedObjective(level, objective, "en"))));
      }
      const waveFields = (w) =>
        w ? [w.label, w.objectiveTitle, w.objectiveDetail, w.startMessage, w.startWarning?.label, w.startWarning?.detail] : [];
      // Wave presentation lives in presentation.waves (WavePresentationDefinition[]),
      // rendered via localizedWavePresentation (englishByLevel.waves) — NOT configText.
      for (const p of level.presentation?.waves ?? []) {
        if (p && typeof p === "object" && "id" in p) {
          checkFields(waveFields(p), waveFields(safe(() => loc.localizedWavePresentation(level, p, "en"))));
        }
      }
      const dialogueFields = (d) => (d ? [d.speaker, d.line] : []);
      for (const dialogue of level.dialogues ?? []) {
        checkFields(dialogueFields(dialogue), dialogueFields(safe(() => loc.localizedDialogue(level, dialogue, "en"))));
      }
      const choiceFields = (c) =>
        c ? [c.systemLabel, c.title, c.detail, ...(c.options ?? []).flatMap((o) => [o.label, o.detail])] : [];
      for (const choice of level.choices ?? []) {
        checkFields(choiceFields(choice), choiceFields(safe(() => loc.localizedChoice(level, choice, "en"))));
      }
      const articleFields = (a) =>
        a ? [a.systemLabel, a.title, a.subtitle, ...(a.pages ?? []).map((p) => p.body)] : [];
      for (const article of level.articles ?? []) {
        checkFields(articleFields(article), articleFields(safe(() => loc.localizedArticle(level, article, "en"))));
      }
      const quizFields = (q) =>
        q
          ? [q.systemLabel, q.title, q.question, q.detail, q.wrongAnswer?.message, q.correctAnswer?.message, ...(q.options ?? []).flatMap((o) => [o.label, o.detail])]
          : [];
      for (const quiz of level.quizzes ?? []) {
        checkFields(quizFields(quiz), quizFields(safe(() => loc.localizedQuiz(level, quiz, "en"))));
      }

      // Inline pass: every remaining CJK config string must resolve via configText.
      // Skip structured-field zh (judged above) and builder-only/geometry subtrees.
      const seen = new Set();
      for (const s of collectStrings(level, [], true)) {
        if (!hasCjk(s) || seen.has(s) || structuredFieldZh.has(s)) continue;
        seen.add(s);
        const en = loc.localizedConfigText(level, "en", s);
        if (hasCjk(en)) levelLeaks.push({ zh: s, en });
      }

      if (levelLeaks.length > 0) {
        leaks.push({ levelId, levelLeaks });
      }
    }
  } finally {
    await server.close();
  }

  if (leaks.length === 0) {
    console.log("i18n coverage OK — every campaign level renders clean English.");
    process.exit(0);
  }

  console.error("i18n coverage FAILED — Chinese leaks in English mode:\n");
  let total = 0;
  for (const { levelId, levelLeaks } of leaks) {
    console.error(`  ${levelId}: ${levelLeaks.length} leak(s)`);
    for (const leak of levelLeaks) {
      total += 1;
      const tag = leak.structured ? "[structured→englishByLevel] " : "";
      console.error(`    ${tag}${leak.zh}  ->  ${leak.en}`);
    }
  }
  console.error(`\nTotal: ${total} leak(s) across ${leaks.length} level(s).`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
