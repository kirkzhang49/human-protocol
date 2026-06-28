import {
  createBuilderId,
  createStarterProject,
  type BuilderDoor,
  type BuilderProject,
  type BuilderPuzzleInstance,
  type BuilderRoom,
  type BuilderRoomStyle,
} from "./BuilderTypes";
import { polygonCentroid, polygonEdges, roomWorldPolygon, shapeBboxSize, type Vec2 } from "./BuilderRoomShape";
import { sharedEdge } from "./compileBuilderProjectToLevel";

// ---------------------------------------------------------------------------
// Quick-start templates
// ---------------------------------------------------------------------------

export interface BuilderTemplateEntry {
  id: string;
  label: string;
  hint: string;
  create: () => BuilderProject;
}

export const builderTemplates: readonly BuilderTemplateEntry[] = [
  {
    id: "branch",
    label: "分支密室（示例）",
    hint: "走廊分出钥匙房，清剿后撤离",
    create: createStarterProject,
  },
  {
    id: "linear",
    label: "线性三室",
    hint: "最短可玩：钥匙 → 清剿 → 出口",
    create: () => projectFromRooms("线性密室", [
      room("出生舱", "sterile", [0, 8], [9, 6]),
      room("封锁走廊", "hazard", [0, 1], [8, 8]),
      room("撤离电梯", "exit", [0, -5.5], [6, 5]),
    ], (rooms) => ({
      doors: [
        { id: createBuilderId("door"), fromRoomId: rooms[0].id, toRoomId: rooms[1].id, lockType: "key_item" as const, keyRoomId: rooms[0].id },
        { id: createBuilderId("door"), fromRoomId: rooms[1].id, toRoomId: rooms[2].id, lockType: "survive_wave" as const },
      ],
      robots: [
        { id: createBuilderId("robot"), roomId: rooms[1].id, archetype: "repair_drone" as const, count: 2 },
      ],
      props: [
        prop("room_table_utility", rooms[0].id, [-2.8, 9.4]),
        prop("room_crate_stack", rooms[1].id, [2.6, -1.4]),
        prop("room_museum_low_barrier", rooms[1].id, [-2.4, 1], Math.PI / 2),
      ],
      exitRoomId: rooms[2].id,
    })),
  },
  {
    id: "loop",
    label: "环形四室",
    hint: "两条路通向出口，谜题锁短路",
    create: () => projectFromRooms("环形密室", [
      room("出生实验间", "sterile", [-5.5, 6], [9, 8]),
      room("观察走廊", "hazard", [5, 6], [12, 8]),
      room("维修机房", "maintenance", [-5.5, -3], [9, 10]),
      room("撤离电梯", "exit", [5, -2], [12, 8]),
    ], (rooms) => ({
      doors: [
        { id: createBuilderId("door"), fromRoomId: rooms[0].id, toRoomId: rooms[1].id, lockType: "none" as const },
        { id: createBuilderId("door"), fromRoomId: rooms[0].id, toRoomId: rooms[2].id, lockType: "none" as const },
        { id: createBuilderId("door"), fromRoomId: rooms[1].id, toRoomId: rooms[3].id, lockType: "puzzle_complete" as const },
        { id: createBuilderId("door"), fromRoomId: rooms[2].id, toRoomId: rooms[3].id, lockType: "survive_wave" as const },
      ],
      robots: [
        { id: createBuilderId("robot"), roomId: rooms[2].id, archetype: "clamp_bot" as const, count: 2 },
        { id: createBuilderId("robot"), roomId: rooms[3].id, archetype: "repair_drone" as const, count: 2 },
      ],
      props: [
        prop("room_museum_color_orb_pedestal", rooms[1].id, [7.5, 4.4]),
        prop("room_museum_wall_label_panel", rooms[1].id, [3, 2.6]),
        prop("room_maintenance_supply_cabinet", rooms[2].id, [-8.6, -6.4]),
        prop("room_crate_stack", rooms[2].id, [-2.6, -5.8]),
      ],
      puzzle: { roomId: rooms[1].id, clueRoomId: rooms[0].id, sequence: ["blue", "yellow", "red"] as const },
      exitRoomId: rooms[3].id,
    })),
  },
  {
    id: "boss",
    label: "Boss 终局",
    hint: "钥匙房 → 精英清剿 → 出口",
    create: () => projectFromRooms("终局密室", [
      room("出生舱", "sterile", [0, 10], [8, 6]),
      room("档案前厅", "residential", [0, 3], [10, 8]),
      room("管理者大厅", "hazard", [0, -6], [14, 10]),
      room("撤离电梯", "exit", [0, -13.5], [6, 5]),
    ], (rooms) => ({
      doors: [
        { id: createBuilderId("door"), fromRoomId: rooms[0].id, toRoomId: rooms[1].id, lockType: "none" as const },
        { id: createBuilderId("door"), fromRoomId: rooms[1].id, toRoomId: rooms[2].id, lockType: "key_item" as const, keyRoomId: rooms[1].id },
        { id: createBuilderId("door"), fromRoomId: rooms[2].id, toRoomId: rooms[3].id, lockType: "survive_wave" as const },
      ],
      robots: [
        { id: createBuilderId("robot"), roomId: rooms[2].id, archetype: "custodian_elite" as const, count: 1, tier: "elite" as const },
        { id: createBuilderId("robot"), roomId: rooms[2].id, archetype: "clamp_bot" as const, count: 2 },
      ],
      props: [
        prop("room_fake_family_photo_wall", rooms[1].id, [0, 0.4]),
        prop("room_lounge_sofa_residential", rooms[1].id, [-3.2, 4.6]),
        prop("room_museum_archive_column", rooms[2].id, [-5.4, -8.6]),
        prop("room_museum_archive_column", rooms[2].id, [5.4, -8.6]),
        prop("room_museum_low_barrier", rooms[2].id, [0, -3], Math.PI / 2),
      ],
      exitRoomId: rooms[3].id,
    })),
  },
];

