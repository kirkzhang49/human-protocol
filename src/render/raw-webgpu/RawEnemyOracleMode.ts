export interface RawThreeEnemyOracleMode {
  enabled: boolean;
  allEnemies: boolean;
  showDebugUi: boolean;
}

const RAW_THREE_ENEMY_ORACLE_OFF: RawThreeEnemyOracleMode = {
  enabled: false,
  allEnemies: false,
  showDebugUi: false,
};

const RAW_THREE_ENEMY_ORACLE_SPECIAL: RawThreeEnemyOracleMode = {
  enabled: true,
  allEnemies: false,
  showDebugUi: false,
};

const RAW_THREE_ENEMY_ORACLE_DEBUG: RawThreeEnemyOracleMode = {
  enabled: true,
  allEnemies: true,
  showDebugUi: true,
};

export function resolveRawThreeEnemyOracleModeFromParams(params: URLSearchParams): RawThreeEnemyOracleMode {
  const mode = params.get("enemyOracle");
  if (mode === "off" || params.get("threeEnemyOracle") === "0") return RAW_THREE_ENEMY_ORACLE_OFF;
  if (mode === "three" || mode === "three-only" || params.get("threeEnemyOracle") === "1") return RAW_THREE_ENEMY_ORACLE_DEBUG;
  return RAW_THREE_ENEMY_ORACLE_SPECIAL;
}

export function rawThreeEnemyOracleOnlyEnabledFromParams(params: URLSearchParams) {
  return params.get("enemyOracle") === "three-only";
}
