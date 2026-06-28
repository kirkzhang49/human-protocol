import type { LevelPuzzleActorDefinition, LevelPuzzleColorKey, LevelPuzzleTargetDefinition } from "../../game/config/schema/levelConfig";
import { puzzleOrbVisualKey, puzzleTargetVisualModelKey } from "../../game/visual/intents/PuzzleTargetVisualIntent";
import { builderPuzzleColors } from "../BuilderAssetCatalog";
import type { BuilderPuzzleComponent } from "../BuilderTypes";
import {
  colorPuzzleTargetFromPuzzleActor,
  puzzleActorFromBuilderComponent,
  puzzleActorFromHitSequenceTarget,
} from "./PuzzleActorBridge";

type BuilderTuple3 = [number, number, number];

export interface BuilderPuzzleTargetVisualIntent {
  colorKey: LevelPuzzleColorKey;
  colorHex: string;
  modelKey: string | null;
  visualKey: string;
  proxyHalfSize: BuilderTuple3;
  lightPosition: BuilderTuple3;
}

export function colorPuzzleTargetFromBuilderComponent(
  component: BuilderPuzzleComponent,
  colorKey: LevelPuzzleColorKey,
): LevelPuzzleTargetDefinition {
  const actor = puzzleActorFromBuilderComponent(component, colorKey);
  const actorColorKey = actor.colorKey ?? colorKey;
  return colorPuzzleTargetFromPuzzleActor(actor, actorColorKey, component.sourceTarget?.label ?? `${builderPuzzleColorLabel(actorColorKey)}色球`);
}

export function resolvePuzzleTargetVisualIntent(target: LevelPuzzleTargetDefinition): BuilderPuzzleTargetVisualIntent {
  const actor = puzzleActorFromHitSequenceTarget(target);
  return resolvePuzzleActorVisualIntent(actor);
}

export function resolvePuzzleActorVisualIntent(actor: LevelPuzzleActorDefinition): BuilderPuzzleTargetVisualIntent {
  const colorKey = actor.colorKey ?? "red";
  const visualKey = actor.visualKey ?? puzzleOrbVisualKey(colorKey);
  const radius = actor.hitbox?.shape === "sphere" ? actor.hitbox.radius ?? 0.72 : 0.72;
  const visualHalfWidth = Math.max(0.32, Math.min(0.42, (radius ?? 0.72) * 0.48));
  return {
    colorKey,
    colorHex: builderPuzzleColorHex(colorKey),
    modelKey: puzzleTargetVisualModelKey({ visualKey, colorKey, anchorPropId: actor.anchorPropId }),
    visualKey,
    proxyHalfSize: [
      visualHalfWidth,
      Math.max(0.74, actor.position[1] + 0.26) / 2,
      visualHalfWidth,
    ],
    lightPosition: [actor.position[0], actor.position[1] + 0.4, actor.position[2]],
  };
}

function builderPuzzleColorLabel(colorKey: LevelPuzzleColorKey) {
  return builderPuzzleColors.find((entry) => entry.colorKey === colorKey)?.label ?? colorKey;
}

function builderPuzzleColorHex(colorKey: LevelPuzzleColorKey) {
  return builderPuzzleColors.find((entry) => entry.colorKey === colorKey)?.hex ?? "#ff5b4c";
}
