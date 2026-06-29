import RAPIER, { type Collider, type RigidBody, type Shape, type World } from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import type { ObstacleState } from "../entities/EntityTypes";
import type {
  PhysicsDebugSnapshot,
  PhysicsDynamicBodySnapshot,
  PhysicsDynamicPropBody,
  PhysicsKinematicCircleMove,
  PhysicsKinematicMoveResult,
  PhysicsSegmentQuery,
  PhysicsWorldAdapter,
} from "./PhysicsWorldAdapter";

interface StaticColliderEntry {
  obstacle: ObstacleState;
  collider: Collider;
}

interface DynamicBodyEntry {
  body: RigidBody;
  halfSizeKey: string;
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
  private readonly dynamicBodies = new Map<string, DynamicBodyEntry>();
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
      await initRapierCompat();
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
    const remaining = planarTranslation(move.desiredTranslation);
    const filterPredicate = this.filterPredicate(move.filter);
    let blocked = this.recoverKinematicOverlap(center, characterShape.shape, filterPredicate);

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

    const position = new Vector3(center.x, move.position.y, center.z);
    const translation = position.clone().sub(move.position);
    this.lastMoveMs = nowMs() - startedAt;
    return { position, translation, blocked };
  }

  syncDynamicPropBodies(bodies: readonly PhysicsDynamicPropBody[]) {
    if (!this.world) return;
    const nextIds = new Set(bodies.map((body) => body.id));
    for (const [id, entry] of this.dynamicBodies) {
      if (nextIds.has(id)) continue;
      this.world.removeRigidBody(entry.body);
      this.dynamicBodies.delete(id);
    }

    for (const body of bodies) {
      const halfSizeKey = dynamicBodyHalfSizeKey(body.halfSize);
      const existing = this.dynamicBodies.get(body.id);
      if (existing && existing.halfSizeKey !== halfSizeKey) {
        this.world.removeRigidBody(existing.body);
        this.dynamicBodies.delete(body.id);
      }

      const entry = this.dynamicBodies.get(body.id) ?? this.createDynamicPropBody(body, halfSizeKey);
      entry.body.setTranslation(toRapierVector(body.position), false);
      entry.body.setRotation(yawRotation(body.yaw ?? 0), false);
    }
  }

  applyDynamicImpulse(id: string, impulse: Vector3) {
    const entry = this.dynamicBodies.get(id);
    if (!entry) return false;
    entry.body.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
    return true;
  }

  dynamicBodySnapshots(): PhysicsDynamicBodySnapshot[] {
    const snapshots: PhysicsDynamicBodySnapshot[] = [];
    for (const [id, entry] of this.dynamicBodies) {
      const position = entry.body.translation();
      const rotation = entry.body.rotation();
      snapshots.push({
        id,
        position: new Vector3(position.x, position.y, position.z),
        rotation: new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
        sleeping: entry.body.isSleeping(),
      });
    }
    return snapshots;
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
      dynamicBodyCount: this.dynamicBodies.size,
      lastSyncMs: this.lastSyncMs,
      lastMoveMs: this.lastMoveMs,
      lastQueryMs: this.lastQueryMs,
      lastStepMs: this.lastStepMs,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  private createDynamicPropBody(body: PhysicsDynamicPropBody, halfSizeKey: string) {
    if (!this.world) throw new Error("Rapier physics world is not initialized.");
    const desc = RAPIER.RigidBodyDesc
      .dynamic()
      .setTranslation(body.position.x, body.position.y, body.position.z)
      .setRotation(yawRotation(body.yaw ?? 0))
      .setGravityScale(0)
      .setAdditionalMass(Math.max(0.001, body.mass ?? 1))
      .enabledTranslations(true, false, true)
      .enabledRotations(false, true, false)
      .setLinearDamping(body.linearDamping ?? 3.2)
      .setAngularDamping(body.angularDamping ?? 5.5)
      .setCanSleep(true);
    const rigidBody = this.world.createRigidBody(desc);
    const colliderDesc = RAPIER.ColliderDesc
      .cuboid(body.halfSize.x, body.halfSize.y, body.halfSize.z)
      .setFriction(0.92)
      .setRestitution(0.04);
    this.world.createCollider(colliderDesc, rigidBody);
    const entry = { body: rigidBody, halfSizeKey };
    this.dynamicBodies.set(body.id, entry);
    return entry;
  }

  private filterPredicate(filter: PhysicsSegmentQuery["filter"]) {
    if (!filter) return undefined;
    return (collider: Collider) => {
      const obstacle = this.obstacleByColliderHandle.get(collider.handle);
      return obstacle ? filter(obstacle) : false;
    };
  }

  private recoverKinematicOverlap(center: Vector3, shape: Shape, filterPredicate?: (collider: Collider) => boolean) {
    if (!this.world) return false;
    let recovered = false;

    for (let iteration = 0; iteration < 4; iteration += 1) {
      const bestCorrection: { value: Vector3 | null } = { value: null };
      this.world.intersectionsWithShape(
        toRapierVector(center),
        identityRotation,
        shape,
        (collider) => {
          const contact = collider.contactShape(shape, toRapierVector(center), identityRotation, 0.02);
          if (!contact || contact.distance >= 0) return true;
          const correction = planarContactCorrection(center, collider, contact.distance, contact.normal1);
          if (!bestCorrection.value || correction.lengthSq() > bestCorrection.value.lengthSq()) bestCorrection.value = correction;
          return true;
        },
        undefined,
        undefined,
        undefined,
        undefined,
        filterPredicate,
      );

      if (!bestCorrection.value || bestCorrection.value.lengthSq() <= minimumMoveDistanceSq) break;
      center.add(bestCorrection.value);
      recovered = true;
    }

    return recovered;
  }
}

export function createRapierPhysicsWorldAdapter() {
  return new RapierPhysicsWorldAdapter();
}

async function initRapierCompat() {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args.some((arg) => typeof arg === "string" && arg.includes("deprecated parameters for the initialization function"))) {
      return;
    }
    originalWarn(...args);
  };
  try {
    await RAPIER.init();
  } finally {
    console.warn = originalWarn;
  }
}

function toRapierVector(vector: Vector3) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function planarTranslation(vector: Vector3) {
  return new Vector3(vector.x, 0, vector.z);
}

function yawRotation(yaw: number) {
  if (Math.abs(yaw) <= 0.000001) return identityRotation;
  const halfYaw = yaw * 0.5;
  return { x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) };
}

function planarContactCorrection(center: Vector3, collider: Collider, distance: number, normal: { x: number; z: number }) {
  const direction = new Vector3(normal.x, 0, normal.z);
  if (direction.lengthSq() <= minimumMoveDistanceSq) {
    const colliderPosition = collider.translation();
    direction.set(center.x - colliderPosition.x, 0, center.z - colliderPosition.z);
  }
  if (direction.lengthSq() <= minimumMoveDistanceSq) direction.set(1, 0, 0);
  direction.normalize();
  return direction.multiplyScalar(-distance + 0.002);
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

function dynamicBodyHalfSizeKey(halfSize: Vector3) {
  return `${Math.round(halfSize.x * 1000)}:${Math.round(halfSize.y * 1000)}:${Math.round(halfSize.z * 1000)}`;
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
