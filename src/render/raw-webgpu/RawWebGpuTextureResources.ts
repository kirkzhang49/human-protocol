import { generateRawTextureMips, mipLevelCountForSize } from "./RawWebGpuMipmaps";
import { rawMipmapsEnabled } from "./RawWebGpuQuality";
import { RAW_TEXTURE_ARRAY_PAGE_COUNT } from "./RawWebGpuConstants";
import type { GpuGlobals, RawRenderPlan, Tuple4 } from "./RawWebGpuTypes";

const RAW_BASE_COLOR_TEXTURE_SIZE = 512;

export function createTextureViewWithValidation(device: any, label: string, texture: any) {
  device.pushErrorScope?.("validation");
  const view = texture.createView({ label });
  device.popErrorScope?.().then?.((error: { message?: string } | null) => {
    if (error) console.warn(`[HumanProtocol] Raw WebGPU texture view error: ${label}.`, error.message ?? error);
  });
  return view;
}

export async function createRawBaseColorTextureArray(device: any, plan: RawRenderPlan) {
  return createRawPlanTextureArrayPages(device, {
    entries: plan.geometry?.baseColorTextures ?? [],
    requestedSize: plan.geometry?.baseColorTextureSize ?? RAW_BASE_COLOR_TEXTURE_SIZE,
    label: "hp.raw.base-color-texture-array",
    format: "rgba8unorm-srgb",
    fallbackFill: [255, 255, 255, 255],
    warningLabel: "baseColor",
  });
}

// Material textures (normal / metallic-roughness / AO / emissive) come from the
// procedural per-role material pipeline — low-frequency patterns that carry no
// extra detail above 256px. We cap them at 256 (vs base-color's 512) so a level
// with ~245 layers costs ~64 MB of VRAM instead of ~245 MB, with no visible loss.
const RAW_MATERIAL_TEXTURE_SIZE_CAP = 256;

export async function createRawMaterialTextureArray(device: any, plan: RawRenderPlan) {
  return createRawPlanTextureArrayPages(device, {
    entries: plan.geometry?.materialTextures ?? [],
    requestedSize: Math.min(
      RAW_MATERIAL_TEXTURE_SIZE_CAP,
      plan.geometry?.materialTextureSize ?? RAW_BASE_COLOR_TEXTURE_SIZE,
    ),
    label: "hp.raw.material-texture-array",
    format: "rgba8unorm",
    fallbackFill: [128, 128, 255, 255],
    warningLabel: "material",
    colorSpaceConversion: "none",
  });
}

async function createRawPlanTextureArrayPages(
  device: any,
  options: {
    entries: Array<{ page?: number | null; layer: number; url: string }>;
    requestedSize: number;
    label: string;
    format: "rgba8unorm-srgb" | "rgba8unorm";
    fallbackFill: Tuple4;
    warningLabel: string;
    colorSpaceConversion?: ColorSpaceConversion;
  },
) {
  const pages = Array.from({ length: RAW_TEXTURE_ARRAY_PAGE_COUNT }, () => [] as Array<{ page?: number | null; layer: number; url: string }>);
  for (const entry of options.entries) {
    const page = Number.isFinite(entry.page) ? Math.floor(Number(entry.page)) : 0;
    if (page < 0 || page >= RAW_TEXTURE_ARRAY_PAGE_COUNT) {
      throw new Error(
        `[HumanProtocol] Raw WebGPU ${options.warningLabel} texture page ${page} is outside the supported 0-${RAW_TEXTURE_ARRAY_PAGE_COUNT - 1} range.`,
      );
    }
    pages[page].push(entry);
  }
  return Promise.all(
    pages.map((entries, page) =>
      createRawPlanTextureArrayPage(device, {
        ...options,
        entries,
        label: `${options.label}.page-${page}`,
        page,
      }),
    ),
  );
}

