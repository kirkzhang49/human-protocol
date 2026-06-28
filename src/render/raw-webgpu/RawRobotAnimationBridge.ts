import { Matrix4, Quaternion, Vector3 } from "three";

export interface RawRobotAnimationBridge {
  schemaVersion?: string;
  assets?: RawRobotAnimationAsset[];
}

export interface RawRobotAnimationAsset {
  key: string;
  nodes?: RawRobotAnimationNode[];
  clips?: RawRobotAnimationClip[];
}

export interface RawRobotAnimationNode {
  index: number;
  name?: string | null;
  parent?: number | null;
  translation?: number[] | null;
  rotation?: number[] | null;
  scale?: number[] | null;
  matrix?: number[] | null;
}

export interface RawRobotAnimationClip {
  index?: number;
  name: string;
  action?: string | null;
  durationSeconds: number;
  channels?: RawRobotAnimationChannel[];
}

export interface RawRobotAnimationChannel {
  targetNode: number;
  path: "translation" | "rotation" | "scale" | string;
  interpolation?: string;
  times?: number[];
  values?: number[];
  valueType?: string;
}

export interface RawRobotAnimationPose {
  action: string;
  durationSeconds: number;
  worldMatrices: Matrix4[];
}

interface RuntimeClip {
  name: string;
  action: string;
  durationSeconds: number;
  channels: RawRobotAnimationChannel[];
}

interface RuntimeAsset {
  key: string;
  nodeNames: (string | null)[];
  parents: (number | null)[];
  baseTranslations: Vector3[];
  baseRotations: Quaternion[];
  baseScales: Vector3[];
  translations: Vector3[];
  rotations: Quaternion[];
  scales: Vector3[];
  localMatrices: Matrix4[];
  worldMatrices: Matrix4[];
  visited: Uint8Array;
  clipsByAction: Map<string, RuntimeClip>;
  pose: RawRobotAnimationPose;
}

type ScaleLimit = readonly [number, number, number];

const FALLBACK_ACTIONS = ["idle", "move", "spawn_boot", "attack_windup", "attack_strike", "attack_recover"];

export function createRawRobotAnimationSampler(bridge: RawRobotAnimationBridge | null | undefined) {
  if (!bridge?.assets?.length) return null;
  return new RawRobotAnimationSampler(bridge);
}

export class RawRobotAnimationSampler {
  private readonly assets = new Map<string, RuntimeAsset>();
  private readonly sampleVecA = new Vector3();
  private readonly sampleVecB = new Vector3();
  private readonly sampleQuatA = new Quaternion();
  private readonly sampleQuatB = new Quaternion();
  private readonly sampleMatrix = new Matrix4();

  constructor(bridge: RawRobotAnimationBridge) {
    for (const asset of bridge.assets ?? []) {
      if (!asset.key) continue;
      const runtimeAsset = this.createRuntimeAsset(asset);
      if (runtimeAsset) this.assets.set(asset.key, runtimeAsset);
    }
  }

  hasModel(modelKey: string) {
    return this.assets.has(modelKey);
  }

  clipDuration(modelKey: string, action: string) {
    return this.assets.get(modelKey)?.clipsByAction.get(action)?.durationSeconds ?? null;
  }

  sample(modelKey: string, action: string, timeSeconds: number, loop: boolean): RawRobotAnimationPose | null {
    const asset = this.assets.get(modelKey);
    if (!asset) return null;
    const clip = this.selectClip(asset, action);
    if (!clip) return null;

    const duration = Math.max(0.001, clip.durationSeconds);
    const clipTime = loop ? positiveModulo(timeSeconds, duration) : clamp(timeSeconds, 0, duration);
    this.resetPose(asset);
    for (const channel of clip.channels) {
      const nodeIndex = channel.targetNode;
      if (nodeIndex < 0 || nodeIndex >= asset.localMatrices.length) continue;
      if (channel.path === "translation") {
        this.sampleVec3Channel(channel, clipTime, asset.translations[nodeIndex]);
      } else if (channel.path === "rotation") {
        this.sampleQuaternionChannel(channel, clipTime, asset.rotations[nodeIndex]);
      } else if (channel.path === "scale") {
        this.sampleVec3Channel(channel, clipTime, asset.scales[nodeIndex]);
      }
    }
    applyRawRobotReadabilityOverrides(asset, clip.action);
    this.composePose(asset);
    asset.pose.action = clip.action;
    asset.pose.durationSeconds = duration;
    return asset.pose;
  }

