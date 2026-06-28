import { resolveRoomPresentation } from "../config/RoomPresentationRegistry";
import { createPropLocalLights } from "../config/PropLocalLightRegistry";
import type { GameWorld } from "./GameWorld";
import { selectRenderLights } from "./RenderLightBudget";
import { isDoorRenderVisible, isRoomRenderVisible } from "./RenderVisibility";

export interface RenderBudgetSnapshot {
  levelId: string;
  currentRoomId: string | null;
  frameIndex: number;
  qualityTier: string;
  frameMs: {
    last: number;
    average: number;
    p95: number;
    pressure: number;
  };
  limits: {
    dynamicLights: number;
    floorGlows: number;
    shadowLights: number;
    effects: number;
    projectiles: number;
    detailedSmallEnemies: number;
  };
  totals: {
    rooms: number;
    doors: number;
    props: number;
    decals: number;
    keyItems: number;
    interactions: number;
    bigScreens: number;
    puzzleMarkers: number;
    presetLights: number;
  };
  visible: {
    rooms: number;
    doors: number;
    props: number;
    decals: number;
    keyItems: number;
    interactions: number;
    bigScreens: number;
    puzzleMarkers: number;
    dynamicLights: number;
    floorGlows: number;
    shadowLights: number;
  };
  activeRuntime: {
    enemies: number;
    projectiles: number;
    visualProjectiles: number;
    effects: number;
    visualEffects: number;
    pickups: number;
    environmentStates: number;
  };
}

export function captureRenderBudgetSnapshot(world: GameWorld): RenderBudgetSnapshot {
  const quality = world.renderPerformance.quality;
  const map = world.level.map;
  const activeEnemies = countAliveEnemies(world);
  const activeProjectiles = world.projectiles.length;
  const activeEffects = world.effects.length;
  const activePickups = countActivePickups(world);
  const activeEnvironmentStates = world.session.mapProgress.activeEnvironmentStateIds.length;

  if (!map) {
    return {
      levelId: world.level.id,
      currentRoomId: null,
      frameIndex: world.frameIndex,
      qualityTier: quality.tier,
      frameMs: {
        last: world.renderPerformance.lastFrameMs,
        average: world.renderPerformance.averageFrameMs,
        p95: world.renderPerformance.frameTimeP95,
        pressure: world.renderPerformance.pressure,
      },
      limits: {
        dynamicLights: quality.dynamicLightLimit,
        floorGlows: quality.floorGlowLimit,
        shadowLights: quality.shadowLightLimit,
        effects: quality.effectPoolSize,
        projectiles: quality.projectilePoolSize,
        detailedSmallEnemies: quality.detailedSmallEnemyLimit,
      },
      totals: {
        rooms: 0,
        doors: 0,
        props: 0,
        decals: 0,
        keyItems: 0,
        interactions: 0,
        bigScreens: world.level.bigScreens?.length ?? 0,
        puzzleMarkers: totalPuzzleMarkers(world),
        presetLights: 0,
      },
      visible: {
        rooms: 0,
        doors: 0,
        props: 0,
        decals: 0,
        keyItems: 0,
        interactions: 0,
        bigScreens: 0,
        puzzleMarkers: 0,
        dynamicLights: 0,
        floorGlows: 0,
        shadowLights: 0,
      },
      activeRuntime: {
        enemies: activeEnemies,
        projectiles: activeProjectiles,
        visualProjectiles: Math.min(activeProjectiles, quality.projectilePoolSize),
        effects: activeEffects,
        visualEffects: Math.min(activeEffects, quality.effectPoolSize),
        pickups: activePickups,
        environmentStates: activeEnvironmentStates,
      },
    };
  }

  const presentation = resolveRoomPresentation(map);
  const configuredLights = [...(presentation?.lighting?.lights ?? []), ...createPropLocalLights(map)];
  const selectedLights = selectRenderLights(configuredLights, map, world);
  const visibleMapCounts = countVisibleMapEntities(world);
  const selectedLightCounts = countSelectedRenderLights(selectedLights);

  return {
    levelId: world.level.id,
    currentRoomId: world.session.mapProgress.currentRoomId ?? null,
    frameIndex: world.frameIndex,
    qualityTier: quality.tier,
    frameMs: {
      last: world.renderPerformance.lastFrameMs,
      average: world.renderPerformance.averageFrameMs,
      p95: world.renderPerformance.frameTimeP95,
      pressure: world.renderPerformance.pressure,
    },
    limits: {
      dynamicLights: quality.dynamicLightLimit,
      floorGlows: quality.floorGlowLimit,
      shadowLights: quality.shadowLightLimit,
      effects: quality.effectPoolSize,
      projectiles: quality.projectilePoolSize,
      detailedSmallEnemies: quality.detailedSmallEnemyLimit,
    },
    totals: {
      rooms: map.rooms.length,
      doors: map.doors.length,
      props: map.props?.length ?? 0,
      decals: map.decals?.length ?? 0,
      keyItems: map.keyItems.length,
      interactions: map.interactions.length,
      bigScreens: world.level.bigScreens?.length ?? 0,
      puzzleMarkers: totalPuzzleMarkers(world),
      presetLights: configuredLights.length,
    },
    visible: {
      rooms: visibleMapCounts.rooms,
      doors: visibleMapCounts.doors,
      props: visibleMapCounts.props,
      decals: visibleMapCounts.decals,
      keyItems: visibleMapCounts.keyItems,
      interactions: visibleMapCounts.interactions,
      bigScreens: visibleMapCounts.bigScreens,
      puzzleMarkers: visiblePuzzleMarkers(world),
      dynamicLights: selectedLightCounts.dynamicLights,
      floorGlows: selectedLightCounts.floorGlows,
      shadowLights: selectedLightCounts.shadowLights,
    },
    activeRuntime: {
      enemies: activeEnemies,
      projectiles: activeProjectiles,
      visualProjectiles: Math.min(activeProjectiles, quality.projectilePoolSize),
      effects: activeEffects,
      visualEffects: Math.min(activeEffects, quality.effectPoolSize),
      pickups: activePickups,
      environmentStates: activeEnvironmentStates,
    },
  };
}

