import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { playerConfig } from "../game/config/playerConfig";
import type { GameWorld } from "../game/core/GameWorld";
import type { GameLanguage } from "../game/core/GameSettings";
import type { InteractionPromptState } from "../game/core/GameMode";
import type { WeaponId } from "../game/config/weaponConfig";
import { shallowEqualSnapshot, usePolledSnapshot } from "./usePolledSnapshot";
import { CoreCellIcon, PistolIcon, RodIcon } from "./WeaponIcons";

interface MobileControlsProps {
  world: GameWorld;
}

interface MobileControlsSnapshot {
  activeWeapon: WeaponId;
  coreCells: number;
  ultimateHeld: boolean;
  hasRod: boolean;
  hasPistol: boolean;
  dashPercent: number;
  dashReady: boolean;
  dashLabel: string;
  language: GameLanguage;
  interactionPrompt: InteractionPromptState | null;
  revealActive: boolean;
}

// Light haptic feedback on deliberate touch actions. Android supports the
// Vibration API; iOS Safari does not, so this is a graceful no-op there.
function buzz(durationMs: number) {
  if (typeof navigator !== "undefined") navigator.vibrate?.(durationMs);
}

export function MobileControls({ world }: MobileControlsProps) {
  const stickRef = useRef<HTMLDivElement>(null);
  const stickKnobRef = useRef<HTMLSpanElement>(null);
  const lookPointerId = useRef<number | null>(null);
  const lastLook = useRef({ x: 0, y: 0 });
  const [optimisticWeapon, setOptimisticWeapon] = useState<WeaponId | null>(null);
  const [firing, setFiring] = useState(false);
  const [sprintOn, setSprintOn] = useState(false);
  const snapshot = usePolledSnapshot(() => readMobileControls(world), 90, shallowEqualSnapshot);
  const activeWeapon = optimisticWeapon ?? snapshot.activeWeapon;

  useEffect(() => {
    return () => {
      world.touchInput.move.set(0, 0);
      world.touchInput.fire = false;
      world.touchInput.sprint = false;
    };
  }, [world]);

  // A 3D focus reveal seizes the camera and disables the touch surface; make sure
  // a held fire button can never get stuck "down" across the reveal.
  useEffect(() => {
    if (snapshot.revealActive) {
      world.touchInput.fire = false;
      setFiring(false);
    }
  }, [snapshot.revealActive, world]);

  useEffect(() => {
    if (optimisticWeapon && snapshot.activeWeapon === optimisticWeapon) {
      setOptimisticWeapon(null);
    }
  }, [optimisticWeapon, snapshot.activeWeapon]);

  const updateStick = (event: PointerEvent<HTMLDivElement>) => {
    const element = stickRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width * 0.42;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const length = Math.max(1, Math.hypot(rawX, rawY));
    const clamped = Math.min(1, length / radius);
    const x = (rawX / length) * clamped;
    const y = (rawY / length) * clamped;
    world.touchInput.move.set(x, y);
    element.classList.add("active");
    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate(${x * 42}px, ${y * 42}px)`;
    }
  };

  const releaseStick = () => {
    world.touchInput.move.set(0, 0);
    stickRef.current?.classList.remove("active");
    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = "translate(0px, 0px)";
    }
  };

  const onLookDown = (event: PointerEvent<HTMLDivElement>) => {
    lookPointerId.current = event.pointerId;
    lastLook.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onLookMove = (event: PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== event.pointerId) return;
    const dx = event.clientX - lastLook.current.x;
    const dy = event.clientY - lastLook.current.y;
    const touchSensitivity = world.settings.touchLookSensitivity;
    world.touchInput.lookDelta.x += dx * touchSensitivity;
    world.touchInput.lookDelta.y += dy * touchSensitivity;
    lastLook.current = { x: event.clientX, y: event.clientY };
  };

  const onLookUp = (event: PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== event.pointerId) return;
    lookPointerId.current = null;
  };

  const selectWeapon = (weaponId: WeaponId) => {
    if (!world.weaponUnlocked(weaponId)) return;
    buzz(8);
    setOptimisticWeapon(weaponId);
    world.touchInput.selectedWeapon = weaponId;
  };

  const actionClass = (weaponId: WeaponId, variant: "secondary" | "primary") =>
    activeWeapon === weaponId ? `mobile-action ${variant} selected` : `mobile-action ${variant}`;
  const requestDash = () => {
    buzz(14);
    world.touchInput.dashPressed = true;
  };
  const startFire = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    buzz(10);
    world.touchInput.fire = true;
    setFiring(true);
  };
  const stopFire = () => {
    world.touchInput.fire = false;
    setFiring(false);
  };
  const toggleSprint = () => {
    buzz(8);
    setSprintOn((prev) => {
      const next = !prev;
      world.touchInput.sprint = next;
      return next;
    });
  };
  const compactInteraction = snapshot.interactionPrompt
    ? compactInteractionPrompt(snapshot.interactionPrompt, snapshot.language)
    : null;

  return (
    <div className={snapshot.revealActive ? "mobile-controls is-reveal-hidden" : "mobile-controls"} aria-hidden="true">
      <div
        className="look-pad"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />
      <div
        className="joystick"
        ref={stickRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateStick(event);
        }}
        onPointerMove={updateStick}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
      >
        <span ref={stickKnobRef} />
      </div>
      <button
        className={snapshot.dashReady ? "mobile-dash-button ready" : "mobile-dash-button cooling"}
        style={{ "--dash": `${snapshot.dashPercent}%` } as React.CSSProperties}
        aria-label={snapshot.language === "en" ? "Dash" : "冲刺"}
        type="button"
        onPointerDown={requestDash}
        onClick={requestDash}
      >
        <DashIcon className="mobile-dash-icon" />
        <strong>{snapshot.dashLabel}</strong>
      </button>
      <button
        className={sprintOn ? "mobile-sprint-button active" : "mobile-sprint-button"}
        aria-label={snapshot.language === "en" ? "Sprint" : "疾跑"}
        aria-pressed={sprintOn}
        type="button"
        onClick={toggleSprint}
      >
        <SprintIcon className="mobile-sprint-icon" />
      </button>
      <button
        className={firing ? "mobile-fire-button firing" : "mobile-fire-button"}
        aria-label={snapshot.language === "en" ? "Fire" : "开火"}
        type="button"
        onPointerDown={startFire}
        onPointerUp={stopFire}
        onPointerCancel={stopFire}
        onPointerLeave={stopFire}
        onContextMenu={(event) => event.preventDefault()}
      >
        <FireIcon className="mobile-fire-icon" />
      </button>
      {snapshot.interactionPrompt ? (
        <button
          className={snapshot.interactionPrompt.canInteract ? "mobile-interact-button ready" : "mobile-interact-button locked"}
          title={`${snapshot.interactionPrompt.label} ${snapshot.interactionPrompt.detail}`}
          type="button"
          onPointerDown={() => {
            buzz(12);
            world.touchInput.interactPressed = true;
          }}
          onClick={() => {
            world.touchInput.interactPressed = true;
          }}
        >
          <span>{compactInteraction?.label}</span>
          <strong>{compactInteraction?.detail}</strong>
        </button>
      ) : null}
      <div className="mobile-action-stack">
        <button
          className={snapshot.hasRod ? actionClass("pulseRifle", "secondary") : "mobile-action secondary disabled"}
          aria-pressed={activeWeapon === "pulseRifle"}
          aria-label={snapshot.language === "en" ? "Lab iron rod" : "实验铁棒"}
          disabled={!snapshot.hasRod}
          type="button"
          onPointerDown={() => {
            selectWeapon("pulseRifle");
          }}
        >
          <RodIcon className="mobile-action-icon rod-icon" />
        </button>
        <button
          className={snapshot.hasPistol ? actionClass("railLance", "secondary") : "mobile-action secondary disabled"}
          aria-pressed={activeWeapon === "railLance"}
          aria-label={snapshot.language === "en" ? "Lab pistol" : "实验手枪"}
          disabled={!snapshot.hasPistol}
          type="button"
          onPointerDown={() => {
            selectWeapon("railLance");
          }}
        >
          <PistolIcon className="mobile-action-icon pistol-icon" />
        </button>
        <button
          className={snapshot.coreCells > 0 || snapshot.ultimateHeld ? "mobile-action primary item-ready" : "mobile-action primary item-empty"}
          aria-pressed={false}
          aria-label={
            snapshot.ultimateHeld
              ? snapshot.language === "en"
                ? "Throw emergency charge"
                : "投掷应急炸弹"
              : snapshot.coreCells > 0
              ? snapshot.language === "en"
                ? "Use emergency cell"
                : "使用应急电池"
              : snapshot.language === "en"
                ? "No emergency cell"
                : "应急电池为空"
          }
          type="button"
          onPointerDown={() => {
            buzz(16);
            world.touchInput.shockPressed = true;
          }}
        >
          <CoreCellIcon className="mobile-action-icon item-icon" />
        </button>
      </div>
    </div>
  );
}

function compactInteractionPrompt(prompt: InteractionPromptState, language: GameLanguage) {
  if (prompt.canInteract) {
    return {
      label: language === "en" ? "Interact" : "交互",
      detail: prompt.controlLabel,
    };
  }
  return {
    label: language === "en" ? "Locked" : "锁定",
    detail: language === "en" ? "Need item" : "缺门禁",
  };
}

function readMobileControls(world: GameWorld): MobileControlsSnapshot {
  const dash = readDash(world);
  return {
    activeWeapon: world.player.currentWeapon === "flakBurst" ? world.lastCombatWeapon : world.player.currentWeapon,
    coreCells: world.session.coreCells,
    ultimateHeld: world.session.deployedUltimate?.phase === "held",
    hasRod: world.session.hasRod,
    hasPistol: world.session.hasPistol,
    dashPercent: dash.percent,
    dashReady: dash.ready,
    dashLabel: dash.label,
    language: world.settings.language,
    interactionPrompt: world.session.interactionPrompt,
    revealActive: Boolean(world.session.activeFocusReveal || world.session.activeHandInteraction),
  };
}

function DashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
      <path d="M39.6 5 12.4 35.3h17.1L24.4 59l27.2-31.4H34.4L39.6 5Z" fill="currentColor" />
      <path d="M13 17.5h13.8M8.2 27.1h10.5M45.2 42.5h10.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4.2" opacity="0.72" />
    </svg>
  );
}

function FireIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="3.4" opacity="0.9" />
      <circle cx="32" cy="32" r="5.4" fill="currentColor" />
      <path d="M32 4v12M32 48v12M4 32h12M48 32h12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.4" />
    </svg>
  );
}

function SprintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
      <path d="M30 41 22 59M40 36l5 23" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4.4" />
      <circle cx="41" cy="13" r="6" fill="currentColor" />
      <path d="M18 27l12-6 12 8 11 3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.6" />
      <path d="M8 24h12M4 34h11M11 44h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.6" opacity="0.66" />
    </svg>
  );
}

function readDash(world: GameWorld) {
  const cooldown = world.dashCooldownDuration();
  const remaining = Math.max(0, world.player.dashCooldownRemaining);
  const percent = remaining <= 0 ? 100 : 100 - (remaining / cooldown) * 100;
  const enoughEnergy = world.player.energy >= playerConfig.dashEnergyCost;
  const readyLabel = world.settings.language === "en" ? "Ready" : "就绪";
  const energyLabel = world.settings.language === "en" ? "Stamina" : "精力";
  return {
    percent: Math.round(Math.max(0, Math.min(100, percent))),
    ready: remaining <= 0 && enoughEnergy,
    label: remaining > 0 ? `${remaining.toFixed(1)}s` : enoughEnergy ? readyLabel : energyLabel,
  };
}
