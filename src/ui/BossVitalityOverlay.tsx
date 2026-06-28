import type { CSSProperties } from "react";
import type { EnemyArchetypeId } from "../game/config/enemyArchetypes";
import { bossCopy, bossStaggerTuningForEnemy, bossVisualProfileForEnemy, type BossVisualProfile } from "../game/config/bossVisualProfiles";
import type { GameWorld } from "../game/core/GameWorld";
import { isEnemyVisibleToPlayerRoom } from "../game/core/RoomReachability";
import type { GameLanguage } from "../game/core/GameSettings";
import type { EnemyState } from "../game/entities/EnemyState";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface BossVitalityOverlayProps {
  world: GameWorld;
}

interface BossVitalitySnapshot {
  visible: boolean;
  language: GameLanguage;
  name: string;
  kickerLabel: string;
  statusLabel: string;
  staggerLabel: string;
  healthPercent: number;
  healthExact: number;
  impact: number;
  wounded: boolean;
  staggered: boolean;
  windingUp: boolean;
  defeated: boolean;
  armorPercent: number;
  staggerPercent: number;
}

export function BossVitalityOverlay({ world }: BossVitalityOverlayProps) {
  const snapshot = usePolledSnapshot(() => readBossVitality(world), 80, sameBossVitalitySnapshot);
  if (!snapshot.visible) return null;
  const pressure = !snapshot.defeated && !snapshot.windingUp && !snapshot.staggered && snapshot.staggerPercent >= 72;
  const hit = !snapshot.defeated && !snapshot.windingUp && snapshot.impact > 0.12;

  const style = {
    "--boss-health": `${snapshot.healthPercent}%`,
    "--boss-armor": `${snapshot.armorPercent}%`,
    "--boss-stagger": `${snapshot.staggerPercent}%`,
    "--boss-impact": snapshot.impact.toFixed(3),
  } as CSSProperties;
  return (
    <section
      className={`boss-vitality${hit ? " is-hit" : ""}${snapshot.wounded ? " is-wounded" : ""}${pressure ? " is-pressure" : ""}${snapshot.staggered ? " is-staggered" : ""}${snapshot.windingUp ? " is-warning" : ""}${snapshot.defeated ? " is-defeated" : ""}`}
      style={style}
      aria-label={`${snapshot.language === "en" ? "Boss vitality" : "主管状态"} ${snapshot.name} ${snapshot.statusLabel}`}
    >
      <div className="boss-vitality-frame" aria-hidden="true" />
      <div className="boss-vitality-copy">
        <span>{snapshot.kickerLabel}</span>
        <strong>{snapshot.name}</strong>
        <em>{snapshot.statusLabel}</em>
      </div>
      <div className="boss-vitality-meter" aria-hidden="true">
        <i />
        <b />
        <em />
      </div>
      <div className="boss-vitality-readout">
        <span>{Math.max(0, snapshot.healthExact).toFixed(0)}%</span>
      </div>
      <div className="boss-vitality-armor" aria-hidden="true">
        <i />
        <b />
        <b />
      </div>
      <div className="boss-vitality-stagger">
        <i aria-hidden="true" />
        <span>
          {snapshot.staggerLabel} {Math.round(snapshot.staggerPercent)}%
        </span>
      </div>
    </section>
  );
}

