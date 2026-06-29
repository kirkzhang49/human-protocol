import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { isCoarsePointer, isMobileDevice } from "./input/deviceProfile";
import { preloadGameAssets } from "./assets/preloadGameAssets";
import type { GameLanguage } from "./game/core/GameSettings";
import { GameWorld } from "./game/core/GameWorld";
import { useExitPreviewController } from "./dev/useExitPreviewController";
import { playerStrings } from "./i18n/playerStrings";
import { RootMenuPage } from "./ui/RootMenuPage";
import { visibleProgressScale } from "./ui/guiMath";
import { GameErrorBoundary } from "./ui/GameErrorBoundary";
import { ArticleQuizOverlay } from "./ui/ArticleQuizOverlay";
import { ArchiveMergeOverlay } from "./ui/ArchiveMergeOverlay";
import { BossVitalityOverlay } from "./ui/BossVitalityOverlay";
import { GalleryReadingOverlay } from "./ui/GalleryReadingOverlay";
import { GameCanvas } from "./render/GameCanvas";
import { Crosshair } from "./ui/Crosshair";
import { CircuitGridOverlay } from "./ui/CircuitGridOverlay";
import { CodeLockOverlay } from "./ui/CodeLockOverlay";
import { ChoiceEventOverlay } from "./ui/ChoiceEventOverlay";
import { SequencePlaybackOverlay } from "./ui/SequencePlaybackOverlay";
import { SurveillanceMatchOverlay } from "./ui/SurveillanceMatchOverlay";
import { ValveMatrixOverlay } from "./ui/ValveMatrixOverlay";
import { RouteSwitchOverlay } from "./ui/RouteSwitchOverlay";
import { ConfigGraphOverlay } from "./ui/ConfigGraphOverlay";
import { DesktopAimOverlay } from "./ui/DesktopAimOverlay";
import { DialogueOverlay } from "./ui/DialogueOverlay";
import { GameFlowOverlay } from "./ui/GameFlowOverlay";
import { HUD } from "./ui/HUD";
import { MissionOverlay } from "./ui/MissionOverlay";
import { MobileControls } from "./ui/MobileControls";
import { PauseOverlay } from "./ui/PauseOverlay";
import { RenderSurgeOverlay } from "./ui/RenderSurgeOverlay";
import { RunProgressOverlay } from "./ui/RunProgressOverlay";
import { SystemSettingsButton } from "./ui/SystemSettingsButton";
import { ThreatRing } from "./ui/ThreatRing";
import { ToolCalibrationOverlay } from "./ui/ToolCalibrationOverlay";
import { UpgradeChoiceOverlay } from "./ui/UpgradeChoiceOverlay";
import { useCombatGuiLayout } from "./ui/useCombatGuiLayout";

const BuildPage = lazy(() => import("./build/BuildPage").then((module) => ({ default: module.BuildPage })));
const BuilderThumbnailCapturePage = lazy(() =>
  import("./build/BuilderThumbnailCapturePage").then((module) => ({ default: module.BuilderThumbnailCapturePage })),
);
const Image2StateLab = lazy(() => import("./ui/Image2StateLab").then((module) => ({ default: module.Image2StateLab })));
const BuilderAssetCullPage = lazy(() =>
  import("./build/BuilderAssetCullPage").then((module) => ({ default: module.BuilderAssetCullPage })),
);
const OfficialBuilderPage = import.meta.env.DEV
  ? lazy(() => import("./build/official-builder/OfficialBuilderPage").then((module) => ({ default: module.OfficialBuilderPage })))
  : null;

export default function App() {
  if (isOfficialBuildPage()) {
    if (!import.meta.env.DEV) {
      return (
        <GameErrorBoundary>
          <RootMenuPage />
        </GameErrorBoundary>
      );
    }
    if (isCoarsePointer()) {
      return <BuildDesktopOnlyNotice />;
    }
    return (
      <GameErrorBoundary>
        <Suspense fallback={<BuildLoading />}>
          {OfficialBuilderPage ? <OfficialBuilderPage /> : null}
        </Suspense>
      </GameErrorBoundary>
    );
  }
  if (isBuildPage()) {
    if (isCoarsePointer()) {
      return <BuildDesktopOnlyNotice />;
    }
    return (
      <GameErrorBoundary>
        <Suspense fallback={<BuildLoading />}>
          {import.meta.env.DEV && isThumbCaptureMode() ? (
            <BuilderThumbnailCapturePage />
          ) : import.meta.env.DEV && isImage2LabMode() ? (
            <Image2StateLab />
          ) : import.meta.env.DEV && isAssetCullMode() ? (
            <BuilderAssetCullPage />
          ) : (
            <BuildPage />
          )}
        </Suspense>
      </GameErrorBoundary>
    );
  }
  if (isRootMenuRoute()) {
    return (
      <GameErrorBoundary>
        <RootMenuPage />
      </GameErrorBoundary>
    );
  }
  return (
    <GameErrorBoundary>
      <GameExperience />
    </GameErrorBoundary>
  );
}

