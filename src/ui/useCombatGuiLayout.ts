import { useEffect } from "react";

const designArea = 1920 * 1080;

const layoutVars = [
  "--hp-vw",
  "--hp-vh",
  "--hp-viewport-left",
  "--hp-viewport-top",
  "--hp-gui-scale",
  "--hp-edge",
  "--hp-gap",
  "--hp-hud-w",
  "--hp-hud-h",
  "--hp-settings-w",
  "--hp-settings-h",
  "--hp-objective-w",
  "--hp-objective-h",
  "--hp-objective-max-w",
  "--hp-action-cluster",
  "--hp-action-panel-w",
  "--hp-action-slot",
  "--hp-action-main-slot",
  "--hp-action-item-slot",
  "--hp-top-reserve",
  "--hp-bottom-reserve",
  "--hp-notice-y",
  "--hp-type-xs",
  "--hp-type-sm",
  "--hp-type-md",
  "--hp-type-lg",
] as const;

export function useCombatGuiLayout() {
  useEffect(() => {
    let frame = 0;
    let lastKey = "";

    const sync = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const viewport = readCombatViewport();
        const key = `${viewport.width}x${viewport.height}@${viewport.dpr}:${viewport.offsetLeft},${viewport.offsetTop}`;
        if (key === lastKey) return;
        lastKey = key;
        applyCombatGuiLayout(document.documentElement, viewport.width, viewport.height, viewport.offsetLeft, viewport.offsetTop);
      });
    };

    sync();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    if (resizeObserver) {
      resizeObserver.observe(document.documentElement);
      if (document.body) resizeObserver.observe(document.body);
      const shell = document.querySelector(".app-shell");
      if (shell instanceof HTMLElement) resizeObserver.observe(shell);
    }
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    document.addEventListener("fullscreenchange", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    const dprTimer = window.setInterval(sync, 500);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      document.removeEventListener("fullscreenchange", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      window.clearInterval(dprTimer);
      for (const variable of layoutVars) {
        document.documentElement.style.removeProperty(variable);
      }
    };
  }, []);
}

function readCombatViewport() {
  const visual = window.visualViewport;
  const root = document.documentElement;
  const width = Math.min(
    visual?.width ?? window.innerWidth,
    window.innerWidth,
    root.clientWidth || window.innerWidth,
  );
  const height = Math.min(
    visual?.height ?? window.innerHeight,
    window.innerHeight,
    root.clientHeight || window.innerHeight,
  );
  return {
    width,
    height,
    offsetLeft: visual?.offsetLeft ?? 0,
    offsetTop: visual?.offsetTop ?? 0,
    dpr: window.devicePixelRatio || 1,
  };
}

