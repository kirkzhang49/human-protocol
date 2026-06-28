import {
  Box3,
  Color,
  MathUtils,
  Mesh,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
} from "three";

export type WgpuLabViewmodelAnimationState =
  | {
      kind: "rod";
      attackActive: boolean;
      attackProgress: number;
      elapsedTime: number;
    }
  | {
      kind: "sidearm";
      reloadActive: boolean;
      reloadProgress: number;
      fireActive: boolean;
      fireProgress: number;
      heat: number;
    };

export type WgpuLabPropMaterialVariant = "metallic" | "carbon";

interface PrepareWgpuLabViewmodelOptions {
  displaySize: number;
  materialVariant: WgpuLabPropMaterialVariant;
}

type PropNodeSnapshot = {
  object: Object3D;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
  visible: boolean;
};

const tmpBox = new Box3();
const tmpSize = new Vector3();
const tmpCenter = new Vector3();
const sidearmFireFxNames = [
  "sidearm_muzzle_flash",
  "sidearm_muzzle_flash_card_h",
  "sidearm_muzzle_flash_card_v",
  "sidearm_muzzle_flash_knife_l",
  "sidearm_muzzle_flash_knife_r",
  "sidearm_beam_core",
  "sidearm_beam_shell",
  "sidearm_beam_visible_core",
  "sidearm_beam_visible_slab",
];

export function prepareWgpuLabViewmodelScene(source: Object3D, options: PrepareWgpuLabViewmodelOptions) {
  const clone = source.clone(true);
  normalizePropScene(clone, options.displaySize);
  clone.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 31;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => prepareWgpuLabMaterial(material, options.materialVariant))
      : prepareWgpuLabMaterial(mesh.material, options.materialVariant);
  });
  return clone;
}

export function animateWgpuLabViewmodel(root: Object3D, state: WgpuLabViewmodelAnimationState) {
  if (state.kind === "rod") {
    animateRodGrip(root, state.attackActive, state.attackProgress, state.elapsedTime);
    return;
  }

  animateSidearmReload(root, state.reloadActive, state.reloadProgress, state.heat);
  animateSidearmFire(root, state.fireActive, state.fireProgress);
}

function normalizePropScene(scene: Object3D, displaySize: number) {
  scene.updateMatrixWorld(true);
  tmpBox.setFromObject(scene);
  tmpBox.getSize(tmpSize);
  tmpBox.getCenter(tmpCenter);
  const maxDimension = Math.max(tmpSize.x, tmpSize.y, tmpSize.z, 0.001);
  scene.position.x -= tmpCenter.x;
  scene.position.y -= tmpBox.min.y;
  scene.position.z -= tmpCenter.z;
  scene.scale.multiplyScalar(displaySize / maxDimension);
}

function prepareWgpuLabMaterial(material: Material, variant: WgpuLabPropMaterialVariant) {
  const clone = material.clone();
  applyWgpuLabPropSkin(clone, variant);
  clone.depthTest = false;
  clone.depthWrite = false;
  if ("toneMapped" in clone && /beam|charge|cyan|emissive|glow|muzzle|light/.test(clone.name.toLowerCase())) {
    clone.toneMapped = false;
  }
  clone.needsUpdate = true;
  return clone;
}

