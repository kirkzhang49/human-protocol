import type { LevelMapConfig } from "../../schema/levelConfig";
import {
  createOfficialExitElevatorReferenceProps,
  createOfficialExitRoomReference,
  officialExitDoorAnimationReference,
} from "../../shared/exitRoomReference";

export const level03Map = {
  "id": "level_03_human_museum_map",
  "schemaVersion": "hp.map.v1",
  "presentation": {
    "roomKit": "hp:human_museum_gallery_v1",
    "lightingPreset": "hp:human_museum_gallery_lighting_v1",
    "shellKit": "hp:human_museum_gallery_shell_v1",
    "propSet": "hp:human_museum_props_v1",
    "pickupLayout": "hp:human_museum_archive_pickups_v1",
    "overrides": {
      "propDensity": "dense",
      "floorWear": 0.42,
      "ceilingLightIntensity": 1.08,
      "pickupVisibility": "critical_items_high"
    }
  },
  "rooms": [
    {
      "id": "level_03_entry_hall",
      "label": "博物馆入口",
      "bounds": {
        "center": [
          0,
          0,
          12
        ],
        "size": [
          12,
          4,
          7
        ]
      },
      "mood": "uneasy",
      "skinKey": "human_museum_gallery",
      "floorMaterialKey": "level03_museum_floor_premium_stone",
      "wallMaterialKey": "level03_museum_wall_black_gallery",
      "aesthetic": {
        "style": "museum",
        "detail": "medium"
      },
      "ambientPressure": 0.44,
      "entryDialogueTrigger": "level_start",
      "geometry": {
        "renderFloor": true,
        "renderWalls": true,
        "renderCeiling": true,
        "collisionWalls": true,
        "accentColor": "#d6ebe8"
      }
    },
    {
      "id": "level_03_gallery_lobby",
      "label": "主展厅",
      "bounds": {
        "center": [
          0,
          0,
          3.5
        ],
        "size": [
          18,
          4,
          11
        ]
      },
      "mood": "combat",
      "skinKey": "human_museum_gallery",
      "floorMaterialKey": "level03_museum_floor_premium_stone",
      "wallMaterialKey": "level03_museum_wall_black_gallery",
      "aesthetic": {
        "style": "museum",
        "detail": "high"
      },
      "ambientPressure": 0.64,
      "entryDialogueTrigger": "level_03_lobby_entry",
      "geometry": {
        "renderFloor": true,
        "renderWalls": true,
        "renderCeiling": true,
        "collisionWalls": true,
        "accentColor": "#d6ebe8"
      }
    },
    {
      "id": "level_03_tool_exhibit",
      "label": "工具展厅",
      "bounds": {
        "center": [
          -12.2,
          0,
          3.5
        ],
        "size": [
          7,
          4,
          7
        ]
      },
      "mood": "quiet",
      "skinKey": "human_museum_gallery",
      "floorMaterialKey": "level03_museum_floor_premium_stone",
      "wallMaterialKey": "level03_museum_wall_black_gallery",
      "aesthetic": {
        "style": "museum",
        "detail": "high"
      },
      "ambientPressure": 0.54,
      "geometry": {
        "renderFloor": true,
        "renderWalls": true,
        "renderCeiling": true,
        "collisionWalls": true,
        "accentColor": "#ffd36d"
      }
    },
    {
      "id": "level_03_voice_exhibit",
      "label": "声纹展厅",
      "bounds": {
        "center": [
          12.2,
          0,
          3.5
        ],
        "size": [
          7,
          4,
          7
        ]
      },
      "mood": "uneasy",
      "skinKey": "human_museum_gallery",
      "floorMaterialKey": "level03_museum_floor_premium_stone",
      "wallMaterialKey": "level03_museum_wall_black_gallery",
      "aesthetic": {
        "style": "museum",
        "detail": "high"
      },
      "ambientPressure": 0.58,
      "geometry": {
        "renderFloor": true,
        "renderWalls": true,
        "renderCeiling": true,
        "collisionWalls": true,
        "accentColor": "#7ff2ff"
      }
    },
    {
      "id": "level_03_body_exhibit",
      "label": "身体展厅",
      "bounds": {
        "center": [
          0,
          0,
          -5
        ],
        "size": [
          12,
          4,
          7
        ]
      },
      "mood": "reveal",
      "skinKey": "human_museum_gallery",
      "floorMaterialKey": "level03_museum_floor_premium_stone",
      "wallMaterialKey": "level03_museum_wall_black_gallery",
      "aesthetic": {
        "style": "museum",
        "detail": "high"
      },
      "ambientPressure": 0.74,
      "geometry": {
        "renderFloor": true,
        "renderWalls": true,
        "renderCeiling": true,
        "collisionWalls": true,
        "accentColor": "#ecfbff"
      }
    },
    {
      "id": "level_03_central_archive",
      "label": "中央档案室",
      "bounds": {
        "center": [
          0,
          0,
          -12.65
        ],
        "size": [
          13,
          4,
          9.3
        ]
      },
      "mood": "boss",
      "skinKey": "human_museum_gallery",
      "floorMaterialKey": "level03_museum_floor_premium_stone",
      "wallMaterialKey": "level03_museum_wall_black_gallery",
      "aesthetic": {
        "style": "museum",
        "detail": "high"
      },
      "ambientPressure": 0.9,
      "geometry": {
        "renderFloor": true,
        "renderWalls": true,
        "renderCeiling": true,
        "collisionWalls": true,
        "accentColor": "#b84b43"
      }
    },
    createOfficialExitRoomReference({
      id: "level_03_official_exit_room",
      label: "闭馆电梯",
      doorPosition: [0, 0, -17.3],
    }),
    {
      "id": "room_kqrkp0",
      "label": "中央档案室 副本",
      "bounds": {
        "center": [
          12.75,
          0,
          -13
        ],
        "size": [
          12.5,
          4,
          7.4
        ]
      },
      "mood": "boss",
      "skinKey": "human_museum_gallery",
      "floorMaterialKey": "level03_museum_floor_premium_stone",
      "wallMaterialKey": "level03_museum_wall_black_gallery",
      "aesthetic": {
        "style": "museum",
        "detail": "high"
      },
      "ambientPressure": 0.84,
      "geometry": {
        "renderFloor": true,
        "renderWalls": true,
        "renderCeiling": true,
        "collisionWalls": true,
        "accentColor": "#b84b43"
      }
    }
  ],
  "doors": [
    {
      "id": "level_03_lobby_door",
      "label": "博物馆入口 → 主展厅",
      "fromRoomId": "level_03_entry_hall",
      "toRoomId": "level_03_gallery_lobby",
      "position": [
        0,
        0,
        8.75
      ],
      "size": [
        3.2,
        3.2,
        0.35
      ],
      "yaw": 0,
      "defaultState": "closed",
      "lock": {
        "type": "none"
      },
      "visualKey": "museum_gallery_door",
      "materialKey": "terminal_cyan",
      "panelPosition": [
        1.78,
        0,
        9.1
      ],
      "autoOpenOnApproach": true,
      "openVisualPolicy": {
        "hideClosedHardwareAfterOpen": true
      }
    },
    {
      "id": "level_03_tool_door",
      "label": "主展厅 → 工具展厅",
      "fromRoomId": "level_03_gallery_lobby",
      "toRoomId": "level_03_tool_exhibit",
      "position": [
        -8.85,
        0,
        3.5
      ],
      "size": [
        3.2,
        3.2,
        0.35
      ],
      "yaw": 1.5707963267948966,
      "defaultState": "closed",
      "lock": {
        "type": "none"
      },
      "visualKey": "museum_gallery_door",
      "materialKey": "terminal_cyan",
      "panelPosition": [
        -8.5,
        0,
        5.279999999999999
      ],
      "autoOpenOnApproach": true,
      "openVisualPolicy": {
        "hideClosedHardwareAfterOpen": true
      }
    },
    {
      "id": "level_03_voice_door",
      "label": "主展厅 → 声纹展厅",
      "fromRoomId": "level_03_gallery_lobby",
      "toRoomId": "level_03_voice_exhibit",
      "position": [
        8.85,
        0,
        3.5
      ],
      "size": [
        3.2,
        3.2,
        0.35
      ],
      "yaw": 1.5707963267948966,
      "defaultState": "locked",
      "lock": {
        "type": "puzzle_complete",
        "puzzleId": "level_03_tool_calibration",
        "lockedMessage": "先校准工具档案。",
        "unlockedMessage": "工具档案确认，门已解锁。"
      },
      "visualKey": "museum_gallery_door",
      "materialKey": "terminal_cyan",
      "panelPosition": [
        9.2,
        0,
        5.279999999999999
      ],
      "autoOpenOnApproach": false,
      "openVisualPolicy": {
        "hideClosedHardwareAfterOpen": true
      }
    },
    {
      "id": "level_03_body_door",
      "label": "主展厅 → 身体展厅",
      "fromRoomId": "level_03_gallery_lobby",
      "toRoomId": "level_03_body_exhibit",
      "position": [
        0,
        0,
        -1.75
      ],
      "size": [
        3.2,
        3.2,
        0.35
      ],
      "yaw": 0,
      "defaultState": "locked",
      "lock": {
        "type": "key_item",
        "keyItemId": "key_level_03_body_door",
        "lockedMessage": "缺少门禁片。去「声纹展厅」找找。",
        "unlockedMessage": "门禁确认，门已解锁。"
      },
      "visualKey": "museum_gallery_door",
      "materialKey": "terminal_red",
      "panelPosition": [
        1.78,
        0,
        -1.4
      ],
      "autoOpenOnApproach": false,
      "openVisualPolicy": {
        "hideClosedHardwareAfterOpen": true
      }
    },
    {
      "id": "level_03_archive_door",
      "label": "身体展厅 → 中央档案室",
      "fromRoomId": "level_03_body_exhibit",
      "toRoomId": "level_03_central_archive",
      "position": [
        0,
        0,
        -8.25
      ],
      "size": [
        3.2,
        3.2,
        0.35
      ],
      "yaw": 0,
      "defaultState": "locked",
      "lock": {
        "type": "puzzle_complete",
        "puzzleId": "builder_color_lock",
        "lockedMessage": "灯序尚未确认。",
        "unlockedMessage": "灯序确认。"
      },
      "visualKey": "museum_gallery_door",
      "materialKey": "terminal_cyan",
      "panelPosition": [
        1.78,
        0,
        -7.9
      ],
      "autoOpenOnApproach": false,
      "openVisualPolicy": {
        "hideClosedHardwareAfterOpen": true
      },
      "openedDialogueTrigger": "level_03_archive_open"
    },
    {
      "id": "level_03_official_exit_door",
      "label": "中央档案室 → 闭馆电梯",
      "fromRoomId": "level_03_central_archive",
      "toRoomId": "level_03_official_exit_room",
      "position": [
        0,
        0,
        -17.3
      ],
      "size": [
        3.2,
        3.2,
        0.35
      ],
      "yaw": 0,
      "defaultState": "locked",
      "lock": {
        "type": "objective_complete",
        "objectiveId": "obj_route_level_03_official_exit_door",
        "lockedMessage": "先在右侧管制房间改接闭馆电梯路由。",
        "unlockedMessage": "路由确认，闭馆电梯门已解锁。"
      },
      ...officialExitDoorAnimationReference,
      "panelPosition": [
        1.78,
        0,
        -16.95
      ],
      "cameraImpact": {
        "shake": 0.34,
        "fovKick": 1.85
      }
    },
    {
      "id": "door_endnke",
      "label": "中央档案室 → 中央档案室 副本",
      "fromRoomId": "level_03_central_archive",
      "toRoomId": "room_kqrkp0",
      "position": [
        6.5,
        0,
        -13
      ],
      "size": [
        3.2,
        3.2,
        0.35
      ],
      "yaw": 1.5707963267948966,
      "defaultState": "locked",
      "lock": {
        "type": "survive_wave",
        "waveId": "wave_level_03_central_archive",
        "lockedMessage": "清掉「中央档案室」里的机器人，门才会开。",
        "unlockedMessage": "威胁解除，门已解锁。"
      },
      "visualKey": "museum_gallery_door",
      "materialKey": "terminal_red",
      "panelPosition": [
        6.85,
        0,
        -11.22
      ],
      "autoOpenOnApproach": false,
      "openVisualPolicy": {
        "hideClosedHardwareAfterOpen": true
      }
    }
  ],
  "keyItems": [
    {
      "id": "key_level_03_body_door",
      "label": "身体展厅门禁片",
      "roomId": "level_03_voice_exhibit",
      "position": [
        10,
        0,
        6
      ],
      "collectRadius": 1.5,
      "visualKey": "large_yellow_key",
      "materialKey": "access_card_gold",
      "requiredForDoorIds": [
        "level_03_body_door"
      ],
      "dialogueTrigger": "level_03_voice_chip_taken",
      "rewardPulse": {
        "label": "门禁片",
        "detail": "身体展厅 的门可以打开了",
        "rarity": "rare"
      }
    },
    {
      "id": "route_route_z43akm_key",
      "label": "管制路由台门禁片",
      "roomId": "level_03_gallery_lobby",
      "position": [
        -5.04,
        0,
        0.86
      ],
      "collectRadius": 1.5,
      "visualKey": "route_access_chip",
      "materialKey": "terminal_cyan",
      "requiredForDoorIds": [],
      "rewardPulse": {
        "label": "管制路由台已授权",
        "detail": "路由输出可以切换",
        "rarity": "rare"
      }
    }
  ],
  "interactions": [
    {
      "id": "builder_color_clue",
      "type": "terminal",
      "roomId": "level_03_gallery_lobby",
      "position": [
        -7,
        0,
        -0.5
      ],
      "radius": 1.55,
      "visualKey": "puzzle_console_color_sequence",
      "materialKey": "terminal_cyan",
      "label": "灯序墙"
    },
    {
      "id": "level_03_tool_case",
      "type": "terminal",
      "roomId": "level_03_tool_exhibit",
      "position": [
        -12.2,
        0,
        2.15
      ],
      "radius": 1.9,
      "visualKey": "none",
      "materialKey": "terminal_cyan",
      "anchorPropId": "level_03_tool_last_human_tool_vitrine",
      "label": "工具档案校准"
    },
    {
      "id": "route_route_z43akm_panel",
      "type": "switch",
      "roomId": "room_kqrkp0",
      "position": [
        9.35,
        0,
        -15.65
      ],
      "radius": 1.85,
      "visualKey": "direction_keypad_panel",
      "materialKey": "terminal_cyan",
      "label": "管制路由台",
      "consumesKeyItemId": "route_route_z43akm_key",
      "rewardPulse": {
        "label": "管制路由台",
        "detail": "输出已改接",
        "rarity": "rare"
      }
    },
    {
      "id": "story_level_03_tool_human_origin_wall_art",
      "type": "article",
      "roomId": "level_03_tool_exhibit",
      "position": [
        -14.2,
        0,
        6.56
      ],
      "radius": 1.69878,
      "visualKey": "none",
      "materialKey": "terminal_cyan",
      "anchorPropId": "level_03_tool_human_origin_wall_art",
      "label": "人类起源壁画"
    },
    {
      "id": "story_level_03_voice_robot_worker_wall_art",
      "type": "article",
      "roomId": "level_03_voice_exhibit",
      "position": [
        14.2,
        0,
        6.56
      ],
      "radius": 1.69878,
      "visualKey": "none",
      "materialKey": "terminal_cyan",
      "anchorPropId": "level_03_voice_robot_worker_wall_art",
      "label": "机器劳工壁画"
    },
    {
      "id": "story_level_03_body_last_human_wall_art",
      "type": "article",
      "roomId": "level_03_body_exhibit",
      "position": [
        5.72,
        0,
        -5.1
      ],
      "radius": 1.74974,
      "visualKey": "none",
      "materialKey": "terminal_cyan",
      "anchorPropId": "level_03_body_last_human_wall_art",
      "label": "最后人类壁画"
    },
    {
      "id": "story_level_03_archive_protocol_diagram_wall_art",
      "type": "article",
      "roomId": "level_03_central_archive",
      "position": [
        -6.22,
        0,
        -13
      ],
      "radius": 1.76248,
      "visualKey": "none",
      "materialKey": "terminal_cyan",
      "anchorPropId": "level_03_archive_protocol_diagram_wall_art",
      "label": "协议图解壁画"
    },
    {
      "id": "level_03_official_exit_interaction",
      "type": "exit",
      "roomId": "level_03_official_exit_room",
      "position": [
        2.82,
        0,
        -20.7
      ],
      "radius": 2.2,
      "visualKey": "service_elevator_panel",
      "materialKey": "terminal_cyan",
      "label": "进入撤离电梯",
      "opensDoorId": "level_03_official_exit_door"
    }
  ],
  "pickups": [
    {
      "id": "level_03_med_01",
      "type": "repairKit",
      "roomId": "level_03_entry_hall",
      "position": [
        -4.5,
        0,
        11.5
      ],
      "label": "治疗包"
    },
    {
      "id": "level_03_cell_01",
      "type": "coreCell",
      "roomId": "level_03_gallery_lobby",
      "position": [
        3.5,
        0,
        0
      ],
      "label": "能量块"
    }
  ],
  "props": [
    {
      "id": "level_03_tool_human_origin_wall_art",
      "roomId": "level_03_tool_exhibit",
      "modelKey": "age_museum_wall_art_human_origin",
      "position": [
        -14.2,
        0.85,
        6.56
      ],
      "rotation": [
        0,
        3.141592653589793,
        0
      ],
      "scale": 0.94,
      "label": "人类起源壁画"
    },
    {
      "id": "level_03_voice_robot_worker_wall_art",
      "roomId": "level_03_voice_exhibit",
      "modelKey": "age_museum_wall_art_robot_worker",
      "position": [
        14.2,
        0.85,
        6.56
      ],
      "rotation": [
        0,
        3.141592653589793,
        0
      ],
      "scale": 0.94,
      "label": "机器劳工壁画"
    },
    {
      "id": "level_03_tool_last_human_tool_vitrine",
      "roomId": "level_03_tool_exhibit",
      "modelKey": "room_museum_last_human_tool_vitrine",
      "position": [
        -12.2,
        0.045,
        2.2
      ],
      "rotation": [
        0,
        0.05,
        0
      ],
      "scale": 1,
      "label": "最后人类工具柜",
      "collider": {
        "halfSize": [
          1.05,
          0.59,
          0.45
        ]
      }
    },
    {
      "id": "level_03_voice_archive_case_asset",
      "roomId": "level_03_voice_exhibit",
      "modelKey": "room_museum_voice_archive_case",
      "position": [
        12.2,
        0.045,
        2
      ],
      "rotation": [
        0,
        -0.08,
        0
      ],
      "scale": 1,
      "label": "声纹记忆玻璃柜",
      "collider": {
        "halfSize": [
          0.71,
          0.86,
          0.46
        ]
      }
    },
    {
      "id": "level_03_body_skeleton_vitrine_asset",
      "roomId": "level_03_body_exhibit",
      "modelKey": "room_museum_skeleton_vitrine",
      "position": [
        -3.15,
        0.045,
        -5.35
      ],
      "rotation": [
        0,
        -0.08,
        0
      ],
      "scale": 1,
      "label": "身体记忆玻璃柜",
      "collider": {
        "halfSize": [
          0.81,
          1.06,
          0.45
        ]
      }
    },
    {
      "id": "level_03_lobby_glass_vitrine_context",
      "roomId": "level_03_gallery_lobby",
      "modelKey": "room_museum_glass_vitrine_specimen",
      "position": [
        -7.5,
        0,
        7
      ],
      "rotation": [
        0,
        2.356194490192345,
        0
      ],
      "scale": 0.88,
      "label": "玻璃陈列柜·发光标本",
      "collider": {
        "halfSize": [
          0.55,
          0.8271999999999999,
          0.47080000000000005
        ]
      }
    },
    {
      "id": "level_03_body_display_plinth_context",
      "roomId": "level_03_body_exhibit",
      "modelKey": "room_l3_img2_display_plinth",
      "position": [
        4.1,
        0,
        -6.85
      ],
      "rotation": [
        0,
        -0.28,
        0
      ],
      "scale": 0.72,
      "label": "展柜基座",
      "collider": {
        "halfSize": [
          0.324,
          0.531,
          0.324
        ]
      }
    },
    {
      "id": "level_03_orb_red_pedestal",
      "roomId": "level_03_body_exhibit",
      "modelKey": "age_museum_color_orb_pedestal",
      "position": [
        -2.55,
        0.045,
        -6.54
      ],
      "rotation": [
        0,
        -0.28,
        0
      ],
      "scale": 0.68,
      "label": "红灯展台",
      "collider": {
        "halfSize": [
          0.36,
          0.46,
          0.36
        ]
      }
    },
    {
      "id": "level_03_orb_blue_pedestal",
      "roomId": "level_03_voice_exhibit",
      "modelKey": "age_museum_color_orb_pedestal",
      "position": [
        14.5,
        0.045,
        1.5
      ],
      "rotation": [
        0,
        -0.18,
        0
      ],
      "scale": 0.68,
      "label": "蓝灯展台",
      "collider": {
        "halfSize": [
          0.36,
          0.46,
          0.36
        ]
      }
    },
    {
      "id": "level_03_orb_green_pedestal",
      "roomId": "level_03_body_exhibit",
      "modelKey": "age_museum_color_orb_pedestal",
      "position": [
        2.55,
        0.045,
        -6.54
      ],
      "rotation": [
        0,
        0.15,
        0
      ],
      "scale": 0.68,
      "label": "绿灯展台",
      "collider": {
        "halfSize": [
          0.36,
          0.46,
          0.36
        ]
      }
    },
    {
      "id": "level_03_orb_yellow_pedestal",
      "roomId": "level_03_tool_exhibit",
      "modelKey": "age_museum_color_orb_pedestal",
      "position": [
        -14.5,
        0.045,
        1.5
      ],
      "rotation": [
        0,
        -0.25,
        0
      ],
      "scale": 0.68,
      "label": "黄灯展台",
      "collider": {
        "halfSize": [
          0.36,
          0.46,
          0.36
        ]
      }
    },
    {
      "id": "level_03_orb_purple_pedestal",
      "roomId": "level_03_entry_hall",
      "modelKey": "age_museum_color_orb_pedestal",
      "position": [
        -4.5,
        0.045,
        10
      ],
      "rotation": [
        0,
        0.08,
        0
      ],
      "scale": 0.68,
      "label": "紫灯展台",
      "collider": {
        "halfSize": [
          0.36,
          0.46,
          0.36
        ]
      }
    },
    {
      "id": "level_03_body_last_human_wall_art",
      "roomId": "level_03_body_exhibit",
      "modelKey": "age_museum_wall_art_last_human",
      "position": [
        5.72,
        0.88,
        -5.1
      ],
      "rotation": [
        0,
        -1.5707963267948966,
        0
      ],
      "scale": 1.02,
      "label": "最后人类壁画"
    },
    {
      "id": "level_03_archive_protocol_diagram_wall_art",
      "roomId": "level_03_central_archive",
      "modelKey": "age_museum_wall_art_protocol_diagram",
      "position": [
        -6.22,
        0.88,
        -13
      ],
      "rotation": [
        0,
        1.5707963267948966,
        0
      ],
      "scale": 1.04,
      "label": "协议图解壁画"
    },
    {
      "id": "prop_1ossov",
      "roomId": "room_kqrkp0",
      "modelKey": "room_museum_glass_vitrine_specimen",
      "position": [
        12,
        0,
        -15.5
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": 1,
      "label": "证物玻璃柜",
      "collider": {
        "halfSize": [
          0.55,
          0.8271999999999999,
          0.47080000000000005
        ]
      }
    },
    {
      "id": "prop_acf9cc",
      "roomId": "room_kqrkp0",
      "modelKey": "room_museum_voice_archive_case",
      "position": [
        17,
        0,
        -10.5
      ],
      "rotation": [
        0,
        16.493361431346422,
        0
      ],
      "scale": 1,
      "label": "声纹档案柜",
      "collider": {
        "halfSize": [
          0.71,
          0.86,
          0.46
        ]
      }
    },
    ...createOfficialExitElevatorReferenceProps({
      idPrefix: "builder_exit",
      roomId: "level_03_official_exit_room",
      doorPosition: [0, 0, -17.3],
      tags: ["builder", "playtest"],
    }),
    {
      "id": "prop_3r5g00",
      "roomId": "level_03_entry_hall",
      "modelKey": "room_cc0_bust",
      "position": [
        -2,
        0,
        9.5
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": 1,
      "label": "大理石胸像",
      "collider": {
        "halfSize": [
          0.356,
          0.675,
          0.393
        ]
      }
    },
    {
      "id": "prop_lvm57s",
      "roomId": "level_03_tool_exhibit",
      "modelKey": "room_cc0_bull_head_plinth",
      "position": [
        -9.5,
        0,
        1
      ],
      "rotation": [
        0,
        5.497787143782138,
        0
      ],
      "scale": 1,
      "label": "青铜牛头雕塑",
      "collider": {
        "halfSize": [
          0.4825,
          0.64,
          0.4825
        ]
      }
    },
    {
      "id": "prop_67ear6",
      "roomId": "level_03_gallery_lobby",
      "modelKey": "room_cc0_antique_ceramic_vase_01",
      "position": [
        -2.5,
        0,
        -1
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": 1,
      "label": "古陶彩绘花瓶",
      "collider": {
        "halfSize": [
          0.3135,
          0.56,
          0.3135
        ]
      }
    }
  ],
  "navigation": {
    "criticalPathRoomIds": [
      "level_03_entry_hall",
      "level_03_gallery_lobby",
      "level_03_body_exhibit",
      "level_03_central_archive",
      "level_03_official_exit_room"
    ],
    "optionalRoomIds": [
      "level_03_tool_exhibit",
      "level_03_voice_exhibit",
      "room_kqrkp0"
    ],
    "maxBacktrackSeconds": 24,
    "mobileReadableDoorCount": 4
  }
} as const satisfies LevelMapConfig;
