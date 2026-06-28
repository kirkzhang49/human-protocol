import { describe, expect, it } from "vitest";
import { campaignTransitionDialogueFor } from "./campaignTransitionDialogues";
import { level02ResidentialSimulation } from "./levels/level02-residential-simulation";
import { level03HumanMuseum } from "./levels/level03-human-museum";
import { level04MemoryClinic } from "./levels/level04-memory-clinic";

function playerFacingText(value: unknown): string {
  return JSON.stringify(value);
}

describe("campaign narrative continuity", () => {
  it("stages levels 2-4 as false home, human protocol, and maintained memory", () => {
    const level2 = playerFacingText({
      exit: level02ResidentialSimulation.exit,
      presentation: level02ResidentialSimulation.presentation,
      dialogues: level02ResidentialSimulation.dialogues,
    });
    const level3 = playerFacingText({
      exit: level03HumanMuseum.exit,
      presentation: level03HumanMuseum.presentation,
      dialogues: level03HumanMuseum.dialogues,
      articles: level03HumanMuseum.articles,
    });
    const level4 = playerFacingText({
      exit: level04MemoryClinic.exit,
      presentation: level04MemoryClinic.presentation,
      dialogues: level04MemoryClinic.dialogues,
      articles: level04MemoryClinic.articles,
    });

    expect(level2).toContain("这里像家，但门禁在听你呼吸。");
    expect(level2).toContain("居住记录：对象会回头寻找家。");
    expect(level3).toContain("最后人类不是姓名，是一套行为协议。");
    expect(level3).toContain("保留声音、动作和求生反应。");
    expect(level4).toContain("这里不治疗伤口，只校准你相信过的记忆。");
    expect(level4).toContain("出院留置记录");
  });

  it("keeps level 4 from revealing the level 5 identity turn", () => {
    const level4 = playerFacingText({
      exit: level04MemoryClinic.exit,
      presentation: level04MemoryClinic.presentation,
      dialogues: level04MemoryClinic.dialogues,
      articles: level04MemoryClinic.articles,
    });

    expect(level4).not.toMatch(/H-0|身份档案|人类层|非人类|没有皮肤/);
  });

  it("leaves the level 5 ending to the future video instead of a text dialogue", () => {
    expect(campaignTransitionDialogueFor("level_05_reclamation_core", "__campaign_ending", "zh")).toBeNull();
  });
});
