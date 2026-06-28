import type { ReactNode } from "react";
import { builderRoomStyles, propEntry, roomStyleEntry, type BuilderPropEntry } from "./BuilderAssetCatalog";
import { generatedBuilderPackFootprints } from "./generatedBuilderAssetFootprints";
import type { BuilderRobotArchetype, BuilderRoomStyle } from "./BuilderTypes";

/**
 * Top-down furniture silhouettes for the 2D floorplan + catalog thumbnails.
 * Every catalog modelKey maps to a footprint family; unknown keys fall back to "generic".
 */
export type FootprintFamily =
  | "table"
  | "chair"
  | "sofa"
  | "bed"
  | "cabinet"
  | "wall_panel"
  | "crate"
  | "books"
  | "lamp"
  | "display_case"
  | "column"
  | "barrier"
  | "pedestal"
  | "generic";

const footprintByModelKey: Record<string, FootprintFamily> = {
  room_table_utility: "table",
  room_lounge_low_table_residential: "table",
  room_chair_service: "chair",
  room_lounge_sofa_residential: "sofa",
  room_residential_recovery_bed: "bed",
  room_locker_low: "cabinet",
  room_maintenance_supply_cabinet: "cabinet",
  room_fuse_box: "wall_panel",
  hero_maintenance_repair_bay: "bed",
  hero_maintenance_repair_arm_cluster: "display_case",
  light_wall_medical_strip_cyan_1m: "wall_panel",
  light_ceiling_flicker_cyan_2m: "lamp",
  room_museum_wall_label_panel: "wall_panel",
  room_fake_family_photo_wall: "wall_panel",
  age_museum_wall_art_human_origin: "wall_panel",
  decal_human_body_reference: "wall_panel",
  decal_human_reference_triptych: "wall_panel",
  decal_human_hand_reference: "wall_panel",
  decal_human_spine_reference: "wall_panel",
  age_museum_wall_art_robot_worker: "wall_panel",
  age_museum_wall_art_protocol_diagram: "wall_panel",
  age_museum_wall_art_last_human: "wall_panel",
  l4_story_awakened_machine_image2_v1: "wall_panel",
  l4_story_preserved_childhood_image2_v1: "wall_panel",
  l4_story_rescue_loop_image2_v1: "wall_panel",
  l4_story_h0_discharge_image2_v1: "wall_panel",
  room_crate_stack: "crate",
  prop_archive_folder_stack: "books",
  light_residential_lamp_warm: "lamp",
  room_museum_display_case_tool: "display_case",
  room_museum_archive_column: "column",
  room_museum_low_barrier: "barrier",
  room_museum_color_orb_pedestal: "pedestal",
  // CC0 furniture (Poly Haven).
  room_cc0_sofa: "sofa",
  room_cc0_armchair: "chair",
  room_cc0_coffee_table: "table",
  room_cc0_shelf: "cabinet",
  room_cc0_tv: "cabinet",
  room_cc0_sofa2: "sofa",
  room_cc0_armchair2: "chair",
  room_cc0_bed: "bed",
  room_cc0_plant: "pedestal",
  room_cc0_clock: "lamp",
  room_cc0_bust: "pedestal",
  room_cc0_console: "table",
  room_cc0_horse: "pedestal",
  room_cc0_horse_statue_plinth: "pedestal",
  room_cc0_bull_head_plinth: "pedestal",
  room_cc0_brass_vase_02: "pedestal",
  room_cc0_antique_ceramic_vase_01: "pedestal",
  room_cc0_barrel: "crate",
  room_cc0_wood_table: "table",
  room_cc0_chest: "crate",
  room_cc0_plant2: "pedestal",
  room_cc0_lantern: "lamp",
  room_cc0_chandelier_02_ceiling: "lamp",
  room_museum_specimen_plinth: "pedestal",
  room_museum_glass_vitrine_specimen: "display_case",
  room_museum_specimen_jar_tall_01: "display_case",
  room_museum_gallery_bench: "table",
  room_museum_archive_cabinet_drawers_brass: "cabinet",
  room_museum_sarcophagus_stone_bier: "display_case",
  room_museum_statue_pedestal: "pedestal",
  room_museum_rope_stanchion: "barrier",
  room_museum_info_lectern: "pedestal",
  room_museum_skeleton_mount: "display_case",
  room_museum_cloche_dome: "display_case",
  room_museum_voice_archive_case: "display_case",
  room_museum_skeleton_vitrine: "display_case",
  room_museum_last_human_tool_vitrine: "display_case",
  hp_furniture_museum_glass_display_case_v1: "display_case",
  hp_furniture_museum_horizontal_tool_case_v1: "display_case",
  hp_furniture_museum_gallery_bench_v1: "table",
  hp_furniture_archive_cabinet_v1: "cabinet",
  hp_furniture_maintenance_cart_v1: "table",
  hp_furniture_display_plinth_v1: "pedestal",
  hp_furniture_wall_archive_cabinet_v1: "wall_panel",
  hp_furniture_lab_table_v1: "table",
  hp_furniture_cold_ceiling_light_slot_v1: "lamp",
  hp_furniture_specimen_plinth_combo_v1: "pedestal",
  room_l01_p01: "wall_panel",
  room_l01_p02: "table",
  room_l01_p03: "cabinet",
  room_l01_p04: "cabinet",
  room_l01_p05: "lamp",
  room_l01_p06: "crate",
  room_l01_p07: "pedestal",
  room_l01_p08: "display_case",
  room_l01_p09: "table",
  room_l01_p10: "pedestal",
  room_l02_p01: "pedestal",
  room_l02_p02: "cabinet",
  room_l02_p03: "pedestal",
  room_l02_p04: "table",
  room_l02_p05: "cabinet",
  room_l02_p06: "lamp",
  room_l02_p07: "wall_panel",
  room_l02_p08: "wall_panel",
  room_l02_p09: "wall_panel",
  room_l02_p10: "pedestal",
  room_l04_p01: "table",
  room_l04_p02: "column",
  room_l04_p03: "display_case",
  room_l04_p04: "cabinet",
  room_l04_p05: "column",
  room_l04_p06: "cabinet",
  room_l04_p07: "table",
  room_l04_p08: "lamp",
  room_l04_p09: "pedestal",
  room_l04_p10: "pedestal",
  room_l05_p01: "cabinet",
  room_l05_p02: "column",
  room_l05_p03: "column",
  room_l05_p04: "pedestal",
  room_l05_p05: "table",
  room_l05_p06: "pedestal",
  room_l05_p07: "pedestal",
  room_l05_p08: "table",
  room_l05_p09: "pedestal",
  room_l05_p10: "wall_panel",
  room_l06_p01: "barrier",
  room_l06_p02: "wall_panel",
  room_l06_p03: "table",
  room_l06_p04: "column",
  room_l06_p05: "display_case",
  room_l06_p06: "wall_panel",
  room_l06_p07: "table",
  room_l06_p08: "cabinet",
  room_l06_p09: "pedestal",
  room_l06_p10: "pedestal",
  room_l07_p01: "wall_panel",
  room_l07_p02: "cabinet",
  room_l07_p03: "column",
  room_l07_p04: "table",
  room_l07_p05: "cabinet",
  room_l07_p06: "cabinet",
  room_l07_p07: "cabinet",
  room_l07_p08: "pedestal",
  room_l07_p09: "display_case",
  room_l07_p10: "pedestal",
  room_l08_p01: "cabinet",
  room_l08_p02: "column",
  room_l08_p03: "cabinet",
  room_l08_p04: "lamp",
  room_l08_p05: "pedestal",
  room_l08_p06: "cabinet",
  room_l08_p07: "crate",
  room_l08_p08: "pedestal",
  room_l08_p09: "wall_panel",
  room_l08_p10: "wall_panel",
  room_l09_p01: "wall_panel",
  room_l09_p02: "pedestal",
  room_l09_p03: "cabinet",
  room_l09_p04: "cabinet",
  room_l09_p05: "pedestal",
  room_l09_p06: "wall_panel",
  room_l09_p07: "crate",
  room_l09_p08: "crate",
  room_l09_p09: "table",
  room_l09_p10: "wall_panel",
  room_l10_p01: "wall_panel",
  room_l10_p02: "table",
  room_l10_p03: "cabinet",
  room_l10_p04: "cabinet",
  room_l10_p05: "wall_panel",
  room_l10_p06: "table",
  room_l10_p07: "lamp",
  room_l10_p08: "cabinet",
  room_l10_p09: "pedestal",
  room_l10_p10: "pedestal",
  // Ingested external asset packs (regenerated by generate-builder-asset-pack-registry.mjs --emit).
  ...generatedBuilderPackFootprints,
};

