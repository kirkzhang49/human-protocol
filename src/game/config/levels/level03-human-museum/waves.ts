import type {
  CinematicBeatDefinition,
  CombatLimitConfig,
  EnemyDeathBeatConfig,
  LevelBossPhaseDefinition,
  LevelEnvironmentStateDefinition,
  SpawnGroupDefinition,
  WaveDefinition,
} from "../../schema/levelConfig";

export const level03Waves = [
  {
    "id": "level_03_lobby_patrol",
    "startDelay": 0.45,
    "trigger": {
      "type": "room_entered",
      "id": "level_03_gallery_lobby",
      "delay": 0.45
    },
    "enemies": [
      {
        "archetype": "repair_drone",
        "count": 3,
        "from": "level03_lobby_ring",
        "healthMultiplier": 1.3
      },
      {
        "archetype": "shield_tech",
        "count": 1,
        "from": "level03_lobby_ring",
        "healthMultiplier": 1.3
      }
    ],
    "reinforcements": [
      {
        "archetype": "repair_drone",
        "count": 1,
        "from": "level03_lobby_ring",
        "healthMultiplier": 1.3,
        "startsAfter": 6,
        "every": 6,
        "maxGroups": 5,
        "maxAlive": 3
      }
    ],
    "reward": "none"
  },
  {
    "id": "wave_level_03_body_exhibit",
    "startDelay": 0.35,
    "trigger": {
      "type": "room_entered",
      "id": "level_03_body_exhibit",
      "delay": 0.35
    },
    "enemies": [
      {
        "archetype": "repair_drone",
        "count": 2,
        "from": "sg_level_03_body_exhibit",
        "healthMultiplier": 1.3
      },
      {
        "archetype": "clamp_bot",
        "count": 1,
        "from": "sg_level_03_body_exhibit",
        "healthMultiplier": 1.3
      }
    ],
    "reinforcements": [
      {
        "archetype": "repair_drone",
        "count": 1,
        "from": "sg_level_03_body_exhibit",
        "healthMultiplier": 1.3,
        "startsAfter": 5,
        "every": 5.8,
        "maxGroups": 4,
        "maxAlive": 3
      }
    ],
    "reward": "none"
  },
  {
    "id": "wave_level_03_central_archive",
    "startDelay": 0.55,
    "interruptsActiveWave": true,
    "trigger": {
      "type": "room_entered",
      "id": "level_03_central_archive",
      "delay": 0.55
    },
    "enemies": [
      {
        "archetype": "custodian_elite",
        "count": 1,
        "from": "sg_level_03_central_archive",
        "tier": "boss",
        "tierLabel": "策展主管",
        "healthMultiplier": 0.44,
        "damageMultiplier": 0.31,
        "moveSpeedMultiplier": 1.05,
        "attackCooldownMultiplier": 1.08,
        "attackRangeMultiplier": 1.08,
        "radiusMultiplier": 0.92,
        "visual": {
          "modelKey": "hp_enemy_shield_technician_horror",
          "coreColor": "#ff6a52",
          "warningColor": "#ffd36d",
          "textureAtlasKey": "custodian_boss",
          "scaleMultiplier": 0.94,
          "lightIntensityMultiplier": 1.35
        }
      },
      {
        "archetype": "clamp_bot",
        "count": 1,
        "from": "sg_level_03_central_archive",
        "healthMultiplier": 1.3
      }
    ],
    "reinforcements": [
      {
        "archetype": "repair_drone",
        "count": 1,
        "from": "sg_level_03_central_archive",
        "healthMultiplier": 1.3,
        "startsAfter": 8,
        "every": 8.5,
        "maxGroups": 999,
        "maxAlive": 2,
        "requiresEliteAlive": true,
        "endless": true
      }
    ],
    "reward": "none",
    "completionDialogueTrigger": "level_03_curator_down_route"
  }
] as const satisfies readonly WaveDefinition[];

export const level03EnvironmentStates = [
  {
    "id": "level_03_archive_exposed",
    "label": "档案室暴露",
    "roomId": "level_03_central_archive",
    "tintColor": "#ff6a52",
    "glowColor": "#ffd36d",
    "intensity": 0.95,
    "opacity": 0.13
  }
] as const satisfies readonly LevelEnvironmentStateDefinition[];

