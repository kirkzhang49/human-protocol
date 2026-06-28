import type {
  LevelInteractionDefinition,
  LevelPuzzleActorDefinition,
  LevelPuzzleColorKey,
  LevelPuzzleDefinition,
  LevelPuzzleTargetDefinition,
  LevelToolCalibrationCellDefinition,
  LevelToolCalibrationVariantDefinition,
} from "../game/config/schema/levelConfig";
import { buildGalleryReadingPreset } from "../game/config/content/galleryReadingArchive";
import { builderPuzzleColors } from "./BuilderAssetCatalog";
import { normalizeAnchoredPuzzleComponents } from "./BuilderPuzzlePlacement";
import { colorPuzzleTargetFromBuilderComponent } from "./official-bridge/PuzzleVisualBridge";
import { puzzleActorFromBuilderComponent } from "./official-bridge/PuzzleActorBridge";
import {
  createBuilderId,
  type BuilderDoor,
  type BuilderProject,
  type BuilderPuzzleComponent,
  type BuilderPuzzleInstance,
  type BuilderPuzzleKind,
  type BuilderRoom,
  type BuilderWallMount,
} from "./BuilderTypes";
import { sharedEdge } from "./compileBuilderProjectToLevel";
import { wallMountFromPoint, wallMountPlacementForRoom } from "./BuilderPlacementRules";

/**
 * First-class puzzle lane for /build. Each kind maps onto an EXISTING runtime
 * puzzle system — color orbs (hit_sequence) or the 2D consoles
 * (circuit_grid / valve_matrix / archive_merge plus legacy overlays) — through
 * curated, provably-solvable presets. No new puzzle engine.
 *
 * Authoring model: a BuilderPuzzleInstance is the freely-placed terminal/clue
 * panel linked to one door; color sequences carry separately placed orb
 * components. Legacy drafts that only carry BuilderDoor.puzzleKind are
 * normalized into instances (see normalizeBuilderPuzzles).
 */

export interface BuilderPuzzleKindEntry {
  kind: BuilderPuzzleKind;
  label: string;
  glyph: string;
  color: string;
  /** How the player solves it (card line 1). */
  howToSolve: string;
  /** What it can unlock (card line 2). */
  unlocks: string;
  /** Objective title shown in the playtest HUD chain. */
  objectiveTitle: string;
  /** Objective detail line (host room is prefixed at compile time). */
  objectiveDetail: string;
  /**
   * "premium" kinds are offered as fresh chips in /build. "legacy" kinds stay
   * fully supported for old drafts and official levels but are hidden from the
   * main picker.
   */
  tier: "premium" | "legacy";
}

export const builderPuzzleKinds: readonly BuilderPuzzleKindEntry[] = [
  {
    kind: "color_sequence",
    label: "灯序记忆锁",
    glyph: "◉",
    color: "#b47aff",
    howToSolve: "看灯墙亮序，再按顺序射击色球",
    unlocks: "解锁一扇谜题门",
    objectiveTitle: "确认灯序",
    objectiveDetail: "看灯墙亮序后按顺序击中色球。",
    tier: "premium",
  },
  {
    kind: "code_lock",
    label: "方向密码锁",
    glyph: "#",
    color: "#ffcf6a",
    howToSolve: "读取场景数字和公式，输入门禁码",
    unlocks: "解锁一扇谜题门",
    objectiveTitle: "输入门禁码",
    objectiveDetail: "根据场景线索输入正确密码。",
    tier: "legacy",
  },
  {
    kind: "circuit_grid",
    label: "工具档案校准",
    glyph: "⌗",
    color: "#54f1ff",
    howToSolve: "旋转馆藏线路，让信号经过协议格并接到双端口",
    unlocks: "解锁一扇谜题门",
    objectiveTitle: "校准工具档案",
    objectiveDetail: "让信号经过协议格并接到双端口。",
    tier: "premium",
  },
  {
    kind: "archive_merge",
    label: "身份压缩柜",
    glyph: "▧",
    color: "#f0c46f",
    howToSolve: "合并相同身份片，把档案压到目标阶",
    unlocks: "解锁一扇谜题门",
    objectiveTitle: "压缩身份片",
    objectiveDetail: "合并相同身份片，达到档案目标阶。",
    tier: "premium",
  },
  {
    kind: "gallery_reading",
    label: "展画审读机",
    glyph: "▤",
    color: "#e7c478",
    howToSolve: "读墙上展画的展签与档案，再回答归档问询",
    unlocks: "解锁一扇谜题门",
    objectiveTitle: "通过展画审读",
    objectiveDetail: "读懂展画线索，答对档案问询。",
    tier: "legacy",
  },
  {
    kind: "surveillance_match",
    label: "展品归档比对",
    glyph: "◍",
    color: "#9be8ff",
    howToSolve: "把四路展厅画面归到正确展区，空展位也要登记",
    unlocks: "解锁一扇谜题门",
    objectiveTitle: "完成展品归档",
    objectiveDetail: "给每个展厅画面选出正确归属。",
    tier: "legacy",
  },
  {
    kind: "valve_matrix",
    label: "闸门配平台",
    glyph: "◎",
    color: "#ffb34f",
    howToSolve: "调左闸、中闸、右闸，让三块状态表同时进绿区",
    unlocks: "解锁一扇谜题门",
    objectiveTitle: "配平闸门",
    objectiveDetail: "调节三道闸门，让三块状态表同时进绿区。",
    tier: "premium",
  },
];

/** Premium families offered as fresh chips in /build (four-up roster). */
export const builderPuzzlePublicKinds: readonly BuilderPuzzleKindEntry[] = builderPuzzleKinds.filter(
  (entry) => entry.tier === "premium",
);

export const archiveMergeTargetOptions = [32, 64, 128, 256, 512, 1024, 2048] as const;
export const valveMatrixTimeLimit = { min: 30, max: 60, default: 30, step: 5 } as const;
export const valveMatrixInteractionRadius = 2.75;

