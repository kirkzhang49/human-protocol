import { Vector3 } from "three";
import { enemyArchetypes } from "../config/enemyArchetypes";
import { playerConfig } from "../config/playerConfig";
import { weaponConfig } from "../config/weaponConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { isEnemyVisibleToPlayerRoom } from "../core/RoomReachability";
import { createProjectile } from "../entities/createProjectile";
import { weaponSkins } from "../skins/weaponSkins";

export const BLADE_ARC_RANGE = 1.65;
export const BLADE_ARC_CONE_RADIANS = 0.54;
export const BLADE_CLOSE_RANGE = 0.9;
const BLADE_LINE_OF_SIGHT_RADIUS = 0.14;

export class WeaponSystem implements GameSystem {
  private readonly muzzlePosition = new Vector3();
  private readonly cockpitPosition = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly shotDirection = new Vector3();
  private readonly targetPoint = new Vector3();
  private readonly bladeForward = new Vector3();
  private readonly toEnemy = new Vector3();

  update(world: GameWorld, delta: number) {
    if (world.session.mode !== "playing") return;

    const player = world.player;
    player.fireCooldownRemaining = Math.max(0, player.fireCooldownRemaining - delta);
    world.session.lowEnergyPulseCooldown = Math.max(0, world.session.lowEnergyPulseCooldown - delta);
    if (player.gunReloadRemaining > 0) {
      player.gunReloadRemaining = Math.max(0, player.gunReloadRemaining - delta);
      if (player.gunReloadRemaining <= 0) {
        player.gunAmmo = player.gunMaxAmmo;
        world.setRewardPulse({
          label: "手枪换弹完成",
          detail: `${player.gunAmmo}/${player.gunMaxAmmo}`,
          rarity: "common",
        }, 0.9);
      }
    }

    if (world.session.deployedUltimate?.phase === "held") {
      return;
    }

    if (!world.input.fire || player.fireCooldownRemaining > 0 || player.heat >= player.maxHeat || !world.weaponUnlocked(player.currentWeapon)) {
      return;
    }
    const canHitPuzzleTargets = world.input.fireSource !== "auto";
    if (player.currentWeapon === "pulseRifle" && player.energy < world.bladeEnergyCost()) {
      player.fireCooldownRemaining = 0.18;
      if (world.session.lowEnergyPulseCooldown <= 0) {
        world.session.lowEnergyPulseCooldown = 1.6;
        world.setRewardPulse({
          label: "精力不足",
          detail: "停半秒或闪避拉开再挥棒",
          rarity: "common",
        }, 1);
      }
      return;
    }
    if (player.currentWeapon === "railLance" && !this.canFirePistol(world)) {
      return;
    }
    if (player.currentWeapon === "flakBurst" && world.session.coreCells <= 0) {
      player.currentWeapon = world.lastCombatWeapon;
      player.weaponSwitchSequence += 1;
      return;
    }

    const firingWeapon = player.currentWeapon;
    const isCoreItem = firingWeapon === "flakBurst";
    const config = weaponConfig[firingWeapon];
    const weapon = weaponConfig[firingWeapon];

    if (isCoreItem && !world.consumeCoreCell()) {
      player.currentWeapon = world.lastCombatWeapon;
      player.weaponSwitchSequence += 1;
      return;
    }
    const fired = this.fire(world, canHitPuzzleTargets);
    if (!fired) {
      if (isCoreItem) {
        player.currentWeapon = world.lastCombatWeapon;
        player.weaponSwitchSequence += 1;
      }
      return;
    }
    player.fireCooldownRemaining = isCoreItem
      ? 0.42 * world.upgrades.shockCooldownMultiplier
      : this.cooldownFor(world, config.roundsPerSecond);
    if (firingWeapon === "railLance") {
      player.gunAmmo = Math.max(0, player.gunAmmo - 1);
      if (player.gunAmmo <= 0) {
        player.gunReloadRemaining = player.gunReloadDuration;
        world.setRewardPulse({
          label: "手枪换弹",
          detail: `${player.gunReloadDuration.toFixed(1)}秒`,
          rarity: "rare",
        }, 1.2);
      }
    } else if (firingWeapon === "pulseRifle") {
      player.energy = Math.max(0, player.energy - world.bladeEnergyCost());
    }
    player.fireSequence += 1;
    player.activeHardpoint = player.fireSequence % 2 === 0 ? "leftCannon" : "rightCannon";
    player.cannonRecoil[player.activeHardpoint] = config.recoilStrength;
    player.weaponRecoil = Math.max(player.weaponRecoil, weapon.recoilStrength);
    player.heat = Math.min(player.maxHeat, player.heat + (isCoreItem ? 10 : this.heatFor(world, weapon.heatPerShot)));
    world.applyCameraImpact(
      config.cameraShake,
      firingWeapon === "railLance" ? 0.72 : firingWeapon === "pulseRifle" ? 0.38 : 2.2,
      firingWeapon === "railLance" ? 0.035 : firingWeapon === "pulseRifle" ? 0.06 : 0.2,
      firingWeapon === "railLance" ? 0.055 : firingWeapon === "pulseRifle" ? 0.08 : 0.22,
    );
    world.emitAudio(weaponSkins[firingWeapon].audioKey, {
      intensity: firingWeapon === "railLance" ? 1.34 : firingWeapon === "flakBurst" ? 1.4 : 0.92,
      position: this.muzzlePosition,
    });
    if (isCoreItem) {
      player.currentWeapon = world.lastCombatWeapon;
      player.weaponSwitchSequence += 1;
    }
  }

