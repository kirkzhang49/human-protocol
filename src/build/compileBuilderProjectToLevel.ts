import {
  campaignEconomy,
  campaignPickupRules,
  campaignPresentationBase,
  campaignRevive,
  campaignSpawnGroups,
  officialExitElevatorCinematic,
  standardCombatLimits,
} from "../game/config/shared/campaignDefaults";
import {
  createOfficialExitElevatorReferenceProps,
  createOfficialExitRoomReference,
  normalizeLevelExitRoomReference,
  officialExitDoorAnimationReference,
  officialExitElevatorCinematicEnterPosition,
  officialExitElevatorFaceYaw,
  officialExitRoomCenterForDoor,
} from "../game/config/shared/exitRoomReference";
import { isEnvironmentModelKey } from "../assets/environmentModelAssets";
import type {
  DoorLockDefinition,
  LevelArticleDefinition,
  LevelDefinition,
  LevelDoorDefinition,
  LevelPuzzleColorKey,
  LevelInteractionDefinition,
  LevelKeyItemDefinition,
  LevelMapPickupDefinition,
  LevelMapPropDefinition,
  LevelObjectiveDefinition,
  LevelPresentationConfig,
  LevelPuzzleDefinition,
  LevelPuzzleTargetDefinition,
  LevelRuntimeEventAction,
  LevelSwitchDefinition,
  LevelRuntimeEventDefinition,
  SpawnGroupDefinition,
  Vec3Tuple,
  WaveDefinition,
  WavePresentationDefinition,
} from "../game/config/schema/levelConfig";
import { builderDoorFamilies, builderDoorFamilyEntry, defaultPropElevation, propEntry, robotLabel, roomStyleEntry } from "./BuilderAssetCatalog";
import { builderDoorDisplayLabel, builderDoorSurviveRobotIds, builderDoorWaveIds } from "./BuilderDoorRelations";
import { projectLighting } from "./BuilderEnvironment";
import { normalizeBuilderKeyPickups } from "./BuilderKeyPickups";
import { pickupEntry } from "./BuilderPickupCatalog";
import { wallMountPlacementForRoom, wallMountedPropPlacementForEntryFromPoint } from "./BuilderPlacementRules";
import {
  compile2DPuzzle,
  compileColorPuzzle,
  normalizeBuilderPuzzles,
  puzzleInstances,
  puzzleResultMode,
  puzzleKindEntry,
  validateBuilderPuzzles,
} from "./BuilderPuzzleCatalog";
import { storyTemplateById } from "./BuilderStoryTemplates";
import {
  pointInPolygon,
  polygonCentroid,
  polygonEdges,
  rotatedLocalPoints,
  roomWorldPolygon,
  type Vec2,
} from "./BuilderRoomShape";
import type {
  BuilderDoor,
  BuilderPickup,
  BuilderProp,
  BuilderProject,
  BuilderPuzzleInstance,
  BuilderRobotGroup,
  BuilderRoom,
  BuilderRouteSwitch,
  BuilderRouteSwitchOutput,
  BuilderWallDoorSwitch,
  BuilderWaveChainMeta,
} from "./BuilderTypes";
import {
  MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR,
  MAX_WALL_DOOR_SWITCHES_PER_LEVEL,
  effectiveWallDoorSwitchStates,
  primaryDoorIdForWallDoorSwitch,
  wallDoorSwitchControlIdsForDoor,
  wallDoorSwitchMode,
} from "./BuilderWallDoorSwitches";
import { isRouteOpenDoorTargetAllowed, routeOpenDoorActions } from "./official-bridge/ProgressionBridge";
import { builderMapPresentationForProject, officialSurfaceFieldsForBuilderRoom } from "./official-bridge/SurfaceKitBridge";

export interface BuilderCompileIssue {
  path: string;
  message: string;
}

export interface BuilderCompileResult {
  level: LevelDefinition | null;
  issues: BuilderCompileIssue[];
}

const doorWidth = 3.2;
const doorSize: Vec3Tuple = [doorWidth, 3.2, 0.35];
const builderPlaytestInventory: NonNullable<LevelDefinition["initialInventory"]> = {
  hasRod: true,
  hasPistol: true,
  coreCells: 0,
  equipWeapon: "railLance",
};

export function builderLevelId(project: BuilderProject) {
  const suffix = project.projectId.replace(/[^a-zA-Z0-9_-]+/g, "").slice(-10) || "draft";
  return `builder_level_${suffix}`;
}

function isBuilderNativeOfficialSourceLevel(levelId: string | undefined) {
  return (
    levelId === "level_01_maintenance_bay" ||
    levelId === "level_02_residential_simulation" ||
    levelId === "level_03_human_museum" ||
    levelId === "level_04_memory_clinic" ||
    levelId === "level_05_reclamation_core"
  );
}

function safeConfigId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function routeSwitchDefinitionId(route: BuilderRouteSwitch) {
  return `route_${safeConfigId(route.id)}`;
}

function routeOutputStateId(output: BuilderRouteSwitchOutput, index: number) {
  return `out_${index + 1}_${safeConfigId(output.id).slice(0, 12) || "route"}`;
}

function routeOutputKeyItemId(route: BuilderRouteSwitch, output: BuilderRouteSwitchOutput, index: number) {
  return `${routeSwitchDefinitionId(route)}_${routeOutputStateId(output, index)}_key`;
}

function wallDoorSwitchDefinitionId(switchDef: BuilderWallDoorSwitch) {
  return `door_switch_${safeConfigId(switchDef.id)}`;
}

function wallDoorSwitchInteractionId(switchDef: BuilderWallDoorSwitch) {
  return `${wallDoorSwitchDefinitionId(switchDef)}_button`;
}

function wallDoorSwitchStateId(stateId: string, index: number) {
  return `state_${index + 1}_${safeConfigId(stateId).slice(0, 12) || "route"}`;
}

function collectRoutePuzzleRequirements(routeSwitches: readonly BuilderRouteSwitch[]) {
  const requirements = new Map<string, { switchId: string; stateId: string }>();
  for (const route of routeSwitches) {
    const switchId = routeSwitchDefinitionId(route);
    route.outputs.forEach((output, index) => {
      if (output.kind !== "reveal_puzzle" || !output.puzzleId) return;
      requirements.set(output.puzzleId, { switchId, stateId: routeOutputStateId(output, index) });
    });
  }
  return requirements;
}

function collectRouteRobotTriggers(routeSwitches: readonly BuilderRouteSwitch[]) {
  const triggers = new Map<string, { switchId: string; stateId: string }>();
  for (const route of routeSwitches) {
    const switchId = routeSwitchDefinitionId(route);
    route.outputs.forEach((output, index) => {
      if (output.kind !== "start_robots" || !output.robotRoomId) return;
      triggers.set(output.robotRoomId, { switchId, stateId: routeOutputStateId(output, index) });
    });
  }
  return triggers;
}

function collectRouteSwitchOpenDoorIds(routeSwitches: readonly BuilderRouteSwitch[]) {
  const ids = new Set<string>();
  for (const route of routeSwitches) {
    for (const output of route.outputs) {
      if (output.kind === "open_door" && output.doorId) ids.add(output.doorId);
    }
  }
  return ids;
}

function collectBuilderOutputOpenDoorIds(project: BuilderProject) {
  const ids = new Set<string>();
  for (const route of project.routeSwitches ?? []) {
    for (const output of route.outputs) {
      if (output.kind === "open_door" && output.doorId) ids.add(output.doorId);
    }
  }
  for (const wallSwitch of project.wallDoorSwitches ?? []) {
    for (const state of effectiveWallDoorSwitchStates(wallSwitch)) {
      for (const doorId of state.openDoorIds ?? []) ids.add(doorId);
    }
  }
  for (const puzzle of puzzleInstances(project)) {
    for (const output of puzzle.successOutputs ?? []) {
      if (output.kind === "open_door" && output.doorId) ids.add(output.doorId);
    }
  }
  return ids;
}

const outputDoorSourceLockTypes = new Set(["objective_complete", "environment_state"]);

function routeDoorLockStateId(doorId: string) {
  return `route_lock_${safeConfigId(doorId)}`;
}

function builderWaveIdForRobotRoom(project: BuilderProject, roomId: string, canonicalizer?: BuilderWaveChainCanonicalizer) {
  const chained = project.robots
    .filter((robot) => robot.roomId === roomId && robot.waveChain?.waveId)
    .sort((left, right) => (left.waveChain?.order ?? 999) - (right.waveChain?.order ?? 999))[0];
  return (chained ? canonicalizer?.metaForRobot(chained)?.waveId ?? chained.waveChain?.waveId : undefined) ??
    project.robots.find((robot) => robot.roomId === roomId && robot.wave?.role !== "reinforcement" && robot.wave?.id)?.wave?.id ??
    `wave_${roomId}`;
}

function hasBuilderAuthoredDoorProgression(project: BuilderProject, door: BuilderDoor) {
  if (door.lockType !== "survive_wave") return false;
  if (builderDoorSurviveRobotIds(door).length > 0) return true;
  const authoredWaveIds = new Set(project.robots.map((robot) => robot.waveChain?.waveId).filter((id): id is string => Boolean(id)));
  return builderDoorWaveIds(door).some((waveId) => authoredWaveIds.has(waveId));
}

function hasBuilderAuthoredProgression(project: BuilderProject) {
  if (project.robots.some((robot) => robot.waveChain?.waveId)) return true;
  return project.doors.some((door) => hasBuilderAuthoredDoorProgression(project, door));
}

function collectAuthoredWaveChainIds(project: BuilderProject) {
  return new Set(project.robots.map((robot) => robot.waveChain?.waveId).filter((id): id is string => Boolean(id)));
}

interface BuilderWaveChainCanonicalizer {
  metaForRobot(robot: BuilderRobotGroup): BuilderWaveChainMeta | undefined;
  idForDoorWave(waveId: string, roomId: string): string;
  canonicalWaveIds: ReadonlySet<string>;
}

