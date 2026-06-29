import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { AdditiveBlending, CanvasTexture, ClampToEdgeWrapping, DoubleSide, Group, Mesh, MeshStandardMaterial, Object3D, PointLight, SRGBColorSpace, Texture } from "three";
import {
  getEnvironmentModelAsset,
  isEnvironmentModelKey,
  modelKeyForInteraction,
  type EnvironmentModelKey,
} from "../assets/environmentModelAssets";
import { isStoryPaintingArtModelKey, storyPaintingArtRuntimeSpec } from "../game/visual/StoryPaintingArt";
import { resolveRoomPresentation } from "../game/config/RoomPresentationRegistry";
import type {
  LevelBigScreenColorKey,
  LevelBigScreenDefinition,
  LevelBigScreenStateDefinition,
  LevelDirectionDigitClueDefinition,
  LevelDoorDefinition,
  LevelEnvironmentStateDefinition,
  LevelHitSequenceClueSurfaceDefinition,
  LevelHitSequencePuzzleDefinition,
  LevelInteractionDefinition,
  LevelMapDecalDefinition,
  LevelMapPropDefinition,
  LevelPuzzleTargetDefinition,
  LevelRoomDefinition,
  LevelSwitchDefinition,
  Vec3Tuple,
} from "../game/config/schema/levelConfig";
import type { GameWorld } from "../game/core/GameWorld";
import { isExitCinematicViewActive } from "../game/core/ExitCinematicView";
import { exitElevatorButtonVisualState, exitElevatorShaftVisualState } from "../game/core/ExitCinematicTiming";
import { interactionFocusRevealRiseOffsetY, isInteractionVisualVisible, isRoomRenderVisible } from "../game/core/RenderVisibility";
import {
  resolveDoorMaterial,
  resolveDoorSkin,
  resolveDoorVisual,
  resolveInteractionMaterial,
  resolveMapMaterial,
  resolveMapVisual,
  resolvePuzzleTargetMaterial,
  resolveRoomAesthetic,
  resolveRoomFloorMaterial,
  resolveRoomWallMaterial,
  type MapMaterialProfile,
} from "../game/visual/AssetResolver";
import { type First90Textures, useFirst90Textures } from "./art/First90Textures";
import { EnvironmentModelInstance } from "./environment/EnvironmentModelInstance";
import { StoryPaintingArtPlane } from "./environment/StoryPaintingArtPlane";
import { ConfiguredKeyItemRenderer } from "./environment/ConfiguredKeyItemRenderer";
import { ConfiguredMapAssetShell as ConfiguredRoomShellRenderer } from "./environment/ConfiguredRoomShell";

interface MapGeometryRendererProps {
  world: GameWorld;
}

interface AtlasRegion {
  offset: [number, number];
  repeat: [number, number];
}

const atlasRegions = {
  trimCyanLong: { offset: [0.44, 0.89], repeat: [0.5, 0.055] },
  trimAmberLong: { offset: [0.46, 0.59], repeat: [0.4, 0.06] },
  trimHazardLong: { offset: [0.46, 0.77], repeat: [0.46, 0.055] },
  trimDoorPanel: { offset: [0.02, 0.42], repeat: [0.18, 0.52] },
  trimVent: { offset: [0.74, 0.46], repeat: [0.16, 0.13] },
  surfaceWetFloor: { offset: [0.02, 0.76], repeat: [0.22, 0.22] },
  surfacePanelDark: { offset: [0.27, 0.76], repeat: [0.22, 0.22] },
  surfaceHazard: { offset: [0.73, 0.29], repeat: [0.24, 0.18] },
  surfaceSterile: { offset: [0.48, 0.35], repeat: [0.24, 0.18] },
  surfaceResidential: { offset: [0.48, 0.2], repeat: [0.24, 0.18] },
  backdropLab: { offset: [0.01, 0.67], repeat: [0.48, 0.31] },
  backdropCorridor: { offset: [0.51, 0.67], repeat: [0.48, 0.31] },
  backdropServiceDoor: { offset: [0.01, 0.34], repeat: [0.48, 0.31] },
  backdropResidential: { offset: [0.51, 0.34], repeat: [0.48, 0.31] },
  backdropSterile: { offset: [0.01, 0.01], repeat: [0.48, 0.31] },
  backdropHazard: { offset: [0.51, 0.01], repeat: [0.48, 0.31] },
  propTerminalWide: { offset: [0.02, 0.82], repeat: [0.22, 0.14] },
  propWarningPlate: { offset: [0.73, 0.8], repeat: [0.22, 0.12] },
} satisfies Record<string, AtlasRegion>;

export function MapGeometryRenderer({ world }: MapGeometryRendererProps) {
  const map = world.level.map;
  const artTextures = useFirst90Textures();

  if (!map) return null;
  if (isExitCinematicViewActive(world)) {
    return (
      <group>
        <ConfiguredMapProps world={world} exitCinematicOnly />
        <ExitCinematicElevatorFx world={world} />
      </group>
    );
  }

  return (
    <group>
      <ConfiguredRoomShellRenderer world={world} />
      <ConfiguredMapProps world={world} />
      <ConfiguredDynamicProps world={world} />
      <ExitCinematicElevatorFx world={world} />
      <ConfiguredMapDecals world={world} />
      {world.activeEnvironmentStates().map((state) => (
        <EnvironmentStateLayer key={`environment-state:${state.id}`} state={state} world={world} />
      ))}
      <ConfiguredKeyItemRenderer world={world} />
      {map.interactions.filter((interaction) => isRoomRenderVisible(world, interaction.roomId) && isInteractionVisualVisible(world, interaction)).map((interaction) => (
        <InteractionMarker
          key={interaction.id}
          world={world}
          interaction={interaction}
          room={map.rooms.find((room) => room.id === interaction.roomId)}
          completed={world.session.mapProgress.completedInteractionIds.includes(interaction.id)}
        />
      ))}
      {world.level.bigScreens?.filter((screen) => isRoomRenderVisible(world, screen.roomId)).map((screen) => (
        <BigScreenMarker key={screen.id} screen={screen} world={world} />
      ))}
      {world.level.puzzles?.flatMap((puzzle) =>
        puzzle.type === "hit_sequence"
          ? [
              ...(puzzle.clue.surfaces ?? []).filter((surface) => isRoomRenderVisible(world, surface.roomId)).map((surface) => (
                <HitSequenceClueSurface
                  key={`${puzzle.id}:surface:${surface.id}`}
                  puzzle={puzzle}
                  surface={surface}
                  completed={world.isPuzzleCompleted(puzzle.id)}
                />
              )),
              ...puzzle.targets.filter((target) => isRoomRenderVisible(world, target.roomId)).map((target) => (
                <PuzzleTargetMarker key={`${puzzle.id}:${target.id}`} puzzle={puzzle} target={target} world={world} />
              )),
            ]
          : puzzle.type === "code_lock"
            ? puzzle.clues.filter((clue) => isRoomRenderVisible(world, clue.roomId)).map((clue) => (
              <DirectionDigitClueMarker key={`${puzzle.id}:${clue.id}`} clue={clue} completed={world.isPuzzleCompleted(puzzle.id)} />
            ))
            : null,
      )}
    </group>
  );
}

function ConfiguredMapDecals({ world }: { world: GameWorld }) {
  const decals = (world.level.map?.decals ?? []).filter((decal) => isRoomRenderVisible(world, decal.roomId));
  if (decals.length === 0) return null;

  return (
    <group>
      {decals.map((decal) => (
        <ConfiguredMapDecal key={decal.id} decal={decal} />
      ))}
    </group>
  );
}

