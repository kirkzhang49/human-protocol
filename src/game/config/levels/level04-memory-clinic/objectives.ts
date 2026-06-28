import type { LevelObjectiveDefinition, LevelRuntimeEventDefinition } from "../../schema/levelConfig";

export const level04Objectives = [
  {
    id: "level_04_reach_exit",
    type: "reach_exit",
    title: "离开诊所",
    detail: "记忆留置尽头是出院电梯。",
    requiredIds: ["level_04_exit_interaction"],
    startsWhen: { type: "level_start" },
    completesWhen: { type: "interaction_completed", id: "level_04_exit_interaction" },
    hudLabel: "出院电梯",
    guidance: { targetType: "exit", targetId: "level_04_exit_interaction", label: "出院电梯", detail: "穿过治疗剧场", urgency: "exit" },
  },
] as const satisfies readonly LevelObjectiveDefinition[];

export const level04Events = [
  {
    id: "level_04_unlock_exit_on_enter",
    trigger: { type: "room_entered", id: "level_04_exit_room" },
    once: true,
    actions: [{ type: "unlock_exit" }],
  },
] as const satisfies readonly LevelRuntimeEventDefinition[];
