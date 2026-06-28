import { describe, expect, it } from "vitest";
import { ceilingPreviewPlaneRotation, horizontalPreviewPlaneRotation } from "./BuilderPreviewPlaneRotation";

describe("BuilderPreviewPlaneRotation", () => {
  it("keeps rectangular ceiling planes horizontal in the XZ plane", () => {
    expect(ceilingPreviewPlaneRotation(false)).toEqual(horizontalPreviewPlaneRotation);
    expect(ceilingPreviewPlaneRotation(false)?.[0]).toBeCloseTo(-Math.PI / 2);
  });

  it("does not rotate shaped footprint geometry that is already built in XZ", () => {
    expect(ceilingPreviewPlaneRotation(true)).toBeUndefined();
  });
});
