import { useEffect, useRef, useState, type CSSProperties } from "react";
import echoAvatarUrl from "../assets/gui/hp-gui-elevator-avatar-echo-image2-v1.png";
import selfAvatarUrl from "../assets/gui/hp-gui-elevator-avatar-self-image2-v1.png";
import { preloadGameAssets } from "../assets/preloadGameAssets";
import type { GameMode } from "../game/core/GameMode";
import { campaignTransitionDialogueFor, type CampaignTransitionDialogueCopy } from "../game/config/campaignTransitionDialogues";
import { localizedFlow, localizedLevelTitle } from "../game/config/LevelLocalization";
import type { GameWorld } from "../game/core/GameWorld";
import type { GameLanguage } from "../game/core/GameSettings";
import { progressStatEffects, type LevelSettlementState, type ProgressStatId } from "../game/core/PlayerProgress";
import { playerStrings } from "../i18n/playerStrings";
import { ConfigPackPanel } from "./ConfigPackPanel";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { clamp01, loadingAssetProgress, loadingGpuProgress, visibleProgressScale } from "./guiMath";
import { usePolledSnapshot } from "./usePolledSnapshot";
import { exitAscentProgress, exitCinematicWhiteOutProgress } from "../game/core/ExitCinematicTiming";

interface GameFlowOverlayProps {
  world: GameWorld;
}

interface FlowSnapshot {
  mode: GameMode;
  levelId: string;
  message: string;
  revivesUsed: number;
  platform: string;
  rewardedAvailable: boolean;
  memoryFragments: number;
  bestKillStreak: number;
  upgradeCount: number;
  memoryCacheTier: number;
  deathReason: "combat" | null;
  nextCacheRemaining: number;
  memoryRewardDoubled: boolean;
  settlement: LevelSettlementState | null;
  progressLevel: number;
  nextProgressMemory: number;
  pendingStatPoints: number;
  progressStats: Record<ProgressStatId, number>;
  nextCampaignLevelId: string | null;
  nextCampaignLevelTitle: string | null;
  language: GameLanguage;
  exitCinematicProgress: number;
  exitCinematicAscent: number;
  exitCinematicWhiteOut: number;
  campaignTransitionDialogue: CampaignTransitionDialogueCopy | null;
  campaignTransitionLineIndex: number;
}

interface ActiveCampaignTransitionDialogue {
  dialogue: CampaignTransitionDialogueCopy;
  index: number;
}

type CampaignTransitionSpeakerSide = "self" | "echo";

const inactiveProgressStats: Record<ProgressStatId, number> = {
  health: 0,
  attack: 0,
  defense: 0,
  energy: 0,
};

