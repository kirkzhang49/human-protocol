import type { LevelDefinition, LevelDoorDefinition, LevelMapPropDefinition, LevelRoomDefinition, Vec3Tuple } from "../schema/levelConfig";

export const officialExitRoomReferenceId = "hp:official_exit_room_reference_v1";
export const officialExitRoomSize: Vec3Tuple = [6.4, 4, 5.4];
const officialExitRoomReferenceModelKeys = new Set([
  "service_elevator_exit_stage",
  "service_elevator_interior_shell",
  "door_threshold_service_elevator",
  "service_elevator_call_buttons",
  "service_elevator_ascent_shaft_fx",
]);

export const officialExitDoorAnimationReference = {
  skinKey: "service_elevator_hero",
  visualKey: "service_elevator_door",
  materialKey: "service_elevator_metal",
  openSpeed: 1.35,
  autoOpenOnApproach: true,
  openVisualPolicy: { hideClosedHardwareAfterOpen: true, hidePanelAfterOpen: true },
} satisfies Pick<
  LevelDoorDefinition,
  "skinKey" | "visualKey" | "materialKey" | "openSpeed" | "autoOpenOnApproach" | "openVisualPolicy"
>;

export function createOfficialExitRoomReference(config: {
  id: string;
  label: string;
  doorPosition: Vec3Tuple;
  doorYaw?: number;
}): LevelRoomDefinition {
  return {
    id: config.id,
    label: config.label,
    bounds: { center: officialExitRoomCenterForDoor(config.doorPosition, config.doorYaw ?? 0), size: officialExitRoomSize },
    mood: "reveal",
    skinKey: "service_elevator_hero",
    floorMaterialKey: "service_elevator_metal",
    wallMaterialKey: "service_elevator_metal",
    ambientPressure: 0.55,
    geometry: {
      renderFloor: true,
      renderWalls: false,
      renderCeiling: false,
      collisionWalls: true,
      accentColor: "#f3f0df",
    },
    aesthetic: { enabled: true, style: "exit", detail: "high" },
  };
}

export function createOfficialExitElevatorReferenceProps(config: {
  idPrefix: string;
  roomId: string;
  doorPosition: Vec3Tuple;
  doorYaw?: number;
  tags?: readonly string[];
}): LevelMapPropDefinition[] {
  const roomCenter = officialExitRoomCenterForDoor(config.doorPosition, config.doorYaw ?? 0);
  const frame = officialExitElevatorFrame(roomCenter, config.doorPosition, config.doorYaw ?? 0);
  const commonTags = [officialExitRoomReferenceId, "elevator", ...(config.tags ?? [])];
  const prop = (
    role: string,
    spec: {
      modelKey: string;
      offset: readonly [number, number];
      y: number;
      yaw: number;
      scale: number | Vec3Tuple;
      label: string;
      tags: readonly string[];
    },
  ): LevelMapPropDefinition => ({
    id: `${config.idPrefix}_elevator_${role}`,
    roomId: config.roomId,
    modelKey: spec.modelKey,
    position: officialExitElevatorPoint(frame, spec.offset[0], spec.offset[1], spec.y),
    rotation: [0, frame.yaw + spec.yaw, 0],
    scale: spec.scale,
    label: spec.label,
    tags: [...commonTags, ...spec.tags],
  });

  return [
    prop("exit_stage", {
      modelKey: "service_elevator_exit_stage",
      offset: [0, 0],
      y: 0,
      yaw: 0,
      scale: 1,
      label: "出口电梯房间",
      tags: ["exit_room_stage", "bright_exit"],
    }),
    prop("interior_shell", {
      modelKey: "service_elevator_interior_shell",
      offset: [0, 0],
      y: 0,
      yaw: 0,
      scale: 1,
      label: "出口电梯内壁",
      tags: ["interior_shell", "bright_exit"],
    }),
    prop("threshold", {
      modelKey: "door_threshold_service_elevator",
      offset: [0, 2.11],
      y: 0.035,
      yaw: 0,
      scale: [1.15, 1, 1],
      label: "出口电梯门槛",
      tags: ["threshold", "bright_exit"],
    }),
    prop("call_buttons", {
      modelKey: "service_elevator_call_buttons",
      offset: [2.82, -0.7],
      y: 1.42,
      yaw: -Math.PI / 2,
      scale: 1,
      label: "出口电梯呼叫按钮",
      tags: ["exit_call_buttons", "button_panel"],
    }),
    prop("ascent_shaft_fx", {
      modelKey: "service_elevator_ascent_shaft_fx",
      offset: [0, 0],
      y: 0,
      yaw: 0,
      scale: 1,
      label: "出口电梯上升井道",
      tags: ["ascent_shaft_fx", "cinematic_reveal"],
    }),
  ];
}

