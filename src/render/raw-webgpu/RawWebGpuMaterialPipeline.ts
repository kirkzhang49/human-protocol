import type { RawMaterialVisualRole, RawPlanMaterial, RawRenderPlan, Tuple3, Tuple4 } from "./RawWebGpuTypes";
import { RAW_TEXTURE_PAGE_STRIDE } from "./RawWebGpuConstants";

export const RAW_MATERIAL_FLOATS = 32;
export const RAW_DEFAULT_MATERIAL_INDEX = 0;
export const RAW_CONTACT_SHADOW_MATERIAL_INDEX = 1;

const defaultMaterials: RawPlanMaterial[] = [
  {
    index: RAW_DEFAULT_MATERIAL_INDEX,
    id: "builtin:default-proxy",
    name: "default_proxy",
    category: "builtin",
    baseColorFactor: [1, 1, 1, 1],
    emissiveFactor: [0, 0, 0],
    emissiveStrength: 0,
    roughnessFactor: 0.72,
    metallicFactor: 0,
    aoStrength: 1,
    materialKind: 0,
    visualRole: "default",
    semanticParams: [0.35, 0.08, 0.18, 0],
    paletteColorFactor: [0, 0, 0, 0],
    alphaMode: "OPAQUE",
    doubleSided: true,
  },
  {
    index: RAW_CONTACT_SHADOW_MATERIAL_INDEX,
    id: "builtin:contact-shadow",
    name: "contact_shadow",
    category: "builtin",
    baseColorFactor: [0.006, 0.012, 0.014, 1],
    emissiveFactor: [0, 0, 0],
    emissiveStrength: 0,
    roughnessFactor: 1,
    metallicFactor: 0,
    aoStrength: 1,
    materialKind: -1,
    visualRole: "structural_dark",
    semanticParams: [1, 0, 0.6, 0],
    paletteColorFactor: [0.03, 0.05, 0.052, 0.48],
    alphaMode: "BLEND",
    doubleSided: true,
  },
];

export function rawMaterialFloatsFor(plan: RawRenderPlan) {
  const materials = normalizeRawMaterials(plan.geometry?.materials);
  const floats = new Float32Array(Math.max(1, materials.length) * RAW_MATERIAL_FLOATS);

  for (const material of materials) {
    const offset = material.index * RAW_MATERIAL_FLOATS;
    const baseColor = material.baseColorFactor ?? defaultMaterials[0].baseColorFactor;
    const emissiveFactor = material.emissiveFactor ?? defaultMaterials[0].emissiveFactor;
    floats.set(clampedTuple4(baseColor, [1, 1, 1, 1]), offset);
    floats.set([...clampedTuple3(emissiveFactor, [0, 0, 0]), clamp(material.emissiveStrength ?? 0, 0, 4)], offset + 4);
    floats.set(
      [
        clamp(material.roughnessFactor ?? 0.72, 0.04, 1),
        clamp(material.metallicFactor ?? 0, 0, 1),
        clamp(material.aoStrength ?? 1, 0, 1),
        material.materialKind ?? 0,
      ],
      offset + 8,
    );
    floats.set(
      [alphaModeValue(material.alphaMode), material.doubleSided === false ? 0 : 1, textureMaskValue(material), baseColorTextureLayer(material)],
      offset + 12,
    );
    floats.set(baseColorTextureStats(material), offset + 16);
    floats.set(materialSemanticParams(material), offset + 20);
    floats.set(materialPaletteColorFactor(material), offset + 24);
    floats.set(materialTextureLayers(material), offset + 28);
  }

  return floats;
}

function normalizeRawMaterials(materials: RawPlanMaterial[] | undefined) {
  const merged = new Map<number, RawPlanMaterial>();
  for (const material of defaultMaterials) {
    merged.set(material.index, material);
  }
  for (const material of materials ?? []) {
    if (!Number.isFinite(material.index) || material.index < 0) continue;
    merged.set(material.index, material);
  }

  const highestIndex = Math.max(...merged.keys());
  const normalized: RawPlanMaterial[] = [];
  for (let index = 0; index <= highestIndex; index += 1) {
    normalized[index] = merged.get(index) ?? { ...defaultMaterials[0], index, id: `builtin:gap-${index}` };
  }
  return normalized;
}