export function footprintFamily(modelKey: string): FootprintFamily {
  return footprintByModelKey[modelKey] ?? "generic";
}

const groupStroke: Record<BuilderPropEntry["group"], string> = {
  密室精选: "#e8c87a",
  故事线索: "#ffce8a",
  维修: "#6fe3c2",
  居住: "#ffd9a8",
  博物馆: "#b9c8ff",
  诊疗: "#9be8ff",
  核心: "#37e0ff",
  赛博: "#ff9de0",
  官卡重制: "#ffd36d",
  自动家具: "#8ee6ff",
};

const groupFill: Record<BuilderPropEntry["group"], string> = {
  密室精选: "#26200f",
  故事线索: "#281c0c",
  维修: "#16241f",
  居住: "#241f17",
  博物馆: "#1d2133",
  诊疗: "#12222b",
  核心: "#0d1d26",
  赛博: "#2a1226",
  官卡重制: "#241c0e",
  自动家具: "#102334",
};

/**
 * Draws a believable top-down silhouette for a prop, centered at (0,0),
 * footprint w × d meters. The parent <g> applies position/rotation.
 */
export function PropFootprintShape({
  entry,
  scale,
  selected,
  hovered,
}: {
  entry: BuilderPropEntry;
  scale: number;
  selected?: boolean;
  hovered?: boolean;
}) {
  const w = entry.sizeMeters[0] * scale;
  const d = entry.sizeMeters[2] * scale;
  const stroke = groupStroke[entry.group];
  const family = footprintFamily(entry.modelKey);
  const cls = `builder-fp ${entry.solid ? "solid" : "decor"} ${selected ? "selected" : ""} ${hovered ? "hovered" : ""}`;
  const sw = 0.06;

  const body = (children: ReactNode, rounded = 0.08) => (
    <g className={cls} style={{ color: stroke }}>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={rounded} className="builder-fp-body" />
      {children}
      {/* facing tick */}
      <line x1={0} y1={0} x2={0} y2={-d / 2 - 0.2} className="builder-fp-facing" />
    </g>
  );

  switch (family) {
    case "table":
      return body(
        <>
          <rect x={-w / 2 + 0.12} y={-d / 2 + 0.12} width={Math.max(0.1, w - 0.24)} height={Math.max(0.1, d - 0.24)} rx={0.05} className="builder-fp-line" />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], index) => (
            <circle key={index} cx={(sx * (w - 0.3)) / 2} cy={(sz * (d - 0.3)) / 2} r={0.07} className="builder-fp-dot" />
          ))}
        </>,
      );
    case "chair":
      return body(
        <>
          <rect x={-w / 2 + 0.08} y={-d / 2} width={Math.max(0.1, w - 0.16)} height={0.12} className="builder-fp-fill" />
          <circle cx={0} cy={0.06} r={Math.min(w, d) * 0.28} className="builder-fp-line" />
        </>,
      );
    case "sofa":
      return body(
        <>
          {/* backrest + armrests */}
          <rect x={-w / 2} y={-d / 2} width={w} height={0.18} className="builder-fp-fill" />
          <rect x={-w / 2} y={-d / 2} width={0.18} height={d} className="builder-fp-fill" />
          <rect x={w / 2 - 0.18} y={-d / 2} width={0.18} height={d} className="builder-fp-fill" />
          {/* seat cushions */}
          <line x1={-w / 6} y1={-d / 2 + 0.2} x2={-w / 6} y2={d / 2 - 0.08} className="builder-fp-line" />
          <line x1={w / 6} y1={-d / 2 + 0.2} x2={w / 6} y2={d / 2 - 0.08} className="builder-fp-line" />
        </>,
        0.16,
      );
    case "bed":
      return body(
        <>
          <rect x={-w / 2 + 0.1} y={-d / 2 + 0.1} width={Math.max(0.1, w * 0.32)} height={Math.max(0.1, d - 0.2)} rx={0.08} className="builder-fp-fill" />
          <line x1={-w / 2 + w * 0.42} y1={-d / 2 + 0.08} x2={-w / 2 + w * 0.42} y2={d / 2 - 0.08} className="builder-fp-line" />
          <line x1={-w / 2 + w * 0.42} y1={0} x2={w / 2 - 0.1} y2={0} className="builder-fp-line" />
        </>,
        0.12,
      );
    case "cabinet":
      return body(
        <>
          <line x1={0} y1={-d / 2 + 0.06} x2={0} y2={d / 2 - 0.06} className="builder-fp-line" />
          <circle cx={-0.1} cy={0} r={0.045} className="builder-fp-dot" />
          <circle cx={0.1} cy={0} r={0.045} className="builder-fp-dot" />
        </>,
      );
    case "wall_panel":
      return body(
        <>
          <line x1={-w / 2 + 0.1} y1={0} x2={w / 2 - 0.1} y2={0} className="builder-fp-line" />
          <circle cx={-w / 2 + 0.12} cy={-d / 2 + 0.06} r={0.04} className="builder-fp-dot" />
          <circle cx={w / 2 - 0.12} cy={-d / 2 + 0.06} r={0.04} className="builder-fp-dot" />
        </>,
        0.03,
      );
    case "crate":
      return body(
        <>
          <line x1={-w / 2 + 0.08} y1={-d / 2 + 0.08} x2={w / 2 - 0.08} y2={d / 2 - 0.08} className="builder-fp-line" />
          <line x1={w / 2 - 0.08} y1={-d / 2 + 0.08} x2={-w / 2 + 0.08} y2={d / 2 - 0.08} className="builder-fp-line" />
        </>,
        0.04,
      );
    case "books":
      return body(
        <>
          <line x1={-w / 2 + 0.1} y1={-d / 6} x2={w / 2 - 0.1} y2={-d / 6} className="builder-fp-line" />
          <line x1={-w / 2 + 0.1} y1={d / 6} x2={w / 2 - 0.1} y2={d / 6} className="builder-fp-line" />
        </>,
        0.03,
      );
    case "lamp": {
      const r = Math.min(w, d) / 2;
      return (
        <g className={cls} style={{ color: stroke }}>
          <circle r={r} className="builder-fp-glow" />
          <circle r={r * 0.55} className="builder-fp-body" />
          <circle r={0.07} className="builder-fp-dot" />
          <line x1={0} y1={0} x2={0} y2={-r - 0.18} className="builder-fp-facing" />
        </g>
      );
    }
    case "display_case":
      return body(
        <>
          <rect x={-w / 2 + 0.1} y={-d / 2 + 0.1} width={Math.max(0.1, w - 0.2)} height={Math.max(0.1, d - 0.2)} rx={0.04} className="builder-fp-glass" />
          <circle cx={0} cy={0} r={0.1} className="builder-fp-dot" />
        </>,
        0.05,
      );
    case "column": {
      const r = Math.min(w, d) / 2;
      return (
        <g className={cls} style={{ color: stroke }}>
          <circle r={r} className="builder-fp-body" />
          <circle r={r * 0.55} className="builder-fp-line" />
          <line x1={0} y1={0} x2={0} y2={-r - 0.18} className="builder-fp-facing" />
        </g>
      );
    }
    case "barrier":
      return body(
        <>
          {[-0.34, 0, 0.34].map((t) => (
            <circle key={t} cx={t * w} cy={0} r={0.06} className="builder-fp-dot" />
          ))}
        </>,
        0.06,
      );
    case "pedestal": {
      const r = Math.min(w, d) * 0.32;
      return body(<circle cx={0} cy={0} r={r} className="builder-fp-glow" />, 0.07);
    }
    default:
      return body(<rect x={-w / 4} y={-d / 4} width={w / 2} height={d / 2} className="builder-fp-line" />);
  }
}