async function createRawPlanTextureArrayPage(
  device: any,
  options: {
    entries: Array<{ page?: number | null; layer: number; url: string }>;
    requestedSize: number;
    label: string;
    format: "rgba8unorm-srgb" | "rgba8unorm";
    fallbackFill: Tuple4;
    warningLabel: string;
    colorSpaceConversion?: ColorSpaceConversion;
    page: number;
  },
) {
  const gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  const entries = [...options.entries].sort((left, right) => left.layer - right.layer);
  const highestLayer = entries.reduce((max, entry) => Math.max(max, entry.layer), 0);
  const layerCount = Math.max(1, highestLayer + 1);
  const requestedSize = Math.round(options.requestedSize);
  const maxTextureSize = device.limits?.maxTextureDimension2D ?? 2048;
  const maxArrayLayers = device.limits?.maxTextureArrayLayers ?? 256;
  if (layerCount > maxArrayLayers) {
    throw new Error(
      `[HumanProtocol] Raw WebGPU ${options.warningLabel} texture page ${options.page} needs ${layerCount} layers, but this device supports ${maxArrayLayers}. ` +
        "Rebuild or rebudget the raw material pipeline before loading the level.",
    );
  }
  const size = Math.max(128, Math.min(1024, maxTextureSize, 2 ** Math.round(Math.log2(Math.max(128, requestedSize)))));
  const useMips = rawMipmapsEnabled();
  const mipLevelCount = useMips ? mipLevelCountForSize(size, size) : 1;
  const texture = device.createTexture({
    label: options.label,
    size: [size, size, layerCount],
    format: options.format,
    mipLevelCount,
    usage: gpuGlobals.GPUTextureUsage.TEXTURE_BINDING | gpuGlobals.GPUTextureUsage.COPY_DST | gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const fallbackLayer = new Uint8Array(size * size * 4);
  for (let index = 0; index < fallbackLayer.length; index += 4) {
    fallbackLayer[index] = options.fallbackFill[0];
    fallbackLayer[index + 1] = options.fallbackFill[1];
    fallbackLayer[index + 2] = options.fallbackFill[2];
    fallbackLayer[index + 3] = options.fallbackFill[3];
  }
  for (let layer = 0; layer < layerCount; layer += 1) {
    device.queue.writeTexture(
      { texture, origin: { x: 0, y: 0, z: layer } },
      fallbackLayer,
      { bytesPerRow: size * 4, rowsPerImage: size },
      { width: size, height: size, depthOrArrayLayers: 1 },
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return texture;

  const loadedEntries = await mapWithConcurrency(
    entries.filter((entry) => Number.isFinite(entry.layer) && entry.layer > 0 && entry.layer < layerCount && Boolean(entry.url)),
    12,
    async (entry) => {
      try {
        const response = await fetch(entry.url);
        if (!response.ok) throw new Error(`${options.warningLabel} texture request failed: ${response.status}`);
        const blob = await response.blob();
        const bitmap = options.colorSpaceConversion
          ? await createImageBitmap(blob, { colorSpaceConversion: options.colorSpaceConversion })
          : await createImageBitmap(blob);
        return { entry, bitmap };
      } catch (error) {
        console.warn(`[HumanProtocol] Raw WebGPU ${options.warningLabel} texture failed; using fallback.`, entry.url, error);
        return null;
      }
    },
  );

  for (const loaded of loadedEntries) {
    if (!loaded) continue;
    try {
      const { entry, bitmap } = loaded;
      context.clearRect(0, 0, size, size);
      context.drawImage(bitmap, 0, 0, size, size);
      device.queue.copyExternalImageToTexture(
        { source: canvas },
        { texture, origin: { x: 0, y: 0, z: entry.layer } },
        { width: size, height: size, depthOrArrayLayers: 1 },
      );
      bitmap.close?.();
    } catch (error) {
      loaded.bitmap?.close?.();
      console.warn(`[HumanProtocol] Raw WebGPU ${options.warningLabel} upload failed; using fallback.`, loaded.entry.url, error);
    }
  }

  if (useMips) {
    generateRawTextureMips(device, texture, {
      format: options.format,
      width: size,
      height: size,
      layerCount,
      mipLevelCount,
      label: options.label,
    });
  }

  return texture;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

export async function createRawHeroFloorTexture(device: any, url: string) {
  const gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Hero floor texture request failed: ${response.status}`);
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const useMips = rawMipmapsEnabled();
    const mipLevelCount = useMips ? mipLevelCountForSize(bitmap.width, bitmap.height) : 1;
    const texture = device.createTexture({
      label: "hp.raw.hero-floor-texture",
      size: [bitmap.width, bitmap.height, 1],
      format: "rgba8unorm-srgb",
      mipLevelCount,
      usage: gpuGlobals.GPUTextureUsage.TEXTURE_BINDING | gpuGlobals.GPUTextureUsage.COPY_DST | gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture },
      { width: bitmap.width, height: bitmap.height },
    );
    if (useMips) {
      generateRawTextureMips(device, texture, {
        format: "rgba8unorm-srgb",
        width: bitmap.width,
        height: bitmap.height,
        layerCount: 1,
        mipLevelCount,
        label: "hp.raw.hero-floor-texture",
      });
    }
    bitmap.close?.();
    return texture;
  } catch (error) {
    console.warn("[HumanProtocol] Raw WebGPU hero floor texture failed; using fallback.", error);
    return createSolidRawTexture(device, [9, 10, 12, 255]);
  }
}

export function createSolidRawTexture(device: any, rgba: [number, number, number, number]) {
  const gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  const texture = device.createTexture({
    label: "hp.raw.hero-floor-fallback-texture",
    size: [1, 1, 1],
    format: "rgba8unorm-srgb",
    usage: gpuGlobals.GPUTextureUsage.TEXTURE_BINDING | gpuGlobals.GPUTextureUsage.COPY_DST | gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const data = new Uint8Array(256);
  data.set(rgba, 0);
  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: 256, rowsPerImage: 1 },
    { width: 1, height: 1 },
  );
  return texture;
}
