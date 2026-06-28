import { AgeGlassOitPass } from "../passes/glass/AgeGlassOitPass";
import { AgeGroundingPass } from "../passes/grounding/AgeGroundingPass";
import { AgeOpaquePass } from "../passes/opaque/AgeOpaquePass";
import { AgeGpuParticlesPass } from "../passes/particles/AgeGpuParticlesPass";
import { AgePostProcessPass } from "../passes/post/AgePostProcessPass";
import { AgeProjectileVfxPass } from "../passes/projectiles/AgeProjectileVfxPass";
import { AgeTransparentPass } from "../passes/transparent/AgeTransparentPass";
import { AgeRenderGraph } from "./AgeRenderGraph";

export function createAgeWebGpuRenderGraph() {
  const graph = new AgeRenderGraph();
  graph.addPass(new AgeOpaquePass());
  graph.addPass(new AgeGroundingPass());
  graph.addPass(new AgeGlassOitPass());
  graph.addPass(new AgeTransparentPass());
  graph.addPass(new AgeProjectileVfxPass());
  graph.addPass(new AgeGpuParticlesPass());
  graph.addPass(new AgePostProcessPass());
  return graph;
}