function applyWgpuLabPropSkin(material: Material, variant: WgpuLabPropMaterialVariant) {
  const target = material as Material & {
    color?: Color;
    emissive?: Color;
    emissiveIntensity?: number;
    metalness?: number;
    opacity?: number;
    roughness?: number;
    transparent?: boolean;
  };
  if (!target.color) return;

  const name = material.name.toLowerCase();
  const isRod = variant === "metallic";
  const body = new Color(isRod ? "#b8b1a2" : "#a8a598");
  const armor = new Color("#1c1d1a");
  const museumGlow = new Color("#d4b76a");
  const amber = new Color("#b99a54");
  const hand = new Color("#d2c7b6");
  const dark = new Color("#090a09");
  const profile = isRod ? { metalness: 0.94, roughness: 0.18 } : { metalness: 0.68, roughness: 0.34 };

  const data = material.userData as {
    propSkinBaseMetalness?: number;
    propSkinBaseRoughness?: number;
  };
  if (typeof target.metalness === "number" && typeof data.propSkinBaseMetalness !== "number") data.propSkinBaseMetalness = target.metalness;
  if (typeof target.roughness === "number" && typeof data.propSkinBaseRoughness !== "number") data.propSkinBaseRoughness = target.roughness;

  if (/synthetic_skin|warm_skin|robot_hand|bionic_skin|bionic_palm_pad|synthetic_nail/.test(name)) {
    target.color.copy(hand);
    target.transparent = false;
    if (typeof target.opacity === "number") target.opacity = 1;
  } else if (name.includes("smoked_energy_glass")) {
    target.color.copy(new Color("#312b1c")).lerp(museumGlow, 0.16);
    if (target.emissive) target.emissive.copy(museumGlow);
    if (typeof target.emissiveIntensity === "number") target.emissiveIntensity = 0.18;
  } else if (name.includes("cyan_emissive") || name.includes("energy") || name.includes("subdermal") || name.includes("charge")) {
    target.color.copy(museumGlow);
    if (target.emissive) target.emissive.copy(museumGlow);
    if (typeof target.emissiveIntensity === "number") target.emissiveIntensity = 0.56;
  } else if (name.includes("warning_orange") || name.includes("bullet_brass") || name.includes("micro_copper") || name.includes("amber") || name.includes("bronze")) {
    target.color.copy(amber).lerp(new Color("#fff0c8"), 0.08);
  } else if (name.includes("dark") || name.includes("grip") || name.includes("polymer") || name.includes("black_ceramic") || name.includes("sleeve") || name.includes("rubber")) {
    target.color.copy(dark);
  } else if (name.includes("slide") || name.includes("sidearm_texture") || name.includes("gunmetal") || name.includes("tempered") || name.includes("ceramic_armor") || name.includes("titanium")) {
    target.color.copy(armor).lerp(body, name.includes("slide") ? 0.18 : 0.08);
  } else if (name.includes("steel") || name.includes("worn_white") || name.includes("rod") || name.includes("shaft")) {
    target.color.copy(body).lerp(new Color("#ffffff"), 0.18);
  }

  if (typeof target.metalness === "number") target.metalness = MathUtils.clamp((data.propSkinBaseMetalness ?? target.metalness) * (0.8 + profile.metalness * 0.28), 0.02, 1);
  if (typeof target.roughness === "number") target.roughness = MathUtils.clamp(((data.propSkinBaseRoughness ?? target.roughness) + profile.roughness) * 0.5, 0.12, 0.86);
  if (/synthetic_skin|warm_skin|robot_hand|bionic_skin|bionic_palm_pad|synthetic_nail/.test(name)) {
    if (typeof target.metalness === "number") target.metalness = Math.min(target.metalness, 0.035);
    if (typeof target.roughness === "number") target.roughness = Math.max(target.roughness, name.includes("seam") ? 0.82 : 0.74);
  }
}

function getPropNodeCache(root: Object3D) {
  const cache = root.userData.propNodeCache as Record<string, PropNodeSnapshot> | undefined;
  if (cache) return cache;

  const nextCache: Record<string, PropNodeSnapshot> = {};
  root.traverse((object) => {
    if (!object.name || nextCache[object.name]) return;
    nextCache[object.name] = {
      object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
      visible: object.visible,
    };
  });
  root.userData.propNodeCache = nextCache;
  return nextCache;
}

function resetPropNode(snapshot: PropNodeSnapshot | undefined) {
  if (!snapshot) return;
  snapshot.object.position.copy(snapshot.position);
  snapshot.object.quaternion.copy(snapshot.quaternion);
  snapshot.object.scale.copy(snapshot.scale);
  snapshot.object.visible = snapshot.visible;
}

