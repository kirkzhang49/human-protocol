import type { LevelRoomDefinition } from "../config/schema/levelConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { isRoomReachableThroughOpenDoors } from "../core/RoomReachability";

export class RoomDirectorSystem implements GameSystem {
  update(world: GameWorld) {
    if (world.session.mode !== "playing") return;

    const room = roomAtPlayer(world);
    const previousRoomId = world.session.mapProgress.currentRoomId;
    const roomChanged = Boolean(room && previousRoomId !== room.id);
    world.setCurrentRoom(room?.id ?? null);

    if (room && roomChanged) {
      const clueShown = world.revealRoomClue(room.id);
      if (!clueShown && previousRoomId) {
        world.setSpawnWarning({ label: room.label, detail: roomMoodDetail(room) }, 1.45);
      }
      if (room.mood === "reveal") {
        world.applyCameraImpact(0.18, 1.4, 0.04, 0.12);
      }
    }
  }
}

function roomAtPlayer(world: GameWorld): LevelRoomDefinition | null {
  const rooms = world.level.map?.rooms;
  if (!rooms?.length) return null;

  const { x, z } = world.player.position;
  const currentRoomId = world.session.mapProgress.currentRoomId;
  const containingRooms: LevelRoomDefinition[] = [];
  for (const room of rooms) {
    const [cx, , cz] = room.bounds.center;
    const [sx, , sz] = room.bounds.size;
    if (Math.abs(x - cx) <= sx / 2 && Math.abs(z - cz) <= sz / 2) {
      containingRooms.push(room);
    }
  }

  const currentContainingRoom = containingRooms.find((room) => room.id === currentRoomId);
  if (currentContainingRoom) return currentContainingRoom;
  const reachableContainingRoom = containingRooms.find((room) => isRoomReachableThroughOpenDoors(world, room.id));
  if (reachableContainingRoom) return reachableContainingRoom;
  if (containingRooms.length > 0 && !currentRoomId) return containingRooms[0];

  return nearestRoom(world);
}

function nearestRoom(world: GameWorld): LevelRoomDefinition | null {
  const rooms = world.level.map?.rooms;
  if (!rooms?.length) return null;

  let best = rooms[0];
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  const currentRoom = rooms.find((room) => room.id === world.session.mapProgress.currentRoomId) ?? null;
  for (const room of rooms) {
    if (world.session.mapProgress.currentRoomId && !isRoomReachableThroughOpenDoors(world, room.id)) continue;
    const dx = world.player.position.x - room.bounds.center[0];
    const dz = world.player.position.z - room.bounds.center[2];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq) {
      best = room;
      bestDistanceSq = distanceSq;
    }
  }
  return Number.isFinite(bestDistanceSq) ? best : currentRoom ?? best;
}

function roomMoodDetail(room: LevelRoomDefinition) {
  if (room.mood === "quiet") return "信号降低，先观察";
  if (room.mood === "uneasy") return "门禁环境改变";
  if (room.mood === "combat") return "维修单位可能接近";
  if (room.mood === "boss") return "重型维护平台在线";
  return "异常记忆回声";
}
