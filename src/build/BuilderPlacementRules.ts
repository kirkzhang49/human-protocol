import { pointInPolygon, pointInRoomShape, polygonCentroid, polygonEdges, roomWorldPolygon, type Vec2 } from "./BuilderRoomShape";
import type { BuilderPickupKind, BuilderProject, BuilderPuzzleInstance, BuilderRobotArchetype, BuilderRobotPresetId, BuilderRoom, BuilderRouteSwitch, BuilderRouteSwitchOutput, BuilderWallDoorSwitch, BuilderWallMount } from "./BuilderTypes";

/** Pending catalog asset waiting to be placed by a click in 2D or 3D. */
export type PlacementDraft =
  | { kind: "prop"; modelKey: string; rotationY: number }
  | { kind: "pickup"; pickupKind: BuilderPickupKind }
  | { kind: "robot"; archetype: BuilderRobotArchetype; presetId?: BuilderRobotPresetId }
  | { kind: "routeSwitch" };

export function snapStep(value: number, step = 0.5) {
  return Math.round(value / step) * step;
}

/** The room whose footprint contains (x, z), if any. */
export function roomAt(project: BuilderProject, x: number, z: number): BuilderRoom | null {
  return project.rooms.find((room) => pointInRoomShape(room, x, z)) ?? null;
}

/**
 * Wall-band thickness (meters) within which a floor click selects the ROOM.
 * Open floor never selects the room — only its walls do. ~0.5m is a comfortable
 * pick target around the ~0.36m visual wall slab and mirrors the 2D plan's
 * stroke-only wall hit so both editors agree.
 */
export const ROOM_WALL_PICK_BAND = 0.5;

/** Distance from point (px,pz) to segment (ax,az)-(bx,bz). */
function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq)) : 0;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** True when (x,z) is inside `room` AND within `band` of one of its walls. */
export function pointNearRoomWall(room: BuilderRoom, x: number, z: number, band = ROOM_WALL_PICK_BAND): boolean {
  if (!pointInRoomShape(room, x, z)) return false;
  const polygon = roomWorldPolygon(room);
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (distanceToSegment(x, z, a[0], a[1], b[0], b[1]) <= band) return true;
  }
  return false;
}

/** Clamps a point to stay inside a room with a margin off the walls. */
export function clampIntoRoom(room: BuilderRoom, x: number, z: number, margin = 0.5): readonly [number, number] {
  const bx = Math.min(room.center[0] + room.size[0] / 2 - margin, Math.max(room.center[0] - room.size[0] / 2 + margin, x));
  const bz = Math.min(room.center[1] + room.size[1] / 2 - margin, Math.max(room.center[1] - room.size[1] / 2 + margin, z));
  if (!room.shape) return [bx, bz];
  // Shaped rooms: if the bbox-clamped point is still outside the polygon, walk
  // it toward the centroid until it lands inside.
  const polygon = roomWorldPolygon(room);
  if (pointInPolygon(polygon, bx, bz)) return [bx, bz];
  const [ccx, ccz] = polygonCentroid(polygon);
  for (let t = 0.15; t <= 1.0001; t += 0.15) {
    const px = bx + (ccx - bx) * t;
    const pz = bz + (ccz - bz) * t;
    if (pointInPolygon(polygon, px, pz)) return [px, pz];
  }
  return [ccx, ccz];
}

/** Badge-row fallback slot for robot groups without a free position. */
export function robotFallbackSlot(room: BuilderRoom, index: number): readonly [number, number] {
  return [room.center[0] - room.size[0] / 2 + 1.25 + index * 1.55, room.center[1] + room.size[1] / 2 - 1.25];
}

export function robotDisplayPosition(
  project: BuilderProject,
  robotId: string,
): { x: number; z: number; room: BuilderRoom } | null {
  const robot = project.robots.find((candidate) => candidate.id === robotId);
  if (!robot) return null;
  const room = project.rooms.find((candidate) => candidate.id === robot.roomId);
  if (!room) return null;
  if (robot.position) return { x: robot.position[0], z: robot.position[1], room };
  const index = project.robots.filter((candidate) => candidate.roomId === robot.roomId).findIndex((candidate) => candidate.id === robotId);
  const [x, z] = robotFallbackSlot(room, Math.max(0, index));
  return { x, z, room };
}

const ROUTE_OUTPUT_KEY_OFFSETS: readonly (readonly [number, number])[] = [
  [-0.34, -0.28],
  [0.34, -0.28],
  [-0.34, 0.28],
  [0.34, 0.28],
];