  private fire(world: GameWorld, canHitPuzzleTargets: boolean) {
    const player = world.player;
    const weapon = weaponConfig[player.currentWeapon];
    const side = 1;

    this.right.set(Math.cos(player.rotationY), 0, Math.sin(player.rotationY));
    this.cockpitPosition.copy(player.position);
    this.cockpitPosition.y += playerConfig.cockpitHeight;
    this.muzzlePosition
      .copy(this.cockpitPosition)
      .addScaledVector(player.aimDirection, 1.2)
      .addScaledVector(this.right, side * 0.42)
      .addScaledVector(this.up, -0.2);

    if (player.currentWeapon === "pulseRifle") {
      const hitCount = this.fireBladeArc(world, canHitPuzzleTargets);
      world.addEffect("muzzleFlash", this.muzzlePosition, player.aimDirection, 0.12, 1.45);
      world.addEffect("bladeSlash", player.position, player.aimDirection, 0.18, hitCount > 0 ? 1.25 : 0.82);
      return true;
    }

    const projectileCount = weapon.projectileCount + (player.currentWeapon === "railLance" && world.upgrades.railExtraLine ? 1 : 0);
    for (let index = 0; index < projectileCount; index += 1) {
      const spreadIndex = index - (weapon.projectileCount - 1) / 2;
      const verticalSpread = ((index % 2) - 0.5) * weapon.spread * 0.45;
      this.shotDirection
        .copy(this.assistedShotDirection(world))
        .addScaledVector(this.right, spreadIndex * weapon.spread)
        .addScaledVector(this.up, verticalSpread)
        .normalize();
      const projectile = createProjectile(
        world.nextId(),
        player.id,
        player.currentWeapon,
        this.muzzlePosition,
        this.shotDirection,
        { canHitPuzzleTargets },
      );
      projectile.damage *= this.damageMultiplierFor(world);
      if (player.currentWeapon === "railLance") {
        projectile.pierceRemaining += world.upgrades.railPierceBonus;
      }
      world.addProjectile(projectile);
    }
    const muzzleLifetime = player.currentWeapon === "railLance" ? 0.12 : 0.09;
    const muzzleIntensity = player.currentWeapon === "railLance" ? 1.58 : 1.25;
    world.addEffect("muzzleFlash", this.muzzlePosition, player.aimDirection, muzzleLifetime, muzzleIntensity);
    return true;
  }

