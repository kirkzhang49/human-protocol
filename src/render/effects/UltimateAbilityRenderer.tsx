import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, DoubleSide, Group, MeshBasicMaterial, PointLight } from "three";
import { isEnvironmentModelKey } from "../../assets/environmentModelAssets";
import { ultimateAbilityConfig } from "../../game/config/ultimateAbilityConfig";
import type { GameWorld } from "../../game/core/GameWorld";
import { EnvironmentModelInstance } from "../environment/EnvironmentModelInstance";

interface UltimateAbilityRendererProps {
  world: GameWorld;
}

export function UltimateAbilityRenderer({ world }: UltimateAbilityRendererProps) {
  const rootRef = useRef<Group>(null);
  const cyanGlowRef = useRef<MeshBasicMaterial>(null);
  const amberGlowRef = useRef<MeshBasicMaterial>(null);
  const groundGlowRef = useRef<MeshBasicMaterial>(null);
  const lightRef = useRef<PointLight>(null);
  const coreModelRef = useRef<Group>(null);
  const missileModelRef = useRef<Group>(null);
  const coreModelKey = isEnvironmentModelKey(ultimateAbilityConfig.coreBomb.deployedWorldModelKey) ? ultimateAbilityConfig.coreBomb.deployedWorldModelKey : null;
  const missileModelKey = isEnvironmentModelKey(ultimateAbilityConfig.breachMissile.deployedWorldModelKey) ? ultimateAbilityConfig.breachMissile.deployedWorldModelKey : null;

  useFrame(({ clock }) => {
    const root = rootRef.current;
    if (!root) return;
    const deployed = world.session.deployedUltimate;
    if (!deployed || deployed.age < 0) {
      root.visible = false;
      return;
    }

    const pulse = 0.5 + Math.sin(clock.elapsedTime * 6.8 + deployed.id * 0.17) * 0.5;
    root.visible = deployed.phase !== "held";
    if (!root.visible) return;
    const isThrown = deployed.phase === "thrown";
    root.position.set(deployed.position[0], deployed.position[1], deployed.position[2]);
    root.rotation.set(isThrown ? deployed.age * 5.4 : 0, deployed.age * (isThrown ? 3.1 : 0.72), isThrown ? deployed.age * 2.6 : 0);
    root.scale.setScalar((isThrown ? 1.0 : 0.98) + pulse * (isThrown ? 0.018 : 0.035));
    if (coreModelRef.current) coreModelRef.current.visible = deployed.abilityId === "coreBomb";
    if (missileModelRef.current) missileModelRef.current.visible = deployed.abilityId === "breachMissile";

    if (cyanGlowRef.current) cyanGlowRef.current.opacity = 0.52 + pulse * 0.28;
    if (amberGlowRef.current) amberGlowRef.current.opacity = 0.26 + pulse * 0.22;
    if (groundGlowRef.current) groundGlowRef.current.opacity = isThrown ? 0 : 0.18 + pulse * 0.18;
    if (lightRef.current) lightRef.current.intensity = (isThrown ? 1.05 : 0.85) + pulse * 1.1;
  });

  return (
    <group ref={rootRef} visible={false}>
      <group ref={coreModelRef} visible={false}>
        {coreModelKey ? (
          <EnvironmentModelInstance modelKey={coreModelKey} position={[0, 0.02, 0]} scale={1} castShadow receiveShadow />
        ) : (
          <>
            <mesh position={[0, 0.18, 0]} scale={[0.27, 0.34, 0.27]}>
              <sphereGeometry args={[1, 28, 16]} />
              <meshStandardMaterial color="#15191b" emissive="#071014" emissiveIntensity={0.18} metalness={0.68} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0.19, 0]} scale={[0.145, 0.2, 0.145]}>
              <sphereGeometry args={[1, 24, 12]} />
              <meshBasicMaterial
                ref={cyanGlowRef}
                color="#92f7ff"
                transparent
                opacity={0.62}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.48, 0.48, 0.48]}>
              <torusGeometry args={[0.68, 0.026, 10, 64]} />
              <meshBasicMaterial ref={amberGlowRef} color="#ffd46d" transparent opacity={0.34} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 4]} scale={[0.22, 0.055, 0.22]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#d7b665" emissive="#6a4715" emissiveIntensity={0.25} metalness={0.44} roughness={0.28} />
            </mesh>
          </>
        )}
      </group>
      <group ref={missileModelRef} visible={false}>
        {missileModelKey ? <EnvironmentModelInstance modelKey={missileModelKey} position={[0, 0.08, 0]} rotation={[0, 0, 0]} scale={1} castShadow receiveShadow /> : null}
      </group>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.15, 1.15, 1]}>
        <circleGeometry args={[1, 56]} />
        <meshBasicMaterial
          ref={groundGlowRef}
          color="#69eaff"
          transparent
          opacity={0.2}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </mesh>
      <pointLight ref={lightRef} color="#79f4ff" position={[0, 0.38, 0]} intensity={1.1} distance={4.6} decay={2} />
    </group>
  );
}
