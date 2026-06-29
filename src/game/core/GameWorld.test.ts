import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createPuzzleInstanceForDoor } from "../../build/BuilderPuzzleCatalog";
import { compileBuilderProjectToLevel } from "../../build/compileBuilderProjectToLevel";
import { createStarterProject } from "../../build/BuilderTypes";
import { toggleStatesForWallDoorSwitch } from "../../build/BuilderWallDoorSwitches";
import { maintenanceBayDialogue } from "../config/dialogueScripts";
import { PickupSystem } from "../systems/PickupSystem";
import { WaveDirectorSystem } from "../systems/WaveDirectorSystem";
import { WaveTriggerBridgeSystem } from "../systems/WaveTriggerBridgeSystem";
import { focusRevealBlend } from "../../render/focusRevealCamera";
import { exitButtonPressLeadIn } from "./ExitFlowStateMachine";
import { exitAscentProgress, exitElevatorButtonVisualState, exitElevatorShaftVisualState } from "./ExitCinematicTiming";
import { GameWorld } from "./GameWorld";

function configuredDoorSurviveWaveIds(world: GameWorld, doorId: string) {
  const door = world.level.map?.doors.find((candidate) => candidate.id === doorId);
  expect(door?.lock.type).toBe("survive_wave");
  if (!door || door.lock.type !== "survive_wave") return [];
  return [...new Set([...(door.lock.waveIds ?? []), ...(door.lock.waveId ? [door.lock.waveId] : [])])];
}

describe("GameWorld dialogue timing", () => {
  it("queues broadcast toasts at half their authored duration", () => {
    const world = new GameWorld();
    const authored = maintenanceBayDialogue.find((line) => line.trigger === "level_start");

    expect(authored).toBeDefined();

    world.queueDialogue("level_start");

    expect(world.session.dialogueQueue).toHaveLength(1);
    expect(world.session.dialogueQueue[0].total).toBeCloseTo((authored?.duration ?? 0) * 0.5);
    expect(world.session.dialogueQueue[0].remaining).toBe(world.session.dialogueQueue[0].total);
  });
});

