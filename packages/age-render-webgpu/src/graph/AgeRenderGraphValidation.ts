import { ageError, ageWarning, type AgeDiagnostic } from "../diagnostics/AgeDiagnostics";
import { AGE_GRAPH_EXTERNAL_RESOURCES, ageGraphResourceId } from "./AgeGraphResource";
import type { AgeRenderPass } from "./AgeRenderPass";

export interface AgeRenderGraphValidationOptions {
  availableResources?: readonly string[];
  strictReadBeforeWrite?: boolean;
}

export interface AgeRenderGraphExecutionPlan {
  passes: readonly AgeRenderPass[];
  diagnostics: readonly AgeDiagnostic[];
}

export function validateAgeRenderGraph(
  passes: readonly AgeRenderPass[],
  options: AgeRenderGraphValidationOptions = {},
): AgeDiagnostic[] {
  const diagnostics: AgeDiagnostic[] = [];
  const seenPassIds = new Set<string>();
  const available = new Set(options.availableResources ?? AGE_GRAPH_EXTERNAL_RESOURCES.map((resource) => resource.id));

  for (const pass of passes) {
    if (seenPassIds.has(pass.id)) {
      diagnostics.push(ageError("age.graph.duplicate-pass", `Duplicate render pass id "${pass.id}".`, pass.id));
    }
    seenPassIds.add(pass.id);

    for (const resourceRef of pass.resources?.reads ?? []) {
      const resource = ageGraphResourceId(resourceRef);
      if (available.has(resource)) continue;
      const diagnostic = options.strictReadBeforeWrite ? ageError : ageWarning;
      diagnostics.push(
        diagnostic(
          "age.graph.read-before-write",
          `Render pass "${pass.id}" reads "${resource}" before any prior pass writes it.`,
          pass.id,
        ),
      );
    }

    for (const resourceRef of pass.resources?.optionalReads ?? []) {
      const resource = ageGraphResourceId(resourceRef);
      if (available.has(resource)) continue;
      diagnostics.push(
        ageWarning(
          "age.graph.optional-resource-missing",
          `Render pass "${pass.id}" has optional read "${resource}", but no prior pass writes it.`,
          pass.id,
        ),
      );
    }

    for (const resourceRef of pass.resources?.writes ?? []) {
      const resource = ageGraphResourceId(resourceRef);
      available.add(resource);
    }
  }

  return diagnostics;
}
