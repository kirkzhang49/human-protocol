import type { AgeId, AgeTuple3 } from "../core/AgeTypes";

export interface AgeBillboardVfxRecord {
  id: AgeId;
  kind: string;
  position: AgeTuple3;
  direction?: AgeTuple3;
  color: AgeTuple3;
  radius: number;
  power: number;
  ageSeconds: number;
  lifetimeSeconds: number;
}

export interface AgeVfxBudget {
  maxProjectiles: number;
  maxEffects: number;
  maxParticleEmitters: number;
  maxGpuParticles: number;
}

export const ageDefaultVfxBudget: AgeVfxBudget = {
  maxProjectiles: 128,
  maxEffects: 128,
  maxParticleEmitters: 64,
  maxGpuParticles: 1024,
};
