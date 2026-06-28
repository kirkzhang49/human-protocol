import type { ReactNode } from "react";
import {
  builderCeilingPresets,
  builderFloorPresets,
  builderWallPresets,
  roomFloor,
  type BuilderSurfacePattern,
  type BuilderSurfacePreset,
} from "./BuilderEnvironment";
import type { BuilderProject } from "./BuilderTypes";

/**
 * Procedural SVG material art shared by catalog swatches, inspector chips and
 * the 2D blueprint floors. No image assets: every preset is a tiny pattern.
 */

interface PatternBody {
  w: number;
  h: number;
  /** Intrinsic pattern rotation (e.g. hazard stripes run at 45°). */
  rotate: number;
  nodes: ReactNode;
}

function patternBody(pattern: BuilderSurfacePattern, base: string, accent: string): PatternBody {
  switch (pattern) {
    case "tile":
      return {
        w: 2,
        h: 2,
        rotate: 0,
        nodes: (
          <>
            <rect width="2" height="2" fill={base} />
            <path d="M0 0H2M0 0V2" stroke={accent} strokeOpacity="0.17" strokeWidth="0.06" />
            <path d="M1 0V2M0 1H2" stroke={accent} strokeOpacity="0.07" strokeWidth="0.04" />
          </>
        ),
      };
    case "metal":
      return {
        w: 1.8,
        h: 1.8,
        rotate: 0,
        nodes: (
          <>
            <rect width="1.8" height="1.8" fill={base} />
            <path d="M0 0.9H1.8M0.9 0V1.8" stroke={accent} strokeOpacity="0.1" strokeWidth="0.05" />
            <circle cx="0.32" cy="0.32" r="0.07" fill={accent} fillOpacity="0.24" />
            <circle cx="1.48" cy="1.48" r="0.07" fill={accent} fillOpacity="0.16" />
          </>
        ),
      };
    case "wood":
      return {
        w: 3,
        h: 1.2,
        rotate: 0,
        nodes: (
          <>
            <rect width="3" height="1.2" fill={base} />
            <path d="M0 0H3M0 1.2H3M1.5 0V1.2" stroke={accent} strokeOpacity="0.2" strokeWidth="0.05" />
            <path d="M0.35 0.62H1.05M1.95 0.5H2.6" stroke={accent} strokeOpacity="0.09" strokeWidth="0.04" />
          </>
        ),
      };
    case "hazard":
      return {
        w: 2.4,
        h: 2.4,
        rotate: 45,
        nodes: (
          <>
            <rect width="2.4" height="2.4" fill={base} />
            <rect width="2.4" height="0.6" fill={accent} fillOpacity="0.16" />
            <rect y="1.2" width="2.4" height="0.12" fill={accent} fillOpacity="0.07" />
          </>
        ),
      };
    case "stone":
      return {
        w: 3.2,
        h: 3.2,
        rotate: 0,
        nodes: (
          <>
            <rect width="3.2" height="3.2" fill={base} />
            <path d="M0 1.6H3.2M1.6 0V1.6M0.8 1.6V3.2M2.4 1.6V3.2" stroke={accent} strokeOpacity="0.16" strokeWidth="0.06" />
          </>
        ),
      };
    case "rubber":
      return {
        w: 1,
        h: 1,
        rotate: 0,
        nodes: (
          <>
            <rect width="1" height="1" fill={base} />
            <circle cx="0.5" cy="0.5" r="0.09" fill={accent} fillOpacity="0.2" />
            <circle cx="0" cy="0" r="0.05" fill={accent} fillOpacity="0.12" />
          </>
        ),
      };
    case "parquet":
      return {
        w: 1.6,
        h: 1.6,
        rotate: 0,
        nodes: (
          <>
            <rect width="1.6" height="1.6" fill={base} />
            <rect width="0.8" height="0.8" fill="#ffffff" fillOpacity="0.04" />
            <rect x="0.8" y="0.8" width="0.8" height="0.8" fill="#ffffff" fillOpacity="0.04" />
            <path d="M0.8 0V1.6M0 0.8H1.6" stroke={accent} strokeOpacity="0.26" strokeWidth="0.05" />
            <path d="M0 0H1.6M0 1.6H1.6" stroke={accent} strokeOpacity="0.4" strokeWidth="0.06" />
            <path d="M0.12 0.4H0.68M0.92 1.2H1.48" stroke={accent} strokeOpacity="0.12" strokeWidth="0.035" />
            <path d="M0.4 0.92V1.48M1.2 0.12V0.68" stroke={accent} strokeOpacity="0.12" strokeWidth="0.035" />
          </>
        ),
      };
    case "plate":
      return {
        w: 1.4,
        h: 1.4,
        rotate: 0,
        nodes: (
          <>
            <rect width="1.4" height="1.4" fill={base} />
            <path d="M0 0H1.4M0 0V1.4" stroke={accent} strokeOpacity="0.22" strokeWidth="0.05" />
            <rect x="0.22" y="0.3" width="0.34" height="0.1" rx="0.04" fill={accent} fillOpacity="0.2" transform="rotate(45 0.39 0.35)" />
            <rect x="0.84" y="0.9" width="0.34" height="0.1" rx="0.04" fill={accent} fillOpacity="0.2" transform="rotate(-45 1.01 0.95)" />
            <circle cx="0.12" cy="0.12" r="0.05" fill={accent} fillOpacity="0.35" />
            <circle cx="1.28" cy="1.28" r="0.05" fill={accent} fillOpacity="0.35" />
          </>
        ),
      };
    case "labtile":
      return {
        w: 1.2,
        h: 1.2,
        rotate: 0,
        nodes: (
          <>
            <rect width="1.2" height="1.2" fill={base} />
            <path d="M0 0H1.2M0 0V1.2M0.6 0V1.2M0 0.6H1.2" stroke={accent} strokeOpacity="0.26" strokeWidth="0.04" />
            <circle cx="0.32" cy="0.86" r="0.1" fill="#000000" fillOpacity="0.12" />
            <circle cx="0.92" cy="0.3" r="0.07" fill={accent} fillOpacity="0.08" />
          </>
        ),
      };
    case "route":
      return {
        w: 3.2,
        h: 3.2,
        rotate: 0,
        nodes: (
          <>
            <rect width="3.2" height="3.2" fill={base} />
            <path d="M0 1.6H3.2M1.06 0V1.6M2.13 1.6V3.2" stroke={accent} strokeOpacity="0.14" strokeWidth="0.06" />
            <rect y="2.42" width="3.2" height="0.26" fill={accent} fillOpacity="0.12" />
            <path d="M0 2.42H3.2M0 2.68H3.2" stroke={accent} strokeOpacity="0.5" strokeWidth="0.045" />
          </>
        ),
      };
    case "panel":
      return {
        w: 2.2,
        h: 2.2,
        rotate: 0,
        nodes: (
          <>
            <rect width="2.2" height="2.2" fill={base} />
            <path d="M0.73 0V2.2M1.47 0V2.2" stroke={accent} strokeOpacity="0.24" strokeWidth="0.05" />
            <path d="M0 0.5H2.2" stroke={accent} strokeOpacity="0.1" strokeWidth="0.035" />
            <circle cx="0.37" cy="0.24" r="0.05" fill={accent} fillOpacity="0.3" />
            <circle cx="1.83" cy="0.24" r="0.05" fill={accent} fillOpacity="0.3" />
            <rect x="0.88" y="1.7" width="0.44" height="0.05" fill="#000000" fillOpacity="0.3" />
            <rect x="0.88" y="1.82" width="0.44" height="0.05" fill="#000000" fillOpacity="0.3" />
          </>
        ),
      };
    case "wainscot":
      return {
        w: 2.6,
        h: 2.6,
        rotate: 0,
        nodes: (
          <>
            <rect width="2.6" height="2.6" fill={base} />
            <rect y="1.43" width="2.6" height="1.17" fill="#000000" fillOpacity="0.14" />
            <path d="M0 1.43H2.6" stroke={accent} strokeOpacity="0.5" strokeWidth="0.06" />
            <rect x="0.26" y="1.64" width="0.52" height="0.74" fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="0.045" />
            <rect x="1.56" y="1.64" width="0.52" height="0.74" fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="0.045" />
            <path d="M1.3 0V1.3" stroke={accent} strokeOpacity="0.1" strokeWidth="0.04" />
          </>
        ),
      };
    case "glass":
      return {
        w: 2.4,
        h: 2.4,
        rotate: 0,
        nodes: (
          <>
            <rect width="2.4" height="2.4" fill={base} />
            <rect width="2.4" height="2.4" fill={accent} fillOpacity="0.05" />
            <path d="M0 0H2.4M0 0V2.4M1.2 0V2.4M0 2.4H2.4" stroke={accent} strokeOpacity="0.35" strokeWidth="0.06" />
            <path d="M0.25 2.25L1.35 0.15" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="0.14" />
            <path d="M1.05 2.3L2.2 0.25" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="0.07" />
          </>
        ),
      };
    case "trim":
      return {
        w: 2.4,
        h: 2.4,
        rotate: 0,
        nodes: (
          <>
            <rect width="2.4" height="2.4" fill={base} />
            <path d="M1.2 0V2.4" stroke={accent} strokeOpacity="0.08" strokeWidth="0.04" />
            <rect y="1.39" width="2.4" height="0.34" fill="#000000" fillOpacity="0.25" />
            <path d="M0 1.39H2.4M0 1.73H2.4" stroke={accent} strokeOpacity="0.4" strokeWidth="0.045" />
            <path d="M0.1 1.73L0.4 1.39H0.66L0.36 1.73ZM1.3 1.73L1.6 1.39H1.86L1.56 1.73Z" fill={accent} fillOpacity="0.42" />
          </>
        ),
      };
    case "marble":
      return {
        w: 3,
        h: 3,
        rotate: 0,
        nodes: (
          <>
            <rect width="3" height="3" fill={base} />
            <path d="M-0.2 0.6C0.8 0.9 1.2 0.2 2 0.7S3 0.4 3.2 1.1" stroke={accent} strokeOpacity="0.22" strokeWidth="0.06" fill="none" />
            <path d="M-0.2 2.1C0.6 1.7 1.4 2.4 2.1 1.9S3.1 2.2 3.2 1.7" stroke={accent} strokeOpacity="0.16" strokeWidth="0.05" fill="none" />
            <path d="M0.4 -0.2C0.7 0.8 0.3 1.6 0.9 2.4S0.6 3.1 1.1 3.2" stroke={accent} strokeOpacity="0.1" strokeWidth="0.035" fill="none" />
          </>
        ),
      };
    case "hex":
      return {
        w: 1.732,
        h: 1.5,
        rotate: 0,
        nodes: (
          <>
            <rect width="1.732" height="1.5" fill={base} />
            <path
              d="M0.866 0L1.732 0.5V1.5M0.866 0L0 0.5V1.5M0 0.5L0.866 1L1.732 0.5M0.866 1V1.5"
              stroke={accent}
              strokeOpacity="0.28"
              strokeWidth="0.05"
              fill="none"
            />
          </>
        ),
      };
  }
}