describe("GameWorld progression doors", () => {
  it("requires every selected prerequisite puzzle before a multi-puzzle door can open", () => {
    const world = new GameWorld();
    const door = {
      id: "multi_puzzle_gate",
      label: "组合谜题门",
      fromRoomId: "room_a",
      toRoomId: "room_b",
      position: [0, 0, -4],
      size: [3, 2.8, 0.42],
      yaw: 0,
      defaultState: "closed",
      visualKey: "door",
      lock: {
        type: "puzzle_complete",
        puzzleId: "puzzle_a",
        puzzleIds: ["puzzle_a", "puzzle_b"],
      },
    } as any;

    expect(world.canOpenDoor(door)).toBe(false);
    world.session.mapProgress.completedPuzzleIds.push("puzzle_a");
    expect(world.canOpenDoor(door)).toBe(false);
    world.session.mapProgress.completedPuzzleIds.push("puzzle_b");
    expect(world.canOpenDoor(door)).toBe(true);
  });

  it("uses one reveal-synced door open for Level 3 color orbs", () => {
    const world = new GameWorld();
    world.loadLevel("level_03_human_museum", "playing");
    world.session.mapProgress.hitSequencePlaybackSeen.builder_color_lock = true;

    for (const targetId of ["orb_red", "orb_blue", "orb_yellow", "orb_green", "orb_purple"]) {
      expect(world.hitConfiguredPuzzleTarget("builder_color_lock", targetId, "railLance")).toBe(true);
    }

    expect(world.isDoorOpen("level_03_archive_door")).toBe(true);
    expect(world.session.activeFocusReveal).toMatchObject({
      kind: "door",
      targetId: "level_03_archive_door",
      doorMode: "open",
    });
    expect(world.session.doorRevealQueue).toHaveLength(0);
  });

  it("does not queue a second Level 3 route door reveal after the explicit reveal", () => {
    const world = new GameWorld();
    world.loadLevel("level_03_human_museum", "playing");
    expect(world.grantConfiguredKeyItem("route_route_z43akm_out_1_route_out_yf_key")).toBe(true);

    expect(world.chooseRouteSwitchState("route_route_z43akm", "out_1_route_out_yf")).toBe(true);

    expect(world.isDoorOpen("level_03_official_exit_door")).toBe(true);
    expect(world.session.activeFocusReveal).toMatchObject({
      kind: "door",
      targetId: "level_03_official_exit_door",
      doorMode: "open",
    });
    expect(world.session.doorRevealQueue).toHaveLength(0);
  });

  it("activates the Level 3 route switch target state during objective smoke flow", () => {
    const world = new GameWorld();
    world.loadLevel("level_03_human_museum", "playing");
    world.session.mapProgress.activeObjectiveId = "obj_route_level_03_official_exit_door";

    expect(world.activateSwitch("route_route_z43akm")).toBe(true);

    expect(world.session.mapProgress.activatedSwitchIds).toContain("route_route_z43akm:out_1_route_out_yf");
    expect(world.session.mapProgress.completedObjectiveIds).toContain("obj_route_level_03_official_exit_door");
    expect(world.isDoorOpen("level_03_official_exit_door")).toBe(true);
  });

  it("opens Level 2 care room door after its configured builder gate wave is cleared", () => {
    const world = new GameWorld();
    world.loadLevel("level_02_residential_simulation", "playing");

    world.dispatchObjectiveEvent({ type: "level_start" });
    expect(world.openConfiguredDoor("level_02_living_room_door")).toBe(true);
    expect(world.isDoorOpen("level_02_care_room_door")).toBe(false);

    world.markWaveCompleted("level_02_living_swarm");

    expect(world.isDoorOpen("level_02_care_room_door")).toBe(false);
    for (const waveId of configuredDoorSurviveWaveIds(world, "level_02_care_room_door")) {
      world.markWaveCompleted(waveId);
    }

    expect(world.isDoorOpen("level_02_care_room_door")).toBe(true);
    expect(world.session.mapProgress.completedObjectiveIds).toContain("obj_survive_level_02_care_room_door");
    expect(world.session.mapProgress.completedObjectiveIds).toContain("obj_open_level_02_care_room_door");
    expect(world.session.mapProgress.activeObjectiveId).toBe("obj_collect_level_02_light_room_door");
  });

  it("opens builder multi-wave doors only after the final required wave and frames the door", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_wave_gate";
    project.robots = [
      {
        id: "wave_gate_robot_1",
        label: "第一波守门组",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 1,
        waveChain: { waveId: "builder_wave_gate_1", order: 1, label: "波次 1" },
      },
      {
        id: "wave_gate_robot_2",
        label: "第二波守门组",
        roomId: "room_fight",
        archetype: "shield_tech",
        count: 1,
        waveChain: { waveId: "builder_wave_gate_2", order: 2, label: "波次 2" },
      },
    ];
    project.doors = project.doors.map((door) =>
      door.id === "door_d"
        ? { ...door, lockType: "survive_wave", waveIds: ["builder_wave_gate_1", "builder_wave_gate_2"], waveId: undefined }
        : door,
    );
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");

    expect(world.isDoorOpen("door_d")).toBe(false);

    world.markWaveCompleted("builder_wave_gate_1");

    expect(world.isDoorOpen("door_d")).toBe(false);
    expect(world.session.activeFocusReveal).toBeNull();

    world.markWaveCompleted("builder_wave_gate_2");

    expect(world.isDoorOpen("door_d")).toBe(true);
    expect(world.session.activeFocusReveal).toMatchObject({
      kind: "door",
      targetId: "door_d",
    });
  });

  it("runs builder room-entry prelude robots before wave 1 instead of spawning both together", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_room_entry_prelude_before_wave_one";
    project.robots = [
      {
        id: "room_entry_robot",
        label: "进门触发守卫",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 1,
      },
      {
        id: "wave_one_robot",
        label: "波次 1 守卫",
        roomId: "room_fight",
        archetype: "clamp_bot",
        count: 1,
        waveChain: { waveId: "builder_wave_one", order: 1, label: "波次 1" },
      },
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(compiled.level!.waves.find((wave) => wave.id === "wave_room_fight")?.trigger).toMatchObject({
      type: "room_entered",
      id: "room_fight",
    });
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_wave_one")?.trigger).toBeUndefined();
    expect(compiled.level!.events?.some((event) =>
      event.trigger.type === "wave_completed" &&
      event.trigger.id === "wave_room_fight" &&
      event.actions.some((action) => action.type === "start_wave" && action.waveId === "builder_wave_one"),
    )).toBe(true);

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("wave_room_fight");
    expect(world.enemies.some((enemy) => enemy.waveId === "wave_room_fight" && enemy.isAlive)).toBe(true);
    expect(world.enemies.some((enemy) => enemy.waveId === "builder_wave_one" && enemy.isAlive)).toBe(false);

    world.enemies.forEach((enemy) => {
      if (enemy.waveId === "wave_room_fight") enemy.isAlive = false;
    });
    director.update(world, 0.1);

    expect(world.session.pendingWaveStarts.some((pending) => pending.waveId === "builder_wave_one")).toBe(true);

    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_wave_one");
    expect(world.enemies.some((enemy) => enemy.waveId === "builder_wave_one" && enemy.isAlive)).toBe(true);
  });

  it("serializes multiple builder room-entry prelude waves before wave 1", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_multiple_room_entry_preludes";
    project.robots = [
      {
        id: "source_entry_a",
        label: "进门前置 A",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 1,
        wave: { id: "source_entry_wave_a", triggerType: "room_entered", triggerId: "room_fight" },
      },
      {
        id: "source_entry_b",
        label: "进门前置 B",
        roomId: "room_fight",
        archetype: "shield_tech",
        count: 1,
        wave: { id: "source_entry_wave_b", triggerType: "room_entered", triggerId: "room_fight" },
      },
      {
        id: "wave_one_after_prelude",
        label: "波次 1",
        roomId: "room_fight",
        archetype: "clamp_bot",
        count: 1,
        waveChain: { waveId: "builder_wave_after_preludes", order: 1, label: "波次 1" },
      },
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(compiled.level!.waves.find((wave) => wave.id === "source_entry_wave_a")?.trigger).toMatchObject({
      type: "room_entered",
      id: "room_fight",
    });
    expect(compiled.level!.waves.find((wave) => wave.id === "source_entry_wave_b")?.trigger).toBeUndefined();
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_wave_after_preludes")?.trigger).toBeUndefined();
    expect(compiled.level!.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trigger: { type: "wave_completed", id: "source_entry_wave_a" },
          actions: [expect.objectContaining({ type: "start_wave", waveId: "source_entry_wave_b" })],
        }),
        expect.objectContaining({
          trigger: { type: "wave_completed", id: "source_entry_wave_b" },
          actions: [expect.objectContaining({ type: "start_wave", waveId: "builder_wave_after_preludes" })],
        }),
      ]),
    );
  });

  it("merges stale same-order builder wave ids so wave 1 robots spawn together", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_same_order_wave_ids_merge";
    project.robots = [
      {
        id: "wave_one_a",
        label: "波次 1 A",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 1,
        waveChain: { waveId: "builder_wave_one_a", order: 1, label: "波次 1" },
      },
      {
        id: "wave_one_b",
        label: "波次 1 B",
        roomId: "room_fight",
        archetype: "clamp_bot",
        count: 1,
        waveChain: { waveId: "builder_wave_one_b", order: 1, label: "波次 1" },
      },
    ];
    project.doors = project.doors.map((door) =>
      door.id === "door_d"
        ? { ...door, lockType: "survive_wave", waveId: "builder_wave_one_b", waveIds: ["builder_wave_one_b"] }
        : door,
    );

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(compiled.level!.waves.filter((wave) => wave.id.startsWith("builder_wave_one_")).map((wave) => wave.id)).toEqual(["builder_wave_one_a"]);
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_wave_one_a")?.enemies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ archetype: "repair_drone", count: 1 }),
        expect.objectContaining({ archetype: "clamp_bot", count: 1 }),
      ]),
    );
    expect(compiled.level!.map?.doors.find((door) => door.id === "door_d")?.lock).toMatchObject({
      type: "survive_wave",
      waveId: "builder_wave_one_a",
    });

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_wave_one_a");
    expect(world.enemies.filter((enemy) => enemy.waveId === "builder_wave_one_a" && enemy.isAlive)).toHaveLength(2);
  });

  it("keeps same-order builder wave chains scoped to their owning rooms", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_room_scoped_wave_chain_order";
    project.doors = project.doors.map((door) =>
      door.id === "door_d"
        ? { ...door, lockType: "none", waveId: undefined, waveIds: undefined, surviveRobotIds: undefined }
        : door,
    );
    project.robots = [
      {
        id: "hall_wave_one_robot",
        label: "候诊室波次 1",
        roomId: "room_hall",
        archetype: "repair_drone",
        count: 1,
        waveChain: { waveId: "builder_hall_wave_one", order: 1, label: "候诊室波次 1" },
      },
      {
        id: "fight_wave_one_boss",
        label: "治疗剧场波次 1",
        roomId: "room_fight",
        archetype: "custodian_elite",
        tier: "leader",
        count: 1,
        waveChain: { waveId: "builder_fight_wave_one", order: 1, label: "治疗剧场波次 1" },
      },
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_hall_wave_one")).toMatchObject({
      roomId: "room_hall",
      trigger: { type: "room_entered", id: "room_hall", delay: 0.4 },
    });
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_fight_wave_one")).toMatchObject({
      roomId: "room_fight",
      trigger: { type: "room_entered", id: "room_fight", delay: 0.4 },
    });

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_hall");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_hall_wave_one");
    expect(world.enemies.filter((enemy) => enemy.waveId === "builder_hall_wave_one" && enemy.isAlive)).toHaveLength(1);
    expect(world.enemies.some((enemy) => enemy.waveId === "builder_fight_wave_one" && enemy.isAlive)).toBe(false);
    expect(world.enemies.find((enemy) => enemy.waveId === "builder_hall_wave_one")?.spawnRoomId).toBe("room_hall");

    world.enemies.forEach((enemy) => {
      if (enemy.waveId === "builder_hall_wave_one") enemy.isAlive = false;
    });
    director.update(world, 0.1);

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_fight_wave_one");
    expect(world.enemies.filter((enemy) => enemy.waveId === "builder_fight_wave_one" && enemy.isAlive)).toHaveLength(1);
    expect(world.enemies.find((enemy) => enemy.waveId === "builder_fight_wave_one")?.spawnRoomId).toBe("room_fight");
  });

  it("splits cached duplicate builder wave ids across rooms before compiling playtest waves", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_duplicate_wave_id_rooms_split";
    project.doors = project.doors.map((door) =>
      door.id === "door_d"
        ? { ...door, lockType: "survive_wave", surviveRobotIds: ["fight_shared_wave"], surviveRobotId: "fight_shared_wave", waveId: "cached_wave_one", waveIds: ["cached_wave_one"] }
        : door,
    );
    project.robots = [
      {
        id: "hall_shared_wave",
        label: "候诊室缓存波次 1",
        roomId: "room_hall",
        archetype: "repair_drone",
        count: 1,
        waveChain: { waveId: "cached_wave_one", order: 1, label: "波次 1" },
      },
      {
        id: "fight_shared_wave",
        label: "后房间缓存波次 1",
        roomId: "room_fight",
        archetype: "custodian_elite",
        tier: "leader",
        count: 1,
        waveChain: { waveId: "cached_wave_one", order: 1, label: "波次 1" },
      },
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    const compiledWaves = compiled.level!.waves.filter((wave) => wave.id.startsWith("cached_wave_one"));
    expect(compiledWaves).toHaveLength(2);
    const hallWave = compiledWaves.find((wave) => wave.roomId === "room_hall");
    const fightWave = compiledWaves.find((wave) => wave.roomId === "room_fight");
    expect(hallWave).toMatchObject({
      id: "cached_wave_one",
      roomId: "room_hall",
      trigger: { type: "room_entered", id: "room_hall", delay: 0.4 },
    });
    expect(hallWave?.enemies).toEqual([expect.objectContaining({ archetype: "repair_drone", count: 1 })]);
    expect(fightWave?.id).not.toBe("cached_wave_one");
    expect(fightWave).toMatchObject({
      roomId: "room_fight",
      trigger: { type: "room_entered", id: "room_fight", delay: 0.4 },
    });
    expect(fightWave?.enemies).toEqual([expect.objectContaining({ archetype: "custodian_elite", count: 1 })]);
    expect(compiled.level!.map?.doors.find((door) => door.id === "door_d")?.lock).toMatchObject({
      type: "survive_wave",
      waveId: fightWave?.id,
    });

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_hall");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("cached_wave_one");
    expect(world.enemies.filter((enemy) => enemy.waveId === "cached_wave_one" && enemy.isAlive)).toHaveLength(1);
    expect(world.enemies.some((enemy) => enemy.waveId === fightWave?.id && enemy.isAlive)).toBe(false);
  });

  it("does not advance builder wave chains across rooms before the player enters that room", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_room_scoped_wave_chain_events";
    project.doors = project.doors.map((door) =>
      door.id === "door_d"
        ? { ...door, lockType: "none", waveId: undefined, waveIds: undefined, surviveRobotIds: undefined }
        : door,
    );
    project.robots = [
      {
        id: "hall_wave_one_robot",
        label: "候诊室波次 1",
        roomId: "room_hall",
        archetype: "repair_drone",
        count: 1,
        waveChain: { waveId: "builder_hall_chain_1", order: 1, label: "候诊室波次 1" },
      },
      {
        id: "fight_wave_two_boss",
        label: "治疗剧场波次 2",
        roomId: "room_fight",
        archetype: "custodian_elite",
        tier: "leader",
        count: 1,
        waveChain: { waveId: "builder_fight_chain_2", order: 2, label: "治疗剧场波次 2" },
      },
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_hall_chain_1")?.trigger).toMatchObject({
      type: "room_entered",
      id: "room_hall",
    });
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_fight_chain_2")?.trigger).toMatchObject({
      type: "room_entered",
      id: "room_fight",
    });
    expect(compiled.level!.events?.some((event) =>
      event.trigger.type === "wave_completed" &&
      event.trigger.id === "builder_hall_chain_1" &&
      event.actions.some((action) => action.type === "start_wave" && action.waveId === "builder_fight_chain_2"),
    )).toBe(false);

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_hall");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_hall_chain_1");
    world.enemies.forEach((enemy) => {
      if (enemy.waveId === "builder_hall_chain_1") enemy.isAlive = false;
    });
    director.update(world, 0.1);

    expect(world.session.pendingWaveStarts.some((pending) => pending.waveId === "builder_fight_chain_2")).toBe(false);
    expect(world.enemies.some((enemy) => enemy.waveId === "builder_fight_chain_2" && enemy.isAlive)).toBe(false);

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_fight_chain_2");
    expect(world.enemies.find((enemy) => enemy.waveId === "builder_fight_chain_2")?.spawnRoomId).toBe("room_fight");
  });

  it("does not start inferred-room waves while their spawn room is behind a closed door", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_inferred_spawn_room_gate";
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();

    const level = {
      ...compiled.level!,
      initialWaveStartDelay: 0,
      requiresStoryPickupsBeforeWaves: false,
      waves: [
        {
          id: "legacy_locked_room_wave",
          startDelay: 0,
          enemies: [{ archetype: "repair_drone" as const, count: 1, from: "sg_locked_fight_room" }],
          reward: "none" as const,
        },
      ],
      spawnGroups: [
        ...(compiled.level!.spawnGroups ?? []),
        {
          id: "sg_locked_fight_room",
          label: "锁门后的机房",
          layout: "front" as const,
          positions: [[0, 0, -5] as const],
        },
      ],
    };

    const world = new GameWorld();
    world.level = level;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    world.setCurrentRoom("room_hall");

    const director = new WaveDirectorSystem();
    director.update(world, 1);

    expect(world.session.activeWaveId).toBeNull();
    expect(world.enemies.some((enemy) => enemy.waveId === "legacy_locked_room_wave" && enemy.isAlive)).toBe(false);

    world.openConfiguredDoor("door_c", { force: true });
    director.update(world, 1);

    expect(world.session.activeWaveId).toBe("legacy_locked_room_wave");
    expect(world.enemies.find((enemy) => enemy.waveId === "legacy_locked_room_wave" && enemy.isAlive)?.spawnRoomId).toBe("room_fight");
  });

  it("keeps room wave spawns out of the player's immediate view", () => {
    const project = createStarterProject();
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();

    const baseLevel = compiled.level!;
    const roomId = baseLevel.map?.rooms[0]?.id ?? "room_spawn";
    const spawnPoint = baseLevel.spawnPoint;
    const closeSpawn: readonly [number, number, number] = [spawnPoint[0], 0, spawnPoint[2] + 0.85];
    const level = {
      ...baseLevel,
      waves: [
        {
          id: "near_view_wave",
          startDelay: 0,
          roomId,
          trigger: { type: "room_entered" as const, id: roomId, delay: 0 },
          enemies: [{ archetype: "repair_drone" as const, count: 1, from: "sg_near_view" }],
          reward: "none" as const,
        },
      ],
      spawnGroups: [
        {
          id: "sg_near_view",
          label: "玩家眼前",
          layout: "front",
          positions: [closeSpawn],
        },
      ],
    };

    const world = new GameWorld();
    world.level = level;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    world.player.position.set(spawnPoint[0], 0, spawnPoint[2]);
    world.player.aimDirection.set(0, 0, 1);

    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();
    world.setCurrentRoom(roomId);
    trigger.update(world);
    director.update(world, 0.5);

    const enemy = world.enemies.find((candidate) => candidate.waveId === "near_view_wave" && candidate.isAlive);
    expect(enemy).toBeDefined();
    expect(enemy!.position.distanceTo(world.player.position)).toBeGreaterThanOrEqual(2.75);
  });

  it("opens a builder wall door switch target on the first press even when the stored initial state is stale", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_wall_switch_first_press";
    const targetDoor = project.doors.find((door) => door.id === "door_d");
    expect(targetDoor).toBeDefined();
    project.wallDoorSwitches = [
      {
        id: "wall_switch_first_press",
        label: "墙面门控把手",
        roomId: targetDoor!.fromRoomId,
        wallMount: { side: "east", offset: 0, height: 1.34, inset: 0.18 },
        initialStateId: "open",
        oneShot: false,
        states: [
          { id: "open", label: "打开", openDoorIds: [targetDoor!.id], message: "打开通路。" },
          { id: "closed", label: "关闭", closeDoorIds: [targetDoor!.id], message: "关闭通路。" },
        ],
      },
    ];
    project.doors = project.doors.map((door) =>
      door.id === targetDoor!.id
        ? {
            ...door,
            lockType: "switch_state",
            wallDoorSwitchId: "wall_switch_first_press",
            wallDoorSwitchStateId: "open",
          }
        : door,
    );

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    const switchDefinition = compiled.level!.switches?.find((candidate) => candidate.id.includes("wall_switch_first_press"));
    expect(switchDefinition).toBeDefined();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");

    expect(world.isDoorOpen(targetDoor!.id)).toBe(false);
    expect(world.openConfiguredDoor(targetDoor!.id)).toBe(false);
    expect(world.doorTransitionRevision(targetDoor!.id)).toBe(0);
    expect(world.beginSwitchHandInteraction(switchDefinition!.id)).toBe(true);

    world.updateHandInteraction(0.5);

    expect(world.isDoorOpen(targetDoor!.id)).toBe(true);
    expect(world.doorTransitionRevision(targetDoor!.id)).toBe(1);
    expect(world.session.mapProgress.activeSwitchStateIds[switchDefinition!.id]).toBe("state_1_open");
    expect(world.session.activeFocusReveal).toBeNull();
    expect(world.session.doorRevealQueue[0]).toMatchObject({
      doorId: targetDoor!.id,
      mode: "open",
      durationSec: 2,
    });
    expect(world.session.doorRevealQueue).toHaveLength(1);

    world.updateHandInteraction(0.4);

    expect(world.session.activeFocusReveal).toMatchObject({
      kind: "door",
      targetId: targetDoor!.id,
      duration: 2,
    });

    world.updateFocusReveal(2.1);
    expect(world.beginSwitchHandInteraction(switchDefinition!.id)).toBe(true);
    world.updateHandInteraction(0.9);

    expect(world.isDoorOpen(targetDoor!.id)).toBe(false);
    expect(world.doorTransitionRevision(targetDoor!.id)).toBe(2);
    expect(world.session.mapProgress.activeSwitchStateIds[switchDefinition!.id]).toBe("state_2_closed");
  });

  it("frames close door reveals from the opposite side of the opening reveal", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_wall_switch_close_camera";
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    const door = compiled.level!.map?.doors.find((candidate) => candidate.id === "door_d");
    expect(door).toBeDefined();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    world.setCurrentRoom(door!.fromRoomId);

    const reveal = { kind: "door" as const, doorId: door!.id, cameraMode: "door_front" as const, durationSec: 2 };
    world.beginFocusReveal(reveal, undefined, "open");
    const openReveal = world.session.activeFocusReveal;
    expect(openReveal).toMatchObject({
      targetId: door!.id,
      roomId: door!.fromRoomId,
      doorMode: "open",
    });

    world.session.activeFocusReveal = null;
    world.beginFocusReveal(reveal, undefined, "close");
    const closeReveal = world.session.activeFocusReveal;
    expect(closeReveal).toMatchObject({
      targetId: door!.id,
      roomId: door!.toRoomId,
      doorMode: "close",
    });

    const doorPosition = new Vector3(door!.position[0], 0, door!.position[2]);
    const forward = new Vector3(Math.sin(door!.yaw), 0, Math.cos(door!.yaw)).normalize();
    const openCamera = new Vector3(openReveal!.cameraPosition[0], 0, openReveal!.cameraPosition[2]);
    const closeCamera = new Vector3(closeReveal!.cameraPosition[0], 0, closeReveal!.cameraPosition[2]);
    const openSide = openCamera.sub(doorPosition).dot(forward);
    const closeSide = closeCamera.sub(doorPosition).dot(forward);
    expect(openSide * closeSide).toBeLessThan(0);
  });

  it("frames remote door reveals from the rectangular side when the other side is a shaped room", () => {
    const world = new GameWorld();
    world.loadLevel("level_04_memory_clinic", "playing");
    world.setCurrentRoom("level_04_therapy_theater");

    expect(world.isDoorOpen("door_d42uh6")).toBe(false);

    world.markWaveCompleted("wave_yjxxy4");

    const reveal = world.session.activeFocusReveal;
    expect(world.isDoorOpen("door_d42uh6")).toBe(true);
    expect(reveal).toMatchObject({
      kind: "door",
      targetId: "door_d42uh6",
      roomId: "level_04_entry_decon",
      doorMode: "open",
      cameraCut: true,
    });
    expect(reveal?.cameraPosition[2]).toBeLessThan(reveal?.targetPosition[2] ?? Number.NEGATIVE_INFINITY);
  });

  it("aims robot focus reveals at an elite or boss enemy in the spawned room", () => {
    const project = createStarterProject();
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    world.spawnEnemy("repair_drone", "test_wave", new Vector3(-2, 0, 1), 0, { tier: "normal" }, { spawnRoomId: "room_archive" });
    const elite = world.spawnEnemy("custodian_elite", "test_wave", new Vector3(-7, 0, 2), 0, { tier: "elite" }, { spawnRoomId: "room_archive" });

    world.beginFocusReveal({ kind: "robot", roomId: "room_archive", cameraMode: "door_front", durationSec: 3 });

    expect(world.session.activeFocusReveal).toMatchObject({
      kind: "robot",
      targetId: `enemy:${elite.id}`,
      roomId: "room_archive",
      duration: 3,
    });
    expect(world.session.activeFocusReveal?.targetPosition[0]).toBeCloseTo(elite.position.x);
    expect(world.session.activeFocusReveal?.targetPosition[2]).toBeCloseTo(elite.position.z);
  });

  it("keeps robot focus reveals tracked to the selected moving enemy", () => {
    const project = createStarterProject();
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const elite = world.spawnEnemy("custodian_elite", "test_wave", new Vector3(-7, 0, 2), 0, { tier: "elite" }, { spawnRoomId: "room_archive" });

    world.beginFocusReveal({ kind: "robot", roomId: "room_archive", cameraMode: "door_front", durationSec: 3 });
    elite.position.x = -5.5;
    elite.position.z = 3.2;
    world.updateFocusReveal(0.1);

    expect(world.session.activeFocusReveal?.targetPosition[0]).toBeCloseTo(elite.position.x);
    expect(world.session.activeFocusReveal?.targetPosition[2]).toBeCloseTo(elite.position.z);
  });

  it("starts route robot waves before the focus reveal so the shot frames the boss", () => {
    const project = createStarterProject();
    project.doors = project.doors.map((door) => ({ ...door, lockType: "none" as const }));
    project.robots = [
      {
        id: "route_boss",
        label: "回收主管",
        roomId: "room_archive",
        archetype: "custodian_elite",
        count: 1,
        position: [-7, 2],
        tier: "boss",
      },
      {
        id: "route_add",
        label: "回收助手",
        roomId: "room_archive",
        archetype: "repair_drone",
        count: 1,
        position: [-5, 1],
      },
    ];
    project.routeSwitches = [
      {
        id: "route_robot_reveal",
        label: "管制路由台",
        roomId: "room_hall",
        keyRoomId: "room_hall",
        position: [2, 3],
        rotationY: 0,
        outputs: [
          {
            id: "out_robots",
            kind: "start_robots",
            robotRoomId: "room_archive",
          },
        ],
      },
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    const route = compiled.level!.switches?.find((entry) => entry.id === "route_route_robot_reveal");
    const state = route?.states.find((candidate) => candidate.id === "out_1_out_robots");
    expect(route).toBeDefined();
    expect(state).toBeDefined();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    world.player.position.set(-7, 0, 4);
    for (const key of world.level.map?.keyItems ?? []) {
      world.grantConfiguredKeyItem(key.id);
    }
    world.openRouteSwitch(route!.id);
    expect(world.session.mode).toBe("routeSwitch");

    expect(world.chooseRouteSwitchState(route!.id, state!.id)).toBe(true);
    expect(world.session.mode).toBe("playing");
    expect(world.session.activeRouteSwitchId).toBeNull();

    const boss = world.enemies.find((enemy) => enemy.waveId === world.session.activeWaveId && enemy.tier === "boss");
    expect(boss).toBeDefined();
    expect(boss!.position.x).toBeCloseTo(-7);
    expect(boss!.position.z).toBeCloseTo(2);
    expect(boss!.spawnAge).toBeGreaterThanOrEqual(0.44);
    expect(world.session.activeFocusReveal).toMatchObject({
      kind: "robot",
      targetId: `enemy:${boss!.id}`,
      roomId: "room_archive",
      duration: 3,
      cameraCut: true,
    });
    const reveal = world.session.activeFocusReveal!;
    const cameraDistance = Math.hypot(reveal.cameraPosition[0] - reveal.targetPosition[0], reveal.cameraPosition[2] - reveal.targetPosition[2]);
    expect(cameraDistance).toBeGreaterThanOrEqual(2.55);
    expect(cameraDistance).toBeLessThanOrEqual(2.9);
    expect(reveal.cameraPosition[2]).toBeGreaterThan(reveal.targetPosition[2]);
  });

  it("offsets remote door reveal cameras away from visible blockers in front of the door", () => {
    const world = new GameWorld();
    world.loadLevel("level_04_memory_clinic", "playing");
    world.level = {
      ...world.level,
      map: {
        ...world.level.map!,
        props: [
          ...(world.level.map?.props ?? []),
          {
            id: "test_reveal_blocker",
            roomId: "level_04_entry_decon",
            modelKey: "test_reveal_blocker",
            position: [0, 1.2, 18.65],
            collider: { halfSize: [0.9, 1.2, 0.55] },
          },
        ],
      },
    };
    world.setCurrentRoom("level_04_therapy_theater");

    world.markWaveCompleted("wave_yjxxy4");

    const reveal = world.session.activeFocusReveal;
    expect(reveal).toMatchObject({
      kind: "door",
      targetId: "door_d42uh6",
      roomId: "level_04_entry_decon",
      cameraCut: true,
    });
    expect(Math.abs(reveal?.cameraPosition[0] ?? 0)).toBeGreaterThan(0.9);
  });

  it("requires a key or puzzle door to be unlocked once before a wall switch can control it as an inverse door", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_wall_switch_inverse_key";
    project.wallDoorSwitches = [
      {
        id: "wall_switch_inverse_key",
        label: "反向钥匙门把手",
        roomId: "room_hall",
        wallMount: { side: "east", offset: 0, height: 1.34, inset: 0.18 },
        mode: "toggle",
        primaryDoorId: "door_b",
        inverseDoorId: "door_c",
        initialStateId: "closed",
        oneShot: false,
        states: toggleStatesForWallDoorSwitch("door_b", "door_c"),
      },
    ];
    project.doors = project.doors.map((door) =>
      door.id === "door_b"
        ? {
            ...door,
            lockType: "switch_state",
            wallDoorSwitchId: "wall_switch_inverse_key",
            wallDoorSwitchStateId: "open",
          }
        : door.id === "door_c"
          ? { ...door, lockType: "key_item", keyRoomId: "room_archive" }
          : door,
    );

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    const switchDefinition = compiled.level!.switches?.find((candidate) => candidate.id.includes("wall_switch_inverse_key"));
    expect(switchDefinition).toBeDefined();
    expect(switchDefinition!.states.find((state) => state.id === "state_1_closed")?.actions).toEqual(
      expect.arrayContaining([{ type: "open_door", doorId: "door_c", respectLock: true }]),
    );
    expect(switchDefinition!.states.find((state) => state.id === "state_2_open")?.actions).toEqual(
      expect.arrayContaining([{ type: "close_door", doorId: "door_c", respectLock: true }]),
    );

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");

    expect(world.isDoorOpen("door_c")).toBe(false);
    expect(world.beginSwitchHandInteraction(switchDefinition!.id)).toBe(true);
    world.updateHandInteraction(0.9);
    expect(world.isDoorOpen("door_b")).toBe(true);
    expect(world.isDoorOpen("door_c")).toBe(false);
    expect(world.session.activeFocusReveal).toMatchObject({ targetId: "door_b", doorMode: "open" });
    expect(world.session.doorRevealQueue).toHaveLength(0);

    world.updateFocusReveal(2.1);
    world.updateFocusReveal(2.1);
    const key = world.level.map?.keyItems.find((item) => item.requiredForDoorIds.includes("door_c"));
    expect(key).toBeDefined();
    expect(world.grantConfiguredKeyItem(key!.id)).toBe(true);
    expect(world.beginSwitchHandInteraction(switchDefinition!.id)).toBe(true);
    expect(world.session.activeHandInteraction?.leverDirection).toBe("up");
    world.updateHandInteraction(0.9);

    expect(world.isDoorOpen("door_b")).toBe(false);
    expect(world.isDoorOpen("door_c")).toBe(true);
    const chainedReveal = world.session.activeFocusReveal;
    expect(chainedReveal).toMatchObject({ targetId: "door_c", doorMode: "open", chainToNext: true });
    expect(world.session.doorRevealQueue).toEqual([
      expect.objectContaining({ doorId: "door_b", mode: "close" }),
    ]);
    expect(focusRevealBlend({ ...chainedReveal!, elapsed: chainedReveal!.duration - 0.05 })).toBe(1);

    world.updateFocusReveal(2.1);

    expect(world.session.activeFocusReveal).toMatchObject({ targetId: "door_b", doorMode: "close" });
    expect(world.session.activeFocusReveal?.cameraCut).toBe(true);
    expect(world.session.activeFocusReveal?.chainToNext).toBeUndefined();
  });

  it("frames builder exit puzzle doors when the color sequence opens the elevator", () => {
    const project = createStarterProject();
    project.projectId = "proj_exit_puzzle_reveal";
    const exitDoor = project.doors.find((door) => door.id === "door_d");
    expect(exitDoor).toBeDefined();
    project.doors = project.doors.map((door) =>
      door.id === "door_d"
        ? { ...door, lockType: "puzzle_complete", puzzleKind: "color_sequence", puzzleRoomId: "room_fight" }
        : door,
    );
    project.puzzles = [
      createPuzzleInstanceForDoor(project, { ...exitDoor!, lockType: "puzzle_complete", puzzleKind: "color_sequence", puzzleRoomId: "room_fight" }, "color_sequence", {
        roomId: "room_fight",
        sequence: ["cyan", "red", "yellow"],
      }),
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    const puzzle = compiled.level?.puzzles?.find((candidate) => candidate.id === project.puzzles?.[0]?.id);
    expect(puzzle?.success.actions).toEqual(
      expect.arrayContaining([
        { type: "open_door", doorId: "door_d" },
        { type: "focus_reveal", reveal: { kind: "door", doorId: "door_d" } },
      ]),
    );
  });

  it("opens the exit cinematic door on its authored timeline instead of at activation", () => {
    const world = new GameWorld();
    world.loadLevel("level_02_residential_simulation", "playing");
    world.unlockExit();
    expect(world.isDoorOpen("level_02_family_exit_door")).toBe(false);

    world.beginExitCinematic("interaction");

    expect(world.session.mode).toBe("exitCinematic");
    expect(world.isDoorOpen("level_02_family_exit_door")).toBe(false);

    world.exitFlow.update(world, 0.04);
    expect(world.isDoorOpen("level_02_family_exit_door")).toBe(false);

    world.exitFlow.update(world, 0.05);
    expect(world.isDoorOpen("level_02_family_exit_door")).toBe(true);
  });

  it("caps the visible elevator button press lead-in so turning completes first", () => {
    expect(exitButtonPressLeadIn(2)).toBeCloseTo(0.95);
  });

  it("walks into the shared elevator before turning to the side-wall button", () => {
    const world = new GameWorld();
    world.loadLevel("level_01_maintenance_bay", "playing");
    world.unlockExit();
    world.player.rotationY = 0;

    world.beginExitCinematic("interaction");
    const cinematic = world.session.activeExitCinematic;
    expect(cinematic).toBeTruthy();
    if (!cinematic) return;

    world.exitFlow.update(world, cinematic.walkInDuration * 0.5);
    expect(world.player.rotationY).toBeCloseTo(cinematic.startYaw, 2);

    world.exitFlow.update(world, cinematic.walkInDuration * 0.65);
    expect(Math.abs(world.player.rotationY - cinematic.startYaw)).toBeGreaterThan(0.2);
  });

  it("extends legacy elevator exits with a cinematic ascent ride before whiteout", () => {
    const world = new GameWorld();
    world.loadLevel("level_03_human_museum", "playing");
    world.unlockExit();

    world.beginExitCinematic("interaction");

    const cinematic = world.session.activeExitCinematic;
    expect(cinematic).toBeTruthy();
    expect(cinematic?.ascentDuration).toBeGreaterThanOrEqual(4.5);
    expect(cinematic?.ascentStartTime).toBeGreaterThan(cinematic?.buttonPressTime ?? 0);
    expect(cinematic?.whiteOutTime).toBeGreaterThanOrEqual((cinematic?.ascentStartTime ?? 0) + (cinematic?.ascentDuration ?? 0));
    expect(cinematic?.duration).toBeGreaterThan(9);

    world.exitFlow.update(world, (cinematic?.ascentStartTime ?? 0) + 0.25);
    expect(exitAscentProgress(world.session.activeExitCinematic)).toBeGreaterThan(0);
    expect(world.session.cinematicBeatFlags.exitElevatorAscentStarted).toBe(true);
  });

  it("derives shared elevator button and shaft visual phases from the cinematic timeline", () => {
    const world = new GameWorld();
    world.loadLevel("level_01_maintenance_bay", "playing");
    world.unlockExit();
    world.beginExitCinematic("interaction");

    const cinematic = world.session.activeExitCinematic;
    expect(cinematic).toBeTruthy();
    if (!cinematic) return;

    const beforePress = exitElevatorButtonVisualState({ ...cinematic, elapsed: cinematic.buttonPressTime - 0.35 });
    const atContact = exitElevatorButtonVisualState({ ...cinematic, elapsed: cinematic.buttonPressTime });
    const latched = exitElevatorButtonVisualState({ ...cinematic, elapsed: cinematic.buttonPressTime + 0.5 });
    expect(beforePress.pressDepthMeters).toBeLessThan(0.01);
    expect(atContact.pressDepthMeters).toBeGreaterThan(0.03);
    expect(atContact.contactPulse).toBeGreaterThan(0.9);
    expect(latched.amberMix).toBeGreaterThan(0.6);

    const shaftStart = exitElevatorShaftVisualState({ ...cinematic, elapsed: cinematic.ascentStartTime + 0.1 });
    const shaftReveal = exitElevatorShaftVisualState({ ...cinematic, elapsed: cinematic.ascentStartTime + 1.2 });
    const whiteOut = exitElevatorShaftVisualState({ ...cinematic, elapsed: cinematic.whiteOutTime + 0.35 });
    expect(shaftStart.reveal).toBeLessThan(shaftReveal.reveal);
    expect(shaftReveal.glassOpacity).toBeGreaterThan(shaftStart.glassOpacity);
    expect(whiteOut.whiteOut).toBeGreaterThan(0);
  });

  it("auto-starts the exit cinematic only after the player enters the open elevator room", () => {
    const world = new GameWorld();
    world.loadLevel("level_02_residential_simulation", "playing");
    const director = new WaveDirectorSystem();

    world.unlockExit();
    world.player.position.set(0, 0, -11.05);
    world.setCurrentRoom("level_02_exit_elevator_room");

    director.update(world, 0.016);
    expect(world.session.mode).toBe("playing");

    expect(world.openConfiguredDoor("level_02_family_exit_door")).toBe(true);
    director.update(world, 0.016);

    expect(world.session.mode).toBe("exitCinematic");
    expect(world.session.mapProgress.completedInteractionIds).toContain("use_builder_exit");
  });

  it("treats entering an already-open elevator room as an exit unlock", () => {
    const world = new GameWorld();
    world.loadLevel("level_01_maintenance_bay", "playing");
    const director = new WaveDirectorSystem();

    world.unlockConfiguredDoor("service_elevator_door");
    expect(world.openConfiguredDoor("service_elevator_door")).toBe(true);
    expect(world.session.exitUnlocked).toBe(false);

    world.player.position.set(0, 0, -16.3);
    world.setCurrentRoom("service_elevator_room");
    director.update(world, 0.016);

    expect(world.session.exitUnlocked).toBe(true);
    expect(world.session.mode).toBe("exitCinematic");
    expect(world.session.mapProgress.completedInteractionIds).toContain("use_builder_exit");
  });

  it("runs builder room wave chains into pressure loops without blocking the door", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_wave_chain_pressure";
    project.robots = [
      {
        id: "wave_chain_robot_1",
        label: "第一波守门组",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 1,
        waveChain: { waveId: "builder_wave_chain_1", order: 1, label: "波次 1" },
      },
      {
        id: "wave_chain_robot_2",
        label: "第二波守门组",
        roomId: "room_fight",
        archetype: "shield_tech",
        count: 1,
        waveChain: {
          waveId: "builder_wave_chain_2",
          order: 2,
          label: "波次 2",
          pressureLoop: { enabled: true, archetype: "repair_drone", count: 1, startsAfter: 0.2, every: 0.3, maxAlive: 1 },
        },
      },
      {
        id: "archive_room_robot",
        label: "档案室普通波",
        roomId: "room_archive",
        archetype: "clamp_bot",
        count: 1,
      },
    ];
    project.doors = project.doors.map((door) =>
      door.id === "door_d"
        ? { ...door, lockType: "survive_wave", waveIds: ["builder_wave_chain_1", "builder_wave_chain_2"], waveId: undefined }
        : door,
    );
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_wave_chain_2_pressure_loop")?.nonBlocking).toBe(true);
    expect(compiled.level!.waves.find((wave) => wave.id === "wave_room_archive")?.interruptsActiveWave).toBe(true);

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_wave_chain_1");
    expect(world.enemies.some((enemy) => enemy.waveId === "builder_wave_chain_1")).toBe(true);

    world.enemies.forEach((enemy) => {
      if (enemy.waveId === "builder_wave_chain_1") enemy.isAlive = false;
    });
    director.update(world, 0.1);

    expect(world.isDoorOpen("door_d")).toBe(false);
    expect(world.session.pendingWaveStarts.some((pending) => pending.waveId === "builder_wave_chain_2")).toBe(true);

    director.update(world, 0.5);
    expect(world.session.activeWaveId).toBe("builder_wave_chain_2");

    world.enemies.forEach((enemy) => {
      if (enemy.waveId === "builder_wave_chain_2") enemy.isAlive = false;
    });
    director.update(world, 0.1);

    expect(world.isDoorOpen("door_d")).toBe(true);
    expect(world.session.pendingWaveStarts.some((pending) => pending.waveId === "builder_wave_chain_2_pressure_loop")).toBe(true);

    director.update(world, 0.25);

    expect(world.session.activeWaveId).toBe("builder_wave_chain_2_pressure_loop");
    expect(world.isDoorOpen("door_d")).toBe(true);

    world.setCurrentRoom("room_archive");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("wave_room_archive");
    expect(world.enemies.some((enemy) => enemy.waveId === "wave_room_archive" && enemy.isAlive)).toBe(true);
  });

  it("advances a builder boss wave when the leader dies even if pressure adds remain", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_boss_wave_leader_clear";
    project.robots = [
      {
        id: "boss_wave_leader",
        label: "主管",
        roomId: "room_fight",
        archetype: "custodian_elite",
        tier: "leader",
        count: 1,
        waveChain: { waveId: "builder_boss_wave", order: 1, label: "主管波" },
      },
      {
        id: "boss_wave_adds",
        label: "护卫",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 2,
        waveChain: { waveId: "builder_boss_wave", order: 1, label: "主管波" },
      },
      {
        id: "after_boss_wave",
        label: "后续清理",
        roomId: "room_fight",
        archetype: "clamp_bot",
        count: 1,
        waveChain: { waveId: "builder_after_boss", order: 2, label: "后续清理" },
      },
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_boss_wave")).toMatchObject({
      completeWhenEliteDefeated: true,
    });

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_boss_wave");
    const leader = world.enemies.find((enemy) => enemy.waveId === "builder_boss_wave" && enemy.tier === "leader");
    expect(leader).toBeDefined();
    world.killEnemy(leader!);

    expect(world.enemies.filter((enemy) => enemy.waveId === "builder_boss_wave" && enemy.isAlive)).toHaveLength(2);

    director.update(world, 0.1);

    expect(world.session.mapProgress.completedWaveIds).toContain("builder_boss_wave");
    expect(world.session.pendingWaveStarts.some((pending) => pending.waveId === "builder_after_boss")).toBe(true);

    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_after_boss");
  });

  it("starts builder room waves while a boss chase is still alive", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_boss_chase_color_pressure";
    project.robots = [
      {
        id: "boss_chase_robot",
        label: "追逐主管",
        roomId: "room_hall",
        archetype: "custodian_elite",
        count: 1,
        wave: { id: "builder_boss_chase", label: "追逐 Boss", triggerType: "room_entered", triggerId: "room_hall" },
      },
      {
        id: "color_room_wave_1",
        label: "颜色面板第一波",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 2,
        waveChain: { waveId: "builder_color_wave_1", order: 1, label: "波次 1" },
      },
      {
        id: "color_room_wave_2",
        label: "颜色面板第二波",
        roomId: "room_fight",
        archetype: "clamp_bot",
        count: 2,
        waveChain: { waveId: "builder_color_wave_2", order: 2, label: "波次 2" },
      },
    ];

    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(compiled.level!.waves.find((wave) => wave.id === "builder_color_wave_1")?.interruptsActiveWave).toBe(true);

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_hall");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_boss_chase");
    expect(world.enemies.some((enemy) => enemy.waveId === "builder_boss_chase" && enemy.isAlive)).toBe(true);

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_color_wave_1");
    expect(world.enemies.some((enemy) => enemy.waveId === "builder_boss_chase" && enemy.isAlive)).toBe(true);
    expect(world.enemies.filter((enemy) => enemy.waveId === "builder_color_wave_1" && enemy.isAlive)).toHaveLength(2);

    world.enemies.forEach((enemy) => {
      if (enemy.waveId === "builder_color_wave_1") enemy.isAlive = false;
    });
    director.update(world, 0.1);

    expect(world.session.pendingWaveStarts.some((pending) => pending.waveId === "builder_color_wave_2")).toBe(true);

    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_color_wave_2");
    expect(world.enemies.filter((enemy) => enemy.waveId === "builder_color_wave_2" && enemy.isAlive)).toHaveLength(2);
  });

  it("spawns every finite builder enemy even when another wave still has small enemies alive", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_uncapped_finite_wave";
    project.robots = [
      {
        id: "full_wave_robot_group",
        label: "完整守门组",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 4,
        waveChain: { waveId: "builder_full_wave", order: 1, label: "波次 1" },
      },
    ];
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.spawnEnemy("repair_drone", "previous_pressure", new Vector3(0, 0, 0), 0);
    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe("builder_full_wave");
    expect(world.enemies.filter((enemy) => enemy.waveId === "builder_full_wave" && enemy.isAlive)).toHaveLength(4);
  });

  it("spreads mixed same-wave builder groups across separate spawn slots", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_mixed_wave_slots";
    project.robots = [
      {
        id: "mixed_wave_repair_group",
        label: "维修无人机组",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 3,
        waveChain: { waveId: "builder_mixed_wave", order: 1, label: "波次 1" },
      },
      {
        id: "mixed_wave_clamp_group",
        label: "夹钳机器人",
        roomId: "room_fight",
        archetype: "clamp_bot",
        count: 1,
        waveChain: { waveId: "builder_mixed_wave", order: 1, label: "波次 1" },
      },
    ];
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 0.5);

    const waveEnemies = world.enemies.filter((enemy) => enemy.waveId === "builder_mixed_wave" && enemy.isAlive);
    expect(waveEnemies.map((enemy) => enemy.archetypeId).sort()).toEqual(["clamp_bot", "repair_drone", "repair_drone", "repair_drone"]);
    expect(waveEnemies).toHaveLength(4);
    for (let left = 0; left < waveEnemies.length; left += 1) {
      for (let right = left + 1; right < waveEnemies.length; right += 1) {
        expect(waveEnemies[left].position.distanceTo(waveEnemies[right].position)).toBeGreaterThan(2.4);
      }
    }
  });

  it("keeps builder wave enemies inside the spawn group's room", () => {
    const project = createStarterProject();
    project.projectId = "proj_runtime_spawn_room_bounds";
    project.robots = [
      {
        id: "bounds_wave_robot_group",
        label: "边界波次守卫",
        roomId: "room_fight",
        archetype: "repair_drone",
        count: 3,
        waveChain: { waveId: "builder_bounds_wave", order: 1, label: "波次 1" },
      },
    ];
    const compiled = compileBuilderProjectToLevel(project);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();

    const world = new GameWorld();
    world.level = compiled.level!;
    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();

    world.setCurrentRoom("room_fight");
    trigger.update(world);
    director.update(world, 1);

    expect(world.session.activeWaveId).toBe("builder_bounds_wave");
    const room = world.level.map?.rooms.find((candidate) => candidate.id === "room_fight");
    expect(room).toBeDefined();
    const [cx, , cz] = room!.bounds.center;
    const [sx, , sz] = room!.bounds.size;
    const enemies = world.enemies.filter((enemy) => enemy.waveId === "builder_bounds_wave" && enemy.isAlive);
    expect(enemies).toHaveLength(3);
    for (const enemy of enemies) {
      expect(enemy.position.x).toBeGreaterThanOrEqual(cx - sx / 2 + enemy.radius);
      expect(enemy.position.x).toBeLessThanOrEqual(cx + sx / 2 - enemy.radius);
      expect(enemy.position.z).toBeGreaterThanOrEqual(cz - sz / 2 + enemy.radius);
      expect(enemy.position.z).toBeLessThanOrEqual(cz + sz / 2 - enemy.radius);
    }
  });

  it("runs exported Level 2 room prelude before the builder door wave and pressure loop", () => {
    const world = new GameWorld();
    world.loadLevel("level_02_residential_simulation", "playing");
    const trigger = new WaveTriggerBridgeSystem();
    const director = new WaveDirectorSystem();
    const [doorWaveId] = configuredDoorSurviveWaveIds(world, "level_02_care_room_door");
    expect(doorWaveId).toBe("wave_gumgzq");

    expect(world.level.waves.find((wave) => wave.id === doorWaveId)?.trigger).toBeUndefined();
    expect(world.level.events?.some((event) =>
      event.trigger.type === "wave_completed" &&
      event.trigger.id === "level_02_living_swarm" &&
      event.actions.some((action) => action.type === "start_wave" && action.waveId === doorWaveId),
    )).toBe(true);

    world.setCurrentRoom("level_02_living_room");
    trigger.update(world);
    director.update(world, 0.8);

    expect(world.session.activeWaveId).toBe("level_02_living_swarm");
    expect(world.enemies.filter((enemy) => enemy.waveId === "level_02_living_swarm" && enemy.isAlive)).toHaveLength(4);
    expect(world.enemies.some((enemy) => enemy.waveId === doorWaveId && enemy.isAlive)).toBe(false);
    expect(world.isDoorOpen("level_02_care_room_door")).toBe(false);

    world.enemies.forEach((enemy) => {
      if (enemy.waveId === "level_02_living_swarm") enemy.isAlive = false;
    });
    director.update(world, 0.1);

    expect(world.isDoorOpen("level_02_care_room_door")).toBe(false);
    expect(world.session.pendingWaveStarts.some((pending) => pending.waveId === doorWaveId)).toBe(true);

    director.update(world, 0.5);

    expect(world.session.activeWaveId).toBe(doorWaveId);
    expect(world.enemies.filter((enemy) => enemy.waveId === doorWaveId && enemy.isAlive)).toHaveLength(4);

    world.enemies.forEach((enemy) => {
      if (enemy.waveId === doorWaveId) enemy.isAlive = false;
    });
    director.update(world, 0.1);

    expect(world.isDoorOpen("level_02_care_room_door")).toBe(true);
    expect(world.session.activeFocusReveal).toMatchObject({
      kind: "door",
      targetId: "level_02_care_room_door",
    });
    expect(world.session.pendingWaveStarts.some((pending) => pending.waveId === `${doorWaveId}_pressure_loop`)).toBe(true);

    director.update(world, 0.7);

    expect(world.session.activeWaveId).toBe(`${doorWaveId}_pressure_loop`);
    expect(world.isDoorOpen("level_02_care_room_door")).toBe(true);

    world.setCurrentRoom("level_02_care_room");
    trigger.update(world);
    director.update(world, 0.3);

    expect(world.session.activeWaveId).toBe("level_02_carekeeper_host");
    expect(
      world.enemies.some((enemy) => enemy.waveId === "level_02_carekeeper_host" && enemy.archetypeId === "custodian_elite" && enemy.isAlive),
    ).toBe(true);
  });
});