export function normalizeArchiveMergeTarget(value: unknown): (typeof archiveMergeTargetOptions)[number] {
  const numeric = typeof value === "number" ? value : Number(value);
  return archiveMergeTargetOptions.includes(numeric as (typeof archiveMergeTargetOptions)[number])
    ? (numeric as (typeof archiveMergeTargetOptions)[number])
    : 32;
}

export function normalizeValveMatrixTimeLimit(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  const rounded = Number.isFinite(numeric)
    ? Math.round(numeric / valveMatrixTimeLimit.step) * valveMatrixTimeLimit.step
    : valveMatrixTimeLimit.default;
  return Math.min(valveMatrixTimeLimit.max, Math.max(valveMatrixTimeLimit.min, rounded));
}

export function puzzleKindEntry(kind: BuilderPuzzleKind | undefined): BuilderPuzzleKindEntry {
  return builderPuzzleKinds.find((entry) => entry.kind === (kind ?? "color_sequence")) ?? builderPuzzleKinds[0];
}

const dedicated2DPuzzleConsoleVisualKeys = {
  archive_merge: "puzzle_console_archive_merge",
  circuit_grid: "puzzle_console_circuit_grid",
  gallery_reading: "puzzle_console_gallery_reading",
  surveillance_match: "puzzle_console_surveillance_match",
  valve_matrix: "puzzle_console_valve_matrix",
} as const satisfies Partial<Record<BuilderPuzzleKind, string>>;

function visualKeyFor2DPuzzleConsole(kind: BuilderPuzzleKind): string {
  return dedicated2DPuzzleConsoleVisualKeys[kind as keyof typeof dedicated2DPuzzleConsoleVisualKeys] ?? "control_bank";
}

/** Effective puzzle kind of a door (legacy puzzle doors = color sequence). */
export function doorPuzzleKind(door: BuilderDoor): BuilderPuzzleKind {
  return door.puzzleKind ?? "color_sequence";
}

/** Orb component role → runtime color key ("orb_red" → "red"); null for non-orbs. */
export function orbColorKey(role: BuilderPuzzleComponent["role"]): LevelPuzzleColorKey | null {
  if (!role.startsWith("orb_")) return null;
  return role.slice(4) as LevelPuzzleColorKey;
}

export function orbColorHex(role: BuilderPuzzleComponent["role"]): string {
  const key = orbColorKey(role);
  return builderPuzzleColors.find((entry) => entry.colorKey === key)?.hex ?? "#b47aff";
}

export function puzzleInstances(project: BuilderProject): readonly BuilderPuzzleInstance[] {
  return project.puzzles ?? [];
}

export function puzzleById(project: BuilderProject, id: string): BuilderPuzzleInstance | null {
  return puzzleInstances(project).find((instance) => instance.id === id) ?? null;
}

export function puzzleResultMode(instance: BuilderPuzzleInstance | undefined): NonNullable<BuilderPuzzleInstance["resultMode"]> {
  return instance?.resultMode ?? "open_door";
}

export function puzzleForDoor(project: BuilderProject, doorId: string): BuilderPuzzleInstance | null {
  return puzzleInstances(project).find((instance) => instance.linkedDoorId === doorId && puzzleResultMode(instance) === "open_door") ?? null;
}

/** Deterministic console anchor inside a room (used for defaults + legacy synth). */
export function puzzleConsoleAnchor(room: BuilderRoom, slot = 0): readonly [number, number] {
  const x = room.center[0] + room.size[0] * 0.3 - (slot % 3) * 1.1;
  const z = room.center[1] - room.size[1] * 0.3;
  return [
    Math.min(room.center[0] + room.size[0] / 2 - 0.9, Math.max(room.center[0] - room.size[0] / 2 + 0.9, x)),
    Math.min(room.center[1] + room.size[1] / 2 - 0.9, Math.max(room.center[1] - room.size[1] / 2 + 0.9, z)),
  ];
}

const defaultOrbRoles = ["orb_red", "orb_blue", "orb_green"] as const;

function valvePuzzleWallMountForPoint(room: BuilderRoom, point: readonly [number, number], existing?: BuilderWallMount): BuilderWallMount {
  const inferred = wallMountFromPoint(room, point[0], point[1]);
  return {
    side: existing?.side ?? inferred.side,
    offset: existing?.offset ?? inferred.offset,
    height: existing?.height ?? 1.34,
    inset: existing?.inset ?? 0.16,
  };
}

function valvePuzzleWallPlan(room: BuilderRoom, mount: BuilderWallMount): readonly [number, number] {
  return wallMountPlacementForRoom(room, mount).plan;
}

function valveConsoleSourceInteraction(source: BuilderPuzzleInstance["sourceInteraction"]): BuilderPuzzleInstance["sourceInteraction"] {
  if (!source) return undefined;
  const { hostPropId: _hostPropId, visualKey: _visualKey, ...rest } = source;
  return {
    ...rest,
    radius: Math.max(source.radius ?? valveMatrixInteractionRadius, valveMatrixInteractionRadius),
    visualKey: "puzzle_console_valve_matrix",
    materialKey: source.materialKey ?? "terminal_cyan",
  };
}

/** Default orb line-up across the room (legacy compile used the same layout). */
function defaultOrbComponents(room: BuilderRoom, sequence?: readonly LevelPuzzleColorKey[], idPrefix?: string): BuilderPuzzleComponent[] {
  const roles = (sequence && sequence.length >= 2 ? sequence.map((color) => `orb_${color}` as const) : defaultOrbRoles).slice(0, 7);
  const spread = Math.min(room.size[0] - 2.4, roles.length * 1.7);
  return roles.map((role, index) => {
    const t = roles.length <= 1 ? 0.5 : index / (roles.length - 1);
    return {
      id: idPrefix ? `${idPrefix}_component_${index + 1}` : createBuilderId("pzc"),
      role,
      roomId: room.id,
      position: [room.center[0] - spread / 2 + spread * t, room.center[1] - room.size[1] * 0.22] as const,
    };
  });
}

