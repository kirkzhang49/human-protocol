import { Quaternion, Vector3 } from "three";
import type { AudioCueEvent, AudioCueOptions } from "../audio/AudioTypes";
import { activeLevelConfig, defaultLevelId, getLevelConfig, getNextCampaignLevelConfig } from "../config/ConfigPackStore";
import { bossFeedbackForEnemy, bossStaggerTuningForEnemy, bossVisualProfileForEnemy, type BossFeedbackRecipe } from "../config/bossVisualProfiles";
import { campaignTransitionDialogueFor } from "../config/campaignTransitionDialogues";
import { enemyArchetypes, type EnemyArchetypeId } from "../config/enemyArchetypes";
import { enemyReactionProfileFor } from "../config/enemyReactionProfiles";
import { enemyTierProfiles, type EnemyTierOverrideConfig } from "../config/enemyTiers";
import { arenaObstacles } from "../config/gameBalance";
import { localizedConfigCopy, localizedConfigText, localizedDialogue, localizedExit } from "../config/LevelLocalization";
import { createDialogueTriggerMap, waveById } from "../config/levelManifest";
import { isDynamicMapProp, resolvePropCollisionProxy } from "../config/MapGeometry";
import { playerConfig } from "../config/playerConfig";
import { resolveRoomPresentation } from "../config/RoomPresentationRegistry";
import { defaultUltimateAbilityId, ultimateAbilityConfig, type UltimateAbilityConfig } from "../config/ultimateAbilityConfig";
import type {
  AudioCueConfig,
  CameraImpactConfig,
  CampaignRouteDeltaConfig,
  FocusRevealActionTarget,
  LevelInteractionDefinition,
  LevelArticleDefinition,
  LevelBigScreenDefinition,
  LevelCodeLockFormulaDefinition,
  DoorLockDefinition,
  LevelDoorDefinition,
  LevelEnvironmentStateDefinition,
  LevelEffectConfig,
  LevelKeyItemDefinition,
  LevelMapPickupDefinition,
  LevelMapPropDefinition,
  LevelRoomDefinition,
  LevelObjectiveDefinition,
  LevelObjectiveTriggerDefinition,
  LevelCodeLockPuzzleDefinition,
  LevelHitSequencePuzzleDefinition,
  LevelArchiveMergePuzzleDefinition,
  LevelGalleryReadingPuzzleDefinition,
  LevelCircuitGridPuzzleDefinition,
  LevelSurveillanceMatchPuzzleDefinition,
  LevelToolCalibrationPuzzleDefinition,
  LevelValveMatrixPuzzleDefinition,
  LevelQuizDefinition,
  LevelRuntimeEventAction,
  LevelSwitchDefinition,
  LevelSwitchStateDefinition,
  LevelExitCinematicDefinition,
  LevelPuzzleDefinition,
  LevelPuzzleTargetDefinition,
  LevelDefinition,
  StoryPickupDefinition,
} from "../config/schema/levelConfig";
import { localizedUpgrade, localizedUpgradeRarity } from "../config/UpgradeLocalization";
import { upgradeById, upgradePool, type UpgradeDefinition } from "../config/upgradePool";
import type { WeaponId } from "../config/weaponConfig";
import { createEnemyRobot, createEnemyRobots, resetEnemyRobot, type EnemySpawnRuntimeOptions } from "../entities/createEnemyRobot";
import { createPlayerRobot } from "../entities/createPlayerRobot";
import type { DynamicPropState, EffectState, EffectType, ObstacleState, PickupState, WorldInputState } from "../entities/EntityTypes";
import type { EnemyState } from "../entities/EnemyState";
import type { ProjectileState } from "../entities/ProjectileState";
import type { RobotState } from "../entities/RobotState";
import { createNullPhysicsWorldAdapter } from "../physics/NullPhysicsWorldAdapter";
import { createRapierPhysicsWorldAdapter } from "../physics/RapierPhysicsWorldAdapter";
import type { PhysicsKinematicCircleMove, PhysicsKinematicMoveResult, PhysicsSegmentHit, PhysicsWorldAdapter } from "../physics/PhysicsWorldAdapter";
import { startWaveNow } from "../systems/WaveDirectorSystem";
import {
  loadPlayerProgress,
  memoryToNextProgressLevel,
  progressStatEffects,
  savePlayerProgress,
  settleProgressMemory,
  type PlayerProgress,
  type ProgressStatId,
} from "./PlayerProgress";
import {
  loadGameSettings,
  normalizeLanguage,
  normalizeVolume,
  normalizeTouchLookSensitivity,
  saveGameSettings,
  type GameLanguage,
  type GameSettings,
} from "./GameSettings";
import { ExitFlowStateMachine, type ExitActivationSource } from "./ExitFlowStateMachine";
import { resolveExitCinematicTiming } from "./ExitCinematicTiming";
import {
  loadUserProfile,
  adjustCampaignRoute as persistCampaignRouteAdjustment,
  recordCampaignRouteChoice,
  recordLevelAttempt,
  recordLevelCompletion,
  recordMemoryRewardDoubled,
  recordRunDeath,
  recordUpgradeOffer,
  recordUpgradePick,
  syncUserProfileProgress,
  type UserProfile,
} from "./UserProfile";
import type {
  CombatAssistState,
  DialogueLineState,
  DoorRevealMode,
  ExitCinematicState,
  FocusRevealState,
  GameMode,
  GameSessionState,
  DoorRevealQueueItem,
  MapProgressState,
  RewardPulseState,
  SpawnWarningState,
} from "./GameMode";
import { createCameraState, createCombatAssistState, createTouchInputState, createWorldInputState } from "./GameWorldStateFactory";
import type { ObjectiveEvent, RuntimeDebugOptions, TouchInputState, UpgradeModifiers } from "./GameWorldTypes";
import { clamp, segmentIntersectionTimeAabb2D, segmentIntersectionTimeObb2D } from "./math";
import { ObstacleSpatialIndex } from "./ObstacleSpatialIndex";
import { createPlatformAdapter, type PlatformAdapter } from "./PlatformAdapter";
import { RenderPerformanceGovernor } from "./RenderPerformance";
import { recordHumanProtocolPerfEvent } from "./RenderSpikeRecorder";

export type { ObjectiveEvent, RuntimeDebugOptions, TouchInputState, UpgradeModifiers } from "./GameWorldTypes";

const dialogueToastDurationScale = 0.5;
const RECLAMATION_MOTHER_BOSS_MODEL_KEY = "hp_enemy_reclamation_mother_final_horror";
const MAX_DYNAMIC_PROPS = 12;
const DYNAMIC_PROP_SLEEP_DESPAWN_SECONDS = 12;
const DYNAMIC_PROP_HARD_DESPAWN_SECONDS = 45;

export class GameWorld {
  readonly platform: PlatformAdapter = createPlatformAdapter();
  readonly renderPerformance = new RenderPerformanceGovernor();
  readonly exitFlow = new ExitFlowStateMachine();
  readonly obstacleSpatialIndex = new ObstacleSpatialIndex(4);

  /**
   * Guard illegal mode transitions: close/submit handlers must not resurrect a
   * terminal state (death/victory) back to "playing". Authoritative setters
   * (revivePlayer, enterDeath, completeLevel) bypass this via direct assignment.
   */
  private setMode(next: GameMode) {
    if ((this.session.mode === "death" || this.session.mode === "victory") && next === "playing") {
      return;
    }
    this.session.mode = next;
  }
  readonly debugOptions: RuntimeDebugOptions = readRuntimeDebugOptions();
  readonly physics: PhysicsWorldAdapter = this.debugOptions.physicsMode === "rapier"
    ? createRapierPhysicsWorldAdapter()
    : createNullPhysicsWorldAdapter();
  level: LevelDefinition = activeLevelConfig;
  levelRevision = 0;
  private dialogueByTrigger = createDialogueTriggerMap(this.level.dialogues);

  player: RobotState = createPlayerRobot();
  projectiles: ProjectileState[] = [];
  effects: EffectState[] = [];
  pickups: PickupState[] = [];
  dynamicProps: DynamicPropState[] = [];
  enemies: EnemyState[] = createEnemyRobots(1000);
  obstacles: ObstacleState[] = [];

  input: WorldInputState = createWorldInputState();

  touchInput: TouchInputState = createTouchInputState();

  session: GameSessionState = this.createSession("title");

  combatAssist: CombatAssistState = createCombatAssistState();

  upgrades: UpgradeModifiers = this.createUpgradeModifiers();

  camera = createCameraState();

  paused = false;
  frameTimeMs = 0;
  frameIndex = 0;
  combatHitStopRemaining = 0;
  combatHitStopScale = 1;
  enemySpawnSequence = 0;
  renderWarmupComplete = false;
  lastCombatWeapon: WeaponId = "pulseRifle";
  playerProgress: PlayerProgress = loadPlayerProgress();
  settings: GameSettings = loadGameSettings();
  userProfile: UserProfile = loadUserProfile(this.playerProgress);

  private nextEntityId = 100;
  private nextAudioEventId = 0;
  private nextRewardPulseId = 0;
  private nextSpawnWarningId = 0;
  private nextRenderSurgeId = 0;
  private readonly audioEvents: AudioCueEvent[] = [];
  private readonly objectiveEvents: ObjectiveEvent[] = [];
  private readonly puzzleHitDelta = new Vector3();
  private readonly puzzleHitDirection = new Vector3();
  private readonly enemyHitDirection = new Vector3();
  private readonly levelChangeListeners = new Set<() => void>();
  private obstacleIndexDirty = true;
  private physicsInitRequested = false;
  private physicsQuerySamples = 0;
  private physicsQueryMismatches = 0;

  nextId() {
    this.nextEntityId += 1;
    return this.nextEntityId;
  }

  subscribeLevelChanges(listener: () => void) {
    this.levelChangeListeners.add(listener);
    return () => {
      this.levelChangeListeners.delete(listener);
    };
  }

  markObstacleIndexDirty() {
    this.obstacleIndexDirty = true;
  }

  syncObstacleIndex() {
    if (this.obstacleIndexDirty) {
      this.obstacleSpatialIndex.sync(this.obstacles);
      this.obstacleIndexDirty = false;
    }
    return this.obstacleSpatialIndex;
  }

  ensurePhysicsReady() {
    if (this.debugOptions.physicsMode !== "rapier" || this.physicsInitRequested) return;
    if (this.physics.ready) {
      this.physicsInitRequested = true;
      return;
    }
    this.physicsInitRequested = true;
    void this.physics.init().then((ready) => {
      if (ready) {
        this.syncPhysicsStaticObstacles();
      }
    });
  }

  syncPhysicsStaticObstacles() {
    this.ensurePhysicsReady();
    if (!this.physics.ready) return false;
    this.physics.syncStaticObstacles(this.obstacles);
    return true;
  }

  moveKinematicCircleWithPhysics(move: PhysicsKinematicCircleMove): PhysicsKinematicMoveResult | null {
    if (!this.syncPhysicsStaticObstacles()) return null;
    return this.physics.moveKinematicCircle(move);
  }

