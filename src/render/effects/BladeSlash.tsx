import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, Group, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import type { GameWorld } from "../../game/core/GameWorld";
import type { EffectState } from "../../game/entities/EntityTypes";

const FORWARD = new Vector3(0, 0, 1);

interface BladeSlashProps {
  world: GameWorld;
  index: number;
}

export function BladeSlash({ world, index }: BladeSlashProps) {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const coreMaterialRef = useRef<MeshBasicMaterial>(null);
  const quaternion = useMemo(() => new Quaternion(), []);

  useFrame(() => {
    const effect = findBladeSlash(world, index);
    const group = groupRef.current;
    if (!group) return;

    if (!effect) {
      group.visible = false;
      return;
    }

    const progress = effect.age / effect.lifetime;
    const fade = Math.max(0, 1 - progress);
    quaternion.setFromUnitVectors(FORWARD, effect.direction);
    group.visible = true;
    group.position.copy(effect.position).addScaledVector(effect.direction, 1.38);
    group.position.y += 1.18;
    group.quaternion.copy(quaternion);
    group.rotateZ(-0.52 + progress * 0.28);
    group.scale.setScalar(effect.intensity * (0.62 + progress * 0.12));

    if (materialRef.current) materialRef.current.opacity = fade * 0.52;
    if (coreMaterialRef.current) coreMaterialRef.current.opacity = fade * 0.72;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0.2, 0.26, 0]} rotation={[0, 0, 0.34]}>
        <boxGeometry args={[1.15, 0.055, 0.035]} />
        <meshBasicMaterial
          ref={materialRef}
          color="#d6f6ff"
          transparent
          opacity={0.42}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[-0.06, 0.02, 0.02]} rotation={[0, 0, 0.22]}>
        <boxGeometry args={[0.86, 0.034, 0.028]} />
        <meshBasicMaterial
          ref={coreMaterialRef}
          color="#dff8ff"
          transparent
          opacity={0.68}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0.42, -0.1, -0.02]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.42, 0.025, 0.025]} />
        <meshBasicMaterial color="#91d8e6" transparent opacity={0.44} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh position={[-0.28, -0.18, 0.02]} rotation={[0, 0, 0.58]}>
        <boxGeometry args={[0.24, 0.018, 0.018]} />
        <meshBasicMaterial color="#9fe2ed" transparent opacity={0.22} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function findBladeSlash(world: GameWorld, index: number): EffectState | undefined {
  let seen = 0;
  for (const effect of world.effects) {
    if (effect.type === "bladeSlash") {
      if (seen === index) return effect;
      seen += 1;
    }
  }
  return undefined;
}
