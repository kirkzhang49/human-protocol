import fsSync from "node:fs";
import { roundNumber } from "./raw-webgpu-plan-utils.mjs";

export function readGlbMetadataSync(filePath) {
  try {
    const buffer = fsSync.readFileSync(filePath);
    if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB file");
    let offset = 12;
    let json = null;
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32LE(offset);
      const type = buffer.readUInt32LE(offset + 4);
      offset += 8;
      if (type === 0x4e4f534a) {
        json = JSON.parse(buffer.subarray(offset, offset + length).toString("utf8"));
      }
      offset += length;
    }
    if (!json) throw new Error("missing JSON chunk");
    const primitiveCount = (json.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives ?? []).length, 0);
    const triangleCount = (json.meshes ?? []).reduce((sum, mesh) => {
      return (
        sum +
        (mesh.primitives ?? []).reduce((meshSum, primitive) => {
          if (primitive.mode && primitive.mode !== 4) return meshSum;
          const accessor = Number.isInteger(primitive.indices) ? json.accessors?.[primitive.indices] : null;
          if (accessor?.count) return meshSum + Math.floor(accessor.count / 3);
          const firstAttribute = primitive.attributes ? Object.values(primitive.attributes)[0] : null;
          const attrAccessor = Number.isInteger(firstAttribute) ? json.accessors?.[firstAttribute] : null;
          return meshSum + Math.floor((attrAccessor?.count ?? 0) / 3);
        }, 0)
      );
    }, 0);
    return {
      readable: true,
      byteLength: buffer.length,
      meshes: json.meshes?.length ?? 0,
      nodes: json.nodes?.length ?? 0,
      skins: json.skins?.length ?? 0,
      primitives: primitiveCount,
      materials: json.materials?.length ?? 0,
      textures: json.textures?.length ?? 0,
      images: json.images?.length ?? 0,
      accessors: json.accessors?.length ?? 0,
      bufferViews: json.bufferViews?.length ?? 0,
      animations: summarizeGlbAnimations(json),
      extensionsUsed: json.extensionsUsed ?? [],
      estimatedTriangles: triangleCount,
    };
  } catch (error) {
    return {
      readable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function summarizeGlbAnimations(json) {
  return (json.animations ?? []).map((animation, animationIndex) => {
    const name = animation.name ?? `clip_${animationIndex}`;
    const targetNodeIndexes = new Set();
    const targetPaths = new Set();
    const targetNodes = [];
    for (const channel of animation.channels ?? []) {
      const nodeIndex = Number.isInteger(channel.target?.node) ? channel.target.node : null;
      const targetPath = channel.target?.path ?? "unknown";
      targetPaths.add(targetPath);
      if (nodeIndex !== null) {
        targetNodeIndexes.add(nodeIndex);
        if (targetNodes.length < 48) {
          targetNodes.push({
            node: nodeIndex,
            name: json.nodes?.[nodeIndex]?.name ?? null,
            path: targetPath,
          });
        }
      }
    }
    let durationSeconds = 0;
    for (const sampler of animation.samplers ?? []) {
      const inputAccessor = Number.isInteger(sampler.input) ? json.accessors?.[sampler.input] : null;
      const maxTime = Array.isArray(inputAccessor?.max) ? Number(inputAccessor.max[0]) : 0;
      if (Number.isFinite(maxTime)) durationSeconds = Math.max(durationSeconds, maxTime);
    }
    return {
      index: animationIndex,
      name,
      action: normalizeAnimationAction(name),
      durationSeconds: roundNumber(durationSeconds),
      samplerCount: animation.samplers?.length ?? 0,
      channelCount: animation.channels?.length ?? 0,
      targetNodeCount: targetNodeIndexes.size,
      targetPaths: [...targetPaths].sort(),
      targetNodes,
    };
  });
}

export function normalizeAnimationAction(name) {
  return (
    String(name)
      .replace(/\.\d+$/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "clip"
  );
}
