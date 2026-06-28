import type { LevelDefinition, LevelDoorDefinition, LevelMapPropDefinition, LevelRoomDefinition, Vec3Tuple } from "./schema/levelConfig";

export type RoomWallSide = "north" | "south" | "east" | "west";

export interface RoomWallSegment {
  id: string;
  roomId: string;
  side: RoomWallSide;
  position: Vec3Tuple;
  size: Vec3Tuple;
  /**
   * Y rotation (radians) for walls along a non-axis-aligned footprint edge.
   * Absent on the four cardinal walls of a rectangular room (the common case);
   * `size[0]` is the run length along the edge, `size[2]` the wall thickness.
   */
  yaw?: number;
}

export interface PropCollisionProxy {
  id: string;
  modelKey: string;
  position: Vec3Tuple;
  halfSize: Vec3Tuple;
  enemyNavigation?: "solid" | "soft" | "ignore";
}

interface PropColliderDefinition {
  halfSize: Vec3Tuple;
  offset?: Vec3Tuple;
  enemyNavigation?: "solid" | "soft" | "ignore";
}

interface Opening {
  center: number;
  halfSize: number;
}

const wallHeight = 2.65;
const wallThickness = 0.34;
const doorPadding = 0.38;

export function createRoomWallSegments(level: LevelDefinition, predicate: (room: LevelRoomDefinition) => boolean) {
  const map = level.map;
  if (!map) return [];

  const segments: RoomWallSegment[] = [];
  for (const room of map.rooms) {
    if (!predicate(room)) continue;
    segments.push(...segmentsForRoom(room, map.doors));
  }
  return segments;
}

export function createPropCollisionProxies(level: LevelDefinition) {
  const map = level.map;
  if (!map) return [];

  const proxies: PropCollisionProxy[] = [];
  for (const prop of map.props ?? []) {
    const proxy = resolvePropCollisionProxy(prop);
    if (proxy) proxies.push(proxy);
  }
  return proxies;
}

export function resolvePropCollisionProxy(prop: LevelMapPropDefinition): PropCollisionProxy | null {
  if (prop.initiallyVisible === false) return null;

  const explicitCollider = prop.collider ?? null;
  const inferredCollider = explicitCollider ? null : inferPropCollider(prop);
  const collider = explicitCollider ?? inferredCollider;
  if (!collider) return null;

  const yaw = prop.rotation?.[1] ?? 0;
  const halfSize = explicitCollider
    ? collider.halfSize
    : rotateHalfSizeY(scaleHalfSize(collider.halfSize, prop.scale), yaw);
  const offset = explicitCollider
    ? (collider.offset ?? [0, 0, 0])
    : rotateOffsetY(scaleOffset(collider.offset ?? [0, 0, 0], prop.scale), yaw);

  return {
    id: prop.id,
    modelKey: prop.modelKey,
    position: [
      prop.position[0] + offset[0],
      prop.position[1] + offset[1],
      prop.position[2] + offset[2],
    ],
    halfSize,
    ...(enemyNavigationForProp(prop, collider) !== "solid" ? { enemyNavigation: enemyNavigationForProp(prop, collider) } : {}),
  };
}

function enemyNavigationForProp(prop: LevelMapPropDefinition, collider: PropColliderDefinition) {
  if (collider.enemyNavigation) return collider.enemyNavigation;
  const tags = new Set(prop.tags ?? []);
  if (tags.has("enemy_ignore_obstacle")) return "ignore";
  if (tags.has("puzzle_host") || tags.has("future_puzzle_host")) return "ignore";
  if (prop.modelKey === "age_museum_color_orb_pedestal") return "ignore";
  if (tags.has("enemy_soft_obstacle")) return "soft";
  return "solid";
}

function inferPropCollider(prop: LevelMapPropDefinition): PropColliderDefinition | null {
  const tags = new Set(prop.tags ?? []);
  if (prop.modelKey === "hero_maintenance_repair_bay" && tags.has("hero_set_piece")) {
    return { halfSize: [1.55, 0.62, 0.88], offset: [0, 0.58, 0] };
  }
  if (prop.modelKey === "hero_maintenance_repair_arm_cluster" && tags.has("hero_set_piece")) {
    return { halfSize: [0.78, 0.85, 0.95], offset: [0, 0.76, 0] };
  }
  if (prop.modelKey === "room_wall_panel_maintenance" && tags.has("cover")) {
    return { halfSize: [1.18, 0.86, 0.16], offset: [0, 0.82, 0] };
  }
  return null;
}

