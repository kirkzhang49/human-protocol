import type { EnemyTierId, EnemyTierOverrideConfig } from "../game/config/enemyTiers";
import type {
  AudioCueConfig,
  CameraImpactConfig,
  DoorLockDefinition,
  DoorState,
  LevelDoorOpenVisualPolicy,
  LevelDefinition,
  LevelInteractionType,
  LevelObjectiveTriggerType,
  LevelPuzzleActorHitboxDefinition,
  LevelPuzzleActorInputMode,
  LevelPuzzleActorKind,
  LevelPuzzleColorKey,
  LevelPuzzleDefinition,
  LevelSwitchPresentationDefinition,
  RewardPulseConfig,
  RoomAestheticConfig,
  RoomGeometryConfig,
  RoomMood,
  Vec3Tuple,
  WavePresentationDefinition,
  WaveReward,
} from "../game/config/schema/levelConfig";
import type { BuilderRoomShape } from "./BuilderRoomShape";

export type BuilderRoomStyle = "maintenance" | "sterile" | "hazard" | "residential" | "exit" | "museum" | "core";

export type BuilderLockType = "none" | "key_item" | "survive_wave" | "puzzle_complete" | "switch_state";

/** Premium door-art family for a placed door. "auto" keeps the lock-driven default. */
export type BuilderDoorFamily = "auto" | "residential" | "clinic" | "reclamation" | "industrial" | "elevator";

/**
 * Puzzle flavor behind a puzzle_complete lock. Absent on legacy drafts =
 * "color_sequence" (the original orb lock). The 2D puzzles reuse the
 * existing runtime systems (CircuitGrid/SurveillanceMatch/ValveMatrix/ArchiveMerge/
 * GalleryReading overlays) through curated solvable presets at compile time.
 *
 * The main /build chips surface the premium families (color_sequence,
 * circuit_grid, archive_merge, valve_matrix). Legacy kinds stay valid for old
 * drafts and official levels, but are hidden from fresh chips.
 */
export type BuilderPuzzleKind =
  | "color_sequence"
  | "code_lock"
  | "circuit_grid"
  | "surveillance_match"
  | "valve_matrix"
  | "archive_merge"
  | "gallery_reading";

/** Placeable puzzle sub-objects. Orb roles double as the hit-sequence color. */
export type BuilderPuzzleComponentRole =
  | "terminal"
  | "orb_red"
  | "orb_blue"
  | "orb_green"
  | "orb_yellow"
  | "orb_purple"
  | "orb_white"
  | "orb_cyan"
  | "camera"
  | "valve"
  | "node";

export interface BuilderPuzzleComponent {
  id: string;
  role: BuilderPuzzleComponentRole;
  roomId: string;
  position: readonly [number, number];
  rotationY?: number;
  /** Imported runtime target details so official puzzle targets round-trip exactly. */
  sourceTarget?: BuilderPuzzleTargetSource;
  /** Generic future 3D puzzle actor metadata; current color-orb targets remain the runtime source of truth. */
  sourceActor?: BuilderPuzzleActorSource;
}

export interface BuilderPuzzleTargetSource {
  id?: string;
  label?: string;
  y?: number;
  radius?: number;
  visualKey?: string;
  materialKey?: string;
  anchorPropId?: string;
}

export interface BuilderPuzzleActorSource {
  id?: string;
  role?: string;
  kind?: LevelPuzzleActorKind;
  roomId?: string;
  position?: Vec3Tuple;
  rotation?: Vec3Tuple;
  visualKey?: string;
  materialKey?: string;
  colorKey?: LevelPuzzleColorKey;
  anchorPropId?: string;
  interactionId?: string;
  targetId?: string;
  stateKey?: string;
  inputMode?: LevelPuzzleActorInputMode;
  hitbox?: LevelPuzzleActorHitboxDefinition;
}

