import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Matrix4, Quaternion, Vector3 } from "three";

const scriptPath = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(scriptPath), "../..");
const levelId = readArg("--level") ?? "level_03_human_museum";
const manifestDir = path.join(gameRoot, "src/assets/manifests/generated/raw-webgpu");
const bridgePath = path.join(manifestDir, `raw_robot_animation_bridge_${levelId}.json`);
const renderPlanPath = path.join(manifestDir, `render_plan_${levelId}.json`);

const requiredActions = [
  "idle",
  "move",
  "attack_windup",
  "attack_strike",
  "attack_recover",
  "hit_light",
  "hit_heavy",
  "death",
  "spawn_boot",
];
const sampledActions = ["idle", "move", "attack_strike", "spawn_boot"];

const bridge = await readJson(bridgePath);
const renderPlan = await readJson(renderPlanPath);
const geometryByKey = new Map((renderPlan.geometry?.assets ?? []).map((asset) => [asset.modelKey, asset]));

const errors = [];
const warnings = [];
const rows = [];
const appendageReports = [];

for (const asset of bridge.assets ?? []) {
  const geometry = geometryByKey.get(asset.key);
  if (!geometry) {
    errors.push(`${asset.key}: missing render-plan geometry asset.`);
    continue;
  }

  const chunks = geometry.nodeChunks ?? [];
  const runtime = createRuntimeAsset(asset);
  if (!runtime) {
    errors.push(`${asset.key}: could not create runtime animation asset.`);
    continue;
  }

  if ((asset.skinCount ?? 0) > 0 || (geometry.skinCount ?? 0) > 0) {
    errors.push(`${asset.key}: has skins, but raw robot runtime currently supports rigid hierarchy chunks only.`);
  }

  if (chunks.length <= 0) {
    errors.push(`${asset.key}: has no node chunks for rigid hierarchy animation.`);
  }

  if (rawReadableAppendageOverrideRequired(asset.key) && !asset.rawReadableAppendageOverrides) {
    errors.push(`${asset.key}: missing rawReadableAppendageOverrides; appendage fixes must be visible in the bridge JSON.`);
  }
  for (const failure of rawBridgeAppendageScaleFailures(asset)) errors.push(failure);

  const missingChunks = chunks.filter((chunk) => !Number.isInteger(chunk.nodeIndex) || !runtime.worldMatrices[chunk.nodeIndex]);
  if (missingChunks.length > 0) {
    errors.push(`${asset.key}: ${missingChunks.length} chunks do not map to bridge nodes.`);
  }

  const actions = new Set((asset.clips ?? []).map((clip) => clip.action || normalizeClipAction(clip.name)));
  const missingActions = requiredActions.filter((action) => !actions.has(action));
  if (missingActions.length > 0) {
    warnings.push(`${asset.key}: missing actions ${missingActions.join(", ")}.`);
  }

  for (const action of sampledActions) {
    const sample = sampleRuntimeAsset(runtime, action, sampleTimeFor(action), true);
    if (!sample) {
      errors.push(`${asset.key}: could not sample action ${action}.`);
      continue;
    }
    if (action === "idle") {
      for (const failure of appendageScaleFailures(runtime)) errors.push(failure);
      const report = appendageScaleReport(runtime);
      if (report.length > 0) {
        appendageReports.push(`${asset.key}: ${report.join("; ")}`);
      }
    }

    let movingChunks = 0;
    let maxTranslationDelta = 0;
    let invalidMatrices = 0;
    for (const chunk of chunks) {
      if (!Number.isInteger(chunk.nodeIndex) || !runtime.worldMatrices[chunk.nodeIndex]) continue;
      if (!matrixElementsAreFinite(runtime.worldMatrices[chunk.nodeIndex].elements)) invalidMatrices += 1;
      const inverseBindMatrix = new Matrix4().fromArray(chunk.inverseBindMatrix);
      const deltaMatrix = new Matrix4().multiplyMatrices(runtime.worldMatrices[chunk.nodeIndex], inverseBindMatrix);
      const delta = matrixMotion(deltaMatrix);
      if (delta.motion > 0.002) movingChunks += 1;
      maxTranslationDelta = Math.max(maxTranslationDelta, delta.translation);
    }

    if (invalidMatrices > 0) {
      errors.push(`${asset.key}/${action}: ${invalidMatrices} sampled matrices contain non-finite values.`);
    }

    const movingRatio = chunks.length > 0 ? movingChunks / chunks.length : 0;
    if ((action === "move" || action === "attack_strike") && movingRatio < 0.6) {
      warnings.push(`${asset.key}/${action}: only ${formatPercent(movingRatio)} of chunks move; verify hierarchy ownership.`);
    }

    const maxReasonableDelta = Math.max(
      4,
      vectorLength(geometry.bounds?.size ?? [1, 1, 1]) * (asset.key === "hp_enemy_repair_drone_horror" ? 5.4 : 2.4),
    );
    if (maxTranslationDelta > maxReasonableDelta) {
      warnings.push(
        `${asset.key}/${action}: max chunk translation delta ${round(maxTranslationDelta)} exceeds expected ${round(maxReasonableDelta)}.`,
      );
    }

    rows.push({
      asset: asset.key,
      action,
      clip: sample.clip.name,
      chunks: chunks.length,
      movingChunks,
      movingRatio,
      maxTranslationDelta,
    });
  }
}

