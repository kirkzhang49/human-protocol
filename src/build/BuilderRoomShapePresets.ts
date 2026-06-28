import { polygonBbox, type Vec2 } from "./BuilderRoomShape";
import type { BuilderRoomStyle } from "./BuilderTypes";

/**
 * Non-rectangular room shape presets for the /build rooms tab.
 *
 * Every shape is a polygon (N-gon); circles/semicircles are facet approximations.
 * Sizes are chosen so at least one edge clears the door overlap requirement
 * (~3.4 m) — otherwise a door could never attach to the room. The author rotates
 * the dropped room (inspector) so a facet lines up flush with a neighbour, and
 * the door auto-derives its angle from that shared edge.
 */

export interface BuilderRoomShapePreset {
  id: string;
  label: string;
  hint: string;
  accent: string;
  glyph: string;
  defaultStyle: BuilderRoomStyle;
  /** Local polygon points, centered on the origin (bbox-centered). */
  points: readonly Vec2[];
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Bbox-center a point list so room center + size stay consistent. */
function centerPoints(points: readonly Vec2[]): Vec2[] {
  const box = polygonBbox(points);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  return points.map(([x, z]) => [round(x - cx), round(z - cz)] as Vec2);
}

/** Regular N-gon centered on the origin. `rotationDeg` orients the first vertex. */
function regularNGon(sides: number, radius: number, rotationDeg = 0): Vec2[] {
  const base = (rotationDeg * Math.PI) / 180;
  const points: Vec2[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = base + (i / sides) * Math.PI * 2;
    points.push([round(Math.cos(angle) * radius), round(Math.sin(angle) * radius)]);
  }
  return centerPoints(points);
}

/** Half-disc: a curved arc closed by a flat diameter edge (the natural door wall). */
function semicircle(radius: number, segments = 16): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI;
    points.push([round(Math.cos(angle) * radius), round(Math.sin(angle) * radius)]);
  }
  return centerPoints(points);
}

/** Wide flat top + inward apex: easy to align a straight door wall from the room above. */
function doorFriendlyTriangle(): Vec2[] {
  return centerPoints([
    [-4, -2.6],
    [4, -2.6],
    [0, 2.6],
  ]);
}

const allBuilderRoomShapePresets: readonly BuilderRoomShapePreset[] = [
  {
    id: "triangle",
    label: "三角房",
    hint: "宽平顶三角，顶边是稳定门墙",
    accent: "#ffd9a8",
    glyph: "△",
    defaultStyle: "maintenance",
    points: doorFriendlyTriangle(),
  },
  {
    id: "hexagon",
    label: "六边形厅",
    hint: "正六边，六条边任选放门",
    accent: "#bfe6ff",
    glyph: "⬡",
    defaultStyle: "sterile",
    points: regularNGon(6, 4.0, 0),
  },
  {
    id: "octagon",
    label: "八角厅",
    hint: "八边形，接近圆形且每边可放门",
    accent: "#d6ebe8",
    glyph: "⯃",
    defaultStyle: "museum",
    points: regularNGon(8, 5.0, 22.5),
  },
  {
    id: "round_hall",
    label: "圆形大厅",
    hint: "十二边近似圆，需较大房间，门贴任一边",
    accent: "#e0b25a",
    glyph: "◯",
    defaultStyle: "museum",
    points: regularNGon(12, 7.0, 15),
  },
  {
    id: "semicircle",
    label: "半圆厅",
    hint: "半圆，平直的一边是天然门墙",
    accent: "#ffb34f",
    glyph: "◗",
    defaultStyle: "residential",
    points: semicircle(4.2, 16),
  },
];

// Only expose shapes whose authored flat edge can be auto-aligned by the current
// door tool. The hidden presets remain readable for old drafts and future work.
export const builderRoomShapePresets: readonly BuilderRoomShapePreset[] = allBuilderRoomShapePresets.filter((preset) => preset.id === "triangle" || preset.id === "semicircle");

export function roomShapePresetById(id: string): BuilderRoomShapePreset | undefined {
  return allBuilderRoomShapePresets.find((preset) => preset.id === id);
}
