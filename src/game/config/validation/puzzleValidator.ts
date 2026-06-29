import { isEnvironmentModelKey } from "../../../assets/environmentModelAssets";
import type { LevelDefinition, LevelPuzzleDefinition } from "../schema/levelConfig";
import { duplicateIds as duplicates } from "./ids";
import { addIssue as add, type ConfigValidationIssue } from "./issues";
import { validateMaterialKey, validateVisualKey } from "./mapValidator";
import { createLevelReferenceSets, type LevelReferenceSets } from "./referenceSets";
import { validateRuntimeEventAction } from "./runtimeEventValidator";
import {
  MAX_WALL_DOOR_SWITCH_CONTROLLERS_PER_DOOR as MAX_WALL_SWITCH_CONTROLLERS_PER_DOOR,
  MAX_WALL_DOOR_SWITCHES_PER_LEVEL as MAX_WALL_SWITCHES_PER_LEVEL,
} from "../shared/wallDoorSwitchLimits";

export function validatePuzzles(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const puzzles = level.puzzles ?? [];
  if (puzzles.length === 0) return;

  const refs = createLevelReferenceSets(level);
  const duplicatePuzzles = duplicates(puzzles.map((puzzle) => puzzle.id));

  for (const id of duplicatePuzzles) add(errors, "puzzle.duplicate", `puzzles.${id}`, `Duplicate puzzle id "${id}".`);

  puzzles.forEach((puzzle, index) => {
    if (!refs.roomIds.has(puzzle.roomId)) {
      add(errors, "puzzle.room.missing", `puzzles[${index}].roomId`, `Puzzle "${puzzle.id}" references missing room "${puzzle.roomId}".`);
    }
    validateHitSequencePuzzle(puzzle, index, refs, errors, warnings);
    validateCodeLockPuzzle(puzzle, index, refs, errors, warnings);
    validateToolCalibrationPuzzle(puzzle, index, refs, errors);
    validateCircuitGridPuzzle(puzzle, index, refs, errors);
    validateSurveillanceMatchPuzzle(puzzle, index, refs, errors, warnings);
    validateValveMatrixPuzzle(puzzle, index, refs, errors);
    validateArchiveMergePuzzle(puzzle, index, refs, errors);
    validateGalleryReadingPuzzle(puzzle, index, refs, errors, warnings);
    validatePuzzleActors(puzzle, index, refs, errors, warnings);
    validatePuzzleSuccessRefs(puzzle, index, refs, errors);
    validatePuzzleSuccessActions(puzzle, index, refs, errors, warnings);
    validatePuzzleFailActions(puzzle, index, refs, errors, warnings);
  });
}

function validatePuzzleSuccessActions(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: LevelReferenceSets,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  puzzle.success.actions?.forEach((action, actionIndex) => {
    validateRuntimeEventAction(action, `puzzles[${index}].success.actions[${actionIndex}]`, refs, errors, warnings);
  });
}

function validatePuzzleFailActions(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: LevelReferenceSets,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  puzzle.fail?.actions?.forEach((action, actionIndex) => {
    validateRuntimeEventAction(action, `puzzles[${index}].fail.actions[${actionIndex}]`, refs, errors, warnings);
  });
}

function validatePuzzleActors(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: LevelReferenceSets,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const actors = puzzle.actors ?? [];
  if (actors.length === 0) return;
  for (const id of duplicates(actors.map((actor) => actor.id))) {
    add(errors, "puzzle.actor.duplicate", `puzzles[${index}].actors.${id}`, `Duplicate puzzle actor id "${id}".`);
  }
  const hitSequenceTargetById = puzzle.type === "hit_sequence" ? new Map(puzzle.targets.map((target) => [target.id, target])) : null;
  if (hitSequenceTargetById) {
    const compatibilityKeys = actors
      .map((actor) => actor.targetId ?? (hitSequenceTargetById.has(actor.id) ? actor.id : ""))
      .filter((id): id is string => Boolean(id));
    for (const id of duplicates(compatibilityKeys)) {
      add(errors, "puzzle.actor.target.duplicate", `puzzles[${index}].actors.${id}`, `Multiple puzzle actors reference target "${id}".`);
    }
  }
  actors.forEach((actor, actorIndex) => {
    const path = `puzzles[${index}].actors[${actorIndex}]`;
    if (!refs.roomIds.has(actor.roomId)) {
      add(errors, "puzzle.actor.room.missing", `${path}.roomId`, `Puzzle actor "${actor.id}" references missing room "${actor.roomId}".`);
    }
    if (actor.interactionId && !refs.interactionIds.has(actor.interactionId)) {
      add(errors, "puzzle.actor.interaction.missing", `${path}.interactionId`, `Puzzle actor "${actor.id}" references missing interaction "${actor.interactionId}".`);
    }
    if (actor.anchorPropId && !refs.propIds.has(actor.anchorPropId)) {
      add(errors, "puzzle.actor.prop.missing", `${path}.anchorPropId`, `Puzzle actor "${actor.id}" references missing prop "${actor.anchorPropId}".`);
    }
    if (actor.targetId && hitSequenceTargetById) {
      const target = hitSequenceTargetById.get(actor.targetId);
      if (!target) {
        add(errors, "puzzle.actor.target.missing", `${path}.targetId`, `Puzzle actor "${actor.id}" references missing target "${actor.targetId}".`);
      } else {
        if (actor.roomId !== target.roomId) {
          add(errors, "puzzle.actor.target.room_mismatch", `${path}.roomId`, `Puzzle actor "${actor.id}" must stay in the same room as target "${target.id}".`);
        }
        if (actor.kind === "target" && actor.colorKey && actor.colorKey !== target.colorKey) {
          add(errors, "puzzle.actor.target.color_mismatch", `${path}.colorKey`, `Puzzle actor "${actor.id}" colorKey must match target "${target.id}".`);
        }
        if (actor.position.some((value, axis) => Math.abs(value - target.position[axis]) > 0.001)) {
          add(errors, "puzzle.actor.target.position_mismatch", `${path}.position`, `Puzzle actor "${actor.id}" position must match target "${target.id}".`);
        }
      }
    }
    if (actor.hitbox?.shape === "sphere" && (actor.hitbox.radius ?? 0) <= 0) {
      add(errors, "puzzle.actor.hitbox.radius.invalid", `${path}.hitbox.radius`, `Puzzle actor "${actor.id}" sphere hitbox needs a positive radius.`);
    }
    if (actor.hitbox?.shape === "box" && (!actor.hitbox.halfSize || actor.hitbox.halfSize.some((value) => value <= 0))) {
      add(errors, "puzzle.actor.hitbox.box.invalid", `${path}.hitbox.halfSize`, `Puzzle actor "${actor.id}" box hitbox needs positive half extents.`);
    }
    validateVisualKey(actor.visualKey, `${path}.visualKey`, warnings);
    validateMaterialKey(actor.materialKey, `${path}.materialKey`, warnings);
  });
}

