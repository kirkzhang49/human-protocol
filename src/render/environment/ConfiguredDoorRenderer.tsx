import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, ClampToEdgeWrapping, DoubleSide, Group, MeshBasicMaterial, PointLight, Texture } from "three";
import { getEnvironmentModelAsset, isEnvironmentModelKey, modelKeyForDoor, type EnvironmentModelKey } from "../../assets/environmentModelAssets";
import { officialRoomPresentationRegistry, resolveRoomPresentation, type ResolvedRoomPresentation } from "../../game/config/RoomPresentationRegistry";
import type { LevelDoorDefinition } from "../../game/config/schema/levelConfig";
import type { GameWorld } from "../../game/core/GameWorld";
import { isDoorRenderVisible } from "../../game/core/RenderVisibility";
import { resolveDoorMaterial } from "../../game/visual/AssetResolver";
import type { First90Textures } from "../art/First90Textures";
import { EnvironmentModelInstance } from "./EnvironmentModelInstance";

interface ArenaAtlasRegion {
  offset: [number, number];
  repeat: [number, number];
}

const arenaAtlasRegions = {
  trimDoorPanel: { offset: [0.02, 0.42], repeat: [0.18, 0.52] },
  trimCyanLong: { offset: [0.44, 0.89], repeat: [0.5, 0.055] },
  trimAmberLong: { offset: [0.46, 0.59], repeat: [0.4, 0.06] },
  propTerminalWide: { offset: [0.02, 0.82], repeat: [0.22, 0.14] },
} satisfies Record<string, ArenaAtlasRegion>;

export function ConfiguredDoorRenderer({ world, artTextures }: { world: GameWorld; artTextures: First90Textures }) {
  const doors = (world.level.map?.doors ?? []).filter((door) => isDoorRenderVisible(world, door));
  const presentation = resolveRoomPresentation(world.level.map);
  return (
    <group>
      {doors.map((door) => (
        <ConfigDoor key={door.id} world={world} door={door} artTextures={artTextures} presentation={presentation} />
      ))}
    </group>
  );
}

