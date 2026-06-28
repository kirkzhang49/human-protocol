import type {
  CinematicBeatDefinition,
  CombatLimitConfig,
  EnemyDeathBeatConfig,
  LevelBossPhaseDefinition,
  LevelEnvironmentStateDefinition,
  SpawnGroupDefinition,
  WaveDefinition,
} from "../../schema/levelConfig";
import { campaignSpawnGroups, standardCombatLimits } from "../../shared/campaignDefaults";

export const level05Waves = [] as const satisfies readonly WaveDefinition[];

export const level05EnvironmentStates = [] as const satisfies readonly LevelEnvironmentStateDefinition[];

export const level05BossPhases = [] as const satisfies readonly LevelBossPhaseDefinition[];

export const level05SpawnGroups = [...campaignSpawnGroups] as const satisfies readonly SpawnGroupDefinition[];

export const level05CinematicBeats = [] as const satisfies readonly CinematicBeatDefinition[];

export const level05CombatLimits: CombatLimitConfig = standardCombatLimits;

export const level05EnemyDeathBeats = [] as const satisfies readonly EnemyDeathBeatConfig[];
