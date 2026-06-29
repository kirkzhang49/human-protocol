import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { gameBalance } from "../../game/config/gameBalance";
import type { GameWorld } from "../../game/core/GameWorld";
import type { EffectState, EffectType } from "../../game/entities/EntityTypes";
import { weaponSkins } from "../../game/skins/weaponSkins";

const FORWARD = new Vector3(0, 0, 1);
const WHITE = new Color("#ffffff");
const MUZZLE_CORE = new Color("#fff1b8");
const HIT_SPARK = new Color("#ffb43d");
const HIT_GLINT = new Color("#ff7f42");
const ARMOR_SPARK = new Color("#ffd98a");
const ARMOR_GLINT = new Color("#fff7cf");
const CORE_SPARK = new Color("#bff8ff");
const CORE_GLINT = new Color("#ffffff");
const BREACH_TRAIL = new Color("#57fbff");
const BREACH_PIERCE = new Color("#e7fff2");
const BREACH_SHOCK = new Color("#77efff");
const DASH_SPARK = new Color("#64d7ff");
const DASH_GLINT = new Color("#8ef6ff");
const STAGGER_SPARK = new Color("#ffe074");
const STAGGER_GLINT = new Color("#89f4ff");
const DANGER_FAN = new Color("#ff3428");
const DANGER_EDGE = new Color("#ffd06a");
const BLADE_A = new Color("#d6f6ff");
const BLADE_B = new Color("#dff8ff");
const BLADE_C = new Color("#91d8e6");
const BLADE_D = new Color("#9fe2ed");
const SHOCK_RING = new Color("#73f1ff");
const SHOCK_CORE = new Color("#ffd66d");

interface BatchedEffectsProps {
  world: GameWorld;
}

interface PartSpec {
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
  color: Color;
  alpha: number;
}

type SparkEffectType = Extract<EffectType, "hitSpark" | "armorSpark" | "coreSpark" | "breachTrail" | "breachPierce" | "breachShock" | "dashBurst" | "staggerBurst">;

interface SparkVariant {
  sparkColor: Color;
  glintColor: Color;
  yOffset: number;
  sparkAlpha: number;
  glintAlpha: number;
  maxCapacity: number;
}

export function BatchedEffects({ world }: BatchedEffectsProps) {
  return (
    <>
      <BatchedMuzzleFlashes world={world} />
      <BatchedBladeSlashes world={world} />
      <BatchedHitSparks world={world} effectType="hitSpark" />
      <BatchedHitSparks world={world} effectType="armorSpark" />
      <BatchedHitSparks world={world} effectType="coreSpark" />
      <BatchedHitSparks world={world} effectType="breachTrail" />
      <BatchedHitSparks world={world} effectType="breachPierce" />
      <BatchedHitSparks world={world} effectType="breachShock" />
      <BatchedHitSparks world={world} effectType="dashBurst" />
      <BatchedHitSparks world={world} effectType="staggerBurst" />
      <BatchedDangerTelegraphs world={world} />
      <BatchedShockwaves world={world} />
    </>
  );
}

