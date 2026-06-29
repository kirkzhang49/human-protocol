import { Preload } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import {
  ageBridgeEnabled,
  ageGroundingMode,
  ageVisualProfileEnabled,
  createHumanAgeDebugBridge,
  formatHumanAgeBridgeStats,
  humanEscapeRoomVisualProfileFor,
  type HumanAgeDebugBridge,
} from "../../adapters/age";
import { preloadEnemyModelAssets } from "../../assets/enemyModelAssets";
import { loadRawWebGpuLevelAssetsOrRuntimePack } from "../../build/runtime-pack/BuilderRuntimePackAssets";
import { playerConfig } from "../../game/config/playerConfig";
import { createDefaultGameSystems } from "../../game/core/createDefaultGameSystems";
import { applyFocusRevealCameraBlend, focusRevealCameraApproach } from "../focusRevealCamera";
import { GameLoop } from "../../game/core/GameLoop";
import type { GameWorld } from "../../game/core/GameWorld";
import type { RenderQualityTier } from "../../game/core/RenderPerformance";
import { recordHumanProtocolPerfEvent } from "../../game/core/RenderSpikeRecorder";
import { KeyboardMouseInput } from "../../input/KeyboardMouseInput";
import { resolveRawThreeEnemyOracleModeFromParams } from "./RawEnemyOracleMode";
import { parseRawViewmodelMode, type RawViewmodelMode } from "./RawViewmodelMode";
import { RawWebGpuLevelRenderer } from "./RawWebGpuLevelRenderer";
import { setRawMobileMode } from "./RawWebGpuQuality";
import { isMobileViewport } from "../../input/deviceProfile";
import { FirstPersonProtagonistView } from "../player/FirstPersonProtagonistView";

const RAW_VIEWMODEL_CAMERA_FOV = 72;
const EnemyThreeOracle = lazy(() => import("../enemies/EnemyThreeOracle").then((module) => ({ default: module.EnemyThreeOracle })));

interface RawWebGpuCanvasProps {
  world: GameWorld;
  onFailure?: (message: string) => void;
  onFrameReady?: () => void;
}

