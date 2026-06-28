export type AgeId = string;

export type AgeTuple2 = [number, number];
export type AgeTuple3 = [number, number, number];
export type AgeTuple4 = [number, number, number, number];
export type AgeMat4 = readonly number[] | Float32Array;

export type AgeRenderBackendKind = "webgpu" | "three" | "canvas2d" | "headless" | "custom";
export type AgeRenderQualityTier = "high" | "balanced" | "rescue" | "custom";

export interface AgeViewport {
  width: number;
  height: number;
  pixelRatio: number;
}

export interface AgeFrameTiming {
  frameIndex: number;
  deltaSeconds: number;
  elapsedSeconds: number;
}

export interface AgeRendererCapabilities {
  backend: AgeRenderBackendKind;
  supportsCompute: boolean;
  supportsFloatColorTarget: boolean;
  supportsTextureArrays: boolean;
  supportsStorageBuffers: boolean;
  supportsOffscreenPost: boolean;
  supportsWeightedOit: boolean;
  maxTextureDimension2D?: number;
  maxTextureArrayLayers?: number;
  notes?: readonly string[];
}

export interface AgeBackendAvailability {
  available: boolean;
  reason?: string;
  capabilities?: Partial<AgeRendererCapabilities>;
}

export interface AgeNamedTagMap {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export interface AgeBounds3 {
  min: AgeTuple3;
  center: AgeTuple3;
  size: AgeTuple3;
}

export interface AgeColorRgba {
  linear: AgeTuple4;
}
