import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuilderProject } from "../BuilderTypes";
import { defaultPropElevation } from "../BuilderAssetCatalog";
import { compileBuilderProjectToLevel } from "../compileBuilderProjectToLevel";
import { rawMaterialFloatsFor, RAW_MATERIAL_FLOATS } from "../../render/raw-webgpu/RawWebGpuMaterialPipeline";
import { builderDeepModelRequestsForAssetIndex, builderNativeRawRequestsForAssetIndex, builderRuntimeAssetIndexForProject } from "./BuilderRuntimeAssetIndex";
import { createMemoryRuntimePackBackend } from "./BuilderRuntimePackStore";
import { collectExternalBuilderRuntimeTextureBlobs, compileBuilderRuntimePack, type BuilderNativeRawModelLibrary } from "./compileBuilderRuntimePack";
import { generateBuilderPlaytestPack } from "./generateBuilderPlaytestPack";
import type { CookedGlbLibrary } from "./cookGlbModels";

const L4_STORY_PAINTING_KEYS = [
  "l4_story_awakened_machine_image2_v1",
  "l4_story_preserved_childhood_image2_v1",
  "l4_story_rescue_loop_image2_v1",
  "l4_story_h0_discharge_image2_v1",
] as const;

function storyPaintingProject(modelKeys: readonly string[] = ["l4_story_awakened_machine_image2_v1"]): BuilderProject {
  return {
    schemaVersion: "hp.builder.v1",
    projectId: "proj_story_painting_pack",
    title: "Story Painting Runtime Pack",
    rooms: [
      { id: "room_spawn", label: "记忆展间", style: "museum", center: [0, 0], size: [8, 7] },
      { id: "room_exit", label: "出口间", style: "exit", center: [0, 6], size: [6, 5] },
    ],
    doors: [{ id: "door_exit", fromRoomId: "room_spawn", toRoomId: "room_exit", lockType: "none" }],
    props: modelKeys.map((modelKey, index) => ({
      id: `story_${index}`,
      modelKey,
      roomId: "room_spawn",
      position: [-2.4 + index * 1.6, -2.4],
      rotationY: 0,
      scale: 1,
    })),
    robots: [],
    exitRoomId: "room_exit",
  };
}