function room(label: string, style: BuilderRoomStyle, center: readonly [number, number], size: readonly [number, number]): BuilderRoom {
  return { id: createBuilderId("room"), label, style, center, size };
}

function prop(modelKey: string, roomId: string, position: readonly [number, number], rotationY = 0) {
  return { id: createBuilderId("prop"), modelKey, roomId, position, rotationY, scale: 1 };
}

/** A single empty room — the "start from scratch" option in the first-run picker. */
export function createBlankProject(): BuilderProject {
  const only = room("房间 1", "sterile", [0, 0], [10, 8]);
  return {
    schemaVersion: "hp.builder.v1",
    projectId: createBuilderId("proj"),
    title: "新密室",
    rooms: [only],
    doors: [],
    props: [],
    robots: [],
    exitRoomId: only.id,
  };
}

export interface AutoDoorPlacement {
  project: BuilderProject;
  fromRoomId: string;
  toRoomId: string;
  aligned: boolean;
}

/** Finds a valid door pair; if needed, returns a copy with one room auto-snapped onto a shared edge. */
export function findAutoDoorPlacement(project: BuilderProject, preferredRoomId?: string): AutoDoorPlacement | null {
  const existing = new Set(project.doors.map((door) => doorPairKey(door.fromRoomId, door.toRoomId)));
  const pairs = doorCandidatePairs(project.rooms, existing, preferredRoomId);
  for (const pair of pairs) {
    if (sharedEdge(pair.from, pair.to)) {
      return { project, fromRoomId: pair.from.id, toRoomId: pair.to.id, aligned: false };
    }
  }
  for (const pair of pairs) {
    const alignOrders =
      pair.from.shape && !pair.to.shape
        ? [[pair.to.id, pair.from.id] as const]
        : pair.to.shape && !pair.from.shape
          ? [[pair.from.id, pair.to.id] as const]
          : [[pair.from.id, pair.to.id] as const, [pair.to.id, pair.from.id] as const];
    const aligned = alignOrders
      .map(([anchorRoomId, movableRoomId]) => alignRoomPairForDoor(project, anchorRoomId, movableRoomId))
      .find((candidate): candidate is DoorRoomAlignment => Boolean(candidate));
    if (aligned) {
      return { project: aligned.project, fromRoomId: pair.from.id, toRoomId: pair.to.id, aligned: true };
    }
  }
  return null;
}

function projectFromRooms(
  title: string,
  rooms: BuilderRoom[],
  rest: (rooms: BuilderRoom[]) => Pick<BuilderProject, "doors" | "robots" | "props" | "exitRoomId"> & Partial<Pick<BuilderProject, "puzzle">>,
): BuilderProject {
  return {
    schemaVersion: "hp.builder.v1",
    projectId: createBuilderId("proj"),
    title,
    rooms,
    ...rest(rooms),
  };
}

// ---------------------------------------------------------------------------
// "Make It Playable" auto-repair
// ---------------------------------------------------------------------------

