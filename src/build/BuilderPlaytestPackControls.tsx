import { useEffect, useMemo, useRef, useState } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import { RAW_VIEWMODEL_HAND_MODEL_KEYS, RAW_VIEWMODEL_MODEL_KEYS } from "../render/raw-webgpu/RawViewmodelMode";
import { saveBuilderProjectAsPack } from "./BuilderStorage";
import type { BuilderProject } from "./BuilderTypes";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import { builderProjectHash } from "./runtime-pack/builderProjectHash";
import { latestBuilderPackPointer } from "./runtime-pack/BuilderRuntimePackStore";
import type { BuilderRuntimePackManifest, BuilderRuntimePackPointer } from "./runtime-pack/BuilderRuntimePackTypes";
import { generateBuilderPlaytestPack, type BuilderPackProgress } from "./runtime-pack/generateBuilderPlaytestPack";

interface BuilderPlaytestPackControlsProps {
  project: BuilderProject;
  /** Quick-check blockers (red chips): >0 means the level can't compile yet. */
  blockedCount?: number;
  /** Opens the guidance toast listing what's missing (校验). */
  onShowIssues?: () => void;
  /** Incrementing token from other UI surfaces that should trigger the same WebGPU playtest path. */
  playtestRequestToken?: number;
  onBeforeLaunch?: () => void;
  onStatus: (text: string) => void;
}

interface PackNotice {
  persisted: boolean;
  webgpuAvailable: boolean;
  sizeBytes: number;
  cached: boolean;
  manifest: BuilderRuntimePackManifest | null;
  diagnostics: string[];
}

type PackStatus = "none" | "ready" | "stale";

export function builderPlaytestUrl(levelId: string, options: { packId?: string } = {}) {
  const params = new URLSearchParams({
    level: levelId,
    pack: "deep",
    rawViewmodelMode: "three",
    requireWebGpu: "1",
  });
  if (options.packId) params.set("packId", options.packId);
  return `${window.location.origin}/?${params.toString()}`;
}

export function builderProjectNeedsCookedMachinePlaytest(project: BuilderProject) {
  return (
    (project.puzzles?.length ?? 0) > 0 ||
    (project.routeSwitches?.length ?? 0) > 0 ||
    project.doors.some((door) => door.lockType === "puzzle_complete") ||
    project.puzzle !== undefined
  );
}

