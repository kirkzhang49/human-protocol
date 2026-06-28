import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Group, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import type { GameWorld } from "../../game/core/GameWorld";
import type { EffectState, EffectType } from "../../game/entities/EntityTypes";

const FORWARD = new Vector3(0, 0, 1);

interface HitSparkProps {
  world: GameWorld;
  index: number;
  effectType: Extract<EffectType, "hitSpark" | "dashBurst">;
}

export function HitSpark({ world, index, effectType }: HitSparkProps) {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const glintMaterialRef = useRef<MeshBasicMaterial>(null);
  const quaternion = useMemo(() => new Quaternion(), []);
  const color = effectType === "dashBurst" ? "#64d7ff" : "#ffb43d";
  const glintColor = effectType === "dashBurst" ? "#8ef6ff" : "#ff7f42";

  useFrame(() => {
    const effect = findEffect(world, effectType, index);
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
    group.position.copy(effect.position);
    group.position.y += effectType === "dashBurst" ? 0.35 : 0.18;
    group.quaternion.copy(quaternion);
    group.scale.setScalar(effect.intensity * (0.55 + progress * 1.7));

    if (materialRef.current) {
      materialRef.current.opacity = fade * (effectType === "dashBurst" ? 0.52 : 0.46);
    }
    if (glintMaterialRef.current) {
      glintMaterialRef.current.opacity = fade * (effectType === "dashBurst" ? 0.2 : 0.16);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.08, 0.08, 1.05]} />
        <meshBasicMaterial
          ref={materialRef}
          color={color}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.035, 0.035, 0.46]} />
        <meshBasicMaterial
          ref={glintMaterialRef}
          color={glintColor}
          transparent
          opacity={0.16}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function findEffect(world: GameWorld, type: EffectType, index: number): EffectState | undefined {
  let seen = 0;
  for (const effect of world.effects) {
    if (effect.type === type) {
      if (seen === index) return effect;
      seen += 1;
    }
  }
  return undefined;
}