/** Compact catalog thumbnail for a furniture entry (normalized into a square viewBox). */
export function PropThumb({ modelKey }: { modelKey: string }) {
  const entry = propEntry(modelKey);
  if (!entry) return <svg className="builder-thumb" viewBox="-1 -1 2 2" aria-hidden="true" />;
  const span = Math.max(entry.sizeMeters[0], entry.sizeMeters[2]) * 0.72 + 0.4;
  return (
    <svg className="builder-thumb" viewBox={`${-span} ${-span} ${span * 2} ${span * 2}`} aria-hidden="true" style={{ background: groupFill[entry.group] }}>
      <PropFootprintShape entry={entry} scale={1} />
    </svg>
  );
}

/** Catalog thumbnail for a room style: a floor pattern swatch with the accent wall edge. */
export function RoomStyleThumb({ style }: { style: BuilderRoomStyle }) {
  const entry = roomStyleEntry(style);
  return (
    <svg className="builder-thumb" viewBox="0 0 10 10" aria-hidden="true">
      <rect x={0.6} y={0.6} width={8.8} height={8.8} rx={0.7} fill="#0d1726" stroke={entry.accentColor} strokeWidth={0.7} />
      <rect x={1.7} y={1.7} width={6.6} height={6.6} fill={`url(#builder-floor-${style})`} stroke="none" />
    </svg>
  );
}

