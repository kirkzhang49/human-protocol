import type { PerspectiveCamera } from "three";
import type { GameWorld } from "../../game/core/GameWorld";
import type { RenderQualityTier } from "../../game/core/RenderPerformance";
import { isEnemyVisibleToPlayerRoom } from "../../game/core/RoomReachability";
import { DEPTH_FORMAT, OFFSCREEN_COLOR_FORMAT } from "./RawWebGpuConstants";
import { rawGpuParticleCount, rawGpuParticlesEnabled } from "./RawWebGpuQuality";
import type { GpuGlobals } from "./RawWebGpuTypes";
import gpuParticleShader from "./shaders/gpuParticles.wgsl?raw";

const PARTICLE_FLOATS = 12;
const PARTICLE_BYTES = PARTICLE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const PARTICLE_UNIFORM_FLOATS = 36;
const PARTICLE_UNIFORM_BYTES = PARTICLE_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const MAX_GPU_PARTICLES = 1024;
const MAX_VFX_EMITTERS = 64;
const VFX_EMITTER_FLOATS = 12;
const VFX_EMITTER_BYTES = MAX_VFX_EMITTERS * VFX_EMITTER_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const PARTICLE_WORKGROUP_SIZE = 64;

export class RawGpuParticlePass {
  readonly enabled: boolean;
  private readonly device: any;
  private readonly gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  private readonly particleBuffers: any[] = [];
  private readonly computeBindGroups: any[] = [];
  private readonly renderBindGroups: any[] = [];
  private readonly emptyRenderBindGroup: any;
  private readonly uniformBuffer: any;
  private readonly emitterBuffer: any;
  private readonly computePipeline: any;
  private readonly renderPipelineCanvas: any;
  private readonly renderPipelineOffscreen: any;
  // Depth-aware variants (rawSoftParticles): same vertex shader, fs_particles_soft
  // fragment, render-layout + a scene-depth texture binding. Bind groups are
  // rebuilt lazily when the depth view changes (resize).
  private readonly softRenderLayout: any;
  private readonly softRenderPipelineCanvas: any;
  private readonly softRenderPipelineOffscreen: any;
  private readonly softRenderBindGroups: any[] = [];
  private softDepthView: any = null;
  private readonly uniformFloats = new Float32Array(PARTICLE_UNIFORM_FLOATS);
  private readonly emitterFloats = new Float32Array(MAX_VFX_EMITTERS * VFX_EMITTER_FLOATS);
  private readIndex = 0;
  private activeCount = 0;
  private emitterCount = 0;