// The bare "/" route shows the root menu. "/play" and any direct game/preview
// deep-link (?level=, artPreview, exitPreview, …) still boot the game so existing
// QA tooling and dev previews keep working.
function isRootMenuRoute() {
  if (typeof window === "undefined") return false;
  const { pathname, search } = window.location;
  const isRoot = pathname === "/" || pathname === "" || pathname === "/index.html";
  if (!isRoot) return false;
  const params = new URLSearchParams(search);
  const gameIntent =
    params.has("level") ||
    params.has("levelId") ||
    params.get("artPreview") === "1" ||
    params.get("roomPreview") === "1" ||
    params.get("cleanArtPreview") === "1" ||
    params.get("exitPreview") === "1" ||
    params.has("builderTrial") ||
    params.has("debug");
  return !gameIntent;
}

function isThumbCaptureMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("thumbCapture") === "1";
}

function isImage2LabMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("image2Lab") === "1";
}

function isAssetCullMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("assetCull") === "1";
}

function isBuildPage() {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/build" || window.location.pathname === "/build/";
}

function isOfficialBuildPage() {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/build-official" || window.location.pathname === "/build-official/";
}

function GameExperience() {
  const world = useMemo(() => {
    const nextWorld = new GameWorld();
    const initialLevelId = initialLevelIdFromUrl();
    if (initialLevelId) {
      try {
        nextWorld.loadLevel(initialLevelId, "title");
      } catch (error) {
        console.warn(`[HumanProtocol] Could not load initial level "${initialLevelId}" from URL.`, error);
      }
    }
    return nextWorld;
  }, []);
  const boot = useAssetBoot();

  if (!boot.ready) {
    return <BootLoading progress={boot.progress} error={boot.error} language={world.settings.language} />;
  }

  return <PlayableGameExperience world={world} />;
}

function PlayableGameExperience({ world }: { world: GameWorld }) {
  const [levelRevision, setLevelRevision] = useState(world.levelRevision);
  const artPreview = isArtPreviewMode();
  const cleanArtPreview = isCleanArtPreviewMode();
  const exitPreview = useExitPreviewController(world, levelRevision);
  useCombatGuiLayout();
  useLandscapeLock();

  useEffect(() => world.subscribeLevelChanges(() => setLevelRevision(world.levelRevision)), [world]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__HUMAN_PROTOCOL_WORLD__ = world;
    return () => {
      delete window.__HUMAN_PROTOCOL_WORLD__;
    };
  }, [world]);

  useEffect(() => {
    document.documentElement.lang = world.settings.language === "zh" ? "zh-CN" : "en";
  }, [world]);

  return (
    <main className={artPreview ? "app-shell art-preview" : "app-shell"}>
      <GameCanvas key={`${world.level.id}-${levelRevision}`} world={world} onReady={exitPreview.handleCanvasReady} />
      {artPreview || cleanArtPreview || exitPreview.gameplayUiHidden ? null : (
        <>
          <HUD world={world} />
          <ThreatRing world={world} />
          <Crosshair world={world} />
          <MissionOverlay world={world} />
          <RenderSurgeOverlay world={world} />
          <RunProgressOverlay world={world} />
          <BossVitalityOverlay world={world} />
          <DesktopAimOverlay world={world} />
          <DialogueOverlay world={world} />
          <UpgradeChoiceOverlay world={world} />
          <ChoiceEventOverlay world={world} />
          <ArticleQuizOverlay world={world} />
          <CodeLockOverlay world={world} />
          <SequencePlaybackOverlay world={world} />
          <ToolCalibrationOverlay world={world} />
          <CircuitGridOverlay world={world} />
          <SurveillanceMatchOverlay world={world} />
          <ValveMatrixOverlay world={world} />
          <ArchiveMergeOverlay world={world} />
          <GalleryReadingOverlay world={world} />
          <RouteSwitchOverlay world={world} />
          <SystemSettingsButton world={world} />
          <PauseOverlay world={world} />
          <MobileControls world={world} />
          <ConfigGraphOverlay world={world} />
        </>
      )}
      {cleanArtPreview || exitPreview.exitCinematicUiHidden ? null : <GameFlowOverlay world={world} />}
      <LandscapeGuard language={world.settings.language} />
      {!exitPreview.canvasReady ? <BootLoading progress={1} language={world.settings.language} overlay /> : null}
    </main>
  );
}

function isArtPreviewMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("artPreview") === "1" || params.get("roomPreview") === "1";
}

function initialLevelIdFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("level") ?? params.get("levelId");
}

function isCleanArtPreviewMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("cleanArtPreview") === "1";
}

