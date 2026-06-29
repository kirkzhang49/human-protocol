import { memo, useState } from "react";
import type { EnemyTierId } from "../game/config/enemyTiers";
import type { GameLanguage } from "../game/core/GameSettings";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import { bl } from "./i18n/catalogLabels";
import {
  builderDoorFamilies,
  builderLockLabels,
  builderPuzzleColors,
  builderRobotCatalog,
  builderRoomStyles,
  defaultPropElevation,
  propEntry,
  robotLabel,
} from "./BuilderAssetCatalog";
import { RobotThumb, RoomStyleThumb } from "./BuilderAssetFootprints";
import { AssetImageThumb, PickupImageThumb } from "./BuilderAssetBrowser";
import { isQuarantined, restoreAsset } from "./BuilderAssetQuarantine";
import { attachedChildCount, reflowAttachedProps } from "./BuilderPropStacking";
import {
  builderPuzzleKinds,
  builderPuzzlePublicKinds,
  archiveMergeTargetOptions,
  createPuzzleInstanceForDoor,
  normalizeBuilderPuzzles,
  orbColorHex,
  orbColorKey,
  puzzleById,
  puzzleForDoor,
  puzzleInstances,
  puzzleResultMode,
  puzzleKindEntry,
  normalizeArchiveMergeTarget,
  valveMatrixInteractionRadius,
  normalizeValveMatrixTimeLimit,
  valveMatrixTimeLimit,
} from "./BuilderPuzzleCatalog";
import { projectWithHostedRouteSwitchProp } from "./BuilderPuzzlePlacement";
import { builderPickupCatalog, pickupEntry } from "./BuilderPickupCatalog";
import { builderRobotPresetDefaults, isBuilderRobotPresetActive, isMuseumCuratorBossRobot } from "./BuilderRobotPresets";
import {
  createBuilderId,
  type BuilderPuzzleComponent,
  type BuilderPuzzleComponentRole,
  type BuilderPuzzleHostPick,
  type BuilderPuzzleInstance,
  type BuilderPuzzleKind,
} from "./BuilderTypes";
import {
  builderDoorDisplayLabel,
  builderDoorEndpointLabel,
  builderDoorSelectedGuardIds,
  builderDoorSurviveRobotIds,
  builderDoorWaveIds,
  builderRobotAuthoredWaveId,
  builderWaveDoorOptions,
} from "./BuilderDoorRelations";
import { builderWaveChainOrdersForRoom, builderWaveChainWithOrder } from "./BuilderWaveChainAuthoring";

/**
 * Chips offered for a puzzle: the premium families, plus the instance's own
 * kind when it is a legacy kind so old drafts can still see and keep it.
 */
function puzzlePickerKinds(currentKind: BuilderPuzzleKind) {
  if (builderPuzzlePublicKinds.some((entry) => entry.kind === currentKind)) return builderPuzzlePublicKinds;
  const legacy = builderPuzzleKinds.find((entry) => entry.kind === currentKind);
  return legacy ? [...builderPuzzlePublicKinds, legacy] : builderPuzzlePublicKinds;
}