export function GameFlowOverlay({ world }: GameFlowOverlayProps) {
  const snapshot = usePolledSnapshot(() => readSnapshot(world), 180, sameFlowSnapshot);
  const showConfigPackPanel = configPackToolsEnabled();
  const [levelTransfer, setLevelTransfer] = useState<{
    targetId: string;
    targetTitle: string;
    progress: number;
    phase: string;
    error?: string;
  } | null>(null);
  const [campaignTransitionPreview, setCampaignTransitionPreview] = useState<ActiveCampaignTransitionDialogue | null>(() =>
    campaignTransitionPreviewFromUrl(world, world.settings.language),
  );

  useEffect(() => {
    if (snapshot.mode !== "playing") {
      releaseDesktopPointerLock();
    }
  }, [snapshot.mode]);

  const campaignTransition = campaignTransitionPreview ??
    (snapshot.campaignTransitionDialogue
      ? {
          dialogue: snapshot.campaignTransitionDialogue,
          index: snapshot.campaignTransitionLineIndex,
        }
      : null);

  if (campaignTransition) {
    return (
      <CampaignTransitionDialogueOverlay
        active={campaignTransition}
        language={snapshot.language}
        onAdvance={() => {
          if (campaignTransitionPreview) {
            const nextIndex = campaignTransitionPreview.index + 1;
            if (nextIndex < campaignTransitionPreview.dialogue.lines.length) {
              setCampaignTransitionPreview({ ...campaignTransitionPreview, index: nextIndex });
              return;
            }
            setCampaignTransitionPreview(null);
            return;
          }
          world.advanceCampaignTransitionDialogue();
        }}
      />
    );
  }

  if (levelTransfer) {
    return (
      <LevelTransferLoading
        targetTitle={levelTransfer.targetTitle}
        progress={levelTransfer.progress}
        phase={levelTransfer.phase}
        error={levelTransfer.error}
        language={snapshot.language}
      />
    );
  }

  if (snapshot.levelId !== world.level.id) {
    return null;
  }

  if (snapshot.mode === "title") {
    const titleFlow = localizedFlow(world.level, snapshot.language).title;
    return (
      <section className="flow-overlay flow-entry-overlay">
        <div className="flow-panel flow-panel-entry">
          <span className="flow-system">{titleFlow.system}</span>
          <h1>{titleFlow.heading}</h1>
          <p>{titleFlow.body}</p>
          <div className="flow-signal-strip" aria-hidden="true">
            {titleFlow.signalStrip.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              void startCurrentRunWithWarmup({
                world,
                targetTitle: localizedLevelTitle(world.level, snapshot.language),
                language: snapshot.language,
                setLevelTransfer,
                start: () => world.startDemo(),
              });
            }}
          >
            {titleFlow.startButton}
          </button>
          {showConfigPackPanel ? <ConfigPackPanel world={world} /> : null}
        </div>
      </section>
    );
  }

  if (snapshot.mode === "death") {
    const deathFlow = localizedFlow(world.level, snapshot.language).death;
    const english = snapshot.language === "en";
    return (
      <section className="flow-overlay compact flow-death-overlay">
        <div className="flow-panel flow-panel-death">
          <span className="flow-system">{deathFlow.system}</span>
          <h2>{deathFlow.heading}</h2>
          <p>
            {snapshot.message} {snapshot.platform === "itch" ? deathFlow.itchSuffix : ""}
          </p>
          <div className="flow-stats death-stats" aria-label={english ? "Death summary" : "死亡总结"}>
            <span>{english ? "Clues" : "线索"} {snapshot.memoryFragments}</span>
            <span>{english ? "Best streak" : "最佳连杀"} {snapshot.bestKillStreak}</span>
            <span>{english ? "Supply" : "补给"} {snapshot.memoryCacheTier}/3</span>
          </div>
          <p className="revive-offer">
            {deathFlow.reviveOfferPrefix}
            {snapshot.nextCacheRemaining > 0
              ? english
                ? ` ${snapshot.nextCacheRemaining} until next supply.`
                : ` 距下一份补给 ${snapshot.nextCacheRemaining}。`
              : ` ${deathFlow.cacheReadyText}`}
          </p>
          <div className="flow-actions">
            <button
              type="button"
              onClick={() => {
                void world.requestRevive().then(() => requestDesktopPointerLock());
              }}
            >
              {snapshot.revivesUsed > 0
                ? deathFlow.restartAfterReviveUsedButton
                : snapshot.rewardedAvailable
                  ? deathFlow.reviveButtonRewarded
                  : deathFlow.reviveButtonLocal}
            </button>
            <button
              type="button"
              onClick={() => {
                void startCurrentRunWithWarmup({
                  world,
                  targetTitle: localizedLevelTitle(world.level, snapshot.language),
                  language: snapshot.language,
                  setLevelTransfer,
                  start: () => world.restartFromDeath(),
                });
              }}
            >
              {deathFlow.restartButton}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (snapshot.mode === "transition") {
    const transitionFlow = localizedFlow(world.level, snapshot.language).transition;
    return (
      <section className="flow-overlay transition flow-transition-overlay">
        <div className="flow-panel flow-panel-transition">
          <span className="flow-system">{transitionFlow.system}</span>
          <h2>{transitionFlow.heading}</h2>
          <p>{snapshot.message}</p>
        </div>
      </section>
    );
  }

  if (snapshot.mode === "exitCinematic") {
    if (snapshot.exitCinematicAscent <= 0.02 && snapshot.exitCinematicWhiteOut <= 0.02) return null;
    const english = snapshot.language === "en";
    return (
      <section
        className="exit-cinematic-overlay"
        style={
          {
            "--exit-ascent": snapshot.exitCinematicAscent,
            "--exit-whiteout": snapshot.exitCinematicWhiteOut,
          } as CSSProperties
        }
        aria-live="polite"
      >
        <div className="exit-cinematic-shaft" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="exit-cinematic-door" aria-hidden="true">
          <i />
          <b />
        </div>
        <div className="exit-cinematic-readout">
          <span>{english ? "SERVICE LIFT" : "白光电梯"}</span>
          <strong>
            {snapshot.exitCinematicWhiteOut > 0.18
              ? english
                ? "TRANSFER"
                : "传输确认"
              : snapshot.exitCinematicAscent > 0.08
                ? english
                  ? "ASCENDING"
                  : "上升中"
                : english
                  ? "ENTERING"
                  : "进入中"}
          </strong>
        </div>
      </section>
    );
  }

  if (snapshot.mode === "victory") {
    const victoryFlow = localizedFlow(world.level, snapshot.language).victory;
    const english = snapshot.language === "en";
    const memoryGained = snapshot.settlement?.memoryGained ?? snapshot.memoryFragments;
    const levelDelta = snapshot.settlement && snapshot.settlement.levelAfter > snapshot.settlement.levelBefore
      ? snapshot.settlement.levelAfter - snapshot.settlement.levelBefore
      : 0;
    return (
      <section className="flow-overlay flow-victory-overlay">
        <div className="flow-panel flow-panel-victory">
          <span className="flow-system">{victoryFlow.system}</span>
          <h2>{victoryFlow.heading}</h2>
          <p>{victoryFlow.body}</p>
          <div className="victory-metrics" aria-label={english ? "Run summary" : "本局总结"}>
            <span>
              <em>{english ? "Clues" : "线索"}</em>
              <strong>{snapshot.memoryFragments}</strong>
            </span>
            <span>
              <em>{english ? "Streak" : "连杀"}</em>
              <strong>{snapshot.bestKillStreak}</strong>
            </span>
            <span>
              <em>{english ? "Supply" : "补给"}</em>
              <strong>{snapshot.memoryCacheTier}/3</strong>
            </span>
          </div>
          <div className="memory-settlement victory-memory" aria-label={english ? "Memory score settlement" : "记忆积分结算"}>
            <span>{english ? "Memory" : "记忆"}</span>
            <strong>
              +{memoryGained} · {english ? `Lv.${snapshot.progressLevel}` : `等级 ${snapshot.progressLevel}`}{levelDelta > 0 ? ` ↑${levelDelta}` : ""}
            </strong>
            <em>
              {snapshot.nextProgressMemory > 0
                ? english
                  ? `${snapshot.nextProgressMemory} to next level`
                  : `还差 ${snapshot.nextProgressMemory} 积分升级`
                : english
                  ? "Current level cap reached"
                  : "当前试玩等级已到上限"}
            </em>
          </div>
          {snapshot.pendingStatPoints > 0 ? (
            <div className="victory-training-compact">
              <ProgressTraining world={world} snapshot={snapshot} />
            </div>
          ) : null}
          <div className="victory-actions">
            {snapshot.nextCampaignLevelId && snapshot.nextCampaignLevelTitle ? (
              <button
                className="victory-primary-button"
                type="button"
                onClick={() => {
                  void loadNextLevelWithWarmup({
                    world,
                    targetId: snapshot.nextCampaignLevelId!,
                    targetTitle: snapshot.nextCampaignLevelTitle!,
                    language: snapshot.language,
                    setLevelTransfer,
                  });
                }}
              >
                {snapshot.language === "en" ? "Next level: " : "进入下一关："}{snapshot.nextCampaignLevelTitle}
              </button>
            ) : null}
            <div className="victory-secondary-actions">
              <button
                className="double-memory-button"
                type="button"
                disabled={snapshot.memoryRewardDoubled}
                onClick={() => world.claimDoubleMemoryReward()}
              >
                {snapshot.memoryRewardDoubled ? victoryFlow.doubleMemoryClaimedButton : victoryFlow.doubleMemoryButton}
              </button>
              <button
                type="button"
                onClick={() => {
                  void startCurrentRunWithWarmup({
                    world,
                    targetTitle: localizedLevelTitle(world.level, snapshot.language),
                    language: snapshot.language,
                    setLevelTransfer,
                    start: () => world.startDemo(),
                  });
                }}
              >
                {victoryFlow.replayButton}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return null;
}

function CampaignTransitionDialogueOverlay({
  active,
  language,
  onAdvance,
}: {
  active: ActiveCampaignTransitionDialogue;
  language: GameLanguage;
  onAdvance: () => void;
}) {
  const advanceRef = useRef(onAdvance);
  const line = active.dialogue.lines[active.index];
  const activeSide = campaignTransitionSpeakerSide(line.speaker);
  const selfLabel = language === "en" ? "Me" : "我";
  const advanceLabel =
    active.index + 1 >= active.dialogue.lines.length
      ? active.dialogue.continueLabel
      : language === "en"
        ? "Continue"
        : "继续";

  useEffect(() => {
    advanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    const timer = window.setTimeout(() => advanceRef.current(), 3000);
    return () => window.clearTimeout(timer);
  }, [active.dialogue.id, active.index]);

  return (
    <button className={`campaign-transition-dialogue ${line.tone}`} type="button" onClick={onAdvance}>
      <span
        className={`campaign-transition-avatar campaign-transition-avatar-self${activeSide === "self" ? " active" : ""}`}
        aria-hidden="true"
      >
        <img src={selfAvatarUrl} alt="" />
        <b>{selfLabel}</b>
      </span>
      <span
        className={`campaign-transition-avatar campaign-transition-avatar-echo${activeSide === "echo" ? " active" : ""}`}
        aria-hidden="true"
      >
        <img src={echoAvatarUrl} alt="" />
        <b>?</b>
      </span>
      <span className="campaign-transition-speaker">{line.speaker}</span>
      <span className="campaign-transition-line">{line.line}</span>
      <span className="campaign-transition-footer">
        <b>{advanceLabel}</b>
      </span>
    </button>
  );
}

function campaignTransitionSpeakerSide(speaker: string): CampaignTransitionSpeakerSide {
  return speaker === "?" ? "echo" : "self";
}

function LevelTransferLoading({
  targetTitle,
  progress,
  phase,
  error,
  language,
}: {
  targetTitle: string;
  progress: number;
  phase: string;
  error?: string;
  language: GameLanguage;
}) {
  const clamped = clamp01(progress);
  const transfer = playerStrings(language).transfer;
  return (
    <section className="flow-overlay level-transfer-overlay" aria-live="polite">
      <div className="level-transfer-panel">
        <span className="flow-system level-transfer-kicker">{error ? transfer.blocked : transfer.warmup}</span>
        <h2 className="level-transfer-title">{targetTitle}</h2>
        <div className="level-transfer-radar" aria-hidden="true">
          <i />
          <b />
        </div>
        <div className="level-transfer-readout">
          <span className="level-transfer-phase">{error ?? phase}</span>
          <strong className="level-transfer-percent">{error ? "!" : `${Math.round(clamped * 100)}%`}</strong>
        </div>
        <div className="level-transfer-bar" aria-hidden="true">
          <i style={{ transform: `scaleX(${visibleProgressScale(clamped)})` }} />
        </div>
        <div className="level-transfer-ticks" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index} className={index / 17 <= clamped ? "active" : ""} />
          ))}
        </div>
      </div>
    </section>
  );
}

