import { useEffect, type CSSProperties } from "react";
import { localizedArticle, localizedQuiz } from "../game/config/LevelLocalization";
import type { LevelArticleDefinition, LevelQuizDefinition } from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import museumStoryFrameUrl from "../assets/gui/hp-gui-museum-story-frame-image2.png";
import humanOriginWallArtUrl from "../assets/gui/museum-wall-art/level03_human_origin.png";
import lastHumanWallArtUrl from "../assets/gui/museum-wall-art/level03_last_human.png";
import protocolDiagramWallArtUrl from "../assets/gui/museum-wall-art/level03_protocol_diagram.png";
import robotWorkerWallArtUrl from "../assets/gui/museum-wall-art/level03_robot_worker.png";
import l4StoryAwakenedMachineUrl from "../assets/gui/level04-story-paintings/l4_story_awakened_machine_image2_v1.png";
import l4StoryH0DischargeUrl from "../assets/gui/level04-story-paintings/l4_story_h0_discharge_image2_v1.png";
import l4StoryPreservedChildhoodUrl from "../assets/gui/level04-story-paintings/l4_story_preserved_childhood_image2_v1.png";
import l4StoryRescueLoopUrl from "../assets/gui/level04-story-paintings/l4_story_rescue_loop_image2_v1.png";
import { articleWallArtLabel } from "../i18n/playerStrings";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface ArticleQuizOverlayProps {
  world: GameWorld;
}

interface ArticleQuizSnapshot {
  mode: "hidden" | "article" | "quiz";
  article: LevelArticleDefinition | null;
  quiz: LevelQuizDefinition | null;
  language: GameLanguage;
}

export function ArticleQuizOverlay({ world }: ArticleQuizOverlayProps) {
  const snapshot = usePolledSnapshot(() => readSnapshot(world), 100, sameSnapshot);
  const visible = snapshot.mode !== "hidden";

  useEffect(() => {
    if (visible) releaseDesktopPointerLock();
  }, [visible]);

  if (!visible) return null;

  if (snapshot.mode === "article" && snapshot.article) {
    return <ArticlePanel world={world} article={snapshot.article} language={snapshot.language} />;
  }
  if (snapshot.mode === "quiz" && snapshot.quiz) {
    return <QuizPanel world={world} quiz={snapshot.quiz} language={snapshot.language} />;
  }
  return null;
}

function ArticlePanel({ world, article, language }: { world: GameWorld; article: LevelArticleDefinition; language: GameLanguage }) {
  const copy = localizedArticle(world.level, article, language);
  const art = wallArtForArticle(article.id, language);
  const closeArticle = () => {
    world.closeArticle(true);
    requestDesktopPointerLock();
  };
  return (
    <section className="code-lock-overlay archive-overlay museum-story-overlay" aria-label={copy.title} onClick={closeArticle}>
      <div className="museum-story-panel" style={{ "--museum-story-frame": `url(${museumStoryFrameUrl})` } as CSSProperties}>
        <div className="museum-story-content">
          <figure className="museum-story-art-frame" aria-label={art.label}>
            <img src={art.url} alt={art.label} />
          </figure>
          <div className="museum-story-copy">
            <div className="museum-story-titleblock">
              <strong className="code-lock-title">{copy.title}</strong>
            </div>
            <div className="archive-pages">
              {copy.pages.map((page, index) => (
                <article className="archive-page" key={page.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{page.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
        <span className="museum-story-close-hint">{language === "en" ? "Tap anywhere to leave" : "点击任意位置离开"}</span>
      </div>
    </section>
  );
}

function wallArtForArticle(articleId: string, language: GameLanguage) {
  const label = articleWallArtLabel(articleId, language);
  if (articleId.includes("l4_story_awakened_machine")) return { url: l4StoryAwakenedMachineUrl, label };
  if (articleId.includes("l4_story_preserved_childhood")) return { url: l4StoryPreservedChildhoodUrl, label };
  if (articleId.includes("l4_story_rescue_loop")) return { url: l4StoryRescueLoopUrl, label };
  if (articleId.includes("l4_story_h0_discharge")) return { url: l4StoryH0DischargeUrl, label };
  if (articleId.includes("protocol")) return { url: protocolDiagramWallArtUrl, label };
  if (articleId.includes("robot")) return { url: robotWorkerWallArtUrl, label };
  if (articleId.includes("last_human")) return { url: lastHumanWallArtUrl, label };
  return { url: humanOriginWallArtUrl, label };
}

function QuizPanel({ world, quiz, language }: { world: GameWorld; quiz: LevelQuizDefinition; language: GameLanguage }) {
  const copy = localizedQuiz(world.level, quiz, language);
  return (
    <section className="code-lock-overlay archive-overlay" aria-label={copy.title}>
      <div className="code-lock-panel archive-panel quiz-panel">
        <div className="code-lock-header">
          <span>{copy.systemLabel ?? (language === "en" ? "Archive check" : "档案校验")}</span>
          <button
            type="button"
            onClick={() => {
              world.closeQuiz();
              requestDesktopPointerLock();
            }}
            aria-label={language === "en" ? "Close question" : "关闭问答"}
          >
            x
          </button>
        </div>
        <strong className="code-lock-title">{copy.title}</strong>
        {copy.detail ? <p className="archive-subtitle">{copy.detail}</p> : null}
        <p className="quiz-question">{copy.question}</p>
        <div className="quiz-options">
          {copy.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`quiz-option ${option.tone ?? "system"}`}
              onClick={() => {
                world.chooseQuizOption(option.id);
                if (world.session.mode === "playing") requestDesktopPointerLock();
              }}
            >
              <span>{quizToneLabel(option.tone, language)}</span>
              <strong>{option.label}</strong>
              {option.detail ? <em>{option.detail}</em> : null}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function readSnapshot(world: GameWorld): ArticleQuizSnapshot {
  if (world.session.mode === "article") {
    return {
      mode: "article",
      article: world.activeArticle(),
      quiz: null,
      language: world.settings.language,
    };
  }
  if (world.session.mode === "quiz") {
    return {
      mode: "quiz",
      article: null,
      quiz: world.activeQuiz(),
      language: world.settings.language,
    };
  }
  return { mode: "hidden", article: null, quiz: null, language: world.settings.language };
}

function sameSnapshot(current: ArticleQuizSnapshot, next: ArticleQuizSnapshot) {
  return (
    current.mode === next.mode &&
    current.language === next.language &&
    current.article?.id === next.article?.id &&
    current.quiz?.id === next.quiz?.id
  );
}

function quizToneLabel(tone: string | undefined, language: GameLanguage) {
  if (language === "en") {
    if (tone === "reveal") return "file";
    if (tone === "threat") return "risk";
    if (tone === "player") return "self";
    return "logic";
  }
  if (tone === "reveal") return "档案";
  if (tone === "threat") return "风险";
  if (tone === "player") return "自我";
  return "逻辑";
}
