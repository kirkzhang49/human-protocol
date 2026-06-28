import { ageError, ageWarning, type AgeDiagnostic } from "./AgeDiagnostics";
import type { AgeRenderPlan } from "../contracts/AgeRenderPlanContracts";
import type { AgeAssetRegistry } from "../resources/AgeAssetRegistry";
import type { AgeSceneFrame } from "../core/AgeSceneFrame";
import { validateAgeRenderPlanSchema, validateAgeSceneFrameSchema } from "./AgeSchemaValidation";

export interface AgePreBackportValidationInput {
  assets: AgeAssetRegistry;
  renderPlan: AgeRenderPlan;
  frame?: AgeSceneFrame;
}

export function validateAgePreBackportReadiness(input: AgePreBackportValidationInput) {
  const diagnostics: AgeDiagnostic[] = [...validateAgeRenderPlanSchema(input.renderPlan)];
  validateRenderPlan(input.renderPlan, input.assets, diagnostics);
  if (input.frame) {
    diagnostics.push(...validateAgeSceneFrameSchema(input.frame));
    validateSceneFrame(input.frame, input.renderPlan, diagnostics);
  }
  return diagnostics;
}

function validateRenderPlan(
  plan: AgeRenderPlan,
  assets: AgeAssetRegistry,
  diagnostics: AgeDiagnostic[],
) {
  if (!plan.id.trim()) {
    diagnostics.push(ageError("age.prebackport.plan-id", "Render plan id must be non-empty."));
  }
  if (plan.instances.length <= 0) {
    diagnostics.push(ageWarning("age.prebackport.empty-instances", "Render plan has no instances.", plan.id));
  }
  if (plan.materials.length <= 0) {
    diagnostics.push(ageError("age.prebackport.empty-materials", "Render plan must have at least one material.", plan.id));
  }
  const materialIndexes = new Set<number>();
  for (const material of plan.materials) {
    if (materialIndexes.has(material.index)) {
      diagnostics.push(ageError("age.prebackport.duplicate-material-index", `Duplicate material index ${material.index}.`, material.id));
    }
    materialIndexes.add(material.index);
  }
  for (const instance of plan.instances) {
    if (!assets.resolveGeometry(instance.modelKey)) {
      diagnostics.push(ageWarning("age.prebackport.missing-geometry", `No registered geometry for modelKey "${instance.modelKey}".`, instance.id));
    }
  }
}

function validateSceneFrame(
  frame: AgeSceneFrame,
  plan: AgeRenderPlan,
  diagnostics: AgeDiagnostic[],
) {
  const planInstanceIds = new Set(plan.instances.map((instance) => instance.id));
  const frameInstanceIds = new Set(frame.instances.map((instance) => instance.id));
  for (const instance of frame.instances) {
    if (!planInstanceIds.has(instance.id)) {
      diagnostics.push(ageWarning("age.prebackport.frame-instance-not-in-plan", `Frame instance "${instance.id}" is not in render plan.`, instance.id));
    }
  }
  for (const batch of frame.drawBatches) {
    if (batch.instanceCount <= 0 || batch.vertexCount <= 0) {
      diagnostics.push(ageError("age.prebackport.invalid-draw-batch", "Draw batch must have positive vertex and instance counts.", batch.id));
    }
    if (batch.id && !frameInstanceIds.has(batch.id) && !batch.geometryId) {
      diagnostics.push(ageWarning("age.prebackport.unlinked-draw-batch", `Draw batch "${batch.id}" is not linked to a frame instance or geometry.`, batch.id));
    }
  }
}
