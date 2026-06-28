import type { BuilderDoor, BuilderProject, BuilderRobotGroup } from "./BuilderTypes";

export function builderDoorEndpointLabel(door: Pick<BuilderDoor, "fromRoomId" | "toRoomId">, project: BuilderProject) {
  const from = project.rooms.find((room) => room.id === door.fromRoomId)?.label ?? "?";
  const to = project.rooms.find((room) => room.id === door.toRoomId)?.label ?? "?";
  return `${from}—${to}`;
}

export function builderDoorDisplayLabel(door: Pick<BuilderDoor, "label" | "fromRoomId" | "toRoomId">, project: BuilderProject) {
  const label = door.label?.trim();
  return label || builderDoorEndpointLabel(door, project);
}

export function builderDoorSurviveRobotIds(door: Pick<BuilderDoor, "surviveRobotId" | "surviveRobotIds">) {
  const ids = [...(door.surviveRobotIds ?? []), ...(door.surviveRobotId ? [door.surviveRobotId] : [])];
  return [...new Set(ids.filter(Boolean))];
}

export function builderDoorWaveIds(door: Pick<BuilderDoor, "waveId" | "waveIds">) {
  const ids = [...(door.waveIds ?? []), ...(door.waveId ? [door.waveId] : [])];
  return [...new Set(ids.filter(Boolean))];
}

export function builderRobotAuthoredWaveId(robot: Pick<BuilderRobotGroup, "wave" | "waveChain">) {
  return robot.waveChain?.waveId ?? robot.wave?.id;
}

export function builderDoorSelectedGuardIds(door: BuilderDoor, robots: readonly BuilderRobotGroup[]) {
  const robotIds = builderDoorSurviveRobotIds(door);
  const waveIds = builderDoorWaveIds(door);
  for (const waveId of waveIds) {
    for (const robot of robots) {
      if (builderRobotAuthoredWaveId(robot) === waveId) robotIds.push(robot.id);
    }
  }
  return [...new Set(robotIds.filter(Boolean))];
}

export interface BuilderWaveDoorOption {
  roomId: string;
  order: number;
  waveId: string;
  label: string;
  robotIds: readonly string[];
}

export function builderWaveDoorOptions(project: BuilderProject, roomId?: string): BuilderWaveDoorOption[] {
  const byRoomOrder = new Map<string, { roomId: string; order: number; waveId: string; label: string; robotIds: string[] }>();
  const roomOrder = new Map(project.rooms.map((room, index) => [room.id, index]));
  for (const robot of project.robots) {
    if (roomId && robot.roomId !== roomId) continue;
    const wave = robot.waveChain;
    if (!wave) continue;
    const key = `${robot.roomId}:${wave.order}`;
    const current = byRoomOrder.get(key) ?? {
      roomId: robot.roomId,
      order: wave.order,
      waveId: wave.waveId,
      label: wave.label?.trim() || `波次 ${wave.order}`,
      robotIds: [],
    };
    current.robotIds.push(robot.id);
    if (!current.waveId && wave.waveId) current.waveId = wave.waveId;
    if (!current.label && wave.label) current.label = wave.label;
    byRoomOrder.set(key, current);
  }
  return [...byRoomOrder.values()].sort((left, right) =>
    (roomOrder.get(left.roomId) ?? 999) - (roomOrder.get(right.roomId) ?? 999) ||
    left.order - right.order ||
    left.waveId.localeCompare(right.waveId)
  );
}