/** Fits a set of points into the [pad, 10-pad] box; returns a transform fn. */
function fitToThumb(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  pad: number,
): { tx: (x: number) => number; ty: (z: number) => number; scale: number } {
  const w = Math.max(0.001, maxX - minX);
  const h = Math.max(0.001, maxZ - minZ);
  const span = 10 - pad * 2;
  const scale = Math.min(span / w, span / h);
  const ox = (10 - w * scale) / 2 - minX * scale;
  const oy = (10 - h * scale) / 2 - minZ * scale;
  return { tx: (x) => x * scale + ox, ty: (z) => z * scale + oy, scale };
}

/** Accurate top-down outline of a non-rect room preset (triangle/circle/N-gon…). */
export function RoomShapeThumb({ points, accent }: { points: readonly (readonly [number, number])[]; accent: string }) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const { tx, ty } = fitToThumb(minX, maxX, minZ, maxZ, 1.4);
  const poly = points.map(([x, z]) => `${tx(x).toFixed(2)},${ty(z).toFixed(2)}`).join(" ");
  return (
    <svg className="builder-thumb" viewBox="0 0 10 10" aria-hidden="true">
      <rect x={0.4} y={0.4} width={9.2} height={9.2} rx={0.7} fill="#0d1726" stroke={accent} strokeWidth={0.45} strokeOpacity={0.45} />
      <polygon points={poly} fill={accent} fillOpacity={0.18} stroke={accent} strokeWidth={0.55} strokeLinejoin="round" />
    </svg>
  );
}

