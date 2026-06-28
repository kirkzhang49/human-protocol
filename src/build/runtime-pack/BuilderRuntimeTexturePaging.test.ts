import { describe, expect, it } from "vitest";
import {
  FLOATS_PER_VERTEX,
  RAW_TEXTURE_PAGE_STRIDE,
  VERTEX_MATERIAL_INDEX_COMPONENT,
} from "../../render/raw-webgpu/RawWebGpuConstants";
import { RAW_MATERIAL_FLOATS, rawMaterialFloatsFor } from "../../render/raw-webgpu/RawWebGpuMaterialPipeline";
import type { RawPlanGeometry, RawPlanMaterial, RawRenderPlan, Tuple3, Tuple4 } from "../../render/raw-webgpu/RawWebGpuTypes";
import {
  BUILDER_TEXTURE_LAYERS_PER_PAGE,
  paginateBuilderRuntimePackTextures,
} from "./BuilderRuntimeTexturePaging";

describe("BuilderRuntimeTexturePaging", () => {
  it("paginates used base-color textures and remaps stored blobs by page/layer", () => {
    const count = BUILDER_TEXTURE_LAYERS_PER_PAGE + 1;
    const materials = Array.from({ length: count }, (_, index) =>
      material(index + 2, [
        {
          semantic: "baseColor",
          present: true,
          colorSpace: "srgb",
          layer: index + 1,
        },
      ]),
    );
    const geometry: RawPlanGeometry = {
      binaryFile: "test",
      vertexStrideFloats: FLOATS_PER_VERTEX,
      materials,
      baseColorTextures: Array.from({ length: count }, (_, index) => ({
        layer: index + 1,
        url: `/base-${index + 1}.webp`,
        mimeType: "image/webp",
      })),
      assets: [],
    };
    const blobs = Array.from({ length: count }, (_, index) => ({
      layer: index + 1,
      mimeType: "image/webp",
      bytes: new ArrayBuffer(4),
      name: `blob-${index + 1}`,
    }));

    const paged = paginateBuilderRuntimePackTextures(geometry, geometryBufferForMaterials(materials.map((entry) => entry.index)), blobs);

    expect(paged.baseColorPagesUsed).toBe(2);
    expect(paged.geometry.baseColorTextures?.[0]).toMatchObject({ page: 0, layer: 1, url: "/base-1.webp" });
    expect(paged.geometry.baseColorTextures?.[BUILDER_TEXTURE_LAYERS_PER_PAGE]).toMatchObject({
      page: 1,
      layer: 1,
      url: `/base-${count}.webp`,
    });
    expect(paged.geometry.materials?.[BUILDER_TEXTURE_LAYERS_PER_PAGE].textures?.[0]).toMatchObject({
      page: 1,
      layer: 1,
    });
    expect(paged.textureBlobs[BUILDER_TEXTURE_LAYERS_PER_PAGE]).toMatchObject({
      page: 1,
      layer: 1,
      name: `blob-${count}`,
    });
  });

  it("does not let unused material texture entries spend the page budget", () => {
    const used = material(2, [{ semantic: "normal", present: true, colorSpace: "none", layer: 1 }]);
    const unused = material(3, [{ semantic: "normal", present: true, colorSpace: "none", layer: 2 }]);
    const paged = paginateBuilderRuntimePackTextures(
      {
        binaryFile: "test",
        vertexStrideFloats: FLOATS_PER_VERTEX,
        materials: [used, unused],
        materialTextures: [
          { layer: 1, url: "/used-normal.png", semantic: "normal", colorSpace: "none" },
          { layer: 2, url: "/unused-normal.png", semantic: "normal", colorSpace: "none" },
        ],
        assets: [],
      },
      geometryBufferForMaterials([2]),
      [],
    );

    expect(paged.geometry.materialTextures).toEqual([
      expect.objectContaining({ page: 0, layer: 1, url: "/used-normal.png" }),
    ]);
    expect(paged.geometry.materials?.find((entry) => entry.index === 3)?.textures).toBeUndefined();
  });

  it("reuses duplicate base-color texture content without storing duplicate blobs", () => {
    const first = material(2, [{ semantic: "baseColor", present: true, colorSpace: "srgb", layer: 1 }]);
    const second = material(3, [{ semantic: "baseColor", present: true, colorSpace: "srgb", layer: 2 }]);

    const paged = paginateBuilderRuntimePackTextures(
      {
        binaryFile: "test",
        vertexStrideFloats: FLOATS_PER_VERTEX,
        materials: [first, second],
        baseColorTextures: [
          { layer: 1, name: "first prop label", url: "/shared-texture.webp", mimeType: "image/webp" },
          { layer: 2, name: "second prop label", url: "/shared-texture.webp", mimeType: "image/webp" },
        ],
        assets: [],
      },
      geometryBufferForMaterials([2, 3]),
      [
        { layer: 1, name: "first prop blob", mimeType: "image/webp", bytes: new ArrayBuffer(4) },
        { layer: 2, name: "second prop blob", mimeType: "image/webp", bytes: new ArrayBuffer(4) },
      ],
    );

    expect(paged.geometry.baseColorTextures).toEqual([
      expect.objectContaining({ page: 0, layer: 1, url: "/shared-texture.webp" }),
    ]);
    expect(paged.geometry.materials?.map((entry) => entry.textures?.[0]?.layer)).toEqual([1, 1]);
    expect(paged.textureBlobs).toHaveLength(1);
    expect(paged.textureBlobs[0]).toMatchObject({ page: 0, layer: 1, name: "first prop blob" });
  });

  it("allocates enemy robot textures before room surface textures even when materials are listed later", () => {
    const roomTextureCount = BUILDER_TEXTURE_LAYERS_PER_PAGE;
    const roomMaterials = Array.from({ length: roomTextureCount }, (_, index) =>
      material(index + 2, [{ semantic: "normal", present: true, colorSpace: "none", layer: index + 1 }], {
        category: "room",
        visualRole: "neutral_surface",
      }),
    );
    const enemy = material(400, [{ semantic: "normal", present: true, colorSpace: "none", layer: roomTextureCount + 1 }], {
      category: "enemy",
      visualRole: "robot_body",
    });

    const paged = paginateBuilderRuntimePackTextures(
      {
        binaryFile: "test",
        vertexStrideFloats: FLOATS_PER_VERTEX,
        materials: [...roomMaterials, enemy],
        materialTextures: [
          ...Array.from({ length: roomTextureCount }, (_, index) => ({
            layer: index + 1,
            url: `/room-normal-${index + 1}.png`,
            semantic: "normal" as const,
            colorSpace: "none" as const,
          })),
          {
            layer: roomTextureCount + 1,
            url: "/enemy-robot-normal.png",
            semantic: "normal",
            colorSpace: "none",
          },
        ],
        assets: [],
      },
      geometryBufferForMaterials([...roomMaterials.map((entry) => entry.index), enemy.index]),
      [],
    );

    expect(paged.geometry.materials?.find((entry) => entry.index === enemy.index)?.textures?.[0]).toMatchObject({
      page: 0,
      layer: 1,
    });
    expect(paged.geometry.materials?.[0].textures?.[0]).toMatchObject({
      page: 0,
      layer: 2,
    });
    expect(paged.materialPagesUsed).toBe(2);
  });

  it("fails build-time when unique material textures exceed the fixed page budget", () => {
    const count = BUILDER_TEXTURE_LAYERS_PER_PAGE * 5 + 1;
    const materials = Array.from({ length: count }, (_, index) =>
      material(index + 2, [{ semantic: "normal", present: true, colorSpace: "none", layer: index + 1 }]),
    );

    expect(() =>
      paginateBuilderRuntimePackTextures(
        {
          binaryFile: "test",
          vertexStrideFloats: FLOATS_PER_VERTEX,
          materials,
          materialTextures: Array.from({ length: count }, (_, index) => ({
            layer: index + 1,
            url: `/normal-${index + 1}.png`,
            semantic: "normal",
            colorSpace: "none",
          })),
          assets: [],
        },
        geometryBufferForMaterials(materials.map((entry) => entry.index)),
        [],
      ),
    ).toThrow(/贴图预算已满/);
  });

  it("encodes page and layer into existing Raw material float slots", () => {
    const plan: RawRenderPlan = {
      level: { id: "texture-page-test" },
      rooms: [],
      instances: [],
      visibilityScenarios: [],
      geometry: {
        binaryFile: "test",
        vertexStrideFloats: FLOATS_PER_VERTEX,
        assets: [],
        materials: [
          material(2, [
            { semantic: "baseColor", present: true, colorSpace: "srgb", page: 1, layer: 7 },
            { semantic: "normal", present: true, colorSpace: "none", page: 2, layer: 9 },
          ]),
        ],
      },
    };

    const floats = rawMaterialFloatsFor(plan);

    expect(floats[2 * RAW_MATERIAL_FLOATS + 15]).toBe(RAW_TEXTURE_PAGE_STRIDE + 7);
    expect(floats[2 * RAW_MATERIAL_FLOATS + 28]).toBe(RAW_TEXTURE_PAGE_STRIDE * 2 + 9);
  });
});

function geometryBufferForMaterials(materialIndices: readonly number[]) {
  const floats = new Float32Array(materialIndices.length * FLOATS_PER_VERTEX);
  materialIndices.forEach((materialIndex, vertex) => {
    floats[vertex * FLOATS_PER_VERTEX + VERTEX_MATERIAL_INDEX_COMPONENT] = materialIndex;
  });
  return floats.buffer;
}

function material(
  index: number,
  textures: NonNullable<RawPlanMaterial["textures"]>,
  options: Partial<Pick<RawPlanMaterial, "category" | "visualRole">> = {},
): RawPlanMaterial {
  return {
    index,
    id: `material-${index}`,
    name: `material-${index}`,
    category: options.category ?? "test",
    visualRole: options.visualRole ?? "neutral_surface",
    baseColorFactor: [1, 1, 1, 1] as Tuple4,
    emissiveFactor: [0, 0, 0] as Tuple3,
    emissiveStrength: 0,
    roughnessFactor: 0.6,
    metallicFactor: 0,
    aoStrength: 1,
    materialKind: 0,
    alphaMode: "OPAQUE",
    doubleSided: true,
    textures,
  };
}
