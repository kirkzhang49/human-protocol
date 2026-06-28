import type { AgeBounds3, AgeId } from "../core/AgeTypes";

export type AgeTextureSemantic =
  | "baseColor"
  | "normal"
  | "metallicRoughness"
  | "ao"
  | "emissive"
  | "environment"
  | "brdfLut"
  | "custom";

export type AgeTextureColorSpace = "srgb" | "linear" | "none";

export interface AgeTextureDescriptor {
  id: AgeId;
  url: string;
  semantic: AgeTextureSemantic;
  colorSpace: AgeTextureColorSpace;
  layer?: number;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface AgeGeometryAssetDescriptor {
  id: AgeId;
  modelKey: string;
  vertexOffset: number;
  vertexCount: number;
  triangleCount?: number;
  bounds?: AgeBounds3;
  chunks?: readonly AgeGeometryChunkDescriptor[];
  status: "ready" | "empty" | "missing";
}

export interface AgeGeometryChunkDescriptor {
  id?: AgeId;
  nodeIndex?: number | null;
  nodeName?: string | null;
  vertexOffset: number;
  vertexCount: number;
  inverseBindMatrix?: readonly number[];
}

export interface AgePackedGeometryDescriptor {
  id: AgeId;
  binaryUrl: string;
  vertexStrideFloats: number;
  assets: readonly AgeGeometryAssetDescriptor[];
}

export interface AgeAssetBundleDescriptor {
  id: AgeId;
  schemaVersion: string;
  source: "compiled" | "streamed" | "runtime" | "external";
  geometry?: AgePackedGeometryDescriptor;
  textures?: readonly AgeTextureDescriptor[];
  metadata?: Record<string, unknown>;
}
