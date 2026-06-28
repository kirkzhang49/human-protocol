import {
  AGE_RENDER_PLAN_SCHEMA_VERSION,
  ageDefaultLightingParityProfile,
  type AgeAdapterResult,
  type AgeLightingFrame,
  type AgeLightingParityProfile,
  type AgeRenderPlan,
  type AgeRenderPlanInstance,
  type AgeRenderPlanLight,
  type AgeRenderPlanMaterial,
  type AgeRenderPlanRoom,
  type AgeRenderPlanVisibility,
  type AgeTuple3,
  type AgeVisibilityScenario,
} from "@age/render-webgpu";
import { humanAgeBundleId } from "./humanAssetRegistry";
import { ageMaterialRoleForHumanMaterial, ageMaterialRoleForHumanName } from "./humanMaterialRoles";
import type {
  RawPlanInstance,
  RawPlanLight,
  RawRenderPlan,
  Tuple3,
} from "../../render/raw-webgpu/RawWebGpuTypes";

/**
 * Pure conversion from an already-loaded Human Protocol raw render plan into
 * a generic AGE render plan. No GPU resources are touched; this is the
 * type-level adapter seam described in the extraction plan.
 */
export function humanLevelToAgeRenderPlan(plan: RawRenderPlan): AgeAdapterResult<AgeRenderPlan> {
  const warnings: string[] = [];
  const agePlan: AgeRenderPlan = {
    id: `human-protocol.plan.${plan.level.id}`,
    schemaVersion: AGE_RENDER_PLAN_SCHEMA_VERSION,
    assetBundleId: humanAgeBundleId(plan.level.id),
    rooms: plan.rooms.map((room) => humanAgeRoom(room)),
    materials: humanAgeMaterials(plan, warnings),
    instances: plan.instances.map((instance) => humanAgeInstance(instance)),
    lights: (plan.lights ?? []).map((light) => humanAgeLight(light)),
    visibilityScenarios: humanAgeVisibilityScenarios(plan),
    metadata: {
      levelId: plan.level.id,
      sourceContract: "hp.raw-webgpu.generated-assets.v1",
      lightingProfileCount: plan.lightingProfiles?.length ?? 0,
    },
  };
  return { value: agePlan, warnings };
}

function humanAgeRoom(room: RawRenderPlan["rooms"][number]): AgeRenderPlanRoom {
  return {
    id: room.id,
    mood: room.mood ?? undefined,
    bounds: {
      min: boundsMin(room.bounds.center, room.bounds.size),
      center: room.bounds.center,
      size: room.bounds.size,
    },
  };
}

function humanAgeMaterials(plan: RawRenderPlan, warnings: string[]): AgeRenderPlanMaterial[] {
  const materials = plan.geometry?.materials ?? [];
  if (materials.length <= 0) {
    warnings.push(`Raw render plan "${plan.level.id}" has no packed materials; AGE plan will fail readiness validation.`);
  }
  return materials.map((material) => ({
    id: material.id,
    index: material.index,
    name: material.name,
    category: material.category,
    role: ageMaterialRoleForHumanMaterial(material),
    baseColorFactor: material.baseColorFactor,
    emissiveFactor: material.emissiveFactor,
    emissiveStrength: material.emissiveStrength,
    roughnessFactor: material.roughnessFactor,
    metallicFactor: material.metallicFactor,
    alphaMode: material.alphaMode,
    doubleSided: material.doubleSided,
    semanticParams: material.semanticParams ?? undefined,
  }));
}

function humanAgeInstance(instance: RawPlanInstance): AgeRenderPlanInstance {
  return {
    id: instance.id,
    modelKey: instance.modelKey,
    roomId: instance.roomId,
    secondaryRoomId: instance.secondaryRoomId,
    position: instance.position,
    rotation: instance.rotation,
    scale: instance.scale,
    localOffset: instance.localOffset,
    materialRole: ageMaterialRoleForHumanName(instance.role),
    bounds: {
      min: boundsMin(instance.estimatedBounds.center, halfSizeToSize(instance.estimatedBounds.halfSize)),
      center: instance.estimatedBounds.center,
      size: halfSizeToSize(instance.estimatedBounds.halfSize),
    },
    visibility: humanAgeVisibility(instance),
    state: {
      humanRole: instance.role,
      doorId: instance.visibility.doorId ?? instance.state?.doorId,
      keyItemId: instance.visibility.keyItemId ?? instance.state?.keyItemId,
      pickupId: instance.visibility.pickupId ?? instance.state?.pickupId,
      interactionId: instance.state?.interactionId,
    },
    tags: instance.tags,
  };
}

