import { ContactShadows } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
} from "three";
import { arenaObstacles, gameBalance, type ArenaObstacleConfig } from "../game/config/gameBalance";
import { resolveRoomPresentation } from "../game/config/RoomPresentationRegistry";
import { isExitCinematicViewActive } from "../game/core/ExitCinematicView";
import type { GameWorld } from "../game/core/GameWorld";
import { resolveMapMaterial, resolveMapVisual } from "../game/visual/AssetResolver";
import { useFirst90Textures } from "./art/First90Textures";
import { ConfiguredDoorRenderer } from "./environment/ConfiguredDoorRenderer";
import { ConfiguredMapLighting } from "./environment/ConfiguredMapLighting";
import { MapGeometryRenderer } from "./MapGeometryRenderer";

interface PanelLine {
  key: string;
  position: [number, number, number];
  scale: [number, number, number];
}

interface ArenaProps {
  world: GameWorld;
}

export function Arena({ world }: ArenaProps) {
  const size = gameBalance.arenaHalfSize;
  const panelLines = useMemo(() => createPanelLines(size), [size]);
  const artTextures = useFirst90Textures();
  const useConfiguredLevelArt = Boolean(world.level.map);
  const roomPresentation = resolveRoomPresentation(world.level.map);
  const shadowRoom = useMemo(() => largestShadowRoom(world), [world.level.map]);
  const exitCinematic = isExitCinematicViewActive(world);

  return (
    <group>
      {exitCinematic ? null : useConfiguredLevelArt ? (
        <ConfiguredMapLighting world={world} />
      ) : (
        <>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[size * 2, size * 2]} />
            <meshStandardMaterial color="#0b1018" metalness={0.38} roughness={0.66} side={DoubleSide} />
          </mesh>

          <PanelLineSet lines={panelLines} />

          <RunwayMarkings size={size} />
          <FloorTextureDecals size={size} panelMap={artTextures.maintenancePanels} />
          <BoundaryGlow size={size} />
          <BoundaryWalls size={size} />
          <MaintenanceImmersionLayer world={world} size={size} />
          <First90MaintenanceSet size={size} panelMap={artTextures.maintenancePanels} />
        </>
      )}
      <MapGeometryRenderer world={world} />
      {exitCinematic || useConfiguredLevelArt ? null : <ExitPad world={world} />}
      {exitCinematic ? null : <ConfiguredDoorRenderer world={world} artTextures={artTextures} />}
      {!exitCinematic && useConfiguredLevelArt && roomPresentation?.lighting?.shadows.enabled && shadowRoom ? (
        <ContactShadows
          position={[shadowRoom.center[0], 0.08, shadowRoom.center[2]]}
          scale={Math.max(shadowRoom.size[0], shadowRoom.size[2]) * 1.08}
          opacity={roomPresentation.lighting.shadows.contactShadowStrength}
          blur={2.2}
          far={5.6}
          resolution={1024}
          color="#000000"
        />
      ) : null}

      {useConfiguredLevelArt
        ? null
        : arenaObstacles.map((obstacle) => (
            <PhysicalObstacle key={obstacle.id} obstacle={obstacle} panelMap={artTextures.maintenancePanels} />
          ))}
    </group>
  );
}

function largestShadowRoom(world: GameWorld) {
  const rooms = world.level.map?.rooms ?? [];
  if (rooms.length === 0) return null;
  return rooms.reduce((largest, room) => {
    const area = room.bounds.size[0] * room.bounds.size[2];
    const largestArea = largest.bounds.size[0] * largest.bounds.size[2];
    return area > largestArea ? room : largest;
  }, rooms[0]).bounds;
}