export function repairProject(project: BuilderProject): { project: BuilderProject; fixes: string[] } {
  const fixes: string[] = [];
  let next: BuilderProject = {
    ...project,
    rooms: [...project.rooms],
    doors: [...project.doors],
    robots: [...project.robots],
    puzzles: project.puzzles ? [...project.puzzles] : project.puzzles,
    routeSwitches: project.routeSwitches
      ? project.routeSwitches.map((route) => ({ ...route, outputs: [...route.outputs] }))
      : project.routeSwitches,
    wallDoorSwitches: project.wallDoorSwitches
      ? project.wallDoorSwitches.map((wallSwitch) => ({
          ...wallSwitch,
          wallMount: { ...wallSwitch.wallMount },
          states: wallSwitch.states.map((state) => ({
            ...state,
            openDoorIds: state.openDoorIds ? [...state.openDoorIds] : state.openDoorIds,
            closeDoorIds: state.closeDoorIds ? [...state.closeDoorIds] : state.closeDoorIds,
          })),
        }))
      : project.wallDoorSwitches,
  };

  // Exit room must exist and differ from spawn when possible.
  if (!next.rooms.some((candidate) => candidate.id === next.exitRoomId)) {
    next.exitRoomId = next.rooms[next.rooms.length - 1]?.id ?? "";
    fixes.push("出口房间无效，已指向最后一个房间。");
  }
  if (next.rooms.length > 1 && next.exitRoomId === next.rooms[0].id) {
    next.exitRoomId = next.rooms[next.rooms.length - 1].id;
    fixes.push("出口和出生重合，已把出口移到最后一个房间。");
  }

  // Pull almost-touching rooms together so they share an edge.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < next.rooms.length; i += 1) {
      for (let j = i + 1; j < next.rooms.length; j += 1) {
        if (sharedEdge(next.rooms[i], next.rooms[j])) continue;
        const snapped = snapRoomToward(next.rooms[j], next.rooms[i]);
        if (snapped) {
          next.rooms[j] = snapped;
          fixes.push(`「${next.rooms[j].label}」已贴合到「${next.rooms[i].label}」。`);
        }
      }
    }
  }

  // The lamp-sequence puzzle is intentionally unique: the room owns one wall
  // playback sequence. Extra copies become 2D circuit consoles instead.
  const colorPuzzleIds = (next.puzzles ?? []).filter((instance) => instance.kind === "color_sequence").map((instance) => instance.id);
  if (colorPuzzleIds.length > 1) {
    const [keepId, ...convertIds] = colorPuzzleIds;
    const convertSet = new Set(convertIds);
    next = {
      ...next,
      puzzles: (next.puzzles ?? []).map((instance) => {
        if (!convertSet.has(instance.id)) return instance;
        const { components: _components, ...rest } = instance;
        return { ...rest, kind: "circuit_grid" };
      }),
      doors: next.doors.map((door) => {
        const instance = next.puzzles?.find((candidate) => candidate.linkedDoorId === door.id);
        if (!instance || door.lockType !== "puzzle_complete") return door;
        if (instance.id === keepId) return { ...door, puzzleKind: undefined };
        if (convertSet.has(instance.id)) return { ...door, puzzleKind: "circuit_grid" };
        return door;
      }),
    };
    fixes.push(`检测到 ${colorPuzzleIds.length} 座灯序锁，已保留第一座，其余改为线路校准。`);
  }

  // A survive-wave door should name the room that will actually be cleared as
  // fromRoomId. If the exit room is on the from side, the door can become a
  // self-locking exit. Swap it so the pre-exit room owns the fight.
  if (next.exitRoomId) {
    next = {
      ...next,
      doors: next.doors.map((door) => {
        if (door.lockType !== "survive_wave" || door.fromRoomId !== next.exitRoomId || door.toRoomId === next.exitRoomId) return door;
        const from = next.rooms.find((room) => room.id === door.fromRoomId);
        const to = next.rooms.find((room) => room.id === door.toRoomId);
        fixes.push(`「${from?.label ?? "出口"}」前的清剿门方向已调整为先清「${to?.label ?? door.toRoomId}」。`);
        return { ...door, fromRoomId: door.toRoomId, toRoomId: door.fromRoomId };
      }),
    };
  }

  // Remove doors that still do not have a real shared edge after snapping. A
  // visual line between separated rooms cannot compile into a playable door.
  next = repairInvalidDoorRooms(next, fixes);
  const removedDoorIds = invalidDoorIds(next);
  if (removedDoorIds.size > 0) {
    next = removeDoorsAndDanglingLinks(next, removedDoorIds);
    fixes.push(`仍有 ${removedDoorIds.size} 扇门无法自动贴边，已移除并清理相关谜题/路由输出。`);
  }

  // Connect unreachable rooms with doors, snapping an isolated room beside the nearest reachable room when needed.
  const reach = () => reachableFrom(next.rooms[0]?.id ?? "", next);
  let guard = 0;
  while (next.rooms.length > 0 && guard < 8) {
    guard += 1;
    const reachable = reach();
    const missing = next.rooms.find((candidate) => !reachable.has(candidate.id));
    if (!missing) break;
    let partner = next.rooms.find((candidate) => reachable.has(candidate.id) && sharedEdge(candidate, missing));
    if (!partner) {
      partner = nearestRoom(missing, next.rooms.filter((candidate) => reachable.has(candidate.id))) ?? undefined;
      if (!partner) break;
      const aligned = alignRoomPairForDoor(next, partner.id, missing.id);
      if (!aligned) break;
      next = aligned.project;
      partner = next.rooms.find((candidate) => candidate.id === partner?.id);
      if (!partner) break;
      fixes.push(`「${missing.label}」已贴合到「${partner?.label ?? "可达房间"}」，用于补通路。`);
    }
    next.doors.push({ id: createBuilderId("door"), fromRoomId: partner.id, toRoomId: missing.id, lockType: "none" });
    fixes.push(`已在「${partner.label}」和「${missing.label}」之间补门。`);
  }

  // Survive-wave doors need robots in their "from" room.
  for (const door of next.doors) {
    if (door.lockType !== "survive_wave") continue;
    if (next.robots.some((robot) => robot.roomId === door.fromRoomId)) continue;
    const fromRoom = next.rooms.find((candidate) => candidate.id === door.fromRoomId);
    next.robots.push({ id: createBuilderId("robot"), roomId: door.fromRoomId, archetype: "repair_drone", count: 2 });
    fixes.push(`「${fromRoom?.label ?? door.fromRoomId}」缺少机器人，已补 2 台维修无人机。`);
  }

  return { project: next, fixes };
}

