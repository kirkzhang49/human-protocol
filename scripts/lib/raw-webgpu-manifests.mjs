import path from "node:path";
import { rawWebGpuGeneratedManifestDir } from "./paths.mjs";

export const RAW_WEBGPU_CAMPAIGN_LEVEL_IDS = [
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
];

export function rawWebGpuGeneratedManifestFilename(kind, levelId) {
  switch (kind) {
    case "renderPlan":
      return `render_plan_${levelId}.json`;
    case "geometry":
      return `render_plan_${levelId}_geometry.bin`;
    case "robotAnimationBridge":
      return `raw_robot_animation_bridge_${levelId}.json`;
    case "threeResourceBridge":
      return `raw_threejs_resource_bridge_${levelId}.json`;
    case "cookedGltfLoaderManifest":
      return `raw_cooked_glb_loader_manifest_${levelId}.json`;
    case "colorQualityAudit":
      return `raw_color_quality_audit_${levelId}.json`;
    case "museumLightingQa":
      return `museum_lighting_qa_${levelId}.json`;
    default:
      throw new Error(`Unknown raw WebGPU manifest kind: ${kind}`);
  }
}

export function rawWebGpuGeneratedManifestPath(gameRoot, kind, levelId) {
  return path.join(rawWebGpuGeneratedManifestDir(gameRoot), rawWebGpuGeneratedManifestFilename(kind, levelId));
}
