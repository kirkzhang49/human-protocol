import type { LevelDoorDefinition, Vec3Tuple } from "../../game/config/schema/levelConfig";
import type { BuilderSurfacePattern, EffectiveFloor, EffectiveWall } from "../BuilderEnvironment";
import { polygonCentroid, triangulatePolygon, type Vec2 } from "../BuilderRoomShape";
import { DOOR_FRAME_HEIGHT, DOOR_GAP_WIDTH, SURFACE_DETAIL_THICKNESS, WALL_THICKNESS } from "./builderRuntimePackConstants";
import type { GeometryWriter } from "./GeometryWriter";

/**
 * Floor / ceiling / wall surface geometry baked into the builder runtime pack.
 * Extracted verbatim from compileBuilderRuntimePack — every helper writes only
 * through the supplied GeometryWriter, so the baked shell is byte-identical.
 */
export type BuilderSurfaceDetailMode = "normal" | "quiet";

export function pushFloorSurfaceBake(
  geometry: GeometryWriter,
  width: number,
  depth: number,
  floor: EffectiveFloor,
  detailMaterial: number,
  glowMaterial: number,
  detailMode: BuilderSurfaceDetailMode = "normal",
) {
  if (detailMode === "quiet") return;

  const pattern = floor.preset.pattern;
  const cell = patternCellMetersForRuntime(pattern) * floor.scale;
  const thin = Math.max(0.018, Math.min(0.045, cell * 0.024));
  const top = SURFACE_DETAIL_THICKNESS / 2 + 0.004;
  const rotated = floor.rotation === 90 || floor.rotation === 270;
  const primary = rotated ? "z" : "x";

  if (pattern === "hazard" || pattern === "trim") {
    pushParallelFloorLines(geometry, width, depth, primary, Math.max(0.8, cell * 0.72), thin * 4.6, top, glowMaterial, 0.72);
    pushFloorBorder(geometry, width, depth, thin * 1.6, top, detailMaterial);
    return;
  }

  if (pattern === "route") {
    geometry.pushBox(0, top, 0, Math.max(0.14, thin * 3), SURFACE_DETAIL_THICKNESS, depth * 0.88, glowMaterial);
    geometry.pushBox(-Math.min(width * 0.28, 1.6), top + 0.002, 0, thin, SURFACE_DETAIL_THICKNESS, depth * 0.62, detailMaterial);
    geometry.pushBox(Math.min(width * 0.28, 1.6), top + 0.002, 0, thin, SURFACE_DETAIL_THICKNESS, depth * 0.62, detailMaterial);
    pushFloorBorder(geometry, width, depth, thin, top, detailMaterial);
    return;
  }

  if (pattern === "wood" || pattern === "parquet" || pattern === "wainscot") {
    pushParallelFloorLines(geometry, width, depth, primary, Math.max(0.65, cell * 0.52), thin, top, detailMaterial);
    pushParallelFloorLines(geometry, width, depth, primary === "x" ? "z" : "x", Math.max(1.4, cell * 1.18), thin * 0.7, top + 0.001, detailMaterial, 0.54);
    return;
  }

  if (pattern === "metal" || pattern === "plate" || pattern === "panel" || pattern === "rubber") {
    pushFloorGrid(geometry, width, depth, Math.max(0.95, cell), Math.max(1.1, cell * 1.15), thin, top, detailMaterial, 0.76);
    pushFloorRivets(geometry, width, depth, Math.max(1.25, cell * 1.05), thin * 1.8, top + 0.004, detailMaterial);
    return;
  }

  if (pattern === "glass") {
    pushFloorGrid(geometry, width, depth, Math.max(1.4, cell), Math.max(1.4, cell), thin, top, glowMaterial, 0.58);
    pushFloorBorder(geometry, width, depth, thin * 1.4, top, glowMaterial);
    return;
  }

  pushFloorGrid(geometry, width, depth, Math.max(0.9, cell), Math.max(0.9, cell), thin, top, detailMaterial);
}

export function pushCeilingSurfaceBake(
  _geometry: GeometryWriter,
  _width: number,
  _depth: number,
  _pattern: BuilderSurfacePattern,
  _detailMaterial: number,
  _glowMaterial: number,
  _coveMaterial: number,
) {
  // Intentionally no visible fixture geometry. The runtime pack still emits
  // `light_ceiling_*` practical lights from compileBuilderRuntimePack; this
  // keeps the illumination while avoiding low-quality ceiling frames/lamps.
}