  private fireBladeArc(world: GameWorld, canHitPuzzleTargets: boolean) {
    const player = world.player;
    const weapon = weaponConfig.pulseRifle;
    const range = BLADE_ARC_RANGE;
    const coneCos = Math.cos(BLADE_ARC_CONE_RADIANS);
    let hitCount = 0;
    let heavyHit = false;

    this.updateBladeForward(player.rotationY);

    for (const enemy of world.enemies) {
      if (!enemy.isAlive) continue;
      if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
      this.toEnemy.copy(enemy.position).sub(player.position).setY(0);
      const distance = Math.max(0.001, this.toEnemy.length());
      if (distance > range + enemy.radius) continue;

      const direction = this.toEnemy.multiplyScalar(1 / distance);
      const inArc = direction.dot(this.bladeForward) >= coneCos || distance < BLADE_CLOSE_RANGE;
      if (!inArc) continue;
      this.targetPoint.copy(enemy.position);
      this.targetPoint.y += 0.8;
      if (!world.hasProjectileLineOfSight(player.position, this.targetPoint, BLADE_LINE_OF_SIGHT_RADIUS)) continue;

      const archetype = enemyArchetypes[enemy.archetypeId];
      const heavyTarget = Boolean(archetype.elite || enemy.tier !== "normal" || enemy.archetypeId === "custodian_elite");
      const shieldMultiplier = archetype.shielded ? 0.82 : 1;
      const closeBonus = distance < 1.35 ? 1.12 : 1;
      enemy.health = Math.max(0, enemy.health - weapon.projectileDamage * this.damageMultiplierFor(world) * shieldMultiplier * closeBonus);
      world.markEnemyHit(enemy, direction, 1.12);
      enemy.velocity.addScaledVector(direction, 2.15);
      hitCount += 1;
      heavyHit = heavyHit || heavyTarget || Boolean(archetype.shielded);

      if (enemy.health <= 0) {
        world.killEnemy(enemy);
        if (world.upgrades.pulseKillHeatRefund > 0) {
          world.player.heat = Math.max(0, world.player.heat - world.upgrades.pulseKillHeatRefund);
          world.player.energy = Math.min(world.player.maxEnergy, world.player.energy + world.upgrades.pulseKillHeatRefund);
        }
        world.addEffect("dashBurst", enemy.position, direction, 0.34, 1.85);
        world.applyCameraImpact(archetype.elite ? 0.36 : 0.24, archetype.elite ? 1.6 : 0.9, 0.12, 0.12);
        world.emitAudio(archetype.audioKey, {
          intensity: archetype.elite ? 1.35 : 1,
          position: enemy.position,
        });
      } else {
        const impactPosition = heavyTarget
          ? enemy.position.clone().addScaledVector(direction, -(enemy.radius + 0.1))
          : enemy.position;
        if (heavyTarget) impactPosition.y += enemy.tier === "boss" ? 1.3 : 1.04;
        world.addEffect(heavyTarget || archetype.shielded ? "armorSpark" : "hitSpark", impactPosition, direction, archetype.shielded ? 0.22 : 0.2, heavyTarget ? 1.76 : archetype.shielded ? 1.45 : 1.32);
        if (heavyTarget) {
          const side = new Vector3(-direction.z, 0, direction.x);
          if (side.lengthSq() < 0.001) side.set(1, 0, 0);
          side.normalize();
          world.addEffect("coreSpark", impactPosition.clone().addScaledVector(side, 0.16), direction.clone().addScaledVector(side, 0.34).normalize(), 0.22, enemy.tier === "boss" ? 1.86 : 1.52);
          world.addEffect("coreSpark", impactPosition.clone().addScaledVector(side, -0.16), direction.clone().addScaledVector(side, -0.34).normalize(), 0.22, enemy.tier === "boss" ? 1.78 : 1.46);
        }
        world.applyCameraImpact(heavyTarget ? 0.14 : archetype.shielded ? 0.12 : 0.09, heavyTarget ? 0.42 : 0.28, heavyTarget ? 0.065 : 0.04, heavyTarget ? 0.075 : 0.06);
        world.emitAudio("enemy_hit", {
          intensity: heavyTarget ? 1.26 : archetype.shielded ? 0.88 : 1.05,
          position: enemy.position,
        });
      }
    }

    if (canHitPuzzleTargets) {
      const puzzleHitCount = world.hitPuzzleTargetsInArc(player.position, this.bladeForward, range, coneCos, "pulseRifle");
      hitCount += puzzleHitCount;
    }

    if (hitCount > 0) {
      world.applyCameraImpact(0.2 + Math.min(hitCount, 3) * 0.055, 0.42 + Math.min(hitCount, 3) * 0.18, 0.08, 0.08);
      world.applyCombatHitStop(heavyHit ? 0.052 : 0.032, heavyHit ? 0.12 : 0.2);
    }
    return hitCount;
  }

