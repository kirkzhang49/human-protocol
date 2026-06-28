import type { BuilderRoom } from "./BuilderTypes";

/**
 * Non-rectangular room footprints for /build.
 *
 * Design contract: `shape` is purely *additive*. A room with no `shape` is an
 * ordinary axis-aligned rectangle described by `center` + `size`, exactly as
 * before — so every legacy project and every rect-only code path keeps working
 * untouched. For shaped rooms, `center` + `size` are kept as the axis-aligned
 * bounding box of the footprint (so bbox-based systems — movement clamp, magnetic
 * snapping, broad-phase — still see a sane box), while `shape.points` carry the
 * true outline. Circles / semicircles / triangles are all expressed as polygons
 * (N-gons) so downstream code only ever deals with one non-rect representation.
 */

export type Vec2 = readonly [number, number];

export interface BuilderRoomShape {
  kind: "polygon";
  /**
   * Local-space polygon vertices relative to the room center, in meters,
   * authored CCW, before `rotation` is applied. Should be roughly centered on
   * the origin so `center` + bbox stay consistent.
   */
  points: readonly Vec2[];
  /** Rotation applied to the local points around the center, radians. */
  rotation?: number;
}

/** True for an ordinary axis-aligned rectangle (no explicit shape). */
export function isRectRoom(room: Pick<BuilderRoom, "shape">): boolean {
  return !room.shape;
}

/** Local polygon points after `rotation`, still relative to the room center. */
export function rotatedLocalPoints(shape: BuilderRoomShape): Vec2[] {
  const rotation = shape.rotation ?? 0;
  const rotated = !rotation
    ? shape.points.map(([x, z]) => [x, z] as Vec2)
    : (() => {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        return shape.points.map(([x, z]) => [x * cos - z * sin, x * sin + z * cos] as Vec2);
      })();
  return signedArea(rotated) < 0 ? [...rotated].reverse() : rotated;
}

/**
 * World-space footprint polygon for any room. Rect rooms expand to their four
 * corners (CCW: front-left, front-right, back-right, back-left); shaped rooms
 * return their rotated points translated by the room center.
 */
export function roomWorldPolygon(room: BuilderRoom): Vec2[] {
  const [cx, cz] = room.center;
  if (!room.shape) {
    const hw = room.size[0] / 2;
    const hd = room.size[1] / 2;
    return [
      [cx - hw, cz - hd],
      [cx + hw, cz - hd],
      [cx + hw, cz + hd],
      [cx - hw, cz + hd],
    ];
  }
  return rotatedLocalPoints(room.shape).map(([x, z]) => [cx + x, cz + z] as Vec2);
}

export interface Bbox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function polygonBbox(points: readonly Vec2[]): Bbox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

/** Axis-aligned bounding-box size [w, d] of a shape's rotated local points. */
export function shapeBboxSize(shape: BuilderRoomShape): Vec2 {
  const box = polygonBbox(rotatedLocalPoints(shape));
  return [Math.max(0.001, box.maxX - box.minX), Math.max(0.001, box.maxZ - box.minZ)];
}

/** Centroid (average vertex) of a polygon. */
export function polygonCentroid(points: readonly Vec2[]): Vec2 {
  let sx = 0;
  let sz = 0;
  for (const [x, z] of points) {
    sx += x;
    sz += z;
  }
  const count = Math.max(1, points.length);
  return [sx / count, sz / count];
}

/** Standard even-odd point-in-polygon test (world space). */
export function pointInPolygon(points: readonly Vec2[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const zi = points[i][1];
    const xj = points[j][0];
    const zj = points[j][1];
    const intersects = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Point-in-room for any footprint; rect rooms use a fast AABB test. */
export function pointInRoomShape(room: BuilderRoom, x: number, z: number): boolean {
  if (!room.shape) {
    return Math.abs(x - room.center[0]) <= room.size[0] / 2 && Math.abs(z - room.center[1]) <= room.size[1] / 2;
  }
  return pointInPolygon(roomWorldPolygon(room), x, z);
}

export interface PolygonEdge {
  a: Vec2;
  b: Vec2;
  /** Unit direction a→b. */
  dir: Vec2;
  length: number;
  /** Edge tangent angle, atan2(dz, dx): matches the rect door-yaw convention. */
  yaw: number;
}

function signedArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return sum / 2;
}

/** Edges of a polygon in winding order, with unit direction + tangent yaw. */
export function polygonEdges(points: readonly Vec2[]): PolygonEdge[] {
  const edges: PolygonEdge[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    edges.push({ a, b, dir: [dx / length, dz / length], length, yaw: Math.atan2(dz, dx) });
  }
  return edges;
}

function cross3(a: Vec2, b: Vec2, c: Vec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = cross3(p, a, b);
  const d2 = cross3(p, b, c);
  const d3 = cross3(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Ear-clipping triangulation of a simple polygon (convex or concave). Returns
 * index triples into `points`. Used by the GLB deep-bake so non-rect floors and
 * ceilings emit a real triangulated surface instead of a bounding box.
 */
export function triangulatePolygon(points: readonly Vec2[]): [number, number, number][] {
  const count = points.length;
  if (count < 3) return [];
  const indices = Array.from({ length: count }, (_, i) => i);
  // Orient CCW so a convex ear has positive cross.
  if (signedArea(points) < 0) indices.reverse();
  const triangles: [number, number, number][] = [];
  let guard = count * count + 16;
  while (indices.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < indices.length; i += 1) {
      const prev = indices[(i - 1 + indices.length) % indices.length];
      const cur = indices[i];
      const next = indices[(i + 1) % indices.length];
      const a = points[prev];
      const b = points[cur];
      const c = points[next];
      if (cross3(a, b, c) <= 0) continue; // reflex/collinear vertex — not an ear
      let containsOther = false;
      for (const j of indices) {
        if (j === prev || j === cur || j === next) continue;
        if (pointInTriangle(points[j], a, b, c)) {
          containsOther = true;
          break;
        }
      }
      if (containsOther) continue;
      triangles.push([prev, cur, next]);
      indices.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // degenerate polygon — bail with what we have
  }
  if (indices.length === 3) triangles.push([indices[0], indices[1], indices[2]]);
  return triangles;
}

export { signedArea };