  spawnDynamicProp(config: {
    id?: string;
    modelKey: string;
    position: Vector3;
    halfSize: Vector3;
    scale?: Vector3;
    yaw?: number;
    roomId?: string;
    mass?: number;
  }) {
    if (this.dynamicProps.length >= MAX_DYNAMIC_PROPS) return null;
    const yaw = config.yaw ?? 0;
    const prop: DynamicPropState = {
      id: config.id ?? `dynamic_prop_${this.nextId()}`,
      modelKey: config.modelKey,
      ...(config.roomId ? { roomId: config.roomId } : {}),
      position: config.position.clone(),
      rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw),
      scale: config.scale?.clone() ?? new Vector3(1, 1, 1),
      halfSize: config.halfSize.clone(),
      yaw,
      mass: Math.max(0.001, config.mass ?? 1),
      age: 0,
      sleeping: false,
    };
    this.dynamicProps.push(prop);
    this.syncPhysicsDynamicProps();
    return prop;
  }

  applyDynamicPropImpulse(id: string, impulse: Vector3) {
    return this.physics.applyDynamicImpulse(id, impulse);
  }

  applyDynamicPropImpulseFromPoint(origin: Vector3, radius: number, strength: number) {
    if (radius <= 0 || strength <= 0) return 0;
    let pushed = 0;
    for (const prop of this.dynamicProps) {
      let dx = prop.position.x - origin.x;
      let dz = prop.position.z - origin.z;
      let distanceSq = dx * dx + dz * dz;
      if (distanceSq > radius * radius) continue;
      if (distanceSq < 0.0001) {
        const angle = deterministicDynamicPropImpulseAngle(prop.id);
        dx = Math.cos(angle) * 0.01;
        dz = Math.sin(angle) * 0.01;
        distanceSq = dx * dx + dz * dz;
      }
      const distance = Math.sqrt(Math.max(0.0001, distanceSq));
      const falloff = 1 - Math.min(1, distance / radius);
      const impulse = new Vector3((dx / distance) * strength * falloff, 0, (dz / distance) * strength * falloff);
      if (this.applyDynamicPropImpulse(prop.id, impulse)) pushed += 1;
    }
    return pushed;
  }

  syncPhysicsDynamicProps() {
    this.physics.syncDynamicPropBodies(
      this.dynamicProps.map((prop) => ({
        id: prop.id,
        position: prop.position,
        halfSize: prop.halfSize,
        yaw: prop.yaw,
        mass: prop.mass,
      })),
    );
  }

  syncDynamicPropsFromPhysics(delta = 0) {
    const snapshots = this.physics.dynamicBodySnapshots();
    const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const ageDelta = Math.max(0, delta);
    for (const prop of this.dynamicProps) {
      prop.age += ageDelta;
      const snapshot = snapshotById.get(prop.id);
      if (!snapshot) continue;
      prop.position.copy(snapshot.position);
      prop.rotation.copy(snapshot.rotation);
      prop.yaw = yawFromQuaternion(snapshot.rotation);
      prop.sleeping = snapshot.sleeping;
    }
    this.pruneDynamicProps();
  }

  private pruneDynamicProps() {
    const beforeCount = this.dynamicProps.length;
    for (let index = this.dynamicProps.length - 1; index >= 0; index -= 1) {
      const prop = this.dynamicProps[index];
      const sleptPastGrace = prop.sleeping && prop.age >= DYNAMIC_PROP_SLEEP_DESPAWN_SECONDS;
      const exceededHardLifetime = prop.age >= DYNAMIC_PROP_HARD_DESPAWN_SECONDS;
      if (sleptPastGrace || exceededHardLifetime) this.dynamicProps.splice(index, 1);
    }
    if (this.dynamicProps.length !== beforeCount) this.syncPhysicsDynamicProps();
  }

  physicsDebugSnapshot() {
    return {
      ...this.physics.debugSnapshot(),
      querySamples: this.physicsQuerySamples,
      queryMismatches: this.physicsQueryMismatches,
    };
  }

  isSegmentBlockedByObstacle(start: Vector3, end: Vector3, radius = 0.05) {
    return Boolean(this.segmentHitObstacle(start, end, radius, () => true));
  }

  isProjectileSegmentBlockedByObstacle(start: Vector3, end: Vector3, radius = 0.05) {
    return Boolean(this.projectileSegmentHitObstacle(start, end, radius));
  }

  projectileSegmentHitObstacle(start: Vector3, end: Vector3, radius = 0.05) {
    return this.segmentHitObstacle(start, end, radius, (obstacle) => projectileObstacleBlocks(obstacle, start, end, radius));
  }

  hasProjectileLineOfSight(start: Vector3, end: Vector3, radius = 0.05) {
    return !this.isProjectileSegmentBlockedByObstacle(start, end, radius);
  }

  hasEnemyNavigationLineOfSight(start: Vector3, end: Vector3, radius = 0.05) {
    return this.segmentHitObstacle(start, end, radius, isStructuralObstacle) === null;
  }

  private segmentHitObstacle(
    start: Vector3,
    end: Vector3,
    radius: number,
    shouldBlock: (obstacle: ObstacleState) => boolean,
  ) {
    const legacyHit = () => this.legacySegmentHitObstacle(start, end, radius, shouldBlock);
    if (this.syncPhysicsStaticObstacles()) {
      const rapierHit = this.physics.castSegment({ start, end, radius, filter: shouldBlock });
      if (this.debugOptions.physicsDualRun) {
        const oldBlocked = Boolean(legacyHit());
        this.physicsQuerySamples += 1;
        if (oldBlocked !== Boolean(rapierHit)) this.physicsQueryMismatches += 1;
      }
      return rapierHit;
    }
    return legacyHit();
  }

  private legacySegmentHitObstacle(
    start: Vector3,
    end: Vector3,
    radius: number,
    shouldBlock: (obstacle: ObstacleState) => boolean,
  ): PhysicsSegmentHit | null {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const halfLength = Math.sqrt(dx * dx + dz * dz) * 0.5;
    if (halfLength <= 0.001 || this.obstacles.length === 0) return null;

    const centerX = (start.x + end.x) * 0.5;
    const centerZ = (start.z + end.z) * 0.5;
    const broadRadius = halfLength + radius + 4;
    let bestHit: PhysicsSegmentHit | null = null;
    for (const obstacle of this.syncObstacleIndex().queryCircle(centerX, centerZ, broadRadius)) {
      if (!shouldBlock(obstacle)) continue;
      const timeOfImpact = obstacle.yaw
        ? segmentIntersectionTimeObb2D(start, end, obstacle.position, obstacle.halfSize, obstacle.yaw, radius)
        : segmentIntersectionTimeAabb2D(start, end, obstacle.position, obstacle.halfSize, radius);
      if (timeOfImpact === null) continue;
      if (bestHit && timeOfImpact >= bestHit.timeOfImpact) continue;
      bestHit = {
        obstacle,
        position: start.clone().lerp(end, timeOfImpact),
        timeOfImpact,
      };
    }
    return bestHit;
  }

  hasLineOfSight(start: Vector3, end: Vector3, radius = 0.05) {
    return !this.isSegmentBlockedByObstacle(start, end, radius);
  }

  nextCampaignLevel() {
    return getNextCampaignLevelConfig(this.level.id);
  }

  loadLevel(levelId: string, mode: GameSessionState["mode"] = "title") {
    this.level = getLevelConfig(levelId);
    this.dialogueByTrigger = createDialogueTriggerMap(this.level.dialogues);
    this.levelRevision += 1;
    this.paused = false;
    this.resetLevel(mode);
    this.syncLevelUrl();
    this.notifyLevelChange();
    if (mode === "playing") {
      this.platform.reportGameplayStart();
      this.queueDialogue("level_start");
    } else {
      this.platform.reportGameplayStop();
    }
    return true;
  }

  loadNextCampaignLevel(mode: GameSessionState["mode"] = "title") {
    const nextLevel = this.nextCampaignLevel();
    if (!nextLevel) return false;
    return this.loadLevel(nextLevel.id, mode);
  }

  startDemo() {
    this.emitAudio("ui_start", { intensity: 0.8 });
    this.resetLevel("playing");
    this.platform.reportGameplayStart();
    this.queueDialogue("level_start");
  }

  resetPlayer() {
    this.resetLevel("playing");
    this.platform.reportGameplayStart();
    this.queueDialogue("level_start");
  }

  restartFromDeath() {
    this.resetLevel("playing");
    this.platform.reportGameplayStart();
    this.queueDialogue("level_start");
  }

  async requestRevive() {
    if (this.session.revivesUsed >= this.level.revive.maxRevives) {
      this.restartFromDeath();
      return;
    }

    if (this.platform.canShowRewardedAd()) {
      const result = await this.platform.showRewardedRevive();
      if (result === "skipped") {
        this.session.message = this.configText("急救已取消。");
        return;
      }
      if (result === "unavailable") {
        this.session.message = this.configText("急救链路暂不可用。");
        return;
      }
    }

    this.revivePlayer();
  }

  revivePlayer() {
    const revive = this.level.revive;
    if (this.session.revivesUsed >= revive.maxRevives) {
      this.restartFromDeath();
      return;
    }

    this.session.revivesUsed += 1;
    this.session.mode = "playing";
    this.session.deathReason = null;
    this.session.reviveSurgeRemaining = revive.reviveSurgeSec;
    this.session.tempoSurgeRemaining = Math.max(this.session.tempoSurgeRemaining, revive.tempoSurgeSec);
    this.session.memoryFragments += revive.memoryFragments;
    this.checkMemoryCacheMilestone();
    this.player.health = Math.max(this.player.health, this.player.maxHealth * revive.hpRatio);
    this.player.energy = this.player.maxEnergy;
    this.player.heat = 0;
    this.player.fireCooldownRemaining = 0;
    this.player.currentWeapon = this.preferredReviveWeapon();
    this.lastCombatWeapon = this.player.currentWeapon;
    this.player.weaponSwitchSequence += 1;
    this.platform.reportGameplayStart();

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const distance = enemy.position.distanceTo(this.player.position);
      if (distance < revive.blastRadius) {
        enemy.health = Math.max(0, enemy.health - revive.blastDamage);
        this.enemyHitDirection.subVectors(enemy.position, this.player.position).setY(0);
        this.markEnemyHit(enemy, this.enemyHitDirection, 1.25);
        enemy.velocity
          .subVectors(enemy.position, this.player.position)
          .setY(0)
          .normalize()
          .multiplyScalar(revive.blastKnockback);
        if (enemy.health <= 0) {
          this.killEnemy(enemy);
        }
      }
    }

    this.addEffect("dashBurst", this.player.position, this.player.aimDirection, 0.55, 2.2);
    this.setRewardPulse(revive.rewardPulse, revive.rewardPulseDuration);
    this.emitAudio("ui_revive", { intensity: 1.15 });
    this.emitAudio("weapon_shock_burst", { intensity: 0.9, position: this.player.position });
    this.camera.shake = Math.max(this.camera.shake, 0.8);
    this.camera.fovKick = Math.max(this.camera.fovKick, 4.5);
    this.camera.shakeSeed += 1;
    this.session.message = this.configText(revive.message);
  }

  enterDeath(reason: GameSessionState["deathReason"], message: string) {
    if (this.session.mode === "death") return;

    this.player.health = 0;
    this.session.mode = "death";
    this.session.deathReason = reason;
    this.session.message = this.configText(message);
    this.session.killStreakRemaining = 0;
    this.session.killStreak = 0;
    recordRunDeath(this.userProfile, this.createRunRecordInput());
    this.platform.reportGameplayStop();
    this.camera.shake = Math.max(this.camera.shake, 0.55);
    this.camera.fovKick = Math.max(this.camera.fovKick, 3.2);
    this.camera.shakeSeed += 1;
    this.emitAudio("ui_death", { intensity: 1 });
  }

  chooseUpgrade(upgradeId: string) {
    if (this.session.mode !== "upgrade") return;
    const upgrade = upgradeById.get(upgradeId);
    if (!upgrade) return;

    this.session.appliedUpgradeIds.push(upgradeId);
    this.session.pendingUpgradeIds = [];
    recordUpgradePick(this.userProfile, this.session.levelId, upgradeId);
    this.applyUpgrade(upgradeId);
    this.equipWeaponForUpgrade(upgrade);
    this.session.mode = "playing";
    this.session.waveStartDelay = 0.9;
    this.session.tempoSurgeRemaining = Math.max(this.session.tempoSurgeRemaining, 5);
    this.player.heat = Math.max(0, this.player.heat - 38);
    this.player.energy = this.player.maxEnergy;
    const upgradeCopy = localizedUpgrade(upgrade, this.settings.language);
    this.session.message = this.settings.language === "en" ? `${upgradeCopy.title} active.` : `${upgrade.title} 生效。`;
    this.platform.reportGameplayStart();
    this.setRewardPulse({
      label: this.settings.language === "en" ? `${localizedUpgradeRarity(upgrade.rarity, "en")} upgrade active` : `${rarityLabelForUpgrade(upgrade.rarity)}强化生效`,
      detail: upgradeCopy.title,
      rarity: pulseRarityForUpgrade(upgrade.rarity),
    }, 1.8);
    this.emitAudio("ui_upgrade_select", { intensity: upgrade.rarity === "Epic" || upgrade.rarity === "Prototype" ? 1.25 : 1 });
  }

  skipDialogue() {
    this.session.activeDialogue = null;
    this.session.dialogueQueue.length = 0;
  }

  queueDialogue(trigger: string) {
    const matches = this.dialogueByTrigger.get(trigger);
    if (!matches) return;
    for (const line of matches) {
      const localized = localizedDialogue(this.level, line, this.settings.language);
      const duration = Math.max(0.8, line.duration * dialogueToastDurationScale);
      const queued: DialogueLineState = {
        id: `${line.id}-${this.session.levelElapsed.toFixed(2)}-${this.session.dialogueQueue.length}`,
        speaker: localized.speaker,
        line: localized.line,
        tone: line.tone,
        remaining: duration,
        total: duration,
      };
      this.session.dialogueQueue.push(queued);
    }
  }

  openUpgrade(configuredChoiceIds?: readonly string[]) {
    if (this.session.mode !== "playing") return false;
    this.session.pendingUpgradeIds = configuredChoiceIds?.length
      ? this.configuredUpgradeChoices(configuredChoiceIds)
      : this.rollUpgrades();
    if (this.session.pendingUpgradeIds.length === 0) {
      this.session.pendingUpgradeIds = this.rollUpgrades();
    }
    if (this.session.pendingUpgradeIds.length === 0) return false;
    recordUpgradeOffer(this.userProfile, this.session.pendingUpgradeIds);
    this.session.mode = "upgrade";
    this.platform.reportGameplayStop();
    return true;
  }

  openChoice(choiceId: string, message?: string) {
    const choice = this.level.choices?.find((candidate) => candidate.id === choiceId);
    if (!choice) return false;
    if (message) this.session.message = this.configText(message);
    this.session.activeChoiceId = choice.id;
    this.session.mode = "choice";
    this.platform.reportGameplayStop();
    return true;
  }

  activeChoice() {
    const choiceId = this.session.activeChoiceId;
    if (!choiceId) return null;
    return this.level.choices?.find((choice) => choice.id === choiceId) ?? null;
  }

  chooseRuntimeChoice(optionId: string) {
    if (this.session.mode !== "choice") return false;
    const choice = this.activeChoice();
    const option = choice?.options.find((candidate) => candidate.id === optionId);
    if (!choice || !option) return false;

    this.session.mapProgress.selectedChoiceIds[choice.id] = option.id;
    this.session.activeChoiceId = null;
    this.session.mode = "playing";
    this.platform.reportGameplayStart();
    const choiceEvent: ObjectiveEvent = { type: "choice_selected", id: choice.id, optionId: option.id };
    if (option.routeDeltas?.length) {
      const routeDeltas = option.routeDeltas.map((delta) => this.resolveCampaignRouteDelta(delta));
      recordCampaignRouteChoice(this.userProfile, {
        levelId: this.session.levelId,
        choiceId: choice.id,
        optionId: option.id,
        routeDeltas,
      });
      for (const delta of routeDeltas) {
        this.adjustCampaignRoute(delta, choiceEvent);
      }
    }
    if (option.rewardPulse) {
      this.setRewardPulse(option.rewardPulse, option.rewardPulseDuration ?? 1.45);
    }
    this.dispatchObjectiveEvent(choiceEvent);
    this.runConfiguredActions(option.actions, choiceEvent);
    return true;
  }

  unlockExit() {
    if (this.session.exitUnlocked) return;
    const exit = localizedExit(this.level, this.settings.language);
    this.session.exitUnlocked = true;
    this.session.message = exit.unlockMessage;
    this.queueDialogue(this.level.exit.unlockDialogueTrigger);
    this.unlockConfiguredDoor(this.exitDoorId());
    this.dispatchObjectiveEvent({ type: "exit_unlocked", id: this.level.exit.id });
    const dx = this.level.exit.position[0] - this.player.position.x;
    const dz = this.level.exit.position[2] - this.player.position.z;
    this.combatAssist.reorientTargetYaw = Math.atan2(dx, -dz);
    this.setSpawnWarning(exit.unlockWarning, 2.8);
    this.emitAudio("system_exit_open", { intensity: 1.1 });
    this.camera.shake = Math.max(this.camera.shake, 0.55);
    this.camera.fovKick = Math.max(this.camera.fovKick, 4.2);
    this.camera.shakeSeed += 1;
  }

  activateExit(source: ExitActivationSource) {
    return this.exitFlow.requestActivation(this, source);
  }

  beginExitCinematic(source: ExitActivationSource) {
    if (this.session.mode !== "playing") return;
    const cinematic = this.level.exit.cinematic;
    if (!cinematic) return;

    const exit = localizedExit(this.level, this.settings.language);
    const exitInteraction = this.level.map?.interactions.find((interaction) => interaction.type === "exit");
    if (exitInteraction) {
      this.completeConfiguredInteraction(exitInteraction.id);
    }

    const timing = resolveExitCinematicTiming(cinematic);
    const state: ExitCinematicState = {
      type: cinematic.type,
      elapsed: 0,
      duration: timing.duration,
      walkInDuration: timing.walkInDuration,
      doorOpenTime: timing.doorOpenTime,
      doorCloseTime: timing.doorCloseTime,
      buttonPressTime: timing.buttonPressTime,
      buttonPressDuration: timing.buttonPressDuration,
      ascentStartTime: timing.ascentStartTime,
      ascentDuration: timing.ascentDuration,
      whiteOutTime: timing.whiteOutTime,
      startPosition: [this.player.position.x, this.player.position.y, this.player.position.z],
      enterPosition: [cinematic.enterPosition[0], cinematic.enterPosition[1], cinematic.enterPosition[2]],
      startYaw: this.player.rotationY,
      faceYaw: this.resolveExitCinematicFaceYaw(cinematic),
      doorId: cinematic.doorId ?? null,
    };

    this.session.activeExitCinematic = state;
    this.session.mode = "exitCinematic";
    this.session.message = cinematic.message ? this.configText(cinematic.message) : exit.transitionMessage;
    this.projectiles.length = 0;
    this.player.velocity.set(0, 0, 0);
    this.player.isMoving = false;
    this.player.movementAmount = 0;
    this.platform.reportGameplayStop();
    this.combatAssist.lockedEnemyId = null;
    this.combatAssist.lockedStrength = 0;
    this.triggerRenderSurge(0.85, Math.min(0.75, state.duration * 0.2));
    this.emitAudio("system_exit_open", { intensity: 1.05, position: vectorFromTuple(cinematic.enterPosition) });
    recordHumanProtocolPerfEvent(this, "exit_cinematic_started", {
      levelId: this.level.id,
      exitId: this.level.exit.id,
      source,
      doorId: state.doorId,
    });
  }

  private resolveExitCinematicFaceYaw(cinematic: LevelExitCinematicDefinition) {
    const target = this.exitCinematicLookTarget(cinematic);
    if (target) {
      const dx = target[0] - cinematic.enterPosition[0];
      const dz = target[2] - cinematic.enterPosition[2];
      if (Math.hypot(dx, dz) > 0.001) return Math.atan2(dx, -dz);
    }
    return cinematic.faceYaw ?? this.player.rotationY;
  }

  private exitCinematicLookTarget(cinematic: LevelExitCinematicDefinition): readonly [number, number, number] | null {
    if (cinematic.lookAtPosition) return cinematic.lookAtPosition;

    const props = this.level.map?.props ?? [];
    if (cinematic.lookAtPropId) {
      const prop = props.find((candidate) => candidate.id === cinematic.lookAtPropId);
      if (prop) return prop.position;
    }

    const exitRoomId = this.exitCinematicRoomId(cinematic);
    const buttonProps = props.filter((prop) => {
      const tags = prop.tags ?? [];
      return tags.includes("button_panel") || tags.includes("exit_call_buttons") || prop.modelKey === "service_elevator_call_buttons";
    });
    const roomButton = exitRoomId ? buttonProps.find((prop) => prop.roomId === exitRoomId) : undefined;
    if (roomButton) return roomButton.position;

    const [ex, , ez] = cinematic.enterPosition;
    let nearest: (typeof buttonProps)[number] | null = null;
    let nearestDistSq = Number.POSITIVE_INFINITY;
    for (const prop of buttonProps) {
      const dx = prop.position[0] - ex;
      const dz = prop.position[2] - ez;
      const distSq = dx * dx + dz * dz;
      if (distSq < nearestDistSq) {
        nearest = prop;
        nearestDistSq = distSq;
      }
    }
    return nearest?.position ?? null;
  }

  private exitCinematicRoomId(cinematic: LevelExitCinematicDefinition): string | null {
    const exitInteraction = this.level.map?.interactions.find((interaction) => interaction.type === "exit");
    if (exitInteraction?.roomId) return exitInteraction.roomId;
    if (!cinematic.doorId) return null;
    const door = this.level.map?.doors.find((candidate) => candidate.id === cinematic.doorId);
    if (!door) return null;
    const [ex, , ez] = cinematic.enterPosition;
    const rooms = this.level.map?.rooms.filter((room) => room.id === door.fromRoomId || room.id === door.toRoomId) ?? [];
    return rooms.find((room) => pointInRoomBounds(ex, ez, room))?.id ?? door.toRoomId ?? door.fromRoomId ?? null;
  }

  beginExitTransition(source: ExitActivationSource) {
    if (this.session.mode !== "playing" && this.session.mode !== "exitCinematic") return;
    const exit = localizedExit(this.level, this.settings.language);
    const nextLevel = this.nextCampaignLevel();
    const transitionTargetLevelId = nextLevel?.id ?? null;
    const campaignTransitionDialogue = transitionTargetLevelId
      ? campaignTransitionDialogueFor(this.level.id, transitionTargetLevelId, this.settings.language)
      : null;
    const exitInteraction = this.level.map?.interactions.find((interaction) => interaction.type === "exit");
    if (exitInteraction) {
      this.completeConfiguredInteraction(exitInteraction.id);
    }
    const holdExitCinematicForDialogue = Boolean(campaignTransitionDialogue && this.session.activeExitCinematic);
    if (!holdExitCinematicForDialogue) {
      this.session.activeExitCinematic = null;
    }
    this.session.mode = "transition";
    this.session.transitionRemaining = 2.4;
    this.session.activeCampaignTransitionDialogue = campaignTransitionDialogue
      ? { fromLevelId: this.level.id, toLevelId: campaignTransitionDialogue.toLevelId, lineIndex: 0 }
      : null;
    this.session.message = exit.transitionMessage;
    this.projectiles.length = 0;
    this.platform.reportGameplayStop();
    if (!this.session.activeCampaignTransitionDialogue) {
      this.queueDialogue(this.level.exit.transitionDialogueTrigger);
    }
    this.emitAudio("system_transition", { intensity: 1 });
    recordHumanProtocolPerfEvent(this, "exit_transition_started", {
      levelId: this.level.id,
      exitId: this.level.exit.id,
      source,
    });
  }

  advanceCampaignTransitionDialogue() {
    const state = this.session.activeCampaignTransitionDialogue;
    if (!state) return false;
    const dialogue = campaignTransitionDialogueFor(state.fromLevelId, state.toLevelId, this.settings.language);
    if (!dialogue || state.lineIndex + 1 >= dialogue.lines.length) {
      this.session.activeCampaignTransitionDialogue = null;
      this.session.activeExitCinematic = null;
      this.session.transitionRemaining = 0;
      this.completeLevel();
      return true;
    }
    state.lineIndex += 1;
    return false;
  }

  completeLevel() {
    const exit = localizedExit(this.level, this.settings.language);
    this.session.mode = "victory";
    this.session.message = exit.victoryMessage;
    this.settleLevelProgress();
    this.platform.reportGameplayStop();
    this.emitAudio("system_victory", { intensity: 1.2 });
  }

  activeObjective() {
    const objectiveId = this.session.mapProgress.activeObjectiveId;
    if (!objectiveId) return null;
    return this.level.objectiveChain?.find((objective) => objective.id === objectiveId) ?? null;
  }

  setCurrentRoom(roomId: string | null) {
    if (!roomId || this.session.mapProgress.currentRoomId === roomId) return;
    this.session.mapProgress.currentRoomId = roomId;
    addUnique(this.session.mapProgress.visitedRoomIds, roomId);
    this.dispatchObjectiveEvent({ type: "room_entered", id: roomId });
    const room = this.level.map?.rooms.find((candidate) => candidate.id === roomId);
    if (room?.entryDialogueTrigger) {
      this.queueDialogue(room.entryDialogueTrigger);
    }
  }

  revealRoomClue(roomId: string) {
    const puzzles = this.level.puzzles ?? [];
    for (const puzzle of puzzles) {
      if (puzzle.type !== "hit_sequence" || this.isPuzzleCompleted(puzzle.id) || !puzzle.clue.revealOnRoomEnter) continue;
      const clueRoomIds = new Set([
        ...(puzzle.clue.roomId ? [puzzle.clue.roomId] : []),
        ...(puzzle.clue.surfaces?.map((surface) => surface.roomId) ?? []),
      ]);
      if (!clueRoomIds.has(roomId)) continue;

      const seenId = `${puzzle.id}:${roomId}`;
      if (!addUnique(this.session.mapProgress.roomClueSeenIds, seenId)) continue;

      const label = puzzle.clue.roomEnterLabel ?? "环境线索";
      const detail = puzzle.clue.roomEnterDetail ?? this.hitSequenceClueDetail(puzzle);
      this.setSpawnWarning({ label, detail }, 2.2);
      this.emitAudio("ui_upgrade_select", { intensity: 0.5 });
      return true;
    }

    return false;
  }

  setInteractionPrompt(prompt: GameSessionState["interactionPrompt"]) {
    this.session.interactionPrompt = prompt ? localizedConfigCopy(this.level, this.settings.language, prompt) : null;
  }

  completeConfiguredInteraction(interactionId: string) {
    if (addUnique(this.session.mapProgress.completedInteractionIds, interactionId)) {
      this.dispatchObjectiveEvent({ type: "interaction_completed", id: interactionId });
    }
  }

  grantConfiguredKeyItem(keyItemId: string) {
    const item = this.level.map?.keyItems.find((candidate) => candidate.id === keyItemId);
    if (!item) return false;
    if (!addUnique(this.session.mapProgress.collectedKeyItemIds, item.id)) return false;
    if (item.dialogueTrigger) this.queueDialogue(item.dialogueTrigger);
    if (item.rewardPulse) {
      this.setRewardPulse(item.rewardPulse, item.rewardPulseDuration ?? 1.35);
    } else {
      this.setRewardPulse({ label: item.label, detail: "门禁条件已更新", rarity: "rare" }, 1.25);
    }
    this.emitConfiguredAudio(item.audio, vectorFromTuple(this.keyItemPosition(item)));
    this.dispatchObjectiveEvent({ type: "key_collected", id: item.id });
    return true;
  }

  collectConfiguredKeyItem(item: LevelKeyItemDefinition) {
    if (!this.isConfiguredKeyItemAvailable(item)) {
      this.setSpawnWarning({ label: item.label, detail: "还不能拾取。" }, 1.25);
      return false;
    }
    return this.grantConfiguredKeyItem(item.id);
  }

  isConfiguredKeyItemAvailable(item: LevelKeyItemDefinition) {
    return (
      !item.requiresObjectiveId ||
      this.isObjectiveCompleted(item.requiresObjectiveId) ||
      Boolean(this.session.mapProgress.keyItemDropPositions[item.id])
    );
  }

  keyItemPosition(item: LevelKeyItemDefinition): readonly [number, number, number] {
    return this.session.mapProgress.keyItemDropPositions[item.id] ?? item.position;
  }

  unlockConfiguredDoor(doorId: string | null | undefined) {
    if (!doorId) return false;
    const changed = addUnique(this.session.mapProgress.unlockedDoorIds, doorId);
    if (changed) {
      const door = this.level.map?.doors.find((candidate) => candidate.id === doorId);
      if (door?.lock.unlockedMessage) this.session.message = this.configText(door.lock.unlockedMessage);
    }
    return changed;
  }

  lockConfiguredDoor(doorId: string | null | undefined) {
    if (!doorId) return false;
    const closed = this.closeConfiguredDoor(doorId);
    const locked = removeValue(this.session.mapProgress.unlockedDoorIds, doorId);
    const door = this.level.map?.doors.find((candidate) => candidate.id === doorId);
    if ((closed || locked) && door) {
      this.session.message = this.configText(`${door.label}已锁定。`);
    }
    return closed || locked;
  }

  closeConfiguredDoor(doorId: string | null | undefined, options?: { respectLock?: boolean }) {
    if (!doorId) return false;
    const door = this.level.map?.doors.find((candidate) => candidate.id === doorId);
    if (!door) return false;
    if (options?.respectLock && !this.isDoorProgressionSatisfied(door)) return false;
    const closed = removeValue(this.session.mapProgress.openedDoorIds, doorId);
    if (closed && door) {
      this.markDoorTransition(door.id);
      this.session.message = this.configText(`${door.label}已关闭。`);
      recordHumanProtocolPerfEvent(this, "door_close", {
        doorId: door.id,
        fromRoomId: door.fromRoomId,
        toRoomId: door.toRoomId,
      });
    }
    return closed;
  }

  openConfiguredDoor(doorId: string, options?: { force?: boolean; respectLock?: boolean }) {
    const door = this.level.map?.doors.find((candidate) => candidate.id === doorId);
    if (!door) return false;
    const canOpen = options?.respectLock ? this.isDoorProgressionSatisfied(door) : this.canOpenDoor(door);
    if (!options?.force && !canOpen) {
      if (door.lock.lockedMessage) {
        this.setSpawnWarning({ label: door.label, detail: door.lock.lockedMessage }, 1.45);
      }
      if (door.closedDialogueTrigger) this.queueDialogue(door.closedDialogueTrigger);
      return false;
    }
    if (!options?.force && !options?.respectLock) this.unlockConfiguredDoor(door.id);
    if (!addUnique(this.session.mapProgress.openedDoorIds, door.id)) return true;
    this.markDoorTransition(door.id);
    this.session.message = this.configText(door.lock.unlockedMessage ?? `${door.label}已打开。`);
    recordHumanProtocolPerfEvent(this, "door_open", {
      doorId: door.id,
      fromRoomId: door.fromRoomId,
      toRoomId: door.toRoomId,
      openDoors: this.session.mapProgress.openedDoorIds.length,
    });
    if (door.openedDialogueTrigger) this.queueDialogue(door.openedDialogueTrigger);
    this.applyConfiguredCameraImpact(door.cameraImpact);
    this.emitAudio("system_exit_open", { intensity: 0.72, position: vectorFromTuple(door.position) });
    this.dispatchObjectiveEvent({ type: "door_opened", id: door.id });
    return true;
  }

  doorTransitionRevision(doorId: string) {
    return this.session.doorTransitionRevisions[doorId] ?? 0;
  }

  private markDoorTransition(doorId: string) {
    this.session.doorTransitionRevisions[doorId] = (this.session.doorTransitionRevisions[doorId] ?? 0) + 1;
  }

  canOpenDoor(door: LevelDoorDefinition) {
    if (this.isDoorOpen(door.id)) return true;
    const lock = door.lock;
    if (lock.manualOpen === false) return false;
    return this.isDoorProgressionSatisfied(door);
  }

  private isDoorProgressionSatisfied(door: LevelDoorDefinition) {
    const lock = door.lock;
    if (this.isDoorUnlocked(door.id)) return true;
    if (lock.type === "none") return true;
    if (lock.type === "key_item") return Boolean(lock.keyItemId && this.session.mapProgress.collectedKeyItemIds.includes(lock.keyItemId));
    if (lock.type === "objective_complete") return Boolean(lock.objectiveId && this.session.mapProgress.completedObjectiveIds.includes(lock.objectiveId));
    if (lock.type === "survive_wave") {
      const waveIds = doorSurviveWaveIds(lock);
      return waveIds.length > 0 && waveIds.every((id) => this.session.mapProgress.completedWaveIds.includes(id));
    }
    if (lock.type === "boss_dead") return Boolean(lock.actorId && this.session.mapProgress.defeatedActorIds.includes(lock.actorId));
    if (lock.type === "memory_choice" || lock.type === "choice_selected") {
      if (!lock.choiceId) return false;
      const selected = this.session.mapProgress.selectedChoiceIds[lock.choiceId];
      return Boolean(selected && (!lock.choiceOptionId || selected === lock.choiceOptionId));
    }
    if (lock.type === "environment_state") {
      return Boolean(lock.environmentStateId && this.session.mapProgress.activeEnvironmentStateIds.includes(lock.environmentStateId));
    }
    if (lock.type === "switch_state") {
      return Boolean(lock.switchId && lock.stateId && this.activeSwitchStateId(lock.switchId) === lock.stateId);
    }
    if (lock.type === "puzzle_complete") {
      const puzzleIds = doorPuzzleLockIds(lock);
      const puzzleReady = puzzleIds.length > 0 && puzzleIds.every((puzzleId) => this.isPuzzleCompleted(puzzleId));
      const keyReady = !lock.keyItemId || this.session.mapProgress.collectedKeyItemIds.includes(lock.keyItemId);
      return puzzleReady && keyReady;
    }
    if (lock.type === "inventory_count") {
      return this.session.mapProgress.collectedKeyItemIds.length >= (lock.requiredCount ?? 1);
    }
    return false;
  }

  isDoorOpen(doorId: string) {
    return this.session.mapProgress.openedDoorIds.includes(doorId);
  }

  isDoorUnlocked(doorId: string) {
    return this.session.mapProgress.unlockedDoorIds.includes(doorId);
  }

  isPuzzleCompleted(puzzleId: string) {
    return this.session.mapProgress.completedPuzzleIds.includes(puzzleId);
  }

  isArticleRead(articleId: string) {
    return this.session.mapProgress.readArticleIds.includes(articleId);
  }

  isQuizCompleted(quizId: string) {
    return this.session.mapProgress.completedQuizIds.includes(quizId);
  }

  articleForInteraction(interactionId: string) {
    return this.level.articles?.find((article) => article.interactionId === interactionId) ?? null;
  }

  quizForInteraction(interactionId: string) {
    return this.level.quizzes?.find((quiz) => quiz.interactionId === interactionId) ?? null;
  }

  switchForInteraction(interactionId: string) {
    return this.level.switches?.find((definition) => definition.interactionId === interactionId) ?? null;
  }

  bigScreenForInteraction(interactionId: string) {
    return this.level.bigScreens?.find((definition) => definition.interactionId === interactionId) ?? null;
  }

  activeSwitchStateId(switchId: string) {
    const definition = this.level.switches?.find((candidate) => candidate.id === switchId);
    if (!definition) return null;
    return this.session.mapProgress.activeSwitchStateIds[definition.id] ?? definition.initialStateId ?? definition.states[0]?.id ?? null;
  }

  activeBigScreenStateId(screenId: string) {
    const definition = this.level.bigScreens?.find((candidate) => candidate.id === screenId);
    if (!definition) return null;
    return this.session.mapProgress.activeBigScreenStateIds[definition.id] ?? definition.initialStateId ?? definition.states[0]?.id ?? null;
  }

  activeBigScreenState(screenId: string) {
    const definition = this.level.bigScreens?.find((candidate) => candidate.id === screenId);
    if (!definition) return null;
    const stateId = this.activeBigScreenStateId(screenId);
    return definition.states.find((state) => state.id === stateId) ?? definition.states[0] ?? null;
  }

  activeArticle() {
    const articleId = this.session.activeArticleId;
    if (!articleId) return null;
    return this.level.articles?.find((article) => article.id === articleId) ?? null;
  }

  activeQuiz() {
    const quizId = this.session.activeQuizId;
    if (!quizId) return null;
    return this.level.quizzes?.find((quiz) => quiz.id === quizId) ?? null;
  }

  sequencePlaybackPuzzleForInteraction(interactionId: string) {
    return this.level.puzzles?.find(
      (puzzle): puzzle is LevelHitSequencePuzzleDefinition =>
        puzzle.type === "hit_sequence" && puzzle.clue.interactionId === interactionId && Boolean(puzzle.clue.playback),
    ) ?? null;
  }

  activeSequencePlaybackPuzzle() {
    const puzzleId = this.session.activeSequencePlaybackPuzzleId;
    if (!puzzleId) return null;
    return this.level.puzzles?.find(
      (candidate): candidate is LevelHitSequencePuzzleDefinition =>
        candidate.type === "hit_sequence" && candidate.id === puzzleId,
    ) ?? null;
  }

  openSequencePlayback(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelHitSequencePuzzleDefinition =>
        candidate.type === "hit_sequence" && candidate.id === puzzleId && Boolean(candidate.clue.playback),
    );
    if (!puzzle) return false;
    this.ensureHitSequenceOrder(puzzle);
    this.session.activeSequencePlaybackPuzzleId = puzzle.id;
    this.session.mode = "sequencePlayback";
    this.platform.reportGameplayStop();
    return true;
  }

  closeSequencePlayback() {
    this.session.activeSequencePlaybackPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  markSequencePlaybackComplete(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelHitSequencePuzzleDefinition =>
        candidate.type === "hit_sequence" && candidate.id === puzzleId,
    );
    if (!puzzle || this.isPuzzleCompleted(puzzle.id)) return false;
    this.ensureHitSequenceOrder(puzzle);
    this.session.mapProgress.hitSequencePlaybackSeen[puzzle.id] = true;
    return true;
  }

  currentHitSequenceOrder(puzzle: LevelHitSequencePuzzleDefinition) {
    return this.ensureHitSequenceOrder(puzzle);
  }

  toolCalibrationPuzzleForInteraction(interactionId: string) {
    return this.level.puzzles?.find(
      (puzzle): puzzle is LevelToolCalibrationPuzzleDefinition =>
        puzzle.type === "tool_calibration" && puzzle.interactionId === interactionId,
    ) ?? null;
  }

  activeToolCalibrationPuzzle() {
    const puzzleId = this.session.activeToolCalibrationPuzzleId;
    if (!puzzleId) return null;
    return this.level.puzzles?.find(
      (candidate): candidate is LevelToolCalibrationPuzzleDefinition =>
        candidate.type === "tool_calibration" && candidate.id === puzzleId,
    ) ?? null;
  }

  openToolCalibration(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelToolCalibrationPuzzleDefinition =>
        candidate.type === "tool_calibration" && candidate.id === puzzleId,
    );
    if (!puzzle) return false;
    this.session.activeToolCalibrationPuzzleId = puzzle.id;
    this.session.mode = "toolCalibration";
    this.platform.reportGameplayStop();
    return true;
  }

  closeToolCalibration() {
    this.session.activeToolCalibrationPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  submitToolCalibration(perfect: boolean) {
    const puzzle = this.activeToolCalibrationPuzzle();
    if (!puzzle || this.session.mode !== "toolCalibration") return false;
    this.session.activeToolCalibrationPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
    this.completeConfiguredInteraction(puzzle.interactionId);
    this.completeConfiguredPuzzle(puzzle);
    if (perfect && puzzle.perfectBonus) {
      this.addPickup(puzzle.perfectBonus.pickupType, this.player.position, { ignoreDynamicLimit: true, expires: false });
      this.setRewardPulse(
        puzzle.perfectBonus.rewardPulse ?? {
          label: "完美校准",
          detail: puzzle.perfectBonus.pickupType === "repairKit" ? "治疗包弹出" : "电池弹出",
          rarity: "epic",
        },
        puzzle.perfectBonus.rewardPulseDuration ?? 1.45,
      );
    }
    return true;
  }

  circuitGridPuzzleForInteraction(interactionId: string) {
    return this.level.puzzles?.find(
      (puzzle): puzzle is LevelCircuitGridPuzzleDefinition =>
        puzzle.type === "circuit_grid" && puzzle.interactionId === interactionId,
    ) ?? null;
  }

  activeCircuitGridPuzzle() {
    const puzzleId = this.session.activeCircuitGridPuzzleId;
    if (!puzzleId) return null;
    return this.level.puzzles?.find(
      (candidate): candidate is LevelCircuitGridPuzzleDefinition =>
        candidate.type === "circuit_grid" && candidate.id === puzzleId,
    ) ?? null;
  }

  openCircuitGrid(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelCircuitGridPuzzleDefinition =>
        candidate.type === "circuit_grid" && candidate.id === puzzleId,
    );
    if (!puzzle) return false;
    this.session.activeCircuitGridPuzzleId = puzzle.id;
    this.session.mode = "circuitGrid";
    this.platform.reportGameplayStop();
    return true;
  }

  closeCircuitGrid() {
    this.session.activeCircuitGridPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  submitCircuitGrid() {
    const puzzle = this.activeCircuitGridPuzzle();
    if (!puzzle || this.session.mode !== "circuitGrid") return false;
    this.session.activeCircuitGridPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
    this.completeConfiguredInteraction(puzzle.interactionId);
    this.completeConfiguredPuzzle(puzzle);
    return true;
  }

  surveillancePuzzleForInteraction(interactionId: string) {
    return this.level.puzzles?.find(
      (puzzle): puzzle is LevelSurveillanceMatchPuzzleDefinition =>
        puzzle.type === "surveillance_match" && puzzle.interactionId === interactionId,
    ) ?? null;
  }

  activeSurveillancePuzzle() {
    const puzzleId = this.session.activeSurveillancePuzzleId;
    if (!puzzleId) return null;
    return this.level.puzzles?.find(
      (candidate): candidate is LevelSurveillanceMatchPuzzleDefinition =>
        candidate.type === "surveillance_match" && candidate.id === puzzleId,
    ) ?? null;
  }

  openSurveillance(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelSurveillanceMatchPuzzleDefinition =>
        candidate.type === "surveillance_match" && candidate.id === puzzleId,
    );
    if (!puzzle) return false;
    this.session.activeSurveillancePuzzleId = puzzle.id;
    this.session.mode = "surveillance";
    this.platform.reportGameplayStop();
    return true;
  }

  closeSurveillance() {
    this.session.activeSurveillancePuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  submitSurveillanceMatch() {
    const puzzle = this.activeSurveillancePuzzle();
    if (!puzzle || this.session.mode !== "surveillance") return false;
    this.session.activeSurveillancePuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
    this.completeConfiguredInteraction(puzzle.interactionId);
    this.completeConfiguredPuzzle(puzzle);
    return true;
  }

  valveMatrixPuzzleForInteraction(interactionId: string) {
    return this.level.puzzles?.find(
      (puzzle): puzzle is LevelValveMatrixPuzzleDefinition =>
        puzzle.type === "valve_matrix" && puzzle.interactionId === interactionId,
    ) ?? null;
  }

  activeValveMatrixPuzzle() {
    const puzzleId = this.session.activeValveMatrixPuzzleId;
    if (!puzzleId) return null;
    return this.level.puzzles?.find(
      (candidate): candidate is LevelValveMatrixPuzzleDefinition =>
        candidate.type === "valve_matrix" && candidate.id === puzzleId,
    ) ?? null;
  }

  openValveMatrix(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelValveMatrixPuzzleDefinition =>
        candidate.type === "valve_matrix" && candidate.id === puzzleId,
    );
    if (!puzzle) return false;
    this.session.activeValveMatrixPuzzleId = puzzle.id;
    this.session.mode = "valveMatrix";
    this.platform.reportGameplayStop();
    return true;
  }

  closeValveMatrix() {
    this.session.activeValveMatrixPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  submitValveMatrix() {
    const puzzle = this.activeValveMatrixPuzzle();
    if (!puzzle || this.session.mode !== "valveMatrix") return false;
    this.session.activeValveMatrixPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
    this.completeConfiguredInteraction(puzzle.interactionId);
    this.completeConfiguredPuzzle(puzzle);
    return true;
  }

  archiveMergePuzzleForInteraction(interactionId: string) {
    return this.level.puzzles?.find(
      (puzzle): puzzle is LevelArchiveMergePuzzleDefinition =>
        puzzle.type === "archive_merge" && puzzle.interactionId === interactionId,
    ) ?? null;
  }

  activeArchiveMergePuzzle() {
    const puzzleId = this.session.activeArchiveMergePuzzleId;
    if (!puzzleId) return null;
    return this.level.puzzles?.find(
      (candidate): candidate is LevelArchiveMergePuzzleDefinition =>
        candidate.type === "archive_merge" && candidate.id === puzzleId,
    ) ?? null;
  }

  openArchiveMerge(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelArchiveMergePuzzleDefinition =>
        candidate.type === "archive_merge" && candidate.id === puzzleId,
    );
    if (!puzzle) return false;
    this.session.activeArchiveMergePuzzleId = puzzle.id;
    this.session.mode = "archiveMerge";
    this.emitConfiguredAudio(puzzle.audio?.open);
    this.platform.reportGameplayStop();
    return true;
  }

  closeArchiveMerge() {
    this.session.activeArchiveMergePuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  submitArchiveMerge() {
    const puzzle = this.activeArchiveMergePuzzle();
    if (!puzzle || this.session.mode !== "archiveMerge") return false;
    this.session.activeArchiveMergePuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
    this.completeConfiguredInteraction(puzzle.interactionId);
    this.emitConfiguredAudio(puzzle.audio?.success);
    this.completeConfiguredPuzzle(puzzle);
    return true;
  }

  galleryReadingPuzzleForInteraction(interactionId: string) {
    return this.level.puzzles?.find(
      (puzzle): puzzle is LevelGalleryReadingPuzzleDefinition =>
        puzzle.type === "gallery_reading" && puzzle.interactionId === interactionId,
    ) ?? null;
  }

  activeGalleryReadingPuzzle() {
    const puzzleId = this.session.activeGalleryReadingPuzzleId;
    if (!puzzleId) return null;
    return this.level.puzzles?.find(
      (candidate): candidate is LevelGalleryReadingPuzzleDefinition =>
        candidate.type === "gallery_reading" && candidate.id === puzzleId,
    ) ?? null;
  }

  openGalleryReading(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelGalleryReadingPuzzleDefinition =>
        candidate.type === "gallery_reading" && candidate.id === puzzleId,
    );
    if (!puzzle) return false;
    this.session.activeGalleryReadingPuzzleId = puzzle.id;
    this.session.mode = "galleryReading";
    this.emitConfiguredAudio(puzzle.audio?.open);
    this.platform.reportGameplayStop();
    return true;
  }

  closeGalleryReading() {
    this.session.activeGalleryReadingPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  submitGalleryReading() {
    const puzzle = this.activeGalleryReadingPuzzle();
    if (!puzzle || this.session.mode !== "galleryReading") return false;
    this.session.activeGalleryReadingPuzzleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
    this.completeConfiguredInteraction(puzzle.interactionId);
    this.emitConfiguredAudio(puzzle.audio?.success);
    this.completeConfiguredPuzzle(puzzle);
    return true;
  }

  /** Records a failed attempt on an overlay puzzle (timeout, mistake budget) without closing it. */
  recordConfiguredPuzzleFailure(puzzleId: string) {
    const puzzle = this.level.puzzles?.find((candidate) => candidate.id === puzzleId);
    if (!puzzle || this.isPuzzleCompleted(puzzle.id)) return false;
    this.session.mapProgress.failedPuzzleCounts[puzzle.id] = (this.session.mapProgress.failedPuzzleCounts[puzzle.id] ?? 0) + 1;
    if (puzzle.fail?.message) this.session.message = this.configText(puzzle.fail.message);
    this.applyConfiguredCameraImpact(puzzle.fail?.cameraImpact ?? { shake: 0.18, fovKick: 0.7 });
    this.emitConfiguredAudio(puzzle.fail?.audio);
    this.dispatchObjectiveEvent({ type: "puzzle_failed", id: puzzle.id });
    return true;
  }

  canUseQuiz(quiz: LevelQuizDefinition) {
    if (this.isQuizCompleted(quiz.id)) return false;
    return !quiz.articleId || this.isArticleRead(quiz.articleId);
  }

  openArticle(articleId: string) {
    const article = this.level.articles?.find((candidate) => candidate.id === articleId);
    if (!article) return false;
    this.session.activeArticleId = article.id;
    this.session.mode = "article";
    this.platform.reportGameplayStop();
    return true;
  }

  closeArticle(markRead = true) {
    const article = this.activeArticle();
    this.session.activeArticleId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
    if (!article || !markRead) return Boolean(article);
    return this.readConfiguredArticle(article);
  }

  private readConfiguredArticle(article: LevelArticleDefinition) {
    if (!addUnique(this.session.mapProgress.readArticleIds, article.id)) return true;
    this.completeConfiguredInteraction(article.interactionId);
    if (article.readReward) {
      this.setRewardPulse(article.readReward, article.readRewardDuration ?? 1.45);
    } else {
      this.setRewardPulse({ label: article.title, detail: "档案已读取", rarity: "story" }, 1.25);
    }
    if (article.readDialogueTrigger) this.queueDialogue(article.readDialogueTrigger);
    this.session.message = this.configText(article.readReward?.detail ?? `${article.title}已读取。`);
    this.dispatchObjectiveEvent({ type: "article_read", id: article.id });
    return true;
  }

  openQuiz(quizId: string) {
    const quiz = this.level.quizzes?.find((candidate) => candidate.id === quizId);
    if (!quiz) return false;
    if (!this.canUseQuiz(quiz)) {
      const article = quiz.articleId ? this.level.articles?.find((candidate) => candidate.id === quiz.articleId) : null;
      this.setSpawnWarning({
        label: quiz.title,
        detail: article ? `${article.title}尚未读取` : "题目已完成",
      }, 1.35);
      return false;
    }
    this.session.activeQuizId = quiz.id;
    this.session.quizError = null;
    this.session.quizErrorRemaining = 0;
    this.session.mode = "quiz";
    this.platform.reportGameplayStop();
    return true;
  }

  closeQuiz() {
    this.session.activeQuizId = null;
    this.session.quizError = null;
    this.session.quizErrorRemaining = 0;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  chooseQuizOption(optionId: string) {
    const quiz = this.activeQuiz();
    if (!quiz || this.session.mode !== "quiz") return false;
    const option = quiz.options.find((candidate) => candidate.id === optionId);
    if (!option) return false;

    const correct = option.correct === true;
    const event: ObjectiveEvent = { type: correct ? "quiz_completed" : "quiz_failed", id: quiz.id, optionId };
    this.session.activeQuizId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();

    if (!correct) {
      const wrongCount = (this.session.mapProgress.failedQuizCounts[quiz.id] ?? 0) + 1;
      this.session.mapProgress.failedQuizCounts[quiz.id] = wrongCount;
      const message = quiz.wrongAnswer?.message ?? "回答被拒绝。";
      this.session.quizError = this.configText(message);
      this.session.quizErrorRemaining = 1.35;
      this.session.message = this.configText(message);
      this.setSpawnWarning({ label: quiz.title, detail: message }, 1.65);
      this.applyConfiguredCameraImpact(quiz.wrongAnswer?.cameraImpact ?? { shake: 0.25, fovKick: 1 });
      this.emitConfiguredAudio(quiz.wrongAnswer?.audio);
      this.dispatchObjectiveEvent(event);
      this.runConfiguredActions(quiz.wrongAnswer?.actions, event);
      return true;
    }

    addUnique(this.session.mapProgress.completedQuizIds, quiz.id);
    this.completeConfiguredInteraction(quiz.interactionId);
    if (quiz.correctAnswer.rewardPulse) {
      this.setRewardPulse(quiz.correctAnswer.rewardPulse, quiz.correctAnswer.rewardPulseDuration ?? 1.45);
    }
    if (quiz.correctAnswer.message) this.session.message = this.configText(quiz.correctAnswer.message);
    this.applyConfiguredCameraImpact(quiz.correctAnswer.cameraImpact ?? { shake: 0.22, fovKick: 1.1 });
    this.emitConfiguredAudio(quiz.correctAnswer.audio);
    this.dispatchObjectiveEvent(event);
    this.runConfiguredActions(quiz.correctAnswer.actions, event);
    return true;
  }

  activateSwitch(switchId: string) {
    const definition = this.level.switches?.find((candidate) => candidate.id === switchId);
    if (!definition || definition.states.length === 0) return false;
    const activationCount = this.session.mapProgress.switchActivationCounts[definition.id] ?? 0;
    if (definition.oneShot && activationCount > 0) {
      this.setSpawnWarning({
        label: definition.label ?? "开关",
        detail: "已经切换。",
      }, 1.15);
      return false;
    }

    const state = this.nextSwitchState(definition);
    if (!state) return false;
    return this.applySwitchState(definition, state);
  }

  beginSwitchHandInteraction(switchId: string) {
    const definition = this.level.switches?.find((candidate) => candidate.id === switchId);
    if (!definition || definition.states.length === 0) return false;
    const presentation = definition.presentation;
    if (presentation?.kind !== "wall_button" && presentation?.kind !== "wall_lever") return false;
    const activationCount = this.session.mapProgress.switchActivationCounts[definition.id] ?? 0;
    if (definition.oneShot && activationCount > 0) {
      this.setSpawnWarning({
        label: definition.label ?? "开关",
        detail: "已经切换。",
      }, 1.15);
      return false;
    }
    if (this.session.activeHandInteraction) return false;
    const duration = Math.max(0.35, Math.min(1.8, presentation.useDurationSec ?? 0.65));
    const commitAt = Math.max(0.05, Math.min(duration - 0.05, presentation.commitAtSec ?? duration * 0.52));
    const handPose = presentation.handPose ?? (presentation.kind === "wall_lever" ? "lever_push_down" : "elevator_button_press");
    this.session.activeHandInteraction = {
      interactionId: definition.interactionId,
      switchId: definition.id,
      handPose,
      ...(handPose === "lever_push_down" ? { leverDirection: this.nextWallLeverDirection(definition) } : {}),
      elapsed: 0,
      duration,
      commitAt,
      committed: false,
      hideWeapon: presentation.hideWeapon ?? true,
    };
    this.session.message = this.configText(definition.label ? `${definition.label}响应中。` : "门控响应中。");
    return true;
  }

  updateHandInteraction(delta: number) {
    const active = this.session.activeHandInteraction;
    if (!active) return;
    active.elapsed += delta;
    if (!active.committed && active.elapsed >= active.commitAt) {
      active.committed = true;
      this.activateSwitch(active.switchId);
    }
    if (active.elapsed >= active.duration) {
      this.session.activeHandInteraction = null;
      this.startNextDoorReveal();
    }
  }

  /** Commit a specific switch state (shared by the cycling activateSwitch and the
   *  route-switch overlay's direct state selection). */
  private applySwitchState(definition: LevelSwitchDefinition, state: LevelSwitchStateDefinition) {
    const activationCount = this.session.mapProgress.switchActivationCounts[definition.id] ?? 0;
    this.session.mapProgress.activeSwitchStateIds[definition.id] = state.id;
    this.session.mapProgress.switchActivationCounts[definition.id] = activationCount + 1;
    addUnique(this.session.mapProgress.activatedSwitchIds, definition.id);
    addUnique(this.session.mapProgress.activatedSwitchIds, switchStateKey(definition.id, state.id));

    if (state.message) this.session.message = this.configText(state.message);
    if (state.rewardPulse) this.setRewardPulse(state.rewardPulse, state.rewardPulseDuration ?? 1.35);
    if (state.dialogueTrigger) this.queueDialogue(state.dialogueTrigger);
    this.applyConfiguredCameraImpact(state.cameraImpact ?? { shake: 0.18, fovKick: 0.7 });
    this.emitConfiguredAudio(state.audio);

    const event: ObjectiveEvent = {
      type: "switch_activated",
      id: definition.id,
      optionId: state.id,
      value: this.session.mapProgress.switchActivationCounts[definition.id],
    };
    const doorStatesBefore = this.captureDoorStatesForActions(state.actions);
    this.dispatchObjectiveEvent(event);
    this.runConfiguredActions(state.actions, event);
    this.queueDoorRevealsForSwitchState(definition, state, doorStatesBefore);

    if (definition.oneShot) {
      this.completeConfiguredInteraction(definition.interactionId);
    }
    return true;
  }

  // --- Route switch (multi-room routing console) ---------------------------
  // A route switch is a key-gated switch whose interaction declares
  // consumesKeyItemId; instead of blind cycling it opens an Image2 overlay where
  // the player picks one of the 1-4 outputs (door / puzzle / robots / standby).

  private routeSwitchDefinition(switchId: string) {
    return this.level.switches?.find((candidate) => candidate.id === switchId) ?? null;
  }

  private routeSwitchInteraction(switchId: string) {
    const definition = this.routeSwitchDefinition(switchId);
    if (!definition) return null;
    return this.level.map?.interactions.find((interaction) => interaction.id === definition.interactionId) ?? null;
  }

  routeSwitchForInteraction(interactionId: string) {
    const definition = this.level.switches?.find((candidate) => candidate.interactionId === interactionId);
    if (!definition || definition.states.length === 0) return null;
    const interaction = this.level.map?.interactions.find((candidate) => candidate.id === interactionId);
    // Routing consoles use the dedicated route UI. Older configs identify them
    // by a global key gate; newer builder configs use per-output key gates.
    if (definition.presentation?.kind !== "route_console" && !interaction?.consumesKeyItemId) return null;
    return definition;
  }

  isRouteSwitch(switchId: string) {
    const definition = this.routeSwitchDefinition(switchId);
    return Boolean(definition) && Boolean(this.routeSwitchForInteraction(definition!.interactionId));
  }

  routeSwitchHasKey(switchId: string) {
    const interaction = this.routeSwitchInteraction(switchId);
    if (interaction?.consumesKeyItemId) return this.session.mapProgress.collectedKeyItemIds.includes(interaction.consumesKeyItemId);
    const definition = this.routeSwitchDefinition(switchId);
    if (!definition) return false;
    const gatedStates = definition.states.filter((state) => state.id !== definition.initialStateId && state.requiredKeyItemId);
    if (gatedStates.length === 0) return true;
    return gatedStates.some((state) => this.session.mapProgress.collectedKeyItemIds.includes(state.requiredKeyItemId!));
  }

  routeSwitchStateHasKey(switchId: string, stateId: string) {
    const definition = this.routeSwitchDefinition(switchId);
    if (!definition) return false;
    const state = definition.states.find((candidate) => candidate.id === stateId);
    if (!state) return false;
    const interaction = this.routeSwitchInteraction(switchId);
    if (interaction?.consumesKeyItemId && !this.session.mapProgress.collectedKeyItemIds.includes(interaction.consumesKeyItemId)) return false;
    if (!state.requiredKeyItemId) return true;
    return this.session.mapProgress.collectedKeyItemIds.includes(state.requiredKeyItemId);
  }

  openRouteSwitch(switchId: string) {
    const definition = this.routeSwitchDefinition(switchId);
    if (!definition) return false;
    this.session.activeRouteSwitchId = definition.id;
    this.session.mode = "routeSwitch";
    this.platform.reportGameplayStop();
    return true;
  }

  activeRouteSwitch() {
    const id = this.session.activeRouteSwitchId;
    if (!id) return null;
    return this.routeSwitchDefinition(id);
  }

  closeRouteSwitch() {
    this.session.activeRouteSwitchId = null;
    this.setMode("playing");
    this.platform.reportGameplayStart();
  }

  /**
   * Start a short 3D "target reveal" camera (door / puzzle terminal / robot
   * room). Resolves the world target from the action; a no-op when the target
   * can't be resolved. Does not change `session.mode` — the camera rigs and the
   * input freeze key off `session.activeFocusReveal`, so doors keep animating
   * and just-woken robots stay live during the reveal.
   */
  beginFocusReveal(
    target: FocusRevealActionTarget,
    source?: ObjectiveEvent,
    doorMode?: DoorRevealMode,
    options: { forceCameraCut?: boolean; replaceNonDoorReveal?: boolean } = {},
  ) {
    if (this.session.activeFocusReveal && target.kind === "door" && target.doorId) {
      if (options.replaceNonDoorReveal && this.session.activeFocusReveal.kind !== "door") {
        this.session.activeFocusReveal = null;
      } else {
        this.session.doorRevealQueue.push({
          doorId: target.doorId,
          mode: doorMode ?? "toggle",
          durationSec: target.durationSec ?? defaultFocusRevealDuration("door"),
          cameraMode: target.cameraMode,
        });
        this.session.activeFocusReveal.chainToNext = true;
        return;
      }
    }
    const resolved = this.resolveFocusRevealTarget(target, source, doorMode);
    if (!resolved) return;
    const duration = Math.max(1.2, Math.min(4, target.durationSec ?? defaultFocusRevealDuration(target.kind)));
    const reveal: FocusRevealState = {
      kind: target.kind,
      targetId: resolved.targetId,
      roomId: resolved.roomId,
      elapsed: 0,
      duration,
      targetPosition: [resolved.target.x, resolved.target.y, resolved.target.z],
      cameraPosition: [resolved.camera.x, resolved.camera.y, resolved.camera.z],
      ...(target.kind === "door" && doorMode ? { doorMode } : {}),
      ...(resolved.cameraCut || options.forceCameraCut ? { cameraCut: true } : {}),
      ...(target.kind === "door" && this.session.doorRevealQueue.length > 0 ? { chainToNext: true } : {}),
    };
    this.session.activeFocusReveal = reveal;
  }

  /** Advance the active reveal; clears it when finished. Driven by FocusRevealSystem. */
  updateFocusReveal(delta: number) {
    const reveal = this.session.activeFocusReveal;
    if (!reveal) {
      this.startNextDoorReveal();
      return;
    }
    reveal.elapsed += delta;
    this.refreshDynamicFocusRevealTarget(reveal);
    if (reveal.elapsed >= reveal.duration) {
      if (this.session.doorRevealQueue.length > 0) {
        this.session.activeFocusReveal = null;
        this.startNextDoorReveal({ chainFromReveal: true });
      } else {
        this.session.activeFocusReveal = null;
      }
    }
  }

  private refreshDynamicFocusRevealTarget(reveal: FocusRevealState) {
    const enemyTargetPrefix = "enemy:";
    if (reveal.kind !== "robot" || !reveal.targetId?.startsWith(enemyTargetPrefix)) return;
    const enemyId = Number(reveal.targetId.slice(enemyTargetPrefix.length));
    if (!Number.isFinite(enemyId)) return;
    const enemy = this.enemies.find((candidate) => candidate.id === enemyId && candidate.isAlive);
    if (!enemy) return;
    const target = new Vector3(enemy.position.x, enemy.position.y + this.focusRevealEnemyLookHeight(enemy), enemy.position.z);
    reveal.targetPosition = [target.x, target.y, target.z];
    if (reveal.cameraCut && reveal.roomId) {
      const room = this.level.map?.rooms.find((candidate) => candidate.id === reveal.roomId) ?? null;
      if (room) {
        const camera = this.frameEnemyFocusRevealCamera(room, enemy, target, this.player.position);
        reveal.cameraPosition = [camera.x, camera.y, camera.z];
      }
    }
  }

  queueDoorRevealsForSwitchState(definition: LevelSwitchDefinition, state: LevelSwitchStateDefinition, doorStatesBefore?: ReadonlyMap<string, boolean>) {
    const presentation = definition.presentation;
    if (!presentation || presentation.revealMode === "none") return;
    const cameraMode = presentation.revealMode === "player_eye" || presentation.revealMode === "door_front" ? presentation.revealMode : "auto";
    const durationSec = Math.max(1.2, Math.min(4, presentation.doorRevealSec ?? 2));
    const preferredDoorIds = presentation.revealDoorIds?.length ? presentation.revealDoorIds : null;
    const explicitRevealDoorIds = explicitDoorRevealIdsForActions(state.actions);
    const actionDoorIds: Array<{ doorId: string; mode: "open" | "close" | "toggle" }> = state.actions.flatMap((action) => {
      if (action.type !== "open_door" && action.type !== "close_door") return [];
      if (explicitRevealDoorIds.has(action.doorId)) return [];
      const before = doorStatesBefore?.get(action.doorId);
      const after = this.isDoorOpen(action.doorId);
      if (before !== undefined) {
        const changed = action.type === "open_door" ? !before && after : before && !after;
        const confirmsClosed = action.type === "close_door" && action.respectLock !== true && !after;
        if (!changed && !confirmsClosed) return [];
      }
      return [{
        doorId: action.doorId,
        mode: action.type === "open_door" ? "open" as const : "close" as const,
      }];
    });
    const ordered: Array<{ doorId: string; mode: "open" | "close" | "toggle" }> = [];
    if (preferredDoorIds) {
      for (const doorId of preferredDoorIds) {
        const entry = actionDoorIds.find((candidate) => candidate.doorId === doorId);
        if (entry) ordered.push(entry);
      }
    } else {
      ordered.push(...actionDoorIds.filter((entry) => entry.mode === "open"));
      ordered.push(...actionDoorIds.filter((entry) => entry.mode === "close"));
    }
    const seen = new Set<string>();
    const items: DoorRevealQueueItem[] = [];
    for (const entry of ordered) {
      if (seen.has(entry.doorId) || !this.level.map?.doors.some((door) => door.id === entry.doorId)) continue;
      seen.add(entry.doorId);
      items.push({ doorId: entry.doorId, mode: entry.mode, durationSec, cameraMode });
      if (items.length >= 2) break;
    }
    if (items.length === 0) return;
    this.session.doorRevealQueue.push(...items);
    this.startNextDoorReveal();
  }

  private startNextDoorReveal(options: { chainFromReveal?: boolean } = {}) {
    if (this.session.activeHandInteraction || this.session.activeFocusReveal || this.session.doorRevealQueue.length === 0) return;
    const next = this.session.doorRevealQueue.shift();
    if (!next) return;
    this.beginFocusReveal({
      kind: "door",
      doorId: next.doorId,
      cameraMode: next.cameraMode ?? "door_front",
      durationSec: next.durationSec,
    }, undefined, next.mode, { forceCameraCut: options.chainFromReveal });
  }

  private resolveFocusRevealTarget(target: FocusRevealActionTarget, source?: ObjectiveEvent, doorMode?: DoorRevealMode) {
    const point = new Vector3();
    let roomId: string | null = target.roomId ?? null;
    let targetId: string | null = null;
    let focusRevealEnemy: EnemyState | null = null;

    const eye = new Vector3(
      this.player.position.x,
      this.player.position.y + playerConfig.cockpitHeight,
      this.player.position.z,
    );

    if (target.kind === "door") {
      const door = this.level.map?.doors.find((candidate) => candidate.id === target.doorId);
      if (!door) return null;
      // Look at the door leaf around player eye level (not its top edge): keeps
      // the reveal a head-on "watch the door open" shot rather than tilting the
      // camera up toward the ceiling.
      point.set(door.position[0], door.position[1] + Math.min(1.6, Math.max(1.2, door.size[1] * 0.35)), door.position[2]);
      targetId = door.id;
      const doorRoomId = this.focusRevealDoorCameraRoomId(door, roomId, doorMode);
      roomId = doorRoomId ?? roomId ?? door.toRoomId ?? door.fromRoomId ?? null;
      if (this.shouldCutDoorFocusReveal(target, door, eye, roomId)) {
        const framed = this.frameDoorFocusRevealCamera(door, roomId);
        return {
          target: point,
          camera: framed.camera,
          roomId: framed.roomId ?? roomId,
          targetId,
          cameraCut: true,
        };
      }
    } else if (target.kind === "robot" || target.kind === "room") {
      const room = this.level.map?.rooms.find((candidate) => candidate.id === target.roomId);
      if (!room) return null;
      const focusEnemy = target.kind === "robot" ? this.focusRevealEnemyForRoom(room) : null;
      if (focusEnemy) {
        focusRevealEnemy = focusEnemy;
        point.set(focusEnemy.position.x, focusEnemy.position.y + this.focusRevealEnemyLookHeight(focusEnemy), focusEnemy.position.z);
        targetId = `enemy:${focusEnemy.id}`;
      } else {
        point.set(room.bounds.center[0], room.bounds.center[1] + 1.0, room.bounds.center[2]);
        targetId = room.id;
      }
      roomId = room.id;
    } else {
      const interaction = this.resolveFocusRevealInteraction(target, source);
      if (!interaction) return null;
      point.set(interaction.position[0], interaction.position[1] + 1.0, interaction.position[2]);
      targetId = interaction.id;
      roomId = roomId ?? interaction.roomId ?? null;
    }

    if (target.cameraMode === "door_front" && roomId && target.kind !== "door") {
      const room = this.level.map?.rooms.find((candidate) => candidate.id === roomId) ?? null;
      if (room) {
        const camera = focusRevealEnemy
          ? this.frameEnemyFocusRevealCamera(room, focusRevealEnemy, point, eye)
          : this.framePointFocusRevealCamera(room, point, eye);
        return { target: point, camera, roomId, targetId, cameraCut: true };
      }
    }

    return { target: point, camera: eye, roomId, targetId };
  }

  private focusRevealEnemyForRoom(room: LevelRoomDefinition) {
    let best: { enemy: EnemyState; score: number } | null = null;
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      if (!this.enemyMatchesFocusRevealRoom(enemy, room)) continue;
      const score = this.focusRevealEnemyPriority(enemy);
      if (!best || score > best.score) best = { enemy, score };
    }
    return best?.enemy ?? null;
  }

  private enemyMatchesFocusRevealRoom(enemy: EnemyState, room: LevelRoomDefinition) {
    if (enemy.spawnRoomId === room.id) return true;
    if (enemy.spawnRoomId && enemy.spawnRoomId !== room.id) return false;
    const halfX = room.bounds.size[0] * 0.5;
    const halfZ = room.bounds.size[2] * 0.5;
    return (
      enemy.position.x >= room.bounds.center[0] - halfX &&
      enemy.position.x <= room.bounds.center[0] + halfX &&
      enemy.position.z >= room.bounds.center[2] - halfZ &&
      enemy.position.z <= room.bounds.center[2] + halfZ
    );
  }

  private focusRevealEnemyPriority(enemy: EnemyState) {
    const tierScore =
      enemy.tier === "boss"
        ? 5000
        : enemy.tier === "leader"
          ? 4200
          : enemy.tier === "elite" || enemy.archetypeId === "custodian_elite" || enemy.archetypeId === this.level.combatLimits.eliteArchetypeId
            ? 3600
            : 1000;
    return tierScore + enemy.maxHealth * 0.08 - enemy.spawnAge * 0.18;
  }

  private focusRevealEnemyLookHeight(enemy: EnemyState) {
    const scale = Math.max(0.8, enemy.visualScaleMultiplier);
    if (this.isReclamationMotherFocusEnemy(enemy)) return 1.5 * scale;
    if (enemy.tier === "boss") return 1.38 * scale;
    if (enemy.tier === "leader" || enemy.tier === "elite" || enemy.archetypeId === "custodian_elite") return 1.35 * scale;
    return 1.0 * scale;
  }

  private framePointFocusRevealCamera(
    room: LevelRoomDefinition,
    target: Vector3,
    eye: Vector3,
    desiredDistance?: number,
    preferredFromTarget?: Vector3,
  ) {
    const halfX = room.bounds.size[0] * 0.5;
    const halfZ = room.bounds.size[2] * 0.5;
    const margin = 0.85;
    const distance =
      desiredDistance ?? Math.max(2.8, Math.min(5.4, Math.min(room.bounds.size[0], room.bounds.size[2]) * 0.38));
    const fromTarget = preferredFromTarget && preferredFromTarget.lengthSq() > 0.01 ? preferredFromTarget.clone() : eye.clone().sub(target);
    fromTarget.y = 0;
    if (fromTarget.lengthSq() < 0.01) {
      fromTarget.set(target.x - room.bounds.center[0], 0, target.z - room.bounds.center[2]);
    }
    if (fromTarget.lengthSq() < 0.01) fromTarget.set(0, 0, 1);
    fromTarget.normalize();

    const camera = target.clone().addScaledVector(fromTarget, distance);
    camera.x = clamp(camera.x, room.bounds.center[0] - halfX + margin, room.bounds.center[0] + halfX - margin);
    camera.z = clamp(camera.z, room.bounds.center[2] - halfZ + margin, room.bounds.center[2] + halfZ - margin);
    camera.y = Math.max(playerConfig.cockpitHeight, target.y + 0.12);
    return camera;
  }

  private frameEnemyFocusRevealCamera(room: LevelRoomDefinition, enemy: EnemyState, target: Vector3, eye: Vector3) {
    return this.framePointFocusRevealCamera(
      room,
      target,
      eye,
      this.focusRevealEnemyCameraDistance(room, enemy),
      this.focusRevealEnemyCameraDirection(enemy),
    );
  }

  private focusRevealEnemyCameraDistance(room: LevelRoomDefinition, enemy: EnemyState) {
    const roomSpan = Math.min(room.bounds.size[0], room.bounds.size[2]);
    if (this.isReclamationMotherFocusEnemy(enemy)) return Math.max(2.55, Math.min(2.9, roomSpan * 0.44));
    if (enemy.tier === "boss") return Math.max(3.35, Math.min(4.4, roomSpan * 0.68));
    if (enemy.tier === "leader" || enemy.tier === "elite" || enemy.archetypeId === "custodian_elite") {
      return Math.max(2.2, Math.min(2.55, roomSpan * 0.38));
    }
    return Math.max(2.35, Math.min(2.8, roomSpan * 0.4));
  }

  private focusRevealEnemyCameraDirection(enemy: EnemyState) {
    if (enemy.tier !== "boss") return undefined;
    return new Vector3(Math.sin(enemy.rotationY), 0, Math.cos(enemy.rotationY));
  }

  private isReclamationMotherFocusEnemy(enemy: EnemyState) {
    return enemy.modelKey === RECLAMATION_MOTHER_BOSS_MODEL_KEY;
  }

  private focusRevealDoorCameraRoomId(door: LevelDoorDefinition, requestedRoomId: string | null, doorMode?: DoorRevealMode) {
    const currentRoomId = this.session.mapProgress.currentRoomId;
    const currentIsDoorRoom = currentRoomId === door.fromRoomId || currentRoomId === door.toRoomId;
    const requestedIsDoorRoom = requestedRoomId === door.fromRoomId || requestedRoomId === door.toRoomId;
    const baseRoomId =
      currentIsDoorRoom
        ? currentRoomId
        : requestedIsDoorRoom
          ? requestedRoomId
          : door.fromRoomId ?? door.toRoomId ?? requestedRoomId;
    if (doorMode === "close" && baseRoomId) return this.oppositeDoorRoomId(door, baseRoomId) ?? baseRoomId;
    if (!currentIsDoorRoom && !requestedIsDoorRoom) {
      return this.preferStableRemoteDoorRevealRoom(door, baseRoomId) ?? baseRoomId;
    }
    return baseRoomId;
  }

  private preferStableRemoteDoorRevealRoom(door: LevelDoorDefinition, baseRoomId: string | null) {
    const baseRoom = baseRoomId ? this.level.map?.rooms.find((candidate) => candidate.id === baseRoomId) ?? null : null;
    if (!baseRoom?.bounds.shape?.points?.length) return baseRoomId;
    const oppositeRoomId = this.oppositeDoorRoomId(door, baseRoomId);
    const oppositeRoom = oppositeRoomId ? this.level.map?.rooms.find((candidate) => candidate.id === oppositeRoomId) ?? null : null;
    return oppositeRoom && !oppositeRoom.bounds.shape?.points?.length ? oppositeRoom.id : baseRoomId;
  }

  private oppositeDoorRoomId(door: LevelDoorDefinition, roomId: string | null) {
    if (roomId === door.fromRoomId) return door.toRoomId;
    if (roomId === door.toRoomId) return door.fromRoomId;
    return null;
  }

  private shouldCutDoorFocusReveal(target: FocusRevealActionTarget, door: LevelDoorDefinition, eye: Vector3, revealRoomId: string | null) {
    if (target.cameraMode === "player_eye") return false;
    if (target.cameraMode === "door_front") return true;
    const currentRoomId = this.session.mapProgress.currentRoomId;
    if (!currentRoomId) return true;
    if (currentRoomId !== door.fromRoomId && currentRoomId !== door.toRoomId) return true;
    if (revealRoomId && revealRoomId !== currentRoomId) return true;
    const dx = eye.x - door.position[0];
    const dz = eye.z - door.position[2];
    return Math.hypot(dx, dz) > 7.2;
  }

  private frameDoorFocusRevealCamera(door: LevelDoorDefinition, roomId: string | null) {
    const room = roomId ? this.level.map?.rooms.find((candidate) => candidate.id === roomId) ?? null : null;
    const forward = new Vector3(Math.sin(door.yaw), 0, Math.cos(door.yaw)).normalize();
    const distance = Math.max(2.35, door.size[2] * 0.5 + 2.25);
    const center = new Vector3(door.position[0], playerConfig.cockpitHeight, door.position[2]);
    const left = center.clone().addScaledVector(forward, -distance);
    const right = center.clone().addScaledVector(forward, distance);
    const camera = this.bestDoorRevealCameraCandidate(room, door, center, forward, left, right);
    return { camera, roomId: room?.id ?? roomId };
  }

  private bestDoorRevealCameraCandidate(
    room: LevelRoomDefinition | null,
    door: LevelDoorDefinition,
    target: Vector3,
    forward: Vector3,
    first: Vector3,
    second: Vector3,
  ) {
    if (!room) return first;
    const [cx, , cz] = room.bounds.center;
    const firstDistance = Math.hypot(first.x - cx, first.z - cz);
    const secondDistance = Math.hypot(second.x - cx, second.z - cz);
    const ideal = (firstDistance <= secondDistance ? first : second).clone();
    const side = ideal.clone().sub(target).setY(0);
    if (side.lengthSq() < 0.0001) side.copy(firstDistance <= secondDistance ? forward.clone().multiplyScalar(-1) : forward);
    side.normalize();
    const lateral = new Vector3(forward.z, 0, -forward.x).normalize();
    const baseDistance = Math.max(2.35, Math.hypot(ideal.x - target.x, ideal.z - target.z));
    const lateralStep = Math.min(1.65, Math.max(0.9, door.size[0] * 0.42));
    const wideStep = Math.min(2.35, Math.max(lateralStep + 0.45, door.size[0] * 0.62));
    const candidates: Vector3[] = [];
    const lateralOffsets = [0, -lateralStep, lateralStep, -wideStep, wideStep];
    const distanceOffsets = [0, 0.55, -0.35];
    for (const distanceOffset of distanceOffsets) {
      for (const lateralOffset of lateralOffsets) {
        const candidate = target
          .clone()
          .addScaledVector(side, Math.max(1.55, baseDistance + distanceOffset))
          .addScaledVector(lateral, lateralOffset);
        candidates.push(this.clampDoorRevealCameraToRoom(candidate, room));
      }
    }
    let best = candidates[0] ?? this.clampDoorRevealCameraToRoom(ideal, room);
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const score = this.scoreDoorRevealCameraCandidate(candidate, target, ideal, room);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  private clampDoorRevealCameraToRoom(camera: Vector3, room: LevelRoomDefinition) {
    const clamped = camera.clone();
    const margin = 0.85;
    const [cx, , cz] = room.bounds.center;
    const [width, , depth] = room.bounds.size;
    clamped.x = Math.min(cx + width / 2 - margin, Math.max(cx - width / 2 + margin, clamped.x));
    clamped.z = Math.min(cz + depth / 2 - margin, Math.max(cz - depth / 2 + margin, clamped.z));
    clamped.y = playerConfig.cockpitHeight;
    return clamped;
  }

  private scoreDoorRevealCameraCandidate(candidate: Vector3, target: Vector3, ideal: Vector3, room: LevelRoomDefinition) {
    const idealDrift = Math.hypot(candidate.x - ideal.x, candidate.z - ideal.z) * 0.18;
    return idealDrift + this.doorRevealVisualBlockPenalty(candidate, target, room.id);
  }

  private doorRevealVisualBlockPenalty(camera: Vector3, target: Vector3, roomId: string) {
    let penalty = 0;
    for (const blocker of this.doorRevealVisualBlockers(roomId)) {
      penalty += this.segmentBlockPenalty(camera, target, blocker.position, blocker.halfSize);
      penalty += this.cameraClearancePenalty(camera, blocker.position, blocker.halfSize) * 0.35;
    }
    return penalty;
  }

  private doorRevealVisualBlockers(roomId: string) {
    const blockers: Array<{ position: Vector3; halfSize: Vector3 }> = [];
    for (const prop of this.level.map?.props ?? []) {
      const blocker = this.visualBlockerForProp(prop, roomId);
      if (blocker) blockers.push(blocker);
    }
    for (const pickup of this.level.map?.pickups ?? []) {
      const blocker = this.visualBlockerForPickup(pickup, roomId);
      if (blocker) blockers.push(blocker);
    }
    for (const interaction of this.level.map?.interactions ?? []) {
      const blocker = this.visualBlockerForInteraction(interaction, roomId);
      if (blocker) blockers.push(blocker);
    }
    return blockers;
  }

  private visualBlockerForProp(prop: LevelMapPropDefinition, roomId: string) {
    if (prop.roomId !== roomId || prop.initiallyVisible === false) return null;
    const tags = new Set(prop.tags ?? []);
    if (tags.has("visual_backdrop_no_player_block") || tags.has("reveal_camera_ignore")) return null;
    const proxy = resolvePropCollisionProxy(prop);
    if (proxy) {
      return {
        position: new Vector3(proxy.position[0], proxy.position[1], proxy.position[2]),
        halfSize: new Vector3(proxy.halfSize[0], proxy.halfSize[1], proxy.halfSize[2]),
      };
    }
    const scale = typeof prop.scale === "number" ? prop.scale : 1;
    return {
      position: new Vector3(prop.position[0], prop.position[1], prop.position[2]),
      halfSize: new Vector3(0.55 * scale, 0.9 * scale, 0.55 * scale),
    };
  }

  private visualBlockerForPickup(pickup: LevelMapPickupDefinition, roomId: string) {
    if (pickup.roomId !== roomId) return null;
    return {
      position: new Vector3(pickup.position[0], pickup.position[1] + 0.45, pickup.position[2]),
      halfSize: new Vector3(0.36, 0.55, 0.36),
    };
  }

  private visualBlockerForInteraction(interaction: LevelInteractionDefinition, roomId: string) {
    if (interaction.roomId !== roomId || interaction.visualKey === "none") return null;
    const radius = Math.min(0.62, Math.max(0.32, interaction.radius * 0.22));
    return {
      position: new Vector3(interaction.position[0], Math.max(0.75, interaction.position[1] + 0.55), interaction.position[2]),
      halfSize: new Vector3(radius, 0.72, radius),
    };
  }

  private segmentBlockPenalty(camera: Vector3, target: Vector3, position: Vector3, halfSize: Vector3) {
    const sx = target.x - camera.x;
    const sz = target.z - camera.z;
    const lenSq = sx * sx + sz * sz;
    if (lenSq < 0.0001) return 0;
    const t = ((position.x - camera.x) * sx + (position.z - camera.z) * sz) / lenSq;
    if (t <= 0.08 || t >= 0.94) return 0;
    const lineY = camera.y + (target.y - camera.y) * t;
    if (lineY < position.y - halfSize.y - 0.25 || lineY > position.y + halfSize.y + 0.25) return 0;
    const closestX = camera.x + sx * t;
    const closestZ = camera.z + sz * t;
    const distance = Math.hypot(position.x - closestX, position.z - closestZ);
    const radius = Math.max(halfSize.x, halfSize.z) + 0.42;
    if (distance >= radius) return 0;
    return ((radius - distance) / radius) * (8 + halfSize.y * 2);
  }

  private cameraClearancePenalty(camera: Vector3, position: Vector3, halfSize: Vector3) {
    const distance = Math.hypot(camera.x - position.x, camera.z - position.z);
    const clearance = distance - Math.max(halfSize.x, halfSize.z);
    if (clearance >= 0.95) return 0;
    return (0.95 - Math.max(0, clearance)) * 2.2;
  }

  private resolveFocusRevealInteraction(target: FocusRevealActionTarget, source?: ObjectiveEvent): LevelInteractionDefinition | null {
    const interactions = this.level.map?.interactions ?? [];
    if (target.interactionId) {
      return interactions.find((candidate) => candidate.id === target.interactionId) ?? null;
    }
    // A puzzle reveal fired from a route state: find the terminal it just gated.
    if (source?.type === "switch_activated") {
      return (
        interactions.find(
          (candidate) =>
            candidate.requiresSwitchState?.switchId === source.id && candidate.requiresSwitchState?.stateId === source.optionId,
        ) ?? null
      );
    }
    return null;
  }

  /** Apply the chosen output state. Requires the route key; returns false (with a
   *  short warning) when the player is unauthorized. Not cyclic. */
  chooseRouteSwitchState(switchId: string, stateId: string) {
    const definition = this.routeSwitchDefinition(switchId);
    if (!definition) return false;
    const state = definition.states.find((candidate) => candidate.id === stateId);
    if (!state) return false;
    if (!this.routeSwitchStateHasKey(switchId, stateId)) {
      this.setSpawnWarning({ label: definition.label ? this.configText(definition.label) : "路由台", detail: "缺少授权钥匙。" }, 1.35);
      return false;
    }
    if (this.session.mode === "routeSwitch" && this.session.activeRouteSwitchId === definition.id) {
      this.session.activeRouteSwitchId = null;
      this.setMode("playing");
      this.platform.reportGameplayStart();
    }
    return this.applySwitchState(definition, state);
  }

  /** Structured view for the RouteSwitchOverlay: localized labels + per-output
   *  kind (door / puzzle / robot / standby) inferred from each state's actions. */
  activeRouteSwitchView(): RouteSwitchView | null {
    const definition = this.activeRouteSwitch();
    if (!definition) return null;
    const idleId = definition.initialStateId ?? definition.states[0]?.id ?? null;
    const currentStateId = this.activeSwitchStateId(definition.id);
    const options: RouteSwitchOption[] = definition.states.map((state, index) => ({
      stateId: state.id,
      index,
      isIdle: state.id === idleId,
      kind: state.id === idleId ? "standby" : routeSwitchStateKind(state),
      label: state.label ? this.configText(state.label) : state.id,
      detail: state.detail ? this.configText(state.detail) : state.message ? this.configText(state.message) : "",
      requiredKeyItemId: state.requiredKeyItemId,
      hasKey: state.id === idleId ? true : this.routeSwitchStateHasKey(definition.id, state.id),
    }));
    const outputOptions = options.filter((option) => !option.isIdle);
    return {
      switchId: definition.id,
      label: definition.label ? this.configText(definition.label) : "管制路由台",
      hasKey: outputOptions.length === 0 ? this.routeSwitchHasKey(definition.id) : outputOptions.some((option) => option.hasKey),
      currentStateId,
      options,
    };
  }

  private nextSwitchState(definition: LevelSwitchDefinition) {
    if (definition.states.length === 1) return definition.states[0];
    const explicitCurrentId = this.session.mapProgress.activeSwitchStateIds[definition.id];
    if (!explicitCurrentId && (definition.presentation?.kind === "wall_button" || definition.presentation?.kind === "wall_lever")) {
      const visibleFirstState = this.firstVisibleDoorSwitchState(definition);
      if (visibleFirstState) return visibleFirstState;
    }
    const currentId = this.activeSwitchStateId(definition.id);
    const currentIndex = definition.states.findIndex((state) => state.id === currentId);
    if (definition.cycling?.wrap === false && currentIndex >= definition.states.length - 1) {
      return definition.states[currentIndex] ?? definition.states[definition.states.length - 1] ?? null;
    }
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % definition.states.length : 0;
    return definition.states[nextIndex] ?? definition.states[0] ?? null;
  }

  private nextWallLeverDirection(definition: LevelSwitchDefinition): "down" | "up" {
    const current = this.wallLeverPositionForState(definition, this.activeSwitchStateId(definition.id));
    const nextState = this.nextSwitchState(definition);
    const next = this.wallLeverPositionForState(definition, nextState?.id ?? null);
    if (next !== current) return next;
    return current === "down" ? "up" : "down";
  }

  private wallLeverPositionForState(definition: LevelSwitchDefinition, stateId: string | null): "down" | "up" {
    // Lever art is the switch's own two-position memory, not a summary of how
    // many doors this state opens/closes. Two-door toggles can open one door
    // while closing another, so action/message-based inference makes the handle
    // bounce back to the wrong side.
    const stateIndex = definition.states.findIndex((candidate) => candidate.id === stateId);
    return stateIndex > 0 && stateIndex % 2 === 1 ? "down" : "up";
  }

  private firstVisibleDoorSwitchState(definition: LevelSwitchDefinition) {
    const lockedDoorTargetStates = new Set(
      this.level.map?.doors
        .filter((door) => door.lock.type === "switch_state" && door.lock.switchId === definition.id && !this.isDoorOpen(door.id))
        .map((door) => door.lock.stateId)
        .filter((stateId): stateId is string => Boolean(stateId)) ?? [],
    );
    const lockedDoorTarget = definition.states.find((state) => lockedDoorTargetStates.has(state.id));
    if (lockedDoorTarget) return lockedDoorTarget;

    const namedOpenState = definition.states.find(
      (state) =>
        (state.id.toLowerCase().endsWith("_open") || state.id.toLowerCase() === "open" || this.configText(state.label ?? "").includes("打开")) &&
        state.actions.some((action) => action.type === "open_door" && !this.isDoorOpen(action.doorId)),
    );
    if (namedOpenState) return namedOpenState;

    const changes = definition.states.map((state) => {
      const openChanges = state.actions.filter((action) => action.type === "open_door" && !this.isDoorOpen(action.doorId)).length;
      const closeChanges = state.actions.filter((action) => action.type === "close_door" && this.isDoorOpen(action.doorId)).length;
      return { state, openChanges, closeChanges };
    });
    return (
      changes.find((entry) => entry.openChanges > 0)?.state ??
      changes.find((entry) => entry.closeChanges > 0)?.state ??
      null
    );
  }

  private captureDoorStatesForActions(actions: readonly LevelRuntimeEventAction[]) {
    const states = new Map<string, boolean>();
    for (const action of actions) {
      if (action.type !== "open_door" && action.type !== "close_door" && action.type !== "lock_door") continue;
      if (states.has(action.doorId)) continue;
      states.set(action.doorId, this.isDoorOpen(action.doorId));
    }
    return states;
  }

  activateBigScreen(screenId: string) {
    const definition = this.level.bigScreens?.find((candidate) => candidate.id === screenId);
    if (!definition || definition.states.length === 0) return false;
    const activationCount = this.session.mapProgress.bigScreenActivationCounts[definition.id] ?? 0;
    if (definition.oneShot && activationCount > 0) {
      this.setSpawnWarning({
        label: definition.label ?? "屏幕",
        detail: "信号已经锁定。",
      }, 1.15);
      return false;
    }

    const state =
      (definition.activationStateId
        ? definition.states.find((candidate) => candidate.id === definition.activationStateId)
        : this.nextBigScreenState(definition)) ?? definition.states[0] ?? null;
    if (!state) return false;
    return this.setBigScreenState(definition.id, state.id, { countActivation: true, completeOneShotInteraction: true });
  }

  setBigScreenState(screenId: string, stateId: string, options?: { countActivation?: boolean; completeOneShotInteraction?: boolean }) {
    const definition = this.level.bigScreens?.find((candidate) => candidate.id === screenId);
    const state = definition?.states.find((candidate) => candidate.id === stateId) ?? null;
    if (!definition || !state) return false;
    const activationCount = this.session.mapProgress.bigScreenActivationCounts[definition.id] ?? 0;

    this.session.mapProgress.activeBigScreenStateIds[definition.id] = state.id;
    if (options?.countActivation) {
      this.session.mapProgress.bigScreenActivationCounts[definition.id] = activationCount + 1;
    }
    addUnique(this.session.mapProgress.activatedBigScreenIds, definition.id);
    addUnique(this.session.mapProgress.activatedBigScreenIds, bigScreenStateKey(definition.id, state.id));

    if (state.message) this.session.message = this.configText(state.message);
    if (state.rewardPulse) this.setRewardPulse(state.rewardPulse, state.rewardPulseDuration ?? 1.35);
    if (state.dialogueTrigger) this.queueDialogue(state.dialogueTrigger);
    this.applyConfiguredCameraImpact(state.cameraImpact ?? { shake: 0.14, fovKick: 0.55 });
    this.emitConfiguredAudio(state.audio);

    const event: ObjectiveEvent = {
      type: "big_screen_state",
      id: definition.id,
      optionId: state.id,
      value: this.session.mapProgress.bigScreenActivationCounts[definition.id] ?? activationCount,
    };
    this.dispatchObjectiveEvent(event);
    this.runConfiguredActions(state.actions, event);

    if (definition.oneShot && options?.completeOneShotInteraction) {
      this.completeConfiguredInteraction(definition.interactionId);
    }
    return true;
  }

  private nextBigScreenState(definition: LevelBigScreenDefinition) {
    if (definition.states.length === 1) return definition.states[0];
    const currentId = this.activeBigScreenStateId(definition.id);
    const currentIndex = definition.states.findIndex((state) => state.id === currentId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % definition.states.length : 0;
    return definition.states[nextIndex] ?? definition.states[0] ?? null;
  }

  hitConfiguredPuzzleTarget(puzzleId: string, targetId: string, weaponId: WeaponId | null = null) {
    const puzzle = this.level.puzzles?.find((candidate) => candidate.id === puzzleId);
    if (!puzzle || puzzle.type !== "hit_sequence") return false;
    const target = puzzle?.targets.find((candidate) => candidate.id === targetId);
    if (!target) return false;
    return this.registerPuzzleTargetHit(puzzle, target, weaponId, this.player.aimDirection);
  }

  codeLockPuzzleForInteraction(interactionId: string) {
    return this.level.puzzles?.find(
      (puzzle): puzzle is LevelCodeLockPuzzleDefinition =>
        puzzle.type === "code_lock" && puzzle.interactionId === interactionId,
    ) ?? null;
  }

  activeCodeLockPuzzle() {
    const puzzleId = this.session.activeCodeLockPuzzleId;
    if (!puzzleId) return null;
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelCodeLockPuzzleDefinition =>
        candidate.type === "code_lock" && candidate.id === puzzleId,
    );
    return puzzle ?? null;
  }

  canUseCodeLockPuzzle(puzzle: LevelCodeLockPuzzleDefinition) {
    if (this.isPuzzleCompleted(puzzle.id)) return true;
    return !puzzle.requiredKeyItemId || this.session.mapProgress.collectedKeyItemIds.includes(puzzle.requiredKeyItemId);
  }

  openCodeLock(puzzleId: string) {
    const puzzle = this.level.puzzles?.find(
      (candidate): candidate is LevelCodeLockPuzzleDefinition =>
        candidate.type === "code_lock" && candidate.id === puzzleId,
    );
    if (!puzzle) return false;
    if (!this.canUseCodeLockPuzzle(puzzle)) {
      const key = this.level.map?.keyItems.find((item) => item.id === puzzle.requiredKeyItemId);
      this.setSpawnWarning({
        label: puzzle.label,
        detail: key ? `缺少${key.label}` : "缺少门禁钥匙",
      }, 1.35);
      return false;
    }
    this.session.activeCodeLockPuzzleId = puzzle.id;
    this.session.activeCodeLockInput = "";
    this.session.codeLockError = null;
    this.session.codeLockErrorRemaining = 0;
    this.paused = false;
    return true;
  }

  closeCodeLock() {
    this.session.activeCodeLockPuzzleId = null;
    this.session.activeCodeLockInput = "";
    this.session.codeLockError = null;
    this.session.codeLockErrorRemaining = 0;
  }

  inputCodeLockDigit(digit: string) {
    const puzzle = this.activeCodeLockPuzzle();
    if (!puzzle || !/^\d$/.test(digit)) return false;
    if (this.session.activeCodeLockInput.length >= puzzle.input.length) return false;
    this.session.activeCodeLockInput += digit;
    this.session.codeLockError = null;
    this.session.codeLockErrorRemaining = 0;
    this.emitAudio("ui_upgrade_select", { intensity: 0.26 });
    return true;
  }

  backspaceCodeLock() {
    const puzzle = this.activeCodeLockPuzzle();
    if (!puzzle || puzzle.input.allowBackspace === false || this.session.activeCodeLockInput.length === 0) return false;
    this.session.activeCodeLockInput = this.session.activeCodeLockInput.slice(0, -1);
    return true;
  }

  clearCodeLockInput() {
    if (!this.activeCodeLockPuzzle()) return false;
    this.session.activeCodeLockInput = "";
    this.session.codeLockError = null;
    this.session.codeLockErrorRemaining = 0;
    return true;
  }

  submitCodeLock() {
    const puzzle = this.activeCodeLockPuzzle();
    if (!puzzle) return false;
    if (!this.canUseCodeLockPuzzle(puzzle)) {
      this.session.codeLockError = this.configText("缺少门禁钥匙");
      this.session.codeLockErrorRemaining = 1.35;
      return false;
    }
    const expected = this.expectedCodeForPuzzle(puzzle);
    const current = this.session.activeCodeLockInput;
    if (current.length < puzzle.input.length) {
      this.session.codeLockError = this.configText("密码未完整输入");
      this.session.codeLockErrorRemaining = 1.15;
      return false;
    }
    if (current !== expected) {
      this.session.mapProgress.failedPuzzleCounts[puzzle.id] = (this.session.mapProgress.failedPuzzleCounts[puzzle.id] ?? 0) + 1;
      this.session.codeLockError = this.configText(puzzle.fail?.message ?? "密码不对。");
      this.session.codeLockErrorRemaining = 1.35;
      if (puzzle.input.clearOnMistake !== false) {
        this.session.activeCodeLockInput = "";
      }
      this.applyConfiguredCameraImpact(puzzle.fail?.cameraImpact ?? { shake: 0.18, fovKick: 0.7 });
      this.emitConfiguredAudio(puzzle.fail?.audio);
      return false;
    }

    this.completeConfiguredInteraction(puzzle.interactionId);
    this.completeConfiguredPuzzle(puzzle);
    this.closeCodeLock();
    return true;
  }

  expectedCodeForPuzzle(puzzle: LevelCodeLockPuzzleDefinition) {
    if (puzzle.code.source === "fixed") return (puzzle.code.value ?? "").slice(0, puzzle.input.length);
    if (puzzle.code.source === "formula") {
      return expectedFormulaCode(puzzle.code.formula, puzzle.input.length);
    }
    const order = puzzle.code.directionOrder ?? [];
    return order
      .map((direction) => puzzle.clues.find((clue) => clue.direction === direction)?.value ?? "")
      .join("")
      .slice(0, puzzle.input.length);
  }

  hitPuzzleTargetAt(position: Vector3, radius: number, weaponId: WeaponId | null = null, direction?: Vector3) {
    let hit = false;
    for (const puzzle of this.level.puzzles ?? []) {
      if (puzzle.type !== "hit_sequence" || this.isPuzzleCompleted(puzzle.id) || !this.puzzleAcceptsWeapon(puzzle, weaponId)) continue;
      for (const target of puzzle.targets) {
        this.puzzleHitDelta.set(target.position[0] - position.x, target.position[1] - position.y, target.position[2] - position.z);
        const hitRadius = radius + target.radius;
        if (this.puzzleHitDelta.lengthSq() > hitRadius * hitRadius) continue;
        hit = this.registerPuzzleTargetHit(puzzle, target, weaponId, direction) || hit;
        break;
      }
    }
    return hit;
  }

  hitPuzzleTargetsInArc(origin: Vector3, forward: Vector3, range: number, coneCos: number, weaponId: WeaponId | null = null) {
    let closestDistance = Infinity;
    let closestPuzzle: LevelPuzzleDefinition | null = null;
    let closestTarget: LevelPuzzleTargetDefinition | null = null;
    for (const puzzle of this.level.puzzles ?? []) {
      if (puzzle.type !== "hit_sequence" || this.isPuzzleCompleted(puzzle.id) || !this.puzzleAcceptsWeapon(puzzle, weaponId)) continue;
      for (const target of puzzle.targets) {
        this.puzzleHitDelta.set(target.position[0] - origin.x, 0, target.position[2] - origin.z);
        const distance = Math.max(0.001, this.puzzleHitDelta.length());
        if (distance > range + target.radius) continue;
        const direction = this.puzzleHitDelta.multiplyScalar(1 / distance);
        if (direction.dot(forward) < coneCos && distance > 1.45) continue;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPuzzle = puzzle;
          closestTarget = target;
          this.puzzleHitDirection.copy(direction);
        }
      }
    }
    if (!closestPuzzle || !closestTarget) return 0;
    return this.registerPuzzleTargetHit(closestPuzzle, closestTarget, weaponId, this.puzzleHitDirection) ? 1 : 0;
  }

  hasPuzzleTargetInArc(origin: Vector3, forward: Vector3, range: number, coneCos: number, weaponId: WeaponId | null = null) {
    for (const puzzle of this.level.puzzles ?? []) {
      if (puzzle.type !== "hit_sequence" || this.isPuzzleCompleted(puzzle.id) || !this.puzzleAcceptsWeapon(puzzle, weaponId)) continue;
      for (const target of puzzle.targets) {
        this.puzzleHitDelta.set(target.position[0] - origin.x, 0, target.position[2] - origin.z);
        const distance = Math.max(0.001, this.puzzleHitDelta.length());
        if (distance > range + target.radius) continue;
        const direction = this.puzzleHitDelta.multiplyScalar(1 / distance);
        if (direction.dot(forward) >= coneCos || distance <= 1.45) return true;
      }
    }
    return false;
  }

  updatePuzzleFeedback(delta: number) {
    if (this.session.codeLockErrorRemaining > 0) {
      this.session.codeLockErrorRemaining = Math.max(0, this.session.codeLockErrorRemaining - delta);
      if (this.session.codeLockErrorRemaining <= 0) {
        this.session.codeLockError = null;
      }
    }
    if (this.session.quizErrorRemaining > 0) {
      this.session.quizErrorRemaining = Math.max(0, this.session.quizErrorRemaining - delta);
      if (this.session.quizErrorRemaining <= 0) {
        this.session.quizError = null;
      }
    }
    const pulses = this.session.mapProgress.puzzleTargetPulses;
    for (const [key, remaining] of Object.entries(pulses)) {
      const next = remaining - delta;
      if (next <= 0) {
        delete pulses[key];
      } else {
        pulses[key] = next;
      }
    }
  }

  private puzzleAcceptsWeapon(puzzle: LevelHitSequencePuzzleDefinition, weaponId: WeaponId | null) {
    if (puzzle.input.method === "interact") return weaponId === null;
    if (!weaponId) return puzzle.input.method !== "weapon_hit";
    return !puzzle.input.allowedWeapons?.length || puzzle.input.allowedWeapons.includes(weaponId);
  }

  private hitSequenceClueDetail(puzzle: LevelHitSequencePuzzleDefinition) {
    if (puzzle.clue.label) return puzzle.clue.label;
    const targetLabels = new Map(puzzle.targets.map((target) => [target.id, target.label]));
    return puzzle.clue.sequence.map((targetId) => targetLabels.get(targetId) ?? targetId).join(" -> ");
  }

  private ensureHitSequenceOrder(puzzle: LevelHitSequencePuzzleDefinition) {
    const existing = this.session.mapProgress.activeHitSequenceOrders[puzzle.id];
    if (existing?.length === puzzle.clue.sequence.length) return existing;
    const order = [...puzzle.clue.sequence];
    this.session.mapProgress.activeHitSequenceOrders[puzzle.id] = order;
    return order;
  }

  private reshuffleHitSequenceOrder(puzzle: LevelHitSequencePuzzleDefinition, failedCount: number) {
    const baseOrder = [...puzzle.clue.sequence];
    if (baseOrder.length <= 1) return baseOrder;
    let seed = 2166136261;
    for (const char of `${this.level.id}:${puzzle.id}:${failedCount}:${Math.floor(this.session.levelElapsed * 10)}`) {
      seed ^= char.charCodeAt(0);
      seed = Math.imul(seed, 16777619) >>> 0;
    }
    for (let index = baseOrder.length - 1; index > 0; index -= 1) {
      seed = Math.imul(seed ^ (index + 0x9e3779b9), 16777619) >>> 0;
      const swapIndex = seed % (index + 1);
      const value = baseOrder[index];
      baseOrder[index] = baseOrder[swapIndex];
      baseOrder[swapIndex] = value;
    }
    const original = this.session.mapProgress.activeHitSequenceOrders[puzzle.id] ?? puzzle.clue.sequence;
    if (baseOrder.every((targetId, index) => targetId === original[index])) {
      baseOrder.push(baseOrder.shift() as string);
    }
    this.session.mapProgress.activeHitSequenceOrders[puzzle.id] = baseOrder;
    return baseOrder;
  }

  private registerPuzzleTargetHit(
    puzzle: LevelHitSequencePuzzleDefinition,
    target: LevelPuzzleTargetDefinition,
    weaponId: WeaponId | null,
    direction?: Vector3,
  ) {
    if (this.isPuzzleCompleted(puzzle.id) || !this.puzzleAcceptsWeapon(puzzle, weaponId)) return false;

    const playback = puzzle.clue.playback;
    const requiresReplay = playback?.requireReplayBeforeInput === true;
    if (requiresReplay && this.session.mapProgress.hitSequencePlaybackSeen[puzzle.id] !== true) {
      this.session.mapProgress.puzzleTargetPulses[puzzleTargetPulseKey(puzzle.id, target.id)] = 0.28;
      this.setSpawnWarning({
        label: puzzle.label,
        detail: playback?.replayRequiredMessage ?? "回灯墙再看。",
      }, 1.35);
      return true;
    }

    const sequence = this.ensureHitSequenceOrder(puzzle);
    const activeSequence = this.session.mapProgress.activePuzzleSequences[puzzle.id] ?? [];
    const expectedTargetId = sequence[activeSequence.length];
    const targetPosition = vectorFromTuple(target.position);
    this.session.mapProgress.puzzleTargetPulses[puzzleTargetPulseKey(puzzle.id, target.id)] = 0.48;

    if (target.id !== expectedTargetId) {
      if (puzzle.input.resetOnMistake !== false) {
        this.session.mapProgress.activePuzzleSequences[puzzle.id] = [];
      }
      const failedCount = (this.session.mapProgress.failedPuzzleCounts[puzzle.id] ?? 0) + 1;
      this.session.mapProgress.failedPuzzleCounts[puzzle.id] = failedCount;
      if (requiresReplay) {
        this.session.mapProgress.hitSequencePlaybackSeen[puzzle.id] = false;
      }
      const reshuffleAfter = playback?.reshuffleAfterFailures ?? 0;
      const didReshuffle = reshuffleAfter > 0 && failedCount % reshuffleAfter === 0;
      if (didReshuffle) {
        this.reshuffleHitSequenceOrder(puzzle, failedCount);
      }
      const puzzleFailedEvent: ObjectiveEvent = { type: "puzzle_failed", id: puzzle.id };
      this.setSpawnWarning({
        label: puzzle.label,
        detail: didReshuffle
          ? playback?.reshuffleMessage ?? "灯墙已换序。"
          : puzzle.fail?.message ?? "顺序错了，图案重置。",
      }, puzzle.fail?.resetDelay ? Math.max(1.05, puzzle.fail.resetDelay + 0.65) : 1.3);
      this.applyConfiguredCameraImpact(puzzle.fail?.cameraImpact ?? { shake: 0.16, fovKick: 0.5 });
      this.emitConfiguredAudio(puzzle.fail?.audio, targetPosition);
      this.addEffect("hitSpark", targetPosition, direction ?? this.player.aimDirection, 0.2, 1.05);
      this.dispatchObjectiveEvent(puzzleFailedEvent);
      this.runConfiguredActions(puzzle.fail?.actions, puzzleFailedEvent);
      return true;
    }

    const nextSequence = [...activeSequence, target.id];
    this.session.mapProgress.activePuzzleSequences[puzzle.id] = nextSequence;
    this.addEffect("hitSpark", targetPosition, direction ?? this.player.aimDirection, 0.18, 1.2);
    this.emitAudio("enemy_hit", { intensity: 0.58 + nextSequence.length * 0.08, position: targetPosition });

    if (puzzle.input.showProgressPulse !== false && nextSequence.length < sequence.length) {
      this.setRewardPulse({
        label: target.label,
        detail: `顺序 ${nextSequence.length}/${sequence.length}`,
        rarity: "common",
      }, 0.75);
    }

    if (nextSequence.length >= sequence.length) {
      this.completeConfiguredPuzzle(puzzle);
    }
    return true;
  }

  private completeConfiguredPuzzle(puzzle: LevelPuzzleDefinition) {
    if (!addUnique(this.session.mapProgress.completedPuzzleIds, puzzle.id)) return;
    this.session.mapProgress.activePuzzleSequences[puzzle.id] = [];
    if (puzzle.type === "hit_sequence") {
      delete this.session.mapProgress.activeHitSequenceOrders[puzzle.id];
      delete this.session.mapProgress.hitSequencePlaybackSeen[puzzle.id];
      for (const target of puzzle.targets) {
        this.session.mapProgress.puzzleTargetPulses[puzzleTargetPulseKey(puzzle.id, target.id)] = 0.95;
      }
    }

    if (puzzle.success.rewardPulse) {
      this.setRewardPulse(puzzle.success.rewardPulse, puzzle.success.rewardPulseDuration ?? 1.45);
    } else {
      this.setRewardPulse({
        label: puzzle.label,
        detail: "门锁顺序确认",
        rarity: "rare",
      }, 1.35);
    }
    this.session.message = this.configText(puzzle.success.rewardPulse?.detail ?? `${puzzle.label}已解锁。`);
    if (puzzle.success.dialogueTrigger) this.queueDialogue(puzzle.success.dialogueTrigger);
    this.applyConfiguredCameraImpact(puzzle.success.cameraImpact ?? { shake: 0.28, fovKick: 1.2 });
    this.addConfiguredEffects(puzzle.success.effects);
    this.emitConfiguredAudio(puzzle.success.audio);
    const puzzleCompletedEvent: ObjectiveEvent = { type: "puzzle_completed", id: puzzle.id };
    this.dispatchObjectiveEvent(puzzleCompletedEvent);

    if (puzzle.success.completesObjectiveId && !this.isObjectiveCompleted(puzzle.success.completesObjectiveId)) {
      const objective = this.level.objectiveChain?.find((candidate) => candidate.id === puzzle.success.completesObjectiveId);
      if (objective) this.completeObjective(objective);
    }
    this.unlockConfiguredDoor(puzzle.success.unlocksDoorId);
    if (puzzle.success.opensDoorId) this.openConfiguredDoor(puzzle.success.opensDoorId);
    if (puzzle.success.unlockExit) this.unlockExit();
    this.runConfiguredActions(puzzle.success.actions, puzzleCompletedEvent);
  }

  markWaveTriggered(waveId: string) {
    addUnique(this.session.mapProgress.triggeredWaveIds, waveId);
  }

  markWaveCompleted(waveId: string) {
    if (addUnique(this.session.mapProgress.completedWaveIds, waveId)) {
      this.dispatchObjectiveEvent({ type: "wave_completed", id: waveId });
      this.openDoorsUnlockedByWave(waveId);
    }
  }

  private openDoorsUnlockedByWave(waveId: string) {
    const doors = this.level.map?.doors ?? [];
    const openedDoors: LevelDoorDefinition[] = [];
    for (const door of doors) {
      if (door.lock.type !== "survive_wave") continue;
      const waveIds = doorSurviveWaveIds(door.lock);
      if (!waveIds.includes(waveId)) continue;
      if (!waveIds.every((id) => this.session.mapProgress.completedWaveIds.includes(id))) continue;
      if (this.isDoorOpen(door.id)) continue;
      if (this.openConfiguredDoor(door.id)) openedDoors.push(door);
    }
    if (!this.session.activeFocusReveal && openedDoors.length > 0) {
      this.beginFocusReveal({ kind: "door", doorId: openedDoors[0].id }, { type: "wave_completed", id: waveId }, "open");
    }
  }

  consumeObjectiveEvents() {
    return this.objectiveEvents.splice(0, this.objectiveEvents.length);
  }

  queueWaveStart(waveId: string, delay = 0, source?: ObjectiveEvent, options?: { repeat?: boolean }) {
    if (!this.level.waves.some((wave) => wave.id === waveId)) return false;
    if (this.session.activeWaveId === waveId) return false;
    if (!options?.repeat && this.session.mapProgress.triggeredWaveIds.includes(waveId)) return false;
    if (!options?.repeat && this.session.mapProgress.completedWaveIds.includes(waveId)) return false;
    if (this.session.pendingWaveStarts.some((pending) => pending.waveId === waveId)) return false;

    this.session.pendingWaveStarts.push({
      waveId,
      remaining: Math.max(0, delay),
      sourceType: source?.type ?? "manual",
      sourceId: source?.id,
      ...(options?.repeat ? { repeat: true } : {}),
    });
    if (options?.repeat) {
      removeValue(this.session.mapProgress.triggeredWaveIds, waveId);
      removeValue(this.session.mapProgress.completedWaveIds, waveId);
    }
    return true;
  }

  startWaveImmediately(waveId: string, options?: { repeat?: boolean }) {
    const wave = waveById(this.level, waveId);
    if (!wave) return false;
    if (this.session.activeWaveId === waveId) return false;
    if (!options?.repeat && this.session.mapProgress.triggeredWaveIds.includes(waveId)) return false;
    if (!options?.repeat && this.session.mapProgress.completedWaveIds.includes(waveId)) return false;
    if (this.session.activeWaveId) {
      const activeWave = waveById(this.level, this.session.activeWaveId);
      if (!wave.interruptsActiveWave && !activeWave?.nonBlocking) return false;
    }

    this.session.pendingWaveStarts = this.session.pendingWaveStarts.filter((pending) => pending.waveId !== waveId);
    if (options?.repeat) {
      removeValue(this.session.mapProgress.triggeredWaveIds, waveId);
      removeValue(this.session.mapProgress.completedWaveIds, waveId);
    }
    startWaveNow(this, wave, { preserveSpawnPositions: true });
    for (const enemy of this.enemies) {
      if (enemy.waveId === waveId && enemy.isAlive) enemy.spawnAge = Math.max(enemy.spawnAge, 0.5);
    }
    return true;
  }

  dispatchObjectiveEvent(event: ObjectiveEvent) {
    this.objectiveEvents.push({ ...event });

    const chain = this.level.objectiveChain;
    if (!chain?.length) {
      this.runConfiguredEvents(event);
      return;
    }

    if (!this.session.mapProgress.activeObjectiveId) {
      const starter = chain.find((objective) => !this.isObjectiveCompleted(objective.id) && triggerMatches(objective.startsWhen, event));
      if (starter) {
        this.startObjective(starter);
      }
    }

    const active = this.activeObjective();
    if (active && triggerMatches(active.completesWhen, event) && objectiveRequirementsMet(active, this.session.mapProgress)) {
      this.completeObjective(active);
    }

    this.runConfiguredEvents(event);
  }

  private runConfiguredEvents(event: ObjectiveEvent) {
    for (const definition of this.level.events ?? []) {
      const alreadyTriggered = this.session.mapProgress.triggeredEventIds.includes(definition.id);
      if ((definition.once ?? true) && alreadyTriggered) continue;
      if (!triggerMatches(definition.trigger, event)) continue;

      if (definition.once !== false) {
        addUnique(this.session.mapProgress.triggeredEventIds, definition.id);
      }
      this.runConfiguredActions(definition.actions, event);
    }
  }

  private runConfiguredActions(actions: readonly LevelRuntimeEventAction[] | undefined, source: ObjectiveEvent) {
    const doorModesById = new Map<string, DoorRevealMode>();
    for (const action of actions ?? []) {
      this.runConfiguredAction(action, source, doorModesById);
    }
  }

  private runConfiguredAction(action: LevelRuntimeEventAction, source: ObjectiveEvent, doorModesById?: Map<string, DoorRevealMode>) {
    switch (action.type) {
      case "queue_dialogue":
        this.queueDialogue(action.trigger);
        break;
      case "set_message":
        this.session.message = this.configText(action.message);
        break;
      case "spawn_warning":
        this.setSpawnWarning(action.warning, action.duration ?? 1.85);
        break;
      case "reward_pulse":
        this.setRewardPulse(action.pulse, action.duration ?? 1.45);
        break;
      case "camera_impact":
        this.applyConfiguredCameraImpact(action.cameraImpact);
        break;
      case "audio":
        this.emitConfiguredAudio(action.audio);
        break;
      case "add_effect":
        this.addConfiguredEffects([action.effect]);
        break;
      case "add_memory":
        this.addMemoryFragments(action.amount, action.rewardPulse, action.rewardPulseDuration ?? 1.35);
        break;
      case "open_upgrade":
        if (action.message) this.session.message = this.configText(action.message);
        this.openUpgrade(action.choices);
        break;
      case "open_choice":
        this.openChoice(action.choiceId, action.message);
        break;
      case "set_environment_state":
        this.setEnvironmentState(action.stateId, action.duration);
        break;
      case "clear_environment_state":
        this.clearEnvironmentState(action.stateId);
        break;
      case "set_big_screen_state":
        this.setBigScreenState(action.screenId, action.stateId);
        break;
      case "adjust_campaign_route":
        this.adjustCampaignRoute(
          this.resolveCampaignRouteDelta({ routeId: action.routeId, amount: action.amount, label: action.label }),
          source,
        );
        if (action.rewardPulse) {
          this.setRewardPulse(action.rewardPulse, action.rewardPulseDuration ?? 1.35);
        }
        break;
      case "start_wave":
        if (action.immediate) {
          if (!this.startWaveImmediately(action.waveId, { repeat: action.repeat })) {
            this.queueWaveStart(action.waveId, action.delay ?? 0, source, { repeat: action.repeat });
          }
        } else {
          this.queueWaveStart(action.waveId, action.delay ?? 0, source, { repeat: action.repeat });
        }
        break;
      case "unlock_door":
        this.unlockConfiguredDoor(action.doorId);
        break;
      case "open_door":
        this.openConfiguredDoor(action.doorId, { force: action.respectLock !== true, respectLock: action.respectLock === true });
        doorModesById?.set(action.doorId, "open");
        break;
      case "close_door":
        this.closeConfiguredDoor(action.doorId, { respectLock: action.respectLock === true });
        doorModesById?.set(action.doorId, "close");
        break;
      case "lock_door":
        if (!action.respectLock || this.level.map?.doors.some((door) => door.id === action.doorId && this.isDoorProgressionSatisfied(door))) {
          this.lockConfiguredDoor(action.doorId);
        }
        break;
      case "unlock_exit":
        this.unlockExit();
        break;
      case "complete_objective": {
        const objective = this.level.objectiveChain?.find((candidate) => candidate.id === action.objectiveId);
        if (objective) this.completeObjective(objective);
        break;
      }
      case "grant_key_item":
        this.grantConfiguredKeyItem(action.keyItemId);
        break;
      case "add_core_cells":
        this.session.coreCells = Math.min(
          this.level.pickups.coreCell.maxHeld,
          Math.max(0, this.session.coreCells + Math.round(action.amount)),
        );
        break;
      case "tempo_surge":
        this.session.tempoSurgeRemaining = Math.max(this.session.tempoSurgeRemaining, action.duration);
        break;
      case "focus_reveal":
        const revealDoorId = action.reveal.kind === "door" ? action.reveal.doorId : undefined;
        this.beginFocusReveal(
          action.reveal,
          source,
          revealDoorId ? doorModesById?.get(revealDoorId) : undefined,
          { replaceNonDoorReveal: Boolean(revealDoorId && doorModesById?.has(revealDoorId)) },
        );
        break;
    }
  }

  startObjective(objective: LevelObjectiveDefinition) {
    if (this.isObjectiveCompleted(objective.id)) return;
    this.session.mapProgress.activeObjectiveId = objective.id;
    if (canAutoCompleteObjectiveOnStart(objective) && objectiveRequirementsMet(objective, this.session.mapProgress)) {
      this.completeObjective(objective);
    }
  }

  completeObjective(objective: LevelObjectiveDefinition) {
    if (!addUnique(this.session.mapProgress.completedObjectiveIds, objective.id)) return;
    this.session.mapProgress.activeObjectiveId = null;
    if (objective.nextObjectiveId) {
      const next = this.level.objectiveChain?.find((candidate) => candidate.id === objective.nextObjectiveId);
      if (next && !this.isObjectiveCompleted(next.id)) {
        this.startObjective(next);
      }
    }
    this.dispatchObjectiveEvent({ type: "objective_completed", id: objective.id });
  }

  isObjectiveCompleted(objectiveId: string) {
    return this.session.mapProgress.completedObjectiveIds.includes(objectiveId);
  }

  setEnvironmentState(stateId: string, duration?: number) {
    const state = this.level.environmentStates?.find((candidate) => candidate.id === stateId);
    if (!state) return false;
    const resolvedDuration = positiveDuration(duration ?? state.duration);
    if (resolvedDuration !== null) {
      this.session.mapProgress.activeEnvironmentStateTimers[state.id] = resolvedDuration;
    } else {
      delete this.session.mapProgress.activeEnvironmentStateTimers[state.id];
    }
    if (addUnique(this.session.mapProgress.activeEnvironmentStateIds, state.id)) {
      recordHumanProtocolPerfEvent(this, "environment_state_on", {
        stateId: state.id,
        roomId: state.roomId,
        activeStates: this.session.mapProgress.activeEnvironmentStateIds.length,
      });
      this.dispatchObjectiveEvent({ type: "environment_state_set", id: state.id });
      return true;
    }
    return resolvedDuration !== null;
  }

  clearEnvironmentState(stateId: string) {
    const index = this.session.mapProgress.activeEnvironmentStateIds.indexOf(stateId);
    if (index < 0) return false;
    this.session.mapProgress.activeEnvironmentStateIds.splice(index, 1);
    delete this.session.mapProgress.activeEnvironmentStateTimers[stateId];
    recordHumanProtocolPerfEvent(this, "environment_state_off", {
      stateId,
      activeStates: this.session.mapProgress.activeEnvironmentStateIds.length,
    });
    return true;
  }

  updateTimedEnvironmentStates(delta: number) {
    const timers = this.session.mapProgress.activeEnvironmentStateTimers;
    for (const [stateId, remaining] of Object.entries(timers)) {
      if (!this.isEnvironmentStateActive(stateId)) {
        delete timers[stateId];
        continue;
      }
      const next = remaining - delta;
      if (next <= 0) {
        this.clearEnvironmentState(stateId);
      } else {
        timers[stateId] = next;
      }
    }
  }

  isEnvironmentStateActive(stateId: string) {
    return this.session.mapProgress.activeEnvironmentStateIds.includes(stateId);
  }

  activeEnvironmentStates(): LevelEnvironmentStateDefinition[] {
    const states = this.level.environmentStates ?? [];
    return states.filter((state) => this.isEnvironmentStateActive(state.id));
  }

  private resolveCampaignRouteDelta(delta: CampaignRouteDeltaConfig): CampaignRouteDeltaConfig {
    const route = this.level.campaignRoutes?.find((candidate) => candidate.id === delta.routeId);
    return {
      routeId: delta.routeId,
      amount: delta.amount,
      label: delta.label ?? route?.label ?? delta.routeId,
    };
  }

  private adjustCampaignRoute(delta: CampaignRouteDeltaConfig, source: ObjectiveEvent) {
    if (!Number.isFinite(delta.amount) || delta.amount === 0) return false;
    persistCampaignRouteAdjustment(this.userProfile, {
      levelId: this.session.levelId,
      routeId: delta.routeId,
      amount: delta.amount,
      label: delta.label,
    });
    this.dispatchObjectiveEvent({
      type: "campaign_route_changed",
      id: delta.routeId,
      optionId: source.optionId,
      value: this.userProfile.campaignRouteProfile.scores[delta.routeId]?.score ?? 0,
    });
    return true;
  }

  tryTriggerBossPhases(enemy: EnemyState) {
    const phases = this.level.bossPhases ?? [];
    if (phases.length === 0) return false;
    const healthRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 0;
    let triggered = false;
    for (const phase of phases) {
      if (phase.actorId !== enemy.archetypeId) continue;
      if (phase.tier && phase.tier !== enemy.tier) continue;
      if (healthRatio > phase.threshold) continue;
      if ((phase.once ?? true) && this.session.mapProgress.triggeredBossPhaseIds.includes(phase.id)) continue;
      addUnique(this.session.mapProgress.triggeredBossPhaseIds, phase.id);
      this.dispatchObjectiveEvent({ type: "boss_phase", id: phase.id, value: healthRatio });
      this.runConfiguredActions(phase.actions, { type: "boss_phase", id: phase.id, value: healthRatio });
      triggered = true;
    }
    return triggered;
  }

  claimDoubleMemoryReward() {
    if (this.session.mode !== "victory" || !this.session.settlement || this.session.memoryRewardDoubled) return false;
    const previous = this.session.settlement;
    const bonus = settleProgressMemory(this.playerProgress, previous.memoryGained);
    this.session.memoryRewardDoubled = true;
    this.session.settlement = {
      memoryGained: previous.memoryGained + bonus.memoryGained,
      totalMemoryBefore: previous.totalMemoryBefore,
      totalMemoryAfter: bonus.totalMemoryAfter,
      levelBefore: previous.levelBefore,
      levelAfter: bonus.levelAfter,
      pointsGained: previous.pointsGained + bonus.pointsGained,
    };
    syncUserProfileProgress(this.userProfile, this.playerProgress);
    recordMemoryRewardDoubled(this.userProfile, this.session.levelId, this.session.settlement);
    this.setRewardPulse({
      label: "积分 x2",
      detail: bonus.pointsGained > 0 ? `额外属性点 +${bonus.pointsGained}` : `额外积分 +${bonus.memoryGained}`,
      rarity: bonus.pointsGained > 0 ? "epic" : "rare",
    }, 1.8);
    this.emitAudio("ui_upgrade_select", { intensity: 1.05 });
    return true;
  }

  addMemoryFragments(
    amount: number,
    rewardPulse?: Omit<RewardPulseState, "id" | "remaining" | "total"> | null,
    rewardPulseDuration = 1.35,
  ) {
    const gained = Math.max(0, Math.round(amount));
    if (gained <= 0) return false;
    const previousCacheTier = this.session.memoryCacheTier;
    this.session.memoryFragments += gained;
    this.checkMemoryCacheMilestone();
    if (rewardPulse) {
      this.setRewardPulse(rewardPulse, rewardPulseDuration);
    } else if (this.session.memoryCacheTier === previousCacheTier) {
      this.setRewardPulse({
        label: `线索 +${gained}`,
        detail: "关卡事件奖励",
        rarity: gained >= 16 ? "epic" : gained >= 8 ? "rare" : "common",
      }, rewardPulseDuration);
    }
    return true;
  }

  registerEnemyKill(enemy: EnemyState) {
    const archetype = enemyArchetypes[enemy.archetypeId];
    const eliteKill = Boolean(archetype.elite || enemy.tier === "elite" || enemy.tier === "leader" || enemy.tier === "boss");
    this.emitAudio("enemy_destroyed", { intensity: eliteKill ? 1.2 : 0.85, position: enemy.position });
    const displayName = enemy.tier === "normal" ? archetype.displayName : `${enemy.tierLabel}${archetype.displayName}`;
    const fragments = this.memoryFragmentValue(enemy);
    const streakContinues = this.session.killStreakRemaining > 0;
    this.session.kills += 1;
    this.session.memoryFragments += fragments;
    this.session.killStreak = streakContinues ? this.session.killStreak + 1 : 1;
    this.session.bestKillStreak = Math.max(this.session.bestKillStreak, this.session.killStreak);
    this.session.killStreakRemaining = eliteKill ? 0 : this.level.economy.killStreakWindowSec;
    this.session.repairDropPity += 1;
    this.session.coreCellDropPity += 1;
    const tempoSurge = this.applyTempoSurgeForKill(eliteKill);
    const droppedKeyItem = this.dropConfiguredKeyItemsForEnemy(enemy);
    if (!droppedKeyItem) {
      this.maybeDropPickup(enemy, eliteKill);
    }

    if (this.session.kills === 1) {
      this.queueDialogue("first_enemy_killed");
    }

    if (droppedKeyItem) {
      this.setSpawnWarning({ label: `${droppedKeyItem.label}掉落`, detail: "靠近自动拾取" }, 2.3);
      this.setRewardPulse(droppedKeyItem.rewardPulse ?? {
        label: droppedKeyItem.label,
        detail: "掉在地上了",
        rarity: "epic",
      }, droppedKeyItem.rewardPulseDuration ?? 1.7);
    } else if (this.session.rewardPulse?.label !== this.level.pickups.coreCell.useLabel) {
      this.setRewardPulse(rewardPulseForKill(displayName, fragments, this.session.killStreak, eliteKill, tempoSurge));
    }
    this.checkMemoryCacheMilestone();
  }

  clearTransientInput() {
    this.touchInput.lookDelta.set(0, 0);
    this.touchInput.dashPressed = false;
    this.touchInput.interactPressed = false;
    this.touchInput.shockPressed = false;
    this.touchInput.switchWeaponPressed = false;
    this.touchInput.selectedWeapon = null;
    this.touchInput.requestedThreatTurnAngle = null;
  }

  addProjectile(projectile: ProjectileState) {
    this.projectiles.push(projectile);
  }

  spawnEnemy(
    archetypeId: EnemyArchetypeId,
    waveId: string,
    position: Vector3,
    rotationY: number,
    tierConfig?: EnemyTierOverrideConfig,
    options?: EnemySpawnRuntimeOptions,
  ) {
    const tunedTierConfig = this.enemyTierConfigForSpawn(archetypeId, tierConfig);
    for (const enemy of this.enemies) {
      if (enemy.archetypeId !== archetypeId || enemy.isAlive || enemy.deathAge < 1.05) continue;
      return resetEnemyRobot(enemy, archetypeId, waveId, position, rotationY, tunedTierConfig, options);
    }

    const enemy = createEnemyRobot(this.nextId(), archetypeId, waveId, position, rotationY, tunedTierConfig, options);
    this.enemies.push(enemy);
    return enemy;
  }

  private enemyTierConfigForSpawn(archetypeId: EnemyArchetypeId, tierConfig?: EnemyTierOverrideConfig): EnemyTierOverrideConfig | undefined {
    const smallEnemyDamageMultiplier = this.level.combatLimits.smallEnemyDamageMultiplier;
    if (!smallEnemyDamageMultiplier || Math.abs(smallEnemyDamageMultiplier - 1) < 0.001) return tierConfig;
    const isNormalSmallEnemy =
      this.level.combatLimits.smallEnemyArchetypes.includes(archetypeId) && (!tierConfig?.tier || tierConfig.tier === "normal");
    if (!isNormalSmallEnemy) return tierConfig;
    return {
      ...tierConfig,
      damageMultiplier: (tierConfig?.damageMultiplier ?? 1) * smallEnemyDamageMultiplier,
    };
  }

  addPickup(type: PickupState["type"], position: Vector3, options?: { ignoreDynamicLimit?: boolean; expires?: boolean }) {
    let activePickups = 0;
    for (const pickup of this.pickups) {
      if (!pickup.collected && pickup.type !== "ironRod" && pickup.type !== "pistol") {
        activePickups += 1;
      }
    }
    if (
      !options?.ignoreDynamicLimit &&
      activePickups >= this.level.pickups.maxActiveDynamicPickups &&
      type !== "ironRod" &&
      type !== "pistol"
    ) {
      return;
    }
    const resolvedPosition = this.resolvePickupDropPosition(type, position);
    this.pickups.push({
      id: this.nextId(),
      type,
      position: resolvedPosition,
      age: 0,
      collected: false,
      expires: options?.expires,
    });
  }

  private resolvePickupDropPosition(type: PickupState["type"], position: Vector3) {
    if (type !== "coreCell" && type !== "repairKit") return position.clone();
    const layout = this.level.map ? resolveRoomPresentation(this.level.map)?.pickupLayout : null;
    const spacingRadius = Math.max(0.35, layout?.dynamicSpacingRadius ?? 0.68);
    const scatterRadius = Math.max(0, layout?.dropScatterRadius ?? 0.22);
    const resolved = position.clone();

    if (scatterRadius > 0) {
      const salt = this.pickups.length * 1.618 + this.session.kills * 0.77 + (type === "coreCell" ? 0.35 : 2.15);
      resolved.x += Math.cos(salt) * scatterRadius;
      resolved.z += Math.sin(salt) * scatterRadius;
    }

    for (let pass = 0; pass < 4; pass += 1) {
      let moved = false;
      for (const pickup of this.pickups) {
        if (pickup.collected || (pickup.type !== "coreCell" && pickup.type !== "repairKit")) continue;
        const dx = resolved.x - pickup.position.x;
        const dz = resolved.z - pickup.position.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq >= spacingRadius * spacingRadius) continue;

        const distance = Math.sqrt(distanceSq);
        const fallbackAngle = this.pickups.length * 2.399 + pass * 0.73;
        const nx = distance > 0.001 ? dx / distance : Math.cos(fallbackAngle);
        const nz = distance > 0.001 ? dz / distance : Math.sin(fallbackAngle);
        const push = (spacingRadius - distance) * 0.62 + 0.05;
        resolved.x += nx * push;
        resolved.z += nz * push;
        moved = true;
      }
      if (!moved) break;
    }

    resolved.y = Math.max(0, resolved.y);
    return resolved;
  }

  collectPickup(pickup: PickupState) {
    if (pickup.collected) return;
    pickup.collected = true;
    const storyPickup = this.storyPickupConfig(pickup.type);
    if (storyPickup) {
      this.applyStoryPickup(storyPickup, pickup.position);
      return;
    }
    if (pickup.type === "coreCell") {
      const coreCell = this.level.pickups.coreCell;
      this.session.coreCells = Math.min(coreCell.maxHeld, this.session.coreCells + 1);
      this.setRewardPulse({
        label: coreCell.pickupLabel,
        detail: `${coreCell.pickupDetailPrefix} ${this.session.coreCells}/${coreCell.maxHeld}`,
        rarity: "epic",
      }, 1.45);
      this.addEffect("coreSpark", pickup.position, this.player.aimDirection, 0.2, 0.94);
      this.applyCameraImpact(0.07, 0.26, 0.035, 0.07);
      this.emitAudio("pickup_core_cell", { intensity: 1.05, position: pickup.position });
      return;
    }
    if (pickup.type === "breachMissile") {
      const coreCell = this.level.pickups.coreCell;
      this.session.activeUltimateAbilityId = "breachMissile";
      this.session.coreCells = Math.min(coreCell.maxHeld, Math.max(this.session.coreCells, 1));
      this.setRewardPulse({
        label: "突破导弹装入",
        detail: `${coreCell.pickupDetailPrefix} ${this.session.coreCells}/${coreCell.maxHeld}`,
        rarity: "epic",
      }, 1.45);
      this.addEffect("coreSpark", pickup.position, this.player.aimDirection, 0.28, 1.12);
      this.applyCameraImpact(0.1, 0.38, 0.05, 0.08);
      this.emitAudio("pickup_breach_missile", { intensity: 1.12, position: pickup.position });
      return;
    }

    const missingHealth = this.player.maxHealth - this.player.health;
    const healAmount = Math.min(missingHealth, Math.round(this.level.pickups.repairKit.healAmount * this.upgrades.repairKitHealMultiplier));
    this.player.health = Math.min(this.player.maxHealth, this.player.health + healAmount);
    this.setRewardPulse({
      label: this.level.pickups.repairKit.rewardLabel,
      detail: `生命 +${Math.round(healAmount)}`,
      rarity: healAmount >= this.level.pickups.repairKit.healAmount ? "rare" : "common",
    }, 1.25);
    this.addEffect("coreSpark", pickup.position, this.player.aimDirection, 0.18, 0.78 + Math.min(0.32, healAmount / this.player.maxHealth));
    this.addEffect("dashBurst", pickup.position, this.player.aimDirection, 0.22, 1.05);
    this.applyCameraImpact(0.055, 0.18, 0.026, 0.055);
    this.emitAudio("pickup_repair_kit", { intensity: 0.82 + Math.min(0.22, healAmount / this.player.maxHealth), position: pickup.position });
  }

  shouldCollectPickup(pickup: PickupState) {
    if (pickup.type === "repairKit") {
      return this.player.health < this.player.maxHealth - this.level.pickups.repairKit.minMissingHealthToCollect;
    }
    return true;
  }

  pickupCollectRadius(pickup: PickupState) {
    const storyPickup = this.storyPickupConfig(pickup.type);
    if (storyPickup) return storyPickup.collectRadius;
    if (pickup.type === "coreCell" && this.session.coreCells > 0) {
      return Math.max(1.2, this.level.pickups.collectRadii.coreCell - 0.6);
    }
    return this.level.pickups.collectRadii[pickup.type] ?? 1.85;
  }

  consumeCoreCell() {
    if (this.session.coreCells <= 0) return false;
    const coreCell = this.level.pickups.coreCell;
    const preserved = this.upgrades.coreCellKeepChance > 0 && Math.random() < this.upgrades.coreCellKeepChance;
    if (!preserved) {
      this.session.coreCells -= 1;
    }
    this.setRewardPulse({
      label: preserved ? coreCell.preservedLabel : coreCell.useLabel,
      detail: preserved ? coreCell.preservedDetail : coreCell.useDetail,
      rarity: "epic",
    }, 1.15);
    return true;
  }

  useUltimateAbility() {
    const deployed = this.session.deployedUltimate;
    const ability = deployed
      ? ultimateAbilityConfig[deployed.abilityId] ?? ultimateAbilityConfig[defaultUltimateAbilityId]
      : ultimateAbilityConfig[this.session.activeUltimateAbilityId] ?? ultimateAbilityConfig[defaultUltimateAbilityId];
    if (deployed) {
      if (deployed.phase === "held" && ability.activationMode === "throw_then_detonate") {
        return this.throwHeldUltimate(ability, deployed);
      }
      if (ability.activationMode === "throw_then_detonate") {
        return false;
      }
      return this.detonateDeployedUltimate();
    }

    if (ability.resource === "coreCell" && this.session.coreCells <= 0) {
      this.setRewardPulse(this.level.pickups.coreCell.emptyUseReward, 1.1);
      return false;
    }

    return this.deployUltimateAbility(ability);
  }

  updateDeployedUltimate(delta: number) {
    const deployed = this.session.deployedUltimate;
    if (!deployed) return;
    const previousAge = deployed.age;
    deployed.age += delta;
    const ability = ultimateAbilityConfig[deployed.abilityId] ?? ultimateAbilityConfig[defaultUltimateAbilityId];

    if (deployed.phase === "held") return;

    if (deployed.phase === "thrown") {
      const throwDelta = previousAge < 0 ? Math.max(0, deployed.age) : delta;
      if (throwDelta > 0) {
        this.updateThrownUltimate(deployed, ability, throwDelta);
      }
      return;
    }

    if (!deployed.armed && deployed.age >= 0) {
      deployed.armed = true;
      this.emitAudio("ui_confirm", { intensity: 0.72, position: new Vector3().fromArray(deployed.position) });
    }
    if (ability.activationMode === "throw_then_detonate" && deployed.armed && deployed.age >= ability.landedFuseSeconds) {
      const position = new Vector3().fromArray(deployed.position);
      this.session.deployedUltimate = null;
      this.detonateUltimateAt(position, ability, true);
    }
  }

  triggerEmergencyUltimateBlast() {
    const ability = ultimateAbilityConfig[this.session.activeUltimateAbilityId] ?? ultimateAbilityConfig[defaultUltimateAbilityId];
    this.detonateUltimateAt(this.player.position.clone(), ability, false);
  }

  private deployUltimateAbility(ability: UltimateAbilityConfig) {
    if (ability.resource === "coreCell" && ability.resourceSpendPhase === "hold" && !this.consumeCoreCell()) {
      this.setRewardPulse(this.level.pickups.coreCell.emptyUseReward, 1.1);
      return false;
    }

    const position = this.resolveUltimateDeployPosition(ability);
    this.session.deployedUltimate = {
      id: this.nextId(),
      abilityId: ability.id,
      phase: "held",
      position: [position.x, position.y, position.z],
      age: 0,
      armed: true,
      blastRadius: ability.blastRadius,
    };
    this.setRewardPulse(ability.deployReward, 1.2);
    const handPosition = this.player.position.clone().add(new Vector3(0, 1.05, 0)).add(this.player.aimDirection.clone().multiplyScalar(0.42));
    this.addEffect("dashBurst", handPosition, this.player.aimDirection, 0.18, 0.85);
    this.emitAudio(ability.deployAudioKey, { intensity: 0.95, position: handPosition });
    return true;
  }

  private throwHeldUltimate(ability: UltimateAbilityConfig, deployed: NonNullable<GameSessionState["deployedUltimate"]>) {
    if (ability.resource === "coreCell" && ability.resourceSpendPhase === "throw" && !this.consumeCoreCell()) {
      this.setRewardPulse(this.level.pickups.coreCell.emptyUseReward, 1.1);
      return false;
    }
    const start = this.resolveUltimateThrowStartPosition();
    const velocity = this.resolveUltimateThrowVelocity(ability);
    deployed.phase = "thrown";
    deployed.position = [start.x, start.y, start.z];
    deployed.velocity = [velocity.x, velocity.y, velocity.z];
    deployed.age = -ability.throwWindupSeconds;
    deployed.flightAge = 0;
    deployed.armed = false;
    this.setRewardPulse(ability.throwReward, 0.95);
    const throwDirection = velocity.clone().setY(0).normalize();
    if (ability.id === "breachMissile") {
      this.addEffect("breachTrail", start.clone().addScaledVector(throwDirection, -0.18), throwDirection, 0.24, 2.35);
      this.addEffect("breachPierce", start.clone().addScaledVector(throwDirection, 0.26), throwDirection, 0.18, 1.8);
    } else {
      this.addEffect("dashBurst", start, throwDirection, 0.22, 1.35);
    }
    this.emitAudio(ability.throwAudioKey, { intensity: 1.05, position: start });
    return true;
  }

  private updateThrownUltimate(
    deployed: NonNullable<GameSessionState["deployedUltimate"]>,
    ability: UltimateAbilityConfig,
    delta: number,
  ) {
    if (deployed.phase !== "thrown") return;
    if (!deployed.armed && deployed.age >= ability.throwArmSeconds) {
      deployed.armed = true;
    }

    const previous = new Vector3().fromArray(deployed.position);
    const velocity = new Vector3().fromArray(deployed.velocity ?? [0, 0, 0]);
    velocity.y -= ability.throwGravity * delta;
    const next = previous.clone().addScaledVector(velocity, delta);
    const previousFlightAge = deployed.flightAge ?? 0;
    const flightAge = previousFlightAge + delta;
    deployed.flightAge = flightAge;
    if (ability.id === "breachMissile") {
      this.addBreachMissileFlightEffects(previous, next, velocity, previousFlightAge, flightAge);
    }

    const enemyImpact = this.findThrownUltimateEnemyImpact(previous, next, ability.throwCollisionRadius);
    if (enemyImpact && flightAge > 0.025) {
      this.session.deployedUltimate = null;
      this.detonateUltimateAt(enemyImpact.position, ability, true);
      return;
    }

    if (this.isSegmentBlockedByObstacle(previous, next, ability.throwCollisionRadius) && flightAge > 0.035) {
      this.session.deployedUltimate = null;
      this.detonateUltimateAt(previous, ability, true);
      return;
    }

    if (next.y <= ability.deployYOffset) {
      next.y = ability.deployYOffset;
      deployed.phase = "deployed";
      deployed.position = [next.x, next.y, next.z];
      deployed.velocity = [0, 0, 0];
      deployed.age = 0;
      deployed.armed = true;
      if (ability.id === "breachMissile") {
        this.addEffect("breachPierce", next, this.resolveUltimateForwardDirection(), 0.16, 1.45);
      } else {
        this.addEffect("hitSpark", next, this.resolveUltimateForwardDirection(), 0.16, 1.1);
      }
      this.emitAudio("ui_confirm", { intensity: 0.72, position: next });
      return;
    }

    deployed.position = [next.x, next.y, next.z];
    deployed.velocity = [velocity.x, velocity.y, velocity.z];

    if (flightAge >= ability.throwFuseSeconds) {
      this.session.deployedUltimate = null;
      this.detonateUltimateAt(next, ability, true);
    }
  }

  private addBreachMissileFlightEffects(
    previous: Vector3,
    next: Vector3,
    velocity: Vector3,
    previousFlightAge: number,
    flightAge: number,
  ) {
    const trailStep = 0.045;
    if (Math.floor(previousFlightAge / trailStep) === Math.floor(flightAge / trailStep)) return;
    const forward = velocity.clone().setY(0);
    if (forward.lengthSq() < 0.001) forward.copy(this.resolveUltimateForwardDirection());
    forward.normalize();
    const side = new Vector3(-forward.z, 0, forward.x);
    const midpoint = previous.clone().lerp(next, 0.58);
    midpoint.y += 0.02;
    this.addEffect("breachTrail", midpoint.clone().addScaledVector(forward, -0.28), forward, 0.18, 2.25);
    this.addEffect("breachTrail", midpoint.clone().addScaledVector(side, 0.08), forward.clone().addScaledVector(side, 0.2).normalize(), 0.13, 1.62);
  }

  private findThrownUltimateEnemyImpact(start: Vector3, end: Vector3, collisionRadius: number) {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const deltaZ = end.z - start.z;
    const horizontalLengthSq = deltaX * deltaX + deltaZ * deltaZ;
    let bestImpact: { position: Vector3; t: number } | null = null;

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const t = horizontalLengthSq > 0.0001
        ? Math.max(0, Math.min(1, ((enemy.position.x - start.x) * deltaX + (enemy.position.z - start.z) * deltaZ) / horizontalLengthSq))
        : 0;
      const x = start.x + deltaX * t;
      const y = start.y + deltaY * t;
      const z = start.z + deltaZ * t;
      const hitRadius = enemy.radius + collisionRadius + 0.28;
      const dx = enemy.position.x - x;
      const dz = enemy.position.z - z;
      if (dx * dx + dz * dz > hitRadius * hitRadius) continue;
      const enemyCenterY = enemy.position.y + 0.82 * enemy.visualScaleMultiplier;
      const verticalReach = 1.2 + enemy.radius * 0.45;
      if (Math.abs(y - enemyCenterY) > verticalReach) continue;
      if (bestImpact && t >= bestImpact.t) continue;
      bestImpact = {
        t,
        position: new Vector3(x, Math.max(0.08, y), z),
      };
    }

    return bestImpact;
  }

  private detonateDeployedUltimate() {
    const deployed = this.session.deployedUltimate;
    if (!deployed) return false;
    if (deployed.phase === "thrown" && (!deployed.armed || deployed.age < 0)) {
      this.setRewardPulse({
        label: "核心正在飞行",
        detail: "引信会自动触发。",
        rarity: "rare",
      }, 0.55);
      return false;
    }
    if (deployed.phase === "deployed" && (!deployed.armed || deployed.age < 0)) {
      this.setRewardPulse({
        label: "核心正在投放",
        detail: "落地后会自动爆炸。",
        rarity: "rare",
      }, 0.55);
      return false;
    }

    const ability = ultimateAbilityConfig[deployed.abilityId] ?? ultimateAbilityConfig[defaultUltimateAbilityId];
    const position = deployed.phase === "held" ? this.resolveUltimateDeployPosition(ability) : new Vector3().fromArray(deployed.position);
    this.session.deployedUltimate = null;
    this.detonateUltimateAt(position, ability, true);
    return true;
  }

  private detonateUltimateAt(position: Vector3, ability: UltimateAbilityConfig, showReward: boolean) {
    const hitCount = this.damageEnemiesInUltimateBlast(position, ability);
    this.applyDynamicPropImpulseFromPoint(position, ability.blastRadius, ability.knockback * 0.6);
    const forward = this.player.aimDirection.lengthSq() > 0.001 ? this.player.aimDirection : new Vector3(0, 0, -1);
    const center = position.clone();
    center.y += 0.08;
    const side = new Vector3(-forward.z, 0, forward.x);
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);
    side.normalize();
    if (ability.id === "breachMissile") {
      this.addBreachMissileImpactEffects(center, forward, side);
    } else {
      this.addCoreBombBlastEffects(center, forward, side);
    }
    this.emitAudio(ability.detonateAudioKey, { intensity: 1.85, position });
    this.applyCameraImpact(0.94 + Math.min(hitCount, 4) * 0.07, 6.2, 0.72, 0.42);
    this.triggerRenderSurge(0.9, 0.58);
    this.camera.shakeSeed += 1;
    if (showReward) {
      this.setRewardPulse(ability.detonateReward, 1.15);
    }
    if (this.upgrades.shockRepairPing && hitCount > 0) {
      const heal = Math.min(this.player.maxHealth - this.player.health, hitCount * this.upgrades.shockHealPerHit);
      this.player.health = Math.min(this.player.maxHealth, this.player.health + heal);
    }
  }

  private addCoreBombBlastEffects(center: Vector3, forward: Vector3, side: Vector3) {
    const visualScale = 1;
    this.addEffect("shockwave", center, forward, 0.92 * visualScale, 4.25 * visualScale);
    this.addEffect("shockwave", center.clone().addScaledVector(forward, 0.34 * visualScale), forward, 0.68 * visualScale, 3.15 * visualScale);
    this.addEffect("shockwave", center.clone().addScaledVector(side, 0.26 * visualScale), side, 0.48 * visualScale, 2.15 * visualScale);
    this.addEffect("shockwave", center.clone().addScaledVector(side, -0.26 * visualScale), side.clone().multiplyScalar(-1), 0.48 * visualScale, 2.15 * visualScale);
    this.addEffect("dashBurst", center, forward, 0.58 * visualScale, 3.45 * visualScale);
    this.addEffect("dashBurst", center.clone().addScaledVector(side, 0.32 * visualScale), side, 0.38 * visualScale, 2.2 * visualScale);
    this.addEffect("dashBurst", center.clone().addScaledVector(side, -0.32 * visualScale), side.clone().multiplyScalar(-1), 0.38 * visualScale, 2.2 * visualScale);
    for (let index = 0; index < 18; index += 1) {
      const angle = index * (Math.PI * 2 / 18);
      const sparkDirection = new Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();
      const sparkPosition = center.clone().addScaledVector(sparkDirection, (0.28 + (index % 4) * 0.2) * visualScale);
      sparkPosition.y += 0.18 + (index % 3) * 0.13;
      this.addEffect(
        "hitSpark",
        sparkPosition,
        sparkDirection.clone().setY(0.28 + (index % 2) * 0.14).normalize(),
        (0.58 + (index % 3) * 0.08) * visualScale,
        (2.15 + (index % 4) * 0.28) * visualScale,
      );
    }
    this.addEffect("dashBurst", center.clone().addScaledVector(forward, 0.68 * visualScale), forward, 0.44 * visualScale, 3.05 * visualScale);
    this.addEffect("dashBurst", center.clone().addScaledVector(forward, -0.5 * visualScale), forward.clone().multiplyScalar(-1), 0.4 * visualScale, 2.65 * visualScale);
  }

  private addBreachMissileImpactEffects(center: Vector3, forward: Vector3, side: Vector3) {
    const missileForward = forward.clone().setY(0);
    if (missileForward.lengthSq() < 0.001) missileForward.set(0, 0, -1);
    missileForward.normalize();
    const missileSide = side.clone().setY(0);
    if (missileSide.lengthSq() < 0.001) missileSide.set(1, 0, 0);
    missileSide.normalize();

    const focusOrigin = center.clone().addScaledVector(missileForward, -0.28);
    this.addEffect("breachShock", center.clone().addScaledVector(missileForward, 0.24), missileForward, 0.3, 3.55);
    this.addEffect("breachShock", center.clone().addScaledVector(missileForward, -0.12), missileForward, 0.24, 2.75);
    this.addEffect("breachPierce", focusOrigin, missileForward, 0.26, 3.75);
    this.addEffect("breachPierce", center.clone().addScaledVector(missileForward, 0.62), missileForward, 0.2, 3.15);
    this.addEffect("breachTrail", center.clone().addScaledVector(missileForward, -0.54), missileForward, 0.22, 2.65);
    this.addEffect("breachTrail", center.clone().addScaledVector(missileForward, -0.82), missileForward, 0.18, 2.15);
    for (let index = 0; index < 10; index += 1) {
      const lateral = ((index % 2 === 0 ? 1 : -1) * (0.04 + (index % 4) * 0.035));
      const lift = 0.1 + (index % 3) * 0.09;
      const sparkPosition = focusOrigin
        .clone()
        .addScaledVector(missileForward, 0.12 + index * 0.115)
        .addScaledVector(missileSide, lateral);
      sparkPosition.y += lift;
      const sparkDirection = missileForward
        .clone()
        .addScaledVector(missileSide, lateral * 2.4)
        .setY(0.2 + (index % 2) * 0.12)
        .normalize();
      this.addEffect("breachPierce", sparkPosition, sparkDirection, 0.2 + index * 0.012, 1.95 + index * 0.1);
    }
  }

  private damageEnemiesInUltimateBlast(position: Vector3, ability: UltimateAbilityConfig) {
    let hitCount = 0;
    const damageMultiplier = this.attackMultiplierFor("flakBurst");
    const radius = ability.blastRadius;
    const radiusSq = radius * radius;

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = enemy.position.x - position.x;
      const dz = enemy.position.z - position.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > radiusSq) continue;

      const target = enemy.position.clone();
      target.y += 0.72;
      const blastOrigin = position.clone();
      blastOrigin.y += 0.38;
      if (!this.hasLineOfSight(blastOrigin, target, 0.18)) continue;

      const distance = Math.sqrt(distanceSq);
      const ratio = Math.min(1, distance / radius);
      const direction = new Vector3(dx, 0, dz);
      if (direction.lengthSq() < 0.001) {
        direction.set(this.player.aimDirection.x, 0, this.player.aimDirection.z);
      }
      if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
      direction.normalize();

      const bossLike = this.isBossLikeEnemy(enemy);
      const falloff = Math.max(0.42, 1.08 - ratio * 0.58);
      let damage = ability.damage * damageMultiplier * falloff * (bossLike ? ability.bossDamageMultiplier : 1);
      const isSmallEnemy = this.level.combatLimits.smallEnemyArchetypes.includes(enemy.archetypeId);
      const healthRatio = enemy.health / Math.max(1, enemy.maxHealth);
      if (isSmallEnemy && healthRatio <= ability.smallEnemyExecuteHealthRatio) {
        damage = Math.max(damage, enemy.health);
      }

      enemy.health = Math.max(0, enemy.health - damage);
      enemy.velocity.addScaledVector(direction, ability.knockback * this.upgrades.shockKnockbackMultiplier * (1.05 - ratio * 0.45));
      this.markEnemyHit(enemy, direction, bossLike ? 1.0 : 1.35);
      this.addEffect(enemy.health <= 0 ? "dashBurst" : "hitSpark", enemy.position, direction, enemy.health <= 0 ? 0.34 : 0.16, enemy.health <= 0 ? 1.75 : 1.25);
      hitCount += 1;

      if (enemy.health <= 0) {
        this.killEnemy(enemy);
        this.emitAudio(enemyArchetypes[enemy.archetypeId].audioKey, {
          intensity: bossLike ? 1.28 : 1.08,
          position: enemy.position,
        });
      } else {
        this.emitAudio("enemy_hit", {
          intensity: bossLike ? 1.05 : 0.98,
          position: enemy.position,
        });
      }
    }

    return hitCount;
  }

  private resolveUltimateDeployPosition(ability: UltimateAbilityConfig) {
    const forward = this.resolveUltimateForwardDirection();
    const start = this.player.position.clone();
    const target = start.clone().addScaledVector(forward, ability.deployDistance);
    if (this.isSegmentBlockedByObstacle(start, target, 0.22)) {
      target.copy(start).addScaledVector(forward, ability.deployFallbackDistance);
    }
    target.y = ability.deployYOffset;
    return target;
  }

  private resolveUltimateThrowStartPosition() {
    const forward = this.resolveUltimateForwardDirection();
    const right = new Vector3(-forward.z, 0, forward.x);
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    right.normalize();
    return this.player.position.clone().add(new Vector3(0, 1.08, 0)).addScaledVector(forward, 0.52).addScaledVector(right, 0.22);
  }

  private resolveUltimateThrowVelocity(ability: UltimateAbilityConfig) {
    const forward = this.resolveUltimateForwardDirection();
    const aimLift = this.player.aimDirection.lengthSq() > 0.001 ? Math.max(0, Math.min(0.85, this.player.aimDirection.y)) : 0;
    const velocity = forward.multiplyScalar(ability.throwSpeed);
    velocity.y = ability.throwUpwardVelocity + aimLift * 1.2;
    return velocity;
  }

  private resolveUltimateForwardDirection() {
    const forward = this.player.aimDirection.clone().setY(0);
    if (forward.lengthSq() < 0.001) {
      forward.set(Math.sin(this.player.rotationY), 0, -Math.cos(this.player.rotationY));
    }
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    return forward.normalize();
  }

  markEnemyHit(enemy: EnemyState, direction: Vector3, intensity = 1) {
    const healthRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    const isLargeEnemy = this.isBossLikeEnemy(enemy);
    const reaction = enemyReactionProfileFor(enemy.archetypeId, enemy.tier);
    const isCurrentSmallEnemy = this.level.combatLimits.smallEnemyArchetypes.includes(enemy.archetypeId);
    const hitDirection = direction.lengthSq() > 0.001
      ? direction.clone().setY(0).normalize()
      : enemy.lastHitDirection.clone().setY(0).normalize();
    if (hitDirection.lengthSq() < 0.001) hitDirection.set(0, 0, 1);
    enemy.damageFlash = Math.max(
      enemy.damageFlash,
      isLargeEnemy ? (healthRatio <= reaction.woundedHealthRatio ? 0.94 : 0.86) : isCurrentSmallEnemy && healthRatio <= reaction.woundedHealthRatio ? 0.95 : 0.82,
    );
    if (reaction.hitReactEvery > 0) {
      enemy.hitReactionCharge += Math.max(0.25, intensity);
      const shouldReact = intensity >= 1 || enemy.hitReactionCharge >= reaction.hitReactEvery;
      if (shouldReact) {
        enemy.hitReactionCharge = 0;
        const targetReact = healthRatio <= reaction.woundedHealthRatio ? reaction.woundedHitReact : reaction.baseHitReact;
        const maxReact = isLargeEnemy ? 0.28 : 0.24;
        const reactScale = isLargeEnemy ? 0.34 : 0.2;
        enemy.hitReact = Math.max(enemy.hitReact, Math.min(maxReact, targetReact * reactScale));
      }
    } else {
      enemy.hitReactionCharge = 0;
      const targetReact = healthRatio <= reaction.woundedHealthRatio ? reaction.woundedHitReact : reaction.baseHitReact;
      const intensityBoost = Math.min(1.35, Math.max(0.72, intensity));
      const maxReact = isLargeEnemy ? 0.26 : 0.09;
      const reactScale = isLargeEnemy ? 0.58 : 0.18;
      enemy.hitReact = Math.max(enemy.hitReact, Math.min(maxReact, targetReact * reactScale * intensityBoost));
    }
    if (isLargeEnemy && enemy.isAlive) {
      const staggerTuning = bossStaggerTuningForEnemy(this.level.id, enemy);
      const feedback = bossFeedbackForEnemy(this.level.id, enemy);
      const threshold = largeEnemyStaggerThreshold(enemy, staggerTuning.thresholdMultiplier);
      const woundedBoost = healthRatio <= reaction.woundedHealthRatio ? 1.18 : 1;
      const windupPressure = enemy.attackWindupRemaining > 0 ? 1.22 : 1;
      enemy.staggerCharge = Math.min(threshold * 1.2, enemy.staggerCharge + Math.max(0.2, intensity) * woundedBoost * windupPressure);
      const staggerPressure = Math.min(1, enemy.staggerCharge / threshold);
      this.emitLargeEnemyArmorFeedback(enemy, hitDirection, intensity, healthRatio <= reaction.woundedHealthRatio, staggerPressure, feedback);
      const windupInterrupted = enemy.attackWindupRemaining > 0 && intensity >= 1.05;
      if (windupInterrupted || enemy.staggerCharge >= threshold) {
        const freshStagger = enemy.staggerRemaining <= 0.04;
        const duration = largeEnemyStaggerDuration(enemy, windupInterrupted, staggerTuning.durationMultiplier, staggerTuning.interruptDurationBonus);
        enemy.staggerRemaining = Math.max(enemy.staggerRemaining, duration);
        enemy.staggerTotal = Math.max(enemy.staggerTotal, duration);
        enemy.staggerCharge = threshold * (windupInterrupted ? staggerTuning.interruptCarryChargeRatio : staggerTuning.carryChargeRatio);
        enemy.attackWindupRemaining = 0;
        enemy.attackWindupTotal = 0;
        enemy.attackCooldownRemaining = Math.max(enemy.attackCooldownRemaining, duration + staggerTuning.postStaggerCooldownBonus);
        enemy.hitReact = Math.max(enemy.hitReact, staggerTuning.hitReactFloor);
        enemy.damageFlash = Math.max(enemy.damageFlash, 1);
        enemy.velocity.addScaledVector(hitDirection, staggerTuning.velocityImpulse);
        if (freshStagger) {
          this.emitLargeEnemyStaggerEnterFeedback(enemy, hitDirection, feedback);
        }
      }
    }
    if (isLargeEnemy && enemy.attackWindupRemaining > 0 && enemy.attackWindupTotal > 0) {
      const suppress = Math.min(0.08, Math.max(0.025, intensity * 0.045));
      const suppressionCap = enemy.attackWindupTotal * 0.62;
      if (enemy.attackWindupRemaining < suppressionCap) {
        enemy.attackWindupRemaining = Math.min(suppressionCap, enemy.attackWindupRemaining + suppress);
      }
    }
    if (hitDirection.lengthSq() > 0.001) {
      enemy.lastHitDirection.copy(hitDirection);
    }
  }

  private emitLargeEnemyArmorFeedback(enemy: EnemyState, hitDirection: Vector3, intensity: number, wounded: boolean, staggerPressure: number, feedback: BossFeedbackRecipe) {
    if (enemy.damageFlash < 0.18 && intensity < 0.72) return;
    const side = new Vector3(-hitDirection.z, 0, hitDirection.x);
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);
    side.normalize();
    const sparkCount = staggerPressure > 0.72 ? feedback.armorSparkPressureCount : feedback.armorSparkBaseCount;
    for (let index = 0; index < sparkCount; index += 1) {
      const offsetSide = (index - (sparkCount - 1) * 0.5) * feedback.armorSparkSideSpacing;
      const position = enemy.position
        .clone()
        .addScaledVector(hitDirection, -0.08 + index * 0.035)
        .addScaledVector(side, offsetSide);
      position.y += feedback.armorSparkBaseHeight + index * feedback.armorSparkHeightStep;
      const sparkDirection = hitDirection.clone().multiplyScalar(-0.7).addScaledVector(side, offsetSide * 0.9).setY(0.25 + index * 0.08).normalize();
      this.addEffect(
        "armorSpark",
        position,
        sparkDirection,
        feedback.armorSparkLifetime + index * 0.035,
        feedback.armorSparkIntensity + (wounded ? feedback.armorSparkWoundedBonus : 0) + intensity * 0.22 + staggerPressure * feedback.armorSparkPressureBonus,
      );
    }
    if (staggerPressure > 0.72) {
      const warningPosition = enemy.position.clone().addScaledVector(hitDirection, -0.12);
      warningPosition.y += feedback.pressureSparkHeight;
      this.addEffect("armorSpark", warningPosition, hitDirection.clone().multiplyScalar(-1), 0.24, feedback.pressureSparkIntensity);
    }
  }

  private emitLargeEnemyStaggerEnterFeedback(enemy: EnemyState, hitDirection: Vector3, feedback: BossFeedbackRecipe) {
    const forward = hitDirection.lengthSq() > 0.001 ? hitDirection.clone().setY(0).normalize() : new Vector3(0, 0, 1);
    const focusTarget = enemy.position.clone().addScaledVector(forward, -(enemy.radius + 0.18));
    focusTarget.y += feedback.pressureSparkHeight;
    this.addEffect("shockwave", enemy.position, forward, feedback.staggerShockwaveLifetime, feedback.staggerShockwaveIntensity);
    this.addEffect("staggerBurst", enemy.position, forward, feedback.staggerBurstLifetime, feedback.staggerBurstIntensity);
    this.addEffect("dashBurst", enemy.position, forward, feedback.staggerDashLifetime, feedback.staggerDashIntensity);
    this.applyCameraImpact(feedback.staggerCameraShake, feedback.staggerCameraFovKick, feedback.staggerRumble, feedback.staggerRumbleDuration);
    this.applyCombatFocus(focusTarget, 0.18, 0.46);
    this.applyCombatHitStop(feedback.staggerHitStopDuration, feedback.staggerHitStopScale);
    this.emitAudio("enemy_hit", { intensity: enemy.tier === "boss" ? 1.48 : 1.28, position: enemy.position });
  }

  applyCameraImpact(shake: number, fovKick = 0, rumble = 0, rumbleDuration = 0) {
    this.camera.shake = Math.max(this.camera.shake, shake);
    this.camera.fovKick = Math.max(this.camera.fovKick, fovKick);
    if (rumbleDuration > 0) {
      this.camera.rumble = Math.max(this.camera.rumble, rumble);
      this.camera.rumbleRemaining = Math.max(this.camera.rumbleRemaining, rumbleDuration);
    }
    this.camera.shakeSeed += 1;
  }

  applyCombatHitStop(duration: number, scale = 0.18) {
    if (this.session.mode !== "playing" || this.paused) return;
    const clampedDuration = Math.max(0, Math.min(0.075, duration));
    if (clampedDuration <= 0) return;
    const clampedScale = Math.max(0.08, Math.min(1, scale));
    this.combatHitStopRemaining = Math.max(this.combatHitStopRemaining, clampedDuration);
    this.combatHitStopScale = this.combatHitStopRemaining > 0
      ? Math.min(this.combatHitStopScale, clampedScale)
      : clampedScale;
  }

  applyCombatFocus(target: Vector3, duration = 0.18, strength = 0.42) {
    if (this.session.mode !== "playing" || this.paused) return;
    const clampedDuration = Math.max(0.05, Math.min(0.28, duration));
    this.camera.combatFocusTarget.copy(target);
    this.camera.combatFocusRemaining = Math.max(this.camera.combatFocusRemaining, clampedDuration);
    this.camera.combatFocusTotal = Math.max(this.camera.combatFocusTotal, clampedDuration);
    this.camera.combatFocusStrength = Math.max(this.camera.combatFocusStrength, Math.max(0, Math.min(0.72, strength)));
  }

  consumeCombatDelta(delta: number) {
    if (this.combatHitStopRemaining <= 0 || this.session.mode !== "playing" || this.paused) {
      this.combatHitStopScale = 1;
      return delta;
    }
    const scaledDelta = delta * this.combatHitStopScale;
    this.combatHitStopRemaining = Math.max(0, this.combatHitStopRemaining - delta);
    if (this.combatHitStopRemaining <= 0) {
      this.combatHitStopScale = 1;
    }
    return scaledDelta;
  }

  setLanguage(language: GameLanguage) {
    this.settings.language = normalizeLanguage(language);
    this.persistSettings();
    this.levelRevision += 1;
    this.notifyLevelChange();
  }

  setMasterVolume(volume: number) {
    this.settings.masterVolume = normalizeVolume(volume);
    this.persistSettings();
  }

  setMusicVolume(volume: number) {
    this.settings.musicVolume = normalizeVolume(volume);
    this.persistSettings();
  }

  setSfxVolume(volume: number) {
    this.settings.sfxVolume = normalizeVolume(volume);
    this.persistSettings();
  }

  setTouchLookSensitivity(value: number) {
    this.settings.touchLookSensitivity = normalizeTouchLookSensitivity(value);
    this.persistSettings();
  }

  resumeFromPause() {
    this.paused = false;
  }

  openSettings() {
    this.paused = true;
  }

  togglePause() {
    if (this.session.mode !== "playing" && this.session.mode !== "title") return;
    this.paused = !this.paused;
  }

  killEnemy(enemy: EnemyState) {
    if (!enemy.isAlive) return;
    enemy.isAlive = false;
    enemy.deathAge = 0;
    enemy.attackWindupRemaining = 0;
    enemy.attackWindupTotal = 0;
    enemy.staggerRemaining = 0;
    enemy.staggerTotal = 0;
    enemy.staggerCharge = 0;
    enemy.hitReactionCharge = 0;
    enemy.hitReact = Math.max(enemy.hitReact, enemyReactionProfileFor(enemy.archetypeId, enemy.tier).deathReact);
    const deathBeat = this.level.enemyDeathBeats.find((beat) => beat.archetypeId === enemy.archetypeId);
    if (deathBeat) {
      this.applyConfiguredCameraImpact(deathBeat.cameraImpact);
      if (deathBeat.dashBurst) {
        this.addEffect("dashBurst", enemy.position, enemy.lastHitDirection, deathBeat.dashBurst.lifetime, deathBeat.dashBurst.intensity);
      }
      if (deathBeat.spawnWarning) {
        this.setSpawnWarning(deathBeat.spawnWarning, deathBeat.spawnWarningDuration ?? 1.85);
      }
    }
    addUnique(this.session.mapProgress.defeatedActorIds, enemy.archetypeId);
    const defeatedAsBoss = this.isBossLikeEnemy(enemy);
    if (defeatedAsBoss) {
      this.emitBossDefeatFeedback(enemy);
    }
    this.dispatchObjectiveEvent({ type: defeatedAsBoss ? "boss_dead" : "enemy_dead", id: enemy.archetypeId });
    this.registerEnemyKill(enemy);
  }

  private emitBossDefeatFeedback(enemy: EnemyState) {
    const feedback = bossFeedbackForEnemy(this.level.id, enemy);
    const forward = enemy.lastHitDirection.lengthSq() > 0.001
      ? enemy.lastHitDirection.clone().setY(0).normalize()
      : this.player.aimDirection.clone().setY(0).normalize();
    if (forward.lengthSq() < 0.001) forward.set(0, 0, 1);
    const side = new Vector3(-forward.z, 0, forward.x);
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);
    side.normalize();
    const center = enemy.position.clone().addScaledVector(forward, -(enemy.radius + 0.18));
    center.y += feedback.defeatCoreHeight;
    const sparkCount = feedback.defeatSparkCount;
    for (let index = 0; index < sparkCount; index += 1) {
      const lane = index - (sparkCount - 1) * 0.5;
      const position = center
        .clone()
        .addScaledVector(side, lane * 0.13)
        .addScaledVector(forward, (index % 3 - 1) * 0.1);
      const sparkDirection = forward
        .clone()
        .multiplyScalar(index % 2 === 0 ? -0.75 : 0.48)
        .addScaledVector(side, lane * 0.28)
        .setY(0.22 + index * 0.035)
        .normalize();
      this.addEffect("coreSpark", position, sparkDirection, 0.2 + index * 0.025, feedback.defeatSparkIntensity);
    }
    this.addEffect("shockwave", enemy.position, forward, feedback.defeatShockwaveLifetime, feedback.defeatShockwaveIntensity);
    this.addEffect("staggerBurst", enemy.position, forward, feedback.defeatBurstLifetime, feedback.defeatBurstIntensity);
    this.addEffect("dashBurst", enemy.position, forward, feedback.defeatDashLifetime, feedback.defeatDashIntensity);
    this.applyCameraImpact(feedback.defeatCameraShake, feedback.defeatCameraFovKick, feedback.defeatRumble, feedback.defeatRumbleDuration);
    this.applyCombatHitStop(feedback.defeatHitStopDuration, feedback.defeatHitStopScale);
  }

  private isBossLikeEnemy(enemy: EnemyState) {
    return Boolean(bossVisualProfileForEnemy(this.level.id, enemy)) ||
      enemy.archetypeId === this.level.combatLimits.eliteArchetypeId ||
      enemy.tier === "leader" ||
      enemy.tier === "boss";
  }

  addEffect(type: EffectType, position: Vector3, direction: Vector3, lifetime: number, intensity: number) {
    this.effects.push({
      id: this.nextId(),
      type,
      position: position.clone(),
      direction: direction.clone().normalize(),
      age: 0,
      lifetime,
      intensity,
    });
  }

  emitAudio(key: string, options: AudioCueOptions = {}) {
    this.nextAudioEventId += 1;
    this.audioEvents.push({
      id: this.nextAudioEventId,
      key,
      intensity: options.intensity ?? 1,
      position: options.position?.clone() ?? null,
    });
  }

  drainAudioEvents() {
    return this.audioEvents.splice(0, this.audioEvents.length);
  }

  spendProgressPoint(stat: ProgressStatId) {
    if (this.playerProgress.pendingStatPoints <= 0) return false;
    this.playerProgress.pendingStatPoints -= 1;
    this.playerProgress.stats[stat] += 1;
    savePlayerProgress(this.playerProgress);
    syncUserProfileProgress(this.userProfile, this.playerProgress);
    this.setRewardPulse({
      label: statRewardLabel(stat),
      detail: statRewardDetail(this.playerProgress.stats[stat]),
      rarity: "rare",
    }, 1.4);
    this.emitAudio("ui_upgrade_select", { intensity: 0.9 });
    return true;
  }

  dashCooldownDuration() {
    return playerDashCooldown(this.upgrades.dashCooldownMultiplier);
  }

  bladeEnergyCost() {
    return Math.max(8, Math.round(playerBladeEnergyCost(this.upgrades.bladeEnergyCostMultiplier)));
  }

  attackMultiplierFor(weaponId: WeaponId) {
    const progressAttack = 1 + this.playerProgress.stats.attack * progressStatEffects.attackPerPoint;
    if (weaponId === "flakBurst") return progressAttack * this.upgrades.coreCellDamageMultiplier;
    return progressAttack;
  }

  incomingDamageMultiplier() {
    if (this.debugOptions.noPlayerDamage) return 0;
    return Math.max(0.62, 1 - this.playerProgress.stats.defense * progressStatEffects.defensePerPoint);
  }

  enableQaNoDamageForTests() {
    this.debugOptions.qaPlaythrough = true;
    this.debugOptions.noPlayerDamage = true;
    this.player.health = this.player.maxHealth;
  }

  memoryToNextProgressLevel() {
    return memoryToNextProgressLevel(this.playerProgress.totalMemory);
  }

  weaponUnlocked(weaponId: WeaponId) {
    if (weaponId === "pulseRifle") return this.session.hasRod;
    if (weaponId === "railLance") return this.session.hasPistol;
    if (weaponId === "flakBurst") return this.session.coreCells > 0 || this.session.deployedUltimate?.phase === "held";
    return true;
  }

  configText(text: string) {
    return localizedConfigText(this.level, this.settings.language, text);
  }

  setRewardPulse(pulse: Omit<RewardPulseState, "id" | "remaining" | "total">, duration = 1.45) {
    this.nextRewardPulseId += 1;
    const localizedPulse = localizedConfigCopy(this.level, this.settings.language, pulse);
    this.session.rewardPulse = {
      id: this.nextRewardPulseId,
      label: localizedPulse.label,
      detail: localizedPulse.detail,
      rarity: localizedPulse.rarity,
      remaining: duration,
      total: duration,
    };
  }

  setSpawnWarning(warning: Omit<SpawnWarningState, "id" | "remaining" | "total">, duration = 1.85) {
    this.nextSpawnWarningId += 1;
    const localizedWarning = localizedConfigCopy(this.level, this.settings.language, warning);
    this.session.spawnWarning = {
      id: this.nextSpawnWarningId,
      label: localizedWarning.label,
      detail: localizedWarning.detail,
      remaining: duration,
      total: duration,
    };
  }

  applyConfiguredCameraImpact(config?: CameraImpactConfig) {
    if (!config) return;
    this.applyCameraImpact(config.shake ?? 0, config.fovKick ?? 0, config.rumble ?? 0, config.rumbleDuration ?? 0);
  }

  addConfiguredEffects(effects?: readonly LevelEffectConfig[]) {
    if (!effects) return;
    for (const effect of effects) {
      this.addEffect(
        effect.type,
        vectorFromTuple(effect.position),
        vectorFromTuple(effect.direction),
        effect.lifetime,
        effect.intensity,
      );
    }
  }

  emitConfiguredAudio(cue?: AudioCueConfig, position?: Vector3) {
    if (!cue) return;
    this.emitAudio(cue.key, { intensity: cue.intensity ?? 1, position });
  }

  triggerRenderSurge(intensity: number, duration = 0.42) {
    this.nextRenderSurgeId += 1;
    this.session.renderSurgeId = this.nextRenderSurgeId;
    this.session.renderSurgeRemaining = duration;
    this.session.renderSurgeTotal = duration;
    this.session.renderSurgeIntensity = Math.max(0.2, Math.min(1.6, intensity));
  }

  private resetLevel(mode: GameSessionState["mode"]) {
    this.player = createPlayerRobot(1);
    this.applyProgressStatsToPlayer();
    this.player.position.set(...this.level.spawnPoint);
    this.projectiles.length = 0;
    this.effects.length = 0;
    this.pickups.length = 0;
    this.dynamicProps.length = 0;
    this.syncPhysicsDynamicProps();
    this.resetObstacles();
    this.resetEnemyPool();
    this.enemySpawnSequence += 1;
    this.lastCombatWeapon = "pulseRifle";
    this.objectiveEvents.length = 0;
    this.session = this.createSession(mode);
    if (mode === "playing") {
      this.applyInitialInventory();
    }
    if (mode === "playing") {
      this.dispatchObjectiveEvent({ type: "level_start" });
    }
    if (mode === "playing") {
      recordLevelAttempt(this.userProfile, this.session.levelId);
    }
    if (mode === "playing") {
      for (const pickup of this.level.map?.pickups ?? []) {
        this.addPickup(pickup.type, vectorFromTuple(pickup.position), { ignoreDynamicLimit: true, expires: false });
      }
      for (const pickup of this.level.pickups.storyPickups) {
        this.addPickup(pickup.type, vectorFromTuple(pickup.position), { ignoreDynamicLimit: true, expires: false });
      }
      this.spawnConfiguredDynamicProps();
    }
    this.combatAssist.lockedEnemyId = null;
    this.combatAssist.lockedStrength = 0;
    this.combatAssist.reorientTargetYaw = null;
    this.upgrades = this.createUpgradeModifiers();
    this.camera.target.set(0, 0, 0);
    this.camera.lookAhead.set(0, 0, 0);
    this.camera.shake = 0;
    this.camera.fovKick = 0;
    this.camera.rumble = 0;
    this.camera.rumbleRemaining = 0;
    this.camera.combatFocusTarget.set(0, 0, 0);
    this.camera.combatFocusRemaining = 0;
    this.camera.combatFocusTotal = 0;
    this.camera.combatFocusStrength = 0;
  }

  private resetObstacles() {
    this.obstacles = this.level.map
      ? []
      : arenaObstacles.map((obstacle) => ({
          id: obstacle.id,
          visualKey: obstacle.visualKey,
          position: new Vector3(...obstacle.position),
          halfSize: new Vector3(...obstacle.halfSize),
        }));
    this.markObstacleIndexDirty();
  }

  private spawnConfiguredDynamicProps() {
    for (const prop of this.level.map?.props ?? []) {
      if (!isDynamicMapProp(prop) || prop.initiallyVisible === false || !prop.collider) continue;
      this.spawnDynamicProp({
        id: prop.id,
        roomId: prop.roomId,
        modelKey: prop.modelKey,
        position: vectorFromTuple(prop.position),
        halfSize: vectorFromTuple(prop.collider.halfSize),
        yaw: prop.rotation?.[1] ?? 0,
      });
    }
  }

  private notifyLevelChange() {
    for (const listener of this.levelChangeListeners) {
      listener();
    }
  }

  private syncLevelUrl() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (this.level.id === defaultLevelId) {
      url.searchParams.delete("level");
    } else {
      url.searchParams.set("level", this.level.id);
    }
    window.history.replaceState(window.history.state, "", url);
  }

  private persistSettings() {
    saveGameSettings(this.settings);
  }

  private resetEnemyPool() {
    if (this.enemies.length === 0) {
      this.enemies = createEnemyRobots(1000);
      return;
    }

    for (const enemy of this.enemies) {
      enemy.waveId = "__pool";
      enemy.spawnRoomId = undefined;
      enemy.position.set(0, 0, -4);
      enemy.velocity.set(0, 0, 0);
      enemy.tier = "normal";
      enemy.tierLabel = enemyTierProfiles.normal.tierLabel;
      enemy.health = 0;
      enemy.maxHealth = 1;
      enemy.isAlive = false;
      enemy.attackCooldownRemaining = 0;
      enemy.attackWindupRemaining = 0;
      enemy.attackWindupTotal = 0;
      enemy.staggerRemaining = 0;
      enemy.staggerTotal = 0;
      enemy.staggerCharge = 0;
      enemy.damageMultiplier = 1;
      enemy.moveSpeedMultiplier = 1;
      enemy.attackCooldownMultiplier = 1;
      enemy.attackRangeMultiplier = 1;
      enemy.threatWeightMultiplier = 1;
      enemy.visualScaleMultiplier = 1;
      enemy.lightIntensityMultiplier = 1;
      enemy.textureAtlasKey = enemy.archetypeId === "custodian_elite" ? "custodian_boss" : enemy.archetypeId === "clamp_bot" ? "clamp_bot" : "repair_drone";
      enemy.bodyColor = "";
      enemy.armorColor = "";
      enemy.coreColor = "";
      enemy.warningColor = "";
      enemy.spawnAge = 0;
      enemy.damageFlash = 0;
      enemy.hitReact = 0;
      enemy.hitReactionCharge = 0;
      enemy.deathAge = 99;
      enemy.lastHitDirection.set(0, 0, 1);
    }
  }

  private storyPickupConfig(type: PickupState["type"]): StoryPickupDefinition | null {
    if (type !== "ironRod" && type !== "pistol") return null;
    return this.level.pickups.storyPickups.find((pickup) => pickup.type === type) ?? null;
  }

  private applyInitialInventory() {
    const inventory = this.level.initialInventory;
    if (!inventory) return;
    if (inventory.hasRod) this.session.hasRod = true;
    if (inventory.hasPistol) this.session.hasPistol = true;
    if (typeof inventory.coreCells === "number") {
      this.session.coreCells = Math.max(0, Math.min(this.level.pickups.coreCell.maxHeld, inventory.coreCells));
    }
    if (inventory.equipWeapon && this.weaponUnlocked(inventory.equipWeapon)) {
      this.player.currentWeapon = inventory.equipWeapon;
      this.lastCombatWeapon = inventory.equipWeapon;
      this.player.weaponSwitchSequence += 1;
    }
  }

  private applyStoryPickup(config: StoryPickupDefinition, position: Vector3) {
    if (config.interactionId) {
      this.completeConfiguredInteraction(config.interactionId);
    }
    if (config.grants.hasRod) this.session.hasRod = true;
    if (config.grants.hasPistol) this.session.hasPistol = true;
    if (config.grants.equipWeapon) {
      this.player.currentWeapon = config.grants.equipWeapon;
      this.lastCombatWeapon = config.grants.equipWeapon;
      this.player.weaponSwitchSequence += 1;
    }
    if (typeof config.waveStartDelayAfterCollect === "number") {
      this.session.waveStartDelay = config.waveStartDelayAfterCollect;
    }
    if (config.dialogueTrigger) {
      this.queueDialogue(config.dialogueTrigger);
    }
    if (config.spawnWarning) {
      this.setSpawnWarning(config.spawnWarning, config.spawnWarningDuration ?? 1.85);
    }
    if (config.rewardPulse) {
      this.setRewardPulse(config.rewardPulse, config.rewardPulseDuration ?? 1.45);
    }
    this.emitConfiguredAudio(config.audio, position);
  }

  private applyProgressStatsToPlayer() {
    this.player.maxHealth += this.playerProgress.stats.health * progressStatEffects.healthPerPoint;
    this.player.health = this.player.maxHealth;
    this.player.maxEnergy += this.playerProgress.stats.energy * progressStatEffects.energyPerPoint;
    this.player.energy = this.player.maxEnergy;
  }

  private settleLevelProgress() {
    if (this.session.levelSettled) return;
    this.session.levelSettled = true;
    this.session.settlement = settleProgressMemory(this.playerProgress, this.session.memoryFragments);
    syncUserProfileProgress(this.userProfile, this.playerProgress);
    recordLevelCompletion(this.userProfile, {
      ...this.createRunRecordInput(),
      settlement: this.session.settlement,
      memoryDoubled: this.session.memoryRewardDoubled,
    });
  }

  private createRunRecordInput() {
    return {
      levelId: this.session.levelId,
      durationSeconds: this.session.levelElapsed,
      memoryFragments: this.session.memoryFragments,
      bestKillStreak: this.session.bestKillStreak,
      kills: this.session.kills,
      upgradeIds: [...this.session.appliedUpgradeIds],
      revivesUsed: this.session.revivesUsed,
    };
  }

  private createSession(mode: GameSessionState["mode"]): GameSessionState {
    return {
      mode,
      levelId: this.level.id,
      levelElapsed: 0,
      waveIndex: 0,
      activeWaveId: null,
      activeWaveElapsed: 0,
      reinforcementCounts: {},
      cinematicBeatFlags: {},
      waveStartDelay: mode === "playing" ? this.level.initialWaveStartDelay : 0,
      exitUnlocked: false,
      pendingUpgradeIds: [],
      appliedUpgradeIds: [],
      activeChoiceId: null,
      activeArticleId: null,
      activeQuizId: null,
      activeToolCalibrationPuzzleId: null,
      activeSequencePlaybackPuzzleId: null,
      activeCircuitGridPuzzleId: null,
      activeSurveillancePuzzleId: null,
      activeValveMatrixPuzzleId: null,
      activeArchiveMergePuzzleId: null,
      activeGalleryReadingPuzzleId: null,
      activeRouteSwitchId: null,
      activeFocusReveal: null,
      activeHandInteraction: null,
      doorRevealQueue: [],
      doorTransitionRevisions: {},
      quizError: null,
      quizErrorRemaining: 0,
      activeDialogue: null,
      dialogueQueue: [],
      activeExitCinematic: null,
      activeCampaignTransitionDialogue: null,
      transitionRemaining: 0,
      deathReason: null,
      reviveSurgeRemaining: 0,
      tempoSurgeRemaining: 0,
      memoryCacheTier: 0,
      coreCells: 0,
      activeUltimateAbilityId: defaultUltimateAbilityId,
      deployedUltimate: null,
      hasRod: false,
      hasPistol: false,
      repairDropPity: 0,
      coreCellDropPity: 0,
      memoryRewardDoubled: false,
      revivesUsed: 0,
      kills: 0,
      memoryFragments: 0,
      levelSettled: false,
      settlement: null,
      killStreak: 0,
      bestKillStreak: 0,
      killStreakRemaining: 0,
      lowEnergyPulseCooldown: 0,
      renderSurgeId: 0,
      renderSurgeRemaining: 0,
      renderSurgeTotal: 0,
      renderSurgeIntensity: 0,
      rewardPulse: null,
      spawnWarning: null,
      activeCodeLockPuzzleId: null,
      activeCodeLockInput: "",
      codeLockError: null,
      codeLockErrorRemaining: 0,
      mapProgress: this.createMapProgress(),
      interactionPrompt: null,
      pendingWaveStarts: [],
      message: "",
    };
  }

  private createMapProgress(): MapProgressState {
    const firstRoomId = this.level.map?.rooms[0]?.id ?? null;
    return {
      currentRoomId: null,
      visitedRoomIds: firstRoomId ? [firstRoomId] : [],
      openedDoorIds: this.level.map?.doors.filter((door) => door.defaultState === "open").map((door) => door.id) ?? [],
      unlockedDoorIds: this.level.map?.doors.filter((door) => door.defaultState === "open").map((door) => door.id) ?? [],
      collectedKeyItemIds: [],
      completedInteractionIds: [],
      activeObjectiveId: null,
      completedObjectiveIds: [],
      selectedChoiceIds: {},
      activeEnvironmentStateIds: [],
      activeEnvironmentStateTimers: {},
      triggeredBossPhaseIds: [],
      triggeredEventIds: [],
      triggeredWaveIds: [],
      completedWaveIds: [],
      defeatedActorIds: [],
      completedPuzzleIds: [],
      readArticleIds: [],
      completedQuizIds: [],
      failedQuizCounts: {},
      activeSwitchStateIds: {},
      activatedSwitchIds: [],
      switchActivationCounts: {},
      activeBigScreenStateIds: {},
      activatedBigScreenIds: [],
      bigScreenActivationCounts: {},
      activePuzzleSequences: {},
      activeHitSequenceOrders: {},
      hitSequencePlaybackSeen: {},
      failedPuzzleCounts: {},
      puzzleTargetPulses: {},
      roomClueSeenIds: [],
      keyItemDropPositions: {},
    };
  }

  private exitDoorId() {
    const map = this.level.map;
    if (!map) return null;
    const exitInteraction = map.interactions.find((interaction) => interaction.type === "exit");
    if (exitInteraction?.opensDoorId) return exitInteraction.opensDoorId;
    const exitRoomDoor = map.doors.find((door) => door.toRoomId === exitInteraction?.roomId || door.fromRoomId === exitInteraction?.roomId);
    if (exitRoomDoor) return exitRoomDoor.id;
    const nearExitDoor = map.doors.find((door) => {
      const dx = door.position[0] - this.level.exit.position[0];
      const dz = door.position[2] - this.level.exit.position[2];
      return dx * dx + dz * dz < 4;
    });
    return nearExitDoor?.id ?? null;
  }

  private createUpgradeModifiers(): UpgradeModifiers {
    return {
      pulseFireRateMultiplier: 1,
      pulseHeatMultiplier: 1,
      pulseKillHeatRefund: 0,
      railDamageMultiplier: 1,
      railHeatMultiplier: 1,
      railExtraLine: false,
      railPierceBonus: 0,
      railExecuteThreshold: 0,
      shockCooldownMultiplier: 1,
      shockRepairPing: false,
      shockHealPerHit: 0,
      shockKnockbackMultiplier: 1,
      coreCellDamageMultiplier: 1,
      coreCellKeepChance: 0,
      bladeEnergyCostMultiplier: 1,
      repairKitHealMultiplier: 1,
      dashCooldownMultiplier: 1,
      memoryEcho: false,
      moveSpeedMultiplier: 1,
      turnAssistMultiplier: 1,
      lowHealthAutoShock: false,
      lowHealthAutoShockUsed: false,
    };
  }

  private rollUpgrades() {
    const counts = new Map<string, number>();
    for (const id of this.session.appliedUpgradeIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const curatedIds = this.level.economy.curatedUpgradeRolls[this.session.appliedUpgradeIds.length] ?? [];

    const curatedPool =
      curatedIds.length > 0
        ? resolveUpgradeIds(curatedIds)
        : upgradePool;

    const available = curatedPool.filter((upgrade) => {
      const currentCount = counts.get(upgrade.id) ?? 0;
      if (currentCount >= upgrade.maxStacks) return false;
      return !(this.session.appliedUpgradeIds.length < 2 && currentCount > 0);
    });
    const seed = this.session.kills + this.session.appliedUpgradeIds.length * 17 + this.session.waveIndex * 31;
    const sorted = [...available].sort((a, b) => {
      const aScore = Math.sin(seed + a.id.length * 7.31) + rarityWeight(a.rarity);
      const bScore = Math.sin(seed + b.id.length * 7.31) + rarityWeight(b.rarity);
      return bScore - aScore;
    });

    const selected: string[] = [];
    const categoryCounts = new Map<string, number>();
    const maxPerCategory = this.session.appliedUpgradeIds.length === 0 ? 1 : 2;
    for (const upgrade of sorted) {
      const categoryCount = categoryCounts.get(upgrade.category) ?? 0;
      if (categoryCount >= maxPerCategory) continue;
      selected.push(upgrade.id);
      categoryCounts.set(upgrade.category, categoryCount + 1);
      if (selected.length === 3) break;
    }
    return selected;
  }

  private configuredUpgradeChoices(ids: readonly string[]) {
    const counts = new Map<string, number>();
    for (const id of this.session.appliedUpgradeIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const selected: string[] = [];
    for (const id of ids) {
      if (selected.includes(id)) continue;
      const upgrade = upgradeById.get(id);
      if (!upgrade) continue;
      const currentCount = counts.get(upgrade.id) ?? 0;
      if (currentCount >= upgrade.maxStacks) continue;
      selected.push(upgrade.id);
      if (selected.length >= 3) break;
    }
    return selected.length > 0 ? selected : this.rollUpgrades();
  }

  private applyUpgrade(upgradeId: string) {
    switch (upgradeId) {
      case "pulse_faster_cycle":
        this.upgrades.pulseFireRateMultiplier *= 1.18;
        this.upgrades.pulseKillHeatRefund += 5;
        this.upgrades.bladeEnergyCostMultiplier *= 0.94;
        break;
      case "pulse_coolant_feed":
        this.upgrades.bladeEnergyCostMultiplier *= 0.72;
        this.upgrades.pulseHeatMultiplier *= 0.88;
        this.combatAssist.targetConeDegrees += 1;
        break;
      case "pulse_chain_mark":
        this.combatAssist.targetConeDegrees += 6;
        this.upgrades.pulseKillHeatRefund += 4;
        this.upgrades.bladeEnergyCostMultiplier *= 0.9;
        break;
      case "rail_overcharge":
        this.upgrades.railDamageMultiplier *= 1.18;
        this.upgrades.railHeatMultiplier *= 1.12;
        this.upgrades.railPierceBonus += 2;
        this.upgrades.railExecuteThreshold = Math.max(this.upgrades.railExecuteThreshold, 0.12);
        this.player.gunReloadDuration = Math.max(2.15, this.player.gunReloadDuration * 0.62);
        break;
      case "rail_double_line":
        this.upgrades.railExtraLine = true;
        this.upgrades.railPierceBonus += 1;
        break;
      case "shock_shorter_cd":
        this.upgrades.shockCooldownMultiplier *= 0.82;
        this.upgrades.shockKnockbackMultiplier += 0.35;
        this.session.coreCells = Math.min(this.level.pickups.coreCell.maxHeld, this.session.coreCells + 1);
        break;
      case "shock_repair_ping":
        this.upgrades.shockRepairPing = true;
        this.upgrades.shockHealPerHit = Math.max(this.upgrades.shockHealPerHit, 2.2);
        this.upgrades.shockKnockbackMultiplier += 0.25;
        break;
      case "core_cell_damage":
        this.upgrades.coreCellDamageMultiplier *= 1.28;
        this.upgrades.shockKnockbackMultiplier += 0.16;
        break;
      case "core_cell_preserve":
        this.upgrades.coreCellKeepChance = Math.min(0.48, this.upgrades.coreCellKeepChance + 0.26);
        break;
      case "shock_memory_echo":
        this.upgrades.memoryEcho = true;
        this.queueDialogue("wave_2_complete");
        break;
      case "core_plating":
        this.player.maxHealth += 30;
        this.player.health += 30;
        break;
      case "servo_stride":
        this.upgrades.moveSpeedMultiplier *= 1.1;
        break;
      case "turn_assist":
        this.upgrades.turnAssistMultiplier *= 1.15;
        break;
      case "wide_target_cone":
        this.combatAssist.targetConeDegrees += 4;
        break;
      case "thermal_buffer":
        this.player.maxEnergy += 16;
        this.player.energy = this.player.maxEnergy;
        this.upgrades.bladeEnergyCostMultiplier *= 0.92;
        break;
      case "dash_shorter_cd":
        this.upgrades.dashCooldownMultiplier *= 0.72;
        break;
      case "field_medicine":
        this.upgrades.repairKitHealMultiplier *= 1.35;
        break;
      case "last_human_protocol":
        this.upgrades.lowHealthAutoShock = true;
        break;
    }
  }

  private equipWeaponForUpgrade(upgrade: UpgradeDefinition) {
    if (upgrade.category === "blade") {
      this.player.currentWeapon = "pulseRifle";
      this.lastCombatWeapon = "pulseRifle";
    } else if (upgrade.category === "gun") {
      this.player.currentWeapon = "railLance";
      this.lastCombatWeapon = "railLance";
    } else if (upgrade.category === "ultimate") {
      const coreCell = this.level.pickups.coreCell;
      this.session.activeUltimateAbilityId = upgrade.ultimateAbilityId ?? defaultUltimateAbilityId;
      this.session.coreCells = Math.min(coreCell.maxHeld, this.session.coreCells + 1);
      this.setRewardPulse({
        label: coreCell.upgradeInsertedLabel,
        detail: `${coreCell.pickupDetailPrefix} ${this.session.coreCells}/${coreCell.maxHeld}`,
        rarity: "epic",
      }, 1.4);
      return;
    } else {
      return;
    }

    this.player.fireCooldownRemaining = Math.min(this.player.fireCooldownRemaining, 0.08);
    this.player.weaponSwitchSequence += 1;
  }

  private preferredReviveWeapon() {
    return this.session.appliedUpgradeIds.some((id) => id.startsWith("rail_")) ? "railLance" : "pulseRifle";
  }

  private applyTempoSurgeForKill(elite: boolean) {
    const tempo = this.level.economy.tempoSurge;
    if (elite) {
      this.session.tempoSurgeRemaining = Math.max(this.session.tempoSurgeRemaining, tempo.eliteDuration);
      this.player.heat = 0;
      this.player.energy = this.player.maxEnergy;
      return true;
    }

    if (this.session.killStreak < tempo.normalThreshold) return false;

    const streakTier = this.session.killStreak >= tempo.tier2Threshold ? 2 : 1;
    this.session.tempoSurgeRemaining = Math.max(this.session.tempoSurgeRemaining, streakTier === 2 ? tempo.tier2Duration : tempo.tier1Duration);
    this.player.heat = Math.max(0, this.player.heat - (streakTier === 2 ? tempo.tier2HeatRefund : tempo.tier1HeatRefund));
    this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + (streakTier === 2 ? tempo.tier2EnergyRefund : tempo.tier1EnergyRefund));
    return true;
  }

  private maybeDropPickup(enemy: EnemyState, elite: boolean) {
    this.maybeDropCoreCell(enemy, elite);
    this.maybeDropRepairKit(enemy, elite);
  }

  private dropConfiguredKeyItemsForEnemy(enemy: EnemyState) {
    const map = this.level.map;
    if (!map) return null;

    let droppedItem: LevelKeyItemDefinition | null = null;
    for (const item of map.keyItems) {
      if (item.dropFromArchetypeId !== enemy.archetypeId) continue;
      if (this.session.mapProgress.collectedKeyItemIds.includes(item.id)) continue;
      if (this.session.mapProgress.keyItemDropPositions[item.id]) continue;
      const dropDirX = enemy.lastHitDirection.lengthSq() > 0.001 ? -enemy.lastHitDirection.x : -Math.sin(enemy.rotationY);
      const dropDirZ = enemy.lastHitDirection.lengthSq() > 0.001 ? -enemy.lastHitDirection.z : Math.cos(enemy.rotationY);
      this.session.mapProgress.keyItemDropPositions[item.id] = [
        Math.round((enemy.position.x + dropDirX * 0.85) * 100) / 100,
        0,
        Math.round((enemy.position.z + dropDirZ * 0.85) * 100) / 100,
      ];
      droppedItem = item;
      this.addEffect("dashBurst", enemy.position, enemy.lastHitDirection, 0.42, 1.45);
      this.emitConfiguredAudio(item.audio, enemy.position);
    }
    return droppedItem;
  }

  private memoryFragmentValue(enemy: EnemyState) {
    const base = this.level.economy.memoryFragments.byArchetype[enemy.archetypeId] ?? this.level.economy.memoryFragments.default;
    if (enemy.tier === "boss") return Math.max(base, Math.round(base * 3));
    if (enemy.tier === "leader") return Math.max(base, Math.round(base * 2));
    if (enemy.tier === "elite") return Math.max(base, Math.round(base * 1.4));
    return base;
  }

  private maybeDropCoreCell(enemy: EnemyState, elite: boolean) {
    const drop = this.level.pickups.drops.coreCell;
    if (this.session.coreCells >= this.level.pickups.coreCell.maxHeld) return;
    const activeDrops = this.pickups.filter((pickup) => !pickup.collected && pickup.type === "coreCell").length;
    if (activeDrops >= drop.activeDropLimit) return;

    let chance = 0;
    if (elite) {
      chance = drop.eliteChance;
    } else {
      const archetypeDrop = drop.archetypeChances[enemy.archetypeId];
      if (archetypeDrop && this.session.kills >= archetypeDrop.minKills) {
        chance = archetypeDrop.chance;
      }
    }

    const pityReady = this.session.coreCellDropPity >= drop.pityKills && this.session.kills >= drop.minKillsForPity;
    const shouldDrop = this.dropRoll(enemy, "core") < chance || pityReady;

    if (!shouldDrop) return;
    this.session.coreCellDropPity = 0;
    this.addPickup("coreCell", enemy.position);
  }

  private maybeDropRepairKit(enemy: EnemyState, elite: boolean) {
    const drop = this.level.pickups.drops.repairKit;
    const missingHealth = this.player.maxHealth - this.player.health;
    if (missingHealth < drop.minMissingHealth && !elite) return;
    let activeRepairKits = 0;
    for (const pickup of this.pickups) {
      if (!pickup.collected && pickup.type === "repairKit") {
        activeRepairKits += 1;
      }
    }
    if (activeRepairKits >= drop.activeDropLimit) return;

    const healthRatio = this.player.health / this.player.maxHealth;
    let chance = elite ? drop.eliteChance : drop.baseChance;
    chance += drop.archetypeChanceBonus[enemy.archetypeId] ?? 0;
    if (missingHealth > this.player.maxHealth * drop.missingHealthThreshold) chance += drop.missingHealthBonus;
    for (const bonus of drop.lowHealthBonuses) {
      if (healthRatio <= bonus.healthRatioAtMost) chance += bonus.bonus;
    }

    const pityRule = drop.lowHealthPity.find((rule) => healthRatio <= rule.healthRatioAtMost);
    const lowHealthPity = Boolean(pityRule && activeRepairKits === 0 && this.session.repairDropPity >= pityRule.kills);
    const shouldDrop = lowHealthPity || this.dropRoll(enemy, "repair") < chance;

    if (!shouldDrop) return;
    this.session.repairDropPity = 0;
    this.addPickup("repairKit", enemy.position);
  }

  private dropRoll(enemy: EnemyState, salt: string) {
    const saltValue = salt === "core" ? 19.17 : 43.73;
    const value = Math.sin(enemy.id * 12.9898 + this.session.kills * 78.233 + this.session.levelElapsed * 4.31 + saltValue);
    return value - Math.floor(value);
  }

  private checkMemoryCacheMilestone() {
    const next = this.level.economy.memoryCacheMilestones[this.session.memoryCacheTier];
    if (!next || this.session.memoryFragments < next.amount) return;

    this.session.memoryCacheTier += 1;
    if (next.reward === "energy") {
      this.player.maxEnergy += 10;
      this.player.energy = this.player.maxEnergy;
    }
    if (next.reward === "heat") {
      this.player.maxHeat += 15;
      this.player.heat = Math.max(0, this.player.heat - 18);
    }
    if (next.reward === "health") {
      this.player.maxHealth += 12;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 18);
    }

    this.setRewardPulse({
      label: `补给 ${this.session.memoryCacheTier}/3`,
      detail: next.label,
      rarity: next.rarity,
    }, 2);
    this.emitAudio("ui_upgrade_select", { intensity: 0.95 + this.session.memoryCacheTier * 0.08 });
  }
}

