import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type AnimationAction,
  type AnimationClip,
  type Material,
  type Object3D,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getLoadedEnemyModel, type EnemyModelKey } from "../../assets/enemyModelAssets";
import { enemyPremiumLightingPalette } from "../../game/visual/EnemyLightingPalette";

interface EnemyModelInstanceProps {
  modelKey: EnemyModelKey;
  targetHeight: number;
  rotation?: readonly [number, number, number];
  animationName?: string;
  animationNameRef?: MutableRefObject<string>;
  materialFinish?: EnemyMaterialFinish;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export type EnemyMaterialFinish = "default" | "matte" | "boss";

const oneShotAnimationNames = new Set(["attack_windup", "attack_strike", "attack_recover", "hit_light", "hit_heavy", "stagger", "death", "spawn_boot"]);
const proceduralPartNames = new Set([
  "spinePivot",
  "chestPivot",
  "pelvisPivot",
  "leftShoulderPivot",
  "rightShoulderPivot",
  "leftForearmTwist",
  "rightForearmTwist",
  "leftWristPivot",
  "rightWristPivot",
  "leftHipPivot",
  "rightHipPivot",
  "leftKneePivot",
  "rightKneePivot",
  "leftAnklePivot",
  "rightAnklePivot",
  "left_clamp_lower",
  "left_clamp_upper",
  "bladeBaseSocket",
  "bladeTipSocket",
]);

type ProceduralPart = {
  node: Object3D;
  rotation: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
};

type ProceduralRig = {
  root: ProceduralPart;
  parts: Map<string, ProceduralPart>;
};

export function EnemyModelInstance({
  modelKey,
  targetHeight,
  rotation = [0, 0, 0],
  animationName = "idle",
  animationNameRef,
  materialFinish = "default",
  castShadow = true,
  receiveShadow = true,
}: EnemyModelInstanceProps) {
  const loaded = getLoadedEnemyModel(modelKey);
  const actionRef = useRef<AnimationAction | null>(null);
  const activeAnimationNameRef = useRef<string | null>(null);
  const object = useMemo(() => {
    const clone = cloneSkeleton(loaded.scene) as Object3D;
    const normalization = targetHeight / Math.max(0.01, loaded.bounds.size.y);
    clone.position.set(
      -loaded.bounds.center.x * normalization,
      -loaded.bounds.min.y * normalization,
      -loaded.bounds.center.z * normalization,
    );
    clone.scale.setScalar(normalization);
    clone.traverse((child: Object3D) => {
      const mesh = child as Object3D & {
        isMesh?: boolean;
        castShadow?: boolean;
        receiveShadow?: boolean;
        frustumCulled?: boolean;
        material?: Material | Material[];
      };
      if (!mesh.isMesh) return;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.frustumCulled = false;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => cloneEnemyMaterial(material, modelKey, materialFinish));
      } else if (mesh.material) {
        mesh.material = cloneEnemyMaterial(mesh.material, modelKey, materialFinish);
      }
    });
    applyEnemyReadabilityOverrides(clone, modelKey);
    return clone;
  }, [castShadow, loaded, materialFinish, receiveShadow, targetHeight]);
  const mixer = useMemo(() => new AnimationMixer(object), [object]);
  const clipsByName = useMemo(() => {
    const clips = new Map<string, (typeof loaded.animations)[number]>();
    for (const clip of loaded.animations) {
      clips.set(clip.name, clip);
      clips.set(normalizeClipName(clip.name), clip);
    }
    return clips;
  }, [loaded.animations]);
  const proceduralRig = useMemo(() => collectProceduralRig(object), [object]);
  const hasBakedAnimation = loaded.animations.length > 0;
  const proceduralStateRef = useRef({ name: animationName, phaseAge: 0, time: 0 });

  useEffect(() => {
    return () => {
      actionRef.current?.stop();
      actionRef.current = null;
      activeAnimationNameRef.current = null;
    };
  }, [mixer]);

  useFrame((_, delta) => {
    const nextAnimationName = normalizeClipName(animationNameRef?.current ?? animationName);
    playAnimation(nextAnimationName, clipsByName, loaded.animations, mixer, actionRef, activeAnimationNameRef);
    mixer.update(delta);
    if (hasBakedAnimation) return;
    updateProceduralState(proceduralStateRef.current, nextAnimationName, delta);
    applyProceduralEnemyMotion(proceduralRig, modelKey, nextAnimationName, proceduralStateRef.current.time, proceduralStateRef.current.phaseAge);
  });

  return <primitive object={object} rotation={rotation} />;
}

