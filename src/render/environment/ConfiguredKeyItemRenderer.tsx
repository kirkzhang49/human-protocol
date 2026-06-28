import { useFrame } from "@react-three/fiber";
import { useCallback, useRef, type RefObject } from "react";
import { AdditiveBlending, DoubleSide, Group, MeshBasicMaterial, PointLight, type Object3D } from "three";
import { modelKeyForKeyVisual } from "../../assets/environmentModelAssets";
import type { LevelKeyItemDefinition, LevelRoomDefinition } from "../../game/config/schema/levelConfig";
import type { GameWorld } from "../../game/core/GameWorld";
import { isRoomRenderVisible } from "../../game/core/RenderVisibility";
import { resolveKeyItemMaterial, resolveMapVisual } from "../../game/visual/AssetResolver";
import { EnvironmentModelInstance } from "./EnvironmentModelInstance";
import { polishRouteOutputOrbObject, routeOutputOrbAccentForVisualKey } from "./routeOutputOrbMaterial";

export function ConfiguredKeyItemRenderer({ world }: { world: GameWorld }) {
  const map = world.level.map;
  if (!map) return null;

  return (
    <group>
      {map.keyItems.filter((item) => isRoomRenderVisible(world, item.roomId)).map((item) => (
        <KeyItemMarker
          key={item.id}
          world={world}
          item={item}
          room={map.rooms.find((room) => room.id === item.roomId)}
        />
      ))}
    </group>
  );
}