function rewardPulseForKill(displayName: string, fragments: number, streak: number, elite: boolean, tempoSurge: boolean) {
  if (elite) {
    return {
      label: `${displayName}倒下`,
      detail: `+${fragments} 线索 + 短暂爆发`,
      rarity: "epic" as const,
    };
  }
  if (streak >= 10) {
    return {
      label: `${streak}连杀爆发`,
      detail: `${displayName} +${fragments} 线索`,
      rarity: "epic" as const,
    };
  }
  if (tempoSurge || streak >= 6) {
    return {
      label: `${streak}连杀`,
      detail: `${displayName} +${fragments} 线索`,
      rarity: "rare" as const,
    };
  }
  return {
    label: `线索 +${fragments}`,
    detail: displayName,
    rarity: streak >= 3 ? "rare" as const : "common" as const,
  };
}

function pulseRarityForUpgrade(rarity: string): RewardPulseState["rarity"] {
  if (rarity === "Epic") return "epic";
  if (rarity === "Prototype") return "story";
  if (rarity === "Rare") return "rare";
  return "common";
}

function rarityLabelForUpgrade(rarity: string) {
  if (rarity === "Prototype") return "原型";
  if (rarity === "Epic") return "史诗";
  if (rarity === "Rare") return "稀有";
  return "普通";
}

