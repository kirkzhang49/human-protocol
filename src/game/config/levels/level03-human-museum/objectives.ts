import type { LevelObjectiveDefinition, LevelRuntimeEventDefinition } from "../../schema/levelConfig";

export const level03Objectives = [
  {
    "id": "obj_calibrate_level_03_tool",
    "type": "custom",
    "title": "校准工具档案",
    "detail": "在工具展柜完成校准。",
    "requiredIds": [
      "level_03_tool_calibration"
    ],
    "completesWhen": {
      "type": "puzzle_completed",
      "id": "level_03_tool_calibration"
    },
    "hudLabel": "工具校准",
    "startsWhen": {
      "type": "level_start"
    },
    "nextObjectiveId": "obj_open_level_03_voice_door"
  },
  {
    "id": "obj_open_level_03_voice_door",
    "type": "open_door",
    "title": "打开 主展厅 → 声纹展厅",
    "detail": "靠近门并打开它。",
    "requiredIds": [
      "level_03_voice_door"
    ],
    "completesWhen": {
      "type": "door_opened",
      "id": "level_03_voice_door"
    },
    "hudLabel": "开门",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_calibrate_level_03_tool"
    },
    "nextObjectiveId": "obj_collect_level_03_body_door"
  },
  {
    "id": "obj_collect_level_03_body_door",
    "type": "collect_key",
    "title": "找到身体展厅门禁片",
    "detail": "在「声纹展厅」找到它。",
    "requiredIds": [
      "key_level_03_body_door"
    ],
    "completesWhen": {
      "type": "key_collected",
      "id": "key_level_03_body_door"
    },
    "hudLabel": "钥匙",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_open_level_03_voice_door"
    },
    "nextObjectiveId": "obj_open_level_03_body_door"
  },
  {
    "id": "obj_open_level_03_body_door",
    "type": "open_door",
    "title": "打开 主展厅 → 身体展厅",
    "detail": "靠近门并打开它。",
    "requiredIds": [
      "level_03_body_door"
    ],
    "completesWhen": {
      "type": "door_opened",
      "id": "level_03_body_door"
    },
    "hudLabel": "开门",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_collect_level_03_body_door"
    },
    "nextObjectiveId": "obj_puzzle_level_03_archive_door"
  },
  {
    "id": "obj_puzzle_level_03_archive_door",
    "type": "custom",
    "title": "确认灯序",
    "detail": "看灯墙亮序后按顺序击中色球。",
    "requiredIds": [
      "builder_color_lock"
    ],
    "completesWhen": {
      "type": "puzzle_completed",
      "id": "builder_color_lock"
    },
    "hudLabel": "灯序记忆锁",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_open_level_03_body_door"
    },
    "nextObjectiveId": "obj_open_level_03_archive_door"
  },
  {
    "id": "obj_open_level_03_archive_door",
    "type": "open_door",
    "title": "打开 身体展厅 → 中央档案室",
    "detail": "靠近门并打开它。",
    "requiredIds": [
      "level_03_archive_door"
    ],
    "completesWhen": {
      "type": "door_opened",
      "id": "level_03_archive_door"
    },
    "hudLabel": "开门",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_puzzle_level_03_archive_door"
    },
    "nextObjectiveId": "obj_survive_door_endnke"
  },
  {
    "id": "obj_survive_door_endnke",
    "type": "survive_wave",
    "title": "清剿「中央档案室」",
    "detail": "击毁房间里的机器人，门才会解锁。",
    "requiredIds": [
      "wave_level_03_central_archive"
    ],
    "completesWhen": {
      "type": "wave_completed",
      "id": "wave_level_03_central_archive"
    },
    "hudLabel": "清剿",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_open_level_03_archive_door"
    },
    "nextObjectiveId": "obj_open_door_endnke"
  },
  {
    "id": "obj_open_door_endnke",
    "type": "open_door",
    "title": "打开 中央档案室 → 中央档案室 副本",
    "detail": "靠近门并打开它。",
    "requiredIds": [
      "door_endnke"
    ],
    "completesWhen": {
      "type": "door_opened",
      "id": "door_endnke"
    },
    "hudLabel": "开门",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_survive_door_endnke"
    },
    "nextObjectiveId": "obj_route_level_03_official_exit_door"
  },
  {
    "id": "obj_route_level_03_official_exit_door",
    "type": "custom",
    "title": "改接闭馆电梯路由",
    "detail": "进入右侧管制房间，使用路由台打开闭馆电梯门。",
    "requiredIds": [
      "route_route_z43akm:out_1_route_out_yf"
    ],
    "completesWhen": {
      "type": "switch_activated",
      "id": "route_route_z43akm",
      "optionId": "out_1_route_out_yf"
    },
    "hudLabel": "路由",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_open_door_endnke"
    },
    "nextObjectiveId": "obj_open_level_03_official_exit_door"
  },
  {
    "id": "obj_open_level_03_official_exit_door",
    "type": "open_door",
    "title": "打开 中央档案室 → 闭馆电梯",
    "detail": "靠近门并打开它。",
    "requiredIds": [
      "level_03_official_exit_door"
    ],
    "completesWhen": {
      "type": "door_opened",
      "id": "level_03_official_exit_door"
    },
    "hudLabel": "开门",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_route_level_03_official_exit_door"
    },
    "nextObjectiveId": "obj_reach_exit"
  },
  {
    "id": "obj_reach_exit",
    "type": "reach_exit",
    "title": "进入撤离电梯",
    "detail": "抵达出口，启动它。",
    "requiredIds": [
      "level_03_official_exit_interaction"
    ],
    "completesWhen": {
      "type": "interaction_completed",
      "id": "level_03_official_exit_interaction"
    },
    "hudLabel": "撤离",
    "startsWhen": {
      "type": "objective_completed",
      "id": "obj_open_level_03_official_exit_door"
    }
  }
] as const satisfies readonly LevelObjectiveDefinition[];

export const level03Events = [
  {
    "id": "level_03_unlock_exit_on_enter",
    "trigger": {
      "type": "room_entered",
      "id": "level_03_official_exit_room"
    },
    "once": true,
    "actions": [
      {
        "type": "unlock_exit"
      }
    ]
  },
  {
    "id": "level_03_unlock_exit_on_elevator_open",
    "trigger": {
      "type": "door_opened",
      "id": "level_03_official_exit_door"
    },
    "once": true,
    "actions": [
      {
        "type": "unlock_exit"
      }
    ]
  }
] as const satisfies readonly LevelRuntimeEventDefinition[];
