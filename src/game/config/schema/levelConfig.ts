import type { EnemyArchetypeId } from "../enemyArchetypes";
import type { EnemyTierId, EnemyTierOverrideConfig } from "../enemyTiers";
import type { WeaponId } from "../weaponConfig";
import type { DialogueDefinition } from "../dialogueScripts";
import type { EffectType, PickupType } from "../../entities/EntityTypes";
import type { RewardPulseState } from "../../core/GameMode";

export type Vec3Tuple = readonly [number, number, number];

export type SpawnGroupId = string;

export type WaveReward = "none" | "upgrade" | "open_exit";

export type LevelAuthoringProfile = "internal" | "generated";

export type LevelObjectiveTriggerType =
  | "level_start"
  | "room_entered"
  | "interaction_completed"
  | "key_collected"
  | "door_opened"
  | "wave_completed"
  | "objective_completed"
  | "enemy_dead"
  | "boss_dead"
  | "boss_phase"
  | "choice_selected"
  | "campaign_route_changed"
  | "environment_state_set"
  | "puzzle_completed"
  | "puzzle_failed"
  | "article_read"
  | "quiz_completed"
  | "quiz_failed"
  | "switch_activated"
  | "big_screen_state"
  | "exit_unlocked";

export interface LevelEventTriggerDefinition {
  type: LevelObjectiveTriggerType;
  id?: string;
  optionId?: string;
  threshold?: number;
}

export interface LevelWaveTriggerDefinition extends LevelEventTriggerDefinition {
  delay?: number;
}

export interface EnemySpawnDefinition extends EnemyTierOverrideConfig {
  archetype: EnemyArchetypeId;
  count: number;
  from: SpawnGroupId;
}

export interface WaveReinforcementDefinition extends EnemySpawnDefinition {
  every: number;
  startsAfter: number;
  maxGroups: number;
  requiresEliteAlive?: boolean;
  endless?: boolean;
  maxAlive?: number;
}

export interface WaveDefinition {
  id: string;
  startDelay: number;
  roomId?: string;
  trigger?: LevelWaveTriggerDefinition;
  enemies: readonly EnemySpawnDefinition[];
  reinforcements?: readonly WaveReinforcementDefinition[];
  interruptsActiveWave?: boolean;
  /** Boss/leader waves can advance the script once the elite unit is defeated, even if small pressure adds remain alive. */
  completeWhenEliteDefeated?: boolean;
  /** Background pressure waves can run without blocking later room/script waves. */
  nonBlocking?: boolean;
  reward: WaveReward;
  completionDialogueTrigger?: string;
  timedExitUnlockAfter?: number;
}

export interface LevelExitCinematicDefinition {
  type: "elevator_walk_in";
  duration: number;
  walkInDuration: number;
  doorOpenTime?: number;
  doorCloseTime?: number;
  buttonPressTime?: number;
  buttonPressDuration?: number;
  ascentStartTime?: number;
  ascentDuration?: number;
  whiteOutTime?: number;
  enterPosition: Vec3Tuple;
  lookAtPosition?: Vec3Tuple;
  lookAtPropId?: string;
  faceYaw?: number;
  doorId?: string;
  message?: string;
}

export interface LevelExitDefinition {
  id: string;
  position: Vec3Tuple;
  radius: number;
  unlockedLabel: string;
  distanceLabel: string;
  unlockMessage: string;
  unlockDialogueTrigger: string;
  unlockWarning: SpawnWarningConfig;
  transitionMessage: string;
  transitionDialogueTrigger: string;
  victoryMessage: string;
  cinematic?: LevelExitCinematicDefinition;
}

export interface SpawnWarningConfig {
  label: string;
  detail: string;
}

export interface RewardPulseConfig {
  label: string;
  detail: string;
  rarity: RewardPulseState["rarity"];
}

export interface AudioCueConfig {
  key: string;
  intensity?: number;
}

export interface CameraImpactConfig {
  shake?: number;
  fovKick?: number;
  rumble?: number;
  rumbleDuration?: number;
}

export interface LevelEffectConfig {
  type: EffectType;
  position: Vec3Tuple;
  direction: Vec3Tuple;
  lifetime: number;
  intensity: number;
}

export interface CampaignRouteDefinition {
  id: string;
  label: string;
  detail?: string;
  color?: string;
}

export interface CampaignRouteDeltaConfig {
  routeId: string;
  amount: number;
  label?: string;
}

export interface StoryPickupDefinition {
  type: Extract<PickupType, "ironRod" | "pistol">;
  interactionId?: string;
  position: Vec3Tuple;
  collectRadius: number;
  grants: {
    hasRod?: boolean;
    hasPistol?: boolean;
    equipWeapon?: WeaponId;
  };
  waveStartDelayAfterCollect?: number;
  dialogueTrigger?: string;
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  spawnWarning?: SpawnWarningConfig;
  spawnWarningDuration?: number;
  audio?: AudioCueConfig;
}

export type RoomMood = "quiet" | "uneasy" | "combat" | "boss" | "reveal";

export type DoorState = "open" | "closed" | "locked";

export type DoorLockType =
  | "none"
  | "key_item"
  | "objective_complete"
  | "survive_wave"
  | "repair_panel"
  | "memory_choice"
  | "choice_selected"
  | "environment_state"
  | "switch_state"
  | "boss_dead"
  | "puzzle_complete"
  | "inventory_count";

export type LevelInteractionType =
  | "inspect"
  | "terminal"
  | "door_panel"
  | "repair_panel"
  | "memory_echo"
  | "article"
  | "quiz"
  | "switch"
  | "big_screen"
  | "pickup_key"
  | "pickup_story"
  | "exit";