function browserHasWebGpu() {
  return typeof navigator !== "undefined" && !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

export function BuilderPlaytestPackControls({
  project,
  blockedCount = 0,
  onShowIssues,
  playtestRequestToken = 0,
  onBeforeLaunch,
  onStatus,
}: BuilderPlaytestPackControlsProps) {
  const { language } = useBuilderLanguage();
  const currentHash = useMemo(() => builderProjectHash(project), [project]);
  const [pointerVersion, setPointerVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BuilderPackProgress | null>(null);
  const [phaseLog, setPhaseLog] = useState<string[]>([]);
  const [failure, setFailure] = useState<{ error: string; details?: string[] } | null>(null);
  const [notice, setNotice] = useState<PackNotice | null>(null);
  const [popOpen, setPopOpen] = useState(false);
  const [webgpuSupported, setWebgpuSupported] = useState(() => browserHasWebGpu());
  const mountedRef = useRef(true);
  const handledRequestTokenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    setWebgpuSupported(browserHasWebGpu());
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setPointerVersion((value) => value + 1);
    setFailure(null);
    setNotice(null);
  }, [project.projectId]);

  const deepPointer = useMemo(
    () => latestBuilderPackPointer(project.projectId, "cooked-glb"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.projectId, pointerVersion],
  );
  const deepStatus: PackStatus = deepPointer ? (deepPointer.projectHash === currentHash ? "ready" : "stale") : "none";
  const stale = deepStatus === "stale";
  const blocked = blockedCount > 0 && deepStatus !== "ready";

  const blockWithoutWebGpu = () => {
    setFailure({
      error:
        language === "en"
          ? "This playtest now requires WebGPU. Open it in a WebGPU-capable Chrome/Edge profile, then bake again."
          : "现在试玩必须走 WebGPU。请用支持 WebGPU 的 Chrome/Edge 打开，再重新烘焙。",
    });
    setPopOpen(true);
    onStatus(language === "en" ? "WebGPU is required for builder playtest." : "Builder 试玩现在必须使用 WebGPU。");
  };

  const launchDeep = (pointer: BuilderRuntimePackPointer | null = deepPointer) => {
    if (!browserHasWebGpu()) {
      setWebgpuSupported(false);
      blockWithoutWebGpu();
      return;
    }
    if (!pointer || pointer.projectHash !== currentHash) {
      void generateDeep(true);
      return;
    }
    const saved = saveBuilderProjectAsPack(project, {
      playtest: {
        runtimePackId: pointer.packId,
        bakeMode: "cooked-glb",
        projectHash: pointer.projectHash,
        configHash: pointer.configHash,
        runtimeResourceHash: pointer.runtimeResourceHash,
        builderSnapshotId: pointer.builderSnapshotId,
        engineVersion: pointer.engineVersion,
        updatedAt: pointer.updatedAt,
      },
    });
    if (!saved.importResult?.ok || !saved.levelId) {
      const firstIssue = saved.importResult?.errors[0]?.message ?? saved.compileIssues[0]?.message ?? saved.report?.errors[0]?.message;
      onStatus(
        language === "en"
          ? `Playtest config was not saved${firstIssue ? `: ${firstIssue}` : "."}`
          : `试玩配置没有保存成功${firstIssue ? `：${firstIssue}` : "。"}`,
      );
      return;
    }
    onBeforeLaunch?.();
    window.open(builderPlaytestUrl(saved.levelId, { packId: pointer.packId }), "_blank");
    onStatus(language === "en" ? "Opened WebGPU deep playtest with the new weapon viewmodel." : "已打开 WebGPU 深度试玩，新武器已默认启用。");
  };

  const generateDeep = async (launchAfter = false) => {
    if (busy) return;
    if (!browserHasWebGpu()) {
      setWebgpuSupported(false);
      blockWithoutWebGpu();
      return;
    }
    setWebgpuSupported(true);
    setBusy(true);
    setFailure(null);
    setNotice(null);
    setPopOpen(true);
    setPhaseLog([]);
    setProgress({ phaseId: "validate", phaseLabel: language === "en" ? "Validating level" : "校验关卡", fraction: 0 });
    const result = await generateBuilderPlaytestPack(project, {
      mode: "deep",
      onProgress: (next) => {
        if (!mountedRef.current) return;
        setProgress(next);
        setPhaseLog((log) => (log[log.length - 1] === next.phaseLabel ? log : [...log, next.phaseLabel].slice(-6)));
      },
    });
    if (!mountedRef.current) return;
    setBusy(false);
    setProgress(null);
    if (!result.ok) {
      setFailure({ error: result.error, details: result.details });
      onStatus(language === "en" ? "WebGPU bake failed. Fix the issue, then bake again." : "WebGPU 烘焙失败，修好后再重新烘焙。");
      return;
    }
    if (!result.webgpuAvailable) {
      setWebgpuSupported(false);
      blockWithoutWebGpu();
      return;
    }
    setPointerVersion((value) => value + 1);
    setNotice({
      persisted: result.persistence.persisted,
      webgpuAvailable: result.webgpuAvailable,
      sizeBytes: result.sizeBytes,
      cached: result.cached,
      manifest: result.manifest,
      diagnostics: result.diagnostics,
    });
    onStatus(
      result.cached
        ? language === "en"
          ? "WebGPU deep playtest pack is up to date."
          : "WebGPU 深度试玩包已是最新。"
        : language === "en"
          ? "WebGPU deep playtest pack baked."
          : "WebGPU 深度试玩包已烘焙完成。",
    );
    if (launchAfter) {
      const pointer = latestBuilderPackPointer(project.projectId, "cooked-glb");
      launchDeep(pointer);
    }
  };

  const runWebGpuPlaytest = () => {
    if (busy) return;
    if (!browserHasWebGpu()) {
      setWebgpuSupported(false);
      blockWithoutWebGpu();
      return;
    }
    if (blocked) {
      onShowIssues?.();
      return;
    }
    if (deepStatus === "ready") {
      launchDeep(deepPointer);
      return;
    }
    void generateDeep(true);
  };

  useEffect(() => {
    if (!playtestRequestToken || handledRequestTokenRef.current === playtestRequestToken) return;
    handledRequestTokenRef.current = playtestRequestToken;
    runWebGpuPlaytest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playtestRequestToken]);

  const primary = busy
    ? {
        label: language === "en" ? "Baking…" : "烘焙中…",
        run: () => {},
        title: language === "en" ? "Preparing the WebGPU deep playtest pack" : "正在准备 WebGPU 深度试玩包",
        icon: "▸",
      }
    : !webgpuSupported
      ? {
          label: language === "en" ? "Needs WebGPU" : "需要 WebGPU",
          run: blockWithoutWebGpu,
          title: language === "en" ? "Builder playtest now requires WebGPU" : "Builder 试玩现在必须使用 WebGPU",
          icon: "!",
        }
      : blocked
        ? {
            label: language === "en" ? `${blockedCount} more step${blockedCount === 1 ? "" : "s"}` : `还差 ${blockedCount} 步`,
            run: () => onShowIssues?.(),
            title:
              language === "en"
                ? "Level isn't playable yet — click to see what's missing"
                : "关卡还不可玩——点击查看缺什么",
            icon: "!",
          }
        : deepStatus === "ready"
          ? {
              label: language === "en" ? "WebGPU Playtest" : "WebGPU 试玩",
              run: () => launchDeep(deepPointer),
              title: language === "en" ? "Open the current deep-baked WebGPU playtest" : "打开当前 WebGPU 深度烘焙试玩",
              icon: "▶",
            }
          : {
              label: stale
                ? language === "en"
                  ? "Rebake & Play"
                  : "重新烘焙试玩"
                : language === "en"
                  ? "Bake & Play"
                  : "烘焙并试玩",
              run: () => void generateDeep(true),
              title:
                language === "en"
                  ? "Bake the current project as a WebGPU deep pack, then open playtest"
                  : "把当前项目烘焙成 WebGPU 深度包，然后打开试玩",
              icon: "▶",
            };

  return (
    <div className="builder-pack-cluster">
      <button
        type="button"
        className={`builder-primary builder-pack-button builder-pack-primary ${stale && !blocked ? "stale" : ""} ${blocked || !webgpuSupported ? "blocked" : ""}`}
        onClick={primary.run}
        disabled={busy}
        title={primary.title}
      >
        <span className="builder-pack-primary-icon" aria-hidden="true">{primary.icon}</span>
        <span className="builder-pack-primary-label">{primary.label}</span>
        {stale && !blocked ? (
          <i
            className="builder-pack-stale-dot"
            title={language === "en" ? "Level edited — WebGPU pack is out of date" : "关卡已修改，WebGPU 试玩包过期"}
          />
        ) : null}
      </button>
      {notice ? (
        <button
          type="button"
          className="builder-pack-more"
          title={language === "en" ? "WebGPU pack details" : "WebGPU 试玩包详情"}
          onClick={() => setPopOpen((value) => !value)}
        >
          ⓘ
        </button>
      ) : null}

      {busy && progress ? (
        <div className="builder-pack-pop" role="status">
          <div className="builder-pack-pop-title">{language === "en" ? "Baking the WebGPU playtest pack" : "正在烘焙 WebGPU 试玩包"}</div>
          <div className="builder-pack-bar">
            <i style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
          </div>
          <ul className="builder-pack-log">
            {phaseLog.map((phase, index) => (
              <li key={`${phase}-${index}`} className={index === phaseLog.length - 1 ? "running" : "done"}>
                <i>{index === phaseLog.length - 1 ? "▸" : "✓"}</i>
                {phase}
                {index === phaseLog.length - 1 && progress.detail ? <em> · {progress.detail}</em> : null}
              </li>
            ))}
          </ul>
          <div className="builder-pack-phase">
            <span />
            <em>{Math.round(progress.fraction * 100)}%</em>
          </div>
        </div>
      ) : null}

      {!busy && failure ? (
        <div className="builder-pack-pop error" role="alert">
          <div className="builder-pack-pop-title">{language === "en" ? "WebGPU playtest unavailable" : "WebGPU 试玩不可用"}</div>
          <p>{failure.error}</p>
          {failure.details && failure.details.length > 0 ? (
            <details className="builder-pack-failure-details">
              <summary>{language === "en" ? "Planner details" : "规划详情"}</summary>
              <ul>
                {failure.details.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="builder-pack-pop-actions">
            <button type="button" onClick={() => void generateDeep(false)}>
              {language === "en" ? "Retry bake" : "重试烘焙"}
            </button>
            <button type="button" onClick={() => setFailure(null)}>✕</button>
          </div>
        </div>
      ) : null}

      {!busy && !failure && notice && popOpen ? (
        <div className="builder-pack-pop ok" role="status">
          <div className="builder-pack-pop-title">
            {language === "en" ? "WebGPU deep pack ready" : "WebGPU 深度包已就绪"} · {formatSize(notice.sizeBytes)}
            {notice.cached ? (language === "en" ? " · cache reused" : " · 复用缓存") : ""}
          </div>
          <p className="builder-pack-diag">{packDiagnosticsLine(notice, language)}</p>
          <p className="builder-pack-storage">
            {notice.persisted
              ? language === "en"
                ? "Local playtest pack saved"
                : "本地试玩包已保存"
              : language === "en"
                ? "The browser may clear the playtest pack when storage runs low"
                : "浏览器可能会在空间不足时清理试玩包"}
          </p>
          {notice.manifest && notice.manifest.fallbackProxyModels.length + notice.manifest.missingModels.length > 0 ? (
            <p className="builder-pack-warn">
              {language === "en"
                ? `${notice.manifest.fallbackProxyModels.length + notice.manifest.missingModels.length} model(s) still use simplified shapes.`
                : `${notice.manifest.fallbackProxyModels.length + notice.manifest.missingModels.length} 个模型暂用简化造型代替。`}
            </p>
          ) : null}
          {notice.diagnostics.length > 0 ? <p className="builder-pack-warn">{localizeBuilderPackDiagnostic(notice.diagnostics[0], language)}</p> : null}
          <div className="builder-pack-pop-actions">
            <button type="button" className="builder-primary" onClick={() => launchDeep(deepPointer)}>
              {language === "en" ? "▶ WebGPU Playtest" : "▶ WebGPU 试玩"}
            </button>
            <button type="button" onClick={() => setPopOpen(false)}>✕</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function packDiagnosticsLine(notice: PackNotice, language: GameLanguage) {
  const en = language === "en";
  const parts = [
    `Raw：${notice.webgpuAvailable ? (en ? "WebGPU required" : "强制 WebGPU") : en ? "Blocked" : "已拦截"}`,
    `${en ? "Pack" : "包"}：${en ? "Deep" : "深度"}`,
  ];
  if (notice.manifest) {
    const fallback = notice.manifest.fallbackProxyModels.length + notice.manifest.missingModels.length;
    parts.push(
      `${en ? "Models" : "模型"}：${notice.manifest.cookedModels.length} ${en ? "real" : "真实"}${
        fallback > 0 ? ` / ${fallback} ${en ? "simplified" : "简化"}` : ""
      }`,
    );
    if (notice.manifest.nativeRawEnemyModels.length > 0) {
      parts.push(`${en ? "Robots" : "机器人"}：${en ? "native Raw" : "原生 Raw"}（${notice.manifest.nativeRawEnemyModels.length}）`);
    }
    const nativeWeapons = Object.values(RAW_VIEWMODEL_MODEL_KEYS).every((key) => notice.manifest?.cookedModels.includes(key));
    const bakedHands = Object.values(RAW_VIEWMODEL_HAND_MODEL_KEYS).every((key) => notice.manifest?.cookedModels.includes(key));
    parts.push(
      `${en ? "Weapon" : "武器"}：${
        bakedHands ? (en ? "new hands overlay" : "新手部叠层") : en ? "fallback hands" : "回退手部"
      }${nativeWeapons ? (en ? " / cooked weapon" : " / 烘焙武器") : ""}`,
    );
  }
  parts.push(`${en ? "Storage" : "存储"}：${notice.persisted ? (en ? "protected" : "已保护") : en ? "unprotected" : "未保护"}`);
  return parts.join(" · ");
}

export function localizeBuilderPackDiagnostic(line: string, language: GameLanguage) {
  if (language !== "en") return line;
  const deepBake = /^WGPU 资源包缺少 ([^：]+)：(.+)。深度试玩会只为这些缺口临时烘焙。$/.exec(line);
  if (deepBake) return `WGPU resource pack is missing ${deepBake[1]}: ${deepBake[2]}. Deep playtest will temporarily bake only these gaps.`;
  const runtimeBlocked = /^WGPU 资源包缺少 ([^：]+)：(.+)。请重新生成 Raw 资源包；运行时不会临时烘焙 GLB。$/.exec(line);
  if (runtimeBlocked) return `WGPU resource pack is missing ${runtimeBlocked[1]}: ${runtimeBlocked[2]}. Regenerate the Raw resource pack; runtime will not temporarily bake GLBs.`;
  return line;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