/** Fresh instance for a door, with sensible defaults per kind. */
export function createPuzzleInstanceForDoor(
  project: BuilderProject,
  door: BuilderDoor,
  kind: BuilderPuzzleKind,
  options: {
    id?: string;
    sequence?: readonly LevelPuzzleColorKey[];
    roomId?: string;
    position?: readonly [number, number];
    wallMount?: BuilderWallMount;
    componentIdPrefix?: string;
  } = {},
): BuilderPuzzleInstance {
  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const room =
    roomsById.get(options.roomId ?? "") ??
    roomsById.get(door.puzzleRoomId ?? "") ??
    roomsById.get(door.fromRoomId) ??
    project.rooms[0];
  const slot = puzzleInstances(project).length;
  const anchor = options.position ?? (room ? puzzleConsoleAnchor(room, slot) : [0, 0]);
  const wallMount = kind === "valve_matrix" ? undefined : options.wallMount;
  const position = wallMount && room ? valvePuzzleWallPlan(room, wallMount) : anchor;
  return {
    id: options.id ?? createBuilderId("pz"),
    kind,
    linkedDoorId: door.id,
    roomId: room?.id ?? door.fromRoomId,
    position,
    rotationY: 0,
    ...(wallMount ? { wallMount } : {}),
    ...(kind === "color_sequence" && room ? { components: defaultOrbComponents(room, options.sequence, options.componentIdPrefix ?? options.id) } : {}),
    ...(kind === "archive_merge" ? { archiveTargetValue: 32 } : {}),
    ...(kind === "valve_matrix" ? { timeLimitSec: valveMatrixTimeLimit.default } : {}),
  };
}

/**
 * Migration: synthesize instances for legacy puzzle doors (puzzleKind /
 * puzzleRoomId / project.puzzle only). Returns the same reference when
 * nothing needs to change, so it is safe to call on every load.
 */
export function normalizeBuilderPuzzles(project: BuilderProject): BuilderProject {
  const doorsById = new Map(project.doors.map((door) => [door.id, door]));
  let next = project;
  let changed = false;
  const normalizedInstances = puzzleInstances(project).map((instance) => {
    const door = doorsById.get(instance.linkedDoorId);
    const room = project.rooms.find((candidate) => candidate.id === instance.roomId);
    const sourceMatches = sourcePuzzleMatchesBuilderKind(instance);
    const sourceInteraction = sourceMatches ? instance.sourceInteraction : undefined;
    const hostProp = sourceInteraction?.hostPropId ? project.props.find((prop) => prop.id === sourceInteraction.hostPropId) : undefined;
    if (instance.kind === "valve_matrix" && room) {
      const wallPlacement = instance.wallMount ? wallMountPlacementForRoom(room, instance.wallMount) : null;
      const position = hostProp?.position ?? (wallPlacement ? wallPlacement.plan : instance.position);
      const rotationY = hostProp?.rotationY ?? wallPlacement?.yaw ?? instance.rotationY;
      const nextSourceInteraction = valveConsoleSourceInteraction(sourceInteraction);
      const timeLimitSec = normalizeValveMatrixTimeLimit(instance.timeLimitSec);
      if (
        instance.wallMount ||
        instance.position[0] !== position[0] ||
        instance.position[1] !== position[1] ||
        instance.rotationY !== rotationY ||
        instance.timeLimitSec !== timeLimitSec ||
        (sourceInteraction && nextSourceInteraction && sourceInteraction.visualKey !== nextSourceInteraction.visualKey) ||
        sourceInteraction?.hostPropId
      ) {
        changed = true;
        return { ...instance, position, rotationY, timeLimitSec, wallMount: undefined, ...(nextSourceInteraction ? { sourceInteraction: nextSourceInteraction } : {}) };
      }
    }
    if (puzzleResultMode(instance) === "grant_key" && door?.lockType === "puzzle_complete") {
      changed = true;
      return { ...instance, resultMode: "open_door" as const };
    }
    return instance;
  });
  if (changed) next = { ...next, puzzles: normalizedInstances };
  next = normalizeAnchoredPuzzleComponents(next);

  const missing = next.doors.filter((door) => door.lockType === "puzzle_complete" && !puzzleForDoor(next, door.id));
  if (missing.length === 0) return next;
  for (const door of missing) {
    const kind = doorPuzzleKind(door);
    const stableId = stablePuzzleIdForDoor(door);
    const instance = createPuzzleInstanceForDoor(next, door, kind, {
      id: stableId,
      componentIdPrefix: stableId,
      ...(kind === "color_sequence"
        ? { sequence: next.puzzle?.sequence, roomId: next.puzzle?.roomId }
        : {}),
    });
    next = { ...next, puzzles: [...puzzleInstances(next), instance] };
  }
  return next;
}

function stablePuzzleIdForDoor(door: BuilderDoor) {
  if (door.sourceDoor?.lock?.type === "puzzle_complete" && door.sourceDoor.lock.puzzleId) {
    return door.sourceDoor.lock.puzzleId;
  }
  return `pz_${safeBuilderIdFragment(door.id)}`;
}

function safeBuilderIdFragment(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "door";
}

// ---------------------------------------------------------------------------
// Builder-side validation (surfaces through 校验 / save / playtest issues)
// ---------------------------------------------------------------------------

export interface BuilderPuzzleIssue {
  path: string;
  message: string;
}

function insideRoom(room: BuilderRoom, position: readonly [number, number], margin = 0.2) {
  return (
    Math.abs(position[0] - room.center[0]) <= room.size[0] / 2 - margin &&
    Math.abs(position[1] - room.center[1]) <= room.size[1] / 2 - margin
  );
}

/** Rooms reachable from spawn over valid doors, pretending `excludeDoorId` stays shut. */
function reachableRoomsWithoutDoor(project: BuilderProject, excludeDoorId: string): Set<string> {
  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const start = project.rooms[0]?.id;
  const visited = new Set<string>(start ? [start] : []);
  let changed = visited.size > 0;
  while (changed) {
    changed = false;
    for (const door of project.doors) {
      if (door.id === excludeDoorId) continue;
      const fromRoom = roomsById.get(door.fromRoomId);
      const toRoom = roomsById.get(door.toRoomId);
      if (!fromRoom || !toRoom || !sharedEdge(fromRoom, toRoom)) continue;
      if (visited.has(door.fromRoomId) && !visited.has(door.toRoomId)) {
        visited.add(door.toRoomId);
        changed = true;
      }
      if (visited.has(door.toRoomId) && !visited.has(door.fromRoomId)) {
        visited.add(door.fromRoomId);
        changed = true;
      }
    }
  }
  return visited;
}

