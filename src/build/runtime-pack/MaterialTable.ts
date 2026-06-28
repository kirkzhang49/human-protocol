import type { RawPlanMaterial, Tuple3, Tuple4 } from "../../render/raw-webgpu/RawWebGpuTypes";
import type { CookedGlbMaterial } from "./cookGlbModels";
import { enemyPremiumLightingPalette } from "../../game/visual/EnemyLightingPalette";

interface BuilderSurfaceMaterialTextureSlot {
  layer: number;
  name?: string | null;
  url?: string | null;
  mimeType?: string | null;
}

/**
 * Interns runtime materials for the builder runtime pack (indexes 0/1 are
 * reserved engine built-ins). Extracted verbatim from compileBuilderRuntimePack;
 * the sRGB→linear color helpers travel with it since nothing else uses them.
 */
const PROP_BODY_PALETTE = [
  { id: "prop:warm", color: "#7a6448", roughness: 0.66, visualRole: "exhibit_warm" },
  { id: "prop:metal", color: "#48565e", roughness: 0.42, visualRole: "neutral_surface" },
  { id: "prop:dark", color: "#2a3038", roughness: 0.58, visualRole: "structural_dark" },
  { id: "prop:cool", color: "#3c5468", roughness: 0.5, visualRole: "neutral_surface" },
] as const;

export class MaterialTable {
  private readonly byKey = new Map<string, number>();
  private readonly records: RawPlanMaterial[] = [];
  private nextIndex = 2;
  private cookedMaterials = 0;