function pushFloorGrid(
  geometry: GeometryWriter,
  width: number,
  depth: number,
  stepX: number,
  stepZ: number,
  thickness: number,
  y: number,
  material: number,
  coverage = 0.92,
) {
  pushParallelFloorLines(geometry, width, depth, "x", stepX, thickness, y, material, coverage);
  pushParallelFloorLines(geometry, width, depth, "z", stepZ, thickness, y, material, coverage);
}

function pushParallelFloorLines(
  geometry: GeometryWriter,
  width: number,
  depth: number,
  axis: "x" | "z",
  step: number,
  thickness: number,
  y: number,
  material: number,
  coverage = 0.92,
) {
  const span = axis === "x" ? width : depth;
  const cross = axis === "x" ? depth : width;
  const maxLines = Math.min(14, Math.max(2, Math.floor(span / Math.max(0.45, step))));
  if (maxLines <= 0) return;
  const start = -((maxLines - 1) * step) / 2;
  for (let index = 0; index < maxLines; index += 1) {
    const offset = start + index * step;
    if (Math.abs(offset) > span / 2 - 0.18) continue;
    if (axis === "x") geometry.pushBox(offset, y, 0, thickness, SURFACE_DETAIL_THICKNESS, cross * coverage, material);
    else geometry.pushBox(0, y, offset, cross * coverage, SURFACE_DETAIL_THICKNESS, thickness, material);
  }
}

function pushFloorBorder(geometry: GeometryWriter, width: number, depth: number, thickness: number, y: number, material: number) {
  const insetX = width / 2 - thickness;
  const insetZ = depth / 2 - thickness;
  geometry.pushBox(0, y, -insetZ, width * 0.92, SURFACE_DETAIL_THICKNESS, thickness, material);
  geometry.pushBox(0, y, insetZ, width * 0.92, SURFACE_DETAIL_THICKNESS, thickness, material);
  geometry.pushBox(-insetX, y, 0, thickness, SURFACE_DETAIL_THICKNESS, depth * 0.92, material);
  geometry.pushBox(insetX, y, 0, thickness, SURFACE_DETAIL_THICKNESS, depth * 0.92, material);
}

function pushFloorRivets(
  geometry: GeometryWriter,
  width: number,
  depth: number,
  step: number,
  size: number,
  y: number,
  material: number,
) {
  const countX = Math.min(7, Math.max(2, Math.floor(width / Math.max(0.8, step))));
  const countZ = Math.min(6, Math.max(2, Math.floor(depth / Math.max(0.8, step))));
  for (let ix = 0; ix < countX; ix += 1) {
    const x = ((ix + 0.5) / countX - 0.5) * width * 0.82;
    for (let iz = 0; iz < countZ; iz += 1) {
      const z = ((iz + 0.5) / countZ - 0.5) * depth * 0.82;
      if ((ix + iz) % 2 === 0) geometry.pushBox(x, y, z, size, SURFACE_DETAIL_THICKNESS, size, material);
    }
  }
}

export function patternCellMetersForRuntime(pattern: BuilderSurfacePattern) {
  switch (pattern) {
    case "rubber":
      return 1.2;
    case "plate":
      return 1.4;
    case "labtile":
      return 1.2;
    case "parquet":
      return 1.6;
    case "metal":
      return 1.8;
    case "tile":
      return 2;
    case "panel":
      return 2.2;
    case "wood":
    case "hazard":
    case "glass":
    case "trim":
      return 2.4;
    case "wainscot":
      return 2.6;
    case "stone":
    case "route":
      return 3.2;
    case "marble":
      return 3;
    case "hex":
      return 1.6;
  }
}

