import type { RawCookedGltfLoaderManifest } from "./RawCookedGltfLoaderManifest";
import { hasRawTransparentMaterials, isRawTransparentDrawBatch } from "./RawTransparentBatchPolicy";
import type { RawDrawBatch, RawRenderPlan } from "./RawWebGpuTypes";

export interface RawTransparentMaterialPassEncodeContext {
  pipeline: any;
  bindGroup: any;
  materialTextureBindGroup: any;
  drawBatches: readonly RawDrawBatch[];
  vertexBufferForBatch: (vertexBuffer: RawDrawBatch["vertexBuffer"]) => any;
}

export class RawTransparentMaterialPass {
  readonly enabled: boolean;

  constructor(plan: RawRenderPlan, cookedGltfLoaderManifest: RawCookedGltfLoaderManifest | null = null) {
    this.enabled = hasRawTransparentMaterials(plan, cookedGltfLoaderManifest);
  }

  encode(renderPass: any, context: RawTransparentMaterialPassEncodeContext) {
    if (!this.enabled) return;
    const transparentBatches = context.drawBatches.filter(isRawTransparentDrawBatch);
    if (transparentBatches.length <= 0) return;
    renderPass.setPipeline(context.pipeline);
    renderPass.setBindGroup(0, context.bindGroup);
    renderPass.setBindGroup(3, context.materialTextureBindGroup);

    let boundVertexBuffer: RawDrawBatch["vertexBuffer"] | null = null;
    for (let index = transparentBatches.length - 1; index >= 0; index -= 1) {
      const batch = transparentBatches[index];
      if (batch.vertexBuffer !== boundVertexBuffer) {
        renderPass.setVertexBuffer(0, context.vertexBufferForBatch(batch.vertexBuffer));
        boundVertexBuffer = batch.vertexBuffer;
      }
      renderPass.draw(batch.vertexCount, batch.instanceCount, batch.vertexOffset, batch.instanceOffset);
    }
  }
}
