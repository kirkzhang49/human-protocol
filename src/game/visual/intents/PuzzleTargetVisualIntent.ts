import type { LevelPuzzleColorKey, LevelPuzzleTargetDefinition } from "../../config/schema/levelConfig";

const puzzleColorKeys: readonly LevelPuzzleColorKey[] = ["red", "blue", "green", "yellow", "purple", "white", "cyan"];
const puzzleColorKeySet = new Set<LevelPuzzleColorKey>(puzzleColorKeys);

const puzzleOrbModelKeys: Partial<Record<LevelPuzzleColorKey, string>> = {
  blue: "age_museum_puzzle_orb_blue",
  green: "age_museum_puzzle_orb_green",
  purple: "age_museum_puzzle_orb_purple",
  red: "age_museum_puzzle_orb_red",
  white: "age_museum_puzzle_orb_white",
  yellow: "age_museum_puzzle_orb_yellow",
};

export const freePuzzleOrbModelKeys: Record<LevelPuzzleColorKey, string> = {
  red: "puzzle_orb_free_red",
  blue: "puzzle_orb_free_blue",
  green: "puzzle_orb_free_green",
  yellow: "puzzle_orb_free_yellow",
  purple: "puzzle_orb_free_purple",
  white: "puzzle_orb_free_white",
  cyan: "puzzle_orb_free_cyan",
};

export function puzzleOrbVisualKey(colorKey: LevelPuzzleColorKey) {
  return `puzzle_orb_${colorKey}`;
}

export function puzzleOrbModelKeyForVisualKey(visualKey: string | undefined, colorKey?: LevelPuzzleColorKey): string | null {
  const color = puzzleOrbColorForVisualKey(visualKey, colorKey);
  if (!color) return null;
  return puzzleOrbModelKeys[color] ?? null;
}

export function freePuzzleOrbModelKeyForColor(colorKey: LevelPuzzleColorKey): string {
  return freePuzzleOrbModelKeys[colorKey];
}

export function isFreePuzzleOrbModelKey(modelKey: string | null | undefined): boolean {
  return typeof modelKey === "string" && puzzleColorKeys.some((colorKey) => freePuzzleOrbModelKeys[colorKey] === modelKey);
}

export function puzzleTargetVisualModelKey(target: Pick<LevelPuzzleTargetDefinition, "visualKey" | "colorKey" | "anchorPropId">): string | null {
  const color = puzzleOrbColorForVisualKey(target.visualKey, target.colorKey);
  if (!color) return null;
  return puzzleOrbModelKeys[color] ?? freePuzzleOrbModelKeyForColor(color);
}

function puzzleOrbColorForVisualKey(visualKey: string | undefined, colorKey?: LevelPuzzleColorKey): LevelPuzzleColorKey | null {
  if (colorKey) return colorKey;
  if (!visualKey?.startsWith("puzzle_orb_")) return null;
  const color = visualKey.replace(/^puzzle_orb_/, "");
  return isPuzzleColorKey(color) ? color : null;
}

function isPuzzleColorKey(value: string): value is LevelPuzzleColorKey {
  return puzzleColorKeySet.has(value as LevelPuzzleColorKey);
}
