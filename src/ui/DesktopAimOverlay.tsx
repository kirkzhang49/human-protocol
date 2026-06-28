import { useEffect } from "react";
import type { GameWorld } from "../game/core/GameWorld";
import {
  isDesktopPointerLocked,
  releaseDesktopPointerLock,
  requestDesktopPointerLock,
  usesDesktopPointer,
} from "./desktopPointerLock";

interface DesktopAimOverlayProps {
  world: GameWorld;
}

export function DesktopAimOverlay({ world }: DesktopAimOverlayProps) {
  useEffect(() => {
    const update = () => releasePointerLockWhenMenuOwnsCursor(world);
    const id = window.setInterval(update, 160);
    document.addEventListener("pointerlockchange", update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("pointerlockchange", update);
    };
  }, [world]);

  useEffect(() => {
    const requestPointerLockFromCombatClick = (event: PointerEvent) => {
      if (!shouldLockPointerFromEvent(world, event)) return;
      requestDesktopPointerLock();
    };
    document.addEventListener("pointerdown", requestPointerLockFromCombatClick, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", requestPointerLockFromCombatClick, { capture: true });
    };
  }, [world]);

  return null;
}

function releasePointerLockWhenMenuOwnsCursor(world: GameWorld) {
  if (world.session.mode === "playing" && !world.paused) return;
  releaseDesktopPointerLock();
}

function shouldLockPointerFromEvent(world: GameWorld, event: PointerEvent) {
  if (!usesDesktopPointer() || isDesktopPointerLocked()) return false;
  if (world.session.mode !== "playing" || world.paused) return false;
  if (event.button !== 0) return false;
  if (event.pointerType === "touch") return false;

  const target = event.target;
  if (!(target instanceof Element)) return true;
  if (target.closest(".mobile-action, .mobile-dash-button, .mobile-interact-button, .threat-segment")) return true;
  return !target.closest(
    [
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "[role='button']",
      "[data-no-pointer-lock='true']",
      ".flow-overlay",
      ".upgrade-overlay",
      ".choice-overlay",
      ".pause-overlay",
      ".code-lock-overlay",
      ".tool-calibration-overlay",
      ".system-settings-button",
    ].join(", "),
  );
}