async function loadNextLevelWithWarmup({
  world,
  targetId,
  targetTitle,
  language,
  setLevelTransfer,
}: {
  world: GameWorld;
  targetId: string;
  targetTitle: string;
  language: GameLanguage;
  setLevelTransfer: (state: {
    targetId: string;
    targetTitle: string;
    progress: number;
    phase: string;
    error?: string;
  } | null) => void;
}) {
  const labels =
    language === "en"
      ? {
          reserve: "Reserving memory lanes",
          assets: "Confirming model and texture cache",
          gpu: "Priming render buffers",
          handoff: "Opening sector door",
          error: "Transfer failed. Try again.",
        }
      : {
          reserve: "预留记忆通道",
          assets: "确认模型与贴图缓存",
          gpu: "预热渲染缓冲",
          handoff: "打开下一段舱门",
          error: "切换失败，请重试。",
        };

  const update = (progress: number, phase: string) => {
    setLevelTransfer({ targetId, targetTitle, progress, phase });
  };

  try {
    releaseDesktopPointerLock();
    update(0.06, labels.reserve);
    await waitForPaintFrames(2);
    await preloadWarmupAssets((assetProgress) => {
      update(loadingAssetProgress(assetProgress), labels.assets);
    });
    update(0.72, labels.gpu);
    await waitForIdleOrTimeout(180);
    await animateProgress(360, (progress) => update(progress, labels.gpu));
    update(0.97, labels.handoff);
    await waitForPaintFrames(2);
    world.renderWarmupComplete = false;
    world.loadLevel(targetId, "playing");
    update(0.99, labels.handoff);
    await waitForRenderWarmup(world, 1100);
    await waitForPaintFrames(1);
    requestDesktopPointerLock();
    setLevelTransfer(null);
  } catch {
    setLevelTransfer({ targetId, targetTitle, progress: 1, phase: labels.error, error: labels.error });
  }
}

