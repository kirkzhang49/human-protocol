import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createEnemyRobot } from "../../game/entities/createEnemyRobot";
import { canUseRigidNodePalette, enemyTintFor } from "./RawWebGpuRuntimeHelpers";

describe("enemyTintFor", () => {
  it("uses configured core/warning colors for the Level 3 curator boss tint", () => {
    const curator = createEnemyRobot(1, "custodian_elite", "level_03_boss", new Vector3(), 0, {
      tier: "leader",
      visual: {
        modelKey: "hp_enemy_shield_technician_horror",
        coreColor: "#ff6a52",
        warningColor: "#ffd36d",
        textureAtlasKey: "custodian_boss",
        scaleMultiplier: 0.94,
      },
    });

    const tint = enemyTintFor(curator);

    expect(tint[0]).toBeGreaterThan(0.95);
    expect(tint[1]).toBeGreaterThan(0.56);
    expect(tint[2]).toBeLessThan(0.46);
    expect(tint[3]).toBeGreaterThan(0.14);
  });

  it("keeps normal builder robots on a cyan-forward tint instead of a neutral white proxy", () => {
    const repair = createEnemyRobot(2, "repair_drone", "builder_wave", new Vector3(), 0);

    const tint = enemyTintFor(repair);

    expect(tint[2]).toBeGreaterThan(tint[0]);
    expect(tint[1]).toBeGreaterThan(0.75);
    expect(tint[3]).toBeGreaterThan(0.1);
  });

});

describe("canUseRigidNodePalette", () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  it("rejects duplicate node chunks with different inverse bind matrices", () => {
    expect(
      canUseRigidNodePalette({
        rigidSkin: {
          mode: "rigid-node-palette",
          jointCount: 4,
          referencedJointCount: 2,
          chunkCount: 2,
          vertexAttribute: "rigidJointIndex",
        },
        nodeChunks: [
          { nodeIndex: 2, vertexOffset: 0, vertexCount: 3, bindMatrix: identity, inverseBindMatrix: identity },
          {
            nodeIndex: 2,
            vertexOffset: 3,
            vertexCount: 3,
            bindMatrix: identity,
            inverseBindMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.5, 0, 0, 1],
          },
        ],
      }),
    ).toBe(false);
  });

  it("accepts unique rigid nodes for the fast palette path", () => {
    expect(
      canUseRigidNodePalette({
        rigidSkin: {
          mode: "rigid-node-palette",
          jointCount: 4,
          referencedJointCount: 2,
          chunkCount: 2,
          vertexAttribute: "rigidJointIndex",
        },
        nodeChunks: [
          { nodeIndex: 1, vertexOffset: 0, vertexCount: 3, bindMatrix: identity, inverseBindMatrix: identity },
          { nodeIndex: 2, vertexOffset: 3, vertexCount: 3, bindMatrix: identity, inverseBindMatrix: identity },
        ],
      }),
    ).toBe(true);
  });
});