function segmentsForRoom(room: LevelRoomDefinition, doors: readonly LevelDoorDefinition[]) {
  if (room.bounds.shape) return polygonSegmentsForRoom(room, doors);

  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const minX = cx - sx / 2;
  const maxX = cx + sx / 2;
  const minZ = cz - sz / 2;
  const maxZ = cz + sz / 2;
  const result: RoomWallSegment[] = [];

  addHorizontalWall(result, room, "north", minX, maxX, maxZ, openingsForSide(room, doors, "north"));
  addHorizontalWall(result, room, "south", minX, maxX, minZ, openingsForSide(room, doors, "south"));
  addVerticalWall(result, room, "east", maxX, minZ, maxZ, openingsForSide(room, doors, "east"));
  addVerticalWall(result, room, "west", minX, minZ, maxZ, openingsForSide(room, doors, "west"));

  return result;
}

/** World-space footprint polygon for a room (rect → 4 corners; else stored shape). */
function roomFootprintPolygon(room: LevelRoomDefinition): [number, number][] {
  const [cx, , cz] = room.bounds.center;
  if (room.bounds.shape) {
    return room.bounds.shape.points.map(([x, z]) => [cx + x, cz + z]);
  }
  const [sx, , sz] = room.bounds.size;
  const hx = sx / 2;
  const hz = sz / 2;
  return [
    [cx - hx, cz - hz],
    [cx + hx, cz - hz],
    [cx + hx, cz + hz],
    [cx - hx, cz + hz],
  ];
}

/** One wall run per polygon edge, carved around any door projected onto it. */
function polygonSegmentsForRoom(room: LevelRoomDefinition, doors: readonly LevelDoorDefinition[]) {
  const polygon = roomFootprintPolygon(room);
  const result: RoomWallSegment[] = [];

  for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
    const a = polygon[edgeIndex];
    const b = polygon[(edgeIndex + 1) % polygon.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.05) continue;
    const dirX = dx / length;
    const dirZ = dz / length;
    const yaw = Math.atan2(dz, dx);
    const intervals = carveOpenings(0, length, openingsForEdge(room, doors, a, dirX, dirZ, length));
    intervals.forEach(([start, end], index) => {
      const runLength = end - start;
      if (runLength < 0.35) return;
      const center = (start + end) / 2;
      result.push({
        id: `${room.id}:edge${edgeIndex}:${index}`,
        roomId: room.id,
        side: "north",
        position: [a[0] + dirX * center, wallHeight / 2, a[1] + dirZ * center],
        size: [runLength, wallHeight, wallThickness],
        yaw,
      });
    });
  }

  return result;
}

/** Door openings projected onto a polygon edge (parameter = distance from edge start). */
function openingsForEdge(
  room: LevelRoomDefinition,
  doors: readonly LevelDoorDefinition[],
  a: readonly [number, number],
  dirX: number,
  dirZ: number,
  length: number,
): Opening[] {
  const normalX = -dirZ;
  const normalZ = dirX;
  const openings: Opening[] = [];
  for (const door of doors) {
    if (door.fromRoomId !== room.id && door.toRoomId !== room.id) continue;
    const relX = door.position[0] - a[0];
    const relZ = door.position[2] - a[1];
    const along = relX * dirX + relZ * dirZ;
    const across = relX * normalX + relZ * normalZ;
    if (along < -0.6 || along > length + 0.6) continue;
    if (Math.abs(across) > Math.max(0.8, door.size[2] + 0.55)) continue;
    openings.push({ center: along, halfSize: door.size[0] / 2 + doorPadding });
  }
  return openings;
}