/** Friendly, builder-language checks for every puzzle instance. */
export function validateBuilderPuzzles(project: BuilderProject): BuilderPuzzleIssue[] {
  const normalized = normalizeBuilderPuzzles(project);
  if (normalized !== project) project = normalized;
  const issues: BuilderPuzzleIssue[] = [];
  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const doorsById = new Map(project.doors.map((door) => [door.id, door]));
  const propsById = new Map(project.props.map((prop) => [prop.id, prop]));
  const seenIds = new Set<string>();
  const seenDoors = new Set<string>();
  const instances = puzzleInstances(project);

  const colorInstances = instances.filter((instance) => instance.kind === "color_sequence");
  if (colorInstances.length > 1) {
    issues.push({ path: `puzzles.${colorInstances[1].id}`, message: "颜色顺序锁只能有一座——把多余的换成校准 / 归档 / 闸门谜题。" });
  }

  for (const instance of instances) {
    const path = `puzzles.${instance.id}`;
    const entry = puzzleKindEntry(instance.kind);

    if (seenIds.has(instance.id)) {
      issues.push({ path, message: "有两座谜题用了同一个内部编号——删除其中一座再重新放置。" });
      continue;
    }
    seenIds.add(instance.id);

    const resultMode = puzzleResultMode(instance);
    const door = doorsById.get(instance.linkedDoorId);
    if (!door) {
      issues.push({ path, message: `「${entry.label}」绑定的门已被删除——在右侧重新绑定一扇门，或删除这座谜题。` });
      continue;
    }
    if (seenDoors.has(door.id)) {
      issues.push({ path, message: `有两座谜题绑定了同一扇门——一扇门只能由一座谜题解锁。` });
    }
    seenDoors.add(door.id);
    if (resultMode === "open_door" && door.lockType !== "puzzle_complete") {
      issues.push({ path, message: `「${entry.label}」绑定的门不再是谜题锁——在右侧重新绑定，或删除这座谜题。` });
    }
    if (resultMode === "grant_key" && door.lockType !== "key_item") {
      issues.push({ path, message: `「${entry.label}」的结果是授予钥匙，但绑定的门不是钥匙门——换一扇钥匙门，或改回直接开门。` });
    }
    const fromRoom = roomsById.get(door.fromRoomId);
    const toRoom = roomsById.get(door.toRoomId);
    const edge = fromRoom && toRoom ? sharedEdge(fromRoom, toRoom) : null;
    if (!edge) {
      issues.push({ path, message: `「${entry.label}」的门两端房间没有贴边——拖动房间让边缘贴齐。` });
    }

    const room = roomsById.get(instance.roomId);
    if (!room) {
      issues.push({ path, message: `「${entry.label}」的谜题台所在房间已被删除——把谜题台拖进一间房。` });
    } else if (!instance.wallMount && !insideRoom(room, instance.position)) {
      issues.push({ path, message: `「${entry.label}」的谜题台在房间外面——拖回「${room.label}」内。` });
    }
    // The classic trap: console locked behind the very door it opens.
    const reachable = door && edge ? reachableRoomsWithoutDoor(project, door.id) : null;
    if (reachable && room && !reachable.has(room.id)) {
      issues.push({ path, message: `「${entry.label}」的谜题台被锁在它自己解锁的门后面——把谜题台移到门前能到达的房间。` });
    }
    if (edge && room && !instance.wallMount) {
      const doorDistance = Math.hypot(instance.position[0] - edge.position[0], instance.position[1] - edge.position[2]);
      if (doorDistance < 1.1) {
        issues.push({ path, message: `「${entry.label}」的谜题台太贴门口，会挡住门——往房间里挪一点。` });
      }
    }
    const hostPropId = sourcePuzzleMatchesBuilderKind(instance) ? instance.sourceInteraction?.hostPropId : undefined;
    if (hostPropId) {
      const hostProp = propsById.get(hostPropId);
      if (!hostProp) {
        issues.push({ path, message: `「${entry.label}」绑定的交互道具已被删除——重新选择一个展柜/面板/道具，或改回独立谜题台。` });
      } else if (room && hostProp.roomId !== room.id) {
        issues.push({ path, message: `「${entry.label}」绑定的交互道具不在谜题台房间内——重新选择同房间的道具。` });
      }
    }

    const components = instance.components ?? [];
    const seenComponentIds = new Set<string>();
    for (const component of components) {
      if (seenComponentIds.has(component.id)) {
        issues.push({ path, message: `「${entry.label}」有两个部件用了同一个内部编号——删除并重新添加色球。` });
        break;
      }
      seenComponentIds.add(component.id);
      const componentRoom = roomsById.get(component.roomId);
      if (!componentRoom) {
        issues.push({ path, message: `「${entry.label}」有部件所在的房间已被删除——把它拖进一间房。` });
      } else if (!insideRoom(componentRoom, component.position)) {
        issues.push({ path, message: `「${entry.label}」的色球在房间外面——拖回「${componentRoom.label}」内。` });
      }
      if (edge && Math.hypot(component.position[0] - edge.position[0], component.position[1] - edge.position[2]) < 1.1) {
        issues.push({ path, message: `「${entry.label}」的色球太贴门口，会挡住门——往房间里挪一点。` });
      }
      if (reachable && componentRoom && !reachable.has(componentRoom.id)) {
        issues.push({ path, message: `「${entry.label}」有色球被锁在它自己解锁的门后面——移到门前能到达的房间。` });
      }
      const anchorPropId = component.sourceActor?.anchorPropId ?? component.sourceTarget?.anchorPropId;
      if (anchorPropId) {
        const anchorProp = propsById.get(anchorPropId);
        if (!anchorProp) {
          issues.push({ path, message: `「${entry.label}」有色球锚定的道具已被删除——重新选择基座/展柜，或改回独立色球。` });
        } else if (componentRoom && anchorProp.roomId !== componentRoom.id) {
          issues.push({ path, message: `「${entry.label}」有色球锚定到其他房间的道具——重新选择同房间的基座/展柜。` });
        }
      }
    }

    if (instance.kind === "color_sequence") {
      const orbColors = components.map((component) => orbColorKey(component.role)).filter(Boolean);
      if (orbColors.length < 2) {
        issues.push({ path, message: "颜色顺序锁至少需要 2 个色球——在右侧「添加色球」。" });
      }
      if (new Set(orbColors).size !== orbColors.length) {
        issues.push({ path, message: "颜色顺序锁的色球颜色不能重复——在右侧给色球换个颜色。" });
      }
    }
    if (
      instance.kind === "archive_merge" &&
      instance.archiveTargetValue !== undefined &&
      normalizeArchiveMergeTarget(instance.archiveTargetValue) !== instance.archiveTargetValue
    ) {
      issues.push({ path, message: "身份压缩柜目标必须是 32、64、128、256、512、1024 或 2048。" });
    }
  }

  return issues;
}

