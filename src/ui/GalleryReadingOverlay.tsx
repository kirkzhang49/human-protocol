import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import galleryReadingFrameUrl from "../assets/gui/hp-gui-gallery-reading-frame-image2.png";
import type {
  LevelGalleryReadingPaintingDefinition,
  LevelGalleryReadingPuzzleDefinition,
  LevelGalleryReadingQuestionDefinition,
} from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { playerStrings } from "../i18n/playerStrings";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { uiReadableVars } from "./guiMath";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface GalleryReadingOverlayProps {
  world: GameWorld;
}

interface GalleryReadingSnapshot {
  visible: boolean;
  puzzle: LevelGalleryReadingPuzzleDefinition | null;
  label: string;
  guidance: string;
  language: GameLanguage;
}

type Phase = "reading" | "correct" | "wrong";

const lineKindLabel: Record<string, { en: string; zh: string }> = {
  exhibit_label: { en: "LABEL", zh: "展签" },
  archive_record: { en: "ARCHIVE", zh: "档案" },
  visual_detail: { en: "DETAIL", zh: "细节" },
  facility_note: { en: "NOTE", zh: "注记" },
  hidden_hook: { en: "TRACE", zh: "暗线" },
};

export function GalleryReadingOverlay({ world }: GalleryReadingOverlayProps) {
  const snapshot = usePolledSnapshot(() => readGalleryReading(world), 80, sameGalleryReadingSnapshot);
  const puzzle = snapshot.puzzle;
  const en = snapshot.language === "en";
  // Gallery corpus copy is Chinese source-of-truth; translate on render via configText.
  const t = useCallback((value: string) => world.configText(value), [world, snapshot.language]);

  const run = useMemo(() => (puzzle ? buildRun(puzzle) : null), [puzzle?.id]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [phase, setPhase] = useState<Phase>("reading");
  const [activePaintingId, setActivePaintingId] = useState<string | null>(null);
  const [pickedChoiceId, setPickedChoiceId] = useState<string | null>(null);

  const question = run?.questions[questionIndex] ?? null;
  const paintings = useMemo(
    () => (puzzle && question ? paintingsForQuestion(puzzle, question) : []),
    [puzzle?.id, question?.id],
  );

  useEffect(() => {
    if (!snapshot.visible || !run) return;
    setQuestionIndex(0);
    setCorrectCount(0);
    setMistakes(0);
    setPhase("reading");
    setPickedChoiceId(null);
  }, [snapshot.visible, run]);

  useEffect(() => {
    setActivePaintingId(paintings[0]?.id ?? null);
    setPickedChoiceId(null);
    setPhase("reading");
  }, [question?.id]);

  useEffect(() => {
    if (snapshot.visible) releaseDesktopPointerLock();
  }, [snapshot.visible]);

  const closePanel = useCallback(() => {
    world.closeGalleryReading();
    requestDesktopPointerLock();
  }, [world]);

  const pickChoice = useCallback(
    (choiceId: string) => {
      if (!puzzle || !run || !question || phase !== "reading") return;
      world.emitConfiguredAudio(puzzle.audio?.select);
      setPickedChoiceId(choiceId);
      const isCorrect = choiceId === question.answerId;
      if (isCorrect) {
        const nextCorrect = correctCount + 1;
        setCorrectCount(nextCorrect);
        setPhase("correct");
        world.emitConfiguredAudio(puzzle.audio?.correct);
        window.setTimeout(() => {
          if (nextCorrect >= run.requiredCorrect) {
            world.submitGalleryReading();
            requestDesktopPointerLock();
            return;
          }
          setQuestionIndex((index) => Math.min(index + 1, run.questions.length - 1));
        }, 620);
        return;
      }
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      setPhase("wrong");
      world.emitConfiguredAudio(puzzle.audio?.wrong);
      window.setTimeout(() => {
        if (nextMistakes >= run.maxMistakes) {
          world.recordConfiguredPuzzleFailure(puzzle.id);
          world.emitConfiguredAudio(puzzle.audio?.fail ?? puzzle.fail?.audio);
          setQuestionIndex(0);
          setCorrectCount(0);
          setMistakes(0);
          setPhase("reading");
          setPickedChoiceId(null);
          return;
        }
        setPhase("reading");
        setPickedChoiceId(null);
      }, 560);
    },
    [correctCount, mistakes, phase, puzzle, question, run, world],
  );

  if (!snapshot.visible || !puzzle || !run || !question) return null;

  const activePainting = paintings.find((painting) => painting.id === activePaintingId) ?? paintings[0] ?? null;
  const guidance = snapshot.guidance || (en ? "Read the wall, then answer the archive." : "先读展画，再回答档案问询。");
  const total = run.requiredCorrect;
  const mistakesLeft = Math.max(0, run.maxMistakes - mistakes);

  return (
    <section
      className="gallery-reading-overlay"
      style={{ ...uiReadableVars(), "--gallery-reading-frame": `url("${galleryReadingFrameUrl}")` } as CSSProperties}
      aria-label={snapshot.label}
      onClick={(event) => {
        if (event.target === event.currentTarget) closePanel();
      }}
    >
      <div className="gallery-reading-panel" data-no-pointer-lock="true">
        <button
          type="button"
          className="gallery-reading-close"
          onClick={closePanel}
          aria-label={en ? "Close gallery reader" : "关闭展画审读机"}
        >
          ×
        </button>
        <header className="gallery-reading-head">
          <span>{en ? "Gallery reader" : "展画审读机"}</span>
          <strong>{snapshot.label}</strong>
          <em>
            {en ? "Cleared" : "已读"} {correctCount}/{total}
          </em>
        </header>

        <p className="gallery-reading-guidance">{guidance}</p>

        <main className="gallery-reading-stage">
          <section className="gallery-reading-evidence" aria-label={en ? "Evidence wall" : "证物墙"}>
            <div className="gallery-reading-tabs" role="tablist">
              {paintings.map((painting) => (
                <button
                  key={painting.id}
                  type="button"
                  role="tab"
                  aria-selected={painting.id === activePainting?.id}
                  className={painting.id === activePainting?.id ? "active" : ""}
                  onClick={() => setActivePaintingId(painting.id)}
                >
                  {t(painting.frameLabel ?? painting.title)}
                </button>
              ))}
            </div>
            {activePainting ? <EvidenceCard painting={activePainting} en={en} t={t} /> : null}
          </section>

          <section className="gallery-reading-query" aria-label={en ? "Archive question" : "档案问询"}>
            <div className="gallery-reading-prompt">
              <span>
                {en ? "Question" : "问询"} {questionIndex + 1}/{run.questions.length}
              </span>
              <strong>{t(question.prompt)}</strong>
            </div>
            <div className="gallery-reading-choices">
              {question.choices.map((choice) => {
                const isPicked = pickedChoiceId === choice.id;
                const reveal = phase !== "reading";
                const isAnswer = choice.id === question.answerId;
                const stateClass = reveal
                  ? isAnswer
                    ? " correct"
                    : isPicked
                      ? " wrong"
                      : ""
                  : "";
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={`gallery-reading-choice${stateClass}`}
                    disabled={phase !== "reading"}
                    onClick={() => pickChoice(choice.id)}
                  >
                    {t(choice.label)}
                  </button>
                );
              })}
            </div>
            <footer className="gallery-reading-meter">
              <span>{en ? "Tolerance" : "容错"}</span>
              <div className="gallery-reading-pips" aria-hidden="true">
                {Array.from({ length: run.maxMistakes }, (_, index) => (
                  <i key={index} className={index < mistakesLeft ? "live" : "spent"} />
                ))}
              </div>
            </footer>
          </section>
        </main>
      </div>
    </section>
  );
}

