import { createSingleLevelConfigPack, saveCustomConfigPackFromText, type ConfigPackPlaytestMetadata } from "../../game/config/ConfigPackStore";
import type { ConfigValidationIssue, ConfigValidationReport } from "../../game/config/ConfigValidator";
import { normalizeBuilderKeyPickups } from "../BuilderKeyPickups";
import { normalizeBuilderPuzzles } from "../BuilderPuzzleCatalog";
import { validateBuilderProject } from "../BuilderStorage";
import { createBuilderId, type BuilderProject } from "../BuilderTypes";
import { builderLevelConfigHash, builderProjectHash, stableRuntimePackContentHash } from "./builderProjectHash";
import { builderDeepAssetVersionHash, collectBuilderDeepModels } from "./collectBuilderDeepModels";
import {
  collectExternalBuilderRuntimeTextureBlobs,
  compileBuilderRuntimePack,
  type BuilderNativeRawModelLibrary,
} from "./compileBuilderRuntimePack";
import { cookGlbModelLibrary, type CookedGlbLibrary } from "./cookGlbModels";
import { deepCookEmitsNodeChunks } from "./deepCookPolicy";
import {
  builderNativeRawRequestsForAssetIndex,
  builderRuntimeAssetIndexForProject,
} from "./BuilderRuntimeAssetIndex";
import { loadBuilderNativeRawModelLibrary } from "./nativeRawEnemyModels";
import {
  builderRuntimePackBackend,
  clearBuilderRuntimePacksForLevel,
  clearBuilderRuntimePacksForProject,
  hasLegacyTextureLayers,
  latestBuilderPackPointer,
  loadBuilderRuntimePack,
  requestPersistentBuilderStorage,
  saveBuilderRuntimePack,
  type BuilderRuntimePackBackend,
  type BuilderStoragePersistence,
} from "./BuilderRuntimePackStore";
import {
  BUILDER_RUNTIME_PACK_ENGINE_VERSION,
  type BuilderRuntimePackBakeMode,
  type BuilderRuntimePackManifest,
  type BuilderRuntimePackRecord,
} from "./BuilderRuntimePackTypes";

/**
 * Player-facing playtest pack pipelines.
 *
 * 快速生成 (fast): procedural/proxy pack — milliseconds, always available.
 * 深度烘焙 (deep): prefers the prebuilt Raw/WebGPU geometry for every indexed
 * runtime model, then cooks only modelKeys that are not present in the Raw map.
 * Robots keep the official Raw animation bridge when available.
 *
 * Both report determinate progress through weighted phases so the UI can show
 * one compact progress bar.
 */

export type BuilderPackGenerationMode = "fast" | "deep";

export const builderPackPhases = [
  { id: "validate", label: "校验关卡", weight: 12 },
  { id: "level-config", label: "生成关卡配置", weight: 10 },
  { id: "render-plan", label: "生成 Raw 渲染计划", weight: 22 },
  { id: "geometry", label: "生成几何数据", weight: 18 },
  { id: "persist", label: "写入本地试玩包", weight: 18 },
  { id: "warmup", label: "预热渲染器", weight: 12 },
  { id: "ready", label: "准备试玩", weight: 8 },
] as const;

export const builderDeepPackPhases = [
  { id: "validate", label: "校验关卡", weight: 8 },
  { id: "collect-models", label: "收集模型", weight: 6 },
  { id: "fetch-glb", label: "读取 GLB", weight: 26 },
  { id: "bake-geometry", label: "烘焙几何", weight: 22 },
  { id: "bake-materials", label: "烘焙材质", weight: 10 },
  { id: "persist", label: "写入本地试玩包", weight: 14 },
  { id: "warmup", label: "预热 Raw WebGPU", weight: 8 },
  { id: "ready", label: "准备试玩", weight: 6 },
] as const;

export type BuilderPackPhaseId = (typeof builderPackPhases)[number]["id"] | (typeof builderDeepPackPhases)[number]["id"];

export interface BuilderPackProgress {
  phaseId: BuilderPackPhaseId;
  phaseLabel: string;
  /** Overall fraction 0..1 across all weighted phases. */
  fraction: number;
  /** Optional human-readable detail (e.g. current model label). */
  detail?: string;
}

export interface GenerateBuilderPackOptions {
  mode?: BuilderPackGenerationMode;
  onProgress?: (progress: BuilderPackProgress) => void;
  backend?: BuilderRuntimePackBackend | null;
  /** Skip browser-only side effects (config-pack localStorage, GPU warmup). */
  headless?: boolean;
  /** QA hook: use this cooked library instead of fetching GLBs. */
  cookedLibraryForTests?: CookedGlbLibrary;
}

