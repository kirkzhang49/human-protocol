/**
 * Runtime mipmap generation for the raw renderer's texture arrays + hero floor.
 *
 * WebGPU has no built-in mip generation, so each mip level m is produced by
 * rendering a full-screen triangle that samples level m-1 with a linear sampler
 * (a box downsample). For an `rgba8unorm-srgb` texture the per-level views are
 * srgb, so sampling decodes to linear and the render re-encodes to srgb — the
 * average is taken in linear light, which is correct. The textures already carry
 * RENDER_ATTACHMENT usage, so their per-mip views are valid color targets.
 *
 * Only the base level (mip 0) must be populated before calling this; levels
 * 1..mipLevelCount-1 are filled here. Gated behind ?rawMipmaps — never invoked
 * on the default path.
 */
const BLIT_SHADER = /* wgsl */ `
struct VsOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vertex_index: u32) -> VsOut {
  var corners = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  let xy = corners[vertex_index];
  var out: VsOut;
  out.position = vec4<f32>(xy, 0.0, 1.0);
  // Map clip space to top-left-origin texture space (y flips between NDC and the
  // framebuffer) so a generated mip keeps the same orientation as mip 0.
  out.uv = vec2<f32>(xy.x * 0.5 + 0.5, 0.5 - xy.y * 0.5);
  return out;
}

@group(0) @binding(0) var src_texture: texture_2d<f32>;
@group(0) @binding(1) var src_sampler: sampler;

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  return textureSample(src_texture, src_sampler, in.uv);
}
`;

interface BlitResources {
  sampler: any;
  pipelines: Map<string, any>;
}

const blitResourcesByDevice = new WeakMap<object, BlitResources>();

function blitResourcesFor(device: any): BlitResources {
  let resources = blitResourcesByDevice.get(device);
  if (!resources) {
    resources = {
      sampler: device.createSampler({
        label: "hp.raw.mipgen.sampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
      }),
      pipelines: new Map(),
    };
    blitResourcesByDevice.set(device, resources);
  }
  return resources;
}

function blitPipelineFor(device: any, resources: BlitResources, format: string) {
  let pipeline = resources.pipelines.get(format);
  if (!pipeline) {
    const module = device.createShaderModule({ label: `hp.raw.mipgen.shader.${format}`, code: BLIT_SHADER });
    pipeline = device.createRenderPipeline({
      label: `hp.raw.mipgen.pipeline.${format}`,
      layout: "auto",
      vertex: { module, entryPoint: "vs" },
      fragment: { module, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
    resources.pipelines.set(format, pipeline);
  }
  return pipeline;
}

export function mipLevelCountForSize(width: number, height: number) {
  return 1 + Math.floor(Math.log2(Math.max(1, width, height)));
}

/**
 * Fill mip levels 1..mipLevelCount-1 of `texture` from its base level. `texture`
 * must have been created with `mipLevelCount` levels and TEXTURE_BINDING |
 * RENDER_ATTACHMENT usage. Works for single textures (layerCount=1) and 2D arrays.
 */
export function generateRawTextureMips(
  device: any,
  texture: any,
  options: { format: string; width: number; height: number; layerCount: number; mipLevelCount: number; label: string },
) {
  if (options.mipLevelCount <= 1) return;
  const resources = blitResourcesFor(device);
  const pipeline = blitPipelineFor(device, resources, options.format);

  device.pushErrorScope?.("validation");
  const encoder = device.createCommandEncoder({ label: `hp.raw.mipgen.encoder.${options.label}` });
  for (let layer = 0; layer < options.layerCount; layer += 1) {
    for (let level = 1; level < options.mipLevelCount; level += 1) {
      const sourceView = texture.createView({
        label: `${options.label}.src.l${layer}.m${level - 1}`,
        dimension: "2d",
        baseMipLevel: level - 1,
        mipLevelCount: 1,
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      });
      const destinationView = texture.createView({
        label: `${options.label}.dst.l${layer}.m${level}`,
        dimension: "2d",
        baseMipLevel: level,
        mipLevelCount: 1,
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sourceView },
          { binding: 1, resource: resources.sampler },
        ],
      });
      const pass = encoder.beginRenderPass({
        label: `${options.label}.pass.l${layer}.m${level}`,
        colorAttachments: [
          {
            view: destinationView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3, 1, 0, 0);
      pass.end();
    }
  }
  device.queue.submit([encoder.finish()]);
  device.popErrorScope?.().then?.((error: { message?: string } | null) => {
    if (error) console.warn(`[HumanProtocol] Raw WebGPU mipmap generation error: ${options.label}.`, error.message ?? error);
  });
}