function KeyItemMarker({
  world,
  item,
  room,
}: {
  world: GameWorld;
  item: LevelKeyItemDefinition;
  room?: LevelRoomDefinition;
}) {
  const rootRef = useRef<Group>(null);
  const groundRef = useRef<MeshBasicMaterial>(null);
  const ringRef = useRef<MeshBasicMaterial>(null);
  const beamRef = useRef<MeshBasicMaterial>(null);
  const lightRef = useRef<PointLight>(null);
  const innerLightRef = useRef<PointLight>(null);
  const innerGlowRef = useRef<MeshBasicMaterial>(null);
  const material = resolveKeyItemMaterial(item);
  const visual = resolveMapVisual(item.visualKey);
  const initialPosition = world.keyItemPosition(item);
  const [initialX, , initialZ] = initialPosition;
  const isLargeKey = item.visualKey === "large_yellow_key";
  const isRouteKey = item.visualKey === "route_access_chip";
  const isRouteOutputOrb = /^route_output_orb_[1-4]$/.test(item.visualKey);
  const largeKeyScale = Math.max(2.05, resolveMapVisual("large_yellow_key").scale * 1.18);
  const scale = isLargeKey ? largeKeyScale : isRouteKey ? largeKeyScale * 0.7 : isRouteOutputOrb ? 1.35 : Math.max(1.08, visual.scale * 1.35);
  const modelKey = modelKeyForKeyVisual(item.visualKey);
  const accent = isRouteOutputOrb ? routeOutputOrbAccentForVisualKey(item.visualKey) : isRouteKey ? material.accent : room?.geometry?.accentColor ?? material.accent;
  const baseY = isLargeKey || isRouteKey ? 0.18 : isRouteOutputOrb ? 0.08 : 0.14;
  const configureRouteOutputOrbObject = useCallback((object: Object3D) => {
    if (isRouteOutputOrb) polishRouteOutputOrbObject(object, accent);
  }, [accent, isRouteOutputOrb]);

  useFrame(({ clock }) => {
    const root = rootRef.current;
    if (!root) return;
    const collected = world.session.mapProgress.collectedKeyItemIds.includes(item.id);
    const available = world.isConfiguredKeyItemAvailable(item);
    root.visible = !collected && available;
    if (!root.visible) return;
    const [x, , z] = world.keyItemPosition(item);
    const pulse = 0.5 + Math.sin(clock.elapsedTime * (isLargeKey ? 5.2 : isRouteKey || isRouteOutputOrb ? 4.9 : 4.4) + item.id.length) * 0.5;
    root.position.set(x, baseY + Math.sin(clock.elapsedTime * 3.1 + item.id.length) * 0.04, z);
    root.rotation.y += isLargeKey ? 0.024 : isRouteKey || isRouteOutputOrb ? 0.026 : 0.018;
    root.scale.setScalar(1 + pulse * (isLargeKey ? 0.045 : isRouteKey || isRouteOutputOrb ? 0.04 : 0.032));
    if (groundRef.current) groundRef.current.opacity = (isLargeKey || isRouteOutputOrb ? 0.34 : 0.24) + pulse * 0.18;
    if (ringRef.current) ringRef.current.opacity = (isLargeKey || isRouteOutputOrb ? 0.52 : 0.34) + pulse * 0.24;
    if (beamRef.current) beamRef.current.opacity = (isLargeKey || isRouteKey || isRouteOutputOrb ? 0.1 : 0.05) + pulse * (isRouteKey || isRouteOutputOrb ? 0.11 : 0.07);
    if (lightRef.current) lightRef.current.intensity = (isLargeKey ? 1.8 : isRouteOutputOrb ? 1.38 : isRouteKey ? 1.5 : 1.05) + pulse * (isLargeKey ? 1.2 : isRouteOutputOrb ? 0.82 : isRouteKey ? 0.9 : 0.62);
    if (innerLightRef.current) innerLightRef.current.intensity = isRouteOutputOrb ? 1.05 + pulse * 0.85 : 0;
    if (innerGlowRef.current) innerGlowRef.current.opacity = isRouteOutputOrb ? 0.22 + pulse * 0.12 : 0;
  });

  return (
    <group ref={rootRef} position={[initialX, baseY, initialZ]} visible={!world.session.mapProgress.collectedKeyItemIds.includes(item.id) && world.isConfiguredKeyItemAvailable(item)}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.42 * scale, 0.96 * scale, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={groundRef} color={accent} transparent opacity={0.42} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
      <PickupVisibilityBeacon color={accent} scale={scale} strong={isLargeKey || isRouteKey || isRouteOutputOrb} ringRef={ringRef} beamRef={beamRef} />
      <pointLight ref={lightRef} color={accent} position={[0, (isRouteOutputOrb ? 0.28 : 0.45) * scale, 0]} intensity={isLargeKey ? 2.1 : isRouteOutputOrb ? 1.55 : isRouteKey ? 1.7 : 1.1} distance={isLargeKey ? 5.2 : isRouteOutputOrb ? 2.4 : isRouteKey ? 4.8 : 3.4} decay={2} />
      <EnvironmentModelInstance modelKey={modelKey} position={[0, 0, 0]} scale={scale} configureObject={isRouteOutputOrb ? configureRouteOutputOrbObject : undefined} />
      {isRouteOutputOrb ? <RouteOutputOrbInternalLight accent={accent} scale={scale} lightRef={innerLightRef} glowRef={innerGlowRef} /> : null}
      <KeyItemReadabilityKit accent={accent} scale={scale} large={isLargeKey || isRouteKey || isRouteOutputOrb} route={isRouteKey || isRouteOutputOrb} />
      <mesh position={[0, 0.22 * scale, 0.38 * scale]} scale={[0.62 * scale, 0.035 * scale, 0.035 * scale]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.86} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RouteOutputOrbInternalLight({
  accent,
  scale,
  lightRef,
  glowRef,
}: {
  accent: string;
  scale: number;
  lightRef: RefObject<PointLight>;
  glowRef: RefObject<MeshBasicMaterial>;
}) {
  return (
    <group position={[0, 0.28 * scale, 0]}>
      <pointLight ref={lightRef} color={accent} position={[0, 0, 0]} intensity={1.25} distance={1.65} decay={2} />
      <mesh scale={[0.085 * scale, 0.085 * scale, 0.085 * scale]}>
        <sphereGeometry args={[1, 24, 14]} />
        <meshBasicMaterial ref={glowRef} color={accent} transparent opacity={0.26} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.17 * scale, 0.006 * scale, 8, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={0.42} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function KeyItemReadabilityKit({ accent, scale, large, route }: { accent: string; scale: number; large: boolean; route: boolean }) {
  const cardY = large ? 0.2 : route ? 0.38 : 0.34;
  return (
    <group>
      <mesh position={[0, 0.08 * scale, 0]} scale={[0.58 * scale, 0.1 * scale, 0.42 * scale]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color={route ? "#0a1d24" : "#1c221f"} metalness={0.55} roughness={0.48} emissive={accent} emissiveIntensity={route ? 0.16 : 0.08} />
      </mesh>
      <mesh position={[0, 0.15 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[(route ? 0.52 : 0.43) * scale, 0.012 * scale, 8, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={route ? 0.68 : 0.52} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {!large ? (
        <group position={[0, cardY * scale, 0]} rotation={[-0.22, 0.18, 0.02]}>
          <mesh scale={[0.38 * scale, 0.025 * scale, 0.24 * scale]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={route ? "#102b34" : "#d5a849"} metalness={0.65} roughness={0.28} emissive={route ? accent : "#6e4a08"} emissiveIntensity={route ? 0.18 : 0.08} />
          </mesh>
          <mesh position={[0.02 * scale, 0.018 * scale, 0]} scale={[0.26 * scale, 0.01 * scale, 0.14 * scale]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={route ? "#baffff" : "#57f2ff"} transparent opacity={route ? 0.9 : 0.72} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[-0.15 * scale, 0.022 * scale, 0.07 * scale]} scale={[0.055 * scale, 0.012 * scale, 0.055 * scale]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={route ? accent : "#fff0a8"} transparent opacity={0.88} toneMapped={false} />
          </mesh>
          {route ? (
            <mesh position={[0.22 * scale, 0.02 * scale, -0.02 * scale]} scale={[0.08 * scale, 0.012 * scale, 0.2 * scale]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color={accent} transparent opacity={0.82} toneMapped={false} />
            </mesh>
          ) : null}
        </group>
      ) : null}
      {route ? (
        <group>
          <mesh position={[0, 0.54 * scale, 0]} rotation={[-0.22, -0.18, 0.04]} scale={[0.46 * scale, 0.018 * scale, 0.12 * scale]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={accent} transparent opacity={0.74} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[-0.22 * scale, 0.42 * scale, -0.08 * scale]} rotation={[-0.18, 0.72, -0.05]} scale={[0.2 * scale, 0.018 * scale, 0.12 * scale]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#12333d" metalness={0.64} roughness={0.3} emissive={accent} emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[0.22 * scale, 0.42 * scale, 0.08 * scale]} rotation={[-0.18, -0.72, 0.05]} scale={[0.2 * scale, 0.018 * scale, 0.12 * scale]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#12333d" metalness={0.64} roughness={0.3} emissive={accent} emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[0, 0.72 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.24 * scale, 0.01 * scale, 8, 40]} />
            <meshBasicMaterial color="#d8ffff" transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function PickupVisibilityBeacon({
  color,
  scale,
  strong,
  ringRef,
  beamRef,
}: {
  color: string;
  scale: number;
  strong: boolean;
  ringRef: RefObject<MeshBasicMaterial>;
  beamRef: RefObject<MeshBasicMaterial>;
}) {
  const ringOpacity = strong ? 0.72 : 0.42;
  const beamOpacity = strong ? 0.12 : 0.055;
  return (
    <group>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.54 * scale, 0.018 * scale, 10, 48]} />
        <meshBasicMaterial ref={ringRef} color={color} transparent opacity={ringOpacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.42 * scale, 0]}>
        <cylinderGeometry args={[0.055 * scale, 0.16 * scale, 0.82 * scale, 24, 1, true]} />
        <meshBasicMaterial ref={beamRef} color={color} transparent opacity={beamOpacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}
