import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type Ref } from "react";
import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, MOUSE, RepeatWrapping, type Group, type Mesh, type MeshBasicMaterial, type Side, type Texture } from "three";
import type { EnvironmentModelKey } from "../assets/environmentModelAssets";
import { isEnvironmentModelKey } from "../assets/environmentModelAssets";
import { EnvironmentModelInstance } from "../render/environment/EnvironmentModelInstance";
import { polishRouteOutputOrbObject, routeOutputOrbAccentForIndex } from "../render/environment/routeOutputOrbMaterial";
import { StoryPaintingArtPlane } from "../render/environment/StoryPaintingArtPlane";
import { isStoryPaintingArtModelKey } from "../game/visual/StoryPaintingArt";
import type { GameLanguage } from "../game/core/GameSettings";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import { bl } from "./i18n/catalogLabels";
import { builderLockLabels, defaultPropElevation, propEntry, robotLabel, roomStyleEntry } from "./BuilderAssetCatalog";
import { builderDoorDisplayLabel } from "./BuilderDoorRelations";
import { doorPuzzleKind, orbColorHex, puzzleInstances, puzzleKindEntry } from "./BuilderPuzzleCatalog";
import { puzzleComponentAnchorPropId, puzzleComponentY } from "./BuilderPuzzlePlacement";
import { puzzleConsoleModelKey, puzzleInstanceUsesHostedInteraction } from "./BuilderPuzzleRuntimeRegistry";
import { BlobShadow, HoverGlow, LockIcon, WallScreenDecal } from "./preview3d/BuilderPreviewPrimitives";
import { PuzzleMachineMesh } from "./preview3d/BuilderPuzzleMachineMesh";
import { RouteSwitchMesh } from "./preview3d/BuilderRouteSwitchMesh";
import { EditingGround, PlacementGhost3D, useBuilder3DEditing, type DoorEdgeInfo } from "./Builder3DEditing";
import { pickupEntry, pickupModelKey } from "./BuilderPickupCatalog";
import {
  brushPreset,
  roomCeiling,
  roomFloor,
  roomWall,
  type BuilderBrush,
  type BuilderPaintFlash,
  type BuilderSurfacePreset,
} from "./BuilderEnvironment";
import { builderVisualProfile, contactShadowSpec, type BuilderVisualProfile } from "./BuilderVisualProfile";
import { floorSurfaceTexture, wallSurfaceTexture } from "./BuilderSurfaceTextures";
import type { BuilderUpdate } from "./BuilderHistory";
import {
  puzzlePlanPosition,
  puzzleWallMountPlacement,
  robotDisplayPosition,
  routeOutputKeyPosition,
  wallDoorSwitchPlacement,
  wallMountedPropPlacementForEntryFromPoint,
  type PlacementDraft,
} from "./BuilderPlacementRules";
import { roomGizmo } from "./BuilderRoomEditing";
import { rotatedLocalPoints, triangulatePolygon } from "./BuilderRoomShape";
import { ceilingPreviewPlaneRotation } from "./BuilderPreviewPlaneRotation";
import { previewPlanYawToThreeYaw, previewRoomWallSegments } from "./BuilderPreviewWallSegments";
import type { BuilderDoor, BuilderProject, BuilderPuzzleHostPick, BuilderPuzzleInstance, BuilderRoom, BuilderRouteSwitchOutput, BuilderSelection, BuilderWallDoorSwitch } from "./BuilderTypes";
import { effectiveWallDoorSwitchStates } from "./BuilderWallDoorSwitches";
import { sharedEdge } from "./compileBuilderProjectToLevel";
import { useBuilderSelection, type BuilderFocusRequest } from "./BuilderSelectionContext";
import { buildSemanticGraph } from "./builderDependencyGraph";
import { BuilderSemanticOverlay } from "./preview3d/BuilderSemanticOverlay";
import { cachedBuilderPhotoTexture, loadBuilderPhotoTexture } from "./BuilderPhotoTextureCache";

const doorLockColors: Record<BuilderDoor["lockType"], string> = {
  none: "#76b7e8",
  key_item: "#ffd24f",
  survive_wave: "#ff7a5c",
  puzzle_complete: "#b47aff",
  switch_state: "#7bb7ff",
};

type CameraPresetMode = "home" | "top" | "angled" | "spawn" | "exit";

/**
 * Diorama "home" framing: a 3/4 view that fits every room with comfortable
 * padding, so /build opens on the whole miniature instead of inside a prop.
 */
function homeView(focus: SceneFocus): { position: [number, number, number]; target: [number, number, number] } {
  // ~40° elevation, 40° azimuth — readable floors and wall silhouettes.
  const direction = { x: 0.54, y: 0.58, z: 0.62 };
  const distance = Math.min(96, Math.max(16, focus.span * 0.78 + 6));
  return {
    position: [focus.x + direction.x * distance, direction.y * distance, focus.z + direction.z * distance],
    target: [focus.x, 0, focus.z],
  };
}

/**
 * Minimal OrbitControls surface used by the camera rigs. Accessed via an
 * explicit ref instead of r3f's `state.controls` — the makeDefault
 * registration can lag/flake under StrictMode, silently disabling presets
 * and keyboard panning.
 */
interface ControlsLike {
  target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  update: () => void;
}

type ControlsRef = MutableRefObject<ControlsLike | null>;

interface BuilderPreview3DProps {
  project: BuilderProject;
  selection: BuilderSelection;
  hovered: BuilderSelection;
  orderedPathRoomIds: readonly string[];
  resetToken: number;
  placement: PlacementDraft | null;
  brush: BuilderBrush | null;
  panMode: boolean;
  snapStep?: number;
  update: BuilderUpdate;
  onSelect: (selection: BuilderSelection) => void;
  onHover?: (selection: BuilderSelection) => void;
  onGestureStart: () => void;
  onPlace: (x: number, z: number, roomId: string) => void;
  onBrush: (roomId: string, shift: boolean) => void;
  onStatus?: (text: string) => void;
  /** Brush paint feedback (in-flight feature): accepted, visual TBD. */
  paintFlash?: BuilderPaintFlash | null;
  /** One-shot drop confirmation pulse at the last placement point. */
  placeFlash?: { x: number; z: number; token: number; color: string } | null;
  /** Stage cutaway: hide every ceiling regardless of per-room settings. */
  roofHidden?: boolean;
  /** Puzzle-bind mode: valid doors pulse and are the only click targets. */
  bindDoorMode?: boolean;
  /** Puzzle-host picking mode: furniture props become the only valid click targets. */
  hostPick?: BuilderPuzzleHostPick | null;
  /** Plain floor clicks may select rooms only while the room command/tool is active. */
  roomSelectionEnabled?: boolean;
  onPickPuzzleHost?: (propId: string) => void;
}

