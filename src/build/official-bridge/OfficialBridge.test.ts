import { describe, expect, it } from "vitest";
import type { LevelInteractionDefinition, LevelMapPropDefinition } from "../../game/config/schema/levelConfig";
import { interactionVisualModelKey } from "../../game/visual/intents/InteractionVisualIntent";
import { closestVisiblePropId, isExitButtonPanelProp, resolveBuilderInteractionBakeIntent, sourceHostPropForInteraction } from "./InteractionHostBridge";
import { colorPuzzleTargetFromPuzzleActor, puzzleActorFromBuilderComponent } from "./PuzzleActorBridge";
import { colorPuzzleTargetFromBuilderComponent, resolvePuzzleTargetVisualIntent } from "./PuzzleVisualBridge";
import { isRouteOpenDoorTargetAllowed, routeOpenDoorActions } from "./ProgressionBridge";
import {
  builderMapPresentationForProject,
  builderRoomEnvFromOfficialRoom,
  builderSurfaceKitForId,
  builderSurfaceKitForRoom,
  officialSurfaceFieldsForBuilderRoom,
} from "./SurfaceKitBridge";
import type { BuilderDoor, BuilderRoom } from "../BuilderTypes";

function interaction(partial: Partial<LevelInteractionDefinition>): LevelInteractionDefinition {
  return {
    id: "interaction",
    type: "terminal",
    roomId: "room",
    position: [0, 0, 0],
    radius: 1.5,
    visualKey: "terminal",
    materialKey: "terminal_cyan",
    ...partial,
  } as LevelInteractionDefinition;
}