  /** Interns a cooked GLB material, preserving PBR factors, alpha mode, and base color texture slot. */
  cooked(modelKey: string, material: CookedGlbMaterial, textureSlot?: { layer: number; stats?: { lumaMean: number; contrast: number; chroma: number; detail: number } }): number {
    const key = `cooked:${modelKey}:${material.name}`;
    const existing = this.byKey.get(key);
    if (existing !== undefined) return existing;
    const index = this.nextIndex;
    this.nextIndex += 1;
    const emissive = material.emissiveStrength > 0.05 || Math.max(...material.emissiveFactor) > 0.05;
    // Browser deep-cook never bakes base color textures (cookGlbModels v1 carries
    // the look in material factors only). Several premium furniture/console GLBs
    // — the puzzle/route consoles especially — ship intentionally near-black
    // baseColorFactors ("powder_coated_dark_body" ≈ 0.07, "dead_black_screen" ≈
    // 0.008) that rely on a baked albedo texture for readable detail offline.
    // Without that texture, neutral_surface shading only scales the authored
    // luminance, so those opaque, non-emissive surfaces collapse to solid black
    // in /build deep playtest. Lift textureless near-black opaque cooked
    // surfaces to a dark-but-visible charcoal floor, preserving hue + relative
    // tone (emissive cyan/amber trims and BLEND glass are left untouched so the
    // console keeps its designed accents). The offline-baked official plans go
    // through neither this path nor textureless cooked materials.
    // Deep-playtest enemy robots are cooked from their GLBs, which color the bot
    // through *named* PBR factors (mat_body_*, mat_deep_gunmetal_*, mat_scanner_*…)
    // with no albedo texture. The campaign's Three path recolors those by name to
    // the premium cyan-graphite palette (polishEnemyMaterial), but this cooked raw
    // path has no such step — so the near-black armor/gunmetal/joint bulk only gets
    // lifted to neutral charcoal and the bot reads as colorless. Mirror that
    // name→palette recolor here so cooked enemies match the campaign look. Only the
    // builder deep-cook path runs through this; offline-baked official plans don't.
    const enemyLook =
      modelKey.startsWith(ENEMY_MODEL_KEY_PREFIX) && material.alphaMode !== "BLEND"
        ? cookedEnemyMaterialLook(material.name, modelKey)
        : null;
    const routeLook =
      modelKey === "builder_route_switch_console" && material.alphaMode !== "BLEND"
        ? cookedRouteSwitchMaterialLook(material.name)
        : null;
    const routeOrbLook = modelKey.startsWith("pickup_route_output_orb_")
      ? cookedRouteOutputOrbMaterialLook(material.name, modelKey)
      : null;
    const alphaMode = routeOrbLook?.alphaMode ?? routeLook?.alphaMode ?? material.alphaMode;
    const baseColorFactor: Tuple4 = routeOrbLook
      ? [...hexToLinear(routeOrbLook.base), routeOrbLook.alpha ?? material.baseColorFactor[3]]
      : enemyLook
        ? [...hexToLinear(enemyLook.base), material.baseColorFactor[3]]
      : routeLook
        ? [...hexToLinear(routeLook.base), routeLook.alpha ?? material.baseColorFactor[3]]
      : !textureSlot && !emissive && material.alphaMode !== "BLEND"
        ? normalizeTexturelessBaseColor(material.baseColorFactor)
        : material.baseColorFactor;
    const emissiveFactor: Tuple3 = routeOrbLook?.emissive
      ? hexToLinear(routeOrbLook.emissive)
      : routeLook?.emissive
      ? hexToLinear(routeLook.emissive)
      : enemyLook?.emissive
        ? hexToLinear(enemyLook.emissive)
        : material.emissiveFactor;
    const emissiveStrength =
      routeOrbLook
        ? routeOrbLook.emissiveStrength
      : routeLook
        ? routeLook.emissiveStrength
        : enemyLook?.emissive !== undefined
          ? enemyLook.emissiveStrength
          : Math.min(4, material.emissiveStrength);
    const visualRole =
      routeOrbLook
        ? routeOrbLook.visualRole
      : alphaMode === "BLEND"
        ? "glass_shell"
        : routeLook
          ? routeLook.visualRole
        : enemyLook?.emissive !== undefined || emissive
          ? "cyan_emissive"
          : "neutral_surface";
    this.records.push({
      ...(textureSlot
        ? {
            textures: [
              {
                semantic: "baseColor" as const,
                present: true,
                colorSpace: "srgb" as const,
                layer: textureSlot.layer,
                stats: textureSlot.stats ?? null,
              },
            ],
          }
        : {}),
      index,
      id: `builder:cooked-material:${index}`,
      name: `${modelKey}:${material.name}`,
      category: "builder-cooked-glb",
      visualRole,
      baseColorFactor,
      emissiveFactor,
      emissiveStrength,
      roughnessFactor: routeOrbLook?.roughness ?? routeLook?.roughness ?? material.roughnessFactor,
      metallicFactor: routeOrbLook?.metallic ?? routeLook?.metallic ?? material.metallicFactor,
      aoStrength: 1,
      materialKind: routeOrbLook?.materialKind ?? routeLook?.materialKind ?? 0,
      alphaMode,
      ...(routeOrbLook?.alphaMode === "BLEND" || routeLook?.alphaMode === "BLEND"
        ? {
            transparency: {
              mode: "blend" as const,
              alpha: routeOrbLook?.alpha ?? routeLook?.alpha ?? 0.24,
              source: routeOrbLook ? "route_output_orb_cooked_material" : "route_switch_console_cooked_material",
            },
          }
        : {}),
      doubleSided: routeOrbLook?.doubleSided ?? routeLook?.doubleSided ?? material.doubleSided,
    });
    this.byKey.set(key, index);
    this.cookedMaterials += 1;
    return index;
  }

  cookedCount() {
    return this.cookedMaterials;
  }

  transparentCount() {
    return this.records.filter((record) => record.alphaMode === "BLEND").length;
  }