export interface BuilderInteractionSource {
  type?: LevelInteractionType;
  radius?: number;
  visualKey?: string;
  materialKey?: string;
  label?: string;
  hostPropId?: string;
  startsObjectiveId?: string;
  completesObjectiveId?: string;
  grantsKeyItemId?: string;
  consumesKeyItemId?: string;
  opensDoorId?: string;
  requiresObjectiveId?: string;
  requiresArticleIds?: readonly string[];
  requiresSwitchState?: { switchId: string; stateId: string };
  dialogueTrigger?: string;
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  audio?: AudioCueConfig;
}

/** Temporary editor mode: choose a normal prop as a puzzle interaction host. */
export type BuilderPuzzleHostPick =
  | { kind: "interaction"; puzzleId: string }
  | { kind: "component"; puzzleId: string; componentId: string };

/**
 * A freely-placed, door-linked puzzle. The instance itself is the
 * terminal/clue panel; color sequences carry separately placed orb
 * components (each may live in a different room — the runtime hit-sequence
 * targets are per-room).
 */
export interface BuilderPuzzleInstance {
  id: string;
  kind: BuilderPuzzleKind;
  label?: string;
  toolLabel?: string;
  /** Legacy/default = directly opens a puzzle-locked door. */
  resultMode?: "open_door" | "grant_key";
  linkedDoorId: string;
  /** Optional imported runtime interaction id, used when round-tripping official/dev levels. */
  interactionId?: string;
  /** Imported runtime interaction display/host semantics. */
  sourceInteraction?: BuilderInteractionSource;
  /** Original runtime puzzle definition for official kinds the builder UI cannot fully author yet. */
  sourcePuzzle?: LevelPuzzleDefinition;
  /** Extra outputs fired after the puzzle succeeds, using the same curated target model as route switches. */
  successOutputs?: readonly BuilderRouteSwitchOutput[];
  roomId: string;
  position: readonly [number, number];
  rotationY: number;
  /** Optional wall-mounted terminal placement. Used by compact wall puzzle stations such as valve_matrix. */
  wallMount?: BuilderWallMount;
  /** 身份压缩柜目标阶。缺省按最短试玩目标 64 编译。 */
  archiveTargetValue?: number;
  /** 闸门配平倒计时秒数。仅 valve_matrix 使用，编译时限制在 30-60 秒。 */
  timeLimitSec?: number;
  /** Story painting props that must be read before this puzzle interaction opens. */
  requiredStoryPropIds?: readonly string[];
  components?: readonly BuilderPuzzleComponent[];
}

export type BuilderPickupKind = "key_item" | "repairKit" | "coreCell" | "breachMissile";

/** Placeable pickup objects. Key pickups optionally bind to an existing key-locked door. */
export interface BuilderPickup {
  id: string;
  kind: BuilderPickupKind;
  roomId: string;
  position: readonly [number, number];
  linkedDoorId?: string;
  /** Optional puzzle that grants this key instead of leaving it available on the floor. */
  grantedByPuzzleId?: string;
  /** Imported runtime key-item fields that make official pickup timing/visuals round-trip. */
  sourceKeyItem?: BuilderKeyItemSource;
}

export interface BuilderKeyItemSource {
  label?: string;
  y?: number;
  collectRadius?: number;
  autoCollect?: boolean;
  visualKey?: string;
  materialKey?: string;
  requiresObjectiveId?: string;
  dropFromArchetypeId?: string;
  dialogueTrigger?: string;
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  audio?: AudioCueConfig;
}

export type BuilderRouteSwitchOutputKind = "open_door" | "reveal_puzzle" | "start_robots";

export interface BuilderRouteSwitchOutput {
  id: string;
  kind: BuilderRouteSwitchOutputKind;
  /** Opens/unlocks an existing locked door. */
  doorId?: string;
  /** Makes an existing puzzle terminal usable while this route is active. */
  puzzleId?: string;
  /** Starts the robot wave for a room that already contains robots. */
  robotRoomId?: string;
  label?: string;
  /** Optional room override for this output's authorization orb key. */
  keyRoomId?: string;
  /** Optional imported/player-authored pickup placement for this output's orb key. */
  keyPosition?: readonly [number, number];
}

