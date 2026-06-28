import { modelKeyForInteraction } from "../../assets/environmentModelAssets";
import type {
  LevelDefinition,
  LevelInteractionDefinition,
  LevelPuzzleActorDefinition,
  LevelPuzzleTargetDefinition,
} from "../../game/config/schema/levelConfig";
import { builderRuntimeSurfaceModelKeys, roomCeiling } from "../BuilderEnvironment";
import { builderPuzzleKindForRuntimeType, puzzleConsoleModelKey } from "../BuilderPuzzleRuntimeRegistry";
import type { BuilderProject, BuilderPuzzleKind } from "../BuilderTypes";
import { isExitButtonPanelProp, resolveBuilderInteractionBakeIntent, type BuilderInteractionBakeIntent } from "./InteractionHostBridge";
import { puzzleActorFromHitSequenceTarget, puzzleActorsForLevelPuzzle } from "./PuzzleActorBridge";
import { resolvePuzzleActorVisualIntent, type BuilderPuzzleTargetVisualIntent } from "./PuzzleVisualBridge";
import type { BuilderSurfaceModelKeys } from "./SurfaceKitBridge";

export interface ResolvedBuilderRoomBake {
  roomId: string;
  surfaceModelKeys: BuilderSurfaceModelKeys;
  ceilingVisible: boolean;
}

export interface ResolvedBuilderPuzzleMachineBake {
  puzzleId: string;
  interactionId: string;
  kind: BuilderPuzzleKind;
  modelKey: string;
}

export interface ResolvedBuilderInteractionBake {
  interaction: LevelInteractionDefinition;
  intent: BuilderInteractionBakeIntent;
  hasPuzzleMachine: boolean;
  puzzleMachine: ResolvedBuilderPuzzleMachineBake | null;
  modelKey: string | null;
}

export interface ResolvedBuilderPuzzleTargetBake {
  puzzleId: string;
  target: LevelPuzzleTargetDefinition;
  actor: LevelPuzzleActorDefinition;
  visual: BuilderPuzzleTargetVisualIntent;
}

export interface ResolvedBuilderPuzzleActorBake {
  puzzleId: string;
  actor: LevelPuzzleActorDefinition;
}

export interface ResolvedBuilderBakePlan {
  rooms: ResolvedBuilderRoomBake[];
  puzzleMachines: ResolvedBuilderPuzzleMachineBake[];
  interactions: ResolvedBuilderInteractionBake[];
  puzzleActors: ResolvedBuilderPuzzleActorBake[];
  puzzleTargets: ResolvedBuilderPuzzleTargetBake[];
  routeSwitchInteractionIds: ReadonlySet<string>;
}

export function resolveBuilderBakePlan(level: LevelDefinition, project: BuilderProject): ResolvedBuilderBakePlan {
  const puzzleMachineByInteraction = collectPuzzleMachines(level);
  const routeSwitchInteractionIds = collectRouteSwitchInteractionIds(level);
  const exitButtonPanelRooms = new Set((level.map?.props ?? []).filter(isExitButtonPanelProp).map((prop) => prop.roomId));

  const rooms = project.rooms.map((room): ResolvedBuilderRoomBake => ({
    roomId: room.id,
    surfaceModelKeys: builderRuntimeSurfaceModelKeys(room),
    ceilingVisible: roomCeiling(room).visible,
  }));

  const interactions = (level.map?.interactions ?? []).map((interaction): ResolvedBuilderInteractionBake => {
    const puzzleMachine = puzzleMachineByInteraction.get(interaction.id) ?? null;
    const intent = resolveBuilderInteractionBakeIntent(interaction, {
      hasPuzzleMachine: Boolean(puzzleMachine),
      hasExitButtonProp: interaction.type === "exit" && exitButtonPanelRooms.has(interaction.roomId),
    });
    const modelKey = intent.bakeStandalone || intent.bakeExitPanel ? modelKeyForInteraction(interaction) : null;
    return {
      interaction,
      intent,
      hasPuzzleMachine: Boolean(puzzleMachine),
      puzzleMachine,
      modelKey,
    };
  });

  const puzzleActors: ResolvedBuilderPuzzleActorBake[] = [];
  const puzzleTargets: ResolvedBuilderPuzzleTargetBake[] = [];
  for (const puzzle of level.puzzles ?? []) {
    const actors = puzzleActorsForLevelPuzzle(puzzle);
    puzzleActors.push(...actors.map((actor) => ({ puzzleId: puzzle.id, actor })));
    if (puzzle.type !== "hit_sequence") continue;
    const actorByTargetId = new Map(actors.map((actor) => [actor.targetId ?? actor.id, actor]));
    for (const target of puzzle.targets) {
      const actor = actorByTargetId.get(target.id) ?? puzzleActorFromHitSequenceTarget(target);
      puzzleTargets.push({
        puzzleId: puzzle.id,
        target,
        actor,
        visual: resolvePuzzleActorVisualIntent(actor),
      });
    }
  }

  return {
    rooms,
    puzzleMachines: [...puzzleMachineByInteraction.values()],
    interactions,
    puzzleActors,
    puzzleTargets,
    routeSwitchInteractionIds,
  };
}

function collectRouteSwitchInteractionIds(level: LevelDefinition) {
  const interactionsById = new Map((level.map?.interactions ?? []).map((interaction) => [interaction.id, interaction]));
  const routeSwitchInteractionIds = new Set<string>();
  for (const switchDefinition of level.switches ?? []) {
    if (isRouteSwitchDefinition(switchDefinition, interactionsById.get(switchDefinition.interactionId) ?? null)) {
      routeSwitchInteractionIds.add(switchDefinition.interactionId);
    }
  }
  return routeSwitchInteractionIds;
}

function isRouteSwitchDefinition(
  switchDefinition: NonNullable<LevelDefinition["switches"]>[number],
  interaction: LevelInteractionDefinition | null,
) {
  if (switchDefinition.presentation?.kind === "route_console") return true;
  if (switchDefinition.presentation?.kind === "wall_button" || switchDefinition.presentation?.kind === "wall_lever") return false;
  if (interaction?.visualKey === "wall_door_switch_button") return false;
  if (interaction?.visualKey === "direction_keypad_panel" && Boolean(interaction.consumesKeyItemId)) return true;
  return switchDefinition.id.startsWith("route_") || switchDefinition.interactionId.startsWith("route_");
}

function collectPuzzleMachines(level: LevelDefinition) {
  const machines = new Map<string, ResolvedBuilderPuzzleMachineBake>();
  for (const puzzle of level.puzzles ?? []) {
    const kind = builderPuzzleKindForRuntimeType(puzzle.type);
    if (!kind) continue;
    const interactionId = puzzle.type === "hit_sequence" ? puzzle.clue.interactionId : "interactionId" in puzzle ? puzzle.interactionId : null;
    if (!interactionId) continue;
    machines.set(interactionId, {
      puzzleId: puzzle.id,
      interactionId,
      kind,
      modelKey: puzzleConsoleModelKey(kind),
    });
  }
  return machines;
}
