import { upgradeById } from "../upgradePool";
import type { LevelDefinition, LevelEventTriggerDefinition, LevelRuntimeEventAction } from "../schema/levelConfig";
import { duplicateIds as duplicates } from "./ids";
import { addIssue as add, type ConfigValidationIssue, validatePositiveDurationOptional } from "./issues";
import { createLevelReferenceSets, type LevelReferenceSets } from "./referenceSets";

export function validateRuntimeEvents(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const events = level.events ?? [];
  if (events.length === 0) return;

  for (const id of duplicates(events.map((event) => event.id))) {
    add(errors, "event.duplicate", `events.${id}`, `Duplicate runtime event id "${id}".`);
  }

  const refs = createLevelReferenceSets(level);

  events.forEach((event, index) => {
    if (!triggerRefExists(event.trigger, refs)) {
      add(errors, "event.trigger.ref.missing", `events[${index}].trigger.id`, `Runtime event "${event.id}" trigger references missing ${event.trigger.type} id "${event.trigger.id}".`);
    }
    if (event.actions.length === 0) {
      add(warnings, "event.actions.empty", `events[${index}].actions`, `Runtime event "${event.id}" has no actions.`);
    }
    event.actions.forEach((action, actionIndex) => {
      validateRuntimeEventAction(action, `events[${index}].actions[${actionIndex}]`, refs, errors, warnings);
    });
  });
}

export function validateRuntimeEventAction(
  action: LevelRuntimeEventAction,
  path: string,
  refs: LevelReferenceSets,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  if (action.type === "add_memory" && action.amount <= 0) {
    add(warnings, "event.memory.nonpositive", `${path}.amount`, "Memory event reward should be positive.");
  }
  if (action.type === "open_upgrade") {
    for (const upgradeId of action.choices ?? []) {
      if (!upgradeById.has(upgradeId)) {
        add(errors, "event.upgrade.missing", `${path}.choices`, `Runtime event references missing upgrade "${upgradeId}".`);
      }
    }
  }
  if (action.type === "open_choice" && !refs.choiceIds.has(action.choiceId)) {
    add(errors, "event.choice.missing", `${path}.choiceId`, `Runtime event opens missing choice "${action.choiceId}".`);
  }
  if (
    (action.type === "set_environment_state" || action.type === "clear_environment_state") &&
    !refs.environmentStateIds.has(action.stateId)
  ) {
    add(errors, "event.environment.missing", `${path}.stateId`, `Runtime event references missing environment state "${action.stateId}".`);
  }
  if (action.type === "set_big_screen_state") {
    if (!refs.bigScreenIds.has(action.screenId)) {
      add(errors, "event.bigScreen.missing", `${path}.screenId`, `Runtime event references missing big screen "${action.screenId}".`);
    }
    if (!refs.bigScreenStateIds.has(`${action.screenId}:${action.stateId}`)) {
      add(errors, "event.bigScreen.state.missing", `${path}.stateId`, `Runtime event references missing big screen state "${action.screenId}:${action.stateId}".`);
    }
  }
  if (action.type === "set_environment_state") {
    validatePositiveDurationOptional(action.duration, `${path}.duration`, warnings);
  }
  if (action.type === "adjust_campaign_route") {
    if (!refs.campaignRouteIds.has(action.routeId)) {
      add(warnings, "event.route.unknown", `${path}.routeId`, `Runtime event adjusts route "${action.routeId}" without a campaignRoutes definition.`);
    }
    if (!Number.isFinite(action.amount) || action.amount === 0) {
      add(warnings, "event.route.amount.unusual", `${path}.amount`, "Campaign route adjustment should be a non-zero number.");
    }
  }
  if (action.type === "start_wave" && !refs.waveIds.has(action.waveId)) {
    add(errors, "event.wave.missing", `${path}.waveId`, `Runtime event starts missing wave "${action.waveId}".`);
  }
  if (
    (action.type === "unlock_door" || action.type === "open_door" || action.type === "close_door" || action.type === "lock_door") &&
    !refs.doorIds.has(action.doorId)
  ) {
    add(errors, "event.door.missing", `${path}.doorId`, `Runtime event references missing door "${action.doorId}".`);
  }
  if (action.type === "complete_objective" && !refs.objectiveIds.has(action.objectiveId)) {
    add(errors, "event.objective.missing", `${path}.objectiveId`, `Runtime event completes missing objective "${action.objectiveId}".`);
  }
  if (action.type === "grant_key_item" && !refs.keyItemIds.has(action.keyItemId)) {
    add(errors, "event.key.missing", `${path}.keyItemId`, `Runtime event grants missing key item "${action.keyItemId}".`);
  }
  if (action.type === "focus_reveal") {
    const reveal = action.reveal;
    if (reveal.doorId && !refs.doorIds.has(reveal.doorId)) {
      add(errors, "event.focus.door.missing", `${path}.reveal.doorId`, `Focus reveal references missing door "${reveal.doorId}".`);
    }
    if (reveal.roomId && !refs.roomIds.has(reveal.roomId)) {
      add(errors, "event.focus.room.missing", `${path}.reveal.roomId`, `Focus reveal references missing room "${reveal.roomId}".`);
    }
    if (reveal.interactionId && !refs.interactionIds.has(reveal.interactionId)) {
      add(errors, "event.focus.interaction.missing", `${path}.reveal.interactionId`, `Focus reveal references missing interaction "${reveal.interactionId}".`);
    }
    validatePositiveDurationOptional(reveal.durationSec, `${path}.reveal.durationSec`, warnings);
  }
}

