// Route-switch runtime QA: compiles a builder level containing a route switch,
// loads it into a real GameWorld, and asserts the deep-playtest contract:
//   - the switch opens the route overlay (mode=routeSwitch) WITHOUT the key
//   - without each output's orb key, that output is unauthorized (choose is a no-op)
//   - each output has its own generated pickup orb, and collecting one orb only
//     authorizes its matching output
//   - with the matching orb key, choosing an output applies THAT state directly (non-cyclic)
//   - output kinds map to door / robot / standby, and a door output really opens
//
// Run: node scripts/qa/route-switch-runtime-qa.mjs
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });
let failures = 0;
const ok = (cond, msg) => {
  if (cond) {
    console.log(`PASS ${msg}`);
  } else {
    failures += 1;
    console.error(`FAIL ${msg}`);
  }
};

// A reveal must carry a finite, framed cinematic pose (camera pulled back from
// the target), not a degenerate point the camera snaps into.
const isFinitePose = (reveal) =>
  Array.isArray(reveal?.cameraPosition) &&
  Array.isArray(reveal?.targetPosition) &&
  reveal.cameraPosition.length === 3 &&
  reveal.targetPosition.length === 3 &&
  reveal.cameraPosition.every(Number.isFinite) &&
  reveal.targetPosition.every(Number.isFinite);
const poseDistance = (reveal) => {
  if (!isFinitePose(reveal)) return 0;
  const [cx, cy, cz] = reveal.cameraPosition;
  const [tx, ty, tz] = reveal.targetPosition;
  return Math.hypot(cx - tx, cy - ty, cz - tz);
};

