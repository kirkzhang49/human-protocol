import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { runCampaignIntegrityChecks } from "./campaign-integrity-check.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const [
    { GameWorld },
    { builtInValidationReports, getNextCampaignLevelConfig, humanProtocolBasePack },
    { createPropCollisionProxies, createRoomWallSegments },
    { arenaObstacles },
    { playerConfig },
    { movementBoundsForLevel },
    { DoorSystem },
    { InteractionSystem },
    { WaveTriggerBridgeSystem },
    { WaveDirectorSystem },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/core/GameWorld.ts"),
    server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    server.ssrLoadModule("/src/game/config/MapGeometry.ts"),
    server.ssrLoadModule("/src/game/config/gameBalance.ts"),
    server.ssrLoadModule("/src/game/config/playerConfig.ts"),
    server.ssrLoadModule("/src/game/config/MapMovementBounds.ts"),
    server.ssrLoadModule("/src/game/systems/DoorSystem.ts"),
    server.ssrLoadModule("/src/game/systems/InteractionSystem.ts"),
    server.ssrLoadModule("/src/game/systems/WaveTriggerBridgeSystem.ts"),
    server.ssrLoadModule("/src/game/systems/WaveDirectorSystem.ts"),
  ]);
  const { createSingleLevelConfigPack, parseConfigPackText } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");

  assertBuiltInConfigs(builtInValidationReports);
  assertCampaignOrder(humanProtocolBasePack, getNextCampaignLevelConfig);
  assertPhysicalWalkability(humanProtocolBasePack, {
    arenaObstacles,
    createPropCollisionProxies,
    createRoomWallSegments,
    movementBoundsForLevel,
    playerRadius: playerConfig.radius,
  });
  {
    const { enemyArchetypes } = await server.ssrLoadModule("/src/game/config/enemyArchetypes.ts");
    const integrity = runCampaignIntegrityChecks({
      basePack: humanProtocolBasePack,
      repoRoot,
      helpers: {
        createPropCollisionProxies,
        createRoomWallSegments,
        movementBoundsForLevel,
        enemyArchetypes,
        playerRadius: playerConfig.radius,
      },
    });
    if (integrity.failures.length > 0) {
      console.error(`FAIL campaign integrity (${integrity.failures.length} issue(s))`);
      for (const failure of integrity.failures) console.error(`  ${failure}`);
      process.exit(1);
    }
    for (const report of integrity.reports) {
      console.log(`PASS campaign integrity ${report.levelId}`);
    }
  }

  assertCustomPackImport(humanProtocolBasePack, createSingleLevelConfigPack, parseConfigPackText);
  assertDoorSwitchRuntime(new GameWorld());
  assertBigScreenRuntime(new GameWorld());
  assertExitDoorDoesNotToggleRoomDoor(new GameWorld(), new DoorSystem());
  assertLevel02BuildLikeCombatFlow(new GameWorld(), new WaveTriggerBridgeSystem(), new WaveDirectorSystem());
  assertLevel03BuildMuseumFlowConfig(new GameWorld());
  assertLevel03PuzzleTargetsSplitAcrossRooms(new GameWorld());

  // One sample smoke level per cyberpunk 2D puzzle system — proves each new
  // puzzle type validates, opens, submits, and unlocks its door headlessly.
  const puzzleSmokeWorld = new GameWorld();
  for (const smokeId of ["smoke_circuit_grid", "smoke_surveillance_match", "smoke_valve_matrix", "smoke_gallery_reading"]) {
    const report = smokeLevel(puzzleSmokeWorld, smokeId);
    console.log(`PASS puzzle smoke ${report.levelId} steps=${report.steps.join(" -> ")}`);
  }

  const world = new GameWorld();
  const campaignIds = humanProtocolBasePack.campaignLevelIds;
  const reports = campaignIds.map((levelId) => smokeLevel(world, levelId));

  for (const report of reports) {
    console.log(`PASS ${report.levelId}`);
    console.log(`  steps=${report.steps.join(" -> ")}`);
    console.log(`  completed=${report.completedCount}`);
    console.log(`  victory=${report.victoryMessage}`);
  }

  console.log(`PASS campaign=${campaignIds.join(" -> ")}`);
} finally {
  await server.close();
}

function assertCampaignOrder(basePack, getNextCampaignLevelConfig) {
  const expected = basePack.campaignLevelIds;
  for (let index = 0; index < expected.length; index += 1) {
    const current = expected[index];
    const next = getNextCampaignLevelConfig(current)?.id ?? null;
    const expectedNext = expected[index + 1] ?? null;
    if (next !== expectedNext) {
      throw new Error(`Campaign order broken at ${current}: expected ${expectedNext ?? "END"}, got ${next ?? "END"}`);
    }
  }
  console.log(`PASS campaign order=${expected.join(" -> ")}`);
}

function assertCustomPackImport(basePack, createSingleLevelConfigPack, parseConfigPackText) {
  const smokeLevel = basePack.levels.find((level) => level.id === "smoke_key_door_lab");
  if (!smokeLevel) {
    throw new Error("Missing smoke_key_door_lab for custom pack import QA.");
  }

  const generatedLevel = {
    ...JSON.parse(JSON.stringify(smokeLevel)),
    id: "qa_generated_key_door_lab",
    title: "QA Generated Key Door Lab",
  };
  const pack = createSingleLevelConfigPack(generatedLevel, "qa-generated-key-door-pack");
  const result = parseConfigPackText(JSON.stringify(pack));
  if (!result.ok || !result.slot) {
    const details = result.errors.map((error) => `${error.path}: ${error.message}`).join("; ");
    throw new Error(`Custom pack import QA failed: ${details}`);
  }
  console.log(`PASS custom pack import=${result.slot.pack.packId} levels=${result.slot.pack.levels.length}`);

  const badStyleLevel = {
    ...generatedLevel,
    id: "qa_bad_generated_style_lab",
    title: "QA Bad Generated Style Lab",
    map: {
      ...generatedLevel.map,
      keyItems: generatedLevel.map.keyItems.map((item, index) =>
        index === 0 ? { ...item, visualKey: "maintenance_crate" } : item,
      ),
    },
  };
  const badPack = createSingleLevelConfigPack(badStyleLevel, "qa-bad-generated-style-pack");
  const badResult = parseConfigPackText(JSON.stringify(badPack));
  if (badResult.ok || !badResult.errors.some((error) => error.code.startsWith("authoring.generated."))) {
    throw new Error("Generated style boundary QA failed: key item crate visual was accepted.");
  }
  console.log("PASS generated style boundary=bad key visual rejected");
}

