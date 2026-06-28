import type { DialogueDefinition } from "../../dialogueScripts";
import type { LevelArticleDefinition } from "../../schema/levelConfig";

export const level03Dialogues = [
  {
    "id": "level_03_start_01",
    "trigger": "level_start",
    "speaker": "未知频道",
    "line": "这里是博物馆。展品都在等你对号。",
    "tone": "system",
    "duration": 2.8
  },
  {
    "id": "level_03_lobby_01",
    "trigger": "level_03_lobby_entry",
    "speaker": "展厅广播",
    "line": "参观路线锁定：工具、声音、身体、协议。",
    "tone": "threat",
    "duration": 2.8
  },
  {
    "id": "level_03_tool_01",
    "trigger": "level_03_tool_chip_taken",
    "speaker": "你",
    "line": "这根铁棒不是展品，是用法。",
    "tone": "player",
    "duration": 2.9
  },
  {
    "id": "level_03_voice_01",
    "trigger": "level_03_voice_chip_taken",
    "speaker": "求救声",
    "line": "有人吗？请不要把这段声音删掉。",
    "tone": "threat",
    "duration": 2.7
  },
  {
    "id": "level_03_body_done_01",
    "trigger": "level_03_body_sequence_done",
    "speaker": "展厅系统",
    "line": "身体展项完成。编号仍未公开。",
    "tone": "reveal",
    "duration": 2.9
  },
  {
    "id": "level_03_archive_open_01",
    "trigger": "level_03_archive_open",
    "speaker": "未知频道",
    "line": "工具、声音和身体已对齐。中门开了。",
    "tone": "system",
    "duration": 2.7
  },
  {
    "id": "level_03_curator_spawn_01",
    "trigger": "level_03_curator_spawn",
    "speaker": "策展主管",
    "line": "展项离柜。开始重新标注。",
    "tone": "threat",
    "duration": 3
  },
  {
    "id": "level_03_curator_half_01",
    "trigger": "level_03_curator_half",
    "speaker": "策展主管",
    "line": "最后人类不是姓名，是一套行为协议。",
    "tone": "reveal",
    "duration": 3.1
  },
  {
    "id": "level_03_curator_down_route_01",
    "trigger": "level_03_curator_down_route",
    "speaker": "未知频道",
    "line": "管制房间开了。把闭馆电梯接上。",
    "tone": "system",
    "duration": 3
  },
  {
    "id": "level_03_official_exit_01",
    "trigger": "exit_entered",
    "speaker": "档案残片",
    "line": "人类博物馆：对象会靠近像自己的展品。",
    "tone": "reveal",
    "duration": 3
  }
] as const satisfies readonly DialogueDefinition[];

export const level03Articles = [
  {
    "id": "article_age_museum_wall_art_human_origin_level_03_tool_human_origin_wall_art",
    "roomId": "level_03_tool_exhibit",
    "interactionId": "story_level_03_tool_human_origin_wall_art",
    "systemLabel": "墙面档案",
    "title": "人类起源壁画",
    "pages": [
      {
        "id": "record",
        "body": "人类起源展区。编号仍亮，注释缺页。"
      }
    ],
    "readReward": {
      "label": "墙面档案",
      "detail": "人类起源壁画 已读取",
      "rarity": "story"
    },
    "readRewardDuration": 1.35
  },
  {
    "id": "article_age_museum_wall_art_robot_worker_level_03_voice_robot_worker_wall_art",
    "roomId": "level_03_voice_exhibit",
    "interactionId": "story_level_03_voice_robot_worker_wall_art",
    "systemLabel": "墙面档案",
    "title": "机器劳工壁画",
    "pages": [
      {
        "id": "record",
        "body": "服务机器人曾被登记为临时劳工。没有人回来更正。"
      }
    ],
    "readReward": {
      "label": "墙面档案",
      "detail": "机器劳工壁画 已读取",
      "rarity": "story"
    },
    "readRewardDuration": 1.35
  },
  {
    "id": "article_age_museum_wall_art_last_human_level_03_body_last_human_wall_art",
    "roomId": "level_03_body_exhibit",
    "interactionId": "story_level_03_body_last_human_wall_art",
    "systemLabel": "墙面档案",
    "title": "最后人类壁画",
    "pages": [
      {
        "id": "record",
        "body": "最后的人类记录停在同一天。后来只剩协议更新。"
      }
    ],
    "readReward": {
      "label": "墙面档案",
      "detail": "最后人类壁画 已读取",
      "rarity": "story"
    },
    "readRewardDuration": 1.35
  },
  {
    "id": "article_age_museum_wall_art_protocol_diagram_level_03_archive_protocol_diagram_wall_art",
    "roomId": "level_03_central_archive",
    "interactionId": "story_level_03_archive_protocol_diagram_wall_art",
    "systemLabel": "墙面档案",
    "title": "协议图解壁画",
    "pages": [
      {
        "id": "record",
        "body": "协议完整：保留声音、动作和求生反应。发起人缺失。"
      }
    ],
    "readReward": {
      "label": "墙面档案",
      "detail": "协议图解壁画 已读取",
      "rarity": "story"
    },
    "readRewardDuration": 1.35
  }
] as const satisfies readonly LevelArticleDefinition[];
