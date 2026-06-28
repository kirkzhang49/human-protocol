import { describe, expect, it } from "vitest";
import { doorSwitchSmokeLevel } from "../smoke/doorSwitchSmokeLevel";
import type { LevelDefinition } from "../schema/levelConfig";
import { validateLevelConfig } from "../ConfigValidator";
import { explainPuzzle } from "./puzzleGraphValidator";

describe("puzzle graph wall switch reachability", () => {
  it("does not keep using resources behind a door after the player pulls a switch elsewhere", () => {
    const baseMap = doorSwitchSmokeLevel.map!;
    const level: LevelDefinition = {
      ...doorSwitchSmokeLevel,
      id: "smoke_door_switch_current_position",
      map: {
        ...baseMap,
        doors: baseMap.doors.map((door) =>
          door.id === "switch_entry_door"
            ? {
                ...door,
                lock: {
                  type: "switch_state",
                  switchId: "reroute_switch",
                  stateId: "idle",
                  manualOpen: false,
                  unlockedMessage: "入口回路门已打开。",
                },
              }
            : door,
        ),
        keyItems: [
          ...baseMap.keyItems,
          {
            id: "late_back_key",
            label: "回头钥匙",
            roomId: "switch_spawn_room",
            position: [0, 0, 5],
            collectRadius: 1.1,
            autoCollect: true,
            visualKey: "key_orb",
            requiredForDoorIds: [],
            requiresObjectiveId: "activate_reroute_switch",
          },
        ],
        interactions: baseMap.interactions.map((interaction) =>
          interaction.id === "use_switch_smoke_exit"
            ? { ...interaction, requiresObjectiveId: undefined, consumesKeyItemId: "late_back_key" }
            : interaction,
        ),
      },
      switches: doorSwitchSmokeLevel.switches?.map((definition) =>
        definition.id === "reroute_switch"
          ? { ...definition, oneShot: true, cycling: { ...definition.cycling, wrap: false } }
          : definition,
      ),
    };

    const graph = explainPuzzle(level);

    expect(graph.reachability.exitUnlocked).toBe(true);
    expect(graph.reachability.rooms).toEqual(expect.arrayContaining(["switch_spawn_room", "switch_control_room", "switch_exit_room"]));
    expect(graph.reachability.keyItems).not.toContain("late_back_key");
    expect(graph.reachability.exitInteractionReady).toBe(false);
    expect(graph.reachability.softlocks.some((softlock) => softlock.roomIds.includes("switch_exit_room"))).toBe(true);
    expect(validateLevelConfig(level).errors.map((issue) => issue.code)).toContain("graph.softlock.terminal");
  });

  it("keeps hit-sequence clue memory while a door switch reroutes the player away from the clue room", () => {
    const baseMap = doorSwitchSmokeLevel.map!;
    const level: LevelDefinition = {
      ...doorSwitchSmokeLevel,
      id: "smoke_door_switch_hit_sequence_memory",
      exit: {
        ...doorSwitchSmokeLevel.exit,
        unlockMessage: "灯序确认后出口通电。",
      },
      map: {
        ...baseMap,
        doors: baseMap.doors.map((door) =>
          door.id === "switch_entry_door"
            ? {
                ...door,
                lock: {
                  type: "switch_state",
                  switchId: "reroute_switch",
                  stateId: "idle",
                  manualOpen: false,
                  unlockedMessage: "入口回路门已打开。",
                },
              }
            : door,
        ),
        interactions: [
          ...baseMap.interactions.map((interaction) =>
            interaction.id === "use_switch_smoke_exit"
              ? { ...interaction, requiresObjectiveId: "solve_rerouted_hit_sequence" }
              : interaction,
          ),
          {
            id: "inspect_spawn_light_order",
            type: "story",
            roomId: "switch_spawn_room",
            position: [0, 1.2, 6.1],
            yaw: 0,
            radius: 1.6,
            visualKey: "puzzle_console_color_sequence",
            materialKey: "terminal_cyan",
            label: "入口灯序",
          },
        ],
      },
      switches: doorSwitchSmokeLevel.switches?.map((definition) =>
        definition.id === "reroute_switch"
          ? {
              ...definition,
              states: definition.states.map((state) =>
                state.id === "rerouted"
                  ? {
                      ...state,
                      actions: state.actions.filter((action) => action.type !== "unlock_exit"),
                    }
                  : state,
              ),
            }
          : definition,
      ),
      puzzles: [
        {
          id: "rerouted_hit_sequence",
          type: "hit_sequence",
          label: "改道灯序锁",
          roomId: "switch_control_room",
          clue: {
            type: "pattern_panel",
            roomId: "switch_spawn_room",
            interactionId: "inspect_spawn_light_order",
            sequence: ["control_green_orb", "exit_green_orb"],
            label: "入口看灯序，改道后继续打球。",
          },
          input: {
            method: "weapon_hit",
            resetOnMistake: true,
            showProgressPulse: true,
          },
          targets: [
            {
              id: "control_green_orb",
              label: "中间绿球",
              roomId: "switch_control_room",
              position: [-1.4, 1.2, -1.2],
              radius: 0.7,
              colorKey: "green",
              visualKey: "puzzle_orb_green",
            },
            {
              id: "exit_green_orb",
              label: "出口绿球",
              roomId: "switch_exit_room",
              position: [1.4, 1.2, -7.3],
              radius: 0.7,
              colorKey: "green",
              visualKey: "puzzle_orb_green",
            },
          ],
          success: {
            unlockExit: true,
            completesObjectiveId: "solve_rerouted_hit_sequence",
            rewardPulse: { label: "灯序确认", detail: "入口记忆仍然有效", rarity: "epic" },
          },
        },
      ],
      objectiveChain: [
        ...(doorSwitchSmokeLevel.objectiveChain ?? []),
        {
          id: "solve_rerouted_hit_sequence",
          type: "custom",
          title: "解改道灯序",
          detail: "入口看过灯序后，即使门控切走入口，也能继续完成颜色球顺序。",
          requiredIds: ["rerouted_hit_sequence"],
          startsWhen: { type: "switch_activated", id: "reroute_switch", optionId: "rerouted" },
          completesWhen: { type: "puzzle_completed", id: "rerouted_hit_sequence" },
          hudLabel: "灯序",
        },
      ],
    };

    const graph = explainPuzzle(level);

    expect(graph.reachability.puzzles).toContain("rerouted_hit_sequence");
    expect(graph.reachability.exitUnlocked).toBe(true);
    expect(graph.reachability.exitInteractionReady).toBe(true);
    const stepIds = graph.reachability.solutionPath.map((step) => step.id);
    expect(stepIds.indexOf("inspect_spawn_light_order")).toBeLessThan(stepIds.indexOf("reroute_switch:rerouted"));
    expect(stepIds).toEqual(expect.arrayContaining(["rerouted_hit_sequence", "use_switch_smoke_exit"]));
    expect(graph.reachability.softlocks).toEqual([]);
  });

  it("applies room-entered runtime events before checking whether the exit interaction is ready", () => {
    const level: LevelDefinition = {
      ...doorSwitchSmokeLevel,
      id: "smoke_door_switch_exit_event",
      switches: doorSwitchSmokeLevel.switches?.map((definition) =>
        definition.id === "reroute_switch"
          ? {
              ...definition,
              states: definition.states.map((state) =>
                state.id === "rerouted"
                  ? {
                      ...state,
                      actions: state.actions.filter((action) => action.type !== "unlock_exit"),
                    }
                  : state,
              ),
            }
          : definition,
      ),
      events: [
        {
          id: "unlock_exit_when_exit_room_reached",
          trigger: { type: "room_entered", id: "switch_exit_room" },
          once: true,
          actions: [{ type: "unlock_exit" }],
        },
      ],
    };

    const graph = explainPuzzle(level);

    expect(graph.reachability.exitUnlocked).toBe(true);
    expect(graph.reachability.exitInteractionReady).toBe(true);
    expect(graph.reachability.solutionPath.map((step) => step.id)).toContain("use_switch_smoke_exit");
  });
});
