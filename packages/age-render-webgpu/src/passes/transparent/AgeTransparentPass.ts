import type { AgeRendererContext } from "../../core/AgeRendererContext";
import type { AgeSceneFrame } from "../../core/AgeSceneFrame";
import type { AgeFrameEncoder } from "../../graph/AgeFrameEncoder";
import type { AgeFrameTargets } from "../../graph/AgeFrameTargets";
import type { AgeRenderPass } from "../../graph/AgeRenderPass";

export class AgeTransparentPass implements AgeRenderPass {
  readonly id = "age.pass.transparent";
  readonly phase = "transparent";
  readonly resources = {
    reads: ["sceneColor", "depth", "materials"],
    writes: ["sceneColor"],
  };

  enabled(frame: AgeSceneFrame) {
    return frame.drawBatches.some((batch) => batch.transparent);
  }

  execute(
    _context: AgeRendererContext,
    _frame: AgeSceneFrame,
    _targets: AgeFrameTargets,
    _encoder: AgeFrameEncoder,
  ) {
    // Sorted alpha fallback path. Weighted OIT should be preferred for glass.
  }
}
