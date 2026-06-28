import type { LevelSwitchDefinition } from "../../schema/levelConfig";

export const level03Switches = [
  {
    "id": "route_route_z43akm",
    "roomId": "room_kqrkp0",
    "interactionId": "route_route_z43akm_panel",
    "label": "管制路由台",
    "initialStateId": "idle",
    "oneShot": false,
    "states": [
      {
        "id": "idle",
        "label": "待机",
        "message": "管制路由台回到待机。",
        "actions": [
          {
            "type": "set_message",
            "message": "管制路由台回到待机。"
          }
        ],
        "rewardPulse": {
          "label": "管制路由台",
          "detail": "输出待机",
          "rarity": "story"
        },
        "rewardPulseDuration": 0.9,
        "cameraImpact": {
          "shake": 0.08,
          "fovKick": 0.35
        }
      },
      {
        "id": "out_1_route_out_yf",
        "label": "开启中央档案室—闭馆电梯",
        "message": "开启中央档案室—闭馆电梯：门禁已放行。",
        "rewardPulse": {
          "label": "开启中央档案室—闭馆电梯",
          "detail": "路由已改接",
          "rarity": "rare"
        },
        "rewardPulseDuration": 1.15,
        "cameraImpact": {
          "shake": 0.16,
          "fovKick": 0.75
        },
        "actions": [
          {
            "type": "complete_objective",
            "objectiveId": "obj_route_level_03_official_exit_door"
          },
          {
            "type": "unlock_door",
            "doorId": "level_03_official_exit_door"
          },
          {
            "type": "open_door",
            "doorId": "level_03_official_exit_door"
          },
          {
            "type": "focus_reveal",
            "reveal": {
              "kind": "door",
              "doorId": "level_03_official_exit_door"
            }
          }
        ]
      }
    ]
  }
] as const satisfies readonly LevelSwitchDefinition[];
