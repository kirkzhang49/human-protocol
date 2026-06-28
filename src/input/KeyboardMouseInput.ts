import { Vector2 } from "three";
import type { WeaponId } from "../game/config/weaponConfig";
import {
  clearGameplayPointerLockTarget,
  isGameplayPointerLocked,
  requestGameplayPointerLock,
  setGameplayPointerLockTarget,
} from "./GameplayPointerLock";
import type { InputAction, InputSnapshot } from "./InputTypes";

const actionKeyMap: Record<InputAction, string> = {
  dash: "Space",
  reset: "KeyR",
  pause: "Escape",
  interact: "KeyE",
  weapon1: "Digit1",
  weapon2: "Digit2",
  weapon3: "Digit3",
};

const weaponKeyMap: Record<InputAction, WeaponId | null> = {
  dash: null,
  reset: null,
  pause: null,
  interact: null,
  weapon1: "pulseRifle",
  weapon2: "railLance",
  weapon3: null,
};

export class KeyboardMouseInput {
  private readonly keys = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly pointerNdc = new Vector2();
  private readonly lookDelta = new Vector2();
  private readonly move = new Vector2();
  private readonly dragLast = new Vector2();
  private readonly snapshotLookDelta = new Vector2();
  private readonly snapshotValue: InputSnapshot = {
    move: this.move,
    pointerNdc: this.pointerNdc,
    lookDelta: this.snapshotLookDelta,
    fire: false,
    dashPressed: false,
    sprint: false,
    resetPressed: false,
    pausePressed: false,
    interactPressed: false,
    useItemPressed: false,
    switchWeapon: null,
    pointerLocked: false,
  };
  private lookPointerId: number | null = null;
  private pointerLockTarget: HTMLElement | null = null;
  private fire = false;
  private cleanup?: () => void;

  attach(target: HTMLElement) {
    this.detach();

    this.pointerLockTarget = target;
    setGameplayPointerLockTarget(target);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape" && document.pointerLockElement === target) {
        document.exitPointerLock?.();
        event.preventDefault();
      }
      if (!this.keys.has(event.code)) {
        this.justPressed.add(event.code);
      }
      this.keys.add(event.code);
      if (event.code === "Space") {
        event.preventDefault();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (isGameplayPointerLocked(target)) {
        this.lookDelta.x += event.movementX;
        this.lookDelta.y += event.movementY;
        return;
      }
      const rect = target.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      this.pointerNdc.set(x, y);
      if (this.lookPointerId === event.pointerId) {
        this.lookDelta.x += event.clientX - this.dragLast.x;
        this.lookDelta.y += event.clientY - this.dragLast.y;
        this.dragLast.set(event.clientX, event.clientY);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const desktopPointer = event.pointerType === "mouse" || event.pointerType === "pen" || event.pointerType === "";
      if (event.button === 0) {
        this.fire = true;
        if (desktopPointer) {
          this.startLookDrag(target, event);
          requestGameplayPointerLock(target);
        }
        return;
      }
      if (event.button === 2 && desktopPointer) {
        this.startLookDrag(target, event);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.button === 0) {
        this.fire = false;
      }
      if (this.lookPointerId === event.pointerId) {
        this.endLookDrag(target, event);
      }
    };

    const onBlur = () => {
      this.keys.clear();
      this.justPressed.clear();
      this.fire = false;
      this.lookPointerId = null;
    };

    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointerleave", onPointerUp);
    target.addEventListener("contextmenu", onContextMenu);

    this.cleanup = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("pointerleave", onPointerUp);
      target.removeEventListener("contextmenu", onContextMenu);
      clearGameplayPointerLockTarget(target);
      this.pointerLockTarget = null;
      this.lookPointerId = null;
    };
  }

  detach() {
    this.cleanup?.();
    this.cleanup = undefined;
  }

  snapshot(): InputSnapshot {
    this.move.set(0, 0);
    if (this.keys.has("KeyA")) this.move.x -= 1;
    if (this.keys.has("KeyD")) this.move.x += 1;
    if (this.keys.has("KeyW")) this.move.y -= 1;
    if (this.keys.has("KeyS")) this.move.y += 1;
    if (this.move.lengthSq() > 1) {
      this.move.normalize();
    }

    const switchWeapon = this.consumeWeapon("weapon1") ?? this.consumeWeapon("weapon2");
    const useItemPressed = this.consumeAction("weapon3");
    this.snapshotLookDelta.copy(this.lookDelta);
    this.lookDelta.set(0, 0);

    const snapshot = this.snapshotValue;
    snapshot.fire = this.fire;
    snapshot.dashPressed = this.consumeAction("dash");
    snapshot.sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    snapshot.resetPressed = this.consumeAction("reset");
    snapshot.pausePressed = this.consumeAction("pause");
    snapshot.interactPressed = this.consumeAction("interact");
    snapshot.useItemPressed = useItemPressed;
    snapshot.switchWeapon = switchWeapon;
    snapshot.pointerLocked = isGameplayPointerLocked(this.pointerLockTarget ?? undefined);
    return snapshot;
  }

  private startLookDrag(target: HTMLElement, event: PointerEvent) {
    this.lookPointerId = event.pointerId;
    this.dragLast.set(event.clientX, event.clientY);
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail after pointer lock; drag fallback still works.
    }
  }

  private endLookDrag(target: HTMLElement, event: PointerEvent) {
    this.lookPointerId = null;
    try {
      target.releasePointerCapture(event.pointerId);
    } catch {
      // Already released by the browser.
    }
  }

  private consumeAction(action: InputAction) {
    const code = actionKeyMap[action];
    const pressed = this.justPressed.has(code);
    this.justPressed.delete(code);
    return pressed;
  }

  private consumeWeapon(action: InputAction) {
    const pressed = this.consumeAction(action);
    return pressed ? weaponKeyMap[action] : null;
  }
}
