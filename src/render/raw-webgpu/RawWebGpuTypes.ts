import type { RenderQualityTier } from "../../game/core/RenderPerformance";
import type { RawLightingShadowTuning } from "./RawWebGpuQuality";

export type Tuple3 = [number, number, number];
export type Tuple4 = [number, number, number, number];
export type RawMaterialVisualRole =
  | "default"
  | "neutral_surface"
  | "floor_surface"
  | "ceiling_surface"
  | "structural_dark"
  | "glass_shell"
  | "exhibit_warm"
  | "cyan_emissive"
  | "route_gold"
  | "danger_red"
  | "screen_label"
  | "robot_body"
  | "door_locked_red"
  | "door_access_cyan"
  | "pickup_health"
  | "pickup_energy"
  | "pickup_ammo"
  | "pickup_key"
  | "switch_active"
  | "switch_inactive";

export interface RawRenderPlan {
  level: {
    id: string;
  };
  officialBuilderSurfaceBridge?: RawOfficialBuilderSurfaceBridge | null;
  presentation?: RawPlanPresentation | null;
  rooms: RawPlanRoom[];
  instances: RawPlanInstance[];
  lights?: RawPlanLight[];
  lightingProfiles?: RawRoomLightingProfile[];
  rawLightingAlgorithmTuning?: RawLightingAlgorithmTuning | null;
  rawVisualColorTuning?: RawVisualColorTuning | null;
  rawRolePaletteTuning?: RawRolePaletteTuning | null;
  rawMaterialPipeline?: RawMaterialPipelineSummary | null;
  rawArtDirection?: RawArtDirection | null;
  visibilityScenarios: RawVisibilityScenario[];
  geometry?: RawPlanGeometry;
}

export interface RawOfficialBuilderSurfaceBridge {
  enabled: boolean;
  reason: "builder-surface-overrides" | "builder-runtime-pack-surfaces" | "no-surface-overrides" | string;
  roomIds: string[];
  surfaceAssetKeys: string[];
  insertedInstances: number;
  removedShellInstances: number;
  prunedShellAssets: number;
}

export interface RawPlanPresentation {
  lighting?: {
    ambient?: {
      color: string;
      intensity: number;
    };
    hemisphereIntensity?: number | null;
    directional?: {
      color?: string;
      intensity: number;
      position: Tuple3;
    } | null;
    fog?: {
      color: string;
      near: number;
      far: number;
    };
    bloom?: {
      intensity: number;
      threshold: number;
    };
  } | null;
}

export interface RawPlanRoom {
  id: string;
  mood?: string | null;
  skinKey?: string | null;
  bounds: {
    center: Tuple3;
    size: Tuple3;
  };
}

export interface RawRoomLightingProfile {
  roomId: string;
  artist?: {
    exposure?: number;
    contrast?: number;
    saturation?: number;
    warmth?: number;
  };
  bounce?: {
    floor?: number;
    ceiling?: number;
    side?: number;
    shadowDepth?: number;
  };
  algorithm?: {
    ao?: number;
    probe?: number;
    material?: number;
    localLight?: number;
    shadowReceiver?: number;
    specular?: number;
    contact?: number;
    wallGuard?: number;
  };
}

export interface ResolvedRoomLightingProfile {
  artist: {
    exposure: number;
    contrast: number;
    saturation: number;
    warmth: number;
  };
  bounce: {
    floor: number;
    ceiling: number;
    side: number;
    shadowDepth: number;
  };
  algorithm: {
    ao: number;
    probe: number;
    material: number;
    localLight: number;
    shadowReceiver: number;
    specular: number;
    contact: number;
    wallGuard: number;
  };
}

export interface RawLightingAlgorithmTuning {
  global?: RawLightingShadowTuning | null;
}