export type LevelObjectiveType =
  | "collect_key"
  | "collect_story_pickups"
  | "open_door"
  | "inspect_all"
  | "survive_wave"
  | "reach_exit"
  | "boss_dead"
  | "repair_panel"
  | "custom";

export interface RoomBoundsConfig {
  center: Vec3Tuple;
  size: Vec3Tuple;
  /**
   * Optional non-rectangular footprint: polygon vertices in the floor plane,
   * local to `center` (meters), with any authoring rotation already baked in.
   * Absent = axis-aligned rectangle from `size`. Circles/semicircles/triangles
   * are all expressed as N-gon polygons. `size` stays the footprint bbox.
   */
  shape?: {
    points: readonly (readonly [number, number])[];
  };
}

export interface RoomGeometryConfig {
  renderFloor?: boolean;
  renderWalls?: boolean;
  renderCeiling?: boolean;
  collisionWalls?: boolean;
  accentColor?: string;
  floorMaterialKey?: string;
  wallMaterialKey?: string;
}

export type RoomAestheticStyle = "auto" | "maintenance" | "residential" | "sterile" | "hazard" | "exit" | "museum";
export type RoomAestheticDetail = "low" | "medium" | "high";

export interface RoomAestheticConfig {
  enabled?: boolean;
  style?: RoomAestheticStyle;
  detail?: RoomAestheticDetail;
  trim?: boolean;
  wallPanels?: boolean;
  ceilingLights?: boolean;
  floorLines?: boolean;
}

export interface LevelRoomDefinition {
  id: string;
  label: string;
  bounds: RoomBoundsConfig;
  mood: RoomMood;
  skinKey?: string;
  aesthetic?: RoomAestheticConfig;
  geometry?: RoomGeometryConfig;
  floorMaterialKey?: string;
  wallMaterialKey?: string;
  entryDialogueTrigger?: string;
  exitDialogueTrigger?: string;
  ambientPressure?: number;
}

export interface DoorLockDefinition {
  type: DoorLockType;
  keyItemId?: string;
  objectiveId?: string;
  waveId?: string;
  waveIds?: readonly string[];
  actorId?: string;
  puzzleId?: string;
  puzzleIds?: readonly string[];
  choiceId?: string;
  choiceOptionId?: string;
  environmentStateId?: string;
  switchId?: string;
  stateId?: string;
  requiredCount?: number;
  /** false = this lock can only be changed by configured actions, not direct door E/manual open. */
  manualOpen?: boolean;
  lockedMessage?: string;
  unlockedMessage?: string;
  consumesKey?: boolean;
}

export interface LevelDoorDefinition {
  id: string;
  label: string;
  fromRoomId: string;
  toRoomId: string;
  position: Vec3Tuple;
  size: Vec3Tuple;
  yaw: number;
  defaultState: DoorState;
  lock: DoorLockDefinition;
  skinKey?: string;
  visualKey: string;
  materialKey?: string;
  panelPosition?: Vec3Tuple;
  openSpeed?: number;
  autoOpenOnApproach?: boolean;
  openVisualPolicy?: LevelDoorOpenVisualPolicy;
  closedDialogueTrigger?: string;
  openedDialogueTrigger?: string;
  cameraImpact?: CameraImpactConfig;
}

export interface LevelDoorOpenVisualPolicy {
  hideClosedHardwareAfterOpen?: boolean;
  hidePanelAfterOpen?: boolean;
}

export interface LevelKeyItemDefinition {
  id: string;
  label: string;
  roomId: string;
  position: Vec3Tuple;
  collectRadius: number;
  autoCollect?: boolean;
  visualKey: string;
  materialKey?: string;
  requiredForDoorIds: readonly string[];
  requiresObjectiveId?: string;
  dropFromArchetypeId?: string;
  dialogueTrigger?: string;
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  audio?: AudioCueConfig;
}

export interface LevelMapPickupDefinition {
  id: string;
  type: Extract<PickupType, "repairKit" | "coreCell" | "breachMissile">;
  roomId: string;
  position: Vec3Tuple;
  visualKey?: string;
  label?: string;
}

export interface LevelMapPropDefinition {
  id: string;
  roomId: string;
  modelKey: string;
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  scale?: number | Vec3Tuple;
  collider?: {
    halfSize: Vec3Tuple;
    offset?: Vec3Tuple;
    enemyNavigation?: "solid" | "soft" | "ignore";
  };
  label?: string;
  tags?: readonly string[];
  initiallyVisible?: boolean;
}

export type LevelMapDecalKind = "human_body_reference" | "human_hand_reference" | "human_spine_reference";

export interface LevelMapDecalDefinition {
  id: string;
  roomId: string;
  kind: LevelMapDecalKind;
  position: Vec3Tuple;
  size: readonly [number, number];
  rotation?: Vec3Tuple;
  opacity?: number;
  label?: string;
  tags?: readonly string[];
}

export interface LevelInteractionDefinition {
  id: string;
  type: LevelInteractionType;
  roomId: string;
  position: Vec3Tuple;
  yaw?: number;
  radius: number;
  visualKey: string;
  materialKey?: string;
  /** Optional visual host: the interaction is a hotspot on an existing map prop instead of its own model. */
  anchorPropId?: string;
  label?: string;
  startsObjectiveId?: string;
  completesObjectiveId?: string;
  grantsKeyItemId?: string;
  consumesKeyItemId?: string;
  opensDoorId?: string;
  requiresObjectiveId?: string;
  /** Optional article gate: the interaction is visible, but unusable until these story/article records are read. */
  requiresArticleIds?: readonly string[];
  /** Optional route/switch gate: the interaction only becomes usable while a specific switch state is active. */
  requiresSwitchState?: { switchId: string; stateId: string };
  dialogueTrigger?: string;
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  audio?: AudioCueConfig;
}

