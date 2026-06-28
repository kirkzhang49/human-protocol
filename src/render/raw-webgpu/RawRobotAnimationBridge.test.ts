import { Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createRawRobotAnimationSampler } from "./RawRobotAnimationBridge";

function sampledScale(matrix: Matrix4) {
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  return scale;
}

describe("RawRobotAnimationBridge repair drone readability overrides", () => {
  it("does not promote auto-generated repair drone mesh nodes into giant scales", () => {
    const sampler = createRawRobotAnimationSampler({
      assets: [
        {
          key: "hp_enemy_repair_drone_horror",
          nodes: [
            { index: 0, name: "root", parent: null, scale: [1, 1, 1] },
            { index: 1, name: "mesh53", parent: 0, scale: [0.2, 0.2, 0.2] },
            { index: 2, name: "mesh54", parent: 0, scale: [0.2, 0.2, 0.2] },
            { index: 3, name: "mesh67", parent: 0, scale: [0.2, 0.2, 0.2] },
            { index: 4, name: "mesh52", parent: 0, scale: [0.2, 0.2, 0.2] },
          ],
          clips: [{ name: "idle", action: "idle", durationSeconds: 1, channels: [] }],
        },
      ],
    });

    const pose = sampler?.sample("hp_enemy_repair_drone_horror", "idle", 0, true);

    expect(pose).not.toBeNull();
    for (const nodeIndex of [1, 2, 3]) {
      const scale = sampledScale(pose!.worldMatrices[nodeIndex]);
      expect(scale.x).toBeLessThan(1);
      expect(scale.y).toBeLessThan(1);
      expect(scale.z).toBeLessThan(1);
    }
    const hiddenSliverScale = sampledScale(pose!.worldMatrices[4]);
    expect(hiddenSliverScale.x).toBeCloseTo(0.01);
    expect(hiddenSliverScale.y).toBeCloseTo(0.01);
    expect(hiddenSliverScale.z).toBeCloseTo(0.01);
  });

  it("clamps oversized enemy root scale channels without inflating spawn scale-up poses", () => {
    const sampler = createRawRobotAnimationSampler({
      assets: [
        {
          key: "hp_enemy_repair_drone_horror",
          nodes: [
            { index: 0, name: "Root", parent: null, scale: [1, 1, 1] },
            { index: 1, name: "body", parent: 0, scale: [1, 1, 1] },
          ],
          clips: [
            {
              name: "hit_heavy",
              action: "hit_heavy",
              durationSeconds: 1,
              channels: [
                {
                  targetNode: 0,
                  path: "scale",
                  times: [0, 0.5, 1],
                  values: [1, 1, 1, 3.8, 4.2, 3.6, 1, 1, 1],
                },
              ],
            },
            {
              name: "spawn_boot",
              action: "spawn_boot",
              durationSeconds: 1,
              channels: [
                {
                  targetNode: 0,
                  path: "scale",
                  times: [0, 1],
                  values: [0.35, 0.35, 0.35, 1, 1, 1],
                },
              ],
            },
          ],
        },
      ],
    });

    const hitPose = sampler?.sample("hp_enemy_repair_drone_horror", "hit_heavy", 0.5, false);
    const hitScale = sampledScale(hitPose!.worldMatrices[1]);
    expect(hitScale.x).toBeLessThanOrEqual(1.08);
    expect(hitScale.y).toBeLessThanOrEqual(1.08);
    expect(hitScale.z).toBeLessThanOrEqual(1.08);

    const spawnPose = sampler?.sample("hp_enemy_repair_drone_horror", "spawn_boot", 0, false);
    const spawnScale = sampledScale(spawnPose!.worldMatrices[1]);
    expect(spawnScale.x).toBeCloseTo(0.35);
    expect(spawnScale.y).toBeCloseTo(0.35);
    expect(spawnScale.z).toBeCloseTo(0.35);
  });

  it("treats heavy-hit root scale as a multiplier over the bind scale", () => {
    const sampler = createRawRobotAnimationSampler({
      assets: [
        {
          key: "hp_enemy_repair_drone_horror",
          nodes: [
            { index: 0, name: "Root", parent: null, scale: [0.5, 0.4, 0.6] },
            { index: 1, name: "body", parent: 0, scale: [1, 1, 1] },
          ],
          clips: [
            {
              name: "hit_heavy",
              action: "hit_heavy",
              durationSeconds: 1,
              channels: [
                {
                  targetNode: 0,
                  path: "scale",
                  times: [0, 0.5, 1],
                  values: [1, 1, 1, 1.25, 1.25, 1.25, 1, 1, 1],
                },
              ],
            },
          ],
        },
      ],
    });

    const restPose = sampler?.sample("hp_enemy_repair_drone_horror", "hit_heavy", 0, false);
    const restScale = sampledScale(restPose!.worldMatrices[1]);
    expect(restScale.x).toBeCloseTo(0.5);
    expect(restScale.y).toBeCloseTo(0.4);
    expect(restScale.z).toBeCloseTo(0.6);

    const impactPose = sampler?.sample("hp_enemy_repair_drone_horror", "hit_heavy", 0.5, false);
    const impactScale = sampledScale(impactPose!.worldMatrices[1]);
    expect(impactScale.x).toBeCloseTo(0.54);
    expect(impactScale.y).toBeCloseTo(0.432);
    expect(impactScale.z).toBeCloseTo(0.648);
  });
});
