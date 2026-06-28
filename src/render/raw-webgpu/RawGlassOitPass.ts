import { GLASS_OIT_ACCUM_FORMAT, GLASS_OIT_REVEAL_FORMAT } from "./RawWebGpuConstants";
import type { RawCookedGltfLoaderManifest } from "./RawCookedGltfLoaderManifest";
import { hasRawTransparentMaterials, isRawTransparentDrawBatch } from "./RawTransparentBatchPolicy";
import { createTextureViewWithValidation } from "./RawWebGpuTextureResources";
import type { GpuGlobals, RawDrawBatch, RawRenderPlan } from "./RawWebGpuTypes";

export interface RawGlassOitPassEncodeContext {
  accumPipeline: any;
  resolvePipeline: any;
  depthView: any;
  targetView: any;
  bindGroup: any;
  bloomCompatibleBindGroup: any;
  heroFloorBindGroup: any;
  materialTextureBindGroup: any;
  drawBatches: readonly RawDrawBatch[];
  vertexBufferForBatch: (vertexBuffer: RawDrawBatch["vertexBuffer"]) => any;
}

export class RawGlassOitPass {
  readonly enabled: boolean;
  private readonly device: any;
  private readonly gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  private readonly bindGroupLayout: any;
  private readonly sampler: any;
  private accumTexture: any = null;
  private revealTexture: any = null;
  private accumView: any = null;
  private revealView: any = null;
  private bindGroup: any = null;
  private width = 0;
  private height = 0;

  constructor(device: any, bindGroupLayout: any, plan: RawRenderPlan, cookedGltfLoaderManifest: RawCookedGltfLoaderManifest | null = null) {
    this.device = device;
    this.bindGroupLayout = bindGroupLayout;
    this.enabled = hasRawTransparentMaterials(plan, cookedGltfLoaderManifest);
    this.sampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });
  }

  resize(width: number, height: number) {
    if (!this.enabled) return;
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    if (nextWidth === this.width && nextHeight === this.height && this.bindGroup) return;
    this.width = nextWidth;
    this.height = nextHeight;
    this.disposeTextures();

    const usage = this.gpuGlobals.GPUTextureUsage.RENDER_ATTACHMENT | this.gpuGlobals.GPUTextureUsage.TEXTURE_BINDING;
    this.accumTexture = this.device.createTexture({
      label: "hp.raw.glass-oit-accum",
      size: [nextWidth, nextHeight],
      format: GLASS_OIT_ACCUM_FORMAT,
      usage,
    });
    this.revealTexture = this.device.createTexture({
      label: "hp.raw.glass-oit-reveal",
      size: [nextWidth, nextHeight],
      format: GLASS_OIT_REVEAL_FORMAT,
      usage,
    });
    this.accumView = createTextureViewWithValidation(this.device, "hp.raw.glass-oit-accum-view", this.accumTexture);
    this.revealView = createTextureViewWithValidation(this.device, "hp.raw.glass-oit-reveal-view", this.revealTexture);
    this.bindGroup = this.device.createBindGroup({
      label: "hp.raw.glass-oit-bind-group",
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.accumView },
        { binding: 1, resource: this.revealView },
        { binding: 2, resource: this.sampler },
      ],
    });
  }

  encode(encoder: any, context: RawGlassOitPassEncodeContext) {
    if (!this.enabled || !this.bindGroup || !this.accumView || !this.revealView) return false;
    const transparentBatches = context.drawBatches.filter(isRawTransparentDrawBatch);
    if (transparentBatches.length <= 0) return false;

    const accumPass = encoder.beginRenderPass({
      label: "hp.raw.glass-oit-accum-pass",
      colorAttachments: [
        {
          view: this.accumView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: this.revealView,
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: context.depthView,
        depthLoadOp: "load",
        depthStoreOp: "store",
      },
    });
    accumPass.setPipeline(context.accumPipeline);
    accumPass.setBindGroup(0, context.bindGroup);
    accumPass.setBindGroup(1, context.bloomCompatibleBindGroup);
    accumPass.setBindGroup(2, context.heroFloorBindGroup);
    accumPass.setBindGroup(3, context.materialTextureBindGroup);
    let boundVertexBuffer: RawDrawBatch["vertexBuffer"] | null = null;
    for (const batch of transparentBatches) {
      if (batch.vertexBuffer !== boundVertexBuffer) {
        accumPass.setVertexBuffer(0, context.vertexBufferForBatch(batch.vertexBuffer));
        boundVertexBuffer = batch.vertexBuffer;
      }
      accumPass.draw(batch.vertexCount, batch.instanceCount, batch.vertexOffset, batch.instanceOffset);
    }
    accumPass.end();

    const resolvePass = encoder.beginRenderPass({
      label: "hp.raw.glass-oit-resolve-pass",
      colorAttachments: [
        {
          view: context.targetView,
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });
    resolvePass.setPipeline(context.resolvePipeline);
    resolvePass.setBindGroup(0, this.bindGroup);
    resolvePass.draw(3, 1, 0, 0);
    resolvePass.end();
    return true;
  }

  dispose() {
    this.disposeTextures();
  }

  private disposeTextures() {
    this.accumTexture?.destroy?.();
    this.revealTexture?.destroy?.();
    this.accumTexture = null;
    this.revealTexture = null;
    this.accumView = null;
    this.revealView = null;
    this.bindGroup = null;
  }
}