export interface RawVisualColorTuning {
  schemaVersion?: string | null;
  algorithm?: string | null;
  source?: string | null;
  file?: string | null;
  candidatesEvaluated?: number | null;
  score?: number | null;
  currentScore?: number | null;
  improvement?: number | null;
  inputMetrics?: Record<string, number> | null;
  params?: {
    exposureScale?: number;
    contrastScale?: number;
    saturationScale?: number;
    blackScale?: number;
    cyanRedLift?: number;
    cyanGreenScale?: number;
    cyanBlueScale?: number;
    cyanNeutralMix?: number;
    bloomScale?: number;
    fogGuardScale?: number;
  } | null;
}

export interface RawRolePaletteTuning {
  schemaVersion?: string | null;
  algorithm?: string | null;
  source?: string | null;
  file?: string | null;
  candidatesEvaluated?: number | null;
  score?: number | null;
  currentScore?: number | null;
  improvement?: number | null;
  roles?: Record<string, RawRolePaletteTuningRole> | null;
}

export interface RawRolePaletteTuningRole {
  targetColor?: Tuple3 | null;
  mix?: number | null;
  meanInputColor?: Tuple3 | null;
  meanOutputColor?: Tuple3 | null;
  score?: number | null;
}

export interface RawMaterialPipelineSummary {
  schemaVersion?: string | null;
  generatedBy?: string | null;
  file?: string | null;
  textureSize?: number | null;
  publicBase?: string | null;
  summary?: {
    totalMaterials?: number;
    generatedSlots?: number;
    existingSlots?: number;
    generatedTextures?: number;
    glassMaterials?: number;
    transparentCandidates?: number;
    roleCounts?: Record<string, number>;
  } | null;
}

export interface RawArtDirection {
  schemaVersion?: string | null;
  generatedBy?: string | null;
  levelId?: string | null;
  roleProfiles?: RawArtRoleProfile[];
  roomDirectives?: RawArtRoomDirective[];
  instanceDirectives?: RawArtInstanceDirective[];
  materialRoleDirectives?: RawArtMaterialRoleDirective[];
  localLightDirectives?: RawArtLocalLightDirective[];
  transparentDirectives?: RawArtTransparentDirective[];
  reflectionDirectives?: RawArtReflectionDirective[];
  decalDirectives?: RawArtDecalDirective[];
  paletteConstraints?: RawArtPaletteConstraint[];
  summary?: Record<string, unknown> | null;
}

export interface RawArtRoleProfile {
  id: string;
  label?: string | null;
  materialRoles?: string[];
  paletteConstraintId?: string | null;
  localLightProfileId?: string | null;
  transparentProfileId?: string | null;
  reflectionProfileId?: string | null;
  decalProfileIds?: string[];
  notes?: string[];
}

export interface RawArtRoomDirective {
  roomId: string;
  mood?: string | null;
  baseLighting: "dark_gallery" | "neutral_lab" | "danger_threshold";
  ambientTarget: Tuple3;
  floorTarget: Tuple3;
  wallTarget: Tuple3;
  warmth: number;
  saturationCeiling: number;
}

export interface RawArtInstanceDirective {
  instanceId: string;
  modelKey: string;
  roomId: string | null;
  artRole: string;
  materialRole: string;
  paletteConstraintId: string;
  localLightProfileId?: string | null;
  transparentProfileId?: string | null;
  reflectionProfileId?: string | null;
  decalProfileIds?: string[];
  priority: number;
}

export interface RawArtMaterialRoleDirective {
  materialIndex: number;
  materialId: string;
  materialName: string;
  category: string;
  visualRole: string;
  artRole: string;
  paletteConstraintId: string;
  transparentProfileId?: string | null;
  reflectionProfileId?: string | null;
  decalProfileIds?: string[];
}

export interface RawArtLocalLightDirective {
  id: string;
  sourceInstanceId: string | null;
  sourceMaterialIndex?: number | null;
  roomId?: string | null;
  artRole: string;
  type: RawPlanLightType;
  color: string;
  targetSrgb: Tuple3;
  intensity: number;
  radius: number;
  decay: number;
  width?: number | null;
  height?: number | null;
  priority: number;
  bloomWeight: number;
  anchor?: {
    position?: Tuple3 | null;
  } | null;
}

