import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useBuilderMusic } from "./useBuilderMusic";
import { builderLockLabels, builderRobotCatalog, propEntry, robotLabel, roomStyleEntry } from "./BuilderAssetCatalog";
import { BuilderAssetBrowser, placementDraftKey, type BuilderCatalogTab } from "./BuilderAssetBrowser";
import { BuilderBuildToolbar, type BuilderToolId } from "./BuilderBuildToolbar";
import { BuilderCanvas2D, defaultViewport, type BuilderViewport } from "./BuilderCanvas2D";
import { BuilderConfirmModal } from "./BuilderConfirmModal";
import { builderDoorEndpointLabel, builderDoorSurviveRobotIds, builderDoorWaveIds, builderRobotAuthoredWaveId } from "./BuilderDoorRelations";
import { builderTemplates, computeStatusChips, createBlankProject, findAutoDoorPlacement, repairProject } from "./BuilderDirector";
import { buildingPresetById, stampBuildingPreset, suggestBuildingDropCenter } from "./BuilderBuildingPresets";
import { roomShapePresetById } from "./BuilderRoomShapePresets";
import { shapeBboxSize } from "./BuilderRoomShape";
import { BuilderDirectorStrip, type BuilderDirectorGoal } from "./BuilderDirectorStrip";
import {
  createPuzzleInstanceForDoor,
  normalizeBuilderPuzzles,
  puzzleForDoor,
  puzzleInstances,
  puzzleKindEntry,
} from "./BuilderPuzzleCatalog";
import { projectWithAnchoredPuzzleComponentsForProp } from "./BuilderPuzzlePlacement";
import { pickupEntry } from "./BuilderPickupCatalog";
import {
  applyBrushToRooms,
  brushPreset,
  builderCeilingPresets,
  builderFloorPresets,
  builderWallPresets,
  surfacePreset,
  type BrushApplication,
  type BuilderBrush,
} from "./BuilderEnvironment";
import { FloorPatternDefs } from "./BuilderAssetFootprints";
import { ToggleChip } from "./BuilderFields";
import { BuilderInspectorPanel } from "./BuilderInspectorPanel";
import { BuilderSelectionProvider, type BuilderFocusRequest, type BuilderSelectionContextValue } from "./BuilderSelectionContext";
import { BuilderLanguageProvider, useBuilderLanguageState } from "./i18n/builderLanguage";
import { bl } from "./i18n/catalogLabels";
import type { GameLanguage } from "../game/core/GameSettings";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { BuilderOverlayLegend } from "./preview3d/BuilderOverlayLegend";
import { normalizeBuilderProjectForBoot } from "./BuilderLoadPolicy";
import { builderProjectFromBuiltInLevel, normalizeOfficialBuilderProject, pristineOfficialSourceLevelIdForProject, readBuilderImportLevelId } from "./BuilderLevelImport";
import { wallDoorSwitchDraftPlacementFromPoint, wallMountedPropPlacementForEntryFromPoint, type PlacementDraft } from "./BuilderPlacementRules";
import { builderRobotPresetDefaults, isBuilderRobotPresetId } from "./BuilderRobotPresets";
import {
  attachedChildCount,
  clearPropStacking,
  propWithStacking,
  reflowAttachedProps,
  resolvePropStacking,
  type PropStackingResolution,
} from "./BuilderPropStacking";
import { BuilderPlaytestPackControls } from "./BuilderPlaytestPackControls";
import { BrushPreviewPatternDef, RoomSurfacePatternDefs, SurfacePatternDefs, SurfaceSwatch } from "./BuilderSurfaceArt";
import { computeTopology } from "./BuilderTopology";
import { useBuilderHistory } from "./BuilderHistory";
import { BuilderPreview3D } from "./BuilderPreview3D";
import { BuilderViewportControls, type BuilderViewMode } from "./BuilderViewportControls";
import { localizeBuilderProjectSourceCopy } from "./BuilderProjectLocalization";
import { applyToggleDoorOwnership, createDedicatedWallDoorSwitch } from "./BuilderWallDoorSwitches";
import { builderUiImage2CssVars } from "./BuilderUiImage2Slices";
import { normalizeBuilderKeyPickups } from "./BuilderKeyPickups";
import { clearBuilderRuntimePackCache } from "./runtime-pack/BuilderRuntimePackStore";
import {
  clearBuilderProjectSlot,
  exportBuilderProjectJson,
  loadBuilderProjectFromSlot,
  loadBuilderDraft,
  loadBuilderSaveSlots,
  saveBuilderDraft,
  hasBuilderDraft,
  hasSeenBuilderOnboarding,
  markBuilderOnboardingSeen,
  saveBuilderProjectAsPack,
  saveBuilderProjectSlot,
  summarizeBuilderSaveProject,
  validateBuilderProject,
  type BuilderSaveSlot,
  type BuilderSaveResult,
  type BuilderValidationResult,
} from "./BuilderStorage";
import type { BuilderPaintFlash } from "./BuilderEnvironment";
import { BuilderOnboardingOverlay } from "./BuilderOnboardingOverlay";
import type { BuilderUpdate } from "./BuilderHistory";
import {
  createBuilderId,
  type BuilderDoor,
  type BuilderLockType,
  type BuilderPickup,
  type BuilderPickupKind,
  type BuilderProject,
  type BuilderProp,
  type BuilderPuzzleHostPick,
  type BuilderPuzzleKind,
  type BuilderRobotArchetype,
  type BuilderRobotGroup,
  type BuilderRouteSwitch,
  type BuilderRouteSwitchOutput,
  type BuilderRoom,
  type BuilderSelection,
  type BuilderWallDoorSwitch,
} from "./BuilderTypes";
import { sharedEdge } from "./compileBuilderProjectToLevel";

/** Remembers the last view mode (2D / 3D) across sessions. */
const BUILDER_VIEW_MODE_STORAGE_KEY = "hp-builder-view-mode-v1";
const BUILDER_RECENT_PLACEMENT_STORAGE_KEY = "hp-builder-recent-placement-v1";
const BUILDER_INSPECTOR_COLLAPSED_STORAGE_KEY = "hp-builder-inspector-collapsed-v1";

function propPlacementIssueText(resolved: PropStackingResolution, language: GameLanguage): string {
  if (resolved.reason === "no_support") {
    return language === "en" ? "Place this on a table, shelf, or stack surface." : "需要放在桌面、书架或可堆叠物上。";
  }
  if (resolved.reason === "stack_limit") {
    return language === "en" ? "That stack is already at its height limit." : "这叠已经到高度上限，换个位置。";
  }
  if (resolved.reason === "surface_occupied") {
    return language === "en" ? (resolved.message ?? "That surface spot is occupied.") : "这里已经有小物件占位，换个桌面位置。";
  }
  return language === "en" ? (resolved.message ?? "Can't place here.") : "这里不能放置这个物件。";
}

function readStoredBuilderViewMode(): BuilderViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(BUILDER_VIEW_MODE_STORAGE_KEY);
    if (stored === "preview") return "split";
    return stored === "plan" || stored === "split" ? stored : null;
  } catch {
    return null;
  }
}

function initialBuilderViewMode(forcePreviewIntro: boolean): BuilderViewMode {
  if (forcePreviewIntro) return "split";
  const stored = readStoredBuilderViewMode();
  if (stored) return stored;
  return "split";
}

function sameBuilderSelection(left: BuilderSelection, right: BuilderSelection) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.kind !== right.kind || left.id !== right.id) return false;
  const leftComponent = left.kind === "puzzle" ? (left.componentId ?? "") : "";
  const rightComponent = right.kind === "puzzle" ? (right.componentId ?? "") : "";
  return leftComponent === rightComponent;
}

function defaultRobotGroupLabel(archetype: BuilderRobotArchetype, presetId: string | undefined, index: number) {
  const base = presetId ? (builderRobotCatalog.find((entry) => entry.presetId === presetId)?.label ?? robotLabel(archetype)) : robotLabel(archetype);
  return `${base} ${index}`;
}

function clearDoorRobotBindings(
  door: BuilderDoor,
  removedRobots: readonly Pick<BuilderRobotGroup, "id" | "wave" | "waveChain">[],
  remainingRobots: readonly Pick<BuilderRobotGroup, "wave" | "waveChain">[],
) {
  const removedRobotIds = new Set(removedRobots.map((robot) => robot.id));
  const remainingWaveIds = new Set(remainingRobots.map((robot) => builderRobotAuthoredWaveId(robot)).filter((id): id is string => Boolean(id)));
  const removedWaveIds = new Set(
    removedRobots
      .map((robot) => builderRobotAuthoredWaveId(robot))
      .filter((id): id is string => Boolean(id))
      .filter((id) => !remainingWaveIds.has(id)),
  );
  const previousRobotIds = builderDoorSurviveRobotIds(door);
  const mergedRobotIds = previousRobotIds.filter((robotId) => !removedRobotIds.has(robotId));
  const previousWaveIds = builderDoorWaveIds(door);
  const mergedWaveIds = previousWaveIds.filter((waveId) => !removedWaveIds.has(waveId));
  if (mergedRobotIds.length === previousRobotIds.length && mergedWaveIds.length === previousWaveIds.length) return door;
  return { ...door, surviveRobotIds: mergedRobotIds, surviveRobotId: mergedRobotIds[0], waveIds: mergedWaveIds, waveId: mergedWaveIds[0] };
}

function normalizeStoredPlacementDraft(value: unknown): PlacementDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as {
    kind?: unknown;
    modelKey?: unknown;
    pickupKind?: unknown;
    archetype?: unknown;
    presetId?: unknown;
    rotationY?: unknown;
  };
  if (draft.kind === "prop" && typeof draft.modelKey === "string") {
    return { kind: "prop", modelKey: draft.modelKey, rotationY: typeof draft.rotationY === "number" ? draft.rotationY : 0 };
  }
  if (draft.kind === "pickup" && typeof draft.pickupKind === "string") {
    return { kind: "pickup", pickupKind: draft.pickupKind as BuilderPickupKind };
  }
  if (draft.kind === "robot" && typeof draft.archetype === "string") {
    return {
      kind: "robot",
      archetype: draft.archetype as BuilderRobotArchetype,
      ...(isBuilderRobotPresetId(draft.presetId) ? { presetId: draft.presetId } : {}),
    };
  }
  if (draft.kind === "routeSwitch") return { kind: "routeSwitch" };
  if (draft.kind === "wallDoorSwitch") return { kind: "wallDoorSwitch" };
  return null;
}

function readStoredRecentPlacements(): PlacementDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BUILDER_RECENT_PLACEMENT_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const normalized: PlacementDraft[] = [];
    for (const item of parsed) {
      const draft = normalizeStoredPlacementDraft(item);
      if (!draft) continue;
      const key = placementDraftKey(draft);
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(draft);
      if (normalized.length >= 8) break;
    }
    return normalized;
  } catch {
    return [];
  }
}

function writeStoredRecentPlacements(recent: readonly PlacementDraft[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUILDER_RECENT_PLACEMENT_STORAGE_KEY, JSON.stringify(recent.slice(0, 8)));
  } catch {
    /* recent placements are best-effort */
  }
}

function readStoredInspectorCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(BUILDER_INSPECTOR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function BuildPage() {
  const stopBuilderMusic = useBuilderMusic();
  const builderLang = useBuilderLanguageState();
  const language = builderLang.language;
  const importLevelIdRef = useRef(readBuilderImportLevelId());
  const hasDraftAtBootRef = useRef(hasBuilderDraft());
  const hasSeenOnboardingAtBootRef = useRef(hasSeenBuilderOnboarding());
  const firstRunBlankRef = useRef(!importLevelIdRef.current && !hasDraftAtBootRef.current);
  const showFirstRunOnboardingRef = useRef(firstRunBlankRef.current && !hasSeenOnboardingAtBootRef.current);
  const runtimeCacheClearHandledRef = useRef(false);
  const [project, rawUpdate, rawReplaceProject, history] = useBuilderHistory(() => {
    const importLevelId = importLevelIdRef.current;
    const initial = importLevelId
      ? (builderProjectFromBuiltInLevel(importLevelId) ?? loadBuilderDraft())
      : hasDraftAtBootRef.current
        ? loadBuilderDraft()
        : createBlankProject();
    // Legacy drafts: door-bound puzzles become editable instances.
    return localizeBuilderProjectSourceCopy(
      normalizeBuilderProjectForEditing(normalizeBuilderProjectForBoot(initial, { officialImport: Boolean(importLevelId) })),
      language,
    );
  });
  const update = useCallback<BuilderUpdate>(
    (mutate, options) => rawUpdate((draft) => normalizeBuilderProjectForEditing(mutate(draft)), options),
    [rawUpdate],
  );
  const replaceProject = useCallback(
    (next: BuilderProject) => rawReplaceProject(localizeBuilderProjectSourceCopy(normalizeBuilderProjectForEditing(next), language)),
    [language, rawReplaceProject],
  );
  const [selection, setSelection] = useState<BuilderSelection>(null);
  // First-run onboarding: keep the 3D editor visible and float a skip/next guide.
  const [showOnboarding, setShowOnboarding] = useState(
    () => showFirstRunOnboardingRef.current,
  );
  const [result, setResult] = useState<BuilderValidationResult | BuilderSaveResult | null>(null);
  const [statusText, setStatusText] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [saveLibraryOpen, setSaveLibraryOpen] = useState(false);
  const [saveSlots, setSaveSlots] = useState<BuilderSaveSlot[]>(() => loadBuilderSaveSlots());
  const [viewMode, setViewMode] = useState<BuilderViewMode>(() => initialBuilderViewMode(showFirstRunOnboardingRef.current));
  const [viewport, setViewport] = useState<BuilderViewport>(defaultViewport);
  const [hovered, setHovered] = useState<BuilderSelection>(null);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedLevelId, setSavedLevelId] = useState<string | null>(null);
  const [playtestRequestToken, setPlaytestRequestToken] = useState(0);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [catalogTab, setCatalogTab] = useState<BuilderCatalogTab>("props");
  const [placement, setPlacement] = useState<PlacementDraft | null>(null);
  const [activeTool, setActiveTool] = useState<BuilderToolId>("select");
  const [recent, setRecent] = useState<PlacementDraft[]>(() => readStoredRecentPlacements());
  /** Quarter-turn rotation applied to the next building preset before it lands. */
  const [buildingTurns, setBuildingTurns] = useState(0);
  const [snapOn, setSnapOn] = useState(true);
  const [blueprintOpen, setBlueprintOpen] = useState(true);
  /** Shared semantic-selection: 2D→3D camera focus signal + 3D overlay toggle. */
  const [focusRequest, setFocusRequest] = useState<BuilderFocusRequest | null>(null);
  const focusTokenRef = useRef(0);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  /** Stage cutaway: editor defaults to an open roof; playtests always bake one. */
  const [roofHidden, setRoofHidden] = useState(true);
  /** Guided puzzle binding: armed kind waiting for the user to click a door. */
  const [puzzleBind, setPuzzleBind] = useState<BuilderPuzzleKind | null>(null);
  const puzzleBindRef = useRef<BuilderPuzzleKind | null>(null);
  puzzleBindRef.current = puzzleBind;
  /** Guided puzzle host picking: armed puzzle/component waiting for a prop click. */
  const [hostPick, setHostPick] = useState<BuilderPuzzleHostPick | null>(null);
  const hostPickRef = useRef<BuilderPuzzleHostPick | null>(null);
  hostPickRef.current = hostPick;
  const [builderMenuOpen, setBuilderMenuOpen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(() => readStoredInspectorCollapsed());
  const builderMenuOpenRef = useRef(false);
  builderMenuOpenRef.current = builderMenuOpen;
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [brush, setBrush] = useState<BuilderBrush | null>(null);
  const [continuousPaint, setContinuousPaint] = useState(false);
  const [paintFlash, setPaintFlash] = useState<BuilderPaintFlash | null>(null);
  const paintFlashTimer = useRef<number | null>(null);
  const [placeFlash, setPlaceFlash] = useState<{ x: number; z: number; token: number; color: string } | null>(null);
  const placeFlashTimer = useRef<number | null>(null);
  const lastFloorPresetRef = useRef(builderFloorPresets[0].id);
  const lastWallPresetRef = useRef(builderWallPresets[0].id);
  const lastCeilingPresetRef = useRef(builderCeilingPresets[0].id);
  const panMode = activeTool === "pan";
  const armedBrushPreset = brush ? brushPreset(brush) : null;

  const statusChips = useMemo(() => computeStatusChips(project), [project]);
  const topology = useMemo(() => computeTopology(project), [project]);
  const snapStep = snapOn ? 0.5 : 0.05;

  useEffect(() => {
    const normalized = normalizeBuilderKeyPickups(project);
    if (normalized !== project) update(() => normalized, { record: false });
  }, [project, update]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveBuilderDraft(project), 350);
    return () => window.clearTimeout(timer);
  }, [project]);

  // Remember the last view mode so returning creators land where they left off.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(BUILDER_VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      /* persistence is best-effort */
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(BUILDER_INSPECTOR_COLLAPSED_STORAGE_KEY, inspectorCollapsed ? "1" : "0");
    } catch {
      /* persistence is best-effort */
    }
  }, [inspectorCollapsed]);

  useEffect(() => {
    if (runtimeCacheClearHandledRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("clearRuntimePacks") !== "1") return;
    runtimeCacheClearHandledRef.current = true;

    saveBuilderDraft(project);
    try {
      window.localStorage.setItem(
        "human-protocol-builder-draft-backup-before-runtime-cache-clear-v1",
        JSON.stringify({ backedUpAt: new Date().toISOString(), project }),
      );
    } catch {
      // Draft itself has already been saved; the named backup is best-effort.
    }

    params.delete("clearRuntimePacks");
    const nextQuery = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`);

    void clearBuilderRuntimePackCache()
      .then((result) => {
        if (result.blocked) {
          setStatusText(
            language === "en"
              ? "Map kept; the playtest cache is held by the browser — close the playtest tab and clear again."
              : "地图已保留；试玩缓存被浏览器占用，请关闭试玩页后再清一次。",
          );
          return;
        }
        setStatusText(
          result.deletedDatabase
            ? language === "en"
              ? "Playtest bake cache cleared, map config kept. A fresh deep bake will use the new models."
              : "已清空试玩烘焙缓存，地图配置已保留。现在重新深度烘焙会使用新模型。"
            : language === "en"
              ? "Playtest cache pointers cleared, map config kept."
              : "已清空试玩缓存指针，地图配置已保留。",
        );
      })
      .catch(() =>
        setStatusText(
          language === "en"
            ? "Map kept; clearing the playtest cache failed — refresh and try again."
            : "地图已保留；试玩缓存清理失败，请刷新后再试。",
        ),
      );
  }, [language, project]);

  useEffect(() => {
    if (!selection || placement || brush || puzzleBind) return;
    if (selection.kind === "puzzle") {
      setCatalogTab("puzzles");
      setActiveTool("puzzles");
      setStatusText(
        language === "en"
          ? "Puzzle selected: change its kind on the left; tune the bound door and puzzle station on the right."
          : "谜题已选中：左侧可换谜题类型；右侧可调绑定门与谜题台。",
      );
      return;
    }
    if (selection.kind === "routeSwitch") {
      setCatalogTab("mechanisms");
      setActiveTool("mechanisms");
      setStatusText(
        language === "en"
          ? "Route switch selected: pick the key room and 1-4 outputs on the right."
          : "路由台已选中：右侧选择钥匙房间与 1-4 个输出。",
      );
      return;
    }
    if (selection.kind === "pickup") {
      setCatalogTab("pickups");
      setActiveTool("pickups");
      setStatusText(
        language === "en"
          ? "Pickup selected: change its kind, room and key-door binding on the right."
          : "拾取物已选中：右侧可改类型、房间和钥匙门绑定。",
      );
      return;
    }
    if (selection.kind === "door") {
      const door = project.doors.find((candidate) => candidate.id === selection.id);
      const nextTab: BuilderCatalogTab = door?.lockType === "puzzle_complete" ? "puzzles" : "doors";
      setCatalogTab(nextTab);
      setActiveTool(nextTab);
      setStatusText(
        door?.lockType === "puzzle_complete"
          ? language === "en"
            ? "Puzzle door selected: change the puzzle kind on the left."
            : "谜题门已选中：左侧可换谜题类型。"
          : language === "en"
            ? "Door selected: change the lock type on the left."
            : "门已选中：左侧可换门锁类型。",
      );
    }
  }, [brush, language, placement, project.doors, puzzleBind, selection]);

  useEffect(() => {
    if (!importLevelIdRef.current) return;
    setStatusText(
      language === "en"
        ? `Created an editable draft from official level ${importLevelIdRef.current}; saving makes a new local level and never overwrites the official one.`
        : `已从官卡 ${importLevelIdRef.current} 生成可编辑草稿；保存会生成新的本地关卡，不会覆盖官卡。`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const criticalPath = useMemo(() => computeCriticalPath(project), [project]);

  const removeSelection = useCallback(() => {
    if (!selection) return;
    let statusOverride: string | null = null;
    update((draft) => {
      if (selection.kind === "room") {
        const removedDoorIds = new Set(
          draft.doors.filter((door) => door.fromRoomId === selection.id || door.toRoomId === selection.id).map((door) => door.id),
        );
        const removedRobots = draft.robots.filter((robot) => robot.roomId === selection.id);
        const remainingRobots = draft.robots.filter((robot) => robot.roomId !== selection.id);
        return {
          ...draft,
          rooms: draft.rooms.filter((room) => room.id !== selection.id),
          doors: draft.doors
            .filter((door) => !removedDoorIds.has(door.id))
            .map((door) => clearDoorRobotBindings(door, removedRobots, remainingRobots)),
          props: draft.props.filter((prop) => prop.roomId !== selection.id),
          pickups: (draft.pickups ?? []).filter((pickup) => pickup.roomId !== selection.id),
          robots: draft.robots.filter((robot) => robot.roomId !== selection.id),
          // Cascade: puzzles whose door went away go with the room.
          puzzles: (draft.puzzles ?? []).filter((instance) => !removedDoorIds.has(instance.linkedDoorId)),
          routeSwitches: (draft.routeSwitches ?? [])
            .filter((route) => route.roomId !== selection.id && route.keyRoomId !== selection.id)
            .map((route) => ({
              ...route,
              outputs: route.outputs.map((output) =>
                output.keyRoomId === selection.id ? { ...output, keyRoomId: undefined, keyPosition: undefined } : output,
              ),
            })),
          wallDoorSwitches: (draft.wallDoorSwitches ?? []).filter((wallSwitch) => wallSwitch.roomId !== selection.id),
        };
      }
      if (selection.kind === "door") {
        return {
          ...draft,
          doors: draft.doors.filter((door) => door.id !== selection.id),
          puzzles: (draft.puzzles ?? []).filter((instance) => instance.linkedDoorId !== selection.id),
          routeSwitches: compactRouteSwitches((draft.routeSwitches ?? []).map((route) => ({
            ...route,
            outputs: route.outputs.filter((output) => output.kind !== "open_door" || output.doorId !== selection.id),
          }))),
          wallDoorSwitches: (draft.wallDoorSwitches ?? []).map((wallSwitch) => ({
            ...wallSwitch,
            states: wallSwitch.states.map((state) => ({
              ...state,
              openDoorIds: (state.openDoorIds ?? []).filter((doorId) => doorId !== selection.id),
              closeDoorIds: (state.closeDoorIds ?? []).filter((doorId) => doorId !== selection.id),
            })),
          })),
        };
      }
      if (selection.kind === "prop") {
        const childCount = attachedChildCount(draft, selection.id);
        if (childCount > 0) {
          statusOverride =
            language === "en"
              ? `Furniture removed; ${childCount} attached item${childCount === 1 ? "" : "s"} dropped to the floor. Ctrl+Z to undo.`
              : `已删除家具；${childCount} 个附着小物件落回地面。Ctrl+Z 可撤销。`;
        }
        return reflowAttachedProps({
          ...draft,
          props: draft.props
            .filter((prop) => prop.id !== selection.id)
            .map((prop) => (prop.parentPropId === selection.id ? clearPropStacking(prop, 0) : prop)),
        });
      }
      if (selection.kind === "pickup") return { ...draft, pickups: (draft.pickups ?? []).filter((pickup) => pickup.id !== selection.id) };
      if (selection.kind === "puzzle") {
        const instance = (draft.puzzles ?? []).find((candidate) => candidate.id === selection.id);
        if (!instance) return draft;
        if (selection.componentId) {
          statusOverride = language === "en" ? "Color orb removed. Ctrl+Z to undo." : "已删除色球。Ctrl+Z 可撤销。";
          return {
            ...draft,
            puzzles: (draft.puzzles ?? []).map((candidate) =>
              candidate.id === instance.id
                ? { ...candidate, components: (candidate.components ?? []).filter((component) => component.id !== selection.componentId) }
                : candidate,
            ),
          };
        }
        statusOverride =
          language === "en"
            ? "Puzzle removed; its door is now unlocked. Ctrl+Z to undo."
            : "已删除谜题，它的门恢复为无锁。Ctrl+Z 可撤销。";
        return {
          ...draft,
          puzzles: (draft.puzzles ?? []).filter((candidate) => candidate.id !== instance.id),
          doors: draft.doors.map((door) =>
            door.id === instance.linkedDoorId ? { ...door, lockType: "none" as const, puzzleKind: undefined, puzzleRoomId: undefined } : door,
          ),
          routeSwitches: compactRouteSwitches((draft.routeSwitches ?? []).map((route) => ({
            ...route,
            outputs: route.outputs.filter((output) => output.kind !== "reveal_puzzle" || output.puzzleId !== instance.id),
          }))),
        };
      }
      if (selection.kind === "routeSwitch") {
        return { ...draft, routeSwitches: (draft.routeSwitches ?? []).filter((route) => route.id !== selection.id) };
      }
      if (selection.kind === "wallDoorSwitch") {
        return {
          ...draft,
          wallDoorSwitches: (draft.wallDoorSwitches ?? []).filter((wallSwitch) => wallSwitch.id !== selection.id),
          doors: draft.doors.map((door) =>
            door.wallDoorSwitchId === selection.id
              ? {
                  ...door,
                  ...(door.lockType === "switch_state" ? { lockType: "none" as const } : {}),
                  wallDoorSwitchId: undefined,
                  wallDoorSwitchStateId: undefined,
                }
              : door,
          ),
        };
      }
      return {
        ...draft,
        robots: draft.robots.filter((robot) => robot.id !== selection.id),
        doors: draft.doors.map((door) =>
          clearDoorRobotBindings(
            door,
            draft.robots.filter((robot) => robot.id === selection.id),
            draft.robots.filter((robot) => robot.id !== selection.id),
          ),
        ),
      };
    });
    setSelection(selection.kind === "puzzle" && selection.componentId ? { kind: "puzzle", id: selection.id } : null);
    setStatusText(statusOverride ?? (language === "en" ? "Selection removed. Ctrl+Z to undo." : "已删除所选对象。Ctrl+Z 可撤销。"));
  }, [language, selection, update]);

  const rotateSelection = useCallback(() => {
    if (selection?.kind === "puzzle" && !selection.componentId) {
      update((draft) => ({
        ...draft,
        puzzles: (draft.puzzles ?? []).map((instance) =>
          instance.id === selection.id ? { ...instance, rotationY: instance.rotationY + Math.PI / 4 } : instance,
        ),
      }));
      setStatusText(language === "en" ? "Puzzle station rotated 45° (shortcut R)." : "谜题台已旋转 45°（快捷键 R）。");
      return;
    }
    if (selection?.kind === "routeSwitch") {
      update((draft) => ({
        ...draft,
        routeSwitches: (draft.routeSwitches ?? []).map((route) =>
          route.id === selection.id ? { ...route, rotationY: route.rotationY + Math.PI / 4 } : route,
        ),
      }));
      setStatusText(language === "en" ? "Route switch rotated 45° (shortcut R)." : "路由台已旋转 45°（快捷键 R）。");
      return;
    }
    if (selection?.kind === "room") {
      update((draft) => {
        const room = draft.rooms.find((candidate) => candidate.id === selection.id);
        if (!room) return draft;
        const [cx, cz] = room.center;
        const nextShape = room.shape ? { ...room.shape, rotation: (room.shape.rotation ?? 0) + Math.PI / 2 } : undefined;
        return reflowAttachedProps({
          ...draft,
          rooms: draft.rooms.map((candidate) =>
            candidate.id === room.id
              ? nextShape
                ? { ...candidate, shape: nextShape, size: shapeBboxSize(nextShape) as [number, number] }
                : { ...candidate, size: [candidate.size[1], candidate.size[0]] as [number, number] }
              : candidate,
          ),
          // Carry the room's furniture around with it (90° CW about the center).
          props: draft.props.map((prop) => {
            if (prop.roomId !== room.id) return prop;
            const dx = prop.position[0] - cx;
            const dz = prop.position[1] - cz;
            return { ...prop, position: [cx + dz, cz - dx] as [number, number], rotationY: prop.rotationY + Math.PI / 2 };
          }),
        });
      });
      setStatusText(
        language === "en"
          ? "Room rotated 90°; shaped rooms turn their real footprint, and furniture turns with it (shortcut R)."
          : "房间已旋转 90°：异形房会真正转动轮廓，里面的家具一起转（快捷键 R）。",
      );
      return;
    }
    if (selection?.kind !== "prop") return;
    update((draft) => {
      const parentById = new Map(draft.props.map((prop) => [prop.id, prop]));
        return projectWithAnchoredPuzzleComponentsForProp(reflowAttachedProps({
          ...draft,
          props: draft.props.map((prop) => {
            if (prop.id !== selection.id) return prop;
            const rotationY = prop.rotationY + Math.PI / 4;
            const parent = prop.parentPropId ? parentById.get(prop.parentPropId) : null;
            return { ...prop, rotationY, ...(parent ? { localRotationY: rotationY - parent.rotationY } : {}) };
          }),
        }), selection.id);
    });
    setStatusText(language === "en" ? "Rotated 45° (shortcut R)." : "已旋转 45°（快捷键 R）。");
  }, [language, selection, update]);

  const duplicateSelection = useCallback(() => {
    if (!selection) {
      setStatusText(
        language === "en"
          ? "Select a room, prop or robot first, then duplicate with Cmd/Ctrl+R."
          : "先选中房间、家具或机器人，再用 Cmd/Ctrl+R 复制。",
      );
      return;
    }
    if (selection.kind === "prop") {
      const source = project.props.find((prop) => prop.id === selection.id);
      if (!source) return;
      const copy: BuilderProp = clearPropStacking(
        { ...source, id: createBuilderId("prop"), position: [source.position[0] + 1, source.position[1] + 1] },
        0,
      );
      update((draft) => ({ ...draft, props: [...draft.props, copy] }));
      setSelection({ kind: "prop", id: copy.id });
    } else if (selection.kind === "pickup") {
      const source = (project.pickups ?? []).find((pickup) => pickup.id === selection.id);
      if (!source) return;
      const copy: BuilderPickup = { ...source, id: createBuilderId("pickup"), position: [source.position[0] + 1, source.position[1] + 1] };
      update((draft) => ({ ...draft, pickups: [...(draft.pickups ?? []), copy] }));
      setSelection({ kind: "pickup", id: copy.id });
    } else if (selection.kind === "room") {
      const source = project.rooms.find((room) => room.id === selection.id);
      if (!source) return;
      const copy: BuilderRoom = {
        ...source,
        id: createBuilderId("room"),
        label: nextCopyLabel(source.label, project.rooms.map((room) => room.label)),
        center: [source.center[0] + source.size[0] + 1, source.center[1]],
      };
      update((draft) => ({ ...draft, rooms: [...draft.rooms, copy] }));
      setSelection({ kind: "room", id: copy.id });
    } else if (selection.kind === "robot") {
      const source = project.robots.find((robot) => robot.id === selection.id);
      if (!source) return;
      const copy = {
        ...source,
        id: createBuilderId("robot"),
        label: nextCopyLabel(source.label ?? defaultRobotGroupLabel(source.archetype, source.presetId, project.robots.indexOf(source) + 1), project.robots.map((robot) => robot.label ?? "")),
      };
      update((draft) => ({ ...draft, robots: [...draft.robots, copy] }));
      setSelection({ kind: "robot", id: copy.id });
    } else if (selection.kind === "puzzle") {
      setStatusText(
        language === "en"
          ? "Puzzles can't be duplicated — a door is unlocked by exactly one puzzle; add another from the puzzle catalog."
          : "谜题不支持复制——一扇门只能由一座谜题解锁；从谜题目录再放一座。",
      );
      return;
    } else if (selection.kind === "routeSwitch") {
      setStatusText(
        language === "en"
          ? "Route switches can't be duplicated yet — they bind doors, puzzles and robot rooms; add a new one from the mechanism catalog."
          : "路由台暂不复制——它绑定门、谜题和机器人房间，建议从机关目录新放一座。",
      );
      return;
    } else {
      setStatusText(
        language === "en"
          ? "Door locks can't be duplicated; place a new door or edit the binding on the right."
          : "门锁不支持复制；请重新放门或修改右侧绑定。",
      );
      return;
    }
    setStatusText(language === "en" ? "Selection duplicated (shortcut Cmd/Ctrl+R)." : "已复制所选对象（快捷键 Cmd/Ctrl+R）。");
  }, [language, project, selection, update]);

  const cancelPuzzleHostPick = useCallback(() => {
    setHostPick(null);
    setStatusText(language === "en" ? "Exited furniture picking." : "已退出谜题家具选择。");
  }, [language]);

  const cancelPlacement = useCallback(() => {
    setPlacement(null);
    setBrush(null);
    setPuzzleBind(null);
    setHostPick(null);
    setActiveTool("select");
    setStatusText("");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (saveLibraryOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setSaveLibraryOpen(false);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        history.redo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (event.key === "Escape") {
        if (builderMenuOpenRef.current) setBuilderMenuOpen(false);
        else if (hostPickRef.current) cancelPuzzleHostPick();
        else if (puzzleBindRef.current) {
          setPuzzleBind(null);
          setStatusText(language === "en" ? "Exited puzzle binding." : "已退出谜题绑定。");
        } else if (placement || brush || activeTool !== "select") cancelPlacement();
        else if (selection) setSelection(null);
        else setBuilderMenuOpen(true);
      } else if (event.key === "Delete" || event.key === "Backspace") removeSelection();
      else if (!event.metaKey && !event.ctrlKey && !event.altKey && (event.key === "r" || event.key === "R")) {
        setPlacement((current) => (current?.kind === "prop" ? { ...current, rotationY: current.rotationY + Math.PI / 4 } : current));
        rotateSelection();
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "1") setViewMode("plan");
      else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "2") setViewMode("split");
      else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "3") setViewMode("split");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, brush, cancelPlacement, cancelPuzzleHostPick, duplicateSelection, history, language, placement, removeSelection, rotateSelection, saveLibraryOpen, selection]);

  const resetView = () => {
    setViewport(defaultViewport);
    setCameraResetToken((value) => value + 1);
  };

  const zoomBy = (factor: number) => {
    setViewport((current) => ({ ...current, zoom: Math.min(4, Math.max(0.4, current.zoom * factor)) }));
  };

  const runValidate = () => {
    const validation = validateBuilderProject(project);
    setResult(validation);
    setStatusText(
      validation.ok
        ? language === "en"
          ? "Validation passed — ready to save."
          : "校验通过，可以保存。"
        : language === "en"
          ? "Validation failed — see the issue list at the bottom right."
          : "校验未通过，看右下问题列表。",
    );
  };

  const runSave = (onDone?: (levelId: string | null, saveResult: BuilderSaveResult) => void) => {
    setSaving(true);
    setStatusText(language === "en" ? "Saving config pack…" : "正在保存配置包…");
    window.setTimeout(() => {
      let saveResult: BuilderSaveResult;
      try {
        saveResult = saveBuilderProjectAsPack(project);
      } catch (error) {
        // A pack build can throw (localStorage quota, malformed draft). Recover so
        // the editor never stays stuck on the "saving…" spinner.
        const message = error instanceof Error ? error.message : language === "en" ? "Unknown error while saving." : "保存时发生未知错误。";
        const failed: BuilderSaveResult = { level: null, compileIssues: [], report: null, ok: false, importResult: null, levelId: null };
        setResult(failed);
        setSaving(false);
        setSavedLevelId(null);
        setStatusText(language === "en" ? `Save failed: ${message}` : `保存失败：${message}`);
        onDone?.(null, failed);
        return;
      }
      setResult(saveResult);
      setSaving(false);
      if (saveResult.importResult?.ok && saveResult.levelId) {
        setSavedLevelId(saveResult.levelId);
        setStatusText(
          language === "en"
            ? "Saved as a local level — you can pick it under \"Local Levels\" on the title screen."
            : "已保存为本地关卡，标题界面「本地关卡」里也能选到。",
        );
      } else {
        setSavedLevelId(null);
        setStatusText(language === "en" ? "Save failed — fix the errors in the issue list first." : "保存失败，先解决问题列表里的错误。");
      }
      onDone?.(saveResult.importResult?.ok ? saveResult.levelId : null, saveResult);
    }, 60);
  };

  const openSaveLibrary = () => {
    setSaveSlots(loadBuilderSaveSlots());
    setShowJson(false);
    setSaveLibraryOpen(true);
  };

  const saveToSlot = (slotIndex: number) => {
    const nextSlots = saveBuilderProjectSlot(slotIndex, project);
    setSaveSlots(nextSlots);
    saveBuilderDraft(project);
    setStatusText(language === "en" ? `Saved to local slot ${slotIndex + 1}.` : `已保存到本地存档 ${slotIndex + 1}。`);
  };

  const loadFromSlot = (slotIndex: number) => {
    const slotProject = loadBuilderProjectFromSlot(slotIndex);
    if (!slotProject) {
      setStatusText(language === "en" ? `Local slot ${slotIndex + 1} is empty.` : `本地存档 ${slotIndex + 1} 是空的。`);
      return;
    }
    replaceProject(normalizeBuilderPuzzles(slotProject));
    setSelection(null);
    setHovered(null);
    setPlacement(null);
    setBrush(null);
    setPuzzleBind(null);
    setResult(null);
    setSavedLevelId(null);
    setActiveTool("select");
    setSaveLibraryOpen(false);
    const loadedTitleSource = slotProject.title.trim() || (language === "en" ? "Untitled escape room" : "未命名密室");
    const loadedTitle = language === "en" ? bl(loadedTitleSource, language) : loadedTitleSource;
    setStatusText(language === "en" ? `Loaded local slot ${slotIndex + 1}: ${loadedTitle}.` : `已读取本地存档 ${slotIndex + 1}：${loadedTitle}。`);
  };

  const clearSlot = (slotIndex: number) => {
    const nextSlots = clearBuilderProjectSlot(slotIndex);
    setSaveSlots(nextSlots);
    setStatusText(language === "en" ? `Cleared local slot ${slotIndex + 1}.` : `已清空本地存档 ${slotIndex + 1}。`);
  };

  const requestWebGpuPlaytest = () => {
    setPlaytestRequestToken((value) => value + 1);
    setStatusText(language === "en" ? "Preparing WebGPU deep playtest…" : "正在准备 WebGPU 深度试玩…");
  };

  const copyLevelUrl = (levelId: string) => {
    navigator.clipboard?.writeText(playtestUrl(levelId)).then(
      () => setStatusText(language === "en" ? "Level link copied." : "关卡链接已复制。"),
      () => setStatusText(playtestUrl(levelId)),
    );
  };

  const runExport = () => {
    const json = exportBuilderProjectJson(project);
    if (!json) {
      setStatusText(language === "en" ? "Export failed: the project can't be compiled into a level yet." : "导出失败：项目还没法编译成关卡。");
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${exportFileSlug(project.title)}.hp.config.json`;
    link.click();
    URL.revokeObjectURL(href);
    setStatusText(
      language === "en"
        ? "Exported hp.config.v1 JSON — import it from the game's \"Local Levels\" panel."
        : "已导出 hp.config.v1 JSON，可以在游戏「本地关卡」面板导入。",
    );
  };

  const runRepair = () => {
    const { project: repaired, fixes } = repairProject(project);
    if (fixes.length === 0) {
      setStatusText(language === "en" ? "Quick check found nothing to auto-fix." : "快速检查没有发现可自动修复的问题。");
      return false;
    }
    update(() => repaired);
    setStatusText(language === "en" ? `Auto-fix done: ${fixes.join(" ")}` : `一键修复完成：${fixes.join(" ")}`);
    return true;
  };

  // 点击模板先开确认 modal（替换了原来难看的 window.confirm）；真正载入在 confirmApplyTemplate。
  const applyTemplate = (templateId: string) => {
    if (!builderTemplates.some((entry) => entry.id === templateId)) return;
    setPendingTemplateId(templateId);
  };

  const pendingTemplate = builderTemplates.find((entry) => entry.id === pendingTemplateId) ?? null;
  const pendingTemplateLabel = pendingTemplate ? bl(pendingTemplate.label, language) : "";

  const confirmApplyTemplate = () => {
    setPendingTemplateId(null);
    if (!pendingTemplate) return;
    const templateHint = bl(pendingTemplate.hint, language);
    replaceProject(pendingTemplate.create());
    setSelection(null);
    setHovered(null);
    setResult(null);
    setSavedLevelId(null);
    setStatusText(
      language === "en"
        ? `Template loaded: ${pendingTemplateLabel} — ${templateHint}`
        : `已载入模板：${pendingTemplateLabel} — ${templateHint}`,
    );
  };

  const pickOnboardingProject = (nextProject: BuilderProject, label: string) => {
    replaceProject(normalizeBuilderPuzzles(nextProject));
    setSelection(null);
    setHovered(null);
    setResult(null);
    setSavedLevelId(null);
    setStatusText(language === "en" ? `Starter loaded: ${label}.` : `已载入起点：${label}。`);
  };

  const completeOnboarding = () => {
    markBuilderOnboardingSeen();
    setShowOnboarding(false);
    setSelection(null);
    setHovered(null);
    setResult(null);
    setSavedLevelId(null);
    setStatusText(
      language === "en"
        ? "Quick guide dismissed. Build in 3D, switch to 2D whenever structure matters."
        : "快速教学已收起。先用 3D 找感觉，需要看结构时再切 2D。",
    );
  };

  const addRoom = (style: BuilderRoom["style"]) => {
    const size: readonly [number, number] = [8, 6];
    const center = suggestRoomDropCenter(project.rooms, size[0]);
    const id = createBuilderId("room");
    update((draft) => {
      const room: BuilderRoom = {
        id,
        label: `${roomStyleEntry(style).label} ${draft.rooms.length + 1}`,
        style,
        center,
        size,
      };
      return { ...draft, rooms: [...draft.rooms, room] };
    });
    setSelection({ kind: "room", id });
    requestFocus({ x: center[0], z: center[1], span: Math.max(size[0], size[1]) });
    setStatusText(
      language === "en"
        ? "Room added: dropped in an open spot with the camera aimed. Drag to nudge it; pull the four edge handles to resize."
        : "已添加房间：已放到空位、镜头已对准。拖动可微调，四边手柄拉伸。",
    );
  };

  const addShapeRoom = (presetId: string) => {
    const preset = roomShapePresetById(presetId);
    if (!preset) return;
    const shape = { kind: "polygon" as const, points: preset.points };
    const size = shapeBboxSize(shape);
    const center = suggestRoomDropCenter(project.rooms, size[0]);
    const id = createBuilderId("room");
    update((draft) => {
      const room: BuilderRoom = {
        id,
        label: `${preset.label} ${draft.rooms.length + 1}`,
        style: preset.defaultStyle,
        center,
        size,
        shape,
      };
      return { ...draft, rooms: [...draft.rooms, room] };
    });
    setSelection({ kind: "room", id });
    requestFocus({ x: center[0], z: center[1], span: Math.max(size[0], size[1]) });
    setStatusText(
      language === "en"
        ? "Shaped room added: move its flat wall against a neighbor, then add a door."
        : "已添加异形房间：把平直墙面拖到邻室旁贴合后，即可加门。",
    );
  };

  const stampBuilding = (presetId: string) => {
    const preset = buildingPresetById(presetId);
    if (!preset) return;
    const dropCenter = suggestBuildingDropCenter(project, preset, buildingTurns);
    const stamped = stampBuildingPreset(preset, dropCenter, buildingTurns);
    update((draft) => ({
      ...draft,
      rooms: [...draft.rooms, ...stamped.rooms],
      doors: [...draft.doors, ...stamped.doors],
      props: [...draft.props, ...stamped.props],
    }));
    const firstRoom = stamped.rooms[0];
    if (firstRoom) setSelection({ kind: "room", id: firstRoom.id });
    requestFocus({ x: dropCenter[0], z: dropCenter[1], span: 18 });
    setActiveTool("select");
    const presetLabel = bl(preset.label, language);
    if (language === "en") {
      const turnText = buildingTurns % 4 === 0 ? "" : ` (rotated ${(buildingTurns % 4) * 90}°)`;
      setStatusText(
        `Placed "${presetLabel}"${turnText}: ${stamped.rooms.length} rooms wired with doors. Drag the whole block against other rooms to connect.`,
      );
    } else {
      const turnText = buildingTurns % 4 === 0 ? "" : `（已旋转 ${(buildingTurns % 4) * 90}°）`;
      setStatusText(`已放置「${presetLabel}」${turnText}：${stamped.rooms.length} 间房已连好门，拖动整体贴到其它房间即可连通。`);
    }
  };

  const addDoor = (lockType: BuilderLockType = "none"): boolean => {
    const placement = findAutoDoorPlacement(project, selection?.kind === "room" ? selection.id : undefined);
    if (placement) {
      const a = placement.project.rooms.find((room) => room.id === placement.fromRoomId);
      const b = placement.project.rooms.find((room) => room.id === placement.toRoomId);
      if (!a || !b) return false;
      const door: BuilderDoor = {
        id: createBuilderId("door"),
        label: builderDoorEndpointLabel({ fromRoomId: a.id, toRoomId: b.id }, placement.project),
        fromRoomId: a.id,
        toRoomId: b.id,
        lockType,
        ...(lockType === "key_item" ? { keyRoomId: placement.project.rooms[0]?.id } : {}),
      };
      const doorEdge = sharedEdge(a, b);
      let wallSwitch: BuilderWallDoorSwitch | null = null;
      if (lockType === "switch_state") {
        if (!doorEdge) {
          setStatusText(
            language === "en"
              ? "The rooms need a valid shared wall before a wall switch door can be created."
              : "墙面门控门需要两间房有有效共享墙；先把房间贴齐。",
          );
          return false;
        }
        wallSwitch = createDedicatedWallDoorSwitch(door, a, doorEdge);
      }
      update((draft) => {
        const next: BuilderProject = { ...draft, rooms: placement.project.rooms, doors: [...draft.doors, door] };
        return wallSwitch ? applyToggleDoorOwnership({ ...next, wallDoorSwitches: [...(draft.wallDoorSwitches ?? []), wallSwitch] }, wallSwitch.id, door.id) : next;
      });
      setSelection(wallSwitch ? { kind: "wallDoorSwitch", id: wallSwitch.id } : { kind: "door", id: door.id });
      const lockLabel = bl(builderLockLabels[lockType], language);
      setStatusText(
        language === "en"
          ? placement.aligned
            ? wallSwitch
              ? `Auto-aligned "${b.label}" to "${a.label}", placed a ${lockLabel}, and created its dedicated wall switch.`
              : `Auto-aligned "${b.label}" to "${a.label}" and placed a ${lockLabel}; edit the binding on the right.`
            : wallSwitch
              ? `Placed a ${lockLabel} between "${a.label}" and "${b.label}" with a dedicated wall switch.`
              : `Placed a ${lockLabel} between "${a.label}" and "${b.label}"; edit the binding on the right.`
          : placement.aligned
            ? wallSwitch
              ? `已自动贴合「${b.label}」到「${a.label}」，并放置${lockLabel}和专属墙面门控把手。`
              : `已自动贴合「${b.label}」到「${a.label}」，并放置${lockLabel}；右侧可改绑定。`
            : wallSwitch
              ? `已在「${a.label}」和「${b.label}」之间放${lockLabel}，并新建专属墙面门控把手。`
              : `已在「${a.label}」和「${b.label}」之间放${lockLabel}，右侧可改绑定。`,
      );
      return true;
    }
    setStatusText(
      language === "en"
        ? "No room pair can accept a door yet: add another room or move furniture/rooms so auto-align has space."
        : "暂时没有能放门的房间对：先添加房间，或挪开阻挡让自动贴边有空间。",
    );
    return false;
  };

  const addWallDoorSwitch = () => {
    const selectedDoor = selection?.kind === "door" ? project.doors.find((door) => door.id === selection.id) : null;
    if (!selectedDoor) {
      setStatusText(
        project.doors.length === 0
          ? language === "en"
            ? "Add a door first, then select it and place a wall door switch."
            : "先添加一扇门，再选中它放墙面门控把手。"
          : language === "en"
            ? "Select the door you want to lock, then place a wall door switch."
            : "先选中要上锁的门，再点墙面门控把手。",
      );
      return;
    }
    const targetDoor = selectedDoor;
    const doorFromRoom = project.rooms.find((room) => room.id === targetDoor.fromRoomId);
    const doorToRoom = project.rooms.find((room) => room.id === targetDoor.toRoomId);
    const room = doorFromRoom ?? project.rooms[0];
    const doorEdge = doorFromRoom && doorToRoom ? sharedEdge(doorFromRoom, doorToRoom) : null;
    if (!room || !doorFromRoom || !doorToRoom || !doorEdge) {
      setStatusText(
        language === "en"
          ? "This door is not on a valid shared wall yet. Move the rooms together, then add the wall switch."
          : "这扇门两侧房间还没有有效贴边。先把房间贴齐，再加墙面门控。",
      );
      return;
    }
    const wallSwitch = createDedicatedWallDoorSwitch(targetDoor, room, doorEdge);
    update((draft) => applyToggleDoorOwnership({ ...draft, wallDoorSwitches: [...(draft.wallDoorSwitches ?? []), wallSwitch] }, wallSwitch.id, targetDoor.id));
    setSelection({ kind: "wallDoorSwitch", id: wallSwitch.id });
    setCatalogTab("mechanisms");
    setActiveTool("mechanisms");
    setStatusText(
      language === "en"
        ? "Door locked with a new dedicated wall switch. The movable switch was placed beside the door; drag it along the wall if needed."
        : "这扇门已绑定一个新的专属墙面门控把手，旧把手不会再控制它；需要时可沿墙拖动。",
    );
  };

  /** Binds a puzzle of `kind` to a door: re-locks the door + creates/replaces its instance. */
  const bindPuzzleToDoor = (doorId: string, kind: BuilderPuzzleKind) => {
    const door = project.doors.find((candidate) => candidate.id === doorId);
    if (!door) return;
    const fromRoom = project.rooms.find((room) => room.id === door.fromRoomId);
    const toRoom = project.rooms.find((room) => room.id === door.toRoomId);
    if (!fromRoom || !toRoom || !sharedEdge(fromRoom, toRoom)) {
      setStatusText(
        language === "en"
          ? "The rooms on either side of this door aren't touching — align their edges first, then bind a puzzle."
          : "这扇门两端的房间没有贴边——先把房间边缘贴齐，再绑谜题。",
      );
      return;
    }
    if (kind === "color_sequence" && puzzleInstances(project).some((instance) => instance.kind === "color_sequence" && instance.linkedDoorId !== doorId)) {
      setPuzzleBind(null);
      setStatusText(
        language === "en"
          ? "Only one color-sequence lock is allowed — edit the existing one's colors on the right, or use a calibration / filing / coolant puzzle instead."
          : "颜色顺序锁只能有一座——已有的可以在右侧改颜色，或换用校准 / 归档 / 闸门谜题。",
      );
      return;
    }
    const existing = puzzleForDoor(project, doorId);
    const instance = existing
      ? { ...createPuzzleInstanceForDoor(project, door, kind, { roomId: existing.roomId, position: existing.position, wallMount: existing.wallMount }), id: existing.id }
      : createPuzzleInstanceForDoor(project, door, kind);
    update((draft) => ({
      ...draft,
      doors: draft.doors.map((candidate) =>
        candidate.id === doorId
          ? { ...candidate, lockType: "puzzle_complete" as const, puzzleKind: kind === "color_sequence" ? undefined : kind, puzzleRoomId: undefined }
          : candidate,
      ),
      puzzles: existing
        ? (draft.puzzles ?? []).map((candidate) => (candidate.id === existing.id ? instance : candidate))
        : [...(draft.puzzles ?? []), instance],
    }));
    setPuzzleBind(null);
    setSelection({ kind: "puzzle", id: instance.id });
    const entry = puzzleKindEntry(kind);
    const entryLabel = bl(entry.label, language);
    setStatusText(
      kind === "color_sequence"
        ? language === "en"
          ? `"${entryLabel}" is bound to this door: drag the pattern station and color orbs into place (orbs can sit in different rooms).`
          : `「${entryLabel}」已绑定这扇门：拖动图案台和色球摆到想要的位置（色球可以放进不同房间）。`
        : language === "en"
          ? `"${entryLabel}" is bound to this door: drag the puzzle station into place (drag works in both 2D and 3D).`
          : `「${entryLabel}」已绑定这扇门：拖动谜题台摆到想要的位置（2D / 3D 都能拖）。`,
    );
  };

  /** 谜题目录卡片 → 引导式绑定：选中门直接绑，否则进入选门模式。 */
  const addPuzzle = (kind: BuilderPuzzleKind) => {
    if (kind === "color_sequence" && puzzleInstances(project).some((instance) => instance.kind === "color_sequence")) {
      setStatusText(
        language === "en"
          ? "Only one color-sequence lock is allowed — select it to change the color order, or use a calibration / filing / coolant puzzle instead."
          : "颜色顺序锁只能有一座——选中它可以改颜色顺序，或换用校准 / 归档 / 闸门谜题。",
      );
      return;
    }
    if (selection?.kind === "door") {
      bindPuzzleToDoor(selection.id, kind);
      return;
    }
    const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
    const bindable = project.doors.some((door) => {
      const fromRoom = roomsById.get(door.fromRoomId);
      const toRoom = roomsById.get(door.toRoomId);
      return Boolean(fromRoom && toRoom && sharedEdge(fromRoom, toRoom));
    });
    if (!bindable) {
      setStatusText(
        language === "en"
          ? "Place a door between adjacent rooms first — switch to the \"Door Lock\" tool, touch two rooms' edges, drop a door, then come back to bind a puzzle."
          : "先在相邻房间放一扇门——切到「门锁」工具，把两间房贴边后放一扇门，再回来绑谜题。",
      );
      return;
    }
    setPlacement(null);
    setBrush(null);
    setPuzzleBind(kind);
    setStatusText(language === "en" ? "Pick a door to be the puzzle lock · Esc to cancel" : "选择一扇门作为谜题锁 · Esc 取消");
  };

  const startPuzzleHostPick = useCallback(
    (request: BuilderPuzzleHostPick) => {
      if (request.kind === "routeSwitch") {
        const routeSwitch = (project.routeSwitches ?? []).find((candidate) => candidate.id === request.routeSwitchId);
        if (!routeSwitch) {
          setStatusText(language === "en" ? "This route switch no longer exists." : "这座路由台已经不存在。");
          return;
        }
        setPlacement(null);
        setBrush(null);
        setPuzzleBind(null);
        setHostPick(request);
        setSelection({ kind: "routeSwitch", id: request.routeSwitchId });
        setStatusText(language === "en" ? "Pick a furniture prop to host this route switch · Esc to cancel" : "选择一个家具 / 展柜 / 面板作为这座路由台的交互点 · Esc 取消");
        return;
      }
      const puzzle = puzzleInstances(project).find((candidate) => candidate.id === request.puzzleId);
      if (!puzzle) {
        setStatusText(language === "en" ? "This puzzle no longer exists." : "这座谜题已经不存在。");
        return;
      }
      setPlacement(null);
      setBrush(null);
      setPuzzleBind(null);
      setHostPick(request);
      setSelection(request.kind === "component" ? { kind: "puzzle", id: request.puzzleId, componentId: request.componentId } : { kind: "puzzle", id: request.puzzleId });
      setStatusText(
        request.kind === "component"
          ? language === "en"
            ? "Pick a furniture prop to host this orb target · Esc to cancel"
            : "选择一个家具 / 展柜 / 基座来承载这个色球 · Esc 取消"
          : language === "en"
            ? "Pick a furniture prop to host this puzzle interaction · Esc to cancel"
            : "选择一个家具 / 展柜 / 面板作为这座谜题的交互点 · Esc 取消",
      );
    },
    [language, project],
  );

  const applyPuzzleHostPick = useCallback(
    (propId: string) => {
      const request = hostPickRef.current;
      const prop = project.props.find((candidate) => candidate.id === propId);
      if (!request || !prop) {
        setStatusText(language === "en" ? "Pick a valid furniture prop." : "请选择有效的家具 / 展柜 / 面板。");
        return;
      }
      if (request.kind === "routeSwitch") {
        update((draft) => ({
          ...draft,
          routeSwitches: (draft.routeSwitches ?? []).map((route) =>
            route.id === request.routeSwitchId
              ? {
                  ...route,
                  hostPropId: prop.id,
                  roomId: prop.roomId,
                  position: prop.position,
                  rotationY: prop.rotationY,
                  wallMount: undefined,
                  outputs: route.outputs.map((output) => ({ ...output, keyRoomId: undefined, keyPosition: undefined })),
                }
              : route,
          ),
        }));
        setHostPick(null);
        setSelection({ kind: "routeSwitch", id: request.routeSwitchId });
        setStatusText(language === "en" ? "Route switch interaction is now hosted by the selected prop. Ctrl+Z to undo." : "路由台交互点已换到选中的家具上。Ctrl+Z 可撤销。");
        return;
      }
      const selectedPuzzle = project.puzzles?.find((instance) => instance.id === request.puzzleId);
      if (request.kind === "interaction" && selectedPuzzle?.kind === "valve_matrix") {
        setHostPick(null);
        setStatusText(language === "en" ? "Gate balance uses its own large console and cannot attach to furniture." : "闸门配平台使用独立的大屏终端，不能再承载到家具上。");
        return;
      }
      update((draft) => ({
        ...draft,
        puzzles: (draft.puzzles ?? []).map((instance) => {
          if (instance.id !== request.puzzleId) return instance;
          if (request.kind === "interaction") {
            return {
              ...instance,
              roomId: prop.roomId,
              position: prop.position,
              rotationY: prop.rotationY,
              wallMount: undefined,
              sourceInteraction: {
                ...(instance.sourceInteraction ?? {}),
                hostPropId: prop.id,
              },
            };
          }
          return {
            ...instance,
            components: (instance.components ?? []).map((component) => {
              if (component.id !== request.componentId) return component;
              const y = component.sourceActor?.position?.[1] ?? component.sourceTarget?.y ?? 1.15;
              return {
                ...component,
                roomId: prop.roomId,
                position: prop.position,
                sourceActor: {
                  ...(component.sourceActor ?? {}),
                  roomId: prop.roomId,
                  position: [prop.position[0], y, prop.position[1]],
                  anchorPropId: prop.id,
                },
                sourceTarget: {
                  ...(component.sourceTarget ?? {}),
                  anchorPropId: prop.id,
                },
              };
            }),
          };
        }),
      }));
      setHostPick(null);
      setSelection(request.kind === "component" ? { kind: "puzzle", id: request.puzzleId, componentId: request.componentId } : { kind: "puzzle", id: request.puzzleId });
      setStatusText(
        request.kind === "component"
          ? language === "en"
            ? "Orb target is now hosted by the selected prop. Ctrl+Z to undo."
            : "色球交互点已换到选中的家具上。Ctrl+Z 可撤销。"
          : language === "en"
            ? "Puzzle interaction is now hosted by the selected prop. Ctrl+Z to undo."
            : "谜题交互点已换到选中的家具上。Ctrl+Z 可撤销。",
      );
    },
    [language, project.props, update],
  );

  /** Stage clicks while binding: doors bind, everything else gets a short hint. */
  const handleStageSelect = useCallback(
    (next: BuilderSelection) => {
      if (hostPickRef.current) {
        if (next?.kind === "prop") applyPuzzleHostPick(next.id);
        else setStatusText(language === "en" ? "Furniture picking: click a highlighted prop · Esc to cancel" : "家具选择模式：请点击高亮的家具 / 展柜 / 面板 · Esc 取消");
        return;
      }
      const kind = puzzleBindRef.current;
      if (kind) {
        if (next?.kind === "door") {
          bindPuzzleToDoor(next.id, kind);
        } else {
          setStatusText(language === "en" ? "Binding mode: click a glowing door · Esc to cancel" : "绑定模式：请点击一扇发光的门 · Esc 取消");
        }
        return;
      }
      setSelection(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyPuzzleHostPick, language, project],
  );

  const requestFocus = useCallback((request: Omit<BuilderFocusRequest, "token">) => {
    focusTokenRef.current += 1;
    setFocusRequest({ ...request, token: focusTokenRef.current });
  }, []);

  const handleStageHover = useCallback((next: BuilderSelection) => {
    setHovered((current) => (sameBuilderSelection(current, next) ? current : next));
  }, []);

  // Stable so the memoized inspector isn't re-rendered by every hover.
  const toggleSnap = useCallback(() => setSnapOn((value) => !value), []);
  const selectionContext = useMemo<BuilderSelectionContextValue>(
    () => ({
      selection,
      hovered,
      setSelection: handleStageSelect,
      setHovered: handleStageHover,
      focusRequest,
      requestFocus,
      overlayEnabled,
      setOverlayEnabled,
    }),
    [selection, hovered, handleStageSelect, handleStageHover, focusRequest, requestFocus, overlayEnabled, setOverlayEnabled],
  );

  const firstKeyDoorForPickup = useCallback((pickups: readonly BuilderPickup[] = []) => {
    const used = new Set(pickups.filter((pickup) => pickup.kind === "key_item").map((pickup) => pickup.linkedDoorId).filter(Boolean));
    return (
      project.doors.find((door) => door.lockType === "key_item" && !used.has(door.id)) ??
      project.doors.find((door) => door.lockType === "key_item") ??
      null
    );
  }, [project.doors]);

  // Stable so the memoized asset cards (PropCard) aren't invalidated each render.
  const beginPlacement = useCallback((draft: PlacementDraft) => {
    setPlacement(draft);
    setBrush(null);
    if (draft.kind !== "wallDoorSwitch") setSelection(null);
    setActiveTool(draft.kind === "prop" ? "props" : draft.kind === "pickup" ? "pickups" : draft.kind === "routeSwitch" || draft.kind === "wallDoorSwitch" ? "mechanisms" : "robots");
    setRecent((current) => {
      const next = [draft, ...current.filter((entry) => placementDraftKey(entry) !== placementDraftKey(draft))].slice(0, 8);
      writeStoredRecentPlacements(next);
      return next;
    });
    setStatusText(
      draft.kind === "prop"
        ? language === "en"
          ? "Placement mode: click a room floor to drop it · R to rotate · Esc to cancel"
          : "放置模式：点击房间地面放下 · R 旋转 · Esc 取消"
        : draft.kind === "pickup"
          ? language === "en"
            ? "Pickup placement: click a room floor to drop it · Esc to cancel"
            : "拾取放置：点击房间地面放下 · Esc 取消"
          : draft.kind === "routeSwitch"
            ? language === "en"
              ? "Route switch placement: click a room floor to drop it · Esc to cancel"
              : "路由台放置模式：点击房间地面放下 · Esc 取消"
            : draft.kind === "wallDoorSwitch"
              ? language === "en"
                ? "Wall switch placement: click near a wall to mount it · Esc to cancel"
                : "墙控把手放置：点击墙边挂上去 · Esc 取消"
            : language === "en"
              ? "Placement mode: click a room floor to deploy a robot · Esc to cancel"
              : "放置模式：点击房间地面部署机器人 · Esc 取消",
    );
  }, [language]);

  const addPickup = (kind: BuilderPickupKind) => {
    if (kind === "key_item" && !project.doors.some((door) => door.lockType === "key_item")) {
      setStatusText(
        language === "en"
          ? "Place a key door first, then drop a release key; the key will bind to that door."
          : "先放一扇钥匙门，再放解除钥；钥匙会绑定那扇门。",
      );
    }
    beginPlacement({ kind: "pickup", pickupKind: kind });
  };

  const beginBrush = (next: BuilderBrush) => {
    setBrush(next);
    setPlacement(null);
    if (next.kind === "floor") {
      lastFloorPresetRef.current = next.presetId;
      setActiveTool("floorBrush");
      const floorLabel = bl(surfacePreset(next.presetId, builderFloorPresets[0]).label, language);
      setStatusText(
        language === "en"
          ? `Floor brush: click a room to apply "${floorLabel}" · Shift for continuous paint · Esc to exit`
          : `地板刷：点击房间应用「${floorLabel}」 · Shift 连续涂刷 · Esc 退出`,
      );
    } else if (next.kind === "wall") {
      lastWallPresetRef.current = next.presetId;
      setActiveTool("wallBrush");
      const wallLabel = bl(surfacePreset(next.presetId, builderWallPresets[0]).label, language);
      setStatusText(
        language === "en"
          ? `Wall brush: click a room to apply "${wallLabel}" · Shift for continuous paint · Esc to exit`
          : `墙壁刷：点击房间应用「${wallLabel}」 · Shift 连续涂刷 · Esc 退出`,
      );
    } else {
      lastCeilingPresetRef.current = next.presetId;
      setActiveTool("ceiling");
      const ceilingLabel = bl(surfacePreset(next.presetId, builderCeilingPresets[0]).label, language);
      setStatusText(
        language === "en"
          ? `Ceiling brush: click a room to apply "${ceilingLabel}" · Shift keeps painting whole rooms · Esc to exit`
          : `天花板刷：点击房间应用「${ceilingLabel}」 · Shift 连续统一整房间 · Esc 退出`,
      );
    }
  };

  const applyBrush = useCallback(
    (roomId: string, shift: boolean) => {
      if (!brush) return;
      let application: BrushApplication | null = null;
      update((draft) => {
        application = applyBrushToRooms(draft, brush, roomId);
        return application ? { ...draft, rooms: application.rooms } : draft;
      });
      if (!application) return;
      const { status, flashColor } = application as BrushApplication;
      setSelection({ kind: "room", id: roomId });
      if (paintFlashTimer.current !== null) window.clearTimeout(paintFlashTimer.current);
      setPaintFlash({ roomId, token: Date.now(), color: flashColor });
      paintFlashTimer.current = window.setTimeout(() => setPaintFlash(null), 750);
      const keepBrush = shift || continuousPaint;
      if (keepBrush) {
        setStatusText(language === "en" ? `${status} · keep clicking other rooms, Esc to exit` : `${status} · 继续点击其它房间，Esc 退出`);
      } else {
        setBrush(null);
        setActiveTool("select");
        setStatusText(
          language === "en"
            ? `${status} · fine-tune under "Floor / Wall / Ceiling" on the right`
            : `${status} · 右侧「地板 / 墙壁 / 天花板」可微调`,
        );
      }
    },
    [brush, continuousPaint, language, update],
  );

  const placeAt = useCallback(
    (x: number, z: number, roomId: string) => {
      if (!placement) return;
      if (placement.kind === "prop") {
        const entry = propEntry(placement.modelKey);
        const room = project.rooms.find((candidate) => candidate.id === roomId);
        const wallPlacement = entry?.mount === "wall" && room
          ? wallMountedPropPlacementForEntryFromPoint(room, x, z, {
              sizeMeters: entry.sizeMeters,
              wallMountFace: entry.wallMountFace,
            })
          : null;
        const propX = wallPlacement?.plan[0] ?? x;
        const propZ = wallPlacement?.plan[1] ?? z;
        const baseProp: BuilderProp = {
          id: createBuilderId("prop"),
          modelKey: placement.modelKey,
          roomId,
          position: [propX, propZ],
          rotationY: wallPlacement?.yaw ?? placement.rotationY,
          scale: 1,
          ...(wallPlacement ? { elevation: wallPlacement.position[1] } : {}),
          ...(entry?.defaultStory ? { story: { ...entry.defaultStory } } : {}),
        };
        const resolved = resolvePropStacking(project, baseProp, propX, propZ, roomId);
        if (!resolved.valid) {
          setStatusText(propPlacementIssueText(resolved, language));
          return;
        }
        const prop = propWithStacking(baseProp, resolved);
        update((draft) => ({ ...draft, props: [...draft.props, prop] }));
        setSelection({ kind: "prop", id: prop.id });
        if (resolved.hit) {
          setStatusText(
            language === "en"
              ? `Placed on ${resolved.hit.parentLabel}. Move the parent and it will carry this item.`
              : `已放到「${resolved.hit.parentLabel}」上。移动父家具时小物件会跟随。`,
          );
        }
      } else if (placement.kind === "pickup") {
        const linkedDoor = placement.pickupKind === "key_item" ? firstKeyDoorForPickup(project.pickups ?? []) : null;
        const pickup: BuilderPickup = {
          id: createBuilderId("pickup"),
          kind: placement.pickupKind,
          roomId,
          position: [x, z],
          ...(linkedDoor ? { linkedDoorId: linkedDoor.id } : {}),
        };
        update((draft) => ({ ...draft, pickups: [...(draft.pickups ?? []), pickup] }));
        setSelection({ kind: "pickup", id: pickup.id });
      } else if (placement.kind === "routeSwitch") {
        const room = project.rooms.find((candidate) => candidate.id === roomId);
        const route: BuilderRouteSwitch = {
          id: createBuilderId("route"),
          label: "管制路由台",
          roomId,
          keyRoomId: roomId,
          position: [x, z],
          rotationY: 0,
          outputs: [defaultRouteSwitchOutput(project)],
        };
        update((draft) => ({ ...draft, routeSwitches: [...(draft.routeSwitches ?? []), route] }));
        setSelection({ kind: "routeSwitch", id: route.id });
        setStatusText(
          language === "en"
            ? `Route switch placed${room ? ` in ${bl(room.label, language)}` : ""}. Drag each numbered orb and bind outputs to doors, puzzle stations or robot rooms.`
            : `管制路由台已放下${room ? `：${bl(room.label, language)}` : ""}。拖动每个编号授权球，并绑定门、谜题台或机器人房间。`,
        );
      } else if (placement.kind === "wallDoorSwitch") {
        const room = project.rooms.find((candidate) => candidate.id === roomId);
        const wallPlacement = room ? wallDoorSwitchDraftPlacementFromPoint(room, x, z) : null;
        if (!room || !wallPlacement) {
          setStatusText(language === "en" ? "Wall switches must be placed on a wall. Move the cursor to a room edge." : "墙控把手必须挂在墙上。请把光标移到房间墙边。");
          return;
        }
        const selectedDoor = selection?.kind === "door" ? project.doors.find((door) => door.id === selection.id) ?? null : null;
        const wallSwitch: BuilderWallDoorSwitch = {
          id: createBuilderId("wall_switch"),
          label: "墙面门控把手",
          roomId,
          wallMount: wallPlacement.wallMount,
          mode: "state_cycle",
          initialStateId: "idle",
          oneShot: false,
          states: [
            { id: "idle", label: "待机", openDoorIds: [], closeDoorIds: [], message: "门控待机。" },
            { id: "armed", label: "触发", openDoorIds: [], closeDoorIds: [], message: "门控触发。" },
          ],
        };
        update((draft) => {
          const next: BuilderProject = { ...draft, wallDoorSwitches: [...(draft.wallDoorSwitches ?? []), wallSwitch] };
          return selectedDoor ? applyToggleDoorOwnership(next, wallSwitch.id, selectedDoor.id) : next;
        });
        setSelection({ kind: "wallDoorSwitch", id: wallSwitch.id });
        setStatusText(
          selectedDoor
            ? language === "en"
              ? "Wall switch mounted and bound to the selected door. Drag it along any wall if needed."
              : "墙控把手已挂墙并绑定到选中的门。需要时可继续沿墙拖动。"
            : language === "en"
              ? "Wall switch mounted. Pick doors/states in the right panel before playtesting."
              : "墙控把手已挂墙。试玩前请在右侧给它绑定门和状态。",
        );
      } else {
        const robot = {
          id: createBuilderId("robot"),
          label: defaultRobotGroupLabel(placement.archetype, placement.presetId, project.robots.length + 1),
          roomId,
          archetype: placement.archetype,
          count: 2,
          position: [x, z] as const,
          ...(placement.presetId ? builderRobotPresetDefaults(placement.presetId) : {}),
        };
        update((draft) => ({ ...draft, robots: [...draft.robots, robot] }));
        setSelection({ kind: "robot", id: robot.id });
      }
      // Soundless visual tick confirming the drop.
      if (placeFlashTimer.current !== null) window.clearTimeout(placeFlashTimer.current);
      setPlaceFlash({ x, z, token: Date.now(), color: placement.kind === "prop" ? "#5ee8c8" : placement.kind === "pickup" ? pickupEntry(placement.pickupKind).color : placement.kind === "routeSwitch" ? "#5ee8c8" : placement.kind === "wallDoorSwitch" ? "#7bb7ff" : "#ff9d7a" });
      placeFlashTimer.current = window.setTimeout(() => setPlaceFlash(null), 700);
      setPlacement(null);
      setActiveTool("select");
      if (placement.kind !== "routeSwitch" && placement.kind !== "wallDoorSwitch") {
        setStatusText(language === "en" ? "Placed. Cmd/Ctrl+R to duplicate / drag to reposition." : "已放置。Cmd/Ctrl+R 复制 / 拖动调整位置。");
      }
    },
    [firstKeyDoorForPickup, language, placement, project, selection, update],
  );

  /** 密室导演 chip → route the player to the matching tool/tab. */
  const guideToGoal = (goal: BuilderDirectorGoal) => {
    if (goal.done) {
      setStatusText(`✓ ${goal.hint}`);
      return;
    }
    switch (goal.id) {
      case "playable":
        runValidate();
        break;
      case "exit":
        setCatalogTab("rooms");
        setActiveTool("rooms");
        break;
      case "key":
        setCatalogTab("doors");
        setActiveTool("doors");
        break;
      case "puzzle":
        setCatalogTab("puzzles");
        setActiveTool("puzzles");
        break;
      case "combat":
        setCatalogTab("robots");
        setActiveTool("robots");
        break;
    }
    setStatusText(goal.hint);
  };

  const handleTool = (tool: BuilderToolId) => {
    setActiveTool(tool);
    if (tool === "select") {
      setPlacement(null);
      setBrush(null);
      setStatusText("");
      return;
    }
    if (tool === "pan") {
      setPlacement(null);
      setBrush(null);
      setStatusText(
        language === "en"
          ? "Pan mode: drag the canvas / WASD / arrow keys, hold Shift to speed up."
          : "平移模式：拖动画布 / WASD / ↑↓←→，Shift 加速。",
      );
      return;
    }
    if (tool === "floorBrush") {
      setCatalogTab("env");
      beginBrush({ kind: "floor", presetId: lastFloorPresetRef.current });
      return;
    }
    if (tool === "wallBrush") {
      setCatalogTab("env");
      beginBrush({ kind: "wall", presetId: lastWallPresetRef.current });
      return;
    }
    if (tool === "ceiling") {
      setCatalogTab("env");
      beginBrush({ kind: "ceiling", presetId: lastCeilingPresetRef.current });
      return;
    }
    if (tool === "light") {
      setPlacement(null);
      setBrush(null);
      setSelection(null);
      setStatusText(
        language === "en"
          ? "Lighting: adjust ambient / key / fog / bloom / shadows in the \"Lighting\" panel on the right."
          : "光线设置：在右侧「光线」面板调整环境光 / 主光 / 雾 / 泛光 / 阴影。",
      );
      return;
    }
    setCatalogTab(tool);
    setBrush(null);
    if (
      placement &&
      ((tool === "props" && placement.kind !== "prop") ||
        (tool === "pickups" && placement.kind !== "pickup") ||
        (tool === "robots" && placement.kind !== "robot") ||
        (tool === "mechanisms" && placement.kind !== "routeSwitch" && placement.kind !== "wallDoorSwitch"))
    ) {
      setPlacement(null);
    }
    if (tool === "rooms")
      setStatusText(
        language === "en"
          ? "Room tool: add from the left catalog; once a room is selected, drag the arrow/edge handles in 3D to move and resize it."
          : "房间工具：从左侧目录添加；选中房间后可在 3D 拖动箭头/边把手移动与拉伸。",
      );
    else if (tool === "doors")
      setStatusText(
        language === "en"
          ? "Door-lock tool: pick a lock type from the left catalog; it's auto-placed between touching rooms."
          : "门锁工具：从左侧目录选择锁类型，自动放在贴边房间之间。",
      );
    else if (tool === "props") setStatusText(language === "en" ? "Furniture tool: click an asset on the left to enter placement mode." : "家具工具：点选左侧资产进入放置模式。");
    else if (tool === "pickups")
      setStatusText(
        language === "en"
          ? "Pickup tool: place release keys, medkits and energy cells; keys bind to key doors."
          : "拾取工具：放置解除钥、治疗包、能量块；钥匙会绑定钥匙门。",
      );
    else if (tool === "puzzles")
      setStatusText(
        language === "en"
          ? "Puzzle tool: pick a puzzle kind on the left — each puzzle brings one door it unlocks."
          : "谜题工具：从左侧选谜题类型——每座谜题都带一扇它解锁的门。",
      );
    else if (tool === "mechanisms")
      setStatusText(
        language === "en"
          ? "Mechanism tool: place route stations or wall door switches to control doors, puzzles or robot rooms."
          : "机关工具：放置路由台或墙面门控，用来控制门、谜题或机器人房间。",
      );
    else setStatusText(language === "en" ? "Robot tool: click a unit on the left to enter deploy mode." : "机器人工具：点选左侧单位进入部署模式。");
  };

  const renderCanvas2D = (variant: "editor" | "navigator") => (
    <BuilderCanvas2D
      project={project}
      selection={selection}
      viewport={viewport}
      criticalRoomIds={criticalPath.roomIds}
      criticalDoorIds={criticalPath.doorIds}
      placement={variant === "navigator" ? null : placement}
      brush={variant === "navigator" ? null : brush}
      paintFlash={paintFlash}
      snapStep={snapStep}
      bindDoorMode={puzzleBind !== null}
      hostPick={hostPick}
      variant={variant}
      roomSelectionEnabled={activeTool === "rooms"}
      onPlace={placeAt}
      onBrush={applyBrush}
      onPickPuzzleHost={applyPuzzleHostPick}
      onSelect={handleStageSelect}
      onHover={handleStageHover}
      onViewportChange={setViewport}
      update={update}
      onGestureStart={history.mark}
    />
  );
  const inspectorToggleLabel = inspectorCollapsed
    ? language === "en"
      ? "Expand properties panel"
      : "展开属性面板"
    : language === "en"
      ? "Collapse properties panel"
      : "收起属性面板";
  const canRotateSelection = selection?.kind === "prop" || selection?.kind === "routeSwitch" || selection?.kind === "room";
  const canDuplicateSelection = selection?.kind === "prop" || selection?.kind === "pickup" || selection?.kind === "room" || selection?.kind === "robot";
  const editActions = (
    <div className="builder-edit-actions" aria-label={language === "en" ? "Edit actions" : "编辑动作"}>
      <button type="button" disabled={!history.canUndo} onClick={history.undo} title={language === "en" ? "Undo (Ctrl+Z)" : "撤销 (Ctrl+Z)"}>
        ↶
      </button>
      <button type="button" disabled={!history.canRedo} onClick={history.redo} title={language === "en" ? "Redo (Ctrl+Shift+Z)" : "重做 (Ctrl+Shift+Z)"}>
        ↷
      </button>
      <button type="button" disabled={!canRotateSelection} onClick={rotateSelection} title={language === "en" ? "Rotate selection (R)" : "旋转所选 (R)"}>
        ⟳
      </button>
      <button type="button" disabled={!canDuplicateSelection} onClick={duplicateSelection} title={language === "en" ? "Duplicate selection (Cmd/Ctrl+R)" : "复制所选 (Cmd/Ctrl+R)"}>
        ⧉
      </button>
      <button type="button" disabled={!selection} onClick={removeSelection} className="builder-danger" title={language === "en" ? "Delete selection (Delete)" : "删除所选 (Delete)"}>
        ✕
      </button>
    </div>
  );
  const inspectorMiniGlyph =
    selection?.kind === "room"
      ? "▢"
      : selection?.kind === "door"
        ? "▣"
        : selection?.kind === "prop"
          ? "❑"
          : selection?.kind === "pickup"
            ? "✚"
            : selection?.kind === "puzzle"
              ? "◈"
              : selection?.kind === "routeSwitch"
                ? "⌁"
                : selection?.kind === "robot"
                  ? "◆"
                  : "☰";
  const displayProjectTitle = language === "en" ? bl(project.title, language) : project.title;

  return (
    <BuilderLanguageProvider value={builderLang}>
    <BuilderSelectionProvider value={selectionContext}>
    <div className="builder-page" style={builderUiImage2CssVars as CSSProperties}>
      <FloorPatternDefs />
      <SurfacePatternDefs />
      <RoomSurfacePatternDefs project={project} />
      {brush?.kind === "floor" && armedBrushPreset ? <BrushPreviewPatternDef preset={armedBrushPreset} /> : null}
      <header className="builder-topbar">
        <span className="builder-logo">
          <i className="builder-logo-dot" />
          {language === "en" ? "HP Escape Workshop" : "HP 密室工坊"}
          <em>BUILDER v2</em>
        </span>
        <button
          type="button"
          className="builder-lang-toggle"
          onClick={builderLang.toggleLanguage}
          title={language === "en" ? "Switch to Chinese" : "切换到英文"}
          aria-label={language === "en" ? "Switch to Chinese" : "切换到英文"}
        >
          {language === "en" ? "中文" : "EN"}
        </button>
        <input
          className="builder-title-input"
          value={displayProjectTitle}
          onChange={(event) => update((draft) => ({ ...draft, title: event.target.value }))}
          placeholder={language === "en" ? "Level name" : "关卡名"}
        />
        <span className="builder-topbar-meta">
          {project.rooms.length} {language === "en" ? "rooms" : "房间"} · {project.doors.length} {language === "en" ? "doors" : "门"} ·{" "}
          {project.robots.reduce((total, robot) => total + robot.count, 0)} {language === "en" ? "enemies" : "敌"}
        </span>
        <div className="builder-actions">
          <div className="builder-actions-secondary">
            <div className="builder-topbar-icons" aria-label={language === "en" ? "Editor quick actions" : "编辑器快捷操作"}>
              <button type="button" onClick={() => setBuilderMenuOpen(true)} title={language === "en" ? "Settings" : "设置"}>
                ⚙
              </button>
            </div>
            <button
              type="button"
              onClick={runRepair}
              title={
                language === "en"
                  ? "Auto-snap rooms, clear broken doors, add robots, fix duplicate light orders"
                  : "自动贴合房间、清理断门、补机器人、修正重复灯序"
              }
            >
              {language === "en" ? "⚒ Repair" : "⚒ 修复"}
            </button>
            <button type="button" onClick={runValidate}>{language === "en" ? "Validate" : "校验"}</button>
            <button type="button" className="builder-save-open" onClick={openSaveLibrary}>
              {language === "en" ? "Saves" : "存档"}
            </button>
            <button type="button" onClick={runExport}>{language === "en" ? "Export JSON" : "导出 JSON"}</button>
            <button type="button" onClick={() => setShowJson((value) => !value)}>
              {showJson ? (language === "en" ? "Close JSON" : "关闭 JSON") : "JSON"}
            </button>
          </div>
          <div className="builder-actions-primary">
            <BuilderPlaytestPackControls
              project={project}
              blockedCount={statusChips.filter((chip) => chip.id !== "playable" && chip.state === "bad").length}
              onShowIssues={runValidate}
              playtestRequestToken={playtestRequestToken}
              onAutoRepair={runRepair}
              onBeforeLaunch={stopBuilderMusic}
              onStatus={setStatusText}
            />
          </div>
        </div>
      </header>

      <div className="builder-main">
        <BuilderAssetBrowser
          project={project}
          tab={catalogTab}
          filter={catalogFilter}
          onFilter={setCatalogFilter}
          placement={placement}
          brush={brush}
          recent={recent}
          onBeginPlacement={beginPlacement}
          onBeginBrush={beginBrush}
          onAddRoom={addRoom}
          onAddShapeRoom={addShapeRoom}
          onStampBuilding={stampBuilding}
          buildingTurns={buildingTurns}
          onRotateBuilding={() => setBuildingTurns((turns) => (turns + 1) % 4)}
          onAddDoor={addDoor}
          onAddPuzzle={addPuzzle}
          onAddPickup={addPickup}
          onAddWallDoorSwitch={addWallDoorSwitch}
          onApplyTemplate={applyTemplate}
          onStatus={setStatusText}
        />

        <div className="builder-center">
          <BuilderViewportControls
            viewMode={viewMode}
            onViewMode={setViewMode}
            zoom={viewport.zoom}
            onZoomIn={() => zoomBy(1.25)}
            onZoomOut={() => zoomBy(0.8)}
            onResetView={resetView}
            snapOn={snapOn}
            onToggleSnap={toggleSnap}
            roofHidden={roofHidden}
            onToggleRoof={() => {
              setRoofHidden((value) => {
                const next = !value;
                setStatusText(
                  next
                    ? language === "en"
                      ? "Cutaway edit: the roof is lifted in the editor; playtests still have a full ceiling."
                      : "剖切编辑：屋顶在编辑器里掀开，试玩时仍然有完整天花板。"
                    : language === "en"
                      ? "Roof view: shown per each room's ceiling setting."
                      : "屋顶视图：按每间房的天花板设置显示。",
                );
                return next;
              });
            }}
            editActions={editActions}
          />
          <div className={`builder-stage ${viewMode}${viewMode === "plan" ? " with-peek" : ""}`}>
            {/* Always mounted and never resized to zero: r3f stops flushing updates when its
                container collapses (display:none). In plan mode it becomes a live 3D peek. */}
            <div className="builder-stage-3d" aria-hidden={false}>
              <BuilderErrorBoundary label={language === "en" ? "3D Stage" : "3D 舞台"} language={language}>
              <BuilderPreview3D
                project={project}
                selection={selection}
                hovered={hovered}
                orderedPathRoomIds={criticalPath.orderedRoomIds}
                resetToken={cameraResetToken}
                placement={placement}
                brush={brush}
                paintFlash={paintFlash}
                placeFlash={placeFlash}
                roofHidden={roofHidden}
                bindDoorMode={puzzleBind !== null}
                hostPick={hostPick}
                roomSelectionEnabled={activeTool === "rooms"}
                panMode={panMode}
                snapStep={snapStep}
                update={update}
                onPickPuzzleHost={applyPuzzleHostPick}
                onSelect={handleStageSelect}
                onHover={handleStageHover}
                onGestureStart={history.mark}
                onPlace={placeAt}
                onBrush={applyBrush}
                onStatus={setStatusText}
              />
              </BuilderErrorBoundary>
              {viewMode === "plan" ? <span className="builder-peek-label">{language === "en" ? "3D Peek" : "3D 预览"}</span> : null}
            </div>
            {viewMode === "plan" ? <div className="builder-plan-layer">{renderCanvas2D("editor")}</div> : null}
            {viewMode === "split" ? (
              <div className={`builder-blueprint ${blueprintOpen ? "" : "collapsed"}`}>
                <header>
                  <span>{language === "en" ? "▦ 2D Map" : "▦ 2D 缩略图"}</span>
                  <button
                    type="button"
                    title={
                      blueprintOpen
                        ? language === "en"
                          ? "Collapse 2D map"
                          : "收起 2D 缩略图"
                        : language === "en"
                          ? "Expand 2D map"
                          : "展开 2D 缩略图"
                    }
                    onClick={() => setBlueprintOpen((value) => !value)}
                  >
                    {blueprintOpen ? "▾" : "▸"}
                  </button>
                </header>
                {blueprintOpen ? renderCanvas2D("navigator") : null}
              </div>
            ) : null}
            {overlayEnabled ? <BuilderOverlayLegend /> : null}
            {roofHidden ? (
              <span
                className="builder-roof-chip"
                role="status"
                title={
                  language === "en"
                    ? "Cutaway only affects the editor view; playtests give every room a full roof"
                    : "剖切只影响编辑视图；试玩时每间房都有完整屋顶"
                }
              >
                {language === "en" ? "⬒ Cutaway edit · roof in playtest" : "⬒ 剖切编辑 · 试玩有顶"}
                <button type="button" onClick={() => setRoofHidden(false)}>{language === "en" ? "Show roof" : "显示屋顶"}</button>
              </span>
            ) : null}
            {puzzleBind ? (
              <div className="builder-placement-banner builder-bind-banner" role="status">
                <i style={{ background: puzzleKindEntry(puzzleBind).color, boxShadow: `0 0 8px ${puzzleKindEntry(puzzleBind).color}` }} />
                {language === "en"
                  ? `Pick a door to lock with "${bl(puzzleKindEntry(puzzleBind).label, language)}" — glowing doors can be bound`
                  : `选择一扇门作为「${bl(puzzleKindEntry(puzzleBind).label, language)}」的锁 — 发光的门可绑定`}
                <button
                  type="button"
                  onClick={() => {
                    setPuzzleBind(null);
                    setStatusText(language === "en" ? "Exited puzzle binding." : "已退出谜题绑定。");
                  }}
                >
                  {language === "en" ? "Esc cancel" : "Esc 取消"}
                </button>
              </div>
            ) : null}
            {hostPick ? (
              <div className="builder-placement-banner builder-hostpick-banner" role="status">
                <i />
                {hostPick.kind === "component"
                  ? language === "en"
                    ? "Pick furniture for this orb target"
                    : "选择承载这个色球的家具"
                  : hostPick.kind === "routeSwitch"
                    ? language === "en"
                      ? "Pick furniture for this route switch"
                      : "选择承载这座路由台的家具"
                  : language === "en"
                    ? "Pick furniture for this puzzle interaction"
                    : "选择承载这座谜题交互的家具"}
                <button type="button" onClick={cancelPuzzleHostPick}>{language === "en" ? "Esc cancel" : "Esc 取消"}</button>
              </div>
            ) : null}
            {brush ? (
              <div className={`builder-brush-hud brush-${brush.kind}`} role="status">
                <i className="builder-brush-glyph">{brush.kind === "floor" ? "▨" : brush.kind === "wall" ? "▥" : "⬒"}</i>
                <div className="builder-brush-info">
                  <strong>
                    {brush.kind === "floor"
                      ? language === "en"
                        ? "Floor brush"
                        : "地板刷"
                      : brush.kind === "wall"
                        ? language === "en"
                          ? "Wall brush"
                          : "墙壁刷"
                        : language === "en"
                          ? "Ceiling brush"
                          : "天花板刷"}
                  </strong>
                  <em>{armedBrushPreset ? bl(armedBrushPreset.label, language) : ""}</em>
                </div>
                {armedBrushPreset ? (
                  <span className="builder-brush-swatch">
                    <SurfaceSwatch preset={armedBrushPreset} />
                  </span>
                ) : null}
                <ToggleChip
                  label={language === "en" ? "Continuous" : "连续"}
                  on={continuousPaint}
                  onToggle={() => setContinuousPaint((value) => !value)}
                  title={
                    language === "en"
                      ? "Continuous paint: when on, clicking doesn't exit (Shift also paints continuously for a moment)"
                      : "连续涂刷：开启后点击不退出（Shift 也可临时连刷）"
                  }
                />
                <span className="builder-brush-hint">
                  {language === "en" ? "Click a room to apply · Shift for continuous paint · Esc to cancel" : "点击房间应用 · Shift 连续涂刷 · Esc 取消"}
                </span>
                <button type="button" onClick={cancelPlacement}>✕</button>
              </div>
            ) : placement ? (
              <div className="builder-placement-banner">
                <i />
                {placement.kind === "prop"
                  ? language === "en"
                    ? "Placement mode · click the floor to drop · R to rotate"
                    : "放置模式 · 点击地面放下 · R 旋转"
                  : placement.kind === "pickup"
                    ? language === "en"
                      ? "Pickup placement · click the floor to drop"
                      : "拾取放置 · 点击地面放下"
                    : placement.kind === "routeSwitch"
                      ? language === "en"
                        ? "Route switch placement · click the floor to drop"
                        : "路由台放置 · 点击地面放下"
                    : placement.kind === "wallDoorSwitch"
                      ? language === "en"
                        ? "Wall switch placement · click near a wall to mount"
                        : "墙控把手放置 · 点击墙边挂上去"
                    : language === "en"
                      ? "Deploy mode · click the floor to place a robot"
                      : "部署模式 · 点击地面放下机器人"}
                <button type="button" onClick={cancelPlacement}>{language === "en" ? "Esc cancel" : "Esc 取消"}</button>
              </div>
            ) : null}
            {savedLevelId || result ? (
              <div className="builder-toasts">
                {result ? (
                  <ResultSummary
                    result={result}
                    language={language}
                    onClose={() => setResult(null)}
                    onRepair={runRepair}
                    onLocate={(target) => {
                      setSelection(target);
                      setStatusText(
                        language === "en"
                          ? "Selected the flagged object — edit it directly in the right panel."
                          : "已选中问题对象，右侧面板可直接修改。",
                      );
                    }}
                  />
                ) : null}
                {savedLevelId ? (
                  <div className="builder-saved-panel">
                    <code>{savedLevelId}</code>
                    <button
                      type="button"
                      onClick={() => {
                        requestWebGpuPlaytest();
                      }}
                    >
                      {language === "en" ? "WebGPU Playtest" : "WebGPU 试玩"}
                    </button>
                    <button type="button" onClick={() => copyLevelUrl(savedLevelId)}>{language === "en" ? "Copy link" : "复制链接"}</button>
                    <button type="button" onClick={() => setSavedLevelId(null)}>✕</button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className={`builder-inspector-shell ${inspectorCollapsed ? "collapsed" : ""} ${selection ? "has-selection" : "idle"}`}>
          <button type="button" className="builder-inspector-toggle" onClick={() => setInspectorCollapsed((value) => !value)} title={inspectorToggleLabel} aria-label={inspectorToggleLabel}>
            {inspectorCollapsed ? "‹" : "›"}
          </button>
          {inspectorCollapsed ? (
            <aside className="builder-inspector-mini" aria-label={language === "en" ? "Collapsed properties panel" : "折叠的属性面板"}>
              <i>{inspectorMiniGlyph}</i>
              <span>{language === "en" ? "Props" : "属性"}</span>
            </aside>
          ) : (
            <BuilderInspectorPanel
              project={project}
              selection={selection}
              update={update}
              snapOn={snapOn}
              onToggleSnap={() => setSnapOn((value) => !value)}
              onRotate={rotateSelection}
              onDuplicate={duplicateSelection}
              onRemove={removeSelection}
              onSelect={setSelection}
              onHover={handleStageHover}
              onGestureStart={history.mark}
              hostPick={hostPick}
              onStartPuzzleHostPick={startPuzzleHostPick}
              onGuideGoal={guideToGoal}
              onStartTool={handleTool}
              onAddDoor={addDoor}
            />
          )}
        </div>
      </div>

      <BuilderBuildToolbar
        activeTool={activeTool}
        onTool={handleTool}
        topology={topology}
        statusText={statusText}
        director={<BuilderDirectorStrip project={project} statusChips={statusChips} onGuide={guideToGoal} />}
      />

      {showJson ? <JsonPreview project={project} language={language} /> : null}
      {saveLibraryOpen ? (
        <BuilderSaveLibrary
          project={project}
          language={language}
          slots={saveSlots}
          saving={saving}
          savedLevelId={savedLevelId}
          onClose={() => setSaveLibraryOpen(false)}
          onSaveSlot={saveToSlot}
          onLoadSlot={loadFromSlot}
          onClearSlot={clearSlot}
          onPublish={() => runSave()}
        />
      ) : null}
      {builderMenuOpen ? (
        <div className="root-menu-modal-scrim" role="dialog" aria-modal="true" onClick={() => setBuilderMenuOpen(false)}>
          <div className="root-menu-modal" onClick={(event) => event.stopPropagation()}>
            <span className="rm-br rm-br-tl" aria-hidden="true" />
            <span className="rm-br rm-br-tr" aria-hidden="true" />
            <span className="rm-br rm-br-bl" aria-hidden="true" />
            <span className="rm-br rm-br-br" aria-hidden="true" />
            <h3 className={language === "en" ? "rm-lat" : undefined}>{language === "en" ? "System" : "系统"}</h3>
            <div className="root-menu-field">
              <label className={language === "en" ? "rm-lat" : undefined}>{language === "en" ? "Language" : "语言"}</label>
              <div className="root-menu-lang-choice">
                <button type="button" className={language === "zh" ? "active" : ""} aria-pressed={language === "zh"} onClick={() => builderLang.setLanguage("zh")}>
                  中文
                </button>
                <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => builderLang.setLanguage("en")}>
                  English
                </button>
              </div>
            </div>
            <div className="root-menu-modal-actions">
              <button type="button" className="root-menu-modal-btn" onClick={() => window.location.assign("/")}>
                <span className={language === "en" ? "rm-lat" : undefined}>{language === "en" ? "Main Menu" : "返回主页面"}</span>
              </button>
              <button type="button" className="root-menu-modal-btn" onClick={() => setBuilderMenuOpen(false)}>
                <span className={language === "en" ? "rm-lat" : undefined}>{language === "en" ? "Resume" : "继续"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showOnboarding ? (
        <BuilderOnboardingOverlay
          language={language}
          onPickProject={pickOnboardingProject}
          onDismiss={completeOnboarding}
          onStartTool={handleTool}
          onViewMode={setViewMode}
          onRepair={runRepair}
          onValidate={runValidate}
          onPlaytest={requestWebGpuPlaytest}
        />
      ) : null}

      <BuilderConfirmModal
        open={pendingTemplateId !== null}
        language={language}
        title={language === "en" ? "Load this template?" : "载入这个模板？"}
        message={
          language === "en" ? (
            <>Load the template <b>&ldquo;{pendingTemplateLabel}&rdquo;</b>? Your current draft will be overwritten.</>
          ) : (
            <>载入模板<b>「{pendingTemplateLabel}」</b>？当前草稿会被<b>覆盖</b>。</>
          )
        }
        confirmLabel={language === "en" ? "Load & overwrite" : "载入并覆盖"}
        cancelLabel={language === "en" ? "Cancel" : "取消"}
        onConfirm={confirmApplyTemplate}
        onCancel={() => setPendingTemplateId(null)}
      />
    </div>
    </BuilderSelectionProvider>
    </BuilderLanguageProvider>
  );
}

function computeCriticalPath(project: BuilderProject) {
  const empty = { roomIds: new Set<string>(), doorIds: new Set<string>(), orderedRoomIds: [] as string[] };
  const start = project.rooms[0]?.id;
  if (!start || !project.exitRoomId) return empty;

  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const validDoors = project.doors.filter((door) => {
    const a = roomsById.get(door.fromRoomId);
    const b = roomsById.get(door.toRoomId);
    return a && b && sharedEdge(a, b);
  });

  const queue: { roomId: string; path: string[]; doors: string[] }[] = [{ roomId: start, path: [start], doors: [] }];
  const visited = new Set([start]);
  while (queue.length > 0) {
    const current = queue.shift() as (typeof queue)[number];
    if (current.roomId === project.exitRoomId) {
      return { roomIds: new Set(current.path), doorIds: new Set(current.doors), orderedRoomIds: current.path };
    }
    for (const door of validDoors) {
      const next = door.fromRoomId === current.roomId ? door.toRoomId : door.toRoomId === current.roomId ? door.fromRoomId : null;
      if (!next || visited.has(next)) continue;
      visited.add(next);
      queue.push({ roomId: next, path: [...current.path, next], doors: [...current.doors, door.id] });
    }
  }
  return empty;
}

function defaultRouteSwitchOutput(project: BuilderProject): BuilderRouteSwitchOutput {
  const targetDoor = project.doors.find((door) => door.lockType !== "none") ?? project.doors[0];
  if (targetDoor) return { id: createBuilderId("route_out"), kind: "open_door", doorId: targetDoor.id };
  const puzzle = puzzleInstances(project)[0];
  if (puzzle) return { id: createBuilderId("route_out"), kind: "reveal_puzzle", puzzleId: puzzle.id };
  const robotRoomId = project.robots[0]?.roomId;
  if (robotRoomId) return { id: createBuilderId("route_out"), kind: "start_robots", robotRoomId };
  return { id: createBuilderId("route_out"), kind: "open_door" };
}

function compactRouteSwitches(routes: readonly BuilderRouteSwitch[]) {
  return routes.filter((route) => route.outputs.length > 0);
}

function repairRouteSwitchPuzzleOutputs(project: BuilderProject): BuilderProject {
  const puzzles = puzzleInstances(project);
  if (puzzles.length === 0 || !project.routeSwitches?.length) return project;
  const puzzleIds = new Set(puzzles.map((puzzle) => puzzle.id));
  let changed = false;
  const fallbackPuzzleId = puzzles[0].id;
  const routeSwitches = project.routeSwitches.map((route) => {
    let routeChanged = false;
    const outputs = route.outputs.map((output) => {
      if (output.kind !== "reveal_puzzle" || (output.puzzleId && puzzleIds.has(output.puzzleId))) return output;
      routeChanged = true;
      changed = true;
      return { ...output, puzzleId: fallbackPuzzleId };
    });
    return routeChanged ? { ...route, outputs } : route;
  });
  return changed ? { ...project, routeSwitches } : project;
}

function normalizeBuilderProjectForEditing(project: BuilderProject): BuilderProject {
  return repairRouteSwitchPuzzleOutputs(normalizeBuilderKeyPickups(normalizeBuilderPuzzles(project)));
}

/**
 * Player-facing guidance rules for raw compile/validator output. Each rule matches the
 * raw (Chinese) validator message on a language-agnostic key, then rewrites it into
 * friendly build guidance in the active language.
 */
const friendlyIssueRules: readonly { match: RegExp; rewrite: (message: string, language: GameLanguage) => string }[] = [
  {
    match: /没有足够长的共享边，无法放门/,
    rewrite: (message, language) =>
      language === "en"
        ? "Rooms aren't touching, so a door can't go here — drag rooms until their edges meet."
        : message.replace(/没有足够长的共享边，无法放门。?/, "没有贴边，无法放门——拖动房间让边缘贴齐。"),
  },
  {
    match: /出生房间和出口房间之间没有门连通/,
    rewrite: (_message, language) =>
      language === "en" ? "The exit isn't connected to spawn yet — link the rooms with doors." : "出口还没连到出生点——用门把房间串起来。",
  },
  {
    match: /出口房间不能是出生房间/,
    rewrite: (_message, language) =>
      language === "en" ? "The exit and spawn are the same room — pick a different room as the exit." : "出口和出生点是同一间房——另选一间作为出口。",
  },
  {
    match: /请指定出口房间/,
    rewrite: (_message, language) => (language === "en" ? "No exit yet — select a room and set it as the exit." : "还没有出口——选中一间房，把它设为出口。"),
  },
  {
    match: /需要先放至少一组机器人，清剿锁才有效/,
    rewrite: (message, language) =>
      language === "en"
        ? "No robots yet, so the clear-the-bots door won't unlock — put a group inside."
        : message.replace(/需要先放至少一组机器人，清剿锁才有效。?/, "还没有机器人，清剿门不会解锁——放一组进去。"),
  },
  {
    match: /机器人引用了不存在的房间/,
    rewrite: (_message, language) =>
      language === "en" ? "A robot isn't in any room — drag it back inside or delete it." : "有机器人不在任何房间里——拖回房间内或删除它。",
  },
  {
    match: /门引用了不存在的房间/,
    rewrite: (_message, language) =>
      language === "en" ? "A door connects a deleted room — delete this door." : "有扇门连着已删除的房间——删除这扇门。",
  },
  {
    match: /道具引用了不存在的模型或房间/,
    rewrite: (_message, language) =>
      language === "en" ? "A prop's room no longer exists — move or delete it." : "有件家具的所在房间已不存在——移动或删除它。",
  },
  {
    match: /拾取物所在房间已被删除/,
    rewrite: (_message, language) =>
      language === "en" ? "A pickup isn't in any room — drag it back inside or delete it." : "有个拾取物不在任何房间里——拖回房间内或删除它。",
  },
  {
    match: /解除钥必须绑定一扇钥匙门/,
    rewrite: (_message, language) =>
      language === "en"
        ? "The release key isn't bound to a key door — select it and pick a key door on the right."
        : "解除钥还没绑定钥匙门——选中它，在右侧选择一扇钥匙门。",
  },
  {
    match: /至少需要一个房间/,
    rewrite: (_message, language) => (language === "en" ? "The canvas is empty — add a room from the left first." : "画布是空的——先从左侧添加一个房间。"),
  },
  {
    match: /v1 只支持一扇谜题门/,
    rewrite: (_message, language) =>
      language === "en" ? "Only one puzzle door is allowed — swap the extras for other locks." : "谜题门只能有一扇——把多余的换成其它锁。",
  },
  {
    match: /颜色顺序至少需要 2 个不同颜色/,
    rewrite: (_message, language) =>
      language === "en"
        ? "Too few puzzle colors — pick at least 2 different colors in the door settings."
        : "谜题颜色太少——在门设置里选至少 2 种不同颜色。",
  },
];

/** Collapse legacy "副本 副本 …" runs + rewrite debug copy into build guidance. */
function friendlyIssueText(message: string, language: GameLanguage) {
  const cleaned = message.replace(/副本(?:\s*副本)+/g, "副本");
  for (const rule of friendlyIssueRules) {
    if (rule.match.test(cleaned)) return rule.rewrite(cleaned, language);
  }
  // Untranslated validator output (English/internal) stays in the DEV details only.
  if (!/[一-鿿]/.test(cleaned)) return null;
  return cleaned;
}

/** Maps an issue path back to a selectable object for the 定位 button. */
function selectionFromIssuePath(path: string): BuilderSelection {
  const match = /^(rooms|doors|props|pickups|robots|puzzles)\.([\w-]+)/.exec(path);
  if (!match) return null;
  const kind =
    match[1] === "rooms"
      ? "room"
      : match[1] === "doors"
        ? "door"
        : match[1] === "props"
          ? "prop"
          : match[1] === "pickups"
            ? "pickup"
            : match[1] === "puzzles"
              ? "puzzle"
              : "robot";
  return { kind, id: match[2] } as BuilderSelection;
}

function ResultSummary({
  result,
  language,
  onClose,
  onRepair,
  onLocate,
}: {
  result: BuilderValidationResult | BuilderSaveResult;
  language: GameLanguage;
  onClose: () => void;
  onRepair: () => void;
  onLocate: (selection: BuilderSelection) => void;
}) {
  const rawIssues = [
    ...result.compileIssues.map((issue) => ({ path: issue.path, message: issue.message })),
    ...(result.report?.errors ?? []),
    ...("importResult" in result && result.importResult && !result.importResult.ok ? result.importResult.errors : []),
  ];
  const seen = new Set<string>();
  const friendly: { key: string; text: string; locate: BuilderSelection }[] = [];
  let technicalCount = 0;
  for (const issue of rawIssues) {
    const text = friendlyIssueText(issue.message, language);
    if (!text) {
      technicalCount += 1;
      continue;
    }
    if (seen.has(text)) continue;
    seen.add(text);
    friendly.push({ key: `${issue.path}-${friendly.length}`, text, locate: selectionFromIssuePath(issue.path) });
  }
  const warnings = result.report?.warnings ?? [];
  const broken = rawIssues.length > 0;
  const stepsLeft = friendly.length + technicalCount;
  return (
    <div className={broken ? "builder-result error" : "builder-result ok"}>
      <strong>
        {broken
          ? language === "en"
            ? `${stepsLeft} step${stepsLeft === 1 ? "" : "s"} left until it's playable`
            : `还差 ${stepsLeft} 步就能开玩`
          : language === "en"
            ? "✓ Ready to play"
            : "✓ 可以开玩"}
      </strong>
      {!broken && warnings.length > 0 ? (
        <em>
          {warnings.length} {language === "en" ? (warnings.length === 1 ? "suggestion" : "suggestions") : "个建议"}
        </em>
      ) : null}
      <button type="button" className="builder-result-close" onClick={onClose} title={language === "en" ? "Dismiss" : "忽略"}>✕</button>
      {friendly.length > 0 ? (
        <ul>
          {friendly.slice(0, 4).map((issue) => (
            <li key={issue.key}>
              {issue.text}
              {issue.locate ? (
                <button type="button" className="builder-result-locate" onClick={() => onLocate(issue.locate)}>
                  {language === "en" ? "Locate" : "定位"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {broken && technicalCount > 0 && friendly.length === 0 ? (
        <p className="builder-result-tech">{language === "en" ? "The level data failed full validation." : "关卡数据未通过完整校验。"}</p>
      ) : null}
      {broken ? (
        <div className="builder-result-actions">
          <button
            type="button"
            onClick={onRepair}
            title={
              language === "en"
                ? "Auto-snap rooms, clear broken doors, add robots, fix duplicate light orders"
                : "自动贴合房间、清理断门、补机器人、修正重复灯序"
            }
          >
            {language === "en" ? "⚒ Auto-fix" : "⚒ 一键修复"}
          </button>
          <button type="button" onClick={onClose}>{language === "en" ? "Dismiss" : "忽略"}</button>
        </div>
      ) : null}
      {import.meta.env.DEV && rawIssues.length > 0 ? (
        <details className="builder-result-dev">
          <summary>{language === "en" ? "Raw messages (DEV)" : "原始信息（DEV）"}</summary>
          <ul>
            {rawIssues.map((issue, index) => (
              <li key={index}>
                <code>{issue.path}</code> {issue.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function JsonPreview({ project, language }: { project: BuilderProject; language: GameLanguage }) {
  const json = useMemo(
    () =>
      exportBuilderProjectJson(project) ??
      (language === "en" ? "// This project can't be compiled yet — fix the validation issues first." : "// 当前项目无法编译，先处理校验问题。"),
    [language, project],
  );
  return (
    <div className="builder-json">
      <pre>{json}</pre>
    </div>
  );
}

function BuilderSaveLibrary({
  project,
  language,
  slots,
  saving,
  savedLevelId,
  onClose,
  onSaveSlot,
  onLoadSlot,
  onClearSlot,
  onPublish,
}: {
  project: BuilderProject;
  language: GameLanguage;
  slots: BuilderSaveSlot[];
  saving: boolean;
  savedLevelId: string | null;
  onClose: () => void;
  onSaveSlot: (slotIndex: number) => void;
  onLoadSlot: (slotIndex: number) => void;
  onClearSlot: (slotIndex: number) => void;
  onPublish: () => void;
}) {
  const currentSummary = useMemo(() => summarizeBuilderSaveProject(project), [project]);
  const displayProjectTitle = language === "en" ? bl(project.title, language) : project.title;
  const [pendingClearSlot, setPendingClearSlot] = useState<number | null>(null);
  const preparedSlots = useMemo(
    () => Array.from({ length: 10 }, (_, index) => slots[index] ?? { index, title: "", savedAt: null, project: null, summary: null }),
    [slots],
  );

  return (
    <div
      className="builder-save-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="builder-save-modal" role="dialog" aria-modal="true" aria-labelledby="builder-save-title">
        <header className="builder-save-head">
          <div>
            <span className="builder-save-kicker">LOCAL ARCHIVE</span>
            <h2 id="builder-save-title">{language === "en" ? "Local Archive Library" : "本地存档库"}</h2>
          </div>
          <button type="button" className="builder-save-close" onClick={onClose} title={language === "en" ? "Close" : "关闭"}>
            ✕
          </button>
        </header>

        <div className="builder-save-current">
          <div className="builder-save-current-title">
            <span>{language === "en" ? "Current room" : "当前房间"}</span>
            <strong>{displayProjectTitle.trim() || (language === "en" ? "Untitled escape room" : "未命名密室")}</strong>
          </div>
          <BuilderSaveStat label={language === "en" ? "Rooms" : "房间"} value={currentSummary.rooms} />
          <BuilderSaveStat label={language === "en" ? "Doors" : "门"} value={currentSummary.doors} />
          <BuilderSaveStat label={language === "en" ? "Puzzles" : "谜题"} value={currentSummary.puzzles} />
          <BuilderSaveStat label={language === "en" ? "Enemies" : "敌人"} value={currentSummary.robots} />
          <BuilderSaveStat label={language === "en" ? "Exit" : "出口"} value={bl(currentSummary.exitLabel, language)} wide />
        </div>

        <div className="builder-save-grid" aria-label={language === "en" ? "Local save slots" : "本地存档槽"}>
          {preparedSlots.map((slot) => {
            const summary = slot.summary;
            const occupied = Boolean(slot.project);
            const pendingClear = pendingClearSlot === slot.index;
            return (
              <article key={slot.index} className={`builder-save-slot ${occupied ? "filled" : "empty"}`}>
                <div className="builder-save-slot-main">
                  <span className="builder-save-slot-id">{String(slot.index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{occupied ? slot.title : language === "en" ? "Empty slot" : "空存档"}</strong>
                    <em>{occupied ? formatBuilderSlotDate(slot.savedAt, language) : language === "en" ? "Awaiting save" : "等待保存"}</em>
                  </div>
                </div>
                <div className="builder-save-slot-stats">
                  <span>{summary ? `${summary.rooms} ${language === "en" ? "rooms" : "房间"}` : language === "en" ? "No rooms" : "无房间"}</span>
                  <span>{summary ? `${summary.doors} ${language === "en" ? "doors" : "门"}` : language === "en" ? "No doors" : "无门"}</span>
                  <span>{summary ? `${summary.puzzles} ${language === "en" ? "puzzles" : "谜题"}` : language === "en" ? "No puzzles" : "无谜题"}</span>
                  <span>{summary ? `${summary.robots} ${language === "en" ? "enemies" : "敌"}` : language === "en" ? "No enemies" : "无敌人"}</span>
                </div>
                <div className="builder-save-slot-exit">{summary?.exitLabel ?? (language === "en" ? "No exit set" : "未设置出口")}</div>
                <div className="builder-save-slot-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setPendingClearSlot(null);
                      onSaveSlot(slot.index);
                    }}
                  >
                    {occupied ? (language === "en" ? "Overwrite" : "覆盖") : language === "en" ? "Save" : "保存"}
                  </button>
                  <button
                    type="button"
                    disabled={!occupied}
                    onClick={() => {
                      setPendingClearSlot(null);
                      onLoadSlot(slot.index);
                    }}
                  >
                    {language === "en" ? "Load" : "读取"}
                  </button>
                  <button
                    type="button"
                    className={pendingClear ? "danger confirm" : "danger"}
                    disabled={!occupied}
                    onClick={() => {
                      if (!occupied) return;
                      if (pendingClear) {
                        onClearSlot(slot.index);
                        setPendingClearSlot(null);
                        return;
                      }
                      setPendingClearSlot(slot.index);
                    }}
                  >
                    {pendingClear ? (language === "en" ? "Confirm" : "确认") : language === "en" ? "Clear" : "清空"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="builder-save-footer">
          <span>{language === "en" ? "The autosave draft still keeps your current edits" : "自动草稿仍会保留当前编辑进度"}</span>
          <div>
            {savedLevelId ? <code>{savedLevelId}</code> : null}
            <button type="button" onClick={onPublish} disabled={saving}>
              {saving ? (language === "en" ? "Publishing…" : "发布中…") : language === "en" ? "Publish local level" : "发布本地关卡"}
            </button>
            <button type="button" onClick={onClose}>{language === "en" ? "Close" : "关闭"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function BuilderSaveStat({ label, value, wide = false }: { label: string; value: number | string; wide?: boolean }) {
  return (
    <span className={wide ? "builder-save-stat wide" : "builder-save-stat"}>
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
  );
}

function formatBuilderSlotDate(savedAt: string | null, language: GameLanguage): string {
  const unknown = language === "en" ? "Time unknown" : "时间未知";
  if (!savedAt) return unknown;
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return unknown;
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "清剿机房" → "清剿机房 副本" → "清剿机房 副本 2" — never "副本 副本". */
function nextCopyLabel(label: string, existing: readonly string[]) {
  const base = label.replace(/(?:\s*副本(?:\s*\d+)?)+$/, "").trim() || label.trim();
  let candidate = `${base} 副本`;
  for (let index = 2; existing.includes(candidate); index += 1) {
    candidate = `${base} 副本 ${index}`;
  }
  return candidate;
}

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

/**
 * A clear drop center for a newly added room: just past the right edge of every
 * existing room, vertically centered on them. Beyond all rooms in X → never
 * overlaps. Empty project → origin.
 */
function suggestRoomDropCenter(rooms: readonly BuilderRoom[], width: number): readonly [number, number] {
  if (rooms.length === 0) return [0, 0];
  const gap = 3;
  let maxX = -Infinity;
  let sumZ = 0;
  for (const room of rooms) {
    maxX = Math.max(maxX, room.center[0] + room.size[0] / 2);
    sumZ += room.center[1];
  }
  return [snap(maxX + gap + width / 2, 1), snap(sumZ / rooms.length, 1)];
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

function playtestUrl(levelId: string) {
  return `${window.location.origin}/?level=${levelId}`;
}

function exportFileSlug(title: string) {
  const slug = title
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "builder-level";
}