export function surfaceAccentRole(pattern: BuilderSurfacePattern): string {
  if (pattern === "hazard" || pattern === "plate" || pattern === "trim") return "route_gold";
  if (pattern === "route" || pattern === "glass" || pattern === "tile" || pattern === "labtile") return "door_access_cyan";
  if (pattern === "wood" || pattern === "parquet" || pattern === "wainscot") return "exhibit_warm";
  return "neutral_surface";
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

export function pushRoomWalls(
  geometry: GeometryWriter,
  bounds: { center: Vec3Tuple; size: Vec3Tuple },
  doors: readonly LevelDoorDefinition[],
  wall: EffectiveWall | null,
  /** Effective playable shell height — geometry NEVER falls back to the
   * authored env.wallHeight here (legacy 1.12m half-walls must bake tall). */
  shellHeight: number,
  wallMaterial: number,
  accentMaterial: number,
  detailMaterial: number,
  detailMode: BuilderSurfaceDetailMode = "normal",
): number {
  const [cx, , cz] = bounds.center;
  const halfX = bounds.size[0] / 2;
  const halfZ = bounds.size[2] / 2;
  const height = shellHeight;
  const pattern = wall?.preset.pattern ?? "panel";
  const panelStep = Math.max(0.82, patternCellMetersForRuntime(pattern) * (pattern === "wainscot" ? 0.72 : 0.88));
  let segments = 0;

  const edges = [
    { axis: "x" as const, boundary: cz - halfZ, inward: 1, from: cx - halfX, to: cx + halfX },
    { axis: "x" as const, boundary: cz + halfZ, inward: -1, from: cx - halfX, to: cx + halfX },
    { axis: "z" as const, boundary: cx - halfX, inward: 1, from: cz - halfZ, to: cz + halfZ },
    { axis: "z" as const, boundary: cx + halfX, inward: -1, from: cz - halfZ, to: cz + halfZ },
  ];

  for (const edge of edges) {
    const gaps: Array<[number, number]> = [];
    for (const door of doors) {
      const doorAlong = edge.axis === "x" ? door.position[0] : door.position[2];
      const doorAcross = edge.axis === "x" ? door.position[2] : door.position[0];
      if (Math.abs(doorAcross - edge.boundary) > 0.55) continue;
      if (doorAlong < edge.from - 0.2 || doorAlong > edge.to + 0.2) continue;
      gaps.push([doorAlong - DOOR_GAP_WIDTH / 2, doorAlong + DOOR_GAP_WIDTH / 2]);
    }
    gaps.sort((a, b) => a[0] - b[0]);

    let cursor = edge.from;
    const runs: Array<[number, number]> = [];
    for (const [gapStart, gapEnd] of gaps) {
      if (gapStart > cursor) runs.push([cursor, Math.min(gapStart, edge.to)]);
      cursor = Math.max(cursor, gapEnd);
    }
    if (cursor < edge.to) runs.push([cursor, edge.to]);

    // Header wall above each doorway: ties wall, door frame and ceiling into
    // one continuous shell instead of a floating frame in a full-height hole.
    for (const [gapStart, gapEnd] of gaps) {
      const headStart = Math.max(gapStart, edge.from);
      const headEnd = Math.min(gapEnd, edge.to);
      const headLength = headEnd - headStart;
      if (headLength < 0.3 || height <= DOOR_FRAME_HEIGHT + 0.04) continue;
      const headerHeight = height - DOOR_FRAME_HEIGHT;
      const along = (headStart + headEnd) / 2;
      const across = edge.boundary + edge.inward * (WALL_THICKNESS / 2);
      const lx = edge.axis === "x" ? along - cx : across - cx;
      const lz = edge.axis === "x" ? across - cz : along - cz;
      const sx = edge.axis === "x" ? headLength : WALL_THICKNESS;
      const sz = edge.axis === "x" ? WALL_THICKNESS : headLength;
      geometry.pushBox(lx, DOOR_FRAME_HEIGHT + headerHeight / 2, lz, sx, headerHeight, sz, wallMaterial);
      if (detailMode !== "quiet") geometry.pushBox(lx, height + 0.025, lz, sx * 0.99, 0.05, sz * 0.99, accentMaterial);
      segments += 1;
    }

    for (const [start, end] of runs) {
      const length = end - start;
      if (length < 0.24) continue;
      const along = (start + end) / 2;
      const across = edge.boundary + edge.inward * (WALL_THICKNESS / 2);
      // Geometry is room-local (relative to room center).
      const lx = edge.axis === "x" ? along - cx : across - cx;
      const lz = edge.axis === "x" ? across - cz : along - cz;
      const sx = edge.axis === "x" ? length : WALL_THICKNESS;
      const sz = edge.axis === "x" ? WALL_THICKNESS : length;
      geometry.pushBox(lx, height / 2, lz, sx, height, sz, wallMaterial);
      // Thin accent strip along the wall top keeps the builder's color identity.
      if (detailMode !== "quiet") {
        geometry.pushBox(lx, height + 0.025, lz, sx * 0.99, 0.05, sz * 0.99, accentMaterial);
        pushWallSurfaceBake(geometry, edge.axis, edge.inward, lx, lz, length, height, pattern, panelStep, detailMaterial, accentMaterial);
      }
      segments += 1;
    }
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Polygon (non-rectangular) room bake — triangulated floor/ceiling + per-edge
// oriented wall runs, so circle/triangle/N-gon rooms bake as the real shape
// instead of a bounding box.
// ---------------------------------------------------------------------------

/** Triangulated horizontal slab between yTop and yBottom for a local polygon. */
export function pushPolygonSlab(
  geometry: GeometryWriter,
  points: readonly Vec2[],
  yTop: number,
  yBottom: number,
  material: number,
) {
  for (const [i, j, k] of triangulatePolygon(points)) {
    const a = points[i];
    const b = points[j];
    const c = points[k];
    // Top face (+Y) uses reversed winding; bottom face (−Y) uses natural winding.
    geometry.pushTriangle([[a[0], yTop, a[1]], [c[0], yTop, c[1]], [b[0], yTop, b[1]]], material);
    geometry.pushTriangle([[a[0], yBottom, a[1]], [b[0], yBottom, b[1]], [c[0], yBottom, c[1]]], material);
  }
}

/** Inset glowing outline that follows the polygon edges (floor/ceiling art accent). */
export function pushPolygonBorder(
  geometry: GeometryWriter,
  points: readonly Vec2[],
  inset: number,
  y: number,
  thickness: number,
  material: number,
) {
  const [ccx, ccz] = polygonCentroid(points);
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.5) continue;
    const dirX = dx / length;
    const dirZ = dz / length;
    const yaw = Math.atan2(dz, dx);
    const midX = (a[0] + b[0]) / 2;
    const midZ = (a[1] + b[1]) / 2;
    // Inset toward the centroid.
    const toCenter = Math.hypot(ccx - midX, ccz - midZ) || 1;
    const insetX = ((ccx - midX) / toCenter) * inset;
    const insetZ = ((ccz - midZ) / toCenter) * inset;
    geometry.pushBoxYaw(midX + insetX, y, midZ + insetZ, length * 0.86, SURFACE_DETAIL_THICKNESS, thickness, yaw, material);
  }
}

/** One wall run per polygon edge, oriented to the edge, carved around any door. */
export function pushPolygonRoomWalls(
  geometry: GeometryWriter,
  points: readonly Vec2[],
  roomId: string,
  doors: readonly LevelDoorDefinition[],
  center: Vec3Tuple,
  shellHeight: number,
  wallMaterial: number,
  accentMaterial: number,
  detailMaterial: number,
  detailMode: BuilderSurfaceDetailMode = "normal",
): number {
  const height = shellHeight;
  const [ccx, ccz] = polygonCentroid(points);
  let segments = 0;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.3) continue;
    const dirX = dx / length;
    const dirZ = dz / length;
    const yaw = Math.atan2(dz, dx);
    const normalX = -dirZ;
    const normalZ = dirX;

    const gaps: Array<[number, number]> = [];
    for (const door of doors) {
      if (door.fromRoomId !== roomId && door.toRoomId !== roomId) continue;
      const dlx = door.position[0] - center[0] - a[0];
      const dlz = door.position[2] - center[2] - a[1];
      const along = dlx * dirX + dlz * dirZ;
      const across = dlx * normalX + dlz * normalZ;
      if (Math.abs(across) > 0.6) continue;
      if (along < -0.2 || along > length + 0.2) continue;
      gaps.push([along - DOOR_GAP_WIDTH / 2, along + DOOR_GAP_WIDTH / 2]);
    }
    gaps.sort((p, q) => p[0] - q[0]);

    let cursor = 0;
    const runs: Array<[number, number]> = [];
    for (const [gapStart, gapEnd] of gaps) {
      if (gapStart > cursor) runs.push([cursor, Math.min(gapStart, length)]);
      cursor = Math.max(cursor, gapEnd);
    }
    if (cursor < length) runs.push([cursor, length]);

    // Inward sign so trim strips sit on the room-facing side.
    const inward = (ccx - ((a[0] + b[0]) / 2)) * normalX + (ccz - ((a[1] + b[1]) / 2)) * normalZ >= 0 ? 1 : -1;

    // Door headers keep the shell continuous above each opening.
    for (const [gapStart, gapEnd] of gaps) {
      const headStart = Math.max(gapStart, 0);
      const headEnd = Math.min(gapEnd, length);
      const headLength = headEnd - headStart;
      if (headLength < 0.3 || height <= DOOR_FRAME_HEIGHT + 0.04) continue;
      const headerHeight = height - DOOR_FRAME_HEIGHT;
      const t = (headStart + headEnd) / 2;
      geometry.pushBoxYaw(a[0] + dirX * t, DOOR_FRAME_HEIGHT + headerHeight / 2, a[1] + dirZ * t, headLength, headerHeight, WALL_THICKNESS, yaw, wallMaterial);
      segments += 1;
    }

    for (const [start, end] of runs) {
      const runLength = end - start;
      if (runLength < 0.24) continue;
      const t = (start + end) / 2;
      const mx = a[0] + dirX * t;
      const mz = a[1] + dirZ * t;
      geometry.pushBoxYaw(mx, height / 2, mz, runLength, height, WALL_THICKNESS, yaw, wallMaterial);
      if (detailMode !== "quiet") {
        geometry.pushBoxYaw(mx, height + 0.025, mz, runLength * 0.99, 0.05, WALL_THICKNESS * 0.99, yaw, accentMaterial);
        // Two inward trim lines for a bit of art on the room-facing side.
        const faceOffset = inward * (WALL_THICKNESS / 2 + 0.018);
        geometry.pushBoxYaw(mx + normalX * faceOffset, height * 0.28, mz + normalZ * faceOffset, runLength * 0.9, 0.035, 0.03, yaw, detailMaterial);
        geometry.pushBoxYaw(mx + normalX * faceOffset, height * 0.72, mz + normalZ * faceOffset, runLength * 0.82, 0.03, 0.03, yaw, detailMaterial);
      }
      segments += 1;
    }
  }
  return segments;
}

