import type {
  LevelAuthoringProfile,
  LevelDefinition,
} from "./schema/levelConfig";
import { validateGeneratedAuthoringBoundary } from "./validation/authoringValidator";
import { estimateActiveEnemyBudget, validateCombatLimits, validateWaves } from "./validation/combatValidator";
import { validateMap } from "./validation/mapValidator";
import { validateBossPhases, validateCampaignRoutes, validateChoices, validateEnvironmentStates, validateObjectiveChain } from "./validation/progressionValidator";
import { explainPuzzle, validatePuzzleGraph, type PuzzleGraphExplanation } from "./validation/puzzleGraphValidator";
import { validateArticlesAndQuizzes, validateBigScreens, validatePuzzles, validateSwitches } from "./validation/puzzleValidator";
import { validateRuntimeEvents } from "./validation/runtimeEventValidator";
import {
  addIssue as add,
  type ConfigValidationIssue,
} from "./validation/issues";
export { explainPuzzle } from "./validation/puzzleGraphValidator";
export type {
  PuzzleGraphExplanation,
  PuzzleGraphLock,
  PuzzleGraphPlanStep,
  PuzzleGraphPuzzle,
  PuzzleGraphReachability,
  PuzzleGraphSoftlock,
  PuzzleGraphStep,
} from "./validation/puzzleGraphValidator";
export type { ConfigValidationIssue } from "./validation/issues";

export interface ConfigValidationReport {
  ok: boolean;
  errors: ConfigValidationIssue[];
  warnings: ConfigValidationIssue[];
  budget: {
    estimatedActiveEnemies: number;
    estimatedAssetMb: number;
    criticalPathRooms: number;
  };
  graph: PuzzleGraphExplanation;
}

export interface ConfigValidationOptions {
  authoringProfile?: LevelAuthoringProfile;
}

export function validateLevelConfig(level: LevelDefinition, options: ConfigValidationOptions = {}): ConfigValidationReport {
  const errors: ConfigValidationIssue[] = [];
  const warnings: ConfigValidationIssue[] = [];
  const graph = explainPuzzle(level);
  const authoringProfile = options.authoringProfile ?? level.authoringProfile ?? "internal";

  if (!level.id) add(errors, "level.id.missing", "id", "Level id is required.");
  if (!level.title) add(warnings, "level.title.missing", "title", "Level title is empty.");
  if (!level.map) {
    add(warnings, "map.missing", "map", "Level has no map config; complex room/door generation will be unavailable.");
  } else {
    validateMap(level, level.map, errors, warnings);
  }

  validatePuzzles(level, errors, warnings);
  validateArticlesAndQuizzes(level, errors, warnings);
  validateSwitches(level, errors, warnings);
  validateBigScreens(level, errors, warnings);
  validateChoices(level, errors, warnings);
  validateCampaignRoutes(level, errors, warnings);
  validateEnvironmentStates(level, errors, warnings);
  validateBossPhases(level, errors, warnings);
  validateObjectiveChain(level, errors, warnings);
  validateWaves(level, errors, warnings);
  validateRuntimeEvents(level, errors, warnings);
  validatePuzzleGraph(level, graph, errors, warnings);
  validateCombatLimits(level, warnings);
  if (authoringProfile === "generated") validateGeneratedAuthoringBoundary(level, errors, warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    budget: {
      estimatedActiveEnemies: estimateActiveEnemyBudget(level),
      estimatedAssetMb: 0,
      criticalPathRooms: level.map?.navigation.criticalPathRoomIds.length ?? 0,
    },
    graph,
  };
}

export function assertValidLevelConfig(level: LevelDefinition, options?: ConfigValidationOptions) {
  const report = validateLevelConfig(level, options);
  if (!report.ok) {
    const details = report.errors.map((error) => `${error.path}: ${error.message}`).join("\n");
    throw new Error(`Invalid level config ${level.id}\n${details}`);
  }
  return report;
}