function ConfigDoor({
  world,
  door,
  artTextures,
  presentation,
}: {
  world: GameWorld;
  door: LevelDoorDefinition;
  artTextures: First90Textures;
  presentation: ResolvedRoomPresentation | null;
}) {
  const doorRef = useRef<Group>(null);
  const panelRef = useRef<Group>(null);
  const closedHardwareRef = useRef<Group>(null);
  const [sx, sy, sz] = door.size;
  const kit = doorUsesServiceElevatorKit(door)
    ? (officialRoomPresentationRegistry.doorKits["hp:elevator_exit_lockable_v1"] ?? presentation?.doorKit ?? null)
    : (presentation?.doorKit ?? null);
  const canOpen = world.canOpenDoor(door);
  const doorOpen = world.isDoorOpen(door.id);
  const kitMaterialKey = kit
    ? doorOpen
      ? kit.stateMaterials.open
      : canOpen
        ? kit.stateMaterials.closed
        : kit.stateMaterials.locked
    : undefined;
  const materialProfile = resolveDoorMaterial(kitMaterialKey ? { ...door, materialKey: kitMaterialKey } : door);
  const useKitDoorModel =
    Boolean(kit?.doorModelKey) &&
    (kit?.archetype === "security_door" || door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero");
  const doorModelKey = modelKeyOrFallback(useKitDoorModel ? kit?.doorModelKey : undefined, modelKeyForDoor(door));
  const useKitThreshold = useKitDoorModel && kit?.archetype === "elevator_exit";
  const thresholdModelKey = useKitThreshold && kit?.thresholdModelKey ? modelKeyOrFallback(kit.thresholdModelKey, "door_threshold_service_elevator") : null;
  const panelModelKey =
    kit?.panelModelKey === "none"
      ? null
      : modelKeyOrFallback(kit?.panelModelKey, door.visualKey === "service_elevator_door" ? "switch_panel_wall_cyan" : "terminal_code_keypad");
  const doorModel = getEnvironmentModelAsset(doorModelKey);
  const useDoorModelOnly = Boolean(kit) || door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero";
  const useImage2MuseumDoor = door.visualKey === "museum_gallery_door" || doorModelKey === "age_museum_gallery_door";
  const configuredFloorClearance = useDoorModelOnly ? 0.11 : 0;
  const closedDoorY = sy / 2 + configuredFloorClearance;
  const doorModelScale: [number, number, number] = [
    sx / doorModel.sizeMeters[0],
    sy / doorModel.sizeMeters[1],
    Math.max(0.78, sz / doorModel.sizeMeters[2]),
  ];

  useFrame((_, delta) => {
    const open = world.isDoorOpen(door.id);
    let liftProgress = open ? 1 : 0;
    if (doorRef.current) {
      doorRef.current.visible = true;
      const liftDistance = open ? (kit?.openAnimation.axis === "y" ? kit.openAnimation.distance : sy * 1.05) : 0;
      const targetY = closedDoorY + liftDistance;
      doorRef.current.position.y += (targetY - doorRef.current.position.y) * (1 - Math.exp(-(door.openSpeed ?? 1.2) * 5.5 * delta));
      liftProgress = liftDistance > 0 ? clamp01((doorRef.current.position.y - closedDoorY) / liftDistance) : 0;
    }
    if (closedHardwareRef.current) {
      closedHardwareRef.current.visible = !(open && door.openVisualPolicy?.hideClosedHardwareAfterOpen && liftProgress > 0.82);
    }
    if (panelRef.current) {
      panelRef.current.visible = !(open && door.openVisualPolicy?.hidePanelAfterOpen);
    }
  });

  if (useDoorModelOnly) {
    return (
      <group>
        {thresholdModelKey ? (
          <EnvironmentModelInstance
            modelKey={thresholdModelKey}
            position={[door.position[0], 0.005, door.position[2] + 0.18]}
            rotation={[0, door.yaw, 0]}
            scale={[sx / 4.5, 1, 1]}
            castShadow
            receiveShadow
          />
        ) : null}
        <group ref={doorRef} position={[door.position[0], closedDoorY, door.position[2]]} rotation={[0, door.yaw, 0]}>
          <EnvironmentModelInstance modelKey={doorModelKey} position={[0, -sy / 2, 0]} scale={doorModelScale} castShadow={false} />
          <group ref={closedHardwareRef}>
            {useImage2MuseumDoor ? null : (
              <DoorStatusWash
                world={world}
                door={door}
                kit={kit}
                materialProfile={materialProfile}
                position={[0, sy * 0.01, sz * 0.67]}
                scale={[sx * 0.78, sy * 0.62, 1]}
                opacityScale={0.74}
              />
            )}
            {useImage2MuseumDoor ? null : (
              <>
                <DoorStatusBox world={world} door={door} kit={kit} materialProfile={materialProfile} position={[0, sy * 0.08, sz * 0.62]} scale={[sx * 0.42, 0.045, 0.032]} />
                <DoorStatusBox
                  world={world}
                  door={door}
                  kit={kit}
                  materialProfile={materialProfile}
                  position={[0, -sy * 0.42, sz * 0.71]}
                  scale={[sx * 0.7, 0.028, 0.02]}
                  opacityScale={0.74}
                  additive
                />
                <DoorStatusPointLight world={world} door={door} kit={kit} materialProfile={materialProfile} position={[0, sy * 0.08, sz * 0.9]} intensityScale={0.44} distance={4.4} decay={2.2} />
                <DoorStatusBars sx={sx} sy={sy} sz={sz} world={world} door={door} kit={kit} materialProfile={materialProfile} />
              </>
            )}
          </group>
        </group>
        {door.panelPosition && panelModelKey ? (
          <group ref={panelRef} position={[door.panelPosition[0], 0.035, door.panelPosition[2]]} rotation={[0, door.yaw, 0]} scale={[0.78, 0.78, 0.78]}>
            <EnvironmentModelInstance modelKey={panelModelKey} />
            <DoorStatusBox world={world} door={door} kit={kit} materialProfile={materialProfile} position={[0, 0.72, 0.13]} scale={[0.22, 0.035, 0.035]} />
            <DoorStatusPointLight world={world} door={door} kit={kit} materialProfile={materialProfile} position={[0, 0.76, 0.32]} intensityScale={0.2} distance={2.3} decay={2.1} />
          </group>
        ) : null}
      </group>
    );
  }

  return (
    <group>
      <group ref={doorRef} position={[door.position[0], closedDoorY, door.position[2]]} rotation={[0, door.yaw, 0]}>
        <EnvironmentModelInstance modelKey={doorModelKey} position={[0, -sy / 2, 0]} scale={doorModelScale} castShadow={false} />
        <group ref={closedHardwareRef}>
          <mesh position={[0, sy * 0.22, sz * 0.53]} scale={[sx * 0.72, 0.045, 0.035]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={materialProfile.accent} emissive={materialProfile.accent} emissiveIntensity={world.canOpenDoor(door) ? 1.2 : 0.28} />
          </mesh>
          <ArenaAtlasPlane
            texture={artTextures.environmentTrimSheet}
            region={arenaAtlasRegions.trimDoorPanel}
            position={[0, sy * 0.02, sz * 0.57]}
            scale={[sx * 0.52, sy * 0.58, 1]}
            opacity={0.28}
          />
          <DoorSurfaceDressing sx={sx} sy={sy} sz={sz} material={materialProfile} canOpen={world.canOpenDoor(door)} />
          <ArenaAtlasPlane
            texture={artTextures.environmentTrimSheet}
            region={world.canOpenDoor(door) ? arenaAtlasRegions.trimCyanLong : arenaAtlasRegions.trimAmberLong}
            position={[0, -sy * 0.27, sz * 0.585]}
            scale={[sx * 0.52, 0.09, 1]}
            opacity={world.canOpenDoor(door) ? 0.5 : 0.38}
            additive
          />
          <ArenaAtlasPlane
            texture={artTextures.propsDecalAtlas}
            region={arenaAtlasRegions.propTerminalWide}
            position={[sx * 0.26, -sy * 0.04, sz * 0.6]}
            scale={[sx * 0.18, sy * 0.16, 1]}
            opacity={world.canOpenDoor(door) ? 0.66 : 0.36}
            additive
          />
        </group>
      </group>
      {door.panelPosition && panelModelKey ? (
        <group ref={panelRef} position={[door.panelPosition[0], 0.035, door.panelPosition[2]]} rotation={[0, door.yaw, 0]} scale={[0.78, 0.78, 0.78]}>
          <EnvironmentModelInstance modelKey={panelModelKey} />
          <mesh position={[0, 0.68, 0.12]} scale={[0.36, 0.035, 0.035]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={materialProfile.accent} transparent opacity={0.72} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function doorUsesServiceElevatorKit(door: LevelDoorDefinition) {
  return door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero";
}

function DoorStatusWash({
  world,
  door,
  kit,
  materialProfile,
  position,
  scale,
  opacityScale = 1,
}: {
  world: GameWorld;
  door: LevelDoorDefinition;
  kit: ResolvedRoomPresentation["doorKit"];
  materialProfile: ReturnType<typeof resolveDoorMaterial>;
  position: [number, number, number];
  scale: [number, number, number];
  opacityScale?: number;
}) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    const material = materialRef.current;
    if (!material) return;
    const canOpen = world.canOpenDoor(door);
    const open = world.isDoorOpen(door.id);
    material.color.set(doorStatusColor(kit, materialProfile, canOpen, open));
    material.opacity = doorStatusWashOpacity(kit, canOpen, open) * opacityScale;
  });

  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={materialRef}
        color={doorStatusColor(kit, materialProfile, world.canOpenDoor(door), world.isDoorOpen(door.id))}
        transparent
        opacity={doorStatusWashOpacity(kit, world.canOpenDoor(door), world.isDoorOpen(door.id)) * opacityScale}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

function DoorStatusBox({
  world,
  door,
  kit,
  materialProfile,
  position,
  scale,
  opacityScale = 1,
  additive = false,
}: {
  world: GameWorld;
  door: LevelDoorDefinition;
  kit: ResolvedRoomPresentation["doorKit"];
  materialProfile: ReturnType<typeof resolveDoorMaterial>;
  position: [number, number, number];
  scale: [number, number, number];
  opacityScale?: number;
  additive?: boolean;
}) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    const material = materialRef.current;
    if (!material) return;
    const canOpen = world.canOpenDoor(door);
    const open = world.isDoorOpen(door.id);
    material.color.set(doorStatusColor(kit, materialProfile, canOpen, open));
    material.opacity = doorStatusOpacity(kit, canOpen) * opacityScale;
  });

  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        ref={materialRef}
        color={doorStatusColor(kit, materialProfile, world.canOpenDoor(door), world.isDoorOpen(door.id))}
        transparent
        opacity={doorStatusOpacity(kit, world.canOpenDoor(door)) * opacityScale}
        blending={additive ? AdditiveBlending : undefined}
        depthWrite={!additive}
        toneMapped={false}
      />
    </mesh>
  );
}

function DoorStatusPointLight({
  world,
  door,
  kit,
  materialProfile,
  position,
  intensityScale,
  distance,
  decay,
}: {
  world: GameWorld;
  door: LevelDoorDefinition;
  kit: ResolvedRoomPresentation["doorKit"];
  materialProfile: ReturnType<typeof resolveDoorMaterial>;
  position: [number, number, number];
  intensityScale: number;
  distance: number;
  decay: number;
}) {
  const lightRef = useRef<PointLight>(null);
  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const canOpen = world.canOpenDoor(door);
    const open = world.isDoorOpen(door.id);
    light.color.set(doorStatusColor(kit, materialProfile, canOpen, open));
    light.intensity = doorStatusIntensity(kit, canOpen, open) * intensityScale;
  });

  return (
    <pointLight
      ref={lightRef}
      position={position}
      color={doorStatusColor(kit, materialProfile, world.canOpenDoor(door), world.isDoorOpen(door.id))}
      intensity={doorStatusIntensity(kit, world.canOpenDoor(door), world.isDoorOpen(door.id)) * intensityScale}
      distance={distance}
      decay={decay}
    />
  );
}