export type LevelObjectiveTriggerDefinition = LevelEventTriggerDefinition;

export type LevelPuzzleType = "hit_sequence" | "code_lock" | "tool_calibration";

export type LevelPuzzleColorKey = "red" | "blue" | "green" | "yellow" | "purple" | "white" | "cyan";
export type LevelPuzzleDirection = "north" | "east" | "south" | "west";
export type LevelPuzzleClueSurface = "floor" | "wall";

export interface LevelPuzzleTargetDefinition {
  id: string;
  label: string;
  roomId: string;
  position: Vec3Tuple;
  radius: number;
  colorKey: LevelPuzzleColorKey;
  visualKey: string;
  materialKey?: string;
  /** Optional visual host for target props such as official orb pedestals. */
  anchorPropId?: string;
}

export type LevelPuzzleActorKind = "target" | "control" | "clue" | "stateful_prop" | "hotspot";
export type LevelPuzzleActorInputMode = "weapon_hit" | "interact" | "inspect" | "rotate" | "drag" | "none";

export interface LevelPuzzleActorHitboxDefinition {
  shape: "sphere" | "box";
  radius?: number;
  halfSize?: Vec3Tuple;
}

/**
 * Generic 3D puzzle object contract. Current runtime still uses each puzzle's
 * existing fields; this gives future 3D puzzles a shared actor vocabulary for
 * visible objects, hosted props, hitboxes, and interaction/state bindings.
 */
export interface LevelPuzzleActorDefinition {
  id: string;
  role: string;
  kind: LevelPuzzleActorKind;
  roomId: string;
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  visualKey?: string;
  materialKey?: string;
  colorKey?: LevelPuzzleColorKey;
  inputMode?: LevelPuzzleActorInputMode;
  hitbox?: LevelPuzzleActorHitboxDefinition;
  /** Existing map prop that visually hosts this actor. */
  anchorPropId?: string;
  /** Existing interaction that opens/operates this actor. */
  interactionId?: string;
  /** Existing hit_sequence target id when this actor is a compatibility view. */
  targetId?: string;
  /** Future state slot for rotate/drag/multi-step 3D puzzles. */
  stateKey?: string;
}

export interface LevelPuzzleActorHostDefinition {
  actors?: readonly LevelPuzzleActorDefinition[];
}

export interface LevelHitSequenceClueDefinition {
  type: "pattern_panel" | "environment_marking" | "dialogue";
  roomId?: string;
  interactionId?: string;
  sequence: readonly string[];
  label?: string;
  revealOnRoomEnter?: boolean;
  roomEnterLabel?: string;
  roomEnterDetail?: string;
  playback?: LevelHitSequencePlaybackDefinition;
  surfaces?: readonly LevelHitSequenceClueSurfaceDefinition[];
}

export interface LevelHitSequencePlaybackDefinition {
  /** The lamp row shown by the memory wall. Sequence steps illuminate matching colors. */
  palette?: readonly LevelPuzzleColorKey[];
  /** One light-on beat in milliseconds. */
  stepMs?: number;
  /** Dark gap between beats in milliseconds. */
  gapMs?: number;
  /** Require the player to view the lamp replay before entering a sequence. */
  requireReplayBeforeInput?: boolean;
  /** After this many wrong attempts, replace the active sequence order. */
  reshuffleAfterFailures?: number;
  /** Warning shown when the player tries the orbs before replaying the wall. */
  replayRequiredMessage?: string;
  /** Warning shown when the wall changes its order after repeated mistakes. */
  reshuffleMessage?: string;
}

export interface LevelHitSequenceClueSurfaceDefinition {
  id: string;
  roomId: string;
  surface: LevelPuzzleClueSurface;
  position: Vec3Tuple;
  size: readonly [number, number];
  yaw?: number;
  sequence?: readonly string[];
  label?: string;
  materialKey?: string;
}

export interface LevelDirectionDigitClueDefinition {
  id: string;
  type: "number_decal";
  roomId: string;
  direction: LevelPuzzleDirection;
  value: string;
  visualKey: string;
  materialKey?: string;
  surface?: LevelPuzzleClueSurface;
  size?: readonly [number, number];
  position: Vec3Tuple;
  yaw?: number;
  label?: string;
}

export interface LevelCodeLockCodeDefinition {
  source: "fixed" | "direction_room_digits" | "formula";
  value?: string;
  directionOrder?: readonly LevelPuzzleDirection[];
  formula?: LevelCodeLockFormulaDefinition;
  hint?: LevelCodeLockHintDefinition;
}

export interface LevelCodeLockFormulaDefinition {
  expression: string;
  answer?: string;
  display?: string;
  hint?: string;
  padLength?: number;
  resultMode?: "full" | "last_digits";
}

export interface LevelCodeLockHintDefinition {
  source: "keypad" | "screen" | "article";
  label?: string;
  detail?: string;
}

export interface LevelCodeLockInputDefinition {
  length: number;
  mode: "digit_buttons";
  allowBackspace?: boolean;
  clearOnMistake?: boolean;
  submitLabel?: string;
}

export interface LevelPuzzleInputDefinition {
  method: "weapon_hit" | "interact" | "any";
  allowedWeapons?: readonly WeaponId[];
  resetOnMistake?: boolean;
  showProgressPulse?: boolean;
}

export interface LevelPuzzleSuccessDefinition {
  opensDoorId?: string;
  unlocksDoorId?: string;
  completesObjectiveId?: string;
  unlockExit?: boolean;
  dialogueTrigger?: string;
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  cameraImpact?: CameraImpactConfig;
  effects?: readonly LevelEffectConfig[];
  audio?: AudioCueConfig;
  actions?: readonly LevelRuntimeEventAction[];
}

