import enemyVisualProfileConfig from "./enemyVisualProfiles.json";

export const enemyVisualProfilesConfig = enemyVisualProfileConfig;

export const premiumEnemyVisualPalette = enemyVisualProfilesConfig.globalPalette;

export type EnemyVisualProfileId = keyof typeof enemyVisualProfilesConfig.profiles;

export function enemyVisualProfileFor(profileId: EnemyVisualProfileId) {
  return enemyVisualProfilesConfig.profiles[profileId];
}
