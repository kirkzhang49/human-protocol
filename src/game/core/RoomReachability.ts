import type { GameWorld } from "./GameWorld";
import type { EnemyState } from "../entities/EnemyState";

export function isRoomReachableThroughOpenDoors(world: GameWorld, targetRoomId: string | null | undefined) {
  if (!targetRoomId) return true;
  const map = world.level.map;
  const currentRoomId = world.session.mapProgress.currentRoomId;
  if (!map) return true;
  if (!currentRoomId) return false;
  if (targetRoomId === currentRoomId) return true;

  const visited = new Set<string>([currentRoomId]);
  const queue = [currentRoomId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const door of map.doors) {
      if (!world.isDoorOpen(door.id)) continue;
      const next = door.fromRoomId === current ? door.toRoomId : door.toRoomId === current ? door.fromRoomId : null;
      if (!next || visited.has(next)) continue;
      if (next === targetRoomId) return true;
      visited.add(next);
      queue.push(next);
    }
  }

  return false;
}

export function isRoomVisibleForEnemy(world: GameWorld, roomId: string | null | undefined) {
  if (!roomId) return true;
  if (isRoomReachableThroughOpenDoors(world, roomId)) return true;
  return isRoomInActiveFocusReveal(world, roomId);
}

export function isEnemyVisibleToPlayerRoom(world: GameWorld, enemy: EnemyState) {
  return !enemy.spawnRoomId || isRoomVisibleForEnemy(world, enemy.spawnRoomId);
}

export function isRoomInActiveFocusReveal(world: GameWorld, roomId: string) {
  const reveal = world.session.activeFocusReveal;
  if (!reveal) return false;
  if (reveal.roomId === roomId) return true;
  if (reveal.kind !== "door" || !reveal.targetId) return false;

  return Boolean(
    world.level.map?.doors.some(
      (door) => door.id === reveal.targetId && (door.fromRoomId === roomId || door.toRoomId === roomId),
    ),
  );
}
