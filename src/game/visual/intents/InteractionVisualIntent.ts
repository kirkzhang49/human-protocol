import type { LevelInteractionDefinition } from "../../config/schema/levelConfig";

export type InteractionVisualModelKey = string;

const dedicatedPuzzleConsoleVisualKeys = new Set([
  "puzzle_console_archive_merge",
  "puzzle_console_circuit_grid",
  "puzzle_console_color_sequence",
  "puzzle_console_gallery_reading",
  "puzzle_console_surveillance_match",
  "puzzle_console_valve_matrix",
]);

export function interactionVisualModelKey(interaction: LevelInteractionDefinition): InteractionVisualModelKey | null {
  if (interaction.visualKey === "none") return null;
  if (interaction.type === "pickup_story") return null;
  if (interaction.type === "article") return "prop_archive_book_open";
  if (interaction.type === "quiz") return interaction.materialKey === "terminal_red" ? "terminal_quiz_panel_red" : "terminal_quiz_panel_cyan";
  if (interaction.type === "big_screen") return "terminal_puzzle_big_screen";
  if (interaction.visualKey === "wall_door_switch_button") return "hp_wall_door_switch_button_v1";
  if (dedicatedPuzzleConsoleVisualKeys.has(interaction.visualKey)) return interaction.visualKey;
  if (interaction.type === "switch" && isRouteSwitchInteraction(interaction)) return "builder_route_switch_console";
  if (interaction.type === "switch") return interaction.materialKey === "terminal_red" ? "switch_panel_wall_red" : "switch_panel_wall_cyan";
  if (interaction.type === "door_panel") return "terminal_code_keypad";
  if (interaction.type === "exit") {
    if (interaction.visualKey === "service_elevator_panel") return null;
    if (interaction.visualKey === "exit_panel") return "terminal_code_keypad";
    return null;
  }
  if (interaction.visualKey === "three_color_order_panel") return "terminal_direction_ring";
  if (interaction.visualKey === "archive_book") return "prop_archive_book_open";
  if (interaction.visualKey.includes("terminal") || interaction.type === "terminal" || interaction.type === "memory_echo") {
    return "terminal_archive_reader";
  }
  if (interaction.type === "repair_panel" || interaction.type === "inspect") return "room_terminal_wall";
  return "room_terminal_wall";
}

export function isRouteSwitchInteraction(interaction: LevelInteractionDefinition) {
  const label = interaction.label ?? "";
  return (
    interaction.id.startsWith("route_") ||
    interaction.consumesKeyItemId?.startsWith("route_") ||
    label.includes("路由") ||
    label.includes("管制")
  );
}
