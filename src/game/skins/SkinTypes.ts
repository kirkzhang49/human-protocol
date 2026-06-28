export type RobotSkinId = "CrimsonCoreHeavyMech";
export type WeaponHardpointId = "leftCannon" | "rightCannon";
export type RobotAnimationStyle = "heavy-hover";

export interface RobotSkinColors {
  body: string;
  armor: string;
  armorSecondary: string;
  joint: string;
  core: string;
  coreHot: string;
  accent: string;
  rim: string;
}

export interface RobotSkinMaterialSettings {
  bodyMetalness: number;
  bodyRoughness: number;
  armorMetalness: number;
  armorRoughness: number;
  glowIntensity: number;
}

export interface RobotPartVisibility {
  shoulderCannons: boolean;
  backThrusters: boolean;
  antenna: boolean;
  kneeGuards: boolean;
  glowingPanels: boolean;
}

export interface WeaponHardpoint {
  id: WeaponHardpointId;
  label: string;
  side: "left" | "right";
  localPosition: readonly [number, number, number];
  localDirection: readonly [number, number, number];
}

export interface RobotSkin {
  id: RobotSkinId;
  displayName: string;
  colors: RobotSkinColors;
  material: RobotSkinMaterialSettings;
  scale: {
    height: number;
    width: number;
    bulk: number;
  };
  partVisibility: RobotPartVisibility;
  weaponHardpoints: readonly WeaponHardpoint[];
  animationStyle: RobotAnimationStyle;
}

export interface WeaponSkin {
  id: string;
  displayName: string;
  visualKey: string;
  audioKey: string;
  boltColor: string;
  muzzleColor: string;
  trailColor: string;
  glowIntensity: number;
}
