import { ageMaterialRolePolicy, type AgeMaterialRole } from "./AgeMaterialRoles";

export type AgeTransparentMode = "opaque" | "alpha-test" | "sorted-alpha" | "weighted-oit";

export interface AgeTransparentPolicy {
  mode: AgeTransparentMode;
  alphaCutoff?: number;
  depthWrite: boolean;
  orderIndependent: boolean;
}

export function ageTransparentPolicyForRole(role: AgeMaterialRole): AgeTransparentPolicy {
  const policy = ageMaterialRolePolicy(role);
  if (policy.participatesInOit) {
    return { mode: "weighted-oit", depthWrite: false, orderIndependent: true };
  }
  if (policy.transparent) {
    return { mode: "sorted-alpha", depthWrite: false, orderIndependent: false };
  }
  return { mode: "opaque", depthWrite: true, orderIndependent: true };
}