  constructor(device: any, canvasFormat: string) {
    this.device = device;
    this.enabled = rawGpuParticlesEnabled();
    this.uniformBuffer = device.createBuffer({
      label: "hp.raw.gpu-particles.uniform",
      size: PARTICLE_UNIFORM_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.UNIFORM | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.emitterBuffer = device.createBuffer({
      label: "hp.raw.gpu-particles.emitters",
      size: VFX_EMITTER_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.STORAGE | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });

    const initialParticles = new Float32Array(MAX_GPU_PARTICLES * PARTICLE_FLOATS);
    for (let index = 0; index < MAX_GPU_PARTICLES; index += 1) {
      initialParticles[index * PARTICLE_FLOATS + 3] = 0;
      initialParticles[index * PARTICLE_FLOATS + 7] = index * 12.9898;
      initialParticles[index * PARTICLE_FLOATS + 11] = 0.018;
    }

    for (let index = 0; index < 2; index += 1) {
      const buffer = device.createBuffer({
        label: `hp.raw.gpu-particles.buffer-${index}`,
        size: MAX_GPU_PARTICLES * PARTICLE_BYTES,
        usage:
          this.gpuGlobals.GPUBufferUsage.STORAGE |
          this.gpuGlobals.GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(buffer, 0, initialParticles);
      this.particleBuffers.push(buffer);
    }

    const shaderModule = device.createShaderModule({
      label: "hp.raw.gpu-particles-shader",
      code: gpuParticleShader,
    });

    const computeLayout = device.createBindGroupLayout({
      label: "hp.raw.gpu-particles.compute-layout",
      entries: [
        { binding: 0, visibility: this.gpuGlobals.GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: this.gpuGlobals.GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: this.gpuGlobals.GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: this.gpuGlobals.GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      ],
    });
    const renderLayout = device.createBindGroupLayout({
      label: "hp.raw.gpu-particles.render-layout",
      entries: [
        { binding: 0, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
        { binding: 1, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      ],
    });

    this.computeBindGroups.push(
      this.createComputeBindGroup(computeLayout, this.particleBuffers[0], this.particleBuffers[1]),
      this.createComputeBindGroup(computeLayout, this.particleBuffers[1], this.particleBuffers[0]),
    );
    this.renderBindGroups.push(
      this.createRenderBindGroup(renderLayout, this.particleBuffers[0]),
      this.createRenderBindGroup(renderLayout, this.particleBuffers[1]),
    );

    this.computePipeline = device.createComputePipeline({
      label: "hp.raw.gpu-particles.compute",
      layout: device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
      compute: { module: shaderModule, entryPoint: "cs_particles" },
    });

    const emptyRenderLayout = device.createBindGroupLayout({
      label: "hp.raw.gpu-particles.empty-render-layout",
      entries: [],
    });
    this.emptyRenderBindGroup = device.createBindGroup({
      label: "hp.raw.gpu-particles.empty-render-bind-group",
      layout: emptyRenderLayout,
      entries: [],
    });
    const renderPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [emptyRenderLayout, renderLayout] });
    this.renderPipelineCanvas = this.createRenderPipeline(shaderModule, renderPipelineLayout, canvasFormat, "hp.raw.gpu-particles.render-canvas");
    this.renderPipelineOffscreen = this.createRenderPipeline(
      shaderModule,
      renderPipelineLayout,
      OFFSCREEN_COLOR_FORMAT,
      "hp.raw.gpu-particles.render-offscreen",
    );

    this.softRenderLayout = device.createBindGroupLayout({
      label: "hp.raw.gpu-particles.soft-render-layout",
      entries: [
        { binding: 0, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
        { binding: 1, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: this.gpuGlobals.GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
      ],
    });
    const softPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [emptyRenderLayout, this.softRenderLayout] });
    this.softRenderPipelineCanvas = this.createRenderPipeline(
      shaderModule,
      softPipelineLayout,
      canvasFormat,
      "hp.raw.gpu-particles.soft-render-canvas",
      "fs_particles_soft",
    );
    this.softRenderPipelineOffscreen = this.createRenderPipeline(
      shaderModule,
      softPipelineLayout,
      OFFSCREEN_COLOR_FORMAT,
      "hp.raw.gpu-particles.soft-render-offscreen",
      "fs_particles_soft",
    );
  }

  update(camera: PerspectiveCamera, world: GameWorld, viewProjectionElements: ArrayLike<number>) {
    if (!this.enabled) return;
    this.activeCount = Math.min(MAX_GPU_PARTICLES, rawGpuParticleCount(world.renderPerformance.quality.tier));
    if (this.activeCount <= 0) return;

    const matrixWorld = camera.matrixWorld.elements;
    const deltaSeconds = clamp((world.frameTimeMs || 16.6) / 1000, 0.001, 0.05);
    const levelElapsed = Number((world.session as { levelElapsed?: number }).levelElapsed);
    const timeSeconds = Number.isFinite(levelElapsed) ? levelElapsed : world.frameIndex / 60;
    const strength = particleStrengthForTier(world.renderPerformance.quality.tier);

    this.uniformFloats.set(viewProjectionElements, 0);
    this.emitterCount = this.writeVfxEmitters(world, vfxEmitterBudgetForTier(world.renderPerformance.quality.tier));

    this.uniformFloats.set([camera.position.x, camera.position.y, camera.position.z, this.emitterCount], 16);
    this.uniformFloats.set([matrixWorld[0], matrixWorld[1], matrixWorld[2], 0], 20);
    this.uniformFloats.set([matrixWorld[4], matrixWorld[5], matrixWorld[6], 0], 24);
    this.uniformFloats.set([timeSeconds, deltaSeconds, this.activeCount, strength], 28);
    this.uniformFloats.set([12.5, 0.34, 2.9, particleSizeScaleForTier(world.renderPerformance.quality.tier)], 32);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformFloats);
    this.device.queue.writeBuffer(this.emitterBuffer, 0, this.emitterFloats);
  }

  // True only when encodeCompute will actually begin a pass this frame, so the
  // caller arms a GPU-profiler timestamp slot only when it will be written.
  get activeThisFrame() {
    return this.enabled && this.activeCount > 0;
  }

  encodeCompute(
    encoder: any,
    timestampWrites?: { querySet: any; beginningOfPassWriteIndex: number; endOfPassWriteIndex: number },
  ) {
    if (!this.enabled || this.activeCount <= 0) return;
    const computePass = encoder.beginComputePass({ label: "hp.raw.gpu-particles.compute-pass", timestampWrites });
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroups[this.readIndex]);
    computePass.dispatchWorkgroups(Math.ceil(this.activeCount / PARTICLE_WORKGROUP_SIZE));
    computePass.end();
    this.readIndex = 1 - this.readIndex;
  }

  encodeRender(renderPass: any, postProcessEnabled: boolean, sceneDepthView?: any) {
    if (!this.enabled || this.activeCount <= 0) return;
    if (sceneDepthView) {
      // Depth-aware path (rawSoftParticles): soft pipeline samples scene depth.
      renderPass.setPipeline(postProcessEnabled ? this.softRenderPipelineOffscreen : this.softRenderPipelineCanvas);
      renderPass.setBindGroup(0, this.emptyRenderBindGroup);
      renderPass.setBindGroup(1, this.softRenderBindGroupFor(sceneDepthView, this.readIndex));
      renderPass.draw(6, this.activeCount, 0, 0);
      return;
    }
    renderPass.setPipeline(postProcessEnabled ? this.renderPipelineOffscreen : this.renderPipelineCanvas);
    renderPass.setBindGroup(0, this.emptyRenderBindGroup);
    renderPass.setBindGroup(1, this.renderBindGroups[this.readIndex]);
    renderPass.draw(6, this.activeCount, 0, 0);
  }

  private softRenderBindGroupFor(sceneDepthView: any, readIndex: number) {
    // The depth view is recreated on resize, so rebuild both soft bind groups
    // whenever it changes (keeps them paired with particleBuffers[0]/[1]).
    if (this.softDepthView !== sceneDepthView || this.softRenderBindGroups.length === 0) {
      this.softDepthView = sceneDepthView;
      this.softRenderBindGroups.length = 0;
      this.softRenderBindGroups.push(
        this.createSoftRenderBindGroup(this.particleBuffers[0], sceneDepthView),
        this.createSoftRenderBindGroup(this.particleBuffers[1], sceneDepthView),
      );
    }
    return this.softRenderBindGroups[readIndex];
  }

  private createSoftRenderBindGroup(particleBuffer: any, sceneDepthView: any) {
    return this.device.createBindGroup({
      label: "hp.raw.gpu-particles.soft-render-bind-group",
      layout: this.softRenderLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: particleBuffer } },
        { binding: 2, resource: { buffer: this.emitterBuffer } },
        { binding: 3, resource: sceneDepthView },
      ],
    });
  }

