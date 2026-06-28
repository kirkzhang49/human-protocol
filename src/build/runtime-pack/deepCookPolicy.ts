import type { BuilderDeepModelRequestKind } from "./BuilderRuntimeAssetIndex";

/**
 * Which deep-cook model kinds must emit per-node chunks.
 *
 * - viewmodels: the articulated first-person pass needs per-node geometry.
 * - pickups: the renderer skips their image2 "wrap" face nodes (see
 *   isPickupWrapFaceNode); without node chunks there is nothing to skip and the
 *   wrap face cooks into a black spike glued to the pickup.
 * - wall door switches: the Raw renderer moves `wall_switch_lever_movable_*`
 *   chunks during hand interaction, then leaves them in the switched state.
 *
 * Keep in sync with isPickupWrapFaceNode — pickupSpikeGuard.test.ts asserts it.
 */
export function deepCookEmitsNodeChunks(kind: BuilderDeepModelRequestKind, modelKey?: string): boolean {
  return kind === "viewmodel" || kind === "pickup" || modelKey === "hp_wall_door_switch_button_v1";
}
