import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import archiveMergeBoardUrl from "../assets/gui/hp-gui-archive-merge-board-image2.png";
import archiveMergeFrameUrl from "../assets/gui/hp-gui-archive-merge-frame-image2.png";
import archiveMergePadUrl from "../assets/gui/hp-gui-archive-merge-shift-pad-image2.png";
import archiveMergeTileUrl from "../assets/gui/hp-gui-archive-merge-tile-image2.png";
import archiveBot0002Url from "../assets/gui/archive-merge/hp-archive-bot-0002.png";
import archiveBot0004Url from "../assets/gui/archive-merge/hp-archive-bot-0004.png";
import archiveBot0008Url from "../assets/gui/archive-merge/hp-archive-bot-0008.png";
import archiveBot0016Url from "../assets/gui/archive-merge/hp-archive-bot-0016.png";
import archiveBot0032Url from "../assets/gui/archive-merge/hp-archive-bot-0032.png";
import archiveBot0064Url from "../assets/gui/archive-merge/hp-archive-bot-0064.png";
import archiveBot0128Url from "../assets/gui/archive-merge/hp-archive-bot-0128.png";
import archiveBot0256Url from "../assets/gui/archive-merge/hp-archive-bot-0256.png";
import archiveBot0512Url from "../assets/gui/archive-merge/hp-archive-bot-0512.png";
import archiveBot1024Url from "../assets/gui/archive-merge/hp-archive-bot-1024.png";
import archiveBot2048Url from "../assets/gui/archive-merge/hp-archive-bot-2048.png";
import archiveBotCoreUrl from "../assets/gui/archive-merge/hp-archive-bot-core.png";
import type { AudioCueConfig, LevelArchiveMergePuzzleDefinition } from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { uiReadableVars } from "./guiMath";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface ArchiveMergeOverlayProps {
  world: GameWorld;
}

interface ArchiveMergeSnapshot {
  visible: boolean;
  puzzle: LevelArchiveMergePuzzleDefinition | null;
  label: string;
  language: GameLanguage;
}

type Direction = "up" | "right" | "down" | "left";

interface MoveResult {
  board: readonly number[];
  moved: boolean;
  mergedValues: readonly number[];
}

