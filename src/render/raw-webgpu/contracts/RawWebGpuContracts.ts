export const RAW_WEBGPU_CONTRACT_VERSION = "hp.raw-webgpu.generated-assets.v1";

export const RAW_WEBGPU_ASSET_SOURCES = {
  compiledRaw: "compiled-raw-v1",
  compiledRawWithCookedGltfManifest: "compiled-raw-v1+cooked-gltf-manifest-v1",
  builderRuntimePack: "builder-runtime-pack-v1",
  builderRuntimePackCookedGlb: "builder-runtime-pack-v2+cooked-glb",
} as const;

export type RawWebGpuLoadedAssetSource =
  (typeof RAW_WEBGPU_ASSET_SOURCES)[keyof typeof RAW_WEBGPU_ASSET_SOURCES];

export type RawWebGpuGeneratedAssetKind =
  | "renderPlan"
  | "geometry"
  | "robotAnimationBridge"
  | "cookedGltfLoaderManifest";

export const RAW_WEBGPU_TEXTURE_COLOR_SPACE_RULES = {
  srgbSlots: ["baseColor", "emissive"],
  linearSlots: ["metallicRoughness", "normal", "occlusion", "ao"],
} as const;

export function rawWebGpuGeneratedAssetFilename(kind: RawWebGpuGeneratedAssetKind, levelId: string) {
  switch (kind) {
    case "renderPlan":
      return `render_plan_${levelId}.json`;
    case "geometry":
      return `render_plan_${levelId}_geometry.bin`;
    case "robotAnimationBridge":
      return `raw_robot_animation_bridge_${levelId}.json`;
    case "cookedGltfLoaderManifest":
      return `raw_cooked_glb_loader_manifest_${levelId}.json`;
  }
}

export function isRawWebGpuSrgbTextureSlot(slot: string) {
  return RAW_WEBGPU_TEXTURE_COLOR_SPACE_RULES.srgbSlots.includes(slot as never);
}

export function isRawWebGpuLinearTextureSlot(slot: string) {
  return RAW_WEBGPU_TEXTURE_COLOR_SPACE_RULES.linearSlots.includes(slot as never);
}
