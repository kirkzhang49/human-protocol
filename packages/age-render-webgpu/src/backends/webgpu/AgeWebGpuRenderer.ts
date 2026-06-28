import { createAgeRendererContext, type AgeRendererContext } from "../../core/AgeRendererContext";
import type { AgeRenderBackend, AgeRenderer, AgeRendererCreateOptions } from "../../core/AgeRenderBackend";
import type { AgeSceneFrame } from "../../core/AgeSceneFrame";
import type { AgeRendererCapabilities, AgeViewport } from "../../core/AgeTypes";
import { createAgeFrameEncoder } from "../../graph/AgeFrameEncoder";
import { createAgeFrameTargets, type AgeFrameTargets } from "../../graph/AgeFrameTargets";
import { createAgeWebGpuRenderGraph } from "../../graph/createAgeWebGpuRenderGraph";

const webGpuCapabilities: AgeRendererCapabilities = {
  backend: "webgpu",
  supportsCompute: true,
  supportsFloatColorTarget: true,
  supportsTextureArrays: true,
  supportsStorageBuffers: true,
  supportsOffscreenPost: true,
  supportsWeightedOit: true,
};

export class AgeWebGpuRenderer implements AgeRenderer {
  readonly backendId = "age.render.webgpu";
  readonly capabilities = webGpuCapabilities;
  private readonly context: AgeRendererContext;
  private targets: AgeFrameTargets;
  private disposed = false;

  private constructor(context: AgeRendererContext, targets: AgeFrameTargets) {
    this.context = context;
    this.targets = targets;
  }

  static async create(options: AgeRendererCreateOptions) {
    const viewport = options.viewport ?? { width: 1, height: 1, pixelRatio: 1 };
    const graph = createAgeWebGpuRenderGraph();
    const gpu = await options.platform.requestWebGpuDevice?.({
      powerPreference: "high-performance",
      label: options.label ?? "age.webgpu",
    });
    if (!gpu) {
      throw new Error("AgeWebGpuRenderer requires a WebGPU device bundle. Use AgeFallbackPolicy to select another backend when WebGPU is unavailable.");
    }
    const context = createAgeRendererContext({
      backend: ageWebGpuBackend,
      capabilities: webGpuCapabilities,
      platform: options.platform,
      assets: options.assets,
      graph,
      viewport,
      gpu,
      telemetry: options.platform.telemetry,
    });
    const renderer = new AgeWebGpuRenderer(context, createAgeFrameTargets(viewport));
    await graph.setup(context);
    await graph.resize(context, renderer.targets);
    return renderer;
  }

  get graph() {
    return this.context.graph;
  }

  get rendererContext() {
    return this.context;
  }

  async resize(viewport: AgeViewport) {
    if (this.disposed) return;
    this.context.viewport = viewport;
    this.targets = createAgeFrameTargets(viewport, this.targets);
    await this.context.graph.resize(this.context, this.targets);
  }

  async renderFrame(frame: AgeSceneFrame) {
    if (this.disposed) return;
    this.context.timing = frame.timing;
    if (
      frame.viewport.width !== this.context.viewport.width ||
      frame.viewport.height !== this.context.viewport.height ||
      frame.viewport.pixelRatio !== this.context.viewport.pixelRatio
    ) {
      await this.resize(frame.viewport);
    }

    const rawEncoder = this.context.gpu?.device.createCommandEncoder?.({
      label: "age.frame",
    });
    const encoder = createAgeFrameEncoder(rawEncoder ?? null);
    await this.context.graph.execute(this.context, frame, this.targets, encoder);

    const commandBuffer = rawEncoder?.finish?.();
    if (commandBuffer) {
      this.context.gpu?.device.queue.submit?.([commandBuffer]);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.context.graph.dispose();
    this.context.disposables.dispose();
  }
}

export const ageWebGpuBackend: AgeRenderBackend = {
  id: "age.render.webgpu",
  kind: "webgpu",
  async canRun(platform) {
    const capabilities = await platform.detectCapabilities?.();
    if (capabilities?.webGpuAvailable === false) {
      return { available: false, reason: capabilities.webGpuUnavailableReason ?? "WebGPU is unavailable." };
    }
    return { available: true, capabilities: webGpuCapabilities };
  },
  createRenderer(options) {
    return AgeWebGpuRenderer.create(options);
  },
};
