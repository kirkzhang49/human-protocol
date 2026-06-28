import { describe, expect, it } from "vitest";
import type { GameLanguage } from "../game/core/GameSettings";
import type { BuilderProject } from "./BuilderTypes";
import { createRandomRoomQueue } from "./RandomRoomQueue";

function minimalProject(seed: number, language: GameLanguage): BuilderProject {
  return {
    schemaVersion: "hp.builder.v1",
    projectId: `gen_${language}_${seed}`,
    title: `${language}:${seed}`,
    rooms: [],
    doors: [],
    props: [],
    puzzles: [],
    robots: [],
    pickups: [],
    exitRoomId: "exit",
    lighting: { ambient: 0.5, keyColor: "#ffffff", keyIntensity: 1, fog: 0, bloom: 0, shadow: 0.5 },
  };
}

describe("createRandomRoomQueue", () => {
  it("serves prewarmed rooms without generating during take, then allows one-room refill", () => {
    const generatedSeeds: number[] = [];
    const seeds = [101, 102, 103, 104];
    const queue = createRandomRoomQueue({
      targetSize: 3,
      seedFactory: () => seeds.shift() ?? 999,
      generate: (seed, language) => {
        generatedSeeds.push(seed);
        return minimalProject(seed, language);
      },
      normalize: (project) => ({ ...project, title: `${project.title}:normalized` }),
    });

    queue.fillTo("zh");
    expect(queue.size("zh")).toBe(3);
    expect(generatedSeeds).toEqual([101, 102, 103]);

    const first = queue.take("zh");
    expect(first.projectId).toBe("gen_zh_101");
    expect(first.title).toBe("zh:101:normalized");
    expect(queue.size("zh")).toBe(2);
    expect(generatedSeeds).toEqual([101, 102, 103]);

    queue.fillOne("zh");
    expect(queue.size("zh")).toBe(3);
    expect(generatedSeeds).toEqual([101, 102, 103, 104]);
  });

  it("keeps cached rooms separated by language", () => {
    const queue = createRandomRoomQueue({
      targetSize: 1,
      seedFactory: () => 77,
      generate: minimalProject,
      normalize: (project) => project,
    });

    queue.fillTo("zh");
    queue.fillTo("en");

    expect(queue.take("zh").projectId).toBe("gen_zh_77");
    expect(queue.take("en").projectId).toBe("gen_en_77");
  });

  it("prepares generated rooms while warming the queue", () => {
    const prepared: string[] = [];
    const queue = createRandomRoomQueue({
      targetSize: 2,
      seedFactory: () => prepared.length + 10,
      generate: minimalProject,
      normalize: (project) => project,
      prepare: (project) => prepared.push(project.projectId),
    });

    queue.fillTo("zh");
    expect(prepared).toEqual(["gen_zh_10", "gen_zh_11"]);
  });
});
