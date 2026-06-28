import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, Mesh, MeshBasicMaterial, PointLight } from "three";
import type { GameWorld } from "../../game/core/GameWorld";

interface ThrusterGlowProps {
  world: GameWorld;
  position: readonly [number, number, number];
}

export function ThrusterGlow({ world, position }: ThrusterGlowProps) {
  const flameRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const lightRef = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    const player = world.player;
    const pulse = 0.85 + Math.sin(clock.elapsedTime * 24) * 0.15;
    const intensity = (player.isDashing ? 2.2 : player.isSprinting ? 1.05 : 0.46) * pulse;

    if (flameRef.current) {
      flameRef.current.scale.set(0.75 + intensity * 0.22, 1 + intensity * 0.44, 0.75 + intensity * 0.22);
    }
    if (materialRef.current) {
      materialRef.current.opacity = 0.28 + intensity * 0.28;
    }
    if (lightRef.current) {
      lightRef.current.intensity = intensity * 1.8;
    }
  });

  return (
    <group position={position}>
      <mesh ref={flameRef} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.17, 0.66, 18]} />
        <meshBasicMaterial
          ref={materialRef}
          color="#6ee7ff"
          transparent
          opacity={0.4}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={lightRef} color="#65dfff" intensity={0.8} distance={4} />
    </group>
  );
}
