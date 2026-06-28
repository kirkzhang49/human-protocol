import {
  AgeAssetRegistry,
  ageRoomLightBudgetFor,
  type AgeEscapeRoomVisualProfile,
  type AgeRenderPlan,
  type AgeViewport,
} from "@age/render-webgpu";
import type { RawRenderPlan } from "../../render/raw-webgpu/RawWebGpuTypes";
import { registerHumanAgeAssets } from "./humanAssetRegistry";
import { humanEscapeRoomVisualProfileFor } from "./humanEscapeRoomVisualProfile";
import { humanAgeBaseLightingFrame, humanLevelToAgeRenderPlan } from "./humanLevelToAgeScene";
import {
  createHumanAgeSceneFrame,
  type HumanAgeCameraView,
  type HumanAgeWorldView,
} from "./humanRuntimeBridge";

/**
 * ?ageBridge=1 instrumentation: converts the live GameWorld into an AGE scene
 * frame on a sampling cadence, validates it, and reports counts next to the
 * raw renderer's own numbers so AGE/raw drift is measurable long before AGE
 * draws the whole frame.
 */

export interface HumanAgeRawParityStats {
  currentRoomId: string;
  visibleRooms: number;
  visibleDoors: number;
  selectedLights: number;
  staticInstances: number;
  drawBatches: number;
  dynamicShadowPlanes: number;
  ageGroundingQuads: number;
  ageGroundingMode: string;
  ageGroundingFailed: boolean;
}

export interface HumanAgeBridgeStats {
  levelId: string;
  planRooms: number;
  planInstances: number;
  planMaterials: number;
  frameDynamicInstances: number;
  frameContacts: number;
  framePortals: number;
  frameOpenPortals: number;
  frameProjectiles: number;
  frameEmitters: number;
  lightBudget: number;
  warnings: string[];
  raw: HumanAgeRawParityStats | null;
}

export interface HumanAgeDebugBridge {
  readonly agePlan: AgeRenderPlan;
  readonly profile: AgeEscapeRoomVisualProfile;
  readonly planWarnings: readonly string[];
  sample(input: {
    world: HumanAgeWorldView;
    camera: HumanAgeCameraView;
    viewport: AgeViewport;
    deltaSeconds: number;
    elapsedSeconds: number;
    raw?: HumanAgeRawParityStats | null;
  }): HumanAgeBridgeStats;
}

export function createHumanAgeDebugBridge(plan: RawRenderPlan): HumanAgeDebugBridge {
  const registry = new AgeAssetRegistry();
  registerHumanAgeAssets(registry, plan);
  const conversion = humanLevelToAgeRenderPlan(plan);
  const agePlan = conversion.value;
  const profile = humanEscapeRoomVisualProfileFor(plan);
  const lighting = humanAgeBaseLightingFrame(plan);

  return {
    agePlan,
    profile,
    planWarnings: conversion.warnings ?? [],
    sample({ world, camera, viewport, deltaSeconds, elapsedSeconds, raw }) {
      const result = createHumanAgeSceneFrame({
        world,
        camera,
        viewport,
        deltaSeconds,
        elapsedSeconds,
        lighting,
        assets: registry,
      });
      const frame = result.value;
      const currentRoomId = raw?.currentRoomId ?? agePlan.rooms?.[0]?.id ?? "";
      return {
        levelId: world.level.id,
        planRooms: agePlan.rooms?.length ?? 0,
        planInstances: agePlan.instances.length,
        planMaterials: agePlan.materials.length,
        frameDynamicInstances: frame.instances.length,
        frameContacts: frame.contacts?.length ?? 0,
        framePortals: frame.portalStates?.length ?? 0,
        frameOpenPortals: frame.portalStates?.filter((portal) => portal.open).length ?? 0,
        frameProjectiles: frame.projectiles?.length ?? 0,
        frameEmitters: frame.particleEmitters?.length ?? 0,
        lightBudget: ageRoomLightBudgetFor(profile, currentRoomId, world.renderPerformance.quality.tier),
        warnings: [...(result.warnings ?? [])],
        raw: raw ?? null,
      };
    },
  };
}

export function formatHumanAgeBridgeStats(stats: HumanAgeBridgeStats) {
  const lines = [
    `age bridge ${stats.levelId}`,
    `plan rooms ${stats.planRooms} instances ${stats.planInstances} materials ${stats.planMaterials}`,
    `frame dyn ${stats.frameDynamicInstances} contacts ${stats.frameContacts} portals ${stats.frameOpenPortals}/${stats.framePortals}`,
    `vfx proj ${stats.frameProjectiles} emit ${stats.frameEmitters} | light budget ${stats.lightBudget}`,
  ];
  if (stats.raw) {
    lines.push(
      `raw room ${stats.raw.currentRoomId} vis ${stats.raw.visibleRooms}r/${stats.raw.visibleDoors}d lights ${stats.raw.selectedLights}`,
      `raw static ${stats.raw.staticInstances} batches ${stats.raw.drawBatches} shadows ${stats.raw.dynamicShadowPlanes}`,
    );
    if (stats.raw.ageGroundingMode !== "off") {
      lines.push(
        `age grounding ${stats.raw.ageGroundingMode}${stats.raw.ageGroundingFailed ? " FAILED->raw" : ""} quads ${stats.raw.ageGroundingQuads}`,
      );
    }
  }
  if (stats.warnings.length > 0) {
    lines.push(`warnings ${stats.warnings.length}: ${stats.warnings[0]}`);
  }
  return lines.join("\n");
}