console.log(`[HumanProtocol] Raw WebGPU robot animation QA for ${levelId}`);
console.log(`  assets=${bridge.assets?.length ?? 0}`);
console.log(`  sampledActions=${sampledActions.join(", ")}`);
for (const row of rows) {
  console.log(
    `  - ${row.asset}/${row.action}: clip=${row.clip}, chunks=${row.chunks}, moving=${row.movingChunks} ` +
      `(${formatPercent(row.movingRatio)}), maxDelta=${round(row.maxTranslationDelta)}`,
  );
}
if (appendageReports.length > 0) {
  console.log("\nAppendage override report:");
  for (const report of appendageReports) console.log(`  - ${report}`);
}

if (warnings.length > 0) {
  console.warn("\nWarnings:");
  for (const warning of warnings) console.warn(`  - ${warning}`);
}

if (errors.length > 0) {
  console.error("\nErrors:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log("\n[HumanProtocol] Raw WebGPU robot animation QA passed.");
}

function createRuntimeAsset(asset) {
  const nodes = asset.nodes ?? [];
  const nodeCount = Math.max(0, ...nodes.map((node) => node.index + 1));
  if (nodeCount <= 0) return null;

  const parents = Array.from({ length: nodeCount }, () => null);
  const nodeNames = Array.from({ length: nodeCount }, () => null);
  const baseTranslations = Array.from({ length: nodeCount }, () => new Vector3());
  const baseRotations = Array.from({ length: nodeCount }, () => new Quaternion());
  const baseScales = Array.from({ length: nodeCount }, () => new Vector3(1, 1, 1));
  const translations = Array.from({ length: nodeCount }, () => new Vector3());
  const rotations = Array.from({ length: nodeCount }, () => new Quaternion());
  const scales = Array.from({ length: nodeCount }, () => new Vector3(1, 1, 1));
  const localMatrices = Array.from({ length: nodeCount }, () => new Matrix4());
  const worldMatrices = Array.from({ length: nodeCount }, () => new Matrix4());
  const visited = new Uint8Array(nodeCount);
  const scratchMatrix = new Matrix4();

  for (const node of nodes) {
    const nodeIndex = node.index;
    if (nodeIndex < 0 || nodeIndex >= nodeCount) continue;
    nodeNames[nodeIndex] = node.name ?? null;
    parents[nodeIndex] = Number.isInteger(node.parent) ? node.parent : null;
    if (node.matrix?.length === 16) {
      scratchMatrix.fromArray(node.matrix);
      scratchMatrix.decompose(baseTranslations[nodeIndex], baseRotations[nodeIndex], baseScales[nodeIndex]);
    } else {
      baseTranslations[nodeIndex].fromArray(vecArray(node.translation, [0, 0, 0]));
      baseRotations[nodeIndex].fromArray(vecArray(node.rotation, [0, 0, 0, 1])).normalize();
      baseScales[nodeIndex].fromArray(vecArray(node.scale, [1, 1, 1]));
    }
  }

  const clipsByAction = new Map();
  for (const clip of asset.clips ?? []) {
    const action = clip.action || normalizeClipAction(clip.name);
    if (!clipsByAction.has(action)) clipsByAction.set(action, clip);
  }

  return {
    asset,
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
    visited,
    clipsByAction,
  };
}

function sampleRuntimeAsset(runtime, action, timeSeconds, loop) {
  const clip = runtime.clipsByAction.get(action) ?? runtime.clipsByAction.get("idle") ?? runtime.asset.clips?.[0];
  if (!clip) return null;
  const duration = Math.max(0.001, clip.durationSeconds ?? 0);
  const clipTime = loop ? positiveModulo(timeSeconds, duration) : clamp(timeSeconds, 0, duration);

  for (let index = 0; index < runtime.localMatrices.length; index += 1) {
    runtime.translations[index].copy(runtime.baseTranslations[index]);
    runtime.rotations[index].copy(runtime.baseRotations[index]);
    runtime.scales[index].copy(runtime.baseScales[index]);
    runtime.visited[index] = 0;
  }

  for (const channel of clip.channels ?? []) {
    const nodeIndex = channel.targetNode;
    if (nodeIndex < 0 || nodeIndex >= runtime.localMatrices.length) continue;
    if (channel.path === "translation") {
      sampleVec3Channel(channel, clipTime, runtime.translations[nodeIndex]);
    } else if (channel.path === "rotation") {
      sampleQuaternionChannel(channel, clipTime, runtime.rotations[nodeIndex]);
    } else if (channel.path === "scale") {
      sampleVec3Channel(channel, clipTime, runtime.scales[nodeIndex]);
    }
  }

  applyRawRobotReadabilityOverrides(runtime);

  for (let index = 0; index < runtime.localMatrices.length; index += 1) {
    runtime.localMatrices[index].compose(runtime.translations[index], runtime.rotations[index], runtime.scales[index]);
  }

  for (let index = 0; index < runtime.localMatrices.length; index += 1) composeWorldNode(runtime, index);
  return { clip };
}

function applyRawRobotReadabilityOverrides(runtime) {
  if (usesAuthoredRawEnemyRig(runtime.asset.key)) return;

  if (runtime.asset.key === "hp_enemy_repair_drone_horror") {
    for (let index = 0; index < runtime.scales.length; index += 1) {
      const exact = enemyExactNodeScaleOverride(runtime.nodeNames[index], runtime.asset.key);
      if (exact) applyScaleLimit(runtime.scales[index], exact);
      const family = enemyAppendageFamily(runtime.nodeNames[index]);
      if (family === "arm") {
        setScaleFloor(runtime.scales[index], 0.24, 0.23, 0.28);
      } else if (family === "forearm") {
        setScaleFloor(runtime.scales[index], 0.25, 0.25, 0.38);
      } else if (family === "hand") {
        setScaleFloor(runtime.scales[index], 0.32, 0.3, 0.32);
      } else if (family === "tool") {
        setScaleCeiling(runtime.scales[index], 0.22, 0.18, 0.22);
      }
    }
    return;
  }

  if (runtime.asset.key === "hp_enemy_clamp_repair_horror") {
    clampEnemyUtilityAppendages(runtime, {
      hand: [0.86, 0.78, 0.7],
      arm: [1.14, 1.04, 0.82],
      forearm: [1.12, 1.02, 0.82],
      tool: [0.82, 0.72, 0.62],
    });
    return;
  }
}

function appendageScaleFailures(runtime) {
  const failures = [];
  for (let index = 0; index < runtime.scales.length; index += 1) {
    const exact = enemyExactNodeScaleOverride(runtime.nodeNames[index], runtime.asset.key);
    if (exact) applyScaleLimit(runtime.scales[index], exact);
    const family = enemyAppendageFamily(runtime.nodeNames[index]);
    if (!family) continue;
    const scale = runtime.scales[index];
    const ceiling = appendageScaleCeiling(runtime.asset.key, family);
    if (ceiling && exceedsScale(scale, ceiling)) {
      failures.push(
        `${runtime.asset.key}: ${runtime.nodeNames[index]} ${family} scale ${formatScale(scale)} exceeds raw ceiling ${ceiling.join("x")}.`,
      );
    }
    const floor = appendageScaleFloor(runtime.asset.key, family);
    if (floor && belowScale(scale, floor)) {
      failures.push(
        `${runtime.asset.key}: ${runtime.nodeNames[index]} ${family} scale ${formatScale(scale)} below raw visibility floor ${floor.join("x")}.`,
      );
    }
  }
  return failures;
}

function rawBridgeAppendageScaleFailures(asset) {
  const failures = [];
  for (const node of asset.nodes ?? []) {
    const family = enemyAppendageFamily(node.name);
    if (!family) continue;
    const ceiling = appendageScaleCeiling(asset.key, family);
    if (ceiling && exceedsTupleScale(node.scale ?? [1, 1, 1], ceiling)) {
      failures.push(
        `${asset.key}: raw bridge node ${node.name} ${family} scale ${formatTupleScale(node.scale)} exceeds raw-readable ceiling ${ceiling.join("x")}.`,
      );
    }
    const floor = appendageScaleFloor(asset.key, family);
    if (floor && belowTupleScale(node.scale ?? [1, 1, 1], floor)) {
      failures.push(
        `${asset.key}: raw bridge node ${node.name} ${family} scale ${formatTupleScale(node.scale)} below raw-readable floor ${floor.join("x")}.`,
      );
    }
  }
  return failures;
}

function rawReadableAppendageOverrideRequired(assetKey) {
  return assetKey === "hp_enemy_repair_drone_horror" || assetKey === "hp_enemy_clamp_repair_horror";
}

function usesAuthoredRawEnemyRig(assetKey) {
  return (
    assetKey === "hp_enemy_shield_technician_horror" ||
    assetKey === "hp_enemy_custodian_foreman_horror" ||
    assetKey === "hp_enemy_reclamation_mother_final_horror"
  );
}

function appendageScaleReport(runtime) {
  const groups = new Map();
  for (let index = 0; index < runtime.scales.length; index += 1) {
    const family = enemyAppendageFamily(runtime.nodeNames[index]);
    if (!family) continue;
    const scale = runtime.scales[index];
    const current = groups.get(family) ?? { count: 0, max: [0, 0, 0], min: [Infinity, Infinity, Infinity] };
    current.count += 1;
    current.max = [
      Math.max(current.max[0], scale.x),
      Math.max(current.max[1], scale.y),
      Math.max(current.max[2], scale.z),
    ];
    current.min = [
      Math.min(current.min[0], scale.x),
      Math.min(current.min[1], scale.y),
      Math.min(current.min[2], scale.z),
    ];
    groups.set(family, current);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, value]) => `${family} count=${value.count} max=${value.max.map((item) => round(item)).join("x")}`);
}

