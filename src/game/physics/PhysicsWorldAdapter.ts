import type { Quaternion, Vector3 } from "three";
import type { ObstacleState } from "../entities/EntityTypes";

export type PhysicsMode = "legacy" | "rapier";

export interface PhysicsSegmentQuery {
  start: Vector3;
  end: Vector3;
  radius?: number;
  filter?: (obstacle: ObstacleState) => boolean;
}

export interface PhysicsSegmentHit {
  obstacle?: ObstacleState;
  position: Vector3;
  timeOfImpact: number;
}

export interface PhysicsKinematicCircleMove {
  id: string;
  position: Vector3;
  radius: number;
  height?: number;
  desiredTranslation: Vector3;
  filter?: (obstacle: ObstacleState) => boolean;
}

export interface PhysicsKinematicMoveResult {
  position: Vector3;
  translation: Vector3;
  blocked: boolean;
}

export interface PhysicsDynamicPropBody {
  id: string;
  position: Vector3;
  halfSize: Vector3;
  yaw?: number;
  mass?: number;
  linearDamping?: number;
  angularDamping?: number;
}

export interface PhysicsDynamicBodySnapshot {
  id: string;
  position: Vector3;
  rotation: Quaternion;
  sleeping: boolean;
}

export interface PhysicsDebugSnapshot {
  mode: PhysicsMode;
  ready: boolean;
  staticColliderCount: number;
  dynamicBodyCount: number;
  lastSyncMs: number;
  lastMoveMs: number;
  lastQueryMs: number;
  lastStepMs: number;
  lastError?: string;
}

export interface PhysicsWorldAdapter {
  readonly mode: PhysicsMode;
  readonly ready: boolean;
  init(): Promise<boolean>;
  syncStaticObstacles(obstacles: readonly ObstacleState[]): void;
  castSegment(query: PhysicsSegmentQuery): PhysicsSegmentHit | null;
  isSegmentBlocked(query: PhysicsSegmentQuery): boolean;
  moveKinematicCircle(move: PhysicsKinematicCircleMove): PhysicsKinematicMoveResult;
  syncDynamicPropBodies(bodies: readonly PhysicsDynamicPropBody[]): void;
  applyDynamicImpulse(id: string, impulse: Vector3): boolean;
  dynamicBodySnapshots(): PhysicsDynamicBodySnapshot[];
  step(delta: number): void;
  debugSnapshot(): PhysicsDebugSnapshot;
}
