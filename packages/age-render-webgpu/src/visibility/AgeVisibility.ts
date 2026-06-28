import type { AgeId } from "../core/AgeTypes";
import type { AgeRenderPlan, AgeRenderPlanInstance } from "../contracts/AgeRenderPlanContracts";
import type { AgeSceneRuntimeState } from "../scene/AgeSceneDescriptor";

export interface AgeVisibilityFrame {
  visibleRoomIds: readonly AgeId[];
  visibleInstanceIds: readonly AgeId[];
  selectedLightIds: readonly AgeId[];
  key: string;
}

export interface AgeVisibilityResolver {
  resolve(plan: AgeRenderPlan, runtime: AgeSceneRuntimeState): AgeVisibilityFrame;
}

export const ageAllRoomsVisibilityResolver: AgeVisibilityResolver = {
  resolve(plan, runtime) {
    const visibleRoomIds = runtime.visibleRoomIds ?? plan.rooms?.map((room) => room.id) ?? [];
    const visibleRoomSet = new Set(visibleRoomIds);
    const visibleInstanceIds = runtime.visibleInstanceIds ?? plan.instances
      .filter((instance) => ageInstanceVisibleInRooms(instance, visibleRoomSet))
      .map((instance) => instance.id);
    return {
      visibleRoomIds,
      visibleInstanceIds,
      selectedLightIds: plan.lights?.map((light) => light.id) ?? [],
      key: `${runtime.stateVersion}|${visibleRoomIds.join(",")}|${visibleInstanceIds.length}`,
    };
  },
};

function ageInstanceVisibleInRooms(instance: AgeRenderPlanInstance, visibleRoomIds: ReadonlySet<AgeId>) {
  if (!instance.roomId) return true;
  return visibleRoomIds.has(instance.roomId) || Boolean(instance.secondaryRoomId && visibleRoomIds.has(instance.secondaryRoomId));
}
