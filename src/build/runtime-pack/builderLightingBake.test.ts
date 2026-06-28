import { describe, expect, it } from "vitest";
import { buildVisibilityScenarios } from "./builderLightingBake";
import type { RawPlanLight } from "../../render/raw-webgpu/RawWebGpuTypes";

describe("builder runtime visibility scenarios", () => {
  it("keeps closed neighboring rooms out of the base visible set", () => {
    const scenarios = buildVisibilityScenarios(
      {
        rooms: [
          { id: "hub", bounds: { center: [0, 0, 0], size: [10, 4, 10] } },
          { id: "locked_wing", bounds: { center: [10, 0, 0], size: [8, 4, 8] } },
          { id: "archive", bounds: { center: [0, 0, -10], size: [8, 4, 8] } },
        ],
        doors: [
          { id: "door_wing", fromRoomId: "hub", toRoomId: "locked_wing", position: [5, 0, 0] },
          { id: "door_archive", fromRoomId: "hub", toRoomId: "archive", position: [0, 0, -5] },
        ],
      } as any,
      [
        light("hub_light", "hub"),
        light("wing_light", "locked_wing"),
        light("archive_light", "archive"),
        { ...light("door_light", null), doorId: "door_wing" },
        light("global_light", null),
      ],
    );

    const hubHigh = scenarios.find((scenario) => scenario.currentRoomId === "hub" && scenario.qualityTier === "high");

    expect(hubHigh?.visibleRoomIds).toEqual(["hub"]);
    expect(hubHigh?.visibleDoorIds.sort()).toEqual(["door_archive", "door_wing"]);
    expect(hubHigh?.selectedLights.map((selected) => selected.id)).toEqual(expect.arrayContaining(["hub_light", "door_light", "global_light"]));
    expect(hubHigh?.selectedLights.map((selected) => selected.id)).not.toContain("wing_light");
    expect(hubHigh?.selectedLights.map((selected) => selected.id)).not.toContain("archive_light");
  });
});

function light(id: string, roomId: string | null): RawPlanLight {
  return {
    id,
    type: "point",
    roomId,
    doorId: null,
    color: "#ffffff",
    intensity: 1,
    position: [0, 2, 0],
  };
}
