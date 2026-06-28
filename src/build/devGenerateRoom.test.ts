import { describe, expect, it } from "vitest";
import { validateLevelConfig } from "../game/config/ConfigValidator";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import { generateRandomRoom } from "./devGenerateRoom";

const cjkPattern = /[\u3400-\u9fff]/u;

function collectGeneratedProjectCopy(seed: number) {
  const project = generateRandomRoom(seed, "en");
  return [
    project.title,
    project.story?.victoryLine,
    project.story?.transitionLine,
    ...project.rooms.map((room) => room.label),
    ...project.props.flatMap((prop) => [prop.story?.title, prop.story?.clue, prop.story?.hint]),
    ...(project.routeSwitches ?? []).flatMap((route) => [
      route.label,
      ...route.outputs.flatMap((output) => [output.label]),
    ]),
  ].filter((value): value is string => Boolean(value));
}

describe("generateRandomRoom i18n", () => {
  it("generates English source copy for English builder/playtest projects", () => {
    const leaked = collectGeneratedProjectCopy(71203).filter((text) => cjkPattern.test(text));

    expect(leaked).toEqual([]);
  });
});

describe("generateRandomRoom room kit and puzzle variety", () => {
  it("uses one coherent surface kit across generated playable rooms", () => {
    const project = generateRandomRoom(42017, "zh");
    const playableRooms = project.rooms.filter((room) => room.id !== project.exitRoomId);
    const surfaceKitIds = new Set(playableRooms.map((room) => room.env?.surfaceKitId));
    const floorPresetIds = new Set(playableRooms.map((room) => room.env?.floorPresetId));
    const wallPresetIds = new Set(playableRooms.map((room) => room.env?.wallPresetId));
    const ceilingPresetIds = new Set(playableRooms.map((room) => room.env?.ceilingPresetId));

    expect(surfaceKitIds).toHaveLength(1);
    expect(floorPresetIds).toHaveLength(1);
    expect(wallPresetIds).toHaveLength(1);
    expect(ceilingPresetIds).toHaveLength(1);
    expect([...surfaceKitIds][0]).toMatch(/^hp:/);
    expect([...floorPresetIds][0]).toBeTruthy();
    expect([...wallPresetIds][0]).toBeTruthy();
    expect([...ceilingPresetIds][0]).toBeTruthy();
  });

  it("randomizes newer puzzle families without changing the authored lock count", () => {
    const seenKinds = new Set<string>();

    for (let seed = 7300; seed < 7350; seed += 1) {
      const project = generateRandomRoom(seed, "zh");
      project.puzzles.forEach((puzzle) => seenKinds.add(puzzle.kind));

      const puzzleLockedDoors = project.doors.filter((door) => door.lockType === "puzzle_complete");
      expect(project.puzzles).toHaveLength(puzzleLockedDoors.length);
      expect(project.puzzles.filter((puzzle) => puzzle.kind === "color_sequence")).toHaveLength(1);

      const { level, issues } = compileBuilderProjectToLevel(project);
      expect(issues).toEqual([]);
      expect(level).not.toBeNull();
      expect(validateLevelConfig(level!, { authoringProfile: "generated" }).errors).toEqual([]);
    }

    expect([...seenKinds]).toEqual(expect.arrayContaining(["gallery_reading", "surveillance_match"]));
  });
});
