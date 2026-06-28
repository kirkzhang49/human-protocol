import type { LevelDefinition, LevelRuntimeEventAction } from "../../game/config/schema/levelConfig";
import type { BuilderProject } from "../BuilderTypes";
import { resolveBuilderBakePlan, type ResolvedBuilderBakePlan } from "./ResolvedBakePlan";

export type OfficialBridgeAuditSeverity = "error" | "warning";

export interface OfficialBridgeAuditIssue {
  severity: OfficialBridgeAuditSeverity;
  code: string;
  path: string;
  message: string;
}

export interface OfficialBridgeAuditReport {
  issues: OfficialBridgeAuditIssue[];
  errors: OfficialBridgeAuditIssue[];
  warnings: OfficialBridgeAuditIssue[];
}

export function auditBuilderOfficialBridge(
  level: LevelDefinition,
  project: BuilderProject,
  plan: ResolvedBuilderBakePlan = resolveBuilderBakePlan(level, project),
): OfficialBridgeAuditReport {
  const issues: OfficialBridgeAuditIssue[] = [];
  const addIssue = (issue: OfficialBridgeAuditIssue) => issues.push(issue);

  auditRooms(project, plan, addIssue);
  auditInteractions(plan, addIssue);
  auditPuzzleActors(level, plan, addIssue);
  auditPuzzleTargets(plan, addIssue);
  auditRouteDoorActions(level, addIssue);

  return {
    issues,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}

function auditRooms(
  project: BuilderProject,
  plan: ResolvedBuilderBakePlan,
  addIssue: (issue: OfficialBridgeAuditIssue) => void,
) {
  const bakeByRoomId = new Map(plan.rooms.map((room) => [room.roomId, room]));
  for (const room of project.rooms) {
    const bake = bakeByRoomId.get(room.id);
    if (!bake) {
      addIssue({
        severity: "error",
        code: "missing_room_bake",
        path: `rooms.${room.id}`,
        message: "Builder room has no resolved runtime surface bake.",
      });
      continue;
    }
    const keys = bake.surfaceModelKeys;
    if (!keys.floorModelKey || !keys.wallModelKey || (bake.ceilingVisible && !keys.ceilingModelKey)) {
      addIssue({
        severity: "error",
        code: "missing_surface_model",
        path: `rooms.${room.id}.env`,
        message: "Room surface kit did not resolve to floor/wall/ceiling runtime model keys.",
      });
    }
  }
}

function auditInteractions(plan: ResolvedBuilderBakePlan, addIssue: (issue: OfficialBridgeAuditIssue) => void) {
  for (const bake of plan.interactions) {
    const { interaction, intent, modelKey } = bake;
    if ((intent.bakeStandalone || intent.bakeExitPanel) && !modelKey) {
      addIssue({
        severity: "error",
        code: "missing_interaction_model",
        path: `map.interactions.${interaction.id}.visualKey`,
        message: "Interaction requests a standalone baked object, but its visual key has no environment model.",
      });
    }
    if (interaction.type === "exit" && interaction.visualKey && interaction.visualKey !== "none" && !intent.bakeExitPanel && intent.mode !== "exit_trigger_only") {
      addIssue({
        severity: "error",
        code: "missing_exit_panel",
        path: `map.interactions.${interaction.id}`,
        message: "Exit interaction has a visual key but will not bake a button/panel.",
      });
    }
    if ((interaction.visualKey === "none" || interaction.type === "pickup_story" || (bake.hasPuzzleMachine && interaction.anchorPropId)) && intent.bakeStandalone) {
      addIssue({
        severity: "error",
        code: "hosted_interaction_bakes_standalone",
        path: `map.interactions.${interaction.id}`,
        message: "Hosted interaction would bake a duplicate standalone terminal.",
      });
    }
  }
}

function auditPuzzleActors(
  level: LevelDefinition,
  plan: ResolvedBuilderBakePlan,
  addIssue: (issue: OfficialBridgeAuditIssue) => void,
) {
  const roomIds = new Set(level.map?.rooms.map((room) => room.id) ?? []);
  const interactionIds = new Set(level.map?.interactions.map((interaction) => interaction.id) ?? []);
  const propIds = new Set(level.map?.props?.map((prop) => prop.id) ?? []);
  for (const bake of plan.puzzleActors) {
    const actor = bake.actor;
    if (!roomIds.has(actor.roomId)) {
      addIssue({
        severity: "error",
        code: "puzzle_actor_missing_room",
        path: `puzzles.${bake.puzzleId}.actors.${actor.id}.roomId`,
        message: "Puzzle actor resolves to a room that does not exist.",
      });
    }
    if (actor.interactionId && !interactionIds.has(actor.interactionId)) {
      addIssue({
        severity: "error",
        code: "puzzle_actor_missing_interaction",
        path: `puzzles.${bake.puzzleId}.actors.${actor.id}.interactionId`,
        message: "Puzzle actor resolves to an interaction that does not exist.",
      });
    }
    if (actor.anchorPropId && !propIds.has(actor.anchorPropId)) {
      addIssue({
        severity: "error",
        code: "puzzle_actor_missing_anchor_prop",
        path: `puzzles.${bake.puzzleId}.actors.${actor.id}.anchorPropId`,
        message: "Puzzle actor resolves to an anchor prop that does not exist.",
      });
    }
    if (actor.hitbox?.shape === "sphere" && (actor.hitbox.radius ?? 0) <= 0) {
      addIssue({
        severity: "error",
        code: "puzzle_actor_invalid_hitbox",
        path: `puzzles.${bake.puzzleId}.actors.${actor.id}.hitbox.radius`,
        message: "Puzzle actor sphere hitbox must have a positive radius.",
      });
    }
    if (actor.hitbox?.shape === "box" && (!actor.hitbox.halfSize || actor.hitbox.halfSize.some((value) => value <= 0))) {
      addIssue({
        severity: "error",
        code: "puzzle_actor_invalid_hitbox",
        path: `puzzles.${bake.puzzleId}.actors.${actor.id}.hitbox.halfSize`,
        message: "Puzzle actor box hitbox must have positive half extents.",
      });
    }
  }
}

function auditPuzzleTargets(plan: ResolvedBuilderBakePlan, addIssue: (issue: OfficialBridgeAuditIssue) => void) {
  for (const bake of plan.puzzleTargets) {
    const { target, actor, visual } = bake;
    if (actor.roomId !== target.roomId) {
      addIssue({
        severity: "error",
        code: "puzzle_actor_target_room_mismatch",
        path: `puzzles.${bake.puzzleId}.targets.${target.id}.roomId`,
        message: "Puzzle actor room differs from the runtime hit target room.",
      });
    }
    if (actor.colorKey && actor.colorKey !== target.colorKey) {
      addIssue({
        severity: "error",
        code: "puzzle_actor_target_color_mismatch",
        path: `puzzles.${bake.puzzleId}.targets.${target.id}.colorKey`,
        message: "Puzzle actor color differs from the runtime hit target color.",
      });
    }
    if (actor.position.some((value, axis) => Math.abs(value - target.position[axis]) > 0.001)) {
      addIssue({
        severity: "error",
        code: "puzzle_actor_target_position_mismatch",
        path: `puzzles.${bake.puzzleId}.targets.${target.id}.position`,
        message: "Puzzle actor position differs from the runtime hit target position.",
      });
    }
    const expectsPuzzleOrbModel = Boolean(
      actor.anchorPropId ||
        target.anchorPropId ||
        actor.colorKey ||
        target.colorKey ||
        actor.visualKey?.startsWith("puzzle_orb_") ||
        target.visualKey?.startsWith("puzzle_orb_"),
    );
    if (expectsPuzzleOrbModel && !visual.modelKey) {
      addIssue({
        severity: "error",
        code: "missing_puzzle_target_model",
        path: `puzzles.${bake.puzzleId}.targets.${target.id}.visualKey`,
        message: "Puzzle target did not resolve to a runtime orb model.",
      });
    }
    if (visual.proxyHalfSize.some((value) => value <= 0)) {
      addIssue({
        severity: "error",
        code: "invalid_puzzle_target_proxy",
        path: `puzzles.${bake.puzzleId}.targets.${target.id}`,
        message: "Puzzle target fallback bounds must be positive.",
      });
    }
  }
}

function auditRouteDoorActions(level: LevelDefinition, addIssue: (issue: OfficialBridgeAuditIssue) => void) {
  const doorsById = new Map((level.map?.doors ?? []).map((door) => [door.id, door]));
  for (const switchDefinition of level.switches ?? []) {
    for (const state of switchDefinition.states) {
      const actions = state.actions ?? [];
      actions.forEach((action, actionIndex) => {
        if (action.type !== "open_door") return;
        const door = doorsById.get(action.doorId);
        if (!door) {
          addIssue({
            severity: "error",
            code: "route_opens_missing_door",
            path: `switches.${switchDefinition.id}.states.${state.id}.actions.${actionIndex}`,
            message: "Route switch opens a door id that does not exist in the compiled map.",
          });
          return;
        }
        const unlockIndex = findDoorActionIndex(actions, "unlock_door", door.id);
        if (!action.respectLock && door.lock.type !== "none" && (unlockIndex < 0 || unlockIndex > actionIndex)) {
          addIssue({
            severity: "error",
            code: "route_opens_locked_door_without_unlock",
            path: `switches.${switchDefinition.id}.states.${state.id}.actions.${actionIndex}`,
            message: "Route switch opens a locked door without unlocking it first.",
          });
        }
        if (door.lock.type === "objective_complete") {
          const objectiveIndex = actions.findIndex(
            (candidate) => candidate.type === "complete_objective" && candidate.objectiveId === door.lock.objectiveId,
          );
          if (objectiveIndex < 0 || objectiveIndex > unlockIndex) {
            addIssue({
              severity: "error",
              code: "route_missing_objective_completion",
              path: `switches.${switchDefinition.id}.states.${state.id}.actions.${actionIndex}`,
              message: "Route switch must complete the objective before unlocking an objective-locked door.",
            });
          }
        }
      });
    }
  }
}

function findDoorActionIndex(actions: readonly LevelRuntimeEventAction[], type: "unlock_door" | "open_door", doorId: string) {
  return actions.findIndex((action) => action.type === type && action.doorId === doorId);
}
