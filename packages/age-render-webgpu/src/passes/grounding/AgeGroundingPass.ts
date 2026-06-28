import type { AgeContactRecord, AgeSceneFrame } from "../../core/AgeSceneFrame";
import type { AgeRendererContext } from "../../core/AgeRendererContext";
import type { AgeTuple3 } from "../../core/AgeTypes";
import type { AgeFrameEncoder } from "../../graph/AgeFrameEncoder";
import type { AgeFrameTargets } from "../../graph/AgeFrameTargets";
import type { AgeRenderPass } from "../../graph/AgeRenderPass";
import type { AgeGroundingVisualPolicy } from "../../escape-room/AgeEscapeRoomVisualProfile";

/**
 * Grounding quad planned from a contact record: a soft shadow ellipse/plane
 * under a dynamic object. Host renderers write these into their own instance
 * stream and hand the resulting draw ranges back to encodeContactShadows.
 */
export interface AgeGroundingQuad {
  contactId: string;
  center: AgeTuple3;
  halfExtents: [number, number];
  opacity: number;
  kind?: string;
}

export interface AgeGroundingDrawRange {
  vertexOffset: number;
  vertexCount: number;
  instanceOffset: number;
  instanceCount: number;
}

export interface AgeGroundingEncodeContext {
  /** GPU pipeline for the contact-shadow draw (host-owned, backend handle). */
  pipeline: unknown;
  /** Bind group with camera/instance data (host-owned, backend handle). */
  bindGroup: unknown;
  /** Vertex buffer holding the shared shadow plane geometry (host-owned). */
  vertexBuffer: unknown;
  drawRanges: readonly AgeGroundingDrawRange[];
}

/**
 * First pixel-backed AGE pass: contact/grounding shadows planned from generic
 * AgeContactRecord data. The pass owns the policy math (which contacts draw,
 * at what size and opacity) and the draw encoding; the host renderer owns
 * buffers, pipelines, and instance layout. No game imports.
 */
export class AgeGroundingPass implements AgeRenderPass {
  readonly id = "age.pass.grounding";
  readonly phase = "transparent";
  readonly resources = {
    reads: ["drawBatches", "depth"],
    writes: ["sceneColor"],
  };

  enabled(frame: AgeSceneFrame) {
    return (frame.contacts?.length ?? 0) > 0 || frame.drawBatches.some((batch) => batch.receivesContactShadow);
  }

  /**
   * Converts contact records into grounding quads under the given policy:
   * grounded-only, strongest-first up to maxContacts, radius clamped,
   * opacity scaled by strength, kind, and height fade.
   */
  planQuads(contacts: readonly AgeContactRecord[], policy: AgeGroundingVisualPolicy): AgeGroundingQuad[] {
    if (!policy.enabled || contacts.length <= 0) return [];
    const grounded = contacts
      .filter((contact) => contact.grounded && contact.strength > 0)
      .sort((left, right) => right.strength - left.strength)
      .slice(0, Math.max(0, policy.maxContacts));

    const quads: AgeGroundingQuad[] = [];
    for (const contact of grounded) {
      const kindScale = contact.kind ? policy.opacityByKind?.[contact.kind] ?? 1 : 1;
      const heightFade = policy.fadeHeight > 0 ? clamp(1 - Math.max(0, contact.position[1]) / policy.fadeHeight, 0, 1) : 1;
      const opacity = clamp(contact.strength * policy.strengthScale * kindScale * heightFade, 0, 0.42);
      if (opacity <= 0.004) continue;
      quads.push({
        contactId: contact.id,
        center: [contact.position[0], Math.max(0.012, Math.min(contact.position[1], 0.06)), contact.position[2]],
        halfExtents: [
          clamp(contact.halfExtents[0], 0.05, policy.maxRadius),
          clamp(contact.halfExtents[1], 0.05, policy.maxRadius),
        ],
        opacity,
        kind: contact.kind,
      });
    }
    return quads;
  }

  /**
   * Encodes the contact-shadow draws for quads the host wrote into its
   * instance stream. Mirrors the raw renderer's grounding encode loop but is
   * generic over backend handles.
   */
  encodeContactShadows(renderPass: any, context: AgeGroundingEncodeContext) {
    if (!context.pipeline || !context.vertexBuffer || context.drawRanges.length <= 0) return;
    renderPass.setPipeline(context.pipeline);
    renderPass.setBindGroup(0, context.bindGroup);
    renderPass.setVertexBuffer(0, context.vertexBuffer);
    for (const range of context.drawRanges) {
      if (range.vertexCount <= 0 || range.instanceCount <= 0) continue;
      renderPass.draw(range.vertexCount, range.instanceCount, range.vertexOffset, range.instanceOffset);
    }
  }

  execute(
    _context: AgeRendererContext,
    frame: AgeSceneFrame,
    _targets: AgeFrameTargets,
    _encoder: AgeFrameEncoder,
  ) {
    // Graph-driven execution becomes possible once the AGE backend owns the
    // shadow-plane vertex buffer and instance stream; until then hosts call
    // planQuads + encodeContactShadows directly.
    void frame;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
