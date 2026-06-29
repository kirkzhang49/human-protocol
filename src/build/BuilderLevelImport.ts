import { getBuiltInLevelConfig } from "../game/config/ConfigPackStore";
import level01OfficialBuilderDocumentJson from "../game/config/levels/level01-maintenance-bay/level.official.builder.json";
import level02OfficialBuilderDocumentJson from "../game/config/levels/level02-residential-simulation/level.official.builder.json";
import level03OfficialBuilderDocumentJson from "../game/config/levels/level03-human-museum/level.official.builder.json";
import level04OfficialBuilderDocumentJson from "../game/config/levels/level04-memory-clinic/level.official.builder.json";
import level05OfficialBuilderDocumentJson from "../game/config/levels/level05-reclamation-core/level.official.builder.json";
import type {
  EnemySpawnDefinition,
  LevelInteractionDefinition,
  LevelDefinition,
  LevelDoorDefinition,
  LevelKeyItemDefinition,
  LevelMapPresentationConfig,
  LevelMapPickupDefinition,
  LevelMapPropDefinition,
  LevelPuzzleActorDefinition,
  LevelPuzzleColorKey,
  LevelPuzzleDefinition,
  LevelPuzzleTargetDefinition,
  LevelRuntimeEventAction,
  LevelRoomDefinition,
  LevelSwitchDefinition,
  LevelSwitchStateDefinition,
  SpawnGroupDefinition,
  WaveDefinition,
  WaveReinforcementDefinition,
} from "../game/config/schema/levelConfig";
import { isEnvironmentModelKey } from "../assets/environmentModelAssets";
import { builderPropCatalog } from "./BuilderAssetCatalog";
import type {
  BuilderDoor,
  BuilderLighting,
  BuilderLockType,
  BuilderPickup,
  BuilderProject,
  BuilderProp,
  BuilderPuzzleComponent,
  BuilderPuzzleInstance,
  BuilderPuzzleKind,
  BuilderRobotArchetype,
  BuilderRobotGroup,
  BuilderRoom,
  BuilderRoomEnv,
  BuilderRoomStyle,
  BuilderRouteSwitch,
  BuilderRouteSwitchOutput,
  BuilderWallDoorSwitch,
  BuilderWallDoorSwitchState,
} from "./BuilderTypes";
import type { OfficialBuilderDocument } from "./official-builder/OfficialBuilderTypes";
import { builderRoomEnvFromOfficialRoom } from "./official-bridge/SurfaceKitBridge";
import { sourceAnchorPropForTarget, sourceHostPropForInteraction } from "./official-bridge/InteractionHostBridge";
import { puzzleActorFromHitSequenceTarget } from "./official-bridge/PuzzleActorBridge";
import { builderProjectHash } from "./runtime-pack/builderProjectHash";
import { builderDoorSurviveRobotIds, builderDoorWaveIds } from "./BuilderDoorRelations";
import { normalizeValveMatrixTimeLimit } from "./BuilderPuzzleCatalog";

const importableModelKeys = new Set(builderPropCatalog.map((entry) => entry.modelKey));
const canonicalOfficialBuilderDocumentsByLevelId: Partial<Record<string, OfficialBuilderDocument>> = {
  level_01_maintenance_bay: level01OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  level_02_residential_simulation: level02OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  level_03_human_museum: level03OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  level_04_memory_clinic: level04OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  level_05_reclamation_core: level05OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
};

export function readBuilderImportLevelId() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("fromLevel") ?? params.get("importLevel") ?? params.get("sourceLevel");
}

export function builderProjectFromBuiltInLevel(levelId: string): BuilderProject | null {
  const canonical = canonicalOfficialBuilderDocumentsByLevelId[levelId]?.project;
  if (canonical) {
    const project = cloneBuilderProject(canonical);
    return builderNativeOfficialLevelIds.has(levelId) ? normalizeOfficialBuilderProject(project) : project;
  }
  const level = getBuiltInLevelConfig(levelId);
  if (!level?.map) return null;
  const project = builderProjectFromLevel(level);
  return project ? normalizeOfficialBuilderProject(project) : null;
}

export function pristineOfficialSourceLevelIdForProject(project: BuilderProject): string | null {
  const sourceLevelId = project.sourceLevel?.levelId;
  if (!sourceLevelId) return null;
  const currentOfficialSeed = builderProjectFromBuiltInLevel(sourceLevelId);
  if (!currentOfficialSeed) return null;
  if (builderProjectHash(project) === builderProjectHash(currentOfficialSeed)) return sourceLevelId;
  const normalizedProject = normalizeOfficialBuilderProject(project);
  return builderProjectHash(normalizedProject) === builderProjectHash(currentOfficialSeed) ? sourceLevelId : null;
}

function cloneBuilderProject(project: BuilderProject): BuilderProject {
  return JSON.parse(JSON.stringify(project)) as BuilderProject;
}

export function builderProjectFromLevel(level: LevelDefinition): BuilderProject | null {
  const map = level.map;
  if (!map?.rooms.length) return null;
  const builderEnvironment = builderEnvironmentFromLevel(level);
  const rooms = map.rooms.map((room) => roomFromLevel(room, map.presentation, builderEnvironment.rooms[room.id]));
  const props = map.props?.flatMap(propFromLevel) ?? [];
  const doors = map.doors.flatMap((door) => doorFromLevel(level, door));
  const robots = robotsFromLevel(level, rooms);
  const grantedByPuzzleId = grantedKeyPuzzleMap(level);
  const pickups = [
    ...(map.keyItems?.flatMap((item) => pickupFromKeyItem(item, grantedByPuzzleId.get(item.id))) ?? []),
    ...(map.pickups?.map(pickupFromLevel) ?? []),
  ];
  const puzzles = puzzlesFromLevel(level, doors, rooms);
  const routeSwitches = routeSwitchesFromLevel(level, puzzles, rooms);
  const wallDoorSwitches = wallDoorSwitchesFromLevel(level);
  return {
    schemaVersion: "hp.builder.v1",
    projectId: `proj_import_${level.id}`,
    title: `${level.title} · 可编辑草稿`,
    rooms,
    doors,
    props,
    pickups,
    robots,
    ...(puzzles.length > 0 ? { puzzles } : {}),
    ...(routeSwitches.length > 0 ? { routeSwitches } : {}),
    ...(wallDoorSwitches.length > 0 ? { wallDoorSwitches } : {}),
    exitRoomId: exitRoomIdFor(level) ?? rooms[rooms.length - 1]?.id ?? rooms[0].id,
    lighting: builderEnvironment.lighting ?? {
      ambient: 0.42,
      keyColor: "#dbefff",
      keyIntensity: 0.88,
      fog: 0.18,
      bloom: 0.28,
      shadow: 0.62,
    },
    sourceLevel: {
      levelId: level.id,
      ...(map.id ? { mapId: map.id } : {}),
      ...(map.presentation ? { mapPresentation: map.presentation } : {}),
      ...(map.interactions ? { mapInteractions: map.interactions } : {}),
      spawnPoint: level.spawnPoint,
      ...(level.initialInventory ? { initialInventory: level.initialInventory } : {}),
      initialWaveStartDelay: level.initialWaveStartDelay,
      requiresStoryPickupsBeforeWaves: level.requiresStoryPickupsBeforeWaves,
      exit: level.exit,
      ...(level.puzzles ? { puzzles: level.puzzles } : {}),
      ...(level.articles ? { articles: level.articles } : {}),
      ...(level.switches ? { switches: level.switches } : {}),
      ...(level.bigScreens ? { bigScreens: level.bigScreens } : {}),
      ...(level.objectiveChain ? { objectiveChain: level.objectiveChain } : {}),
      ...(level.events ? { events: level.events } : {}),
      ...(level.environmentStates ? { environmentStates: level.environmentStates } : {}),
      dialogues: level.dialogues,
      cinematicBeats: level.cinematicBeats,
      bossPhases: level.bossPhases,
      enemyDeathBeats: level.enemyDeathBeats,
      pickups: level.pickups,
      economy: level.economy,
      revive: level.revive,
      combatLimits: level.combatLimits,
      presentation: level.presentation,
    },
  };
}

/**
 * Official imports can outlive the code/config that produced them because the
 * builder autosaves drafts in localStorage. Keep the editable geometry, but
 * refresh official source metadata and hosted-puzzle semantics from the current
 * built-in level so old drafts do not keep baking duplicate puzzle machines.
 */