  nativeRaw(sourceMaterials: readonly RawPlanMaterial[], sourceLevelId: string): Map<number, number> {
    const remap = new Map<number, number>();
    for (const material of sourceMaterials) {
      if (!Number.isFinite(material.index) || material.index < 0) continue;
      const key = `native-raw:${sourceLevelId}:${material.index}:${material.id}`;
      const existing = this.byKey.get(key);
      if (existing !== undefined) {
        remap.set(material.index, existing);
        continue;
      }
      const index = this.nextIndex;
      this.nextIndex += 1;
      this.records.push({
        ...material,
        index,
        id: `builder:native-raw:${sourceLevelId}:${index}:${material.id}`,
        category: material.category || "native-raw",
        textures: material.textures?.map((texture) => ({ ...texture })),
      });
      this.byKey.set(key, index);
      remap.set(material.index, index);
    }
    return remap;
  }

  surface(
    key: string,
    options: {
      color: string;
      roughness: number;
      visualRole: string;
      baseColorTexture?: BuilderSurfaceMaterialTextureSlot | null;
      emissiveColor?: string;
      emissiveStrength?: number;
      alphaMode?: RawPlanMaterial["alphaMode"];
      doubleSided?: boolean;
      transparency?: RawPlanMaterial["transparency"];
    },
  ): number {
    const textureKey = options.baseColorTexture ? `:base:${options.baseColorTexture.layer}:${options.baseColorTexture.url ?? ""}` : "";
    const emissiveKey = options.emissiveColor ? `:emissive:${options.emissiveColor}:${options.emissiveStrength ?? 0}` : "";
    const alphaKey = options.alphaMode ? `:alpha:${options.alphaMode}:${options.doubleSided ? "2s" : "1s"}` : "";
    const transparencyKey = options.transparency ? `:${options.transparency.mode}:${options.transparency.alpha}` : "";
    return this.intern(`surface:${key}:${options.color}:${options.roughness}${textureKey}${emissiveKey}${alphaKey}${transparencyKey}`, () => ({
      baseColorFactor: [...hexToLinear(options.color), 1] as Tuple4,
      emissiveFactor: options.emissiveColor ? hexToLinear(options.emissiveColor) : ([0, 0, 0] as Tuple3),
      emissiveStrength: options.emissiveStrength ?? 0,
      roughnessFactor: options.roughness,
      metallicFactor: 0.04,
      visualRole: options.visualRole,
      name: key,
      alphaMode: options.alphaMode,
      doubleSided: options.doubleSided,
      transparency: options.transparency,
      textures: options.baseColorTexture
        ? [
            {
              semantic: "baseColor" as const,
              present: true,
              colorSpace: "srgb" as const,
              layer: options.baseColorTexture.layer,
              name: options.baseColorTexture.name ?? null,
              url: options.baseColorTexture.url ?? null,
              mimeType: options.baseColorTexture.mimeType ?? null,
              stats: null,
            },
          ]
        : undefined,
    }));
  }

  emissive(key: string, hexColor: string, strength: number, visualRole = "cyan_emissive"): number {
    return this.intern(`emissive:${key}:${hexColor}:${strength}`, () => {
      const rgb = hexToLinear(hexColor);
      return {
        baseColorFactor: [rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5, 1] as Tuple4,
        emissiveFactor: rgb,
        emissiveStrength: strength,
        roughnessFactor: 0.4,
        metallicFactor: 0,
        visualRole,
        name: key,
      };
    });
  }

  propBody(modelKey: string): number {
    let hash = 0;
    for (let index = 0; index < modelKey.length; index += 1) hash = (hash * 31 + modelKey.charCodeAt(index)) >>> 0;
    const palette = PROP_BODY_PALETTE[hash % PROP_BODY_PALETTE.length];
    return this.surface(palette.id, palette);
  }

