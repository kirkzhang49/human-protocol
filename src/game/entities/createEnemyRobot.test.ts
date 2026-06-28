import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createEnemyRobot } from "./createEnemyRobot";

describe("createEnemyRobot", () => {
  it("keeps normal enemies on the premium visual palette by default", () => {
    const repair = createEnemyRobot(1, "repair_drone", "first_contact", new Vector3(), 0);
    const clamp = createEnemyRobot(2, "clamp_bot", "wave_01", new Vector3(), 0, undefined, { spawnRoomId: "room_exit" });

    expect(repair).toMatchObject({
      bodyColor: "#6f8d86",
      armorColor: "#1e2a2b",
      coreColor: "#7ef3f7",
      warningColor: "#b99a54",
      textureAtlasKey: "repair_drone",
      visualScaleMultiplier: 1.2,
    });
    expect(clamp).toMatchObject({
      bodyColor: "#6f8d86",
      armorColor: "#1e2a2b",
      coreColor: "#7ef3f7",
      warningColor: "#b99a54",
      textureAtlasKey: "clamp_bot",
      visualScaleMultiplier: 1,
      spawnRoomId: "room_exit",
    });
  });
});