function assertDoorSwitchRuntime(world) {
  world.loadLevel("smoke_door_switch_lab", "playing");
  world.dispatchObjectiveEvent({ type: "level_start" });
  const definition = world.level.switches?.find((candidate) => candidate.id === "reroute_switch");
  if (!definition) throw new Error("Missing reroute_switch in smoke_door_switch_lab.");
  const exitDoor = world.level.map?.doors.find((door) => door.id === "switch_exit_door");
  if (exitDoor?.defaultState !== "closed" || exitDoor.lock.manualOpen !== false) {
    throw new Error("Door switch smoke failed: switch_exit_door should be closed and not manually openable.");
  }
  if (world.openConfiguredDoor("switch_exit_door") || world.isDoorOpen("switch_exit_door")) {
    throw new Error("Door switch smoke failed: direct E/manual open should not open switch_exit_door.");
  }
  if (!world.beginSwitchHandInteraction(definition.id)) throw new Error("Could not start hand interaction for reroute_switch.");
  if (!world.session.activeHandInteraction?.hideWeapon) {
    throw new Error("Door switch smoke failed: wall switch hand interaction should hide the weapon.");
  }
  if (world.session.activeHandInteraction.handPose !== "lever_push_down") {
    throw new Error("Door switch smoke failed: wall switch should use the lever hand pose.");
  }
  world.updateHandInteraction(0.5);
  if (!world.isDoorOpen("switch_exit_door")) throw new Error("Door switch smoke failed: switch_exit_door did not open.");
  if (world.isDoorOpen("switch_entry_door")) throw new Error("Door switch smoke failed: switch_entry_door stayed open.");
  if (!world.session.mapProgress.activatedSwitchIds.includes("reroute_switch:rerouted")) {
    throw new Error("Door switch smoke failed: rerouted state was not recorded.");
  }
  if (world.session.activeFocusReveal || world.session.doorRevealQueue[0]?.doorId !== "switch_exit_door") {
    throw new Error("Door switch smoke failed: door reveal should wait in queue until the hand lever finishes: " + JSON.stringify({ active: world.session.activeFocusReveal, queue: world.session.doorRevealQueue }));
  }
  world.updateHandInteraction(0.4);
  if (world.session.activeFocusReveal?.targetId !== "switch_exit_door" || world.session.activeFocusReveal.duration !== 2) {
    throw new Error("Door switch smoke failed: first reroute reveal should watch the opened exit door for 2s: " + JSON.stringify(world.session.activeFocusReveal));
  }
  if (world.session.doorRevealQueue[0]?.doorId !== "switch_entry_door" || world.session.doorRevealQueue[0]?.durationSec !== 2) {
    throw new Error("Door switch smoke failed: second reroute reveal should watch the closed entry door for 2s: " + JSON.stringify(world.session.doorRevealQueue));
  }
  world.updateFocusReveal(2.1);
  if (world.session.activeFocusReveal?.targetId !== "switch_entry_door" || world.session.activeFocusReveal.duration !== 2) {
    throw new Error("Door switch smoke failed: queued close reveal did not start after open reveal: " + JSON.stringify(world.session.activeFocusReveal));
  }
  world.updateFocusReveal(2.1);
  world.closeConfiguredDoor("switch_exit_door");
  if (world.openConfiguredDoor("switch_exit_door") || world.isDoorOpen("switch_exit_door")) {
    throw new Error("Door switch smoke failed: active switch state should still not allow direct E/manual reopen.");
  }
  if (!world.beginSwitchHandInteraction(definition.id)) throw new Error("Could not repeat hand interaction for reroute_switch.");
  world.updateHandInteraction(0.9);
  if (!world.isDoorOpen("switch_entry_door")) throw new Error("Door switch smoke failed: reverse toggle did not reopen switch_entry_door.");
  if (world.isDoorOpen("switch_exit_door")) throw new Error("Door switch smoke failed: reverse toggle did not close switch_exit_door.");
  if (!world.session.mapProgress.activatedSwitchIds.includes("reroute_switch:idle")) {
    throw new Error("Door switch smoke failed: idle state was not recorded after repeat interaction.");
  }
  if (world.session.activeFocusReveal?.targetId !== "switch_entry_door" || world.session.doorRevealQueue[0]?.doorId !== "switch_exit_door") {
    throw new Error("Door switch smoke failed: reverse reveal should watch opened entry door before closed exit door: " + JSON.stringify({ active: world.session.activeFocusReveal, queue: world.session.doorRevealQueue }));
  }
  console.log("PASS door switch runtime=hand press toggles exit and can reverse");
}

function assertBigScreenRuntime(world) {
  world.loadLevel("smoke_big_screen_formula_combo", "playing");
  world.dispatchObjectiveEvent({ type: "level_start" });
  if (!world.activateBigScreen("screen_combo_color_screen")) {
    throw new Error("Could not activate screen_combo_color_screen.");
  }
  if (!world.session.mapProgress.activatedBigScreenIds.includes("screen_combo_color_screen:color_hint")) {
    throw new Error("Big screen smoke failed: color_hint state was not recorded.");
  }
  const puzzle = world.level.puzzles?.find((candidate) => candidate.id === "screen_combo_orb_sequence");
  if (!puzzle) throw new Error("Missing screen_combo_orb_sequence.");
  for (const targetId of puzzle.clue.sequence) {
    if (!world.hitConfiguredPuzzleTarget(puzzle.id, targetId, "pulseRifle")) {
      throw new Error(`Big screen smoke failed: could not hit ${targetId}.`);
    }
  }
  if (!world.session.mapProgress.activatedBigScreenIds.includes("screen_combo_formula_screen:formula_hint")) {
    throw new Error("Big screen smoke failed: formula screen did not light after orb sequence.");
  }
  console.log("PASS big screen runtime=color screen drives orbs and formula screen");
}

function assertExitDoorDoesNotToggleRoomDoor(world, doorSystem) {
  world.loadLevel("level_02_residential_simulation", "playing");
  world.player.position.set(0, 0, -7.3);
  world.session.mapProgress.completedPuzzleIds.push("level_02_light_sequence");
  world.session.mapProgress.unlockedDoorIds.push("level_02_family_exit_door");
  world.session.exitUnlocked = true;

  const openCounts = {};
  const closeCounts = {};
  const openConfiguredDoor = world.openConfiguredDoor.bind(world);
  const closeConfiguredDoor = world.closeConfiguredDoor.bind(world);
  world.openConfiguredDoor = (doorId) => {
    openCounts[doorId] = (openCounts[doorId] ?? 0) + 1;
    return openConfiguredDoor(doorId);
  };
  world.closeConfiguredDoor = (doorId) => {
    closeCounts[doorId] = (closeCounts[doorId] ?? 0) + 1;
    return closeConfiguredDoor(doorId);
  };

  for (let frame = 0; frame < 12; frame += 1) {
    doorSystem.update(world);
  }

  if (world.isDoorOpen("level_02_family_exit_door") || openCounts.level_02_family_exit_door) {
    throw new Error("Exit door smoke failed: exit unlock should not auto-open the elevator door anymore.");
  }
  if (openCounts.level_02_living_room_door || closeCounts.level_02_living_room_door) {
    throw new Error(
      `Exit door smoke failed: level_02_living_room_door toggled open=${openCounts.level_02_living_room_door ?? 0} close=${closeCounts.level_02_living_room_door ?? 0}.`,
    );
  }
  if (!world.openConfiguredDoor("level_02_family_exit_door") || !world.isDoorOpen("level_02_family_exit_door")) {
    throw new Error("Exit door smoke failed: explicit elevator door open did not work after exit unlock.");
  }
  console.log("PASS exit door runtime=exit unlock waits for explicit elevator door open");
}