/** Multi-room routing console: each 1-4 output gets its own pickup orb key. */
export interface BuilderRouteSwitch {
  id: string;
  label: string;
  roomId: string;
  keyRoomId: string;
  /** Optional imported key placement; hand-authored route switches can omit it. */
  keyPosition?: readonly [number, number];
  position: readonly [number, number];
  rotationY: number;
  visualKey?: string;
  wallMount?: BuilderWallMount;
  presentation?: LevelSwitchPresentationDefinition;
  outputs: readonly BuilderRouteSwitchOutput[];
}

export type BuilderWallSide = "north" | "south" | "east" | "west";

export interface BuilderWallMount {
  side: BuilderWallSide;
  /** -1..1 normalized travel along the chosen wall. */
  offset: number;
  /** Wall button center height in meters. Defaults to a reachable 1.34m. */
  height?: number;
  /** Small inset from the wall plane, meters. */
  inset?: number;
}

export interface BuilderWallDoorSwitchState {
  id: string;
  label: string;
  openDoorIds?: readonly string[];
  closeDoorIds?: readonly string[];
  message?: string;
}

/** Generic wall-mounted, repeatable door control button/short handle. */
export interface BuilderWallDoorSwitch {
  id: string;
  label: string;
  roomId: string;
  wallMount: BuilderWallMount;
  mode?: "toggle" | "state_cycle";
  primaryDoorId?: string;
  inverseDoorId?: string;
  initialStateId?: string;
  oneShot?: boolean;
  states: readonly BuilderWallDoorSwitchState[];
}

export type BuilderRobotArchetype = "repair_drone" | "clamp_bot" | "shield_tech" | "custodian_elite";
export type BuilderRobotPresetId = "museum_curator_boss" | "reclamation_mother_boss";

export type BuilderRobotCombatTuning = Omit<EnemyTierOverrideConfig, "tier">;

/**
 * Optional wave metadata for official/dev imports. Plain builder drafts can omit
 * this and keep the original "one room = one room-enter wave" behavior.
 */
export interface BuilderRobotWaveMeta {
  id?: string;
  label?: string;
  role?: "enemy" | "reinforcement";
  triggerType?: LevelObjectiveTriggerType;
  triggerId?: string;
  triggerOptionId?: string;
  triggerDelay?: number;
  startDelay?: number;
  interruptsActiveWave?: boolean;
  nonBlocking?: boolean;
  reward?: WaveReward;
  completionDialogueTrigger?: string;
  spawnGroupId?: string;
  spawnGroupLabel?: string;
  spawnGroupLayout?: string;
  spawnGroupCenter?: readonly [number, number];
  spawnGroupRadius?: number;
  spawnGroupSpread?: number;
  spawnGroupPositions?: readonly (readonly [number, number])[];
  presentation?: WavePresentationDefinition;
  reinforcement?: {
    every: number;
    startsAfter: number;
    maxGroups: number;
    maxAlive?: number;
    requiresEliteAlive?: boolean;
    endless?: boolean;
  };
}

export type BuilderWaveChainClearAction =
  | { kind: "open_door"; doorId: string }
  | { kind: "unlock_door"; doorId: string };

export interface BuilderWavePressureLoop {
  enabled: boolean;
  archetype: BuilderRobotArchetype;
  count: number;
  startsAfter: number;
  every: number;
  maxAlive: number;
}

export interface BuilderWaveChainMeta {
  waveId: string;
  order: number;
  label?: string;
  clearActions?: readonly BuilderWaveChainClearAction[];
  pressureLoop?: BuilderWavePressureLoop;
}

export type BuilderSurfaceRotation = 0 | 90 | 180 | 270;

export type BuilderSurfaceSlot = "floor" | "wall" | "ceiling";

