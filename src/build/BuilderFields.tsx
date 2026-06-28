import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { EnemyTierId } from "../game/config/enemyTiers";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import type { BuilderRobotArchetype } from "./BuilderTypes";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (value: number) => void;
}

/** Click-first numeric control: [−] value [+], no typing required. */
export function Stepper({ label, value, min, max, step, unit = "", decimals = 0, onChange }: StepperProps) {
  const { language } = useBuilderLanguage();
  const en = language === "en";
  const apply = (next: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next / step) * step));
    if (clamped !== value) onChange(Number(clamped.toFixed(3)));
  };
  return (
    <label className="builder-stepper-field">
      <span>{label}</span>
      <div className="builder-stepper">
        <button type="button" disabled={value <= min} onClick={() => apply(value - step)} aria-label={en ? `Decrease ${label}` : `${label} 减少`}>−</button>
        <strong>{value.toFixed(decimals)}{unit}</strong>
        <button type="button" disabled={value >= max} onClick={() => apply(value + step)} aria-label={en ? `Increase ${label}` : `${label} 增加`}>+</button>
      </div>
    </label>
  );
}

interface AngleControlProps {
  label: string;
  valueRad: number;
  onChange: (rad: number) => void;
}

function normalizeAngleDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

export function formatAngleDegrees(valueRad: number) {
  return String(Math.round(normalizeAngleDegrees((valueRad * 180) / Math.PI)));
}

export function angleDegreesInputToRad(rawValue: string): number | null {
  const cleaned = rawValue.trim().replace(/°/g, "");
  if (!cleaned) return null;
  const degrees = Number(cleaned);
  if (!Number.isFinite(degrees)) return null;
  return (normalizeAngleDegrees(degrees) * Math.PI) / 180;
}

/** Rotation control in 45° taps with an editable degree readout. */
export function AngleControl({ label, valueRad, onChange }: AngleControlProps) {
  const { language } = useBuilderLanguage();
  const en = language === "en";
  const degrees = formatAngleDegrees(valueRad);
  const [draft, setDraft] = useState(degrees);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(degrees);
  }, [degrees, editing]);

  const commitDraft = () => {
    const next = angleDegreesInputToRad(draft);
    setEditing(false);
    if (next === null) {
      setDraft(degrees);
      return;
    }
    setDraft(formatAngleDegrees(next));
    if (next !== valueRad) onChange(next);
  };

  return (
    <label className="builder-stepper-field">
      <span>{label}</span>
      <div className="builder-stepper builder-angle">
        <button type="button" onClick={() => onChange(valueRad - Math.PI / 4)} aria-label={en ? "Rotate 45° counterclockwise" : "逆时针 45 度"}>⟲</button>
        <input
          className="builder-angle-input"
          inputMode="decimal"
          value={editing ? draft : `${degrees}°`}
          aria-label={en ? `${label} degrees` : `${label}角度`}
          onFocus={(event) => {
            setEditing(true);
            setDraft(degrees);
            event.currentTarget.select();
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
              setDraft(degrees);
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" onClick={() => onChange(valueRad + Math.PI / 4)} aria-label={en ? "Rotate 45° clockwise" : "顺时针 45 度"}>⟳</button>
        <button type="button" className="builder-angle-zero" disabled={degrees === "0"} onClick={() => onChange(0)}>{en ? "Reset" : "归零"}</button>
      </div>
    </label>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  /** Called once when a drag gesture begins (use to mark undo history). */
  onStart?: () => void;
  onChange: (value: number) => void;
}

/** Range slider with a live numeric readout next to the label. */
export function SliderField({ label, value, min, max, step, unit = "", decimals = 1, onStart, onChange }: SliderFieldProps) {
  const percent = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <label className="builder-slider-field">
      <span>
        {label}
        <b>
          {value.toFixed(decimals)}
          {unit}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--builder-slider-value": `${percent}%` } as CSSProperties}
        onPointerDown={() => onStart?.()}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

/** Collapsible inspector section card with a chevron header and optional value badge. */
export function CollapsibleCard({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`builder-card builder-collapsible ${open ? "open" : ""}`}>
      <button type="button" className="builder-collapsible-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <i>{open ? "▾" : "▸"}</i>
        <span>{title}</span>
        {badge ? <em>{badge}</em> : null}
      </button>
      {open ? children : null}
    </section>
  );
}

/** Color dot row; `undefined` value = preset default (∅ reset chip). */
export function ColorChips({
  colors,
  value,
  allowReset = true,
  onChange,
}: {
  colors: readonly string[];
  value: string | undefined;
  allowReset?: boolean;
  onChange: (color: string | undefined) => void;
}) {
  const { language } = useBuilderLanguage();
  const en = language === "en";
  return (
    <div className="builder-colorchips">
      {allowReset ? (
        <button
          type="button"
          className={`builder-colordot reset ${value === undefined ? "active" : ""}`}
          title={en ? "Default (follow material)" : "默认（跟随材质）"}
          onClick={() => onChange(undefined)}
        >
          ∅
        </button>
      ) : null}
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`builder-colordot ${value === color ? "active" : ""}`}
          style={{ background: color }}
          title={color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

/** Pill toggle with a state lamp (e.g. grid snap on/off). */
export function ToggleChip({ label, on, onToggle, title }: { label: string; on: boolean; onToggle: () => void; title?: string }) {
  return (
    <button type="button" className={`builder-toggle ${on ? "on" : ""}`} onClick={onToggle} title={title} aria-pressed={on}>
      <i />
      {label}
    </button>
  );
}

const archetypeThreat: Record<BuilderRobotArchetype, number> = {
  repair_drone: 1,
  clamp_bot: 1.6,
  shield_tech: 2.1,
  custodian_elite: 4,
};

/** 5-dot threat meter so robot tuning communicates gameplay impact. */
export function ThreatMeter({ archetype, count, tier }: { archetype: BuilderRobotArchetype; count: number; tier?: EnemyTierId }) {
  const { language } = useBuilderLanguage();
  const en = language === "en";
  const raw = archetypeThreat[archetype] * count * (tier === "elite" ? 1.6 : 1);
  const dots = Math.max(1, Math.min(5, Math.round(raw / 1.6)));
  const tone = dots >= 4 ? "high" : dots >= 3 ? "mid" : "low";
  return (
    <div className={`builder-threat ${tone}`} title={en ? `Threat estimate: ${raw.toFixed(1)}` : `威胁估算：${raw.toFixed(1)}`}>
      <span>{en ? "Threat" : "威胁"}</span>
      <i>
        {Array.from({ length: 5 }, (_, index) => (
          <b key={index} className={index < dots ? "on" : ""} />
        ))}
      </i>
      <em>{tone === "high" ? (en ? "Danger" : "危险") : tone === "mid" ? (en ? "Tense" : "紧张") : en ? "Mild" : "轻度"}</em>
    </div>
  );
}

/** Compact inline diagnostic inside the inspector. */
export function InspectorHint({ tone, children }: { tone: "warn" | "ok"; children: ReactNode }) {
  return <p className={tone === "warn" ? "builder-warning" : "builder-okhint"}>{children}</p>;
}
