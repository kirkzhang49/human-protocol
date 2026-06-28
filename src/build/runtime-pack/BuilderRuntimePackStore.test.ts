import { describe, expect, it } from "vitest";
import {
  clearBuilderRuntimePacksForLevel,
  clearBuilderRuntimePacksForProject,
  createMemoryRuntimePackBackend,
  hasBuilderRuntimePackForLevel,
  loadLatestBuilderRuntimePackForLevel,
} from "./BuilderRuntimePackStore";
import {
  BUILDER_RUNTIME_PACK_ENGINE_VERSION,
  type BuilderRuntimePackBakeMode,
  type BuilderRuntimePackRecord,
} from "./BuilderRuntimePackTypes";

describe("BuilderRuntimePackStore scoped cleanup", () => {
  it("invalidates cached packs after builder wave-chain compilation semantics changed", () => {
    expect(BUILDER_RUNTIME_PACK_ENGINE_VERSION).toBe("hp.builder.raw-runtime-pack.v69");
  });

  it("deletes only the requested bake mode for a project", async () => {
    const backend = createMemoryRuntimePackBackend();
    await backend.put(packRecord("pack_fast", "project_a", "level_a", "proxy"));
    await backend.put(packRecord("pack_deep", "project_a", "level_a", "cooked-glb"));
    await backend.put(packRecord("pack_other", "project_b", "level_b", "proxy"));

    const cleanup = await clearBuilderRuntimePacksForProject("project_a", "proxy", backend);

    expect(cleanup.deletedRecords).toBe(1);
    expect(await backend.get("pack_fast")).toBeNull();
    expect(await backend.get("pack_deep")).not.toBeNull();
    expect(await backend.get("pack_other")).not.toBeNull();
  });

  it("deletes stale records for the requested level across projects", async () => {
    const backend = createMemoryRuntimePackBackend();
    await backend.put(packRecord("pack_project_a", "project_a", "level_shared", "proxy"));
    await backend.put(packRecord("pack_project_b", "project_b", "level_shared", "proxy"));
    await backend.put(packRecord("pack_deep", "project_b", "level_shared", "cooked-glb"));
    await backend.put(packRecord("pack_other_level", "project_c", "level_other", "proxy"));

    const cleanup = await clearBuilderRuntimePacksForLevel("level_shared", "proxy", backend);

    expect(cleanup.deletedRecords).toBe(2);
    expect(await backend.get("pack_project_a")).toBeNull();
    expect(await backend.get("pack_project_b")).toBeNull();
    expect(await backend.get("pack_deep")).not.toBeNull();
    expect(await backend.get("pack_other_level")).not.toBeNull();
  });

  it("does not load stale engine-version records as latest packs", async () => {
    const backend = createMemoryRuntimePackBackend();
    const stale = packRecord("pack_stale", "project_a", "level_a", "proxy");
    stale.engineVersion = "hp.builder.raw-runtime-pack.v31";
    stale.manifest.schemaVersion = "hp.builder.raw-runtime-pack.v31" as typeof BUILDER_RUNTIME_PACK_ENGINE_VERSION;
    await backend.put(stale);

    await expect(loadLatestBuilderRuntimePackForLevel("level_a", backend, "proxy")).resolves.toBeNull();
  });

  it("checks availability against the requested bake mode", async () => {
    const backend = createMemoryRuntimePackBackend();
    await backend.put(packRecord("pack_fast", "project_a", "level_a", "proxy"));

    await expect(hasBuilderRuntimePackForLevel("level_a", { bakeMode: "cooked-glb" }, backend)).resolves.toBe(false);
    await expect(hasBuilderRuntimePackForLevel("level_a", { bakeMode: "proxy" }, backend)).resolves.toBe(true);
  });

  it("does not treat a missing exact packId as available when there is no fallback", async () => {
    const backend = createMemoryRuntimePackBackend();

    await expect(hasBuilderRuntimePackForLevel("level_a", { packId: "pack_missing", bakeMode: "cooked-glb" }, backend)).resolves.toBe(false);
  });
});

function packRecord(
  packId: string,
  projectId: string,
  levelId: string,
  bakeMode: BuilderRuntimePackBakeMode,
): BuilderRuntimePackRecord {
  return {
    packId,
    projectId,
    projectHash: `${projectId}:hash`,
    engineVersion: BUILDER_RUNTIME_PACK_ENGINE_VERSION,
    levelId,
    createdAt: 1,
    updatedAt: 1,
    manifest: {
      schemaVersion: BUILDER_RUNTIME_PACK_ENGINE_VERSION,
      levelId,
      title: levelId,
      bakeMode,
      counts: {
        rooms: 0,
        walls: 0,
        doors: 0,
        props: 0,
        markers: 0,
        robots: 0,
        materials: 0,
        lights: 0,
        instances: 0,
        vertices: 0,
        triangles: 0,
      },
      cookedModels: [],
      textureFallbackModels: [],
      nativeRawModels: [],
      nativeRawEnemyModels: [],
      nativeRawFurnitureModels: [],
      wgpuResources: [],
      cookedMaterials: 0,
      transparentMaterials: 0,
      missingModels: [],
      fallbackProxyModels: [],
      bakeDurationMs: 0,
      geometryBytes: 4,
      textureBytes: 0,
      assetVersionHash: "",
      enemyAnimationMode: "static",
    },
    renderPlan: { schemaVersion: "test", levelId, instances: [], lights: [], materials: [] } as never,
    geometryBuffer: new ArrayBuffer(4),
    diagnostics: [],
    sizeBytes: 4,
  };
}