export type LevelToolCalibrationTileKind = "straight" | "corner" | "tee" | "cross" | "amplifier" | "blocked";
export type LevelToolCalibrationChannel = "stability" | "force" | "protocol" | "signal";

export interface LevelToolCalibrationCellDefinition {
  x: number;
  y: number;
  kind: LevelToolCalibrationTileKind;
  rotation?: number;
}

export interface LevelToolCalibrationRotationOverrideDefinition {
  x: number;
  y: number;
  rotation: number;
}

export interface LevelToolCalibrationVariantDefinition {
  id: string;
  rotationOverrides: readonly LevelToolCalibrationRotationOverrideDefinition[];
  solutionMoveCount?: number;
}

export interface LevelToolCalibrationPortDefinition {
  x: number;
  y: number;
  channel?: LevelToolCalibrationChannel;
}

export interface LevelToolCalibrationBonusDefinition {
  pickupType: Extract<PickupType, "repairKit" | "coreCell">;
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
}

export interface LevelPuzzleFailDefinition {
  message?: string;
  resetDelay?: number;
  cameraImpact?: CameraImpactConfig;
  audio?: AudioCueConfig;
  actions?: readonly LevelRuntimeEventAction[];
}

export interface LevelHitSequencePuzzleDefinition extends LevelPuzzleActorHostDefinition {
  id: string;
  type: "hit_sequence";
  label: string;
  roomId: string;
  targets: readonly LevelPuzzleTargetDefinition[];
  clue: LevelHitSequenceClueDefinition;
  input: LevelPuzzleInputDefinition;
  success: LevelPuzzleSuccessDefinition;
  fail?: LevelPuzzleFailDefinition;
}

export interface LevelCodeLockPuzzleDefinition extends LevelPuzzleActorHostDefinition {
  id: string;
  type: "code_lock";
  label: string;
  roomId: string;
  interactionId: string;
  requiredKeyItemId?: string;
  code: LevelCodeLockCodeDefinition;
  input: LevelCodeLockInputDefinition;
  clues: readonly LevelDirectionDigitClueDefinition[];
  success: LevelPuzzleSuccessDefinition;
  fail?: LevelPuzzleFailDefinition;
}

export interface LevelToolCalibrationPuzzleDefinition extends LevelPuzzleActorHostDefinition {
  id: string;
  type: "tool_calibration";
  label: string;
  roomId: string;
  interactionId: string;
  repeatable?: boolean;
  toolLabel?: string;
  columns: number;
  rows: number;
  entry: LevelToolCalibrationPortDefinition;
  targets: readonly LevelToolCalibrationPortDefinition[];
  requiredCells?: readonly LevelToolCalibrationPortDefinition[];
  cells: readonly LevelToolCalibrationCellDefinition[];
  perfectMoveLimit?: number;
  maxMoveLimit?: number;
  variants?: readonly LevelToolCalibrationVariantDefinition[];
  timeLimitSec?: number;
  success: LevelPuzzleSuccessDefinition;
  perfectBonus?: LevelToolCalibrationBonusDefinition;
  fail?: LevelPuzzleFailDefinition;
}

/** Circuit grid: rotate conduit tiles so every power source reaches every target node. */
export type LevelCircuitGridTileKind = "straight" | "corner" | "tee" | "cross" | "blocked";

export interface LevelCircuitGridCellDefinition {
  x: number;
  y: number;
  kind: LevelCircuitGridTileKind;
  rotation?: number;
  /** Locked tiles render powered styling but cannot be rotated. */
  locked?: boolean;
}

export interface LevelCircuitGridPortDefinition {
  x: number;
  y: number;
  label?: string;
}

export interface LevelCircuitGridPuzzleDefinition extends LevelPuzzleActorHostDefinition {
  id: string;
  type: "circuit_grid";
  label: string;
  roomId: string;
  interactionId: string;
  /** One-line in-fiction hint shown in the overlay sidebar. */
  guidance?: string;
  columns: number;
  rows: number;
  sources: readonly LevelCircuitGridPortDefinition[];
  targets: readonly LevelCircuitGridPortDefinition[];
  cells: readonly LevelCircuitGridCellDefinition[];
  moveLimit?: number;
  timeLimitSec?: number;
  success: LevelPuzzleSuccessDefinition;
  fail?: LevelPuzzleFailDefinition;
}

/** Surveillance match: assign the correct location tag to every camera feed. */
export interface LevelSurveillanceChannelDefinition {
  id: string;
  /** Camera channel label, e.g. "CAM-03". */
  label: string;
  /** Glyph rendered on the feed (mural symbol, room glyph). */
  symbol: string;
  /** One descriptive line of what the camera sees. */
  feedDetail?: string;
  answerOptionId: string;
}

export interface LevelSurveillanceOptionDefinition {
  id: string;
  label: string;
  symbol?: string;
}

export interface LevelSurveillanceMatchPuzzleDefinition extends LevelPuzzleActorHostDefinition {
  id: string;
  type: "surveillance_match";
  label: string;
  roomId: string;
  interactionId: string;
  guidance?: string;
  channels: readonly LevelSurveillanceChannelDefinition[];
  options: readonly LevelSurveillanceOptionDefinition[];
  /** Wrong submissions tolerated before the panel records a failure. */
  maxMistakes?: number;
  success: LevelPuzzleSuccessDefinition;
  fail?: LevelPuzzleFailDefinition;
}

/** Valve matrix: set gate positions so every readout lands inside its target band. */
export interface LevelValveMatrixValveDefinition {
  id: string;
  label: string;
  min: number;
  max: number;
  initial: number;
  /** gaugeShift[i] = delta applied to gauges[i] per +1 valve step. */
  gaugeShift: readonly number[];
}

export interface LevelValveMatrixGaugeDefinition {
  id: string;
  label: string;
  base: number;
  target: number;
  tolerance: number;
  unit?: string;
}

