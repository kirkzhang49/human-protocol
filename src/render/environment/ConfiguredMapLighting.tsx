import { useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, DoubleSide, Object3D, Quaternion, Vector3, type RectAreaLight } from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import {
  resolveRoomPresentation,
  resolveRoomRelativePosition,
  type ResolvedRoomPresentation,
  type RoomLightingAreaDefinition,
  type RoomLightingDefinition,
  type RoomLightingFloorGlowDefinition,
  type RoomLightingPointDefinition,
  type RoomLightingSpotDefinition,
} from "../../game/config/RoomPresentationRegistry";
import { createPropLocalLights } from "../../game/config/PropLocalLightRegistry";
import type { LevelMapConfig, Vec3Tuple } from "../../game/config/schema/levelConfig";
import type { GameWorld } from "../../game/core/GameWorld";
import {
  findRenderDoorById,
  resolveRenderLightPosition,
  selectRenderLights,
  shouldRenderPresetLight,
} from "../../game/core/RenderLightBudget";

let rectAreaLightUniformsInitialized = false;

export function ConfiguredMapLighting({ world }: { world: GameWorld }) {
  const map = world.level.map;
  const presentation = resolveRoomPresentation(map);
  if (map && presentation?.lighting) {
    return <PresetMapLighting map={map} presentation={presentation} world={world} />;
  }

  const exitUnlocked = world.level.map?.doors.some((door) => door.visualKey === "service_elevator_door" && world.canOpenDoor(door));
  const lockdown = world.session.mapProgress.activeEnvironmentStateIds.includes("level_01_lockdown_dim");
  const elevatorAccent = exitUnlocked ? "#64f6ff" : "#ff4f43";

  return (
    <group>
      <pointLight position={[-4.4, 2.2, 4.2]} color="#7defff" intensity={lockdown ? 2.0 : 2.8} distance={9.5} decay={1.6} />
      <pointLight position={[1.2, 2.6, -0.6]} color="#b8fbff" intensity={lockdown ? 1.4 : 2.2} distance={11} decay={1.7} />
      <pointLight position={[-6.7, 1.65, -0.2]} color="#54e8ff" intensity={lockdown ? 1.35 : 2.05} distance={8.5} decay={1.8} />
      <pointLight position={[4.1, 1.55, -4.25]} color={elevatorAccent} intensity={exitUnlocked ? 2.3 : 1.35} distance={7.5} decay={1.85} />
      {map ? <PropLocalMapLighting map={map} world={world} /> : null}
      <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[11.5, 8.5, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#75ebff" transparent opacity={lockdown ? 0.035 : 0.055} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PropLocalMapLighting({ map, world }: { map: LevelMapConfig; world: GameWorld }) {
  const configuredLights = useMemo(() => createPropLocalLights(map), [map]);
  const fallbackPresentation = useMemo(() => ({ overrides: {} }) as ResolvedRoomPresentation, []);
  const lights = selectRenderLights(configuredLights, map, world);
  if (lights.length === 0) return null;
  return (
    <>
      {lights.map(({ light, canCastShadow }) => (
        <PresetLight
          key={light.id}
          light={light}
          map={map}
          presentation={fallbackPresentation}
          world={world}
          canCastShadow={canCastShadow}
        />
      ))}
    </>
  );
}

function PresetMapLighting({
  map,
  presentation,
  world,
}: {
  map: LevelMapConfig;
  presentation: ResolvedRoomPresentation;
  world: GameWorld;
}) {
  const configuredLights = useMemo(
    () => [...(presentation.lighting?.lights ?? []), ...createPropLocalLights(map)],
    [map, presentation.lighting?.lights],
  );
  const lights = selectRenderLights(configuredLights, map, world);
  return (
    <group>
      {lights.map(({ light, canCastShadow }) => (
        <PresetLight
          key={light.id}
          light={light}
          map={map}
          presentation={presentation}
          world={world}
          canCastShadow={canCastShadow}
        />
      ))}
    </group>
  );
}

function PresetLight({
  light,
  map,
  presentation,
  world,
  canCastShadow,
}: {
  light: RoomLightingDefinition;
  map: LevelMapConfig;
  presentation: ResolvedRoomPresentation;
  world: GameWorld;
  canCastShadow: boolean;
}) {
  if (!shouldRenderPresetLight(light, world)) return null;
  if (light.type === "floor_glow") {
    return <PresetFloorGlow light={light} map={map} world={world} />;
  }
  if (light.type === "spot") {
    return <PresetSpotLight light={light} map={map} presentation={presentation} world={world} canCastShadow={canCastShadow} />;
  }
  if (light.type === "area") {
    return <PresetAreaLight light={light} map={map} presentation={presentation} world={world} />;
  }
  return <PresetPointLight light={light} map={map} presentation={presentation} world={world} />;
}

function PresetPointLight({
  light,
  map,
  presentation,
  world,
}: {
  light: RoomLightingPointDefinition;
  map: LevelMapConfig;
  presentation: ResolvedRoomPresentation;
  world: GameWorld;
}) {
  const lockdown = world.session.mapProgress.activeEnvironmentStateIds.includes("level_01_lockdown_dim");
  const door = light.doorId ? findRenderDoorById(map, light.doorId) : null;
  const color = door ? (world.canOpenDoor(door) ? light.unlockedColor ?? light.color : light.lockedColor ?? light.color) : light.color;
  const overrideScale = light.overrideScale ? Number(presentation.overrides[light.overrideScale] ?? 1) : 1;
  const intensity = (lockdown ? light.lockdownIntensity ?? light.intensity : light.intensity) * (Number.isFinite(overrideScale) ? overrideScale : 1);
  const position = resolveLightPosition(map, light);

  return <pointLight position={position} color={color} intensity={intensity} distance={light.distance} decay={light.decay} />;
}

function PresetAreaLight({
  light,
  map,
  presentation,
  world,
}: {
  light: RoomLightingAreaDefinition;
  map: LevelMapConfig;
  presentation: ResolvedRoomPresentation;
  world: GameWorld;
}) {
  if (!rectAreaLightUniformsInitialized) {
    RectAreaLightUniformsLib.init();
    rectAreaLightUniformsInitialized = true;
  }

  const areaRef = useRef<RectAreaLight>(null);
  const lockdown = world.session.mapProgress.activeEnvironmentStateIds.includes("level_01_lockdown_dim");
  const door = light.doorId ? findRenderDoorById(map, light.doorId) : null;
  const color = door ? (world.canOpenDoor(door) ? light.unlockedColor ?? light.color : light.lockedColor ?? light.color) : light.color;
  const overrideScale = light.overrideScale ? Number(presentation.overrides[light.overrideScale] ?? 1) : 1;
  const intensity = (lockdown ? light.lockdownIntensity ?? light.intensity : light.intensity) * (Number.isFinite(overrideScale) ? overrideScale : 1);
  const position = resolveLightPosition(map, light);
  const targetPosition = resolveLightTargetPosition(map, light);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.lookAt(targetPosition[0], targetPosition[1], targetPosition[2]);
    area.updateMatrixWorld();
  }, [position[0], position[1], position[2], targetPosition[0], targetPosition[1], targetPosition[2]]);

  return <rectAreaLight ref={areaRef} position={position} color={color} intensity={intensity} width={light.width} height={light.height} />;
}

