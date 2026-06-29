import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createEnemyRobot } from "../../game/entities/createEnemyRobot";
import type { FocusRevealState } from "../../game/core/GameMode";
import { enemyModelAnimationName } from "./EnemyThreeOracle";

function robotReveal(targetId: string, elapsed = 1.2): FocusRevealState {
  return {
    kind: "robot",
    targetId,
    roomId: "room_boss",
    elapsed,
    duration: 3,
    targetPosition: [0, 1.4, 0],
    cameraPosition: [0, 1.6, 3],
    cameraCut: true,
  };
}

describe("enemyModelAnimationName", () => {
  it("plays a visible boss motion during robot focus reveals", () => {
    const boss = createEnemyRobot(7, "custodian_elite", "wave", new Vector3(), 0, { tier: "boss" });
    boss.spawnAge = 0.8;

    expect(enemyModelAnimationName(boss, robotReveal(`enemy:${boss.id}`))).toBe("move");
  });

  it("keeps ordinary idle selection outside the robot reveal", () => {
    const boss = createEnemyRobot(7, "custodian_elite", "wave", new Vector3(), 0, { tier: "boss" });
    boss.spawnAge = 0.8;

    expect(enemyModelAnimationName(boss, null)).toBe("idle");
  });
});