function resetPropNodes(cache: Record<string, PropNodeSnapshot>, names: readonly string[]) {
  names.forEach((name) => resetPropNode(cache[name]));
}

function reloadPhase(progress: number, start: number, end: number) {
  return MathUtils.smoothstep(progress, start, end);
}

function reloadPulse(progress: number, start: number, peak: number, end: number) {
  if (progress <= start || progress >= end) return 0;
  if (progress < peak) return reloadPhase(progress, start, peak);
  return 1 - reloadPhase(progress, peak, end);
}

function applyRotationOffset(snapshot: PropNodeSnapshot | undefined, x = 0, y = 0, z = 0) {
  if (!snapshot) return;
  snapshot.object.rotation.x += x;
  snapshot.object.rotation.y += y;
  snapshot.object.rotation.z += z;
}

function applyPositionOffset(snapshot: PropNodeSnapshot | undefined, x = 0, y = 0, z = 0) {
  if (!snapshot) return;
  snapshot.object.position.x += x;
  snapshot.object.position.y += y;
  snapshot.object.position.z += z;
}

function setPropVisible(snapshot: PropNodeSnapshot | undefined, visible: boolean) {
  if (!snapshot) return;
  snapshot.object.visible = visible;
}

function applyScaleMultiplier(snapshot: PropNodeSnapshot | undefined, scale: number) {
  if (!snapshot) return;
  snapshot.object.scale.multiplyScalar(scale);
}