function PresetSpotLight({
  light,
  map,
  presentation,
  world,
  canCastShadow,
}: {
  light: RoomLightingSpotDefinition;
  map: LevelMapConfig;
  presentation: ResolvedRoomPresentation;
  world: GameWorld;
  canCastShadow: boolean;
}) {
  const target = useMemo(() => new Object3D(), []);
  const lockdown = world.session.mapProgress.activeEnvironmentStateIds.includes("level_01_lockdown_dim");
  const door = light.doorId ? findRenderDoorById(map, light.doorId) : null;
  const color = door ? (world.canOpenDoor(door) ? light.unlockedColor ?? light.color : light.lockedColor ?? light.color) : light.color;
  const overrideScale = light.overrideScale ? Number(presentation.overrides[light.overrideScale] ?? 1) : 1;
  const intensity = (lockdown ? light.lockdownIntensity ?? light.intensity : light.intensity) * (Number.isFinite(overrideScale) ? overrideScale : 1);
  const position = resolveLightPosition(map, light);
  const targetPosition = resolveLightTargetPosition(map, light);
  const beam = useMemo(
    () => computeSpotBeam(position, targetPosition, light),
    [
      position[0],
      position[1],
      position[2],
      targetPosition[0],
      targetPosition[1],
      targetPosition[2],
      light.beamLengthScale,
      light.beamOpacity,
      light.beamRadius,
    ],
  );
  target.position.set(targetPosition[0], targetPosition[1], targetPosition[2]);
  const castsGameplayShadow = Boolean(light.castShadow) && canCastShadow;

  return (
    <>
      <primitive object={target} />
      {beam ? (
        <mesh position={beam.position} quaternion={beam.quaternion} renderOrder={-8}>
          <cylinderGeometry args={[beam.radius, beam.radius * 0.22, beam.length, 24, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={beam.opacity}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            side={DoubleSide}
          />
        </mesh>
      ) : null}
      <spotLight
        position={position}
        target={target}
        color={color}
        intensity={intensity}
        distance={light.distance}
        angle={light.angle}
        penumbra={light.penumbra}
        decay={light.decay}
        castShadow={castsGameplayShadow}
        shadow-bias={light.shadowBias ?? -0.00018}
        shadow-mapSize={[1024, 1024]}
      />
    </>
  );
}

function computeSpotBeam(position: Vec3Tuple, targetPosition: Vec3Tuple, light: RoomLightingSpotDefinition) {
  const opacity = light.beamOpacity ?? 0;
  if (opacity <= 0) return null;
  const start = new Vector3(position[0], position[1], position[2]);
  const end = new Vector3(targetPosition[0], targetPosition[1], targetPosition[2]);
  const direction = end.clone().sub(start);
  const fullLength = direction.length();
  if (fullLength <= 0.01) return null;
  const lengthScale = Math.max(0.12, Math.min(1, light.beamLengthScale ?? 0.82));
  const beamLength = fullLength * lengthScale;
  const center = start.clone().add(direction.multiplyScalar(lengthScale * 0.5));
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), end.clone().sub(start).normalize());
  const radius = Math.max(0.04, light.beamRadius ?? Math.tan(light.angle) * beamLength * 0.38);
  return {
    position: [center.x, center.y, center.z] as Vec3Tuple,
    quaternion,
    length: beamLength,
    radius,
    opacity: Math.max(0, Math.min(0.16, opacity)),
  };
}

