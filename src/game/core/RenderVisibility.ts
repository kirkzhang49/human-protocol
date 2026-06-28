import type { LevelDoorDefinition, LevelMapConfig, LevelObjectiveGuidanceDefinition } from "../config/schema/levelConfig";
import type { GameWorld } from "./GameWorld";

const BALANCED_NEAR_ROOM_DISTANCE_SQ = 12 * 12;
const HIGH_NEAR_ROOM_DISTANCE_SQ = 14 * 14;
const DOOR_NEAR_PLAYER_DISTANCE_SQ = 22 * 22;

interface RenderVisibilityMapCache {
  adjacentRoomIds: Map<string, Set<string>>;
  roomById: Map<string, LevelMapConfig["rooms"][number]>;
}

const mapVisibilityCache = new WeakMap<LevelMapConfig, RenderVisibilityMapCache>();

export function isRoomRenderVisible(world: GameWorld, roomId: string | undefined) {
  if (!roomId) return true;
  const map = world.level.map;
  if (!map) return true;

  const currentRoomId = world.session.mapProgress.currentRoomId;
  if (!currentRoomId || roomId === currentRoomId) return true;
  if (isFocusRevealRoom(world, map, roomId)) return true;
  if (isRoomAdjacentTo(map, currentRoomId, roomId)) return true;
  if (isActiveCriticalRoom(world, roomId)) return true;

  const tier = world.renderPerformance.quality.tier;
  if (tier === "rescue") return false;

  const distanceSq = roomCenterDistanceSqToPlayer(world, map, roomId);
  if (distanceSq === null) return true;
  return distanceSq <= (tier === "high" ? HIGH_NEAR_ROOM_DISTANCE_SQ : BALANCED_NEAR_ROOM_DISTANCE_SQ);
}

export function isDoorRenderVisible(world: GameWorld, door: LevelDoorDefinition) {
  const map = world.level.map;
  if (!map) return true;
  const currentRoomId = world.session.mapProgress.currentRoomId;
  if (!currentRoomId) return true;
  if (door.fromRoomId === currentRoomId || door.toRoomId === currentRoomId) return true;
  if (isRoomRenderVisible(world, door.fromRoomId) || isRoomRenderVisible(world, door.toRoomId)) return true;

  const dx = door.position[0] - world.player.position.x;
  const dz = door.position[2] - world.player.position.z;
  return dx * dx + dz * dz <= DOOR_NEAR_PLAYER_DISTANCE_SQ;
}

export function isRoomAdjacentToCurrent(world: GameWorld, roomId: string | undefined) {
  if (!roomId) return true;
  const map = world.level.map;
  const currentRoomId = world.session.mapProgress.currentRoomId;
  if (!map || !currentRoomId) return true;
  return roomId === currentRoomId || isRoomAdjacentTo(map, currentRoomId, roomId);
}

export function roomCenterDistanceSqToPlayer(world: GameWorld, map: LevelMapConfig, roomId: string | undefined) {
  if (!roomId) return 0;
  const room = renderVisibilityCacheFor(map).roomById.get(roomId);
  if (!room) return null;
  const dx = room.bounds.center[0] - world.player.position.x;
  const dz = room.bounds.center[2] - world.player.position.z;
  return dx * dx + dz * dz;
}

function isRoomAdjacentTo(map: LevelMapConfig, fromRoomId: string, toRoomId: string) {
  return Boolean(renderVisibilityCacheFor(map).adjacentRoomIds.get(fromRoomId)?.has(toRoomId));
}

function isActiveCriticalRoom(world: GameWorld, roomId: string) {
  const map = world.level.map;
  if (!map) return false;

  const activeObjective = world.activeObjective();
  if (activeObjective?.guidance && guidanceTargetsRoom(world, activeObjective.guidance, roomId)) return true;
  for (const requiredId of activeObjective?.requiredIds ?? []) {
    if (requiredIdTargetsRoom(world, requiredId, roomId)) return true;
  }

  return world.session.exitUnlocked && map.interactions.some((interaction) => interaction.type === "exit" && interaction.roomId === roomId);
}

