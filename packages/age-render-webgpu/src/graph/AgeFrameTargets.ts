import type { AgeViewport } from "../core/AgeTypes";

export interface AgeFrameTarget {
  label: string;
  format?: string;
  texture?: unknown;
  view?: unknown;
  clearColor?: { r: number; g: number; b: number; a: number };
}

export interface AgeGlassOitTargets {
  accum?: AgeFrameTarget;
  reveal?: AgeFrameTarget;
}

export interface AgeFrameTargets {
  viewport: AgeViewport;
  canvas?: AgeFrameTarget;
  sceneColor?: AgeFrameTarget;
  depth?: AgeFrameTarget;
  shadowDepth?: AgeFrameTarget;
  glassOit?: AgeGlassOitTargets;
  bloom?: AgeFrameTarget;
  postColor?: AgeFrameTarget;
  version: number;
}

export function createAgeFrameTargets(
  viewport: AgeViewport,
  previous?: Partial<AgeFrameTargets>,
): AgeFrameTargets {
  return {
    viewport,
    canvas: previous?.canvas,
    sceneColor: previous?.sceneColor,
    depth: previous?.depth,
    shadowDepth: previous?.shadowDepth,
    glassOit: previous?.glassOit,
    bloom: previous?.bloom,
    postColor: previous?.postColor,
    version: (previous?.version ?? 0) + 1,
  };
}
