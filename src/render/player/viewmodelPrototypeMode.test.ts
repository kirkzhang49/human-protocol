import { describe, expect, it } from "vitest";
import { resolveViewmodelPrototypeModeFromParams } from "./viewmodelPrototypeMode";

function params(query: string) {
  return new URLSearchParams(query);
}

describe("resolveViewmodelPrototypeModeFromParams", () => {
  it("keeps explicit prototype params as the highest priority", () => {
    expect(resolveViewmodelPrototypeModeFromParams(params("pack=deep&viewmodelPrototype=production"))).toBe("production");
    expect(resolveViewmodelPrototypeModeFromParams(params("viewmodelPrototype=reference-raw"))).toBe("referenceRaw");
    expect(resolveViewmodelPrototypeModeFromParams(params("viewmodelPrototype=scripted-derived"))).toBe("scriptedDerived");
  });

  it("defaults builder deep playtests to the scripted-derived viewmodel", () => {
    expect(
      resolveViewmodelPrototypeModeFromParams(
        params("level=builder_level_ory_clinic&pack=deep&packId=pack_47dplk_mqwtu682&rawViewmodelMode=three"),
      ),
    ).toBe("scriptedDerived");
  });

  it("defaults generated builder levels to the scripted-derived viewmodel even without a deep pack", () => {
    expect(resolveViewmodelPrototypeModeFromParams(params("level=builder_level_ory_clinic&rawViewmodelMode=three"))).toBe("scriptedDerived");
  });

  it("defaults official levels to the new scripted-derived viewmodel unless requested", () => {
    expect(resolveViewmodelPrototypeModeFromParams(params("level=level_03_human_museum&rawViewmodelMode=three"))).toBe("scriptedDerived");
  });
});
