import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Camera, Scene } from "three";
import { GameLoop } from "../game/core/GameLoop";
import type { GameWorld } from "../game/core/GameWorld";
import { createDefaultGameSystems } from "../game/core/createDefaultGameSystems";
import { isExitCinematicViewActive } from "../game/core/ExitCinematicView";
import { KeyboardMouseInput } from "../input/KeyboardMouseInput";
import { recordHumanProtocolPerfEvent } from "../game/core/RenderSpikeRecorder";
import { Arena } from "./Arena";
import { CameraRig } from "./CameraRig";
import { Lighting } from "./Lighting";
import { EnemyRobotRenderer } from "./enemies/EnemyRobotRenderer";
import { EffectsLayer } from "./effects/EffectsLayer";
import { FirstPersonProtagonistView } from "./player/FirstPersonProtagonistView";

interface SceneRootProps {
  world: GameWorld;
  onFrameReady?: () => void;
}

export function SceneRoot({ world, onFrameReady }: SceneRootProps) {
  const { gl, scene, camera } = useThree();
  const input = useMemo(() => new KeyboardMouseInput(), []);
  const loop = useMemo(() => new GameLoop(createDefaultGameSystems()), []);
  const reportedFrameReady = useRef(false);

  useEffect(() => {
    input.attach(gl.domElement);
    return () => input.detach();
  }, [gl.domElement, input]);

  useEffect(() => {
    world.renderWarmupComplete = false;
    let cancelled = false;
    const warmup = window.setTimeout(() => {
      const renderer = gl as typeof gl & {
        compileAsync?: (scene: Scene, camera: Camera) => Promise<void>;
      };
      const completeWarmup = () => {
        if (!cancelled) {
          world.renderWarmupComplete = true;
          recordHumanProtocolPerfEvent(world, "compile_warmup_complete");
        }
      };
      const compilePromise = renderer.compileAsync?.(scene, camera);
      if (compilePromise) {
        compilePromise.then(completeWarmup, completeWarmup);
        return;
      }
      gl.compile(scene, camera);
      completeWarmup();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(warmup);
    };
  }, [camera, gl, scene, world]);

  useFrame(({ camera }, delta) => {
    loop.update(world, delta, { input, camera });
    if (!reportedFrameReady.current) {
      reportedFrameReady.current = true;
      window.requestAnimationFrame(() => onFrameReady?.());
    }
  }, -100);

  const exitCinematic = isExitCinematicViewActive(world);

  return (
    <>
      <Lighting world={world} />
      <CameraRig world={world} />
      <Arena world={world} />
      {exitCinematic ? null : <EnemyRobotRenderer world={world} />}
      <FirstPersonProtagonistView world={world} />
      {exitCinematic ? null : <EffectsLayer world={world} />}
    </>
  );
}