function animateSidearmReload(root: Object3D, active: boolean, progress: number, heat: number) {
  const cache = getPropNodeCache(root);
  const names = [
    "sidearm_root",
    "sidearm_slide",
    "sidearm_barrel",
    "sidearm_muzzle_ring",
    "sidearm_muzzle_focus_ring",
    "sidearm_charge_core",
    "sidearm_charge_window",
    "sidearm_heat_vent_l",
    "sidearm_heat_vent_r",
    ...sidearmFireFxNames,
    "sidearm_loading_strip_0",
    "sidearm_loading_strip_1",
    "sidearm_loading_strip_2",
    "sidearm_loading_strip_3",
    "sidearm_magazine",
    "sidearm_mag_base_plate",
    "sidearm_chamber_round",
    "sidearm_trigger",
    "fresh_magazine",
    "fresh_magazine_base_plate",
    "fresh_magazine_charge_window",
    "left_magazine_pinch_finger_0",
    "left_magazine_pinch_finger_1",
    "left_pistol_charge_contact_frame",
    "left_pistol_charge_contact_glow",
    "left_hand_root",
    "right_hand_root",
    "right_palm",
    "right_wrist",
    "right_index_01",
    "right_index_02",
    "right_index_03",
    "right_middle_01",
    "right_middle_02",
    "right_middle_03",
    "right_ring_01",
    "right_ring_02",
    "right_ring_03",
    "right_pinky_01",
    "right_pinky_02",
    "right_pinky_03",
    "right_thumb_01",
    "right_thumb_02",
    "left_index_01",
    "left_index_02",
    "left_index_03",
    "left_middle_01",
    "left_middle_02",
    "left_thumb_01",
    "left_thumb_02",
  ];
  resetPropNodes(cache, names);
  for (let index = 0; index < 6; index += 1) resetPropNode(cache[`sidearm_charge_cell_${index}`]);

  const p = active ? MathUtils.clamp(progress, 0, 1) : 0;
  const liftReady = active ? reloadPulse(p, 0.02, 0.09, 0.18) : 0;
  const leaveSupport = active ? reloadPhase(p, 0.06, 0.22) * (1 - reloadPhase(p, 0.84, 0.98)) : 0;
  const magOut = reloadPhase(p, 0.12, 0.34) * (1 - reloadPhase(p, 0.52, 0.62));
  const freshSeat = reloadPhase(p, 0.48, 0.68) * (1 - reloadPhase(p, 0.72, 0.84));
  const seatKick = reloadPulse(p, 0.56, 0.66, 0.78);
  const chargeContact = reloadPulse(p, 0.34, 0.56, 0.82);
  const freshGrip = active ? reloadPulse(p, 0.34, 0.52, 0.72) : 0;
  const rackReach = reloadPhase(p, 0.68, 0.78);
  const slideRack = reloadPulse(p, 0.76, 0.86, 0.98);
  const indexSafe = active ? reloadPulse(p, 0, 0.12, 0.92) : 0;
  const heatGlow = MathUtils.clamp(heat, 0, 1);
  const loadingWindow = active ? reloadPhase(p, 0.08, 0.18) * (1 - reloadPhase(p, 0.88, 0.98)) : 0;
  const chargeRamp = active ? reloadPhase(p, 0.18, 0.74) * (1 - reloadPhase(p, 0.9, 0.99)) : heatGlow * 0.2;
  const loadingPulse = loadingWindow * (0.62 + Math.sin(p * Math.PI * 18) * 0.18 + heatGlow * 0.16);
  const focusPulse = active ? reloadPulse(p, 0.66, 0.82, 0.98) : heatGlow * 0.12;
  const standbyBlend = active ? 1 - leaveSupport : 1;
  const contactBlend = active ? leaveSupport : 0;

  sidearmFireFxNames.forEach((name) => setPropVisible(cache[name], false));
  setPropVisible(cache.left_hand_root, active);
  applyScaleMultiplier(cache.sidearm_root, 1.28);
  applyScaleMultiplier(cache.right_hand_root, 0.62);
  applyScaleMultiplier(cache.left_hand_root, 0.62);
  setPropVisible(cache.left_pistol_charge_contact_frame, false);
  setPropVisible(cache.left_pistol_charge_contact_glow, false);
  setPropVisible(cache.left_magazine_pinch_finger_0, false);
  setPropVisible(cache.left_magazine_pinch_finger_1, false);

  applyPositionOffset(cache.sidearm_root, 0.018 * liftReady - 0.01 * seatKick, -0.03 * liftReady, 0.035 * liftReady);
  applyRotationOffset(cache.sidearm_root, -0.06 * liftReady, -0.03 * liftReady, -0.05 * liftReady + 0.025 * seatKick);
  applyPositionOffset(cache.sidearm_slide, 0, -0.34 * slideRack, 0.018 * slideRack);
  applyPositionOffset(cache.sidearm_heat_vent_l, 0, -0.035 * heatGlow, 0.018 * heatGlow);
  applyPositionOffset(cache.sidearm_heat_vent_r, 0, -0.035 * heatGlow, 0.018 * heatGlow);
  if (cache.sidearm_charge_core) cache.sidearm_charge_core.object.scale.multiplyScalar(1 + heatGlow * 0.16 + loadingPulse * 0.24);
  if (cache.sidearm_charge_window) cache.sidearm_charge_window.object.scale.multiplyScalar(1 + heatGlow * 0.08 + loadingPulse * 0.18);
  if (cache.sidearm_muzzle_focus_ring) cache.sidearm_muzzle_focus_ring.object.scale.multiplyScalar(1 + focusPulse * 0.28);

  for (let index = 0; index < 4; index += 1) {
    const strip = cache[`sidearm_loading_strip_${index}`];
    if (!strip) continue;
    const step = MathUtils.clamp((p - 0.18 - index * 0.12) / 0.16, 0, 1);
    strip.object.visible = active && loadingWindow > 0.02 && step > 0.02;
    strip.object.scale.set(strip.scale.x * (1 + loadingPulse * 0.25), strip.scale.y * (0.28 + step * 0.9), strip.scale.z * (1 + loadingPulse * 0.5));
  }
  for (let index = 0; index < 6; index += 1) {
    const cell = cache[`sidearm_charge_cell_${index}`];
    if (!cell) continue;
    const fill = MathUtils.clamp((chargeRamp - index * 0.09) / 0.22, 0, 1);
    cell.object.visible = !active || p > 0.08;
    cell.object.scale.set(cell.scale.x * (0.72 + fill * 0.38), cell.scale.y * (0.46 + fill * 0.92), cell.scale.z * (0.86 + fill * 0.3));
  }

  [cache.sidearm_magazine, cache.sidearm_mag_base_plate].forEach((snap) => {
    applyPositionOffset(snap, 0.06 * magOut, -0.72 * magOut, -0.14 * magOut);
    applyRotationOffset(snap, 0.28 * magOut, -0.04 * magOut, -0.14 * magOut);
    if (snap) snap.object.visible = !active || p < 0.36 || p > 0.79;
  });
  if (cache.sidearm_chamber_round) cache.sidearm_chamber_round.object.visible = slideRack > 0.08;
  applyRotationOffset(cache.sidearm_trigger, 0.2 * (1 - indexSafe), 0, 0);

  ["fresh_magazine", "fresh_magazine_base_plate", "fresh_magazine_charge_window"].forEach((name) => {
    const snap = cache[name];
    if (!snap) return;
    snap.object.visible = active && p > 0.36 && p < 0.76;
    applyPositionOffset(snap, -0.038 * magOut - 0.028 * seatKick, -0.05 * magOut + 0.08 * freshSeat, 0.1 * magOut + 0.12 * freshSeat);
    applyRotationOffset(snap, -0.08 * magOut - 0.04 * freshSeat, 0.03 * freshSeat, -0.04 * magOut + 0.05 * seatKick);
  });

  const rightPistolHand = cache.right_hand_root ?? cache.right_palm ?? cache.right_wrist;
  applyPositionOffset(rightPistolHand, 0, 0.012 * seatKick - 0.012 * slideRack, 0.008 * seatKick);
  applyRotationOffset(rightPistolHand, -0.018 * liftReady, -0.012 * liftReady, 0.018 * seatKick);
  setPropVisible(cache.left_pistol_charge_contact_glow, active && chargeContact > 0.045);
  setPropVisible(cache.left_pistol_charge_contact_frame, active && chargeContact > 0.035);
  setPropVisible(cache.left_magazine_pinch_finger_0, active && freshGrip > 0.08);
  setPropVisible(cache.left_magazine_pinch_finger_1, active && freshGrip > 0.08);
  applyPositionOffset(cache.left_hand_root, -0.38 * standbyBlend - 0.18 * contactBlend + 0.09 * freshSeat + 0.14 * rackReach, -0.1 * standbyBlend - 0.08 * contactBlend + 0.28 * freshSeat + 0.26 * slideRack, -0.32 * standbyBlend - 0.08 * contactBlend + 0.24 * freshSeat + 0.16 * rackReach);
  applyRotationOffset(cache.left_hand_root, -0.06 * standbyBlend - 0.16 * contactBlend - 0.14 * slideRack, -0.28 * standbyBlend + 0.14 * contactBlend, -0.12 * standbyBlend - 0.18 * magOut + 0.24 * rackReach + 0.08 * chargeContact);

  applyRotationOffset(cache.right_index_01, 0.42 * indexSafe, 0, 0);
  applyRotationOffset(cache.right_index_02, 0.36 * indexSafe, 0, 0);
  applyRotationOffset(cache.right_index_03, 0.28 * indexSafe, 0, 0);
  applyRotationOffset(cache.left_index_01, -0.22 * magOut - 0.24 * freshGrip + 0.18 * slideRack, 0, 0);
  applyRotationOffset(cache.left_index_02, -0.18 * magOut - 0.28 * freshGrip + 0.2 * slideRack, 0, 0);
  applyRotationOffset(cache.left_index_03, -0.14 * magOut - 0.18 * freshGrip + 0.16 * slideRack, 0, 0);
  applyRotationOffset(cache.left_middle_01, -0.18 * magOut - 0.22 * freshGrip, 0, 0);
  applyRotationOffset(cache.left_middle_02, -0.16 * magOut - 0.26 * freshGrip, 0, 0);
  applyRotationOffset(cache.left_thumb_01, 0.16 * magOut + 0.18 * freshGrip - 0.18 * slideRack, 0, 0);
  applyRotationOffset(cache.left_thumb_02, 0.12 * magOut + 0.14 * freshGrip - 0.16 * slideRack, 0, 0);
}