function ConfiguredMapDecal({ decal }: { decal: LevelMapDecalDefinition }) {
  const texture = useMemo(() => createHumanReferenceDecalTexture(decal.kind), [decal.kind]);
  const rotation: [number, number, number] = decal.rotation ? [decal.rotation[0], decal.rotation[1], decal.rotation[2]] : [0, 0, 0];
  return (
    <mesh position={decal.position} rotation={rotation} scale={[decal.size[0], decal.size[1], 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={decal.opacity ?? 0.82}
        side={DoubleSide}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function createHumanReferenceDecalTexture(kind: LevelMapDecalDefinition["kind"]) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Missing canvas context");

  const gradient = ctx.createLinearGradient(0, 0, 512, 768);
  gradient.addColorStop(0, "rgba(18, 48, 58, 0.96)");
  gradient.addColorStop(1, "rgba(4, 12, 18, 0.96)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 768);
  ctx.strokeStyle = "rgba(132, 239, 255, 0.86)";
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, 464, 720);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 221, 156, 0.55)";
  ctx.strokeRect(48, 58, 416, 642);

  const title =
    kind === "human_body_reference" ? "HUMAN SCALE" : kind === "human_hand_reference" ? "HAND ASSET" : "SPINE MAP";
  ctx.fillStyle = "rgba(216, 250, 255, 0.9)";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText(title, 58, 116);
  ctx.fillStyle = "rgba(118, 238, 255, 0.74)";
  ctx.font = "600 19px system-ui, sans-serif";
  ctx.fillText("LEVEL 01 REFERENCE", 58, 152);

  ctx.save();
  ctx.translate(256, 398);
  ctx.strokeStyle = "rgba(238, 252, 255, 0.9)";
  ctx.fillStyle = "rgba(238, 252, 255, 0.84)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (kind === "human_body_reference") {
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(0, -170, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -120);
    ctx.lineTo(0, 70);
    ctx.moveTo(-92, -76);
    ctx.lineTo(92, -76);
    ctx.moveTo(-42, 68);
    ctx.lineTo(-78, 210);
    ctx.moveTo(42, 68);
    ctx.lineTo(78, 210);
    ctx.stroke();
    ctx.strokeStyle = "rgba(119, 240, 255, 0.86)";
    ctx.lineWidth = 5;
    for (const y of [-100, -40, 20, 82]) {
      ctx.beginPath();
      ctx.moveTo(-126, y);
      ctx.lineTo(-42, y);
      ctx.moveTo(42, y);
      ctx.lineTo(126, y);
      ctx.stroke();
    }
  } else if (kind === "human_hand_reference") {
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(-38, 112);
    ctx.lineTo(-34, -30);
    ctx.lineTo(-92, -104);
    ctx.stroke();
    for (const [x, h] of [[-60, 180], [-20, 220], [22, 210], [62, 168]]) {
      ctx.beginPath();
      ctx.moveTo(x, 70);
      ctx.lineTo(x + 8, 70 - h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 112, 92, 118, 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 200, 112, 0.82)";
    ctx.lineWidth = 5;
    for (const x of [-60, -20, 22, 62]) {
      ctx.beginPath();
      ctx.arc(x + 4, -42, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, -176, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -130);
    for (let i = 0; i < 12; i += 1) {
      const y = -120 + i * 23;
      ctx.lineTo(Math.sin(i * 0.85) * 18, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(119, 240, 255, 0.82)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-82, -58);
    ctx.lineTo(82, -58);
    ctx.moveTo(-58, 84);
    ctx.lineTo(58, 84);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(119, 240, 255, 0.5)";
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(58, 626 + i * 21, 240 - i * 28, 6);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function ConfiguredMapProps({ world, exitCinematicOnly = false }: { world: GameWorld; exitCinematicOnly?: boolean }) {
  const allProps = world.level.map?.props ?? [];
  const hasExitStage = allProps.some((prop) => prop.modelKey === "service_elevator_exit_stage");
  const props = exitCinematicOnly
    ? allProps.filter((prop) => (hasExitStage ? prop.modelKey === "service_elevator_exit_stage" : isLegacyExitElevatorStageProp(prop.modelKey)))
    : allProps.filter((prop) => isRoomRenderVisible(world, prop.roomId) && !isHiddenExitStageFallbackProp(prop, allProps));
  if (props.length === 0) return null;

  return (
    <group>
      {props.map((prop) => (
        <ConfiguredMapProp key={prop.id} prop={prop} world={world} />
      ))}
    </group>
  );
}

function ConfiguredDynamicProps({ world }: { world: GameWorld }) {
  const props = world.dynamicProps.filter((prop) => !prop.roomId || isRoomRenderVisible(world, prop.roomId));
  if (props.length === 0) return null;

  return (
    <group>
      {props.map((prop) => (
        <ConfiguredDynamicProp key={prop.id} prop={prop} />
      ))}
    </group>
  );
}

function ConfiguredDynamicProp({ prop }: { prop: GameWorld["dynamicProps"][number] }) {
  if (!isEnvironmentModelKey(prop.modelKey)) return null;
  return (
    <EnvironmentModelInstance
      modelKey={prop.modelKey}
      position={[prop.position.x, prop.position.y, prop.position.z]}
      rotation={[0, prop.yaw, 0]}
      scale={[prop.scale.x, prop.scale.y, prop.scale.z]}
      castShadow
      receiveShadow
    />
  );
}

function isLegacyExitElevatorStageProp(modelKey: string) {
  return (
    modelKey === "service_elevator_interior_shell" ||
    modelKey === "door_threshold_service_elevator" ||
    modelKey === "service_elevator_call_buttons" ||
    modelKey === "service_elevator_ascent_shaft_fx"
  );
}

function isHiddenExitStageFallbackProp(prop: LevelMapPropDefinition, allProps: readonly LevelMapPropDefinition[]) {
  if (prop.modelKey === "service_elevator_exit_stage") return false;
  if (!isLegacyExitElevatorStageProp(prop.modelKey)) return false;
  return allProps.some((candidate) => candidate.roomId === prop.roomId && candidate.modelKey === "service_elevator_exit_stage");
}

function ConfiguredMapProp({ prop, world }: { prop: LevelMapPropDefinition; world: GameWorld }) {
  const rotation = prop.rotation ?? [0, 0, 0];
  const scale = prop.scale ?? 1;
  if (prop.initiallyVisible === false) return null;
  if (prop.tags?.includes("cinematic_reveal") && !isExitCinematicRevealVisible(world)) return null;
  if (isStoryPaintingArtModelKey(prop.modelKey)) {
    const scaleVector: [number, number, number] = typeof scale === "number" ? [scale, scale, scale] : [scale[0], scale[1], scale[2]];
    const storySpec = storyPaintingArtRuntimeSpec(prop.modelKey);
    return (
      <group position={[prop.position[0], prop.position[1], prop.position[2]]} rotation={[rotation[0], rotation[1], rotation[2]]} scale={scaleVector}>
        <StoryPaintingArtPlane
          modelKey={prop.modelKey}
          width={storySpec?.size[0] ?? 0.98}
          height={storySpec?.size[1] ?? 0.9}
          yOffset={storySpec?.centerY ?? 0.68}
          zOffset={0.075}
          accent="#ffce8a"
        />
      </group>
    );
  }
  if (!isEnvironmentModelKey(prop.modelKey)) return null;
  if (prop.modelKey === "service_elevator_exit_stage") {
    return <ServiceElevatorExitStageRig world={world} position={prop.position} rotation={rotation} scale={scale} />;
  }
  if (prop.modelKey === "service_elevator_call_buttons") {
    return <ServiceElevatorCallButtonRig world={world} position={prop.position} rotation={rotation} scale={scale} />;
  }
  if (prop.modelKey === "service_elevator_ascent_shaft_fx") {
    return <ServiceElevatorAscentShaftRig world={world} position={prop.position} rotation={rotation} scale={scale} />;
  }
  return (
    <EnvironmentModelInstance
      modelKey={prop.modelKey}
      position={prop.position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
}

function isExitCinematicRevealVisible(world: GameWorld) {
  const cinematic = world.session.activeExitCinematic;
  if (!isExitCinematicViewActive(world) || !cinematic) return false;
  return cinematic.elapsed >= cinematic.buttonPressTime - Math.max(0.2, cinematic.buttonPressDuration);
}

interface RuntimeButtonPart {
  object: Object3D;
  baseX: number;
  baseZ: number;
  kind: "plunger" | "ring" | "readout" | "recess" | "mechanism";
  materials: MeshStandardMaterial[];
}

interface RuntimeShaftPart {
  object: Object3D;
  baseY: number;
  kind: "column" | "beam" | "fog" | "static";
  index: number;
  materials: MeshStandardMaterial[];
}

function ServiceElevatorExitStageRig({
  world,
  position,
  rotation,
  scale,
}: {
  world: GameWorld;
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: number | Vec3Tuple;
}) {
  const buttonPartsRef = useRef<RuntimeButtonPart[]>([]);
  const shaftPartsRef = useRef<RuntimeShaftPart[]>([]);

  const handleObjectReady = useCallback((object: Object3D | null) => {
    buttonPartsRef.current = object ? prepareServiceElevatorButtonParts(object) : [];
    shaftPartsRef.current = object ? prepareServiceElevatorShaftParts(object) : [];
  }, []);

  useFrame(({ clock }) => {
    animateServiceElevatorButtonParts(buttonPartsRef.current, world);
    animateServiceElevatorShaftParts(shaftPartsRef.current, world, clock.elapsedTime);
  });

  return (
    <EnvironmentModelInstance
      modelKey="service_elevator_exit_stage"
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      onObjectReady={handleObjectReady}
    />
  );
}

function ServiceElevatorCallButtonRig({
  world,
  position,
  rotation,
  scale,
}: {
  world: GameWorld;
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: number | Vec3Tuple;
}) {
  const partsRef = useRef<RuntimeButtonPart[]>([]);

  const handleObjectReady = useCallback((object: Object3D | null) => {
    partsRef.current = object ? prepareServiceElevatorButtonParts(object) : [];
  }, []);

  useFrame(() => animateServiceElevatorButtonParts(partsRef.current, world));

  return (
    <EnvironmentModelInstance
      modelKey="service_elevator_call_buttons"
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      onObjectReady={handleObjectReady}
    />
  );
}

function animateServiceElevatorButtonParts(parts: RuntimeButtonPart[], world: GameWorld) {
  const cinematic = world.session.activeExitCinematic;
  const visual = isExitCinematicViewActive(world) && cinematic ? exitElevatorButtonVisualState(cinematic) : exitElevatorButtonVisualState(null);
  const cyan = "#4eaeb8";
  const amber = "#b48a52";
  const warmSteel = "#625f52";
  const glowColor = visual.amberMix > 0.42 ? amber : cyan;
  for (const part of parts) {
    const travel =
      part.kind === "plunger" || part.kind === "ring"
        ? visual.pressDepthMeters
        : part.kind === "mechanism"
          ? visual.pressDepthMeters * 0.45
          : 0;
    if (part.object.name.startsWith("stage_button_")) {
      part.object.position.x = part.baseX + travel;
    } else {
      part.object.position.z = part.baseZ - travel;
    }
    const settleScale = 1 - visual.plunger * (part.kind === "plunger" ? 0.035 : part.kind === "mechanism" ? 0.014 : 0.018);
    part.object.scale.setScalar(settleScale);
    for (const material of part.materials) {
      if (part.kind === "ring" || part.kind === "readout") {
        material.color.set(glowColor);
        material.emissive.set(glowColor);
        material.emissiveIntensity = part.kind === "ring" ? visual.ringGlow * 0.42 : 0.28 + visual.panelConfirm * 0.58;
        material.toneMapped = false;
      } else if (part.kind === "plunger") {
        material.color.set(visual.amberMix > 0.4 ? warmSteel : "#344241");
        material.emissive.set(glowColor);
        material.emissiveIntensity = 0.018 + visual.contactPulse * 0.1 + visual.panelConfirm * 0.045;
      } else if (part.kind === "recess") {
        material.emissive.set(glowColor);
        material.emissiveIntensity = 0.025 + visual.plunger * 0.1;
      } else if (part.kind === "mechanism") {
        material.emissive.set(glowColor);
        material.emissiveIntensity = 0.012 + visual.contactPulse * 0.08;
      }
    }
  }
}

function prepareServiceElevatorButtonParts(object: Object3D): RuntimeButtonPart[] {
  const parts: RuntimeButtonPart[] = [];
  object.traverse((child) => {
    const name = child.name;
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((material) => material.clone());
      else if (mesh.material) mesh.material = mesh.material.clone();
    }
    const kind = serviceElevatorButtonPartKind(name);
    if (!kind) return;
    const materials = buttonStandardMaterials(mesh);
    parts.push({
      object: child,
      baseX: child.position.x,
      baseZ: child.position.z,
      kind,
      materials,
    });
  });
  return parts;
}

function serviceElevatorButtonPartKind(name: string): RuntimeButtonPart["kind"] | null {
  if (/spring_carriage|spring_coil|guide_pin|contact_washer/i.test(name)) return "mechanism";
  if (/plunger/i.test(name)) return "plunger";
  if (/glass_ring/i.test(name)) return "ring";
  if (/readout/i.test(name)) return "readout";
  if (/recess|spring/i.test(name)) return "recess";
  return null;
}

function buttonStandardMaterials(mesh: Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  return materials.filter((material): material is MeshStandardMaterial => material instanceof MeshStandardMaterial);
}

function ServiceElevatorAscentShaftRig({
  world,
  position,
  rotation,
  scale,
}: {
  world: GameWorld;
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: number | Vec3Tuple;
}) {
  const partsRef = useRef<RuntimeShaftPart[]>([]);

  const handleObjectReady = useCallback((object: Object3D | null) => {
    partsRef.current = object ? prepareServiceElevatorShaftParts(object) : [];
  }, []);

  useFrame(({ clock }) => animateServiceElevatorShaftParts(partsRef.current, world, clock.elapsedTime));

  return (
    <EnvironmentModelInstance
      modelKey="service_elevator_ascent_shaft_fx"
      position={position}
      rotation={rotation}
      scale={scale}
      receiveShadow={false}
      onObjectReady={handleObjectReady}
    />
  );
}

function animateServiceElevatorShaftParts(parts: RuntimeShaftPart[], world: GameWorld, clockElapsed: number) {
  const cinematic = world.session.activeExitCinematic;
  const active = isExitCinematicViewActive(world) && cinematic;
  const shaft = active ? exitElevatorShaftVisualState(cinematic) : exitElevatorShaftVisualState(null);
  const elapsed = cinematic ? Math.max(0, cinematic.elapsed - cinematic.ascentStartTime) : 0;
  for (const part of parts) {
    if (part.kind === "static") {
      const alpha = active ? Math.min(0.82, shaft.reveal * 0.72 + shaft.ascent * 0.1) : 0;
      part.object.visible = alpha > 0.015;
      for (const material of part.materials) {
        material.transparent = alpha < 0.98;
        material.opacity = alpha;
        material.depthWrite = alpha >= 0.72;
        material.emissiveIntensity = 0.06 + shaft.ascent * 0.18;
      }
      continue;
    }
    const speed = (part.kind === "fog" ? 0.72 : part.kind === "beam" ? 6.2 : 4.9) * shaft.speedMultiplier;
    const cycle = part.kind === "fog" ? 2.7 : part.kind === "beam" ? 3.15 : 3.65;
    const phase = (part.index % 7) * 0.43;
    const travel = (elapsed * speed + phase) % cycle;
    const yOffset = (part.kind === "fog" ? 0.55 : 1.95) - travel;
    part.object.position.y = part.baseY + yOffset;
    const alpha = part.kind === "fog" ? 0.22 * shaft.fogOpacity : part.kind === "beam" ? 0.46 * shaft.beamOpacity : 0.54 * shaft.streakOpacity;
    part.object.visible = alpha > 0.015;
    for (const material of part.materials) {
      material.transparent = true;
      material.opacity = Math.min(1, alpha);
      material.depthWrite = false;
      material.toneMapped = false;
      material.emissiveIntensity =
        part.kind === "fog"
          ? 0.18 + shaft.reveal * 0.34
          : part.kind === "beam"
            ? 0.22 + shaft.ascent * 0.62
            : 0.34 + shaft.ascent * 0.78 + Math.sin(clockElapsed * 7 + part.index) * 0.06;
    }
  }
}

function prepareServiceElevatorShaftParts(object: Object3D): RuntimeShaftPart[] {
  const parts: RuntimeShaftPart[] = [];
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((material) => material.clone());
      else if (mesh.material) mesh.material = mesh.material.clone();
    }
    const kind = serviceElevatorShaftPartKind(child.name);
    if (!kind) return;
    child.visible = false;
    parts.push({
      object: child,
      baseY: child.position.y,
      kind,
      index: parts.length,
      materials: buttonStandardMaterials(mesh),
    });
  });
  return parts;
}

function serviceElevatorShaftPartKind(name: string): RuntimeShaftPart["kind"] | null {
  if (!/service_elevator_ascent_shaft_/i.test(name)) return null;
  if (/_fog_/i.test(name)) return "fog";
  if (/crossbeam|marker|diodes|scan_band|louver/i.test(name)) return "beam";
  if (/_moving_/i.test(name)) return "column";
  return "static";
}

function ExitCinematicElevatorFx({ world }: { world: GameWorld }) {
  const groupRef = useRef<Group>(null);
  const stripRefs = useRef<Mesh[]>([]);
  const beamRefs = useRef<Mesh[]>([]);
  const paneRefs = useRef<Mesh[]>([]);
  const cyanLightRef = useRef<PointLight>(null);
  const amberLightRef = useRef<PointLight>(null);
  const liftCoreRef = useRef<PointLight>(null);
  const stripSpecs = useMemo(
    () => [
      { x: -2.74, z: -1.98, color: "#3f9fa8", speed: 5.2, delay: 0, width: 0.036, height: 1.45 },
      { x: 2.74, z: -1.84, color: "#3f9fa8", speed: 5.8, delay: 0.36, width: 0.036, height: 1.52 },
      { x: -2.46, z: 1.76, color: "#9a7445", speed: 4.4, delay: 0.72, width: 0.026, height: 1.0 },
      { x: 2.56, z: 1.96, color: "#3f9fa8", speed: 5.5, delay: 1.1, width: 0.034, height: 1.44 },
      { x: -1.68, z: -2.24, color: "#3f9fa8", speed: 6.2, delay: 1.42, width: 0.03, height: 1.56 },
      { x: 1.62, z: -2.24, color: "#9a7445", speed: 4.8, delay: 1.86, width: 0.022, height: 0.9 },
      { x: -2.18, z: 0.06, color: "#3f9fa8", speed: 6.6, delay: 2.18, width: 0.026, height: 1.1 },
      { x: 2.18, z: 0.12, color: "#3f9fa8", speed: 6.0, delay: 2.56, width: 0.026, height: 1.16 },
    ],
    [],
  );
  const beamSpecs = useMemo(
    () => [
      { z: -2.16, speed: 4.8, delay: 0.1, color: "#1b2a32", alpha: 0.28 },
      { z: 1.92, speed: 5.4, delay: 0.78, color: "#1b2a32", alpha: 0.24 },
      { z: -1.55, speed: 6.1, delay: 1.42, color: "#3f9fa8", alpha: 0.08 },
      { z: 1.44, speed: 5.7, delay: 2.04, color: "#9a7445", alpha: 0.045 },
      { z: 0.08, speed: 6.4, delay: 2.68, color: "#1b2a32", alpha: 0.22 },
    ],
    [],
  );
  const paneSpecs = useMemo(
    () => [
      { x: -2.36, z: -0.72, rot: 0.18, color: "#34585e", alpha: 0.032 },
      { x: 2.36, z: -0.54, rot: -0.18, color: "#34585e", alpha: 0.03 },
      { x: -1.12, z: 2.04, rot: 0, color: "#6c5638", alpha: 0.014 },
      { x: 1.08, z: 2.08, rot: 0, color: "#34585e", alpha: 0.02 },
    ],
    [],
  );
  useFrame(({ clock }) => {
    const group = groupRef.current;
    const cinematic = world.session.activeExitCinematic;
    const active = isExitCinematicViewActive(world) && cinematic;
    const shaft = active ? exitElevatorShaftVisualState(cinematic) : exitElevatorShaftVisualState(null);
    const button = active ? exitElevatorButtonVisualState(cinematic) : exitElevatorButtonVisualState(null);
    const visibility = Math.max(shaft.ascent, shaft.reveal, button.panelConfirm * 0.62);
    if (!group) return;
    group.visible = visibility > 0.015;
    if (!cinematic || visibility <= 0.015) return;
    group.position.set(cinematic.enterPosition[0], 0, cinematic.enterPosition[2]);
    group.rotation.y = cinematic.faceYaw;
    const elapsed = Math.max(0, cinematic.elapsed - cinematic.ascentStartTime);
    stripRefs.current.forEach((mesh, index) => {
      const spec = stripSpecs[index];
      if (!mesh || !spec) return;
      const travel = (elapsed * spec.speed * shaft.speedMultiplier + spec.delay) % 4.6;
      mesh.position.y = 3.35 - travel;
      mesh.scale.y = 0.86 + shaft.ascent * 0.52 + Math.sin(clock.elapsedTime * 8 + index) * 0.08;
      const material = mesh.material;
      if (material instanceof MeshStandardMaterial) {
        material.opacity = 0.018 * shaft.streakOpacity;
        material.emissiveIntensity = 0.1 + shaft.reveal * 0.3 + shaft.ascent * 0.12;
      }
    });
    beamRefs.current.forEach((mesh, index) => {
      const spec = beamSpecs[index];
      if (!mesh || !spec) return;
      const travel = (elapsed * spec.speed * shaft.speedMultiplier + spec.delay) % 5.1;
      mesh.position.y = 3.72 - travel;
      const material = mesh.material;
      if (material instanceof MeshStandardMaterial) {
        material.opacity = spec.alpha * 0.24 * shaft.beamOpacity;
        material.emissiveIntensity = spec.color === "#1b2a32" ? 0.025 : 0.24 + shaft.reveal * 0.45;
      }
    });
    paneRefs.current.forEach((mesh, index) => {
      const spec = paneSpecs[index];
      if (!mesh || !spec) return;
      mesh.position.y = 1.55 + Math.sin(clock.elapsedTime * 0.7 + index) * 0.025;
      const material = mesh.material;
      if (material instanceof MeshStandardMaterial) {
        material.opacity = spec.alpha * 0.32 * shaft.glassOpacity;
        material.emissiveIntensity = 0.035 + shaft.reveal * 0.1;
      }
    });
    if (cyanLightRef.current) cyanLightRef.current.intensity = 0.04 + button.panelConfirm * 0.26 + shaft.reveal * 0.5;
    if (amberLightRef.current) amberLightRef.current.intensity = 0.035 + button.latch * 0.28 + shaft.ascent * 0.2;
    if (liftCoreRef.current) liftCoreRef.current.intensity = 0.06 + shaft.ascent * 0.78 + shaft.whiteOut * 1.6;
  });

  return (
    <group ref={groupRef} visible={false}>
      {stripSpecs.map((spec, index) => (
        <mesh
          key={`${spec.x}:${spec.z}:${index}`}
          ref={(mesh) => {
            if (mesh) stripRefs.current[index] = mesh;
          }}
          position={[spec.x, 1.5, spec.z]}
        >
          <boxGeometry args={[spec.width, spec.height, 0.045]} />
          <meshStandardMaterial
            color={spec.color}
            emissive={spec.color}
            emissiveIntensity={0.9}
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
      {beamSpecs.map((spec, index) => (
        <mesh
          key={`beam:${spec.z}:${index}`}
          ref={(mesh) => {
            if (mesh) beamRefs.current[index] = mesh;
          }}
          position={[0, 2.2, spec.z]}
        >
          <boxGeometry args={[4.9, 0.052, 0.075]} />
          <meshStandardMaterial
            color={spec.color}
            emissive={spec.color}
            emissiveIntensity={0.2}
            transparent
            opacity={0.12}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
      {paneSpecs.map((spec, index) => (
        <mesh
          key={`pane:${spec.x}:${spec.z}:${index}`}
          ref={(mesh) => {
            if (mesh) paneRefs.current[index] = mesh;
          }}
          position={[spec.x, 1.55, spec.z]}
          rotation={[0, spec.rot, 0]}
        >
          <planeGeometry args={[0.86, 2.65]} />
          <meshStandardMaterial
            color={spec.color}
            emissive={spec.color}
            emissiveIntensity={0.14}
            transparent
            opacity={0.08}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      <pointLight ref={cyanLightRef} position={[0, 2.25, -1.82]} color="#7ff2ff" intensity={0.18} distance={6.2} decay={1.6} />
      <pointLight ref={amberLightRef} position={[1.15, 1.34, 1.42]} color="#f0b15b" intensity={0.08} distance={4.8} decay={1.7} />
      <pointLight ref={liftCoreRef} position={[0, 2.85, 0.24]} color="#d9feff" intensity={0.1} distance={5.6} decay={1.5} />
    </group>
  );
}

function RoomFloor({ room, world }: { room: LevelRoomDefinition; world: GameWorld }) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const active = world.session.mapProgress.currentRoomId === room.id;
  const material = resolveRoomFloorMaterial(room);
  const accent = room.geometry?.accentColor ?? material.accent;
  return (
    <group>
      <mesh position={[cx, 0.031, cz]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx, sz, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={activeColor(material, active)}
          emissive={activeEmissive(material, active, accent)}
          emissiveIntensity={active ? 0.22 : 0.08}
          metalness={material.metalness}
          roughness={material.roughness}
          transparent
          opacity={material.opacity ?? 0.72}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[cx, 0.052, cz]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx * 0.88, 0.08, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={active ? material.glowOpacity ?? 0.42 : 0.18}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function EnvironmentStateLayer({ state, world }: { state: LevelEnvironmentStateDefinition; world: GameWorld }) {
  const map = world.level.map;
  if (!map) return null;
  const presentation = resolveRoomPresentation(map);
  const rooms = state.roomId
    ? map.rooms.filter((room) => room.id === state.roomId && isRoomRenderVisible(world, room.id))
    : map.rooms.filter((room) => (room.geometry?.renderFloor || room.geometry?.renderWalls) && isRoomRenderVisible(world, room.id));
  const tintColor = state.tintColor ?? "#7ff2ff";
  const glowColor = state.glowColor ?? tintColor;
  const intensity = Math.max(0.15, Math.min(1.6, state.intensity ?? 0.7));
  const opacity = Math.max(0.02, Math.min(0.42, state.opacity ?? 0.16));
  const configuredArtScale = presentation?.roomKit ? 0.32 : 1;
  const statePlaneOpacity = opacity * configuredArtScale;
  const stateStripOpacity = opacity * (presentation?.roomKit ? 0.74 : 1);
  const stateLightIntensity = (presentation?.roomKit ? 0.07 : 0.28) * intensity;

  return (
    <group>
      {rooms.map((room) => {
        const [cx, , cz] = room.bounds.center;
        const [sx, sy, sz] = room.bounds.size;
        return (
          <group key={`${state.id}:${room.id}`}>
            <mesh position={[cx, 0.082, cz]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx * 0.92, sz * 0.92, 1]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                color={tintColor}
                transparent
                opacity={statePlaneOpacity}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <AestheticGlowStrip
              position={[cx, Math.min(sy * 0.68, 2.65), cz - sz * 0.47]}
              scale={[sx * 0.64, 0.035, 0.04]}
              color={glowColor}
              opacity={stateStripOpacity * 1.5 * intensity}
            />
            <AestheticGlowStrip
              position={[cx, Math.min(sy * 0.68, 2.65), cz + sz * 0.47]}
              scale={[sx * 0.64, 0.035, 0.04]}
              color={glowColor}
              opacity={stateStripOpacity * intensity}
            />
            <pointLight position={[cx, 2.2, cz]} color={glowColor} intensity={stateLightIntensity} distance={Math.max(sx, sz) * 0.52} />
          </group>
        );
      })}
    </group>
  );
}

function RoomAestheticLayer({
  room,
  world,
  artTextures,
  suppressGeneratedModelProps,
}: {
  room: LevelRoomDefinition;
  world: GameWorld;
  artTextures: First90Textures;
  suppressGeneratedModelProps: boolean;
}) {
  const aesthetic = resolveRoomAesthetic(room);
  if (!aesthetic || (!room.geometry?.renderFloor && !room.geometry?.renderWalls)) return null;

  const [cx, , cz] = room.bounds.center;
  const [sx, sy, sz] = room.bounds.size;
  const active = world.session.mapProgress.currentRoomId === room.id;
  const opacityBoost = active ? 1.25 : 1;
  const showTrim = room.aesthetic?.trim !== false;
  const showFloorLines = room.aesthetic?.floorLines !== false;
  const showWallPanels = room.aesthetic?.wallPanels !== false;
  const showCeilingLights = room.aesthetic?.ceilingLights !== false;
  const detailScale = aesthetic.detail === "high" ? 1 : aesthetic.detail === "medium" ? 0.78 : 0.52;

  return (
    <group>
      {showTrim ? (
        <group>
          <AestheticGlowStrip
            position={[cx, 0.075, cz - sz * 0.43]}
            scale={[sx * 0.74, 0.026, 0.035]}
            color={aesthetic.accent}
            opacity={(0.17 + aesthetic.glowOpacity * 0.28) * opacityBoost}
          />
          <AestheticGlowStrip
            position={[cx, 0.075, cz + sz * 0.43]}
            scale={[sx * 0.74, 0.026, 0.035]}
            color={aesthetic.accent}
            opacity={(0.14 + aesthetic.glowOpacity * 0.22) * opacityBoost}
          />
          <AestheticGlowStrip
            position={[cx - sx * 0.43, 0.075, cz]}
            scale={[0.035, 0.026, sz * 0.72]}
            color={aesthetic.secondaryAccent}
            opacity={(0.1 + aesthetic.glowOpacity * 0.18) * opacityBoost}
          />
          <AestheticGlowStrip
            position={[cx + sx * 0.43, 0.075, cz]}
            scale={[0.035, 0.026, sz * 0.72]}
            color={aesthetic.secondaryAccent}
            opacity={(0.1 + aesthetic.glowOpacity * 0.18) * opacityBoost}
          />
        </group>
      ) : null}

      {showFloorLines ? (
        <group>
          <RoomFloorLines
            cx={cx}
            cz={cz}
            sx={sx}
            sz={sz}
            color={aesthetic.style === "residential" ? aesthetic.trimColor : aesthetic.panelColor}
            accent={aesthetic.accent}
            detailScale={detailScale}
          />
          {aesthetic.detail !== "low" ? (
            <RoomFloorPlates
              cx={cx}
              cz={cz}
              sx={sx}
              sz={sz}
              style={aesthetic.style}
              color={aesthetic.darkColor}
              trimColor={aesthetic.trimColor}
              accent={aesthetic.accent}
              detailScale={detailScale}
            />
          ) : null}
        </group>
      ) : null}

      {showWallPanels ? (
        <group>
          <RoomWallDressing
            cx={cx}
            cz={cz}
            sx={sx}
            sy={sy}
            sz={sz}
            active={active}
            style={aesthetic.style}
            panelColor={aesthetic.panelColor}
            trimColor={aesthetic.trimColor}
            accent={aesthetic.accent}
            secondaryAccent={aesthetic.secondaryAccent}
            detailScale={detailScale}
          />
          {aesthetic.detail !== "low" ? (
            <RoomWallPanelRhythm
              cx={cx}
              cz={cz}
              sx={sx}
              sy={sy}
              sz={sz}
              style={aesthetic.style}
              color={aesthetic.trimColor}
              accent={aesthetic.accent}
              secondaryAccent={aesthetic.secondaryAccent}
              detailScale={detailScale}
            />
          ) : null}
        </group>
      ) : null}

      {showCeilingLights ? (
        <RoomCeilingLights
          cx={cx}
          cz={cz}
          sx={sx}
          sy={sy}
          sz={sz}
          color={aesthetic.style === "residential" ? aesthetic.accent : aesthetic.secondaryAccent}
          opacity={(0.22 + aesthetic.glowOpacity * 0.36) * opacityBoost}
          detailScale={detailScale}
        />
      ) : null}
      {showWallPanels && aesthetic.detail !== "low" ? (
        <RoomCeilingBeams
          cx={cx}
          cz={cz}
          sx={sx}
          sy={sy}
          sz={sz}
          color={aesthetic.trimColor}
          accent={aesthetic.style === "residential" ? aesthetic.accent : aesthetic.secondaryAccent}
          detailScale={detailScale}
        />
      ) : null}
      {aesthetic.detail !== "low" ? (
        <RoomSignatureDressing
          cx={cx}
          cz={cz}
          sx={sx}
          sy={sy}
          sz={sz}
          style={aesthetic.style}
          color={aesthetic.panelColor}
          trimColor={aesthetic.trimColor}
          accent={aesthetic.accent}
          secondaryAccent={aesthetic.secondaryAccent}
          detailScale={detailScale}
        />
      ) : null}
      {showWallPanels && aesthetic.detail !== "low" ? (
        <RoomWallSceneDressing
          cx={cx}
          cz={cz}
          sx={sx}
          sy={sy}
          sz={sz}
          style={aesthetic.style}
          color={aesthetic.darkColor}
          trimColor={aesthetic.trimColor}
          accent={aesthetic.accent}
          secondaryAccent={aesthetic.secondaryAccent}
          detailScale={detailScale}
        />
      ) : null}
      {aesthetic.detail !== "low" ? (
        <RoomTextureDressing
          cx={cx}
          cz={cz}
          sx={sx}
          sy={sy}
          sz={sz}
          style={aesthetic.style}
          active={active}
          artTextures={artTextures}
          detailScale={detailScale}
        />
      ) : null}
      {aesthetic.detail !== "low" && !suppressGeneratedModelProps ? (
        <RoomModelPropDressing
          cx={cx}
          cz={cz}
          sx={sx}
          sy={sy}
          sz={sz}
          style={aesthetic.style}
          detailScale={detailScale}
          active={active}
          skinKey={room.skinKey}
          mood={room.mood}
        />
      ) : null}
      {aesthetic.detail !== "low" ? (
        <RoomEmergencyLightRig
          cx={cx}
          cz={cz}
          sx={sx}
          sy={sy}
          sz={sz}
          style={aesthetic.style}
          accent={aesthetic.accent}
          secondaryAccent={aesthetic.secondaryAccent}
          detailScale={detailScale}
          active={active}
          skinKey={room.skinKey}
          mood={room.mood}
        />
      ) : null}
    </group>
  );
}

function RoomFloorLines({
  cx,
  cz,
  sx,
  sz,
  color,
  accent,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sz: number;
  color: string;
  accent: string;
  detailScale: number;
}) {
  const crossCount = sx > 12 ? 2 : 1;
  const zLines = Array.from({ length: crossCount }, (_, index) => (index + 1) / (crossCount + 1) - 0.5);
  const xLines = sz > 9 ? [-0.24, 0.24] : [0];
  return (
    <group>
      {zLines.map((offset) => (
        <mesh key={`z:${offset}`} position={[cx, 0.066, cz + sz * offset]} scale={[sx * 0.74, 0.018, 0.022]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.08 * detailScale} metalness={0.42} roughness={0.54} />
        </mesh>
      ))}
      {xLines.map((offset) => (
        <mesh key={`x:${offset}`} position={[cx + sx * offset, 0.068, cz]} scale={[0.022, 0.018, sz * 0.62]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.06 * detailScale} metalness={0.42} roughness={0.54} />
        </mesh>
      ))}
      <mesh position={[cx, 0.071, cz]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx * 0.32, sz * 0.22, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.035 * detailScale} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RoomFloorPlates({
  cx,
  cz,
  sx,
  sz,
  style,
  color,
  trimColor,
  accent,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sz: number;
  style: RoomAestheticStyleKey;
  color: string;
  trimColor: string;
  accent: string;
  detailScale: number;
}) {
  const plateColor = style === "residential" ? trimColor : color;
  const panelOpacity = style === "residential" ? 0.15 : 0.22;
  const zOffsets = sz > 8 ? [-0.28, 0.06, 0.34] : [-0.18, 0.22];
  const guideColor = style === "exit" ? "#ffffff" : accent;

  return (
    <group>
      {zOffsets.map((offset, index) => (
        <mesh key={`plate:${offset}`} position={[cx + sx * (index % 2 === 0 ? -0.18 : 0.18), 0.063, cz + sz * offset]} scale={[sx * 0.24, 0.014, sz * 0.12]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={plateColor}
            emissive={accent}
            emissiveIntensity={0.04 * detailScale}
            metalness={0.58}
            roughness={0.46}
            transparent
            opacity={panelOpacity}
          />
        </mesh>
      ))}
      <AestheticGlowStrip
        position={[cx, 0.083, cz - sz * 0.12]}
        scale={[sx * 0.08, 0.022, sz * 0.42]}
        color={guideColor}
        opacity={(style === "exit" ? 0.22 : 0.1) * detailScale}
      />
    </group>
  );
}

function RoomWallPanelRhythm({
  cx,
  cz,
  sx,
  sy,
  sz,
  style,
  color,
  accent,
  secondaryAccent,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  style: RoomAestheticStyleKey;
  color: string;
  accent: string;
  secondaryAccent: string;
  detailScale: number;
}) {
  const y = Math.min(sy * 0.44, 1.72);
  const ribY = Math.min(sy * 0.52, 2.05);
  const frontZ = cz - sz / 2 + 0.24;
  const backZ = cz + sz / 2 - 0.24;
  const leftX = cx - sx / 2 + 0.24;
  const rightX = cx + sx / 2 - 0.24;
  const ribColor = style === "hazard" || style === "exit" ? secondaryAccent : accent;
  const xOffsets = detailScale > 0.9 ? [-0.36, -0.18, 0.18, 0.36] : [-0.28, 0.28];
  const zOffsets = detailScale > 0.9 ? [-0.28, 0, 0.28] : [-0.22, 0.22];

  return (
    <group>
      {xOffsets.map((offset) => (
        <mesh key={`front-rib:${offset}`} position={[cx + sx * offset, ribY, frontZ]} scale={[0.045, y * 0.72, 0.035]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={ribColor} emissiveIntensity={0.08 * detailScale} metalness={0.64} roughness={0.42} />
        </mesh>
      ))}
      {xOffsets.map((offset) => (
        <mesh key={`back-rib:${offset}`} position={[cx + sx * offset, ribY, backZ]} scale={[0.045, y * 0.58, 0.035]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={secondaryAccent} emissiveIntensity={0.065 * detailScale} metalness={0.64} roughness={0.42} />
        </mesh>
      ))}
      {zOffsets.map((offset) => (
        <mesh key={`left-rib:${offset}`} position={[leftX, ribY, cz + sz * offset]} scale={[0.035, y * 0.56, 0.045]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.06 * detailScale} metalness={0.64} roughness={0.42} />
        </mesh>
      ))}
      {zOffsets.map((offset) => (
        <mesh key={`right-rib:${offset}`} position={[rightX, ribY, cz + sz * offset]} scale={[0.035, y * 0.56, 0.045]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={secondaryAccent} emissiveIntensity={0.06 * detailScale} metalness={0.64} roughness={0.42} />
        </mesh>
      ))}
    </group>
  );
}

function RoomWallDressing({
  cx,
  cz,
  sx,
  sy,
  sz,
  active,
  style,
  panelColor,
  trimColor,
  accent,
  secondaryAccent,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  active: boolean;
  style: RoomAestheticStyleKey;
  panelColor: string;
  trimColor: string;
  accent: string;
  secondaryAccent: string;
  detailScale: number;
}) {
  const wallY = Math.min(sy * 0.44, 1.75);
  const capY = Math.min(sy * 0.72, 2.9);
  const postY = Math.min(sy * 0.45, 1.8);
  const frontZ = cz - sz / 2 + 0.22;
  const backZ = cz + sz / 2 - 0.22;
  const leftX = cx - sx / 2 + 0.22;
  const rightX = cx + sx / 2 - 0.22;
  const panelGlow = active ? 0.16 : 0.08;
  const barColor = style === "hazard" || style === "exit" ? secondaryAccent : accent;
  const warmResidential = style === "residential";

  return (
    <group>
      {[
        [leftX, postY, frontZ],
        [rightX, postY, frontZ],
        [leftX, postY, backZ],
        [rightX, postY, backZ],
      ].map((position, index) => (
        <mesh key={`post:${index}`} position={position as [number, number, number]} scale={[0.12, postY * 1.4, 0.12]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={trimColor} emissive={barColor} emissiveIntensity={0.08 * detailScale} metalness={0.62} roughness={0.42} />
        </mesh>
      ))}

      {style === "museum" ? (
        <>
          {[-0.3, 0.3].map((offset) => (
            <mesh key={`museum-front-label:${offset}`} position={[cx + sx * offset, wallY, frontZ]} scale={[sx * 0.2, 0.32, 0.032]} receiveShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={panelColor} emissive={accent} emissiveIntensity={0.055 * detailScale} metalness={0.42} roughness={0.5} />
            </mesh>
          ))}
          <AestheticGlowStrip position={[cx, capY, frontZ + 0.02]} scale={[sx * 0.58, 0.028, 0.035]} color={accent} opacity={0.18 * detailScale} />
          <AestheticGlowStrip position={[cx, capY, backZ - 0.02]} scale={[sx * 0.5, 0.024, 0.035]} color={secondaryAccent} opacity={0.13 * detailScale} />
        </>
      ) : warmResidential ? (
        <>
          {[-0.31, 0.31].map((offset) => (
            <mesh key={`front-panel:${offset}`} position={[cx + sx * offset, wallY, frontZ]} scale={[sx * 0.22, 0.38, 0.035]} receiveShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={panelColor} emissive={accent} emissiveIntensity={panelGlow * 0.72 * detailScale} metalness={0.46} roughness={0.5} transparent opacity={0.72} />
            </mesh>
          ))}
          {[-0.29, 0.29].map((offset) => (
            <mesh key={`back-panel:${offset}`} position={[cx + sx * offset, wallY, backZ]} scale={[sx * 0.2, 0.32, 0.035]} receiveShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={panelColor} emissive={secondaryAccent} emissiveIntensity={panelGlow * 0.48 * detailScale} metalness={0.46} roughness={0.5} transparent opacity={0.66} />
            </mesh>
          ))}
          {[-0.31, 0.31].map((offset) => (
            <AestheticGlowStrip
              key={`front-cap:${offset}`}
              position={[cx + sx * offset, capY, frontZ + 0.006]}
              scale={[sx * 0.18, 0.032, 0.035]}
              color={barColor}
              opacity={(active ? 0.26 : 0.16) * detailScale}
            />
          ))}
          {[-0.29, 0.29].map((offset) => (
            <AestheticGlowStrip
              key={`back-cap:${offset}`}
              position={[cx + sx * offset, capY, backZ - 0.006]}
              scale={[sx * 0.16, 0.03, 0.035]}
              color={accent}
              opacity={(active ? 0.22 : 0.12) * detailScale}
            />
          ))}
        </>
      ) : (
        <>
          <mesh position={[cx, wallY, frontZ]} scale={[sx * 0.68, 0.42, 0.035]} receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={panelColor} emissive={accent} emissiveIntensity={panelGlow * detailScale} metalness={0.46} roughness={0.5} transparent opacity={0.88} />
          </mesh>
          <mesh position={[cx, wallY, backZ]} scale={[sx * 0.58, 0.34, 0.035]} receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={panelColor} emissive={secondaryAccent} emissiveIntensity={panelGlow * 0.72 * detailScale} metalness={0.46} roughness={0.5} transparent opacity={0.82} />
          </mesh>
          <AestheticGlowStrip
            position={[cx, capY, frontZ + 0.006]}
            scale={[sx * 0.52, 0.036, 0.035]}
            color={barColor}
            opacity={(active ? 0.42 : 0.24) * detailScale}
          />
          <AestheticGlowStrip
            position={[cx, capY, backZ - 0.006]}
            scale={[sx * 0.42, 0.032, 0.035]}
            color={secondaryAccent}
            opacity={(active ? 0.32 : 0.18) * detailScale}
          />
        </>
      )}

      <mesh position={[leftX, wallY, cz]} scale={[0.035, 0.32, sz * 0.5]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={trimColor} emissive={accent} emissiveIntensity={0.12 * detailScale} metalness={0.56} roughness={0.46} />
      </mesh>
      <mesh position={[rightX, wallY, cz]} scale={[0.035, 0.32, sz * 0.5]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={trimColor} emissive={secondaryAccent} emissiveIntensity={0.1 * detailScale} metalness={0.56} roughness={0.46} />
      </mesh>

      {warmResidential ? (
        <ResidentialWallSlats cx={cx} cz={cz} sx={sx} sz={sz} y={Math.min(sy * 0.34, 1.38)} color="#665840" accent={accent} />
      ) : null}
      {style === "hazard" || style === "exit" ? (
        <HazardWallTicks cx={cx} cz={cz} sx={sx} sz={sz} y={Math.min(sy * 0.36, 1.46)} color={secondaryAccent} />
      ) : null}
    </group>
  );
}

function ResidentialWallSlats({
  cx,
  cz,
  sx,
  sz,
  y,
  color,
  accent,
}: {
  cx: number;
  cz: number;
  sx: number;
  sz: number;
  y: number;
  color: string;
  accent: string;
}) {
  const frontZ = cz - sz / 2 + 0.235;
  return (
    <group>
      {[-0.28, -0.12, 0.12, 0.28].map((offset) => (
        <mesh key={offset} position={[cx + sx * offset, y, frontZ]} scale={[sx * 0.1, 0.055, 0.038]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.1} metalness={0.24} roughness={0.62} />
        </mesh>
      ))}
    </group>
  );
}

function HazardWallTicks({ cx, cz, sx, sz, y, color }: { cx: number; cz: number; sx: number; sz: number; y: number; color: string }) {
  const backZ = cz + sz / 2 - 0.235;
  return (
    <group>
      {[-0.34, -0.18, 0, 0.18, 0.34].map((offset) => (
        <AestheticGlowStrip
          key={offset}
          position={[cx + sx * offset, y, backZ]}
          scale={[sx * 0.07, 0.05, 0.042]}
          color={color}
          opacity={0.34}
        />
      ))}
    </group>
  );
}

function RoomCeilingLights({
  cx,
  cz,
  sx,
  sy,
  sz,
  color,
  opacity,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  opacity: number;
  detailScale: number;
}) {
  const y = Math.max(2.35, sy - 0.32);
  const zOffsets = sz > 9 ? [-0.22, 0.22] : [0];
  return (
    <group>
      {zOffsets.map((offset) => (
        <AestheticGlowStrip
          key={offset}
          position={[cx, y, cz + sz * offset]}
          scale={[sx * 0.5, 0.035, 0.065]}
          color={color}
          opacity={opacity * detailScale}
        />
      ))}
    </group>
  );
}

function RoomCeilingBeams({
  cx,
  cz,
  sx,
  sy,
  sz,
  color,
  accent,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  accent: string;
  detailScale: number;
}) {
  const y = Math.max(2.2, sy - 0.42);
  const zBeamOffsets = sz > 9 ? [-0.32, 0, 0.32] : [-0.24, 0.24];
  return (
    <group>
      {zBeamOffsets.map((offset) => (
        <mesh key={`ceiling-z:${offset}`} position={[cx, y, cz + sz * offset]} scale={[sx * 0.92, 0.08, 0.09]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.06 * detailScale} metalness={0.72} roughness={0.38} />
        </mesh>
      ))}
      <mesh position={[cx - sx * 0.34, y - 0.02, cz]} scale={[0.08, 0.08, sz * 0.82]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.045 * detailScale} metalness={0.72} roughness={0.38} />
      </mesh>
      <mesh position={[cx + sx * 0.34, y - 0.02, cz]} scale={[0.08, 0.08, sz * 0.82]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.045 * detailScale} metalness={0.72} roughness={0.38} />
      </mesh>
    </group>
  );
}

function RoomSignatureDressing({
  cx,
  cz,
  sx,
  sy,
  sz,
  style,
  color,
  trimColor,
  accent,
  secondaryAccent,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  style: RoomAestheticStyleKey;
  color: string;
  trimColor: string;
  accent: string;
  secondaryAccent: string;
  detailScale: number;
}) {
  const frontZ = cz - sz / 2 + 0.24;
  if (style === "residential") {
    return (
      <group>
        <mesh position={[cx - sx * 0.28, 0.105, cz + sz * 0.18]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx * 0.26, sz * 0.16, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={accent} transparent opacity={0.055 * detailScale} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[cx - sx * 0.32, 0.36, cz + sz * 0.22]} scale={[sx * 0.18, 0.28, sz * 0.08]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.09 * detailScale} metalness={0.34} roughness={0.6} />
        </mesh>
        <mesh position={[cx - sx * 0.2, 0.55, cz + sz * 0.22]} scale={[sx * 0.045, 0.5, sz * 0.08]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={trimColor} emissive={accent} emissiveIntensity={0.07 * detailScale} metalness={0.28} roughness={0.58} />
        </mesh>
        <mesh position={[cx + sx * 0.34, Math.min(sy * 0.42, 1.6), frontZ]} scale={[sx * 0.12, 0.18, 0.04]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={trimColor} emissive={secondaryAccent} emissiveIntensity={0.14 * detailScale} metalness={0.42} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  if (style === "sterile") {
    return (
      <group>
        <mesh position={[cx + sx * 0.28, 0.46, cz + sz * 0.18]} scale={[sx * 0.16, 0.24, sz * 0.08]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.12 * detailScale} metalness={0.58} roughness={0.38} />
        </mesh>
        <AestheticGlowStrip position={[cx + sx * 0.28, 0.62, cz + sz * 0.235]} scale={[sx * 0.12, 0.03, 0.03]} color={accent} opacity={0.34 * detailScale} />
        <mesh position={[cx - sx * 0.34, Math.min(sy * 0.5, 1.9), frontZ]} scale={[sx * 0.14, 0.22, 0.04]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={trimColor} emissive={secondaryAccent} emissiveIntensity={0.16 * detailScale} metalness={0.5} roughness={0.42} />
        </mesh>
      </group>
    );
  }

  if (style === "hazard" || style === "exit") {
    return (
      <group>
        <mesh position={[cx, 0.16, cz + sz * 0.3]} scale={[sx * 0.22, 0.18, sz * 0.13]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={trimColor} emissive={accent} emissiveIntensity={0.1 * detailScale} metalness={0.66} roughness={0.38} />
        </mesh>
        <AestheticGlowStrip position={[cx, 0.28, cz + sz * 0.3]} scale={[sx * 0.16, 0.035, 0.04]} color={style === "exit" ? secondaryAccent : accent} opacity={0.42 * detailScale} />
        <mesh position={[cx + sx * 0.36, 0.68, cz - sz * 0.32]} scale={[0.16, 0.72, 0.16]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={secondaryAccent} emissiveIntensity={0.14 * detailScale} metalness={0.74} roughness={0.36} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[cx - sx * 0.34, 0.42, cz + sz * 0.28]} scale={[sx * 0.13, 0.32, sz * 0.1]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.1 * detailScale} metalness={0.62} roughness={0.42} />
      </mesh>
      <AestheticGlowStrip position={[cx - sx * 0.34, 0.63, cz + sz * 0.335]} scale={[sx * 0.09, 0.03, 0.03]} color={accent} opacity={0.32 * detailScale} />
    </group>
  );
}

function RoomWallSceneDressing({
  cx,
  cz,
  sx,
  sy,
  sz,
  style,
  color,
  trimColor,
  accent,
  secondaryAccent,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  style: RoomAestheticStyleKey;
  color: string;
  trimColor: string;
  accent: string;
  secondaryAccent: string;
  detailScale: number;
}) {
  const wallY = Math.min(sy * 0.42, 1.68);
  const paneY = Math.min(sy * 0.5, 2);
  const frontZ = cz - sz / 2 + 0.245;
  const paneColor = style === "residential" ? "#d6b678" : style === "hazard" || style === "exit" ? secondaryAccent : accent;
  const paneOpacity = style === "residential" ? 0.58 : 0.62;

  if (style === "museum") {
    return (
      <group>
        {[-0.32, 0, 0.32].map((offset, index) => (
          <mesh key={`museum-display-wall:${index}`} position={[cx + sx * offset, paneY, frontZ]} scale={[sx * 0.12, 0.5, 0.026]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} emissive={paneColor} emissiveIntensity={0.09 * detailScale} metalness={0.38} roughness={0.48} transparent opacity={paneOpacity} />
          </mesh>
        ))}
        <mesh position={[cx - sx * 0.38, wallY, cz + sz * 0.22]} scale={[sx * 0.06, 0.72, sz * 0.08]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={trimColor} emissive={accent} emissiveIntensity={0.055 * detailScale} metalness={0.5} roughness={0.46} />
        </mesh>
        <AestheticGlowStrip position={[cx + sx * 0.26, Math.min(sy * 0.54, 2.1), frontZ]} scale={[sx * 0.12, 0.025, 0.03]} color={secondaryAccent} opacity={0.22 * detailScale} />
      </group>
    );
  }

  if (style === "residential") {
    return (
      <group>
        {[-0.24, 0.02, 0.28].map((offset) => (
          <mesh key={`home-frame:${offset}`} position={[cx + sx * offset, paneY, frontZ]} scale={[sx * 0.12, 0.46, 0.028]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} emissive={paneColor} emissiveIntensity={0.055 * detailScale} metalness={0.34} roughness={0.58} transparent opacity={paneOpacity} />
          </mesh>
        ))}
        <mesh position={[cx + sx * 0.32, 0.42, cz + sz * 0.34]} scale={[sx * 0.12, 0.34, sz * 0.07]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={trimColor} emissive={accent} emissiveIntensity={0.075 * detailScale} metalness={0.34} roughness={0.62} />
        </mesh>
      </group>
    );
  }

  if (style === "sterile") {
    return (
      <group>
        {[-0.22, 0.22].map((offset) => (
          <mesh key={`diagnostic-pane:${offset}`} position={[cx + sx * offset, paneY, frontZ]} scale={[sx * 0.18, 0.54, 0.03]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} emissive={paneColor} emissiveIntensity={0.08 * detailScale} metalness={0.58} roughness={0.4} transparent opacity={paneOpacity} />
          </mesh>
        ))}
        <mesh position={[cx - sx * 0.42, wallY, cz + sz * 0.22]} scale={[sx * 0.06, 0.84, sz * 0.08]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={secondaryAccent} emissiveIntensity={0.12 * detailScale} metalness={0.68} roughness={0.36} />
        </mesh>
      </group>
    );
  }

  if (style === "hazard" || style === "exit") {
    return (
      <group>
        {[-0.32, 0, 0.32].map((offset) => (
          <mesh key={`warning-pane:${offset}`} position={[cx + sx * offset, paneY, frontZ]} scale={[sx * 0.11, 0.38, 0.03]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} emissive={paneColor} emissiveIntensity={0.1 * detailScale} metalness={0.66} roughness={0.36} transparent opacity={0.68} />
          </mesh>
        ))}
        <mesh position={[cx - sx * 0.36, 0.42, cz - sz * 0.28]} scale={[0.18, 0.68, 0.18]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={secondaryAccent} emissiveIntensity={0.13 * detailScale} metalness={0.74} roughness={0.36} />
        </mesh>
        <mesh position={[cx + sx * 0.36, 0.42, cz - sz * 0.28]} scale={[0.18, 0.68, 0.18]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.1 * detailScale} metalness={0.74} roughness={0.36} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      {[-0.26, 0, 0.26].map((offset) => (
        <mesh key={`service-window:${offset}`} position={[cx + sx * offset, paneY, frontZ]} scale={[sx * 0.12, 0.5, 0.03]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={paneColor} emissiveIntensity={0.075 * detailScale} metalness={0.58} roughness={0.42} transparent opacity={paneOpacity} />
        </mesh>
      ))}
      <mesh position={[cx + sx * 0.38, wallY, cz + sz * 0.22]} scale={[sx * 0.055, 0.82, sz * 0.08]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.09 * detailScale} metalness={0.72} roughness={0.38} />
      </mesh>
    </group>
  );
}

function RoomTextureDressing({
  cx,
  cz,
  sx,
  sy,
  sz,
  style,
  active,
  artTextures,
  detailScale,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  style: RoomAestheticStyleKey;
  active: boolean;
  artTextures: First90Textures;
  detailScale: number;
}) {
  const frontZ = cz - sz / 2 + 0.255;
  const backZ = cz + sz / 2 - 0.255;
  const floorRegion =
    style === "residential"
      ? atlasRegions.surfaceResidential
      : style === "sterile"
        ? atlasRegions.surfaceSterile
        : style === "museum"
          ? atlasRegions.surfacePanelDark
          : style === "hazard" || style === "exit"
            ? atlasRegions.surfaceHazard
            : atlasRegions.surfaceWetFloor;
  const wallRegion =
    style === "residential"
      ? atlasRegions.backdropResidential
      : style === "sterile"
        ? atlasRegions.backdropSterile
        : style === "hazard"
          ? atlasRegions.backdropHazard
          : style === "exit"
            ? atlasRegions.backdropServiceDoor
            : style === "museum"
              ? atlasRegions.backdropSterile
              : sx > 11
                ? atlasRegions.backdropCorridor
                : atlasRegions.backdropLab;
  const lightRegion = style === "hazard" || style === "exit" ? atlasRegions.trimAmberLong : atlasRegions.trimCyanLong;
  const trimOpacity = (style === "residential" ? 0.24 : style === "museum" ? 0.2 : 0.38) * detailScale;
  const backdropOpacity = (style === "residential" ? 0.075 : style === "museum" ? 0.065 : 0.12) * detailScale;
  const floorTextureOpacity = (style === "residential" ? 0.16 : style === "museum" ? 0.055 : 0.22) * detailScale;
  const secondaryFloorOpacity = (style === "museum" ? 0.04 : 0.14) * detailScale;

  return (
    <group>
      <AtlasPlane
        texture={artTextures.floorWallSurfaceAtlas}
        region={floorRegion}
        position={[cx - sx * 0.16, 0.092, cz + sz * 0.12]}
        rotation={[-Math.PI / 2, 0, 0.08]}
        scale={[sx * 0.46, sz * 0.3, 1]}
        opacity={floorTextureOpacity}
      />
      <AtlasPlane
        texture={artTextures.floorWallSurfaceAtlas}
        region={style === "maintenance" || style === "museum" ? atlasRegions.surfacePanelDark : floorRegion}
        position={[cx + sx * 0.22, 0.094, cz - sz * 0.18]}
        rotation={[-Math.PI / 2, 0, -0.1]}
        scale={[sx * 0.28, sz * 0.2, 1]}
        opacity={secondaryFloorOpacity}
      />
      {active ? (
        <group>
          <AtlasPlane
            texture={artTextures.roomBackdrops}
            region={wallRegion}
            position={[cx - sx * 0.18, Math.min(sy * 0.5, 1.98), backZ - 0.012]}
            scale={[sx * 0.26, Math.min(sy * 0.34, 1.36), 1]}
            opacity={backdropOpacity}
          />
          <AtlasPlane
            texture={artTextures.roomBackdrops}
            region={wallRegion}
            position={[cx + sx * 0.2, Math.min(sy * 0.45, 1.8), backZ - 0.014]}
            scale={[sx * 0.22, Math.min(sy * 0.28, 1.12), 1]}
            opacity={backdropOpacity * 0.72}
          />
        </group>
      ) : null}
      <AtlasPlane
        texture={artTextures.environmentTrimSheet}
        region={lightRegion}
        position={[cx, Math.min(sy * 0.72, 2.88), frontZ + 0.018]}
        scale={[sx * 0.58, 0.11, 1]}
        opacity={trimOpacity}
        additive
      />
      <AtlasPlane
        texture={artTextures.environmentTrimSheet}
        region={style === "hazard" ? atlasRegions.trimHazardLong : atlasRegions.trimAmberLong}
        position={[cx, 0.62, backZ - 0.018]}
        scale={[sx * 0.36, 0.09, 1]}
        opacity={(style === "residential" ? 0.18 : 0.28) * detailScale}
        additive={style !== "residential"}
      />
      <AtlasPlane
        texture={artTextures.environmentTrimSheet}
        region={atlasRegions.trimVent}
        position={[cx + sx * 0.36, Math.min(sy * 0.42, 1.65), frontZ + 0.02]}
        scale={[sx * 0.12, 0.24, 1]}
        opacity={0.28 * detailScale}
      />
    </group>
  );
}

type RoomAestheticStyleKey = "maintenance" | "residential" | "sterile" | "hazard" | "exit" | "museum";

interface RoomModelProp {
  id: string;
  modelKey: EnvironmentModelKey;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  shadowScale?: [number, number, number];
  activeOnly?: boolean;
}

function RoomModelPropDressing({
  cx,
  cz,
  sx,
  sy,
  sz,
  style,
  detailScale,
  active,
  skinKey,
  mood,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  style: RoomAestheticStyleKey;
  detailScale: number;
  active: boolean;
  skinKey?: string;
  mood: LevelRoomDefinition["mood"];
}) {
  const isHeroMaintenanceBay = skinKey === "maintenance_bay_hero";
  const props = useMemo(
    () => createRoomModelProps({ cx, cz, sx, sy, sz, style, detailScale, isHeroMaintenanceBay, mood }),
    [cx, cz, detailScale, isHeroMaintenanceBay, mood, style, sx, sy, sz],
  );

  return (
    <group>
      {props.map((prop) => {
        if (prop.activeOnly && !active && !isHeroMaintenanceBay) return null;
        return (
          <group key={prop.id}>
            {prop.shadowScale ? (
              <EnvironmentModelInstance
                modelKey="prop_small_floor_shadow_disc"
                position={[prop.position[0], 0.036, prop.position[2]]}
                scale={prop.shadowScale}
                castShadow={false}
                receiveShadow={false}
              />
            ) : null}
            <EnvironmentModelInstance
              modelKey={prop.modelKey}
              position={prop.position}
              rotation={prop.rotation}
              scale={prop.scale ?? 1}
              castShadow={active || isHeroMaintenanceBay}
              receiveShadow
            />
          </group>
        );
      })}
    </group>
  );
}

function createRoomModelProps({
  cx,
  cz,
  sx,
  sy,
  sz,
  style,
  detailScale,
  isHeroMaintenanceBay,
  mood,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  style: RoomAestheticStyleKey;
  detailScale: number;
  isHeroMaintenanceBay: boolean;
  mood: LevelRoomDefinition["mood"];
}) {
  const props: RoomModelProp[] = [];
  const roomScale = Math.max(0.78, Math.min(1.12, Math.min(sx / 11, sz / 8.5)));
  const propScale = roomScale * (detailScale > 0.9 ? 1 : 0.92);
  const frontZ = cz - sz / 2 + 1.05;
  const backZ = cz + sz / 2 - 1.05;
  const leftX = cx - sx / 2 + 1.08;
  const rightX = cx + sx / 2 - 1.08;
  const ceilingY = Math.max(2.35, sy - 0.28);
  const wideEnough = sx >= 7.2 && sz >= 6;
  const largeRoom = sx >= 12 || sz >= 11;
  const add = (prop: RoomModelProp) => props.push(prop);
  const shadow = (width: number, depth: number): [number, number, number] => [width * propScale, 1, depth * propScale];

  if (!wideEnough) return props;

  if (style === "museum") {
    add({
      id: "museum-ceiling-track-key",
      modelKey: "room_ceiling_strip_light",
      position: [cx - sx * 0.16, ceilingY, cz - sz * 0.08],
      rotation: [0, 0, 0],
      scale: [Math.max(0.95, sx * 0.22), 1, 0.8],
      activeOnly: true,
    });
    add({
      id: "museum-ceiling-track-fill",
      modelKey: "room_ceiling_strip_light",
      position: [cx + sx * 0.24, ceilingY - 0.03, cz + sz * 0.18],
      rotation: [0, 0.02, 0],
      scale: [Math.max(0.75, sx * 0.16), 1, 0.7],
      activeOnly: true,
    });
    return props;
  }

  if (style === "maintenance") {
    add({
      id: "supply-cabinet-left",
      modelKey: "room_maintenance_supply_cabinet",
      position: [leftX, 0.045, cz + sz * 0.22],
      rotation: [0, Math.PI / 2, 0],
      scale: propScale,
      shadowScale: shadow(1.25, 0.9),
    });
    add({
      id: "utility-table",
      modelKey: "room_table_utility",
      position: [cx - sx * 0.23, 0.045, cz + sz * 0.18],
      rotation: [0, 0.06, 0],
      scale: propScale,
      shadowScale: shadow(1.75, 1.1),
    });
    add({
      id: "crate-stack-right",
      modelKey: "room_crate_stack",
      position: [rightX - 0.25, 0.045, cz + sz * 0.14],
      rotation: [0, -Math.PI / 2, 0],
      scale: propScale * 0.95,
      shadowScale: shadow(1.25, 1.05),
    });
    add({
      id: "wall-terminal-front-left",
      modelKey: "room_terminal_wall",
      position: [cx - sx * 0.34, 0.045, frontZ],
      rotation: [0, 0, 0],
      scale: propScale * 1.04,
      shadowScale: shadow(0.8, 0.6),
    });
    add({
      id: "fuse-box-right",
      modelKey: "room_fuse_box",
      position: [rightX, 0.045, cz - sz * 0.18],
      rotation: [0, -Math.PI / 2, 0],
      scale: propScale,
      shadowScale: shadow(0.72, 0.58),
    });
    add({
      id: "ceiling-strip-primary",
      modelKey: "room_ceiling_strip_light",
      position: [cx, ceilingY, cz + sz * 0.22],
      rotation: [0, 0, 0],
      scale: [Math.max(1.05, sx * 0.36), 1, 1],
      activeOnly: true,
    });
    if (isHeroMaintenanceBay || largeRoom) {
      add({
        id: "hero-locker-low",
        modelKey: "room_locker_low",
        position: [leftX + 0.12, 0.045, cz - sz * 0.12],
        rotation: [0, Math.PI / 2, 0],
        scale: propScale * 1.04,
        shadowScale: shadow(0.95, 0.68),
      });
      add({
        id: "hero-back-cabinet",
        modelKey: "room_maintenance_supply_cabinet",
        position: [cx + sx * 0.31, 0.045, backZ],
        rotation: [0, Math.PI, 0],
        scale: propScale * 0.96,
        shadowScale: shadow(1.2, 0.9),
      });
      add({
        id: "hero-ceiling-strip-secondary",
        modelKey: "room_ceiling_strip_light",
        position: [cx - sx * 0.18, ceilingY - 0.04, cz - sz * 0.18],
        rotation: [0, 0, 0],
        scale: [Math.max(1.0, sx * 0.28), 1, 1],
        activeOnly: true,
      });
    }
    return props;
  }

  if (style === "sterile") {
    add({
      id: "archive-reader",
      modelKey: "terminal_archive_reader",
      position: [rightX, 0.045, cz + sz * 0.18],
      rotation: [0, -Math.PI / 2, 0],
      scale: propScale,
      shadowScale: shadow(0.9, 0.75),
    });
    add({
      id: "diagnostic-table",
      modelKey: "room_table_utility",
      position: [cx - sx * 0.18, 0.045, cz + sz * 0.08],
      rotation: [0, -0.04, 0],
      scale: propScale * 0.96,
      shadowScale: shadow(1.65, 1.05),
    });
    add({
      id: "service-chair",
      modelKey: "room_chair_service",
      position: [cx + sx * 0.12, 0.045, cz - sz * 0.12],
      rotation: [0, -0.35, 0],
      scale: propScale,
      shadowScale: shadow(0.7, 0.7),
    });
    add({
      id: "sterile-ceiling-strip",
      modelKey: "room_ceiling_strip_light",
      position: [cx, ceilingY, cz],
      scale: [Math.max(1, sx * 0.32), 1, 1],
      activeOnly: true,
    });
    if (largeRoom || mood === "reveal") {
      add({
        id: "folder-stack",
        modelKey: "prop_archive_folder_stack",
        position: [cx - sx * 0.26, 0.86 * propScale, cz + sz * 0.08],
        rotation: [0, 0.25, 0],
        scale: propScale * 0.9,
      });
    }
    return props;
  }

  if (style === "residential") {
    add({
      id: "residential-chair",
      modelKey: "room_chair_service",
      position: [cx - sx * 0.24, 0.045, cz + sz * 0.16],
      rotation: [0, 0.42, 0],
      scale: propScale * 1.02,
      shadowScale: shadow(0.75, 0.75),
    });
    add({
      id: "residential-table",
      modelKey: "room_table_utility",
      position: [cx + sx * 0.16, 0.045, cz + sz * 0.12],
      rotation: [0, -0.05, 0],
      scale: propScale,
      shadowScale: shadow(1.6, 1.05),
    });
    add({
      id: "open-book",
      modelKey: "prop_archive_book_open",
      position: [cx + sx * 0.17, 0.86 * propScale, cz + sz * 0.12],
      rotation: [0, -0.22, 0],
      scale: propScale * 0.86,
    });
    add({
      id: "residential-locker",
      modelKey: "room_locker_low",
      position: [rightX, 0.045, cz - sz * 0.18],
      rotation: [0, -Math.PI / 2, 0],
      scale: propScale,
      shadowScale: shadow(0.9, 0.7),
    });
    return props;
  }

  add({
    id: "hazard-crates",
    modelKey: "room_crate_stack",
    position: [leftX, 0.045, cz + sz * 0.2],
    rotation: [0, Math.PI / 2, 0],
    scale: propScale,
    shadowScale: shadow(1.25, 1.05),
  });
  add({
    id: "hazard-fuse-box",
    modelKey: "room_fuse_box",
    position: [rightX, 0.045, cz - sz * 0.18],
    rotation: [0, -Math.PI / 2, 0],
    scale: propScale * 1.04,
    shadowScale: shadow(0.72, 0.58),
  });
  add({
    id: "hazard-terminal",
    modelKey: "room_terminal_wall",
    position: [cx + sx * 0.24, 0.045, frontZ],
    rotation: [0, 0, 0],
    scale: propScale,
    shadowScale: shadow(0.8, 0.6),
  });
  add({
    id: "hazard-light",
    modelKey: style === "exit" ? "switch_state_light_red" : "switch_state_light_amber",
    position: [cx - sx * 0.18, Math.min(sy * 0.54, 2.05), frontZ + 0.08],
    rotation: [0, 0, 0],
    scale: propScale * 1.05,
    activeOnly: true,
  });
  if (largeRoom) {
    add({
      id: "hazard-ceiling-strip",
      modelKey: "room_ceiling_strip_light",
      position: [cx, ceilingY, cz - sz * 0.1],
      scale: [Math.max(1, sx * 0.3), 1, 1],
      activeOnly: true,
    });
  }
  return props;
}

function RoomEmergencyLightRig({
  cx,
  cz,
  sx,
  sy,
  sz,
  style,
  accent,
  secondaryAccent,
  detailScale,
  active,
  skinKey,
  mood,
}: {
  cx: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  style: RoomAestheticStyleKey;
  accent: string;
  secondaryAccent: string;
  detailScale: number;
  active: boolean;
  skinKey?: string;
  mood: LevelRoomDefinition["mood"];
}) {
  const redRef = useRef<PointLight>(null);
  const cyanRef = useRef<PointLight>(null);
  const isHeroMaintenanceBay = skinKey === "maintenance_bay_hero";
  const isThreatRoom = mood === "combat" || mood === "boss" || style === "exit" || style === "hazard";
  const museumMode = style === "museum";
  const dangerColor = museumMode ? "#b84b43" : style === "hazard" ? "#ff9e42" : "#ff4f42";
  const cyanColor = style === "residential" ? "#d6b678" : museumMode ? "#d6ebe8" : accent;
  const frontZ = cz - sz / 2 + 1.25;
  const backZ = cz + sz / 2 - 1.25;
  const baseRed = museumMode ? (mood === "boss" ? 0.42 : 0.18) : isHeroMaintenanceBay ? 1.7 : isThreatRoom ? 1.05 : 0.45;
  const baseCyan = museumMode ? 1.28 : style === "maintenance" || style === "sterile" ? 1.15 : 0.55;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const hardFlicker = 0.55 + Math.sin(t * 7.1) * 0.18 + Math.sin(t * 17.3) * 0.11;
    const softPulse = 0.82 + Math.sin(t * 1.25) * 0.12;
    if (redRef.current) {
      redRef.current.intensity = baseRed * Math.max(0.22, hardFlicker) * (active || isHeroMaintenanceBay ? 1 : 0.35);
    }
    if (cyanRef.current) {
      cyanRef.current.intensity = baseCyan * softPulse * (active || isHeroMaintenanceBay ? 1 : 0.28);
    }
  });

  if (!active && !isHeroMaintenanceBay) return null;

  return (
    <group>
      <pointLight
        ref={redRef}
        position={[cx, Math.min(sy * 0.78, 3.05), frontZ]}
        color={dangerColor}
        intensity={baseRed}
        distance={Math.max(6, Math.min(15, sx * 0.75))}
      />
      <pointLight
        ref={cyanRef}
        position={[cx - sx * 0.26, Math.min(sy * 0.72, 2.9), backZ]}
        color={cyanColor}
        intensity={baseCyan}
        distance={Math.max(8, Math.min(18, sz * 0.78))}
      />
      <AestheticGlowStrip
        position={[cx, Math.min(sy * 0.72, 2.82), frontZ - 0.05]}
        scale={[sx * (isHeroMaintenanceBay ? 0.52 : 0.36), 0.048, 0.05]}
        color={dangerColor}
        opacity={(isHeroMaintenanceBay ? 0.5 : 0.32) * detailScale}
      />
      <AestheticGlowStrip
        position={[cx - sx * 0.35, Math.min(sy * 0.48, 1.9), cz]}
        scale={[0.04, 0.42, sz * 0.32]}
        color={secondaryAccent}
        opacity={(isHeroMaintenanceBay ? 0.34 : 0.2) * detailScale}
      />
      {isHeroMaintenanceBay ? (
        <mesh position={[cx, 0.095, cz - sz * 0.24]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx * 0.64, sz * 0.18, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={dangerColor} transparent opacity={0.055} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function AestheticGlowStrip({
  position,
  scale,
  color,
  opacity,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={Math.min(0.78, opacity)} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function AtlasPlane({
  texture,
  region,
  position,
  rotation = [0, 0, 0],
  scale,
  opacity = 1,
  additive = false,
}: {
  texture: Texture;
  region: AtlasRegion;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
  opacity?: number;
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

function DoorFrame({ door, world }: { door: LevelDoorDefinition; world: GameWorld }) {
  const [sx, sy, sz] = door.size;
  const open = world.isDoorOpen(door.id);
  const canOpen = world.canOpenDoor(door);
  const material = resolveDoorMaterial(door);
  const visual = resolveDoorVisual(door);
  const skin = resolveDoorSkin(door);
  const light = open ? material.accent : canOpen ? material.accent : material.dangerAccent ?? "#ff6655";
  const frameScale = skin?.frameScale ?? (visual.primitive === "door" ? visual.scale : 1);

  return (
    <group position={[door.position[0], sy / 2, door.position[2]]} rotation={[0, door.yaw, 0]} scale={[frameScale, 1, 1]}>
      <mesh position={[-sx / 2 - 0.14, 0, 0]} scale={[0.18, sy * 1.12, Math.max(0.28, sz * 1.8)]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={material.color} emissive={material.emissive} emissiveIntensity={0.34} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      <mesh position={[sx / 2 + 0.14, 0, 0]} scale={[0.18, sy * 1.12, Math.max(0.28, sz * 1.8)]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={material.color} emissive={material.emissive} emissiveIntensity={0.34} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      <mesh position={[0, sy / 2 + 0.14, 0]} scale={[sx + 0.56, 0.18, Math.max(0.28, sz * 1.8)]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={material.color} emissive={material.emissive} emissiveIntensity={0.34} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      <mesh position={[0, -sy / 2 + 0.055, 0]} scale={[sx + 0.72, 0.07, Math.max(0.82, sz * 2.7)]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#080e14" emissive={light} emissiveIntensity={0.12} metalness={0.78} roughness={0.36} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`door-side-light:${side}`} position={[side * (sx / 2 + 0.165), 0, Math.max(0.18, sz * 1.02)]} scale={[0.035, sy * 0.66, 0.04]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={light} transparent opacity={open ? 0.34 : canOpen ? 0.62 : 0.48} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, sy * 0.48, sz * 1.05]} scale={[sx * 0.82, 0.05, 0.045]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={light} transparent opacity={open ? 0.62 : 0.48} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

function InteractionMarker({
  world,
  interaction,
  room,
  completed,
}: {
  world: GameWorld;
  interaction: LevelInteractionDefinition;
  room?: LevelRoomDefinition;
  completed: boolean;
}) {
  const material = resolveInteractionMaterial(interaction);
  const visual = resolveMapVisual(interaction.visualKey);
  const [x, y, z] = interaction.position;
  const modelKey = modelKeyForInteraction(interaction);
  if (completed && interaction.type !== "exit" && !keepCompletedInteractionVisual(interaction, modelKey)) return null;
  const routeSwitch = modelKey === "builder_route_switch_console";
  const wallDoorSwitch = modelKey === "hp_wall_door_switch_button_v1";
  const wallDoorSwitchDefinition = wallDoorSwitch ? world.switchForInteraction(interaction.id) : null;
  const wallDoorSwitchPosition = wallDoorSwitchDefinition ? wallDoorSwitchLeverPosition(world, wallDoorSwitchDefinition) : "up";
  const color = routeSwitch ? "#5ee8c8" : interaction.type === "exit" ? material.accent : room?.geometry?.accentColor ?? material.accent;
  if (visual.primitive === "none") return null;
  if (visual.primitive === "big_screen") return null;
  if (interaction.type === "pickup_story") return null;
  if (interaction.type === "exit" && !modelKey) return null;
  if (modelKey) {
    const modelScale = visual.primitive === "archive_book" ? visual.scale * 0.9 : visual.scale;
    const revealBaseY = wallDoorSwitch ? y : 0.045;
    const revealDepth = interactionModelRevealDepthY(modelKey, modelScale, revealBaseY);
    const revealRiseY = interactionFocusRevealRiseOffsetY(world, interaction, revealDepth);
    return (
      <group
        position={[x, revealBaseY + revealRiseY, z]}
        rotation={[0, wallDoorSwitch ? interaction.yaw ?? 0 : 0, 0]}
        scale={[modelScale, modelScale, modelScale]}
      >
        {wallDoorSwitch ? (
          <WallDoorSwitchLeverModel leverPosition={wallDoorSwitchPosition} />
        ) : (
          <EnvironmentModelInstance modelKey={modelKey} />
        )}
        {wallDoorSwitch ? (
          <mesh position={[0, 0.08, -0.12]} scale={[0.28, 0.035, 0.018]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={color} transparent opacity={completed ? 0.24 : 0.74} toneMapped={false} />
          </mesh>
        ) : (
          <mesh position={[0, routeSwitch ? 0.78 : 0.9, 0.18]} scale={routeSwitch ? [0.68, 0.055, 0.045] : [0.42, 0.035, 0.035]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={color} transparent opacity={completed ? (routeSwitch ? 0.38 : 0.24) : routeSwitch ? 0.92 : 0.76} toneMapped={false} />
          </mesh>
        )}
      </group>
    );
  }
  const isExit = visual.primitive === "exit_panel";
  const panelScale: [number, number, number] = isExit ? [0.46, 0.62, 0.2] : [0.38, 0.42, 0.18];
  const panelRevealDepth = interactionPrimitiveRevealDepthY(0.38, panelScale[1], visual.scale);
  return (
    <group position={[x, 0.38 + interactionFocusRevealRiseOffsetY(world, interaction, panelRevealDepth), z]} scale={[visual.scale, visual.scale, visual.scale]}>
      <mesh scale={panelScale} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={material.color} emissive={color} emissiveIntensity={completed ? 0.18 : 0.62} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      <mesh position={[0, 0.22, 0.095]} scale={[0.28, 0.04, 0.02]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={completed ? 0.28 : material.glowOpacity ?? 0.72} toneMapped={false} />
      </mesh>
    </group>
  );
}

function interactionModelRevealDepthY(modelKey: EnvironmentModelKey, modelScale: number, baseY: number) {
  const asset = getEnvironmentModelAsset(modelKey);
  return Math.max(0.1, baseY + asset.sizeMeters[1] * modelScale + 0.08);
}

function interactionPrimitiveRevealDepthY(baseY: number, localHeight: number, scale: number) {
  return Math.max(0.1, baseY + localHeight * scale + 0.08);
}

function ArchiveBookMarker({
  x,
  z,
  color,
  completed,
  scale,
}: {
  x: number;
  z: number;
  color: string;
  completed: boolean;
  scale: number;
}) {
  return (
    <group position={[x, 0.34, z]} scale={[scale, scale, scale]}>
      <mesh position={[0, -0.12, 0]} scale={[0.68, 0.1, 0.46]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#101820" emissive={color} emissiveIntensity={completed ? 0.08 : 0.18} metalness={0.76} roughness={0.34} />
      </mesh>
      <mesh position={[-0.18, 0.03, 0]} rotation={[0, 0, -0.16]} scale={[0.34, 0.035, 0.42]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d6e1df" emissive="#29404a" emissiveIntensity={0.18} metalness={0.28} roughness={0.52} />
      </mesh>
      <mesh position={[0.18, 0.03, 0]} rotation={[0, 0, 0.16]} scale={[0.34, 0.035, 0.42]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c7d1cf" emissive="#263943" emissiveIntensity={0.16} metalness={0.28} roughness={0.56} />
      </mesh>
      <mesh position={[0, 0.08, 0.01]} scale={[0.035, 0.04, 0.43]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#20292f" emissive={color} emissiveIntensity={completed ? 0.12 : 0.42} metalness={0.62} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.2, 0]} scale={[0.54, 0.035, 0.035]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={completed ? 0.22 : 0.74} toneMapped={false} />
      </mesh>
    </group>
  );
}

function keepCompletedInteractionVisual(interaction: LevelInteractionDefinition, modelKey: string | null) {
  return (
    interaction.visualKey.startsWith("puzzle_console_") ||
    interaction.visualKey === "wall_door_switch_button" ||
    modelKey?.startsWith("puzzle_console_") ||
    modelKey === "hp_wall_door_switch_button_v1"
  );
}

type WallDoorSwitchLeverPosition = "up" | "down";

function wallDoorSwitchLeverPosition(world: GameWorld, definition: LevelSwitchDefinition): WallDoorSwitchLeverPosition {
  const currentStateId = world.activeSwitchStateId(definition.id);
  const current = wallDoorSwitchLeverPositionForState(definition, currentStateId);
  const active = world.session.activeHandInteraction?.switchId === definition.id ? world.session.activeHandInteraction : null;
  if (!active) return current;
  return active.committed ? current : active.leverDirection ?? (current === "up" ? "down" : "up");
}

function wallDoorSwitchLeverPositionForState(definition: LevelSwitchDefinition, stateId: string | null): WallDoorSwitchLeverPosition {
  // Match Raw: wall lever position follows the switch's own state slot, never
  // the number or wording of doors controlled by that state.
  const stateIndex = definition.states.findIndex((candidate) => candidate.id === stateId);
  return stateIndex > 0 && stateIndex % 2 === 1 ? "down" : "up";
}

function WallDoorSwitchLeverModel({ leverPosition }: { leverPosition: WallDoorSwitchLeverPosition }) {
  const objectRef = useRef<Object3D | null>(null);
  const targetOffsetRef = useRef(leverPosition === "down" ? -0.34 : 0);

  useEffect(() => {
    targetOffsetRef.current = leverPosition === "down" ? -0.34 : 0;
  }, [leverPosition]);

  const applyOffset = useCallback((object: Object3D | null, offset: number) => {
    if (!object) return;
    object.traverse((child) => {
      if (!isWallDoorSwitchSlidingLeverNode(child.name)) return;
      const userData = child.userData as { hpWallSwitchBaseY?: number };
      userData.hpWallSwitchBaseY ??= child.position.y;
      child.position.y = userData.hpWallSwitchBaseY + offset;
    });
  }, []);

  const handleReady = useCallback(
    (object: Object3D | null) => {
      objectRef.current = object;
      applyOffset(object, targetOffsetRef.current);
    },
    [applyOffset],
  );

  useFrame((_state, delta) => {
    const object = objectRef.current;
    if (!object) return;
    const target = targetOffsetRef.current;
    const speed = 1 - Math.pow(0.0008, Math.min(delta, 0.1));
    object.traverse((child) => {
      if (!isWallDoorSwitchSlidingLeverNode(child.name)) return;
      const userData = child.userData as { hpWallSwitchBaseY?: number };
      userData.hpWallSwitchBaseY ??= child.position.y;
      const next = child.position.y + (userData.hpWallSwitchBaseY + target - child.position.y) * speed;
      child.position.y = Math.abs(next - (userData.hpWallSwitchBaseY + target)) < 0.001 ? userData.hpWallSwitchBaseY + target : next;
    });
  });

  return <EnvironmentModelInstance modelKey="hp_wall_door_switch_button_v1" onObjectReady={handleReady} />;
}

function isWallDoorSwitchSlidingLeverNode(name: string | null | undefined) {
  // Runtime GLB coordinates are Y-up. Keep the bearing/center pin fixed and
  // slide only the grip assembly vertically along the wall plate slot.
  return /^wall_switch_lever_movable_(?:short_upper_pull_rod|top_grip_cap|lower_stop_cap|slider_yoke)/i.test(name ?? "");
}

function BigScreenMarker({ screen, world }: { screen: LevelBigScreenDefinition; world: GameWorld }) {
  const interaction = world.level.map?.interactions.find((candidate) => candidate.id === screen.interactionId);
  const visual = resolveMapVisual(screen.visualKey ?? screen.modelKey ?? "terminal_puzzle_big_screen");
  const material = resolveMapMaterial(screen.materialKey ?? visual.materialKey);
  const state = world.activeBigScreenState(screen.id) ?? screen.states[0] ?? null;
  const position = screen.position ?? interaction?.position;
  if (!position || !state) return null;

  const [x, rawY, z] = position;
  const y = rawY > 0.2 ? rawY : 1.36;
  const yaw = screen.yaw ?? 0;
  const [width, height] = screen.size ?? [2.45, 1.34];
  const powered = state.mode !== "off" && state.powered !== false;
  const glowColor = powered ? material.accent : material.dangerAccent ?? "#ff6655";
  const modelKey = "terminal_puzzle_big_screen";
  const modelAsset = getEnvironmentModelAsset(modelKey);
  const modelScale: [number, number, number] = [
    width / modelAsset.sizeMeters[0],
    height / modelAsset.sizeMeters[1],
    1,
  ];

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]} scale={[visual.scale, visual.scale, visual.scale]}>
      <EnvironmentModelInstance modelKey={modelKey} position={[0, -height * 0.5, -0.12]} scale={modelScale} />
      <mesh position={[0, 0, 0.042]} scale={[width, height, 0.055]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={powered ? material.activeColor ?? "#102a34" : "#05080b"}
          emissive={powered ? material.activeEmissive ?? glowColor : "#170708"}
          emissiveIntensity={powered ? 0.72 : 0.18}
          metalness={0.48}
          roughness={0.34}
          transparent
          opacity={powered ? 0.88 : 0.72}
        />
      </mesh>
      <mesh position={[0, height * 0.55, 0.085]} scale={[width * 0.86, 0.035, 0.035]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={glowColor} transparent opacity={powered ? 0.82 : 0.34} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[-width * 0.54, -height * 0.52, 0.09]} scale={[0.11, 0.11, 0.035]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={glowColor} transparent opacity={powered ? 0.92 : 0.52} toneMapped={false} />
      </mesh>
      <mesh position={[width * 0.48, -height * 0.52, 0.09]} scale={[0.34, 0.035, 0.035]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={glowColor} transparent opacity={powered ? 0.72 : 0.22} toneMapped={false} />
      </mesh>
      <BigScreenContent state={state} width={width} height={height} powered={powered} color={glowColor} world={world} />
    </group>
  );
}

function BigScreenContent({
  state,
  width,
  height,
  powered,
  color,
  world,
}: {
  state: LevelBigScreenStateDefinition;
  width: number;
  height: number;
  powered: boolean;
  color: string;
  world: GameWorld;
}) {
  if (!powered) {
    return (
      <Text position={[0, 0.02, 0.09]} fontSize={Math.min(0.2, height * 0.15)} anchorX="center" anchorY="middle" color="#6b7d84" outlineColor="#020508" outlineWidth={0.01}>
        OFF
      </Text>
    );
  }

  if (state.mode === "color_sequence") {
    const colors = state.colors ?? [];
    const chipWidth = Math.min(0.5, width / Math.max(4, colors.length + 1));
    const span = chipWidth * 1.32;
    return (
      <group>
        <ScreenTitle state={state} width={width} height={height} color={color} world={world} />
        {colors.map((item, index) => {
          const x = (index - (colors.length - 1) / 2) * span;
          return (
            <group key={`${item}:${index}`} position={[x, -height * 0.02, 0.1]}>
              <mesh scale={[chipWidth, height * 0.34, 0.035]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color={bigScreenColor(item)} transparent opacity={0.92} toneMapped={false} />
              </mesh>
              <Text position={[0, -height * 0.26, 0.02]} fontSize={Math.min(0.13, chipWidth * 0.28)} anchorX="center" anchorY="middle" color="#e9fbff" outlineColor="#020508" outlineWidth={0.008}>
                {index + 1}
              </Text>
            </group>
          );
        })}
      </group>
    );
  }

  if (state.mode === "digits") {
    const digits = state.digits ?? state.formula?.answer ?? "";
    return (
      <group>
        <ScreenTitle state={state} width={width} height={height} color={color} world={world} />
        <Text position={[0, -height * 0.06, 0.1]} fontSize={Math.min(0.62, width / Math.max(5, digits.length + 1))} anchorX="center" anchorY="middle" color="#f5fbff" outlineColor="#06141b" outlineWidth={0.018}>
          {digits}
        </Text>
      </group>
    );
  }

  if (state.mode === "formula") {
    const display = state.formula?.display ?? state.formula?.expression ?? state.text ?? "";
    return (
      <group>
        <ScreenTitle state={state} width={width} height={height} color={color} world={world} />
        <Text position={[0, -height * 0.02, 0.1]} fontSize={Math.min(0.28, width / Math.max(8, display.length * 0.55))} anchorX="center" anchorY="middle" color="#f5fbff" outlineColor="#06141b" outlineWidth={0.014} maxWidth={width * 0.82}>
          {world.configText(display)}
        </Text>
        {state.formula?.hint ? (
          <Text position={[0, -height * 0.34, 0.1]} fontSize={Math.min(0.14, height * 0.12)} anchorX="center" anchorY="middle" color="#9eddf0" outlineColor="#06141b" outlineWidth={0.008} maxWidth={width * 0.82}>
            {world.configText(state.formula.hint)}
          </Text>
        ) : null}
      </group>
    );
  }

  const text = state.text ?? state.detail ?? state.title ?? "";
  return (
    <group>
      <ScreenTitle state={state} width={width} height={height} color={color} world={world} />
      {text ? (
        <Text position={[0, -height * 0.08, 0.1]} fontSize={Math.min(0.2, height * 0.15)} anchorX="center" anchorY="middle" color="#dff8ff" outlineColor="#06141b" outlineWidth={0.01} maxWidth={width * 0.8}>
          {world.configText(text)}
        </Text>
      ) : null}
    </group>
  );
}

function ScreenTitle({
  state,
  width,
  height,
  color,
  world,
}: {
  state: LevelBigScreenStateDefinition;
  width: number;
  height: number;
  color: string;
  world: GameWorld;
}) {
  const title = state.title ?? state.label;
  if (!title) return null;
  return (
    <Text position={[-width * 0.42, height * 0.36, 0.1]} fontSize={Math.min(0.15, height * 0.12)} anchorX="left" anchorY="middle" color={color} outlineColor="#041019" outlineWidth={0.008} maxWidth={width * 0.82}>
      {world.configText(title)}
    </Text>
  );
}

function bigScreenColor(color: LevelBigScreenColorKey) {
  if (color === "red") return "#ff5b4c";
  if (color === "blue") return "#64d7ff";
  if (color === "cyan") return "#7ff2ff";
  if (color === "green") return "#67ff9d";
  if (color === "yellow" || color === "amber") return "#ffcf6a";
  if (color === "purple") return "#c692ff";
  return "#ecfbff";
}

function PuzzleTargetMarker({
  puzzle,
  target,
  world,
}: {
  puzzle: LevelHitSequencePuzzleDefinition;
  target: LevelPuzzleTargetDefinition;
  world: GameWorld;
}) {
  const material = resolvePuzzleTargetMaterial(target);
  const visual = resolveMapVisual(target.visualKey);
  const activeSequence = world.session.mapProgress.activePuzzleSequences[puzzle.id] ?? [];
  const completed = world.isPuzzleCompleted(puzzle.id);
  const alreadyHit = activeSequence.includes(target.id);
  const isNext = !completed && puzzle.clue.sequence[activeSequence.length] === target.id;
  const pulse = world.session.mapProgress.puzzleTargetPulses[puzzleTargetPulseKey(puzzle.id, target.id)] ?? 0;
  const [x, y, z] = target.position;
  const scale = target.radius * visual.scale;
  const glow = completed ? 1.05 : alreadyHit ? 0.82 : isNext ? 0.64 : 0.34;
  const pulseBoost = Math.min(0.8, pulse * 1.2);

  if (visual.primitive === "lamp") {
    const lampModelKey = modelKeyForPuzzleLamp(target);
    const usesResidentialLamp = target.visualKey?.startsWith("residential_lamp_") ?? false;
    const lampModelPosition: Vec3Tuple = usesResidentialLamp ? [0, -1.0, 0] : [0, -0.62, 0];
    const lampModelScale: Vec3Tuple = usesResidentialLamp ? [1.08, 1.08, 1.08] : [2.18, 1.9, 1.32];
    return (
      <group position={[x, y, z]} scale={[scale, scale, scale]}>
        <EnvironmentModelInstance
          modelKey={lampModelKey}
          position={lampModelPosition}
          scale={lampModelScale}
          castShadow
          receiveShadow
        />
        <mesh position={[0, -0.02, 0.13]} scale={[0.28, 1.05, 0.052]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color={material.accent}
            transparent
            opacity={0.46 + glow * 0.42 + pulseBoost * 0.3}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.72, 0]} scale={[0.62, 0.13, 0.28]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#101820" emissive={material.emissive} emissiveIntensity={0.18} metalness={0.74} roughness={0.38} />
        </mesh>
        <mesh position={[0, -0.92, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.52, 0.018, 10, 42]} />
          <meshBasicMaterial color={material.accent} transparent opacity={0.26 + glow * 0.3} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (!target.anchorPropId) {
    const orbY = Math.max(0.86, y);
    const orbRadius = Math.max(0.34, Math.min(0.54, target.radius * visual.scale * 0.72));
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[orbRadius * 1.65, orbRadius * 1.9, 0.09, 20]} />
          <meshStandardMaterial color="#111820" emissive={material.emissive} emissiveIntensity={0.08 + glow * 0.08} metalness={0.66} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[orbRadius * 1.08, orbRadius * 1.34, 0.08, 20]} />
          <meshStandardMaterial color="#9c7836" emissive="#312109" emissiveIntensity={0.12} metalness={0.78} roughness={0.34} />
        </mesh>
        <mesh position={[0, orbY * 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.052, Math.max(0.5, orbY - 0.22), 10]} />
          <meshStandardMaterial color="#202832" emissive={material.emissive} emissiveIntensity={0.08 + glow * 0.05} metalness={0.68} roughness={0.44} />
        </mesh>
        <mesh position={[0, orbY - orbRadius * 0.62, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[orbRadius * 0.72, 0.026, 8, 26]} />
          <meshStandardMaterial color="#b58a3e" emissive="#442b0d" emissiveIntensity={0.16} metalness={0.78} roughness={0.32} />
        </mesh>
        <mesh position={[0, orbY, 0]} castShadow>
          <sphereGeometry args={[orbRadius, 20, 14]} />
          <meshStandardMaterial
            color={material.color}
            emissive={completed || alreadyHit || isNext ? material.activeEmissive ?? material.accent : material.emissive}
            emissiveIntensity={glow + pulseBoost}
            metalness={material.metalness}
            roughness={material.roughness}
            transparent
            opacity={completed ? 0.96 : material.opacity ?? 0.9}
          />
        </mesh>
        <mesh position={[0, orbY, 0]}>
          <sphereGeometry args={[orbRadius * 1.38, 18, 12]} />
          <meshBasicMaterial
            color={material.accent}
            transparent
            opacity={0.1 + glow * 0.15 + pulseBoost * 0.12}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, orbY + orbRadius * 0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[orbRadius * 1.12, 0.012, 8, 36]} />
          <meshBasicMaterial color={material.accent} transparent opacity={0.2 + glow * 0.28} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[x, y, z]} scale={[scale, scale, scale]}>
      <mesh position={[0, -0.72, 0]} scale={[0.92, 0.18, 0.92]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#18242c"
          emissive={material.emissive}
          emissiveIntensity={0.18 + glow * 0.2}
          metalness={0.68}
          roughness={0.36}
        />
      </mesh>
      <mesh position={[0, -0.5, 0]} scale={[0.42, 0.42, 0.42]} castShadow>
        <octahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={material.color}
          emissive={completed || alreadyHit ? material.activeEmissive ?? material.accent : material.emissive}
          emissiveIntensity={glow + pulseBoost}
          metalness={material.metalness}
          roughness={material.roughness}
          transparent
          opacity={material.opacity ?? 0.92}
        />
      </mesh>
      <mesh scale={[0.74, 0.74, 0.74]} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
        <meshStandardMaterial
          color={material.color}
          emissive={completed || alreadyHit || isNext ? material.activeEmissive ?? material.accent : material.emissive}
          emissiveIntensity={glow + pulseBoost}
          metalness={material.metalness}
          roughness={material.roughness}
          transparent
          opacity={completed ? 0.96 : material.opacity ?? 0.88}
        />
      </mesh>
      <mesh position={[0, 0.08, 0.7]} scale={[0.48, 0.055, 0.055]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={material.accent}
          transparent
          opacity={0.34 + glow * 0.42 + pulseBoost * 0.28}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function modelKeyForPuzzleLamp(target: LevelPuzzleTargetDefinition): EnvironmentModelKey {
  if (target.visualKey === "residential_lamp_warm") return "light_residential_lamp_warm";
  if (target.visualKey === "residential_lamp_white") return "light_residential_lamp_white";
  if (target.visualKey === "residential_lamp_blue") return "light_residential_lamp_blue";
  if (target.colorKey === "red") return "switch_state_light_red";
  if (target.colorKey === "yellow") return "switch_state_light_amber";
  return "switch_state_light_cyan";
}

function HitSequenceClueSurface({
  puzzle,
  surface,
  completed,
}: {
  puzzle: LevelHitSequencePuzzleDefinition;
  surface: LevelHitSequenceClueSurfaceDefinition;
  completed: boolean;
}) {
  const [x, y, z] = surface.position;
  const [width, heightOrDepth] = surface.size;
  const yaw = surface.yaw ?? 0;
  const sequence = surface.sequence ?? puzzle.clue.sequence;
  const baseMaterial = resolveMapMaterial(surface.materialKey ?? "wall_digit_paint");
  const opacity = completed ? 0.24 : 0.64;
  const chipCount = Math.max(1, sequence.length);
  const chipSpan = width / chipCount;
  const chipWidth = Math.max(0.24, chipSpan * 0.68);

  if (surface.surface === "floor") {
    return (
      <group position={[x, y, z]} rotation={[0, yaw, 0]}>
        <mesh position={[0, 0.045, 0]} scale={[width, 0.09, heightOrDepth]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={baseMaterial.color}
            emissive={baseMaterial.activeEmissive ?? baseMaterial.emissive}
            emissiveIntensity={completed ? 0.08 : 0.18}
            metalness={baseMaterial.metalness}
            roughness={baseMaterial.roughness}
            transparent
            opacity={opacity}
          />
        </mesh>
        <mesh position={[0, 0.105, -heightOrDepth * 0.38]} scale={[width * 0.92, 0.026, 0.035]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#09141b" emissive={baseMaterial.emissive} emissiveIntensity={completed ? 0.08 : 0.22} metalness={0.76} roughness={0.34} />
        </mesh>
        <mesh position={[0, 0.105, heightOrDepth * 0.38]} scale={[width * 0.92, 0.026, 0.035]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#0d1b22" emissive={baseMaterial.activeEmissive ?? baseMaterial.accent} emissiveIntensity={completed ? 0.07 : 0.2} metalness={0.76} roughness={0.34} />
        </mesh>
        {sequence.map((targetId, index) => {
          const target = puzzle.targets.find((candidate) => candidate.id === targetId);
          const material = target ? resolvePuzzleTargetMaterial(target) : baseMaterial;
          const offsetX = -width / 2 + chipSpan * (index + 0.5);
          return (
            <FloorSequenceStation
              key={`${surface.id}:${targetId}:${index}`}
              index={index}
              position={[offsetX, 0.108, 0]}
              chipWidth={chipWidth}
              depth={heightOrDepth}
              material={material}
              modelKey={target ? modelKeyForPuzzleLamp(target) : "switch_state_light_cyan"}
              completed={completed}
            />
          );
        })}
        {surface.label ? (
          <Text
            position={[0, 0.08, heightOrDepth * 0.36]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={Math.min(0.22, heightOrDepth * 0.22)}
            anchorX="center"
            anchorY="middle"
            color={completed ? "#91a5b5" : baseMaterial.accent}
            outlineColor="#041019"
            outlineWidth={0.01}
          >
            {surface.label}
          </Text>
        ) : null}
      </group>
    );
  }

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <mesh scale={[width, heightOrDepth, 0.055]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={baseMaterial.color}
          emissive={baseMaterial.activeEmissive ?? baseMaterial.emissive}
          emissiveIntensity={completed ? 0.1 : 0.34}
          metalness={baseMaterial.metalness}
          roughness={baseMaterial.roughness}
          transparent
          opacity={opacity}
        />
      </mesh>
      {sequence.map((targetId, index) => {
        const target = puzzle.targets.find((candidate) => candidate.id === targetId);
        const material = target ? resolvePuzzleTargetMaterial(target) : baseMaterial;
        const offsetX = -width / 2 + chipSpan * (index + 0.5);
        return (
          <mesh
            key={`${surface.id}:${targetId}:${index}`}
            position={[offsetX, 0.08, 0.06]}
            scale={[chipWidth, heightOrDepth * 0.32, 0.035]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color={material.accent}
              transparent
              opacity={completed ? 0.24 : 0.88}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
      {surface.label ? (
        <Text
          position={[0, -heightOrDepth * 0.34, 0.07]}
          fontSize={Math.min(0.22, heightOrDepth * 0.2)}
          anchorX="center"
          anchorY="middle"
          color={completed ? "#91a5b5" : baseMaterial.accent}
          outlineColor="#041019"
          outlineWidth={0.012}
        >
          {surface.label}
        </Text>
      ) : null}
    </group>
  );
}

function FloorSequenceStation({
  index,
  position,
  chipWidth,
  depth,
  material,
  modelKey,
  completed,
}: {
  index: number;
  position: [number, number, number];
  chipWidth: number;
  depth: number;
  material: MapMaterialProfile;
  modelKey: EnvironmentModelKey;
  completed: boolean;
}) {
  const glowOpacity = completed ? 0.24 : 0.78;
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]} scale={[chipWidth * 0.94, 0.06, depth * 0.48]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#101920" emissive={material.emissive} emissiveIntensity={completed ? 0.12 : 0.28} metalness={0.72} roughness={0.36} />
      </mesh>
      <EnvironmentModelInstance
        modelKey={modelKey}
        position={[-chipWidth * 0.32, 0.035, -depth * 0.02]}
        scale={[1.25, 0.48, 1.05]}
        castShadow
        receiveShadow
      />
      <mesh position={[chipWidth * 0.12, 0.055, 0]} scale={[chipWidth * 0.46, 0.022, depth * 0.24]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={material.accent} transparent opacity={glowOpacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[chipWidth * 0.42, 0.07, 0]} scale={[0.05, 0.035, depth * 0.38]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={material.activeEmissive ?? material.accent} transparent opacity={completed ? 0.16 : 0.58} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        position={[-chipWidth * 0.26, 0.13, depth * 0.26]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={Math.min(0.16, depth * 0.16)}
        anchorX="center"
        anchorY="middle"
        color={completed ? "#8799a6" : material.accent}
        outlineColor="#041019"
        outlineWidth={0.008}
      >
        {index + 1}
      </Text>
    </group>
  );
}

function DirectionDigitClueMarker({
  clue,
  completed,
}: {
  clue: LevelDirectionDigitClueDefinition;
  completed: boolean;
}) {
  const visual = resolveMapVisual(clue.visualKey);
  const material = resolveMapMaterial(clue.materialKey ?? visual.materialKey);
  const [x, y, z] = clue.position;
  const yaw = clue.yaw ?? 0;
  const [width, heightOrDepth] = clue.size ?? [1.18, 0.82];

  if (clue.surface === "floor") {
    return (
      <group position={[x, y, z]} rotation={[0, yaw, 0]} scale={[visual.scale, visual.scale, visual.scale]}>
        <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[width, heightOrDepth, 1]} receiveShadow>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={material.color}
            emissive={completed ? material.emissive : material.activeEmissive ?? material.accent}
            emissiveIntensity={completed ? 0.12 : 0.54}
            metalness={material.metalness}
            roughness={material.roughness}
            transparent
            opacity={completed ? 0.26 : 0.66}
            side={DoubleSide}
          />
        </mesh>
        <Text
          position={[0, 0.075, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={Math.min(width, heightOrDepth) * 0.72}
          anchorX="center"
          anchorY="middle"
          color={completed ? "#9aaec3" : material.accent}
          outlineColor="#041019"
          outlineWidth={0.018}
        >
          {clue.value}
        </Text>
      </group>
    );
  }

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]} scale={[visual.scale, visual.scale, visual.scale]}>
      <mesh scale={[width, heightOrDepth, 0.055]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={material.color}
          emissive={completed ? material.emissive : material.activeEmissive ?? material.accent}
          emissiveIntensity={completed ? 0.22 : 0.68}
          metalness={material.metalness}
          roughness={material.roughness}
        />
      </mesh>
      <mesh position={[0, -heightOrDepth / 2 + 0.02, 0.035]} scale={[width * 0.92, 0.04, 0.035]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={material.accent} transparent opacity={completed ? 0.22 : 0.72} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 0.02, 0.07]}
        fontSize={Math.min(width, heightOrDepth) * 0.76}
        anchorX="center"
        anchorY="middle"
        color={completed ? "#9aaec3" : material.accent}
        outlineColor="#041019"
        outlineWidth={0.018}
      >
        {clue.value}
      </Text>
    </group>
  );
}

function activeColor(material: MapMaterialProfile, active: boolean) {
  return active ? material.activeColor ?? material.color : material.color;
}

function activeEmissive(material: MapMaterialProfile, active: boolean, override?: string) {
  if (override) return override;
  return active ? material.activeEmissive ?? material.emissive : material.emissive;
}

function puzzleTargetPulseKey(puzzleId: string, targetId: string) {
  return `${puzzleId}:${targetId}`;
}