export interface RawArtTransparentDirective {
  id: string;
  target: "instance" | "material";
  sourceInstanceId?: string | null;
  materialIndex?: number | null;
  profile: "smoked_glass_case" | "screen_acrylic" | "energy_glass";
  alpha: number;
  fresnelF0: number;
  absorptionColor: Tuple3;
  absorptionDistance: number;
  roughness: number;
  refractionStrength: number;
}

export interface RawArtReflectionDirective {
  id: string;
  target: "instance" | "material" | "room";
  sourceInstanceId?: string | null;
  materialIndex?: number | null;
  roomId?: string | null;
  profile: "floor_soft_planar" | "glass_box_probe" | "door_panel_probe" | "exhibit_highlight";
  strength: number;
  roughnessFloor: number;
  probeInfluence: number;
}

export interface RawArtDecalDirective {
  id: string;
  sourceInstanceId: string | null;
  materialIndex?: number | null;
  artRole: string;
  decalKind: "route_line" | "hazard_stripe" | "door_status" | "exhibit_label" | "screen_glyph" | "pickup_icon";
  color: string;
  opacity: number;
  priority: number;
}

export interface RawArtPaletteConstraint {
  id: string;
  artRole: string;
  targetSrgb: Tuple3;
  colorSpace: "oklch";
  lightnessRange: [number, number];
  chromaRange: [number, number];
  hueDegrees?: number | null;
  mix: number;
  saturationCeiling: number;
  notes?: string[];
}

export interface RawPlanInstance {
  id: string;
  role: string;
  modelKey: string;
  roomId: string | null;
  secondaryRoomId: string | null;
  position: Tuple3;
  localOffset: Tuple3;
  rotation: Tuple3;
  scale: Tuple3;
  tags?: readonly string[];
  visibility: RawPlanVisibility;
  state: RawPlanState | null;
  estimatedBounds: {
    center: Tuple3;
    halfSize: Tuple3;
  };
}

export interface RawPlanVisibility {
  type: "room" | "door" | "key-item" | "pickup";
  doorId?: string;
  keyItemId?: string;
  pickupId?: string;
}

export interface RawPlanState {
  doorId?: string;
  openAnimation?: {
    type?: string;
    axis?: "x" | "y" | "z" | string;
    distance?: number;
  } | null;
  openVisualPolicy?: {
    hideClosedHardwareAfterOpen?: boolean;
    hidePanelAfterOpen?: boolean;
  } | null;
  keyItemId?: string;
  interactionId?: string;
  puzzleId?: string;
  targetId?: string;
  colorKey?: string;
  pickupId?: string;
  type?: string;
}

export interface RawPlanGeometry {
  binaryFile: string;
  vertexStrideFloats: number;
  materials?: RawPlanMaterial[];
  baseColorTextures?: RawPlanBaseColorTexture[];
  baseColorTextureSize?: number;
  materialTextures?: RawPlanMaterialTexture[];
  materialTextureSize?: number;
  assets: RawPlanGeometryAsset[];
}

export interface RawPlanBaseColorTexture {
  /** Texture-array page. Missing means page 0 for legacy/static plans. */
  page?: number | null;
  layer: number;
  url: string;
  name?: string | null;
  sourceFile?: string | null;
  mimeType?: string | null;
  stats?: RawPlanTextureStats | null;
}

export interface RawPlanTextureStats {
  lumaMean: number;
  contrast: number;
  chroma: number;
  detail: number;
}

export interface RawPlanMaterialTextureSlot {
  semantic: "baseColor" | "normal" | "metallicRoughness" | "ao" | "emissive";
  present: boolean;
  colorSpace: "srgb" | "linear" | "none";
  name?: string | null;
  url?: string | null;
  /** Texture-array page. Missing means page 0 for legacy/static plans. */
  page?: number | null;
  layer?: number | null;
  sourceFile?: string | null;
  mimeType?: string | null;
  stats?: RawPlanTextureStats | null;
}

