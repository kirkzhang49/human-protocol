#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const inputPath = process.argv[2];

if (!inputPath) {
  console.log(JSON.stringify({ ok: false, error: "projectPath is required" }, null, 2));
  process.exit(0);
}

const absPath = resolve(PKG_ROOT, inputPath);
if (!absPath.startsWith(`${PKG_ROOT}/`)) {
  console.log(JSON.stringify({ ok: false, error: `Path escapes repo: ${inputPath}` }, null, 2));
  process.exit(0);
}

const raw = await readFile(absPath, "utf8");
const parsed = JSON.parse(raw);
const project = parsed.project && parsed.schemaVersion?.startsWith("hp.official.builder.") ? parsed.project : parsed;

const server = await createServer({
  root: PKG_ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

try {
  const { compileBuilderProjectToLevel } = await server.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts");
  const { validateLevelConfig } = await server.ssrLoadModule("/src/game/config/ConfigValidator.ts");
  const compileResult = compileBuilderProjectToLevel(project);
  const level = compileResult.level ?? null;
  const validationReport = level ? validateLevelConfig(level, { authoringProfile: "generated" }) : null;
  const errors = validationReport?.errors ?? [];
  const warnings = validationReport?.warnings ?? [];
  console.log(
    JSON.stringify(
      {
        ok: Boolean(level) && (compileResult.issues?.length ?? 0) === 0 && errors.length === 0,
        inputPath,
        sourceKind: parsed.project ? "official-builder-document" : "builder-project",
        projectId: project.projectId ?? null,
        projectTitle: project.title ?? null,
        levelId: level?.id ?? null,
        levelTitle: level?.title ?? null,
        compileIssueCount: compileResult.issues?.length ?? 0,
        compileIssues: compileResult.issues ?? [],
        validation: validationReport
          ? {
              errorCount: errors.length,
              warningCount: warnings.length,
              errors,
              warnings,
            }
          : null,
        counts: level
          ? {
              rooms: level.map?.rooms?.length ?? 0,
              doors: level.map?.doors?.length ?? 0,
              interactions: level.map?.interactions?.length ?? 0,
              puzzles: level.puzzles?.length ?? 0,
              waves: level.waves?.length ?? 0,
              objectives: level.objectiveChain?.length ?? 0,
            }
          : null,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
