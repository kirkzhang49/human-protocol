import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import { bl } from "./i18n/catalogLabels";
import { propEntry, robotLabel } from "./BuilderAssetCatalog";
import { PropFootprintShape, robotArchetypeColor } from "./BuilderAssetFootprints";
import { builderDoorDisplayLabel } from "./BuilderDoorRelations";
import { brushPreset, roomCeiling, roomFloor, roomWall, type BuilderBrush, type BuilderPaintFlash } from "./BuilderEnvironment";
import {
  placementAt,
  puzzlePlanPosition,
  roomAt,
  roomPickModifierActive,
  robotDisplayPosition,
  routeKeyPosition,
  routeOutputKeyPosition,
  wallDoorSwitchDraftPlacementFromPoint,
  wallDoorSwitchPlanPosition,
  wallMountFromPoint,
  wallMountedPropPlacementForEntryFromPoint,
  type PlacementDraft,
} from "./BuilderPlacementRules";
import { propWithStacking, reflowAttachedProps, resolvePropStacking } from "./BuilderPropStacking";
import {
  projectWithAnchoredPuzzleComponentPlacement,
  projectWithAnchoredPuzzleComponentsForProp,
  projectWithHostedRouteSwitchProp,
} from "./BuilderPuzzlePlacement";
import { pickupEntry } from "./BuilderPickupCatalog";
import { orbColorHex, puzzleInstances, puzzleKindEntry } from "./BuilderPuzzleCatalog";
import { resizeRoom, snapRoomToNeighbors, type SnapGuide } from "./BuilderRoomEditing";
import { roomWorldPolygon } from "./BuilderRoomShape";
import { useBuilderSelection } from "./BuilderSelectionContext";
import { brushPreviewPatternId, roomFloorPatternId } from "./BuilderSurfaceArt";
import type { BuilderUpdate } from "./BuilderHistory";
import type { BuilderProject, BuilderProp, BuilderPuzzleHostPick, BuilderRoom, BuilderRouteSwitchOutput, BuilderSelection, BuilderWallDoorSwitch } from "./BuilderTypes";
import { effectiveWallDoorSwitchStates } from "./BuilderWallDoorSwitches";
import { sharedEdge } from "./compileBuilderProjectToLevel";

export interface BuilderViewport {
  zoom: number;
  cx: number;
  cz: number;
}

export const defaultViewport: BuilderViewport = { zoom: 1, cx: 0, cz: 0 };

/** SVG points string for a shaped room's world-space footprint polygon. */
function roomPolygonPoints(room: BuilderRoom): string {
  return roomWorldPolygon(room)
    .map(([x, z]) => `${x},${z}`)
    .join(" ");
}

