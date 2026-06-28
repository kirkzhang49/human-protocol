export const AGE_RENDER_PLAN_SCHEMA_VERSION = "age.render-plan.v0";
export const AGE_ASSET_BUNDLE_SCHEMA_VERSION = "age.asset-bundle.v0";
export const AGE_SCENE_FRAME_SCHEMA_VERSION = "age.scene-frame.v0";

export interface AgeVersionedSchema {
  schemaVersion: string;
}

export function ageSchemaMatches(actual: string | undefined, expected: string) {
  return actual === expected;
}