export function BuilderPreview3D({
  project,
  selection,
  hovered,
  orderedPathRoomIds,
  resetToken,
  placement,
  brush,
  panMode,
  snapStep,
  update,
  onSelect,
  onHover,
  onGestureStart,
  onPlace,
  onBrush,
  onStatus,
  paintFlash,
  placeFlash,
  roofHidden = false,
  bindDoorMode = false,
  hostPick = null,
  roomSelectionEnabled = false,
  onPickPuzzleHost,
}: BuilderPreview3DProps) {
  // Read chrome language ABOVE the <Canvas> and pass it down as a prop to every
  // in-canvas child + the editing hook — r3f's reconciler does not inherit React
  // context across the Canvas boundary.
  const { language } = useBuilderLanguage();
  const focus = useMemo(() => sceneFocus(project.rooms), [project.rooms]);
  // One shared profile drives preview lights/fog/shadow so the editor matches the
  // runtime presentation (BuilderVisualProfile reuses the same lighting source).
  const profile = useMemo(() => builderVisualProfile(project), [project]);
  const lighting = profile.lighting;
  const doorEdges = useMemo<DoorEdgeInfo[]>(() => {
    const edges: DoorEdgeInfo[] = [];
    for (const door of project.doors) {
      const fromRoom = project.rooms.find((room) => room.id === door.fromRoomId);
      const toRoom = project.rooms.find((room) => room.id === door.toRoomId);
      if (!fromRoom || !toRoom) continue;
      const edge = sharedEdge(fromRoom, toRoom);
      if (edge) edges.push({ id: door.id, fromRoomId: door.fromRoomId, toRoomId: door.toRoomId, x: edge.position[0], z: edge.position[2], yaw: edge.yaw });
    }
    return edges;
  }, [project.doors, project.rooms]);
  const editing = useBuilder3DEditing({
    project,
    placement,
    selection,
    brush,
    panMode,
    hostPick,
    roomSelectionEnabled,
    doorEdges,
    snapStep,
    language,
    update,
    onSelect,
    onHover,
    onPickPuzzleHost,
    onGestureStart,
    onPlace,
    onBrush,
    onStatus,
  });
  // Mount-time camera only: a fresh inline object would make R3F re-apply the
  // camera position on every project edit, snapping the user's view back.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialCamera = useMemo(
    () => ({
      position: homeView(focus).position,
      fov: 46,
      near: 0.1,
      far: 240,
    }),
    [],
  );
  const [preset, setPreset] = useState<{ mode: CameraPresetMode; token: number } | null>(null);
  const [cinematic, setCinematic] = useState(false);
  const controlsRef = useRef<ControlsLike | null>(null);

  // Shared semantic state (read above <Canvas>, passed in as props — r3f's
  // reconciler does not inherit React context across the Canvas boundary).
  const selectionCtx = useBuilderSelection();
  const overlayEnabled = selectionCtx?.overlayEnabled ?? false;
  const focusRequest = selectionCtx?.focusRequest ?? null;
  const semanticGraph = useMemo(() => buildSemanticGraph(project), [project]);

  // 重置视角 re-frames the whole diorama (the controls remount via key only
  // resets the target, not the camera position).
  const mountedResetRef = useRef(resetToken);
  useEffect(() => {
    if (mountedResetRef.current === resetToken) return;
    mountedResetRef.current = resetToken;
    setPreset({ mode: "home", token: Date.now() });
  }, [resetToken]);

  const stageCursor = editing.dragging
    ? "grabbing"
    : panMode
      ? "move"
      : placement || brush
        ? "crosshair"
        : editing.hoverPickKind
          ? "pointer"
          : "grab";

  const fogNear = focus.span * profile.preview.fogNearFactor;
  const fogFar = focus.span * profile.preview.fogFarFactor;
  const glow = profile.preview.glow;
  // Contact-shadow opacity is shared and AGE-capped (<=0.42) so every grounded
  // object (props, pickups, robots, consoles, switches) reads with the same
  // weight instead of ad-hoc per-component values.
  const shadowStrength = profile.preview.shadowStrength;
  const contactStrength = Math.min(0.42, shadowStrength);
  const stageBackdrop = {
    background: "#06100f",
    fog: profile.preview.fogColor,
    gridMajor: "#243d34",
    gridMinor: "#0e1714",
  } as const;

  return (
    <div className="builder-preview3d" style={{ cursor: stageCursor }} onPointerLeave={editing.clearHover}>
      <Canvas
        dpr={[1, 2]}
        camera={initialCamera}
        gl={{ antialias: true, powerPreference: "low-power", toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[stageBackdrop.background]} />
        <fog attach="fog" args={[stageBackdrop.fog, fogNear, fogFar]} />
        <ambientLight intensity={profile.preview.ambientIntensity} />
        <hemisphereLight intensity={profile.preview.hemisphereIntensity} color="#cfd6e2" groundColor="#231708" />
        <directionalLight position={[12, 18, 8]} color={lighting.keyColor} intensity={profile.preview.keyIntensity} />
        <directionalLight position={[-10, 9, -12]} color="#ffb066" intensity={profile.preview.warmFillIntensity} />
        <directionalLight position={[-14, 7, 12]} color="#9fb6d8" intensity={profile.preview.coolFillIntensity} />
        {/* Baked IBL — gives metallic floors/props something to reflect so they
            read as finished material instead of flat paint. background={false}
            keeps the tuned backdrop; frames={1} bakes the env once (cheap). The
            four Lightformers echo the warm-key / cool-fill / teal-accent mood. */}
        <Environment frames={1} resolution={128} background={false}>
          <Lightformer intensity={0.65} color="#ffd9a0" position={[0, 9, 3]} scale={[12, 10, 1]} />
          <Lightformer intensity={0.4} color="#8fb4ff" position={[-9, 5, -7]} scale={[9, 9, 1]} />
          <Lightformer intensity={0.26} color="#5ee8c8" position={[9, 4, 7]} scale={[7, 7, 1]} />
          <Lightformer form="ring" intensity={0.18} color="#ffffff" position={[0, 12, 0]} scale={[14, 14, 1]} />
        </Environment>
        <FacilityBackdrop focus={focus} />
        <gridHelper args={[64, 32, stageBackdrop.gridMajor, stageBackdrop.gridMinor]} position={[focus.x, -0.02, focus.z]} />

        <EditingGround api={editing} />
        {placement ? <PlacementGhost3D draft={placement} hover={editing.hover} /> : null}
        <CriticalPathGlow project={project} orderedPathRoomIds={orderedPathRoomIds} />

        {project.rooms.map((room, index) => (
          <RoomMesh
            key={room.id}
            room={room}
            doorEdges={doorEdges}
            isSpawn={index === 0}
            isExit={project.exitRoomId === room.id}
            exitAway={[room.center[0] - focus.x, room.center[1] - focus.z]}
            roofHidden={roofHidden}
            selected={selection?.kind === "room" && selection.id === room.id}
            hovered={hovered?.kind === "room" && hovered.id === room.id}
            glow={glow}
            brushPreview={brush && hovered?.kind === "room" && hovered.id === room.id ? brush : null}
          />
        ))}

        {paintFlash
          ? (() => {
              const room = project.rooms.find((candidate) => candidate.id === paintFlash.roomId);
              return room ? (
                <PaintPulse3D
                  key={paintFlash.token}
                  x={room.center[0]}
                  z={room.center[1]}
                  radius={Math.max(room.size[0], room.size[1]) / 2 + 0.2}
                  color={paintFlash.color}
                />
              ) : null;
            })()
          : null}
        {placeFlash ? <PaintPulse3D key={placeFlash.token} x={placeFlash.x} z={placeFlash.z} radius={1.05} color={placeFlash.color} /> : null}

        {selection?.kind === "room"
          ? (() => {
              const room = project.rooms.find((candidate) => candidate.id === selection.id);
              return room ? <RoomGizmo3D room={room} invalid={editing.roomGestureInvalid} /> : null;
            })()
          : null}

        {project.doors.map((door) => (
          <DoorMesh
            key={door.id}
            project={project}
            door={door}
            selected={selection?.kind === "door" && selection.id === door.id}
            hovered={hovered?.kind === "door" && hovered.id === door.id}
            bindTarget={bindDoorMode}
          />
        ))}

        <BuilderPickupMarkers project={project} selection={selection} hovered={hovered} shadowStrength={contactStrength} />

        {project.props.map((prop) => {
          const entry = propEntry(prop.modelKey);
          const selected = selection?.kind === "prop" && selection.id === prop.id;
          const isHovered = hovered?.kind === "prop" && hovered.id === prop.id;
          const hostPickActive = Boolean(hostPick);
          const footRadius = entry ? Math.hypot(entry.sizeMeters[0], entry.sizeMeters[2]) * prop.scale * 0.55 + 0.25 : 0.8;
          const room = project.rooms.find((candidate) => candidate.id === prop.roomId);
          const wallPlacement = entry?.mount === "wall" && room
            ? wallMountedPropPlacementForEntryFromPoint(room, prop.position[0], prop.position[1], {
                height: prop.elevation ?? defaultPropElevation(prop.modelKey),
                scale: prop.scale,
                sizeMeters: entry.sizeMeters,
                wallMountFace: entry.wallMountFace,
              })
            : null;
          const propPlan = wallPlacement?.plan ?? prop.position;
          const propRotationY = wallPlacement?.yaw ?? prop.rotationY;
          // Story-clue wall art reads as a real lit wall screen/picture frame
          // (emissive decal, live text stays in the right panel) — Image2 §1.2.
          const storyClue = entry?.group === "故事线索" && (isStoryPaintingArtModelKey(prop.modelKey) || isEnvironmentModelKey(prop.modelKey));
          return (
            <group key={prop.id} position={[propPlan[0], prop.elevation ?? defaultPropElevation(prop.modelKey), propPlan[1]]}>
              <ContactShadow spec={contactShadowSpec(Math.max(0.3, footRadius * 0.7), profile, "prop")} />
              {storyClue && entry && isStoryPaintingArtModelKey(prop.modelKey) ? (
                <group rotation={[0, propRotationY, 0]}>
                  <StoryPaintingArtPlane
                    modelKey={prop.modelKey}
                    width={Math.max(0.4, Math.min(1.38, entry.sizeMeters[0] * prop.scale * 0.78))}
                    height={Math.max(0.34, Math.min(1.08, entry.sizeMeters[1] * prop.scale * 0.72))}
                    accent="#ffce8a"
                    yOffset={Math.max(0.6, entry.sizeMeters[1] * prop.scale * 0.52)}
                    zOffset={Math.max(0.055, entry.sizeMeters[2] * prop.scale * 0.5 + 0.024)}
                  />
                </group>
              ) : isEnvironmentModelKey(prop.modelKey) && !isStoryPaintingArtModelKey(prop.modelKey) ? (
                <EnvironmentModelInstance
                  modelKey={prop.modelKey as EnvironmentModelKey}
                  rotation={[0, propRotationY, 0]}
                  scale={prop.scale}
                  castShadow={false}
                  receiveShadow={false}
                />
              ) : (
                <mesh position={[0, 0.3, 0]}>
                  <boxGeometry args={[0.6, 0.6, 0.6]} />
                  <meshStandardMaterial color="#3d4f6d" />
                </mesh>
              )}
              {storyClue && entry && !isStoryPaintingArtModelKey(prop.modelKey) ? (
                <group rotation={[0, propRotationY, 0]}>
                  <WallScreenDecal
                    width={Math.max(0.4, Math.min(1.3, entry.sizeMeters[0] * prop.scale * 0.82))}
                    height={Math.max(0.34, Math.min(1.0, entry.sizeMeters[1] * prop.scale * 0.7))}
                    accent="#ffce8a"
                    yOffset={Math.max(0.6, entry.sizeMeters[1] * prop.scale * 0.52)}
                    zOffset={Math.max(0.05, entry.sizeMeters[2] * prop.scale * 0.5 + 0.02)}
                  />
                </group>
              ) : null}
              {selected ? <PulsingRing radius={footRadius} color="#7ff2ff" /> : null}
              {hostPickActive ? <PulsingRing radius={footRadius} color={isHovered ? "#ffce8a" : "#5ee8c8"} /> : null}
              {isHovered && !selected ? <HoverGlow radius={footRadius} /> : null}
            </group>
          );
        })}

        <RobotMarkers project={project} selection={selection} hovered={hovered} shadowStrength={contactStrength} />
        <PuzzleConsoleMarkers project={project} selection={selection} hovered={hovered} doorEdges={doorEdges} profile={profile} />
        <RouteSwitchMarkers project={project} selection={selection} hovered={hovered} doorEdges={doorEdges} profile={profile} />
        <CameraRig preset={preset} focus={focus} project={project} controlsRef={controlsRef} />
        <CameraPanRig controlsRef={controlsRef} />
        <FocusRequestRig focusRequest={focusRequest} focus={focus} controlsRef={controlsRef} />
        {overlayEnabled ? <BuilderSemanticOverlay graph={semanticGraph} /> : null}
        <OrbitControls
          ref={controlsRef as unknown as Ref<never>}
          key={resetToken}
          makeDefault
          enabled={!editing.dragging}
          target={[focus.x, 0, focus.z]}
          maxPolarAngle={Math.PI * 0.49}
          minDistance={4}
          maxDistance={120}
          autoRotate={cinematic}
          autoRotateSpeed={0.7}
          enableDamping={false}
          mouseButtons={{ LEFT: panMode ? MOUSE.PAN : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
        />
        {/* Selective bloom — the high threshold means only the brightest emissive
            accents (selection rings, route switches, puzzle cores, additive
            glows) blow past it and bloom; the bulk lit surfaces stay as-is. Keep
            it subtle: intensity/threshold here are the dials if it feels strong. */}
        <EffectComposer enableNormalPass={false} multisampling={4}>
          <Bloom mipmapBlur intensity={0.34} luminanceThreshold={0.7} luminanceSmoothing={0.2} radius={0.7} />
        </EffectComposer>
      </Canvas>

      {selection?.kind === "room"
        ? (() => {
            const room = project.rooms.find((candidate) => candidate.id === selection.id);
            if (!room) return null;
            const style = roomStyleEntry(room.style);
            const floor = roomFloor(room);
            const wall = roomWall(room);
            const ceiling = roomCeiling(room);
            return (
              <span className="builder-stage-chip builder-room-hud" style={{ color: style.accentColor }} role="status">
                <i>▢</i>
                <strong>{bl(room.label, language)}</strong>
                <em>
                  {room.size[0]}×{room.size[1]}m · {bl(floor.preset.label, language)} / {bl(wall.preset.label, language)} ·{" "}
                  {ceiling.visible
                    ? language === "en"
                      ? `${bl(ceiling.preset.label, language)} ${ceiling.height.toFixed(1)}m`
                      : `${bl(ceiling.preset.label, language)} ${ceiling.height.toFixed(1)}m`
                    : language === "en"
                      ? "No ceiling"
                      : "无顶"}
                </em>
              </span>
            );
          })()
        : null}
      {placement && editing.hover && !editing.hover.valid ? (
        <span className="builder-stage-chip invalid" role="status">
          {language === "en" ? "✕ Doesn't fit here — move it inside a room's floor" : "✕ 这里放不下——移到房间地面内"}
        </span>
      ) : !placement && !brush && !editing.dragging && hovered ? (
        <StageHoverChip project={project} hovered={hovered} selected={Boolean(selection && hovered.kind === selection.kind && hovered.id === selection.id)} language={language} />
      ) : null}

      <div className="builder-preview3d-toolbar">
        {([
          ["home", language === "en" ? "⌂ Overview" : "⌂ 整体"],
          ["top", language === "en" ? "Top" : "顶视"],
          ["angled", language === "en" ? "Angle" : "斜视"],
          ["spawn", language === "en" ? "Spawn" : "出生"],
          ["exit", language === "en" ? "Exit" : "出口"],
        ] as const).map(([mode, label]) => (
          <button key={mode} type="button" onClick={() => setPreset({ mode, token: Date.now() })}>{label}</button>
        ))}
        <button type="button" className={cinematic ? "active" : ""} onClick={() => setCinematic((value) => !value)}>
          {cinematic ? (language === "en" ? "■ Cinema" : "■ 影院") : language === "en" ? "▶ Cinema" : "▶ 影院"}
        </button>
      </div>
      <span className="builder-preview3d-hint">
        {panMode
          ? language === "en"
            ? "Drag to pan · WASD / arrows · Shift to speed up"
            : "拖动平移 · WASD / 方向键 · Shift 加速"
          : language === "en"
            ? "Drag to orbit · scroll to zoom · right-drag to pan · WASD to pan"
            : "拖动旋转 · 滚轮缩放 · 右键平移 · WASD 平移"}
      </span>
    </div>
  );
}

/**
 * Small readable chip naming whatever the cursor touches — doors show their
 * lock type, robots their archetype + count. Makes hover feel deliberate
 * without giant 3D labels.
 */
function StageHoverChip({
  project,
  hovered,
  selected,
  language,
}: {
  project: BuilderProject;
  hovered: NonNullable<BuilderSelection>;
  selected: boolean;
  language: GameLanguage;
}) {
  const en = language === "en";
  let glyph = "▢";
  let label = "";
  let sub = selected ? (en ? "Selected" : "已选中") : en ? "Click to select" : "点击选中";
  let color = "#aac4e2";
  if (hovered.kind === "room") {
    const room = project.rooms.find((candidate) => candidate.id === hovered.id);
    if (!room) return null;
    label = bl(room.label, language);
    glyph = "▢";
    color = roomStyleEntry(room.style).accentColor;
    sub = selected ? (en ? "Drag to move · edge handles to resize" : "拖动移动 · 边把手拉伸") : en ? "Click to select room" : "点击选中房间";
  } else if (hovered.kind === "door") {
    const door = project.doors.find((candidate) => candidate.id === hovered.id);
    if (!door) return null;
    if (door.lockType === "puzzle_complete") {
      const entry = puzzleKindEntry(doorPuzzleKind(door));
      label = bl(builderDoorDisplayLabel(door, project), language);
      glyph = entry.glyph;
      color = entry.color;
      sub = selected ? `${en ? "Puzzle Door" : "谜题门"} · ${bl(entry.label, language)}` : en ? "Click to select puzzle door" : "点击选中谜题门";
    } else {
      label = bl(builderDoorDisplayLabel(door, project), language);
      glyph = door.lockType === "key_item" ? (en ? "K" : "钥") : door.lockType === "survive_wave" ? (en ? "F" : "战") : door.lockType === "switch_state" ? (en ? "S" : "控") : en ? "D" : "门";
      color = doorLockColors[door.lockType];
      sub = selected ? bl(builderLockLabels[door.lockType], language) : en ? "Click to select door" : "点击选中门";
    }
  } else if (hovered.kind === "prop") {
    const prop = project.props.find((candidate) => candidate.id === hovered.id);
    const entry = prop ? propEntry(prop.modelKey) : null;
    if (!prop) return null;
    const isStory = entry?.group === "故事线索";
    const propLabel = entry ? bl(entry.label, language) : prop.modelKey;
    label = isStory ? `${en ? "Story Clue" : "故事线索"} · ${propLabel}` : propLabel;
    glyph = isStory ? "🖼" : "❑";
    color = isStory ? "#ffce8a" : "#ffd9a0";
    sub = selected
      ? isStory
        ? en
          ? "Write the title & clue on the right"
          : "右侧可写标题与线索"
        : en
          ? "Drag to move · R to rotate"
          : "拖动移动 · R 旋转"
      : isStory
        ? en
          ? "Click to select story artwork"
          : "点击选中故事画作"
        : en
          ? "Click to select furniture"
          : "点击选中家具";
  } else if (hovered.kind === "puzzle") {
    const instance = puzzleInstances(project).find((candidate) => candidate.id === hovered.id);
    if (!instance) return null;
    const entry = puzzleKindEntry(instance.kind);
    const component = hovered.componentId ? instance.components?.find((candidate) => candidate.id === hovered.componentId) : null;
    label = component
      ? `${bl(entry.label, language)} · ${en ? "Orb" : "色球"}`
      : `${bl(entry.label, language)} · ${en ? "Puzzle Console" : "谜题台"}`;
    glyph = entry.glyph;
    color = component ? orbColorHex(component.role) : entry.color;
    sub = selected
      ? en
        ? "Drag to place · change binding on the right"
        : "拖动摆放 · 右侧改绑定"
      : component
        ? en
          ? "Click to select orb"
          : "点击选中色球"
        : en
          ? "Click to select puzzle console"
          : "点击选中谜题台";
  } else if (hovered.kind === "pickup") {
    const pickup = (project.pickups ?? []).find((candidate) => candidate.id === hovered.id);
    if (!pickup) return null;
    const entry = pickupEntry(pickup.kind);
    label = bl(entry.label, language);
    glyph = entry.glyph;
    color = entry.color;
    sub = selected ? (en ? "Drag to place · change binding on the right" : "拖动摆放 · 右侧改绑定") : en ? "Click to select pickup" : "点击选中拾取物";
  } else if (hovered.kind === "wallDoorSwitch") {
    const wallSwitch = project.wallDoorSwitches?.find((candidate) => candidate.id === hovered.id);
    if (!wallSwitch) return null;
    label = wallSwitch.label || (en ? "Wall Door Switch" : "墙面门控把手");
    glyph = en ? "W" : "控";
    color = "#7bb7ff";
    sub = selected ? (en ? "Drag along a wall · edit states on the right" : "沿墙拖动 · 右侧改状态") : en ? "Click to select wall switch" : "点击选中墙面门控";
  } else {
    const robot = project.robots.find((candidate) => candidate.id === hovered.id);
    if (!robot) return null;
    label = `${bl(robotLabel(robot.archetype), language)} ×${robot.count}`;
    glyph = "◆";
    color = robot.tier === "elite" || robot.archetype === "custodian_elite" ? "#ff4f8c" : "#ff7a5c";
    sub = selected ? (en ? "Drag to adjust the spawn point" : "拖动调整出怪点") : en ? "Click to select enemy" : "点击选中敌人";
  }
  return (
    <span className="builder-stage-chip" style={{ color }} role="status">
      <i>{glyph}</i>
      <strong>{label}</strong>
      <em>{sub}</em>
    </span>
  );
}

/**
 * WASD / arrow-key camera panning on the ground plane. Shift = 3× speed.
 * Ignores key events while a form field has focus.
 */
function CameraPanRig({ controlsRef }: { controlsRef: ControlsRef }) {
  const camera = useThree((state) => state.camera);
  const keysRef = useRef<Set<string>>(new Set());
  const shiftRef = useRef(false);

  useEffect(() => {
    const normalize = (key: string): string | null => {
      const lower = key.toLowerCase();
      if (lower === "w" || lower === "arrowup") return "up";
      if (lower === "s" || lower === "arrowdown") return "down";
      if (lower === "a" || lower === "arrowleft") return "left";
      if (lower === "d" || lower === "arrowright") return "right";
      return null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      shiftRef.current = event.shiftKey;
      const key = normalize(event.key);
      if (!key) return;
      if (event.key.startsWith("Arrow")) event.preventDefault();
      keysRef.current.add(key);
      (window as unknown as { __qa3d?: unknown[][] }).__qa3d?.push(["pan-key", key]);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      shiftRef.current = event.shiftKey;
      const key = normalize(event.key);
      if (key) keysRef.current.delete(key);
    };
    const onBlur = () => {
      keysRef.current.clear();
      shiftRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    const controls = controlsRef.current;
    if (keys.size === 0 || !controls) return;
    // Pan along the camera's plan-space axes; speed scales with camera distance.
    let fx = controls.target.x - camera.position.x;
    let fz = controls.target.z - camera.position.z;
    const length = Math.hypot(fx, fz) || 1;
    fx /= length;
    fz /= length;
    const rx = -fz;
    const rz = fx;
    const distance = Math.hypot(camera.position.x - controls.target.x, camera.position.y, camera.position.z - controls.target.z);
    const speed = Math.max(8, distance * 0.55) * (shiftRef.current ? 3 : 1) * Math.min(delta, 0.05);
    let dx = 0;
    let dz = 0;
    if (keys.has("up")) {
      dx += fx * speed;
      dz += fz * speed;
    }
    if (keys.has("down")) {
      dx -= fx * speed;
      dz -= fz * speed;
    }
    if (keys.has("right")) {
      dx += rx * speed;
      dz += rz * speed;
    }
    if (keys.has("left")) {
      dx -= rx * speed;
      dz -= rz * speed;
    }
    if (dx === 0 && dz === 0) return;
    camera.position.x += dx;
    camera.position.z += dz;
    controls.target.set(controls.target.x + dx, controls.target.y, controls.target.z + dz);
    controls.update();
    const qa = window as unknown as { __qa3d?: unknown[][]; __qa3dCam?: [number, number] };
    if (qa.__qa3d) qa.__qa3dCam = [controls.target.x, controls.target.z];
  });
  return null;
}

/** Move arrows + edge resize handles + planar pad for the selected room. */
function RoomGizmo3D({ room, invalid }: { room: BuilderRoom; invalid: boolean }) {
  const [cx, cz] = room.center;
  const [w, d] = room.size;
  const x1 = cx + w / 2;
  const z1 = cz + d / 2;
  const xColor = invalid ? "#ff2e1f" : "#ff6a55";
  const zColor = invalid ? "#ff2e1f" : "#4f8cff";
  const padColor = invalid ? "#ff2e1f" : "#7ff2ff";
  const arrowMid = (roomGizmo.arrowStart + roomGizmo.arrowEnd) / 2;
  const arrowLength = roomGizmo.arrowEnd - roomGizmo.arrowStart - 0.45;
  const y = 0.12;

  return (
    <group>
      {/* planar move pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.06, cz]}>
        <ringGeometry args={[roomGizmo.padRadius - 0.16, roomGizmo.padRadius, 36]} />
        <meshBasicMaterial color={padColor} transparent opacity={0.9} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.055, cz]}>
        <circleGeometry args={[roomGizmo.padRadius - 0.2, 28]} />
        <meshBasicMaterial color={padColor} transparent opacity={0.14} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* +X axis arrow */}
      <group position={[x1 + arrowMid, y, cz]}>
        <mesh rotation={[0, 0, -Math.PI / 2]} position={[-0.25, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, arrowLength, 8]} />
          <meshBasicMaterial color={xColor} toneMapped={false} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 2]} position={[arrowLength / 2 + 0.02, 0, 0]}>
          <coneGeometry args={[0.2, 0.46, 10]} />
          <meshBasicMaterial color={xColor} toneMapped={false} />
        </mesh>
      </group>
      {/* +Z axis arrow */}
      <group position={[cx, y, z1 + arrowMid]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.25]}>
          <cylinderGeometry args={[0.06, 0.06, arrowLength, 8]} />
          <meshBasicMaterial color={zColor} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, arrowLength / 2 + 0.02]}>
          <coneGeometry args={[0.2, 0.46, 10]} />
          <meshBasicMaterial color={zColor} toneMapped={false} />
        </mesh>
      </group>
      {/* wall-edge resize handles */}
      {([
        [cx, cz - d / 2],
        [cx, cz + d / 2],
        [cx - w / 2, cz],
        [cx + w / 2, cz],
      ] as const).map(([hx, hz], index) => (
        <group key={index} position={[hx, y, hz]}>
          <mesh>
            <boxGeometry args={[0.42, 0.16, 0.42]} />
            <meshBasicMaterial color={invalid ? "#ff2e1f" : "#0b101a"} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.5]} />
            <meshBasicMaterial color={padColor} transparent opacity={0.95} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CameraRig({
  preset,
  focus,
  project,
  controlsRef,
}: {
  preset: { mode: CameraPresetMode; token: number } | null;
  focus: SceneFocus;
  project: BuilderProject;
  controlsRef: ControlsRef;
}) {
  const camera = useThree((state) => state.camera);
  const applied = useRef(0);

  useFrame(() => {
    const controls = controlsRef.current;
    const qa = window as unknown as { __qa3d?: unknown[][]; __qa3dRig?: string };
    if (qa.__qa3d) qa.__qa3dRig = `preset=${preset?.mode ?? "none"} token=${preset?.token ?? 0} applied=${applied.current} controls=${Boolean(controls)}`;
    if (!preset || preset.token === applied.current || !controls) return;
    applied.current = preset.token;
    const spawnRoom = project.rooms[0];
    const exitRoom = project.rooms.find((room) => room.id === project.exitRoomId);
    const home = homeView(focus);
    let target: [number, number, number] = home.target;
    let position: [number, number, number] = home.position;
    if (preset.mode === "top") {
      position = [focus.x, focus.span * 1.35, focus.z + 0.01];
    } else if (preset.mode === "angled") {
      // Lower, closer cinematic angle than home — for admiring, not overview.
      const distance = Math.min(90, Math.max(14, focus.span * 0.7 + 5));
      position = [focus.x + 0.72 * distance, 0.4 * distance, focus.z + 0.62 * distance];
    } else if (preset.mode === "spawn" && spawnRoom) {
      // Keep neighbouring rooms in frame: never closer than ~a third of the layout.
      const reach = Math.max(Math.max(spawnRoom.size[0], spawnRoom.size[1]), focus.span * 0.34);
      target = [spawnRoom.center[0], 0, spawnRoom.center[1]];
      position = [spawnRoom.center[0] + reach * 0.7, reach * 0.95, spawnRoom.center[1] + reach * 1.05];
    } else if (preset.mode === "exit" && exitRoom) {
      const reach = Math.max(Math.max(exitRoom.size[0], exitRoom.size[1]), focus.span * 0.34);
      target = [exitRoom.center[0], 0, exitRoom.center[1]];
      position = [exitRoom.center[0] + reach * 0.7, reach * 0.95, exitRoom.center[1] + reach * 1.05];
    }
    camera.position.set(position[0], position[1], position[2]);
    controls.target.set(target[0], target[1], target[2]);
    controls.update();
  });
  return null;
}

function FacilityBackdrop({ focus }: { focus: SceneFocus }) {
  const span = Math.max(24, focus.span);
  const deckSize = span * 2.25;
  const shellHalf = span * 0.92;
  const wallWidth = span * 1.78;
  const wallHeight = Math.min(18, Math.max(9.5, span * 0.38));
  const wallY = wallHeight / 2 - 0.08;
  const ribCount = 9;
  const ribStep = wallWidth / (ribCount - 1);
  const railYs = [0.26, 0.46, 0.67];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[focus.x, -0.04, focus.z]} renderOrder={-20}>
        <planeGeometry args={[deckSize, deckSize]} />
        <meshBasicMaterial color="#03100e" transparent opacity={0.54} depthWrite={false} />
      </mesh>

      <FacilityWall x={focus.x} z={focus.z - shellHalf} width={wallWidth} height={wallHeight} y={wallY} opacity={0.3} />
      <FacilityWall x={focus.x} z={focus.z + shellHalf} width={wallWidth} height={wallHeight} y={wallY} opacity={0.12} />
      <FacilityWall x={focus.x - shellHalf} z={focus.z} width={wallWidth} height={wallHeight} y={wallY} rotationY={Math.PI / 2} opacity={0.16} />
      <FacilityWall x={focus.x + shellHalf} z={focus.z} width={wallWidth} height={wallHeight} y={wallY} rotationY={Math.PI / 2} opacity={0.16} />

      {Array.from({ length: ribCount }, (_, index) => {
        const x = focus.x - wallWidth / 2 + ribStep * index;
        return (
          <mesh key={`north-rib-${index}`} position={[x, wallY, focus.z - shellHalf - 0.035]} renderOrder={-15}>
            <boxGeometry args={[0.035, wallHeight * 0.82, 0.035]} />
            <meshBasicMaterial color="#45655d" transparent opacity={index % 2 === 0 ? 0.16 : 0.09} depthWrite={false} toneMapped={false} />
          </mesh>
        );
      })}

      {railYs.map((ratio, index) => (
        <mesh key={`north-rail-${index}`} position={[focus.x, wallHeight * ratio, focus.z - shellHalf - 0.055]} renderOrder={-14}>
          <boxGeometry args={[wallWidth * (0.9 - index * 0.07), 0.028, 0.04]} />
          <meshBasicMaterial color={index === 1 ? "#7ff2ff" : "#d8b86a"} transparent opacity={index === 1 ? 0.07 : 0.045} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function FacilityWall({
  x,
  z,
  width,
  height,
  y,
  rotationY = 0,
  opacity,
}: {
  x: number;
  z: number;
  width: number;
  height: number;
  y: number;
  rotationY?: number;
  opacity: number;
}) {
  return (
    <mesh position={[x, y, z]} rotation={[0, rotationY, 0]} renderOrder={-16}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color="#071815" transparent opacity={opacity} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

/**
 * Flies the camera to a plan-space point when the shared `focusRequest` token
 * changes (blueprint room hover/click → 3D focus). A parallel, additive rig so
 * the existing preset enum keeps working untouched. Frames from the same
 * over-the-shoulder angle as the spawn/exit presets, never closer than ~a third
 * of the layout so neighbouring rooms stay in shot.
 */
function FocusRequestRig({
  focusRequest,
  focus,
  controlsRef,
}: {
  focusRequest: BuilderFocusRequest | null;
  focus: SceneFocus;
  controlsRef: ControlsRef;
}) {
  const camera = useThree((state) => state.camera);
  const applied = useRef(0);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!focusRequest || !controls || focusRequest.token === applied.current) return;
    applied.current = focusRequest.token;
    const reach = Math.max(focusRequest.span ?? focus.span * 0.4, focus.span * 0.34);
    camera.position.set(focusRequest.x + reach * 0.7, reach * 0.95, focusRequest.z + reach * 1.05);
    controls.target.set(focusRequest.x, 0, focusRequest.z);
    controls.update();
  });
  return null;
}

function CriticalPathGlow({ project, orderedPathRoomIds }: { project: BuilderProject; orderedPathRoomIds: readonly string[] }) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  const segments = useMemo(() => {
    const centers = orderedPathRoomIds
      .map((roomId) => project.rooms.find((room) => room.id === roomId))
      .filter((room): room is BuilderRoom => Boolean(room))
      .map((room) => room.center);
    const result: { x: number; z: number; length: number; angle: number }[] = [];
    for (let index = 0; index < centers.length - 1; index += 1) {
      const [x0, z0] = centers[index];
      const [x1, z1] = centers[index + 1];
      result.push({
        x: (x0 + x1) / 2,
        z: (z0 + z1) / 2,
        length: Math.hypot(x1 - x0, z1 - z0),
        angle: Math.atan2(x1 - x0, z1 - z0),
      });
    }
    return result;
  }, [orderedPathRoomIds, project.rooms]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2.4) * 0.16;
    }
  });

  if (segments.length === 0) return null;
  return (
    <group>
      {segments.map((segment, index) => (
        <mesh key={index} position={[segment.x, 0.05, segment.z]} rotation={[0, segment.angle, 0]}>
          <boxGeometry args={[0.55, 0.04, segment.length]} />
          {index === 0 ? (
            <meshBasicMaterial ref={materialRef} color="#7ff2ff" transparent opacity={0.4} toneMapped={false} depthWrite={false} />
          ) : (
            <meshBasicMaterial color="#7ff2ff" transparent opacity={0.3} toneMapped={false} depthWrite={false} />
          )}
        </mesh>
      ))}
    </group>
  );
}