  private intern(
    key: string,
    build: () => {
      baseColorFactor: Tuple4;
      emissiveFactor: Tuple3;
      emissiveStrength: number;
      roughnessFactor: number;
      metallicFactor: number;
      visualRole: string;
      name: string;
      alphaMode?: RawPlanMaterial["alphaMode"];
      doubleSided?: boolean;
      transparency?: RawPlanMaterial["transparency"];
      textures?: RawPlanMaterial["textures"];
    },
  ): number {
    const existing = this.byKey.get(key);
    if (existing !== undefined) return existing;
    const index = this.nextIndex;
    this.nextIndex += 1;
    const fields = build();
    this.records.push({
      index,
      id: `builder:material:${index}`,
      name: fields.name,
      category: "builder-runtime",
      visualRole: fields.visualRole,
      baseColorFactor: fields.baseColorFactor,
      emissiveFactor: fields.emissiveFactor,
      emissiveStrength: fields.emissiveStrength,
      roughnessFactor: fields.roughnessFactor,
      metallicFactor: fields.metallicFactor,
      aoStrength: 1,
      materialKind: 0,
      alphaMode: fields.alphaMode ?? "OPAQUE",
      doubleSided: fields.doubleSided ?? false,
      ...(fields.transparency ? { transparency: fields.transparency } : {}),
      ...(fields.textures ? { textures: fields.textures } : {}),
    });
    this.byKey.set(key, index);
    return index;
  }

  list(): RawPlanMaterial[] {
    return this.records;
  }
}

const ENEMY_MODEL_KEY_PREFIX = "hp_enemy_";

interface CookedEnemyMaterialLook {
  base: string;
  emissive?: string;
  emissiveStrength: number;
}

interface CookedRouteSwitchMaterialLook {
  base: string;
  emissive?: string;
  emissiveStrength: number;
  visualRole: string;
  alphaMode?: RawPlanMaterial["alphaMode"];
  alpha?: number;
  doubleSided?: boolean;
  roughness?: number;
  metallic?: number;
  materialKind?: number;
}

interface CookedRouteOutputOrbMaterialLook {
  base: string;
  emissive?: string;
  emissiveStrength: number;
  visualRole: string;
  alphaMode?: RawPlanMaterial["alphaMode"];
  alpha?: number;
  doubleSided?: boolean;
  roughness?: number;
  metallic?: number;
  materialKind?: number;
}

/**
 * Cooked-path mirror of EnemyModelInstance.polishEnemyMaterial: maps an enemy GLB
 * material's authored name to the premium cyan-graphite palette so deep-playtest
 * robots (cooked from textureless, factor-colored GLBs) read with the same body /
 * armor / glowing core+scanner / amber-warning accents as the campaign's Three
 * path instead of collapsing to neutral charcoal. Names that match no role return
 * null and keep their authored factor (warm trims stay warm; the near-black lift
 * still handles any leftover textureless darks).
 */
function cookedEnemyMaterialLook(materialName: string, modelKey: string): CookedEnemyMaterialLook | null {
  const name = materialName.toLowerCase();
  const palette = enemyPremiumLightingPalette;
  const isBoss =
    modelKey === "hp_enemy_custodian_foreman_horror" || modelKey === "hp_enemy_reclamation_mother_final_horror";
  const isMuseumSmall =
    modelKey === "hp_enemy_repair_drone_horror" ||
    modelKey === "hp_enemy_clamp_repair_horror" ||
    modelKey === "hp_enemy_shield_technician_horror";
  const isRepairDrone = modelKey === "hp_enemy_repair_drone_horror";

  if (name.includes("scanner") || name.includes("core") || name.includes("cyan") || name.includes("beam")) {
    return {
      base: isMuseumSmall ? "#8bbfba" : palette.core,
      emissive: isMuseumSmall ? "#3e8e8a" : palette.coreEmissive,
      emissiveStrength: isBoss ? 1.22 : isMuseumSmall ? 0.46 : 0.78,
    };
  }
  if (name.includes("warning") || name.includes("amber")) {
    return { base: palette.warning, emissive: palette.warningEmissive, emissiveStrength: isBoss ? 0.54 : 0.24 };
  }
  if (name.includes("body") || name.includes("panel") || name.includes("off_white")) {
    return { base: isMuseumSmall ? "#747a70" : palette.body, emissiveStrength: 0 };
  }
  if (name.includes("dark") || name.includes("armor") || name.includes("gunmetal")) {
    return { base: isRepairDrone ? "#303630" : isMuseumSmall ? "#282d2a" : palette.armor, emissiveStrength: 0 };
  }
  if (name.includes("rubber") || name.includes("joint")) {
    if (isRepairDrone) return { base: "#202827", emissiveStrength: 0 };
    return null;
  }
  return null;
}

