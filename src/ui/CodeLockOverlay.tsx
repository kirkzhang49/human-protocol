import { useEffect } from "react";
import type { LevelPuzzleDirection } from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface CodeLockOverlayProps {
  world: GameWorld;
}

interface CodeLockSnapshot {
  visible: boolean;
  puzzleId: string | null;
  label: string;
  input: string;
  length: number;
  error: string | null;
  directionOrder: readonly LevelPuzzleDirection[];
  hintLabel: string | null;
  hintDetail: string | null;
  submitLabel: string;
  language: GameLanguage;
}

const digitRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["CLR", "0", "DEL"],
] as const;

export function CodeLockOverlay({ world }: CodeLockOverlayProps) {
  const snapshot = usePolledSnapshot(() => readCodeLock(world), 80, sameCodeLockSnapshot);

  useEffect(() => {
    if (snapshot.visible) {
      releaseDesktopPointerLock();
    }
  }, [snapshot.visible]);

  if (!snapshot.visible) return null;

  const slots = Array.from({ length: snapshot.length }, (_, index) => snapshot.input[index] ?? "");

  return (
    <section className="code-lock-overlay" aria-label={snapshot.label}>
      <div className="code-lock-panel">
        <div className="code-lock-header">
          <span>{snapshot.language === "en" ? "Access code" : "门禁密码"}</span>
          <button
            type="button"
            onClick={() => {
              world.closeCodeLock();
              requestDesktopPointerLock();
            }}
            aria-label={snapshot.language === "en" ? "Close code panel" : "关闭密码面板"}
          >
            ×
          </button>
        </div>
        <strong className="code-lock-title">{snapshot.label}</strong>
        {snapshot.directionOrder.length > 0 ? (
          <div className="code-direction-strip" aria-label={snapshot.language === "en" ? "Direction order" : "方位顺序"}>
            {snapshot.directionOrder.map((direction) => (
              <span key={direction}>{directionLabel(direction, snapshot.language)}</span>
            ))}
          </div>
        ) : null}
        {snapshot.hintLabel || snapshot.hintDetail ? (
          <div className="code-lock-hint">
            {snapshot.hintLabel ? <span>{snapshot.hintLabel}</span> : null}
            {snapshot.hintDetail ? <p>{snapshot.hintDetail}</p> : null}
          </div>
        ) : null}
        <div
          className={snapshot.error ? "code-slots error" : "code-slots"}
          style={{ "--code-length": snapshot.length } as React.CSSProperties}
          aria-live="polite"
        >
          {slots.map((digit, index) => (
            <span key={index}>{digit || "·"}</span>
          ))}
        </div>
        {snapshot.error ? <p className="code-lock-error">{snapshot.error}</p> : null}
        <div className="code-keypad">
          {digitRows.flat().map((key) => (
            <button
              key={key}
              type="button"
              className={key.length === 1 ? "digit" : "utility"}
              onClick={() => {
                if (key === "CLR") {
                  world.clearCodeLockInput();
                } else if (key === "DEL") {
                  world.backspaceCodeLock();
                } else {
                  world.inputCodeLockDigit(key);
                }
              }}
            >
              {key === "CLR" ? (snapshot.language === "en" ? "Clear" : "清除") : key === "DEL" ? (snapshot.language === "en" ? "Del" : "退格") : key}
            </button>
          ))}
        </div>
        <button
          className="code-submit"
          type="button"
          onClick={() => {
            if (world.submitCodeLock()) {
              requestDesktopPointerLock();
            }
          }}
        >
          {snapshot.submitLabel}
        </button>
      </div>
    </section>
  );
}

function readCodeLock(world: GameWorld): CodeLockSnapshot {
  const puzzle = world.activeCodeLockPuzzle();
  if (!puzzle) {
    return {
      visible: false,
      puzzleId: null,
      label: "",
      input: "",
      length: 0,
      error: null,
      directionOrder: [],
      hintLabel: null,
      hintDetail: null,
      submitLabel: world.settings.language === "en" ? "Confirm" : "确认",
      language: world.settings.language,
    };
  }

  return {
    visible: true,
    puzzleId: puzzle.id,
    label: world.configText(puzzle.label),
    input: world.session.activeCodeLockInput,
    length: puzzle.input.length,
    error: world.session.codeLockError,
    directionOrder: puzzle.code.directionOrder ?? [],
    hintLabel: puzzle.code.hint?.label ? world.configText(puzzle.code.hint.label) : null,
    hintDetail: puzzle.code.hint?.detail ? world.configText(puzzle.code.hint.detail) : null,
    submitLabel: world.configText(puzzle.input.submitLabel ?? "确认"),
    language: world.settings.language,
  };
}

function sameCodeLockSnapshot(current: CodeLockSnapshot, next: CodeLockSnapshot) {
  return (
    current.visible === next.visible &&
    current.puzzleId === next.puzzleId &&
    current.label === next.label &&
    current.input === next.input &&
    current.length === next.length &&
    current.error === next.error &&
    current.hintLabel === next.hintLabel &&
    current.hintDetail === next.hintDetail &&
    current.submitLabel === next.submitLabel &&
    current.language === next.language &&
    current.directionOrder.join("|") === next.directionOrder.join("|")
  );
}

function directionLabel(direction: LevelPuzzleDirection, language: GameLanguage) {
  if (language === "en") {
    if (direction === "north") return "North";
    if (direction === "east") return "East";
    if (direction === "south") return "South";
    return "West";
  }
  if (direction === "north") return "北";
  if (direction === "east") return "东";
  if (direction === "south") return "南";
  return "西";
}