async function startCurrentRunWithWarmup({
  world,
  targetTitle,
  language,
  setLevelTransfer,
  start,
}: {
  world: GameWorld;
  targetTitle: string;
  language: GameLanguage;
  setLevelTransfer: (state: {
    targetId: string;
    targetTitle: string;
    progress: number;
    phase: string;
    error?: string;
  } | null) => void;
  start: () => void;
}) {
  const labels =
    language === "en"
      ? {
          reserve: "Opening play channel",
          assets: "Loading room assets",
          gpu: "Priming render buffers",
          handoff: "Entering",
          error: "Start failed. Try again.",
        }
      : {
          reserve: "打开游玩通道",
          assets: "加载房间资产",
          gpu: "预热渲染缓冲",
          handoff: "进入中",
          error: "进入失败，请重试。",
        };

  const targetId = world.level.id;
  const update = (progress: number, phase: string) => {
    setLevelTransfer({ targetId, targetTitle, progress, phase });
  };

  try {
    releaseDesktopPointerLock();
    update(0.05, labels.reserve);
    await waitForPaintFrames(2);
    await preloadWarmupAssets((assetProgress) => {
      update(loadingAssetProgress(assetProgress), labels.assets);
    });
    update(0.72, labels.gpu);
    await waitForIdleOrTimeout(180);
    await animateProgress(320, (progress) => update(progress, labels.gpu));
    update(0.97, labels.handoff);
    await waitForPaintFrames(1);
    start();
    await waitForRenderWarmup(world, 1100);
    await waitForPaintFrames(1);
    requestDesktopPointerLock();
    setLevelTransfer(null);
  } catch {
    setLevelTransfer({ targetId, targetTitle, progress: 1, phase: labels.error, error: labels.error });
  }
}

