import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { isEnemyVisibleToPlayerRoom } from "../core/RoomReachability";
import { BLADE_ARC_RANGE } from "./WeaponSystem";

export class AutoFireSystem implements GameSystem {
  update(world: GameWorld) {
    if (world.session.mode !== "playing") {
      world.input.fire = false;
      world.input.fireSource = null;
      return;
    }

    const manualFireActive = world.input.fire && world.input.fireSource === "manual";

    if (
      world.combatAssist.autoFireEnabled &&
      world.combatAssist.lockedEnemyId !== null &&
      world.weaponUnlocked(world.player.currentWeapon) &&
      world.player.currentWeapon !== "flakBurst"
    ) {
      const lockedEnemy = world.enemies.find(
        (enemy) => enemy.id === world.combatAssist.lockedEnemyId && enemy.isAlive && isEnemyVisibleToPlayerRoom(world, enemy),
      );
      const bladeNeedsRange =
        world.player.currentWeapon === "pulseRifle" &&
        (!lockedEnemy || lockedEnemy.position.distanceTo(world.player.position) > BLADE_ARC_RANGE + lockedEnemy.radius);
      const pistolReloading =
        world.player.currentWeapon === "railLance" &&
        (world.player.gunReloadRemaining > 0 || world.player.gunAmmo <= 0);
      const shouldAutoFire = !bladeNeedsRange && !pistolReloading;
      if (shouldAutoFire && !manualFireActive) {
        world.input.fire = true;
        world.input.fireSource = "auto";
      }
    }

    if (world.player.heat >= world.player.maxHeat) {
      world.input.fire = false;
      world.input.fireSource = null;
    }
  }
}
