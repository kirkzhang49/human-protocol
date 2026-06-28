import type { BuilderProject, BuilderRoom } from "./BuilderTypes";
import { polygonEdges, roomWorldPolygon } from "./BuilderRoomShape";
import { sharedEdge } from "./compileBuilderProjectToLevel";

/**
 * Shared room-geometry editing math for the 2D blueprint and the 3D stage:
 * edge resize, magnetic neighbor snapping, gizmo handle picking and
 * validity diagnostics (overlap / doors losing their shared edge).
 */

export type RoomEdge = "n" | "s" | "e" | "w";

export interface SnapGuide {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/** Resizes one room edge toward (worldX, worldZ), snapped to 1m, clamped 4–20m. */
export function resizeRoom(room: BuilderRoom, edge: RoomEdge, worldX: number, worldZ: number): BuilderRoom {
  const [cx, cz] = room.center;
  const [w, d] = room.size;
  if (edge === "e" || edge === "w") {
    const fixed = edge === "e" ? cx - w / 2 : cx + w / 2;
    const moving = snap(worldX, 1);
    const width = clamp(Math.abs(moving - fixed), 4, 20);
    const center = edge === "e" ? fixed + width / 2 : fixed - width / 2;
    return { ...room, center: [center, cz], size: [width, d] };
  }
  const fixed = edge === "s" ? cz - d / 2 : cz + d / 2;
  const moving = snap(worldZ, 1);
  const depth = clamp(Math.abs(moving - fixed), 4, 20);
  const center = edge === "s" ? fixed + depth / 2 : fixed - depth / 2;
  return { ...room, center: [cx, center], size: [w, depth] };
}

/** Magnetic edge snapping: pulls a dragged room flush against nearby rooms and reports the touching edges. */
export function snapRoomToNeighbors(
  dragged: BuilderRoom,
  others: readonly BuilderRoom[],
): { center: readonly [number, number]; guides: SnapGuide[] } {
  if (dragged.shape || others.some((room) => room.shape)) {
    const polygonSnap = snapPolygonRoomToNeighbors(dragged, others);
    if (polygonSnap) return polygonSnap;
  }

  const snapDistance = 1.05;
  let [x, z] = dragged.center;
  const [w, d] = dragged.size;
  const guides: SnapGuide[] = [];
  let snappedX = false;
  let snappedZ = false;

  for (const other of others) {
    const ox0 = other.center[0] - other.size[0] / 2;
    const ox1 = other.center[0] + other.size[0] / 2;
    const oz0 = other.center[1] - other.size[1] / 2;
    const oz1 = other.center[1] + other.size[1] / 2;
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const xOverlap = Math.min(x1, ox1) - Math.max(x0, ox0);
    const zOverlap = Math.min(z1, oz1) - Math.max(z0, oz0);

    if (!snappedZ && xOverlap > 1.5) {
      if (Math.abs(z0 - oz1) <= snapDistance && Math.abs(z0 - oz1) > 0.001) {
        z = oz1 + d / 2;
        snappedZ = true;
      } else if (Math.abs(z1 - oz0) <= snapDistance && Math.abs(z1 - oz0) > 0.001) {
        z = oz0 - d / 2;
        snappedZ = true;
      }
      if (snappedZ) {
        const edgeZ = z > other.center[1] ? oz1 : oz0;
        guides.push({ x1: Math.max(x - w / 2, ox0), z1: edgeZ, x2: Math.min(x + w / 2, ox1), z2: edgeZ });
      }
    }
    if (!snappedX && zOverlap > 1.5) {
      if (Math.abs(x0 - ox1) <= snapDistance && Math.abs(x0 - ox1) > 0.001) {
        x = ox1 + w / 2;
        snappedX = true;
      } else if (Math.abs(x1 - ox0) <= snapDistance && Math.abs(x1 - ox0) > 0.001) {
        x = ox0 - w / 2;
        snappedX = true;
      }
      if (snappedX) {
        const edgeX = x > other.center[0] ? ox1 : ox0;
        guides.push({ x1: edgeX, z1: Math.max(z - d / 2, oz0), x2: edgeX, z2: Math.min(z + d / 2, oz1) });
      }
    }
  }

  return { center: [x, z], guides };
}

function snapPolygonRoomToNeighbors(
  dragged: BuilderRoom,
  others: readonly BuilderRoom[],
): { center: readonly [number, number]; guides: SnapGuide[] } | null {
  const snapDistance = 1.05;
  const minOverlap = 1.5;
  const draggedEdges = polygonEdges(roomWorldPolygon(dragged));
  let best:
    | {
        score: number;
        overlap: number;
        deltaX: number;
        deltaZ: number;
        guide: SnapGuide;
      }
    | null = null;

  for (const other of others) {
    const otherEdges = polygonEdges(roomWorldPolygon(other));
    for (const draggedEdge of draggedEdges) {
      for (const otherEdge of otherEdges) {
        const cross = draggedEdge.dir[0] * otherEdge.dir[1] - draggedEdge.dir[1] * otherEdge.dir[0];
        if (Math.abs(cross) > 0.08) continue;

        const nx = -draggedEdge.dir[1];
        const nz = draggedEdge.dir[0];
        const gap0 = (otherEdge.a[0] - draggedEdge.a[0]) * nx + (otherEdge.a[1] - draggedEdge.a[1]) * nz;
        const gap1 = (otherEdge.b[0] - draggedEdge.a[0]) * nx + (otherEdge.b[1] - draggedEdge.a[1]) * nz;
        const gap = (gap0 + gap1) / 2;
        if (Math.abs(gap) > snapDistance || Math.abs(gap) < 0.001 || Math.abs(gap0 - gap1) > 0.12) continue;

        const ta0 = 0;
        const ta1 = draggedEdge.length;
        const tb0 = (otherEdge.a[0] - draggedEdge.a[0]) * draggedEdge.dir[0] + (otherEdge.a[1] - draggedEdge.a[1]) * draggedEdge.dir[1];
        const tb1 = (otherEdge.b[0] - draggedEdge.a[0]) * draggedEdge.dir[0] + (otherEdge.b[1] - draggedEdge.a[1]) * draggedEdge.dir[1];
        const lo = Math.max(ta0, Math.min(tb0, tb1));
        const hi = Math.min(ta1, Math.max(tb0, tb1));
        const overlap = hi - lo;
        if (overlap < minOverlap) continue;

        const deltaX = nx * gap;
        const deltaZ = nz * gap;
        const guide: SnapGuide = {
          x1: draggedEdge.a[0] + draggedEdge.dir[0] * lo + deltaX,
          z1: draggedEdge.a[1] + draggedEdge.dir[1] * lo + deltaZ,
          x2: draggedEdge.a[0] + draggedEdge.dir[0] * hi + deltaX,
          z2: draggedEdge.a[1] + draggedEdge.dir[1] * hi + deltaZ,
        };
        const score = Math.abs(gap) - overlap * 0.001;
        if (!best || score < best.score) {
          best = { score, overlap, deltaX, deltaZ, guide };
        }
      }
    }
  }

  if (!best) return null;
  return {
    center: [dragged.center[0] + best.deltaX, dragged.center[1] + best.deltaZ],
    guides: [best.guide],
  };
}

export function roomsOverlap(a: BuilderRoom, b: BuilderRoom, margin = 0.05) {
  return (
    Math.abs(a.center[0] - b.center[0]) < (a.size[0] + b.size[0]) / 2 - margin &&
    Math.abs(a.center[1] - b.center[1]) < (a.size[1] + b.size[1]) / 2 - margin
  );
}

// ---------------------------------------------------------------------------
// 3D gizmo handle picking (plan space)
// ---------------------------------------------------------------------------

export type RoomHandlePick =
  | { type: "move"; axis: "x" | "z" | null }
  | { type: "resize"; edge: RoomEdge };

/** Geometry constants shared by handle picking and the 3D gizmo rendering. */
export const roomGizmo = {
  /** Center planar pad radius. */
  padRadius: 1.0,
  /** Axis arrows start/end, measured outward from the wall. */
  arrowStart: 0.35,
  arrowEnd: 2.5,
  arrowHalfWidth: 0.55,
  /** Edge resize handle hit radius around each wall midpoint. */
  edgeRadius: 0.8,
} as const;

/**
 * Hit-tests the selected room's transform handles at a plan-space point.
 * Priority: edge resize handles > axis arrows > center pad.
 */
export function pickRoomHandle(room: BuilderRoom, x: number, z: number): RoomHandlePick | null {
  const [cx, cz] = room.center;
  const [w, d] = room.size;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;

  // Edge resize is rectangle-only; shaped rooms are move/rotate (fixed-size presets).
  if (!room.shape) {
    const edges: { edge: RoomEdge; hx: number; hz: number }[] = [
      { edge: "n", hx: cx, hz: z0 },
      { edge: "s", hx: cx, hz: z1 },
      { edge: "w", hx: x0, hz: cz },
      { edge: "e", hx: x1, hz: cz },
    ];
    for (const candidate of edges) {
      if (Math.hypot(x - candidate.hx, z - candidate.hz) <= roomGizmo.edgeRadius) {
        return { type: "resize", edge: candidate.edge };
      }
    }
  }

  if (x >= x1 + roomGizmo.arrowStart && x <= x1 + roomGizmo.arrowEnd && Math.abs(z - cz) <= roomGizmo.arrowHalfWidth) {
    return { type: "move", axis: "x" };
  }
  if (z >= z1 + roomGizmo.arrowStart && z <= z1 + roomGizmo.arrowEnd && Math.abs(x - cx) <= roomGizmo.arrowHalfWidth) {
    return { type: "move", axis: "z" };
  }

  if (Math.hypot(x - cx, z - cz) <= roomGizmo.padRadius) {
    return { type: "move", axis: null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validity diagnostics
// ---------------------------------------------------------------------------

export interface RoomEditIssues {
  overlap: boolean;
  brokenDoorIds: string[];
}

/** Current geometry problems caused by/around one room. */
export function roomEditIssues(project: BuilderProject, roomId: string): RoomEditIssues {
  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const room = roomsById.get(roomId);
  if (!room) return { overlap: false, brokenDoorIds: [] };
  const overlap = project.rooms.some((other) => other.id !== roomId && roomsOverlap(room, other));
  const brokenDoorIds = project.doors
    .filter((door) => door.fromRoomId === roomId || door.toRoomId === roomId)
    .filter((door) => {
      const a = roomsById.get(door.fromRoomId);
      const b = roomsById.get(door.toRoomId);
      return !a || !b || !sharedEdge(a, b);
    })
    .map((door) => door.id);
  return { overlap, brokenDoorIds };
}

/** True when `current` has problems that `baseline` did not already have. */
export function introducedIssues(baseline: RoomEditIssues, current: RoomEditIssues) {
  const baselineBroken = new Set(baseline.brokenDoorIds);
  return (current.overlap && !baseline.overlap) || current.brokenDoorIds.some((id) => !baselineBroken.has(id));
}

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
