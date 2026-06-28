// Reusable Image2 state panel.
//
// Renders a hero-console GUI from its Image2 kit (composed background panel +
// parts atlas + regions.json) and switches the visible LAYERS by state —
// locked / active / solved / disabled / danger / choice / error — instead of
// showing only the panel baked into the GLB. ART comes from the parts atlas via
// image2Region helpers; all live text/numbers come from React (never baked).
//
// Use it in overlays, /build preview, or the Image2 state lab / QA harness.
import type { CSSProperties } from "react";
import {
  image2RegionStyleByName,
  image2StatusRegion,
  type Image2RegionsData,
} from "./image2Region";

export interface Image2StatePanelProps {
  backgroundUrl: string;
  partsUrl: string;
  regions: Image2RegionsData;
  state: string;
  /** 0..1 fill for the progress track (only drawn when provided). */
  progress?: number;
  /** Live React text shown in the safe band (per-state copy; never baked into PNG). */
  label?: string;
  /** Accessible name for the panel. */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const DIMMED_STATES = new Set(["locked", "disabled"]);

export function Image2StatePanel({
  backgroundUrl,
  partsUrl,
  regions,
  state,
  progress,
  label,
  title,
  className,
  style,
}: Image2StatePanelProps) {
  const corner = (name: string) => image2RegionStyleByName(partsUrl, regions, name);
  const heroStyle = image2RegionStyleByName(partsUrl, regions, "hero_display");
  const statusName = image2StatusRegion(regions, state);
  const statusStyle = statusName ? image2RegionStyleByName(partsUrl, regions, statusName) : null;
  const bandStyle = image2RegionStyleByName(partsUrl, regions, "text_safe_band");
  const trackStyle = image2RegionStyleByName(partsUrl, regions, "progress_track");
  const fillStyle = image2RegionStyleByName(partsUrl, regions, "progress_fill");
  const lockStyle = image2RegionStyleByName(partsUrl, regions, "lock_overlay");
  const dimmed = DIMMED_STATES.has(state);

  return (
    <div
      className={`image2-state-panel${dimmed ? " is-dim" : ""}${className ? " " + className : ""}`}
      data-state={state}
      role="group"
      aria-label={title ?? `Image2 ${state} panel`}
      style={{ ...(style ?? {}), ["--i2-bg" as string]: `url("${backgroundUrl}")` } as CSSProperties}
    >
      <div className="image2-panel-bg" aria-hidden="true" />
      {corner("frame_corner_tl") ? <i className="image2-corner tl" style={corner("frame_corner_tl")!} aria-hidden="true" /> : null}
      {corner("frame_corner_tr") ? <i className="image2-corner tr" style={corner("frame_corner_tr")!} aria-hidden="true" /> : null}
      {corner("frame_corner_bl") ? <i className="image2-corner bl" style={corner("frame_corner_bl")!} aria-hidden="true" /> : null}
      {corner("frame_corner_br") ? <i className="image2-corner br" style={corner("frame_corner_br")!} aria-hidden="true" /> : null}

      {heroStyle ? <i className="image2-hero" style={heroStyle} aria-hidden="true" /> : null}

      {statusStyle ? <i className="image2-status" style={statusStyle} aria-hidden="true" /> : null}

      {progress != null && trackStyle ? (
        <span className="image2-progress" style={trackStyle} aria-hidden="true">
          {fillStyle ? (
            <i className="image2-progress-fill" style={{ ...fillStyle, width: `${Math.round(clamp01(progress) * 100)}%` }} />
          ) : null}
        </span>
      ) : null}

      {label != null ? (
        <span className="image2-text" style={bandStyle ?? undefined}>
          {label}
        </span>
      ) : null}

      {dimmed && lockStyle ? <i className="image2-lock" style={lockStyle} aria-hidden="true" /> : null}
    </div>
  );
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