describe("official builder bridge", () => {
  it.each([
    [
      "hp:industrial_panel_arena_shell_v4_image2_floor",
      {
        style: "maintenance",
        floorPresetId: "floor_level01_maintenance_image2_v1",
        wallPresetId: "wall_level01_maintenance_gunmetal_v1",
        ceilingPresetId: "ceiling_level01_maintenance_service_ribs_v1",
        skinKey: "maintenance_bay_hero",
        roomKitId: "hp:maintenance_combat_bay_v3_art_pass",
        lightingPresetId: "hp:cyan_lockdown_arena_v5_age_director",
        surfaceModelKeys: {
          floorModelKey: "room_floor_tile_maintenance",
          wallModelKey: "room_wall_panel_maintenance",
          ceilingModelKey: "room_ceiling_panel_maintenance",
        },
      },
    ],
    [
      "hp:residential_false_home_shell_v1",
      {
        style: "residential",
        floorPresetId: "floor_level02_false_home_walnut_v1",
        wallPresetId: "wall_level02_false_home_plaster_v1",
        ceilingPresetId: "ceiling_level02_false_home_plaster_v1",
        skinKey: "residential_sim_dark",
        lightingPresetId: "hp:residential_simulation_false_home_story_v1",
        surfaceModelKeys: {
          floorModelKey: "room_floor_tile_residential",
          wallModelKey: "room_wall_panel_residential",
          ceilingModelKey: "room_ceiling_panel_residential",
        },
      },
    ],
    [
      "hp:human_museum_gallery_shell_v1",
      {
        style: "museum",
        floorPresetId: "floor_photo_marble",
        wallPresetId: "wall_hp_museum_limestone_panel",
        ceilingPresetId: "ceiling_hp_museum_coffered_limestone",
        skinKey: "human_museum_gallery",
        roomKitId: "hp:human_museum_gallery_v1",
        lightingPresetId: "hp:human_museum_gallery_lighting_v1",
        surfaceModelKeys: {
          floorModelKey: "room_floor_tile_museum",
          wallModelKey: "room_wall_panel_museum",
          ceilingModelKey: "room_ceiling_panel_museum",
        },
      },
    ],
    [
      "hp:memory_clinic_shell_v1",
      {
        style: "sterile",
        floorPresetId: "floor_memory_clinic_tile",
        wallPresetId: "wall_memory_clinic_panel",
        ceilingPresetId: "wall_memory_clinic_panel",
        skinKey: "memory_clinic_sterile",
        lightingPresetId: "hp:memory_clinic_sterile_v1",
        surfaceModelKeys: {
          floorModelKey: "room_floor_tile_clinic",
          wallModelKey: "room_wall_panel_clinic",
          ceilingModelKey: "room_ceiling_panel_clinic",
        },
      },
    ],
    [
      "hp:reclamation_core_shell_v1",
      {
        style: "core",
        floorPresetId: "floor_reclamation_core_metal",
        wallPresetId: "wall_reclamation_core_panel",
        ceilingPresetId: "wall_reclamation_core_panel",
        skinKey: "reclamation_core_chamber",
        lightingPresetId: "hp:reclamation_core_v1",
        surfaceModelKeys: {
          floorModelKey: "room_floor_tile_core",
          wallModelKey: "room_wall_panel_core",
          ceilingModelKey: "room_ceiling_panel_core",
        },
      },
    ],
  ] as const)("maps official shell kit %s to builder and runtime surface ids", (kitId, expected) => {
    const kit = builderSurfaceKitForId(kitId);

    expect(kit).toMatchObject({
      ...expected,
      shellKitId: kitId,
    });
  });

  it("exports a consistent surface kit back to official map presentation", () => {
    const rooms: BuilderRoom[] = [
      {
        id: "gallery_a",
        label: "展厅 A",
        style: "museum",
        center: [0, 0],
        size: [6, 6],
        env: { surfaceKitId: "hp:human_museum_gallery_shell_v1" },
      },
      {
        id: "gallery_b",
        label: "展厅 B",
        style: "museum",
        center: [7, 0],
        size: [6, 6],
        env: { floorPresetId: "floor_museum_stone", wallPresetId: "wall_museum_stone", ceilingPresetId: "wall_museum_stone" },
      },
      { id: "exit", label: "出口", style: "exit", center: [14, 0], size: [5, 5] },
    ];

    expect(builderMapPresentationForProject(rooms)).toMatchObject({
      roomKit: "hp:human_museum_gallery_v1",
      lightingPreset: "hp:human_museum_gallery_lighting_v1",
      shellKit: "hp:human_museum_gallery_shell_v1",
    });
  });

  it("keeps the Level 4 Image2 clinic surface trio on the memory-clinic bridge", () => {
    const room: BuilderRoom = {
      id: "memory_clinic",
      label: "记忆诊所",
      style: "sterile",
      center: [0, 0],
      size: [6, 6],
      env: {
        floorPresetId: "floor_level04_memory_clinic_lab_image2_tileable_v4",
        wallPresetId: "wall_level04_memory_clinic_lab_image2_tileable_v4",
        ceilingPresetId: "ceiling_level04_memory_clinic_lab_image2_tileable_v4",
      },
    };

    expect(builderSurfaceKitForRoom(room)?.id).toBe("hp:memory_clinic_shell_v1");
    expect(officialSurfaceFieldsForBuilderRoom(room)).toMatchObject({
      skinKey: "memory_clinic_sterile",
      floorMaterialKey: "memory_clinic_floor",
      wallMaterialKey: "memory_clinic_wall",
      aesthetic: { style: "sterile", detail: "high" },
    });
  });

  it("keeps service elevator rooms out of the global museum shell", () => {
    expect(
      builderRoomEnvFromOfficialRoom(
        {
          id: "exit",
          label: "闭馆电梯",
          bounds: { center: [0, 0, 0], size: [6.4, 4, 5.4] },
          skinKey: "human_museum_gallery",
          floorMaterialKey: "museum_floor",
          wallMaterialKey: "service_elevator_metal",
          aesthetic: { style: "exit", detail: "high" },
          geometry: { renderFloor: true, renderWalls: false, collisionWalls: true },
        },
        { shellKit: "hp:human_museum_gallery_shell_v1" },
      ),
    ).toMatchObject({
      floorPresetId: "floor_dark_rubber",
      wallPresetId: "wall_dark_metal_panel",
      ceilingPresetId: "wall_dark_metal_panel",
      ceilingVisible: true,
    });
  });

  it("centralizes interaction visual model resolution", () => {
    expect(interactionVisualModelKey(interaction({ type: "exit", visualKey: "service_elevator_panel" }))).toBeNull();
    expect(interactionVisualModelKey(interaction({ type: "exit", visualKey: "exit_panel" }))).toBe("terminal_code_keypad");
    expect(interactionVisualModelKey(interaction({ type: "switch", id: "route_route_z43akm_panel", label: "路由管制台" }))).toBe("builder_route_switch_console");
    expect(interactionVisualModelKey(interaction({ visualKey: "none" }))).toBeNull();
  });

  it("keeps hosted interactions from baking duplicate standalone terminals", () => {
    expect(resolveBuilderInteractionBakeIntent(interaction({ visualKey: "none", anchorPropId: "wall_art" }))).toMatchObject({
      mode: "hosted_prop",
      bakeStandalone: false,
    });
    expect(resolveBuilderInteractionBakeIntent(interaction({ anchorPropId: "tool_vitrine" }), { hasPuzzleMachine: true })).toMatchObject({
      mode: "hosted_prop",
      bakeStandalone: false,
    });
    expect(resolveBuilderInteractionBakeIntent(interaction({ type: "exit", visualKey: "service_elevator_panel" }))).toMatchObject({
      mode: "exit_trigger_only",
      bakeExitFloorPad: false,
      bakeExitPanel: false,
      modelKey: null,
    });
    expect(resolveBuilderInteractionBakeIntent(interaction({ type: "exit", visualKey: "service_elevator_panel" }), { hasExitButtonProp: true })).toMatchObject({
      mode: "exit_trigger_only",
      bakeExitFloorPad: false,
      bakeExitPanel: false,
      modelKey: null,
    });
  });

  it("resolves visible host props while ignoring hidden placeholders", () => {
    const props: LevelMapPropDefinition[] = [
      { id: "hidden", roomId: "room", modelKey: "room_terminal_wall", position: [0.1, 0, 0.1], initiallyVisible: false },
      { id: "visible", roomId: "room", modelKey: "age_museum_wall_art_human_origin", position: [0.2, 0, 0.2] },
    ];

    expect(closestVisiblePropId("room", 0, 0, props, 1)).toBe("visible");
    expect(sourceHostPropForInteraction(interaction({ visualKey: "none", position: [0, 0, 0] }), props)).toEqual({
      hostPropId: "visible",
    });
  });

  it("recognizes legacy elevator button props even when saved drafts lost tags", () => {
    expect(
      isExitButtonPanelProp({
        id: "builder_exit_elevator_button_panel",
        roomId: "exit",
        modelKey: "terminal_code_keypad",
        position: [2.82, 0.78, -20.7],
        label: "出口电梯按钮面板",
      }),
    ).toBe(true);
    expect(
      isExitButtonPanelProp({
        id: "legacy_exit_panel",
        roomId: "exit",
        modelKey: "switch_panel_wall_cyan",
        position: [2.82, 0.78, -20.7],
        label: "出口电梯按钮面板",
      }),
    ).toBe(true);
    expect(
      isExitButtonPanelProp({
        id: "legacy_small_call_buttons",
        roomId: "exit",
        modelKey: "service_elevator_call_buttons",
        position: [2.82, 1.42, -20.7],
        label: "出口电梯呼叫按钮",
      }),
    ).toBe(true);
  });

  it("resolves color puzzle targets through one visual contract", () => {
    const component = {
      id: "component_blue",
      role: "orb_blue",
      roomId: "gallery",
      position: [14.5, 1.5],
      sourceTarget: {
        id: "orb_blue",
        y: 1.15,
        radius: 0.72,
        visualKey: "puzzle_orb_blue",
        anchorPropId: "blue_pedestal",
      },
    } as const;
    const actor = puzzleActorFromBuilderComponent(component, "blue");
    const target = colorPuzzleTargetFromBuilderComponent(component, "blue");

    expect(actor).toMatchObject({
      id: "orb_blue",
      role: "orb:blue",
      kind: "target",
      roomId: "gallery",
      position: [14.5, 1.15, 1.5],
      colorKey: "blue",
      inputMode: "weapon_hit",
      hitbox: { shape: "sphere", radius: 0.72 },
      anchorPropId: "blue_pedestal",
      targetId: "orb_blue",
    });
    expect(target).toMatchObject({
      id: "orb_blue",
      roomId: "gallery",
      position: [14.5, 1.15, 1.5],
      radius: 0.72,
      colorKey: "blue",
      visualKey: "puzzle_orb_blue",
      anchorPropId: "blue_pedestal",
    });
    expect(colorPuzzleTargetFromPuzzleActor(actor, "blue", "蓝色球")).toMatchObject(target);
    expect(resolvePuzzleTargetVisualIntent(target)).toMatchObject({
      colorKey: "blue",
      colorHex: "#4f8cff",
      modelKey: "age_museum_puzzle_orb_blue",
      visualKey: "puzzle_orb_blue",
      proxyHalfSize: [expect.closeTo(0.3456, 4), 0.705, expect.closeTo(0.3456, 4)],
      lightPosition: [14.5, 1.5499999999999998, 1.5],
    });

    const freeTarget = colorPuzzleTargetFromBuilderComponent(
      {
        id: "free_blue",
        role: "orb_blue",
        roomId: "gallery",
        position: [2, 3],
      },
      "blue",
    );
    expect(resolvePuzzleTargetVisualIntent(freeTarget)).toMatchObject({
      colorKey: "blue",
      modelKey: "puzzle_orb_free_blue",
      visualKey: "puzzle_orb_blue",
    });
  });

  it("keeps route-open-door progression actions ordered for objective-locked official doors", () => {
    const objectiveDoor: BuilderDoor = {
      id: "exit_door",
      fromRoomId: "gallery",
      toRoomId: "exit",
      lockType: "none",
      sourceDoor: {
        lock: { type: "objective_complete", objectiveId: "obj_route_exit" },
      },
    };
    const unlockedDoor: BuilderDoor = {
      id: "open_door",
      fromRoomId: "a",
      toRoomId: "b",
      lockType: "none",
    };

    expect(isRouteOpenDoorTargetAllowed(objectiveDoor)).toBe(true);
    expect(isRouteOpenDoorTargetAllowed(unlockedDoor)).toBe(true);
    expect(routeOpenDoorActions(objectiveDoor, objectiveDoor.id)).toEqual([
      { type: "complete_objective", objectiveId: "obj_route_exit" },
      { type: "unlock_door", doorId: "exit_door" },
      { type: "open_door", doorId: "exit_door" },
      { type: "focus_reveal", reveal: { kind: "door", doorId: "exit_door" } },
    ]);
  });
});
