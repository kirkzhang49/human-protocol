import type { LevelInteractionDefinition, LevelMapPropDefinition } from "../../game/config/schema/levelConfig";
import { interactionVisualModelKey } from "../../game/visual/intents/InteractionVisualIntent";

export type BuilderInteractionBakeMode =
  | "hidden"
  | "hosted_prop"
  | "standalone"
  | "exit_trigger_only"
  | "exit_floor_pad"
  | "exit_floor_pad_plus_panel";

export interface BuilderInteractionBakeIntent {
  mode: BuilderInteractionBakeMode;
  modelKey: string | null;
  bakeStandalone: boolean;
  bakeExitFloorPad: boolean;
  bakeExitPanel: boolean;
}

export interface BuilderInteractionBakeOptions {
  hasPuzzleMachine?: boolean;
  hasExitButtonProp?: boolean;
}

const EXIT_BUTTON_PANEL_MODEL_KEYS = new Set(["terminal_code_keypad", "switch_panel_wall_cyan", "service_elevator_call_buttons"]);

export function resolveBuilderInteractionBakeIntent(
  interaction: LevelInteractionDefinition,
  options: BuilderInteractionBakeOptions = {},
): BuilderInteractionBakeIntent {
  const modelKey = interactionVisualModelKey(interaction);
  if (interaction.type === "exit") {
    if (options.hasExitButtonProp || interaction.visualKey === "service_elevator_panel") {
      return {
        mode: "exit_trigger_only",
        modelKey: null,
        bakeStandalone: false,
        bakeExitFloorPad: false,
        bakeExitPanel: false,
      };
    }
    return {
      mode: modelKey ? "exit_floor_pad_plus_panel" : "exit_floor_pad",
      modelKey,
      bakeStandalone: Boolean(modelKey),
      bakeExitFloorPad: true,
      bakeExitPanel: Boolean(modelKey),
    };
  }
  if (interaction.visualKey === "none" || interaction.type === "pickup_story") {
    return {
      mode: interaction.anchorPropId ? "hosted_prop" : "hidden",
      modelKey: null,
      bakeStandalone: false,
      bakeExitFloorPad: false,
      bakeExitPanel: false,
    };
  }
  if (options.hasPuzzleMachine && interaction.anchorPropId) {
    return {
      mode: "hosted_prop",
      modelKey: null,
      bakeStandalone: false,
      bakeExitFloorPad: false,
      bakeExitPanel: false,
    };
  }
  return {
    mode: "standalone",
    modelKey,
    bakeStandalone: true,
    bakeExitFloorPad: false,
    bakeExitPanel: false,
  };
}

export function closestVisiblePropId(
  roomId: string,
  x: number,
  z: number,
  props: readonly LevelMapPropDefinition[],
  maxDistance: number,
): string | undefined {
  let best: { id: string; distance: number } | null = null;
  for (const prop of props) {
    if (prop.roomId !== roomId || prop.initiallyVisible === false) continue;
    const distance = Math.hypot(prop.position[0] - x, prop.position[2] - z);
    if (distance > maxDistance) continue;
    if (!best || distance < best.distance) best = { id: prop.id, distance };
  }
  return best?.id;
}

export function sourceHostPropForInteraction(
  interaction: LevelInteractionDefinition,
  props: readonly LevelMapPropDefinition[],
): { hostPropId: string } | undefined {
  if (interaction.anchorPropId) return { hostPropId: interaction.anchorPropId };
  if (interaction.visualKey !== "none") return undefined;
  const propId = closestVisiblePropId(
    interaction.roomId,
    interaction.position[0],
    interaction.position[2],
    props,
    interaction.radius,
  );
  return propId ? { hostPropId: propId } : undefined;
}

export function isExitButtonPanelProp(prop: LevelMapPropDefinition) {
  if (prop.tags?.includes("button_panel")) return true;
  if (prop.id === "builder_exit_elevator_button_panel") return true;
  if (!EXIT_BUTTON_PANEL_MODEL_KEYS.has(prop.modelKey)) return false;
  return /电梯|elevator|exit/i.test(prop.label ?? "");
}

export function sourceAnchorPropForTarget(
  roomId: string,
  x: number,
  z: number,
  props: readonly LevelMapPropDefinition[],
  maxDistance = 0.75,
): { anchorPropId: string } | undefined {
  const propId = closestVisiblePropId(roomId, x, z, props, maxDistance);
  return propId ? { anchorPropId: propId } : undefined;
}