export type GenerateBuilderPackResult =
  | {
      ok: true;
      packId: string;
      levelId: string;
      projectHash: string;
      bakeMode: BuilderRuntimePackBakeMode;
      cached: boolean;
      manifest: BuilderRuntimePackManifest;
      diagnostics: string[];
      persistence: BuilderStoragePersistence;
      webgpuAvailable: boolean;
      sizeBytes: number;
    }
  | {
      ok: false;
      phaseId: BuilderPackPhaseId;
      error: string;
      details?: string[];
      levelId: string | null;
    };

let activeBakeRunToken = 0;

export async function generateBuilderPlaytestPack(
  project: BuilderProject,
  options: GenerateBuilderPackOptions = {},
): Promise<GenerateBuilderPackResult> {
  project = normalizeBuilderKeyPickups(normalizeBuilderPuzzles(project));
  // Stale-run protection: starting a new bake supersedes any in-flight one;
  // a superseded bake must never write pointers/records.
  const runToken = ++activeBakeRunToken;
  const mode: BuilderPackGenerationMode = options.mode ?? "fast";
  const phases = mode === "deep" ? builderDeepPackPhases : builderPackPhases;
  const report = createProgressReporter(phases, options.onProgress);
  const headless = options.headless ?? typeof window === "undefined";
  const backend = options.backend ?? builderRuntimePackBackend();

  // 校验关卡
  report("validate", 0);
  const validation = validateBuilderProject(project);
  if (!validation.ok || !validation.level) {
    const firstIssue =
      issueLine(validation.compileIssues[0]) ?? issueLine(validation.report?.errors?.[0]) ?? "关卡校验未通过。";
    return {
      ok: false,
      phaseId: "validate",
      error: firstIssue,
      details: validation.report ? graphDiagnosticLines(validation.report) : undefined,
      levelId: null,
    };
  }
  const level = validation.level;
  const assetIndex = builderRuntimeAssetIndexForProject(level, project);
  report("validate", 1);
  await yieldToFrame();

  // 生成关卡配置 (fast has its own phase; deep folds it into validation)
  if (mode === "fast") report("level-config", 0);
  if (mode === "fast") report("level-config", 1);
  await yieldToFrame();

  // Deep bake: collect + cook the real models.
  let cooked: CookedGlbLibrary | undefined;
  let nativeRawModels: BuilderNativeRawModelLibrary | undefined;
  const precompileDiagnostics: string[] = [];
  let assetVersionHash = "";
  const projectHash = builderProjectHash(project);
  const configHash = builderLevelConfigHash(level);
  if (mode === "deep") {
    report("collect-models", 0.2);
    const collection = collectBuilderDeepModels(level, assetIndex);
    assetVersionHash = builderDeepAssetVersionHash(collection.requests);
    report("collect-models", 1, `${collection.requests.length} 个模型`);
    await yieldToFrame();

    if (!headless && !options.cookedLibraryForTests) {
      const nativeRawRequests = builderNativeRawRequestsForAssetIndex(assetIndex);
      if (nativeRawRequests.length > 0) {
        report("fetch-glb", 0.05, "载入原生 WebGPU 资产");
        let missingNativeRequests: typeof nativeRawRequests = [];
        try {
          nativeRawModels = (await loadBuilderNativeRawModelLibrary(nativeRawRequests)) ?? undefined;
          const loadedKeys = new Set(nativeRawModels?.models.keys() ?? []);
          missingNativeRequests = nativeRawRequests.filter((request) => !loadedKeys.has(request.modelKey));
        } catch (error) {
          precompileDiagnostics.push(
            `原生 WebGPU 资源载入失败，深度试玩会退回按需烘焙（${error instanceof Error ? error.message : "未知错误"}）。`,
          );
          missingNativeRequests = nativeRawRequests;
        }
        if (missingNativeRequests.length > 0) {
          const missingByKind = new Map<string, string[]>();
          for (const request of missingNativeRequests) {
            const bucket = missingByKind.get(request.kind) ?? [];
            bucket.push(request.modelKey);
            missingByKind.set(request.kind, bucket);
          }
          for (const [kind, keys] of missingByKind) {
            precompileDiagnostics.push(`WGPU 资源包缺少 ${kind}：${keys.join(", ")}。深度试玩会只为这些缺口临时烘焙。`);
          }
        }
        await yieldToFrame();
      }
    }

    // Cache: reuse only packs whose full identity still matches this compile.
    const runtimeResourceHash = builderRuntimeResourceHash(assetVersionHash, nativeRawModels);
    const cachedPointer = latestBuilderPackPointer(project.projectId, "cooked-glb");
    if (cachedPointer && cachedPointer.projectHash === projectHash) {
      const cachedRecord = await loadBuilderRuntimePack(cachedPointer.packId, backend);
      if (
        cachedRecord &&
        isReusableDeepRuntimePack(cachedRecord, {
          projectId: project.projectId,
          levelId: level.id,
          projectHash,
          configHash,
          runtimeResourceHash,
          assetVersionHash,
        })
      ) {
        report("ready", 1);
        return {
          ok: true,
          packId: cachedRecord.packId,
          levelId: cachedRecord.levelId,
          projectHash,
          bakeMode: "cooked-glb",
          cached: true,
          manifest: cachedRecord.manifest,
          diagnostics: cachedRecord.diagnostics,
          persistence: { supported: false, persisted: false },
          webgpuAvailable: true,
          sizeBytes: cachedRecord.sizeBytes,
        };
      }
    }

    if (options.cookedLibraryForTests) {
      cooked = options.cookedLibraryForTests;
      report("fetch-glb", 1);
      report("bake-geometry", 1);
    } else {
      const nativeRawKeys = new Set(nativeRawModels?.models.keys() ?? []);
      const cookRequests = collection.requests
        .filter((request) => !nativeRawKeys.has(request.modelKey))
        .map((request) => ({
          ...request,
          emitNodeChunks: deepCookEmitsNodeChunks(request.kind, request.modelKey),
        }));
      cooked = await cookGlbModelLibrary(cookRequests, (modelKey, index, total, stage) => {
        const fraction = total > 0 ? (index + (stage === "cook" ? 0.6 : 0.2)) / total : 1;
        report(stage === "fetch" ? "fetch-glb" : "bake-geometry", fraction, modelKey);
      });
      report("fetch-glb", 1);
      report("bake-geometry", 1);
    }
    for (const unresolvedKey of collection.unresolved) {
      cooked.missing.push({ modelKey: unresolvedKey, reason: "没有对应的素材记录" });
    }
    await yieldToFrame();
  } else if (!headless) {
    const nativeRawRequests = builderNativeRawRequestsForAssetIndex(assetIndex);
    if (nativeRawRequests.length > 0) {
      report("render-plan", 0.05, "载入原生模型");
      let missingNativeRequests: typeof nativeRawRequests = [];
      try {
        nativeRawModels = (await loadBuilderNativeRawModelLibrary(nativeRawRequests)) ?? undefined;
        const loadedKeys = new Set(nativeRawModels?.models.keys() ?? []);
        missingNativeRequests = nativeRawRequests.filter((request) => !loadedKeys.has(request.modelKey));
      } catch (error) {
        precompileDiagnostics.push(
          `原生 Raw 资源索引载入失败，快速试玩会报告 WGPU 资源缺口（${error instanceof Error ? error.message : "未知错误"}）。`,
        );
        missingNativeRequests = nativeRawRequests;
      }
      if (missingNativeRequests.length > 0) {
        const missingByKind = new Map<string, string[]>();
        for (const request of missingNativeRequests) {
          const bucket = missingByKind.get(request.kind) ?? [];
          bucket.push(request.modelKey);
          missingByKind.set(request.kind, bucket);
        }
        for (const [kind, keys] of missingByKind) {
          precompileDiagnostics.push(`WGPU 资源包缺少 ${kind}：${keys.join(", ")}。请重新生成 Raw 资源包；运行时不会临时烘焙 GLB。`);
        }
      }
      await yieldToFrame();
    }
  }

  // 生成 Raw 渲染计划 / 烘焙材质
  report(mode === "deep" ? "bake-materials" : "render-plan", 0.2);
  let compiled: ReturnType<typeof compileBuilderRuntimePack>;
  try {
    compiled = compileBuilderRuntimePack(level, project, {
      cooked,
      nativeRawModels,
      assetIndex,
      assetVersionHash,
      manifestBakeMode: mode === "fast" ? "proxy" : undefined,
    });
  } catch (error) {
    return {
      ok: false,
      phaseId: mode === "deep" ? "bake-materials" : "render-plan",
      error: error instanceof Error ? error.message : "渲染数据生成失败。",
      levelId: level.id,
    };
  }
  if (mode === "fast") {
    report("render-plan", 1);
    await yieldToFrame();
    report("geometry", 1);
  } else {
    report("bake-materials", 1);
  }
  await yieldToFrame();
  const externalTextures = await collectExternalBuilderRuntimeTextureBlobs(compiled.renderPlan, compiled.textures);
  const runtimeTextureBlobs = externalTextures.textures;
  const textureBytes = runtimeTextureBlobs.reduce((sum, texture) => sum + texture.bytes.byteLength, 0);
  const runtimeManifest = { ...compiled.manifest, textureBytes };
  const diagnostics = [...precompileDiagnostics, ...compiled.diagnostics, ...externalTextures.diagnostics];

  // 写入本地试玩包
  if (runToken !== activeBakeRunToken) {
    return { ok: false, phaseId: "persist", error: "已被新的生成任务取代。", levelId: level.id };
  }
  report("persist", 0.1);
  try {
    const bakeMode = mode === "fast" ? "proxy" : "cooked-glb";
    const projectCleanup = await clearBuilderRuntimePacksForProject(project.projectId, bakeMode, backend);
    const levelCleanup = await clearBuilderRuntimePacksForLevel(level.id, bakeMode, backend);
    const deletedRecords = projectCleanup.deletedRecords + levelCleanup.deletedRecords;
    if (deletedRecords > 0 || projectCleanup.removedPointers || levelCleanup.removedPointers) {
      diagnostics.push(`已清理旧${mode === "fast" ? "快速" : "深度"}试玩包缓存：${deletedRecords} 个 IndexedDB 记录。`);
    }
  } catch (error) {
    diagnostics.push(`旧试玩包缓存清理失败，将继续写入新包（${error instanceof Error ? error.message : "未知错误"}）。`);
  }
  if (runToken !== activeBakeRunToken) {
    return { ok: false, phaseId: "persist", error: "已被新的生成任务取代。", levelId: level.id };
  }
  report("persist", 0.35);
  const now = Date.now();
  const packId = `${createBuilderId("pack")}_${now.toString(36)}`;
  const runtimeResourceHash = builderRuntimeResourceHash(compiled.manifest.assetVersionHash, nativeRawModels);
  const record: BuilderRuntimePackRecord = {
    packId,
    projectId: project.projectId,
    projectHash,
    builderSnapshotId: packId,
    configHash,
    runtimeResourceHash,
    engineVersion: BUILDER_RUNTIME_PACK_ENGINE_VERSION,
    levelId: level.id,
    createdAt: now,
    updatedAt: now,
    manifest: runtimeManifest,
    renderPlan: compiled.renderPlan,
    geometryBuffer: compiled.geometryBuffer,
    textureBlobs: runtimeTextureBlobs,
    diagnostics,
    sizeBytes:
      compiled.geometryBuffer.byteLength +
      textureBytes +
      JSON.stringify(compiled.renderPlan).length,
  };
  if (!headless) {
    const importResult = saveCustomConfigPackFromText(JSON.stringify(createSingleLevelConfigPack(level)), {
      replaceExistingLevelIds: true,
      playtest: playtestMetadataForRecord(record),
    });
    if (!importResult.ok) {
      return {
        ok: false,
        phaseId: mode === "fast" ? "level-config" : "persist",
        error: issueLine(importResult.errors[0]) ?? "关卡配置保存失败。",
        levelId: level.id,
      };
    }
  }
  try {
    await saveBuilderRuntimePack(record, backend);
  } catch (error) {
    return {
      ok: false,
      phaseId: "persist",
      error: error instanceof Error ? error.message : "本地试玩包写入失败。",
      levelId: level.id,
    };
  }
  report("persist", 1);
  await yieldToFrame();

  // 预热渲染器 (best-effort; failure here never fails the pack)
  report("warmup", 0.2);
  let persistence: BuilderStoragePersistence = { supported: false, persisted: false };
  let webgpuAvailable = false;
  if (!headless) {
    persistence = await requestPersistentBuilderStorage();
    webgpuAvailable = await probeWebGpu();
    if (!webgpuAvailable) {
      diagnostics.push("此设备暂不支持 WebGPU，Builder 深度试玩入口会被拦截。");
    }
  }
  report("warmup", 1);

  // 准备试玩
  report("ready", 1);
  return {
    ok: true,
    packId: record.packId,
    levelId: level.id,
    projectHash: record.projectHash,
    bakeMode: compiled.manifest.bakeMode,
    cached: false,
    manifest: compiled.manifest,
    diagnostics,
    persistence,
    webgpuAvailable,
    sizeBytes: record.sizeBytes,
  };
}

