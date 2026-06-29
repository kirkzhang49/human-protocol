import { memo, useCallback, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  builderLockLabels,
  builderPropCatalog,
  builderRobotCatalog,
  builderRoomStyles,
  propEntry,
  robotLabel,
  type BuilderPropEntry,
} from "./BuilderAssetCatalog";
import { ASSET_ROLE_LABEL, deriveAssetRoles } from "./builderAssetRoles";
import { BuildingPresetThumb, PropThumb, RobotThumb, RoomShapeThumb, RoomStyleThumb } from "./BuilderAssetFootprints";
import {
  quarantineAsset,
  quarantineListJson,
  restoreAllAssets,
  restoreAsset,
  useQuarantinedAssets,
} from "./BuilderAssetQuarantine";
import { isBuilderTemporarilyHidden } from "./builderTemporaryHidden";
import { isBuilderDiscarded } from "./builderDiscardedAssets";
import { builderPuzzlePublicKinds, puzzleInstances } from "./BuilderPuzzleCatalog";
import { builderPickupCatalog, pickupEntry, type BuilderPickupEntry } from "./BuilderPickupCatalog";
import type { BuilderPickupKind, BuilderProject, BuilderPuzzleKind } from "./BuilderTypes";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import { bl } from "./i18n/catalogLabels";
import type { GameLanguage } from "../game/core/GameSettings";