function PresetFloorGlow({ light, map, world }: { light: RoomLightingFloorGlowDefinition; map: LevelMapConfig; world: GameWorld }) {
  const lockdown = world.session.mapProgress.activeEnvironmentStateIds.includes("level_01_lockdown_dim");
  const door = light.doorId ? findRenderDoorById(map, light.doorId) : null;
  const color = door ? (world.canOpenDoor(door) ? light.unlockedColor ?? light.color : light.lockedColor ?? light.color) : light.color;
  const position = resolveLightPosition(map, light);
  const scale = light.scale ?? resolveRoomRelativeScale(map, light.roomId, light.scaleRoomRelative ?? [0.5, 0.5]);

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[scale[0], scale[1], 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={lockdown ? light.lockdownOpacity ?? light.opacity : light.opacity}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function resolveLightPosition(
  map: LevelMapConfig,
  light: RoomLightingPointDefinition | RoomLightingSpotDefinition | RoomLightingAreaDefinition | RoomLightingFloorGlowDefinition,
): Vec3Tuple {
  return resolveRenderLightPosition(map, light);
}

function resolveLightTargetPosition(map: LevelMapConfig, light: RoomLightingSpotDefinition | RoomLightingAreaDefinition): Vec3Tuple {
  if (light.target) return light.target;
  if (light.targetRoomRelative) return resolveRoomRelativePosition(map, light.targetRoomId ?? light.roomId, light.targetRoomRelative);
  return [0, 0.08, 0];
}

function resolveRoomRelativeScale(
  map: LevelMapConfig,
  roomId: string | undefined,
  scaleRoomRelative: readonly [number, number],
): readonly [number, number] {
  const room = (roomId ? map.rooms.find((candidate) => candidate.id === roomId) : null) ?? map.rooms[0];
  if (!room) return [1, 1];
  const [sx, , sz] = room.bounds.size;
  return [sx * scaleRoomRelative[0], sz * scaleRoomRelative[1]];
}
