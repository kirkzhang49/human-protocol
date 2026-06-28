import type { RawCookedGltfLoaderManifest } from "./RawCookedGltfLoaderManifest";
import type { RawRobotAnimationBridge } from "./RawRobotAnimationBridge";
import {
  RAW_WEBGPU_ASSET_SOURCES,
  rawWebGpuGeneratedAssetFilename,
  type RawWebGpuLoadedAssetSource,
} from "./RawWebGpuContracts";
import type { RawRenderPlan } from "./RawWebGpuTypes";

export interface RawWebGpuLoadedLevelAssets {
  plan: RawRenderPlan;
  geometryBuffer: ArrayBuffer;
  robotAnimationBridge: RawRobotAnimationBridge | null;
  cookedGltfLoaderManifest: RawCookedGltfLoaderManifest | null;
  source: RawWebGpuLoadedAssetSource;
}

interface RawWebGpuLevelAssetEntry {
  planUrl: string;
  geometryUrl: string;
  robotAnimationBridgeUrl?: string;
  cookedGltfLoaderManifestUrl?: string;
}

export const RAW_WEBGPU_COOKED_LEVEL_IDS = [
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
] as const;

const rawWebGpuGeneratedAssetUrls = import.meta.glob("../../assets/manifests/generated/raw-webgpu/*", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

export async function loadRawWebGpuLevelAssets(levelId: string): Promise<RawWebGpuLoadedLevelAssets> {
  const entry = rawWebGpuCookedEntryForLevel(levelId);
  if (!entry) {
    throw new Error(`No raw WebGPU cooked assets for level "${levelId}".`);
  }

  const [plan, geometryBuffer, robotAnimationBridge, cookedGltfLoaderManifest] = await Promise.all([
    fetchJson<RawRenderPlan>(entry.planUrl, "raw WebGPU render plan"),
    fetchArrayBuffer(entry.geometryUrl, "raw WebGPU geometry"),
    entry.robotAnimationBridgeUrl ? fetchOptionalJson<RawRobotAnimationBridge>(entry.robotAnimationBridgeUrl) : Promise.resolve(null),
    entry.cookedGltfLoaderManifestUrl ? fetchOptionalJson<RawCookedGltfLoaderManifest>(entry.cookedGltfLoaderManifestUrl) : Promise.resolve(null),
  ]);

  return {
    plan,
    geometryBuffer,
    robotAnimationBridge,
    cookedGltfLoaderManifest,
    source: cookedGltfLoaderManifest
      ? RAW_WEBGPU_ASSET_SOURCES.compiledRawWithCookedGltfManifest
      : RAW_WEBGPU_ASSET_SOURCES.compiledRaw,
  };
}

export function loadRawWebGpuLevel03Assets() {
  return loadRawWebGpuLevelAssets("level_03_human_museum");
}

export async function loadRawWebGpuRenderPlan(levelId: string): Promise<RawRenderPlan> {
  const entry = rawWebGpuCookedEntryForLevel(levelId);
  if (!entry) {
    throw new Error(`No raw WebGPU render plan for level "${levelId}".`);
  }
  return fetchJson<RawRenderPlan>(entry.planUrl, "raw WebGPU render plan");
}

export async function loadRawWebGpuGeometryBuffer(levelId: string): Promise<ArrayBuffer> {
  const entry = rawWebGpuCookedEntryForLevel(levelId);
  if (!entry) {
    throw new Error(`No raw WebGPU geometry for level "${levelId}".`);
  }
  return fetchArrayBuffer(entry.geometryUrl, "raw WebGPU geometry");
}

export async function loadRawWebGpuRobotAnimationBridge(levelId: string): Promise<RawRobotAnimationBridge | null> {
  const entry = rawWebGpuCookedEntryForLevel(levelId);
  if (!entry?.robotAnimationBridgeUrl) return null;
  return fetchOptionalJson<RawRobotAnimationBridge>(entry.robotAnimationBridgeUrl);
}

function rawWebGpuCookedEntryForLevel(levelId: string): RawWebGpuLevelAssetEntry | null {
  const planUrl = generatedRawAssetUrl(rawWebGpuGeneratedAssetFilename("renderPlan", levelId));
  const geometryUrl = generatedRawAssetUrl(rawWebGpuGeneratedAssetFilename("geometry", levelId));
  if (!planUrl || !geometryUrl) return null;

  return {
    planUrl,
    geometryUrl,
    robotAnimationBridgeUrl: generatedRawAssetUrl(rawWebGpuGeneratedAssetFilename("robotAnimationBridge", levelId)) ?? undefined,
    cookedGltfLoaderManifestUrl: generatedRawAssetUrl(rawWebGpuGeneratedAssetFilename("cookedGltfLoaderManifest", levelId)) ?? undefined,
  };
}

function generatedRawAssetUrl(filename: string) {
  return Object.entries(rawWebGpuGeneratedAssetUrls).find(([path]) => path.endsWith(`/${filename}`))?.[1] ?? null;
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${label}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchOptionalJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function fetchArrayBuffer(url: string, label: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${label}: ${response.status}`);
  }
  return response.arrayBuffer();
}
