import { playerConfig } from "../config/playerConfig";
import { gameBalance } from "../config/gameBalance";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { damp } from "../core/math";

export class EffectsSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    let prunedEnemy = false;
    world.updateDeployedUltimate(delta);

    for (let index = world.effects.length - 1; index >= 0; index -= 1) {
      const effect = world.effects[index];
      effect.age += delta;
      if (effect.age >= effect.lifetime) {
        world.effects.splice(index, 1);
      }
    }

    for (const enemy of world.enemies) {
      if (!enemy.isAlive) {
        if (enemy.deathAge > 1.05) continue;
        enemy.hitReact = damp(enemy.hitReact, 0, 7.5, delta);
        const previousDeathAge = enemy.deathAge;
        enemy.deathAge += delta;
        if (previousDeathAge <= 1.05 && enemy.deathAge > 1.05) {
          prunedEnemy = true;
        }
        continue;
      }
      enemy.hitReact = damp(enemy.hitReact, 0, 7.5, delta);
    }
    if (prunedEnemy) {
      world.enemySpawnSequence += 1;
    }

    const player = world.player;
    player.cannonRecoil.leftCannon = damp(player.cannonRecoil.leftCannon, 0, 18, delta);
    player.cannonRecoil.rightCannon = damp(player.cannonRecoil.rightCannon, 0, 18, delta);
    player.weaponRecoil = damp(player.weaponRecoil, 0, 14, delta);
    player.damageFlash = Math.max(0, player.damageFlash - delta * 3.6);
    const heatDissipationMultiplier =
      (world.session.tempoSurgeRemaining > 0 ? 1.45 : 1) * (world.session.reviveSurgeRemaining > 0 ? 1.18 : 1);
    player.heat = Math.max(0, player.heat - playerConfig.heatDissipationPerSecond * heatDissipationMultiplier * delta);
    world.camera.shake = damp(world.camera.shake, 0, gameBalance.cameraShakeDecay, delta);
    world.camera.fovKick = damp(world.camera.fovKick, 0, 3.6, delta);
    world.camera.rumbleRemaining = Math.max(0, world.camera.rumbleRemaining - delta);
    world.camera.combatFocusRemaining = Math.max(0, world.camera.combatFocusRemaining - delta);
    if (world.camera.combatFocusRemaining <= 0) {
      world.camera.combatFocusTotal = 0;
      world.camera.combatFocusStrength = 0;
    }
    if (world.camera.rumbleRemaining <= 0) {
      world.camera.rumble = damp(world.camera.rumble, 0, 8, delta);
    }
    world.session.reviveSurgeRemaining = Math.max(0, world.session.reviveSurgeRemaining - delta);
    world.session.tempoSurgeRemaining = Math.max(0, world.session.tempoSurgeRemaining - delta);
    world.session.killStreakRemaining = Math.max(0, world.session.killStreakRemaining - delta);
    world.session.renderSurgeRemaining = Math.max(0, world.session.renderSurgeRemaining - delta);
    if (world.session.killStreakRemaining <= 0) {
      world.session.killStreak = 0;
    }
    if (world.session.rewardPulse) {
      world.session.rewardPulse.remaining -= delta;
      if (world.session.rewardPulse.remaining <= 0) {
        world.session.rewardPulse = null;
      }
    }
    if (world.session.spawnWarning) {
      world.session.spawnWarning.remaining -= delta;
      if (world.session.spawnWarning.remaining <= 0) {
        world.session.spawnWarning = null;
      }
    }
  }
}