/** Legacy / imported default placement for a route console's generated keys. */
export function routeKeyPosition(project: BuilderProject, route: BuilderRouteSwitch): readonly [number, number] {
  if (route.keyPosition) return route.keyPosition;
  const keyRoom = project.rooms.find((room) => room.id === route.keyRoomId);
  if (keyRoom) return keyRoom.center;
  return route.position;
}

/** Visible /build placement for one route output's pickup authorization orb. */
export function routeOutputKeyPosition(
  project: BuilderProject,
  route: BuilderRouteSwitch,
  output: BuilderRouteSwitchOutput,
  index: number,
): readonly [number, number] {
  const keyRoom = project.rooms.find((room) => room.id === (output.keyRoomId ?? route.keyRoomId));
  const offset = ROUTE_OUTPUT_KEY_OFFSETS[index] ?? [0, 0];
  const anchor = output.keyPosition
    ?? (route.keyPosition ? ([route.keyPosition[0] + offset[0], route.keyPosition[1] + offset[1]] as const) : undefined)
    ?? (keyRoom ? ([keyRoom.center[0] + offset[0], keyRoom.center[1] + offset[1]] as const) : route.position);
  return keyRoom ? clampIntoRoom(keyRoom, anchor[0], anchor[1], 0.8) : anchor;
}

export interface WallMountPlacement {
  plan: readonly [number, number];
  position: readonly [number, number, number];
  yaw: number;
}

export const WALL_MOUNTED_PROP_AUTO_ALIGN_BAND = 0.85;
export const WALL_MOUNTED_PROP_SURFACE_GAP = 0.005;
export const WALL_MOUNTED_PROP_RECT_WALL_SURFACE_INSET = 0.3;
export const WALL_MOUNTED_PROP_SHAPED_WALL_SURFACE_INSET = 0.15;
export type WallMountedPropFace = "+z" | "-z";
type PolygonWallEdge = ReturnType<typeof polygonEdges>[number];

const DEFAULT_WALL_MOUNT_INSET = 0.18;
const DEFAULT_WALL_MOUNT_HEIGHT = 1.34;

const wallSideInward: Record<BuilderWallMount["side"], Vec2> = {
  north: [0, 1],
  south: [0, -1],
  west: [1, 0],
  east: [-1, 0],
};

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function sideFromInward(inward: Vec2): BuilderWallMount["side"] {
  if (Math.abs(inward[0]) > Math.abs(inward[1])) return inward[0] >= 0 ? "west" : "east";
  return inward[1] >= 0 ? "north" : "south";
}

function distanceToEdge(px: number, pz: number, edge: PolygonWallEdge) {
  return distanceToSegment(px, pz, edge.a[0], edge.a[1], edge.b[0], edge.b[1]);
}

function yawForWallMountedPropFace(baseYaw: number, face: WallMountedPropFace = "+z"): number {
  return face === "-z" ? baseYaw + Math.PI : baseYaw;
}

function wallMountedPropSurfaceInset(room: BuilderRoom): number {
  return room.shape ? WALL_MOUNTED_PROP_SHAPED_WALL_SURFACE_INSET : WALL_MOUNTED_PROP_RECT_WALL_SURFACE_INSET;
}

function wallMountPlacementOnEdge(
  edge: PolygonWallEdge,
  inward: Vec2,
  offset: number,
  height: number,
  inset: number,
): WallMountPlacement {
  const travel = Math.max(0, edge.length * 0.5 - 0.8);
  const t = edge.length * 0.5 + clampUnit(offset) * travel;
  const px = edge.a[0] + edge.dir[0] * t + inward[0] * inset;
  const pz = edge.a[1] + edge.dir[1] * t + inward[1] * inset;
  return {
    plan: [px, pz],
    position: [px, height, pz],
    yaw: Math.atan2(inward[0], inward[1]),
  };
}

function nearestWallMountFromPoint(
  room: BuilderRoom,
  x: number,
  z: number,
): (BuilderWallMount & { distance: number; edge: PolygonWallEdge; inward: Vec2 }) | null {
  const edges = polygonEdges(roomWorldPolygon(room));
  let best: { distance: number; edge: PolygonWallEdge; inward: Vec2; offset: number; side: BuilderWallMount["side"] } | null = null;
  for (const edge of edges) {
    const distance = distanceToEdge(x, z, edge);
    const along = (x - edge.a[0]) * edge.dir[0] + (z - edge.a[1]) * edge.dir[1];
    const travel = Math.max(0.001, edge.length * 0.5 - 0.8);
    const offset = clampUnit((along - edge.length * 0.5) / travel);
    const inward: Vec2 = [-edge.dir[1], edge.dir[0]];
    const side = sideFromInward(inward);
    if (!best || distance < best.distance) best = { distance, edge, inward, offset, side };
  }
  return best
    ? { side: best.side, offset: best.offset, distance: best.distance, edge: best.edge, inward: best.inward }
    : null;
}