function addHorizontalWall(
  target: RoomWallSegment[],
  room: LevelRoomDefinition,
  side: RoomWallSide,
  minX: number,
  maxX: number,
  z: number,
  openings: readonly Opening[],
) {
  const intervals = carveOpenings(minX, maxX, openings);
  intervals.forEach(([start, end], index) => {
    const length = end - start;
    if (length < 0.35) return;
    target.push({
      id: `${room.id}:${side}:${index}`,
      roomId: room.id,
      side,
      position: [(start + end) / 2, wallHeight / 2, z],
      size: [length, wallHeight, wallThickness],
    });
  });
}

function addVerticalWall(
  target: RoomWallSegment[],
  room: LevelRoomDefinition,
  side: RoomWallSide,
  x: number,
  minZ: number,
  maxZ: number,
  openings: readonly Opening[],
) {
  const intervals = carveOpenings(minZ, maxZ, openings);
  intervals.forEach(([start, end], index) => {
    const length = end - start;
    if (length < 0.35) return;
    target.push({
      id: `${room.id}:${side}:${index}`,
      roomId: room.id,
      side,
      position: [x, wallHeight / 2, (start + end) / 2],
      size: [wallThickness, wallHeight, length],
    });
  });
}

function openingsForSide(room: LevelRoomDefinition, doors: readonly LevelDoorDefinition[], side: RoomWallSide) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const minX = cx - sx / 2;
  const maxX = cx + sx / 2;
  const minZ = cz - sz / 2;
  const maxZ = cz + sz / 2;
  const openings: Opening[] = [];

  for (const door of doors) {
    if (door.fromRoomId !== room.id && door.toRoomId !== room.id) continue;
    const [x, , z] = door.position;
    if ((side === "north" || side === "south") && x >= minX - 0.1 && x <= maxX + 0.1) {
      const boundary = side === "north" ? maxZ : minZ;
      if (Math.abs(z - boundary) <= Math.max(0.8, door.size[2] + 0.55)) {
        openings.push({ center: x, halfSize: door.size[0] / 2 + doorPadding });
      }
    }
    if ((side === "east" || side === "west") && z >= minZ - 0.1 && z <= maxZ + 0.1) {
      const boundary = side === "east" ? maxX : minX;
      if (Math.abs(x - boundary) <= Math.max(0.8, door.size[2] + 0.55)) {
        openings.push({ center: z, halfSize: door.size[0] / 2 + doorPadding });
      }
    }
  }

  return openings;
}

function carveOpenings(min: number, max: number, openings: readonly Opening[]) {
  const sorted = openings
    .map((opening) => [Math.max(min, opening.center - opening.halfSize), Math.min(max, opening.center + opening.halfSize)] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  const intervals: [number, number][] = [];
  let cursor = min;
  for (const [start, end] of sorted) {
    if (start > cursor) intervals.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < max) intervals.push([cursor, max]);
  return intervals;
}

function scaleHalfSize(halfSize: Vec3Tuple, scale: LevelMapPropDefinition["scale"]): Vec3Tuple {
  const scaleVector = scaleVectorFor(scale);
  return [
    halfSize[0] * Math.abs(scaleVector[0]),
    halfSize[1] * Math.abs(scaleVector[1]),
    halfSize[2] * Math.abs(scaleVector[2]),
  ];
}

function scaleOffset(offset: Vec3Tuple, scale: LevelMapPropDefinition["scale"]): Vec3Tuple {
  const scaleVector = scaleVectorFor(scale);
  return [
    offset[0] * scaleVector[0],
    offset[1] * scaleVector[1],
    offset[2] * scaleVector[2],
  ];
}

function scaleVectorFor(scale: LevelMapPropDefinition["scale"]): Vec3Tuple {
  if (typeof scale === "number") return [scale, scale, scale];
  if (scale) return [scale[0], scale[1], scale[2]];
  return [1, 1, 1];
}

function rotateHalfSizeY(halfSize: Vec3Tuple, yaw: number): Vec3Tuple {
  const cos = Math.abs(Math.cos(yaw));
  const sin = Math.abs(Math.sin(yaw));
  return [
    halfSize[0] * cos + halfSize[2] * sin,
    halfSize[1],
    halfSize[0] * sin + halfSize[2] * cos,
  ];
}

function rotateOffsetY(offset: Vec3Tuple, yaw: number): Vec3Tuple {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    offset[0] * cos + offset[2] * sin,
    offset[1],
    -offset[0] * sin + offset[2] * cos,
  ];
}
