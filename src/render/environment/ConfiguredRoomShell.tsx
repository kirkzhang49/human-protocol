import { MeshReflectorMaterial, useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { AdditiveBlending, ClampToEdgeWrapping, DoubleSide, Shape, SRGBColorSpace, type Texture } from "three";
import level01Image2FloorUrl from "../../assets/textures/environment/hero-floors/image2/runtime/level01_image2_full_room_maintenance_bay_floor_18x25_runtime.webp";
import level02Image2FloorUrl from "../../assets/textures/environment/hero-floors/image2/runtime/level02_image2_full_room_false_residential_floor_18p8x16p6_runtime.webp";
import level04Image2FloorUrl from "../../assets/textures/environment/hero-floors/image2/runtime/level04_image2_full_room_memory_clinic_floor_16x11_runtime.webp";
import level05Image2FloorUrl from "../../assets/textures/environment/hero-floors/image2/runtime/level05_image2_full_room_reclamation_core_floor_18x13_runtime.webp";
import {
  getEnvironmentModelAsset,
  isEnvironmentModelKey,
  type EnvironmentModelKey,
} from "../../assets/environmentModelAssets";
import { createRoomWallSegments, type RoomWallSegment } from "../../game/config/MapGeometry";
import { resolveRoomPresentation, type RoomShellKitDefinition } from "../../game/config/RoomPresentationRegistry";
import type { LevelMapPropDefinition, LevelRoomDefinition } from "../../game/config/schema/levelConfig";
import type { GameWorld } from "../../game/core/GameWorld";
import { isRoomRenderVisible } from "../../game/core/RenderVisibility";
import { resolveRoomAesthetic } from "../../game/visual/AssetResolver";
import { EnvironmentModelInstance } from "./EnvironmentModelInstance";
import { InstancedEnvironmentModelSet, type EnvironmentModelTransform } from "./InstancedEnvironmentModelSet";

interface HeroImage2FloorAsset {
  url: string;
  baseColor: string;
  metalness: number;
  roughness: number;
}

const HERO_IMAGE2_FLOORS: Partial<Record<string, HeroImage2FloorAsset>> = {
  maintenance_bay_floor: {
    url: level01Image2FloorUrl,
    baseColor: "#050b0f",
    metalness: 0.42,
    roughness: 0.5,
  },
  level_02_living_room: {
    url: level02Image2FloorUrl,
    baseColor: "#160e08",
    metalness: 0.18,
    roughness: 0.56,
  },
  level_04_waiting_room: {
    url: level04Image2FloorUrl,
    baseColor: "#dbe3de",
    metalness: 0.12,
    roughness: 0.5,
  },
  level_05_platform: {
    url: level05Image2FloorUrl,
    baseColor: "#050506",
    metalness: 0.42,
    roughness: 0.46,
  },
};

export function ConfiguredMapAssetShell({ world }: { world: GameWorld }) {
  const visualWallSegments = useMemo(
    () => createRoomWallSegments(world.level, (room) => Boolean(room.geometry?.renderWalls)),
    [world.level],
  );
  const map = world.level.map;
  if (!map) return null;
  const presentation = resolveRoomPresentation(map);
  const visibleRooms = map.rooms.filter((room) => isRoomRenderVisible(world, room.id));

  const hasShellReplacementProp = (roomId: string, surface: "floor" | "wall" | "ceiling") =>
    map.props?.some((prop) => prop.initiallyVisible !== false && prop.roomId === roomId && propSuppressesShell(prop, surface)) ?? false;

  return (
    <group>
      {visibleRooms.map((room) => (
        <ConfiguredRoomAssetShell
          key={`asset-shell:${room.id}`}
          room={room}
          world={world}
          shellKit={presentation?.shell ?? null}
          wallSegments={visualWallSegments.filter((segment) => segment.roomId === room.id)}
          hasFloorAsset={hasShellReplacementProp(room.id, "floor")}
          hasWallAsset={hasShellReplacementProp(room.id, "wall")}
          hasCeilingAsset={hasShellReplacementProp(room.id, "ceiling")}
        />
      ))}
    </group>
  );
}

function propSuppressesShell(prop: LevelMapPropDefinition, surface: "floor" | "wall" | "ceiling") {
  const tags = new Set(prop.tags ?? []);
  if (
    tags.has("shell_asset") ||
    tags.has("full_room_shell") ||
    tags.has(`${surface}_shell_asset`) ||
    tags.has(`full_room_${surface}_asset`) ||
    tags.has(`replaces_${surface}_shell`)
  ) {
    return true;
  }
  if (!tags.has(`${surface}_asset`)) return false;

  const modelKey = String(prop.modelKey ?? "");
  if (surface === "floor") return /^room_floor_tile_/.test(modelKey);
  if (surface === "wall") return /^room_wall_panel_/.test(modelKey);
  return /^room_ceiling_panel_/.test(modelKey);
}

function roomShellKeys(room: LevelRoomDefinition, shellKit?: RoomShellKitDefinition | null): {
  floor: EnvironmentModelKey;
  wall: EnvironmentModelKey;
  ceiling: EnvironmentModelKey;
  pillar: EnvironmentModelKey;
  wallWash: EnvironmentModelKey;
} {
  if (shellKit) {
    return {
      floor: modelKeyOrFallback(shellKit.floorModelKey, "room_floor_tile_maintenance"),
      wall: modelKeyOrFallback(shellKit.wallModelKey, "room_wall_panel_maintenance"),
      ceiling: modelKeyOrFallback(shellKit.ceilingModelKey, "room_ceiling_panel_maintenance"),
      pillar: modelKeyOrFallback(shellKit.cornerPillarModelKey, "room_corner_pillar_maintenance"),
      wallWash: modelKeyOrFallback(shellKit.wallWashLightModelKey, "room_wall_wash_light_maintenance"),
    };
  }

  const aesthetic = resolveRoomAesthetic(room);
  if (room.skinKey?.includes("residential") || aesthetic?.style === "residential") {
    return {
      floor: "room_floor_tile_residential",
      wall: "room_wall_panel_residential",
      ceiling: "room_ceiling_panel_residential",
      pillar: "room_corner_pillar_residential",
      wallWash: "room_wall_wash_light_residential",
    };
  }
  if (room.skinKey?.includes("museum") || room.skinKey?.includes("archive") || aesthetic?.style === "museum") {
    return {
      floor: "room_floor_tile_museum",
      wall: "room_wall_panel_museum",
      ceiling: "room_ceiling_panel_museum",
      pillar: "room_corner_pillar_museum",
      wallWash: "room_wall_wash_light_museum",
    };
  }
  if (room.skinKey?.includes("clinic") || aesthetic?.style === "sterile") {
    return {
      floor: "room_floor_tile_clinic",
      wall: "room_wall_panel_clinic",
      ceiling: "room_ceiling_panel_clinic",
      pillar: "room_corner_pillar_clinic",
      wallWash: "room_wall_wash_light_clinic",
    };
  }
  if (room.skinKey?.includes("core") || room.skinKey?.includes("reclamation") || aesthetic?.style === "hazard" || aesthetic?.style === "exit") {
    return {
      floor: "room_floor_tile_core",
      wall: "room_wall_panel_core",
      ceiling: "room_ceiling_panel_core",
      pillar: "room_corner_pillar_core",
      wallWash: "room_wall_wash_light_core",
    };
  }
  return {
    floor: "room_floor_tile_maintenance",
    wall: "room_wall_panel_maintenance",
    ceiling: "room_ceiling_panel_maintenance",
    pillar: "room_corner_pillar_maintenance",
    wallWash: "room_wall_wash_light_maintenance",
  };
}

function modelKeyOrFallback(modelKey: string, fallback: EnvironmentModelKey): EnvironmentModelKey {
  return isEnvironmentModelKey(modelKey) ? modelKey : fallback;
}

function ConfiguredRoomAssetShell({
  room,
  world,
  shellKit,
  wallSegments,
  hasFloorAsset,
  hasWallAsset,
  hasCeilingAsset,
}: {
  room: LevelRoomDefinition;
  world: GameWorld;
  shellKit: RoomShellKitDefinition | null;
  wallSegments: readonly RoomWallSegment[];
  hasFloorAsset: boolean;
  hasWallAsset: boolean;
  hasCeilingAsset: boolean;
}) {
  const [cx, , cz] = room.bounds.center;
  const [sx, sy, sz] = room.bounds.size;
  const shapePoints = room.bounds.shape?.points ?? null;
  const active = world.session.mapProgress.currentRoomId === room.id;
  const shell = roomShellKeys(room, shellKit);
  const ceilingY = Math.max(2.85, sy - 0.35);
  const ceilingScale: [number, number, number] = [Math.max(0.9, sx / 3.2), 1, Math.max(0.9, sz / 2.2)];
  const lightOpacity = active ? 0.09 : 0.055;
  const floorRenderMode = shellKit?.floorRenderMode ?? "model_tiles";
  const heroImage2Floor = HERO_IMAGE2_FLOORS[room.id];
  const ceilingRenderMode = shellKit?.ceilingRenderMode ?? "model_panel";
  const renderWallWash = active || world.renderPerformance.quality.tier !== "rescue";

  return (
    <group>
      {room.geometry?.renderFloor && !hasFloorAsset ? (
        shapePoints ? (
          <PolygonShellSurface
            points={shapePoints}
            cx={cx}
            cz={cz}
            y={0.006}
            color={shellKit?.floorBaseColor ?? "#0c1418"}
            metalness={0.4}
            roughness={0.56}
          />
        ) : heroImage2Floor ? (
          <HeroImage2Floor cx={cx} cz={cz} sx={sx} sz={sz} asset={heroImage2Floor} />
        ) : floorRenderMode === "hero_arena_panels" ? (
          <HeroArenaFloor
            cx={cx}
            cz={cz}
            sx={sx}
            sz={sz}
            shellKit={shellKit}
            active={active}
            reflectiveFloorEnabled={world.renderPerformance.quality.reflectiveFloorEnabled}
          />
        ) : floorRenderMode === "model_single" ? (
          <EnvironmentModelInstance
            modelKey={shell.floor}
            position={[cx, -0.015, cz]}
            rotation={[0, 0, 0]}
            scale={[Math.max(0.25, sx / 4.34), 1.02, Math.max(0.25, sz / 3.09)]}
            receiveShadow
          />
        ) : (
          <AssetFloorTiles cx={cx} cz={cz} sx={sx} sz={sz} modelKey={shell.floor} />
        )
      ) : null}

      {room.geometry?.renderWalls && !hasWallAsset ? (
        <group>
          <RoomWallSegments segments={wallSegments} modelKey={shell.wall} />
          {/* Corner pillars + wall-wash assume rectangular corners; skip for shaped rooms. */}
          {!shapePoints ? <RoomCornerPillars cx={cx} cz={cz} sx={sx} sz={sz} modelKey={shell.pillar} /> : null}
          {renderWallWash && !shapePoints ? <RoomWallWashLights cx={cx} cz={cz} sx={sx} sz={sz} modelKey={shell.wallWash} /> : null}
        </group>
      ) : null}

      {!hasCeilingAsset ? (
        shapePoints ? (
          <PolygonShellSurface
            points={shapePoints}
            cx={cx}
            cz={cz}
            y={ceilingY}
            color="#0a1116"
            metalness={0.3}
            roughness={0.72}
            faceDown
          />
        ) : ceilingRenderMode === "deep_grid" ? (
          <DeepGridCeiling cx={cx} cz={cz} sx={sx} sy={sy} sz={sz} shellKit={shellKit} active={active} />
        ) : (
          <group>
            <EnvironmentModelInstance
              modelKey={shell.ceiling}
              position={[cx, ceilingY, cz]}
              rotation={[0, 0, 0]}
              scale={ceilingScale}
              receiveShadow
            />
            <mesh position={[cx, ceilingY - 0.22, cz]} rotation={[Math.PI / 2, 0, 0]} scale={[sx * 0.78, sz * 0.34, 1]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color="#77efff" transparent opacity={lightOpacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        )
      ) : null}
    </group>
  );
}

function HeroImage2Floor({
  cx,
  cz,
  sx,
  sz,
  asset,
}: {
  cx: number;
  cz: number;
  sx: number;
  sz: number;
  asset: HeroImage2FloorAsset;
}) {
  const texture = useTexture(asset.url) as Texture;
  const floorTexture = useMemo(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [texture]);

  return (
    <group>
      <mesh receiveShadow position={[cx, -0.075, cz]}>
        <boxGeometry args={[sx + 0.18, 0.08, sz + 0.18]} />
        <meshStandardMaterial color={asset.baseColor} metalness={asset.metalness} roughness={asset.roughness + 0.12} />
      </mesh>
      <mesh receiveShadow position={[cx, 0.006, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sx, sz]} />
        <meshStandardMaterial map={floorTexture} color="#ffffff" metalness={asset.metalness} roughness={asset.roughness} />
      </mesh>
    </group>
  );
}

function shellColor(value: string | undefined, fallback: string) {
  return value ?? fallback;
}

function HeroArenaFloor({
  cx,
  cz,
  sx,
  sz,
  shellKit,
  active,
  reflectiveFloorEnabled,
}: {
  cx: number;
  cz: number;
  sx: number;
  sz: number;
  shellKit: RoomShellKitDefinition | null;
  active: boolean;
  reflectiveFloorEnabled: boolean;
}) {
  const baseColor = shellColor(shellKit?.floorBaseColor, "#071014");
  const panelColor = shellColor(shellKit?.floorPanelColor, "#2c3a3f");
  const trimColor = shellColor(shellKit?.floorTrimColor, "#10191d");
  const accentColor = shellColor(shellKit?.floorAccentColor, "#82f3ff");
  const guideOpacity = (shellKit?.guideLineOpacity ?? 0.3) * (active ? 1 : 0.72);
  const reflectionOpacity = reflectiveFloorEnabled && active ? Math.max(0, shellKit?.floorReflectionOpacity ?? 0.18) : 0;
  const reflectionStrength = Math.max(0, shellKit?.floorReflectionStrength ?? 0.32);
  const reflectionBlur: [number, number] = shellKit?.floorReflectionBlur
    ? [shellKit.floorReflectionBlur[0], shellKit.floorReflectionBlur[1]]
    : [240, 90];
  const xCount = Math.max(3, Math.min(4, Math.round(sx / 5.6)));
  const zCount = Math.max(4, Math.min(6, Math.round(sz / 5)));
  const panels = useMemo(
    () =>
      Array.from({ length: xCount * zCount }, (_, index) => {
        const xIndex = index % xCount;
        const zIndex = Math.floor(index / xCount);
        const panelWidth = sx / xCount;
        const panelDepth = sz / zCount;
        return {
          id: `${xIndex}:${zIndex}`,
          x: cx - sx / 2 + panelWidth * (xIndex + 0.5),
          z: cz - sz / 2 + panelDepth * (zIndex + 0.5),
          width: panelWidth * 0.84,
          depth: panelDepth * 0.78,
          raised: (xIndex + zIndex) % 3 === 0,
        };
      }),
    [cx, cz, sx, sz, xCount, zCount],
  );

  return (
    <group>
      <mesh receiveShadow position={[cx, -0.06, cz]}>
        <boxGeometry args={[sx + 0.7, 0.08, sz + 0.7]} />
        <meshStandardMaterial color={baseColor} metalness={0.68} roughness={0.34} />
      </mesh>
      <mesh receiveShadow position={[cx, -0.025, cz]}>
        <boxGeometry args={[sx * 0.9, 0.035, sz * 0.9]} />
        <meshStandardMaterial color={trimColor} metalness={0.72} roughness={0.32} />
      </mesh>
      {panels.map((panel) => (
        <mesh key={`hero-floor-panel:${panel.id}`} receiveShadow position={[panel.x, -0.006, panel.z]}>
          <boxGeometry args={[panel.width, 0.03, panel.depth]} />
          <meshStandardMaterial
            color={panel.raised ? "#34454b" : panelColor}
            metalness={0.66}
            roughness={0.36}
          />
        </mesh>
      ))}
      <mesh receiveShadow position={[cx, 0.012, cz]}>
        <boxGeometry args={[sx * 0.14, 0.038, sz * 0.88]} />
        <meshStandardMaterial color="#162126" metalness={0.76} roughness={0.3} />
      </mesh>
      <mesh receiveShadow position={[cx - sx * 0.29, 0.01, cz]}>
        <boxGeometry args={[0.18, 0.038, sz * 0.84]} />
        <meshStandardMaterial color="#0d1519" metalness={0.76} roughness={0.3} />
      </mesh>
      <mesh receiveShadow position={[cx + sx * 0.29, 0.01, cz]}>
        <boxGeometry args={[0.18, 0.038, sz * 0.84]} />
        <meshStandardMaterial color="#0d1519" metalness={0.76} roughness={0.3} />
      </mesh>
      {reflectionOpacity > 0 ? (
        <mesh receiveShadow position={[cx, 0.044, cz]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx * 0.88, sz * 0.88, 1]}>
          <planeGeometry args={[1, 1]} />
          <MeshReflectorMaterial
            color="#122027"
            metalness={0.78}
            roughness={0.34}
            resolution={512}
            blur={reflectionBlur}
            mirror={0.08}
            mixBlur={0.78}
            mixStrength={reflectionStrength}
            depthScale={0.16}
            minDepthThreshold={0.28}
            maxDepthThreshold={1.25}
            transparent
            opacity={reflectionOpacity}
          />
        </mesh>
      ) : null}
      <FloorReflectionWash position={[cx + sx * 0.06, 0.051, cz - sz * 0.02]} size={[sx * 0.34, sz * 0.56]} color="#bbfbff" opacity={active ? 0.055 : 0.036} />
      <FloorReflectionWash position={[cx - sx * 0.2, 0.052, cz + sz * 0.2]} size={[sx * 0.24, sz * 0.18]} color="#67eaff" opacity={active ? 0.04 : 0.026} />
      <FloorReflectionWash position={[cx + sx * 0.28, 0.052, cz - sz * 0.24]} size={[sx * 0.2, sz * 0.16]} color="#65ddec" opacity={active ? 0.034 : 0.022} />
      <FloorGuideLine id="center-left" position={[cx - sx * 0.09, 0.05, cz]} size={[0.045, sz * 0.76]} color={accentColor} opacity={guideOpacity * 0.55} />
      <FloorGuideLine id="center-right" position={[cx + sx * 0.09, 0.05, cz]} size={[0.045, sz * 0.76]} color={accentColor} opacity={guideOpacity * 0.55} />
      <FloorGuideLine id="front-wide" position={[cx, 0.052, cz - sz * 0.31]} size={[sx * 0.52, 0.035]} color={accentColor} opacity={guideOpacity * 0.78} />
      <FloorGuideLine id="rear-wide" position={[cx, 0.052, cz + sz * 0.28]} size={[sx * 0.46, 0.035]} color={accentColor} opacity={guideOpacity * 0.62} />
      <FloorGuideLine id="left-service" position={[cx - sx * 0.34, 0.052, cz + sz * 0.1]} size={[sx * 0.16, 0.04]} color={accentColor} opacity={guideOpacity * 0.55} />
      <FloorGuideLine id="right-service" position={[cx + sx * 0.34, 0.052, cz - sz * 0.14]} size={[sx * 0.16, 0.04]} color={accentColor} opacity={guideOpacity * 0.55} />
      <FloorDarkPool position={[cx - sx * 0.28, 0.053, cz + sz * 0.26]} size={[sx * 0.28, sz * 0.18]} opacity={0.18} />
      <FloorDarkPool position={[cx + sx * 0.31, 0.053, cz - sz * 0.16]} size={[sx * 0.24, sz * 0.16]} opacity={0.14} />
      <FloorDarkPool position={[cx, 0.053, cz - sz * 0.38]} size={[sx * 0.5, sz * 0.08]} opacity={0.16} />
      <FloorTrimStrip position={[cx, 0.022, cz - sz * 0.46]} size={[sx * 0.84, 0.06]} color={trimColor} />
      <FloorTrimStrip position={[cx, 0.022, cz + sz * 0.46]} size={[sx * 0.84, 0.06]} color={trimColor} />
      <FloorTrimStrip position={[cx - sx * 0.46, 0.022, cz]} size={[0.06, sz * 0.82]} color={trimColor} />
      <FloorTrimStrip position={[cx + sx * 0.46, 0.022, cz]} size={[0.06, sz * 0.82]} color={trimColor} />
    </group>
  );
}

function FloorReflectionWash({
  position,
  size,
  color,
  opacity,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[size[0], size[1], 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function FloorDarkPool({ position, size, opacity }: { position: [number, number, number]; size: [number, number]; opacity: number }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[size[0], size[1], 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#000000" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function FloorGuideLine({
  id,
  position,
  size,
  color,
  opacity,
}: {
  id: string;
  position: [number, number, number];
  size: [number, number];
  color: string;
  opacity: number;
}) {
  return (
    <mesh key={`floor-guide:${id}`} position={position}>
      <boxGeometry args={[size[0], 0.012, size[1]]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function FloorTrimStrip({ position, size, color }: { position: [number, number, number]; size: [number, number]; color: string }) {
  return (
    <mesh receiveShadow position={position}>
      <boxGeometry args={[size[0], 0.028, size[1]]} />
      <meshStandardMaterial color={color} metalness={0.78} roughness={0.3} />
    </mesh>
  );
}

function DeepGridCeiling({
  cx,
  cz,
  sx,
  sy,
  sz,
  shellKit,
  active,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  shellKit: RoomShellKitDefinition | null;
  active: boolean;
}) {
  const ceilingY = Math.max(2.85, sy - 0.28);
  const baseColor = shellColor(shellKit?.ceilingBaseColor, "#02070a");
  const beamColor = shellColor(shellKit?.ceilingBeamColor, "#061219");
  const panelColor = shellColor(shellKit?.ceilingPanelColor, "#25343a");
  const accentColor = shellColor(shellKit?.ceilingAccentColor, "#88f4ff");
  const lightOpacity = (shellKit?.ceilingLightOpacity ?? 0.45) * (active ? 1 : 0.72);
  const longBeams = useMemo(
    () => [-0.42, -0.18, 0.18, 0.42].map((offset) => ({ id: `long:${offset}`, x: cx + sx * offset })),
    [cx, sx],
  );
  const crossBeams = useMemo(
    () => [-0.42, -0.26, -0.1, 0.08, 0.26, 0.42].map((offset) => ({ id: `cross:${offset}`, z: cz + sz * offset })),
    [cz, sz],
  );
  const insetPanels = useMemo(
    () =>
      [-0.32, -0.08, 0.18, 0.34].map((offset, index) => ({
        id: `inset:${index}`,
        x: cx + (index % 2 === 0 ? -sx * 0.12 : sx * 0.14),
        z: cz + sz * offset,
      })),
    [cx, cz, sx, sz],
  );

  return (
    <group>
      <mesh receiveShadow position={[cx, ceilingY, cz]}>
        <boxGeometry args={[sx + 0.8, 0.12, sz + 0.9]} />
        <meshStandardMaterial color={baseColor} metalness={0.42} roughness={0.74} />
      </mesh>
      {longBeams.map((beam) => (
        <mesh key={`ceiling-long-beam:${beam.id}`} castShadow receiveShadow position={[beam.x, ceilingY - 0.13, cz]}>
          <boxGeometry args={[0.18, 0.24, sz + 0.65]} />
          <meshStandardMaterial color={beamColor} metalness={0.56} roughness={0.58} />
        </mesh>
      ))}
      {crossBeams.map((beam) => (
        <mesh key={`ceiling-cross-beam:${beam.id}`} castShadow receiveShadow position={[cx, ceilingY - 0.17, beam.z]}>
          <boxGeometry args={[sx + 0.62, 0.2, 0.16]} />
          <meshStandardMaterial color={beamColor} metalness={0.58} roughness={0.56} />
        </mesh>
      ))}
      {insetPanels.map((panel) => (
        <mesh key={`ceiling-inset-panel:${panel.id}`} receiveShadow position={[panel.x, ceilingY - 0.07, panel.z]}>
          <boxGeometry args={[sx * 0.2, 0.045, sz * 0.08]} />
          <meshStandardMaterial color={panelColor} metalness={0.5} roughness={0.66} />
        </mesh>
      ))}
      <CeilingLightStrip position={[cx + sx * 0.08, ceilingY - 0.24, cz - sz * 0.02]} size={[sx * 0.5, 0.045]} color={accentColor} opacity={lightOpacity} />
      <CeilingLightStrip position={[cx - sx * 0.2, ceilingY - 0.235, cz + sz * 0.19]} size={[sx * 0.34, 0.038]} color={accentColor} opacity={lightOpacity * 0.72} />
      <CeilingLightStrip position={[cx + sx * 0.32, ceilingY - 0.235, cz - sz * 0.28]} size={[sx * 0.24, 0.038]} color={accentColor} opacity={lightOpacity * 0.62} />
    </group>
  );
}

function CeilingLightStrip({
  position,
  size,
  color,
  opacity,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size[0], 0.025, size[1]]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Flat polygon floor/ceiling for non-rectangular rooms (footprint-fitted). */
function PolygonShellSurface({
  points,
  cx,
  cz,
  y,
  color,
  metalness,
  roughness,
  faceDown = false,
}: {
  points: readonly (readonly [number, number])[];
  cx: number;
  cz: number;
  y: number;
  color: string;
  metalness: number;
  roughness: number;
  faceDown?: boolean;
}) {
  const shape = useMemo(() => {
    const built = new Shape();
    points.forEach(([x, z], index) => {
      // Floor (face up, rot -π/2): world z = -shapeY → store -z. Ceiling (face down, rot π/2): world z = shapeY → store z.
      const shapeY = faceDown ? z : -z;
      if (index === 0) built.moveTo(x, shapeY);
      else built.lineTo(x, shapeY);
    });
    built.closePath();
    return built;
  }, [points, faceDown]);

  return (
    <mesh position={[cx, y, cz]} rotation={[faceDown ? Math.PI / 2 : -Math.PI / 2, 0, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} side={DoubleSide} />
    </mesh>
  );
}

function RoomWallSegments({ segments, modelKey }: { segments: readonly RoomWallSegment[]; modelKey: EnvironmentModelKey }) {
  const asset = getEnvironmentModelAsset(modelKey);
  const instances = useMemo<EnvironmentModelTransform[]>(
    () =>
      segments.map((segment) => {
        // Polygon-edge walls carry their own yaw; size[0] is the run length.
        if (segment.yaw !== undefined) {
          return {
            position: [segment.position[0], 0, segment.position[2]],
            rotation: [0, segment.yaw, 0],
            scale: [
              Math.max(0.18, segment.size[0] / asset.sizeMeters[0]),
              Math.max(0.7, segment.size[1] / asset.sizeMeters[1]),
              Math.max(0.85, segment.size[2] / asset.sizeMeters[2]),
            ],
          };
        }
        const horizontal = segment.side === "north" || segment.side === "south";
        const visibleLength = horizontal ? segment.size[0] : segment.size[2];
        const visibleThickness = horizontal ? segment.size[2] : segment.size[0];
        return {
          position: [
            segment.position[0] + (segment.side === "east" ? -0.16 : segment.side === "west" ? 0.16 : 0),
            0,
            segment.position[2] + (segment.side === "north" ? -0.16 : segment.side === "south" ? 0.16 : 0),
          ],
          rotation:
            segment.side === "north"
              ? [0, Math.PI, 0]
              : segment.side === "south"
                ? [0, 0, 0]
                : segment.side === "east"
                  ? [0, -Math.PI / 2, 0]
                  : [0, Math.PI / 2, 0],
          scale: [
            Math.max(0.18, visibleLength / asset.sizeMeters[0]),
            Math.max(0.7, segment.size[1] / asset.sizeMeters[1]),
            Math.max(0.85, visibleThickness / asset.sizeMeters[2]),
          ],
        };
      }),
    [asset.sizeMeters, segments],
  );

  return <InstancedEnvironmentModelSet modelKey={modelKey} instances={instances} castShadow receiveShadow />;
}

function AssetFloorTiles({ cx, cz, sx, sz, modelKey }: { cx: number; cz: number; sx: number; sz: number; modelKey: EnvironmentModelKey }) {
  const tileWidth = 4.8;
  const tileDepth = 3.25;
  const xCount = Math.max(2, Math.ceil(sx / tileWidth));
  const zCount = Math.max(2, Math.ceil(sz / tileDepth));
  const tiles = useMemo(
    () =>
      Array.from({ length: xCount * zCount }, (_, index) => {
        const xIndex = index % xCount;
        const zIndex = Math.floor(index / xCount);
        return {
          id: `${xIndex}:${zIndex}`,
          x: cx - ((xCount - 1) * tileWidth) / 2 + xIndex * tileWidth,
          z: cz - ((zCount - 1) * tileDepth) / 2 + zIndex * tileDepth,
          yaw: ((xIndex + zIndex) % 2) * Math.PI,
        };
      }),
    [cx, cz, sx, sz, xCount, zCount],
  );

  const instances = useMemo<EnvironmentModelTransform[]>(
    () =>
      tiles.map((tile) => ({
        position: [tile.x, -0.015, tile.z],
        rotation: [0, tile.yaw, 0],
        scale: [1.52, 1.02, 1.48],
      })),
    [tiles],
  );

  return <InstancedEnvironmentModelSet modelKey={modelKey} instances={instances} receiveShadow />;
}

function RoomCornerPillars({ cx, cz, sx, sz, modelKey }: { cx: number; cz: number; sx: number; sz: number; modelKey: EnvironmentModelKey }) {
  const x = sx / 2 - 0.34;
  const z = sz / 2 - 0.34;
  const corners = [
    { id: "front-left", position: [cx - x, 0, cz - z] as [number, number, number], yaw: 0 },
    { id: "front-right", position: [cx + x, 0, cz - z] as [number, number, number], yaw: -Math.PI / 2 },
    { id: "back-left", position: [cx - x, 0, cz + z] as [number, number, number], yaw: Math.PI / 2 },
    { id: "back-right", position: [cx + x, 0, cz + z] as [number, number, number], yaw: Math.PI },
  ];
  const instances = useMemo<EnvironmentModelTransform[]>(
    () =>
      corners.map((corner) => ({
        position: corner.position,
        rotation: [0, corner.yaw, 0],
        scale: 1,
      })),
    [corners],
  );
  return <InstancedEnvironmentModelSet modelKey={modelKey} instances={instances} castShadow receiveShadow />;
}

function RoomWallWashLights({ cx, cz, sx, sz, modelKey }: { cx: number; cz: number; sx: number; sz: number; modelKey: EnvironmentModelKey }) {
  const y = 0.16;
  const frontZ = cz - sz / 2 + 0.25;
  const backZ = cz + sz / 2 - 0.25;
  const leftX = cx - sx / 2 + 0.25;
  const rightX = cx + sx / 2 - 0.25;
  const lights = [
    { id: "front-left", position: [cx - sx * 0.22, y, frontZ] as [number, number, number], yaw: 0 },
    { id: "front-right", position: [cx + sx * 0.22, y, frontZ] as [number, number, number], yaw: 0 },
    { id: "back-left", position: [cx - sx * 0.22, y, backZ] as [number, number, number], yaw: Math.PI },
    { id: "back-right", position: [cx + sx * 0.22, y, backZ] as [number, number, number], yaw: Math.PI },
    { id: "left-mid", position: [leftX, y, cz] as [number, number, number], yaw: Math.PI / 2 },
    { id: "right-mid", position: [rightX, y, cz] as [number, number, number], yaw: -Math.PI / 2 },
  ];
  const instances = useMemo<EnvironmentModelTransform[]>(
    () =>
      lights.map((light) => ({
        position: light.position,
        rotation: [0, light.yaw, 0],
        scale: 1,
      })),
    [lights],
  );
  return <InstancedEnvironmentModelSet modelKey={modelKey} instances={instances} castShadow={false} receiveShadow={false} />;
}