export function wallMountPlacementForRoom(room: BuilderRoom, mount: BuilderWallMount): WallMountPlacement {
  const inset = mount.inset ?? DEFAULT_WALL_MOUNT_INSET;
  const height = mount.height ?? DEFAULT_WALL_MOUNT_HEIGHT;
  const offset = clampUnit(mount.offset);
  const targetInward = wallSideInward[mount.side];
  const edges = polygonEdges(roomWorldPolygon(room));
  const best = edges
    .map((edge) => {
      // roomWorldPolygon is authored counter-clockwise; the left normal points inward.
      const inward: Vec2 = [-edge.dir[1], edge.dir[0]];
      const score = inward[0] * targetInward[0] + inward[1] * targetInward[1];
      return { edge, inward, score };
    })
    .sort((a, b) => b.score - a.score || b.edge.length - a.edge.length)[0];

  if (!best) {
    const [cx, cz] = room.center;
    return { plan: [cx, cz], position: [cx, height, cz], yaw: 0 };
  }

  return wallMountPlacementOnEdge(best.edge, best.inward, offset, height, inset);
}

export function wallMountFromPoint(room: BuilderRoom, x: number, z: number): BuilderWallMount {
  const best = nearestWallMountFromPoint(room, x, z);
  return best ? { side: best.side, offset: best.offset } : { side: "north", offset: 0 };
}

export interface WallMountedPropPlacementOptions {
  height?: number;
  inset?: number;
  maxWallDistance?: number;
  wallMountFace?: WallMountedPropFace;
}

export interface WallMountedPropEntryPlacementOptions extends WallMountedPropPlacementOptions {
  sizeMeters: readonly [number, number, number];
  scale?: number;
  surfaceGap?: number;
}

export function wallMountedPropPlacementFromPoint(
  room: BuilderRoom,
  x: number,
  z: number,
  options: WallMountedPropPlacementOptions = {},
): WallMountPlacement | null {
  const best = nearestWallMountFromPoint(room, x, z);
  if (!best) return null;
  const maxWallDistance = options.maxWallDistance ?? WALL_MOUNTED_PROP_AUTO_ALIGN_BAND;
  if (best.distance > maxWallDistance) return null;
  const placement = wallMountPlacementOnEdge(
    best.edge,
    best.inward,
    best.offset,
    options.height ?? DEFAULT_WALL_MOUNT_HEIGHT,
    options.inset ?? DEFAULT_WALL_MOUNT_INSET,
  );
  return { ...placement, yaw: yawForWallMountedPropFace(placement.yaw, options.wallMountFace) };
}

export function wallMountedPropPlacementForEntryFromPoint(
  room: BuilderRoom,
  x: number,
  z: number,
  options: WallMountedPropEntryPlacementOptions,
): WallMountPlacement | null {
  const scale = options.scale ?? 1;
  const depth = Math.max(0.01, options.sizeMeters[2] * scale);
  const inset = options.inset ?? wallMountedPropSurfaceInset(room) + depth / 2 + (options.surfaceGap ?? WALL_MOUNTED_PROP_SURFACE_GAP);
  const maxWallDistance = options.maxWallDistance ?? Number.POSITIVE_INFINITY;
  return wallMountedPropPlacementFromPoint(room, x, z, { ...options, inset, maxWallDistance });
}

export function wallMountedPropRotationYFromPoint(
  room: BuilderRoom,
  x: number,
  z: number,
  fallbackRotationY: number,
  options: Pick<WallMountedPropPlacementOptions, "maxWallDistance" | "wallMountFace"> = {},
): number {
  return wallMountedPropPlacementFromPoint(room, x, z, {
    maxWallDistance: options.maxWallDistance,
    inset: 0,
    wallMountFace: options.wallMountFace,
  })?.yaw ?? fallbackRotationY;
}

export function wallDoorSwitchPlacement(project: BuilderProject, wallSwitch: BuilderWallDoorSwitch): WallMountPlacement | null {
  const room = project.rooms.find((candidate) => candidate.id === wallSwitch.roomId);
  if (!room) return null;
  return wallMountPlacementForRoom(room, wallSwitch.wallMount);
}

export function wallDoorSwitchPlanPosition(project: BuilderProject, wallSwitch: BuilderWallDoorSwitch): readonly [number, number] | null {
  return wallDoorSwitchPlacement(project, wallSwitch)?.plan ?? null;
}

