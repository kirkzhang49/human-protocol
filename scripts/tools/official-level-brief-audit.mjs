// Read-only official-level brief audit.
//
// Reads the live official config pack + builder asset registry and reports, per
// campaign level, whether it has an exit / puzzle / story / combat, whether it
// references assets the environment registry can't resolve, and whether it is
// expressible by the current /build editor (so it could be rebuilt there). It
// never mutates config, never touches runtime logic, and writes only a JSON
// snapshot under .tmp/ for downstream AI level briefs.
//
// Run: node scripts/tools/official-level-brief-audit.mjs
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

// Puzzle .type values the /build editor can currently emit (BuilderPuzzleKind →
// compiled puzzle type). code_lock + tool_calibration are NOT buildable yet.
const BUILDABLE_PUZZLE_TYPES = new Set([
  "hit_sequence", // color_sequence
  "circuit_grid",
  "surveillance_match",
  "valve_matrix",
  "archive_merge",
  "gallery_reading",
]);

// HARD blockers: gameplay the /build editor cannot author AND that a faithful
// rebuild needs (no clean way to drop them). These gate a true /build rebuild.
const HARD_BLOCKER_FEATURES = ["bossPhases", "choices", "quizzes"];
// SOFT/optional: present in official configs but droppable on a /build rebuild
// (campaign meta + atmosphere/hint polish). Reported, but don't block rebuild.
const SOFT_FEATURES = ["campaignRoutes", "environmentStates", "bigScreens"];

const server = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });

try {
  const { humanProtocolBasePack } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { validateLevelConfig } = await server.ssrLoadModule("/src/game/config/ConfigValidator.ts");
  const { isEnvironmentModelKey } = await server.ssrLoadModule("/src/assets/environmentModelAssets.ts");
  const { builderPropCatalog } = await server.ssrLoadModule("/src/build/BuilderAssetCatalog.ts");
  const builderModelKeys = new Set(builderPropCatalog.map((entry) => entry.modelKey));

  const levelsById = new Map(humanProtocolBasePack.levels.map((level) => [level.id, level]));
  const rows = [];

  for (const levelId of humanProtocolBasePack.campaignLevelIds) {
    const level = levelsById.get(levelId);
    if (!level) {
      rows.push({ levelId, error: "level not found in pack" });
      continue;
    }
    const map = level.map ?? {};
    const props = map.props ?? [];
    const interactions = map.interactions ?? [];
    const puzzles = level.puzzles ?? [];
    const report = validateLevelConfig(level);

    const exitInteraction = interactions.find((i) => i.type === "exit");
    const hasExit = Boolean(level.exit) && (Boolean(exitInteraction) || Array.isArray(level.exit?.position));
    const exitErrors = report.errors.filter((e) => e.code.startsWith("map.exit") || e.code.startsWith("graph.exit"));

    const puzzleTypes = [...new Set(puzzles.map((p) => p.type))];
    const hasPuzzle = puzzles.length > 0;

    const storyProps = props.filter((p) => (p.tags ?? []).some((t) => /story|clue|painting|evidence|photo/i.test(t)));
    const storySignals = {
      articles: (level.articles ?? []).length,
      decals: (map.decals ?? []).length,
      storyProps: storyProps.length,
      storyPickups: (level.pickups?.storyPickups ?? []).length,
      victoryLine: Boolean(level.exit?.victoryMessage),
      dialogues: (level.dialogues ?? []).length,
    };
    const hasStory =
      storySignals.articles > 0 || storySignals.decals > 0 || storySignals.storyProps > 0 || storySignals.storyPickups > 0 || storySignals.victoryLine;

    const hasCombat = (level.waves ?? []).length > 0 || (level.spawnGroups ?? []).length > 0;

    const unresolvedAssets = props
      .filter((p) => p.modelKey && !isEnvironmentModelKey(p.modelKey) && !builderModelKeys.has(p.modelKey))
      .map((p) => p.modelKey);
    const uniqueUnresolved = [...new Set(unresolvedAssets)];

    const hardFeatures = HARD_BLOCKER_FEATURES.filter((f) => Array.isArray(level[f]) && level[f].length > 0);
    const softFeatures = SOFT_FEATURES.filter((f) => Array.isArray(level[f]) && level[f].length > 0);
    const nonBuildablePuzzleTypes = puzzleTypes.filter((t) => !BUILDABLE_PUZZLE_TYPES.has(t));
    const genericSwitches = (level.switches ?? []).filter((sw) => {
      const inter = interactions.find((i) => i.id === sw.interactionId);
      return !inter?.consumesKeyItemId; // route switches are key-gated; others aren't /build-authored
    });
    const buildBlockers = [
      ...hardFeatures,
      ...(nonBuildablePuzzleTypes.length ? [`puzzleType:${nonBuildablePuzzleTypes.join("/")}`] : []),
      ...(genericSwitches.length ? [`genericSwitch:${genericSwitches.length}`] : []),
    ];
    const buildExpressible = buildBlockers.length === 0;
    const droppedForRebuild = [...softFeatures];

    rows.push({
      levelId,
      title: level.title,
      validator: { ok: report.ok, errors: report.errors.length, warnings: report.warnings.length },
      hasExit,
      exitOk: exitErrors.length === 0,
      hasPuzzle,
      puzzleTypes,
      hasStory,
      storySignals,
      hasCombat,
      waves: (level.waves ?? []).length,
      rooms: (map.rooms ?? []).length,
      doors: (map.doors ?? []).length,
      unresolvedAssetCount: uniqueUnresolved.length,
      unresolvedAssets: uniqueUnresolved.slice(0, 8),
      buildExpressible,
      buildBlockers,
      droppedForRebuild,
    });
  }

  const yn = (b) => (b ? "✅" : "❌");
  console.log("Human Protocol — official level brief audit\n");
  for (const r of rows) {
    if (r.error) {
      console.log(`■ ${r.levelId}: ${r.error}`);
      continue;
    }
    console.log(`■ ${r.levelId} — ${r.title}`);
    console.log(
      `   exit ${yn(r.hasExit && r.exitOk)}  puzzle ${yn(r.hasPuzzle)} [${r.puzzleTypes.join(",") || "none"}]  story ${yn(r.hasStory)}  combat ${yn(r.hasCombat)} (${r.waves}w)  rooms=${r.rooms} doors=${r.doors}`,
    );
    console.log(
      `   validator ok=${yn(r.validator.ok)} (${r.validator.errors}e/${r.validator.warnings}w)  unresolved-assets=${r.unresolvedAssetCount}${r.unresolvedAssetCount ? " [" + r.unresolvedAssets.join(", ") + "]" : ""}`,
    );
    console.log(
      `   /build rebuildable ${yn(r.buildExpressible)}${r.buildBlockers.length ? "  hard-blockers: " + r.buildBlockers.join(", ") : ""}${r.droppedForRebuild.length ? "  drop-on-rebuild: " + r.droppedForRebuild.join(", ") : ""}`,
    );
  }

  const buildable = rows.filter((r) => r.buildExpressible && !r.error).map((r) => r.levelId);
  console.log(`\nSummary: ${buildable.length}/${rows.length} levels rebuildable in /build after dropping optional polish: ${buildable.join(", ") || "none"}`);
  console.log("(hard-blockers need engine/editor support; drop-on-rebuild = campaign meta / atmosphere / hint screens a rebuild can omit.)");

  const outPath = path.join(process.cwd(), ".tmp/official-room-redesign/official-level-audit.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2) + "\n");
  console.log(`\nwrote ${outPath}`);
} finally {
  await server.close();
}
