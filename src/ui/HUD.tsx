import type { GameWorld } from "../game/core/GameWorld";
import type { GameLanguage } from "../game/core/GameSettings";
import { weaponConfig, type WeaponId } from "../game/config/weaponConfig";
import { localizedConfigText } from "../game/config/LevelLocalization";
import { shallowEqualSnapshot, usePolledSnapshot } from "./usePolledSnapshot";
import { CoreCellIcon, PistolIcon, RodIcon } from "./WeaponIcons";

interface HUDProps {
  world: GameWorld;
}

interface HUDSnapshot {
  healthPercent: number;
  energyPercent: number;
  dashPercent: number;
  dashSeconds: string;
  weaponName: string;
  ammoText: string;
  currentWeapon: WeaponId;
  gunAmmoPercent: number;
  gunReloadPercent: number;
  gunReloadSeconds: string;
  isGunReloading: boolean;
  coreCells: number;
  ultimateHeld: boolean;
  hasRod: boolean;
  hasPistol: boolean;
  paused: boolean;
  weaponHudVisible: boolean;
  language: GameLanguage;
  damageFlash: number;
}

export function HUD({ world }: HUDProps) {
  const snapshot = usePolledSnapshot(() => readHUD(world), 110, shallowEqualSnapshot);

  return (
    <>
      <section className="hud" aria-label={snapshot.language === "en" ? "Player status" : "玩家状态"}>
        <StatusBar icon={snapshot.language === "en" ? "HP" : "心"} label={snapshot.language === "en" ? "Health" : "生命"} value={snapshot.healthPercent} />
        <StatusBar icon={snapshot.language === "en" ? "ST" : "息"} label={snapshot.language === "en" ? "Stamina" : "精力"} value={snapshot.energyPercent} variant="energy" />
      </section>
      {snapshot.weaponHudVisible ? (
      <section className="lower-hud" aria-label={snapshot.language === "en" ? "Weapons and dash status" : "技能和冲刺状态"}>
        <div className="desktop-action-hud" aria-hidden="true">
          <div className="desktop-action-cluster">
            <span
              className={
                snapshot.currentWeapon === "pulseRifle"
                  ? `desktop-action-slot rod active${snapshot.hasRod ? "" : " disabled"}`
                  : `desktop-action-slot rod${snapshot.hasRod ? "" : " disabled"}`
              }
            >
              <span className="desktop-key-chip">1</span>
              <RodIcon className="mobile-action-icon rod-icon" />
            </span>
            <span
              className={pistolSlotClass(snapshot)}
              style={
                {
                  "--ammo-progress": `${snapshot.gunAmmoPercent}%`,
                  "--reload-progress": `${snapshot.gunReloadPercent}%`,
                } as React.CSSProperties
              }
            >
              <span className="desktop-cooldown-ring" />
              <span className="desktop-key-chip">2</span>
              <PistolIcon className="mobile-action-icon pistol-icon" />
            </span>
            <span
              className={
                snapshot.coreCells > 0 || snapshot.ultimateHeld
                  ? "desktop-action-slot item item-ready"
                  : "desktop-action-slot item item-empty"
              }
            >
              <span className="desktop-key-chip">3</span>
              <CoreCellIcon className="mobile-action-icon item-icon" />
            </span>
          </div>
          <div
            className={snapshot.currentWeapon === "railLance" && snapshot.isGunReloading ? "desktop-action-readout reloading" : "desktop-action-readout"}
            style={{ "--weapon-progress": `${snapshot.gunReloadPercent}%` } as React.CSSProperties}
          >
            <span>{snapshot.weaponName}</span>
            <strong>{snapshot.ammoText}</strong>
          </div>
          {snapshot.isGunReloading ? (
            <div className="desktop-reload-caption">
              <span>{snapshot.language === "en" ? "Pistol reload" : "手枪换弹"}</span>
              <strong>{snapshot.gunReloadSeconds}</strong>
            </div>
          ) : null}
          <div className="desktop-dash-readout">
            <span>Space</span>
            <div className="desktop-dash-track">
              <i style={{ "--dash": `${snapshot.dashPercent}%` } as React.CSSProperties} />
            </div>
            <strong>{snapshot.dashSeconds}</strong>
          </div>
        </div>
      </section>
      ) : null}
      <div className="cockpit-vignette" style={{ "--damage-flash": snapshot.damageFlash } as React.CSSProperties} aria-hidden="true" />
      <div className="cockpit-scan-frame" aria-hidden="true">
        <span className="scan-corner tl" />
        <span className="scan-corner tr" />
        <span className="scan-corner bl" />
        <span className="scan-corner br" />
      </div>
      {snapshot.paused ? <div className="paused-banner">{snapshot.language === "en" ? "Paused" : "已暂停"}</div> : null}
    </>
  );
}

