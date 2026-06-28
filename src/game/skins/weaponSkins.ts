import type { WeaponSkin } from "./SkinTypes";

export const pulseRifleSkin: WeaponSkin = {
  id: "pulseRifle",
  displayName: "实验铁棒",
  visualKey: "weapon_pulse_rifle_viewmodel",
  audioKey: "weapon_pulse_rifle",
  boltColor: "#7de8ff",
  muzzleColor: "#ffb43d",
  trailColor: "#43bfff",
  glowIntensity: 2.8,
};

export const railLanceSkin: WeaponSkin = {
  id: "railLance",
  displayName: "实验手枪",
  visualKey: "weapon_rail_lance_viewmodel",
  audioKey: "weapon_rail_lance",
  boltColor: "#fff2c0",
  muzzleColor: "#ffb35d",
  trailColor: "#ffd06f",
  glowIntensity: 2.2,
};

export const flakBurstSkin: WeaponSkin = {
  id: "flakBurst",
  displayName: "应急电池",
  visualKey: "weapon_shock_burst_viewmodel",
  audioKey: "weapon_shock_burst",
  boltColor: "#ff7b52",
  muzzleColor: "#ffb33d",
  trailColor: "#ff4d33",
  glowIntensity: 2.4,
};

export const weaponSkins = {
  pulseRifle: pulseRifleSkin,
  railLance: railLanceSkin,
  flakBurst: flakBurstSkin,
} as const satisfies Record<string, WeaponSkin>;