export function officialExitElevatorCinematicEnterPosition(doorPosition: Vec3Tuple, doorYaw = 0): Vec3Tuple {
  const roomCenter = officialExitRoomCenterForDoor(doorPosition, doorYaw);
  const frame = officialExitElevatorFrame(roomCenter, doorPosition, doorYaw);
  return officialExitElevatorPoint(frame, 0, 0.35, 0);
}

export function officialExitElevatorCallButtonPosition(doorPosition: Vec3Tuple, doorYaw = 0, y = 1.42): Vec3Tuple {
  const roomCenter = officialExitRoomCenterForDoor(doorPosition, doorYaw);
  const frame = officialExitElevatorFrame(roomCenter, doorPosition, doorYaw);
  return officialExitElevatorPoint(frame, 2.82, -0.7, y);
}

export function officialExitElevatorFaceYaw(lookTarget: Vec3Tuple, enterPosition: Vec3Tuple) {
  const dx = lookTarget[0] - enterPosition[0];
  const dz = lookTarget[2] - enterPosition[2];
  if (Math.hypot(dx, dz) <= 0.001) return 0;
  return Math.atan2(dx, -dz);
}

export function normalizeLevelExitRoomReference(level: LevelDefinition): LevelDefinition {
  const map = level.map;
  if (!map) return level;

  const exitInteraction = map.interactions.find((interaction) => interaction.type === "exit");
  const cinematicDoor = level.exit.cinematic?.doorId ? map.doors.find((door) => door.id === level.exit.cinematic?.doorId) : undefined;
  const interactionDoor = exitInteraction?.opensDoorId ? map.doors.find((door) => door.id === exitInteraction.opensDoorId) : undefined;
  const styledExitRoom = map.rooms.find((room) => room.aesthetic?.style === "exit" || room.mood === "reveal");
  const exitRoomId =
    exitInteraction?.roomId ??
    roomIdForExitDoor(cinematicDoor, styledExitRoom?.id) ??
    roomIdForExitDoor(interactionDoor, styledExitRoom?.id) ??
    styledExitRoom?.id ??
    roomIdForExitPosition(level.exit.position, map.rooms);
  if (!exitRoomId) return level;

  const exitRoom = map.rooms.find((room) => room.id === exitRoomId);
  const exitDoor =
    interactionDoor ??
    cinematicDoor ??
    map.doors.find((door) => door.fromRoomId === exitRoomId || door.toRoomId === exitRoomId);
  const doorPosition = exitDoor?.position ?? level.exit.cinematic?.enterPosition ?? level.exit.position;
  const doorYaw = exitDoor?.yaw ?? level.exit.cinematic?.faceYaw ?? 0;
  const idPrefix = `${officialExitSafeId(level.id)}_official_exit`;
  const existingReferencePropIds = new Map(
    (map.props ?? [])
      .filter((prop) => prop.roomId === exitRoomId && officialExitRoomReferenceModelKeys.has(prop.modelKey))
      .map((prop) => [prop.modelKey, prop.id] as const),
  );
  const referenceProps = createOfficialExitElevatorReferenceProps({
    idPrefix,
    roomId: exitRoomId,
    doorPosition,
    doorYaw,
    tags: ["official", "builderTrial"],
  }).map((prop) => {
    const existingId = existingReferencePropIds.get(prop.modelKey);
    return existingId ? { ...prop, id: existingId } : prop;
  });
  const cinematicEnterPosition = officialExitElevatorCinematicEnterPosition(doorPosition, doorYaw);
  const cinematicLookAtPosition = officialExitElevatorCallButtonPosition(doorPosition, doorYaw, 1.42);
  const normalizedExitCinematic =
    level.exit.cinematic?.type === "elevator_walk_in"
      ? {
          ...level.exit.cinematic,
          enterPosition: cinematicEnterPosition,
          lookAtPosition: cinematicLookAtPosition,
          faceYaw: officialExitElevatorFaceYaw(cinematicLookAtPosition, cinematicEnterPosition),
          ...(exitDoor ? { doorId: level.exit.cinematic.doorId ?? exitDoor.id } : {}),
        }
      : level.exit.cinematic;

  return {
    ...level,
    exit: {
      ...level.exit,
      ...(normalizedExitCinematic ? { cinematic: normalizedExitCinematic } : {}),
    },
    map: {
      ...map,
      rooms: map.rooms.map((room) =>
        room.id === exitRoomId
          ? createOfficialExitRoomReference({
              id: room.id,
              label: exitRoom?.label ?? room.label,
              doorPosition,
              doorYaw,
            })
          : room,
      ),
      doors: map.doors.map((door) => (door.id === exitDoor?.id ? { ...door, ...officialExitDoorAnimationReference } : door)),
      interactions: map.interactions.map((interaction) =>
        interaction.type === "exit" && interaction.roomId === exitRoomId
          ? {
              ...interaction,
              visualKey: "service_elevator_panel",
              materialKey: "terminal_cyan",
              ...(exitDoor ? { opensDoorId: interaction.opensDoorId ?? exitDoor.id } : {}),
            }
          : interaction,
      ),
      props: [
        ...(map.props ?? []).filter((prop) => prop.roomId !== exitRoomId),
        ...referenceProps,
      ],
    },
  };
}