function BatchedMuzzleFlashes({ world }: BatchedEffectsProps) {
  const coneRef = useRef<InstancedMesh>(null);
  const orbRef = useRef<InstancedMesh>(null);
  const scratch = useInstancedScratch();
  const conePart = useMemo<PartSpec>(() => ({ rotation: [Math.PI / 2, 0, 0], color: WHITE, alpha: 1 }), []);
  const orbPart = useMemo<PartSpec>(() => ({ color: MUZZLE_CORE, alpha: 0.8 }), []);

  useFrame(() => {
    const cone = coneRef.current;
    const orb = orbRef.current;
    if (!cone || !orb) return;
    ensureInstanceAlpha(cone, gameBalance.effectPoolSize);
    ensureInstanceAlpha(orb, gameBalance.effectPoolSize);

    const maxCount = Math.min(gameBalance.effectPoolSize, world.renderPerformance.quality.effectPoolSize);
    let count = 0;
    for (const effect of world.effects) {
      if (effect.type !== "muzzleFlash" || count >= maxCount) continue;
      const progress = effect.age / effect.lifetime;
      const fade = Math.max(0, 1 - progress);
      const skin = weaponSkins[world.player.currentWeapon];
      const scale = effect.intensity * (0.24 + progress * 0.28);
      scratch.quaternion.setFromUnitVectors(FORWARD, effect.direction);
      scratch.root.position.copy(effect.position);
      scratch.root.quaternion.copy(scratch.quaternion);
      scratch.root.scale.setScalar(scale);
      scratch.root.updateMatrix();

      scratch.color.set(skin.muzzleColor);
      writePartInstance(cone, count, conePart, scratch, scratch.color, fade * 0.72);
      writePartInstance(orb, count, orbPart, scratch, MUZZLE_CORE, fade * 0.8);
      count += 1;
    }
    finishMesh(cone, count);
    finishMesh(orb, count);
  });

  return (
    <>
      <instancedMesh ref={coneRef} args={[undefined, undefined, gameBalance.effectPoolSize]}>
        <coneGeometry args={[0.18, 0.42, 18]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={orbRef} args={[undefined, undefined, gameBalance.effectPoolSize]}>
        <sphereGeometry args={[0.09, 16, 10]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function BatchedBladeSlashes({ world }: BatchedEffectsProps) {
  const partARef = useRef<InstancedMesh>(null);
  const partBRef = useRef<InstancedMesh>(null);
  const partCRef = useRef<InstancedMesh>(null);
  const partDRef = useRef<InstancedMesh>(null);
  const scratch = useInstancedScratch();
  const parts = useMemo(
    () => [
      { position: [0.2, 0.26, 0], rotation: [0, 0, 0.34], scale: [1.15, 0.055, 0.035], color: BLADE_A, alpha: 0.52 },
      { position: [-0.06, 0.02, 0.02], rotation: [0, 0, 0.22], scale: [0.86, 0.034, 0.028], color: BLADE_B, alpha: 0.72 },
      { position: [0.42, -0.1, -0.02], rotation: [0, 0, 0.12], scale: [0.42, 0.025, 0.025], color: BLADE_C, alpha: 0.44 },
      { position: [-0.28, -0.18, 0.02], rotation: [0, 0, 0.58], scale: [0.24, 0.018, 0.018], color: BLADE_D, alpha: 0.22 },
    ] satisfies PartSpec[],
    [],
  );

  useFrame(() => {
    const meshes = [partARef.current, partBRef.current, partCRef.current, partDRef.current];
    if (meshes.some((mesh) => !mesh)) return;
    for (const mesh of meshes) ensureInstanceAlpha(mesh!, gameBalance.effectPoolSize);

    const maxCount = Math.min(gameBalance.effectPoolSize, world.renderPerformance.quality.effectPoolSize);
    let count = 0;
    for (const effect of world.effects) {
      if (effect.type !== "bladeSlash" || count >= maxCount) continue;
      const progress = effect.age / effect.lifetime;
      const fade = Math.max(0, 1 - progress);
      scratch.quaternion.setFromUnitVectors(FORWARD, effect.direction);
      scratch.root.position.copy(effect.position).addScaledVector(effect.direction, 1.38);
      scratch.root.position.y += 1.18;
      scratch.root.quaternion.copy(scratch.quaternion);
      scratch.root.rotateZ(-0.52 + progress * 0.28);
      scratch.root.scale.setScalar(effect.intensity * (0.62 + progress * 0.12));
      scratch.root.updateMatrix();
      parts.forEach((part, partIndex) => writePartInstance(meshes[partIndex]!, count, part, scratch, part.color, fade * part.alpha));
      count += 1;
    }
    for (const mesh of meshes) finishMesh(mesh!, count);
  });

  return (
    <>
      {[partARef, partBRef, partCRef, partDRef].map((ref, index) => (
        <instancedMesh key={index} ref={ref} args={[undefined, undefined, gameBalance.effectPoolSize]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#ffffff" vertexColors transparent opacity={1} depthWrite={false} toneMapped={false} side={DoubleSide} />
        </instancedMesh>
      ))}
    </>
  );
}

function BatchedHitSparks({ world, effectType }: BatchedEffectsProps & { effectType: SparkEffectType }) {
  const sparkRef = useRef<InstancedMesh>(null);
  const glintRef = useRef<InstancedMesh>(null);
  const scratch = useInstancedScratch();
  const variant = sparkVariant(effectType);
  const { sparkColor, glintColor, yOffset, sparkAlpha, glintAlpha, maxCapacity } = variant;
  const sparkPart = useMemo<PartSpec>(() => ({ rotation: [0, 0, Math.PI / 4], color: sparkColor, alpha: sparkAlpha }), [sparkAlpha, sparkColor]);
  const glintPart = useMemo<PartSpec>(() => ({ rotation: [0, Math.PI / 2, 0], color: glintColor, alpha: glintAlpha }), [glintAlpha, glintColor]);

  useFrame(() => {
    const spark = sparkRef.current;
    const glint = glintRef.current;
    if (!spark || !glint) return;
    ensureInstanceAlpha(spark, maxCapacity);
    ensureInstanceAlpha(glint, maxCapacity);

    const maxCount = Math.min(maxCapacity, world.renderPerformance.quality.effectPoolSize);
    let count = 0;
    for (const effect of world.effects) {
      if (effect.type !== effectType || count >= maxCount) continue;
      const progress = effect.age / effect.lifetime;
      const fade = Math.max(0, 1 - progress);
      scratch.quaternion.setFromUnitVectors(FORWARD, effect.direction);
      scratch.root.position.copy(effect.position);
      scratch.root.position.y += yOffset;
      scratch.root.quaternion.copy(scratch.quaternion);
      scratch.root.scale.setScalar(effect.intensity * (0.74 + progress * 2.35));
      scratch.root.updateMatrix();
      writePartInstance(spark, count, sparkPart, scratch, sparkColor, fade * sparkAlpha);
      writePartInstance(glint, count, glintPart, scratch, glintColor, fade * glintAlpha);
      count += 1;
    }
    finishMesh(spark, count);
    finishMesh(glint, count);
  });

  return (
    <>
      <instancedMesh ref={sparkRef} args={[undefined, undefined, maxCapacity]}>
        <boxGeometry args={[0.105, 0.105, 1.38]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glintRef} args={[undefined, undefined, maxCapacity]}>
        <boxGeometry args={[0.048, 0.048, 0.66]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function sparkVariant(effectType: SparkEffectType): SparkVariant {
  if (effectType === "dashBurst") {
    return {
      sparkColor: DASH_SPARK,
      glintColor: DASH_GLINT,
      yOffset: 0.35,
      sparkAlpha: 0.68,
      glintAlpha: 0.26,
      maxCapacity: Math.min(12, gameBalance.effectPoolSize),
    };
  }
  if (effectType === "breachTrail") {
    return {
      sparkColor: BREACH_TRAIL,
      glintColor: CORE_GLINT,
      yOffset: 0.38,
      sparkAlpha: 0.62,
      glintAlpha: 0.3,
      maxCapacity: Math.min(18, gameBalance.effectPoolSize),
    };
  }
  if (effectType === "breachPierce") {
    return {
      sparkColor: BREACH_PIERCE,
      glintColor: BREACH_TRAIL,
      yOffset: 0.42,
      sparkAlpha: 0.86,
      glintAlpha: 0.56,
      maxCapacity: Math.min(18, gameBalance.effectPoolSize),
    };
  }
  if (effectType === "breachShock") {
    return {
      sparkColor: BREACH_SHOCK,
      glintColor: CORE_GLINT,
      yOffset: 0.3,
      sparkAlpha: 0.74,
      glintAlpha: 0.34,
      maxCapacity: Math.min(10, gameBalance.effectPoolSize),
    };
  }
  if (effectType === "armorSpark") {
    return {
      sparkColor: ARMOR_SPARK,
      glintColor: ARMOR_GLINT,
      yOffset: 0.32,
      sparkAlpha: 0.78,
      glintAlpha: 0.38,
      maxCapacity: gameBalance.effectPoolSize,
    };
  }
  if (effectType === "staggerBurst") {
    return {
      sparkColor: STAGGER_SPARK,
      glintColor: STAGGER_GLINT,
      yOffset: 0.46,
      sparkAlpha: 0.82,
      glintAlpha: 0.42,
      maxCapacity: Math.min(10, gameBalance.effectPoolSize),
    };
  }
  if (effectType === "coreSpark") {
    return {
      sparkColor: CORE_SPARK,
      glintColor: CORE_GLINT,
      yOffset: 0.5,
      sparkAlpha: 0.84,
      glintAlpha: 0.5,
      maxCapacity: gameBalance.effectPoolSize,
    };
  }
  return {
    sparkColor: HIT_SPARK,
    glintColor: HIT_GLINT,
    yOffset: 0.18,
    sparkAlpha: 0.72,
    glintAlpha: 0.32,
    maxCapacity: gameBalance.effectPoolSize,
  };
}

function BatchedDangerTelegraphs({ world }: BatchedEffectsProps) {
  const fillRef = useRef<InstancedMesh>(null);
  const edgeRef = useRef<InstancedMesh>(null);
  const scratch = useInstancedScratch();
  const fillPart = useMemo<PartSpec>(() => ({ rotation: [-Math.PI / 2, 0, 0], color: DANGER_FAN, alpha: 0.52 }), []);
  const edgePart = useMemo<PartSpec>(() => ({ rotation: [-Math.PI / 2, 0, 0], color: DANGER_EDGE, alpha: 0.9 }), []);
  const side = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const fill = fillRef.current;
    const edge = edgeRef.current;
    if (!fill || !edge) return;
    ensureInstanceAlpha(fill, gameBalance.effectPoolSize);
    ensureInstanceAlpha(edge, gameBalance.effectPoolSize);

    const maxCount = Math.min(Math.floor(gameBalance.effectPoolSize / 3), Math.floor(world.renderPerformance.quality.effectPoolSize / 3));
    let count = 0;
    for (const effect of world.effects) {
      if (effect.type !== "dangerTelegraph" || count >= maxCount) continue;
      const progress = Math.max(0, Math.min(1, effect.age / Math.max(0.001, effect.lifetime)));
      const pulse = 0.74 + Math.sin(progress * Math.PI * 5) * 0.2;
      const fade = Math.max(0, 1 - progress * 0.18);
      const length = effect.intensity * (1.32 + progress * 0.08);
      const width = effect.intensity * (0.34 + progress * 0.22);
      side.set(-effect.direction.z, 0, effect.direction.x);
      if (side.lengthSq() < 0.001) side.set(1, 0, 0);
      side.normalize();

      scratch.quaternion.setFromUnitVectors(FORWARD, effect.direction);
      scratch.root.position.copy(effect.position).addScaledVector(effect.direction, length * 0.5 + 0.25);
      scratch.root.position.y += 0.045;
      scratch.root.quaternion.copy(scratch.quaternion);
      scratch.root.scale.set(length, Math.max(0.32, width), 1);
      scratch.root.updateMatrix();
      writePartInstance(fill, count, fillPart, scratch, DANGER_FAN, fade * fillPart.alpha * pulse);
      writePartInstance(edge, count, edgePart, scratch, DANGER_EDGE, fade * edgePart.alpha * pulse);
      count += 1;

      for (const edgeSide of [-1, 1] as const) {
        if (count >= maxCount) break;
        scratch.root.position.copy(effect.position)
          .addScaledVector(effect.direction, length * 0.48 + 0.26)
          .addScaledVector(side, edgeSide * width * 0.92);
        scratch.root.position.y += 0.052;
        scratch.root.quaternion.copy(scratch.quaternion);
        scratch.root.rotateY(edgeSide * 0.22);
        scratch.root.scale.set(length * 0.92, 0.045, 1);
        scratch.root.updateMatrix();
        writePartInstance(edge, count, edgePart, scratch, DANGER_EDGE, fade * 0.96);
        writePartInstance(fill, count, fillPart, scratch, DANGER_FAN, 0);
        count += 1;
      }
    }
    finishMesh(fill, count);
    finishMesh(edge, count);
  });

  return (
    <>
      <instancedMesh ref={fillRef} args={[undefined, undefined, gameBalance.effectPoolSize]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={edgeRef} args={[undefined, undefined, gameBalance.effectPoolSize]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </instancedMesh>
    </>
  );
}

function BatchedShockwaves({ world }: BatchedEffectsProps) {
  const ringRef = useRef<InstancedMesh>(null);
  const coreRef = useRef<InstancedMesh>(null);
  const scratch = useInstancedScratch();
  const ringPart = useMemo<PartSpec>(() => ({ rotation: [-Math.PI / 2, 0, 0], color: SHOCK_RING, alpha: 0.42 }), []);
  const corePart = useMemo<PartSpec>(() => ({ rotation: [-Math.PI / 2, 0, 0], color: SHOCK_CORE, alpha: 0.18 }), []);

  useFrame(() => {
    const ring = ringRef.current;
    const core = coreRef.current;
    if (!ring || !core) return;
    ensureInstanceAlpha(ring, gameBalance.effectPoolSize);
    ensureInstanceAlpha(core, gameBalance.effectPoolSize);

    const maxCount = Math.min(gameBalance.effectPoolSize, world.renderPerformance.quality.effectPoolSize);
    let count = 0;
    for (const effect of world.effects) {
      if (effect.type !== "shockwave" || count >= maxCount) continue;
      const progress = effect.age / effect.lifetime;
      const fade = Math.max(0, 1 - progress);
      scratch.root.position.copy(effect.position);
      scratch.root.position.y += 0.055;
      scratch.root.rotation.set(0, 0, 0);
      scratch.root.quaternion.identity();
      scratch.root.scale.setScalar(effect.intensity * (0.74 + progress * 2.35));
      scratch.root.updateMatrix();
      writePartInstance(ring, count, ringPart, scratch, SHOCK_RING, fade * (0.46 + progress * 0.16));

      scratch.root.scale.setScalar(effect.intensity * (0.42 + progress * 1.28));
      scratch.root.updateMatrix();
      writePartInstance(core, count, corePart, scratch, SHOCK_CORE, fade * 0.2);
      count += 1;
    }
    finishMesh(ring, count);
    finishMesh(core, count);
  });

  return (
    <>
      <instancedMesh ref={ringRef} args={[undefined, undefined, gameBalance.effectPoolSize]}>
        <torusGeometry args={[0.64, 0.018, 8, 72]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={coreRef} args={[undefined, undefined, gameBalance.effectPoolSize]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </instancedMesh>
    </>
  );
}

function useInstancedScratch() {
  return useMemo(
    () => ({
      root: new Object3D(),
      local: new Object3D(),
      quaternion: new Quaternion(),
      matrix: new Matrix4(),
      color: new Color(),
    }),
    [],
  );
}

function writePartInstance(mesh: InstancedMesh, index: number, part: PartSpec, scratch: ReturnType<typeof useInstancedScratch>, color: Color, alpha: number) {
  const { local } = scratch;
  local.position.fromArray(part.position ?? [0, 0, 0]);
  local.rotation.set(...(part.rotation ?? [0, 0, 0]));
  local.scale.fromArray(part.scale ?? [1, 1, 1]);
  local.updateMatrix();
  scratch.matrix.multiplyMatrices(scratch.root.matrix, local.matrix);
  mesh.setMatrixAt(index, scratch.matrix);
  if (markInstanceColorDirty(mesh, index, color.getHex())) {
    mesh.setColorAt(index, color);
  }
  setInstanceAlpha(mesh, index, alpha);
}

function markInstanceColorDirty(mesh: InstancedMesh, index: number, colorKey: number) {
  const userData = mesh.userData as {
    hpEffectColorKeys?: Int32Array;
    hpEffectColorDirty?: boolean;
  };
  const capacity = mesh.instanceMatrix.count;
  if (!userData.hpEffectColorKeys || userData.hpEffectColorKeys.length < capacity) {
    userData.hpEffectColorKeys = new Int32Array(capacity).fill(-1);
  }
  if (mesh.instanceColor && userData.hpEffectColorKeys[index] === colorKey) return false;
  userData.hpEffectColorKeys[index] = colorKey;
  userData.hpEffectColorDirty = true;
  return true;
}

function ensureInstanceAlpha(mesh: InstancedMesh, capacity: number) {
  if (!mesh.geometry.getAttribute("instanceAlpha")) {
    mesh.geometry.setAttribute("instanceAlpha", new InstancedBufferAttribute(new Float32Array(capacity), 1));
  }
  const material = mesh.material as MeshBasicMaterial & { userData: { instanceAlphaPatched?: boolean } };
  if (material.userData.instanceAlphaPatched) return;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "attribute float instanceAlpha;\nvarying float vInstanceAlpha;\nvoid main() {")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vInstanceAlpha = instanceAlpha;");
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying float vInstanceAlpha;\nvoid main() {")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse, opacity * vInstanceAlpha );");
  };
  material.userData.instanceAlphaPatched = true;
  material.needsUpdate = true;
}

function setInstanceAlpha(mesh: InstancedMesh, index: number, alpha: number) {
  const attribute = mesh.geometry.getAttribute("instanceAlpha") as InstancedBufferAttribute | undefined;
  if (!attribute) return;
  attribute.setX(index, alpha);
}

function finishMesh(mesh: InstancedMesh, count: number) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  const userData = mesh.userData as {
    hpEffectColorKeys?: Int32Array;
    hpEffectColorDirty?: boolean;
    hpEffectLiveCount?: number;
  };
  const previousLiveCount = userData.hpEffectLiveCount ?? 0;
  if (userData.hpEffectColorKeys && count < previousLiveCount) {
    for (let index = count; index < previousLiveCount; index += 1) {
      userData.hpEffectColorKeys[index] = -1;
    }
  }
  userData.hpEffectLiveCount = count;
  if (mesh.instanceColor && userData.hpEffectColorDirty) {
    mesh.instanceColor.needsUpdate = true;
    userData.hpEffectColorDirty = false;
  }
  const alpha = mesh.geometry.getAttribute("instanceAlpha") as InstancedBufferAttribute | undefined;
  if (alpha) alpha.needsUpdate = true;
}
