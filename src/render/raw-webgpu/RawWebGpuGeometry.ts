export function createUnitCubeVertices() {
  const faces = [
    { normal: [0, 0, 1], corners: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { normal: [0, 0, -1], corners: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    { normal: [1, 0, 0], corners: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { normal: [-1, 0, 0], corners: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
    { normal: [0, 1, 0], corners: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    { normal: [0, -1, 0], corners: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  ];
  const indices = [0, 1, 2, 0, 2, 3];
  const floats: number[] = [];
  for (const face of faces) {
    for (const index of indices) {
      const corner = face.corners[index];
      // Packed vertex layout = position3, normal3, uv2, materialIndex1, rigidJointIndex1
      // (FLOATS_PER_VERTEX = 10; legacy tangent4 dropped). Keep this in lockstep with
      // RawWebGpuConstants.FLOATS_PER_VERTEX / the pipeline arrayStride or proxy boxes
      // get read at the wrong stride and shatter into garbage spikes.
      floats.push(corner[0], corner[1], corner[2], face.normal[0], face.normal[1], face.normal[2], 0, 0, 0, -1);
    }
  }
  return new Float32Array(floats);
}

export function createShadowPlaneVertices() {
  const corners = [
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
    [0.5, 0, 0.5],
    [-0.5, 0, 0.5],
  ];
  const indices = [0, 1, 2, 0, 2, 3];
  const floats: number[] = [];
  for (const index of indices) {
    const corner = corners[index];
    // Same 10-float layout as the cube; materialIndex stays 1 (the built-in
    // contact-shadow material) — only the legacy tangent4 is dropped.
    floats.push(corner[0], corner[1], corner[2], 0, 1, 0, 0, 0, 1, -1);
  }
  return new Float32Array(floats);
}