export interface RawPlanMaterialTexture extends RawPlanBaseColorTexture {
  semantic?: RawPlanMaterialTextureSlot["semantic"] | "material" | null;
  colorSpace?: RawPlanMaterialTextureSlot["colorSpace"] | null;
}

export interface RawPlanMaterial {
  index: number;
  id: string;
  name: string;
  category: string;
  visualRole?: RawMaterialVisualRole | string | null;
  semanticParams?: Tuple4 | null;
  paletteColorFactor?: Tuple4 | null;
  baseColorFactor: Tuple4;
  emissiveFactor: Tuple3;
  emissiveStrength: number;
  roughnessFactor: number;
  metallicFactor: number;
  aoStrength: number;
  materialKind: number;
  alphaMode: "OPAQUE" | "MASK" | "BLEND";
  transparency?: {
    mode: "opaque" | "mask" | "blend";
    alpha: number;
    source: string;
  } | null;
  doubleSided: boolean;
  textures?: RawPlanMaterialTextureSlot[];
}

export interface RawPlanGeometryAsset {
  modelKey: string;
  vertexOffset: number;
  vertexCount: number;
  triangleCount: number;
  nodeCount?: number;
  skinCount?: number;
  rigidSkin?: RawPlanRigidSkin | null;
  animationClips?: RawPlanAnimationClip[];
  nodeChunks?: RawPlanGeometryNodeChunk[];
  bounds?: {
    min: Tuple3;
    center: Tuple3;
    size: Tuple3;
  };
  status: "ready" | "empty" | "missing";
}

export interface RawPlanRigidSkin {
  mode: "rigid-node-palette";
  jointCount: number;
  referencedJointCount: number;
  chunkCount: number;
  vertexAttribute: "rigidJointIndex";
}

export interface RawPlanAnimationClip {
  index: number;
  name: string;
  action?: string | null;
  durationSeconds: number;
  samplerCount?: number;
  channelCount: number;
  targetNodeCount?: number;
  targetPaths?: string[];
}

export interface RawPlanGeometryNodeChunk {
  nodeIndex: number | null;
  nodeName?: string | null;
  vertexOffset: number;
  vertexCount: number;
  bindMatrix: number[];
  inverseBindMatrix: number[];
}

export type RawPlanLightType = "point" | "spot" | "area" | "floor_glow";

export interface RawPlanLight {
  id: string;
  type: RawPlanLightType;
  roomId: string | null;
  doorId: string | null;
  color: string;
  intensity: number;
  position: Tuple3;
  targetPosition?: Tuple3 | null;
  distance?: number | null;
  decay?: number | null;
  angle?: number | null;
  penumbra?: number | null;
  width?: number | null;
  height?: number | null;
  opacity?: number | null;
  castShadow?: boolean;
  semanticRole?: string | null;
  semanticSourceId?: string | null;
}

export interface RawSelectedLight {
  id: string;
  type: RawPlanLightType;
  roomId: string | null;
  position: Tuple3;
  score: number;
  canCastShadow: boolean;
}

export interface RawVisibilityScenario {
  currentRoomId: string;
  qualityTier: RenderQualityTier;
  visibleRoomIds: string[];
  visibleDoorIds: string[];
  selectedLightIds?: string[];
  selectedLights: RawSelectedLight[];
}

export interface GpuGlobals {
  GPUBufferUsage: Record<string, number>;
  GPUShaderStage: Record<string, number>;
  GPUTextureUsage: Record<string, number>;
}

export interface RawWebGpuDeviceBundle {
  device: any;
  format: string;
}

export interface RawDrawBatch {
  vertexBuffer: "geometry" | "proxy" | "shadow";
  vertexOffset: number;
  vertexCount: number;
  instanceOffset: number;
  instanceCount: number;
  transparent?: boolean;
}