function resolveUpgradeIds(ids: readonly string[]) {
  const upgrades: UpgradeDefinition[] = [];
  for (const id of ids) {
    const upgrade = upgradeById.get(id);
    if (upgrade) upgrades.push(upgrade);
  }
  return upgrades;
}

function rarityWeight(rarity: string) {
  if (rarity === "Prototype") return 0.45;
  if (rarity === "Epic") return 0.35;
  if (rarity === "Rare") return 0.2;
  return 0;
}

function playerDashCooldown(multiplier: number) {
  return playerConfig.dashCooldown * multiplier;
}

function playerBladeEnergyCost(multiplier: number) {
  return playerConfig.bladeEnergyCost * multiplier;
}

function vectorFromTuple(tuple: readonly [number, number, number]) {
  return new Vector3(tuple[0], tuple[1], tuple[2]);
}

function defaultFocusRevealDuration(kind: FocusRevealActionTarget["kind"]) {
  // Door reveals carry a paced slow-open lift (see the Raw renderer's
  // reveal-synced door progress), so hold long enough for the camera to arrive,
  // watch the ~1.4s lift, then ease back. Robot/room reveals hold a beat longer
  // so just-woken robots are on-camera before the camera returns.
  if (kind === "robot" || kind === "room") return 2.8;
  if (kind === "door") return 2.6;
  return 2.2;
}

