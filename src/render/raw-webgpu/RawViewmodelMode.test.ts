import { describe, expect, it } from "vitest";
import { parseRawViewmodelMode, resolveEffectiveRawViewmodelMode } from "./RawViewmodelMode";

describe("parseRawViewmodelMode", () => {
  it("defaults player-facing WebGPU play to the Three new-equipment viewmodel", () => {
    expect(parseRawViewmodelMode(null, null)).toBe("three");
  });

  it("keeps explicit Three viewmodel requests on the new-equipment overlay", () => {
    expect(parseRawViewmodelMode("three", null)).toBe("three");
  });

  it("treats raw viewmodel requests as the Three overlay, including old experimental links", () => {
    expect(parseRawViewmodelMode("raw", null)).toBe("three");
    expect(parseRawViewmodelMode("raw", null, "1")).toBe("three");
  });

  it("keeps explicit off requests", () => {
    expect(parseRawViewmodelMode("off", null)).toBe("off");
    expect(parseRawViewmodelMode(null, "0")).toBe("off");
  });
});

describe("resolveEffectiveRawViewmodelMode", () => {
  it("falls back to the Three new-equipment overlay when raw viewmodel geometry is unavailable", () => {
    expect(resolveEffectiveRawViewmodelMode("raw", { ready: false })).toBe("three");
  });

  it("does not expose the native raw pass even when cooked viewmodel geometry is available", () => {
    expect(resolveEffectiveRawViewmodelMode("raw", { ready: true })).toBe("three");
  });

  it("keeps the requested Three overlay without consulting raw readiness", () => {
    expect(resolveEffectiveRawViewmodelMode("three", { ready: false })).toBe("three");
  });
});
