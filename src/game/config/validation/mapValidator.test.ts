import { describe, expect, it } from "vitest";
import { MAX_DYNAMIC_PROPS_PER_LEVEL } from "../DynamicPropPolicy";
import { doorSwitchSmokeLevel } from "../smoke/doorSwitchSmokeLevel";
import type { LevelDefinition, LevelMapPropDefinition } from "../schema/levelConfig";
import { validateLevelConfig } from "../ConfigValidator";

describe("dynamic map prop validation", () => {
  it("rejects unsafe dynamic prop authoring before it reaches Rapier", () => {
    const level = levelWithProps([
      {
        ...dynamicProp("missing_collider", [0, 0.35, 4.8]),
        collider: undefined,
      },
      {
        ...dynamicProp("large_machine", [1, 0.35, 4.8]),
        collider: { halfSize: [1.3, 0.4, 0.45] },
      },
      {
        ...dynamicProp("puzzle_console", [-1, 0.35, 4.8]),
        tags: ["dynamic_prop", "puzzle_host"],
      },
    ]);

    expect(validateLevelConfig(level).errors.map((issue) => `${issue.code}:${issue.path}`)).toEqual(
      expect.arrayContaining([
        "prop.dynamic.collider.missing:map.props[0].collider",
        "prop.dynamic.collider.too_large:map.props[1].collider.halfSize",
        "prop.dynamic.tag.blocked:map.props[2].tags",
      ]),
    );
  });

  it("caps authored dynamic props per level", () => {
    const props = Array.from({ length: MAX_DYNAMIC_PROPS_PER_LEVEL + 1 }, (_, index) =>
      dynamicProp(`loose_crate_${index}`, [0, 0.35, 4 + index * 0.01]),
    );

    expect(validateLevelConfig(levelWithProps(props)).errors.map((issue) => `${issue.code}:${issue.path}`)).toContain(
      "prop.dynamic.count.exceeded:map.props",
    );
  });
});

function dynamicProp(id: string, position: [number, number, number]): LevelMapPropDefinition {
  return {
    id,
    roomId: "switch_spawn_room",
    modelKey: "room_locker_low",
    position,
    collider: { halfSize: [0.32, 0.35, 0.28] },
    tags: ["dynamic_prop"],
  };
}

function levelWithProps(props: readonly LevelMapPropDefinition[]): LevelDefinition {
  return {
    ...doorSwitchSmokeLevel,
    id: "dynamic_prop_validation_smoke",
    map: {
      ...doorSwitchSmokeLevel.map!,
      props,
    },
  };
}
