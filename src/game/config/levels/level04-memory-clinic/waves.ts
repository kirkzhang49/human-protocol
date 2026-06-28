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

export const level04Waves = [] as const satisfies readonly WaveDefinition[];

export const level04EnvironmentStates = [] as const satisfies readonly LevelEnvironmentStateDefinition[];

export const level04BossPhases = [] as const satisfies readonly LevelBossPhaseDefinition[];

export const level04SpawnGroups = [...campaignSpawnGroups] as const satisfies readonly SpawnGroupDefinition[];

export const level04CinematicBeats = [] as const satisfies readonly CinematicBeatDefinition[];

export const level04CombatLimits: CombatLimitConfig = standardCombatLimits;

export const level04EnemyDeathBeats = [] as const satisfies readonly EnemyDeathBeatConfig[];
