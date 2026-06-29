import type {
  PhysicsDebugSnapshot,
  PhysicsKinematicCircleMove,
  PhysicsKinematicMoveResult,
  PhysicsSegmentQuery,
  PhysicsWorldAdapter,
} from "./PhysicsWorldAdapter";

export class NullPhysicsWorldAdapter implements PhysicsWorldAdapter {
  readonly mode = "legacy" as const;
  readonly ready = false;

  async init() {
    return false;
  }

  syncStaticObstacles() {}

  isSegmentBlocked(_query: PhysicsSegmentQuery) {
    return false;
  }

  moveKinematicCircle(move: PhysicsKinematicCircleMove): PhysicsKinematicMoveResult {
    const translation = move.desiredTranslation.clone();
    return {
      position: move.position.clone().add(translation),
      translation,
      blocked: false,
    };
  }

  step(_delta: number) {}

  debugSnapshot(): PhysicsDebugSnapshot {
    return {
      mode: this.mode,
      ready: this.ready,
      staticColliderCount: 0,
      lastSyncMs: 0,
      lastMoveMs: 0,
      lastQueryMs: 0,
      lastStepMs: 0,
    };
  }
}

export function createNullPhysicsWorldAdapter() {
  return new NullPhysicsWorldAdapter();
}