function EvidenceCard({ painting, en, t }: { painting: LevelGalleryReadingPaintingDefinition; en: boolean; t: (value: string) => string }) {
  const tint = paintingTint(painting.id);
  return (
    <article className="gallery-reading-card">
      <div
        className="gallery-reading-art"
        style={
          {
            "--gallery-art-a": tint.a,
            "--gallery-art-b": tint.b,
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <span className="gallery-reading-art-frame">
          {painting.frameLabel ? t(painting.frameLabel) : playerStrings(en ? "en" : "zh").gallery.frameFallback}
        </span>
        <strong>{t(painting.title)}</strong>
      </div>
      <ul className="gallery-reading-lines">
        {painting.lines.slice(0, 4).map((line, index) => (
          <li key={index}>
            <i>{(en ? lineKindLabel[line.kind]?.en : lineKindLabel[line.kind]?.zh) ?? ""}</i>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

interface GalleryRun {
  questions: readonly LevelGalleryReadingQuestionDefinition[];
  requiredCorrect: number;
  maxMistakes: number;
}

function buildRun(puzzle: LevelGalleryReadingPuzzleDefinition): GalleryRun {
  const perRun = Math.min(6, Math.max(3, Math.round(puzzle.questionsPerRun ?? Math.min(puzzle.questions.length, 3))));
  const pool = [...puzzle.questions];
  let state = hashString(`${puzzle.id}:gallery`) || 1;
  const nextRandom = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const picked: LevelGalleryReadingQuestionDefinition[] = [];
  while (picked.length < perRun && pool.length > 0) {
    const index = Math.floor(nextRandom() * pool.length) % pool.length;
    picked.push(pool.splice(index, 1)[0]);
  }
  const requiredCorrect = Math.min(picked.length, Math.max(1, puzzle.requiredCorrect ?? picked.length));
  const maxMistakes = Math.max(1, puzzle.maxMistakes ?? Math.max(2, Math.ceil(picked.length / 2)));
  return { questions: picked, requiredCorrect, maxMistakes };
}

function paintingsForQuestion(
  puzzle: LevelGalleryReadingPuzzleDefinition,
  question: LevelGalleryReadingQuestionDefinition,
): readonly LevelGalleryReadingPaintingDefinition[] {
  const byId = new Map(puzzle.paintings.map((painting) => [painting.id, painting]));
  const ids = question.paintingIds && question.paintingIds.length > 0 ? question.paintingIds : [question.answerId];
  const resolved = ids.map((id) => byId.get(id)).filter((painting): painting is LevelGalleryReadingPaintingDefinition => Boolean(painting));
  return resolved.length > 0 ? resolved : puzzle.paintings.slice(0, 4);
}

function readGalleryReading(world: GameWorld): GalleryReadingSnapshot {
  const puzzle = world.activeGalleryReadingPuzzle();
  return {
    visible: Boolean(puzzle),
    puzzle,
    label: puzzle ? world.configText(puzzle.label) : "",
    guidance: puzzle?.guidance ? world.configText(puzzle.guidance) : "",
    language: world.settings.language,
  };
}

function sameGalleryReadingSnapshot(current: GalleryReadingSnapshot, next: GalleryReadingSnapshot) {
  return (
    current.visible === next.visible &&
    current.puzzle?.id === next.puzzle?.id &&
    current.label === next.label &&
    current.guidance === next.guidance &&
    current.language === next.language
  );
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function paintingTint(id: string) {
  const hash = hashString(id);
  const hueA = hash % 360;
  const hueB = (hash >> 9) % 360;
  return {
    a: `hsl(${hueA}, 42%, 30%)`,
    b: `hsl(${hueB}, 38%, 16%)`,
  };
}