function clampedTuple3(value: Tuple3 | undefined, fallback: Tuple3): Tuple3 {
  return [clamp(value?.[0] ?? fallback[0], 0, 8), clamp(value?.[1] ?? fallback[1], 0, 8), clamp(value?.[2] ?? fallback[2], 0, 8)];
}

function clampedTuple4(value: Tuple4 | undefined, fallback: Tuple4): Tuple4 {
  return [
    clamp(value?.[0] ?? fallback[0], 0, 8),
    clamp(value?.[1] ?? fallback[1], 0, 8),
    clamp(value?.[2] ?? fallback[2], 0, 8),
    clamp(value?.[3] ?? fallback[3], 0, 1),
  ];
}

function alphaModeValue(value: RawPlanMaterial["alphaMode"]) {
  if (value === "MASK") return 1;
  if (value === "BLEND") return 2;
  return 0;
}

function textureMaskValue(material: RawPlanMaterial) {
  let mask = 0;
  for (const texture of material.textures ?? []) {
    if (texture.present === false || !Number.isFinite(texture.layer) || Number(texture.layer) <= 0) continue;
    if (texture.semantic === "baseColor") mask += 1;
    if (texture.semantic === "normal") mask += 2;
    if (texture.semantic === "metallicRoughness") mask += 4;
    if (texture.semantic === "ao") mask += 8;
    if (texture.semantic === "emissive") mask += 16;
  }
  return mask;
}

function baseColorTextureLayer(material: RawPlanMaterial) {
  const baseColorTexture = material.textures?.find(
    (texture) => texture.semantic === "baseColor" && texture.present !== false && Number.isFinite(texture.layer),
  );
  return encodedTexturePageLayer(baseColorTexture);
}

function materialTextureLayers(material: RawPlanMaterial): Tuple4 {
  return [
    materialTextureLayer(material, "normal"),
    materialTextureLayer(material, "metallicRoughness"),
    materialTextureLayer(material, "ao"),
    materialTextureLayer(material, "emissive"),
  ];
}

function materialTextureLayer(material: RawPlanMaterial, semantic: NonNullable<RawPlanMaterial["textures"]>[number]["semantic"]) {
  const texture = material.textures?.find((slot) => slot.semantic === semantic && slot.present !== false && Number.isFinite(slot.layer));
  return encodedTexturePageLayer(texture);
}

function baseColorTextureStats(material: RawPlanMaterial): Tuple4 {
  const baseColorTexture = material.textures?.find(
    (texture) => texture.semantic === "baseColor" && texture.present !== false && Number.isFinite(texture.layer),
  );
  const stats = baseColorTexture?.stats;
  return [
    clamp(stats?.lumaMean ?? 0.55, 0, 1),
    clamp(stats?.contrast ?? 0, 0, 1),
    clamp(stats?.chroma ?? 0, 0, 1),
    clamp(stats?.detail ?? 0, 0, 1),
  ];
}

function encodedTexturePageLayer(texture: NonNullable<RawPlanMaterial["textures"]>[number] | undefined) {
  if (!texture || texture.present === false || !Number.isFinite(texture.layer) || Number(texture.layer) <= 0) return -1;
  const page = Number.isFinite(texture.page) ? Math.max(0, Math.floor(Number(texture.page))) : 0;
  return page * RAW_TEXTURE_PAGE_STRIDE + Math.floor(Number(texture.layer));
}

function materialSemanticParams(material: RawPlanMaterial): Tuple4 {
  const role = resolveMaterialVisualRole(material);
  const roleId = visualRoleValue(role);
  const params = material.semanticParams && material.visualRole === role ? material.semanticParams : defaultSemanticParams(role);
  return [
    roleId,
    clamp(params[0], 0, 1.25),
    clamp(params[1], 0, 1.4),
    clamp(params[2], 0, 1.4),
  ];
}

