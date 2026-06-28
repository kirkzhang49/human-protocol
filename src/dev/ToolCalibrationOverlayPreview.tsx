import { createRoot } from "react-dom/client";
import { level03Puzzles } from "../game/config/levels/level03-human-museum/puzzles";
import type { LevelToolCalibrationPuzzleDefinition } from "../game/config/schema/levelConfig";
import type { GameWorld } from "../game/core/GameWorld";
import "../styles/overlays.css";
import { ToolCalibrationOverlay } from "../ui/ToolCalibrationOverlay";

const puzzle = level03Puzzles.find((entry) => entry.id === "level_03_tool_calibration") as LevelToolCalibrationPuzzleDefinition;
const params = new URLSearchParams(window.location.search);
const variant = params.get("variant");
const previewPuzzle =
  variant === "base"
    ? { ...puzzle, variants: [] }
    : variant === "connected"
      ? {
          ...puzzle,
          variants: [
            {
              id: "preview_connected_after_core",
              solutionMoveCount: 0,
              rotationOverrides: [
                { x: 4, y: 2, rotation: 2 },
                { x: 4, y: 1, rotation: 1 },
              ],
            },
          ],
        }
      : puzzle;

const world = {
  settings: { language: "zh" as const },
  activeToolCalibrationPuzzle: () => previewPuzzle,
  closeToolCalibration: () => {},
  submitToolCalibration: () => false,
  configText: (text: string) => text,
} as unknown as GameWorld;

createRoot(document.getElementById("root")!).render(<ToolCalibrationOverlay world={world} />);
