import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("WebGPU game canvas bundle boundary", () => {
  it("keeps the full-scene R3F fallback out of the default WebGPU entry module", () => {
    expect(source("./GameCanvas.tsx")).not.toContain("@react-three");
  });

  it("keeps the new first-person equipment as the Raw WebGPU Three viewmodel overlay", () => {
    const rawCanvas = source("./raw-webgpu/RawWebGpuCanvas.tsx");
    expect(rawCanvas).toContain("@react-three/fiber");
    expect(rawCanvas).toContain("FirstPersonProtagonistView");
    expect(rawCanvas).toContain("raw-webgpu-viewmodel-layer");
  });
});