function doorStatusColor(
  kit: ResolvedRoomPresentation["doorKit"],
  materialProfile: ReturnType<typeof resolveDoorMaterial>,
  canOpen: boolean,
  open: boolean,
) {
  if (open) return kit?.statusColors?.open ?? kit?.statusColors?.unlocked ?? materialProfile.accent;
  return canOpen ? kit?.statusColors?.unlocked ?? materialProfile.accent : kit?.statusColors?.locked ?? materialProfile.dangerAccent ?? "#c77a48";
}

function doorStatusOpacity(kit: ResolvedRoomPresentation["doorKit"], canOpen: boolean) {
  if (!kit?.statusGlow) return canOpen ? 0.82 : 0.52;
  return canOpen ? kit.statusGlow.opacityUnlocked : kit.statusGlow.opacityLocked;
}

function doorStatusIntensity(kit: ResolvedRoomPresentation["doorKit"], canOpen: boolean, open: boolean) {
  if (!kit?.statusGlow) return canOpen ? 1.08 : 0.44;
  if (open) return kit.statusGlow.openIntensity ?? kit.statusGlow.unlockedIntensity;
  return canOpen ? kit.statusGlow.unlockedIntensity : kit.statusGlow.lockedIntensity;
}

function doorStatusWashOpacity(kit: ResolvedRoomPresentation["doorKit"], canOpen: boolean, open: boolean) {
  const base = doorStatusOpacity(kit, canOpen);
  if (open) return Math.min(0.22, base * 0.24);
  return canOpen ? Math.min(0.3, base * 0.28) : Math.min(0.48, base * 0.58);
}

