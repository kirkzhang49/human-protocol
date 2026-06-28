import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import gateBalanceBackgroundUrl from "../assets/gui/gate-balance-three-row/gate_balance_three_row_frame_image2_v1.png";
import gateBalanceLayoutData from "../assets/gui/gate-balance-three-row/gate_balance_three_row_layout_v1.json";
import gateBalancePartsUrl from "../assets/gui/gate-balance-three-row/gate_balance_three_row_parts_image2_v1.png";
import gateBalancePartsData from "../assets/gui/gate-balance-three-row/gate_balance_three_row_parts_image2_v1.regions.json";
import type { LevelValveMatrixPuzzleDefinition } from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { image2RegionStyleByName, type Image2Rect, type Image2RegionsData } from "./image2Region";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface ValveMatrixOverlayProps {
  world: GameWorld;
}

interface ValveMatrixSnapshot {
  visible: boolean;
  puzzle: LevelValveMatrixPuzzleDefinition | null;
  label: string;
  language: GameLanguage;
}

type GateBalanceLayoutRow = {
  gauge: string;
  control: string;
  slots: {
    gaugeLabel: string;
    gaugeBadge: string;
    gaugeBar: string;
    gaugeValue: string;
    controlLabel: string;
    minus: string;
    value: string;
    plus: string;
    controlTrack: string;
    controlFill: string;
    handle: string;
  };
};

type GateBalanceLayoutData = {
  canvas: readonly [number, number];
  regions: Record<string, Image2Rect>;
  rows: readonly GateBalanceLayoutRow[];
};

const VALVE_AUDIO = {
  tick: "gallery_card_tick",
  bandLatch: "archive_tile_merge",
  balanced: "archive_unlock",
  lock: "ui_confirm",
} as const;
const DEFAULT_VALVE_MATRIX_TIME_LIMIT_SEC = 30;
const VALVE_MATRIX_VALUE_LED_SEGMENTS = 8;
const VALVE_MATRIX_SUCCESS_COMMIT_DELAY_MS = 850;

const gateBalanceLayout = gateBalanceLayoutData as unknown as GateBalanceLayoutData;
const gateBalanceParts = gateBalancePartsData as unknown as Image2RegionsData;
const GATE_BALANCE_CANVAS = gateBalanceLayout.canvas;
const GATE_BALANCE_ASPECT = GATE_BALANCE_CANVAS[0] / GATE_BALANCE_CANVAS[1];
const GATE_BALANCE_PANEL_STYLE = {
  backgroundImage: `url("${gateBalanceBackgroundUrl}")`,
  aspectRatio: `${GATE_BALANCE_CANVAS[0]} / ${GATE_BALANCE_CANVAS[1]}`,
  "--gate-balance-aspect": String(GATE_BALANCE_ASPECT),
} as CSSProperties;

function rectStyle(name: string): CSSProperties {
  const region = gateBalanceLayout.regions[name];
  if (!region) return {};
  const [x, y, w, h] = region;
  const [canvasW, canvasH] = GATE_BALANCE_CANVAS;
  return {
    left: `${(x / canvasW) * 100}%`,
    top: `${(y / canvasH) * 100}%`,
    width: `${(w / canvasW) * 100}%`,
    height: `${(h / canvasH) * 100}%`,
  };
}

function partStyle(regionName: string): CSSProperties {
  return image2RegionStyleByName(gateBalancePartsUrl, gateBalanceParts, regionName) ?? {};
}

function mergeStyles(...styles: Array<CSSProperties | null | undefined>): CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean));
}

function rectPartStyle(rectName: string, regionName: string): CSSProperties {
  return mergeStyles(rectStyle(rectName), partStyle(regionName));
}