function invalidDoorIds(project: BuilderProject) {
  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const invalid = new Set<string>();
  for (const door of project.doors) {
    const from = roomsById.get(door.fromRoomId);
    const to = roomsById.get(door.toRoomId);
    if (!from || !to || !sharedEdge(from, to)) invalid.add(door.id);
  }
  return invalid;
}

function repairInvalidDoorRooms(project: BuilderProject, fixes: string[]): BuilderProject {
  let next = project;
  for (const door of [...project.doors]) {
    const from = next.rooms.find((room) => room.id === door.fromRoomId);
    const to = next.rooms.find((room) => room.id === door.toRoomId);
    if (!from || !to || sharedEdge(from, to)) continue;
    const aligned = alignRoomPairForDoor(next, from.id, to.id) ?? alignRoomPairForDoor(next, to.id, from.id);
    if (!aligned) continue;
    next = aligned.project;
    fixes.push(`「${aligned.moved.label}」已自动贴边到「${aligned.anchor.label}」，保留门「${door.label ?? door.id}」。`);
  }
  return next;
}

function removeDoorsAndDanglingLinks(project: BuilderProject, removedDoorIds: Set<string>): BuilderProject {
  const nextDoors = project.doors.filter((door) => !removedDoorIds.has(door.id));
  const nextPuzzles = project.puzzles?.filter((instance) => !removedDoorIds.has(instance.linkedDoorId));
  const puzzleById = new Map((nextPuzzles ?? []).map((instance) => [instance.id, instance]));
  const validLockedDoors = nextDoors.filter((door) => door.lockType !== "none");
  const preferredPuzzle = [...(nextPuzzles ?? [])].reverse().find((instance) => instance.kind !== "color_sequence") ?? [...(nextPuzzles ?? [])].reverse()[0];
  const robotRoomIds = new Set(project.robots.map((robot) => robot.roomId));

  return {
    ...project,
    doors: nextDoors,
    puzzles: nextPuzzles,
    routeSwitches: project.routeSwitches
      ?.map((route) => {
        const outputs = route.outputs.flatMap((output) => {
          if (output.kind === "open_door") {
            const door = validLockedDoors.find((candidate) => candidate.id === output.doorId);
            if (door) return [output];
            if (preferredPuzzle) return [{ ...output, kind: "reveal_puzzle" as const, doorId: undefined, puzzleId: preferredPuzzle.id, robotRoomId: undefined }];
            const fallbackDoor = validLockedDoors[0];
            return fallbackDoor ? [{ ...output, doorId: fallbackDoor.id }] : [];
          }
          if (output.kind === "reveal_puzzle") {
            if (output.puzzleId && puzzleById.has(output.puzzleId)) return [output];
            return preferredPuzzle ? [{ ...output, puzzleId: preferredPuzzle.id, doorId: undefined, robotRoomId: undefined }] : [];
          }
          if (output.kind === "start_robots") {
            if (output.robotRoomId && robotRoomIds.has(output.robotRoomId)) return [output];
            const fallbackRoomId = [...robotRoomIds][0];
            return fallbackRoomId ? [{ ...output, robotRoomId: fallbackRoomId, doorId: undefined, puzzleId: undefined }] : [];
          }
          return [];
        }).slice(0, 4);
        return { ...route, outputs };
      })
      .filter((route) => route.outputs.length > 0),
    wallDoorSwitches: project.wallDoorSwitches?.map((wallSwitch) => ({
      ...wallSwitch,
      states: wallSwitch.states.map((state) => ({
        ...state,
        openDoorIds: (state.openDoorIds ?? []).filter((doorId) => !removedDoorIds.has(doorId)),
        closeDoorIds: (state.closeDoorIds ?? []).filter((doorId) => !removedDoorIds.has(doorId)),
      })),
    })),
  };
}

