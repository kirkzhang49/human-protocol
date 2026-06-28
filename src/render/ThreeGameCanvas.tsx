import { Preload } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { resolveRoomPresentation } from "../game/config/RoomPresentationRegistry";
import type { GameWorld } from "../game/core/GameWorld";
import { isMobileViewport } from "../input/deviceProfile";
import { RuntimePerformanceGovernor } from "./RuntimePerformanceGovernor";
import { SceneRoot } from "./SceneRoot";

interface ThreeGameCanvasProps {
  world: GameWorld;
  onReady?: () => void;
}

export function ThreeGameCanvas({ world, onReady }: ThreeGameCanvasProps) {
  const mobilePerformanceMode = isMobileViewport();
  const presentation = resolveRoomPresentation(world.level.map);
  const lighting = presentation?.lighting;
  const fogColor = lighting?.fog.color ?? "#05070b";
  const fogNear = lighting?.fog.near ?? 18;
  const fogFar = presentation?.overrides.fogFar ?? lighting?.fog.far ?? 58;
  const bloomIntensity = lighting?.bloom.intensity ?? 0.82;
  const bloomThreshold = lighting?.bloom.threshold ?? 0.34;

  return (
    <div className="game-canvas">
      <Canvas
        shadows={!mobilePerformanceMode}
        dpr={mobilePerformanceMode ? [0.66, 1] : [1, 1.35]}
        camera={{ position: [0, 1.45, 0], fov: 72, near: 0.05, far: 90 }}
        gl={{ antialias: !mobilePerformanceMode, depth: true, stencil: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[fogColor]} />
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
        <SceneRoot world={world} onFrameReady={onReady} />
        <Preload all />
        <RuntimePerformanceGovernor
          world={world}
          mobilePerformanceMode={mobilePerformanceMode}
          bloomIntensity={bloomIntensity}
          bloomThreshold={bloomThreshold}
        />
      </Canvas>
    </div>
  );
}
