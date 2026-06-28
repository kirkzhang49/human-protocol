import type { AgeRendererContext } from "../../core/AgeRendererContext";
import type { AgeSceneFrame } from "../../core/AgeSceneFrame";
import type { AgeFrameEncoder } from "../../graph/AgeFrameEncoder";
import type { AgeFrameTargets } from "../../graph/AgeFrameTargets";
import type { AgeRenderPass } from "../../graph/AgeRenderPass";

export class AgeProjectileVfxPass implements AgeRenderPass {
  readonly id = "age.pass.projectile-vfx";
  readonly phase = "vfx";
  readonly resources = {
    reads: ["projectiles", "depth"],
    writes: ["sceneColor"],
  };

  enabled(frame: AgeSceneFrame) {
    return (frame.projectiles?.length ?? 0) > 0;
  }

  execute(
    _context: AgeRendererContext,
    _frame: AgeSceneFrame,
    _targets: AgeFrameTargets,
    _encoder: AgeFrameEncoder,
  ) {
    // Engine consumes generic projectile records; weapon IDs are adapter-only.
  }
}
