export type AgeBuiltInMaterialRole =
  | "default"
  | "neutral-surface"
  | "floor-surface"
  | "ceiling-surface"
  | "structural-dark"
  | "transparent-glass"
  | "emissive-accent"
  | "route-marker"
  | "danger-marker"
  | "screen-label"
  | "character-body"
  | "pickup"
  | "interactive-active"
  | "interactive-inactive";

export type AgeMaterialRole = AgeBuiltInMaterialRole | string;

export interface AgeMaterialRolePolicy {
  role: AgeMaterialRole;
  transparent: boolean;
  participatesInOit: boolean;
  emitsLight: boolean;
  receivesContactShadow: boolean;
  reflection: "none" | "room-probe" | "environment" | "planar" | "adapter";
  bloomWeight: number;
}

export const AGE_MATERIAL_ROLE_POLICY: Record<AgeBuiltInMaterialRole, AgeMaterialRolePolicy> = {
  default: rolePolicy("default"),
  "neutral-surface": rolePolicy("neutral-surface", { receivesContactShadow: true, reflection: "room-probe" }),
  "floor-surface": rolePolicy("floor-surface", { receivesContactShadow: true, reflection: "planar" }),
  "ceiling-surface": rolePolicy("ceiling-surface", { reflection: "room-probe" }),
  "structural-dark": rolePolicy("structural-dark", { receivesContactShadow: true, reflection: "room-probe" }),
  "transparent-glass": rolePolicy("transparent-glass", {
    transparent: true,
    participatesInOit: true,
    receivesContactShadow: false,
    reflection: "environment",
    bloomWeight: 0.12,
  }),
  "emissive-accent": rolePolicy("emissive-accent", {
    emitsLight: true,
    reflection: "room-probe",
    bloomWeight: 0.7,
  }),
  "route-marker": rolePolicy("route-marker", { emitsLight: true, bloomWeight: 0.35 }),
  "danger-marker": rolePolicy("danger-marker", { emitsLight: true, bloomWeight: 0.42 }),
  "screen-label": rolePolicy("screen-label", { emitsLight: true, bloomWeight: 0.56 }),
  "character-body": rolePolicy("character-body", { receivesContactShadow: true, reflection: "room-probe" }),
  pickup: rolePolicy("pickup", { receivesContactShadow: true, emitsLight: true, bloomWeight: 0.26 }),
  "interactive-active": rolePolicy("interactive-active", { emitsLight: true, bloomWeight: 0.4 }),
  "interactive-inactive": rolePolicy("interactive-inactive", { emitsLight: true, bloomWeight: 0.22 }),
};

export function ageMaterialRolePolicy(role: AgeMaterialRole): AgeMaterialRolePolicy {
  return AGE_MATERIAL_ROLE_POLICY[role as AgeBuiltInMaterialRole] ?? rolePolicy(role, { reflection: "adapter" });
}

function rolePolicy(
  role: AgeMaterialRole,
  overrides: Partial<Omit<AgeMaterialRolePolicy, "role">> = {},
): AgeMaterialRolePolicy {
  return {
    role,
    transparent: false,
    participatesInOit: false,
    emitsLight: false,
    receivesContactShadow: false,
    reflection: "none",
    bloomWeight: 0,
    ...overrides,
  };
}
