import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, DoubleSide, Group, MeshBasicMaterial, PointLight } from "three";
import { resolveRoomPresentation, type RoomPickupLayoutDefinition } from "../../game/config/RoomPresentationRegistry";
import type { GameWorld } from "../../game/core/GameWorld";
import type { PickupState } from "../../game/entities/EntityTypes";
import { pickupVisualIntentForType } from "../../game/visual/PickupVisualIntent";
import { EnvironmentModelInstance } from "../environment/EnvironmentModelInstance";

interface PickupRendererProps {
  world: GameWorld;
}

export function PickupRenderer({ world }: PickupRendererProps) {
  const indices = useMemo(() => Array.from({ length: 5 }, (_, index) => index), []);
  const pickupLayout = useMemo(() => (world.level.map ? resolveRoomPresentation(world.level.map)?.pickupLayout ?? null : null), [world.level.map]);
  return (
    <group>
      {indices.map((index) => (
        <PickupVisual key={index} index={index} world={world} pickupLayout={pickupLayout} />
      ))}
    </group>
  );
}

function PickupVisual({ index, world, pickupLayout }: { index: number; world: GameWorld; pickupLayout: RoomPickupLayoutDefinition | null }) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Group>(null);
  const repairRef = useRef<Group>(null);
  const rodRef = useRef<Group>(null);
  const pistolRef = useRef<Group>(null);
  const breachMissileRef = useRef<Group>(null);
  const coreGroundGlowRef = useRef<MeshBasicMaterial>(null);
  const coreHaloGlowRef = useRef<MeshBasicMaterial>(null);
  const coreRingGlowRef = useRef<MeshBasicMaterial>(null);
  const repairGlowRef = useRef<MeshBasicMaterial>(null);
  const coreLightRef = useRef<PointLight>(null);
  const energyGlowColor = pickupLayout?.energyGlowColor ?? "#66efff";
  const repairBeaconColor = pickupLayout?.repairBeaconColor ?? "#ff8a74";
  const energyGlowIntensity = pickupLayout?.energyGlowIntensity ?? 1.05;
  const coreIntent = pickupVisualIntentForType("coreCell");
  const repairIntent = pickupVisualIntentForType("repairKit");
  const rodIntent = pickupVisualIntentForType("ironRod");
  const pistolIntent = pickupVisualIntentForType("pistol");
  const breachMissileIntent = pickupVisualIntentForType("breachMissile");

  useFrame(({ clock }) => {
    const pickup = findPickup(world, index);
    const group = groupRef.current;
    if (!group) return;

    if (!pickup) {
      group.visible = false;
      return;
    }

    const intent = pickupVisualIntentForType(pickup.type);
    const three = intent?.three;
    const pulse = 0.5 + Math.sin(clock.elapsedTime * (pickup.type === "coreCell" ? 6 : 4.2) + index) * 0.5;
    group.visible = true;
    group.position.copy(pickup.position);
    group.position.y = (three?.groupBaseY ?? 0.48) + Math.sin(clock.elapsedTime * 3 + index) * (three?.hoverAmplitude ?? 0.025);
    group.rotation.x = 0;
    group.rotation.z = 0;
    group.rotation.y = three?.idleYawAmplitude
      ? Math.sin(clock.elapsedTime * 1.15 + index) * three.idleYawAmplitude
      : group.rotation.y + (three?.spinStep ?? 0.018);
    group.scale.setScalar((three?.groupBaseScale ?? 1.02) + pulse * (three?.pulseScale ?? 0.035));
    if (coreRef.current) coreRef.current.visible = pickup.type === "coreCell";
    if (repairRef.current) repairRef.current.visible = pickup.type === "repairKit";
    if (rodRef.current) rodRef.current.visible = pickup.type === "ironRod";
    if (pistolRef.current) pistolRef.current.visible = pickup.type === "pistol";
    if (breachMissileRef.current) breachMissileRef.current.visible = pickup.type === "breachMissile";
    if (coreGroundGlowRef.current) coreGroundGlowRef.current.opacity = pickup.type === "coreCell" ? 0.2 + pulse * 0.18 : 0;
    if (coreHaloGlowRef.current) coreHaloGlowRef.current.opacity = pickup.type === "coreCell" ? 0.25 + pulse * 0.24 : 0;
    if (coreRingGlowRef.current) coreRingGlowRef.current.opacity = pickup.type === "coreCell" ? 0.36 + pulse * 0.3 : 0;
    if (repairGlowRef.current) repairGlowRef.current.opacity = pickup.type === "repairKit" ? 0.15 + pulse * 0.1 : 0;
    if (coreLightRef.current) coreLightRef.current.intensity = pickup.type === "coreCell" ? (0.78 + pulse * 0.72) * energyGlowIntensity : 0;
  });

  return (
    <group ref={groupRef} visible={false}>
      <group ref={coreRef}>
        <mesh position={[0, -0.13, 0]} scale={[0.36, 0.58, 0.36]}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial
            ref={coreHaloGlowRef}
            color={energyGlowColor}
            transparent
            opacity={0.36}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.13, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.74, 0.74, 0.74]}>
          <torusGeometry args={[0.46, 0.018, 10, 56]} />
          <meshBasicMaterial
            ref={coreRingGlowRef}
            color="#72f2ff"
            transparent
            opacity={0.48}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.13, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.54, 0.54, 0.54]}>
          <torusGeometry args={[0.42, 0.011, 8, 40]} />
          <meshBasicMaterial
            color="#d7ad54"
            transparent
            opacity={0.34}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.13, 0]} scale={[0.13, 0.22, 0.13]}>
          <sphereGeometry args={[1, 24, 12]} />
          <meshBasicMaterial color="#e9ffff" transparent opacity={0.82} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.43, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.92, 0.92, 1]}>
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial
            ref={coreGroundGlowRef}
            color={energyGlowColor}
            transparent
            opacity={0.28}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            side={DoubleSide}
          />
        </mesh>
        <pointLight ref={coreLightRef} color={energyGlowColor} position={[0, 0.12, 0]} intensity={1.05 * energyGlowIntensity} distance={4.5} decay={2.0} />
        {coreIntent ? <EnvironmentModelInstance modelKey={coreIntent.modelKey} position={coreIntent.three.modelPosition} scale={coreIntent.three.modelScale} /> : null}
      </group>
      <group ref={repairRef} visible={false}>
        <mesh position={[0, -0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.78, 0.78, 1]}>
          <torusGeometry args={[0.72, 0.018, 10, 40]} />
          <meshBasicMaterial
            ref={repairGlowRef}
            color={repairBeaconColor}
            transparent
            opacity={0.2}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {repairIntent ? (
          <EnvironmentModelInstance modelKey={repairIntent.modelKey} position={repairIntent.three.modelPosition} scale={repairIntent.three.modelScale} />
        ) : null}
      </group>
      <group ref={rodRef} visible={false}>
        {rodIntent ? <EnvironmentModelInstance modelKey={rodIntent.modelKey} rotation={rodIntent.three.modelRotation} scale={rodIntent.three.modelScale} castShadow receiveShadow /> : null}
      </group>
      <group ref={pistolRef} visible={false}>
        {pistolIntent ? (
          <EnvironmentModelInstance modelKey={pistolIntent.modelKey} rotation={pistolIntent.three.modelRotation} scale={pistolIntent.three.modelScale} castShadow receiveShadow />
        ) : null}
      </group>
      <group ref={breachMissileRef} visible={false}>
        {breachMissileIntent ? (
          <EnvironmentModelInstance
            modelKey={breachMissileIntent.modelKey}
            rotation={breachMissileIntent.three.modelRotation}
            scale={breachMissileIntent.three.modelScale}
            castShadow
            receiveShadow
          />
        ) : null}
      </group>
    </group>
  );
}

function findPickup(world: GameWorld, index: number): PickupState | undefined {
  let seen = 0;
  for (const pickup of world.pickups) {
    if (pickup.collected) continue;
    if (seen === index) return pickup;
    seen += 1;
  }
  return undefined;
}