/** Static per-preset patterns for swatch art (ids `bsw-<preset>`); mount once at page level. */
export function SurfacePatternDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {[...builderFloorPresets, ...builderWallPresets, ...builderCeilingPresets].map((preset) => {
          const body = patternBody(preset.pattern, preset.color, preset.accent);
          return (
            <pattern
              key={preset.id}
              id={`bsw-${preset.id}`}
              width={body.w}
              height={body.h}
              patternUnits="userSpaceOnUse"
              patternTransform={body.rotate ? `rotate(${body.rotate})` : undefined}
            >
              {body.nodes}
            </pattern>
          );
        })}
      </defs>
    </svg>
  );
}

/**
 * Per-room floor patterns (ids `bfp-<roomId>`), reflecting the effective floor
 * preset + color override + texture scale + rotation; mount once at page level.
 */
export function RoomSurfacePatternDefs({ project }: { project: BuilderProject }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {project.rooms.map((room) => {
          const floor = roomFloor(room);
          const body = patternBody(floor.preset.pattern, floor.color, floor.preset.accent);
          const rotate = (body.rotate + floor.rotation) % 360;
          return (
            <pattern
              key={room.id}
              id={`bfp-${room.id}`}
              width={body.w}
              height={body.h}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${rotate}) scale(${floor.scale})`}
            >
              {body.nodes}
            </pattern>
          );
        })}
      </defs>
    </svg>
  );
}

export function roomFloorPatternId(roomId: string) {
  return `bfp-${roomId}`;
}

export const brushPreviewPatternId = "bfp-brush-preview";

/** Pattern for the 2D floor-brush hover preview (mounted only while a floor brush is armed). */
export function BrushPreviewPatternDef({ preset }: { preset: BuilderSurfacePreset }) {
  const body = patternBody(preset.pattern, preset.color, preset.accent);
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <pattern
          id={brushPreviewPatternId}
          width={body.w}
          height={body.h}
          patternUnits="userSpaceOnUse"
          patternTransform={body.rotate ? `rotate(${body.rotate})` : undefined}
        >
          {body.nodes}
        </pattern>
      </defs>
    </svg>
  );
}

/** Mini material thumbnail; callers wrap it in a button/tile. */
export function SurfaceSwatch({ preset }: { preset: BuilderSurfacePreset }) {
  return (
    <svg className="builder-swatch" viewBox="0 0 8 8" aria-hidden="true">
      <rect x="0.35" y="0.35" width="7.3" height="7.3" rx="0.9" fill={`url(#bsw-${preset.id})`} stroke={preset.accent} strokeOpacity="0.5" strokeWidth="0.24" />
      <rect x="0.35" y="0.35" width="7.3" height="7.3" rx="0.9" fill="none" stroke="#000000" strokeOpacity="0.35" strokeWidth="0.1" />
    </svg>
  );
}