export function validateArticlesAndQuizzes(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const refs = createLevelReferenceSets(level);
  const articles = level.articles ?? [];
  const quizzes = level.quizzes ?? [];

  for (const id of duplicates(articles.map((article) => article.id))) {
    add(errors, "article.duplicate", `articles.${id}`, `Duplicate article id "${id}".`);
  }
  for (const id of duplicates(quizzes.map((quiz) => quiz.id))) {
    add(errors, "quiz.duplicate", `quizzes.${id}`, `Duplicate quiz id "${id}".`);
  }

  articles.forEach((article, index) => {
    if (!refs.roomIds.has(article.roomId)) {
      add(errors, "article.room.missing", `articles[${index}].roomId`, `Article "${article.id}" references missing room "${article.roomId}".`);
    }
    if (!refs.interactionIds.has(article.interactionId)) {
      add(errors, "article.interaction.missing", `articles[${index}].interactionId`, `Article "${article.id}" references missing interaction "${article.interactionId}".`);
    }
    if (article.pages.length === 0) {
      add(errors, "article.pages.empty", `articles[${index}].pages`, `Article "${article.id}" needs at least one page.`);
    }
    for (const pageId of duplicates(article.pages.map((page) => page.id))) {
      add(errors, "article.page.duplicate", `articles[${index}].pages.${pageId}`, `Duplicate page id "${pageId}" in article "${article.id}".`);
    }
  });

  quizzes.forEach((quiz, index) => {
    if (!refs.roomIds.has(quiz.roomId)) {
      add(errors, "quiz.room.missing", `quizzes[${index}].roomId`, `Quiz "${quiz.id}" references missing room "${quiz.roomId}".`);
    }
    if (!refs.interactionIds.has(quiz.interactionId)) {
      add(errors, "quiz.interaction.missing", `quizzes[${index}].interactionId`, `Quiz "${quiz.id}" references missing interaction "${quiz.interactionId}".`);
    }
    if (quiz.articleId && !refs.articleIds.has(quiz.articleId)) {
      add(errors, "quiz.article.missing", `quizzes[${index}].articleId`, `Quiz "${quiz.id}" references missing article "${quiz.articleId}".`);
    }
    if (quiz.options.length < 3 || quiz.options.length > 5) {
      add(warnings, "quiz.options.count", `quizzes[${index}].options`, `Quiz "${quiz.id}" should use 3-5 options for mobile readability.`);
    }
    const correctCount = quiz.options.filter((option) => option.correct === true).length;
    if (correctCount !== 1) {
      add(errors, "quiz.correct.count", `quizzes[${index}].options`, `Quiz "${quiz.id}" needs exactly one correct option.`);
    }
    for (const optionId of duplicates(quiz.options.map((option) => option.id))) {
      add(errors, "quiz.option.duplicate", `quizzes[${index}].options.${optionId}`, `Duplicate option id "${optionId}" in quiz "${quiz.id}".`);
    }
    if (quiz.resetPolicy?.type === "after_wrong_count" && (!quiz.resetPolicy.wrongCount || quiz.resetPolicy.wrongCount <= 0)) {
      add(errors, "quiz.reset.invalid", `quizzes[${index}].resetPolicy.wrongCount`, `Quiz "${quiz.id}" resetPolicy.after_wrong_count needs a positive wrongCount.`);
    }
    quiz.wrongAnswer?.actions?.forEach((action, actionIndex) => {
      validateRuntimeEventAction(action, `quizzes[${index}].wrongAnswer.actions[${actionIndex}]`, refs, errors, warnings);
    });
    quiz.correctAnswer.actions?.forEach((action, actionIndex) => {
      validateRuntimeEventAction(action, `quizzes[${index}].correctAnswer.actions[${actionIndex}]`, refs, errors, warnings);
    });
  });
}

export function validateSwitches(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const switches = level.switches ?? [];
  if (switches.length === 0) return;

  const refs = createLevelReferenceSets(level);
  for (const id of duplicates(switches.map((definition) => definition.id))) {
    add(errors, "switch.duplicate", `switches.${id}`, `Duplicate switch id "${id}".`);
  }
  validateWallSwitchControlLimits(level, errors, warnings);

  switches.forEach((definition, index) => {
    if (!refs.roomIds.has(definition.roomId)) {
      add(errors, "switch.room.missing", `switches[${index}].roomId`, `Switch "${definition.id}" references missing room "${definition.roomId}".`);
    }
    if (!refs.interactionIds.has(definition.interactionId)) {
      add(errors, "switch.interaction.missing", `switches[${index}].interactionId`, `Switch "${definition.id}" references missing interaction "${definition.interactionId}".`);
    }
    if (definition.states.length === 0) {
      add(errors, "switch.states.empty", `switches[${index}].states`, `Switch "${definition.id}" needs at least one state.`);
    }
    const stateIds = new Set(definition.states.map((state) => state.id));
    for (const stateId of duplicates(definition.states.map((state) => state.id))) {
      add(errors, "switch.state.duplicate", `switches[${index}].states.${stateId}`, `Duplicate state id "${stateId}" in switch "${definition.id}".`);
    }
    if (definition.initialStateId && !stateIds.has(definition.initialStateId)) {
      add(errors, "switch.initial.missing", `switches[${index}].initialStateId`, `Switch "${definition.id}" initial state "${definition.initialStateId}" does not exist.`);
    }
    if (definition.presentation?.kind === "wall_button" || definition.presentation?.kind === "wall_lever") {
      if (!definition.wallMount) {
        add(errors, "switch.wall_mount.missing", `switches[${index}].wallMount`, `Wall switch "${definition.id}" needs wallMount placement.`);
      } else {
        if (!refs.roomIds.has(definition.wallMount.roomId)) {
          add(errors, "switch.wall_mount.room.missing", `switches[${index}].wallMount.roomId`, `Wall switch "${definition.id}" wallMount references missing room "${definition.wallMount.roomId}".`);
        }
        if (definition.wallMount.offset < -1 || definition.wallMount.offset > 1) {
          add(errors, "switch.wall_mount.offset.invalid", `switches[${index}].wallMount.offset`, `Wall switch "${definition.id}" offset must be between -1 and 1.`);
        }
        if (definition.wallMount.height !== undefined && definition.wallMount.height <= 0) {
          add(errors, "switch.wall_mount.height.invalid", `switches[${index}].wallMount.height`, `Wall switch "${definition.id}" height must be positive.`);
        }
      }
      if (definition.presentation.modelKey && !isEnvironmentModelKey(definition.presentation.modelKey)) {
        add(warnings, "switch.presentation.model.unknown", `switches[${index}].presentation.modelKey`, `Wall switch "${definition.id}" modelKey "${definition.presentation.modelKey}" is not registered yet.`);
      }
    }
    definition.states.forEach((state, stateIndex) => {
      state.actions.forEach((action, actionIndex) => {
        validateRuntimeEventAction(action, `switches[${index}].states[${stateIndex}].actions[${actionIndex}]`, refs, errors, warnings);
      });
      if (definition.oneShot && stateIndex === 0 && state.actions.length > 0 && definition.initialStateId === state.id) {
        add(warnings, "switch.initial.actions", `switches[${index}].states[${stateIndex}].actions`, `One-shot switch "${definition.id}" initial state usually should not have actions.`);
      }
    });
  });
}