/** True when validation says at least one real playable puzzle chain exists. */
export function hasPlayablePuzzleChain(project: BuilderProject): boolean {
  const normalized = normalizeBuilderPuzzles(project);
  const instances = puzzleInstances(normalized);
  if (instances.length === 0) return false;
  const issues = validateBuilderPuzzles(normalized);
  const broken = new Set(issues.map((issue) => issue.path));
  return instances.some((instance) => !broken.has(`puzzles.${instance.id}`));
}

// ---------------------------------------------------------------------------
// Compile — instances onto the existing runtime systems (smoke-config presets)
// ---------------------------------------------------------------------------

export interface CompiledBuilderPuzzle {
  interaction: LevelInteractionDefinition;
  puzzle: LevelPuzzleDefinition;
  lockedMessage: string;
  unlockedMessage: string;
}

function builderKindForSourcePuzzle(sourcePuzzle: LevelPuzzleDefinition | undefined): BuilderPuzzleKind | null {
  if (!sourcePuzzle) return null;
  switch (sourcePuzzle.type) {
    case "hit_sequence":
      return "color_sequence";
    case "code_lock":
      return "code_lock";
    case "tool_calibration":
      return "circuit_grid";
    case "surveillance_match":
      return "surveillance_match";
    case "valve_matrix":
      return "valve_matrix";
    case "archive_merge":
      return "archive_merge";
    case "gallery_reading":
      return "gallery_reading";
    default:
      return null;
  }
}

function sourcePuzzleMatchesBuilderKind(instance: BuilderPuzzleInstance) {
  const sourceKind = builderKindForSourcePuzzle(instance.sourcePuzzle);
  return !sourceKind || sourceKind === instance.kind;
}

function sourceInteractionForPuzzle(
  instance: BuilderPuzzleInstance,
  room: BuilderRoom,
  defaults: {
    type?: LevelInteractionDefinition["type"];
    radius: number;
    visualKey: string;
    materialKey: string;
    label: string;
  },
): LevelInteractionDefinition {
  const source = sourcePuzzleMatchesBuilderKind(instance) ? instance.sourceInteraction : undefined;
  const wallPlacement = !source?.hostPropId && instance.wallMount ? wallMountPlacementForRoom(room, instance.wallMount) : null;
  return {
    id: instance.interactionId ?? `pz_${instance.linkedDoorId}_panel`,
    type: source?.type ?? defaults.type ?? "terminal",
    roomId: room.id,
    position: wallPlacement ? ([...wallPlacement.position] as [number, number, number]) : [instance.position[0], 0, instance.position[1]],
    ...(wallPlacement ? { yaw: wallPlacement.yaw } : { yaw: instance.rotationY }),
    radius: source?.radius !== undefined ? Math.max(source.radius, defaults.radius) : defaults.radius,
    visualKey: source?.visualKey ?? defaults.visualKey,
    materialKey: source?.materialKey ?? defaults.materialKey,
    ...(source?.hostPropId ? { anchorPropId: source.hostPropId } : {}),
    label: source?.label ?? defaults.label,
    ...(source?.startsObjectiveId ? { startsObjectiveId: source.startsObjectiveId } : {}),
    ...(source?.completesObjectiveId ? { completesObjectiveId: source.completesObjectiveId } : {}),
    ...(source?.grantsKeyItemId ? { grantsKeyItemId: source.grantsKeyItemId } : {}),
    ...(source?.consumesKeyItemId ? { consumesKeyItemId: source.consumesKeyItemId } : {}),
    ...(source?.opensDoorId ? { opensDoorId: source.opensDoorId } : {}),
    ...(source?.requiresObjectiveId ? { requiresObjectiveId: source.requiresObjectiveId } : {}),
    ...(source?.requiresArticleIds?.length ? { requiresArticleIds: source.requiresArticleIds } : {}),
    ...(source?.requiresSwitchState ? { requiresSwitchState: source.requiresSwitchState } : {}),
    ...(source?.dialogueTrigger ? { dialogueTrigger: source.dialogueTrigger } : {}),
    ...(source?.rewardPulse ? { rewardPulse: source.rewardPulse } : {}),
    ...(source?.rewardPulseDuration !== undefined ? { rewardPulseDuration: source.rewardPulseDuration } : {}),
    ...(source?.audio ? { audio: source.audio } : {}),
  };
}

function patchImportedPuzzle(
  puzzle: LevelPuzzleDefinition,
  instance: BuilderPuzzleInstance,
  door: BuilderDoor,
  room: BuilderRoom,
  interactionId: string,
): LevelPuzzleDefinition {
  const success = {
    ...puzzle.success,
    ...(puzzleResultMode(instance) === "open_door" ? { opensDoorId: door.id } : {}),
  };
  if (puzzle.type === "hit_sequence") {
    return puzzle;
  }
  if (puzzle.type === "valve_matrix") {
    return {
      ...puzzle,
      id: instance.id || puzzle.id,
      roomId: room.id,
      interactionId,
      timeLimitSec: normalizeValveMatrixTimeLimit(instance.timeLimitSec ?? puzzle.timeLimitSec),
      success,
    };
  }
  return {
    ...puzzle,
    id: instance.id || puzzle.id,
    roomId: room.id,
    interactionId,
    success,
  } as LevelPuzzleDefinition;
}

