import type { LevelDefinition } from "../../game/config/schema/levelConfig";
import type {
  RawPlanLight,
  RawRenderPlan,
  RawSelectedLight,
  RawVisibilityScenario,
} from "../../render/raw-webgpu/RawWebGpuTypes";
import { clampLighting, defaultCeilingHeight, defaultWallHeight } from "../BuilderEnvironment";
import type { BuilderProject } from "../BuilderTypes";
import { clampNumber, TIER_LIGHT_BUDGET } from "./builderRuntimePackConstants";

/**
 * Room shell-height defaults, key-light placement, per-room visibility
 * scenarios, and presentation/lighting defaults for the builder runtime pack.
 * Extracted verbatim from compileBuilderRuntimePack; all numbers are unchanged.
 */

export function defaultWallHeightForRuntime() {
  return defaultWallHeight;
}

export function defaultCeilingHeightForRuntime() {
  return defaultCeilingHeight;
}

export function roomKeyLightHeight(wallHeight: number, ceilingHeight: number | null) {
  const targetCeiling = ceilingHeight ?? Math.max(wallHeight + 0.2, defaultCeilingHeightForRuntime());
  return clampNumber(Math.min(targetCeiling - 0.24, wallHeight - 0.08), 1.8, 3.4);
}

export function buildVisibilityScenarios(
  map: NonNullable<LevelDefinition["map"]>,
  lights: readonly RawPlanLight[],
): RawVisibilityScenario[] {
  const scenarios: RawVisibilityScenario[] = [];
  for (const room of map.rooms) {
    const visibleRoomIds = [room.id];
    const visibleRoomSet = new Set(visibleRoomIds);
    const visibleDoorIds = map.doors
      .filter((door) => door.fromRoomId === room.id || door.toRoomId === room.id)
      .map((door) => door.id);
    const visibleDoorSet = new Set(visibleDoorIds);
    const candidates = lights
      .filter((light) => (light.roomId ? visibleRoomSet.has(light.roomId) : true) || (light.doorId ? visibleDoorSet.has(light.doorId) : false))
      .map((light): RawSelectedLight => ({
        id: light.id,
        type: light.type,
        roomId: light.roomId,
        position: light.position,
        score: light.intensity + (light.roomId === room.id ? 2 : 0),
        canCastShadow: false,
      }))
      .sort((a, b) => b.score - a.score);
    for (const tier of ["high", "balanced", "rescue"] as const) {
      scenarios.push({
        currentRoomId: room.id,
        qualityTier: tier,
        visibleRoomIds,
        visibleDoorIds,
        selectedLights: candidates.slice(0, TIER_LIGHT_BUDGET[tier]),
      });
    }
  }
  return scenarios;
}

export function presentationFrom(lighting: ReturnType<typeof clampLighting>): RawRenderPlan["presentation"] {
  return {
    lighting: {
      ambient: { color: "#9fb6c8", intensity: clampNumber(0.1 + lighting.ambient * 0.6, 0.12, 1.0) },
      hemisphereIntensity: 0.2,
      directional: {
        color: lighting.keyColor,
        intensity: clampNumber(0.5 + lighting.keyIntensity * 0.5, 0.3, 1.6),
        position: [-4.2, 12.5, 8.8],
      },
      fog: {
        color: "#05070b",
        near: 30 - lighting.fog * 12,
        far: 80 - lighting.fog * 30,
      },
      bloom: {
        intensity: clampNumber(lighting.bloom * 0.6, 0, 1.2),
        threshold: clampNumber(0.68 - lighting.bloom * 0.18, 0.3, 0.9),
      },
    },
  };
}

export function warmthForRoom(style: BuilderProject["rooms"][number]["style"] | undefined) {
  if (style === "residential") return 0.6;
  if (style === "hazard" || style === "exit") return 0.5;
  if (style === "maintenance") return 0.44;
  return 0.38;
}