export function RawWebGpuCanvas({ world, onFailure, onFrameReady }: RawWebGpuCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [ageOverlay, setAgeOverlay] = useState<string | null>(null);
  const [gpuProfileOverlay, setGpuProfileOverlay] = useState<string | null>(null);
  // Effective mode after the renderer resolves asset availability. The desired
  // player-facing path is Three, while raw remains an explicit experiment.
  const [effectiveViewmodelMode, setEffectiveViewmodelMode] = useState<RawViewmodelMode>(() => rawWebGpuViewmodelMode());
  const enemyOracle = rawThreeEnemyOracleMode();

  useEffect(() => {
    if (!enemyOracle.enabled) return;
    let disposed = false;
    preloadEnemyModelAssets().catch((error: unknown) => {
      if (disposed) return;
      console.warn("[HumanProtocol] Enemy model oracle prewarm failed; focus reveals keep the Raw fallback.", error);
    });
    return () => {
      disposed = true;
    };
  }, [enemyOracle.enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let animationFrame = 0;
    let renderer: RawWebGpuLevelRenderer | null = null;
    // Experimental AGE paths; all default to off so the plain URL is untouched.
    const ageFlags = {
      bridge: ageBridgeEnabled(),
      visualProfile: ageVisualProfileEnabled(),
      grounding: ageGroundingMode(),
    };
    let ageDebugBridge: HumanAgeDebugBridge | null = null;
    let ageFrameCounter = 0;
    let gpuProfileFrame = 0;
    const viewmodelMode = rawWebGpuViewmodelMode();
    const ageViewProjection = new Matrix4();
    const input = new KeyboardMouseInput();
    const loop = new GameLoop(createDefaultGameSystems());
    const camera = new PerspectiveCamera(72, 1, 0.05, 90);
    const cameraRig = createRawCameraRig(camera);
    const frameGovernor = createRawWebGpuFrameGovernor(rawWebGpuAutoRescueEnabled());
    let reportedFrameReady = false;
    let lastTime = performance.now();
    let elapsed = 0;

    const mobilePerformanceMode = isMobileViewport();
    world.renderPerformance.setMobileMode(mobilePerformanceMode);
    // Gate the heavy raw-WebGPU effects (full-res HDR offscreen post / bloom /
    // fxaa / GPU particle compute) for phones BEFORE the renderer is constructed
    // below — RawGpuParticlePass captures rawGpuParticlesEnabled() once in its
    // constructor, so the flag must be set first. Desktop passes false (no-op).
    setRawMobileMode(mobilePerformanceMode);
    world.renderPerformance.setDiagnosticTier(rawWebGpuInitialQualityTier());
    world.renderWarmupComplete = false;

    const tick = (time: number) => {
      if (disposed || !renderer) return;
      const rawDelta = Math.max(0.001, Math.min(0.08, (time - lastTime) / 1000));
      lastTime = time;
      elapsed += rawDelta;

      loop.update(world, rawDelta, { input, camera });
      cameraRig.update(world, rawDelta, elapsed);
      world.renderPerformance.update(rawDelta, { tierChangesEnabled: false });
      frameGovernor.update(world);
      try {
        renderer.render(canvas, world, camera);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Raw WebGPU render loop failed.";
        console.warn("[HumanProtocol] Raw WebGPU render loop failed; falling back to Three.js.", error);
        setFailure(message);
        onFailure?.(message);
        return;
      }
      if (!reportedFrameReady) {
        reportedFrameReady = true;
        window.requestAnimationFrame(() => onFrameReady?.());
      }
      // Poll the GPU profiler overlay a couple times a second (no-op unless
      // ?rawGpuProfile=1 armed timestamp queries on a supporting device).
      gpuProfileFrame += 1;
      if (gpuProfileFrame % 30 === 0) {
        const summary = renderer.gpuProfileOverlayText();
        setGpuProfileOverlay((current) => (current === summary ? current : summary));
      }
      if (ageDebugBridge) {
        ageFrameCounter += 1;
        if (ageFrameCounter % 60 === 0) {
          try {
            ageViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            const stats = ageDebugBridge.sample({
              world,
              camera: {
                viewMatrix: camera.matrixWorldInverse.elements,
                projectionMatrix: camera.projectionMatrix.elements,
                viewProjectionMatrix: ageViewProjection.elements,
                position: camera.position,
              },
              viewport: {
                width: Math.max(1, canvas.width),
                height: Math.max(1, canvas.height),
                pixelRatio: window.devicePixelRatio || 1,
              },
              deltaSeconds: rawDelta,
              elapsedSeconds: elapsed,
              raw: renderer.ageDebugParityStats(world),
            });
            setAgeOverlay(formatHumanAgeBridgeStats(stats));
            console.info("[HumanProtocol] AGE bridge", stats);
            recordHumanProtocolPerfEvent(world, "age_bridge_stats", {
              levelId: stats.levelId,
              planInstances: stats.planInstances,
              dynamicInstances: stats.frameDynamicInstances,
              contacts: stats.frameContacts,
              portals: stats.framePortals,
              openPortals: stats.frameOpenPortals,
              lightBudget: stats.lightBudget,
              rawSelectedLights: stats.raw?.selectedLights ?? -1,
              rawDynamicShadowPlanes: stats.raw?.dynamicShadowPlanes ?? -1,
              ageGroundingQuads: stats.raw?.ageGroundingQuads ?? -1,
              warnings: stats.warnings.length,
            });
          } catch (error) {
            console.warn("[HumanProtocol] AGE bridge sampling failed; disabling bridge overlay.", error);
            ageDebugBridge = null;
            setAgeOverlay(null);
          }
        }
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    input.attach(canvas);
    // Official play uses canonical builder-runtime packs; generated /build
    // levels fall through to their IndexedDB runtime pack inside this loader.
    loadRawWebGpuLevelAssetsOrRuntimePack(world.level.id)
      .then(async (assets) => ({
        assets,
        renderer: await RawWebGpuLevelRenderer.create(
          canvas,
          assets.plan,
          assets.geometryBuffer,
          assets.robotAnimationBridge,
          assets.cookedGltfLoaderManifest,
        ),
      }))
      .then(({ assets, renderer: createdRenderer }) => {
        if (disposed) {
          createdRenderer.dispose();
          return;
        }
        renderer = createdRenderer;
        if (ageFlags.visualProfile || ageFlags.grounding !== "off") {
          try {
            createdRenderer.configureAgeIntegration({
              visualProfile: ageFlags.visualProfile ? humanEscapeRoomVisualProfileFor(assets.plan) : null,
              groundingMode: ageFlags.grounding,
            });
            recordHumanProtocolPerfEvent(world, "age_integration_enabled", {
              levelId: world.level.id,
              visualProfile: ageFlags.visualProfile,
              groundingMode: ageFlags.grounding,
            });
          } catch (error) {
            console.warn("[HumanProtocol] AGE integration configuration failed; raw renderer continues unmodified.", error);
          }
        }
        if (ageFlags.bridge) {
          try {
            ageDebugBridge = createHumanAgeDebugBridge(assets.plan);
          } catch (error) {
            console.warn("[HumanProtocol] AGE bridge construction failed; bridge disabled.", error);
          }
        }
        const viewmodel = createdRenderer.configureViewmodel(viewmodelMode);
        setEffectiveViewmodelMode(viewmodel.mode);
        world.renderWarmupComplete = true;
        recordHumanProtocolPerfEvent(world, "raw_webgpu_backend_ready", {
          levelId: world.level.id,
          renderer: "raw-webgpu-proxy",
          assetSource: assets.source,
          viewmodelMode: viewmodel.mode,
          viewmodelAssetSource: viewmodel.assetSource,
          viewmodelArticulated: viewmodel.articulatedWeapons.join(",") || "none",
          viewmodelHands: viewmodel.hands.join(",") || "none",
          viewmodelHandFallbacks: viewmodel.handFallbacks.length,
          activeWeapon: world.player.currentWeapon,
          cookedGltfModels: assets.cookedGltfLoaderManifest?.summary?.modelCount ?? 0,
          cookedGltfAnimationClips: assets.cookedGltfLoaderManifest?.summary?.animationClipCount ?? 0,
          cookedGltfPreservationGapKinds: assets.cookedGltfLoaderManifest?.summary?.preservationGaps?.length ?? 0,
        });
        animationFrame = window.requestAnimationFrame(tick);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        const message = error instanceof Error ? error.message : "Raw WebGPU renderer failed.";
        console.warn("[HumanProtocol] Raw WebGPU backend failed.", error);
        setFailure(message);
        onFailure?.(message);
      });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      input.detach();
      renderer?.dispose();
    };
  }, [onFailure, onFrameReady, world]);

  return (
    <>
      <canvas ref={canvasRef} className="raw-webgpu-canvas" />
      {ageOverlay ? (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 8,
            left: 8,
            zIndex: 40,
            font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#9fe8ff",
            background: "rgba(6, 12, 16, 0.72)",
            padding: "6px 9px",
            borderRadius: 6,
            whiteSpace: "pre",
            pointerEvents: "none",
          }}
        >
          {ageOverlay}
        </div>
      ) : null}
      {gpuProfileOverlay ? (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 8,
            right: 8,
            zIndex: 40,
            font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#bfe8c2",
            background: "rgba(6, 12, 16, 0.72)",
            padding: "6px 9px",
            borderRadius: 6,
            whiteSpace: "pre",
            pointerEvents: "none",
          }}
        >
          {gpuProfileOverlay}
        </div>
      ) : null}
      {enemyOracle.enabled ? (
        <Suspense fallback={null}>
          <EnemyThreeOracle world={world} allEnemies={enemyOracle.allEnemies} showDebugUi={enemyOracle.showDebugUi} />
        </Suspense>
      ) : null}
      {effectiveViewmodelMode === "three" ? <RawWebGpuViewmodelOverlay world={world} /> : null}
      {failure && !onFailure ? (
        <div className="raw-webgpu-fallback" role="status" aria-live="polite">
          <strong>Raw WebGPU unavailable</strong>
          <span>{failure}</span>
        </div>
      ) : null}
    </>
  );
}

