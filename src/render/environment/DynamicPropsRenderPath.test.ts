import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function sourceAt(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("dynamic prop render paths", () => {
  it("Three fallback map renderer reads DynamicPropState transforms", () => {
    const source = sourceAt("../MapGeometryRenderer.tsx");

    expect(source).toContain("<ConfiguredDynamicProps world={world} />");
    expect(source).toContain("world.dynamicProps.filter");
    expect(source).toContain("modelKey={prop.modelKey}");
    expect(source).toContain("position={[prop.position.x, prop.position.y, prop.position.z]}");
    expect(source).toContain("rotation={[0, prop.yaw, 0]}");
  });

  it("Raw WebGPU renderer writes DynamicPropState transforms into dynamic instances", () => {
    const source = sourceAt("../raw-webgpu/RawWebGpuLevelRenderer.ts");

    expect(source).toContain("for (const prop of world.dynamicProps)");
    expect(source).toContain("this.writeDynamicPropInstance(index, prop, drawBatches)");
    expect(source).toContain("prop.position.x");
    expect(source).toContain("prop.position.y");
    expect(source).toContain("prop.position.z");
    expect(source).toContain("prop.yaw");
    expect(source).toContain("const scale: Tuple3 = [prop.scale.x, prop.scale.y, prop.scale.z]");
  });

  it("Raw WebGPU exposes a QA dynamic prop transform snapshot", () => {
    const source = sourceAt("../raw-webgpu/RawWebGpuLevelRenderer.ts");

    expect(source).toContain("__humanProtocolRawDynamicPropsDebug");
    expect(source).toContain("publishDynamicPropsDebugSnapshot(world)");
    expect(source).toContain("this.dynamicPropDebugEntries");
  });

  it("physics browser QA checks Raw WebGPU dynamic prop transform sync", () => {
    const source = sourceAt("../../../scripts/qa/physics-browser-qa.mjs");

    expect(source).toContain("rawDynamicPropRenderSync");
    expect(source).toContain("__humanProtocolRawDynamicPropsDebug");
    expect(source).toContain("renderMatchesPhysics");
  });
});
