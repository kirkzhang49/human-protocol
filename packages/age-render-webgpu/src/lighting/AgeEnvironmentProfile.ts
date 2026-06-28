import type { AgeId, AgeTuple3 } from "../core/AgeTypes";

export interface AgeEnvironmentProfile {
  id: AgeId;
  label?: string;
  source:
    | { type: "analytic-room"; roomId?: AgeId }
    | { type: "texture"; textureId: AgeId }
    | { type: "prefiltered-env"; textureId: AgeId; mipCount: number }
    | { type: "adapter" };
  diffuseLift: number;
  specularStrength: number;
  roughnessBias: number;
  tint?: AgeTuple3;
}

export const ageDefaultEnvironmentProfile: AgeEnvironmentProfile = {
  id: "age.default.environment",
  source: { type: "analytic-room" },
  diffuseLift: 0.18,
  specularStrength: 0.22,
  roughnessBias: 0,
};
