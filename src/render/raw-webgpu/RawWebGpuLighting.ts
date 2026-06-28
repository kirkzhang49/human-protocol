import { MAX_SHADER_LIGHTS } from "./RawWebGpuConstants";
import { normalizeTuple } from "./RawWebGpuMath";
import type {
  RawPlanLight,
  RawPlanLightType,
  RawSelectedLight,
  RawVisibilityScenario,
  ResolvedRoomLightingProfile,
  Tuple3,
} from "./RawWebGpuTypes";

export const defaultLightingProfile: ResolvedRoomLightingProfile = {
  artist: {
    exposure: 1,
    contrast: 1,
    saturation: 1,
    warmth: 0.5,
  },
  bounce: {
    floor: 0,
    ceiling: 0,
    side: 0,
    shadowDepth: 0.7,
  },
  algorithm: {
    ao: 0,
    probe: 0,
    material: 1,
    localLight: 1,
    shadowReceiver: 0,
    specular: 1,
    contact: 0,
    wallGuard: 0,
  },
};

export function rawCinematicDirectionalDirection(value: Tuple3 | null | undefined): Tuple3 {
  const base = normalizeTuple(value ?? [-4.2, 12.5, 8.8], [-0.42, 0.78, 0.36]);
  return normalizeTuple([base[0] * 1.46 - 0.2, Math.min(0.6, base[1] * 0.68), base[2] * 1.22 + 0.16], [-0.5, 0.58, 0.64]);
}

export function lightTypeValue(type: RawPlanLightType) {
  if (type === "spot") return 1;
  if (type === "area") return 2;
  if (type === "floor_glow") return 3;
  return 0;
}

export function lightRadiusFor(light: RawPlanLight) {
  if (typeof light.distance === "number" && light.distance > 0) return light.distance;
  if (light.type === "area") {
    return Math.max(5.5, (light.width ?? 3.5) * 0.85 + (light.height ?? 1.2) * 0.65 + light.intensity * 1.7);
  }
  if (light.type === "floor_glow") return Math.max(4.6, light.intensity * 2.7 + 3.4);
  return Math.max(6, light.intensity * 3.2 + 4.8);
}

export function rawShaderLightsFor(selectedLights: RawSelectedLight[], currentRoomId: string) {
  if (selectedLights.length <= MAX_SHADER_LIGHTS) return selectedLights;
  const floorGlows = selectedLights
    .filter((selected) => selected.type === "floor_glow")
    .sort((left, right) => {
      const leftRoomScore = left.roomId === currentRoomId ? 1 : 0;
      const rightRoomScore = right.roomId === currentRoomId ? 1 : 0;
      return rightRoomScore - leftRoomScore || right.score - left.score;
    });
  const directLights = selectedLights.filter((selected) => selected.type !== "floor_glow");
  if (floorGlows.length === 0) return directLights.slice(0, MAX_SHADER_LIGHTS);
  return [...directLights.slice(0, MAX_SHADER_LIGHTS - 1), floorGlows[0]];
}

export function rawSelectedLightCandidatesForVisibleRooms(
  scenarios: readonly RawVisibilityScenario[],
  currentScenario: RawVisibilityScenario | null | undefined,
  visibleRoomIds: ReadonlySet<string>,
  currentRoomId: string,
  tier: RawVisibilityScenario["qualityTier"],
): RawSelectedLight[] {
  const baseLights = currentScenario?.selectedLights ?? [];
  const scenarioRoomIds = new Set(currentScenario?.visibleRoomIds ?? (currentScenario?.currentRoomId ? [currentScenario.currentRoomId] : []));
  const dynamicRoomIds = [...visibleRoomIds].filter((roomId) => roomId !== currentRoomId && !scenarioRoomIds.has(roomId));
  if (dynamicRoomIds.length === 0) return baseLights;

  const dynamicPrimaryLights: RawSelectedLight[] = [];
  const dynamicRestLights: RawSelectedLight[] = [];
  for (const roomId of dynamicRoomIds) {
    const scenario =
      scenarios.find((candidate) => candidate.currentRoomId === roomId && candidate.qualityTier === tier) ??
      scenarios.find((candidate) => candidate.currentRoomId === roomId);
    const roomLights = (scenario?.selectedLights ?? []).filter((selected) => selected.roomId === roomId);
    const fallbackLights = roomLights.length > 0 ? roomLights : (scenario?.selectedLights ?? []);
    dynamicPrimaryLights.push(...fallbackLights.slice(0, 2));
    dynamicRestLights.push(...fallbackLights.slice(2));
  }

  const seen = new Set<string>();
  const result: RawSelectedLight[] = [];
  const add = (selected: RawSelectedLight) => {
    if (seen.has(selected.id)) return;
    seen.add(selected.id);
    result.push(selected);
  };
  const currentRoomLights = baseLights.filter((selected) => selected.roomId === currentRoomId);
  const currentRoomBudget = Math.max(4, MAX_SHADER_LIGHTS - dynamicPrimaryLights.length);
  currentRoomLights.slice(0, currentRoomBudget).forEach(add);
  dynamicPrimaryLights.forEach(add);
  baseLights.forEach(add);
  dynamicRestLights.forEach(add);
  return result;
}
