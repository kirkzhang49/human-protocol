import { describe, expect, it } from "vitest";
import { FLOATS_PER_VERTEX, VERTEX_MATERIAL_INDEX_COMPONENT } from "../../render/raw-webgpu/RawWebGpuConstants";
import { GeometryWriter } from "./GeometryWriter";
import { MaterialTable } from "./MaterialTable";
import { pushArchiveMergeCabinet } from "./builderPuzzleMachineBake";

describe("builder puzzle machine fallback bake", () => {
  it("does not use the generic body material for the identity compression cabinet shell", () => {
    const geometry = new GeometryWriter();
    const materials = new MaterialTable();
    const genericWhiteBody = materials.surface("test:white-body", { color: "#ffffff", roughness: 0.2, visualRole: "neutral_surface" });

    geometry.beginAsset("archive_merge_fallback");
    pushArchiveMergeCabinet(geometry, materials, genericWhiteBody);
    geometry.endAsset();

    const vertices = new Float32Array(geometry.finish());
    const usedMaterialIndices = new Set<number>();
    for (let offset = 0; offset < vertices.length; offset += FLOATS_PER_VERTEX) {
      usedMaterialIndices.add(Math.round(vertices[offset + VERTEX_MATERIAL_INDEX_COMPONENT]));
    }

    expect(usedMaterialIndices.has(genericWhiteBody)).toBe(false);
    expect(materials.list().some((material) => material.name === "puzzle:archive-merge-shell")).toBe(true);
  });
});
