import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  type Material,
  type Mesh,
  type Object3D,
} from "three";

export function routeOutputOrbAccentForIndex(index: number) {
  return ["#72e8ff", "#ffd76b", "#71dc92", "#b995ff"][index] ?? "#72e8ff";
}

export function routeOutputOrbAccentForVisualKey(visualKey: string) {
  if (visualKey === "route_output_orb_2") return routeOutputOrbAccentForIndex(1);
  if (visualKey === "route_output_orb_3") return routeOutputOrbAccentForIndex(2);
  if (visualKey === "route_output_orb_4") return routeOutputOrbAccentForIndex(3);
  return routeOutputOrbAccentForIndex(0);
}

export function polishRouteOutputOrbObject(object: Object3D, accentHex: string) {
  const accent = new Color(accentHex);
  object.traverse((child) => {
    const mesh = child as Mesh & { isMesh?: boolean; material?: Material | Material[] };
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const polished = materials.map((material) => polishRouteOutputOrbMaterial(material, `${child.name} ${material.name}`, accent));
    mesh.material = Array.isArray(mesh.material) ? polished : polished[0];
    const descriptor = `${child.name} ${materials.map((material) => material.name).join(" ")}`.toLowerCase();
    if (isOuterShell(descriptor)) mesh.renderOrder = 8;
    else if (isInnerLight(descriptor)) mesh.renderOrder = 7;
    else if (isInnerArt(descriptor)) mesh.renderOrder = 6;
  });
}

function polishRouteOutputOrbMaterial(material: Material, descriptor: string, accent: Color): Material {
  const name = descriptor.toLowerCase();
  const clone = material.clone();
  if (isOuterShell(name)) {
    applyGlassShell(clone, accent);
  } else if (isInnerLight(name)) {
    applyInnerLight(clone, accent);
  } else if (isInnerArt(name)) {
    applyInnerArt(clone, accent);
  }
  clone.needsUpdate = true;
  return clone;
}

function isOuterShell(name: string) {
  return name.includes("transparent_outer_shell") || name.includes("outer_shell") || name.includes("glass_shell") || name.includes("crystal_shell");
}

function isInnerArt(name: string) {
  return name.includes("image2") || name.includes("wrap_inner_sphere") || name.includes("inner_sphere") || name.includes("sticker");
}

function isInnerLight(name: string) {
  return name.includes("inner_light") || name.includes("light_core") || name.includes("equator") || name.includes("glow");
}

function applyGlassShell(material: Material, accent: Color) {
  material.transparent = true;
  material.opacity = 0.24;
  material.depthWrite = false;
  material.depthTest = true;
  material.side = DoubleSide;
  material.blending = NormalBlending;
  setToneMapped(material, false);
  if (material instanceof MeshStandardMaterial) {
    material.color.set("#e8ffff");
    material.emissive.copy(accent);
    material.emissiveIntensity = 0.2;
    material.roughness = 0.02;
    material.metalness = 0.02;
  } else if (material instanceof MeshBasicMaterial) {
    material.color.set("#e8ffff");
  }
}

function applyInnerArt(material: Material, accent: Color) {
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.blending = NormalBlending;
  setToneMapped(material, false);
  if (material instanceof MeshStandardMaterial) {
    material.color.set("#ffffff");
    material.emissive.copy(accent);
    material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.92);
    material.roughness = Math.min(material.roughness, 0.26);
    material.metalness = Math.min(material.metalness, 0.1);
  } else if (material instanceof MeshBasicMaterial) {
    material.color.set("#ffffff");
  }
}

function applyInnerLight(material: Material, accent: Color) {
  material.transparent = true;
  material.opacity = Math.max(material.opacity, 0.78);
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  setToneMapped(material, false);
  if (material instanceof MeshStandardMaterial) {
    material.color.copy(accent);
    material.emissive.copy(accent);
    material.emissiveIntensity = Math.max(material.emissiveIntensity, 1.8);
    material.roughness = 0.08;
    material.metalness = 0;
  } else if (material instanceof MeshBasicMaterial) {
    material.color.copy(accent);
  }
}

function setToneMapped(material: Material, value: boolean) {
  (material as Material & { toneMapped?: boolean }).toneMapped = value;
}
