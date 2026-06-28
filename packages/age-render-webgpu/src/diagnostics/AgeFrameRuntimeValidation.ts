import type { AgeSceneFrame } from "../core/AgeSceneFrame";
import { ageError, ageWarning, type AgeDiagnostic } from "./AgeDiagnostics";

export interface AgeFrameRuntimeValidationOptions {
  /** Frames a dynamic instance may keep an unchanged transform before it is flagged stale. */
  staleTransformFrameThreshold?: number;
  /** Require grounded/contact records when dynamic instances are present. */
  requireContactsForDynamicInstances?: boolean;
}

const defaultOptions: Required<AgeFrameRuntimeValidationOptions> = {
  staleTransformFrameThreshold: 2,
  requireContactsForDynamicInstances: true,
};

/**
 * Per-frame readiness validation for scene frames produced by game adapters.
 * Checks the physics/visual bridge records (contacts, portal states, animation
 * states, transform freshness) rather than asset/plan schema, which is covered
 * by validateAgePreBackportReadiness.
 */
export function validateAgeSceneFrameRuntime(
  frame: AgeSceneFrame,
  options: AgeFrameRuntimeValidationOptions = {},
) {
  const resolved = { ...defaultOptions, ...options };
  const diagnostics: AgeDiagnostic[] = [];
  const instanceIds = new Set(frame.instances.map((instance) => instance.id));
  const dynamicInstances = frame.instances.filter((instance) => instance.dynamic);

  if (
    resolved.requireContactsForDynamicInstances &&
    dynamicInstances.length > 0 &&
    (frame.contacts?.length ?? 0) <= 0
  ) {
    diagnostics.push(
      ageWarning(
        "age.frame.missing-contacts",
        `Frame has ${dynamicInstances.length} dynamic instances but no grounded/contact records; grounding pass will have nothing to draw.`,
      ),
    );
  }

  for (const instance of dynamicInstances) {
    if (instance.lastTransformFrameIndex === undefined) {
      diagnostics.push(
        ageWarning(
          "age.frame.untracked-transform",
          `Dynamic instance "${instance.id}" has no lastTransformFrameIndex; stale transforms cannot be detected.`,
          instance.id,
        ),
      );
      continue;
    }
    const lag = frame.timing.frameIndex - instance.lastTransformFrameIndex;
    if (lag > resolved.staleTransformFrameThreshold) {
      diagnostics.push(
        ageWarning(
          "age.frame.stale-transform",
          `Dynamic instance "${instance.id}" transform is ${lag} frames old (threshold ${resolved.staleTransformFrameThreshold}).`,
          instance.id,
        ),
      );
    }
    if (instance.lastTransformFrameIndex > frame.timing.frameIndex) {
      diagnostics.push(
        ageError(
          "age.frame.future-transform",
          `Dynamic instance "${instance.id}" reports a transform from frame ${instance.lastTransformFrameIndex}, after current frame ${frame.timing.frameIndex}.`,
          instance.id,
        ),
      );
    }
  }

  for (const contact of frame.contacts ?? []) {
    if (contact.instanceId && !instanceIds.has(contact.instanceId)) {
      diagnostics.push(
        ageWarning(
          "age.frame.contact-unknown-instance",
          `Contact record "${contact.id}" references unknown instance "${contact.instanceId}".`,
          contact.id,
        ),
      );
    }
    if (contact.halfExtents[0] <= 0 || contact.halfExtents[1] <= 0 || contact.strength < 0) {
      diagnostics.push(
        ageError(
          "age.frame.invalid-contact",
          `Contact record "${contact.id}" must have positive half extents and non-negative strength.`,
          contact.id,
        ),
      );
    }
  }

  const portalIds = new Set<string>();
  for (const portal of frame.portalStates ?? []) {
    if (portalIds.has(portal.id)) {
      diagnostics.push(ageError("age.frame.duplicate-portal", `Duplicate portal state "${portal.id}".`, portal.id));
    }
    portalIds.add(portal.id);
    if (portal.openProgress < 0 || portal.openProgress > 1 || !Number.isFinite(portal.openProgress)) {
      diagnostics.push(
        ageError(
          "age.frame.invalid-portal-progress",
          `Portal "${portal.id}" openProgress ${portal.openProgress} must be within [0, 1].`,
          portal.id,
        ),
      );
    }
  }

  for (const animation of frame.animationStates ?? []) {
    if (!instanceIds.has(animation.instanceId)) {
      diagnostics.push(
        ageWarning(
          "age.frame.animation-unknown-instance",
          `Animation state targets unknown instance "${animation.instanceId}".`,
          animation.instanceId,
        ),
      );
    }
    if (animation.timeSeconds < 0 || !Number.isFinite(animation.timeSeconds)) {
      diagnostics.push(
        ageError(
          "age.frame.invalid-animation-time",
          `Animation state for "${animation.instanceId}" has invalid timeSeconds ${animation.timeSeconds}.`,
          animation.instanceId,
        ),
      );
    }
  }

  return diagnostics;
}