function relativeRectStyle(parentName: string, childName: string): CSSProperties {
  const parent = gateBalanceLayout.regions[parentName];
  const child = gateBalanceLayout.regions[childName];
  if (!parent || !child) return {};
  const [px, py, pw, ph] = parent;
  const [cx, cy, cw, ch] = child;
  return {
    left: `${((cx - px) / pw) * 100}%`,
    top: `${((cy - py) / ph) * 100}%`,
    width: `${(cw / pw) * 100}%`,
    height: `${(ch / ph) * 100}%`,
  };
}

function relativePartStyle(parentName: string, childName: string, regionName: string): CSSProperties {
  return mergeStyles(relativeRectStyle(parentName, childName), partStyle(regionName));
}

function trackHandleStyle(trackName: string, handleName: string, ratio: number): CSSProperties {
  const track = gateBalanceLayout.regions[trackName];
  const handle = gateBalanceLayout.regions[handleName];
  if (!track || !handle) return { left: `${ratio * 100}%` };
  return {
    left: `${ratio * 100}%`,
    width: `${(handle[2] / track[2]) * 100}%`,
    height: `${(handle[3] / track[3]) * 100}%`,
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function ValveMatrixOverlay({ world }: ValveMatrixOverlayProps) {
  const snapshot = usePolledSnapshot(() => readValveMatrix(world), 80, sameValveMatrixSnapshot);
  const puzzle = snapshot.puzzle;
  const [positions, setPositions] = useState<readonly number[]>([]);
  const [focusValve, setFocusValve] = useState(0);
  const [startedAt, setStartedAt] = useState(() => performance.now());
  const [now, setNow] = useState(() => performance.now());
  const [draggingValve, setDraggingValve] = useState<number | null>(null);
  const [pressedControl, setPressedControl] = useState<{ valveIndex: number; delta: number } | null>(null);
  const [pressedLock, setPressedLock] = useState(false);
  const [pressedClose, setPressedClose] = useState(false);
  const [committing, setCommitting] = useState(false);
  const bandStateRef = useRef<boolean[]>([]);
  const wasBalancedRef = useRef(false);
  const commitTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!snapshot.visible || !puzzle) {
      setCommitting(false);
      if (commitTimeoutRef.current !== null) {
        window.clearTimeout(commitTimeoutRef.current);
        commitTimeoutRef.current = null;
      }
      return;
    }
    setPositions(puzzle.valves.map((valve) => valve.initial));
    setFocusValve(0);
    setDraggingValve(null);
    setPressedControl(null);
    setPressedLock(false);
    setCommitting(false);
    if (commitTimeoutRef.current !== null) {
      window.clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = null;
    }
    bandStateRef.current = puzzle.gauges.map(() => false);
    wasBalancedRef.current = false;
    const stamp = performance.now();
    setStartedAt(stamp);
    setNow(stamp);
  }, [snapshot.visible, puzzle?.id]);

  useEffect(
    () => () => {
      if (commitTimeoutRef.current !== null) window.clearTimeout(commitTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (snapshot.visible) releaseDesktopPointerLock();
  }, [snapshot.visible]);

  useEffect(() => {
    if (!snapshot.visible || !puzzle) return;
    const id = window.setInterval(() => setNow(performance.now()), 160);
    return () => window.clearInterval(id);
  }, [snapshot.visible, puzzle?.id]);

  const gaugeValueFor = useCallback(
    (active: LevelValveMatrixPuzzleDefinition, pos: readonly number[], gaugeIndex: number) =>
      active.gauges[gaugeIndex].base +
      active.valves.reduce((sum, valve, valveIndex) => sum + (pos[valveIndex] ?? valve.initial) * valve.gaugeShift[gaugeIndex], 0),
    [],
  );

  const gaugeValues = useMemo(() => {
    if (!puzzle) return [];
    return puzzle.gauges.map((_, gaugeIndex) => gaugeValueFor(puzzle, positions, gaugeIndex));
  }, [puzzle, positions, gaugeValueFor]);

  const offBandError = useCallback(
    (active: LevelValveMatrixPuzzleDefinition, pos: readonly number[]) =>
      active.gauges.reduce((sum, gauge, gaugeIndex) => {
        const value = gaugeValueFor(active, pos, gaugeIndex);
        const slack = Math.max(0, Math.abs(value - gauge.target) - gauge.tolerance);
        return sum + slack;
      }, 0),
    [gaugeValueFor],
  );

  const currentError = useMemo(() => (puzzle ? offBandError(puzzle, positions) : 0), [puzzle, positions, offBandError]);

  const valveHints = useMemo(() => {
    if (!puzzle) return [];
    return puzzle.valves.map((valve, valveIndex) => {
      const pos = positions[valveIndex] ?? valve.initial;
      const tryAt = (next: number) => {
        if (next < valve.min || next > valve.max) return Number.POSITIVE_INFINITY;
        const trial = positions.map((value, index) => (index === valveIndex ? next : value));
        return offBandError(puzzle, trial);
      };
      const up = tryAt(pos + 1);
      const down = tryAt(pos - 1);
      if (up < currentError - 1e-9 && up <= down) return 1;
      if (down < currentError - 1e-9 && down < up) return -1;
      return 0;
    });
  }, [puzzle, positions, currentError, offBandError]);

  const elapsedSec = Math.max(0, (now - startedAt) / 1000);
  const effectiveTimeLimitSec = puzzle ? (puzzle.timeLimitSec ?? DEFAULT_VALVE_MATRIX_TIME_LIMIT_SEC) : null;
  const timeLeft = effectiveTimeLimitSec !== null ? Math.max(0, effectiveTimeLimitSec - elapsedSec) : null;
  const balanced = Boolean(puzzle && currentError <= 1e-9);

  const startError = useMemo(
    () => (puzzle ? Math.max(1e-6, offBandError(puzzle, puzzle.valves.map((valve) => valve.initial))) : 1),
    [puzzle, offBandError],
  );
  const stability = puzzle ? Math.min(1, Math.max(0, 1 - currentError / startError)) : 0;

  useEffect(() => {
    if (!snapshot.visible || !puzzle) return;
    const nextBands = puzzle.gauges.map(
      (gauge, gaugeIndex) => Math.abs((gaugeValues[gaugeIndex] ?? gauge.base) - gauge.target) <= gauge.tolerance + 1e-9,
    );
    const prev = bandStateRef.current;
    const latched = nextBands.some((inBand, index) => inBand && !prev[index]);
    bandStateRef.current = nextBands;
    if (balanced && !wasBalancedRef.current) {
      world.emitAudio(VALVE_AUDIO.balanced, { intensity: 0.85 });
    } else if (latched) {
      world.emitAudio(VALVE_AUDIO.bandLatch, { intensity: 0.5 });
    }
    wasBalancedRef.current = balanced;
  }, [snapshot.visible, puzzle?.id, gaugeValues, balanced, world]);

  useEffect(() => {
    if (!snapshot.visible || !puzzle || timeLeft === null || timeLeft > 0 || balanced) return;
    world.recordConfiguredPuzzleFailure(puzzle.id);
    setPositions(puzzle.valves.map((valve) => valve.initial));
    bandStateRef.current = puzzle.gauges.map(() => false);
    wasBalancedRef.current = false;
    const stamp = performance.now();
    setStartedAt(stamp);
    setNow(stamp);
  }, [snapshot.visible, puzzle?.id, timeLeft !== null && timeLeft <= 0]);

  const setValvePosition = useCallback(
    (valveIndex: number, nextPosition: number) => {
      if (!puzzle) return;
      const valve = puzzle.valves[valveIndex];
      if (!valve) return;
      setPositions((prev) => {
        const current = prev[valveIndex] ?? valve.initial;
        const clamped = Math.min(valve.max, Math.max(valve.min, Math.round(nextPosition)));
        if (clamped === current) return prev;
        world.emitAudio(VALVE_AUDIO.tick, { intensity: 0.34 });
        return prev.map((value, index) => (index === valveIndex ? clamped : value));
      });
    },
    [puzzle, world],
  );

  const adjustValve = useCallback(
    (valveIndex: number, delta: number) => {
      if (!puzzle) return;
      const valve = puzzle.valves[valveIndex];
      if (!valve) return;
      setValvePosition(valveIndex, (positions[valveIndex] ?? valve.initial) + delta);
    },
    [puzzle, positions, setValvePosition],
  );

  const pressAdjust = useCallback(
    (valveIndex: number, delta: number) => {
      setFocusValve(valveIndex);
      setPressedControl({ valveIndex, delta });
      window.setTimeout(() => setPressedControl(null), 120);
      adjustValve(valveIndex, delta);
    },
    [adjustValve],
  );

  const setValveFromPointer = useCallback(
    (valveIndex: number, event: ReactPointerEvent<HTMLElement>) => {
      if (!puzzle) return;
      const valve = puzzle.valves[valveIndex];
      if (!valve) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = clamp01((event.clientX - rect.left) / Math.max(1, rect.width));
      setValvePosition(valveIndex, valve.min + ratio * (valve.max - valve.min));
    },
    [puzzle, setValvePosition],
  );

  useEffect(() => {
    if (!snapshot.visible || !puzzle) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const valveCount = puzzle.valves.length;
      const key = event.key.toLowerCase();
      if (event.key === "ArrowUp" || key === "w") {
        event.preventDefault();
        adjustValve(focusValve, 1);
      } else if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        adjustValve(focusValve, -1);
      } else if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        setFocusValve((index) => (index + valveCount - 1) % valveCount);
      } else if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        setFocusValve((index) => (index + 1) % valveCount);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshot.visible, puzzle?.id, focusValve, adjustValve]);

  if (!snapshot.visible || !puzzle) return null;

  const en = snapshot.language === "en";
  const lockButtonDisabled = !balanced || (timeLeft !== null && timeLeft <= 0);
  const canSubmit = !lockButtonDisabled && !committing;
  const timeRemainingLabel = timeLeft !== null ? String(Math.ceil(timeLeft)) : "—";
  const lockLabel = committing ? (en ? "Locked" : "已锁定") : en ? "Lock" : "锁定";

  return (
    <section className="valve-matrix-overlay gate-balance-three-row-overlay cyber-puzzle-overlay" aria-label={snapshot.label}>
      <div
        className={`cyber-puzzle-panel gate-balance-three-row-panel${committing ? " committing" : ""}`}
        data-no-pointer-lock="true"
        style={GATE_BALANCE_PANEL_STYLE}
      >
        <header className="gate-balance-three-row-title" style={rectStyle("titleBlock")}>
          <span>{en ? "Gate" : "闸门"}</span>
          <strong>{en ? "Balance" : "配平"}</strong>
        </header>
        <button
          type="button"
          className="gate-balance-three-row-close"
          style={rectPartStyle("closeButton", pressedClose ? "close_button_pressed" : "close_button_idle")}
          onPointerDown={() => setPressedClose(true)}
          onPointerUp={() => setPressedClose(false)}
          onPointerCancel={() => setPressedClose(false)}
          onClick={() => {
            world.closeValveMatrix();
            requestDesktopPointerLock();
          }}
          aria-label={en ? "Close gate console" : "关闭闸门配平台"}
        >
          ×
        </button>

        <b
          className={`gate-balance-three-row-sync-bar${balanced ? " balanced" : ""}`}
          style={rectPartStyle("syncBar", "progress_track")}
          aria-hidden="true"
        >
          <i style={{ width: `${Math.round(stability * 100)}%` }} />
        </b>

        {gateBalanceLayout.rows.map((row, rowIndex) => {
          const gauge = puzzle.gauges[rowIndex];
          if (!gauge) return null;
          const value = gaugeValues[rowIndex] ?? gauge.base;
          const delta = Math.round((value - gauge.target) * 10) / 10;
          const inBand = Math.abs(value - gauge.target) <= gauge.tolerance + 1e-9;
          const near = !inBand && Math.abs(value - gauge.target) <= gauge.tolerance * 2.5;
          const danger = !inBand && Math.abs(value - gauge.target) > gauge.tolerance * 5;
          const reach = Math.max(gauge.tolerance * 3, Math.abs(gauge.target - gauge.base), 6);
          const lo = gauge.target - reach;
          const hi = gauge.target + reach;
          const toRatio = (input: number) => clamp01((input - lo) / (hi - lo));
          const ratio = toRatio(value);
          const bandLeft = toRatio(gauge.target - gauge.tolerance);
          const bandRight = toRatio(gauge.target + gauge.tolerance);
          const arrow = inBand ? "✓" : delta > 0 ? "↓" : "↑";
          const shell = inBand ? "gauge_shell_locked" : danger ? "gauge_shell_danger" : near ? "gauge_shell_near" : "gauge_shell_idle";
          return (
            <div
              key={gauge.id}
              className={`gate-balance-three-row-gauge${inBand ? " balanced" : near ? " near" : danger ? " danger" : ""}`}
              style={rectPartStyle(row.gauge, shell)}
            >
              <span className="gate-balance-three-row-gauge-label" style={relativeRectStyle(row.gauge, row.slots.gaugeLabel)}>
                {world.configText(gauge.label)}
              </span>
              <em className="gate-balance-three-row-gauge-badge" style={relativeRectStyle(row.gauge, row.slots.gaugeBadge)}>
                {arrow}
              </em>
              <div className="gate-balance-three-row-gauge-bar" style={relativeRectStyle(row.gauge, row.slots.gaugeBar)} aria-hidden="true">
                <i className="band" style={{ left: `${bandLeft * 100}%`, width: `${Math.max(0.04, bandRight - bandLeft) * 100}%` }} />
                <i className="tick" style={{ left: `${toRatio(gauge.target) * 100}%` }} />
                <i className="needle" style={{ left: `${ratio * 100}%` }} />
              </div>
              <strong className="gate-balance-three-row-gauge-value" style={relativeRectStyle(row.gauge, row.slots.gaugeValue)}>
                {`${Math.round(value * 10) / 10}${gauge.unit ?? ""}`}
              </strong>
            </div>
          );
        })}

        {gateBalanceLayout.rows.map((row, rowIndex) => {
          const valve = puzzle.valves[rowIndex];
          if (!valve) return null;
          const position = positions[rowIndex] ?? valve.initial;
          const ratio = clamp01((position - valve.min) / Math.max(1, valve.max - valve.min));
          const focused = rowIndex === focusValve;
          const hint = valveHints[rowIndex] ?? 0;
          const locked = balanced;
          const shell = locked ? "control_shell_locked" : focused ? "control_shell_focused" : "control_shell_idle";
          const minusPart =
            position <= valve.min
              ? "button_disabled"
              : pressedControl?.valveIndex === rowIndex && pressedControl.delta < 0
                ? "button_pressed"
                : focused
                  ? "button_focused"
                  : "button_idle";
          const plusPart =
            position >= valve.max
              ? "button_disabled"
              : pressedControl?.valveIndex === rowIndex && pressedControl.delta > 0
                ? "button_pressed"
                : focused
                  ? "button_focused"
                  : "button_idle";
          const handlePart = locked ? "slider_handle_locked" : draggingValve === rowIndex ? "slider_handle_dragging" : "slider_handle_idle";
          return (
            <div
              key={valve.id}
              className={`gate-balance-three-row-control${focused ? " focused" : ""}${locked ? " locked" : ""}`}
              style={rectPartStyle(row.control, shell)}
              onPointerDown={() => setFocusValve(rowIndex)}
            >
              <button
                type="button"
                className="gate-balance-three-row-step gate-balance-three-row-minus"
                style={relativePartStyle(row.control, row.slots.minus, minusPart)}
                disabled={position <= valve.min}
                onClick={() => pressAdjust(rowIndex, -1)}
                aria-label={`${world.configText(valve.label)} -`}
              >
                −
              </button>
              <strong className="gate-balance-three-row-control-value" style={relativeRectStyle(row.control, row.slots.value)}>
                <span className="gate-balance-three-row-control-value-number">{position}</span>
                <span className="gate-balance-three-row-control-value-leds" aria-hidden="true">
                  {Array.from({ length: VALVE_MATRIX_VALUE_LED_SEGMENTS }, (_, segment) => (
                    <i key={segment} className={segment < position - valve.min ? "on" : undefined} />
                  ))}
                </span>
              </strong>
              <button
                type="button"
                className="gate-balance-three-row-step gate-balance-three-row-plus"
                style={relativePartStyle(row.control, row.slots.plus, plusPart)}
                disabled={position >= valve.max}
                onClick={() => pressAdjust(rowIndex, 1)}
                aria-label={`${world.configText(valve.label)} +`}
              >
                +
              </button>
              <div
                className="gate-balance-three-row-control-track"
                style={relativeRectStyle(row.control, row.slots.controlTrack)}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setFocusValve(rowIndex);
                  setDraggingValve(rowIndex);
                  setValveFromPointer(rowIndex, event);
                }}
                onPointerMove={(event) => {
                  if (draggingValve === rowIndex) setValveFromPointer(rowIndex, event);
                }}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  setDraggingValve(null);
                }}
                onPointerCancel={() => setDraggingValve(null)}
                role="slider"
                aria-label={world.configText(valve.label)}
                aria-valuemin={valve.min}
                aria-valuemax={valve.max}
                aria-valuenow={position}
              >
                <i className="fill" style={{ width: `${ratio * 100}%` }} />
                <b className="hint" data-hint={hint > 0 ? "up" : hint < 0 ? "down" : balanced ? "ok" : "hold"} />
                <span className="handle" style={mergeStyles(trackHandleStyle(row.slots.controlTrack, row.slots.handle, ratio), partStyle(handlePart))} />
              </div>
            </div>
          );
        })}

        <div
          className={`gate-balance-three-row-countdown${timeLeft !== null && timeLeft <= 5 ? " urgent" : ""}`}
          style={rectStyle("countdownText")}
          aria-label={en ? "Time remaining" : "剩余时间"}
        >
          {timeRemainingLabel}
        </div>
        <button
          type="button"
          className={`gate-balance-three-row-lock${pressedLock ? " pressed" : ""}${balanced ? " success" : ""}`}
          style={rectStyle("lockButton")}
          disabled={lockButtonDisabled}
          onPointerDown={() => setPressedLock(true)}
          onPointerUp={() => setPressedLock(false)}
          onPointerCancel={() => setPressedLock(false)}
          onClick={() => {
            if (!canSubmit) return;
            setPressedLock(false);
            setCommitting(true);
            world.emitAudio(VALVE_AUDIO.lock, { intensity: 0.7 });
            commitTimeoutRef.current = window.setTimeout(() => {
              commitTimeoutRef.current = null;
              world.submitValveMatrix();
              requestDesktopPointerLock();
            }, VALVE_MATRIX_SUCCESS_COMMIT_DELAY_MS);
          }}
        >
          <span className="gate-balance-three-row-lock-text" style={relativeRectStyle("lockButton", "lockButtonText")}>
            {lockLabel}
          </span>
        </button>
      </div>
    </section>
  );
}

function readValveMatrix(world: GameWorld): ValveMatrixSnapshot {
  const puzzle = world.activeValveMatrixPuzzle();
  return {
    visible: Boolean(puzzle),
    puzzle,
    label: puzzle ? world.configText(puzzle.label) : "",
    language: world.settings.language,
  };
}

function sameValveMatrixSnapshot(current: ValveMatrixSnapshot, next: ValveMatrixSnapshot) {
  return (
    current.visible === next.visible &&
    current.puzzle?.id === next.puzzle?.id &&
    current.label === next.label &&
    current.language === next.language
  );
}
