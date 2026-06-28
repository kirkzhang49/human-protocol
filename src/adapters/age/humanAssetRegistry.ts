import {
  AGE_ASSET_BUNDLE_SCHEMA_VERSION,
  AgeAssetRegistry,
  type AgeAssetBundleDescriptor,
  type AgeGeometryAssetDescriptor,
  type AgeTextureColorSpace,
  type AgeTextureDescriptor,
  type AgeTextureSemantic,
} from "@age/render-webgpu";
import { rawWebGpuGeneratedAssetFilename } from "../../render/raw-webgpu/contracts/RawWebGpuContracts";
import type {
  RawPlanGeometryAsset,
  RawPlanMaterialTexture,
  RawRenderPlan,
} from "../../render/raw-webgpu/RawWebGpuTypes";

/**
 * Pure conversion from an already-loaded Human Protocol raw render plan into
 * an AGE asset bundle descriptor. Fetching, Vite globs, and generated
 * filename policy stay on the Human side; the engine receives only generic
 * descriptors.
 */

export function humanAgeBundleId(levelId: string) {
  return `human-protocol.bundle.${levelId}`;
}

export interface HumanAgeAssetBundleOptions {
  /** Resolved URL for the packed geometry binary; defaults to the generated filename. */
  geometryUrl?: string;
}

export function createHumanAgeAssetBundle(
  plan: RawRenderPlan,
  options: HumanAgeAssetBundleOptions = {},
): AgeAssetBundleDescriptor {
  const levelId = plan.level.id;
  const geometry = plan.geometry;
  return {
    id: humanAgeBundleId(levelId),
    schemaVersion: AGE_ASSET_BUNDLE_SCHEMA_VERSION,
    source: "compiled",
    geometry: geometry
      ? {
          id: `human-protocol.geometry.${levelId}`,
          binaryUrl: options.geometryUrl ?? geometry.binaryFile ?? rawWebGpuGeneratedAssetFilename("geometry", levelId),
          vertexStrideFloats: geometry.vertexStrideFloats,
          assets: geometry.assets.map((asset) => humanAgeGeometryAsset(asset)),
        }
      : undefined,
    textures: humanAgeTextures(plan),
    metadata: {
      levelId,
      contract: "hp.raw-webgpu.generated-assets.v1",
      materialCount: geometry?.materials?.length ?? 0,
    },
  };
}

export function registerHumanAgeAssets(
  registry: AgeAssetRegistry,
  plan: RawRenderPlan,
  options: HumanAgeAssetBundleOptions = {},
) {
  return registry.upsertBundle(createHumanAgeAssetBundle(plan, options));
}

function humanAgeGeometryAsset(asset: RawPlanGeometryAsset): AgeGeometryAssetDescriptor {
  return {
    id: `geometry:${asset.modelKey}`,
    modelKey: asset.modelKey,
    vertexOffset: asset.vertexOffset,
    vertexCount: asset.vertexCount,
    triangleCount: asset.triangleCount,
    bounds: asset.bounds
      ? { min: asset.bounds.min, center: asset.bounds.center, size: asset.bounds.size }
      : undefined,
    chunks: asset.nodeChunks?.map((chunk, chunkIndex) => ({
      id: `geometry:${asset.modelKey}:chunk:${chunkIndex}`,
      nodeIndex: chunk.nodeIndex,
      nodeName: chunk.nodeName,
      vertexOffset: chunk.vertexOffset,
      vertexCount: chunk.vertexCount,
      inverseBindMatrix: chunk.inverseBindMatrix,
    })),
    status: asset.status,
  };
}

function humanAgeTextures(plan: RawRenderPlan): AgeTextureDescriptor[] {
  const textures: AgeTextureDescriptor[] = [];
  for (const [index, texture] of (plan.geometry?.baseColorTextures ?? []).entries()) {
    textures.push({
      id: `human-protocol.texture.baseColor.${texture.layer}.${index}`,
      url: texture.url,
      semantic: "baseColor",
      colorSpace: "srgb",
      layer: texture.layer,
      mimeType: texture.mimeType ?? undefined,
    });
  }
  for (const [index, texture] of (plan.geometry?.materialTextures ?? []).entries()) {
    const semantic = humanAgeTextureSemantic(texture);
    textures.push({
      id: `human-protocol.texture.${semantic}.${texture.layer}.${index}`,
      url: texture.url,
      semantic,
      colorSpace: humanAgeTextureColorSpace(texture, semantic),
      layer: texture.layer,
      mimeType: texture.mimeType ?? undefined,
    });
  }
  return textures;
}

function humanAgeTextureSemantic(texture: RawPlanMaterialTexture): AgeTextureSemantic {
  const semantic = texture.semantic;
  if (semantic === "baseColor" || semantic === "normal" || semantic === "metallicRoughness" || semantic === "ao" || semantic === "emissive") {
    return semantic;
  }
  return "custom";
}

function humanAgeTextureColorSpace(
  texture: RawPlanMaterialTexture,
  semantic: AgeTextureSemantic,
): AgeTextureColorSpace {
  if (texture.colorSpace === "srgb" || texture.colorSpace === "linear" || texture.colorSpace === "none") {
    return texture.colorSpace;
  }
  if (semantic === "baseColor" || semantic === "emissive") return "srgb";
  if (semantic === "custom") return "none";
  return "linear";
}
