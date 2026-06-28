import { defaultPropElevation, propEntry, type BuilderPropEntry, type BuilderSupportSurface, type BuilderSupportSurfaceKind } from "./BuilderAssetCatalog";
import type { BuilderProject, BuilderProp } from "./BuilderTypes";

export interface PropStackDraft {
  id?: string;
  modelKey: string;
  rotationY: number;
  scale: number;
}

export interface PropSurfaceHit {
  parentPropId: string;
  parentSurfaceId: string;
  surfaceKind: BuilderSupportSurfaceKind;
  elevation: number;
  localPosition: readonly [number, number];
  localRotationY: number;
  parentLabel: string;
}

export interface PropStackingResolution {
  valid: boolean;
  elevation: number;
  hit?: PropSurfaceHit;
  overlapPropId?: string;
  reason?: "no_support" | "surface_occupied" | "stack_limit";
  message?: string;
}

const SURFACE_MARGIN = 0.04;
const DEFAULT_TOP_SURFACE_ID = "auto_top";
const DEFAULT_SMALL_PROP_SURFACE_ID = "small_prop_top";

export function canRestOnSupport(entry: BuilderPropEntry | null): boolean {
  if (!entry) return false;
  if (entry.mount === "wall" || entry.mount === "ceiling") return false;
  if (entry.stacking?.canRestOn?.some((kind) => kind !== "floor")) return true;
  if (entry.mount === "tabletop") return true;
  const [width, height, depth] = entry.sizeMeters;
  return !entry.solid && Math.max(width, depth) <= 0.78 && height <= 1.25;
}

export function supportSurfacesForEntry(entry: BuilderPropEntry | null): readonly BuilderSupportSurface[] {
  if (!entry) return [];
  if (entry.supportSurfaces?.length) return entry.supportSurfaces;

  const [width, height, depth] = entry.sizeMeters;
  if (entry.stacking?.canSupport) {
    return [
      {
        id: DEFAULT_SMALL_PROP_SURFACE_ID,
        kind: "smallPropTop",
        localCenter: [0, height, 0],
        size: [Math.max(0.08, width * 0.72), Math.max(0.08, depth * 0.72)],
        maxChildHeight: 0.35,
      },
    ];
  }

  const familySupports =
    entry.family === "desk" ||
    entry.family === "control_console" ||
    entry.family === "cabinet" ||
    entry.family === "drawer_chest" ||
    entry.family === "bookshelf" ||
    entry.family === "display_case" ||
    entry.family === "safe" ||
    entry.family === "storage_crate";
  if (!entry.canHoldSmallProps && !familySupports) return [];

  const shelf = entry.family === "bookshelf";
  return [
    {
      id: DEFAULT_TOP_SURFACE_ID,
      kind: shelf ? "shelf" : "tabletop",
      localCenter: [0, height * 0.96, 0],
      size: [Math.max(0.12, width * (shelf ? 0.72 : 0.78)), Math.max(0.1, depth * (shelf ? 0.55 : 0.72))],
      maxChildHeight: shelf ? 0.45 : 1.1,
    },
  ];
}

export function propStackFootprint(entry: BuilderPropEntry | null, scale = 1): readonly [number, number] {
  if (!entry) return [0.5 * scale, 0.5 * scale];
  const footprint = entry.stacking?.footprint ?? [entry.sizeMeters[0], entry.sizeMeters[2]];
  return [Math.max(0.05, footprint[0] * scale), Math.max(0.05, footprint[1] * scale)];
}

export function propStackHeight(entry: BuilderPropEntry | null, scale = 1): number {
  if (!entry) return 0.5 * scale;
  return Math.max(0.05, (entry.stacking?.height ?? entry.sizeMeters[1]) * scale);
}

function allowedSurfaceKinds(entry: BuilderPropEntry): readonly ("floor" | BuilderSupportSurfaceKind)[] {
  if (entry.stacking?.canRestOn?.length) return entry.stacking.canRestOn;
  if (entry.mount === "tabletop") return ["tabletop", "shelf", "smallPropTop"];
  if (canRestOnSupport(entry)) return ["floor", "tabletop", "shelf", "smallPropTop"];
  return ["floor"];
}

function propElevation(prop: BuilderProp): number {
  return prop.elevation ?? defaultPropElevation(prop.modelKey);
}

function toLocalPoint(prop: BuilderProp, x: number, z: number): readonly [number, number] {
  const scale = prop.scale || 1;
  const dx = x - prop.position[0];
  const dz = z - prop.position[1];
  const cos = Math.cos(prop.rotationY);
  const sin = Math.sin(prop.rotationY);
  return [(dx * cos - dz * sin) / scale, (dx * sin + dz * cos) / scale];
}