/**
 * Loads a CC0 photo texture without suspending (so it needs no Suspense
 * boundary). Returns a fresh Texture per call so per-room tiling never clashes.
 */
function usePhotoTexture(url: string | undefined, srgb: boolean): Texture | null {
  const [tex, setTex] = useState<Texture | null>(() => cachedBuilderPhotoTexture(url, srgb));
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let active = true;
    setTex(cachedBuilderPhotoTexture(url, srgb));
    void loadBuilderPhotoTexture(url, srgb).then((loaded) => {
      if (active) setTex(loaded);
    });
    return () => {
      active = false;
    };
  }, [url, srgb]);
  return tex;
}

/** meshStandardMaterial backed by photo PBR maps, tiled to the given repeat. */
function PhotoMaterial({
  map,
  normal,
  rough,
  repeatX,
  repeatY,
  roughness,
  fallbackColor,
  transparent = false,
  opacity = 1,
  side,
  depthWrite = true,
}: {
  map: Texture | null;
  normal: Texture | null;
  rough: Texture | null;
  repeatX: number;
  repeatY: number;
  roughness: number;
  fallbackColor: string;
  transparent?: boolean;
  opacity?: number;
  side?: Side;
  depthWrite?: boolean;
}) {
  const cloned = useMemo(() => {
    const tile = (t: Texture | null) => {
      if (!t) return null;
      const c = t.clone();
      c.wrapS = RepeatWrapping;
      c.wrapT = RepeatWrapping;
      c.repeat.set(Math.max(0.25, repeatX), Math.max(0.25, repeatY));
      c.needsUpdate = true;
      return c;
    };
    return { map: tile(map), normalMap: tile(normal), roughnessMap: tile(rough) };
  }, [map, normal, rough, repeatX, repeatY]);
  return (
    <meshStandardMaterial
      map={cloned.map ?? undefined}
      normalMap={cloned.normalMap ?? undefined}
      roughnessMap={cloned.roughnessMap ?? undefined}
      color={cloned.map ? "#ffffff" : fallbackColor}
      roughness={roughness}
      metalness={0.04}
      transparent={transparent}
      opacity={opacity}
      side={side}
      depthWrite={depthWrite}
    />
  );
}

