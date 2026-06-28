import { usesDesktopPointer } from "./deviceProfile";

let gameplayPointerLockTarget: HTMLElement | null = null;

export function setGameplayPointerLockTarget(target: HTMLElement | null) {
  if (gameplayPointerLockTarget instanceof HTMLCanvasElement) {
    delete gameplayPointerLockTarget.dataset.hpGameplayCanvas;
  }
  gameplayPointerLockTarget = target;
  if (target instanceof HTMLCanvasElement) {
    target.dataset.hpGameplayCanvas = "true";
  }
}

export function clearGameplayPointerLockTarget(target: HTMLElement) {
  if (gameplayPointerLockTarget !== target) return;
  setGameplayPointerLockTarget(null);
}

export function requestGameplayPointerLock(target = gameplayPointerLockTargetElement()) {
  if (!usesDesktopPointer() || !target || isPointerLockDisabled()) return;
  if (document.pointerLockElement === target) return;

  try {
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus?.({ preventScroll: true });
    const request = target.requestPointerLock?.();
    if (request && "catch" in request) {
      request.catch(() => undefined);
    }
  } catch {
    // Browser/user settings can deny pointer lock. Drag aiming remains available.
  }
}

export function releaseGameplayPointerLock() {
  if (document.pointerLockElement === null) return;
  try {
    document.exitPointerLock?.();
  } catch {
    // Already released by the browser.
  }
}

export function isGameplayPointerLocked(target = gameplayPointerLockTargetElement()) {
  return !!target && document.pointerLockElement === target;
}

export { usesDesktopPointer };

function gameplayPointerLockTargetElement() {
  if (gameplayPointerLockTarget?.isConnected) return gameplayPointerLockTarget;
  const canvas = document.querySelector(
    "canvas[data-hp-gameplay-canvas='true'], canvas.raw-webgpu-canvas, .game-canvas canvas",
  );
  return canvas instanceof HTMLElement ? canvas : null;
}

function isPointerLockDisabled() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("pointerLock") === "0";
}
