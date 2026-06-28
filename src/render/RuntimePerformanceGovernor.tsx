import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { GameWorld } from "../game/core/GameWorld";
import { captureRenderBudgetSnapshot } from "../game/core/RenderBudgetSnapshot";
import { isHumanProtocolPerfCaptureEnabled, RenderSpikeRecorder } from "../game/core/RenderSpikeRecorder";

interface RuntimePerformanceGovernorProps {
  world: GameWorld;
  mobilePerformanceMode: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
}

export function RuntimePerformanceGovernor({
  world,
  mobilePerformanceMode,
  bloomIntensity,
  bloomThreshold,
}: RuntimePerformanceGovernorProps) {
  const { gl } = useThree();
  const [bloomEnabled, setBloomEnabled] = useState(() => world.renderPerformance.quality.bloomEnabled);
  const appliedPixelRatioRef = useRef(0);
  const appliedShadowRef = useRef<boolean | null>(null);
  const budgetSampleFrameRef = useRef(0);
  const diagnosticsEnabledRef = useRef(false);
  const spikeRecorderRef = useRef<RenderSpikeRecorder | null>(null);

  useEffect(() => {
    const changed = world.renderPerformance.setMobileMode(mobilePerformanceMode);
    if (changed) setBloomEnabled(world.renderPerformance.quality.bloomEnabled);
  }, [mobilePerformanceMode, world]);

  useEffect(() => {
    diagnosticsEnabledRef.current =
      typeof window !== "undefined" && (window.location.search.includes("perf=1") || import.meta.env.DEV);
    spikeRecorderRef.current = isHumanProtocolPerfCaptureEnabled() ? new RenderSpikeRecorder() : null;
    return () => {
      spikeRecorderRef.current?.dispose();
      spikeRecorderRef.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    const documentVisible = typeof document === "undefined" || !document.hidden;
    const renderTimingActive =
      world.renderWarmupComplete &&
      world.session.mode === "playing" &&
      !world.paused &&
      documentVisible;
    const changed = world.renderPerformance.update(renderTimingActive ? delta : 1 / 60, {
      tierChangesEnabled: renderTimingActive,
    });
    const quality = world.renderPerformance.quality;

    if (Math.abs(appliedPixelRatioRef.current - quality.maxPixelRatio) > 0.01) {
      gl.setPixelRatio(quality.maxPixelRatio);
      appliedPixelRatioRef.current = quality.maxPixelRatio;
    }

    if (appliedShadowRef.current !== quality.shadowsEnabled) {
      gl.shadowMap.enabled = quality.shadowsEnabled;
      gl.shadowMap.needsUpdate = true;
      appliedShadowRef.current = quality.shadowsEnabled;
    }

    if (changed && bloomEnabled !== quality.bloomEnabled) {
      setBloomEnabled(quality.bloomEnabled);
    }

    if (renderTimingActive) {
      spikeRecorderRef.current?.recordFrame(world, gl);
    }

    const diagnosticsEnabled = diagnosticsEnabledRef.current;
    if (!diagnosticsEnabled || !renderTimingActive) return;

    budgetSampleFrameRef.current += 1;
    if (typeof window !== "undefined" && budgetSampleFrameRef.current % 30 === 0) {
      const snapshot = captureRenderBudgetSnapshot(world);
      (window as typeof window & { __humanProtocolPerformance?: unknown }).__humanProtocolPerformance = snapshot;
      if (budgetSampleFrameRef.current % 120 === 0) {
        console.info("[HumanProtocol perf]", snapshot);
      }
    }
  }, -200);

  if (!bloomEnabled) return null;

  return (
    <EffectComposer multisampling={1}>
      <Bloom intensity={bloomIntensity} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.2} mipmapBlur />
    </EffectComposer>
  );
}
