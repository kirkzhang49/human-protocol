import { ageClamp, ageClampTuple3, ageClampTuple4 } from "../core/AgeMath";
import type { AgeTuple3, AgeTuple4 } from "../core/AgeTypes";
import type { AgeRenderPlanMaterial } from "../contracts/AgeRenderPlanContracts";
import { ageMaterialRolePolicy, type AgeMaterialRole } from "./AgeMaterialRoles";

export const AGE_MATERIAL_RECORD_FLOATS = 32;

export interface AgeMaterialRecord {
  id: string;
  index: number;
  role: AgeMaterialRole;
  baseColorFactor: AgeTuple4;
  emissiveFactor: AgeTuple3;
  emissiveStrength: number;
  roughnessFactor: number;
  metallicFactor: number;
  alphaMode: "OPAQUE" | "MASK" | "BLEND";
  semanticParams: AgeTuple4;
}

export interface AgeMaterialPipeline {
  packMaterials(materials: readonly AgeRenderPlanMaterial[]): Float32Array;
}

export const ageDefaultMaterialPipeline: AgeMaterialPipeline = {
  packMaterials(materials) {
    return agePackMaterialRecords(materials.map(ageMaterialRecordFromPlanMaterial));
  },
};

export function ageMaterialRecordFromPlanMaterial(material: AgeRenderPlanMaterial): AgeMaterialRecord {
  return {
    id: material.id,
    index: material.index,
    role: material.role,
    baseColorFactor: ageClampTuple4(material.baseColorFactor, 0, 8),
    emissiveFactor: ageClampTuple3(material.emissiveFactor ?? [0, 0, 0], 0, 8),
    emissiveStrength: ageClamp(material.emissiveStrength ?? 0, 0, 16),
    roughnessFactor: ageClamp(material.roughnessFactor ?? 0.72, 0.04, 1),
    metallicFactor: ageClamp(material.metallicFactor ?? 0, 0, 1),
    alphaMode: material.alphaMode ?? "OPAQUE",
    semanticParams: material.semanticParams ?? defaultSemanticParams(material.role),
  };
}

export function agePackMaterialRecords(records: readonly AgeMaterialRecord[]) {
  const maxIndex = records.reduce((max, record) => Math.max(max, record.index), 0);
  const floats = new Float32Array((maxIndex + 1) * AGE_MATERIAL_RECORD_FLOATS);
  for (const record of records) {
    const offset = record.index * AGE_MATERIAL_RECORD_FLOATS;
    floats.set(record.baseColorFactor, offset);
    floats.set([...record.emissiveFactor, record.emissiveStrength], offset + 4);
    floats.set([
      record.roughnessFactor,
      record.metallicFactor,
      alphaModeValue(record.alphaMode),
      ageMaterialRolePolicy(record.role).bloomWeight,
    ], offset + 8);
    floats.set(record.semanticParams, offset + 12);
  }
  return floats;
}

function alphaModeValue(value: AgeMaterialRecord["alphaMode"]) {
  if (value === "MASK") return 1;
  if (value === "BLEND") return 2;
  return 0;
}

function defaultSemanticParams(role: AgeMaterialRole): AgeTuple4 {
  const policy = ageMaterialRolePolicy(role);
  return [
    policy.transparent ? 1 : 0,
    policy.emitsLight ? 1 : 0,
    policy.receivesContactShadow ? 1 : 0,
    policy.bloomWeight,
  ];
}