function compileImportedPuzzle(
  instance: BuilderPuzzleInstance,
  door: BuilderDoor,
  room: BuilderRoom,
  defaults: Parameters<typeof sourceInteractionForPuzzle>[2],
): CompiledBuilderPuzzle | null {
  const sourcePuzzle = instance.sourcePuzzle;
  if (!sourcePuzzle || sourcePuzzle.type === "hit_sequence") return null;
  if (!sourcePuzzleMatchesBuilderKind(instance)) return null;
  const entry = puzzleKindEntry(instance.kind);
  const interaction = sourceInteractionForPuzzle(instance, room, defaults);
  return {
    interaction,
    puzzle: patchImportedPuzzle(sourcePuzzle, instance, door, room, interaction.id),
    lockedMessage: `先在「${room.label}」完成${entry.label}。`,
    unlockedMessage: `${entry.label}完成，门已解锁。`,
  };
}

const builderToolCalibrationCells: readonly LevelToolCalibrationCellDefinition[] = [
  { x: 0, y: 0, kind: "corner", rotation: 2 },
  { x: 1, y: 0, kind: "straight", rotation: 0 },
  { x: 2, y: 0, kind: "tee", rotation: 3 },
  { x: 3, y: 0, kind: "blocked" },
  { x: 4, y: 0, kind: "corner", rotation: 1 },
  { x: 5, y: 0, kind: "straight", rotation: 0 },
  { x: 0, y: 1, kind: "tee", rotation: 2 },
  { x: 1, y: 1, kind: "corner", rotation: 3 },
  { x: 2, y: 1, kind: "straight", rotation: 0 },
  { x: 3, y: 1, kind: "corner", rotation: 1 },
  { x: 4, y: 1, kind: "corner", rotation: 0 },
  { x: 5, y: 1, kind: "straight", rotation: 1 },
  { x: 0, y: 2, kind: "straight", rotation: 1 },
  { x: 1, y: 2, kind: "straight", rotation: 1 },
  { x: 2, y: 2, kind: "straight", rotation: 1 },
  { x: 3, y: 2, kind: "amplifier", rotation: 0 },
  { x: 4, y: 2, kind: "tee", rotation: 0 },
  { x: 5, y: 2, kind: "blocked" },
  { x: 0, y: 3, kind: "blocked" },
  { x: 1, y: 3, kind: "corner", rotation: 0 },
  { x: 2, y: 3, kind: "tee", rotation: 0 },
  { x: 3, y: 3, kind: "straight", rotation: 1 },
  { x: 4, y: 3, kind: "corner", rotation: 0 },
  { x: 5, y: 3, kind: "straight", rotation: 1 },
];

const builderToolCalibrationVariants: readonly LevelToolCalibrationVariantDefinition[] = [
  {
    id: "builder_tool_route_01",
    solutionMoveCount: 5,
    rotationOverrides: [
      { x: 0, y: 2, rotation: 0 },
      { x: 1, y: 2, rotation: 0 },
      { x: 4, y: 2, rotation: 3 },
      { x: 4, y: 1, rotation: 0 },
      { x: 4, y: 3, rotation: 3 },
    ],
  },
  {
    id: "builder_tool_route_02",
    solutionMoveCount: 4,
    rotationOverrides: [
      { x: 0, y: 2, rotation: 0 },
      { x: 4, y: 2, rotation: 3 },
      { x: 4, y: 1, rotation: 0 },
      { x: 4, y: 3, rotation: 3 },
    ],
  },
  {
    id: "builder_tool_route_03",
    solutionMoveCount: 6,
    rotationOverrides: [
      { x: 0, y: 2, rotation: 3 },
      { x: 1, y: 2, rotation: 0 },
      { x: 4, y: 2, rotation: 2 },
      { x: 4, y: 1, rotation: 0 },
    ],
  },
  {
    id: "builder_tool_route_04",
    solutionMoveCount: 5,
    rotationOverrides: [
      { x: 1, y: 2, rotation: 3 },
      { x: 4, y: 2, rotation: 3 },
      { x: 4, y: 3, rotation: 2 },
    ],
  },
  {
    id: "builder_tool_route_05",
    solutionMoveCount: 4,
    rotationOverrides: [
      { x: 0, y: 2, rotation: 0 },
      { x: 1, y: 2, rotation: 0 },
      { x: 5, y: 1, rotation: 0 },
      { x: 5, y: 3, rotation: 0 },
    ],
  },
  {
    id: "builder_tool_route_06",
    solutionMoveCount: 6,
    rotationOverrides: [
      { x: 0, y: 2, rotation: 0 },
      { x: 1, y: 2, rotation: 0 },
      { x: 4, y: 2, rotation: 2 },
      { x: 4, y: 1, rotation: 0 },
      { x: 4, y: 3, rotation: 3 },
    ],
  },
  {
    id: "builder_tool_route_07",
    solutionMoveCount: 5,
    rotationOverrides: [
      { x: 2, y: 2, rotation: 0 },
      { x: 4, y: 2, rotation: 3 },
      { x: 4, y: 1, rotation: 3 },
      { x: 5, y: 3, rotation: 0 },
    ],
  },
  {
    id: "builder_tool_route_08",
    solutionMoveCount: 4,
    rotationOverrides: [
      { x: 4, y: 2, rotation: 3 },
      { x: 4, y: 1, rotation: 0 },
      { x: 5, y: 1, rotation: 0 },
      { x: 5, y: 3, rotation: 0 },
    ],
  },
  {
    id: "builder_tool_route_09",
    solutionMoveCount: 6,
    rotationOverrides: [
      { x: 0, y: 2, rotation: 3 },
      { x: 1, y: 2, rotation: 3 },
      { x: 4, y: 2, rotation: 3 },
      { x: 4, y: 3, rotation: 3 },
    ],
  },
  {
    id: "builder_tool_route_10",
    solutionMoveCount: 5,
    rotationOverrides: [
      { x: 0, y: 2, rotation: 0 },
      { x: 2, y: 2, rotation: 0 },
      { x: 4, y: 2, rotation: 3 },
      { x: 4, y: 1, rotation: 0 },
      { x: 5, y: 3, rotation: 0 },
    ],
  },
];

