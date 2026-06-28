import { FLOATS_PER_VERTEX, VERTEX_MATERIAL_INDEX_COMPONENT } from "../../render/raw-webgpu/RawWebGpuConstants";
import type { RawPlanGeometryAsset, Tuple3, Tuple4 } from "../../render/raw-webgpu/RawWebGpuTypes";

/**
 * Packs 14-float runtime vertices for the builder runtime pack. Extracted
 * verbatim from compileBuilderRuntimePack — behavior is unchanged; this file
 * only gives the geometry buffer writer its own module.
 */
interface PendingAsset {
  modelKey: string;
  vertexOffset: number;
  min: Tuple3;
  max: Tuple3;
  /** Plan-format node chunks with ABSOLUTE buffer offsets (viewmodels only). */
  nodeChunks?: RawPlanGeometryAsset["nodeChunks"];
  nodeCount?: number;
  skinCount?: number;
  rigidSkin?: RawPlanGeometryAsset["rigidSkin"];
  animationClips?: RawPlanGeometryAsset["animationClips"];
}

export class GeometryWriter {
  private readonly floats: number[] = [];
  private readonly finished: Array<PendingAsset & { vertexCount: number }> = [];
  private current: PendingAsset | null = null;

  beginAsset(modelKey: string) {
    this.current = {
      modelKey,
      vertexOffset: this.floats.length / FLOATS_PER_VERTEX,
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
  }

  endAsset(): string {
    const current = this.current;
    if (!current) throw new Error("endAsset without beginAsset");
    this.finished.push({ ...current, vertexCount: this.floats.length / FLOATS_PER_VERTEX - current.vertexOffset });
    this.current = null;
    return current.modelKey;
  }

  /** Attaches node chunks (local offsets) to the asset being written. */
  setCurrentNodeChunks(chunks: readonly { nodeName: string | null; vertexOffset: number; vertexCount: number }[]) {
    const current = this.current;
    if (!current) throw new Error("setCurrentNodeChunks without beginAsset");
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    current.nodeChunks = chunks.map((chunk, index) => ({
      nodeIndex: index,
      nodeName: chunk.nodeName,
      vertexOffset: current.vertexOffset + chunk.vertexOffset,
      vertexCount: chunk.vertexCount,
      bindMatrix: identity,
      inverseBindMatrix: identity,
    }));
  }

  /** Copies already-baked Raw metadata, rebasing geometry offsets into this pack. */
  setCurrentRawMetadata(asset: RawPlanGeometryAsset) {
    const current = this.current;
    if (!current) throw new Error("setCurrentRawMetadata without beginAsset");
    current.nodeCount = asset.nodeCount;
    current.skinCount = asset.skinCount;
    current.rigidSkin = asset.rigidSkin ? { ...asset.rigidSkin } : undefined;
    current.animationClips = asset.animationClips ? asset.animationClips.map((clip) => ({ ...clip })) : undefined;
    current.nodeChunks = asset.nodeChunks?.map((chunk) => ({
      nodeIndex: chunk.nodeIndex,
      nodeName: chunk.nodeName,
      vertexOffset: current.vertexOffset + Math.max(0, chunk.vertexOffset - asset.vertexOffset),
      vertexCount: chunk.vertexCount,
      bindMatrix: [...chunk.bindMatrix],
      inverseBindMatrix: [...chunk.inverseBindMatrix],
    }));
  }

  pushBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, materialIndex: number) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const faces: Array<{ normal: Tuple3; tangent: Tuple4; corners: Tuple3[] }> = [
      { normal: [0, 0, 1], tangent: [1, 0, 0, 1], corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { normal: [0, 0, -1], tangent: [-1, 0, 0, 1], corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
      { normal: [1, 0, 0], tangent: [0, 0, -1, 1], corners: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
      { normal: [-1, 0, 0], tangent: [0, 0, 1, 1], corners: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
      { normal: [0, 1, 0], tangent: [1, 0, 0, 1], corners: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
      { normal: [0, -1, 0], tangent: [1, 0, 0, 1], corners: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    ];
    const triangleIndices = [0, 1, 2, 0, 2, 3];
    const uvScale = 0.45;
    for (const face of faces) {
      for (const index of triangleIndices) {
        const corner = face.corners[index];
        const x = corner[0] + cx;
        const y = corner[1] + cy;
        const z = corner[2] + cz;
        const u = (Math.abs(face.normal[0]) > 0 ? z : x) * uvScale;
        const v = (Math.abs(face.normal[1]) > 0 ? z : y) * uvScale;
        this.floats.push(x, y, z, face.normal[0], face.normal[1], face.normal[2], u, v, materialIndex, -1);
        this.trackBounds(x, y, z);
      }
    }
  }

  /** Like pushBox, but the box is rotated `yaw` radians about Y (for angled walls). */
  pushBoxYaw(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, yaw: number, materialIndex: number) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const faces: Array<{ normal: Tuple3; tangent: Tuple4; corners: Tuple3[] }> = [
      { normal: [0, 0, 1], tangent: [1, 0, 0, 1], corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { normal: [0, 0, -1], tangent: [-1, 0, 0, 1], corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
      { normal: [1, 0, 0], tangent: [0, 0, -1, 1], corners: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
      { normal: [-1, 0, 0], tangent: [0, 0, 1, 1], corners: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
      { normal: [0, 1, 0], tangent: [1, 0, 0, 1], corners: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
      { normal: [0, -1, 0], tangent: [1, 0, 0, 1], corners: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    ];
    const triangleIndices = [0, 1, 2, 0, 2, 3];
    const uvScale = 0.45;
    for (const face of faces) {
      const nx = face.normal[0] * cos - face.normal[2] * sin;
      const nz = face.normal[0] * sin + face.normal[2] * cos;
      const tx = face.tangent[0] * cos - face.tangent[2] * sin;
      const tz = face.tangent[0] * sin + face.tangent[2] * cos;
      for (const index of triangleIndices) {
        const corner = face.corners[index];
        // UV in the box-local frame so textures stay aligned to the wall run.
        const u = (Math.abs(face.normal[0]) > 0 ? corner[2] : corner[0]) * uvScale;
        const v = (Math.abs(face.normal[1]) > 0 ? corner[2] : corner[1]) * uvScale;
        const x = corner[0] * cos - corner[2] * sin + cx;
        const y = corner[1] + cy;
        const z = corner[0] * sin + corner[2] * cos + cz;
        this.floats.push(x, y, z, nx, face.normal[1], nz, u, v, materialIndex, -1);
        this.trackBounds(x, y, z);
      }
    }
  }

  pushDiamond(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, materialIndex: number) {
    const top: Tuple3 = [cx, cy + sy, cz];
    const bottom: Tuple3 = [cx, cy - sy, cz];
    const points: Tuple3[] = [
      [cx + sx, cy, cz],
      [cx, cy, cz + sz],
      [cx - sx, cy, cz],
      [cx, cy, cz - sz],
    ];
    for (let index = 0; index < points.length; index += 1) {
      const next = (index + 1) % points.length;
      this.pushTriangle([top, points[index], points[next]], materialIndex);
      this.pushTriangle([bottom, points[next], points[index]], materialIndex);
    }
  }

  pushTriangle(corners: [Tuple3, Tuple3, Tuple3], materialIndex: number) {
    const a = corners[0];
    const b = corners[1];
    const c = corners[2];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nxRaw = uy * vz - uz * vy;
    const nyRaw = uz * vx - ux * vz;
    const nzRaw = ux * vy - uy * vx;
    const normalLength = Math.hypot(nxRaw, nyRaw, nzRaw) || 1;
    const nx = nxRaw / normalLength;
    const ny = nyRaw / normalLength;
    const nz = nzRaw / normalLength;
    const tangentLength = Math.hypot(ux, uy, uz) || 1;
    const tx = ux / tangentLength;
    const ty = uy / tangentLength;
    const tz = uz / tangentLength;
    corners.forEach((corner, index) => {
      this.floats.push(corner[0], corner[1], corner[2], nx, ny, nz, index === 1 ? 1 : 0, index === 2 ? 1 : 0, materialIndex, -1);
      this.trackBounds(corner[0], corner[1], corner[2]);
    });
  }

  /** A front-facing XY quad with exact 0..1 UVs for one-shot image decals. */
  pushTexturedQuadXY(cx: number, cy: number, cz: number, sx: number, sy: number, materialIndex: number) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = 0.018;
    const corners: Array<{ position: Tuple3; uv: readonly [number, number] }> = [
      { position: [cx - hx, cy - hy, cz + hz], uv: [0, 1] },
      { position: [cx + hx, cy - hy, cz + hz], uv: [1, 1] },
      { position: [cx + hx, cy + hy, cz + hz], uv: [1, 0] },
      { position: [cx - hx, cy + hy, cz + hz], uv: [0, 0] },
    ];
    const backCorners = corners.map((corner) => ({
      position: [corner.position[0], corner.position[1], cz - hz] as Tuple3,
      uv: [1 - corner.uv[0], corner.uv[1]] as const,
    }));
    const faces = [
      { normal: [0, 0, 1] as Tuple3, corners, triangleIndices: [0, 1, 2, 0, 2, 3] },
      { normal: [0, 0, -1] as Tuple3, corners: backCorners, triangleIndices: [0, 2, 1, 0, 3, 2] },
    ];
    for (const face of faces) {
      for (const index of face.triangleIndices) {
        const corner = face.corners[index];
        this.floats.push(
          corner.position[0],
          corner.position[1],
          corner.position[2],
          face.normal[0],
          face.normal[1],
          face.normal[2],
          corner.uv[0],
          corner.uv[1],
          materialIndex,
          -1,
        );
        this.trackBounds(corner.position[0], corner.position[1], corner.position[2]);
      }
    }
  }

  /** A front-facing XY disc used by procedural proxy models. */
  pushDiscXY(cx: number, cy: number, cz: number, radius: number, materialIndex: number, segments = 48) {
    const center: Tuple3 = [cx, cy, cz];
    for (let index = 0; index < segments; index += 1) {
      const a0 = (index / segments) * Math.PI * 2;
      const a1 = ((index + 1) / segments) * Math.PI * 2;
      const p0: Tuple3 = [cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, cz];
      const p1: Tuple3 = [cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, cz];
      this.pushOrientedTriangleXY([center, p0, p1], radius, cx, cy, materialIndex);
    }
  }

  /** A front-facing XY ring used by procedural proxy models. */
  pushRingXY(cx: number, cy: number, cz: number, innerRadius: number, outerRadius: number, materialIndex: number, segments = 64) {
    for (let index = 0; index < segments; index += 1) {
      const a0 = (index / segments) * Math.PI * 2;
      const a1 = ((index + 1) / segments) * Math.PI * 2;
      const inner0: Tuple3 = [cx + Math.cos(a0) * innerRadius, cy + Math.sin(a0) * innerRadius, cz];
      const outer0: Tuple3 = [cx + Math.cos(a0) * outerRadius, cy + Math.sin(a0) * outerRadius, cz];
      const inner1: Tuple3 = [cx + Math.cos(a1) * innerRadius, cy + Math.sin(a1) * innerRadius, cz];
      const outer1: Tuple3 = [cx + Math.cos(a1) * outerRadius, cy + Math.sin(a1) * outerRadius, cz];
      this.pushOrientedTriangleXY([inner0, outer0, outer1], outerRadius, cx, cy, materialIndex);
      this.pushOrientedTriangleXY([inner0, outer1, inner1], outerRadius, cx, cy, materialIndex);
    }
  }

  /** Copies pre-packed vertices, rewriting local material indices. */
  pushRawVertices(vertices: Float32Array, remapMaterial: (localIndex: number) => number) {
    for (let vertex = 0; vertex < vertices.length; vertex += FLOATS_PER_VERTEX) {
      for (let component = 0; component < FLOATS_PER_VERTEX; component += 1) {
        const value = vertices[vertex + component];
        this.floats.push(component === VERTEX_MATERIAL_INDEX_COMPONENT ? remapMaterial(Math.max(0, Math.round(value))) : value);
      }
      this.trackBounds(vertices[vertex], vertices[vertex + 1], vertices[vertex + 2]);
    }
  }

  vertexCount() {
    return this.floats.length / FLOATS_PER_VERTEX;
  }

  assets() {
    return this.finished.map((asset) => ({
      modelKey: asset.modelKey,
      vertexOffset: asset.vertexOffset,
      vertexCount: asset.vertexCount,
      triangleCount: asset.vertexCount / 3,
      bounds: boundsFrom(asset.min, asset.max),
      ...(asset.nodeCount !== undefined ? { nodeCount: asset.nodeCount } : {}),
      ...(asset.skinCount !== undefined ? { skinCount: asset.skinCount } : {}),
      ...(asset.rigidSkin ? { rigidSkin: asset.rigidSkin } : {}),
      ...(asset.animationClips ? { animationClips: asset.animationClips } : {}),
      ...(asset.nodeChunks ? { nodeChunks: asset.nodeChunks } : {}),
      status: (asset.vertexCount > 0 ? "ready" : "empty") as "ready" | "empty",
    }));
  }

  finish(): ArrayBuffer {
    const array = new Float32Array(this.floats);
    return array.buffer;
  }

  private trackBounds(x: number, y: number, z: number) {
    const current = this.current;
    if (!current) return;
    current.min = [Math.min(current.min[0], x), Math.min(current.min[1], y), Math.min(current.min[2], z)];
    current.max = [Math.max(current.max[0], x), Math.max(current.max[1], y), Math.max(current.max[2], z)];
  }

  private pushOrientedTriangleXY(corners: [Tuple3, Tuple3, Tuple3], radius: number, cx: number, cy: number, materialIndex: number) {
    for (const corner of corners) {
      const u = 0.5 + (corner[0] - cx) / Math.max(radius * 2, 0.0001);
      const v = 0.5 - (corner[1] - cy) / Math.max(radius * 2, 0.0001);
      this.floats.push(corner[0], corner[1], corner[2], 0, 0, 1, u, v, materialIndex, -1);
      this.trackBounds(corner[0], corner[1], corner[2]);
    }
  }
}

export function boundsFrom(min: Tuple3, max: Tuple3) {
  if (!Number.isFinite(min[0])) return undefined;
  return {
    min,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] as Tuple3,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as Tuple3,
  };
}
