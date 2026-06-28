import type { LevelObjectiveDefinition, LevelRuntimeEventDefinition } from "../../schema/levelConfig";

export const level05Objectives = [
  {
    id: "level_05_reach_identity_file",
    type: "reach_exit",
    title: "进入撤离电梯",
    detail: "空的回收核心尽头还亮着。",
    requiredIds: ["level_05_identity_interaction"],
    startsWhen: { type: "level_start" },
    completesWhen: { type: "interaction_completed", id: "level_05_identity_interaction" },
    hudLabel: "撤离电梯",
    guidance: { targetType: "exit", targetId: "level_05_identity_interaction", label: "撤离电梯", detail: "穿过回收内台", urgency: "exit" },
  },
] as const satisfies readonly LevelObjectiveDefinition[];

export const level05Events = [
  {
    id: "level_05_unlock_exit_on_enter",
    trigger: { type: "room_entered", id: "level_05_identity_file" },
    once: true,
    actions: [{ type: "unlock_exit" }],
  },
] as const satisfies readonly LevelRuntimeEventDefinition[];
