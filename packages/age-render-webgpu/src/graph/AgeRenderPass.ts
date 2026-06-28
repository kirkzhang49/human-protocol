import type { AgeRendererContext } from "../core/AgeRendererContext";
import type { AgeSceneFrame } from "../core/AgeSceneFrame";
import type { AgeFrameEncoder } from "./AgeFrameEncoder";
import type { AgeFrameTargets } from "./AgeFrameTargets";
import type { AgeGraphResourceRef } from "./AgeGraphResource";

export type AgeRenderPassPhase =
  | "prepare"
  | "shadow"
  | "opaque"
  | "transparent"
  | "vfx"
  | "post"
  | "present";

export interface AgeRenderPassResourceUse {
  reads?: readonly AgeGraphResourceRef[];
  optionalReads?: readonly AgeGraphResourceRef[];
  writes?: readonly AgeGraphResourceRef[];
}

export interface AgeRenderPass {
  readonly id: string;
  readonly phase: AgeRenderPassPhase;
  readonly resources?: AgeRenderPassResourceUse;
  readonly enabled?: boolean | ((frame: AgeSceneFrame, context: AgeRendererContext) => boolean);
  setup?(context: AgeRendererContext): void | Promise<void>;
  createResources?(context: AgeRendererContext, targets: AgeFrameTargets): void | Promise<void>;
  createPipelines?(context: AgeRendererContext): void | Promise<void>;
  resize?(context: AgeRendererContext, targets: AgeFrameTargets): void;
  updateFrameData?(context: AgeRendererContext, frame: AgeSceneFrame, targets: AgeFrameTargets): void | Promise<void>;
  encode?(
    context: AgeRendererContext,
    frame: AgeSceneFrame,
    targets: AgeFrameTargets,
    encoder: AgeFrameEncoder,
  ): void | Promise<void>;
  execute?(
    context: AgeRendererContext,
    frame: AgeSceneFrame,
    targets: AgeFrameTargets,
    encoder: AgeFrameEncoder,
  ): void | Promise<void>;
  dispose?(): void;
}

export function ageRenderPassEnabled(
  pass: AgeRenderPass,
  frame: AgeSceneFrame,
  context: AgeRendererContext,
) {
  if (typeof pass.enabled === "function") return pass.enabled(frame, context);
  return pass.enabled !== false;
}