function waitForPaintFrames(count: number) {
  return new Promise<void>((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}

function waitForIdleOrTimeout(timeout: number) {
  return new Promise<void>((resolve) => {
    const idle = window.requestIdleCallback as ((callback: () => void, options?: { timeout: number }) => number) | undefined;
    if (idle) {
      idle(() => resolve(), { timeout });
      return;
    }
    window.setTimeout(resolve, timeout);
  });
}

function waitForRenderWarmup(world: GameWorld, timeout: number) {
  const startedAt = performance.now();
  return new Promise<void>((resolve) => {
    const step = () => {
      if (world.renderWarmupComplete || performance.now() - startedAt >= timeout) {
        resolve();
        return;
      }
      window.requestAnimationFrame(step);
    };
    step();
  });
}

async function preloadWarmupAssets(onProgress: (progress: number) => void, timeoutMs = 3200) {
  let active = true;
  const preload = preloadGameAssets(
    (progress) => {
      if (active) onProgress(progress);
    },
    { includeEnvironmentModels: true },
  );

  const result = await Promise.race([
    preload.then(
      () => "complete" as const,
      (error: unknown) => {
        throw error;
      },
    ),
    new Promise<"timeout">((resolve) => {
      window.setTimeout(() => resolve("timeout"), timeoutMs);
    }),
  ]);

  active = false;
  if (result === "timeout") {
    preload.catch((error: unknown) => {
      console.warn("[HumanProtocol] Warmup asset preload continued in background and failed.", error);
    });
  }
}

function animateProgress(duration: number, update: (progress: number) => void) {
  const startedAt = performance.now();
  return new Promise<void>((resolve) => {
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      update(loadingGpuProgress(t));
      if (t >= 1) {
        resolve();
        return;
      }
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  });
}

function configPackToolsEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("config") === "1" ||
    params.get("debug") === "config" ||
    (import.meta.env.DEV && params.get("debug") === "1")
  );
}