function validateWallSwitchControlLimits(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const switches = level.switches ?? [];
  const wallSwitches = switches.filter(isWallDoorSwitch);
  if (wallSwitches.length > MAX_WALL_SWITCHES_PER_LEVEL) {
    add(
      errors,
      "switch.wall.count.limit",
      "switches",
      `Official/generated wall door switches are capped at ${MAX_WALL_SWITCHES_PER_LEVEL}; found ${wallSwitches.length}.`,
    );
  }

  const controllersByDoorId = new Map<string, Set<string>>();
  for (const definition of wallSwitches) {
    const doorIds = wallSwitchControlledDoorIds(definition);
    for (const doorId of doorIds) {
      const controllers = controllersByDoorId.get(doorId) ?? new Set<string>();
      controllers.add(definition.id);
      controllersByDoorId.set(doorId, controllers);
    }
  }

  for (const [doorId, controllerIds] of controllersByDoorId.entries()) {
    if (controllerIds.size > MAX_WALL_SWITCH_CONTROLLERS_PER_DOOR) {
      add(
        errors,
        "switch.wall.door.controllers.limit",
        `map.doors.${doorId}`,
        `Door "${doorId}" is controlled by ${controllerIds.size} wall door switches; max is ${MAX_WALL_SWITCH_CONTROLLERS_PER_DOOR}.`,
      );
    } else if (controllerIds.size === MAX_WALL_SWITCH_CONTROLLERS_PER_DOOR) {
      add(
        warnings,
        "switch.wall.door.controllers.shared",
        `map.doors.${doorId}`,
        `Door "${doorId}" is shared by two wall door switches; validator will treat it as a shared door group.`,
      );
    }
  }
}

function isWallDoorSwitch(definition: NonNullable<LevelDefinition["switches"]>[number]) {
  return definition.presentation?.kind === "wall_button" || definition.presentation?.kind === "wall_lever" || Boolean(definition.wallMount);
}

function wallSwitchControlledDoorIds(definition: NonNullable<LevelDefinition["switches"]>[number]) {
  const doorIds = new Set<string>();
  for (const state of definition.states) {
    for (const action of state.actions) {
      if (
        action.type === "open_door" ||
        action.type === "close_door" ||
        action.type === "unlock_door" ||
        action.type === "lock_door"
      ) {
        doorIds.add(action.doorId);
      }
    }
  }
  return doorIds;
}

export function validateBigScreens(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const screens = level.bigScreens ?? [];
  if (screens.length === 0) return;

  const refs = createLevelReferenceSets(level);
  for (const id of duplicates(screens.map((definition) => definition.id))) {
    add(errors, "bigScreen.duplicate", `bigScreens.${id}`, `Duplicate big screen id "${id}".`);
  }

  screens.forEach((definition, index) => {
    if (!refs.roomIds.has(definition.roomId)) {
      add(errors, "bigScreen.room.missing", `bigScreens[${index}].roomId`, `Big screen "${definition.id}" references missing room "${definition.roomId}".`);
    }
    if (!refs.interactionIds.has(definition.interactionId)) {
      add(errors, "bigScreen.interaction.missing", `bigScreens[${index}].interactionId`, `Big screen "${definition.id}" references missing interaction "${definition.interactionId}".`);
    }
    if (definition.states.length === 0) {
      add(errors, "bigScreen.states.empty", `bigScreens[${index}].states`, `Big screen "${definition.id}" needs at least one state.`);
    }
    const stateIds = new Set(definition.states.map((state) => state.id));
    for (const stateId of duplicates(definition.states.map((state) => state.id))) {
      add(errors, "bigScreen.state.duplicate", `bigScreens[${index}].states.${stateId}`, `Duplicate state id "${stateId}" in big screen "${definition.id}".`);
    }
    if (definition.initialStateId && !stateIds.has(definition.initialStateId)) {
      add(errors, "bigScreen.initial.missing", `bigScreens[${index}].initialStateId`, `Big screen "${definition.id}" initial state "${definition.initialStateId}" does not exist.`);
    }
    if (definition.activationStateId && !stateIds.has(definition.activationStateId)) {
      add(errors, "bigScreen.activation.missing", `bigScreens[${index}].activationStateId`, `Big screen "${definition.id}" activation state "${definition.activationStateId}" does not exist.`);
    }
    validateVisualKey(definition.visualKey ?? definition.modelKey, `bigScreens[${index}].visualKey`, warnings);
    validateMaterialKey(definition.materialKey, `bigScreens[${index}].materialKey`, warnings);

    definition.states.forEach((state, stateIndex) => {
      if (state.mode === "digits" && !state.digits && !state.formula?.answer) {
        add(warnings, "bigScreen.digits.empty", `bigScreens[${index}].states[${stateIndex}].digits`, `Digits screen state "${state.id}" has no digits.`);
      }
      if (state.mode === "color_sequence" && (state.colors?.length ?? 0) === 0) {
        add(errors, "bigScreen.colors.empty", `bigScreens[${index}].states[${stateIndex}].colors`, `Color sequence screen state "${state.id}" needs colors.`);
      }
      if (state.mode === "formula" && !state.formula?.expression && !state.formula?.display) {
        add(errors, "bigScreen.formula.empty", `bigScreens[${index}].states[${stateIndex}].formula`, `Formula screen state "${state.id}" needs expression or display.`);
      }
      if (state.formula) validateFormulaDefinition(state.formula, `bigScreens[${index}].states[${stateIndex}].formula`, errors, warnings);
      state.actions?.forEach((action, actionIndex) => {
        validateRuntimeEventAction(action, `bigScreens[${index}].states[${stateIndex}].actions[${actionIndex}]`, refs, errors, warnings);
      });
    });
  });
}

