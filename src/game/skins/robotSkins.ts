import type { RobotSkin } from "./SkinTypes";

export const crimsonCoreHeavyMech: RobotSkin = {
  id: "CrimsonCoreHeavyMech",
  displayName: "绯红核心重型机体",
  colors: {
    body: "#252c34",
    armor: "#4d1314",
    armorSecondary: "#151a20",
    joint: "#0a0d12",
    core: "#ff4b2f",
    coreHot: "#ffb33d",
    accent: "#73dcff",
    rim: "#eaf9ff",
  },
  material: {
    bodyMetalness: 0.82,
    bodyRoughness: 0.34,
    armorMetalness: 0.72,
    armorRoughness: 0.28,
    glowIntensity: 2.3,
  },
  scale: {
    height: 1,
    width: 1,
    bulk: 1.08,
  },
  partVisibility: {
    shoulderCannons: true,
    backThrusters: true,
    antenna: true,
    kneeGuards: true,
    glowingPanels: true,
  },
  weaponHardpoints: [
    {
      id: "leftCannon",
      label: "左手武器挂点",
      side: "left",
      localPosition: [-0.92, 2.03, 0.88],
      localDirection: [0, 0, 1],
    },
    {
      id: "rightCannon",
      label: "右手武器挂点",
      side: "right",
      localPosition: [0.92, 2.03, 0.88],
      localDirection: [0, 0, 1],
    },
  ],
  animationStyle: "heavy-hover",
};

export const robotSkins = {
  CrimsonCoreHeavyMech: crimsonCoreHeavyMech,
} as const satisfies Record<string, RobotSkin>;