function ArchiveMergeTargetControl({
  value,
  onChange,
  compact = false,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  const { language } = useBuilderLanguage();
  const current = normalizeArchiveMergeTarget(value);
  const lengthLabel = current <= 128
    ? (language === "en" ? "Short" : "短局")
    : current >= 1024
      ? (language === "en" ? "Long" : "长局")
      : (language === "en" ? "Standard" : "标准");
  return (
    <div className={`builder-archive-target-control ${compact ? "compact" : ""}`}>
      <span>{language === "en" ? "Compression Target" : "压缩目标"}</span>
      <div className="builder-archive-target-grid" role="group" aria-label={language === "en" ? "Identity compression target" : "身份压缩目标"}>
        {archiveMergeTargetOptions.map((option) => (
          <button key={option} type="button" className={current === option ? "active" : ""} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
      <em>{lengthLabel} · {language === "en" ? "Playtest spawns identity tiles toward this target" : "试玩按这个目标生成身份片"}</em>
    </div>
  );
}
import {
  builderCeilingPresets,
  builderFloorPresets,
  builderWallPresets,
  roomCeiling,
  roomFloor,
  roomWall,
  surfaceColorChips,
  surfaceOverridesWithPreset,
} from "./BuilderEnvironment";
import { AngleControl, CollapsibleCard, ColorChips, InspectorHint, SliderField, Stepper, ThreatMeter, ToggleChip } from "./BuilderFields";
import { BuilderImage2StatePreview } from "./BuilderImage2StatePreview";
import { moveKeyPickupForDoor } from "./BuilderKeyPickups";
import { robotDisplayPosition, roomAt, routeOutputKeyPosition } from "./BuilderPlacementRules";
import type { BuilderToolId } from "./BuilderBuildToolbar";
import type { BuilderDirectorGoal } from "./BuilderDirectorStrip";
import type { BuilderUpdate } from "./BuilderHistory";
import { ProjectInspector } from "./BuilderProjectInspector";
import { roomsOverlap } from "./BuilderRoomEditing";
import { shapeBboxSize } from "./BuilderRoomShape";
import { SurfaceSwatch } from "./BuilderSurfaceArt";
import { useBuilderSelection } from "./BuilderSelectionContext";
import {
  applyToggleDoorOwnership,
  createDedicatedWallDoorSwitch,
  effectiveWallDoorSwitchStates,
  controlledDoorIdsForWallDoorSwitch,
  primaryDoorIdForWallDoorSwitch,
  toggleStatesForWallDoorSwitch,
  wallDoorSwitchCanControlDoor,
  wallDoorSwitchDoorControlUsage,
  wallDoorSwitchMode,
} from "./BuilderWallDoorSwitches";
import type {
  BuilderDoor,
  BuilderPickup,
  BuilderProject,
  BuilderProp,
  BuilderRobotArchetype,
  BuilderRouteSwitch,
  BuilderRouteSwitchOutput,
  BuilderRouteSwitchOutputKind,
  BuilderRoom,
  BuilderRoomEnv,
  BuilderSelection,
  BuilderWallDoorSwitch,
  BuilderWallDoorSwitchState,
} from "./BuilderTypes";
import { sharedEdge } from "./compileBuilderProjectToLevel";

const lockColors: Record<BuilderDoor["lockType"], string> = {
  none: "#76b7e8",
  key_item: "#ffd24f",
  survive_wave: "#ff7a5c",
  puzzle_complete: "#b47aff",
  switch_state: "#7bb7ff",
};

const lockGlyphsZh: Record<BuilderDoor["lockType"], string> = {
  none: "门",
  key_item: "钥",
  survive_wave: "战",
  puzzle_complete: "谜",
  switch_state: "控",
};

const lockGlyphsEn: Record<BuilderDoor["lockType"], string> = {
  none: "Door",
  key_item: "Key",
  survive_wave: "Fight",
  puzzle_complete: "Puzzle",
  switch_state: "Switch",
};

function builderPropInspectorLabel(prop: BuilderProp, language: GameLanguage) {
  return prop.sourceProp?.label ? bl(prop.sourceProp.label, language) : bl(propEntry(prop.modelKey)?.label ?? prop.modelKey, language);
}

function robotInspectorLabel(robot: BuilderProject["robots"][number], language: GameLanguage) {
  if (robot.label?.trim()) return bl(robot.label.trim(), language);
  if (robot.presetId) return bl(builderRobotCatalog.find((entry) => entry.presetId === robot.presetId)?.label ?? robotLabel(robot.archetype), language);
  if (isMuseumCuratorBossRobot(robot)) return bl("策展主管 Boss", language);
  return bl(robotLabel(robot.archetype), language);
}

function builderRobotWaveSummary(robot: BuilderProject["robots"][number], language: GameLanguage) {
  if (robot.waveChain) return language === "en" ? `Wave ${robot.waveChain.order}` : `波次 ${robot.waveChain.order}`;
  if (robot.wave?.presentation?.label || robot.wave?.label) return robot.wave.presentation?.label ?? robot.wave.label;
  return language === "en" ? "Room trigger" : "房间触发";
}

function builderRobotGuardLabel(robot: BuilderProject["robots"][number], project: BuilderProject, language: GameLanguage) {
  const room = project.rooms.find((candidate) => candidate.id === robot.roomId)?.label ?? (language === "en" ? "Unknown room" : "未知房间");
  return `${robotInspectorLabel(robot, language)} · ${builderRobotWaveSummary(robot, language)} · ${room}`;
}

function doorFocusPoint(project: BuilderProject, door: BuilderDoor) {
  const fromRoom = project.rooms.find((room) => room.id === door.fromRoomId);
  const toRoom = project.rooms.find((room) => room.id === door.toRoomId);
  const edge = fromRoom && toRoom ? sharedEdge(fromRoom, toRoom) : null;
  if (edge) return { x: edge.position[0], z: edge.position[2] };
  if (fromRoom && toRoom) return { x: (fromRoom.center[0] + toRoom.center[0]) / 2, z: (fromRoom.center[1] + toRoom.center[1]) / 2 };
  return { x: fromRoom?.center[0] ?? toRoom?.center[0] ?? 0, z: fromRoom?.center[1] ?? toRoom?.center[1] ?? 0 };
}

function robotDistanceToDoor(project: BuilderProject, door: BuilderDoor, robot: BuilderProject["robots"][number]) {
  const spot = robotDisplayPosition(project, robot.id);
  const point = doorFocusPoint(project, door);
  const x = spot?.x ?? robot.position?.[0] ?? project.rooms.find((room) => room.id === robot.roomId)?.center[0] ?? 0;
  const z = spot?.z ?? robot.position?.[1] ?? project.rooms.find((room) => room.id === robot.roomId)?.center[1] ?? 0;
  return Math.hypot(x - point.x, z - point.z);
}

function lockGlyph(lockType: BuilderDoor["lockType"], language: GameLanguage): string {
  return (language === "en" ? lockGlyphsEn : lockGlyphsZh)[lockType];
}

const routeOutputKindLabelsZh: Record<BuilderRouteSwitchOutputKind, string> = {
  open_door: "打开门",
  reveal_puzzle: "接入谜题",
  start_robots: "唤醒机器人",
};

const routeOutputKindLabelsEn: Record<BuilderRouteSwitchOutputKind, string> = {
  open_door: "Open Door",
  reveal_puzzle: "Wire Puzzle",
  start_robots: "Wake Robots",
};

function routeOutputKindLabel(kind: BuilderRouteSwitchOutputKind, language: GameLanguage): string {
  return (language === "en" ? routeOutputKindLabelsEn : routeOutputKindLabelsZh)[kind];
}

interface BuilderInspectorPanelProps {
  project: BuilderProject;
  selection: BuilderSelection;
  update: BuilderUpdate;
  snapOn: boolean;
  onToggleSnap: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  /** Selects another object (e.g. door → its puzzle terminal). */
  onSelect: (selection: BuilderSelection) => void;
  /** Temporarily highlights another object on the stage from inspector hover. */
  onHover?: (selection: BuilderSelection) => void;
  /** Marks undo history before a slider drag gesture. */
  onGestureStart: () => void;
  /** Current guided furniture-pick request for puzzle hosts. */
  hostPick?: BuilderPuzzleHostPick | null;
  /** Starts guided furniture picking for a puzzle interaction or component. */
  onStartPuzzleHostPick?: (request: BuilderPuzzleHostPick) => void;
  /** Routes the idle assistant's next-step chips through the build director. */
  onGuideGoal?: (goal: BuilderDirectorGoal) => void;
  /** Opens a build tool from the idle assistant before anything is selected. */
  onStartTool?: (tool: BuilderToolId) => void;
  /** Creates an auto-placed door from the selected room when possible. */
  onAddDoor?: (lockType?: BuilderDoor["lockType"]) => boolean;
}

/** Right-hand selected-object property panel. Falls back to project settings. */
/**
 * Heaviest builder panel (many fields + the Image2 console preview). Memoized so
 * the high-frequency hover/select churn in BuildPage does not re-render it — its
 * props (project/selection/stable callbacks) only change on real edits.
 */
function BuilderInspectorPanelImpl({
  project,
  selection,
  update,
  snapOn,
  onToggleSnap,
  onRotate,
  onDuplicate,
  onRemove,
  onSelect,
  onHover,
  onGestureStart,
  hostPick,
  onStartPuzzleHostPick,
  onGuideGoal,
  onStartTool,
  onAddDoor,
}: BuilderInspectorPanelProps) {
  const { language } = useBuilderLanguage();
  const selectedRoom = selection?.kind === "room" ? project.rooms.find((room) => room.id === selection.id) ?? null : null;
  const selectedDoor = selection?.kind === "door" ? project.doors.find((door) => door.id === selection.id) ?? null : null;
  const selectedProp = selection?.kind === "prop" ? project.props.find((prop) => prop.id === selection.id) ?? null : null;
  const selectedPickup = selection?.kind === "pickup" ? (project.pickups ?? []).find((pickup) => pickup.id === selection.id) ?? null : null;
  const selectedRobot = selection?.kind === "robot" ? project.robots.find((robot) => robot.id === selection.id) ?? null : null;
  const selectedPuzzle = selection?.kind === "puzzle" ? puzzleById(project, selection.id) : null;
  const selectedRouteSwitch = selection?.kind === "routeSwitch" ? (project.routeSwitches ?? []).find((route) => route.id === selection.id) ?? null : null;
  const selectedWallDoorSwitch = selection?.kind === "wallDoorSwitch" ? (project.wallDoorSwitches ?? []).find((wallSwitch) => wallSwitch.id === selection.id) ?? null : null;

  return (
    <aside className={`builder-inspector ${selection ? "has-selection" : "idle"}`} aria-label={language === "en" ? "Properties panel" : "属性面板"}>
      {selection ? (
        <div className="builder-insp-header">
          {selectedProp ? (
            <span className="builder-insp-thumb">
              <AssetImageThumb modelKey={selectedProp.modelKey} />
            </span>
          ) : selectedPickup ? (
            <span className="builder-insp-thumb">
              <PickupImageThumb kind={selectedPickup.kind} />
            </span>
          ) : (
            <span className={`builder-insp-glyph ${selection.kind}`}>
              {selection.kind === "room"
                ? "▢"
                : selection.kind === "door"
                  ? "▣"
                  : selection.kind === "puzzle"
                    ? puzzleKindEntry(selectedPuzzle?.kind).glyph
                    : selection.kind === "prop"
                      ? "❑"
                      : selection.kind === "pickup"
                        ? "✚"
                        : selection.kind === "routeSwitch"
                          ? "⌁"
                          : selection.kind === "wallDoorSwitch"
                            ? "▥"
                            : "◆"}
            </span>
          )}
          <div className="builder-insp-title">
            <strong>
              {(selectedRoom ? bl(selectedRoom.label, language) : null) ??
                (selectedDoor ? bl(builderDoorDisplayLabel(selectedDoor, project), language) : null) ??
                (selectedPuzzle
                  ? selection?.kind === "puzzle" && selection.componentId
                    ? `${bl(puzzleKindEntry(selectedPuzzle.kind).label, language)} · ${language === "en" ? "Orb" : "色球"}`
                    : bl(puzzleKindEntry(selectedPuzzle.kind).label, language)
                  : null) ??
                (selectedProp ? bl(propEntry(selectedProp.modelKey)?.label, language) : null) ??
                (selectedPickup ? bl(pickupEntry(selectedPickup.kind).label, language) : null) ??
                selectedRouteSwitch?.label ??
                selectedWallDoorSwitch?.label ??
                (selectedRobot ? robotInspectorLabel(selectedRobot, language) : "")}
            </strong>
            <em>
              {selection.kind === "room"
                ? language === "en" ? "Room" : "房间"
                : selection.kind === "door"
                  ? selectedDoor?.lockType === "puzzle_complete"
                    ? language === "en" ? "Puzzle · Door" : "谜题 · 门"
                    : language === "en" ? "Door / Lock" : "门 / 锁"
                  : selection.kind === "puzzle"
                    ? selectedPuzzle?.kind === "archive_merge"
                      ? `${language === "en" ? "Puzzle · Target" : "谜题 · 目标"} ${normalizeArchiveMergeTarget(selectedPuzzle.archiveTargetValue)}`
                      : language === "en" ? "Puzzle" : "谜题"
                    : selection.kind === "prop"
                      ? propEntry(selectedProp?.modelKey ?? "")?.group === "故事线索"
                        ? language === "en" ? "Story Clue" : "故事线索"
                        : language === "en" ? "Furniture" : "家具"
                      : selection.kind === "pickup"
                        ? language === "en" ? "Pickup" : "拾取物"
                        : selection.kind === "routeSwitch"
                          ? language === "en" ? "Control Switch" : "管制机关"
                          : selection.kind === "wallDoorSwitch"
                            ? language === "en" ? "Wall Door Switch" : "墙面门控"
                          : language === "en" ? "Hostile Unit" : "敌对单位"}
            </em>
          </div>
          <div className="builder-insp-actions">
            {selection.kind === "prop" || selection.kind === "routeSwitch" || (selection.kind === "puzzle" && !selection.componentId) ? (
              <button type="button" title={language === "en" ? "Rotate 45° (R)" : "旋转 45° (R)"} onClick={onRotate}>
                ⟳
              </button>
            ) : null}
            {selection.kind !== "door" && selection.kind !== "routeSwitch" && selection.kind !== "wallDoorSwitch" ? (
              <button type="button" title={language === "en" ? "Duplicate (Cmd/Ctrl+R)" : "复制 (Cmd/Ctrl+R)"} onClick={onDuplicate}>
                ⧉
              </button>
            ) : null}
            <button type="button" className="builder-danger" title={language === "en" ? "Delete (Delete)" : "删除 (Delete)"} onClick={onRemove}>
              ✕
            </button>
          </div>
        </div>
      ) : null}
      {selectedRoom ? (
        <RoomInspector project={project} room={selectedRoom} onChange={update} onGestureStart={onGestureStart} onAddDoor={onAddDoor} />
      ) : selectedDoor ? (
        <DoorInspector project={project} door={selectedDoor} onChange={update} onSelect={onSelect} onHover={onHover} />
      ) : selectedProp ? (
        <PropInspector
          project={project}
          prop={selectedProp}
          onChange={update}
          snapOn={snapOn}
          onToggleSnap={onToggleSnap}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      ) : selectedPickup ? (
        <PickupInspector project={project} pickup={selectedPickup} onChange={update} />
      ) : selectedPuzzle ? (
        <PuzzleInspector
          project={project}
          instance={selectedPuzzle}
          componentId={selection?.kind === "puzzle" ? selection.componentId : undefined}
          onChange={update}
          onSelect={onSelect}
          onRemove={onRemove}
          hostPick={hostPick}
          onStartHostPick={onStartPuzzleHostPick}
        />
      ) : selectedRouteSwitch ? (
        <RouteSwitchInspector
          project={project}
          routeSwitch={selectedRouteSwitch}
          onChange={update}
          onSelect={onSelect}
          hostPick={hostPick}
          onStartHostPick={onStartPuzzleHostPick}
        />
      ) : selectedWallDoorSwitch ? (
        <WallDoorSwitchInspector project={project} wallSwitch={selectedWallDoorSwitch} onChange={update} onSelect={onSelect} />
      ) : selectedRobot ? (
        <RobotInspector project={project} robot={selectedRobot} onChange={update} onSelect={onSelect} onHover={onHover} />
      ) : (
        <ProjectInspector
          project={project}
          onChange={update}
          onGestureStart={onGestureStart}
          onGuideGoal={onGuideGoal}
          onStartTool={onStartTool}
        />
      )}
    </aside>
  );
}

export const BuilderInspectorPanel = memo(BuilderInspectorPanelImpl);

interface InspectorProps {
  onChange: BuilderUpdate;
}

/** Rotate a shaped room's footprint and keep its bbox `size` in sync. */
function rotateShaped(room: BuilderRoom, patch: (changes: Partial<BuilderRoom>) => void, deltaRad: number) {
  if (!room.shape) return;
  const nextShape = { ...room.shape, rotation: (room.shape.rotation ?? 0) + deltaRad };
  patch({ shape: nextShape, size: shapeBboxSize(nextShape) });
}

function RoomInspector({
  project,
  room,
  onChange,
  onGestureStart,
  onAddDoor,
}: InspectorProps & { project: BuilderProject; room: BuilderRoom; onGestureStart: () => void; onAddDoor?: (lockType?: BuilderDoor["lockType"]) => boolean }) {
  const { language } = useBuilderLanguage();
  const patch = (changes: Partial<BuilderRoom>) =>
    onChange((draft) => ({ ...draft, rooms: draft.rooms.map((candidate) => (candidate.id === room.id ? { ...candidate, ...changes } : candidate)) }));
  const patchEnv = (changes: Partial<BuilderRoomEnv>, options?: { record?: boolean }) =>
    onChange(
      (draft) => ({
        ...draft,
        rooms: draft.rooms.map((candidate) => (candidate.id === room.id ? { ...candidate, env: { ...candidate.env, ...changes } } : candidate)),
      }),
      options,
    );
  const floor = roomFloor(room);
  const wall = roomWall(room);
  const ceiling = roomCeiling(room);
  const overlapping = project.rooms.find((other) => other.id !== room.id && roomsOverlap(room, other));
  const connected = project.doors.some((door) => door.fromRoomId === room.id || door.toRoomId === room.id);
  const isSpawn = project.rooms[0]?.id === room.id;
  const isExit = project.exitRoomId === room.id;
  const furnitureCount = project.props.filter((prop) => prop.roomId === room.id).length;
  const storyCount = project.props.filter(
    (prop) => prop.roomId === room.id && propEntry(prop.modelKey)?.group === "故事线索",
  ).length;
  const puzzleCount = project.doors.filter(
    (door) => door.lockType === "puzzle_complete" && (door.puzzleRoomId ?? door.fromRoomId) === room.id,
  ).length;
  return (
    <div className="builder-fields">
      {/* hero summary: what this room IS at a glance */}
      <div className="builder-insp-tags">
        {isSpawn ? <i className="t-spawn">◉ {language === "en" ? "Spawn" : "出生"}</i> : null}
        {isExit ? <i className="t-exit">🛗 {language === "en" ? "Elevator Exit" : "电梯出口"}</i> : null}
        <i>
          {room.size[0]}×{room.size[1]}m
        </i>
        <i className={ceiling.visible ? "t-ceiling-on" : ""}>{ceiling.visible ? `⬓ ${language === "en" ? "Ceiling" : "顶"} ${ceiling.height.toFixed(1)}m` : (language === "en" ? "⬒ No Ceiling" : "⬒ 无顶")}</i>
        <i>❑ {furnitureCount}</i>
        {puzzleCount > 0 ? <i className="t-puzzle">◈ {language === "en" ? "Puzzles" : "谜题台"} {puzzleCount}</i> : null}
        {storyCount > 0 ? <i className="t-story">🖼 {storyCount}</i> : null}
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Basics" : "基础"}</h3>
        <label>
          <span>{language === "en" ? "Name" : "名称"}</span>
          <input value={room.label} onChange={(event) => patch({ label: event.target.value })} />
        </label>
        <span className="builder-field-label">{isExit ? (language === "en" ? "Exit Style (Elevator, auto-applied)" : "出口样式（电梯，自动应用）") : (language === "en" ? "Style" : "风格")}</span>
        {isExit ? (
          <div className="builder-exit-style-lock">🛗 {language === "en" ? "The exit room always uses the elevator style; the closing elevator door is applied automatically during playtest." : "出口房间固定采用电梯样式，试玩时自动应用闭馆电梯门。"}</div>
        ) : (
          <div className="builder-stylechips">
            {builderRoomStyles.map((entry) => (
              <button
                key={entry.style}
                type="button"
                className={room.style === entry.style ? "active" : ""}
                title={bl(entry.label, language)}
                onClick={() => patch({ style: entry.style })}
              >
                <RoomStyleThumb style={entry.style} />
                <span>{bl(entry.label, language).slice(0, language === "en" ? 12 : 4)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="builder-card">
        <h3>{room.shape ? (language === "en" ? "Shape · Rotation" : "形状 · 旋转") : (language === "en" ? "Size" : "尺寸")}</h3>
        {room.shape ? (
          <>
            <AngleControl
              label={language === "en" ? "Rotation" : "转向"}
              valueRad={room.shape.rotation ?? 0}
              onChange={(value) => {
                const nextShape = { ...room.shape!, rotation: value };
                patch({ shape: nextShape, size: shapeBboxSize(nextShape) });
              }}
            />
            <div className="builder-row">
              <button type="button" className="builder-building-rotate" title={language === "en" ? "Counter-clockwise 15°" : "逆时针 15°"} onClick={() => rotateShaped(room, patch, -Math.PI / 12)}>
                ⟲ 15°
              </button>
              <button type="button" className="builder-building-rotate" title={language === "en" ? "Clockwise 15°" : "顺时针 15°"} onClick={() => rotateShaped(room, patch, Math.PI / 12)}>
                ⟳ 15°
              </button>
              <button type="button" className="builder-building-rotate" title={language === "en" ? "Counter-clockwise 90°" : "逆时针 90°"} onClick={() => rotateShaped(room, patch, -Math.PI / 2)}>
                ⟲ 90°
              </button>
              <button type="button" className="builder-building-rotate" title={language === "en" ? "Clockwise 90°" : "顺时针 90°"} onClick={() => rotateShaped(room, patch, Math.PI / 2)}>
                ⟳ 90°
              </button>
            </div>
            <p className="builder-hint">{language === "en" ? "Triangle and semicircle rooms have a clear flat wall for doors. Move/rotate until the flat edge touches a neighbor, then add a door." : "三角房和半圆厅都有明确的平直门墙。移动/旋转到平边贴住邻室后即可加门。"}</p>
          </>
        ) : (
          <div className="builder-row">
            <Stepper label={language === "en" ? "Width (m)" : "宽 (米)"} value={room.size[0]} min={4} max={20} step={1} onChange={(value) => patch({ size: [value, room.size[1]] })} />
            <Stepper label={language === "en" ? "Depth (m)" : "深 (米)"} value={room.size[1]} min={4} max={20} step={1} onChange={(value) => patch({ size: [room.size[0], value] })} />
          </div>
        )}
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Position" : "位置"}</h3>
        <div className="builder-row">
          <Stepper label={language === "en" ? "X (m)" : "X (米)"} value={room.center[0]} min={-80} max={80} step={1} decimals={0} onChange={(value) => patch({ center: [value, room.center[1]] })} />
          <Stepper label={language === "en" ? "Z (m)" : "Z (米)"} value={room.center[1]} min={-80} max={80} step={1} decimals={0} onChange={(value) => patch({ center: [room.center[0], value] })} />
        </div>
        <p className="builder-hint">{language === "en" ? "You can also drag the room body in 2D, or use the center pad/arrows in 3D." : "也可以在 2D 直接拖房间，或在 3D 用中心圆盘/箭头移动。"}</p>
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Role" : "角色"}</h3>
        <div className="builder-flagrow">
          <span className={`builder-flag spawn ${isSpawn ? "on" : ""}`}>◉ {language === "en" ? "Spawn Point" : "出生点"}</span>
          <span className={`builder-flag exit ${isExit ? "on" : ""}`}>🛗 {language === "en" ? "Elevator Exit" : "电梯出口"}</span>
        </div>
        <div className="builder-row">
          <button
            type="button"
            disabled={isSpawn}
            title={language === "en" ? "Set this room as the player spawn (moves it to the top of the room list)" : "把这个房间设为玩家出生点（移动到房间列表首位）"}
            onClick={() =>
              onChange((draft) => ({
                ...draft,
                rooms: [room, ...draft.rooms.filter((candidate) => candidate.id !== room.id)],
              }))
            }
          >
            ◉ {language === "en" ? "Set as Spawn" : "设为出生点"}
          </button>
          <button type="button" disabled={isExit} onClick={() => onChange((draft) => ({ ...draft, exitRoomId: room.id }))}>
            🛗 {language === "en" ? "Set as Elevator Exit" : "设为电梯出口"}
          </button>
        </div>
      </div>
      <CollapsibleCard title={language === "en" ? "Floor" : "地板"} badge={bl(floor.preset.label, language)}>
        <div className="builder-swatchrow">
          {builderFloorPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={floor.preset.id === preset.id ? "active" : ""}
              title={bl(preset.label, language)}
              onClick={() =>
                patchEnv({
                  surfaceOverrides: surfaceOverridesWithPreset(room.env?.surfaceOverrides, "floor", preset.id),
                  floorPresetId: preset.id,
                  floorColor: undefined,
                })
              }
            >
              <SurfaceSwatch preset={preset} />
            </button>
          ))}
        </div>
        <span className="builder-field-label">{language === "en" ? "Tint" : "色调"}</span>
        <ColorChips colors={surfaceColorChips} value={room.env?.floorColor} onChange={(color) => patchEnv({ floorColor: color })} />
        <SliderField
          label={language === "en" ? "Texture Scale" : "纹理缩放"}
          value={floor.scale}
          min={0.5}
          max={3}
          step={0.25}
          unit="×"
          decimals={2}
          onStart={onGestureStart}
          onChange={(value) => patchEnv({ floorScale: value }, { record: false })}
        />
        <span className="builder-field-label">{language === "en" ? "Texture Rotation" : "纹理旋转"}</span>
        <div className="builder-segment">
          {([0, 90, 180, 270] as const).map((rotation) => (
            <button key={rotation} type="button" className={floor.rotation === rotation ? "active" : ""} onClick={() => patchEnv({ floorRotation: rotation })}>
              {rotation}°
            </button>
          ))}
        </div>
      </CollapsibleCard>
      <CollapsibleCard title={language === "en" ? "Walls" : "墙壁"} badge={bl(wall.preset.label, language)}>
        <div className="builder-swatchrow">
          {builderWallPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={wall.preset.id === preset.id ? "active" : ""}
              title={bl(preset.label, language)}
              onClick={() =>
                patchEnv({
                  surfaceOverrides: surfaceOverridesWithPreset(room.env?.surfaceOverrides, "wall", preset.id),
                  wallPresetId: preset.id,
                  wallColor: undefined,
                })
              }
            >
              <SurfaceSwatch preset={preset} />
            </button>
          ))}
        </div>
        <span className="builder-field-label">{language === "en" ? "Tint" : "色调"}</span>
        <ColorChips colors={surfaceColorChips} value={room.env?.wallColor} onChange={(color) => patchEnv({ wallColor: color })} />
        <SliderField
          label={language === "en" ? "Wall Height" : "墙高"}
          value={wall.height}
          min={0.8}
          max={3.6}
          step={0.1}
          unit="m"
          decimals={1}
          onStart={onGestureStart}
          onChange={(value) => patchEnv({ wallHeight: value }, { record: false })}
        />
      </CollapsibleCard>
      <CollapsibleCard title={language === "en" ? "Ceiling" : "天花板"} badge={ceiling.visible ? bl(ceiling.preset.label, language) : (language === "en" ? "Off" : "关闭")}>
        <div className="builder-flagrow">
          <ToggleChip label={language === "en" ? "Show Ceiling" : "显示天花板"} on={ceiling.visible} onToggle={() => patchEnv({ ceilingVisible: !ceiling.visible })} />
        </div>
        <SliderField
          label={language === "en" ? "Height" : "高度"}
          value={ceiling.height}
          min={2}
          max={4}
          step={0.1}
          unit="m"
          decimals={1}
          onStart={onGestureStart}
          onChange={(value) => patchEnv({ ceilingHeight: value }, { record: false })}
        />
        <div className="builder-swatchrow">
          {builderCeilingPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={ceiling.preset.id === preset.id ? "active" : ""}
              title={bl(preset.label, language)}
              onClick={() =>
                patchEnv({
                  surfaceOverrides: surfaceOverridesWithPreset(room.env?.surfaceOverrides, "ceiling", preset.id),
                  ceilingPresetId: preset.id,
                  ceilingColor: undefined,
                })
              }
            >
              <SurfaceSwatch preset={preset} />
            </button>
          ))}
        </div>
        <span className="builder-field-label">{language === "en" ? "Tint" : "色调"}</span>
        <ColorChips colors={surfaceColorChips} value={room.env?.ceilingColor} onChange={(color) => patchEnv({ ceilingColor: color })} />
        <p className="builder-hint">{language === "en" ? "Shown semi-transparent in 3D; auto-hidden when the room is selected so it never blocks picking." : "3D 中半透明显示，选中房间时自动隐藏，不挡选取。"}</p>
      </CollapsibleCard>
      {overlapping ? <InspectorHint tone="warn">{language === "en" ? `⚠ Overlaps "${bl(overlapping.label, language)}"; drag them apart or shrink one.` : `⚠ 与「${overlapping.label}」重叠，拖开或缩小其中一间。`}</InspectorHint> : null}
      {!connected && project.rooms.length > 1 ? (
        <div className="builder-room-door-fix">
          <InspectorHint tone="warn">{language === "en" ? "⚠ This room has no door yet, so the player can't enter." : "⚠ 这个房间还没有门，玩家进不来。"}</InspectorHint>
          <button type="button" onClick={() => onAddDoor?.("none")}>
            ▣ {language === "en" ? "Auto Door" : "自动装门"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DoorInspector({
  project,
  door,
  onChange,
  onSelect,
  onHover,
}: InspectorProps & { project: BuilderProject; door: BuilderDoor; onSelect: (selection: BuilderSelection) => void; onHover?: (selection: BuilderSelection) => void }) {
  const { language } = useBuilderLanguage();
  const patchDoor = (changes: Partial<BuilderDoor>) =>
    onChange((draft) => ({ ...draft, doors: draft.doors.map((candidate) => (candidate.id === door.id ? { ...candidate, ...changes } : candidate)) }));
  const roomOptions = project.rooms.map((room) => (
    <option key={room.id} value={room.id}>
      {bl(room.label, language)}
    </option>
  ));
  const linkedPuzzle = puzzleForDoor(project, door.id);
  const fromRoom = project.rooms.find((room) => room.id === door.fromRoomId);
  const toRoom = project.rooms.find((room) => room.id === door.toRoomId);
  const valid = fromRoom && toRoom && sharedEdge(fromRoom, toRoom);
  const isExitDoor = door.toRoomId === project.exitRoomId || door.fromRoomId === project.exitRoomId;
  const guardRobots = [...project.robots]
    .map((robot) => ({ robot, distance: robotDistanceToDoor(project, door, robot) }))
    .sort((left, right) => left.distance - right.distance || robotInspectorLabel(left.robot, language).localeCompare(robotInspectorLabel(right.robot, language), language))
    .map((entry) => entry.robot);
  const explicitGuardIds = builderDoorSurviveRobotIds(door);
  const authoredWaveIds = builderDoorWaveIds(door);
  const waveOptions = builderWaveDoorOptions(project);
  const selectedGuardIds = builderDoorSelectedGuardIds(door, project.robots);
  const selectedGuardRobots = selectedGuardIds.map((robotId) => project.robots.find((robot) => robot.id === robotId)).filter((robot): robot is BuilderProject["robots"][number] => Boolean(robot));
  const wallDoorSwitches = project.wallDoorSwitches ?? [];
  const selectedWallSwitch = door.wallDoorSwitchId ? wallDoorSwitches.find((wallSwitch) => wallSwitch.id === door.wallDoorSwitchId) ?? null : null;
  const coreLockTypes = (Object.keys(builderLockLabels) as BuilderDoor["lockType"][]).filter((lockType) => lockType !== "switch_state" || door.lockType === "switch_state");
  const wallMechanismControllers = wallDoorSwitches.filter((wallSwitch) => controlledDoorIdsForWallDoorSwitch(wallSwitch).includes(door.id));
  const routeMechanismControllers = (project.routeSwitches ?? []).flatMap((route) =>
    route.outputs.flatMap((output, index) =>
      output.kind === "open_door" && output.doorId === door.id
        ? [{ route, output, index }]
        : [],
    ),
  );
  const mechanismControllerCount = wallMechanismControllers.length + routeMechanismControllers.length;
  const toggleGuardRobot = (robotId: string) => {
    const selected = new Set(explicitGuardIds);
    const waveIds = new Set(authoredWaveIds);
    const robot = project.robots.find((candidate) => candidate.id === robotId);
    const robotWaveId = robot ? builderRobotAuthoredWaveId(robot) : undefined;
    if (selected.has(robotId)) selected.delete(robotId);
    else if (robotWaveId && waveIds.has(robotWaveId)) waveIds.delete(robotWaveId);
    else selected.add(robotId);
    const nextIds = guardRobots.map((candidate) => candidate.id).filter((id) => selected.has(id));
    const nextWaveIds = waveOptions.map((option) => option.waveId).filter((id) => waveIds.has(id));
    patchDoor({
      surviveRobotIds: nextIds,
      surviveRobotId: nextIds[0],
      waveIds: nextWaveIds,
      waveId: nextWaveIds[0],
    });
  };
  const toggleWave = (waveId: string) => {
    const selected = new Set(authoredWaveIds);
    if (selected.has(waveId)) selected.delete(waveId);
    else selected.add(waveId);
    const nextIds = waveOptions.map((option) => option.waveId).filter((id) => selected.has(id));
    patchDoor({
      waveIds: nextIds,
      waveId: nextIds[0],
    });
  };
  return (
    <div className="builder-fields">
      {!valid ? <InspectorHint tone="warn">{language === "en" ? "⚠ The two rooms share no edge (they must touch for ≥3.4 m). Drag the rooms so they sit flush." : "⚠ 两个房间没有共享边（需要贴合 ≥3.4 米）。拖动房间使它们贴在一起。"}</InspectorHint> : null}
      <div className="builder-card">
        <h3>{language === "en" ? "Connection" : "连接"}</h3>
        <label>
          <span>{language === "en" ? "Door Name" : "门名"}</span>
          <input
            value={door.label ?? ""}
            placeholder={bl(builderDoorEndpointLabel(door, project), language)}
            onChange={(event) => patchDoor({ label: event.target.value.trim() ? event.target.value : undefined })}
          />
        </label>
        <div className="builder-row">
          <label>
            <span>{language === "en" ? "Room A" : "房间 A"}</span>
            <select value={door.fromRoomId} onChange={(event) => patchDoor({ fromRoomId: event.target.value })}>
              {roomOptions}
            </select>
          </label>
          <label>
            <span>{language === "en" ? "Room B" : "房间 B"}</span>
            <select value={door.toRoomId} onChange={(event) => patchDoor({ toRoomId: event.target.value })}>
              {roomOptions}
            </select>
          </label>
        </div>
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Lock Type" : "锁类型"}</h3>
        <div className="builder-lockgrid">
          {coreLockTypes.map((lockType) => (
            <button
              key={lockType}
              type="button"
              className={door.lockType === lockType ? "active" : ""}
              style={{ color: lockColors[lockType] }}
              onClick={() =>
                onChange((draft) => {
                  const targetDoor = draft.doors.find((candidate) => candidate.id === door.id);
                  const existingSwitchIsValid =
                    targetDoor?.wallDoorSwitchId !== undefined &&
                    (draft.wallDoorSwitches ?? []).some((wallSwitch) => wallSwitch.id === targetDoor.wallDoorSwitchId);
                  if (lockType === "switch_state" && targetDoor && !existingSwitchIsValid) {
                    const switchRoom = draft.rooms.find((room) => room.id === targetDoor.fromRoomId);
                    const otherRoom = draft.rooms.find((room) => room.id === targetDoor.toRoomId);
                    const doorEdge = switchRoom && otherRoom ? sharedEdge(switchRoom, otherRoom) : null;
                    if (switchRoom && doorEdge) {
                      const createdWallSwitch = createDedicatedWallDoorSwitch(targetDoor, switchRoom, doorEdge);
                      return applyToggleDoorOwnership(
                        { ...draft, wallDoorSwitches: [...(draft.wallDoorSwitches ?? []), createdWallSwitch] },
                        createdWallSwitch.id,
                        targetDoor.id,
                      );
                    }
                  }
                  const next = {
                    ...draft,
                    doors: draft.doors.map((candidate) =>
                      candidate.id === door.id
                        ? {
                            ...candidate,
                            lockType,
                            ...(lockType !== "survive_wave" ? { surviveRobotId: undefined, surviveRobotIds: undefined, waveId: undefined, waveIds: undefined } : {}),
                            ...(lockType !== "puzzle_complete" ? { puzzleKind: undefined, puzzleRoomId: undefined } : {}),
                            ...(lockType === "switch_state"
                              ? {
                                  wallDoorSwitchId: existingSwitchIsValid && candidate.lockType === "switch_state" ? candidate.wallDoorSwitchId : undefined,
                                  wallDoorSwitchStateId: existingSwitchIsValid && candidate.lockType === "switch_state" ? candidate.wallDoorSwitchStateId : undefined,
                                }
                              : { wallDoorSwitchId: undefined, wallDoorSwitchStateId: undefined }),
                          }
                        : candidate,
                    ),
                    // Leaving puzzle lock: remove the now-orphan instance.
                    ...(lockType !== "puzzle_complete"
                      ? { puzzles: (draft.puzzles ?? []).filter((instance) => instance.linkedDoorId !== door.id) }
                      : {}),
                  };
                  // Entering puzzle lock: synthesize a default color instance.
                  return lockType === "puzzle_complete" ? normalizeBuilderPuzzles(next) : next;
                })
              }
            >
              <i>{lockGlyph(lockType, language)}</i>
              <span>{bl(builderLockLabels[lockType], language)}</span>
            </button>
          ))}
        </div>
        {door.lockType === "key_item" ? (
          <label>
            <span>{language === "en" ? "Key Placed In" : "钥匙放在"}</span>
            <select value={door.keyRoomId ?? project.rooms[0]?.id} onChange={(event) => onChange((draft) => moveKeyPickupForDoor(draft, door.id, event.target.value))}>
              {roomOptions}
            </select>
          </label>
        ) : null}
        {door.lockType === "survive_wave" ? (
          <div className="builder-door-guard">
            <div className="builder-door-guard-head">
              <span>{language === "en" ? "Guard Robots" : "守门机器人"}</span>
              <button type="button" onClick={() => patchDoor({ surviveRobotIds: [], surviveRobotId: undefined, waveIds: undefined, waveId: undefined })}>
                {language === "en" ? "Auto" : "自动"}
              </button>
            </div>
            {guardRobots.length > 0 ? (
              <div className="builder-door-guard-grid">
                {guardRobots.map((robot) => {
                  const selected = selectedGuardIds.includes(robot.id);
                  const explicit = explicitGuardIds.includes(robot.id);
                  const waveSelected = Boolean(builderRobotAuthoredWaveId(robot) && authoredWaveIds.includes(builderRobotAuthoredWaveId(robot) ?? ""));
                  const roomLabel = project.rooms.find((room) => room.id === robot.roomId)?.label ?? robot.roomId;
                  const distance = robotDistanceToDoor(project, door, robot);
                  return (
                    <button
                      key={robot.id}
                      type="button"
                      className={`${selected ? "active" : ""} ${waveSelected && !explicit ? "wave-active" : ""}`}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey) onSelect({ kind: "robot", id: robot.id });
                        else toggleGuardRobot(robot.id);
                      }}
                      onMouseEnter={() => onHover?.({ kind: "robot", id: robot.id })}
                      onMouseLeave={() => onHover?.(null)}
                      title={`${builderRobotGuardLabel(robot, project, language)} · ${language === "en" ? "Cmd/Ctrl-click to select" : "Cmd/Ctrl 点击选中"}`}
                    >
                      <RobotThumb archetype={robot.archetype} />
                      <strong>{robotInspectorLabel(robot, language)}</strong>
                      <span>{builderRobotWaveSummary(robot, language)} · {roomLabel}</span>
                      <small>{language === "en" ? `${distance.toFixed(1)}m` : `${distance.toFixed(1)} 米`}</small>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {waveOptions.length > 0 ? (
              <div className="builder-door-wave-locks">
                <span>{language === "en" ? "Open After Waves" : "开门波次"}</span>
                <div>
                  {waveOptions.map((option) => {
                    const selectedByWave = authoredWaveIds.includes(option.waveId);
                    const selectedByRobot = option.robotIds.some((robotId) => explicitGuardIds.includes(robotId));
                    return (
                      <button
                        key={option.waveId}
                        type="button"
                        className={`${selectedByWave || selectedByRobot ? "active" : ""} ${selectedByWave ? "explicit" : ""}`}
                        onClick={() => toggleWave(option.waveId)}
                        title={language === "en" ? "Door opens only after every selected wave is cleared." : "门会在所有选中的波次清完后打开。"}
                      >
                        <b>{language === "en" ? `Wave ${option.order}` : `波次 ${option.order}`}</b>
                        <small>{option.robotIds.length} {language === "en" ? "group(s)" : "组"}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {selectedGuardRobots.length > 0 ? (
              <InspectorHint tone="ok">
                {language === "en"
                  ? `✓ Door opens after ${selectedGuardRobots.length} selected group(s) are cleared.`
                  : `✓ 清掉已选 ${selectedGuardRobots.length} 组机器人后开门。`}
              </InspectorHint>
            ) : project.robots.some((robot) => robot.roomId === door.fromRoomId) ? (
              <InspectorHint tone="ok">{language === "en" ? 'Legacy auto mode: Room A has robots, so the door uses that room wave.' : "兼容自动模式：「房间 A」已有机器人，门会使用该房间波次。"}</InspectorHint>
            ) : (
              <InspectorHint tone="warn">{language === "en" ? 'Pick one or more guard robots. Auto mode currently finds no robots in Room A.' : "请选择一组或多组守门机器人。自动模式现在找不到「房间 A」机器人。"}</InspectorHint>
            )}
          </div>
        ) : null}
        {door.lockType === "switch_state" ? (
          <div className="builder-door-guard">
            <div className="builder-door-guard-head">
              <span>{language === "en" ? "Wall Door Switch" : "墙面门控"}</span>
              <button type="button" disabled={!selectedWallSwitch} onClick={() => selectedWallSwitch && onSelect({ kind: "wallDoorSwitch", id: selectedWallSwitch.id })}>
                {language === "en" ? "Select" : "选中"}
              </button>
            </div>
            {wallDoorSwitches.length > 0 ? (
              <>
                <label>
                  <span>{language === "en" ? "Switch" : "门控把手"}</span>
                  <select
                    value={door.wallDoorSwitchId ?? ""}
                    onChange={(event) => {
                      const nextSwitch = wallDoorSwitches.find((wallSwitch) => wallSwitch.id === event.target.value);
                      patchDoor({
                        wallDoorSwitchId: event.target.value || undefined,
                        wallDoorSwitchStateId: nextSwitch?.states[1]?.id ?? nextSwitch?.states[0]?.id,
                      });
                    }}
                  >
                    <option value="">{language === "en" ? "Choose a switch..." : "选择门控把手..."}</option>
                    {wallDoorSwitches.map((wallSwitch) => (
                      <option key={wallSwitch.id} value={wallSwitch.id}>
                        {wallSwitch.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{language === "en" ? "Required State" : "解锁状态"}</span>
                  <select
                    value={door.wallDoorSwitchStateId ?? ""}
                    disabled={!selectedWallSwitch}
                    onChange={(event) => patchDoor({ wallDoorSwitchStateId: event.target.value || undefined })}
                  >
                    {selectedWallSwitch ? (
                      selectedWallSwitch.states.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.label}
                        </option>
                      ))
                    ) : (
                      <option value="">{language === "en" ? "Choose a switch first" : "先选择门控"}</option>
                    )}
                  </select>
                </label>
                {selectedWallSwitch ? (
                  <InspectorHint tone="ok">
                    {language === "en"
                      ? "The player can still press the switch again to return to the previous state."
                      : "玩家按过一次后还能再按，门控会切回上一个状态。"}
                  </InspectorHint>
                ) : (
                  <InspectorHint tone="warn">
                    {valid
                      ? language === "en"
                        ? "This door is not bound yet. Click the Wall Door Switch lock again to create its dedicated handle, or explicitly choose an existing one here."
                        : "这扇门还没绑定把手。再点一次「墙面门控」会新建专属把手；也可以在这里明确选择已有把手。"
                      : language === "en"
                        ? "This door needs a valid shared wall before a handle can be placed."
                        : "这扇门两侧房间需要有效贴边，才能自动把把手放到墙上。"}
                  </InspectorHint>
                )}
              </>
            ) : (
              <InspectorHint tone="warn">
                {valid
                  ? language === "en"
                    ? "Click the Wall Door Switch lock again to create this door's dedicated handle."
                    : "再点一次「墙面门控」会给这扇门新建专属墙上把手。"
                  : language === "en"
                    ? "This door needs a valid shared wall before a handle can be placed."
                    : "这扇门两侧房间需要有效贴边，才能自动把把手放到墙上。"}
              </InspectorHint>
            )}
          </div>
        ) : null}
      </div>
      <div className="builder-card builder-door-control-card mechanism">
        <div className="builder-door-control-head">
          <h3>{language === "en" ? "Mechanism Control" : "机关控制"}</h3>
          <span>{mechanismControllerCount}</span>
        </div>
        {mechanismControllerCount > 0 ? (
          <>
            <div className="builder-door-control-list">
              {wallMechanismControllers.map((wallSwitch) => {
                const states = effectiveWallDoorSwitchStates(wallSwitch);
                const openCount = states.filter((state) => state.openDoorIds?.includes(door.id)).length;
                const closeCount = states.filter((state) => state.closeDoorIds?.includes(door.id)).length;
                return (
                  <button key={wallSwitch.id} type="button" onClick={() => onSelect({ kind: "wallDoorSwitch", id: wallSwitch.id })}>
                    <i>控</i>
                    <strong>{wallSwitch.label}</strong>
                    <span>{language === "en" ? `Wall switch · Open ${openCount} · Close ${closeCount}` : `墙控把手 · 开 ${openCount} · 关 ${closeCount}`}</span>
                  </button>
                );
              })}
              {routeMechanismControllers.map(({ route, output, index }) => (
                <button key={`${route.id}:${output.id}`} type="button" onClick={() => onSelect({ kind: "routeSwitch", id: route.id })}>
                  <i>路</i>
                  <strong>{route.label}</strong>
                  <span>{language === "en" ? `Output ${index + 1}: ${output.label?.trim() || "Open door"}` : `输出 ${index + 1}：${output.label?.trim() || "开门"}`}</span>
                </button>
              ))}
            </div>
            <p className="builder-hint">
              {language === "en"
                ? "Route consoles and wall switches are mechanism controllers: they can reopen this door only after its key, puzzle, or combat lock is satisfied."
                : "路由台和墙控属于机关控制：它们只会在这扇门的钥匙、谜题或清怪条件满足后重新开门。"}
            </p>
          </>
        ) : (
          <InspectorHint tone="ok">
            {language === "en"
              ? "No mechanism currently controls this door. Drag a wall switch or bind a route-console output to add one."
              : "目前没有机关控制这扇门。可以拖入墙控把手，或把路由台输出绑定到这扇门。"}
          </InspectorHint>
        )}
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Door Family (Look)" : "门族（外观）"}</h3>
        {isExitDoor ? (
          <InspectorHint tone="ok">{language === "en" ? "✓ This door leads to the exit and always uses the closing elevator look (door family has no effect)." : "✓ 这扇门通向出口，始终使用闭馆电梯门外观（门族不生效）。"}</InspectorHint>
        ) : (
          <>
            <div className="builder-doorfamily-grid">
              {builderDoorFamilies.map((entry) => {
                const active = (door.doorFamily ?? "auto") === entry.family;
                return (
                  <button
                    key={entry.family}
                    type="button"
                    className={active ? "active" : ""}
                    style={{ color: entry.accentColor }}
                    onClick={() => patchDoor({ doorFamily: entry.family })}
                  >
                    <span className="builder-doorfamily-swatch" style={{ background: entry.accentColor }} />
                    <span>{bl(entry.label, language)}</span>
                  </button>
                );
              })}
            </div>
            <p className="builder-hint">{language === "en" ? '"Auto" picks the door by lock state; the others swap in the matching advanced door family (residential / clinic / reclamation / industrial / elevator).' : "「自动」按锁状态选门；其它选项换成对应高级门族（住宅 / 诊疗 / 回收 / 工业 / 电梯）。"}</p>
          </>
        )}
      </div>
      <div className="builder-card builder-puzzle-door-card builder-door-control-card puzzle">
        <div className="builder-door-control-head">
          <h3>{language === "en" ? "Puzzle Control" : "谜题控制"}</h3>
          <span>{linkedPuzzle ? 1 : 0}</span>
        </div>
          {linkedPuzzle ? (
            <>
              <p className="builder-puzzle-chain" style={{ color: puzzleKindEntry(linkedPuzzle.kind).color }}>
                <i>{puzzleKindEntry(linkedPuzzle.kind).glyph}</i> {bl(puzzleKindEntry(linkedPuzzle.kind).label, language)} → {language === "en" ? "opens this door when solved" : "解开后打开这扇门"}
              </p>
              <p className="builder-hint">
                {language === "en"
                  ? `Puzzle station is in "${project.rooms.find((room) => room.id === linkedPuzzle.roomId)?.label ?? (language === "en" ? "Unknown Room" : "未知房间")}".`
                  : `谜题台在「${project.rooms.find((room) => room.id === linkedPuzzle.roomId)?.label ?? "未知房间"}」。`}
                {linkedPuzzle.kind === "color_sequence" ? (language === "en" ? ` ${linkedPuzzle.components?.length ?? 0} orbs.` : `色球 ${linkedPuzzle.components?.length ?? 0} 个。`) : ""}
                {linkedPuzzle.kind === "archive_merge" ? (language === "en" ? ` Target ${normalizeArchiveMergeTarget(linkedPuzzle.archiveTargetValue)}.` : `目标 ${normalizeArchiveMergeTarget(linkedPuzzle.archiveTargetValue)}。`) : ""}
              </p>
              {linkedPuzzle.kind === "archive_merge" ? (
                <ArchiveMergeTargetControl
                  compact
                  value={linkedPuzzle.archiveTargetValue}
                  onChange={(value) =>
                    onChange((draft) => ({
                      ...draft,
                      puzzles: (draft.puzzles ?? []).map((instance) =>
                        instance.id === linkedPuzzle.id ? { ...instance, archiveTargetValue: value } : instance,
                      ),
                    }))
                  }
                />
              ) : null}
              <button type="button" onClick={() => onSelect({ kind: "puzzle", id: linkedPuzzle.id })}>
                {puzzleKindEntry(linkedPuzzle.kind).glyph} {language === "en" ? "Select Puzzle Station (change type / color / position)" : "选中谜题台（改类型 / 颜色 / 位置）"}
              </button>
            </>
          ) : (
            <InspectorHint tone={door.lockType === "puzzle_complete" ? "warn" : "ok"}>
              {door.lockType === "puzzle_complete"
                ? language === "en"
                  ? 'This door is marked as puzzle-locked but has no puzzle station yet. Bind one from the Puzzle catalog.'
                  : "这扇门标记为谜题锁，但还没有谜题台。请从「谜题」目录绑定一个。"
                : language === "en"
                  ? "No puzzle currently controls this door."
                  : "目前没有谜题控制这扇门。"}
            </InspectorHint>
          )}
      </div>
    </div>
  );
}

function valveWallInspectorSource(source: BuilderPuzzleInstance["sourceInteraction"]): BuilderPuzzleInstance["sourceInteraction"] {
  const { hostPropId: _hostPropId, visualKey: _visualKey, ...rest } = source ?? {};
  return {
    ...rest,
    radius: Math.max(source?.radius ?? valveMatrixInteractionRadius, valveMatrixInteractionRadius),
    visualKey: "puzzle_console_valve_matrix",
    materialKey: source?.materialKey ?? "terminal_cyan",
  };
}

/** Selected puzzle: kind, linked door, terminal transform, color orbs, safe delete. */
function PuzzleInspector({
  project,
  instance,
  componentId,
  onChange,
  onSelect,
  onRemove,
  hostPick,
  onStartHostPick,
}: InspectorProps & {
  project: BuilderProject;
  instance: BuilderPuzzleInstance;
  componentId?: string;
  onSelect: (selection: BuilderSelection) => void;
  onRemove: () => void;
  hostPick?: BuilderPuzzleHostPick | null;
  onStartHostPick?: (request: BuilderPuzzleHostPick) => void;
}) {
  const { language } = useBuilderLanguage();
  const entry = puzzleKindEntry(instance.kind);
  const resultMode = puzzleResultMode(instance);
  const room = project.rooms.find((candidate) => candidate.id === instance.roomId);
  const door = project.doors.find((candidate) => candidate.id === instance.linkedDoorId);
  const components = instance.components ?? [];
  const valveTimeLimitSec = normalizeValveMatrixTimeLimit(instance.timeLimitSec);
  const patchInstance = (changes: Partial<BuilderPuzzleInstance>) =>
    onChange((draft) => ({
      ...draft,
      puzzles: (draft.puzzles ?? []).map((candidate) => (candidate.id === instance.id ? { ...candidate, ...changes } : candidate)),
    }));

  const changeKind = (kind: BuilderPuzzleInstance["kind"]) => {
    if (kind === instance.kind) return;
    onChange((draft) => {
      const linkedDoor = draft.doors.find((candidate) => candidate.id === instance.linkedDoorId);
      if (!linkedDoor) return draft;
      const rebuilt = {
        ...createPuzzleInstanceForDoor(draft, linkedDoor, kind, { roomId: instance.roomId, position: instance.position }),
        id: instance.id,
        resultMode: instance.resultMode,
        interactionId: instance.interactionId,
        successOutputs: instance.successOutputs,
        requiredStoryPropIds: instance.requiredStoryPropIds,
        rotationY: instance.rotationY,
      };
      return {
        ...draft,
        puzzles: (draft.puzzles ?? []).map((candidate) => (candidate.id === instance.id ? rebuilt : candidate)),
        doors: draft.doors.map((candidate) =>
          candidate.id === instance.linkedDoorId ? { ...candidate, puzzleKind: kind === "color_sequence" ? undefined : kind } : candidate,
        ),
      };
    });
  };

  const relinkDoor = (doorId: string) => {
    if (doorId === instance.linkedDoorId) return;
    onChange((draft) => ({
      ...draft,
      doors: draft.doors.map((candidate) =>
        candidate.id === doorId
          ? resultMode === "grant_key"
            ? { ...candidate, lockType: "key_item" as const, puzzleKind: undefined, puzzleRoomId: undefined }
            : { ...candidate, lockType: "puzzle_complete" as const, puzzleKind: instance.kind === "color_sequence" ? undefined : instance.kind }
          : candidate.id === instance.linkedDoorId
            ? resultMode === "open_door"
              ? { ...candidate, lockType: "none" as const, puzzleKind: undefined, puzzleRoomId: undefined }
              : candidate
            : candidate,
      ),
      puzzles: (draft.puzzles ?? []).map((candidate) => (candidate.id === instance.id ? { ...candidate, linkedDoorId: doorId } : candidate)),
    }));
  };

  const changeResultMode = (mode: NonNullable<BuilderPuzzleInstance["resultMode"]>) => {
    if (mode === resultMode) return;
    onChange((draft) => {
      const compatibleDoor =
        draft.doors.find((candidate) => candidate.id === instance.linkedDoorId && (mode === "grant_key" ? candidate.lockType === "key_item" : candidate.lockType === "puzzle_complete")) ??
        draft.doors.find((candidate) => mode === "grant_key" ? candidate.lockType === "key_item" : candidate.lockType === "puzzle_complete") ??
        draft.doors[0];
      if (!compatibleDoor) return draft;
      return {
        ...draft,
        doors: draft.doors.map((candidate) =>
          candidate.id === compatibleDoor.id
            ? mode === "grant_key"
              ? { ...candidate, lockType: "key_item" as const, puzzleKind: undefined, puzzleRoomId: undefined }
              : { ...candidate, lockType: "puzzle_complete" as const, puzzleKind: instance.kind === "color_sequence" ? undefined : instance.kind }
            : resultMode === "open_door" && candidate.id === instance.linkedDoorId
              ? { ...candidate, lockType: "none" as const, puzzleKind: undefined, puzzleRoomId: undefined }
              : candidate,
        ),
        puzzles: (draft.puzzles ?? []).map((candidate) =>
          candidate.id === instance.id ? { ...candidate, resultMode: mode === "open_door" ? undefined : mode, linkedDoorId: compatibleDoor.id } : candidate,
        ),
      };
    });
  };

  const usedColors = new Set(components.map((component) => orbColorKey(component.role)));
  const nextColor = builderPuzzleColors.find((color) => !usedColors.has(color.colorKey));
  const addOrb = () => {
    if (!nextColor || !room) return;
    const component = {
      id: createBuilderId("pzc"),
      role: `orb_${nextColor.colorKey}` as BuilderPuzzleComponentRole,
      roomId: instance.roomId,
      position: [instance.position[0] + 1 + components.length * 0.6, instance.position[1] + 1] as const,
    };
    patchInstance({ components: [...components, component] });
    onSelect({ kind: "puzzle", id: instance.id, componentId: component.id });
  };
  const setOrbColor = (id: string, colorKey: (typeof builderPuzzleColors)[number]["colorKey"]) => {
    patchInstance({
      components: components.map((component) =>
        component.id === id ? { ...component, role: `orb_${colorKey}` as BuilderPuzzleComponentRole } : component,
      ),
    });
  };
  const hostPropId = instance.sourceInteraction?.hostPropId ?? "";
  const hostProp = hostPropId ? project.props.find((prop) => prop.id === hostPropId) ?? null : null;
  const hostPickActive = hostPick?.kind === "interaction" && hostPick.puzzleId === instance.id;
  const hostableProps = project.props.filter((prop) => prop.roomId === instance.roomId || prop.id === hostPropId);
  const storyPaintingProps = project.props.filter((prop) => propEntry(prop.modelKey)?.group === "故事线索");
  const requiredStoryPropIds = instance.requiredStoryPropIds ?? [];
  const requiredStoryPropIdSet = new Set(requiredStoryPropIds);
  const toggleRequiredStoryProp = (propId: string) => {
    const next = requiredStoryPropIdSet.has(propId)
      ? requiredStoryPropIds.filter((id) => id !== propId)
      : [...requiredStoryPropIds, propId];
    patchInstance({ requiredStoryPropIds: next.length > 0 ? next : undefined });
  };
  const wallStationOnly = instance.kind === "valve_matrix";
  const sourceInteractionWithHost = (propId: string | undefined): BuilderPuzzleInstance["sourceInteraction"] => {
    if (wallStationOnly && propId) return valveWallInspectorSource(instance.sourceInteraction);
    if (propId) return { ...(instance.sourceInteraction ?? {}), hostPropId: propId };
    if (!instance.sourceInteraction) return undefined;
    const { hostPropId: _hostPropId, ...rest } = instance.sourceInteraction;
    return Object.keys(rest).length > 0 ? rest : undefined;
  };
  const setHostProp = (propId: string) => {
    const prop = project.props.find((candidate) => candidate.id === propId);
    patchInstance({
      sourceInteraction: sourceInteractionWithHost(prop?.id),
      ...(prop
        ? {
            roomId: prop.roomId,
            position: prop.position,
            rotationY: prop.rotationY,
            wallMount: undefined,
          }
        : {}),
    });
  };
  const startInteractionHostPick = () => onStartHostPick?.({ kind: "interaction", puzzleId: instance.id });
  const componentAnchorPropId = (component: BuilderPuzzleComponent) =>
    component.sourceActor?.anchorPropId ?? component.sourceTarget?.anchorPropId ?? "";
  const componentHostPickActive = (component: BuilderPuzzleComponent) =>
    hostPick?.kind === "component" && hostPick.puzzleId === instance.id && hostPick.componentId === component.id;
  const componentAnchorProps = (component: BuilderPuzzleComponent) => {
    const anchorId = componentAnchorPropId(component);
    return project.props.filter((prop) => prop.roomId === component.roomId || prop.id === anchorId);
  };
  const setComponentAnchorProp = (componentId: string, propId: string) => {
    const prop = project.props.find((candidate) => candidate.id === propId);
    patchInstance({
      components: components.map((component) => {
        if (component.id !== componentId) return component;
        const y = component.sourceActor?.position?.[1] ?? component.sourceTarget?.y ?? 1.15;
        const nextActor = prop
          ? {
              ...(component.sourceActor ?? {}),
              roomId: prop.roomId,
              position: [prop.position[0], y, prop.position[1]] as [number, number, number],
              anchorPropId: prop.id,
            }
          : (() => {
              if (!component.sourceActor) return undefined;
              const { anchorPropId: _anchorPropId, ...rest } = component.sourceActor;
              return Object.keys(rest).length > 0 ? rest : undefined;
            })();
        const nextTarget = prop
          ? {
              ...(component.sourceTarget ?? {}),
              anchorPropId: prop.id,
            }
          : (() => {
              if (!component.sourceTarget) return undefined;
              const { anchorPropId: _anchorPropId, ...rest } = component.sourceTarget;
              return Object.keys(rest).length > 0 ? rest : undefined;
            })();
        return {
          ...component,
          ...(prop ? { roomId: prop.roomId, position: prop.position } : {}),
          sourceActor: nextActor,
          sourceTarget: nextTarget,
        };
      }),
    });
  };

  const doorLabel = (candidate: BuilderDoor) => bl(builderDoorDisplayLabel(candidate, project), language);
  const takenDoors = new Set(puzzleInstances(project).filter((candidate) => candidate.id !== instance.id).map((candidate) => candidate.linkedDoorId));
  const compatibleDoors = project.doors.filter((candidate) => resultMode === "grant_key" ? candidate.lockType === "key_item" : candidate.lockType === "puzzle_complete");
  const successOutputs = (instance.successOutputs ?? []).slice(0, 4);
  const lockedDoors = project.doors.filter((candidate) => candidate.lockType !== "none");
  const robotRoomIds = [...new Set(project.robots.map((robot) => robot.roomId))];
  const robotRooms = project.rooms.filter((candidate) => robotRoomIds.includes(candidate.id));
  const patchSuccessOutputs = (outputs: readonly BuilderRouteSwitchOutput[]) => patchInstance({ successOutputs: outputs.length > 0 ? outputs : undefined });
  const patchSuccessOutput = (outputId: string, changes: Partial<BuilderRouteSwitchOutput>) =>
    patchSuccessOutputs(successOutputs.map((output) => (output.id === outputId ? { ...output, ...changes } : output)));
  const removeSuccessOutput = (outputId: string) => patchSuccessOutputs(successOutputs.filter((output) => output.id !== outputId));
  const addSuccessOutput = () => patchSuccessOutputs([...successOutputs, puzzleDefaultSuccessOutput(project)]);
  const changeSuccessOutputKind = (output: BuilderRouteSwitchOutput, kind: BuilderRouteSwitchOutputKind) => {
    if (output.kind === kind) return;
    patchSuccessOutput(output.id, { id: output.id, kind, label: output.label, ...routeDefaultTarget(kind, project) });
  };

  return (
    <div className="builder-fields">
      <div className="builder-card builder-puzzle-door-card">
        <h3>{language === "en" ? "Puzzle Type" : "谜题类型"}</h3>
        <div className="builder-puzzlekind-grid">
          {puzzlePickerKinds(instance.kind).map((kindEntry) => {
            const colorBlocked =
              kindEntry.kind === "color_sequence" &&
              puzzleInstances(project).some((candidate) => candidate.kind === "color_sequence" && candidate.id !== instance.id);
            return (
              <button
                key={kindEntry.kind}
                type="button"
                className={instance.kind === kindEntry.kind ? "active" : ""}
                style={{ color: kindEntry.color }}
                disabled={colorBlocked}
                title={colorBlocked ? (language === "en" ? "Only one color-sequence lock is allowed" : "颜色顺序锁只能有一座") : bl(kindEntry.howToSolve, language)}
                onClick={() => changeKind(kindEntry.kind)}
              >
                <i>{kindEntry.glyph}</i>
                <span>{bl(kindEntry.label, language)}</span>
              </button>
            );
          })}
        </div>
        <p className="builder-hint">{bl(entry.howToSolve, language)}{language === "en" ? "." : "。"}</p>
      </div>
      <div className="builder-card builder-story-prereq-card">
        <h3>{language === "en" ? "Required Paintings" : "前置阅读"}</h3>
        {storyPaintingProps.length === 0 ? (
          <InspectorHint tone="warn">{language === "en" ? "Place story paintings first, then select them here." : "先从「故事线索」放入画作，再在这里选择前置。"}</InspectorHint>
        ) : (
          <div className="builder-story-prereq-list">
            {storyPaintingProps.map((prop) => {
              const storyEntry = propEntry(prop.modelKey);
              const active = requiredStoryPropIdSet.has(prop.id);
              const rawRoomLabel = project.rooms.find((candidate) => candidate.id === prop.roomId)?.label ?? (language === "en" ? "Missing room" : "房间缺失");
              const roomLabel = bl(rawRoomLabel, language);
              const label = bl(prop.story?.title?.trim() || storyEntry?.label || prop.id, language);
              return (
                <button
                  key={prop.id}
                  type="button"
                  className={active ? "active" : ""}
                  title={language === "en" ? `Require reading ${label}` : `要求先读：${label}`}
                  onClick={() => toggleRequiredStoryProp(prop.id)}
                >
                  <span className="builder-story-prereq-thumb">
                    <AssetImageThumb modelKey={prop.modelKey} />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <em>{roomLabel}</em>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {requiredStoryPropIds.length > 0 ? (
          <p className="builder-hint">{language === "en" ? "The player must read every selected painting before this puzzle opens." : "玩家必须读完选中的画作，这个谜题才会打开。"}</p>
        ) : null}
      </div>
      {instance.kind === "archive_merge" ? (
        <div className="builder-card builder-archive-target-card">
          <h3>{language === "en" ? "Identity Compression Target" : "身份压缩目标"}</h3>
          <ArchiveMergeTargetControl value={instance.archiveTargetValue} onChange={(value) => patchInstance({ archiveTargetValue: value })} />
        </div>
      ) : null}
      {instance.kind === "valve_matrix" ? (
        <div className="builder-card builder-valve-time-card">
          <h3>{language === "en" ? "Gate Timer" : "闸门倒计时"}</h3>
          <Stepper
            label={language === "en" ? "Seconds" : "剩余时间"}
            value={valveTimeLimitSec}
            min={valveMatrixTimeLimit.min}
            max={valveMatrixTimeLimit.max}
            step={valveMatrixTimeLimit.step}
            unit={language === "en" ? "s" : "秒"}
            onChange={(value) => patchInstance({ timeLimitSec: normalizeValveMatrixTimeLimit(value) })}
          />
          <p className="builder-hint">{language === "en" ? "Shown on the gate console in place of the old reset button." : "会显示在闸门面板底部，替代原来的复位按钮。"}</p>
        </div>
      ) : null}
      <div className="builder-card">
        <h3>{language === "en" ? "Solved Result" : "解开后的结果"}</h3>
        <div className="builder-lockgrid">
          <button type="button" className={resultMode === "open_door" ? "active" : ""} onClick={() => changeResultMode("open_door")}>
            <i>▣</i>
            <span>{language === "en" ? "Open Puzzle Door" : "打开谜题门"}</span>
          </button>
          <button type="button" className={resultMode === "grant_key" ? "active" : ""} onClick={() => changeResultMode("grant_key")}>
            <i>◆</i>
            <span>{language === "en" ? "Grant Keycard" : "授予门禁片"}</span>
          </button>
        </div>
        <p className="builder-hint">
          {resultMode === "grant_key"
            ? (language === "en" ? "Solving this station grants the bound keycard, then opens and reveals that key door." : "解开后授予绑定门禁片，然后打开并切镜头看这扇钥匙门。")
            : (language === "en" ? "Solving this station directly opens a puzzle-locked door." : "解开后直接打开一扇谜题锁门。")}
        </p>
      </div>
      <div className="builder-card builder-route-outputs-card">
        <h3>{language === "en" ? "Extra Outputs" : "额外输出"}</h3>
        {successOutputs.length === 0 ? (
          <p className="builder-hint">{language === "en" ? "Optional: wake robots or wire another target after this puzzle is solved." : "可选：谜题解开后唤醒机器人，或接入另一个目标。"}</p>
        ) : null}
        {successOutputs.map((output, index) => (
          <div key={output.id} className="builder-route-output-row">
            <b>{index + 1}</b>
            <label>
              <span>{language === "en" ? "Action" : "动作"}</span>
              <select value={output.kind} onChange={(event) => changeSuccessOutputKind(output, event.target.value as BuilderRouteSwitchOutputKind)}>
                {(Object.keys(routeOutputKindLabelsZh) as BuilderRouteSwitchOutputKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {routeOutputKindLabel(kind, language)}
                  </option>
                ))}
              </select>
            </label>
            <RouteOutputTargetSelect
              project={project}
              output={output}
              targetDoors={lockedDoors}
              puzzles={puzzleInstances(project).filter((candidate) => candidate.id !== instance.id)}
              robotRooms={robotRooms}
              onChange={(changes) => patchSuccessOutput(output.id, changes)}
              onSelect={onSelect}
            />
            <label className="builder-route-output-label">
              <span>{language === "en" ? "Display Name" : "显示名"}</span>
              <input
                value={output.label ?? ""}
                placeholder={routeOutputAutoLabel(project, output, language)}
                onChange={(event) => patchSuccessOutput(output.id, { label: event.target.value })}
              />
            </label>
            <button type="button" className="builder-danger" title={language === "en" ? "Remove this output" : "移除这个输出"} onClick={() => removeSuccessOutput(output.id)}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" disabled={successOutputs.length >= 4} onClick={addSuccessOutput}>
          ＋ {language === "en" ? "Add Output" : "添加输出"}
        </button>
        {robotRooms.length === 0 ? <InspectorHint tone="warn">{language === "en" ? "⚠ Robot outputs need at least one robot room." : "⚠ 机器人输出需要先部署机器人房间。"}</InspectorHint> : null}
      </div>
      <div className="builder-card">
        <h3>{resultMode === "grant_key" ? (language === "en" ? "Key Door" : "钥匙门") : (language === "en" ? "Puzzle Door" : "谜题门")}</h3>
        <label>
          <span>{resultMode === "grant_key" ? (language === "en" ? "Grants Key For" : "授予哪扇门") : (language === "en" ? "Opens When Solved" : "解开后打开")}</span>
          <select value={instance.linkedDoorId} onChange={(event) => relinkDoor(event.target.value)}>
            {!door ? <option value={instance.linkedDoorId}>{language === "en" ? "(door deleted)" : "（门已被删除）"}</option> : null}
            {compatibleDoors
              .filter((candidate) => candidate.id === instance.linkedDoorId || !takenDoors.has(candidate.id))
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {doorLabel(candidate)}
                </option>
              ))}
          </select>
        </label>
        {door ? (
          <button type="button" onClick={() => onSelect({ kind: "door", id: door.id })}>▣ {language === "en" ? "Select This Door" : "选中这扇门"}</button>
        ) : (
          <InspectorHint tone="warn">{language === "en" ? "⚠ The bound door was deleted — pick a new door above, or delete this puzzle." : "⚠ 绑定的门已被删除——上面选一扇新门，或删除这座谜题。"}</InspectorHint>
        )}
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Puzzle Station" : "谜题台"}</h3>
        <p className="builder-hint">{language === "en" ? "Room: " : "所在房间："}{room?.label ?? (language === "en" ? "(room deleted — drag back into any room)" : "（房间已删除——拖回任意房间）")}</p>
        {wallStationOnly ? (
          <InspectorHint tone="ok">{language === "en" ? "Gate balance uses its own large console and does not attach to furniture." : "闸门配平台使用独立的大屏终端，不再承载到家具或旧监视臂上。"}</InspectorHint>
        ) : (
          <>
            <div className={`builder-host-card ${hostPickActive ? "active" : ""}`}>
              <div className="builder-host-current">
                <i>{hostProp ? "❑" : "◈"}</i>
                <span>
                  <b>{language === "en" ? "Interaction Host" : "交互家具"}</b>
                  <em>{hostProp ? builderPropInspectorLabel(hostProp, language) : language === "en" ? "Standalone puzzle station" : "独立谜题台"}</em>
                </span>
              </div>
              <div className="builder-host-actions">
                <button type="button" className={hostPickActive ? "active" : ""} onClick={startInteractionHostPick} disabled={!onStartHostPick || project.props.length === 0}>
                  {hostPickActive ? (language === "en" ? "Picking…" : "选择中…") : language === "en" ? "Pick Furniture" : "更换家具"}
                </button>
                {hostProp ? (
                  <>
                    <button type="button" onClick={() => onSelect({ kind: "prop", id: hostProp.id })}>{language === "en" ? "Jump" : "跳到家具"}</button>
                    <button type="button" onClick={() => setHostProp("")}>{language === "en" ? "Standalone" : "恢复独立"}</button>
                  </>
                ) : null}
              </div>
            </div>
            <label>
              <span>{language === "en" ? "Quick Select Host" : "快速选择承载"}</span>
              <select value={hostPropId} onChange={(event) => setHostProp(event.target.value)}>
                <option value="">{language === "en" ? "Standalone station" : "独立谜题台"}</option>
                {hostableProps.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {builderPropInspectorLabel(prop, language)}
                  </option>
                ))}
              </select>
            </label>
            {project.props.length === 0 ? (
              <InspectorHint tone="warn">{language === "en" ? "Place furniture first, then use Pick Furniture." : "先放置家具 / 展柜 / 面板，再使用「更换家具」。"}</InspectorHint>
            ) : null}
          </>
        )}
        <div className="builder-row">
          <Stepper label={language === "en" ? "X (m)" : "X (米)"} value={instance.position[0]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patchInstance({ position: [value, instance.position[1]] })} />
          <Stepper label={language === "en" ? "Z (m)" : "Z (米)"} value={instance.position[1]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patchInstance({ position: [instance.position[0], value] })} />
        </div>
        <AngleControl label={language === "en" ? "Facing" : "朝向"} valueRad={instance.rotationY} onChange={(value) => patchInstance({ rotationY: value })} />
        <p className="builder-hint">{language === "en" ? "You can drag the puzzle station directly in 2D / 3D." : "2D / 3D 都可以直接拖动谜题台。"}</p>
      </div>
      {instance.kind === "color_sequence" ? (
        <div className="builder-card">
          <h3>{language === "en" ? "Orbs (hit in light order)" : "色球（按灯序击中）"}</h3>
          {components.map((component, index) => (
            <div key={component.id} className={`builder-orb-row ${componentId === component.id ? "selected" : ""}`}>
              <b>{index + 1}</b>
              <span className="builder-orb-dot" style={{ background: orbColorHex(component.role) }} />
              <div className="builder-orb-colors">
                {builderPuzzleColors.map((color) => (
                  <button
                    key={color.colorKey}
                    type="button"
                    className={`builder-colordot ${orbColorKey(component.role) === color.colorKey ? "active" : ""}`}
                    style={{ background: color.hex }}
                    title={bl(color.label, language)}
                    disabled={usedColors.has(color.colorKey) && orbColorKey(component.role) !== color.colorKey}
                    onClick={() => setOrbColor(component.id, color.colorKey)}
                  />
                ))}
              </div>
              <em>{project.rooms.find((roomCandidate) => roomCandidate.id === component.roomId)?.label ?? "?"}</em>
              <select
                value={componentAnchorPropId(component)}
                title={language === "en" ? "Use an existing prop as this orb target" : "用现有道具承载这个色球目标"}
                onChange={(event) => setComponentAnchorProp(component.id, event.target.value)}
              >
                <option value="">{language === "en" ? "Free" : "独立"}</option>
                {componentAnchorProps(component).map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {builderPropInspectorLabel(prop, language)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={componentHostPickActive(component) ? "active" : ""}
                title={language === "en" ? "Pick a furniture prop for this orb target" : "在画布上选择承载这个色球的家具"}
                disabled={!onStartHostPick || project.props.length === 0}
                onClick={() => onStartHostPick?.({ kind: "component", puzzleId: instance.id, componentId: component.id })}
              >
                {componentHostPickActive(component) ? "…" : "❑"}
              </button>
              <button type="button" title={language === "en" ? "Select this orb (drag it into any room)" : "选中这个色球（可拖动到任何房间）"} onClick={() => onSelect({ kind: "puzzle", id: instance.id, componentId: component.id })}>
                ⌖
              </button>
            </div>
          ))}
          <div className="builder-row">
            <button type="button" disabled={!nextColor || components.length >= 7} onClick={addOrb}>
              ＋ {language === "en" ? "Add Orb" : "添加色球"}
            </button>
          </div>
          <p className="builder-hint">{language === "en" ? "Orbs can be dragged into different rooms; the player watches the light wall, then shoots them in the order listed above." : "色球可以拖进不同房间；玩家先看灯墙，再按上面的列表顺序射击。"}</p>
        </div>
      ) : null}
      <div className="builder-card builder-danger-zone">
        <h3>{language === "en" ? "Puzzle Actions" : "谜题操作"}</h3>
        <button type="button" className="builder-danger" onClick={onRemove} title={language === "en" ? "Delete the puzzle; its door reverts to unlocked" : "删除谜题；它的门恢复为无锁"}>
          ✕ {language === "en" ? "Delete Puzzle (door reverts to unlocked)" : "删除谜题（门恢复无锁）"}
        </button>
      </div>
    </div>
  );
}

function PickupInspector({
  project,
  pickup,
  onChange,
}: InspectorProps & { project: BuilderProject; pickup: BuilderPickup }) {
  const { language } = useBuilderLanguage();
  const room = project.rooms.find((candidate) => candidate.id === pickup.roomId);
  const keyDoors = project.doors.filter((door) => door.lockType === "key_item");
  const doorLabel = (door: BuilderDoor) => bl(builderDoorDisplayLabel(door, project), language);
  const patch = (changes: Partial<BuilderPickup>) =>
    onChange((draft) => ({
      ...draft,
      pickups: (draft.pickups ?? []).map((candidate) => (candidate.id === pickup.id ? { ...candidate, ...changes } : candidate)),
    }));

  return (
    <div className="builder-fields">
      <div className="builder-card">
        <h3>{language === "en" ? "Pickup Type" : "拾取类型"}</h3>
        <div className="builder-pickup-kind-grid">
          {builderPickupCatalog.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              className={pickup.kind === entry.kind ? "active" : ""}
              style={{ color: entry.color }}
              title={bl(entry.hint, language)}
              onClick={() => patch({ kind: entry.kind, linkedDoorId: entry.kind === "key_item" ? pickup.linkedDoorId ?? keyDoors[0]?.id : undefined })}
            >
              <i>{entry.glyph}</i>
              <span>{bl(entry.label, language)}</span>
            </button>
          ))}
        </div>
        <p className="builder-hint">{bl(pickupEntry(pickup.kind).hint, language)}{language === "en" ? "." : "。"}</p>
      </div>
      {pickup.kind === "key_item" ? (
        <div className="builder-card">
          <h3>{language === "en" ? "Key Door" : "钥匙门"}</h3>
          {keyDoors.length > 0 ? (
            <label>
              <span>{language === "en" ? "Opens On Pickup" : "拾取后开启"}</span>
              <select value={pickup.linkedDoorId ?? keyDoors[0]?.id ?? ""} onChange={(event) => patch({ linkedDoorId: event.target.value })}>
                {keyDoors.map((door) => (
                  <option key={door.id} value={door.id}>
                    {doorLabel(door)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <InspectorHint tone="warn">{language === "en" ? "Place a key door first so this release key has a target." : "先放一扇钥匙门，这把解除钥才会有目标。"}</InspectorHint>
          )}
        </div>
      ) : null}
      <div className="builder-card">
        <h3>{language === "en" ? "Position" : "位置"}</h3>
        <p className="builder-hint">{language === "en" ? "Room: " : "所在房间："}{room?.label ?? (language === "en" ? "(room deleted — drag back into any room)" : "（房间已删除——拖回任意房间）")}</p>
        <div className="builder-row">
          <Stepper label={language === "en" ? "X (m)" : "X (米)"} value={pickup.position[0]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patch({ position: [value, pickup.position[1]] })} />
          <Stepper label={language === "en" ? "Z (m)" : "Z (米)"} value={pickup.position[1]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patch({ position: [pickup.position[0], value] })} />
        </div>
        <p className="builder-hint">{language === "en" ? "You can drag it directly in 2D / 3D too." : "2D / 3D 里也可以直接拖动。"}</p>
      </div>
    </div>
  );
}

function WallDoorSwitchInspector({
  project,
  wallSwitch,
  onChange,
  onSelect,
}: InspectorProps & {
  project: BuilderProject;
  wallSwitch: BuilderWallDoorSwitch;
  onSelect: (selection: BuilderSelection) => void;
}) {
  const { language } = useBuilderLanguage();
  const roomOptions = project.rooms.map((room) => (
    <option key={room.id} value={room.id}>
      {bl(room.label, language)}
    </option>
  ));
  const patchSwitch = (changes: Partial<BuilderWallDoorSwitch>) =>
    onChange((draft) => ({
      ...draft,
      wallDoorSwitches: (draft.wallDoorSwitches ?? []).map((candidate) => (candidate.id === wallSwitch.id ? { ...candidate, ...changes } : candidate)),
    }));
  const patchState = (stateId: string, changes: Partial<BuilderWallDoorSwitchState>) =>
    patchSwitch({ states: wallSwitch.states.map((state) => (state.id === stateId ? { ...state, ...changes } : state)) });
  type DoorAction = "none" | "open" | "close";
  const [selectedDoorByStateId, setSelectedDoorByStateId] = useState<Record<string, string>>({});
  const doorActionForState = (state: BuilderWallDoorSwitchState, doorId: string): DoorAction => {
    if (state.openDoorIds?.includes(doorId)) return "open";
    if (state.closeDoorIds?.includes(doorId)) return "close";
    return "none";
  };
  const selectedDoorIdForState = (state: BuilderWallDoorSwitchState) =>
    selectedDoorByStateId[state.id] ?? state.openDoorIds?.[0] ?? state.closeDoorIds?.[0] ?? project.doors[0]?.id ?? "";
  const selectDoorForState = (stateId: string, doorId: string) => {
    setSelectedDoorByStateId((current) => ({ ...current, [stateId]: doorId }));
  };
  const canControlDoor = (doorId: string) => wallDoorSwitchCanControlDoor(project, doorId, wallSwitch.id);
  const doorOptionLabel = (door: BuilderDoor) => {
    const usage = wallDoorSwitchDoorControlUsage(project, door.id, wallSwitch.id);
    const suffix = usage.controlledByActiveSwitch
      ? language === "en" ? `current ${usage.count}/${usage.max}` : `当前 ${usage.count}/${usage.max}`
      : usage.full
        ? language === "en" ? `${usage.count}/${usage.max} full` : `${usage.count}/${usage.max} 已满`
        : `${usage.count}/${usage.max}`;
    return `${doorLabel(project, door, language)} · ${suffix}`;
  };
  const setDoorActionForState = (state: BuilderWallDoorSwitchState, doorId: string, action: DoorAction) => {
    if (action !== "none" && !canControlDoor(doorId)) return;
    const open = new Set(state.openDoorIds ?? []);
    const close = new Set(state.closeDoorIds ?? []);
    open.delete(doorId);
    close.delete(doorId);
    if (action === "open") open.add(doorId);
    if (action === "close") close.add(doorId);
    patchState(state.id, {
      openDoorIds: [...open],
      closeDoorIds: [...close],
    });
  };
  const stateSummary = (state: BuilderWallDoorSwitchState) => {
    const openCount = state.openDoorIds?.length ?? 0;
    const closeCount = state.closeDoorIds?.length ?? 0;
    if (language === "en") return `Open ${openCount} · Close ${closeCount}`;
    return `开 ${openCount} · 关 ${closeCount}`;
  };
  const switchMode = wallDoorSwitchMode(wallSwitch);
  const primaryDoorId = primaryDoorIdForWallDoorSwitch(wallSwitch);
  const inverseDoorId = wallSwitch.inverseDoorId;
  const primaryDoor = primaryDoorId ? project.doors.find((door) => door.id === primaryDoorId) ?? null : null;
  const inverseDoor = inverseDoorId ? project.doors.find((door) => door.id === inverseDoorId) ?? null : null;
  const toggleStates = primaryDoorId ? toggleStatesForWallDoorSwitch(primaryDoorId, inverseDoorId) : effectiveWallDoorSwitchStates(wallSwitch);
  const controlledDoorIds = new Set(effectiveWallDoorSwitchStates(wallSwitch).flatMap((state) => [...(state.openDoorIds ?? []), ...(state.closeDoorIds ?? [])]));
  const setToggleDoors = (nextPrimaryDoorId: string, nextInverseDoorId?: string) => {
    if (!nextPrimaryDoorId) return;
    if (!canControlDoor(nextPrimaryDoorId)) return;
    const safeInverseDoorId =
      nextInverseDoorId && nextInverseDoorId !== nextPrimaryDoorId && canControlDoor(nextInverseDoorId)
        ? nextInverseDoorId
        : undefined;
    onChange((draft) => applyToggleDoorOwnership(draft, wallSwitch.id, nextPrimaryDoorId, safeInverseDoorId));
  };
  return (
    <div className="builder-fields">
      <div className="builder-card builder-route-card-editor">
        <h3>{language === "en" ? "Wall Door Switch" : "墙面门控把手"}</h3>
        <label>
          <span>{language === "en" ? "Name" : "名称"}</span>
          <input value={wallSwitch.label} onChange={(event) => patchSwitch({ label: event.target.value })} />
        </label>
        <div className="builder-row">
          <label>
            <span>{language === "en" ? "Room" : "所在房间"}</span>
            <select value={wallSwitch.roomId} onChange={(event) => patchSwitch({ roomId: event.target.value })}>
              {roomOptions}
            </select>
          </label>
          <label>
            <span>{language === "en" ? "Wall" : "墙面"}</span>
            <select value={wallSwitch.wallMount.side} onChange={(event) => patchSwitch({ wallMount: { ...wallSwitch.wallMount, side: event.target.value as BuilderWallDoorSwitch["wallMount"]["side"] } })}>
              <option value="north">{language === "en" ? "North" : "北墙"}</option>
              <option value="south">{language === "en" ? "South" : "南墙"}</option>
              <option value="west">{language === "en" ? "West" : "西墙"}</option>
              <option value="east">{language === "en" ? "East" : "东墙"}</option>
            </select>
          </label>
        </div>
        <div className="builder-row">
          <Stepper
            label={language === "en" ? "Wall Offset" : "沿墙偏移"}
            value={wallSwitch.wallMount.offset}
            min={-1}
            max={1}
            step={0.1}
            decimals={1}
            onChange={(value) => patchSwitch({ wallMount: { ...wallSwitch.wallMount, offset: value } })}
          />
          <Stepper
            label={language === "en" ? "Height (m)" : "高度 (米)"}
            value={wallSwitch.wallMount.height ?? 1.34}
            min={0.8}
            max={1.8}
            step={0.05}
            decimals={2}
            onChange={(value) => patchSwitch({ wallMount: { ...wallSwitch.wallMount, height: value } })}
          />
        </div>
        <label className="builder-toggle-line">
          <input type="checkbox" checked={wallSwitch.oneShot === true} onChange={(event) => patchSwitch({ oneShot: event.target.checked })} />
          <span>{language === "en" ? "One-shot switch" : "只允许切换一次"}</span>
        </label>
        <p className="builder-hint">{language === "en" ? "Default is repeatable: each E press advances to the next state and wraps back." : "默认可反复交互：每次按 E 切到下个状态，并循环回第一档。"}</p>
      </div>

      {switchMode === "toggle" ? (
        <div className="builder-card builder-wall-switch-states-card">
          <h3>{language === "en" ? "Toggle Doors" : "开关门组"}</h3>
          <label className="builder-wall-switch-door-picker">
            <span>{language === "en" ? "Primary Door" : "主门"}</span>
            <div className="builder-wall-switch-picker-row">
              <select value={primaryDoorId ?? ""} onChange={(event) => setToggleDoors(event.target.value, inverseDoorId)}>
                <option value="">{language === "en" ? "Choose primary..." : "选择主门..."}</option>
                {project.doors.map((door) => {
                  const disabled = door.id !== primaryDoorId && (door.id === inverseDoorId || !canControlDoor(door.id));
                  return (
                    <option key={door.id} value={door.id} disabled={disabled}>
                      {doorOptionLabel(door)}
                    </option>
                  );
                })}
              </select>
              <WallDoorControlUsageBadge project={project} doorId={primaryDoorId} switchId={wallSwitch.id} />
            </div>
          </label>
          <label className="builder-wall-switch-door-picker">
            <span>{language === "en" ? "Inverse Door" : "反向门"}</span>
            <div className="builder-wall-switch-picker-row">
              <select value={inverseDoorId ?? ""} disabled={!primaryDoorId} onChange={(event) => primaryDoorId && setToggleDoors(primaryDoorId, event.target.value || undefined)}>
                <option value="">{language === "en" ? "None" : "无"}</option>
                {project.doors
                  .filter((door) => door.id !== primaryDoorId)
                  .map((door) => (
                    <option key={door.id} value={door.id} disabled={door.id !== inverseDoorId && !canControlDoor(door.id)}>
                      {doorOptionLabel(door)}
                    </option>
                  ))}
              </select>
              <WallDoorControlUsageBadge project={project} doorId={inverseDoorId} switchId={wallSwitch.id} />
            </div>
          </label>
          <div className="builder-wall-switch-chip-groups">
            <WallSwitchDoorChips readonly title={language === "en" ? "Closed State Closes" : "关闭档关闭"} tone="close" doorIds={primaryDoor ? [primaryDoor.id] : []} project={project} onSelect={onSelect} onRemove={() => undefined} />
            <WallSwitchDoorChips title={language === "en" ? "Closed State Opens" : "关闭档打开"} tone="open" doorIds={inverseDoor ? [inverseDoor.id] : []} project={project} onSelect={onSelect} onRemove={() => primaryDoorId && setToggleDoors(primaryDoorId)} />
          </div>
          <InspectorHint tone={primaryDoor ? "ok" : "warn"}>
            {primaryDoor
              ? inverseDoor
                ? language === "en"
                  ? "This handle alternates the two doors. If the inverse door has a key, puzzle, or wave lock, it must be unlocked once before the handle can control it."
                  : "这个把手会让两扇门反向切换。反向门如果有钥匙、谜题或战斗锁，必须先被解锁一次，机关才能控制它。"
                : language === "en"
                  ? "This handle toggles the primary door open and closed."
                  : "这个把手会反复打开 / 关闭主门。"
              : language === "en"
                ? "Choose a primary door for this wall handle."
                : "先给这个墙上把手选择一扇主门。"}
          </InspectorHint>
        </div>
      ) : null}

      <div className="builder-card builder-wall-switch-states-card">
        <h3>{switchMode === "toggle" ? (language === "en" ? "Generated States" : "自动生成状态") : (language === "en" ? "Door States" : "门控状态")}</h3>
        <p className="builder-hint">
          {switchMode === "toggle"
            ? language === "en"
              ? "Toggle states are generated from the primary and inverse doors."
              : "Toggle 状态由主门和反向门自动生成。"
            : language === "en"
              ? "Each door can open, close, or stay unchanged per state. This supports open-only and close-only switches."
              : "每个状态下，每扇门都可以设为打开、关闭或不动；因此可以做只开门、只关门、或开关混合机关。"}
        </p>
        {(switchMode === "toggle" ? toggleStates : wallSwitch.states).map((state, index) => (
          <div key={state.id} className="builder-wall-switch-state-card">
            <div className="builder-wall-switch-state-head">
              <b>{index + 1}</b>
              <label>
                <span>{language === "en" ? "State Name" : "状态名"}</span>
                <input value={state.label} disabled={switchMode === "toggle"} onChange={(event) => patchState(state.id, { label: event.target.value })} />
              </label>
              <em>{stateSummary(state)}</em>
            </div>
            {switchMode === "toggle" ? (
              <div className="builder-wall-switch-chip-groups">
                <WallSwitchDoorChips readonly title={language === "en" ? "Open" : "打开"} tone="open" doorIds={state.openDoorIds ?? []} project={project} onSelect={onSelect} onRemove={() => undefined} />
                <WallSwitchDoorChips readonly title={language === "en" ? "Close" : "关闭"} tone="close" doorIds={state.closeDoorIds ?? []} project={project} onSelect={onSelect} onRemove={() => undefined} />
              </div>
            ) : project.doors.length > 0 ? (
              <div className="builder-wall-switch-door-editor">
                {(() => {
                  const selectedDoorId = selectedDoorIdForState(state);
                  const selectedDoor = project.doors.find((door) => door.id === selectedDoorId) ?? project.doors[0];
                  const selectedAction = selectedDoor ? doorActionForState(state, selectedDoor.id) : "none";
                  const selectedDoorAvailable = selectedDoor ? canControlDoor(selectedDoor.id) : false;
                  return (
                    <>
                      <label className="builder-wall-switch-door-select">
                        <span>{language === "en" ? "Door" : "门"}</span>
                        <select value={selectedDoor?.id ?? ""} onChange={(event) => selectDoorForState(state.id, event.target.value)}>
                          {project.doors.map((door) => (
                            <option key={door.id} value={door.id} disabled={door.id !== selectedDoor?.id && !canControlDoor(door.id)}>
                              {doorOptionLabel(door)}
                            </option>
                          ))}
                        </select>
                        <WallDoorControlUsageBadge project={project} doorId={selectedDoor?.id} switchId={wallSwitch.id} />
                      </label>
                      <div className="builder-wall-switch-action-segment" role="group" aria-label={selectedDoor ? doorLabel(project, selectedDoor, language) : undefined}>
                        <button type="button" className={selectedAction === "none" ? "active" : ""} onClick={() => selectedDoor && setDoorActionForState(state, selectedDoor.id, "none")}>
                          {language === "en" ? "Hold" : "不动"}
                        </button>
                        <button type="button" disabled={!selectedDoorAvailable} className={selectedAction === "open" ? "active open" : "open"} onClick={() => selectedDoor && setDoorActionForState(state, selectedDoor.id, "open")}>
                          {language === "en" ? "Open" : "打开"}
                        </button>
                        <button type="button" disabled={!selectedDoorAvailable} className={selectedAction === "close" ? "active close" : "close"} onClick={() => selectedDoor && setDoorActionForState(state, selectedDoor.id, "close")}>
                          {language === "en" ? "Close" : "关闭"}
                        </button>
                      </div>
                      {selectedDoor && !selectedDoorAvailable ? (
                        <InspectorHint tone="warn">
                          {language === "en"
                            ? "This door already has two wall door switches. Choose a different door or remove one existing controller first."
                            : "这扇门已经被两个墙面门控控制。请换一扇门，或先移除已有控制源。"}
                        </InspectorHint>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ) : (
              <InspectorHint tone="warn">{language === "en" ? "Add doors before wiring this switch." : "先添加门，再给这个把手设置动作。"}</InspectorHint>
            )}
            <div className="builder-wall-switch-chip-groups">
              <WallSwitchDoorChips
                title={language === "en" ? "Open" : "打开"}
                tone="open"
                doorIds={state.openDoorIds ?? []}
                project={project}
                onSelect={onSelect}
                onRemove={(doorId) => setDoorActionForState(state, doorId, "none")}
              />
              <WallSwitchDoorChips
                title={language === "en" ? "Close" : "关闭"}
                tone="close"
                doorIds={state.closeDoorIds ?? []}
                project={project}
                onSelect={onSelect}
                onRemove={(doorId) => setDoorActionForState(state, doorId, "none")}
              />
            </div>
          </div>
        ))}
        {controlledDoorIds.size === 0 ? (
          <InspectorHint tone="warn">{language === "en" ? "Pick at least one door action for one state." : "至少给一个状态选择一扇门的开/关动作。"}</InspectorHint>
        ) : (
          <InspectorHint tone="ok">{language === "en" ? `${controlledDoorIds.size} door(s) controlled by this switch.` : `这个把手控制 ${controlledDoorIds.size} 扇门。`}</InspectorHint>
        )}
      </div>
    </div>
  );
}

function WallDoorControlUsageBadge({
  project,
  doorId,
  switchId,
}: {
  project: BuilderProject;
  doorId?: string | null;
  switchId: string;
}) {
  const { language } = useBuilderLanguage();
  if (!doorId) {
    return <span className="builder-wall-switch-usage-badge empty">{language === "en" ? "0/2" : "0/2"}</span>;
  }
  const usage = wallDoorSwitchDoorControlUsage(project, doorId, switchId);
  const className = usage.controlledByActiveSwitch
    ? "current"
    : usage.full
      ? "full"
      : usage.count > 0
        ? "shared"
        : "empty";
  const label = usage.controlledByActiveSwitch
    ? language === "en" ? `Current ${usage.count}/${usage.max}` : `当前 ${usage.count}/${usage.max}`
    : usage.full
      ? language === "en" ? `${usage.count}/${usage.max} full` : `${usage.count}/${usage.max} 已满`
      : `${usage.count}/${usage.max}`;
  const title = usage.full
    ? language === "en"
      ? "This door already has two wall door switch controllers."
      : "这扇门已经被两个墙面门控控制。"
    : usage.controlledByActiveSwitch
      ? language === "en"
        ? "This wall switch already controls this door."
        : "当前墙面门控已经控制这扇门。"
      : language === "en"
        ? "Wall door switch controller usage."
        : "墙面门控控制源占用。";
  return <span className={`builder-wall-switch-usage-badge ${className}`} title={title}>{label}</span>;
}

function WallSwitchDoorChips({
  title,
  tone,
  doorIds,
  project,
  onSelect,
  onRemove,
  readonly = false,
}: {
  title: string;
  tone: "open" | "close";
  doorIds: readonly string[];
  project: BuilderProject;
  onSelect: (selection: BuilderSelection) => void;
  onRemove: (doorId: string) => void;
  readonly?: boolean;
}) {
  const { language } = useBuilderLanguage();
  const doors = doorIds
    .map((doorId) => project.doors.find((door) => door.id === doorId))
    .filter((door): door is BuilderDoor => Boolean(door));
  return (
    <div className={`builder-wall-switch-chip-group ${tone}`}>
      <span>{title}</span>
      <div>
        {doors.length > 0 ? (
          doors.map((door) => (
            <span key={door.id} className="builder-wall-switch-chip">
              <button type="button" title={language === "en" ? "Select this door" : "选中这扇门"} onClick={() => onSelect({ kind: "door", id: door.id })}>
                {doorLabel(project, door, language)}
              </button>
              {readonly ? null : (
                <button type="button" aria-label={language === "en" ? "Remove door action" : "移除门动作"} onClick={() => onRemove(door.id)}>
                  ×
                </button>
              )}
            </span>
          ))
        ) : (
          <em>{language === "en" ? "None" : "无"}</em>
        )}
      </div>
    </div>
  );
}

function RouteSwitchInspector({
  project,
  routeSwitch,
  onChange,
  onSelect,
  hostPick,
  onStartHostPick,
}: InspectorProps & {
  project: BuilderProject;
  routeSwitch: BuilderRouteSwitch;
  onSelect: (selection: BuilderSelection) => void;
  hostPick?: BuilderPuzzleHostPick | null;
  onStartHostPick?: (request: BuilderPuzzleHostPick) => void;
}) {
  const { language } = useBuilderLanguage();
  const selectionCtx = useBuilderSelection();
  const outputs = routeSwitch.outputs.slice(0, 4);
  const targetDoors = project.doors;
  const puzzles = puzzleInstances(project);
  const robotRoomIds = [...new Set(project.robots.map((robot) => robot.roomId))];
  const robotRooms = project.rooms.filter((room) => robotRoomIds.includes(room.id));
  const patchRoute = (changes: Partial<BuilderRouteSwitch>) =>
    onChange((draft) => {
      const currentRoute = (draft.routeSwitches ?? []).find((candidate) => candidate.id === routeSwitch.id);
      const changesHost = Object.prototype.hasOwnProperty.call(changes, "hostPropId");
      const placementChange = changes.position !== undefined || changes.roomId !== undefined || changes.rotationY !== undefined;
      const hostedProp = currentRoute?.hostPropId && !changesHost && placementChange
        ? draft.props.find((prop) => prop.id === currentRoute.hostPropId)
        : null;
      if (hostedProp) {
        const manualDetach = changes.position !== undefined || changes.roomId !== undefined;
        const nextHostedProp: BuilderProp = {
          ...hostedProp,
          ...(changes.position ? { position: [changes.position[0], changes.position[1]] as [number, number] } : {}),
          ...(changes.roomId ? { roomId: changes.roomId } : {}),
          ...(changes.rotationY !== undefined ? { rotationY: changes.rotationY } : {}),
          ...(manualDetach
            ? {
                parentPropId: undefined,
                parentSurfaceId: undefined,
                localPosition: undefined,
                localRotationY: undefined,
              }
            : {}),
        };
        return projectWithHostedRouteSwitchProp(reflowAttachedProps({
          ...draft,
          props: draft.props.map((prop) => (prop.id === hostedProp.id ? nextHostedProp : prop)),
        }), routeSwitch.id, nextHostedProp);
      }
      return {
        ...draft,
        routeSwitches: (draft.routeSwitches ?? []).map((candidate) => (candidate.id === routeSwitch.id ? { ...candidate, ...changes } : candidate)),
      };
    });
  const patchOutput = (outputId: string, changes: Partial<BuilderRouteSwitchOutput>) =>
    patchRoute({ outputs: outputs.map((output) => (output.id === outputId ? { ...output, ...changes } : output)) });
  const patchOutputKeyPosition = (output: BuilderRouteSwitchOutput, position: readonly [number, number]) => {
    const containingRoom = roomAt(project, position[0], position[1]);
    patchOutput(output.id, { keyPosition: position, keyRoomId: containingRoom?.id ?? output.keyRoomId ?? routeSwitch.keyRoomId });
  };
  const patchOutputKeyRoom = (output: BuilderRouteSwitchOutput, roomId: string) => {
    const room = project.rooms.find((candidate) => candidate.id === roomId);
    patchOutput(output.id, { keyRoomId: roomId, ...(room ? { keyPosition: room.center } : {}) });
  };
  const removeOutput = (outputId: string) => patchRoute({ outputs: outputs.filter((output) => output.id !== outputId) });
  const addOutput = () => patchRoute({ outputs: [...outputs, routeDefaultOutput(project)] });
  const changeOutputKind = (output: BuilderRouteSwitchOutput, kind: BuilderRouteSwitchOutputKind) => {
    if (output.kind === kind) return;
    patchOutput(output.id, { id: output.id, kind, label: output.label, ...routeDefaultTarget(kind, project) });
  };
  const roomOptions = project.rooms.map((room) => (
    <option key={room.id} value={room.id}>
      {bl(room.label, language)}
    </option>
  ));
  const hostPropId = routeSwitch.hostPropId ?? "";
  const hostProp = hostPropId ? project.props.find((prop) => prop.id === hostPropId) ?? null : null;
  const hostPickActive = hostPick?.kind === "routeSwitch" && hostPick.routeSwitchId === routeSwitch.id;
  const hostableProps = project.props.filter((prop) => prop.roomId === routeSwitch.roomId || prop.id === hostPropId);
  const startRouteHostPick = () => onStartHostPick?.({ kind: "routeSwitch", routeSwitchId: routeSwitch.id });
  const focusRouteOutputKey = (output: BuilderRouteSwitchOutput, index: number) => {
    const keyPosition = routeOutputKeyPosition(project, routeSwitch, output, index);
    onSelect({ kind: "routeSwitch", id: routeSwitch.id });
    selectionCtx?.requestFocus({ x: keyPosition[0], z: keyPosition[1], span: 5 });
  };
  const setHostProp = (propId: string) => {
    const prop = project.props.find((candidate) => candidate.id === propId);
    patchRoute({
      hostPropId: prop?.id,
      ...(prop
        ? {
            roomId: prop.roomId,
            position: prop.position,
            rotationY: prop.rotationY,
            wallMount: undefined,
            outputs: routeSwitch.outputs.map((output) => ({ ...output, keyRoomId: undefined, keyPosition: undefined })),
          }
        : {}),
    });
  };

  return (
    <div className="builder-fields">
      <div className="builder-card builder-route-card-editor">
        <h3>{language === "en" ? "Control Route Console" : "管制路由台"}</h3>
        <label>
          <span>{language === "en" ? "Name" : "名称"}</span>
          <input value={routeSwitch.label} onChange={(event) => patchRoute({ label: event.target.value })} />
        </label>
        <div className="builder-row">
          <label>
            <span>{language === "en" ? "Room" : "所在房间"}</span>
            <select value={routeSwitch.roomId} onChange={(event) => patchRoute({ roomId: event.target.value })}>
              {roomOptions}
            </select>
          </label>
        </div>
        <p className="builder-hint">{language === "en" ? "Each output spawns its own authorization orb; drag the numbered orbs in 2D/3D preview." : "每个输出都会生成一个授权球；在 2D/3D 预览里拖动对应编号的小球。"}</p>
        <div className="builder-row">
          <Stepper label={language === "en" ? "X (m)" : "X (米)"} value={routeSwitch.position[0]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patchRoute({ position: [value, routeSwitch.position[1]] })} />
          <Stepper label={language === "en" ? "Z (m)" : "Z (米)"} value={routeSwitch.position[1]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patchRoute({ position: [routeSwitch.position[0], value] })} />
        </div>
        <AngleControl label={language === "en" ? "Facing" : "朝向"} valueRad={routeSwitch.rotationY} onChange={(value) => patchRoute({ rotationY: value })} />
      </div>

      <div className="builder-card">
        <h3>{language === "en" ? "Control Station Furniture" : "路由台家具"}</h3>
        <div className={`builder-host-card ${hostPickActive ? "active" : ""}`}>
          <div className="builder-host-current">
            <i>{hostProp ? "❑" : "⌁"}</i>
            <span>
              <b>{language === "en" ? "Interaction Host" : "交互家具"}</b>
              <em>{hostProp ? builderPropInspectorLabel(hostProp, language) : language === "en" ? "Standalone route console" : "独立路由台"}</em>
            </span>
          </div>
          <div className="builder-host-actions">
            <button type="button" className={hostPickActive ? "active" : ""} onClick={startRouteHostPick} disabled={!onStartHostPick || project.props.length === 0}>
              {hostPickActive ? (language === "en" ? "Picking…" : "选择中…") : language === "en" ? "Pick Furniture" : "更换家具"}
            </button>
            {hostProp ? (
              <>
                <button type="button" onClick={() => onSelect({ kind: "prop", id: hostProp.id })}>{language === "en" ? "Jump" : "跳到家具"}</button>
                <button type="button" onClick={() => setHostProp("")}>{language === "en" ? "Standalone" : "恢复独立"}</button>
              </>
            ) : null}
          </div>
        </div>
        <label>
          <span>{language === "en" ? "Quick Select Host" : "快速选择承载"}</span>
          <select value={hostPropId} onChange={(event) => setHostProp(event.target.value)}>
            <option value="">{language === "en" ? "Standalone route console" : "独立路由台"}</option>
            {hostableProps.map((prop) => (
              <option key={prop.id} value={prop.id}>
                {builderPropInspectorLabel(prop, language)}
              </option>
            ))}
          </select>
        </label>
        {project.props.length === 0 ? (
          <InspectorHint tone="warn">{language === "en" ? "Place furniture first, then use Pick Furniture." : "先放置家具 / 展柜 / 面板，再使用「更换家具」。"}</InspectorHint>
        ) : (
          <p className="builder-hint">{language === "en" ? "Hosted route switches keep their outputs and authorization orbs; only the visible interaction moves onto the selected furniture." : "承载后保留输出与授权球；只有可交互的路由台外观换到选中家具上。"}</p>
        )}
      </div>

      <div className="builder-card builder-route-outputs-card">
        <h3>{language === "en" ? "Outputs (1-4)" : "输出（1-4）"}</h3>
        {outputs.map((output, index) => {
          const keyPosition = routeOutputKeyPosition(project, routeSwitch, output, index);
          return (
            <div key={output.id} className="builder-route-output-row">
              <div className="builder-route-output-head">
                <b>{index + 1}</b>
                <label>
                  <span>{language === "en" ? "Action" : "动作"}</span>
                  <select value={output.kind} onChange={(event) => changeOutputKind(output, event.target.value as BuilderRouteSwitchOutputKind)}>
                    {(Object.keys(routeOutputKindLabelsZh) as BuilderRouteSwitchOutputKind[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {routeOutputKindLabel(kind, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="builder-danger" disabled={outputs.length <= 1} title={language === "en" ? "Remove this output" : "移除这个输出"} onClick={() => removeOutput(output.id)}>
                  ✕
                </button>
                <button
                  type="button"
                  className={`builder-route-output-orb-jump output-${index + 1}`}
                  title={language === "en" ? `Select and focus authorization orb ${index + 1}` : `选中并跳到授权球 ${index + 1}`}
                  onClick={() => focusRouteOutputKey(output, index)}
                >
                  ●{index + 1}
                </button>
              </div>
              <RouteOutputTargetSelect
                project={project}
                output={output}
                targetDoors={targetDoors}
                puzzles={puzzles}
                robotRooms={robotRooms}
                onChange={(changes) => patchOutput(output.id, changes)}
                onSelect={onSelect}
              />
              <details className="builder-route-output-advanced">
                <summary>{language === "en" ? "Orb position / label" : "授权球位置 / 名称"}</summary>
                <label className="builder-route-output-label">
                  <span>{language === "en" ? "Display Name" : "显示名"}</span>
                  <input
                    value={output.label ?? ""}
                    placeholder={routeOutputAutoLabel(project, output, language)}
                    onChange={(event) => patchOutput(output.id, { label: event.target.value })}
                  />
                </label>
                <div className="builder-route-output-key-field">
                  <div className="builder-route-output-orb-label">
                    <span>{language === "en" ? `Orb ${index + 1}` : `授权球 ${index + 1}`}</span>
                    <em>{language === "en" ? "Defaults near the console; drag the orb to detach." : "默认贴近路由台；拖动小球后独立摆放。"}</em>
                    <button type="button" onClick={() => focusRouteOutputKey(output, index)}>
                      {language === "en" ? "Jump to orb" : "跳到授权球"}
                    </button>
                  </div>
                  <label className="builder-route-output-room-field">
                    <span>{language === "en" ? "Room" : "房间"}</span>
                    <select value={output.keyRoomId ?? (routeSwitch.keyPosition ? routeSwitch.keyRoomId : routeSwitch.roomId)} onChange={(event) => patchOutputKeyRoom(output, event.target.value)}>
                      {roomOptions}
                    </select>
                  </label>
                  <Stepper label="X" value={keyPosition[0]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patchOutputKeyPosition(output, [value, keyPosition[1]])} />
                  <Stepper label="Z" value={keyPosition[1]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patchOutputKeyPosition(output, [keyPosition[0], value])} />
                </div>
              </details>
            </div>
          );
        })}
        <button type="button" disabled={outputs.length >= 4} onClick={addOutput}>
          ＋ {language === "en" ? "Add Output" : "添加输出"}
        </button>
        {targetDoors.length === 0 ? <InspectorHint tone="warn">{language === "en" ? "⚠ No doors yet. Add a door, then wire it to the route console." : "⚠ 还没有门。先添加一扇门，再接到路由台。"}</InspectorHint> : null}
        {puzzles.length === 0 ? <InspectorHint tone="warn">{language === "en" ? "⚠ No puzzle stations yet. A puzzle output needs a puzzle placed first." : "⚠ 还没有谜题台。谜题输出需要先放一座谜题。"}</InspectorHint> : null}
        {robotRooms.length === 0 ? <InspectorHint tone="warn">{language === "en" ? "⚠ No robot rooms yet. A robot output needs robots deployed first." : "⚠ 还没有机器人房间。机器人输出需要先部署机器人。"}</InspectorHint> : null}
      </div>

      <CollapsibleCard title={language === "en" ? "Image2 Console Preview" : "Image2 控制台预览"} badge={language === "en" ? "Player View" : "玩家所见"}>
        <BuilderImage2StatePreview key={routeSwitch.id} routeSwitch={routeSwitch} />
      </CollapsibleCard>
    </div>
  );
}

function RouteOutputTargetSelect({
  project,
  output,
  targetDoors,
  puzzles,
  robotRooms,
  onChange,
  onSelect,
}: {
  project: BuilderProject;
  output: BuilderRouteSwitchOutput;
  targetDoors: readonly BuilderDoor[];
  puzzles: readonly BuilderPuzzleInstance[];
  robotRooms: readonly BuilderRoom[];
  onChange: (changes: Partial<BuilderRouteSwitchOutput>) => void;
  onSelect: (selection: BuilderSelection) => void;
}) {
  const { language } = useBuilderLanguage();
  if (output.kind === "open_door") {
    const options = targetDoors.some((door) => door.id === output.doorId) || !output.doorId ? targetDoors : [
      ...targetDoors,
      project.doors.find((door) => door.id === output.doorId),
    ].filter((door): door is BuilderDoor => Boolean(door));
    return (
      <div className="builder-route-target-field">
        <label>
          <span>{language === "en" ? "Target Door" : "目标门"}</span>
          <select value={output.doorId ?? ""} onChange={(event) => onChange({ doorId: event.target.value || undefined, puzzleId: undefined, robotRoomId: undefined })}>
            <option value="">{language === "en" ? "Choose door" : "选择门"}</option>
            {options.map((door) => (
              <option key={door.id} value={door.id}>
                {doorLabel(project, door, language)} · {door.lockType === "none" ? (language === "en" ? "Route lock" : "路由锁") : bl(builderLockLabels[door.lockType], language)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!output.doorId} title={language === "en" ? "Select target door" : "选中目标门"} onClick={() => output.doorId && onSelect({ kind: "door", id: output.doorId })}>
          ⌖
        </button>
      </div>
    );
  }
  if (output.kind === "reveal_puzzle") {
    return (
      <div className="builder-route-target-field">
        <label>
          <span>{language === "en" ? "Puzzle Station" : "谜题台"}</span>
          <select value={output.puzzleId ?? ""} onChange={(event) => onChange({ puzzleId: event.target.value || undefined, doorId: undefined, robotRoomId: undefined })}>
            <option value="">{language === "en" ? "Choose puzzle" : "选择谜题"}</option>
            {puzzles.map((puzzle) => (
              <option key={puzzle.id} value={puzzle.id}>
                {bl(puzzleKindEntry(puzzle.kind).label, language)} · {bl(project.rooms.find((room) => room.id === puzzle.roomId)?.label ?? (language === "en" ? "Unknown Room" : "未知房间"), language)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!output.puzzleId} title={language === "en" ? "Select puzzle station" : "选中谜题台"} onClick={() => output.puzzleId && onSelect({ kind: "puzzle", id: output.puzzleId })}>
          ⌖
        </button>
      </div>
    );
  }
  return (
    <div className="builder-route-target-field">
      <label>
        <span>{language === "en" ? "Robot Room" : "机器人房间"}</span>
        <select value={output.robotRoomId ?? ""} onChange={(event) => onChange({ robotRoomId: event.target.value || undefined, doorId: undefined, puzzleId: undefined })}>
          <option value="">{language === "en" ? "Choose room" : "选择房间"}</option>
          {robotRooms.map((room) => (
            <option key={room.id} value={room.id}>
              {bl(room.label, language)} · {project.robots.filter((robot) => robot.roomId === room.id).reduce((sum, robot) => sum + robot.count, 0)} {language === "en" ? "bots" : "台"}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={!output.robotRoomId} title={language === "en" ? "Select robot room" : "选中机器人房间"} onClick={() => output.robotRoomId && onSelect({ kind: "room", id: output.robotRoomId })}>
        ⌖
      </button>
    </div>
  );
}

function routeDefaultOutput(project: BuilderProject): BuilderRouteSwitchOutput {
  const targetDoor = project.doors.find((door) => door.lockType !== "none") ?? project.doors[0];
  if (targetDoor) return { id: createBuilderId("route_out"), kind: "open_door", doorId: targetDoor.id };
  const puzzle = puzzleInstances(project)[0];
  if (puzzle) return { id: createBuilderId("route_out"), kind: "reveal_puzzle", puzzleId: puzzle.id };
  const robotRoomId = project.robots[0]?.roomId;
  if (robotRoomId) return { id: createBuilderId("route_out"), kind: "start_robots", robotRoomId };
  return { id: createBuilderId("route_out"), kind: "open_door" };
}

function puzzleDefaultSuccessOutput(project: BuilderProject): BuilderRouteSwitchOutput {
  const robotRoomId = project.robots[0]?.roomId;
  if (robotRoomId) return { id: createBuilderId("puzzle_out"), kind: "start_robots", robotRoomId };
  return { ...routeDefaultOutput(project), id: createBuilderId("puzzle_out") };
}

function routeDefaultTarget(kind: BuilderRouteSwitchOutputKind, project: BuilderProject): Partial<BuilderRouteSwitchOutput> {
  if (kind === "open_door") return { doorId: (project.doors.find((door) => door.lockType !== "none") ?? project.doors[0])?.id, puzzleId: undefined, robotRoomId: undefined };
  if (kind === "reveal_puzzle") return { puzzleId: puzzleInstances(project)[0]?.id, doorId: undefined, robotRoomId: undefined };
  return { robotRoomId: project.robots[0]?.roomId, doorId: undefined, puzzleId: undefined };
}

function routeOutputAutoLabel(project: BuilderProject, output: BuilderRouteSwitchOutput, language: GameLanguage) {
  if (output.kind === "open_door") {
    const door = project.doors.find((candidate) => candidate.id === output.doorId);
    if (language === "en") return door ? `Open ${doorLabel(project, door, language)}` : "Open routed door";
    return door ? `打开 ${doorLabel(project, door, language)}` : "打开路由门";
  }
  if (output.kind === "reveal_puzzle") {
    const puzzle = puzzleInstances(project).find((candidate) => candidate.id === output.puzzleId);
    if (language === "en") return puzzle ? `Wire ${bl(puzzleKindEntry(puzzle.kind).label, language)}` : "Wire puzzle";
    return puzzle ? `接入 ${puzzleKindEntry(puzzle.kind).label}` : "接入谜题";
  }
  const room = project.rooms.find((candidate) => candidate.id === output.robotRoomId);
  if (language === "en") return room ? `Wake ${bl(room.label, language)}` : "Wake robots";
  return room ? `唤醒 ${room.label}` : "唤醒机器人";
}

function doorLabel(project: BuilderProject, door: BuilderDoor, language: GameLanguage) {
  return bl(builderDoorDisplayLabel(door, project), language);
}

function PropInspector({
  project,
  prop,
  onChange,
  snapOn,
  onToggleSnap,
  onDuplicate,
  onRemove,
}: InspectorProps & {
  project: BuilderProject;
  prop: BuilderProp;
  snapOn: boolean;
  onToggleSnap: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { language } = useBuilderLanguage();
  const patch = (changes: Partial<BuilderProp>) =>
    onChange((draft) => {
      const parentById = new Map(draft.props.map((candidate) => [candidate.id, candidate]));
      const manualDetach = changes.position !== undefined || changes.elevation !== undefined || changes.roomId !== undefined;
      return reflowAttachedProps({
        ...draft,
        props: draft.props.map((candidate) => {
          if (candidate.id !== prop.id) return candidate;
          const next: BuilderProp = { ...candidate, ...changes };
          if (manualDetach) {
            return {
              ...next,
              parentPropId: undefined,
              parentSurfaceId: undefined,
              localPosition: undefined,
              localRotationY: undefined,
            };
          }
          if (changes.rotationY !== undefined && next.parentPropId) {
            const parent = parentById.get(next.parentPropId);
            return parent ? { ...next, localRotationY: changes.rotationY - parent.rotationY } : next;
          }
          return next;
        }),
      });
    });
  const entry = propEntry(prop.modelKey);
  const room = project.rooms.find((candidate) => candidate.id === prop.roomId);
  const parent = prop.parentPropId ? project.props.find((candidate) => candidate.id === prop.parentPropId) ?? null : null;
  const parentEntry = parent ? propEntry(parent.modelKey) : null;
  const childCount = attachedChildCount(project, prop.id);
  const quarantinedAsset = isQuarantined(prop.modelKey);
  return (
    <div className="builder-fields">
      <div className="builder-card builder-prop-card">
        <div className="builder-prop-preview">
          <AssetImageThumb modelKey={prop.modelKey} />
          <div>
            <strong>{bl(entry?.label, language) || prop.modelKey}</strong>
            <em>{entry ? `${bl(entry.group, language)} · ${entry.sizeMeters[0].toFixed(1)}×${entry.sizeMeters[2].toFixed(1)} ${language === "en" ? "m" : "米"}` : (language === "en" ? "Unknown Asset" : "未知资产")}</em>
            <i className={`builder-collision-flag ${entry?.solid ? "solid" : ""}`}>{entry?.solid ? (language === "en" ? "▣ Solid Collision" : "▣ 实体碰撞") : (language === "en" ? "◌ Decor · Pass-Through" : "◌ 装饰 · 可穿过")}</i>
            {parent ? (
              <i className="builder-collision-flag solid">
                {language === "en" ? `⌁ On ${bl(parentEntry?.label, language) || parent.modelKey}` : `⌁ 放在「${parentEntry?.label ?? parent.modelKey}」上`}
              </i>
            ) : null}
            {childCount > 0 ? (
              <i className="builder-collision-flag solid">
                {language === "en" ? `⌁ Carries ${childCount} item${childCount === 1 ? "" : "s"}` : `⌁ 承载 ${childCount} 个小物件`}
              </i>
            ) : null}
          </div>
        </div>
        <label>
          <span>{language === "en" ? "Room" : "所在房间"}</span>
          <select value={prop.roomId} onChange={(event) => patch({ roomId: event.target.value })}>
            {project.rooms.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {quarantinedAsset ? (
        <div className="builder-card builder-quarantine-note">
          <InspectorHint tone="warn">{language === "en" ? "⚠ This asset is hidden from the catalog: already-placed instances are unaffected." : "⚠ 该资产已从目录隐藏：已放置的实例不受影响。"}</InspectorHint>
          <button type="button" onClick={() => restoreAsset(prop.modelKey)}>↺ {language === "en" ? "Restore to Catalog" : "恢复到目录"}</button>
        </div>
      ) : null}
      {entry?.group === "故事线索" ? (
        <div className="builder-card builder-story-card">
          <h3>🖼 {language === "en" ? "Story" : "故事"}</h3>
          <label>
            <span>{language === "en" ? "Title (painting name the player sees)" : "标题（玩家看到的画作名）"}</span>
            <input
              value={prop.story?.title ?? ""}
              placeholder={bl(entry.label, language)}
              onChange={(event) => patch({ story: { ...prop.story, title: event.target.value || undefined } })}
            />
          </label>
          <label>
            <span>{language === "en" ? "Clue Text" : "线索文本"}</span>
            <textarea
              className="builder-story-clue"
              rows={3}
              value={prop.story?.clue ?? ""}
              placeholder={language === "en" ? "What should the player read when they step close?" : "玩家凑近时想让他读到什么？"}
              onChange={(event) => patch({ story: { ...prop.story, clue: event.target.value || undefined } })}
            />
          </label>
          <label>
            <span>{language === "en" ? "Goal Hint (optional)" : "目标提示（可选）"}</span>
            <input
              value={prop.story?.hint ?? ""}
              placeholder={language === "en" ? "e.g. The elevator code is hidden in the painting" : "例：电梯密码藏在画里"}
              onChange={(event) => patch({ story: { ...prop.story, hint: event.target.value || undefined } })}
            />
          </label>
          <p className="builder-hint">{language === "en" ? "Players read it by approaching the painting during playtest; layout, door locks and puzzles are never changed." : "试玩时玩家走近画作即可阅读；布局、门锁、谜题不会被改动。"}</p>
        </div>
      ) : null}
      <div className="builder-card">
        <h3>{language === "en" ? "Transform" : "变换"}</h3>
        <div className="builder-row">
          <Stepper label={language === "en" ? "X (m)" : "X (米)"} value={prop.position[0]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patch({ position: [value, prop.position[1]] })} />
          <Stepper label={language === "en" ? "Z (m)" : "Z (米)"} value={prop.position[1]} min={-60} max={60} step={0.5} decimals={1} onChange={(value) => patch({ position: [prop.position[0], value] })} />
        </div>
        <div className="builder-row">
          <Stepper
            label={language === "en" ? "Y (m)" : "Y (米)"}
            value={prop.elevation ?? defaultPropElevation(prop.modelKey)}
            min={0}
            max={4}
            step={0.05}
            decimals={2}
            onChange={(value) => patch({ elevation: value })}
          />
        </div>
        <div className="builder-flagrow">
          <ToggleChip label={language === "en" ? "On floor" : "地面"} on={false} onToggle={() => patch({ elevation: 0 })} title={language === "en" ? "Place on the floor (height 0)" : "放到地面（高度 0）"} />
          <ToggleChip label={language === "en" ? "On table" : "桌面"} on={false} onToggle={() => patch({ elevation: 0.78 })} title={language === "en" ? "Sit on a table top (~0.78m)" : "放到桌面高度（约 0.78 米）"} />
          <ToggleChip label={language === "en" ? "Hang high" : "挂高"} on={false} onToggle={() => patch({ elevation: 1.5 })} title={language === "en" ? "Hang at eye level (~1.5m)" : "挂到视线高度（约 1.5 米）"} />
        </div>
        <AngleControl label={language === "en" ? "Facing" : "朝向"} valueRad={prop.rotationY} onChange={(value) => patch({ rotationY: value })} />
        <SliderField label={language === "en" ? "Scale" : "缩放"} value={prop.scale} min={0.5} max={2} step={0.1} unit="×" decimals={1} onChange={(value) => patch({ scale: value })} />
        <div className="builder-flagrow">
          <ToggleChip label={language === "en" ? "Snap to 0.5m Grid" : "网格吸附 0.5m"} on={snapOn} onToggle={onToggleSnap} title={language === "en" ? "When off, dragging/placing no longer snaps to the grid" : "关闭后拖动/放置不再对齐网格"} />
        </div>
      </div>
      {room && !isInsideRoom(room, prop) ? <InspectorHint tone="warn">{language === "en" ? "⚠ The furniture is outside its room; drag it back inside." : "⚠ 家具在所属房间外面，拖回房间内。"}</InspectorHint> : null}
      <div className="builder-card builder-danger-zone">
        <h3>{language === "en" ? "Instance Actions" : "实例操作"}</h3>
        <div className="builder-row">
          <button type="button" onClick={onDuplicate} title={language === "en" ? "Duplicate this furniture (Cmd/Ctrl+R)" : "复制这件家具 (Cmd/Ctrl+R)"}>⧉ {language === "en" ? "Duplicate" : "复制"}</button>
          <button type="button" className="builder-danger" onClick={onRemove} title={language === "en" ? "Delete only this placed furniture (Delete); the catalog asset is unaffected" : "只删除这件已放置的家具 (Delete)，目录资产不受影响"}>
            ✕ {language === "en" ? "Delete Instance" : "删除实例"}
          </button>
        </div>
      </div>
      <p className="builder-hint">{language === "en" ? "You can drag it directly in 2D / 3D. R rotate · Cmd/Ctrl+R duplicate · Delete remove." : "2D / 3D 都可以直接拖动。R 旋转 · Cmd/Ctrl+R 复制 · Delete 删除。"}</p>
    </div>
  );
}

function RobotInspector({
  project,
  robot,
  onChange,
  onSelect,
  onHover,
}: InspectorProps & {
  project: BuilderProject;
  robot: BuilderProject["robots"][number];
  onSelect: (selection: BuilderSelection) => void;
  onHover?: (selection: BuilderSelection) => void;
}) {
  const { language } = useBuilderLanguage();
  const patch = (changes: Partial<typeof robot>) =>
    onChange((draft) => ({ ...draft, robots: draft.robots.map((candidate) => (candidate.id === robot.id ? { ...candidate, ...changes } : candidate)) }));
  const waveLabel = robot.wave?.presentation?.label ?? robot.wave?.label ?? robot.wave?.id;
  const triggerRoom = project.rooms.find((room) => room.id === robot.wave?.triggerId);
  const reinforcement = robot.wave?.reinforcement;
  const baseRobotEntries = builderRobotCatalog.filter((entry) => !entry.presetId);
  const presetRobotEntries = builderRobotCatalog.filter((entry) => entry.presetId);
  const bossPresetActive = Boolean(robot.presetId) || isMuseumCuratorBossRobot(robot);
  const applyBaseArchetype = (archetype: BuilderRobotArchetype) => patch({ archetype, presetId: undefined, combat: undefined, tier: undefined });
  const applyPreset = (presetId: NonNullable<(typeof presetRobotEntries)[number]["presetId"]>) => patch(builderRobotPresetDefaults(presetId));
  const chainOrders = builderWaveChainOrdersForRoom(project, robot.roomId);
  const maxChainOrder = chainOrders[chainOrders.length - 1] ?? 0;
  const waveOptions = Array.from({ length: Math.max(1, maxChainOrder + 1) }, (_, index) => index + 1);
  const waveChain = robot.waveChain;
  const isLastChainWave = Boolean(waveChain && waveChain.order === maxChainOrder);
  const patchWaveChain = (changes: Partial<NonNullable<typeof waveChain>>, preferredOrder = waveChain?.order ?? 1) => {
    const base = builderWaveChainWithOrder(project, robot, preferredOrder);
    patch({ waveChain: { ...base, ...changes } });
  };
  const robotWaveId = builderRobotAuthoredWaveId(robot);
  const guardDoorOptions = [...project.doors].sort((left, right) => robotDistanceToDoor(project, left, robot) - robotDistanceToDoor(project, right, robot));
  const explicitGuardDoorIds = guardDoorOptions
    .filter((door) => builderDoorSurviveRobotIds(door).includes(robot.id))
    .map((door) => door.id);
  const waveGuardDoorIds = robotWaveId
    ? guardDoorOptions.filter((door) => builderDoorWaveIds(door).includes(robotWaveId)).map((door) => door.id)
    : [];
  const linkedGuardDoorIds = [...new Set([...explicitGuardDoorIds, ...waveGuardDoorIds])];
  const addableGuardDoors = guardDoorOptions.filter((door) => !explicitGuardDoorIds.includes(door.id));
  const toggleGuardDoor = (doorId: string) => {
    onChange((draft) => ({
      ...draft,
      doors: draft.doors.map((candidate) => {
        if (candidate.id !== doorId) return candidate;
        const selected = new Set(builderDoorSurviveRobotIds(candidate));
        if (selected.has(robot.id)) selected.delete(robot.id);
        else selected.add(robot.id);
        const orderedRobotIds = draft.robots.map((entry) => entry.id).filter((id) => selected.has(id));
        if (selected.has(robot.id) && !orderedRobotIds.includes(robot.id)) orderedRobotIds.push(robot.id);
        return {
          ...candidate,
          lockType: "survive_wave",
          surviveRobotIds: orderedRobotIds,
          surviveRobotId: orderedRobotIds[0],
        };
      }),
    }));
  };
  const clearAction = waveChain?.clearActions?.find((action) => action.kind === "open_door" || action.kind === "unlock_door");
  const pressureLoop = waveChain?.pressureLoop;
  return (
    <div className="builder-fields">
      <div className="builder-card">
        <h3>{language === "en" ? "Type" : "类型"}</h3>
        <label className="builder-robot-name-field">
          <span>{language === "en" ? "Name" : "名称"}</span>
          <input
            value={robot.label ?? ""}
            placeholder={robotInspectorLabel({ ...robot, label: undefined }, language)}
            onChange={(event) => patch({ label: event.target.value.trim() ? event.target.value : undefined })}
          />
        </label>
        <div className="builder-archgrid-heading">{language === "en" ? "Base Units" : "基础单位"}</div>
        <div className="builder-archgrid">
          {baseRobotEntries.map((entry) => (
            <button
              key={entry.archetype}
              type="button"
              className={!bossPresetActive && robot.archetype === entry.archetype ? "active" : ""}
              onClick={() => applyBaseArchetype(entry.archetype)}
            >
              <RobotThumb archetype={entry.archetype} />
              <span>{bl(entry.label, language)}</span>
            </button>
          ))}
        </div>
        {presetRobotEntries.length > 0 ? (
          <>
            <div className="builder-archgrid-heading">{language === "en" ? "Boss Preset" : "首领预设"}</div>
            <div className="builder-archgrid builder-archgrid-presets">
              {presetRobotEntries.map((entry) => (
                <button
                  key={entry.id ?? entry.presetId}
                  type="button"
                  className={entry.presetId && isBuilderRobotPresetActive(robot, entry.presetId) ? "active" : ""}
                  onClick={() => entry.presetId ? applyPreset(entry.presetId) : undefined}
                  title={entry.hint ? bl(entry.hint, language) : undefined}
                >
                  <RobotThumb archetype={entry.archetype} />
                  <span>
                    {bl(entry.label, language)}
                    {entry.hint ? <small>{bl(entry.hint, language)}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Wave" : "波次"}</h3>
        <div className="builder-row">
          <Stepper label={language === "en" ? "Count" : "数量"} value={robot.count} min={1} max={4} step={1} unit={language === "en" ? "" : " 台"} onChange={(value) => patch({ count: value })} />
          <label>
            <span>{language === "en" ? "Strength" : "强度"}</span>
            <div className="builder-segment">
              {(["normal", "elite"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={(robot.tier ?? "normal") === tier ? "active" : ""}
                  onClick={() => patch({ tier: tier === "normal" ? undefined : (tier as EnemyTierId) })}
                >
                  {tier === "normal" ? (language === "en" ? "Normal" : "普通") : (language === "en" ? "Elite" : "精英")}
                </button>
              ))}
            </div>
          </label>
        </div>
        <ThreatMeter archetype={robot.archetype} count={robot.count} tier={robot.tier} />
        <label>
          <span>{language === "en" ? "Chain Wave" : "所属波次"}</span>
          <select
            value={waveChain?.order ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              const order = Number(raw);
              if (!raw || !Number.isFinite(order)) patch({ waveChain: undefined });
              else patch({ waveChain: builderWaveChainWithOrder(project, robot, order) });
            }}
          >
            <option value="">{language === "en" ? "Room trigger only" : "仅按房间触发"}</option>
            {waveOptions.map((order) => (
              <option key={order} value={order}>
                {language === "en" ? `Wave ${order}` : `波次 ${order}`}
              </option>
            ))}
          </select>
        </label>
        {waveChain ? (
          <div className="builder-wavechain-mini">
            {waveOptions.slice(0, Math.max(maxChainOrder, waveChain.order)).map((order) => (
              <span key={order} className={order === waveChain.order ? "active" : chainOrders.includes(order) ? "ready" : ""}>
                {order}
              </span>
            ))}
            {clearAction?.doorId ? <b>{language === "en" ? "door" : "开门"}</b> : null}
            {pressureLoop?.enabled ? <em title={language === "en" ? "Pressure loop does not block doors" : "压力循环不阻塞门"}>∞</em> : null}
          </div>
        ) : null}
        {waveChain ? (
          <div className="builder-wavechain-pressure">
            <ToggleChip
              label={language === "en" ? "Final Pressure Loop" : "最后压力循环"}
              on={Boolean(pressureLoop?.enabled)}
              onToggle={() => {
                if (!isLastChainWave) return;
                patchWaveChain({
                  pressureLoop: pressureLoop?.enabled
                    ? undefined
                    : { enabled: true, archetype: robot.archetype, count: 1, startsAfter: 0.6, every: 7, maxAlive: 2 },
                });
              }}
              title={language === "en" ? "Only the final wave can loop pressure; it never blocks doors." : "只有最后波次可以循环施压，永远不阻塞门。"}
            />
            {!isLastChainWave ? <small>{language === "en" ? "Only the current final wave can enable this." : "只有当前最后波次可以开启。"}</small> : null}
          </div>
        ) : null}
        {robot.wave ? (
          <InspectorHint tone="ok">
            {language === "en"
              ? `${bl(waveLabel ?? "Official wave", language)} · ${robot.wave.role === "reinforcement" ? "reinforcement" : "initial group"} · trigger: ${triggerRoom ? bl(triggerRoom.label, language) : robot.wave.triggerId ?? "stored config"}${reinforcement ? ` · after ${reinforcement.startsAfter}s / every ${reinforcement.every}s` : ""}`
              : `${waveLabel ?? "官方波次"} · ${robot.wave.role === "reinforcement" ? "增援组" : "初始组"} · 触发：${triggerRoom?.label ?? robot.wave.triggerId ?? "已存配置"}${reinforcement ? ` · ${reinforcement.startsAfter}s 后 / 每 ${reinforcement.every}s` : ""}`}
          </InspectorHint>
        ) : null}
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Guard Doors" : "关联门"}</h3>
        <label>
          <span>{language === "en" ? "Add Door" : "选择门"}</span>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) toggleGuardDoor(event.target.value);
            }}
          >
            <option value="">{language === "en" ? "Choose a door..." : "选择要守的门..."}</option>
            {addableGuardDoors.map((door) => (
              <option key={door.id} value={door.id}>
                {bl(builderDoorDisplayLabel(door, project), language)}
              </option>
            ))}
          </select>
        </label>
        <div className="builder-robot-door-grid">
          {guardDoorOptions.map((door) => {
            const explicit = explicitGuardDoorIds.includes(door.id);
            const waveLocked = waveGuardDoorIds.includes(door.id);
            const linked = explicit || waveLocked;
            return (
              <button
                key={door.id}
                type="button"
                className={`${linked ? "active" : ""} ${waveLocked && !explicit ? "wave-active" : ""}`}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey) onSelect({ kind: "door", id: door.id });
                  else toggleGuardDoor(door.id);
                }}
                onMouseEnter={() => onHover?.({ kind: "door", id: door.id })}
                onMouseLeave={() => onHover?.(null)}
                title={language === "en" ? "Click to add/remove this robot as a door guard; Cmd/Ctrl-click to select the door." : "点击增删这个机器人的守门关系；Cmd/Ctrl 点击选中门。"}
              >
                <strong>{bl(builderDoorDisplayLabel(door, project), language)}</strong>
                <span>{bl(builderLockLabels[door.lockType], language)}</span>
                <small>{language === "en" ? `${robotDistanceToDoor(project, door, robot).toFixed(1)}m` : `${robotDistanceToDoor(project, door, robot).toFixed(1)} 米`}</small>
              </button>
            );
          })}
        </div>
        {linkedGuardDoorIds.length > 0 ? (
          <InspectorHint tone="ok">
            {language === "en"
              ? `✓ This robot is part of ${linkedGuardDoorIds.length} door condition(s).`
              : `✓ 这个机器人参与 ${linkedGuardDoorIds.length} 个门条件。`}
          </InspectorHint>
        ) : (
          <InspectorHint tone="warn">{language === "en" ? "Pick a door to make this robot part of that door's clear condition." : "选择一扇门，让这个机器人参与那扇门的清剿条件。"}</InspectorHint>
        )}
      </div>
      <div className="builder-card">
        <h3>{language === "en" ? "Deployment" : "部署"}</h3>
        <label>
          <span>{language === "en" ? "Room" : "所在房间"}</span>
          <select value={robot.roomId} onChange={(event) => patch({ roomId: event.target.value })}>
            {project.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {bl(room.label, language)}
              </option>
            ))}
          </select>
        </label>
        <p className="builder-hint">{language === "en" ? "This wave triggers when the player enters that room. You can drag the deploy point directly on the canvas." : "玩家进入该房间时触发这一波。画布里可直接拖动部署点。"}</p>
      </div>
    </div>
  );
}

function isInsideRoom(room: BuilderRoom, prop: BuilderProp) {
  return (
    Math.abs(prop.position[0] - room.center[0]) <= room.size[0] / 2 &&
    Math.abs(prop.position[1] - room.center[1]) <= room.size[1] / 2
  );
}