function cookedRouteSwitchMaterialLook(materialName: string): CookedRouteSwitchMaterialLook | null {
  const name = materialName.toLowerCase();
  if (name.includes("route_console_smoked_glass")) {
    return {
      base: "#7ed9e6",
      emissive: "#3de8ff",
      emissiveStrength: 0.18,
      visualRole: "glass_shell",
      alphaMode: "BLEND",
      alpha: 0.28,
      doubleSided: true,
      roughness: 0.18,
      metallic: 0.02,
      materialKind: 6,
    };
  }
  if (name.includes("route_console_cyan_glass")) {
    return {
      base: "#8df6ff",
      emissive: "#5cf7ff",
      emissiveStrength: 0.34,
      visualRole: "glass_shell",
      alphaMode: "BLEND",
      alpha: 0.38,
      doubleSided: true,
      roughness: 0.12,
      metallic: 0.02,
      materialKind: 6,
    };
  }
  if (name.includes("screen")) {
    return { base: "#0b7f8e", emissive: "#31f2ff", emissiveStrength: 0.72, visualRole: "switch_active" };
  }
  if (name.includes("parts_lit") || name.includes("hub") || name.includes("tube_gloss")) {
    return { base: "#27d9cf", emissive: "#5df6ff", emissiveStrength: name.includes("parts_lit") ? 1.15 : 0.84, visualRole: "cyan_emissive" };
  }
  if (name.includes("blue_memory")) {
    return { base: "#245dff", emissive: "#4faaff", emissiveStrength: 0.78, visualRole: "cyan_emissive" };
  }
  if (name.includes("green_ready")) {
    return { base: "#18c975", emissive: "#55ffae", emissiveStrength: 0.6, visualRole: "switch_active" };
  }
  if (name.includes("red_fault")) {
    return { base: "#df342d", emissive: "#ff4f3e", emissiveStrength: 0.36, visualRole: "switch_inactive" };
  }
  if (name.includes("amber_status")) {
    return { base: "#d9912e", emissive: "#ffb84a", emissiveStrength: 0.68, visualRole: "route_gold" };
  }
  if (name.includes("brass") || name.includes("gold")) {
    return { base: "#b78335", emissiveStrength: 0, visualRole: "route_gold" };
  }
  if (name.includes("route_surf") || name.includes("parts_flat")) {
    return { base: "#1fb89e", emissive: "#4fead7", emissiveStrength: name.includes("flat") ? 0.26 : 0.18, visualRole: "switch_active" };
  }
  if (name.includes("powder") || name.includes("soft_black") || name.includes("rubber")) {
    return { base: "#17242b", emissiveStrength: 0, visualRole: "structural_dark" };
  }
  return null;
}

function cookedRouteOutputOrbMaterialLook(materialName: string, modelKey: string): CookedRouteOutputOrbMaterialLook | null {
  const name = materialName.toLowerCase();
  const accent = cookedRouteOutputOrbAccent(modelKey);
  if (name.includes("transparent_outer_shell") || name.includes("outer_shell") || name.includes("glass_shell") || name.includes("crystal_shell")) {
    return {
      base: "#e8ffff",
      emissive: accent,
      emissiveStrength: 0.22,
      visualRole: "glass_shell",
      alphaMode: "BLEND",
      alpha: 0.24,
      doubleSided: true,
      roughness: 0.02,
      metallic: 0.02,
    };
  }
  if (name.includes("inner_light") || name.includes("light_core") || name.includes("equator") || name.includes("glow")) {
    return {
      base: accent,
      emissive: accent,
      emissiveStrength: 2.1,
      visualRole: "cyan_emissive",
      alphaMode: "BLEND",
      alpha: 0.82,
      doubleSided: true,
      roughness: 0.08,
      metallic: 0,
    };
  }
  if (name.includes("image2") || name.includes("wrap_inner_sphere") || name.includes("inner_sphere") || name.includes("sticker")) {
    return {
      base: "#ffffff",
      emissive: accent,
      emissiveStrength: 0.92,
      visualRole: "screen_label",
      roughness: 0.22,
      metallic: 0.08,
    };
  }
  return null;
}