describe("GameWorld pickups", () => {
  it("keeps authored map pickups from expiring during long wave fights", () => {
    const world = new GameWorld();
    world.loadLevel("level_02_residential_simulation", "playing");
    world.player.position.set(999, 0, 999);

    const pickupSystem = new PickupSystem();
    const mapPickupCount = world.level.map?.pickups.length ?? 0;
    expect(mapPickupCount).toBeGreaterThan(0);
    expect(world.pickups.filter((pickup) => pickup.expires === false)).toHaveLength(mapPickupCount);

    pickupSystem.update(world, world.level.pickups.dynamicLifetimeSec + 5);

    expect(world.pickups.filter((pickup) => !pickup.collected && pickup.expires === false)).toHaveLength(mapPickupCount);
  });

  it("still expires dynamic enemy-drop pickups", () => {
    const world = new GameWorld();
    world.loadLevel("level_02_residential_simulation", "playing");
    world.player.position.set(999, 0, 999);
    world.pickups.length = 0;

    world.addPickup("repairKit", new Vector3(0, 0, 0));
    expect(world.pickups).toHaveLength(1);
    expect(world.pickups[0].expires).not.toBe(false);

    new PickupSystem().update(world, world.level.pickups.dynamicLifetimeSec + 5);

    expect(world.pickups).toHaveLength(0);
  });

  it("switches skill 3 to breach missile when collecting the missile pickup", () => {
    const world = new GameWorld();
    world.loadLevel("level_02_residential_simulation", "playing");
    world.pickups.length = 0;
    world.session.activeUltimateAbilityId = "coreBomb";
    world.session.coreCells = 0;

    world.addPickup("breachMissile", new Vector3(0, 0, 0), { ignoreDynamicLimit: true, expires: false });
    world.collectPickup(world.pickups[0]);

    expect(world.pickups[0].collected).toBe(true);
    expect(world.session.activeUltimateAbilityId).toBe("breachMissile");
    expect(world.session.coreCells).toBe(1);
    expect(world.session.rewardPulse?.label).toBe("突破导弹装入");
    expect(world.effects.some((effect) => effect.type === "coreSpark")).toBe(true);
  });

  it("makes repair kit pickup feedback noticeable without interrupting play", () => {
    const world = new GameWorld();
    world.loadLevel("level_02_residential_simulation", "playing");
    world.pickups.length = 0;
    world.player.health = world.player.maxHealth - 38;
    world.drainAudioEvents();

    world.addPickup("repairKit", new Vector3(0, 0, 0), { ignoreDynamicLimit: true, expires: false });
    world.collectPickup(world.pickups[0]);

    const audioKeys = world.drainAudioEvents().map((event) => event.key);
    expect(world.pickups[0].collected).toBe(true);
    expect(world.player.health).toBeGreaterThan(world.player.maxHealth - 38);
    expect(audioKeys).toContain("pickup_repair_kit");
    expect(world.camera.shake).toBeGreaterThan(0);
    expect(world.camera.shake).toBeLessThan(0.16);
    expect(world.effects.some((effect) => effect.type === "coreSpark")).toBe(true);
  });
});
