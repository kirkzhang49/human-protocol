import type {
  LevelMapPresentationConfig,
  LevelMapPresentationOverrides,
  LevelMapRoomArchetype,
  Vec3Tuple,
} from "./schema/levelConfig";

export type RoomPresentationId = string;

export interface RoomKitDefinition {
  id: RoomPresentationId;
  extends?: RoomPresentationId;
  archetype: LevelMapRoomArchetype;
  shellKit: RoomPresentationId;
  lightingPreset: RoomPresentationId;
  doorKit: RoomPresentationId;
  defaultPropSet: RoomPresentationId;
  layoutAnchorSet: RoomPresentationId;
  spawnLayout: RoomPresentationId;
  pickupLayout: RoomPresentationId;
  previewCamera: RoomPresentationId;
  overrides?: LevelMapPresentationOverrides;
}

export interface RoomShellKitDefinition {
  id: RoomPresentationId;
  floorModelKey: string;
  wallModelKey: string;
  ceilingModelKey: string;
  cornerPillarModelKey: string;
  wallWashLightModelKey: string;
  floorRenderMode?: "model_tiles" | "model_single" | "hero_arena_panels";
  ceilingRenderMode?: "model_panel" | "deep_grid";
  floorBaseColor?: string;
  floorPanelColor?: string;
  floorTrimColor?: string;
  floorAccentColor?: string;
  floorReflectionOpacity?: number;
  floorReflectionStrength?: number;
  floorReflectionBlur?: readonly [number, number];
  ceilingBaseColor?: string;
  ceilingBeamColor?: string;
  ceilingPanelColor?: string;
  ceilingAccentColor?: string;
  guideLineOpacity?: number;
  ceilingLightOpacity?: number;
  scalePolicy: "fit_room_bounds";
  doorOpeningPolicy: "cut_visual_and_collision_segments";
}

export interface RoomLightingPresetDefinition {
  id: RoomPresentationId;
  mood: "quiet" | "combat" | "boss" | "reveal";
  ambient: { color: string; intensity: number };
  hemisphereIntensity?: number;
  directional?: {
    color?: string;
    intensity: number;
    position: Vec3Tuple;
  };
  fog: { color: string; near: number; far: number };
  bloom: { intensity: number; threshold: number };
  lights: readonly RoomLightingDefinition[];
  shadows: {
    enabled: boolean;
    contactShadowStrength: number;
    heroPropShadowBias: number;
    directionalBias?: number;
  };
}

export interface RoomLightingPointDefinition {
  id: string;
  type: "point";
  roomId?: string;
  position?: Vec3Tuple;
  roomRelative?: Vec3Tuple;
  color: string;
  lockedColor?: string;
  unlockedColor?: string;
  doorId?: string;
  intensity: number;
  lockdownIntensity?: number;
  distance: number;
  decay: number;
  overrideScale?: keyof Pick<LevelMapPresentationOverrides, "ceilingLightIntensity">;
  semanticRole?: string;
  semanticSourceId?: string;
}

export interface RoomLightingSpotDefinition {
  id: string;
  type: "spot";
  roomId?: string;
  position?: Vec3Tuple;
  roomRelative?: Vec3Tuple;
  target?: Vec3Tuple;
  targetRoomRelative?: Vec3Tuple;
  targetRoomId?: string;
  color: string;
  lockedColor?: string;
  unlockedColor?: string;
  doorId?: string;
  intensity: number;
  lockdownIntensity?: number;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
  castShadow?: boolean;
  shadowBias?: number;
  beamOpacity?: number;
  beamRadius?: number;
  beamLengthScale?: number;
  overrideScale?: keyof Pick<LevelMapPresentationOverrides, "ceilingLightIntensity">;
  semanticRole?: string;
  semanticSourceId?: string;
}

export interface RoomLightingAreaDefinition {
  id: string;
  type: "area";
  roomId?: string;
  position?: Vec3Tuple;
  roomRelative?: Vec3Tuple;
  target?: Vec3Tuple;
  targetRoomRelative?: Vec3Tuple;
  targetRoomId?: string;
  color: string;
  lockedColor?: string;
  unlockedColor?: string;
  doorId?: string;
  intensity: number;
  lockdownIntensity?: number;
  width: number;
  height: number;
  overrideScale?: keyof Pick<LevelMapPresentationOverrides, "ceilingLightIntensity">;
  semanticRole?: string;
  semanticSourceId?: string;
}

export interface RoomLightingFloorGlowDefinition {
  id: string;
  type: "floor_glow";
  roomId?: string;
  position?: Vec3Tuple;
  roomRelative?: Vec3Tuple;
  scale?: readonly [number, number];
  scaleRoomRelative?: readonly [number, number];
  color: string;
  lockedColor?: string;
  unlockedColor?: string;
  doorId?: string;
  opacity: number;
  lockdownOpacity?: number;
  semanticRole?: string;
  semanticSourceId?: string;
}