export function puzzleWallMountPlacement(project: BuilderProject, puzzle: Pick<BuilderPuzzleInstance, "roomId" | "wallMount">): WallMountPlacement | null {
  if (!puzzle.wallMount) return null;
  const room = project.rooms.find((candidate) => candidate.id === puzzle.roomId);
  if (!room) return null;
  return wallMountPlacementForRoom(room, puzzle.wallMount);
}

export function puzzlePlanPosition(project: BuilderProject, puzzle: Pick<BuilderPuzzleInstance, "roomId" | "position" | "wallMount">): readonly [number, number] {
  return puzzleWallMountPlacement(project, puzzle)?.plan ?? puzzle.position;
}

/** Moves a prop/robot to (x, z): snaps, requires a room, reassigns roomId. */
export function placementAt(project: BuilderProject, rawX: number, rawZ: number, step = 0.5) {
  const x = snapStep(rawX, step);
  const z = snapStep(rawZ, step);
  const room = roomAt(project, x, z);
  return { x, z, room, valid: room !== null };
}

export type FloorPick =
  | { kind: "robot" | "prop" | "pickup" | "door" | "room" | "routeSwitch" | "routeKey" | "wallDoorSwitch"; id: string }
  | { kind: "routeOutputKey"; id: string; outputId: string }
  | { kind: "puzzle"; id: string; componentId?: string }
  | null;

/**
 * Plan-space hit test for the 3D floor editor: given a point on the floor,
 * returns the most specific object under it. Priority: puzzle components >
 * puzzle terminals > robots > props > doors > room floor — puzzle objects
 * are small and must never lose clicks to the floor underneath them.
 */