/** SVG path string for a shaped room, explicitly closed so every edge renders. */
function roomPolygonPath(room: BuilderRoom): string {
  const points = roomWorldPolygon(room);
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first[0]} ${first[1]} ${rest.map(([x, z]) => `L ${x} ${z}`).join(" ")} Z`;
}

const baseView = { width: 48, height: 40 };
const robotGlyphs: Record<string, string> = {
  repair_drone: "修",
  clamp_bot: "夹",
  shield_tech: "盾",
  custodian_elite: "精",
};

function wallMountedPlacementForProp(room: BuilderRoom, prop: BuilderProp, x: number, z: number) {
  const entry = propEntry(prop.modelKey);
  if (entry?.mount !== "wall") return null;
  return wallMountedPropPlacementForEntryFromPoint(room, x, z, {
    height: prop.elevation,
    scale: prop.scale,
    sizeMeters: entry.sizeMeters,
    wallMountFace: entry.wallMountFace,
  });
}
// Short EN glyphs so the SVG label box layout holds at the same size.
const robotGlyphsEn: Record<string, string> = {
  repair_drone: "R",
  clamp_bot: "C",
  shield_tech: "S",
  custodian_elite: "E",
};

interface BuilderCanvas2DProps {
  project: BuilderProject;
  selection: BuilderSelection;
  viewport: BuilderViewport;
  criticalRoomIds: ReadonlySet<string>;
  criticalDoorIds: ReadonlySet<string>;
  placement: PlacementDraft | null;
  /** Active environment brush; clicking a room applies it instead of selecting. */
  brush: BuilderBrush | null;
  /** One-shot confirmation pulse after a paint click. */
  paintFlash: BuilderPaintFlash | null;
  /** Grid snap step for props/robots (rooms always snap to 1m). */
  snapStep?: number;
  /** Puzzle-bind mode: valid doors glow and become the only click targets. */
  bindDoorMode?: boolean;
  /** Puzzle-host picking mode: valid furniture props glow and become click targets. */
  hostPick?: BuilderPuzzleHostPick | null;
  /** Full plan edits geometry; navigator is a compact select/focus minimap. */
  variant?: "editor" | "navigator";
  /** Plain room floor clicks may select rooms while the room command/tool is active. */
  roomSelectionEnabled?: boolean;
  onPlace: (x: number, z: number, roomId: string) => void;
  onBrush: (roomId: string, shift: boolean) => void;
  onPickPuzzleHost?: (propId: string) => void;
  onSelect: (selection: BuilderSelection) => void;
  onHover: (selection: BuilderSelection) => void;
  onViewportChange: (viewport: BuilderViewport) => void;
  update: BuilderUpdate;
  /** Called once at the start of a drag gesture so it collapses into one undo step. */
  onGestureStart: () => void;
}

type DragState =
  | { kind: "room" | "prop" | "pickup" | "robot" | "routeSwitch" | "routeKey" | "wallDoorSwitch"; id: string; dx: number; dz: number; moved: boolean }
  | { kind: "routeOutputKey"; id: string; outputId: string; dx: number; dz: number; moved: boolean }
  | { kind: "puzzle"; id: string; componentId?: string; dx: number; dz: number; moved: boolean }
  | { kind: "resize"; id: string; edge: "n" | "s" | "e" | "w" }
  | { kind: "pan"; startClientX: number; startClientY: number; startCx: number; startCz: number; moved: boolean };

export function BuilderCanvas2D({
  project,
  selection,
  viewport,
  criticalRoomIds,
  criticalDoorIds,
  placement,
  brush,
  paintFlash,
  snapStep = 0.5,
  bindDoorMode = false,
  hostPick = null,
  variant = "editor",
  roomSelectionEnabled = false,
  onPlace,
  onBrush,
  onPickPuzzleHost,
  onSelect,
  onHover,
  onViewportChange,
  update,
  onGestureStart,
}: BuilderCanvas2DProps) {
  // Plain SVG/DOM (not under an r3f <Canvas>): reading chrome language via context is fine.
  const { language } = useBuilderLanguage();
  const en = language === "en";
  // Shared selection: read hovered target for cross-highlight; camera focus is
  // deliberately click/select driven so hover never steals the 3D view.
  const selectionCtx = useBuilderSelection();
  const hovered = selectionCtx?.hovered ?? null;
  const hoveredRoomId = hovered?.kind === "room" ? hovered.id : null;
  const canFocus = !placement && !brush && !hostPick;
  const navigatorMode = variant === "navigator";
  const roomPointerEnabled = navigatorMode || roomSelectionEnabled || brush !== null;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [ghost, setGhost] = useState<{ x: number; z: number; valid: boolean; rotationY?: number } | null>(null);
  const [brushHover, setBrushHover] = useState<string | null>(null);

  useEffect(() => {
    if (!placement) setGhost(null);
  }, [placement]);

  useEffect(() => {
    if (!brush) setBrushHover(null);
  }, [brush]);
  const mapBounds = useMemo(() => {
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    const includePoint = (x: number, z: number, pad = 0) => {
      minX = Math.min(minX, x - pad);
      minZ = Math.min(minZ, z - pad);
      maxX = Math.max(maxX, x + pad);
      maxZ = Math.max(maxZ, z + pad);
    };
    const includeRect = (cx: number, cz: number, w: number, d: number) => {
      includePoint(cx - w / 2, cz - d / 2);
      includePoint(cx + w / 2, cz + d / 2);
    };
    for (const room of project.rooms) {
      if (room.shape) {
        for (const [x, z] of roomWorldPolygon(room)) includePoint(x, z);
      } else {
        includeRect(room.center[0], room.center[1], room.size[0], room.size[1]);
      }
    }
    for (const prop of project.props) includePoint(prop.position[0], prop.position[1], 1.2);
    for (const pickup of project.pickups ?? []) includePoint(pickup.position[0], pickup.position[1], 0.8);
    for (const instance of puzzleInstances(project)) {
      includePoint(instance.position[0], instance.position[1], 1);
      for (const component of instance.components ?? []) includePoint(component.position[0], component.position[1], 0.8);
    }
    for (const route of project.routeSwitches ?? []) {
      includePoint(route.position[0], route.position[1], 1);
      route.outputs.slice(0, 4).forEach((output, index) => {
        const keyPosition = routeOutputKeyPosition(project, route, output, index);
        includePoint(keyPosition[0], keyPosition[1], 0.8);
      });
    }
    for (const wallSwitch of project.wallDoorSwitches ?? []) {
      const position = wallDoorSwitchPlanPosition(project, wallSwitch);
      if (position) includePoint(position[0], position[1], 0.8);
    }
    for (const robot of project.robots) {
      const spot = robotDisplayPosition(project, robot.id);
      if (spot) includePoint(spot.x, spot.z, 1.2);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minZ) || !Number.isFinite(maxX) || !Number.isFinite(maxZ)) {
      return { cx: 0, cz: 0, zoom: 1 };
    }
    const rawW = Math.max(10, maxX - minX);
    const rawH = Math.max(8, maxZ - minZ);
    const pad = Math.max(2.5, Math.min(7, Math.max(rawW, rawH) * 0.13));
    let width = rawW + pad * 2;
    let height = rawH + pad * 2;
    const targetAspect = baseView.width / baseView.height;
    if (width / height > targetAspect) height = width / targetAspect;
    else width = height * targetAspect;
    return {
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      zoom: baseView.width / width,
    };
  }, [project]);

  const effectiveViewport = navigatorMode ? mapBounds : viewport;
  const viewportRef = useRef(effectiveViewport);
  viewportRef.current = effectiveViewport;

  const viewW = baseView.width / effectiveViewport.zoom;
  const viewH = baseView.height / effectiveViewport.zoom;
  const viewMinX = effectiveViewport.cx - viewW / 2;
  const viewMinZ = effectiveViewport.cz - viewH / 2;

  const focusSelection = (target: BuilderSelection) => {
    if (!target || !canFocus) return;
    let request: { x: number; z: number; span: number } | null = null;
    if (target.kind === "room") {
      const room = project.rooms.find((candidate) => candidate.id === target.id);
      if (room) request = { x: room.center[0], z: room.center[1], span: Math.max(room.size[0], room.size[1], 8) };
    } else if (target.kind === "door") {
      const door = project.doors.find((candidate) => candidate.id === target.id);
      const fromRoom = door ? project.rooms.find((candidate) => candidate.id === door.fromRoomId) : null;
      const toRoom = door ? project.rooms.find((candidate) => candidate.id === door.toRoomId) : null;
      const edge = fromRoom && toRoom ? sharedEdge(fromRoom, toRoom) : null;
      if (edge) request = { x: edge.position[0], z: edge.position[2], span: 7 };
      else if (fromRoom && toRoom) request = { x: (fromRoom.center[0] + toRoom.center[0]) / 2, z: (fromRoom.center[1] + toRoom.center[1]) / 2, span: 10 };
    } else if (target.kind === "prop") {
      const prop = project.props.find((candidate) => candidate.id === target.id);
      if (prop) request = { x: prop.position[0], z: prop.position[1], span: 6 };
    } else if (target.kind === "pickup") {
      const pickup = (project.pickups ?? []).find((candidate) => candidate.id === target.id);
      if (pickup) request = { x: pickup.position[0], z: pickup.position[1], span: 6 };
    } else if (target.kind === "routeSwitch") {
      const route = project.routeSwitches?.find((candidate) => candidate.id === target.id);
      if (route) request = { x: route.position[0], z: route.position[1], span: 7 };
    } else if (target.kind === "wallDoorSwitch") {
      const wallSwitch = project.wallDoorSwitches?.find((candidate) => candidate.id === target.id);
      const position = wallSwitch ? wallDoorSwitchPlanPosition(project, wallSwitch) : null;
      if (position) request = { x: position[0], z: position[1], span: 6 };
    } else if (target.kind === "puzzle") {
      const instance = puzzleInstances(project).find((candidate) => candidate.id === target.id);
      const component = target.componentId ? instance?.components?.find((candidate) => candidate.id === target.componentId) : null;
      const position = component?.position ?? instance?.position;
      if (position) request = { x: position[0], z: position[1], span: 7 };
    } else if (target.kind === "robot") {
      const spot = robotDisplayPosition(project, target.id);
      if (spot) request = { x: spot.x, z: spot.z, span: 8 };
    }
    if (request) selectionCtx?.requestFocus(request);
  };

  const selectAndFocus = (target: BuilderSelection) => {
    onSelect(target);
    focusSelection(target);
  };

  const beginRoomSelection = (room: BuilderRoom, event: React.PointerEvent, world: { x: number; z: number }) => {
    event.stopPropagation();
    selectAndFocus({ kind: "room", id: room.id });
    if (navigatorMode) return;
    dragRef.current = {
      kind: "room",
      id: room.id,
      dx: room.center[0] - world.x,
      dz: room.center[1] - world.z,
      moved: false,
    };
    capturePointer(svgRef.current, event.pointerId);
  };

  const isHovered = (kind: NonNullable<BuilderSelection>["kind"], id: string, componentId?: string) => {
    if (!hovered || hovered.kind !== kind || hovered.id !== id) return false;
    if (kind !== "puzzle") return true;
    return hovered.kind === "puzzle" && hovered.componentId === componentId;
  };

  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const current = viewportRef.current;
    const w = baseView.width / current.zoom;
    const h = baseView.height / current.zoom;
    const scale = Math.min(rect.width / w, rect.height / h);
    const offsetX = (rect.width - w * scale) / 2;
    const offsetY = (rect.height - h * scale) / 2;
    return {
      x: current.cx - w / 2 + (clientX - rect.left - offsetX) / scale,
      z: current.cz - h / 2 + (clientY - rect.top - offsetY) / scale,
      pixelScale: scale,
    };
  };

  // Wheel zoom (native listener: React wheel events are passive).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (navigatorMode) return;
      const world = toWorld(event.clientX, event.clientY);
      if (!world) return;
      const current = viewportRef.current;
      const nextZoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0014), 0.4, 4);
      const ratio = current.zoom / nextZoom;
      onViewportChange({
        zoom: nextZoom,
        cx: world.x - (world.x - current.cx) * ratio,
        cz: world.z - (world.z - current.cz) * ratio,
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigatorMode, onViewportChange]);

  const beginMove = (kind: "room" | "prop" | "pickup" | "robot" | "puzzle" | "routeSwitch" | "routeKey" | "routeOutputKey" | "wallDoorSwitch", id: string, event: React.PointerEvent, componentId?: string) => {
    if (placement || brush) return; // capture-phase placement/brush handler owns this click
    if (hostPick) {
      event.stopPropagation();
      if (kind === "prop") onPickPuzzleHost?.(id);
      return;
    }
    if (bindDoorMode) {
      // Bind mode: only doors are valid targets; let the wrapper explain.
      event.stopPropagation();
      selectAndFocus(kind === "puzzle" ? { kind, id, componentId } : kind === "routeKey" || kind === "routeOutputKey" ? { kind: "routeSwitch", id } : { kind, id });
      return;
    }
    const world = toWorld(event.clientX, event.clientY);
    if (!navigatorMode && (roomSelectionEnabled || roomPickModifierActive(event))) {
      const room = world ? roomAt(project, world.x, world.z) : null;
      if (world && room) {
        beginRoomSelection(room, event, world);
        return;
      }
    }
    event.stopPropagation();
    selectAndFocus(kind === "puzzle" ? { kind, id, componentId } : kind === "routeKey" || kind === "routeOutputKey" ? { kind: "routeSwitch", id } : { kind, id });
    if (navigatorMode) return;
    if (!world) return;
    let center: readonly [number, number] | undefined;
    if (kind === "room") center = project.rooms.find((room) => room.id === id)?.center;
    else if (kind === "prop") center = project.props.find((prop) => prop.id === id)?.position;
    else if (kind === "pickup") center = (project.pickups ?? []).find((pickup) => pickup.id === id)?.position;
    else if (kind === "puzzle") {
      const instance = puzzleInstances(project).find((candidate) => candidate.id === id);
      center = componentId ? instance?.components?.find((component) => component.id === componentId)?.position : instance?.position;
    } else if (kind === "routeSwitch") {
      center = project.routeSwitches?.find((route) => route.id === id)?.position;
    } else if (kind === "routeKey") {
      const route = project.routeSwitches?.find((candidate) => candidate.id === id);
      center = route ? routeKeyPosition(project, route) : undefined;
    } else if (kind === "routeOutputKey") {
      const route = project.routeSwitches?.find((candidate) => candidate.id === id);
      const index = route?.outputs.findIndex((output) => output.id === componentId) ?? -1;
      const output = index >= 0 ? route?.outputs[index] : undefined;
      center = route && output ? routeOutputKeyPosition(project, route, output, index) : undefined;
    } else if (kind === "wallDoorSwitch") {
      const wallSwitch = project.wallDoorSwitches?.find((candidate) => candidate.id === id);
      center = wallSwitch ? wallDoorSwitchPlanPosition(project, wallSwitch) ?? undefined : undefined;
    } else {
      const spot = robotDisplayPosition(project, id);
      center = spot ? [spot.x, spot.z] : undefined;
    }
    if (!center) return;
    dragRef.current =
      kind === "puzzle"
        ? { kind, id, componentId, dx: center[0] - world.x, dz: center[1] - world.z, moved: false }
        : kind === "routeOutputKey"
          ? { kind, id, outputId: componentId ?? "", dx: center[0] - world.x, dz: center[1] - world.z, moved: false }
        : { kind, id, dx: center[0] - world.x, dz: center[1] - world.z, moved: false };
    capturePointer(svgRef.current, event.pointerId);
  };

  const onPlacementPointerDownCapture = (event: React.PointerEvent) => {
    if (navigatorMode) return;
    if (!placement && !brush) return;
    event.stopPropagation();
    const world = toWorld(event.clientX, event.clientY);
    if (!world) return;
    if (brush) {
      const room = roomAt(project, world.x, world.z);
      if (room) onBrush(room.id, event.shiftKey);
      return;
    }
    const spot = placementAt(project, world.x, world.z, snapStep);
    if (spot.room && placementSpotIsValid(spot)) onPlace(spot.x, spot.z, spot.room.id);
  };

  const placementSpotFromClient = (clientX: number, clientY: number) => {
    const world = toWorld(clientX, clientY);
    if (!world) return null;
    return placementAt(project, world.x, world.z, snapStep);
  };

  const wallPlacementForPlacementSpot = (spot: NonNullable<ReturnType<typeof placementSpotFromClient>>) => {
    const entry = placement?.kind === "prop" ? propEntry(placement.modelKey) : null;
    if (!spot.room) return null;
    if (placement?.kind === "prop" && entry?.mount === "wall") {
      return wallMountedPropPlacementForEntryFromPoint(spot.room, spot.x, spot.z, {
        sizeMeters: entry.sizeMeters,
        wallMountFace: entry.wallMountFace,
      });
    }
    if (placement?.kind === "wallDoorSwitch") {
      return wallDoorSwitchDraftPlacementFromPoint(spot.room, spot.x, spot.z)?.placement ?? null;
    }
    return null;
  };

  const placementSpotIsValid = (spot: NonNullable<ReturnType<typeof placementSpotFromClient>>) => {
    const wallPlacement = wallPlacementForPlacementSpot(spot);
    const testX = wallPlacement?.plan[0] ?? spot.x;
    const testZ = wallPlacement?.plan[1] ?? spot.z;
    const testRotationY = wallPlacement?.yaw ?? (placement?.kind === "prop" ? placement.rotationY : 0);
    return (
      spot.valid &&
      (placement?.kind !== "wallDoorSwitch" || Boolean(wallPlacement)) &&
      Boolean(
        !placement ||
          placement.kind !== "prop" ||
          (spot.room &&
            resolvePropStacking(
              project,
              { modelKey: placement.modelKey, rotationY: testRotationY, scale: 1 },
              testX,
              testZ,
              spot.room.id,
            ).valid),
      )
    );
  };

  const updatePlacementGhostFromClient = (clientX: number, clientY: number) => {
    const spot = placementSpotFromClient(clientX, clientY);
    if (!spot) return;
    const wallPlacement = wallPlacementForPlacementSpot(spot);
    setGhost({
      x: wallPlacement?.plan[0] ?? spot.x,
      z: wallPlacement?.plan[1] ?? spot.z,
      valid: placementSpotIsValid(spot),
      ...(wallPlacement ? { rotationY: wallPlacement.yaw } : {}),
    });
  };

  const onCanvasDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (navigatorMode || !placement) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    updatePlacementGhostFromClient(event.clientX, event.clientY);
  };

  const onCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    if (navigatorMode || !placement) return;
    event.preventDefault();
    event.stopPropagation();
    const spot = placementSpotFromClient(event.clientX, event.clientY);
    if (!spot) return;
    updatePlacementGhostFromClient(event.clientX, event.clientY);
    if (spot.room && placementSpotIsValid(spot)) onPlace(spot.x, spot.z, spot.room.id);
  };

  const beginResize = (roomId: string, edge: "n" | "s" | "e" | "w", event: React.PointerEvent) => {
    if (navigatorMode) return;
    event.stopPropagation();
    onGestureStart();
    dragRef.current = { kind: "resize", id: roomId, edge };
    capturePointer(svgRef.current, event.pointerId);
  };

  const beginPan = (event: React.PointerEvent) => {
    if (navigatorMode || hostPick) {
      onSelect(null);
      return;
    }
    if (roomSelectionEnabled || roomPickModifierActive(event)) {
      const world = toWorld(event.clientX, event.clientY);
      const room = world ? roomAt(project, world.x, world.z) : null;
      if (room && world) {
        beginRoomSelection(room, event, world);
        return;
      }
    }
    dragRef.current = {
      kind: "pan",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCx: viewportRef.current.cx,
      startCz: viewportRef.current.cz,
      moved: false,
    };
    capturePointer(svgRef.current, event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (brush) {
      const world = toWorld(event.clientX, event.clientY);
      const room = world ? roomAt(project, world.x, world.z) : null;
      setBrushHover((current) => (room?.id ?? null) === current ? current : room?.id ?? null);
      return;
    }
    if (placement) {
      updatePlacementGhostFromClient(event.clientX, event.clientY);
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === "pan") {
      const world = toWorld(event.clientX, event.clientY);
      if (!world) return;
      const dxPx = event.clientX - drag.startClientX;
      const dzPx = event.clientY - drag.startClientY;
      if (Math.abs(dxPx) + Math.abs(dzPx) > 3) drag.moved = true;
      onViewportChange({
        zoom: viewportRef.current.zoom,
        cx: drag.startCx - dxPx / world.pixelScale,
        cz: drag.startCz - dzPx / world.pixelScale,
      });
      return;
    }

    const world = toWorld(event.clientX, event.clientY);
    if (!world) return;

    if (drag.kind === "resize") {
      update((draft) => ({
        ...draft,
        rooms: draft.rooms.map((room) => (room.id === drag.id ? resizeRoom(room, drag.edge, world.x, world.z) : room)),
      }), { record: false });
      return;
    }

    if (!drag.moved) {
      drag.moved = true;
      onGestureStart();
    }
    const step = drag.kind === "room" ? 1 : snapStep;
    let x = snap(world.x + drag.dx, step);
    let z = snap(world.z + drag.dz, step);
    if (drag.kind === "room") {
      const dragged = project.rooms.find((room) => room.id === drag.id);
      if (dragged) {
        const snapped = snapRoomToNeighbors({ ...dragged, center: [x, z] }, project.rooms.filter((room) => room.id !== drag.id));
        x = snapped.center[0];
        z = snapped.center[1];
        setSnapGuides(snapped.guides);
      }
    }
    const spot = drag.kind === "room" ? null : placementAt(project, x, z, snapStep);
    const targetRoom = spot?.room ?? null;
    if (drag.kind !== "room" && !targetRoom) return; // movable objects may not leave room bounds
    update((draft) => {
      if (drag.kind === "room") {
        return { ...draft, rooms: draft.rooms.map((room) => (room.id === drag.id ? { ...room, center: [x, z] } : room)) };
      }
      if (drag.kind === "prop") {
        const dragged = draft.props.find((prop) => prop.id === drag.id);
        if (!dragged) return draft;
        const wallPlacement = spot?.room ? wallMountedPlacementForProp(spot.room, dragged, x, z) : null;
        const basePosition = [wallPlacement?.plan[0] ?? x, wallPlacement?.plan[1] ?? z] as [number, number];
        const base = {
          ...dragged,
          position: basePosition,
          roomId: spot?.room ? spot.room.id : dragged.roomId,
          rotationY: wallPlacement?.yaw ?? dragged.rotationY,
          ...(wallPlacement && dragged.elevation === undefined ? { elevation: wallPlacement.position[1] } : {}),
        };
        const stacking = resolvePropStacking(draft, base, basePosition[0], basePosition[1], base.roomId, drag.id);
        if (!stacking.valid) return draft;
        return projectWithAnchoredPuzzleComponentsForProp(reflowAttachedProps({
          ...draft,
          props: draft.props.map((prop) =>
            prop.id === drag.id
              ? propWithStacking(base, stacking)
              : prop,
          ),
        }), drag.id);
      }
      if (drag.kind === "pickup") {
        return {
          ...draft,
          pickups: (draft.pickups ?? []).map((pickup) =>
            pickup.id === drag.id ? { ...pickup, position: [x, z], roomId: spot?.room ? spot.room.id : pickup.roomId } : pickup,
          ),
        };
      }
      if (drag.kind === "routeSwitch") {
        const route = (draft.routeSwitches ?? []).find((candidate) => candidate.id === drag.id);
        const hostProp = route?.hostPropId ? draft.props.find((prop) => prop.id === route.hostPropId) : null;
        if (hostProp) {
          const wallPlacement = spot?.room ? wallMountedPlacementForProp(spot.room, hostProp, x, z) : null;
          const basePosition = [wallPlacement?.plan[0] ?? x, wallPlacement?.plan[1] ?? z] as [number, number];
          const base = {
            ...hostProp,
            position: basePosition,
            roomId: spot?.room ? spot.room.id : hostProp.roomId,
            rotationY: wallPlacement?.yaw ?? hostProp.rotationY,
            ...(wallPlacement && hostProp.elevation === undefined ? { elevation: wallPlacement.position[1] } : {}),
          };
          const stacking = resolvePropStacking(draft, base, basePosition[0], basePosition[1], base.roomId, hostProp.id);
          if (!stacking.valid) return draft;
          const nextHostProp = propWithStacking(base, stacking);
          return projectWithHostedRouteSwitchProp(reflowAttachedProps({
            ...draft,
            props: draft.props.map((prop) =>
              prop.id === hostProp.id
                ? nextHostProp
                : prop,
            ),
          }), drag.id, nextHostProp);
        }
        return {
          ...draft,
          routeSwitches: (draft.routeSwitches ?? []).map((route) =>
            route.id === drag.id ? { ...route, position: [x, z], roomId: spot?.room ? spot.room.id : route.roomId } : route,
          ),
        };
      }
      if (drag.kind === "routeKey") {
        return {
          ...draft,
          routeSwitches: (draft.routeSwitches ?? []).map((route) =>
            route.id === drag.id ? { ...route, keyPosition: [x, z], keyRoomId: spot?.room ? spot.room.id : route.keyRoomId } : route,
          ),
        };
      }
      if (drag.kind === "routeOutputKey") {
        return {
          ...draft,
          routeSwitches: (draft.routeSwitches ?? []).map((route) =>
            route.id === drag.id
              ? {
                  ...route,
                  outputs: route.outputs.map((output) =>
                    output.id === drag.outputId
                      ? { ...output, keyPosition: [x, z] as const, keyRoomId: spot?.room ? spot.room.id : output.keyRoomId }
                      : output,
                  ),
                }
              : route,
          ),
        };
      }
      if (drag.kind === "wallDoorSwitch") {
        const room = spot?.room;
        if (!room) return draft;
        const wallMount = wallMountFromPoint(room, x, z);
        return {
          ...draft,
          wallDoorSwitches: (draft.wallDoorSwitches ?? []).map((wallSwitch) =>
            wallSwitch.id === drag.id ? { ...wallSwitch, roomId: room.id, wallMount: { ...wallSwitch.wallMount, ...wallMount } } : wallSwitch,
          ),
        };
      }
      if (drag.kind === "puzzle") {
        if (drag.componentId) {
          return projectWithAnchoredPuzzleComponentPlacement(draft, drag.id, drag.componentId, [x, z], targetRoom!.id);
        }
        if (spot?.room) {
          const instance = (draft.puzzles ?? []).find((candidate) => candidate.id === drag.id);
          if (instance?.wallMount) {
            const wallMount = wallMountFromPoint(spot.room, x, z);
            return {
              ...draft,
              puzzles: (draft.puzzles ?? []).map((candidate) =>
                candidate.id === drag.id
                  ? {
                      ...candidate,
                      roomId: spot.room!.id,
                      wallMount: { ...candidate.wallMount, ...wallMount, height: candidate.wallMount?.height ?? 1.34, inset: candidate.wallMount?.inset ?? 0.16 },
                    }
                  : candidate,
              ),
            };
          }
        }
        return {
          ...draft,
          puzzles: (draft.puzzles ?? []).map((instance) => {
            if (instance.id !== drag.id) return instance;
            return { ...instance, position: [x, z] as const, roomId: spot?.room ? spot.room.id : instance.roomId };
          }),
        };
      }
      return {
        ...draft,
        robots: draft.robots.map((robot) => (robot.id === drag.id ? { ...robot, position: [x, z], roomId: spot?.room ? spot.room.id : robot.roomId } : robot)),
      };
    }, { record: false });
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setSnapGuides([]);
    if (drag?.kind === "pan" && !drag.moved) onSelect(null);
  };

  const onPointerLeave = () => {
    onPointerUp();
    setBrushHover(null);
  };

  const robotsByRoom = useMemo(() => {
    const map = new Map<string, typeof project.robots>();
    for (const robot of project.robots) map.set(robot.roomId, [...(map.get(robot.roomId) ?? []), robot]);
    return map;
  }, [project.robots]);

  const criticalPolyline = useMemo(() => {
    const points: string[] = [];
    for (const roomId of criticalRoomIds) {
      const room = project.rooms.find((candidate) => candidate.id === roomId);
      if (room) points.push(`${room.center[0]},${room.center[1]}`);
    }
    return points.length >= 2 ? points.join(" ") : null;
  }, [criticalRoomIds, project.rooms]);

  const gridStep = effectiveViewport.zoom >= 2 ? 1 : 2;
  const gridLines = useMemo(() => {
    const xs: number[] = [];
    const zs: number[] = [];
    for (let v = Math.ceil(viewMinX / gridStep) * gridStep; v <= viewMinX + viewW; v += gridStep) xs.push(v);
    for (let v = Math.ceil(viewMinZ / gridStep) * gridStep; v <= viewMinZ + viewH; v += gridStep) zs.push(v);
    return { xs, zs };
  }, [gridStep, viewMinX, viewMinZ, viewW, viewH]);

  // One lookup map per render replaces the per-door O(rooms) scans below.
  const roomsById = useMemo(() => new Map(project.rooms.map((room) => [room.id, room])), [project.rooms]);
  const selectedRoom = selection?.kind === "room" ? roomsById.get(selection.id) ?? null : null;
  const armedBrushPreset = brush ? brushPreset(brush) : null;
  const flashRoom = paintFlash ? roomsById.get(paintFlash.roomId) ?? null : null;

  return (
    <div
      className={`builder-canvas ${navigatorMode ? "navigator" : "editor"} ${brush ? "brushing" : ""} ${bindDoorMode ? "binding" : ""} ${hostPick ? "host-picking" : ""}`}
      onDragOver={onCanvasDragOver}
      onDrop={onCanvasDrop}
    >
      <svg
        ref={svgRef}
        viewBox={`${viewMinX} ${viewMinZ} ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDownCapture={onPlacementPointerDownCapture}
        onPointerDown={beginPan}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        {/* Blueprint paper depth: gentle floor light-pool + edge vignette.
            Purely decorative, behind everything, never intercepts pointers. */}
        <defs>
          <radialGradient id="builder-plan-vignette" cx="50%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#c9a14f" stopOpacity="0.07" />
            <stop offset="46%" stopColor="#c9a14f" stopOpacity="0.015" />
            <stop offset="78%" stopColor="#060504" stopOpacity="0" />
            <stop offset="100%" stopColor="#060504" stopOpacity="0.42" />
          </radialGradient>
        </defs>
        <rect
          className="builder-plan-vignette"
          x={viewMinX}
          y={viewMinZ}
          width={viewW}
          height={viewH}
          fill="url(#builder-plan-vignette)"
        />

        <g className="builder-grid">
          {gridLines.xs.map((v) => <line key={`x${v}`} x1={v} y1={viewMinZ} x2={v} y2={viewMinZ + viewH} className={gridLineClass(v)} />)}
          {gridLines.zs.map((v) => <line key={`z${v}`} x1={viewMinX} y1={v} x2={viewMinX + viewW} y2={v} className={gridLineClass(v)} />)}
        </g>

        {criticalPolyline ? <polyline className="builder-critical-path" points={criticalPolyline} /> : null}

        {snapGuides.map((guide, index) => (
          <line key={`guide-${index}`} className="builder-snap-guide" x1={guide.x1} y1={guide.z1} x2={guide.x2} y2={guide.z2} />
        ))}

        {project.rooms.map((room, index) => {
          const selected = selection?.kind === "room" && selection.id === room.id;
          const onPath = criticalRoomIds.has(room.id);
          const floor = roomFloor(room);
          const wall = roomWall(room);
          const isBrushTarget = brush !== null && brushHover === room.id;
          const floorPreview = isBrushTarget && brush?.kind === "floor";
          const wallPreview = isBrushTarget && brush?.kind === "wall" && armedBrushPreset;
          const ceilingPreview = isBrushTarget && brush?.kind === "ceiling";
          // 2D wall slab stroke: painted override wins, else the wall preset accent (keeps room identity readable).
          const wallStroke = wallPreview ? armedBrushPreset.accent : room.env?.wallColor ?? wall.preset.accent;
          const [cx, cz] = room.center;
          const [w, d] = room.size;
          const wallT = 0.36;
          const tag =
            index === 0
              ? { text: en ? "◉ Spawn" : "◉ 出生", cls: "spawn" }
              : project.exitRoomId === room.id
                ? { text: en ? "🛗 Elevator" : "🛗 电梯", cls: "exit" }
                : null;
          return (
            <g
              key={room.id}
              className={`builder-room-group ${selected ? "selected" : ""} ${onPath ? "on-path" : ""} ${isBrushTarget ? "brush-target" : ""} ${tag?.cls === "exit" ? "is-exit" : ""} ${hoveredRoomId === room.id && !selected ? "hovered" : ""} ${roomPointerEnabled ? "" : "pick-disabled"}`}
              onPointerDown={roomPointerEnabled ? (event) => beginMove("room", room.id, event) : undefined}
              onPointerEnter={roomPointerEnabled ? () => onHover({ kind: "room", id: room.id }) : undefined}
              onPointerLeave={roomPointerEnabled ? () => onHover(null) : undefined}
            >
              {room.shape ? (
                <>
                  {/* shaped footprint: fill first, then an explicitly closed wall/trim path so no triangle edge disappears. */}
                  <path
                    className="builder-floor"
                    d={roomPolygonPath(room)}
                    fill={`url(#${floorPreview ? brushPreviewPatternId : roomFloorPatternId(room.id)})`}
                  />
                  <path
                    className="builder-floor-trim"
                    d={roomPolygonPath(room)}
                    style={{ stroke: floorPreview && armedBrushPreset ? armedBrushPreset.accent : floor.preset.accent }}
                  />
                  <path
                    className={`builder-wall ${wallPreview ? "brush-preview" : ""}`}
                    d={roomPolygonPath(room)}
                    fill="none"
                    style={{ stroke: wallStroke, strokeWidth: wallT }}
                  />
                  {isBrushTarget ? (
                    <path
                      className="builder-brush-outline"
                      d={roomPolygonPath(room)}
                      fill="none"
                      style={{ stroke: armedBrushPreset?.accent ?? "#aac4e2" }}
                    />
                  ) : null}
                  <path className="builder-room-hitbox" d={roomPolygonPath(room)} />
                </>
              ) : (
                <>
              {/* wall slab (stroke reflects wall paint; previews the armed wall brush on hover) */}
              <rect
                className={`builder-wall ${wallPreview ? "brush-preview" : ""}`}
                x={cx - w / 2}
                y={cz - d / 2}
                width={w}
                height={d}
                rx={0.1}
                style={{ stroke: wallStroke, strokeWidth: wallT }}
              />
              {/* floor with painted material pattern (previews the armed floor brush on hover) */}
              <rect
                className="builder-floor"
                x={cx - w / 2 + wallT / 2}
                y={cz - d / 2 + wallT / 2}
                width={w - wallT}
                height={d - wallT}
                fill={`url(#${floorPreview ? brushPreviewPatternId : roomFloorPatternId(room.id)})`}
              />
              {/* inner skirting line */}
              <rect
                className="builder-floor-trim"
                x={cx - w / 2 + wallT / 2 + 0.22}
                y={cz - d / 2 + wallT / 2 + 0.22}
                width={Math.max(0.2, w - wallT - 0.44)}
                height={Math.max(0.2, d - wallT - 0.44)}
                style={{ stroke: floorPreview && armedBrushPreset ? armedBrushPreset.accent : floor.preset.accent }}
              />
              {/* brush hover affordance: marching outline + ceiling glyph for the ceiling brush */}
              {isBrushTarget ? (
                <rect
                  className="builder-brush-outline"
                  x={cx - w / 2 - 0.18}
                  y={cz - d / 2 - 0.18}
                  width={w + 0.36}
                  height={d + 0.36}
                  rx={0.16}
                  style={{ stroke: armedBrushPreset?.accent ?? "#aac4e2" }}
                />
              ) : null}
              <rect
                className="builder-room-hitbox"
                x={cx - w / 2 + wallT / 2}
                y={cz - d / 2 + wallT / 2}
                width={w - wallT}
                height={d - wallT}
              />
                </>
              )}
              {ceilingPreview ? (
                <g className="builder-ceiling-preview" style={{ color: armedBrushPreset?.accent ?? roomCeiling(room).preset.accent }}>
                  <rect x={cx - w / 2 + 0.7} y={cz - d / 2 + 0.7} width={w - 1.4} height={d - 1.4} rx={0.2} />
                  <text x={cx} y={cz + 0.45}>⬒</text>
                </g>
              ) : null}
              <text className="builder-room-label" x={cx - w / 2 + 0.55} y={cz - d / 2 + 1.05}>
                {bl(room.label, language)}
              </text>
              {tag ? (
                <g className={`builder-room-pill ${tag.cls}`}>
                  <rect x={cx - 1.35} y={cz + d / 2 - 1.25} width={2.7} height={0.85} rx={0.42} />
                  <text x={cx} y={cz + d / 2 - 0.63}>{tag.text}</text>
                </g>
              ) : null}
            </g>
          );
        })}

        {selectedRoom ? (
          <>
            <rect
              className="builder-marching"
              x={selectedRoom.center[0] - selectedRoom.size[0] / 2 - 0.35}
              y={selectedRoom.center[1] - selectedRoom.size[1] / 2 - 0.35}
              width={selectedRoom.size[0] + 0.7}
              height={selectedRoom.size[1] + 0.7}
              rx={0.25}
            />
            {/* Edge resize is rectangle-only; shaped rooms are move/rotate. */}
            {selectedRoom.shape || navigatorMode ? null : (
              <RoomResizeHandles room={selectedRoom} zoom={viewport.zoom} onBegin={beginResize} />
            )}
          </>
        ) : null}

        {project.doors.map((door) => {
          const fromRoom = roomsById.get(door.fromRoomId);
          const toRoom = roomsById.get(door.toRoomId);
          if (!fromRoom || !toRoom) return null;
          const edge = sharedEdge(fromRoom, toRoom);
          const x = edge ? edge.position[0] : (fromRoom.center[0] + toRoom.center[0]) / 2;
          const z = edge ? edge.position[2] : (fromRoom.center[1] + toRoom.center[1]) / 2;
          const yawDeg = edge ? (edge.yaw * 180) / Math.PI : 0;
          const selected = selection?.kind === "door" && selection.id === door.id;
          const locked = door.lockType !== "none";
          const glyph = !edge
            ? "!"
            : door.lockType === "key_item"
              ? en ? "K" : "钥"
              : door.lockType === "survive_wave"
                ? en ? "F" : "战"
                : door.lockType === "puzzle_complete"
                  ? en ? "P" : "谜"
                  : "";
          const leaf = 1.5;
          return (
            <g
              key={door.id}
              className={`builder-door-group lock-${door.lockType} ${edge ? "" : "invalid"} ${selected ? "selected" : ""} ${isHovered("door", door.id) ? "hovered" : ""} ${criticalDoorIds.has(door.id) ? "on-path" : ""} ${bindDoorMode && edge ? "bind-target" : ""}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                selectAndFocus({ kind: "door", id: door.id });
              }}
              onPointerEnter={() => onHover({ kind: "door", id: door.id })}
              onPointerLeave={() => onHover(null)}
            >
              <title>
                {edge
                  ? bl(builderDoorDisplayLabel(door, project), language)
                  : en
                    ? `Invalid door: "${bl(fromRoom.label, language)}" and "${bl(toRoom.label, language)}" must share a flush edge ≥3.4 m to hold a door. Drag the rooms so their walls meet.`
                    : `无效门：「${fromRoom.label}」和「${toRoom.label}」必须共享一段 ≥3.4 米的贴合边才能放门。拖动房间使两边贴在一起。`}
              </title>
              {edge ? (
                <g transform={`rotate(${yawDeg} ${x} ${z})`}>
                  {/* opening punched through both wall slabs */}
                  <rect className="builder-door-gap" x={x - 1.6} y={z - 0.46} width={3.2} height={0.92} />
                  {/* jambs */}
                  <rect className="builder-door-jamb" x={x - 1.7} y={z - 0.46} width={0.22} height={0.92} />
                  <rect className="builder-door-jamb" x={x + 1.48} y={z - 0.46} width={0.22} height={0.92} />
                  {/* threshold strip */}
                  <line className="builder-door-threshold" x1={x - 1.45} y1={z} x2={x + 1.45} y2={z} />
                  {/* swing arc + leaf, floorplan style (hinge at the left jamb) */}
                  <path
                    className="builder-door-swing"
                    d={`M ${x - 1.45 + leaf} ${z} A ${leaf} ${leaf} 0 0 0 ${x - 1.45 + leaf * 0.64} ${z - leaf * 0.77}`}
                  />
                  <line className="builder-door-leaf" x1={x - 1.45} y1={z} x2={x - 1.45 + leaf * 0.64} y2={z - leaf * 0.77} />
                  {/* lock light strip across the opening */}
                  {locked ? <rect className="builder-door-lockstrip" x={x - 1.4} y={z - 0.1} width={2.8} height={0.2} rx={0.1} /> : null}
                </g>
              ) : (
                <rect className="builder-door builder-door-broken" x={x - 0.9} y={z - 0.9} width={1.8} height={1.8} rx={0.2} />
              )}
              {glyph ? (
                <g className="builder-door-chip">
                  <circle className={`builder-door-badge lock-${door.lockType} ${edge ? "" : "invalid"}`} cx={x} cy={z} r={0.56} />
                  <text className="builder-door-label" x={x} y={z + 0.3}>{glyph}</text>
                </g>
              ) : null}
            </g>
          );
        })}

        {/* puzzle terminals + orbs (freely placed) + dependency lines to their door */}
        {puzzleInstances(project).map((instance) => {
          const entry = puzzleKindEntry(instance.kind);
          const door = project.doors.find((candidate) => candidate.id === instance.linkedDoorId);
          const fromRoom = door ? project.rooms.find((candidate) => candidate.id === door.fromRoomId) : null;
          const toRoom = door ? project.rooms.find((candidate) => candidate.id === door.toRoomId) : null;
          const edge = fromRoom && toRoom ? sharedEdge(fromRoom, toRoom) : null;
          const doorX = edge ? edge.position[0] : null;
          const doorZ = edge ? edge.position[2] : null;
          const instanceSelected = selection?.kind === "puzzle" && selection.id === instance.id;
          const terminalSelected = instanceSelected && !selection?.componentId;
          const [px, pz] = puzzlePlanPosition(project, instance);
          return (
            <g key={instance.id} className={`builder-puzzle-group ${instanceSelected ? "selected" : ""}`} style={{ color: entry.color }}>
              {doorX !== null && doorZ !== null ? (
                <line className="builder-puzzle-link" x1={px} y1={pz} x2={doorX} y2={doorZ} />
              ) : null}
              {(instance.components ?? []).map((component) => {
                const componentSelected = instanceSelected && selection?.componentId === component.id;
                return (
                  <g
                    key={component.id}
                    className={`builder-puzzle-orb ${componentSelected ? "selected" : ""} ${isHovered("puzzle", instance.id, component.id) ? "hovered" : ""}`}
                    onPointerDown={(event) => beginMove("puzzle", instance.id, event, component.id)}
                    onPointerEnter={() => onHover({ kind: "puzzle", id: instance.id, componentId: component.id })}
                    onPointerLeave={() => onHover(null)}
                  >
                    <title>{en ? "Orb · drag to place (across rooms); shoot in the pattern order" : "色球 · 拖动摆放（可跨房间），按图案顺序击中"}</title>
                    <line className="builder-puzzle-orb-link" x1={component.position[0]} y1={component.position[1]} x2={px} y2={pz} />
                    <circle
                      className="builder-puzzle-orb-body"
                      cx={component.position[0]}
                      cy={component.position[1]}
                      r={componentSelected ? 0.46 : 0.38}
                      style={{ fill: orbColorHex(component.role) }}
                    />
                  </g>
                );
              })}
              <g
                className={`builder-puzzle-node ${terminalSelected ? "selected" : ""} ${isHovered("puzzle", instance.id) ? "hovered" : ""}`}
                onPointerDown={(event) => beginMove("puzzle", instance.id, event)}
                onPointerEnter={() => onHover({ kind: "puzzle", id: instance.id })}
                onPointerLeave={() => onHover(null)}
              >
                <title>{en ? `${bl(entry.label, language)} · puzzle console — drag to place; solving it opens the dashed-linked door` : `${entry.label} · 谜题台，拖动摆放；解开后打开虚线那扇门`}</title>
                <rect className="builder-puzzle-node-body" x={px - 0.55} y={pz - 0.55} width={1.1} height={1.1} rx={0.18} />
                <text className="builder-puzzle-node-glyph" x={px} y={pz + 0.26}>{entry.glyph}</text>
              </g>
            </g>
          );
        })}

        {(project.routeSwitches ?? []).map((route) => {
          const selected = selection?.kind === "routeSwitch" && selection.id === route.id;
          const [rx, rz] = route.position;
          return (
            <g key={route.id} className={`builder-route-group ${selected ? "selected" : ""} ${isHovered("routeSwitch", route.id) ? "hovered" : ""}`}>
              {route.outputs.slice(0, 4).map((output, index) => {
                const [kx, kz] = routeOutputKeyPosition(project, route, output, index);
                return (
                  <g key={`${output.id}-key`}>
                    <line className={`builder-route-key-link output-${index + 1}`} x1={kx} y1={kz} x2={rx} y2={rz} />
                    <g
                      className={`builder-route-key-node output-${index + 1}`}
                      transform={`translate(${kx} ${kz})`}
                      onPointerDown={(event) => beginMove("routeOutputKey", route.id, event, output.id)}
                      onPointerEnter={() => onHover({ kind: "routeSwitch", id: route.id })}
                      onPointerLeave={() => onHover(null)}
                    >
                      <title>{en ? `${route.label || "Control Route Switch"} output ${index + 1} orb · drag to place` : `${route.label || "管制路由台"}输出 ${index + 1} 授权球 · 拖动摆放`}</title>
                      <circle className="builder-route-key-ring" r={0.52} />
                      <circle className="builder-route-key-orb" r={0.33} />
                      <path className="builder-route-key-circuit" d="M-0.16 -0.03h0.14l0.07 -0.12M-0.16 0.12h0.18l0.12 0.12M0.03 -0.03h0.16M0.03 0.12h0.16" />
                      <text className="builder-route-key-glyph" x={0} y={0.12}>{index + 1}</text>
                    </g>
                  </g>
                );
              })}
              {route.outputs.map((output, index) => {
                const target = routeOutputTargetPosition(project, output);
                if (!target) return null;
                return (
                  <line
                    key={output.id}
                    className={`builder-route-link output-${index + 1}`}
                    x1={rx}
                    y1={rz}
                    x2={target[0]}
                    y2={target[1]}
                  />
                );
              })}
              <g
                className="builder-route-node"
                transform={`translate(${rx} ${rz}) rotate(${(-route.rotationY * 180) / Math.PI})`}
                onPointerDown={(event) => beginMove("routeSwitch", route.id, event)}
                onPointerEnter={() => onHover({ kind: "routeSwitch", id: route.id })}
                onPointerLeave={() => onHover(null)}
              >
                <title>{en ? `${route.label || "Control Route Switch"} · collect each output orb to toggle it` : `${route.label || "管制路由台"} · 拾取对应授权球后切换输出`}</title>
                <rect className="builder-route-node-body" x={-0.62} y={-0.5} width={1.24} height={1} rx={0.18} />
                <path className="builder-route-node-wire" d="M-0.34 0h0.42M0.08 0L0.42 -0.25M0.08 0l0.34 0.25" />
                <text className="builder-route-node-glyph" x={0} y={0.32}>{en ? "R" : "路"}</text>
              </g>
            </g>
          );
        })}

        {(project.wallDoorSwitches ?? []).map((wallSwitch) => {
          const selected = selection?.kind === "wallDoorSwitch" && selection.id === wallSwitch.id;
          const hovered = isHovered("wallDoorSwitch", wallSwitch.id);
          const position = wallDoorSwitchPlanPosition(project, wallSwitch);
          if (!position) return null;
          const [sx, sz] = position;
          const controlledDoorIds = [...new Set(effectiveWallDoorSwitchStates(wallSwitch).flatMap((state) => [...(state.openDoorIds ?? []), ...(state.closeDoorIds ?? [])]))];
          const linkedToSelectedDoor =
            selection?.kind === "door" &&
            (project.doors.find((door) => door.id === selection.id)?.wallDoorSwitchId === wallSwitch.id || controlledDoorIds.includes(selection.id));
          const showLinks = selected || hovered || linkedToSelectedDoor;
          return (
            <g key={wallSwitch.id} className={`builder-route-group builder-wall-switch-group ${selected || linkedToSelectedDoor ? "selected" : ""} ${hovered ? "hovered" : ""}`}>
              {showLinks
                ? controlledDoorIds.map((doorId, index) => {
                    const target = doorTargetPosition(project, doorId);
                    if (!target) return null;
                    return (
                      <line
                        key={doorId}
                        className={`builder-route-link builder-wall-switch-link output-${(index % 4) + 1}`}
                        x1={sx}
                        y1={sz}
                        x2={target[0]}
                        y2={target[1]}
                      />
                    );
                  })
                : null}
              <g
                className="builder-route-node builder-wall-switch-node"
                transform={`translate(${sx} ${sz})`}
                onPointerDown={(event) => beginMove("wallDoorSwitch", wallSwitch.id, event)}
                onPointerEnter={() => onHover({ kind: "wallDoorSwitch", id: wallSwitch.id })}
                onPointerLeave={() => onHover(null)}
              >
                <title>{en ? `${wallSwitch.label || "Wall Door Switch"} · press E to toggle door states` : `${wallSwitch.label || "墙面门控把手"} · 靠近按 E 切换门状态`}</title>
                <rect className="builder-route-node-body" x={-0.5} y={-0.62} width={1} height={1.24} rx={0.18} />
                <circle className="builder-route-node-wire" cx={0} cy={-0.06} r={0.22} />
                <text className="builder-route-node-glyph" x={0} y={0.35}>{en ? "W" : "控"}</text>
              </g>
            </g>
          );
        })}

        {(project.pickups ?? []).map((pickup) => {
          const entry = pickupEntry(pickup.kind);
          const selected = selection?.kind === "pickup" && selection.id === pickup.id;
          const grantedByPuzzle = pickup.kind === "key_item" && Boolean(pickup.grantedByPuzzleId);
          const pickupGlyph = grantedByPuzzle ? (en ? "P" : "谜") : entry.glyph;
          const pickupColor = grantedByPuzzle ? "#9bdcff" : entry.color;
          return (
            <g
              key={pickup.id}
              className={`builder-pickup-node ${selected ? "selected" : ""} ${isHovered("pickup", pickup.id) ? "hovered" : ""} ${grantedByPuzzle ? "granted" : ""}`}
              style={{ color: pickupColor }}
              transform={`translate(${pickup.position[0]} ${pickup.position[1]})`}
              onPointerDown={(event) => beginMove("pickup", pickup.id, event)}
              onPointerEnter={() => onHover({ kind: "pickup", id: pickup.id })}
              onPointerLeave={() => onHover(null)}
            >
              <title>
                {grantedByPuzzle
                  ? en
                    ? `${bl(entry.label, language)} · granted by puzzle, then appears here`
                    : `${entry.label} · 由谜题发放，解开后出现在这里`
                  : en
                    ? `${bl(entry.label, language)} · pickup — drag to place`
                    : `${entry.label} · 拾取物，拖动摆放`}
              </title>
              <circle className="builder-pickup-node-ring" r={0.48} />
              <circle className="builder-pickup-node-body" r={0.3} />
              {grantedByPuzzle ? <circle className="builder-pickup-node-grant" r={0.62} /> : null}
              <text className="builder-pickup-node-glyph" x={0} y={0.18}>{pickupGlyph}</text>
            </g>
          );
        })}

        {project.props.map((prop) => {
          const entry = propEntry(prop.modelKey);
          if (!entry) return null;
          const selected = selection?.kind === "prop" && selection.id === prop.id;
          const story = entry.group === "故事线索";
          const room = project.rooms.find((candidate) => candidate.id === prop.roomId);
          const wallPlacement = room ? wallMountedPlacementForProp(room, prop, prop.position[0], prop.position[1]) : null;
          const propPlan = wallPlacement?.plan ?? prop.position;
          const propRotationY = wallPlacement?.yaw ?? prop.rotationY;
          return (
            <g
              key={prop.id}
              className={`builder-prop-group ${isHovered("prop", prop.id) ? "hovered" : ""} ${selected ? "selected" : ""} ${hostPick ? "host-pick-target" : ""}`}
              transform={`translate(${propPlan[0]} ${propPlan[1]}) rotate(${(-propRotationY * 180) / Math.PI})`}
              onPointerDown={(event) => beginMove("prop", prop.id, event)}
              onPointerEnter={() => onHover({ kind: "prop", id: prop.id })}
              onPointerLeave={() => onHover(null)}
            >
              <title>{en ? `${bl(entry.label, language)}${story ? " (story clue)" : entry.solid ? " (solid collision)" : " (decoration)"}` : `${entry.label}${story ? "（故事线索）" : entry.solid ? "（实体碰撞）" : "（装饰）"}`}</title>
              <PropFootprintShape entry={entry} scale={prop.scale} selected={selected} />
              {story ? (
                <g className="builder-story-marker">
                  <circle cy={-(entry.sizeMeters[2] * prop.scale) / 2 - 0.52} r={0.3} />
                  <text y={-(entry.sizeMeters[2] * prop.scale) / 2 - 0.41}>✦</text>
                </g>
              ) : null}
            </g>
          );
        })}

        {[...robotsByRoom.entries()].map(([roomId, robots]) => {
          const room = project.rooms.find((candidate) => candidate.id === roomId);
          if (!room) return null;
          return robots.map((robot) => {
            const spot = robotDisplayPosition(project, robot.id);
            if (!spot) return null;
            const { x, z } = spot;
            const selected = selection?.kind === "robot" && selection.id === robot.id;
            const elite = robot.tier === "elite" || robot.archetype === "custodian_elite";
            const color = robotArchetypeColor(robot.archetype, robot.tier);
            const waveLabel = robot.wave?.presentation?.label ?? robot.wave?.label;
            return (
              <g
                key={robot.id}
                className={`builder-robot-group ${selected ? "selected" : ""} ${isHovered("robot", robot.id) ? "hovered" : ""}`}
                transform={`translate(${x} ${z})`}
                style={{ color }}
                onPointerDown={(event) => beginMove("robot", robot.id, event)}
                onPointerEnter={() => onHover({ kind: "robot", id: robot.id })}
                onPointerLeave={() => onHover(null)}
              >
                <title>{`${waveLabel ? `${waveLabel} · ` : ""}${bl(robotLabel(robot.archetype), language)} ×${robot.count}${robot.tier === "elite" ? (en ? " · Elite" : " · 精英") : ""}${robot.wave?.role === "reinforcement" ? (en ? " · Reinforcement" : " · 增援") : ""}`}</title>
                {elite ? <circle className="builder-robot-elite-ring" r={0.86} /> : null}
                {/* chassis + visor: reads as a hostile unit, not a badge */}
                <rect className="builder-robot-chassis" x={-0.5} y={-0.4} width={1} height={0.85} rx={0.2} />
                <rect className="builder-robot-visor" x={-0.3} y={-0.18} width={0.6} height={0.15} rx={0.07} />
                <text className="builder-robot-label" x={0} y={0.42}>{(en ? robotGlyphsEn : robotGlyphs)[robot.archetype] ?? (en ? "B" : "机")}</text>
                {/* count pips */}
                {Array.from({ length: Math.min(4, robot.count) }, (_, pip) => (
                  <rect key={pip} className="builder-robot-pip" x={-0.42 + pip * 0.24} y={0.55} width={0.16} height={0.12} rx={0.04} />
                ))}
              </g>
            );
          });
        })}

        {flashRoom && paintFlash ? (
          <rect
            key={paintFlash.token}
            className="builder-paint-flash"
            x={flashRoom.center[0] - flashRoom.size[0] / 2}
            y={flashRoom.center[1] - flashRoom.size[1] / 2}
            width={flashRoom.size[0]}
            height={flashRoom.size[1]}
            rx={0.18}
            style={{ color: paintFlash.color }}
          />
        ) : null}

        {placement && ghost ? (
          <g
            className={`builder-ghost ${ghost.valid ? "valid" : "invalid"}`}
            transform={`translate(${ghost.x} ${ghost.z})${placement.kind === "prop" ? ` rotate(${(-((ghost.rotationY ?? placement.rotationY) * 180)) / Math.PI})` : ""}`}
          >
            {placement.kind === "prop" ? (
              (() => {
                const entry = propEntry(placement.modelKey);
                return entry ? <PropFootprintShape entry={entry} scale={1} /> : <circle r={0.5} />;
              })()
            ) : placement.kind === "pickup" ? (
              <>
                <circle className="builder-pickup-node-ring" r={0.48} style={{ color: pickupEntry(placement.pickupKind).color }} />
                <circle className="builder-pickup-node-body" r={0.3} style={{ color: pickupEntry(placement.pickupKind).color }} />
                <text className="builder-pickup-node-glyph" x={0} y={0.18}>{pickupEntry(placement.pickupKind).glyph}</text>
              </>
            ) : placement.kind === "routeSwitch" ? (
              <>
                <rect className="builder-route-node-body" x={-0.62} y={-0.5} width={1.24} height={1} rx={0.18} />
                <path className="builder-route-node-wire" d="M-0.34 0h0.42M0.08 0L0.42 -0.25M0.08 0l0.34 0.25" />
                <text className="builder-route-node-glyph" x={0} y={0.32}>{en ? "R" : "路"}</text>
              </>
            ) : placement.kind === "wallDoorSwitch" ? (
              <>
                <rect className="builder-route-node-body" x={-0.38} y={-0.55} width={0.76} height={1.1} rx={0.16} />
                <circle className="builder-route-node-key" cx={0} cy={0.05} r={0.2} />
                <text className="builder-route-node-glyph" x={0} y={0.34}>{en ? "W" : "控"}</text>
              </>
            ) : (
              <>
                <circle className="builder-ghost-robot" r={0.62} />
                <circle className="builder-ghost-pulse" r={0.95} />
              </>
            )}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function RoomResizeHandles({
  room,
  zoom,
  onBegin,
}: {
  room: BuilderRoom;
  zoom: number;
  onBegin: (roomId: string, edge: "n" | "s" | "e" | "w", event: React.PointerEvent) => void;
}) {
  const [cx, cz] = room.center;
  const [w, d] = room.size;
  // Constant on-screen handle size regardless of zoom level.
  const half = Math.min(0.9, Math.max(0.28, 0.42 / zoom));
  const handles: { edge: "n" | "s" | "e" | "w"; x: number; z: number; cursor: string }[] = [
    { edge: "n", x: cx, z: cz - d / 2, cursor: "ns-resize" },
    { edge: "s", x: cx, z: cz + d / 2, cursor: "ns-resize" },
    { edge: "w", x: cx - w / 2, z: cz, cursor: "ew-resize" },
    { edge: "e", x: cx + w / 2, z: cz, cursor: "ew-resize" },
  ];
  return (
    <g>
      {handles.map((handle) => (
        <g key={handle.edge} style={{ cursor: handle.cursor }} onPointerDown={(event) => onBegin(room.id, handle.edge, event)}>
          {/* Generous invisible hit area around the visible handle. */}
          <rect x={handle.x - half * 2} y={handle.z - half * 2} width={half * 4} height={half * 4} fill="transparent" />
          <rect
            className="builder-resize-handle"
            x={handle.x - half}
            y={handle.z - half}
            width={half * 2}
            height={half * 2}
            rx={half * 0.4}
          />
        </g>
      ))}
    </g>
  );
}

function capturePointer(svg: SVGSVGElement | null, pointerId: number) {
  try {
    svg?.setPointerCapture?.(pointerId);
  } catch {
    // Synthetic or already-released pointers cannot be captured; dragging still works.
  }
}

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

/** Grid hierarchy class: world axis (0), a major cadence every 5 m, else minor.
 *  Purely a styling hint — keeps the SVG geometry/coordinates untouched. */
function gridLineClass(v: number): string {
  if (v === 0) return "axis";
  // tolerant of float drift from the stepping loop
  return Math.abs(v % 5) < 1e-6 || Math.abs((v % 5) - 5) < 1e-6 ? "major" : "minor";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function routeOutputTargetPosition(project: BuilderProject, output: BuilderRouteSwitchOutput): readonly [number, number] | null {
  if (output.kind === "open_door" && output.doorId) {
    return doorTargetPosition(project, output.doorId);
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

function doorTargetPosition(project: BuilderProject, doorId: string): readonly [number, number] | null {
  const door = project.doors.find((candidate) => candidate.id === doorId);
  if (!door) return null;
  const fromRoom = project.rooms.find((room) => room.id === door.fromRoomId);
  const toRoom = project.rooms.find((room) => room.id === door.toRoomId);
  if (!fromRoom || !toRoom) return null;
  const edge = sharedEdge(fromRoom, toRoom);
  return edge ? [edge.position[0], edge.position[2]] : [(fromRoom.center[0] + toRoom.center[0]) / 2, (fromRoom.center[1] + toRoom.center[1]) / 2];
}
