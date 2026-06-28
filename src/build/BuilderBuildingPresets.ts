import {
  createBuilderId,
  type BuilderDoor,
  type BuilderDoorFamily,
  type BuilderProject,
  type BuilderProp,
  type BuilderRoom,
  type BuilderRoomStyle,
} from "./BuilderTypes";

// ---------------------------------------------------------------------------
// Building presets — drop a whole connected, pre-furnished cluster of rooms
// (not always an enclosed box) and rotate it as a unit before it lands. After
// stamping, every room/door/prop is an ordinary, individually-editable object,
// so this needs no schema change — rotation is baked into the placed geometry.
// ---------------------------------------------------------------------------

/** A room spec in preset-local coordinates (centered roughly on origin). */
interface PresetRoom {
  /** Local key so doors/props can reference the room before it gets a real id. */
  key: string;
  label: string;
  style: BuilderRoomStyle;
  center: readonly [number, number];
  size: readonly [number, number];
}

interface PresetDoor {
  fromKey: string;
  toKey: string;
  lockType?: BuilderDoor["lockType"];
  doorFamily?: BuilderDoorFamily;
}

interface PresetProp {
  modelKey: string;
  roomKey: string;
  position: readonly [number, number];
  rotationY?: number;
}

export interface BuilderBuildingPreset {
  id: string;
  label: string;
  hint: string;
  /** Accent dot in the browser tile. */
  accent: string;
  /** "enclosed" = rooms form a sealed cluster; "open" = leaves an open plaza/court. */
  shape: "enclosed" | "open";
  rooms: readonly PresetRoom[];
  doors: readonly PresetDoor[];
  props: readonly PresetProp[];
}

/** Concrete, ready-to-append building geometry (fresh ids, world coordinates). */
export interface StampedBuilding {
  rooms: BuilderRoom[];
  doors: BuilderDoor[];
  props: BuilderProp[];
}

