import type {
  AgeBounds3,
  AgeFrameTiming,
  AgeId,
  AgeMat4,
  AgeNamedTagMap,
  AgeRenderQualityTier,
  AgeTuple3,
  AgeTuple4,
  AgeViewport,
} from "./AgeTypes";
import type { AgeMaterialRole } from "../materials/AgeMaterialRoles";
import type { AgeLightingFrame } from "../lighting/AgeLightingProfile";

export interface AgeCameraFrame {
  viewMatrix: AgeMat4;
  projectionMatrix: AgeMat4;
  viewProjectionMatrix: AgeMat4;
  position: AgeTuple3;
  exposure?: number;
  fog?: {
    color: AgeTuple3;
    near: number;
    far: number;
  };
}

export interface AgeSceneInstance {
  id: AgeId;
  meshId: AgeId;
  materialId?: AgeId;
  materialRole?: AgeMaterialRole;
  transform: AgeMat4;
  color?: AgeTuple4;
  bounds?: AgeBounds3;
  visible?: boolean;
  dynamic?: boolean;
  lastTransformFrameIndex?: number;
  tags?: readonly string[];
  state?: AgeNamedTagMap;
}

export interface AgeContactRecord {
  id: AgeId;
  instanceId?: AgeId;
  position: AgeTuple3;
  halfExtents: [number, number];
  strength: number;
  grounded: boolean;
  source: "authoritative" | "derived";
  kind?: string;
}

export interface AgePortalStateRecord {
  id: AgeId;
  open: boolean;
  openProgress: number;
  kind?: string;
}

export interface AgeAnimationStateRecord {
  instanceId: AgeId;
  action: string;
  timeSeconds: number;
  weight?: number;
  loop?: boolean;
  modelKey?: string;
}

export interface AgeDrawBatch {
  id?: AgeId;
  vertexBufferId: AgeId;
  geometryId?: AgeId;
  materialId?: AgeId;
  materialRole?: AgeMaterialRole;
  vertexOffset: number;
  vertexCount: number;
  instanceOffset: number;
  instanceCount: number;
  transparent?: boolean;
  castsShadow?: boolean;
  receivesContactShadow?: boolean;
}

export interface AgeProjectileRecord {
  id: AgeId;
  position: AgeTuple3;
  direction: AgeTuple3;
  radius: number;
  ageSeconds: number;
  lifetimeSeconds: number;
  color: AgeTuple3;
  power: number;
  kind?: string;
}

export interface AgeParticleEmitterRecord {
  id: AgeId;
  position: AgeTuple3;
  direction?: AgeTuple3;
  color: AgeTuple3;
  power: number;
  radius: number;
  kind?: string;
}

export interface AgeSceneFrame {
  schemaVersion?: string;
  timing: AgeFrameTiming;
  viewport: AgeViewport;
  qualityTier: AgeRenderQualityTier;
  camera: AgeCameraFrame;
  lighting: AgeLightingFrame;
  instances: readonly AgeSceneInstance[];
  drawBatches: readonly AgeDrawBatch[];
  projectiles?: readonly AgeProjectileRecord[];
  particleEmitters?: readonly AgeParticleEmitterRecord[];
  contacts?: readonly AgeContactRecord[];
  portalStates?: readonly AgePortalStateRecord[];
  animationStates?: readonly AgeAnimationStateRecord[];
  metadata?: AgeNamedTagMap;
}
