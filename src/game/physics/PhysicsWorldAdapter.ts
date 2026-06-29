import type { Vector3 } from "three";
import type { ObstacleState } from "../entities/EntityTypes";

export type PhysicsMode = "legacy" | "rapier";

export interface PhysicsSegmentQuery {
  start: Vector3;
  end: Vector3;
  radius?: number;
  filter?: (obstacle: ObstacleState) => boolean;
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

export interface PhysicsDebugSnapshot {
  mode: PhysicsMode;
  ready: boolean;
  staticColliderCount: number;
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
  isSegmentBlocked(query: PhysicsSegmentQuery): boolean;
  moveKinematicCircle(move: PhysicsKinematicCircleMove): PhysicsKinematicMoveResult;
  step(delta: number): void;
  debugSnapshot(): PhysicsDebugSnapshot;
}