/** Direct XZ geometry for shaped room floors/ceilings; avoids ShapeGeometry axis flips. */
function footprintGeometry(localPoints: readonly (readonly [number, number])[], faceUp: boolean) {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of localPoints) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const spanX = Math.max(0.001, maxX - minX);
  const spanZ = Math.max(0.001, maxZ - minZ);
  for (const [x, z] of localPoints) {
    positions.push(x, 0, z);
    uvs.push((x - minX) / spanX, (z - minZ) / spanZ);
  }
  const indices: number[] = [];
  for (const [a, b, c] of triangulatePolygon(localPoints)) {
    indices.push(...(faceUp ? [a, c, b] : [a, b, c]));
  }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function RoomMesh({
  room,
  doorEdges,
  isSpawn,
  isExit,
  exitAway,
  roofHidden,
  selected,
  hovered,
  glow,
  brushPreview,
}: {
  room: BuilderRoom;
  doorEdges: DoorEdgeInfo[];
  isSpawn: boolean;
  isExit: boolean;
  /** Room centre relative to the layout centre — the exit gate mounts on the outward wall. */
  exitAway: readonly [number, number];
  /** Stage cutaway override: never render this room's ceiling. */
  roofHidden: boolean;
  selected: boolean;
  hovered: boolean;
  glow: number;
  /** Armed brush while this room is hovered: preview its material before the click. */
  brushPreview: BuilderBrush | null;
}) {
  const style = roomStyleEntry(room.style);
  const floor = roomFloor(room);
  const wall = roomWall(room);
  const ceiling = roomCeiling(room);
  const [w, d] = room.size;
  const [cx, cz] = room.center;
  const wallHeight = wall.height;

  // Brush hover preview: swap the previewed surface to the armed preset.
  const previewPreset = brushPreview ? brushPreset(brushPreview) : null;
  const floorPreview = brushPreview?.kind === "floor" && previewPreset ? previewPreset : null;
  const wallPreview = brushPreview?.kind === "wall" && previewPreset ? previewPreset : null;
  const ceilingPreview = brushPreview?.kind === "ceiling" && previewPreset ? previewPreset : null;

  // Exit room mirrors the old Level 3 闭馆电梯 lobby: brushed service-elevator
  // steel walls + dark metal floor (matches the playtest runtime pack), unless
  // the author is actively brushing a different surface onto it.
  const shownFloorPreset: BuilderSurfacePreset = floorPreview ?? floor.preset;
  const shownFloorColor = floorPreview ? floorPreview.color : isExit ? "#1b2228" : floor.color;
  const floorTexture = floorSurfaceTexture(shownFloorPreset, shownFloorColor, floor.scale, floor.rotation, w - 0.5, d - 0.5);
  const shownWallPreset: BuilderSurfacePreset = wallPreview ?? wall.preset;
  const shownWallColor = wallPreview ? wallPreview.color : isExit ? "#2c343c" : wall.color;
  const shownCeilingPreset: BuilderSurfacePreset = ceilingPreview ?? ceiling.preset;
  const shownCeilingColor = ceilingPreview ? ceilingPreview.color : ceiling.color;
  const roomDoorEdges = useMemo(
    () => doorEdges.filter((door) => !door.fromRoomId || door.fromRoomId === room.id || door.toRoomId === room.id),
    [doorEdges, room.id],
  );

  const walls = useMemo(() => previewRoomWallSegments(room, roomDoorEdges), [room, roomDoorEdges]);

  const localPoints = useMemo(() => (room.shape ? rotatedLocalPoints(room.shape) : null), [room.shape]);
  const floorGeometry = useMemo(() => (localPoints ? footprintGeometry(localPoints, true) : null), [localPoints]);
  const ceilingGeometry = useMemo(() => (localPoints ? footprintGeometry(localPoints, false) : null), [localPoints]);
  const ceilingRotation = ceilingPreviewPlaneRotation(Boolean(ceilingGeometry));

  // Photo PBR maps (CC0) when the effective floor/wall/ceiling preset carries them.
  const floorTexScale = shownFloorPreset.textureScale ?? 2;
  const wallTexScale = shownWallPreset.textureScale ?? 2;
  const ceilingTexScale = shownCeilingPreset.textureScale ?? 2;
  const floorPhotoMap = usePhotoTexture(shownFloorPreset.albedoUrl, true);
  const floorPhotoNormal = usePhotoTexture(shownFloorPreset.normalUrl, false);
  const floorPhotoRough = usePhotoTexture(shownFloorPreset.roughUrl, false);
  const wallPhotoMap = usePhotoTexture(shownWallPreset.albedoUrl, true);
  const wallPhotoNormal = usePhotoTexture(shownWallPreset.normalUrl, false);
  const wallPhotoRough = usePhotoTexture(shownWallPreset.roughUrl, false);
  const ceilingPhotoMap = usePhotoTexture(shownCeilingPreset.albedoUrl, true);
  const ceilingPhotoNormal = usePhotoTexture(shownCeilingPreset.normalUrl, false);
  const ceilingPhotoRough = usePhotoTexture(shownCeilingPreset.roughUrl, false);
  const floorHasPhoto = Boolean(floorPhotoMap);
  const wallHasPhoto = Boolean(wallPhotoMap);
  const ceilingHasPhoto = Boolean(ceilingPhotoMap);

  return (
    <group>
      {/* floor slab + painted surface + border trim */}
      <group position={[cx, 0, cz]}>
        {floorGeometry ? (
          <>
            {/* shaped footprint: flat polygon base + floor (painted textures are rect-only) */}
            <mesh geometry={floorGeometry} position={[0, -0.02, 0]}>
              <meshStandardMaterial color={isExit ? "#1c2a22" : "#131b29"} roughness={0.9} side={DoubleSide} />
            </mesh>
            <mesh geometry={floorGeometry} position={[0, 0.004, 0]}>
              {floorHasPhoto ? (
                <PhotoMaterial map={floorPhotoMap} normal={floorPhotoNormal} rough={floorPhotoRough} repeatX={1 / floorTexScale} repeatY={1 / floorTexScale} roughness={shownFloorPreset.roughness} fallbackColor={shownFloorColor} />
              ) : (
                <meshStandardMaterial
                  color={shownFloorColor}
                  roughness={shownFloorPreset.roughness}
                  metalness={shownFloorPreset.pattern === "metal" ? 0.3 : 0.04}
                  emissive={floorPreview ? floorPreview.accent : shownFloorColor}
                  emissiveIntensity={floorPreview ? 0.2 : 0.32}
                  side={DoubleSide}
                />
              )}
            </mesh>
            {!brushPreview ? (
              <mesh geometry={floorGeometry} position={[0, 0.007, 0]}>
                <meshBasicMaterial color={style.accentColor} transparent opacity={selected || hovered ? 0.11 : 0.07} toneMapped={false} depthWrite={false} side={DoubleSide} />
              </mesh>
            ) : null}
            {(hovered || selected) && !brushPreview ? (
              <mesh geometry={floorGeometry} position={[0, 0.008, 0]}>
                <meshBasicMaterial color={style.accentColor} transparent opacity={selected ? 0.1 : 0.06} toneMapped={false} depthWrite={false} side={DoubleSide} />
              </mesh>
            ) : null}
          </>
        ) : (
          <>
        <mesh position={[0, -0.09, 0]}>
          <boxGeometry args={[w + 0.12, 0.18, d + 0.12]} />
          <meshStandardMaterial color={isExit ? "#1c2a22" : "#131b29"} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w - 0.5, d - 0.5]} />
          {/* Photo PBR when the preset has it, else the self-lit procedural lift. */}
          {floorHasPhoto ? (
            <PhotoMaterial map={floorPhotoMap} normal={floorPhotoNormal} rough={floorPhotoRough} repeatX={(w - 0.5) / floorTexScale} repeatY={(d - 0.5) / floorTexScale} roughness={shownFloorPreset.roughness} fallbackColor={shownFloorColor} />
          ) : (
            <meshStandardMaterial
              map={floorTexture ?? undefined}
              emissiveMap={floorTexture ?? undefined}
              color={floorTexture ? "#ffffff" : shownFloorColor}
              roughness={shownFloorPreset.roughness}
              metalness={shownFloorPreset.pattern === "metal" ? 0.3 : 0.04}
              emissive={floorPreview ? floorPreview.accent : floorTexture ? "#ffffff" : shownFloorColor}
              emissiveIntensity={floorPreview ? 0.2 : 0.34}
            />
          )}
        </mesh>
        {/* hover/selected accent wash on top of the painted floor (suppressed while brushing) */}
        {(hovered || selected) && !brushPreview ? (
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w - 0.5, d - 0.5]} />
            <meshBasicMaterial color={style.accentColor} transparent opacity={selected ? 0.1 : 0.06} toneMapped={false} depthWrite={false} />
          </mesh>
        ) : null}
        {/* skirting trim frame */}
        {[
          { p: [0, 0.012, -d / 2 + 0.42] as const, s: [w - 1, 0.012, 0.07] as const },
          { p: [0, 0.012, d / 2 - 0.42] as const, s: [w - 1, 0.012, 0.07] as const },
          { p: [-w / 2 + 0.42, 0.012, 0] as const, s: [0.07, 0.012, d - 1] as const },
          { p: [w / 2 - 0.42, 0.012, 0] as const, s: [0.07, 0.012, d - 1] as const },
        ].map((trim, index) => (
          <mesh key={index} position={[trim.p[0], trim.p[1], trim.p[2]]}>
            <boxGeometry args={[trim.s[0], trim.s[1], trim.s[2]]} />
            <meshBasicMaterial color={floor.preset.accent} transparent opacity={Math.min(0.6, 0.18 + glow * 0.18)} toneMapped={false} />
          </mesh>
        ))}
          </>
        )}
        {/* ceiling: semi-transparent so the room stays readable; hidden while selected or in cutaway view */}
        {ceiling.visible && !selected && !roofHidden ? (
          <mesh geometry={ceilingGeometry ?? undefined} position={[0, ceiling.height, 0]} rotation={ceilingRotation}>
            {ceilingGeometry ? null : <planeGeometry args={[w - 0.2, d - 0.2]} />}
            {ceilingHasPhoto ? (
              <PhotoMaterial
                map={ceilingPhotoMap}
                normal={ceilingPhotoNormal}
                rough={ceilingPhotoRough}
                repeatX={ceilingGeometry ? 1 / ceilingTexScale : (w - 0.2) / ceilingTexScale}
                repeatY={ceilingGeometry ? 1 / ceilingTexScale : (d - 0.2) / ceilingTexScale}
                roughness={shownCeilingPreset.roughness}
                fallbackColor={shownCeilingColor}
                transparent
                opacity={0.48}
                side={DoubleSide}
                depthWrite={false}
              />
            ) : (
              <meshStandardMaterial
                color={shownCeilingColor}
                transparent
                opacity={0.34}
                side={DoubleSide}
                depthWrite={false}
                roughness={shownCeilingPreset.roughness}
              />
            )}
          </mesh>
        ) : null}
        {/* ceiling-brush hover preview: paint the armed ceiling material across the room. */}
        {ceilingPreview ? (
          <mesh geometry={ceilingGeometry ?? undefined} position={[0, ceiling.height + 0.04, 0]} rotation={ceilingRotation}>
            {ceilingGeometry ? null : <planeGeometry args={[w - 0.2, d - 0.2]} />}
            {ceilingHasPhoto ? (
              <PhotoMaterial
                map={ceilingPhotoMap}
                normal={ceilingPhotoNormal}
                rough={ceilingPhotoRough}
                repeatX={ceilingGeometry ? 1 / ceilingTexScale : (w - 0.2) / ceilingTexScale}
                repeatY={ceilingGeometry ? 1 / ceilingTexScale : (d - 0.2) / ceilingTexScale}
                roughness={ceilingPreview.roughness}
                fallbackColor={ceilingPreview.color}
                transparent
                opacity={0.58}
                side={DoubleSide}
                depthWrite={false}
              />
            ) : (
              <meshBasicMaterial
                color={ceilingPreview.accent}
                transparent
                opacity={0.32}
                side={DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            )}
          </mesh>
        ) : null}
        {isSpawn ? <Beacon color="#7ff2ff" tall pulse /> : null}
        {isExit ? <ExitElevatorMount room={room} accent={style.accentColor} away={exitAway} /> : null}
        {selected ? <PulsingRing radius={Math.max(w, d) / 2 + 0.3} color="#7ff2ff" /> : null}
        {hovered && !selected && !brushPreview ? <SelectionRing radius={Math.max(w, d) / 2 + 0.3} color="#ffffff" opacity={0.25} /> : null}
        {brushPreview && !wallPreview ? (
          <SelectionRing radius={Math.max(w, d) / 2 + 0.3} color={previewPreset?.accent ?? "#aac4e2"} opacity={0.6} />
        ) : null}
      </group>
      {/* solid walls with real door openings + glowing top edge */}
      <group position={[cx, 0, cz]}>
        {walls.map((segment, index) => {
          const segmentLength = Math.max(segment.sx, segment.sz);
          const wallTexture = wallSurfaceTexture(shownWallPreset, shownWallColor, segmentLength, wallHeight);
          return (
            <group key={index} position={[segment.x, 0, segment.z]} rotation={[0, previewPlanYawToThreeYaw(segment.yaw ?? 0), 0]}>
              <mesh position={[0, wallHeight / 2, 0]}>
                <boxGeometry args={[segment.sx, wallHeight, segment.sz]} />
                {wallHasPhoto ? (
                  <PhotoMaterial map={wallPhotoMap} normal={wallPhotoNormal} rough={wallPhotoRough} repeatX={segmentLength / wallTexScale} repeatY={wallHeight / wallTexScale} roughness={shownWallPreset.roughness} fallbackColor={shownWallColor} />
                ) : (
                  <meshStandardMaterial
                    map={wallTexture ?? undefined}
                    emissiveMap={wallTexture ?? undefined}
                    color={wallTexture ? "#ffffff" : shownWallColor}
                    roughness={shownWallPreset.roughness}
                    metalness={shownWallPreset.pattern === "metal" ? 0.25 : 0.03}
                    emissive={wallPreview ? wallPreview.accent : wallTexture ? "#ffffff" : shownWallColor}
                    emissiveIntensity={wallPreview ? 0.26 : 0.16}
                  />
                )}
              </mesh>
              <mesh position={[0, wallHeight + 0.02, 0]}>
                <boxGeometry args={[segment.sx, 0.045, segment.sz]} />
                <meshBasicMaterial
                  color={wallPreview ? wallPreview.accent : style.accentColor}
                  transparent
                  opacity={wallPreview ? 1 : Math.min(1, glow)}
                  toneMapped={false}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

/** One-shot expanding ring confirming a paint click (parent restarts via key=token). */
/** Synchronous reduced-motion check; the preference rarely changes mid-session
 *  and these are decorative loops, so a per-render read is enough. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function PaintPulse3D({ x, z, radius, color }: { x: number; z: number; radius: number; color: string }) {
  const meshRef = useRef<Mesh>(null);
  const startRef = useRef<number | null>(null);
  const reducedMotion = prefersReducedMotion();
  useFrame((state) => {
    if (!meshRef.current || reducedMotion) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - startRef.current) / 0.55);
    meshRef.current.scale.setScalar(0.45 + t * 0.75);
    (meshRef.current.material as MeshBasicMaterial).opacity = 0.85 * (1 - t);
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.09, z]}>
      <ringGeometry args={[Math.max(0.2, radius - 0.28), radius, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function DoorMesh({
  project,
  door,
  selected,
  hovered,
  bindTarget = false,
}: {
  project: BuilderProject;
  door: BuilderDoor;
  selected: boolean;
  hovered: boolean;
  /** Puzzle-bind mode: valid doors pulse cyan to invite the binding click. */
  bindTarget?: boolean;
}) {
  const fromRoom = project.rooms.find((room) => room.id === door.fromRoomId);
  const toRoom = project.rooms.find((room) => room.id === door.toRoomId);
  if (!fromRoom || !toRoom) return null;
  const edge = sharedEdge(fromRoom, toRoom);

  if (!edge) {
    const x = (fromRoom.center[0] + toRoom.center[0]) / 2;
    const z = (fromRoom.center[1] + toRoom.center[1]) / 2;
    return (
      <group position={[x, 1, z]}>
        <mesh>
          <boxGeometry args={[1.4, 2, 1.4]} />
          <meshBasicMaterial color="#ff2e1f" wireframe />
        </mesh>
        {selected ? <PulsingRing radius={1.6} color="#ff2e1f" y={-0.94} /> : null}
      </group>
    );
  }

  const color = doorLockColors[door.lockType];
  const locked = door.lockType !== "none";
  const danger = door.lockType === "survive_wave";
  const puzzle = door.lockType === "puzzle_complete";
  const gold = door.lockType === "key_item";
  const frameColor = gold ? "#4a3920" : danger ? "#432222" : puzzle ? "#33264e" : "#263645";
  const leafColor = gold ? "#2b2417" : danger ? "#25161a" : puzzle ? "#211b34" : "#162533";
  const innerColor = gold ? "#d5a94e" : danger ? "#ff6c54" : puzzle ? "#b47aff" : "#7ff2ff";
  return (
    <group position={[edge.position[0], 0, edge.position[2]]} rotation={[0, previewPlanYawToThreeYaw(edge.yaw), 0]}>
      {/* readable escape-room door: heavy jambs, brass/cyan threshold, status rail */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[3.72, 0.08, 0.96]} />
        <meshStandardMaterial color="#10151c" roughness={0.48} metalness={0.55} emissive={innerColor} emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0, 0.075, -0.01]}>
        <boxGeometry args={[2.72, 0.045, 1.08]} />
        <meshBasicMaterial color={innerColor} transparent opacity={locked ? 0.38 : 0.7} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.72, 0, 0]}>
          <mesh position={[0, 0.92, 0]}>
            <boxGeometry args={[0.34, 1.84, 0.84]} />
            <meshStandardMaterial color={frameColor} roughness={0.42} metalness={0.5} emissive={innerColor} emissiveIntensity={0.08} />
          </mesh>
          <mesh position={[side * -0.13, 1.04, 0.46]}>
            <boxGeometry args={[0.055, 1.52, 0.07]} />
            <meshBasicMaterial color={innerColor} transparent opacity={0.72} toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.82, 0.05]}>
            <boxGeometry args={[0.44, 0.16, 0.94]} />
            <meshStandardMaterial color="#151923" roughness={0.5} metalness={0.48} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.86, 0]}>
        <boxGeometry args={[3.72, 0.32, 0.86]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.55} emissive={innerColor} emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 2.04, 0.47]}>
        <boxGeometry args={[2.7, 0.07, 0.08]} />
        <meshBasicMaterial color={innerColor} transparent opacity={locked ? 0.78 : 0.95} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.12, -0.44]}>
        <planeGeometry args={[2.85, 1.72]} />
        <meshBasicMaterial color={innerColor} transparent opacity={locked ? 0.08 : 0.15} blending={AdditiveBlending} toneMapped={false} depthWrite={false} side={DoubleSide} />
      </mesh>
      {/* door leaf: locked doors show split panels; unlocked/no-lock leaves retract to the jambs. */}
      {locked ? (
        <>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.78, 0.92, 0]}>
              <mesh>
                <boxGeometry args={[1.38, 1.64, 0.16]} />
                <meshStandardMaterial color={leafColor} roughness={0.46} metalness={0.48} emissive={innerColor} emissiveIntensity={0.05} />
              </mesh>
              <mesh position={[0, 0.43, 0.09]}>
                <boxGeometry args={[0.92, 0.055, 0.05]} />
                <meshBasicMaterial color={innerColor} transparent opacity={0.58} toneMapped={false} />
              </mesh>
              <mesh position={[side * -0.43, -0.28, 0.1]}>
                <boxGeometry args={[0.055, 0.72, 0.05]} />
                <meshBasicMaterial color={innerColor} transparent opacity={0.4} toneMapped={false} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.96, 0.11]}>
            <boxGeometry args={[0.12, 1.52, 0.08]} />
            <meshBasicMaterial color={innerColor} transparent opacity={0.92} toneMapped={false} />
          </mesh>
        </>
      ) : (
        [-1, 1].map((side) => (
          <group key={side} position={[side * 1.28, 0.92, 0]}>
            <mesh>
              <boxGeometry args={[0.56, 1.56, 0.14]} />
              <meshStandardMaterial color={leafColor} roughness={0.46} metalness={0.48} emissive="#7ff2ff" emissiveIntensity={0.04} />
            </mesh>
            <mesh position={[0, 0.42, 0.09]}>
              <boxGeometry args={[0.38, 0.05, 0.06]} />
              <meshBasicMaterial color="#7ff2ff" transparent opacity={0.78} toneMapped={false} />
            </mesh>
          </group>
        ))
      )}
      <group position={[1.25, 1.02, 0.52]}>
        <mesh>
          <boxGeometry args={[0.34, 0.52, 0.1]} />
          <meshStandardMaterial color="#080a0d" roughness={0.35} metalness={0.45} emissive={innerColor} emissiveIntensity={0.12} />
        </mesh>
        <mesh position={[0, 0.14, 0.07]}>
          <boxGeometry args={[0.2, 0.06, 0.04]} />
          <meshBasicMaterial color={innerColor} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      </group>
      {door.lockType !== "none" ? <LockIcon lockType={door.lockType} color={color} /> : null}
      {bindTarget ? <PulsingRing radius={2.3} color="#7ff2ff" /> : null}
      {selected ? <PulsingRing radius={2.1} color={color} /> : null}
      {hovered && !selected ? <SelectionRing radius={2.1} color="#ffffff" opacity={0.25} /> : null}
    </group>
  );
}

