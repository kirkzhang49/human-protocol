import { enemyArchetypes } from "../enemyArchetypes";
import type { LevelDefinition } from "../schema/levelConfig";
import { bigScreenStateKey, switchStateKey } from "./ids";

export interface LevelReferenceSets {
  objectiveIds: Set<string>;
  roomIds: Set<string>;
  interactionIds: Set<string>;
  propIds: Set<string>;
  keyItemIds: Set<string>;
  doorIds: Set<string>;
  waveIds: Set<string>;
  actorIds: Set<string>;
  puzzleIds: Set<string>;
  articleIds: Set<string>;
  quizIds: Set<string>;
  switchIds: Set<string>;
  switchStateIds: Set<string>;
  bigScreenIds: Set<string>;
  bigScreenStateIds: Set<string>;
  choiceIds: Set<string>;
  choiceOptionIds: Set<string>;
  campaignRouteIds: Set<string>;
  environmentStateIds: Set<string>;
  bossPhaseIds: Set<string>;
}

export function createLevelReferenceSets(level: LevelDefinition): LevelReferenceSets {
  const map = level.map;
  return {
    objectiveIds: new Set(level.objectiveChain?.map((objective) => objective.id) ?? []),
    roomIds: new Set(map?.rooms?.map((room) => room.id) ?? []),
    interactionIds: new Set(map?.interactions?.map((interaction) => interaction.id) ?? []),
    propIds: new Set(map?.props?.map((prop) => prop.id) ?? []),
    keyItemIds: new Set(map?.keyItems?.map((item) => item.id) ?? []),
    doorIds: new Set(map?.doors?.map((door) => door.id) ?? []),
    waveIds: new Set(level.waves.map((wave) => wave.id)),
    actorIds: new Set(Object.keys(enemyArchetypes)),
    puzzleIds: new Set(level.puzzles?.map((puzzle) => puzzle.id) ?? []),
    articleIds: new Set(level.articles?.map((article) => article.id) ?? []),
    quizIds: new Set(level.quizzes?.map((quiz) => quiz.id) ?? []),
    switchIds: new Set(level.switches?.map((definition) => definition.id) ?? []),
    switchStateIds: createSwitchStateIdSet(level),
    bigScreenIds: new Set(level.bigScreens?.map((definition) => definition.id) ?? []),
    bigScreenStateIds: createBigScreenStateIdSet(level),
    choiceIds: new Set(level.choices?.map((choice) => choice.id) ?? []),
    choiceOptionIds: createChoiceOptionIdSet(level),
    campaignRouteIds: new Set(level.campaignRoutes?.map((route) => route.id) ?? []),
    environmentStateIds: new Set(level.environmentStates?.map((state) => state.id) ?? []),
    bossPhaseIds: new Set(level.bossPhases?.map((phase) => phase.id) ?? []),
  };
}

function createSwitchStateIdSet(level: LevelDefinition) {
  const ids = new Set<string>();
  for (const definition of level.switches ?? []) {
    for (const state of definition.states) {
      ids.add(switchStateKey(definition.id, state.id));
    }
  }
  return ids;
}

function createBigScreenStateIdSet(level: LevelDefinition) {
  const ids = new Set<string>();
  for (const definition of level.bigScreens ?? []) {
    for (const state of definition.states) {
      ids.add(bigScreenStateKey(definition.id, state.id));
    }
  }
  return ids;
}

function createChoiceOptionIdSet(level: LevelDefinition) {
  const ids = new Set<string>();
  for (const choice of level.choices ?? []) {
    for (const option of choice.options) {
      ids.add(`${choice.id}:${option.id}`);
    }
  }
  return ids;
}
