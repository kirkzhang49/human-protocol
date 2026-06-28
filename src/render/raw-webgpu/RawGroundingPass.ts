import type { RawDrawBatch } from "./RawWebGpuTypes";

export interface RawGroundingPassEncodeContext {
  pipeline: any;
  bindGroup: any;
  shadowVertexBuffer: any;
  drawBatches: readonly RawDrawBatch[];
}

export class RawGroundingPass {
  encodeContactShadows(renderPass: any, context: RawGroundingPassEncodeContext) {
    if (!context.pipeline || !context.shadowVertexBuffer) return;
    renderPass.setPipeline(context.pipeline);
    renderPass.setBindGroup(0, context.bindGroup);
    renderPass.setVertexBuffer(0, context.shadowVertexBuffer);
    for (const batch of context.drawBatches) {
      if (batch.vertexBuffer !== "shadow") continue;
      renderPass.draw(batch.vertexCount, batch.instanceCount, batch.vertexOffset, batch.instanceOffset);
    }
  }
}
