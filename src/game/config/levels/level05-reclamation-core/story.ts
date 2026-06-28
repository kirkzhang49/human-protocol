import type { DialogueDefinition } from "../../dialogueScripts";
import type { LevelArticleDefinition, LevelQuizDefinition } from "../../schema/levelConfig";

export const level05Dialogues = [
  { id: "level_05_start_01", trigger: "level_start", speaker: "核心广播", line: "核心区已加载。前往出口标记。", tone: "system", duration: 2.8 },
  { id: "level_05_exit_01", trigger: "level_05_exit_01", speaker: "撤离电梯", line: "撤离流程接管。", tone: "system", duration: 2.4 },
] as const satisfies readonly DialogueDefinition[];

export const level05Articles = [] as const satisfies readonly LevelArticleDefinition[];

export const level05Quizzes = [] as const satisfies readonly LevelQuizDefinition[];
