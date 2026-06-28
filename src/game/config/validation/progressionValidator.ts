import { enemyArchetypes } from "../enemyArchetypes";
import { enemyTierIds } from "../enemyTiers";
import type { LevelDefinition, LevelObjectiveDefinition } from "../schema/levelConfig";
import { duplicateIds as duplicates } from "./ids";
import {
  addIssue as add,
  type ConfigValidationIssue,
  validateColorOptional,
  validatePositiveDurationOptional,
} from "./issues";
import { triggerRefExists, validateRuntimeEventAction } from "./runtimeEventValidator";
import { createLevelReferenceSets, type LevelReferenceSets } from "./referenceSets";

export function validateChoices(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const choices = level.choices ?? [];
  if (choices.length === 0) return;

  for (const id of duplicates(choices.map((choice) => choice.id))) {
    add(errors, "choice.duplicate", `choices.${id}`, `Duplicate choice id "${id}".`);
  }

  const refs = createLevelReferenceSets(level);
  choices.forEach((choice, choiceIndex) => {
    if (choice.options.length < 2) {
      add(warnings, "choice.options.low", `choices[${choiceIndex}].options`, `Choice "${choice.id}" should usually have at least two options.`);
    }
    for (const optionId of duplicates(choice.options.map((option) => option.id))) {
      add(errors, "choice.option.duplicate", `choices[${choiceIndex}].options.${optionId}`, `Duplicate option id "${optionId}" in choice "${choice.id}".`);
    }
    choice.options.forEach((option, optionIndex) => {
      option.routeDeltas?.forEach((delta, deltaIndex) => {
        validateRouteDelta(delta.routeId, delta.amount, `choices[${choiceIndex}].options[${optionIndex}].routeDeltas[${deltaIndex}]`, refs, warnings);
      });
      option.actions.forEach((action, actionIndex) => {
        validateRuntimeEventAction(action, `choices[${choiceIndex}].options[${optionIndex}].actions[${actionIndex}]`, refs, errors, warnings);
      });
    });
  });
}

export function validateCampaignRoutes(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const routes = level.campaignRoutes ?? [];
  if (routes.length === 0) return;

  for (const id of duplicates(routes.map((route) => route.id))) {
    add(errors, "route.duplicate", `campaignRoutes.${id}`, `Duplicate campaign route id "${id}".`);
  }
  routes.forEach((route, index) => {
    if (!route.id) {
      add(errors, "route.id.missing", `campaignRoutes[${index}].id`, "Campaign route id is required.");
    }
    if (!route.label) {
      add(warnings, "route.label.missing", `campaignRoutes[${index}].label`, `Campaign route "${route.id}" has no label.`);
    }
    validateColorOptional(route.color, `campaignRoutes[${index}].color`, warnings);
  });
}

export function validateEnvironmentStates(level: LevelDefinition, errors: ConfigValidationIssue[], warnings: ConfigValidationIssue[]) {
  const states = level.environmentStates ?? [];
  if (states.length === 0) return;

  for (const id of duplicates(states.map((state) => state.id))) {
    add(errors, "environment.duplicate", `environmentStates.${id}`, `Duplicate environment state id "${id}".`);
  }

  const { roomIds } = createLevelReferenceSets(level);
  states.forEach((state, index) => {
    if (state.roomId && !roomIds.has(state.roomId)) {
      add(errors, "environment.room.missing", `environmentStates[${index}].roomId`, `Environment state "${state.id}" references missing room "${state.roomId}".`);
    }
    validatePositiveDurationOptional(state.duration, `environmentStates[${index}].duration`, warnings);
    validateColorOptional(state.tintColor, `environmentStates[${index}].tintColor`, warnings);
    validateColorOptional(state.glowColor, `environmentStates[${index}].glowColor`, warnings);
  });
}

function validateRouteDelta(
  routeId: string,
  amount: number,
  path: string,
  refs: LevelReferenceSets,
  warnings: ConfigValidationIssue[],
) {
  if (!refs.campaignRouteIds.has(routeId)) {
    add(warnings, "choice.route.unknown", `${path}.routeId`, `Choice route delta references route "${routeId}" without a campaignRoutes definition.`);
  }
  if (!Number.isFinite(amount) || amount === 0) {
    add(warnings, "choice.route.amount.unusual", `${path}.amount`, "Choice route delta should be a non-zero number.");
  }
}

