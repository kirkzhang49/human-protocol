import { Vector3 } from "three";
import { EPSILON } from "./constants";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function damp(current: number, target: number, lambda: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

export function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function dampAngle(current: number, target: number, lambda: number, delta: number) {
  return current + wrapAngle(target - current) * (1 - Math.exp(-lambda * delta));
}

export function rotateLocalY(
  local: readonly [number, number, number],
  rotationY: number,
  target: Vector3,
) {
  const sin = Math.sin(rotationY);
  const cos = Math.cos(rotationY);
  const x = local[0] * cos + local[2] * sin;
  const z = local[2] * cos - local[0] * sin;
  target.set(x, local[1], z);
  return target;
}

export function resolveCircleAabb(
  position: Vector3,
  radius: number,
  center: Vector3,
  halfSize: Vector3,
) {
  const closestX = clamp(position.x, center.x - halfSize.x, center.x + halfSize.x);
  const closestZ = clamp(position.z, center.z - halfSize.z, center.z + halfSize.z);
  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  const distanceSq = dx * dx + dz * dz;

  if (distanceSq >= radius * radius) {
    return false;
  }

  if (distanceSq > EPSILON) {
    const distance = Math.sqrt(distanceSq);
    const push = radius - distance;
    position.x += (dx / distance) * push;
    position.z += (dz / distance) * push;
    return true;
  }

  const overlapX = halfSize.x + radius - Math.abs(position.x - center.x);
  const overlapZ = halfSize.z + radius - Math.abs(position.z - center.z);
  if (overlapX < overlapZ) {
    position.x += position.x < center.x ? -overlapX : overlapX;
  } else {
    position.z += position.z < center.z ? -overlapZ : overlapZ;
  }
  return true;
}

/**
 * Resolve a circle against a Y-rotated (oriented) box: rotate the circle into
 * the box's local frame, run the AABB resolve there, then rotate the resulting
 * displacement back to world space. Used for angled/curved (N-gon) room walls.
 */
export function resolveCircleObb(
  position: Vector3,
  radius: number,
  center: Vector3,
  halfSize: Vector3,
  yaw: number,
) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const dx = position.x - center.x;
  const dz = position.z - center.z;
  // World → local (inverse rotation).
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;
  const closestX = clamp(localX, -halfSize.x, halfSize.x);
  const closestZ = clamp(localZ, -halfSize.z, halfSize.z);
  const offX = localX - closestX;
  const offZ = localZ - closestZ;
  const distanceSq = offX * offX + offZ * offZ;

  if (distanceSq >= radius * radius) return false;

  let pushLocalX: number;
  let pushLocalZ: number;
  if (distanceSq > EPSILON) {
    const distance = Math.sqrt(distanceSq);
    const push = radius - distance;
    pushLocalX = (offX / distance) * push;
    pushLocalZ = (offZ / distance) * push;
  } else {
    const overlapX = halfSize.x + radius - Math.abs(localX);
    const overlapZ = halfSize.z + radius - Math.abs(localZ);
    if (overlapX < overlapZ) {
      pushLocalX = localX < 0 ? -overlapX : overlapX;
      pushLocalZ = 0;
    } else {
      pushLocalX = 0;
      pushLocalZ = localZ < 0 ? -overlapZ : overlapZ;
    }
  }
  // Local → world (forward rotation) applied to the displacement only.
  position.x += pushLocalX * cos - pushLocalZ * sin;
  position.z += pushLocalX * sin + pushLocalZ * cos;
  return true;
}

export function segmentIntersectsAabb2D(
  start: Vector3,
  end: Vector3,
  center: Vector3,
  halfSize: Vector3,
  radius = 0,
) {
  return segmentIntersectionTimeAabb2D(start, end, center, halfSize, radius) !== null;
}

export function segmentIntersectionTimeAabb2D(
  start: Vector3,
  end: Vector3,
  center: Vector3,
  halfSize: Vector3,
  radius = 0,
) {
  return segmentIntersectionTimeLocalAabb2D(
    start.x - center.x,
    start.z - center.z,
    end.x - center.x,
    end.z - center.z,
    halfSize.x + radius,
    halfSize.z + radius,
  );
}

export function segmentIntersectsObb2D(
  start: Vector3,
  end: Vector3,
  center: Vector3,
  halfSize: Vector3,
  yaw: number,
  radius = 0,
) {
  return segmentIntersectionTimeObb2D(start, end, center, halfSize, yaw, radius) !== null;
}

export function segmentIntersectionTimeObb2D(
  start: Vector3,
  end: Vector3,
  center: Vector3,
  halfSize: Vector3,
  yaw: number,
  radius = 0,
) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const startX = start.x - center.x;
  const startZ = start.z - center.z;
  const endX = end.x - center.x;
  const endZ = end.z - center.z;
  return segmentIntersectionTimeLocalAabb2D(
    startX * cos + startZ * sin,
    -startX * sin + startZ * cos,
    endX * cos + endZ * sin,
    -endX * sin + endZ * cos,
    halfSize.x + radius,
    halfSize.z + radius,
  );
}

function segmentIntersectionTimeLocalAabb2D(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  halfX: number,
  halfZ: number,
) {
  let tMin = 0;
  let tMax = 1;
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;

  const clippedX = clipSegmentAxis(startX, deltaX, -halfX, halfX, tMin, tMax);
  if (!clippedX) return null;
  tMin = clippedX.tMin;
  tMax = clippedX.tMax;

  const clippedZ = clipSegmentAxis(startZ, deltaZ, -halfZ, halfZ, tMin, tMax);
  if (!clippedZ) return null;
  return clippedZ.tMin;
}

function clipSegmentAxis(
  start: number,
  delta: number,
  min: number,
  max: number,
  tMin: number,
  tMax: number,
) {
  if (Math.abs(delta) < EPSILON) {
    return start >= min && start <= max ? { tMin, tMax } : null;
  }
  const invDelta = 1 / delta;
  let enter = (min - start) * invDelta;
  let exit = (max - start) * invDelta;
  if (enter > exit) {
    const swap = enter;
    enter = exit;
    exit = swap;
  }
  tMin = Math.max(tMin, enter);
  tMax = Math.min(tMax, exit);
  return tMin <= tMax ? { tMin, tMax } : null;
}