function validateHitSequencePuzzle(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: {
    roomIds: Set<string>;
    doorIds: Set<string>;
    interactionIds: Set<string>;
    objectiveIds: Set<string>;
  },
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  if (puzzle.type !== "hit_sequence") return;
  if (puzzle.targets.length === 0) {
    add(errors, "puzzle.targets.empty", `puzzles[${index}].targets`, `Puzzle "${puzzle.id}" needs at least one target.`);
  }
  if (puzzle.clue.sequence.length === 0) {
    add(errors, "puzzle.sequence.empty", `puzzles[${index}].clue.sequence`, `Puzzle "${puzzle.id}" needs a hit sequence.`);
  }

  const targetIds = new Set(puzzle.targets.map((target) => target.id));
  for (const id of duplicates(puzzle.targets.map((target) => target.id))) {
    add(errors, "puzzle.target.duplicate", `puzzles[${index}].targets.${id}`, `Duplicate puzzle target id "${id}".`);
  }
  for (const targetId of puzzle.clue.sequence) {
    if (!targetIds.has(targetId)) {
      add(errors, "puzzle.sequence.target.missing", `puzzles[${index}].clue.sequence`, `Puzzle "${puzzle.id}" sequence references missing target "${targetId}".`);
    }
  }
  if (puzzle.clue.roomId && !refs.roomIds.has(puzzle.clue.roomId)) {
    add(errors, "puzzle.clue.room.missing", `puzzles[${index}].clue.roomId`, `Puzzle "${puzzle.id}" clue references missing room "${puzzle.clue.roomId}".`);
  }
  if (puzzle.clue.interactionId && !refs.interactionIds.has(puzzle.clue.interactionId)) {
    add(errors, "puzzle.clue.interaction.missing", `puzzles[${index}].clue.interactionId`, `Puzzle "${puzzle.id}" clue references missing interaction "${puzzle.clue.interactionId}".`);
  }
  if (puzzle.clue.playback) {
    const playback = puzzle.clue.playback;
    if (playback.stepMs !== undefined && playback.stepMs <= 0) {
      add(errors, "puzzle.clue.playback.step.invalid", `puzzles[${index}].clue.playback.stepMs`, `Puzzle "${puzzle.id}" playback stepMs must be positive.`);
    }
    if (playback.gapMs !== undefined && playback.gapMs < 0) {
      add(errors, "puzzle.clue.playback.gap.invalid", `puzzles[${index}].clue.playback.gapMs`, `Puzzle "${puzzle.id}" playback gapMs cannot be negative.`);
    }
    if (playback.reshuffleAfterFailures !== undefined && playback.reshuffleAfterFailures <= 0) {
      add(errors, "puzzle.clue.playback.reshuffle.invalid", `puzzles[${index}].clue.playback.reshuffleAfterFailures`, `Puzzle "${puzzle.id}" playback reshuffleAfterFailures must be positive.`);
    }
    const validColorKeys = new Set(["red", "blue", "green", "yellow", "purple", "white", "cyan"]);
    playback.palette?.forEach((color, colorIndex) => {
      if (!validColorKeys.has(color)) {
        add(errors, "puzzle.clue.playback.palette.invalid", `puzzles[${index}].clue.playback.palette[${colorIndex}]`, `Puzzle "${puzzle.id}" playback uses unknown lamp color "${color}".`);
      }
    });
  }
  const clueSurfaces = puzzle.clue.surfaces ?? [];
  for (const surfaceId of duplicates(clueSurfaces.map((surface) => surface.id))) {
    add(errors, "puzzle.clue.surface.duplicate", `puzzles[${index}].clue.surfaces.${surfaceId}`, `Duplicate clue surface id "${surfaceId}".`);
  }
  clueSurfaces.forEach((surface, surfaceIndex) => {
    if (!refs.roomIds.has(surface.roomId)) {
      add(errors, "puzzle.clue.surface.room.missing", `puzzles[${index}].clue.surfaces[${surfaceIndex}].roomId`, `Clue surface "${surface.id}" references missing room "${surface.roomId}".`);
    }
    if (surface.size[0] <= 0 || surface.size[1] <= 0) {
      add(errors, "puzzle.clue.surface.size.invalid", `puzzles[${index}].clue.surfaces[${surfaceIndex}].size`, `Clue surface "${surface.id}" needs positive width and height/depth.`);
    }
    for (const targetId of surface.sequence ?? puzzle.clue.sequence) {
      if (!targetIds.has(targetId)) {
        add(errors, "puzzle.clue.surface.sequence.target.missing", `puzzles[${index}].clue.surfaces[${surfaceIndex}].sequence`, `Clue surface "${surface.id}" references missing target "${targetId}".`);
      }
    }
    validateMaterialKey(surface.materialKey, `puzzles[${index}].clue.surfaces[${surfaceIndex}].materialKey`, warnings);
  });
  if (puzzle.success.opensDoorId && !refs.doorIds.has(puzzle.success.opensDoorId)) {
    add(errors, "puzzle.success.door.missing", `puzzles[${index}].success.opensDoorId`, `Puzzle "${puzzle.id}" opens missing door "${puzzle.success.opensDoorId}".`);
  }
  if (puzzle.success.unlocksDoorId && !refs.doorIds.has(puzzle.success.unlocksDoorId)) {
    add(errors, "puzzle.success.unlockDoor.missing", `puzzles[${index}].success.unlocksDoorId`, `Puzzle "${puzzle.id}" unlocks missing door "${puzzle.success.unlocksDoorId}".`);
  }
  if (puzzle.success.completesObjectiveId && !refs.objectiveIds.has(puzzle.success.completesObjectiveId)) {
    add(errors, "puzzle.success.objective.missing", `puzzles[${index}].success.completesObjectiveId`, `Puzzle "${puzzle.id}" completes missing objective "${puzzle.success.completesObjectiveId}".`);
  }

  puzzle.targets.forEach((target, targetIndex) => {
    if (!refs.roomIds.has(target.roomId)) {
      add(errors, "puzzle.target.room.missing", `puzzles[${index}].targets[${targetIndex}].roomId`, `Puzzle target "${target.id}" references missing room "${target.roomId}".`);
    }
    if (target.radius <= 0) {
      add(errors, "puzzle.target.radius.invalid", `puzzles[${index}].targets[${targetIndex}].radius`, `Puzzle target "${target.id}" needs a positive radius.`);
    }
    validateVisualKey(target.visualKey, `puzzles[${index}].targets[${targetIndex}].visualKey`, warnings);
    validateMaterialKey(target.materialKey, `puzzles[${index}].targets[${targetIndex}].materialKey`, warnings);
  });
}

