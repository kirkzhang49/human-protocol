import { describe, expect, it } from "vitest";
import { MeshStandardMaterial } from "three";
import { __rawWebGpuPlanGeometryTestInternals as internals } from "./raw-webgpu-plan-geometry.mjs";

function rawMaterial(name, options = {}) {
  const material = new MeshStandardMaterial({
    name,
    color: options.color ?? "#ffffff",
    roughness: options.roughness ?? 0.28,
    metalness: options.metalness ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
  material.emissive.set(options.emissive ?? "#000000");
  material.emissiveIntensity = options.emissiveIntensity ?? 0;
  return material;
}

function recordFor(material, category) {
  return internals.createRawMaterialRecord(material, [0.5, 0.5, 0.5], category, new Map(), null, null, "level_03_human_museum");
}

describe("raw WebGPU route glass material cooking", () => {
  it("keeps route output orb shells visibly transparent instead of route-gold opaque", () => {
    const record = recordFor(
      rawMaterial("route_orb_1_clear_outer_shell", {
        color: "#d1f6ff",
        transparent: true,
        opacity: 0.07,
      }),
      "builder-resource",
    );

    expect(record.visualRole).toBe("glass_shell");
    expect(record.materialKind).toBe(6);
    expect(record.alphaMode).toBe("BLEND");
    expect(record.transparency).toMatchObject({ mode: "blend", alpha: 0.18 });
    expect(record.baseColorFactor[3]).toBeCloseTo(0.18);
  });

  it("promotes route console authored glass materials into the transparent pass", () => {
    const smoked = recordFor(rawMaterial("route_console_smoked_glass", { color: "#05080a" }), "interaction");
    const cyan = recordFor(rawMaterial("route_console_cyan_glass", { color: "#14adbd", emissive: "#3df2ff", emissiveIntensity: 0.82 }), "interaction");

    expect(smoked).toMatchObject({
      visualRole: "glass_shell",
      materialKind: 6,
      alphaMode: "BLEND",
      transparency: { mode: "blend", alpha: 0.28 },
    });
    expect(cyan).toMatchObject({
      visualRole: "glass_shell",
      materialKind: 6,
      alphaMode: "BLEND",
      transparency: { mode: "blend", alpha: 0.38 },
    });
  });
});
