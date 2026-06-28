/**
 * Pickup GLBs ship their image2 "wrap" faces (the flat label / billboard quads
 * printed with the pickup art) as their own GLB nodes. Those faces render as a
 * black spike glued to the pickup in the raw-webgpu pickup pass, so the renderer
 * skips them per node-chunk instead of drawing the model as one batch.
 *
 * This MUST stay paired with the cook side: deep playtest packs only carry node
 * chunks for kinds that opt in (see deepCookEmitsNodeChunks). If pickups stop
 * emitting node chunks there is nothing to skip and the spike returns — the
 * guard test in pickupSpikeGuard.test.ts asserts both halves stay in sync.
 *
 * Match by suffix so it covers every pickup (key / medkit / energy cell / …)
 * without touching the museum's readable wall-art faces, which use a different
 * render path and end in `_image2_readable_face` / `_image2_hero_face`.
 */
export function isPickupWrapFaceNode(nodeName: string | null | undefined): boolean {
  const name = String(nodeName ?? "").toLowerCase();
  return name.endsWith("_image2_face") || name.endsWith("_image2_side");
}