function animateSidearmFire(root: Object3D, active: boolean, progress: number) {
  if (!active) return;
  const cache = getPropNodeCache(root);
  const p = MathUtils.clamp(progress, 0, 1);
  const triggerPull = reloadPulse(p, 0.04, 0.12, 0.3);
  const shotKick = reloadPulse(p, 0.1, 0.2, 0.56);
  const muzzlePulse = reloadPulse(p, 0.08, 0.18, 0.5);
  const ventPulse = reloadPulse(p, 0.18, 0.36, 0.92);

  setPropVisible(cache.left_hand_root, false);
  ["fresh_magazine", "fresh_magazine_base_plate", "fresh_magazine_charge_window", "left_magazine_pinch_finger_0", "left_magazine_pinch_finger_1", "left_pistol_charge_contact_frame", "left_pistol_charge_contact_glow"].forEach((name) => setPropVisible(cache[name], false));
  sidearmFireFxNames.forEach((name) => setPropVisible(cache[name], false));

  applyPositionOffset(cache.sidearm_root, 0.012, -0.12 * shotKick, 0.025 + 0.04 * shotKick);
  applyRotationOffset(cache.sidearm_root, -0.08 + 0.14 * shotKick, -0.018, -0.035 + 0.018 * shotKick);
  applyPositionOffset(cache.sidearm_slide, 0, -0.28 * shotKick, 0.018 * shotKick);
  applyPositionOffset(cache.sidearm_barrel, 0, -0.06 * shotKick, 0.006 * shotKick);
  applyPositionOffset(cache.sidearm_muzzle_ring, 0, -0.04 * shotKick, 0.004 * shotKick);
  applyPositionOffset(cache.sidearm_heat_vent_l, 0, -0.08 * ventPulse, 0.045 * ventPulse);
  applyPositionOffset(cache.sidearm_heat_vent_r, 0, -0.08 * ventPulse, 0.045 * ventPulse);
  applyRotationOffset(cache.sidearm_trigger, 0.58 * triggerPull, 0, 0);

  const rightPistolHand = cache.right_hand_root ?? cache.right_palm ?? cache.right_wrist;
  applyPositionOffset(rightPistolHand, 0, -0.035 * shotKick, 0.02 * shotKick);
  applyRotationOffset(rightPistolHand, 0.05 * shotKick, -0.01, -0.02);
  applyRotationOffset(cache.right_index_01, -0.14 * triggerPull, 0, 0);
  applyRotationOffset(cache.right_index_02, -0.18 * triggerPull, 0, 0);
  applyRotationOffset(cache.right_index_03, -0.12 * triggerPull, 0, 0);

  if (cache.sidearm_charge_core) cache.sidearm_charge_core.object.scale.multiplyScalar(1.08 + muzzlePulse * 0.56 + ventPulse * 0.12);
  for (let index = 0; index < 6; index += 1) {
    const cell = cache[`sidearm_charge_cell_${index}`];
    if (!cell) continue;
    const drain = MathUtils.clamp(1 - muzzlePulse * (0.8 + index * 0.06), 0.24, 1);
    const vent = reloadPulse(p, 0.18 + index * 0.018, 0.34 + index * 0.018, 0.78);
    cell.object.scale.set(cell.scale.x * (0.9 + vent * 0.16), cell.scale.y * drain, cell.scale.z * (0.92 + vent * 0.22));
  }

  animateFireFx(cache, "sidearm_muzzle_flash", muzzlePulse, [0, 0.12 * muzzlePulse, 0], 0.34 + muzzlePulse * 2.2);
  animateFireFx(cache, "sidearm_muzzle_flash_card_h", muzzlePulse, [0, 0.095 * muzzlePulse, 0.004 * muzzlePulse], 0.42 + muzzlePulse * 0.95);
  animateFireFx(cache, "sidearm_muzzle_flash_card_v", muzzlePulse, [0, 0.09 * muzzlePulse, 0.006 * muzzlePulse], 0.55 + muzzlePulse * 0.72);
  animateFireFx(cache, "sidearm_muzzle_flash_knife_l", muzzlePulse, [-0.024 * muzzlePulse, 0.12 * muzzlePulse, 0.01 * muzzlePulse], 0.46 + muzzlePulse * 1.05);
  animateFireFx(cache, "sidearm_muzzle_flash_knife_r", muzzlePulse, [0.024 * muzzlePulse, 0.12 * muzzlePulse, 0.01 * muzzlePulse], 0.46 + muzzlePulse * 1.05);
  animateFireFx(cache, "sidearm_beam_core", muzzlePulse, [0, 0.18 * muzzlePulse, 0], 0.58 + muzzlePulse * 0.88);
  animateFireFx(cache, "sidearm_beam_shell", muzzlePulse, [0, 0.14 * muzzlePulse, 0], 0.62 + muzzlePulse * 1.12);
  animateFireFx(cache, "sidearm_beam_visible_core", muzzlePulse, [0, 0.14 * muzzlePulse, 0], 0.52 + muzzlePulse * 0.38);
  animateFireFx(cache, "sidearm_beam_visible_slab", muzzlePulse, [0, 0.12 * muzzlePulse, 0.004 * muzzlePulse], 0.42 + muzzlePulse * 0.32);
}

