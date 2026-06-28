import type { AgeRendererContext } from "../core/AgeRendererContext";
import type { AgeSceneFrame } from "../core/AgeSceneFrame";
import { ageRenderPassEnabled, type AgeRenderPass, type AgeRenderPassPhase } from "./AgeRenderPass";
import type { AgeFrameEncoder } from "./AgeFrameEncoder";
import type { AgeFrameTargets } from "./AgeFrameTargets";
import {
  validateAgeRenderGraph,
  type AgeRenderGraphExecutionPlan,
  type AgeRenderGraphValidationOptions,
} from "./AgeRenderGraphValidation";

const phaseOrder: Record<AgeRenderPassPhase, number> = {
  prepare: 0,
  shadow: 10,
  opaque: 20,
  transparent: 30,
  vfx: 40,
  post: 50,
  present: 60,
};

export class AgeRenderGraph {
  private readonly passes: AgeRenderPass[] = [];
  private sortedPasses: AgeRenderPass[] | null = null;
  private executionPlan: AgeRenderGraphExecutionPlan | null = null;

  addPass(pass: AgeRenderPass) {
    if (this.passes.some((existing) => existing.id === pass.id)) {
      throw new Error(`AgeRenderGraph already has a pass named "${pass.id}".`);
    }
    this.passes.push(pass);
    this.sortedPasses = null;
    this.executionPlan = null;
    return pass;
  }

  removePass(id: string) {
    const index = this.passes.findIndex((pass) => pass.id === id);
    if (index < 0) return false;
    this.passes.splice(index, 1);
    this.sortedPasses = null;
    this.executionPlan = null;
    return true;
  }

  listPasses() {
    return [...this.sorted()];
  }

  async setup(context: AgeRendererContext) {
    this.plan();
    for (const pass of this.sorted()) {
      await pass.setup?.(context);
      await pass.createPipelines?.(context);
    }
  }

  async resize(context: AgeRendererContext, targets: AgeFrameTargets) {
    for (const pass of this.sorted()) {
      await pass.createResources?.(context, targets);
      pass.resize?.(context, targets);
    }
  }

  async execute(
    context: AgeRendererContext,
    frame: AgeSceneFrame,
    targets: AgeFrameTargets,
    encoder: AgeFrameEncoder,
  ) {
    for (const pass of this.sorted()) {
      if (!ageRenderPassEnabled(pass, frame, context)) continue;
      await pass.updateFrameData?.(context, frame, targets);
      if (pass.encode) {
        await pass.encode(context, frame, targets, encoder);
      } else if (pass.execute) {
        await pass.execute(context, frame, targets, encoder);
      }
    }
  }

  validate(options?: AgeRenderGraphValidationOptions) {
    return validateAgeRenderGraph(this.sorted(), options);
  }

  plan(options?: AgeRenderGraphValidationOptions): AgeRenderGraphExecutionPlan {
    const passes = this.sorted();
    if (options) {
      return {
        passes,
        diagnostics: validateAgeRenderGraph(passes, options),
      };
    }
    if (!this.executionPlan) {
      this.executionPlan = {
        passes,
        diagnostics: validateAgeRenderGraph(passes),
      };
    }
    return this.executionPlan;
  }

  dispose() {
    for (let index = this.passes.length - 1; index >= 0; index -= 1) {
      this.passes[index].dispose?.();
    }
    this.passes.length = 0;
    this.sortedPasses = null;
    this.executionPlan = null;
  }

  private sorted() {
    if (!this.sortedPasses) {
      this.sortedPasses = [...this.passes].sort((left, right) => {
        const phaseDelta = phaseOrder[left.phase] - phaseOrder[right.phase];
        return phaseDelta || left.id.localeCompare(right.id);
      });
    }
    return this.sortedPasses;
  }
}
