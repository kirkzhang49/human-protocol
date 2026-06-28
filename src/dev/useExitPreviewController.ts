import { useCallback, useEffect, useState } from "react";
import { createSingleLevelConfigPack, saveCustomConfigPackFromText } from "../game/config/ConfigPackStore";
import { normalizeLevelExitRoomReference } from "../game/config/shared/exitRoomReference";
import { isExitCinematicViewActive } from "../game/core/ExitCinematicView";
import type { LevelDefinition } from "../game/config/schema/levelConfig";
import type { GameWorld } from "../game/core/GameWorld";

type ExitPreviewPhase = "disabled" | "idle" | "loading" | "armed" | "hold" | "started";

export function useExitPreviewController(world: GameWorld, levelRevision: number) {
  const [exitCinematicUiHidden, setExitCinematicUiHidden] = useState(() => isExitCinematicUiSuppressed(world));
  const [gameplayUiHidden, setGameplayUiHidden] = useState(() => isGameplayUiSuppressed(world));
  const [exitPreviewPhase, setExitPreviewPhase] = useState<ExitPreviewPhase>(() => (isExitPreviewMode() ? "idle" : "disabled"));
  const [exitPreviewTargetKey, setExitPreviewTargetKey] = useState<string | null>(null);
  const canvasReadinessKey = `${world.level.id}:${levelRevision}`;
  const [readyCanvasKey, setReadyCanvasKey] = useState<string | null>(null);
  const canvasReady = readyCanvasKey === canvasReadinessKey;
  const handleCanvasReady = useCallback(() => {
    setReadyCanvasKey(canvasReadinessKey);
  }, [canvasReadinessKey]);

  useEffect(() => {
    let animationFrame = 0;
    let lastExitCinematicValue = isExitCinematicUiSuppressed(world);
    let lastGameplayValue = isGameplayUiSuppressed(world);
    setExitCinematicUiHidden(lastExitCinematicValue);
    setGameplayUiHidden(lastGameplayValue);
    const tick = () => {
      const nextExitCinematicValue = isExitCinematicUiSuppressed(world);
      const nextGameplayValue = isGameplayUiSuppressed(world);
      if (nextExitCinematicValue !== lastExitCinematicValue) {
        lastExitCinematicValue = nextExitCinematicValue;
        setExitCinematicUiHidden(nextExitCinematicValue);
      }
      if (nextGameplayValue !== lastGameplayValue) {
        lastGameplayValue = nextGameplayValue;
        setGameplayUiHidden(nextGameplayValue);
      }
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [world]);

  useEffect(() => {
    if (!import.meta.env.DEV || !isExitPreviewMode() || exitPreviewPhase !== "idle") return;
    let cancelled = false;
    setExitPreviewPhase("loading");
    void (async () => {
      const trialLevelId = await ensureBuilderTrialLevelFromUrl();
      if (cancelled) return;
      setReadyCanvasKey(null);
      loadExitPreviewLevel(world, trialLevelId ?? undefined);
      world.unlockExit();
      freezeExitPreviewWorld(world);
      world.activateExit("script");
      freezeExitPreviewWorld(world);
      setExitPreviewTargetKey(`${world.level.id}:${world.levelRevision}`);
      setExitPreviewPhase(isExitPreviewHoldMode() ? "hold" : "armed");
    })();
    return () => {
      cancelled = true;
    };
  }, [exitPreviewPhase, world]);

  useEffect(() => {
    if (
      !import.meta.env.DEV ||
      !isExitPreviewMode() ||
      exitPreviewPhase !== "armed" ||
      !canvasReady ||
      exitPreviewTargetKey !== canvasReadinessKey
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      resumeExitPreviewWorld(world);
      setExitPreviewPhase("started");
    }, exitPreviewDelayMsFromUrl());
    return () => window.clearTimeout(timer);
  }, [canvasReady, canvasReadinessKey, exitPreviewPhase, exitPreviewTargetKey, world]);

  return {
    canvasReady,
    handleCanvasReady,
    exitCinematicUiHidden,
    gameplayUiHidden,
  };
}

function isExitCinematicUiSuppressed(world: GameWorld) {
  return world.session.mode === "exitCinematic";
}

function isGameplayUiSuppressed(world: GameWorld) {
  return isExitCinematicViewActive(world);
}

function exitPreviewLevelIdFromUrl() {
  if (typeof window === "undefined") return "level_03_human_museum";
  const params = new URLSearchParams(window.location.search);
  return params.get("exitPreviewLevel") ?? params.get("level") ?? params.get("levelId") ?? "level_03_human_museum";
}

function builderTrialIdFromUrl() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("builderTrial");
  if (!value || !/^[a-zA-Z0-9_-]+$/.test(value)) return null;
  return value;
}

