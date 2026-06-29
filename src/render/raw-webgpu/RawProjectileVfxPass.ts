import type { PerspectiveCamera } from "three";
import type { GameWorld } from "../../game/core/GameWorld";
import { DEPTH_FORMAT, OFFSCREEN_COLOR_FORMAT } from "./RawWebGpuConstants";
import { rawGpuParticlesEnabled } from "./RawWebGpuQuality";
import type { GpuGlobals } from "./RawWebGpuTypes";
import projectileVfxShader from "./shaders/projectileVfx.wgsl?raw";

const VFX_UNIFORM_FLOATS = 32;
const VFX_UNIFORM_BYTES = VFX_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const RECORD_FLOATS = 16;
const RECORD_BYTES = RECORD_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const MAX_PROJECTILE_RECORDS = 128;
const MAX_EFFECT_RECORDS = 128;
const PROJECTILE_VERTICES = 6;
const EFFECT_VERTICES = 60;

type ProjectileWeaponId = GameWorld["projectiles"][number]["weaponId"];
type WorldEffect = GameWorld["effects"][number];

export class RawProjectileVfxPass {
  readonly enabled: boolean;
  private readonly device: any;
  private readonly gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  private readonly uniformBuffer: any;
  private readonly projectileBuffer: any;
  private readonly effectBuffer: any;
  private readonly bindGroup: any;
  private readonly projectilePipelineCanvas: any;
  private readonly projectilePipelineOffscreen: any;
  private readonly effectPipelineCanvas: any;
  private readonly effectPipelineOffscreen: any;
  // Depth-aware variants (rawSoftParticles): same vertex shaders, *_soft
  // fragments + a scene-depth texture binding. Bind group rebuilt lazily when the
  // depth view changes (resize).
  private readonly softBindGroupLayout: any;
  private readonly softProjectilePipelineCanvas: any;
  private readonly softProjectilePipelineOffscreen: any;
  private readonly softEffectPipelineCanvas: any;
  private readonly softEffectPipelineOffscreen: any;
  private softBindGroup: any = null;
  private softDepthView: any = null;
  private readonly uniformFloats = new Float32Array(VFX_UNIFORM_FLOATS);
  private readonly projectileFloats = new Float32Array(MAX_PROJECTILE_RECORDS * RECORD_FLOATS);
  private readonly effectFloats = new Float32Array(MAX_EFFECT_RECORDS * RECORD_FLOATS);
  private projectileCount = 0;
  private effectCount = 0;

