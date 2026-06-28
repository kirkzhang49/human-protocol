import { describe, expect, it } from "vitest";

import { createShadowPlaneVertices, createUnitCubeVertices } from "./RawWebGpuGeometry";
import { CUBE_VERTEX_COUNT, FLOATS_PER_VERTEX, VERTEX_MATERIAL_INDEX_COMPONENT } from "./RawWebGpuConstants";

// These proxy/shadow meshes feed fixed-stride vertex buffers consumed by the
// shared scene pipeline. If their per-vertex float count ever drifts away from
// FLOATS_PER_VERTEX, the GPU reads them at the wrong stride and dynamic
// fallbacks (e.g. uncooked robots / pickups) shatter into black garbage spikes.
describe("RawWebGpuGeometry proxy vertex layout", () => {
  it("emits the canonical stride for the proxy cube", () => {
    const verts = createUnitCubeVertices();
    expect(verts.length).toBe(CUBE_VERTEX_COUNT * FLOATS_PER_VERTEX);
  });

  it("emits the canonical stride for the contact-shadow plane", () => {
    const verts = createShadowPlaneVertices();
    expect(verts.length % FLOATS_PER_VERTEX).toBe(0);
    expect(verts.length).toBe(6 * FLOATS_PER_VERTEX);
  });

  it("preserves material indices (cube = 0 default proxy, shadow = 1 contact shadow)", () => {
    expect(createUnitCubeVertices()[VERTEX_MATERIAL_INDEX_COMPONENT]).toBe(0);
    expect(createShadowPlaneVertices()[VERTEX_MATERIAL_INDEX_COMPONENT]).toBe(1);
  });
});