function puzzleTargetPulseKey(puzzleId: string, targetId: string) {
  return `${puzzleId}:${targetId}`;
}

function addUnique(values: string[], value: string) {
  if (values.includes(value)) return false;
  values.push(value);
  return true;
}

function removeValue(values: string[], value: string) {
  const index = values.indexOf(value);
  if (index < 0) return false;
  values.splice(index, 1);
  return true;
}

function switchStateKey(switchId: string, stateId: string) {
  return `${switchId}:${stateId}`;
}

export type RouteSwitchOutputKind = "door" | "puzzle" | "robot" | "standby";

export interface RouteSwitchOption {
  stateId: string;
  index: number;
  isIdle: boolean;
  kind: RouteSwitchOutputKind;
  label: string;
  detail: string;
  requiredKeyItemId?: string;
  hasKey: boolean;
}

export interface RouteSwitchView {
  switchId: string;
  label: string;
  hasKey: boolean;
  currentStateId: string | null;
  options: RouteSwitchOption[];
}

/** Infer an output's kind from its runtime actions (door unlock, robot wave, or a
 *  puzzle reveal). The idle state is mapped to "standby" by the caller. */
function routeSwitchStateKind(state: LevelSwitchStateDefinition): RouteSwitchOutputKind {
  const actions = state.actions ?? [];
  if (actions.some((action) => action.type === "unlock_door" || action.type === "open_door")) return "door";
  if (actions.some((action) => action.type === "start_wave")) return "robot";
  return "puzzle";
}

