import { Vector3 } from "three";
import type { PhysicsKinematicMoveResult } from "../physics/PhysicsWorldAdapter";

const minimumTranslationSq = 0.000001;
const translationToleranceSq = 0.000004;

export function reconcilePlanarVelocityWithKinematicResult(
  velocity: Vector3,
  desiredTranslation: Vector3,
  result: PhysicsKinematicMoveResult,
  delta: number,
) {
  if (delta <= 0 || desiredTranslation.lengthSq() <= minimumTranslationSq) return;

  const resolvedTranslation = result.translation.clone().setY(0);
  const lostMovement =
    resolvedTranslation.lengthSq() + translationToleranceSq < desiredTranslation.lengthSq();
  if (!result.blocked && !lostMovement) return;

  if (resolvedTranslation.lengthSq() <= minimumTranslationSq) {
    velocity.set(0, 0, 0);
    return;
  }

  const previousSpeed = velocity.length();
  velocity.copy(resolvedTranslation).multiplyScalar(1 / delta);
  if (velocity.length() > previousSpeed) velocity.setLength(previousSpeed);
}

export function dampenPlanarVelocityAgainstKinematicRecovery(velocity: Vector3, recoveryTranslation: Vector3) {
  const correction = recoveryTranslation.clone().setY(0);
  if (correction.lengthSq() <= minimumTranslationSq) return;

  correction.normalize();
  const intoRecoveredContact = velocity.dot(correction);
  if (intoRecoveredContact < 0) velocity.addScaledVector(correction, -intoRecoveredContact);
}