function enemyAppendageFamily(name) {
  const normalized = String(name ?? "").toLowerCase().replace(/[^a-z0-9]/gu, "");
  if (!normalized) return null;
  if (/utilityhand|parthand|lefthand|righthand/.test(normalized)) return "hand";
  if (/partforearm/.test(normalized)) return "forearm";
  if (/partarm|upperarm/.test(normalized)) return "arm";
  if (/servicecutter|rescuebaton|utilitywrench|stunprobe|cutter|wrench|baton|probe/.test(normalized)) return "tool";
  return null;
}

function clampEnemyUtilityAppendages(runtime, limits) {
  for (let index = 0; index < runtime.scales.length; index += 1) {
    const family = enemyAppendageFamily(runtime.nodeNames[index]);
    if (family === "hand") {
      setScaleCeilingVector(runtime.scales[index], limits.hand);
    } else if (family === "arm") {
      setScaleCeilingVector(runtime.scales[index], limits.arm);
    } else if (family === "forearm") {
      setScaleCeilingVector(runtime.scales[index], limits.forearm);
    } else if (family === "tool") {
      setScaleCeilingVector(runtime.scales[index], limits.tool);
    }
  }
}

function appendageScaleCeiling(assetKey, family) {
  if (assetKey === "hp_enemy_repair_drone_horror") return family === "tool" ? [0.22, 0.18, 0.22] : null;
  if (assetKey === "hp_enemy_clamp_repair_horror") {
    return {
      hand: [0.86, 0.78, 0.7],
      arm: [1.14, 1.04, 0.82],
      forearm: [1.12, 1.02, 0.82],
      tool: [0.82, 0.72, 0.62],
    }[family] ?? null;
  }
  return null;
}