function bigScreenStateKey(screenId: string, stateId: string) {
  return `${screenId}:${stateId}`;
}

function expectedFormulaCode(formula: LevelCodeLockFormulaDefinition | undefined, inputLength: number) {
  if (!formula) return "";
  const evaluated = formula.answer ?? safeEvaluateArithmeticExpression(formula.expression)?.toString() ?? "";
  const digitText = evaluated.replace(/\D/g, "");
  if (!digitText) return "";
  const width = Math.max(1, formula.padLength ?? inputLength);
  const padded = digitText.padStart(width, "0");
  return formula.resultMode === "last_digits" ? padded.slice(-inputLength) : padded.slice(0, inputLength);
}

function safeEvaluateArithmeticExpression(expression: string) {
  const tokens = tokenizeArithmeticExpression(expression);
  if (!tokens) return null;
  let index = 0;

  const peek = () => tokens[index] ?? null;
  const consume = () => tokens[index++] ?? null;

  const parseFactor = (): number | null => {
    const token = consume();
    if (token === "+" || token === "-") {
      const value = parseFactor();
      if (value === null) return null;
      return token === "-" ? -value : value;
    }
    if (token === "(") {
      const value = parseExpression();
      if (value === null || consume() !== ")") return null;
      return value;
    }
    if (token && /^\d+$/.test(token)) return Number(token);
    return null;
  };

  const parseTerm = (): number | null => {
    let value = parseFactor();
    while (value !== null && (peek() === "*" || peek() === "/")) {
      const operator = consume();
      const next = parseFactor();
      if (next === null) return null;
      if (operator === "*") {
        value *= next;
      } else {
        if (next === 0) return null;
        value /= next;
      }
    }
    return value;
  };

  function parseExpression(): number | null {
    let value = parseTerm();
    while (value !== null && (peek() === "+" || peek() === "-")) {
      const operator = consume();
      const next = parseTerm();
      if (next === null) return null;
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }

  const value = parseExpression();
  if (value === null || index !== tokens.length || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function tokenizeArithmeticExpression(expression: string) {
  const tokens: string[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[+\-*/()]/.test(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }
    if (/\d/.test(char)) {
      let end = index + 1;
      while (end < expression.length && /\d/.test(expression[end])) end += 1;
      tokens.push(expression.slice(index, end));
      index = end;
      continue;
    }
    return null;
  }
  return tokens;
}

function positiveDuration(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function triggerMatches(expected: LevelObjectiveTriggerDefinition, actual: ObjectiveEvent) {
  if (expected.type !== actual.type) return false;
  if (typeof expected.threshold === "number" && typeof actual.value === "number" && actual.value > expected.threshold) return false;
  if (typeof expected.threshold === "number" && typeof actual.value !== "number") return false;
  if (expected.optionId && expected.optionId !== actual.optionId) return false;
  return !expected.id || expected.id === actual.id;
}

function doorSurviveWaveIds(lock: DoorLockDefinition) {
  if (lock.type !== "survive_wave") return [];
  const ids = [...(lock.waveIds ?? []), ...(lock.waveId ? [lock.waveId] : [])];
  return [...new Set(ids.filter(Boolean))];
}

function doorPuzzleLockIds(lock: DoorLockDefinition) {
  if (lock.type !== "puzzle_complete") return [];
  const ids = [...(lock.puzzleIds ?? []), ...(lock.puzzleId ? [lock.puzzleId] : [])];
  return [...new Set(ids.filter(Boolean))];
}

const projectileNonStructuralCoverColumnHeight = 1.8;
const projectileNonStructuralCoverThreshold = 0.7;

function projectileObstacleBlocks(obstacle: ObstacleState, start: Vector3, end: Vector3, radius: number) {
  if (isStructuralObstacle(obstacle)) return true;
  if (obstacle.enemyNavigation === "ignore") return false;

  const minY = obstacle.position.y - obstacle.halfSize.y - radius;
  const maxY = obstacle.position.y + obstacle.halfSize.y + radius;
  const shotMinY = Math.min(start.y, end.y) - radius;
  const shotMaxY = Math.max(start.y, end.y) + radius;
  if (maxY < shotMinY || minY > shotMaxY) return false;

  const coverRatio = Math.max(0, maxY) / projectileNonStructuralCoverColumnHeight;
  return coverRatio > projectileNonStructuralCoverThreshold;
}

function isStructuralObstacle(obstacle: ObstacleState) {
  const id = obstacle.id.toLowerCase();
  const visualKey = obstacle.visualKey.toLowerCase();
  return id.startsWith("door:") || id.startsWith("room-wall:") || visualKey.includes("wall") || visualKey.includes("door");
}

function objectiveRequirementsMet(objective: LevelObjectiveDefinition, progress: MapProgressState) {
  if (objective.requiredIds.length === 0) return true;

  if (objective.type === "collect_story_pickups" || objective.type === "inspect_all" || objective.type === "repair_panel") {
    return objective.requiredIds.every((id) => progress.completedInteractionIds.includes(id));
  }
  if (objective.type === "collect_key") {
    return objective.requiredIds.every((id) => progress.collectedKeyItemIds.includes(id));
  }
  if (objective.type === "open_door") {
    return objective.requiredIds.every((id) => progress.openedDoorIds.includes(id));
  }
  if (objective.type === "survive_wave" || objective.type === "boss_dead") {
    return objective.requiredIds.every((id) => progress.completedWaveIds.includes(id) || progress.defeatedActorIds.includes(id));
  }
  if (objective.type === "custom") {
    return objective.requiredIds.every(
      (id) =>
        progress.completedPuzzleIds.includes(id) ||
        progress.readArticleIds.includes(id) ||
        progress.completedQuizIds.includes(id) ||
        progress.activatedSwitchIds.includes(id) ||
        progress.activatedBigScreenIds.includes(id) ||
        progress.completedInteractionIds.includes(id) ||
        progress.collectedKeyItemIds.includes(id) ||
        progress.openedDoorIds.includes(id) ||
        progress.completedWaveIds.includes(id) ||
        progress.visitedRoomIds.includes(id),
    );
  }

  return true;
}

function canAutoCompleteObjectiveOnStart(objective: LevelObjectiveDefinition) {
  return (
    objective.type === "collect_key" ||
    objective.type === "open_door" ||
    objective.type === "survive_wave" ||
    objective.type === "boss_dead" ||
    objective.type === "custom"
  );
}

function explicitDoorRevealIdsForActions(actions: readonly LevelRuntimeEventAction[] | undefined) {
  const doorIds = new Set<string>();
  for (const action of actions ?? []) {
    if (action.type === "focus_reveal" && action.reveal.kind === "door" && action.reveal.doorId) {
      doorIds.add(action.reveal.doorId);
    }
  }
  return doorIds;
}

function largeEnemyStaggerThreshold(enemy: EnemyState, thresholdMultiplier = 1) {
  const base = enemy.tier === "boss" ? 2.72 : enemy.tier === "leader" ? 2.48 : 2.62;
  return base * thresholdMultiplier;
}

function largeEnemyStaggerDuration(enemy: EnemyState, interruptedWindup: boolean, durationMultiplier = 1, interruptDurationBonus = 0.16) {
  const base = enemy.tier === "boss" ? 0.72 : enemy.tier === "leader" ? 0.54 : 0.48;
  return base * durationMultiplier + (interruptedWindup ? interruptDurationBonus : 0);
}

function statRewardLabel(stat: ProgressStatId) {
  if (stat === "health") return "生命训练";
  if (stat === "attack") return "攻击训练";
  if (stat === "defense") return "防御训练";
  return "精力训练";
}

function statRewardDetail(level: number) {
  return `当前 ${level} 级`;
}

function pointInRoomBounds(x: number, z: number, room: LevelRoomDefinition) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const shape = room.bounds.shape?.points;
  if (!shape?.length) {
    return x >= cx - sx / 2 && x <= cx + sx / 2 && z >= cz - sz / 2 && z <= cz + sz / 2;
  }

  const px = x - cx;
  const pz = z - cz;
  let inside = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i, i += 1) {
    const [xi, zi] = shape[i];
    const [xj, zj] = shape[j];
    const intersects = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function yawFromQuaternion(rotation: Quaternion) {
  return Math.atan2(
    2 * (rotation.w * rotation.y + rotation.x * rotation.z),
    1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z),
  );
}

function deterministicDynamicPropImpulseAngle(id: string) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}

function readRuntimeDebugOptions(): RuntimeDebugOptions {
  if (typeof window === "undefined") {
    return { qaPlaythrough: false, noPlayerDamage: false, physicsMode: "legacy", physicsDualRun: false };
  }

  const params = new URLSearchParams(window.location.search);
  const localQaAllowed =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";
  const qaPlaythrough =
    localQaAllowed &&
    (params.get("qa") === "1" || params.get("debug") === "qa" || params.get("debug") === "puzzle");

  return {
    qaPlaythrough,
    noPlayerDamage: qaPlaythrough || (localQaAllowed && params.get("noDamage") === "1"),
    physicsMode: params.get("physics") === "legacy" ? "legacy" : "rapier",
    physicsDualRun: params.get("physicsDual") === "1" || params.get("physicsParity") === "1",
  };
}