export interface BuilderSurfaceOverride {
  /** Builder surface preset chosen by the author for this slot. */
  presetId: string;
  /**
   * True only when the author explicitly painted this surface in /build.
   * Official imports may carry default presets for round-trip context without
   * asking Raw WebGPU to replace curated official shell geometry.
   */
  authored?: boolean;
}

export interface BuilderSurfaceOverrides {
  floor?: BuilderSurfaceOverride;
  wall?: BuilderSurfaceOverride;
  ceiling?: BuilderSurfaceOverride;
}

/**
 * Optional per-room environment overrides. All fields optional so drafts saved
 * before v9 load unchanged; effective values resolve in BuilderEnvironment.ts.
 */
export interface BuilderRoomEnv {
  /** Official shell/surface kit bridge id; keeps /build and curated map skins round-trippable. */
  surfaceKitId?: string;
  /** Author-painted material overrides layered over the official shell kit. */
  surfaceOverrides?: BuilderSurfaceOverrides;
  floorPresetId?: string;
  floorColor?: string;
  /** Pattern scale, 0.5–3. */
  floorScale?: number;
  floorRotation?: BuilderSurfaceRotation;
  wallPresetId?: string;
  wallColor?: string;
  /** Wall height in meters, 0.8–3.2. */
  wallHeight?: number;
  ceilingVisible?: boolean;
  /** Ceiling height in meters, 2–4. */
  ceilingHeight?: number;
  ceilingPresetId?: string;
  ceilingColor?: string;
}

/** Project-level lighting rig settings (clamped in BuilderEnvironment.ts). */
export interface BuilderLighting {
  /** Environment light intensity, 0.1–1.2. */
  ambient: number;
  /** Key (directional) light color, #rrggbb. */
  keyColor: string;
  /** Key light intensity, 0–2. */
  keyIntensity: number;
  /** Fog density factor, 0–1. */
  fog: number;
  /** Glow/bloom strength, 0–1 (approximated via emissive glow in the editor preview). */
  bloom: number;
  /** Contact shadow strength, 0–1. */
  shadow: number;
}

export interface BuilderRoom {
  id: string;
  label: string;
  style: BuilderRoomStyle;
  /** 2D top-down center, meters. x → world x, z → world z. */
  center: readonly [number, number];
  /** Width (x) and depth (z), meters. For shaped rooms this is the footprint bbox. */
  size: readonly [number, number];
  /**
   * Optional non-rectangular footprint (circle/semicircle/triangle/N-gon, all
   * stored as polygon points). Absent = ordinary axis-aligned rectangle from
   * center+size. See BuilderRoomShape.ts. `size` stays the bounding box.
   */
  shape?: BuilderRoomShape;
  /** Per-room environment overrides (floor/wall/ceiling). */
  env?: BuilderRoomEnv;
  /** Imported runtime room kit/surface details. Builder UI can edit around this without losing official quality. */
  sourceRoom?: BuilderRoomSource;
}

export interface BuilderRoomSource {
  mood?: RoomMood;
  skinKey?: string;
  floorMaterialKey?: string;
  wallMaterialKey?: string;
  geometry?: RoomGeometryConfig;
  aesthetic?: RoomAestheticConfig;
  ambientPressure?: number;
  entryDialogueTrigger?: string;
  exitDialogueTrigger?: string;
}

