import type { AgeRendererContext } from "../../core/AgeRendererContext";
import type { AgeSceneFrame } from "../../core/AgeSceneFrame";
import type { AgeFrameEncoder } from "../../graph/AgeFrameEncoder";
import type { AgeFrameTargets } from "../../graph/AgeFrameTargets";
import type { AgeRenderPass } from "../../graph/AgeRenderPass";

export class AgePostProcessPass implements AgeRenderPass {
  readonly id = "age.pass.post";
  readonly phase = "post";
  readonly resources = {
    reads: ["sceneColor"],
    optionalReads: ["bloom"],
    writes: ["postColor", "canvas"],
  };

  enabled(_frame: AgeSceneFrame, context: AgeRendererContext) {
    return context.capabilities.supportsOffscreenPost;
  }

  execute(
    _context: AgeRendererContext,
    _frame: AgeSceneFrame,
    _targets: AgeFrameTargets,
    _encoder: AgeFrameEncoder,
  ) {
    // Tone mapping, bloom composite, FXAA, and display transform live here.
  }
}