function cloneEnemyMaterial(material: Material, modelKey: EnemyModelKey, finish: EnemyMaterialFinish) {
  const cloned = material.clone();
  polishEnemyMaterial(cloned, modelKey, finish === "boss");
  if (finish === "matte") applyMatteEnemyMaterialFinish(cloned);
  return cloned;
}

function polishEnemyMaterial(material: Material, modelKey: EnemyModelKey, bossFinish: boolean) {
  const name = material.name.toLowerCase();
  const isBoss = bossFinish || modelKey === "hp_enemy_custodian_foreman_horror" || modelKey === "hp_enemy_reclamation_mother_final_horror";
  const isMuseumSmallRobot =
    !bossFinish &&
    (modelKey === "hp_enemy_repair_drone_horror" ||
      modelKey === "hp_enemy_clamp_repair_horror" ||
      modelKey === "hp_enemy_shield_technician_horror");
  const isRepairDrone = modelKey === "hp_enemy_repair_drone_horror";
  const cyanCore = name.includes("scanner") || name.includes("core") || name.includes("cyan") || name.includes("beam");
  const amberWarning = name.includes("warning") || name.includes("amber");
  forceOpaqueEnemyMaterial(material);

  if (material instanceof MeshBasicMaterial) {
    if (cyanCore) {
      material.color.set(enemyPremiumLightingPalette.core);
      material.toneMapped = false;
    } else if (amberWarning) {
      material.color.set(enemyPremiumLightingPalette.warning);
      material.toneMapped = false;
    }
    material.needsUpdate = true;
    return;
  }

  if (!(material instanceof MeshStandardMaterial)) return;

  if (cyanCore) {
    material.color.set(isMuseumSmallRobot ? "#8bbfba" : enemyPremiumLightingPalette.core);
    material.emissive.set(isMuseumSmallRobot ? "#3e8e8a" : enemyPremiumLightingPalette.coreEmissive);
    material.emissiveIntensity = isBoss ? 1.22 : isMuseumSmallRobot ? 0.46 : 0.78;
    material.metalness = isMuseumSmallRobot ? 0.34 : Math.max(material.metalness, 0.62);
    material.roughness = isMuseumSmallRobot ? 0.48 : Math.max(material.roughness, 0.34);
    material.toneMapped = !isBoss;
  } else if (amberWarning) {
    material.color.set(enemyPremiumLightingPalette.warning);
    material.emissive.set(enemyPremiumLightingPalette.warningEmissive);
    material.emissiveIntensity = isBoss ? 0.54 : 0.24;
    material.metalness = isMuseumSmallRobot ? 0.36 : Math.max(material.metalness, 0.58);
    material.roughness = isMuseumSmallRobot ? 0.52 : Math.max(material.roughness, 0.38);
  } else if (name.includes("body") || name.includes("panel") || name.includes("off_white")) {
    material.color.set(isMuseumSmallRobot ? "#747a70" : enemyPremiumLightingPalette.body);
    material.metalness = isMuseumSmallRobot ? 0.48 : Math.max(material.metalness, 0.62);
    material.roughness = isMuseumSmallRobot ? 0.58 : Math.max(material.roughness, 0.36);
    material.emissive.set(isMuseumSmallRobot ? "#080806" : "#0a1111");
    material.emissiveIntensity = isBoss ? 0.08 : isMuseumSmallRobot ? 0.025 : 0.045;
  } else if (name.includes("dark") || name.includes("armor") || name.includes("gunmetal")) {
    material.color.set(isRepairDrone ? "#303630" : isMuseumSmallRobot ? "#282d2a" : enemyPremiumLightingPalette.armor);
    material.metalness = isMuseumSmallRobot ? 0.5 : Math.max(material.metalness, 0.74);
    material.roughness = isMuseumSmallRobot ? 0.62 : Math.max(material.roughness, 0.34);
    material.emissive.set(isMuseumSmallRobot ? "#050504" : enemyPremiumLightingPalette.dark);
    material.emissiveIntensity = isRepairDrone ? 0.025 : isBoss ? 0.09 : 0.04;
  } else if (name.includes("rubber") || name.includes("joint")) {
    if (isRepairDrone) {
      material.color.set("#202827");
      material.emissive.set("#040606");
      material.emissiveIntensity = 0.025;
    }
    material.roughness = isMuseumSmallRobot ? 0.74 : Math.max(material.roughness, 0.5);
  }
  material.needsUpdate = true;
}

