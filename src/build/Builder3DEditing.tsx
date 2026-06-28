import type { ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import { propEntry } from "./BuilderAssetCatalog";
import type { BuilderBrush } from "./BuilderEnvironment";
import type { BuilderUpdate } from "./BuilderHistory";
import {
  pickAt,
  placementAt,
  roomAt,
  robotDisplayPosition,
  routeKeyPosition,
  routeOutputKeyPosition,
  wallDoorSwitchPlanPosition,
  wallMountFromPoint,
  wallMountedPropPlacementForEntryFromPoint,
  type PlacementDraft,
} from "./BuilderPlacementRules";
import { propWithStacking, reflowAttachedProps, resolvePropStacking } from "./BuilderPropStacking";
import {
  projectWithAnchoredPuzzleComponentPlacement,
  projectWithAnchoredPuzzleComponentsForProp,
} from "./BuilderPuzzlePlacement";
import { pickupEntry } from "./BuilderPickupCatalog";
import {
  introducedIssues,
  pickRoomHandle,
  resizeRoom,
  roomEditIssues,
  snapRoomToNeighbors,
  type RoomEdge,
  type RoomEditIssues,
} from "./BuilderRoomEditing";
import type { BuilderProject, BuilderProp, BuilderPuzzleHostPick, BuilderRoom, BuilderSelection } from "./BuilderTypes";

/** No-op unless a QA harness defines window.__qa3d; used to trace 3D event routing. */
function qaTrace(...args: unknown[]) {
  (window as unknown as { __qa3d?: unknown[][] }).__qa3d?.push(args as unknown[]);
}

export interface DoorEdgeInfo {
  id: string;
  fromRoomId?: string;
  toRoomId?: string;
  x: number;
  z: number;
  /** Wall tangent angle of the door, radians (0 = along x, π/2 = along z). */
  yaw: number;
}

type Drag3D =
  | { kind: "prop" | "pickup" | "robot" | "routeSwitch" | "routeKey" | "wallDoorSwitch"; id: string; dx: number; dz: number; moved: boolean }
  | { kind: "routeOutputKey"; id: string; outputId: string; dx: number; dz: number; moved: boolean }
  | { kind: "puzzle"; id: string; componentId?: string; dx: number; dz: number; moved: boolean }
  | { kind: "room-move"; id: string; dx: number; dz: number; axis: "x" | "z" | null; start: BuilderRoom; baseline: RoomEditIssues; moved: boolean }
  | { kind: "room-resize"; id: string; edge: RoomEdge; start: BuilderRoom; baseline: RoomEditIssues; moved: boolean };

interface HoverPoint {
  x: number;
  z: number;
  valid: boolean;
  rotationY?: number;
}

function stackingDragStatusText(resolution: ReturnType<typeof resolvePropStacking>, language: GameLanguage): string {
  if (resolution.reason === "no_support") return language === "en" ? "Place this on a table, shelf, or stack surface." : "需要放在桌面、书架或可堆叠物上。";
  if (resolution.reason === "stack_limit") return language === "en" ? "That stack is already at its height limit." : "这叠已经到高度上限，换个位置。";
  if (resolution.reason === "surface_occupied") return language === "en" ? "Surface occupied: move this item aside first." : "这个桌面位置已经被占用，先挪开小物件。";
  return language === "en" ? "Can't move this item here." : "这里不能移动这个物件。";
}

export interface Builder3DEditingApi {
  /** Spread onto the invisible ground box; all picking happens in plan space. */
  groundHandlers: {
    onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
    onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  };
  dragging: boolean;
  hover: HoverPoint | null;
  /** Kind of object currently under the cursor (cursor affordance). */
  hoverPickKind: "room" | "door" | "prop" | "pickup" | "robot" | "puzzle" | "routeSwitch" | "wallDoorSwitch" | null;
  /** True while a room move/resize gesture would introduce overlap/broken doors. */
  roomGestureInvalid: boolean;
  /** Clear hover state when the pointer leaves the 3D stage. */
  clearHover: () => void;
}

type ConcreteFloorPick = Exclude<ReturnType<typeof pickAt>, null>;

function selectionForFloorPick(pick: ConcreteFloorPick): BuilderSelection {
  if (pick.kind === "puzzle") return { kind: "puzzle", id: pick.id, componentId: pick.componentId };
  if (pick.kind === "routeKey" || pick.kind === "routeOutputKey") return { kind: "routeSwitch", id: pick.id };
  return { kind: pick.kind, id: pick.id };
}

function hoverKindForFloorPick(pick: ConcreteFloorPick | null): Builder3DEditingApi["hoverPickKind"] {
  if (!pick) return null;
  return pick.kind === "routeKey" || pick.kind === "routeOutputKey" ? "routeSwitch" : pick.kind;
}

interface Builder3DEditingOptions {
  project: BuilderProject;
  placement: PlacementDraft | null;
  selection: BuilderSelection;
  brush: BuilderBrush | null;
  /** Pan tool active: ground ignores pointer input (OrbitControls pans). */
  panMode: boolean;
  /** Active puzzle-host picking flow; while set, only props are clickable targets. */
  hostPick?: BuilderPuzzleHostPick | null;
  doorEdges: readonly DoorEdgeInfo[];
  snapStep?: number;
  /** Editor chrome language for the resize/overlap status strings (passed as a prop — this runs in-canvas). */
  language?: GameLanguage;
  update: BuilderUpdate;
  onSelect: (selection: BuilderSelection) => void;
  onHover?: (selection: BuilderSelection) => void;
  onPickPuzzleHost?: (propId: string) => void;
  onGestureStart: () => void;
  onPlace: (x: number, z: number, roomId: string) => void;
  onBrush: (roomId: string, shift: boolean) => void;
  onStatus?: (text: string) => void;
}

/** Real plan-space footprint [width, depth] — used for stacking + overlap. */
function propFootprintSize(modelKey: string): readonly [number, number] | null {
  const entry = propEntry(modelKey);
  return entry ? [entry.sizeMeters[0], entry.sizeMeters[2]] : null;
}

/**
 * Picking footprint. Wall/ceiling art hangs flush to a surface so its real depth
 * (~0.08m) is an unclickable sliver on the floor; widen the pick depth so the
 * painting under the cursor is actually selectable. Selection-only — the real
 * footprint (stacking/overlap) and catalog sizeMeters are untouched.
 */
function propPickFootprint(modelKey: string): readonly [number, number] | null {
  const entry = propEntry(modelKey);
  if (!entry) return null;
  const surfaceMount = entry.mount === "wall" || entry.mount === "ceiling";
  return [entry.sizeMeters[0], surfaceMount ? Math.max(entry.sizeMeters[2], 1.2) : entry.sizeMeters[2]];
}

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

/**
 * Sims-style floor editing for the 3D view. All interaction is resolved from the
 * floor point of a single ground raycast target: select (robot > prop > door >
 * room), drag with grid snap + room reassignment, room move/resize via gizmo
 * handles, environment brush clicks, and placement-ghost tracking.
 */
export function useBuilder3DEditing({
  project,
  placement,
  selection,
  brush,
  panMode,
  hostPick = null,
  doorEdges,
  snapStep = 0.5,
  language = "zh",
  update,
  onSelect,
  onHover,
  onPickPuzzleHost,
  onGestureStart,
  onPlace,
  onBrush,
  onStatus,
}: Builder3DEditingOptions): Builder3DEditingApi {
  const dragRef = useRef<Drag3D | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<HoverPoint | null>(null);
  const [hoverPickKind, setHoverPickKind] = useState<Builder3DEditingApi["hoverPickKind"]>(null);
  const [roomGestureInvalid, setRoomGestureInvalid] = useState(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  const doorEdgesRef = useRef(doorEdges);
  doorEdgesRef.current = doorEdges;
  const snapRef = useRef(snapStep);
  snapRef.current = snapStep;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const panRef = useRef(panMode);
  panRef.current = panMode;
  const hostPickRef = useRef(hostPick);
  hostPickRef.current = hostPick;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const onBrushRef = useRef(onBrush);
  onBrushRef.current = onBrush;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const languageRef = useRef(language);
  languageRef.current = language;
  const lastHoverPickRef = useRef<string | null>(null);

  const reportHover = useCallback(
    (pick: ConcreteFloorPick | null) => {
      const key = pick ? `${pick.kind}:${pick.id}:${pick.kind === "puzzle" ? pick.componentId ?? "" : ""}` : null;
      if (key === lastHoverPickRef.current) return;
      lastHoverPickRef.current = key;
      setHoverPickKind(hoverKindForFloorPick(pick));
      onHoverRef.current?.(pick ? selectionForFloorPick(pick) : null);
    },
    [],
  );

  const applyRoomGeometry = useCallback(
    (roomId: string, geometry: Pick<BuilderRoom, "center" | "size">, record: boolean) => {
      update(
        (draft) => ({
          ...draft,
          rooms: draft.rooms.map((room) => (room.id === roomId ? { ...room, center: geometry.center, size: geometry.size } : room)),
        }),
        { record },
      );
    },
    [update],
  );

  /** Finalizes room gestures: one clean undo step on commit, silent revert when a resize breaks geometry. */
  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    setRoomGestureInvalid(false);
    if (!drag || (drag.kind !== "room-move" && drag.kind !== "room-resize") || !drag.moved) return;

    const current = projectRef.current.rooms.find((room) => room.id === drag.id);
    if (!current) return;
    const unchanged =
      current.center[0] === drag.start.center[0] &&
      current.center[1] === drag.start.center[1] &&
      current.size[0] === drag.start.size[0] &&
      current.size[1] === drag.start.size[1];
    if (unchanged) return;
    const issues = roomEditIssues(projectRef.current, drag.id);
    const invalid = introducedIssues(drag.baseline, issues);
    const final = { center: current.center, size: current.size };

    if (drag.kind === "room-resize" && invalid) {
      applyRoomGeometry(drag.id, { center: drag.start.center, size: drag.start.size }, false);
      qaTrace("room-resize-revert", drag.id);
      onStatusRef.current?.(
        languageRef.current === "en"
          ? "Resize reverted: this size would break a door or overlap another room."
          : "调整已还原：这个尺寸会破坏门或与其它房间重叠。",
      );
      return;
    }
    // Commit as exactly one undo entry: silently restore the start, then apply the final state recorded.
    applyRoomGeometry(drag.id, { center: drag.start.center, size: drag.start.size }, false);
    applyRoomGeometry(drag.id, final, true);
    qaTrace("room-gesture-commit", drag.kind, drag.id);
    if (drag.kind === "room-move" && invalid) {
      onStatusRef.current?.(
        languageRef.current === "en"
          ? "Heads up: rooms overlap or a door is broken (shown in red). Ctrl+Z to undo."
          : "注意：房间重叠或有门失效（红色提示）。Ctrl+Z 可撤销。",
      );
    }
  }, [applyRoomGeometry]);

  useEffect(() => {
    window.addEventListener("pointerup", endDrag);
    return () => window.removeEventListener("pointerup", endDrag);
  }, [endDrag]);

  useEffect(() => {
    if (!placement) setHover(null);
    else reportHover(null);
  }, [placement, reportHover]);

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (panRef.current) return;
      const point = event.point;
      const current = projectRef.current;
      if (placement) {
        const spot = placementAt(current, point.x, point.z, snapRef.current);
        qaTrace("place", spot.x, spot.z, Boolean(spot.room));
        if (spot.room) onPlace(spot.x, spot.z, spot.room.id);
        return;
      }
      if (brushRef.current) {
        const room = roomAt(current, point.x, point.z);
        qaTrace("brush", room?.id ?? "none");
        if (room) onBrushRef.current(room.id, event.nativeEvent?.shiftKey ?? false);
        return;
      }
      if (hostPickRef.current) {
        const pick = pickAt(current, point.x, point.z, propPickFootprint, doorEdgesRef.current);
        qaTrace("host-pick", point.x.toFixed(1), point.z.toFixed(1), pick?.kind ?? "none", pick?.id ?? "");
        if (pick?.kind === "prop") onPickPuzzleHost?.(pick.id);
        else onStatusRef.current?.(languageRef.current === "en" ? "Furniture picking: click a highlighted prop." : "家具选择模式：请点击高亮的家具 / 展柜 / 面板。");
        return;
      }

      // Selected room: gizmo handles (resize edges / axis arrows / center pad) take priority.
      const selected = selectionRef.current;
      if (selected?.kind === "room") {
        const room = current.rooms.find((candidate) => candidate.id === selected.id);
        if (room) {
          const handle = pickRoomHandle(room, point.x, point.z);
          if (handle) {
            const baseline = roomEditIssues(current, room.id);
            dragRef.current =
              handle.type === "resize"
                ? { kind: "room-resize", id: room.id, edge: handle.edge, start: room, baseline, moved: false }
                : { kind: "room-move", id: room.id, dx: room.center[0] - point.x, dz: room.center[1] - point.z, axis: handle.axis, start: room, baseline, moved: false };
            setDragging(true);
            qaTrace("room-handle", handle.type, "axis" in handle ? handle.axis ?? "free" : handle.edge);
            return;
          }
        }
      }

      const pick = pickAt(current, point.x, point.z, propPickFootprint, doorEdgesRef.current);
      qaTrace("pick", point.x.toFixed(1), point.z.toFixed(1), pick?.kind ?? "none", pick?.id ?? "");

      // In 3D, pressing a room floor immediately arms a free-move drag. A plain
      // click still just selects it because endDrag ignores unmoved gestures.
      if (pick?.kind === "room") {
        const room = current.rooms.find((candidate) => candidate.id === pick.id);
        if (room) {
          onSelect({ kind: "room", id: room.id });
          dragRef.current = {
            kind: "room-move",
            id: room.id,
            dx: room.center[0] - point.x,
            dz: room.center[1] - point.z,
            axis: null,
            start: room,
            baseline: roomEditIssues(current, room.id),
            moved: false,
          };
          setDragging(true);
          return;
        }
      }

      onSelect(pick ? selectionForFloorPick(pick) : null);

      if (pick && (pick.kind === "prop" || pick.kind === "pickup" || pick.kind === "robot" || pick.kind === "puzzle" || pick.kind === "routeSwitch" || pick.kind === "routeKey" || pick.kind === "routeOutputKey" || pick.kind === "wallDoorSwitch")) {
        const position =
          pick.kind === "prop"
            ? current.props.find((prop) => prop.id === pick.id)?.position
            : pick.kind === "pickup"
              ? (current.pickups ?? []).find((pickup) => pickup.id === pick.id)?.position
            : pick.kind === "puzzle"
              ? (() => {
                  const instance = (current.puzzles ?? []).find((candidate) => candidate.id === pick.id);
                  return pick.componentId
                    ? instance?.components?.find((component) => component.id === pick.componentId)?.position
                    : instance?.position;
                })()
              : pick.kind === "routeKey"
                ? (() => {
                    const route = (current.routeSwitches ?? []).find((candidate) => candidate.id === pick.id);
                    return route ? routeKeyPosition(current, route) : undefined;
                  })()
              : pick.kind === "routeOutputKey"
                ? (() => {
                    const route = (current.routeSwitches ?? []).find((candidate) => candidate.id === pick.id);
                    const index = route?.outputs.findIndex((output) => output.id === pick.outputId) ?? -1;
                    const output = index >= 0 ? route?.outputs[index] : undefined;
                    return route && output ? routeOutputKeyPosition(current, route, output, index) : undefined;
                  })()
              : pick.kind === "routeSwitch"
                ? (current.routeSwitches ?? []).find((route) => route.id === pick.id)?.position
              : pick.kind === "wallDoorSwitch"
                ? (() => {
                    const wallSwitch = (current.wallDoorSwitches ?? []).find((candidate) => candidate.id === pick.id);
                    return wallSwitch ? wallDoorSwitchPlanPosition(current, wallSwitch) ?? undefined : undefined;
                  })()
              : (() => {
                  const spot = robotDisplayPosition(current, pick.id);
                  return spot ? ([spot.x, spot.z] as const) : undefined;
                })();
        if (position) {
          dragRef.current =
            pick.kind === "puzzle"
              ? { kind: "puzzle", id: pick.id, componentId: pick.componentId, dx: position[0] - point.x, dz: position[1] - point.z, moved: false }
              : pick.kind === "routeOutputKey"
                ? { kind: "routeOutputKey", id: pick.id, outputId: pick.outputId, dx: position[0] - point.x, dz: position[1] - point.z, moved: false }
              : { kind: pick.kind, id: pick.id, dx: position[0] - point.x, dz: position[1] - point.z, moved: false };
          setDragging(true);
        }
      }
    },
    [onPickPuzzleHost, onPlace, onSelect, placement],
  );

  const onPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (panRef.current) return;
      const point = event.point;
      const current = projectRef.current;
      if (placement) {
        const spot = placementAt(current, point.x, point.z, snapRef.current);
        const entry = placement.kind === "prop" ? propEntry(placement.modelKey) : null;
        const wallPlacement = placement.kind === "prop" && entry?.mount === "wall" && spot.room
          ? wallMountedPropPlacementForEntryFromPoint(spot.room, spot.x, spot.z, {
              sizeMeters: entry.sizeMeters,
              wallMountFace: entry.wallMountFace,
            })
          : null;
        const hoverX = wallPlacement?.plan[0] ?? spot.x;
        const hoverZ = wallPlacement?.plan[1] ?? spot.z;
        const hoverRotationY = wallPlacement?.yaw ?? (placement.kind === "prop" ? placement.rotationY : undefined);
        const valid =
          spot.valid &&
          Boolean(
            placement.kind !== "prop" ||
              (spot.room &&
                resolvePropStacking(
                  current,
                  { modelKey: placement.modelKey, rotationY: hoverRotationY ?? placement.rotationY, scale: 1 },
                  hoverX,
                  hoverZ,
                  spot.room.id,
                ).valid),
          );
        setHover({ x: hoverX, z: hoverZ, valid, ...(hoverRotationY !== undefined ? { rotationY: hoverRotationY } : {}) });
        return;
      }
      const drag = dragRef.current;
      if (!drag) {
        if (hostPickRef.current) {
          const pick = pickAt(current, point.x, point.z, propPickFootprint, doorEdgesRef.current);
          reportHover(pick?.kind === "prop" ? pick : null);
          return;
        }
        if (brushRef.current) {
          const room = roomAt(current, point.x, point.z);
          reportHover(room ? { kind: "room", id: room.id } : null);
          return;
        }
        // Idle hover: report the object under the cursor for highlight + cursor affordance.
        reportHover(pickAt(current, point.x, point.z, propPickFootprint, doorEdgesRef.current));
        return;
      }

      if (drag.kind === "room-move" || drag.kind === "room-resize") {
        drag.moved = true;
        const room = current.rooms.find((candidate) => candidate.id === drag.id);
        if (!room) return;
        let next: BuilderRoom;
        if (drag.kind === "room-resize") {
          next = resizeRoom(drag.start, drag.edge, point.x, point.z);
        } else {
          let x = snapTo(point.x + drag.dx, 1);
          let z = snapTo(point.z + drag.dz, 1);
          if (drag.axis === "x") z = drag.start.center[1];
          else if (drag.axis === "z") x = drag.start.center[0];
          const snapped = snapRoomToNeighbors({ ...room, center: [x, z] }, current.rooms.filter((other) => other.id !== drag.id));
          next = { ...room, center: drag.axis ? [x, z] : snapped.center };
        }
        applyRoomGeometry(drag.id, { center: next.center, size: next.size }, false);
        setRoomGestureInvalid(introducedIssues(drag.baseline, roomEditIssues(projectRef.current, drag.id)));
        return;
      }

      const spot = placementAt(current, point.x + drag.dx, point.z + drag.dz, snapRef.current);
      const targetRoom = spot.room;
      if (!targetRoom) return; // refuse to leave room bounds; object stays at last valid spot
      if (!drag.moved) {
        drag.moved = true;
        onGestureStart();
      }
      update((draft) => {
        if (drag.kind === "prop") {
          const dragged = draft.props.find((prop) => prop.id === drag.id);
          if (!dragged) return draft;
          const wallPlacement = spot.room ? wallMountedPlacementForProp(spot.room, dragged, spot.x, spot.z) : null;
          const basePosition = [wallPlacement?.plan[0] ?? spot.x, wallPlacement?.plan[1] ?? spot.z] as [number, number];
          const base = {
            ...dragged,
            position: basePosition,
            roomId: spot.room ? spot.room.id : dragged.roomId,
            rotationY: wallPlacement?.yaw ?? dragged.rotationY,
            ...(wallPlacement && dragged.elevation === undefined ? { elevation: wallPlacement.position[1] } : {}),
          };
          const stacking = resolvePropStacking(draft, base, basePosition[0], basePosition[1], base.roomId, drag.id);
          if (!stacking.valid) {
            onStatusRef.current?.(stackingDragStatusText(stacking, languageRef.current));
            return draft;
          }
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
              pickup.id === drag.id ? { ...pickup, position: [spot.x, spot.z], roomId: spot.room ? spot.room.id : pickup.roomId } : pickup,
            ),
          };
        }
        if (drag.kind === "puzzle") {
          if (drag.componentId) {
            return projectWithAnchoredPuzzleComponentPlacement(draft, drag.id, drag.componentId, [spot.x, spot.z], targetRoom.id);
          }
          const instance = (draft.puzzles ?? []).find((candidate) => candidate.id === drag.id);
          if (instance?.wallMount) {
            const room = spot.room;
            if (!room) return draft;
            const wallMount = wallMountFromPoint(room, spot.x, spot.z);
            return {
              ...draft,
              puzzles: (draft.puzzles ?? []).map((candidate) =>
                candidate.id === drag.id
                  ? {
                      ...candidate,
                      roomId: room.id,
                      wallMount: { ...candidate.wallMount, ...wallMount, height: candidate.wallMount?.height ?? 1.34, inset: candidate.wallMount?.inset ?? 0.16 },
                    }
                  : candidate,
              ),
            };
          }
          return {
            ...draft,
            puzzles: (draft.puzzles ?? []).map((instance) => {
              if (instance.id !== drag.id) return instance;
              return { ...instance, position: [spot.x, spot.z] as const, roomId: spot.room ? spot.room.id : instance.roomId };
            }),
          };
        }
        if (drag.kind === "routeSwitch") {
          return {
            ...draft,
            routeSwitches: (draft.routeSwitches ?? []).map((route) =>
              route.id === drag.id ? { ...route, position: [spot.x, spot.z], roomId: spot.room ? spot.room.id : route.roomId } : route,
            ),
          };
        }
        if (drag.kind === "routeKey") {
          return {
            ...draft,
            routeSwitches: (draft.routeSwitches ?? []).map((route) =>
              route.id === drag.id
                ? { ...route, keyPosition: [spot.x, spot.z] as const, keyRoomId: spot.room ? spot.room.id : route.keyRoomId }
                : route,
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
                        ? { ...output, keyPosition: [spot.x, spot.z] as const, keyRoomId: spot.room ? spot.room.id : output.keyRoomId }
                        : output,
                    ),
                  }
                : route,
            ),
          };
        }
        if (drag.kind === "wallDoorSwitch") {
          const room = spot.room;
          if (!room) return draft;
          const wallMount = wallMountFromPoint(room, spot.x, spot.z);
          return {
            ...draft,
            wallDoorSwitches: (draft.wallDoorSwitches ?? []).map((wallSwitch) =>
              wallSwitch.id === drag.id ? { ...wallSwitch, roomId: room.id, wallMount: { ...wallSwitch.wallMount, ...wallMount } } : wallSwitch,
            ),
          };
        }
        return {
          ...draft,
          robots: draft.robots.map((robot) =>
            robot.id === drag.id ? { ...robot, position: [spot.x, spot.z], roomId: spot.room ? spot.room.id : robot.roomId } : robot,
          ),
        };
      }, { record: false });
    },
    [applyRoomGeometry, onGestureStart, placement, reportHover, update],
  );

  const clearHover = useCallback(() => reportHover(null), [reportHover]);

  return { groundHandlers: { onPointerMove, onPointerDown }, dragging, hover, hoverPickKind, roomGestureInvalid, clearHover };
}