function FloorTextureDecals({ size, panelMap }: { size: number; panelMap: MeshBasicMaterial["map"] }) {
  const decals = [
    { key: "left-service-scrape", position: [-8.7, 0.041, -5.5] as [number, number, number], scale: [5.8, 2.4, 1] as [number, number, number], yaw: 0.08, opacity: 0.18 },
    { key: "right-panel-scuff", position: [8.1, 0.042, 1.5] as [number, number, number], scale: [5.2, 2.1, 1] as [number, number, number], yaw: -0.12, opacity: 0.16 },
    { key: "center-service-panel", position: [0, 0.043, -9.1] as [number, number, number], scale: [6.4, 3.6, 1] as [number, number, number], yaw: 0, opacity: 0.2 },
    { key: "spawn-bay-oil", position: [0.4, 0.041, 6.4] as [number, number, number], scale: [5.6, 2.2, 1] as [number, number, number], yaw: 0.16, opacity: 0.13 },
  ];

  return (
    <group>
      {decals.map((decal) => (
        <mesh
          key={decal.key}
          position={decal.position}
          rotation={[-Math.PI / 2, 0, decal.yaw]}
          scale={decal.scale}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={panelMap}
            color="#7fb0b8"
            transparent
            opacity={decal.opacity}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.045, -size + 1.15]} rotation={[-Math.PI / 2, 0, 0]} scale={[size * 1.15, 1.1, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ff5d4c" transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PanelLineSet({ lines }: { lines: readonly PanelLine[] }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    lines.forEach((line, index) => {
      dummy.position.set(line.position[0], line.position[1], line.position[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(line.scale[0], line.scale[1], line.scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.count = lines.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy, lines]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, lines.length]} matrixAutoUpdate={false} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#1c2a35"
        emissive="#183849"
        emissiveIntensity={0.18}
        metalness={0.35}
        roughness={0.6}
      />
    </instancedMesh>
  );
}

function PhysicalObstacle({
  obstacle,
  panelMap,
}: {
  obstacle: ArenaObstacleConfig;
  panelMap: MeshBasicMaterial["map"];
}) {
  const [hx, hy, hz] = obstacle.halfSize;
  const accent = obstacleAccent(obstacle.visualKey);
  const isCable = obstacle.visualKey === "cable_spine";
  const isConsole = obstacle.visualKey === "diagnostic_console" || obstacle.visualKey === "control_bank";
  const isBollard = obstacle.visualKey === "elevator_bollard";

  if (isCable) {
    return (
      <group position={obstacle.position}>
        <mesh castShadow receiveShadow scale={[hx * 2, hy * 2, hz * 2]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={obstacle.color ?? "#151b23"} metalness={0.74} roughness={0.48} />
        </mesh>
        {[-0.55, 0, 0.55].map((offset) => (
          <mesh key={offset} position={[offset * hx, hy + 0.035, 0]} scale={[0.07, 0.06, hz * 1.72]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#0a1017" metalness={0.82} roughness={0.34} />
          </mesh>
        ))}
        <mesh position={[0, hy + 0.07, -hz * 0.52]} scale={[hx * 1.45, 0.035, 0.12]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#6df0ff" transparent opacity={0.55} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={obstacle.position}>
      <mesh castShadow receiveShadow scale={[hx * 2, hy * 2, hz * 2]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={obstacle.color ?? sceneMaterialColor(obstacle.visualKey)}
          metalness={0.68}
          roughness={0.34}
        />
      </mesh>

      <mesh position={[0, hy + 0.035, 0]} scale={[hx * 1.72, 0.055, hz * 1.72]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#121a22" metalness={0.78} roughness={0.28} />
      </mesh>

      <mesh position={[0, hy + 0.075, -hz * 0.18]} scale={[hx * 1.28, 0.035, Math.max(0.12, hz * 0.12)]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.58} toneMapped={false} />
      </mesh>

      {!isBollard && (
        <>
          <mesh position={[0, hy * 0.12, hz + 0.012]} scale={[hx * 1.42, hy * 1.18, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={panelMap} color="#d4edf2" transparent opacity={isConsole ? 0.48 : 0.28} toneMapped={false} />
          </mesh>
          <mesh position={[0, hy * 0.12, -hz - 0.012]} rotation={[0, Math.PI, 0]} scale={[hx * 1.42, hy * 1.18, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={panelMap} color="#8fb4bc" transparent opacity={0.2} toneMapped={false} />
          </mesh>
        </>
      )}

      {isConsole && (
        <>
          <mesh position={[0, hy + 0.105, hz * 0.28]} rotation={[-0.42, 0, 0]} scale={[hx * 1.22, hz * 0.52, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={panelMap} color="#aaf7ff" transparent opacity={0.52} toneMapped={false} />
          </mesh>
          <mesh position={[hx + 0.018, hy * 0.45, 0]} rotation={[0, Math.PI / 2, 0]} scale={[hz * 1.35, hy * 1.1, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#5fe7ff" transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </>
      )}

      {isBollard && (
        <>
          <mesh position={[0, hy * 0.45, hz + 0.014]} scale={[hx * 1.12, hy * 0.62, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#ff5b4c" transparent opacity={0.5} toneMapped={false} />
          </mesh>
          <mesh position={[0, hy + 0.12, 0]} scale={[hx * 1.35, 0.06, hz * 1.35]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#7ff2ff" emissive="#45dfff" emissiveIntensity={0.95} />
          </mesh>
        </>
      )}

      {!isBollard && (
        <>
          <mesh position={[-hx * 0.72, -hy + 0.13, -hz * 0.72]} scale={[0.12, 0.26, 0.12]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#0c1218" metalness={0.75} roughness={0.42} />
          </mesh>
          <mesh position={[hx * 0.72, -hy + 0.13, hz * 0.72]} scale={[0.12, 0.26, 0.12]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#0c1218" metalness={0.75} roughness={0.42} />
          </mesh>
        </>
      )}
    </group>
  );
}

function obstacleAccent(visualKey: string) {
  const material = resolveMapMaterial(resolveMapVisual(visualKey).materialKey);
  return material.accent;
}

function RunwayMarkings({ size }: { size: number }) {
  const dashes = useMemo(() => Array.from({ length: 9 }, (_, index) => index), []);
  return (
    <group>
      <mesh position={[-1.35, 0.044, -2.4]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.18, size * 1.35, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#f2c14e" transparent opacity={0.46} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[1.35, 0.044, -2.4]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.18, size * 1.35, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#f2c14e" transparent opacity={0.46} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {dashes.map((index) => (
        <mesh
          key={index}
          position={[0, 0.052, 6.8 - index * 2.25]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.18, 0.86, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#7df2ff" transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.056, -13.9]} rotation={[-Math.PI / 2, 0, 0]} scale={[4.8, 0.16, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ff5a3d" transparent opacity={0.58} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function MaintenanceImmersionLayer({ world, size }: { world: GameWorld; size: number }) {
  const reserveBots = useMemo(() => createReserveBots(size), [size]);
  const scanRef = useRef<Mesh>(null);
  const warningRef = useRef<Mesh>(null);
  const fogRef = useRef<Mesh>(null);
  const ceilingRef = useRef<Group>(null);
  const redLightRef = useRef<PointLight>(null);
  const cyanLightRef = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    const pressure = environmentPressure(world);
    const time = clock.elapsedTime;
    const scan = scanRef.current;
    if (scan) {
      scan.position.z = size - ((time * (3.2 + pressure * 2.2)) % (size * 2));
      const material = scan.material as MeshBasicMaterial;
      material.opacity = 0.12 + pressure * 0.24 + Math.sin(time * 7) * 0.04;
    }

    const warning = warningRef.current;
    if (warning) {
      const material = warning.material as MeshBasicMaterial;
      material.opacity = 0.08 + pressure * (0.18 + Math.max(0, Math.sin(time * 5.5)) * 0.22);
      warning.scale.x = 0.92 + pressure * 0.16 + Math.sin(time * 2.1) * 0.03;
    }

    const fog = fogRef.current;
    if (fog) {
      const material = fog.material as MeshBasicMaterial;
      material.opacity = 0.045 + pressure * 0.075;
      fog.position.y = 2.62 + Math.sin(time * 0.8) * 0.06;
    }

    if (ceilingRef.current) {
      ceilingRef.current.rotation.y = Math.sin(time * 0.7) * 0.045 * (0.4 + pressure);
    }

    if (redLightRef.current) redLightRef.current.intensity = 0.9 + pressure * 4.2 + Math.sin(time * 6) * pressure;
    if (cyanLightRef.current) cyanLightRef.current.intensity = 1.2 + pressure * 2.8;
  });

  return (
    <group>
      <pointLight ref={redLightRef} position={[0, 3.8, -size + 2.4]} color="#ff4d3d" distance={20} intensity={1.2} />
      <pointLight ref={cyanLightRef} position={[0, 4.6, 3.5]} color="#50e6ff" distance={22} intensity={1.6} />

      <ContainmentWindows size={size} />

      <BackgroundRobotSet bots={reserveBots} />

      <group ref={ceilingRef}>
        <CeilingRepairArm position={[-7.2, 4.15, -8.8]} rotationY={0.35} />
        <CeilingRepairArm position={[7.4, 4.25, -7.2]} rotationY={-0.45} />
        <CeilingRepairArm position={[-8.4, 4.1, 1.8]} rotationY={1.18} />
        <CeilingRepairArm position={[8.2, 4.2, 2.4]} rotationY={-1.05} />
      </group>

      <mesh ref={scanRef} position={[0, 0.095, 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[size * 1.75, 0.34, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#6cf5ff"
          transparent
          opacity={0.18}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={warningRef} position={[0, 2.95, -size + 0.35]} scale={[size * 1.35, 1.7, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#ff3d2f"
          transparent
          opacity={0.16}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={fogRef} position={[0, 2.62, -size + 0.55]} scale={[size * 1.28, 1.35, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#2bc5d8"
          transparent
          opacity={0.06}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function ContainmentWindows({ size }: { size: number }) {
  const windows = [
    { key: "west-glass", position: [-size + 0.18, 1.95, -3.5] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number], scale: [10.8, 2.7, 1] as [number, number, number] },
    { key: "east-glass", position: [size - 0.18, 1.95, -4.2] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number], scale: [10.8, 2.7, 1] as [number, number, number] },
  ];

  return (
    <>
      {windows.map((windowPane) => (
        <group key={windowPane.key} position={windowPane.position} rotation={windowPane.rotation}>
          <mesh scale={windowPane.scale}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial
              color="#163542"
              emissive="#1a6a7c"
              emissiveIntensity={0.45}
              transparent
              opacity={0.22}
              roughness={0.18}
              metalness={0.25}
              side={DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, 0.01]} scale={[windowPane.scale[0], 0.045, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#77f4ff" transparent opacity={0.38} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.78, 0.012]} scale={[windowPane.scale[0], 0.035, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#77f4ff" transparent opacity={0.24} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

interface BackdropBot {
  key: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  alert: boolean;
}

interface BackdropBotPart {
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale: readonly [number, number, number];
}

const BACKDROP_BOT_BODY: BackdropBotPart = {
  position: [0, 1.08, 0],
  scale: [0.36, 0.7, 0.22],
};
const BACKDROP_BOT_HEAD: BackdropBotPart = {
  position: [0, 1.66, 0.02],
  scale: [0.3, 0.22, 0.2],
};
const BACKDROP_BOT_EYE: BackdropBotPart = {
  position: [0, 1.68, 0.14],
  scale: [0.24, 0.035, 0.025],
};
const BACKDROP_BOT_LEFT_ARM: BackdropBotPart = {
  position: [-0.34, 1.02, 0.02],
  rotation: [0, 0, 0.2],
  scale: [0.12, 0.58, 0.14],
};
const BACKDROP_BOT_RIGHT_ARM: BackdropBotPart = {
  position: [0.34, 1.02, 0.02],
  rotation: [0, 0, -0.2],
  scale: [0.12, 0.58, 0.14],
};

function BackgroundRobotSet({ bots }: { bots: readonly BackdropBot[] }) {
  return (
    <group>
      <InstancedBackdropBox bots={bots} part={BACKDROP_BOT_BODY}>
        <meshStandardMaterial color="#172431" metalness={0.8} roughness={0.38} emissive="#0a323b" emissiveIntensity={0.35} />
      </InstancedBackdropBox>
      <InstancedBackdropBox bots={bots} part={BACKDROP_BOT_HEAD}>
        <meshStandardMaterial color="#1a2b37" metalness={0.82} roughness={0.32} emissive="#061c22" emissiveIntensity={0.3} />
      </InstancedBackdropBox>
      <InstancedBackdropBox bots={bots} part={BACKDROP_BOT_LEFT_ARM}>
        <meshStandardMaterial color="#0d131a" metalness={0.75} roughness={0.4} />
      </InstancedBackdropBox>
      <InstancedBackdropBox bots={bots} part={BACKDROP_BOT_RIGHT_ARM}>
        <meshStandardMaterial color="#0d131a" metalness={0.75} roughness={0.4} />
      </InstancedBackdropBox>
      <InstancedBackdropBox
        bots={bots}
        part={BACKDROP_BOT_EYE}
        colorForBot={(bot) => (bot.alert ? "#ff513d" : "#64d7ff")}
      >
        <meshBasicMaterial
          color="#ffffff"
          vertexColors
          transparent
          opacity={0.72}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </InstancedBackdropBox>
    </group>
  );
}

function InstancedBackdropBox({
  bots,
  part,
  colorForBot,
  children,
}: {
  bots: readonly BackdropBot[];
  part: BackdropBotPart;
  colorForBot?: (bot: BackdropBot) => string;
  children: ReactNode;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    bots.forEach((bot, index) => {
      setBackdropBotPartTransform(dummy, bot, part);
      mesh.setMatrixAt(index, dummy.matrix);
      if (colorForBot) {
        color.set(colorForBot(bot));
        mesh.setColorAt(index, color);
      }
    });
    mesh.count = bots.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [bots, color, colorForBot, dummy, part]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, bots.length]} matrixAutoUpdate={false}>
      <boxGeometry args={[1, 1, 1]} />
      {children}
    </instancedMesh>
  );
}

function setBackdropBotPartTransform(dummy: Object3D, bot: BackdropBot, part: BackdropBotPart) {
  const localX = part.position[0] * bot.scale;
  const localY = part.position[1] * bot.scale;
  const localZ = part.position[2] * bot.scale;
  const sinY = Math.sin(bot.rotationY);
  const cosY = Math.cos(bot.rotationY);

  dummy.position.set(
    bot.position[0] + localX * cosY + localZ * sinY,
    bot.position[1] + localY,
    bot.position[2] - localX * sinY + localZ * cosY,
  );
  dummy.rotation.set(part.rotation?.[0] ?? 0, bot.rotationY + (part.rotation?.[1] ?? 0), part.rotation?.[2] ?? 0);
  dummy.scale.set(part.scale[0] * bot.scale, part.scale[1] * bot.scale, part.scale[2] * bot.scale);
  dummy.updateMatrix();
}

function CeilingRepairArm({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh scale={[0.18, 0.12, 1.55]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#202a35" metalness={0.74} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.42, 1.32]} scale={[0.16, 0.72, 0.16]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#151c24" metalness={0.78} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.78, 1.52]} scale={[0.52, 0.08, 0.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ff513d" transparent opacity={0.7} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

function First90MaintenanceSet({ size, panelMap }: { size: number; panelMap: MeshBasicMaterial["map"] }) {
  return (
    <group>
      <mesh position={[0, 2.15, -size + 0.08]} scale={[7.4, 4.65, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={panelMap} color="#d8f5ff" toneMapped={false} />
      </mesh>

      <mesh position={[0, 0.036, -6.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[7.2, 4.9, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={panelMap}
          color="#7ea2ae"
          emissive="#08222a"
          emissiveIntensity={0.26}
          metalness={0.68}
          roughness={0.34}
          transparent
          opacity={0.9}
        />
      </mesh>

      <mesh position={[-4.4, 1.24, 6.1]} rotation={[0, 0.2, 0]} scale={[1.1, 2.1, 0.18]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#242e39" metalness={0.76} roughness={0.28} />
      </mesh>
      <mesh position={[4.4, 1.24, 6.1]} rotation={[0, -0.2, 0]} scale={[1.1, 2.1, 0.18]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#242e39" metalness={0.76} roughness={0.28} />
      </mesh>
      <mesh position={[-3.92, 1.9, 5.92]} rotation={[0, 0.2, 0]} scale={[0.12, 1.15, 0.06]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#70eaff" emissive="#30dfff" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh position={[3.92, 1.9, 5.92]} rotation={[0, -0.2, 0]} scale={[0.12, 1.15, 0.06]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#70eaff" emissive="#30dfff" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.075, 7.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[4.8, 1.15, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#65eaff" emissive="#17bfd8" emissiveIntensity={0.85} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function sceneMaterialColor(visualKey: string) {
  return resolveMapMaterial(resolveMapVisual(visualKey).materialKey).color;
}

function createReserveBots(size: number): BackdropBot[] {
  const bots: BackdropBot[] = [];
  for (let index = 0; index < 5; index += 1) {
    const z = -10.8 + index * 3.25;
    bots.push({
      key: `reserve-west-${index}`,
      position: [-size + 0.52, 0.1, z],
      rotationY: Math.PI / 2,
      scale: 0.78 + (index % 3) * 0.08,
      alert: index % 2 === 0,
    });
    bots.push({
      key: `reserve-east-${index}`,
      position: [size - 0.52, 0.1, z - 0.75],
      rotationY: -Math.PI / 2,
      scale: 0.74 + (index % 4) * 0.07,
      alert: index % 3 === 0,
    });
  }

  for (let index = 0; index < 7; index += 1) {
    bots.push({
      key: `reserve-north-${index}`,
      position: [-6.2 + index * 2.05, 1.65, -size + 0.2],
      rotationY: 0,
      scale: 0.76 + (index % 2) * 0.1,
      alert: true,
    });
  }
  return bots;
}

function environmentPressure(world: GameWorld) {
  const pressure = world.level.presentation.environmentPressure;
  if (world.session.mode === "title") return pressure.title;
  if (world.session.activeWaveId) return pressure.byWave[world.session.activeWaveId] ?? pressure.idle;
  if (world.session.exitUnlocked) return pressure.exitUnlocked;
  if (world.session.mode === "death") return pressure.death;
  return pressure.idle;
}

function ExitPad({ world }: { world: GameWorld }) {
  const exit = world.level.exit;
  const ringRef = useRef<Mesh>(null);
  const beamRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const unlocked = world.session.exitUnlocked;
    const pulse = 0.55 + Math.sin(clock.elapsedTime * 5) * 0.25;
    if (ringRef.current) {
      ringRef.current.visible = unlocked;
      ringRef.current.scale.setScalar(1 + pulse * 0.08);
      const material = ringRef.current.material as MeshStandardMaterial;
      material.opacity = unlocked ? 0.35 + pulse * 0.28 : 0;
      material.emissiveIntensity = unlocked ? 0.9 + pulse : 0;
    }
    if (beamRef.current) {
      beamRef.current.visible = unlocked;
      const material = beamRef.current.material as MeshStandardMaterial;
      material.emissiveIntensity = unlocked ? 1.5 + pulse * 1.8 : 0;
    }
  });

  return (
    <group position={exit.position}>
      <mesh ref={ringRef} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, exit.radius, 48]} />
        <meshStandardMaterial color="#5fdfff" emissive="#2ca6d2" emissiveIntensity={0.8} transparent opacity={0.42} />
      </mesh>
      <mesh ref={beamRef} position={[0, 0.08, 0]} scale={[2.8, 0.08, 0.16]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#94f4ff" emissive="#5fdfff" emissiveIntensity={1.45} />
      </mesh>
    </group>
  );
}

function BoundaryWalls({ size }: { size: number }) {
  const walls = [
    {
      key: "north",
      position: [0, 0.72, -size - 0.18] as [number, number, number],
      scale: [size * 2, 1.45, 0.36] as [number, number, number],
      glowPosition: [0, 1.48, -size - 0.39] as [number, number, number],
      glowScale: [size * 1.55, 0.06, 0.06] as [number, number, number],
    },
    {
      key: "west",
      position: [-size - 0.18, 0.72, 0] as [number, number, number],
      scale: [0.36, 1.45, size * 2] as [number, number, number],
      glowPosition: [-size - 0.39, 1.48, 0] as [number, number, number],
      glowScale: [0.06, 0.06, size * 1.55] as [number, number, number],
    },
    {
      key: "east",
      position: [size + 0.18, 0.72, 0] as [number, number, number],
      scale: [0.36, 1.45, size * 2] as [number, number, number],
      glowPosition: [size + 0.39, 1.48, 0] as [number, number, number],
      glowScale: [0.06, 0.06, size * 1.55] as [number, number, number],
    },
  ];

  return (
    <>
      {walls.map((wall) => (
        <group key={wall.key}>
          <mesh castShadow receiveShadow position={wall.position} scale={wall.scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#101922" metalness={0.58} roughness={0.42} />
          </mesh>
          <mesh position={wall.glowPosition} scale={wall.glowScale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#5fdfff" emissive="#35d4ff" emissiveIntensity={1.25} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function createPanelLines(size: number) {
  const lines: PanelLine[] = [];
  for (let value = -size; value <= size; value += 2) {
    lines.push({
      key: `x-${value}`,
      position: [value, 0.018, 0],
      scale: [0.025, 0.025, size * 2],
    });
    lines.push({
      key: `z-${value}`,
      position: [0, 0.019, value],
      scale: [size * 2, 0.025, 0.025],
    });
  }
  return lines;
}

function BoundaryGlow({ size }: { size: number }) {
  const strips = [
    {
      key: "north",
      position: [0, 0.08, -size] as [number, number, number],
      scale: [size * 2, 0.08, 0.08] as [number, number, number],
    },
    {
      key: "south",
      position: [0, 0.08, size] as [number, number, number],
      scale: [size * 2, 0.08, 0.08] as [number, number, number],
    },
    {
      key: "west",
      position: [-size, 0.08, 0] as [number, number, number],
      scale: [0.08, 0.08, size * 2] as [number, number, number],
    },
    {
      key: "east",
      position: [size, 0.08, 0] as [number, number, number],
      scale: [0.08, 0.08, size * 2] as [number, number, number],
    },
  ];

  return (
    <>
      {strips.map((strip) => (
        <mesh key={strip.key} position={strip.position} scale={strip.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#55dfff" emissive="#47d7ff" emissiveIntensity={1.6} />
        </mesh>
      ))}
    </>
  );
}
