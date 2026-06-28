import { ultimateAbilityConfig, type UltimateAbilityId } from "../../game/config/ultimateAbilityConfig";

/** First-person weapon rendering mode for the Raw WebGPU backend. */
export type RawViewmodelMode = "raw" | "three" | "off";

/** Where the retired native raw viewmodel pass found its utility geometry. */
export type RawViewmodelAssetSource = "cooked-plan" | "none";

/** Cooked weapon viewmodel modelKeys, by weapon id, shared by official plans and deep builder packs. */
export const RAW_VIEWMODEL_MODEL_KEYS: Record<string, string> = {
  pulseRifle: "pickup_iron_rod_viewmodel_battleworn",
  railLance: "pickup_sidearm_viewmodel_battleworn",
};

/** Reusable first-person hand grip families. New weapons should choose one of these before adding a new hand asset. */
export type RawViewmodelHandGripFamily = "cylindrical" | "pistol";

/**
 * Cooked first-person hand assets by reusable grip family. The filenames still
 * come from the original weapon-specific bake, but the modelKeys are generic
 * so rods/pipes/batons can share cylindrical and sidearms can share pistol.
 */
export const RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS: Record<RawViewmodelHandGripFamily, string> = {
  cylindrical: "viewmodel_hand_cylindrical_grip_hp_baked",
  pistol: "viewmodel_hand_pistol_grip_hp_baked",
};

/** Weapon-to-grip matching. This is the reusable layer profiles consume. */
export const RAW_VIEWMODEL_HAND_GRIP_BY_WEAPON: Record<string, RawViewmodelHandGripFamily> = {
  pulseRifle: "cylindrical",
  railLance: "pistol",
};

/** Back-compatible weapon-keyed lookup used by builder/deep-bake collectors. */
export const RAW_VIEWMODEL_HAND_MODEL_KEYS: Record<string, string> = {
  pulseRifle: RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS[RAW_VIEWMODEL_HAND_GRIP_BY_WEAPON.pulseRifle],
  railLance: RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS[RAW_VIEWMODEL_HAND_GRIP_BY_WEAPON.railLance],
};

/** Camera-space held utility models. These must be present in cooked Raw WebGPU plans and builder deep-bake packs. */
export const RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS: Record<UltimateAbilityId, string> = Object.fromEntries(
  Object.values(ultimateAbilityConfig).map((ability) => [ability.id, ability.viewmodelModelKey]),
) as Record<UltimateAbilityId, string>;

export const RAW_VIEWMODEL_PROCEDURAL_MODEL_KEYS = new Set<string>(["ability_core_bomb_proxy"]);

export function isRawViewmodelProceduralModelKey(modelKey: string) {
  return RAW_VIEWMODEL_PROCEDURAL_MODEL_KEYS.has(modelKey);
}

export const RAW_VIEWMODEL_ULTIMATE_HAND_GRIP_BY_ABILITY: Record<UltimateAbilityId, RawViewmodelHandGripFamily> = Object.fromEntries(
  Object.values(ultimateAbilityConfig).map((ability) => [ability.id, ability.viewmodelGrip]),
) as Record<UltimateAbilityId, RawViewmodelHandGripFamily>;

/**
 * Resolves the requested viewmodel mode from URL params.
 * - Player-facing WebGPU defaults to the Three/R3F new-equipment overlay.
 * - Native raw viewmodel is intentionally retired because the cooked
 *   first-person weapon set does not match the desired art.
 * - Old ?rawViewmodelMode=raw&rawViewmodelExperimental=1 links are treated as
 *   compatibility aliases for the Three overlay.
 * - legacy ?rawViewmodel=0 still means off.
 */
export function parseRawViewmodelMode(
  modeParam: string | null,
  legacyViewmodelParam: string | null,
  experimentalParam: string | null = null,
): RawViewmodelMode {
  if (modeParam === "off") return "off";
  if (modeParam === "raw") return "three";
  if (modeParam === "three") return "three";
  if (legacyViewmodelParam === "0") return "off";
  return "three";
}

export function resolveEffectiveRawViewmodelMode(
  requestedMode: RawViewmodelMode,
  readiness: Pick<{ ready: boolean }, "ready">,
): RawViewmodelMode {
  void readiness;
  if (requestedMode === "off") return "off";
  if (requestedMode === "raw") return "three";
  return "three";
}
