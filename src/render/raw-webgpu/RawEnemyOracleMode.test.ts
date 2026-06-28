import { describe, expect, it } from "vitest";
import { resolveRawThreeEnemyOracleModeFromParams } from "./RawEnemyOracleMode";

function params(query = "") {
  return new URLSearchParams(query);
}

describe("resolveRawThreeEnemyOracleModeFromParams", () => {
  it("defaults to the authored special enemy oracle overlay only", () => {
    expect(resolveRawThreeEnemyOracleModeFromParams(params())).toEqual({
      enabled: true,
      allEnemies: false,
      showDebugUi: false,
    });
  });

  it("still supports explicit Three enemy oracle debugging", () => {
    expect(resolveRawThreeEnemyOracleModeFromParams(params("enemyOracle=three"))).toEqual({
      enabled: true,
      allEnemies: true,
      showDebugUi: true,
    });
    expect(resolveRawThreeEnemyOracleModeFromParams(params("threeEnemyOracle=1"))).toEqual({
      enabled: true,
      allEnemies: true,
      showDebugUi: true,
    });
  });

  it("keeps explicit off requests disabled", () => {
    expect(resolveRawThreeEnemyOracleModeFromParams(params("enemyOracle=off"))).toEqual({
      enabled: false,
      allEnemies: false,
      showDebugUi: false,
    });
  });
});