export const builderBuildingPresets: readonly BuilderBuildingPreset[] = [
  {
    id: "residential_l",
    label: "L 形居所",
    hint: "客厅 + 卧室 + 厨房，居住门相连",
    accent: "#ffd9a8",
    shape: "enclosed",
    rooms: [
      { key: "living", label: "客厅", style: "residential", center: [-5, 4], size: [10, 8] },
      { key: "bedroom", label: "卧室", style: "residential", center: [-5, -4], size: [10, 8] },
      { key: "kitchen", label: "厨房", style: "residential", center: [4, -4], size: [8, 8] },
    ],
    doors: [
      { fromKey: "living", toKey: "bedroom", doorFamily: "residential" },
      { fromKey: "bedroom", toKey: "kitchen", doorFamily: "residential" },
    ],
    props: [
      { modelKey: "room_lounge_sofa_residential", roomKey: "living", position: [-6.4, 5.4] },
      { modelKey: "room_fake_family_photo_wall", roomKey: "living", position: [-5, 7.2] },
      { modelKey: "room_table_utility", roomKey: "kitchen", position: [4, -4] },
    ],
  },
  {
    id: "central_court",
    label: "中央庭院",
    hint: "开放中庭 + 北展厅 + 东舱（非全封闭）",
    accent: "#d6ebe8",
    shape: "open",
    rooms: [
      { key: "court", label: "中央庭院", style: "museum", center: [0, 0], size: [12, 12] },
      { key: "north", label: "北展厅", style: "museum", center: [0, 9], size: [12, 6] },
      { key: "east", label: "东舱", style: "maintenance", center: [9, 0], size: [6, 12] },
    ],
    doors: [
      { fromKey: "court", toKey: "north", doorFamily: "reclamation" },
      { fromKey: "court", toKey: "east", doorFamily: "industrial" },
    ],
    props: [
      { modelKey: "room_museum_color_orb_pedestal", roomKey: "court", position: [0, 0] },
      { modelKey: "room_museum_low_barrier", roomKey: "court", position: [-3.4, 0], rotationY: Math.PI / 2 },
      { modelKey: "room_museum_low_barrier", roomKey: "court", position: [3.4, 0], rotationY: Math.PI / 2 },
      { modelKey: "room_museum_wall_label_panel", roomKey: "north", position: [0, 10.6] },
    ],
  },
  {
    id: "twin_clinic",
    label: "双子诊疗区",
    hint: "中央走廊 + 左右诊室，诊疗门相连",
    accent: "#bfe6ff",
    shape: "enclosed",
    rooms: [
      { key: "corridor", label: "中央走廊", style: "sterile", center: [0, 0], size: [6, 14] },
      { key: "left", label: "左诊室", style: "sterile", center: [-7, 4], size: [8, 6] },
      { key: "right", label: "右诊室", style: "sterile", center: [7, 4], size: [8, 6] },
    ],
    doors: [
      { fromKey: "corridor", toKey: "left", doorFamily: "clinic" },
      { fromKey: "corridor", toKey: "right", doorFamily: "clinic" },
    ],
    props: [
      { modelKey: "room_table_utility", roomKey: "left", position: [-7, 4] },
      { modelKey: "room_table_utility", roomKey: "right", position: [7, 4] },
      { modelKey: "room_museum_wall_label_panel", roomKey: "corridor", position: [0, -6] },
    ],
  },
  {
    id: "industrial_loop",
    label: "工业回廊",
    hint: "控制室 + 机房 + 配电井，环形三门",
    accent: "#ffb34f",
    shape: "enclosed",
    rooms: [
      { key: "control", label: "控制室", style: "hazard", center: [-5, 5], size: [10, 8] },
      { key: "mech", label: "机房", style: "maintenance", center: [5, 5], size: [10, 8] },
      { key: "dist", label: "配电井", style: "hazard", center: [0, -3], size: [20, 8] },
    ],
    doors: [
      { fromKey: "control", toKey: "mech", doorFamily: "industrial" },
      { fromKey: "control", toKey: "dist", doorFamily: "industrial" },
      { fromKey: "mech", toKey: "dist", doorFamily: "industrial" },
    ],
    props: [
      { modelKey: "room_crate_stack", roomKey: "mech", position: [6.4, 6.2] },
      { modelKey: "room_maintenance_supply_cabinet", roomKey: "mech", position: [9, 3] },
      { modelKey: "room_crate_stack", roomKey: "dist", position: [-5.6, -5.4] },
    ],
  },
  {
    id: "museum_atrium",
    label: "博物馆中庭",
    hint: "大中庭 + 左右翼展厅，回收档案门",
    accent: "#e0b25a",
    shape: "open",
    rooms: [
      { key: "atrium", label: "中庭", style: "museum", center: [0, 3], size: [14, 10] },
      { key: "west", label: "左翼", style: "museum", center: [-10, 3], size: [6, 10] },
      { key: "eastWing", label: "右翼", style: "museum", center: [10, 3], size: [6, 10] },
    ],
    doors: [
      { fromKey: "atrium", toKey: "west", doorFamily: "reclamation" },
      { fromKey: "atrium", toKey: "eastWing", doorFamily: "reclamation" },
    ],
    props: [
      { modelKey: "room_museum_archive_column", roomKey: "atrium", position: [-4.5, 3] },
      { modelKey: "room_museum_archive_column", roomKey: "atrium", position: [4.5, 3] },
      { modelKey: "room_museum_low_barrier", roomKey: "atrium", position: [0, 6.2] },
      { modelKey: "room_museum_color_orb_pedestal", roomKey: "west", position: [-10, 3] },
      { modelKey: "room_museum_color_orb_pedestal", roomKey: "eastWing", position: [10, 3] },
    ],
  },
];

export function buildingPresetById(id: string): BuilderBuildingPreset | undefined {
  return builderBuildingPresets.find((preset) => preset.id === id);
}

/** Rotate a local point 90°·k clockwise about the origin. */
function rotatePoint(x: number, z: number, quarterTurns: number): [number, number] {
  let px = x;
  let pz = z;
  const turns = ((quarterTurns % 4) + 4) % 4;
  for (let i = 0; i < turns; i += 1) {
    const nx = pz;
    const nz = -px;
    px = nx;
    pz = nz;
  }
  return [px, pz];
}