export interface BuilderDoor {
  id: string;
  /** Author-facing name shown in inspectors, door selectors, and compiled playtests. */
  label?: string;
  fromRoomId: string;
  toRoomId: string;
  lockType: BuilderLockType;
  /** Explicit robot group guarding this door. Preferred over room-based wave guessing. */
  surviveRobotId?: string;
  /** Multiple explicit robot groups guarding this door. All selected groups must be cleared. */
  surviveRobotIds?: readonly string[];
  /** Imported survive-wave lock target; absent = the builder's default wave for fromRoomId. */
  waveId?: string;
  /** Imported survive-wave lock targets for multi-wave gates. */
  waveIds?: readonly string[];
  /** Room that holds the key when lockType is "key_item". */
  keyRoomId?: string;
  /** Puzzle flavor for puzzle_complete locks (absent = color_sequence). */
  puzzleKind?: BuilderPuzzleKind;
  /** Room hosting the 2D puzzle console (absent = the door's A-side room). */
  puzzleRoomId?: string;
  /** Imported/authored puzzle prerequisites for puzzle_complete locks. All listed puzzles must be complete. */
  puzzleIds?: readonly string[];
  /** Premium door-art family (absent/"auto" = lock-driven default). */
  doorFamily?: BuilderDoorFamily;
  /** Door can be manually opened only while this wall door switch is in this state. */
  wallDoorSwitchId?: string;
  wallDoorSwitchStateId?: string;
  /** Imported runtime door geometry/skin/opening details for official-quality round-trips. */
  sourceDoor?: BuilderDoorSource;
}

export interface BuilderDoorSource {
  label?: string;
  position?: Vec3Tuple;
  size?: Vec3Tuple;
  yaw?: number;
  defaultState?: DoorState;
  lock?: DoorLockDefinition;
  skinKey?: string;
  visualKey?: string;
  materialKey?: string;
  panelPosition?: Vec3Tuple;
  openSpeed?: number;
  autoOpenOnApproach?: boolean;
  openVisualPolicy?: LevelDoorOpenVisualPolicy;
  closedDialogueTrigger?: string;
  openedDialogueTrigger?: string;
  cameraImpact?: CameraImpactConfig;
}

export interface BuilderLevelSource {
  levelId?: string;
  mapId?: string;
  mapPresentation?: NonNullable<LevelDefinition["map"]>["presentation"];
  mapInteractions?: NonNullable<LevelDefinition["map"]>["interactions"];
  spawnPoint?: LevelDefinition["spawnPoint"];
  initialInventory?: LevelDefinition["initialInventory"];
  initialWaveStartDelay?: LevelDefinition["initialWaveStartDelay"];
  requiresStoryPickupsBeforeWaves?: LevelDefinition["requiresStoryPickupsBeforeWaves"];
  exit?: LevelDefinition["exit"];
  puzzles?: LevelDefinition["puzzles"];
  articles?: LevelDefinition["articles"];
  switches?: LevelDefinition["switches"];
  bigScreens?: LevelDefinition["bigScreens"];
  objectiveChain?: LevelDefinition["objectiveChain"];
  events?: LevelDefinition["events"];
  environmentStates?: LevelDefinition["environmentStates"];
  dialogues?: LevelDefinition["dialogues"];
  cinematicBeats?: LevelDefinition["cinematicBeats"];
  bossPhases?: LevelDefinition["bossPhases"];
  enemyDeathBeats?: LevelDefinition["enemyDeathBeats"];
  pickups?: LevelDefinition["pickups"];
  economy?: LevelDefinition["economy"];
  revive?: LevelDefinition["revive"];
  combatLimits?: LevelDefinition["combatLimits"];
  presentation?: LevelDefinition["presentation"];
}

/** Project-level story shell from a template (see BuilderStoryTemplates.ts). */
export interface BuilderProjectStory {
  /** Source template id (e.g. "memory_clinic"); absent = no template. */
  templateId?: string;
  /** Archive-voice ending line shown on victory. */
  victoryLine?: string;
  /** Sensory transition line when entering the exit. */
  transitionLine?: string;
}

/** Optional author-written story metadata on a placed prop (paintings/artifacts). */
export interface BuilderPropStory {
  title?: string;
  clue?: string;
  hint?: string;
}