export function ArchiveMergeOverlay({ world }: ArchiveMergeOverlayProps) {
  const snapshot = usePolledSnapshot(() => readArchiveMerge(world), 80, sameArchiveMergeSnapshot);
  const puzzle = snapshot.puzzle;
  const rngRef = useRef<() => number>(() => 0.5);
  const [board, setBoard] = useState<readonly number[]>([]);
  const [moves, setMoves] = useState(0);
  const [pulseValue, setPulseValue] = useState<number | null>(null);

  useEffect(() => {
    if (!snapshot.visible || !puzzle) return;
    rngRef.current = seededRng(hashString(`${puzzle.id}:${puzzle.targetValue}:${puzzle.gridSize}`));
    setBoard(createInitialBoard(puzzle, rngRef.current));
    setMoves(0);
    setPulseValue(null);
  }, [snapshot.visible, puzzle?.id]);

  useEffect(() => {
    if (snapshot.visible) releaseDesktopPointerLock();
  }, [snapshot.visible]);

  const closePanel = useCallback(() => {
    world.closeArchiveMerge();
    requestDesktopPointerLock();
  }, [world]);

  const resetAfterFailure = useCallback(
    (activePuzzle: LevelArchiveMergePuzzleDefinition) => {
      world.recordConfiguredPuzzleFailure(activePuzzle.id);
      world.emitConfiguredAudio(activePuzzle.audio?.fail ?? activePuzzle.fail?.audio ?? ARCHIVE_AUDIO_FALLBACK.fail);
      rngRef.current = seededRng(hashString(`${activePuzzle.id}:${activePuzzle.targetValue}:${activePuzzle.gridSize}:${Date.now()}`));
      setBoard(createInitialBoard(activePuzzle, rngRef.current));
      setMoves(0);
      setPulseValue(null);
    },
    [world],
  );

  const applyMove = useCallback(
    (direction: Direction) => {
      if (!puzzle) return;
      const moved = moveBoard(board, puzzle.gridSize, direction);
      if (!moved.moved) {
        world.emitConfiguredAudio(puzzle.audio?.invalid ?? ARCHIVE_AUDIO_FALLBACK.invalid);
        return;
      }
      const withSpawn = spawnTile(moved.board, puzzle, rngRef.current);
      const nextMoves = moves + 1;
      const highestMerge = Math.max(0, ...moved.mergedValues);
      if (highestMerge > 0) {
        setPulseValue(highestMerge);
        window.setTimeout(() => setPulseValue(null), 360);
        const isHigh = highestMerge >= puzzle.targetValue / 2;
        world.emitConfiguredAudio(
          isHigh
            ? puzzle.audio?.highMerge ?? puzzle.audio?.merge ?? ARCHIVE_AUDIO_FALLBACK.highMerge
            : puzzle.audio?.merge ?? ARCHIVE_AUDIO_FALLBACK.merge,
        );
      } else {
        world.emitConfiguredAudio(puzzle.audio?.move ?? ARCHIVE_AUDIO_FALLBACK.move);
      }
      setBoard(withSpawn);
      setMoves(nextMoves);
      if (Math.max(...withSpawn) >= puzzle.targetValue) {
        window.setTimeout(() => {
          world.submitArchiveMerge();
          requestDesktopPointerLock();
        }, 180);
        return;
      }
      if ((puzzle.moveLimit && nextMoves >= puzzle.moveLimit) || !hasAnyMove(withSpawn, puzzle.gridSize)) {
        window.setTimeout(() => resetAfterFailure(puzzle), 260);
      }
    },
    [board, moves, puzzle, resetAfterFailure, world],
  );

  useEffect(() => {
    if (!snapshot.visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyToDirection(event.key);
      if (!direction) return;
      event.preventDefault();
      applyMove(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshot.visible, applyMove]);

  // Touch: swipe the board to slide files, mirroring arrow/WASD on mobile.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((event: ReactTouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, []);
  const onTouchEnd = useCallback(
    (event: ReactTouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      applyMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    },
    [applyMove],
  );

  const gridSize = puzzle?.gridSize ?? 4;
  const highest = board.length > 0 ? Math.max(...board) : 0;
  const movesLeft = puzzle?.moveLimit ? Math.max(0, puzzle.moveLimit - moves) : null;
  const progress = puzzle ? Math.min(1, highest / puzzle.targetValue) : 0;
  const en = snapshot.language === "en";
  const status = puzzle
    ? highest >= puzzle.targetValue
      ? en
        ? "SEALED"
        : "已封存"
      : `${highest || 2}/${puzzle.targetValue}`
    : "";

  if (!snapshot.visible || !puzzle) return null;

  return (
    <section
      className={`archive-merge-overlay archive-skin-${puzzle.tileSkin ?? "museum"}`}
      style={
        {
          ...uiReadableVars(),
          "--archive-merge-frame": `url("${archiveMergeFrameUrl}")`,
          "--archive-merge-board": `url("${archiveMergeBoardUrl}")`,
          "--archive-merge-tile": `url("${archiveMergeTileUrl}")`,
          "--archive-merge-pad": `url("${archiveMergePadUrl}")`,
        } as CSSProperties
      }
      aria-label={snapshot.label}
      onClick={(event) => {
        if (event.target === event.currentTarget) closePanel();
      }}
    >
      <div className="archive-merge-panel" data-no-pointer-lock="true">
        <button type="button" className="archive-merge-close" onClick={closePanel} aria-label={en ? "Close archive cabinet" : "关闭身份压缩柜"}>
          ×
        </button>
        <header className="archive-merge-head">
          <div>
            <span>{en ? "Identity cabinet" : "身份压缩柜"}</span>
            <strong>{snapshot.label}</strong>
          </div>
          <em>{status}</em>
        </header>

        <main className="archive-merge-stage">
          <aside className="archive-merge-readout">
            <div>
              <span>{en ? "Target" : "目标"}</span>
              <strong>{puzzle.targetValue}</strong>
            </div>
            <div>
              <span>{en ? "Moves" : "步数"}</span>
              <strong>{movesLeft === null ? moves : movesLeft}</strong>
            </div>
            <div>
              <span>{en ? "Peak" : "峰值"}</span>
              <strong>{highest || "--"}</strong>
            </div>
            <div className="archive-merge-readout-wide">
              <span>{en ? "Compression" : "压缩进度"}</span>
              <b className="archive-merge-progress">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </b>
            </div>
          </aside>

          <div
            className="archive-merge-board"
            style={{ "--archive-grid": gridSize } as CSSProperties}
            aria-label={en ? "Archive merge grid" : "身份片合并网格"}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {Array.from({ length: gridSize * gridSize }, (_, index) => {
              const value = board[index] ?? 0;
              const level = tileLevel(value);
              return (
                <button
                  key={index}
                  type="button"
                  className={`archive-merge-tile archive-tier-${level}${value > 0 ? " filled" : ""}${pulseValue === value ? " pulse" : ""}`}
                  style={
                    {
                      "--archive-tile-level": level,
                      "--archive-tile-glow": tileGlow(value),
                      ...(value > 0 ? { "--archive-tile-sprite": `url("${tileSprite(value)}")` } : {}),
                    } as CSSProperties
                  }
                  tabIndex={-1}
                  aria-label={value > 0 ? `${en ? "file tier" : "档案阶"} ${value}` : en ? "empty slot" : "空槽"}
                >
                  {value > 0 ? (
                    <>
                      <i className="archive-merge-tile-art" aria-hidden="true" />
                      <b className="archive-merge-tile-value">{value}</b>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>

          <nav className="archive-merge-controls" aria-label={en ? "Slide archive files" : "移动身份片"}>
            <button type="button" className="up" onClick={() => applyMove("up")} aria-label={en ? "Slide up" : "上移"}>
              ↑
            </button>
            <button type="button" className="left" onClick={() => applyMove("left")} aria-label={en ? "Slide left" : "左移"}>
              ←
            </button>
            <button type="button" className="down" onClick={() => applyMove("down")} aria-label={en ? "Slide down" : "下移"}>
              ↓
            </button>
            <button type="button" className="right" onClick={() => applyMove("right")} aria-label={en ? "Slide right" : "右移"}>
              →
            </button>
          </nav>
        </main>
      </div>
    </section>
  );
}

function readArchiveMerge(world: GameWorld): ArchiveMergeSnapshot {
  const puzzle = world.activeArchiveMergePuzzle();
  return {
    visible: Boolean(puzzle),
    puzzle,
    label: puzzle ? world.configText(puzzle.label) : "",
    language: world.settings.language,
  };
}

function sameArchiveMergeSnapshot(current: ArchiveMergeSnapshot, next: ArchiveMergeSnapshot) {
  return (
    current.visible === next.visible &&
    current.puzzle?.id === next.puzzle?.id &&
    current.label === next.label &&
    current.language === next.language
  );
}

function createInitialBoard(puzzle: LevelArchiveMergePuzzleDefinition, rng: () => number) {
  let board = Array.from({ length: puzzle.gridSize * puzzle.gridSize }, () => 0);
  board = spawnTile(board, puzzle, rng);
  return spawnTile(board, puzzle, rng);
}

function spawnTile(board: readonly number[], puzzle: LevelArchiveMergePuzzleDefinition, rng: () => number): number[] {
  const empty = board.map((value, index) => (value === 0 ? index : -1)).filter((index) => index >= 0);
  if (empty.length === 0) return [...board];
  const next = [...board];
  const index = empty[Math.floor(rng() * empty.length) % empty.length];
  next[index] = chooseSpawnValue(puzzle, rng);
  return next;
}

function chooseSpawnValue(puzzle: LevelArchiveMergePuzzleDefinition, rng: () => number) {
  const table = (puzzle.spawnTable && puzzle.spawnTable.length > 0 ? puzzle.spawnTable : [{ value: 2, weight: 85 }, { value: 4, weight: 15 }])
    .filter((entry) => entry.value > 0 && entry.weight > 0);
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return table[0]?.value ?? 2;
}

function moveBoard(board: readonly number[], size: number, direction: Direction): MoveResult {
  const next = [...board];
  const mergedValues: number[] = [];
  let moved = false;
  const readLine = (lineIndex: number) => {
    const values: number[] = [];
    for (let i = 0; i < size; i += 1) {
      const x = direction === "left" ? i : direction === "right" ? size - 1 - i : lineIndex;
      const y = direction === "up" ? i : direction === "down" ? size - 1 - i : lineIndex;
      values.push(board[y * size + x] ?? 0);
    }
    return values;
  };
  const writeLine = (lineIndex: number, values: readonly number[]) => {
    for (let i = 0; i < size; i += 1) {
      const x = direction === "left" ? i : direction === "right" ? size - 1 - i : lineIndex;
      const y = direction === "up" ? i : direction === "down" ? size - 1 - i : lineIndex;
      const index = y * size + x;
      if (next[index] !== values[i]) moved = true;
      next[index] = values[i] ?? 0;
    }
  };

  for (let line = 0; line < size; line += 1) {
    const compact = readLine(line).filter((value) => value > 0);
    const merged: number[] = [];
    for (let i = 0; i < compact.length; i += 1) {
      if (compact[i] === compact[i + 1]) {
        const value = compact[i] * 2;
        merged.push(value);
        mergedValues.push(value);
        i += 1;
      } else {
        merged.push(compact[i]);
      }
    }
    while (merged.length < size) merged.push(0);
    writeLine(line, merged);
  }
  return { board: next, moved, mergedValues };
}

function hasAnyMove(board: readonly number[], size: number) {
  if (board.some((value) => value === 0)) return true;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = board[y * size + x];
      if (x + 1 < size && board[y * size + x + 1] === value) return true;
      if (y + 1 < size && board[(y + 1) * size + x] === value) return true;
    }
  }
  return false;
}

function keyToDirection(key: string): Direction | null {
  if (key === "ArrowUp" || key.toLowerCase() === "w") return "up";
  if (key === "ArrowRight" || key.toLowerCase() === "d") return "right";
  if (key === "ArrowDown" || key.toLowerCase() === "s") return "down";
  if (key === "ArrowLeft" || key.toLowerCase() === "a") return "left";
  return null;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRng(seed: number) {
  let value = seed || 1;
  return () => {
    value = Math.imul(1664525, value) + 1013904223;
    return ((value >>> 0) / 4294967296);
  };
}

function tileLevel(value: number) {
  if (value <= 0) return 0;
  return Math.min(11, Math.max(1, Math.round(Math.log2(value))));
}

function tileGlow(value: number) {
  if (value >= 2048) return "#f9e9a6";
  if (value >= 1024) return "#ffce7a";
  if (value >= 512) return "#b47aff";
  if (value >= 256) return "#70f0ff";
  if (value >= 128) return "#7af0a7";
  return "#8fb5ff";
}

// Identity-tier robot busts: each compression tier reveals a more complete
// archive entity, so the read is "tier evolved", not "number doubled".
const ARCHIVE_BOT_SPRITES: Readonly<Record<number, string>> = {
  2: archiveBot0002Url,
  4: archiveBot0004Url,
  8: archiveBot0008Url,
  16: archiveBot0016Url,
  32: archiveBot0032Url,
  64: archiveBot0064Url,
  128: archiveBot0128Url,
  256: archiveBot0256Url,
  512: archiveBot0512Url,
  1024: archiveBot1024Url,
  2048: archiveBot2048Url,
};

function tileSprite(value: number): string {
  if (value <= 0) return "";
  if (ARCHIVE_BOT_SPRITES[value]) return ARCHIVE_BOT_SPRITES[value];
  // Beyond 2048 collapse into the sealed "core" identity; anything off the
  // power-of-two ladder falls back to the nearest known tier.
  if (value > 2048) return archiveBotCoreUrl;
  const ladder = Object.keys(ARCHIVE_BOT_SPRITES).map(Number).sort((a, b) => a - b);
  const nearest = ladder.filter((entry) => entry <= value).pop() ?? ladder[0];
  return ARCHIVE_BOT_SPRITES[nearest] ?? archiveBotCoreUrl;
}

// Synth cabinet voice: stamp on merge, slide on move, clinical denial on a
// rejected slide, rollback on failure. Builder/playtest puzzles rarely author
// audio, so the overlay falls back to these so the cabinet always "feels" wired.
const cue = (key: string, intensity?: number): AudioCueConfig => (intensity === undefined ? { key } : { key, intensity });
const ARCHIVE_AUDIO_FALLBACK = {
  move: cue("archive_tile_slide"),
  merge: cue("archive_tile_merge"),
  highMerge: cue("archive_identity_stamp", 0.9),
  invalid: cue("archive_denied"),
  fail: cue("archive_rollback"),
} as const;