/**
 * Resolves a preset into appendable geometry: assigns fresh ids, rotates the
 * whole cluster by `quarterTurns`·90°, then offsets so its center lands on
 * `dropCenter`. Doors carry no position (the compiler derives the shared edge),
 * so rotating the rooms rotates the openings for free.
 */
export function stampBuildingPreset(
  preset: BuilderBuildingPreset,
  dropCenter: readonly [number, number],
  quarterTurns: number,
): StampedBuilding {
  const odd = (((quarterTurns % 4) + 4) % 4) % 2 === 1;
  const idByKey = new Map<string, string>();
  const rooms: BuilderRoom[] = preset.rooms.map((room) => {
    const id = createBuilderId("room");
    idByKey.set(room.key, id);
    const [cx, cz] = rotatePoint(room.center[0], room.center[1], quarterTurns);
    const size: [number, number] = odd ? [room.size[1], room.size[0]] : [room.size[0], room.size[1]];
    return {
      id,
      label: room.label,
      style: room.style,
      center: [cx + dropCenter[0], cz + dropCenter[1]] as [number, number],
      size,
    };
  });

  const doors: BuilderDoor[] = preset.doors
    .map((door): BuilderDoor | null => {
      const fromRoomId = idByKey.get(door.fromKey);
      const toRoomId = idByKey.get(door.toKey);
      if (!fromRoomId || !toRoomId) return null;
      const fromRoom = rooms.find((room) => room.id === fromRoomId);
      const toRoom = rooms.find((room) => room.id === toRoomId);
      return {
        id: createBuilderId("door"),
        label: fromRoom && toRoom ? `${fromRoom.label}—${toRoom.label}` : undefined,
        fromRoomId,
        toRoomId,
        lockType: door.lockType ?? "none",
        ...(door.doorFamily ? { doorFamily: door.doorFamily } : {}),
      };
    })
    .filter((door): door is BuilderDoor => door !== null);

  const props: BuilderProp[] = preset.props
    .map((prop): BuilderProp | null => {
      const roomId = idByKey.get(prop.roomKey);
      if (!roomId) return null;
      const [px, pz] = rotatePoint(prop.position[0], prop.position[1], quarterTurns);
      return {
        id: createBuilderId("prop"),
        modelKey: prop.modelKey,
        roomId,
        position: [px + dropCenter[0], pz + dropCenter[1]],
        rotationY: (prop.rotationY ?? 0) + (quarterTurns * Math.PI) / 2,
        scale: 1,
      };
    })
    .filter((prop): prop is BuilderProp => prop !== null);

  return { rooms, doors, props };
}

/** Rotated cluster bounds in preset-local space (before the drop offset). */
function rotatedClusterBounds(preset: BuilderBuildingPreset, quarterTurns: number) {
  const odd = (((quarterTurns % 4) + 4) % 4) % 2 === 1;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const room of preset.rooms) {
    const [cx, cz] = rotatePoint(room.center[0], room.center[1], quarterTurns);
    const w = odd ? room.size[1] : room.size[0];
    const d = odd ? room.size[0] : room.size[1];
    minX = Math.min(minX, cx - w / 2);
    maxX = Math.max(maxX, cx + w / 2);
    minZ = Math.min(minZ, cz - d / 2);
    maxZ = Math.max(maxZ, cz + d / 2);
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * A drop point that lands the *rotated* cluster clear to the right of every
 * existing room: the cluster's own leftmost edge is offset to sit `gap` metres
 * past the rightmost existing wall (so wide presets like 博物馆中庭 never overlap),
 * and its vertical center is aligned to the existing rooms' average z.
 */
export function suggestBuildingDropCenter(
  project: BuilderProject,
  preset: BuilderBuildingPreset,
  quarterTurns: number,
): [number, number] {
  const bounds = rotatedClusterBounds(preset, quarterTurns);
  if (project.rooms.length === 0) return [0, 0];
  const gap = 4;
  let maxX = -Infinity;
  let sumZ = 0;
  for (const room of project.rooms) {
    maxX = Math.max(maxX, room.center[0] + room.size[0] / 2);
    sumZ += room.center[1];
  }
  const dropX = maxX + gap - bounds.minX;
  const dropZ = sumZ / project.rooms.length - (bounds.minZ + bounds.maxZ) / 2;
  return [dropX, dropZ];
}