function isFocusRevealRoom(world: GameWorld, map: LevelMapConfig, roomId: string) {
  const reveal = world.session.activeFocusReveal;
  if (!reveal) return false;
  if (reveal.roomId === roomId) return true;
  if (reveal.kind !== "door" || !reveal.targetId) return false;
  return map.doors.some((door) => door.id === reveal.targetId && (door.fromRoomId === roomId || door.toRoomId === roomId));
}

function guidanceTargetsRoom(world: GameWorld, guidance: LevelObjectiveGuidanceDefinition, roomId: string) {
  return targetTargetsRoom(world, guidance.targetType, guidance.targetId, roomId);
}

function requiredIdTargetsRoom(world: GameWorld, requiredId: string, roomId: string) {
  return (
    targetTargetsRoom(world, "room", requiredId, roomId) ||
    targetTargetsRoom(world, "door", requiredId, roomId) ||
    targetTargetsRoom(world, "key_item", requiredId, roomId) ||
    targetTargetsRoom(world, "interaction", requiredId, roomId) ||
    targetTargetsRoom(world, "puzzle", requiredId, roomId) ||
    targetTargetsRoom(world, "wave", requiredId, roomId)
  );
}

function targetTargetsRoom(world: GameWorld, targetType: LevelObjectiveGuidanceDefinition["targetType"], targetId: string | undefined, roomId: string) {
  const map = world.level.map;
  if (!map) return false;
  if (targetType === "exit") return map.interactions.some((interaction) => interaction.type === "exit" && interaction.roomId === roomId);
  if (!targetId) return false;
  if (targetType === "room") return targetId === roomId;
  if (targetType === "door") {
    return map.doors.some((door) => door.id === targetId && (door.fromRoomId === roomId || door.toRoomId === roomId));
  }
  if (targetType === "key_item") {
    return map.keyItems.some(
      (item) => item.id === targetId && item.roomId === roomId && !world.session.mapProgress.collectedKeyItemIds.includes(item.id) && world.isConfiguredKeyItemAvailable(item),
    );
  }
  if (targetType === "interaction") {
    return map.interactions.some((interaction) => interaction.id === targetId && interaction.roomId === roomId);
  }
  if (targetType === "puzzle") {
    return (world.level.puzzles ?? []).some((puzzle) => {
      if (puzzle.id !== targetId) return false;
      if (puzzle.roomId === roomId) return true;
      if (puzzle.type === "hit_sequence") {
        if (puzzle.clue.roomId === roomId) return true;
        if (puzzle.clue.surfaces?.some((surface) => surface.roomId === roomId)) return true;
        return puzzle.targets.some((target) => target.roomId === roomId);
      }
      if (puzzle.type !== "code_lock") return false;
      return puzzle.clues.some((clue) => clue.roomId === roomId);
    });
  }
  return false;
}

function renderVisibilityCacheFor(map: LevelMapConfig): RenderVisibilityMapCache {
  const cached = mapVisibilityCache.get(map);
  if (cached) return cached;

  const adjacentRoomIds = new Map<string, Set<string>>();
  const roomById = new Map<string, LevelMapConfig["rooms"][number]>();

  for (const room of map.rooms) {
    roomById.set(room.id, room);
  }
  for (const door of map.doors) {
    addAdjacentRoom(adjacentRoomIds, door.fromRoomId, door.toRoomId);
    addAdjacentRoom(adjacentRoomIds, door.toRoomId, door.fromRoomId);
  }

  const cache = { adjacentRoomIds, roomById };
  mapVisibilityCache.set(map, cache);
  return cache;
}

function addAdjacentRoom(adjacency: Map<string, Set<string>>, fromRoomId: string, toRoomId: string) {
  let linkedRooms = adjacency.get(fromRoomId);
  if (!linkedRooms) {
    linkedRooms = new Set();
    adjacency.set(fromRoomId, linkedRooms);
  }
  linkedRooms.add(toRoomId);
}