/** Mini machine icon per puzzle family — the card already shows WHICH machine. */
function PuzzleKindIcon({ kind, color }: { kind: BuilderPuzzleKind; color: string }) {
  if (kind === "color_sequence") {
    return (
      <svg viewBox="0 0 24 24" className="builder-puzzlekind-icon" aria-hidden="true">
        <rect x="4" y="4" width="16" height="11" rx="1.4" fill="#120e16" stroke={color} strokeOpacity="0.7" />
        <circle cx="8.4" cy="9.5" r="1.7" fill="#ff5b4c" />
        <circle cx="12" cy="9.5" r="1.7" fill="#4f8cff" />
        <circle cx="15.6" cy="9.5" r="1.7" fill="#5fd47a" />
        <path d="M7 15L5.4 21M17 15l1.6 6" stroke={color} strokeOpacity="0.6" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "circuit_grid") {
    return (
      <svg viewBox="0 0 24 24" className="builder-puzzlekind-icon" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="1.4" fill="#0a1016" stroke={color} strokeOpacity="0.7" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={6.4 + col * 4}
              y={5.4 + row * 4.6}
              width="3"
              height="3.4"
              rx="0.6"
              fill={[0, 3, 4, 5, 8].includes(row * 3 + col) ? color : "#27313c"}
              fillOpacity={[0, 3, 4, 5, 8].includes(row * 3 + col) ? 0.95 : 1}
            />
          )),
        )}
      </svg>
    );
  }
  if (kind === "surveillance_match") {
    return (
      <svg viewBox="0 0 24 24" className="builder-puzzlekind-icon" aria-hidden="true">
        <rect x="3.4" y="6" width="5.4" height="6.4" rx="0.8" fill={color} fillOpacity="0.85" />
        <rect x="9.4" y="6" width="5.4" height="6.4" rx="0.8" fill="#05080c" stroke={color} strokeOpacity="0.5" />
        <rect x="15.4" y="6" width="5.4" height="6.4" rx="0.8" fill={color} fillOpacity="0.85" />
        <path d="M10.6 8.4l3 1.8-3 1.8z" fill={color} fillOpacity="0.5" />
        <rect x="6" y="14.4" width="12" height="4.6" rx="1" fill="#1c2733" stroke={color} strokeOpacity="0.4" />
      </svg>
    );
  }
  if (kind === "archive_merge") {
    return (
      <svg viewBox="0 0 24 24" className="builder-puzzlekind-icon" aria-hidden="true">
        <rect x="4" y="3.5" width="16" height="17" rx="1.8" fill="#121216" stroke={color} strokeOpacity="0.72" />
        {[0, 1, 2, 3].map((index) => (
          <rect
            key={index}
            x={7 + (index % 2) * 5}
            y={6.2 + Math.floor(index / 2) * 5}
            width="4"
            height="4"
            rx="0.8"
            fill={index === 3 ? color : "#28323a"}
            fillOpacity={index === 3 ? 0.95 : 1}
          />
        ))}
        <path d="M7 17.2h10" stroke={color} strokeOpacity="0.72" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "gallery_reading") {
    return (
      <svg viewBox="0 0 24 24" className="builder-puzzlekind-icon" aria-hidden="true">
        <rect x="3.5" y="4" width="11" height="13" rx="1.4" fill="#171109" stroke={color} strokeOpacity="0.72" />
        <rect x="5.4" y="6" width="7.2" height="6.2" rx="0.8" fill={color} fillOpacity="0.5" />
        <path d="M5.4 14.4h7.2" stroke={color} strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M17 6.5l2.6 1.5-2.6 1.5z" fill={color} fillOpacity="0.85" />
        <rect x="16.6" y="12" width="4.4" height="2.2" rx="0.6" fill="#28323a" stroke={color} strokeOpacity="0.6" />
        <rect x="16.6" y="15.4" width="4.4" height="2.2" rx="0.6" fill={color} fillOpacity="0.85" />
      </svg>
    );
  }
  if (kind === "valve_matrix") {
    return (
      <svg viewBox="0 0 24 24" className="builder-puzzlekind-icon" aria-hidden="true">
        <rect x="3" y="3.4" width="18" height="17.2" rx="1.8" fill="#11161b" stroke={color} strokeOpacity="0.72" />
        <rect x="5.2" y="5.4" width="13.6" height="8.3" rx="1" fill="#061016" stroke={color} strokeOpacity="0.38" />
        {[0, 1, 2].map((index) => (
          <g key={index}>
            <rect x={6.2 + index * 4.2} y="6.5" width="2.4" height="5.7" rx="0.45" fill="#1f2b31" stroke={color} strokeOpacity="0.45" />
            <rect x={6.5 + index * 4.2} y={7.2 + index * 0.7} width="1.8" height={3.8 - index * 0.45} rx="0.35" fill={color} fillOpacity="0.82" />
          </g>
        ))}
        <path d="M6 16h12" stroke={color} strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="7.2" cy="17.8" r="1" fill={color} fillOpacity="0.9" />
        <circle cx="12" cy="17.8" r="1" fill={color} fillOpacity="0.55" />
        <circle cx="16.8" cy="17.8" r="1" fill={color} fillOpacity="0.9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="builder-puzzlekind-icon" aria-hidden="true">
      <rect x="3" y="14" width="18" height="6" rx="1.2" fill="#1c2733" stroke={color} strokeOpacity="0.5" />
      <path d="M6 14v-3M18 14v-3" stroke="#3d4a52" strokeWidth="2.2" />
      <circle cx="6" cy="8" r="3.1" fill="none" stroke="#c0392b" strokeWidth="1.6" />
      <path d="M6 5.4v5.2M3.4 8h5.2" stroke="#c0392b" strokeWidth="1.2" />
      <circle cx="18" cy="8" r="3.1" fill="none" stroke="#c0392b" strokeWidth="1.6" />
      <path d="M18 5.4v5.2M15.4 8h5.2" stroke="#c0392b" strokeWidth="1.2" />
      <rect x="10.4" y="15.4" width="3.2" height="3.2" rx="0.5" fill={color} />
    </svg>
  );
}
import { assetThumbnailUrl } from "./BuilderAssetThumbnails";
import { builderTemplates } from "./BuilderDirector";
import { builderBuildingPresets } from "./BuilderBuildingPresets";
import { builderRoomShapePresets } from "./BuilderRoomShapePresets";
import { builderCeilingPresets, builderFloorPresets, builderWallPresets, type BuilderBrush } from "./BuilderEnvironment";
import type { PlacementDraft } from "./BuilderPlacementRules";
import { SurfaceSwatch } from "./BuilderSurfaceArt";
import type { BuilderLockType, BuilderRoomStyle } from "./BuilderTypes";

export type BuilderCatalogTab = "rooms" | "props" | "pickups" | "puzzles" | "mechanisms" | "robots" | "doors" | "env";

/** Header identity per catalog: the browser shows WHAT I can place for the active tool. */
function catalogHead(tab: BuilderCatalogTab, language: GameLanguage): { label: string; glyph?: string; hint: string } {
  const en = language === "en";
  const heads: Record<BuilderCatalogTab, { label: string; glyph?: string; hint: string }> = {
    rooms: { label: en ? "Rooms" : "房间目录", glyph: "▢", hint: en ? "Click to add · drag to snap" : "点击添加 · 拖动贴边" },
    props: { label: en ? "Furniture" : "家具目录", hint: en ? "Click or drag a card onto the map" : "点击或拖动卡片到地图" },
    pickups: { label: en ? "Pickups" : "拾取目录", glyph: "✚", hint: en ? "Keys / medkits / energy / missiles" : "钥匙 / 治疗 / 能量 / 导弹" },
    puzzles: { label: en ? "Puzzles" : "谜题目录", glyph: "◈", hint: en ? "Each puzzle brings its own door" : "每座谜题带一扇门" },
    mechanisms: { label: en ? "Mechanisms" : "机关目录", glyph: "⌁", hint: en ? "Route a key to doors / puzzles / robots" : "用钥匙路由门 / 谜题 / 机器人" },
    robots: { label: en ? "Robots" : "机器人目录", glyph: "◆", hint: en ? "Select, then click the floor to deploy" : "点选后点击地面部署" },
    doors: { label: en ? "Doors & Locks" : "门锁目录", glyph: "▣", hint: en ? "Auto-placed between snapped rooms" : "自动放在贴边房间之间" },
    env: { label: en ? "Materials" : "材质目录", glyph: "▨", hint: en ? "Select, then click a room to paint" : "点选后点击房间涂刷" },
  };
  return heads[tab];
}

function lockTilesFor(language: GameLanguage): readonly { lockType: BuilderLockType; glyph: string; color: string; hint: string }[] {
  const en = language === "en";
  return [
    { lockType: "none", glyph: "门", color: "#76b7e8", hint: en ? "Opens automatically, no condition" : "自动开门，无条件" },
    { lockType: "key_item", glyph: "钥", color: "#ffd24f", hint: en ? "Opens after picking up the key" : "拾取钥匙后开启" },
    { lockType: "survive_wave", glyph: "战", color: "#ff7a5c", hint: en ? "Clear the robots in room A" : "清剿房间 A 的机器人" },
  ];
}

const robotThreatDots: Record<string, number> = {
  repair_drone: 1,
  clamp_bot: 2,
  shield_tech: 3,
  custodian_elite: 5,
};

/** Furniture group sections; curated desire pack + story clues lead. */
const discoveredGroups = [...new Set(builderPropCatalog.map((entry) => entry.group))];
const furnitureGroups = [
  "密室精选" as const,
  "故事线索" as const,
  ...discoveredGroups.filter((group) => group !== "密室精选" && group !== "故事线索"),
];

const favoritesStorageKey = "human-protocol-builder-favorites-v1";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(favoritesStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

/** Stable identity for a placement draft, used for the recents row. */
export function placementDraftKey(draft: PlacementDraft) {
  if (draft.kind === "prop") return `prop:${draft.modelKey}`;
  if (draft.kind === "pickup") return `pickup:${draft.pickupKind}`;
  if (draft.kind === "routeSwitch") return "routeSwitch:control-routing-station";
  if (draft.kind === "wallDoorSwitch") return "wallDoorSwitch:wall-mounted-door-control";
  return `robot:${draft.presetId ?? draft.archetype}`;
}

function placementDraftLabel(draft: PlacementDraft) {
  if (draft.kind === "prop") return propEntry(draft.modelKey)?.label ?? draft.modelKey;
  if (draft.kind === "pickup") return builderPickupCatalog.find((entry) => entry.kind === draft.pickupKind)?.label ?? draft.pickupKind;
  if (draft.kind === "routeSwitch") return "管制路由台";
  if (draft.kind === "wallDoorSwitch") return "墙面门控把手";
  if (draft.presetId) return builderRobotCatalog.find((entry) => entry.presetId === draft.presetId)?.label ?? robotLabel(draft.archetype);
  return robotLabel(draft.archetype);
}

const builderPlacementDragType = "application/x-human-protocol-builder-placement";

function writePlacementDragPayload(event: DragEvent<HTMLElement>, draft: PlacementDraft) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(builderPlacementDragType, JSON.stringify(draft));
  event.dataTransfer.setData("text/plain", placementDraftKey(draft));
}

/** Rendered GLB image when available; SVG footprint as fallback only. */
export function AssetImageThumb({ modelKey }: { modelKey: string }) {
  const url = assetThumbnailUrl(modelKey);
  if (url) return <img className="builder-thumb builder-thumb-img" src={url} alt="" loading="lazy" draggable={false} />;
  return <PropThumb modelKey={modelKey} />;
}

export function PickupImageThumb({ kind }: { kind: BuilderPickupKind }) {
  const entry = pickupEntry(kind);
  const url = assetThumbnailUrl(entry.modelKey);
  if (url) return <img className="builder-thumb builder-thumb-img" src={url} alt="" loading="lazy" draggable={false} />;
  return <PickupFallbackThumb entry={entry} />;
}

function PickupFallbackThumb({ entry }: { entry: BuilderPickupEntry }) {
  const stroke = entry.color;
  const body = "#121822";
  const glow = `${stroke}33`;
  return (
    <svg className="builder-thumb builder-thumb-pickup" viewBox="-1 -1 2 2" aria-hidden="true">
      <rect x={-1} y={-1} width={2} height={2} fill="#120f09" />
      <circle cx={0} cy={0} r={0.86} fill={glow} />
      {entry.thumbnailKind === "missile" ? (
        <g transform="rotate(-28)">
          <path d="M-0.78 0.14L-0.46 0.03L-0.78 -0.14Z" fill="#ffb45d" />
          <path d="M-0.48 -0.24L-0.22 -0.11L-0.38 0L-0.22 0.11L-0.48 0.24L-0.68 0.08V-0.08Z" fill="#27323b" stroke={stroke} strokeWidth={0.035} />
          <rect x={-0.44} y={-0.16} width={0.92} height={0.32} rx={0.16} fill={body} stroke={stroke} strokeWidth={0.06} />
          <path d="M0.48 -0.16L0.82 0L0.48 0.16Z" fill="#dfe8e7" stroke={stroke} strokeWidth={0.05} />
          <rect x={-0.08} y={-0.06} width={0.32} height={0.12} rx={0.04} fill={stroke} opacity={0.72} />
        </g>
      ) : entry.thumbnailKind === "key" ? (
        <g transform="rotate(-28)">
          <circle cx={-0.42} cy={0} r={0.24} fill="none" stroke={stroke} strokeWidth={0.1} />
          <rect x={-0.18} y={-0.055} width={0.78} height={0.11} rx={0.05} fill={stroke} />
          <rect x={0.42} y={0.02} width={0.12} height={0.24} rx={0.02} fill={stroke} />
          <rect x={0.58} y={0.02} width={0.12} height={0.18} rx={0.02} fill={stroke} />
        </g>
      ) : entry.thumbnailKind === "medkit" ? (
        <g>
          <rect x={-0.56} y={-0.38} width={1.12} height={0.76} rx={0.12} fill="#e7ece8" stroke={stroke} strokeWidth={0.06} />
          <rect x={-0.18} y={-0.54} width={0.36} height={0.18} rx={0.05} fill={body} stroke={stroke} strokeWidth={0.04} />
          <rect x={-0.09} y={-0.26} width={0.18} height={0.52} rx={0.035} fill="#ff654f" />
          <rect x={-0.26} y={-0.09} width={0.52} height={0.18} rx={0.035} fill="#ff654f" />
        </g>
      ) : (
        <g>
          <rect x={-0.32} y={-0.62} width={0.64} height={1.24} rx={0.18} fill="#27323b" stroke={stroke} strokeWidth={0.06} />
          <rect x={-0.2} y={-0.46} width={0.4} height={0.82} rx={0.08} fill={stroke} opacity={0.55} />
          <path d="M0.04 -0.32L-0.18 0.06H0.02L-0.08 0.38L0.24 -0.08H0.04Z" fill="#fff1a8" />
        </g>
      )}
    </svg>
  );
}

function RouteSwitchThumb() {
  return (
    <svg className="builder-thumb builder-thumb-route-switch" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="#061617" stroke="#5ee8c8" strokeOpacity="0.72" />
      <path d="M6.8 12h4M13.2 8H17M13.2 16H17" stroke="#5ee8c8" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.1" fill="#5ee8c8" fillOpacity="0.9" />
      <circle cx="18.4" cy="8" r="1.65" fill="#ffd76b" />
      <circle cx="18.4" cy="16" r="1.65" fill="#7bb7ff" />
    </svg>
  );
}

function WallDoorSwitchThumb() {
  return (
    <svg className="builder-thumb builder-thumb-route-switch" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="3.8" width="10" height="16.4" rx="1.8" fill="#07101a" stroke="#7bb7ff" strokeOpacity="0.76" />
      <rect x="9.4" y="6.4" width="5.2" height="3.2" rx="0.8" fill="#0d1d2a" stroke="#5ee8c8" strokeOpacity="0.62" />
      <circle cx="12" cy="14" r="2.7" fill="#5ee8c8" fillOpacity="0.9" />
      <path d="M12 11.8v4.4" stroke="#061617" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 4v16M20 4v16" stroke="#7bb7ff" strokeOpacity="0.26" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function recentPlacementKindLabel(draft: PlacementDraft, language: GameLanguage) {
  const en = language === "en";
  if (draft.kind === "prop") return en ? "Furniture" : "家具";
  if (draft.kind === "pickup") return en ? "Pickup" : "拾取";
  if (draft.kind === "routeSwitch" || draft.kind === "wallDoorSwitch") return en ? "Mechanism" : "机关";
  return en ? "Robot" : "机器人";
}

function RecentPlacementCard({
  draft,
  active,
  language,
  onBeginPlacement,
}: {
  draft: PlacementDraft;
  active: boolean;
  language: GameLanguage;
  onBeginPlacement: (draft: PlacementDraft) => void;
}) {
  const label = bl(placementDraftLabel(draft), language);
  const placementDraft = draft.kind === "prop" ? { ...draft, rotationY: 0 } : draft;
  const beginPlacement = () => onBeginPlacement(placementDraft);
  return (
    <button
      type="button"
      className={`builder-recent-card ${active ? "placing" : ""}`}
      title={label}
      draggable
      onClick={beginPlacement}
      onDragStart={(event) => {
        writePlacementDragPayload(event, placementDraft);
        beginPlacement();
      }}
    >
      <span className="builder-recent-card-art">
        {draft.kind === "prop" ? (
          <AssetImageThumb modelKey={draft.modelKey} />
        ) : draft.kind === "pickup" ? (
          <PickupImageThumb kind={draft.pickupKind} />
        ) : draft.kind === "routeSwitch" ? (
          <RouteSwitchThumb />
        ) : draft.kind === "wallDoorSwitch" ? (
          <WallDoorSwitchThumb />
        ) : (
          <RobotThumb archetype={draft.archetype} />
        )}
      </span>
      <span className="builder-recent-card-copy">
        <strong>{label}</strong>
        <em>{recentPlacementKindLabel(draft, language)}</em>
      </span>
    </button>
  );
}

interface BuilderAssetBrowserProps {
  project: BuilderProject;
  tab: BuilderCatalogTab;
  filter: string;
  onFilter: (filter: string) => void;
  placement: PlacementDraft | null;
  brush: BuilderBrush | null;
  recent: readonly PlacementDraft[];
  onBeginPlacement: (draft: PlacementDraft) => void;
  onBeginBrush: (brush: BuilderBrush) => void;
  onAddRoom: (style: BuilderRoomStyle) => void;
  /** Adds a single non-rectangular room (triangle/circle/semicircle/N-gon). */
  onAddShapeRoom: (presetId: string) => void;
  /** Stamps a connected multi-room building preset (rotated by buildingTurns). */
  onStampBuilding: (presetId: string) => void;
  /** Current quarter-turn rotation applied to the next stamped building. */
  buildingTurns: number;
  onRotateBuilding: () => void;
  onAddDoor: (lockType: BuilderLockType) => void;
  onAddPuzzle: (kind: BuilderPuzzleKind) => void;
  onAddPickup: (kind: BuilderPickupKind) => void;
  onAddWallDoorSwitch: () => void;
  onApplyTemplate: (templateId: string) => void;
  onStatus?: (text: string) => void;
}

/**
 * Memoized catalog card. Re-renders only when its own active/favorite/placing
 * state changes instead of re-rendering the whole 100+ card catalog. All
 * callbacks passed in are stable enough for the memo to hold during stage hover.
 */
const PropCard = memo(function PropCard({
  entry,
  active,
  favorite,
  placing,
  devMode,
  language,
  onPlace,
  onToggleFavorite,
  onQuarantine,
}: {
  entry: BuilderPropEntry;
  active: boolean;
  favorite: boolean;
  placing: boolean;
  devMode: boolean;
  language: GameLanguage;
  onPlace: (modelKey: string) => void;
  onToggleFavorite: (modelKey: string) => void;
  onQuarantine: (entry: BuilderPropEntry) => void;
}) {
  const roles = deriveAssetRoles(entry);
  const en = language === "en";
  const placementDraft: PlacementDraft = { kind: "prop", modelKey: entry.modelKey, rotationY: 0 };
  const beginPlacement = () => onPlace(entry.modelKey);
  return (
    <div className={`builder-asset-card ${placing ? "placing" : ""}${active ? " is-active-asset" : ""}`}>
      <button
        type="button"
        className="builder-asset-card-main"
        title={`${bl(entry.label, language)} · ${entry.sizeMeters[0].toFixed(1)}×${entry.sizeMeters[2].toFixed(1)} ${en ? "m" : "米"}${entry.solid ? (en ? " · Solid collision" : " · 实体碰撞") : en ? " · Decor" : " · 装饰"}`}
        draggable
        onClick={beginPlacement}
        onDragStart={(event) => {
          writePlacementDragPayload(event, placementDraft);
          beginPlacement();
        }}
      >
        <span className="builder-asset-card-art">
          <AssetImageThumb modelKey={entry.modelKey} />
          <em className="builder-asset-card-place">{en ? "＋ Place" : "＋ 放置"}</em>
        </span>
        <span className="builder-asset-card-label">{bl(entry.label, language)}</span>
        {roles.length ? (
          <span className="builder-asset-card-badges">
            {roles.map((role) => (
              <em key={role} className={`asset-badge asset-badge-${role}`}>
                {bl(ASSET_ROLE_LABEL[role], language)}
              </em>
            ))}
          </span>
        ) : null}
        <span className="builder-asset-card-meta">
          <small>
            {entry.sizeMeters[0].toFixed(1)}×{entry.sizeMeters[2].toFixed(1)}m
          </small>
        </span>
      </button>
      <button
        type="button"
        className={`builder-asset-card-fav ${favorite ? "on" : ""}`}
        title={favorite ? (en ? "Unpin from favorites" : "取消常用") : en ? "Pin to favorites" : "标记常用"}
        onClick={() => onToggleFavorite(entry.modelKey)}
      >
        {favorite ? "★" : "☆"}
      </button>
      {devMode ? (
        <button
          type="button"
          className="builder-asset-card-bin"
          title={en ? "Hide this asset from the catalog (DEV · reversible, does not delete files)" : "从目录隐藏这件资产（DEV · 可恢复，不删除文件）"}
          onClick={() => onQuarantine(entry)}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
});

/** Left-hand build-mode asset browser: tabbed, searchable, tangible asset cards. */
function BuilderAssetBrowserImpl({
  project,
  tab,
  filter,
  onFilter,
  placement,
  brush,
  recent,
  onBeginPlacement,
  onBeginBrush,
  onAddRoom,
  onAddShapeRoom,
  onStampBuilding,
  buildingTurns,
  onRotateBuilding,
  onAddDoor,
  onAddPuzzle,
  onAddPickup,
  onAddWallDoorSwitch,
  onApplyTemplate,
  onStatus,
}: BuilderAssetBrowserProps) {
  const { language } = useBuilderLanguage();
  const en = language === "en";
  const quarantined = useQuarantinedAssets();
  const quarantinedKeys = new Set(quarantined.map((record) => record.modelKey));
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  const [trayOpen, setTrayOpen] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const groupChipDragRef = useRef<{ pointerId: number; startX: number; scrollLeft: number; moved: boolean; captured: boolean } | null>(null);
  const groupChipSuppressClickRef = useRef(false);

  const onGroupChipPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    groupChipDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      moved: false,
      captured: false,
    };
    groupChipSuppressClickRef.current = false;
  }, []);

  const onGroupChipPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = groupChipDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < 5) return;
    if (!drag.captured) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.captured = true;
      } catch {
        // The strip still scrolls without capture; capture just keeps the drag smooth.
      }
    }
    drag.moved = true;
    groupChipSuppressClickRef.current = true;
    event.currentTarget.scrollLeft = drag.scrollLeft - dx;
    event.preventDefault();
  }, []);

  const onGroupChipPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = groupChipDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const wasMoved = drag.moved;
    groupChipDragRef.current = null;
    if (drag.captured) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already be released by the browser.
      }
    }
    if (wasMoved) {
      window.setTimeout(() => {
        groupChipSuppressClickRef.current = false;
      }, 0);
    }
  }, []);

  const onGroupChipClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!groupChipSuppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    groupChipSuppressClickRef.current = false;
  }, []);

  const toggleFavorite = useCallback((modelKey: string) => {
    setFavorites((current) => {
      const next = current.includes(modelKey) ? current.filter((key) => key !== modelKey) : [...current, modelKey];
      try {
        window.localStorage.setItem(favoritesStorageKey, JSON.stringify(next));
      } catch {
        // private mode: session-only favorites
      }
      return next;
    });
  }, []);

  const handleQuarantine = useCallback(
    (entry: BuilderPropEntry) => {
      quarantineAsset(entry);
      onStatus?.(
        en
          ? `"${bl(entry.label, language)}" hidden from the catalog (restore anytime; files are not deleted).`
          : `「${entry.label}」已从目录隐藏（可随时恢复，不会删除文件）。`,
      );
    },
    [onStatus, en, language],
  );

  const handleRestore = useCallback(
    (modelKey: string, label: string) => {
      restoreAsset(modelKey);
      onStatus?.(en ? `"${bl(label, language)}" restored to the catalog.` : `「${label}」已恢复到目录。`);
    },
    [onStatus, en, language],
  );

  const visibleEntries = (entries: readonly BuilderPropEntry[]) =>
    entries.filter(
      (entry) => !quarantinedKeys.has(entry.modelKey) && !isBuilderTemporarilyHidden(entry.modelKey) && !isBuilderDiscarded(entry.modelKey),
    );

  const handlePlace = useCallback(
    (modelKey: string) => onBeginPlacement({ kind: "prop", modelKey, rotationY: 0 }),
    [onBeginPlacement],
  );
  const renderPropCard = (entry: BuilderPropEntry) => (
    <PropCard
      key={entry.modelKey}
      entry={entry}
      active={false}
      favorite={favorites.includes(entry.modelKey)}
      placing={placement?.kind === "prop" && placement.modelKey === entry.modelKey}
      devMode={import.meta.env.DEV}
      language={language}
      onPlace={handlePlace}
      onToggleFavorite={toggleFavorite}
      onQuarantine={handleQuarantine}
    />
  );

  const favoriteEntries = visibleEntries(
    favorites.map((key) => propEntry(key)).filter((entry): entry is BuilderPropEntry => Boolean(entry)),
  );

  const head = catalogHead(tab, language);
  const lockTiles = lockTilesFor(language);
  const visibleCatalog = visibleEntries(builderPropCatalog);
  const hasColorSequencePuzzle = puzzleInstances(project).some((instance) => instance.kind === "color_sequence");

  return (
    <aside className="builder-catalog" aria-label={en ? "Asset catalog" : "资产目录"}>
      {/* Browser = WHAT I can place; the bottom tray picks the tool. */}
      <div className="builder-catalog-head">
        {head.glyph ? <i>{head.glyph}</i> : null}
        <div>
          <strong>{head.label}</strong>
          <em>{head.hint}</em>
        </div>
        {tab === "props" ? <b>{visibleCatalog.length}</b> : tab === "puzzles" ? <b>{builderPuzzlePublicKinds.length}</b> : tab === "pickups" ? <b>{builderPickupCatalog.length}</b> : null}
      </div>
      {tab !== "doors" && tab !== "pickups" && tab !== "puzzles" && tab !== "mechanisms" ? (
        <input
          className="builder-catalog-search"
          type="search"
          value={filter}
          onChange={(event) => onFilter(event.target.value)}
          placeholder={tab === "env" ? (en ? "Search materials…" : "搜索材质…") : en ? "Search assets…" : "搜索资产…"}
          aria-label={en ? "Search assets" : "搜索资产"}
        />
      ) : null}
      {tab === "props" ? (
        <div
          className="builder-catalog-groupchips"
          role="group"
          aria-label={en ? "Theme filter" : "主题筛选"}
          onPointerDown={onGroupChipPointerDown}
          onPointerMove={onGroupChipPointerMove}
          onPointerUp={onGroupChipPointerEnd}
          onPointerCancel={onGroupChipPointerEnd}
          onClickCapture={onGroupChipClickCapture}
        >
          <button type="button" className={groupFilter === null ? "active" : ""} onClick={() => setGroupFilter(null)}>
            {en ? "All" : "全部"}
          </button>
          {furnitureGroups
            .filter((group) => visibleCatalog.some((entry) => entry.group === group))
            .map((group) => (
              <button
                key={group}
                type="button"
                className={groupFilter === group ? "active" : ""}
                onClick={() => setGroupFilter((current) => (current === group ? null : group))}
              >
                {bl(group, language)}
              </button>
            ))}
        </div>
      ) : null}

      <div className="builder-catalog-scroll">
        {recent.length > 0 && (tab === "props" || tab === "pickups" || tab === "robots" || tab === "mechanisms") ? (
          <section className="builder-recent">
            <h3>{en ? "Recently used" : "最近使用"}</h3>
            <div className="builder-recent-grid">
              {recent
                .filter(
                  (draft) =>
                    draft.kind !== "prop" ||
                    (!quarantinedKeys.has(draft.modelKey) && !isBuilderTemporarilyHidden(draft.modelKey) && !isBuilderDiscarded(draft.modelKey)),
                )
                .map((draft) => (
                  <RecentPlacementCard
                    key={placementDraftKey(draft)}
                    draft={draft}
                    active={Boolean(placement && placementDraftKey(placement) === placementDraftKey(draft))}
                    language={language}
                    onBeginPlacement={onBeginPlacement}
                  />
                ))}
            </div>
          </section>
        ) : null}

        {tab === "rooms" ? (
          <>
            <section>
              <h3>{en ? "Room Styles" : "房间风格"}</h3>
              <div className="builder-tilegrid">
                {builderRoomStyles
                  .filter((entry) => matchesFilter(filter, entry.label, "房间"))
                  .map((entry) => (
                    <button key={entry.style} type="button" className="builder-tile" onClick={() => onAddRoom(entry.style)}>
                      <RoomStyleThumb style={entry.style} />
                      <span>{bl(entry.label, language)}</span>
                      <small style={{ color: entry.accentColor }}>
                        {entry.style === "exit" ? (en ? "Evacuation goal" : "撤离终点") : en ? "Usable as a path" : "可作通路"}
                      </small>
                    </button>
                  ))}
              </div>
              <p className="builder-hint">{en ? "Click to add, drag to snap against other rooms." : "点击添加，拖动贴合其它房间。"}</p>
            </section>
            <section>
              <h3>{en ? "Non-Rectangular Rooms" : "异形房间"}</h3>
              <div className="builder-tilegrid">
                {builderRoomShapePresets
                  .filter((entry) => matchesFilter(filter, entry.label, "异形"))
                  .map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="builder-tile"
                      onClick={() => onAddShapeRoom(entry.id)}
                      title={bl(entry.hint, language)}
                    >
                      <RoomShapeThumb points={entry.points} accent={entry.accent} />
                      <span>{bl(entry.label, language)}</span>
                      <small style={{ color: entry.accent }}>{bl(entry.hint, language)}</small>
                    </button>
                  ))}
              </div>
              <p className="builder-hint">
                {en
                  ? "Stable shaped rooms: triangle and semicircle both have a flat door wall. Move/rotate that edge against another room, then add a door."
                  : "稳定异形房间：三角房和半圆厅都有平直门墙。移动/旋转到平边贴住邻室后即可加门。"}
              </p>
            </section>
            <section>
              <div className="builder-building-head">
                <h3>{en ? "Building Presets" : "建筑预设"}</h3>
                <button
                  type="button"
                  className="builder-building-rotate"
                  onClick={onRotateBuilding}
                  title={en ? "Rotate the next building preset 90°" : "旋转下一个建筑预设 90°"}
                >
                  ⟳ {(((buildingTurns % 4) + 4) % 4) * 90}°
                </button>
              </div>
              <div className="builder-tilegrid">
                {builderBuildingPresets
                  .filter((entry) => matchesFilter(filter, entry.label, "建筑"))
                  .map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="builder-tile builder-building-tile"
                      onClick={() => onStampBuilding(entry.id)}
                      title={bl(entry.hint, language)}
                    >
                      <BuildingPresetThumb
                        rooms={entry.rooms.map((room) => ({ key: room.key, center: room.center, size: room.size }))}
                        links={entry.doors.map((door) => ({ from: door.fromKey, to: door.toKey }))}
                        accent={entry.accent}
                      />
                      <span>{bl(entry.label, language)}</span>
                      <small style={{ color: entry.accent }}>
                        {en
                          ? `${entry.rooms.length} rooms · ${entry.shape === "open" ? "open" : "closed"}`
                          : `${entry.rooms.length} 间 · ${entry.shape === "open" ? "开放" : "封闭"}`}
                      </small>
                    </button>
                  ))}
              </div>
              <p className="builder-hint">
                {en
                  ? "Drops the whole door-linked group at once; press ⟳ to pick the facing, then drag it against other rooms to connect."
                  : "整组连好门一次放下；先按 ⟳ 选朝向，落地后拖动贴到其它房间即可连通。"}
              </p>
            </section>
            <section>
              <h3>{en ? "Templates" : "模板"}</h3>
              {builderTemplates
                .filter((entry) => matchesFilter(filter, entry.label, "模板"))
                .map((entry) => (
                  <button key={entry.id} type="button" className="builder-template-btn" onClick={() => onApplyTemplate(entry.id)} title={bl(entry.hint, language)}>
                    <span>{bl(entry.label, language)}</span>
                    <small>{bl(entry.hint, language)}</small>
                  </button>
                ))}
            </section>
          </>
        ) : null}

        {tab === "props" ? (
          <>
            {favoriteEntries.length > 0 && !filter.trim() ? (
              <section>
                <h3>{en ? "★ Favorites" : "★ 常用"}</h3>
                <div className="builder-cardgrid">{favoriteEntries.map(renderPropCard)}</div>
              </section>
            ) : null}
            {filter.trim() &&
            !visibleCatalog.some((entry) =>
              matchesFilter(filter, entry.label, `家具 ${entry.group}`, entry.family ?? "", entry.themeId ?? "", entry.sourceAssetId ?? ""),
            ) ? (
              <div className="builder-catalog-empty">
                <i>⌕</i>
                <strong>{en ? `No results for "${filter.trim()}"` : `没有找到「${filter.trim()}」`}</strong>
                <em>{en ? "Try a different keyword, or browse the featured pack." : "换个关键词，或看看精选包。"}</em>
                <button type="button" onClick={() => onFilter("")}>{en ? "Clear search" : "清除搜索"}</button>
              </div>
            ) : null}
            {furnitureGroups
              .filter((group) => groupFilter === null || group === groupFilter)
              .map((group) => {
                const entries = visibleCatalog.filter(
                  (entry) =>
                    entry.group === group &&
                    matchesFilter(filter, entry.label, `家具 ${group}`, entry.family ?? "", entry.themeId ?? "", entry.sourceAssetId ?? ""),
                );
                if (entries.length === 0) return null;
                const curated = group === "密室精选";
                const story = group === "故事线索";
                return (
                  <section key={group} className={curated ? "builder-curated" : story ? "builder-story-group" : undefined}>
                    <h3>{curated ? `✦ ${bl("密室精选", language)}` : story ? `🖼 ${bl("故事线索", language)}` : bl(group, language)}</h3>
                    {story ? (
                      <p className="builder-hint">
                        {en
                          ? "Narrative paintings hung on the wall — select one to write its title and clue text in the right-hand panel."
                          : "挂上墙的叙事画作——选中后可在右侧写下标题与线索文本。"}
                      </p>
                    ) : null}
                    <div className="builder-cardgrid">{entries.map(renderPropCard)}</div>
                  </section>
                );
              })}
          </>
        ) : null}

        {tab === "pickups" ? (
          <section className="builder-pickup-lane">
            <h3>{en ? "✚ Pickups" : "✚ 拾取道具"}</h3>
            <p className="builder-hint">
              {en
                ? "These enter the playtest pickup system; Raw / WebGPU reuse the same baked models as the legacy levels."
                : "这些会进入试玩拾取系统，Raw / WebGPU 使用旧关卡同款烘焙模型。"}
            </p>
            <div className="builder-cardgrid">
              {builderPickupCatalog.map((entry) => (
                <div key={entry.kind} className={`builder-asset-card ${placement?.kind === "pickup" && placement.pickupKind === entry.kind ? "placing" : ""}`}>
                  <button
                    type="button"
                    className="builder-asset-card-main"
                    title={`${bl(entry.label, language)} · ${bl(entry.hint, language)}`}
                    onClick={() => onAddPickup(entry.kind)}
                  >
                    <span className="builder-asset-card-art">
                      <PickupImageThumb kind={entry.kind} />
                      <em className="builder-asset-card-place">{en ? "＋ Place" : "＋ 放置"}</em>
                    </span>
                    <span className="builder-asset-card-label">{bl(entry.label, language)}</span>
                    <span className="builder-asset-card-meta">
                      <small>{bl(entry.hint, language)}</small>
                    </span>
                  </button>
                </div>
              ))}
            </div>
            <p className="builder-hint">
              {en
                ? "The release key auto-binds to the first key door; after selecting it you can rebind it to another key door in the right-hand panel."
                : "解除钥会自动绑定第一扇钥匙门；选中后可在右侧改成别的钥匙门。"}
            </p>
          </section>
        ) : null}

        {tab === "puzzles" ? (
          <section className="builder-puzzle-lane">
            <h3>{en ? "◈ Puzzles" : "◈ 谜题"}</h3>
            <p className="builder-hint">
              {en
                ? "Each puzzle brings the door it unlocks, auto-placed between snapped rooms."
                : "每座谜题都带一扇它解锁的门，自动放在贴边房间之间。"}
            </p>
            {builderPuzzlePublicKinds.map((entry) => {
              const colorBlocked = entry.kind === "color_sequence" && hasColorSequencePuzzle;
              return (
                <button
                  key={entry.kind}
                  type="button"
                  className={`builder-puzzle-card ${colorBlocked ? "blocked" : ""}`}
                  style={{ color: entry.color }}
                  title={
                    colorBlocked
                      ? en
                        ? "Only one light-sequence memory lock is allowed; select the existing one to change its orbs."
                        : "灯序记忆锁只能有一座；选中现有灯序锁可改色球。"
                      : `${bl(entry.howToSolve, language)} → ${bl(entry.unlocks, language)}`
                  }
                  disabled={colorBlocked}
                  onClick={() => onAddPuzzle(entry.kind)}
                >
                  <i className="builder-puzzle-card-glyph">
                    <PuzzleKindIcon kind={entry.kind} color={entry.color} />
                  </i>
                  <span className="builder-puzzle-card-body">
                    <strong>{bl(entry.label, language)}</strong>
                    <em>
                      {colorBlocked
                        ? en
                          ? "Already placed: tune the existing sequence on the right"
                          : "已放置：去右侧调整现有灯序"
                        : bl(entry.howToSolve, language)}
                    </em>
                    <small>
                      {colorBlocked
                        ? en
                          ? "✓ Singleton"
                          : "✓ 单例"
                        : entry.kind === "archive_merge"
                          ? en
                            ? "Target from 64 · selectable up to 2048"
                            : "目标 64 起 · 选中可调到 2048"
                          : entry.kind === "valve_matrix"
                            ? en
                              ? "3-gate screen · tune all readouts green"
                              : "三闸屏幕 · 三块状态表进绿区"
                          : `🔓 ${bl(entry.unlocks, language)}`}
                    </small>
                  </span>
                  <b className="builder-puzzle-card-add">{colorBlocked ? "✓" : "＋"}</b>
                </button>
              );
            })}
            <p className="builder-hint">
              {en
                ? "After selecting a puzzle door or puzzle station, the right-hand panel lets you change its type, position, color order and identity-compression target."
                : "选中谜题门或谜题台后，右侧可改类型、位置、颜色顺序与身份压缩目标。"}
            </p>
          </section>
        ) : null}

        {tab === "mechanisms" ? (
          <section className="builder-puzzle-lane builder-mechanism-lane">
            <h3>{en ? "⌁ Mechanisms" : "⌁ 机关"}</h3>
            <p className="builder-hint">
              {en
                ? "One routing key cycles through 1-4 outputs: open doors, feed a puzzle station, wake a robot room."
                : "一把路由钥匙，循环切换 1-4 个输出：开门、接入谜题台、唤醒机器人房间。"}
            </p>
            {(() => {
              const routePlacementDraft: PlacementDraft = { kind: "routeSwitch" };
              const beginRoutePlacement = () => {
                if (project.rooms.length === 0) {
                  onStatus?.(en ? "Add a room first, then place a route switch." : "先添加一个房间，再放路由台。");
                  return;
                }
                onBeginPlacement(routePlacementDraft);
              };
              return (
            <button
              type="button"
              className={`builder-puzzle-card builder-route-card ${placement?.kind === "routeSwitch" ? "placing" : ""}`}
              style={{ color: "#5ee8c8" }}
              title={en ? "Place a control routing station: configure the key room and output targets on the right" : "放置管制路由台：右侧配置钥匙房间与输出目标"}
              draggable
              onClick={beginRoutePlacement}
              onDragStart={(event) => {
                writePlacementDragPayload(event, routePlacementDraft);
                beginRoutePlacement();
              }}
            >
              <i className="builder-puzzle-card-glyph">
                <svg viewBox="0 0 24 24" className="builder-puzzlekind-icon" aria-hidden="true">
                  <rect x="4" y="5" width="16" height="14" rx="2" fill="#061617" stroke="#5ee8c8" strokeOpacity="0.72" />
                  <path d="M7 12h3.8M13.2 8H17M13.2 16H17" stroke="#5ee8c8" strokeWidth="1.7" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="2" fill="#5ee8c8" fillOpacity="0.9" />
                  <circle cx="18" cy="8" r="1.6" fill="#ffd76b" />
                  <circle cx="18" cy="16" r="1.6" fill="#7bb7ff" />
                </svg>
              </i>
              <span className="builder-puzzle-card-body">
                <strong>{en ? "Control Routing Station" : "管制路由台"}</strong>
                <em>{en ? "One key unlocks multiple routed outputs" : "一个钥匙解锁，多路输出控制"}</em>
                <small>{en ? "Doors · puzzle stations · robot rooms" : "门 · 谜题台 · 机器人房间"}</small>
              </span>
              <b className="builder-puzzle-card-add">＋</b>
            </button>
              );
            })()}
            {(() => {
              const wallSwitchPlacementDraft: PlacementDraft = { kind: "wallDoorSwitch" };
              const beginWallSwitchPlacement = () => {
                if (project.rooms.length === 0) {
                  onStatus?.(en ? "Add a room first, then mount a wall switch." : "先添加一个房间，再挂墙控把手。");
                  return;
                }
                onBeginPlacement(wallSwitchPlacementDraft);
              };
              return (
            <button
              type="button"
              className={`builder-puzzle-card builder-route-card ${placement?.kind === "wallDoorSwitch" ? "placing" : ""}`}
              style={{ color: "#7bb7ff" }}
              title={en ? "Drag or click to mount a wall door switch on a room wall" : "点击或拖入场景，把墙面门控把手挂到房间墙上"}
              draggable
              onClick={beginWallSwitchPlacement}
              onDragStart={(event) => {
                writePlacementDragPayload(event, wallSwitchPlacementDraft);
                beginWallSwitchPlacement();
              }}
            >
              <i className="builder-puzzle-card-glyph">
                <WallDoorSwitchThumb />
              </i>
              <span className="builder-puzzle-card-body">
                <strong>{en ? "Wall Door Switch" : "墙面门控把手"}</strong>
                <em>{en ? "Mounts on a wall, then bind door states" : "挂在墙上，再绑定门状态"}</em>
                <small>{en ? "Drag into the room edge · movable after placement" : "拖进墙边放置 · 后续可沿墙移动"}</small>
              </span>
              <b className="builder-puzzle-card-add">＋</b>
            </button>
              );
            })()}
            <p className="builder-hint">
              {en
                ? "After selecting a mechanism, bind existing locked doors, puzzle stations and robot-occupied rooms on the right."
                : "选中机关后，右侧绑定已存在的锁门、谜题台和有机器人的房间。"}
            </p>
          </section>
        ) : null}

        {tab === "robots" ? (
          <section>
            <h3>{en ? "Hostile Units" : "敌对单位"}</h3>
            <div className="builder-tilegrid">
              {builderRobotCatalog
                .filter((entry) => matchesFilter(filter, entry.label, entry.hint ?? "机器人"))
                .map((entry) => (
                  <button
                    key={entry.id ?? entry.archetype}
                    type="button"
                    className={`builder-tile ${placement?.kind === "robot" && placement.archetype === entry.archetype && placement.presetId === entry.presetId ? "placing" : ""}`}
                    onClick={() => onBeginPlacement({ kind: "robot", archetype: entry.archetype, ...(entry.presetId ? { presetId: entry.presetId } : {}) })}
                  >
                    <RobotThumb archetype={entry.archetype} />
                    <span>{bl(entry.label, language)}</span>
                    {entry.hint ? <small>{bl(entry.hint, language)}</small> : null}
                    <small className="builder-tile-threat">
                      {Array.from({ length: 5 }, (_, index) => (
                        <b key={index} className={index < (entry.presetId ? 5 : robotThreatDots[entry.archetype] ?? 1) ? "on" : ""} />
                      ))}
                    </small>
                  </button>
                ))}
            </div>
            <p className="builder-hint">{en ? "Select, then click the floor to deploy. The wave triggers when the player enters the room." : "点选后在地面点击部署。玩家进房触发该波。"}</p>
          </section>
        ) : null}

        {tab === "env" ? (
          <>
            <section>
              <h3>{en ? "Floor Materials" : "地板材质"}</h3>
              <div className="builder-swatchgrid">
                {builderFloorPresets
                  .filter((preset) => matchesFilter(filter, preset.label, "地板"))
                  .map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`builder-swatch-tile ${brush?.kind === "floor" && brush.presetId === preset.id ? "placing" : ""}`}
                      title={bl(preset.label, language)}
                      onClick={() => onBeginBrush({ kind: "floor", presetId: preset.id })}
                    >
                      <SurfaceSwatch preset={preset} />
                      <span>{bl(preset.label, language)}</span>
                    </button>
                  ))}
              </div>
            </section>
            <section>
              <h3>{en ? "Wall Materials" : "墙面材质"}</h3>
              <div className="builder-swatchgrid">
                {builderWallPresets
                  .filter((preset) => matchesFilter(filter, preset.label, "墙"))
                  .map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`builder-swatch-tile ${brush?.kind === "wall" && brush.presetId === preset.id ? "placing" : ""}`}
                      title={bl(preset.label, language)}
                      onClick={() => onBeginBrush({ kind: "wall", presetId: preset.id })}
                    >
                      <SurfaceSwatch preset={preset} />
                      <span>{bl(preset.label, language)}</span>
                    </button>
                  ))}
              </div>
            </section>
            <section>
              <h3>{en ? "Ceiling Materials" : "天花板材质"}</h3>
              <div className="builder-swatchgrid">
                {builderCeilingPresets
                  .filter((preset) => matchesFilter(filter, preset.label, "天花板 顶 ceiling"))
                  .map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`builder-swatch-tile ${brush?.kind === "ceiling" && brush.presetId === preset.id ? "placing" : ""}`}
                      title={bl(preset.label, language)}
                      onClick={() => onBeginBrush({ kind: "ceiling", presetId: preset.id })}
                    >
                      <SurfaceSwatch preset={preset} />
                      <span>{bl(preset.label, language)}</span>
                    </button>
                  ))}
              </div>
              <p className="builder-hint">{en ? "Floor, wall and ceiling live in one environment material shelf. Click a room to apply; hold Shift to keep brushing whole rooms." : "地板、墙壁、天花板都在同一个环境材质分类里。点房间应用；按住 Shift 连续统一整房间。"}</p>
            </section>
          </>
        ) : null}

        {tab === "doors" ? (
          <section>
            <h3>{en ? "Doors / Locks" : "门 / 锁"}</h3>
            <div className="builder-tilegrid">
              {lockTiles
                .filter((entry) => matchesFilter(filter, builderLockLabels[entry.lockType], "门"))
                .map((entry) => (
                  <button
                    key={entry.lockType}
                    type="button"
                    className="builder-tile builder-lock-tile"
                    style={{ color: entry.color }}
                    title={entry.hint}
                    onClick={() => onAddDoor(entry.lockType)}
                  >
                    <i className="builder-lock-glyph">{entry.glyph}</i>
                    <span>{bl(builderLockLabels[entry.lockType], language)}</span>
                    <small>{entry.hint}</small>
                  </button>
                ))}
            </div>
            <p className="builder-hint">
              {en
                ? "Auto-placed between snapped rooms (shared edge ≥3.4 m); rebind on the right after selecting."
                : "自动放在贴边房间之间（共享边 ≥3.4 米），选中后右侧改绑定。"}
            </p>
          </section>
        ) : null}
      </div>

      {quarantined.length > 0 ? (
        <section className={`builder-quarantine-tray ${trayOpen ? "open" : ""}`} aria-label={en ? "Hidden assets tray" : "隐藏资产托盘"}>
          <button
            type="button"
            className="builder-quarantine-head"
            title={en ? "Hidden assets: collapsed from the catalog, restorable, files are not deleted" : "隐藏资产：目录中收起，可恢复，不会删除文件"}
            onClick={() => setTrayOpen((value) => !value)}
          >
            <i>⌫</i>
            <b>{quarantined.length}</b>
            <em>{trayOpen ? "▾" : "▸"}</em>
          </button>
          {trayOpen ? (
            <div className="builder-quarantine-body">
              {quarantined.map((record) => (
                <div key={record.modelKey} className="builder-quarantine-row">
                  <AssetImageThumb modelKey={record.modelKey} />
                  <div>
                    <strong>{bl(record.label, language)}</strong>
                    <em>{bl(record.group, language)}</em>
                  </div>
                  <button type="button" onClick={() => handleRestore(record.modelKey, record.label)}>
                    {en ? "Restore" : "恢复"}
                  </button>
                </div>
              ))}
              <div className="builder-quarantine-actions">
                <button
                  type="button"
                  title={en ? "Copy the hidden-asset list JSON (with source-file hints) for manual cleanup" : "复制隐藏资产清单 JSON（含源文件线索），交给人工整理"}
                  onClick={() => {
                    navigator.clipboard?.writeText(quarantineListJson()).then(
                      () => onStatus?.(en ? "Hidden-asset list copied to the clipboard." : "隐藏资产清单已复制到剪贴板。"),
                      () =>
                        onStatus?.(
                          en
                            ? "Copy failed; see the records in docs/pending-delete/builder-assets/."
                            : "复制失败，可在 docs/pending-delete/builder-assets/ 查看记录。",
                        ),
                    );
                  }}
                >
                  {en ? "Copy list" : "复制清单"}
                </button>
                <button
                  type="button"
                  className="builder-danger"
                  title={en ? "Restore all hidden assets back to the catalog" : "把所有隐藏资产恢复回目录"}
                  onClick={() => {
                    restoreAllAssets();
                    onStatus?.(en ? "Hidden-asset tray cleared; all assets restored." : "隐藏资产托盘已清空，全部资产恢复。");
                  }}
                >
                  {en ? "Restore all" : "全部恢复"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}

export const BuilderAssetBrowser = memo(
  BuilderAssetBrowserImpl,
  (prev, next) =>
    prev.project === next.project &&
    prev.tab === next.tab &&
    prev.filter === next.filter &&
    prev.placement === next.placement &&
    prev.brush === next.brush &&
    prev.recent === next.recent &&
    prev.buildingTurns === next.buildingTurns,
);

function matchesFilter(filter: string, ...haystacks: string[]) {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  return haystacks.some((haystack) => haystack.toLowerCase().includes(needle));
}