  constructor(device: any, canvasFormat: string) {
    this.device = device;
    this.enabled = rawGpuParticlesEnabled();
    this.uniformBuffer = device.createBuffer({
      label: "hp.raw.projectile-vfx.uniform",
      size: VFX_UNIFORM_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.UNIFORM | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.projectileBuffer = device.createBuffer({
      label: "hp.raw.projectile-vfx.projectiles",
      size: MAX_PROJECTILE_RECORDS * RECORD_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.STORAGE | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });
    this.effectBuffer = device.createBuffer({
      label: "hp.raw.projectile-vfx.effects",
      size: MAX_EFFECT_RECORDS * RECORD_BYTES,
      usage: this.gpuGlobals.GPUBufferUsage.STORAGE | this.gpuGlobals.GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: "hp.raw.projectile-vfx.shader",
      code: projectileVfxShader,
    });
    const bindGroupLayout = device.createBindGroupLayout({
      label: "hp.raw.projectile-vfx.bind-group-layout",
      entries: [
        { binding: 0, visibility: this.gpuGlobals.GPUShaderStage.VERTEX | this.gpuGlobals.GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
    this.bindGroup = device.createBindGroup({
      label: "hp.raw.projectile-vfx.bind-group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.projectileBuffer } },
        { binding: 2, resource: { buffer: this.effectBuffer } },
      ],
    });
    this.projectilePipelineCanvas = this.createPipeline(shaderModule, pipelineLayout, canvasFormat, "vs_projectile_vfx", "fs_projectile_vfx", "hp.raw.projectile-vfx.projectile-canvas");
    this.projectilePipelineOffscreen = this.createPipeline(
      shaderModule,
      pipelineLayout,
      OFFSCREEN_COLOR_FORMAT,
      "vs_projectile_vfx",
      "fs_projectile_vfx",
      "hp.raw.projectile-vfx.projectile-offscreen",
    );
    this.effectPipelineCanvas = this.createPipeline(shaderModule, pipelineLayout, canvasFormat, "vs_effect_vfx", "fs_effect_vfx", "hp.raw.projectile-vfx.effect-canvas");
    this.effectPipelineOffscreen = this.createPipeline(
      shaderModule,
      pipelineLayout,
      OFFSCREEN_COLOR_FORMAT,
      "vs_effect_vfx",
      "fs_effect_vfx",
      "hp.raw.projectile-vfx.effect-offscreen",
    );

    this.softBindGroupLayout = device.createBindGroupLayout({
      label: "hp.raw.projectile-vfx.soft-bind-group-layout",
      entries: [
        { binding: 0, visibility: this.gpuGlobals.GPUShaderStage.VERTEX | this.gpuGlobals.GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: this.gpuGlobals.GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: this.gpuGlobals.GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
      ],
    });
    const softPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.softBindGroupLayout] });
    this.softProjectilePipelineCanvas = this.createPipeline(shaderModule, softPipelineLayout, canvasFormat, "vs_projectile_vfx", "fs_projectile_vfx_soft", "hp.raw.projectile-vfx.soft-projectile-canvas");
    this.softProjectilePipelineOffscreen = this.createPipeline(shaderModule, softPipelineLayout, OFFSCREEN_COLOR_FORMAT, "vs_projectile_vfx", "fs_projectile_vfx_soft", "hp.raw.projectile-vfx.soft-projectile-offscreen");
    this.softEffectPipelineCanvas = this.createPipeline(shaderModule, softPipelineLayout, canvasFormat, "vs_effect_vfx", "fs_effect_vfx_soft", "hp.raw.projectile-vfx.soft-effect-canvas");
    this.softEffectPipelineOffscreen = this.createPipeline(shaderModule, softPipelineLayout, OFFSCREEN_COLOR_FORMAT, "vs_effect_vfx", "fs_effect_vfx_soft", "hp.raw.projectile-vfx.soft-effect-offscreen");
  }

  // True when there is projectile/effect content to draw this frame, so the
  // depth-aware particle pass is only begun when something will render.
  get hasContent() {
    return this.enabled && (this.projectileCount > 0 || this.effectCount > 0);
  }

  update(camera: PerspectiveCamera, world: GameWorld, viewProjectionElements: ArrayLike<number>) {
    if (!this.enabled) return;
    this.projectileFloats.fill(0);
    this.effectFloats.fill(0);
    this.projectileCount = this.writeProjectileRecords(world);
    this.effectCount = this.writeEffectRecords(world);

    const matrixWorld = camera.matrixWorld.elements;
    const levelElapsed = Number((world.session as { levelElapsed?: number }).levelElapsed);
    const timeSeconds = Number.isFinite(levelElapsed) ? levelElapsed : world.frameIndex / 60;
    this.uniformFloats.set(viewProjectionElements, 0);
    this.uniformFloats.set([camera.position.x, camera.position.y, camera.position.z, this.projectileCount], 16);
    this.uniformFloats.set([matrixWorld[0], matrixWorld[1], matrixWorld[2], this.effectCount], 20);
    this.uniformFloats.set([matrixWorld[4], matrixWorld[5], matrixWorld[6], 0], 24);
    this.uniformFloats.set([timeSeconds, rawProjectileVfxStrength(world), 0, 0], 28);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformFloats);
    this.device.queue.writeBuffer(this.projectileBuffer, 0, this.projectileFloats);
    this.device.queue.writeBuffer(this.effectBuffer, 0, this.effectFloats);
  }

  encode(renderPass: any, postProcessEnabled: boolean, sceneDepthView?: any) {
    if (!this.enabled) return;
    const useSoft = Boolean(sceneDepthView);
    const bindGroup = useSoft ? this.softBindGroupFor(sceneDepthView) : this.bindGroup;
    if (this.projectileCount > 0) {
      renderPass.setPipeline(
        useSoft
          ? (postProcessEnabled ? this.softProjectilePipelineOffscreen : this.softProjectilePipelineCanvas)
          : (postProcessEnabled ? this.projectilePipelineOffscreen : this.projectilePipelineCanvas),
      );
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(PROJECTILE_VERTICES, this.projectileCount, 0, 0);
    }
    if (this.effectCount > 0) {
      renderPass.setPipeline(
        useSoft
          ? (postProcessEnabled ? this.softEffectPipelineOffscreen : this.softEffectPipelineCanvas)
          : (postProcessEnabled ? this.effectPipelineOffscreen : this.effectPipelineCanvas),
      );
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(EFFECT_VERTICES, this.effectCount, 0, 0);
    }
  }

  private softBindGroupFor(sceneDepthView: any) {
    // The depth view is recreated on resize; rebuild the bind group when it changes.
    if (this.softDepthView !== sceneDepthView || !this.softBindGroup) {
      this.softDepthView = sceneDepthView;
      this.softBindGroup = this.device.createBindGroup({
        label: "hp.raw.projectile-vfx.soft-bind-group",
        layout: this.softBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: { buffer: this.projectileBuffer } },
          { binding: 2, resource: { buffer: this.effectBuffer } },
          { binding: 3, resource: sceneDepthView },
        ],
      });
    }
    return this.softBindGroup;
  }

  dispose() {
    this.uniformBuffer?.destroy?.();
    this.projectileBuffer?.destroy?.();
    this.effectBuffer?.destroy?.();
  }

