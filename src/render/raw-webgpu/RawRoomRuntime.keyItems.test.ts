import { describe, expect, it } from "vitest";
import { RawRoomRuntime } from "./RawRoomRuntime";
import type { RawPlanInstance, RawRenderPlan } from "./RawWebGpuTypes";

const room = { id: "tool_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } };
const plan = {
  level: { id: "qa_key_visibility" },
  rooms: [room],
  lightingProfiles: [],
  visibilityScenarios: [],
} as unknown as RawRenderPlan;

const keyInstance = {
  id: "key-item:level_03_tool_chip",
  role: "key_item",
  roomId: "tool_room",
  modelKey: "pickup_large_yellow_key",
  position: [0, 0, 0],
  localOffset: [0, 0, 0],
  scale: [1, 1, 1],
  rotation: [0, 0, 0],
  estimatedBounds: { center: [0, 0.4, 0], halfSize: [0.3, 0.4, 0.3] },
  visibility: { type: "key-item", keyItemId: "level_03_tool_chip" },
  state: { keyItemId: "level_03_tool_chip" },
} as unknown as RawPlanInstance;

function createWorld(completedObjectiveIds: string[], collectedKeyItemIds: string[] = []) {
  const session = {
    mode: "playing",
    activeExitCinematic: null,
    activeFocusReveal: null,
    mapProgress: {
      currentRoomId: "tool_room",
      collectedKeyItemIds,
      completedInteractionIds: [],
      completedObjectiveIds,
      keyItemDropPositions: {},
      openedDoorIds: [],
    },
  };
  return {
    isDoorOpen: () => false,
    renderPerformance: { quality: { tier: "high" } },
    session,
    player: { position: { x: 0, y: 0, z: 0 } },
    pickups: [],
    level: {
      map: {
        keyItems: [
          {
            id: "level_03_tool_chip",
            roomId: "tool_room",
            position: [0, 0, 0],
            requiredForDoorIds: ["level_03_voice_door"],
            requiresObjectiveId: "obj_puzzle_level_03_tool_calibration",
          },
        ],
      },
    },
    isConfiguredKeyItemAvailable(item: { id: string; requiresObjectiveId?: string | null }) {
      return !item.requiresObjectiveId || session.mapProgress.completedObjectiveIds.includes(item.requiresObjectiveId);
    },
  };
}

describe("RawRoomRuntime key item visibility", () => {
  it("keeps Level 3 museum v3 lighting readable instead of clamping it back to the old dark profile", () => {
    const runtime = new RawRoomRuntime({
      level: { id: "level_03_human_museum" },
      rooms: [{ id: "level_03_gallery_lobby", bounds: { center: [0, 0, 0], size: [18, 4, 11] } }],
      instances: [],
      lightingProfiles: [
        {
          roomId: "level_03_gallery_lobby",
          artist: { exposure: 1.058746, contrast: 1.279631, saturation: 1.063236, warmth: 0.440824 },
          bounce: { floor: 0.112471, ceiling: 0.680973, side: 0.66, shadowDepth: 0.798979 },
          algorithm: {
            ao: 0.80161,
            probe: 0.94,
            material: 1.24,
            localLight: 1.024948,
            shadowReceiver: 0.713508,
            specular: 1.100362,
            contact: 0.945998,
            wallGuard: 0.832495,
          },
        },
      ],
      visibilityScenarios: [],
    } as unknown as RawRenderPlan);

    const frame = runtime.frame(createWorldForRoom("level_03_gallery_lobby") as any);

    expect(frame.lightingProfile.artist.exposure).toBeGreaterThan(1.04);
    expect(frame.lightingProfile.artist.contrast).toBeLessThanOrEqual(1.16);
    expect(frame.lightingProfile.bounce.floor).toBeGreaterThan(0.1);
    expect(frame.lightingProfile.bounce.ceiling).toBeGreaterThan(0.6);
    expect(frame.lightingProfile.bounce.side).toBeGreaterThan(0.5);
    expect(frame.lightingProfile.bounce.shadowDepth).toBeLessThanOrEqual(0.72);
    expect(frame.lightingProfile.algorithm.ao).toBeLessThanOrEqual(0.68);
    expect(frame.lightingProfile.algorithm.probe).toBeGreaterThan(0.9);
    expect(frame.lightingProfile.algorithm.material).toBeGreaterThan(1.2);
    expect(frame.lightingProfile.algorithm.wallGuard).toBeLessThanOrEqual(0.68);
  });

  it("hides configured key instances until their objective unlocks them", () => {
    const runtime = new RawRoomRuntime(plan);
    const visibleRooms = new Set(["tool_room"]);
    const visibleDoors = new Set<string>();

    expect(runtime.isPlanInstanceVisible(createWorld([]) as any, keyInstance, visibleRooms, visibleDoors)).toBe(false);
    expect(runtime.isPlanInstanceVisible(createWorld(["obj_puzzle_level_03_tool_calibration"]) as any, keyInstance, visibleRooms, visibleDoors)).toBe(true);
    expect(
      runtime.isPlanInstanceVisible(
        createWorld(["obj_puzzle_level_03_tool_calibration"], ["level_03_tool_chip"]) as any,
        keyInstance,
        visibleRooms,
        visibleDoors,
      ),
    ).toBe(false);
  });

  it("adds the other side of an opened door to the rendered room set", () => {
    const runtime = new RawRoomRuntime({
      level: { id: "qa_open_door_visibility" },
      rooms: [
        { id: "entry_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } },
        { id: "exit_elevator", bounds: { center: [0, 0, 8], size: [8, 4, 8] } },
      ],
      instances: [
        {
          id: "door_leaf_exit",
          role: "door_leaf",
          modelKey: "door_service_elevator",
          roomId: "entry_room",
          secondaryRoomId: "exit_elevator",
          position: [0, 0, 4],
          localOffset: [0, 0, 0],
          scale: [1, 1, 1],
          rotation: [0, 0, 0],
          estimatedBounds: { center: [0, 1.4, 4], halfSize: [1, 1.4, 0.2] },
          visibility: { type: "door", doorId: "exit_door" },
          state: { doorId: "exit_door" },
        } as unknown as RawPlanInstance,
      ],
      lightingProfiles: [],
      visibilityScenarios: [
        {
          id: "entry_room_high",
          currentRoomId: "entry_room",
          qualityTier: "high",
          visibleRoomIds: ["entry_room"],
          visibleDoorIds: [],
          visibleLightIds: [],
        },
      ],
    } as unknown as RawRenderPlan);

    const world = {
      isDoorOpen: (doorId: string) => doorId === "exit_door",
      renderPerformance: { quality: { tier: "high" } },
      session: {
        mode: "playing",
        activeExitCinematic: null,
        activeFocusReveal: null,
        mapProgress: {
          currentRoomId: "entry_room",
          collectedKeyItemIds: [],
          completedInteractionIds: [],
          completedObjectiveIds: [],
          keyItemDropPositions: {},
          openedDoorIds: ["exit_door"],
        },
      },
      player: { position: { x: 0, y: 0, z: 0 } },
    };

    const frame = runtime.frame(world as any);

    expect(frame.visibleRoomIds.has("entry_room")).toBe(true);
    expect(frame.visibleRoomIds.has("exit_elevator")).toBe(true);
    expect(frame.visibleDoorIds.has("exit_door")).toBe(true);
  });

  it("propagates visibility through a chain of opened doors", () => {
    const runtime = new RawRoomRuntime({
      level: { id: "qa_open_door_chain_visibility" },
      rooms: [
        { id: "entry_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } },
        { id: "lobby_room", bounds: { center: [0, 0, 8], size: [8, 4, 8] } },
        { id: "archive_room", bounds: { center: [0, 0, 16], size: [8, 4, 8] } },
      ],
      instances: [
        doorLeaf("door_leaf_lobby", "entry_room", "lobby_room", "door_lobby"),
        doorLeaf("door_leaf_archive", "lobby_room", "archive_room", "door_archive"),
      ],
      lightingProfiles: [],
      visibilityScenarios: [
        {
          id: "entry_room_high",
          currentRoomId: "entry_room",
          qualityTier: "high",
          visibleRoomIds: ["entry_room"],
          visibleDoorIds: [],
          visibleLightIds: [],
        },
      ],
    } as unknown as RawRenderPlan);
    const world = {
      isDoorOpen: (doorId: string) => doorId === "door_lobby" || doorId === "door_archive",
      renderPerformance: { quality: { tier: "high" } },
      session: {
        mode: "playing",
        activeExitCinematic: null,
        activeFocusReveal: null,
        mapProgress: {
          currentRoomId: "entry_room",
          collectedKeyItemIds: [],
          completedInteractionIds: [],
          completedObjectiveIds: [],
          keyItemDropPositions: {},
          openedDoorIds: ["door_lobby", "door_archive"],
        },
      },
      player: { position: { x: 0, y: 0, z: 0 } },
    };

    const frame = runtime.frame(world as any);

    expect(frame.visibleRoomIds.has("entry_room")).toBe(true);
    expect(frame.visibleRoomIds.has("lobby_room")).toBe(true);
    expect(frame.visibleRoomIds.has("archive_room")).toBe(true);
    expect(frame.visibleDoorIds.has("door_lobby")).toBe(true);
    expect(frame.visibleDoorIds.has("door_archive")).toBe(true);
  });

  it("keeps closed doors visible when their room becomes visible through an opened door", () => {
    const runtime = new RawRoomRuntime({
      level: { id: "qa_open_door_boundary_visibility" },
      rooms: [
        { id: "entry_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } },
        { id: "large_room", bounds: { center: [0, 0, 10], size: [16, 4, 12] } },
        { id: "far_room", bounds: { center: [0, 0, 22], size: [8, 4, 8] } },
      ],
      instances: [
        doorLeaf("door_leaf_large", "entry_room", "large_room", "door_large"),
        doorLeaf("door_leaf_far", "large_room", "far_room", "door_far"),
      ],
      lightingProfiles: [],
      visibilityScenarios: [
        {
          id: "entry_room_high",
          currentRoomId: "entry_room",
          qualityTier: "high",
          visibleRoomIds: ["entry_room"],
          visibleDoorIds: [],
          visibleLightIds: [],
        },
      ],
    } as unknown as RawRenderPlan);
    const world = {
      isDoorOpen: (doorId: string) => doorId === "door_large",
      renderPerformance: { quality: { tier: "high" } },
      session: {
        mode: "playing",
        activeExitCinematic: null,
        activeFocusReveal: null,
        mapProgress: {
          currentRoomId: "entry_room",
          collectedKeyItemIds: [],
          completedInteractionIds: [],
          completedObjectiveIds: [],
          keyItemDropPositions: {},
          openedDoorIds: ["door_large"],
        },
      },
      player: { position: { x: 0, y: 0, z: 0 } },
    };

    const frame = runtime.frame(world as any);

    expect(frame.visibleRoomIds.has("large_room")).toBe(true);
    expect(frame.visibleRoomIds.has("far_room")).toBe(false);
    expect(frame.visibleDoorIds.has("door_large")).toBe(true);
    expect(frame.visibleDoorIds.has("door_far")).toBe(true);
  });

  it("keeps both sides of a closed door visible during a door focus reveal", () => {
    const runtime = new RawRoomRuntime({
      level: { id: "qa_door_reveal_two_sided_visibility" },
      rooms: [
        { id: "control_room", bounds: { center: [0, 0, -10], size: [8, 4, 8] } },
        { id: "left_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } },
        { id: "right_room", bounds: { center: [0, 0, 8], size: [8, 4, 8] } },
      ],
      instances: [
        doorLeaf("door_leaf_reveal", "left_room", "right_room", "door_reveal"),
      ],
      lightingProfiles: [],
      visibilityScenarios: [
        {
          id: "control_room_high",
          currentRoomId: "control_room",
          qualityTier: "high",
          visibleRoomIds: ["control_room"],
          visibleDoorIds: [],
          visibleLightIds: [],
        },
      ],
    } as unknown as RawRenderPlan);
    const world = {
      isDoorOpen: () => false,
      renderPerformance: { quality: { tier: "high" } },
      session: {
        mode: "playing",
        activeExitCinematic: null,
        activeFocusReveal: {
          kind: "door",
          targetId: "door_reveal",
          doorMode: "close",
          roomId: "right_room",
          elapsed: 0,
          duration: 2,
          targetPosition: [0, 1.4, 4],
          cameraPosition: [0, 1.5, 7],
          cameraCut: true,
        },
        mapProgress: {
          currentRoomId: "control_room",
          collectedKeyItemIds: [],
          completedInteractionIds: [],
          completedObjectiveIds: [],
          keyItemDropPositions: {},
          openedDoorIds: [],
        },
      },
      player: { position: { x: 0, y: 0, z: -10 } },
    };

    const frame = runtime.frame(world as any);

    expect(frame.visibleRoomIds.has("control_room")).toBe(true);
    expect(frame.visibleRoomIds.has("left_room")).toBe(true);
    expect(frame.visibleRoomIds.has("right_room")).toBe(true);
    expect(frame.visibleDoorIds.has("door_reveal")).toBe(true);
  });

  it("does not draw the old Level 3 hero floor for builder surface bridge plans", () => {
    const runtime = new RawRoomRuntime({
      level: { id: "level_03_human_museum" },
      officialBuilderSurfaceBridge: {
        enabled: true,
        reason: "builder-runtime-pack-surfaces",
        roomIds: ["level_03_gallery_lobby"],
        surfaceAssetKeys: ["builder:floor:level_03_gallery_lobby"],
        insertedInstances: 1,
        removedShellInstances: 0,
        prunedShellAssets: 0,
      },
      rooms: [{ id: "level_03_gallery_lobby", bounds: { center: [0, 0, 0], size: [18, 4, 11] } }],
      instances: [],
      lightingProfiles: [],
      visibilityScenarios: [],
    } as unknown as RawRenderPlan);

    expect(runtime.shouldDrawHeroFloor(createWorldForRoom("level_03_gallery_lobby") as any)).toBe(false);
  });

  it("uses room visibility for dynamic world positions", () => {
    const runtime = new RawRoomRuntime({
      level: { id: "qa_dynamic_visibility" },
      rooms: [
        { id: "entry_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } },
        { id: "lobby_room", bounds: { center: [0, 0, 8], size: [8, 4, 8] } },
      ],
      instances: [],
      lightingProfiles: [],
      visibilityScenarios: [],
    } as unknown as RawRenderPlan);
    const visibleRooms = new Set(["entry_room"]);

    expect(runtime.isWorldPositionVisible(0, 0, visibleRooms)).toBe(true);
    expect(runtime.isWorldPositionVisible(0, 8, visibleRooms)).toBe(false);
    expect(runtime.isWorldPositionVisible(40, 40, visibleRooms)).toBe(true);
  });
});

function doorLeaf(id: string, roomId: string, secondaryRoomId: string, doorId: string) {
  return {
    id,
    role: "door_leaf",
    modelKey: "door_service_elevator",
    roomId,
    secondaryRoomId,
    position: [0, 0, 4],
    localOffset: [0, 0, 0],
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    estimatedBounds: { center: [0, 1.4, 4], halfSize: [1, 1.4, 0.2] },
    visibility: { type: "door", doorId },
    state: { doorId },
  } as unknown as RawPlanInstance;
}

function createWorldForRoom(roomId: string) {
  return {
    isDoorOpen: () => false,
    renderPerformance: { quality: { tier: "high" } },
    session: {
      mode: "playing",
      activeExitCinematic: null,
      activeFocusReveal: null,
      mapProgress: {
        currentRoomId: roomId,
        collectedKeyItemIds: [],
        completedInteractionIds: [],
        completedObjectiveIds: [],
        keyItemDropPositions: {},
        openedDoorIds: [],
      },
    },
    player: { position: { x: 0, y: 0, z: 0 } },
    pickups: [],
    level: { map: { keyItems: [] } },
  };
}