function RawWebGpuViewmodelOverlay({ world }: RawWebGpuCanvasProps) {
  return (
    <Canvas
      className="raw-webgpu-viewmodel-layer"
      dpr={[1, 1.2]}
      camera={{ position: [0, 0, 0], fov: RAW_VIEWMODEL_CAMERA_FOV, near: 0.05, far: 8 }}
      gl={{ alpha: true, premultipliedAlpha: false, antialias: true, depth: true, stencil: false, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.82} color="#f2eadc" />
      <directionalLight position={[2.5, 3.5, 2.2]} intensity={1.32} color="#fff1d6" />
      <directionalLight position={[-1.6, 1.4, -1.8]} intensity={0.18} color="#d8c8aa" />
      <FirstPersonProtagonistView world={world} />
      <Preload all />
    </Canvas>
  );
}

function rawWebGpuViewmodelMode(): RawViewmodelMode {
  const params = new URLSearchParams(window.location.search);
  return parseRawViewmodelMode(params.get("rawViewmodelMode"), params.get("rawViewmodel"), params.get("rawViewmodelExperimental"));
}

function rawThreeEnemyOracleMode() {
  return resolveRawThreeEnemyOracleModeFromParams(new URLSearchParams(window.location.search));
}

function rawWebGpuInitialQualityTier(): RenderQualityTier {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("rawQuality") ?? params.get("quality");
  if (requested === "high" || requested === "balanced" || requested === "rescue") return requested;
  return "balanced";
}

function rawWebGpuAutoRescueEnabled() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("rawAutoRescue") === "0") return false;
  // Weak phones need the balanced->rescue safety net on by default; desktop keeps
  // the opt-in (?rawAutoRescue=1) so its tier still clamps at balanced.
  return params.get("rawAutoRescue") === "1" || isMobileViewport();
}

