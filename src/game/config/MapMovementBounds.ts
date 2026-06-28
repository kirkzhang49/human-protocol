import { gameBalance } from "./gameBalance";
import type { LevelDefinition } from "./schema/levelConfig";

export interface MovementBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const movementBoundsCache = new WeakMap<LevelDefinition, Map<number, MovementBounds>>();

export function movementBoundsForLevel(level: LevelDefinition, radius: number): MovementBounds {
  const cacheKey = Math.round(radius * 1000);
  const cached = movementBoundsCache.get(level)?.get(cacheKey);
  if (cached) return cached;
  const bounds = computeMovementBoundsForLevel(level, radius);
  let levelCache = movementBoundsCache.get(level);
  if (!levelCache) {
    levelCache = new Map();
    movementBoundsCache.set(level, levelCache);
  }
  levelCache.set(cacheKey, bounds);
  return bounds;
}

function computeMovementBoundsForLevel(level: LevelDefinition, radius: number): MovementBounds {
  const rooms = level.map?.rooms;
  if (!rooms?.length) {
    const limit = gameBalance.arenaHalfSize - radius;
    return { minX: -limit, maxX: limit, minZ: -limit, maxZ: limit };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const room of rooms) {
    const [cx, , cz] = room.bounds.center;
    const [sx, , sz] = room.bounds.size;
    minX = Math.min(minX, cx - sx / 2 + radius);
    maxX = Math.max(maxX, cx + sx / 2 - radius);
    minZ = Math.min(minZ, cz - sz / 2 + radius);
    maxZ = Math.max(maxZ, cz + sz / 2 - radius);
  }

  if (minX > maxX || minZ > maxZ) {
    const limit = gameBalance.arenaHalfSize - radius;
    return { minX: -limit, maxX: limit, minZ: -limit, maxZ: limit };
  }

  return { minX, maxX, minZ, maxZ };
}
