import type { AgeBounds3, AgeId, AgeTuple3, AgeTuple4 } from "../core/AgeTypes";
import type { AgeMaterialRole } from "../materials/AgeMaterialRoles";
import type { AgeTextureDescriptor } from "./AgeAssetContracts";

export interface AgeRenderPlan {
  id: AgeId;
  schemaVersion: string;
  rooms?: readonly AgeRenderPlanRoom[];
  instances: readonly AgeRenderPlanInstance[];
  materials: readonly AgeRenderPlanMaterial[];
  lights?: readonly AgeRenderPlanLight[];
  visibilityScenarios?: readonly AgeVisibilityScenario[];
  assetBundleId?: AgeId;
  metadata?: Record<string, unknown>;
}

export interface AgeRenderPlanRoom {
  id: AgeId;
  bounds: AgeBounds3;
  mood?: string;
  environmentProfileId?: AgeId;
}

export interface AgeRenderPlanInstance {
  id: AgeId;
  modelKey: string;
  roomId?: AgeId | null;
  secondaryRoomId?: AgeId | null;
  position: AgeTuple3;
  rotation: AgeTuple3;
  scale: AgeTuple3;
  localOffset?: AgeTuple3;
  materialRole?: AgeMaterialRole;
  bounds?: AgeBounds3;
  visibility?: AgeRenderPlanVisibility;
  state?: Record<string, string | number | boolean | null | undefined>;
  tags?: readonly string[];
}

export interface AgeRenderPlanVisibility {
  type: "always" | "room" | "portal" | "state" | "adapter";
  roomId?: AgeId;
  stateKey?: string;
}

export interface AgeRenderPlanMaterial {
  id: AgeId;
  index: number;
  name: string;
  category?: string;
  role: AgeMaterialRole;
  baseColorFactor: AgeTuple4;
  emissiveFactor?: AgeTuple3;
  emissiveStrength?: number;
  roughnessFactor?: number;
  metallicFactor?: number;
  alphaMode?: "OPAQUE" | "MASK" | "BLEND";
  doubleSided?: boolean;
  textures?: readonly AgeTextureDescriptor[];
  semanticParams?: AgeTuple4;
}

export interface AgeRenderPlanLight {
  id: AgeId;
  type: "point" | "spot" | "area" | "directional" | "floor-glow";
  roomId?: AgeId | null;
  color: string | AgeTuple3;
  intensity: number;
  position?: AgeTuple3;
  direction?: AgeTuple3;
  range?: number;
  width?: number;
  height?: number;
  role?: string;
}

export interface AgeVisibilityScenario {
  id: AgeId;
  visibleRoomIds: readonly AgeId[];
  visibleInstanceIds?: readonly AgeId[];
  selectedLightIds?: readonly AgeId[];
}