function createRawWebGpuFrameGovernor(autoRescueEnabled: boolean) {
  let slowFrames = 0;
  let stableFrames = 0;
  let cooldownFrames = 90;

  return {
    update(world: GameWorld) {
      const perf = world.renderPerformance;
      const tier = perf.quality.tier;
      cooldownFrames = Math.max(0, cooldownFrames - 1);

      if (world.session.mode !== "playing") {
        slowFrames = 0;
        stableFrames = 0;
        return;
      }

      const average = perf.averageFrameMs;
      const latest = perf.lastFrameMs;
      const slow =
        tier === "high"
          ? average > 21.5 || latest > 30
          : tier === "balanced"
            ? average > 31.5 || latest > 54
            : false;
      const stable =
        tier === "rescue"
          ? average < 17.6 && latest < 20
          : tier === "balanced"
            ? average < 17.1 && latest < 19
            : false;

      if (slow) {
        slowFrames += latest > 44 ? 3 : 1;
        stableFrames = 0;
      } else if (stable) {
        stableFrames += 1;
        slowFrames = Math.max(0, slowFrames - 1);
      } else {
        slowFrames = Math.max(0, slowFrames - 1);
        stableFrames = Math.max(0, stableFrames - 1);
      }

      if (cooldownFrames > 0) return;

      const nextDown = rawWebGpuLowerTier(tier, autoRescueEnabled);
      if (nextDown !== tier && slowFrames >= (tier === "high" ? 10 : 24)) {
        perf.setDiagnosticTier(nextDown);
        slowFrames = 0;
        stableFrames = 0;
        cooldownFrames = 150;
        recordHumanProtocolPerfEvent(world, "raw_webgpu_quality_tier_changed", {
          from: tier,
          to: nextDown,
          reason: "raw_frame_pressure",
          averageFrameMs: Number(average.toFixed(2)),
          latestFrameMs: Number(latest.toFixed(2)),
        });
        return;
      }

      const nextUp = rawWebGpuHigherTier(tier);
      if (nextUp !== tier && stableFrames >= (tier === "rescue" ? 480 : 720)) {
        perf.setDiagnosticTier(nextUp);
        slowFrames = 0;
        stableFrames = 0;
        cooldownFrames = 360;
        recordHumanProtocolPerfEvent(world, "raw_webgpu_quality_tier_changed", {
          from: tier,
          to: nextUp,
          reason: "raw_frame_stable",
          averageFrameMs: Number(average.toFixed(2)),
          latestFrameMs: Number(latest.toFixed(2)),
        });
      }
    },
  };
}