export function normalizeOfficialBuilderProject(project: BuilderProject): BuilderProject {
  const sourceLevelId = project.sourceLevel?.levelId;
  if (!sourceLevelId) return project;
  const canonicalProject = canonicalOfficialBuilderDocumentsByLevelId[sourceLevelId]?.project;
  if (builderNativeOfficialLevelIds.has(sourceLevelId) && canonicalProject) {
    return normalizeBuilderNativeOfficialProjectFromCanonical(project, canonicalProject);
  }
  const sourceLevel = getBuiltInLevelConfig(sourceLevelId);
  if (!sourceLevel?.map) return project;

  const sourceRooms = new Map(sourceLevel.map.rooms.map((room) => [room.id, room]));
  const sourceInteractions = new Map((sourceLevel.map.interactions ?? []).map((interaction) => [interaction.id, interaction]));
  const sourcePuzzles = new Map((sourceLevel.puzzles ?? []).map((puzzle) => [puzzle.id, puzzle]));
  const sourceProps = sourceLevel.map.props ?? [];
  const builderEnvironment = builderEnvironmentFromLevel(sourceLevel);
  let changed = false;

  const rooms = project.rooms.map((room) => {
    const sourceRoom = sourceRooms.get(room.id);
    if (!sourceRoom) return room;
    const importedSource = sourceRoomFromLevel(sourceRoom);
    const officialEnv = mergeBuilderRoomEnv(
      builderRoomEnvFromOfficialRoom(sourceRoom, sourceLevel.map?.presentation),
      builderEnvironment.rooms[sourceRoom.id],
    );
    const nextRoom: BuilderRoom = {
      ...room,
      sourceRoom: { ...room.sourceRoom, ...importedSource },
      ...(officialEnv && !room.env ? { env: officialEnv } : {}),
    };
    if (nextRoom !== room) changed = true;
    return nextRoom;
  });

  const sourceDoorEntries = sourceLevel.map.doors.flatMap((door) => doorFromLevel(sourceLevel, door));
  const sourceDoors = new Map(sourceDoorEntries.map((door) => [door.id, door]));
  const doors = [
    ...project.doors.map((door) => {
      const sourceDoor = sourceDoors.get(door.id);
      if (!sourceDoor) return door;
      changed = true;
      if (hasBuilderAuthoredDoorProgression(project, door)) return mergeSourceDoorWithBuilderProgression(sourceDoor, door);
      return {
        ...sourceDoor,
        ...(door.doorFamily ? { doorFamily: door.doorFamily } : {}),
      };
    }),
    ...sourceDoorEntries.filter((door) => !project.doors.some((candidate) => candidate.id === door.id)),
  ];
  if (doors.length !== project.doors.length) changed = true;

  const sourceRobots = robotsFromLevel(sourceLevel, rooms);
  const sourceRobotById = new Map(sourceRobots.map((robot) => [robot.id, robot]));
  const projectRobotIds = new Set(project.robots.map((robot) => robot.id));
  const robots = [
    ...project.robots.flatMap((robot) => {
      const sourceRobot = sourceRobotById.get(robot.id);
      if (sourceRobot) {
        changed = true;
        return [mergeSourceRobotWithBuilderEdits(sourceRobot, robot)];
      }
      if (robot.wave?.id) {
        changed = true;
        return [];
      }
      return [robot];
    }),
    ...sourceRobots.filter((robot) => !projectRobotIds.has(robot.id)),
  ];
  if (robots.length !== project.robots.length) changed = true;

  const puzzles = project.puzzles?.map((puzzle) => {
    const sourcePuzzle = sourcePuzzles.get(puzzle.id);
    if (!sourcePuzzle) return puzzle;
    const sourceInteraction = puzzleInteraction(sourcePuzzle, sourceInteractions);
    if (!sourceInteraction) {
      if (puzzle.sourcePuzzle === sourcePuzzle) return puzzle;
      changed = true;
      return { ...puzzle, sourcePuzzle };
    }
    const nextSourceInteraction = sourceInteractionFromLevel(sourceInteraction, sourceProps);
    changed = true;
    return {
      ...puzzle,
      sourcePuzzle,
      sourceInteraction: nextSourceInteraction,
    };
  });
  const routeSwitchesFromSource = routeSwitchesFromLevel(sourceLevel, puzzles ?? project.puzzles ?? [], rooms);
  const routeSwitches = routeSwitchesFromSource.length > 0 ? routeSwitchesFromSource : project.routeSwitches;
  if (routeSwitches !== project.routeSwitches) changed = true;

  const refreshed = changed
    ? {
        ...project,
        rooms,
        doors,
        robots,
        ...(puzzles ? { puzzles } : {}),
        ...(routeSwitches ? { routeSwitches } : {}),
        ...(builderEnvironment.lighting ? { lighting: builderEnvironment.lighting } : {}),
        sourceLevel: {
          ...project.sourceLevel,
          ...(sourceLevel.map.interactions ? { mapInteractions: sourceLevel.map.interactions } : {}),
          ...(sourceLevel.puzzles ? { puzzles: sourceLevel.puzzles } : {}),
          ...(sourceLevel.articles ? { articles: sourceLevel.articles } : {}),
          ...(sourceLevel.switches ? { switches: sourceLevel.switches } : {}),
          ...(sourceLevel.bigScreens ? { bigScreens: sourceLevel.bigScreens } : {}),
          ...(sourceLevel.objectiveChain ? { objectiveChain: sourceLevel.objectiveChain } : {}),
          ...(sourceLevel.events ? { events: sourceLevel.events } : {}),
          ...(sourceLevel.environmentStates ? { environmentStates: sourceLevel.environmentStates } : {}),
          dialogues: sourceLevel.dialogues,
          cinematicBeats: sourceLevel.cinematicBeats,
          bossPhases: sourceLevel.bossPhases,
          enemyDeathBeats: sourceLevel.enemyDeathBeats,
          pickups: sourceLevel.pickups,
          economy: sourceLevel.economy,
          revive: sourceLevel.revive,
          combatLimits: sourceLevel.combatLimits,
          presentation: sourceLevel.presentation,
        },
      }
    : project;
  return normalizeBuilderNativeOfficialProgression(refreshed);
}

function hasBuilderAuthoredDoorProgression(project: BuilderProject, door: BuilderDoor) {
  if (door.lockType !== "survive_wave") return false;
  if (builderDoorSurviveRobotIds(door).length > 0) return true;
  const authoredWaveIds = new Set(project.robots.map((robot) => robot.waveChain?.waveId).filter((id): id is string => Boolean(id)));
  return builderDoorWaveIds(door).some((waveId) => authoredWaveIds.has(waveId));
}

function builderOutputOpenDoorIds(project: Pick<BuilderProject, "routeSwitches" | "puzzles">) {
  const ids = new Set<string>();
  for (const route of project.routeSwitches ?? []) {
    for (const output of route.outputs) {
      if (output.kind === "open_door" && output.doorId) ids.add(output.doorId);
    }
  }
  for (const puzzle of project.puzzles ?? []) {
    for (const output of puzzle.successOutputs ?? []) {
      if (output.kind === "open_door" && output.doorId) ids.add(output.doorId);
    }
  }
  return ids;
}

function mergeCanonicalRouteSwitches(
  projectRouteSwitches: BuilderProject["routeSwitches"],
  canonicalRouteSwitches: BuilderProject["routeSwitches"],
): BuilderProject["routeSwitches"] {
  if (!canonicalRouteSwitches?.length) return projectRouteSwitches;
  const canonicalIds = new Set(canonicalRouteSwitches.map((route) => route.id));
  return [
    ...canonicalRouteSwitches,
    ...(projectRouteSwitches ?? []).filter((route) => !canonicalIds.has(route.id)),
  ];
}

interface SourceDoorSanitizeOptions {
  outputOpenDoorIds?: ReadonlySet<string>;
}

const outputDoorSourceLockTypes = new Set(["objective_complete", "environment_state"]);
type BuilderDoorSourceLock = NonNullable<BuilderDoor["sourceDoor"]>["lock"];

function mergeSourceDoorWithBuilderProgression(sourceDoor: BuilderDoor, door: BuilderDoor, options: SourceDoorSanitizeOptions = {}): BuilderDoor {
  return sanitizeSourceDoorLockForBuilderDoor({
    ...sourceDoor,
    label: door.label ?? sourceDoor.label,
    lockType: door.lockType,
    surviveRobotId: door.surviveRobotId,
    surviveRobotIds: door.surviveRobotIds,
    waveId: door.waveId,
    waveIds: door.waveIds,
    keyRoomId: door.keyRoomId,
    puzzleKind: door.puzzleKind,
    puzzleRoomId: door.puzzleRoomId,
    puzzleIds: door.puzzleIds,
    wallDoorSwitchId: door.wallDoorSwitchId,
    wallDoorSwitchStateId: door.wallDoorSwitchStateId,
    ...(door.doorFamily ? { doorFamily: door.doorFamily } : {}),
  }, options);
}