interface DoorPairCandidate {
  from: BuilderRoom;
  to: BuilderRoom;
  distance: number;
  preferred: number;
}

interface DoorRoomAlignment {
  project: BuilderProject;
  anchor: BuilderRoom;
  moved: BuilderRoom;
}

function doorPairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

function doorCandidatePairs(rooms: readonly BuilderRoom[], existing: ReadonlySet<string>, preferredRoomId?: string): DoorPairCandidate[] {
  const pairs: DoorPairCandidate[] = [];
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const rawA = rooms[i];
      const rawB = rooms[j];
      if (existing.has(doorPairKey(rawA.id, rawB.id))) continue;
      const from = preferredRoomId === rawB.id ? rawB : rawA;
      const to = preferredRoomId === rawB.id ? rawA : rawB;
      pairs.push({
        from,
        to,
        distance: Math.hypot(rawA.center[0] - rawB.center[0], rawA.center[1] - rawB.center[1]),
        preferred: preferredRoomId && (rawA.id === preferredRoomId || rawB.id === preferredRoomId) ? 0 : 1,
      });
    }
  }
  return pairs.sort((a, b) => a.preferred - b.preferred || a.distance - b.distance);
}

function alignRoomPairForDoor(project: BuilderProject, anchorRoomId: string, movableRoomId: string): DoorRoomAlignment | null {
  const anchor = project.rooms.find((room) => room.id === anchorRoomId);
  const movable = project.rooms.find((room) => room.id === movableRoomId);
  if (!anchor || !movable) return null;
  for (const candidate of doorSnapCandidates(movable, anchor)) {
    if (!sharedEdge(anchor, candidate)) continue;
    if (roomOverlapsAny(project.rooms, candidate, new Set([anchor.id, movable.id]))) continue;
    return {
      project: {
        ...project,
        rooms: project.rooms.map((room) => (room.id === movable.id ? candidate : room)),
      },
      anchor,
      moved: candidate,
    };
  }
  return null;
}

function doorSnapCandidates(movable: BuilderRoom, anchor: BuilderRoom): BuilderRoom[] {
  if (movable.shape || anchor.shape) {
    const polygonCandidates = polygonDoorSnapCandidates(movable, anchor);
    if (polygonCandidates.length > 0) return polygonCandidates;
  }

  const ab = roomBounds(anchor);
  const preferredX = movable.center[0];
  const preferredZ = movable.center[1];
  const xForHorizontalDoor = alignCenterForDoorOverlap(movable.size[0], ab.x0, ab.x1, preferredX);
  const zForVerticalDoor = alignCenterForDoorOverlap(movable.size[1], ab.z0, ab.z1, preferredZ);
  const candidates: BuilderRoom[] = [
    { ...movable, center: [xForHorizontalDoor, ab.z1 + movable.size[1] / 2] },
    { ...movable, center: [xForHorizontalDoor, ab.z0 - movable.size[1] / 2] },
    { ...movable, center: [ab.x1 + movable.size[0] / 2, zForVerticalDoor] },
    { ...movable, center: [ab.x0 - movable.size[0] / 2, zForVerticalDoor] },
  ];
  return candidates.sort(
    (a, b) =>
      Math.hypot(a.center[0] - movable.center[0], a.center[1] - movable.center[1]) -
      Math.hypot(b.center[0] - movable.center[0], b.center[1] - movable.center[1]),
  );
}

