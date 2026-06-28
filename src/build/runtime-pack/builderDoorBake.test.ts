import { describe, expect, it } from "vitest";
import { GeometryWriter } from "./GeometryWriter";
import { pushDoorLeafBake } from "./builderDoorBake";

describe("builder door bake", () => {
  it("keeps no-lock closed procedural doors visually closed", () => {
    const geometry = new GeometryWriter();
    geometry.beginAsset("door-leaf-unlocked-closed");
    pushDoorLeafBake(geometry, 2, 3, 4, 5, 6, false);
    geometry.endAsset();

    const leaf = geometry.assets()[0];
    expect(leaf?.bounds?.size[0]).toBeGreaterThan(2.6);
    expect(leaf?.bounds?.min[0]).toBeLessThan(-1.3);
    expect((leaf?.bounds?.center[0] ?? 0) + (leaf?.bounds?.size[0] ?? 0) / 2).toBeGreaterThan(1.3);
  });
});
