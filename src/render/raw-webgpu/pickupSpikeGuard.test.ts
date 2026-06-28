import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ensureMeshoptDecoderReady, parseGlbToCookedModel } from "../../build/runtime-pack/cookGlbModels";
import { deepCookEmitsNodeChunks } from "../../build/runtime-pack/deepCookPolicy";
import { isPickupWrapFaceNode } from "./pickupNodeVisibility";

// Regression guard for the "black spike glued to every pickup" bug. The spike is
// a pickup's image2 "wrap" face node; the renderer skips it per node-chunk, but
// that only works when (a) the cook emits node chunks for pickups and (b) the
// face is named so the predicate catches it. This test locks both halves + the
// actual pickup GLBs so the spike cannot silently come back.
const PICKUP_GLBS = ["hp_pickup_large_yellow_key.glb", "hp_pickup_medkit_white_red.glb", "hp_pickup_energy_cell_amber.glb"];

function loadGlb(file: string): ArrayBuffer {
  const buf = readFileSync(resolve(process.cwd(), "src/assets/models-cooked/environment/props", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("pickup image2 wrap-face spike guard", () => {
  it("isPickupWrapFaceNode hides pickup wrap faces but not bodies or museum readable art", () => {
    expect(isPickupWrapFaceNode("pickup_large_yellow_key_flat_key_shaft_image2_face")).toBe(true);
    expect(isPickupWrapFaceNode("pickup_medkit_white_red_front_image2_face")).toBe(true);
    expect(isPickupWrapFaceNode("pickup_medkit_white_red_left_image2_side")).toBe(true);
    expect(isPickupWrapFaceNode("pickup_energy_cell_amber_charge_window_image2_face")).toBe(true);
    // Pickup bodies must stay visible.
    expect(isPickupWrapFaceNode("pickup_medkit_white_red_hard_white_case")).toBe(false);
    expect(isPickupWrapFaceNode("pickup_large_yellow_key_round_bow_gold_shell")).toBe(false);
    // Museum wall-art / door faces use a different render path and must NOT be hidden.
    expect(isPickupWrapFaceNode("age_museum_wall_art_human_origin_front_image2_readable_face")).toBe(false);
    expect(isPickupWrapFaceNode("age_museum_gallery_door_back_left_image2_hero_face")).toBe(false);
    expect(isPickupWrapFaceNode(null)).toBe(false);
  });

  it("deep cook emits node chunks for the kinds that need to skip nodes", () => {
    // Pickups MUST stay true or the renderer has no chunks to skip → spike returns.
    expect(deepCookEmitsNodeChunks("pickup")).toBe(true);
    expect(deepCookEmitsNodeChunks("viewmodel")).toBe(true);
    expect(deepCookEmitsNodeChunks("furniture")).toBe(false);
    expect(deepCookEmitsNodeChunks("enemy")).toBe(false);
  });

  it.each(PICKUP_GLBS)("%s cooks node chunks with an isolable, skippable wrap face", async (file) => {
    await ensureMeshoptDecoderReady();
    const model = parseGlbToCookedModel(file, loadGlb(file), { emitNodeChunks: true });
    const chunks = model.nodeChunks ?? [];
    expect(chunks.length).toBeGreaterThan(0);
    // The spike source exists and is named so the predicate catches it...
    expect(chunks.some((chunk) => isPickupWrapFaceNode(chunk.nodeName))).toBe(true);
    // ...and we still keep the rest of the pickup (we don't hide the whole model).
    expect(chunks.some((chunk) => !isPickupWrapFaceNode(chunk.nodeName))).toBe(true);
  });

  // The ACTUAL spike was NaN vertices: these pickups ship EXT_meshopt_compression
  // + KHR_mesh_quantization geometry, and the cooker must decode it. Without the
  // decoder, ~70% of positions came out NaN (exploded black spike) and BYTE-typed
  // octahedral normals decoded to zero. Lock both halves: finite geometry + real
  // normals + plausible bounds, so the spike cannot return via a cook regression.
  it.each(PICKUP_GLBS)("%s cooks finite, non-degenerate geometry (no NaN spike)", async (file) => {
    await ensureMeshoptDecoderReady();
    const model = parseGlbToCookedModel(file, loadGlb(file), { emitNodeChunks: true });
    const verts = model.vertices;
    const FLOATS_PER_VERTEX = verts.length / model.vertexCount;
    let nanFloats = 0;
    let zeroNormals = 0;
    for (let v = 0; v < model.vertexCount; v += 1) {
      const base = v * FLOATS_PER_VERTEX;
      for (let c = 0; c < FLOATS_PER_VERTEX; c += 1) if (Number.isNaN(verts[base + c])) nanFloats += 1;
      const nl = Math.hypot(verts[base + 3], verts[base + 4], verts[base + 5]);
      if (nl < 0.1) zeroNormals += 1;
    }
    expect(nanFloats).toBe(0);
    expect(zeroNormals).toBe(0);
    // Bounds must be finite and within a sane pickup-sized envelope (the spike
    // produced NaN / unbounded extents).
    for (const axis of model.bounds.size) {
      expect(Number.isFinite(axis)).toBe(true);
      expect(axis).toBeGreaterThan(0.01);
      expect(axis).toBeLessThan(4);
    }
  });
});
