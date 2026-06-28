import type { AgeSceneFrame } from "../core/AgeSceneFrame";
import type { AgeRenderPlan } from "../contracts/AgeRenderPlanContracts";
import type { AgeAssetBundleDescriptor } from "../contracts/AgeAssetContracts";
import type { AgeAssetRegistry } from "../resources/AgeAssetRegistry";

export interface AgeAdapterResult<T> {
  value: T;
  warnings?: readonly string[];
}

export interface AgeGameAdapter<TLevelInput, TRuntimeWorld, TCameraInput = unknown> {
  readonly id: string;
  createAssetBundles(level: TLevelInput): AgeAdapterResult<readonly AgeAssetBundleDescriptor[]>;
  createRenderPlan(level: TLevelInput, assets: AgeAssetRegistry): AgeAdapterResult<AgeRenderPlan>;
  createSceneFrame(input: {
    world: TRuntimeWorld;
    camera: TCameraInput;
    renderPlan: AgeRenderPlan;
    assets: AgeAssetRegistry;
  }): AgeAdapterResult<AgeSceneFrame>;
}

export interface AgeAdapterBoundaryRule {
  forbiddenImports: readonly string[];
  allowedOutputContracts: readonly string[];
}

export const ageEngineBoundaryRule: AgeAdapterBoundaryRule = {
  forbiddenImports: [
    "GameWorld",
    "LevelDefinition",
    "weapon id unions",
    "robot id unions",
    "builder UI modules",
    "generated manifest modules",
  ],
  allowedOutputContracts: [
    "AgeAssetBundleDescriptor",
    "AgeRenderPlan",
    "AgeSceneFrame",
    "AgeMaterialRole",
  ],
};