function campaignTransitionPreviewFromUrl(world: GameWorld, language: GameLanguage): ActiveCampaignTransitionDialogue | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const preview = new URLSearchParams(window.location.search).get("transitionPreview");
  const pair =
    preview === "level_02_to_03"
      ? ["level_02_residential_simulation", "level_03_human_museum"]
      : preview === "level_03_to_04"
        ? ["level_03_human_museum", "level_04_memory_clinic"]
        : preview === "level_04_to_05"
          ? ["level_04_memory_clinic", "level_05_reclamation_core"]
          : null;
  if (!pair || world.level.id !== pair[0]) return null;
  const dialogue = campaignTransitionDialogueFor(pair[0], pair[1], language);
  if (!dialogue) return null;
  return {
    dialogue,
    index: 0,
  };
}

function readSnapshot(world: GameWorld): FlowSnapshot {
  const mode = world.session.mode;
  const nextCampaignLevel = world.nextCampaignLevel();
  const nextCampaignLevelTitle = nextCampaignLevel ? localizedLevelTitle(nextCampaignLevel, world.settings.language) : null;
  const activeCampaignTransition = world.session.activeCampaignTransitionDialogue;
  const campaignTransitionDialogue = activeCampaignTransition
    ? campaignTransitionDialogueFor(activeCampaignTransition.fromLevelId, activeCampaignTransition.toLevelId, world.settings.language)
    : null;
  if (mode !== "title" && mode !== "death" && mode !== "exitCinematic" && mode !== "transition" && mode !== "victory") {
    return {
      mode,
      levelId: world.level.id,
      message: "",
      revivesUsed: 0,
      platform: world.platform.platform,
      rewardedAvailable: false,
      memoryFragments: 0,
      bestKillStreak: 0,
      upgradeCount: 0,
      memoryCacheTier: 0,
      deathReason: null,
      nextCacheRemaining: 0,
      memoryRewardDoubled: false,
      settlement: null,
      progressLevel: world.playerProgress.level,
      nextProgressMemory: 0,
      pendingStatPoints: 0,
      progressStats: inactiveProgressStats,
      nextCampaignLevelId: nextCampaignLevel?.id ?? null,
      nextCampaignLevelTitle,
      language: world.settings.language,
      exitCinematicProgress: 0,
      exitCinematicAscent: 0,
      exitCinematicWhiteOut: 0,
      campaignTransitionDialogue: null,
      campaignTransitionLineIndex: 0,
    };
  }

  const exitCinematic = world.session.activeExitCinematic;
  const exitCinematicProgress = exitCinematic ? clamp01(exitCinematic.elapsed / Math.max(0.001, exitCinematic.duration)) : 0;
  const exitCinematicAscent = exitAscentProgress(exitCinematic);
  const exitCinematicWhiteOut = exitCinematicWhiteOutProgress(exitCinematic);

  return {
    mode,
    levelId: world.level.id,
    message: world.session.message,
    revivesUsed: world.session.revivesUsed,
    platform: world.platform.platform,
    rewardedAvailable: world.platform.canShowRewardedAd(),
    memoryFragments: world.session.memoryFragments,
    bestKillStreak: world.session.bestKillStreak,
    upgradeCount: world.session.appliedUpgradeIds.length,
    memoryCacheTier: world.session.memoryCacheTier,
    deathReason: world.session.deathReason,
    nextCacheRemaining: nextCacheRemaining(world.session.memoryFragments, world.level.economy.memoryCacheMilestones.map((milestone) => milestone.amount)),
    memoryRewardDoubled: world.session.memoryRewardDoubled,
    settlement: world.session.settlement,
    progressLevel: world.playerProgress.level,
    nextProgressMemory: world.memoryToNextProgressLevel(),
    pendingStatPoints: world.playerProgress.pendingStatPoints,
    progressStats: { ...world.playerProgress.stats },
    nextCampaignLevelId: nextCampaignLevel?.id ?? null,
    nextCampaignLevelTitle,
    language: world.settings.language,
    exitCinematicProgress,
    exitCinematicAscent,
    exitCinematicWhiteOut,
    campaignTransitionDialogue,
    campaignTransitionLineIndex: activeCampaignTransition?.lineIndex ?? 0,
  };
}

