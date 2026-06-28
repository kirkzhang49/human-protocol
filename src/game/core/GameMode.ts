import type { LevelSettlementState } from "./PlayerProgress";
import type { UltimateAbilityId } from "../config/ultimateAbilityConfig";

export type GameMode =
  | "title"
  | "levelIntro"
  | "playing"
  | "upgrade"
  | "choice"
  | "article"
  | "quiz"
  | "toolCalibration"
  | "sequencePlayback"
  | "circuitGrid"
  | "surveillance"
  | "valveMatrix"
  | "archiveMerge"
  | "galleryReading"
  | "routeSwitch"
  | "exitCinematic"
  | "transition"
  | "death"
  | "victory";

export interface DialogueLineState {
  id: string;
  speaker: string;
  line: string;
  tone: "system" | "threat" | "reveal" | "player";
  remaining: number;
  total: number;
}

export interface RewardPulseState {
  id: number;
  label: string;
  detail: string;
  rarity: "common" | "rare" | "epic" | "story";
  remaining: number;
  total: number;
}

export interface SpawnWarningState {
  id: number;
  label: string;
  detail: string;
  remaining: number;
  total: number;
}

export interface ThreatSegmentState {
  index: number;
  angle: number;
  intensity: number;
}

export interface CombatAssistState {
  autoFireEnabled: boolean;
  lockedEnemyId: number | null;
  lockedStrength: number;
  targetConeDegrees: number;
  targetDistance: number;
  threatSegments: ThreatSegmentState[];
  reorientCooldown: number;
  reorientTargetYaw: number | null;
}

export interface MapProgressState {
  currentRoomId: string | null;
  visitedRoomIds: string[];
  openedDoorIds: string[];
  unlockedDoorIds: string[];
  collectedKeyItemIds: string[];
  completedInteractionIds: string[];
  activeObjectiveId: string | null;
  completedObjectiveIds: string[];
  selectedChoiceIds: Record<string, string>;
  activeEnvironmentStateIds: string[];
  activeEnvironmentStateTimers: Record<string, number>;
  triggeredBossPhaseIds: string[];
  triggeredEventIds: string[];
  triggeredWaveIds: string[];
  completedWaveIds: string[];
  defeatedActorIds: string[];
  completedPuzzleIds: string[];
  readArticleIds: string[];
  completedQuizIds: string[];
  failedQuizCounts: Record<string, number>;
  activeSwitchStateIds: Record<string, string>;
  activatedSwitchIds: string[];
  switchActivationCounts: Record<string, number>;
  activeBigScreenStateIds: Record<string, string>;
  activatedBigScreenIds: string[];
  bigScreenActivationCounts: Record<string, number>;
  activePuzzleSequences: Record<string, string[]>;
  activeHitSequenceOrders: Record<string, string[]>;
  hitSequencePlaybackSeen: Record<string, boolean>;
  failedPuzzleCounts: Record<string, number>;
  puzzleTargetPulses: Record<string, number>;
  roomClueSeenIds: string[];
  keyItemDropPositions: Record<string, [number, number, number]>;
}

export interface PendingWaveStartState {
  waveId: string;
  remaining: number;
  sourceType: string;
  sourceId?: string;
  repeat?: boolean;
}

export interface InteractionPromptState {
  id: string;
  label: string;
  detail: string;
  controlLabel: string;
  canInteract: boolean;
}

export interface ExitCinematicState {
  type: "elevator_walk_in";
  elapsed: number;
  duration: number;
  walkInDuration: number;
  doorOpenTime: number;
  doorCloseTime: number;
  buttonPressTime: number;
  buttonPressDuration: number;
  ascentStartTime: number;
  ascentDuration: number;
  whiteOutTime: number;
  startPosition: [number, number, number];
  enterPosition: [number, number, number];
  startYaw: number;
  faceYaw: number;
  doorId: string | null;
}

export interface CampaignTransitionDialogueState {
  fromLevelId: string;
  toLevelId: string;
  lineIndex: number;
}

/**
 * Transient 3D "target reveal" camera state. While active the player is frozen
 * and both renderers (Three + Raw WebGPU) glide the camera to look at a door /
 * puzzle terminal / robot room so the player sees what a route switch or puzzle
 * just changed in another part of the level. Mode stays "playing" so doors keep
 * animating and robots keep waking during the reveal.
 */
export type DoorRevealMode = "open" | "close" | "toggle";