function localToWorldPoint(prop: BuilderProp, localX: number, localZ: number): readonly [number, number] {
  const scale = prop.scale || 1;
  const cos = Math.cos(prop.rotationY);
  const sin = Math.sin(prop.rotationY);
  return [
    prop.position[0] + (localX * cos + localZ * sin) * scale,
    prop.position[1] + (-localX * sin + localZ * cos) * scale,
  ];
}

function wouldCreateCycle(project: BuilderProject, childId: string | undefined, parentId: string): boolean {
  if (!childId) return false;
  if (childId === parentId) return true;
  let current = project.props.find((prop) => prop.id === parentId);
  const seen = new Set<string>();
  while (current?.parentPropId) {
    if (current.parentPropId === childId) return true;
    if (seen.has(current.parentPropId)) return true;
    seen.add(current.parentPropId);
    current = project.props.find((prop) => prop.id === current?.parentPropId);
  }
  return false;
}

function surfaceContainsPoint(
  parent: BuilderProp,
  surface: BuilderSupportSurface,
  childFootprint: readonly [number, number],
  x: number,
  z: number,
): readonly [number, number] | null {
  const parentScale = parent.scale || 1;
  const [localX, localZ] = toLocalPoint(parent, x, z);
  const usableHalfW = Math.max(0, surface.size[0] / 2 - childFootprint[0] / (2 * parentScale) - SURFACE_MARGIN);
  const usableHalfD = Math.max(0, surface.size[1] / 2 - childFootprint[1] / (2 * parentScale) - SURFACE_MARGIN);
  if (Math.abs(localX - surface.localCenter[0]) <= usableHalfW && Math.abs(localZ - surface.localCenter[2]) <= usableHalfD) {
    return [localX, localZ];
  }
  return null;
}

function childSurfaceLocalPosition(parent: BuilderProp, child: BuilderProp): readonly [number, number] {
  if (child.localPosition && child.parentPropId === parent.id) return child.localPosition;
  return toLocalPoint(parent, child.position[0], child.position[1]);
}

function supportStackDepth(project: BuilderProject, prop: BuilderProp): number {
  let depth = 0;
  let current: BuilderProp | undefined = prop;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (propEntry(current.modelKey)?.stacking?.canSupport) depth += 1;
    current = current.parentPropId ? project.props.find((candidate) => candidate.id === current?.parentPropId) : undefined;
  }
  return depth;
}

function surfaceOverlap(
  project: BuilderProject,
  draft: PropStackDraft,
  hit: PropSurfaceHit,
  excludeId?: string,
): BuilderProp | null {
  const parent = project.props.find((prop) => prop.id === hit.parentPropId);
  if (!parent) return null;
  const entry = propEntry(draft.modelKey);
  const [childW, childD] = propStackFootprint(entry, draft.scale);
  const parentScale = parent.scale || 1;
  const childHalfW = childW / (2 * parentScale);
  const childHalfD = childD / (2 * parentScale);

  for (let index = project.props.length - 1; index >= 0; index -= 1) {
    const sibling = project.props[index];
    if (sibling.id === excludeId || sibling.id === draft.id) continue;
    if (sibling.parentPropId !== hit.parentPropId || sibling.parentSurfaceId !== hit.parentSurfaceId) continue;
    const siblingEntry = propEntry(sibling.modelKey);
    const [sibW, sibD] = propStackFootprint(siblingEntry, sibling.scale);
    const [sx, sz] = childSurfaceLocalPosition(parent, sibling);
    const siblingHalfW = sibW / (2 * parentScale);
    const siblingHalfD = sibD / (2 * parentScale);
    const overlapX = Math.abs(hit.localPosition[0] - sx) < childHalfW + siblingHalfW + SURFACE_MARGIN;
    const overlapZ = Math.abs(hit.localPosition[1] - sz) < childHalfD + siblingHalfD + SURFACE_MARGIN;
    if (overlapX && overlapZ) return sibling;
  }
  return null;
}

