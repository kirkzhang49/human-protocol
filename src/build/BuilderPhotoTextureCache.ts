import { SRGBColorSpace, TextureLoader, type Texture } from "three";
import type { BuilderProject } from "./BuilderTypes";
import { roomCeiling, roomFloor, roomWall } from "./BuilderEnvironment";

export interface BuilderPhotoTextureRequest {
  url: string;
  srgb: boolean;
}

const textureCache = new Map<string, Texture>();
const promiseCache = new Map<string, Promise<Texture | null>>();

function cacheKey(url: string, srgb: boolean) {
  return `${url}|${srgb ? "srgb" : "linear"}`;
}

function addSurfaceUrls(
  requests: Map<string, BuilderPhotoTextureRequest>,
  albedoUrl: string | undefined,
  normalUrl: string | undefined,
  roughUrl: string | undefined,
) {
  if (albedoUrl) requests.set(cacheKey(albedoUrl, true), { url: albedoUrl, srgb: true });
  if (normalUrl) requests.set(cacheKey(normalUrl, false), { url: normalUrl, srgb: false });
  if (roughUrl) requests.set(cacheKey(roughUrl, false), { url: roughUrl, srgb: false });
}

export function builderProjectSurfaceTextureUrls(project: BuilderProject): BuilderPhotoTextureRequest[] {
  const requests = new Map<string, BuilderPhotoTextureRequest>();
  for (const room of project.rooms) {
    const floor = roomFloor(room).preset;
    const wall = roomWall(room).preset;
    const ceiling = roomCeiling(room).preset;
    addSurfaceUrls(requests, floor.albedoUrl, floor.normalUrl, floor.roughUrl);
    addSurfaceUrls(requests, wall.albedoUrl, wall.normalUrl, wall.roughUrl);
    addSurfaceUrls(requests, ceiling.albedoUrl, ceiling.normalUrl, ceiling.roughUrl);
  }
  return [...requests.values()];
}

export function cachedBuilderPhotoTexture(url: string | undefined, srgb: boolean): Texture | null {
  if (!url) return null;
  return textureCache.get(cacheKey(url, srgb)) ?? null;
}

export function loadBuilderPhotoTexture(url: string | undefined, srgb: boolean): Promise<Texture | null> {
  if (!url || typeof window === "undefined") return Promise.resolve(null);
  const key = cacheKey(url, srgb);
  const cached = textureCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = promiseCache.get(key);
  if (pending) return pending;

  const promise = new Promise<Texture | null>((resolve) => {
    new TextureLoader().load(
      url,
      (loaded) => {
        if (srgb) loaded.colorSpace = SRGBColorSpace;
        textureCache.set(key, loaded);
        promiseCache.delete(key);
        resolve(loaded);
      },
      undefined,
      () => {
        promiseCache.delete(key);
        resolve(null);
      },
    );
  });
  promiseCache.set(key, promise);
  return promise;
}

export function preloadBuilderProjectSurfaceTextures(project: BuilderProject) {
  for (const request of builderProjectSurfaceTextureUrls(project)) {
    void loadBuilderPhotoTexture(request.url, request.srgb);
  }
}