function applyMatteEnemyMaterialFinish(material: Material) {
  if (!(material instanceof MeshStandardMaterial)) return;
  const name = material.name.toLowerCase();
  const isGlow = name.includes("scanner") || name.includes("core") || name.includes("cyan") || name.includes("beam") || name.includes("warning") || name.includes("amber");
  const metalnessCeiling = name.includes("dark") || name.includes("armor") || name.includes("gunmetal") ? 0.06 : isGlow ? 0.02 : 0.05;
  material.metalness = Math.min(material.metalness, metalnessCeiling);
  material.roughness = Math.max(material.roughness, isGlow ? 0.84 : 0.9);
  material.envMapIntensity = Math.min(material.envMapIntensity, 0.08);
  material.emissiveIntensity = Math.min(material.emissiveIntensity, isGlow ? 0.18 : 0.025);
  material.needsUpdate = true;
}

function forceOpaqueEnemyMaterial(material: Material) {
  material.transparent = false;
  material.opacity = 1;
  material.alphaTest = 0;
  material.depthWrite = true;
  material.depthTest = true;
}

function applyEnemyReadabilityOverrides(root: Object3D, modelKey: EnemyModelKey) {
  if (modelKey === "hp_enemy_repair_drone_horror") {
    root.traverse((node) => {
      if (node.name === "part_arm_l" || node.name === "part_arm_r") {
        setScaleFloor(node, 0.3, 0.28, 0.34);
      }
      if (node.name === "part_forearm_l" || node.name === "part_forearm_r") {
        setScaleFloor(node, 0.3, 0.3, 0.48);
      }
      if (node.name === "part_hand_l" || node.name === "part_hand_r") {
        setScaleFloor(node, 0.44, 0.44, 0.44);
      }
    });
    return;
  }

  if (modelKey === "hp_enemy_clamp_repair_horror") {
    root.traverse((node) => {
      if (node.name === "left-utility-hand" || node.name === "right-utility-hand") {
        node.scale.set(
          Math.min(node.scale.x, 1.02),
          Math.min(node.scale.y, 0.92),
          Math.min(node.scale.z, 0.82),
        );
      }
    });
  }
}

function setScaleFloor(node: Object3D, x: number, y: number, z: number) {
  node.scale.set(Math.max(node.scale.x, x), Math.max(node.scale.y, y), Math.max(node.scale.z, z));
}

function playAnimation(
  animationName: string,
  clipsByName: Map<string, AnimationClip>,
  animations: readonly AnimationClip[],
  mixer: AnimationMixer,
  actionRef: MutableRefObject<AnimationAction | null>,
  activeAnimationNameRef: MutableRefObject<string | null>,
) {
  if (activeAnimationNameRef.current === animationName) return;
  const clip = clipsByName.get(animationName) ?? clipsByName.get("idle") ?? animations[0];
  if (!clip) return;

  activeAnimationNameRef.current = animationName;
  const previousAction = actionRef.current;
  const action = mixer.clipAction(clip);
  if (previousAction === action) return;

  previousAction?.fadeOut(0.08);
  action.reset();
  action.enabled = true;
  action.clampWhenFinished = animationName === "death";
  action.setEffectiveWeight(1);
  if (oneShotAnimationNames.has(animationName)) {
    action.setLoop(LoopOnce, 1);
  } else {
    action.setLoop(LoopRepeat, Infinity);
  }
  action.fadeIn(0.06).play();
  actionRef.current = action;
}

