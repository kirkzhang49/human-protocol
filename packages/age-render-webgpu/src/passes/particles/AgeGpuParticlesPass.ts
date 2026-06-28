import type { AgeRendererContext } from "../../core/AgeRendererContext";
import type { AgeSceneFrame } from "../../core/AgeSceneFrame";
import type { AgeFrameEncoder } from "../../graph/AgeFrameEncoder";
import type { AgeFrameTargets } from "../../graph/AgeFrameTargets";
import type { AgeRenderPass } from "../../graph/AgeRenderPass";

export class AgeGpuParticlesPass implements AgeRenderPass {
  readonly id = "age.pass.gpu-particles";
  readonly phase = "vfx";
  readonly resources = {
    reads: ["particleEmitters", "depth"],
    writes: ["sceneColor"],
  };

  enabled(frame: AgeSceneFrame, context: AgeRendererContext) {
    return context.capabilities.supportsCompute && (frame.particleEmitters?.length ?? 0) > 0;
  }

  execute(
    _context: AgeRendererContext,
    _frame: AgeSceneFrame,
    _targets: AgeFrameTargets,
    _encoder: AgeFrameEncoder,
  ) {
    // Compute/update and render split should become two graph nodes in phase 2.
  }
}