export interface BuilderProp {
  id: string;
  modelKey: string;
  roomId: string;
  position: readonly [number, number];
  rotationY: number;
  scale: number;
  /**
   * Height above the floor in meters (vertical axis). Absent = the model's
   * mount default (wall art hangs, tabletop decor sits at table height, floor
   * props at 0). See defaultPropElevation in BuilderAssetCatalog.
   */
  elevation?: number;
  /** Story metadata for 故事线索 objects; rides through authoringMetadata. */
  story?: BuilderPropStory;
  /**
   * Optional static stacking attachment. The world-space position/elevation
   * remain the source of truth for export; these fields let /build keep lamps,
   * books, and other small objects glued to a moving parent surface.
   */
  parentPropId?: string;
  parentSurfaceId?: string;
  localPosition?: readonly [number, number];
  localRotationY?: number;
  /** Imported runtime prop details not represented by the editable catalog fields. */
  sourceProp?: BuilderPropSource;
}

export interface BuilderPropSource {
  y?: number;
  scale?: number | Vec3Tuple;
  collider?: {
    halfSize: Vec3Tuple;
    offset?: Vec3Tuple;
  };
  label?: string;
  tags?: readonly string[];
  initiallyVisible?: boolean;
}

export interface BuilderRobotGroup {
  id: string;
  /** Author-facing name shown in door bindings and the inspector. */
  label?: string;
  roomId: string;
  archetype: BuilderRobotArchetype;
  count: number;
  tier?: EnemyTierId;
  presetId?: BuilderRobotPresetId;
  /** Imported combat tuning from official waves; optional for hand-authored builder rooms. */
  combat?: BuilderRobotCombatTuning;
  /** Hand-authored finite wave-chain metadata for /build combat locks. */
  waveChain?: BuilderWaveChainMeta;
  /** Imported wave identity/trigger/spawn metadata so official waves round-trip through /build. */
  wave?: BuilderRobotWaveMeta;
  /** Optional free placement (meters); falls back to the room badge slot when absent. */
  position?: readonly [number, number];
}

export interface BuilderPuzzle {
  /** Room that hosts the color orbs. */
  roomId: string;
  /** Room that shows the order clue panel. */
  clueRoomId: string;
  sequence: readonly LevelPuzzleColorKey[];
}

export interface BuilderProject {
  schemaVersion: "hp.builder.v1";
  projectId: string;
  title: string;
  rooms: BuilderRoom[];
  doors: BuilderDoor[];
  props: BuilderProp[];
  /** Optional placeable pickups; absent in legacy drafts. */
  pickups?: BuilderPickup[];
  robots: BuilderRobotGroup[];
  puzzle?: BuilderPuzzle;
  /** Freely-placed puzzle instances (absent in legacy drafts → synthesized from puzzle doors). */
  puzzles?: BuilderPuzzleInstance[];
  /** Optional multi-room route switches; absent in legacy drafts. */
  routeSwitches?: BuilderRouteSwitch[];
  /** Optional wall-mounted repeatable door switches; absent in legacy drafts. */
  wallDoorSwitches?: BuilderWallDoorSwitch[];
  /** Story template selection + facility-voice ending lines (all optional, migration-safe). */
  story?: BuilderProjectStory;
  exitRoomId: string;
  /** Project lighting settings; absent in pre-v9 drafts (defaults apply). */
  lighting?: Partial<BuilderLighting>;
  /** Imported official/source-level fields that builder UI does not author directly yet. */
  sourceLevel?: BuilderLevelSource;
}

export type BuilderSelection =
  | { kind: "room"; id: string }
  | { kind: "door"; id: string }
  | { kind: "prop"; id: string }
  | { kind: "pickup"; id: string }
  | { kind: "robot"; id: string }
  | { kind: "puzzle"; id: string; componentId?: string }
  | { kind: "routeSwitch"; id: string }
  | { kind: "wallDoorSwitch"; id: string }
  | null;

