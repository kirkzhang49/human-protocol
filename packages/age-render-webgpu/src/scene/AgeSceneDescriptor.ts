import type { AgeId, AgeNamedTagMap } from "../core/AgeTypes";
import type { AgeRenderPlan } from "../contracts/AgeRenderPlanContracts";

export interface AgeSceneDescriptor {
  id: AgeId;
  renderPlan: AgeRenderPlan;
  assetBundleIds: readonly AgeId[];
  tags?: AgeNamedTagMap;
}

export interface AgeSceneRuntimeState {
  sceneId: AgeId;
  activeRoomId?: AgeId;
  visibleRoomIds?: readonly AgeId[];
  visibleInstanceIds?: readonly AgeId[];
  stateVersion: number;
}
