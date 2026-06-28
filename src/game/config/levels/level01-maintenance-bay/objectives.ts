import type { LevelObjectiveDefinition, LevelRuntimeEventDefinition } from "../../schema/levelConfig";

export const level01Objectives: readonly LevelObjectiveDefinition[] = [
    {
      id: "obj_survive_service_elevator_door",
      type: "survive_wave",
      title: "清剿维修主舱",
      detail: "击毁维修舱里的机器人，电梯门才会解锁。",
      requiredIds: ["first_contact", "wave_01", "wave_02", "elite_wave"],
      startsWhen: { type: "level_start" },
      completesWhen: { type: "wave_completed", id: "elite_wave" },
      nextObjectiveId: "obj_open_service_elevator_door",
      hudLabel: "清剿",
      guidance: { targetType: "door", targetId: "service_elevator_door", label: "维修电梯门", detail: "清掉有限波次后开启", urgency: "danger" },
    },
    {
      id: "obj_open_service_elevator_door",
      type: "open_door",
      title: "打开维修电梯门",
      detail: "威胁解除后，维修电梯门会放行。",
      requiredIds: ["service_elevator_door"],
      startsWhen: { type: "objective_completed", id: "obj_survive_service_elevator_door" },
      completesWhen: { type: "door_opened", id: "service_elevator_door" },
      nextObjectiveId: "obj_reach_exit",
      hudLabel: "电梯门",
      guidance: { targetType: "door", targetId: "service_elevator_door", label: "维修电梯门", detail: "主舱北侧", urgency: "exit" },
    },
    {
      id: "obj_reach_exit",
      type: "reach_exit",
      title: "冲进维修电梯",
      detail: "门已经开了，不要恋战。",
      requiredIds: ["use_builder_exit"],
      startsWhen: { type: "objective_completed", id: "obj_open_service_elevator_door" },
      completesWhen: { type: "interaction_completed", id: "use_builder_exit" },
      hudLabel: "撤离",
    },
  ];

export const level01Events: readonly LevelRuntimeEventDefinition[] = [
    {
      id: "level_01_initial_lighting_state",
      trigger: { type: "level_start" },
      once: true,
      actions: [
        { type: "set_environment_state", stateId: "level_01_lights_on" },
        { type: "set_environment_state", stateId: "level_01_elevator_locked_red" },
      ],
    },
    {
      id: "level_01_elevator_open_blue_state",
      trigger: { type: "wave_completed", id: "elite_wave" },
      once: true,
      actions: [
        { type: "clear_environment_state", stateId: "level_01_elevator_locked_red" },
        { type: "set_environment_state", stateId: "level_01_elevator_open_blue" },
      ],
    },
    {
      id: "level_01_unlock_exit_on_enter",
      trigger: { type: "room_entered", id: "service_elevator_room" },
      once: true,
      actions: [
        { type: "unlock_exit" },
      ],
    },
  ];
