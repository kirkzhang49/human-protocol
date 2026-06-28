import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function sourceAt(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("story painting Image2 render path", () => {
  it("L4 Image2 story paintings are not registered as legacy GLB environment models", () => {
    const environmentAssetsSource = sourceAt("../../assets/environmentModelAssets.ts");
    const storyRegistrySource = sourceAt("../../assets/registry/environment/storyPaintings.ts");

    expect(environmentAssetsSource).not.toContain("storyPaintingEnvironmentModelAssets");
    expect(storyRegistrySource).not.toContain("age_museum_wall_art_human_origin.glb");
  });

  it("runtime story paintings do not render the legacy wall-art GLB behind the Image2 frame", () => {
    const source = sourceAt("../MapGeometryRenderer.tsx");
    const storyBranch = source.match(/if \(isStoryPaintingArtModelKey\(prop\.modelKey\)\) \{[\s\S]*?^\s*\}/m)?.[0] ?? "";

    expect(storyBranch).toContain("<StoryPaintingArtPlane");
    expect(storyBranch).not.toContain("<EnvironmentModelInstance");
  });

  it("builder preview story paintings do not render the legacy wall-art GLB behind the Image2 frame", () => {
    const source = sourceAt("../../build/BuilderPreview3D.tsx");
    const storyBranch = source.match(/storyClue && entry && isStoryPaintingArtModelKey\(prop\.modelKey\) \? \([\s\S]*?\) : isEnvironmentModelKey/m)?.[0] ?? "";

    expect(source).toContain("isEnvironmentModelKey(prop.modelKey) && !isStoryPaintingArtModelKey(prop.modelKey)");
    expect(storyBranch).toContain("<StoryPaintingArtPlane");
    expect(storyBranch).not.toContain("<EnvironmentModelInstance");
  });

  it("runtime Image2 story paintings do not draw an extra glass tint over the art", () => {
    const source = sourceAt("./StoryPaintingArtPlane.tsx");

    expect(source).not.toContain("opacity={0.06}");
    expect(source).not.toContain("renderOrder={9}");
  });

  it("procedural Image2 paintings keep the wall-facing back on local -Z and visible art on local +Z", () => {
    const source = sourceAt("./StoryPaintingArtPlane.tsx");

    expect(source).toContain("<group position={[0, yOffset, 0]}>");
    expect(source).toContain("<mesh position={[0, 0, zOffset]} renderOrder={8}>");
    expect(source).not.toContain("<group position={[0, yOffset, -zOffset]}>");
  });

  it("builder wall decals use the same local +Z front convention as wall-mounted prop placement", () => {
    const source = sourceAt("../../build/preview3d/BuilderPreviewPrimitives.tsx");

    expect(source).toContain("<group position={[0, yOffset, 0]}>");
    expect(source).toContain("<mesh position={[0, 0, zOffset]} renderOrder={5}>");
    expect(source).not.toContain("<group position={[0, yOffset, -zOffset]}>");
  });

  it("Raw WebGPU skips only the old museum wall-art washer overlay node", () => {
    const source = sourceAt("../raw-webgpu/RawWebGpuLevelRenderer.ts");

    expect(source).toContain("isMuseumWallArtOverlayNode(chunk.nodeName)");
    expect(source).toContain("isMuseumWallArtModelKey(instance.modelKey)");
  });
});