/**
 * Mounts the exit elevator on the room wall facing away from the layout
 * centre, so the architectural gate never blocks the default camera and reads
 * as the way out. The kit itself builds against the local +z wall.
 */
function ExitElevatorMount({ room, accent, away }: { room: BuilderRoom; accent: string; away: readonly [number, number] }) {
  const [awayX, awayZ] = away;
  const onZWall = Math.abs(awayZ) >= Math.abs(awayX);
  // RotY maps local +z → (sin yaw, 0, cos yaw): pick the outward direction.
  const yaw = onZWall ? (awayZ >= 0 ? 0 : Math.PI) : awayX >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const mounted = onZWall ? room : { ...room, size: [room.size[1], room.size[0]] as const };
  return (
    <group rotation={[0, yaw, 0]}>
      <ExitElevatorKit room={mounted} accent={accent} />
    </group>
  );
}

function ExitElevatorKit({ room, accent }: { room: BuilderRoom; accent: string }) {
  const [w, d] = room.size;
  const frameWidth = Math.min(2.45, Math.max(1.35, w * 0.42));
  const frameHeight = Math.min(1.95, Math.max(1.35, d * 0.28));
  const backZ = d / 2 - 0.2;
  const routeLength = Math.min(2.2, Math.max(0.9, d * 0.34));
  const brassX = frameWidth / 2 + 0.08;
  return (
    <group>
      {/* Wall-mounted elevator signal, intentionally not an editable furniture object. */}
      <mesh position={[0, 0.028, backZ - routeLength / 2 - 0.12]}>
        <boxGeometry args={[0.72, 0.035, routeLength]} />
        <meshBasicMaterial color="#7ff2ff" transparent opacity={0.28} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.035, backZ - routeLength - 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.63, 40]} />
        <meshBasicMaterial color="#5fd47a" transparent opacity={0.5} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <group position={[0, 0, backZ]}>
        <mesh position={[0, frameHeight / 2 + 0.1, -0.04]}>
          <boxGeometry args={[frameWidth, frameHeight, 0.08]} />
          <meshStandardMaterial color="#11171a" roughness={0.44} metalness={0.45} emissive="#7ff2ff" emissiveIntensity={0.04} />
        </mesh>
        <mesh position={[0, frameHeight / 2 + 0.1, -0.085]}>
          <planeGeometry args={[frameWidth * 0.66, frameHeight * 0.7]} />
          <meshBasicMaterial color="#7ff2ff" transparent opacity={0.13} blending={AdditiveBlending} toneMapped={false} depthWrite={false} side={DoubleSide} />
        </mesh>
        {[-brassX, brassX].map((x) => (
          <mesh key={`pillar-${x}`} position={[x, 1.28, 0]}>
            <boxGeometry args={[0.12, frameHeight + 0.24, 0.22]} />
            <meshStandardMaterial color="#4a3518" roughness={0.35} metalness={0.62} emissive="#d2a84f" emissiveIntensity={0.07} />
          </mesh>
        ))}
        <mesh position={[0, frameHeight + 0.28, 0]}>
          <boxGeometry args={[frameWidth + 0.42, 0.14, 0.22]} />
          <meshStandardMaterial color="#4a3518" roughness={0.35} metalness={0.62} emissive="#d2a84f" emissiveIntensity={0.12} />
        </mesh>
        {[-0.32, 0, 0.32].map((ratio) => (
          <mesh key={`bar-${ratio}`} position={[ratio * frameWidth, frameHeight / 2 + 0.1, 0.08]}>
            <boxGeometry args={[0.038, frameHeight * 0.74, 0.04]} />
            <meshStandardMaterial color="#b79048" roughness={0.38} metalness={0.7} emissive="#d2a84f" emissiveIntensity={0.06} />
          </mesh>
        ))}
        {[-0.34, 0.34].map((ratio) => (
          <group key={`lamp-${ratio}`} position={[ratio * frameWidth, frameHeight + 0.1, 0.12]}>
            <mesh>
              <sphereGeometry args={[0.07, 12, 8]} />
              <meshBasicMaterial color="#fff1c8" transparent opacity={0.95} toneMapped={false} />
            </mesh>
            <pointLight color="#ffdca0" intensity={0.38} distance={2.2} decay={2} />
          </group>
        ))}
        <mesh position={[frameWidth / 2 - 0.1, 0.78, 0.12]}>
          <boxGeometry args={[0.18, 0.34, 0.07]} />
          <meshStandardMaterial color="#0a0c0f" roughness={0.35} metalness={0.42} emissive={accent} emissiveIntensity={0.22} />
        </mesh>
        <mesh position={[frameWidth / 2 - 0.1, 0.86, 0.165]}>
          <boxGeometry args={[0.1, 0.035, 0.03]} />
          <meshBasicMaterial color="#7ff2ff" transparent opacity={0.95} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function BuilderPickupMarkers({
  project,
  selection,
  hovered,
  shadowStrength,
}: {
  project: BuilderProject;
  selection: BuilderSelection;
  hovered: BuilderSelection;
  shadowStrength: number;
}) {
  const clueRoom = project.puzzle ? project.rooms.find((room) => room.id === project.puzzle?.clueRoomId) ?? null : null;
  const puzzleRoom = project.puzzle ? project.rooms.find((room) => room.id === project.puzzle?.roomId) ?? null : null;

  return (
    <group>
      {(project.pickups ?? []).map((pickup) => {
        const entry = pickupEntry(pickup.kind);
        const selected = selection?.kind === "pickup" && selection.id === pickup.id;
        const isHovered = hovered?.kind === "pickup" && hovered.id === pickup.id;
        const scale = pickup.kind === "key_item" ? 1.45 : pickup.kind === "repairKit" ? 0.76 : pickup.kind === "breachMissile" ? 0.88 : 0.92;
        return (
          <group key={pickup.id} position={[pickup.position[0], 0, pickup.position[1]]}>
            <BlobShadow radius={0.55} strength={shadowStrength} />
            <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.42, 0.55, 36]} />
              <meshBasicMaterial color={entry.color} transparent opacity={selected ? 0.58 : 0.28} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
            </mesh>
            <EnvironmentModelInstance modelKey={pickupModelKey(pickup.kind)} position={[0, 0.12, 0]} scale={scale} />
            <pointLight color={entry.color} position={[0, 0.9, 0]} intensity={pickup.kind === "key_item" ? 0.9 : 0.42} distance={3} decay={2} />
            {selected ? <PulsingRing radius={0.78} color="#7ff2ff" /> : null}
            {isHovered && !selected ? <HoverGlow radius={0.72} /> : null}
          </group>
        );
      })}
      {clueRoom ? <MemoryChipPedestal x={clueRoom.center[0] + Math.min(1.2, clueRoom.size[0] * 0.16)} z={clueRoom.center[1] - Math.min(1.1, clueRoom.size[1] * 0.16)} /> : null}
      {puzzleRoom ? <PuzzleOrbCluster x={puzzleRoom.center[0] - Math.min(1.2, puzzleRoom.size[0] * 0.15)} z={puzzleRoom.center[1] - Math.min(1.1, puzzleRoom.size[1] * 0.15)} /> : null}
    </group>
  );
}

