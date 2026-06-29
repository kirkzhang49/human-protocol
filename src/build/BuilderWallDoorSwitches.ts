import { clampIntoRoom, wallMountFromPoint } from "./BuilderPlacementRules";
import { createBuilderId, type BuilderDoor, type BuilderProject, type BuilderRoom, type BuilderWallDoorSwitch, type BuilderWallDoorSwitchState } from "./BuilderTypes";
import {
  MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR,
  MAX_WALL_DOOR_SWITCH_STATES,
  MAX_WALL_DOOR_SWITCHES_PER_LEVEL,
} from "../game/config/shared/wallDoorSwitchLimits";

export {
  MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR,
  MAX_WALL_DOOR_SWITCH_STATES,
  MAX_WALL_DOOR_SWITCHES_PER_LEVEL,
};

export interface BuilderDoorEdge {
  panelPosition: readonly [number, number, number];
}

export function createDedicatedWallDoorSwitch(door: BuilderDoor, room: BuilderRoom, doorEdge: BuilderDoorEdge): BuilderWallDoorSwitch {
  const id = createBuilderId("wall_switch");
  const switchPoint = clampIntoRoom(room, doorEdge.panelPosition[0], doorEdge.panelPosition[2], 0.28);
  const wallMount = wallMountFromPoint(room, switchPoint[0], switchPoint[1]);
  return {
    id,
    label: "墙面门控把手",
    roomId: room.id,
    wallMount: { ...wallMount, height: 1.34, inset: 0.18 },
    mode: "toggle",
    primaryDoorId: door.id,
    initialStateId: "closed",
    oneShot: false,
    states: toggleStatesForWallDoorSwitch(door.id),
  };
}

export function wallDoorSwitchMode(wallSwitch: BuilderWallDoorSwitch): "toggle" | "state_cycle" {
  return wallSwitch.mode ?? (wallSwitch.primaryDoorId ? "toggle" : "state_cycle");
}

export function primaryDoorIdForWallDoorSwitch(wallSwitch: BuilderWallDoorSwitch): string | undefined {
  return wallSwitch.primaryDoorId ?? wallSwitch.states.find((state) => state.id === "open")?.openDoorIds?.[0] ?? wallSwitch.states.find((state) => state.openDoorIds?.length)?.openDoorIds?.[0];
}

export function effectiveWallDoorSwitchStates(wallSwitch: BuilderWallDoorSwitch): readonly BuilderWallDoorSwitchState[] {
  if (wallDoorSwitchMode(wallSwitch) !== "toggle") return wallSwitch.states;
  const primaryDoorId = primaryDoorIdForWallDoorSwitch(wallSwitch);
  return primaryDoorId ? toggleStatesForWallDoorSwitch(primaryDoorId, wallSwitch.inverseDoorId) : wallSwitch.states;
}

export function controlledDoorIdsForWallDoorSwitch(wallSwitch: BuilderWallDoorSwitch): string[] {
  const ids = new Set<string>();
  for (const state of effectiveWallDoorSwitchStates(wallSwitch)) {
    for (const doorId of state.openDoorIds ?? []) ids.add(doorId);
    for (const doorId of state.closeDoorIds ?? []) ids.add(doorId);
  }
  return [...ids];
}

export function wallDoorSwitchControlIdsForDoor(project: BuilderProject, doorId: string): string[] {
  const ids = new Set<string>();
  for (const wallSwitch of project.wallDoorSwitches ?? []) {
    if (controlledDoorIdsForWallDoorSwitch(wallSwitch).includes(doorId)) ids.add(wallSwitch.id);
  }
  return [...ids];
}

export function wallDoorSwitchCanControlDoor(project: BuilderProject, doorId: string, switchId: string) {
  const controllerIds = wallDoorSwitchControlIdsForDoor(project, doorId);
  return controllerIds.includes(switchId) || controllerIds.length < MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR;
}

export function wallDoorSwitchDoorControlUsage(project: BuilderProject, doorId: string, switchId?: string) {
  const controllerIds = wallDoorSwitchControlIdsForDoor(project, doorId);
  const controlledByActiveSwitch = Boolean(switchId && controllerIds.includes(switchId));
  return {
    controllerIds,
    count: controllerIds.length,
    max: MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR,
    controlledByActiveSwitch,
    full: controllerIds.length >= MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR && !controlledByActiveSwitch,
  };
}

export function toggleStatesForWallDoorSwitch(primaryDoorId: string, inverseDoorId?: string): readonly BuilderWallDoorSwitchState[] {
  return [
    {
      id: "closed",
      label: "关闭",
      openDoorIds: inverseDoorId ? [inverseDoorId] : [],
      closeDoorIds: [primaryDoorId],
      message: inverseDoorId ? "主门关闭，反向门打开。" : "门控回到关闭。",
    },
    {
      id: "open",
      label: "打开",
      openDoorIds: [primaryDoorId],
      closeDoorIds: inverseDoorId ? [inverseDoorId] : [],
      message: inverseDoorId ? "主门打开，反向门关闭。" : "门控打开通路。",
    },
  ];
}

export function detachDoorFromWallDoorSwitches(wallSwitches: readonly BuilderWallDoorSwitch[], doorId: string): BuilderWallDoorSwitch[] {
  return wallSwitches.flatMap((wallSwitch) => {
    const referencesDoor = wallSwitch.states.some((state) => state.openDoorIds?.includes(doorId) || state.closeDoorIds?.includes(doorId));
    const ownsDoor = wallSwitch.primaryDoorId === doorId || wallSwitch.inverseDoorId === doorId;
    if (!referencesDoor && !ownsDoor) return [wallSwitch];
    const nextSwitch = {
      ...wallSwitch,
      ...(wallSwitch.primaryDoorId === doorId ? { primaryDoorId: undefined } : {}),
      ...(wallSwitch.inverseDoorId === doorId ? { inverseDoorId: undefined } : {}),
      states: wallSwitch.states.map((state) => ({
        ...state,
        openDoorIds: state.openDoorIds?.filter((id) => id !== doorId),
        closeDoorIds: state.closeDoorIds?.filter((id) => id !== doorId),
      })),
    };
    return wallDoorSwitchControlsAnyDoor(nextSwitch) ? [nextSwitch] : [];
  });
}

export function applyToggleDoorOwnership(project: BuilderProject, switchId: string, primaryDoorId: string, inverseDoorId?: string): BuilderProject {
  const wallDoorSwitches = (project.wallDoorSwitches ?? []).map((wallSwitch) =>
    wallSwitch.id === switchId
      ? {
          ...wallSwitch,
          mode: "toggle" as const,
          primaryDoorId,
          inverseDoorId,
          initialStateId: "closed",
          oneShot: false,
          states: toggleStatesForWallDoorSwitch(primaryDoorId, inverseDoorId),
        }
      : wallSwitch,
  );

  return {
    ...project,
    wallDoorSwitches,
    doors: project.doors.map((door) => {
      if (door.id === primaryDoorId) return door;
      if (door.wallDoorSwitchId !== switchId) return door;
      return {
        ...door,
        ...(door.lockType === "switch_state" ? { lockType: "none" as const } : {}),
        wallDoorSwitchId: undefined,
        wallDoorSwitchStateId: undefined,
      };
    }),
    puzzles: project.puzzles,
  };
}

function wallDoorSwitchControlsAnyDoor(wallSwitch: BuilderWallDoorSwitch): boolean {
  return wallSwitch.states.some((state) => (state.openDoorIds?.length ?? 0) + (state.closeDoorIds?.length ?? 0) > 0);
}