export function triggerRefExists(
  trigger: LevelEventTriggerDefinition,
  refs: LevelReferenceSets,
) {
  if (!trigger.id) return true;
  if (trigger.type === "room_entered") return refs.roomIds.has(trigger.id);
  if (trigger.type === "interaction_completed") return refs.interactionIds.has(trigger.id);
  if (trigger.type === "key_collected") return refs.keyItemIds.has(trigger.id);
  if (trigger.type === "door_opened") return refs.doorIds.has(trigger.id);
  if (trigger.type === "wave_completed") return refs.waveIds.has(trigger.id);
  if (trigger.type === "objective_completed") return refs.objectiveIds.has(trigger.id);
  if (trigger.type === "enemy_dead" || trigger.type === "boss_dead") {
    return refs.actorIds.has(trigger.id);
  }
  if (trigger.type === "boss_phase") return refs.bossPhaseIds.has(trigger.id);
  if (trigger.type === "choice_selected") {
    if (!refs.choiceIds.has(trigger.id)) return false;
    if (trigger.optionId && !refs.choiceOptionIds.has(`${trigger.id}:${trigger.optionId}`)) return false;
    return true;
  }
  if (trigger.type === "environment_state_set") return refs.environmentStateIds.has(trigger.id);
  if (trigger.type === "campaign_route_changed") return refs.campaignRouteIds.has(trigger.id);
  if (trigger.type === "puzzle_completed" || trigger.type === "puzzle_failed") return refs.puzzleIds.has(trigger.id);
  if (trigger.type === "article_read") return refs.articleIds.has(trigger.id);
  if (trigger.type === "quiz_completed" || trigger.type === "quiz_failed") return refs.quizIds.has(trigger.id);
  if (trigger.type === "switch_activated") {
    if (!refs.switchIds.has(trigger.id)) return false;
    if (trigger.optionId && !refs.switchStateIds.has(`${trigger.id}:${trigger.optionId}`)) return false;
    return true;
  }
  if (trigger.type === "big_screen_state") {
    if (!refs.bigScreenIds.has(trigger.id)) return false;
    if (trigger.optionId && !refs.bigScreenStateIds.has(`${trigger.id}:${trigger.optionId}`)) return false;
    return true;
  }
  return true;
}
