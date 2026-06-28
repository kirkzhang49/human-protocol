import { Vector3 } from "three";
import { createPropCollisionProxies, createRoomWallSegments } from "../config/MapGeometry";
import type { LevelDoorDefinition } from "../config/schema/levelConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { resolveDoorVisual } from "../visual/AssetResolver";

const doorObstaclePrefix = "door:";
const propObstaclePrefix = "prop:";
const roomWallObstaclePrefix = "room-wall:";

export class DoorSystem implements GameSystem {
  private staticCollisionRevision = -1;
  private staticCollisionObstacleCount = 0;

  update(world: GameWorld) {
    let obstacleChanged = false;

    if (this.shouldSyncStaticCollisions(world)) {
      obstacleChanged = this.syncRoomWallCollisions(world) || obstacleChanged;
      obstacleChanged = this.syncPropCollisions(world) || obstacleChanged;
      this.staticCollisionRevision = world.levelRevision;
      this.staticCollisionObstacleCount = countStaticCollisionObstacles(world);
    }

    const doors = world.level.map?.doors;
    if (!doors?.length) {
      if (obstacleChanged) world.markObstacleIndexDirty();
      return;
    }

    for (const door of doors) {
      if (shouldAutoOpenUnlockedDoor(world, door)) {
        world.openConfiguredDoor(door.id);
      } else if (shouldAutoCloseUnlockedDoor(world, door)) {
        world.closeConfiguredDoor(door.id);
      }
      obstacleChanged = this.syncDoorCollision(world, door) || obstacleChanged;
    }
    if (obstacleChanged) world.markObstacleIndexDirty();
  }

  private shouldSyncStaticCollisions(world: GameWorld) {
    if (this.staticCollisionRevision !== world.levelRevision) return true;
    return this.staticCollisionObstacleCount > 0 && world.obstacles.length === 0;
  }

  private syncRoomWallCollisions(world: GameWorld) {
    let changed = false;
    const wallSegments = createRoomWallSegments(world.level, (room) => Boolean(room.geometry?.collisionWalls));
    const liveIds = new Set(wallSegments.map((segment) => `${roomWallObstaclePrefix}${segment.id}`));

    for (let index = world.obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = world.obstacles[index];
      if (obstacle.id.startsWith(roomWallObstaclePrefix) && !liveIds.has(obstacle.id)) {
        world.obstacles.splice(index, 1);
        changed = true;
      }
    }

    for (const segment of wallSegments) {
      const obstacleId = `${roomWallObstaclePrefix}${segment.id}`;
      if (world.obstacles.some((obstacle) => obstacle.id === obstacleId)) continue;
      world.obstacles.push({
        id: obstacleId,
        visualKey: "generated_room_wall",
        position: new Vector3(...segment.position),
        halfSize: new Vector3(segment.size[0] / 2, segment.size[1] / 2, segment.size[2] / 2),
        ...(segment.yaw ? { yaw: segment.yaw } : {}),
      });
      changed = true;
    }
    return changed;
  }

  private syncPropCollisions(world: GameWorld) {
    let changed = false;
    const proxies = createPropCollisionProxies(world.level);
    const liveIds = new Set(proxies.map((proxy) => `${propObstaclePrefix}${proxy.id}`));

    for (let index = world.obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = world.obstacles[index];
      if (obstacle.id.startsWith(propObstaclePrefix) && !liveIds.has(obstacle.id)) {
        world.obstacles.splice(index, 1);
        changed = true;
      }
    }

    for (const proxy of proxies) {
      const obstacleId = `${propObstaclePrefix}${proxy.id}`;
      const position = new Vector3(...proxy.position);
      const halfSize = new Vector3(...proxy.halfSize);
      const existing = world.obstacles.find((obstacle) => obstacle.id === obstacleId);
      if (existing) {
        if (!existing.position.equals(position) || !existing.halfSize.equals(halfSize) || existing.visualKey !== proxy.modelKey || existing.enemyNavigation !== proxy.enemyNavigation) {
          existing.position.copy(position);
          existing.halfSize.copy(halfSize);
          existing.visualKey = proxy.modelKey;
          existing.enemyNavigation = proxy.enemyNavigation;
          changed = true;
        }
        continue;
      }
      world.obstacles.push({
        id: obstacleId,
        visualKey: proxy.modelKey,
        position,
        halfSize,
        ...(proxy.enemyNavigation ? { enemyNavigation: proxy.enemyNavigation } : {}),
      });
      changed = true;
    }
    return changed;
  }

