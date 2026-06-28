import { resolveRoomPresentation } from "../game/config/RoomPresentationRegistry";
import type { GameWorld } from "../game/core/GameWorld";

export function Lighting({ world }: { world?: GameWorld }) {
  const lighting = resolveRoomPresentation(world?.level.map)?.lighting;
  if (lighting) {
    const ambient = lighting.ambient;
    const directional = lighting.directional ?? { color: "#b8fbff", intensity: 0.82, position: [0, 13, 7.5] as const };
    return (
      <>
        <ambientLight color={ambient.color} intensity={Math.max(0.08, ambient.intensity)} />
        <hemisphereLight args={[ambient.color, lighting.fog.color, lighting.hemisphereIntensity ?? Math.max(0.42, ambient.intensity * 2.8)]} />
        <directionalLight
          castShadow={lighting.shadows.enabled}
          color={directional.color ?? ambient.color}
          position={directional.position}
          intensity={directional.intensity}
          shadow-bias={lighting.shadows.directionalBias ?? -0.00008}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={0.24} />
      <hemisphereLight args={["#b8efff", "#03070b", 0.95]} />
      <directionalLight
        castShadow
        position={[0, 14, 8]}
        intensity={1.18}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[0, 3.6, 2]} color="#ffffff" intensity={0.62} distance={9} />
      <pointLight position={[-8, 4.2, 5]} color="#75e7ff" intensity={1.95} distance={17} />
      <pointLight position={[8, 4.2, -4]} color="#75e7ff" intensity={1.45} distance={16} />
      <pointLight position={[0, 3.8, -7]} color="#ff5a50" intensity={0.38} distance={8} />
    </>
  );
}
