import { Euler, Matrix4, Quaternion, Vector3, type PerspectiveCamera } from "three";
import type { GameWorld } from "../../game/core/GameWorld";
import { exitButtonTouchProgress } from "../../game/core/ExitCinematicTiming";
import { CUBE_VERTEX_COUNT, FLOATS_PER_INSTANCE } from "./RawWebGpuConstants";
import { isPickupWrapFaceNode } from "./pickupNodeVisibility";
import {
  isRawViewmodelProceduralModelKey,
  RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS,
  RAW_VIEWMODEL_ULTIMATE_HAND_GRIP_BY_ABILITY,
  RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS,
  type RawViewmodelAssetSource,
} from "./RawViewmodelMode";
import {
  RAW_VIEWMODEL_PROFILES,
  rawViewmodelProfileFor,
  type RawViewmodelPose,
  type RawViewmodelWeaponProfile,
} from "./RawViewmodelProfiles";
import type { RawDrawBatch, RawPlanGeometryAsset, Tuple3, Tuple4 } from "./RawWebGpuTypes";

// Pose constants stay importable from the pass for existing tuning workflows.
export {
  RAW_VIEWMODEL_HAND_POSE_ROD,
  RAW_VIEWMODEL_HAND_POSE_SIDEARM,
  RAW_VIEWMODEL_POSE_ROD,
  RAW_VIEWMODEL_POSE_SIDEARM,
  type RawViewmodelPose as RawViewmodelWeaponPose,
} from "./RawViewmodelProfiles";

/**
 * Native Raw WebGPU first-person weapon pass.
 *
 * Renders the cooked battleworn weapon viewmodels plus their baked hand
 * models in camera space: instance model matrices are composed as
 * cameraWorld × cameraLocalPose, and the renderer encodes the draw in a
 * depth-cleared pass so world geometry can never clip the weapon.
 *
 * Per-weapon configuration (model keys, poses, muzzle anchor, articulation
 * rules, fallbacks) lives in RawViewmodelProfiles; this pass owns timing,
 * motion curves, and instance/batch emission. Hands follow the same sway/
 * switch/recoil offsets as the weapon so the grip stays visually attached.
 */

/** Idle/walk sway+bob tuning (camera-space meters / radians). */
export const RAW_VIEWMODEL_SWAY = {
  bobAmplitude: 0.012,
  bobFrequency: 0.0062,
  swayAmplitude: 0.008,
  swayFrequencyScale: 0.62,
  idleFloor: 0.25,
};

/** Fire/recoil/switch timing+magnitude tuning. */
export const RAW_VIEWMODEL_RECOIL = {
  rodSwingSeconds: 0.55,
  sidearmKickSeconds: 0.4,
  switchRaiseSeconds: 0.34,
  switchRaiseDrop: 0.34,
  kickBack: 0.24,
  kickLift: 0.05,
  kickPitch: 0.2,
  recoilBack: 0.1,
  reloadDip: 0.1,
  reloadPitch: 0.4,
};

/** Muzzle flash card (camera space fallback position, sidearm only). */
export const RAW_VIEWMODEL_MUZZLE_FLASH = {
  position: [0.28, -0.3, -1.62] as Tuple3,
  baseSize: 0.05,
  growth: 0.11,
  durationSeconds: 0.12,
  color: [1, 0.86, 0.5, 0.95] as Tuple4,
};

export const RAW_VIEWMODEL_ULTIMATE_DEPLOY = {
  durationSeconds: 0.28,
  startPosition: [0.14, -0.28, -0.58] as Tuple3,
  endPosition: [0.34, -0.4, -0.86] as Tuple3,
  startRotation: [-0.62, 0.32, -0.12] as Tuple3,
  endRotation: [-0.9, 0.5, 0.24] as Tuple3,
  startScale: 0.5,
  endScale: 0.42,
  tint: [0.72, 0.96, 1.0, 0.08] as Tuple4,
};

/** Node-chunk articulation: model-space travel per animated group. */
export const RAW_VIEWMODEL_ARTICULATION = {
  /** Sidearm slide rearward travel in model units at full kick. */
  slideTravel: 0.24,
  /** Slide return sharpness: kick fraction where the slide is fully back. */
  slidePeak: 0.12,
  /** Rod impact head compression along -Y model units at full impact. */
  rodImpactCompress: 0.06,
};

interface RawViewmodelDrawRange {
  vertexOffset: number;
  vertexCount: number;
}

interface RawViewmodelArticulation {
  /** Merged contiguous ranges that never articulate. */
  staticRanges: RawViewmodelDrawRange[];
  /** Merged ranges for the animated group (slide / impact head). */
  animatedRanges: RawViewmodelDrawRange[];
  animatedKind: "slide" | "impact";
}