export function computeCombatGuiLayout(widthInput: number, heightInput: number) {
  const width = Math.max(320, Math.round(widthInput));
  const height = Math.max(240, Math.round(heightInput));
  const shortSide = Math.min(width, height);
  const areaScale = clamp(Math.sqrt((width * height) / designArea), 0.74, 1.14);
  const compact = width < 1180 || height < 680;
  const shallow = height < 720;

  const edge = round(clamp(shortSide * 0.018, 12, 28) * (compact ? 0.9 : 1));
  const gap = round(clamp(width * 0.014, 14, 34));
  const hudWidth = round(clamp(width * 0.165, compact ? 220 : 250, compact ? 300 : 340) * (shallow ? 0.88 : 1));
  const hudHeight = round(hudWidth * (228 / 560));
  const settingsWidth = round(clamp(width * 0.054, 84, 116));
  const settingsHeight = round(clamp(height * 0.044, 42, 56));
  const objectiveAvailable = Math.max(320, width - edge * 2 - hudWidth - settingsWidth - gap * 2);
  const centeredSafeWidth = Math.max(320, width - Math.max(hudWidth, settingsWidth) * 2 - edge * 4);
  const objectiveMax = round(Math.min(clamp(width * 0.39, compact ? 380 : 460, compact ? 560 : 760), objectiveAvailable, centeredSafeWidth));
  const objectiveWidth = objectiveMax;
  const objectiveHeight = round(objectiveWidth * (180 / 960));
  const actionCluster = round(clamp(Math.min(width * 0.15, height * 0.23), compact ? 170 : 190, compact ? 230 : 260));
  const actionPanelWidth = round(actionCluster + clamp(actionCluster * 0.16, 26, 40));
  const actionSlot = round(actionCluster * 0.38);
  const actionMainSlot = round(actionCluster * 0.43);
  const actionItemSlot = round(actionCluster * 0.36);
  const topReserve = round(edge + Math.max(hudHeight, settingsHeight) + gap);
  const bottomReserve = round(edge + actionCluster + 84);
  const objectiveY = compact ? edge + hudHeight + 6 : edge;
  const noticeMaxY = Math.max(edge, height - bottomReserve - 72);
  const noticeY = round(Math.min(noticeMaxY, Math.max(topReserve, objectiveY + objectiveHeight + 8)));

  return {
    width,
    height,
    scale: round(areaScale, 3),
    edge,
    gap,
    hudWidth,
    hudHeight,
    settingsWidth,
    settingsHeight,
    objectiveWidth,
    objectiveHeight,
    objectiveMax,
    actionCluster,
    actionPanelWidth,
    actionSlot,
    actionMainSlot,
    actionItemSlot,
    topReserve,
    bottomReserve,
    noticeY,
    typeXs: round(clamp(height * 0.0092 * areaScale, 9, 12)),
    typeSm: round(clamp(height * 0.0108 * areaScale, 10, 14)),
    typeMd: round(clamp(height * 0.0145 * areaScale, 13, 18)),
    typeLg: round(clamp(height * 0.019 * areaScale, 16, 24)),
  };
}

function applyCombatGuiLayout(root: HTMLElement, width: number, height: number, offsetLeft = 0, offsetTop = 0) {
  const layout = computeCombatGuiLayout(width, height);
  root.style.setProperty("--hp-vw", `${layout.width}px`);
  root.style.setProperty("--hp-vh", `${layout.height}px`);
  root.style.setProperty("--hp-viewport-left", `${Math.round(offsetLeft)}px`);
  root.style.setProperty("--hp-viewport-top", `${Math.round(offsetTop)}px`);
  root.style.setProperty("--hp-gui-scale", String(layout.scale));
  root.style.setProperty("--hp-edge", `${layout.edge}px`);
  root.style.setProperty("--hp-gap", `${layout.gap}px`);
  root.style.setProperty("--hp-hud-w", `${layout.hudWidth}px`);
  root.style.setProperty("--hp-hud-h", `${layout.hudHeight}px`);
  root.style.setProperty("--hp-settings-w", `${layout.settingsWidth}px`);
  root.style.setProperty("--hp-settings-h", `${layout.settingsHeight}px`);
  root.style.setProperty("--hp-objective-w", `${layout.objectiveWidth}px`);
  root.style.setProperty("--hp-objective-h", `${layout.objectiveHeight}px`);
  root.style.setProperty("--hp-objective-max-w", `${layout.objectiveMax}px`);
  root.style.setProperty("--hp-action-cluster", `${layout.actionCluster}px`);
  root.style.setProperty("--hp-action-panel-w", `${layout.actionPanelWidth}px`);
  root.style.setProperty("--hp-action-slot", `${layout.actionSlot}px`);
  root.style.setProperty("--hp-action-main-slot", `${layout.actionMainSlot}px`);
  root.style.setProperty("--hp-action-item-slot", `${layout.actionItemSlot}px`);
  root.style.setProperty("--hp-top-reserve", `${layout.topReserve}px`);
  root.style.setProperty("--hp-bottom-reserve", `${layout.bottomReserve}px`);
  root.style.setProperty("--hp-notice-y", `${layout.noticeY}px`);
  root.style.setProperty("--hp-type-xs", `${layout.typeXs}px`);
  root.style.setProperty("--hp-type-sm", `${layout.typeSm}px`);
  root.style.setProperty("--hp-type-md", `${layout.typeMd}px`);
  root.style.setProperty("--hp-type-lg", `${layout.typeLg}px`);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