// Authored render plans occasionally bake a material with visualRole "default"
// (role 0) — most notably the builder/auto-rig furniture and remaster prop packs
// (category "builder-resource"/"builder-cooked-glb"), whose generic mesh names
// ("Armchair_01", "woodPrimary", "fabric", "l610_*_graphite", …) match none of the
// role heuristics and fall through to "default". Role 0 has no anchor in
// semantic_material_albedo, so those props render as their flat, untreated base
// color and read as dull gray/near-black versus role-tinted assets. Recover a
// usable surface role: re-infer from the material name, and if that still yields
// "default", treat it as a neutral surface so it gets normal shading. Engine
// built-ins (the default proxy + contact shadow) keep their authored role.
function resolveMaterialVisualRole(material: RawPlanMaterial): RawMaterialVisualRole | string {
  const role = material.visualRole ?? inferredVisualRole(material);
  if (role !== "default" || material.category === "builtin") return role;
  const reinferred = inferredVisualRole(material);
  return reinferred === "default" ? "neutral_surface" : reinferred;
}

function materialPaletteColorFactor(material: RawPlanMaterial): Tuple4 {
  return clampedTuple4(material.paletteColorFactor ?? [0, 0, 0, 0], [0, 0, 0, 0]);
}

function inferredVisualRole(material: RawPlanMaterial): RawMaterialVisualRole {
  const name = `${material.category}:${material.name}`.toLowerCase();
  const materialName = String(material.name ?? "").toLowerCase();
  const puzzleOrbRole = inferredPuzzleOrbVisualRole(materialName);
  if (puzzleOrbRole) return puzzleOrbRole;
  if (material.category === "enemy") {
    if (/body_warm_museum_panel/.test(materialName)) return "structural_dark";
    if (/brushed_warm_museum_trim/.test(materialName)) return "structural_dark";
    if (/warning|amber|orange|yellow/.test(materialName) || material.materialKind === 5) return "pickup_energy";
    if (/scanner|core|cyan|beam|emissive|shield/.test(materialName) || material.materialKind === 4) return "cyan_emissive";
    if (/dark|armor|gunmetal|rubber|joint|black/.test(materialName) || material.materialKind === 2 || material.materialKind === 3) return "structural_dark";
    return "robot_body";
  }
  if (material.category === "door" && /warning_black|black_warning/.test(materialName)) return "structural_dark";
  if (material.category === "door" && /fault|hazard|lock|locked|lockdown|denied|amber|orange|warning|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) {
    return "door_locked_red";
  }
  if (material.category === "door" && /access|open|unlock|cyan|blue|reader|scanner|scan|emissive|glow|read_light|medical_emissive/.test(materialName)) {
    return "door_access_cyan";
  }
  if ((material.category === "pickup" || material.category === "key-item") && /med|medical|health|repair|first.?aid|white|cross|accent_medical|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) {
    return "pickup_health";
  }
  if ((material.category === "pickup" || material.category === "key-item") && /glass|shell|transparent/.test(materialName)) {
    return "glass_shell";
  }
  if ((material.category === "pickup" || material.category === "key-item") && /cyan|teal|blue|emissive|glow/.test(materialName)) {
    return "cyan_emissive";
  }
  if ((material.category === "pickup" || material.category === "key-item") && /energy|core|cell|battery|power|amber|orange|warning|cyan|teal|emissive|glow/.test(materialName)) {
    return "pickup_energy";
  }
  if ((material.category === "pickup" || material.category === "key-item") && /ammo|magazine|round|clip|memory|chip|data/.test(materialName)) return "pickup_ammo";
  if ((material.category === "pickup" || material.category === "key-item") && /key|gold|brass|yellow|protocol/.test(materialName)) return "pickup_key";
  if (material.category === "interaction" && /fault|hazard|inactive|(^|[_\-\s])off($|[_\-\s])|locked|orange|warning|denied|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) {
    return "switch_inactive";
  }
  if (material.category === "interaction" && /active|ready|cyan|teal|green|reader|scan|terminal|screen|emissive|glow|(^|[_\-\s])on($|[_\-\s])/.test(materialName)) {
    return "switch_active";
  }
  if (/(^|[_\-\s:])red($|[_\-\s])|danger|fault|hazard|locked|lockdown/.test(name)) return "danger_red";
  if (/route|path|gold|brass|amber|yellow|protocol|inlay|track_white/.test(name)) return "route_gold";
  if (/screen|label|waveform|terminal|display/.test(name)) return "screen_label";
  if (/glass|\bpane\b|window|acrylic|transparent/.test(name) || material.materialKind === 6) return "glass_shell";
  if (/warm_white|gallery_white|emissive_gallery_white|warm.*light|gallery.*light/.test(name)) return "exhibit_warm";
  if (/trim_light|soft_white_glint|panel_white/.test(name)) return "neutral_surface";
  if (/exhibit|warm|pin|archive|body_reference|voice/.test(name)) return "exhibit_warm";
  if (/black|dark|recess|underplate|shadow|smoked|gunmetal|titanium|beam|trim|metal|steel/.test(name)) return "structural_dark";
  if (/cyan|emissive|light|glow|scanner|strip|blade/.test(name) || material.materialKind === 4) return "cyan_emissive";
  if (/floor|tile/.test(name)) return "floor_surface";
  if (/ceiling/.test(name)) return "ceiling_surface";
  if (material.category === "room" || material.category === "door") return "neutral_surface";
  return "default";
}