export function resolvePropStacking(
  project: BuilderProject,
  draft: PropStackDraft,
  x: number,
  z: number,
  roomId: string,
  excludeId?: string,
): PropStackingResolution {
  const entry = propEntry(draft.modelKey);
  const baseElevation = defaultPropElevation(draft.modelKey);
  if (!entry || !canRestOnSupport(entry)) return { valid: true, elevation: baseElevation };

  const allowed = new Set(allowedSurfaceKinds(entry));
  const childFootprint = propStackFootprint(entry, draft.scale);
  const childHeight = propStackHeight(entry, draft.scale);
  let best: PropSurfaceHit | undefined;
  let blockedReason: PropStackingResolution["reason"] | undefined;

  for (const parent of project.props) {
    if (parent.id === excludeId || parent.id === draft.id || parent.roomId !== roomId) continue;
    if (wouldCreateCycle(project, draft.id, parent.id)) continue;
    const parentEntry = propEntry(parent.modelKey);
    const surfaces = supportSurfacesForEntry(parentEntry);
    for (const surface of surfaces) {
      if (!allowed.has(surface.kind)) continue;
      const local = surfaceContainsPoint(parent, surface, childFootprint, x, z);
      if (!local) continue;
      if (surface.maxChildHeight !== undefined && childHeight > surface.maxChildHeight) {
        blockedReason = "no_support";
        continue;
      }
      if (
        surface.kind === "smallPropTop" &&
        parentEntry?.stacking?.maxStackLayers !== undefined &&
        supportStackDepth(project, parent) >= parentEntry.stacking.maxStackLayers
      ) {
        blockedReason = "stack_limit";
        continue;
      }
      const elevation = propElevation(parent) + surface.localCenter[1] * (parent.scale || 1);
      if (best && elevation <= best.elevation + 0.005) continue;
      best = {
        parentPropId: parent.id,
        parentSurfaceId: surface.id,
        surfaceKind: surface.kind,
        elevation,
        localPosition: local,
        localRotationY: draft.rotationY - parent.rotationY,
        parentLabel: parentEntry?.label ?? parent.modelKey,
      };
    }
  }

  if (!best) {
    if (blockedReason === "stack_limit") {
      return { valid: false, elevation: baseElevation, reason: "stack_limit", message: "Stack height limit reached" };
    }
    if (!allowed.has("floor")) {
      return { valid: false, elevation: baseElevation, reason: "no_support", message: "Needs a tabletop, shelf, or stack surface" };
    }
    return { valid: true, elevation: baseElevation };
  }
  const overlap = surfaceOverlap(project, draft, best, excludeId);
  if (overlap) {
    const label = propEntry(overlap.modelKey)?.label ?? overlap.modelKey;
    return {
      valid: false,
      elevation: best.elevation,
      hit: best,
      overlapPropId: overlap.id,
      reason: "surface_occupied",
      message: `Surface occupied by ${label}`,
    };
  }
  return { valid: true, elevation: best.elevation, hit: best };
}

export function propWithStacking(prop: BuilderProp, resolution: PropStackingResolution): BuilderProp {
  if (!resolution.hit) {
    return {
      ...prop,
      elevation: resolution.elevation > 0 ? resolution.elevation : undefined,
      parentPropId: undefined,
      parentSurfaceId: undefined,
      localPosition: undefined,
      localRotationY: undefined,
    };
  }
  return {
    ...prop,
    elevation: resolution.elevation,
    parentPropId: resolution.hit.parentPropId,
    parentSurfaceId: resolution.hit.parentSurfaceId,
    localPosition: resolution.hit.localPosition,
    localRotationY: resolution.hit.localRotationY,
  };
}

export function clearPropStacking(prop: BuilderProp, floorElevation = 0): BuilderProp {
  return {
    ...prop,
    elevation: floorElevation > 0 ? floorElevation : undefined,
    parentPropId: undefined,
    parentSurfaceId: undefined,
    localPosition: undefined,
    localRotationY: undefined,
  };
}

export function attachedChildCount(project: BuilderProject, propId: string): number {
  return project.props.filter((prop) => prop.parentPropId === propId).length;
}

export function reflowAttachedProps(project: BuilderProject): BuilderProject {
  let props = project.props.map((prop) => ({ ...prop }));
  for (let pass = 0; pass < props.length; pass += 1) {
    let changed = false;
    props = props.map((prop) => {
      if (!prop.parentPropId || !prop.parentSurfaceId || !prop.localPosition) return prop;
      const parent = props.find((candidate) => candidate.id === prop.parentPropId);
      const parentEntry = parent ? propEntry(parent.modelKey) : null;
      const surface = supportSurfacesForEntry(parentEntry).find((candidate) => candidate.id === prop.parentSurfaceId);
      if (!parent || !surface) {
        changed = true;
        return clearPropStacking(prop, 0);
      }
      const [x, z] = localToWorldPoint(parent, prop.localPosition[0], prop.localPosition[1]);
      const elevation = propElevation(parent) + surface.localCenter[1] * (parent.scale || 1);
      const rotationY = parent.rotationY + (prop.localRotationY ?? 0);
      const next = { ...prop, position: [x, z] as [number, number], roomId: parent.roomId, elevation, rotationY };
      changed =
        changed ||
        next.position[0] !== prop.position[0] ||
        next.position[1] !== prop.position[1] ||
        next.roomId !== prop.roomId ||
        next.elevation !== prop.elevation ||
        next.rotationY !== prop.rotationY;
      return next;
    });
    if (!changed) break;
  }
  return { ...project, props };
}