function validateCodeLockPuzzle(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: {
    roomIds: Set<string>;
    doorIds: Set<string>;
    keyItemIds: Set<string>;
    interactionIds: Set<string>;
    objectiveIds: Set<string>;
  },
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  if (puzzle.type !== "code_lock") return;
  if (!refs.interactionIds.has(puzzle.interactionId)) {
    add(errors, "puzzle.code.interaction.missing", `puzzles[${index}].interactionId`, `Code lock "${puzzle.id}" references missing interaction "${puzzle.interactionId}".`);
  }
  if (puzzle.requiredKeyItemId && !refs.keyItemIds.has(puzzle.requiredKeyItemId)) {
    add(errors, "puzzle.code.key.missing", `puzzles[${index}].requiredKeyItemId`, `Code lock "${puzzle.id}" requires missing key item "${puzzle.requiredKeyItemId}".`);
  }
  if (puzzle.input.length <= 0) {
    add(errors, "puzzle.code.length.invalid", `puzzles[${index}].input.length`, `Code lock "${puzzle.id}" needs a positive input length.`);
  }
  if (puzzle.code.source === "fixed" && (puzzle.code.value?.length ?? 0) !== puzzle.input.length) {
    add(errors, "puzzle.code.fixed.invalid", `puzzles[${index}].code.value`, `Code lock "${puzzle.id}" fixed code must match input length.`);
  }
  if (puzzle.code.source === "direction_room_digits") {
    if ((puzzle.code.directionOrder?.length ?? 0) !== puzzle.input.length) {
      add(errors, "puzzle.code.direction.length", `puzzles[${index}].code.directionOrder`, `Code lock "${puzzle.id}" direction order must match input length.`);
    }
    const clueDirections = new Set(puzzle.clues.map((clue) => clue.direction));
    for (const direction of puzzle.code.directionOrder ?? []) {
      if (!clueDirections.has(direction)) {
        add(errors, "puzzle.code.direction.clue.missing", `puzzles[${index}].code.directionOrder`, `Code lock "${puzzle.id}" is missing ${direction} digit clue.`);
      }
    }
  }
  if (puzzle.code.source === "formula") {
    validateFormulaDefinition(puzzle.code.formula, `puzzles[${index}].code.formula`, errors, warnings, puzzle.input.length);
  }
  if (puzzle.success.opensDoorId && !refs.doorIds.has(puzzle.success.opensDoorId)) {
    add(errors, "puzzle.code.success.door.missing", `puzzles[${index}].success.opensDoorId`, `Code lock "${puzzle.id}" opens missing door "${puzzle.success.opensDoorId}".`);
  }
  if (puzzle.success.unlocksDoorId && !refs.doorIds.has(puzzle.success.unlocksDoorId)) {
    add(errors, "puzzle.code.success.unlockDoor.missing", `puzzles[${index}].success.unlocksDoorId`, `Code lock "${puzzle.id}" unlocks missing door "${puzzle.success.unlocksDoorId}".`);
  }
  if (puzzle.success.completesObjectiveId && !refs.objectiveIds.has(puzzle.success.completesObjectiveId)) {
    add(errors, "puzzle.code.success.objective.missing", `puzzles[${index}].success.completesObjectiveId`, `Code lock "${puzzle.id}" completes missing objective "${puzzle.success.completesObjectiveId}".`);
  }

  const duplicateClues = duplicates(puzzle.clues.map((clue) => clue.id));
  for (const id of duplicateClues) {
    add(errors, "puzzle.code.clue.duplicate", `puzzles[${index}].clues.${id}`, `Duplicate code clue id "${id}".`);
  }
  puzzle.clues.forEach((clue, clueIndex) => {
    if (!refs.roomIds.has(clue.roomId)) {
      add(errors, "puzzle.code.clue.room.missing", `puzzles[${index}].clues[${clueIndex}].roomId`, `Code clue "${clue.id}" references missing room "${clue.roomId}".`);
    }
    if (!/^\d$/.test(clue.value)) {
      add(errors, "puzzle.code.clue.value.invalid", `puzzles[${index}].clues[${clueIndex}].value`, `Code clue "${clue.id}" value must be one digit.`);
    }
    if (clue.size && (clue.size[0] <= 0 || clue.size[1] <= 0)) {
      add(errors, "puzzle.code.clue.size.invalid", `puzzles[${index}].clues[${clueIndex}].size`, `Code clue "${clue.id}" needs positive width and height/depth.`);
    }
    validateVisualKey(clue.visualKey, `puzzles[${index}].clues[${clueIndex}].visualKey`, warnings);
    validateMaterialKey(clue.materialKey, `puzzles[${index}].clues[${clueIndex}].materialKey`, warnings);
  });
}

function validateToolCalibrationPuzzle(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: { interactionIds: Set<string> },
  errors: ConfigValidationIssue[],
) {
  if (puzzle.type !== "tool_calibration") return;
  if (!refs.interactionIds.has(puzzle.interactionId)) {
    add(errors, "puzzle.toolCalibration.interaction.missing", `puzzles[${index}].interactionId`, `Tool calibration "${puzzle.id}" references missing interaction "${puzzle.interactionId}".`);
  }
  if (puzzle.columns <= 0 || puzzle.rows <= 0) {
    add(errors, "puzzle.toolCalibration.size.invalid", `puzzles[${index}]`, `Tool calibration "${puzzle.id}" needs positive columns and rows.`);
  }
  if (puzzle.targets.length === 0) {
    add(errors, "puzzle.toolCalibration.targets.empty", `puzzles[${index}].targets`, `Tool calibration "${puzzle.id}" needs at least one target.`);
  }
  if (puzzle.maxMoveLimit !== undefined && puzzle.maxMoveLimit <= 0) {
    add(errors, "puzzle.toolCalibration.maxMoveLimit.invalid", `puzzles[${index}].maxMoveLimit`, `Tool calibration "${puzzle.id}" needs a positive maxMoveLimit.`);
  }
  if (puzzle.perfectMoveLimit !== undefined && puzzle.maxMoveLimit !== undefined && puzzle.perfectMoveLimit > puzzle.maxMoveLimit) {
    add(errors, "puzzle.toolCalibration.moveLimit.invalid", `puzzles[${index}].perfectMoveLimit`, `Tool calibration "${puzzle.id}" perfectMoveLimit cannot exceed maxMoveLimit.`);
  }

  const cells = new Set<string>();
  puzzle.cells.forEach((cell, cellIndex) => {
    const key = `${cell.x}:${cell.y}`;
    if (!isToolCalibrationCellInBounds(cell.x, cell.y, puzzle.columns, puzzle.rows)) {
      add(errors, "puzzle.toolCalibration.cell.outOfBounds", `puzzles[${index}].cells[${cellIndex}]`, `Tool calibration "${puzzle.id}" has an out-of-bounds cell.`);
    }
    if (cells.has(key)) {
      add(errors, "puzzle.toolCalibration.cell.duplicate", `puzzles[${index}].cells[${cellIndex}]`, `Tool calibration "${puzzle.id}" duplicates cell ${key}.`);
    }
    cells.add(key);
  });

  if (!cells.has(`${puzzle.entry.x}:${puzzle.entry.y}`) || !isToolCalibrationCellInBounds(puzzle.entry.x, puzzle.entry.y, puzzle.columns, puzzle.rows)) {
    add(errors, "puzzle.toolCalibration.entry.invalid", `puzzles[${index}].entry`, `Tool calibration "${puzzle.id}" entry must reference a configured cell.`);
  }
  puzzle.targets.forEach((target, targetIndex) => {
    if (!cells.has(`${target.x}:${target.y}`) || !isToolCalibrationCellInBounds(target.x, target.y, puzzle.columns, puzzle.rows)) {
      add(errors, "puzzle.toolCalibration.target.invalid", `puzzles[${index}].targets[${targetIndex}]`, `Tool calibration "${puzzle.id}" target must reference a configured cell.`);
    }
  });
  puzzle.requiredCells?.forEach((cell, cellIndex) => {
    if (!cells.has(`${cell.x}:${cell.y}`) || !isToolCalibrationCellInBounds(cell.x, cell.y, puzzle.columns, puzzle.rows)) {
      add(errors, "puzzle.toolCalibration.required.invalid", `puzzles[${index}].requiredCells[${cellIndex}]`, `Tool calibration "${puzzle.id}" required cell must reference a configured cell.`);
    }
  });
  const variants = new Set<string>();
  puzzle.variants?.forEach((variant, variantIndex) => {
    if (variants.has(variant.id)) {
      add(errors, "puzzle.toolCalibration.variant.duplicate", `puzzles[${index}].variants[${variantIndex}].id`, `Tool calibration "${puzzle.id}" duplicates variant "${variant.id}".`);
    }
    variants.add(variant.id);
    if (variant.solutionMoveCount !== undefined && (variant.solutionMoveCount < 4 || variant.solutionMoveCount > 6)) {
      add(errors, "puzzle.toolCalibration.variant.solutionMoveCount.invalid", `puzzles[${index}].variants[${variantIndex}].solutionMoveCount`, `Tool calibration "${puzzle.id}" variant "${variant.id}" should be solvable in 4-6 moves.`);
    }
    const overrides = new Set<string>();
    variant.rotationOverrides.forEach((override, overrideIndex) => {
      const key = `${override.x}:${override.y}`;
      if (!cells.has(key)) {
        add(errors, "puzzle.toolCalibration.variant.cell.invalid", `puzzles[${index}].variants[${variantIndex}].rotationOverrides[${overrideIndex}]`, `Tool calibration "${puzzle.id}" variant "${variant.id}" references missing cell ${key}.`);
      }
      if (overrides.has(key)) {
        add(errors, "puzzle.toolCalibration.variant.cell.duplicate", `puzzles[${index}].variants[${variantIndex}].rotationOverrides[${overrideIndex}]`, `Tool calibration "${puzzle.id}" variant "${variant.id}" duplicates override ${key}.`);
      }
      overrides.add(key);
      if (!Number.isInteger(override.rotation) || override.rotation < 0 || override.rotation > 3) {
        add(errors, "puzzle.toolCalibration.variant.rotation.invalid", `puzzles[${index}].variants[${variantIndex}].rotationOverrides[${overrideIndex}].rotation`, `Tool calibration "${puzzle.id}" variant "${variant.id}" rotation must be 0-3.`);
      }
    });
  });
}

