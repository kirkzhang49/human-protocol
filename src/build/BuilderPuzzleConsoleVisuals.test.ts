import { describe, expect, it } from "vitest";
import { modelKeyForInteraction } from "../assets/environmentModelAssets";
import type { BuilderProject, BuilderPuzzleKind } from "./BuilderTypes";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import { compileBuilderRuntimePack, type BuilderRuntimePackCompileOptions } from "./runtime-pack/compileBuilderRuntimePack";

const dedicatedConsoleVisuals = {
  archive_merge: "puzzle_console_archive_merge",
  circuit_grid: "puzzle_console_circuit_grid",
  gallery_reading: "puzzle_console_gallery_reading",
  surveillance_match: "puzzle_console_surveillance_match",
  valve_matrix: "puzzle_console_valve_matrix",
} as const satisfies Partial<Record<BuilderPuzzleKind, string>>;

function projectWithPuzzle(kind: keyof typeof dedicatedConsoleVisuals, rotationY = 0.2): BuilderProject {
  return {
    schemaVersion: "hp.builder.v1",
    projectId: `proj_${kind}`,
    title: `Puzzle ${kind}`,
    rooms: [
      { id: "room_spawn", label: "测试间", style: "sterile", center: [0, 0], size: [8, 7] },
      { id: "room_exit", label: "出口间", style: "exit", center: [0, 6], size: [6, 5] },
    ],
    doors: [
      { id: "door_gate", fromRoomId: "room_spawn", toRoomId: "room_exit", lockType: "puzzle_complete", puzzleKind: kind },
    ],
    props: [],
    puzzles: [
      {
        id: `puzzle_${kind}`,
        kind,
        linkedDoorId: "door_gate",
        roomId: "room_spawn",
        position: [1.5, -1.25],
        rotationY,
        archiveTargetValue: 64,
        timeLimitSec: 30,
      },
    ],
    robots: [],
    exitRoomId: "room_exit",
  };
}

function cookedTriangleModel(modelKey: string, size: [number, number, number]) {
  const vertices = new Float32Array(10 * 3);
  vertices.set([0, 0, 0, 0, 1, 0, 0, 0, 0, -1], 0);
  vertices.set([size[0], 0, 0, 0, 1, 0, 1, 0, 0, -1], 10);
  vertices.set([0, size[1], 0, 0, 1, 0, 0, 1, 0, -1], 20);
  return {
    modelKey,
    vertices,
    vertexCount: 3,
    triangleCount: 1,
    materials: [
      {
        name: `qa_${modelKey}`,
        baseColorFactor: [0.35, 0.48, 0.52, 1] as [number, number, number, number],
        emissiveFactor: [0.02, 0.12, 0.16] as [number, number, number],
        emissiveStrength: 0.5,
        roughnessFactor: 0.48,
        metallicFactor: 0.45,
        alphaMode: "OPAQUE" as const,
        doubleSided: true,
      },
    ],
    images: [],
    bounds: {
      min: [0, 0, 0] as [number, number, number],
      center: [size[0] / 2, size[1] / 2, size[2] / 2] as [number, number, number],
      size,
    },
    warnings: [],
  };
}

describe("builder 2D puzzle console visuals", () => {
  it("compiles every standalone 2D puzzle to its dedicated console model instead of the generic control bank", () => {
    for (const [kind, expectedVisualKey] of Object.entries(dedicatedConsoleVisuals) as [
      keyof typeof dedicatedConsoleVisuals,
      string,
    ][]) {
      const { level, issues } = compileBuilderProjectToLevel(projectWithPuzzle(kind));
      expect(issues, kind).toEqual([]);
      expect(level, kind).not.toBeNull();

      const puzzle = level!.puzzles?.find((candidate) => candidate.id === `puzzle_${kind}`);
      const interaction = level!.map?.interactions.find((candidate) => candidate.id === puzzle?.interactionId);

      expect(interaction?.visualKey, kind).toBe(expectedVisualKey);
      expect(modelKeyForInteraction(interaction!), kind).toBe(expectedVisualKey);
    }
  });

  it("keeps the authored yaw on 3D playtest puzzle console instances", () => {
    const rotationY = Math.PI / 2;
    const project = projectWithPuzzle("archive_merge", rotationY);
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const cookedArchiveConsole: BuilderRuntimePackCompileOptions = {
      cooked: {
        models: new Map([
          ["puzzle_console_archive_merge", cookedTriangleModel("puzzle_console_archive_merge", [1.08, 1.67, 0.53])],
        ]),
        missing: [],
        geometryBytes: 10 * 3 * 4,
        textureFallbackModels: [],
      },
    };

    for (const options of [{}, cookedArchiveConsole]) {
      const pack = compileBuilderRuntimePack(level!, project, options);
      const instance = pack.renderPlan.instances.find((candidate) => candidate.id === "terminal_pz_door_gate_panel");
      expect(instance?.rotation[1]).toBe(rotationY);
    }
  });
});