/** Camera-space motion offsets shared by the weapon and its hand. */
interface RawViewmodelMotion {
  px: number;
  py: number;
  pz: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface RawViewmodelFrame {
  instanceCount: number;
  batches: RawDrawBatch[];
}

export interface RawViewmodelReadiness {
  ready: boolean;
  assetSource: RawViewmodelAssetSource;
  /** Weapon ids whose weapon geometry resolved. */
  weapons: string[];
  /** Weapon ids whose weapon geometry carries usable articulation chunks. */
  articulatedWeapons: string[];
  /** Weapon ids whose baked hand geometry also resolved. */
  hands: string[];
  /** Player-facing fallback notes for weapons rendering without hands. */
  handFallbacks: string[];
}

export class RawViewmodelPass {
  private readonly assets = new Map<string, RawPlanGeometryAsset>();
  private readonly handAssets = new Map<string, RawPlanGeometryAsset>();
  private readonly ultimateAssets = new Map<string, RawPlanGeometryAsset>();
  private readonly articulations = new Map<string, RawViewmodelArticulation>();
  private readonly modelMatrix = new Matrix4();
  private readonly localMatrix = new Matrix4();
  private readonly handLocalMatrix = new Matrix4();
  private readonly handModelMatrix = new Matrix4();
  private readonly proxyRootMatrix = new Matrix4();
  private readonly proxyPartMatrix = new Matrix4();
  private readonly proxyModelMatrix = new Matrix4();
  private readonly centerOffsetMatrix = new Matrix4();
  private readonly scaleMatrix = new Matrix4();
  private readonly poseMatrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly euler = new Euler();
  private readonly unitScale = new Vector3(1, 1, 1);
  private readonly deltaMatrix = new Matrix4();
  private readonly animatedLocalMatrix = new Matrix4();
  private readonly animatedModelMatrix = new Matrix4();
  private readonly muzzlePoint = new Vector3();
  private readonly scratchScale = new Vector3();
  private readonly ultimateHandAssets = new Map<string, RawPlanGeometryAsset>();
  private lastFireSequence = -1;
  private lastWeaponSwitchSequence = -1;
  private swingAge = 99;
  private kickAge = 99;
  private switchAge = 99;
  private lastUpdateMs = 0;

  /**
   * Resolves weapon + hand geometry per profile. Readiness distinguishes
   * weapon-ready, articulated, and hand-ready weapons; a missing hand never
   * blocks the weapon (weapon-only fallback, reported honestly).
   */
  configure(geometryAssets: ReadonlyMap<string, RawPlanGeometryAsset>): RawViewmodelReadiness {
    this.assets.clear();
    this.handAssets.clear();
    this.articulations.clear();
    this.ultimateAssets.clear();
    this.ultimateHandAssets.clear();
    const weapons: string[] = [];
    const articulatedWeapons: string[] = [];
    const hands: string[] = [];
    const handFallbacks: string[] = [];
    for (const profile of Object.values(RAW_VIEWMODEL_PROFILES)) {
      const asset = geometryAssets.get(profile.weaponModelKey);
      if (!isRenderableAsset(asset)) continue;
      this.assets.set(profile.weaponId, asset);
      weapons.push(profile.weaponId);
      const articulation = buildArticulation(profile, asset);
      if (articulation) {
        this.articulations.set(profile.weaponId, articulation);
        articulatedWeapons.push(profile.weaponId);
      }
      const handAsset = geometryAssets.get(profile.handModelKey);
      if (isRenderableAsset(handAsset)) {
        this.handAssets.set(profile.weaponId, handAsset);
        hands.push(profile.weaponId);
      } else {
        handFallbacks.push(profile.handFallbackLabel);
      }
    }
    for (const [abilityId, modelKey] of Object.entries(RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS)) {
      const ultimateAsset = geometryAssets.get(modelKey);
      if (isRenderableAsset(ultimateAsset)) this.ultimateAssets.set(abilityId, ultimateAsset);
    }
    for (const grip of new Set(Object.values(RAW_VIEWMODEL_ULTIMATE_HAND_GRIP_BY_ABILITY))) {
      const handAsset = geometryAssets.get(RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS[grip]);
      if (isRenderableAsset(handAsset)) this.ultimateHandAssets.set(grip, handAsset);
    }
    return {
      ready: this.assets.size > 0,
      assetSource: this.assets.size > 0 ? "cooked-plan" : "none",
      weapons,
      articulatedWeapons,
      hands,
      handFallbacks,
    };
  }

