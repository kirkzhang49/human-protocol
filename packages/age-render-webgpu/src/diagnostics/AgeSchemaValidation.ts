import type { AgeAssetBundleDescriptor } from "../contracts/AgeAssetContracts";
import type { AgeRenderPlan } from "../contracts/AgeRenderPlanContracts";
import {
  AGE_ASSET_BUNDLE_SCHEMA_VERSION,
  AGE_RENDER_PLAN_SCHEMA_VERSION,
  AGE_SCENE_FRAME_SCHEMA_VERSION,
  ageSchemaMatches,
} from "../contracts/AgeSchemaVersions";
import type { AgeSceneFrame } from "../core/AgeSceneFrame";
import { ageError, ageWarning, type AgeDiagnostic } from "./AgeDiagnostics";

export function validateAgeAssetBundleSchema(bundle: AgeAssetBundleDescriptor) {
  const diagnostics: AgeDiagnostic[] = [];
  if (!ageSchemaMatches(bundle.schemaVersion, AGE_ASSET_BUNDLE_SCHEMA_VERSION)) {
    diagnostics.push(
      ageWarning(
        "age.schema.asset-bundle-version",
        `Asset bundle schema "${bundle.schemaVersion}" differs from expected "${AGE_ASSET_BUNDLE_SCHEMA_VERSION}".`,
        bundle.id,
      ),
    );
  }
  const textureIds = new Set<string>();
  for (const texture of bundle.textures ?? []) {
    if (textureIds.has(texture.id)) {
      diagnostics.push(ageError("age.schema.duplicate-texture-id", `Duplicate texture id "${texture.id}".`, texture.id));
    }
    textureIds.add(texture.id);
    if (texture.semantic === "baseColor" && texture.colorSpace !== "srgb") {
      diagnostics.push(ageWarning("age.schema.base-color-colorspace", `Base color texture "${texture.id}" should usually be srgb.`, texture.id));
    }
    if ((texture.semantic === "normal" || texture.semantic === "metallicRoughness" || texture.semantic === "ao") && texture.colorSpace === "srgb") {
      diagnostics.push(ageWarning("age.schema.linear-texture-colorspace", `Texture "${texture.id}" should usually be linear or none, not srgb.`, texture.id));
    }
  }
  const geometryIds = new Set<string>();
  for (const asset of bundle.geometry?.assets ?? []) {
    if (geometryIds.has(asset.id)) {
      diagnostics.push(ageError("age.schema.duplicate-geometry-id", `Duplicate geometry id "${asset.id}".`, asset.id));
    }
    geometryIds.add(asset.id);
    if (asset.status === "ready" && asset.vertexCount <= 0) {
      diagnostics.push(ageError("age.schema.ready-geometry-empty", `Ready geometry "${asset.id}" has no vertices.`, asset.id));
    }
  }
  return diagnostics;
}

export function validateAgeRenderPlanSchema(plan: AgeRenderPlan) {
  const diagnostics: AgeDiagnostic[] = [];
  if (!ageSchemaMatches(plan.schemaVersion, AGE_RENDER_PLAN_SCHEMA_VERSION)) {
    diagnostics.push(
      ageWarning(
        "age.schema.render-plan-version",
        `Render plan schema "${plan.schemaVersion}" differs from expected "${AGE_RENDER_PLAN_SCHEMA_VERSION}".`,
        plan.id,
      ),
    );
  }
  const instanceIds = new Set<string>();
  for (const instance of plan.instances) {
    if (instanceIds.has(instance.id)) {
      diagnostics.push(ageError("age.schema.duplicate-instance-id", `Duplicate instance id "${instance.id}".`, instance.id));
    }
    instanceIds.add(instance.id);
  }
  const materialIds = new Set<string>();
  const materialIndexes = new Set<number>();
  for (const material of plan.materials) {
    if (materialIds.has(material.id)) {
      diagnostics.push(ageError("age.schema.duplicate-material-id", `Duplicate material id "${material.id}".`, material.id));
    }
    if (materialIndexes.has(material.index)) {
      diagnostics.push(ageError("age.schema.duplicate-material-index", `Duplicate material index ${material.index}.`, material.id));
    }
    materialIds.add(material.id);
    materialIndexes.add(material.index);
  }
  return diagnostics;
}

export function validateAgeSceneFrameSchema(frame: AgeSceneFrame) {
  const diagnostics: AgeDiagnostic[] = [];
  if (frame.schemaVersion && !ageSchemaMatches(frame.schemaVersion, AGE_SCENE_FRAME_SCHEMA_VERSION)) {
    diagnostics.push(
      ageWarning(
        "age.schema.scene-frame-version",
        `Scene frame schema "${frame.schemaVersion}" differs from expected "${AGE_SCENE_FRAME_SCHEMA_VERSION}".`,
      ),
    );
  }
  if (frame.viewport.width <= 0 || frame.viewport.height <= 0 || frame.viewport.pixelRatio <= 0) {
    diagnostics.push(ageError("age.schema.invalid-viewport", "Scene frame viewport must be positive."));
  }
  const instanceIds = new Set<string>();
  for (const instance of frame.instances) {
    if (instanceIds.has(instance.id)) {
      diagnostics.push(ageError("age.schema.duplicate-frame-instance-id", `Duplicate frame instance id "${instance.id}".`, instance.id));
    }
    instanceIds.add(instance.id);
  }
  for (const batch of frame.drawBatches) {
    if (batch.vertexCount <= 0 || batch.instanceCount <= 0) {
      diagnostics.push(ageError("age.schema.invalid-draw-batch", "Draw batch vertexCount and instanceCount must be positive.", batch.id));
    }
  }
  return diagnostics;
}
