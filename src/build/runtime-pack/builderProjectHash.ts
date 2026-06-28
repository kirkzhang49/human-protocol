import type { BuilderProject } from "../BuilderTypes";
import type { LevelDefinition } from "../../game/config/schema/levelConfig";
import { BUILDER_RUNTIME_PACK_ENGINE_VERSION } from "./BuilderRuntimePackTypes";

/**
 * Stable content hash for a builder project + the runtime-pack compile
 * settings. Key order independent, synchronous, environment independent
 * (no crypto.subtle so SSR/QA hash identically to the browser).
 * Used only for staleness detection, not security.
 */
export function builderProjectHash(project: BuilderProject): string {
  const canonical = stableStringify({ engine: BUILDER_RUNTIME_PACK_ENGINE_VERSION, project });
  return stableContentHash(canonical);
}

export function builderLevelConfigHash(level: LevelDefinition): string {
  return stableContentHash(stableStringify({ level }));
}

export function stableRuntimePackContentHash(value: unknown): string {
  return stableContentHash(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function stableContentHash(canonical: string): string {
  return `${fnv1a(canonical, 0x811c9dc5).toString(16).padStart(8, "0")}${fnv1a(canonical, 0x01000193).toString(16).padStart(8, "0")}`;
}

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