try {
  const { GameWorld } = await server.ssrLoadModule("/src/game/core/GameWorld.ts");
  const { InteractionSystem } = await server.ssrLoadModule("/src/game/systems/InteractionSystem.ts");
  const { createStarterProject } = await server.ssrLoadModule("/src/build/BuilderTypes.ts");
  const { compileBuilderProjectToLevel } = await server.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts");
  const { humanProtocolBasePack } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { focusRevealWeaponHidden } = await server.ssrLoadModule("/src/render/focusRevealCamera.ts");

  const project = createStarterProject();
  project.projectId = "proj_route_qa";
  project.routeSwitches = [
    {
      id: "rt_main",
      label: "管制路由台",
      roomId: "room_hall",
      keyRoomId: "room_archive",
      position: [2.4, 3.0],
      rotationY: 0,
      outputs: [
        { id: "o_door", kind: "open_door", doorId: "door_c" },
        { id: "o_robots", kind: "start_robots", robotRoomId: "room_fight" },
      ],
    },
  ];

  const compiled = compileBuilderProjectToLevel(project);
  const fatal = (compiled.issues ?? []).filter((issue) => issue.severity === "error");
  ok(fatal.length === 0, `route level compiles without fatal issues (${fatal.map((f) => f.message).join("; ") || "clean"})`);

  const level = compiled.level;
  level.id = "qa_route_switch_level";
  humanProtocolBasePack.levels.push(level);

  const world = new GameWorld();
  world.loadLevel(level.id, "playing");

  const def = world.level.switches?.find((candidate) => candidate.id.startsWith("route_"));
  ok(Boolean(def), `compiled level has a route switch definition (${def?.id})`);
  const interactionId = def.interactionId;
  const interaction = world.level.map.interactions.find((i) => i.id === interactionId);
  ok(!interaction?.consumesKeyItemId, "route switch interaction itself is not globally key-gated");
  ok(Boolean(world.routeSwitchForInteraction(interactionId)), "routeSwitchForInteraction recognises the console");
  ok(world.isRouteSwitch(def.id), "isRouteSwitch true for the console");
  const outputStates = def.states.filter((state) => state.id !== def.initialStateId);
  ok(outputStates.length === 2, `route switch has two playable output states (${outputStates.length})`);
  ok(outputStates.every((state) => Boolean(state.requiredKeyItemId)), "each output state requires its own key item");
  const outputKeyIds = outputStates.map((state) => state.requiredKeyItemId);
  const outputKeyItems = outputKeyIds.map((id) => world.level.map.keyItems.find((item) => item.id === id));
  ok(outputKeyItems.every(Boolean), `compiled level has one pickup per output (${outputKeyIds.join(", ")})`);
  ok(
    outputKeyItems.every((item, index) => item?.visualKey === `route_output_orb_${index + 1}`),
    `output keys use route orb visuals (${outputKeyItems.map((item) => item?.visualKey).join(", ")})`,
  );

  // --- No key: openable, unauthorized -------------------------------------
  ok(world.routeSwitchHasKey(def.id) === false, "no output orb keys yet → routeSwitchHasKey false");
  world.openRouteSwitch(def.id);
  ok(world.session.mode === "routeSwitch", "openRouteSwitch sets mode=routeSwitch");
  const lockedView = world.activeRouteSwitchView();
  ok(lockedView && lockedView.hasKey === false, "view reports hasKey=false without any output orb key");
  ok(
    lockedView.options.filter((option) => !option.isIdle).every((option) => option.hasKey === false),
    "each output option reports hasKey=false without its orb",
  );
  const kinds = (lockedView?.options ?? []).map((o) => o.kind).sort().join(",");
  ok(kinds === "door,robot,standby", `option kinds map correctly (got ${kinds})`);

  const doorOpt = lockedView.options.find((o) => o.kind === "door");
  const robotOpt = lockedView.options.find((o) => o.kind === "robot");
  const beforeState = world.activeSwitchStateId(def.id);
  const deniedResult = world.chooseRouteSwitchState(def.id, doorOpt.stateId);
  ok(deniedResult === false, "choose without key returns false");
  ok(world.activeSwitchStateId(def.id) === beforeState, "choose without key does not change state");
  ok(world.isDoorOpen("door_c") === false, "door stays closed when unauthorized");
  world.closeRouteSwitch();
  ok(world.session.mode === "playing", "closeRouteSwitch returns to playing");

  // --- Interaction opens overlay WITHOUT key ------------------------------
  const interactionSystem = new InteractionSystem();
  world.player.position.set(interaction.position[0], 0, interaction.position[2]);
  world.input.interactPressed = true;
  interactionSystem.update(world);
  world.input.interactPressed = false;
  ok(world.session.mode === "routeSwitch", "E on the console opens the overlay even without the key");
  world.closeRouteSwitch();

  // --- With only the door orb: door is authorized, robots stay locked ------
  const doorKeyId = outputStates.find((state) => state.id === doorOpt.stateId)?.requiredKeyItemId;
  const robotKeyId = outputStates.find((state) => state.id === robotOpt.stateId)?.requiredKeyItemId;
  world.session.mapProgress.collectedKeyItemIds.push(doorKeyId);
  ok(world.routeSwitchHasKey(def.id) === true, "after collecting one output orb → routeSwitchHasKey true");
  world.openRouteSwitch(def.id);
  const partialView = world.activeRouteSwitchView();
  ok(partialView.hasKey === true, "view reports hasKey=true with at least one output orb");
  ok(partialView.options.find((option) => option.stateId === doorOpt.stateId)?.hasKey === true, "door output reports hasKey=true with door orb");
  ok(partialView.options.find((option) => option.stateId === robotOpt.stateId)?.hasKey === false, "robot output remains locked without robot orb");
  ok(world.chooseRouteSwitchState(def.id, robotOpt.stateId) === false, "choose robot output fails without the robot orb");
  ok(world.activeSwitchStateId(def.id) !== robotOpt.stateId, "robot output does not become active without its orb");

  // --- With matching orb: authorized, direct (non-cyclic) selection --------
  world.session.mapProgress.collectedKeyItemIds.push(robotKeyId);
  ok(world.activeRouteSwitchView().options.find((option) => option.stateId === robotOpt.stateId)?.hasKey === true, "robot output reports hasKey=true after robot orb");

  // Choose the robot output first...
  ok(world.chooseRouteSwitchState(def.id, robotOpt.stateId) === true, "choose robot output succeeds with key");
  ok(world.activeSwitchStateId(def.id) === robotOpt.stateId, "robot output applied directly (not cycled)");
  // ...robot output starts a 3D reveal aimed at the robot room + queues its wave.
  const robotReveal = world.session.activeFocusReveal;
  ok(robotReveal?.kind === "robot", `robot output starts a robot reveal (got ${robotReveal?.kind})`);
  ok(robotReveal?.roomId === "room_fight", `robot reveal targets room_fight (got ${robotReveal?.roomId})`);
  ok(
    (world.session.pendingWaveStarts ?? []).some((pending) => pending.waveId === "wave_room_fight"),
    "robot output queued wave_room_fight",
  );
  // The reveal is a real cinematic pose and the first-person viewmodel hides.
  ok(isFinitePose(robotReveal), "robot reveal carries finite camera + target positions");
  ok(poseDistance(robotReveal) > 1.0, "robot reveal camera is pulled back from the room (framed, not on top of it)");
  ok(focusRevealWeaponHidden({ ...robotReveal, elapsed: robotReveal.duration / 2 }) > 0.9, "viewmodel is fully hidden mid robot reveal");

  // ...then jump straight to the door output (proves non-cyclic direct select).
  ok(world.chooseRouteSwitchState(def.id, doorOpt.stateId) === true, "choose door output succeeds");
  ok(world.activeSwitchStateId(def.id) === doorOpt.stateId, "door output applied directly after robot (non-cyclic)");
  ok(world.isDoorOpen("door_c") === true, "door output actually opens door_c");
  // ...door output starts a 3D reveal aimed at the freshly-opened door.
  const doorReveal = world.session.activeFocusReveal;
  ok(doorReveal?.kind === "door", `door output starts a door reveal (got ${doorReveal?.kind})`);
  ok(doorReveal?.targetId === "door_c", `door reveal targets door_c (got ${doorReveal?.targetId})`);
  ok(Boolean(doorReveal?.roomId), "door reveal carries a room to render during the reveal");
  // Framed pose + long enough hold for the paced slow-open + viewmodel hidden.
  ok(isFinitePose(doorReveal), "door reveal carries finite camera + target positions");
  ok(poseDistance(doorReveal) > 1.0, "door reveal camera is pulled back from the door (framed, not on top of it)");
  ok((doorReveal?.duration ?? 0) >= 2.5, `door reveal holds long enough for the paced slow-open (got ${doorReveal?.duration}s, need >=2.5)`);
  ok(
    doorReveal?.cameraCut || focusRevealWeaponHidden({ ...doorReveal, elapsed: 0 }) === 0,
    "viewmodel start state matches reveal mode (camera-cut reveals hide immediately)",
  );
  ok(focusRevealWeaponHidden({ ...doorReveal, elapsed: doorReveal.duration / 2 }) > 0.9, "viewmodel is fully hidden mid door reveal");
  ok(focusRevealWeaponHidden(null) === 0, "viewmodel is restored (not hidden) when no reveal is active");

  // The reveal is a real session state that elapses back to plain play.
  ok(world.session.mode === "routeSwitch" || world.session.mode === "playing", "mode is not stuck on a 2D panel after commit");
  world.closeRouteSwitch();
  ok(world.session.mode === "playing", "after closing the panel the world is playing");
  // Overlay drops the instant the route commits, but the reveal keeps running —
  // the 2D panel hands off to the 3D facility camera, not the other way around.
  ok(world.session.activeFocusReveal !== null, "focus reveal stays active after the route panel closes (2D → 3D handoff)");
  world.updateFocusReveal((doorReveal?.duration ?? 2.4) + 0.1);
  ok(world.session.activeFocusReveal === null, "focus reveal clears after its duration");

  // --- Puzzle output: reveal targets the gated terminal + makes it usable ---
  const puzzleProject = createStarterProject();
  puzzleProject.projectId = "proj_route_puzzle_qa";
  puzzleProject.doors = puzzleProject.doors.map((door) =>
    door.id === "door_c"
      ? { id: "door_c", fromRoomId: "room_hall", toRoomId: "room_fight", lockType: "puzzle_complete", puzzleKind: "archive_merge", puzzleRoomId: "room_hall" }
      : door,
  );
  puzzleProject.puzzles = [{ id: "pz_route", kind: "archive_merge", linkedDoorId: "door_c", roomId: "room_hall", position: [2.4, 3], rotationY: 0 }];
  puzzleProject.routeSwitches = [
    {
      id: "rt_puzzle",
      label: "谜题路由台",
      roomId: "room_hall",
      keyRoomId: "room_archive",
      position: [-2.4, 3.0],
      rotationY: 0,
      outputs: [{ id: "o_puzzle", kind: "reveal_puzzle", puzzleId: "pz_route" }],
    },
  ];
  const puzzleCompiled = compileBuilderProjectToLevel(puzzleProject);
  const puzzleFatal = (puzzleCompiled.issues ?? []).filter((issue) => issue.severity === "error");
  ok(puzzleFatal.length === 0, `puzzle-route level compiles clean (${puzzleFatal.map((f) => f.message).join("; ") || "clean"})`);
  const puzzleLevel = puzzleCompiled.level;
  puzzleLevel.id = "qa_route_puzzle_level";
  humanProtocolBasePack.levels.push(puzzleLevel);

  const pworld = new GameWorld();
  pworld.loadLevel(puzzleLevel.id, "playing");
  const pdef = pworld.level.switches?.find((candidate) => candidate.id.startsWith("route_"));
  // The gated puzzle terminal is NOT usable before the route is set...
  const gatedTerminal = pworld.level.map.interactions.find((i) => i.requiresSwitchState && i.requiresSwitchState.switchId === pdef.id);
  ok(Boolean(gatedTerminal), "puzzle terminal carries a requiresSwitchState gate");
  ok(
    pworld.activeSwitchStateId(pdef.id) !== gatedTerminal.requiresSwitchState.stateId,
    "puzzle terminal gate is unmet before choosing the route",
  );
  pworld.openRouteSwitch(pdef.id);
  const puzzleOpt = pworld.activeRouteSwitchView().options.find((o) => o.kind === "puzzle");
  ok(Boolean(puzzleOpt), "route view exposes a puzzle output");
  const puzzleKeyId = pdef.states.find((state) => state.id === puzzleOpt.stateId)?.requiredKeyItemId;
  pworld.session.mapProgress.collectedKeyItemIds.push(puzzleKeyId);
  ok(pworld.activeRouteSwitchView().options.find((option) => option.stateId === puzzleOpt.stateId)?.hasKey === true, "puzzle output reports hasKey=true after puzzle orb");
  ok(pworld.chooseRouteSwitchState(pdef.id, puzzleOpt.stateId) === true, "choose puzzle output succeeds with key");
  const puzzleReveal = pworld.session.activeFocusReveal;
  ok(puzzleReveal?.kind === "puzzle", `puzzle output starts a puzzle reveal (got ${puzzleReveal?.kind})`);
  ok(puzzleReveal?.targetId === gatedTerminal.id, `puzzle reveal targets the gated terminal (got ${puzzleReveal?.targetId})`);
  ok(isFinitePose(puzzleReveal), "puzzle reveal carries finite camera + target positions");
  ok(focusRevealWeaponHidden({ ...puzzleReveal, elapsed: puzzleReveal.duration / 2 }) > 0.9, "viewmodel is fully hidden mid puzzle reveal");
  // ...and after choosing it the gate is satisfied → the terminal is usable.
  ok(
    pworld.activeSwitchStateId(pdef.id) === gatedTerminal.requiresSwitchState.stateId,
    "puzzle terminal gate is satisfied after the route is set (terminal now usable/visible)",
  );

  console.log(failures === 0 ? "ALL PASS route-switch runtime" : `FAILED route-switch runtime (${failures})`);
} catch (error) {
  console.error("FAIL route-switch runtime threw:", error?.stack ?? error);
  failures += 1;
} finally {
  await server.close();
}

process.exit(failures === 0 ? 0 : 1);