/** Accurate mini floorplan of a building preset: room rects + door connectors. */
export function BuildingPresetThumb({
  rooms,
  links,
  accent,
}: {
  rooms: readonly { key: string; center: readonly [number, number]; size: readonly [number, number] }[];
  links: readonly { from: string; to: string }[];
  accent: string;
}) {
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
  const { tx, ty, scale } = fitToThumb(minX, maxX, minZ, maxZ, 1.1);
  const byKey = new Map(rooms.map((room) => [room.key, room]));
  return (
    <svg className="builder-thumb" viewBox="0 0 10 10" aria-hidden="true">
      <rect x={0.4} y={0.4} width={9.2} height={9.2} rx={0.7} fill="#0d1726" stroke={accent} strokeWidth={0.4} strokeOpacity={0.35} />
      {links.map((link, index) => {
        const a = byKey.get(link.from);
        const b = byKey.get(link.to);
        if (!a || !b) return null;
        return (
          <line
            key={`link-${index}`}
            x1={tx(a.center[0])}
            y1={ty(a.center[1])}
            x2={tx(b.center[0])}
            y2={ty(b.center[1])}
            stroke={accent}
            strokeWidth={0.55}
            strokeOpacity={0.5}
          />
        );
      })}
      {rooms.map((room, index) => (
        <rect
          key={`room-${index}`}
          x={tx(room.center[0] - room.size[0] / 2)}
          y={ty(room.center[1] - room.size[1] / 2)}
          width={room.size[0] * scale}
          height={room.size[1] * scale}
          rx={0.3}
          fill={accent}
          fillOpacity={0.16}
          stroke={accent}
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}

/** Catalog thumbnail for a robot archetype. */
export function RobotThumb({ archetype }: { archetype: BuilderRobotArchetype }) {
  const elite = archetype === "custodian_elite";
  const color = elite ? "#ff4f8c" : "#ff7a5c";
  return (
    <svg className="builder-thumb" viewBox="-1 -1 2 2" aria-hidden="true">
      <rect x={-0.55} y={-0.42} width={1.1} height={0.95} rx={0.22} fill="#3a1d18" stroke={color} strokeWidth={0.09} />
      <rect x={-0.34} y={-0.2} width={0.68} height={0.16} rx={0.08} fill={color} />
      {elite ? <circle r={0.86} fill="none" stroke={color} strokeWidth={0.06} strokeDasharray="0.18 0.12" /> : null}
    </svg>
  );
}

export function robotArchetypeColor(archetype: BuilderRobotArchetype, tier?: string) {
  if (archetype === "custodian_elite" || tier === "elite") return "#ff4f8c";
  if (archetype === "shield_tech") return "#ffb34f";
  return "#ff7a5c";
}

export const knownFootprintModelKeys = Object.keys(footprintByModelKey);

/**
 * Floor material patterns shared by the 2D plan and catalog swatches.
 * Mounted once at page level (hidden svg) so thumbs work even when the plan is unmounted.
 */
export function FloorPatternDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {builderRoomStyles.map((entry) => {
          const c = entry.accentColor;
          if (entry.style === "sterile") {
            return (
              <pattern key={entry.style} id="builder-floor-sterile" width="2" height="2" patternUnits="userSpaceOnUse">
                <rect width="2" height="2" fill="#101b2c" />
                <path d="M0 0H2M0 0V2" stroke={c} strokeOpacity="0.13" strokeWidth="0.05" />
              </pattern>
            );
          }
          if (entry.style === "maintenance") {
            return (
              <pattern key={entry.style} id="builder-floor-maintenance" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
                <rect width="1.6" height="1.6" fill="#0f1d1c" />
                <circle cx="0.4" cy="0.4" r="0.06" fill={c} fillOpacity="0.2" />
                <circle cx="1.2" cy="1.2" r="0.06" fill={c} fillOpacity="0.13" />
              </pattern>
            );
          }
          if (entry.style === "hazard") {
            return (
              <pattern key={entry.style} id="builder-floor-hazard" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="2.4" height="2.4" fill="#1a1712" />
                <rect width="2.4" height="0.55" fill={c} fillOpacity="0.1" />
              </pattern>
            );
          }
          if (entry.style === "residential") {
            return (
              <pattern key={entry.style} id="builder-floor-residential" width="3" height="1.2" patternUnits="userSpaceOnUse">
                <rect width="3" height="1.2" fill="#1c1812" />
                <path d="M0 0H3M0 1.2H3M1.5 0V1.2" stroke={c} strokeOpacity="0.14" strokeWidth="0.05" />
              </pattern>
            );
          }
          if (entry.style === "museum") {
            return (
              <pattern key={entry.style} id="builder-floor-museum" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
                <rect width="2.6" height="2.6" fill="#142022" />
                <rect x="0.25" y="0.25" width="2.1" height="2.1" fill="none" stroke={c} strokeOpacity="0.16" strokeWidth="0.05" />
              </pattern>
            );
          }
          if (entry.style === "core") {
            return (
              <pattern key={entry.style} id="builder-floor-core" width="2" height="2" patternUnits="userSpaceOnUse">
                <rect width="2" height="2" fill="#0c161c" />
                <circle cx="1" cy="1" r="0.5" fill="none" stroke={c} strokeOpacity="0.2" strokeWidth="0.05" />
                <path d="M1 0V2M0 1H2" stroke={c} strokeOpacity="0.1" strokeWidth="0.04" />
              </pattern>
            );
          }
          if (entry.style === "exit") {
            return (
              <pattern key={entry.style} id="builder-floor-exit" width="2.2" height="2.2" patternUnits="userSpaceOnUse">
                <rect width="2.2" height="2.2" fill="#1d1212" />
                <path d="M0.3 1.5L1.1 0.7L1.9 1.5" stroke={c} strokeOpacity="0.22" strokeWidth="0.12" fill="none" />
              </pattern>
            );
          }
          // Generic fallback keyed by the style id so any future style still
          // gets a valid url(#builder-floor-<style>) pattern reference.
          return (
            <pattern key={entry.style} id={`builder-floor-${entry.style}`} width="2" height="2" patternUnits="userSpaceOnUse">
              <rect width="2" height="2" fill="#141a22" />
              <path d="M0 0H2M0 0V2" stroke={c} strokeOpacity="0.12" strokeWidth="0.05" />
            </pattern>
          );
        })}
      </defs>
    </svg>
  );
}

export function floorPatternId(style: BuilderRoomStyle) {
  return `builder-floor-${style}`;
}