export function readBossVitality(world: GameWorld): BossVitalitySnapshot {
  const target = priorityBossTarget(world);
  const language = world.settings.language;
  if (world.session.mode !== "playing" || world.paused || !target) {
    return {
      visible: false,
      language,
      name: "",
      kickerLabel: "",
      statusLabel: "",
      staggerLabel: "",
      healthPercent: 0,
      healthExact: 0,
      impact: 0,
      wounded: false,
      staggered: false,
      windingUp: false,
      defeated: false,
      armorPercent: 0,
      staggerPercent: 0,
    };
  }

  const defeated = !target.isAlive;
  const deathSignal = defeated ? Math.max(0, 1 - target.deathAge / 1.05) : 0;
  const healthRatio = defeated ? 0 : target.maxHealth > 0 ? Math.max(0, Math.min(1, target.health / target.maxHealth)) : 0;
  const windingUp = !defeated && target.attackWindupRemaining > 0 && target.attackWindupTotal > 0;
  const windupRatio = windingUp
    ? Math.max(0, Math.min(1, 1 - target.attackWindupRemaining / Math.max(0.001, target.attackWindupTotal)))
    : 0;
  const profile = bossVisualProfileForEnemy(world.level.id, target);
  const staggerWindowRatio = target.staggerTotal > 0 ? Math.max(0, Math.min(1, target.staggerRemaining / target.staggerTotal)) : 0;
  const staggerPressureRatio = target.staggerRemaining > 0
    ? staggerWindowRatio
    : Math.max(0, Math.min(1, target.staggerCharge / bossStaggerThreshold(world.level.id, target)));
  const impact = Math.max(target.damageFlash * 0.72, target.hitReact * 3.25, staggerWindowRatio * 0.62, staggerPressureRatio * 0.18, windupRatio * 0.55, deathSignal * 0.7);
  return {
    visible: true,
    language,
    name: bossDisplayName(target, language, profile),
    kickerLabel: bossKickerLabel(profile, language),
    statusLabel: bossStatusLabel(profile, language, {
      defeated,
      windingUp,
      staggered: !defeated && target.staggerRemaining > 0,
      pressure: staggerPressureRatio >= 0.72,
      hit: impact > 0.12,
      wounded: !defeated && healthRatio <= 0.35,
    }),
    staggerLabel: bossStaggerLabel(profile, language, {
      defeated,
      windingUp,
      staggered: !defeated && target.staggerRemaining > 0,
    }),
    healthPercent: Math.round(healthRatio * 100),
    healthExact: healthRatio * 100,
    impact: Math.max(0, Math.min(1, impact)),
    wounded: !defeated && healthRatio <= 0.35,
    staggered: !defeated && target.staggerRemaining > 0,
    windingUp,
    defeated,
    armorPercent: Math.round(Math.max(0, Math.min(1, healthRatio)) * 100),
    staggerPercent: defeated ? Math.round(deathSignal * 100) : windingUp ? Math.round(windupRatio * 100) : Math.round(staggerPressureRatio * 100),
  };
}

function priorityBossTarget(world: GameWorld) {
  let liveTarget: EnemyState | null = null;
  let recentDefeatedTarget: EnemyState | null = null;
  for (const enemy of world.enemies) {
    if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
    if (!isBossLike(world, enemy)) continue;
    if (enemy.isAlive) {
      if (!liveTarget || enemy.maxHealth > liveTarget.maxHealth || (enemy.maxHealth === liveTarget.maxHealth && enemy.health < liveTarget.health)) {
        liveTarget = enemy;
      }
    } else if (enemy.deathAge < 1.05) {
      if (!recentDefeatedTarget || enemy.deathAge < recentDefeatedTarget.deathAge) {
        recentDefeatedTarget = enemy;
      }
    }
  }
  return liveTarget ?? recentDefeatedTarget;
}

function isBossLike(world: GameWorld, enemy: EnemyState) {
  return (
    Boolean(bossVisualProfileForEnemy(world.level.id, enemy)) ||
    enemy.tier === "boss" ||
    enemy.tier === "leader" ||
    enemy.archetypeId === world.level.combatLimits.eliteArchetypeId ||
    enemy.archetypeId === "custodian_elite"
  );
}

function bossDisplayName(enemy: EnemyState, language: GameLanguage, profile?: BossVisualProfile) {
  if (profile) return bossCopy(profile.copy.displayName, language);
  if (language === "en") return englishBossName(enemy.archetypeId, enemy.tier);
  const tierLabel = enemy.tierLabel?.trim();
  if (tierLabel && tierLabel !== enemy.tier && !tierLabel.toLowerCase().includes("boss")) return tierLabel;
  if (enemy.archetypeId === "custodian_elite") return "维修主管";
  if (enemy.tier === "boss") return "大型主管机体";
  if (enemy.tier === "leader") return "头领机体";
  return "高威胁目标";
}

