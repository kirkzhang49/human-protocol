import type { AgeRendererContext } from "../../core/AgeRendererContext";
import type { AgeSceneFrame } from "../../core/AgeSceneFrame";
import type { AgeFrameEncoder } from "../../graph/AgeFrameEncoder";
import type { AgeFrameTargets } from "../../graph/AgeFrameTargets";
import type { AgeRenderPass } from "../../graph/AgeRenderPass";

export class AgeGlassOitPass implements AgeRenderPass {
  readonly id = "age.pass.glass-oit";
  readonly phase = "transparent";
  readonly resources = {
    reads: ["sceneColor", "depth", "materials"],
    writes: ["glassOit.accum", "glassOit.reveal", "sceneColor"],
  };

  enabled(frame: AgeSceneFrame, context: AgeRendererContext) {
    return context.capabilities.supportsWeightedOit && frame.drawBatches.some((batch) => batch.transparent);
  }

  execute(
    _context: AgeRendererContext,
    _frame: AgeSceneFrame,
    _targets: AgeFrameTargets,
    _encoder: AgeFrameEncoder,
  ) {
    // Prototype shell for weighted blended OIT accumulation and resolve.
  }
}
