import type { BuilderPropEntry } from "./BuilderAssetCatalog";

/**
 * Level-design "role" of a catalog asset, surfaced as a small badge on each
 * asset card so designers search by purpose ("this room needs a story clue / a
 * light / cover") instead of by furniture name. Derived purely from real
 * catalog metadata + model-key naming conventions — no schema change, no new
 * authored fields.
 */
export type AssetRole = "story" | "puzzle" | "combat" | "light" | "exit" | "hero" | "image2";

export const ASSET_ROLE_LABEL: Record<AssetRole, string> = {
  story: "故事",
  puzzle: "谜题",
  combat: "战斗",
  light: "灯光",
  exit: "出口",
  hero: "主角",
  image2: "GUI",
};

/** Display priority — narrative/interaction roles first, quality markers last. */
const ROLE_PRIORITY: readonly AssetRole[] = ["story", "puzzle", "combat", "light", "exit", "hero", "image2"];

/** Most cards earn at most a couple of roles; cap the row so it never clutters. */
const MAX_BADGES = 3;

function has(value: string | undefined, needle: string) {
  return Boolean(value && value.includes(needle));
}

/**
 * Returns the asset's roles, ordered by display priority and capped. Every rule
 * null-guards optional fields, so a sparse entry simply earns no badge.
 */
export function deriveAssetRoles(entry: BuilderPropEntry): AssetRole[] {
  const key = entry.modelKey;
  const roles = new Set<AssetRole>();

  // story — explicit narrative group, or anything that carries clue text.
  if (entry.group === "故事线索" || (entry.clueCapacity ?? 0) > 0) roles.add("story");

  // puzzle — interactive consoles / terminals / route-control mechanisms.
  if (entry.family === "control_console" || has(key, "console") || has(key, "terminal")) roles.add("puzzle");

  // combat — core combat group, or solid crates that double as cover.
  if (entry.group === "核心" || has(key, "crate") || (entry.solid && entry.family === "storage_crate")) roles.add("combat");

  // light — emissive fixtures.
  if (has(key, "light") || has(key, "lamp")) roles.add("light");

  // exit — weak signal; only the rare model that names itself an exit.
  if (has(key, "exit")) roles.add("exit");

  // hero — Image2 hero set (level 6-10 console art etc.).
  if (has(entry.source, "hero") || has(entry.themeId, "hero") || has(key, "_hero_")) roles.add("hero");

  // image2 — has finished Image2 art (per-level image2 furniture + hero sets).
  if (has(entry.source, "image2") || has(entry.themeId, "image2") || has(key, "_img2_")) roles.add("image2");

  return ROLE_PRIORITY.filter((role) => roles.has(role)).slice(0, MAX_BADGES);
}
