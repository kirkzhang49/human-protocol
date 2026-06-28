// Reusable Image2 atlas-region helpers.
//
// The Level 06-10 hero GUI kits ship as: a composed `background_image2.png`
// panel + a `parts_image2.png` sprite atlas + a `*.regions.json` that names the
// pixel rect of every part and a per-state `stateRegions` layer list. This
// module turns a named region into a CSS sprite style so any React panel can
// crop one part out of the parts atlas — the same math RouteSwitchOverlay used
// inline, extracted so hero consoles / build preview / QA can share it.
//
// Text policy: these helpers only position ART. All live text, numbers, and
// puzzle answers stay in React/CSS (see Image2StatePanel).
import type { CSSProperties } from "react";

export type Image2Rect = readonly [number, number, number, number]; // [x, y, w, h] px, top-left origin

export interface Image2RegionsData {
  atlasSize: readonly [number, number];
  backgroundSize?: readonly [number, number];
  regions: Record<string, Image2Rect>;
  /** Curated layer list per state (locked/active/solved/disabled/danger/choice/error). */
  stateRegions?: Record<string, readonly string[]>;
}

/** The seven canonical interactive-surface states (asset-agent rules). */
export const IMAGE2_STATES = [
  "locked",
  "active",
  "solved",
  "disabled",
  "danger",
  "choice",
  "error",
] as const;
export type Image2State = (typeof IMAGE2_STATES)[number];

/**
 * CSS background style that crops `region` out of the parts atlas at `partsUrl`.
 * Apply to a box whose own width/height define the on-screen size; the sprite
 * scales to fill it. Mirrors the proven RouteSwitchOverlay regionStyle math.
 */
export function image2RegionStyle(partsUrl: string, atlasSize: readonly [number, number], region: Image2Rect): CSSProperties {
  const [aw, ah] = atlasSize;
  const [x, y, rw, rh] = region;
  const posX = aw === rw ? 0 : (x / (aw - rw)) * 100;
  const posY = ah === rh ? 0 : (y / (ah - rh)) * 100;
  return {
    backgroundImage: `url("${partsUrl}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(aw / rw) * 100}% ${(ah / rh) * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  };
}

/** Look a region up by name and return its sprite style, or null if absent. */
export function image2RegionStyleByName(partsUrl: string, data: Image2RegionsData, name: string): CSSProperties | null {
  const region = data.regions[name];
  return region ? image2RegionStyle(partsUrl, data.atlasSize, region) : null;
}

/** Width / height aspect ratio of a named region (for sizing a sprite box). */
export function image2RegionAspect(data: Image2RegionsData, name: string): number | null {
  const region = data.regions[name];
  if (!region) return null;
  const [, , w, h] = region;
  return h === 0 ? null : w / h;
}

/** True when the kit can express `state` (either a stateRegions entry or a status_<state> region). */
export function image2HasState(data: Image2RegionsData, state: string): boolean {
  if (data.stateRegions?.[state]) return true;
  return Boolean(data.regions[`status_${state}`]);
}

/**
 * Ordered list of region names to render for `state`. Prefers the curated
 * `stateRegions` list; otherwise falls back to `status_<state>` plus the common
 * readout layers so danger/choice/error still resolve even when the kit JSON
 * only lists a subset in stateRegions.
 */
export function image2StateLayers(data: Image2RegionsData, state: string): string[] {
  const curated = data.stateRegions?.[state];
  if (curated && curated.length) return curated.filter((name) => Boolean(data.regions[name]));
  const layers: string[] = [];
  const status = `status_${state}`;
  if (data.regions[status]) layers.push(status);
  for (const common of ["text_safe_band", "hero_display", "progress_track"]) {
    if (data.regions[common]) layers.push(common);
  }
  return layers;
}

/** The status_<state> badge region name if present (the per-state visual anchor). */
export function image2StatusRegion(data: Image2RegionsData, state: string): string | null {
  return data.regions[`status_${state}`] ? `status_${state}` : null;
}