function humanAgeVisibility(instance: RawPlanInstance): AgeRenderPlanVisibility {
  const visibility = instance.visibility;
  if (visibility.type === "room") {
    return instance.roomId ? { type: "room", roomId: instance.roomId } : { type: "always" };
  }
  if (visibility.type === "door") return { type: "state", stateKey: `door:${visibility.doorId ?? "unknown"}` };
  if (visibility.type === "key-item") return { type: "state", stateKey: `key-item:${visibility.keyItemId ?? "unknown"}` };
  if (visibility.type === "pickup") return { type: "state", stateKey: `pickup:${visibility.pickupId ?? "unknown"}` };
  return { type: "adapter" };
}

function humanAgeLight(light: RawPlanLight): AgeRenderPlanLight {
  return {
    id: light.id,
    type: light.type === "floor_glow" ? "floor-glow" : light.type,
    roomId: light.roomId,
    color: light.color,
    intensity: light.intensity,
    position: light.position,
    range: light.distance ?? undefined,
    width: light.width ?? undefined,
    height: light.height ?? undefined,
    role: light.semanticRole ?? undefined,
  };
}

function humanAgeVisibilityScenarios(plan: RawRenderPlan): AgeVisibilityScenario[] {
  return plan.visibilityScenarios.map((scenario) => ({
    id: `${scenario.currentRoomId}:${scenario.qualityTier}`,
    visibleRoomIds: scenario.visibleRoomIds,
    selectedLightIds: scenario.selectedLights.map((light) => light.id),
  }));
}

/**
 * Chooses the AGE lighting parity profile for a Human Protocol level from its
 * raw plan presentation data. The engine never branches on level IDs; Human
 * picks the descriptor here and hands the engine plain numbers.
 */
export function humanAgeLightingParityProfileFor(plan: RawRenderPlan): AgeLightingParityProfile {
  const base = ageDefaultLightingParityProfile;
  const bloom = plan.presentation?.lighting?.bloom;
  return {
    ...base,
    id: `human-protocol.lighting-parity.${plan.level.id}`,
    label: `Three.js parity targets derived from raw plan presentation for ${plan.level.id}`,
    emissive: {
      ...base.emissive,
      bloomWeightScale: bloom ? Math.max(0.2, Math.min(2, bloom.intensity / 0.38)) : base.emissive.bloomWeightScale,
    },
  };
}

/**
 * Builds the static part of the AGE lighting frame (ambient/directional) from
 * raw plan presentation. Selected local lights are appended per frame by the
 * runtime bridge.
 */
export function humanAgeBaseLightingFrame(plan: RawRenderPlan): AgeLightingFrame {
  const lighting = plan.presentation?.lighting;
  return {
    ambient: {
      color: colorFromHexTuple(lighting?.ambient?.color, [0.16, 0.24, 0.28]),
      intensity: clamp01(lighting?.ambient?.intensity ?? 0.28, 0, 3),
    },
    directional: lighting?.directional
      ? {
          color: colorFromHexTuple(lighting.directional.color, [0.78, 0.94, 1]),
          intensity: clamp01(lighting.directional.intensity, 0, 4),
          direction: normalizeTuple3(lighting.directional.position, [-0.42, 0.78, 0.36]),
        }
      : undefined,
    localLights: [],
    parityProfileId: `human-protocol.lighting-parity.${plan.level.id}`,
  };
}

function boundsMin(center: Tuple3, size: Tuple3): AgeTuple3 {
  return [center[0] - size[0] * 0.5, center[1] - size[1] * 0.5, center[2] - size[2] * 0.5];
}

function halfSizeToSize(halfSize: Tuple3): AgeTuple3 {
  return [halfSize[0] * 2, halfSize[1] * 2, halfSize[2] * 2];
}

function colorFromHexTuple(hex: string | null | undefined, fallback: AgeTuple3): AgeTuple3 {
  if (!hex) return fallback;
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return fallback;
  const value = Number.parseInt(match[1], 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

function normalizeTuple3(value: Tuple3 | null | undefined, fallback: AgeTuple3): AgeTuple3 {
  const candidate = value ?? fallback;
  const length = Math.hypot(candidate[0], candidate[1], candidate[2]);
  if (length <= 1e-6) return fallback;
  return [candidate[0] / length, candidate[1] / length, candidate[2] / length];
}

function clamp01(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