function LandscapeGuard({ language }: { language: "zh" | "en" }) {
  return (
    <div
      className="landscape-guard"
      role="dialog"
      aria-label={language === "en" ? "Human Protocol landscape required" : "Human Protocol 需要横屏"}
      aria-live="polite"
    >
      <span className="landscape-guard-device" aria-hidden="true" />
      <strong>{language === "en" ? "Rotate to landscape" : "请横屏游玩"}</strong>
      <p>
        {language === "en"
          ? "Turn your phone sideways. Controls, crosshair and weapon buttons are built for landscape play."
          : "手机请旋转到横屏。维修舱操作、准星和武器按钮会按横版布局显示。"}
      </p>
    </div>
  );
}

function BuildDesktopOnlyNotice() {
  return (
    <main
      className="app-shell"
      role="dialog"
      aria-live="polite"
      style={{
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        gap: "14px",
        padding: "32px",
      }}
    >
      <strong style={{ fontSize: "20px" }}>请在桌面端打开 /build</strong>
      <p style={{ maxWidth: "420px", lineHeight: 1.6, opacity: 0.82 }}>
        密室工坊使用拖拽式 2D / 3D 编辑器，需要鼠标或触控板。请在电脑浏览器中打开 /build。
        <br />
        Open <code>/build</code> on a desktop browser — the editor needs a mouse or trackpad.
      </p>
    </main>
  );
}

function useLandscapeLock() {
  useEffect(() => {
    const syncViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--human-mobile-vh", `${height}px`);
    };

    const requestLandscape = () => {
      if (!isMobileDevice()) return;
      // Best-effort portrait→landscape lock only. We intentionally do NOT call
      // requestFullscreen(): Chrome shows an intrusive, persistent "To exit full
      // screen, press and hold Esc" prompt on fullscreen entry. The LandscapeGuard
      // overlay still asks the player to rotate when needed.
      const orientation = window.screen?.orientation as (ScreenOrientation & { lock?: (orientation: string) => Promise<void> }) | undefined;
      orientation?.lock?.("landscape").catch(() => {});
    };

    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    window.visualViewport?.addEventListener("resize", syncViewportHeight);
    window.visualViewport?.addEventListener("scroll", syncViewportHeight);
    window.addEventListener("pointerdown", requestLandscape, { passive: true });
    window.addEventListener("touchstart", requestLandscape, { passive: true });
    window.addEventListener("keydown", requestLandscape);

    return () => {
      window.removeEventListener("resize", syncViewportHeight);
      window.visualViewport?.removeEventListener("resize", syncViewportHeight);
      window.visualViewport?.removeEventListener("scroll", syncViewportHeight);
      window.removeEventListener("pointerdown", requestLandscape);
      window.removeEventListener("touchstart", requestLandscape);
      window.removeEventListener("keydown", requestLandscape);
    };
  }, []);
}

function BuildLoading() {
  return (
    <main className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", opacity: 0.6 }}>Loading…</div>
    </main>
  );
}

function BootLoading({
  progress,
  error,
  language,
  overlay = false,
}: {
  progress: number;
  error?: string;
  language: GameLanguage;
  overlay?: boolean;
}) {
  const className = overlay ? "boot-shell boot-shell-overlay" : "app-shell boot-shell";
  const panel = <BootPanel progress={progress} error={error} language={language} />;
  return overlay ? <div className={className}>{panel}</div> : <main className={className}>{panel}</main>;
}

export function BootPanel({ progress, error, language }: { progress: number; error?: string; language: GameLanguage }) {
  const strings = playerStrings(language);
  return (
    <div className={`boot-panel${error ? " has-error" : ""}`} aria-live="polite">
      <div className="boot-spinner" aria-hidden="true">
        <i />
      </div>
      <span>{error ? strings.boot.failed : strings.boot.warmup}</span>
      <strong>{error ? "!" : `${Math.round(progress * 100)}%`}</strong>
      <div className="boot-bar">
        <i style={{ transform: `scaleX(${visibleProgressScale(progress)})` }} />
      </div>
      {error ? <p>{error}</p> : null}
    </div>
  );
}

function useAssetBoot() {
  const [boot, setBoot] = useState<{ ready: boolean; progress: number; error?: string }>({ ready: false, progress: 0 });

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();
    const includeEnvironmentModels = isArtPreviewMode() || isCleanArtPreviewMode();
    preloadGameAssets((progress) => {
      if (!cancelled) setBoot((state) => ({ ...state, progress }));
    }, { includeEnvironmentModels })
      .then(() => {
        const remaining = Math.max(0, 550 - (performance.now() - startedAt));
        window.setTimeout(() => {
          if (!cancelled) setBoot({ ready: true, progress: 1 });
        }, remaining);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Required game asset did not load.";
        setBoot({ ready: false, progress: 1, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return boot;
}

declare global {
  interface Window {
    __HUMAN_PROTOCOL_WORLD__?: GameWorld;
  }
}