async function ensureBuilderTrialLevelFromUrl() {
  const trialId = builderTrialIdFromUrl();
  if (!trialId) return null;
  try {
    const response = await fetch(`/data/ai/campaign/${trialId}.level.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rawLevel = (await response.json()) as LevelDefinition;
    const level = normalizeLevelExitRoomReference(rawLevel);
    if (!level?.id || !level.map) throw new Error("Invalid builder trial level JSON.");
    const pack = createSingleLevelConfigPack(level, `dev-trial-${level.id}`);
    const result = saveCustomConfigPackFromText(JSON.stringify(pack), { replaceExistingLevelIds: true });
    if (!result.ok) {
      const first = result.errors[0]?.message ?? "unknown import error";
      throw new Error(first);
    }
    return level.id;
  } catch (error) {
    console.warn(`[HumanProtocol] Could not load builder trial "${trialId}".`, error);
    return null;
  }
}

function exitPreviewDelayMsFromUrl() {
  if (typeof window === "undefined") return 900;
  const raw = new URLSearchParams(window.location.search).get("exitPreviewDelay");
  const parsed = raw ? Number.parseInt(raw, 10) : 900;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10000, parsed)) : 900;
}

function loadExitPreviewLevel(world: GameWorld, forcedLevelId?: string) {
  const levelId = forcedLevelId ?? exitPreviewLevelIdFromUrl();
  try {
    world.loadLevel(levelId, "playing");
  } catch (error) {
    console.warn(`[HumanProtocol] Could not load exit preview level "${levelId}", falling back to Level 3.`, error);
    world.loadLevel("level_03_human_museum", "playing");
  }

  const exitInteraction = world.level.map?.interactions.find((interaction) => interaction.type === "exit");
  const exitRoomId =
    exitInteraction?.roomId ??
    world.level.map?.rooms.find((room) => room.aesthetic?.style === "exit" || room.mood === "reveal")?.id ??
    world.session.mapProgress.currentRoomId;
  const exitPosition = world.level.exit.position ?? exitInteraction?.position ?? [world.player.position.x, 0, world.player.position.z];
  const lookTarget = exitInteraction?.position ?? world.level.exit.cinematic?.enterPosition ?? exitPosition;
  const dx = lookTarget[0] - exitPosition[0];
  const dz = lookTarget[2] - exitPosition[2];
  const yaw = Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, -dz) : (world.level.exit.cinematic?.faceYaw ?? world.player.rotationY);

  world.player.position.set(exitPosition[0], exitPosition[1], exitPosition[2]);
  world.player.rotationY = yaw;
  world.player.targetRotationY = yaw;
  world.player.aimDirection.set(Math.sin(yaw), 0, -Math.cos(yaw));
  world.session.mapProgress.currentRoomId = exitRoomId;
}

function freezeExitPreviewWorld(world: GameWorld) {
  world.paused = true;
  clearExitPreviewInput(world);
  world.player.velocity.set(0, 0, 0);
  world.player.isMoving = false;
  world.player.movementAmount = 0;
}

function resumeExitPreviewWorld(world: GameWorld) {
  world.paused = false;
  clearExitPreviewInput(world);
}

function clearExitPreviewInput(world: GameWorld) {
  world.clearTransientInput();
  world.input.move.set(0, 0);
  world.input.lookDelta.set(0, 0);
  world.input.fire = false;
  world.input.fireSource = null;
  world.input.dashPressed = false;
  world.input.sprint = false;
  world.input.interactPressed = false;
  world.input.shockPressed = false;
  world.input.switchWeaponPressed = false;
}

function isExitPreviewMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("exitPreview") === "1" || params.get("debug") === "exit-cinematic";
}

function isExitPreviewHoldMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("exitPreviewHold") === "1" || params.get("exitPreviewDelay") === "hold";
}
