import { level01MaintenanceBay } from "./levels/level01-maintenance-bay";
import type { DialogueDefinition } from "./dialogueScripts";
import type { LevelDefinition, SpawnGroupId as LevelSpawnGroupId, WaveDefinition } from "./schema/levelConfig";

export type {
  CinematicBeatDefinition,
  EnemySpawnDefinition,
  LevelDefinition,
  LevelExitDefinition,
  SpawnGroupId,
  WaveDefinition,
  WaveReinforcementDefinition,
  WaveReward,
} from "./schema/levelConfig";

export { level01MaintenanceBay };

export const levelManifest = [level01MaintenanceBay] as const;

export const level01WavesById: ReadonlyMap<string, WaveDefinition> = new Map(
  level01MaintenanceBay.waves.map((wave) => [wave.id, wave] as const),
);

export const level01DialoguesByTrigger: ReadonlyMap<string, readonly DialogueDefinition[]> =
  createDialogueTriggerMap(level01MaintenanceBay.dialogues);

export function createDialogueTriggerMap(dialogues: readonly DialogueDefinition[]) {
  const byTrigger = new Map<string, DialogueDefinition[]>();
  for (const line of dialogues) {
    const bucket = byTrigger.get(line.trigger);
    if (bucket) {
      bucket.push(line);
    } else {
      byTrigger.set(line.trigger, [line]);
    }
  }
  return byTrigger;
}

export function waveById(level: LevelDefinition, waveId: string) {
  return level.waves.find((wave) => wave.id === waveId) ?? null;
}

export function wavePresentationById(level: LevelDefinition, waveId: string) {
  return level.presentation.waves.find((wave) => wave.id === waveId) ?? null;
}

export function spawnGroupById(level: LevelDefinition, groupId: LevelSpawnGroupId) {
  return level.spawnGroups.find((group) => group.id === groupId) ?? null;
}