function isToolCalibrationCellInBounds(x: number, y: number, columns: number, rows: number) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < columns && y < rows;
}

/** Success door/objective references for puzzle types that don't validate them inline. */
function validatePuzzleSuccessRefs(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: { doorIds: Set<string>; objectiveIds: Set<string> },
  errors: ConfigValidationIssue[],
) {
  if (
    puzzle.type !== "circuit_grid" &&
    puzzle.type !== "surveillance_match" &&
    puzzle.type !== "valve_matrix" &&
    puzzle.type !== "archive_merge" &&
    puzzle.type !== "gallery_reading"
  )
    return;
  if (puzzle.success.opensDoorId && !refs.doorIds.has(puzzle.success.opensDoorId)) {
    add(errors, "puzzle.success.door.missing", `puzzles[${index}].success.opensDoorId`, `Puzzle "${puzzle.id}" opens missing door "${puzzle.success.opensDoorId}".`);
  }
  if (puzzle.success.unlocksDoorId && !refs.doorIds.has(puzzle.success.unlocksDoorId)) {
    add(errors, "puzzle.success.unlockDoor.missing", `puzzles[${index}].success.unlocksDoorId`, `Puzzle "${puzzle.id}" unlocks missing door "${puzzle.success.unlocksDoorId}".`);
  }
  if (puzzle.success.completesObjectiveId && !refs.objectiveIds.has(puzzle.success.completesObjectiveId)) {
    add(errors, "puzzle.success.objective.missing", `puzzles[${index}].success.completesObjectiveId`, `Puzzle "${puzzle.id}" completes missing objective "${puzzle.success.completesObjectiveId}".`);
  }
}

function validateCircuitGridPuzzle(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: { interactionIds: Set<string> },
  errors: ConfigValidationIssue[],
) {
  if (puzzle.type !== "circuit_grid") return;
  if (!refs.interactionIds.has(puzzle.interactionId)) {
    add(errors, "puzzle.circuitGrid.interaction.missing", `puzzles[${index}].interactionId`, `Circuit grid "${puzzle.id}" references missing interaction "${puzzle.interactionId}".`);
  }
  if (puzzle.columns <= 0 || puzzle.rows <= 0) {
    add(errors, "puzzle.circuitGrid.size.invalid", `puzzles[${index}]`, `Circuit grid "${puzzle.id}" needs positive columns and rows.`);
  }
  if (puzzle.sources.length === 0) {
    add(errors, "puzzle.circuitGrid.sources.empty", `puzzles[${index}].sources`, `Circuit grid "${puzzle.id}" needs at least one power source.`);
  }
  if (puzzle.targets.length === 0) {
    add(errors, "puzzle.circuitGrid.targets.empty", `puzzles[${index}].targets`, `Circuit grid "${puzzle.id}" needs at least one target node.`);
  }
  if (puzzle.moveLimit !== undefined && puzzle.moveLimit <= 0) {
    add(errors, "puzzle.circuitGrid.moveLimit.invalid", `puzzles[${index}].moveLimit`, `Circuit grid "${puzzle.id}" needs a positive moveLimit.`);
  }
  if (puzzle.timeLimitSec !== undefined && puzzle.timeLimitSec <= 0) {
    add(errors, "puzzle.circuitGrid.timeLimit.invalid", `puzzles[${index}].timeLimitSec`, `Circuit grid "${puzzle.id}" needs a positive timeLimitSec.`);
  }
  const cells = new Set<string>();
  puzzle.cells.forEach((cell, cellIndex) => {
    const key = `${cell.x}:${cell.y}`;
    if (!isToolCalibrationCellInBounds(cell.x, cell.y, puzzle.columns, puzzle.rows)) {
      add(errors, "puzzle.circuitGrid.cell.outOfBounds", `puzzles[${index}].cells[${cellIndex}]`, `Circuit grid "${puzzle.id}" has an out-of-bounds cell.`);
    }
    if (cells.has(key)) {
      add(errors, "puzzle.circuitGrid.cell.duplicate", `puzzles[${index}].cells[${cellIndex}]`, `Circuit grid "${puzzle.id}" duplicates cell ${key}.`);
    }
    cells.add(key);
  });
  puzzle.sources.forEach((port, portIndex) => {
    if (!cells.has(`${port.x}:${port.y}`)) {
      add(errors, "puzzle.circuitGrid.source.invalid", `puzzles[${index}].sources[${portIndex}]`, `Circuit grid "${puzzle.id}" source must reference a configured cell.`);
    }
  });
  puzzle.targets.forEach((port, portIndex) => {
    if (!cells.has(`${port.x}:${port.y}`)) {
      add(errors, "puzzle.circuitGrid.target.invalid", `puzzles[${index}].targets[${portIndex}]`, `Circuit grid "${puzzle.id}" target must reference a configured cell.`);
    }
  });
}

