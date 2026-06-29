import { Euler, Matrix4, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3 } from "three";
import {
  AgeGroundingPass,
  ageDefaultEscapeRoomVisualProfile,
  ageRoomLightBudgetFor,
  ageRoomVisualProfileFor,
  ageSelectRoomLights,
  type AgeEscapeRoomVisualProfile,
  type AgeGroundingQuad,
  type AgeGroundingVisualPolicy,
} from "@age/render-webgpu";
import type { HumanAgeRawParityStats } from "../../adapters/age/humanAgeDebugBridge";
import type { HumanAgeGroundingMode } from "../../adapters/age/humanAgeRuntimeFlags";
import { humanAgeContactsFromWorld } from "../../adapters/age/humanRuntimeBridge";
import { ageMaterialRoleForHumanMaterial } from "../../adapters/age/humanMaterialRoles";
import { modelKeyForEnemy, type EnemyModelKey } from "../../assets/enemyModelAssets";
import {
  enemyModelAltitude,
  enemyModelTargetHeight,
  shouldKeepRawEnemyBackupDuringFocusReveal,
  shouldRenderEnemyWithThreeOracle,
} from "../enemies/EnemyOraclePolicy";
import { bossPoseTuningForEnemy, bossVisualProfileForEnemy } from "../../game/config/bossVisualProfiles";
import { enemyArchetypes } from "../../game/config/enemyArchetypes";
import { defaultUltimateAbilityId, ultimateAbilityConfig } from "../../game/config/ultimateAbilityConfig";
import type { LevelSwitchDefinition } from "../../game/config/schema/levelConfig";
import { isExitCinematicViewActive } from "../../game/core/ExitCinematicView";
import type { GameWorld } from "../../game/core/GameWorld";
import { exitElevatorButtonVisualState, exitElevatorShaftVisualState } from "../../game/core/ExitCinematicTiming";
import { interactionFocusRevealRiseOffsetY } from "../../game/core/RenderVisibility";
import { isEnemyVisibleToPlayerRoom } from "../../game/core/RoomReachability";
import {
  BLOOM_BUFFER_BYTES,
  BLOOM_FLOATS,
  CAMERA_BUFFER_BYTES,
  CAMERA_FLOATS,
  CUBE_VERTEX_COUNT,
  DEPTH_FORMAT,
  FLOATS_PER_INSTANCE,
  FLOATS_PER_VERTEX,
  VERTEX_MATERIAL_INDEX_COMPONENT,
  HERO_FLOOR_VERTEX_FLOATS,
  INSTANCE_BUFFER_BYTES,
  LIGHT_BUFFER_BYTES,
  LIGHT_FLOATS,
  LIGHT_PROFILE_FLOATS,
  MAX_INSTANCES,
  MAX_ROBOT_JOINT_MATRICES,
  MAX_SHADER_LIGHTS,
  OFFSCREEN_COLOR_FORMAT,
  RAW_TEXTURE_ARRAY_PAGE_COUNT,
  ROBOT_JOINT_MATRIX_BUFFER_BYTES,
  ROBOT_JOINT_MATRIX_FLOATS,
  SHADOW_BUFFER_BYTES,
  SHADOW_DEPTH_FORMAT,
  SHADOW_FLOATS,
  SHADOW_MAP_SIZE,
  roleColors,
} from "./RawWebGpuConstants";
import { createShadowPlaneVertices, createUnitCubeVertices } from "./RawWebGpuGeometry";
import { isPickupWrapFaceNode } from "./pickupNodeVisibility";
import { isMuseumWallArtModelKey, isMuseumWallArtOverlayNode } from "./paintingNodeVisibility";
import { requestRawWebGpuDeviceBundle } from "./RawWebGpuDevice";
import {
  lightRadiusFor,
  lightTypeValue,
  rawCinematicDirectionalDirection,
  rawSelectedLightCandidatesForVisibleRooms,
  rawShaderLightsFor,
} from "./RawWebGpuLighting";
import { RAW_MATERIAL_FLOATS, rawMaterialFloatsFor } from "./RawWebGpuMaterialPipeline";
import { clamp, colorFromHex } from "./RawWebGpuMath";
import { createRawWebGpuBindGroupLayouts, createRawWebGpuPipelines } from "./RawWebGpuPipelines";
import {
  rawBloomEnabled,
  rawBloomRadius,
  rawBloomStrength,
  rawBloomThreshold,
  rawCinematicLookIntensity,
  rawColorPipelineV2Enabled,
  rawDisplayTransformEnabled,
  rawEnvBrightness,
  rawFxaaEnabled,
  rawFxaaStrength,
  rawFullEffectsEnabled,
  rawGlassOitEnabled,
  rawGpuProfileEnabled,
  rawLegacyGlassOverlayEnabled,
  rawLightingQualityScalar,
  rawLocalLightShapeTierScalar,
  rawMaterialResponseTierScalar,
  rawMipmapsEnabled,
  rawMuseumToeEnabled,
  rawAgxEnabled,
  rawCubeEnabled,
  rawIblEnabled,
  rawIblIntensity,
  rawPixelRatioOverride,
  rawPostProcessEnabled,
  rawRenderBundlesEnabled,
  rawRoomAoTierScalar,
  rawSoftParticlesEnabled,
  rawRoomProbeTierScalar,
  rawGroundingStrength,
  rawShadowDebugEnabled,
  rawShadowMapEnabled,
  rawShadowStrength,
} from "./RawWebGpuQuality";
import { resolveRawMuseumEnvProfile } from "./RawMuseumEnvProfile";
import {
  canUseRigidNodePalette,
  canUseRawEnemyBakedAnimation,
  enemyTintFor,
  pickupGeometryForType,
  planShadowFor,
  rawEnemyAttackKick,
} from "./RawWebGpuRuntimeHelpers";
import { RawGlassOitPass } from "./RawGlassOitPass";
import { RawGpuParticlePass } from "./RawGpuParticlePass";
import { RawGpuProfiler } from "./RawGpuProfiler";
import { RawGroundingPass } from "./RawGroundingPass";
import { RawProjectileVfxPass } from "./RawProjectileVfxPass";
import { isRawTransparentDrawBatch, rawInstanceShouldRemainOpaque, rawTransparentInstanceIdSet, rawTransparentMaterialIndexSet } from "./RawTransparentBatchPolicy";
import { RawViewmodelPass, type RawViewmodelFrame, type RawViewmodelReadiness } from "./RawViewmodelPass";
import { resolveEffectiveRawViewmodelMode, type RawViewmodelMode } from "./RawViewmodelMode";
import { resolveRawThreeEnemyOracleModeFromParams, rawThreeEnemyOracleOnlyEnabledFromParams } from "./RawEnemyOracleMode";
import { createRawRobotAnimationSampler, type RawRobotAnimationBridge, type RawRobotAnimationSampler } from "./RawRobotAnimationBridge";
import { RawRoomRuntime } from "./RawRoomRuntime";
import { RawTransparentMaterialPass } from "./RawTransparentMaterialPass";
import {
  createRawBaseColorTextureArray,
  createRawHeroFloorTexture,
  createRawMaterialTextureArray,
  createSolidRawTexture,
  createTextureViewWithValidation,
} from "./RawWebGpuTextureResources";
import { createRawIblResources, type RawIblResources } from "./RawWebGpuIbl";
import { createRawVisualDirector, type RawVisualDirector } from "./RawVisualDirector";
import type { RawCookedGltfLoaderManifest } from "./RawCookedGltfLoaderManifest";
import type {
  GpuGlobals,
  RawDrawBatch,
  RawPlanGeometryAsset,
  RawPlanInstance,
  RawPlanLight,
  RawPlanState,
  RawRenderPlan,
  Tuple3,
  Tuple4,
} from "./RawWebGpuTypes";
import level03MuseumFloorTextureUrl from "../../assets/textures/environment/builder-surfaces/white_marble_color.webp?url";

const HERO_FLOOR_Y = 0.018;
const RAW_ENEMY_HIDE_DEATH_AGE = 1.05;
const INSTANCE_ANIM_DISABLED: Tuple4 = [0, 0, 0, 0];

// Consecutive getCurrentTexture() failures tolerated before the renderer gives
// up and lets the canvas tick loop fall back to Three.js. Transient surface
// loss (tab backgrounded, GPU reset) recovers within a frame or two; a real
// device loss stays broken and escalates after ~0.5s of 60fps frames.
const RAW_SURFACE_ACQUIRE_FAILURE_LIMIT = 30;
const rawCanvasTextureUsage = () => {
  const gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  return gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT | gpuGlobals.GPUTextureUsage.COPY_DST;
};
// Reveal-synced door lift timing (seconds into the focus reveal). The reveal
// camera ramps in over ~0.6s; start the lift as it arrives, then ease it over
// ~1.4s so the slow-open plays during the camera hold (door reveals run ~2.6s).
const REVEAL_DOOR_LIFT_START = 0.45;
const REVEAL_DOOR_LIFT_DURATION = 1.45;
const AUTHORED_MATERIAL_INSTANCE_COLOR: Tuple4 = [1, 1, 1, 0];
// The wall switch GLB is runtime/glTF Y-up. Z is wall depth, so lever travel
// must stay on local Y; moving local Z pushes the handle into/out of the wall.
const WALL_DOOR_SWITCH_LEVER_DOWN_OFFSET_Y = -0.34;

function pickupColorForType(type: GameWorld["pickups"][number]["type"]): Tuple4 {
  if (type === "coreCell") return roleColors.pickup_coreCell;
  if (type === "ironRod") return roleColors.pickup_ironRod;
  if (type === "pistol") return roleColors.pickup_pistol;
  if (type === "breachMissile") return roleColors.pickup_breachMissile;
  return roleColors.pickup_repairKit;
}

function isExitElevatorButtonMotionChunk(nodeName: string | null | undefined) {
  return /service_elevator_call_button_(?:plunger|glass_ring)/i.test(nodeName ?? "");
}

function isWallDoorSwitchModelKey(modelKey: string | null | undefined) {
  return modelKey === "hp_wall_door_switch_button_v1";
}

function isWallDoorSwitchLeverMotionChunk(nodeName: string | null | undefined) {
  // Only the sliding grip assembly moves. The bearing discs/collar/center pin
  // are fixed hardware, otherwise the switch looks like its axle breaks loose.
  return /^wall_switch_lever_movable_(?:short_upper_pull_rod|top_grip_cap|lower_stop_cap|slider_yoke)/i.test(nodeName ?? "");
}

function isExitElevatorButtonRawHiddenChunk(nodeName: string | null | undefined) {
  return /service_elevator_call_button_visible_spring/i.test(nodeName ?? "");
}

function isExitElevatorRuntimeMotionChunk(nodeName: string | null | undefined) {
  return isExitElevatorButtonMotionChunk(nodeName) || isExitElevatorShaftMotionChunk(nodeName);
}

function isExitElevatorStageModelKey(modelKey: string | null | undefined) {
  return modelKey === "service_elevator_exit_stage" || modelKey === "builder:prop:service_elevator_exit_stage";
}

function isServiceElevatorAuthoredModelKey(modelKey: string | null | undefined) {
  return (
    isExitElevatorStageModelKey(modelKey) ||
    modelKey === "service_elevator_interior_shell" ||
    modelKey === "builder:prop:service_elevator_interior_shell" ||
    modelKey === "door_threshold_service_elevator" ||
    modelKey === "builder:prop:door_threshold_service_elevator" ||
    modelKey === "service_elevator_call_buttons" ||
    modelKey === "builder:prop:service_elevator_call_buttons" ||
    modelKey === "service_elevator_ascent_shaft_fx" ||
    modelKey === "builder:prop:service_elevator_ascent_shaft_fx"
  );
}

function isExitElevatorCallButtonModelKey(modelKey: string | null | undefined) {
  return isExitElevatorStageModelKey(modelKey) || modelKey === "service_elevator_call_buttons" || modelKey === "builder:prop:service_elevator_call_buttons";
}

function isExitElevatorShaftMotionChunk(nodeName: string | null | undefined) {
  return /service_elevator_ascent_shaft_moving_/i.test(nodeName ?? "");
}

function isExitElevatorShaftChunk(nodeName: string | null | undefined) {
  return /service_elevator_ascent_shaft_/i.test(nodeName ?? "");
}

function isExitElevatorShaftModelKey(modelKey: string | null | undefined) {
  return isExitElevatorStageModelKey(modelKey) || modelKey === "service_elevator_ascent_shaft_fx" || modelKey === "builder:prop:service_elevator_ascent_shaft_fx";
}

function rawThreeEnemyOracleOnlyEnabled() {
  return rawThreeEnemyOracleOnlyEnabledFromParams(new URLSearchParams(window.location.search));
}

function rawEnemyHandledByThreeOracle(world: GameWorld, enemy: GameWorld["enemies"][number]) {
  if (shouldKeepRawEnemyBackupDuringFocusReveal(world, enemy)) return false;
  const params = new URLSearchParams(window.location.search);
  if (!resolveRawThreeEnemyOracleModeFromParams(params).enabled) return false;
  const modelKey = modelKeyForEnemy(enemy);
  return Boolean(modelKey && shouldRenderEnemyWithThreeOracle(enemy, modelKey));
}

function rawCoreCellNodeHidden(nodeName: string | null | undefined) {
  // Hide every pickup's image2 "wrap" face nodes (they render as black spikes in
  // this pass). Shared with the cook policy + locked by pickupSpikeGuard.test.ts.
  return isPickupWrapFaceNode(nodeName);
}

type WallDoorSwitchLeverPosition = "up" | "down";

function wallDoorSwitchLeverOffsetForPosition(position: WallDoorSwitchLeverPosition) {
  return position === "down" ? WALL_DOOR_SWITCH_LEVER_DOWN_OFFSET_Y : 0;
}

function wallDoorSwitchLeverPositionForState(definition: LevelSwitchDefinition, stateId: string | null): WallDoorSwitchLeverPosition {
  // The lever visual is tied to the switch state slot, not the door actions.
  // Inverse-door states may both open and close doors, so action counts or
  // messages are not stable enough to decide whether the handle is up/down.
  const stateIndex = definition.states.findIndex((candidate) => candidate.id === stateId);
  return stateIndex > 0 && stateIndex % 2 === 1 ? "down" : "up";
}

function rawEnemyRenderable(enemy: GameWorld["enemies"][number]) {
  return enemy.isAlive || enemy.deathAge < RAW_ENEMY_HIDE_DEATH_AGE;
}

function modelInstanceColorForPlanInstance(instance: RawPlanInstance): Tuple4 {
  return isServiceElevatorAuthoredModelKey(instance.modelKey) ? AUTHORED_MATERIAL_INSTANCE_COLOR : (roleColors[instance.role] ?? roleColors.prop);
}

function mixTuple3(left: Tuple3, right: Tuple3, amount: number): Tuple3 {
  const t = clamp(amount, 0, 1);
  return [left[0] * (1 - t) + right[0] * t, left[1] * (1 - t) + right[1] * t, left[2] * (1 - t) + right[2] * t];
}

// Newly-spawned enemies scale + rise into view over ~0.55s (ease-out) instead of
// popping in at full size — the "本来没有的怪慢慢出现" reveal, symmetric to the death fade.
const RAW_ENEMY_SPAWN_REVEAL_SEC = 0.55;
function enemySpawnProgress(enemy: GameWorld["enemies"][number]) {
  if (!enemy.isAlive) return 1;
  const p = Math.min(1, Math.max(0, enemy.spawnAge / RAW_ENEMY_SPAWN_REVEAL_SEC));
  return 1 - (1 - p) * (1 - p);
}

function rawEnemyStaggerPoseAmount(enemy: GameWorld["enemies"][number]) {
  if (enemy.staggerTotal <= 0 || enemy.staggerRemaining <= 0) return 0;
  const progress = Math.min(1, Math.max(0, 1 - enemy.staggerRemaining / enemy.staggerTotal));
  return Math.sin(progress * Math.PI) * (enemy.tier === "boss" ? 1.18 : 0.92);
}

function rotateLocalXZ(originX: number, originZ: number, localX: number, localZ: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [originX + localX * c + localZ * s, originZ - localX * s + localZ * c];
}