  private createRuntimeAsset(asset: RawRobotAnimationAsset): RuntimeAsset | null {
    const nodes = asset.nodes ?? [];
    const nodeCount = Math.max(0, ...nodes.map((node) => node.index + 1));
    if (nodeCount <= 0) return null;

    const parents: (number | null)[] = Array.from({ length: nodeCount }, () => null);
    const nodeNames: (string | null)[] = Array.from({ length: nodeCount }, () => null);
    const baseTranslations = Array.from({ length: nodeCount }, () => new Vector3());
    const baseRotations = Array.from({ length: nodeCount }, () => new Quaternion());
    const baseScales = Array.from({ length: nodeCount }, () => new Vector3(1, 1, 1));
    const translations = Array.from({ length: nodeCount }, () => new Vector3());
    const rotations = Array.from({ length: nodeCount }, () => new Quaternion());
    const scales = Array.from({ length: nodeCount }, () => new Vector3(1, 1, 1));
    const localMatrices = Array.from({ length: nodeCount }, () => new Matrix4());
    const worldMatrices = Array.from({ length: nodeCount }, () => new Matrix4());

    for (const node of nodes) {
      const nodeIndex = node.index;
      if (nodeIndex < 0 || nodeIndex >= nodeCount) continue;
      nodeNames[nodeIndex] = node.name ?? null;
      parents[nodeIndex] = Number.isFinite(node.parent ?? NaN) ? node.parent ?? null : null;
      if (node.matrix?.length === 16) {
        this.sampleMatrix.fromArray(node.matrix);
        this.sampleMatrix.decompose(baseTranslations[nodeIndex], baseRotations[nodeIndex], baseScales[nodeIndex]);
      } else {
        baseTranslations[nodeIndex].fromArray(vecArray(node.translation, [0, 0, 0]));
        baseRotations[nodeIndex].fromArray(vecArray(node.rotation, [0, 0, 0, 1])).normalize();
        baseScales[nodeIndex].fromArray(vecArray(node.scale, [1, 1, 1]));
      }
    }

    const clipsByAction = new Map<string, RuntimeClip>();
    for (const clip of asset.clips ?? []) {
      const action = clip.action || normalizeClipAction(clip.name);
      if (!action || clipsByAction.has(action)) continue;
      clipsByAction.set(action, {
        name: clip.name,
        action,
        durationSeconds: clip.durationSeconds,
        channels: clip.channels ?? [],
      });
    }

    if (clipsByAction.size <= 0) return null;
    return {
      key: asset.key,
      nodeNames,
      parents,
      baseTranslations,
      baseRotations,
      baseScales,
      translations,
      rotations,
      scales,
      localMatrices,
      worldMatrices,
      visited: new Uint8Array(nodeCount),
      clipsByAction,
      pose: {
        action: "idle",
        durationSeconds: 0,
        worldMatrices,
      },
    };
  }

  private selectClip(asset: RuntimeAsset, action: string) {
    const requested = asset.clipsByAction.get(action);
    if (requested) return requested;
    for (const fallbackAction of FALLBACK_ACTIONS) {
      const fallback = asset.clipsByAction.get(fallbackAction);
      if (fallback) return fallback;
    }
    return asset.clipsByAction.values().next().value ?? null;
  }

  private resetPose(asset: RuntimeAsset) {
    for (let index = 0; index < asset.localMatrices.length; index += 1) {
      asset.translations[index].copy(asset.baseTranslations[index]);
      asset.rotations[index].copy(asset.baseRotations[index]);
      asset.scales[index].copy(asset.baseScales[index]);
      asset.visited[index] = 0;
    }
  }

  private composePose(asset: RuntimeAsset) {
    for (let index = 0; index < asset.localMatrices.length; index += 1) {
      asset.localMatrices[index].compose(asset.translations[index], asset.rotations[index], asset.scales[index]);
    }
    for (let index = 0; index < asset.localMatrices.length; index += 1) {
      this.composeWorldNode(asset, index);
    }
  }

  private composeWorldNode(asset: RuntimeAsset, nodeIndex: number) {
    if (asset.visited[nodeIndex]) return;
    const parent = asset.parents[nodeIndex];
    if (parent !== null && parent >= 0 && parent < asset.localMatrices.length) {
      this.composeWorldNode(asset, parent);
      asset.worldMatrices[nodeIndex].multiplyMatrices(asset.worldMatrices[parent], asset.localMatrices[nodeIndex]);
    } else {
      asset.worldMatrices[nodeIndex].copy(asset.localMatrices[nodeIndex]);
    }
    asset.visited[nodeIndex] = 1;
  }

