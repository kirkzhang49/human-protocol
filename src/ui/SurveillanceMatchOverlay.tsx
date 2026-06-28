import { useEffect, useState } from "react";
import type { LevelSurveillanceMatchPuzzleDefinition } from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface SurveillanceMatchOverlayProps {
  world: GameWorld;
}

interface SurveillanceSnapshot {
  visible: boolean;
  puzzle: LevelSurveillanceMatchPuzzleDefinition | null;
  label: string;
  language: GameLanguage;
}

export function SurveillanceMatchOverlay({ world }: SurveillanceMatchOverlayProps) {
  const snapshot = usePolledSnapshot(() => readSurveillance(world), 80, sameSurveillanceSnapshot);
  const puzzle = snapshot.puzzle;
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [mistakes, setMistakes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot.visible || !puzzle) return;
    setAssignments({});
    setMistakes(0);
    setError(null);
  }, [snapshot.visible, puzzle?.id]);

  useEffect(() => {
    if (snapshot.visible) releaseDesktopPointerLock();
  }, [snapshot.visible]);

  if (!snapshot.visible || !puzzle) return null;

  const en = snapshot.language === "en";
  const assignedCount = puzzle.channels.filter((channel) => assignments[channel.id]).length;
  const allAssigned = assignedCount === puzzle.channels.length;
  const maxMistakes = puzzle.maxMistakes ?? 3;

  const submit = () => {
    if (!allAssigned) return;
    const correct = puzzle.channels.every((channel) => assignments[channel.id] === channel.answerOptionId);
    if (correct) {
      world.submitSurveillanceMatch();
      requestDesktopPointerLock();
      return;
    }
    const nextMistakes = mistakes + 1;
    setMistakes(nextMistakes);
    if (nextMistakes >= maxMistakes) {
      world.recordConfiguredPuzzleFailure(puzzle.id);
      setAssignments({});
      setMistakes(0);
      setError(en ? "Pattern rejected. Feeds rescrambled." : "比对失败，监控画面已重排。");
    } else {
      setError(en ? `Mismatch detected (${nextMistakes}/${maxMistakes}).` : `存在错误匹配（${nextMistakes}/${maxMistakes}）。`);
    }
  };

  return (
    <section className="surveillance-overlay cyber-puzzle-overlay" aria-label={snapshot.label}>
      <div className="cyber-puzzle-panel" data-no-pointer-lock="true">
        <header className="cyber-puzzle-header">
          <div>
            <span>{en ? "Surveillance wall" : "监控比对"}</span>
            <strong>{snapshot.label}</strong>
          </div>
          <button
            type="button"
            onClick={() => {
              world.closeSurveillance();
              requestDesktopPointerLock();
            }}
            aria-label={en ? "Close surveillance panel" : "关闭监控面板"}
          >
            ×
          </button>
        </header>

        {puzzle.guidance ? <p className="cyber-puzzle-guidance">{world.configText(puzzle.guidance)}</p> : null}

        <div className="surveillance-feed-grid">
          {puzzle.channels.map((channel) => {
            const assigned = assignments[channel.id];
            const assignedOption = puzzle.options.find((option) => option.id === assigned) ?? null;
            return (
              <article key={channel.id} className={`surveillance-feed${assigned ? " assigned" : ""}`}>
                <header>
                  <span>{channel.label}</span>
                  <em aria-hidden="true">{en ? "REC" : "录制中"}</em>
                </header>
                <div className="surveillance-feed-screen" aria-hidden="true">
                  <strong>{channel.symbol}</strong>
                </div>
                {channel.feedDetail ? <p>{world.configText(channel.feedDetail)}</p> : null}
                <div className="surveillance-feed-options" role="group" aria-label={channel.label}>
                  {puzzle.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={assigned === option.id ? "selected" : ""}
                      onClick={() => {
                        setError(null);
                        setAssignments({ ...assignments, [channel.id]: option.id });
                      }}
                    >
                      {option.symbol ? `${option.symbol} ` : ""}
                      {world.configText(option.label)}
                    </button>
                  ))}
                </div>
                <footer>{assignedOption ? world.configText(assignedOption.label) : en ? "Unassigned" : "未指派"}</footer>
              </article>
            );
          })}
        </div>

        {error ? <p className="cyber-puzzle-error">{error}</p> : null}

        <div className="cyber-puzzle-actions">
          <span>{`${assignedCount}/${puzzle.channels.length} ${en ? "feeds tagged" : "画面已指派"}`}</span>
          <button type="button" disabled={!allAssigned} onClick={submit}>
            {en ? "Commit match" : "提交比对"}
          </button>
        </div>
      </div>
    </section>
  );
}

function readSurveillance(world: GameWorld): SurveillanceSnapshot {
  const puzzle = world.activeSurveillancePuzzle();
  return {
    visible: Boolean(puzzle),
    puzzle,
    label: puzzle ? world.configText(puzzle.label) : "",
    language: world.settings.language,
  };
}

function sameSurveillanceSnapshot(current: SurveillanceSnapshot, next: SurveillanceSnapshot) {
  return (
    current.visible === next.visible &&
    current.puzzle?.id === next.puzzle?.id &&
    current.label === next.label &&
    current.language === next.language
  );
}