export interface FocusRevealState {
  kind: "door" | "puzzle" | "robot" | "room";
  /** Door / interaction id the reveal centers on (for debugging/QA). */
  targetId: string | null;
  /** Door reveal direction, so renderers can pace close animations as visibly as open ones. */
  doorMode?: DoorRevealMode;
  /** Room whose visibility the Raw renderer switches to during the reveal. */
  roomId: string | null;
  elapsed: number;
  duration: number;
  /** World-space point the camera looks at. */
  targetPosition: [number, number, number];
  /** World-space camera position, framed from the player's side of the target. */
  cameraPosition: [number, number, number];
  /** True when the reveal must cut to a remote/safe facility camera instead of gliding from the player's eye. */
  cameraCut?: boolean;
  /** True when another reveal follows immediately, so this reveal should not ease back to the player. */
  chainToNext?: boolean;
}

export interface HandInteractionState {
  interactionId: string;
  switchId: string;
  handPose: "elevator_button_press" | "lever_push_down";
  leverDirection?: "down" | "up";
  elapsed: number;
  duration: number;
  commitAt: number;
  committed: boolean;
  hideWeapon: boolean;
}

export interface DoorRevealQueueItem {
  doorId: string;
  mode: DoorRevealMode;
  durationSec: number;
  cameraMode?: "auto" | "player_eye" | "door_front";
}

export interface DeployedUltimateState {
  id: number;
  abilityId: UltimateAbilityId;
  phase: "held" | "thrown" | "deployed";
  position: [number, number, number];
  velocity?: [number, number, number];
  age: number;
  flightAge?: number;
  armed: boolean;
  blastRadius: number;
}

export interface GameSessionState {
  mode: GameMode;
  levelId: string;
  levelElapsed: number;
  waveIndex: number;
  activeWaveId: string | null;
  activeWaveElapsed: number;
  reinforcementCounts: Record<string, number>;
  cinematicBeatFlags: Record<string, boolean>;
  waveStartDelay: number;
  exitUnlocked: boolean;
  pendingUpgradeIds: string[];
  appliedUpgradeIds: string[];
  activeChoiceId: string | null;
  activeArticleId: string | null;
  activeQuizId: string | null;
  activeToolCalibrationPuzzleId: string | null;
  activeSequencePlaybackPuzzleId: string | null;
  activeCircuitGridPuzzleId: string | null;
  activeSurveillancePuzzleId: string | null;
  activeValveMatrixPuzzleId: string | null;
  activeArchiveMergePuzzleId: string | null;
  activeGalleryReadingPuzzleId: string | null;
  activeRouteSwitchId: string | null;
  activeFocusReveal: FocusRevealState | null;
  activeHandInteraction: HandInteractionState | null;
  doorRevealQueue: DoorRevealQueueItem[];
  doorTransitionRevisions: Record<string, number>;
  quizError: string | null;
  quizErrorRemaining: number;
  activeDialogue: DialogueLineState | null;
  dialogueQueue: DialogueLineState[];
  activeExitCinematic: ExitCinematicState | null;
  activeCampaignTransitionDialogue: CampaignTransitionDialogueState | null;
  transitionRemaining: number;
  deathReason: "combat" | null;
  reviveSurgeRemaining: number;
  tempoSurgeRemaining: number;
  memoryCacheTier: number;
  coreCells: number;
  activeUltimateAbilityId: UltimateAbilityId;
  deployedUltimate: DeployedUltimateState | null;
  hasRod: boolean;
  hasPistol: boolean;
  repairDropPity: number;
  coreCellDropPity: number;
  memoryRewardDoubled: boolean;
  revivesUsed: number;
  kills: number;
  memoryFragments: number;
  levelSettled: boolean;
  settlement: LevelSettlementState | null;
  killStreak: number;
  bestKillStreak: number;
  killStreakRemaining: number;
  lowEnergyPulseCooldown: number;
  renderSurgeId: number;
  renderSurgeRemaining: number;
  renderSurgeTotal: number;
  renderSurgeIntensity: number;
  rewardPulse: RewardPulseState | null;
  spawnWarning: SpawnWarningState | null;
  activeCodeLockPuzzleId: string | null;
  activeCodeLockInput: string;
  codeLockError: string | null;
  codeLockErrorRemaining: number;
  mapProgress: MapProgressState;
  interactionPrompt: InteractionPromptState | null;
  pendingWaveStarts: PendingWaveStartState[];
  message: string;
}
