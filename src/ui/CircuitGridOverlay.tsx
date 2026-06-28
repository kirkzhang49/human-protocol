import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  LevelCircuitGridCellDefinition,
  LevelCircuitGridPuzzleDefinition,
  LevelCircuitGridTileKind,
} from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface CircuitGridOverlayProps {
  world: GameWorld;
}

interface CircuitGridSnapshot {
  visible: boolean;
  puzzle: LevelCircuitGridPuzzleDefinition | null;
  label: string;
  language: GameLanguage;
}

type Direction = "n" | "e" | "s" | "w";

const directionOffsets: Record<Direction, readonly [number, number]> = {
  n: [0, -1],
  e: [1, 0],
  s: [0, 1],
  w: [-1, 0],
};
const opposite: Record<Direction, Direction> = { n: "s", e: "w", s: "n", w: "e" };
const clockwise: readonly Direction[] = ["n", "e", "s", "w"];

export function CircuitGridOverlay({ world }: CircuitGridOverlayProps) {
  const snapshot = usePolledSnapshot(() => readCircuitGrid(world), 80, sameCircuitGridSnapshot);
  const puzzle = snapshot.puzzle;
  const [rotations, setRotations] = useState<readonly number[]>([]);
  const [moves, setMoves] = useState(0);
  const [failedOnce, setFailedOnce] = useState(false);
  const [startedAt, setStartedAt] = useState(() => performance.now());
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!snapshot.visible || !puzzle) return;
    setRotations(puzzle.cells.map((cell) => normalizeRotation(cell.rotation ?? 0)));
    setMoves(0);
    setFailedOnce(false);
    const stamp = performance.now();
    setStartedAt(stamp);
    setNow(stamp);
  }, [snapshot.visible, puzzle?.id]);

  useEffect(() => {
    if (snapshot.visible) releaseDesktopPointerLock();
  }, [snapshot.visible]);

  useEffect(() => {
    if (!snapshot.visible) return;
    const id = window.setInterval(() => setNow(performance.now()), 160);
    return () => window.clearInterval(id);
  }, [snapshot.visible]);

  const result = useMemo(() => (puzzle ? solveCircuit(puzzle, rotations) : null), [puzzle, rotations]);

  // Timeout: record one failure, then reset the board so the player retries.
  const elapsedSec = Math.max(0, (now - startedAt) / 1000);
  const timeLeft = puzzle?.timeLimitSec ? Math.max(0, puzzle.timeLimitSec - elapsedSec) : null;
  useEffect(() => {
    if (!snapshot.visible || !puzzle || timeLeft === null || timeLeft > 0) return;
    if (!result?.solved) {
      world.recordConfiguredPuzzleFailure(puzzle.id);
      setFailedOnce(true);
      setRotations(puzzle.cells.map((cell) => normalizeRotation(cell.rotation ?? 0)));
      setMoves(0);
      const stamp = performance.now();
      setStartedAt(stamp);
      setNow(stamp);
    }
  }, [snapshot.visible, puzzle?.id, timeLeft !== null && timeLeft <= 0]);

  if (!snapshot.visible || !puzzle || !result) return null;

  const movesLeft = puzzle.moveLimit ? Math.max(0, puzzle.moveLimit - moves) : null;
  const canSubmit = result.solved && (timeLeft === null || timeLeft > 0);
  const en = snapshot.language === "en";

  return (
    <section className="circuit-grid-overlay cyber-puzzle-overlay" aria-label={snapshot.label}>
      <div className="cyber-puzzle-panel" data-no-pointer-lock="true">
        <header className="cyber-puzzle-header">
          <div>
            <span>{en ? "Power routing" : "电力回路"}</span>
            <strong>{snapshot.label}</strong>
          </div>
          <button
            type="button"
            onClick={() => {
              world.closeCircuitGrid();
              requestDesktopPointerLock();
            }}
            aria-label={en ? "Close circuit panel" : "关闭电路面板"}
          >
            ×
          </button>
        </header>

        <div className="cyber-puzzle-layout">
          <aside className="cyber-puzzle-side">
            {puzzle.guidance ? <p className="cyber-puzzle-guidance">{world.configText(puzzle.guidance)}</p> : null}
            <div className={`cyber-puzzle-slot${result.solved ? " active" : ""}`}>
              <span>{en ? "Nodes" : "受电节点"}</span>
              <strong>{`${result.connectedTargets}/${puzzle.targets.length}`}</strong>
            </div>
            {movesLeft !== null ? (
              <div className={`cyber-puzzle-slot${movesLeft > 0 ? " active" : ""}`}>
                <span>{en ? "Rotations" : "剩余旋转"}</span>
                <strong>{`${movesLeft} / ${puzzle.moveLimit}`}</strong>
              </div>
            ) : null}
            <div className={`cyber-puzzle-slot${timeLeft === null || timeLeft > 0 ? " active" : ""}`}>
              <span>{en ? "Time" : "剩余时间"}</span>
              <strong>{timeLeft === null ? "--" : `${Math.ceil(timeLeft)}s`}</strong>
            </div>
            {failedOnce ? <p className="cyber-puzzle-error">{en ? "Grid reset. Route again." : "回路已重置，重新接通。"}</p> : null}
          </aside>

          <div className="circuit-grid-board-shell">
            <div
              className="circuit-grid-board"
              style={{ "--circuit-grid-cols": puzzle.columns, "--circuit-grid-rows": puzzle.rows } as CSSProperties}
            >
              {Array.from({ length: puzzle.columns * puzzle.rows }, (_, index) => {
                const x = index % puzzle.columns;
                const y = Math.floor(index / puzzle.columns);
                const cellIndex = puzzle.cells.findIndex((entry) => entry.x === x && entry.y === y);
                const cell = cellIndex >= 0 ? puzzle.cells[cellIndex] : null;
                const rotation = cellIndex >= 0 ? rotations[cellIndex] ?? 0 : 0;
                const powered = result.poweredKeys.has(cellKey(x, y));
                const source = puzzle.sources.some((port) => port.x === x && port.y === y);
                const target = puzzle.targets.some((port) => port.x === x && port.y === y);
                const rotatable = Boolean(cell && cell.kind !== "blocked" && !cell.locked && !source && !target);
                return (
                  <button
                    key={`${x}:${y}`}
                    type="button"
                    className={[
                      "circuit-grid-cell",
                      cell ? `kind-${cell.kind}` : "kind-void",
                      powered ? "powered" : "",
                      source ? "source" : "",
                      target ? "target" : "",
                      cell?.locked ? "locked" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={!rotatable}
                    onClick={() => {
                      if (!rotatable || cellIndex < 0) return;
                      if (puzzle.moveLimit && moves >= puzzle.moveLimit) return;
                      setRotations(rotations.map((value, rotIndex) => (rotIndex === cellIndex ? normalizeRotation(value + 1) : value)));
                      const nextMoves = moves + 1;
                      setMoves(nextMoves);
                      if (puzzle.moveLimit && nextMoves >= puzzle.moveLimit) {
                        const nextResult = solveCircuit(
                          puzzle,
                          rotations.map((value, rotIndex) => (rotIndex === cellIndex ? normalizeRotation(value + 1) : value)),
                        );
                        if (!nextResult.solved) {
                          world.recordConfiguredPuzzleFailure(puzzle.id);
                          setFailedOnce(true);
                          window.setTimeout(() => {
                            setRotations(puzzle.cells.map((entry) => normalizeRotation(entry.rotation ?? 0)));
                            setMoves(0);
                          }, 220);
                        }
                      }
                    }}
                    aria-label={`${cell?.kind ?? "void"} ${x},${y}`}
                  >
                    <CircuitGlyph kind={cell?.kind ?? null} rotation={rotation} powered={powered} source={source} target={target} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="cyber-puzzle-actions">
          <span>{result.solved ? (en ? "CIRCUIT LIVE" : "回路已接通") : en ? "CIRCUIT OPEN" : "回路断开"}</span>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              world.submitCircuitGrid();
              requestDesktopPointerLock();
            }}
          >
            {en ? "Seal circuit" : "锁定回路"}
          </button>
        </div>
      </div>
    </section>
  );
}

function CircuitGlyph({
  kind,
  rotation,
  powered,
  source,
  target,
}: {
  kind: LevelCircuitGridTileKind | null;
  rotation: number;
  powered: boolean;
  source: boolean;
  target: boolean;
}) {
  if (!kind || kind === "blocked") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <rect x="14" y="14" width="72" height="72" rx="9" fill="rgba(10, 14, 16, 0.85)" stroke="rgba(110, 126, 130, 0.3)" strokeWidth="3" />
        <path d="M30 30 L70 70 M70 30 L30 70" stroke="rgba(110, 126, 130, 0.32)" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }
  const wire = powered ? "#54f1ff" : "#274b51";
  const core = powered ? "#d8fdff" : "#3c6168";
  const segments = circuitSegments(kind).map(
    (direction) => clockwise[(clockwise.indexOf(direction) + normalizeRotation(rotation)) % clockwise.length],
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }}>
      {segments.map((segment) => (
        <g key={segment}>
          <line
            x1="50"
            y1="50"
            x2={segment === "e" ? 94 : segment === "w" ? 6 : 50}
            y2={segment === "s" ? 94 : segment === "n" ? 6 : 50}
            stroke="#0a1314"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <line
            x1="50"
            y1="50"
            x2={segment === "e" ? 90 : segment === "w" ? 10 : 50}
            y2={segment === "s" ? 90 : segment === "n" ? 10 : 50}
            stroke={wire}
            strokeWidth="8"
            strokeLinecap="round"
          />
          <line
            x1="50"
            y1="50"
            x2={segment === "e" ? 84 : segment === "w" ? 16 : 50}
            y2={segment === "s" ? 84 : segment === "n" ? 16 : 50}
            stroke={core}
            strokeWidth="2"
            strokeLinecap="round"
            opacity={powered ? 0.95 : 0.4}
          />
        </g>
      ))}
      {source ? (
        <g>
          <rect x="32" y="32" width="36" height="36" rx="7" fill="rgba(8, 16, 17, 0.96)" stroke="#ffb84f" strokeWidth="4" />
          <path d="M53 38 L44 53 H51 L47 62 L58 47 H50 Z" fill="#ffd089" />
        </g>
      ) : target ? (
        <g>
          <circle cx="50" cy="50" r="17" fill="rgba(8, 16, 17, 0.96)" stroke={powered ? "#63ffd4" : "#3b6a64"} strokeWidth="4" />
          <circle cx="50" cy="50" r="7" fill={powered ? "#b8ffe9" : "#33574f"} />
        </g>
      ) : (
        <>
          <circle cx="50" cy="50" r="11" fill="rgba(6, 12, 13, 0.95)" stroke={wire} strokeWidth="3" />
          <circle cx="50" cy="50" r="4" fill={core} opacity={powered ? 1 : 0.5} />
        </>
      )}
    </svg>
  );
}