export interface LevelValveMatrixPuzzleDefinition extends LevelPuzzleActorHostDefinition {
  id: string;
  type: "valve_matrix";
  label: string;
  roomId: string;
  interactionId: string;
  guidance?: string;
  valves: readonly LevelValveMatrixValveDefinition[];
  gauges: readonly LevelValveMatrixGaugeDefinition[];
  /** Reference valve positions; the validator proves they satisfy every gauge. */
  solution: readonly number[];
  timeLimitSec?: number;
  success: LevelPuzzleSuccessDefinition;
  fail?: LevelPuzzleFailDefinition;
}

export type LevelArchiveMergeTileSkin = "museum" | "clinic" | "memory" | "core";

export interface LevelArchiveMergeSpawnDefinition {
  value: number;
  weight: number;
}

export interface LevelArchiveMergeAudioDefinition {
  open?: AudioCueConfig;
  move?: AudioCueConfig;
  merge?: AudioCueConfig;
  highMerge?: AudioCueConfig;
  invalid?: AudioCueConfig;
  success?: AudioCueConfig;
  fail?: AudioCueConfig;
}

/** Archive merge: compress matching identity files until the target tier is reached. */
export interface LevelArchiveMergePuzzleDefinition extends LevelPuzzleActorHostDefinition {
  id: string;
  type: "archive_merge";
  label: string;
  roomId: string;
  interactionId: string;
  guidance?: string;
  gridSize: number;
  targetValue: number;
  moveLimit?: number;
  tileSkin?: LevelArchiveMergeTileSkin;
  spawnTable?: readonly LevelArchiveMergeSpawnDefinition[];
  success: LevelPuzzleSuccessDefinition;
  fail?: LevelPuzzleFailDefinition;
  audio?: LevelArchiveMergeAudioDefinition;
}

export type LevelGalleryReadingStoryLineKind =
  | "exhibit_label"
  | "archive_record"
  | "visual_detail"
  | "facility_note"
  | "hidden_hook";

export interface LevelGalleryReadingStoryLineDefinition {
  kind: LevelGalleryReadingStoryLineKind;
  text: string;
  clueTags?: readonly string[];
}

export interface LevelGalleryReadingPaintingDefinition {
  id: string;
  title: string;
  assetKey?: string;
  modelKey?: string;
  thumbnailKey?: string;
  frameLabel?: string;
  lines: readonly LevelGalleryReadingStoryLineDefinition[];
}

export interface LevelGalleryReadingChoiceDefinition {
  id: string;
  label: string;
}

export interface LevelGalleryReadingQuestionDefinition {
  id: string;
  prompt: string;
  /** Paintings the reader should consult; defaults to the answer painting. */
  paintingIds?: readonly string[];
  choices: readonly LevelGalleryReadingChoiceDefinition[];
  answerId: string;
  explanation?: string;
  difficulty?: 1 | 2 | 3;
}

export interface LevelGalleryReadingAudioDefinition {
  open?: AudioCueConfig;
  select?: AudioCueConfig;
  correct?: AudioCueConfig;
  wrong?: AudioCueConfig;
  success?: AudioCueConfig;
  fail?: AudioCueConfig;
}

/** Gallery reading: study the wall art, then answer archive questions to release the door. */
export interface LevelGalleryReadingPuzzleDefinition extends LevelPuzzleActorHostDefinition {
  id: string;
  type: "gallery_reading";
  label: string;
  roomId: string;
  interactionId: string;
  guidance?: string;
  paintings: readonly LevelGalleryReadingPaintingDefinition[];
  questions: readonly LevelGalleryReadingQuestionDefinition[];
  /** Questions drawn per run, clamped 3-6. */
  questionsPerRun?: number;
  /** Correct answers needed; defaults to every drawn question. */
  requiredCorrect?: number;
  maxMistakes?: number;
  success: LevelPuzzleSuccessDefinition;
  fail?: LevelPuzzleFailDefinition;
  audio?: LevelGalleryReadingAudioDefinition;
}

export type LevelPuzzleDefinition =
  | LevelHitSequencePuzzleDefinition
  | LevelCodeLockPuzzleDefinition
  | LevelToolCalibrationPuzzleDefinition
  | LevelCircuitGridPuzzleDefinition
  | LevelSurveillanceMatchPuzzleDefinition
  | LevelValveMatrixPuzzleDefinition
  | LevelArchiveMergePuzzleDefinition
  | LevelGalleryReadingPuzzleDefinition;

export interface LevelArticlePageDefinition {
  id: string;
  body: string;
}

export interface LevelArticleDefinition {
  id: string;
  roomId: string;
  interactionId: string;
  title: string;
  subtitle?: string;
  systemLabel?: string;
  pages: readonly LevelArticlePageDefinition[];
  readReward?: RewardPulseConfig;
  readRewardDuration?: number;
  readDialogueTrigger?: string;
}

export type LevelQuizResetPolicyType = "never" | "after_wrong_count" | "on_room_exit";

export interface LevelQuizResetPolicyDefinition {
  type: LevelQuizResetPolicyType;
  wrongCount?: number;
}

export type LevelQuizOptionTone = "system" | "threat" | "reveal" | "player";

export interface LevelQuizOptionDefinition {
  id: string;
  label: string;
  detail?: string;
  correct?: boolean;
  tone?: LevelQuizOptionTone;
}

export interface LevelQuizOutcomeDefinition {
  message?: string;
  actions?: readonly LevelRuntimeEventAction[];
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  cameraImpact?: CameraImpactConfig;
  audio?: AudioCueConfig;
}