function normalizeClipName(name: string) {
  return name.replace(/\.\d+$/, "");
}

function collectProceduralRig(object: Object3D): ProceduralRig {
  const parts = new Map<string, ProceduralPart>();
  const root = basePart(object);
  object.traverse((node) => {
    if (!proceduralPartNames.has(node.name)) return;
    parts.set(node.name, basePart(node));
  });
  return { root, parts };
}

function basePart(node: Object3D): ProceduralPart {
  return {
    node,
    rotation: { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z },
    position: { x: node.position.x, y: node.position.y, z: node.position.z },
  };
}

function updateProceduralState(state: { name: string; phaseAge: number; time: number }, animationName: string, delta: number) {
  state.time += delta;
  if (state.name !== animationName) {
    state.name = animationName;
    state.phaseAge = 0;
    return;
  }
  state.phaseAge += delta;
}

function applyProceduralEnemyMotion(rig: ProceduralRig, modelKey: EnemyModelKey, animationName: string, time: number, phaseAge: number) {
  resetPart(rig.root);
  for (const part of rig.parts.values()) resetPart(part);

  const isDrone = modelKey === "hp_enemy_repair_drone_horror";
  const moveAmount = animationName === "move" ? 1 : 0;
  const idleAmount = animationName === "idle" ? 1 : 0;
  const spawnAmount = animationName === "spawn_boot" ? 1 - smooth01(phaseAge / 0.42) : 0;
  const hitLight = animationName === "hit_light" ? Math.sin(clamp01(phaseAge / 0.22) * Math.PI) : 0;
  const hitHeavy = animationName === "hit_heavy" || animationName === "stagger" ? Math.sin(clamp01(phaseAge / 0.34) * Math.PI) : 0;
  const hitAmount = hitLight * 0.45 + hitHeavy * 0.9;
  const windup = animationName === "attack_windup" ? smooth01(phaseAge / 0.14) : 0;
  const strike = animationName === "attack_strike" ? Math.sin(clamp01(phaseAge / 0.22) * Math.PI) : 0;
  const recover = animationName === "attack_recover" ? 1 - smooth01(phaseAge / 0.32) : 0;
  const death = animationName === "death" ? smooth01(phaseAge / 0.7) : 0;

  const stride = Math.sin(time * (isDrone ? 5.6 : 8.6));
  const step = Math.cos(time * (isDrone ? 5.6 : 8.6));
  const bodyBob = Math.abs(stride) * (isDrone ? 0.045 : 0.055) * moveAmount;
  const idleBob = Math.sin(time * (isDrone ? 3.8 : 1.9)) * (isDrone ? 0.072 : 0.012) * (idleAmount + 0.35);

  rig.root.node.position.set(
    rig.root.position.x + strike * 0.04,
    rig.root.position.y + bodyBob + idleBob + spawnAmount * 0.08 - death * 0.18,
    rig.root.position.z + strike * 0.12 - recover * 0.04,
  );
  rig.root.node.rotation.set(
    rig.root.rotation.x + death * 0.52 + hitAmount * 0.08,
    rig.root.rotation.y,
    rig.root.rotation.z + hitAmount * 0.08 * (Math.sin(time * 17) > 0 ? 1 : -1) + (isDrone ? Math.sin(time * 2.7) * 0.045 : 0),
  );

  rotatePart(rig, "pelvisPivot", stride * 0.06 * moveAmount, 0, step * 0.025 * moveAmount);
  rotatePart(rig, "spinePivot", -bodyBob * 0.9 - strike * 0.12 + hitAmount * 0.12 + death * 0.28, 0, -stride * 0.035 * moveAmount);
  rotatePart(rig, "chestPivot", windup * 0.18 - strike * 0.34 + recover * 0.1 + hitAmount * 0.18 + death * 0.42, 0, hitAmount * 0.12);

  if (isDrone) {
    applyDroneMotion(rig, time, moveAmount, windup, strike, recover, hitAmount, spawnAmount);
    return;
  }

  const legSwing = stride * 0.48 * moveAmount;
  const kneeLiftLeft = Math.max(0, -stride) * 0.44 * moveAmount;
  const kneeLiftRight = Math.max(0, stride) * 0.44 * moveAmount;
  rotatePart(rig, "leftHipPivot", legSwing - death * 0.15, 0, -0.03 * moveAmount);
  rotatePart(rig, "rightHipPivot", -legSwing + death * 0.15, 0, 0.03 * moveAmount);
  rotatePart(rig, "leftKneePivot", kneeLiftLeft + death * 0.18, 0, 0);
  rotatePart(rig, "rightKneePivot", kneeLiftRight + death * 0.18, 0, 0);
  rotatePart(rig, "leftAnklePivot", -legSwing * 0.32, 0, 0);
  rotatePart(rig, "rightAnklePivot", legSwing * 0.32, 0, 0);

  const armSwing = stride * 0.28 * moveAmount;
  const attackArm = windup * 0.7 - strike * 1.05 - recover * 0.28;
  rotatePart(rig, "leftShoulderPivot", -armSwing + attackArm + spawnAmount * 0.25 + death * 0.22, 0, -0.08 - strike * 0.12);
  rotatePart(rig, "rightShoulderPivot", armSwing + attackArm + spawnAmount * 0.25 + death * 0.22, 0, 0.08 + strike * 0.12);
  rotatePart(rig, "leftForearmTwist", -0.1 - strike * 0.36 + hitAmount * 0.1, 0, -strike * 0.12);
  rotatePart(rig, "rightForearmTwist", -0.1 - strike * 0.36 - hitAmount * 0.1, 0, strike * 0.12);
  rotatePart(rig, "leftWristPivot", strike * 0.18, 0, -strike * 0.22);
  rotatePart(rig, "rightWristPivot", strike * 0.18, 0, strike * 0.22);
  rotatePart(rig, "left_clamp_lower", -strike * 0.35 + recover * 0.16, 0, 0);
  rotatePart(rig, "left_clamp_upper", strike * 0.35 - recover * 0.16, 0, 0);
  rotatePart(rig, "bladeBaseSocket", -strike * 0.18 + windup * 0.12, 0, strike * 0.1);
  rotatePart(rig, "bladeTipSocket", -strike * 0.22 + windup * 0.14, 0, strike * 0.14);
}