function countAliveEnemies(world: GameWorld) {
  let count = 0;
  for (const enemy of world.enemies) {
    if (enemy.isAlive) count += 1;
  }
  return count;
}

function countActivePickups(world: GameWorld) {
  let count = 0;
  for (const pickup of world.pickups) {
    if (!pickup.collected) count += 1;
  }
  return count;
}

function countVisibleMapEntities(world: GameWorld) {
  const map = world.level.map;
  let rooms = 0;
  let doors = 0;
  let props = 0;
  let decals = 0;
  let keyItems = 0;
  let interactions = 0;
  let bigScreens = 0;

  if (!map) {
    return { rooms, doors, props, decals, keyItems, interactions, bigScreens };
  }

  for (const room of map.rooms) {
    if (isRoomRenderVisible(world, room.id)) rooms += 1;
  }
  for (const door of map.doors) {
    if (isDoorRenderVisible(world, door)) doors += 1;
  }
  for (const prop of map.props ?? []) {
    if (isRoomRenderVisible(world, prop.roomId)) props += 1;
  }
  for (const decal of map.decals ?? []) {
    if (isRoomRenderVisible(world, decal.roomId)) decals += 1;
  }
  for (const item of map.keyItems) {
    if (isRoomRenderVisible(world, item.roomId)) keyItems += 1;
  }
  for (const interaction of map.interactions) {
    if (isRoomRenderVisible(world, interaction.roomId)) interactions += 1;
  }
  for (const screen of world.level.bigScreens ?? []) {
    if (isRoomRenderVisible(world, screen.roomId)) bigScreens += 1;
  }

  return { rooms, doors, props, decals, keyItems, interactions, bigScreens };
}

function countSelectedRenderLights(selectedLights: ReturnType<typeof selectRenderLights>) {
  let dynamicLights = 0;
  let floorGlows = 0;
  let shadowLights = 0;
  for (const selected of selectedLights) {
    if (selected.light.type === "floor_glow") floorGlows += 1;
    else dynamicLights += 1;
    if (selected.canCastShadow) shadowLights += 1;
  }
  return { dynamicLights, floorGlows, shadowLights };
}

function totalPuzzleMarkers(world: GameWorld) {
  return (world.level.puzzles ?? []).reduce((sum, puzzle) => {
    if (puzzle.type === "hit_sequence") {
      return sum + puzzle.targets.length + (puzzle.clue.surfaces?.length ?? 0);
    }
    if (puzzle.type !== "code_lock") return sum;
    return sum + puzzle.clues.length;
  }, 0);
}

function visiblePuzzleMarkers(world: GameWorld) {
  let count = 0;
  for (const puzzle of world.level.puzzles ?? []) {
    if (puzzle.type === "hit_sequence") {
      for (const surface of puzzle.clue.surfaces ?? []) {
        if (isRoomRenderVisible(world, surface.roomId)) count += 1;
      }
      for (const target of puzzle.targets) {
        if (isRoomRenderVisible(world, target.roomId)) count += 1;
      }
      continue;
    }
    if (puzzle.type !== "code_lock") continue;
    for (const clue of puzzle.clues) {
      if (isRoomRenderVisible(world, clue.roomId)) count += 1;
    }
  }
  return count;
}
