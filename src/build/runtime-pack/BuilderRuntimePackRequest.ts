import {
  getLevelConfig,
  getLevelPlaytestMetadata,
} from "../../game/config/ConfigPackStore";
import { builderLevelConfigHash } from "./builderProjectHash";
import {
  BUILDER_RUNTIME_PACK_ENGINE_VERSION,
  type BuilderRuntimePackBakeMode,
  type BuilderRuntimePackRecord,
} from "./BuilderRuntimePackTypes";
import type { BuilderRuntimePackBackend } from "./BuilderRuntimePackStore";

export interface BuilderRuntimePackRequest {
  levelId: string;
  bakeMode?: BuilderRuntimePackBakeMode;
  packId?: string | null;
  projectHash?: string;
  configHash?: string;
  runtimeResourceHash?: string;
}

export type BuilderRuntimePackResolveStatus = "hit" | "fallback" | "miss";

export type BuilderRuntimePackResolveReason =
  | "latest-valid"
  | "requested-pack-missing"
  | "level-mismatch"
  | "engine-mismatch"
  | "schema-mismatch"
  | "mode-mismatch"
  | "legacy-texture-layers"
  | "project-hash-mismatch"
  | "config-hash-mismatch"
  | "runtime-resource-mismatch"
  | "empty-geometry"
  | "storage-unavailable"
  | "storage-read-failed"
  | "no-valid-pack";

export interface BuilderRuntimePackResolveResult {
  status: BuilderRuntimePackResolveStatus;
  record: BuilderRuntimePackRecord | null;
  requested: BuilderRuntimePackRequest;
  requestedRecord: BuilderRuntimePackRecord | null;
  reason: BuilderRuntimePackResolveReason;
}

export function builderRuntimePackRequestForLevel(
  levelId: string,
  search: string | URLSearchParams = typeof window !== "undefined" ? window.location.search : "",
): BuilderRuntimePackRequest {
  const metadata = getLevelPlaytestMetadata(levelId);
  const configHash = metadata?.runtimePackId ? currentLevelConfigHash(levelId) : undefined;
  return parseBuilderRuntimePackRequest(search, levelId, {
    packId: metadata?.runtimePackId,
    bakeMode: metadata?.bakeMode,
    projectHash: metadata?.projectHash,
    configHash,
    runtimeResourceHash: metadata?.runtimeResourceHash,
  });
}

export function parseBuilderRuntimePackRequest(
  search: string | URLSearchParams,
  levelId: string,
  fallback: Partial<BuilderRuntimePackRequest> = {},
): BuilderRuntimePackRequest {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const packId = params.get("packId") ?? fallback.packId ?? null;
  return {
    levelId,
    bakeMode: requestedBakeMode(params) ?? fallback.bakeMode,
    packId,
    projectHash: fallback.projectHash,
    configHash: fallback.configHash,
    runtimeResourceHash: fallback.runtimeResourceHash,
  };
}

export async function resolveBuilderRuntimePackRequest(
  request: BuilderRuntimePackRequest,
  backend: BuilderRuntimePackBackend | null,
): Promise<BuilderRuntimePackResolveResult> {
  const requested: BuilderRuntimePackRequest = { ...request, packId: request.packId ?? null };
  if (!backend) return miss(requested, null, "storage-unavailable");

  try {
    let requestedRecord: BuilderRuntimePackRecord | null = null;
    let requestedReason: BuilderRuntimePackResolveReason | null = null;
    if (requested.packId) {
      requestedRecord = await backend.get(requested.packId);
      requestedReason = builderRuntimePackUsabilityIssue(requestedRecord, requested);
      if (!requestedReason && requestedRecord) {
        return { status: "hit", record: requestedRecord, requested, requestedRecord, reason: "latest-valid" };
      }
    }

    const records = await backend.listForLevel(requested.levelId);
    const fallbackRecord = chooseLatestUsableRuntimePack(records, requested);
    if (fallbackRecord) {
      return {
        status: requested.packId ? "fallback" : "hit",
        record: fallbackRecord,
        requested,
        requestedRecord,
        reason: requestedReason ?? "latest-valid",
      };
    }

    return miss(requested, requestedRecord, requestedReason ?? "no-valid-pack");
  } catch {
    return miss(requested, null, "storage-read-failed");
  }
}

export function builderRuntimePackUsabilityIssue(
  record: BuilderRuntimePackRecord | null,
  request: BuilderRuntimePackRequest,
): BuilderRuntimePackResolveReason | null {
  if (!record) return "requested-pack-missing";
  if (record.levelId !== request.levelId) return "level-mismatch";
  if (record.engineVersion !== BUILDER_RUNTIME_PACK_ENGINE_VERSION) return "engine-mismatch";
  if (record.manifest.schemaVersion !== BUILDER_RUNTIME_PACK_ENGINE_VERSION) return "schema-mismatch";
  if (request.bakeMode && (record.manifest.bakeMode ?? "proxy") !== request.bakeMode) return "mode-mismatch";
  if (request.projectHash && record.projectHash !== request.projectHash) return "project-hash-mismatch";
  if (request.configHash && record.configHash !== request.configHash) return "config-hash-mismatch";
  if (request.runtimeResourceHash && record.runtimeResourceHash !== request.runtimeResourceHash) return "runtime-resource-mismatch";
  if (hasLegacyTextureLayers(record)) return "legacy-texture-layers";
  if (record.geometryBuffer.byteLength <= 0) return "empty-geometry";
  return null;
}

export function hasLegacyTextureLayers(record: BuilderRuntimePackRecord): boolean {
  if (record.manifest.bakeMode !== "cooked-glb") return false;
  return (record.renderPlan.geometry?.baseColorTextures ?? []).some((entry) => !Number.isFinite(entry.layer) || entry.layer <= 0);
}

function chooseLatestUsableRuntimePack(
  records: readonly BuilderRuntimePackRecord[],
  request: BuilderRuntimePackRequest,
): BuilderRuntimePackRecord | null {
  const usable = records.filter((record) => builderRuntimePackUsabilityIssue(record, request) === null);
  if (request.bakeMode) return usable[0] ?? null;
  return usable.find((record) => record.manifest.bakeMode === "cooked-glb") ?? usable[0] ?? null;
}

function requestedBakeMode(params: URLSearchParams): BuilderRuntimePackBakeMode | undefined {
  const value = params.get("pack");
  if (value === "deep") return "cooked-glb";
  if (value === "fast") return "proxy";
  return undefined;
}

function currentLevelConfigHash(levelId: string) {
  try {
    return builderLevelConfigHash(getLevelConfig(levelId));
  } catch {
    return undefined;
  }
}

function miss(
  requested: BuilderRuntimePackRequest,
  requestedRecord: BuilderRuntimePackRecord | null,
  reason: BuilderRuntimePackResolveReason,
): BuilderRuntimePackResolveResult {
  return { status: "miss", record: null, requested, requestedRecord, reason };
}