function validateSurveillanceMatchPuzzle(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: { interactionIds: Set<string> },
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  if (puzzle.type !== "surveillance_match") return;
  if (!refs.interactionIds.has(puzzle.interactionId)) {
    add(errors, "puzzle.surveillance.interaction.missing", `puzzles[${index}].interactionId`, `Surveillance match "${puzzle.id}" references missing interaction "${puzzle.interactionId}".`);
  }
  if (puzzle.channels.length === 0) {
    add(errors, "puzzle.surveillance.channels.empty", `puzzles[${index}].channels`, `Surveillance match "${puzzle.id}" needs at least one camera channel.`);
  }
  if (puzzle.options.length < 2) {
    add(errors, "puzzle.surveillance.options.count", `puzzles[${index}].options`, `Surveillance match "${puzzle.id}" needs at least two options.`);
  }
  if (puzzle.options.length > 6) {
    add(warnings, "puzzle.surveillance.options.many", `puzzles[${index}].options`, `Surveillance match "${puzzle.id}" should use at most 6 options for readability.`);
  }
  for (const id of duplicates(puzzle.channels.map((channel) => channel.id))) {
    add(errors, "puzzle.surveillance.channel.duplicate", `puzzles[${index}].channels.${id}`, `Duplicate surveillance channel id "${id}".`);
  }
  for (const id of duplicates(puzzle.options.map((option) => option.id))) {
    add(errors, "puzzle.surveillance.option.duplicate", `puzzles[${index}].options.${id}`, `Duplicate surveillance option id "${id}".`);
  }
  const optionIds = new Set(puzzle.options.map((option) => option.id));
  puzzle.channels.forEach((channel, channelIndex) => {
    if (!optionIds.has(channel.answerOptionId)) {
      add(errors, "puzzle.surveillance.answer.missing", `puzzles[${index}].channels[${channelIndex}].answerOptionId`, `Surveillance channel "${channel.id}" answer "${channel.answerOptionId}" is not a configured option.`);
    }
  });
  if (puzzle.maxMistakes !== undefined && puzzle.maxMistakes <= 0) {
    add(errors, "puzzle.surveillance.maxMistakes.invalid", `puzzles[${index}].maxMistakes`, `Surveillance match "${puzzle.id}" needs a positive maxMistakes.`);
  }
}

function validateValveMatrixPuzzle(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: { interactionIds: Set<string> },
  errors: ConfigValidationIssue[],
) {
  if (puzzle.type !== "valve_matrix") return;
  if (!refs.interactionIds.has(puzzle.interactionId)) {
    add(errors, "puzzle.valveMatrix.interaction.missing", `puzzles[${index}].interactionId`, `Valve matrix "${puzzle.id}" references missing interaction "${puzzle.interactionId}".`);
  }
  if (puzzle.valves.length === 0) {
    add(errors, "puzzle.valveMatrix.valves.empty", `puzzles[${index}].valves`, `Valve matrix "${puzzle.id}" needs at least one valve.`);
  }
  if (puzzle.gauges.length === 0) {
    add(errors, "puzzle.valveMatrix.gauges.empty", `puzzles[${index}].gauges`, `Valve matrix "${puzzle.id}" needs at least one gauge.`);
  }
  for (const id of duplicates(puzzle.valves.map((valve) => valve.id))) {
    add(errors, "puzzle.valveMatrix.valve.duplicate", `puzzles[${index}].valves.${id}`, `Duplicate valve id "${id}".`);
  }
  for (const id of duplicates(puzzle.gauges.map((gauge) => gauge.id))) {
    add(errors, "puzzle.valveMatrix.gauge.duplicate", `puzzles[${index}].gauges.${id}`, `Duplicate gauge id "${id}".`);
  }
  puzzle.valves.forEach((valve, valveIndex) => {
    if (!Number.isInteger(valve.min) || !Number.isInteger(valve.max) || valve.min >= valve.max) {
      add(errors, "puzzle.valveMatrix.range.invalid", `puzzles[${index}].valves[${valveIndex}]`, `Valve "${valve.id}" needs integer min < max.`);
    }
    if (valve.initial < valve.min || valve.initial > valve.max) {
      add(errors, "puzzle.valveMatrix.initial.invalid", `puzzles[${index}].valves[${valveIndex}].initial`, `Valve "${valve.id}" initial position must sit inside [min, max].`);
    }
    if (valve.gaugeShift.length !== puzzle.gauges.length) {
      add(errors, "puzzle.valveMatrix.shift.length", `puzzles[${index}].valves[${valveIndex}].gaugeShift`, `Valve "${valve.id}" gaugeShift must list one delta per gauge (${puzzle.gauges.length}).`);
    }
  });
  puzzle.gauges.forEach((gauge, gaugeIndex) => {
    if (gauge.tolerance < 0) {
      add(errors, "puzzle.valveMatrix.tolerance.invalid", `puzzles[${index}].gauges[${gaugeIndex}].tolerance`, `Gauge "${gauge.id}" tolerance cannot be negative.`);
    }
  });
  if (puzzle.solution.length !== puzzle.valves.length) {
    add(errors, "puzzle.valveMatrix.solution.length", `puzzles[${index}].solution`, `Valve matrix "${puzzle.id}" solution must list one position per valve.`);
    return;
  }
  let solutionInRange = true;
  puzzle.solution.forEach((position, valveIndex) => {
    const valve = puzzle.valves[valveIndex];
    if (!valve) return;
    if (position < valve.min || position > valve.max) {
      solutionInRange = false;
      add(errors, "puzzle.valveMatrix.solution.range", `puzzles[${index}].solution[${valveIndex}]`, `Valve matrix "${puzzle.id}" solution for "${valve.id}" is outside [min, max].`);
    }
  });
  // Solvability proof: the reference solution must land every gauge in its band.
  if (solutionInRange && puzzle.valves.every((valve) => valve.gaugeShift.length === puzzle.gauges.length)) {
    puzzle.gauges.forEach((gauge, gaugeIndex) => {
      const value = gauge.base + puzzle.valves.reduce(
        (sum, valve, valveIndex) => sum + (puzzle.solution[valveIndex] ?? 0) * valve.gaugeShift[gaugeIndex],
        0,
      );
      if (Math.abs(value - gauge.target) > gauge.tolerance + 1e-9) {
        add(errors, "puzzle.valveMatrix.unsolvable", `puzzles[${index}].solution`, `Valve matrix "${puzzle.id}" reference solution leaves gauge "${gauge.id}" at ${value}, outside ${gauge.target}±${gauge.tolerance}.`);
      }
    });
  }
}

function validateArchiveMergePuzzle(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: { interactionIds: Set<string> },
  errors: ConfigValidationIssue[],
) {
  if (puzzle.type !== "archive_merge") return;
  if (!refs.interactionIds.has(puzzle.interactionId)) {
    add(errors, "puzzle.archiveMerge.interaction.missing", `puzzles[${index}].interactionId`, `Archive merge "${puzzle.id}" references missing interaction "${puzzle.interactionId}".`);
  }
  if (!Number.isInteger(puzzle.gridSize) || puzzle.gridSize < 3 || puzzle.gridSize > 5) {
    add(errors, "puzzle.archiveMerge.gridSize.invalid", `puzzles[${index}].gridSize`, `Archive merge "${puzzle.id}" needs gridSize 3-5.`);
  }
  if (!isPowerOfTwo(puzzle.targetValue) || puzzle.targetValue < 32 || puzzle.targetValue > 2048) {
    add(errors, "puzzle.archiveMerge.target.invalid", `puzzles[${index}].targetValue`, `Archive merge "${puzzle.id}" targetValue must be a power of two from 32 to 2048.`);
  }
  if (puzzle.moveLimit !== undefined && (!Number.isInteger(puzzle.moveLimit) || puzzle.moveLimit <= 0)) {
    add(errors, "puzzle.archiveMerge.moveLimit.invalid", `puzzles[${index}].moveLimit`, `Archive merge "${puzzle.id}" needs a positive integer moveLimit.`);
  }
  puzzle.spawnTable?.forEach((entry, entryIndex) => {
    if (!isPowerOfTwo(entry.value) || entry.value < 2 || entry.value > Math.max(4, puzzle.targetValue / 2)) {
      add(errors, "puzzle.archiveMerge.spawn.value.invalid", `puzzles[${index}].spawnTable[${entryIndex}].value`, `Archive merge "${puzzle.id}" spawn value must be a useful power of two.`);
    }
    if (entry.weight <= 0) {
      add(errors, "puzzle.archiveMerge.spawn.weight.invalid", `puzzles[${index}].spawnTable[${entryIndex}].weight`, `Archive merge "${puzzle.id}" spawn weight must be positive.`);
    }
  });
}

