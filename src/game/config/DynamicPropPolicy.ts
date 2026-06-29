import type { LevelMapPropDefinition, Vec3Tuple } from "./schema/levelConfig";

export const MAX_DYNAMIC_PROPS_PER_LEVEL = 12;
export const DYNAMIC_PROP_MAX_HALF_EXTENT = 1.15;
export const DYNAMIC_PROP_MAX_FULL_VOLUME = 3.4;

const DYNAMIC_PROP_BLOCKED_TAGS = new Set([
  "critical_path",
  "door",
  "exit",
  "future_puzzle_host",
  "key_item",
  "no_dynamic_prop",
  "objective",
  "puzzle_host",
]);

export function isDynamicPropTagged(prop: Pick<LevelMapPropDefinition, "tags">) {
  return prop.tags?.includes("dynamic_prop") ?? false;
}

export function blockedDynamicPropTags(prop: Pick<LevelMapPropDefinition, "tags">) {
  return (prop.tags ?? []).filter((tag) => DYNAMIC_PROP_BLOCKED_TAGS.has(tag));
}

export function dynamicPropColliderTooLarge(halfSize: Vec3Tuple) {
  const maxHalfExtent = Math.max(...halfSize);
  const fullVolume = halfSize.reduce((volume, halfExtent) => volume * Math.max(0, halfExtent * 2), 1);
  return maxHalfExtent > DYNAMIC_PROP_MAX_HALF_EXTENT || fullVolume > DYNAMIC_PROP_MAX_FULL_VOLUME;
}