export const level03BossPhases = [
  {
    "id": "level_03_curator_half",
    "actorId": "custodian_elite",
    "tier": "boss",
    "threshold": 0.5,
    "actions": [
      {
        "type": "queue_dialogue",
        "trigger": "level_03_curator_half"
      },
      {
        "type": "set_environment_state",
        "stateId": "level_03_archive_exposed"
      },
      {
        "type": "camera_impact",
        "cameraImpact": {
          "shake": 0.42,
          "fovKick": 2.1,
          "rumble": 0.16,
          "rumbleDuration": 0.2
        }
      }
    ]
  }
] as const satisfies readonly LevelBossPhaseDefinition[];

export const level03SpawnGroups = [
  {
    "id": "front",
    "label": "前方舱门",
    "layout": "front"
  },
  {
    "id": "front_arc",
    "label": "前方舱门",
    "layout": "front_arc"
  },
  {
    "id": "side_rear",
    "label": "侧后方夹击",
    "layout": "side_rear"
  },
  {
    "id": "front_gate",
    "label": "正门重型单位",
    "layout": "front_gate"
  },
  {
    "id": "turret_rail",
    "label": "左右轨道炮台",
    "layout": "turret_rail"
  },
  {
    "id": "around_ring",
    "label": "四周通道",
    "layout": "around_ring"
  },
  {
    "id": "rear_ring",
    "label": "后方追击队",
    "layout": "rear_ring"
  },
  {
    "id": "level03_lobby_ring",
    "label": "主展厅",
    "layout": "around_ring",
    "center": [
      0,
      0,
      3.5
    ],
    "radius": 6.2
  },
  {
    "id": "sg_level_03_body_exhibit",
    "label": "身体展厅",
    "layout": "around_ring",
    "center": [
      0,
      0,
      -5.6
    ],
    "radius": 3.4
  },
  {
    "id": "sg_level_03_central_archive",
    "label": "中央档案室门口",
    "layout": "around_ring",
    "center": [
      0,
      0,
      -9.85
    ],
    "radius": 1.05
  }
] as const satisfies readonly SpawnGroupDefinition[];

export const level03CinematicBeats = [
  {
    "id": "level_03_lobby_warning",
    "waveId": "level_03_lobby_patrol",
    "triggerAt": 1.2,
    "spawnWarning": {
      "label": "博物馆安保",
      "detail": "拿档案，不要久站"
    },
    "spawnWarningDuration": 2.1,
    "audio": {
      "key": "assist_reorient",
      "intensity": 0.7
    }
  },
  {
    "id": "level_03_curator_title",
    "waveId": "wave_level_03_central_archive",
    "triggerAt": 1,
    "dialogueTrigger": "level_03_curator_spawn",
    "spawnWarning": {
      "label": "策展主管",
      "detail": "击倒后去右侧管制房间"
    },
    "spawnWarningDuration": 2.4,
    "cameraImpact": {
      "shake": 0.62,
      "fovKick": 3.2,
      "rumble": 0.32,
      "rumbleDuration": 0.24
    },
    "audio": {
      "key": "elite_warning",
      "intensity": 1
    }
  }
] as const satisfies readonly CinematicBeatDefinition[];

export const level03CombatLimits = {
  "smallEnemyArchetypes": [
    "repair_drone",
    "clamp_bot"
  ],
  "eliteArchetypeId": "custodian_elite",
  "smallEnemyDamageMultiplier": 1.3
} as const satisfies CombatLimitConfig;

export const level03EnemyDeathBeats = [
  {
    "archetypeId": "custodian_elite",
    "spawnWarning": {
      "label": "策展主管倒下",
      "detail": "右侧管制房间已解锁"
    },
    "spawnWarningDuration": 2.2,
    "cameraImpact": {
      "shake": 0.72,
      "fovKick": 4.2,
      "rumble": 0.45,
      "rumbleDuration": 0.42
    },
    "dashBurst": {
      "lifetime": 0.48,
      "intensity": 2
    }
  }
] as const satisfies readonly EnemyDeathBeatConfig[];
