import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createEnemyRobot } from "../../game/entities/createEnemyRobot";
import {
  enemyModelTargetHeight,
  enemyUsesBossMaterialFinish,
  isEnemyOccludedForThreeOracle,
  isEnemyRoomVisibleForThreeOracle,
  shouldRenderEnemyWithThreeOracle,
} from "./EnemyOraclePolicy";

describe("EnemyOraclePolicy", () => {
  it("routes shield technicians and actual boss robots through the Three oracle path", () => {
    const shieldTech = createEnemyRobot(0, "shield_tech", "level_02_wave", new Vector3(), 0, {
      visual: { modelKey: "hp_enemy_shield_technician_horror" },
    });
    const bossShieldTech = createEnemyRobot(1, "shield_tech", "level_03_boss", new Vector3(), 0, {
      tier: "boss",
      visual: { modelKey: "hp_enemy_shield_technician_horror" },
    });

    expect(shouldRenderEnemyWithThreeOracle(shieldTech, "hp_enemy_shield_technician_horror")).toBe(true);
    expect(shouldRenderEnemyWithThreeOracle(bossShieldTech, "hp_enemy_shield_technician_horror")).toBe(true);
    expect(shouldRenderEnemyWithThreeOracle(bossShieldTech, "hp_enemy_custodian_foreman_horror")).toBe(true);
    expect(shouldRenderEnemyWithThreeOracle(bossShieldTech, "hp_enemy_reclamation_mother_final_horror")).toBe(true);
  });

  it("leaves non-shield small robots and Level 2 leaders on the Raw WebGPU path", () => {
    const level2Leader = createEnemyRobot(3, "custodian_elite", "level_02_carekeeper_host", new Vector3(), 0, {
      tier: "leader",
      visual: {
        modelKey: "hp_enemy_custodian_foreman_horror",
        textureAtlasKey: "custodian_boss",
      },
    });
    const repair = createEnemyRobot(4, "repair_drone", "any_official_wave", new Vector3(), 0);

    expect(shouldRenderEnemyWithThreeOracle(level2Leader, "hp_enemy_custodian_foreman_horror")).toBe(false);
    expect(shouldRenderEnemyWithThreeOracle(repair, "hp_enemy_repair_drone_horror")).toBe(false);
  });

  it("uses boss material finish only for actual bosses", () => {
    const smallShieldTech = createEnemyRobot(5, "shield_tech", "level_03_wave", new Vector3(), 0, {
      visual: { modelKey: "hp_enemy_shield_technician_horror" },
    });
    const level2Leader = createEnemyRobot(6, "custodian_elite", "level_02_carekeeper_host", new Vector3(), 0, {
      tier: "leader",
      visual: { textureAtlasKey: "custodian_boss" },
    });
    const bossShieldTech = createEnemyRobot(7, "shield_tech", "level_03_boss", new Vector3(), 0, {
      tier: "boss",
      visual: {
        modelKey: "hp_enemy_shield_technician_horror",
        textureAtlasKey: "custodian_boss",
      },
    });

    expect(enemyUsesBossMaterialFinish(smallShieldTech)).toBe(false);
    expect(enemyUsesBossMaterialFinish(level2Leader)).toBe(false);
    expect(enemyUsesBossMaterialFinish(bossShieldTech)).toBe(true);
  });

  it("keeps the repair drone visually small instead of scaling it like a humanoid robot", () => {
    const repair = createEnemyRobot(5, "repair_drone", "builder_wave", new Vector3(), 0);

    expect(enemyModelTargetHeight(repair, "hp_enemy_repair_drone_horror")).toBeLessThan(0.9);
  });

  it("keeps oracle enemies visible through the same opened-door chain Raw WebGPU reveals", () => {
    const world = createOracleVisibilityWorld(["door_large", "door_far"]);

    expect(isEnemyRoomVisibleForThreeOracle(world as any, "far_room")).toBe(true);
  });

  it("does not reveal oracle enemies behind a still-closed boundary door", () => {
    const world = createOracleVisibilityWorld(["door_large"]);

    expect(isEnemyRoomVisibleForThreeOracle(world as any, "far_room")).toBe(false);
  });

  it("does not reveal oracle enemies in an adjacent room while its boundary door is closed", () => {
    const world = createOracleVisibilityWorld([]);

    expect(isEnemyRoomVisibleForThreeOracle(world as any, "large_room")).toBe(false);
  });

  it("hides oracle enemies behind blocking room obstacles", () => {
    const enemy = createEnemyRobot(8, "shield_tech", "far_room", new Vector3(0, 0, 10), 0);
    const world = {
      player: { position: new Vector3(0, 0, 0) },
      obstacles: [
        {
          id: "wall_between_rooms",
          visualKey: "wall",
          position: new Vector3(0, 1, 5),
          halfSize: new Vector3(4, 2, 0.2),
        },
      ],
    };

    expect(isEnemyOccludedForThreeOracle(world as any, enemy)).toBe(true);
  });

  it("keeps oracle enemies visible when no obstacle crosses the sight line", () => {
    const enemy = createEnemyRobot(9, "shield_tech", "same_room", new Vector3(0, 0, 10), 0);
    const world = {
      player: { position: new Vector3(0, 0, 0) },
      obstacles: [
        {
          id: "side_wall",
          visualKey: "wall",
          position: new Vector3(5, 1, 5),
          halfSize: new Vector3(0.2, 2, 4),
        },
      ],
    };

    expect(isEnemyOccludedForThreeOracle(world as any, enemy)).toBe(false);
  });
});

function createOracleVisibilityWorld(openDoorIds: string[]) {
  return {
    isDoorOpen: (doorId: string) => openDoorIds.includes(doorId),
    activeObjective: () => null,
    renderPerformance: { quality: { tier: "high" } },
    session: {
      exitUnlocked: false,
      mapProgress: {
        currentRoomId: "entry_room",
        openedDoorIds: openDoorIds,
      },
    },
    player: { position: { x: 0, z: 0 } },
    level: {
      map: {
        rooms: [
          { id: "entry_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } },
          { id: "large_room", bounds: { center: [0, 0, 20], size: [16, 4, 12] } },
          { id: "far_room", bounds: { center: [0, 0, 40], size: [8, 4, 8] } },
        ],
        doors: [
          { id: "door_large", fromRoomId: "entry_room", toRoomId: "large_room", position: [0, 0, 8] },
          { id: "door_far", fromRoomId: "large_room", toRoomId: "far_room", position: [0, 0, 28] },
        ],
        interactions: [],
        keyItems: [],
      },
    },
    obstacles: [],
  };
}
