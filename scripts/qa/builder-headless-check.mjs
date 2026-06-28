// Headless builder contract check (no browser): compile/validate, playtest
// inventory, placement rules, catalog thumbnails, asset-pack import bridge,
// SSR render of /build.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import * as bridge from "../asset-build/generate-builder-asset-pack-registry.mjs";

const server = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });
try {
  const { createStarterProject } = await server.ssrLoadModule("/src/build/BuilderTypes.ts");
  const { builderProjectFromBuiltInLevel } = await server.ssrLoadModule("/src/build/BuilderLevelImport.ts");
  const { repairProject } = await server.ssrLoadModule("/src/build/BuilderDirector.ts");
  const { compileBuilderProjectToLevel, sharedEdge } = await server.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts");
  const { validateLevelConfig } = await server.ssrLoadModule("/src/game/config/ConfigValidator.ts");
  const { builderPropCatalog, builderRobotCatalog } = await server.ssrLoadModule("/src/build/BuilderAssetCatalog.ts");
  const { builderPickupCatalog } = await server.ssrLoadModule("/src/build/BuilderPickupCatalog.ts");
  const { footprintFamily, knownFootprintModelKeys } = await server.ssrLoadModule("/src/build/BuilderAssetFootprints.tsx");
  const { isBuilderDiscarded } = await server.ssrLoadModule("/src/build/builderDiscardedAssets.ts");
  const { environmentModelAssets, modelKeyForKeyVisual } = await server.ssrLoadModule("/src/assets/environmentModelAssets.ts");
  const { isStoryPaintingArtModelKey } = await server.ssrLoadModule("/src/game/visual/StoryPaintingArt.ts");
  const { computeTopology } = await server.ssrLoadModule("/src/build/BuilderTopology.ts");
  const { placementAt, pickAt, routeKeyPosition, routeOutputKeyPosition } = await server.ssrLoadModule("/src/build/BuilderPlacementRules.ts");
  const { roomFloor, roomWall, roomCeiling, clampLighting, projectLighting, builderCeilingPresets, builderFloorPresets, builderWallPresets } =
    await server.ssrLoadModule("/src/build/BuilderEnvironment.ts");
  const { roomEditIssues, introducedIssues, pickRoomHandle, resizeRoom } = await server.ssrLoadModule("/src/build/BuilderRoomEditing.ts");
  const { createSingleLevelConfigPack, humanProtocolBasePack } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");

  // 1. starter compiles + validates with zero errors
  const project = createStarterProject();
  const { level, issues } = compileBuilderProjectToLevel(project);
  if (!level || issues.length) throw new Error("starter compile failed: " + JSON.stringify(issues));
  const report = validateLevelConfig(level, { authoringProfile: "generated" });
  if (!report.ok) throw new Error("starter validator errors: " + JSON.stringify(report.errors));
  const starterPickupTypes = new Set((level.map.pickups ?? []).map((pickup) => pickup.type));
  if (!starterPickupTypes.has("repairKit") || !starterPickupTypes.has("coreCell")) {
    throw new Error("starter must compile placed repairKit + coreCell pickups: " + JSON.stringify(level.map.pickups));
  }
  const starterKey = level.map.keyItems.find((item) => item.requiredForDoorIds.includes("door_c"));
  if (!starterKey || starterKey.visualKey !== "large_yellow_key") {
    throw new Error("builder key doors must use the old Level 3 large key pickup model visual: " + JSON.stringify(starterKey));
  }
  const starterExitDoor = level.map.doors.find((door) => door.fromRoomId === project.exitRoomId || door.toRoomId === project.exitRoomId);
  if (
    level.exit.cinematic?.type !== "elevator_walk_in" ||
    level.exit.cinematic.buttonPressDuration !== 1.15 ||
    level.exit.cinematic.ascentDuration !== 4.8 ||
    level.exit.cinematic.doorId !== starterExitDoor?.id
  ) {
    throw new Error("builder exit must use official elevator cinematic with physical press + ascent ride: " + JSON.stringify(level.exit.cinematic));
  }
  const starterExitRoom = level.map.rooms.find((room) => room.id === project.exitRoomId);
  if (
    starterExitRoom?.skinKey !== "service_elevator_hero" ||
    starterExitRoom?.floorMaterialKey !== "service_elevator_metal" ||
    starterExitRoom?.wallMaterialKey !== "service_elevator_metal" ||
    JSON.stringify(starterExitRoom?.bounds?.size) !== JSON.stringify([6.4, 4, 5.4])
  ) {
    throw new Error("builder exit room must be replaced by the shared service-elevator room: " + JSON.stringify(starterExitRoom));
  }
  const starterExitPropKeys = level.map.props.filter((prop) => prop.roomId === project.exitRoomId).map((prop) => prop.modelKey);
  if (
    !starterExitPropKeys.includes("service_elevator_exit_stage") ||
    !starterExitPropKeys.includes("service_elevator_interior_shell") ||
    !starterExitPropKeys.includes("door_threshold_service_elevator") ||
    !starterExitPropKeys.includes("service_elevator_call_buttons") ||
    !starterExitPropKeys.includes("service_elevator_ascent_shaft_fx") ||
    starterExitPropKeys.includes("terminal_code_keypad") ||
    starterExitPropKeys.includes("switch_panel_wall_cyan")
  ) {
    throw new Error("builder exit room must include the baked in-world elevator stage plus fallback shell, threshold, single call button, and ascent shaft FX: " + JSON.stringify(starterExitPropKeys));
  }
  console.log("PASS starter compiles+validates, errors=0 warnings=" + report.warnings.length);

  // 1a. Official-level imports must keep combat waves visible/editable in
  // /build, then compile them back without losing ids, triggers or
  // reinforcements. This is what lets a hand-polished build draft become a
  // campaign config without silently deleting monster waves.
  const importedL3 = builderProjectFromBuiltInLevel("level_03_human_museum");
  if (!importedL3) throw new Error("level_03_human_museum did not import into builder");
  const importedL3PuzzleById = new Map((importedL3.puzzles ?? []).map((puzzle) => [puzzle.id, puzzle]));
  const importedL3ToolPuzzle = importedL3PuzzleById.get("level_03_tool_calibration");
  if (
    !importedL3ToolPuzzle ||
    importedL3ToolPuzzle.kind !== "circuit_grid" ||
    importedL3ToolPuzzle.resultMode !== "open_door" ||
    importedL3ToolPuzzle.linkedDoorId !== "level_03_voice_door" ||
    importedL3ToolPuzzle.interactionId !== "level_03_tool_case"
  ) {
    throw new Error("official L3 builder import lost the tool-calibration -> voice-door puzzle lock: " + JSON.stringify(importedL3ToolPuzzle));
  }
  const importedL3ToolChip = importedL3.pickups.find((pickup) => pickup.id === "level_03_tool_chip");
  if (importedL3ToolChip) {
    throw new Error("official L3 builder import must not expose the old tool-chip key pickup: " + JSON.stringify(importedL3ToolChip));
  }
  const importedL3ColorPuzzle = importedL3PuzzleById.get("builder_color_lock");
  const importedL3ColorSequence = (importedL3ColorPuzzle?.components ?? []).map((component) => component.role.replace("orb_", "")).join(" -> ");
  if (
    !importedL3ColorPuzzle ||
    importedL3ColorPuzzle.kind !== "color_sequence" ||
    importedL3ColorPuzzle.linkedDoorId !== "level_03_archive_door" ||
    importedL3ColorPuzzle.interactionId !== "builder_color_clue" ||
    importedL3ColorSequence !== "red -> blue -> yellow -> green -> purple"
  ) {
    throw new Error("official L3 builder import lost the five-color lamp-wall sequence: " + JSON.stringify(importedL3ColorPuzzle));
  }
  const importedL3Route = importedL3.routeSwitches?.find((route) => route.id === "route_z43akm");
  if (
    !importedL3Route ||
    importedL3Route.outputs[0]?.kind !== "open_door" ||
    importedL3Route.outputs[0]?.doorId !== "level_03_official_exit_door" ||
    Math.abs((importedL3Route.keyPosition?.[0] ?? -999) - -5.04) > 0.01 ||
    Math.abs((importedL3Route.keyPosition?.[1] ?? -999) - 0.86) > 0.01
  ) {
    throw new Error("official L3 builder import lost route-switch key/output semantics: " + JSON.stringify(importedL3Route));
  }
  if (importedL3.props.some((prop) => prop.id === "prop_e2bth8" || prop.modelKey === "room_desire_holo_globe")) {
    throw new Error("official L3 builder import brought back the removed decorative blue globe decoy");
  }
  const sourceL3 = humanProtocolBasePack.levels.find((level) => level.id === "level_03_human_museum");
  const sourceL3LobbyWave = sourceL3?.waves.find((wave) => wave.id === "level_03_lobby_patrol");
  const sourceL3VoiceDoor = sourceL3?.map?.doors.find((door) => door.id === "level_03_voice_door");
  const sourceL3RouteSwitch = sourceL3?.switches?.find((entry) => entry.id === "route_route_z43akm");
  const sourceL3RouteOutputState = sourceL3RouteSwitch?.states.find((state) => state.id !== sourceL3RouteSwitch.initialStateId);
  const sourceL3RouteKeys = (sourceL3?.map?.keyItems ?? []).filter((item) => item.id.startsWith("route_route_z43akm_"));
  const sourceL3RouteKey = sourceL3RouteKeys[0];
  const sourceL3LobbyRepair = sourceL3LobbyWave?.enemies.find((enemy) => enemy.archetype === "repair_drone");
  const sourceL3LobbyRepairReinforcement = sourceL3LobbyWave?.reinforcements?.find((enemy) => enemy.archetype === "repair_drone");
  if (!sourceL3LobbyWave || !sourceL3LobbyRepair || !sourceL3LobbyRepairReinforcement || sourceL3VoiceDoor?.lock.type !== "puzzle_complete" || sourceL3VoiceDoor.lock.puzzleId !== "level_03_tool_calibration") {
    throw new Error("official L3 source is missing the import contract for lobby wave or tool puzzle door");
  }
  if (
    !sourceL3RouteSwitch ||
    !sourceL3RouteOutputState ||
    sourceL3RouteOutputState.requiredKeyItemId !== sourceL3RouteKey?.id ||
    sourceL3RouteKeys.length !== 1 ||
    sourceL3RouteKey.visualKey !== "route_output_orb_1" ||
    sourceL3RouteKey.materialKey !== "terminal_cyan" ||
    modelKeyForKeyVisual(sourceL3RouteKey.visualKey) !== "pickup_route_output_orb_1"
  ) {
    throw new Error("official L3 source route output must render as a per-output authorization orb, not the legacy shared route chip: " + JSON.stringify({ sourceL3RouteKey, sourceL3RouteOutputState, count: sourceL3RouteKeys.length }));
  }
  const l3LobbyInitial = importedL3.robots.find((robot) => robot.wave?.id === "level_03_lobby_patrol" && robot.wave?.role !== "reinforcement");
  const l3LobbyReinforcement = importedL3.robots.find((robot) => robot.wave?.id === "level_03_lobby_patrol" && robot.wave?.role === "reinforcement");
  if (!l3LobbyInitial || l3LobbyInitial.roomId !== "level_03_gallery_lobby" || l3LobbyInitial.count !== sourceL3LobbyRepair.count) {
    throw new Error("official L3 lobby wave was not visible as an initial builder robot group: " + JSON.stringify(l3LobbyInitial));
  }
  if (
    !l3LobbyReinforcement ||
    l3LobbyReinforcement.wave?.reinforcement?.startsAfter !== sourceL3LobbyRepairReinforcement.startsAfter ||
    l3LobbyReinforcement.wave?.reinforcement?.maxGroups !== sourceL3LobbyRepairReinforcement.maxGroups
  ) {
    throw new Error("official L3 lobby reinforcement was not visible in builder: " + JSON.stringify(l3LobbyReinforcement));
  }
  const importedL3Compiled = compileBuilderProjectToLevel(importedL3);
  if (!importedL3Compiled.level || importedL3Compiled.issues.length) throw new Error("official L3 builder import did not compile cleanly: " + JSON.stringify(importedL3Compiled.issues));
  const compiledL3Interactions = new Map((importedL3Compiled.level.map?.interactions ?? []).map((interaction) => [interaction.id, interaction]));
  const compiledL3LampWall = compiledL3Interactions.get("builder_color_clue");
  if (compiledL3LampWall?.visualKey !== "puzzle_console_color_sequence" || Math.abs(compiledL3LampWall.position[1]) > 0.001) {
    throw new Error("official L3 builder import did not compile the lamp wall as a grounded color-sequence console: " + JSON.stringify(compiledL3LampWall));
  }
  if ((importedL3Compiled.level.map?.props ?? []).some((prop) => prop.id === "prop_e2bth8" || prop.modelKey === "room_desire_holo_globe")) {
    throw new Error("official L3 builder import recompiled the removed decorative blue globe decoy");
  }
  const compiledL3ToolPuzzle = importedL3Compiled.level.puzzles?.find((puzzle) => puzzle.id === "level_03_tool_calibration");
  if (
    !compiledL3ToolPuzzle ||
    compiledL3ToolPuzzle.success.actions?.some((action) => action.type === "grant_key_item") ||
    !compiledL3ToolPuzzle.success.actions?.some((action) => action.type === "open_door" && action.doorId === "level_03_voice_door")
  ) {
    throw new Error("official L3 builder import did not recompile the tool puzzle as a direct voice-door puzzle: " + JSON.stringify(compiledL3ToolPuzzle));
  }
  const compiledL3KeyItems = importedL3Compiled.level.map?.keyItems ?? [];
  const compiledL3BodyDoorKeys = compiledL3KeyItems.filter((item) => item.requiredForDoorIds.includes("level_03_body_door"));
  if (
    compiledL3BodyDoorKeys.length !== 1 ||
    compiledL3BodyDoorKeys[0].id !== "key_level_03_body_door" ||
    compiledL3BodyDoorKeys[0].roomId !== "level_03_voice_exhibit"
  ) {
    throw new Error("official L3 must have exactly one voice-room key for the body door: " + JSON.stringify(compiledL3BodyDoorKeys));
  }
  const compiledL3VoiceDoorKeys = compiledL3KeyItems.filter((item) => item.requiredForDoorIds.includes("level_03_voice_door"));
  if (compiledL3VoiceDoorKeys.length !== 0) {
    throw new Error("official L3 voice door must be a puzzle door, not a key-door shim: " + JSON.stringify(compiledL3VoiceDoorKeys));
  }
  const staleL3ToolKeyDraft = {
    ...importedL3,
    puzzles: (importedL3.puzzles ?? []).map((puzzle) =>
      puzzle.id === "level_03_tool_calibration" ? { ...puzzle, resultMode: "grant_key" } : puzzle,
    ),
    pickups: [
      ...(importedL3.pickups ?? []),
      {
        id: "level_03_tool_chip",
        kind: "key_item",
        roomId: "level_03_tool_exhibit",
        position: [-12.2, 4.8],
        linkedDoorId: "level_03_voice_door",
        grantedByPuzzleId: "level_03_tool_calibration",
      },
    ],
  };
  const staleL3ToolKeyCompiled = compileBuilderProjectToLevel(staleL3ToolKeyDraft);
  if (!staleL3ToolKeyCompiled.level || staleL3ToolKeyCompiled.issues.length) {
    throw new Error("stale L3 grant-key tool draft should auto-migrate before compile: " + JSON.stringify(staleL3ToolKeyCompiled.issues));
  }
  const staleL3VoiceDoor = staleL3ToolKeyCompiled.level.map.doors.find((door) => door.id === "level_03_voice_door");
  const staleL3ToolKey = staleL3ToolKeyCompiled.level.map.keyItems.find((item) => item.id === "level_03_tool_chip");
  const staleL3ToolPuzzle = staleL3ToolKeyCompiled.level.puzzles?.find((puzzle) => puzzle.id === "level_03_tool_calibration");
  if (
    staleL3VoiceDoor?.lock.type !== "puzzle_complete" ||
    staleL3VoiceDoor.lock.puzzleId !== "level_03_tool_calibration" ||
    staleL3ToolKey ||
    staleL3ToolPuzzle?.success.actions?.some((action) => action.type === "grant_key_item")
  ) {
    throw new Error("stale L3 grant-key tool draft did not migrate to direct puzzle door: " + JSON.stringify({ staleL3VoiceDoor, staleL3ToolKey, staleL3ToolPuzzle }));
  }
  console.log("PASS official L3 stale tool key draft: grant-key puzzle migrates to direct puzzle door before bake");
  const compiledL3RouteSwitch = importedL3Compiled.level.switches?.find((entry) => entry.id === "route_route_z43akm");
  const compiledL3RouteOutputState = compiledL3RouteSwitch?.states.find((state) => state.id !== compiledL3RouteSwitch.initialStateId);
  const compiledL3RouteKey = compiledL3KeyItems.find((item) => item.id === compiledL3RouteOutputState?.requiredKeyItemId);
  const [expectedRouteKeyX, expectedRouteKeyZ] = routeOutputKeyPosition(importedL3, importedL3Route, importedL3Route.outputs[0], 0);
  const legacyRouteKeyConsumers = (importedL3Compiled.level.map?.interactions ?? []).filter((interaction) => interaction.consumesKeyItemId === "route_route_z43akm_key");
  if (
    !compiledL3RouteSwitch ||
    !compiledL3RouteOutputState ||
    !compiledL3RouteKey ||
    compiledL3RouteKey.roomId !== "level_03_gallery_lobby" ||
    compiledL3RouteKey.visualKey !== "route_output_orb_1" ||
    compiledL3RouteKey.materialKey !== "terminal_cyan" ||
    Math.abs(compiledL3RouteKey.position[0] - expectedRouteKeyX) > 0.01 ||
    Math.abs(compiledL3RouteKey.position[2] - expectedRouteKeyZ) > 0.01 ||
    compiledL3RouteKey.requiredForDoorIds.length !== 0 ||
    legacyRouteKeyConsumers.length !== 0
  ) {
    throw new Error("official L3 route output orb must stay visible in the lobby and feed only its matching route output state: " + JSON.stringify({ compiledL3RouteKey, compiledL3RouteOutputState, legacyRouteKeyConsumers, expectedRouteKeyX, expectedRouteKeyZ }));
  }
  if (modelKeyForKeyVisual(compiledL3RouteKey.visualKey) !== "pickup_route_output_orb_1") {
    throw new Error("official L3 route output key must resolve to the output orb pickup model, not the old chip/yellow key: " + compiledL3RouteKey.visualKey);
  }
  const importedL2 = builderProjectFromBuiltInLevel("level_02_residential_simulation");
  if (!importedL2) throw new Error("level_02_residential_simulation did not import into builder");
  if (importedL2.pickups.some((pickup) => pickup.id === "level_02_family_key")) {
    const staleL2 = {
      ...importedL2,
      pickups: importedL2.pickups.map((pickup) =>
        pickup.id === "level_02_family_key"
          ? { ...pickup, sourceKeyItem: { ...(pickup.sourceKeyItem ?? {}), requiresObjectiveId: "level_02_defeat_host" } }
          : pickup,
      ),
    };
    const staleL2Compiled = compileBuilderProjectToLevel(staleL2);
    if (!staleL2Compiled.level || staleL2Compiled.issues.length) throw new Error("stale L2 key-gate draft did not compile: " + JSON.stringify(staleL2Compiled.issues));
    const staleL2FamilyKey = staleL2Compiled.level.map.keyItems.find((item) => item.id === "level_02_family_key");
    if (!staleL2FamilyKey || staleL2FamilyKey.requiresObjectiveId) {
      throw new Error("stale L2 key-gate draft kept a missing requiresObjectiveId: " + JSON.stringify(staleL2FamilyKey));
    }
    const staleL2Report = validateLevelConfig(staleL2Compiled.level, { authoringProfile: "generated" });
    if (!staleL2Report.ok) throw new Error("stale L2 key-gate draft failed validation: " + JSON.stringify(staleL2Report.errors));
    console.log("PASS stale L2 key objective gate: missing level_02_defeat_host stripped before bake");
  } else {
    const importedL2Compiled = compileBuilderProjectToLevel(importedL2);
    if (!importedL2Compiled.level || importedL2Compiled.issues.length) throw new Error("keyless L2 draft did not compile: " + JSON.stringify(importedL2Compiled.issues));
    if (importedL2Compiled.level.map.keyItems.some((item) => item.id === "level_02_family_key")) {
      throw new Error("keyless L2 draft reintroduced family key during compile");
    }
    console.log("PASS official L2 keyless flow: family key gate absent from /build import");
  }
  const compiledL3Route = importedL3Compiled.level.switches?.find((route) => route.id === "route_route_z43akm");
  if (!compiledL3Route || !compiledL3Route.states.some((state) => state.actions?.some((action) => action.type === "open_door" && action.doorId === "level_03_official_exit_door"))) {
    throw new Error("official L3 builder import did not recompile the route switch exit-door output: " + JSON.stringify(compiledL3Route));
  }
  const l3LobbyWave = importedL3Compiled.level.waves.find((wave) => wave.id === "level_03_lobby_patrol");
  if (
    l3LobbyWave?.trigger?.type !== "room_entered" ||
    l3LobbyWave.trigger.id !== "level_03_gallery_lobby" ||
    l3LobbyWave.reinforcements?.[0]?.startsAfter !== sourceL3LobbyRepairReinforcement.startsAfter ||
    l3LobbyWave.reinforcements?.[0]?.maxAlive !== sourceL3LobbyRepairReinforcement.maxAlive
  ) {
    throw new Error("official L3 builder import lost lobby wave semantics: " + JSON.stringify(l3LobbyWave));
  }
  const importedL3Report = validateLevelConfig(importedL3Compiled.level, { authoringProfile: "generated" });
  if (!importedL3Report.ok) throw new Error("official L3 builder import validator errors: " + JSON.stringify(importedL3Report.errors));
  console.log("PASS official import L3: waves, puzzle-granted key, lamp sequence, route switch and deleted decoy round-trip through /build");

  // 1a-door-family. A picked door family survives compile+sanitize with its
  // premium visualKey AND wall surround material (the sanitizer must not strip
  // it back to terminal_cyan), and the validator accepts it. The exit-room door
  // override still wins so the elevator cinematic is never broken.
  const familyProject = createStarterProject();
  familyProject.doors = familyProject.doors.map((door) => {
    if (door.id === "door_b") return { ...door, doorFamily: "reclamation" }; // non-exit
    if (door.id === "door_a") return { ...door, doorFamily: "residential" }; // non-exit
    if (door.id === "door_d") return { ...door, doorFamily: "residential" }; // exit-adjacent → override wins
    return door;
  });
  const familyCompiled = compileBuilderProjectToLevel(familyProject);
  if (familyCompiled.issues.length) throw new Error("door-family compile failed: " + JSON.stringify(familyCompiled.issues));
  const famDoorB = familyCompiled.level.map.doors.find((d) => d.id === "door_b");
  const famDoorA = familyCompiled.level.map.doors.find((d) => d.id === "door_a");
  const famDoorD = familyCompiled.level.map.doors.find((d) => d.id === "door_d");
  if (famDoorB?.visualKey !== "reclamation_archive_door" || famDoorB?.materialKey !== "museum_wall") {
    throw new Error("reclamation family door lost its visualKey/material to the sanitizer: " + JSON.stringify(famDoorB));
  }
  if (famDoorA?.visualKey !== "residential_access_door" || famDoorA?.materialKey !== "residential_wall") {
    throw new Error("residential family door lost its visualKey/material to the sanitizer: " + JSON.stringify(famDoorA));
  }
  if (famDoorD?.visualKey !== "service_elevator_door" || famDoorD?.materialKey !== "service_elevator_metal") {
    throw new Error("exit-room door must stay the elevator door regardless of picked family: " + JSON.stringify(famDoorD));
  }
  const famReport = validateLevelConfig(familyCompiled.level, { authoringProfile: "generated" });
  if (!famReport.ok) throw new Error("door-family validator errors: " + JSON.stringify(famReport.errors));
  console.log("PASS door family: reclamation/residential survive compile+sanitize+validate, exit door stays elevator");

  // 1b. A route switch with door + robot outputs compiles, passes the full
  //     graph validator, and each output carries a focus_reveal action (3D
  //     target reveal). The puzzle-output reveal + gate are proven end-to-end in
  //     route-switch-runtime-qa (which exercises the live GameWorld).
  const routeProject = createStarterProject();
  routeProject.projectId = "proj_route_headless";
  routeProject.routeSwitches = [
    {
      id: "rt_headless",
      label: "管制路由台",
      roomId: "room_hall",
      keyRoomId: "room_archive",
      position: [-2.4, 3.0],
      rotationY: 0,
      outputs: [
        { id: "o_door", kind: "open_door", doorId: "door_c" },
        { id: "o_robots", kind: "start_robots", robotRoomId: "room_fight" },
      ],
    },
  ];
  const routeCompiled = compileBuilderProjectToLevel(routeProject);
  const routeFatal = (routeCompiled.issues ?? []).filter((issue) => issue.severity === "error");
  if (routeFatal.length) throw new Error("route switch compile errors: " + JSON.stringify(routeFatal));
  const routeReport = validateLevelConfig(routeCompiled.level, { authoringProfile: "generated" });
  if (!routeReport.ok) throw new Error("route switch validator errors: " + JSON.stringify(routeReport.errors));
  const routeSwitch = (routeCompiled.level.switches ?? []).find((s) => s.id.startsWith("route_"));
  if (!routeSwitch) throw new Error("compiled route switch missing");
  const revealStates = routeSwitch.states.filter((state) => (state.actions ?? []).some((a) => a.type === "focus_reveal"));
  if (revealStates.length < 2) {
    throw new Error("each route output should emit a focus_reveal action; got " + revealStates.length + " of 2");
  }
  console.log("PASS route switch: door+robot outputs compile+validate, focus_reveal actions emitted");

  // 1c. A wall door switch compiles into a real interaction, switch_state lock,
  //     repeatable hand-press presentation, and graph-valid route.
  const wallSwitchProject = createStarterProject();
  wallSwitchProject.projectId = "proj_wall_switch_headless";
  wallSwitchProject.wallDoorSwitches = [
    {
      id: "wall_headless",
      label: "墙面门控把手",
      roomId: "room_hall",
      wallMount: { side: "east", offset: 0.15, height: 1.34, inset: 0.2 },
      initialStateId: "closed",
      oneShot: false,
      states: [
        { id: "closed", label: "关闭", message: "门控保持当前通路。" },
        { id: "open", label: "打开", openDoorIds: ["door_c"], message: "门控打开通路。" },
      ],
    },
  ];
  wallSwitchProject.doors = wallSwitchProject.doors.map((door) =>
    door.id === "door_c"
      ? { ...door, lockType: "switch_state", wallDoorSwitchId: "wall_headless", wallDoorSwitchStateId: "open", keyRoomId: undefined }
      : door,
  );
  const wallSwitchCompiled = compileBuilderProjectToLevel(wallSwitchProject);
  const wallSwitchFatal = (wallSwitchCompiled.issues ?? []).filter((issue) => issue.severity === "error");
  if (wallSwitchFatal.length) throw new Error("wall door switch compile errors: " + JSON.stringify(wallSwitchFatal));
  const wallSwitchReport = validateLevelConfig(wallSwitchCompiled.level, { authoringProfile: "generated" });
  if (!wallSwitchReport.ok) throw new Error("wall door switch validator errors: " + JSON.stringify(wallSwitchReport.errors));
  const compiledWallSwitch = (wallSwitchCompiled.level.switches ?? []).find((candidate) => candidate.id.includes("wall_headless"));
  const compiledWallInteraction = wallSwitchCompiled.level.map.interactions.find((candidate) => candidate.id.includes("wall_headless"));
  const compiledWallDoor = wallSwitchCompiled.level.map.doors.find((door) => door.id === "door_c");
  if (!compiledWallSwitch || compiledWallSwitch.presentation?.kind !== "wall_lever" || compiledWallSwitch.presentation?.modelKey !== "hp_wall_door_switch_button_v1" || compiledWallSwitch.oneShot) {
    throw new Error("compiled wall switch must be a repeatable wall lever using the generic 3D handle: " + JSON.stringify(compiledWallSwitch));
  }
  if (compiledWallSwitch.presentation?.handPose !== "lever_push_down" || compiledWallSwitch.presentation?.hideWeapon !== true) {
    throw new Error("compiled wall switch must use the weapon-free lever hand pose: " + JSON.stringify(compiledWallSwitch.presentation));
  }
  if ((compiledWallSwitch.states?.[0]?.actions ?? []).some((action) => action.type === "open_door" || action.type === "close_door")) {
    throw new Error("compiled wall switch hold state should not open or close a door: " + JSON.stringify(compiledWallSwitch.states?.[0]));
  }
  if ((compiledWallSwitch.states?.[1]?.actions ?? []).some((action) => action.type === "unlock_door")) {
    throw new Error("compiled wall switch open state should open by mechanism action, not unlock the door for direct E: " + JSON.stringify(compiledWallSwitch.states?.[1]));
  }
  if (!compiledWallInteraction || compiledWallInteraction.visualKey !== "wall_door_switch_button" || typeof compiledWallInteraction.yaw !== "number") {
    throw new Error("compiled wall switch interaction missing wall visual/yaw: " + JSON.stringify(compiledWallInteraction));
  }
  if (compiledWallDoor?.defaultState !== "closed" || compiledWallDoor?.lock?.type !== "switch_state" || compiledWallDoor.lock.manualOpen !== false || !compiledWallDoor.lock.switchId || !compiledWallDoor.lock.stateId) {
    throw new Error("compiled door_c must use switch_state lock: " + JSON.stringify(compiledWallDoor?.lock));
  }
  console.log("PASS wall door switch: repeatable wall lever compiles+validates with non-manual closed switch_state door");

  // 1d. Wave-chain authoring contract: finite core waves drive progression,
  // then a separate pressure loop can repeat forever without becoming the door
  // lock condition.
  const bossPreset = builderRobotCatalog.find((entry) => entry.presetId === "museum_curator_boss");
  if (!bossPreset || bossPreset.archetype !== "shield_tech") {
    throw new Error("robot catalog must expose the museum curator boss preset alongside base archetypes");
  }
  const chainProject = createStarterProject();
  chainProject.projectId = "proj_wave_chain_headless";
  chainProject.robots = [
    {
      id: "chain_robot_1",
      roomId: "room_fight",
      archetype: "repair_drone",
      count: 2,
      position: [-2, 8],
      waveChain: { waveId: "chain_wave_1", order: 1, label: "波次 1" },
    },
    {
      id: "chain_robot_2",
      roomId: "room_fight",
      archetype: "clamp_bot",
      count: 1,
      position: [2, 8],
      waveChain: {
        waveId: "chain_wave_2",
        order: 2,
        label: "波次 2",
        clearActions: [{ kind: "open_door", doorId: "door_d" }],
        pressureLoop: { enabled: true, archetype: "repair_drone", count: 1, startsAfter: 1.25, every: 3, maxAlive: 2 },
      },
    },
  ];
  chainProject.doors = chainProject.doors.map((door) => (door.id === "door_d" ? { ...door, lockType: "survive_wave", surviveRobotId: "chain_robot_2", waveId: "chain_wave_2" } : door));
  const chainCompiled = compileBuilderProjectToLevel(chainProject);
  if (!chainCompiled.level || chainCompiled.issues.length) throw new Error("wave-chain compile failed: " + JSON.stringify(chainCompiled.issues));
  const chainReport = validateLevelConfig(chainCompiled.level, { authoringProfile: "generated" });
  if (!chainReport.ok) throw new Error("wave-chain validator errors: " + JSON.stringify(chainReport.errors));
  const chainWaves = new Set(chainCompiled.level.waves.map((wave) => wave.id));
  if (!chainWaves.has("chain_wave_1") || !chainWaves.has("chain_wave_2") || !chainWaves.has("chain_wave_2_pressure_loop")) {
    throw new Error("wave-chain did not compile core waves + pressure loop: " + JSON.stringify(chainCompiled.level.waves.map((wave) => wave.id)));
  }
  const chainDoor = chainCompiled.level.map.doors.find((door) => door.id === "door_d");
  if (chainDoor?.lock.type !== "survive_wave" || chainDoor.lock.waveId !== "chain_wave_2") {
    throw new Error("wave-chain door must lock to finite final core wave, not pressure loop: " + JSON.stringify(chainDoor?.lock));
  }
  const wave1Event = chainCompiled.level.events?.find((event) => event.trigger.type === "wave_completed" && event.trigger.id === "chain_wave_1");
  if (!wave1Event?.actions.some((action) => action.type === "start_wave" && action.waveId === "chain_wave_2")) {
    throw new Error("wave-chain wave 1 must start wave 2 on clear: " + JSON.stringify(wave1Event));
  }
  const wave2Event = chainCompiled.level.events?.find((event) => event.trigger.type === "wave_completed" && event.trigger.id === "chain_wave_2");
  if (
    !wave2Event?.actions.some((action) => action.type === "open_door" && action.doorId === "door_d") ||
    !wave2Event.actions.some((action) => action.type === "start_wave" && action.waveId === "chain_wave_2_pressure_loop" && action.delay === 1.25)
  ) {
    throw new Error("wave-chain final core wave must open the door and start pressure loop: " + JSON.stringify(wave2Event));
  }
  const pressureRepeat = chainCompiled.level.events?.find((event) => event.trigger.type === "wave_completed" && event.trigger.id === "chain_wave_2_pressure_loop");
  if (!pressureRepeat?.actions.some((action) => action.type === "start_wave" && action.waveId === "chain_wave_2_pressure_loop" && action.repeat === true)) {
    throw new Error("pressure loop must restart itself with repeat=true: " + JSON.stringify(pressureRepeat));
  }
  console.log("PASS wave chain: finite core waves open doors, final pressure loop repeats without becoming the lock");

  const explicitGuardProject = createStarterProject();
  explicitGuardProject.projectId = "proj_explicit_guard_headless";
  explicitGuardProject.robots = [
    { id: "remote_guard_robot", label: "远程守门组", roomId: "room_hall", archetype: "shield_tech", count: 1, position: [0, 3] },
  ];
  explicitGuardProject.doors = explicitGuardProject.doors.map((door) =>
    door.id === "door_d" ? { ...door, lockType: "survive_wave", surviveRobotId: "remote_guard_robot", waveId: undefined } : door,
  );
  const explicitGuardCompiled = compileBuilderProjectToLevel(explicitGuardProject);
  if (!explicitGuardCompiled.level || explicitGuardCompiled.issues.length) throw new Error("explicit guard compile failed: " + JSON.stringify(explicitGuardCompiled.issues));
  const explicitGuardReport = validateLevelConfig(explicitGuardCompiled.level, { authoringProfile: "generated" });
  if (!explicitGuardReport.ok) throw new Error("explicit guard validator errors: " + JSON.stringify(explicitGuardReport.errors));
  const explicitGuardDoor = explicitGuardCompiled.level.map.doors.find((door) => door.id === "door_d");
  if (explicitGuardDoor?.lock.type !== "survive_wave" || explicitGuardDoor.lock.waveId !== "wave_remote_guard_robot") {
    throw new Error("explicit guard door must bind to selected robot wave instead of Room A: " + JSON.stringify(explicitGuardDoor?.lock));
  }
  if (!explicitGuardCompiled.level.waves.some((wave) => wave.id === "wave_remote_guard_robot" && wave.trigger?.id === "room_hall")) {
    throw new Error("explicit guard robot must compile as its own room-triggered wave: " + JSON.stringify(explicitGuardCompiled.level.waves));
  }
  console.log("PASS explicit guard door: selected robot group opens the door even when it is not in Room A");

  const multiGuardProject = createStarterProject();
  multiGuardProject.projectId = "proj_multi_guard_headless";
  multiGuardProject.robots = [
    { id: "near_guard_robot", label: "近侧守门组", roomId: "room_hall", archetype: "repair_drone", count: 2, position: [0, 3] },
    { id: "far_guard_robot", label: "远侧守门组", roomId: "room_fight", archetype: "clamp_bot", count: 1, position: [0, 0] },
  ];
  multiGuardProject.doors = multiGuardProject.doors.map((door) =>
    door.id === "door_d" ? { ...door, lockType: "survive_wave", surviveRobotIds: ["near_guard_robot", "far_guard_robot"], surviveRobotId: undefined, waveId: undefined } : door,
  );
  const multiGuardCompiled = compileBuilderProjectToLevel(multiGuardProject);
  if (!multiGuardCompiled.level || multiGuardCompiled.issues.length) throw new Error("multi guard compile failed: " + JSON.stringify(multiGuardCompiled.issues));
  const multiGuardReport = validateLevelConfig(multiGuardCompiled.level, { authoringProfile: "generated" });
  if (!multiGuardReport.ok) throw new Error("multi guard validator errors: " + JSON.stringify(multiGuardReport.errors));
  const multiGuardDoor = multiGuardCompiled.level.map.doors.find((door) => door.id === "door_d");
  const expectedMultiGuardWaves = ["wave_near_guard_robot", "wave_far_guard_robot"];
  if (
    multiGuardDoor?.lock.type !== "survive_wave" ||
    multiGuardDoor.lock.waveId !== expectedMultiGuardWaves[0] ||
    JSON.stringify(multiGuardDoor.lock.waveIds) !== JSON.stringify(expectedMultiGuardWaves)
  ) {
    throw new Error("multi guard door must require all selected robot waves: " + JSON.stringify(multiGuardDoor?.lock));
  }
  console.log("PASS multi guard door: selected robot groups compile as all-required waveIds");

  const waveGateProject = createStarterProject();
  waveGateProject.projectId = "proj_wave_gate_headless";
  waveGateProject.robots = [
    {
      id: "wave_gate_robot_1",
      label: "第一波守门组",
      roomId: "room_fight",
      archetype: "repair_drone",
      count: 2,
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
  waveGateProject.doors = waveGateProject.doors.map((door) =>
    door.id === "door_d"
      ? { ...door, label: "双波清剿门", lockType: "survive_wave", waveIds: ["builder_wave_gate_1", "builder_wave_gate_2"], waveId: undefined }
      : door,
  );
  const waveGateCompiled = compileBuilderProjectToLevel(waveGateProject);
  if (!waveGateCompiled.level || waveGateCompiled.issues.length) throw new Error("wave gate compile failed: " + JSON.stringify(waveGateCompiled.issues));
  const waveGateDoor = waveGateCompiled.level.map.doors.find((door) => door.id === "door_d");
  if (
    waveGateDoor?.label !== "双波清剿门" ||
    waveGateDoor.lock.type !== "survive_wave" ||
    waveGateDoor.lock.waveId !== "builder_wave_gate_1" ||
    JSON.stringify(waveGateDoor.lock.waveIds) !== JSON.stringify(["builder_wave_gate_1", "builder_wave_gate_2"])
  ) {
    throw new Error("wave-gate door must preserve door label and all selected waveIds: " + JSON.stringify(waveGateDoor));
  }
  const waveGateEvent = waveGateCompiled.level.events?.find((event) => event.trigger.type === "wave_completed" && event.trigger.id === "builder_wave_gate_1");
  if (!waveGateEvent?.actions.some((action) => action.type === "start_wave" && action.waveId === "builder_wave_gate_2")) {
    throw new Error("wave-gate chain must start wave 2 only after wave 1 clears: " + JSON.stringify(waveGateEvent));
  }
  console.log("PASS wave gate door: authored waveIds and door label compile as the door lock condition");

  const legacyWaveOverrideProject = createStarterProject();
  legacyWaveOverrideProject.projectId = "proj_legacy_wave_override_headless";
  legacyWaveOverrideProject.robots = [
    {
      id: "legacy_import_robot",
      label: "旧导入波次",
      roomId: "room_hall",
      archetype: "repair_drone",
      count: 1,
      wave: { id: "legacy_import_wave", triggerType: "room_entered", triggerId: "room_hall" },
    },
    {
      id: "chosen_guard_robot",
      label: "新选守门组",
      roomId: "room_fight",
      archetype: "clamp_bot",
      count: 1,
    },
  ];
  legacyWaveOverrideProject.doors = legacyWaveOverrideProject.doors.map((door) =>
    door.id === "door_d"
      ? { ...door, lockType: "survive_wave", surviveRobotIds: ["chosen_guard_robot"], surviveRobotId: "chosen_guard_robot", waveId: "legacy_import_wave" }
      : door,
  );
  const legacyWaveOverrideCompiled = compileBuilderProjectToLevel(legacyWaveOverrideProject);
  if (!legacyWaveOverrideCompiled.level || legacyWaveOverrideCompiled.issues.length) {
    throw new Error("legacy wave override compile failed: " + JSON.stringify(legacyWaveOverrideCompiled.issues));
  }
  const legacyWaveOverrideDoor = legacyWaveOverrideCompiled.level.map.doors.find((door) => door.id === "door_d");
  if (
    legacyWaveOverrideDoor?.lock.type !== "survive_wave" ||
    legacyWaveOverrideDoor.lock.waveId !== "wave_chosen_guard_robot" ||
    legacyWaveOverrideDoor.lock.waveIds?.includes("legacy_import_wave")
  ) {
    throw new Error("explicit guard robots must override hidden imported waveId locks: " + JSON.stringify(legacyWaveOverrideDoor?.lock));
  }
  console.log("PASS explicit guard override: hidden imported waveId is ignored once robots are selected");

  // 2. playtest inventory contract
  const inv = level.initialInventory;
  if (!inv?.hasRod || !inv?.hasPistol || inv?.equipWeapon !== "railLance" || inv?.coreCells !== 0) {
    throw new Error("inventory contract broken: " + JSON.stringify(inv));
  }
  console.log("PASS playtest inventory: rod+pistol, equipWeapon=railLance, coreCells=0");

  // 2b. scene-aware UI readability math (absorbed WGPU-lab Image2 GUI contract):
  // solved panel alpha keeps body text >= 4.5:1 on dark AND bright scenes, shadow
  // floor stays >= 0.66, and panel alpha is monotonic in scene brightness.
  {
    const { srgbToLinear, clampUiShadow, readableTextToneForScene, sceneAwareUiTokens, guiMath } =
      await server.ssrLoadModule("/src/ui/guiMath.ts");
    if (Math.abs(srgbToLinear(0)) > 1e-6 || Math.abs(srgbToLinear(1) - 1) > 1e-6) {
      throw new Error("srgbToLinear endpoints wrong");
    }
    if (clampUiShadow(0) < guiMath.minUiShadowClamp || clampUiShadow(0.9) !== 0.9) {
      throw new Error("clampUiShadow floor/passthrough broken");
    }
    for (const sceneY of [0.02, 0.2, 0.45, 0.7]) {
      const tokens = sceneAwareUiTokens(sceneY);
      if (tokens.bodyContrast < guiMath.minBodyContrast - 0.05) {
        throw new Error(`sceneAwareUiTokens body contrast ${tokens.bodyContrast} < ${guiMath.minBodyContrast} at sceneY=${sceneY}`);
      }
      if (tokens.shadowFloor < guiMath.minUiShadowClamp) throw new Error("scene tokens shadow floor below clamp");
      if (tokens.panelBgAlpha < 0.5 || tokens.panelBgAlpha > 0.97) throw new Error("panel alpha out of range");
    }
    if (sceneAwareUiTokens(0.7).panelBgAlpha + 1e-6 < sceneAwareUiTokens(0.05).panelBgAlpha) {
      throw new Error("panel alpha must be monotonic in scene tone");
    }
    if (readableTextToneForScene(0.02) !== "light" || readableTextToneForScene(0.95) !== "dark") {
      throw new Error("readableTextToneForScene picked the wrong tone");
    }
    console.log("PASS gui readability math: solved alpha keeps body>=4.5:1, shadow>=0.66, monotonic, tone-correct");
  }

  // 3. placement rules: outside-room rejected, inside-room accepted + snapped
  const outside = placementAt(project, 200, 200);
  if (outside.valid || outside.room) throw new Error("placement outside rooms must be invalid");
  const spawn = project.rooms[0];
  const inside = placementAt(project, spawn.center[0] + 0.26, spawn.center[1] - 0.26);
  if (!inside.valid || inside.room?.id !== spawn.id) throw new Error("placement inside spawn room must be valid");
  if ((inside.x * 2) % 1 !== 0 || (inside.z * 2) % 1 !== 0) throw new Error("placement must snap to 0.5m: " + inside.x + "," + inside.z);
  const fine = placementAt(project, spawn.center[0] + 0.26, spawn.center[1], 0.05);
  if (Math.abs(fine.x - (spawn.center[0] + 0.25)) > 1e-9) throw new Error("snap-off step 0.05 broken: " + fine.x);
  console.log("PASS placement rules: outside rejected, inside snapped (0.5m + fine step)");

  // 4. floor pick resolves the starter prop under its own position
  const prop = project.props[0];
  const pick = pickAt(
    project,
    prop.position[0],
    prop.position[1],
    (modelKey) => {
      const entry = builderPropCatalog.find((candidate) => candidate.modelKey === modelKey);
      return entry ? [entry.sizeMeters[0], entry.sizeMeters[2]] : null;
    },
    [],
  );
  if (!pick || pick.kind !== "prop" || pick.id !== prop.id) throw new Error("pickAt missed starter prop: " + JSON.stringify(pick));
  console.log("PASS 3D floor pick resolves furniture");

  const routePickProject = {
    ...project,
    props: [],
    pickups: [],
    puzzles: [],
    routeSwitches: [
      {
        id: "route_pick_contract",
        label: "管制路由台",
        roomId: project.rooms[1].id,
        keyRoomId: project.rooms[0].id,
        keyPosition: [project.rooms[0].center[0] + 1, project.rooms[0].center[1]],
        position: project.rooms[1].center,
        rotationY: 0,
        outputs: [{ id: "route_pick_output", kind: "open_door", doorId: "door_a" }],
      },
    ],
  };
  const routeOutputSpot = routeOutputKeyPosition(routePickProject, routePickProject.routeSwitches[0], routePickProject.routeSwitches[0].outputs[0], 0);
  const routeOutputPick = pickAt(routePickProject, routeOutputSpot[0], routeOutputSpot[1], () => null, []);
  if (!routeOutputPick || routeOutputPick.kind !== "routeOutputKey" || routeOutputPick.id !== "route_pick_contract" || routeOutputPick.outputId !== "route_pick_output") {
    throw new Error("pickAt missed route-switch 3D output key token: " + JSON.stringify(routeOutputPick));
  }
  const legacyRouteKeyProject = {
    ...routePickProject,
    routeSwitches: [{ ...routePickProject.routeSwitches[0], outputs: [] }],
  };
  const routeKeySpot = routeKeyPosition(legacyRouteKeyProject, legacyRouteKeyProject.routeSwitches[0]);
  const routeKeyPick = pickAt(legacyRouteKeyProject, routeKeySpot[0], routeKeySpot[1], () => null, []);
  if (!routeKeyPick || routeKeyPick.kind !== "routeKey" || routeKeyPick.id !== "route_pick_contract") {
    throw new Error("pickAt missed legacy route-switch 3D key token: " + JSON.stringify(routeKeyPick));
  }
  console.log("PASS 3D floor pick resolves route-switch output and legacy key tokens");

  // 5. every catalog asset has a curated footprint family (thumbnail coverage)
  const missing = builderPropCatalog.filter((entry) => footprintFamily(entry.modelKey) === "generic");
  if (missing.length) throw new Error("catalog entries without footprint: " + missing.map((entry) => entry.modelKey).join(","));
  const missingRegistry = builderPropCatalog.filter((entry) => !environmentModelAssets[entry.modelKey] && !isStoryPaintingArtModelKey(entry.modelKey));
  if (missingRegistry.length) throw new Error("catalog entries missing environment registry keys: " + missingRegistry.map((entry) => entry.modelKey).join(","));
  const requiredRobotArchetypes = ["repair_drone", "clamp_bot", "shield_tech", "custodian_elite"];
  const missingRobotArchetypes = requiredRobotArchetypes.filter((archetype) => !builderRobotCatalog.some((entry) => entry.archetype === archetype));
  if (missingRobotArchetypes.length) throw new Error("robot catalog missing required archetypes: " + missingRobotArchetypes.join(","));
  console.log(`PASS thumbnail coverage: ${builderPropCatalog.length}/${builderPropCatalog.length} furniture mapped (${knownFootprintModelKeys.length} keys), ${builderRobotCatalog.length} robots`);

  // 5x. rendered image thumbnails: every catalog asset must ship a studio render
  // (webp); SVG footprints are fallback-only. Regenerate with
  // scripts/asset-build/generate-builder-asset-thumbnails.mjs after adding assets.
  const { assetThumbnailUrl, assetThumbnailCount } = await server.ssrLoadModule("/src/build/BuilderAssetThumbnails.ts");
  const missingRenders = builderPropCatalog.filter((entry) => !assetThumbnailUrl(entry.modelKey));
  if (missingRenders.length) {
    throw new Error(
      "catalog entries without rendered thumbnails (run generate-builder-asset-thumbnails.mjs): " +
        missingRenders.map((entry) => entry.modelKey).join(","),
    );
  }
  const missingPickupRenders = builderPickupCatalog.filter((entry) => !assetThumbnailUrl(entry.modelKey));
  if (missingPickupRenders.length) {
    throw new Error(
      "pickup catalog entries without rendered thumbnails (run generate-builder-asset-thumbnails.mjs --only pickup_): " +
        missingPickupRenders.map((entry) => entry.modelKey).join(","),
    );
  }
  console.log(
    `PASS rendered thumbnails: ${assetThumbnailCount()} webp studio renders cover all ${builderPropCatalog.length} catalog assets + ${builderPickupCatalog.length} pickups`,
  );

  // 5x2. /build Image2 UI shell: atlas + cropped slices used by the
  // commercial-grade cover card, story preview, playtest CTA and asset cards.
  const uiAtlasManifestPath = path.join(process.cwd(), "src/assets/gui/builder/builder-ui-image2-atlas-v1.manifest.json");
  const uiAtlasManifest = JSON.parse(readFileSync(uiAtlasManifestPath, "utf8"));
  const pngSize = (filePath) => {
    const buffer = readFileSync(filePath);
    if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("not a PNG: " + filePath);
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  };
  const atlasPath = path.join(process.cwd(), "src/assets/gui/builder", uiAtlasManifest.atlas);
  const atlasSize = pngSize(atlasPath);
  const [manifestAtlasWidth, manifestAtlasHeight] = uiAtlasManifest.atlasSize ?? [];
  if (!Number.isFinite(manifestAtlasWidth) || !Number.isFinite(manifestAtlasHeight)) {
    throw new Error("builder UI atlas manifest missing atlasSize");
  }
  if (atlasSize.width !== manifestAtlasWidth || atlasSize.height !== manifestAtlasHeight) {
    throw new Error("builder UI atlas size does not match manifest: " + JSON.stringify({ atlasSize, manifestAtlasWidth, manifestAtlasHeight }));
  }
  const requiredUiSlices = [
    "project_cover_frame",
    "story_preview_panel",
    "playtest_cta_plate",
    "publish_badge_ready",
    "publish_badge_warn",
    "inspector_tab_lamp_story",
    "inspector_tab_lamp_light",
    "asset_card_glass",
  ];
  const uiSliceCssVars = {
    project_cover_frame: "--builder-ui-project-cover-frame",
    story_preview_panel: "--builder-ui-story-preview-panel",
    playtest_cta_plate: "--builder-ui-playtest-cta-plate",
    publish_badge_ready: "--builder-ui-publish-badge-ready",
    publish_badge_warn: "--builder-ui-publish-badge-warn",
    inspector_tab_lamp_story: "--builder-ui-tab-lamp-story",
    inspector_tab_lamp_light: "--builder-ui-tab-lamp-light",
    asset_card_glass: "--builder-ui-asset-card-glass",
  };
  const uiSliceSource = readFileSync(path.join(process.cwd(), "src/build/BuilderUiImage2Slices.ts"), "utf8");
  const uiCssSource = readFileSync(path.join(process.cwd(), "src/styles/builder.css"), "utf8");
  const buildPageSource = readFileSync(path.join(process.cwd(), "src/build/BuildPage.tsx"), "utf8");
  const inspectorSource = readFileSync(path.join(process.cwd(), "src/build/BuilderInspectorPanel.tsx"), "utf8");
  const projectInspectorSource = readFileSync(path.join(process.cwd(), "src/build/BuilderProjectInspector.tsx"), "utf8");
  for (const sliceName of requiredUiSlices) {
    const slice = uiAtlasManifest.slices?.[sliceName];
    if (!slice) throw new Error("builder UI slice missing from manifest: " + sliceName);
    const slicePath = path.join(process.cwd(), "src/assets/gui/builder", slice.file);
    if (!existsSync(slicePath)) throw new Error("builder UI slice file missing: " + slicePath);
    const size = pngSize(slicePath);
    if (size.width !== slice.w || size.height !== slice.h) throw new Error(`builder UI slice size mismatch ${sliceName}: ` + JSON.stringify({ size, slice }));
    if (!uiSliceSource.includes(`${sliceName}:`) || !uiSliceSource.includes(`file: "${slice.file}"`)) {
      throw new Error("builder UI TS atlas entry missing or stale for " + sliceName);
    }
    if (!uiSliceSource.includes(`import `) || !uiSliceSource.includes(`../assets/gui/builder/${slice.file}`)) {
      throw new Error("builder UI TS must import the sliced PNG for " + sliceName);
    }
    if (!uiSliceSource.includes(`"${uiSliceCssVars[sliceName]}"`)) {
      throw new Error("builder UI TS CSS var missing for " + sliceName);
    }
    if (!uiCssSource.includes(`var(${uiSliceCssVars[sliceName]})`)) {
      throw new Error("builder CSS must consume the Image2 CSS var for " + sliceName);
    }
  }
  for (const brittleSelector of ["button:first-child.active::before", "button:nth-child(2).active::before"]) {
    if (uiCssSource.includes(`.builder-insp-modetabs ${brittleSelector}`)) {
      throw new Error("builder Image2 tab skin must use data-project-mode selectors, not child-order selectors");
    }
  }
  if (!inspectorSource.includes('from "./BuilderProjectInspector"')) {
    throw new Error("BuilderInspectorPanel must delegate project-level UI to BuilderProjectInspector");
  }
  if (!projectInspectorSource.includes('data-project-mode="story"') || !projectInspectorSource.includes('data-project-mode="light"')) {
    throw new Error("project inspector tabs must expose semantic data-project-mode attributes");
  }
  if (!buildPageSource.includes("builderUiImage2CssVars") || !buildPageSource.includes("style={builderUiImage2CssVars as CSSProperties}")) {
    throw new Error("BuildPage must mount generated Image2 CSS vars on the builder page root");
  }
  if (!projectInspectorSource.includes("projectCoverState(") || !projectInspectorSource.includes("builder-cover-checks")) {
    throw new Error("project cover card must use compact derived checks, not a hardcoded badge wall");
  }
  if (inspectorSource.includes("builder-cover-badges") || uiCssSource.includes("builder-cover-badges")) {
    throw new Error("project cover badge wall class should not return");
  }
  const cssBlock = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = uiCssSource.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m"));
    if (!match) throw new Error("builder CSS missing selector: " + selector);
    return match[1];
  };
  const expectCss = (selector, prop, needle) => {
    const block = cssBlock(selector);
    if (!block.includes(prop) || !block.includes(needle)) {
      throw new Error(`builder CSS text-fit guard missing ${prop}:${needle} in ${selector}`);
    }
  };
  expectCss(".builder-asset-card-main", "min-width", "0");
  expectCss(".builder-asset-card-label", "text-overflow", "ellipsis");
  expectCss(".builder-asset-card-meta", "justify-content", "space-between");
  expectCss(".builder-asset-card-meta small", "text-overflow", "ellipsis");
  expectCss(".builder-asset-card-chip", "max-width", "min(64px, 54%)");
  expectCss(".builder-asset-card-chip", "text-overflow", "ellipsis");
  console.log(`PASS builder UI Image2: ${atlasSize.width} atlas + ${requiredUiSlices.length} imported PNG slices wired via CSS vars`);

  // 5a. retired auto-rig furniture: the old candidate/pilot packs are gone.
  // QA now protects the removal so invalid GLBs cannot slip back into /build.
  const retiredAutoRigEntries = builderPropCatalog.filter((entry) => entry.source === "auto-rig-3d" || entry.modelKey.includes("autorig"));
  if (retiredAutoRigEntries.length) {
    throw new Error("retired auto-rig furniture still exposed in builderPropCatalog: " + retiredAutoRigEntries.map((entry) => entry.modelKey).join(","));
  }
  const retiredAutoRigRegistryKeys = Object.keys(environmentModelAssets).filter((key) => key.includes("autorig"));
  if (retiredAutoRigRegistryKeys.length) {
    throw new Error("retired auto-rig furniture still exposed in environmentModelAssets: " + retiredAutoRigRegistryKeys.join(","));
  }
  for (const retiredManifest of [
    "src/assets/manifests/builder/auto_rig_furniture_pilot_v1.json",
    "src/assets/manifests/builder/auto_rig_internal_batch01_v1.json",
  ]) {
    if (existsSync(path.join(bridge.repoRoot, retiredManifest))) throw new Error(`retired auto-rig manifest still present: ${retiredManifest}`);
  }
  const currentFixtureKey = "hp_l4_cineclinic_triage_kiosk";
  const currentImage2Project = {
    ...project,
    props: [
      ...project.props,
      {
        id: "qa_current_image2_triage_kiosk",
        modelKey: currentFixtureKey,
        roomId: spawn.id,
        position: [spawn.center[0], spawn.center[1]],
        rotationY: 0,
        scale: 1,
      },
    ],
  };
  const currentImage2Compiled = compileBuilderProjectToLevel(currentImage2Project);
  if (!currentImage2Compiled.level || currentImage2Compiled.issues.length) {
    throw new Error("current Image2 furniture project compile failed: " + JSON.stringify(currentImage2Compiled.issues));
  }
  const currentImage2Report = validateLevelConfig(currentImage2Compiled.level, { authoringProfile: "generated" });
  if (!currentImage2Report.ok) throw new Error("current Image2 furniture project validator errors: " + JSON.stringify(currentImage2Report.errors));
  if (!JSON.stringify(currentImage2Compiled.level.map.props).includes(currentFixtureKey)) {
    throw new Error(`compiled map props lost current Image2 fixture modelKey ${currentFixtureKey}`);
  }
  console.log("PASS retired auto-rig furniture: removed from registry/catalog/manifests; current Image2 fixture compiles+validates");

  // 5a2. asset-pack import bridge: the current Image2 Level 4 furniture manifest
  // is the contract that must line up with registry/catalog/footprints/GLBs.
  const currentManifestPath = path.join(bridge.repoRoot, "src/assets/manifests/builder/hp_level04_memory_clinic_furniture_v1.json");
  const { manifest: currentManifest, manifestDir: currentManifestDir } = bridge.loadManifest(currentManifestPath);
  const currentStructural = bridge.validateManifestStructure(currentManifest, currentManifestDir);
  if (currentStructural.length) throw new Error("current Image2 manifest structural errors: " + currentStructural.join(" | "));
  if (!currentManifest.assets.length) throw new Error("current Image2 manifest must describe at least one asset");
  if (!currentManifest.assets.some((entry) => entry.modelKey === currentFixtureKey)) {
    throw new Error(`current Image2 manifest lost the compile/validate fixture asset ${currentFixtureKey}`);
  }
  for (const entry of currentManifest.assets) {
    const registryAsset = environmentModelAssets[entry.modelKey];
    if (!registryAsset) throw new Error(`manifest modelKey missing from environmentModelAssets: ${entry.modelKey}`);
    if (registryAsset.sizeMeters.some((value, axis) => Math.abs(value - entry.sizeMeters[axis]) > bridge.sizeTolerance)) {
      throw new Error(`registry sizeMeters drifted from manifest: ${entry.modelKey}`);
    }
    if (!existsSync(path.resolve(currentManifestDir, entry.glbFile))) throw new Error(`manifest GLB missing on disk: ${entry.glbFile}`);
    if (entry.assetKind !== "furniture") continue;
    const catalogEntry = builderPropCatalog.find((candidate) => candidate.modelKey === entry.modelKey);
    if (!catalogEntry) throw new Error(`manifest furniture missing from builderPropCatalog: ${entry.modelKey}`);
    if (catalogEntry.sizeMeters.some((value, axis) => Math.abs(value - entry.sizeMeters[axis]) > bridge.sizeTolerance)) {
      throw new Error(`catalog sizeMeters drifted from manifest: ${entry.modelKey}`);
    }
    const resolvedFamily = footprintFamily(entry.modelKey);
    if (resolvedFamily === "generic" || resolvedFamily !== entry.footprintFamily) {
      throw new Error(`footprint mismatch for ${entry.modelKey}: manifest=${entry.footprintFamily} resolved=${resolvedFamily}`);
    }
  }
  console.log(`PASS asset-pack manifest: current Image2 contract matches registry/catalog/footprints/GLBs (${currentManifest.assets.length} assets)`);

  // 5a3. import bridge emit smoke: fragments emitted from the current manifest
  // must load through vite (valid TypeScript with resolvable GLB urls).
  const emitDir = path.join(bridge.repoRoot, ".tmp/qa-pack-emit");
  mkdirSync(emitDir, { recursive: true });
  bridge.writeFragments(
    bridge.emitFragments([{ manifest: currentManifest, manifestDir: currentManifestDir }], {
      registry: path.join(emitDir, "generatedBuilderAssetPacks.ts"),
      catalog: path.join(emitDir, "generatedBuilderAssetCatalog.ts"),
      footprints: path.join(emitDir, "generatedBuilderAssetFootprints.ts"),
    }),
  );
  const currentGlbAssetCount = currentManifest.assets.filter((entry) => Boolean(entry.glbFile)).length;
  const currentFurnitureAssetCount = currentManifest.assets.filter((entry) => entry.assetKind === "furniture").length;
  const emittedRegistry = (await server.ssrLoadModule("/.tmp/qa-pack-emit/generatedBuilderAssetPacks.ts")).generatedBuilderPackEnvironmentModelAssets;
  if (Object.keys(emittedRegistry).length !== currentGlbAssetCount) throw new Error(`emitted registry should expose ${currentGlbAssetCount} models`);
  if (!emittedRegistry[currentFixtureKey]) throw new Error(`emitted registry lost fixture ${currentFixtureKey}`);
  if (!Object.values(emittedRegistry).every((asset) => typeof asset.url === "string" && asset.url.includes(".glb"))) {
    throw new Error("emitted registry urls broken");
  }
  const emittedCatalog = (await server.ssrLoadModule("/.tmp/qa-pack-emit/generatedBuilderAssetCatalog.ts")).generatedBuilderPackPropEntries;
  if (emittedCatalog.length !== currentFurnitureAssetCount || !emittedCatalog.some((entry) => entry.modelKey === currentFixtureKey)) {
    throw new Error("emitted catalog entries broken");
  }
  const emittedFootprints = (await server.ssrLoadModule("/.tmp/qa-pack-emit/generatedBuilderAssetFootprints.ts")).generatedBuilderPackFootprints;
  if (Object.keys(emittedFootprints).length !== currentFurnitureAssetCount || Object.values(emittedFootprints).some((family) => family === "generic")) {
    throw new Error("emitted footprints broken");
  }
  console.log(`PASS import bridge emit: current Image2 fragments compile through vite (${currentFurnitureAssetCount} furniture assets)`);

  // 5a4. wired generated fragments stay consistent: keys in the generated registry
  // must also reach the merged environmentModelAssets (empty today is fine).
  const { generatedBuilderPackEnvironmentModelAssets } = await server.ssrLoadModule("/src/assets/registry/environment/generatedBuilderAssetPacks.ts");
  const { generatedBuilderPackPropEntries } = await server.ssrLoadModule("/src/build/generatedBuilderAssetCatalog.ts");
  for (const key of Object.keys(generatedBuilderPackEnvironmentModelAssets)) {
    if (!environmentModelAssets[key]) throw new Error(`generated pack key not merged into environmentModelAssets: ${key}`);
  }
  for (const entry of generatedBuilderPackPropEntries) {
    if (!builderPropCatalog.some((candidate) => candidate.modelKey === entry.modelKey)) {
      throw new Error(`generated catalog entry not merged into builderPropCatalog: ${entry.modelKey}`);
    }
    if (footprintFamily(entry.modelKey) === "generic") throw new Error(`generated entry has generic footprint: ${entry.modelKey}`);
  }
  console.log(`PASS generated fragments wired: ${Object.keys(generatedBuilderPackEnvironmentModelAssets).length} generated pack models merged`);

  // 5a5. hp-cyberpunk batch-01: the manifest remains traceable even after the
  // manual asset-cull pass. Discarded assets should keep their source GLBs but
  // are intentionally absent from the /build placement catalog and runtime
  // registry; kept assets must still resolve end-to-end.
  const cyberManifestPath = path.join(bridge.repoRoot, "src/assets/manifests/builder/hp_cyberpunk_batch01_v1.json");
  const { manifest: cyberManifest, manifestDir: cyberDir } = bridge.loadManifest(cyberManifestPath);
  const cyberStructural = bridge.validateManifestStructure(cyberManifest, cyberDir);
  if (cyberStructural.length) throw new Error("cyberpunk manifest structural errors: " + cyberStructural.join(" | "));
  if (cyberManifest.assets.length !== 29) throw new Error(`cyberpunk batch01 must describe 29 assets, got ${cyberManifest.assets.length}`);
  const keptCyberAssets = [];
  let discardedCyberAssets = 0;
  for (const entry of cyberManifest.assets) {
    if (entry.group !== "赛博") throw new Error(`cyberpunk asset ${entry.modelKey} must use 赛博 group, got ${entry.group}`);
    if (!existsSync(path.resolve(cyberDir, entry.glbFile))) throw new Error(`cyberpunk GLB missing on disk: ${entry.glbFile}`);
    if (isBuilderDiscarded(entry.modelKey)) {
      discardedCyberAssets += 1;
      continue;
    }
    keptCyberAssets.push(entry);
    if (!environmentModelAssets[entry.modelKey]) throw new Error(`cyberpunk modelKey missing from environmentModelAssets: ${entry.modelKey}`);
    if (!builderPropCatalog.some((candidate) => candidate.modelKey === entry.modelKey)) {
      throw new Error(`cyberpunk furniture missing from builderPropCatalog: ${entry.modelKey}`);
    }
    if (footprintFamily(entry.modelKey) === "generic") throw new Error(`cyberpunk entry has generic footprint: ${entry.modelKey}`);
  }
  if (keptCyberAssets.length) {
    const sampleCyberAsset = keptCyberAssets[0];
    const cyberProject = {
      ...project,
      props: [
        ...project.props,
        {
          id: "qa_cyber_sample_asset",
          modelKey: sampleCyberAsset.modelKey,
          roomId: spawn.id,
          position: [spawn.center[0] - 0.5, spawn.center[1]],
          rotationY: 0,
          scale: 1,
        },
      ],
    };
    const cyberCompiled = compileBuilderProjectToLevel(cyberProject);
    if (!cyberCompiled.level || cyberCompiled.issues.length) throw new Error("cyberpunk project compile failed: " + JSON.stringify(cyberCompiled.issues));
    const cyberReport = validateLevelConfig(cyberCompiled.level, { authoringProfile: "generated" });
    if (!cyberReport.ok) throw new Error("cyberpunk project validator errors: " + JSON.stringify(cyberReport.errors));
  }
  console.log(
    `PASS hp-cyberpunk batch-01: 29 assets in 赛博 group, kept=${keptCyberAssets.length}, discarded=${discardedCyberAssets}, GLBs traceable`,
  );

  // 5a5c. official remaster batch-01: 40 hand-directed assets under 官卡重制,
  // resolvable end-to-end and compilable like any other furniture.
  const remasterManifestPath = path.join(bridge.repoRoot, "src/assets/manifests/builder/hp_official_remaster_batch01_v1.json");
  const { manifest: remasterManifest, manifestDir: remasterDir } = bridge.loadManifest(remasterManifestPath);
  const remasterStructural = bridge.validateManifestStructure(remasterManifest, remasterDir);
  if (remasterStructural.length) throw new Error("remaster manifest structural errors: " + remasterStructural.join(" | "));
  if (remasterManifest.assets.length !== 40) throw new Error(`remaster batch01 must describe 40 assets, got ${remasterManifest.assets.length}`);
  for (const entry of remasterManifest.assets) {
    if (entry.group !== "官卡重制") throw new Error(`remaster asset ${entry.modelKey} must use 官卡重制 group, got ${entry.group}`);
    if (!environmentModelAssets[entry.modelKey]) throw new Error(`remaster modelKey missing from environmentModelAssets: ${entry.modelKey}`);
    if (!existsSync(path.resolve(remasterDir, entry.glbFile))) throw new Error(`remaster GLB missing on disk: ${entry.glbFile}`);
    if (!builderPropCatalog.some((candidate) => candidate.modelKey === entry.modelKey)) {
      throw new Error(`remaster furniture missing from builderPropCatalog: ${entry.modelKey}`);
    }
    if (footprintFamily(entry.modelKey) === "generic") throw new Error(`remaster entry has generic footprint: ${entry.modelKey}`);
  }
  const remasterProject = {
    ...project,
    props: [
      ...project.props,
      {
        id: "qa_remaster_broken_cradle",
        modelKey: "room_rm_maint_broken_cradle",
        roomId: spawn.id,
        position: [spawn.center[0] + 0.5, spawn.center[1]],
        rotationY: 0,
        scale: 1,
      },
    ],
  };
  const remasterCompiled = compileBuilderProjectToLevel(remasterProject);
  if (!remasterCompiled.level || remasterCompiled.issues.length) throw new Error("remaster project compile failed: " + JSON.stringify(remasterCompiled.issues));
  const remasterReport = validateLevelConfig(remasterCompiled.level, { authoringProfile: "generated" });
  if (!remasterReport.ok) throw new Error("remaster project validator errors: " + JSON.stringify(remasterReport.errors));
  console.log("PASS official remaster batch-01: 40 assets in 官卡重制 group, registry/catalog/footprints/GLBs, compile+validate");

  // 5a5d. desire pack 01: 15 curated archive-noir assets under 密室精选,
  // resolvable end-to-end, with rendered thumbnails, and compilable.
  const desireManifestPath = path.join(bridge.repoRoot, "src/assets/manifests/builder/hp_builder_desire_pack_v1.json");
  const { manifest: desireManifest, manifestDir: desireDir } = bridge.loadManifest(desireManifestPath);
  const desireStructural = bridge.validateManifestStructure(desireManifest, desireDir);
  if (desireStructural.length) throw new Error("desire pack manifest structural errors: " + desireStructural.join(" | "));
  if (desireManifest.assets.length !== 15) throw new Error(`desire pack must describe 15 assets, got ${desireManifest.assets.length}`);
  for (const entry of desireManifest.assets) {
    if (entry.group !== "密室精选") throw new Error(`desire asset ${entry.modelKey} must use 密室精选 group, got ${entry.group}`);
    if (!environmentModelAssets[entry.modelKey]) throw new Error(`desire modelKey missing from environmentModelAssets: ${entry.modelKey}`);
    if (!existsSync(path.resolve(desireDir, entry.glbFile))) throw new Error(`desire GLB missing on disk: ${entry.glbFile}`);
    if (!builderPropCatalog.some((candidate) => candidate.modelKey === entry.modelKey)) {
      throw new Error(`desire furniture missing from builderPropCatalog: ${entry.modelKey}`);
    }
    if (footprintFamily(entry.modelKey) === "generic") throw new Error(`desire entry has generic footprint: ${entry.modelKey}`);
    if (!assetThumbnailUrl(entry.modelKey)) throw new Error(`desire entry missing rendered thumbnail: ${entry.modelKey}`);
  }
  const desireProject = {
    ...project,
    props: [
      ...project.props,
      {
        id: "qa_desire_archive_desk",
        modelKey: "room_desire_archive_desk",
        roomId: spawn.id,
        position: [spawn.center[0] - 1, spawn.center[1] + 1],
        rotationY: 0,
        scale: 1,
      },
      {
        id: "qa_desire_brass_safe",
        modelKey: "room_desire_brass_safe",
        roomId: spawn.id,
        position: [spawn.center[0] + 1.5, spawn.center[1] + 1],
        rotationY: 0,
        scale: 1,
      },
    ],
  };
  const desireCompiled = compileBuilderProjectToLevel(desireProject);
  if (!desireCompiled.level || desireCompiled.issues.length) throw new Error("desire project compile failed: " + JSON.stringify(desireCompiled.issues));
  const desireReport = validateLevelConfig(desireCompiled.level, { authoringProfile: "generated" });
  if (!desireReport.ok) throw new Error("desire project validator errors: " + JSON.stringify(desireReport.errors));
  if (!JSON.stringify(desireCompiled.level.map.props).includes("room_desire_archive_desk")) {
    throw new Error("compiled map props lost desire furniture modelKey");
  }
  console.log("PASS desire pack 01: 15 assets in 密室精选 group, registry/catalog/footprints/GLBs/thumbnails, compile+validate");

  // 5p. puzzle authoring: instances, migration, validation, picking priority.
  const puzzleCatalog = await server.ssrLoadModule("/src/build/BuilderPuzzleCatalog.ts");
  const {
    normalizeBuilderPuzzles,
    createPuzzleInstanceForDoor,
    validateBuilderPuzzles,
    hasPlayablePuzzleChain,
    puzzleForDoor,
  } = puzzleCatalog;

  // 5p1. legacy door-bound puzzle (no instances) migrates and compiles for every kind
  // (premium families + migration-safe legacy surveillance/valve kinds).
  for (const kind of ["color_sequence", "circuit_grid", "archive_merge", "gallery_reading", "surveillance_match", "valve_matrix"]) {
    const legacy = createStarterProject();
    legacy.doors = legacy.doors.map((door) =>
      door.id === "door_c"
        ? { ...door, lockType: "puzzle_complete", ...(kind === "color_sequence" ? {} : { puzzleKind: kind, puzzleRoomId: "room_hall" }) }
        : door,
    );
    if (kind === "color_sequence") legacy.puzzle = { roomId: "room_hall", clueRoomId: "room_spawn", sequence: ["red", "blue", "green"] };
    const migrated = normalizeBuilderPuzzles(legacy);
    const instance = puzzleForDoor(migrated, "door_c");
    if (!instance || instance.kind !== kind) throw new Error(`legacy ${kind} did not migrate to an instance`);
    if (kind === "color_sequence" && (instance.components ?? []).length !== 3) throw new Error("legacy color migration must synthesize 3 orbs");
    const { level: legacyLevel, issues: legacyIssues } = compileBuilderProjectToLevel(legacy);
    if (!legacyLevel || legacyIssues.length) throw new Error(`legacy ${kind} compile failed: ` + JSON.stringify(legacyIssues));
    const legacyReport = validateLevelConfig(legacyLevel, { authoringProfile: "generated" });
    if (!legacyReport.ok) throw new Error(`legacy ${kind} validator errors: ` + JSON.stringify(legacyReport.errors));
  }
  console.log("PASS puzzle migration: legacy door-bound puzzles synthesize instances and compile+validate (all 6 kinds)");

  // 5p2. bind-flow data path: card click → door lock + instance → playable chain at the author position.
  const bindProject = createStarterProject();
  const bindDoor = bindProject.doors.find((door) => door.id === "door_b");
  const bindInstance = createPuzzleInstanceForDoor(bindProject, bindDoor, "valve_matrix");
  bindInstance.position = [2.5, 1.5];
  bindInstance.roomId = "room_hall";
  bindProject.doors = bindProject.doors.map((door) =>
    door.id === "door_b" ? { ...door, lockType: "puzzle_complete", puzzleKind: "valve_matrix" } : door,
  );
  bindProject.puzzles = [bindInstance];
  if (!hasPlayablePuzzleChain(bindProject)) throw new Error("bound valve puzzle must count as a playable chain");
  const bindCompiled = compileBuilderProjectToLevel(bindProject);
  if (!bindCompiled.level || bindCompiled.issues.length) throw new Error("bound puzzle compile failed: " + JSON.stringify(bindCompiled.issues));
  const bindPanel = bindCompiled.level.map.interactions.find((entry) => entry.id === "pz_door_b_panel");
  if (!bindPanel || bindPanel.roomId !== "room_hall" || bindPanel.position[0] !== 2.5 || bindPanel.position[2] !== 1.5) {
    throw new Error("puzzle terminal must compile at the author-chosen position: " + JSON.stringify(bindPanel));
  }
  const bindReport = validateLevelConfig(bindCompiled.level, { authoringProfile: "generated" });
  if (!bindReport.ok) throw new Error("bound puzzle validator errors: " + JSON.stringify(bindReport.errors));
  console.log("PASS puzzle bind flow: door lock + instance compile with author-placed terminal, ConfigValidator clean");

  // 5p2a. generic builder puzzles can use any normal furniture/prop as the runtime interaction host.
  const hostedProject = createStarterProject();
  const hostedDoor = hostedProject.doors.find((door) => door.id === "door_b");
  const hostedProp = hostedProject.props.find((prop) => prop.id === "prop_d");
  if (!hostedDoor || !hostedProp) throw new Error("hosted puzzle fixture missing starter door/prop");
  const hostedInstance = createPuzzleInstanceForDoor(hostedProject, hostedDoor, "circuit_grid");
  hostedInstance.roomId = hostedProp.roomId;
  hostedInstance.position = hostedProp.position;
  hostedInstance.rotationY = hostedProp.rotationY;
  hostedInstance.sourceInteraction = {
    label: "Hosted calibration fixture",
    radius: 1.9,
    visualKey: "none",
    materialKey: "terminal_cyan",
    hostPropId: hostedProp.id,
  };
  hostedProject.doors = hostedProject.doors.map((door) =>
    door.id === hostedDoor.id ? { ...door, lockType: "puzzle_complete", puzzleKind: "circuit_grid" } : door,
  );
  hostedProject.puzzles = [hostedInstance];
  if (!hasPlayablePuzzleChain(hostedProject)) throw new Error("hosted prop puzzle must count as a playable chain");
  const hostedCompiled = compileBuilderProjectToLevel(hostedProject);
  if (!hostedCompiled.level || hostedCompiled.issues.length) throw new Error("hosted prop puzzle compile failed: " + JSON.stringify(hostedCompiled.issues));
  const hostedInteraction = hostedCompiled.level.map.interactions.find((entry) => entry.id === "pz_door_b_panel");
  if (
    !hostedInteraction ||
    hostedInteraction.anchorPropId !== hostedProp.id ||
    hostedInteraction.visualKey !== "none" ||
    hostedInteraction.roomId !== hostedProp.roomId ||
    hostedInteraction.position[0] !== hostedProp.position[0] ||
    hostedInteraction.position[2] !== hostedProp.position[1]
  ) {
    throw new Error("generic hosted puzzle must compile to a prop-anchored interaction: " + JSON.stringify(hostedInteraction));
  }
  const hostedReport = validateLevelConfig(hostedCompiled.level, { authoringProfile: "generated" });
  if (!hostedReport.ok) throw new Error("hosted prop puzzle validator errors: " + JSON.stringify(hostedReport.errors));
  console.log("PASS hosted puzzle: ordinary builder prop can host a puzzle interaction and compiles as anchorPropId");

  // 5p2b. archive merge target is authored data: legacy/default = 32, custom values compile through.
  const archiveProject = createStarterProject();
  const archiveDoor = archiveProject.doors.find((door) => door.id === "door_b");
  archiveProject.doors = archiveProject.doors.map((door) =>
    door.id === "door_b" ? { ...door, lockType: "puzzle_complete", puzzleKind: "archive_merge" } : door,
  );
  archiveProject.puzzles = [createPuzzleInstanceForDoor(archiveProject, archiveDoor, "archive_merge")];
  delete archiveProject.puzzles[0].archiveTargetValue;
  const archiveDefaultCompiled = compileBuilderProjectToLevel(archiveProject);
  const archiveDefaultPuzzle = archiveDefaultCompiled.level?.puzzles.find((entry) => entry.type === "archive_merge");
  if (!archiveDefaultCompiled.level || archiveDefaultPuzzle?.targetValue !== 32) {
    throw new Error("archive merge default target must compile to 32: " + JSON.stringify(archiveDefaultPuzzle));
  }
  archiveProject.puzzles[0].archiveTargetValue = 512;
  const archiveCustomCompiled = compileBuilderProjectToLevel(archiveProject);
  const archiveCustomPuzzle = archiveCustomCompiled.level?.puzzles.find((entry) => entry.type === "archive_merge");
  if (!archiveCustomCompiled.level || archiveCustomPuzzle?.targetValue !== 512) {
    throw new Error("archive merge custom target must compile through: " + JSON.stringify(archiveCustomPuzzle));
  }
  const archiveReport = validateLevelConfig(archiveCustomCompiled.level, { authoringProfile: "generated" });
  if (!archiveReport.ok) throw new Error("archive merge custom target validator errors: " + JSON.stringify(archiveReport.errors));
  console.log("PASS archive merge: default target=32, custom target compiles+validates");

  // 5p3. color sequence with separately placed orbs across DIFFERENT rooms.
  const colorProject = createStarterProject();
  const colorDoor = colorProject.doors.find((door) => door.id === "door_c");
  const colorInstance = createPuzzleInstanceForDoor(colorProject, colorDoor, "color_sequence");
  colorInstance.components = [
    {
      id: "pzc_a",
      role: "orb_red",
      roomId: "room_hall",
      position: [2, 3],
      sourceActor: { anchorPropId: "prop_d", position: [2, 1.15, 3] },
      sourceTarget: { anchorPropId: "prop_d" },
    },
    {
      id: "pzc_b",
      role: "orb_blue",
      roomId: "room_archive",
      position: [-9, 3],
      sourceActor: { anchorPropId: "prop_g", position: [-9, 1.15, 3] },
      sourceTarget: { anchorPropId: "prop_g" },
    },
    {
      id: "pzc_c",
      role: "orb_yellow",
      roomId: "room_spawn",
      position: [2, 10],
      sourceActor: { anchorPropId: "prop_a", position: [2, 1.15, 10] },
      sourceTarget: { anchorPropId: "prop_a" },
    },
  ];
  colorProject.doors = colorProject.doors.map((door) => (door.id === "door_c" ? { ...door, lockType: "puzzle_complete" } : door));
  colorProject.puzzles = [colorInstance];
  const colorCompiled = compileBuilderProjectToLevel(colorProject);
  if (!colorCompiled.level || colorCompiled.issues.length) throw new Error("multi-room color compile failed: " + JSON.stringify(colorCompiled.issues));
  const colorPuzzle = colorCompiled.level.puzzles.find((entry) => entry.type === "hit_sequence");
  const orbRooms = colorPuzzle.targets.map((target) => target.roomId);
  if (colorPuzzle.targets.length !== 3 || new Set(orbRooms).size !== 3) {
    throw new Error("color orbs must compile at their per-room placements: " + JSON.stringify(orbRooms));
  }
  if (colorPuzzle.targets[1].position[0] !== -9) throw new Error("orb position must follow the placed component");
  if (colorPuzzle.targets.map((target) => target.anchorPropId).join(",") !== "prop_d,prop_g,prop_a") {
    throw new Error("color orb targets must preserve ordinary prop anchors: " + JSON.stringify(colorPuzzle.targets));
  }
  if (colorPuzzle.actors.map((actor) => actor.anchorPropId).join(",") !== "prop_d,prop_g,prop_a") {
    throw new Error("color orb actors must preserve ordinary prop anchors: " + JSON.stringify(colorPuzzle.actors));
  }
  const colorReport = validateLevelConfig(colorCompiled.level, { authoringProfile: "generated" });
  if (!colorReport.ok) throw new Error("multi-room color validator errors: " + JSON.stringify(colorReport.errors));
  console.log("PASS color sequence: 3 separately placed/prop-hosted orbs across 3 rooms compile+validate");

  // 5p4. builder validation catches broken chains (friendly, blocking).
  const expectIssue = (mutate, needle, label) => {
    const broken = createStarterProject();
    const door = broken.doors.find((candidate) => candidate.id === "door_c");
    broken.doors = broken.doors.map((candidate) => (candidate.id === "door_c" ? { ...candidate, lockType: "puzzle_complete", puzzleKind: "circuit_grid" } : candidate));
    broken.puzzles = [createPuzzleInstanceForDoor(broken, door, "circuit_grid")];
    mutate(broken);
    const found = validateBuilderPuzzles(broken);
    if (!found.some((issue) => issue.message.includes(needle))) {
      throw new Error(`${label}: expected issue containing "${needle}", got ` + JSON.stringify(found));
    }
    const compiled = compileBuilderProjectToLevel(broken);
    if (compiled.level) throw new Error(`${label}: broken project must not compile`);
  };
  expectIssue((broken) => { broken.puzzles[0].linkedDoorId = "door_missing"; }, "绑定的门已被删除", "broken linkedDoorId");
  expectIssue((broken) => { broken.puzzles[0].position = [400, 400]; broken.puzzles[0].roomId = "room_missing"; }, "房间已被删除", "missing puzzle room");
  expectIssue((broken) => { broken.puzzles[0].position = [40, 40]; }, "在房间外面", "terminal outside room");
  expectIssue((broken) => { broken.puzzles = [...broken.puzzles, { ...broken.puzzles[0] }]; }, "同一个内部编号", "duplicate puzzle ids");
  expectIssue((broken) => { broken.puzzles = [...broken.puzzles, { ...broken.puzzles[0], id: "pz_other" }]; }, "绑定了同一扇门", "two puzzles one door");
  expectIssue((broken) => {
    broken.doors = broken.doors.map((candidate) => (candidate.id === "door_c" ? { ...candidate, lockType: "none" } : candidate));
  }, "不再是谜题锁", "door no longer puzzle lock");
  expectIssue((broken) => {
    // console placed behind its own locked door (door_c opens room_fight)
    broken.puzzles[0].roomId = "room_fight";
    broken.puzzles[0].position = [0, -5];
  }, "锁在它自己解锁的门后面", "console behind own door");
  const orbBroken = createStarterProject();
  const orbDoor = orbBroken.doors.find((candidate) => candidate.id === "door_c");
  orbBroken.doors = orbBroken.doors.map((candidate) => (candidate.id === "door_c" ? { ...candidate, lockType: "puzzle_complete" } : candidate));
  const orbInstance = createPuzzleInstanceForDoor(orbBroken, orbDoor, "color_sequence");
  orbInstance.components = [orbInstance.components[0]];
  orbBroken.puzzles = [orbInstance];
  if (!validateBuilderPuzzles(orbBroken).some((issue) => issue.message.includes("至少需要 2 个色球"))) {
    throw new Error("color sequence with 1 orb must fail validation");
  }
  if (hasPlayablePuzzleChain(orbBroken)) throw new Error("broken color chain must not satisfy 有谜题");
  console.log("PASS puzzle validation: broken door link / room / bounds / duplicates / shared door / lock drift / orb count all blocked with friendly text");

  // 5p5. 3D picking priority: puzzle terminal + orbs win over the room floor.
  const pickProject = normalizeBuilderPuzzles(
    (() => {
      const candidate = createStarterProject();
      candidate.doors = candidate.doors.map((door) => (door.id === "door_c" ? { ...door, lockType: "puzzle_complete", puzzleKind: "circuit_grid", puzzleRoomId: "room_hall" } : door));
      return candidate;
    })(),
  );
  const pickInstance = pickProject.puzzles[0];
  const terminalPick = pickAt(pickProject, pickInstance.position[0], pickInstance.position[1], () => null, []);
  if (terminalPick?.kind !== "puzzle" || terminalPick.id !== pickInstance.id || terminalPick.componentId) {
    throw new Error("clicking a puzzle terminal must pick the puzzle, not the floor: " + JSON.stringify(terminalPick));
  }
  const colorPickProject = normalizeBuilderPuzzles(
    (() => {
      const candidate = createStarterProject();
      candidate.doors = candidate.doors.map((door) => (door.id === "door_c" ? { ...door, lockType: "puzzle_complete" } : door));
      candidate.puzzle = { roomId: "room_hall", clueRoomId: "room_spawn", sequence: ["red", "blue", "green"] };
      return candidate;
    })(),
  );
  const orb = colorPickProject.puzzles[0].components[0];
  const orbPick = pickAt(colorPickProject, orb.position[0], orb.position[1], () => null, []);
  if (orbPick?.kind !== "puzzle" || orbPick.componentId !== orb.id) {
    throw new Error("clicking an orb must pick that component: " + JSON.stringify(orbPick));
  }
  const floorPick = pickAt(colorPickProject, colorPickProject.rooms[0].center[0], colorPickProject.rooms[0].center[1], () => null, []);
  if (floorPick?.kind !== "room" || floorPick.id !== colorPickProject.rooms[0].id) {
    throw new Error("empty room floor must pick the room so it can be dragged in 3D: " + JSON.stringify(floorPick));
  }
  const wallPick = pickAt(colorPickProject, colorPickProject.rooms[0].center[0] - colorPickProject.rooms[0].size[0] / 2 + 0.2, colorPickProject.rooms[0].center[1], () => null, []);
  if (wallPick?.kind !== "room") throw new Error("room wall band must still pick the room: " + JSON.stringify(wallPick));
  console.log("PASS 3D picking priority: terminal > orb component > room floor/wall handle (plan-space pickAt)");

  // 5s. story templates: sample depth, copy rules, structure-safe apply, story-aware compile.
  const { builderStoryTemplates, applyStoryTemplate, storyTemplateById } = await server.ssrLoadModule("/src/build/BuilderStoryTemplates.ts");
  const forbiddenCopy = /官卡|三锁|Boss|demo|generated|builder|大门|流程/;
  if (builderStoryTemplates.length < 8) throw new Error(`expected >=8 story templates, got ${builderStoryTemplates.length}`);
  for (const template of builderStoryTemplates) {
    if (template.titles.length < 3 || template.roomNames.length < 6 || template.clueLines.length < 4 || template.victoryLines.length < 2) {
      throw new Error(`story template ${template.id} lacks samples`);
    }
    const corpus = [
      ...template.titles, ...template.roomNames, ...template.exitNames, ...template.clueLines,
      ...template.transitionLines, ...template.victoryLines, template.pitch, template.keyNoun, template.exitLabel,
    ].join("|");
    if (forbiddenCopy.test(corpus)) throw new Error(`story template ${template.id} contains forbidden copy`);
    if (!template.victoryLines.every((line) => /记录[:：]/.test(line))) {
      throw new Error(`story template ${template.id} victory lines must use archive voice (XX记录：…)`);
    }
  }

  // apply must only touch copy: structure (ids, geometry, locks, puzzles, robots) identical.
  let storySeed = 42;
  const seededRandom = () => {
    storySeed = (storySeed * 1664525 + 1013904223) % 4294967296;
    return storySeed / 4294967296;
  };
  const storyProject = createStarterProject();
  storyProject.props.push({
    id: "story_prop_qa",
    modelKey: "age_museum_wall_art_last_human",
    roomId: storyProject.rooms[2].id,
    position: [-9, 5],
    rotationY: 0,
    scale: 1,
  });
  const clinicTemplate = storyTemplateById("memory_clinic");
  const storied = applyStoryTemplate(storyProject, clinicTemplate, { random: seededRandom });
  const structure = (candidate) =>
    JSON.stringify({
      rooms: candidate.rooms.map((room) => [room.id, room.center, room.size, room.style]),
      doors: candidate.doors,
      puzzles: candidate.puzzles ?? [],
      robots: candidate.robots,
      props: candidate.props.map((prop) => [prop.id, prop.modelKey, prop.position, prop.rotationY]),
      exitRoomId: candidate.exitRoomId,
    });
  if (structure(storied) !== structure(storyProject)) throw new Error("applyStoryTemplate mutated gameplay structure");
  if (storied.story?.templateId !== "memory_clinic" || !storied.story.victoryLine) throw new Error("applyStoryTemplate did not record story state");
  if (storied.title === storyProject.title) throw new Error("default title should take a template sample");
  if (!storied.props.find((prop) => prop.id === "story_prop_qa")?.story?.clue) {
    throw new Error("story prop should receive a clue line");
  }
  const renamedSpawn = storied.rooms[0].label;
  if (![...clinicTemplate.roomNames, ...clinicTemplate.exitNames].some((name) => renamedSpawn.startsWith(name))) {
    throw new Error("generic rooms should take template names: " + renamedSpawn);
  }
  const namedProject = { ...createStarterProject(), title: "亲手命名的密室" };
  namedProject.rooms = namedProject.rooms.map((room, index) => (index === 0 ? { ...room, label: "我的手作房" } : room));
  const namedStoried = applyStoryTemplate(namedProject, clinicTemplate, { random: seededRandom });
  if (namedStoried.title !== "亲手命名的密室" || namedStoried.rooms[0].label !== "我的手作房") {
    throw new Error("apply must not overwrite authored names without overwriteAll");
  }

  // story-aware compile: ending lines + key/exit nouns flow into the level; no-story drafts unchanged.
  const storiedCompiled = compileBuilderProjectToLevel(storied);
  if (!storiedCompiled.level || storiedCompiled.issues.length) throw new Error("storied project compile failed: " + JSON.stringify(storiedCompiled.issues));
  if (storiedCompiled.level.exit.victoryMessage !== storied.story.victoryLine) throw new Error("victory line did not reach the compiled level");
  if (!storiedCompiled.level.exit.unlockedLabel.includes(clinicTemplate.exitLabel)) throw new Error("exit label did not reach the compiled level");
  const storiedKey = storiedCompiled.level.map.keyItems[0];
  if (storiedKey && !storiedKey.label.includes(clinicTemplate.keyNoun)) throw new Error("key noun did not reach compiled key items: " + storiedKey.label);
  if (JSON.parse(JSON.stringify(storiedCompiled.level.authoringMetadata)).builderStory?.templateId !== "memory_clinic") {
    throw new Error("builderStory metadata lost in compile");
  }
  const storiedReport = validateLevelConfig(storiedCompiled.level, { authoringProfile: "generated" });
  if (!storiedReport.ok) throw new Error("storied level validator errors: " + JSON.stringify(storiedReport.errors));
  const plainCompiled = compileBuilderProjectToLevel(createStarterProject());
  if (!plainCompiled.level || plainCompiled.level.exit.unlockedLabel !== "撤离电梯") throw new Error("no-story drafts must keep default exit copy");
  console.log(`PASS story templates: ${builderStoryTemplates.length} templates, copy rules clean, apply is structure-safe, story-aware compile validates`);

  // 5s2. maintained official levels: no forbidden words in player-facing copy.
  const playerFacingKeys = new Set([
    "title", "subtitle", "label", "detail", "message", "lockedMessage", "unlockedMessage", "victoryMessage",
    "transitionMessage", "unlockMessage", "hudLabel", "line", "body", "progressLabel", "progressText",
    "startMessage", "objectiveTitle", "objectiveDetail", "feedDetail", "pitch", "unlockedLabel", "distanceLabel",
  ]);
  const officialForbidden = /官卡|三锁|Boss|demo|generated|builder/;
  const copyOffenders = [];
  const walkCopy = (value, path, levelId) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walkCopy(entry, `${path}[${index}]`, levelId));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (typeof child === "string") {
          if (playerFacingKeys.has(key) && officialForbidden.test(child)) copyOffenders.push(`${levelId} ${path}.${key}: ${child.slice(0, 40)}`);
        } else {
          walkCopy(child, `${path}.${key}`, levelId);
        }
      }
    }
  };
  const officialCampaign = humanProtocolBasePack.levels.filter((entry) => humanProtocolBasePack.campaignLevelIds.includes(entry.id));
  if (officialCampaign.length !== humanProtocolBasePack.campaignLevelIds.length) {
    throw new Error(`expected ${humanProtocolBasePack.campaignLevelIds.length} campaign levels, got ${officialCampaign.length}`);
  }
  for (const campaignLevel of officialCampaign) walkCopy(campaignLevel, "", campaignLevel.id);
  if (copyOffenders.length) throw new Error("forbidden copy in official levels:\n" + copyOffenders.slice(0, 10).join("\n"));
  console.log(`PASS official copy audit: ${officialCampaign.length} campaign levels free of forbidden words in player-facing text`);

  // 5a6. flagship room kits: data contract resolves against the catalog and
  // every placement physically fits its room.
  const { builderRoomKitCatalog } = await server.ssrLoadModule("/src/build/builderRoomKitCatalog.ts");
  const { builderRoomStyles } = await server.ssrLoadModule("/src/build/BuilderAssetCatalog.ts");
  if (builderRoomKitCatalog.length !== 5) throw new Error(`expected 5 flagship room kits, got ${builderRoomKitCatalog.length}`);
  if (new Set(builderRoomKitCatalog.map((kit) => kit.kitId)).size !== 5) throw new Error("room kit ids not unique");
  for (const kit of builderRoomKitCatalog) {
    if (!builderRoomStyles.some((style) => style.style === kit.roomStyle)) throw new Error(`room kit ${kit.kitId} uses unknown roomStyle ${kit.roomStyle}`);
    if (kit.placements.length < 4 || kit.placements.length > 8) throw new Error(`room kit ${kit.kitId} must pre-place 4-8 props, got ${kit.placements.length}`);
    if (!kit.placements.some((placement) => placement.role === "hero")) throw new Error(`room kit ${kit.kitId} has no hero placement`);
    const [roomW, roomD] = kit.sizeMeters;
    for (const placement of kit.placements) {
      const catalogEntry = builderPropCatalog.find((candidate) => candidate.modelKey === placement.modelKey);
      if (!catalogEntry) throw new Error(`room kit ${kit.kitId} references unknown modelKey ${placement.modelKey}`);
      if (!environmentModelAssets[placement.modelKey]) throw new Error(`room kit ${kit.kitId} placement not in environmentModelAssets: ${placement.modelKey}`);
      const [w, , d] = catalogEntry.sizeMeters;
      const [rw, rd] = placement.rotationDeg % 180 === 0 ? [w, d] : [d, w];
      const tolerance = catalogEntry.mount === "wall" ? 0.2 : 0.01;
      const [x, z] = placement.offsetMeters;
      if (Math.abs(x) + rw / 2 > roomW / 2 + tolerance || Math.abs(z) + rd / 2 > roomD / 2 + tolerance) {
        throw new Error(`room kit ${kit.kitId} placement out of bounds: ${placement.modelKey} at ${x},${z}`);
      }
    }
  }
  console.log("PASS room kits: 5 flagship kits resolve, hero present, placements fit room bounds");

  // 5b. environment defaults resolve for pre-v9 projects (no env fields)
  const spawnFloor = roomFloor(project.rooms[0]);
  if (spawnFloor.preset.id !== "floor_sterile_tile" || spawnFloor.scale !== 1 || spawnFloor.rotation !== 0) {
    throw new Error("style-derived floor default broken: " + JSON.stringify(spawnFloor.preset.id));
  }
  const spawnWall = roomWall(project.rooms[0]);
  if (spawnWall.preset.id !== "wall_sterile_panel" || spawnWall.height !== 3.36) throw new Error("wall default broken");
  if (roomCeiling(project.rooms[0]).visible !== true || roomCeiling(project.rooms[0]).height !== 3.36 || roomCeiling(project.rooms[0]).preset.id !== "wall_sterile_panel") {
    throw new Error("ceiling default broken");
  }
  if (builderFloorPresets.length !== 32 || builderWallPresets.length !== 34 || builderCeilingPresets.length !== 25) throw new Error("surface preset catalog drifted");
  console.log("PASS env defaults: old drafts resolve to style presets, 32+34+25 surface presets");

  // 5c. lighting clamps + env metadata round-trip through compile + config pack JSON
  const clamped = clampLighting({ ambient: 99, keyColor: "not-a-color", keyIntensity: -5, fog: 2, bloom: 2, shadow: -1 });
  if (clamped.ambient !== 1.2 || clamped.keyColor !== "#ffffff" || clamped.keyIntensity !== 0 || clamped.fog !== 1 || clamped.bloom !== 1 || clamped.shadow !== 0) {
    throw new Error("clampLighting broken: " + JSON.stringify(clamped));
  }
  const envProject = {
    ...project,
    rooms: project.rooms.map((room, index) =>
      index === 1 ? { ...room, env: { floorPresetId: "floor_residential_wood", floorColor: "#d8a86b", floorScale: 2, wallPresetId: "wall_dark_rubber", ceilingVisible: true, ceilingHeight: 3.2 } } : room,
    ),
    lighting: { ambient: 0.9, keyColor: "#ffe2b8", keyIntensity: 1.4, fog: 0.2, bloom: 0.8, shadow: 0.7 },
  };
  const envCompiled = compileBuilderProjectToLevel(envProject);
  if (!envCompiled.level || envCompiled.issues.length) throw new Error("env project compile failed");
  const envReport = validateLevelConfig(envCompiled.level, { authoringProfile: "generated" });
  if (!envReport.ok) throw new Error("env project validator errors: " + JSON.stringify(envReport.errors));
  const packJson = JSON.stringify(createSingleLevelConfigPack(envCompiled.level));
  const roundTrip = JSON.parse(packJson).levels[0].authoringMetadata?.builderEnvironment;
  if (roundTrip?.rooms?.[envProject.rooms[1].id]?.floorPresetId !== "floor_residential_wood") {
    throw new Error("room env metadata lost in pack round-trip");
  }
  if (roundTrip?.lighting?.keyColor !== "#ffe2b8" || projectLighting(envProject).bloom !== 0.8) {
    throw new Error("lighting metadata lost in pack round-trip");
  }
  console.log("PASS env persistence: compile+validate ok, metadata survives config-pack JSON round-trip");

  // 5c2. surface painting: pure brush application + procedural texture cache contract
  const { applyBrushToRooms, brushPreset } = await server.ssrLoadModule("/src/build/BuilderEnvironment.ts");
  const textures = await server.ssrLoadModule("/src/build/BuilderSurfaceTextures.ts");
  const beforeJson = JSON.stringify(project);
  const floorApplied = applyBrushToRooms(project, { kind: "floor", presetId: "floor_hazard_stripe" }, "room_hall");
  if (!floorApplied) throw new Error("floor brush application returned null");
  if (JSON.stringify(project) !== beforeJson) throw new Error("applyBrushToRooms must not mutate its input (hover preview safety)");
  const hallPainted = floorApplied.rooms.find((room) => room.id === "room_hall");
  if (hallPainted.env?.floorPresetId !== "floor_hazard_stripe" || hallPainted.env?.floorColor !== undefined) {
    throw new Error("floor brush env fields wrong: " + JSON.stringify(hallPainted.env));
  }
  if (floorApplied.rooms.some((room) => room.id !== "room_hall" && room !== project.rooms.find((other) => other.id === room.id))) {
    throw new Error("floor brush must only replace the targeted room object");
  }
  if (!floorApplied.status.includes("监控走廊") || !floorApplied.status.includes("警戒斜纹")) {
    throw new Error("paint confirmation status broken: " + floorApplied.status);
  }
  const wallApplied = applyBrushToRooms(project, { kind: "wall", presetId: "wall_museum_stone" }, "room_archive");
  if (wallApplied.rooms.find((room) => room.id === "room_archive").env?.wallPresetId !== "wall_museum_stone" || !wallApplied.status.includes("已应用墙壁")) {
    throw new Error("wall brush application broken: " + wallApplied.status);
  }
  const ceilingApplied = applyBrushToRooms(project, { kind: "ceiling", presetId: "ceiling_hp_museum_coffered_limestone" }, "room_exit");
  const exitPainted = ceilingApplied.rooms.find((room) => room.id === "room_exit");
  if (
    exitPainted.env?.ceilingVisible !== true ||
    exitPainted.env?.ceilingPresetId !== "ceiling_hp_museum_coffered_limestone" ||
    exitPainted.env?.ceilingColor !== undefined ||
    !ceilingApplied.status.includes("已应用天花板") ||
    !ceilingApplied.status.includes("HP 博物馆石膏格顶")
  ) {
    throw new Error("ceiling brush application broken");
  }
  const hazardPreset = builderFloorPresets.find((preset) => preset.id === "floor_hazard_stripe");
  if (brushPreset({ kind: "floor", presetId: "floor_hazard_stripe" })?.label !== "警戒斜纹") throw new Error("brushPreset lookup broken");
  if (brushPreset({ kind: "ceiling", presetId: "ceiling_hp_museum_coffered_limestone" })?.label !== "HP 博物馆石膏格顶") throw new Error("ceiling brushPreset lookup broken");
  if (brushPreset({ kind: "ceiling", presetId: "ceiling_cc0_service_tile" })?.id !== "ceiling_hp_facility_service_ribs") throw new Error("legacy ceiling preset alias broken");
  const keyA = textures.surfaceTextureCacheKey(hazardPreset, "#231b10", 4.11, 3.97, 90);
  const keyB = textures.surfaceTextureCacheKey(hazardPreset, "#231b10", 4.05, 3.95, 90);
  const keyC = textures.surfaceTextureCacheKey(hazardPreset, "#ff0000", 4.11, 3.97, 90);
  if (keyA !== keyB || keyA === keyC) throw new Error(`texture cache key not deterministic/quantized: ${keyA} vs ${keyB} vs ${keyC}`);
  if (textures.floorSurfaceTexture(hazardPreset, "#231b10", 1, 0, 8, 8) !== null) {
    throw new Error("texture helper must be SSR-safe (return null without a DOM)");
  }
  console.log("PASS surface painting: pure apply targets one room, statuses correct, texture keys deterministic + SSR-safe");

  // 5d. room editing math: gizmo handles, resize, introduced-issue detection
  const hall = project.rooms.find((room) => room.id === "room_hall");
  const east = pickRoomHandle(hall, hall.center[0] + hall.size[0] / 2, hall.center[1]);
  if (east?.type !== "resize" || east.edge !== "e") throw new Error("east resize handle not picked: " + JSON.stringify(east));
  const pad = pickRoomHandle(hall, hall.center[0] + 0.3, hall.center[1] - 0.3);
  if (pad?.type !== "move" || pad.axis !== null) throw new Error("center pad not picked: " + JSON.stringify(pad));
  const arrow = pickRoomHandle(hall, hall.center[0] + hall.size[0] / 2 + 1.5, hall.center[1] + 0.2);
  if (arrow?.type !== "move" || arrow.axis !== "x") throw new Error("x arrow not picked: " + JSON.stringify(arrow));
  const grown = resizeRoom(hall, "e", hall.center[0] + hall.size[0] / 2 + 2, hall.center[1]);
  if (grown.size[0] !== hall.size[0] + 2) throw new Error("resizeRoom east broken: " + grown.size[0]);
  const baseline = roomEditIssues(project, "room_hall");
  const shifted = {
    ...project,
    rooms: project.rooms.map((room) => (room.id === "room_hall" ? { ...room, center: [room.center[0] + 30, room.center[1]] } : room)),
  };
  const moved = roomEditIssues(shifted, "room_hall");
  if (moved.brokenDoorIds.length === 0 || !introducedIssues(baseline, moved)) {
    throw new Error("moving hall away must break its doors: " + JSON.stringify(moved));
  }
  console.log("PASS room editing math: handles pick, resize grows, broken-door detection works");

  // 6. topology readout sane for starter
  const topo = computeTopology(project);
  if (!topo.exitReady || topo.lockChain.length < 4) throw new Error("topology readout broken: " + JSON.stringify(topo.lockChain));
  console.log("PASS topology: chain=" + topo.lockChain.map((step) => step.glyph).join("→") + ` pressure=${topo.pressure.toFixed(2)}`);

  // 6a2. repair button: make an invalid draft playable without manual surgery.
  const repairDraft = structuredClone(project);
  repairDraft.rooms.push({ id: "room_far_bad", label: "断线房", style: "maintenance", center: [44, 44], size: [6, 6] });
  repairDraft.doors = repairDraft.doors.map((door) => {
    if (door.id === "door_a") return { ...door, lockType: "puzzle_complete", puzzleKind: undefined };
    if (door.id === "door_b") return { ...door, lockType: "puzzle_complete", puzzleKind: undefined };
    if (door.id === "door_d") return { ...door, fromRoomId: door.toRoomId, toRoomId: door.fromRoomId };
    return door;
  });
  repairDraft.doors.push({ id: "door_bad_far", fromRoomId: "room_fight", toRoomId: "room_far_bad", lockType: "key_item" });
  repairDraft.puzzles = [
    {
      id: "pz_repair_color_a",
      kind: "color_sequence",
      linkedDoorId: "door_a",
      roomId: "room_spawn",
      position: [1.8, 9.2],
      rotationY: 0,
      components: [
        { id: "pzc_repair_a_red", role: "orb_red", roomId: "room_spawn", position: [-1.5, 10.5] },
        { id: "pzc_repair_a_blue", role: "orb_blue", roomId: "room_spawn", position: [0.5, 10.5] },
      ],
    },
    {
      id: "pz_repair_color_b",
      kind: "color_sequence",
      linkedDoorId: "door_b",
      roomId: "room_hall",
      position: [1.5, 3.2],
      rotationY: 0,
      components: [
        { id: "pzc_repair_b_red", role: "orb_red", roomId: "room_hall", position: [-1.5, 3.5] },
        { id: "pzc_repair_b_green", role: "orb_green", roomId: "room_hall", position: [0.5, 3.5] },
      ],
    },
  ];
  const repairedDraft = repairProject(repairDraft);
  if (!repairedDraft.fixes.some((fix) => fix.includes("灯序锁"))) throw new Error("repair did not convert duplicate color puzzle");
  const repairedBadDoor = repairedDraft.project.doors.find((door) => door.id === "door_bad_far");
  if (!repairedBadDoor) throw new Error("repair should keep invalid far door by auto-aligning its rooms");
  const repairedBadFrom = repairedDraft.project.rooms.find((room) => room.id === repairedBadDoor.fromRoomId);
  const repairedBadTo = repairedDraft.project.rooms.find((room) => room.id === repairedBadDoor.toRoomId);
  if (!repairedBadFrom || !repairedBadTo || !sharedEdge(repairedBadFrom, repairedBadTo)) {
    throw new Error("repair kept far door but did not auto-align the room edge: " + JSON.stringify({ repairedBadDoor, repairedBadFrom, repairedBadTo }));
  }
  const repairedDoorD = repairedDraft.project.doors.find((door) => door.id === "door_d");
  if (repairedDoorD?.fromRoomId !== "room_fight" || repairedDoorD.toRoomId !== "room_exit") {
    throw new Error("repair did not flip reversed exit survive door: " + JSON.stringify(repairedDoorD));
  }
  const repairedCompile = compileBuilderProjectToLevel(repairedDraft.project);
  if (!repairedCompile.level || repairedCompile.issues.length) throw new Error("repaired draft failed compile: " + JSON.stringify(repairedCompile.issues));
  const repairedReport = validateLevelConfig(repairedCompile.level, { authoringProfile: "generated" });
  if (!repairedReport.ok) throw new Error("repaired draft validator errors: " + JSON.stringify(repairedReport.errors));
  console.log("PASS repair button: duplicate lamp puzzle, broken door auto-align, reversed exit fight all auto-fixed");

  // 6b. runtime playtest pack: compile counts, store round-trip, hash staleness, failure fallback
  const { compileBuilderRuntimePack } = await server.ssrLoadModule("/src/build/runtime-pack/compileBuilderRuntimePack.ts");
  const { builderProjectHash } = await server.ssrLoadModule("/src/build/runtime-pack/builderProjectHash.ts");
  const { createMemoryRuntimePackBackend, loadLatestBuilderRuntimePackForLevel } = await server.ssrLoadModule(
    "/src/build/runtime-pack/BuilderRuntimePackStore.ts",
  );
  const { generateBuilderPlaytestPack } = await server.ssrLoadModule("/src/build/runtime-pack/generateBuilderPlaytestPack.ts");

  const l3RouteRuntimePack = compileBuilderRuntimePack(importedL3Compiled.level, importedL3, { manifestBakeMode: "proxy" });
  const l3RouteRuntimeKey = l3RouteRuntimePack.renderPlan.instances.find((entry) => entry.state?.keyItemId === "route_route_z43akm_out_1_route_out_yf_key");
  const l3RouteRuntimeLight = l3RouteRuntimePack.renderPlan.lights.find((entry) => entry.id === "light_key_route_route_z43akm_out_1_route_out_yf_key");
  if (
    !l3RouteRuntimeKey ||
    l3RouteRuntimeKey.modelKey !== "pickup_route_output_orb_1:route_output_orb_1" ||
    l3RouteRuntimeLight?.color !== "#72e8ff" ||
    l3RouteRuntimeLight.semanticRole !== "builder_route_output_orb_key_item"
  ) {
    throw new Error("official L3 route output key must bake as the output orb in runtime packs: " + JSON.stringify({ l3RouteRuntimeKey, l3RouteRuntimeLight }));
  }
  console.log("PASS official L3 route output key: runtime pack uses output orb, not legacy chip/yellow key");

  const wallSwitchFastPack = compileBuilderRuntimePack(wallSwitchCompiled.level, wallSwitchProject);
  const fastWallSwitchInstance = wallSwitchFastPack.renderPlan.instances.find((entry) => entry.state?.interactionId === compiledWallInteraction.id);
  if (!fastWallSwitchInstance || fastWallSwitchInstance.modelKey === "builder_route_switch_console" || fastWallSwitchInstance.id.startsWith("route_switch_")) {
    throw new Error("wall door switch fast runtime pack must not bake as the old route console: " + JSON.stringify(fastWallSwitchInstance));
  }
  const wallSwitchCookedModel = {
    modelKey: "hp_wall_door_switch_button_v1",
    vertices: new Float32Array(),
    vertexCount: 0,
    triangleCount: 0,
    materials: [],
    images: [],
    bounds: { min: [-0.245, 0, -0.145], center: [0, 0.425, 0], size: [0.49, 0.85, 0.29] },
    warnings: [],
  };
  const wallSwitchCookedPack = compileBuilderRuntimePack(wallSwitchCompiled.level, wallSwitchProject, {
    cooked: {
      models: new Map([["hp_wall_door_switch_button_v1", wallSwitchCookedModel]]),
      missing: [],
      geometryBytes: 0,
      textureFallbackModels: [],
    },
  });
  const cookedWallSwitchInstance = wallSwitchCookedPack.renderPlan.instances.find((entry) => entry.state?.interactionId === compiledWallInteraction.id);
  if (
    !cookedWallSwitchInstance ||
    cookedWallSwitchInstance.modelKey !== "hp_wall_door_switch_button_v1" ||
    cookedWallSwitchInstance.position[1] !== compiledWallInteraction.position[1] ||
    cookedWallSwitchInstance.rotation[1] !== compiledWallInteraction.yaw
  ) {
    throw new Error("wall door switch cooked runtime pack must bake the wall-mounted 3D lever model: " + JSON.stringify(cookedWallSwitchInstance));
  }
  console.log("PASS wall door switch runtime pack: raw bake uses wall lever model, not route console");

  const packCompiled = compileBuilderRuntimePack(level, project);
  const packCounts = packCompiled.manifest.counts;
  const authoredExitPropCount = project.props.filter((prop) => prop.roomId === project.exitRoomId).length;
  const generatedExitPrefabPropCount = 5; // baked stage + static shell + threshold + single call button + ascent shaft FX
  const expectedRuntimeProps = project.props.length - authoredExitPropCount + generatedExitPrefabPropCount;
  if (packCounts.rooms !== project.rooms.length || packCounts.doors !== project.doors.length || packCounts.props !== expectedRuntimeProps) {
    throw new Error("runtime pack counts drifted: " + JSON.stringify(packCounts));
  }
  if (packCounts.walls <= 0 || packCounts.lights < packCounts.rooms || packCounts.robots <= 0) {
    throw new Error("runtime pack missing walls/lights/robots: " + JSON.stringify(packCounts));
  }
  if (packCompiled.geometryBuffer.byteLength !== packCounts.vertices * 10 * 4) {
    throw new Error("runtime pack geometry stride broken: " + packCompiled.geometryBuffer.byteLength);
  }
  const packPlan = packCompiled.renderPlan;
  if (!packPlan.instances.some((entry) => entry.role === "door_leaf" && entry.state?.doorId)) throw new Error("runtime pack lost door leaves");
  // The exit elevator now renders a solid leaf that blocks until unlocked, then
  // lifts open (the hollow-frame "transparent door" was the bug we fixed).
  const exitDoorLeaf = packPlan.instances.find((entry) => entry.role === "door_leaf" && entry.state?.doorId === starterExitDoor?.id);
  if (!exitDoorLeaf || exitDoorLeaf.state?.openAnimation?.type !== "vertical_lift") {
    throw new Error("runtime pack exit elevator must render a solid lift-open door leaf: " + JSON.stringify(exitDoorLeaf?.state));
  }
  if (!packPlan.instances.some((entry) => entry.role === "prop")) throw new Error("runtime pack lost furniture");
  if (!packPlan.instances.some((entry) => entry.role === "key_item")) throw new Error("runtime pack lost key items");
  const exitButtonInstance = packPlan.instances.find((entry) => entry.role === "prop" && entry.id === "prop_builder_exit_elevator_call_buttons");
  if (!exitButtonInstance) throw new Error("runtime pack must include the small elevator call buttons");
  if (!packPlan.instances.find((entry) => entry.role === "prop" && entry.id === "prop_builder_exit_elevator_interior_shell")) {
    throw new Error("runtime pack must include the static elevator interior shell");
  }
  const legacyExitButtonInstance = packPlan.instances.find((entry) => entry.role === "prop" && entry.id === "prop_builder_exit_elevator_button_panel");
  if (legacyExitButtonInstance) throw new Error("runtime pack must not overlay the legacy large elevator button panel: " + JSON.stringify(legacyExitButtonInstance));
  const packAssets = new Map(packPlan.geometry.assets.map((asset) => [asset.modelKey, asset]));
  const spawnPadAsset = packAssets.get("builder:spawn-pad");
  if (!spawnPadAsset?.bounds || spawnPadAsset.bounds.size[0] > 1.12 || spawnPadAsset.bounds.size[2] > 1.12) {
    throw new Error("spawn pad must stay a small floor marker, not a bright room-sized block: " + JSON.stringify(spawnPadAsset?.bounds?.size));
  }
  for (const entry of packPlan.instances) {
    const asset = packAssets.get(entry.modelKey);
    if (!asset || asset.status !== "ready" || asset.vertexCount <= 0) throw new Error("instance without ready geometry: " + entry.id);
  }
  const materialIndexes = packPlan.geometry.materials.map((material) => material.index);
  if (new Set(materialIndexes).size !== materialIndexes.length || materialIndexes.some((index) => index < 2)) {
    throw new Error("runtime pack material indexes broken");
  }
  if (packPlan.visibilityScenarios.length !== project.rooms.length * 3) throw new Error("runtime pack scenarios drifted");
  const tierCaps = { high: 10, balanced: 8, rescue: 4 };
  for (const scenario of packPlan.visibilityScenarios) {
    if (scenario.selectedLights.length > tierCaps[scenario.qualityTier]) throw new Error("scenario light budget exceeded");
  }
  if (!packPlan.presentation?.lighting?.ambient || !packPlan.presentation.lighting.fog) throw new Error("runtime pack presentation lighting missing");
  console.log(
    `PASS runtime pack compile: ${packCounts.instances} instances, ${packCounts.vertices} verts, ${packCounts.materials} materials, ${packPlan.visibilityScenarios.length} scenarios`,
  );

  // 6b2. playable shell: walls reach the ceiling, ceilings remain real surfaces,
  // but visible ceiling frames/light panels are hidden; lighting is still baked
  // as a practical light. Doors are facility kits, and legacy half-wall drafts
  // bake tall anyway.
  const planAssetByKey = new Map(packPlan.geometry.assets.map((asset) => [asset.modelKey, asset]));
  for (const room of project.rooms) {
    const wallsAsset = planAssetByKey.get(`builder:walls:${room.id}`);
    if (!wallsAsset?.bounds || wallsAsset.bounds.size[1] < 2.7) {
      throw new Error(`runtime walls too short for ${room.id}: ` + JSON.stringify(wallsAsset?.bounds?.size));
    }
    const ceilingAsset = planAssetByKey.get(`builder:ceiling:${room.id}`);
    if (!ceilingAsset) throw new Error(`runtime ceiling missing for ${room.id} (ceiling must default visible)`);
    if (ceilingAsset.vertexCount > 36 * 4) {
      throw new Error(`runtime ceiling for ${room.id} baked visible frames/light panels (${ceilingAsset.vertexCount} verts)`);
    }
    if (!packPlan.lights.some((light) => light.id === `light_ceiling_${room.id}` && light.semanticRole === "builder_ceiling_practical")) {
      throw new Error(`runtime ceiling practical light missing for ${room.id}`);
    }
  }
  for (const door of packCompiled.renderPlan.instances.filter((entry) => entry.role === "door_leaf")) {
    const leafAsset = planAssetByKey.get(door.modelKey);
    if (!leafAsset?.bounds || leafAsset.bounds.size[1] < 2.3) throw new Error(`door leaf too short: ${door.id}`);
    if (leafAsset.vertexCount < 36 * 8) throw new Error(`door leaf too plain: ${door.id} (${leafAsset.vertexCount} verts)`);
  }
  const sampleFrame = packPlan.geometry.assets.find((asset) => asset.modelKey.startsWith("builder:door-frame:"));
  if (!sampleFrame?.bounds || sampleFrame.bounds.size[1] < 2.75) throw new Error("door frame must reach >=2.75m: " + JSON.stringify(sampleFrame?.bounds?.size));
  if (sampleFrame.vertexCount < 36 * 8) throw new Error("door frame too plain: " + sampleFrame.vertexCount);
  // ceiling resources audit through the WGPU resource map (needs the asset index)
  const { builderRuntimeAssetIndexForProject: shellAssetIndexForProject, builderDeepModelRequestsForAssetIndex: shellDeepRequestsForAssetIndex } = await server.ssrLoadModule(
    "/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts",
  );
  const shellAssetIndex = shellAssetIndexForProject(level, project);
  const shellAuditPack = compileBuilderRuntimePack(level, project, { assetIndex: shellAssetIndex });
  const pickupModelKeys = ["pickup_large_yellow_key", "pickup_medkit_white_red", "pickup_energy_cell_amber"];
  for (const modelKey of pickupModelKeys) {
    const entry = shellAssetIndex.find((candidate) => candidate.modelKey === modelKey);
    if (!entry?.glbUrl || !entry.roles.includes("pickup")) {
      throw new Error(`builder runtime asset index must include baked pickup GLB ${modelKey}: ` + JSON.stringify(entry));
    }
    const request = shellDeepRequestsForAssetIndex(shellAssetIndex).requests.find((candidate) => candidate.modelKey === modelKey);
    if (!request || request.kind !== "pickup" || !request.url.includes(".glb")) {
      throw new Error(`deep bake must request pickup GLB ${modelKey}: ` + JSON.stringify(request));
    }
  }
  const ceilingResources = shellAuditPack.manifest.wgpuResources.filter((entry) => entry.modelKey.startsWith("room_ceiling_panel_"));
  if (ceilingResources.length === 0) throw new Error("no room_ceiling_panel_* resources audited in fast pack");
  for (const resource of ceilingResources) {
    if (resource.status !== "proxy" || !resource.geometryModelKey?.startsWith("builder:ceiling:")) {
      throw new Error("ceiling resource must map to procedural builder:ceiling geometry: " + JSON.stringify(resource));
    }
  }
  // legacy explicit half-walls: env.wallHeight=1.12 + ceiling 2.8 must still bake tall
  const legacyShellProject = {
    ...project,
    rooms: project.rooms.map((room, index) =>
      index === 0 ? { ...room, env: { ...room.env, wallHeight: 1.12, ceilingHeight: 2.8, ceilingVisible: true } } : room,
    ),
  };
  const legacyShellCompiled = compileBuilderProjectToLevel(legacyShellProject);
  if (!legacyShellCompiled.level) throw new Error("legacy shell project compile failed");
  const legacyPack = compileBuilderRuntimePack(legacyShellCompiled.level, legacyShellProject);
  const legacyWalls = legacyPack.renderPlan.geometry.assets.find((asset) => asset.modelKey === `builder:walls:${legacyShellProject.rooms[0].id}`);
  if (!legacyWalls?.bounds || legacyWalls.bounds.size[1] < 2.7) {
    throw new Error("legacy 1.12m wallHeight must bake to ceiling height in playtests: " + JSON.stringify(legacyWalls?.bounds?.size));
  }
  // ceiling practicals must not blow the per-tier selected light budget
  for (const scenario of legacyPack.renderPlan.visibilityScenarios) {
    if (scenario.selectedLights.length > tierCaps[scenario.qualityTier]) throw new Error("ceiling lights exceeded scenario budget");
  }
  console.log("PASS playable shell: walls>=2.7m (legacy 1.12m corrected), hidden ceiling fixtures + practical lights, facility door kit >=2.75/2.3m, ceiling resources proxied");

  // 6b3. puzzle machines: each puzzle family bakes its own recognizable cabinet.
  const machineProject = createStarterProject();
  machineProject.doors = machineProject.doors.map((door) =>
    door.id === "door_a" ? { ...door, lockType: "puzzle_complete", puzzleKind: "circuit_grid" }
    : door.id === "door_b" ? { ...door, lockType: "puzzle_complete", puzzleKind: undefined }
      : door.id === "door_c" ? { ...door, lockType: "puzzle_complete", puzzleKind: "archive_merge" }
        : door.id === "door_d" ? { ...door, lockType: "puzzle_complete", puzzleKind: "gallery_reading" }
          : door,
  );
  machineProject.routeSwitches = [
    {
      id: "qa_route_switch",
      label: "QA 路由台",
      roomId: "room_hall",
      keyRoomId: "room_archive",
      position: [-2.2, 4.7],
      rotationY: 0,
      outputs: [{ id: "qa_route_output", kind: "open_door", doorId: "door_a", label: "打开校准门" }],
    },
  ];
  machineProject.puzzle = { roomId: "room_hall", clueRoomId: "room_spawn", sequence: ["red", "blue", "green"] };
  const machineNormalized = normalizeBuilderPuzzles(machineProject);
  const machineCompiled = compileBuilderProjectToLevel(machineNormalized);
  if (!machineCompiled.level || machineCompiled.issues.length) throw new Error("machine project compile failed: " + JSON.stringify(machineCompiled.issues));
  const machineAssetIndex = shellAssetIndexForProject(machineCompiled.level, machineNormalized);
  const machinePack = compileBuilderRuntimePack(machineCompiled.level, machineNormalized, {
    assetIndex: machineAssetIndex,
  });
  const machineAssets = machinePack.renderPlan.geometry.assets;
  // The four premium public consoles surfaced as fresh chips in /build.
  const puzzleKindsForQa = ["color_sequence", "circuit_grid", "archive_merge", "gallery_reading"];
  const machineByKind = new Map(puzzleKindsForQa.map((kind) => [kind, machineAssets.find((asset) => asset.modelKey.startsWith(`builder:puzzle:${kind}:`))]));
  for (const [kind, asset] of machineByKind) {
    if (!asset) throw new Error(`puzzle machine missing from baked geometry: ${kind}`);
    if (asset.vertexCount <= 72) throw new Error(`puzzle machine must be richer than the plain terminal proxy: ${kind}`);
  }
  if (new Set([...machineByKind.values()].map((asset) => asset?.vertexCount)).size < 3) {
    throw new Error("puzzle machines should differ between families");
  }
  for (const kind of puzzleKindsForQa) {
    const resource = machinePack.manifest.wgpuResources.find((entry) => entry.modelKey === `puzzle_console_${kind}`);
    if (!resource || resource.status !== "proxy" || !resource.geometryModelKey?.startsWith(`builder:puzzle:${kind}:`)) {
      throw new Error(`puzzle_console_${kind} resource not audited: ` + JSON.stringify(resource));
    }
  }
  const orbAssets = machineAssets.filter((asset) => asset.modelKey.startsWith("builder:orb:"));
  if (orbAssets.length < 3) throw new Error("color lock should bake three visible orb assets");
  for (const asset of orbAssets) {
    if ((asset.vertexCount ?? 0) <= 72 || !asset.bounds || asset.bounds.size[1] < 1.25 || asset.bounds.size[0] >= asset.bounds.size[1]) {
      throw new Error("color orb must be a pedestal + faceted ball, not a cube: " + JSON.stringify(asset));
    }
  }
  const valveProxyProject = createStarterProject();
  valveProxyProject.props = [
    ...valveProxyProject.props,
    {
      id: "qa_valve_cluster_proxy",
      modelKey: "room_cyber_valve_cluster",
      roomId: "room_spawn",
      position: [valveProxyProject.rooms[0].center[0], valveProxyProject.rooms[0].center[1]],
      rotationY: 0,
      scale: 1,
    },
  ];
  const valveProxyCompiled = compileBuilderProjectToLevel(valveProxyProject);
  if (!valveProxyCompiled.level) throw new Error("valve proxy project compile failed");
  const valveProxyPack = compileBuilderRuntimePack(valveProxyCompiled.level, valveProxyProject);
  const valveProxyAsset = valveProxyPack.renderPlan.geometry.assets.find((asset) => asset.modelKey === "builder:prop:room_cyber_valve_cluster");
  if (!valveProxyAsset?.bounds || valveProxyAsset.vertexCount <= 36 * 4 || valveProxyAsset.bounds.size[1] < 1.2) {
    throw new Error("room_cyber_valve_cluster fallback must be a modeled valve cluster, not a simple block: " + JSON.stringify(valveProxyAsset));
  }
  const { builderDeepModelRequestsForAssetIndex: machineDeepRequestsForAssetIndex } = await server.ssrLoadModule(
    "/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts",
  );
  const machineDeepRequests = machineDeepRequestsForAssetIndex(machineAssetIndex);
  for (const kind of puzzleKindsForQa) {
    const request = machineDeepRequests.requests.find((entry) => entry.modelKey === `puzzle_console_${kind}`);
    if (!request || request.kind !== "furniture" || !request.url.includes("hp_puzzle_console_")) {
      throw new Error(`puzzle_console_${kind} must be collected as a cooked GLB request: ` + JSON.stringify(request));
    }
  }
  const routeSwitchRequest = machineDeepRequests.requests.find((entry) => entry.modelKey === "builder_route_switch_console");
  if (!routeSwitchRequest || routeSwitchRequest.kind !== "furniture" || !routeSwitchRequest.url.includes("hp_builder_route_switch_console")) {
    throw new Error("builder route switch console must be collected as a cooked GLB request: " + JSON.stringify(routeSwitchRequest));
  }
  // 10-float vertices: position3, normal3, uv2, materialIndex1, rigidJointIndex1 (tangent dropped).
  const machineCookedVertices = new Float32Array(3 * 10);
  machineCookedVertices.set([0, 0, 0, 0, 1, 0, 0, 0, 0, -1], 0);
  machineCookedVertices.set([1, 0, 0, 0, 1, 0, 1, 0, 0, -1], 10);
  machineCookedVertices.set([0, 1.4, 0.12, 0, 1, 0, 0, 1, 0, -1], 20);
  const cookedMachineModel = (modelKey) => ({
    modelKey,
    vertices: machineCookedVertices,
    vertexCount: 3,
    triangleCount: 1,
    materials: [
      {
        name: `qa_${modelKey}`,
        baseColorFactor: [0.1, 0.75, 0.9, 1],
        emissiveFactor: [0.02, 0.35, 0.45],
        emissiveStrength: 0.6,
        roughnessFactor: 0.55,
        metallicFactor: 0.2,
        alphaMode: "OPAQUE",
        doubleSided: true,
      },
    ],
    images: [],
    bounds: { min: [0, 0, 0], center: [0.5, 0.7, 0.06], size: [1, 1.4, 0.12] },
    warnings: [],
  });
  const cookedMachineKeys = [...puzzleKindsForQa.map((kind) => `puzzle_console_${kind}`), "builder_route_switch_console"];
  const machineCookedPack = compileBuilderRuntimePack(machineCompiled.level, machineNormalized, {
    assetIndex: machineAssetIndex,
    cooked: {
      models: new Map(cookedMachineKeys.map((key) => [key, cookedMachineModel(key)])),
      missing: [],
      geometryBytes: machineCookedVertices.byteLength * cookedMachineKeys.length,
      textureFallbackModels: [],
    },
  });
  for (const kind of puzzleKindsForQa) {
    const modelKey = `puzzle_console_${kind}`;
    const instance = machineCookedPack.renderPlan.instances.find((entry) => entry.role === "interaction_terminal" && entry.modelKey === modelKey);
    const resource = machineCookedPack.manifest.wgpuResources.find((entry) => entry.modelKey === modelKey);
    if (!instance || resource?.status !== "cooked-glb" || resource.geometryModelKey !== modelKey) {
      throw new Error(`cooked puzzle console did not replace proxy ${modelKey}: ` + JSON.stringify({ instance, resource }));
    }
  }
  const cookedRouteInstance = machineCookedPack.renderPlan.instances.find((entry) => entry.role === "interaction_terminal" && entry.modelKey === "builder_route_switch_console");
  const cookedRouteResource = machineCookedPack.manifest.wgpuResources.find((entry) => entry.modelKey === "builder_route_switch_console");
  if (!cookedRouteInstance || cookedRouteResource?.status !== "cooked-glb" || cookedRouteResource.geometryModelKey !== "builder_route_switch_console") {
    throw new Error("cooked route switch console did not replace proxy: " + JSON.stringify({ cookedRouteInstance, cookedRouteResource }));
  }
  if (machineCookedPack.renderPlan.geometry.assets.some((asset) => asset.modelKey.startsWith("builder:puzzle:") || asset.modelKey.startsWith("builder:route:"))) {
    throw new Error("deep cooked machine pack must not keep old procedural machine assets");
  }
  if (!machinePack.renderPlan.lights.some((light) => light.semanticRole === "builder_puzzle_console")) {
    throw new Error("puzzle machines should carry their console light");
  }
  const { builderProjectNeedsCookedMachinePlaytest } = await server.ssrLoadModule("/src/build/BuilderPlaytestPackControls.tsx");
  if (!builderProjectNeedsCookedMachinePlaytest(machineProject) || builderProjectNeedsCookedMachinePlaytest(createStarterProject())) {
    throw new Error("builder playtest primary should prefer deep only for puzzle/route machine maps");
  }
  console.log("PASS puzzle machines: 4 premium proxy cabinets (color/circuit/archive/gallery) + route console + faceted color orbs + cooked GLB replacement path + console lights");

  const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  // 10-float vertices (tangent dropped); materialIndex now at component 8.
  const nativeTriangle = new Float32Array(3 * 10);
  nativeTriangle.set([0, 0, 0, 0, 1, 0, 0, 0, 7, 0], 0);
  nativeTriangle.set([1, 0, 0, 0, 1, 0, 1, 0, 7, 0], 10);
  nativeTriangle.set([0, 1, 0, 0, 1, 0, 0, 1, 7, 0], 20);
  const nativeEnemyKey = "hp_enemy_repair_drone_horror";
  const nativeFurnitureKey = project.props[0].modelKey;
  const nativeEnemyPack = compileBuilderRuntimePack(level, project, {
    nativeRawModels: {
      libraryId: "qa_native_raw_index",
      sourceLevelIds: ["qa_native_raw_enemy", "qa_native_raw_furniture"],
      models: new Map([
        [
          nativeEnemyKey,
          {
            modelKey: nativeEnemyKey,
            kind: "enemy",
            sourceLevelId: "qa_native_raw_enemy",
            vertices: nativeTriangle,
            asset: {
              modelKey: nativeEnemyKey,
              vertexOffset: 100,
              vertexCount: 3,
              triangleCount: 1,
              nodeCount: 1,
              skinCount: 1,
              rigidSkin: {
                mode: "rigid-node-palette",
                jointCount: 1,
                referencedJointCount: 1,
                chunkCount: 1,
                vertexAttribute: "rigidJointIndex",
              },
              nodeChunks: [
                {
                  nodeIndex: 0,
                  nodeName: "qa_enemy_chunk",
                  vertexOffset: 100,
                  vertexCount: 3,
                  bindMatrix: identityMatrix,
                  inverseBindMatrix: identityMatrix,
                },
              ],
              bounds: { min: [0, 0, 0], center: [0.5, 0.5, 0], size: [1, 1, 0] },
              status: "ready",
            },
          },
        ],
        [
          nativeFurnitureKey,
          {
            modelKey: nativeFurnitureKey,
            kind: "furniture",
            sourceLevelId: "qa_native_raw_furniture",
            vertices: nativeTriangle,
            asset: {
              modelKey: nativeFurnitureKey,
              vertexOffset: 200,
              vertexCount: 3,
              triangleCount: 1,
              bounds: { min: [0, 0, 0], center: [0.5, 0.5, 0], size: [1, 1, 0.1] },
              status: "ready",
            },
          },
        ],
      ]),
      materials: [
        {
          index: 7,
          id: "qa_enemy_material",
          name: "qa_enemy_material",
          category: "enemy",
          visualRole: "robot_body",
          baseColorFactor: [0.7, 0.75, 0.68, 1],
          emissiveFactor: [0, 0, 0],
          emissiveStrength: 0,
          roughnessFactor: 0.65,
          metallicFactor: 0.2,
          aoStrength: 1,
          materialKind: 0,
          alphaMode: "OPAQUE",
          doubleSided: true,
        },
      ],
      baseColorTextures: [],
      materialTextures: [],
    },
  });
  const nativeEnemyAsset = nativeEnemyPack.renderPlan.geometry.assets.find((asset) => asset.modelKey === nativeEnemyKey);
  if (!nativeEnemyAsset || nativeEnemyAsset.vertexCount !== 3 || nativeEnemyAsset.rigidSkin?.mode !== "rigid-node-palette") {
    throw new Error("native raw enemy geometry was not copied into fast pack: " + JSON.stringify(nativeEnemyAsset));
  }
  if (nativeEnemyAsset.nodeChunks?.[0]?.vertexOffset !== nativeEnemyAsset.vertexOffset) {
    throw new Error("native raw enemy node chunk offsets must be rebased: " + JSON.stringify(nativeEnemyAsset.nodeChunks));
  }
  const nativeFurnitureAsset = nativeEnemyPack.renderPlan.geometry.assets.find((asset) => asset.modelKey === nativeFurnitureKey);
  const nativeFurnitureInstance = nativeEnemyPack.renderPlan.instances.find((entry) => entry.id === `prop_${project.props[0].id}`);
  if (!nativeFurnitureAsset || nativeFurnitureAsset.vertexCount !== 3 || nativeFurnitureInstance?.modelKey !== nativeFurnitureKey) {
    throw new Error("native raw furniture was not instanced by modelKey: " + JSON.stringify({ nativeFurnitureAsset, nativeFurnitureInstance }));
  }
  if (
    nativeEnemyPack.manifest.enemyAnimationMode !== "bridge" ||
    !nativeEnemyPack.manifest.nativeRawModels.includes(nativeEnemyKey) ||
    !nativeEnemyPack.manifest.nativeRawEnemyModels.includes(nativeEnemyKey) ||
    !nativeEnemyPack.manifest.nativeRawFurnitureModels.includes(nativeFurnitureKey)
  ) {
    throw new Error("native raw enemy manifest must declare bridge mode: " + JSON.stringify(nativeEnemyPack.manifest));
  }
  console.log("PASS runtime pack native raw models: enemy bridge copied, furniture instanced by canonical modelKey");

  const packBackend = createMemoryRuntimePackBackend();
  const generated = await generateBuilderPlaytestPack(project, { backend: packBackend, headless: true });
  if (!generated.ok) throw new Error("generateBuilderPlaytestPack failed: " + JSON.stringify(generated));
  const reloaded = await loadLatestBuilderRuntimePackForLevel(generated.levelId, packBackend);
  if (!reloaded || reloaded.packId !== generated.packId) throw new Error("runtime pack store round-trip broken");
  if (reloaded.geometryBuffer.byteLength !== packCompiled.geometryBuffer.byteLength) throw new Error("stored geometry size drifted");
  if (reloaded.projectHash !== generated.projectHash) throw new Error("stored projectHash mismatch");
  console.log(`PASS runtime pack store: saved+reloaded ${reloaded.packId}, ${reloaded.geometryBuffer.byteLength} bytes`);

  const reorderedProject = JSON.parse(JSON.stringify(project));
  reorderedProject.rooms = reorderedProject.rooms.map((room) => {
    const flipped = {};
    for (const key of Object.keys(room).reverse()) flipped[key] = room[key];
    return flipped;
  });
  if (builderProjectHash(reorderedProject) !== builderProjectHash(project)) throw new Error("project hash must be key-order independent");
  const editedProject = JSON.parse(JSON.stringify(project));
  editedProject.rooms[0].size = [editedProject.rooms[0].size[0] + 1, editedProject.rooms[0].size[1]];
  if (builderProjectHash(editedProject) === reloaded.projectHash) throw new Error("edited project must invalidate stored pack");
  console.log("PASS runtime pack staleness: stable hash, edits invalidate stored pack");

  const failBackend = createMemoryRuntimePackBackend();
  const failed = await generateBuilderPlaytestPack({ ...project, rooms: [], doors: [] }, { backend: failBackend, headless: true });
  if (failed.ok || failed.phaseId !== "validate" || !failed.error) throw new Error("broken project must fail in validate phase: " + JSON.stringify(failed));
  if ((await failBackend.listForProject(project.projectId)).length !== 0) throw new Error("failed generation must not write packs");
  console.log("PASS runtime pack failure path: validate-phase error, no partial pack written");

  // 6c. retired raw viewmodel mode parsing + cooked utility keys discoverable
  const {
    parseRawViewmodelMode,
    RAW_VIEWMODEL_MODEL_KEYS,
    RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS,
    RAW_VIEWMODEL_HAND_MODEL_KEYS,
    RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS,
  } =
    await server.ssrLoadModule("/src/render/raw-webgpu/RawViewmodelMode.ts");
  if (parseRawViewmodelMode("raw", null, "1") !== "three" || parseRawViewmodelMode("raw", null) !== "three" || parseRawViewmodelMode("off", null) !== "off") {
    throw new Error("viewmodel mode parse broken");
  }
  if (parseRawViewmodelMode(null, "0") !== "off" || parseRawViewmodelMode(null, null) !== "three") throw new Error("viewmodel mode defaults broken");
  if (parseRawViewmodelMode("bogus", null) !== "three") throw new Error("viewmodel mode must reject unknown values");
  const weaponKeys = Object.values(RAW_VIEWMODEL_MODEL_KEYS);
  if (weaponKeys.length !== 2 || !weaponKeys.includes("pickup_iron_rod_viewmodel_battleworn") || !weaponKeys.includes("pickup_sidearm_viewmodel_battleworn")) {
    throw new Error("viewmodel model keys drifted: " + JSON.stringify(weaponKeys));
  }
  for (const key of weaponKeys) {
    if (!environmentModelAssets[key]?.url) throw new Error("cooked weapon model missing from registry: " + key);
  }
  const ultimateKeys = Object.values(RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS);
  if (!ultimateKeys.includes("ability_protocol_breach_charge_v1")) {
    throw new Error("ultimate viewmodel keys must include protocol breach charge: " + JSON.stringify(ultimateKeys));
  }
  for (const key of ultimateKeys) {
    if (!environmentModelAssets[key]?.url) throw new Error("ultimate model missing from registry: " + key);
  }
  console.log("PASS viewmodel mode: retired raw links resolve to Three overlay; utility GLBs discoverable in registry");

  // 6c1. builder runtime asset index is the single contract used by fast Raw,
  // deep bake, and compat preflight.
  const {
    BUILDER_ALL_ENEMY_MODEL_KEYS,
    BUILDER_ASSETS_V1_NATIVE_RAW_MODEL_KEYS,
    BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS,
    BUILDER_NATIVE_RAW_RESOURCE_PACK_ID,
    BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS,
    BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS,
    builderDeepModelRequestsForAssetIndex,
    builderDeepModelRequestsForLevel,
    builderNativeRawRequestsForLevel,
    builderRuntimeAssetIndexForLevel,
    builderRuntimeAssetIndexForProject,
    builderWgpuResourceIndexForLevels,
    isBuilderRuntimeProceduralMapped,
    summarizeBuilderRuntimeAssetIndex,
  } = await server.ssrLoadModule("/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts");
  const { pickupVisualIntents } = await server.ssrLoadModule("/src/game/visual/PickupVisualIntent.ts");
  const assetIndex = builderRuntimeAssetIndexForLevel(level);
  const projectAssetIndex = builderRuntimeAssetIndexForProject(level, project);
  const wallSwitchAssetIndex = builderRuntimeAssetIndexForLevel(wallSwitchCompiled.level);
  const assetIndexByKey = new Map(assetIndex.map((entry) => [entry.modelKey, entry]));
  const projectAssetIndexByKey = new Map(projectAssetIndex.map((entry) => [entry.modelKey, entry]));
  const wallSwitchAssetIndexByKey = new Map(wallSwitchAssetIndex.map((entry) => [entry.modelKey, entry]));
  const assertIndexed = (modelKey, role) => {
    const entry = assetIndexByKey.get(modelKey);
    if (!entry || !entry.roles.includes(role) || typeof entry.glbUrl !== "string" || !entry.glbUrl.includes(".glb")) {
      throw new Error(`asset index missing ${role} mapping for ${modelKey}: ` + JSON.stringify(entry));
    }
  };
  const assertProjectIndexed = (modelKey, role) => {
    const entry = projectAssetIndexByKey.get(modelKey);
    if (!entry || !entry.roles.includes(role) || typeof entry.glbUrl !== "string" || !entry.glbUrl.includes(".glb")) {
      throw new Error(`project asset index missing ${role} mapping for ${modelKey}: ` + JSON.stringify(entry));
    }
  };
  const wallSwitchAssetEntry = wallSwitchAssetIndexByKey.get("hp_wall_door_switch_button_v1");
  if (!wallSwitchAssetEntry || !wallSwitchAssetEntry.nativeRawEligible || !wallSwitchAssetEntry.roles.includes("furniture")) {
    throw new Error("wall door switch 3D handle must be indexed for raw/deep runtime resources: " + JSON.stringify(wallSwitchAssetEntry));
  }
  for (const key of BUILDER_ALL_ENEMY_MODEL_KEYS) assertIndexed(key, "enemy");
  for (const propEntry of level.map.props) assertIndexed(propEntry.modelKey, "furniture");
  for (const key of ["service_elevator_exit_stage", "service_elevator_interior_shell", "door_threshold_service_elevator", "service_elevator_call_buttons", "service_elevator_ascent_shaft_fx"]) {
    assertIndexed(key, "furniture");
  }
  for (const intent of Object.values(pickupVisualIntents)) assertIndexed(intent.modelKey, "pickup");
  for (const key of weaponKeys) assertIndexed(key, "viewmodel");
  for (const key of ultimateKeys) assertIndexed(key, "viewmodel");
  const handKeys = Object.values(RAW_VIEWMODEL_HAND_MODEL_KEYS);
  for (const key of handKeys) assertIndexed(key, "hand");
  assertProjectIndexed("room_floor_tile_clinic", "surface");
  assertProjectIndexed("room_wall_panel_clinic", "surface");
  assertProjectIndexed("room_ceiling_panel_clinic", "surface");
  assertProjectIndexed("door_service_elevator_inner_cyan", "door");
  const indexSummary = summarizeBuilderRuntimeAssetIndex(assetIndex);
  if (indexSummary.missing.length) throw new Error("asset index must not miss starter GLBs: " + indexSummary.missing.join(","));
  const projectIndexSummary = summarizeBuilderRuntimeAssetIndex(projectAssetIndex);
  if (projectIndexSummary.missing.length) throw new Error("project asset index must not miss starter shell GLBs: " + projectIndexSummary.missing.join(","));
  const nativeRequests = builderNativeRawRequestsForLevel(level);
  for (const kind of ["enemy", "furniture", "pickup", "viewmodel", "hand"]) {
    if (!nativeRequests.some((request) => request.kind === kind)) throw new Error("native Raw requests missing kind: " + kind);
  }
  if (!nativeRequests.some((request) => request.modelKey === nativeEnemyKey && request.kind === "enemy")) {
    throw new Error("native Raw requests lost canonical enemy modelKey: " + nativeEnemyKey);
  }
  if (!nativeRequests.some((request) => request.modelKey === nativeFurnitureKey && request.kind === "furniture")) {
    throw new Error("native Raw requests lost canonical furniture modelKey: " + nativeFurnitureKey);
  }
  const deepRequestsFromIndex = builderDeepModelRequestsForLevel(level);
  if (deepRequestsFromIndex.requests.length !== assetIndex.length || deepRequestsFromIndex.unresolved.length !== 0) {
    throw new Error("deep requests must be sourced one-for-one from the asset index: " + JSON.stringify(deepRequestsFromIndex.unresolved));
  }
  for (const key of [...weaponKeys, ...ultimateKeys, ...handKeys]) {
    const request = deepRequestsFromIndex.requests.find((entry) => entry.modelKey === key);
    if (!request || request.kind !== "viewmodel") throw new Error("viewmodel/hand deep request must cook with node chunks: " + key);
  }
  console.log(
    `PASS builder asset index: ${indexSummary.mapped}/${indexSummary.total} GLB mappings, project shell=${projectIndexSummary.byKind.surface.mapped}+${projectIndexSummary.byKind.door.mapped}, deep bake sourced from index`,
  );

  const campaignLevels = humanProtocolBasePack.levels.filter((candidate) => humanProtocolBasePack.campaignLevelIds.includes(candidate.id));
  const sourceIndex = builderWgpuResourceIndexForLevels(campaignLevels);
  const sourceKeys = new Set(sourceIndex.map((entry) => entry.modelKey));
  if (sourceKeys.size !== sourceIndex.length) throw new Error("builder WGPU source index must not duplicate modelKeys");
  for (const campaignLevel of campaignLevels) {
    for (const prop of campaignLevel.map?.props ?? []) {
      if (!sourceKeys.has(prop.modelKey)) throw new Error(`builder WGPU source index missing campaign furniture ${campaignLevel.id}:${prop.modelKey}`);
    }
  }
  for (const entry of builderPropCatalog) {
    if (!sourceKeys.has(entry.modelKey)) throw new Error("builder WGPU source index missing /build catalog asset: " + entry.modelKey);
  }
  const sourceSummary = summarizeBuilderRuntimeAssetIndex(sourceIndex);
  if (sourceSummary.missing.length) throw new Error("builder WGPU source index contains unmapped GLBs: " + sourceSummary.missing.join(","));
  const officialSourceIds = new Set(BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS);
  const sourceReadyKeys = new Set();
  const officialReadyKeys = new Set();
  const supplementalReadyKeys = new Set();
  for (const sourceId of BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS) {
    const sourcePlanPath = path.join(
      bridge.repoRoot,
      `src/assets/manifests/generated/raw-webgpu/render_plan_${sourceId}.json`,
    );
    if (!existsSync(sourcePlanPath)) throw new Error("builder WGPU source import missing render plan: " + sourceId);
    const sourcePlan = JSON.parse(readFileSync(sourcePlanPath, "utf8"));
    const planAssetCategory = new Map((sourcePlan.assets ?? []).map((entry) => [entry.modelKey, entry.category]));
    for (const asset of sourcePlan.geometry?.assets ?? []) {
      if (asset.status !== "ready" || (asset.vertexCount ?? 0) <= 0) continue;
      if (officialSourceIds.has(sourceId) && planAssetCategory.get(asset.modelKey) === "builder-resource") continue;
      sourceReadyKeys.add(asset.modelKey);
      if (sourceId === BUILDER_NATIVE_RAW_RESOURCE_PACK_ID) supplementalReadyKeys.add(asset.modelKey);
      else officialReadyKeys.add(asset.modelKey);
    }
  }
  const assetsV1IndexPath = path.join(
    bridge.repoRoot,
    "public/assets/human-protocol/raw-webgpu/assets-v1/index.json",
  );
  const assetsV1Index = JSON.parse(readFileSync(assetsV1IndexPath, "utf8"));
  const assetsV1ReadyKeys = new Set(
    Object.entries(assetsV1Index.assets ?? {})
      .filter(([, entry]) => entry?.status === "ready")
      .map(([modelKey, entry]) => entry?.modelKey ?? modelKey),
  );
  for (const modelKey of BUILDER_ASSETS_V1_NATIVE_RAW_MODEL_KEYS) {
    if (!assetsV1ReadyKeys.has(modelKey)) throw new Error("assets-v1 source index missing ready native Raw bundle: " + modelKey);
    sourceReadyKeys.add(modelKey);
  }
  for (const entry of sourceIndex) {
    if (isBuilderRuntimeProceduralMapped(entry)) sourceReadyKeys.add(entry.modelKey);
  }
  const missingWgpuResources = sourceIndex
    .filter((entry) => !sourceReadyKeys.has(entry.modelKey))
    .map((entry) => entry.modelKey);
  if (missingWgpuResources.length) {
    throw new Error("builder WGPU source map missing modelKeys: " + missingWgpuResources.join(","));
  }
  const builderOwnedRuntimeKeys = new Set(
    sourceIndex
      .filter((entry) => entry.roles?.some(isRuntimeOwnedBuilderResourceKind) || isRuntimeOwnedBuilderResourceKind(entry.kind))
      .map((entry) => entry.modelKey),
  );
  for (const key of [...weaponKeys, ...ultimateKeys, ...handKeys, ...BUILDER_ALL_ENEMY_MODEL_KEYS]) {
    if (!supplementalReadyKeys.has(key)) throw new Error("builder runtime resource pack missing runtime-owned modelKey: " + key);
  }
  const duplicatedSupplementalKeys = [...supplementalReadyKeys].filter(
    (modelKey) =>
      officialReadyKeys.has(modelKey) &&
      !builderOwnedRuntimeKeys.has(modelKey) &&
      !BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS.has(modelKey),
  );
  if (duplicatedSupplementalKeys.length) {
    throw new Error("builder supplemental WGPU pack duplicated official Raw keys: " + duplicatedSupplementalKeys.join(","));
  }
  console.log(
    `PASS builder WGPU resource map: ${sourceIndex.length}/${sourceIndex.length} unique modelKeys linked across ${BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS.length} imports, supplemental=${supplementalReadyKeys.size}`,
  );

  // 6c2. native hand assets: cook registry, deep-bake collection, pass readiness
  const { rawViewmodelCookAssets } = await server.ssrLoadModule("/src/assets/rawViewmodelCookAssets.ts");
  if (handKeys.length !== 2) throw new Error("hand model keys drifted: " + JSON.stringify(handKeys));
  if (
    !handKeys.includes(RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.cylindrical) ||
    !handKeys.includes(RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.pistol)
  ) {
    throw new Error("hand keys must be reusable grip-family keys: " + JSON.stringify(handKeys));
  }
  for (const key of handKeys) {
    const cookAsset = rawViewmodelCookAssets[key];
    if (!cookAsset || typeof cookAsset.url !== "string" || !cookAsset.url.includes(".glb") || cookAsset.role !== "hand") {
      throw new Error("hand cook asset missing/invalid: " + key);
    }
  }
  if (rawViewmodelCookAssets[RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.cylindrical]?.gripFamily !== "cylindrical") {
    throw new Error("cylindrical hand grip registry mismatch");
  }
  if (rawViewmodelCookAssets[RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.pistol]?.gripFamily !== "pistol") {
    throw new Error("pistol hand grip registry mismatch");
  }
  const { RAW_VIEWMODEL_PROFILES } = await server.ssrLoadModule("/src/render/raw-webgpu/RawViewmodelProfiles.ts");
  if (
    RAW_VIEWMODEL_PROFILES.pulseRifle?.handGripFamily !== "cylindrical" ||
    RAW_VIEWMODEL_PROFILES.pulseRifle?.handModelKey !== RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.cylindrical
  ) {
    throw new Error("pulseRifle must reuse cylindrical grip hand: " + JSON.stringify(RAW_VIEWMODEL_PROFILES.pulseRifle));
  }
  if (
    RAW_VIEWMODEL_PROFILES.railLance?.handGripFamily !== "pistol" ||
    RAW_VIEWMODEL_PROFILES.railLance?.handModelKey !== RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.pistol
  ) {
    throw new Error("railLance must reuse pistol grip hand: " + JSON.stringify(RAW_VIEWMODEL_PROFILES.railLance));
  }
  const { collectBuilderDeepModels: collectWithHands } = await server.ssrLoadModule("/src/build/runtime-pack/collectBuilderDeepModels.ts");
  const handCollection = collectWithHands(level);
  for (const key of handKeys) {
    const request = handCollection.requests.find((entry) => entry.modelKey === key);
    if (!request || request.kind !== "viewmodel") throw new Error("deep bake must collect hand model: " + key);
  }
  const { RawViewmodelPass } = await server.ssrLoadModule("/src/render/raw-webgpu/RawViewmodelPass.ts");
  const syntheticBounds = { min: [-0.3, -0.3, -0.3], center: [0, 0, 0], size: [0.6, 0.6, 0.6] };
  const syntheticAsset = (modelKey, extra = {}) => [
    modelKey,
    { modelKey, vertexOffset: 0, vertexCount: 36, triangleCount: 12, bounds: syntheticBounds, status: "ready", ...extra },
  ];
  const weaponOnlyMap = new Map([
    syntheticAsset("pickup_iron_rod_viewmodel_battleworn"),
    syntheticAsset("pickup_sidearm_viewmodel_battleworn", {
      nodeChunks: [
        { nodeIndex: 0, nodeName: "sidearm_slide", vertexOffset: 0, vertexCount: 18, bindMatrix: [], inverseBindMatrix: [] },
        { nodeIndex: 1, nodeName: "sidearm_barrel", vertexOffset: 18, vertexCount: 18, bindMatrix: [], inverseBindMatrix: [] },
      ],
    }),
  ]);
  const weaponPass = new RawViewmodelPass();
  const weaponOnly = weaponPass.configure(weaponOnlyMap);
  if (!weaponOnly.ready || weaponOnly.weapons.length !== 2) throw new Error("weapon-only readiness broken: " + JSON.stringify(weaponOnly.weapons));
  if (weaponOnly.hands.length !== 0 || weaponOnly.handFallbacks.length !== 2) {
    throw new Error("weapon-only must report missing hands honestly: " + JSON.stringify(weaponOnly.handFallbacks));
  }
  if (!weaponOnly.articulatedWeapons.includes("railLance") || weaponOnly.articulatedWeapons.includes("pulseRifle")) {
    throw new Error("articulation readiness broken: " + JSON.stringify(weaponOnly.articulatedWeapons));
  }
  const fullMap = new Map([...weaponOnlyMap, syntheticAsset(handKeys[0]), syntheticAsset(handKeys[1])]);
  const fullReadiness = new RawViewmodelPass().configure(fullMap);
  if (fullReadiness.hands.length !== 2 || fullReadiness.handFallbacks.length !== 0) {
    throw new Error("weapon+hand readiness broken: " + JSON.stringify(fullReadiness.hands));
  }
  console.log("PASS raw viewmodel hands: cook assets resolvable, deep bake collects them, readiness distinguishes weapon/hand/articulated");

  // 6d. browser GLB cooker parses a synthetic GLB (one red emissive triangle)
  const { parseGlbToCookedModel } = await server.ssrLoadModule("/src/build/runtime-pack/cookGlbModels.ts");
  const { deepCookEmitsNodeChunks } = await server.ssrLoadModule("/src/build/runtime-pack/deepCookPolicy.ts");
  const syntheticGlb = buildSyntheticGlb();
  const cookedTriangle = parseGlbToCookedModel("qa_triangle", syntheticGlb);
  if (cookedTriangle.vertexCount !== 3 || cookedTriangle.triangleCount !== 1) throw new Error("GLB cooker vertex count broken");
  if (cookedTriangle.vertices.length !== 3 * 10) throw new Error("GLB cooker must emit 10-float vertices");
  if (cookedTriangle.materials.length !== 1 || cookedTriangle.materials[0].baseColorFactor[0] !== 0.8) throw new Error("GLB cooker material factors broken");
  if (cookedTriangle.materials[0].emissiveStrength <= 0) throw new Error("GLB cooker must preserve emissive hints");
  // Node translation [2,0,0] must be baked into positions.
  if (Math.abs(cookedTriangle.vertices[0] - 2) > 1e-6) throw new Error("GLB cooker must bake node transforms: " + cookedTriangle.vertices[0]);
  // Viewmodel articulation path: emitNodeChunks yields per-node sub-ranges.
  const chunkedTriangle = parseGlbToCookedModel("qa_triangle_chunks", syntheticGlb, { emitNodeChunks: true });
  if (!chunkedTriangle.nodeChunks || chunkedTriangle.nodeChunks.length !== 1 || chunkedTriangle.nodeChunks[0].vertexCount !== 3) {
    throw new Error("GLB cooker must emit node chunks for viewmodels: " + JSON.stringify(chunkedTriangle.nodeChunks));
  }
  if (cookedTriangle.nodeChunks) throw new Error("bulk models must not pay for node chunks");
  if (!deepCookEmitsNodeChunks("furniture", "hp_wall_door_switch_button_v1") || deepCookEmitsNodeChunks("furniture", "room_terminal_wall")) {
    throw new Error("deep cook policy must preserve wall switch lever chunks without making every furniture model chunked");
  }
  console.log("PASS GLB cooker: synthetic GLB flattens to 10-float vertices with PBR factors, node transforms, opt-in wall-switch chunks");

  const fastWgpuAuditPack = compileBuilderRuntimePack(level, project, { assetIndex: projectAssetIndex });
  if (fastWgpuAuditPack.manifest.bakeMode !== "proxy" || fastWgpuAuditPack.manifest.cookedModels.length !== 0) {
    throw new Error("fast runtime pack must not cook GLBs in-browser: " + JSON.stringify(fastWgpuAuditPack.manifest));
  }
  if (fastWgpuAuditPack.manifest.wgpuResources.length !== projectAssetIndex.length) {
    throw new Error("fast runtime pack must report every asset-index entry in wgpuResources");
  }
  if (!fastWgpuAuditPack.manifest.wgpuResources.some((entry) => entry.modelKey === nativeEnemyKey && entry.status === "missing")) {
    throw new Error("fast resource audit should report missing native resources honestly when no WGPU library was supplied");
  }
  const floorResource = fastWgpuAuditPack.manifest.wgpuResources.find((entry) => entry.modelKey === "room_floor_tile_clinic");
  const wallResource = fastWgpuAuditPack.manifest.wgpuResources.find((entry) => entry.modelKey === "room_wall_panel_clinic");
  const ceilingResource = fastWgpuAuditPack.manifest.wgpuResources.find((entry) => entry.modelKey === "room_ceiling_panel_clinic");
  const doorResource = fastWgpuAuditPack.manifest.wgpuResources.find((entry) => entry.modelKey === "door_service_elevator_inner_cyan");
  if (floorResource?.status !== "proxy" || !floorResource.geometryModelKey?.startsWith("builder:floor:")) {
    throw new Error("fast pack must bake floor surface geometry for resource key: " + JSON.stringify(floorResource));
  }
  if (wallResource?.status !== "proxy" || !wallResource.geometryModelKey?.startsWith("builder:walls:")) {
    throw new Error("fast pack must bake wall surface geometry for resource key: " + JSON.stringify(wallResource));
  }
  if (ceilingResource?.status !== "proxy" || !ceilingResource.geometryModelKey?.startsWith("builder:ceiling:")) {
    throw new Error("fast pack must bake ceiling surface geometry for resource key: " + JSON.stringify(ceilingResource));
  }
  if (doorResource?.status !== "proxy" || !doorResource.geometryModelKey?.startsWith("builder:door-leaf:")) {
    throw new Error("fast pack must bake door geometry for resource key: " + JSON.stringify(doorResource));
  }
  const floorAsset = fastWgpuAuditPack.renderPlan.geometry.assets.find((asset) => asset.modelKey === floorResource.geometryModelKey);
  const wallAsset = fastWgpuAuditPack.renderPlan.geometry.assets.find((asset) => asset.modelKey === wallResource.geometryModelKey);
  const ceilingAsset = fastWgpuAuditPack.renderPlan.geometry.assets.find((asset) => asset.modelKey === ceilingResource.geometryModelKey);
  const doorFrameAsset = fastWgpuAuditPack.renderPlan.geometry.assets.find((asset) => asset.modelKey?.startsWith("builder:door-frame:"));
  const doorLeafAsset = fastWgpuAuditPack.renderPlan.geometry.assets.find((asset) => asset.modelKey === doorResource.geometryModelKey);
  if (!floorAsset || floorAsset.vertexCount <= 36) throw new Error("floor bake regressed to a plain slab: " + JSON.stringify(floorAsset));
  if (!wallAsset || wallAsset.vertexCount <= 72 || wallAsset.bounds?.size?.[1] < 2.7) throw new Error("wall bake regressed to low/plain boxes: " + JSON.stringify(wallAsset));
  if (!ceilingAsset || ceilingAsset.vertexCount > 36 * 4) throw new Error("ceiling bake reintroduced visible frames/light panels: " + JSON.stringify(ceilingAsset));
  if (!doorFrameAsset || doorFrameAsset.vertexCount <= 180 || doorFrameAsset.bounds?.size?.[1] < 2.75) throw new Error("door frame bake regressed: " + JSON.stringify(doorFrameAsset));
  if (!doorLeafAsset || doorLeafAsset.vertexCount <= 216 || doorLeafAsset.bounds?.size?.[1] < 2.3) throw new Error("door leaf bake regressed: " + JSON.stringify(doorLeafAsset));
  console.log("PASS runtime pack WGPU audit: fast pack never cooks GLBs, reports modelKey coverage, bakes surfaces/doors");

  // 6e. deep pack: cooked furniture renders real, fallbacks recorded, pointers split by mode
  const { collectBuilderDeepModels } = await server.ssrLoadModule("/src/build/runtime-pack/collectBuilderDeepModels.ts");
  const collection = collectBuilderDeepModels(level);
  const canonicalRequest = (request) => `${request.modelKey}:${request.kind}:${request.url}`;
  if (
    collection.requests.map(canonicalRequest).sort().join("|") !==
      deepRequestsFromIndex.requests.map(canonicalRequest).sort().join("|") ||
    collection.unresolved.join("|") !== deepRequestsFromIndex.unresolved.join("|")
  ) {
    throw new Error("collectBuilderDeepModels must remain a thin asset-index wrapper");
  }
  const projectCollection = collectBuilderDeepModels(level, projectAssetIndex);
  const deepRequestsFromProjectIndex = builderDeepModelRequestsForAssetIndex(projectAssetIndex);
  if (
    projectCollection.requests.map(canonicalRequest).sort().join("|") !==
      deepRequestsFromProjectIndex.requests.map(canonicalRequest).sort().join("|") ||
    projectCollection.unresolved.join("|") !== deepRequestsFromProjectIndex.unresolved.join("|")
  ) {
    throw new Error("collectBuilderDeepModels(project index) must remain a thin asset-index wrapper");
  }
  if (collection.requests.length < project.props.length) throw new Error("deep collection too small: " + collection.requests.length);
  for (const kind of ["furniture", "pickup", "enemy", "viewmodel"]) {
    if (!collection.requests.some((request) => request.kind === kind)) throw new Error("deep collection missing kind: " + kind);
  }
  const cookedPropKey = project.props[0].modelKey;
  const texturedTriangle = {
    ...cookedTriangle,
    modelKey: cookedPropKey,
    images: [{ imageIndex: 0, mimeType: "image/png", bytes: new ArrayBuffer(64) }],
    materials: cookedTriangle.materials.map((material) => ({ ...material, baseColorImageIndex: 0 })),
  };
  const deepLibrary = {
    models: new Map([[cookedPropKey, texturedTriangle]]),
    missing: [{ modelKey: "qa_missing_model", reason: "QA 注入的缺失模型" }],
    geometryBytes: cookedTriangle.vertices.byteLength,
    textureFallbackModels: ["qa_texture_fallback_model"],
  };
  const deepBackend = createMemoryRuntimePackBackend();
  const deepResult = await generateBuilderPlaytestPack(project, {
    mode: "deep",
    backend: deepBackend,
    headless: true,
    cookedLibraryForTests: deepLibrary,
  });
  if (!deepResult.ok) throw new Error("deep generation failed: " + JSON.stringify(deepResult));
  if (deepResult.bakeMode !== "cooked-glb" || deepResult.manifest.bakeMode !== "cooked-glb") throw new Error("deep manifest bakeMode broken");
  if (!deepResult.manifest.cookedModels.includes(cookedPropKey)) throw new Error("deep manifest lost cooked furniture");
  if (deepResult.manifest.cookedMaterials <= 0) throw new Error("deep manifest cookedMaterials missing");
  if (!deepResult.manifest.missingModels.some((entry) => entry.modelKey === "qa_missing_model")) throw new Error("deep manifest lost missing models");
  if (!deepResult.manifest.fallbackProxyModels.length) throw new Error("deep manifest must record proxy fallbacks");
  if (deepResult.manifest.fallbackProxyModels.includes(cookedPropKey)) throw new Error("cooked furniture must not be listed as fallback");
  const deepRecord = await loadLatestBuilderRuntimePackForLevel(deepResult.levelId, deepBackend, "cooked-glb");
  if (!deepRecord) throw new Error("deep pack not stored");
  const cookedAsset = deepRecord.renderPlan.geometry.assets.find((asset) => asset.modelKey === cookedPropKey);
  if (!cookedAsset || cookedAsset.vertexCount !== 3) throw new Error("deep pack furniture asset must use cooked geometry");
  // texture support v1: bytes stored, plan references layers, fallbacks reported
  if (deepResult.manifest.textureBytes !== 64) throw new Error("deep manifest textureBytes must count stored textures: " + deepResult.manifest.textureBytes);
  if (!deepResult.manifest.textureFallbackModels.includes("qa_texture_fallback_model")) throw new Error("textureFallbackModels lost");
  if ((deepRecord.textureBlobs?.length ?? 0) !== 1 || deepRecord.textureBlobs[0].bytes.byteLength !== 64) throw new Error("deep record must store texture blobs");
  const planTextures = deepRecord.renderPlan.geometry.baseColorTextures ?? [];
  // Layer 0 is the renderer's reserved white-fallback layer; the texture
  // loader skips entries with layer <= 0, so pack textures must start at 1.
  if (planTextures.length !== 1 || planTextures[0].layer !== 1) throw new Error("deep plan texture layers must start at 1 (0 is the fallback layer)");
  const texturedMaterial = deepRecord.renderPlan.geometry.materials.find((material) => material.category === "builder-cooked-glb" && material.textures?.length);
  if (!texturedMaterial || texturedMaterial.textures[0].semantic !== "baseColor" || texturedMaterial.textures[0].layer !== 1) {
    throw new Error("cooked material must carry a baseColor texture slot on layer >= 1");
  }
  if (deepRecord.textureBlobs[0].layer !== planTextures[0].layer) throw new Error("texture blob layer must match plan layer");
  if (deepResult.manifest.enemyAnimationMode !== "static" || !deepResult.manifest.enemyAnimationFallbackReason) {
    throw new Error("deep manifest must declare enemy animation mode honestly");
  }
  const proxyStillThere = await generateBuilderPlaytestPack(project, { mode: "fast", backend: deepBackend, headless: true });
  if (!proxyStillThere.ok || proxyStillThere.bakeMode !== "proxy") throw new Error("fast pack must still generate after deep");
  const fastRecord = await loadLatestBuilderRuntimePackForLevel(deepResult.levelId, deepBackend, "proxy");
  const deepRecordAfter = await loadLatestBuilderRuntimePackForLevel(deepResult.levelId, deepBackend, "cooked-glb");
  if (!fastRecord || !deepRecordAfter || fastRecord.packId === deepRecordAfter.packId) throw new Error("fast/deep packs must coexist per mode");
  console.log(
    `PASS deep pack: cooked ${deepResult.manifest.cookedModels.length} model(s), ${deepResult.manifest.fallbackProxyModels.length} proxy fallback(s), ${deepResult.manifest.textureBytes}B textures, animation=${deepResult.manifest.enemyAnimationMode}, fast+deep coexist`,
  );

  // 6f. deep pack renders the real premium door GLB (frame+leaf as one mesh,
  // scaled to the opening, lifting as a unit) when the door family is cooked;
  // the fast pack keeps the procedural frame/leaf. Exit door stays procedural.
  const { modelKeyForDoor } = await server.ssrLoadModule("/src/assets/environmentModelAssets.ts");
  const nonExitDoor = level.map.doors.find(
    (door) => door.fromRoomId !== project.exitRoomId && door.toRoomId !== project.exitRoomId,
  );
  if (!nonExitDoor) throw new Error("expected a non-exit builder door for the door-GLB test");
  const doorModelKey = modelKeyForDoor(nonExitDoor);
  const doorCookedVertices = new Float32Array(10 * 3);
  doorCookedVertices.set([0, 0, 0, 0, 1, 0, 0, 0, 0, -1], 0);
  doorCookedVertices.set([4.4, 0, 0, 0, 1, 0, 1, 0, 0, -1], 10);
  doorCookedVertices.set([0, 3.3, 0, 0, 1, 0, 0, 1, 0, -1], 20);
  const cookedDoorModel = {
    modelKey: doorModelKey,
    vertices: doorCookedVertices,
    vertexCount: 3,
    triangleCount: 1,
    materials: [{ name: `qa_${doorModelKey}`, baseColorFactor: [0.6, 0.5, 0.4, 1], emissiveFactor: [0.02, 0.03, 0.05], emissiveStrength: 0.4, roughnessFactor: 0.5, metallicFactor: 0.2, alphaMode: "OPAQUE", doubleSided: true }],
    images: [],
    bounds: { min: [0, 0, 0], center: [2.2, 1.65, 0.2], size: [4.4, 3.3, 0.41] },
    warnings: [],
  };
  const doorGlbPack = compileBuilderRuntimePack(level, project, {
    assetIndex: projectAssetIndex,
    cooked: { models: new Map([[doorModelKey, cookedDoorModel]]), missing: [], geometryBytes: doorCookedVertices.byteLength, textureFallbackModels: [] },
  });
  const doorLeaf = doorGlbPack.renderPlan.instances.find((entry) => entry.id === `door_leaf_${nonExitDoor.id}` && entry.modelKey === doorModelKey);
  if (!doorLeaf) throw new Error(`deep door leaf did not use cooked GLB ${doorModelKey}: ` + JSON.stringify(doorGlbPack.renderPlan.instances.filter((i) => i.id.startsWith("door_leaf_"))));
  if (doorLeaf.state?.openAnimation?.type !== "vertical_lift") throw new Error("cooked door must still lift to open");
  if (!Array.isArray(doorLeaf.scale) || !(doorLeaf.scale[0] > 0.7 && doorLeaf.scale[0] < 0.9)) {
    throw new Error("cooked door must be scaled to the 3.6m opening (4.4m → ~0.82): " + JSON.stringify(doorLeaf.scale));
  }
  if (doorGlbPack.renderPlan.instances.some((entry) => entry.id === `door_frame_${nonExitDoor.id}`)) {
    throw new Error("cooked door should not also emit a procedural frame (the GLB carries its own frame)");
  }
  const cookedDoorResource = doorGlbPack.manifest.wgpuResources.find((entry) => entry.modelKey === doorModelKey);
  if (cookedDoorResource?.status !== "cooked-glb") throw new Error(`door modelKey ${doorModelKey} must report cooked-glb, got ` + JSON.stringify(cookedDoorResource));
  // Fast pack: same door stays procedural (frame + leaf), no cooked door asset.
  const doorFastPack = compileBuilderRuntimePack(level, project, { assetIndex: projectAssetIndex });
  if (!doorFastPack.renderPlan.instances.some((entry) => entry.id === `door_frame_${nonExitDoor.id}`)) {
    throw new Error("fast pack must keep the procedural door frame");
  }
  console.log(`PASS deep pack door GLB: ${doorModelKey} renders as a scaled lifting GLB (no procedural frame), fast pack stays procedural`);


  // 7. SSR render: v8 shell (asset browser, view switcher, blueprint, toolbar, inspector)
  const { BuildPage } = await server.ssrLoadModule("/src/build/BuildPage.tsx");
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const html = renderToString(React.createElement(BuildPage));
  for (const needle of [
    "builder-viewswitch",
    "builder-blueprint",
    "builder-cardgrid",
    "builder-asset-card",
    "builder-catalog-search",
    "builder-tooltray",
    "builder-tool",
    "builder-toolbar-status",
    "builder-chain-step",
    "builder-cover-card",
    "builder-insp-modetabs",
    "builder-thumb",
    "builder-preview3d",
    "builder-wall",
    "builder-door-gap",
    // v9: env tab, surface art defs, expanded tool tray, lighting section
    "环境",
    "平移",
    "地板刷",
    "墙壁刷",
    "天花板",
    "光源",
    "bsw-floor_sterile_tile",
    "bfp-room_spawn",
    "builder-collapsible",
    "光线",
    // 货箱堆 / 维修: kept catalog prop + group (the 自动家具 group + its props are
    // temporarily hidden via builderTemporaryHidden, so assert kept entries here).
    "货箱堆",
    "维修",
    // playtest pack flow: single WebGPU path; SSR has no navigator.gpu.
    "需要 WebGPU",
    "Builder 试玩现在必须使用 WebGPU",
  ]) {
    if (!html.includes(needle)) throw new Error("missing in SSR render: " + needle);
  }
  console.log("PASS SSR render of v9 build-mode shell, length=" + html.length);
  console.log("ALL PASS");
} finally {
  await server.close();
}