function appendageScaleFloor(assetKey, family) {
  if (assetKey !== "hp_enemy_repair_drone_horror") return null;
  return {
    hand: [0.32, 0.3, 0.32],
    arm: [0.24, 0.23, 0.28],
    forearm: [0.25, 0.25, 0.38],
  }[family] ?? null;
}

function enemyExactNodeScaleOverride(name, assetKey) {
  const normalized = String(name ?? "").toLowerCase().replace(/[^a-z0-9]/gu, "");
  if (!normalized) return null;
  if (assetKey === "hp_enemy_repair_drone_horror") {
    if (normalized === "mesh52" || normalized === "mesh66") return { ceiling: [0.08, 0.05, 0.08] };
    if (normalized === "mesh53") return { floor: [1.55, 1.35, 1.55] };
    if (normalized === "mesh54") return { floor: [2.1, 1.75, 2.1] };
    if (normalized === "mesh67") return { floor: [1.35, 1.35, 1.35] };
    return null;
  }
  if (
    assetKey === "hp_enemy_clamp_repair_horror" &&
    (normalized === "leftclamplower" ||
      normalized === "mesh97" ||
      normalized === "mesh98" ||
      normalized === "mesh100" ||
      normalized === "mesh122" ||
      normalized === "mesh123" ||
      normalized === "mesh124" ||
      normalized === "mesh126")
  ) {
    return { ceiling: [0.075, 0.055, 0.075] };
  }
  return null;
}

