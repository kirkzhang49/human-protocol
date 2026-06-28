import type { DialogueDefinition } from "../../dialogueScripts";
import type { LevelArticleDefinition } from "../../schema/levelConfig";

export const level04Dialogues = [
  { id: "level_04_start_01", trigger: "level_start", speaker: "诊所广播", line: "请沿白线前进。记忆校准不会疼。", tone: "system", duration: 2.8 },
  { id: "level_04_exit_01", trigger: "level_04_exit_01", speaker: "出院电梯", line: "出院门已开。未关闭记录随行。", tone: "reveal", duration: 2.4 },
] as const satisfies readonly DialogueDefinition[];

export const level04Articles = [] as const satisfies readonly LevelArticleDefinition[];
