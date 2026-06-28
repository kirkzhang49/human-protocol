import type {
  LevelPuzzleActorDefinition,
  LevelPuzzleColorKey,
  LevelPuzzleDefinition,
  LevelPuzzleTargetDefinition,
} from "../../game/config/schema/levelConfig";
import { puzzleOrbVisualKey } from "../../game/visual/intents/PuzzleTargetVisualIntent";
import { puzzleComponentY } from "../BuilderPuzzlePlacement";
import type { BuilderPuzzleComponent } from "../BuilderTypes";

export function puzzleActorFromHitSequenceTarget(target: LevelPuzzleTargetDefinition): LevelPuzzleActorDefinition {
  return {
    id: target.id,
    role: `orb:${target.colorKey}`,
    kind: "target",
    roomId: target.roomId,
    position: target.position,
    visualKey: target.visualKey,
    ...(target.materialKey ? { materialKey: target.materialKey } : {}),
    colorKey: target.colorKey,
    inputMode: "weapon_hit",
    hitbox: { shape: "sphere", radius: target.radius },
    ...(target.anchorPropId ? { anchorPropId: target.anchorPropId } : {}),
    targetId: target.id,
  };
}

export function puzzleActorFromBuilderComponent(
  component: BuilderPuzzleComponent,
  colorKey: LevelPuzzleColorKey,
): LevelPuzzleActorDefinition {
  const actor = component.sourceActor;
  const actorColorKey = actor?.colorKey ?? colorKey;
  const y = puzzleComponentY(component);
  return {
    id: actor?.id ?? component.sourceTarget?.id ?? component.id,
    role: actor?.role ?? `orb:${actorColorKey}`,
    kind: actor?.kind ?? "target",
    roomId: component.roomId,
    position: [component.position[0], y, component.position[1]],
    ...(actor?.rotation ? { rotation: actor.rotation } : component.rotationY !== undefined ? { rotation: [0, component.rotationY, 0] as [number, number, number] } : {}),
    visualKey: actor?.visualKey ?? component.sourceTarget?.visualKey ?? puzzleOrbVisualKey(actorColorKey),
    ...(actor?.materialKey || component.sourceTarget?.materialKey ? { materialKey: actor?.materialKey ?? component.sourceTarget?.materialKey } : {}),
    colorKey: actorColorKey,
    inputMode: actor?.inputMode ?? "weapon_hit",
    hitbox: actor?.hitbox ?? { shape: "sphere", radius: component.sourceTarget?.radius ?? 0.72 },
    ...(actor?.anchorPropId || component.sourceTarget?.anchorPropId ? { anchorPropId: actor?.anchorPropId ?? component.sourceTarget?.anchorPropId } : {}),
    ...(actor?.interactionId ? { interactionId: actor.interactionId } : {}),
    targetId: actor?.targetId ?? component.sourceTarget?.id ?? component.id,
    ...(actor?.stateKey ? { stateKey: actor.stateKey } : {}),
  };
}

export function colorPuzzleTargetFromPuzzleActor(
  actor: LevelPuzzleActorDefinition,
  colorKey: LevelPuzzleColorKey,
  label: string,
): LevelPuzzleTargetDefinition {
  return {
    id: actor.targetId ?? actor.id,
    label,
    roomId: actor.roomId,
    position: actor.position,
    radius: actor.hitbox?.shape === "sphere" && actor.hitbox.radius ? actor.hitbox.radius : 0.72,
    colorKey,
    visualKey: actor.visualKey ?? puzzleOrbVisualKey(colorKey),
    ...(actor.materialKey ? { materialKey: actor.materialKey } : {}),
    ...(actor.anchorPropId ? { anchorPropId: actor.anchorPropId } : {}),
  };
}

export function puzzleActorsForLevelPuzzle(puzzle: LevelPuzzleDefinition): LevelPuzzleActorDefinition[] {
  const actors = [...(puzzle.actors ?? [])];
  if (puzzle.type !== "hit_sequence") return actors;
  const existingTargetIds = new Set(actors.map((actor) => actor.targetId ?? actor.id));
  for (const target of puzzle.targets) {
    if (!existingTargetIds.has(target.id)) actors.push(puzzleActorFromHitSequenceTarget(target));
  }
  return actors;
}
