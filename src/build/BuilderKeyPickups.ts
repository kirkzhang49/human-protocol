import type { BuilderDoor, BuilderPickup, BuilderProject, BuilderRoom } from "./BuilderTypes";

export function keyPickupIdForDoor(doorId: string) {
  return `key_${doorId}`;
}

export function keyPickupPositionInRoom(room: BuilderRoom): [number, number] {
  return [
    room.center[0] - Math.min(1.4, room.size[0] * 0.18),
    room.center[1] + Math.min(1.2, room.size[1] * 0.18),
  ];
}

export function defaultKeyPickupPlacement(project: BuilderProject, door: BuilderDoor): { roomId: string; position: [number, number] } | null {
  const room =
    project.rooms.find((candidate) => candidate.id === door.keyRoomId) ??
    project.rooms.find((candidate) => candidate.id === door.fromRoomId) ??
    project.rooms[0];
  if (!room) return null;
  return { roomId: room.id, position: keyPickupPositionInRoom(room) };
}

export function normalizeBuilderKeyPickups(project: BuilderProject): BuilderProject {
  const keyDoors = project.doors.filter((door) => door.lockType === "key_item");
  const keyDoorById = new Map(keyDoors.map((door) => [door.id, door]));
  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const incomingPickups = project.pickups ?? [];
  let changed = false;

  if (keyDoors.length === 0) {
    const pickups = incomingPickups.filter((pickup) => pickup.kind !== "key_item");
    if (pickups.length !== incomingPickups.length) changed = true;
    const doors = project.doors.map((door) => {
      if (door.keyRoomId === undefined) return door;
      const { keyRoomId: _keyRoomId, ...rest } = door;
      changed = true;
      return rest;
    });
    return changed ? { ...project, doors, pickups } : project;
  }

  const retainedPickups: BuilderPickup[] = [];
  const pickupByDoorId = new Map<string, BuilderPickup>();
  const usedPickupIds = new Set(incomingPickups.map((pickup) => pickup.id));

  for (const pickup of incomingPickups) {
    if (pickup.kind !== "key_item") {
      retainedPickups.push(pickup);
      continue;
    }
    const door = pickup.linkedDoorId ? keyDoorById.get(pickup.linkedDoorId) : null;
    if (!door || pickupByDoorId.has(door.id)) {
      changed = true;
      continue;
    }
    const room = roomsById.get(pickup.roomId);
    if (!room) {
      const fallback = defaultKeyPickupPlacement(project, door);
      if (!fallback) {
        changed = true;
        continue;
      }
      const repaired = { ...pickup, roomId: fallback.roomId, position: fallback.position };
      retainedPickups.push(repaired);
      pickupByDoorId.set(door.id, repaired);
      changed = true;
      continue;
    }
    retainedPickups.push(pickup);
    pickupByDoorId.set(door.id, pickup);
  }

  for (const door of keyDoors) {
    if (pickupByDoorId.has(door.id)) continue;
    const placement = defaultKeyPickupPlacement(project, door);
    if (!placement) continue;
    const pickup: BuilderPickup = {
      id: uniqueKeyPickupId(door.id, usedPickupIds),
      kind: "key_item",
      roomId: placement.roomId,
      position: placement.position,
      linkedDoorId: door.id,
    };
    retainedPickups.push(pickup);
    pickupByDoorId.set(door.id, pickup);
    usedPickupIds.add(pickup.id);
    changed = true;
  }

  const doors = project.doors.map((door) => {
    if (door.lockType !== "key_item") {
      if (door.keyRoomId === undefined) return door;
      const { keyRoomId: _keyRoomId, ...rest } = door;
      changed = true;
      return rest;
    }
    const pickup = pickupByDoorId.get(door.id);
    if (!pickup || door.keyRoomId === pickup.roomId) return door;
    changed = true;
    return { ...door, keyRoomId: pickup.roomId };
  });

  if (!changed && retainedPickups.length === incomingPickups.length) return project;
  return { ...project, doors, pickups: retainedPickups };
}

export function moveKeyPickupForDoor(project: BuilderProject, doorId: string, roomId: string): BuilderProject {
  const normalized = normalizeBuilderKeyPickups(project);
  const door = normalized.doors.find((candidate) => candidate.id === doorId && candidate.lockType === "key_item");
  const room = normalized.rooms.find((candidate) => candidate.id === roomId);
  if (!door || !room) return normalized;
  const position = keyPickupPositionInRoom(room);
  return normalizeBuilderKeyPickups({
    ...normalized,
    doors: normalized.doors.map((candidate) => (candidate.id === doorId ? { ...candidate, keyRoomId: room.id } : candidate)),
    pickups: (normalized.pickups ?? []).map((pickup) =>
      pickup.kind === "key_item" && pickup.linkedDoorId === doorId
        ? { ...pickup, roomId: room.id, position }
        : pickup,
    ),
  });
}

function uniqueKeyPickupId(doorId: string, usedPickupIds: Set<string>) {
  const base = keyPickupIdForDoor(doorId);
  if (!usedPickupIds.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}_${index}`;
    if (!usedPickupIds.has(candidate)) return candidate;
  }
  return `${base}_${Math.random().toString(36).slice(2, 8)}`;
}