function animateFireFx(cache: Record<string, PropNodeSnapshot>, name: string, power: number, offset: [number, number, number], scalar: number) {
  const snap = cache[name];
  if (!snap) return;
  snap.object.visible = power > 0.035;
  applyPositionOffset(snap, offset[0], offset[1], offset[2]);
  snap.object.scale.multiplyScalar(scalar);
}

function animateRodGrip(root: Object3D, active: boolean, progress: number, elapsedTime: number) {
  const cache = getPropNodeCache(root);
  const names = [
    "iron_rod_root",
    "iron_rod_main_bar",
    "iron_rod_right_impact_cap",
    "iron_rod_right_dark_strike_face",
    "iron_rod_hit_tip_socket",
    "iron_rod_hit_base_socket",
    "iron_rod_trail_mid_socket",
    "right_hand_root",
    "right_palm",
    "right_wrist",
    "left_hand_root",
    "right_index_01",
    "right_index_02",
    "right_index_03",
    "right_middle_01",
    "right_middle_02",
    "right_middle_03",
    "right_ring_01",
    "right_ring_02",
    "right_ring_03",
    "right_pinky_01",
    "right_pinky_02",
    "right_pinky_03",
    "right_thumb_01",
    "right_thumb_02",
    "left_index_01",
    "left_middle_01",
    "left_thumb_01",
  ];
  resetPropNodes(cache, names);
  applyScaleMultiplier(cache.iron_rod_root, 1.42);
  applyScaleMultiplier(cache.right_hand_root, 0.58);
  applyScaleMultiplier(cache.left_hand_root, 0.58);

  const p = active ? MathUtils.clamp(progress, 0, 1) : 0;
  const drawBack = active ? reloadPulse(p, 0.02, 0.16, 0.34) : 0;
  const shoulderLoad = active ? reloadPhase(p, 0.08, 0.24) * (1 - reloadPhase(p, 0.58, 0.86)) : 0;
  const strike = active ? reloadPulse(p, 0.24, 0.36, 0.55) : 0;
  const impact = active ? reloadPulse(p, 0.32, 0.38, 0.5) : 0;
  const followThrough = active ? reloadPhase(p, 0.38, 0.56) * (1 - reloadPhase(p, 0.64, 0.86)) : 0;
  const recover = active ? reloadPhase(p, 0.68, 0.98) : 0;
  const idleBreath = active ? 0 : Math.sin(elapsedTime * 2) * 0.025;
  const rodX = -0.18 * drawBack + 0.12 * strike + 0.08 * followThrough - 0.04 * recover;
  const rodY = 0.12 * drawBack - 0.3 * strike - 0.12 * impact - 0.08 * followThrough + 0.05 * recover;
  const rodZ = 0.24 * drawBack - 0.46 * strike - 0.18 * followThrough + 0.08 * recover;
  const rodRotX = -0.88 * drawBack + 1.22 * strike + 0.32 * followThrough - 0.2 * recover + idleBreath;
  const rodRotY = 0.26 * drawBack + 0.2 * strike - 0.08 * followThrough - 0.1 * recover;
  const rodRotZ = 0.58 * drawBack - 0.96 * strike - 0.36 * followThrough + 0.12 * recover;

  applyPositionOffset(cache.iron_rod_root, rodX, rodY, rodZ);
  applyRotationOffset(cache.iron_rod_root, rodRotX, rodRotY, rodRotZ);
  const rightRodHand = cache.right_hand_root ?? cache.right_palm ?? cache.right_wrist;
  applyPositionOffset(rightRodHand, rodX, rodY, rodZ);
  applyRotationOffset(rightRodHand, rodRotX, rodRotY, rodRotZ);
  applyPositionOffset(cache.right_wrist, rodX * 0.18, rodY * 0.18, rodZ * 0.18);
  applyRotationOffset(cache.right_wrist, rodRotX * 0.12, rodRotY * 0.1, rodRotZ * 0.1);
  applyPositionOffset(cache.left_hand_root, -0.12 * shoulderLoad + 0.05 * followThrough, 0.12 * drawBack - 0.06 * strike, 0.16 * drawBack - 0.08 * strike);
  applyRotationOffset(cache.left_hand_root, -0.2 * drawBack + 0.28 * strike, -0.16 * strike, 0.34 * drawBack - 0.2 * followThrough);
  applyPositionOffset(cache.iron_rod_right_impact_cap, 0.012 * impact, -0.018 * impact, -0.02 * impact);
  applyPositionOffset(cache.iron_rod_right_dark_strike_face, 0.014 * impact, -0.02 * impact, -0.024 * impact);

  const gripTighten = active ? drawBack * 0.38 + strike * 0.64 + impact * 0.24 : 0;
  applyRotationOffset(cache.right_index_01, -gripTighten, 0, 0);
  applyRotationOffset(cache.right_index_02, -gripTighten * 0.9, 0, 0);
  applyRotationOffset(cache.right_index_03, -gripTighten * 0.68, 0, 0);
  applyRotationOffset(cache.right_middle_01, -gripTighten * 1.04, 0, 0);
  applyRotationOffset(cache.right_middle_02, -gripTighten * 0.82, 0, 0);
  applyRotationOffset(cache.right_middle_03, -gripTighten * 0.56, 0, 0);
  applyRotationOffset(cache.right_ring_01, -gripTighten * 0.82, 0, 0);
  applyRotationOffset(cache.right_ring_02, -gripTighten * 0.68, 0, 0);
  applyRotationOffset(cache.right_ring_03, -gripTighten * 0.52, 0, 0);
  applyRotationOffset(cache.right_pinky_01, -gripTighten * 0.72, 0, 0);
  applyRotationOffset(cache.right_pinky_02, -gripTighten * 0.6, 0, 0);
  applyRotationOffset(cache.right_pinky_03, -gripTighten * 0.48, 0, 0);
  applyRotationOffset(cache.right_thumb_01, -0.16 * drawBack + 0.28 * strike + 0.16 * impact, 0, 0);
  applyRotationOffset(cache.right_thumb_02, -0.12 * drawBack + 0.2 * strike + 0.12 * impact, 0, 0);
  applyRotationOffset(cache.left_index_01, 0.14 * strike - 0.08 * drawBack, 0, 0);
  applyRotationOffset(cache.left_middle_01, 0.1 * strike - 0.06 * drawBack, 0, 0);
  applyRotationOffset(cache.left_thumb_01, -0.12 * drawBack + 0.12 * strike, 0, 0);
}