function splitWaveChainIdForRoom(waveId: string, roomId: string, usedIds: ReadonlySet<string>, reservedIds: ReadonlySet<string>) {
  const waveStem = safeConfigId(waveId) || "wave";
  const roomStem = safeConfigId(roomId) || "room";
  let candidate = `${waveStem}_${roomStem}`;
  let suffix = 2;
  while (usedIds.has(candidate) || reservedIds.has(candidate)) {
    candidate = `${waveStem}_${roomStem}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function createWaveChainCanonicalizer(project: BuilderProject): BuilderWaveChainCanonicalizer {
  const canonicalIdByRoomOrder = new Map<string, string>();
  const canonicalMetaByRobotId = new Map<string, BuilderWaveChainMeta>();
  const canonicalIdByRoomAndOriginalId = new Map<string, string>();
  const canonicalIdsByOriginalId = new Map<string, string[]>();
  const usedCanonicalIds = new Set<string>();
  const reservedIds = new Set(project.robots.map((robot) => robot.waveChain?.waveId).filter((id): id is string => Boolean(id)));
  for (const robot of project.robots) {
    const waveChain = robot.waveChain;
    if (!waveChain?.waveId || !Number.isFinite(waveChain.order)) continue;
    const key = waveChainRoomOrderKey(robot.roomId, waveChain.order, Boolean(robot.wave?.id));
    let canonicalId = canonicalIdByRoomOrder.get(key);
    if (!canonicalId) {
      canonicalId = usedCanonicalIds.has(waveChain.waveId)
        ? splitWaveChainIdForRoom(waveChain.waveId, robot.roomId, usedCanonicalIds, reservedIds)
        : waveChain.waveId;
      canonicalIdByRoomOrder.set(key, canonicalId);
      usedCanonicalIds.add(canonicalId);
    }

    canonicalMetaByRobotId.set(robot.id, canonicalId === waveChain.waveId ? waveChain : { ...waveChain, waveId: canonicalId });
    canonicalIdByRoomAndOriginalId.set(`${robot.roomId}:${waveChain.waveId}`, canonicalId);
    const canonicalIds = canonicalIdsByOriginalId.get(waveChain.waveId) ?? [];
    if (!canonicalIds.includes(canonicalId)) canonicalIds.push(canonicalId);
    canonicalIdsByOriginalId.set(waveChain.waveId, canonicalIds);
  }
  return {
    canonicalWaveIds: usedCanonicalIds,
    metaForRobot(robot) {
      return canonicalMetaByRobotId.get(robot.id);
    },
    idForDoorWave(waveId, roomId) {
      const roomScopedId = canonicalIdByRoomAndOriginalId.get(`${roomId}:${waveId}`);
      if (roomScopedId) return roomScopedId;
      const canonicalIds = canonicalIdsByOriginalId.get(waveId);
      return canonicalIds?.length === 1 ? canonicalIds[0] : waveId;
    },
  };
}

function waveChainRoomOrderKey(roomId: string, order: number, sourceBacked: boolean) {
  return `${roomId}:${order}:${sourceBacked ? "source" : "builder"}`;
}

function collectWaveChainOrdersByRoom(project: BuilderProject, canonicalizer: BuilderWaveChainCanonicalizer) {
  const orderSetsByRoom = new Map<string, Set<number>>();
  for (const robot of project.robots) {
    const waveChain = canonicalizer.metaForRobot(robot);
    if (!waveChain || !Number.isFinite(waveChain.order)) continue;
    const orders = orderSetsByRoom.get(robot.roomId) ?? new Set<number>();
    orders.add(waveChain.order);
    orderSetsByRoom.set(robot.roomId, orders);
  }
  return new Map([...orderSetsByRoom.entries()].map(([roomId, orders]) => [roomId, [...orders].sort((left, right) => left - right)]));
}

function isFirstWaveChainInRoom(ordersByRoom: ReadonlyMap<string, readonly number[]>, roomId: string, order: number) {
  return ordersByRoom.get(roomId)?.[0] === order;
}

function hasPreviousWaveChainInRoom(ordersByRoom: ReadonlyMap<string, readonly number[]>, roomId: string, order: number) {
  return ordersByRoom.get(roomId)?.some((candidate) => candidate < order) ?? false;
}

function maxWaveChainOrderInRoom(ordersByRoom: ReadonlyMap<string, readonly number[]>, roomId: string) {
  const orders = ordersByRoom.get(roomId);
  return orders?.[orders.length - 1] ?? 0;
}

function puzzleGrantObjectiveId(puzzleId: string) {
  return `obj_puzzle_${safeConfigId(puzzleId)}`;
}

type BuilderRobotWaveGroup = {
  roomId: string;
  robots: BuilderRobotGroup[];
  wave?: BuilderRobotGroup["wave"];
  waveChain?: BuilderWaveChainMeta;
};

function collectRoomEntryWaveIds(project: BuilderProject) {
  const ids = new Map<string, string>();
  for (const robot of project.robots) {
    const wave = robot.wave;
    if (!wave?.id || robot.waveChain || wave.role === "reinforcement") continue;
    const triggerType = wave.triggerType ?? "room_entered";
    const triggerId = wave.triggerId ?? robot.roomId;
    if (triggerType !== "room_entered" || triggerId !== robot.roomId) continue;
    if (!ids.has(robot.roomId)) ids.set(robot.roomId, wave.id);
  }
  return ids;
}

function robotWaveGroupKey(
  robot: BuilderRobotGroup,
  explicitDoorRobotIds: ReadonlySet<string>,
  roomEntryWaveIds: ReadonlyMap<string, string>,
  authoredWaveChainIds: ReadonlySet<string>,
) {
  if (robot.waveChain?.waveId) return `chain:${robot.waveChain.waveId}`;
  if (robot.wave?.id && authoredWaveChainIds.has(robot.wave.id)) return `chain:${robot.wave.id}`;
  if (robot.wave?.id) return `wave:${robot.wave.id}`;
  if (explicitDoorRobotIds.has(robot.id)) return `robot:${robot.id}`;
  const roomEntryWaveId = roomEntryWaveIds.get(robot.roomId);
  if (roomEntryWaveId) return `wave:${roomEntryWaveId}`;
  return `room:${robot.roomId}`;
}

function compiledWaveIdForRobotWaveGroup(groupKey: string, group: Pick<BuilderRobotWaveGroup, "roomId" | "wave" | "waveChain">) {
  const explicitRobotId = groupKey.startsWith("robot:") ? groupKey.slice("robot:".length) : "";
  return group.waveChain?.waveId ?? group.wave?.id ?? (explicitRobotId ? `wave_${safeConfigId(explicitRobotId)}` : `wave_${group.roomId}`);
}

function isRoomEntryPreludeWaveGroup(
  group: BuilderRobotWaveGroup,
  authoredWaveChainIds: ReadonlySet<string>,
  routeRobotTriggers: ReadonlyMap<string, unknown>,
) {
  if (group.waveChain) return false;
  if (routeRobotTriggers.has(group.roomId)) return false;
  if (!group.robots.some((robot) => robot.wave?.role !== "reinforcement")) return false;

  const wave = group.wave;
  if (wave?.id && authoredWaveChainIds.has(wave.id)) return false;
  const triggerType = wave?.triggerType ?? "room_entered";
  const triggerId = wave?.triggerId ?? group.roomId;
  return triggerType === "room_entered" && triggerId === group.roomId;
}

function collectRoomEntryPreludeWaveIds(
  robotWaveGroups: ReadonlyMap<string, BuilderRobotWaveGroup>,
  authoredWaveChainIds: ReadonlySet<string>,
  routeRobotTriggers: ReadonlyMap<string, unknown>,
) {
  const byRoom = new Map<string, string[]>();
  for (const [groupKey, group] of robotWaveGroups) {
    if (!isRoomEntryPreludeWaveGroup(group, authoredWaveChainIds, routeRobotTriggers)) continue;
    const waveId = compiledWaveIdForRobotWaveGroup(groupKey, group);
    const current = byRoom.get(group.roomId) ?? [];
    if (!current.includes(waveId)) current.push(waveId);
    byRoom.set(group.roomId, current);
  }
  return byRoom;
}

function mergeWaveChainMeta(current: BuilderWaveChainMeta | undefined, next: BuilderWaveChainMeta | undefined): BuilderWaveChainMeta | undefined {
  if (!next) return current;
  if (!current) return next;
  return {
    ...current,
    ...next,
    clearActions: next.clearActions?.length ? next.clearActions : current.clearActions,
    pressureLoop: next.pressureLoop?.enabled ? next.pressureLoop : current.pressureLoop,
  };
}

function pressureWaveIdFor(coreWaveId: string) {
  return `${safeConfigId(coreWaveId)}_pressure_loop`;
}

function builderRobotReadableLabel(robot: BuilderRobotGroup) {
  return robot.label?.trim() || robot.waveChain?.label || robot.wave?.presentation?.label || robot.wave?.label || robotLabel(robot.archetype);
}

function robotSpawnDefinition(robot: BuilderRobotGroup, groupId: string) {
  return {
    archetype: robot.archetype,
    count: Math.max(1, Math.min(4, Math.round(robot.count))),
    from: groupId,
    ...(robot.tier ? { tier: robot.tier } : {}),
    ...(robot.combat ?? {}),
  };
}

function isLeaderOrBossRobot(robot: BuilderRobotGroup) {
  return robot.tier === "leader" || robot.tier === "boss";
}

export function compileBuilderProjectToLevel(project: BuilderProject): BuilderCompileResult {
  // Legacy drafts carry puzzle doors without instances — synthesize them so
  // old saves keep compiling unchanged.
  project = normalizeBuilderKeyPickups(normalizeBuilderPuzzles(project));
  // Story shell: facility nouns for keys/exit + archive-voice ending lines.
  const storyTemplate = storyTemplateById(project.story?.templateId);
  const keyNoun = storyTemplate?.keyNoun ?? "门禁片";
  const exitLabel = storyTemplate?.exitLabel ?? "撤离电梯";
  const issues: BuilderCompileIssue[] = [];
  issues.push(...validateBuilderPuzzles(project));
  issues.push(...validateBuilderRouteSwitches(project));
  issues.push(...validateBuilderWallDoorSwitches(project));
  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));

  if (project.rooms.length === 0) issues.push({ path: "rooms", message: "至少需要一个房间。" });
  const spawnRoom = project.rooms[0];
  // The exit room is no longer picked in the inspector (the panel now shows the
  // spawn instead). Honor a still-valid stored exitRoomId, otherwise auto-assign
  // the last room — so removing the picker can never leave the project in an
  // unfixable "请指定出口房间" state with no UI to recover.
  const exitRoom = roomsById.get(project.exitRoomId) ?? project.rooms[project.rooms.length - 1];
  if (!exitRoom) issues.push({ path: "exitRoomId", message: "请指定出口房间。" });
  if (exitRoom && spawnRoom && exitRoom.id === spawnRoom.id && project.rooms.length > 1) {
    issues.push({ path: "exitRoomId", message: "出口房间不能是出生房间。" });
  }

  const doors: LevelDoorDefinition[] = [];
  // Doors that open into the exit room become the premium service-elevator
  // door (old Level 3 闭馆电梯 kit); the exit panel associates with the first.
  const exitDoorIds: string[] = [];
  const keyItems: LevelKeyItemDefinition[] = [];
  const keyPickupByDoorId = collectBuilderKeyPickups(project, roomsById, issues);
  const waves: WaveDefinition[] = [];
  const wavePresentations: WavePresentationDefinition[] = [];
  const spawnGroups: SpawnGroupDefinition[] = [...campaignSpawnGroups];
  const spawnSourceLabels: Record<string, string> = { ...campaignPresentationBase.spawnSourceLabels };
  const waveLabels: Record<string, string> = {};
  const interactions: LevelInteractionDefinition[] = [];
  const articles: LevelArticleDefinition[] = [];
  const puzzles: LevelPuzzleDefinition[] = [];
  const events: LevelRuntimeEventDefinition[] = [];
  const switches: LevelSwitchDefinition[] = [];
  const routeSwitches = project.routeSwitches ?? [];
  const routePuzzleRequirements = collectRoutePuzzleRequirements(routeSwitches);
  const routeRobotTriggers = collectRouteRobotTriggers(routeSwitches);
  const routeSwitchOpenDoorIds = collectRouteSwitchOpenDoorIds(routeSwitches);
  const outputOpenDoorIds = collectBuilderOutputOpenDoorIds(project);
  const keyGrantPuzzleByDoorId = collectKeyGrantPuzzles(project);
  const sourceLevel = project.sourceLevel;
  const useGeneratedProgression = hasBuilderAuthoredProgression(project);
  const preferBuilderRuntimeOverSource = !sourceLevel?.levelId || isBuilderNativeOfficialSourceLevel(sourceLevel.levelId);
  const authoredWaveChainIds = collectAuthoredWaveChainIds(project);
  const waveChainCanonicalizer = createWaveChainCanonicalizer(project);
  const waveChainOrdersByRoom = collectWaveChainOrdersByRoom(project, waveChainCanonicalizer);
  const builderMapPresentation = builderMapPresentationForProject(project.rooms);
  const mapPresentation = preferBuilderRuntimeOverSource ? builderMapPresentation : sourceLevel?.mapPresentation ?? builderMapPresentation;
  const roomEntryWaveIds = collectRoomEntryWaveIds(project);

  // Robots: hand-authored drafts still compile as one wave per room. Official
  // imports carry robot.wave metadata, so their wave id, trigger, spawn group,
  // reinforcements, and presentation survive a /build round-trip.
  const robotWaveGroups = new Map<string, BuilderRobotWaveGroup>();
  const explicitDoorRobotIds = new Set(project.doors.flatMap(builderDoorSurviveRobotIds));
  for (const robot of project.robots) {
    if (!sourceLevel && exitRoom && robot.roomId === exitRoom.id) continue;
    const room = roomsById.get(robot.roomId);
    if (!room) {
      issues.push({ path: `robots.${robot.id}`, message: "机器人引用了不存在的房间。" });
      continue;
    }
    const waveChain = waveChainCanonicalizer.metaForRobot(robot);
    const key = robotWaveGroupKey({ ...robot, waveChain }, explicitDoorRobotIds, roomEntryWaveIds, authoredWaveChainIds);
    const group = robotWaveGroups.get(key) ?? { roomId: robot.roomId, robots: [], wave: robot.wave, waveChain };
    group.robots.push(robot);
    if (!group.wave && robot.wave) group.wave = robot.wave;
    group.waveChain = mergeWaveChainMeta(group.waveChain, waveChain);
    robotWaveGroups.set(key, group);
  }
  const roomEntryPreludeWaveIds = useGeneratedProgression ? collectRoomEntryPreludeWaveIds(robotWaveGroups, authoredWaveChainIds, routeRobotTriggers) : new Map<string, string[]>();

  const upsertSpawnGroup = (group: SpawnGroupDefinition) => {
    const index = spawnGroups.findIndex((candidate) => candidate.id === group.id);
    if (index >= 0) spawnGroups[index] = group;
    else spawnGroups.push(group);
  };

  const waveChainMetas = new Map<string, BuilderWaveChainMeta>();
  const waveChainRoomIdByWaveId = new Map<string, string>();
  const compiledWaveIdByRobotId = new Map<string, string>();

  for (const [groupKey, { roomId, robots, wave: waveMeta, waveChain }] of robotWaveGroups) {
    const room = roomsById.get(roomId);
    if (!room) continue;
    const groupId = waveMeta?.spawnGroupId ?? `sg_${roomId}`;
    const groupLabel = waveMeta?.spawnGroupLabel ?? `${room.label} 内部`;
    const storedPositions = waveMeta?.spawnGroupPositions?.map((point): Vec3Tuple => [point[0], 0, point[1]]) ?? [];
    const placedPositions = robots
      .filter((robot) => robot.position)
      .map((robot): Vec3Tuple => {
        const [x, z] = robot.position as readonly [number, number];
        const margin = 0.6;
        return [
          Math.min(room.center[0] + room.size[0] / 2 - margin, Math.max(room.center[0] - room.size[0] / 2 + margin, x)),
          0,
          Math.min(room.center[1] + room.size[1] / 2 - margin, Math.max(room.center[1] - room.size[1] / 2 + margin, z)),
        ];
      });
    if (storedPositions.length > 0) {
      upsertSpawnGroup({
        id: groupId,
        label: groupLabel,
        layout: waveMeta?.spawnGroupLayout ?? "front",
        positions: storedPositions,
      });
    } else if (waveMeta?.spawnGroupCenter) {
      upsertSpawnGroup({
        id: groupId,
        label: groupLabel,
        layout: waveMeta.spawnGroupLayout ?? "around_ring",
        center: [waveMeta.spawnGroupCenter[0], 0, waveMeta.spawnGroupCenter[1]],
        ...(typeof waveMeta.spawnGroupRadius === "number" ? { radius: waveMeta.spawnGroupRadius } : {}),
        ...(typeof waveMeta.spawnGroupSpread === "number" ? { spread: waveMeta.spawnGroupSpread } : {}),
      });
    } else {
      upsertSpawnGroup({
        id: groupId,
        label: groupLabel,
        layout: "front",
        positions: placedPositions.length > 0 ? [...placedPositions, ...spawnPointsInRoom(room)] : spawnPointsInRoom(room),
      });
    }
    spawnSourceLabels[groupId] = groupLabel;
    const waveId = compiledWaveIdForRobotWaveGroup(groupKey, { roomId, wave: waveMeta, waveChain });
    for (const robot of robots) compiledWaveIdByRobotId.set(robot.id, waveId);
    if (waveChain) {
      waveChainMetas.set(waveId, { ...waveChain, waveId });
      waveChainRoomIdByWaveId.set(waveId, roomId);
    }
    const routeTrigger = routeRobotTriggers.get(roomId);
    const enemies = robots.filter((robot) => robot.wave?.role !== "reinforcement");
    const reinforcements = robots.filter((robot) => robot.wave?.role === "reinforcement");
    const enemyRobots = enemies.length > 0 ? enemies : robots;
    const roomPreludeWaveIndex = roomEntryPreludeWaveIds.get(roomId)?.indexOf(waveId) ?? -1;
    const chainWaitsForPreviousWave = Boolean(
      waveChain &&
      (
        hasPreviousWaveChainInRoom(waveChainOrdersByRoom, roomId, waveChain.order) ||
        (isFirstWaveChainInRoom(waveChainOrdersByRoom, roomId, waveChain.order) && roomEntryPreludeWaveIds.has(roomId))
      ),
    );
    const preludeWaitsForPreviousPrelude = roomPreludeWaveIndex > 0;
    const trigger = routeTrigger
      ? { type: "switch_activated" as const, id: routeTrigger.switchId, optionId: routeTrigger.stateId, delay: 0.35 }
      : chainWaitsForPreviousWave || preludeWaitsForPreviousPrelude
        ? undefined
        : waveChain
          ? { type: "room_entered" as const, id: roomId, delay: 0.4 }
          : {
              type: waveMeta?.triggerType ?? ("room_entered" as const),
              id: waveMeta?.triggerId ?? roomId,
              ...(waveMeta?.triggerOptionId ? { optionId: waveMeta.triggerOptionId } : {}),
              delay: waveMeta?.triggerDelay ?? 0.4,
            };
    const interruptsActiveWave = waveMeta?.interruptsActiveWave ?? (trigger?.type === "room_entered");
    waves.push({
      id: waveId,
      startDelay: waveMeta?.startDelay ?? 0,
      roomId,
      ...(trigger ? { trigger } : {}),
      enemies: enemyRobots.map((robot) => robotSpawnDefinition(robot, groupId)),
      ...(reinforcements.length > 0
        ? {
            reinforcements: reinforcements.map((robot) => ({
              ...robotSpawnDefinition(robot, groupId),
              startsAfter: robot.wave?.reinforcement?.startsAfter ?? 8,
              every: robot.wave?.reinforcement?.every ?? 8,
              maxGroups: robot.wave?.reinforcement?.maxGroups ?? 1,
              ...(typeof robot.wave?.reinforcement?.maxAlive === "number" ? { maxAlive: robot.wave.reinforcement.maxAlive } : {}),
              ...(robot.wave?.reinforcement?.requiresEliteAlive ? { requiresEliteAlive: true } : {}),
              ...(robot.wave?.reinforcement?.endless ? { endless: true } : {}),
            })),
          }
        : {}),
      ...(interruptsActiveWave ? { interruptsActiveWave: true } : {}),
      ...(enemyRobots.some(isLeaderOrBossRobot) ? { completeWhenEliteDefeated: true } : {}),
      ...(waveMeta?.nonBlocking ? { nonBlocking: true } : {}),
      reward: waveMeta?.reward ?? "none",
      ...(waveMeta?.completionDialogueTrigger ? { completionDialogueTrigger: waveMeta.completionDialogueTrigger } : {}),
    });
    const label = waveChain?.label ?? waveMeta?.presentation?.label ?? waveMeta?.label ?? `${room.label} 清剿`;
    waveLabels[waveId] = label;
    wavePresentations.push(waveMeta?.presentation
      ? { ...waveMeta.presentation, id: waveId, label }
      : {
          id: waveId,
          label,
          objectiveTitle: `清剿 ${room.label}`,
          objectiveDetail: "击毁房间里的敌对单位。",
          startMessage: `${room.label} 的机器人被唤醒。`,
          startWarning: { label: "敌对单位", detail: `${room.label} 出现机器人` },
          startWarningDuration: 1.8,
        });
    if (waveChain?.pressureLoop?.enabled) {
      if (waveChain.order !== maxWaveChainOrderInRoom(waveChainOrdersByRoom, roomId)) {
        issues.push({ path: `robots.${robots[0]?.id}.waveChain.pressureLoop`, message: "只有最后一个波次可以开启压力循环。" });
      } else {
        const pressure = waveChain.pressureLoop;
        const pressureWaveId = pressureWaveIdFor(waveId);
        waves.push({
          id: pressureWaveId,
          startDelay: 0,
          roomId,
          nonBlocking: true,
          enemies: [{
            archetype: pressure.archetype,
            count: Math.max(1, Math.min(pressure.maxAlive, Math.round(pressure.count))),
            from: groupId,
          }],
          reward: "none",
        });
        const pressureLabel = `${label} 压力循环`;
        waveLabels[pressureWaveId] = pressureLabel;
        wavePresentations.push({
          id: pressureWaveId,
          label: pressureLabel,
          objectiveTitle: "压力循环",
          objectiveDetail: "持续出现的敌对单位不会阻塞门。",
          startMessage: "压力循环启动。",
          startWarning: { label: "压力循环", detail: "敌对单位继续出现" },
          startWarningDuration: 1.2,
        });
      }
    }
  }

  const puzzleRoomWaveObjectiveIds = useGeneratedProgression ? collectPuzzleRoomWaveObjectiveIds(project, waves) : new Map<string, string[]>();
  const toggleInverseDoorIds = new Set(
    (project.wallDoorSwitches ?? [])
      .filter((wallSwitch) => wallDoorSwitchMode(wallSwitch) === "toggle")
      .map((wallSwitch) => wallSwitch.inverseDoorId)
      .filter((doorId): doorId is string => Boolean(doorId)),
  );

  // Doors: geometry computed from the shared room edge so collision walls stay open.
  for (const door of project.doors) {
    const fromRoom = roomsById.get(door.fromRoomId);
    const toRoom = roomsById.get(door.toRoomId);
    if (!fromRoom || !toRoom) {
      issues.push({ path: `doors.${door.id}`, message: "门引用了不存在的房间。" });
      continue;
    }
    const edge = sharedEdge(fromRoom, toRoom);
    const sourceDoor = door.sourceDoor;
    const hasSourceDoorGeometry = Boolean(sourceDoor?.position && sourceDoor.size && typeof sourceDoor.yaw === "number");
    if (!edge && !hasSourceDoorGeometry) {
      issues.push({ path: `doors.${door.id}`, message: `「${fromRoom.label}」和「${toRoom.label}」没有足够长的共享边，无法放门。` });
      continue;
    }

    const routeControlledPlainDoor = door.lockType === "none" && routeSwitchOpenDoorIds.has(door.id);
    const locked = door.lockType !== "none" || routeControlledPlainDoor;
    // Curated generated-boundary door materials only (puzzle_purple_glass is a
    // puzzle-orb material and fails 校验 on doors).
    const lockedDoorMaterial =
      door.lockType === "survive_wave"
        ? "terminal_red"
        : door.lockType === "puzzle_complete" || door.lockType === "switch_state"
          ? "terminal_cyan"
          : "yellow_access_metal";
    const definition: LevelDoorDefinition = {
      id: door.id,
      label: builderDoorDisplayLabel(door, project),
      fromRoomId: door.fromRoomId,
      toRoomId: door.toRoomId,
      position: edge?.position ?? sourceDoor?.position ?? [fromRoom.center[0], 0, fromRoom.center[1]],
      size: edge ? doorSize : sourceDoor?.size ?? doorSize,
      yaw: edge?.yaw ?? sourceDoor?.yaw ?? 0,
      defaultState: toggleInverseDoorIds.has(door.id) && door.lockType === "none" && !routeControlledPlainDoor ? "open" : door.lockType === "switch_state" ? "closed" : locked ? "locked" : "closed",
      lock: { type: "none" },
      visualKey: locked ? "yellow_access_door" : "service_elevator_door",
      materialKey: locked ? lockedDoorMaterial : "service_elevator_metal",
      ...(edge?.panelPosition ? { panelPosition: edge.panelPosition } : sourceDoor?.panelPosition ? { panelPosition: sourceDoor.panelPosition } : {}),
      autoOpenOnApproach: !locked,
    };

    if (door.lockType === "key_item") {
      const explicitKey = keyPickupByDoorId.get(door.id);
      const grantingPuzzle = keyGrantPuzzleByDoorId.get(door.id);
      const sourceKey = explicitKey?.sourceKeyItem;
      const requestedKeyRoom = explicitKey ? roomsById.get(explicitKey.roomId) : roomsById.get(door.keyRoomId ?? "") ?? spawnRoom;
      const keyRoom = safeKeyRoomForDoor(door, requestedKeyRoom, fromRoom, spawnRoom, project.doors, roomsById);
      if (!keyRoom) continue;
      const keyId = explicitKey?.id ?? `key_${door.id}`;
      const canUseExplicitKeyPosition = Boolean(explicitKey && explicitKey.roomId === keyRoom.id);
      keyItems.push({
        id: keyId,
        label: sourceKey?.label ?? `${toRoom.label}${keyNoun}`,
        roomId: keyRoom.id,
        position: canUseExplicitKeyPosition
          ? [explicitKey!.position[0], sourceKey?.y ?? 0, explicitKey!.position[1]]
          : pointInRoom(keyRoom, -0.24, -0.24, keyItems.length),
        collectRadius: sourceKey?.collectRadius ?? 1.5,
        ...(sourceKey?.autoCollect !== undefined ? { autoCollect: sourceKey.autoCollect } : {}),
        visualKey: sourceKey?.visualKey ?? "large_yellow_key",
        materialKey: sourceKey?.materialKey ?? "access_card_gold",
        requiredForDoorIds: [door.id],
        ...(sourceKey?.requiresObjectiveId || grantingPuzzle
          ? { requiresObjectiveId: sourceKey?.requiresObjectiveId ?? puzzleGrantObjectiveId(grantingPuzzle?.id ?? "") }
          : {}),
        ...(grantingPuzzle && sourceKey?.autoCollect === undefined ? { autoCollect: false } : {}),
        ...(sourceKey?.dropFromArchetypeId ? { dropFromArchetypeId: sourceKey.dropFromArchetypeId } : {}),
        ...(sourceKey?.dialogueTrigger ? { dialogueTrigger: sourceKey.dialogueTrigger } : {}),
        rewardPulse: sourceKey?.rewardPulse ?? { label: keyNoun, detail: `${toRoom.label} 的门可以打开了`, rarity: "rare" },
        ...(sourceKey?.rewardPulseDuration !== undefined ? { rewardPulseDuration: sourceKey.rewardPulseDuration } : {}),
        ...(sourceKey?.audio ? { audio: sourceKey.audio } : {}),
      });
      definition.lock = {
        type: "key_item",
        keyItemId: keyId,
        lockedMessage: `缺少${keyNoun}。去「${keyRoom.label}」找找。`,
        unlockedMessage: "门禁确认，门已解锁。",
      };
    } else if (door.lockType === "survive_wave") {
      const selectedRobotIds = builderDoorSurviveRobotIds(door);
      const selectedRobots = selectedRobotIds.map((robotId) => project.robots.find((robot) => robot.id === robotId)).filter((robot): robot is BuilderRobotGroup => Boolean(robot));
      for (const robotId of selectedRobotIds) {
        if (!project.robots.some((robot) => robot.id === robotId)) {
          issues.push({ path: `doors.${door.id}.surviveRobotIds`, message: "清剿门绑定了不存在的守门机器人。" });
        }
      }
      const explicitWaveIds = selectedRobots.map((robot) => compiledWaveIdByRobotId.get(robot.id)).filter((id): id is string => Boolean(id));
      for (const selectedRobot of selectedRobots) {
        if (!compiledWaveIdByRobotId.get(selectedRobot.id)) {
          issues.push({ path: `doors.${door.id}.surviveRobotIds`, message: `「${builderRobotReadableLabel(selectedRobot)}」没有编译出可用波次。` });
        }
      }
      const waveChainIds = waveChainCanonicalizer.canonicalWaveIds;
      const authoredWaveIds = builderDoorWaveIds(door)
        .map((waveId) => waveChainCanonicalizer.idForDoorWave(waveId, door.fromRoomId))
        .filter((waveId) => selectedRobotIds.length === 0 || waveChainIds.has(waveId))
        .filter((waveId) => waves.some((wave) => wave.id === waveId));
      const waveIds = [...new Set([...explicitWaveIds, ...authoredWaveIds])];
      if (waveIds.length === 0) waveIds.push(builderWaveIdForRobotRoom(project, door.fromRoomId, waveChainCanonicalizer));
      if (waveIds.some((waveId) => !waves.some((wave) => wave.id === waveId))) {
        issues.push({ path: `doors.${door.id}`, message: `「${fromRoom.label}」需要先放至少一组机器人，清剿锁才有效。` });
      }
      const lockTargetLabel = selectedRobots.length > 0
        ? [...new Set(selectedRobots.map(builderRobotReadableLabel))].join("、")
        : fromRoom.label;
      definition.lock = {
        type: "survive_wave",
        waveId: waveIds[0],
        ...(waveIds.length > 1 ? { waveIds } : {}),
        lockedMessage: `清掉「${lockTargetLabel}」，门才会开。`,
        unlockedMessage: "威胁解除，门已解锁。",
      };
    } else if (door.lockType === "puzzle_complete") {
      // Author-placed puzzle instance (normalized above for legacy drafts).
      const instances = puzzleInstances(project).filter((instance) => instance.linkedDoorId === door.id && puzzleResultMode(instance) === "open_door");
      const compiledPuzzles = instances
        .map((instance) => ({
          instance,
          compiled: instance.kind === "color_sequence" ? compileColorPuzzle(instance, door, roomsById) : compile2DPuzzle(instance, door, roomsById),
        }))
        .filter((entry): entry is { instance: BuilderPuzzleInstance; compiled: NonNullable<ReturnType<typeof compileColorPuzzle>> } => Boolean(entry.compiled));
      if (instances.length === 0 || compiledPuzzles.length === 0) {
        // Detailed reasons already come from validateBuilderPuzzles.
        if (!validateBuilderPuzzles(project).some((issue) => instances.some((instance) => issue.path === `puzzles.${instance.id}`))) {
          issues.push({ path: `doors.${door.id}`, message: "这扇谜题门还没有可用的谜题——从谜题目录重新绑定一座。" });
        }
      } else {
        const requiredPuzzleIds = [
          ...new Set([
            ...(door.puzzleIds ?? []),
            ...compiledPuzzles.map(({ compiled }) => compiled.puzzle.id),
          ]),
        ];
        const requiresMultiplePuzzles = requiredPuzzleIds.length > 1;
        for (const { instance, compiled } of compiledPuzzles) {
          const routeRequirement = routePuzzleRequirements.get(instance.id);
          const requiredWaveObjectiveIds = puzzleRoomWaveObjectiveIds.get(instance.roomId) ?? [];
          const requiredObjectiveId = requiredWaveObjectiveIds[requiredWaveObjectiveIds.length - 1];
          const requiresArticleIds = compilePuzzleRequiredArticleIds(project, instance, issues);
          interactions.push({
            ...compiled.interaction,
            ...(routeRequirement ? { requiresSwitchState: routeRequirement } : {}),
            ...(requiredObjectiveId ? { requiresObjectiveId: requiredObjectiveId } : {}),
            ...(requiresArticleIds.length > 0 ? { requiresArticleIds } : {}),
          });
          // Solving any puzzle door, including the exit elevator door, should make
          // the slow-open readable in-world. Multi-puzzle locks still respect the
          // door lock so the first completed prerequisite cannot open the door early.
          const actions = [...(compiled.puzzle.success.actions ?? [])];
          appendPuzzleSuccessOutputActions(actions, instance, project, waveChainCanonicalizer, issues);
          const openActionIndex = actions.findIndex((action) => action.type === "open_door" && action.doorId === door.id);
          if (openActionIndex >= 0) {
            const openAction = actions[openActionIndex];
            if (requiresMultiplePuzzles && openAction.type === "open_door") actions[openActionIndex] = { ...openAction, respectLock: true };
          } else {
            actions.push({ type: "open_door", doorId: door.id, ...(requiresMultiplePuzzles ? { respectLock: true } : {}) });
          }
          if (!actions.some((action) => action.type === "focus_reveal" && action.reveal.kind === "door" && action.reveal.doorId === door.id)) {
            actions.push({ type: "focus_reveal", reveal: { kind: "door", doorId: door.id } });
          }
          compiled.puzzle.success = {
            ...compiled.puzzle.success,
            actions,
          };
          puzzles.push(compiled.puzzle);
        }
        const primary = compiledPuzzles[0].compiled;
        definition.lock = {
          type: "puzzle_complete",
          puzzleId: primary.puzzle.id,
          ...(requiredPuzzleIds.length > 1 ? { puzzleIds: requiredPuzzleIds } : {}),
          lockedMessage: primary.lockedMessage,
          unlockedMessage: primary.unlockedMessage,
        };
      }
    } else if (door.lockType === "switch_state") {
      const wallSwitch = (project.wallDoorSwitches ?? []).find((candidate) => candidate.id === door.wallDoorSwitchId);
      const states = wallSwitch ? effectiveWallDoorSwitchStates(wallSwitch) : [];
      const stateIndex = states.findIndex((state) => state.id === door.wallDoorSwitchStateId);
      const state = stateIndex >= 0 ? states[stateIndex] : null;
      if (!wallSwitch || !state) {
        issues.push({ path: `doors.${door.id}.wallDoorSwitchId`, message: "门控锁需要绑定一个墙面把手和目标状态。" });
      } else {
        definition.lock = {
          type: "switch_state",
          switchId: wallDoorSwitchDefinitionId(wallSwitch),
          stateId: wallDoorSwitchStateId(state.id, stateIndex),
          manualOpen: false,
          lockedMessage: `需要先把「${wallSwitch.label}」切到「${state.label}」。`,
          unlockedMessage: "门控状态确认，门已解锁。",
        };
      }
    } else if (routeControlledPlainDoor) {
      definition.lock = {
        type: "environment_state",
        environmentStateId: routeDoorLockStateId(door.id),
        lockedMessage: "需要对应的路由授权球。",
        unlockedMessage: "路由授权确认，门已解锁。",
      };
    }

    if (sourceDoor) {
      const source = sourceDoor;
      const sourceMayOverrideRuntimeState = (!preferBuilderRuntimeOverSource || door.lockType === "none") && !routeControlledPlainDoor;
      const sourceLockIsBuilderOutputGate =
        door.lockType === "none" &&
        outputOpenDoorIds.has(door.id) &&
        Boolean(source.lock?.type && outputDoorSourceLockTypes.has(source.lock.type));
      definition.label = source.label ?? definition.label;
      definition.position = source.position ?? definition.position;
      definition.size = source.size ?? definition.size;
      definition.yaw = source.yaw ?? definition.yaw;
      if (sourceMayOverrideRuntimeState) definition.defaultState = source.defaultState ?? definition.defaultState;
      if (!preferBuilderRuntimeOverSource && !useGeneratedProgression && !hasBuilderAuthoredDoorProgression(project, door)) {
        definition.lock = source.lock ?? definition.lock;
      } else if (sourceLockIsBuilderOutputGate) {
        definition.lock = source.lock ?? definition.lock;
      }
      definition.visualKey = source.visualKey ?? definition.visualKey;
      definition.materialKey = source.materialKey ?? definition.materialKey;
      definition.panelPosition = source.panelPosition ?? definition.panelPosition;
      if (sourceMayOverrideRuntimeState) definition.autoOpenOnApproach = source.autoOpenOnApproach ?? definition.autoOpenOnApproach;
      if (source.skinKey) definition.skinKey = source.skinKey;
      if (source.openSpeed !== undefined) definition.openSpeed = source.openSpeed;
      if (source.openVisualPolicy) definition.openVisualPolicy = source.openVisualPolicy;
      if (source.closedDialogueTrigger) definition.closedDialogueTrigger = source.closedDialogueTrigger;
      if (source.openedDialogueTrigger) definition.openedDialogueTrigger = source.openedDialogueTrigger;
      if (source.cameraImpact) definition.cameraImpact = source.cameraImpact;
    }

    // Author-picked premium door-art family (overrides the lock-driven default,
    // but the exit-room elevator override below still wins so the 闭馆电梯门
    // cinematic is never broken). "auto" keeps the lock-driven look.
    if (door.doorFamily && door.doorFamily !== "auto") {
      const family = builderDoorFamilyEntry(door.doorFamily);
      if (family.visualKey) definition.visualKey = family.visualKey;
      if (family.materialKey) definition.materialKey = family.materialKey;
      if (family.skinKey) definition.skinKey = family.skinKey;
    }

    // Old Level 3 service-elevator language: the door fronting the exit room
    // is the 闭馆电梯门 — brass/steel lift door that lifts slowly, with a
    // camera nudge and red→cyan lock lights driven by the elevator door kit.
    if (exitRoom && (door.toRoomId === exitRoom.id || door.fromRoomId === exitRoom.id)) {
      Object.assign(definition, officialExitDoorAnimationReference);
      definition.cameraImpact = { shake: 0.34, fovKick: 1.85 };
      exitDoorIds.push(definition.id);
    }

    doors.push(definition);
  }

  // Puzzle compilation happens per-door above; a leftover legacy
  // project.puzzle with no puzzle-locked door is simply ignored.
  compileKeyGrantPuzzles(project, roomsById, waveChainCanonicalizer, keyItems, interactions, puzzles, routePuzzleRequirements, issues);
  compileRouteSwitches(project, roomsById, waveChainCanonicalizer, keyNoun, keyItems, interactions, switches, issues);
  compileWallDoorSwitches(project, roomsById, interactions, switches, issues);
  appendWavePreludeEvents(events, waveChainMetas, waveChainRoomIdByWaveId, roomEntryPreludeWaveIds, waveChainOrdersByRoom);
  appendWaveChainEvents(events, waveChainMetas, waveChainRoomIdByWaveId, waveChainOrdersByRoom, project, issues);
  const pickups = compileMapPickups(project, roomsById, issues, exitRoom?.id);

  if (!spawnRoom || !exitRoom || issues.length > 0) {
    return { level: null, issues };
  }

  const exitDoorForCinematic = doors.find((door) => door.id === exitDoorIds[0]);
  const exitFrame = exitDoorForCinematic ? builderExitElevatorFrame(exitRoom, exitDoorForCinematic) : null;
  const exitPosition: Vec3Tuple = exitFrame ? builderExitElevatorPoint(exitFrame, 0, -0.1, 0) : [exitRoom.center[0], 0, exitRoom.center[1]];
  const exitInteractionPosition: Vec3Tuple = exitFrame ? builderExitElevatorCallButtonPosition(exitFrame, 0) : exitPosition;
  const hasSourceExitInteraction = Boolean(sourceLevel?.mapInteractions?.some((interaction) => interaction.type === "exit" && interaction.roomId === exitRoom.id));
  if (!hasSourceExitInteraction) {
    // Exit: interaction in the exit room; the lift unlocks when the player reaches the room.
    interactions.push({
      id: "use_builder_exit",
      type: "exit",
      roomId: exitRoom.id,
      position: exitInteractionPosition,
      radius: 2.2,
      // Service-elevator call panel, not a generic red exit poster; the panel
      // opens/associates with the elevator door fronting the exit room.
      visualKey: "service_elevator_panel",
      materialKey: "terminal_cyan",
      label: `进入${exitLabel}`,
      ...(exitDoorIds.length > 0 ? { opensDoorId: exitDoorIds[0] } : {}),
    });
    events.push({
      id: "builder_unlock_exit_on_enter",
      trigger: { type: "room_entered", id: exitRoom.id },
      once: true,
      actions: [{ type: "unlock_exit" }],
    });
  }

  const exitElevatorProps = exitDoorForCinematic ? compileBuilderExitElevatorProps(exitRoom, exitDoorForCinematic) : [];
  const exitButtonTargetPosition = exitFrame ? builderExitElevatorCallButtonPosition(exitFrame, 1.34) : null;
  const props = [...compileProps(project, roomsById, issues, exitRoom.id), ...exitElevatorProps];
  articles.push(...compileStoryArticles(project, roomsById, interactions, exitRoom.id));
  if (!useGeneratedProgression) {
    appendMissingById(interactions, sourceLevel?.mapInteractions);
    appendMissingById(puzzles, sourceLevel?.puzzles);
    appendMissingById(articles, sourceLevel?.articles);
    appendMissingById(switches, sourceLevel?.switches);
  }
  const criticalPath = roomPathBetween(spawnRoom.id, exitRoom.id, doors);
  if (!criticalPath) {
    issues.push({ path: "doors", message: "出生房间和出口房间之间没有门连通。" });
    return { level: null, issues };
  }
  const exitInteractionId = exitInteractionIdForObjective(interactions, exitRoom.id);
  const objectiveChain = buildObjectiveChain(project, doors, keyItems, waves, puzzles, criticalPath, exitLabel, exitInteractionId);
  const dialogues = sourceLevel?.dialogues ?? compileBuilderStoryDialogues(project, articles.length);
  const sourceEnvironmentStates = sourceLevel?.environmentStates ?? [];
  const sourceEnvironmentStateIds = new Set(sourceEnvironmentStates.map((state) => state.id));
  const routeDoorEnvironmentStates = project.doors
    .filter((door) =>
      door.lockType === "none" &&
      routeSwitchOpenDoorIds.has(door.id) &&
      !(door.sourceDoor?.lock?.type && outputDoorSourceLockTypes.has(door.sourceDoor.lock.type)) &&
      !sourceEnvironmentStateIds.has(routeDoorLockStateId(door.id)),
    )
    .map((door) => ({
      id: routeDoorLockStateId(door.id),
      label: `${builderDoorDisplayLabel(door, project)}路由授权`,
      glowColor: "#5ee8c8",
      opacity: 0.35,
    }));
  const environmentStates = [...sourceEnvironmentStates, ...routeDoorEnvironmentStates];

  const level: LevelDefinition = sanitizeDanglingObjectiveGates(sanitizeGeneratedLevelMaterialFamilies({
    id: builderLevelId(project),
    title: project.title.trim() || "玩家自制密室",
    authoringProfile: "generated",
    // Environment/lighting round-trip through metadata; Raw builder playtest
    // also consumes them to bake room surfaces and lighting into the local pack.
    authoringMetadata: {
      builderEnvironment: {
        lighting: projectLighting(project),
        rooms: Object.fromEntries(project.rooms.filter((room) => room.env).map((room) => [room.id, room.env])),
      },
      // Author-written story clue text on placed paintings/artifacts. Props
      // with story text also compile into article interactions for playtest.
      ...(project.props.some((prop) => prop.story)
        ? { builderStories: Object.fromEntries(project.props.filter((prop) => prop.story).map((prop) => [prop.id, prop.story])) }
        : {}),
      ...(project.story ? { builderStory: project.story } : {}),
      ...(routeSwitches.length > 0 ? { builderRouteSwitches: routeSwitches } : {}),
      ...(project.wallDoorSwitches?.length ? { builderWallDoorSwitches: project.wallDoorSwitches } : {}),
    },
    ...(articles.length > 0 ? { articles } : {}),
    spawnPoint: sourceLevel?.spawnPoint ?? [spawnRoom.center[0], 0, spawnRoom.center[1]],
    initialInventory: sourceLevel?.initialInventory ?? builderPlaytestInventory,
    initialWaveStartDelay: sourceLevel?.initialWaveStartDelay ?? 0,
    requiresStoryPickupsBeforeWaves: sourceLevel?.requiresStoryPickupsBeforeWaves ?? false,
    exit: sourceLevel?.exit ?? {
      id: "builder_exit",
      position: exitPosition,
      radius: 2.2,
      unlockedLabel: exitLabel,
      distanceLabel: exitLabel,
      unlockMessage: `${exitLabel}已通电。`,
      unlockDialogueTrigger: "builder_exit_unlocked",
      unlockWarning: { label: "出口已通电", detail: `${exitLabel}可以使用了` },
      ...(exitDoorForCinematic && exitButtonTargetPosition ? { cinematic: compileBuilderExitCinematic(exitRoom, exitDoorForCinematic, exitButtonTargetPosition, exitLabel) } : {}),
      transitionMessage: project.story?.transitionLine ?? "电梯下行。这间密室没有挽留你。",
      transitionDialogueTrigger: "builder_exit_transition",
      victoryMessage: project.story?.victoryLine ?? "离场记录：对象自行离开，房间保持原样。",
    },
    map: {
      id: sourceLevel?.mapId ?? `${builderLevelId(project)}_map`,
      schemaVersion: "hp.map.v1",
      ...(mapPresentation ? { presentation: mapPresentation } : {}),
      rooms: project.rooms.map((room) => compileRoom(room, room.id === exitRoom.id, exitDoorForCinematic, preferBuilderRuntimeOverSource)),
      doors,
      keyItems,
      interactions,
      ...(pickups.length > 0 ? { pickups } : {}),
      props,
      navigation: {
        criticalPathRoomIds: criticalPath,
        optionalRoomIds: project.rooms.map((room) => room.id).filter((id) => !criticalPath.includes(id)),
        maxBacktrackSeconds: 24,
        mobileReadableDoorCount: Math.max(2, criticalPath.length - 1),
      },
    },
    puzzles,
    ...(switches.length > 0 ? { switches } : {}),
    ...(sourceLevel?.bigScreens?.length ? { bigScreens: sourceLevel.bigScreens } : {}),
    objectiveChain: useGeneratedProgression ? objectiveChain : sourceLevel?.objectiveChain ?? objectiveChain,
    waves,
    events: useGeneratedProgression ? events : sourceLevel?.events ?? events,
    dialogues,
    spawnGroups,
    cinematicBeats: sourceLevel?.cinematicBeats ?? [],
    pickups: useGeneratedProgression ? campaignPickupRules : sourceLevel?.pickups ?? campaignPickupRules,
    economy: sourceLevel?.economy ?? campaignEconomy,
    revive: sourceLevel?.revive ?? campaignRevive,
    combatLimits: sourceLevel?.combatLimits ?? standardCombatLimits,
    ...(environmentStates.length > 0 ? { environmentStates } : {}),
    ...(sourceLevel?.bossPhases ? { bossPhases: sourceLevel.bossPhases } : {}),
    enemyDeathBeats: sourceLevel?.enemyDeathBeats ?? [],
    presentation: mergeBuilderPresentation(sourceLevel?.presentation, waveLabels, wavePresentations, spawnSourceLabels, project.story),
  }));

  return { level: normalizeLevelExitRoomReference(level), issues };
}

const generatedRoomSurfaceMaterialKeys = new Set([
  "maintenance_bay_wet_floor",
  "maintenance_bay_glass_wall",
  "sterile_lab_floor",
  "sterile_lab_wall",
  "hazard_hall_floor",
  "hazard_hall_wall",
  "red_exit_floor",
  "red_exit_wall",
  "residential_floor",
  "residential_wall",
  "museum_floor",
  "museum_wall",
]);

function materialForGeneratedFamily<T extends string | undefined>(materialKey: T, fallback: string): T | string {
  if (!materialKey || !generatedRoomSurfaceMaterialKeys.has(materialKey)) return materialKey;
  return fallback;
}

/**
 * Premium door families (residential/clinic/reclamation/industrial) deliberately
 * carry their wall surround material onto the door — so the door material
 * sanitizer must leave those doors alone (the wall keys are also in the door
 * allow-list). The elevator family keeps service_elevator_door, which the
 * sanitizer already maps to service_elevator_metal, so it is excluded here.
 */
const doorFamilyVisualKeys = new Set(
  builderDoorFamilies.filter((family) => family.visualKey && family.visualKey !== "service_elevator_door").map((family) => family.visualKey),
);

/**
 * Builder exports may load migration-era drafts whose generated level already
 * carried room surface materials onto doors, panels, keys or puzzle targets.
 * Keep the validator strict, but normalize those stale family mismatches before
 * the config is saved or playtest-baked.
 */
export function sanitizeGeneratedLevelMaterialFamilies(level: LevelDefinition): LevelDefinition {
  const map = level.map;
  if (!map) return level;

  let changed = false;
  const doors = map.doors.map((door) => {
    // Premium door families intentionally carry their wall surround material.
    if (door.visualKey && doorFamilyVisualKeys.has(door.visualKey)) return door;
    const materialKey = materialForGeneratedFamily(
      door.materialKey,
      door.skinKey === "service_elevator_hero" || door.visualKey === "service_elevator_door" ? "service_elevator_metal" : "terminal_cyan",
    );
    if (materialKey === door.materialKey) return door;
    changed = true;
    return { ...door, materialKey };
  });
  const keyItems = map.keyItems.map((item) => {
    const materialKey = materialForGeneratedFamily(item.materialKey, "access_card_gold");
    if (materialKey === item.materialKey) return item;
    changed = true;
    return { ...item, materialKey };
  });
  const interactions = map.interactions.map((interaction) => {
    const materialKey = materialForGeneratedFamily(interaction.materialKey, "terminal_cyan");
    if (materialKey === interaction.materialKey) return interaction;
    changed = true;
    return { ...interaction, materialKey };
  });

  const puzzles = level.puzzles?.map((puzzle) => {
    if (puzzle.type === "hit_sequence") {
      let puzzleChanged = false;
      const clue = puzzle.clue.surfaces
        ? {
            ...puzzle.clue,
            surfaces: puzzle.clue.surfaces.map((surface) => {
              const materialKey = materialForGeneratedFamily(surface.materialKey, "wall_digit_paint");
              if (materialKey === surface.materialKey) return surface;
              puzzleChanged = true;
              return { ...surface, materialKey };
            }),
          }
        : puzzle.clue;
      const targets = puzzle.targets.map((target) => {
        const materialKey = materialForGeneratedFamily(target.materialKey, `puzzle_${target.colorKey}_glass`);
        if (materialKey === target.materialKey) return target;
        puzzleChanged = true;
        return { ...target, materialKey };
      });
      if (!puzzleChanged) return puzzle;
      changed = true;
      return { ...puzzle, clue, targets };
    }
    if (puzzle.type === "code_lock") {
      let puzzleChanged = false;
      const clues = puzzle.clues.map((clue) => {
        const materialKey = materialForGeneratedFamily(clue.materialKey, "wall_digit_paint");
        if (materialKey === clue.materialKey) return clue;
        puzzleChanged = true;
        return { ...clue, materialKey };
      });
      if (!puzzleChanged) return puzzle;
      changed = true;
      return { ...puzzle, clues };
    }
    return puzzle;
  });

  const bigScreens = level.bigScreens?.map((screen) => {
    const materialKey = materialForGeneratedFamily(screen.materialKey, "terminal_cyan");
    if (materialKey === screen.materialKey) return screen;
    changed = true;
    return { ...screen, materialKey };
  });

  if (!changed) return level;
  return {
    ...level,
    map: {
      ...map,
      doors,
      keyItems,
      interactions,
    },
    ...(puzzles ? { puzzles } : {}),
    ...(bigScreens ? { bigScreens } : {}),
  };
}

function sanitizeDanglingObjectiveGates(level: LevelDefinition): LevelDefinition {
  const map = level.map;
  if (!map) return level;
  const objectiveIds = new Set((level.objectiveChain ?? []).map((objective) => objective.id));
  let changed = false;
  const keyItems = map.keyItems.map((item) => {
    if (!item.requiresObjectiveId || objectiveIds.has(item.requiresObjectiveId)) return item;
    const { requiresObjectiveId: _staleRequiresObjectiveId, ...rest } = item;
    changed = true;
    return rest;
  });
  const interactions = map.interactions.map((interaction) => {
    const next = { ...interaction };
    if (next.requiresObjectiveId && !objectiveIds.has(next.requiresObjectiveId)) {
      delete next.requiresObjectiveId;
      changed = true;
    }
    if (next.completesObjectiveId && !objectiveIds.has(next.completesObjectiveId)) {
      delete next.completesObjectiveId;
      changed = true;
    }
    return next;
  });
  const puzzles = level.puzzles?.map((puzzle) => {
    if (!puzzle.success.completesObjectiveId || objectiveIds.has(puzzle.success.completesObjectiveId)) return puzzle;
    const { completesObjectiveId: _staleCompletesObjectiveId, ...success } = puzzle.success;
    changed = true;
    return { ...puzzle, success };
  });
  return changed ? { ...level, map: { ...map, keyItems, interactions }, ...(puzzles ? { puzzles } : {}) } : level;
}

function compileRoom(room: BuilderRoom, isExit: boolean, exitDoor?: LevelDoorDefinition, preferBuilderRuntimeOverSource = false) {
  const style = roomStyleEntry(room.style);
  const source = room.sourceRoom;
  const officialSurface = officialSurfaceFieldsForBuilderRoom(room);
  if (isExit) {
    return createOfficialExitRoomReference({
      id: room.id,
      label: room.label,
      doorPosition: exitDoor?.position ?? [room.center[0], 0, room.center[1] + room.size[1] * 0.5],
      doorYaw: exitDoor?.yaw ?? 0,
    });
  }
  const size = [room.size[0], 4, room.size[1]] as Vec3Tuple;
  // Non-rect footprint: bake rotation into local points so the runtime never
  // needs a rotation field. The exit room always stays a rectangle.
  const shape = room.shape ? { points: rotatedLocalPoints(room.shape).map(([x, z]) => [x, z] as readonly [number, number]) } : undefined;
  return {
    id: room.id,
    label: room.label,
    bounds: {
      center: [room.center[0], 0, room.center[1]] as Vec3Tuple,
      size,
      ...(shape ? { shape } : {}),
    },
    mood: source?.mood ?? style.mood,
    ...(preferBuilderRuntimeOverSource
      ? officialSurface?.skinKey
        ? { skinKey: officialSurface.skinKey }
        : source?.skinKey
        ? { skinKey: source.skinKey }
        : {}
      : source?.skinKey
      ? { skinKey: source.skinKey }
      : officialSurface?.skinKey
      ? { skinKey: officialSurface.skinKey }
      : {}),
    floorMaterialKey: preferBuilderRuntimeOverSource
      ? officialSurface?.floorMaterialKey ?? source?.floorMaterialKey ?? style.floorMaterialKey
      : source?.floorMaterialKey ?? officialSurface?.floorMaterialKey ?? style.floorMaterialKey,
    wallMaterialKey: preferBuilderRuntimeOverSource
      ? officialSurface?.wallMaterialKey ?? source?.wallMaterialKey ?? style.wallMaterialKey
      : source?.wallMaterialKey ?? officialSurface?.wallMaterialKey ?? style.wallMaterialKey,
    ...(preferBuilderRuntimeOverSource && officialSurface?.aesthetic
      ? { aesthetic: officialSurface.aesthetic }
      : source?.aesthetic
      ? { aesthetic: source.aesthetic }
      : officialSurface?.aesthetic
      ? { aesthetic: officialSurface.aesthetic }
      : {}),
    ...(source?.ambientPressure !== undefined ? { ambientPressure: source.ambientPressure } : {}),
    ...(source?.entryDialogueTrigger ? { entryDialogueTrigger: source.entryDialogueTrigger } : {}),
    ...(source?.exitDialogueTrigger ? { exitDialogueTrigger: source.exitDialogueTrigger } : {}),
    geometry: {
      renderFloor: true,
      renderWalls: true,
      renderCeiling: true,
      collisionWalls: true,
      accentColor: style.accentColor,
      ...(source?.geometry ?? {}),
    },
  };
}

function validateBuilderRouteSwitches(project: BuilderProject): BuilderCompileIssue[] {
  const issues: BuilderCompileIssue[] = [];
  const roomIds = new Set(project.rooms.map((room) => room.id));
  const doorsById = new Map(project.doors.map((door) => [door.id, door]));
  const puzzlesById = new Map(puzzleInstances(project).map((instance) => [instance.id, instance]));
  const robotRoomIds = new Set(project.robots.map((robot) => robot.roomId));

  for (const route of project.routeSwitches ?? []) {
    if (!roomIds.has(route.roomId)) issues.push({ path: `routeSwitches.${route.id}.roomId`, message: "路由台所在房间不存在。" });
    if (!roomIds.has(route.keyRoomId)) issues.push({ path: `routeSwitches.${route.id}.keyRoomId`, message: "路由台钥匙房间不存在。" });
    if (route.outputs.length < 1 || route.outputs.length > 4) {
      issues.push({ path: `routeSwitches.${route.id}.outputs`, message: "路由台需要 1-4 个输出。" });
    }
    const seenOutputs = new Set<string>();
    route.outputs.forEach((output, index) => {
      if (seenOutputs.has(output.id)) {
        issues.push({ path: `routeSwitches.${route.id}.outputs.${output.id}`, message: "路由台输出 ID 重复。" });
      }
      seenOutputs.add(output.id);
      if (output.keyRoomId && !roomIds.has(output.keyRoomId)) {
        issues.push({ path: `routeSwitches.${route.id}.outputs.${index}.keyRoomId`, message: "路由台输出授权球房间不存在。" });
      }
      validateBuilderOutputTarget(output, `routeSwitches.${route.id}.outputs.${index}`, { roomIds, doorsById, puzzlesById, robotRoomIds }, issues);
    });
  }
  for (const instance of puzzleInstances(project)) {
    const seenOutputs = new Set<string>();
    (instance.successOutputs ?? []).forEach((output, index) => {
      if (seenOutputs.has(output.id)) {
        issues.push({ path: `puzzles.${instance.id}.successOutputs.${output.id}`, message: "谜题输出 ID 重复。" });
      }
      seenOutputs.add(output.id);
      validateBuilderOutputTarget(output, `puzzles.${instance.id}.successOutputs.${index}`, { roomIds, doorsById, puzzlesById, robotRoomIds }, issues);
    });
  }
  return issues;
}

function validateBuilderWallDoorSwitches(project: BuilderProject): BuilderCompileIssue[] {
  const issues: BuilderCompileIssue[] = [];
  const roomIds = new Set(project.rooms.map((room) => room.id));
  const doorsById = new Map(project.doors.map((door) => [door.id, door]));
  const switchesById = new Map((project.wallDoorSwitches ?? []).map((switchDef) => [switchDef.id, switchDef]));
  const wallSwitches = project.wallDoorSwitches ?? [];

  if (wallSwitches.length > MAX_WALL_DOOR_SWITCHES_PER_LEVEL) {
    issues.push({
      path: "wallDoorSwitches",
      message: `官卡墙面门控最多 ${MAX_WALL_DOOR_SWITCHES_PER_LEVEL} 个，当前有 ${wallSwitches.length} 个。`,
    });
  }

  for (const switchDef of wallSwitches) {
    const states = effectiveWallDoorSwitchStates(switchDef);
    if (!roomIds.has(switchDef.roomId)) {
      issues.push({ path: `wallDoorSwitches.${switchDef.id}.roomId`, message: "墙面门控所在房间不存在。" });
    }
    if (wallDoorSwitchMode(switchDef) === "toggle") {
      const primaryDoorId = primaryDoorIdForWallDoorSwitch(switchDef);
      if (!primaryDoorId || !doorsById.has(primaryDoorId)) {
        issues.push({ path: `wallDoorSwitches.${switchDef.id}.primaryDoorId`, message: "Toggle 墙面门控需要一扇有效主门。" });
      }
      if (switchDef.inverseDoorId && switchDef.inverseDoorId === primaryDoorId) {
        issues.push({ path: `wallDoorSwitches.${switchDef.id}.inverseDoorId`, message: "反向门不能和主门是同一扇。" });
      }
      if (switchDef.inverseDoorId && !doorsById.has(switchDef.inverseDoorId)) {
        issues.push({ path: `wallDoorSwitches.${switchDef.id}.inverseDoorId`, message: "反向门引用了不存在的门。" });
      }
    }
    if (states.length < 2) {
      issues.push({ path: `wallDoorSwitches.${switchDef.id}.states`, message: "墙面门控至少需要两个可切换状态。" });
    }
    if (states.length > 4) {
      issues.push({ path: `wallDoorSwitches.${switchDef.id}.states`, message: "墙面门控最多建议 4 个状态，避免玩家记不住。" });
    }
    if (switchDef.wallMount.offset < -1 || switchDef.wallMount.offset > 1) {
      issues.push({ path: `wallDoorSwitches.${switchDef.id}.wallMount.offset`, message: "墙面门控 offset 必须在 -1 到 1 之间。" });
    }
    const seenStates = new Set<string>();
    let controlledDoorCount = 0;
    states.forEach((state, index) => {
      if (seenStates.has(state.id)) {
        issues.push({ path: `wallDoorSwitches.${switchDef.id}.states.${state.id}`, message: "墙面门控状态 ID 重复。" });
      }
      seenStates.add(state.id);
      const referencedDoorIds = [...(state.openDoorIds ?? []), ...(state.closeDoorIds ?? [])];
      controlledDoorCount += referencedDoorIds.length;
      for (const doorId of referencedDoorIds) {
        if (!doorsById.has(doorId)) {
          issues.push({ path: `wallDoorSwitches.${switchDef.id}.states.${index}`, message: `门控状态引用了不存在的门：${doorId}。` });
        }
      }
    });
    if (controlledDoorCount === 0) {
      issues.push({ path: `wallDoorSwitches.${switchDef.id}.states`, message: "墙面门控至少要在一个状态里开或关一扇门。" });
    }
  }

  for (const door of project.doors) {
    const controllerIds = wallDoorSwitchControlIdsForDoor(project, door.id);
    if (controllerIds.length > MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR) {
      issues.push({
        path: `doors.${door.id}.wallDoorSwitchId`,
        message: `一扇门最多被 ${MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR} 个墙面门控控制；「${builderDoorDisplayLabel(door, project)}」当前被 ${controllerIds.length} 个控制。`,
      });
    }
  }

  for (const door of project.doors) {
    if (door.lockType !== "switch_state") continue;
    const switchDef = door.wallDoorSwitchId ? switchesById.get(door.wallDoorSwitchId) : null;
    if (!switchDef) {
      issues.push({ path: `doors.${door.id}.wallDoorSwitchId`, message: "switch_state 门需要绑定一个墙面门控。" });
      continue;
    }
    if (!door.wallDoorSwitchStateId || !effectiveWallDoorSwitchStates(switchDef).some((state) => state.id === door.wallDoorSwitchStateId)) {
      issues.push({ path: `doors.${door.id}.wallDoorSwitchStateId`, message: "switch_state 门需要绑定门控里的一个有效状态。" });
    }
  }
  return issues;
}

function validateBuilderOutputTarget(
  output: BuilderRouteSwitchOutput,
  path: string,
  refs: {
    roomIds: ReadonlySet<string>;
    doorsById: ReadonlyMap<string, BuilderDoor>;
    puzzlesById: ReadonlyMap<string, BuilderPuzzleInstance>;
    robotRoomIds: ReadonlySet<string>;
  },
  issues: BuilderCompileIssue[],
) {
  if (output.kind === "open_door") {
    const door = output.doorId ? refs.doorsById.get(output.doorId) : null;
    if (!door) issues.push({ path: `${path}.doorId`, message: "开门输出需要绑定一扇已存在的门。" });
    else if (!isRouteOpenDoorTargetAllowed(door)) {
      issues.push({ path: `${path}.doorId`, message: "开门输出需要绑定一扇已存在的门。" });
    }
  } else if (output.kind === "reveal_puzzle") {
    if (!output.puzzleId || !refs.puzzlesById.has(output.puzzleId)) {
      issues.push({ path: `${path}.puzzleId`, message: "谜题输出需要绑定一座已存在的谜题台。" });
    }
  } else if (output.kind === "start_robots") {
    if (!output.robotRoomId || !refs.roomIds.has(output.robotRoomId)) {
      issues.push({ path: `${path}.robotRoomId`, message: "机器人输出需要绑定一个已存在的房间。" });
    } else if (!refs.robotRoomIds.has(output.robotRoomId)) {
      issues.push({ path: `${path}.robotRoomId`, message: "机器人输出绑定的房间里还没有机器人。" });
    }
  }
}

function collectKeyGrantPuzzles(project: BuilderProject) {
  const grants = new Map<string, NonNullable<ReturnType<typeof puzzleInstances>[number]>>();
  for (const instance of puzzleInstances(project)) {
    if (puzzleResultMode(instance) !== "grant_key") continue;
    if (grants.has(instance.linkedDoorId)) continue;
    grants.set(instance.linkedDoorId, instance);
  }
  return grants;
}

function compileKeyGrantPuzzles(
  project: BuilderProject,
  roomsById: Map<string, BuilderRoom>,
  waveChainCanonicalizer: BuilderWaveChainCanonicalizer,
  keyItems: readonly LevelKeyItemDefinition[],
  interactions: LevelInteractionDefinition[],
  puzzles: LevelPuzzleDefinition[],
  routePuzzleRequirements: ReadonlyMap<string, { switchId: string; stateId: string }>,
  issues: BuilderCompileIssue[],
) {
  const doorsById = new Map(project.doors.map((door) => [door.id, door]));
  for (const instance of puzzleInstances(project)) {
    if (puzzleResultMode(instance) !== "grant_key") continue;
    const door = doorsById.get(instance.linkedDoorId);
    if (!door || door.lockType !== "key_item") continue;
    const keyItem = keyItems.find((item) => item.requiredForDoorIds.includes(door.id));
    if (!keyItem) {
      issues.push({ path: `puzzles.${instance.id}`, message: "授予钥匙的谜题找不到对应门禁片。" });
      continue;
    }
    const compiled = instance.kind === "color_sequence"
      ? compileColorPuzzle(instance, door, roomsById)
      : compile2DPuzzle(instance, door, roomsById);
    if (!compiled) continue;
    const routeRequirement = routePuzzleRequirements.get(instance.id);
    const requiresArticleIds = compilePuzzleRequiredArticleIds(project, instance, issues);
    interactions.push({
      ...compiled.interaction,
      ...(routeRequirement ? { requiresSwitchState: routeRequirement } : {}),
      ...(requiresArticleIds.length > 0 ? { requiresArticleIds } : {}),
    });
    const doorLabel = doorEndpointLabel(door, project);
    const existingActions = compiled.puzzle.success.actions ?? [];
    const actions = [...existingActions];
    appendPuzzleSuccessOutputActions(actions, instance, project, waveChainCanonicalizer, issues);
    if (!actions.some((action) => action.type === "grant_key_item" && action.keyItemId === keyItem.id)) {
      actions.push({ type: "grant_key_item", keyItemId: keyItem.id });
    }
    if (!actions.some((action) => action.type === "open_door" && action.doorId === door.id)) {
      actions.push({ type: "open_door", doorId: door.id });
    }
    if (!actions.some((action) => action.type === "focus_reveal" && action.reveal.kind === "door" && action.reveal.doorId === door.id)) {
      actions.push({ type: "focus_reveal", reveal: { kind: "door", doorId: door.id } });
    }
    compiled.puzzle.success = {
      ...compiled.puzzle.success,
      opensDoorId: undefined,
      unlocksDoorId: undefined,
      rewardPulse: compiled.puzzle.success.rewardPulse ?? { label: "门禁片授权", detail: `${doorLabel} 可以打开了`, rarity: "epic" },
      actions,
    };
    puzzles.push(compiled.puzzle);
  }
}

function collectBuilderKeyPickups(
  project: BuilderProject,
  roomsById: Map<string, BuilderRoom>,
  issues: BuilderCompileIssue[],
): Map<string, BuilderPickup> {
  const doorsById = new Map(project.doors.map((door) => [door.id, door]));
  const keyPickupByDoorId = new Map<string, BuilderPickup>();
  for (const pickup of project.pickups ?? []) {
    if (pickup.kind !== "key_item") continue;
    const room = roomsById.get(pickup.roomId);
    if (!room) {
      issues.push({ path: `pickups.${pickup.id}`, message: "解除钥所在房间已被删除——拖回任意房间，或删除它。" });
      continue;
    }
    const door = pickup.linkedDoorId ? doorsById.get(pickup.linkedDoorId) : null;
    if (!door || door.lockType !== "key_item") {
      issues.push({ path: `pickups.${pickup.id}`, message: "解除钥必须绑定一扇钥匙门——选中它，在右侧选择钥匙门。" });
      continue;
    }
    if (pickup.grantedByPuzzleId && !puzzleInstances(project).some((instance) => instance.id === pickup.grantedByPuzzleId)) {
      issues.push({ path: `pickups.${pickup.id}`, message: "这把解除钥绑定的授予谜题已被删除——改为地面拾取，或重新选择谜题。" });
      continue;
    }
    if (keyPickupByDoorId.has(door.id)) {
      issues.push({ path: `pickups.${pickup.id}`, message: "同一扇钥匙门只能绑定一把解除钥。" });
      continue;
    }
    keyPickupByDoorId.set(door.id, pickup);
  }
  return keyPickupByDoorId;
}

function compileMapPickups(
  project: BuilderProject,
  roomsById: Map<string, BuilderRoom>,
  issues: BuilderCompileIssue[],
  replacedExitRoomId?: string,
): LevelMapPickupDefinition[] {
  const pickups: LevelMapPickupDefinition[] = [];
  for (const pickup of project.pickups ?? []) {
    if (pickup.kind === "key_item") continue;
    if (pickup.roomId === replacedExitRoomId) continue;
    const room = roomsById.get(pickup.roomId);
    if (!room) {
      issues.push({ path: `pickups.${pickup.id}`, message: "拾取物所在房间已被删除——拖回任意房间，或删除它。" });
      continue;
    }
    pickups.push({
      id: pickup.id,
      type: pickup.kind,
      roomId: room.id,
      position: [pickup.position[0], 0, pickup.position[1]],
      label: pickupEntry(pickup.kind).label,
    });
  }
  return pickups;
}

function compileBuilderExitCinematic(
  exitRoom: BuilderRoom,
  exitDoor: LevelDoorDefinition,
  buttonPanelPosition: Vec3Tuple,
  exitLabel: string,
) {
  const enterPosition = builderExitCinematicEnterPosition(exitRoom, exitDoor);
  return officialExitElevatorCinematic({
    enterPosition,
    lookAtPosition: buttonPanelPosition,
    faceYaw: builderExitCinematicFaceYaw(buttonPanelPosition, enterPosition),
    doorId: exitDoor.id,
    message: `${exitLabel}正在接管关卡切换。`,
  });
}

function builderExitCinematicEnterPosition(_exitRoom: BuilderRoom, exitDoor: LevelDoorDefinition): Vec3Tuple {
  return officialExitElevatorCinematicEnterPosition(exitDoor.position, exitDoor.yaw);
}

function builderExitCinematicFaceYaw(lookTarget: Vec3Tuple, enterPosition: Vec3Tuple) {
  return officialExitElevatorFaceYaw(lookTarget, enterPosition);
}

function compileBuilderExitElevatorProps(exitRoom: BuilderRoom, exitDoor: LevelDoorDefinition): LevelMapPropDefinition[] {
  return createOfficialExitElevatorReferenceProps({
    idPrefix: "builder_exit",
    roomId: exitRoom.id,
    doorPosition: exitDoor.position,
    doorYaw: exitDoor.yaw,
    tags: ["builder", "playtest"],
  });
}

function builderExitElevatorCallButtonPosition(frame: BuilderExitElevatorFrame, y: number): Vec3Tuple {
  return builderExitElevatorPoint(frame, 2.82, -0.7, y);
}

interface BuilderExitElevatorFrame {
  roomId: string;
  centerX: number;
  centerZ: number;
  rightX: number;
  rightZ: number;
  forwardX: number;
  forwardZ: number;
  yaw: number;
}

function builderExitElevatorFrame(exitRoom: BuilderRoom, exitDoor: LevelDoorDefinition): BuilderExitElevatorFrame {
  const [centerX, , centerZ] = officialExitRoomCenterForDoor(exitDoor.position, exitDoor.yaw);
  const doorDx = exitDoor.position[0] - centerX;
  const doorDz = exitDoor.position[2] - centerZ;
  const length = Math.hypot(doorDx, doorDz);
  const forwardX = length > 0.001 ? doorDx / length : Math.sin(exitDoor.yaw);
  const forwardZ = length > 0.001 ? doorDz / length : Math.cos(exitDoor.yaw);
  return {
    roomId: exitRoom.id,
    centerX,
    centerZ,
    rightX: forwardZ,
    rightZ: -forwardX,
    forwardX,
    forwardZ,
    yaw: Math.atan2(forwardX, forwardZ),
  };
}

function builderExitElevatorPoint(frame: BuilderExitElevatorFrame, rightOffset: number, forwardOffset: number, y: number): Vec3Tuple {
  return [
    frame.centerX + frame.rightX * rightOffset + frame.forwardX * forwardOffset,
    y,
    frame.centerZ + frame.rightZ * rightOffset + frame.forwardZ * forwardOffset,
  ];
}

const WALL_DOOR_SWITCH_INTERACTION_RADIUS = 2;

function compileRouteSwitches(
  project: BuilderProject,
  roomsById: Map<string, BuilderRoom>,
  waveChainCanonicalizer: BuilderWaveChainCanonicalizer,
  keyNoun: string,
  keyItems: LevelKeyItemDefinition[],
  interactions: LevelInteractionDefinition[],
  switches: LevelSwitchDefinition[],
  issues: BuilderCompileIssue[],
) {
  for (const route of project.routeSwitches ?? []) {
    const room = roomsById.get(route.roomId);
    const keyRoom = roomsById.get(route.keyRoomId);
    if (!room || !keyRoom || route.outputs.length === 0) continue;
    const switchId = routeSwitchDefinitionId(route);
    const interactionId = `${switchId}_panel`;
    const label = route.label.trim() || "管制路由台";
    const routePresentation = route.presentation ?? { kind: "route_console" as const, modelKey: "builder_route_switch_console" };
    const routePlacement = route.wallMount ? wallMountPlacementForRoom(room, route.wallMount) : null;
    const routeInteractionVisualKey =
      route.visualKey ?? (routePresentation.kind === "wall_button" || routePresentation.kind === "wall_lever" ? "wall_door_switch_button" : "direction_keypad_panel");
    const routeOutputKeyRoom = (output: BuilderRouteSwitchOutput) => roomsById.get(output.keyRoomId ?? route.keyRoomId) ?? keyRoom;
    const routeOutputKeyPosition = (output: BuilderRouteSwitchOutput, index: number): Vec3Tuple => {
      const outputKeyRoom = routeOutputKeyRoom(output);
      const offsets: readonly (readonly [number, number])[] = [[-0.34, -0.28], [0.34, -0.28], [-0.34, 0.28], [0.34, 0.28]];
      const offset = offsets[index] ?? [0, 0];
      if (output.keyPosition) {
        return [
          clamp(output.keyPosition[0], outputKeyRoom.center[0] - outputKeyRoom.size[0] / 2 + 0.8, outputKeyRoom.center[0] + outputKeyRoom.size[0] / 2 - 0.8),
          0,
          clamp(output.keyPosition[1], outputKeyRoom.center[1] - outputKeyRoom.size[1] / 2 + 0.8, outputKeyRoom.center[1] + outputKeyRoom.size[1] / 2 - 0.8),
        ];
      }
      if (route.keyPosition) {
        return [
          clamp(route.keyPosition[0] + offset[0], outputKeyRoom.center[0] - outputKeyRoom.size[0] / 2 + 0.8, outputKeyRoom.center[0] + outputKeyRoom.size[0] / 2 - 0.8),
          0,
          clamp(route.keyPosition[1] + offset[1], outputKeyRoom.center[1] - outputKeyRoom.size[1] / 2 + 0.8, outputKeyRoom.center[1] + outputKeyRoom.size[1] / 2 - 0.8),
        ];
      }
      return pointInRoom(outputKeyRoom, -0.28 + (index % 2) * 0.16, -0.24 + Math.floor(index / 2) * 0.16, keyItems.length + index);
    };

    route.outputs.slice(0, 4).forEach((output, index) => {
      const outputLabel = output.label?.trim() || routeOutputLabel(output, project);
      keyItems.push({
        id: routeOutputKeyItemId(route, output, index),
        label: `${outputLabel}授权球`,
        roomId: routeOutputKeyRoom(output).id,
        position: routeOutputKeyPosition(output, index),
        collectRadius: 1.35,
        visualKey: `route_output_orb_${index + 1}`,
        materialKey: "terminal_cyan",
        requiredForDoorIds: [],
        rewardPulse: { label: `${outputLabel}已授权`, detail: "路由输出可以切换", rarity: "rare" },
      });
    });

    interactions.push({
      id: interactionId,
      type: "switch",
      roomId: room.id,
      position: routePlacement ? ([...routePlacement.position] as Vec3Tuple) : [route.position[0], 0, route.position[1]],
      yaw: routePlacement?.yaw ?? route.rotationY,
      radius: 1.85,
      visualKey: routeInteractionVisualKey,
      materialKey: "terminal_cyan",
      label,
      rewardPulse: { label, detail: "输出已改接", rarity: "rare" },
    });

    switches.push({
      id: switchId,
      roomId: room.id,
      interactionId,
      label,
      initialStateId: "idle",
      oneShot: false,
      ...(route.wallMount
        ? {
            wallMount: {
              roomId: room.id,
              side: route.wallMount.side,
              offset: route.wallMount.offset,
              height: route.wallMount.height ?? 1.34,
              ...(route.wallMount.inset !== undefined ? { inset: route.wallMount.inset } : {}),
            },
          }
        : {}),
      presentation: routePresentation,
      states: [
        {
          id: "idle",
          label: "待机",
          message: `${label}回到待机。`,
          actions: [{ type: "set_message", message: `${label}回到待机。` }],
          rewardPulse: { label, detail: "输出待机", rarity: "story" },
          rewardPulseDuration: 0.9,
          cameraImpact: { shake: 0.08, fovKick: 0.35 },
        },
        ...route.outputs.slice(0, 4).map((output, index) => ({
          id: routeOutputStateId(output, index),
          label: output.label?.trim() || routeOutputLabel(output, project),
          message: routeOutputMessage(output, project),
          requiredKeyItemId: routeOutputKeyItemId(route, output, index),
          rewardPulse: { label: output.label?.trim() || routeOutputLabel(output, project), detail: "路由已改接", rarity: "rare" as const },
          rewardPulseDuration: 1.15,
          cameraImpact: { shake: 0.16, fovKick: 0.75 },
          actions: routeOutputActions(output, project, waveChainCanonicalizer, issues),
        })),
      ],
    });
  }
}

function compileWallDoorSwitches(
  project: BuilderProject,
  roomsById: Map<string, BuilderRoom>,
  interactions: LevelInteractionDefinition[],
  switches: LevelSwitchDefinition[],
  issues: BuilderCompileIssue[],
) {
  const doorsById = new Map(project.doors.map((door) => [door.id, door]));
  for (const switchDef of project.wallDoorSwitches ?? []) {
    const room = roomsById.get(switchDef.roomId);
    const states = effectiveWallDoorSwitchStates(switchDef);
    if (!room || states.length === 0) continue;
    const switchId = wallDoorSwitchDefinitionId(switchDef);
    const interactionId = wallDoorSwitchInteractionId(switchDef);
    const label = switchDef.label.trim() || "门控把手";
    const placement = wallMountPlacementForRoom(room, switchDef.wallMount);
    const initialSourceStateId = switchDef.initialStateId ?? states[0]?.id ?? "";
    const initialStateIndex = Math.max(0, states.findIndex((state) => state.id === initialSourceStateId));
    const mode = wallDoorSwitchMode(switchDef);
    const inverseDoorId = mode === "toggle" ? switchDef.inverseDoorId : undefined;
    const inverseDoor = inverseDoorId ? doorsById.get(inverseDoorId) : null;

    interactions.push({
      id: interactionId,
      type: "switch",
      roomId: room.id,
      position: [...placement.position] as Vec3Tuple,
      yaw: placement.yaw,
      radius: WALL_DOOR_SWITCH_INTERACTION_RADIUS,
      visualKey: "wall_door_switch_button",
      materialKey: "terminal_cyan",
      label,
      rewardPulse: { label, detail: "门控已响应", rarity: "rare" },
    });

    switches.push({
      id: switchId,
      roomId: room.id,
      interactionId,
      label,
      initialStateId: wallDoorSwitchStateId(states[initialStateIndex]?.id ?? states[0]?.id ?? "a", initialStateIndex),
      oneShot: switchDef.oneShot ?? false,
      cycling: { mode: "next", wrap: switchDef.oneShot ? false : true },
      wallMount: {
        roomId: room.id,
        side: switchDef.wallMount.side,
        offset: switchDef.wallMount.offset,
        height: switchDef.wallMount.height ?? 1.34,
        ...(switchDef.wallMount.inset !== undefined ? { inset: switchDef.wallMount.inset } : {}),
      },
      presentation: {
        kind: "wall_lever",
        modelKey: "hp_wall_door_switch_button_v1",
        handPose: "lever_push_down",
        hideWeapon: true,
        useDurationSec: 0.82,
        commitAtSec: 0.42,
        doorRevealSec: 2,
        revealMode: "door_front",
      },
      states: states.map((state, index) => {
        const actions: LevelRuntimeEventAction[] = [];
        for (const doorId of state.openDoorIds ?? []) {
          const door = doorsById.get(doorId);
          if (!door) {
            issues.push({ path: `wallDoorSwitches.${switchDef.id}.states.${index}.openDoorIds`, message: `门控引用了不存在的门：${doorId}。` });
            continue;
          }
          if (shouldRespectWallDoorSwitchStateLock(door, switchDef) || (doorId === inverseDoorId && shouldRespectInverseDoorProgressionLock(inverseDoor))) {
            actions.push({ type: "open_door", doorId, respectLock: true });
          } else {
            actions.push({ type: "unlock_door", doorId }, { type: "open_door", doorId });
          }
        }
        for (const doorId of state.closeDoorIds ?? []) {
          if (!doorsById.has(doorId)) {
            issues.push({ path: `wallDoorSwitches.${switchDef.id}.states.${index}.closeDoorIds`, message: `门控引用了不存在的门：${doorId}。` });
            continue;
          }
          actions.push({ type: "close_door", doorId, ...(doorId === inverseDoorId && shouldRespectInverseDoorProgressionLock(inverseDoor) ? { respectLock: true } : {}) });
        }
        if (actions.length === 0) actions.push({ type: "set_message", message: state.message ?? `${label}没有连接门。` });
        return {
          id: wallDoorSwitchStateId(state.id, index),
          label: state.label.trim() || `状态 ${index + 1}`,
          message: state.message ?? `${label}切到${state.label.trim() || `状态 ${index + 1}`}。`,
          rewardPulse: { label, detail: state.label.trim() || `状态 ${index + 1}`, rarity: "rare" as const },
          rewardPulseDuration: 0.95,
          cameraImpact: { shake: 0.12, fovKick: 0.55 },
          actions,
        };
      }),
    });
  }
}

function shouldRespectInverseDoorProgressionLock(door: BuilderDoor | null | undefined) {
  return door?.lockType === "key_item" || door?.lockType === "puzzle_complete" || door?.lockType === "survive_wave";
}

function shouldRespectWallDoorSwitchStateLock(door: BuilderDoor | null | undefined, switchDef: BuilderWallDoorSwitch) {
  return door?.lockType === "switch_state" && door.wallDoorSwitchId === switchDef.id;
}

function appendPuzzleSuccessOutputActions(
  actions: LevelRuntimeEventAction[],
  instance: BuilderPuzzleInstance,
  project: BuilderProject,
  waveChainCanonicalizer: BuilderWaveChainCanonicalizer,
  issues: BuilderCompileIssue[],
) {
  for (const output of instance.successOutputs ?? []) {
    actions.push(...routeOutputActions(output, project, waveChainCanonicalizer, issues, `puzzles.${instance.id}.successOutputs.${output.id}`));
  }
}

function routeOutputActions(
  output: BuilderRouteSwitchOutput,
  project: BuilderProject,
  waveChainCanonicalizer: BuilderWaveChainCanonicalizer,
  issues: BuilderCompileIssue[],
  issuePath = `routeSwitches.output.${output.id}`,
): LevelRuntimeEventAction[] {
  const actions: LevelRuntimeEventAction[] = [];
  if (output.kind === "open_door" && output.doorId) {
    const door = project.doors.find((candidate) => candidate.id === output.doorId);
    actions.push(...routeOpenDoorActions(door, output.doorId));
  } else if (output.kind === "start_robots" && output.robotRoomId) {
    // Start the wave just after the camera reaches the room so the player sees
    // the robots wake, then reveal the robot room.
    actions.push(
      { type: "start_wave", waveId: builderWaveIdForRobotRoom(project, output.robotRoomId, waveChainCanonicalizer), delay: 0.6 },
      { type: "focus_reveal", reveal: { kind: "robot", roomId: output.robotRoomId } },
    );
  } else if (output.kind === "reveal_puzzle" && output.puzzleId) {
    const puzzle = puzzleInstances(project).find((instance) => instance.id === output.puzzleId);
    // The terminal becomes usable via requiresSwitchState (set elsewhere); the
    // reveal resolves it from the firing switch state and frames it.
    actions.push(
      { type: "set_message", message: puzzle ? `${puzzleKindEntry(puzzle.kind).label}已接入。` : "谜题台已接入。" },
      { type: "focus_reveal", reveal: { kind: "puzzle" } },
    );
  } else {
    issues.push({ path: issuePath, message: "输出缺少目标。" });
  }
  return actions;
}

function mergeRuntimeEvents(
  sourceEvents: readonly LevelRuntimeEventDefinition[] | undefined,
  generatedEvents: readonly LevelRuntimeEventDefinition[],
) {
  if (!sourceEvents?.length) return generatedEvents;
  if (generatedEvents.length === 0) return sourceEvents;
  const merged = [...sourceEvents];
  const seenIds = new Set(sourceEvents.map((event) => event.id));
  for (const event of generatedEvents) {
    if (seenIds.has(event.id)) continue;
    seenIds.add(event.id);
    merged.push(event);
  }
  return merged;
}

function mergeBuilderPresentation(
  source: LevelPresentationConfig | undefined,
  waveLabels: Record<string, string>,
  wavePresentations: readonly WavePresentationDefinition[],
  spawnSourceLabels: Record<string, string>,
  story: BuilderProject["story"],
): LevelPresentationConfig {
  const generated: LevelPresentationConfig = {
    ...campaignPresentationBase,
    objectives: {
      ...campaignPresentationBase.objectives,
      exitUnlocked: { title: "进入出口", detail: "进电梯", progressLabel: "撤离", progressText: "走" },
    },
    flow: {
      ...campaignPresentationBase.flow,
      victory: {
        ...campaignPresentationBase.flow.victory,
        body: story?.victoryLine?.trim() || campaignPresentationBase.flow.victory.body,
      },
    },
    waveLabels,
    waves: wavePresentations,
    spawnSourceLabels,
  };
  if (!source) return generated;
  return {
    ...source,
    waveLabels: { ...source.waveLabels, ...waveLabels },
    waves: mergeWavePresentations(source.waves, wavePresentations),
    spawnSourceLabels: { ...source.spawnSourceLabels, ...spawnSourceLabels },
  };
}

function mergeWavePresentations(
  source: readonly WavePresentationDefinition[],
  generated: readonly WavePresentationDefinition[],
) {
  const merged = [...source];
  const seen = new Set(source.map((wave) => wave.id));
  for (const wave of generated) {
    if (seen.has(wave.id)) continue;
    seen.add(wave.id);
    merged.push(wave);
  }
  return merged;
}

function appendWavePreludeEvents(
  events: LevelRuntimeEventDefinition[],
  waveChainMetas: Map<string, BuilderWaveChainMeta>,
  waveChainRoomIdByWaveId: Map<string, string>,
  roomEntryPreludeWaveIds: Map<string, string[]>,
  waveChainOrdersByRoom: ReadonlyMap<string, readonly number[]>,
) {
  if (roomEntryPreludeWaveIds.size === 0) return;
  for (const preludeWaveIds of roomEntryPreludeWaveIds.values()) {
    for (let index = 1; index < preludeWaveIds.length; index += 1) {
      const previousWaveId = preludeWaveIds[index - 1];
      const waveId = preludeWaveIds[index];
      events.push({
        id: `builder_${safeConfigId(previousWaveId)}_to_${safeConfigId(waveId)}_prelude`,
        trigger: { type: "wave_completed", id: previousWaveId },
        once: true,
        actions: [{ type: "start_wave", waveId, delay: 0.45 }],
      });
    }
  }
  if (waveChainMetas.size === 0) return;
  for (const meta of waveChainMetas.values()) {
    const roomId = waveChainRoomIdByWaveId.get(meta.waveId);
    if (!roomId) continue;
    if (!isFirstWaveChainInRoom(waveChainOrdersByRoom, roomId, meta.order)) continue;
    const preludeWaveIds = roomEntryPreludeWaveIds.get(roomId);
    if (!preludeWaveIds?.length) continue;
    const preludeWaveId = preludeWaveIds[preludeWaveIds.length - 1];
    events.push({
      id: `builder_${safeConfigId(preludeWaveId)}_to_${safeConfigId(meta.waveId)}_complete`,
      trigger: { type: "wave_completed", id: preludeWaveId },
      once: true,
      actions: [{ type: "start_wave", waveId: meta.waveId, delay: 0.45 }],
    });
  }
}

function appendWaveChainEvents(
  events: LevelRuntimeEventDefinition[],
  waveChainMetas: Map<string, BuilderWaveChainMeta>,
  waveChainRoomIdByWaveId: Map<string, string>,
  waveChainOrdersByRoom: ReadonlyMap<string, readonly number[]>,
  project: BuilderProject,
  issues: BuilderCompileIssue[],
) {
  if (waveChainMetas.size === 0) return;
  const metasByRoom = new Map<string, BuilderWaveChainMeta[]>();
  for (const meta of waveChainMetas.values()) {
    const roomId = waveChainRoomIdByWaveId.get(meta.waveId);
    if (!roomId) continue;
    const current = metasByRoom.get(roomId) ?? [];
    current.push(meta);
    metasByRoom.set(roomId, current);
  }

  for (const [roomId, roomMetas] of metasByRoom) {
    const ordered = roomMetas.sort((left, right) => left.order - right.order || left.waveId.localeCompare(right.waveId));
    for (let index = 0; index < ordered.length; index += 1) {
      const meta = ordered[index];
      const actions: LevelRuntimeEventAction[] = [];
      const next = ordered.slice(index + 1).find((candidate) => candidate.order > meta.order);
      if (next) actions.push({ type: "start_wave", waveId: next.waveId, delay: 0.45 });

      for (const clearAction of meta.clearActions ?? []) {
        const door = project.doors.find((candidate) => candidate.id === clearAction.doorId);
        if (!door) {
          issues.push({ path: `waveChain.${meta.waveId}.clearActions`, message: `波次清场动作引用了不存在的门「${clearAction.doorId}」。` });
          continue;
        }
        if (clearAction.kind === "open_door") actions.push(...routeOpenDoorActions(door, clearAction.doorId));
        else actions.push({ type: "unlock_door", doorId: clearAction.doorId });
      }

      if (meta.pressureLoop?.enabled) {
        if (meta.order !== maxWaveChainOrderInRoom(waveChainOrdersByRoom, roomId)) {
          issues.push({ path: `waveChain.${meta.waveId}.pressureLoop`, message: "只有最后一个波次可以开启压力循环。" });
        } else {
          const pressureWaveId = pressureWaveIdFor(meta.waveId);
          actions.push({ type: "start_wave", waveId: pressureWaveId, delay: Math.max(0, meta.pressureLoop.startsAfter) });
          events.push({
            id: `builder_${safeConfigId(pressureWaveId)}_repeat`,
            trigger: { type: "wave_completed", id: pressureWaveId },
            actions: [{ type: "start_wave", waveId: pressureWaveId, delay: meta.pressureLoop.every, repeat: true }],
          });
        }
      }

      if (actions.length === 0) continue;
      events.push({
        id: `builder_${safeConfigId(meta.waveId)}_complete`,
        trigger: { type: "wave_completed", id: meta.waveId },
        once: true,
        actions,
      });
    }
  }
}

function routeOutputLabel(output: BuilderRouteSwitchOutput, project: BuilderProject) {
  if (output.kind === "open_door") {
    const door = project.doors.find((candidate) => candidate.id === output.doorId);
    if (door) return `开启${doorEndpointLabel(door, project)}`;
    return "开门输出";
  }
  if (output.kind === "reveal_puzzle") {
    const puzzle = puzzleInstances(project).find((candidate) => candidate.id === output.puzzleId);
    return puzzle ? `接入${puzzleKindEntry(puzzle.kind).label}` : "接入谜题";
  }
  const room = project.rooms.find((candidate) => candidate.id === output.robotRoomId);
  return room ? `唤醒${room.label}` : "唤醒机器人";
}

function routeOutputMessage(output: BuilderRouteSwitchOutput, project: BuilderProject) {
  if (output.kind === "open_door") return `${routeOutputLabel(output, project)}：门禁已放行。`;
  if (output.kind === "reveal_puzzle") return `${routeOutputLabel(output, project)}：台面亮起。`;
  return `${routeOutputLabel(output, project)}：房间内的机器人醒了。`;
}

function doorEndpointLabel(door: { fromRoomId: string; toRoomId: string }, project: BuilderProject) {
  return builderDoorDisplayLabel(door, project);
}

function compileProps(
  project: BuilderProject,
  roomsById: Map<string, BuilderRoom>,
  issues: BuilderCompileIssue[],
  replacedExitRoomId?: string,
): LevelMapPropDefinition[] {
  const props: LevelMapPropDefinition[] = [];
  for (const prop of project.props) {
    if (prop.roomId === replacedExitRoomId) continue;
    const entry = propEntry(prop.modelKey);
    const room = roomsById.get(prop.roomId);
    if ((!entry && !isEnvironmentModelKey(prop.modelKey)) || !room) {
      issues.push({ path: `props.${prop.id}`, message: "道具引用了不存在的模型或房间。" });
      continue;
    }
    const scale = clamp(prop.scale, 0.5, 2);
    const runtimeScale = prop.sourceProp?.scale ?? scale;
    const elevation = prop.sourceProp?.y ?? prop.elevation ?? defaultPropElevation(prop.modelKey);
    const wallPlacement = entry?.mount === "wall"
      ? wallMountedPropPlacementForEntryFromPoint(room, prop.position[0], prop.position[1], {
          height: elevation,
          scale,
          sizeMeters: entry.sizeMeters,
          wallMountFace: entry.wallMountFace,
        })
      : null;
    const runtimePosition: Vec3Tuple = wallPlacement
      ? [wallPlacement.position[0], wallPlacement.position[1], wallPlacement.position[2]]
      : [prop.position[0], elevation, prop.position[1]];
    const rotationY = wallPlacement?.yaw ?? prop.rotationY;
    const sourceCollider = prop.sourceProp?.collider;
    const generatedCollider =
      !sourceCollider && entry?.solid
        ? {
            halfSize: [
              Math.max(0.08, (entry.sizeMeters[0] * scale) / 2),
              Math.max(0.08, (entry.sizeMeters[1] * scale) / 2),
              Math.max(0.08, (entry.sizeMeters[2] * scale) / 2),
            ] as Vec3Tuple,
          }
        : undefined;
    props.push({
      id: prop.id,
      roomId: prop.roomId,
      modelKey: prop.modelKey,
      position: runtimePosition,
      rotation: [0, rotationY, 0],
      scale: runtimeScale,
      label: prop.sourceProp?.label ?? entry?.label ?? prop.modelKey,
      ...(prop.sourceProp?.tags ? { tags: prop.sourceProp.tags } : {}),
      ...(prop.sourceProp?.initiallyVisible !== undefined ? { initiallyVisible: prop.sourceProp.initiallyVisible } : {}),
      ...(sourceCollider || generatedCollider ? { collider: sourceCollider ?? generatedCollider } : {}),
    });
  }
  return props;
}

/** Default wall-article copy for readable murals when no story is authored. */
function defaultMuralArticleBody(modelKey: string): string {
  if (modelKey.includes("human_origin")) return "人类起源展区。编号仍亮，注释缺页。";
  if (modelKey.includes("robot_worker")) return "服务机器人曾被登记为临时劳工。没有人回来更正。";
  if (modelKey.includes("protocol_diagram")) return "协议完整：保留声音、动作和求生反应。发起人缺失。";
  if (modelKey.includes("last_human")) return "最后的人类记录停在同一天。后来只剩协议更新。";
  if (modelKey.includes("l4_story_awakened_machine")) return "诊疗床只保存醒来的声音，没有保存醒来前的人。";
  if (modelKey.includes("l4_story_preserved_childhood")) return "玩具、鞋和门口光线被切成片段。对象会把它们拼成童年。";
  if (modelKey.includes("l4_story_rescue_loop")) return "画面每次都停在伸手的一秒。系统反复确认：对象会救人。";
  if (modelKey.includes("l4_story_h0_discharge")) return "出院门亮起时，系统没有删除这些片段，只把它们标为随行。";
  return "馆藏壁画。画面没有说明，只有编号仍在亮。";
}

function isDefaultReadableMural(modelKey: string): boolean {
  return modelKey.startsWith("age_museum_wall_art_") || modelKey.startsWith("l4_story_");
}

function safeStoryToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function storyArticleIdForProp(prop: Pick<BuilderProp, "id" | "modelKey">): string {
  return `article_${safeStoryToken(prop.modelKey)}_${safeStoryToken(prop.id)}`;
}

function storyInteractionIdForProp(prop: Pick<BuilderProp, "id">): string {
  return `story_${safeStoryToken(prop.id)}`;
}

function propCompilesToStoryArticle(prop: BuilderProp): boolean {
  const title = prop.story?.title?.trim();
  const clue = prop.story?.clue?.trim();
  const hint = prop.story?.hint?.trim();
  return Boolean(title || clue || hint || isDefaultReadableMural(prop.modelKey));
}

function compilePuzzleRequiredArticleIds(
  project: BuilderProject,
  instance: BuilderPuzzleInstance,
  issues: BuilderCompileIssue[],
): string[] {
  const propIds = [...new Set(instance.requiredStoryPropIds ?? [])];
  const articleIds: string[] = [];
  for (const propId of propIds) {
    const prop = project.props.find((candidate) => candidate.id === propId);
    if (!prop || !propCompilesToStoryArticle(prop)) {
      issues.push({ path: `puzzles.${instance.id}.requiredStoryPropIds`, message: "谜题前置需要绑定一幅已放置、可阅读的故事画。" });
      continue;
    }
    articleIds.push(storyArticleIdForProp(prop));
  }
  return articleIds;
}

function compileStoryArticles(
  project: BuilderProject,
  roomsById: Map<string, BuilderRoom>,
  interactions: LevelInteractionDefinition[],
  replacedExitRoomId?: string,
): LevelArticleDefinition[] {
  const articles: LevelArticleDefinition[] = [];
  for (const prop of project.props) {
    if (prop.roomId === replacedExitRoomId) continue;
    const entry = propEntry(prop.modelKey);
    const room = roomsById.get(prop.roomId);
    if (!entry || !room) continue;
    const title = prop.story?.title?.trim();
    const clue = prop.story?.clue?.trim();
    const hint = prop.story?.hint?.trim();
    // Murals default to a readable wall article even with no authored story, so
    // E always opens a 2D article (like the museum exhibits). The overlay picks
    // the matching art automatically from the article id (contains the modelKey).
    const isMural = isDefaultReadableMural(prop.modelKey);
    if (!title && !clue && !hint && !isMural) continue;

    const label = title || entry.label;
    const interactionId = storyInteractionIdForProp(prop);
    const articleId = storyArticleIdForProp(prop);
    const scale = clamp(prop.scale, 0.5, 2);
    interactions.push({
      id: interactionId,
      type: "article",
      roomId: prop.roomId,
      position: [prop.position[0], 0, prop.position[1]],
      radius: Math.max(1.45, Math.min(2.35, 1.1 + entry.sizeMeters[0] * scale * 0.35)),
      visualKey: "none",
      materialKey: "terminal_cyan",
      anchorPropId: prop.id,
      label,
    });
    articles.push({
      id: articleId,
      roomId: prop.roomId,
      interactionId,
      systemLabel: "墙面档案",
      title: label,
      pages: [
        { id: "record", body: clue || hint || (isMural ? defaultMuralArticleBody(prop.modelKey) : "画面没有说明，只有编号仍在亮。") },
        ...(hint && hint !== clue ? [{ id: "note", body: hint }] : []),
      ],
      readReward: { label: "墙面档案", detail: `${label} 已读取`, rarity: "story" },
      readRewardDuration: 1.35,
    });
  }
  return articles;
}

function compileBuilderStoryDialogues(
  project: BuilderProject,
  articleCount: number,
): LevelDefinition["dialogues"] {
  if (articleCount > 0) return [];
  const line = project.story?.victoryLine?.trim();
  if (!line) return [];
  return [
    {
      id: `${project.projectId}_story_start_01`,
      trigger: "level_start",
      speaker: "房间广播",
      line,
      tone: "reveal",
      duration: Math.max(2.4, Math.min(3.4, line.length / 10)),
    },
  ];
}

export interface DoorEdge {
  position: Vec3Tuple;
  yaw: number;
  panelPosition: Vec3Tuple;
}

/** Finds the shared boundary between two rooms; door needs ~3.4m of overlap. */
export function sharedEdge(a: BuilderRoom, b: BuilderRoom): DoorEdge | null {
  // Rect↔rect keeps the exact legacy result (yaw ∈ {0, π/2}); any shaped room
  // routes through the polygon-edge solver, which reproduces the rect answer too.
  if (!a.shape && !b.shape) return sharedEdgeRect(a, b);
  return sharedEdgePolygon(a, b);
}

/**
 * Polygon-edge door solver: finds the longest pair of near-collinear,
 * overlapping edges between two footprints and centers a door on the overlap.
 * Door yaw = the edge tangent, so the door visibly rotates to follow angled or
 * curved (N-gon-approximated) walls. Works for convex and concave footprints.
 */
function sharedEdgePolygon(a: BuilderRoom, b: BuilderRoom): DoorEdge | null {
  const tolerance = 0.18;
  const minOverlap = doorWidth + 0.2;
  const edgesA = polygonEdges(roomWorldPolygon(a));
  const edgesB = polygonEdges(roomWorldPolygon(b));
  const centroidA = polygonCentroid(roomWorldPolygon(a));

  let best: { length: number; midX: number; midZ: number; yaw: number } | null = null;

  for (const ea of edgesA) {
    for (const eb of edgesB) {
      // Parallel? (cross of unit directions near zero, either orientation)
      const cross = ea.dir[0] * eb.dir[1] - ea.dir[1] * eb.dir[0];
      if (Math.abs(cross) > 0.08) continue;
      // Perpendicular gap between the two edge lines (project eb endpoints onto ea normal).
      const nx = -ea.dir[1];
      const nz = ea.dir[0];
      const gap0 = (eb.a[0] - ea.a[0]) * nx + (eb.a[1] - ea.a[1]) * nz;
      const gap1 = (eb.b[0] - ea.a[0]) * nx + (eb.b[1] - ea.a[1]) * nz;
      if (Math.abs(gap0) > tolerance || Math.abs(gap1) > tolerance) continue;
      // 1D overlap of both segments projected onto ea's direction.
      const ta0 = 0;
      const ta1 = ea.length;
      const tb0 = (eb.a[0] - ea.a[0]) * ea.dir[0] + (eb.a[1] - ea.a[1]) * ea.dir[1];
      const tb1 = (eb.b[0] - ea.a[0]) * ea.dir[0] + (eb.b[1] - ea.a[1]) * ea.dir[1];
      const lo = Math.max(ta0, Math.min(tb0, tb1));
      const hi = Math.min(ta1, Math.max(tb0, tb1));
      const overlap = hi - lo;
      if (overlap < minOverlap) continue;
      if (best && overlap <= best.length) continue;
      const tMid = (lo + hi) / 2;
      // Center the door on the midline between the two near-collinear edges.
      const midX = ea.a[0] + ea.dir[0] * tMid + (nx * (gap0 + gap1)) / 4;
      const midZ = ea.a[1] + ea.dir[1] * tMid + (nz * (gap0 + gap1)) / 4;
      best = { length: overlap, midX, midZ, yaw: Math.atan2(ea.dir[1], ea.dir[0]) };
    }
  }

  if (!best) return null;
  // Unlock console: nudge along the wall, then inward toward room A's interior.
  const tangentX = Math.cos(best.yaw);
  const tangentZ = Math.sin(best.yaw);
  let inwardX = -tangentZ;
  let inwardZ = tangentX;
  if ((centroidA[0] - best.midX) * inwardX + (centroidA[1] - best.midZ) * inwardZ < 0) {
    inwardX = -inwardX;
    inwardZ = -inwardZ;
  }
  return {
    position: [best.midX, 0, best.midZ],
    yaw: best.yaw,
    panelPosition: [
      best.midX + tangentX * (doorWidth / 2 + 0.18) + inwardX * 0.35,
      0,
      best.midZ + tangentZ * (doorWidth / 2 + 0.18) + inwardZ * 0.35,
    ],
  };
}

function sharedEdgeRect(a: BuilderRoom, b: BuilderRoom): DoorEdge | null {
  const tolerance = 0.6;
  const minOverlap = doorWidth + 0.2;

  const ax0 = a.center[0] - a.size[0] / 2;
  const ax1 = a.center[0] + a.size[0] / 2;
  const az0 = a.center[1] - a.size[1] / 2;
  const az1 = a.center[1] + a.size[1] / 2;
  const bx0 = b.center[0] - b.size[0] / 2;
  const bx1 = b.center[0] + b.size[0] / 2;
  const bz0 = b.center[1] - b.size[1] / 2;
  const bz1 = b.center[1] + b.size[1] / 2;

  const xOverlap = Math.min(ax1, bx1) - Math.max(ax0, bx0);
  const zOverlap = Math.min(az1, bz1) - Math.max(az0, bz0);

  // North/south shared edge (door wall runs along x, yaw 0).
  if (xOverlap >= minOverlap) {
    const boundary = Math.abs(az0 - bz1) <= tolerance ? (az0 + bz1) / 2 : Math.abs(az1 - bz0) <= tolerance ? (az1 + bz0) / 2 : null;
    if (boundary !== null) {
      const x = (Math.max(ax0, bx0) + Math.min(ax1, bx1)) / 2;
      return {
        position: [x, 0, boundary],
        yaw: 0,
        panelPosition: [x + doorWidth / 2 + 0.18, 0, boundary + 0.35],
      };
    }
  }

  // East/west shared edge (door wall runs along z, yaw 90°).
  if (zOverlap >= minOverlap) {
    const boundary = Math.abs(ax0 - bx1) <= tolerance ? (ax0 + bx1) / 2 : Math.abs(ax1 - bx0) <= tolerance ? (ax1 + bx0) / 2 : null;
    if (boundary !== null) {
      const z = (Math.max(az0, bz0) + Math.min(az1, bz1)) / 2;
      return {
        position: [boundary, 0, z],
        yaw: Math.PI / 2,
        panelPosition: [boundary + 0.35, 0, z + doorWidth / 2 + 0.18],
      };
    }
  }

  return null;
}

function spawnPointsInRoom(room: BuilderRoom): Vec3Tuple[] {
  const [cx, cz] = room.center;
  const dx = Math.max(0.8, room.size[0] * 0.28);
  const dz = Math.max(0.8, room.size[1] * 0.28);
  if (!room.shape) {
    return [
      [cx - dx, 0, cz - dz],
      [cx + dx, 0, cz - dz],
      [cx - dx, 0, cz + dz],
      [cx + dx, 0, cz + dz],
    ];
  }
  // Shaped rooms: keep only candidate quadrant points that fall inside the
  // footprint, then top up with the centroid so a small/odd shape still spawns.
  const polygon = roomWorldPolygon(room);
  const centroid = polygonCentroid(polygon);
  const candidates: Vec2[] = [
    [cx - dx, cz - dz],
    [cx + dx, cz - dz],
    [cx - dx, cz + dz],
    [cx + dx, cz + dz],
    centroid,
  ];
  const inside = candidates.filter((point) => pointInPolygon(polygon, point[0], point[1]));
  const chosen = inside.length > 0 ? inside : [centroid];
  return chosen.map((point) => [point[0], 0, point[1]] as Vec3Tuple);
}

function pointInRoom(room: BuilderRoom, fx: number, fz: number, index: number): Vec3Tuple {
  const x = room.center[0] + room.size[0] * fx + (index % 3) * 0.9;
  const z = room.center[1] + room.size[1] * fz;
  return [
    clamp(x, room.center[0] - room.size[0] / 2 + 0.8, room.center[0] + room.size[0] / 2 - 0.8),
    0,
    clamp(z, room.center[1] - room.size[1] / 2 + 0.8, room.center[1] + room.size[1] / 2 - 0.8),
  ];
}

function safeKeyRoomForDoor(
  door: BuilderDoor,
  requestedKeyRoom: BuilderRoom | undefined,
  fromRoom: BuilderRoom,
  spawnRoom: BuilderRoom | undefined,
  doors: readonly BuilderDoor[],
  roomsById: Map<string, BuilderRoom>,
): BuilderRoom | undefined {
  const startRoomId = spawnRoom?.id ?? fromRoom.id;
  const reachableBeforeDoor = reachableBuilderRooms(startRoomId, doors, door.id);
  if (requestedKeyRoom && reachableBeforeDoor.has(requestedKeyRoom.id)) return requestedKeyRoom;
  const configuredKeyRoom = door.keyRoomId ? roomsById.get(door.keyRoomId) : undefined;
  if (configuredKeyRoom && reachableBeforeDoor.has(configuredKeyRoom.id)) return configuredKeyRoom;
  if (reachableBeforeDoor.has(fromRoom.id)) return fromRoom;
  if (spawnRoom && reachableBeforeDoor.has(spawnRoom.id)) return spawnRoom;
  return requestedKeyRoom ?? configuredKeyRoom ?? fromRoom ?? spawnRoom;
}

function reachableBuilderRooms(startRoomId: string, doors: readonly BuilderDoor[], excludedDoorId?: string) {
  const visited = new Set<string>([startRoomId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const door of doors) {
      if (door.id === excludedDoorId) continue;
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

function roomPathBetween(startRoomId: string, exitRoomId: string, doors: readonly LevelDoorDefinition[]) {
  const queue: string[][] = [[startRoomId]];
  const visited = new Set([startRoomId]);
  while (queue.length > 0) {
    const path = queue.shift() as string[];
    const current = path[path.length - 1];
    if (current === exitRoomId) return path;
    for (const door of doors) {
      const next = door.fromRoomId === current ? door.toRoomId : door.toRoomId === current ? door.fromRoomId : null;
      if (!next || visited.has(next)) continue;
      visited.add(next);
      queue.push([...path, next]);
    }
  }
  return null;
}

function buildObjectiveChain(
  project: BuilderProject,
  doors: readonly LevelDoorDefinition[],
  keyItems: readonly LevelKeyItemDefinition[],
  waves: readonly WaveDefinition[],
  puzzles: readonly LevelPuzzleDefinition[],
  criticalPath: readonly string[],
  exitLabel = "撤离电梯",
  exitInteractionId = "use_builder_exit",
): LevelObjectiveDefinition[] {
  const roomOrder = new Map(criticalPath.map((roomId, index) => [roomId, index]));
  const roomLabel = (roomId: string) => project.rooms.find((room) => room.id === roomId)?.label ?? roomId;
  const lockedDoors = doors
    .filter((door) => door.lock.type !== "none")
    .sort((a, b) => doorOrder(a, roomOrder) - doorOrder(b, roomOrder));
  const coveredWaveIds = new Set(lockedDoors.flatMap((door) => (door.lock.type === "survive_wave" ? doorSurviveWaveIds(door.lock) : [])));
  const appendedRoomWaveIds = new Set<string>();
  const roomEnteredWaves = new Map<string, WaveDefinition[]>();
  for (const wave of waves) {
    if (wave.trigger?.type !== "room_entered" || !wave.trigger.id) continue;
    const current = roomEnteredWaves.get(wave.trigger.id) ?? [];
    current.push(wave);
    roomEnteredWaves.set(wave.trigger.id, current);
  }

  const steps: Omit<LevelObjectiveDefinition, "startsWhen" | "nextObjectiveId">[] = [];
  const appendRouteSwitchObjectiveSteps = () => {
    const existingIds = new Set(steps.map((step) => step.id));
    for (const route of project.routeSwitches ?? []) {
      const switchId = routeSwitchDefinitionId(route);
      route.outputs.slice(0, 4).forEach((output, index) => {
        if (output.kind !== "open_door" || !output.doorId) return;
        const sourceLock = project.doors.find((door) => door.id === output.doorId)?.sourceDoor?.lock;
        if (sourceLock?.type !== "objective_complete" || !sourceLock.objectiveId || existingIds.has(sourceLock.objectiveId)) return;
        const label = output.label?.trim() || routeOutputLabel(output, project);
        steps.push({
          id: sourceLock.objectiveId,
          type: "custom",
          title: label,
          detail: routeOutputMessage(output, project),
          requiredIds: [switchId],
          completesWhen: { type: "switch_activated", id: switchId, optionId: routeOutputStateId(output, index) },
          hudLabel: "路由",
          guidance: { targetType: "door", targetId: output.doorId, label, detail: "切换路由后门禁会解除", urgency: "exit" },
        });
        existingIds.add(sourceLock.objectiveId);
      });
    }
  };
  const appendRoomWaveSteps = (roomId: string) => {
    for (const wave of roomEnteredWaves.get(roomId) ?? []) {
      if (coveredWaveIds.has(wave.id) || appendedRoomWaveIds.has(wave.id)) continue;
      appendedRoomWaveIds.add(wave.id);
      steps.push({
        id: roomWaveObjectiveId(wave.id),
        type: "survive_wave",
        title: `清剿「${roomLabel(roomId)}」`,
        detail: "击毁房间里的机器人，再继续操作。",
        requiredIds: [wave.id],
        completesWhen: { type: "wave_completed", id: wave.id },
        hudLabel: "清剿",
        guidance: { targetType: "wave", targetId: wave.id, label: roomLabel(roomId), detail: "先清掉房间威胁", urgency: "danger" },
      });
    }
  };

  for (const door of lockedDoors) {
    if (door.lock.type === "key_item" && door.lock.keyItemId) {
      const key = keyItems.find((item) => item.id === door.lock.keyItemId);
      const grantingPuzzle = key ? puzzleGrantingKey(puzzles, key.id) : null;
      if (grantingPuzzle) {
        const kindEntry = puzzleKindEntry(
          grantingPuzzle.type === "hit_sequence"
            ? "color_sequence"
            : grantingPuzzle.type === "tool_calibration"
              ? "circuit_grid"
              : grantingPuzzle.type === "code_lock" ||
                  grantingPuzzle.type === "circuit_grid" ||
                  grantingPuzzle.type === "surveillance_match" ||
                  grantingPuzzle.type === "valve_matrix" ||
                  grantingPuzzle.type === "archive_merge" ||
                  grantingPuzzle.type === "gallery_reading"
                ? grantingPuzzle.type
                : "color_sequence",
        );
        steps.push({
          id: puzzleGrantObjectiveId(grantingPuzzle.id),
          type: "custom",
          title: kindEntry.objectiveTitle,
          detail: grantingPuzzle.type === "hit_sequence" ? kindEntry.objectiveDetail : `在「${roomLabel(grantingPuzzle.roomId)}」的谜题台：${kindEntry.objectiveDetail}`,
          requiredIds: [grantingPuzzle.id],
          completesWhen: { type: "puzzle_completed", id: grantingPuzzle.id },
          hudLabel: kindEntry.label,
        });
      } else {
        steps.push({
          id: `obj_collect_${door.id}`,
          type: "collect_key",
          title: `找到${key?.label ?? "门禁片"}`,
          detail: `在「${roomLabel(key?.roomId ?? "")}」找到它。`,
          requiredIds: [door.lock.keyItemId],
          completesWhen: { type: "key_collected", id: door.lock.keyItemId },
          hudLabel: "钥匙",
        });
      }
    } else if (door.lock.type === "survive_wave" && (door.lock.waveId || door.lock.waveIds?.length)) {
      appendRoomWaveSteps(door.fromRoomId);
      const requiredWaveIds = [...new Set([...(door.lock.waveIds ?? []), ...(door.lock.waveId ? [door.lock.waveId] : [])])];
      const requiredWaves = requiredWaveIds.map((waveId) => waves.find((candidate) => candidate.id === waveId)).filter((wave): wave is WaveDefinition => Boolean(wave));
      if (requiredWaves.length > 0) {
        const finalWave = requiredWaves[requiredWaves.length - 1];
        steps.push({
          id: `obj_survive_${door.id}`,
          type: "survive_wave",
          title: `清剿「${roomLabel(door.fromRoomId)}」`,
          detail: "击毁房间里的机器人，门才会解锁。",
          requiredIds: requiredWaves.map((wave) => wave.id),
          completesWhen: { type: "wave_completed", id: finalWave.id },
          hudLabel: "清剿",
          guidance: { targetType: "wave", targetId: finalWave.id, label: roomLabel(door.fromRoomId), detail: "清掉门锁波次", urgency: "danger" },
        });
      }
    } else if (door.lock.type === "puzzle_complete" && door.lock.puzzleId) {
      const puzzle = puzzles.find((candidate) => candidate.id === door.lock.puzzleId);
      if (puzzle) {
        appendRoomWaveSteps(puzzle.roomId);
        const kindEntry = puzzleKindEntry(
          puzzle.type === "hit_sequence"
            ? "color_sequence"
            : puzzle.type === "tool_calibration"
              ? "circuit_grid"
              : puzzle.type === "circuit_grid" ||
                  puzzle.type === "surveillance_match" ||
                  puzzle.type === "valve_matrix" ||
                  puzzle.type === "archive_merge" ||
                  puzzle.type === "gallery_reading"
                ? puzzle.type
                : "color_sequence",
        );
        steps.push({
          id: `obj_puzzle_${door.id}`,
          type: "custom",
          title: kindEntry.objectiveTitle,
          detail: puzzle.type === "hit_sequence" ? kindEntry.objectiveDetail : `在「${roomLabel(puzzle.roomId)}」的谜题台：${kindEntry.objectiveDetail}`,
          requiredIds: [puzzle.id],
          completesWhen: { type: "puzzle_completed", id: puzzle.id },
          hudLabel: kindEntry.label,
        });
      }
    }
    steps.push({
      id: `obj_open_${door.id}`,
      type: "open_door",
      title: `打开 ${door.label}`,
      detail: "靠近门并打开它。",
      requiredIds: [door.id],
      completesWhen: { type: "door_opened", id: door.id },
      hudLabel: "开门",
    });
  }

  appendRouteSwitchObjectiveSteps();

  steps.push({
    id: "obj_reach_exit",
    type: "reach_exit",
    title: `进入${exitLabel}`,
    detail: "抵达出口，启动它。",
    requiredIds: [exitInteractionId],
    completesWhen: { type: "interaction_completed", id: exitInteractionId },
    hudLabel: "撤离",
  });

  return steps.map((step, index) => ({
    ...step,
    startsWhen: index === 0 ? { type: "level_start" } : { type: "objective_completed", id: steps[index - 1].id },
    ...(index < steps.length - 1 ? { nextObjectiveId: steps[index + 1].id } : {}),
  }));
}

function exitInteractionIdForObjective(interactions: readonly LevelInteractionDefinition[], exitRoomId: string) {
  return interactions.find((interaction) => interaction.type === "exit" && interaction.roomId === exitRoomId)?.id ?? "use_builder_exit";
}

function roomWaveObjectiveId(waveId: string) {
  return `obj_survive_${safeConfigId(waveId)}`;
}

function doorSurviveWaveIds(lock: Pick<DoorLockDefinition, "waveId" | "waveIds">) {
  return [...new Set([...(lock.waveIds ?? []), ...(lock.waveId ? [lock.waveId] : [])])];
}

function collectPuzzleRoomWaveObjectiveIds(project: BuilderProject, waves: readonly WaveDefinition[]) {
  const puzzleRoomIds = new Set(puzzleInstances(project).map((instance) => instance.roomId));
  const byRoom = new Map<string, string[]>();
  for (const wave of waves) {
    if (wave.trigger?.type !== "room_entered" || !wave.trigger.id || !puzzleRoomIds.has(wave.trigger.id)) continue;
    const current = byRoom.get(wave.trigger.id) ?? [];
    current.push(roomWaveObjectiveId(wave.id));
    byRoom.set(wave.trigger.id, current);
  }
  return byRoom;
}

function puzzleGrantingKey(puzzles: readonly LevelPuzzleDefinition[], keyItemId: string) {
  return puzzles.find((puzzle) => puzzle.success.actions?.some((action) => action.type === "grant_key_item" && action.keyItemId === keyItemId)) ?? null;
}

function appendMissingById<T extends { id: string }>(target: T[], source: readonly T[] | undefined) {
  if (!source?.length) return;
  const existing = new Set(target.map((entry) => entry.id));
  for (const entry of source) {
    if (existing.has(entry.id)) continue;
    target.push(entry);
    existing.add(entry.id);
  }
}

function doorOrder(door: LevelDoorDefinition, roomOrder: Map<string, number>) {
  const from = roomOrder.get(door.fromRoomId);
  const to = roomOrder.get(door.toRoomId);
  if (from === undefined && to === undefined) return 999;
  return Math.max(from ?? -1, to ?? -1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