function MemoryChipPedestal({ x, z }: { x: number; z: number }) {
  const chipRef = useRef<Group>(null);
  useFrame((state) => {
    if (!chipRef.current) return;
    chipRef.current.rotation.y = state.clock.elapsedTime * 0.7;
    chipRef.current.position.y = 0.76 + Math.sin(state.clock.elapsedTime * 2.5) * 0.035;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.36, 0.5, 0.56, 4]} />
        <meshStandardMaterial color="#16232a" roughness={0.35} metalness={0.35} transparent opacity={0.8} emissive="#54e0ff" emissiveIntensity={0.08} />
      </mesh>
      <group ref={chipRef} position={[0, 0.76, 0]}>
        <mesh>
          <boxGeometry args={[0.48, 0.035, 0.32]} />
          <meshStandardMaterial color="#11242a" roughness={0.22} metalness={0.55} emissive="#54e0ff" emissiveIntensity={0.26} />
        </mesh>
        {[-0.16, 0, 0.16].map((xOffset) => (
          <mesh key={xOffset} position={[xOffset, 0.026, 0]}>
            <boxGeometry args={[0.035, 0.012, 0.24]} />
            <meshBasicMaterial color="#9bf7ff" transparent opacity={0.78} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.6, 36]} />
        <meshBasicMaterial color="#54e0ff" transparent opacity={0.32} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight color="#54e0ff" intensity={0.5} distance={2.8} decay={2} />
    </group>
  );
}

