import type { EnvironmentModelRegistry } from "./types";
import builderRouteSwitchConsoleUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_builder_route_switch_console.glb?url";
import wallDoorSwitchButtonUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_wall_door_switch_button_v1.glb?url";
import puzzleConsoleArchiveMergeUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_archive_merge.glb?url";
import puzzleConsoleCircuitGridUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_circuit_grid.glb?url";
import puzzleConsoleColorSequenceUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_color_sequence.glb?url";
import puzzleConsoleGalleryReadingUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_gallery_reading.glb?url";
import puzzleConsoleSurveillanceMatchUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_surveillance_match.glb?url";
import puzzleConsoleValveMatrixUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_valve_matrix.glb?url";
import puzzleOrbPedestalUrl from "../../models-cooked/environment/builder-puzzle-machines/hp_puzzle_orb_pedestal.glb?url";

export const builderPuzzleMachineEnvironmentModelAssets = {
  builder_route_switch_console: {
    modelKey: "builder_route_switch_console",
    url: builderRouteSwitchConsoleUrl,
    category: "interaction",
    sizeMeters: [1.2, 0.98, 0.77],
  },
  hp_wall_door_switch_button_v1: {
    modelKey: "hp_wall_door_switch_button_v1",
    url: wallDoorSwitchButtonUrl,
    category: "interaction",
    sizeMeters: [0.49, 0.85, 0.29],
  },
  puzzle_console_color_sequence: {
    modelKey: "puzzle_console_color_sequence",
    url: puzzleConsoleColorSequenceUrl,
    category: "interaction",
    sizeMeters: [1.34, 1.69, 0.42],
  },
  puzzle_console_circuit_grid: {
    modelKey: "puzzle_console_circuit_grid",
    url: puzzleConsoleCircuitGridUrl,
    category: "interaction",
    sizeMeters: [0.98, 1.87, 0.48],
  },
  puzzle_console_archive_merge: {
    modelKey: "puzzle_console_archive_merge",
    url: puzzleConsoleArchiveMergeUrl,
    category: "interaction",
    sizeMeters: [1.08, 1.67, 0.53],
  },
  puzzle_console_gallery_reading: {
    modelKey: "puzzle_console_gallery_reading",
    url: puzzleConsoleGalleryReadingUrl,
    category: "interaction",
    sizeMeters: [0.92, 2.04, 0.58],
  },
  puzzle_console_surveillance_match: {
    modelKey: "puzzle_console_surveillance_match",
    url: puzzleConsoleSurveillanceMatchUrl,
    category: "interaction",
    sizeMeters: [1.04, 1.72, 0.48],
  },
  puzzle_console_valve_matrix: {
    modelKey: "puzzle_console_valve_matrix",
    url: puzzleConsoleValveMatrixUrl,
    category: "interaction",
    sizeMeters: [1.71, 1.53, 0.55],
  },
  puzzle_orb_pedestal: {
    modelKey: "puzzle_orb_pedestal",
    url: puzzleOrbPedestalUrl,
    category: "interaction",
    sizeMeters: [0.52, 1.1, 0.52],
  },
} as const satisfies EnvironmentModelRegistry;