function cookedRouteOutputOrbAccent(modelKey: string) {
  if (modelKey.endsWith("_2")) return "#ffd76b";
  if (modelKey.endsWith("_3")) return "#71dc92";
  if (modelKey.endsWith("_4")) return "#b995ff";
  return "#72e8ff";
}

// Minimum readable linear luminance for a textureless opaque cooked surface.
// 0.07 reads as a lit dark charcoal under the builder runtime lights without
// flattening the console into mid-gray; surfaces already above it are kept as
// authored so brighter trims/bodies retain their relative tone.
const NEAR_BLACK_LUMA_FLOOR = 0.07;
// Cap how hard a single channel is scaled so a ~0.005 "dead black screen" lifts
// to a deep readable charcoal rather than washing out to neutral gray.
const NEAR_BLACK_MAX_LIFT = 9;
// Maximum readable linear luminance for a textureless opaque cooked surface.
// glTF materials whose albedo lived in a base-color *texture* default their
// baseColorFactor to ~white ([1,1,1]); the browser deep-cook strips textures
// (see comment above), so those surfaces render as stark white "blobs" — the
// museum plinth/marble props and assorted premium furniture. 0.42 (~sRGB 0.68)
// reads as a believable lit pale stone/plaster under the builder runtime lights
// without flattening to mid-gray. The mirror image of NEAR_BLACK_LUMA_FLOOR.
const NEAR_WHITE_LUMA_CEILING = 0.42;

/**
 * Lifts a near-black base color toward NEAR_BLACK_LUMA_FLOOR while preserving
 * hue and relative tone (uniform RGB scale). Colors already at/above the floor
 * are returned unchanged. Used only for textureless, opaque, non-emissive
 * cooked GLB materials whose authored albedo would otherwise render solid black.
 */
function liftNearBlackBaseColor(color: Tuple4): Tuple4 {
  const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  if (luma >= NEAR_BLACK_LUMA_FLOOR) return color;
  const scale = Math.min(NEAR_BLACK_MAX_LIFT, NEAR_BLACK_LUMA_FLOOR / Math.max(luma, 1e-4));
  return [
    Math.min(1, color[0] * scale),
    Math.min(1, color[1] * scale),
    Math.min(1, color[2] * scale),
    color[3],
  ];
}

/**
 * Normalizes a textureless cooked base color into the readable band: lifts
 * near-black up to the charcoal floor, then compresses near-white down to the
 * pale-stone ceiling. Hue + relative tone are preserved (uniform RGB scale), so
 * a warm marble stays warm and a cool plinth stays cool — they just stop reading
 * as solid black or a stark white blob. Used only for textureless, opaque,
 * non-emissive cooked GLB materials (the browser deep-cook strips albedo
 * textures, so these factors are all the surface has to go on).
 */
function normalizeTexturelessBaseColor(color: Tuple4): Tuple4 {
  const lifted = liftNearBlackBaseColor(color);
  const luma = lifted[0] * 0.2126 + lifted[1] * 0.7152 + lifted[2] * 0.0722;
  if (luma <= NEAR_WHITE_LUMA_CEILING) return lifted;
  const scale = NEAR_WHITE_LUMA_CEILING / Math.max(luma, 1e-4);
  return [lifted[0] * scale, lifted[1] * scale, lifted[2] * scale, lifted[3]];
}

function hexToLinear(hex: string): Tuple3 {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return [0.5, 0.5, 0.5];
  const value = Number.parseInt(match[1], 16);
  return [
    srgbToLinear(((value >> 16) & 0xff) / 255),
    srgbToLinear(((value >> 8) & 0xff) / 255),
    srgbToLinear((value & 0xff) / 255),
  ];
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}
