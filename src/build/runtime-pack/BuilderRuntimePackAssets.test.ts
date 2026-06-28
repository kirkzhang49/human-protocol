import { afterEach, describe, expect, it, vi } from "vitest";
import { RAW_WEBGPU_ASSET_SOURCES } from "../../render/raw-webgpu/contracts/RawWebGpuContracts";
import { loadBuilderRuntimePackAssets, loadRawWebGpuLevelAssetsOrRuntimePack } from "./BuilderRuntimePackAssets";
import { createMemoryRuntimePackBackend } from "./BuilderRuntimePackStore";
import { parseBuilderRuntimePackRequest, resolveBuilderRuntimePackRequest } from "./BuilderRuntimePackRequest";
import {
  BUILDER_RUNTIME_PACK_ENGINE_VERSION,
  type BuilderRuntimePackBakeMode,
  type BuilderRuntimePackRecord,
} from "./BuilderRuntimePackTypes";

vi.mock("../../render/raw-webgpu/RawWebGpuAssetLoader", () => ({
  loadRawWebGpuLevelAssets: vi.fn(async (levelId: string) => ({
    plan: {
      level: { id: levelId },
      rooms: [],
      instances: [],
      lights: [],
      visibilityScenarios: [],
    },
    geometryBuffer: new ArrayBuffer(8),
    robotAnimationBridge: null,
    cookedGltfLoaderManifest: null,
    source: RAW_WEBGPU_ASSET_SOURCES.compiledRaw,
  })),
}));

describe("BuilderRuntimePackAssets requested pack loading", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
  });

  it("falls back from a stale requested packId to the latest valid pack for the same level and mode", async () => {
    const backend = createMemoryRuntimePackBackend();
    const stale = packRecord("pack_stale", "level_cache_test", "project_a", "cooked-glb", {
      engineVersion: "hp.builder.raw-runtime-pack.v42",
      updatedAt: 10,
    });
    const fresh = packRecord("pack_fresh", "level_cache_test", "project_a", "cooked-glb", {
      updatedAt: 20,
    });
    await backend.put(stale);
    await backend.put(fresh);
    installWindowSearch("?pack=deep&packId=pack_stale");

    const loaded = await loadBuilderRuntimePackAssets("level_cache_test", { backend });

    expect(loaded).not.toBeNull();
    expect(loaded?.plan.level.id).toBe("level_cache_test");
    expect(loaded?.geometryBuffer).toBe(fresh.geometryBuffer);
    expect(loaded?.source).toBe(RAW_WEBGPU_ASSET_SOURCES.builderRuntimePackCookedGlb);
  });

  it("does not cross modes when a deep URL points at a fast pack", async () => {
    const backend = createMemoryRuntimePackBackend();
    const fast = packRecord("pack_fast", "level_cache_test", "project_a", "proxy", {
      updatedAt: 20,
    });
    await backend.put(fast);
    installWindowSearch("?pack=deep&packId=pack_fast");

    const loaded = await loadBuilderRuntimePackAssets("level_cache_test", { backend });

    expect(loaded).toBeNull();
  });

  it("reports why a requested pack fell back to a valid same-mode pack", async () => {
    const backend = createMemoryRuntimePackBackend();
    await backend.put(packRecord("pack_wrong_level", "level_other", "project_a", "cooked-glb", { updatedAt: 30 }));
    const fresh = packRecord("pack_fresh", "level_cache_test", "project_a", "cooked-glb", { updatedAt: 20 });
    await backend.put(fresh);

    const resolved = await resolveBuilderRuntimePackRequest(
      parseBuilderRuntimePackRequest("?pack=deep&packId=pack_wrong_level", "level_cache_test"),
      backend,
    );

    expect(resolved.status).toBe("fallback");
    expect(resolved.reason).toBe("level-mismatch");
    expect(resolved.record?.packId).toBe("pack_fresh");
  });

  it("rejects records that do not match the config metadata hash", async () => {
    const backend = createMemoryRuntimePackBackend();
    await backend.put(packRecord("pack_stale_config", "level_cache_test", "project_a", "cooked-glb", {
      configHash: "old-config",
      updatedAt: 20,
    }));

    const resolved = await resolveBuilderRuntimePackRequest({
      levelId: "level_cache_test",
      bakeMode: "cooked-glb",
      configHash: "new-config",
    }, backend);

    expect(resolved.status).toBe("miss");
    expect(resolved.reason).toBe("no-valid-pack");
    expect(resolved.record).toBeNull();
  });

  it("prefers a requested builder pack over static raw assets for generated official-level playtests", async () => {
    const backend = createMemoryRuntimePackBackend();
    const builderPack = packRecord("pack_builder_level4", "level_04_memory_clinic", "project_level4", "proxy", {
      updatedAt: 40,
    });
    await backend.put(builderPack);
    installWindowSearch("?pack=fast&packId=pack_builder_level4");

    const loaded = await loadRawWebGpuLevelAssetsOrRuntimePack("level_04_memory_clinic", { backend });

    expect(loaded.source).toBe(RAW_WEBGPU_ASSET_SOURCES.builderRuntimePack);
    expect(loaded.geometryBuffer).toBe(builderPack.geometryBuffer);
    expect(loaded.plan).toBe(builderPack.renderPlan);
  });

  it("rewrites persisted story-painting texture blobs into loadable runtime URLs", async () => {
    const backend = createMemoryRuntimePackBackend();
    const builderPack = packRecord("pack_story_textures", "level_story", "project_story", "proxy", {
      updatedAt: 50,
    });
    builderPack.renderPlan = {
      level: { id: "level_story" },
      rooms: [],
      instances: [],
      lights: [],
      visibilityScenarios: [],
      geometry: {
        binaryFile: "story.bin",
        vertexStrideFloats: 16,
        assets: [],
        baseColorTextures: [
          {
            page: 0,
            layer: 7,
            url: "builder-pack://texture/0/7",
            mimeType: "image/png",
            name: "prop:l4_story_awakened_machine_image2_v1:story-painting",
          },
        ],
      },
    };
    builderPack.textureBlobs = [
      {
        page: 0,
        layer: 7,
        mimeType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]).buffer,
        name: "prop:l4_story_awakened_machine_image2_v1:story-painting",
      },
    ];
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:story-painting-art");
    await backend.put(builderPack);
    installWindowSearch("?pack=fast&packId=pack_story_textures");

    const loaded = await loadBuilderRuntimePackAssets("level_story", { backend });

    expect(loaded?.plan.geometry?.baseColorTextures?.[0]?.url).toBe("blob:story-painting-art");
  });
});

function installWindowSearch(search: string) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search },
    },
  });
}

function packRecord(
  packId: string,
  levelId: string,
  projectId: string,
  bakeMode: BuilderRuntimePackBakeMode,
  overrides: {
    engineVersion?: string;
    updatedAt?: number;
    configHash?: string;
  } = {},
): BuilderRuntimePackRecord {
  const engineVersion = overrides.engineVersion ?? BUILDER_RUNTIME_PACK_ENGINE_VERSION;
  return {
    packId,
    projectId,
    projectHash: `${projectId}:hash`,
    configHash: overrides.configHash,
    engineVersion,
    levelId,
    createdAt: overrides.updatedAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    manifest: {
      schemaVersion: engineVersion as typeof BUILDER_RUNTIME_PACK_ENGINE_VERSION,
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
    renderPlan: {
      level: { id: levelId },
      rooms: [],
      instances: [],
      lights: [],
      visibilityScenarios: [],
    },
    geometryBuffer: new ArrayBuffer(4),
    diagnostics: [],
    sizeBytes: 4,
  };
}
