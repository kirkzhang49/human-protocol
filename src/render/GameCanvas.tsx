import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { builderRuntimePackRequestForLevel } from "../build/runtime-pack/BuilderRuntimePackRequest";
import { hasBuilderRuntimePackForLevel } from "../build/runtime-pack/BuilderRuntimePackStore";
import type { GameWorld } from "../game/core/GameWorld";

const RawWebGpuCanvas = lazy(() => import("./raw-webgpu/RawWebGpuCanvas").then((module) => ({ default: module.RawWebGpuCanvas })));
const ThreeGameCanvas = lazy(() => import("./ThreeGameCanvas").then((module) => ({ default: module.ThreeGameCanvas })));

function compatModeRequested() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("compat") === "1";
}

function webGpuRequired() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("requireWebGpu") === "1";
}

// Browsers without WebGPU (older Safari, Firefox) expose no navigator.gpu. Skip
// mounting the raw path entirely there so they go straight to the WebGL renderer
// instead of mount -> failed init -> fallback (which flashes + logs a scary
// error). On Safari/iOS 18+ and Chrome/Edge navigator.gpu exists, so the WebGPU
// path is unchanged. ?compat=1 also forces the WebGL path as a manual escape
// hatch if a browser's WebGPU is present but misbehaving.
function webGpuAvailable() {
  return typeof navigator !== "undefined" && !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

interface GameCanvasProps {
  world: GameWorld;
  onReady?: () => void;
}

export function GameCanvas({ world, onReady }: GameCanvasProps) {
  const [rawWebGpuFallbackReason, setRawWebGpuFallbackReason] = useState<string | null>(null);
  const fallBackToThree = useCallback((message: string) => {
    setRawWebGpuFallbackReason(message);
  }, []);
  const requireWebGpu = webGpuRequired();

  useEffect(() => {
    setRawWebGpuFallbackReason(null);
  }, [world.level.id]);

  // Generated /build levels can run on Raw WebGPU when a local playtest pack
  // exists in IndexedDB; otherwise (or with ?compat=1) they use the Three/R3F
  // config path. Official campaign levels never wait on this check.
  const generatedLevel = world.level.authoringProfile === "generated";
  const [generatedPackState, setGeneratedPackState] = useState<"checking" | "available" | "none">("none");

  useEffect(() => {
    if (!generatedLevel || compatModeRequested()) {
      setGeneratedPackState("none");
      return;
    }
    let active = true;
    setGeneratedPackState("checking");
    hasBuilderRuntimePackForLevel(world.level.id, builderRuntimePackRequestForLevel(world.level.id))
      .then((available) => {
        if (active) setGeneratedPackState(available ? "available" : "none");
      })
      .catch(() => {
        if (active) setGeneratedPackState("none");
      });
    return () => {
      active = false;
    };
  }, [generatedLevel, world.level.id]);

  if (generatedLevel && generatedPackState === "checking") {
    return <div className="game-canvas" />;
  }

  if (requireWebGpu && !webGpuAvailable()) {
    return <WebGpuRequiredBlock reason="This playtest requires WebGPU. Open it in a WebGPU-capable Chrome/Edge profile and launch it from Builder again." />;
  }

  if (requireWebGpu && generatedLevel && generatedPackState === "none") {
    return <WebGpuRequiredBlock reason="The WebGPU playtest pack is missing. Return to Builder and run the deep bake again." />;
  }

  if (requireWebGpu && rawWebGpuFallbackReason) {
    return <WebGpuRequiredBlock reason={rawWebGpuFallbackReason} />;
  }

  if (!rawWebGpuFallbackReason && webGpuAvailable() && !compatModeRequested() && (!generatedLevel || generatedPackState === "available")) {
    return (
      <div className="game-canvas">
        <Suspense fallback={null}>
          <RawWebGpuCanvas world={world} onFailure={fallBackToThree} onFrameReady={onReady} />
        </Suspense>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="game-canvas" />}>
      <ThreeGameCanvas world={world} onReady={onReady} />
    </Suspense>
  );
}

function WebGpuRequiredBlock({ reason }: { reason: string }) {
  return (
    <div className="game-canvas game-canvas-webgpu-required" role="alert">
      <strong>WebGPU required</strong>
      <span>{reason}</span>
    </div>
  );
}