/** Color sequence: clue panel at the instance, orbs at the placed components. */
export function compileColorPuzzle(
  instance: BuilderPuzzleInstance,
  door: BuilderDoor,
  roomsById: Map<string, BuilderRoom>,
): CompiledBuilderPuzzle | null {
  const clueRoom = roomsById.get(instance.roomId);
  if (!clueRoom) return null;
  const orbs = (instance.components ?? [])
    .map((component) => ({ component, colorKey: orbColorKey(component.role) }))
    .filter((candidate): candidate is { component: BuilderPuzzleComponent; colorKey: LevelPuzzleColorKey } =>
      Boolean(candidate.colorKey && roomsById.has(candidate.component.roomId)),
    );
  if (orbs.length < 2) return null;
  const interaction = sourceInteractionForPuzzle(instance, clueRoom, {
    radius: 1.55,
    visualKey: "puzzle_console_color_sequence",
    materialKey: "terminal_cyan",
    label: "灯序墙",
  });
  const clueInteractionId = interaction.id;
  const actors: LevelPuzzleActorDefinition[] = orbs.map(({ component, colorKey }) => puzzleActorFromBuilderComponent(component, colorKey));
  const targets: LevelPuzzleTargetDefinition[] = orbs.map(({ component, colorKey }) => colorPuzzleTargetFromBuilderComponent(component, colorKey));
  const puzzle: LevelPuzzleDefinition = {
    id: instance.id || "builder_color_lock",
    type: "hit_sequence",
    label: "灯序记忆锁",
    roomId: orbs[0].component.roomId,
    clue: {
      type: "pattern_panel",
      roomId: clueRoom.id,
      interactionId: clueInteractionId,
      sequence: targets.map((target) => target.id),
      label: "墙面灯序只亮一次。",
      playback: {
        palette: ["red", "blue", "yellow", "green", "purple", "white", "cyan"],
        stepMs: 560,
        gapMs: 130,
        requireReplayBeforeInput: true,
        reshuffleAfterFailures: 3,
        replayRequiredMessage: "回灯墙再看。",
        reshuffleMessage: "灯墙已换序。",
      },
    },
    input: { method: "weapon_hit", resetOnMistake: true, showProgressPulse: true },
    targets,
    actors,
    fail: { message: "顺序错了，回灯墙。", resetDelay: 0.45 },
    success: {
      opensDoorId: door.id,
      rewardPulse: { label: "灯序确认", detail: "门禁顺序已记录", rarity: "epic" },
      rewardPulseDuration: 1.6,
      audio: { key: "system_exit_open", intensity: 0.9 },
    },
  };
  return {
    interaction,
    puzzle,
    lockedMessage: "灯序尚未确认。",
    unlockedMessage: "灯序确认。",
  };
}