export function createBuilderId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createStarterProject(): BuilderProject {
  return {
    schemaVersion: "hp.builder.v1",
    projectId: createBuilderId("proj"),
    title: "我的密室",
    rooms: [
      { id: "room_spawn", label: "出生实验间", style: "sterile", center: [0, 10], size: [10, 6] },
      { id: "room_hall", label: "监控走廊", style: "hazard", center: [0, 3], size: [8, 8] },
      { id: "room_archive", label: "档案室", style: "residential", center: [-9, 3], size: [10, 6] },
      { id: "room_fight", label: "清剿机房", style: "maintenance", center: [0, -5], size: [12, 8] },
      { id: "room_exit", label: "撤离电梯", style: "exit", center: [0, -11.5], size: [6, 5] },
    ],
    doors: [
      { id: "door_a", label: "实验间通道", fromRoomId: "room_spawn", toRoomId: "room_hall", lockType: "none" },
      { id: "door_b", label: "档案侧门", fromRoomId: "room_hall", toRoomId: "room_archive", lockType: "none" },
      { id: "door_c", label: "机房门禁", fromRoomId: "room_hall", toRoomId: "room_fight", lockType: "key_item", keyRoomId: "room_archive" },
      { id: "door_d", label: "撤离电梯门", fromRoomId: "room_fight", toRoomId: "room_exit", lockType: "survive_wave" },
    ],
    props: [
      { id: "prop_a", modelKey: "room_table_utility", roomId: "room_spawn", position: [3.4, 11.6], rotationY: 0, scale: 1 },
      { id: "prop_b", modelKey: "room_crate_stack", roomId: "room_spawn", position: [-3.6, 11.8], rotationY: 0.4, scale: 1 },
      { id: "prop_c", modelKey: "room_locker_low", roomId: "room_spawn", position: [-4.2, 8.4], rotationY: Math.PI / 2, scale: 1 },
      { id: "prop_d", modelKey: "room_museum_low_barrier", roomId: "room_hall", position: [2.6, 3.2], rotationY: Math.PI / 2, scale: 1 },
      { id: "prop_e", modelKey: "room_fuse_box", roomId: "room_hall", position: [-3.4, 5.6], rotationY: Math.PI / 2, scale: 1 },
      { id: "prop_f", modelKey: "room_museum_wall_label_panel", roomId: "room_hall", position: [-3.4, 0.6], rotationY: Math.PI / 2, scale: 1 },
      { id: "prop_g", modelKey: "room_museum_display_case_tool", roomId: "room_archive", position: [-9, 1.2], rotationY: 0, scale: 1 },
      { id: "prop_h", modelKey: "room_museum_archive_column", roomId: "room_archive", position: [-13, 1.6], rotationY: 0, scale: 1 },
      { id: "prop_i", modelKey: "room_fake_family_photo_wall", roomId: "room_archive", position: [-9, 5.6], rotationY: 0, scale: 1 },
      { id: "prop_j", modelKey: "prop_archive_folder_stack", roomId: "room_archive", position: [-5.6, 4.6], rotationY: 0.8, scale: 1 },
      { id: "prop_k", modelKey: "room_crate_stack", roomId: "room_fight", position: [-4.6, -7.4], rotationY: 0.2, scale: 1 },
      { id: "prop_l", modelKey: "room_museum_low_barrier", roomId: "room_fight", position: [0, -4.6], rotationY: 0, scale: 1 },
      { id: "prop_m", modelKey: "room_maintenance_supply_cabinet", roomId: "room_fight", position: [5.2, -8.2], rotationY: Math.PI, scale: 1 },
    ],
    pickups: [
      { id: "pickup_a", kind: "repairKit", roomId: "room_hall", position: [-2.4, 5.4] },
      { id: "pickup_b", kind: "coreCell", roomId: "room_fight", position: [3.8, -6.8] },
    ],
    robots: [
      { id: "robot_a", roomId: "room_hall", archetype: "repair_drone", count: 1 },
      { id: "robot_b", roomId: "room_fight", archetype: "clamp_bot", count: 2 },
      { id: "robot_c", roomId: "room_fight", archetype: "repair_drone", count: 1 },
    ],
    exitRoomId: "room_exit",
  };
}