function issueLine(issue: { path?: string; message?: string } | ConfigValidationIssue | undefined) {
  if (!issue?.message) return null;
  return issue.path ? `${issue.path}: ${issue.message}` : issue.message;
}

function graphDiagnosticLines(report: ConfigValidationReport) {
  const graph = report.graph;
  const lines: string[] = [];
  if (graph.reachability.solutionPath.length > 0) {
    lines.push(`通关路径: ${graph.reachability.solutionPath.map((step) => `${step.label}(${step.id})`).join(" -> ")}`);
  } else {
    lines.push("通关路径: 未找到可完成出口交互的路线。");
  }
  if (graph.reachability.softlocks.length > 0) {
    lines.push(`Softlock: ${graph.reachability.softlocks.length} 个可达状态没有后续动作。`);
    for (const softlock of graph.reachability.softlocks.slice(0, 3)) {
      lines.push(`- ${softlock.roomIds.join(", ")} after ${softlock.afterStepId ?? "start"}: ${softlock.reason}`);
    }
  } else {
    lines.push("Softlock: 未发现终端自锁状态。");
  }
  lines.push(`已读画: ${graph.reachability.articles.join(", ") || "无"}`);
  lines.push(`已解谜题: ${graph.reachability.puzzles.join(", ") || "无"}`);
  lines.push(`已切门控: ${graph.reachability.switches.join(", ") || "无"}`);
  return lines;
}