function applyScaleLimit(scale, limit) {
  if (limit.floor) setScaleFloor(scale, limit.floor[0], limit.floor[1], limit.floor[2]);
  if (limit.ceiling) setScaleCeiling(scale, limit.ceiling[0], limit.ceiling[1], limit.ceiling[2]);
}

function setScaleFloor(scale, x, y, z) {
  scale.set(Math.max(scale.x, x), Math.max(scale.y, y), Math.max(scale.z, z));
}

function setScaleCeiling(scale, x, y, z) {
  scale.set(Math.min(scale.x, x), Math.min(scale.y, y), Math.min(scale.z, z));
}

function setScaleCeilingVector(scale, ceiling) {
  setScaleCeiling(scale, ceiling[0], ceiling[1], ceiling[2]);
}

function exceedsScale(scale, ceiling) {
  return scale.x > ceiling[0] + 0.001 || scale.y > ceiling[1] + 0.001 || scale.z > ceiling[2] + 0.001;
}

function belowScale(scale, floor) {
  return scale.x < floor[0] - 0.001 || scale.y < floor[1] - 0.001 || scale.z < floor[2] - 0.001;
}

function formatScale(scale) {
  return `${round(scale.x)}x${round(scale.y)}x${round(scale.z)}`;
}

function exceedsTupleScale(scale, ceiling) {
  return Number(scale[0] ?? 1) > ceiling[0] + 0.001 || Number(scale[1] ?? 1) > ceiling[1] + 0.001 || Number(scale[2] ?? 1) > ceiling[2] + 0.001;
}