export function validateBossPhases(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const phases = level.bossPhases ?? [];
  if (phases.length === 0) return;

  for (const id of duplicates(phases.map((phase) => phase.id))) {
    add(errors, "bossPhase.duplicate", `bossPhases.${id}`, `Duplicate boss phase id "${id}".`);
  }

  const refs = createLevelReferenceSets(level);
  phases.forEach((phase, phaseIndex) => {
    if (!Object.prototype.hasOwnProperty.call(enemyArchetypes, phase.actorId)) {
      add(errors, "bossPhase.actor.missing", `bossPhases[${phaseIndex}].actorId`, `Boss phase "${phase.id}" references unknown actor "${phase.actorId}".`);
    }
    if (phase.tier && !(enemyTierIds as readonly string[]).includes(phase.tier)) {
      add(errors, "bossPhase.tier.invalid", `bossPhases[${phaseIndex}].tier`, `Boss phase "${phase.id}" references unsupported tier "${phase.tier}".`);
    }
    if (phase.threshold <= 0 || phase.threshold >= 1) {
      add(warnings, "bossPhase.threshold.unusual", `bossPhases[${phaseIndex}].threshold`, `Boss phase "${phase.id}" threshold should usually be between 0 and 1.`);
    }
    phase.actions.forEach((action, actionIndex) => {
      validateRuntimeEventAction(action, `bossPhases[${phaseIndex}].actions[${actionIndex}]`, refs, errors, warnings);
    });
  });
}

export function validateObjectiveChain(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const chain = level.objectiveChain;
  if (!chain?.length) {
    add(warnings, "objectives.missing", "objectiveChain", "Level has no objectiveChain; HUD will fall back to presentation heuristics.");
    return;
  }

  const refs = createLevelReferenceSets(level);
  const objectiveIds = refs.objectiveIds;
  const duplicateObjectives = duplicates(chain.map((objective) => objective.id));
  for (const id of duplicateObjectives) add(errors, "objective.duplicate", `objectiveChain.${id}`, `Duplicate objective id "${id}".`);

  chain.forEach((objective, index) => {
    if (objective.nextObjectiveId && !objectiveIds.has(objective.nextObjectiveId)) {
      add(errors, "objective.next.missing", `objectiveChain[${index}].nextObjectiveId`, `Objective "${objective.id}" points to missing next objective "${objective.nextObjectiveId}".`);
    }
    if (objective.requiredIds.length === 0 && objective.type !== "custom") {
      add(warnings, "objective.required.empty", `objectiveChain[${index}].requiredIds`, `Objective "${objective.id}" has no required ids.`);
    }
    validateObjectiveTrigger(objective, "startsWhen", objective.startsWhen, index, refs, errors);
    validateObjectiveTrigger(objective, "completesWhen", objective.completesWhen, index, refs, errors);
    validateObjectiveGuidance(objective, index, refs, errors);
  });
}

function validateObjectiveGuidance(
  objective: LevelObjectiveDefinition,
  index: number,
  refs: LevelReferenceSets,
  errors: ConfigValidationIssue[],
) {
  const guidance = objective.guidance;
  if (!guidance) return;

  if (guidance.targetType === "exit") return;
  if (!guidance.targetId) {
    add(errors, "objective.guidance.target.missing", `objectiveChain[${index}].guidance.targetId`, `Objective "${objective.id}" guidance needs targetId for ${guidance.targetType}.`);
    return;
  }

  const targetExists =
    guidance.targetType === "room" ? refs.roomIds.has(guidance.targetId) :
    guidance.targetType === "door" ? refs.doorIds.has(guidance.targetId) :
    guidance.targetType === "key_item" ? refs.keyItemIds.has(guidance.targetId) :
    guidance.targetType === "interaction" ? refs.interactionIds.has(guidance.targetId) :
    guidance.targetType === "puzzle" ? refs.puzzleIds.has(guidance.targetId) :
    guidance.targetType === "wave" ? refs.waveIds.has(guidance.targetId) :
    false;

  if (!targetExists) {
    add(errors, "objective.guidance.target.invalid", `objectiveChain[${index}].guidance.targetId`, `Objective "${objective.id}" guidance target "${guidance.targetId}" does not exist.`);
  }
}

function validateObjectiveTrigger(
  objective: LevelObjectiveDefinition,
  field: "startsWhen" | "completesWhen",
  trigger: LevelObjectiveDefinition["startsWhen"],
  index: number,
  refs: LevelReferenceSets,
  errors: ConfigValidationIssue[],
) {
  if (!triggerRefExists(trigger, refs)) {
    add(errors, "objective.trigger.ref.missing", `objectiveChain[${index}].${field}.id`, `Objective "${objective.id}" ${field} references missing ${trigger.type} id "${trigger.id}".`);
  }
}
