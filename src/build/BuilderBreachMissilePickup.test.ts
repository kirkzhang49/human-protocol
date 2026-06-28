import { describe, expect, it } from "vitest";
import { pickupVisualIntentForType } from "../game/visual/PickupVisualIntent";
import { builderRuntimeAssetIndexForProject } from "./runtime-pack/BuilderRuntimeAssetIndex";
import { pickupEntry, pickupModelKey } from "./BuilderPickupCatalog";
import { createStarterProject, type BuilderProject } from "./BuilderTypes";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";

describe("breach missile builder pickup", () => {
  it("compiles into a Raw WebGPU map pickup that uses the procedural missile GLB", () => {
    const pickupKind = "breachMissile";
    const starter = createStarterProject();
    const project: BuilderProject = {
      ...starter,
      pickups: [
        ...starter.pickups,
        {
          id: "pickup_breach_missile",
          kind: pickupKind,
          roomId: "room_hall",
          position: [1.2, 3.4],
        },
      ],
    };

    expect(pickupEntry(pickupKind)).toMatchObject({
      label: "突破导弹",
      glyph: "导",
      modelKey: "ability_protocol_breach_missile_v1",
      thumbnailKind: "missile",
    });
    expect(pickupModelKey(pickupKind)).toBe("ability_protocol_breach_missile_v1");
    expect(pickupVisualIntentForType(pickupKind)?.modelKey).toBe("ability_protocol_breach_missile_v1");

    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level?.map?.pickups?.find((pickup) => pickup.id === "pickup_breach_missile")).toMatchObject({
      type: "breachMissile",
      label: "突破导弹",
      position: [1.2, 0, 3.4],
    });

    const assetIndex = builderRuntimeAssetIndexForProject(level!, project);
    expect(assetIndex.find((entry) => entry.modelKey === "ability_protocol_breach_missile_v1")).toMatchObject({
      nativeRawEligible: true,
      roles: expect.arrayContaining(["pickup"]),
    });
  });
});