function rawWebGpuLowerTier(tier: RenderQualityTier, autoRescueEnabled: boolean): RenderQualityTier {
  if (tier === "high") return "balanced";
  if (tier === "balanced" && autoRescueEnabled) return "rescue";
  if (tier === "balanced") return "balanced";
  return "rescue";
}

function rawWebGpuHigherTier(tier: RenderQualityTier): RenderQualityTier {
  if (tier === "rescue") return "balanced";
  if (tier === "balanced") return "high";
  return "high";
}

function createRawCameraRig(camera: PerspectiveCamera) {
  const lookTarget = new Vector3();
  const shakeOffset = new Vector3();
  const cameraPosition = new Vector3();
  const revealPosition = new Vector3();
  const revealTarget = new Vector3();
  let lastRevealWasCameraCut = false;

  return {
    update(world: GameWorld, delta: number, elapsed: number) {
      const player = world.player;
      const shake = world.camera.shake;
      const rumble = world.camera.rumbleRemaining > 0 ? world.camera.rumble : 0;
      const rumbleEnvelope = rumble > 0 ? Math.min(1, world.camera.rumbleRemaining * 4) : 0;
      const seed = world.camera.shakeSeed;
      const recoil = player.weaponRecoil * 0.055;

      shakeOffset.set(
        Math.sin(elapsed * 55 + seed * 1.7) * shake * 0.1,
        Math.cos(elapsed * 45 + seed) * shake * 0.045,
        Math.sin(elapsed * 47 + seed * 2.4) * shake * 0.1 + recoil,
      );
      if (rumble > 0) {
        shakeOffset.x += Math.sin(elapsed * 17 + seed * 0.8) * rumble * rumbleEnvelope * 0.11;
        shakeOffset.y += Math.cos(elapsed * 13 + seed * 1.1) * rumble * rumbleEnvelope * 0.055;
        shakeOffset.z += Math.sin(elapsed * 11 + seed * 1.4) * rumble * rumbleEnvelope * 0.14;
      }

      cameraPosition.copy(player.position);
      cameraPosition.y += playerConfig.cockpitHeight;
      cameraPosition.add(shakeOffset);
      lookTarget.copy(cameraPosition).addScaledVector(player.aimDirection, 10);
      const combatFocus =
        world.camera.combatFocusTotal > 0
          ? Math.max(0, Math.min(1, world.camera.combatFocusRemaining / world.camera.combatFocusTotal)) * world.camera.combatFocusStrength
          : 0;
      if (combatFocus > 0.001) {
        lookTarget.lerp(world.camera.combatFocusTarget, Math.min(0.68, combatFocus));
        cameraPosition.addScaledVector(player.aimDirection, combatFocus * 0.18);
      }

      const reveal = world.session.activeFocusReveal;
      applyFocusRevealCameraBlend(reveal, cameraPosition, lookTarget, revealPosition, revealTarget);
      const snapReturnFromCameraCut = !reveal && lastRevealWasCameraCut;
      lastRevealWasCameraCut = Boolean(reveal?.cameraCut);

      camera.position.lerp(
        cameraPosition,
        1 - Math.exp(-focusRevealCameraApproach(reveal, { snapReturnFromCameraCut }) * delta),
      );
      camera.lookAt(lookTarget);
      camera.fov = 72 + world.camera.fovKick;
      camera.updateProjectionMatrix();
    },
  };
}
