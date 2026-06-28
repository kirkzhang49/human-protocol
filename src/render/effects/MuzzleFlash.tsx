import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Group, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import type { GameWorld } from "../../game/core/GameWorld";
import type { EffectState } from "../../game/entities/EntityTypes";
import { weaponSkins } from "../../game/skins/weaponSkins";

const FORWARD = new Vector3(0, 0, 1);

interface MuzzleFlashProps {
  world: GameWorld;
  index: number;
}

export function MuzzleFlash({ world, index }: MuzzleFlashProps) {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const quaternion = useMemo(() => new Quaternion(), []);
  const defaultSkin = weaponSkins.pulseRifle;

  useFrame(() => {
    const effect = findMuzzleFlash(world, index);
    const group = groupRef.current;
    if (!group) return;

    if (!effect) {
      group.visible = false;
      return;
    }

    const progress = effect.age / effect.lifetime;
    const fade = Math.max(0, 1 - progress);
    const skin = weaponSkins[world.player.currentWeapon];
    quaternion.setFromUnitVectors(FORWARD, effect.direction);
    group.visible = true;
    group.position.copy(effect.position);
    group.quaternion.copy(quaternion);
    group.scale.setScalar(effect.intensity * (0.24 + progress * 0.28));

    if (materialRef.current) {
      materialRef.current.color.set(skin.muzzleColor);
      materialRef.current.opacity = fade * 0.72;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.42, 18]} />
        <meshBasicMaterial
          ref={materialRef}
          color={defaultSkin.muzzleColor}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.09, 16, 10]} />
        <meshBasicMaterial
          color="#fff1b8"
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function findMuzzleFlash(world: GameWorld, index: number): EffectState | undefined {
  let seen = 0;
  for (const effect of world.effects) {
    if (effect.type === "muzzleFlash") {
      if (seen === index) return effect;
      seen += 1;
    }
  }
  return undefined;
}