  private sampleVec3Channel(channel: RawRobotAnimationChannel, timeSeconds: number, out: Vector3) {
    const times = channel.times ?? [];
    const values = channel.values ?? [];
    if (times.length <= 0 || values.length < 3) return;
    const frame = sampleFrame(times, timeSeconds);
    const baseOffset = frame.index * 3;
    this.sampleVecA.set(values[baseOffset] ?? out.x, values[baseOffset + 1] ?? out.y, values[baseOffset + 2] ?? out.z);
    if (frame.alpha <= 0 || frame.index >= times.length - 1) {
      out.copy(this.sampleVecA);
      return;
    }
    const nextOffset = (frame.index + 1) * 3;
    this.sampleVecB.set(values[nextOffset] ?? this.sampleVecA.x, values[nextOffset + 1] ?? this.sampleVecA.y, values[nextOffset + 2] ?? this.sampleVecA.z);
    out.copy(this.sampleVecA).lerp(this.sampleVecB, frame.alpha);
  }

  private sampleQuaternionChannel(channel: RawRobotAnimationChannel, timeSeconds: number, out: Quaternion) {
    const times = channel.times ?? [];
    const values = channel.values ?? [];
    if (times.length <= 0 || values.length < 4) return;
    const frame = sampleFrame(times, timeSeconds);
    const baseOffset = frame.index * 4;
    this.sampleQuatA.set(
      values[baseOffset] ?? out.x,
      values[baseOffset + 1] ?? out.y,
      values[baseOffset + 2] ?? out.z,
      values[baseOffset + 3] ?? out.w,
    ).normalize();
    if (frame.alpha <= 0 || frame.index >= times.length - 1) {
      out.copy(this.sampleQuatA);
      return;
    }
    const nextOffset = (frame.index + 1) * 4;
    this.sampleQuatB.set(
      values[nextOffset] ?? this.sampleQuatA.x,
      values[nextOffset + 1] ?? this.sampleQuatA.y,
      values[nextOffset + 2] ?? this.sampleQuatA.z,
      values[nextOffset + 3] ?? this.sampleQuatA.w,
    ).normalize();
    out.slerpQuaternions(this.sampleQuatA, this.sampleQuatB, frame.alpha).normalize();
  }
}

function applyRawRobotReadabilityOverrides(asset: RuntimeAsset, action: string) {
  if (usesAuthoredRawEnemyRig(asset.key)) return;

  sanitizeEnemyRootScale(asset, action, 1.08);

  if (asset.key === "hp_enemy_repair_drone_horror") {
    for (let index = 0; index < asset.scales.length; index += 1) {
      const exact = enemyExactNodeScaleOverride(asset.nodeNames[index], asset.key);
      if (exact) applyScaleLimit(asset.scales[index], exact);
      const family = enemyAppendageFamily(asset.nodeNames[index]);
      if (family === "arm") {
        setScaleFloor(asset.scales[index], 0.24, 0.23, 0.28);
      } else if (family === "forearm") {
        setScaleFloor(asset.scales[index], 0.25, 0.25, 0.38);
      } else if (family === "hand") {
        setScaleFloor(asset.scales[index], 0.32, 0.30, 0.32);
      } else if (family === "tool") {
        setScaleCeiling(asset.scales[index], 0.22, 0.18, 0.22);
      }
    }
    return;
  }

  if (asset.key === "hp_enemy_clamp_repair_horror") {
    clampEnemyUtilityAppendages(asset, {
      hand: [0.86, 0.78, 0.70],
      arm: [1.14, 1.04, 0.82],
      forearm: [1.12, 1.02, 0.82],
      tool: [0.82, 0.72, 0.62],
    });
    return;
  }
}

function usesAuthoredRawEnemyRig(assetKey: string) {
  return (
    assetKey === "hp_enemy_shield_technician_horror" ||
    assetKey === "hp_enemy_custodian_foreman_horror" ||
    assetKey === "hp_enemy_reclamation_mother_final_horror"
  );
}

function sanitizeEnemyRootScale(asset: RuntimeAsset, action: string, ceilingRatio: number) {
  for (let index = 0; index < asset.scales.length; index += 1) {
    const normalizedName = String(asset.nodeNames[index] ?? "").toLowerCase().replace(/[^a-z0-9]/gu, "");
    if (asset.parents[index] !== null && normalizedName !== "root") continue;
    const base = asset.baseScales[index];
    if (action === "hit_heavy") {
      const sampledRatio = (asset.scales[index].x + asset.scales[index].y + asset.scales[index].z) / 3;
      const clampedRatio = clamp(sampledRatio, 0.82, ceilingRatio);
      asset.scales[index].set(base.x * clampedRatio, base.y * clampedRatio, base.z * clampedRatio);
      continue;
    }
    setScaleCeiling(
      asset.scales[index],
      Math.max(base.x * ceilingRatio, base.x),
      Math.max(base.y * ceilingRatio, base.y),
      Math.max(base.z * ceilingRatio, base.z),
    );
  }
}