function inferredPuzzleOrbVisualRole(materialName: string): RawMaterialVisualRole | null {
  if (!/puzzle_orb/.test(materialName)) return null;
  if (/stem|socket|pin/.test(materialName)) return "structural_dark";
  if (/glint|white/.test(materialName)) return "exhibit_warm";
  if (/holder|gold|brass/.test(materialName)) return "route_gold";
  if (/red/.test(materialName)) return "switch_inactive";
  if (/yellow/.test(materialName)) return "route_gold";
  if (/blue|glass|core/.test(materialName)) return "glass_shell";
  return "neutral_surface";
}

function visualRoleValue(role: RawMaterialVisualRole | string | null | undefined) {
  switch (role) {
    case "neutral_surface":
      return 1;
    case "floor_surface":
      return 2;
    case "ceiling_surface":
      return 3;
    case "structural_dark":
      return 4;
    case "glass_shell":
      return 5;
    case "exhibit_warm":
      return 6;
    case "cyan_emissive":
      return 7;
    case "route_gold":
      return 8;
    case "danger_red":
      return 9;
    case "screen_label":
      return 10;
    case "robot_body":
      return 11;
    case "door_locked_red":
      return 12;
    case "door_access_cyan":
      return 13;
    case "pickup_health":
      return 14;
    case "pickup_energy":
      return 15;
    case "pickup_ammo":
      return 16;
    case "pickup_key":
      return 17;
    case "switch_active":
      return 18;
    case "switch_inactive":
      return 19;
    default:
      return 0;
  }
}

function defaultSemanticParams(role: RawMaterialVisualRole | string | null | undefined): Tuple4 {
  switch (role) {
    case "neutral_surface":
      return [0.56, 0.05, 0.34, 0];
    case "floor_surface":
      return [0.70, 0.10, 0.30, 0];
    case "ceiling_surface":
      return [0.62, 0.08, 0.34, 0];
    case "structural_dark":
      return [0.82, 0.03, 0.48, 0];
    case "glass_shell":
      return [0.78, 0.18, 0.12, 0];
    case "exhibit_warm":
      return [0.76, 0.34, 0.18, 0];
    case "cyan_emissive":
      return [0.64, 0.30, 0.10, 0];
    case "route_gold":
      return [0.86, 0.42, 0.06, 0];
    case "danger_red":
      return [0.82, 0.26, 0.10, 0];
    case "screen_label":
      return [0.74, 0.36, 0.08, 0];
    case "robot_body":
      return [0.50, 0.18, 0.18, 0];
    case "door_locked_red":
      return [0.86, 0.36, 0.08, 0];
    case "door_access_cyan":
      return [0.82, 0.34, 0.08, 0];
    case "pickup_health":
      return [0.88, 0.30, 0.10, 0];
    case "pickup_energy":
      return [0.86, 0.38, 0.08, 0];
    case "pickup_ammo":
      return [0.72, 0.12, 0.20, 0];
    case "pickup_key":
      return [0.88, 0.40, 0.06, 0];
    case "switch_active":
      return [0.80, 0.34, 0.08, 0];
    case "switch_inactive":
      return [0.82, 0.30, 0.10, 0];
    default:
      return [0.35, 0.08, 0.18, 0];
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