function isReusableDeepRuntimePack(
  record: BuilderRuntimePackRecord,
  identity: {
    projectId: string;
    levelId: string;
    projectHash: string;
    configHash: string;
    runtimeResourceHash: string;
    assetVersionHash: string;
  },
) {
  return (
    record.projectId === identity.projectId &&
    record.levelId === identity.levelId &&
    record.projectHash === identity.projectHash &&
    record.configHash === identity.configHash &&
    record.runtimeResourceHash === identity.runtimeResourceHash &&
    record.engineVersion === BUILDER_RUNTIME_PACK_ENGINE_VERSION &&
    record.manifest.schemaVersion === BUILDER_RUNTIME_PACK_ENGINE_VERSION &&
    record.manifest.bakeMode === "cooked-glb" &&
    record.manifest.assetVersionHash === identity.assetVersionHash &&
    record.geometryBuffer.byteLength > 0 &&
    !hasLegacyTextureLayers(record)
  );
}

function playtestMetadataForRecord(record: BuilderRuntimePackRecord): ConfigPackPlaytestMetadata {
  return {
    runtimePackId: record.packId,
    bakeMode: record.manifest.bakeMode,
    projectHash: record.projectHash,
    configHash: record.configHash,
    runtimeResourceHash: record.runtimeResourceHash,
    builderSnapshotId: record.builderSnapshotId,
    engineVersion: record.engineVersion,
    updatedAt: record.updatedAt,
  };
}

