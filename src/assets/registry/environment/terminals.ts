import type { EnvironmentModelRegistry } from "./types";
import roomTerminalWallUrl from "../../models-cooked/environment/terminals/hp_room_terminal_wall.glb?url";
import terminalArchiveReaderUrl from "../../models-cooked/environment/terminals/hp_terminal_archive_reader.glb?url";
import terminalCodeKeypadUrl from "../../models-cooked/environment/terminals/hp_terminal_code_keypad.glb?url";
import terminalDirectionRingUrl from "../../models-cooked/environment/terminals/hp_terminal_direction_ring.glb?url";
import terminalPuzzleBigScreenUrl from "../../models-cooked/environment/terminals/hp_terminal_puzzle_big_screen.glb?url";
import terminalQuizPanelCyanUrl from "../../models-cooked/environment/terminals/hp_terminal_quiz_panel_cyan.glb?url";
import terminalQuizPanelRedUrl from "../../models-cooked/environment/terminals/hp_terminal_quiz_panel_red.glb?url";

export const terminalEnvironmentModelAssets = {
  room_terminal_wall: {
    modelKey: "room_terminal_wall",
    url: roomTerminalWallUrl,
    category: "interaction",
    sizeMeters: [0.98, 1.0, 0.2],
  },
  terminal_archive_reader: {
    modelKey: "terminal_archive_reader",
    url: terminalArchiveReaderUrl,
    category: "interaction",
    sizeMeters: [0.9, 1.2, 0.38],
  },
  terminal_code_keypad: {
    modelKey: "terminal_code_keypad",
    url: terminalCodeKeypadUrl,
    category: "interaction",
    sizeMeters: [0.62, 0.92, 0.18],
  },
  terminal_direction_ring: {
    modelKey: "terminal_direction_ring",
    url: terminalDirectionRingUrl,
    category: "interaction",
    sizeMeters: [0.84, 0.84, 0.16],
  },
  terminal_puzzle_big_screen: {
    modelKey: "terminal_puzzle_big_screen",
    url: terminalPuzzleBigScreenUrl,
    category: "interaction",
    sizeMeters: [2.4, 1.55, 0.34],
  },
  terminal_quiz_panel_cyan: {
    modelKey: "terminal_quiz_panel_cyan",
    url: terminalQuizPanelCyanUrl,
    category: "interaction",
    sizeMeters: [0.82, 1.18, 0.18],
  },
  terminal_quiz_panel_red: {
    modelKey: "terminal_quiz_panel_red",
    url: terminalQuizPanelRedUrl,
    category: "interaction",
    sizeMeters: [0.82, 1.18, 0.18],
  },
} as const satisfies EnvironmentModelRegistry;
