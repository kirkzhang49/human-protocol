import { describe, expect, it } from "vitest";
import type { RawSelectedLight, RawVisibilityScenario } from "./RawWebGpuTypes";
import { rawSelectedLightCandidatesForVisibleRooms, rawShaderLightsFor } from "./RawWebGpuLighting";

function light(id: string, roomId: string, score: number): RawSelectedLight {
  return {
    id,
    type: "point",
    roomId,
    position: [0, 2, 0],
    score,
    canCastShadow: false,
  };
}

function scenario(roomId: string, selectedLights: RawSelectedLight[]): RawVisibilityScenario {
  return {
    currentRoomId: roomId,
    qualityTier: "high",
    visibleRoomIds: [roomId],
    visibleDoorIds: [],
    selectedLights,
  };
}

describe("rawSelectedLightCandidatesForVisibleRooms", () => {
  it("leaves closed-room lighting candidates unchanged", () => {
    const current = scenario("room_a", [light("a0", "room_a", 10)]);

    expect(
      rawSelectedLightCandidatesForVisibleRooms([current], current, new Set(["room_a"]), "room_a", "high"),
    ).toBe(current.selectedLights);
  });

  it("keeps neighbor-room lights when an opened door adds a room after bake", () => {
    const current = scenario(
      "room_a",
      Array.from({ length: 10 }, (_, index) => light(`a${index}`, "room_a", 20 - index)),
    );
    const neighbor = scenario("room_b", [light("b0", "room_b", 30), light("b1", "room_b", 29), light("b2", "room_b", 28)]);

    const candidates = rawSelectedLightCandidatesForVisibleRooms(
      [current, neighbor],
      current,
      new Set(["room_a", "room_b"]),
      "room_a",
      "high",
    );
    const shaderLights = rawShaderLightsFor(candidates, "room_a");

    expect(shaderLights).toHaveLength(10);
    expect(shaderLights.map((selected) => selected.id)).toContain("b0");
    expect(shaderLights.map((selected) => selected.id)).toContain("b1");
  });
});