function builderRuntimeResourceHash(assetVersionHash: string, nativeRawModels: BuilderNativeRawModelLibrary | undefined): string {
  return stableRuntimePackContentHash({
    engine: BUILDER_RUNTIME_PACK_ENGINE_VERSION,
    assetVersionHash,
    nativeRawLibraryId: nativeRawModels?.libraryId ?? null,
    nativeRawSourceLevelIds: nativeRawModels?.sourceLevelIds ?? [],
    nativeRawModelKeys: [...(nativeRawModels?.models.keys() ?? [])].sort(),
  });
}

function createProgressReporter(
  phases: readonly { id: string; label: string; weight: number }[],
  onProgress: GenerateBuilderPackOptions["onProgress"],
) {
  const totalWeight = phases.reduce((sum, phase) => sum + phase.weight, 0);
  return (phaseId: BuilderPackPhaseId, phaseFraction: number, detail?: string) => {
    if (!onProgress) return;
    let before = 0;
    let current: { id: string; label: string; weight: number } = phases[0];
    for (const phase of phases) {
      if (phase.id === phaseId) {
        current = phase;
        break;
      }
      before += phase.weight;
    }
    onProgress({
      phaseId,
      phaseLabel: current.label,
      fraction: Math.min(1, (before + current.weight * Math.min(1, Math.max(0, phaseFraction))) / totalWeight),
      detail,
    });
  };
}

async function probeWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } }).gpu;
    if (!gpu) return false;
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

function yieldToFrame(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // Race rAF with a timeout: rAF does not fire in background/hidden tabs,
  // and a bake must keep progressing if the player switches tabs.
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(finish);
    window.setTimeout(finish, 48);
  });
}