  /**
   * Writes the weapon, its hand, and the muzzle flash after the world
   * instances and uploads just that region. Returns the draw batches for the
   * depth-cleared viewmodel pass.
   */
  writeInstances(
    world: GameWorld,
    camera: PerspectiveCamera,
    instanceFloats: Float32Array,
    startIndex: number,
    maxInstances: number,
    device: { queue: { writeBuffer: (buffer: unknown, offset: number, data: Float32Array, srcOffset: number, size: number) => void } },
    instanceBuffer: unknown,
  ): RawViewmodelFrame {
    const empty: RawViewmodelFrame = { instanceCount: 0, batches: [] };
    const nowMs = performance.now();
    const deltaSeconds = this.lastUpdateMs > 0 ? Math.min(0.08, Math.max(0.001, (nowMs - this.lastUpdateMs) / 1000)) : 0.016;
    this.lastUpdateMs = nowMs;
    this.advanceTimers(world, deltaSeconds);

    const batches: RawDrawBatch[] = [];
    let index = startIndex;
    if (world.session.mode === "exitCinematic") {
      index = this.writeExitButtonPressHand(world, camera, instanceFloats, index, maxInstances, batches);
      const count = index - startIndex;
      if (count > 0) {
        device.queue.writeBuffer(
          instanceBuffer,
          startIndex * FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
          instanceFloats,
          startIndex * FLOATS_PER_INSTANCE,
          count * FLOATS_PER_INSTANCE,
        );
      }
      return { instanceCount: count, batches };
    }

    if (world.session.mode !== "playing") return empty;
    // A 3D focus reveal (route switch / puzzle door) hands the camera to a
    // facility view away from the player; hide the first-person weapon so the
    // glide is cinematic instead of dragging a glued-on viewmodel. Mode stays
    // "playing" during the reveal, so this is the gate that suppresses it.
    if (world.session.activeFocusReveal) return empty;

    if (world.session.activeHandInteraction) {
      index = this.writeHandInteractionPressHand(world, camera, instanceFloats, index, maxInstances, batches);
      const count = index - startIndex;
      if (count > 0) {
        device.queue.writeBuffer(
          instanceBuffer,
          startIndex * FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
          instanceFloats,
          startIndex * FLOATS_PER_INSTANCE,
          count * FLOATS_PER_INSTANCE,
        );
      }
      return { instanceCount: count, batches };
    }

    if (world.session.deployedUltimate && (world.session.deployedUltimate.phase === "held" || world.session.deployedUltimate.age < 0)) {
      index = this.writeUltimateDeployViewmodel(world, camera, instanceFloats, index, maxInstances, batches);
      const count = index - startIndex;
      if (count > 0) {
        device.queue.writeBuffer(
          instanceBuffer,
          startIndex * FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
          instanceFloats,
          startIndex * FLOATS_PER_INSTANCE,
          count * FLOATS_PER_INSTANCE,
        );
      }
      return { instanceCount: count, batches };
    }

    if (!rawCombatViewmodelWeaponsEnabled()) return empty;

    const player = world.player;
    const weaponId = player.currentWeapon;
    const profile = rawViewmodelProfileFor(weaponId);
    const asset = this.assets.get(weaponId);
    if (!profile || !asset || !asset.bounds || !world.weaponUnlocked(weaponId)) return empty;
    if (startIndex + 8 > maxInstances) return empty;
    const motion = this.computeMotion(world, weaponId, nowMs);

    // Hand first (separate scratch matrices) so the shared pose/scale/anchor
    // members still describe the weapon when the articulation block runs.
    const handAsset = this.handAssets.get(weaponId);
    if (handAsset?.bounds) {
      this.composeLocal(profile.handPose, handAsset, motion, this.handLocalMatrix);
      this.handModelMatrix.multiplyMatrices(camera.matrixWorld, this.handLocalMatrix);
      this.writeInstance(instanceFloats, index, this.handModelMatrix, [1, 1, 1, 0.06]);
      batches.push({
        vertexBuffer: "geometry",
        vertexOffset: handAsset.vertexOffset,
        vertexCount: handAsset.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
      index += 1;
    }

    const local = this.composeLocal(profile.weaponPose, asset, motion, this.localMatrix);
    this.modelMatrix.multiplyMatrices(camera.matrixWorld, local);
    const articulation = this.articulations.get(weaponId);
    if (articulation && index + 2 <= maxInstances) {
      // Static group instance.
      this.writeInstance(instanceFloats, index, this.modelMatrix, [1, 1, 1, 0.06]);
      for (const range of articulation.staticRanges) {
        batches.push({
          vertexBuffer: "geometry",
          vertexOffset: range.vertexOffset,
          vertexCount: range.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent: false,
        });
      }
      index += 1;
      // Animated group instance: model-space delta between scale and anchor.
      const delta = this.articulationDelta(articulation.animatedKind);
      this.deltaMatrix.makeTranslation(delta[0], delta[1], delta[2]);
      this.animatedLocalMatrix
        .multiplyMatrices(this.poseMatrix, this.scaleMatrix)
        .multiply(this.deltaMatrix)
        .multiply(this.centerOffsetMatrix);
      this.animatedModelMatrix.multiplyMatrices(camera.matrixWorld, this.animatedLocalMatrix);
      this.writeInstance(instanceFloats, index, this.animatedModelMatrix, [1, 1, 1, 0.06]);
      for (const range of articulation.animatedRanges) {
        batches.push({
          vertexBuffer: "geometry",
          vertexOffset: range.vertexOffset,
          vertexCount: range.vertexCount,
          instanceOffset: index,
          instanceCount: 1,
          transparent: false,
        });
      }
      index += 1;
    } else {
      this.writeInstance(instanceFloats, index, this.modelMatrix, [1, 1, 1, 0.06]);
      batches.push({
        vertexBuffer: "geometry",
        vertexOffset: asset.vertexOffset,
        vertexCount: asset.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
      index += 1;
    }

    // Muzzle flash: short-lived emissive card just past the sidearm muzzle.
    const flash = RAW_VIEWMODEL_MUZZLE_FLASH;
    const flashStrength = weaponId === "railLance" ? Math.max(0, 1 - this.kickAge / flash.durationSeconds) : 0;
    if (flashStrength > 0.05 && index < maxInstances) {
      const flashSize = flash.baseSize + flashStrength * flash.growth;
      if (profile.muzzleModel) {
        // Anchor the flash at the model-space muzzle so it tracks recoil.
        this.muzzlePoint
          .set(profile.muzzleModel[0], profile.muzzleModel[1], profile.muzzleModel[2])
          .applyMatrix4(local);
        this.localMatrix.compose(
          this.muzzlePoint,
          this.rotation.setFromEuler(this.euler.set(nowMs * 0.02, 0.3, nowMs * 0.013)),
          this.scratchScale.set(flashSize, flashSize, flashSize),
        );
      } else {
        this.localMatrix.compose(
          this.position.set(flash.position[0], flash.position[1], flash.position[2]),
          this.rotation.setFromEuler(this.euler.set(nowMs * 0.02, 0.3, nowMs * 0.013)),
          this.scratchScale.set(flashSize, flashSize, flashSize),
        );
      }
      this.modelMatrix.multiplyMatrices(camera.matrixWorld, this.localMatrix);
      this.writeInstance(instanceFloats, index, this.modelMatrix, [
        flash.color[0],
        flash.color[1],
        flash.color[2],
        flash.color[3] * flashStrength,
      ]);
      batches.push({
        vertexBuffer: "proxy",
        vertexOffset: 0,
        vertexCount: CUBE_VERTEX_COUNT,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
      index += 1;
    }

    const count = index - startIndex;
    device.queue.writeBuffer(
      instanceBuffer,
      startIndex * FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      instanceFloats,
      startIndex * FLOATS_PER_INSTANCE,
      count * FLOATS_PER_INSTANCE,
    );
    return { instanceCount: count, batches };
  }

  private writeUltimateDeployViewmodel(
    world: GameWorld,
    camera: PerspectiveCamera,
    instanceFloats: Float32Array,
    index: number,
    maxInstances: number,
    batches: RawDrawBatch[],
  ) {
    const deployed = world.session.deployedUltimate;
    if (!deployed || (deployed.phase !== "held" && deployed.age >= 0) || index >= maxInstances) return index;
    const asset = this.ultimateAssets.get(deployed.abilityId);

    const tuning = RAW_VIEWMODEL_ULTIMATE_DEPLOY;
    const held = deployed.phase === "held";
    const p = held ? smooth(Math.min(1, deployed.age / 0.2), 0, 1) * 0.22 : smooth(1 + deployed.age / tuning.durationSeconds, 0, 1);
    const idlePulse = held ? Math.sin(deployed.age * 5.8) * 0.018 : 0;
    const throwLift: RawViewmodelMotion = {
      px: Math.sin(p * Math.PI) * 0.035,
      py: Math.sin(p * Math.PI) * 0.05 + idlePulse,
      pz: -p * 0.04,
      rx: -p * 0.18,
      ry: p * 0.45,
      rz: 0,
    };
    const handAsset = this.ultimateHandAssets.get(RAW_VIEWMODEL_ULTIMATE_HAND_GRIP_BY_ABILITY[deployed.abilityId]);
    if (handAsset?.bounds && index < maxInstances) {
      const handPose: RawViewmodelPose = {
        basePosition: [0.28, -0.55, -0.66] as Tuple3,
        baseRotation: [-0.42, 0.12, 0.18] as Tuple3,
        anchor: "recenter",
        scale: 0.38,
      };
      this.composeLocal(handPose, handAsset, throwLift, this.handLocalMatrix);
      this.handModelMatrix.multiplyMatrices(camera.matrixWorld, this.handLocalMatrix);
      this.writeInstance(instanceFloats, index, this.handModelMatrix, [1, 1, 1, 0.06]);
      batches.push({
        vertexBuffer: "geometry",
        vertexOffset: handAsset.vertexOffset,
        vertexCount: handAsset.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
      index += 1;
    }

    const pose: RawViewmodelPose = {
      basePosition: lerpTuple(tuning.startPosition, tuning.endPosition, p),
      baseRotation: lerpTuple(tuning.startRotation, tuning.endRotation, p),
      anchor: "recenter",
      scale: tuning.startScale + (tuning.endScale - tuning.startScale) * p,
    };

    if (!asset?.bounds || index >= maxInstances) {
      const modelKey = RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS[deployed.abilityId];
      if (isRawViewmodelProceduralModelKey(modelKey)) {
        return this.writeProceduralUltimateViewmodel(camera, instanceFloats, index, maxInstances, batches, pose, throwLift, deployed.age, deployed.id);
      }
      return index;
    }

    const local = this.composeLocal(pose, asset, throwLift, this.localMatrix);
    this.modelMatrix.multiplyMatrices(camera.matrixWorld, local);
    const fade = 1 - smooth(p, 0.72, 1);
    this.writeInstance(instanceFloats, index, this.modelMatrix, [
      tuning.tint[0],
      tuning.tint[1],
      tuning.tint[2],
      tuning.tint[3] * Math.max(0.22, fade),
    ]);

    const chunks = asset.nodeChunks ?? [];
    if (chunks.length <= 0) {
      batches.push({
        vertexBuffer: "geometry",
        vertexOffset: asset.vertexOffset,
        vertexCount: asset.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
      return index + 1;
    }
    for (const chunk of chunks) {
      if (isPickupWrapFaceNode(chunk.nodeName)) continue;
      batches.push({
        vertexBuffer: "geometry",
        vertexOffset: chunk.vertexOffset,
        vertexCount: chunk.vertexCount,
        instanceOffset: index,
        instanceCount: 1,
        transparent: false,
      });
    }
    return index + 1;
  }

  private writeExitButtonPressHand(
    world: GameWorld,
    camera: PerspectiveCamera,
    instanceFloats: Float32Array,
    index: number,
    maxInstances: number,
    batches: RawDrawBatch[],
  ) {
    const cinematic = world.session.activeExitCinematic;
    if (!cinematic || index >= maxInstances) return index;
    const handAsset = this.handAssets.get("railLance") ?? this.handAssets.get("pulseRifle");

    const touch = exitButtonTouchProgress(cinematic);
    const lead = smooth(cinematic.elapsed, cinematic.buttonPressTime - 0.86, cinematic.buttonPressTime - 0.08);
    const leave = smooth(cinematic.elapsed, cinematic.buttonPressTime + 0.45, cinematic.buttonPressTime + 0.98);
    const visibility = Math.max(0, Math.min(1, lead * (1 - leave)));
    if (visibility <= 0.015) return index;

    const press = Math.max(touch, smooth(cinematic.elapsed, cinematic.buttonPressTime - 0.18, cinematic.buttonPressTime + 0.08) * (1 - leave));

    if (!handAsset?.bounds) return index;

    const pose: RawViewmodelPose = {
      basePosition: [-0.07 - press * 0.025 + leave * 0.18, -0.32 + press * 0.03 - leave * 0.14, -0.62 - press * 0.18 + leave * 0.18],
      baseRotation: [-0.46 - press * 0.2, -0.4 - press * 0.08, 0.28 + press * 0.12],
      anchor: "recenter",
      scale: 0.34,
    };
    const motion: RawViewmodelMotion = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 };
    this.composeLocal(pose, handAsset, motion, this.handLocalMatrix);
    this.handModelMatrix.multiplyMatrices(camera.matrixWorld, this.handLocalMatrix);
    this.writeInstance(instanceFloats, index, this.handModelMatrix, [1, 1, 1, 0.06]);
    batches.push({
      vertexBuffer: "geometry",
      vertexOffset: handAsset.vertexOffset,
      vertexCount: handAsset.vertexCount,
      instanceOffset: index,
      instanceCount: 1,
      transparent: false,
    });
    return index + 1;
  }

  private writeHandInteractionPressHand(
    world: GameWorld,
    camera: PerspectiveCamera,
    instanceFloats: Float32Array,
    index: number,
    maxInstances: number,
    batches: RawDrawBatch[],
  ) {
    const active = world.session.activeHandInteraction;
    if (!active || index >= maxInstances) return index;
    const handAsset = this.handAssets.get("railLance") ?? this.handAssets.get("pulseRifle");
    if (!handAsset?.bounds) return index;

    const reach = smooth(active.elapsed, 0, active.commitAt);
    const leave = smooth(active.elapsed, active.commitAt, active.duration);
    const press = Math.max(0, Math.min(1, reach * (1 - leave)));
    const leverPullsUp = active.handPose === "lever_push_down" && active.leverDirection === "up";
    const leverStartY = leverPullsUp ? -0.43 : -0.24;
    const leverTravelY = leverPullsUp ? 0.18 : -0.2;
    const pose: RawViewmodelPose = {
      basePosition: [
        -0.07 - press * 0.025,
        active.handPose === "lever_push_down" ? leverStartY + press * leverTravelY : -0.32 + press * 0.03,
        -0.62 - press * (leverPullsUp ? 0.14 : 0.18),
      ],
      baseRotation: [
        leverPullsUp ? -0.54 + press * 0.12 : -0.42 - press * 0.22,
        leverPullsUp ? -0.36 + press * 0.06 : -0.42 - press * 0.08,
        leverPullsUp ? 0.18 - press * 0.1 : 0.22 + press * 0.14,
      ],
      anchor: "recenter",
      scale: 0.34,
    };
    const motion: RawViewmodelMotion = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 };
    this.composeLocal(pose, handAsset, motion, this.handLocalMatrix);
    this.handModelMatrix.multiplyMatrices(camera.matrixWorld, this.handLocalMatrix);
    this.writeInstance(instanceFloats, index, this.handModelMatrix, [1, 1, 1, 0.06]);
    batches.push({
      vertexBuffer: "geometry",
      vertexOffset: handAsset.vertexOffset,
      vertexCount: handAsset.vertexCount,
      instanceOffset: index,
      instanceCount: 1,
      transparent: false,
    });
    return index + 1;
  }

  private writeProceduralUltimateViewmodel(
    camera: PerspectiveCamera,
    instanceFloats: Float32Array,
    index: number,
    maxInstances: number,
    batches: RawDrawBatch[],
    pose: RawViewmodelPose,
    motion: RawViewmodelMotion,
    age: number,
    id: number,
  ) {
    const pulse = 0.5 + Math.sin(age * 7.2 + id * 0.19) * 0.5;
    const local = this.composeProceduralLocal(pose, motion, this.localMatrix);
    this.proxyRootMatrix.multiplyMatrices(camera.matrixWorld, local);
    index = this.writeViewmodelProxyCube(instanceFloats, index, maxInstances, batches, this.proxyRootMatrix, [0, 0, 0], [0.34, 0.42, 0.34], [0.018, 0.024, 0.026, 0.98]);
    index = this.writeViewmodelProxyCube(instanceFloats, index, maxInstances, batches, this.proxyRootMatrix, [0, 0.02, -0.2], [0.2, 0.25, 0.045], [0.38, 0.95, 1.0, 0.9]);
    index = this.writeViewmodelProxyCube(instanceFloats, index, maxInstances, batches, this.proxyRootMatrix, [0, 0.26, 0], [0.24, 0.075, 0.24], [0.94, 0.64, 0.22, 0.96], age * 0.18);
    index = this.writeViewmodelProxyCube(instanceFloats, index, maxInstances, batches, this.proxyRootMatrix, [0, -0.26, 0], [0.25, 0.07, 0.25], [0.94, 0.64, 0.22, 0.96], -age * 0.18);
    index = this.writeViewmodelProxyCube(instanceFloats, index, maxInstances, batches, this.proxyRootMatrix, [0, 0.02, 0], [0.43, 0.045, 0.43], [0.94, 0.78, 0.34, 0.72], Math.PI / 4 + pulse * 0.08);
    return index;
  }

  /** Model-space translation for the animated chunk group. */
  private articulationDelta(kind: "slide" | "impact"): Tuple3 {
    const tuning = RAW_VIEWMODEL_ARTICULATION;
    if (kind === "slide") {
      const p = Math.min(1, this.kickAge / RAW_VIEWMODEL_RECOIL.sidearmKickSeconds);
      // Sharp rearward snap, springy return (muzzle is -Z, so rearward is +Z).
      const slide = pulse(p, 0, tuning.slidePeak, 1);
      return [0, 0, slide * tuning.slideTravel];
    }
    const p = Math.min(1, this.swingAge / RAW_VIEWMODEL_RECOIL.rodSwingSeconds);
    const impact = pulse(p, 0.3, 0.38, 0.5);
    return [0, -impact * tuning.rodImpactCompress, 0];
  }

  private advanceTimers(world: GameWorld, deltaSeconds: number) {
    const player = world.player;
    if (player.fireSequence !== this.lastFireSequence) {
      if (this.lastFireSequence >= 0) {
        if (player.currentWeapon === "pulseRifle") this.swingAge = 0;
        if (player.currentWeapon === "railLance") this.kickAge = 0;
      }
      this.lastFireSequence = player.fireSequence;
    }
    if (player.weaponSwitchSequence !== this.lastWeaponSwitchSequence) {
      if (this.lastWeaponSwitchSequence >= 0) this.switchAge = 0;
      this.lastWeaponSwitchSequence = player.weaponSwitchSequence;
    }
    this.swingAge += deltaSeconds;
    this.kickAge += deltaSeconds;
    this.switchAge += deltaSeconds;
  }

  /**
   * Camera-space motion offsets (sway, switch raise, swing/kick/reload) for
   * the current weapon. Hand and weapon share the same motion so the grip
   * stays attached.
   */
  private computeMotion(world: GameWorld, weaponId: string, nowMs: number): RawViewmodelMotion {
    const player = world.player;
    const sway = RAW_VIEWMODEL_SWAY;
    const recoilTuning = RAW_VIEWMODEL_RECOIL;
    const movement = Math.min(1, player.movementAmount + (player.isDashing ? 0.6 : 0));
    const bobPhase = nowMs * sway.bobFrequency;
    const bobY = Math.sin(bobPhase) * sway.bobAmplitude * (sway.idleFloor + movement * (1 - sway.idleFloor));
    const swayX = Math.cos(bobPhase * sway.swayFrequencyScale) * sway.swayAmplitude * (0.2 + movement * 0.8);
    const recoil = Math.min(1.4, player.weaponRecoil);
    // Weapon switch: weapon rises from below.
    const raise = 1 - smooth(Math.min(1, this.switchAge / recoilTuning.switchRaiseSeconds), 0, 1);

    const motion: RawViewmodelMotion = {
      px: swayX,
      py: bobY - raise * recoilTuning.switchRaiseDrop,
      pz: 0,
      rx: raise * 0.6,
      ry: 0,
      rz: 0,
    };

    if (weaponId === "pulseRifle") {
      // Rod swing: windup → strike → recover, mirroring the overlay curves.
      const p = Math.min(1, this.swingAge / recoilTuning.rodSwingSeconds);
      const windup = pulse(p, 0.0, 0.14, 0.3);
      const strike = pulse(p, 0.2, 0.34, 0.58);
      const impact = pulse(p, 0.3, 0.38, 0.5);
      const recover = smooth(p, 0.55, 0.95);
      motion.px += windup * 0.14 - strike * 0.3 + recover * 0.04;
      motion.py += windup * 0.055 - impact * 0.095;
      motion.pz += -windup * 0.1 - strike * 0.36 + impact * 0.05;
      motion.rx += -windup * 0.7 + strike * 1.1 + impact * 0.2 - recover * 0.12;
      motion.rz += windup * 0.4 - strike * 0.7;
    } else if (weaponId === "railLance") {
      const kick = pulse(Math.min(1, this.kickAge / recoilTuning.sidearmKickSeconds), 0.0, 0.16, 1);
      const reload = sidearmReloadProgress(player);
      const reloadDip = Math.sin(Math.min(1, reload) * Math.PI);
      motion.px += kick * 0.02 - reloadDip * 0.05;
      motion.py += kick * recoilTuning.kickLift - reloadDip * recoilTuning.reloadDip;
      motion.pz += kick * recoilTuning.kickBack + recoil * recoilTuning.recoilBack + reloadDip * 0.08;
      motion.rx += kick * recoilTuning.kickPitch + reloadDip * recoilTuning.reloadPitch;
      motion.rz += -reloadDip * 0.24;
    }
    return motion;
  }

  /**
   * local = T(pose+motion) * R(pose+motion) * S * T(-anchor). The shared
   * pose/scale/anchor members keep the LAST composed values; compose the
   * weapon after the hand so the articulation block sees the weapon's pieces.
   */
  private composeLocal(
    pose: RawViewmodelPose,
    asset: RawPlanGeometryAsset,
    motion: RawViewmodelMotion,
    outMatrix: Matrix4,
  ): Matrix4 {
    const bounds = asset.bounds as NonNullable<RawPlanGeometryAsset["bounds"]>;
    const maxDimension = Math.max(bounds.size[0], bounds.size[1], bounds.size[2], 0.001);
    const scale = pose.anchor === "recenter" ? pose.scale / maxDimension : pose.scale;

    if (pose.anchor === "recenter") {
      this.centerOffsetMatrix.makeTranslation(-bounds.center[0], -bounds.center[1], -bounds.center[2]);
    } else {
      this.centerOffsetMatrix.identity();
    }
    this.scaleMatrix.makeScale(scale, scale, scale);
    this.poseMatrix.compose(
      this.position.set(pose.basePosition[0] + motion.px, pose.basePosition[1] + motion.py, pose.basePosition[2] + motion.pz),
      this.rotation.setFromEuler(
        this.euler.set(pose.baseRotation[0] + motion.rx, pose.baseRotation[1] + motion.ry, pose.baseRotation[2] + motion.rz, "XYZ"),
      ),
      this.unitScale,
    );
    return outMatrix.multiplyMatrices(this.poseMatrix, this.scaleMatrix).multiply(this.centerOffsetMatrix);
  }

  private composeProceduralLocal(
    pose: RawViewmodelPose,
    motion: RawViewmodelMotion,
    outMatrix: Matrix4,
  ): Matrix4 {
    this.scaleMatrix.makeScale(pose.scale, pose.scale, pose.scale);
    this.poseMatrix.compose(
      this.position.set(pose.basePosition[0] + motion.px, pose.basePosition[1] + motion.py, pose.basePosition[2] + motion.pz),
      this.rotation.setFromEuler(
        this.euler.set(pose.baseRotation[0] + motion.rx, pose.baseRotation[1] + motion.ry, pose.baseRotation[2] + motion.rz, "XYZ"),
      ),
      this.unitScale,
    );
    return outMatrix.multiplyMatrices(this.poseMatrix, this.scaleMatrix);
  }

  private writeViewmodelProxyCube(
    instanceFloats: Float32Array,
    index: number,
    maxInstances: number,
    batches: RawDrawBatch[],
    rootMatrix: Matrix4,
    localPosition: Tuple3,
    localScale: Tuple3,
    color: Tuple4,
    yaw = 0,
  ) {
    if (index >= maxInstances) return index;
    this.proxyPartMatrix.compose(
      this.position.set(localPosition[0], localPosition[1], localPosition[2]),
      this.rotation.setFromEuler(this.euler.set(0, yaw, 0, "XYZ")),
      this.scratchScale.set(localScale[0], localScale[1], localScale[2]),
    );
    this.proxyModelMatrix.multiplyMatrices(rootMatrix, this.proxyPartMatrix);
    this.writeInstance(instanceFloats, index, this.proxyModelMatrix, color);
    batches.push({
      vertexBuffer: "proxy",
      vertexOffset: 0,
      vertexCount: CUBE_VERTEX_COUNT,
      instanceOffset: index,
      instanceCount: 1,
      transparent: color[3] < 0.99,
    });
    return index + 1;
  }

  private writeInstance(instanceFloats: Float32Array, index: number, matrix: Matrix4, color: Tuple4) {
    const offset = index * FLOATS_PER_INSTANCE;
    instanceFloats.set(matrix.elements, offset);
    instanceFloats.set(color, offset + 16);
    instanceFloats.set([0, 0, 0, 0], offset + 20);
  }
}

function isRenderableAsset(asset: RawPlanGeometryAsset | undefined): asset is RawPlanGeometryAsset {
  return Boolean(asset && asset.status === "ready" && asset.vertexCount > 0 && asset.bounds);
}

function buildArticulation(profile: RawViewmodelWeaponProfile, asset: RawPlanGeometryAsset): RawViewmodelArticulation | null {
  const rule = profile.articulation;
  const chunks = asset.nodeChunks ?? [];
  if (!rule || chunks.length === 0) return null;
  const animated: RawViewmodelDrawRange[] = [];
  const stationary: RawViewmodelDrawRange[] = [];
  for (const chunk of chunks) {
    if (chunk.vertexCount <= 0) continue;
    const target = rule.chunkPattern.test(chunk.nodeName ?? "") ? animated : stationary;
    target.push({ vertexOffset: chunk.vertexOffset, vertexCount: chunk.vertexCount });
  }
  // Stable fallback: nothing matched (renamed nodes) → rigid whole model.
  if (animated.length === 0) return null;
  return {
    staticRanges: mergeRanges(stationary),
    animatedRanges: mergeRanges(animated),
    animatedKind: rule.kind,
  };
}

/** Coalesces contiguous vertex ranges to keep the draw count small. */
function mergeRanges(ranges: RawViewmodelDrawRange[]): RawViewmodelDrawRange[] {
  const sorted = [...ranges].sort((left, right) => left.vertexOffset - right.vertexOffset);
  const merged: RawViewmodelDrawRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && previous.vertexOffset + previous.vertexCount === range.vertexOffset) {
      previous.vertexCount += range.vertexCount;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function sidearmReloadProgress(player: GameWorld["player"]) {
  if (player.gunReloadDuration <= 0 || player.gunReloadRemaining <= 0) return 0;
  return 1 - player.gunReloadRemaining / player.gunReloadDuration;
}

function rawCombatViewmodelWeaponsEnabled() {
  if (typeof window === "undefined") return true;
  const params = new URLSearchParams(window.location.search);
  return params.get("combatViewmodelWeapons") !== "0";
}

function smooth(value: number, start: number, end: number) {
  const t = Math.min(1, Math.max(0, (value - start) / Math.max(1e-6, end - start)));
  return t * t * (3 - 2 * t);
}

function pulse(value: number, start: number, peak: number, end: number) {
  if (value <= start || value >= end) return 0;
  if (value < peak) return smooth(value, start, peak);
  return 1 - smooth(value, peak, end);
}

function lerpTuple(start: Tuple3, end: Tuple3, t: number): Tuple3 {
  return [
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
    start[2] + (end[2] - start[2]) * t,
  ];
}
