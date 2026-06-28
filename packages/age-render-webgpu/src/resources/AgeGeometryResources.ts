import type { AgeDrawBatch } from "../core/AgeSceneFrame";
import type { AgeGeometryAssetDescriptor, AgePackedGeometryDescriptor } from "../contracts/AgeAssetContracts";

export interface AgeGeometryBuffer {
  id: string;
  source: AgePackedGeometryDescriptor;
  gpuBuffer?: unknown;
  byteLength: number;
}

export interface AgeGeometryResourceSet {
  vertexBuffer: AgeGeometryBuffer;
  assetsByModelKey: ReadonlyMap<string, AgeGeometryAssetDescriptor>;
}

export function ageCreateDrawBatchForGeometry(
  geometry: AgeGeometryAssetDescriptor,
  instanceOffset: number,
  instanceCount: number,
  options: Partial<AgeDrawBatch> = {},
): AgeDrawBatch {
  return {
    vertexBufferId: options.vertexBufferId ?? "geometry",
    geometryId: geometry.id,
    vertexOffset: geometry.vertexOffset,
    vertexCount: geometry.vertexCount,
    instanceOffset,
    instanceCount,
    transparent: options.transparent,
    castsShadow: options.castsShadow,
    receivesContactShadow: options.receivesContactShadow,
    materialId: options.materialId,
    materialRole: options.materialRole,
  };
}
