import type { RawCookedGltfLoaderManifest } from "./RawCookedGltfLoaderManifest";
import type { RawDrawBatch, RawPlanInstance, RawPlanMaterial, RawRenderPlan } from "./RawWebGpuTypes";

export function hasRawTransparentMaterials(plan: RawRenderPlan, cookedGltfLoaderManifest: RawCookedGltfLoaderManifest | null = null) {
  return (
    (plan.geometry?.materials ?? []).some((material) => isRawTransparentMaterial(material)) ||
    hasRawCookedTransparentMaterials(cookedGltfLoaderManifest)
  );
}

export function rawTransparentMaterialIndexSet(plan: RawRenderPlan) {
  const transparentMaterialIndices = new Set<number>();
  for (const material of plan.geometry?.materials ?? []) {
    if (isRawTransparentMaterial(material)) transparentMaterialIndices.add(material.index);
  }
  return transparentMaterialIndices;
}

export function rawTransparentInstanceIdSet(plan: RawRenderPlan) {
  const transparentInstanceIds = new Set<string>();
  const instancesById = new Map(plan.instances.map((instance) => [instance.id, instance]));
  for (const directive of plan.rawArtDirection?.transparentDirectives ?? []) {
    if (directive.target !== "instance" || !directive.sourceInstanceId) continue;
    const instance = instancesById.get(directive.sourceInstanceId);
    if (instance && rawInstanceShouldRemainOpaque(instance)) continue;
    transparentInstanceIds.add(directive.sourceInstanceId);
  }
  return transparentInstanceIds;
}

export function isRawTransparentDrawBatch(batch: RawDrawBatch) {
  return batch.vertexBuffer !== "shadow" && batch.transparent === true && batch.vertexCount > 0 && batch.instanceCount > 0;
}

export function isRawTransparentMaterial(material: RawPlanMaterial) {
  if ((material.materialKind ?? 0) < 0) return false;
  if (material.transparency?.mode === "blend") return true;
  if (material.alphaMode === "BLEND") return true;
  if ((material.baseColorFactor?.[3] ?? 1) < 0.98) return true;
  if (material.transparency?.mode === "mask") return false;
  return false;
}

export function rawInstanceShouldRemainOpaque(instance: Pick<RawPlanInstance, "id" | "role" | "modelKey">) {
  if (instance.role === "floor" || instance.role === "ceiling" || instance.role === "wall" || instance.role === "pillar") return true;
  if (instance.role === "wall_wash_light_mesh") return true;
  return /^shell:/.test(instance.id) || /^room_(floor|ceiling|wall|corner_pillar|wall_wash)/.test(instance.modelKey);
}

function hasRawCookedTransparentMaterials(manifest: RawCookedGltfLoaderManifest | null) {
  if ((manifest?.summary?.transparentMaterialCount ?? 0) > 0) return true;
  return (manifest?.models ?? []).some((model) => (model.materials ?? []).some((material) => material.transparent));
}