  private writeProjectileRecords(world: GameWorld) {
    const projectileLimit = Math.min(world.projectiles.length, world.renderPerformance.quality.projectilePoolSize, MAX_PROJECTILE_RECORDS);
    for (let index = 0; index < projectileLimit; index += 1) {
      const projectile = world.projectiles[index];
      const [r, g, b] = colorForWeapon(projectile.weaponId);
      this.writeRecord(
        this.projectileFloats,
        index,
        projectile.position.x,
        projectile.position.y,
        projectile.position.z,
        weaponTypeValue(projectile.weaponId),
        projectile.direction.x,
        projectile.direction.y,
        projectile.direction.z,
        projectile.age,
        r,
        g,
        b,
        weaponPower(projectile.weaponId),
        projectile.radius,
        projectile.lifetime,
        world.frameIndex + index * 0.37,
      );
    }
    return projectileLimit;
  }

  private writeEffectRecords(world: GameWorld) {
    let count = 0;
    const effectLimit = Math.min(world.effects.length, world.renderPerformance.quality.effectPoolSize);
    for (let index = 0; index < effectLimit && count < MAX_EFFECT_RECORDS; index += 1) {
      const effect = world.effects[index];
      const life = 1 - effect.age / Math.max(0.001, effect.lifetime);
      if (life <= 0) continue;
      const [r, g, b] = colorForEffect(effect);
      this.writeRecord(
        this.effectFloats,
        count,
        effect.position.x,
        effect.position.y,
        effect.position.z,
        effectTypeValue(effect.type),
        effect.direction.x,
        effect.direction.y,
        effect.direction.z,
        effect.age,
        r,
        g,
        b,
        effect.intensity * Math.max(0.16, life),
        0.06,
        effect.lifetime,
        effect.id,
      );
      count += 1;
    }
    return count;
  }

  private writeRecord(
    target: Float32Array,
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
    radius: number,
    lifetime: number,
    seed: number,
  ) {
    const offset = index * RECORD_FLOATS;
    target.set([x, y, z, type, dx, dy, dz, age, r, g, b, clamp(power, 0, 4), radius, lifetime, seed, 0], offset);
  }

  private createPipeline(shaderModule: any, layout: any, format: string, vertexEntryPoint: string, fragmentEntryPoint: string, label: string) {
    return this.device.createRenderPipeline({
      label,
      layout,
      vertex: { module: shaderModule, entryPoint: vertexEntryPoint },
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

function rawProjectileVfxStrength(world: GameWorld) {
  const tier = world.renderPerformance.quality.tier;
  if (tier === "rescue") return 0.52;
  if (tier === "balanced") return 0.68;
  return 0.76;
}

function weaponTypeValue(weaponId: ProjectileWeaponId) {
  if (weaponId === "railLance") return 2;
  if (weaponId === "flakBurst") return 3;
  return 1;
}

function weaponPower(weaponId: ProjectileWeaponId) {
  if (weaponId === "railLance") return 0.90;
  if (weaponId === "flakBurst") return 1.00;
  return 0.74;
}

function colorForWeapon(weaponId: ProjectileWeaponId): [number, number, number] {
  if (weaponId === "railLance") return [0.82, 0.72, 0.48];
  if (weaponId === "flakBurst") return [0.78, 0.40, 0.25];
  return [0.38, 0.68, 0.76];
}

function effectTypeValue(type: WorldEffect["type"]) {
  if (type === "muzzleFlash") return 1;
  if (type === "hitSpark") return 2;
  if (type === "armorSpark") return 2.35;
  if (type === "coreSpark") return 2.45;
  if (type === "dashBurst") return 3;
  if (type === "breachTrail") return 3.15;
  if (type === "staggerBurst") return 3.4;
  if (type === "breachPierce") return 4.05;
  if (type === "breachShock") return 4.25;
  if (type === "dangerTelegraph") return 6;
  if (type === "shockwave") return 5;
  return 4;
}

function colorForEffect(effect: WorldEffect): [number, number, number] {
  if (effect.type === "muzzleFlash") return [0.78, 0.62, 0.38];
  if (effect.type === "armorSpark") return [1.0, 0.78, 0.36];
  if (effect.type === "coreSpark") return [0.70, 0.98, 1.0];
  if (effect.type === "dashBurst") return [0.48, 0.76, 0.82];
  if (effect.type === "breachTrail") return [0.34, 0.98, 1.0];
  if (effect.type === "breachPierce") return [0.90, 1.0, 0.94];
  if (effect.type === "breachShock") return [0.46, 0.94, 1.0];
  if (effect.type === "staggerBurst") return [1.0, 0.82, 0.26];
  if (effect.type === "dangerTelegraph") return [1.0, 0.16, 0.08];
  if (effect.type === "shockwave") return [0.42, 0.92, 1.0];
  if (effect.type === "bladeSlash") return [0.82, 0.62, 0.34];
  return [0.82, 0.46, 0.24];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
