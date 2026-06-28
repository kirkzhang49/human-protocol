import type { AgeTextureDescriptor } from "../contracts/AgeAssetContracts";

export interface AgeTextureArrayDescriptor {
  id: string;
  label: string;
  textures: readonly AgeTextureDescriptor[];
  fallbackRgba: [number, number, number, number];
  requestedSize?: number;
  format?: "rgba8unorm" | "rgba8unorm-srgb" | "rgba16float";
}

export interface AgeTextureResource {
  id: string;
  descriptor: AgeTextureDescriptor | AgeTextureArrayDescriptor;
  texture?: unknown;
  view?: unknown;
}

export interface AgeTextureLoader {
  loadTexture(descriptor: AgeTextureDescriptor): Promise<AgeTextureResource>;
  loadTextureArray(descriptor: AgeTextureArrayDescriptor): Promise<AgeTextureResource>;
}