function PuzzleOrbCluster({ x, z }: { x: number; z: number }) {
  const colors = ["#ff7a5c", "#76b7e8", "#5fd47a"] as const;
  return (
    <group position={[x, 0, z]}>
      {colors.map((color, index) => (
        <group key={color} position={[(index - 1) * 0.34, 0.45, 0]}>
          <mesh>
            <sphereGeometry args={[0.14, 16, 10]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.25} />
          </mesh>
          <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 0.24, 12]} />
            <meshStandardMaterial color="#171a1f" roughness={0.45} metalness={0.45} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.52, 0.66, 36]} />
        <meshBasicMaterial color="#b47aff" transparent opacity={0.3} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A grounded contact-shadow quad from the shared profile spec (null = skip). */
function ContactShadow({ spec }: { spec: ReturnType<typeof contactShadowSpec> }) {
  if (!spec) return null;
  return <BlobShadow radius={spec.radius} strength={spec.opacity} />;
}

function RouteSwitchMarkers({
  project,
  selection,
  hovered,
  doorEdges,
  profile,
}: {
  project: BuilderProject;
  selection: BuilderSelection;
  hovered: BuilderSelection;
  doorEdges: readonly DoorEdgeInfo[];
  profile: BuilderVisualProfile;
}) {
  const { language } = useBuilderLanguage();
  return (
    <>
      {(project.routeSwitches ?? []).map((route) => {
        const selected = selection?.kind === "routeSwitch" && selection.id === route.id;
        const isHovered = hovered?.kind === "routeSwitch" && hovered.id === route.id;
        const showLinks = selected || isHovered;
        const [x, z] = route.position;
        const hostedByProp = Boolean(route.hostPropId);
        return (
          <group key={route.id}>
            {route.outputs.slice(0, 4).map((output, index) => {
              const [keyX, keyZ] = routeOutputKeyPosition(project, route, output, index);
              const keyDistance = Math.hypot(keyX - x, keyZ - z);
              const color = routeOutputOrbAccentForIndex(index);
              return (
                <group key={`${output.id}-orb`}>
                  <group position={[keyX, 0, keyZ]}>
                    <RouteOutputOrbMarker3D index={index} selected={selected} hovered={isHovered} />
                  </group>
                  {showLinks && keyDistance > 0.35 ? (
                    <mesh position={[(x + keyX) / 2, 0.1, (z + keyZ) / 2]} rotation={[0, Math.atan2(keyX - x, keyZ - z), 0]}>
                      <boxGeometry args={[0.08, 0.018, keyDistance]} />
                      <meshBasicMaterial color={color} transparent opacity={0.44} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
                    </mesh>
                  ) : null}
                </group>
              );
            })}
            <group position={[x, 0, z]} rotation={[0, route.rotationY, 0]}>
              {!hostedByProp ? <ContactShadow spec={contactShadowSpec(0.64, profile, "puzzle")} /> : null}
              {!hostedByProp ? (
                <RouteSwitchMesh selected={selected} hovered={isHovered} />
              ) : (
                <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.42, 0.58, 36]} />
                  <meshBasicMaterial color="#5ee8c8" transparent opacity={selected || isHovered ? 0.52 : 0.28} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
                </mesh>
              )}
              {selected ? <PulsingRing radius={0.78} color="#7ff2ff" /> : null}
              {isHovered && !selected ? <HoverGlow radius={0.72} /> : null}
            </group>
            {showLinks
              ? route.outputs.map((output, index) => {
                  const target = routeOutputTarget3D(project, doorEdges, output);
                  if (!target) return null;
                  const dx = target[0] - x;
                  const dz = target[1] - z;
                  const length = Math.hypot(dx, dz);
                  return (
                    <mesh key={output.id} position={[(x + target[0]) / 2, 0.09 + index * 0.025, (z + target[1]) / 2]} rotation={[0, Math.atan2(dx, dz), 0]}>
                      <boxGeometry args={[0.12, 0.018, length]} />
                      <meshBasicMaterial color={index % 2 === 0 ? "#5ee8c8" : "#ffd76b"} transparent opacity={0.42} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
                    </mesh>
                  );
                })
              : null}
          </group>
          );
        })}
      {(project.wallDoorSwitches ?? []).map((wallSwitch) => {
        const selected = selection?.kind === "wallDoorSwitch" && selection.id === wallSwitch.id;
        const isHovered = hovered?.kind === "wallDoorSwitch" && hovered.id === wallSwitch.id;
        const placement = wallDoorSwitchPlacement(project, wallSwitch);
        if (!placement) return null;
        const controlledDoorLinks = wallDoorSwitchDoorLinks(wallSwitch);
        const linkedToSelectedDoor =
          selection?.kind === "door" &&
          (project.doors.find((door) => door.id === selection.id)?.wallDoorSwitchId === wallSwitch.id ||
            controlledDoorLinks.some((link) => link.doorId === selection.id));
        const showLinks = selected || isHovered || linkedToSelectedDoor;
        return (
          <group key={wallSwitch.id}>
            <group position={placement.position} rotation={[0, placement.yaw, 0]}>
              <WallDoorSwitchMarker3D selected={selected} hovered={isHovered} />
              {selected || linkedToSelectedDoor ? <PulsingRing radius={0.72} color="#7bb7ff" /> : null}
              {isHovered && !selected ? <HoverGlow radius={0.66} /> : null}
            </group>
            {showLinks
              ? controlledDoorLinks.map((link, index) => {
                  const target = doorTarget3D(project, doorEdges, link.doorId);
                  if (!target) return null;
                  const dx = target[0] - placement.position[0];
                  const dz = target[2] - placement.position[2];
                  const length = Math.hypot(dx, dz);
                  const color = wallDoorSwitchLinkColor(link.mode);
                  return (
                    <mesh
                      key={link.doorId}
                      position={[(placement.position[0] + target[0]) / 2, 0.16 + index * 0.035, (placement.position[2] + target[2]) / 2]}
                      rotation={[0, Math.atan2(dx, dz), 0]}
                    >
                      <boxGeometry args={[0.13, 0.02, length]} />
                      <meshBasicMaterial color={color} transparent opacity={selected || linkedToSelectedDoor ? 0.66 : 0.5} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
                    </mesh>
                  );
                })
              : null}
          </group>
        );
      })}
    </>
  );
}

function WallDoorSwitchMarker3D({ selected, hovered }: { selected: boolean; hovered: boolean }) {
  const accent = selected ? "#9fd7ff" : hovered ? "#7ff2ff" : "#64d7ff";
  const glow = selected ? 1.1 : hovered ? 0.82 : 0.48;
  return (
    <group>
      {selected || hovered ? (
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[0.58, 0.96, 0.024]} />
          <meshBasicMaterial color={accent} transparent opacity={selected ? 0.22 : 0.13} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
        </mesh>
      ) : null}
      <EnvironmentModelInstance modelKey="hp_wall_door_switch_button_v1" position={[0, 0, 0.025]} scale={1} castShadow receiveShadow />
      {selected || hovered ? <pointLight color={accent} intensity={glow} distance={2.2} decay={2} /> : null}
    </group>
  );
}

function wallDoorSwitchDoorLinks(wallSwitch: BuilderWallDoorSwitch): Array<{ doorId: string; mode: "open" | "close" | "both" }> {
  const open = new Set<string>();
  const close = new Set<string>();
  for (const state of effectiveWallDoorSwitchStates(wallSwitch)) {
    for (const doorId of state.openDoorIds ?? []) open.add(doorId);
    for (const doorId of state.closeDoorIds ?? []) close.add(doorId);
  }
  return [...new Set([...open, ...close])].map((doorId) => ({
    doorId,
    mode: open.has(doorId) && close.has(doorId) ? "both" : open.has(doorId) ? "open" : "close",
  }));
}

function wallDoorSwitchLinkColor(mode: "open" | "close" | "both") {
  if (mode === "open") return "#5ee8c8";
  if (mode === "close") return "#ff7a5c";
  return "#7bb7ff";
}

function routeOutputOrbModelKey(index: number): EnvironmentModelKey {
  return (["pickup_route_output_orb_1", "pickup_route_output_orb_2", "pickup_route_output_orb_3", "pickup_route_output_orb_4"][index] ?? "pickup_route_output_orb_1") as EnvironmentModelKey;
}

