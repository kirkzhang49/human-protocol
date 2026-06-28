// TEMP PROBE — delete after use. Dumps every cooked node chunk of the key GLB
// with bounds / vertex count / material baseColor so we can see which node is a
// degenerate or black "spike" without guessing.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it } from "vitest";

const OUT = resolve(process.cwd(), ".tmp", "spike-probe.txt");
writeFileSync(OUT, "");
const log = (line: string) => appendFileSync(OUT, line + "\n");

import { ensureMeshoptDecoderReady, parseGlbToCookedModel } from "../../build/runtime-pack/cookGlbModels";
import { isPickupWrapFaceNode } from "./pickupNodeVisibility";

const FLOATS_PER_VERTEX = 10; // matches cookGlbModels current layout

function loadGlb(file: string): ArrayBuffer {
  const buf = readFileSync(resolve(process.cwd(), "src/assets/models-cooked/environment/props", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function chunkBounds(verts: Float32Array, offset: number, count: number) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let matIdx = -999;
  for (let i = 0; i < count; i += 1) {
    const base = (offset + i) * FLOATS_PER_VERTEX;
    for (let a = 0; a < 3; a += 1) {
      min[a] = Math.min(min[a], verts[base + a]);
      max[a] = Math.max(max[a], verts[base + a]);
    }
    matIdx = verts[base + 8];
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const maxDim = Math.max(size[0], size[1], size[2]);
  const minDim = Math.min(size[0], size[1], size[2]);
  return { min, max, size, maxDim, minDim, matIdx };
}

describe("SPIKE PROBE", () => {
  for (const file of ["hp_pickup_large_yellow_key.glb", "hp_pickup_energy_cell_amber.glb", "hp_pickup_medkit_white_red.glb"]) {
    it(`dumps ${file}`, async () => {
      await ensureMeshoptDecoderReady();
      const model = parseGlbToCookedModel(file, loadGlb(file), { emitNodeChunks: true });
      const verts = model.vertices;
      log(`\n===== ${file} =====`);
      log(`modelKey=${model.modelKey} vertexCount=${model.vertexCount} chunks=${(model.nodeChunks ?? []).length}`);
      log(`overall bounds size=${model.bounds.size.map((n) => n.toFixed(3)).join(",")}`);
      log("materials:");
      model.materials.forEach((m, i) => {
        log(
          `  [${i}] ${m.name} base=[${m.baseColorFactor.map((n) => n.toFixed(2)).join(",")}] emissive=[${m.emissiveFactor.map((n) => n.toFixed(2)).join(",")}] eStr=${m.emissiveStrength} alpha=${m.alphaMode} dbl=${m.doubleSided}`,
        );
      });
      // NaN audit on raw vertex floats.
      let nanCount = 0;
      let firstNanAt = -1;
      const sampleVals: number[] = [];
      for (let i = 0; i < verts.length; i += 1) {
        if (Number.isNaN(verts[i])) {
          nanCount += 1;
          if (firstNanAt < 0) firstNanAt = i;
        }
      }
      for (let i = 0; i < Math.min(40, verts.length); i += 1) sampleVals.push(verts[i]);
      // Normal-length audit: how many vertices have a near-zero normal?
      let zeroN = 0;
      for (let v = 0; v < model.vertexCount; v += 1) {
        const b = v * FLOATS_PER_VERTEX;
        const nl = Math.hypot(verts[b + 3], verts[b + 4], verts[b + 5]);
        if (nl < 0.1) zeroN += 1;
      }
      log(`NORMAL AUDIT: zeroNormals=${zeroN}/${model.vertexCount}`);
      log(`NAN AUDIT: nanFloats=${nanCount}/${verts.length} firstNanAt=${firstNanAt} (col=${firstNanAt % FLOATS_PER_VERTEX})`);
      log(`first 40 floats: ${sampleVals.map((n) => (Number.isNaN(n) ? "NaN" : n.toFixed(3))).join(",")}`);
      log("node chunks (name | verts | size xyz | aspect maxDim/minDim | matIdx | base | hiddenByPredicate):");
      for (const chunk of model.nodeChunks ?? []) {
        const b = chunkBounds(verts, chunk.vertexOffset, chunk.vertexCount);
        const mat = model.materials[Math.max(0, Math.round(b.matIdx))];
        const aspect = b.minDim > 1e-6 ? (b.maxDim / b.minDim).toFixed(1) : "INF(flat)";
        const baseStr = mat ? `[${mat.baseColorFactor.map((n) => n.toFixed(2)).join(",")}]` : "?";
        const lum = mat ? mat.baseColorFactor[0] * 0.3 + mat.baseColorFactor[1] * 0.59 + mat.baseColorFactor[2] * 0.11 : 1;
        const flags = [];
        if (isPickupWrapFaceNode(chunk.nodeName)) flags.push("WRAPFACE");
        if (b.minDim < 1e-4) flags.push("DEGEN-FLAT");
        if (Number(aspect) > 50) flags.push("SLIVER");
        if (lum < 0.06 && (!mat || mat.emissiveStrength === 0)) flags.push("BLACK-MAT");
        log(
          `  ${chunk.nodeName} | v=${chunk.vertexCount} | sz=${b.size.map((n) => n.toFixed(3)).join(",")} | asp=${aspect} | mat=${b.matIdx} base=${baseStr} | ${flags.join(",") || "ok"}`,
        );
      }
    });
  }
});
