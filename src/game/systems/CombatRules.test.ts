import { Vector2, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { InputSnapshot } from "../../input/InputTypes";
import { bossVisualProfileForEnemy } from "../config/bossVisualProfiles";
import { level03HumanMuseum } from "../config/levels/level03-human-museum/level";
import { resolvePropCollisionProxy } from "../config/MapGeometry";
import { ultimateAbilityConfig } from "../config/ultimateAbilityConfig";
import { weaponConfig } from "../config/weaponConfig";
import { GameWorld } from "../core/GameWorld";
import { createProjectile } from "../entities/createProjectile";
import type { ObstacleState } from "../entities/EntityTypes";
import { EnemyAISystem } from "./EnemyAISystem";
import { InputSystem } from "./InputSystem";
import { MobileAssistSystem } from "./MobileAssistSystem";
import { ProjectileSystem } from "./ProjectileSystem";
import { WeaponSystem } from "./WeaponSystem";

describe("combat weapon rules", () => {
  it("swings the rod even when no target is in melee range", () => {
    const world = createCombatWorld();
    const energy = world.player.energy;
    const fireSequence = world.player.fireSequence;

    world.input.fire = true;
    world.input.fireSource = "manual";
    new WeaponSystem().update(world, 1 / 60);

    expect(world.player.energy).toBeLessThan(energy);
    expect(world.player.fireSequence).toBe(fireSequence + 1);
    expect(world.effects.some((effect) => effect.type === "bladeSlash")).toBe(true);
    expect(world.drainAudioEvents().some((event) => event.key === "weapon_pulse_rifle")).toBe(true);
  });

  it("keeps the rod from behaving like a ranged weapon", () => {
    const world = createCombatWorld();
    const enemy = world.spawnEnemy("repair_drone", "test_wave", new Vector3(0, 0, -2.75), 0);
    const health = enemy.health;
    const energy = world.player.energy;

    world.input.fire = true;
    world.input.fireSource = "manual";
    new WeaponSystem().update(world, 1 / 60);

    expect(enemy.health).toBe(health);
    expect(world.player.energy).toBeLessThan(energy);
    expect(world.player.fireSequence).toBe(1);
    expect(world.effects.some((effect) => effect.type === "bladeSlash")).toBe(true);
  });

  it("lets the rod hit a nearby robot in front of the player", () => {
    const world = createCombatWorld();
    const enemy = world.spawnEnemy("repair_drone", "test_wave", new Vector3(0, 0, -1.45), 0);
    const health = enemy.health;

    world.input.fire = true;
    world.input.fireSource = "manual";
    new WeaponSystem().update(world, 1 / 60);

    expect(enemy.health).toBeLessThan(health);
    expect(world.player.energy).toBeLessThan(world.player.maxEnergy);
    expect(world.player.fireSequence).toBe(1);
    expect(world.effects.some((effect) => effect.type === "bladeSlash")).toBe(true);
  });

  it("makes rod hits on boss armor read as core and armor impacts", () => {
    const world = createCombatWorld();
    const boss = world.spawnEnemy("custodian_elite", "boss_rod_impact", new Vector3(0, 0, -1.45), 0, { tier: "boss" });
    const health = boss.health;

    world.player.currentWeapon = "pulseRifle";
    world.input.fire = true;
    world.input.fireSource = "manual";
    new WeaponSystem().update(world, 1 / 60);

    expect(boss.health).toBeLessThan(health);
    expect(world.effects.some((effect) => effect.type === "bladeSlash")).toBe(true);
    expect(world.effects.some((effect) => effect.type === "armorSpark")).toBe(true);
    expect(world.effects.some((effect) => effect.type === "coreSpark")).toBe(true);
    expect(world.combatHitStopRemaining).toBeGreaterThan(0);
  });

  it("does not let the rod hit a robot through a wall", () => {
    const world = createCombatWorld();
    const enemy = world.spawnEnemy("repair_drone", "test_wave", new Vector3(0, 0, -1.35), 0);
    const health = enemy.health;
    world.obstacles.push(testWall());
    world.markObstacleIndexDirty();

    world.input.fire = true;
    world.input.fireSource = "manual";
    new WeaponSystem().update(world, 1 / 60);

    expect(enemy.health).toBe(health);
    expect(world.player.fireSequence).toBe(1);
    expect(world.effects.some((effect) => effect.type === "bladeSlash")).toBe(true);
  });

  it("stops pistol projectiles at walls before damaging robots behind them", () => {
    const world = createCombatWorld();
    world.player.currentWeapon = "railLance";
    const enemy = world.spawnEnemy("repair_drone", "test_wave", new Vector3(0, 0, -3), 0);
    const health = enemy.health;
    world.obstacles.push(testWall(-1.45));
    world.markObstacleIndexDirty();
    world.addProjectile(createProjectile(999, world.player.id, "railLance", new Vector3(0, 1.2, 0), new Vector3(0, 0, -1)));

    new ProjectileSystem().update(world, 0.1);

    expect(enemy.health).toBe(health);
    expect(world.projectiles).toHaveLength(0);
    expect(world.effects.some((effect) => effect.type === "hitSpark")).toBe(true);
  });

  it("hits robots swept through by a fast pistol projectile between frames", () => {
    const world = createCombatWorld();
    world.player.currentWeapon = "railLance";
    const enemy = world.spawnEnemy("repair_drone", "test_wave", new Vector3(0, 0, -1.8), 0);
    const health = enemy.health;
    world.addProjectile(createProjectile(999, world.player.id, "railLance", new Vector3(0, 1.25, 0), new Vector3(0, 0, -1)));

    new ProjectileSystem().update(world, 0.1);

    expect(enemy.health).toBeLessThan(health);
    expect(world.projectiles).toHaveLength(0);
  });

  it("does not lock aim assist onto robots hidden behind walls", () => {
    const world = createCombatWorld();
    const enemy = world.spawnEnemy("repair_drone", "test_wave", new Vector3(0, 0, -6), 0);
    world.obstacles.push(testWall(-3));
    world.markObstacleIndexDirty();

    new MobileAssistSystem().update(world, 1 / 60);

    expect(world.combatAssist.lockedEnemyId).not.toBe(enemy.id);
  });

  it("starts a manual pistol reload when pressing weapon 2 again with a partial magazine", () => {
    const world = createCombatWorld();
    world.player.currentWeapon = "railLance";
    world.player.gunAmmo = 7;
    world.player.gunReloadRemaining = 0;
    const sequence = world.player.weaponSwitchSequence;

    new InputSystem().update(world, 0, 0, inputContextWith({ switchWeapon: "railLance" }));

    expect(world.player.currentWeapon).toBe("railLance");
    expect(world.player.gunReloadRemaining).toBe(world.player.gunReloadDuration);
    expect(world.player.weaponSwitchSequence).toBe(sequence + 1);
    expect(world.session.rewardPulse?.label).toBe("手枪换弹");
  });

  it("holds skill 3 first, then throws a bomb that explodes into a low-health small enemy", () => {
    const world = createCombatWorld();
    world.session.coreCells = 1;
    const enemy = world.spawnEnemy("repair_drone", "test_wave", new Vector3(0, 0, -2.45), 0);
    enemy.health = Math.round(enemy.maxHealth * 0.42);

    expect(world.useUltimateAbility()).toBe(true);
    expect(world.session.deployedUltimate).not.toBeNull();
    expect(world.session.deployedUltimate?.phase).toBe("held");
    expect(world.session.coreCells).toBe(1);
    expect(enemy.isAlive).toBe(true);

    world.drainAudioEvents();
    expect(world.useUltimateAbility()).toBe(true);
    const throwAudio = world.drainAudioEvents();
    expect(world.session.deployedUltimate).not.toBeNull();
    expect(world.session.deployedUltimate?.phase).toBe("thrown");
    expect(world.session.coreCells).toBe(0);
    expect(world.session.deployedUltimate?.position[1]).toBeGreaterThan(0.7);
    expect(world.session.deployedUltimate?.velocity?.[2]).toBeLessThan(-1);
    expect(enemy.isAlive).toBe(true);
    expect(world.useUltimateAbility()).toBe(false);
    expect(throwAudio.some((event) => event.key === "ability_throw")).toBe(true);
    expect(throwAudio.some((event) => event.key === "weapon_pulse_rifle")).toBe(false);

    for (let frame = 0; frame < 90 && world.session.deployedUltimate; frame += 1) {
      world.updateDeployedUltimate(1 / 60);
    }

    expect(world.session.deployedUltimate).toBeNull();
    expect(enemy.isAlive).toBe(false);
    expect(world.effects.filter((effect) => effect.type === "shockwave").length).toBeGreaterThanOrEqual(4);
    expect(world.effects.filter((effect) => effect.type === "dashBurst").length).toBeGreaterThanOrEqual(5);
    expect(world.effects.filter((effect) => effect.type === "hitSpark").length).toBeGreaterThanOrEqual(18);
    expect(world.session.renderSurgeRemaining).toBeGreaterThan(0);
  });

  it("detonates skill 3 when the thrown bomb physically hits and kills a robot", () => {
    const world = createCombatWorld();
    world.session.coreCells = 1;
    const enemy = world.spawnEnemy("repair_drone", "impact_test", new Vector3(0, 0, -1.3), 0);

    expect(world.useUltimateAbility()).toBe(true);
    expect(world.useUltimateAbility()).toBe(true);
    expect(world.session.deployedUltimate?.phase).toBe("thrown");

    for (let frame = 0; frame < 32 && world.session.deployedUltimate; frame += 1) {
      world.updateDeployedUltimate(1 / 60);
    }

    expect(world.session.deployedUltimate).toBeNull();
    expect(enemy.isAlive).toBe(false);
    expect(world.effects.filter((effect) => effect.type === "shockwave").length).toBeGreaterThanOrEqual(4);
    expect(world.effects.filter((effect) => effect.type === "hitSpark").length).toBeGreaterThanOrEqual(18);
  });

  it("tunes the breach missile as a smaller two-x damage boss-piercing skill 3 pickup", () => {
    expect(ultimateAbilityConfig.coreBomb.blastRadius).toBe(6.35);
    expect(ultimateAbilityConfig.coreBomb.damage).toBe(200);
    expect(ultimateAbilityConfig.coreBomb.throwCollisionRadius).toBe(0.34);
    expect(ultimateAbilityConfig.coreBomb.bossDamageMultiplier).toBe(1);
    expect(ultimateAbilityConfig.coreBomb.resource).toBe("coreCell");
    expect(ultimateAbilityConfig.coreBomb.resourceSpendPhase).toBe("throw");
    expect(ultimateAbilityConfig.breachMissile.blastRadius).toBe(4.75);
    expect(ultimateAbilityConfig.breachMissile.damage).toBe(400);
    expect(ultimateAbilityConfig.breachMissile.throwCollisionRadius).toBe(0.26);
    expect(ultimateAbilityConfig.breachMissile.blastRadius).toBeLessThan(ultimateAbilityConfig.coreBomb.blastRadius);
    expect(ultimateAbilityConfig.breachMissile.damage).toBe(ultimateAbilityConfig.coreBomb.damage * 2);
    expect(ultimateAbilityConfig.breachMissile.bossDamageMultiplier).toBeCloseTo(1.2);
    expect(ultimateAbilityConfig.breachMissile.resource).toBe("coreCell");
    expect(ultimateAbilityConfig.breachMissile.resourceSpendPhase).toBe("throw");
  });

  it("adds concentrated impact VFX when the breach missile hits an enemy", () => {
    const world = createCombatWorld();
    world.session.activeUltimateAbilityId = "breachMissile";
    world.session.coreCells = 1;
    const enemy = world.spawnEnemy("shield_tech", "missile_impact_vfx", new Vector3(0, 0, -1.3), 0);
    enemy.health = Math.max(enemy.health, ultimateAbilityConfig.breachMissile.damage + 80);

    expect(world.useUltimateAbility()).toBe(true);
    expect(world.useUltimateAbility()).toBe(true);

    for (let frame = 0; frame < 32 && world.session.deployedUltimate; frame += 1) {
      world.updateDeployedUltimate(1 / 60);
    }

    expect(world.session.deployedUltimate).toBeNull();
    expect(enemy.health).toBeLessThan(enemy.maxHealth);
    const effectTypes = world.effects.map((effect) => effect.type as string);
    expect(effectTypes).toContain("breachPierce");
    expect(effectTypes).toContain("breachShock");
    expect(effectTypes).toContain("breachTrail");
    expect(world.effects.filter((effect) => (effect.type as string) === "breachPierce").length).toBeGreaterThanOrEqual(6);
    expect(world.effects.filter((effect) => (effect.type as string) === "breachTrail").length).toBeGreaterThanOrEqual(3);
  });

  it("keeps core bomb and breach missile on separate explosion VFX keys", () => {
    const coreWorld = createCombatWorld();
    coreWorld.session.activeUltimateAbilityId = "coreBomb";
    coreWorld.session.coreCells = 1;

    expect(coreWorld.useUltimateAbility()).toBe(true);
    expect(coreWorld.useUltimateAbility()).toBe(true);
    for (let frame = 0; frame < 90 && coreWorld.session.deployedUltimate; frame += 1) {
      coreWorld.updateDeployedUltimate(1 / 60);
    }

    const missileWorld = createCombatWorld();
    missileWorld.session.activeUltimateAbilityId = "breachMissile";
    missileWorld.session.coreCells = 1;

    expect(missileWorld.useUltimateAbility()).toBe(true);
    expect(missileWorld.useUltimateAbility()).toBe(true);
    for (let frame = 0; frame < 90 && missileWorld.session.deployedUltimate; frame += 1) {
      missileWorld.updateDeployedUltimate(1 / 60);
    }

    const coreEffectTypeList = coreWorld.effects.map((effect) => effect.type as string);
    const coreEffectTypes = new Set(coreEffectTypeList);
    const missileEffectTypes = new Set(missileWorld.effects.map((effect) => effect.type as string));
    expect(coreEffectTypeList).toEqual(expect.arrayContaining(["shockwave", "dashBurst", "hitSpark"]));
    expect(coreEffectTypes.has("breachPierce")).toBe(false);
    expect(coreEffectTypes.has("breachShock")).toBe(false);
    expect(coreEffectTypes.has("breachTrail")).toBe(false);
    expect(missileEffectTypes.has("breachPierce")).toBe(true);
    expect(missileEffectTypes.has("breachShock")).toBe(true);
    expect(missileEffectTypes.has("breachTrail")).toBe(true);
    expect(missileEffectTypes.has("hitSpark")).toBe(false);
  });

  it("kills Level 3 health-multiplied small robots in the blast radius", () => {
    const world = createCombatWorld();
    world.session.coreCells = 1;
    const drone = world.spawnEnemy("repair_drone", "level3_blast_test", new Vector3(0, 0, -2.35), 0, { healthMultiplier: 1.3 });
    const clamp = world.spawnEnemy("clamp_bot", "level3_blast_test", new Vector3(0.9, 0, -2.55), 0, { healthMultiplier: 1.3 });

    expect(drone.health).toBeGreaterThan(150);
    expect(clamp.health).toBeGreaterThan(180);
    expect(world.useUltimateAbility()).toBe(true);
    expect(world.useUltimateAbility()).toBe(true);

    for (let frame = 0; frame < 90 && world.session.deployedUltimate; frame += 1) {
      world.updateDeployedUltimate(1 / 60);
    }

    expect(world.session.deployedUltimate).toBeNull();
    expect(drone.isAlive).toBe(false);
    expect(clamp.isAlive).toBe(false);
  });

  it("kills full-health small robots even near the edge of skill 3 blast radius", () => {
    const world = createCombatWorld();
    world.session.coreCells = 1;
    const edgeDrone = world.spawnEnemy("repair_drone", "level3_blast_edge_test", new Vector3(0, 0, -5.95), 0, { healthMultiplier: 1.3 });

    expect(world.useUltimateAbility()).toBe(true);
    expect(world.useUltimateAbility()).toBe(true);

    for (let frame = 0; frame < 90 && world.session.deployedUltimate; frame += 1) {
      world.updateDeployedUltimate(1 / 60);
    }

    expect(world.session.deployedUltimate).toBeNull();
    expect(edgeDrone.isAlive).toBe(false);
  });

  it("keeps baseline skill 3 tuned as a small-robot clear instead of one-shotting shield techs", () => {
    const world = createCombatWorld();
    world.session.coreCells = 1;
    const shieldTech = world.spawnEnemy("shield_tech", "shield_blast_test", new Vector3(0, 0, -1.35), 0);
    const health = shieldTech.health;

    expect(world.useUltimateAbility()).toBe(true);
    expect(world.useUltimateAbility()).toBe(true);

    for (let frame = 0; frame < 32 && world.session.deployedUltimate; frame += 1) {
      world.updateDeployedUltimate(1 / 60);
    }

    expect(world.session.deployedUltimate).toBeNull();
    expect(shieldTech.isAlive).toBe(true);
    expect(shieldTech.health).toBeGreaterThan(0);
    expect(shieldTech.health).toBeLessThan(health);
  });

  it("does not fire the normal weapon while skill 3 is held", () => {
    const world = createCombatWorld();
    world.session.coreCells = 1;
    const energy = world.player.energy;
    const fireSequence = world.player.fireSequence;

    expect(world.useUltimateAbility()).toBe(true);
    expect(world.session.deployedUltimate?.phase).toBe("held");

    world.input.fire = true;
    world.input.fireSource = "manual";
    new WeaponSystem().update(world, 1 / 60);

    expect(world.session.coreCells).toBe(1);
    expect(world.player.currentWeapon).toBe("pulseRifle");
    expect(world.player.energy).toBe(energy);
    expect(world.player.fireSequence).toBe(fireSequence);
    expect(world.projectiles).toHaveLength(0);
    expect(world.effects.some((effect) => effect.type === "bladeSlash" || effect.type === "muzzleFlash")).toBe(false);
  });

  it("does not deploy skill 3 without a core cell", () => {
    const world = createCombatWorld();
    world.session.coreCells = 0;

    expect(world.useUltimateAbility()).toBe(false);
    expect(world.session.deployedUltimate).toBeNull();
  });

  it("staggers a boss after repeated strong hits", () => {
    const world = createCombatWorld();
    const boss = world.spawnEnemy("custodian_elite", "boss_stagger", new Vector3(0, 0, -2.25), 0, { tier: "boss" });
    boss.attackCooldownRemaining = 0;
    const health = world.player.health;

    world.markEnemyHit(boss, new Vector3(0, 0, -1), 1.12);
    world.markEnemyHit(boss, new Vector3(0, 0, -1), 1.12);
    world.markEnemyHit(boss, new Vector3(0, 0, -1), 1.12);

    expect(boss.staggerRemaining).toBeGreaterThan(0.45);
    expect(boss.staggerRemaining).toBeLessThan(0.7);
    expect(boss.attackCooldownRemaining).toBeGreaterThan(0.6);
    expect(boss.attackCooldownRemaining).toBeLessThan(1);
    expect(world.effects.filter((effect) => effect.type === "armorSpark").length).toBeGreaterThanOrEqual(3);
    expect(world.effects.some((effect) => effect.type === "staggerBurst")).toBe(true);
    expect(world.effects.some((effect) => effect.type === "shockwave")).toBe(true);
    expect(world.camera.combatFocusRemaining).toBeGreaterThan(0);

    new EnemyAISystem().update(world, 1 / 60);

    expect(world.player.health).toBe(health);
    expect(boss.attackWindupRemaining).toBe(0);
    expect(boss.staggerRemaining).toBeGreaterThan(0);
  });

  it("uses the Level 3 curator profile for boss feedback and stagger timing", () => {
    const world = createCombatWorld();
    world.level = level03HumanMuseum;
    const curator = world.spawnEnemy("custodian_elite", "wave_level_03_central_archive", new Vector3(0, 0, -2.25), 0, {
      tier: "boss",
      tierLabel: "策展主管",
      healthMultiplier: 0.26,
      damageMultiplier: 0.34,
      moveSpeedMultiplier: 0.96,
      attackCooldownMultiplier: 1.08,
      attackRangeMultiplier: 1.08,
      radiusMultiplier: 0.92,
      visual: {
        modelKey: "hp_enemy_shield_technician_horror",
        textureAtlasKey: "custodian_boss",
        coreColor: "#ff6a52",
        warningColor: "#ffd36d",
        scaleMultiplier: 1.18,
        lightIntensityMultiplier: 1.35,
      },
    });

    expect(bossVisualProfileForEnemy(world.level.id, curator)?.id).toBe("level03_museum_curator");

    world.markEnemyHit(curator, new Vector3(0, 0, -1), 1.12);

    expect(world.effects.filter((effect) => effect.type === "armorSpark").length).toBeGreaterThanOrEqual(3);

    world.markEnemyHit(curator, new Vector3(0, 0, -1), 1.12);
    world.markEnemyHit(curator, new Vector3(0, 0, -1), 1.12);

    expect(curator.staggerRemaining).toBeGreaterThan(0.45);
    expect(curator.staggerRemaining).toBeLessThan(0.7);
    expect(curator.attackCooldownRemaining).toBeGreaterThan(0.6);
    expect(curator.attackCooldownRemaining).toBeLessThan(1);
    expect(world.effects.some((effect) => effect.type === "staggerBurst")).toBe(true);
    expect(world.effects.some((effect) => effect.type === "shockwave")).toBe(true);
    expect(world.combatHitStopRemaining).toBeGreaterThan(0);
    expect(world.camera.combatFocusRemaining).toBeGreaterThan(0);
    expect(world.camera.combatFocusTarget.y).toBeGreaterThan(1.35);
  });

  it("lets a strong hit interrupt boss windup into stagger", () => {
    const world = createCombatWorld();
    const boss = world.spawnEnemy("custodian_elite", "boss_stagger_interrupt", new Vector3(0, 0, -2.25), 0, { tier: "boss" });
    boss.attackCooldownRemaining = 0;
    boss.attackWindupTotal = 0.52;
    boss.attackWindupRemaining = 0.22;
    const health = world.player.health;

    world.markEnemyHit(boss, new Vector3(0, 0, -1), 1.12);

    expect(boss.attackWindupRemaining).toBe(0);
    expect(boss.staggerRemaining).toBeGreaterThan(0.4);
    expect(boss.attackCooldownRemaining).toBeGreaterThan(0.8);
    expect(world.effects.some((effect) => effect.type === "armorSpark")).toBe(true);
    expect(world.effects.some((effect) => effect.type === "staggerBurst")).toBe(true);

    for (let frame = 0; frame < 12; frame += 1) {
      new EnemyAISystem().update(world, 1 / 60);
    }

    expect(world.player.health).toBe(health);
    expect(boss.attackWindupRemaining).toBe(0);
  });

  it("telegraphs boss melee before applying damage", () => {
    const world = createCombatWorld();
    const boss = world.spawnEnemy("custodian_elite", "boss_windup", new Vector3(0, 0, -2.3), 0, { tier: "boss" });
    boss.attackCooldownRemaining = 0;
    const health = world.player.health;
    const ai = new EnemyAISystem();

    ai.update(world, 1 / 60);

    expect(world.player.health).toBe(health);
    expect(boss.attackWindupRemaining).toBeGreaterThan(0.3);
    expect(world.effects.some((effect) => effect.type === "dangerTelegraph")).toBe(true);
    expect(world.effects.some((effect) => effect.type === "shockwave")).toBe(true);
    expect(world.drainAudioEvents().some((event) => event.key === "elite_warning")).toBe(true);

    for (let frame = 0; frame < 38; frame += 1) {
      ai.update(world, 1 / 60);
    }

    expect(world.player.health).toBeLessThan(health);
    expect(boss.attackWindupRemaining).toBe(0);
    expect(boss.attackCooldownRemaining).toBeGreaterThan(0);
    expect(world.drainAudioEvents().some((event) => event.key === "player_hit")).toBe(true);
  });

  it("keeps enemies from chasing or hitting through a blocking wall", () => {
    const world = createCombatWorld();
    const enemy = world.spawnEnemy("repair_drone", "wall_sight_test", new Vector3(0, 0, -2.55), 0);
    enemy.attackCooldownRemaining = 0;
    world.obstacles.push(testWall(-1.24));
    world.markObstacleIndexDirty();
    const ai = new EnemyAISystem();
    const health = world.player.health;
    const startDistance = enemy.position.distanceTo(world.player.position);

    for (let frame = 0; frame < 75; frame += 1) {
      ai.update(world, 1 / 60);
    }

    expect(world.player.health).toBe(health);
    expect(enemy.position.distanceTo(world.player.position)).toBeGreaterThan(startDistance - 0.1);
    expect(enemy.attackWindupRemaining).toBe(0);
  });

  it("pushes small enemies apart instead of letting them stack into one body", () => {
    const world = createCombatWorld();
    const first = world.spawnEnemy("repair_drone", "spacing_test", new Vector3(-0.03, 0, -4), 0);
    const second = world.spawnEnemy("repair_drone", "spacing_test", new Vector3(0.03, 0, -4.03), 0);
    const startDistance = first.position.distanceTo(second.position);
    const ai = new EnemyAISystem();

    for (let frame = 0; frame < 45; frame += 1) {
      ai.update(world, 1 / 60);
    }

    expect(first.position.distanceTo(second.position)).toBeGreaterThan(startDistance + 0.65);
  });

  it("lets the player dodge out of a boss windup", () => {
    const world = createCombatWorld();
    const boss = world.spawnEnemy("custodian_elite", "boss_dodge", new Vector3(0, 0, -2.3), 0, { tier: "boss" });
    boss.attackCooldownRemaining = 0;
    const health = world.player.health;
    const ai = new EnemyAISystem();

    ai.update(world, 1 / 60);
    world.player.position.set(0, 0, 5.5);

    for (let frame = 0; frame < 38; frame += 1) {
      ai.update(world, 1 / 60);
    }

    expect(world.player.health).toBe(health);
    expect(boss.attackWindupRemaining).toBe(0);
    expect(boss.attackCooldownRemaining).toBeGreaterThan(0);
  });

  it("does not hard-block enemies against soft puzzle obstacles", () => {
    const world = createCombatWorld();
    const enemy = world.spawnEnemy("repair_drone", "soft_obstacle_chase", new Vector3(0, 0, 0), 0);
    enemy.velocity.set(0, 0, -2);
    enemy.staggerRemaining = 0.2;
    world.obstacles.push({
      id: "soft_puzzle_pedestal",
      visualKey: "age_museum_color_orb_pedestal",
      position: new Vector3(0, 0.5, -0.12),
      halfSize: new Vector3(0.36, 0.46, 0.36),
      enemyNavigation: "soft",
    });
    world.markObstacleIndexDirty();

    new EnemyAISystem().update(world, 0.1);

    expect(enemy.position.z).toBeLessThan(-0.05);
  });

  it("marks puzzle furniture as ignored for enemy navigation while ordinary furniture stays solid", () => {
    const puzzleProxy = resolvePropCollisionProxy({
      id: "puzzle_console_host",
      roomId: "room_a",
      modelKey: "room_museum_last_human_tool_vitrine",
      position: [0, 0, 0],
      collider: { halfSize: [0.7, 0.7, 0.4] },
      tags: ["puzzle_host"],
    });
    const ordinaryProxy = resolvePropCollisionProxy({
      id: "ordinary_locker",
      roomId: "room_a",
      modelKey: "room_locker_low",
      position: [0, 0, 0],
      collider: { halfSize: [0.7, 0.7, 0.4] },
    });

    expect(puzzleProxy?.enemyNavigation).toBe("ignore");
    expect(ordinaryProxy?.enemyNavigation).toBeUndefined();
  });

  it("steers enemies around solid furniture instead of leaving them stuck behind it", () => {
    const world = createCombatWorld();
    const enemy = world.spawnEnemy("repair_drone", "solid_furniture_chase", new Vector3(0, 0, -4), 0);
    const startDistance = enemy.position.distanceTo(world.player.position);
    world.obstacles.push({
      id: "prop:solid_crate",
      visualKey: "room_crate_stack",
      position: new Vector3(0, 0.65, -2.15),
      halfSize: new Vector3(0.9, 0.65, 0.5),
    });
    world.markObstacleIndexDirty();
    const ai = new EnemyAISystem();

    for (let frame = 0; frame < 100; frame += 1) {
      ai.update(world, 1 / 60);
    }

    expect(Math.abs(enemy.position.x)).toBeGreaterThan(0.35);
    expect(enemy.position.distanceTo(world.player.position)).toBeLessThan(startDistance - 0.45);
  });

  it("lets pistol shots pass low furniture that does not cover enough vertical sight to the boss", () => {
    const world = createCombatWorld();
    const boss = world.spawnEnemy("custodian_elite", "low_cover_boss", new Vector3(0, 0, -3), 0, { tier: "boss" });
    const health = boss.health;
    world.obstacles.push({
      id: "prop:low_console",
      visualKey: "room_table_utility",
      position: new Vector3(0, 0.45, -1.45),
      halfSize: new Vector3(2.5, 0.45, 0.12),
    });
    world.markObstacleIndexDirty();
    world.addProjectile(createProjectile(999, world.player.id, "railLance", new Vector3(0, 1.2, 0), new Vector3(0, 0, -1)));

    new ProjectileSystem().update(world, 0.1);

    expect(boss.health).toBeLessThan(health);
    expect(world.effects.some((effect) => effect.type === "coreSpark")).toBe(true);
  });

  it("still stops pistol shots on tall solid furniture", () => {
    const world = createCombatWorld();
    const enemy = world.spawnEnemy("repair_drone", "tall_cover_target", new Vector3(0, 0, -3), 0);
    const health = enemy.health;
    world.obstacles.push({
      id: "prop:tall_locker",
      visualKey: "room_locker_tall",
      position: new Vector3(0, 1, -1.45),
      halfSize: new Vector3(2.5, 1, 0.12),
    });
    world.markObstacleIndexDirty();
    world.addProjectile(createProjectile(999, world.player.id, "railLance", new Vector3(0, 1.2, 0), new Vector3(0, 0, -1)));

    new ProjectileSystem().update(world, 0.1);

    expect(enemy.health).toBe(health);
    expect(world.projectiles).toHaveLength(0);
  });

  it("raises pistol damage by ten percent and removes boss damage reduction from bombs", () => {
    expect(weaponConfig.railLance.projectileDamage).toBeCloseTo(15.4);
    expect(ultimateAbilityConfig.coreBomb.bossDamageMultiplier).toBe(1);
  });

  it("makes rail hits on boss armor read as core impacts", () => {
    const world = createCombatWorld();
    const boss = world.spawnEnemy("custodian_elite", "boss_core_hit", new Vector3(0, 0, -1.45), 0, { tier: "boss" });
    const health = boss.health;
    const projectile = createProjectile(999, world.player.id, "railLance", new Vector3(0, 1.25, -1.45), new Vector3(0, 0, -1));
    projectile.damage = Math.min(24, boss.health - 1);
    world.addProjectile(projectile);

    new ProjectileSystem().update(world, 0);

    expect(boss.isAlive).toBe(true);
    expect(boss.health).toBeLessThan(health);
    expect(world.projectiles).toHaveLength(0);
    expect(world.effects.some((effect) => effect.type === "coreSpark")).toBe(true);
    expect(world.combatHitStopRemaining).toBeGreaterThan(0);
  });

  it("does not execute bosses with rail overcharge threshold damage", () => {
    const world = createCombatWorld();
    world.upgrades.railExecuteThreshold = 0.12;
    const boss = world.spawnEnemy("custodian_elite", "boss_rail_execute_guard", new Vector3(0, 0, -1.45), 0, { tier: "boss" });
    boss.health = boss.maxHealth * 0.13;
    const projectile = createProjectile(999, world.player.id, "railLance", new Vector3(0, 1.25, -1.45), new Vector3(0, 0, -1));
    projectile.damage = boss.maxHealth * 0.02;
    world.addProjectile(projectile);

    new ProjectileSystem().update(world, 0);

    expect(boss.isAlive).toBe(true);
    expect(boss.health).toBeCloseTo(boss.maxHealth * 0.11);
    expect(world.effects.some((effect) => effect.type === "coreSpark")).toBe(true);
  });

  it("keeps boss defeat readable with core burst feedback", () => {
    const world = createCombatWorld();
    const boss = world.spawnEnemy("custodian_elite", "boss_defeat_feedback", new Vector3(0, 0, -1.45), 0, { tier: "boss" });
    boss.lastHitDirection.set(0, 0, -1);

    world.killEnemy(boss);

    expect(boss.isAlive).toBe(false);
    expect(world.effects.filter((effect) => effect.type === "coreSpark").length).toBeGreaterThanOrEqual(6);
    expect(world.effects.some((effect) => effect.type === "shockwave")).toBe(true);
    expect(world.effects.some((effect) => effect.type === "staggerBurst")).toBe(true);
    expect(world.combatHitStopRemaining).toBeGreaterThan(0);
  });
});

function createCombatWorld() {
  const world = new GameWorld();
  world.session.mode = "playing";
  world.session.hasRod = true;
  world.session.hasPistol = true;
  world.player.position.set(0, 0, 0);
  world.player.rotationY = 0;
  world.player.targetRotationY = 0;
  world.player.cameraPitch = 0;
  world.player.aimDirection.set(0, 0, -1);
  world.player.aimPoint.set(0, 1.4, -24);
  world.player.energy = world.player.maxEnergy;
  world.player.heat = 0;
  world.player.fireCooldownRemaining = 0;
  world.input.fire = false;
  world.input.fireSource = null;
  world.projectiles.length = 0;
  world.effects.length = 0;
  world.drainAudioEvents();
  for (const enemy of world.enemies) {
    enemy.isAlive = false;
    enemy.deathAge = 99;
  }
  world.obstacles.length = 0;
  world.markObstacleIndexDirty();
  return world;
}

function testWall(z = -0.72): ObstacleState {
  return {
    id: `test_wall_${z}`,
    visualKey: "test_wall",
    position: new Vector3(0, 1, z),
    halfSize: new Vector3(2.5, 1.6, 0.08),
  };
}

function inputContextWith(overrides: Partial<InputSnapshot>) {
  const snapshot: InputSnapshot = {
    move: new Vector2(),
    pointerNdc: new Vector2(),
    lookDelta: new Vector2(),
    fire: false,
    dashPressed: false,
    sprint: false,
    resetPressed: false,
    pausePressed: false,
    interactPressed: false,
    useItemPressed: false,
    switchWeapon: null,
    pointerLocked: false,
    ...overrides,
  };
  return {
    input: { snapshot: () => snapshot },
    camera: {},
  } as Parameters<InputSystem["update"]>[3];
}
