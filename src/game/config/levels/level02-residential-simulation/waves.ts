import type { CinematicBeatDefinition, CombatLimitConfig, EnemyDeathBeatConfig, LevelBossPhaseDefinition, LevelEnvironmentStateDefinition, SpawnGroupDefinition, WaveDefinition } from "../../schema/levelConfig";
import { campaignSpawnGroups } from "../../shared/campaignDefaults";

export const level02Waves: readonly WaveDefinition[] = [
    {
      id: "level_02_living_swarm",
      startDelay: 0.35,
      trigger: { type: "room_entered", id: "level_02_living_room", delay: 0.35 },
      enemies: [
        { archetype: "repair_drone", count: 3, from: "level02_living_ring" },
        { archetype: "clamp_bot", count: 1, from: "level02_living_ring" },
      ],
      reward: "none",
      completionDialogueTrigger: "level_02_living_clear",
    },
    {
      id: "level_02_carekeeper_host",
      startDelay: 0.22,
      trigger: { type: "room_entered", id: "level_02_care_room", delay: 0.22 },
      interruptsActiveWave: true,
      enemies: [
        {
          archetype: "custodian_elite",
          count: 1,
          from: "level02_boss_room",
          tier: "leader",
          tierLabel: "维修头领",
          healthMultiplier: 0.85,
          damageMultiplier: 1.02,
          attackCooldownMultiplier: 1,
          radiusMultiplier: 1,
          visual: {
            modelKey: "hp_enemy_custodian_foreman_horror",
            coreColor: "#ff6a52",
            warningColor: "#ffd36d",
            textureAtlasKey: "custodian_boss",
            scaleMultiplier: 1.06,
            lightIntensityMultiplier: 1.22,
          },
        },
        { archetype: "repair_drone", count: 1, from: "level02_boss_room" },
      ],
      reward: "none",
      completionDialogueTrigger: "level_02_host_down",
    },
  ];

export const level02EnvironmentStates: readonly LevelEnvironmentStateDefinition[] = [
    {
      id: "level_02_family_mask_off",
      label: "家庭伪装剥落",
      roomId: "level_02_living_room",
      tintColor: "#7ff2ff",
      glowColor: "#ff6d4e",
      intensity: 0.92,
      opacity: 0.14,
    },
  ];

export const level02BossPhases: readonly LevelBossPhaseDefinition[] = [
    {
      id: "level_02_host_half_pressure",
      actorId: "custodian_elite",
      tier: "leader",
      threshold: 0.5,
      actions: [
        { type: "queue_dialogue", trigger: "elite_hp_50" },
        { type: "spawn_warning", warning: { label: "主管外壳破裂", detail: "压住它，维修台快能用了" }, duration: 2.1 },
        { type: "camera_impact", cameraImpact: { shake: 0.46, fovKick: 2.1, rumble: 0.18, rumbleDuration: 0.18 } },
        { type: "audio", audio: { key: "elite_warning", intensity: 0.8 } },
      ],
    },
  ];

export const level02SpawnGroups: readonly SpawnGroupDefinition[] = [
    ...campaignSpawnGroups,
    { id: "level02_living_ring", label: "生活区四周", layout: "around_ring", center: [0, 0, 0.4], radius: 7.3 },
    { id: "level02_boss_room", label: "家政维修间", layout: "around_ring", center: [13, 0, 0.4], radius: 2.15 },
    { id: "level02_exit_door", label: "家庭门禁后方", layout: "front", center: [0, 0, 2.4], spread: 7.2 },
  ];

export const level02CinematicBeats: readonly CinematicBeatDefinition[] = [
    {
      id: "level_02_living_pressure",
      waveId: "level_02_living_swarm",
      triggerAt: 1.4,
      spawnWarning: { label: "生活区围捕", detail: "清掉大厅，右门才会开" },
      spawnWarningDuration: 2.1,
      tempoSurgeSec: 2.4,
      cameraImpact: { shake: 0.3, fovKick: 1.5 },
      audio: { key: "assist_reorient", intensity: 0.78 },
    },
    {
      id: "level_02_host_title",
      waveId: "level_02_carekeeper_host",
      triggerAt: 1.2,
      dialogueTrigger: "level_02_host_spawn",
      spawnWarning: { label: "家政主管", detail: "击倒后校准维修台" },
      spawnWarningDuration: 2.35,
      cameraImpact: { shake: 0.72, fovKick: 3.8, rumble: 0.36, rumbleDuration: 0.24 },
      audio: { key: "elite_warning", intensity: 1.14 },
    },
  ];

export const level02CombatLimits: CombatLimitConfig = {
    smallEnemyArchetypes: ["repair_drone", "clamp_bot"],
    eliteArchetypeId: "custodian_elite",
    smallEnemyDamageMultiplier: 1.3,
  };

export const level02EnemyDeathBeats: readonly EnemyDeathBeatConfig[] = [
    {
      archetypeId: "custodian_elite",
      spawnWarning: {
        label: "家政主管倒下",
        detail: "维修台可以校准了",
      },
      spawnWarningDuration: 2.4,
      cameraImpact: { shake: 0.98, fovKick: 5.4, rumble: 0.68, rumbleDuration: 0.72 },
      dashBurst: { lifetime: 0.58, intensity: 2.5 },
    },
  ];