function assertLevel02BuildLikeCombatFlow(world, waveTriggerBridge, waveDirector) {
  world.loadLevel("level_02_residential_simulation", "playing");
  const staleKey = world.level.map?.keyItems.find((candidate) => candidate.id === "level_02_family_key");
  if (staleKey) {
    throw new Error("Level 2 combat flow failed: stale family key is still present.");
  }
  const hostWave = world.level.waves.find((candidate) => candidate.id === "level_02_carekeeper_host");
  if (hostWave?.trigger?.type !== "room_entered" || hostWave.trigger.id !== "level_02_care_room") {
    throw new Error("Level 2 combat flow failed: host wave must start when the care room is entered.");
  }
  for (const removedWaveId of ["level_02_return_swarm", "level_02_exit_chase"]) {
    if (world.level.waves.some((candidate) => candidate.id === removedWaveId)) {
      throw new Error(`Level 2 combat flow failed: removed special wave ${removedWaveId} is still present.`);
    }
  }
  if (world.level.choices?.length) {
    throw new Error("Level 2 combat flow failed: route-choice special logic is still active.");
  }
  const careDoor = world.level.map?.doors.find((candidate) => candidate.id === "level_02_care_room_door");
  const requiredCareDoorWaveIds = careDoor?.lock?.type === "survive_wave"
    ? [...new Set([...(careDoor.lock.waveIds ?? []), ...(careDoor.lock.waveId ? [careDoor.lock.waveId] : [])])]
    : [];
  if (careDoor?.lock?.type !== "survive_wave" || requiredCareDoorWaveIds.length === 0) {
    throw new Error("Level 2 combat flow failed: care room door must be locked by configured combat wave(s).");
  }
  for (const waveId of requiredCareDoorWaveIds) {
    if (!world.level.waves.some((candidate) => candidate.id === waveId)) {
      throw new Error(`Level 2 combat flow failed: care room door references missing wave ${waveId}.`);
    }
  }
  if (world.canOpenDoor(careDoor)) {
    throw new Error("Level 2 combat flow failed: care room door opened before its combat wave completed.");
  }
  for (const waveId of requiredCareDoorWaveIds) world.markWaveCompleted(waveId);
  if (!world.canOpenDoor(careDoor)) {
    throw new Error("Level 2 combat flow failed: configured combat wave did not unlock the care room door.");
  }
  if (!world.openConfiguredDoor(careDoor.id)) {
    throw new Error("Level 2 combat flow failed: unlocked care room door could not be opened.");
  }
  world.setCurrentRoom("level_02_care_room");
  waveTriggerBridge.update(world);
  if (!world.session.pendingWaveStarts.some((pending) => pending.waveId === "level_02_carekeeper_host")) {
    throw new Error("Level 2 combat flow failed: entering the care room did not queue the host wave.");
  }
  waveDirector.update(world, 0.3);
  if (world.session.activeWaveId !== "level_02_carekeeper_host") {
    throw new Error("Level 2 combat flow failed: queued host wave did not start.");
  }
  if (!world.enemies.some((enemy) => enemy.waveId === "level_02_carekeeper_host" && enemy.archetypeId === "custodian_elite" && enemy.isAlive)) {
    throw new Error("Level 2 combat flow failed: host wave did not spawn the configured custodian elite.");
  }
  const lightDoor = world.level.map?.doors.find((candidate) => candidate.id === "level_02_light_room_door");
  if (lightDoor?.lock?.type !== "key_item" || lightDoor.lock.keyItemId !== "key_level_02_light_room_door") {
    throw new Error("Level 2 combat flow failed: lighting room door must use the care-room key item.");
  }
  const lightDoorKey = world.level.map?.keyItems.find((candidate) => candidate.id === lightDoor.lock.keyItemId);
  if (!lightDoorKey || lightDoorKey.roomId !== "level_02_care_room") {
    throw new Error("Level 2 combat flow failed: lighting room key must be placed in the care room.");
  }
  if (world.canOpenDoor(lightDoor)) {
    throw new Error("Level 2 combat flow failed: lighting room door opened before its key was collected.");
  }
  if (!world.collectConfiguredKeyItem(lightDoorKey)) {
    throw new Error("Level 2 combat flow failed: could not collect the lighting room key.");
  }
  if (!world.canOpenDoor(lightDoor)) {
    throw new Error("Level 2 combat flow failed: lighting room key did not unlock the lighting room door.");
  }
  console.log("PASS level02 combat flow=living clear unlocks right door, care-room entry starts host, light door uses key");
}

function assertLevel03BuildMuseumFlowConfig(world) {
  world.loadLevel("level_03_human_museum", "playing");
  const rooms = new Set(world.level.map?.rooms.map((room) => room.id) ?? []);
  if (!rooms.has("room_kqrkp0")) {
    throw new Error("Level 3 build museum flow failed: archive copy room is missing.");
  }
  const props = new Set(world.level.map?.props.map((prop) => prop.id) ?? []);
  for (const removedPropId of ["level_03_tool_repair_workbench_context", "level_03_lobby_archive_card_cabinet_context", "level_03_body_route_asset"]) {
    if (props.has(removedPropId)) throw new Error(`Level 3 build museum flow failed: deleted prop ${removedPropId} came back.`);
  }
  const doorById = new Map(world.level.map?.doors.map((door) => [door.id, door]) ?? []);
  const voiceDoor = doorById.get("level_03_voice_door");
  const archiveDoor = doorById.get("level_03_archive_door");
  const copyDoor = doorById.get("door_endnke");
  const exitDoor = doorById.get("level_03_official_exit_door");
  if (voiceDoor?.lock?.type !== "puzzle_complete" || voiceDoor.lock.puzzleId !== "level_03_tool_calibration") {
    throw new Error("Level 3 build museum flow failed: voice door is not unlocked directly by tool calibration.");
  }
  if (archiveDoor?.lock?.type !== "puzzle_complete" || archiveDoor.lock.puzzleId !== "builder_color_lock") {
    throw new Error("Level 3 build museum flow failed: archive door does not use the build lamp puzzle.");
  }
  if (copyDoor?.lock?.type !== "survive_wave" || copyDoor.lock.waveId !== "wave_level_03_central_archive") {
    throw new Error("Level 3 build museum flow failed: archive copy door does not use the build wave lock.");
  }
  if (exitDoor?.lock?.type !== "objective_complete" || exitDoor.lock.objectiveId !== "obj_route_level_03_official_exit_door") {
    throw new Error("Level 3 build museum flow failed: elevator door does not use the route objective lock.");
  }
  if (!world.level.switches?.some((routeSwitch) => routeSwitch.id === "route_route_z43akm" && routeSwitch.roomId === "room_kqrkp0")) {
    throw new Error("Level 3 build museum flow failed: route switch is missing from archive copy room.");
  }
  const toolCalibration = world.level.puzzles?.find((puzzle) => puzzle.id === "level_03_tool_calibration");
  if (!toolCalibration || toolCalibration.type !== "tool_calibration") {
    throw new Error("Level 3 build museum flow failed: tool calibration puzzle is missing.");
  }
  const interactions = new Map(world.level.map?.interactions.map((interaction) => [interaction.id, interaction]) ?? []);
  if (!interactions.has("level_03_tool_case")) {
    throw new Error("Level 3 build museum flow failed: tool calibration terminal is missing.");
  }
  const lampWall = interactions.get("builder_color_clue");
  if (lampWall?.visualKey !== "puzzle_console_color_sequence") {
    throw new Error(`Level 3 build museum flow failed: lamp wall uses ${lampWall?.visualKey ?? "no"} visual.`);
  }
  if (Math.abs(lampWall?.position?.[1] ?? -999) > 0.001) {
    throw new Error(`Level 3 build museum flow failed: lamp wall is not floor-grounded (${lampWall?.position?.[1] ?? "missing"}).`);
  }
  const lobbyWave = world.level.waves?.find((wave) => wave.id === "level_03_lobby_patrol");
  if (!lobbyWave || lobbyWave.trigger?.type !== "room_entered" || lobbyWave.trigger.id !== "level_03_gallery_lobby") {
    throw new Error("Level 3 build museum flow failed: main gallery patrol wave is missing.");
  }
  console.log("PASS level 3 build map=archive copy room, deleted props stay deleted, tool calibration chain present");
}

