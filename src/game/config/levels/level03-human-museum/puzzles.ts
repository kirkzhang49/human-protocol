import type { LevelPuzzleDefinition } from "../../schema/levelConfig";

export const level03Puzzles = [
  {
    "id": "builder_color_lock",
    "type": "hit_sequence",
    "label": "灯序记忆锁",
    "roomId": "level_03_body_exhibit",
    "clue": {
      "type": "pattern_panel",
      "roomId": "level_03_gallery_lobby",
      "interactionId": "builder_color_clue",
      "sequence": [
        "orb_red",
        "orb_blue",
        "orb_yellow",
        "orb_green",
        "orb_purple"
      ],
      "label": "墙面灯序只亮一次。",
      "playback": {
        "palette": [
          "red",
          "blue",
          "yellow",
          "green",
          "purple",
          "white",
          "cyan"
        ],
        "stepMs": 560,
        "gapMs": 130,
        "requireReplayBeforeInput": true,
        "reshuffleAfterFailures": 3,
        "replayRequiredMessage": "回灯墙再看。",
        "reshuffleMessage": "灯墙已换序。"
      }
    },
    "input": {
      "method": "weapon_hit",
      "resetOnMistake": true,
      "showProgressPulse": true
    },
    "targets": [
      {
        "id": "orb_red",
        "label": "红色球",
        "roomId": "level_03_body_exhibit",
        "position": [
          -2.55,
          1.15,
          -6.54
        ],
        "radius": 0.72,
        "colorKey": "red",
        "visualKey": "puzzle_orb_red",
        "anchorPropId": "level_03_orb_red_pedestal"
      },
      {
        "id": "orb_blue",
        "label": "蓝色球",
        "roomId": "level_03_voice_exhibit",
        "position": [
          14.5,
          1.15,
          1.5
        ],
        "radius": 0.72,
        "colorKey": "blue",
        "visualKey": "puzzle_orb_blue",
        "anchorPropId": "level_03_orb_blue_pedestal"
      },
      {
        "id": "orb_yellow",
        "label": "黄色球",
        "roomId": "level_03_tool_exhibit",
        "position": [
          -14.5,
          1.15,
          1.5
        ],
        "radius": 0.72,
        "colorKey": "yellow",
        "visualKey": "puzzle_orb_yellow",
        "anchorPropId": "level_03_orb_yellow_pedestal"
      },
      {
        "id": "orb_green",
        "label": "绿色球",
        "roomId": "level_03_body_exhibit",
        "position": [
          2.55,
          1.15,
          -6.54
        ],
        "radius": 0.72,
        "colorKey": "green",
        "visualKey": "puzzle_orb_green",
        "anchorPropId": "level_03_orb_green_pedestal"
      },
      {
        "id": "orb_purple",
        "label": "紫色球",
        "roomId": "level_03_entry_hall",
        "position": [
          -4.5,
          1.15,
          10
        ],
        "radius": 0.72,
        "colorKey": "purple",
        "visualKey": "puzzle_orb_purple",
        "anchorPropId": "level_03_orb_purple_pedestal"
      }
    ],
    "actors": [
      {
        "id": "orb_red",
        "role": "orb:red",
        "kind": "target",
        "roomId": "level_03_body_exhibit",
        "position": [
          -2.55,
          1.15,
          -6.54
        ],
        "visualKey": "puzzle_orb_red",
        "colorKey": "red",
        "inputMode": "weapon_hit",
        "hitbox": {
          "shape": "sphere",
          "radius": 0.72
        },
        "anchorPropId": "level_03_orb_red_pedestal",
        "targetId": "orb_red"
      },
      {
        "id": "orb_blue",
        "role": "orb:blue",
        "kind": "target",
        "roomId": "level_03_voice_exhibit",
        "position": [
          14.5,
          1.15,
          1.5
        ],
        "visualKey": "puzzle_orb_blue",
        "colorKey": "blue",
        "inputMode": "weapon_hit",
        "hitbox": {
          "shape": "sphere",
          "radius": 0.72
        },
        "anchorPropId": "level_03_orb_blue_pedestal",
        "targetId": "orb_blue"
      },
      {
        "id": "orb_yellow",
        "role": "orb:yellow",
        "kind": "target",
        "roomId": "level_03_tool_exhibit",
        "position": [
          -14.5,
          1.15,
          1.5
        ],
        "visualKey": "puzzle_orb_yellow",
        "colorKey": "yellow",
        "inputMode": "weapon_hit",
        "hitbox": {
          "shape": "sphere",
          "radius": 0.72
        },
        "anchorPropId": "level_03_orb_yellow_pedestal",
        "targetId": "orb_yellow"
      },
      {
        "id": "orb_green",
        "role": "orb:green",
        "kind": "target",
        "roomId": "level_03_body_exhibit",
        "position": [
          2.55,
          1.15,
          -6.54
        ],
        "visualKey": "puzzle_orb_green",
        "colorKey": "green",
        "inputMode": "weapon_hit",
        "hitbox": {
          "shape": "sphere",
          "radius": 0.72
        },
        "anchorPropId": "level_03_orb_green_pedestal",
        "targetId": "orb_green"
      },
      {
        "id": "orb_purple",
        "role": "orb:purple",
        "kind": "target",
        "roomId": "level_03_entry_hall",
        "position": [
          -4.5,
          1.15,
          10
        ],
        "visualKey": "puzzle_orb_purple",
        "colorKey": "purple",
        "inputMode": "weapon_hit",
        "hitbox": {
          "shape": "sphere",
          "radius": 0.72
        },
        "anchorPropId": "level_03_orb_purple_pedestal",
        "targetId": "orb_purple"
      }
    ],
    "fail": {
      "message": "顺序错了，回灯墙。",
      "resetDelay": 0.45
    },
    "success": {
      "opensDoorId": "level_03_archive_door",
      "rewardPulse": {
        "label": "灯序确认",
        "detail": "门禁顺序已记录",
        "rarity": "epic"
      },
      "rewardPulseDuration": 1.6,
      "audio": {
        "key": "system_exit_open",
        "intensity": 0.9
      },
      "actions": [
        {
          "type": "open_door",
          "doorId": "level_03_archive_door"
        },
        {
          "type": "spawn_warning",
          "warning": {
            "label": "策展主管",
            "detail": "档案室门禁确认，重型单位启动"
          },
          "duration": 2.2
        },
        {
          "type": "camera_impact",
          "cameraImpact": {
            "shake": 0.3,
            "fovKick": 1.45,
            "rumble": 0.12,
            "rumbleDuration": 0.18
          }
        },
        {
          "type": "start_wave",
          "waveId": "wave_level_03_central_archive",
          "delay": 1.05
        },
        {
          "type": "focus_reveal",
          "reveal": {
            "kind": "door",
            "doorId": "level_03_archive_door",
            "durationSec": 2.8
          }
        }
      ]
    }
  },
  {
    "id": "level_03_tool_calibration",
    "type": "tool_calibration",
    "label": "工具档案校准",
    "roomId": "level_03_tool_exhibit",
    "interactionId": "level_03_tool_case",
    "repeatable": true,
    "toolLabel": "实验铁棒",
    "columns": 6,
    "rows": 4,
    "entry": {
      "x": 0,
      "y": 2,
      "channel": "signal"
    },
    "targets": [
      {
        "x": 5,
        "y": 1,
        "channel": "stability"
      },
      {
        "x": 5,
        "y": 3,
        "channel": "force"
      }
    ],
    "requiredCells": [
      {
        "x": 3,
        "y": 2,
        "channel": "protocol"
      }
    ],
    "perfectMoveLimit": 5,
    "maxMoveLimit": 10,
    "timeLimitSec": 90,
    "cells": [
      {
        "x": 0,
        "y": 0,
        "kind": "corner",
        "rotation": 2
      },
      {
        "x": 1,
        "y": 0,
        "kind": "straight",
        "rotation": 0
      },
      {
        "x": 2,
        "y": 0,
        "kind": "tee",
        "rotation": 3
      },
      {
        "x": 3,
        "y": 0,
        "kind": "blocked"
      },
      {
        "x": 4,
        "y": 0,
        "kind": "corner",
        "rotation": 1
      },
      {
        "x": 5,
        "y": 0,
        "kind": "straight",
        "rotation": 0
      },
      {
        "x": 0,
        "y": 1,
        "kind": "tee",
        "rotation": 2
      },
      {
        "x": 1,
        "y": 1,
        "kind": "corner",
        "rotation": 3
      },
      {
        "x": 2,
        "y": 1,
        "kind": "straight",
        "rotation": 0
      },
      {
        "x": 3,
        "y": 1,
        "kind": "corner",
        "rotation": 1
      },
      {
        "x": 4,
        "y": 1,
        "kind": "corner",
        "rotation": 0
      },
      {
        "x": 5,
        "y": 1,
        "kind": "straight",
        "rotation": 1
      },
      {
        "x": 0,
        "y": 2,
        "kind": "straight",
        "rotation": 1
      },
      {
        "x": 1,
        "y": 2,
        "kind": "straight",
        "rotation": 1
      },
      {
        "x": 2,
        "y": 2,
        "kind": "straight",
        "rotation": 1
      },
      {
        "x": 3,
        "y": 2,
        "kind": "amplifier",
        "rotation": 0
      },
      {
        "x": 4,
        "y": 2,
        "kind": "tee",
        "rotation": 0
      },
      {
        "x": 5,
        "y": 2,
        "kind": "blocked"
      },
      {
        "x": 0,
        "y": 3,
        "kind": "blocked"
      },
      {
        "x": 1,
        "y": 3,
        "kind": "corner",
        "rotation": 0
      },
      {
        "x": 2,
        "y": 3,
        "kind": "tee",
        "rotation": 0
      },
      {
        "x": 3,
        "y": 3,
        "kind": "straight",
        "rotation": 1
      },
      {
        "x": 4,
        "y": 3,
        "kind": "corner",
        "rotation": 0
      },
      {
        "x": 5,
        "y": 3,
        "kind": "straight",
        "rotation": 1
      }
    ],
    "variants": [
      {
        "id": "museum_tool_route_01",
        "solutionMoveCount": 5,
        "rotationOverrides": [
          {
            "x": 0,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 1,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 1,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 3,
            "rotation": 3
          }
        ]
      },
      {
        "id": "museum_tool_route_02",
        "solutionMoveCount": 4,
        "rotationOverrides": [
          {
            "x": 0,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 1,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 3,
            "rotation": 3
          }
        ]
      },
      {
        "id": "museum_tool_route_03",
        "solutionMoveCount": 6,
        "rotationOverrides": [
          {
            "x": 0,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 1,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 2,
            "rotation": 2
          },
          {
            "x": 4,
            "y": 1,
            "rotation": 0
          }
        ]
      },
      {
        "id": "museum_tool_route_04",
        "solutionMoveCount": 5,
        "rotationOverrides": [
          {
            "x": 1,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 3,
            "rotation": 2
          }
        ]
      },
      {
        "id": "museum_tool_route_05",
        "solutionMoveCount": 4,
        "rotationOverrides": [
          {
            "x": 0,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 1,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 5,
            "y": 1,
            "rotation": 0
          },
          {
            "x": 5,
            "y": 3,
            "rotation": 0
          }
        ]
      },
      {
        "id": "museum_tool_route_06",
        "solutionMoveCount": 6,
        "rotationOverrides": [
          {
            "x": 0,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 1,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 2,
            "rotation": 2
          },
          {
            "x": 4,
            "y": 1,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 3,
            "rotation": 3
          }
        ]
      },
      {
        "id": "museum_tool_route_07",
        "solutionMoveCount": 5,
        "rotationOverrides": [
          {
            "x": 2,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 1,
            "rotation": 3
          },
          {
            "x": 5,
            "y": 3,
            "rotation": 0
          }
        ]
      },
      {
        "id": "museum_tool_route_08",
        "solutionMoveCount": 4,
        "rotationOverrides": [
          {
            "x": 4,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 1,
            "rotation": 0
          },
          {
            "x": 5,
            "y": 1,
            "rotation": 0
          },
          {
            "x": 5,
            "y": 3,
            "rotation": 0
          }
        ]
      },
      {
        "id": "museum_tool_route_09",
        "solutionMoveCount": 6,
        "rotationOverrides": [
          {
            "x": 0,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 1,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 3,
            "rotation": 3
          }
        ]
      },
      {
        "id": "museum_tool_route_10",
        "solutionMoveCount": 5,
        "rotationOverrides": [
          {
            "x": 0,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 2,
            "y": 2,
            "rotation": 0
          },
          {
            "x": 4,
            "y": 2,
            "rotation": 3
          },
          {
            "x": 4,
            "y": 1,
            "rotation": 0
          },
          {
            "x": 5,
            "y": 3,
            "rotation": 0
          }
        ]
      }
    ],
    "success": {
      "actions": [
        {
          "type": "open_door",
          "doorId": "level_03_voice_door"
        },
        {
          "type": "focus_reveal",
          "reveal": {
            "kind": "door",
            "doorId": "level_03_voice_door"
          }
        }
      ],
      "dialogueTrigger": "level_03_tool_chip_taken",
      "rewardPulse": {
        "label": "工具校准完成",
        "detail": "声纹展厅门已授权",
        "rarity": "epic"
      },
      "rewardPulseDuration": 1.45,
      "audio": {
        "key": "system_exit_open",
        "intensity": 0.78
      }
    },
    "perfectBonus": {
      "pickupType": "repairKit",
      "rewardPulse": {
        "label": "完美校准",
        "detail": "额外治疗包弹出",
        "rarity": "epic"
      },
      "rewardPulseDuration": 1.5
    }
  }
] as const satisfies readonly LevelPuzzleDefinition[];