/** Invisible raycast target covering the whole buildable floor (flat box: no rotation needed). */
export function EditingGround({ api }: { api: Builder3DEditingApi }) {
  return (
    <mesh position={[0, -0.03, 0]} {...api.groundHandlers}>
      <boxGeometry args={[400, 0.02, 400]} />
      <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
    </mesh>
  );
}

/** Cyan/red placement preview following the cursor on the floor. */
export function PlacementGhost3D({ draft, hover }: { draft: PlacementDraft; hover: HoverPoint | null }) {
  if (!hover) return null;
  const color = hover.valid ? "#5ee8c8" : "#ff4d3d";
  if (draft.kind === "robot") {
    return (
      <group position={[hover.x, 0, hover.z]}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 1.1, 12]} />
          <meshStandardMaterial color={color} transparent opacity={0.5} emissive={color} emissiveIntensity={0.4} />
        </mesh>
        <GhostRing color={color} radius={0.8} />
      </group>
    );
  }
  if (draft.kind === "pickup") {
    const entry = pickupEntry(draft.pickupKind);
    return (
      <group position={[hover.x, 0, hover.z]}>
        <mesh position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.28, 16, 12]} />
          <meshStandardMaterial color={entry.color} transparent opacity={0.55} emissive={entry.color} emissiveIntensity={0.45} />
        </mesh>
        <GhostRing color={entry.color} radius={0.62} />
      </group>
    );
  }
  if (draft.kind === "routeSwitch") {
    return (
      <group position={[hover.x, 0, hover.z]}>
        <mesh position={[0, 0.22, 0]} scale={[0.95, 0.24, 0.64]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#061617" transparent opacity={0.46} emissive={color} emissiveIntensity={0.42} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.28, 24]} />
          <meshBasicMaterial color="#ffd76b" transparent opacity={0.78} toneMapped={false} depthWrite={false} />
        </mesh>
        <GhostRing color={color} radius={0.78} />
      </group>
    );
  }
  const entry = propEntry(draft.modelKey);
  const w = entry?.sizeMeters[0] ?? 1;
  const h = entry?.sizeMeters[1] ?? 1;
  const d = entry?.sizeMeters[2] ?? 1;
  return (
    <group position={[hover.x, 0, hover.z]} rotation={[0, hover.rotationY ?? draft.rotationY, 0]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} transparent opacity={0.42} emissive={color} emissiveIntensity={0.35} depthWrite={false} />
      </mesh>
      <GhostRing color={color} radius={Math.hypot(w, d) / 2 + 0.25} />
    </group>
  );
}

function GhostRing({ color, radius }: { color: string; radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[radius, radius + 0.16, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function snapTo(value: number, step: number) {
  return Math.round(value / step) * step;
}
