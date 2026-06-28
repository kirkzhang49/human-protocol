export interface AgeFrameEncoder {
  readonly rawEncoder: unknown;
  beginRenderPass(descriptor: unknown): unknown;
  beginComputePass(descriptor?: unknown): unknown;
  finish(): unknown;
}

export function createAgeFrameEncoder(rawEncoder: unknown): AgeFrameEncoder {
  const encoder = rawEncoder as {
    beginRenderPass?: (descriptor: unknown) => unknown;
    beginComputePass?: (descriptor?: unknown) => unknown;
    finish?: () => unknown;
  } | null;

  return {
    rawEncoder,
    beginRenderPass(descriptor) {
      return encoder?.beginRenderPass?.(descriptor) ?? null;
    },
    beginComputePass(descriptor) {
      return encoder?.beginComputePass?.(descriptor) ?? null;
    },
    finish() {
      return encoder?.finish?.() ?? null;
    },
  };
}
