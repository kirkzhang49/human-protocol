import type { GameSystem, SystemContext } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { weaponOrder } from "../config/weaponConfig";

export class InputSystem implements GameSystem {
  runWhenPaused = true;

  update(world: GameWorld, _delta: number, _elapsed: number, context: SystemContext) {
    const snapshot = context.input.snapshot();

    if (snapshot.pausePressed) {
      if (world.session.activeSequencePlaybackPuzzleId) {
        world.closeSequencePlayback();
        this.clearGameplayInput(world);
        world.clearTransientInput();
        return;
      }
      if (world.session.activeToolCalibrationPuzzleId) {
        world.closeToolCalibration();
        this.clearGameplayInput(world);
        world.clearTransientInput();
        return;
      }
      if (world.session.activeCodeLockPuzzleId) {
        world.closeCodeLock();
        this.clearGameplayInput(world);
        world.clearTransientInput();
        return;
      }
      if (world.session.activeCircuitGridPuzzleId) {
        world.closeCircuitGrid();
        this.clearGameplayInput(world);
        world.clearTransientInput();
        return;
      }
      if (world.session.activeSurveillancePuzzleId) {
        world.closeSurveillance();
        this.clearGameplayInput(world);
        world.clearTransientInput();
        return;
      }
      if (world.session.activeValveMatrixPuzzleId) {
        world.closeValveMatrix();
        this.clearGameplayInput(world);
        world.clearTransientInput();
        return;
      }
      if (world.session.activeArchiveMergePuzzleId) {
        world.closeArchiveMerge();
        this.clearGameplayInput(world);
        world.clearTransientInput();
        return;
      }
      if (world.session.activeGalleryReadingPuzzleId) {
        world.closeGalleryReading();
        this.clearGameplayInput(world);
        world.clearTransientInput();
        return;
      }
      world.togglePause();
      this.clearGameplayInput(world);
      world.clearTransientInput();
      return;
    }

    if (world.session.activeSequencePlaybackPuzzleId) {
      this.clearGameplayInput(world);
      world.clearTransientInput();
      return;
    }

    if (world.session.activeToolCalibrationPuzzleId) {
      this.clearGameplayInput(world);
      world.clearTransientInput();
      return;
    }

    if (world.session.activeCodeLockPuzzleId) {
      this.clearGameplayInput(world);
      world.clearTransientInput();
      return;
    }

    if (
      world.session.activeCircuitGridPuzzleId ||
      world.session.activeSurveillancePuzzleId ||
      world.session.activeValveMatrixPuzzleId ||
      world.session.activeArchiveMergePuzzleId ||
      world.session.activeGalleryReadingPuzzleId
    ) {
      this.clearGameplayInput(world);
      world.clearTransientInput();
      return;
    }

    if (world.paused) {
      this.clearGameplayInput(world);
      world.clearTransientInput();
      return;
    }

    // Freeze the player while a 3D target reveal or hand interaction plays; the
    // camera/viewmodel is driven by session state, not by look/move input.
    if (world.session.activeFocusReveal || world.session.activeHandInteraction) {
      this.clearGameplayInput(world);
      world.clearTransientInput();
      return;
    }

    world.input.move.copy(world.touchInput.move.lengthSq() > 0.001 ? world.touchInput.move : snapshot.move);
    world.input.lookDelta.copy(snapshot.lookDelta).add(world.touchInput.lookDelta);
    const manualFire = snapshot.fire || world.touchInput.fire;
    world.input.fire = manualFire;
    world.input.fireSource = manualFire ? "manual" : null;
    world.input.dashPressed = snapshot.dashPressed || world.touchInput.dashPressed;
    world.input.sprint = snapshot.sprint || world.touchInput.sprint;
    world.input.interactPressed = snapshot.interactPressed || world.touchInput.interactPressed;
    world.input.shockPressed = world.touchInput.shockPressed || snapshot.useItemPressed;
    world.input.switchWeaponPressed = world.touchInput.switchWeaponPressed;

    if (snapshot.switchWeapon && world.weaponUnlocked(snapshot.switchWeapon)) {
      if (snapshot.switchWeapon === world.player.currentWeapon) {
        this.tryManualReload(world, snapshot.switchWeapon);
      } else {
        world.player.currentWeapon = snapshot.switchWeapon;
        world.lastCombatWeapon = snapshot.switchWeapon;
        world.player.fireCooldownRemaining = Math.min(world.player.fireCooldownRemaining, 0.1);
        world.player.weaponSwitchSequence += 1;
      }
    }

    if (world.input.switchWeaponPressed) {
      const unlockedWeapons = weaponOrder.filter((weaponId) => world.weaponUnlocked(weaponId));
      if (unlockedWeapons.length > 0) {
        const currentIndex = unlockedWeapons.indexOf(world.player.currentWeapon);
        world.player.currentWeapon = unlockedWeapons[(currentIndex + 1) % unlockedWeapons.length];
        world.lastCombatWeapon = world.player.currentWeapon;
        world.player.fireCooldownRemaining = Math.min(world.player.fireCooldownRemaining, 0.1);
        world.player.weaponSwitchSequence += 1;
      }
    }

    if (
      world.touchInput.selectedWeapon &&
      world.touchInput.selectedWeapon !== "flakBurst" &&
      world.weaponUnlocked(world.touchInput.selectedWeapon) &&
      world.touchInput.selectedWeapon !== world.player.currentWeapon
    ) {
      world.player.currentWeapon = world.touchInput.selectedWeapon;
      world.lastCombatWeapon = world.touchInput.selectedWeapon;
      world.player.fireCooldownRemaining = Math.min(world.player.fireCooldownRemaining, 0.08);
      world.player.weaponSwitchSequence += 1;
    }

    if (world.input.shockPressed) {
      world.useUltimateAbility();
    }

    if (snapshot.resetPressed) {
      world.restartFromDeath();
    }

    world.clearTransientInput();
  }

  private tryManualReload(world: GameWorld, weaponId: string) {
    const player = world.player;
    if (weaponId !== "railLance") return;
    if (player.gunReloadRemaining > 0 || player.gunAmmo >= player.gunMaxAmmo) return;
    player.gunReloadRemaining = player.gunReloadDuration;
    player.fireCooldownRemaining = Math.min(player.fireCooldownRemaining, 0.12);
    player.weaponSwitchSequence += 1;
    world.setRewardPulse({
      label: world.settings.language === "en" ? "Pistol reload" : "手枪换弹",
      detail: `${player.gunReloadDuration.toFixed(1)}s`,
      rarity: "rare",
    }, 0.9);
  }

  private clearGameplayInput(world: GameWorld) {
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
}