export interface LevelQuizDefinition {
  id: string;
  roomId: string;
  interactionId: string;
  articleId?: string;
  systemLabel?: string;
  title: string;
  question: string;
  detail?: string;
  options: readonly LevelQuizOptionDefinition[];
  resetPolicy?: LevelQuizResetPolicyDefinition;
  wrongAnswer?: LevelQuizOutcomeDefinition;
  correctAnswer: LevelQuizOutcomeDefinition;
}

export interface LevelSwitchStateDefinition {
  id: string;
  label?: string;
  detail?: string;
  message?: string;
  /** Optional key gate for route-console outputs; only this state needs this key. */
  requiredKeyItemId?: string;
  actions: readonly LevelRuntimeEventAction[];
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  dialogueTrigger?: string;
  cameraImpact?: CameraImpactConfig;
  audio?: AudioCueConfig;
}

export type LevelSwitchWallSide = "north" | "south" | "east" | "west";
export type LevelSwitchHandPose = "elevator_button_press" | "lever_push_down";

export interface LevelSwitchWallMountDefinition {
  roomId: string;
  side: LevelSwitchWallSide;
  /** Normalized wall offset, -1..1, from left/bottom to right/top along the wall. */
  offset: number;
  height: number;
  inset?: number;
}

export interface LevelSwitchCyclingDefinition {
  mode: "next";
  wrap?: boolean;
}

export interface LevelSwitchPresentationDefinition {
  kind: "wall_button" | "wall_lever" | "route_console";
  modelKey?: string;
  handPose?: LevelSwitchHandPose;
  hideWeapon?: boolean;
  useDurationSec?: number;
  commitAtSec?: number;
  doorRevealSec?: number;
  revealMode?: "none" | "door_front" | "player_eye" | "auto";
  revealDoorIds?: readonly string[];
}

export interface LevelSwitchDefinition {
  id: string;
  roomId: string;
  interactionId: string;
  label?: string;
  initialStateId?: string;
  oneShot?: boolean;
  cycling?: LevelSwitchCyclingDefinition;
  presentation?: LevelSwitchPresentationDefinition;
  wallMount?: LevelSwitchWallMountDefinition;
  states: readonly LevelSwitchStateDefinition[];
}

export type LevelBigScreenDisplayMode = "off" | "digits" | "color_sequence" | "formula" | "text";
export type LevelBigScreenColorKey = LevelPuzzleColorKey | "cyan" | "amber";

export interface LevelBigScreenStateDefinition {
  id: string;
  powered?: boolean;
  mode: LevelBigScreenDisplayMode;
  label?: string;
  title?: string;
  detail?: string;
  digits?: string;
  colors?: readonly LevelBigScreenColorKey[];
  formula?: LevelCodeLockFormulaDefinition;
  text?: string;
  message?: string;
  actions?: readonly LevelRuntimeEventAction[];
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  dialogueTrigger?: string;
  cameraImpact?: CameraImpactConfig;
  audio?: AudioCueConfig;
}

export interface LevelBigScreenDefinition {
  id: string;
  roomId: string;
  interactionId: string;
  label?: string;
  initialStateId?: string;
  activationStateId?: string;
  oneShot?: boolean;
  modelKey?: string;
  visualKey?: string;
  materialKey?: string;
  position?: Vec3Tuple;
  yaw?: number;
  size?: readonly [number, number];
  states: readonly LevelBigScreenStateDefinition[];
}

export interface LevelObjectiveDefinition {
  id: string;
  type: LevelObjectiveType;
  title: string;
  detail: string;
  requiredIds: readonly string[];
  startsWhen: LevelObjectiveTriggerDefinition;
  completesWhen: LevelObjectiveTriggerDefinition;
  nextObjectiveId?: string;
  hudLabel?: string;
  hiddenUntilStarted?: boolean;
  guidance?: LevelObjectiveGuidanceDefinition;
}

export type LevelObjectiveGuidanceTargetType = "room" | "door" | "key_item" | "interaction" | "puzzle" | "wave" | "exit";
export type LevelObjectiveGuidanceUrgency = "normal" | "puzzle" | "danger" | "exit";

export interface LevelObjectiveGuidanceDefinition {
  targetType: LevelObjectiveGuidanceTargetType;
  targetId?: string;
  label?: string;
  detail?: string;
  urgency?: LevelObjectiveGuidanceUrgency;
}

export interface LevelMapNavigationConfig {
  criticalPathRoomIds: readonly string[];
  optionalRoomIds: readonly string[];
  maxBacktrackSeconds: number;
  mobileReadableDoorCount: number;
}

export type LevelMapRoomArchetype =
  | "large_combat_arena"
  | "small_escape_room"
  | "corridor_connector"
  | "boss_chamber"
  | "story_lab";

export type LevelMapPropDensity = "sparse" | "medium" | "dense";

export interface LevelMapPresentationOverrides {
  lightingPreset?: string;
  shellKit?: string;
  doorKit?: string;
  propSet?: string;
  spawnLayout?: string;
  pickupLayout?: string;
  propDensity?: LevelMapPropDensity;
  floorWear?: number;
  ceilingLightIntensity?: number;
  doorStateStyle?: string;
  pickupVisibility?: string;
  fogFar?: number;
}

export interface LevelMapPresentationConfig {
  roomKit?: string;
  archetype?: LevelMapRoomArchetype;
  lightingPreset?: string;
  shellKit?: string;
  doorKit?: string;
  propSet?: string;
  spawnLayout?: string;
  pickupLayout?: string;
  previewCamera?: string;
  overrides?: LevelMapPresentationOverrides;
}

