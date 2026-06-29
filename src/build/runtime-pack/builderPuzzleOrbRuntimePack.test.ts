import { describe, expect, it } from "vitest";
import { createStarterProject, type BuilderProject } from "../BuilderTypes";
import { compileBuilderProjectToLevel } from "../compileBuilderProjectToLevel";
import { compileBuilderRuntimePack } from "./compileBuilderRuntimePack";
import type { CookedGlbLibrary, CookedGlbMaterial, CookedGlbModel } from "./cookGlbModels";

function colorPuzzleProject(): BuilderProject {
  const starter = createStarterProject();
  return {
    ...starter,
    doors: starter.doors.map((door) => (door.id === "door_b" ? { ...door, lockType: "puzzle_complete" as const } : door)),
    puzzles: [
      {
        id: "stand_color_puzzle",
        kind: "color_sequence",
        linkedDoorId: "door_b",
        roomId: "room_hall",
        position: [1, 2],
        rotationY: 0,
        components: [
          { id: "orb_blue", role: "orb_blue", roomId: "room_hall", position: [1.6, 2.1] },
          { id: "orb_red", role: "orb_red", roomId: "room_hall", position: [2.8, 2.1] },
        ],
      },
    ],
  };
}

function cookedOrbLibrary(modelKey: string): CookedGlbLibrary {
  const material: CookedGlbMaterial = {
    name: "test-orb-glass",
    baseColorFactor: [0.25, 0.9, 1, 1],
    emissiveFactor: [0.2, 0.8, 1],
    emissiveStrength: 1.4,
    roughnessFactor: 0.22,
    metallicFactor: 0.1,
    alphaMode: "BLEND",
    doubleSided: false,
  };
  const model: CookedGlbModel = {
    modelKey,
    vertices: new Float32Array(),
    vertexCount: 0,
    triangleCount: 0,
    materials: [material],
    images: [],
    bounds: { min: [-0.22, -0.2, -0.22], center: [0, 0.18, 0], size: [0.44, 0.76, 0.44] },
    warnings: [],
  };
  return {
    models: new Map([[modelKey, model]]),
    missing: [],
    geometryBytes: 0,
    textureFallbackModels: [],
  };
}

describe("builder puzzle orb runtime pack", () => {
  it("adds a visible stand when a puzzle target orb uses a cooked model", () => {
    const project = colorPuzzleProject();
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const pack = compileBuilderRuntimePack(level!, project, { cooked: cookedOrbLibrary("age_museum_puzzle_orb_blue") });
    const blueTarget = level?.puzzles?.flatMap((puzzle) => (puzzle.type === "hit_sequence" ? puzzle.targets : [])).find((target) => target.colorKey === "blue");

    expect(blueTarget).toBeDefined();
    expect(pack.renderPlan.instances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `orb_stand_${blueTarget!.id}`,
          role: "puzzle_orb_stand",
          roomId: blueTarget!.roomId,
        }),
      ]),
    );
  });
});