export class RawWebGpuLevelRenderer {
  private readonly gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  private readonly context: any;
  private readonly device: any;
  private readonly format: string;
  private readonly plan: RawRenderPlan;
  private readonly geometryAssets: Map<string, RawPlanGeometryAsset>;
  private readonly lightById: Map<string, RawPlanLight>;
  private readonly sortedPlanInstances: RawPlanInstance[];
  private readonly roomRuntime: RawRoomRuntime;
  private readonly visualDirector: RawVisualDirector;
  private readonly pipeline: any;
  private readonly offscreenPipeline: any;
  private readonly shadowMapPipeline: any;
  private readonly glassOverlayPipeline: any;
  private readonly offscreenGlassOverlayPipeline: any;
  private readonly glassOitAccumPipeline: any;
  private readonly glassOitResolvePipeline: any;
  private readonly offscreenGlassOitResolvePipeline: any;
  private readonly transparentPipeline: any;
  private readonly offscreenTransparentPipeline: any;
  private readonly shadowPipeline: any;
  private readonly offscreenShadowPipeline: any;
  private readonly bloomPipeline: any;
  private readonly bloomBindGroupLayout: any;
  private readonly heroFloorPipeline: any;
  private readonly offscreenHeroFloorPipeline: any;
  private readonly heroFloorBindGroupLayout: any;
  private readonly materialTextureBindGroupLayout: any;
  private readonly glassOitBindGroupLayout: any;
  private readonly bindGroup: any;
  private readonly shadowBindGroup: any;
  private readonly materialTextureBindGroup: any;
  private readonly heroFloorBindGroup: any;
  private readonly heroFloorPaddingBindGroup: any;
  private bloomBindGroup: any = null;
  private readonly geometryVertexBuffer: any;
  private readonly proxyVertexBuffer: any;
  private readonly shadowVertexBuffer: any;
  private readonly heroFloorVertexBuffer: any;
  private readonly heroFloorVertexCount: number;
  private readonly heroFloorTexture: any;
  private readonly heroFloorPaddingTexture: any;
  private readonly baseColorTexturePages: any[];
  private readonly materialTexturePages: any[];
  private readonly materialBuffer: any;
  private readonly instanceBuffer: any;
  private readonly robotJointMatrixBuffer: any;
  private readonly cameraBuffer: any;
  private readonly lightingBuffer: any;
  private readonly shadowBuffer: any;
  private readonly bloomBuffer: any;
  private readonly shadowSampler: any;
  private readonly bloomSampler: any;
  private readonly baseColorTextureSampler: any;
  private readonly cameraFloats = new Float32Array(CAMERA_FLOATS);
  private readonly lightingFloats = new Float32Array(LIGHT_FLOATS);
  private readonly shadowFloats = new Float32Array(SHADOW_FLOATS);
  private readonly bloomFloats = new Float32Array(BLOOM_FLOATS);
  private readonly instanceFloats = new Float32Array(MAX_INSTANCES * FLOATS_PER_INSTANCE);
  private readonly robotJointMatrixFloats = new Float32Array(MAX_ROBOT_JOINT_MATRICES * ROBOT_JOINT_MATRIX_FLOATS);
  private readonly viewProjection = new Matrix4();
  private readonly shadowViewProjection = new Matrix4();
  private readonly modelMatrix = new Matrix4();
  private readonly enemyBaseModelMatrix = new Matrix4();
  private readonly enemyChunkDeltaMatrix = new Matrix4();
  private readonly enemyChunkInverseBindMatrix = new Matrix4();
  private readonly enemyChunkDeltaPosition = new Vector3();
  private readonly enemyChunkDeltaRotation = new Quaternion();
  private readonly enemyChunkDeltaScale = new Vector3();
  private readonly robotJointMatrix = new Matrix4();
  private readonly identityMatrix = new Matrix4();
  private readonly rootMatrix = new Matrix4();
  private readonly localOffsetMatrix = new Matrix4();
  private readonly localScaleMatrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly localOffset = new Vector3();
  private readonly scale = new Vector3();
  private readonly euler = new Euler();
  private readonly identityRotation = new Quaternion();
  private readonly rotation = new Quaternion();
  private readonly shadowCamera = new OrthographicCamera(-14, 14, 14, -14, 0.5, 60);
  private readonly transparentMaterialPass: RawTransparentMaterialPass;
  private readonly glassOitPass: RawGlassOitPass;
  private readonly gpuParticlePass: RawGpuParticlePass;
  private readonly projectileVfxPass: RawProjectileVfxPass;
  private readonly gpuProfiler: RawGpuProfiler;
  private readonly groundingPass: RawGroundingPass;
  private readonly robotAnimationSampler: RawRobotAnimationSampler | null;
  private readonly geometryVertexFloats: Float32Array;
  private readonly transparentMaterialIndices: Set<number>;
  private readonly transparentInstanceIds: Set<string>;
  private readonly transparentRangeCache = new Map<string, boolean>();
  private readonly drawBatches: RawDrawBatch[] = [];
  private readonly staticDrawBatches: RawDrawBatch[] = [];
  // Clean snapshot of staticDrawBatches' draw params for the render bundle.
  // Taken before the dynamic writer runs, so a dynamic batch merging into the
  // last static batch (when no static shadow batch separates them) can never
  // corrupt the params the bundle baked. Only populated when bundles are on.
  private readonly staticBundleBatches: RawDrawBatch[] = [];
  private depthTexture: any = null;
  private depthView: any = null;
  private shadowDepthTexture: any = null;
  private shadowDepthView: any = null;
  private dummyShadowDepthTexture: any = null;
  private dummyShadowDepthView: any = null;
  private colorTexture: any = null;
  private colorView: any = null;
  private width = 0;
  private height = 0;
  // Contact/grounding shadow multiplier (?rawGrounding=N). Read once per session.
  private readonly groundingScale = rawGroundingStrength();
  private postProcessEnabled = false;
  private lastStaticVisibilityKey = "";
  private lastLightingKey = "";
  private readonly doorVisualProgress = new Map<string, number>();
  /** Last GameWorld transition revision consumed per door. */
  private readonly doorTransitionRevision = new Map<string, number>();
  /**
   * Per-door lift animation taken from that door's leaf instance. The separate
   * door-status / hardware panel (role "door_panel") carries no animation of its
   * own, so it must reuse the leaf's lift to track it instead of floating in the
   * doorway after the leaf rises out of view.
   */
  private readonly doorLeafAnimation = new Map<string, RawPlanState["openAnimation"]>();
  /**
   * Per-door "hide closed hardware after open" policy, taken from the leaf. Used
   * to also retire the door-status / hardware panel once the door is open so it
   * does not hover (lifted) above the doorway.
   */
  private readonly doorHideHardware = new Map<string, boolean>();
  /** Stable lookup passed to the room runtime to gate door-leaf hiding on lift. */
  private readonly doorProgressLookup = (doorId: string) => this.doorVisualProgress.get(doorId) ?? 1;
  /** Stable lookup passed to the room runtime to retire door-status hardware on open. */
  private readonly doorHideHardwareLookup = (doorId: string) => this.doorHideHardware.get(doorId) ?? false;
  private lastDoorVisualUpdateMs = 0;
  private doorVisualAnimating = false;
  private lastWallDoorSwitchVisualKey = "";
  private staticInstanceCount = 0;
  private staticInstanceFloatCount = 0;
  private robotJointMatrixCount = 0;
  // Cached GPURenderBundle of the static opaque batches (rawRenderBundles flag).
  // Invalidated (set null) whenever the static draw params change (visibility)
  // or the pass format changes (resize / postProcess toggle); rebuilt lazily.
  private staticRenderBundle: any = null;
  private disposed = false;
  private surfaceAcquireFailures = 0;
  private readonly viewmodelPass = new RawViewmodelPass();
  private viewmodelMode: RawViewmodelMode = "off";
  private viewmodelFrame: RawViewmodelFrame = { instanceCount: 0, batches: [] };
  private ageVisualProfile: AgeEscapeRoomVisualProfile | null = null;
  private ageGroundingMode: HumanAgeGroundingMode = "off";
  private readonly ageGroundingPass = new AgeGroundingPass();
  private ageGroundingPolicy: AgeGroundingVisualPolicy = ageDefaultEscapeRoomVisualProfile.grounding;
  private ageGroundingFailed = false;
  private ageGroundingQuadCount = 0;
  private dynamicShadowPlaneCount = 0;