export interface LevelMapConfig {
  id: string;
  schemaVersion: "hp.map.v1";
  presentation?: LevelMapPresentationConfig;
  rooms: readonly LevelRoomDefinition[];
  doors: readonly LevelDoorDefinition[];
  keyItems: readonly LevelKeyItemDefinition[];
  interactions: readonly LevelInteractionDefinition[];
  pickups?: readonly LevelMapPickupDefinition[];
  props?: readonly LevelMapPropDefinition[];
  decals?: readonly LevelMapDecalDefinition[];
  navigation: LevelMapNavigationConfig;
}

export interface PickupRulesConfig {
  maxActiveDynamicPickups: number;
  dynamicLifetimeSec: number;
  storyPickups: readonly StoryPickupDefinition[];
  collectRadii: Partial<Record<PickupType, number>> & Record<Exclude<PickupType, "breachMissile">, number>;
  repairKit: {
    minMissingHealthToCollect: number;
    healAmount: number;
    rewardLabel: string;
  };
  coreCell: {
    maxHeld: number;
    pickupLabel: string;
    pickupDetailPrefix: string;
    useLabel: string;
    useDetail: string;
    preservedLabel: string;
    preservedDetail: string;
    upgradeInsertedLabel: string;
    emptyUseReward: RewardPulseConfig;
  };
  drops: {
    coreCell: CoreCellDropConfig;
    repairKit: RepairKitDropConfig;
  };
}

export interface CoreCellDropConfig {
  activeDropLimit: number;
  pityKills: number;
  minKillsForPity: number;
  eliteChance: number;
  archetypeChances: Partial<Record<EnemyArchetypeId, { minKills: number; chance: number }>>;
}

export interface RepairKitDropConfig {
  activeDropLimit: number;
  minMissingHealth: number;
  eliteChance: number;
  baseChance: number;
  archetypeChanceBonus: Partial<Record<EnemyArchetypeId, number>>;
  missingHealthThreshold: number;
  missingHealthBonus: number;
  lowHealthBonuses: readonly { healthRatioAtMost: number; bonus: number }[];
  lowHealthPity: readonly { healthRatioAtMost: number; kills: number }[];
}

export interface MemoryCacheMilestoneConfig {
  amount: number;
  label: string;
  reward: "energy" | "heat" | "health";
  rarity: RewardPulseState["rarity"];
}

export interface LevelEconomyConfig {
  memoryFragments: {
    default: number;
    byArchetype: Partial<Record<EnemyArchetypeId, number>>;
  };
  killStreakWindowSec: number;
  memoryCacheMilestones: readonly MemoryCacheMilestoneConfig[];
  curatedUpgradeRolls: readonly (readonly string[])[];
  tempoSurge: {
    eliteDuration: number;
    normalThreshold: number;
    tier2Threshold: number;
    tier1Duration: number;
    tier2Duration: number;
    tier1HeatRefund: number;
    tier2HeatRefund: number;
    tier1EnergyRefund: number;
    tier2EnergyRefund: number;
  };
}

export interface ReviveConfig {
  maxRevives: number;
  hpRatio: number;
  memoryFragments: number;
  reviveSurgeSec: number;
  tempoSurgeSec: number;
  blastRadius: number;
  blastDamage: number;
  blastKnockback: number;
  rewardPulse: RewardPulseConfig;
  rewardPulseDuration: number;
  message: string;
}

export interface SpawnGroupDefinition {
  id: SpawnGroupId;
  label: string;
  layout: SpawnGroupId;
  center?: Vec3Tuple;
  radius?: number;
  spread?: number;
  positions?: readonly Vec3Tuple[];
  preservePositions?: boolean;
}

export interface WavePresentationDefinition {
  id: string;
  label: string;
  objectiveTitle: string;
  objectiveDetail: string;
  startMessage: string;
  startWarning: SpawnWarningConfig;
  startWarningDuration: number;
  startDialogueTrigger?: string;
  startAudio?: AudioCueConfig;
  startCamera?: CameraImpactConfig;
}

export interface ObjectiveConfig {
  upgrade: { title: string; detail: string; progressLabel: string; progressText: string };
  preRod: { title: string; detail: string };
  prePistol: { title: string; detail: string };
  default: { title: string; detail: string };
  exitUnlocked: { title: string; detail: string; progressLabel: string; progressText: string };
}

export interface CinematicBeatDefinition {
  id: string;
  waveId: string;
  triggerAt: number;
  dialogueTrigger?: string;
  spawnWarning?: SpawnWarningConfig;
  spawnWarningDuration?: number;
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  cameraImpact?: CameraImpactConfig;
  effects?: readonly LevelEffectConfig[];
  audio?: AudioCueConfig;
  tempoSurgeSec?: number;
}

export type LevelRuntimeEventAction =
  | { type: "queue_dialogue"; trigger: string }
  | { type: "set_message"; message: string }
  | { type: "spawn_warning"; warning: SpawnWarningConfig; duration?: number }
  | { type: "reward_pulse"; pulse: RewardPulseConfig; duration?: number }
  | { type: "camera_impact"; cameraImpact: CameraImpactConfig }
  | { type: "audio"; audio: AudioCueConfig }
  | { type: "add_effect"; effect: LevelEffectConfig }
  | { type: "add_memory"; amount: number; rewardPulse?: RewardPulseConfig; rewardPulseDuration?: number }
  | { type: "open_upgrade"; choices?: readonly string[]; message?: string }
  | { type: "open_choice"; choiceId: string; message?: string }
  | { type: "set_environment_state"; stateId: string; duration?: number }
  | { type: "clear_environment_state"; stateId: string }
  | { type: "set_big_screen_state"; screenId: string; stateId: string }
  | { type: "adjust_campaign_route"; routeId: string; amount: number; label?: string; rewardPulse?: RewardPulseConfig; rewardPulseDuration?: number }
  | { type: "start_wave"; waveId: string; delay?: number; repeat?: boolean; immediate?: boolean }
  | { type: "unlock_door"; doorId: string }
  | { type: "open_door"; doorId: string; respectLock?: boolean }
  | { type: "close_door"; doorId: string; respectLock?: boolean }
  | { type: "lock_door"; doorId: string; respectLock?: boolean }
  | { type: "unlock_exit" }
  | { type: "complete_objective"; objectiveId: string }
  | { type: "grant_key_item"; keyItemId: string }
  | { type: "add_core_cells"; amount: number }
  | { type: "tempo_surge"; duration: number }
  | { type: "focus_reveal"; reveal: FocusRevealActionTarget };