export type RoomLightingDefinition =
  | RoomLightingPointDefinition
  | RoomLightingSpotDefinition
  | RoomLightingAreaDefinition
  | RoomLightingFloorGlowDefinition;

export interface RoomDoorKitDefinition {
  id: RoomPresentationId;
  archetype: "elevator_exit" | "security_door";
  doorModelKey: string;
  thresholdModelKey?: string;
  panelModelKey: string;
  stateMaterials: {
    locked: string;
    closed: string;
    open: string;
  };
  statusColors?: {
    locked: string;
    unlocked: string;
    open?: string;
  };
  statusGlow?: {
    lockedIntensity: number;
    unlockedIntensity: number;
    openIntensity?: number;
    opacityLocked: number;
    opacityUnlocked: number;
  };
  openAnimation: { type: "vertical_lift" | "split_slide"; axis: "x" | "y"; distance: number };
  statusLightAnchor: "top_bar" | "side_panel";
  panelAnchor: "right_frame" | "left_frame";
}

export interface RoomPropSetDefinition {
  id: RoomPresentationId;
  requiredModelKeys: readonly string[];
  optionalModelKeys: readonly string[];
}

export interface RoomLayoutAnchorDefinition {
  id: string;
  roomId?: string;
  roomRelative: Vec3Tuple;
  yaw: number;
  role: "hero_wall" | "exit" | "prop_cluster" | "cover_prop" | "pickup_readable" | "enemy_spawn";
}

export interface RoomLayoutAnchorSetDefinition {
  id: RoomPresentationId;
  anchors: readonly RoomLayoutAnchorDefinition[];
}

export interface RoomSpawnLayoutDefinition {
  id: RoomPresentationId;
  anchors: readonly string[];
  maxSimultaneousGroups: number;
  minDistanceFromPlayerStart: number;
  lineOfSightPolicy: "partial_cover" | "open_warning";
}

export interface RoomPickupLayoutDefinition {
  id: RoomPresentationId;
  anchors: readonly string[];
  visibilityPolicy: "glow_beacon_when_critical" | "standard";
  avoidCombatLaneRadius: number;
  dynamicSpacingRadius?: number;
  dropScatterRadius?: number;
  energyGlowColor?: string;
  energyGlowIntensity?: number;
  repairBeaconColor?: string;
}

export interface RoomPreviewCameraDefinition {
  id: RoomPresentationId;
  positionMode: "room_relative_xz" | "world";
  roomId?: string;
  position: Vec3Tuple;
  target: Vec3Tuple;
  fov: number;
  purpose: "art_qa";
}

export interface RoomPresentationRegistry {
  roomKits: Record<RoomPresentationId, RoomKitDefinition>;
  shellKits: Record<RoomPresentationId, RoomShellKitDefinition>;
  lightingPresets: Record<RoomPresentationId, RoomLightingPresetDefinition>;
  doorKits: Record<RoomPresentationId, RoomDoorKitDefinition>;
  propSets: Record<RoomPresentationId, RoomPropSetDefinition>;
  layoutAnchorSets: Record<RoomPresentationId, RoomLayoutAnchorSetDefinition>;
  spawnLayouts: Record<RoomPresentationId, RoomSpawnLayoutDefinition>;
  pickupLayouts: Record<RoomPresentationId, RoomPickupLayoutDefinition>;
  previewCameras: Record<RoomPresentationId, RoomPreviewCameraDefinition>;
}

export interface ResolvedRoomPresentation {
  source: LevelMapPresentationConfig;
  roomKitId?: RoomPresentationId;
  archetype?: LevelMapRoomArchetype;
  roomKit: RoomKitDefinition | null;
  shellKitId?: RoomPresentationId;
  shell: RoomShellKitDefinition | null;
  lightingPresetId?: RoomPresentationId;
  lighting: RoomLightingPresetDefinition | null;
  doorKitId?: RoomPresentationId;
  doorKit: RoomDoorKitDefinition | null;
  propSetId?: RoomPresentationId;
  propSet: RoomPropSetDefinition | null;
  layoutAnchorSetId?: RoomPresentationId;
  layoutAnchorSet: RoomLayoutAnchorSetDefinition | null;
  spawnLayoutId?: RoomPresentationId;
  spawnLayout: RoomSpawnLayoutDefinition | null;
  pickupLayoutId?: RoomPresentationId;
  pickupLayout: RoomPickupLayoutDefinition | null;
  previewCameraId?: RoomPresentationId;
  previewCamera: RoomPreviewCameraDefinition | null;
  overrides: LevelMapPresentationOverrides;
}
