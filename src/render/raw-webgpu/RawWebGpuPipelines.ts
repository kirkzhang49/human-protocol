import {
  DEPTH_FORMAT,
  FLOATS_PER_VERTEX,
  GLASS_OIT_ACCUM_FORMAT,
  GLASS_OIT_REVEAL_FORMAT,
  HERO_FLOOR_VERTEX_FLOATS,
  OFFSCREEN_COLOR_FORMAT,
  RAW_TEXTURE_ARRAY_PAGE_COUNT,
  SHADOW_DEPTH_FORMAT,
} from "./RawWebGpuConstants";
import type { GpuGlobals } from "./RawWebGpuTypes";
import glassOitResolveShader from "./shaders/glassOitResolve.wgsl?raw";
import levelProxyShader from "./shaders/levelProxy.wgsl?raw";
import transparentShader from "./shaders/transparent.wgsl?raw";

export interface RawWebGpuBindGroupLayouts {
  scene: any;
  bloom: any;
  heroFloor: any;
  materialTextures: any;
  glassOit: any;
}

export interface RawWebGpuPipelineBundle {
  sceneCanvas: any;
  sceneOffscreen: any;
  glassOverlayCanvas: any;
  glassOverlayOffscreen: any;
  glassOitAccum: any;
  glassOitResolveCanvas: any;
  glassOitResolveOffscreen: any;
  transparentCanvas: any;
  transparentOffscreen: any;
  shadowMap: any;
  contactShadowCanvas: any;
  contactShadowOffscreen: any;
  heroFloorCanvas: any;
  heroFloorOffscreen: any;
  bloomComposite: any;
}

export function createRawWebGpuBindGroupLayouts(device: any): RawWebGpuBindGroupLayouts {
  const gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  const scene = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: gpuGlobals.GPUShaderStage.VERTEX | gpuGlobals.GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        binding: 1,
        visibility: gpuGlobals.GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 2,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        binding: 3,
        visibility: gpuGlobals.GPUShaderStage.VERTEX | gpuGlobals.GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        binding: 4,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "depth" },
      },
      {
        binding: 5,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        sampler: { type: "comparison" },
      },
      {
        binding: 6,
        visibility: gpuGlobals.GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 7,
        visibility: gpuGlobals.GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  });

  const bloom = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" },
      },
      {
        binding: 1,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
      {
        binding: 2,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });

  const heroFloor = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" },
      },
      {
        binding: 1,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
    ],
  });

  const materialTextures = device.createBindGroupLayout({
    entries: [
      ...Array.from({ length: RAW_TEXTURE_ARRAY_PAGE_COUNT }, (_, page) => ({
        binding: page,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float", viewDimension: "2d-array" },
      })),
      {
        binding: RAW_TEXTURE_ARRAY_PAGE_COUNT,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
      ...Array.from({ length: RAW_TEXTURE_ARRAY_PAGE_COUNT }, (_, page) => ({
        binding: RAW_TEXTURE_ARRAY_PAGE_COUNT + 1 + page,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float", viewDimension: "2d-array" },
      })),
      // Phase-1 IBL (opt-in ?rawCube=1): prefiltered specular cubemap + DFG LUT.
      {
        binding: RAW_TEXTURE_ARRAY_PAGE_COUNT * 2 + 1,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float", viewDimension: "cube" },
      },
      {
        binding: RAW_TEXTURE_ARRAY_PAGE_COUNT * 2 + 2,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
      {
        binding: RAW_TEXTURE_ARRAY_PAGE_COUNT * 2 + 3,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float", viewDimension: "2d" },
      },
      {
        binding: RAW_TEXTURE_ARRAY_PAGE_COUNT * 2 + 4,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
    ],
  });

  const glassOit = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" },
      },
      {
        binding: 1,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" },
      },
      {
        binding: 2,
        visibility: gpuGlobals.GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
    ],
  });

  return { scene, bloom, heroFloor, materialTextures, glassOit };
}

