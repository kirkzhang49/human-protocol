import type { GpuGlobals } from "./RawWebGpuTypes";

// Offline-baked IBL probe (Filament cmgen, from a Poly Haven CC0 HDRI).
// See src/assets/textures/environment/ibl/README.md. Data-only assets; this
// module uploads them and the renderer binds them on @group(3) bindings 3-6.
// LDR (sRGB PNG) path — the simplest faithful-enough variant.
const SPECULAR_LDR = import.meta.glob(
  "../../assets/textures/environment/ibl/museum_neutral/specular-ldr/m*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;
import BRDF_LUT_URL from "../../assets/textures/environment/ibl/brdf-lut/brdf_dfg_singlescatter_256.png?url";

// m0..m4 = perceptual roughness 0..1 -> cube mip 0..4. Base (unprefixed) skybox unused.
const CUBE_BASE_SIZE = 256;
const CUBE_MIP_COUNT = 5;
const BRDF_LUT_SIZE = 256;
// WebGPU cube layer order: +X,-X,+Y,-Y,+Z,-Z = px,nx,py,ny,pz,nz.
const CUBE_FACES = ["px", "nx", "py", "ny", "pz", "nz"] as const;

export interface RawIblResources {
  specularCubeView: any;
  specularSampler: any;
  brdfLutView: any;
  brdfLutSampler: any;
}

function specularUrl(mip: number, face: string): string | undefined {
  const suffix = `/m${mip}_${face}.png`;
  for (const key of Object.keys(SPECULAR_LDR)) {
    if (key.endsWith(suffix)) return SPECULAR_LDR[key];
  }
  return undefined;
}

async function loadBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}

/**
 * Loads the prefiltered specular cubemap + BRDF/DFG LUT into GPU textures and
 * returns their views/samplers. Best-effort: any load failure leaves that part
 * of the texture black (binding stays valid — never crashes the pipeline). The
 * IBL specular effect itself is gated at runtime (lighting.sh_meta.z), so a
 * black/missing probe only matters when `?rawCube=1` is on.
 */
export async function createRawIblResources(device: any): Promise<RawIblResources> {
  const gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  const usage =
    gpuGlobals.GPUTextureUsage.TEXTURE_BINDING |
    gpuGlobals.GPUTextureUsage.COPY_DST |
    gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT;

  const specularSampler = device.createSampler({
    label: "hp.raw.ibl-specular-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  const brdfLutSampler = device.createSampler({
    label: "hp.raw.ibl-lut-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
  });

  const cube = device.createTexture({
    label: "hp.raw.ibl-specular-cube",
    size: [CUBE_BASE_SIZE, CUBE_BASE_SIZE, 6],
    dimension: "2d",
    mipLevelCount: CUBE_MIP_COUNT,
    format: "rgba8unorm-srgb",
    usage,
  });
  for (let mip = 0; mip < CUBE_MIP_COUNT; mip += 1) {
    const mipSize = CUBE_BASE_SIZE >> mip;
    for (let face = 0; face < 6; face += 1) {
      const url = specularUrl(mip, CUBE_FACES[face]);
      const bitmap = url ? await loadBitmap(url) : null;
      if (!bitmap) continue;
      try {
        device.queue.copyExternalImageToTexture(
          { source: bitmap },
          { texture: cube, mipLevel: mip, origin: { x: 0, y: 0, z: face } },
          { width: mipSize, height: mipSize, depthOrArrayLayers: 1 },
        );
      } finally {
        bitmap.close?.();
      }
    }
  }

  // BRDF/DFG LUT: R = DFG scale, G = DFG bias. Linear, NOT sRGB.
  const lut = device.createTexture({
    label: "hp.raw.ibl-brdf-lut",
    size: [BRDF_LUT_SIZE, BRDF_LUT_SIZE, 1],
    format: "rgba8unorm",
    usage,
  });
  const lutBitmap = await loadBitmap(BRDF_LUT_URL);
  if (lutBitmap) {
    try {
      device.queue.copyExternalImageToTexture(
        { source: lutBitmap },
        { texture: lut },
        { width: BRDF_LUT_SIZE, height: BRDF_LUT_SIZE, depthOrArrayLayers: 1 },
      );
    } finally {
      lutBitmap.close?.();
    }
  }

  return {
    specularCubeView: cube.createView({ label: "hp.raw.ibl-cube-view", dimension: "cube" }),
    specularSampler,
    brdfLutView: lut.createView({ label: "hp.raw.ibl-lut-view", dimension: "2d" }),
    brdfLutSampler,
  };
}