function solveCircuit(puzzle: LevelCircuitGridPuzzleDefinition, rotations: readonly number[]) {
  const cellByKey = new Map(puzzle.cells.map((cell, index) => [cellKey(cell.x, cell.y), { cell, index }]));
  const poweredKeys = new Set<string>();
  const queue: string[] = [];
  for (const port of puzzle.sources) {
    const key = cellKey(port.x, port.y);
    if (cellByKey.has(key) && !poweredKeys.has(key)) {
      poweredKeys.add(key);
      queue.push(key);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const entry = cellByKey.get(queue[cursor]);
    if (!entry) continue;
    const exits = rotatedCircuitExits(entry.cell, rotations[entry.index] ?? 0);
    for (const direction of exits) {
      const [dx, dy] = directionOffsets[direction];
      const nextKey = cellKey(entry.cell.x + dx, entry.cell.y + dy);
      if (poweredKeys.has(nextKey)) continue;
      const next = cellByKey.get(nextKey);
      if (!next) continue;
      if (!rotatedCircuitExits(next.cell, rotations[next.index] ?? 0).has(opposite[direction])) continue;
      poweredKeys.add(nextKey);
      queue.push(nextKey);
    }
  }
  const connectedTargets = puzzle.targets.filter((port) => poweredKeys.has(cellKey(port.x, port.y))).length;
  return { poweredKeys, connectedTargets, solved: connectedTargets === puzzle.targets.length };
}

function rotatedCircuitExits(cell: LevelCircuitGridCellDefinition, rotation: number) {
  const exits = new Set<Direction>();
  for (const direction of circuitSegments(cell.kind)) {
    exits.add(clockwise[(clockwise.indexOf(direction) + normalizeRotation(rotation)) % clockwise.length]);
  }
  return exits;
}

function circuitSegments(kind: LevelCircuitGridTileKind): readonly Direction[] {
  if (kind === "straight") return ["n", "s"];
  if (kind === "corner") return ["n", "e"];
  if (kind === "tee") return ["n", "e", "s"];
  if (kind === "cross") return ["n", "e", "s", "w"];
  return [];
}

function normalizeRotation(rotation: number) {
  return ((Math.round(rotation) % 4) + 4) % 4;
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function readCircuitGrid(world: GameWorld): CircuitGridSnapshot {
  const puzzle = world.activeCircuitGridPuzzle();
  return {
    visible: Boolean(puzzle),
    puzzle,
    label: puzzle ? world.configText(puzzle.label) : "",
    language: world.settings.language,
  };
}

function sameCircuitGridSnapshot(current: CircuitGridSnapshot, next: CircuitGridSnapshot) {
  return (
    current.visible === next.visible &&
    current.puzzle?.id === next.puzzle?.id &&
    current.label === next.label &&
    current.language === next.language
  );
}