export function createRawWebGpuPipelines(device: any, format: string, layouts: RawWebGpuBindGroupLayouts): RawWebGpuPipelineBundle {
  const singleScenePipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layouts.scene] });
  const scenePipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [layouts.scene, layouts.bloom, layouts.heroFloor, layouts.materialTextures],
  });
  const bloomPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layouts.scene, layouts.bloom] });
  const heroFloorPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [layouts.scene, layouts.bloom, layouts.heroFloor],
  });
  const glassOitResolvePipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [layouts.glassOit],
  });

  device.pushErrorScope?.("validation");
  const shaderModule = device.createShaderModule({ label: "hp.raw.level-proxy-shader", code: levelProxyShader });
  device.popErrorScope?.().then?.((error: { message?: string } | null) => {
    if (error) console.warn("[HumanProtocol] Raw WebGPU shader module error.", error.message ?? error);
  });
  device.pushErrorScope?.("validation");
  const transparentShaderModule = device.createShaderModule({ label: "hp.raw.transparent-shader", code: transparentShader });
  device.popErrorScope?.().then?.((error: { message?: string } | null) => {
    if (error) console.warn("[HumanProtocol] Raw WebGPU transparent shader module error.", error.message ?? error);
  });
  device.pushErrorScope?.("validation");
  const glassOitResolveShaderModule = device.createShaderModule({ label: "hp.raw.glass-oit-resolve-shader", code: glassOitResolveShader });
  device.popErrorScope?.().then?.((error: { message?: string } | null) => {
    if (error) console.warn("[HumanProtocol] Raw WebGPU glass OIT resolve shader module error.", error.message ?? error);
  });

  const vertexState = {
    module: shaderModule,
    entryPoint: "vs_main",
    buffers: [
      {
        arrayStride: FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 3 * Float32Array.BYTES_PER_ELEMENT, format: "float32x3" },
          // shaderLocation 2 (tangent) intentionally removed — see FLOATS_PER_VERTEX.
          { shaderLocation: 3, offset: 6 * Float32Array.BYTES_PER_ELEMENT, format: "float32x2" },
          { shaderLocation: 4, offset: 8 * Float32Array.BYTES_PER_ELEMENT, format: "float32" },
          { shaderLocation: 5, offset: 9 * Float32Array.BYTES_PER_ELEMENT, format: "float32" },
        ],
      },
    ],
  };

  const overlayBlend = {
    color: {
      operation: "add",
      srcFactor: "src-alpha",
      dstFactor: "one-minus-src-alpha",
    },
    alpha: {
      operation: "add",
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
    },
  };

  const heroFloorVertexState = {
    module: shaderModule,
    entryPoint: "vs_hero_floor",
    buffers: [
      {
        arrayStride: HERO_FLOOR_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 3 * Float32Array.BYTES_PER_ELEMENT, format: "float32x2" },
        ],
      },
    ],
  };

  return {
    sceneCanvas: createRenderPipelineWithValidation(device, "hp.raw.scene-canvas", {
      layout: scenePipelineLayout,
      vertex: vertexState,
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    sceneOffscreen: createRenderPipelineWithValidation(device, "hp.raw.scene-offscreen", {
      layout: scenePipelineLayout,
      vertex: vertexState,
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format: OFFSCREEN_COLOR_FORMAT }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    glassOverlayCanvas: createRenderPipelineWithValidation(device, "hp.raw.glass-overlay-canvas", {
      layout: singleScenePipelineLayout,
      vertex: vertexState,
      fragment: {
        module: shaderModule,
        entryPoint: "fs_glass_overlay",
        targets: [{ format, blend: overlayBlend }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    glassOverlayOffscreen: createRenderPipelineWithValidation(device, "hp.raw.glass-overlay-offscreen", {
      layout: singleScenePipelineLayout,
      vertex: vertexState,
      fragment: {
        module: shaderModule,
        entryPoint: "fs_glass_overlay",
        targets: [{ format: OFFSCREEN_COLOR_FORMAT, blend: overlayBlend }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    glassOitAccum: createRenderPipelineWithValidation(device, "hp.raw.glass-oit-accum", {
      layout: scenePipelineLayout,
      vertex: {
        module: transparentShaderModule,
        entryPoint: "vs_transparent",
        buffers: vertexState.buffers,
      },
      fragment: {
        module: transparentShaderModule,
        entryPoint: "fs_transparent_oit",
        targets: [
          {
            format: GLASS_OIT_ACCUM_FORMAT,
            blend: {
              color: {
                operation: "add",
                srcFactor: "one",
                dstFactor: "one",
              },
              alpha: {
                operation: "add",
                srcFactor: "one",
                dstFactor: "one",
              },
            },
          },
          {
            format: GLASS_OIT_REVEAL_FORMAT,
            blend: {
              color: {
                operation: "add",
                srcFactor: "zero",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: {
                operation: "add",
                srcFactor: "zero",
                dstFactor: "one-minus-src-alpha",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    glassOitResolveCanvas: createRenderPipelineWithValidation(device, "hp.raw.glass-oit-resolve-canvas", {
      layout: glassOitResolvePipelineLayout,
      vertex: {
        module: glassOitResolveShaderModule,
        entryPoint: "vs_oit_fullscreen",
      },
      fragment: {
        module: glassOitResolveShaderModule,
        entryPoint: "fs_oit_resolve",
        targets: [{ format, blend: overlayBlend }],
      },
      primitive: {
        topology: "triangle-list",
      },
    }),
    glassOitResolveOffscreen: createRenderPipelineWithValidation(device, "hp.raw.glass-oit-resolve-offscreen", {
      layout: glassOitResolvePipelineLayout,
      vertex: {
        module: glassOitResolveShaderModule,
        entryPoint: "vs_oit_fullscreen",
      },
      fragment: {
        module: glassOitResolveShaderModule,
        entryPoint: "fs_oit_resolve",
        targets: [{ format: OFFSCREEN_COLOR_FORMAT, blend: overlayBlend }],
      },
      primitive: {
        topology: "triangle-list",
      },
    }),
    transparentCanvas: createRenderPipelineWithValidation(device, "hp.raw.transparent-material-canvas", {
      layout: scenePipelineLayout,
      vertex: {
        module: transparentShaderModule,
        entryPoint: "vs_transparent",
        buffers: vertexState.buffers,
      },
      fragment: {
        module: transparentShaderModule,
        entryPoint: "fs_transparent",
        targets: [
          {
            format,
            blend: {
              color: {
                operation: "add",
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: {
                operation: "add",
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    transparentOffscreen: createRenderPipelineWithValidation(device, "hp.raw.transparent-material-offscreen", {
      layout: scenePipelineLayout,
      vertex: {
        module: transparentShaderModule,
        entryPoint: "vs_transparent",
        buffers: vertexState.buffers,
      },
      fragment: {
        module: transparentShaderModule,
        entryPoint: "fs_transparent",
        targets: [
          {
            format: OFFSCREEN_COLOR_FORMAT,
            blend: {
              color: {
                operation: "add",
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: {
                operation: "add",
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    shadowMap: createRenderPipelineWithValidation(device, "hp.raw.shadow-map", {
      layout: scenePipelineLayout,
      vertex: {
        ...vertexState,
        entryPoint: "vs_shadow",
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: SHADOW_DEPTH_FORMAT,
      },
    }),
    contactShadowCanvas: createRenderPipelineWithValidation(device, "hp.raw.contact-shadow-canvas", {
      layout: singleScenePipelineLayout,
      vertex: vertexState,
      fragment: {
        module: shaderModule,
        entryPoint: "fs_contact_shadow",
        targets: [{ format, blend: overlayBlend }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    contactShadowOffscreen: createRenderPipelineWithValidation(device, "hp.raw.contact-shadow-offscreen", {
      layout: singleScenePipelineLayout,
      vertex: vertexState,
      fragment: {
        module: shaderModule,
        entryPoint: "fs_contact_shadow",
        targets: [{ format: OFFSCREEN_COLOR_FORMAT, blend: overlayBlend }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    heroFloorCanvas: createRenderPipelineWithValidation(device, "hp.raw.hero-floor-canvas", {
      layout: heroFloorPipelineLayout,
      vertex: heroFloorVertexState,
      fragment: {
        module: shaderModule,
        entryPoint: "fs_hero_floor",
        targets: [{ format, blend: overlayBlend }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    heroFloorOffscreen: createRenderPipelineWithValidation(device, "hp.raw.hero-floor-offscreen", {
      layout: heroFloorPipelineLayout,
      vertex: heroFloorVertexState,
      fragment: {
        module: shaderModule,
        entryPoint: "fs_hero_floor",
        targets: [{ format: OFFSCREEN_COLOR_FORMAT, blend: overlayBlend }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    }),
    bloomComposite: createRenderPipelineWithValidation(device, "hp.raw.bloom-composite", {
      layout: bloomPipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "vs_fullscreen",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_bloom_composite",
        targets: [{ format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    }),
  };
}

function createRenderPipelineWithValidation(device: any, label: string, descriptor: Record<string, unknown>) {
  device.pushErrorScope?.("validation");
  const pipeline = device.createRenderPipeline({ label, ...descriptor });
  device.popErrorScope?.().then?.((error: { message?: string } | null) => {
    if (error) console.warn(`[HumanProtocol] Raw WebGPU pipeline error: ${label}.`, error.message ?? error);
  });
  return pipeline;
}