function assertLevel03PuzzleTargetsSplitAcrossRooms(world) {
  world.loadLevel("level_03_human_museum", "playing");
  const puzzle = world.level.puzzles?.find((candidate) => candidate.id === "builder_color_lock");
  if (!puzzle || puzzle.type !== "hit_sequence") throw new Error("Missing Level 3 build color lock hit puzzle.");
  const targetRoomById = new Map(puzzle.targets.map((target) => [target.id, target.roomId]));
  const targetVisualById = new Map(puzzle.targets.map((target) => [target.id, target.visualKey]));
  const expectedRooms = new Map([
    ["orb_red", "level_03_body_exhibit"],
    ["orb_blue", "level_03_voice_exhibit"],
    ["orb_green", "level_03_body_exhibit"],
    ["orb_yellow", "level_03_tool_exhibit"],
    ["orb_purple", "level_03_entry_hall"],
  ]);
  for (const [targetId, roomId] of expectedRooms) {
    if (targetRoomById.get(targetId) !== roomId) {
      throw new Error(`Level 3 puzzle split failed: ${targetId} is not in ${roomId}.`);
    }
    const expectedVisual = `puzzle_orb_${targetId.replace("orb_", "")}`;
    if (targetVisualById.get(targetId) !== expectedVisual) {
      throw new Error(`Level 3 puzzle split failed: ${targetId} visual is ${targetVisualById.get(targetId) ?? "missing"}.`);
    }
  }
  const expectedSequence = [
    "orb_red",
    "orb_blue",
    "orb_yellow",
    "orb_green",
    "orb_purple",
  ].join(" -> ");
  if (puzzle.clue.sequence.join(" -> ") !== expectedSequence) {
    throw new Error(`Level 3 puzzle split failed: sequence is ${puzzle.clue.sequence.join(" -> ")}`);
  }
  const expectedPalette = ["red", "blue", "yellow", "green", "purple", "white", "cyan"].join(" -> ");
  if (puzzle.clue.playback?.palette?.join(" -> ") !== expectedPalette) {
    throw new Error(`Level 3 puzzle split failed: lamp palette is ${puzzle.clue.playback?.palette?.join(" -> ") ?? "missing"}.`);
  }
  if (puzzle.clue.interactionId !== "builder_color_clue" || puzzle.clue.playback?.requireReplayBeforeInput !== true) {
    throw new Error("Level 3 puzzle split failed: lamp wall playback is not required.");
  }
  if (puzzle.clue.playback?.reshuffleAfterFailures !== 3) {
    throw new Error("Level 3 puzzle split failed: lamp wall does not reshuffle after three failures.");
  }
  console.log("PASS level 3 puzzle=five-color lamp wall split across rooms");
}

function assertBuiltInConfigs(validationReports) {
  const failed = validationReports.filter(({ report }) => !report.ok || report.errors.length > 0);
  if (failed.length > 0) {
    for (const { levelId, report } of failed) {
      console.error(`FAIL validation ${levelId}`);
      for (const error of report.errors) console.error(`  error=${formatValidationIssue(error)}`);
      for (const warning of report.warnings) console.error(`  warning=${formatValidationIssue(warning)}`);
    }
    process.exit(1);
  }

  const warnings = validationReports.flatMap(({ levelId, report }) =>
    report.warnings.map((warning) => `${levelId}: ${formatValidationIssue(warning)}`),
  );
  if (warnings.length > 0) {
    console.warn(`WARN built-in config warnings=${warnings.length}`);
    for (const warning of warnings) console.warn(`  ${warning}`);
  } else {
    console.log(`PASS built-in validation=${validationReports.length} levels`);
  }
}

function formatValidationIssue(issue) {
  if (!issue || typeof issue !== "object") return String(issue);
  const location = issue.path ?? issue.code ?? "issue";
  return `${location}: ${issue.message ?? JSON.stringify(issue)}`;
}

function assertPhysicalWalkability(basePack, helpers) {
  const reports = [];
  for (const levelId of basePack.campaignLevelIds) {
    const level = basePack.levels.find((candidate) => candidate.id === levelId);
    if (!level?.map) continue;
    reports.push(validatePhysicalWalkability(level, helpers));
  }

  const failed = reports.filter((report) => report.failures.length > 0);
  if (failed.length > 0) {
    for (const report of failed) {
      console.error(`FAIL physical walkability ${report.levelId}`);
      for (const failure of report.failures) console.error(`  ${failure}`);
    }
    process.exit(1);
  }

  for (const report of reports) {
    console.log(`PASS physical walkability ${report.levelId} checkpoints=${report.checkpoints}`);
  }
}

function validatePhysicalWalkability(level, helpers) {
  const map = level.map;
  const bounds = helpers.movementBoundsForLevel(level, helpers.playerRadius);
  const obstacles = [
    ...(!map
      ? helpers.arenaObstacles.map((obstacle) => ({
          id: obstacle.id,
          position: obstacle.position,
          halfSize: obstacle.halfSize,
        }))
      : []),
    ...helpers.createRoomWallSegments(level, (room) => Boolean(room.geometry?.collisionWalls)).map((segment) => ({
      id: `room-wall:${segment.id}`,
      position: segment.position,
      halfSize: [segment.size[0] / 2, segment.size[1] / 2, segment.size[2] / 2],
    })),
    ...helpers.createPropCollisionProxies(level).map((proxy) => ({
      id: `prop:${proxy.id}`,
      position: proxy.position,
      halfSize: proxy.halfSize,
    })),
  ];
  const field = buildReachabilityField(level.spawnPoint, bounds, obstacles, helpers.playerRadius);
  const checkpoints = collectWalkabilityCheckpoints(level);
  const failures = [];

  for (const checkpoint of checkpoints) {
    if (!insideBounds(checkpoint.position, bounds, checkpoint.radius)) {
      failures.push(`${checkpoint.label} outside movement bounds at ${checkpoint.position.join(",")}`);
      continue;
    }
    if (!field.reaches(checkpoint.position, checkpoint.radius)) {
      failures.push(`${checkpoint.label} unreachable at ${checkpoint.position.join(",")} radius=${checkpoint.radius}`);
    }
  }

  return { levelId: level.id, checkpoints: checkpoints.length, failures };
}

