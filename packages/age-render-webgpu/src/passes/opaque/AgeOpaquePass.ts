import type { AgeRendererContext } from "../../core/AgeRendererContext";
import type { AgeSceneFrame } from "../../core/AgeSceneFrame";
import type { AgeFrameEncoder } from "../../graph/AgeFrameEncoder";
import type { AgeFrameTargets } from "../../graph/AgeFrameTargets";
import type { AgeRenderPass } from "../../graph/AgeRenderPass";

export class AgeOpaquePass implements AgeRenderPass {
  readonly id = "age.pass.opaque";
  readonly phase = "opaque";
  readonly resources = {
    reads: ["geometry", "materials", "textures", "lighting"],
    writes: ["sceneColor", "depth"],
  };

  execute(
    _context: AgeRendererContext,
    _frame: AgeSceneFrame,
    _targets: AgeFrameTargets,
    _encoder: AgeFrameEncoder,
  ) {
    // Prototype shell. Future implementation owns opaque forward/forward+ encoding.
  }
}
