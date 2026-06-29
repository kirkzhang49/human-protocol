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
});
