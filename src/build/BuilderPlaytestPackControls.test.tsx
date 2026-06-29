import { afterEach, describe, expect, it, vi } from "vitest";
import { builderPlaytestUrl } from "./BuilderPlaytestPackControls";

describe("builderPlaytestUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens deep WebGPU playtests without physics URL params", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "http://localhost:5173",
      },
    });

    const url = builderPlaytestUrl("generated_level", { packId: "pack-123" });

    expect(url).toBe("http://localhost:5173/?level=generated_level&pack=deep&rawViewmodelMode=three&requireWebGpu=1&packId=pack-123");
    expect(url).not.toContain("physics=");
  });
});
