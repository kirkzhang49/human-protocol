import type { AgeBounds3, AgeTuple3 } from "../core/AgeTypes";
import type { AgeRenderPlanInstance, AgeRenderPlanMaterial } from "../contracts/AgeRenderPlanContracts";
import { ageMaterialRolePolicy } from "../materials/AgeMaterialRoles";
import type { AgeLocalLight } from "./AgeLightingProfile";

export interface AgeEmissiveLightExtractionOptions {
  maxLights: number;
  minStrength: number;
  defaultRange: number;
}

export function extractAgeEmissiveLights(
  instances: readonly AgeRenderPlanInstance[],
  materialsById: ReadonlyMap<string, AgeRenderPlanMaterial>,
  options: AgeEmissiveLightExtractionOptions,
) {
  const lights: AgeLocalLight[] = [];
  for (const instance of instances) {
    if (lights.length >= options.maxLights) break;
    const materialId = typeof instance.state?.materialId === "string" ? instance.state.materialId : null;
    const material = materialId ? materialsById.get(materialId) : null;
    const role = material?.role ?? instance.materialRole;
    if (!role || !ageMaterialRolePolicy(role).emitsLight) continue;
    const strength = material?.emissiveStrength ?? 0;
    if (strength < options.minStrength) continue;
    lights.push({
      id: `emissive:${instance.id}`,
      type: "point",
      color: material?.emissiveFactor ?? ([1, 1, 1] as AgeTuple3),
      intensity: strength,
      position: lightPositionForBounds(instance.bounds),
      range: options.defaultRange,
      role,
    });
  }
  return lights;
}

function lightPositionForBounds(bounds: AgeBounds3 | undefined): AgeTuple3 {
  if (!bounds) return [0, 1, 0];
  return [bounds.center[0], bounds.center[1] + bounds.size[1] * 0.15, bounds.center[2]];
}