  private assistedShotDirection(world: GameWorld) {
    const lockedId = world.combatAssist.lockedEnemyId;
    if (lockedId === null) return world.player.aimDirection;

    const target = world.enemies.find((enemy) => enemy.id === lockedId && enemy.isAlive && isEnemyVisibleToPlayerRoom(world, enemy));
    if (!target) return world.player.aimDirection;

    this.targetPoint.copy(target.position);
    this.targetPoint.y += 1.2;
    if (!world.hasProjectileLineOfSight(this.muzzlePosition, this.targetPoint, 0.06)) return world.player.aimDirection;
    return this.targetPoint.sub(this.muzzlePosition).normalize();
  }

  private updateBladeForward(rotationY: number) {
    this.bladeForward.set(Math.sin(rotationY), 0, -Math.cos(rotationY)).normalize();
  }

  private cooldownFor(world: GameWorld, roundsPerSecond: number) {
    const surgeMultiplier = world.session.reviveSurgeRemaining > 0 ? 1.18 : 1;
    const tempoMultiplier = world.session.tempoSurgeRemaining > 0 ? 1.14 : 1;
    if (world.player.currentWeapon === "pulseRifle") {
      return 1 / (roundsPerSecond * world.upgrades.pulseFireRateMultiplier * surgeMultiplier * tempoMultiplier);
    }
    if (world.player.currentWeapon === "flakBurst") {
      return (1 / (roundsPerSecond * surgeMultiplier * tempoMultiplier)) * world.upgrades.shockCooldownMultiplier;
    }
    return 1 / (roundsPerSecond * surgeMultiplier * tempoMultiplier);
  }

  private heatFor(world: GameWorld, heat: number) {
    if (world.player.currentWeapon === "pulseRifle") return heat * world.upgrades.pulseHeatMultiplier;
    if (world.player.currentWeapon === "railLance") return heat * world.upgrades.railHeatMultiplier;
    return heat;
  }

  private damageMultiplierFor(world: GameWorld) {
    const surgeMultiplier = world.session.reviveSurgeRemaining > 0 ? 1.28 : 1;
    const progressMultiplier = world.attackMultiplierFor(world.player.currentWeapon);
    if (world.player.currentWeapon === "railLance") return world.upgrades.railDamageMultiplier * surgeMultiplier * progressMultiplier;
    return surgeMultiplier * progressMultiplier;
  }

  private canFirePistol(world: GameWorld) {
    const player = world.player;
    if (player.gunReloadRemaining > 0) return false;
    if (player.gunAmmo > 0) return true;
    player.gunReloadRemaining = player.gunReloadDuration;
    return false;
  }
}
