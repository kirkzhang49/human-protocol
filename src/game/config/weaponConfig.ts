export type WeaponId = "pulseRifle" | "railLance" | "flakBurst";

export interface WeaponConfig {
  id: WeaponId;
  displayName: string;
  shortName: string;
  roundsPerSecond: number;
  projectileSpeed: number;
  projectileDamage: number;
  projectileLifetime: number;
  projectileRadius: number;
  projectileCount: number;
  spread: number;
  recoilStrength: number;
  cameraShake: number;
  heatPerShot: number;
}

export const weaponOrder: readonly WeaponId[] = ["pulseRifle", "railLance"];

export const weaponConfig: Record<WeaponId, WeaponConfig> = {
  pulseRifle: {
    id: "pulseRifle",
    displayName: "实验铁棒",
    shortName: "棒",
    roundsPerSecond: 1.65,
    projectileSpeed: 0,
    projectileDamage: 62,
    projectileLifetime: 0.16,
    projectileRadius: 0.48,
    projectileCount: 1,
    spread: 0.72,
    recoilStrength: 1.72,
    cameraShake: 0.34,
    heatPerShot: 8,
  },
  railLance: {
    id: "railLance",
    displayName: "实验手枪",
    shortName: "枪",
    roundsPerSecond: 4.8,
    projectileSpeed: 34,
    projectileDamage: 15.4,
    projectileLifetime: 1.15,
    projectileRadius: 0.15,
    projectileCount: 1,
    spread: 0.003,
    recoilStrength: 0.95,
    cameraShake: 0.105,
    heatPerShot: 3,
  },
  flakBurst: {
    id: "flakBurst",
    displayName: "应急电池",
    shortName: "电池",
    roundsPerSecond: 0.12,
    projectileSpeed: 24,
    projectileDamage: 46,
    projectileLifetime: 0.62,
    projectileRadius: 0.34,
    projectileCount: 8,
    spread: 0.34,
    recoilStrength: 3,
    cameraShake: 0.68,
    heatPerShot: 42,
  },
};