function collectWalkabilityCheckpoints(level) {
  const map = level.map;
  const checkpoints = [
    { label: "spawn", position: level.spawnPoint, radius: 0.75 },
    { label: "exit", position: level.exit.position, radius: level.exit.radius ?? 2 },
  ];

  for (const roomId of map.navigation.criticalPathRoomIds) {
    const room = map.rooms.find((candidate) => candidate.id === roomId);
    if (room) checkpoints.push({ label: `critical room ${room.id}`, position: room.bounds.center, radius: roomCheckpointRadius(room) });
  }
  for (const key of map.keyItems) {
    checkpoints.push({ label: `key ${key.id}`, position: key.position, radius: Math.max(1.2, key.collectRadius ?? 1.2) });
  }
  for (const interaction of map.interactions) {
    checkpoints.push({ label: `interaction ${interaction.id}`, position: interaction.position, radius: Math.max(1.2, interaction.radius ?? 1.2) });
  }
  for (const pickup of map.pickups ?? []) {
    checkpoints.push({ label: `pickup ${pickup.id}`, position: pickup.position, radius: 1.25 });
  }
  for (const puzzle of level.puzzles ?? []) {
    const room = map.rooms.find((candidate) => candidate.id === puzzle.roomId);
    if (room) checkpoints.push({ label: `puzzle room ${puzzle.id}`, position: room.bounds.center, radius: roomCheckpointRadius(room) });
    if (puzzle.type === "hit_sequence") {
      for (const target of puzzle.targets) {
        checkpoints.push({ label: `puzzle target ${target.id}`, position: target.position, radius: Math.max(1.6, target.radius + 1.1) });
      }
    }
  }

  return checkpoints;
}

function roomCheckpointRadius(room) {
  return Math.max(1.2, Math.min(room.bounds.size[0], room.bounds.size[2]) * 0.28);
}

function buildReachabilityField(start, bounds, obstacles, playerRadius) {
  const step = 0.4;
  const width = Math.ceil((bounds.maxX - bounds.minX) / step) + 1;
  const height = Math.ceil((bounds.maxZ - bounds.minZ) / step) + 1;
  const total = width * height;
  const passable = new Uint8Array(total);
  const reachable = new Uint8Array(total);

  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const position = indexToPosition(x, z, bounds, step);
      passable[z * width + x] = pointPassable(position, obstacles, playerRadius) ? 1 : 0;
    }
  }

  const startCell = nearestPassableCell(start, bounds, step, width, height, passable);
  if (!startCell) {
    return { reaches: () => false };
  }

  const queue = [startCell];
  reachable[startCell] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const x = current % width;
    const z = Math.floor(current / width);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;
      const next = nz * width + nx;
      if (!passable[next] || reachable[next]) continue;
      reachable[next] = 1;
      queue.push(next);
    }
  }

  return {
    reaches(position, radius) {
      const minX = Math.max(0, Math.floor((position[0] - radius - bounds.minX) / step));
      const maxX = Math.min(width - 1, Math.ceil((position[0] + radius - bounds.minX) / step));
      const minZ = Math.max(0, Math.floor((position[2] - radius - bounds.minZ) / step));
      const maxZ = Math.min(height - 1, Math.ceil((position[2] + radius - bounds.minZ) / step));
      const radiusSq = radius * radius;
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const index = z * width + x;
          if (!reachable[index]) continue;
          const point = indexToPosition(x, z, bounds, step);
          const dx = point[0] - position[0];
          const dz = point[2] - position[2];
          if (dx * dx + dz * dz <= radiusSq) return true;
        }
      }
      return false;
    },
  };
}

function nearestPassableCell(position, bounds, step, width, height, passable) {
  const originX = Math.round((position[0] - bounds.minX) / step);
  const originZ = Math.round((position[2] - bounds.minZ) / step);
  for (let radius = 0; radius < Math.max(width, height); radius += 1) {
    for (let z = originZ - radius; z <= originZ + radius; z += 1) {
      for (let x = originX - radius; x <= originX + radius; x += 1) {
        if (x < 0 || x >= width || z < 0 || z >= height) continue;
        if (Math.abs(x - originX) !== radius && Math.abs(z - originZ) !== radius) continue;
        const index = z * width + x;
        if (passable[index]) return index;
      }
    }
  }
  return null;
}

function indexToPosition(x, z, bounds, step) {
  return [bounds.minX + x * step, 0, bounds.minZ + z * step];
}

function pointPassable(position, obstacles, playerRadius) {
  for (const obstacle of obstacles) {
    if (circleIntersectsAabb(position, playerRadius, obstacle.position, obstacle.halfSize)) return false;
  }
  return true;
}