  private syncDoorCollision(world: GameWorld, door: LevelDoorDefinition) {
    const obstacleId = `${doorObstaclePrefix}${door.id}`;
    const index = world.obstacles.findIndex((obstacle) => obstacle.id === obstacleId);
    if (world.isDoorOpen(door.id)) {
      if (index >= 0) {
        world.obstacles.splice(index, 1);
        return true;
      }
      return false;
    }

    if (index >= 0) return false;
    const halfSize = doorObstacleHalfSize(door);
    world.obstacles.push({
      id: obstacleId,
      visualKey: resolveDoorVisual(door).visualKey,
      position: new Vector3(door.position[0], Math.max(0.35, door.size[1] * 0.25), door.position[2]),
      halfSize,
      // Oriented collider follows the door's wall angle. For the cardinal doors
      // in every existing level (yaw 0 / π/2) this matches the old AABB exactly.
      ...(door.yaw ? { yaw: door.yaw } : {}),
    });
    return true;
  }
}

function countStaticCollisionObstacles(world: GameWorld) {
  let count = 0;
  for (const obstacle of world.obstacles) {
    if (obstacle.id.startsWith(roomWallObstaclePrefix) || obstacle.id.startsWith(propObstaclePrefix)) count += 1;
  }
  return count;
}

function doorObstacleHalfSize(door: LevelDoorDefinition) {
  // True local half-extents; the obstacle carries door.yaw so collision rotates
  // the box. For cardinal doors (yaw 0 / π/2) this covers the same region as the
  // previous rotated-AABB form.
  const [sx, sy, sz] = door.size;
  return new Vector3(Math.max(0.15, sx / 2), Math.max(0.35, sy / 2), Math.max(0.12, sz / 2));
}

function shouldAutoOpenUnlockedDoor(world: GameWorld, door: LevelDoorDefinition) {
  if (door.defaultState !== "closed") return false;
  if (door.lock.type !== "none") return false;
  if (world.isDoorOpen(door.id) || !world.canOpenDoor(door)) return false;
  return doorInteractionDistanceSq(world, door) <= unlockedDoorAutoOpenRadius(door) ** 2;
}

function shouldAutoCloseUnlockedDoor(world: GameWorld, door: LevelDoorDefinition) {
  if (door.defaultState !== "closed") return false;
  if (door.lock.type !== "none") return false;
  if (!world.isDoorOpen(door.id)) return false;
  const closeRadius = unlockedDoorAutoOpenRadius(door) + 1.15;
  if (doorInteractionDistanceSq(world, door) <= closeRadius * closeRadius) return false;
  return !actorNearDoor(world, door, closeRadius);
}

function unlockedDoorAutoOpenRadius(door: LevelDoorDefinition) {
  return Math.max(1.55, Math.min(2.85, Math.max(door.size[0], door.size[2]) * 0.24 + 1.15));
}

function actorNearDoor(world: GameWorld, door: LevelDoorDefinition, radius: number) {
  if (doorActorDistanceSq(world.player.position, door) <= radius * radius) return true;
  return world.enemies.some((enemy) => enemy.isAlive && doorActorDistanceSq(enemy.position, door) <= (radius + enemy.radius + 0.25) ** 2);
}

function doorInteractionDistanceSq(world: GameWorld, door: LevelDoorDefinition) {
  return doorActorDistanceSq(world.player.position, door);
}

function doorActorDistanceSq(position: Vector3, door: LevelDoorDefinition) {
  const dx = position.x - door.position[0];
  const dz = position.z - door.position[2];
  const cos = Math.cos(door.yaw);
  const sin = Math.sin(door.yaw);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  const halfWidth = door.size[0] / 2 + 0.7;
  const halfDepth = Math.max(door.size[2] / 2, 0.36) + 1.35;
  const outsideX = Math.max(0, Math.abs(localX) - halfWidth);
  const outsideZ = Math.max(0, Math.abs(localZ) - halfDepth);
  return outsideX * outsideX + outsideZ * outsideZ;
}