export function pickAt(
  project: BuilderProject,
  x: number,
  z: number,
  propFootprint: (modelKey: string) => readonly [number, number] | null,
  doorEdges: readonly { id: string; x: number; z: number; yaw: number }[],
): FloorPick {
  // Puzzle orbs/components first (smallest targets, generous radius).
  let bestComponent: { instanceId: string; componentId: string; distance: number } | null = null;
  for (const instance of project.puzzles ?? []) {
    for (const component of instance.components ?? []) {
      const distance = Math.hypot(component.position[0] - x, component.position[1] - z);
      if (distance <= 0.75 && (!bestComponent || distance < bestComponent.distance)) {
        bestComponent = { instanceId: instance.id, componentId: component.id, distance };
      }
    }
  }
  if (bestComponent) return { kind: "puzzle", id: bestComponent.instanceId, componentId: bestComponent.componentId };

  // Puzzle terminals next.
  let bestTerminal: { id: string; distance: number } | null = null;
  for (const instance of project.puzzles ?? []) {
    const distance = Math.hypot(instance.position[0] - x, instance.position[1] - z);
    if (distance <= 0.85 && (!bestTerminal || distance < bestTerminal.distance)) {
      bestTerminal = { id: instance.id, distance };
    }
  }
  if (bestTerminal) return { kind: "puzzle", id: bestTerminal.id };

  let bestRouteOutputKey: { id: string; outputId: string; distance: number } | null = null;
  for (const route of project.routeSwitches ?? []) {
    const outputs = route.outputs.slice(0, 4);
    for (let index = 0; index < outputs.length; index += 1) {
      const output = outputs[index];
      const [keyX, keyZ] = routeOutputKeyPosition(project, route, output, index);
      const distance = Math.hypot(keyX - x, keyZ - z);
      if (distance <= 0.78 && (!bestRouteOutputKey || distance < bestRouteOutputKey.distance)) {
        bestRouteOutputKey = { id: route.id, outputId: output.id, distance };
      }
    }
  }
  if (bestRouteOutputKey) return { kind: "routeOutputKey", id: bestRouteOutputKey.id, outputId: bestRouteOutputKey.outputId };

  let bestRouteKey: { id: string; distance: number } | null = null;
  for (const route of project.routeSwitches ?? []) {
    if (route.outputs.length > 0) continue;
    const [keyX, keyZ] = routeKeyPosition(project, route);
    const distance = Math.hypot(keyX - x, keyZ - z);
    if (distance <= 0.78 && (!bestRouteKey || distance < bestRouteKey.distance)) bestRouteKey = { id: route.id, distance };
  }
  if (bestRouteKey) return { kind: "routeKey", id: bestRouteKey.id };

  let bestRoute: { id: string; distance: number } | null = null;
  for (const route of project.routeSwitches ?? []) {
    const distance = Math.hypot(route.position[0] - x, route.position[1] - z);
    if (distance <= 0.9 && (!bestRoute || distance < bestRoute.distance)) bestRoute = { id: route.id, distance };
  }
  if (bestRoute) return { kind: "routeSwitch", id: bestRoute.id };

  let bestWallSwitch: { id: string; distance: number } | null = null;
  for (const wallSwitch of project.wallDoorSwitches ?? []) {
    const position = wallDoorSwitchPlanPosition(project, wallSwitch);
    if (!position) continue;
    const distance = Math.hypot(position[0] - x, position[1] - z);
    if (distance <= 0.85 && (!bestWallSwitch || distance < bestWallSwitch.distance)) bestWallSwitch = { id: wallSwitch.id, distance };
  }
  if (bestWallSwitch) return { kind: "wallDoorSwitch", id: bestWallSwitch.id };

  let bestPickup: { id: string; distance: number } | null = null;
  for (const pickup of project.pickups ?? []) {
    const distance = Math.hypot(pickup.position[0] - x, pickup.position[1] - z);
    const pickRadius = pickup.kind === "key_item" ? 1.1 : 0.72;
    if (distance <= pickRadius && (!bestPickup || distance < bestPickup.distance)) bestPickup = { id: pickup.id, distance };
  }
  if (bestPickup) return { kind: "pickup", id: bestPickup.id };

  let bestRobot: { id: string; distance: number } | null = null;
  for (const robot of project.robots) {
    const spot = robotDisplayPosition(project, robot.id);
    if (!spot) continue;
    const distance = Math.hypot(spot.x - x, spot.z - z);
    if (distance <= 0.85 && (!bestRobot || distance < bestRobot.distance)) bestRobot = { id: robot.id, distance };
  }
  if (bestRobot) return { kind: "robot", id: bestRobot.id };

  // Iterate top-most (latest placed) first.
  for (let index = project.props.length - 1; index >= 0; index -= 1) {
    const prop = project.props[index];
    const size = propFootprint(prop.modelKey);
    if (!size) continue;
    const dx = x - prop.position[0];
    const dz = z - prop.position[1];
    // Inverse-rotate the point into the prop's local frame.
    const cos = Math.cos(prop.rotationY);
    const sin = Math.sin(prop.rotationY);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    const halfW = (size[0] * prop.scale) / 2 + 0.18;
    const halfD = (size[1] * prop.scale) / 2 + 0.18;
    if (Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD) return { kind: "prop", id: prop.id };
  }

  for (const edge of doorEdges) {
    // Project onto the door's wall tangent (yaw) so picking follows angled doors.
    const dx = x - edge.x;
    const dz = z - edge.z;
    const cos = Math.cos(edge.yaw);
    const sin = Math.sin(edge.yaw);
    const along = Math.abs(dx * cos + dz * sin);
    const across = Math.abs(-dx * sin + dz * cos);
    if (along <= 1.9 && across <= 0.95) return { kind: "door", id: edge.id };
  }

  // In 3D the whole room floor is a room handle after smaller objects and doors
  // have had priority. This keeps shaped rooms draggable: their thin walls are
  // too hard to grab reliably from an angled camera.
  const room = roomAt(project, x, z);
  return room ? { kind: "room", id: room.id } : null;
}

/**
 * Resting Y for a prop dropped at (x, z): the top surface of the top-most prop
 * whose footprint contains (x, z), else 0 (the floor). Mirrors pickAt's
 * top-most-first rotated-OBB test so "what's underneath" matches what would be
 * selected. Callbacks are injected (same pattern as pickAt's propFootprint) to
 * avoid an import cycle with the asset catalog. Pass the REAL footprint here, not
 * the widened pick footprint, so stacking detection stays physically accurate.
 */
export function propTopSurfaceAt(
  project: BuilderProject,
  x: number,
  z: number,
  propFootprint: (modelKey: string) => readonly [number, number] | null,
  propHeight: (modelKey: string) => number,
  propElevation: (modelKey: string) => number,
  excludeId?: string,
): number {
  for (let index = project.props.length - 1; index >= 0; index -= 1) {
    const prop = project.props[index];
    if (prop.id === excludeId) continue;
    const size = propFootprint(prop.modelKey);
    if (!size) continue;
    const dx = x - prop.position[0];
    const dz = z - prop.position[1];
    const cos = Math.cos(prop.rotationY);
    const sin = Math.sin(prop.rotationY);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    const halfW = (size[0] * prop.scale) / 2;
    const halfD = (size[1] * prop.scale) / 2;
    if (Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD) {
      return (prop.elevation ?? propElevation(prop.modelKey)) + propHeight(prop.modelKey) * prop.scale;
    }
  }
  return 0;
}
