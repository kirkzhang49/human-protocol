import { describe, expect, it } from "vitest";
import { enemyModelAssets } from "./enemyModelAssets";

describe("enemyModelAssets", () => {
  it("loads every runtime robot from the centralized cooked enemy file set", () => {
    for (const [modelKey, asset] of Object.entries(enemyModelAssets)) {
      expect(asset.url, modelKey).toContain("models-cooked/enemies");
    }
  });
});