function pushWallSurfaceBake(
  geometry: GeometryWriter,
  axis: "x" | "z",
  inward: number,
  lx: number,
  lz: number,
  length: number,
  height: number,
  pattern: BuilderSurfacePattern,
  panelStep: number,
  detailMaterial: number,
  accentMaterial: number,
) {
  const detailDepth = 0.026;
  const faceOffset = inward * (WALL_THICKNESS / 2 + detailDepth / 2 + 0.004);
  const faceX = axis === "x" ? lx : lx + faceOffset;
  const faceZ = axis === "x" ? lz + faceOffset : lz;
  const longSize = Math.max(0.12, length * 0.92);
  const horizontal = (y: number, thickness: number, material = detailMaterial, coverage = 0.9) => {
    if (axis === "x") geometry.pushBox(faceX, y, faceZ, length * coverage, thickness, detailDepth, material);
    else geometry.pushBox(faceX, y, faceZ, detailDepth, thickness, length * coverage, material);
  };
  horizontal(Math.max(0.22, height * 0.28), 0.035, detailMaterial);
  horizontal(Math.min(height - 0.18, height * 0.72), 0.03, pattern === "glass" || pattern === "route" ? accentMaterial : detailMaterial, 0.84);

  if (pattern === "hazard" || pattern === "trim") {
    horizontal(height * 0.5, 0.12, accentMaterial, 0.82);
    return;
  }

  if (pattern === "wainscot" || pattern === "wood") {
    horizontal(height * 0.45, 0.06, detailMaterial, 0.9);
  }

  const seamCount = Math.min(9, Math.max(1, Math.floor(longSize / panelStep)));
  const start = -((seamCount - 1) * panelStep) / 2;
  for (let index = 0; index < seamCount; index += 1) {
    const offset = start + index * panelStep;
    if (Math.abs(offset) > length / 2 - 0.16) continue;
    const x = axis === "x" ? lx + offset : faceX;
    const z = axis === "x" ? faceZ : lz + offset;
    if (axis === "x") geometry.pushBox(x, height * 0.49, z, 0.035, height * 0.72, detailDepth, detailMaterial);
    else geometry.pushBox(x, height * 0.49, z, detailDepth, height * 0.72, 0.035, detailMaterial);
  }
}
