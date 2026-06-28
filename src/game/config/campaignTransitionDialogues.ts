import type { GameLanguage } from "../core/GameSettings";

export type CampaignTransitionTone = "player" | "system" | "reveal";

export interface CampaignTransitionDialogueLine {
  speaker: string;
  line: string;
  tone: CampaignTransitionTone;
}

export interface CampaignTransitionDialogueCopy {
  id: string;
  fromLevelId: string;
  toLevelId: string;
  system: string;
  heading: string;
  body: string;
  continueLabel: string;
  lines: readonly CampaignTransitionDialogueLine[];
}

interface LocalizedCampaignTransitionDialogue {
  id: string;
  fromLevelId: string;
  toLevelId: string;
  zh: Omit<CampaignTransitionDialogueCopy, "id" | "fromLevelId" | "toLevelId">;
  en: Omit<CampaignTransitionDialogueCopy, "id" | "fromLevelId" | "toLevelId">;
}

const campaignTransitionDialogues: readonly LocalizedCampaignTransitionDialogue[] = [
  {
    id: "level_02_to_03_elevator_memory",
    fromLevelId: "level_02_residential_simulation",
    toLevelId: "level_03_human_museum",
    zh: {
      system: "电梯内线",
      heading: "样板间下行",
      body: "客厅的灯声停在门后，电梯只留下消毒水的味道。",
      continueLabel: "等待开门",
      lines: [
        { speaker: "我", line: "我差点真的想回去。", tone: "player" },
        { speaker: "?", line: "你的手已经回头了。", tone: "reveal" },
        { speaker: "我", line: "那不是家。", tone: "player" },
        { speaker: "?", line: "可你保存了开门的姿势。", tone: "system" },
      ],
    },
    en: {
      system: "Elevator Line",
      heading: "Showroom Descent",
      body: "The living-room chime stops behind the door. Only disinfectant stays in the lift.",
      continueLabel: "Wait for the door",
      lines: [
        { speaker: "Me", line: "I almost wanted to go back.", tone: "player" },
        { speaker: "?", line: "Your hand already turned.", tone: "reveal" },
        { speaker: "Me", line: "That was not home.", tone: "player" },
        { speaker: "?", line: "But you saved the door-opening gesture.", tone: "system" },
      ],
    },
  },
  {
    id: "level_03_to_04_elevator_memory",
    fromLevelId: "level_03_human_museum",
    toLevelId: "level_04_memory_clinic",
    zh: {
      system: "电梯内线",
      heading: "电梯停稳",
      body: "展柜编号从屏幕上滑走，玻璃里只剩你的影子。",
      continueLabel: "打开电梯",
      lines: [
        { speaker: "我", line: "展柜里那些东西，为什么都像我？", tone: "player" },
        { speaker: "?", line: "因为你在用它们认识自己。", tone: "system" },
        { speaker: "我", line: "最后人类在哪里？", tone: "player" },
        { speaker: "?", line: "在你学不像的地方。", tone: "reveal" },
      ],
    },
    en: {
      system: "Elevator Line",
      heading: "Car Stilled",
      body: "Exhibit numbers slide off the screen. Only your reflection remains in the glass.",
      continueLabel: "Open the lift",
      lines: [
        { speaker: "Me", line: "Why did the exhibits all look like me?", tone: "player" },
        { speaker: "?", line: "Because you used them to recognize yourself.", tone: "system" },
        { speaker: "Me", line: "Where is the Last Human?", tone: "player" },
        { speaker: "?", line: "In the part you cannot imitate.", tone: "reveal" },
      ],
    },
  },
  {
    id: "level_04_to_05_elevator_memory",
    fromLevelId: "level_04_memory_clinic",
    toLevelId: "level_05_reclamation_core",
    zh: {
      system: "电梯内线",
      heading: "继续下行",
      body: "诊所的白线在门缝里断开，电梯继续向下。",
      continueLabel: "继续",
      lines: [
        { speaker: "我", line: "那些记忆一碰就疼。", tone: "player" },
        { speaker: "?", line: "疼痛也可以被装进来。", tone: "reveal" },
        { speaker: "我", line: "那我为什么舍不得？", tone: "player" },
        { speaker: "?", line: "因为舍不得，是你最像他的地方。", tone: "system" },
      ],
    },
    en: {
      system: "Elevator Line",
      heading: "Still Descending",
      body: "The clinic's white line breaks at the door seam. The lift keeps descending.",
      continueLabel: "Continue",
      lines: [
        { speaker: "Me", line: "Those memories hurt when I touched them.", tone: "player" },
        { speaker: "?", line: "Pain can be installed too.", tone: "reveal" },
        { speaker: "Me", line: "Then why can't I let go?", tone: "player" },
        { speaker: "?", line: "Because not letting go is where you most resemble him.", tone: "system" },
      ],
    },
  },
];

export function campaignTransitionDialogueFor(
  fromLevelId: string,
  toLevelId: string,
  language: GameLanguage,
): CampaignTransitionDialogueCopy | null {
  const dialogue = campaignTransitionDialogues.find(
    (candidate) => candidate.fromLevelId === fromLevelId && candidate.toLevelId === toLevelId,
  );
  if (!dialogue) return null;
  const localized = language === "en" ? dialogue.en : dialogue.zh;
  return {
    id: dialogue.id,
    fromLevelId: dialogue.fromLevelId,
    toLevelId: dialogue.toLevelId,
    ...localized,
  };
}
