import type { DoorEdgeInfo } from "./Builder3DEditing";
import { polygonEdges, rotatedLocalPoints } from "./BuilderRoomShape";
import type { BuilderRoom } from "./BuilderTypes";

export interface PreviewWallSegment {
  x: number;
  z: number;
  sx: number;
  sz: number;
  yaw?: number;
}

const wallThickness = 0.3;
const doorCutHalf = 1.75;

/** A door wall runs along x (north/south of a rect room) when its yaw is near 0/π. */
export function previewDoorIsHorizontal(yaw: number) {
  return Math.abs(Math.cos(yaw)) >= Math.abs(Math.sin(yaw));
}

/** Convert plan-space yaw (local X -> [cos, sin]) to Three.js rotationY. */
export function previewPlanYawToThreeYaw(yaw: number) {
  return -yaw;
}

/** Splits one wall run into solid segments, cutting openings where doors sit on it. */
function wallRunSegments(start: number, end: number, cuts: number[]) {
  const sorted = [...cuts].sort((a, b) => a - b);
  const segments: { from: number; to: number }[] = [];
  let cursor = start;
  for (const cut of sorted) {
    const cutStart = Math.max(start, cut - doorCutHalf);
    const cutEnd = Math.min(end, cut + doorCutHalf);
    if (cutStart > cursor + 0.05) segments.push({ from: cursor, to: cutStart });
    cursor = Math.max(cursor, cutEnd);
  }
  if (cursor < end - 0.05) segments.push({ from: cursor, to: end });
  if (segments.length === 0 && sorted.length > 0) {
    const length = end - start;
    const cap = Math.min(0.42, Math.max(0.18, length * 0.18));
    if (length > cap * 2 + 0.05) {
      segments.push({ from: start, to: start + cap }, { from: end - cap, to: end });
    }
  }
  return segments;
}

/**
 * Preview wall segments in room-local XZ space. RoomMesh renders these inside
 * the same center-positioned group as shaped floors, so polygon walls cannot
 * drift or mirror independently from their floor.
 */
export function previewRoomWallSegments(room: BuilderRoom, roomDoorEdges: readonly DoorEdgeInfo[]): PreviewWallSegment[] {
  const tolerance = 0.45;
  const [cx, cz] = room.center;
  const [w, d] = room.size;
  const result: PreviewWallSegment[] = [];

  if (room.shape) {
    for (const edge of polygonEdges(rotatedLocalPoints(room.shape))) {
      const normalX = -edge.dir[1];
      const normalZ = edge.dir[0];
      const cuts: number[] = [];
      for (const door of roomDoorEdges) {
        const relX = door.x - cx - edge.a[0];
        const relZ = door.z - cz - edge.a[1];
        const along = relX * edge.dir[0] + relZ * edge.dir[1];
        const across = relX * normalX + relZ * normalZ;
        if (along < -0.2 || along > edge.length + 0.2) continue;
        if (Math.abs(across) > tolerance + 0.4) continue;
        cuts.push(along);
      }
      for (const segment of wallRunSegments(0, edge.length, cuts)) {
        const mid = (segment.from + segment.to) / 2;
        result.push({
          x: edge.a[0] + edge.dir[0] * mid,
          z: edge.a[1] + edge.dir[1] * mid,
          sx: segment.to - segment.from,
          sz: wallThickness,
          yaw: edge.yaw,
        });
      }
    }
    return result;
  }

  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;

  for (const [boundaryZ, inward] of [[z0, 1], [z1, -1]] as const) {
    const cuts = roomDoorEdges
      .filter((edge) => previewDoorIsHorizontal(edge.yaw) && Math.abs(edge.z - cz - boundaryZ) <= tolerance && edge.x - cx > x0 - 0.2 && edge.x - cx < x1 + 0.2)
      .map((edge) => edge.x - cx);
    for (const segment of wallRunSegments(x0, x1, cuts)) {
      result.push({ x: (segment.from + segment.to) / 2, z: boundaryZ + inward * (wallThickness / 2), sx: segment.to - segment.from, sz: wallThickness });
    }
  }
  for (const [boundaryX, inward] of [[x0, 1], [x1, -1]] as const) {
    const cuts = roomDoorEdges
      .filter((edge) => !previewDoorIsHorizontal(edge.yaw) && Math.abs(edge.x - cx - boundaryX) <= tolerance && edge.z - cz > z0 - 0.2 && edge.z - cz < z1 + 0.2)
      .map((edge) => edge.z - cz);
    for (const segment of wallRunSegments(z0, z1, cuts)) {
      result.push({ x: boundaryX + inward * (wallThickness / 2), z: (segment.from + segment.to) / 2, sx: wallThickness, sz: segment.to - segment.from });
    }
  }
  return result;
}
