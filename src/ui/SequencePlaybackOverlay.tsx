import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { LevelHitSequencePuzzleDefinition, LevelPuzzleColorKey } from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { playerStrings, puzzleColorLabel } from "../i18n/playerStrings";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { uiReadableVars } from "./guiMath";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface SequencePlaybackOverlayProps {
  world: GameWorld;
}

interface SequencePlaybackSnapshot {
  visible: boolean;
  puzzle: LevelHitSequencePuzzleDefinition | null;
  label: string;
  order: readonly string[];
  language: GameLanguage;
}

const lampCatalog: Record<LevelPuzzleColorKey, { symbol: string; color: string; shadow: string }> = {
  red: { symbol: "△", color: "#ff5f54", shadow: "255, 95, 84" },
  blue: { symbol: "○", color: "#64a7ff", shadow: "100, 167, 255" },
  yellow: { symbol: "丨", color: "#ffd45f", shadow: "255, 212, 95" },
  green: { symbol: "◇", color: "#65f19a", shadow: "101, 241, 154" },
  purple: { symbol: "＋", color: "#bc83ff", shadow: "188, 131, 255" },
  white: { symbol: "□", color: "#eefbff", shadow: "238, 251, 255" },
  cyan: { symbol: "×", color: "#5ff3ff", shadow: "95, 243, 255" },
};

const defaultPalette: readonly LevelPuzzleColorKey[] = ["red", "blue", "yellow", "green", "purple", "white", "cyan"];

export function SequencePlaybackOverlay({ world }: SequencePlaybackOverlayProps) {
  const snapshot = usePolledSnapshot(() => readSequencePlayback(world), 60, sameSequencePlaybackSnapshot);
  const puzzle = snapshot.puzzle;
  const [startedAt, setStartedAt] = useState(() => performance.now());
  const [now, setNow] = useState(() => performance.now());
  const [markedPlaybackKey, setMarkedPlaybackKey] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot.visible || !puzzle) return;
    const stamp = performance.now();
    setStartedAt(stamp);
    setNow(stamp);
    setMarkedPlaybackKey(null);
  }, [snapshot.visible, puzzle?.id, snapshot.order.join("|")]);

  useEffect(() => {
    if (snapshot.visible) releaseDesktopPointerLock();
  }, [snapshot.visible]);

  useEffect(() => {
    if (!snapshot.visible) return;
    const id = window.setInterval(() => setNow(performance.now()), 40);
    return () => window.clearInterval(id);
  }, [snapshot.visible]);

  const targetColors = useMemo(() => {
    const colors = new Map<string, LevelPuzzleColorKey>();
    for (const target of puzzle?.targets ?? []) colors.set(target.id, target.colorKey);
    return colors;
  }, [puzzle]);

  const visible = snapshot.visible && Boolean(puzzle);
  const playback = puzzle?.clue.playback;
  const stepMs = Math.max(180, playback?.stepMs ?? 520);
  const gapMs = Math.max(40, playback?.gapMs ?? 120);
  const beatMs = stepMs + gapMs;
  const totalMs = Math.max(1, snapshot.order.length) * beatMs;
  const elapsed = Math.max(0, now - startedAt);
  const rawStepIndex = Math.min(Math.max(0, snapshot.order.length - 1), Math.floor(elapsed / beatMs));
  const insideLightBeat = elapsed < totalMs && elapsed % beatMs < stepMs;
  const activeTargetId = insideLightBeat ? snapshot.order[rawStepIndex] : null;
  const activeColor = activeTargetId ? targetColors.get(activeTargetId) ?? null : null;
  const completedSteps = Math.min(snapshot.order.length, Math.floor(elapsed / beatMs) + (insideLightBeat ? 0 : 1));
  const done = elapsed >= totalMs;
  const playbackKey = `${puzzle?.id ?? "none"}:${startedAt}`;
  const palette = uniquePalette([...(playback?.palette ?? defaultPalette), ...(puzzle?.targets.map((target) => target.colorKey) ?? [])]);

  useEffect(() => {
    if (!visible || !puzzle || !done || markedPlaybackKey === playbackKey) return;
    world.markSequencePlaybackComplete(puzzle.id);
    setMarkedPlaybackKey(playbackKey);
  }, [visible, puzzle?.id, done, markedPlaybackKey, playbackKey, world]);

  if (!visible || !puzzle) return null;

  const closePlayback = () => {
    world.closeSequencePlayback();
    requestDesktopPointerLock();
  };

  return (
    <section
      className="sequence-playback-overlay"
      style={uiReadableVars() as CSSProperties}
      aria-label={snapshot.label}
      onClick={(event) => {
        if (event.target === event.currentTarget) closePlayback();
      }}
    >
      <div className={`sequence-playback-panel${done ? " complete" : ""}`} data-no-pointer-lock="true">
        <button
          type="button"
          className="sequence-playback-close"
          onClick={closePlayback}
          aria-label={playerStrings(snapshot.language).sequence.closeAria}
        >
          ×
        </button>
        <div className="sequence-playback-stage">
          <div className="sequence-light-wall" aria-hidden="true">
            <div className="sequence-wall-rail top" />
            <div className="sequence-wall-rail bottom" />
            <div className="sequence-wall-scanline" />
            {palette.map((colorKey) => {
              const lamp = lampCatalog[colorKey];
              const played = snapshot.order.slice(0, Math.min(completedSteps, rawStepIndex + 1)).some((targetId) => targetColors.get(targetId) === colorKey);
              const active = activeColor === colorKey;
              return (
                <div
                  key={colorKey}
                  className={`sequence-lamp ${active ? "active" : played ? "afterglow" : ""}`}
                  style={{ "--lamp-color": lamp.color, "--lamp-shadow": lamp.shadow } as CSSProperties}
                  aria-label={puzzleColorLabel(colorKey, snapshot.language)}
                >
                  <span>{lamp.symbol}</span>
                </div>
              );
            })}
          </div>
          <div className="sequence-playback-track" aria-hidden="true">
            {snapshot.order.map((targetId, index) => {
              const active = insideLightBeat && index === rawStepIndex;
              const passed = index < completedSteps || done;
              const colorKey = targetColors.get(targetId) ?? "white";
              return (
                <i
                  key={`${targetId}:${index}`}
                  className={active ? "active" : passed ? "passed" : ""}
                  style={{ "--lamp-color": lampCatalog[colorKey].color, "--lamp-shadow": lampCatalog[colorKey].shadow } as CSSProperties}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function uniquePalette(colors: readonly LevelPuzzleColorKey[]) {
  const seen = new Set<LevelPuzzleColorKey>();
  const result: LevelPuzzleColorKey[] = [];
  for (const color of colors) {
    if (seen.has(color)) continue;
    seen.add(color);
    result.push(color);
  }
  return result;
}

function readSequencePlayback(world: GameWorld): SequencePlaybackSnapshot {
  const puzzle = world.activeSequencePlaybackPuzzle();
  const order = puzzle ? world.currentHitSequenceOrder(puzzle) : [];
  return {
    visible: world.session.mode === "sequencePlayback" && Boolean(puzzle),
    puzzle,
    label: puzzle ? world.configText(puzzle.label) : "",
    order,
    language: world.settings.language,
  };
}

function sameSequencePlaybackSnapshot(current: SequencePlaybackSnapshot, next: SequencePlaybackSnapshot) {
  return current.visible === next.visible && current.puzzle?.id === next.puzzle?.id && current.label === next.label && current.order.join("|") === next.order.join("|") && current.language === next.language;
}
