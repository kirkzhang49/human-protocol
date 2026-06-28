import { describe, expect, it } from "vitest";
import { MaterialTable } from "./MaterialTable";
import type { CookedGlbMaterial } from "./cookGlbModels";

function material(name: string, baseColorFactor: CookedGlbMaterial["baseColorFactor"] = [1, 1, 1, 1]): CookedGlbMaterial {
  return {
    name,
    baseColorFactor,
    emissiveFactor: [0, 0, 0],
    emissiveStrength: 0,
    roughnessFactor: 0.5,
    metallicFactor: 0.1,
    alphaMode: "OPAQUE",
    doubleSided: true,
  };
}

describe("MaterialTable route switch cooked materials", () => {
  it("forces route console glass into the transparent cooked material path", () => {
    const table = new MaterialTable();
    const smokedIndex = table.cooked("builder_route_switch_console", material("route_console_smoked_glass", [0.015, 0.025, 0.03, 1]));
    const cyanIndex = table.cooked("builder_route_switch_console", material("route_console_cyan_glass", [0.08, 0.68, 0.74, 1]));

    const byIndex = new Map(table.list().map((record) => [record.index, record]));
    expect(byIndex.get(smokedIndex)).toMatchObject({
      visualRole: "glass_shell",
      alphaMode: "BLEND",
      transparency: { mode: "blend", alpha: 0.28 },
    });
    expect(byIndex.get(smokedIndex)?.baseColorFactor[3]).toBeCloseTo(0.28);
    expect(byIndex.get(cyanIndex)).toMatchObject({
      visualRole: "glass_shell",
      alphaMode: "BLEND",
      transparency: { mode: "blend", alpha: 0.38 },
    });
    expect(byIndex.get(cyanIndex)?.baseColorFactor[3]).toBeCloseTo(0.38);
  });

  it("preserves route console color intent even when texture upload is unavailable", () => {
    const table = new MaterialTable();
    const flatIndex = table.cooked("builder_route_switch_console", material("route_parts_flat"));
    const screenIndex = table.cooked("builder_route_switch_console", material("dead_black_screen.003", [0.005, 0.008, 0.012, 1]));
    const bodyIndex = table.cooked("builder_route_switch_console", material("powder_coated_dark_body.003", [0.055, 0.07, 0.08, 1]));

    const byIndex = new Map(table.list().map((record) => [record.index, record]));
    expect(byIndex.get(flatIndex)).toMatchObject({
      visualRole: "switch_active",
      emissiveStrength: 0.26,
    });
    expect(byIndex.get(flatIndex)?.baseColorFactor).not.toEqual([1, 1, 1, 1]);
    expect(byIndex.get(screenIndex)).toMatchObject({
      visualRole: "switch_active",
      emissiveStrength: 0.72,
    });
    expect(byIndex.get(bodyIndex)).toMatchObject({
      visualRole: "structural_dark",
    });
  });

  it("keeps cooked route output orb shells transparent and inner lights emissive", () => {
    const table = new MaterialTable();
    const shellIndex = table.cooked("pickup_route_output_orb_2", material("route_orb_2_transparent_outer_shell"));
    const lightIndex = table.cooked("pickup_route_output_orb_2", material("route_orb_2_inner_light_core"));
    const innerIndex = table.cooked("pickup_route_output_orb_2", material("route_orb_2_image2_api_wrap_inner_sphere"));

    const byIndex = new Map(table.list().map((record) => [record.index, record]));
    expect(byIndex.get(shellIndex)).toMatchObject({
      visualRole: "glass_shell",
      alphaMode: "BLEND",
      transparency: { alpha: 0.24 },
    });
    expect(byIndex.get(lightIndex)).toMatchObject({
      visualRole: "cyan_emissive",
      alphaMode: "BLEND",
      emissiveStrength: 2.1,
    });
    expect(byIndex.get(innerIndex)).toMatchObject({
      visualRole: "screen_label",
      emissiveStrength: 0.92,
    });
  });
});
