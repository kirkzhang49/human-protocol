import type { RawRenderPlan } from "./RawWebGpuTypes";

export type RawMuseumEnvProfileId = "museum_neutral_gallery" | "museum_dark_luxury" | "museum_white_box";

export interface RawMuseumEnvProfile {
  id: RawMuseumEnvProfileId;
  shaderProfileCode: number;
}

export function resolveRawMuseumEnvProfile(plan: Pick<RawRenderPlan, "level">): RawMuseumEnvProfile {
  const override = readEnvOverride();
  if (override) return override;
  if (plan.level.id === "level_03_human_museum") {
    return {
      id: "museum_dark_luxury",
      shaderProfileCode: 1,
    };
  }
  return {
    id: "museum_neutral_gallery",
    shaderProfileCode: 0,
  };
}

function readEnvOverride(): RawMuseumEnvProfile | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("rawMuseumEnv")?.trim().toLowerCase();
  if (value === "dark" || value === "dark_luxury" || value === "museum_dark_luxury") {
    return {
      id: "museum_dark_luxury",
      shaderProfileCode: 1,
    };
  }
  if (value === "white" || value === "white_box" || value === "museum_white_box") {
    return {
      id: "museum_white_box",
      shaderProfileCode: 2,
    };
  }
  if (value === "neutral" || value === "gallery" || value === "museum_neutral_gallery") {
    return {
      id: "museum_neutral_gallery",
      shaderProfileCode: 0,
    };
  }
  return null;
}
