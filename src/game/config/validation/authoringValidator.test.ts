import { describe, expect, it } from "vitest";
import type { LevelDefinition, LevelInteractionDefinition } from "../schema/levelConfig";
import { validateGeneratedAuthoringBoundary } from "./authoringValidator";
import type { ConfigValidationIssue } from "./issues";

function generatedLevelWithInteraction(interaction: LevelInteractionDefinition): LevelDefinition {
  return {
    id: "generated-validator-smoke",
    title: "Generated Validator Smoke",
    authoringProfile: "generated",
    map: {
      id: "generated_validator_map",
      schemaVersion: "hp.map.v1",
      rooms: [
        {
          id: "room",
          label: "Room",
          bounds: { center: [0, 0, 0], size: [6, 4, 6] },
          mood: "quiet",
          floorMaterialKey: "residential_floor",
          wallMaterialKey: "residential_wall",
        },
      ],
      doors: [],
      keyItems: [],
      interactions: [interaction],
      navigation: { criticalPathRoomIds: ["room"], optionalRoomIds: [] },
    },
    puzzles: [],
    bigScreens: [],
    waves: [],
  } as unknown as LevelDefinition;
}

describe("generated authoring visual boundary", () => {
  it("allows none visual keys for hosted interactions", () => {
    const errors: ConfigValidationIssue[] = [];
    const warnings: ConfigValidationIssue[] = [];

    validateGeneratedAuthoringBoundary(
      generatedLevelWithInteraction({
        id: "hosted_inspect",
        type: "inspect",
        roomId: "room",
        position: [0, 0, 0],
        radius: 1.4,
        visualKey: "none",
        materialKey: "terminal_cyan",
        anchorPropId: "prop_console",
      }),
      errors,
      warnings,
    );

    expect(errors.map((issue) => issue.code)).not.toContain("authoring.generated.visual.disallowed");
  });

  it("allows none visual keys for hidden unhosted interactions", () => {
    const errors: ConfigValidationIssue[] = [];
    const warnings: ConfigValidationIssue[] = [];

    validateGeneratedAuthoringBoundary(
      generatedLevelWithInteraction({
        id: "floating_inspect",
        type: "inspect",
        roomId: "room",
        position: [0, 0, 0],
        radius: 1.4,
        visualKey: "none",
        materialKey: "terminal_cyan",
      }),
      errors,
      warnings,
    );

    expect(errors.map((issue) => issue.code)).not.toContain("authoring.generated.visual.disallowed");
  });

  it("still rejects concrete interaction visuals from the wrong object family", () => {
    const errors: ConfigValidationIssue[] = [];
    const warnings: ConfigValidationIssue[] = [];

    validateGeneratedAuthoringBoundary(
      generatedLevelWithInteraction({
        id: "wrong_family_inspect",
        type: "inspect",
        roomId: "room",
        position: [0, 0, 0],
        radius: 1.4,
        visualKey: "exit_panel",
        materialKey: "terminal_cyan",
      }),
      errors,
      warnings,
    );

    expect(errors.map((issue) => `${issue.code}:${issue.path}`)).toContain(
      "authoring.generated.visual.disallowed:map.interactions[0].visualKey",
    );
  });
});