function circleIntersectsAabb(position, radius, center, halfSize) {
  const closestX = Math.min(center[0] + halfSize[0], Math.max(center[0] - halfSize[0], position[0]));
  const closestZ = Math.min(center[2] + halfSize[2], Math.max(center[2] - halfSize[2], position[2]));
  const dx = position[0] - closestX;
  const dz = position[2] - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function insideBounds(position, bounds, radius) {
  return (
    position[0] + radius >= bounds.minX &&
    position[0] - radius <= bounds.maxX &&
    position[2] + radius >= bounds.minZ &&
    position[2] - radius <= bounds.maxZ
  );
}

function smokeLevel(world, levelId) {
  world.loadLevel(levelId, "playing");
  resolveModal(world, levelId);

  const steps = [];
  let guard = 0;

  while (world.session.mode !== "victory" && guard < 100) {
    guard += 1;
    let objective = world.activeObjective();

    if (!objective && world.level.objectiveChain?.length) {
      world.dispatchObjectiveEvent({ type: "level_start" });
      objective = world.activeObjective();
    }

    if (!objective) {
      fail(world, levelId, "no active objective before victory");
    }

    steps.push(objective.id);
    performTrigger(world, levelId, objective.completesWhen, objective);
    resolveModal(world, levelId);

    const chainDone = world.level.objectiveChain?.every((candidate) => world.isObjectiveCompleted(candidate.id)) ?? false;
    if (chainDone && world.session.mode === "playing") {
      world.beginExitTransition("script");
      world.completeLevel();
    }
  }

  if (guard >= 100) fail(world, levelId, "objective loop exceeded");
  if (world.session.mode !== "victory") fail(world, levelId, `did not reach victory, mode=${world.session.mode}`);

  return {
    levelId,
    steps,
    completedCount: world.session.mapProgress.completedObjectiveIds.length,
    victoryMessage: world.session.message,
  };
}

function performTrigger(world, levelId, trigger, objective) {
  if (!trigger) fail(world, levelId, `objective ${objective.id} has no completesWhen trigger`);

  if (objective.type === "collect_story_pickups" || objective.type === "inspect_all" || objective.type === "repair_panel") {
    for (const interactionId of objective.requiredIds) {
      if (!world.session.mapProgress.completedInteractionIds.includes(interactionId)) {
        completeInteraction(world, levelId, interactionId);
      }
    }
    return;
  }

  if (objective.type === "survive_wave" || objective.type === "boss_dead") {
    for (const waveId of objective.requiredIds) {
      if (!world.session.mapProgress.completedWaveIds.includes(waveId)) {
        completeWave(world, levelId, waveId);
      }
    }
    if (trigger.type === "exit_unlocked") {
      if (!world.session.exitUnlocked) world.unlockExit();
      return;
    }
    if (world.isObjectiveCompleted(objective.id)) return;
  }

  const triggerId = requireTriggerId(world, levelId, trigger, objective);

  switch (trigger.type) {
    case "interaction_completed":
      completeInteraction(world, levelId, triggerId);
      break;
    case "key_collected":
      collectKey(world, levelId, triggerId);
      break;
    case "door_opened":
      openDoorForSmoke(world, levelId, triggerId);
      break;
    case "wave_completed":
      completeWave(world, levelId, triggerId);
      break;
    case "room_entered":
      enterRoom(world, levelId, triggerId);
      break;
    case "puzzle_completed":
      solvePuzzle(world, levelId, triggerId);
      break;
    case "article_read":
      readArticle(world, levelId, triggerId);
      break;
    case "quiz_completed":
      answerQuiz(world, levelId, triggerId);
      break;
    case "switch_activated":
      activateSwitch(world, levelId, triggerId, trigger.optionId);
      break;
    case "big_screen_state":
      activateBigScreen(world, levelId, triggerId, trigger.optionId);
      break;
    case "exit_unlocked":
      completeExitUnlockPath(world, levelId);
      break;
    case "choice_selected":
      chooseConfiguredChoice(world, levelId, trigger);
      break;
    case "objective_completed":
      completeNamedObjective(world, levelId, triggerId);
      break;
    case "environment_state_set":
      if (!world.setEnvironmentState(triggerId)) fail(world, levelId, `could not set environment state ${triggerId}`);
      break;
    case "level_start":
      world.dispatchObjectiveEvent({ type: "level_start" });
      break;
    default:
      fail(world, levelId, `unsupported completesWhen trigger ${trigger.type}`);
  }
}

function completeExitUnlockPath(world, levelId) {
  const exitWave = world.level.waves.find((wave) => wave.reward === "open_exit" || wave.timedExitUnlockAfter);
  if (exitWave) completeWave(world, levelId, exitWave.id);
  if (!world.session.exitUnlocked) world.unlockExit();
}

function completeNamedObjective(world, levelId, objectiveId) {
  const target = world.level.objectiveChain?.find((candidate) => candidate.id === objectiveId);
  if (!target) fail(world, levelId, `missing objective ${objectiveId}`);
  if (!world.isObjectiveCompleted(target.id)) world.completeObjective(target);
}

function chooseConfiguredChoice(world, levelId, trigger) {
  const choiceId = trigger.id ?? world.session.activeChoiceId;
  if (!choiceId) fail(world, levelId, "choice_selected trigger has no choice id");
  if (world.session.mode !== "choice") world.openChoice(choiceId);
  const choice = world.activeChoice();
  const option = trigger.optionId ? choice?.options.find((candidate) => candidate.id === trigger.optionId) : choice?.options[0];
  if (!option) fail(world, levelId, `choice ${choiceId} has no matching option`);
  if (!world.chooseRuntimeChoice(option.id)) fail(world, levelId, `could not choose option ${option.id}`);
}

function completeInteraction(world, levelId, interactionId) {
  const interaction = world.level.map?.interactions?.find((candidate) => candidate.id === interactionId);
  if (!interaction) fail(world, levelId, `missing interaction ${interactionId}`);
  if (interaction.requiresObjectiveId && !world.isObjectiveCompleted(interaction.requiresObjectiveId)) {
    fail(world, levelId, `interaction ${interactionId} requires incomplete objective ${interaction.requiresObjectiveId}`);
  }

  if (interaction.type === "pickup_story") {
    collectStoryPickup(world, levelId, interactionId);
    return;
  }

  const article = world.articleForInteraction(interactionId);
  if (article) {
    readArticle(world, levelId, article.id);
    return;
  }

  const quiz = world.quizForInteraction(interactionId);
  if (quiz) {
    answerQuiz(world, levelId, quiz.id);
    return;
  }

  const runtimeSwitch = world.switchForInteraction(interactionId);
  if (runtimeSwitch) {
    activateSwitch(world, levelId, runtimeSwitch.id);
    return;
  }

  const bigScreen = world.bigScreenForInteraction(interactionId);
  if (bigScreen) {
    activateBigScreen(world, levelId, bigScreen.id);
    return;
  }

  if (interaction.type === "pickup_key") {
    const item = (world.level.map?.keyItems ?? []).find((candidate) => candidate.interactionId === interactionId);
    if (!item) fail(world, levelId, `pickup_key interaction ${interactionId} has no key item`);
    if (!world.collectConfiguredKeyItem(item)) fail(world, levelId, `could not collect key via interaction ${interactionId}`);
    return;
  }

  world.completeConfiguredInteraction(interactionId);
}

function readArticle(world, levelId, articleId) {
  const article = world.level.articles?.find((candidate) => candidate.id === articleId);
  if (!article) fail(world, levelId, `missing article ${articleId}`);
  if (!world.isArticleRead(article.id)) {
    enterRoom(world, levelId, article.roomId);
    if (!world.openArticle(article.id)) fail(world, levelId, `could not open article ${article.id}`);
    if (!world.closeArticle(true)) fail(world, levelId, `could not mark article read ${article.id}`);
  }
  if (!world.isArticleRead(article.id)) fail(world, levelId, `article did not read ${article.id}`);
}

function answerQuiz(world, levelId, quizId) {
  const quiz = world.level.quizzes?.find((candidate) => candidate.id === quizId);
  if (!quiz) fail(world, levelId, `missing quiz ${quizId}`);
  if (quiz.articleId && !world.isArticleRead(quiz.articleId)) {
    readArticle(world, levelId, quiz.articleId);
  }
  if (!world.isQuizCompleted(quiz.id)) {
    enterRoom(world, levelId, quiz.roomId);
    if (!world.openQuiz(quiz.id)) fail(world, levelId, `could not open quiz ${quiz.id}`);
    const correct = quiz.options.find((option) => option.correct === true);
    if (!correct) fail(world, levelId, `quiz ${quiz.id} has no correct option`);
    if (!world.chooseQuizOption(correct.id)) fail(world, levelId, `could not choose correct option ${correct.id}`);
  }
  if (!world.isQuizCompleted(quiz.id)) fail(world, levelId, `quiz did not complete ${quiz.id}`);
}

function activateSwitch(world, levelId, switchId, stateId) {
  const definition = world.level.switches?.find((candidate) => candidate.id === switchId);
  if (!definition) fail(world, levelId, `missing switch ${switchId}`);
  const expectedState = stateId ?? definition.states[definition.states.length === 1 ? 0 : 1]?.id;
  const interaction = world.level.map?.interactions.find((candidate) => candidate.id === definition.interactionId);
  if (interaction?.consumesKeyItemId) collectKey(world, levelId, interaction.consumesKeyItemId);
  const state = expectedState ? definition.states.find((candidate) => candidate.id === expectedState) : null;
  if (state?.requiredKeyItemId) collectKey(world, levelId, state.requiredKeyItemId);
  enterRoom(world, levelId, definition.roomId);
  if (expectedState && world.isRouteSwitch(definition.id)) {
    if (!world.chooseRouteSwitchState(definition.id, expectedState)) {
      fail(world, levelId, `could not choose route switch state ${definition.id}:${expectedState}`);
    }
    world.closeRouteSwitch();
  }
  if (expectedState && !world.session.mapProgress.activatedSwitchIds.includes(`${definition.id}:${expectedState}`)) {
    if (!world.activateSwitch(definition.id)) fail(world, levelId, `could not activate switch ${definition.id}`);
  }
  if (expectedState && !world.session.mapProgress.activatedSwitchIds.includes(`${definition.id}:${expectedState}`)) {
    fail(world, levelId, `switch ${definition.id} did not activate expected state ${expectedState}`);
  }
}

function activateBigScreen(world, levelId, screenId, stateId) {
  const definition = world.level.bigScreens?.find((candidate) => candidate.id === screenId);
  if (!definition) fail(world, levelId, `missing big screen ${screenId}`);
  enterRoom(world, levelId, definition.roomId);
  if (!world.activateBigScreen(definition.id)) {
    const expectedState = stateId ?? definition.activationStateId ?? definition.states[definition.states.length === 1 ? 0 : 1]?.id;
    if (!expectedState || !world.session.mapProgress.activatedBigScreenIds.includes(`${definition.id}:${expectedState}`)) {
      fail(world, levelId, `could not activate big screen ${definition.id}`);
    }
  }
  const expectedState = stateId ?? definition.activationStateId ?? definition.states[definition.states.length === 1 ? 0 : 1]?.id;
  if (expectedState && !world.session.mapProgress.activatedBigScreenIds.includes(`${definition.id}:${expectedState}`)) {
    fail(world, levelId, `big screen ${definition.id} did not activate expected state ${expectedState}`);
  }
}

function collectStoryPickup(world, levelId, interactionId) {
  const pickupConfig = world.level.pickups.storyPickups.find((pickup) => pickup.interactionId === interactionId);
  if (!pickupConfig) {
    world.completeConfiguredInteraction(interactionId);
    return;
  }
  const pickup = world.pickups.find((candidate) => candidate.type === pickupConfig.type && !candidate.collected);
  if (!pickup) fail(world, levelId, `story pickup ${interactionId} has no live pickup entity`);
  world.collectPickup(pickup);
}

function collectKey(world, levelId, keyItemId) {
  if (world.session.mapProgress.collectedKeyItemIds.includes(keyItemId)) return;
  const item = world.level.map?.keyItems?.find((candidate) => candidate.id === keyItemId);
  if (!item) fail(world, levelId, `missing key item ${keyItemId}`);
  if (!world.isConfiguredKeyItemAvailable(item)) {
    const grantingPuzzle = world.level.puzzles?.find((puzzle) =>
      puzzle.success?.actions?.some((action) => action.type === "grant_key_item" && action.keyItemId === keyItemId),
    );
    if (grantingPuzzle && !world.isPuzzleCompleted(grantingPuzzle.id)) solvePuzzle(world, levelId, grantingPuzzle.id);
  }
  if (world.session.mapProgress.collectedKeyItemIds.includes(keyItemId)) return;
  if (!world.collectConfiguredKeyItem(item)) fail(world, levelId, `could not collect key item ${keyItemId}`);
}

function solvePuzzle(world, levelId, puzzleId) {
  const puzzle = world.level.puzzles?.find((candidate) => candidate.id === puzzleId);
  if (!puzzle) fail(world, levelId, `missing puzzle ${puzzleId}`);

  if (puzzle.type === "hit_sequence") {
    if (puzzle.clue.roomId) enterRoom(world, levelId, puzzle.clue.roomId);
    if (puzzle.clue.playback) {
      if (!world.openSequencePlayback(puzzle.id)) fail(world, levelId, `could not open sequence playback for ${puzzle.id}`);
      if (!world.markSequencePlaybackComplete(puzzle.id)) fail(world, levelId, `could not mark sequence playback complete for ${puzzle.id}`);
      world.closeSequencePlayback();
    }
    for (const targetId of puzzle.clue.sequence ?? []) {
      if (!world.hitConfiguredPuzzleTarget(puzzle.id, targetId, "pulseRifle")) {
        fail(world, levelId, `could not hit puzzle target ${targetId} for ${puzzle.id}`);
      }
    }
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, levelId, `hit sequence puzzle ${puzzle.id} did not complete`);
    return;
  }

  if (puzzle.type === "code_lock") {
    if (!world.openCodeLock(puzzle.id)) fail(world, levelId, `could not open code lock ${puzzle.id}`);
    const code = world.expectedCodeForPuzzle(puzzle);
    for (const digit of code) {
      if (!world.inputCodeLockDigit(digit)) fail(world, levelId, `could not input digit ${digit} for ${puzzle.id}`);
    }
    if (!world.submitCodeLock()) fail(world, levelId, `could not submit correct code ${code} for ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, levelId, `code puzzle ${puzzle.id} did not complete`);
    return;
  }

  if (puzzle.type === "tool_calibration") {
    enterRoom(world, levelId, puzzle.roomId);
    if (!world.openToolCalibration(puzzle.id)) fail(world, levelId, `could not open tool calibration ${puzzle.id}`);
    if (!world.submitToolCalibration(true)) fail(world, levelId, `could not submit tool calibration ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, levelId, `tool calibration puzzle ${puzzle.id} did not complete`);
    return;
  }

  if (puzzle.type === "circuit_grid") {
    enterRoom(world, levelId, puzzle.roomId);
    if (!world.openCircuitGrid(puzzle.id)) fail(world, levelId, `could not open circuit grid ${puzzle.id}`);
    if (!world.submitCircuitGrid()) fail(world, levelId, `could not submit circuit grid ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, levelId, `circuit grid puzzle ${puzzle.id} did not complete`);
    return;
  }

  if (puzzle.type === "surveillance_match") {
    enterRoom(world, levelId, puzzle.roomId);
    // Channel->option assignments live in overlay React state; headless smoke
    // verifies every channel has a configured answer, then submits.
    for (const channel of puzzle.channels) {
      if (!puzzle.options.some((option) => option.id === channel.answerOptionId)) {
        fail(world, levelId, `surveillance match ${puzzle.id} channel ${channel.id} has no valid answer option`);
      }
    }
    if (!world.openSurveillance(puzzle.id)) fail(world, levelId, `could not open surveillance match ${puzzle.id}`);
    if (!world.submitSurveillanceMatch()) fail(world, levelId, `could not submit surveillance match ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, levelId, `surveillance match puzzle ${puzzle.id} did not complete`);
    return;
  }

  if (puzzle.type === "valve_matrix") {
    enterRoom(world, levelId, puzzle.roomId);
    // Re-prove solvability at smoke time before submitting through the world API.
    for (const [gaugeIndex, gauge] of puzzle.gauges.entries()) {
      const value = gauge.base + puzzle.valves.reduce(
        (sum, valve, valveIndex) => sum + (puzzle.solution[valveIndex] ?? 0) * valve.gaugeShift[gaugeIndex],
        0,
      );
      if (Math.abs(value - gauge.target) > gauge.tolerance + 1e-9) {
        fail(world, levelId, `valve matrix ${puzzle.id} reference solution misses gauge ${gauge.id}`);
      }
    }
    if (!world.openValveMatrix(puzzle.id)) fail(world, levelId, `could not open valve matrix ${puzzle.id}`);
    if (!world.submitValveMatrix()) fail(world, levelId, `could not submit valve matrix ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, levelId, `valve matrix puzzle ${puzzle.id} did not complete`);
    return;
  }

  if (puzzle.type === "archive_merge") {
    enterRoom(world, levelId, puzzle.roomId);
    if (!world.openArchiveMerge(puzzle.id)) fail(world, levelId, `could not open archive merge ${puzzle.id}`);
    if (!world.submitArchiveMerge()) fail(world, levelId, `could not submit archive merge ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, levelId, `archive merge puzzle ${puzzle.id} did not complete`);
    return;
  }

  if (puzzle.type === "gallery_reading") {
    enterRoom(world, levelId, puzzle.roomId);
    // Answers live in overlay React state; smoke re-proves every question has a
    // resolvable answer among its choices, then submits through the world API.
    if (puzzle.paintings.length === 0) fail(world, levelId, `gallery reading ${puzzle.id} has no paintings`);
    for (const question of puzzle.questions) {
      if (!question.choices.some((choice) => choice.id === question.answerId)) {
        fail(world, levelId, `gallery reading ${puzzle.id} question ${question.id} answer not among choices`);
      }
    }
    if (!world.openGalleryReading(puzzle.id)) fail(world, levelId, `could not open gallery reading ${puzzle.id}`);
    if (!world.submitGalleryReading()) fail(world, levelId, `could not submit gallery reading ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, levelId, `gallery reading puzzle ${puzzle.id} did not complete`);
    return;
  }

  fail(world, levelId, `unsupported puzzle type ${puzzle.type}`);
}

function completeWave(world, levelId, waveId) {
  const wave = world.level.waves.find((candidate) => candidate.id === waveId);
  if (!wave) fail(world, levelId, `missing wave ${waveId}`);

  if (wave.trigger?.type === "room_entered" && wave.trigger.id) {
    enterRoom(world, levelId, wave.trigger.id);
  }
  if (wave.trigger?.type === "door_opened" && wave.trigger.id) {
    if (!world.openConfiguredDoor(wave.trigger.id)) {
      fail(world, levelId, `could not open trigger door ${wave.trigger.id} for wave ${waveId}`);
    }
  }
  if (wave.trigger?.type === "key_collected" && wave.trigger.id) {
    collectKey(world, levelId, wave.trigger.id);
  }
  if (wave.trigger?.type === "interaction_completed" && wave.trigger.id) {
    completeInteraction(world, levelId, wave.trigger.id);
  }
  if (wave.trigger?.type === "puzzle_completed" && wave.trigger.id && !world.isPuzzleCompleted(wave.trigger.id)) {
    solvePuzzle(world, levelId, wave.trigger.id);
  }
  if (wave.trigger?.type === "article_read" && wave.trigger.id && !world.isArticleRead(wave.trigger.id)) {
    readArticle(world, levelId, wave.trigger.id);
  }
  if (wave.trigger?.type === "quiz_completed" && wave.trigger.id && !world.isQuizCompleted(wave.trigger.id)) {
    answerQuiz(world, levelId, wave.trigger.id);
  }
  if (wave.trigger?.type === "switch_activated" && wave.trigger.id && !world.session.mapProgress.activatedSwitchIds.includes(wave.trigger.id)) {
    activateSwitch(world, levelId, wave.trigger.id, wave.trigger.optionId);
  }
  if (wave.trigger?.type === "big_screen_state" && wave.trigger.id && !world.session.mapProgress.activatedBigScreenIds.includes(wave.trigger.id)) {
    activateBigScreen(world, levelId, wave.trigger.id, wave.trigger.optionId);
  }

  world.markWaveTriggered(wave.id);
  world.markWaveCompleted(wave.id);
  if (wave.reward === "upgrade") world.openUpgrade();
  if (wave.reward === "open_exit") world.unlockExit();
}

function enterRoom(world, levelId, roomId) {
  // Rooms that already host the player (current room / spawn room) need no door.
  const alreadyInside = world.session.mapProgress.currentRoomId === roomId || spawnPointInRoom(world, roomId);
  if (!alreadyInside) {
    const door = doorToRoom(world, roomId);
    if (door && !world.isDoorOpen(door.id)) {
      openDoorForSmoke(world, levelId, door.id, ` before entering room ${roomId}`);
    }
  }
  world.setCurrentRoom(roomId);
  world.revealRoomClue(roomId);
}

function openDoorForSmoke(world, levelId, doorId, context = "") {
  if (world.openConfiguredDoor(doorId)) return;
  const door = world.level.map?.doors.find((candidate) => candidate.id === doorId);
  if (door?.lock.type === "switch_state" && door.lock.switchId) {
    activateSwitch(world, levelId, door.lock.switchId, door.lock.stateId);
    if (world.isDoorOpen(door.id) || world.openConfiguredDoor(door.id)) return;
  }
  fail(world, levelId, `could not open door ${doorId}${context}`);
}

function doorToRoom(world, roomId) {
  const doors = (world.level.map?.doors ?? []).filter((door) => door.toRoomId === roomId || door.fromRoomId === roomId);
  // Prefer doors that are already open or currently openable over locked ones,
  // so a room is never "entered" through the door its own puzzle still locks.
  return doors.find((door) => world.isDoorOpen(door.id)) ?? doors.find((door) => world.canOpenDoor(door)) ?? doors[0] ?? null;
}

function spawnPointInRoom(world, roomId) {
  const room = world.level.map?.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return false;
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const [px, , pz] = world.level.spawnPoint;
  return Math.abs(px - cx) <= sx / 2 && Math.abs(pz - cz) <= sz / 2;
}

function resolveModal(world, levelId) {
  let guard = 0;
  while ((world.session.mode === "upgrade" || world.session.mode === "choice") && guard < 12) {
    guard += 1;
    if (world.session.mode === "upgrade") {
      const pick = world.session.pendingUpgradeIds[0];
      if (!pick) fail(world, levelId, "upgrade modal opened without choices");
      world.chooseUpgrade(pick);
      continue;
    }

    const choice = world.activeChoice();
    const option = choice?.options?.[0];
    if (!option) fail(world, levelId, "choice modal opened without options");
    if (!world.chooseRuntimeChoice(option.id)) fail(world, levelId, `could not choose option ${option.id}`);
  }

  if (guard >= 12) fail(world, levelId, "modal resolution loop exceeded");
}

function requireTriggerId(world, levelId, trigger, objective) {
  if (trigger.type === "level_start" || trigger.type === "exit_unlocked") return trigger.id ?? "";
  if (!trigger.id) fail(world, levelId, `trigger ${trigger.type} on ${objective.id} has no id`);
  return trigger.id;
}

function fail(world, levelId, message) {
  const active = world.activeObjective();
  const completed = world.session.mapProgress.completedObjectiveIds.join(",");
  throw new Error(`${levelId}: ${message}; active=${active?.id ?? "none"} mode=${world.session.mode} completed=[${completed}]`);
}
