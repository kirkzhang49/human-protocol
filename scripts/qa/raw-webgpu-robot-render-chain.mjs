import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const repoRoot = process.cwd();
const officialLevelIds = ["level_01_maintenance_bay", "level_02_residential_simulation"];
const indexPath = path.join(repoRoot, "public/assets/human-protocol/raw-webgpu/assets-v1/index.json");

const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : null;
const publicRoot = path.join(repoRoot, "public", String(index?.publicBase ?? "").replace(/^\//, ""));
const failures = [];

const server = await createServer({
  root: repoRoot,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { getBuiltInLevelConfig } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { builderProjectFromBuiltInLevel } = await server.ssrLoadModule("/src/build/BuilderLevelImport.ts");
  const { builderRuntimeAssetIndexForProject } = await server.ssrLoadModule("/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts");

  console.log("Raw WebGPU robot render chain");
  console.log(
    "official builder JSON -> builderRuntimeAssetIndexForProject -> loadBuilderNativeRawModelLibrary -> assets-v1 first -> legacy fallback",
  );

  const modelKeys = new Set();
  for (const levelId of officialLevelIds) {
    const level = getBuiltInLevelConfig(levelId);
    const project = builderProjectFromBuiltInLevel(levelId);
    const rows = builderRuntimeAssetIndexForProject(level, project).filter(
      (entry) => entry.kind === "enemy" && entry.nativeRawEligible,
    );
    console.log(`\n${levelId}`);
    for (const row of rows) {
      modelKeys.add(row.modelKey);
      console.log(`  request ${row.modelKey} glb=${row.glbUrl ?? "none"}`);
    }
  }

  console.log("\nResolved enemy bundles");
  for (const modelKey of [...modelKeys].sort()) {
    const entry = index?.assets?.[modelKey];
    if (!entry || entry.status !== "ready") {
      failures.push(`${modelKey}: missing assets-v1 bundle`);
      console.log(`  ${modelKey}: missing assets-v1 bundle`);
      continue;
    }
    const materialPath = path.join(publicRoot, entry.material ?? "");
    const material = existsSync(materialPath) ? JSON.parse(readFileSync(materialPath, "utf8")) : null;
    const used = (material?.materials ?? []).map((item) => {
      const textures = item.textures ?? [];
      return `${item.name}:base=${countTextures(textures, "baseColor")}:pbr=${countAnyTexture(textures, [
        "normal",
        "metallicRoughness",
        "ao",
        "emissive",
      ])}`;
    });
    const baseCount = material?.baseColorTextures?.length ?? 0;
    const pbrCount = material?.materialTextures?.length ?? 0;
    const source = entry.source?.sourcePackId ?? "unknown";
    console.log(`  ${modelKey}: source=${source} baseColorTextures=${baseCount} materialTextures=${pbrCount}`);
    for (const line of used) console.log(`    ${line}`);
    if (baseCount <= 0 || !used.every((line) => /base=[1-9]/u.test(line))) {
      failures.push(`${modelKey}: selected bundle is missing enemy baseColor texture slots`);
    }
  }
} finally {
  await server.close();
}

if (failures.length > 0) {
  console.error("\nFAIL raw WebGPU robot render chain");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nPASS raw WebGPU robot render chain");

function countTextures(textures, semantic) {
  return textures.filter((texture) => texture.semantic === semantic && texture.present && texture.url).length;
}

function countAnyTexture(textures, semantics) {
  return textures.filter((texture) => semantics.includes(texture.semantic) && texture.present && texture.url).length;
}