/**
 * Target for a short 3D "target reveal" camera (route switch / puzzle door).
 * Ids are resolved against the level at runtime; a `puzzle` reveal with no
 * interactionId resolves via the firing switch state's `requiresSwitchState`.
 */
export interface FocusRevealActionTarget {
  kind: "door" | "puzzle" | "robot" | "room";
  doorId?: string;
  roomId?: string;
  interactionId?: string;
  cameraMode?: "auto" | "player_eye" | "door_front";
  durationSec?: number;
}

export interface LevelRuntimeEventDefinition {
  id: string;
  trigger: LevelEventTriggerDefinition;
  once?: boolean;
  actions: readonly LevelRuntimeEventAction[];
}

export interface LevelChoiceOptionDefinition {
  id: string;
  label: string;
  detail: string;
  tone?: "system" | "threat" | "reveal" | "player";
  routeDeltas?: readonly CampaignRouteDeltaConfig[];
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  actions: readonly LevelRuntimeEventAction[];
}

export interface LevelChoiceDefinition {
  id: string;
  title: string;
  detail: string;
  systemLabel?: string;
  options: readonly LevelChoiceOptionDefinition[];
}

export interface LevelEnvironmentStateDefinition {
  id: string;
  label: string;
  roomId?: string;
  tintColor?: string;
  glowColor?: string;
  intensity?: number;
  opacity?: number;
  duration?: number;
}

export interface LevelBossPhaseDefinition {
  id: string;
  actorId: EnemyArchetypeId;
  tier?: EnemyTierId;
  threshold: number;
  once?: boolean;
  actions: readonly LevelRuntimeEventAction[];
}

export interface LevelPresentationConfig {
  defaultWaveStartMessage: string;
  reinforcementMessage: string;
  waveLabels: Record<string, string>;
  objectives: ObjectiveConfig;
  flow: {
    title: {
      system: string;
      heading: string;
      body: string;
      signalStrip: readonly string[];
      startButton: string;
    };
    death: {
      system: string;
      heading: string;
      itchSuffix: string;
      reviveOfferPrefix: string;
      cacheReadyText: string;
      reviveButtonRewarded: string;
      reviveButtonLocal: string;
      restartButton: string;
      restartAfterReviveUsedButton: string;
    };
    transition: {
      system: string;
      heading: string;
    };
    victory: {
      system: string;
      heading: string;
      body: string;
      doubleMemoryButton: string;
      doubleMemoryClaimedButton: string;
      replayButton: string;
    };
  };
  waves: readonly WavePresentationDefinition[];
  spawnSourceLabels: Record<SpawnGroupId, string>;
  reinforcementWarningDuration: number;
  environmentPressure: {
    title: number;
    death: number;
    idle: number;
    exitUnlocked: number;
    byWave: Record<string, number>;
  };
}

export interface CombatLimitConfig {
  smallEnemyArchetypes: readonly EnemyArchetypeId[];
  eliteArchetypeId: EnemyArchetypeId;
  smallEnemyDamageMultiplier?: number;
}

export interface EnemyDeathBeatConfig {
  archetypeId: EnemyArchetypeId;
  spawnWarning?: SpawnWarningConfig;
  spawnWarningDuration?: number;
  cameraImpact?: CameraImpactConfig;
  dashBurst?: {
    lifetime: number;
    intensity: number;
  };
}

export interface LevelDefinition {
  id: string;
  title: string;
  authoringProfile?: LevelAuthoringProfile;
  /**
   * Opaque authoring-tool metadata (e.g. /build environment + lighting settings).
   * Round-tripped through config packs; the runtime ignores it.
   */
  authoringMetadata?: Record<string, unknown>;
  spawnPoint: Vec3Tuple;
  initialInventory?: {
    hasRod?: boolean;
    hasPistol?: boolean;
    coreCells?: number;
    equipWeapon?: WeaponId;
  };
  initialWaveStartDelay: number;
  requiresStoryPickupsBeforeWaves: boolean;
  exit: LevelExitDefinition;
  map?: LevelMapConfig;
  puzzles?: readonly LevelPuzzleDefinition[];
  articles?: readonly LevelArticleDefinition[];
  quizzes?: readonly LevelQuizDefinition[];
  switches?: readonly LevelSwitchDefinition[];
  bigScreens?: readonly LevelBigScreenDefinition[];
  objectiveChain?: readonly LevelObjectiveDefinition[];
  waves: readonly WaveDefinition[];
  events?: readonly LevelRuntimeEventDefinition[];
  choices?: readonly LevelChoiceDefinition[];
  campaignRoutes?: readonly CampaignRouteDefinition[];
  environmentStates?: readonly LevelEnvironmentStateDefinition[];
  bossPhases?: readonly LevelBossPhaseDefinition[];
  dialogues: readonly DialogueDefinition[];
  spawnGroups: readonly SpawnGroupDefinition[];
  cinematicBeats: readonly CinematicBeatDefinition[];
  pickups: PickupRulesConfig;
  economy: LevelEconomyConfig;
  revive: ReviveConfig;
  combatLimits: CombatLimitConfig;
  enemyDeathBeats: readonly EnemyDeathBeatConfig[];
  presentation: LevelPresentationConfig;
}
