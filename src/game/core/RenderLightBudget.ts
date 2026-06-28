import {
  resolveRoomRelativePosition,
  type RoomLightingDefinition,
  type RoomLightingFloorGlowDefinition,
  type RoomLightingPointDefinition,
  type RoomLightingSpotDefinition,
  type RoomLightingAreaDefinition,
} from "../config/RoomPresentationRegistry";
import type { LevelDoorDefinition, LevelMapConfig, Vec3Tuple } from "../config/schema/levelConfig";
import type { GameWorld } from "./GameWorld";
import { isRoomAdjacentToCurrent, isRoomRenderVisible } from "./RenderVisibility";

export interface SelectedRenderLight {
  light: RoomLightingDefinition;
  canCastShadow: boolean;
  score: number;
}

interface RankedRenderLight {
  light: RoomLightingDefinition;
  order: number;
  score: number;
}

const doorByIdCache = new WeakMap<LevelMapConfig, Map<string, LevelDoorDefinition>>();

export function selectRenderLights(
  lights: readonly RoomLightingDefinition[],
  map: LevelMapConfig,
  world: GameWorld,
): SelectedRenderLight[] {
  const dynamicLimit = Math.max(0, world.renderPerformance.quality.dynamicLightLimit);
  const floorGlowLimit = Math.max(0, world.renderPerformance.quality.floorGlowLimit);
  const shadowLimit = world.renderPerformance.quality.shadowsEnabled ? Math.max(0, world.renderPerformance.quality.shadowLightLimit) : 0;
  const rankedDynamic: RankedRenderLight[] = [];
  const rankedFloorGlow: RankedRenderLight[] = [];

  for (let order = 0; order < lights.length; order += 1) {
    const light = lights[order];
    if (!shouldRenderPresetLight(light, world)) continue;
    const score = scorePresetLight(light, map, world);
    if (light.type === "floor_glow") {
      insertRankedLight(rankedFloorGlow, light, order, score, floorGlowLimit);
    } else {
      insertRankedLight(rankedDynamic, light, order, score, dynamicLimit);
    }
  }

  const selected: SelectedRenderLight[] = [];
  let shadowCount = 0;
  for (const ranked of rankedDynamic) {
    const canCastShadow =
      shadowCount < shadowLimit &&
      ranked.light.type === "spot" &&
      Boolean(ranked.light.castShadow) &&
      shouldSpotLightCastGameplayShadow(ranked.light, world);
    if (canCastShadow) shadowCount += 1;
    selected.push({ light: ranked.light, score: ranked.score, canCastShadow });
  }
  for (const ranked of rankedFloorGlow) {
    selected.push({ light: ranked.light, score: ranked.score, canCastShadow: false });
  }
  return selected;
}

export function shouldRenderPresetLight(light: RoomLightingDefinition, world: GameWorld) {
  if (!light.roomId) return true;
  return isRoomRenderVisible(world, light.roomId);
}

export function shouldSpotLightCastGameplayShadow(light: RoomLightingSpotDefinition, world: GameWorld) {
  if (!world.renderPerformance.quality.shadowsEnabled || world.renderPerformance.quality.shadowLightLimit <= 0) return false;
  if (!light.roomId) return true;
  if (light.roomId === world.session.mapProgress.currentRoomId) return true;
  if (!light.doorId) return false;
  const door = world.level.map ? findRenderDoorById(world.level.map, light.doorId) : null;
  return Boolean(door && world.canOpenDoor(door));
}

export function resolveRenderLightPosition(
  map: LevelMapConfig,
  light: RoomLightingPointDefinition | RoomLightingSpotDefinition | RoomLightingAreaDefinition | RoomLightingFloorGlowDefinition,
): Vec3Tuple {
  if (light.position) return light.position;
  if (light.roomRelative) return resolveRoomRelativePosition(map, light.roomId, light.roomRelative);
  return [0, 0, 0];
}

function scorePresetLight(light: RoomLightingDefinition, map: LevelMapConfig, world: GameWorld) {
  const currentRoomId = world.session.mapProgress.currentRoomId;
  let score = 0;
  if (!light.roomId) score += 440;
  if (light.roomId && currentRoomId && light.roomId === currentRoomId) score += 1400;
  else if (isRoomAdjacentToCurrent(world, light.roomId)) score += 780;
  else if (isRoomRenderVisible(world, light.roomId)) score += 320;

  const door = light.doorId ? findRenderDoorById(map, light.doorId) : null;
  if (door) {
    if (door.fromRoomId === currentRoomId || door.toRoomId === currentRoomId) score += 260;
    if (world.canOpenDoor(door)) score += 190;
  }

  const position = resolveRenderLightPosition(map, light);
  const dx = position[0] - world.player.position.x;
  const dz = position[2] - world.player.position.z;
  score += Math.max(0, 420 - Math.sqrt(dx * dx + dz * dz) * 13);

  if (light.type === "spot") score += 130;
  if (light.type === "area") score += 90;
  if (light.type === "floor_glow") score += 50;
  score += light.type === "floor_glow" ? light.opacity * 120 : light.intensity * 80;
  return score;
}

export function findRenderDoorById(map: LevelMapConfig, doorId: string) {
  let doorById = doorByIdCache.get(map);
  if (!doorById) {
    doorById = new Map();
    for (const door of map.doors) {
      doorById.set(door.id, door);
    }
    doorByIdCache.set(map, doorById);
  }
  return doorById.get(doorId) ?? null;
}

function insertRankedLight(
  rankedLights: RankedRenderLight[],
  light: RoomLightingDefinition,
  order: number,
  score: number,
  limit: number,
) {
  if (limit <= 0) return;
  let insertAt = rankedLights.length;
  while (insertAt > 0 && shouldRankBefore(score, order, rankedLights[insertAt - 1])) {
    insertAt -= 1;
  }
  if (insertAt >= limit) return;
  rankedLights.splice(insertAt, 0, { light, order, score });
  if (rankedLights.length > limit) rankedLights.length = limit;
}

function shouldRankBefore(score: number, order: number, ranked: RankedRenderLight) {
  return score > ranked.score || (score === ranked.score && order < ranked.order);
}
