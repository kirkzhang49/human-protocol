import type { AgeRenderBackendKind } from "../core/AgeTypes";

export type AgeFallbackReason =
  | "webgpu-unavailable"
  | "adapter-request-failed"
  | "device-lost"
  | "pipeline-validation"
  | "feature-unsupported"
  | "asset-load-failed"
  | "manual";

export interface AgeFallbackDecision {
  action: "retry-webgpu" | "switch-backend" | "disable-feature" | "fail";
  backend?: AgeRenderBackendKind;
  feature?: string;
  message?: string;
}

export interface AgeFallbackPolicy {
  decide(reason: AgeFallbackReason, detail?: unknown): AgeFallbackDecision;
}

export const ageDefaultFallbackPolicy: AgeFallbackPolicy = {
  decide(reason) {
    if (reason === "webgpu-unavailable" || reason === "adapter-request-failed") {
      return {
        action: "switch-backend",
        backend: "three",
        message: "WebGPU is unavailable; use the configured non-WebGPU renderer.",
      };
    }
    if (reason === "pipeline-validation" || reason === "feature-unsupported") {
      return { action: "disable-feature", feature: "offscreen-post" };
    }
    if (reason === "device-lost") return { action: "retry-webgpu" };
    return { action: "fail" };
  },
};