function englishBossName(archetypeId: EnemyArchetypeId, tier: EnemyState["tier"]) {
  if (archetypeId === "custodian_elite") return "Custodian Foreman";
  if (tier === "boss") return "Boss Unit";
  if (tier === "leader") return "Leader Unit";
  return "High-Threat Unit";
}

function bossKickerLabel(profile: BossVisualProfile | undefined, language: GameLanguage) {
  if (profile) return bossCopy(profile.copy.kicker, language);
  return language === "en" ? "Priority target" : "压制目标";
}

function bossStatusLabel(
  profile: BossVisualProfile | undefined,
  language: GameLanguage,
  state: { defeated: boolean; windingUp: boolean; staggered: boolean; pressure: boolean; hit: boolean; wounded: boolean },
) {
  if (profile) {
    if (state.defeated) return bossCopy(profile.copy.defeated, language);
    if (state.windingUp) return bossCopy(profile.copy.incomingStrike, language);
    if (state.staggered) return bossCopy(profile.copy.staggerWindow, language);
    if (state.pressure) return bossCopy(profile.copy.armorBreaking, language);
    if (state.hit) return bossCopy(profile.copy.armorHit, language);
    if (state.wounded) return bossCopy(profile.copy.armorFailing, language);
    return bossCopy(profile.copy.armorIntact, language);
  }
  if (state.defeated) return language === "en" ? "Target offline" : "目标离线";
  if (state.windingUp) return language === "en" ? "Incoming strike" : "重击预警";
  if (state.staggered) return language === "en" ? "Stagger window" : "硬直窗口";
  if (state.pressure) return language === "en" ? "Armor breaking" : "装甲将破";
  if (state.hit) return language === "en" ? "Armor hit" : "装甲受击";
  if (state.wounded) return language === "en" ? "Armor failing" : "装甲破损";
  return language === "en" ? "Armor integrity" : "装甲完整";
}

function bossStaggerLabel(
  profile: BossVisualProfile | undefined,
  language: GameLanguage,
  state: { defeated: boolean; windingUp: boolean; staggered: boolean },
) {
  if (profile) {
    if (state.defeated) return bossCopy(profile.copy.offlineLabel, language);
    if (state.windingUp) return bossCopy(profile.copy.warningLabel, language);
    if (state.staggered) return language === "en" ? "Window" : "窗口";
    return bossCopy(profile.copy.staggerLabel, language);
  }
  if (state.defeated) return language === "en" ? "Offline" : "离线";
  if (state.windingUp) return language === "en" ? "Warning" : "预警";
  if (state.staggered) return language === "en" ? "Window" : "窗口";
  return language === "en" ? "Stagger" : "压制";
}

function bossStaggerThreshold(levelId: string, enemy: EnemyState) {
  const base = enemy.tier === "boss" ? 2.72 : enemy.tier === "leader" ? 2.48 : 2.62;
  return base * bossStaggerTuningForEnemy(levelId, enemy).thresholdMultiplier;
}

function sameBossVitalitySnapshot(current: BossVitalitySnapshot, next: BossVitalitySnapshot) {
  return (
    current.visible === next.visible &&
    current.language === next.language &&
    current.name === next.name &&
    current.kickerLabel === next.kickerLabel &&
    current.statusLabel === next.statusLabel &&
    current.staggerLabel === next.staggerLabel &&
    current.healthPercent === next.healthPercent &&
    Math.abs(current.healthExact - next.healthExact) < 0.2 &&
    Math.abs(current.impact - next.impact) < 0.04 &&
    current.wounded === next.wounded &&
    current.staggered === next.staggered &&
    current.windingUp === next.windingUp &&
    current.defeated === next.defeated &&
    Math.abs(current.armorPercent - next.armorPercent) < 2 &&
    Math.abs(current.staggerPercent - next.staggerPercent) < 4
  );
}
