export interface AgeGpuQueueLike {
  writeBuffer?: (...args: unknown[]) => void;
  writeTexture?: (...args: unknown[]) => void;
  copyExternalImageToTexture?: (...args: unknown[]) => void;
  submit?: (commandBuffers: readonly unknown[]) => void;
}

export interface AgeGpuDeviceLike {
  readonly label?: string;
  readonly queue: AgeGpuQueueLike;
  readonly limits?: Record<string, number>;
  createBuffer?: (...args: unknown[]) => unknown;
  createTexture?: (...args: unknown[]) => AgeGpuTextureLike;
  createSampler?: (...args: unknown[]) => unknown;
  createBindGroup?: (...args: unknown[]) => unknown;
  createBindGroupLayout?: (...args: unknown[]) => unknown;
  createPipelineLayout?: (...args: unknown[]) => unknown;
  createRenderPipeline?: (...args: unknown[]) => unknown;
  createComputePipeline?: (...args: unknown[]) => unknown;
  createShaderModule?: (...args: unknown[]) => unknown;
  createCommandEncoder?: (...args: unknown[]) => AgeGpuCommandEncoderLike;
  pushErrorScope?: (filter: string) => void;
  popErrorScope?: () => Promise<{ message?: string } | null>;
}

export interface AgeGpuCommandEncoderLike {
  beginRenderPass?: (...args: unknown[]) => unknown;
  beginComputePass?: (...args: unknown[]) => unknown;
  finish?: () => unknown;
}

export interface AgeGpuCanvasContextLike {
  configure?: (...args: unknown[]) => void;
  getCurrentTexture?: () => AgeGpuTextureLike;
}

export interface AgeGpuTextureLike {
  createView?: (...args: unknown[]) => AgeGpuTextureViewLike;
  destroy?: () => void;
}

export type AgeGpuTextureViewLike = unknown;

export interface AgeGpuDeviceBundle {
  device: AgeGpuDeviceLike;
  context?: AgeGpuCanvasContextLike;
  canvasFormat: string;
  gpuGlobals?: Record<string, unknown>;
}

export interface AgeGpuDeviceRequest {
  powerPreference?: "high-performance" | "low-power";
  requiredFeatures?: readonly string[];
  label?: string;
}
