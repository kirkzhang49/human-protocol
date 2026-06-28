import { describe, expect, it } from "vitest";
import { level03HumanMuseum } from "./levels/level03-human-museum";
import { level04MemoryClinic } from "./levels/level04-memory-clinic";
import { localizedArticle, localizedConfigText } from "./LevelLocalization";

const cjkPattern = /[\u3400-\u9fff]/u;

describe("Level 4 English localization", () => {
  it("translates builder-promoted room, objective, and puzzle labels without mixed Chinese suffixes", () => {
    const samples = [
      ["救援椅室", "Rescue Chair Room"],
      ["救援椅室门", "Rescue Chair Room Door"],
      ["留置档案间", "Hold Record Room"],
      ["留置档案间门", "Hold Record Room Door"],
      ["闸门配平台", "Gate Balancer"],
      ["配平闸门", "Balance the Gates"],
      ["记忆压缩柜", "Memory Compression Cabinet"],
      ["打开 救援椅室门", "Open Rescue Chair Room Door"],
      ["清剿「留置档案间」", "Clear the Hold Record Room"],
      ["压缩记忆片", "Compress Memory Fragments"],
    ] as const;

    for (const [source, expected] of samples) {
      const translated = localizedConfigText(level04MemoryClinic, "en", source);
      expect(translated).toBe(expected);
      expect(translated).not.toMatch(cjkPattern);
    }
  });

  it("translates wall archive articles used by the interaction prompt and article overlay", () => {
    const article = level04MemoryClinic.articles.find((candidate) => candidate.title === "被保存的童年");
    expect(article).toBeDefined();

    const translated = localizedArticle(level04MemoryClinic, article!, "en");

    expect(translated.systemLabel).toBe("Wall Archive");
    expect(translated.title).toBe("Preserved Childhood");
    expect(translated.readReward?.detail).toBe("Preserved Childhood read");
    expect(translated.pages.map((page) => page.body).join("\n")).not.toMatch(cjkPattern);
  });
});

describe("Level 3 English localization", () => {
  it("translates route output authorization orb labels without mixed Chinese suffixes", () => {
    const translated = localizedConfigText(level03HumanMuseum, "en", "开启中央档案室—闭馆电梯授权球");

    expect(translated).toBe("Open Central archive room -> Closing elevator authorization orb");
    expect(translated).not.toMatch(cjkPattern);
  });

  it("translates dynamic gallery-reading interaction progress prompts", () => {
    const translated = localizedConfigText(level03HumanMuseum, "en", "先读画作 2/4");

    expect(translated).toBe("Read paintings 2/4");
    expect(translated).not.toMatch(cjkPattern);
  });

  it("translates dynamic route-output status messages without exact per-level entries", () => {
    const translated = localizedConfigText(level04MemoryClinic, "en", "开启救援椅室门：门禁已放行。");

    expect(translated).toBe("Open Rescue Chair Room Door: access released.");
    expect(translated).not.toMatch(cjkPattern);
  });
});