function polygonDoorSnapCandidates(movable: BuilderRoom, anchor: BuilderRoom): BuilderRoom[] {
  const anchorPolygon = roomWorldPolygon(anchor);
  const anchorCentroid = polygonCentroid(anchorPolygon);
  const anchorEdges = polygonEdges(anchorPolygon);
  const currentRotation = movable.shape?.rotation ?? 0;
  const rotations = doorCandidateRotations(movable, anchorEdges);
  const candidates: { room: BuilderRoom; score: number }[] = [];
  const seen = new Set<string>();

  for (const rotation of rotations) {
    const shape = movable.shape ? { ...movable.shape, rotation: normalizeAngle(rotation) } : undefined;
    const base: BuilderRoom = shape ? { ...movable, shape, size: shapeBboxSize(shape) as [number, number] } : movable;
    const movablePolygon = roomWorldPolygon(base);
    const movableCentroid = polygonCentroid(movablePolygon);
    const movableEdges = polygonEdges(movablePolygon);

    for (const movableEdge of movableEdges) {
      const movableInward = edgeInwardNormal(movableEdge, movableCentroid);
      for (const anchorEdge of anchorEdges) {
        const cross = movableEdge.dir[0] * anchorEdge.dir[1] - movableEdge.dir[1] * anchorEdge.dir[0];
        if (Math.abs(cross) > 0.08) continue;
        const anchorInward = edgeInwardNormal(anchorEdge, anchorCentroid);
        if (movableInward[0] * anchorInward[0] + movableInward[1] * anchorInward[1] > -0.35) continue;

        const normalX = -movableEdge.dir[1];
        const normalZ = movableEdge.dir[0];
        const normalGap = (anchorEdge.a[0] - movableEdge.a[0]) * normalX + (anchorEdge.a[1] - movableEdge.a[1]) * normalZ;
        const anchorT0 = (anchorEdge.a[0] - movableEdge.a[0]) * movableEdge.dir[0] + (anchorEdge.a[1] - movableEdge.a[1]) * movableEdge.dir[1];
        const anchorT1 = (anchorEdge.b[0] - movableEdge.a[0]) * movableEdge.dir[0] + (anchorEdge.b[1] - movableEdge.a[1]) * movableEdge.dir[1];
        const anchorCenterT = (Math.min(anchorT0, anchorT1) + Math.max(anchorT0, anchorT1)) / 2;
        const tangentShift = anchorCenterT - movableEdge.length / 2;
        const dx = normalX * normalGap + movableEdge.dir[0] * tangentShift;
        const dz = normalZ * normalGap + movableEdge.dir[1] * tangentShift;
        const candidate: BuilderRoom = { ...base, center: [base.center[0] + dx, base.center[1] + dz] };
        if (!sharedEdge(anchor, candidate)) continue;
        const key = `${candidate.center[0].toFixed(3)}:${candidate.center[1].toFixed(3)}:${candidate.shape?.rotation?.toFixed(3) ?? "rect"}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const travel = Math.hypot(candidate.center[0] - movable.center[0], candidate.center[1] - movable.center[1]);
        const rotationPenalty = movable.shape ? angleDistance(candidate.shape?.rotation ?? 0, currentRotation) * 0.45 : 0;
        candidates.push({ room: candidate, score: travel + rotationPenalty });
      }
    }
  }

  return candidates.sort((a, b) => a.score - b.score).map((candidate) => candidate.room);
}

function doorCandidateRotations(movable: BuilderRoom, anchorEdges: ReturnType<typeof polygonEdges>): number[] {
  const currentRotation = movable.shape?.rotation ?? 0;
  if (!movable.shape) return [currentRotation];

  const rotations = [currentRotation, currentRotation + Math.PI / 2, currentRotation + Math.PI, currentRotation + Math.PI * 1.5];
  const baseShape = { ...movable.shape, rotation: 0 };
  const base: BuilderRoom = { ...movable, shape: baseShape, size: shapeBboxSize(baseShape) as [number, number] };
  const baseEdges = polygonEdges(roomWorldPolygon(base));
  for (const movableEdge of baseEdges) {
    for (const anchorEdge of anchorEdges) {
      rotations.push(anchorEdge.yaw - movableEdge.yaw, anchorEdge.yaw + Math.PI - movableEdge.yaw);
    }
  }

  const seen = new Set<string>();
  return rotations
    .map(normalizeAngle)
    .filter((rotation) => {
      const key = rotation.toFixed(4);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function edgeInwardNormal(edge: ReturnType<typeof polygonEdges>[number], centroid: Vec2): Vec2 {
  let nx = -edge.dir[1];
  let nz = edge.dir[0];
  const midX = (edge.a[0] + edge.b[0]) / 2;
  const midZ = (edge.a[1] + edge.b[1]) / 2;
  if ((centroid[0] - midX) * nx + (centroid[1] - midZ) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return [nx, nz];
}

function normalizeAngle(value: number) {
  const tau = Math.PI * 2;
  return ((value % tau) + tau) % tau;
}

function angleDistance(a: number, b: number) {
  const delta = normalizeAngle(a - b);
  return Math.min(delta, Math.PI * 2 - delta);
}

function alignCenterForDoorOverlap(movableLength: number, anchorMin: number, anchorMax: number, preferredCenter: number) {
  const minOverlap = 3.4;
  const half = movableLength / 2;
  const low = anchorMin + minOverlap - half;
  const high = anchorMax - minOverlap + half;
  if (low > high) return (anchorMin + anchorMax) / 2;
  return Math.min(high, Math.max(low, preferredCenter));
}

function roomBounds(room: BuilderRoom) {
  return {
    x0: room.center[0] - room.size[0] / 2,
    x1: room.center[0] + room.size[0] / 2,
    z0: room.center[1] - room.size[1] / 2,
    z1: room.center[1] + room.size[1] / 2,
  };
}

function roomOverlapsAny(rooms: readonly BuilderRoom[], candidate: BuilderRoom, ignoreIds: ReadonlySet<string>) {
  return rooms.some((room) => !ignoreIds.has(room.id) && roomsOverlap(candidate, room));
}

function roomsOverlap(a: BuilderRoom, b: BuilderRoom) {
  const ab = roomBounds(a);
  const bb = roomBounds(b);
  return Math.min(ab.x1, bb.x1) - Math.max(ab.x0, bb.x0) > 0.05 && Math.min(ab.z1, bb.z1) - Math.max(ab.z0, bb.z0) > 0.05;
}

function nearestRoom(room: BuilderRoom, candidates: readonly BuilderRoom[]) {
  let best: { room: BuilderRoom; distance: number } | null = null;
  for (const candidate of candidates) {
    const distance = Math.hypot(room.center[0] - candidate.center[0], room.center[1] - candidate.center[1]);
    if (!best || distance < best.distance) best = { room: candidate, distance };
  }
  return best?.room ?? null;
}

/** Slides `movable` along its nearest axis so it shares an edge with `anchor`, if the gap is small. */
function snapRoomToward(movable: BuilderRoom, anchor: BuilderRoom): BuilderRoom | null {
  const maxGap = 2.2;
  const ax0 = anchor.center[0] - anchor.size[0] / 2;
  const ax1 = anchor.center[0] + anchor.size[0] / 2;
  const az0 = anchor.center[1] - anchor.size[1] / 2;
  const az1 = anchor.center[1] + anchor.size[1] / 2;
  const mx0 = movable.center[0] - movable.size[0] / 2;
  const mx1 = movable.center[0] + movable.size[0] / 2;
  const mz0 = movable.center[1] - movable.size[1] / 2;
  const mz1 = movable.center[1] + movable.size[1] / 2;
  const xOverlap = Math.min(ax1, mx1) - Math.max(ax0, mx0);
  const zOverlap = Math.min(az1, mz1) - Math.max(az0, mz0);

  if (xOverlap >= 3.4) {
    const gapBelow = mz0 - az1;
    const gapAbove = az0 - mz1;
    if (gapBelow > 0 && gapBelow <= maxGap) return { ...movable, center: [movable.center[0], movable.center[1] - gapBelow] };
    if (gapAbove > 0 && gapAbove <= maxGap) return { ...movable, center: [movable.center[0], movable.center[1] + gapAbove] };
  }
  if (zOverlap >= 3.4) {
    const gapRight = mx0 - ax1;
    const gapLeft = ax0 - mx1;
    if (gapRight > 0 && gapRight <= maxGap) return { ...movable, center: [movable.center[0] - gapRight, movable.center[1]] };
    if (gapLeft > 0 && gapLeft <= maxGap) return { ...movable, center: [movable.center[0] + gapLeft, movable.center[1]] };
  }
  return null;
}

function reachableFrom(startRoomId: string, project: BuilderProject) {
  const roomsById = new Map(project.rooms.map((candidate) => [candidate.id, candidate]));
  const visited = new Set([startRoomId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const door of project.doors) {
      const a = roomsById.get(door.fromRoomId);
      const b = roomsById.get(door.toRoomId);
      if (!a || !b || !sharedEdge(a, b)) continue;
      if (visited.has(a.id) && !visited.has(b.id)) { visited.add(b.id); changed = true; }
      if (visited.has(b.id) && !visited.has(a.id)) { visited.add(a.id); changed = true; }
    }
  }
  return visited;
}

// ---------------------------------------------------------------------------
// Tension + theme kits
// ---------------------------------------------------------------------------

export type BuilderTension = "calm" | "standard" | "lethal";

export const tensionLabels: Record<BuilderTension, string> = { calm: "低压", standard: "标准", lethal: "致命" };

export function applyTension(project: BuilderProject, tension: BuilderTension): BuilderProject {
  const count = tension === "calm" ? 1 : tension === "standard" ? 2 : 3;
  return {
    ...project,
    robots: project.robots.map((robot, index) => ({
      ...robot,
      count: robot.archetype === "custodian_elite" ? 1 : count,
      tier: tension === "lethal" && index === project.robots.length - 1 ? "elite" : robot.archetype === "custodian_elite" ? robot.tier : undefined,
    })),
  };
}

export interface BuilderThemeKit {
  id: string;
  label: string;
  style: BuilderRoomStyle;
  propHint: string;
}

export const builderThemeKits: readonly BuilderThemeKit[] = [
  { id: "maintenance", label: "维修舱", style: "maintenance", propHint: "货箱堆 / 补给柜 / 配电箱" },
  { id: "residential", label: "居住模拟", style: "residential", propHint: "沙发 / 恢复床 / 全家福墙板" },
  { id: "museum", label: "人类博物馆", style: "sterile", propHint: "展示柜 / 档案柱 / 壁画" },
  { id: "hazard", label: "警戒区", style: "hazard", propHint: "低栏杆 / 货箱堆 / 配电箱" },
];

/** Restyles every non-exit room; exit rooms keep the red evacuation look. */
export function applyThemeKit(project: BuilderProject, kit: BuilderThemeKit): BuilderProject {
  return {
    ...project,
    rooms: project.rooms.map((candidate) =>
      candidate.style === "exit" || candidate.id === project.exitRoomId ? candidate : { ...candidate, style: kit.style },
    ),
  };
}

// ---------------------------------------------------------------------------
// Live status chips (cheap checks; full validation stays on 校验/保存)
// ---------------------------------------------------------------------------

export type ChipState = "ok" | "warn" | "bad";

export interface BuilderStatusChip {
  id: string;
  label: string;
  state: ChipState;
  detail: string;
}

export function computeStatusChips(project: BuilderProject): BuilderStatusChip[] {
  const roomsById = new Map(project.rooms.map((candidate) => [candidate.id, candidate]));
  const spawn = project.rooms[0];
  const exit = roomsById.get(project.exitRoomId);

  const invalidDoors = project.doors.filter((door) => {
    const a = roomsById.get(door.fromRoomId);
    const b = roomsById.get(door.toRoomId);
    return !a || !b || !sharedEdge(a, b);
  });
  const reachable = spawn ? reachableFrom(spawn.id, project) : new Set<string>();
  const pathOk = Boolean(spawn && exit && reachable.has(exit.id));
  const surviveMissing = project.doors.filter(
    (door) => door.lockType === "survive_wave" && !project.robots.some((robot) => robot.roomId === door.fromRoomId),
  );
  const exitOk = Boolean(exit && (project.rooms.length === 1 || exit.id !== spawn?.id));

  const chips: BuilderStatusChip[] = [
    {
      id: "path",
      label: "路径",
      state: pathOk ? "ok" : "bad",
      detail: pathOk ? "出生到出口连通" : "出生到出口不连通：补门或一键修复",
    },
    {
      id: "doors",
      label: "门锁",
      state: invalidDoors.length === 0 ? "ok" : "bad",
      detail: invalidDoors.length === 0 ? `${project.doors.length} 扇门全部有效` : `${invalidDoors.length} 扇门没有共享边`,
    },
    {
      id: "robots",
      label: "机器人",
      state: surviveMissing.length > 0 ? "bad" : project.robots.length === 0 ? "warn" : "ok",
      detail: surviveMissing.length > 0
        ? `${surviveMissing.length} 扇清剿门缺机器人`
        : project.robots.length === 0
          ? "没有任何敌人，密室会很安静"
          : `${project.robots.reduce((total, robot) => total + robot.count, 0)} 台敌对单位`,
    },
    {
      id: "exit",
      label: "出口",
      state: exitOk ? "ok" : "bad",
      detail: exitOk ? `出口：${exit?.label ?? ""}` : "出口未设置或与出生重合",
    },
  ];

  const playable = chips.every((chip) => chip.state !== "bad");
  chips.unshift({
    id: "playable",
    label: playable ? "可玩" : "不可玩",
    state: playable ? "ok" : "bad",
    detail: playable ? "通过快速检查，保存时再做完整校验" : "先解决红色项",
  });
  return chips;
}