function isRuntimeOwnedBuilderResourceKind(kind) {
  return kind === "enemy" || kind === "viewmodel" || kind === "hand";
}

/** Builds a minimal valid GLB: one node (translated +2x) with a red emissive triangle. */
function buildSyntheticGlb() {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const indices = new Uint16Array([0, 1, 2, 0]); // padded to 4-byte alignment
  const binLength = positions.byteLength + normals.byteLength + indices.byteLength;
  const bin = new Uint8Array(binLength);
  bin.set(new Uint8Array(positions.buffer), 0);
  bin.set(new Uint8Array(normals.buffer), positions.byteLength);
  bin.set(new Uint8Array(indices.buffer), positions.byteLength + normals.byteLength);

  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, translation: [2, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [
      {
        name: "qa_red_emissive",
        pbrMetallicRoughness: { baseColorFactor: [0.8, 0.1, 0.1, 1], metallicFactor: 0.2, roughnessFactor: 0.5 },
        emissiveFactor: [1, 0.2, 0.2],
        extensions: { KHR_materials_emissive_strength: { emissiveStrength: 1.5 } },
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: 3, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength },
      { buffer: 0, byteOffset: positions.byteLength + normals.byteLength, byteLength: 6 },
    ],
    buffers: [{ byteLength: binLength }],
  };
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPad) {
    const padded = new Uint8Array(jsonBytes.length + jsonPad);
    padded.set(jsonBytes);
    padded.fill(0x20, jsonBytes.length);
    jsonBytes = padded;
  }
  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(jsonBytes, 20);
  const binChunkStart = 20 + jsonBytes.length;
  view.setUint32(binChunkStart, bin.length, true);
  view.setUint32(binChunkStart + 4, 0x004e4942, true);
  bytes.set(bin, binChunkStart + 8);
  return out;
}