function sameFlowSnapshot(current: FlowSnapshot, next: FlowSnapshot) {
  return (
    current.mode === next.mode &&
    current.levelId === next.levelId &&
    current.message === next.message &&
    current.revivesUsed === next.revivesUsed &&
    current.platform === next.platform &&
    current.rewardedAvailable === next.rewardedAvailable &&
    current.memoryFragments === next.memoryFragments &&
    current.bestKillStreak === next.bestKillStreak &&
    current.upgradeCount === next.upgradeCount &&
    current.memoryCacheTier === next.memoryCacheTier &&
    current.deathReason === next.deathReason &&
    current.nextCacheRemaining === next.nextCacheRemaining &&
    current.memoryRewardDoubled === next.memoryRewardDoubled &&
    current.settlement === next.settlement &&
    current.progressLevel === next.progressLevel &&
    current.nextProgressMemory === next.nextProgressMemory &&
    current.pendingStatPoints === next.pendingStatPoints &&
    current.nextCampaignLevelId === next.nextCampaignLevelId &&
    current.nextCampaignLevelTitle === next.nextCampaignLevelTitle &&
    current.language === next.language &&
    Math.abs(current.exitCinematicProgress - next.exitCinematicProgress) < 0.02 &&
    Math.abs(current.exitCinematicAscent - next.exitCinematicAscent) < 0.02 &&
    Math.abs(current.exitCinematicWhiteOut - next.exitCinematicWhiteOut) < 0.02 &&
    current.campaignTransitionDialogue?.id === next.campaignTransitionDialogue?.id &&
    current.campaignTransitionLineIndex === next.campaignTransitionLineIndex &&
    current.progressStats.health === next.progressStats.health &&
    current.progressStats.attack === next.progressStats.attack &&
    current.progressStats.defense === next.progressStats.defense &&
    current.progressStats.energy === next.progressStats.energy
  );
}

function ProgressTraining({ world, snapshot }: { world: GameWorld; snapshot: FlowSnapshot }) {
  const points = snapshot.pendingStatPoints;
  const english = snapshot.language === "en";
  return (
    <div className="progress-training" aria-label={english ? "Attribute training" : "属性训练"}>
      <div className="progress-training-title">
        <span>{english ? `Points ${points}` : `可分配 ${points}`}</span>
        <strong>{english ? "Memory Training" : "记忆训练"}</strong>
      </div>
      <div className="progress-training-grid">
        <TrainingButton
          stat="health"
          label={english ? "Health" : "生命"}
          value={`+${snapshot.progressStats.health * progressStatEffects.healthPerPoint}`}
          detail={english ? `Next max +${progressStatEffects.healthPerPoint}` : `下次上限 +${progressStatEffects.healthPerPoint}`}
          disabled={points <= 0}
          world={world}
        />
        <TrainingButton
          stat="attack"
          label={english ? "Attack" : "攻击"}
          value={`+${Math.round(snapshot.progressStats.attack * progressStatEffects.attackPerPoint * 100)}%`}
          detail={english ? `All damage +${Math.round(progressStatEffects.attackPerPoint * 100)}%` : `所有伤害 +${Math.round(progressStatEffects.attackPerPoint * 100)}%`}
          disabled={points <= 0}
          world={world}
        />
        <TrainingButton
          stat="defense"
          label={english ? "Defense" : "防御"}
          value={`-${Math.round(snapshot.progressStats.defense * progressStatEffects.defensePerPoint * 100)}%`}
          detail={english ? `Damage taken -${Math.round(progressStatEffects.defensePerPoint * 100)}%` : `受伤降低 ${Math.round(progressStatEffects.defensePerPoint * 100)}%`}
          disabled={points <= 0}
          world={world}
        />
        <TrainingButton
          stat="energy"
          label={english ? "Stamina" : "精力"}
          value={`+${snapshot.progressStats.energy * progressStatEffects.energyPerPoint}`}
          detail={english ? `Next max +${progressStatEffects.energyPerPoint}` : `下次上限 +${progressStatEffects.energyPerPoint}`}
          disabled={points <= 0}
          world={world}
        />
      </div>
    </div>
  );
}

function TrainingButton({
  stat,
  label,
  value,
  detail,
  disabled,
  world,
}: {
  stat: ProgressStatId;
  label: string;
  value: string;
  detail: string;
  disabled: boolean;
  world: GameWorld;
}) {
  return (
    <button
      className="progress-training-button"
      disabled={disabled}
      type="button"
      onClick={() => world.spendProgressPoint(stat)}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </button>
  );
}

function nextCacheRemaining(memoryFragments: number, thresholds: readonly number[]) {
  const next = thresholds.find((amount) => memoryFragments < amount);
  return next ? next - memoryFragments : 0;
}