  dispose() {
    this.uniformBuffer?.destroy?.();
    this.emitterBuffer?.destroy?.();
    for (const buffer of this.particleBuffers) buffer?.destroy?.();
  }

  private createComputeBindGroup(layout: any, sourceBuffer: any, destinationBuffer: any) {
    return this.device.createBindGroup({
      label: "hp.raw.gpu-particles.compute-bind-group",
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: sourceBuffer } },
        { binding: 2, resource: { buffer: destinationBuffer } },
        { binding: 3, resource: { buffer: this.emitterBuffer } },
      ],
    });
  }

  private writeVfxEmitters(world: GameWorld, budget: number) {
    this.emitterFloats.fill(0);
    // Budget is tier-scaled; clamp to the fixed buffer capacity so a future
    // tier table change can never overrun emitterFloats / emitterBuffer.
    const cap = Math.max(0, Math.min(budget, MAX_VFX_EMITTERS));
    let count = 0;
    const playerX = world.player.position.x;
    const playerZ = world.player.position.z;
    const deployedUltimate = world.session.deployedUltimate;
    if (deployedUltimate && deployedUltimate.phase !== "held" && deployedUltimate.age >= 0 && count < cap) {
      const [x, y, z] = deployedUltimate.position;
      const dx = x - playerX;
      const dz = z - playerZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq <= 49) {
        const pulse = 0.5 + Math.sin(deployedUltimate.age * 6.8 + deployedUltimate.id * 0.11) * 0.5;
        this.writeEmitter(count, x, y + 0.42, z, 5, 0, 0.4, 0, deployedUltimate.age, 0.48, 0.98, 1, 0.18 + pulse * 0.28);
        count += 1;
      }
    }
    for (const pickup of world.pickups) {
      if (count >= cap) break;
      if (pickup.collected || (pickup.type !== "coreCell" && pickup.type !== "repairKit")) continue;
      const dx = pickup.position.x - playerX;
      const dz = pickup.position.z - playerZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > 36) continue;
      const closeness = 1 - Math.sqrt(distanceSq) / 6;
      if (pickup.type === "coreCell") {
        this.writeEmitter(count, pickup.position.x, pickup.position.y + 0.64, pickup.position.z, 5, 0, 0.42, 0, world.frameIndex * 0.017 + count, 0.46, 0.9, 1, 0.16 + closeness * 0.22);
      } else {
        this.writeEmitter(count, pickup.position.x, pickup.position.y + 0.2, pickup.position.z, 5, 0, 0.26, 0, world.frameIndex * 0.017 + count, 1, 0.76, 0.64, 0.08 + closeness * 0.1);
      }
      count += 1;
    }

    for (const enemy of world.enemies) {
      if (count >= cap) break;
      if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
      if (enemy.isAlive && enemy.damageFlash < 0.18 && enemy.hitReact < 0.08) continue;
      const deathLife = enemy.isAlive ? 0 : Math.max(0, 1 - enemy.deathAge / 0.78);
      const hitLife = Math.max(enemy.damageFlash, enemy.hitReact);
      const power = enemy.isAlive ? hitLife * 0.72 : deathLife * (enemy.tier === "boss" || enemy.tier === "leader" ? 1.35 : 0.95);
      if (power <= 0.05) continue;
      const type = enemy.isAlive ? 2 : 3;
      this.writeEmitter(count, enemy.position.x, enemy.position.y + 0.74 * enemy.visualScaleMultiplier, enemy.position.z, type, enemy.lastHitDirection.x, 0.26, enemy.lastHitDirection.z, enemy.spawnAge + enemy.deathAge, 0.58, 0.94, 1, power);
      count += 1;
    }

    return count;
  }

  private writeEmitter(
    index: number,
    x: number,
    y: number,
    z: number,
    type: number,
    dx: number,
    dy: number,
    dz: number,
    age: number,
    r: number,
    g: number,
    b: number,
    power: number,
  ) {
    const offset = index * VFX_EMITTER_FLOATS;
    this.emitterFloats.set([x, y, z, type, dx, dy, dz, age, r, g, b, clamp(power, 0, 2.5)], offset);
  }

  private createRenderBindGroup(layout: any, particleBuffer: any) {
    return this.device.createBindGroup({
      label: "hp.raw.gpu-particles.render-bind-group",
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: particleBuffer } },
        { binding: 2, resource: { buffer: this.emitterBuffer } },
      ],
    });
  }

  private createRenderPipeline(shaderModule: any, layout: any, format: string, label: string, fragmentEntryPoint = "fs_particles") {
    return this.device.createRenderPipeline({
      label,
      layout,
      vertex: { module: shaderModule, entryPoint: "vs_particles" },
      fragment: {
        module: shaderModule,
        entryPoint: fragmentEntryPoint,
        targets: [
          {
            format,
            blend: {
              color: {
                operation: "add",
                srcFactor: "one",
                dstFactor: "one",
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
      primitive: { topology: "triangle-list" },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: DEPTH_FORMAT,
      },
    });
  }

}

function particleStrengthForTier(tier: RenderQualityTier) {
  if (tier === "rescue") return 0.54;
  if (tier === "balanced") return 0.76;
  return 0.92;
}

function particleSizeScaleForTier(tier: RenderQualityTier) {
  // Shrunk ~0.6x so the dust reads as fine atmosphere, not visible specks.
  if (tier === "rescue") return 0.46;
  if (tier === "balanced") return 0.55;
  return 0.6;
}

// Cap the number of active VFX emission sources per quality tier. "high" keeps
// the full fixed pool (identical to the previous hard-coded behaviour); lower
// tiers spend less GPU on the particle compute's emitter sampling on phones.
function vfxEmitterBudgetForTier(tier: RenderQualityTier) {
  if (tier === "rescue") return 28;
  if (tier === "balanced") return 48;
  return MAX_VFX_EMITTERS;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
