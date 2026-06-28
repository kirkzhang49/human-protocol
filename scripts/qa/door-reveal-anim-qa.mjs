// Door-reveal animation QA (no GPU): proves the Raw renderer keeps an opening
// door leaf VISIBLE while it lifts, instead of culling it the instant the door
// flips open (which made the slow-open invisible). Exercises the real
// RawRoomRuntime.isPlanInstanceVisible door-leaf gating with a fake world +
// minimal plan, varying the door visual progress.
//
// Run: node scripts/qa/door-reveal-anim-qa.mjs
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`PASS ${msg}`);
  else {
    failures += 1;
    console.error(`FAIL ${msg}`);
  }
};

try {
  const { RawRoomRuntime } = await server.ssrLoadModule("/src/render/raw-webgpu/RawRoomRuntime.ts");

  const room = { id: "room_a", bounds: { center: [0, 0, 0], size: [10, 4, 10] } };
  const roomB = { id: "room_b", bounds: { center: [20, 0, 0], size: [10, 4, 10] } };
  const plan = { rooms: [room, roomB], lightingProfiles: [], visibilityScenarios: [], level: { id: "qa_door_anim" } };
  const runtime = new RawRoomRuntime(plan);

  // Minimal world the visibility predicate reads from.
  const world = {
    isDoorOpen: () => true,
    renderPerformance: { quality: { tier: "high" } },
    session: {
      mode: "playing",
      activeExitCinematic: null,
      activeFocusReveal: null,
      mapProgress: { currentRoomId: "room_a", collectedKeyItemIds: [], completedInteractionIds: [], openedDoorIds: ["door_x"] },
    },
    player: { position: { x: 0, z: 0 } },
  };

  const visibleRooms = new Set(["room_a"]);
  const visibleDoors = new Set(["door_x"]);

  const animatedLeaf = {
    role: "door_leaf",
    roomId: "room_a",
    visibility: { type: "room" },
    state: {
      doorId: "door_x",
      openAnimation: { type: "vertical_lift", axis: "y", distance: 1.05 },
      openVisualPolicy: { hideClosedHardwareAfterOpen: true },
    },
  };

  // Mid-lift: the leaf must stay visible so the slow-open is seen.
  ok(
    runtime.isPlanInstanceVisible(world, animatedLeaf, visibleRooms, visibleDoors, () => 0.0) === true,
    "opening door leaf is visible at progress 0.0 (just opened)",
  );
  ok(
    runtime.isPlanInstanceVisible(world, animatedLeaf, visibleRooms, visibleDoors, () => 0.5) === true,
    "opening door leaf is visible mid-lift (progress 0.5)",
  );
  // Mostly open: now the closed-style hardware may hide (mirrors Three >0.82).
  ok(
    runtime.isPlanInstanceVisible(world, animatedLeaf, visibleRooms, visibleDoors, () => 0.95) === false,
    "door leaf hides once mostly open (progress 0.95)",
  );

  // A leaf with no animation has nothing to show → hidden immediately (unchanged).
  const staticLeaf = { ...animatedLeaf, state: { doorId: "door_x", openVisualPolicy: { hideClosedHardwareAfterOpen: true } } };
  ok(
    runtime.isPlanInstanceVisible(world, staticLeaf, visibleRooms, visibleDoors, () => 0.1) === false,
    "non-animated open door leaf hides immediately",
  );

  // The door-status / hardware panel (role "door_panel") is a sibling of the
  // leaf with no animation state of its own. It lifts with the leaf (see
  // openDoorVisualOffset) so it must NOT be culled mid-lift, otherwise the
  // hardware would pop/float; once the door is mostly open it retires only when
  // the door's hide-hardware policy says so (so it does not hover in the doorway).
  const hardwarePanel = { role: "door_panel", roomId: "room_a", visibility: { type: "door", doorId: "door_x" }, state: null };
  const hidesHardware = () => true;
  const keepsHardware = () => false;
  ok(
    runtime.isPlanInstanceVisible(world, hardwarePanel, visibleRooms, visibleDoors, () => 0.5, hidesHardware) === true,
    "door-status hardware visible mid-lift (tracks leaf, no floating)",
  );
  ok(
    runtime.isPlanInstanceVisible(world, hardwarePanel, visibleRooms, visibleDoors, () => 0.95, hidesHardware) === false,
    "door-status hardware retires once mostly open when policy hides hardware",
  );
  ok(
    runtime.isPlanInstanceVisible(world, hardwarePanel, visibleRooms, visibleDoors, () => 0.95, keepsHardware) === true,
    "door-status hardware stays (lifted with leaf) when policy keeps hardware",
  );

  // A focus reveal keeps the current room on the PLAYER's room (the rotate-only
  // camera stays there) but force-adds the revealed room to the visible set so it
  // renders through the opened door.
  world.session.activeFocusReveal = { kind: "room", roomId: "room_b", targetId: "room_b", elapsed: 0, duration: 2.2, targetPosition: [20, 1, 0], cameraPosition: [0, 1.45, 0] };
  ok(runtime.currentRoomId(world) === "room_a", "current room stays the player's room during a reveal (camera no longer flies into the revealed room)");
  ok(runtime.frame(world).visibleRoomIds.has("room_b"), "revealed room is force-added to the visible set so it renders through the opened door");

  console.log(failures === 0 ? "ALL PASS door-reveal anim" : `FAILED door-reveal anim (${failures})`);
} catch (error) {
  console.error("FAIL door-reveal anim threw:", error?.stack ?? error);
  failures += 1;
} finally {
  await server.close();
}

process.exit(failures === 0 ? 0 : 1);