function StatusBar({
  icon,
  label,
  value,
  variant = "health",
}: {
  icon: string;
  label: string;
  value: number;
  variant?: "health" | "energy";
}) {
  return (
    <div className={`hud-row ${variant}`}>
      <div className="hud-icon">{icon}</div>
      <div>
        <div className="hud-label-line">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
        <div className="bar-track">
          <div className={`bar-fill ${variant}`} style={{ "--value": `${value}%` } as React.CSSProperties} />
        </div>
      </div>
    </div>
  );
}

function readHUD(world: GameWorld): HUDSnapshot {
  const player = world.player;
  const dashCooldown = world.dashCooldownDuration();
  const dashReady =
    player.dashCooldownRemaining <= 0
      ? 100
      : 100 - (player.dashCooldownRemaining / dashCooldown) * 100;

  return {
    healthPercent: aliveHealthPercent(player.health, player.maxHealth),
    energyPercent: roundedPercent(player.energy / player.maxEnergy),
    dashPercent: Math.round(Math.max(0, Math.min(100, dashReady))),
    dashSeconds:
      player.dashCooldownRemaining <= 0
        ? (world.settings.language === "en" ? "Ready" : "就绪")
        : world.settings.language === "en"
          ? `${player.dashCooldownRemaining.toFixed(1)}s`
          : `${player.dashCooldownRemaining.toFixed(1)}秒`,
    weaponName: world.weaponUnlocked(player.currentWeapon)
      ? localizedConfigText(world.level, world.settings.language, weaponConfig[player.currentWeapon].displayName)
      : world.settings.language === "en"
        ? "Locked"
        : "未拾取",
    ammoText: weaponAmmoText(world),
    currentWeapon: player.currentWeapon,
    gunAmmoPercent: player.gunMaxAmmo > 0 ? Math.round((player.gunAmmo / player.gunMaxAmmo) * 100) : 0,
    gunReloadPercent:
      player.gunReloadRemaining > 0 && player.gunReloadDuration > 0
        ? Math.round(100 - (player.gunReloadRemaining / player.gunReloadDuration) * 100)
        : 100,
    gunReloadSeconds: world.settings.language === "en"
      ? `${Math.max(0, player.gunReloadRemaining).toFixed(1)}s`
      : `${Math.max(0, player.gunReloadRemaining).toFixed(1)}秒`,
    isGunReloading: player.gunReloadRemaining > 0,
    coreCells: world.session.coreCells,
    ultimateHeld: world.session.deployedUltimate?.phase === "held",
    hasRod: world.session.hasRod,
    hasPistol: world.session.hasPistol,
    paused: world.paused,
    // Hide the weapon readout while a focus reveal plays (mode stays "playing"
    // but the first-person weapon is hidden and the player isn't in control).
    weaponHudVisible: world.session.mode === "playing" && !world.paused && !world.session.activeFocusReveal && !world.session.activeHandInteraction,
    language: world.settings.language,
    damageFlash: Number(player.damageFlash.toFixed(3)),
  };
}

function roundedPercent(ratio: number) {
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

function aliveHealthPercent(health: number, maxHealth: number) {
  if (health <= 0 || maxHealth <= 0) return 0;
  return Math.max(1, roundedPercent(health / maxHealth));
}

function weaponAmmoText(world: GameWorld) {
  const player = world.player;
  const english = world.settings.language === "en";
  if (!world.weaponUnlocked(player.currentWeapon)) return english ? "Locked" : "锁定";
  if (player.currentWeapon !== "railLance") return english ? "Auto" : "自动";
  if (player.gunReloadRemaining > 0) {
    const time = player.gunReloadRemaining.toFixed(1);
    return english ? `Reload ${time}s` : `换弹 ${time}秒`;
  }
  return `${player.gunAmmo}/${player.gunMaxAmmo}`;
}

function pistolSlotClass(snapshot: HUDSnapshot) {
  const classes = ["desktop-action-slot", "pistol"];
  if (!snapshot.hasPistol) classes.push("disabled");
  if (snapshot.currentWeapon === "railLance") classes.push("active");
  if (snapshot.isGunReloading) classes.push("reloading");
  if (!snapshot.isGunReloading && snapshot.gunAmmoPercent <= 25) classes.push("low-ammo");
  return classes.join(" ");
}