  private constructor(
    canvas: HTMLCanvasElement,
    device: any,
    context: any,
    format: string,
    plan: RawRenderPlan,
    geometryBuffer: ArrayBuffer,
    heroFloorTexture: any,
    baseColorTexturePages: any[],
    materialTexturePages: any[],
    iblResources: RawIblResources,
    robotAnimationBridge: RawRobotAnimationBridge | null,
    cookedGltfLoaderManifest: RawCookedGltfLoaderManifest | null,
  ) {
    this.device = device;
    this.context = context;
    this.format = format;
    this.plan = plan;
    this.geometryAssets = new Map((plan.geometry?.assets ?? []).filter((asset) => asset.status === "ready").map((asset) => [asset.modelKey, asset]));
    this.lightById = new Map((plan.lights ?? []).map((light) => [light.id, light]));
    this.sortedPlanInstances = [...plan.instances].sort((left, right) => this.comparePlanInstanceDrawOrder(left, right));
    for (const instance of plan.instances) {
      if (instance.role === "door_leaf" && instance.state?.doorId) {
        if (instance.state.openAnimation) {
          this.doorLeafAnimation.set(instance.state.doorId, instance.state.openAnimation);
        }
        this.doorHideHardware.set(
          instance.state.doorId,
          Boolean(instance.state.openVisualPolicy?.hideClosedHardwareAfterOpen),
        );
      }
    }
    this.roomRuntime = new RawRoomRuntime(plan);
    this.visualDirector = createRawVisualDirector(plan);
    this.transparentMaterialPass = new RawTransparentMaterialPass(plan, cookedGltfLoaderManifest);
    this.groundingPass = new RawGroundingPass();
    this.robotAnimationSampler = createRawRobotAnimationSampler(robotAnimationBridge);
    this.geometryVertexFloats = new Float32Array(geometryBuffer);
    this.transparentMaterialIndices = rawTransparentMaterialIndexSet(plan);
    this.transparentInstanceIds = rawTransparentInstanceIdSet(plan);

    this.geometryVertexBuffer = this.createGeometryVertexBuffer(geometryBuffer);
    this.proxyVertexBuffer = this.createProxyVertexBuffer();
    this.shadowVertexBuffer = this.createShadowVertexBuffer();
    const heroFloor = this.createHeroFloorVertexBuffer();
    this.heroFloorVertexBuffer = heroFloor.buffer;
    this.heroFloorVertexCount = heroFloor.vertexCount;
    this.heroFloorTexture = heroFloorTexture;
    this.heroFloorPaddingTexture = createSolidRawTexture(device, [0, 0, 0, 255]);
    this.baseColorTexturePages = baseColorTexturePages;
    this.materialTexturePages = materialTexturePages;
    this.materialBuffer = this.createMaterialBuffer(plan);
    this.instanceBuffer = device.createBuffer({
      size: INSTANCE_BUFFER_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.STORAGE | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.robotJointMatrixBuffer = device.createBuffer({
      size: ROBOT_JOINT_MATRIX_BUFFER_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.STORAGE | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.cameraBuffer = device.createBuffer({
      size: CAMERA_BUFFER_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.UNIFORM | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.lightingBuffer = device.createBuffer({
      size: LIGHT_BUFFER_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.UNIFORM | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.shadowBuffer = device.createBuffer({
      size: SHADOW_BUFFER_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.UNIFORM | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.bloomBuffer = device.createBuffer({
      size: BLOOM_BUFFER_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.UNIFORM | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.shadowSampler = device.createSampler({
      compare: "less-equal",
      magFilter: "linear",
      minFilter: "linear",
    });
    this.bloomSampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });
    // Trilinear + anisotropic filtering only takes effect when the textures
    // carry a mip chain (rawMipmaps); maxAnisotropy requires all three filters
    // to be linear. Spread an empty object on the default path → byte-identical.
    const mipSamplerOptions = rawMipmapsEnabled() ? { mipmapFilter: "linear", maxAnisotropy: 8 } : {};
    this.baseColorTextureSampler = device.createSampler({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      ...mipSamplerOptions,
    });
    this.createShadowDepthResources();

    const bindGroupLayouts = createRawWebGpuBindGroupLayouts(device);
    const bindGroupLayout = bindGroupLayouts.scene;
    this.bloomBindGroupLayout = bindGroupLayouts.bloom;
    this.heroFloorBindGroupLayout = bindGroupLayouts.heroFloor;
    this.materialTextureBindGroupLayout = bindGroupLayouts.materialTextures;
    this.glassOitBindGroupLayout = bindGroupLayouts.glassOit;
    this.glassOitPass = new RawGlassOitPass(device, this.glassOitBindGroupLayout, plan, cookedGltfLoaderManifest);
    this.gpuParticlePass = new RawGpuParticlePass(device, format);
    this.projectileVfxPass = new RawProjectileVfxPass(device, format);
    this.gpuProfiler = new RawGpuProfiler(device, rawGpuProfileEnabled());

    const pipelines = createRawWebGpuPipelines(device, format, bindGroupLayouts);
    this.pipeline = pipelines.sceneCanvas;
    this.offscreenPipeline = pipelines.sceneOffscreen;

    this.glassOverlayPipeline = pipelines.glassOverlayCanvas;
    this.offscreenGlassOverlayPipeline = pipelines.glassOverlayOffscreen;
    this.glassOitAccumPipeline = pipelines.glassOitAccum;
    this.glassOitResolvePipeline = pipelines.glassOitResolveCanvas;
    this.offscreenGlassOitResolvePipeline = pipelines.glassOitResolveOffscreen;
    this.transparentPipeline = pipelines.transparentCanvas;
    this.offscreenTransparentPipeline = pipelines.transparentOffscreen;
    this.shadowMapPipeline = pipelines.shadowMap;
    this.shadowPipeline = pipelines.contactShadowCanvas;
    this.offscreenShadowPipeline = pipelines.contactShadowOffscreen;
    this.heroFloorPipeline = pipelines.heroFloorCanvas;
    this.offscreenHeroFloorPipeline = pipelines.heroFloorOffscreen;
    this.bloomPipeline = pipelines.bloomComposite;

    // Scene samples the real shadow map only when projected shadows are opted in
    // (?rawShadowMap=1); otherwise the empty dummy depth → no shadowing (default).
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
        { binding: 2, resource: { buffer: this.lightingBuffer } },
        { binding: 3, resource: { buffer: this.shadowBuffer } },
        { binding: 4, resource: rawShadowMapEnabled() ? this.shadowDepthView : this.dummyShadowDepthView },
        { binding: 5, resource: this.shadowSampler },
        { binding: 6, resource: { buffer: this.materialBuffer } },
        { binding: 7, resource: { buffer: this.robotJointMatrixBuffer } },
      ],
    });

    this.shadowBindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
        { binding: 2, resource: { buffer: this.lightingBuffer } },
        { binding: 3, resource: { buffer: this.shadowBuffer } },
        { binding: 4, resource: this.dummyShadowDepthView },
        { binding: 5, resource: this.shadowSampler },
        { binding: 6, resource: { buffer: this.materialBuffer } },
        { binding: 7, resource: { buffer: this.robotJointMatrixBuffer } },
      ],
    });
    this.materialTextureBindGroup = device.createBindGroup({
      layout: this.materialTextureBindGroupLayout,
      entries: [
        ...Array.from({ length: RAW_TEXTURE_ARRAY_PAGE_COUNT }, (_, page) => ({
          binding: page,
          resource: this.baseColorTexturePages[page].createView({
            label: `hp.raw.base-color-texture-array-view.page-${page}`,
            dimension: "2d-array",
          }),
        })),
        { binding: RAW_TEXTURE_ARRAY_PAGE_COUNT, resource: this.baseColorTextureSampler },
        ...Array.from({ length: RAW_TEXTURE_ARRAY_PAGE_COUNT }, (_, page) => ({
          binding: RAW_TEXTURE_ARRAY_PAGE_COUNT + 1 + page,
          resource: this.materialTexturePages[page].createView({
            label: `hp.raw.material-texture-array-view.page-${page}`,
            dimension: "2d-array",
          }),
        })),
        { binding: RAW_TEXTURE_ARRAY_PAGE_COUNT * 2 + 1, resource: iblResources.specularCubeView },
        { binding: RAW_TEXTURE_ARRAY_PAGE_COUNT * 2 + 2, resource: iblResources.specularSampler },
        { binding: RAW_TEXTURE_ARRAY_PAGE_COUNT * 2 + 3, resource: iblResources.brdfLutView },
        { binding: RAW_TEXTURE_ARRAY_PAGE_COUNT * 2 + 4, resource: iblResources.brdfLutSampler },
      ],
    });
    const heroFloorSampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      ...mipSamplerOptions,
    });
    this.heroFloorBindGroup = device.createBindGroup({
      layout: this.heroFloorBindGroupLayout,
      entries: [
        { binding: 0, resource: createTextureViewWithValidation(this.device, "hp.raw.hero-floor-view", this.heroFloorTexture) },
        { binding: 1, resource: heroFloorSampler },
      ],
    });
    this.heroFloorPaddingBindGroup = device.createBindGroup({
      layout: this.bloomBindGroupLayout,
      entries: [
        { binding: 0, resource: createTextureViewWithValidation(this.device, "hp.raw.hero-floor-padding-view", this.heroFloorPaddingTexture) },
        { binding: 1, resource: this.bloomSampler },
        { binding: 2, resource: { buffer: this.bloomBuffer } },
      ],
    });

    this.resize(canvas, 1, rawBloomEnabled() || rawFxaaEnabled());
  }

  static async create(
    canvas: HTMLCanvasElement,
    plan: RawRenderPlan,
    geometryBuffer: ArrayBuffer,
    robotAnimationBridge: RawRobotAnimationBridge | null,
    cookedGltfLoaderManifest: RawCookedGltfLoaderManifest | null = null,
  ) {
    const { device, format } = await requestRawWebGpuDeviceBundle();
    const context = canvas.getContext("webgpu") as any;
    if (!context) {
      throw new Error("Could not create a WebGPU canvas context.");
    }
    device.pushErrorScope?.("validation");
    context.configure({
      device,
      format,
      alphaMode: "opaque",
      usage: rawCanvasTextureUsage(),
    });
    device.popErrorScope?.().then?.((error: { message?: string } | null) => {
      if (error) console.warn("[HumanProtocol] Raw WebGPU canvas configure error.", error.message ?? error);
    });
    const [heroFloorTexture, baseColorTexturePages, materialTexturePages, iblResources] = await Promise.all([
      createRawHeroFloorTexture(device, level03MuseumFloorTextureUrl),
      createRawBaseColorTextureArray(device, plan),
      createRawMaterialTextureArray(device, plan),
      createRawIblResources(device),
    ]);
    return new RawWebGpuLevelRenderer(
      canvas,
      device,
      context,
      format,
      plan,
      geometryBuffer,
      heroFloorTexture,
      baseColorTexturePages,
      materialTexturePages,
      iblResources,
      robotAnimationBridge,
      cookedGltfLoaderManifest,
    );
  }

  /**
   * Resolves the first-person weapon mode. The retired native raw weapon path
   * always falls back to the Three/R3F new-equipment overlay, even when cooked
   * utility viewmodel geometry exists in the plan.
   */
  configureViewmodel(requestedMode: RawViewmodelMode): { mode: RawViewmodelMode } & RawViewmodelReadiness {
    const readiness = this.viewmodelPass.configure(this.geometryAssets);
    this.viewmodelMode = resolveEffectiveRawViewmodelMode(requestedMode, readiness);
    return { mode: this.viewmodelMode, ...readiness };
  }

  /**
   * Opt-in AGE integration (set from RawWebGpuCanvas based on URL flags).
   * With everything off this renderer behaves exactly as before.
   */
  configureAgeIntegration(options: {
    visualProfile?: AgeEscapeRoomVisualProfile | null;
    groundingMode?: HumanAgeGroundingMode;
  }) {
    this.ageVisualProfile = options.visualProfile ?? null;
    this.ageGroundingMode = options.groundingMode ?? "off";
    this.ageGroundingPolicy = this.ageVisualProfile?.grounding ?? ageDefaultEscapeRoomVisualProfile.grounding;
    this.ageGroundingFailed = false;
    this.lastLightingKey = "";
    if (this.ageVisualProfile) {
      this.applyAgeMaterialRoleTuning(this.ageVisualProfile);
    }
  }

  /** Snapshot of raw-renderer counts for the ?ageBridge=1 parity overlay. */
  ageDebugParityStats(world: GameWorld): HumanAgeRawParityStats {
    const frame = this.roomRuntime.frame(world);
    return {
      currentRoomId: frame.currentRoomId,
      visibleRooms: frame.visibleRoomIds.size,
      visibleDoors: frame.visibleDoorIds.size,
      selectedLights: frame.scenario?.selectedLights.length ?? 0,
      staticInstances: this.staticInstanceCount,
      drawBatches: this.drawBatches.length,
      dynamicShadowPlanes: this.dynamicShadowPlaneCount,
      ageGroundingQuads: this.ageGroundingQuadCount,
      ageGroundingMode: this.ageGroundingMode,
      ageGroundingFailed: this.ageGroundingFailed,
    };
  }

  /**
   * Re-packs the material buffer through the existing material pipeline and
   * applies AGE role tuning (emissive boost) per semantic visual role. One
   * buffer upload at configure time; no per-frame cost.
   */
  private applyAgeMaterialRoleTuning(profile: AgeEscapeRoomVisualProfile) {
    const boostByRole = new Map(profile.roleTuning.map((tuning) => [tuning.role, tuning.emissiveBoost]));
    const floats = rawMaterialFloatsFor(this.plan);
    let changed = false;
    for (const material of this.plan.geometry?.materials ?? []) {
      const boost = boostByRole.get(ageMaterialRoleForHumanMaterial(material));
      if (!boost || boost === 1 || !Number.isFinite(material.index) || material.index < 0) continue;
      const strengthIndex = material.index * RAW_MATERIAL_FLOATS + 7;
      if (strengthIndex >= floats.length) continue;
      floats[strengthIndex] = clamp(floats[strengthIndex] * boost, 0, 4);
      changed = true;
    }
    if (changed) {
      this.device.queue.writeBuffer(this.materialBuffer, 0, floats);
    }
  }

  /**
   * Plans grounded contact-shadow quads through the AGE grounding pass from
   * the shared gameplay contact records. Returns null when the AGE path is
   * off or has failed, which reverts to the raw inline shadow planes.
   */
  private planAgeGroundingQuads(world: GameWorld, hideEnemies: boolean): AgeGroundingQuad[] | null {
    if (this.ageGroundingMode === "off" || this.ageGroundingFailed) return null;
    try {
      const contacts = hideEnemies
        ? humanAgeContactsFromWorld(world).filter((contact) => contact.kind !== "character")
        : humanAgeContactsFromWorld(world);
      return this.ageGroundingPass.planQuads(contacts, this.ageGroundingPolicy);
    } catch (error) {
      this.ageGroundingFailed = true;
      console.warn("[HumanProtocol] AGE grounding planning failed; reverting to raw contact shadows.", error);
      return null;
    }
  }

  render(canvas: HTMLCanvasElement, world: GameWorld, camera: PerspectiveCamera) {
    if (this.disposed) return;

    const pixelRatio = this.pixelRatioFor(world);
    const bloomEnabled = rawBloomEnabled();
    const fxaaEnabled = rawFxaaEnabled();
    // Keep raw museum QA on the direct canvas path until the offscreen
    // post-process pipeline is repaired; an invalid offscreen pipeline poisons
    // the command buffer before the scene can be judged visually.
    const postProcessEnabled = rawPostProcessEnabled();
    this.resize(canvas, pixelRatio, postProcessEnabled);
    this.writeCamera(camera, world, postProcessEnabled);
    this.writeLighting(world);
    const instanceCount = this.writeInstances(world);
    this.viewmodelFrame =
      this.viewmodelMode === "raw"
        ? this.viewmodelPass.writeInstances(world, camera, this.instanceFloats, instanceCount, MAX_INSTANCES, this.device, this.instanceBuffer)
        : { instanceCount: 0, batches: [] };
    this.writeShadowCamera(world);
    this.projectileVfxPass.update(camera, world, this.viewProjection.elements);
    this.gpuParticlePass.update(camera, world, this.viewProjection.elements);
    if (postProcessEnabled) {
      this.writeBloom(world, bloomEnabled, fxaaEnabled);
    }

    let currentTexture: any;
    try {
      currentTexture = this.context.getCurrentTexture();
      this.surfaceAcquireFailures = 0;
    } catch (error) {
      // The surface was transiently lost (tab backgrounded, GPU reset, surface
      // resized out from under us). Re-configure and skip this frame instead of
      // letting the first throw propagate to the canvas tick loop, which would
      // permanently swap the raw backend for Three.js. Escalate only once the
      // surface has stayed dead for RAW_SURFACE_ACQUIRE_FAILURE_LIMIT frames.
      this.surfaceAcquireFailures += 1;
      try {
        this.context.configure({ device: this.device, format: this.format, alphaMode: "opaque", usage: rawCanvasTextureUsage() });
      } catch {
        // configure() can also throw on a fully lost device; the streak guard
        // below escalates to the Three.js fallback when recovery is impossible.
      }
      if (this.surfaceAcquireFailures >= RAW_SURFACE_ACQUIRE_FAILURE_LIMIT) {
        throw error instanceof Error ? error : new Error("Raw WebGPU surface acquisition failed.");
      }
      return;
    }
    const currentTextureView = currentTexture.createView();
    const sceneTargetView = postProcessEnabled ? this.colorView : currentTextureView;
    const encoder = this.device.createCommandEncoder();
    this.gpuProfiler.beginFrame();
    this.gpuParticlePass.encodeCompute(
      encoder,
      this.gpuParticlePass.activeThisFrame ? this.gpuProfiler.timestampWrites("compute") : undefined,
    );
    // Projected shadow-map pass: opt-in via ?rawShadowMap=1. Renders the light's
    // depth into shadowDepthView so the scene pass (bindGroup binding 4) samples
    // real shadows. Default off → pass skipped, scene samples the dummy depth.
    if (rawShadowMapEnabled()) this.encodeShadowMapPass(encoder);
    this.encodeScenePass(encoder, world, sceneTargetView, postProcessEnabled);
    if (this.viewmodelFrame.batches.length > 0) {
      this.encodeViewmodelPass(encoder, sceneTargetView, postProcessEnabled);
    }
    if (postProcessEnabled && this.bloomBindGroup) {
      this.encodeBloomCompositePass(encoder, currentTextureView);
    }

    this.gpuProfiler.resolve(encoder);
    this.device.queue.submit([encoder.finish()]);
    this.gpuProfiler.collect();
  }

  /** Per-pass GPU timing overlay text (null unless `?rawGpuProfile=1` is active). */
  gpuProfileOverlayText(): string | null {
    return this.gpuProfiler.latestSummary();
  }

  private encodeShadowMapPass(encoder: any) {
    const shadowPass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowDepthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    shadowPass.setPipeline(this.shadowMapPipeline);
    // shadowMap uses scenePipelineLayout (4 groups); vs_shadow only reads group 0,
    // but the layout requires groups 1-3 be bound or the draw is invalid.
    shadowPass.setBindGroup(0, this.shadowBindGroup);
    shadowPass.setBindGroup(1, this.heroFloorPaddingBindGroup);
    shadowPass.setBindGroup(2, this.heroFloorBindGroup);
    shadowPass.setBindGroup(3, this.materialTextureBindGroup);
    let shadowBoundVertexBuffer: RawDrawBatch["vertexBuffer"] | null = null;
    for (const batch of this.drawBatches) {
      if (batch.vertexBuffer === "shadow") continue;
      if (batch.vertexBuffer !== shadowBoundVertexBuffer) {
        shadowPass.setVertexBuffer(0, this.vertexBufferForBatch(batch.vertexBuffer));
        shadowBoundVertexBuffer = batch.vertexBuffer;
      }
      shadowPass.draw(batch.vertexCount, batch.instanceCount, batch.vertexOffset, batch.instanceOffset);
    }
    shadowPass.end();
  }

  // Pre-record the static opaque batches (non-shadow prefix of staticDrawBatches)
  // into a GPURenderBundle. The bundle references the instance buffer via
  // bindGroup(0), so per-frame queue.writeBuffer of dynamic instances needs no
  // re-record — only a draw-param change (visibility) or format change (resize)
  // invalidates it, both of which null this.staticRenderBundle.
  private buildStaticRenderBundle(scenePipeline: any, postProcessEnabled: boolean) {
    const colorFormat = postProcessEnabled ? OFFSCREEN_COLOR_FORMAT : this.format;
    const bundleEncoder = this.device.createRenderBundleEncoder({
      label: "hp.raw.static-scene-bundle",
      colorFormats: [colorFormat],
      depthStencilFormat: DEPTH_FORMAT,
    });
    bundleEncoder.setPipeline(scenePipeline);
    bundleEncoder.setBindGroup(0, this.bindGroup);
    bundleEncoder.setBindGroup(1, this.heroFloorPaddingBindGroup);
    bundleEncoder.setBindGroup(2, this.heroFloorBindGroup);
    bundleEncoder.setBindGroup(3, this.materialTextureBindGroup);
    let boundVertexBuffer: RawDrawBatch["vertexBuffer"] | null = null;
    for (const batch of this.staticBundleBatches) {
      if (batch.vertexBuffer === "shadow") continue;
      if (batch.vertexBuffer !== boundVertexBuffer) {
        bundleEncoder.setVertexBuffer(0, this.vertexBufferForBatch(batch.vertexBuffer));
        boundVertexBuffer = batch.vertexBuffer;
      }
      bundleEncoder.draw(batch.vertexCount, batch.instanceCount, batch.vertexOffset, batch.instanceOffset);
    }
    return bundleEncoder.finish();
  }

  private encodeScenePass(encoder: any, world: GameWorld, targetView: any, postProcessEnabled: boolean) {
    const scenePipeline = postProcessEnabled ? this.offscreenPipeline : this.pipeline;
    const glassOverlayPipeline = postProcessEnabled ? this.offscreenGlassOverlayPipeline : this.glassOverlayPipeline;
    const transparentPipeline = postProcessEnabled ? this.offscreenTransparentPipeline : this.transparentPipeline;
    const glassOitResolvePipeline = postProcessEnabled ? this.offscreenGlassOitResolvePipeline : this.glassOitResolvePipeline;
    const contactShadowPipeline = postProcessEnabled ? this.offscreenShadowPipeline : this.shadowPipeline;
    const useGlassOit = rawGlassOitEnabled();
    const useSoftParticles = rawSoftParticlesEnabled();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          clearValue: { r: 0.010, g: 0.010, b: 0.009, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
      timestampWrites: this.gpuProfiler.timestampWrites("scene"),
    });
    renderPass.setPipeline(scenePipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setBindGroup(1, this.heroFloorPaddingBindGroup);
    renderPass.setBindGroup(2, this.heroFloorBindGroup);
    renderPass.setBindGroup(3, this.materialTextureBindGroup);
    let boundVertexBuffer: RawDrawBatch["vertexBuffer"] | null = null;
    // Static opaque batches are a contiguous prefix of drawBatches and are
    // separated from dynamic batches by the static shadow batches, so dynamic
    // draws never merge into them — their draw params stay stable frame-to-frame
    // and can be pre-recorded into a render bundle (rawRenderBundles flag).
    let dynamicBatchStart = 0;
    if (rawRenderBundlesEnabled() && this.staticDrawBatches.length > 0) {
      if (this.staticRenderBundle === null) {
        this.staticRenderBundle = this.buildStaticRenderBundle(scenePipeline, postProcessEnabled);
      }
      if (this.staticRenderBundle) {
        renderPass.executeBundles([this.staticRenderBundle]);
        // executeBundles() resets the pass's pipeline / bind-group / vertex-buffer
        // state, so re-establish it before the dynamic direct draws below.
        renderPass.setPipeline(scenePipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setBindGroup(1, this.heroFloorPaddingBindGroup);
        renderPass.setBindGroup(2, this.heroFloorBindGroup);
        renderPass.setBindGroup(3, this.materialTextureBindGroup);
        dynamicBatchStart = this.staticDrawBatches.length;
      }
    }
    for (let batchIndex = dynamicBatchStart; batchIndex < this.drawBatches.length; batchIndex += 1) {
      const batch = this.drawBatches[batchIndex];
      if (batch.vertexBuffer === "shadow") continue;
      if (batch.vertexBuffer !== boundVertexBuffer) {
        renderPass.setVertexBuffer(0, this.vertexBufferForBatch(batch.vertexBuffer));
        boundVertexBuffer = batch.vertexBuffer;
      }
      renderPass.draw(batch.vertexCount, batch.instanceCount, batch.vertexOffset, batch.instanceOffset);
    }
    if (this.roomRuntime.shouldDrawHeroFloor(world)) {
      renderPass.setPipeline(postProcessEnabled ? this.offscreenHeroFloorPipeline : this.heroFloorPipeline);
      renderPass.setBindGroup(0, this.bindGroup);
      renderPass.setBindGroup(1, this.heroFloorPaddingBindGroup);
      renderPass.setBindGroup(2, this.heroFloorBindGroup);
      renderPass.setVertexBuffer(0, this.heroFloorVertexBuffer);
      renderPass.draw(this.heroFloorVertexCount, 1, 0, 0);
    }
    if (!useGlassOit) {
      this.transparentMaterialPass.encode(renderPass, {
        pipeline: transparentPipeline,
        bindGroup: this.bindGroup,
        materialTextureBindGroup: this.materialTextureBindGroup,
        drawBatches: this.drawBatches,
        vertexBufferForBatch: (vertexBuffer) => this.vertexBufferForBatch(vertexBuffer),
      });
    }
    if (rawLegacyGlassOverlayEnabled()) {
      renderPass.setPipeline(glassOverlayPipeline);
      renderPass.setBindGroup(0, this.bindGroup);
      boundVertexBuffer = null;
      for (const batch of this.drawBatches) {
        if (!isRawTransparentDrawBatch(batch)) continue;
        if (batch.vertexBuffer !== boundVertexBuffer) {
          renderPass.setVertexBuffer(0, this.vertexBufferForBatch(batch.vertexBuffer));
          boundVertexBuffer = batch.vertexBuffer;
        }
        renderPass.draw(batch.vertexCount, batch.instanceCount, batch.vertexOffset, batch.instanceOffset);
      }
    }
    if (this.ageGroundingMode === "on" && !this.ageGroundingFailed) {
      try {
        this.ageGroundingPass.encodeContactShadows(renderPass, {
          pipeline: contactShadowPipeline,
          bindGroup: this.bindGroup,
          vertexBuffer: this.shadowVertexBuffer,
          drawRanges: this.drawBatches.filter((batch) => batch.vertexBuffer === "shadow"),
        });
      } catch (error) {
        this.ageGroundingFailed = true;
        console.warn("[HumanProtocol] AGE grounding encode failed; reverting to raw contact shadows.", error);
        this.groundingPass.encodeContactShadows(renderPass, {
          pipeline: contactShadowPipeline,
          bindGroup: this.bindGroup,
          shadowVertexBuffer: this.shadowVertexBuffer,
          drawBatches: this.drawBatches,
        });
      }
    } else {
      this.groundingPass.encodeContactShadows(renderPass, {
        pipeline: contactShadowPipeline,
        bindGroup: this.bindGroup,
        shadowVertexBuffer: this.shadowVertexBuffer,
        drawBatches: this.drawBatches,
      });
    }
    if (!useSoftParticles) {
      this.projectileVfxPass.encode(renderPass, postProcessEnabled);
      this.gpuParticlePass.encodeRender(renderPass, postProcessEnabled);
    }
    renderPass.end();

    if (useSoftParticles && (this.gpuParticlePass.activeThisFrame || this.projectileVfxPass.hasContent)) {
      // Depth-aware VFX pass: a read-only depth attachment lets the same depth
      // buffer be sampled for a soft fade while still depth-testing the particles
      // and projectiles against the opaque scene. Runs after the scene pass (so
      // depth is populated) and before glass OIT (preserving the prior draw
      // order). Guarded so idle frames / particle-less tiers never pay for an
      // empty render pass.
      this.encodeDepthAwareParticlePass(encoder, targetView, postProcessEnabled);
    }

    if (useGlassOit) {
      this.glassOitPass.encode(encoder, {
        accumPipeline: this.glassOitAccumPipeline,
        resolvePipeline: glassOitResolvePipeline,
        depthView: this.depthView,
        targetView,
        bindGroup: this.bindGroup,
        bloomCompatibleBindGroup: this.heroFloorPaddingBindGroup,
        heroFloorBindGroup: this.heroFloorBindGroup,
        materialTextureBindGroup: this.materialTextureBindGroup,
        drawBatches: this.drawBatches,
        vertexBufferForBatch: (vertexBuffer) => this.vertexBufferForBatch(vertexBuffer),
      });
    }
  }

  /**
   * Depth-aware GPU particle pass (rawSoftParticles flag). Renders particles in a
   * dedicated pass whose depth attachment is read-only, so the scene depth view
   * can simultaneously be bound and sampled in the fragment shader for a soft
   * fade near geometry. Depth testing (less-equal) still culls occluded particles.
   */
  private encodeDepthAwareParticlePass(encoder: any, targetView: any, postProcessEnabled: boolean) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          loadOp: "load",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthView,
        depthReadOnly: true,
      },
    });
    // Same draw order as the prior inline path: projectiles/effects then particles.
    this.projectileVfxPass.encode(pass, postProcessEnabled, this.depthView);
    this.gpuParticlePass.encodeRender(pass, postProcessEnabled, this.depthView);
    pass.end();
  }

  /**
   * Native first-person weapon pass: same scene pipeline/bind groups, but the
   * depth buffer is cleared first so the weapon renders in camera space and
   * world geometry can never clip into it.
   */
  private encodeViewmodelPass(encoder: any, targetView: any, postProcessEnabled: boolean) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          loadOp: "load",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
      timestampWrites: this.gpuProfiler.timestampWrites("viewmodel"),
    });
    pass.setPipeline(postProcessEnabled ? this.offscreenPipeline : this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setBindGroup(1, this.heroFloorPaddingBindGroup);
    pass.setBindGroup(2, this.heroFloorBindGroup);
    pass.setBindGroup(3, this.materialTextureBindGroup);
    let boundVertexBuffer: RawDrawBatch["vertexBuffer"] | null = null;
    for (const batch of this.viewmodelFrame.batches) {
      if (batch.vertexBuffer !== boundVertexBuffer) {
        pass.setVertexBuffer(0, this.vertexBufferForBatch(batch.vertexBuffer));
        boundVertexBuffer = batch.vertexBuffer;
      }
      pass.draw(batch.vertexCount, batch.instanceCount, batch.vertexOffset, batch.instanceOffset);
    }
    pass.end();
  }

  private encodeBloomCompositePass(encoder: any, targetView: any) {
    const bloomPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          clearValue: { r: 0.010, g: 0.010, b: 0.009, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      timestampWrites: this.gpuProfiler.timestampWrites("bloom"),
    });
    bloomPass.setPipeline(this.bloomPipeline);
    bloomPass.setBindGroup(0, this.bindGroup);
    bloomPass.setBindGroup(1, this.bloomBindGroup);
    bloomPass.draw(3, 1, 0, 0);
    bloomPass.end();
  }

  dispose() {
    this.disposed = true;
    this.depthTexture?.destroy?.();
    this.geometryVertexBuffer?.destroy?.();
    this.proxyVertexBuffer?.destroy?.();
    this.shadowVertexBuffer?.destroy?.();
    this.heroFloorVertexBuffer?.destroy?.();
    this.robotJointMatrixBuffer?.destroy?.();
    this.heroFloorTexture?.destroy?.();
    this.heroFloorPaddingTexture?.destroy?.();
    for (const texture of this.baseColorTexturePages) texture?.destroy?.();
    for (const texture of this.materialTexturePages) texture?.destroy?.();
    this.materialBuffer?.destroy?.();
    this.instanceBuffer?.destroy?.();
    this.cameraBuffer?.destroy?.();
    this.lightingBuffer?.destroy?.();
    this.shadowBuffer?.destroy?.();
    this.bloomBuffer?.destroy?.();
    this.colorTexture?.destroy?.();
    this.shadowDepthTexture?.destroy?.();
    this.dummyShadowDepthTexture?.destroy?.();
    this.glassOitPass.dispose();
    this.projectileVfxPass.dispose();
    this.gpuParticlePass.dispose();
    this.gpuProfiler.dispose();
    this.staticRenderBundle = null;
  }

  private resize(canvas: HTMLCanvasElement, pixelRatio: number, postProcessEnabled: boolean) {
    // Ultrawide / hi-DPI surfaces can push clientWidth*pixelRatio past the
    // device's maxTextureDimension2D (the WebGPU baseline guarantees only
    // 8192). Allocating the depth/color attachments at that size throws, and
    // the per-frame catch in RawWebGpuCanvas turns that single throw into a
    // permanent Three.js fallback. Clamp the backing-store size (CSS still
    // scales the canvas to fill its box) so a large monitor degrades render
    // resolution instead of dropping the whole raw backend.
    const maxDimension = this.device.limits?.maxTextureDimension2D ?? 8192;
    let nextWidth = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
    let nextHeight = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
    const largestDimension = Math.max(nextWidth, nextHeight);
    if (largestDimension > maxDimension) {
      const clampScale = maxDimension / largestDimension;
      nextWidth = Math.max(1, Math.floor(nextWidth * clampScale));
      nextHeight = Math.max(1, Math.floor(nextHeight * clampScale));
    }
    if (nextWidth === this.width && nextHeight === this.height && postProcessEnabled === this.postProcessEnabled) return;

    this.width = nextWidth;
    this.height = nextHeight;
    this.postProcessEnabled = postProcessEnabled;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    // Pass color format (postProcess toggle) and the bind-group resources the
    // bundle baked may have changed; drop the cached bundle so it re-records.
    this.staticRenderBundle = null;

    this.depthTexture?.destroy?.();
    this.device.pushErrorScope?.("validation");
    // Soft particles sample the scene depth, so the depth texture additionally
    // needs TEXTURE_BINDING. Gated on the flag so the default path keeps the
    // attachment-only usage (byte-identical allocation).
    const depthUsage = rawSoftParticlesEnabled()
      ? this.gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT | this.gpuGlobals.GPUTextureUsage.TEXTURE_BINDING
      : this.gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT;
    this.depthTexture = this.device.createTexture({
      label: "hp.raw.depth",
      size: [nextWidth, nextHeight],
      format: DEPTH_FORMAT,
      usage: depthUsage,
    });
    this.device.popErrorScope?.().then?.((error: { message?: string } | null) => {
      if (error) console.warn("[HumanProtocol] Raw WebGPU depth texture error.", error.message ?? error);
    });
    this.depthView = createTextureViewWithValidation(this.device, "hp.raw.depth-view", this.depthTexture);
    this.glassOitPass.resize(nextWidth, nextHeight);

    this.colorTexture?.destroy?.();
    this.colorTexture = null;
    this.colorView = null;
    this.bloomBindGroup = null;

    if (postProcessEnabled) {
      this.device.pushErrorScope?.("validation");
      this.colorTexture = this.device.createTexture({
        label: "hp.raw.post-color",
        size: [nextWidth, nextHeight],
        format: OFFSCREEN_COLOR_FORMAT,
        usage: this.gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT | this.gpuGlobals.GPUTextureUsage.TEXTURE_BINDING,
      });
      this.device.popErrorScope?.().then?.((error: { message?: string } | null) => {
        if (error) console.warn("[HumanProtocol] Raw WebGPU color texture error.", error.message ?? error);
      });
      this.colorView = createTextureViewWithValidation(this.device, "hp.raw.post-color-view", this.colorTexture);
      this.bloomBindGroup = this.device.createBindGroup({
        layout: this.bloomBindGroupLayout,
        entries: [
          { binding: 0, resource: this.colorView },
          { binding: 1, resource: this.bloomSampler },
          { binding: 2, resource: { buffer: this.bloomBuffer } },
        ],
      });
    }
  }

  private pixelRatioFor(world: GameWorld) {
    const requestedPixelRatio = rawPixelRatioOverride();
    if (requestedPixelRatio !== null) return requestedPixelRatio;

    const nativePixelRatio = window.devicePixelRatio || 1;
    const quality = world.renderPerformance.quality;
    const qualityPixelRatio = rawFullEffectsEnabled()
      ? Math.max(1, quality.maxPixelRatio)
      : quality.tier === "rescue"
        ? quality.maxPixelRatio
        : Math.max(1, quality.maxPixelRatio);
    return Math.min(nativePixelRatio, qualityPixelRatio);
  }

  private writeCamera(camera: PerspectiveCamera, world: GameWorld, postProcessEnabled: boolean) {
    const fog = this.plan.presentation?.lighting?.fog;
    const fogColor = this.visualDirector.applyFogColor(colorFromHex(fog?.color, [0.010, 0.010, 0.009]));
    let [fogNear, fogFar] = this.visualDirector.fogRange(fog?.near ?? 26, fog?.far ?? 70);
    if (this.ageVisualProfile) {
      fogNear *= this.ageVisualProfile.fog.nearScale;
      fogFar *= this.ageVisualProfile.fog.farScale;
    }
    if (this.roomRuntime.isServiceElevatorExitRoom(this.roomRuntime.currentRoomId(world))) {
      fogNear = Math.max(fogNear, 90);
      fogFar = Math.max(fogFar, 160);
    }
    camera.aspect = this.width / Math.max(1, this.height);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.cameraFloats.set(this.viewProjection.elements, 0);
    const envProfile = resolveRawMuseumEnvProfile(this.plan);
    this.cameraFloats.set([camera.position.x, camera.position.y, camera.position.z, envProfile.shaderProfileCode], 16);
    this.cameraFloats.set([fogColor[0], fogColor[1], fogColor[2], 1], 20);
    this.cameraFloats.set([fogNear, fogFar, rawAgxEnabled() ? 1 : 0, rawCinematicLookIntensity()], 24);
    this.cameraFloats.set(this.visualDirector.visualParams, 28);
    this.cameraFloats.set(this.visualDirector.colorGrade0, 32);
    this.cameraFloats.set(this.visualDirector.colorGrade1, 36);
    this.cameraFloats.set([rawDisplayTransformEnabled() ? 1 : 0, postProcessEnabled ? 1 : 0, rawColorPipelineV2Enabled() ? 1 : 0, rawMuseumToeEnabled() ? 1 : 0], 40);
    this.device.queue.writeBuffer(this.cameraBuffer, 0, this.cameraFloats);
  }

  private writeLighting(world: GameWorld) {
    const lighting = this.plan.presentation?.lighting;
    const frame = this.roomRuntime.frame(world);
    const tier = world.renderPerformance.quality.tier;
    const scenario = frame.scenario;
    const currentRoomId = frame.currentRoomId;
    const exitElevatorLook = this.roomRuntime.isServiceElevatorExitRoom(currentRoomId);
    let ambientColor = this.visualDirector.applyLightColor(colorFromHex(lighting?.ambient?.color, [0.16, 0.24, 0.28]), "ambient");
    let ambientIntensity = clamp(lighting?.ambient?.intensity ?? 0.28, 0, 3);
    let hemisphereIntensity = clamp(lighting?.hemisphereIntensity ?? 0, 0, 3);
    const directional = lighting?.directional;
    let directionalColor = this.visualDirector.applyLightColor(colorFromHex(directional?.color, [0.78, 0.94, 1]), "directional");
    const directionalDirection = rawCinematicDirectionalDirection(directional?.position);
    let directionalIntensity = clamp(directional?.intensity ?? 0.92, 0, 4);
    const bloomIntensity = clamp(lighting?.bloom?.intensity ?? 0, 0, 2);
    let profile = this.visualDirector.applyArtistProfile(frame.lightingProfile);
    const roomCenter = frame.currentRoom?.bounds.center ?? ([world.player.position.x, world.player.position.y, world.player.position.z] as Tuple3);
    const roomSize = frame.currentRoom?.bounds.size ?? ([18, 4, 14] as Tuple3);
    let selectedLightCandidates = rawSelectedLightCandidatesForVisibleRooms(
      this.plan.visibilityScenarios,
      scenario,
      frame.visibleRoomIds,
      currentRoomId,
      tier,
    );
    if (exitElevatorLook) {
      selectedLightCandidates = selectedLightCandidates.filter((selected) => {
        const sourceLight = this.lightById.get(selected.id);
        const selectedRoomId = selected.roomId ?? sourceLight?.roomId;
        return selectedRoomId === currentRoomId || /exit|elevator|service/i.test(selected.id);
      });
    }
    let selectedLights = rawShaderLightsFor(selectedLightCandidates, currentRoomId);
    let localLightIntensityScale = 1;
    if (this.ageVisualProfile && !exitElevatorLook) {
      // AGE escape-room direction: room-aware tone, light intensity scales,
      // and per-room/per-tier local light budgets override the raw defaults.
      const ageRoom = ageRoomVisualProfileFor(this.ageVisualProfile, currentRoomId);
      ambientIntensity = clamp(ambientIntensity * ageRoom.ambientIntensityScale, 0, 3);
      directionalIntensity = clamp(directionalIntensity * ageRoom.keyLightIntensityScale, 0, 4);
      localLightIntensityScale = ageRoom.localLightIntensityScale;
      profile = {
        ...profile,
        artist: {
          exposure: ageRoom.exposure,
          contrast: ageRoom.contrast,
          saturation: ageRoom.saturation,
          warmth: ageRoom.warmth,
        },
      };
      const budget = Math.min(MAX_SHADER_LIGHTS, ageRoomLightBudgetFor(this.ageVisualProfile, currentRoomId, tier));
      selectedLights = ageSelectRoomLights(
        selectedLights.map((selected) => ({ ...selected, ambience: selected.type === "floor_glow" })),
        currentRoomId,
        budget,
        this.ageVisualProfile.lightSelection,
      );
    }
    if (exitElevatorLook) {
      ambientColor = mixTuple3(ambientColor, [0.032, 0.048, 0.048], 0.78);
      directionalColor = mixTuple3(directionalColor, [0.42, 0.54, 0.52], 0.84);
      ambientIntensity = clamp(Math.min(ambientIntensity * 0.11, 0.028), 0, 3);
      hemisphereIntensity = clamp(Math.min(hemisphereIntensity * 0.04, 0.014), 0, 3);
      directionalIntensity = clamp(Math.max(directionalIntensity * 0.32, 0.34), 0, 4);
      localLightIntensityScale *= 0.92;
    }
    // Debug-only brightness dial. Default 1.0 leaves the level plan untouched;
    // any accepted lighting change should move back into level source/tuning.
    const envBrightness = rawEnvBrightness();
    if (envBrightness !== 1) {
      const lift = envBrightness - 1; // env 1..3 -> lift 0..2
      // Additive ambient floor lift: a multiplicative scale is too weak when a
      // level's baked ambient is near-zero (e.g. L1 = 0.054 -> stays black). Add
      // a real floor so dark levels actually brighten, plus boost lights/exposure.
      ambientIntensity = clamp(ambientIntensity + lift * 0.36, 0, 3);
      directionalIntensity = clamp(directionalIntensity * (1 + lift * 0.6), 0, 4);
      localLightIntensityScale *= 1 + lift * 0.85;
      profile = {
        ...profile,
        artist: { ...profile.artist, exposure: profile.artist.exposure * (1 + lift * 0.42) },
      };
    }
    const playerLightCell = `${Math.floor(world.player.position.x * 0.25)},${Math.floor(world.player.position.z * 0.25)}`;
    const lightingKey = [
      currentRoomId,
      tier,
      exitElevatorLook ? "service-elevator-exit" : "",
      envBrightness,
      playerLightCell,
      selectedLights.map((selected) => selected.id).join(","),
    ].join("|");
    if (lightingKey === this.lastLightingKey) return;
    this.lastLightingKey = lightingKey;

    this.lightingFloats.fill(0);
    this.lightingFloats.set([ambientColor[0], ambientColor[1], ambientColor[2], ambientIntensity], 0);
    this.lightingFloats.set([directionalDirection[0], directionalDirection[1], directionalDirection[2], directionalIntensity], 4);
    this.lightingFloats.set([directionalColor[0], directionalColor[1], directionalColor[2], 1], 8);

    let lightCount = 0;
    for (const selected of selectedLights) {
      if (lightCount >= MAX_SHADER_LIGHTS) break;
      const light = this.lightById.get(selected.id);
      if (!light) continue;
      let color = this.visualDirector.applyLightColor(colorFromHex(light.color, [0.8, 0.96, 1]), "local");
      let intensityScale = localLightIntensityScale;
      if (exitElevatorLook) {
        const lightId = selected.id.toLowerCase();
        if (/door_gold_edge|gold_edge|amber/.test(lightId)) {
          color = mixTuple3(color, [0.78, 0.52, 0.22], 0.28);
          intensityScale *= 0.14;
        } else if (/button|cyan|portal|softbox/.test(lightId)) {
          color = mixTuple3(color, [0.22, 0.78, 0.86], 0.52);
          intensityScale *= /button/.test(lightId) ? 2.45 : 1.35;
        } else if (/floor/.test(lightId)) {
          color = mixTuple3(color, [0.22, 0.64, 0.68], 0.32);
          intensityScale *= 1.1;
        }
      }
      const intensity = clamp((light.intensity ?? 0) * intensityScale, 0, 6);
      const position = selected.position ?? light.position;
      const positionOffset = 16 + lightCount * 4;
      const colorOffset = 16 + MAX_SHADER_LIGHTS * 4 + lightCount * 4;
      const paramsOffset = 16 + MAX_SHADER_LIGHTS * 8 + lightCount * 4;
      this.lightingFloats.set([position[0], position[1], position[2], lightTypeValue(light.type)], positionOffset);
      this.lightingFloats.set([color[0], color[1], color[2], intensity], colorOffset);
      this.lightingFloats.set(
        [lightRadiusFor(light), clamp(light.decay ?? (light.type === "area" ? 1.35 : 1.85), 0.35, 4), light.width ?? 0, light.height ?? 0],
        paramsOffset,
      );
      lightCount += 1;
    }

    const profileOffset = 16 + MAX_SHADER_LIGHTS * 12;
    this.lightingFloats.set([lightCount, hemisphereIntensity, bloomIntensity, rawLightingQualityScalar(world.renderPerformance.quality.tier)], 12);
    this.lightingFloats.set(
      [
        clamp(profile.artist.exposure, 0.7, 1.6),
        clamp(profile.artist.contrast, 0.75, 1.45),
        clamp(profile.artist.saturation, 0.75, 1.35),
        clamp(profile.artist.warmth, 0, 1),
      ],
      profileOffset,
    );
    this.lightingFloats.set(
      [
        clamp(profile.bounce.floor, 0, 1),
        clamp(profile.bounce.ceiling, 0, 1),
        clamp(profile.bounce.side, 0, 1),
        clamp(profile.bounce.shadowDepth, 0.4, 1.05),
      ],
      profileOffset + 4,
    );
    const halfRoomX = Math.max(1, roomSize[0] * 0.5);
    const halfRoomZ = Math.max(1, roomSize[2] * 0.5);
    const floorY = roomCenter[1] - roomSize[1] * 0.5;
    const ceilingY = roomCenter[1] + roomSize[1] * 0.5;
    this.lightingFloats.set([roomCenter[0], roomCenter[2], halfRoomX, halfRoomZ], profileOffset + 8);
    this.lightingFloats.set([floorY, ceilingY, 1 / halfRoomX, 1 / halfRoomZ], profileOffset + 12);
    this.lightingFloats.set(
      [
        clamp(profile.algorithm.ao * rawRoomAoTierScalar(tier), 0, 1.35),
        clamp(profile.algorithm.probe * rawRoomProbeTierScalar(tier), 0, 1.25),
        clamp(profile.algorithm.material * rawMaterialResponseTierScalar(tier), 0, 1.25),
        clamp(profile.algorithm.localLight * rawLocalLightShapeTierScalar(tier), 0, 1.35),
      ],
      profileOffset + 16,
    );
    this.lightingFloats.set(
      [
        clamp(profile.algorithm.shadowReceiver, 0, 1.15),
        clamp(profile.algorithm.specular, 0.65, 1.55),
        clamp(profile.algorithm.contact, 0.65, 1.55),
        clamp(profile.algorithm.wallGuard, 0, 1.2),
      ],
      profileOffset + 20,
    );
    // --- Phase-1 IBL: SH9 radiance coefficients (opt-in ?rawIbl=1) ---
    // Low-frequency analytic environment: flat ambient base + a gentle vertical
    // brightening tinted toward the directional/sky colour. Stored as RADIANCE SH
    // (band-1 vertical term only); the shader applies the cosine-lobe convolution
    // for diffuse and uses the raw radiance for reflections. Coeffs calibrated so
    // a constant environment L reconstructs to L (×3.5449 = 1/Y00; ×2.047 = 1/Y1).
    const iblOn = rawIblEnabled() || exitElevatorLook;
    const iblIntensity = exitElevatorLook ? Math.min(rawIblIntensity(), 0.58) : rawIblIntensity();
    const cubeSpecularOn = rawCubeEnabled();
    const shOffset = profileOffset + LIGHT_PROFILE_FLOATS; // = 160, appended at struct end
    for (let c = 0; c < 3; c++) {
      const base = ambientColor[c] * ambientIntensity;
      const skyLift = directionalColor[c] * Math.max(directionalIntensity, 0) * 0.18;
      const grad = skyLift + base * hemisphereIntensity * 0.45;
      const c0 = (base + grad * 0.5) * 3.5449; // band-0 constant term
      const c1 = grad * 2.047; // band-1 vertical (n.y) gradient
      this.lightingFloats[shOffset + 0 * 4 + c] = c0; // sh_coeff[0].xyz
      this.lightingFloats[shOffset + 1 * 4 + c] = c1; // sh_coeff[1].xyz (Y1-1 = y)
    }
    this.lightingFloats.set([iblOn ? 1 : 0, iblIntensity, cubeSpecularOn ? 1 : 0, exitElevatorLook ? 1 : 0], shOffset + 9 * 4); // sh_meta (.z = real cube, .w = service-elevator look)
    this.device.queue.writeBuffer(this.lightingBuffer, 0, this.lightingFloats);
  }

  private writeShadowCamera(world: GameWorld) {
    const { center: roomCenter, size: roomSize } = this.roomRuntime.roomBoundsFor(world, [18, 4, 14]);
    const lighting = this.plan.presentation?.lighting;
    const lightDirection = rawCinematicDirectionalDirection(lighting?.directional?.position);
    const span = clamp(Math.max(roomSize[0], roomSize[2]) * 0.72 + 5.5, 10, 24);
    const targetX = (roomCenter[0] + world.player.position.x) * 0.5;
    const targetY = Math.max(0.9, roomCenter[1] * 0.18 + world.player.position.y * 0.42);
    const targetZ = (roomCenter[2] + world.player.position.z) * 0.5;

    this.shadowCamera.left = -span;
    this.shadowCamera.right = span;
    this.shadowCamera.top = span;
    this.shadowCamera.bottom = -span;
    this.shadowCamera.near = 0.5;
    this.shadowCamera.far = 68;
    this.shadowCamera.position.set(
      targetX + lightDirection[0] * 26,
      targetY + lightDirection[1] * 26,
      targetZ + lightDirection[2] * 26,
    );
    this.shadowCamera.lookAt(targetX, targetY, targetZ);
    this.shadowCamera.updateProjectionMatrix();
    this.shadowCamera.updateMatrixWorld(true);
    this.shadowCamera.matrixWorldInverse.copy(this.shadowCamera.matrixWorld).invert();
    this.shadowViewProjection.multiplyMatrices(this.shadowCamera.projectionMatrix, this.shadowCamera.matrixWorldInverse);
    this.shadowFloats.set(this.shadowViewProjection.elements, 0);
    const shadowTuning = this.plan.rawLightingAlgorithmTuning?.global ?? null;
    // When the shadow-map pass is off, force strength to 0 so the scene samples
    // NO shadowing instead of the bound dummy depth (which is cleared toward 0 →
    // would inject phantom directional dimming on the no-shadow path). Keeps
    // `?rawShadowMap=0` byte-true to "no shadows".
    const shadowStrength = !rawShadowMapEnabled()
      ? 0
      : rawShadowDebugEnabled()
        ? 2
        : rawShadowStrength(world.renderPerformance.quality.tier, shadowTuning);
    const shadowBias = clamp(shadowTuning?.shadowBias ?? 0.0028, 0.0012, 0.006);
    const normalBias = clamp(shadowTuning?.normalBias ?? 0.0075, 0.0035, 0.014);
    this.shadowFloats.set([shadowStrength, 1 / SHADOW_MAP_SIZE, shadowBias, normalBias], 16);
    this.device.queue.writeBuffer(this.shadowBuffer, 0, this.shadowFloats);
  }

  private writeBloom(world: GameWorld, bloomEnabled: boolean, fxaaEnabled: boolean) {
    const configuredBloom = clamp(this.plan.presentation?.lighting?.bloom?.intensity ?? 0.38, 0, 2);
    const configuredThreshold = clamp(this.plan.presentation?.lighting?.bloom?.threshold ?? 0.58, 0.12, 1.2);
    let strength = !bloomEnabled || rawShadowDebugEnabled()
      ? 0
      : configuredBloom * rawBloomStrength(world.renderPerformance.quality.tier) * this.visualDirector.bloomStrengthScale();
    let threshold = rawBloomThreshold(world.renderPerformance.quality.tier, configuredThreshold + this.visualDirector.bloomThresholdLift());
    if (this.ageVisualProfile) {
      strength *= this.ageVisualProfile.bloom.strengthScale;
      threshold = clamp(threshold + this.ageVisualProfile.bloom.thresholdLift, 0.1, 1.4);
    }
    const radius = rawBloomRadius(world.renderPerformance.quality.tier);
    this.bloomFloats.set([1 / Math.max(1, this.width), 1 / Math.max(1, this.height), strength, threshold], 0);
    const fxaaStrength = fxaaEnabled && !rawShadowDebugEnabled() ? rawFxaaStrength(world.renderPerformance.quality.tier) : 0;
    this.bloomFloats.set([radius, rawShadowDebugEnabled() ? 0 : 1, fxaaStrength, 0], 4);
    this.device.queue.writeBuffer(this.bloomBuffer, 0, this.bloomFloats);
  }

  private writeInstances(world: GameWorld) {
    this.doorVisualAnimating = this.updateDoorVisualProgress(world);
    const visibilityKey = this.roomRuntime.frame(world).visibilityKey;
    const wallSwitchVisualKey = this.wallDoorSwitchVisualKey(world);
    const interactionRevealAnimating = this.isInteractionFocusRevealAnimating(world);
    const staticVisibilityChanged = visibilityKey !== this.lastStaticVisibilityKey;
    const staticSceneChanged =
      staticVisibilityChanged || this.doorVisualAnimating || interactionRevealAnimating || wallSwitchVisualKey !== this.lastWallDoorSwitchVisualKey;
    if (staticSceneChanged) {
      this.lastStaticVisibilityKey = visibilityKey;
      this.lastWallDoorSwitchVisualKey = wallSwitchVisualKey;
      this.staticDrawBatches.length = 0;
      this.staticInstanceCount = this.writeStaticInstances(world, 0, this.staticDrawBatches);
      this.staticInstanceFloatCount = this.staticInstanceCount * FLOATS_PER_INSTANCE;
      // Static draw parameters changed; the cached render bundle is now stale.
      this.staticRenderBundle = null;
      // Snapshot the clean static batch params (before the dynamic writer below
      // can mutate any shared batch object) so the bundle always bakes the true
      // static draw ranges regardless of dynamic-batch merging.
      if (rawRenderBundlesEnabled()) {
        this.staticBundleBatches.length = 0;
        for (const batch of this.staticDrawBatches) this.staticBundleBatches.push({ ...batch });
      }
    }

    this.drawBatches.length = 0;
    this.drawBatches.push(...this.staticDrawBatches);
    let instanceCount = this.staticInstanceCount;
    this.robotJointMatrixCount = 0;
    instanceCount = this.writeDynamicInstances(world, instanceCount, this.drawBatches);
    this.writeRobotJointMatrixBuffer();
    const floatCount = instanceCount * FLOATS_PER_INSTANCE;
    if (staticSceneChanged) {
      this.device.queue.writeBuffer(this.instanceBuffer, 0, this.instanceFloats, 0, floatCount);
    } else {
      const dynamicFloatCount = floatCount - this.staticInstanceFloatCount;
      if (dynamicFloatCount > 0) {
        this.device.queue.writeBuffer(
          this.instanceBuffer,
          this.staticInstanceFloatCount * Float32Array.BYTES_PER_ELEMENT,
          this.instanceFloats,
          this.staticInstanceFloatCount,
          dynamicFloatCount,
        );
      }
    }
    return instanceCount;
  }

  private isInteractionFocusRevealAnimating(world: GameWorld) {
    const reveal = world.session.activeFocusReveal;
    return Boolean(reveal && reveal.kind === "puzzle" && reveal.targetId && reveal.elapsed < reveal.duration);
  }

  private writeStaticInstances(world: GameWorld, startIndex: number, drawBatches: RawDrawBatch[]) {
    const frame = this.roomRuntime.frame(world);
    const visibleRoomIds = frame.visibleRoomIds;
    const visibleDoorIds = frame.visibleDoorIds;
    let index = startIndex;
    const visibleInstances: RawPlanInstance[] = [];

    for (const instance of this.sortedPlanInstances) {
      if (index >= MAX_INSTANCES) break;
      // Pickups are rendered at runtime from world.pickups (with bob + collect);
      // skip the baked static copy, else it double-renders (the big medkit next to
      // the runtime one) and lingers in place after the pickup is collected.
      if (instance.role.startsWith("pickup_")) continue;
      if (
        !this.roomRuntime.isPlanInstanceVisible(
          world,
          instance,
          visibleRoomIds,
          visibleDoorIds,
          this.doorProgressLookup,
          this.doorHideHardwareLookup,
        )
      )
        continue;
      visibleInstances.push(instance);
      index = this.writePlanInstance(world, index, instance, drawBatches);
    }

    // Per-furniture contact-shadow discs removed by request — they read as huge
    // white semicircles (the dark ground plane gets washed out by the room ambient
    // and grows with the grounding scale). Static props no longer get a ground disc.
    // (Re-enable by restoring the writePlanShadowInstance loop over visibleInstances.)

    return index;
  }

  private writeDynamicInstances(world: GameWorld, startIndex: number, drawBatches: RawDrawBatch[]) {
    let index = startIndex;
    const hideRawEnemies = rawThreeEnemyOracleOnlyEnabled();
    this.dynamicShadowPlaneCount = 0;
    this.ageGroundingQuadCount = 0;
    const ageQuads = this.planAgeGroundingQuads(world, hideRawEnemies);
    const useAgeQuads = ageQuads !== null && this.ageGroundingMode === "on";
    if (ageQuads !== null) {
      this.ageGroundingQuadCount = ageQuads.length;
    }

    if (isExitCinematicViewActive(world)) {
      return this.writeExitCinematicDynamicInstances(world, index, drawBatches);
    }

    const visibleRoomIds = this.roomRuntime.frame(world).visibleRoomIds;
    const isDynamicPositionVisible = (x: number, z: number) => this.roomRuntime.isWorldPositionVisible(x, z, visibleRoomIds);

    if (world.session.deployedUltimate) {
      const [x, , z] = world.session.deployedUltimate.position;
      if (isDynamicPositionVisible(x, z)) {
        index = this.writeDeployedUltimateInstance(index, world.session.deployedUltimate, drawBatches);
      }
    }

    index = this.writeExitCinematicDynamicInstances(world, index, drawBatches);

    for (const prop of world.dynamicProps) {
      if (index >= MAX_INSTANCES) break;
      if (!isDynamicPositionVisible(prop.position.x, prop.position.z)) continue;
      index = this.writeDynamicPropInstance(index, prop, drawBatches);
    }

    for (const pickup of world.pickups) {
      if (index >= MAX_INSTANCES || pickup.collected) continue;
      if (!isDynamicPositionVisible(pickup.position.x, pickup.position.z)) continue;
      if (pickup.type === "coreCell") {
        index = this.writeCoreCellGlowPlane(index, pickup.position.x, pickup.position.y + 0.026, pickup.position.z, pickup.age);
        this.appendShadowDrawBatch(drawBatches, index - 1);
      }
      if (useAgeQuads) continue;
      const pickupShadowScale = pickup.type === "coreCell" ? 0.74 : pickup.type === "repairKit" ? 0.68 : 0.46;
      const pickupOpacity = pickup.type === "coreCell" ? 0.16 : pickup.type === "repairKit" ? 0.18 : 0.13;
      index = this.writeShadowPlane(
        index,
        pickup.position.x + 0.035,
        pickup.position.y + 0.018,
        pickup.position.z - 0.032,
        pickupShadowScale,
        pickupShadowScale * 0.72,
        pickupOpacity,
      );
      this.appendShadowDrawBatch(drawBatches, index - 1);
      this.dynamicShadowPlaneCount += 1;
    }

    if (!hideRawEnemies && !useAgeQuads) {
      for (const enemy of world.enemies) {
        if (index >= MAX_INSTANCES || !rawEnemyRenderable(enemy)) continue;
        if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
        if (!isDynamicPositionVisible(enemy.position.x, enemy.position.z)) continue;
        const drone = enemy.archetypeId === "repair_drone";
        const bossLike = enemy.tier === "boss" || enemy.tier === "leader";
        const shadowScale = Math.max(drone ? 0.64 : bossLike ? 1.24 : 0.82, enemy.radius * (drone ? 1.82 : bossLike ? 2.52 : 2.18) * enemy.visualScaleMultiplier);
        const deathFade = enemy.isAlive ? 1 : clamp(1 - enemy.deathAge / RAW_ENEMY_HIDE_DEATH_AGE, 0, 1);
        const altitudeFade = drone ? 0.58 : 1;
        const opacity = (drone ? 0.18 : bossLike ? 0.34 : 0.26) * deathFade * altitudeFade;
        index = this.writeShadowPlane(
          index,
          enemy.position.x + shadowScale * (drone ? 0.06 : 0.12),
          enemy.position.y + 0.020,
          enemy.position.z - shadowScale * (drone ? 0.045 : 0.080),
          shadowScale * (bossLike ? 1.34 : drone ? 0.94 : 1.12),
          shadowScale * (bossLike ? 0.82 : drone ? 0.62 : 0.70),
          opacity,
        );
        this.appendShadowDrawBatch(drawBatches, index - 1);
        this.dynamicShadowPlaneCount += 1;
      }
    }

    if (useAgeQuads && ageQuads) {
      // AGE grounding path: quads already carry policy-applied size/opacity,
      // so they go straight to the ground-plane writer.
      for (const quad of ageQuads) {
        if (index >= MAX_INSTANCES) break;
        if (!isDynamicPositionVisible(quad.center[0], quad.center[2])) continue;
        index = this.writeGroundPlane(
          index,
          quad.center[0],
          quad.center[1],
          quad.center[2],
          quad.halfExtents[0],
          quad.halfExtents[1],
          [0.006, 0.012, 0.014, quad.opacity],
        );
        this.appendShadowDrawBatch(drawBatches, index - 1);
      }
    }

    for (const pickup of world.pickups) {
      if (index >= MAX_INSTANCES || pickup.collected) continue;
      if (!isDynamicPositionVisible(pickup.position.x, pickup.position.z)) continue;
      index = this.writePickupInstance(index, pickup, drawBatches);
    }

    if (!hideRawEnemies) {
      for (const enemy of world.enemies) {
        if (index >= MAX_INSTANCES || !rawEnemyRenderable(enemy)) continue;
        if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
        if (!isDynamicPositionVisible(enemy.position.x, enemy.position.z)) continue;
        if (rawEnemyHandledByThreeOracle(world, enemy)) continue;
        index = this.writeEnemyInstance(index, enemy, enemyTintFor(enemy), drawBatches);
      }
    }

    if (!this.gpuParticlePass.enabled) {
      const effectLimit = world.renderPerformance.quality.effectPoolSize;
      for (let effectIndex = 0; effectIndex < Math.min(world.effects.length, effectLimit); effectIndex += 1) {
        if (index >= MAX_INSTANCES) break;
        const effect = world.effects[effectIndex];
        if (!isDynamicPositionVisible(effect.position.x, effect.position.z)) continue;
        const life = Math.max(0, 1 - effect.age / Math.max(0.001, effect.lifetime));
        const size = Math.max(0.12, effect.intensity * life * 0.55);
        if (effect.type === "dangerTelegraph") {
          const warningLength = Math.max(0.7, effect.intensity * 1.16);
          const warningWidth = Math.max(0.32, effect.intensity * 0.34);
          index = this.writeGroundPlane(
            index,
            effect.position.x + effect.direction.x * warningLength * 0.55,
            effect.position.y + 0.042,
            effect.position.z + effect.direction.z * warningLength * 0.55,
            warningWidth,
            warningLength,
            [1.0, 0.22, 0.12, 0.42 * life],
          );
          this.appendShadowDrawBatch(drawBatches, index - 1);
          continue;
        }
        if (effect.type === "shockwave") {
          const ringSize = Math.max(0.32, effect.intensity * (1.05 + effect.age * 0.72));
          index = this.writeGroundPlane(index, effect.position.x, effect.position.y + 0.035, effect.position.z, ringSize, ringSize, [0.24, 0.92, 1.0, 0.34 * life]);
          this.appendShadowDrawBatch(drawBatches, index - 1);
          continue;
        }
        if (effect.type === "breachShock") {
          const shockLength = Math.max(0.42, effect.intensity * (0.82 + effect.age * 0.48));
          const shockWidth = Math.max(0.16, effect.intensity * 0.2);
          index = this.writeBox(
            index,
            effect.position.x + effect.direction.x * shockLength * 0.36,
            effect.position.y + 0.12,
            effect.position.z + effect.direction.z * shockLength * 0.36,
            shockWidth,
            0.08,
            shockLength,
            [0.36, 0.96, 1.0, 0.48 * life],
            Math.atan2(effect.direction.x, effect.direction.z),
          );
          this.appendDrawBatch(drawBatches, {
            vertexBuffer: "proxy",
            vertexOffset: 0,
            vertexCount: CUBE_VERTEX_COUNT,
            instanceOffset: index - 1,
            instanceCount: 1,
            transparent: true,
          });
          continue;
        }
        if (effect.type === "breachPierce" || effect.type === "breachTrail") {
          const streakLength = Math.max(0.28, effect.intensity * (effect.type === "breachPierce" ? 0.38 : 0.3));
          const streakWidth = effect.type === "breachPierce" ? 0.08 : 0.12;
          const color: Tuple4 = effect.type === "breachPierce"
            ? [0.86, 1.0, 0.94, 0.62 * life]
            : [0.24, 0.98, 1.0, 0.42 * life];
          index = this.writeBox(
            index,
            effect.position.x + effect.direction.x * streakLength * 0.28,
            effect.position.y + 0.18,
            effect.position.z + effect.direction.z * streakLength * 0.28,
            streakWidth,
            streakWidth,
            streakLength,
            color,
            Math.atan2(effect.direction.x, effect.direction.z),
          );
          this.appendDrawBatch(drawBatches, {
            vertexBuffer: "proxy",
            vertexOffset: 0,
            vertexCount: CUBE_VERTEX_COUNT,
            instanceOffset: index - 1,
            instanceCount: 1,
            transparent: true,
          });
          continue;
        }
        const instanceOffset = index;
        const color: Tuple4 = [0.9, 0.78, 0.36, 0.95];
        index = this.writeBox(index, effect.position.x, effect.position.y, effect.position.z, size, size, size, color);
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "proxy",
          vertexOffset: 0,
          vertexCount: CUBE_VERTEX_COUNT,
          instanceOffset,
          instanceCount: 1,
          transparent: false,
        });
      }
    }
    return index;
  }

  private writeDynamicPropInstance(index: number, prop: GameWorld["dynamicProps"][number], drawBatches: RawDrawBatch[]) {
    const geometry = this.geometryAssets.get(prop.modelKey);
    if (!geometry || geometry.vertexCount <= 0) {
      const nextIndex = this.writeBox(
        index,
        prop.position.x,
        prop.position.y,
        prop.position.z,
        prop.halfSize.x * 2,
        prop.halfSize.y * 2,
        prop.halfSize.z * 2,
        [0.48, 0.52, 0.54, 0.96],
        prop.yaw,
      );
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "proxy",
        vertexOffset: 0,
        vertexCount: CUBE_VERTEX_COUNT,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
      return nextIndex;
    }

    const scale: Tuple3 = [prop.scale.x, prop.scale.y, prop.scale.z];
    this.writeRuntimeModelInstance(
      index,
      prop.position.x,
      prop.position.y,
      prop.position.z,
      0,
      scale,
      prop.yaw,
      AUTHORED_MATERIAL_INSTANCE_COLOR,
    );
    const chunks = geometry.nodeChunks ?? [];
    if (chunks.length > 0) {
      for (const chunk of chunks) {
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent: this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount),
        });
      }
      return index + 1;
    }

    this.appendDrawBatch(drawBatches, {
      vertexBuffer: "geometry",
      vertexOffset: geometry.vertexOffset,
      vertexCount: geometry.vertexCount,
      instanceOffset: index,
      instanceCount: 1,
      transparent: this.isTransparentGeometryRange(geometry.vertexOffset, geometry.vertexCount),
    });
    return index + 1;
  }

  private writeExitCinematicDynamicInstances(world: GameWorld, startIndex: number, drawBatches: RawDrawBatch[]) {
    const cinematic = world.session.activeExitCinematic;
    if (!isExitCinematicViewActive(world) || !cinematic) return startIndex;

    let index = startIndex;
    const buttonVisual = exitElevatorButtonVisualState(cinematic);
    const button = this.exitCallButtonInstance(cinematic.enterPosition);
    if (button && index < MAX_INSTANCES) {
      index = this.writeExitButtonPlungerChunks(world, index, button, buttonVisual.pressDepthMeters, drawBatches);
      const yaw = button.rotation[1] ?? 0;
      const forwardX = Math.sin(yaw);
      const forwardZ = Math.cos(yaw);
      const glowDepth = 0.118 - buttonVisual.pressDepthMeters * 0.72;
      const glow = Math.min(1, buttonVisual.panelConfirm * 0.5 + buttonVisual.contactPulse * 0.55);
      const amber = buttonVisual.amberMix;
      if (glow > 0.01) {
        const color: Tuple4 = [
          0.34 + amber * 0.66,
          0.95 - amber * 0.28,
          1.0 - amber * 0.74,
          0.055 + glow * 0.09,
        ];
        index = this.writeProxyCube(
          index,
          drawBatches,
          button.position[0] + forwardX * glowDepth,
          button.position[1] + 0.12,
          button.position[2] + forwardZ * glowDepth,
          0.16,
          0.086,
          0.012,
          color,
          yaw,
        );
      }
    }

    const shaft = exitElevatorShaftVisualState(cinematic);
    if (shaft.ascent <= 0.015 && shaft.reveal <= 0.015) return index;

    const elapsed = Math.max(0, cinematic.elapsed - cinematic.ascentStartTime);
    const shaftInstance = this.exitShaftInstance(cinematic.enterPosition);
    if (shaftInstance) {
      const beforeTexturedShaft = index;
      index = this.writeExitShaftTexturedChunks(index, shaftInstance, elapsed, shaft, drawBatches);
      if (index > beforeTexturedShaft) return index;
    }

    const stripSpecs = [
      [-2.74, -1.98, 5.2, 0, 0, 0.055, 1.65] as const,
      [2.74, -1.84, 5.8, 0.36, 0, 0.055, 1.75] as const,
      [-2.46, 1.76, 4.4, 0.72, 1, 0.036, 1.22] as const,
      [2.56, 1.96, 5.5, 1.1, 0, 0.05, 1.68] as const,
      [-1.68, -2.24, 6.2, 1.42, 0, 0.045, 1.82] as const,
      [1.62, -2.24, 4.8, 1.86, 1, 0.032, 1.08] as const,
      [-2.18, 0.06, 6.6, 2.18, 0, 0.036, 1.28] as const,
      [2.18, 0.12, 6.0, 2.56, 0, 0.036, 1.34] as const,
    ];
    for (const [localX, localZ, speed, delay, variant, width, height] of stripSpecs) {
      if (index >= MAX_INSTANCES) break;
      const [x, z] = rotateLocalXZ(cinematic.enterPosition[0], cinematic.enterPosition[2], localX, localZ, cinematic.faceYaw);
      const travel = (elapsed * speed * shaft.speedMultiplier + delay) % 4.6;
      const y = 3.35 - travel;
      const color: Tuple4 =
        variant === 1
          ? [0.54, 0.38, 0.2, 0.034 * shaft.streakOpacity]
          : [0.16, 0.52, 0.58, 0.036 * shaft.streakOpacity];
      index = this.writeProxyCube(index, drawBatches, x, y, z, width, height * (0.95 + shaft.ascent * 0.34), 0.045, color, cinematic.faceYaw);
    }

    const beamSpecs = [
      [-2.16, 4.8, 0.1, 0, 0.28] as const,
      [1.92, 5.4, 0.78, 0, 0.24] as const,
      [-1.55, 6.1, 1.42, 1, 0.16] as const,
      [1.44, 5.7, 2.04, 2, 0.08] as const,
      [0.08, 6.4, 2.68, 0, 0.22] as const,
    ];
    for (const [localZ, speed, delay, variant, alpha] of beamSpecs) {
      if (index >= MAX_INSTANCES) break;
      const [x, z] = rotateLocalXZ(cinematic.enterPosition[0], cinematic.enterPosition[2], 0, localZ, cinematic.faceYaw);
      const travel = (elapsed * speed * shaft.speedMultiplier + delay) % 5.1;
      const y = 3.72 - travel;
      const color: Tuple4 =
        variant === 1
          ? [0.16, 0.52, 0.58, alpha * 0.22 * shaft.beamOpacity]
          : variant === 2
            ? [0.54, 0.38, 0.2, alpha * 0.22 * shaft.beamOpacity]
            : [0.026, 0.042, 0.05, alpha * 0.34 * shaft.beamOpacity];
      index = this.writeProxyCube(index, drawBatches, x, y, z, 4.9, 0.052, 0.075, color, cinematic.faceYaw);
    }

    const glassSpecs = [
      [-2.36, -0.72, 0.07] as const,
      [2.36, -0.54, 0.06] as const,
      [-1.12, 2.04, 0.025] as const,
      [1.08, 2.08, 0.035] as const,
    ];
    for (const [localX, localZ, alpha] of glassSpecs) {
      if (index >= MAX_INSTANCES) break;
      const [x, z] = rotateLocalXZ(cinematic.enterPosition[0], cinematic.enterPosition[2], localX, localZ, cinematic.faceYaw);
      index = this.writeProxyCube(index, drawBatches, x, 1.55, z, 0.86, 2.65, 0.018, [0.1, 0.22, 0.26, alpha * 0.52 * shaft.glassOpacity], cinematic.faceYaw);
    }

    return index;
  }

  private exitCallButtonInstance(enterPosition: readonly [number, number, number]) {
    const stage = this.nearestExitStageInstance(enterPosition);
    if (stage) return stage;
    let best: RawPlanInstance | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (const instance of this.sortedPlanInstances) {
      if (!isExitElevatorCallButtonModelKey(instance.modelKey)) continue;
      const dx = instance.position[0] - enterPosition[0];
      const dz = instance.position[2] - enterPosition[2];
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        best = instance;
        bestDistSq = distSq;
      }
    }
    return best;
  }

  private isActiveExitCallButtonInstance(world: GameWorld | null, instance: RawPlanInstance) {
    if (!isExitElevatorCallButtonModelKey(instance.modelKey)) return false;
    const cinematic = world?.session.activeExitCinematic;
    if (!world || !isExitCinematicViewActive(world) || !cinematic) return false;
    return this.exitCallButtonInstance(cinematic.enterPosition)?.id === instance.id;
  }

  private exitShaftInstance(enterPosition: readonly [number, number, number]) {
    const stage = this.nearestExitStageInstance(enterPosition);
    if (stage) return stage;
    let best: RawPlanInstance | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (const instance of this.sortedPlanInstances) {
      if (!isExitElevatorShaftModelKey(instance.modelKey)) continue;
      const dx = instance.position[0] - enterPosition[0];
      const dz = instance.position[2] - enterPosition[2];
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        best = instance;
        bestDistSq = distSq;
      }
    }
    return best;
  }

  private nearestExitStageInstance(enterPosition: readonly [number, number, number]) {
    let best: RawPlanInstance | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (const instance of this.sortedPlanInstances) {
      if (!isExitElevatorStageModelKey(instance.modelKey)) continue;
      const dx = instance.position[0] - enterPosition[0];
      const dz = instance.position[2] - enterPosition[2];
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        best = instance;
        bestDistSq = distSq;
      }
    }
    return best;
  }

  private isActiveExitShaftInstance(world: GameWorld | null, instance: RawPlanInstance) {
    if (!isExitElevatorShaftModelKey(instance.modelKey)) return false;
    const cinematic = world?.session.activeExitCinematic;
    if (!world || !isExitCinematicViewActive(world) || !cinematic) return false;
    return this.exitShaftInstance(cinematic.enterPosition)?.id === instance.id;
  }

  private writeExitShaftTexturedChunks(
    index: number,
    instance: RawPlanInstance,
    elapsed: number,
    shaft: ReturnType<typeof exitElevatorShaftVisualState>,
    drawBatches: RawDrawBatch[],
  ) {
    const geometry = this.geometryAssets.get(instance.modelKey) ?? this.geometryAssets.get("service_elevator_ascent_shaft_fx");
    const chunks = geometry?.nodeChunks?.filter((chunk) => isExitElevatorShaftMotionChunk(chunk.nodeName)) ?? [];
    if (!geometry || chunks.length === 0 || index >= MAX_INSTANCES) return index;

    for (let chunkIndex = 0; chunkIndex < chunks.length && index < MAX_INSTANCES; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      const name = chunk.nodeName ?? "";
      const isBeam = /crossbeam|marker|diodes|scan_band|louver/i.test(name);
      const speed = (isBeam ? 6.4 : 5.0) * shaft.speedMultiplier;
      const cycle = isBeam ? 3.05 : 3.55;
      const phase = (chunkIndex % 7) * 0.43;
      const alpha = isBeam ? 0.48 * shaft.beamOpacity : 0.56 * shaft.streakOpacity;
      if (alpha <= 0.015) continue;
      for (const repeatOffset of [0, cycle]) {
        if (index >= MAX_INSTANCES) break;
        const travel = (elapsed * speed + phase + repeatOffset) % cycle;
        const yOffset = 1.95 - travel;
        if (yOffset < -2.25 || yOffset > 2.35) continue;
        const localOffset: Tuple3 = [instance.localOffset[0], instance.localOffset[1] + yOffset, instance.localOffset[2]];
        this.writeRuntimeModelInstance(
          index,
          instance.position[0],
          this.groundedPlanInstanceY(instance, geometry),
          instance.position[2],
          instance.localOffset[1],
          instance.scale,
          instance.rotation[1],
          AUTHORED_MATERIAL_INSTANCE_COLOR,
          localOffset,
          instance.rotation,
        );
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent: true,
        });
        index += 1;
      }
    }
    return index;
  }

  private writeExitButtonPlungerChunks(
    world: GameWorld,
    index: number,
    instance: RawPlanInstance,
    pressDepthMeters: number,
    drawBatches: RawDrawBatch[],
  ) {
    const geometry = this.geometryAssets.get(instance.modelKey) ?? this.geometryAssets.get("service_elevator_call_buttons");
    const chunks = geometry?.nodeChunks?.filter((chunk) => isExitElevatorButtonMotionChunk(chunk.nodeName)) ?? [];
    if (!geometry || chunks.length === 0 || index >= MAX_INSTANCES) return index;

    const groundedY = this.groundedPlanInstanceY(instance, geometry);
    const doorOffset = this.openDoorVisualOffset(world, instance);
    const localOffset: Tuple3 = isExitElevatorStageModelKey(instance.modelKey)
      ? [instance.localOffset[0] + pressDepthMeters, instance.localOffset[1], instance.localOffset[2]]
      : [instance.localOffset[0], instance.localOffset[1], instance.localOffset[2] - pressDepthMeters];
    this.writeRuntimeModelInstance(
      index,
      instance.position[0] + doorOffset[0],
      groundedY + doorOffset[1],
      instance.position[2] + doorOffset[2],
      instance.localOffset[1],
      instance.scale,
      instance.rotation[1],
      modelInstanceColorForPlanInstance(instance),
      localOffset,
      instance.rotation,
    );
    for (const chunk of chunks) {
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: chunk.vertexOffset,
        vertexCount: chunk.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount),
      });
    }
    return index + 1;
  }

  private wallDoorSwitchVisualKey(world: GameWorld) {
    const switches = (world.level.switches ?? []).filter(
      (definition) => definition.presentation?.kind === "wall_lever" || definition.presentation?.kind === "wall_button",
    );
    if (switches.length === 0) return "";
    return switches
      .map((definition) => {
        const stateId = world.activeSwitchStateId(definition.id) ?? "";
        const active = world.session.activeHandInteraction?.switchId === definition.id ? world.session.activeHandInteraction : null;
        if (!active) return `${definition.id}:${stateId}:idle`;
        const progress = Math.round(clamp(active.elapsed / Math.max(0.05, active.commitAt), 0, 1) * 30);
        return `${definition.id}:${stateId}:${active.committed ? "done" : "pull"}:${active.leverDirection ?? "auto"}:${progress}`;
      })
      .join("|");
  }

  private wallDoorSwitchLeverOffset(world: GameWorld, definition: LevelSwitchDefinition) {
    const currentPosition = wallDoorSwitchLeverPositionForState(definition, world.activeSwitchStateId(definition.id));
    const active = world.session.activeHandInteraction?.switchId === definition.id ? world.session.activeHandInteraction : null;
    if (!active || active.committed) return wallDoorSwitchLeverOffsetForPosition(currentPosition);
    const targetPosition = active.leverDirection ?? (currentPosition === "up" ? "down" : "up");
    const progress = smooth01(clamp(active.elapsed / Math.max(0.05, active.commitAt), 0, 1));
    const from = wallDoorSwitchLeverOffsetForPosition(currentPosition);
    const to = wallDoorSwitchLeverOffsetForPosition(targetPosition);
    return from + (to - from) * progress;
  }

  private writeEnemyInstance(index: number, enemy: GameWorld["enemies"][number], color: Tuple4, drawBatches: RawDrawBatch[]) {
    const modelKey = modelKeyForEnemy(enemy);
    const geometry = modelKey ? this.geometryAssets.get(modelKey) : null;
    if (!modelKey || !geometry || geometry.vertexCount <= 0 || !geometry.bounds) {
      const scale = Math.max(0.8, enemy.visualScaleMultiplier);
      const nextIndex = this.writeBox(index, enemy.position.x, enemy.position.y + 0.9 * scale, enemy.position.z, enemy.radius * 1.5, 1.75 * scale, enemy.radius * 1.5, color);
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "proxy",
        vertexOffset: 0,
        vertexCount: CUBE_VERTEX_COUNT,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
      return nextIndex;
    }

    const clipIndex = this.writeEnemyClipModelInstances(index, enemy, modelKey, geometry, color, drawBatches);
    if (clipIndex > index) return clipIndex;

    this.writeEnemyStaticModelInstance(index, enemy, modelKey, geometry, color);
    this.appendDrawBatch(drawBatches, {
      vertexBuffer: "geometry",
      vertexOffset: geometry.vertexOffset,
      vertexCount: geometry.vertexCount,
      instanceOffset: index,
      instanceCount: 1,
      transparent: this.isTransparentGeometryRange(geometry.vertexOffset, geometry.vertexCount),
    });
    return index + 1;
  }

  private writeDeployedUltimateInstance(
    index: number,
    deployedUltimate: NonNullable<GameWorld["session"]["deployedUltimate"]>,
    drawBatches: RawDrawBatch[],
  ) {
    const [x, y, z] = deployedUltimate.position;
    const age = deployedUltimate.age;
    if (deployedUltimate.phase === "held") return index;
    if (age < 0) return index;
    const isThrown = deployedUltimate.phase === "thrown";
    const pulse = 0.82 + Math.sin(age * 6.8 + deployedUltimate.id * 0.11) * 0.18;
    const deployGrow = smooth01(age / 0.12);

    if (!isThrown && index < MAX_INSTANCES) {
      index = this.writeGroundPlane(index, x, y + 0.022, z, 1.68 * pulse, 1.34 * pulse, [0.14, 0.72, 1.0, 0.3]);
      this.appendShadowDrawBatch(drawBatches, index - 1);
    }

    if (!isThrown && index < MAX_INSTANCES) {
      index = this.writeShadowPlane(index, x + 0.04, y + 0.018, z - 0.03, 0.82, 0.56, 0.18);
      this.appendShadowDrawBatch(drawBatches, index - 1);
      this.dynamicShadowPlaneCount += 1;
    }

    if (index < MAX_INSTANCES) {
      index = this.writeDeployedUltimateCoreModel(index, deployedUltimate, x, y, z, age, isThrown ? 1.0 : 0.88 + deployGrow * 0.16, drawBatches);
    }

    return index;
  }

  private writeDeployedUltimateCoreModel(
    index: number,
    deployedUltimate: NonNullable<GameWorld["session"]["deployedUltimate"]>,
    x: number,
    y: number,
    z: number,
    age: number,
    scaleMultiplier: number,
    drawBatches: RawDrawBatch[],
  ) {
    const ability = ultimateAbilityConfig[deployedUltimate.abilityId] ?? ultimateAbilityConfig[defaultUltimateAbilityId];
    const modelKey: string = ability.deployedWorldModelKey;
    if (modelKey === "ability_core_bomb_proxy") {
      return this.writeCoreBombProxyModel(index, x, y, z, age, scaleMultiplier, drawBatches);
    }

    const color = roleColors.pickup_coreCell;
    if (modelKey !== "pickup_energy_cell_amber") {
      const geometry = this.geometryAssets.get(modelKey);
      if (geometry && geometry.vertexCount > 0) {
        this.writeRuntimeModelInstance(index, x, y, z, 0, scaleMultiplier, age * 0.74, color);
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: geometry.vertexOffset,
          vertexCount: geometry.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent: this.isTransparentGeometryRange(geometry.vertexOffset, geometry.vertexCount),
        });
        return index + 1;
      }
      return this.writeCoreBombProxyModel(index, x, y, z, age, scaleMultiplier, drawBatches);
    }

    const pickupAsset = pickupGeometryForType("coreCell");
    const geometry = pickupAsset ? this.geometryAssets.get(pickupAsset.modelKey) : null;
    if (!pickupAsset || !geometry || geometry.vertexCount <= 0) {
      return this.writeCoreBombProxyModel(index, x, y, z, age, scaleMultiplier, drawBatches);
    }

    const scale =
      typeof pickupAsset.scale === "number"
        ? pickupAsset.scale * scaleMultiplier
        : (pickupAsset.scale.map((value) => value * scaleMultiplier) as Tuple3);
    this.writeRuntimeModelInstance(index, x, y, z, pickupAsset.localYOffset, scale, age * 0.74, color, pickupAsset.localOffset, pickupAsset.rotation);
    const chunks = geometry.nodeChunks ?? [];
    if (chunks.length <= 0) {
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: geometry.vertexOffset,
        vertexCount: geometry.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: this.isTransparentGeometryRange(geometry.vertexOffset, geometry.vertexCount),
      });
      return index + 1;
    }
    for (const chunk of chunks) {
      if (rawCoreCellNodeHidden(chunk.nodeName)) continue;
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: chunk.vertexOffset,
        vertexCount: chunk.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount),
      });
    }
    return index + 1;
  }

  private writeCoreBombProxyModel(
    index: number,
    x: number,
    y: number,
    z: number,
    age: number,
    scaleMultiplier: number,
    drawBatches: RawDrawBatch[],
  ) {
    const spin = age * 0.72;
    const s = Math.max(0.72, scaleMultiplier);
    index = this.writeProxyCube(index, drawBatches, x, y + 0.34 * s, z, 0.48 * s, 0.42 * s, 0.48 * s, [0.018, 0.024, 0.026, 1], spin);
    index = this.writeProxyCube(index, drawBatches, x, y + 0.36 * s, z - 0.25 * s, 0.28 * s, 0.24 * s, 0.06 * s, [0.4, 0.96, 1.0, 0.92], spin);
    index = this.writeProxyCube(index, drawBatches, x, y + 0.62 * s, z, 0.3 * s, 0.08 * s, 0.3 * s, [0.94, 0.64, 0.22, 0.98], spin + 0.12);
    index = this.writeProxyCube(index, drawBatches, x, y + 0.08 * s, z, 0.32 * s, 0.08 * s, 0.32 * s, [0.94, 0.64, 0.22, 0.98], spin - 0.12);
    index = this.writeProxyCube(index, drawBatches, x, y + 0.36 * s, z, 0.62 * s, 0.05 * s, 0.62 * s, [0.94, 0.78, 0.34, 0.72], spin + Math.PI / 4);
    return index;
  }

  private writeProxyCube(
    index: number,
    drawBatches: RawDrawBatch[],
    x: number,
    y: number,
    z: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    color: Tuple4,
    yaw = 0,
  ) {
    if (index >= MAX_INSTANCES) return index;
    const instanceOffset = index;
    index = this.writeBox(index, x, y, z, sizeX, sizeY, sizeZ, color, yaw);
    this.appendDrawBatch(drawBatches, {
      vertexBuffer: "proxy",
      vertexOffset: 0,
      vertexCount: CUBE_VERTEX_COUNT,
      instanceOffset,
      instanceCount: 1,
      transparent: color[3] < 0.99,
    });
    return index;
  }

  private writePickupInstance(index: number, pickup: GameWorld["pickups"][number], drawBatches: RawDrawBatch[]) {
    const pickupAsset = pickupGeometryForType(pickup.type);
    const geometry = pickupAsset ? this.geometryAssets.get(pickupAsset.modelKey) : null;
    const color = pickupColorForType(pickup.type);
    if (!pickupAsset || !geometry || geometry.vertexCount <= 0) {
      const nextIndex = this.writeBox(index, pickup.position.x, pickup.position.y + 0.45, pickup.position.z, 0.42, 0.82, 0.42, color);
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "proxy",
        vertexOffset: 0,
        vertexCount: CUBE_VERTEX_COUNT,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
      return nextIndex;
    }

    if (pickup.type === "coreCell") {
      return this.writeCoreCellModel(index, pickup, pickupAsset, geometry, color, drawBatches);
    }

    this.writeRuntimeModelInstance(
      index,
      pickup.position.x,
      pickup.position.y,
      pickup.position.z,
      pickupAsset.localYOffset,
      pickupAsset.scale,
      0,
      color,
      pickupAsset.localOffset,
      pickupAsset.rotation,
    );
    const chunks = geometry.nodeChunks ?? [];
    if (chunks.length <= 0) {
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: geometry.vertexOffset,
        vertexCount: geometry.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: this.isTransparentGeometryRange(geometry.vertexOffset, geometry.vertexCount),
      });
      return index + 1;
    }
    // Draw per node-chunk so the image2 "wrap" faces (which render as black
    // spikes here) can be skipped — same treatment the energy cell already got.
    for (const chunk of chunks) {
      if (rawCoreCellNodeHidden(chunk.nodeName)) continue;
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: chunk.vertexOffset,
        vertexCount: chunk.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount),
      });
    }
    return index + 1;
  }

  private writeCoreCellModel(
    index: number,
    pickup: GameWorld["pickups"][number],
    pickupAsset: NonNullable<ReturnType<typeof pickupGeometryForType>>,
    geometry: RawPlanGeometryAsset,
    color: Tuple4,
    drawBatches: RawDrawBatch[],
  ) {
    const chunks = geometry.nodeChunks ?? [];
    if (chunks.length <= 0) {
      this.writeRuntimeModelInstance(index, pickup.position.x, pickup.position.y, pickup.position.z, pickupAsset.localYOffset, pickupAsset.scale, 0, color);
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: geometry.vertexOffset,
        vertexCount: geometry.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: this.isTransparentGeometryRange(geometry.vertexOffset, geometry.vertexCount),
      });
      return index + 1;
    }

    this.writeRuntimeModelInstance(index, pickup.position.x, pickup.position.y, pickup.position.z, pickupAsset.localYOffset, pickupAsset.scale, 0, color);
    for (const chunk of chunks) {
      if (rawCoreCellNodeHidden(chunk.nodeName)) continue;
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: chunk.vertexOffset,
        vertexCount: chunk.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount),
      });
    }
    return index + 1;
  }

  private writePlanInstance(world: GameWorld, index: number, instance: RawPlanInstance, drawBatches: RawDrawBatch[]) {
    const geometry =
      this.geometryAssets.get(instance.modelKey) ??
      (isExitElevatorCallButtonModelKey(instance.modelKey)
        ? this.geometryAssets.get("service_elevator_call_buttons")
        : isExitElevatorShaftModelKey(instance.modelKey)
          ? this.geometryAssets.get("service_elevator_ascent_shaft_fx")
          : undefined);
    const forceOpaque = rawInstanceShouldRemainOpaque(instance);
    if (!geometry || geometry.vertexCount <= 0) {
      const nextIndex = this.writePlanBox(world, index, instance);
      drawBatches.push({
        vertexBuffer: "proxy",
        vertexOffset: 0,
        vertexCount: CUBE_VERTEX_COUNT,
        instanceOffset: index,
        instanceCount: 1,
        transparent: !forceOpaque && this.transparentInstanceIds.has(instance.id),
      });
      return nextIndex;
    }

    if (isExitElevatorStageModelKey(instance.modelKey) && this.isActiveExitCallButtonInstance(world, instance) && geometry.nodeChunks?.length) {
      this.writeModelInstance(world, index, instance, AUTHORED_MATERIAL_INSTANCE_COLOR, geometry);
      const cinematic = world.session.activeExitCinematic;
      const shaft = cinematic ? exitElevatorShaftVisualState(cinematic) : null;
      const shouldRevealShaft = (shaft?.reveal ?? 0) > 0.015 || (shaft?.ascent ?? 0) > 0.015;
      for (const chunk of geometry.nodeChunks) {
        if (isExitElevatorRuntimeMotionChunk(chunk.nodeName)) continue;
        if (isExitElevatorButtonRawHiddenChunk(chunk.nodeName)) continue;
        if (isExitElevatorShaftChunk(chunk.nodeName) && !shouldRevealShaft) continue;
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent:
            !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
        });
      }
      return index + 1;
    }

    if (isExitElevatorStageModelKey(instance.modelKey) && geometry.nodeChunks?.length) {
      this.writeModelInstance(world, index, instance, AUTHORED_MATERIAL_INSTANCE_COLOR, geometry);
      for (const chunk of geometry.nodeChunks) {
        if (isExitElevatorButtonRawHiddenChunk(chunk.nodeName)) continue;
        if (isExitElevatorShaftChunk(chunk.nodeName)) continue;
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent:
            !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
        });
      }
      return index + 1;
    }

    if (!this.isActiveExitCallButtonInstance(world, instance) && isExitElevatorCallButtonModelKey(instance.modelKey) && geometry.nodeChunks?.length) {
      this.writeModelInstance(world, index, instance, modelInstanceColorForPlanInstance(instance), geometry);
      for (const chunk of geometry.nodeChunks) {
        if (isExitElevatorButtonRawHiddenChunk(chunk.nodeName)) continue;
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent:
            !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
        });
      }
      return index + 1;
    }

    if (this.isActiveExitCallButtonInstance(world, instance) && geometry.nodeChunks?.length) {
      this.writeModelInstance(world, index, instance, modelInstanceColorForPlanInstance(instance), geometry);
      for (const chunk of geometry.nodeChunks) {
        if (isExitElevatorButtonMotionChunk(chunk.nodeName)) continue;
        if (isExitElevatorButtonRawHiddenChunk(chunk.nodeName)) continue;
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent:
            !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
        });
      }
      return index + 1;
    }

    if (isExitElevatorShaftModelKey(instance.modelKey) && !isExitElevatorStageModelKey(instance.modelKey) && !this.isActiveExitShaftInstance(world, instance)) {
      return index;
    }

    if (this.isActiveExitShaftInstance(world, instance) && geometry.nodeChunks?.length) {
      this.writeModelInstance(world, index, instance, AUTHORED_MATERIAL_INSTANCE_COLOR, geometry);
      for (const chunk of geometry.nodeChunks) {
        if (isExitElevatorShaftMotionChunk(chunk.nodeName)) continue;
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent:
            !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
        });
      }
      return index + 1;
    }

    if (isWallDoorSwitchModelKey(instance.modelKey) && geometry.nodeChunks?.some((chunk) => isWallDoorSwitchLeverMotionChunk(chunk.nodeName))) {
      return this.writeWallDoorSwitchModelInstance(world, index, instance, geometry, forceOpaque, drawBatches);
    }

    this.writeModelInstance(world, index, instance, modelInstanceColorForPlanInstance(instance), geometry);
    // Static key items reuse the pickup GLBs, whose image2 "wrap" face nodes
    // render as black spikes here. Baked as static instances (role key_item),
    // they bypass writePickupInstance's per-node skip — so draw them per
    // node-chunk too and skip the wrap faces. (See pickupNodeVisibility + guard.)
    const nodeChunks = geometry.nodeChunks ?? [];
    if (instance.role === "key_item" && nodeChunks.length > 0) {
      for (const chunk of nodeChunks) {
        if (rawCoreCellNodeHidden(chunk.nodeName)) continue;
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent:
            !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
        });
      }
      return index + 1;
    }
    if (isMuseumWallArtModelKey(instance.modelKey) && nodeChunks.length > 0) {
      for (const chunk of nodeChunks) {
        if (isMuseumWallArtOverlayNode(chunk.nodeName)) continue;
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: chunk.vertexOffset,
          vertexCount: chunk.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent:
            !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
        });
      }
      return index + 1;
    }
    this.appendDrawBatch(drawBatches, {
      vertexBuffer: "geometry",
      vertexOffset: geometry.vertexOffset,
      vertexCount: geometry.vertexCount,
      instanceOffset: index,
      instanceCount: 1,
      transparent:
        !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(geometry.vertexOffset, geometry.vertexCount)),
    });
    return index + 1;
  }

  private writeWallDoorSwitchModelInstance(
    world: GameWorld,
    index: number,
    instance: RawPlanInstance,
    geometry: RawPlanGeometryAsset,
    forceOpaque: boolean,
    drawBatches: RawDrawBatch[],
  ) {
    const chunks = geometry.nodeChunks ?? [];
    const motionChunks = chunks.filter((chunk) => isWallDoorSwitchLeverMotionChunk(chunk.nodeName));
    if (motionChunks.length === 0) return index;

    this.writeModelInstance(world, index, instance, modelInstanceColorForPlanInstance(instance), geometry);
    for (const chunk of chunks) {
      if (isWallDoorSwitchLeverMotionChunk(chunk.nodeName)) continue;
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: chunk.vertexOffset,
        vertexCount: chunk.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent:
          !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
      });
    }

    const motionIndex = index + 1;
    if (motionIndex >= MAX_INSTANCES) return motionIndex;
    const definition = instance.state?.interactionId ? world.switchForInteraction(instance.state.interactionId) : null;
    const leverOffsetY = definition ? this.wallDoorSwitchLeverOffset(world, definition) : 0;
    const groundedY = this.groundedPlanInstanceY(instance, geometry);
    const doorOffset = this.openDoorVisualOffset(world, instance);
    const movingLocalOffset: Tuple3 = [
      instance.localOffset[0],
      instance.localOffset[1] + leverOffsetY,
      instance.localOffset[2],
    ];
    this.writeRuntimeModelInstance(
      motionIndex,
      instance.position[0] + doorOffset[0],
      groundedY + doorOffset[1],
      instance.position[2] + doorOffset[2],
      instance.localOffset[1],
      instance.scale,
      instance.rotation[1],
      modelInstanceColorForPlanInstance(instance),
      movingLocalOffset,
      instance.rotation,
    );
    for (const chunk of motionChunks) {
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: chunk.vertexOffset,
        vertexCount: chunk.vertexCount,
        instanceOffset: motionIndex,
        instanceCount: 1,
        transparent:
          !forceOpaque && (this.transparentInstanceIds.has(instance.id) || this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount)),
      });
    }
    return motionIndex + 1;
  }

  private writePlanBox(world: GameWorld | null, index: number, instance: RawPlanInstance) {
    const bounds = instance.estimatedBounds;
    const sizeX = Math.max(bounds.halfSize[0] * 2, instance.role === "floor" ? 0.08 : 0.1);
    const sizeY = Math.max(bounds.halfSize[1] * 2, instance.role === "floor" ? 0.04 : 0.1);
    const sizeZ = Math.max(bounds.halfSize[2] * 2, instance.role === "floor" ? 0.08 : 0.1);
    return this.writeBox(index, bounds.center[0], bounds.center[1] + this.interactionRevealRiseOffset(world, instance), bounds.center[2], sizeX, sizeY, sizeZ, roleColors[instance.role] ?? roleColors.prop);
  }

  private writeBox(index: number, x: number, y: number, z: number, sizeX: number, sizeY: number, sizeZ: number, color: Tuple4, yaw = 0) {
    const offset = index * FLOATS_PER_INSTANCE;
    this.position.set(x, y, z);
    this.scale.set(sizeX, sizeY, sizeZ);
    if (yaw !== 0) {
      this.euler.set(0, yaw, 0);
      this.rotation.setFromEuler(this.euler);
      this.modelMatrix.compose(this.position, this.rotation, this.scale);
    } else {
      this.modelMatrix.compose(this.position, this.identityRotation, this.scale);
    }
    this.instanceFloats.set(this.modelMatrix.elements, offset);
    this.instanceFloats.set(color, offset + 16);
    this.instanceFloats.set(INSTANCE_ANIM_DISABLED, offset + 20);
    return index + 1;
  }

  private writeShadowPlane(index: number, x: number, y: number, z: number, sizeX: number, sizeZ: number, opacity: number) {
    // Global grounding tuning: opacity scales fully, footprint scales gently
    // (softer spread, not just darker). g=1 → legacy look; g=0 → off.
    const g = this.groundingScale;
    const spread = 1 + (g - 1) * 0.4;
    sizeX *= spread;
    sizeZ *= spread;
    opacity *= g;
    const grounding = this.ageVisualProfile?.grounding;
    if (grounding) {
      sizeX = Math.min(sizeX, grounding.maxRadius);
      sizeZ = Math.min(sizeZ, grounding.maxRadius);
      opacity *= grounding.strengthScale;
    }
    return this.writeGroundPlane(index, x, y, z, sizeX, sizeZ, [0.006, 0.012, 0.014, clamp(opacity, 0, 0.42)]);
  }

  private writeCoreCellGlowPlane(index: number, x: number, y: number, z: number, age: number) {
    const pulse = 0.88 + Math.sin(age * 4.7) * 0.12;
    return this.writeGroundPlane(index, x, y, z, 1.32 * pulse, 1.02 * pulse, [0.13, 0.58, 1.0, 0.24]);
  }

  private writeGroundPlane(index: number, x: number, y: number, z: number, sizeX: number, sizeZ: number, color: Tuple4) {
    const offset = index * FLOATS_PER_INSTANCE;
    this.position.set(x, y, z);
    this.scale.set(Math.max(0.05, sizeX), 1, Math.max(0.05, sizeZ));
    this.modelMatrix.compose(this.position, this.identityRotation, this.scale);
    this.instanceFloats.set(this.modelMatrix.elements, offset);
    this.instanceFloats.set(color, offset + 16);
    this.instanceFloats.set(INSTANCE_ANIM_DISABLED, offset + 20);
    return index + 1;
  }

  private writeModelInstance(
    world: GameWorld | null,
    index: number,
    instance: RawPlanInstance,
    color: Tuple4,
    geometry?: RawPlanGeometryAsset | null,
  ) {
    const groundedY = this.groundedPlanInstanceY(instance, geometry);
    const doorOffset = this.openDoorVisualOffset(world, instance);
    const revealRiseY = this.interactionRevealRiseOffset(world, instance, geometry, groundedY);
    this.writeRuntimeModelInstance(
      index,
      instance.position[0] + doorOffset[0],
      groundedY + doorOffset[1] + revealRiseY,
      instance.position[2] + doorOffset[2],
      instance.localOffset[1],
      instance.scale,
      instance.rotation[1],
      color,
      instance.localOffset,
      instance.rotation,
    );
  }

  private interactionRevealRiseOffset(
    world: GameWorld | null,
    instance: RawPlanInstance,
    geometry?: RawPlanGeometryAsset | null,
    groundedY = instance.position[1],
  ) {
    if (!world || !instance.state?.interactionId) return 0;
    const interaction = world.level.map?.interactions.find((candidate) => candidate.id === instance.state?.interactionId);
    return interaction ? interactionFocusRevealRiseOffsetY(world, interaction, this.interactionRevealDepthY(instance, geometry, groundedY)) : 0;
  }

  private interactionRevealDepthY(instance: RawPlanInstance, geometry?: RawPlanGeometryAsset | null, groundedY = instance.position[1]) {
    return Math.max(0.1, this.interactionVisualTopY(instance, geometry, groundedY) + 0.08);
  }

  private interactionVisualTopY(instance: RawPlanInstance, geometry?: RawPlanGeometryAsset | null, groundedY = instance.position[1]) {
    if (geometry?.bounds) {
      const scaleY = Math.max(0.0001, instance.scale[1]);
      const top = groundedY + instance.localOffset[1] + (geometry.bounds.min[1] + geometry.bounds.size[1]) * scaleY;
      if (Number.isFinite(top)) return top;
    }
    return instance.estimatedBounds.center[1] + instance.estimatedBounds.halfSize[1] + (groundedY - instance.position[1]);
  }

  private openDoorVisualOffset(world: GameWorld | null, instance: RawPlanInstance): Tuple3 {
    if (!world) return [0, 0, 0];
    // The lifting leaf carries its own animation in state. The door-status /
    // hardware panel (role "door_panel") is a sibling instance with no animation
    // of its own — it must reuse the leaf's lift via visibility.doorId so the
    // door-mounted hardware tracks the leaf instead of floating in the empty
    // doorway after the leaf rises away.
    let doorId: string | undefined;
    let animation: RawPlanState["openAnimation"];
    if (instance.role === "door_leaf") {
      doorId = instance.state?.doorId;
      animation = instance.state?.openAnimation;
    } else if (instance.role === "door_panel" && instance.visibility.type === "door") {
      doorId = instance.visibility.doorId;
      animation = doorId ? this.doorLeafAnimation.get(doorId) : null;
    } else {
      return [0, 0, 0];
    }
    if (animation?.type !== "vertical_lift") return [0, 0, 0];
    if (!doorId) return [0, 0, 0];
    const distance = Math.max(0, Number(animation.distance ?? 1.05));
    const progress = this.doorVisualProgress.get(doorId) ?? (world.isDoorOpen(doorId) ? 1 : 0);
    if (progress <= 0.002) return [0, 0, 0];
    const easedProgress = 1 - Math.pow(1 - clamp(progress, 0, 1), 3);
    const axis = animation.axis ?? "y";
    if (axis === "x") return [distance * easedProgress, 0, 0];
    if (axis === "z") return [0, 0, distance * easedProgress];
    return [0, distance * easedProgress, 0];
  }

  private updateDoorVisualProgress(world: GameWorld) {
    const now = performance.now();
    const dt = this.lastDoorVisualUpdateMs > 0 ? clamp((now - this.lastDoorVisualUpdateMs) / 1000, 0, 0.08) : 0;
    this.lastDoorVisualUpdateMs = now;
    // When a door is the active focus-reveal target, drive its lift from the
    // reveal timeline instead of the (fast) exponential ease, so the slow-open
    // is paced to the camera handoff: hold off until the camera arrives, then
    // lift over ~1.4s while the camera holds. Without this the door snaps fully
    // open in ~0.25s — before the camera even reaches it — and the reveal frames
    // an already-open door.
    const reveal = world.session.activeFocusReveal;
    const revealDoorId = reveal && reveal.kind === "door" ? reveal.targetId : null;
    let animating = false;
    for (const door of world.level.map?.doors ?? []) {
      const open = world.isDoorOpen(door.id);
      const target = open ? 1 : 0;
      const revision = world.doorTransitionRevision(door.id);
      const consumedRevision = this.doorTransitionRevision.get(door.id);
      const activeReveal = revealDoorId === door.id ? reveal : null;
      const queuedReveal = world.session.doorRevealQueue.some((item) => item.doorId === door.id);
      let current = this.doorVisualProgress.get(door.id);
      if (current === undefined) {
        // Authored-open doors should not animate on level load. Doors that were
        // opened/closed by runtime config actions carry a transition revision,
        // so even if Raw first sees them after GameWorld changed state, it can
        // still start from the proper side of the movement.
        current = revision > 0 ? (open ? 0 : 1) : target;
      } else if (consumedRevision !== undefined && revision !== consumedRevision) {
        current = open ? 0 : 1;
      }
      this.doorTransitionRevision.set(door.id, revision);

      if (queuedReveal && revision > 0 && !activeReveal) {
        this.doorVisualProgress.set(door.id, current);
        animating = true;
        continue;
      }

      if (activeReveal && revision > 0) {
        // Reveal-synced movement: keep the door at its start pose until the
        // camera arrives, then open or close during the hold.
        const paced = clamp((activeReveal.elapsed - REVEAL_DOOR_LIFT_START) / REVEAL_DOOR_LIFT_DURATION, 0, 1);
        const eased = paced <= 0 ? 0 : 1 - Math.pow(1 - paced, 2);
        const revealOpens = activeReveal.doorMode === "open" ? true : activeReveal.doorMode === "close" ? false : open;
        const visualTarget = revealOpens ? 1 : 0;
        const revealTarget = revealOpens ? eased : 1 - eased;
        const next = revealOpens ? Math.max(current, revealTarget) : Math.min(current, revealTarget);
        const snapped = Math.abs(next - visualTarget) < 0.002 ? visualTarget : next;
        this.doorVisualProgress.set(door.id, snapped);
        if (snapped !== visualTarget) animating = true;
        continue;
      }

      const speed = Math.max(0.35, door.openSpeed ?? 1.2);
      const next = current + (target - current) * (1 - Math.exp(-speed * 5.5 * dt));
      const snapped = Math.abs(next - target) < 0.002 ? target : next;
      this.doorVisualProgress.set(door.id, snapped);
      if (snapped !== target) animating = true;
    }
    return animating;
  }

  private groundedPlanInstanceY(instance: RawPlanInstance, geometry?: RawPlanGeometryAsset | null) {
    if (!this.shouldGroundPlanInstance(instance)) return instance.position[1];
    const targetBottom = instance.role.startsWith("pickup_") || instance.role === "key_item" ? 0.055 : 0.018;
    if (geometry?.bounds) {
      const scaleY = Array.isArray(instance.scale) ? instance.scale[1] : instance.scale;
      const bottom = instance.position[1] + instance.localOffset[1] + geometry.bounds.min[1] * Math.max(0.0001, scaleY);
      if (Number.isFinite(bottom)) {
        if (bottom >= targetBottom - 0.004) return instance.position[1];
        return instance.position[1] + (targetBottom - bottom);
      }
    }
    const bounds = instance.estimatedBounds;
    const bottom = bounds.center[1] - bounds.halfSize[1];
    if (bottom >= targetBottom - 0.004) return instance.position[1];
    return instance.position[1] + (targetBottom - bottom);
  }

  private shouldGroundPlanInstance(instance: RawPlanInstance) {
    if (rawInstanceShouldRemainOpaque(instance)) return false;
    if (instance.role === "door_leaf") return false;
    if (instance.role === "prop") return false;
    if (instance.role === "key_item" || instance.role === "door_panel") return true;
    if (instance.role.startsWith("pickup_") || instance.role.startsWith("interaction_")) return true;
    return false;
  }

  private writeRuntimeModelInstance(
    index: number,
    x: number,
    y: number,
    z: number,
    localYOffset: number,
    scale: number | Tuple3,
    yaw: number,
    color: Tuple4,
    localOffsetInput?: Tuple3,
    rotationInput?: Tuple3,
  ) {
    const offset = index * FLOATS_PER_INSTANCE;
    this.position.set(x, y, z);
    this.localOffset.fromArray(localOffsetInput ?? [0, localYOffset, 0]);
    if (typeof scale === "number") this.scale.setScalar(scale);
    else this.scale.fromArray(scale);
    const rotation = rotationInput ?? [0, yaw, 0];
    this.euler.set(rotation[0], rotation[1], rotation[2], "XYZ");
    this.rotation.setFromEuler(this.euler);
    this.rootMatrix.compose(this.position, this.rotation, new Vector3(1, 1, 1));
    this.localOffsetMatrix.makeTranslation(this.localOffset.x, this.localOffset.y, this.localOffset.z);
    this.localScaleMatrix.makeScale(this.scale.x, this.scale.y, this.scale.z);
    this.modelMatrix.multiplyMatrices(this.rootMatrix, this.localOffsetMatrix).multiply(this.localScaleMatrix);
    this.instanceFloats.set(this.modelMatrix.elements, offset);
    this.instanceFloats.set(color, offset + 16);
    this.instanceFloats.set(INSTANCE_ANIM_DISABLED, offset + 20);
  }

  private writeEnemyClipModelInstances(
    index: number,
    enemy: GameWorld["enemies"][number],
    modelKey: EnemyModelKey,
    geometry: RawPlanGeometryAsset,
    color: Tuple4,
    drawBatches: RawDrawBatch[],
  ) {
    const chunks = geometry.nodeChunks ?? [];
    const sampler = this.robotAnimationSampler;
    if (!sampler || !canUseRawEnemyBakedAnimation(modelKey, geometry) || chunks.length <= 0 || !sampler.hasModel(modelKey)) return index;
    if (index + chunks.length > MAX_INSTANCES) return index;

    const playback = this.enemyClipPlayback(enemy, modelKey);
    const pose = sampler.sample(modelKey, playback.action, playback.timeSeconds, playback.loop);
    if (!pose) return index;

    const rigidSkin = geometry.rigidSkin;
    if (rigidSkin?.mode === "rigid-node-palette" && rigidSkin.jointCount > 0 && canUseRigidNodePalette(geometry)) {
      const jointCount = Math.min(rigidSkin.jointCount, pose.worldMatrices.length);
      if (jointCount > 0 && this.robotJointMatrixCount + jointCount <= MAX_ROBOT_JOINT_MATRICES && index < MAX_INSTANCES) {
        const paletteOffset = this.robotJointMatrixCount;
        this.writeEnemyRobotJointPalette(paletteOffset, jointCount, pose, chunks);
        this.robotJointMatrixCount += jointCount;
        const offset = index * FLOATS_PER_INSTANCE;
        this.composeEnemyBaseModelMatrix(enemy, modelKey, geometry, this.modelMatrix);
        this.instanceFloats.set(this.modelMatrix.elements, offset);
        this.instanceFloats.set(color, offset + 16);
        this.instanceFloats.set([1, paletteOffset, jointCount, 0], offset + 20);
        this.appendDrawBatch(drawBatches, {
          vertexBuffer: "geometry",
          vertexOffset: geometry.vertexOffset,
          vertexCount: geometry.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent: this.isTransparentGeometryRange(geometry.vertexOffset, geometry.vertexCount),
        });
        return index + 1;
      }
    }

    this.composeEnemyBaseModelMatrix(enemy, modelKey, geometry, this.enemyBaseModelMatrix);
    let nextIndex = index;
    for (const chunk of chunks) {
      if (nextIndex >= MAX_INSTANCES) break;
      const offset = nextIndex * FLOATS_PER_INSTANCE;
      if (chunk.nodeIndex !== null && pose.worldMatrices[chunk.nodeIndex] && chunk.inverseBindMatrix.length === 16) {
        this.enemyChunkInverseBindMatrix.fromArray(chunk.inverseBindMatrix);
        this.enemyChunkDeltaMatrix.multiplyMatrices(pose.worldMatrices[chunk.nodeIndex], this.enemyChunkInverseBindMatrix);
        if (this.isUsableEnemyChunkDelta(this.enemyChunkDeltaMatrix)) {
          this.modelMatrix.multiplyMatrices(this.enemyBaseModelMatrix, this.enemyChunkDeltaMatrix);
        } else {
          this.modelMatrix.copy(this.enemyBaseModelMatrix);
        }
      } else {
        this.modelMatrix.copy(this.enemyBaseModelMatrix);
      }
      this.instanceFloats.set(this.modelMatrix.elements, offset);
      this.instanceFloats.set(color, offset + 16);
      this.instanceFloats.set(INSTANCE_ANIM_DISABLED, offset + 20);
      this.appendDrawBatch(drawBatches, {
        vertexBuffer: "geometry",
        vertexOffset: chunk.vertexOffset,
        vertexCount: chunk.vertexCount,
        instanceOffset: nextIndex,
        instanceCount: 1,
        transparent: this.isTransparentGeometryRange(chunk.vertexOffset, chunk.vertexCount),
      });
      nextIndex += 1;
    }
    return nextIndex;
  }

  private writeEnemyRobotJointPalette(
    paletteOffset: number,
    jointCount: number,
    pose: NonNullable<ReturnType<RawRobotAnimationSampler["sample"]>>,
    chunks: RawPlanGeometryAsset["nodeChunks"],
  ) {
    for (let jointIndex = 0; jointIndex < jointCount; jointIndex += 1) {
      this.robotJointMatrixFloats.set(this.identityMatrix.elements, (paletteOffset + jointIndex) * ROBOT_JOINT_MATRIX_FLOATS);
    }

    for (const chunk of chunks ?? []) {
      const nodeIndex = chunk.nodeIndex;
      if (nodeIndex === null || nodeIndex < 0 || nodeIndex >= jointCount) continue;
      const worldMatrix = pose.worldMatrices[nodeIndex];
      if (!worldMatrix || chunk.inverseBindMatrix.length !== 16) continue;
      this.enemyChunkInverseBindMatrix.fromArray(chunk.inverseBindMatrix);
      this.robotJointMatrix.multiplyMatrices(worldMatrix, this.enemyChunkInverseBindMatrix);
      if (!this.isUsableEnemyChunkDelta(this.robotJointMatrix)) continue;
      this.robotJointMatrixFloats.set(this.robotJointMatrix.elements, (paletteOffset + nodeIndex) * ROBOT_JOINT_MATRIX_FLOATS);
    }
  }

  private isUsableEnemyChunkDelta(matrix: Matrix4) {
    matrix.decompose(this.enemyChunkDeltaPosition, this.enemyChunkDeltaRotation, this.enemyChunkDeltaScale);
    const maxScale = Math.max(
      Math.abs(this.enemyChunkDeltaScale.x),
      Math.abs(this.enemyChunkDeltaScale.y),
      Math.abs(this.enemyChunkDeltaScale.z),
    );
    const minScale = Math.min(
      Math.abs(this.enemyChunkDeltaScale.x),
      Math.abs(this.enemyChunkDeltaScale.y),
      Math.abs(this.enemyChunkDeltaScale.z),
    );
    return (
      Number.isFinite(maxScale) &&
      Number.isFinite(minScale) &&
      maxScale <= 2.75 &&
      minScale >= 0.005 &&
      this.enemyChunkDeltaPosition.lengthSq() <= 36
    );
  }

  private writeRobotJointMatrixBuffer() {
    if (this.robotJointMatrixCount <= 0) return;
    this.device.queue.writeBuffer(
      this.robotJointMatrixBuffer,
      0,
      this.robotJointMatrixFloats,
      0,
      this.robotJointMatrixCount * ROBOT_JOINT_MATRIX_FLOATS,
    );
  }

  private enemyClipPlayback(enemy: GameWorld["enemies"][number], modelKey: EnemyModelKey) {
    const sampler = this.robotAnimationSampler;
    const archetype = enemyArchetypes[enemy.archetypeId];
    const cooldown = archetype.attackCooldown * enemy.attackCooldownMultiplier;
    const sinceAttack = cooldown - enemy.attackCooldownRemaining;

    if (!enemy.isAlive) {
      const duration = sampler?.clipDuration(modelKey, "death") ?? 0.7;
      return { action: "death", timeSeconds: Math.min(enemy.deathAge, duration), loop: false };
    }
    if (enemy.spawnAge < 0.44) {
      return { action: "spawn_boot", timeSeconds: enemy.spawnAge, loop: false };
    }

    if (enemy.staggerRemaining > 0) {
      const staggerAge = Math.max(0, enemy.staggerTotal - enemy.staggerRemaining);
      return { action: "stagger", timeSeconds: staggerAge, loop: false };
    }

    if (enemy.attackWindupRemaining > 0) {
      const windupAge = Math.max(0, enemy.attackWindupTotal - enemy.attackWindupRemaining);
      return { action: "attack_windup", timeSeconds: windupAge, loop: false };
    }

    if (sinceAttack >= 0 && sinceAttack < 0.24) return { action: "attack_windup", timeSeconds: sinceAttack, loop: false };
    if (sinceAttack >= 0.24 && sinceAttack < 0.58) return { action: "attack_strike", timeSeconds: sinceAttack - 0.24, loop: false };
    if (sinceAttack >= 0.58 && sinceAttack < 0.98) return { action: "attack_recover", timeSeconds: sinceAttack - 0.58, loop: false };

    if (enemy.velocity.lengthSq() > 0.04) {
      return { action: "move", timeSeconds: enemy.spawnAge, loop: true };
    }
    return { action: "idle", timeSeconds: enemy.spawnAge, loop: true };
  }

  private writeEnemyStaticModelInstance(
    index: number,
    enemy: GameWorld["enemies"][number],
    modelKey: EnemyModelKey,
    geometry: RawPlanGeometryAsset,
    color: Tuple4,
  ) {
    const offset = index * FLOATS_PER_INSTANCE;
    this.composeEnemyBaseModelMatrix(enemy, modelKey, geometry, this.modelMatrix);
    this.instanceFloats.set(this.modelMatrix.elements, offset);
    this.instanceFloats.set(color, offset + 16);
    this.instanceFloats.set(INSTANCE_ANIM_DISABLED, offset + 20);
  }

  private writeEnemyModelInstance(
    index: number,
    enemy: GameWorld["enemies"][number],
    modelKey: EnemyModelKey,
    geometry: RawPlanGeometryAsset,
    color: Tuple4,
  ) {
    this.writeEnemyStaticModelInstance(index, enemy, modelKey, geometry, color);
  }

  private composeEnemyBaseModelMatrix(
    enemy: GameWorld["enemies"][number],
    modelKey: EnemyModelKey,
    geometry: RawPlanGeometryAsset,
    outMatrix: Matrix4,
  ) {
    const bounds = geometry.bounds ?? { min: [0, 0, 0] as Tuple3, center: [0, 0, 0] as Tuple3, size: [1, 1, 1] as Tuple3 };
    const targetHeight = enemyModelTargetHeight(enemy, modelKey);
    const normalization = targetHeight / Math.max(0.01, bounds.size[1]);
    const archetype = enemyArchetypes[enemy.archetypeId];
    const attackKick = rawEnemyAttackKick(enemy, archetype.attackCooldown * enemy.attackCooldownMultiplier);
    const deathProgress = enemy.isAlive ? 0 : Math.min(1, enemy.deathAge / 0.62);
    const spawnEased = enemySpawnProgress(enemy);
    const idleRootBob = enemy.archetypeId === "repair_drone" ? 0.006 : 0.002;
    const bossProfile = bossVisualProfileForEnemy(this.plan.rawArtDirection?.levelId ?? "", enemy);
    const largeHitTarget = Boolean(bossProfile) || enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss";
    const poseTuning = bossProfile ? bossPoseTuningForEnemy(this.plan.rawArtDirection?.levelId ?? "", enemy) : null;
    const bossPoseScale = poseTuning?.staggerPoseMultiplier ?? (enemy.tier === "boss" ? 1.22 : enemy.tier === "leader" ? 1.1 : 1);
    const staggerScale = poseTuning ? 1 : bossPoseScale;
    const hitReactVisual = enemy.hitReact * (largeHitTarget ? (poseTuning?.hitReactMultiplier ?? (enemy.tier === "boss" ? 1.78 : 1.56)) : 1);
    const staggerPose = largeHitTarget ? rawEnemyStaggerPoseAmount(enemy) : 0;
    this.position.copy(enemy.position);
    this.position.addScaledVector(
      enemy.lastHitDirection,
      hitReactVisual * (poseTuning?.rootHitPush ?? 0.24) + staggerPose * (poseTuning?.rootStaggerPush ?? 0.28) * staggerScale + deathProgress * 0.42,
    );
    this.position.y +=
      enemyModelAltitude(enemy) +
      Math.sin(enemy.spawnAge * 2 + enemy.id) * idleRootBob +
      attackKick * 0.018 +
      hitReactVisual * (poseTuning?.verticalHitLift ?? 0.038) +
      staggerPose * (poseTuning?.verticalStaggerLift ?? 0.08) * staggerScale +
      deathProgress * 0.18 +
      (1 - spawnEased) * 0.34;
    this.euler.set(
      deathProgress * 0.12 - staggerPose * (poseTuning?.pitchStagger ?? 0.1) * staggerScale - hitReactVisual * (largeHitTarget ? 0.022 : 0),
      enemy.rotationY,
      enemy.lastHitDirection.x * deathProgress * 0.18 +
        hitReactVisual * 0.018 +
        enemy.lastHitDirection.x * staggerPose * (poseTuning?.rollStagger ?? 0.16) * staggerScale,
      "XYZ",
    );
    this.rotation.setFromEuler(this.euler);
    this.scale.setScalar(
      enemy.visualScaleMultiplier *
        (0.34 + 0.66 * spawnEased) *
        (1 + hitReactVisual * (poseTuning?.scaleHit ?? 0.024) + staggerPose * (poseTuning?.scaleStagger ?? 0.018) - deathProgress * 0.42),
    );
    this.rootMatrix.compose(this.position, this.rotation, this.scale);
    this.localOffsetMatrix.makeTranslation(-bounds.center[0] * normalization, -bounds.min[1] * normalization, -bounds.center[2] * normalization);
    this.localScaleMatrix.makeScale(normalization, normalization, normalization);
    outMatrix.multiplyMatrices(this.rootMatrix, this.localOffsetMatrix).multiply(this.localScaleMatrix);
  }

  private appendDrawBatch(drawBatches: RawDrawBatch[], batch: RawDrawBatch) {
    const previous = drawBatches[drawBatches.length - 1];
    if (
      previous &&
      previous.vertexBuffer === batch.vertexBuffer &&
      previous.vertexOffset === batch.vertexOffset &&
      previous.vertexCount === batch.vertexCount &&
      previous.transparent === batch.transparent &&
      previous.instanceOffset + previous.instanceCount === batch.instanceOffset
    ) {
      previous.instanceCount += batch.instanceCount;
      return;
    }
    drawBatches.push(batch);
  }

  private appendShadowDrawBatch(drawBatches: RawDrawBatch[], instanceOffset: number) {
    this.appendDrawBatch(drawBatches, {
      vertexBuffer: "shadow",
      vertexOffset: 0,
      vertexCount: 6,
      instanceOffset,
      instanceCount: 1,
      transparent: false,
    });
  }

  private isTransparentGeometryRange(vertexOffset: number, vertexCount: number) {
    if (this.transparentMaterialIndices.size === 0 || vertexCount <= 0) return false;
    const rangeKey = `${vertexOffset}:${vertexCount}`;
    const cached = this.transparentRangeCache.get(rangeKey);
    if (cached !== undefined) return cached;

    const end = Math.min(vertexOffset + vertexCount, Math.floor(this.geometryVertexFloats.length / FLOATS_PER_VERTEX));
    for (let vertexIndex = Math.max(0, vertexOffset); vertexIndex < end; vertexIndex += 1) {
      const materialIndex = Math.round(this.geometryVertexFloats[vertexIndex * FLOATS_PER_VERTEX + VERTEX_MATERIAL_INDEX_COMPONENT] ?? -1);
      if (this.transparentMaterialIndices.has(materialIndex)) {
        this.transparentRangeCache.set(rangeKey, true);
        return true;
      }
    }
    this.transparentRangeCache.set(rangeKey, false);
    return false;
  }

  private writePlanShadowInstance(index: number, instance: RawPlanInstance, drawBatches: RawDrawBatch[]) {
    const shadow = planShadowFor(instance);
    if (!shadow) return index;
    const nextIndex = this.writeShadowPlane(index, shadow.x, shadow.y, shadow.z, shadow.sizeX, shadow.sizeZ, shadow.opacity);
    this.appendShadowDrawBatch(drawBatches, index);
    return nextIndex;
  }

  private comparePlanInstanceDrawOrder(left: RawPlanInstance, right: RawPlanInstance) {
    const leftGeometry = this.geometryAssets.get(left.modelKey);
    const rightGeometry = this.geometryAssets.get(right.modelKey);
    const leftBuffer = leftGeometry && leftGeometry.vertexCount > 0 ? 0 : 1;
    const rightBuffer = rightGeometry && rightGeometry.vertexCount > 0 ? 0 : 1;
    if (leftBuffer !== rightBuffer) return leftBuffer - rightBuffer;
    const leftVertexOffset = leftGeometry?.vertexOffset ?? 0;
    const rightVertexOffset = rightGeometry?.vertexOffset ?? 0;
    if (leftVertexOffset !== rightVertexOffset) return leftVertexOffset - rightVertexOffset;
    const leftVertexCount = leftGeometry?.vertexCount ?? CUBE_VERTEX_COUNT;
    const rightVertexCount = rightGeometry?.vertexCount ?? CUBE_VERTEX_COUNT;
    if (leftVertexCount !== rightVertexCount) return leftVertexCount - rightVertexCount;
    return left.id.localeCompare(right.id);
  }

  private createGeometryVertexBuffer(geometryBuffer: ArrayBuffer) {
    const buffer = this.device.createBuffer({
      size: Math.max(4, geometryBuffer.byteLength),
      usage: this.gpuGlobals.GPUBufferUsage.VERTEX | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    if (geometryBuffer.byteLength > 0) {
      this.device.queue.writeBuffer(buffer, 0, geometryBuffer);
    }
    return buffer;
  }

  private createProxyVertexBuffer() {
    const vertices = createUnitCubeVertices();
    const buffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: this.gpuGlobals.GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(vertices);
    buffer.unmap();
    return buffer;
  }

  private createShadowVertexBuffer() {
    const vertices = createShadowPlaneVertices();
    const buffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: this.gpuGlobals.GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(vertices);
    buffer.unmap();
    return buffer;
  }

  private createHeroFloorVertexBuffer() {
    const vertices: number[] = [];
    const y = HERO_FLOOR_Y;
    const rooms = this.plan.rooms.length > 0 ? this.plan.rooms : [{ bounds: { center: [0, 0, 0] as Tuple3, size: [18, 4, 12] as Tuple3 } }];
    for (const room of rooms) {
      const center = room.bounds.center;
      const size = room.bounds.size;
      const minX = center[0] - size[0] * 0.492;
      const maxX = center[0] + size[0] * 0.492;
      const minZ = center[2] - size[2] * 0.492;
      const maxZ = center[2] + size[2] * 0.492;
      vertices.push(
        minX, y, minZ, 0, 1,
        maxX, y, minZ, 1, 1,
        maxX, y, maxZ, 1, 0,
        minX, y, minZ, 0, 1,
        maxX, y, maxZ, 1, 0,
        minX, y, maxZ, 0, 0,
      );
    }
    const vertexData = new Float32Array(vertices);
    const buffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: this.gpuGlobals.GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(vertexData);
    buffer.unmap();
    return { buffer, vertexCount: vertexData.length / HERO_FLOOR_VERTEX_FLOATS };
  }

  private createMaterialBuffer(plan: RawRenderPlan) {
    const materialFloats = rawMaterialFloatsFor(plan);
    const buffer = this.device.createBuffer({
      size: Math.max(4, materialFloats.byteLength),
      usage: this.gpuGlobals.GPUBufferUsage.STORAGE | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    if (materialFloats.byteLength > 0) {
      this.device.queue.writeBuffer(buffer, 0, materialFloats);
    }
    return buffer;
  }

  private createShadowDepthResources() {
    this.device.pushErrorScope?.("validation");
    this.shadowDepthTexture = this.device.createTexture({
      label: "hp.raw.shadow-depth",
      size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE],
      format: SHADOW_DEPTH_FORMAT,
      usage: this.gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT | this.gpuGlobals.GPUTextureUsage.TEXTURE_BINDING,
    });
    this.device.popErrorScope?.().then?.((error: { message?: string } | null) => {
      if (error) console.warn("[HumanProtocol] Raw WebGPU shadow texture error.", error.message ?? error);
    });
    this.shadowDepthView = createTextureViewWithValidation(this.device, "hp.raw.shadow-depth-view", this.shadowDepthTexture);
    this.device.pushErrorScope?.("validation");
    this.dummyShadowDepthTexture = this.device.createTexture({
      label: "hp.raw.dummy-shadow-depth",
      size: [1, 1],
      format: SHADOW_DEPTH_FORMAT,
      usage: this.gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT | this.gpuGlobals.GPUTextureUsage.TEXTURE_BINDING,
    });
    this.device.popErrorScope?.().then?.((error: { message?: string } | null) => {
      if (error) console.warn("[HumanProtocol] Raw WebGPU dummy shadow texture error.", error.message ?? error);
    });
    this.dummyShadowDepthView = createTextureViewWithValidation(this.device, "hp.raw.dummy-shadow-depth-view", this.dummyShadowDepthTexture);
  }

  private vertexBufferForBatch(vertexBuffer: RawDrawBatch["vertexBuffer"]) {
    if (vertexBuffer === "geometry") return this.geometryVertexBuffer;
    if (vertexBuffer === "shadow") return this.shadowVertexBuffer;
    return this.proxyVertexBuffer;
  }
}

function smooth01(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