describe("builder story painting runtime pack", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bakes Image2 story art as a textured raw asset for 3D playtest", () => {
    const project = storyPaintingProject();
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const pack = compileBuilderRuntimePack(level!, project);
    const asset = pack.renderPlan.geometry.assets.find((candidate) => candidate.modelKey === "l4_story_awakened_machine_image2_v1");
    const material = pack.renderPlan.geometry.materials?.find(
      (candidate) => candidate.name === "story-painting-art:l4_story_awakened_machine_image2_v1",
    );
    const texture = pack.renderPlan.geometry.baseColorTextures?.find(
      (candidate) => candidate.name === "prop:l4_story_awakened_machine_image2_v1:story-painting",
    );

    expect(asset?.vertexCount).toBeGreaterThan(6);
    expect(asset?.bounds?.size[0]).toBeGreaterThan(1.2);
    expect(asset?.bounds?.size[1]).toBeGreaterThan(1.2);
    expect(material?.textures?.some((slot) => slot.semantic === "baseColor" && slot.present)).toBe(true);
    expect(texture?.url).toContain("l4_story_awakened_machine_image2_v1");
    expect(pack.manifest.fallbackProxyModels).toContain("l4_story_awakened_machine_image2_v1");
  });

  it("persists the Image2 story art PNG into local runtime-pack texture blobs", async () => {
    const project = storyPaintingProject();
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const pack = compileBuilderRuntimePack(level!, project);
    const texture = pack.renderPlan.geometry.baseColorTextures?.find(
      (candidate) => candidate.name === "prop:l4_story_awakened_machine_image2_v1:story-painting",
    );
    expect(texture).toBeTruthy();

    const tinyPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    const result = await collectExternalBuilderRuntimeTextureBlobs({
      ...pack.renderPlan,
      geometry: {
        ...pack.renderPlan.geometry,
        baseColorTextures: [{ ...texture!, url: tinyPngDataUrl, mimeType: "image/png" }],
      },
    }, pack.textures);

    expect(result.diagnostics).toEqual([]);
    expect(result.textures).toEqual([
      expect.objectContaining({
        page: texture?.page ?? 0,
        layer: texture?.layer,
        mimeType: "image/png",
        name: "prop:l4_story_awakened_machine_image2_v1:story-painting",
      }),
    ]);
    expect(result.textures[0]?.bytes.byteLength).toBeGreaterThan(0);
  });

  it("writes all Level 4 story painting PNGs into generated playtest pack blobs", async () => {
    const backend = createMemoryRuntimePackBackend();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      const matchedKey = L4_STORY_PAINTING_KEYS.find((key) => url.includes(key));
      if (!matchedKey) return new Response(null, { status: 404 });
      return new Response(new Uint8Array([matchedKey.length, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });

    const result = await generateBuilderPlaytestPack(storyPaintingProject(L4_STORY_PAINTING_KEYS), {
      mode: "fast",
      backend,
      headless: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = await backend.get(result.packId);
    expect(record).not.toBeNull();
    const baseColorTextures = record?.renderPlan.geometry?.baseColorTextures ?? [];
    const textureBlobs = record?.textureBlobs ?? [];

    for (const modelKey of L4_STORY_PAINTING_KEYS) {
      const texture = baseColorTextures.find((entry) => entry.name === `prop:${modelKey}:story-painting`);
      const material = record?.renderPlan.geometry?.materials?.find((entry) => entry.name === `story-painting-art:${modelKey}`);
      expect(texture).toBeTruthy();
      expect(material?.textures?.some((slot) => slot.semantic === "baseColor" && slot.page === texture?.page && slot.layer === texture?.layer)).toBe(true);
      expect(textureBlobs).toContainEqual(
        expect.objectContaining({
          page: texture?.page ?? 0,
          layer: texture?.layer,
          mimeType: "image/png",
          name: `prop:${modelKey}:story-painting`,
        }),
      );
    }
  });

  it("keeps Level 4 story paintings procedural with PNG blobs in deep playtest packs", async () => {
    const backend = createMemoryRuntimePackBackend();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      const matchedKey = L4_STORY_PAINTING_KEYS.find((key) => url.includes(key));
      if (!matchedKey) return new Response(null, { status: 404 });
      return new Response(new Uint8Array([matchedKey.length, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });

    const { level, issues } = compileBuilderProjectToLevel(storyPaintingProject(L4_STORY_PAINTING_KEYS));
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    const collection = builderDeepModelRequestsForAssetIndex(builderRuntimeAssetIndexForProject(level!, storyPaintingProject(L4_STORY_PAINTING_KEYS)));
    for (const modelKey of L4_STORY_PAINTING_KEYS) {
      expect(collection.requests.some((request) => request.modelKey === modelKey)).toBe(false);
      expect(collection.unresolved).not.toContain(modelKey);
    }

    const result = await generateBuilderPlaytestPack(storyPaintingProject(L4_STORY_PAINTING_KEYS), {
      mode: "deep",
      backend,
      headless: true,
      cookedLibraryForTests: emptyCookedLibrary(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bakeMode).toBe("cooked-glb");
    const record = await backend.get(result.packId);
    expect(record?.manifest.bakeMode).toBe("cooked-glb");
    for (const modelKey of L4_STORY_PAINTING_KEYS) {
      const texture = record?.renderPlan.geometry?.baseColorTextures?.find((entry) => entry.name === `prop:${modelKey}:story-painting`);
      expect(texture).toBeTruthy();
      expect(record?.textureBlobs).toContainEqual(
        expect.objectContaining({
          page: texture?.page ?? 0,
          layer: texture?.layer,
          mimeType: "image/png",
          name: `prop:${modelKey}:story-painting`,
        }),
      );
    }
  });

  it("compiles all Level 4 story paintings without missing-model validation and with Raw base-color layers", () => {
    const project = storyPaintingProject(L4_STORY_PAINTING_KEYS);
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues.filter((issue) => issue.code === "prop.model.missing")).toEqual([]);
    expect(level).not.toBeNull();

    const pack = compileBuilderRuntimePack(level!, project);
    const materialFloats = rawMaterialFloatsFor(pack.renderPlan);

    for (const modelKey of L4_STORY_PAINTING_KEYS) {
      const material = pack.renderPlan.geometry.materials?.find((entry) => entry.name === `story-painting-art:${modelKey}`);
      const texture = pack.renderPlan.geometry.baseColorTextures?.find((entry) => entry.name === `prop:${modelKey}:story-painting`);
      const asset = pack.renderPlan.geometry.assets.find((entry) => entry.modelKey === modelKey);
      expect(asset?.bounds?.size[0]).toBeGreaterThan(1.2);
      expect(asset?.bounds?.size[1]).toBeGreaterThan(1.2);
      expect(texture?.layer).toBeGreaterThan(0);
      expect(material?.index).toBeGreaterThan(0);
      expect(materialFloats[(material!.index * RAW_MATERIAL_FLOATS) + 15]).toBe(texture!.layer);
    }
  });

  it("compiles wall-mounted Image2 story paintings so the artwork front faces into the room", () => {
    const project: BuilderProject = {
      ...storyPaintingProject(["l4_story_awakened_machine_image2_v1"]),
      props: [
        {
          id: "story_east_wall",
          modelKey: "l4_story_awakened_machine_image2_v1",
          roomId: "room_spawn",
          position: [3.78, 0],
          rotationY: 0,
          scale: 1,
        },
      ],
    };
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const prop = level?.map.props?.find((candidate) => candidate.id === "story_east_wall");
    expect(prop?.rotation?.[1]).toBeCloseTo(-Math.PI / 2);
  });

  it("does not add translucent glass overlay materials to procedural Image2 story paintings", () => {
    const project = storyPaintingProject();
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const pack = compileBuilderRuntimePack(level!, project);
    const storyMaterials = pack.renderPlan.geometry.materials?.filter((material) => material.name?.includes("story-painting")) ?? [];

    expect(storyMaterials.some((material) => material.name?.startsWith("story-painting-glass:"))).toBe(false);
    expect(storyMaterials.filter((material) => material.alphaMode === "BLEND")).toEqual([]);
  });

  it("does not let native Raw resources override procedural Image2 story painting geometry", () => {
    const project = storyPaintingProject(["l4_story_awakened_machine_image2_v1"]);
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const pack = compileBuilderRuntimePack(level!, project, {
      nativeRawModels: nativeRawStoryPaintingLibrary("l4_story_awakened_machine_image2_v1"),
    });

    const storyAssets = pack.renderPlan.geometry.assets.filter((entry) => entry.modelKey === "l4_story_awakened_machine_image2_v1");
    expect(storyAssets).toHaveLength(1);
    expect(storyAssets[0]?.bounds?.size[0]).toBeLessThan(2);
    expect(pack.manifest.nativeRawFurnitureModels).not.toContain("l4_story_awakened_machine_image2_v1");
  });

  it("does not request the old museum wall-art GLB for Image2 story paintings", () => {
    const project = storyPaintingProject();
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const index = builderRuntimeAssetIndexForProject(level!, project);
    const storyEntry = index.find((entry) => entry.modelKey === "l4_story_awakened_machine_image2_v1");

    expect(storyEntry).toMatchObject({
      modelKey: "l4_story_awakened_machine_image2_v1",
      kind: "furniture",
      glbUrl: null,
    });
    expect(builderNativeRawRequestsForAssetIndex(index).some((request) => request.modelKey === "l4_story_awakened_machine_image2_v1")).toBe(false);
  });

  it("hangs Level 4 Image2 story paintings slightly lower than generic wall props", () => {
    expect(defaultPropElevation("l4_story_awakened_machine_image2_v1")).toBeCloseTo(1.46);
  });
});

function emptyCookedLibrary(): CookedGlbLibrary {
  return {
    models: new Map(),
    missing: [],
    geometryBytes: 0,
    textureFallbackModels: [],
  };
}

function nativeRawStoryPaintingLibrary(modelKey: string): BuilderNativeRawModelLibrary {
  return {
    libraryId: "test-native-raw",
    sourceLevelIds: ["test-native-raw-source"],
    materials: [],
    baseColorTextures: [],
    materialTextures: [],
    models: new Map([
      [
        modelKey,
        {
          modelKey,
          kind: "furniture",
          sourceLevelId: "test-native-raw-source",
          asset: {
            modelKey,
            vertexOffset: 0,
            vertexCount: 3,
            triangleCount: 1,
            bounds: { min: [0, 0, 0], center: [2, 2, 0], size: [4, 4, 0] },
            status: "ready",
          },
          vertices: new Float32Array([
            0, 0, 0, 0, 0, 1, 0, 0, 0, -1,
            4, 0, 0, 0, 0, 1, 1, 0, 0, -1,
            0, 4, 0, 0, 0, 1, 0, 1, 0, -1,
          ]),
        },
      ],
    ]),
  };
}