function hasBuilderEditedDoorProgression(project: BuilderProject, door: BuilderDoor, canonicalDoor: BuilderDoor) {
  if (hasBuilderAuthoredDoorProgression(project, door)) return true;
  if (!sourceDoorProgressionMatches(door.sourceDoor, canonicalDoor.sourceDoor)) return false;
  return !doorProgressionEquals(door, canonicalDoor);
}

function sourceDoorProgressionMatches(left: BuilderDoor["sourceDoor"], right: BuilderDoor["sourceDoor"]) {
  return JSON.stringify(sourceDoorProgressionSnapshot(left)) === JSON.stringify(sourceDoorProgressionSnapshot(right));
}

function sourceDoorProgressionSnapshot(sourceDoor: BuilderDoor["sourceDoor"]) {
  if (!sourceDoor) return null;
  const lock = sourceDoor.lock;
  return {
    defaultState: sourceDoor.defaultState,
    lockType: sourceLockType(lock),
    keyItemId: lock?.keyItemId ?? null,
    puzzleId: lock?.puzzleId ?? null,
    puzzleIds: lock?.puzzleIds ?? [],
    switchId: lock?.switchId ?? null,
    stateId: lock?.stateId ?? null,
    waveId: lock?.waveId ?? null,
    waveIds: lock?.waveIds ?? [],
  };
}

function sourceLockType(lock: BuilderDoorSourceLock | undefined): BuilderLockType {
  const type = lock?.type ?? "none";
  if (type === "key_item") return "key_item";
  if (type === "survive_wave" || type === "boss_dead") return "survive_wave";
  if (type === "puzzle_complete") return "puzzle_complete";
  if (type === "switch_state") return "switch_state";
  return "none";
}

function doorProgressionEquals(left: BuilderDoor, right: BuilderDoor) {
  return JSON.stringify(doorProgressionSnapshot(left)) === JSON.stringify(doorProgressionSnapshot(right));
}

function doorProgressionSnapshot(door: BuilderDoor) {
  switch (door.lockType) {
    case "key_item":
      return { lockType: door.lockType, keyRoomId: door.keyRoomId ?? null };
    case "puzzle_complete":
      return { lockType: door.lockType, puzzleKind: door.puzzleKind ?? null, puzzleRoomId: door.puzzleRoomId ?? null, puzzleIds: door.puzzleIds ?? [] };
    case "survive_wave":
      return {
        lockType: door.lockType,
        surviveRobotIds: builderDoorSurviveRobotIds(door),
        waveIds: builderDoorWaveIds(door),
      };
    case "switch_state":
      return {
        lockType: door.lockType,
        wallDoorSwitchId: door.wallDoorSwitchId ?? null,
        wallDoorSwitchStateId: door.wallDoorSwitchStateId ?? null,
      };
    default:
      return { lockType: "none" as const };
  }
}

function sanitizeSourceDoorLockForBuilderDoor(door: BuilderDoor, options: SourceDoorSanitizeOptions = {}): BuilderDoor {
  const originalSourceDoor = door.sourceDoor;
  const sourceLock = originalSourceDoor?.lock;
  if (!sourceLock) return door;
  const sourceLockMatches =
    (door.lockType === "none" && sourceLock.type === "none") ||
    (door.lockType === "none" && options.outputOpenDoorIds?.has(door.id) && outputDoorSourceLockTypes.has(sourceLock.type)) ||
    (door.lockType === "key_item" && sourceLock.type === "key_item") ||
    (door.lockType === "puzzle_complete" && sourceLock.type === "puzzle_complete") ||
    (door.lockType === "survive_wave" && (sourceLock.type === "survive_wave" || sourceLock.type === "boss_dead")) ||
    (door.lockType === "switch_state" && sourceLock.type === "switch_state");
  if (sourceLockMatches) return door;
  const { lock: _oldLock, ...sourceDoor } = originalSourceDoor;
  return { ...door, sourceDoor };
}

const builderNativeOfficialLevelIds = new Set([
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
  "level_04_memory_clinic",
  "level_05_reclamation_core",
]);

function normalizeBuilderNativeOfficialProgression(project: BuilderProject): BuilderProject {
  const levelId = project.sourceLevel?.levelId;
  if (!levelId || !builderNativeOfficialLevelIds.has(levelId)) return project;
  if (levelId === "level_01_maintenance_bay") return normalizeLevel01BuilderNativeProgression(project);
  if (levelId === "level_02_residential_simulation") return normalizeLevel02BuilderNativeProgression(project);
  if (levelId === "level_03_human_museum") return normalizeLevel03BuilderNativeProgression(project);
  return {
    ...project,
    sourceLevel: builderNativeSourceLevel(project.sourceLevel),
  };
}

function normalizeBuilderNativeOfficialProjectFromCanonical(project: BuilderProject, canonicalSource: BuilderProject): BuilderProject {
  const canonical = cloneBuilderProject(canonicalSource);
  const routeSwitches = mergeCanonicalRouteSwitches(project.routeSwitches, canonical.routeSwitches);
  const outputOpenDoorIds = builderOutputOpenDoorIds({
    routeSwitches,
    puzzles: project.puzzles ?? canonical.puzzles,
  });
  const canonicalRooms = new Map(canonical.rooms.map((room) => [room.id, room]));
  const rooms = [
    ...project.rooms.map((room) => {
      const sourceRoom = canonicalRooms.get(room.id);
      if (!sourceRoom) return room;
      return {
        ...room,
        sourceRoom: { ...room.sourceRoom, ...sourceRoom.sourceRoom },
        ...(room.env ? {} : { env: sourceRoom.env }),
      };
    }),
    ...canonical.rooms.filter((room) => !project.rooms.some((candidate) => candidate.id === room.id)),
  ];

  const canonicalDoors = new Map(canonical.doors.map((door) => [door.id, door]));
  const doors = [
    ...project.doors.map((door) => {
      const sourceDoor = canonicalDoors.get(door.id);
      if (!sourceDoor) return door;
      if (hasBuilderEditedDoorProgression(project, door, sourceDoor)) return mergeSourceDoorWithBuilderProgression(sourceDoor, door, { outputOpenDoorIds });
      return sanitizeSourceDoorLockForBuilderDoor({
        ...sourceDoor,
        ...(door.doorFamily ? { doorFamily: door.doorFamily } : {}),
      }, { outputOpenDoorIds });
    }),
    ...canonical.doors
      .filter((door) => !project.doors.some((candidate) => candidate.id === door.id))
      .map((door) => sanitizeSourceDoorLockForBuilderDoor(door, { outputOpenDoorIds })),
  ];

  const canonicalRobots = new Map(canonical.robots.map((robot) => [robot.id, robot]));
  const projectRobotIds = new Set(project.robots.map((robot) => robot.id));
  const robots = [
    ...project.robots.flatMap((robot) => {
      const sourceRobot = canonicalRobots.get(robot.id);
      if (sourceRobot) return [mergeSourceRobotWithBuilderEdits(sourceRobot, robot)];
      if (robot.wave?.id) return [];
      return [robot];
    }),
    ...canonical.robots.filter((robot) => !projectRobotIds.has(robot.id)),
  ];

  const canonicalPickups = canonical.pickups ?? [];
  const projectPickups = project.pickups ?? [];
  const projectPickupIds = new Set(projectPickups.map((pickup) => pickup.id));
  const pickups = [
    ...projectPickups,
    ...canonicalPickups.filter((pickup) => !projectPickupIds.has(pickup.id)),
  ];
  const canonicalProps = canonical.props ?? [];
  const projectPropIds = new Set(project.props.map((prop) => prop.id));
  const props = [
    ...project.props,
    ...canonicalProps.filter((prop) => !projectPropIds.has(prop.id)),
  ];

  return normalizeBuilderNativeOfficialProgression({
    ...project,
    rooms,
    doors,
    props,
    pickups,
    robots,
    ...(project.puzzles || !canonical.puzzles ? {} : { puzzles: canonical.puzzles }),
    ...(routeSwitches ? { routeSwitches } : {}),
    ...(project.lighting ? {} : { lighting: canonical.lighting }),
    sourceLevel: canonical.sourceLevel,
  });
}

function builderNativeSourceLevel(
  sourceLevel: BuilderProject["sourceLevel"],
  options: { preserveEnvironmentStates?: boolean } = {},
): BuilderProject["sourceLevel"] {
  if (!sourceLevel) return sourceLevel;
  const {
    mapPresentation: _mapPresentation,
    mapInteractions: _mapInteractions,
    spawnPoint: _spawnPoint,
    initialInventory: _initialInventory,
    exit: _exit,
    puzzles: _puzzles,
    objectiveChain: _objectiveChain,
    events: _events,
    environmentStates: _environmentStates,
    pickups: _pickups,
    requiresStoryPickupsBeforeWaves: _requiresStoryPickupsBeforeWaves,
    initialWaveStartDelay: _initialWaveStartDelay,
    combatLimits: _combatLimits,
    presentation: _presentation,
    ...rest
  } = sourceLevel;
  return options.preserveEnvironmentStates && _environmentStates ? { ...rest, environmentStates: _environmentStates } : rest;
}