function belowTupleScale(scale, floor) {
  return Number(scale[0] ?? 1) < floor[0] - 0.001 || Number(scale[1] ?? 1) < floor[1] - 0.001 || Number(scale[2] ?? 1) < floor[2] - 0.001;
}

function formatTupleScale(scale) {
  return `${round(scale?.[0] ?? 1)}x${round(scale?.[1] ?? 1)}x${round(scale?.[2] ?? 1)}`;
}

function composeWorldNode(runtime, nodeIndex) {
  if (runtime.visited[nodeIndex]) return;
  const parent = runtime.parents[nodeIndex];
  if (parent !== null && parent >= 0 && parent < runtime.localMatrices.length) {
    composeWorldNode(runtime, parent);
    runtime.worldMatrices[nodeIndex].multiplyMatrices(runtime.worldMatrices[parent], runtime.localMatrices[nodeIndex]);
  } else {
    runtime.worldMatrices[nodeIndex].copy(runtime.localMatrices[nodeIndex]);
  }
  runtime.visited[nodeIndex] = 1;
}

function sampleVec3Channel(channel, timeSeconds, out) {
  const times = channel.times ?? [];
  const values = channel.values ?? [];
  if (times.length <= 0 || values.length < 3) return;
  const frame = sampleFrame(times, timeSeconds);
  const offset = frame.index * 3;
  const first = new Vector3(values[offset] ?? out.x, values[offset + 1] ?? out.y, values[offset + 2] ?? out.z);
  if (frame.alpha <= 0 || frame.index >= times.length - 1) {
    out.copy(first);
    return;
  }
  const nextOffset = (frame.index + 1) * 3;
  const second = new Vector3(values[nextOffset] ?? first.x, values[nextOffset + 1] ?? first.y, values[nextOffset + 2] ?? first.z);
  out.copy(first).lerp(second, frame.alpha);
}

function sampleQuaternionChannel(channel, timeSeconds, out) {
  const times = channel.times ?? [];
  const values = channel.values ?? [];
  if (times.length <= 0 || values.length < 4) return;
  const frame = sampleFrame(times, timeSeconds);
  const offset = frame.index * 4;
  const first = new Quaternion(
    values[offset] ?? out.x,
    values[offset + 1] ?? out.y,
    values[offset + 2] ?? out.z,
    values[offset + 3] ?? out.w,
  ).normalize();
  if (frame.alpha <= 0 || frame.index >= times.length - 1) {
    out.copy(first);
    return;
  }
  const nextOffset = (frame.index + 1) * 4;
  const second = new Quaternion(
    values[nextOffset] ?? first.x,
    values[nextOffset + 1] ?? first.y,
    values[nextOffset + 2] ?? first.z,
    values[nextOffset + 3] ?? first.w,
  ).normalize();
  out.slerpQuaternions(first, second, frame.alpha).normalize();
}

function sampleFrame(times, timeSeconds) {
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

function matrixMotion(matrix) {
  const elements = matrix.elements;
  const translation = Math.hypot(elements[12], elements[13], elements[14]);
  const rotationTrace = elements[0] + elements[5] + elements[10];
  const rotationMotion = Math.abs(3 - rotationTrace);
  return { translation, motion: translation + rotationMotion * 0.25 };
}

function matrixElementsAreFinite(elements) {
  return elements.every((value) => Number.isFinite(value));
}

function sampleTimeFor(action) {
  if (action === "idle") return 0.58;
  if (action === "move") return 0.4;
  if (action === "attack_strike") return 0.16;
  if (action === "spawn_boot") return 0.3;
  return 0.2;
}

function normalizeClipAction(name) {
  return String(name)
    .replace(/\.\d+$/gu, "")
    .replace(/[^a-zA-Z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toLowerCase() || "clip";
}

function vecArray(input, fallback) {
  return input && input.length >= fallback.length ? input : fallback;
}

function vectorLength(values) {
  return Math.hypot(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Number(Number(value).toFixed(3));
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function readArg(name) {
  const inlinePrefix = `${name}=`;
  const inlineValue = process.argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inlineValue) return inlineValue.slice(inlinePrefix.length);
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
