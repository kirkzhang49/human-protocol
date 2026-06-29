import RAPIER, { type Collider, type World } from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import type { ObstacleState } from "../entities/EntityTypes";
import type {
  PhysicsDebugSnapshot,
  PhysicsKinematicCircleMove,
  PhysicsKinematicMoveResult,
  PhysicsSegmentQuery,
  PhysicsWorldAdapter,
} from "./PhysicsWorldAdapter";

interface StaticColliderEntry {
  obstacle: ObstacleState;
  collider: Collider;
}

const identityRotation = { x: 0, y: 0, z: 0, w: 1 };
const minimumMoveDistanceSq = 0.000001;

export class RapierPhysicsWorldAdapter implements PhysicsWorldAdapter {
  readonly mode = "rapier" as const;

  private world: World | null = null;
  private initialized = false;
  private staticSignature = "";
  private readonly staticColliders = new Map<string, StaticColliderEntry>();
  private readonly obstacleByColliderHandle = new Map<number, ObstacleState>();
  private lastSyncMs = 0;
  private lastMoveMs = 0;
  private lastQueryMs = 0;
  private lastStepMs = 0;
  private lastError: string | undefined;

  get ready() {
    return this.initialized && Boolean(this.world);
  }

  async init() {
    if (this.ready) return true;
    try {
      await RAPIER.init();
      this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
      this.initialized = true;
      this.lastError = undefined;
      return true;
    } catch (error) {
      this.world = null;
      this.initialized = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  syncStaticObstacles(obstacles: readonly ObstacleState[]) {
    if (!this.world) return;
    const signature = staticObstacleSignature(obstacles);
    if (signature === this.staticSignature) return;

    const startedAt = nowMs();
    this.staticSignature = signature;
    for (const entry of this.staticColliders.values()) {
      this.world.removeCollider(entry.collider, false);
    }
    this.staticColliders.clear();
    this.obstacleByColliderHandle.clear();

    for (const obstacle of obstacles) {
      const desc = RAPIER.ColliderDesc
        .cuboid(obstacle.halfSize.x, obstacle.halfSize.y, obstacle.halfSize.z)
        .setTranslation(obstacle.position.x, obstacle.position.y, obstacle.position.z)
        .setRotation(yawRotation(obstacle.yaw ?? 0));
      const collider = this.world.createCollider(desc);
      this.staticColliders.set(obstacle.id, { obstacle, collider });
      this.obstacleByColliderHandle.set(collider.handle, obstacle);
    }

    this.world.step();
    this.lastSyncMs = nowMs() - startedAt;
  }

  isSegmentBlocked(query: PhysicsSegmentQuery) {
    if (!this.world) return false;
    const startedAt = nowMs();
    const delta = query.end.clone().sub(query.start);
    if (delta.lengthSq() <= minimumMoveDistanceSq) return false;

    const filterPredicate = this.filterPredicate(query.filter);
    const radius = query.radius ?? 0;
    const blocked = radius > 0.0001
      ? Boolean(
          this.world.castShape(
            toRapierVector(query.start),
            identityRotation,
            toRapierVector(delta),
            new RAPIER.Ball(radius),
            0.001,
            1,
            true,
            undefined,
            undefined,
            undefined,
            undefined,
            filterPredicate,
          ),
        )
      : Boolean(
          this.world.castRay(
            new RAPIER.Ray(toRapierVector(query.start), toRapierVector(delta)),
            1,
            true,
            undefined,
            undefined,
            undefined,
            undefined,
            filterPredicate,
          ),
        );
    this.lastQueryMs = nowMs() - startedAt;
    return blocked;
  }

  moveKinematicCircle(move: PhysicsKinematicCircleMove): PhysicsKinematicMoveResult {
    if (!this.world) {
      const translation = move.desiredTranslation.clone();
      return {
        position: move.position.clone().add(translation),
        translation,
        blocked: false,
      };
    }

    const startedAt = nowMs();
    const characterShape = shapeForGroundedCharacter(move.radius, move.height);
    const center = shapeCenterForGroundedShape(move.position, characterShape.groundOffsetY);
    const remaining = move.desiredTranslation.clone();
    const filterPredicate = this.filterPredicate(move.filter);
    let blocked = false;

    for (let iteration = 0; iteration < 3; iteration += 1) {
      if (remaining.lengthSq() <= minimumMoveDistanceSq) break;
      const hit = this.world.castShape(
        toRapierVector(center),
        identityRotation,
        toRapierVector(remaining),
        characterShape.shape,
        0.001,
        1,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        filterPredicate,
      );
      if (!hit) {
        center.add(remaining);
        remaining.set(0, 0, 0);
        break;
      }

      blocked = true;
      const distance = Math.max(0.001, remaining.length());
      const safeToi = Math.max(0, Math.min(1, hit.time_of_impact - 0.002 / distance));
      const applied = remaining.clone().multiplyScalar(safeToi);
      center.add(applied);
      remaining.sub(applied);

      const normal = new Vector3(hit.normal1.x, 0, hit.normal1.z);
      if (normal.lengthSq() <= minimumMoveDistanceSq) {
        remaining.set(0, 0, 0);
        break;
      }
      normal.normalize();
      const intoSurface = remaining.dot(normal);
      if (intoSurface < 0) remaining.addScaledVector(normal, -intoSurface);
      center.addScaledVector(normal, 0.001);
    }

    const position = new Vector3(center.x, center.y - characterShape.groundOffsetY, center.z);
    const translation = position.clone().sub(move.position);
    this.lastMoveMs = nowMs() - startedAt;
    return { position, translation, blocked };
  }

  step(delta: number) {
    if (!this.world || delta <= 0) return;
    const startedAt = nowMs();
    this.world.timestep = Math.min(1 / 20, Math.max(1 / 120, delta));
    this.world.step();
    this.lastStepMs = nowMs() - startedAt;
  }

  debugSnapshot(): PhysicsDebugSnapshot {
    return {
      mode: this.mode,
      ready: this.ready,
      staticColliderCount: this.staticColliders.size,
      lastSyncMs: this.lastSyncMs,
      lastMoveMs: this.lastMoveMs,
      lastQueryMs: this.lastQueryMs,
      lastStepMs: this.lastStepMs,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  private filterPredicate(filter: PhysicsSegmentQuery["filter"]) {
    if (!filter) return undefined;
    return (collider: Collider) => {
      const obstacle = this.obstacleByColliderHandle.get(collider.handle);
      return obstacle ? filter(obstacle) : false;
    };
  }
}

export function createRapierPhysicsWorldAdapter() {
  return new RapierPhysicsWorldAdapter();
}

function toRapierVector(vector: Vector3) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function yawRotation(yaw: number) {
  if (Math.abs(yaw) <= 0.000001) return identityRotation;
  const halfYaw = yaw * 0.5;
  return { x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) };
}

function shapeCenterForGroundedShape(position: Vector3, groundOffsetY: number) {
  return new Vector3(position.x, position.y + groundOffsetY, position.z);
}

function shapeForGroundedCharacter(radius: number, height?: number) {
  const safeRadius = Math.max(0.001, radius);
  const totalHeight = Math.max(safeRadius * 2, height ?? safeRadius * 2);
  const capsuleHalfHeight = Math.max(0, totalHeight * 0.5 - safeRadius);
  return {
    shape: capsuleHalfHeight > 0.0001
      ? new RAPIER.Capsule(capsuleHalfHeight, safeRadius)
      : new RAPIER.Ball(safeRadius),
    groundOffsetY: safeRadius + capsuleHalfHeight,
  };
}

function staticObstacleSignature(obstacles: readonly ObstacleState[]) {
  let hash = 2166136261;
  for (const obstacle of obstacles) {
    hash = mixString(hash, obstacle.id);
    hash = mixNumber(hash, obstacle.position.x);
    hash = mixNumber(hash, obstacle.position.y);
    hash = mixNumber(hash, obstacle.position.z);
    hash = mixNumber(hash, obstacle.halfSize.x);
    hash = mixNumber(hash, obstacle.halfSize.y);
    hash = mixNumber(hash, obstacle.halfSize.z);
    hash = mixNumber(hash, obstacle.yaw ?? 0);
    hash = mixString(hash, obstacle.enemyNavigation ?? "solid");
  }
  return `${obstacles.length}:${hash >>> 0}`;
}

function mixString(hash: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash;
}

function mixNumber(hash: number, value: number) {
  hash ^= Math.round(value * 1000);
  return Math.imul(hash, 16777619);
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