function puzzleKindForSourcePuzzle(sourcePuzzle: LevelPuzzleDefinition | undefined): BuilderPuzzleKind | null {
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

function sanitizeBuilderNativePuzzle(instance: BuilderPuzzleInstance): BuilderPuzzleInstance {
  const sourceKind = puzzleKindForSourcePuzzle(instance.sourcePuzzle);
  if (!sourceKind || sourceKind === instance.kind) return instance;
  const { sourcePuzzle: _sourcePuzzle, sourceInteraction: _sourceInteraction, ...rest } = instance;
  return rest;
}

function robotPositionKey(robot: BuilderRobotGroup) {
  return robot.position ? `${roundMeter(robot.position[0])},${roundMeter(robot.position[1])}` : "auto";
}

function fallbackRoomWaveId(roomId: string) {
  return `wave_${roomId}`;
}

function authoredRobotWaveId(robot: BuilderRobotGroup) {
  if (robot.waveChain?.waveId) return robot.waveChain.waveId;
  if (!robot.wave?.id) return fallbackRoomWaveId(robot.roomId);
  return null;
}

function robotReplacementKey(robot: BuilderRobotGroup, waveId: string) {
  return `${robot.roomId}:${waveId}:${robot.archetype}:${robot.count}:${robotPositionKey(robot)}`;
}

function isGeneratedWaveEchoRobot(robot: BuilderRobotGroup) {
  return Boolean(robot.wave?.id && robot.id.startsWith(`robot_${robot.wave.id}_`));
}

function dedupeBuilderNativeRobotEchoes(robots: readonly BuilderRobotGroup[]): BuilderRobotGroup[] {
  const authoredKeys = new Set<string>();
  for (const robot of robots) {
    if (isGeneratedWaveEchoRobot(robot)) continue;
    const waveId = authoredRobotWaveId(robot);
    if (!waveId) continue;
    authoredKeys.add(robotReplacementKey(robot, waveId));
  }
  return robots.filter((robot) => {
    if (!isGeneratedWaveEchoRobot(robot) || !robot.wave?.id) return true;
    return !authoredKeys.has(robotReplacementKey(robot, robot.wave.id));
  });
}

function mergeSourceRobotWithBuilderEdits(sourceRobot: BuilderRobotGroup, robot: BuilderRobotGroup): BuilderRobotGroup {
  return {
    ...sourceRobot,
    label: robot.label ?? sourceRobot.label,
    archetype: robot.archetype,
    count: robot.count,
    ...(robot.tier ? { tier: robot.tier } : {}),
    ...(robot.presetId ? { presetId: robot.presetId } : {}),
    ...(robot.combat ? { combat: robot.combat } : {}),
    ...(robot.waveChain ? { waveChain: robot.waveChain } : {}),
    ...(robot.position ? { position: robot.position } : {}),
  };
}

function normalizeLevel01BuilderNativeProgression(project: BuilderProject): BuilderProject {
  const waveOrder = new Map([
    ["first_contact", 1],
    ["wave_01", 2],
    ["wave_02", 3],
    ["elite_wave", 4],
    ["exit_chase", 5],
  ]);
  const waveLabels = new Map([
    ["first_contact", "第一接触"],
    ["wave_01", "维修封锁 1"],
    ["wave_02", "维修封锁 2"],
    ["elite_wave", "维修头领"],
    ["exit_chase", "电梯压力"],
  ]);
  const robots = project.robots.map((robot) => {
    const waveId = robot.wave?.id;
    const order = waveId ? waveOrder.get(waveId) : undefined;
    if (!waveId || !order) return robot;
    const authoredWaveChain = robot.waveChain;
    return {
      ...robot,
      wave: robot.wave
        ? {
            ...robot.wave,
            triggerType: undefined,
            triggerId: undefined,
            triggerOptionId: undefined,
            triggerDelay: undefined,
          }
        : robot.wave,
      waveChain: {
        ...authoredWaveChain,
        waveId,
        order: authoredWaveChain?.order ?? order,
        label: authoredWaveChain?.label ?? robot.wave?.label ?? waveLabels.get(waveId),
      },
    };
  });
  const projectWithRobots = { ...project, robots };
  const doors = project.doors.map((door) => {
    if (door.id !== "service_elevator_door") return door;
    if (hasBuilderAuthoredDoorProgression(projectWithRobots, door)) {
      return {
        ...door,
        surviveRobotId: undefined,
        surviveRobotIds: undefined,
        puzzleKind: undefined,
        puzzleRoomId: undefined,
      };
    }
    return {
      ...door,
      lockType: "survive_wave" as const,
      waveId: undefined,
      waveIds: ["first_contact", "wave_01", "wave_02", "elite_wave"],
      surviveRobotId: undefined,
      surviveRobotIds: undefined,
      puzzleKind: undefined,
      puzzleRoomId: undefined,
    };
  });
  return {
    ...project,
    doors,
    robots,
    puzzles: project.puzzles?.filter((puzzle) => puzzle.id !== "level_01_power_circuit"),
    sourceLevel: builderNativeSourceLevel(project.sourceLevel),
  };
}

function normalizeLevel02BuilderNativeProgression(project: BuilderProject): BuilderProject {
  const robots = dedupeBuilderNativeRobotEchoes(project.robots);
  const livingGuardIds = robots
    .filter((robot) => robot.wave?.id === "level_02_living_swarm")
    .map((robot) => robot.id);
  const authoredWaveIds = new Set(robots.map((robot) => robot.waveChain?.waveId).filter((id): id is string => Boolean(id)));
  const doors = project.doors.map((door) => {
    if (door.id !== "level_02_care_room_door") return door;
    const selectedWaveIds = builderDoorWaveIds(door);
    const hasAuthoredWaveSelection = selectedWaveIds.some((waveId) => authoredWaveIds.has(waveId));
    if (hasAuthoredWaveSelection) {
      const selectedWaveIdSet = new Set(selectedWaveIds);
      const selectedRobotIds = builderDoorSurviveRobotIds(door).filter((robotId) => {
        const robot = robots.find((candidate) => candidate.id === robotId);
        return Boolean(robot?.waveChain?.waveId && selectedWaveIdSet.has(robot.waveChain.waveId));
      });
      return {
        ...door,
        surviveRobotIds: selectedRobotIds.length > 0 ? selectedRobotIds : undefined,
        surviveRobotId: undefined,
      };
    }
    if (livingGuardIds.length > 0 && !hasBuilderAuthoredDoorProgression(project, door)) {
      return {
        ...door,
        surviveRobotIds: livingGuardIds,
        surviveRobotId: undefined,
      };
    }
    return door;
  });
  return {
    ...project,
    doors,
    robots,
    ...(project.puzzles ? { puzzles: project.puzzles.map(sanitizeBuilderNativePuzzle) } : {}),
    sourceLevel: builderNativeSourceLevel(project.sourceLevel),
  };
}

function normalizeLevel03BuilderNativeProgression(project: BuilderProject): BuilderProject {
  return {
    ...project,
    sourceLevel: builderNativeSourceLevel(project.sourceLevel, { preserveEnvironmentStates: true }),
  };
}

const builderRobotArchetypes: readonly BuilderRobotArchetype[] = ["repair_drone", "clamp_bot", "shield_tech", "custodian_elite"];

function robotsFromLevel(level: LevelDefinition, rooms: readonly BuilderRoom[]): BuilderRobotGroup[] {
  const spawnGroups = new Map(level.spawnGroups.map((group) => [group.id, group]));
  const wavePresentations = new Map(level.presentation.waves.map((entry) => [entry.id, entry]));
  const robots: BuilderRobotGroup[] = [];

  for (const wave of level.waves) {
    const presentation = wavePresentations.get(wave.id);
    wave.enemies.forEach((enemy, index) => {
      const robot = robotFromWaveSpawn(level, rooms, spawnGroups, wave, enemy, "enemy", index, presentation);
      if (robot) robots.push(robot);
    });
    wave.reinforcements?.forEach((enemy, index) => {
      const robot = robotFromWaveSpawn(level, rooms, spawnGroups, wave, enemy, "reinforcement", index, presentation);
      if (robot) robots.push(robot);
    });
  }

  return robots;
}

function robotFromWaveSpawn(
  level: LevelDefinition,
  rooms: readonly BuilderRoom[],
  spawnGroups: ReadonlyMap<string, SpawnGroupDefinition>,
  wave: WaveDefinition,
  enemy: EnemySpawnDefinition | WaveReinforcementDefinition,
  role: NonNullable<BuilderRobotGroup["wave"]>["role"],
  index: number,
  presentation: NonNullable<BuilderRobotGroup["wave"]>["presentation"] | undefined,
): BuilderRobotGroup | null {
  if (!isBuilderRobotArchetype(enemy.archetype)) return null;
  const spawnGroup = spawnGroups.get(enemy.from);
  const roomId = roomIdForWaveSpawn(rooms, wave, spawnGroup) ?? rooms[0]?.id;
  const room = rooms.find((candidate) => candidate.id === roomId);
  if (!roomId || !room) return null;
  const position = positionForSpawnGroup(spawnGroup, room, index);
  const combat = combatTuningFromEnemy(enemy);
  const reinforcement = role === "reinforcement"
    ? enemy as WaveReinforcementDefinition
    : null;
  return {
    id: safeImportId(`robot_${wave.id}_${role}_${index + 1}`),
    roomId,
    archetype: enemy.archetype,
    count: enemy.count,
    ...(enemy.tier ? { tier: enemy.tier } : {}),
    ...(combat ? { combat } : {}),
    position,
    wave: {
      id: wave.id,
      label: presentation?.label,
      role,
      triggerType: wave.trigger?.type,
      triggerId: wave.trigger?.id,
      triggerOptionId: wave.trigger?.optionId,
      triggerDelay: wave.trigger?.delay,
      startDelay: wave.startDelay,
      interruptsActiveWave: wave.interruptsActiveWave,
      nonBlocking: wave.nonBlocking,
      reward: wave.reward,
      completionDialogueTrigger: wave.completionDialogueTrigger,
      spawnGroupId: enemy.from,
      spawnGroupLabel: spawnGroup?.label ?? level.presentation.spawnSourceLabels[enemy.from],
      spawnGroupLayout: spawnGroup?.layout,
      spawnGroupCenter: spawnGroup?.center ? [roundMeter(spawnGroup.center[0]), roundMeter(spawnGroup.center[2])] : undefined,
      spawnGroupRadius: spawnGroup?.radius,
      spawnGroupSpread: spawnGroup?.spread,
      spawnGroupPositions: spawnGroup?.positions?.map((point) => [roundMeter(point[0]), roundMeter(point[2])] as const),
      presentation,
      ...(reinforcement
        ? {
            reinforcement: {
              every: reinforcement.every,
              startsAfter: reinforcement.startsAfter,
              maxGroups: reinforcement.maxGroups,
              maxAlive: reinforcement.maxAlive,
              requiresEliteAlive: reinforcement.requiresEliteAlive,
              endless: reinforcement.endless,
            },
          }
        : {}),
    },
  };
}

function isBuilderRobotArchetype(value: string): value is BuilderRobotArchetype {
  return builderRobotArchetypes.includes(value as BuilderRobotArchetype);
}

function roomIdForWaveSpawn(rooms: readonly BuilderRoom[], wave: WaveDefinition, spawnGroup: SpawnGroupDefinition | undefined) {
  if (wave.trigger?.type === "room_entered" && wave.trigger.id && rooms.some((room) => room.id === wave.trigger?.id)) {
    return wave.trigger.id;
  }
  const point = spawnGroup?.center ?? spawnGroup?.positions?.[0];
  if (point) {
    const room = rooms.find((candidate) => containsWorldPoint(candidate, point[0], point[2]));
    if (room) return room.id;
  }
  return undefined;
}

function positionForSpawnGroup(spawnGroup: SpawnGroupDefinition | undefined, room: BuilderRoom, index: number): readonly [number, number] {
  const point = spawnGroup?.positions?.length
    ? spawnGroup.positions[index % spawnGroup.positions.length]
    : spawnGroup?.center;
  if (point) return [roundMeter(point[0]), roundMeter(point[2])];
  return [roundMeter(room.center[0]), roundMeter(room.center[1])];
}

function containsWorldPoint(room: BuilderRoom, x: number, z: number) {
  return (
    Math.abs(x - room.center[0]) <= room.size[0] / 2 + 0.01 &&
    Math.abs(z - room.center[1]) <= room.size[1] / 2 + 0.01
  );
}

function combatTuningFromEnemy(enemy: EnemySpawnDefinition | WaveReinforcementDefinition): BuilderRobotGroup["combat"] | undefined {
  const combat: BuilderRobotGroup["combat"] = {};
  if (enemy.tierLabel !== undefined) combat.tierLabel = enemy.tierLabel;
  if (enemy.healthMultiplier !== undefined) combat.healthMultiplier = enemy.healthMultiplier;
  if (enemy.damageMultiplier !== undefined) combat.damageMultiplier = enemy.damageMultiplier;
  if (enemy.moveSpeedMultiplier !== undefined) combat.moveSpeedMultiplier = enemy.moveSpeedMultiplier;
  if (enemy.attackCooldownMultiplier !== undefined) combat.attackCooldownMultiplier = enemy.attackCooldownMultiplier;
  if (enemy.attackRangeMultiplier !== undefined) combat.attackRangeMultiplier = enemy.attackRangeMultiplier;
  if (enemy.threatWeightMultiplier !== undefined) combat.threatWeightMultiplier = enemy.threatWeightMultiplier;
  if (enemy.radiusMultiplier !== undefined) combat.radiusMultiplier = enemy.radiusMultiplier;
  if (enemy.visual !== undefined) combat.visual = enemy.visual;
  return Object.keys(combat).length > 0 ? combat : undefined;
}

function roomFromLevel(
  room: LevelRoomDefinition,
  presentation?: LevelMapPresentationConfig,
  authoredEnv?: BuilderRoomEnv,
): BuilderRoom {
  const [x, , z] = room.bounds.center;
  const [width, , depth] = room.bounds.size;
  const env = mergeBuilderRoomEnv(builderRoomEnvFromOfficialRoom(room, presentation), authoredEnv);
  return {
    id: room.id,
    label: room.label,
    style: styleFromRoom(room),
    center: [roundMeter(x), roundMeter(z)],
    size: [roundMeter(width), roundMeter(depth)],
    ...(room.bounds.shape?.points?.length ? { shape: { kind: "polygon" as const, points: room.bounds.shape.points } } : {}),
    ...(env ? { env } : {}),
    sourceRoom: sourceRoomFromLevel(room),
  };
}

function builderEnvironmentFromLevel(level: LevelDefinition): {
  lighting?: BuilderLighting;
  rooms: Record<string, BuilderRoomEnv>;
} {
  const raw = level.authoringMetadata?.builderEnvironment;
  if (!isRecord(raw)) return { rooms: {} };
  const rooms: Record<string, BuilderRoomEnv> = {};
  if (isRecord(raw.rooms)) {
    for (const [roomId, env] of Object.entries(raw.rooms)) {
      if (isRecord(env)) rooms[roomId] = env as BuilderRoomEnv;
    }
  }
  return {
    ...(isBuilderLighting(raw.lighting) ? { lighting: raw.lighting } : {}),
    rooms,
  };
}

function mergeBuilderRoomEnv(base: BuilderRoomEnv | undefined, override: BuilderRoomEnv | undefined): BuilderRoomEnv | undefined {
  if (!base) return override;
  if (!override) return base;
  return {
    ...base,
    ...override,
    ...(base.surfaceOverrides || override.surfaceOverrides
      ? {
          surfaceOverrides: {
            ...base.surfaceOverrides,
            ...override.surfaceOverrides,
          },
        }
      : {}),
  };
}

function isBuilderLighting(value: unknown): value is BuilderLighting {
  if (!isRecord(value)) return false;
  return (
    typeof value.ambient === "number" &&
    typeof value.keyColor === "string" &&
    typeof value.keyIntensity === "number" &&
    typeof value.fog === "number" &&
    typeof value.bloom === "number" &&
    typeof value.shadow === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sourceRoomFromLevel(room: LevelRoomDefinition): NonNullable<BuilderRoom["sourceRoom"]> {
  return {
    mood: room.mood,
    ...(room.skinKey ? { skinKey: room.skinKey } : {}),
    ...(room.floorMaterialKey ? { floorMaterialKey: room.floorMaterialKey } : {}),
    ...(room.wallMaterialKey ? { wallMaterialKey: room.wallMaterialKey } : {}),
    ...(room.geometry ? { geometry: room.geometry } : {}),
    ...(room.aesthetic ? { aesthetic: room.aesthetic } : {}),
    ...(room.ambientPressure !== undefined ? { ambientPressure: room.ambientPressure } : {}),
    ...(room.entryDialogueTrigger ? { entryDialogueTrigger: room.entryDialogueTrigger } : {}),
    ...(room.exitDialogueTrigger ? { exitDialogueTrigger: room.exitDialogueTrigger } : {}),
  };
}

function propFromLevel(prop: LevelMapPropDefinition): BuilderProp[] {
  if (!importableModelKeys.has(prop.modelKey) && !isEnvironmentModelKey(prop.modelKey)) return [];
  const [x, , z] = prop.position;
  const scale = typeof prop.scale === "number" ? prop.scale : Array.isArray(prop.scale) ? averageScale(prop.scale) : 1;
  return [{
    id: prop.id,
    modelKey: prop.modelKey,
    roomId: prop.roomId,
    position: [roundMeter(x), roundMeter(z)],
    rotationY: prop.rotation?.[1] ?? 0,
    scale: clamp(roundScale(scale), 0.35, 2),
    elevation: roundMeter(prop.position[1]),
    sourceProp: {
      y: prop.position[1],
      ...(prop.scale !== undefined ? { scale: prop.scale } : {}),
      ...(prop.collider ? { collider: prop.collider } : {}),
      ...(prop.label ? { label: prop.label } : {}),
      ...(prop.tags ? { tags: prop.tags } : {}),
      ...(prop.initiallyVisible !== undefined ? { initiallyVisible: prop.initiallyVisible } : {}),
    },
  }];
}

function pickupFromLevel(pickup: LevelMapPickupDefinition): BuilderPickup {
  const [x, , z] = pickup.position;
  return {
    id: pickup.id,
    kind: pickup.type,
    roomId: pickup.roomId,
    position: [roundMeter(x), roundMeter(z)],
  };
}

function pickupFromKeyItem(item: LevelKeyItemDefinition, grantedByPuzzleId?: string): BuilderPickup[] {
  const doorId = item.requiredForDoorIds[0];
  if (!doorId) return [];
  const [x, , z] = item.position;
  return [{
    id: item.id,
    kind: "key_item",
    roomId: item.roomId,
    position: [roundMeter(x), roundMeter(z)],
    linkedDoorId: doorId,
    ...(grantedByPuzzleId ? { grantedByPuzzleId } : {}),
    sourceKeyItem: {
      label: item.label,
      y: item.position[1],
      collectRadius: item.collectRadius,
      ...(item.autoCollect !== undefined ? { autoCollect: item.autoCollect } : {}),
      visualKey: item.visualKey,
      ...(item.materialKey ? { materialKey: item.materialKey } : {}),
      ...(item.requiresObjectiveId ? { requiresObjectiveId: item.requiresObjectiveId } : {}),
      ...(item.dropFromArchetypeId ? { dropFromArchetypeId: item.dropFromArchetypeId } : {}),
      ...(item.dialogueTrigger ? { dialogueTrigger: item.dialogueTrigger } : {}),
      ...(item.rewardPulse ? { rewardPulse: item.rewardPulse } : {}),
      ...(item.rewardPulseDuration !== undefined ? { rewardPulseDuration: item.rewardPulseDuration } : {}),
      ...(item.audio ? { audio: item.audio } : {}),
    },
  }];
}

function doorFromLevel(level: LevelDefinition, door: LevelDoorDefinition): BuilderDoor[] {
  const lockType = lockTypeFromDoor(door);
  return [{
    id: door.id,
    label: door.label,
    fromRoomId: door.fromRoomId,
    toRoomId: door.toRoomId,
    lockType,
    ...(lockType === "survive_wave" && door.lock.type === "survive_wave" ? { waveId: door.lock.waveId, ...(door.lock.waveIds ? { waveIds: door.lock.waveIds } : {}) } : {}),
    ...(lockType === "key_item" ? { keyRoomId: keyRoomIdForDoor(level, door) } : {}),
    ...(lockType === "puzzle_complete" ? puzzleDoorMetadataFromLevel(level, door) : {}),
    ...(lockType === "puzzle_complete" && door.lock.type === "puzzle_complete" && door.lock.puzzleIds ? { puzzleIds: door.lock.puzzleIds } : {}),
    ...(lockType === "switch_state" && door.lock.type === "switch_state" && door.lock.switchId && door.lock.stateId
      ? {
          wallDoorSwitchId: builderWallDoorSwitchIdFromSwitchId(door.lock.switchId),
          wallDoorSwitchStateId: builderWallDoorSwitchStateIdFromRuntime(door.lock.stateId),
        }
      : {}),
    sourceDoor: {
      label: door.label,
      position: door.position,
      size: door.size,
      yaw: door.yaw,
      defaultState: door.defaultState,
      lock: door.lock,
      ...(door.skinKey ? { skinKey: door.skinKey } : {}),
      visualKey: door.visualKey,
      ...(door.materialKey ? { materialKey: door.materialKey } : {}),
      ...(door.panelPosition ? { panelPosition: door.panelPosition } : {}),
      ...(door.openSpeed !== undefined ? { openSpeed: door.openSpeed } : {}),
      ...(door.autoOpenOnApproach !== undefined ? { autoOpenOnApproach: door.autoOpenOnApproach } : {}),
      ...(door.openVisualPolicy ? { openVisualPolicy: door.openVisualPolicy } : {}),
      ...(door.closedDialogueTrigger ? { closedDialogueTrigger: door.closedDialogueTrigger } : {}),
      ...(door.openedDialogueTrigger ? { openedDialogueTrigger: door.openedDialogueTrigger } : {}),
      ...(door.cameraImpact ? { cameraImpact: door.cameraImpact } : {}),
    },
  }];
}

function puzzlesFromLevel(level: LevelDefinition, doors: readonly BuilderDoor[], rooms: readonly BuilderRoom[]): BuilderPuzzleInstance[] {
  const interactions = new Map((level.map?.interactions ?? []).map((interaction) => [interaction.id, interaction]));
  const props = level.map?.props ?? [];
  const byDoorId = new Map(doors.map((door) => [door.id, door]));
  const puzzles: BuilderPuzzleInstance[] = [];
  for (const puzzle of level.puzzles ?? []) {
    const linkedDoorId = linkedDoorIdForPuzzle(level, puzzle);
    if (!linkedDoorId || !byDoorId.has(linkedDoorId)) continue;
    const kind = builderPuzzleKindFromLevelPuzzle(puzzle);
    if (!kind) continue;
    const interaction = puzzleInteraction(puzzle, interactions);
    const position = interaction?.position ?? [0, 0, 0];
    const roomId = interaction?.roomId ?? puzzle.roomId;
    const successOutputs = puzzleSuccessOutputsFromLevel(level, puzzle, rooms);
    const instance: BuilderPuzzleInstance = {
      id: puzzle.id,
      kind,
      resultMode: puzzle.success.actions?.some((action) => action.type === "grant_key_item") ? "grant_key" : "open_door",
      linkedDoorId,
      ...(interaction?.id ? { interactionId: interaction.id } : {}),
      ...(interaction ? { sourceInteraction: sourceInteractionFromLevel(interaction, props) } : {}),
      sourcePuzzle: puzzle,
      roomId,
      position: [roundMeter(position[0]), roundMeter(position[2])],
      rotationY: 0,
      ...(successOutputs.length > 0 ? { successOutputs } : {}),
      ...(puzzle.type === "hit_sequence" ? { components: componentsFromHitSequencePuzzle(puzzle, props) } : {}),
      ...(puzzle.type === "archive_merge" ? { archiveTargetValue: puzzle.targetValue } : {}),
      ...(puzzle.type === "valve_matrix" ? { timeLimitSec: normalizeValveMatrixTimeLimit(puzzle.timeLimitSec) } : {}),
    };
    puzzles.push(instance);
  }
  return puzzles;
}

function puzzleSuccessOutputsFromLevel(
  level: LevelDefinition,
  puzzle: LevelPuzzleDefinition,
  rooms: readonly BuilderRoom[],
): BuilderRouteSwitchOutput[] {
  return (puzzle.success.actions ?? []).flatMap((action, index): BuilderRouteSwitchOutput[] => {
    if (action.type !== "start_wave") return [];
    const robotRoomId = roomIdForWave(level, action.waveId, rooms);
    if (!robotRoomId) return [];
    return [{
      id: `puzzle_out_${safeImportId(action.waveId)}_${index + 1}`,
      kind: "start_robots",
      robotRoomId,
      label: "唤醒机器人",
    }];
  });
}

function routeSwitchesFromLevel(
  level: LevelDefinition,
  puzzles: readonly BuilderPuzzleInstance[],
  rooms: readonly BuilderRoom[],
): BuilderRouteSwitch[] {
  const interactions = new Map((level.map?.interactions ?? []).map((interaction) => [interaction.id, interaction]));
  const keys = new Map((level.map?.keyItems ?? []).map((item) => [item.id, item]));
  const puzzleByInteractionId = new Map<string, string>();
  for (const puzzle of level.puzzles ?? []) {
    const interactionId = "interactionId" in puzzle ? puzzle.interactionId : puzzle.clue.interactionId;
    if (interactionId) {
      const imported = puzzles.find((candidate) => candidate.id === puzzle.id);
      if (imported) puzzleByInteractionId.set(interactionId, imported.id);
    }
  }
  return (level.switches ?? []).flatMap((switchDefinition) => {
    const interaction = interactions.get(switchDefinition.interactionId);
    if (!interaction) return [];
    if (isWallDoorSwitchDefinition(switchDefinition, interaction)) return [];
    const key = interaction.consumesKeyItemId ? keys.get(interaction.consumesKeyItemId) : undefined;
    const keyRoomId = key?.roomId ?? interaction.roomId;
    const outputs = switchOutputsFromLevel(level, switchDefinition, puzzleByInteractionId, rooms);
    if (outputs.length === 0) return [];
    return [{
      id: builderRouteIdFromSwitchId(switchDefinition.id),
      label: switchDefinition.label ?? interaction.label ?? "管制路由台",
      roomId: interaction.roomId,
      keyRoomId,
      ...(interaction.anchorPropId ? { hostPropId: interaction.anchorPropId } : {}),
      ...(key ? { keyPosition: [roundMeter(key.position[0]), roundMeter(key.position[2])] as const } : {}),
      position: [roundMeter(interaction.position[0]), roundMeter(interaction.position[2])] as const,
      rotationY: interaction.yaw ?? 0,
      outputs,
    }];
  });
}

function wallDoorSwitchesFromLevel(level: LevelDefinition): BuilderWallDoorSwitch[] {
  const interactions = new Map((level.map?.interactions ?? []).map((interaction) => [interaction.id, interaction]));
  return (level.switches ?? []).flatMap((switchDefinition): BuilderWallDoorSwitch[] => {
    const interaction = interactions.get(switchDefinition.interactionId);
    if (!interaction || !isWallDoorSwitchDefinition(switchDefinition, interaction) || !switchDefinition.wallMount) return [];
    const states = switchDefinition.states.map((state): BuilderWallDoorSwitchState => {
      const openDoorIds = state.actions.flatMap((action) => action.type === "open_door" ? [action.doorId] : []);
      const closeDoorIds = state.actions.flatMap((action) => action.type === "close_door" ? [action.doorId] : []);
      const stateId = builderWallDoorSwitchStateIdFromRuntime(state.id);
      return {
        id: stateId,
        label: state.label ?? stateId,
        ...(openDoorIds.length > 0 ? { openDoorIds } : {}),
        ...(closeDoorIds.length > 0 ? { closeDoorIds } : {}),
        ...(state.message ? { message: state.message } : {}),
      };
    });
    const initialStateId = builderWallDoorSwitchStateIdFromRuntime(switchDefinition.initialStateId ?? switchDefinition.states[0]?.id ?? states[0]?.id ?? "closed");
    const openState = states.find((state) => state.id === "open") ?? states.find((state) => state.openDoorIds?.length);
    const closedState = states.find((state) => state.id === "closed") ?? states[0];
    const primaryDoorId = openState?.openDoorIds?.[0] ?? states.find((state) => state.openDoorIds?.length)?.openDoorIds?.[0];
    const inverseDoorId = openState?.closeDoorIds?.find((doorId) => closedState?.openDoorIds?.includes(doorId));
    return [{
      id: builderWallDoorSwitchIdFromSwitchId(switchDefinition.id),
      label: switchDefinition.label ?? interaction.label ?? "墙面门控把手",
      roomId: switchDefinition.roomId,
      wallMount: switchDefinition.wallMount,
      mode: "toggle",
      ...(primaryDoorId ? { primaryDoorId } : {}),
      ...(inverseDoorId ? { inverseDoorId } : {}),
      initialStateId,
      oneShot: switchDefinition.oneShot ?? false,
      states,
    }];
  });
}

function isWallDoorSwitchDefinition(switchDefinition: LevelSwitchDefinition, interaction: LevelInteractionDefinition) {
  return (
    switchDefinition.presentation?.kind === "wall_lever" ||
    switchDefinition.presentation?.kind === "wall_button" ||
    interaction.visualKey === "wall_door_switch_button" ||
    switchDefinition.id.startsWith("door_switch_wall_switch_")
  );
}

function switchOutputsFromLevel(
  level: LevelDefinition,
  switchDefinition: LevelSwitchDefinition,
  puzzleByInteractionId: ReadonlyMap<string, string>,
  rooms: readonly BuilderRoom[],
): BuilderRouteSwitchOutput[] {
  const initial = switchDefinition.initialStateId ?? "idle";
  return switchDefinition.states.flatMap((state, index): BuilderRouteSwitchOutput[] => {
    if (state.id === initial) return [];
    const output = switchOutputFromState(level, switchDefinition, state, index, puzzleByInteractionId, rooms);
    return output ? [output] : [];
  });
}

function switchOutputFromState(
  level: LevelDefinition,
  switchDefinition: LevelSwitchDefinition,
  state: LevelSwitchStateDefinition,
  index: number,
  puzzleByInteractionId: ReadonlyMap<string, string>,
  rooms: readonly BuilderRoom[],
): BuilderRouteSwitchOutput | null {
  const doorId = firstAction(state.actions, "open_door")?.doorId ?? firstAction(state.actions, "unlock_door")?.doorId;
  if (doorId) {
    return { id: importedRouteOutputId(state, index), kind: "open_door", doorId, label: state.label };
  }
  const waveId = firstAction(state.actions, "start_wave")?.waveId;
  if (waveId) {
    const robotRoomId = roomIdForWave(level, waveId, rooms);
    if (robotRoomId) return { id: importedRouteOutputId(state, index), kind: "start_robots", robotRoomId, label: state.label };
  }
  const gatedInteraction = level.map?.interactions.find(
    (interaction) => interaction.requiresSwitchState?.switchId === switchDefinition.id && interaction.requiresSwitchState.stateId === state.id,
  );
  const puzzleId = gatedInteraction ? puzzleByInteractionId.get(gatedInteraction.id) : undefined;
  if (puzzleId) {
    return { id: importedRouteOutputId(state, index), kind: "reveal_puzzle", puzzleId, label: state.label };
  }
  return null;
}

function firstAction<T extends LevelRuntimeEventAction["type"]>(
  actions: readonly LevelRuntimeEventAction[] | undefined,
  type: T,
): Extract<LevelRuntimeEventAction, { type: T }> | undefined {
  return actions?.find((action): action is Extract<LevelRuntimeEventAction, { type: T }> => action.type === type);
}

function roomIdForWave(level: LevelDefinition, waveId: string, rooms: readonly BuilderRoom[]) {
  const wave = level.waves.find((candidate) => candidate.id === waveId);
  if (!wave) return undefined;
  if (wave.trigger?.type === "room_entered" && wave.trigger.id && rooms.some((room) => room.id === wave.trigger?.id)) {
    return wave.trigger.id;
  }
  const spawnGroupId = wave.enemies[0]?.from ?? wave.reinforcements?.[0]?.from;
  const point = level.spawnGroups.find((group) => group.id === spawnGroupId)?.center;
  if (point) return rooms.find((room) => containsWorldPoint(room, point[0], point[2]))?.id;
  return undefined;
}

function builderRouteIdFromSwitchId(switchId: string) {
  return switchId.startsWith("route_") ? switchId.slice("route_".length) : switchId;
}

function builderWallDoorSwitchIdFromSwitchId(switchId: string) {
  return safeImportId(switchId.replace(/^door_switch_/, ""));
}

function builderWallDoorSwitchStateIdFromRuntime(stateId: string) {
  return safeImportId(stateId.replace(/^state_\d+_/, "")) || "state";
}

function importedRouteOutputId(state: LevelSwitchStateDefinition, index: number) {
  const normalized = safeImportId(state.id.replace(/^out_\d+_/, ""));
  return normalized || `out_${index + 1}`;
}

function puzzleDoorMetadataFromLevel(level: LevelDefinition, door: LevelDoorDefinition): Partial<BuilderDoor> {
  if (door.lock.type !== "puzzle_complete") return {};
  const puzzle = level.puzzles?.find((candidate) => candidate.id === door.lock.puzzleId);
  if (!puzzle) return {};
  const kind = builderPuzzleKindFromLevelPuzzle(puzzle);
  const interaction = puzzleInteraction(puzzle, new Map((level.map?.interactions ?? []).map((candidate) => [candidate.id, candidate])));
  return {
    ...(kind ? { puzzleKind: kind } : {}),
    ...(interaction?.roomId ? { puzzleRoomId: interaction.roomId } : {}),
  };
}

function linkedDoorIdForPuzzle(level: LevelDefinition, puzzle: LevelPuzzleDefinition) {
  const grantedKeyId = firstAction(puzzle.success.actions, "grant_key_item")?.keyItemId;
  if (grantedKeyId) {
    const key = level.map?.keyItems.find((item) => item.id === grantedKeyId);
    const doorId = key?.requiredForDoorIds[0];
    if (doorId) return doorId;
  }
  const lockedDoor = level.map?.doors.find((door) => door.lock.type === "puzzle_complete" && door.lock.puzzleId === puzzle.id);
  if (lockedDoor) return lockedDoor.id;
  if (puzzle.success.opensDoorId) return puzzle.success.opensDoorId;
  return (
    firstAction(puzzle.success.actions, "open_door")?.doorId ??
    firstAction(puzzle.success.actions, "unlock_door")?.doorId
  );
}

function grantedKeyPuzzleMap(level: LevelDefinition) {
  const map = new Map<string, string>();
  for (const puzzle of level.puzzles ?? []) {
    const keyId = firstAction(puzzle.success.actions, "grant_key_item")?.keyItemId;
    if (keyId) map.set(keyId, puzzle.id);
  }
  return map;
}

function puzzleInteraction(
  puzzle: LevelPuzzleDefinition,
  interactions: ReadonlyMap<string, NonNullable<LevelDefinition["map"]>["interactions"][number]>,
) {
  const interactionId = puzzle.type === "hit_sequence" ? puzzle.clue.interactionId : "interactionId" in puzzle ? puzzle.interactionId : undefined;
  return interactionId ? interactions.get(interactionId) : undefined;
}

function builderPuzzleKindFromLevelPuzzle(puzzle: LevelPuzzleDefinition): BuilderPuzzleKind | null {
  if (puzzle.type === "hit_sequence") return "color_sequence";
  if (puzzle.type === "code_lock") return "code_lock";
  if (puzzle.type === "tool_calibration" || puzzle.type === "circuit_grid") return "circuit_grid";
  if (puzzle.type === "surveillance_match") return "surveillance_match";
  if (puzzle.type === "valve_matrix") return "valve_matrix";
  if (puzzle.type === "archive_merge") return "archive_merge";
  if (puzzle.type === "gallery_reading") return "gallery_reading";
  return null;
}

function orderedHitSequenceTargets(
  puzzle: Extract<LevelPuzzleDefinition, { type: "hit_sequence" }>,
): readonly LevelPuzzleTargetDefinition[] {
  const targetById = new Map(puzzle.targets.map((target) => [target.id, target]));
  const ordered = puzzle.clue.sequence
    .map((targetId) => targetById.get(targetId))
    .filter((target): target is LevelPuzzleTargetDefinition => Boolean(target));
  return ordered.length === puzzle.targets.length ? ordered : puzzle.targets;
}

function componentsFromHitSequencePuzzle(
  puzzle: Extract<LevelPuzzleDefinition, { type: "hit_sequence" }>,
  props: readonly LevelMapPropDefinition[],
): BuilderPuzzleComponent[] {
  const actorByTargetId = puzzleActorByTargetId(puzzle);
  return orderedHitSequenceTargets(puzzle).map((target) => componentFromPuzzleTarget(target, props, actorByTargetId.get(target.id)));
}

function puzzleActorByTargetId(puzzle: Extract<LevelPuzzleDefinition, { type: "hit_sequence" }>) {
  return new Map((puzzle.actors ?? []).map((actor) => [actor.targetId ?? actor.id, actor]));
}

function componentFromPuzzleTarget(
  target: LevelPuzzleTargetDefinition,
  props: readonly LevelMapPropDefinition[],
  actor?: LevelPuzzleActorDefinition,
): BuilderPuzzleComponent {
  const inferredAnchor = target.anchorPropId
    ? { anchorPropId: target.anchorPropId }
    : sourceAnchorPropForTarget(target.roomId, target.position[0], target.position[2], props, 0.75);
  const baseActor = actor ?? puzzleActorFromHitSequenceTarget(target);
  const sourceActor = baseActor.anchorPropId || !inferredAnchor ? baseActor : { ...baseActor, anchorPropId: inferredAnchor.anchorPropId };
  const visualPosition = sourceActor.position;
  return {
    id: safeImportId(target.id),
    role: `orb_${sourceActor.colorKey ?? target.colorKey}` as BuilderPuzzleComponent["role"],
    roomId: sourceActor.roomId,
    position: [roundMeter(visualPosition[0]), roundMeter(visualPosition[2])],
    sourceTarget: {
      id: target.id,
      label: target.label,
      y: target.position[1],
      radius: target.radius,
      visualKey: target.visualKey,
      ...(target.materialKey ? { materialKey: target.materialKey } : {}),
      ...inferredAnchor,
    },
    sourceActor,
  };
}

function sourceInteractionFromLevel(
  interaction: LevelInteractionDefinition,
  props: readonly LevelMapPropDefinition[],
): NonNullable<BuilderPuzzleInstance["sourceInteraction"]> {
  return {
    type: interaction.type,
    radius: interaction.radius,
    visualKey: interaction.visualKey,
    ...(interaction.materialKey ? { materialKey: interaction.materialKey } : {}),
    ...(interaction.label ? { label: interaction.label } : {}),
    ...sourceHostPropForInteraction(interaction, props),
    ...(interaction.startsObjectiveId ? { startsObjectiveId: interaction.startsObjectiveId } : {}),
    ...(interaction.completesObjectiveId ? { completesObjectiveId: interaction.completesObjectiveId } : {}),
    ...(interaction.grantsKeyItemId ? { grantsKeyItemId: interaction.grantsKeyItemId } : {}),
    ...(interaction.consumesKeyItemId ? { consumesKeyItemId: interaction.consumesKeyItemId } : {}),
    ...(interaction.opensDoorId ? { opensDoorId: interaction.opensDoorId } : {}),
    ...(interaction.requiresObjectiveId ? { requiresObjectiveId: interaction.requiresObjectiveId } : {}),
    ...(interaction.requiresArticleIds?.length ? { requiresArticleIds: interaction.requiresArticleIds } : {}),
    ...(interaction.requiresSwitchState ? { requiresSwitchState: interaction.requiresSwitchState } : {}),
    ...(interaction.dialogueTrigger ? { dialogueTrigger: interaction.dialogueTrigger } : {}),
    ...(interaction.rewardPulse ? { rewardPulse: interaction.rewardPulse } : {}),
    ...(interaction.rewardPulseDuration !== undefined ? { rewardPulseDuration: interaction.rewardPulseDuration } : {}),
    ...(interaction.audio ? { audio: interaction.audio } : {}),
  };
}

function styleFromRoom(room: LevelRoomDefinition): BuilderRoomStyle {
  const text = `${room.id} ${room.label} ${room.skinKey ?? ""} ${room.floorMaterialKey ?? ""} ${room.wallMaterialKey ?? ""}`.toLowerCase();
  if (text.includes("exit") || text.includes("elevator") || text.includes("电梯") || text.includes("出口")) return "exit";
  if (text.includes("core") || text.includes("核心")) return "core";
  if (text.includes("museum") || text.includes("gallery") || text.includes("archive") || text.includes("博物馆") || text.includes("展厅")) return "museum";
  if (text.includes("residential") || text.includes("home") || text.includes("居住")) return "residential";
  if (text.includes("hazard") || text.includes("警戒")) return "hazard";
  if (text.includes("sterile") || text.includes("clinic") || text.includes("无菌")) return "sterile";
  return "maintenance";
}

function lockTypeFromDoor(door: LevelDoorDefinition): BuilderLockType {
  if (door.lock.type === "key_item") return "key_item";
  if (door.lock.type === "survive_wave" || door.lock.type === "boss_dead") return "survive_wave";
  if (door.lock.type === "puzzle_complete") return "puzzle_complete";
  if (door.lock.type === "switch_state") return "switch_state";
  return "none";
}

function keyRoomIdForDoor(level: LevelDefinition, door: LevelDoorDefinition) {
  const keyItem = level.map?.keyItems?.find((item) => item.requiredForDoorIds.includes(door.id) || item.id === door.lock.keyItemId);
  return keyItem?.roomId ?? level.map?.rooms[0]?.id;
}

function exitRoomIdFor(level: LevelDefinition) {
  const exitInteraction = level.map?.interactions.find((interaction) => interaction.type === "exit");
  if (exitInteraction?.roomId) return exitInteraction.roomId;
  const [x, , z] = level.exit.position;
  return level.map?.rooms.find((room) => {
    const [cx, , cz] = room.bounds.center;
    const [width, , depth] = room.bounds.size;
    return Math.abs(x - cx) <= width / 2 && Math.abs(z - cz) <= depth / 2;
  })?.id;
}

function averageScale(scale: readonly [number, number, number]) {
  return (scale[0] + scale[1] + scale[2]) / 3;
}

function roundMeter(value: number) {
  return Math.round(value * 100) / 100;
}

function roundScale(value: number) {
  return Math.round(value * 1000) / 1000;
}

function safeImportId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