function RouteOutputOrbMarker3D({ index, selected, hovered }: { index: number; selected: boolean; hovered: boolean }) {
  const keyRef = useRef<Group>(null);
  useFrame((state) => {
    if (!keyRef.current) return;
    keyRef.current.rotation.y = state.clock.elapsedTime * 0.9;
    keyRef.current.position.y = 0.62 + Math.sin(state.clock.elapsedTime * 2.4 + index * 0.5) * 0.035;
  });
  const accent = selected || hovered ? "#7ff2ff" : routeOutputOrbAccentForIndex(index);
  const configureObject = useMemo(() => (object: Parameters<typeof polishRouteOutputOrbObject>[0]) => {
    polishRouteOutputOrbObject(object, accent);
  }, [accent]);
  return (
    <group>
      <BlobShadow radius={0.48} strength={0.18} />
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.64, 40]} />
        <meshBasicMaterial color={accent} transparent opacity={selected ? 0.6 : 0.34} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.28, 0.4, 0.38, 12]} />
        <meshStandardMaterial color="#13252b" roughness={0.34} metalness={0.48} emissive="#5ee8c8" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.2, 0.25, 0.12, 12]} />
        <meshStandardMaterial color="#273842" roughness={0.32} metalness={0.5} emissive={accent} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.035, 0.09, 1.2, 16]} />
        <meshBasicMaterial color={accent} transparent opacity={selected || hovered ? 0.36 : 0.24} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.25, 32]} />
        <meshBasicMaterial color="#baffff" transparent opacity={selected || hovered ? 0.7 : 0.42} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <group ref={keyRef} position={[0, 0.64, 0]} rotation={[0, 0.35, 0]}>
        <EnvironmentModelInstance modelKey={routeOutputOrbModelKey(index)} position={[0, 0, 0]} scale={1.35} configureObject={configureObject} />
      </group>
      <pointLight color={accent} intensity={selected ? 1.45 : 0.92} distance={4.2} decay={2} />
      {selected ? <PulsingRing radius={0.78} color="#7ff2ff" /> : null}
      {hovered && !selected ? <HoverGlow radius={0.72} /> : null}
    </group>
  );
}


function routeOutputTarget3D(
  project: BuilderProject,
  doorEdges: readonly DoorEdgeInfo[],
  output: BuilderRouteSwitchOutput,
): readonly [number, number] | null {
  if (output.kind === "open_door" && output.doorId) {
    const edge = doorEdges.find((candidate) => candidate.id === output.doorId);
    if (edge) return [edge.x, edge.z];
  }
  if (output.kind === "reveal_puzzle" && output.puzzleId) {
    const puzzle = puzzleInstances(project).find((instance) => instance.id === output.puzzleId);
    return puzzle ? puzzlePlanPosition(project, puzzle) : null;
  }
  if (output.kind === "start_robots" && output.robotRoomId) {
    return project.rooms.find((room) => room.id === output.robotRoomId)?.center ?? null;
  }
  return null;
}

function doorTarget3D(project: BuilderProject, doorEdges: readonly DoorEdgeInfo[], doorId: string): readonly [number, number, number] | null {
  const edge = doorEdges.find((candidate) => candidate.id === doorId);
  if (edge) return [edge.x, 0, edge.z];
  const door = project.doors.find((candidate) => candidate.id === doorId);
  if (!door) return null;
  const fromRoom = project.rooms.find((room) => room.id === door.fromRoomId);
  const toRoom = project.rooms.find((room) => room.id === door.toRoomId);
  if (!fromRoom || !toRoom) return null;
  return [(fromRoom.center[0] + toRoom.center[0]) / 2, 0, (fromRoom.center[1] + toRoom.center[1]) / 2];
}

/**
 * Author-placed puzzle objects: a console (terminal/clue panel) per instance
 * at its exact position + rotation, floating color orbs for each component,
 * and a dependency beam to the linked door while the puzzle or door is
 * selected. Picking is handled in plan space (pickAt) with puzzle priority.
 */
function PuzzleConsoleMarkers({
  project,
  selection,
  hovered,
  doorEdges,
  profile,
}: {
  project: BuilderProject;
  selection: BuilderSelection;
  hovered: BuilderSelection;
  doorEdges: readonly DoorEdgeInfo[];
  profile: BuilderVisualProfile;
}) {
  return (
    <>
      {puzzleInstances(project).map((instance) => {
        const entry = puzzleKindEntry(instance.kind);
        const edge = doorEdges.find((candidate) => candidate.id === instance.linkedDoorId);
        const instanceSelected = selection?.kind === "puzzle" && selection.id === instance.id;
        const terminalSelected = instanceSelected && !selection?.componentId;
        const terminalHovered = hovered?.kind === "puzzle" && hovered.id === instance.id && !hovered.componentId;
        const doorSelected = selection?.kind === "door" && selection.id === instance.linkedDoorId;
        const wallPlacement = puzzleWallMountPlacement(project, instance);
        const [px, pz] = puzzlePlanPosition(project, instance);
        const hostedByProp = puzzleInstanceUsesHostedInteraction(instance);
        return (
          <group key={instance.id}>
            {!hostedByProp ? (
              <group
                position={wallPlacement ? wallPlacement.position : [px, 0, pz]}
                rotation={[0, wallPlacement ? wallPlacement.yaw : instance.rotationY, 0]}
              >
                {!wallPlacement ? <ContactShadow spec={contactShadowSpec(0.74, profile, "puzzle")} /> : null}
                <PuzzleMachineMesh instance={instance} accent={entry.color} />
                {terminalSelected ? <PulsingRing radius={0.75} color="#7ff2ff" /> : null}
                {terminalHovered && !terminalSelected ? <HoverGlow radius={0.7} /> : null}
              </group>
            ) : null}
            {/* color orbs: floating spheres on slim stands at their placed spots */}
            {(instance.components ?? []).map((component) => {
              const componentSelected = instanceSelected && selection?.componentId === component.id;
              const componentHovered = hovered?.kind === "puzzle" && hovered.id === instance.id && hovered.componentId === component.id;
              const hex = orbColorHex(component.role);
              const anchored = Boolean(puzzleComponentAnchorPropId(component));
              const orbY = anchored ? puzzleComponentY(component) : 1.15;
              return (
                <group key={component.id} position={[component.position[0], 0, component.position[1]]}>
                  {!anchored ? <ContactShadow spec={contactShadowSpec(0.48, profile, "puzzle")} /> : null}
                  {!anchored ? (
                    <>
                      <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.42, 0.48, 0.09, 18]} />
                        <meshStandardMaterial color="#111820" roughness={0.46} metalness={0.62} />
                      </mesh>
                      <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.28, 0.34, 0.08, 18]} />
                        <meshStandardMaterial color="#9c7836" roughness={0.34} metalness={0.72} />
                      </mesh>
                      <mesh position={[0, 0.58, 0]} castShadow>
                        <cylinderGeometry args={[0.035, 0.052, 0.92, 10]} />
                        <meshStandardMaterial color="#202832" roughness={0.46} metalness={0.64} />
                      </mesh>
                      <mesh position={[0, 0.98, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <torusGeometry args={[0.18, 0.026, 8, 24]} />
                        <meshStandardMaterial color="#b58a3e" roughness={0.32} metalness={0.76} />
                      </mesh>
                    </>
                  ) : (
                    <mesh position={[0, orbY - 0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
                      <torusGeometry args={[0.28, 0.018, 8, 32]} />
                      <meshBasicMaterial color={hex} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
                    </mesh>
                  )}
                  <mesh position={[0, orbY, 0]}>
                    <sphereGeometry args={[0.26, 16, 14]} />
                    <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={0.65} roughness={0.3} />
                  </mesh>
                  <mesh position={[0, orbY, 0]}>
                    <sphereGeometry args={[0.34, 18, 14]} />
                    <meshBasicMaterial color={hex} transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
                  </mesh>
                  {componentSelected ? <PulsingRing radius={0.55} color="#7ff2ff" /> : null}
                  {componentHovered && !componentSelected ? <HoverGlow radius={0.5} /> : null}
                </group>
              );
            })}
            {/* dependency beam terminal → linked door while either end is selected */}
            {edge && (instanceSelected || doorSelected)
              ? (() => {
                  const dx = edge.x - px;
                  const dz = edge.z - pz;
                  const length = Math.hypot(dx, dz);
                  return (
                    <mesh position={[(px + edge.x) / 2, 0.07, (pz + edge.z) / 2]} rotation={[0, Math.atan2(dx, dz), 0]}>
                      <boxGeometry args={[0.16, 0.02, length]} />
                      <meshBasicMaterial color={entry.color} transparent opacity={0.5} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
                    </mesh>
                  );
                })()
              : null}
          </group>
        );
      })}
    </>
  );
}



function RobotMarkers({
  project,
  selection,
  hovered,
  shadowStrength,
}: {
  project: BuilderProject;
  selection: BuilderSelection;
  hovered: BuilderSelection;
  shadowStrength: number;
}) {
  return (
    <>
      {project.robots.map((robot) => {
        const spot = robotDisplayPosition(project, robot.id);
        if (!spot) return null;
        const { x, z } = spot;
        const selected = selection?.kind === "robot" && selection.id === robot.id;
        const isHovered = hovered?.kind === "robot" && hovered.id === robot.id;
        const elite = robot.tier === "elite" || robot.archetype === "custodian_elite";
        return (
          <group key={robot.id} position={[x, 0, z]}>
            <BlobShadow radius={0.5} strength={shadowStrength} />
              {/* Threat marker: body + head + glowing visor band on a base disc. */}
              <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.52, 18]} />
                <meshBasicMaterial color={elite ? "#ff4f8c" : "#ff7a5c"} transparent opacity={0.16} toneMapped={false} />
              </mesh>
              <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.24, 0.34, 0.85, 10]} />
                <meshStandardMaterial color={elite ? "#5a1d33" : "#4a2620"} />
              </mesh>
              <mesh position={[0, 1.08, 0]}>
                <sphereGeometry args={[0.21, 12, 10]} />
                <meshStandardMaterial color={elite ? "#6b1d3a" : "#58231f"} />
              </mesh>
              <mesh position={[0, 1.1, 0]}>
                <torusGeometry args={[0.215, 0.045, 8, 18]} />
                <meshBasicMaterial color={elite ? "#ff4f8c" : "#ff7a5c"} toneMapped={false} />
              </mesh>
              {Array.from({ length: Math.min(4, robot.count) }, (_, dot) => (
                <mesh key={dot} position={[-0.27 + dot * 0.18, 1.52, 0]}>
                  <sphereGeometry args={[0.06, 8, 8]} />
                  <meshBasicMaterial color="#ffd9cd" toneMapped={false} />
                </mesh>
              ))}
              {elite ? <PulsingRing radius={0.78} color="#ff4f8c" /> : null}
              {selected ? <PulsingRing radius={1} color="#7ff2ff" /> : null}
              {isHovered && !selected ? <SelectionRing radius={1} color="#ffffff" opacity={0.3} /> : null}
          </group>
        );
      })}
    </>
  );
}

function Beacon({ color, tall = false, pulse = false }: { color: string; tall?: boolean; pulse?: boolean }) {
  const ringRef = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ringRef.current || !pulse) return;
    const t = (state.clock.elapsedTime * 0.7) % 1;
    ringRef.current.scale.setScalar(0.6 + t * 1.2);
    const material = ringRef.current.material as MeshBasicMaterial;
    material.opacity = 0.7 * (1 - t);
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.7, 1, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {pulse ? (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.95, 1.08, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} depthWrite={false} />
        </mesh>
      ) : null}
      {tall ? (
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 2.8, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function PulsingRing({ radius, color, y = 0.06 }: { radius: number; color: string; y?: number }) {
  const meshRef = useRef<Mesh>(null);
  const reducedMotion = prefersReducedMotion();
  useFrame((state) => {
    if (!meshRef.current || reducedMotion) return;
    const wave = 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.05;
    meshRef.current.scale.setScalar(wave);
    (meshRef.current.material as MeshBasicMaterial).opacity = 0.7 + Math.sin(state.clock.elapsedTime * 3.2) * 0.25;
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[radius, radius + 0.2, 36]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function SelectionRing({ radius, color, opacity = 0.9, y = 0.06 }: { radius: number; color: string; opacity?: number; y?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[radius, radius + 0.2, 36]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

interface SceneFocus {
  x: number;
  z: number;
  span: number;
}

function sceneFocus(rooms: readonly BuilderRoom[]): SceneFocus {
  if (rooms.length === 0) return { x: 0, z: 0, span: 24 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const room of rooms) {
    minX = Math.min(minX, room.center[0] - room.size[0] / 2);
    maxX = Math.max(maxX, room.center[0] + room.size[0] / 2);
    minZ = Math.min(minZ, room.center[1] - room.size[1] / 2);
    maxZ = Math.max(maxZ, room.center[1] + room.size[1] / 2);
  }
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    span: Math.max(18, maxX - minX, maxZ - minZ) * 1.25,
  };
}