/** 2D console puzzles: terminal at the instance position, curated solvable preset. */
export function compile2DPuzzle(
  instance: BuilderPuzzleInstance,
  door: BuilderDoor,
  roomsById: Map<string, BuilderRoom>,
): CompiledBuilderPuzzle | null {
  const kind = instance.kind;
  if (kind === "color_sequence") return null;
  const consoleRoom = roomsById.get(instance.roomId);
  if (!consoleRoom) return null;
  const entry = puzzleKindEntry(kind);
  const puzzleId = instance.id || `pz_${door.id}`;
  const visualKey = visualKeyFor2DPuzzleConsole(kind);
  const imported = compileImportedPuzzle(instance, door, consoleRoom, {
    radius: kind === "valve_matrix" ? valveMatrixInteractionRadius : 1.7,
    visualKey,
    materialKey: "terminal_cyan",
    label: entry.label,
  });
  if (imported) return imported;
  if (kind === "code_lock") return null;
  const label = instance.label?.trim() || entry.label;
  const interaction = sourceInteractionForPuzzle(instance, consoleRoom, {
    radius: kind === "valve_matrix" ? valveMatrixInteractionRadius : 1.7,
    visualKey,
    materialKey: "terminal_cyan",
    label,
  });
  const interactionId = interaction.id;
  const success: LevelPuzzleDefinition["success"] = {
    opensDoorId: door.id,
    rewardPulse: { label: `${label}完成`, detail: "谜题门已解锁", rarity: "epic" },
    rewardPulseDuration: 1.6,
    audio: { key: "system_exit_open", intensity: 0.9 },
  };

  let puzzle: LevelPuzzleDefinition;
  if (kind === "circuit_grid") {
    puzzle = {
      id: puzzleId,
      type: "tool_calibration",
      label,
      roomId: consoleRoom.id,
      interactionId,
      toolLabel: instance.toolLabel?.trim() || "馆藏校准棒",
      columns: 6,
      rows: 4,
      entry: { x: 0, y: 2, channel: "signal" },
      targets: [
        { x: 5, y: 1, channel: "stability" },
        { x: 5, y: 3, channel: "force" },
      ],
      requiredCells: [{ x: 3, y: 2, channel: "protocol" }],
      cells: builderToolCalibrationCells,
      perfectMoveLimit: 5,
      maxMoveLimit: 10,
      timeLimitSec: 90,
      variants: builderToolCalibrationVariants,
      success,
      perfectBonus: {
        pickupType: "repairKit",
        rewardPulse: { label: "完美校准", detail: "额外治疗包弹出", rarity: "epic" },
        rewardPulseDuration: 1.5,
      },
      fail: { message: "校准路径断开，馆藏台重置。" },
    };
  } else if (kind === "surveillance_match") {
    puzzle = {
      id: puzzleId,
      type: "surveillance_match",
      label: entry.label,
      roomId: consoleRoom.id,
      interactionId,
      guidance: "策展监察台回放四路展厅画面。把工具、声纹、身体与空展位如实归档。",
      channels: [
        {
          id: `${puzzleId}_exhibit_tool`,
          label: "展厅A",
          symbol: "⚒",
          feedDetail: "玻璃柜里是一排手工工具，旁边有修复夹具。",
          answerOptionId: `${puzzleId}_hall_tool`,
        },
        {
          id: `${puzzleId}_exhibit_voice`,
          label: "展厅B",
          symbol: "◖",
          feedDetail: "隔音棉墙，一座亭子，铜喇叭还在转。",
          answerOptionId: `${puzzleId}_hall_voice`,
        },
        {
          id: `${puzzleId}_exhibit_body`,
          label: "展厅C",
          symbol: "✣",
          feedDetail: "人形参照板，四个颜色灯球围着展柜。",
          answerOptionId: `${puzzleId}_hall_body`,
        },
        {
          id: `${puzzleId}_exhibit_vacant`,
          label: "展厅D",
          symbol: "▢",
          feedDetail: "底座灯亮着，玻璃罩里什么都没有。标签写着：筹备中。",
          answerOptionId: `${puzzleId}_hall_vacant`,
        },
      ],
      options: [
        { id: `${puzzleId}_hall_tool`, label: "工具展厅", symbol: "⚒" },
        { id: `${puzzleId}_hall_voice`, label: "声纹展厅", symbol: "◖" },
        { id: `${puzzleId}_hall_body`, label: "身体展厅", symbol: "✣" },
        { id: `${puzzleId}_hall_vacant`, label: "空展位", symbol: "▢" },
      ],
      maxMistakes: 3,
      success,
      fail: {
        message: "归档驳回。策展系统重排了画面。",
        cameraImpact: { shake: 0.2, fovKick: 0.8 },
        audio: { key: "enemy_hit", intensity: 0.46 },
      },
    };
  } else if (kind === "valve_matrix") {
    puzzle = {
      id: puzzleId,
      type: "valve_matrix",
      label: entry.label,
      roomId: consoleRoom.id,
      interactionId,
      guidance: "调左闸、中闸、右闸，让密封压、轨道差、熔断温三块状态表全部进绿区。",
      valves: [
        { id: `${puzzleId}_gate_left`, label: "左闸", min: 0, max: 8, initial: 2, gaugeShift: [6, 2, 0] },
        { id: `${puzzleId}_gate_mid`, label: "中闸", min: 0, max: 8, initial: 1, gaugeShift: [-2, 5, 2] },
        { id: `${puzzleId}_gate_right`, label: "右闸", min: 0, max: 8, initial: 0, gaugeShift: [0, -3, 7] },
      ],
      gauges: [
        { id: `${puzzleId}_gauge_seal_pressure`, label: "密封压", base: 8, target: 30, tolerance: 2, unit: "bar" },
        { id: `${puzzleId}_gauge_track_delta`, label: "轨道差", base: 6, target: 27, tolerance: 2, unit: "" },
        { id: `${puzzleId}_gauge_cutoff_temp`, label: "熔断温", base: 36, target: 65, tolerance: 3, unit: "°" },
      ],
      solution: [5, 4, 3],
      timeLimitSec: normalizeValveMatrixTimeLimit(instance.timeLimitSec),
      success,
      fail: {
        message: "闸门防误触保护启动，三道闸门复位。",
        cameraImpact: { shake: 0.28, fovKick: 1.2 },
        audio: { key: "enemy_hit", intensity: 0.56 },
      },
    };
  } else if (kind === "gallery_reading") {
    const preset = buildGalleryReadingPreset({ seed: puzzleId, questionCount: 3 });
    puzzle = {
      id: puzzleId,
      type: "gallery_reading",
      label: entry.label,
      roomId: consoleRoom.id,
      interactionId,
      guidance: "先读展画的展签与档案，再回答审读机的归档问询。",
      paintings: preset.paintings,
      questions: preset.questions,
      questionsPerRun: 3,
      maxMistakes: 2,
      audio: {
        open: { key: "gallery_reader_open", intensity: 0.66 },
        select: { key: "gallery_card_tick", intensity: 0.5 },
        correct: { key: "gallery_correct_stamp", intensity: 0.7 },
        wrong: { key: "gallery_wrong_deny", intensity: 0.42 },
        success: { key: "gallery_door_release", intensity: 0.85 },
        fail: { key: "gallery_wrong_deny", intensity: 0.6 },
      },
      success,
      fail: {
        message: "审读未通过，问询重排。",
        cameraImpact: { shake: 0.18, fovKick: 0.7 },
        audio: { key: "gallery_wrong_deny", intensity: 0.6 },
      },
    };
  } else {
    puzzle = {
      id: puzzleId,
      type: "archive_merge",
      label: entry.label,
      roomId: consoleRoom.id,
      interactionId,
      guidance: "相同身份片可以合并。压到目标阶后，门禁记录放行。",
      gridSize: 4,
      targetValue: normalizeArchiveMergeTarget(instance.archiveTargetValue),
      moveLimit: 90,
      tileSkin: "museum",
      spawnTable: [
        { value: 2, weight: 86 },
        { value: 4, weight: 14 },
      ],
      audio: {
        open: { key: "archive_panel_open", intensity: 0.66 },
        move: { key: "archive_tile_slide", intensity: 0.42 },
        merge: { key: "archive_tile_merge", intensity: 0.62 },
        highMerge: { key: "archive_identity_stamp", intensity: 0.78 },
        invalid: { key: "archive_denied", intensity: 0.38 },
        success: { key: "archive_unlock", intensity: 0.85 },
        fail: { key: "archive_rollback", intensity: 0.74 },
      },
      success,
      fail: {
        message: "压缩失败，档案回滚。",
        cameraImpact: { shake: 0.2, fovKick: 0.8 },
        audio: { key: "archive_rollback", intensity: 0.7 },
      },
    };
  }

  return {
    interaction,
    puzzle,
    lockedMessage: `先在「${consoleRoom.label}」的谜题台上完成${entry.label}。`,
    unlockedMessage: `${entry.label}完成，门已解锁。`,
  };
}
