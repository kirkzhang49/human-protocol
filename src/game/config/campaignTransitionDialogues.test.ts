import { describe, expect, it } from "vitest";
import { campaignTransitionDialogueFor } from "./campaignTransitionDialogues";

describe("campaignTransitionDialogueFor", () => {
  it("gates only the authored elevator branch transitions", () => {
    expect(campaignTransitionDialogueFor("level_01_maintenance_bay", "level_02_residential_simulation", "zh")).toBeNull();
    expect(campaignTransitionDialogueFor("level_02_residential_simulation", "level_03_human_museum", "zh")?.lines).toHaveLength(4);
    expect(campaignTransitionDialogueFor("level_03_human_museum", "level_04_memory_clinic", "zh")?.lines).toHaveLength(4);
    expect(campaignTransitionDialogueFor("level_04_memory_clinic", "level_05_reclamation_core", "zh")?.lines).toHaveLength(4);
    expect(campaignTransitionDialogueFor("level_05_reclamation_core", "__campaign_ending", "zh")).toBeNull();
  });

  it("keeps Chinese and English copies in step with the same transition", () => {
    const zh = campaignTransitionDialogueFor("level_02_residential_simulation", "level_03_human_museum", "zh");
    const en = campaignTransitionDialogueFor("level_02_residential_simulation", "level_03_human_museum", "en");

    expect(zh?.heading).toBe("样板间下行");
    expect(zh?.lines[0]).toMatchObject({
      speaker: "我",
      line: "我差点真的想回去。",
      tone: "player",
    });
    expect(en?.heading).toBe("Showroom Descent");
    expect(en?.lines).toHaveLength(zh?.lines.length);
  });

  it("keeps branch transitions short, in-world, and away from level 5 ending reveals", () => {
    const copies = [
      campaignTransitionDialogueFor("level_02_residential_simulation", "level_03_human_museum", "zh"),
      campaignTransitionDialogueFor("level_03_human_museum", "level_04_memory_clinic", "zh"),
      campaignTransitionDialogueFor("level_04_memory_clinic", "level_05_reclamation_core", "zh"),
    ];
    const text = copies.flatMap((copy) => copy?.lines.map((line) => line.line) ?? []).join("\n");

    expect(text).toContain("可你保存了开门的姿势。");
    expect(text).toContain("在你学不像的地方。");
    expect(text).toContain("因为舍不得，是你最像他的地方。");
    expect(text).not.toMatch(/demo|Demo|v1|Boss|三锁|大门|节点|流程|下一层|H-0|人类层|身份档案/);
    expect(copies.every((copy) => copy?.lines.every((line) => line.line.length <= 22))).toBe(true);
  });
});
