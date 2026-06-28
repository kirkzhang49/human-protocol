#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const levelId = process.argv[2];

if (!levelId) {
  console.log(JSON.stringify({ ok: false, error: "levelId is required" }, null, 2));
  process.exit(0);
}

const server = await createServer({
  root: PKG_ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

try {
  const { humanProtocolBasePack } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { validateLevelConfig } = await server.ssrLoadModule("/src/game/config/ConfigValidator.ts");
  const level = humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId);
  if (!level) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: `No built-in level found for ${levelId}`,
          availableLevelIds: humanProtocolBasePack.levels.map((candidate) => candidate.id),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  const report = validateLevelConfig(level);
  const errors = report.errors ?? [];
  const warnings = report.warnings ?? [];
  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        levelId,
        title: level.title,
        counts: {
          rooms: level.map?.rooms?.length ?? 0,
          doors: level.map?.doors?.length ?? 0,
          interactions: level.map?.interactions?.length ?? 0,
          puzzles: level.puzzles?.length ?? 0,
          waves: level.waves?.length ?? 0,
          objectives: level.objectiveChain?.length ?? 0,
        },
        errorCount: errors.length,
        warningCount: warnings.length,
        errors,
        warnings,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
