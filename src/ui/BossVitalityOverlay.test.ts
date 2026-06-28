import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { GameWorld } from "../game/core/GameWorld";
import type { EnemyState } from "../game/entities/EnemyState";
import { readBossVitality } from "./BossVitalityOverlay";

describe("BossVitalityOverlay snapshot", () => {
  it("uses in-world boss names instead of the generic tier label", () => {
    const { world } = createBossVitalityWorld();

    const snapshot = readBossVitality(world);

    expect(snapshot.visible).toBe(true);
    expect(snapshot.name).toBe("维修主管");
    expect(snapshot.healthPercent).toBe(100);
    expect(snapshot.wounded).toBe(false);
  });

  it("keeps configured boss names when a level provides one", () => {
    const { world } = createBossVitalityWorld("回收主机");

    expect(readBossVitality(world).name).toBe("回收主机");
  });

  it("shows warning progress without mixing in hit or defeated state", () => {
    const { world, boss } = createBossVitalityWorld();
    boss.attackWindupTotal = 0.52;
    boss.attackWindupRemaining = 0.26;
    boss.damageFlash = 0.9;

    const snapshot = readBossVitality(world);

    expect(snapshot.windingUp).toBe(true);
    expect(snapshot.defeated).toBe(false);
    expect(snapshot.staggerPercent).toBe(50);
  });

  it("lingers as offline after defeat without also reporting wounded", () => {
    const { world, boss } = createBossVitalityWorld();

    world.killEnemy(boss);
    const snapshot = readBossVitality(world);

    expect(snapshot.visible).toBe(true);
    expect(snapshot.defeated).toBe(true);
    expect(snapshot.wounded).toBe(false);
    expect(snapshot.healthPercent).toBe(0);
    expect(snapshot.staggerPercent).toBe(100);
  });
});

function createBossVitalityWorld(tierLabel?: string): { world: GameWorld; boss: EnemyState } {
  const world = new GameWorld();
  world.session.mode = "playing";
  world.settings.language = "zh";
  for (const enemy of world.enemies) {
    enemy.isAlive = false;
    enemy.deathAge = 99;
  }
  const boss = world.spawnEnemy("custodian_elite", "boss_vitality_test", new Vector3(0, 0, -2), 0, {
    tier: "boss",
    tierLabel,
  });
  return { world, boss };
}