function roomIdForExitDoor(door: LevelDoorDefinition | undefined, preferredExitRoomId: string | undefined) {
  if (!door) return undefined;
  if (preferredExitRoomId && (door.fromRoomId === preferredExitRoomId || door.toRoomId === preferredExitRoomId)) return preferredExitRoomId;
  if (door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero") return door.toRoomId;
  return door.toRoomId;
}

function roomIdForExitPosition(position: Vec3Tuple, rooms: readonly LevelRoomDefinition[]) {
  return rooms.find((room) => pointInsideRoomBounds(position, room))?.id;
}

function pointInsideRoomBounds(position: Vec3Tuple, room: LevelRoomDefinition) {
  const [x, , z] = position;
  const [centerX, , centerZ] = room.bounds.center;
  const [sizeX, , sizeZ] = room.bounds.size;
  return Math.abs(x - centerX) <= sizeX * 0.5 && Math.abs(z - centerZ) <= sizeZ * 0.5;
}

interface OfficialExitElevatorFrame {
  centerX: number;
  centerZ: number;
  rightX: number;
  rightZ: number;
  forwardX: number;
  forwardZ: number;
  yaw: number;
}

function officialExitElevatorFrame(roomCenter: Vec3Tuple, doorPosition: Vec3Tuple, doorYaw: number): OfficialExitElevatorFrame {
  const [centerX, , centerZ] = roomCenter;
  const doorDx = doorPosition[0] - centerX;
  const doorDz = doorPosition[2] - centerZ;
  const length = Math.hypot(doorDx, doorDz);
  const forwardX = length > 0.001 ? doorDx / length : Math.sin(doorYaw);
  const forwardZ = length > 0.001 ? doorDz / length : Math.cos(doorYaw);
  return {
    centerX,
    centerZ,
    rightX: forwardZ,
    rightZ: -forwardX,
    forwardX,
    forwardZ,
    yaw: Math.atan2(forwardX, forwardZ),
  };
}

export function officialExitRoomCenterForDoor(doorPosition: Vec3Tuple, doorYaw = 0): Vec3Tuple {
  const forwardX = Math.sin(doorYaw);
  const forwardZ = Math.cos(doorYaw);
  return [
    doorPosition[0] - forwardX * (officialExitRoomSize[2] * 0.5),
    0,
    doorPosition[2] - forwardZ * (officialExitRoomSize[2] * 0.5),
  ];
}

function officialExitElevatorPoint(frame: OfficialExitElevatorFrame, rightOffset: number, forwardOffset: number, y: number): Vec3Tuple {
  return [
    frame.centerX + frame.rightX * rightOffset + frame.forwardX * forwardOffset,
    y,
    frame.centerZ + frame.rightZ * rightOffset + frame.forwardZ * forwardOffset,
  ];
}

function officialExitSafeId(id: string) {
  return id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72) || "level";
}