function isPowerOfTwo(value: number) {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

function validateGalleryReadingPuzzle(
  puzzle: LevelPuzzleDefinition,
  index: number,
  refs: { interactionIds: Set<string> },
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  if (puzzle.type !== "gallery_reading") return;
  if (!refs.interactionIds.has(puzzle.interactionId)) {
    add(
      errors,
      "puzzle.galleryReading.interaction.missing",
      `puzzles[${index}].interactionId`,
      `Gallery reading "${puzzle.id}" references missing interaction "${puzzle.interactionId}".`,
    );
  }
  if (puzzle.paintings.length === 0) {
    add(errors, "puzzle.galleryReading.paintings.empty", `puzzles[${index}].paintings`, `Gallery reading "${puzzle.id}" needs at least one painting.`);
  }
  const paintingIds = new Set<string>();
  puzzle.paintings.forEach((painting, paintingIndex) => {
    if (paintingIds.has(painting.id)) {
      add(
        errors,
        "puzzle.galleryReading.painting.duplicate",
        `puzzles[${index}].paintings[${paintingIndex}].id`,
        `Gallery reading "${puzzle.id}" duplicates painting id "${painting.id}".`,
      );
    }
    paintingIds.add(painting.id);
    if (painting.lines.length === 0) {
      add(
        errors,
        "puzzle.galleryReading.painting.lines.empty",
        `puzzles[${index}].paintings[${paintingIndex}].lines`,
        `Gallery reading "${puzzle.id}" painting "${painting.id}" needs at least one archive line.`,
      );
    }
  });

  const perRun = puzzle.questionsPerRun;
  if (perRun !== undefined && (!Number.isInteger(perRun) || perRun < 3 || perRun > 6)) {
    add(
      errors,
      "puzzle.galleryReading.questionsPerRun.invalid",
      `puzzles[${index}].questionsPerRun`,
      `Gallery reading "${puzzle.id}" questionsPerRun must be an integer from 3 to 6.`,
    );
  }
  const minQuestions = Math.max(3, perRun ?? 3);
  if (puzzle.questions.length < minQuestions) {
    add(
      errors,
      "puzzle.galleryReading.questions.tooFew",
      `puzzles[${index}].questions`,
      `Gallery reading "${puzzle.id}" needs at least ${minQuestions} questions to fill a run.`,
    );
  }

  const questionIds = new Set<string>();
  puzzle.questions.forEach((question, questionIndex) => {
    const path = `puzzles[${index}].questions[${questionIndex}]`;
    if (questionIds.has(question.id)) {
      add(errors, "puzzle.galleryReading.question.duplicate", `${path}.id`, `Gallery reading "${puzzle.id}" duplicates question id "${question.id}".`);
    }
    questionIds.add(question.id);
    if (question.choices.length < 3 || question.choices.length > 6) {
      add(errors, "puzzle.galleryReading.choices.count", `${path}.choices`, `Gallery reading "${puzzle.id}" question "${question.id}" must offer 3-6 choices.`);
    }
    const choiceIds = new Set<string>();
    question.choices.forEach((choice, choiceIndex) => {
      if (choiceIds.has(choice.id)) {
        add(errors, "puzzle.galleryReading.choice.duplicate", `${path}.choices[${choiceIndex}].id`, `Gallery reading "${puzzle.id}" question "${question.id}" duplicates choice "${choice.id}".`);
      }
      choiceIds.add(choice.id);
    });
    if (!choiceIds.has(question.answerId)) {
      add(errors, "puzzle.galleryReading.answer.missing", `${path}.answerId`, `Gallery reading "${puzzle.id}" question "${question.id}" answerId "${question.answerId}" is not among its choices.`);
    }
    question.paintingIds?.forEach((paintingId, refIndex) => {
      if (!paintingIds.has(paintingId)) {
        add(warnings, "puzzle.galleryReading.question.painting.missing", `${path}.paintingIds[${refIndex}]`, `Gallery reading "${puzzle.id}" question "${question.id}" references unknown painting "${paintingId}".`);
      }
    });
  });

  if (puzzle.requiredCorrect !== undefined && (!Number.isInteger(puzzle.requiredCorrect) || puzzle.requiredCorrect <= 0)) {
    add(errors, "puzzle.galleryReading.requiredCorrect.invalid", `puzzles[${index}].requiredCorrect`, `Gallery reading "${puzzle.id}" requiredCorrect must be a positive integer.`);
  }
  if (puzzle.maxMistakes !== undefined && (!Number.isInteger(puzzle.maxMistakes) || puzzle.maxMistakes <= 0)) {
    add(errors, "puzzle.galleryReading.maxMistakes.invalid", `puzzles[${index}].maxMistakes`, `Gallery reading "${puzzle.id}" maxMistakes must be a positive integer.`);
  }
}

function validateFormulaDefinition(
  formula: NonNullable<Extract<LevelPuzzleDefinition, { type: "code_lock" }>["code"]["formula"]> | undefined,
  path: string,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
  inputLength?: number,
) {
  if (!formula) {
    add(errors, "formula.missing", path, "Formula code needs a formula definition.");
    return;
  }
  if (!formula.expression) {
    add(errors, "formula.expression.missing", `${path}.expression`, "Formula needs an arithmetic expression.");
  } else if (!/^[\d+\-*/()\s]+$/.test(formula.expression)) {
    add(errors, "formula.expression.invalid", `${path}.expression`, "Formula expression can only contain digits, spaces, +, -, *, /, and parentheses.");
  }
  if (formula.answer && !/^\d+$/.test(formula.answer)) {
    add(errors, "formula.answer.invalid", `${path}.answer`, "Formula answer must contain digits only.");
  }
  if (inputLength && formula.answer && formula.answer.length < inputLength) {
    add(warnings, "formula.answer.short", `${path}.answer`, "Formula answer is shorter than the code input length and will be padded with zeroes.");
  }
  if (formula.padLength !== undefined && formula.padLength <= 0) {
    add(warnings, "formula.pad.invalid", `${path}.padLength`, "Formula padLength should be positive.");
  }
}