function applyDroneMotion(
  rig: ProceduralRig,
  time: number,
  moveAmount: number,
  windup: number,
  strike: number,
  recover: number,
  hitAmount: number,
  spawnAmount: number,
) {
  const flutter = Math.sin(time * 14.5);
  const scan = Math.sin(time * 4.8);
  rotatePart(rig, "chestPivot", flutter * 0.055 * (moveAmount + 0.5), scan * 0.075, hitAmount * 0.16);
  rotatePart(rig, "leftShoulderPivot", flutter * 0.34 + windup * 0.42 - strike * 0.7 + spawnAmount * 0.4, 0, -0.43 - strike * 0.24);
  rotatePart(rig, "rightShoulderPivot", -flutter * 0.34 + windup * 0.42 - strike * 0.7 + spawnAmount * 0.4, 0, 0.43 + strike * 0.24);
  rotatePart(rig, "leftForearmTwist", -strike * 0.5 + recover * 0.15, 0, -flutter * 0.12);
  rotatePart(rig, "rightForearmTwist", -strike * 0.5 + recover * 0.15, 0, flutter * 0.12);
  rotatePart(rig, "bladeBaseSocket", 0, 0, time * 17);
  rotatePart(rig, "bladeTipSocket", 0, 0, -time * 17);
}

function resetPart(part: ProceduralPart) {
  part.node.position.set(part.position.x, part.position.y, part.position.z);
  part.node.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z);
}

function rotatePart(rig: ProceduralRig, name: string, x: number, y: number, z: number) {
  const part = rig.parts.get(name);
  if (!part) return;
  part.node.rotation.set(part.rotation.x + x, part.rotation.y + y, part.rotation.z + z);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smooth01(value: number) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}