function DoorStatusBars({
  sx,
  sy,
  sz,
  world,
  door,
  kit,
  materialProfile,
}: {
  sx: number;
  sy: number;
  sz: number;
  world: GameWorld;
  door: LevelDoorDefinition;
  kit: ResolvedRoomPresentation["doorKit"];
  materialProfile: ReturnType<typeof resolveDoorMaterial>;
}) {
  return (
    <group>
      {[-0.43, 0.43].map((x) => (
        <DoorStatusBox
          key={`final-door-status-side:${x}`}
          world={world}
          door={door}
          kit={kit}
          materialProfile={materialProfile}
          position={[sx * x, sy * 0.04, sz * 0.64]}
          scale={[0.035, sy * 0.66, 0.018]}
          opacityScale={0.72}
          additive
        />
      ))}
      <DoorStatusBox
        world={world}
        door={door}
        kit={kit}
        materialProfile={materialProfile}
        position={[0, sy * 0.38, sz * 0.645]}
        scale={[sx * 0.54, 0.032, 0.018]}
        opacityScale={0.58}
        additive
      />
    </group>
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function modelKeyOrFallback(modelKey: string | undefined, fallback: EnvironmentModelKey): EnvironmentModelKey {
  return modelKey && isEnvironmentModelKey(modelKey) ? modelKey : fallback;
}

function DoorSurfaceDressing({
  sx,
  sy,
  sz,
  material,
  canOpen,
}: {
  sx: number;
  sy: number;
  sz: number;
  material: ReturnType<typeof resolveDoorMaterial>;
  canOpen: boolean;
}) {
  const accent = canOpen ? material.accent : material.dangerAccent ?? "#ff725f";
  const panelColor = canOpen ? "#172833" : "#2a1d20";

  return (
    <group>
      <mesh position={[0, 0, sz * 0.61]} scale={[0.035, sy * 0.78, 0.028]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#071017" emissive={accent} emissiveIntensity={0.18} metalness={0.74} roughness={0.32} />
      </mesh>
      {[-0.32, 0.32].map((x) => (
        <mesh key={`door-vertical-rail:${x}`} position={[sx * x, sy * 0.02, sz * 0.615]} scale={[0.055, sy * 0.68, 0.032]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#111d26" emissive={accent} emissiveIntensity={0.08} metalness={0.78} roughness={0.34} />
        </mesh>
      ))}
      {[-0.28, 0.0, 0.28].map((y) => (
        <mesh key={`door-horizontal-rib:${y}`} position={[0, sy * y, sz * 0.62]} scale={[sx * 0.76, 0.035, 0.032]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#071018" emissive={accent} emissiveIntensity={0.09} metalness={0.82} roughness={0.3} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`door-diagonal-brace:${side}`} position={[sx * 0.17 * side, sy * -0.02, sz * 0.628]} rotation={[0, 0, side * 0.42]} scale={[sx * 0.46, 0.035, 0.036]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#15232d" emissive={accent} emissiveIntensity={0.06} metalness={0.8} roughness={0.34} />
        </mesh>
      ))}
      <mesh position={[sx * 0.29, sy * -0.06, sz * 0.645]} scale={[sx * 0.13, sy * 0.22, 0.05]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={panelColor} emissive={accent} emissiveIntensity={canOpen ? 0.46 : 0.24} metalness={0.64} roughness={0.36} />
      </mesh>
      <mesh position={[sx * 0.29, sy * -0.03, sz * 0.675]} scale={[sx * 0.09, sy * 0.045, 0.012]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={canOpen ? 0.72 : 0.46} toneMapped={false} />
      </mesh>
      {[
        [-0.39, 0.32],
        [0.39, 0.32],
        [-0.39, -0.32],
        [0.39, -0.32],
      ].map(([x, y]) => (
        <mesh key={`door-bolt:${x}:${y}`} position={[sx * x, sy * y, sz * 0.65]} scale={[0.08, 0.08, 0.035]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#202c34" emissive="#061014" emissiveIntensity={0.08} metalness={0.86} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function ArenaAtlasPlane({
  texture,
  region,
  position,
  rotation = [0, 0, 0],
  scale,
  opacity,
  additive = false,
}: {
  texture: Texture;
  region: ArenaAtlasRegion;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
  opacity: number;
  additive?: boolean;
}) {
  const map = useMemo(() => {
    const clone = texture.clone();
    clone.offset.set(region.offset[0], region.offset[1]);
    clone.repeat.set(region.repeat[0], region.repeat[1]);
    clone.wrapS = ClampToEdgeWrapping;
    clone.wrapT = ClampToEdgeWrapping;
    clone.colorSpace = texture.colorSpace;
    clone.anisotropy = texture.anisotropy;
    clone.needsUpdate = true;
    return clone;
  }, [region, texture]);

  useEffect(() => () => map.dispose(), [map]);

  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={map}
        transparent
        opacity={opacity}
        blending={additive ? AdditiveBlending : undefined}
        depthWrite={false}
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
