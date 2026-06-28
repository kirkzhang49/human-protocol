import type { AgeMaterialRole } from "@age/render-webgpu";
import type { RawMaterialVisualRole } from "../../render/raw-webgpu/RawWebGpuTypes";

/**
 * Maps Human Protocol raw material visual roles onto generic AGE material
 * roles. Human semantics (doors, pickups, switches, museum exhibits) stop at
 * this boundary; the engine only ever sees the generic role and its policy.
 */
const HUMAN_VISUAL_ROLE_TO_AGE_ROLE: Record<RawMaterialVisualRole, AgeMaterialRole> = {
  default: "default",
  neutral_surface: "neutral-surface",
  floor_surface: "floor-surface",
  ceiling_surface: "ceiling-surface",
  structural_dark: "structural-dark",
  glass_shell: "transparent-glass",
  exhibit_warm: "human-protocol:exhibit-warm",
  cyan_emissive: "emissive-accent",
  route_gold: "route-marker",
  danger_red: "danger-marker",
  screen_label: "screen-label",
  robot_body: "character-body",
  door_locked_red: "danger-marker",
  door_access_cyan: "emissive-accent",
  pickup_health: "pickup",
  pickup_energy: "pickup",
  pickup_ammo: "pickup",
  pickup_key: "pickup",
  switch_active: "interactive-active",
  switch_inactive: "interactive-inactive",
};

export function ageMaterialRoleForHumanVisualRole(
  visualRole: RawMaterialVisualRole | string | null | undefined,
): AgeMaterialRole | null {
  if (!visualRole) return null;
  return HUMAN_VISUAL_ROLE_TO_AGE_ROLE[visualRole as RawMaterialVisualRole] ?? null;
}

/**
 * Name/category inference fallback for materials and instances that carry no
 * explicit visual role. This owns the regex policy that previously lived
 * inside RawWebGpuMaterialPipeline role inference.
 */
export function ageMaterialRoleForHumanName(name: string | null | undefined, category?: string | null): AgeMaterialRole {
  const subject = `${name ?? ""} ${category ?? ""}`;
  if (/glass|transparent|acrylic/i.test(subject)) return "transparent-glass";
  if (/floor|ground/i.test(subject)) return "floor-surface";
  if (/ceiling/i.test(subject)) return "ceiling-surface";
  if (/robot|enemy|character|drone/i.test(subject)) return "character-body";
  if (/pickup|key|cell|ammo|repair/i.test(subject)) return "pickup";
  if (/switch|lever|button/i.test(subject)) return "interactive-inactive";
  if (/danger|hazard|locked/i.test(subject)) return "danger-marker";
  if (/route|path|guide/i.test(subject)) return "route-marker";
  if (/screen|label|display/i.test(subject)) return "screen-label";
  if (/emissive|light|glow|neon/i.test(subject)) return "emissive-accent";
  if (/dark|frame|beam|structural/i.test(subject)) return "structural-dark";
  return "neutral-surface";
}

export function ageMaterialRoleForHumanMaterial(material: {
  visualRole?: RawMaterialVisualRole | string | null;
  name: string;
  category?: string | null;
}): AgeMaterialRole {
  return (
    ageMaterialRoleForHumanVisualRole(material.visualRole) ??
    ageMaterialRoleForHumanName(material.name, material.category)
  );
}