function enemyAppendageFamily(name: string | null | undefined): "hand" | "forearm" | "arm" | "tool" | null {
  const normalized = String(name ?? "").toLowerCase().replace(/[^a-z0-9]/gu, "");
  if (!normalized) return null;
  if (/utilityhand|parthand|lefthand|righthand/.test(normalized)) return "hand";
  if (/partforearm/.test(normalized)) return "forearm";
  if (/partarm|upperarm/.test(normalized)) return "arm";
  if (/servicecutter|rescuebaton|utilitywrench|stunprobe|cutter|wrench|baton|probe/.test(normalized)) return "tool";
  return null;
}

function clampEnemyUtilityAppendages(
  asset: RuntimeAsset,
  limits: {
    hand: ScaleLimit;
    arm: ScaleLimit;
    forearm: ScaleLimit;
    tool: ScaleLimit;
  },
) {
  for (let index = 0; index < asset.scales.length; index += 1) {
    const exact = enemyExactNodeScaleOverride(asset.nodeNames[index], asset.key);
    if (exact) applyScaleLimit(asset.scales[index], exact);
    const family = enemyAppendageFamily(asset.nodeNames[index]);
    if (family === "hand") {
      setScaleCeilingVector(asset.scales[index], limits.hand);
    } else if (family === "arm") {
      setScaleCeilingVector(asset.scales[index], limits.arm);
    } else if (family === "forearm") {
      setScaleCeilingVector(asset.scales[index], limits.forearm);
    } else if (family === "tool") {
      setScaleCeilingVector(asset.scales[index], limits.tool);
    }
  }
}

function enemyExactNodeScaleOverride(
  name: string | null | undefined,
  assetKey: string,
): { floor?: ScaleLimit; ceiling?: ScaleLimit } | null {
  const normalized = String(name ?? "").toLowerCase().replace(/[^a-z0-9]/gu, "");
  if (!normalized) return null;
  if (assetKey === "hp_enemy_repair_drone_horror") {
    if (normalized === "mesh52" || normalized === "mesh66") return { ceiling: [0.01, 0.01, 0.01] };
    return null;
  }
  if (
    assetKey === "hp_enemy_clamp_repair_horror" &&
    (normalized === "mesh0001" ||
      normalized === "mesh4001" ||
      normalized === "mesh23001" ||
      normalized === "mesh27001" ||
      normalized === "mesh98" ||
      normalized === "mesh123")
  ) {
    return { ceiling: [0.075, 0.055, 0.075] };
  }
  if (assetKey === "hp_enemy_clamp_repair_horror" && normalized === "mesh54001") {
    return { ceiling: [0.075, 0.055, 0.075] };
  }
  return null;
}

function applyScaleLimit(scale: Vector3, limit: { floor?: ScaleLimit; ceiling?: ScaleLimit }) {
  if (limit.floor) setScaleFloor(scale, limit.floor[0], limit.floor[1], limit.floor[2]);
  if (limit.ceiling) setScaleCeiling(scale, limit.ceiling[0], limit.ceiling[1], limit.ceiling[2]);
}

function setScaleFloor(scale: Vector3, x: number, y: number, z: number) {
  scale.set(Math.max(scale.x, x), Math.max(scale.y, y), Math.max(scale.z, z));
}

function setScaleCeiling(scale: Vector3, x: number, y: number, z: number) {
  scale.set(Math.min(scale.x, x), Math.min(scale.y, y), Math.min(scale.z, z));
}

function setScaleCeilingVector(scale: Vector3, ceiling: ScaleLimit) {
  setScaleCeiling(scale, ceiling[0], ceiling[1], ceiling[2]);
}

function sampleFrame(times: number[], timeSeconds: number) {
  if (timeSeconds <= times[0]) return { index: 0, alpha: 0 };
  const lastIndex = times.length - 1;
  if (timeSeconds >= times[lastIndex]) return { index: lastIndex, alpha: 0 };

  let low = 0;
  let high = lastIndex;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (times[middle] <= timeSeconds) low = middle + 1;
    else high = middle - 1;
  }
  const index = Math.max(0, low - 1);
  const duration = Math.max(0.000001, times[index + 1] - times[index]);
  return { index, alpha: clamp((timeSeconds - times[index]) / duration, 0, 1) };
}

function normalizeClipAction(name: string) {
  return name.replace(/\.\d+$/u, "").trim();
}

function positiveModulo(value: number, modulus: number) {
  return ((value % modulus) + modulus) % modulus;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function vecArray<const T extends readonly number[]>(input: number[] | null | undefined, fallback: T) {
  return input && input.length >= fallback.length ? input : fallback;
}
