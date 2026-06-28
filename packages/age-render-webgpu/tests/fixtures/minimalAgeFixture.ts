import {
  AGE_ASSET_BUNDLE_SCHEMA_VERSION,
  AGE_RENDER_PLAN_SCHEMA_VERSION,
  AGE_SCENE_FRAME_SCHEMA_VERSION,
} from "../../src/contracts/AgeSchemaVersions";
import type { AgeAssetBundleDescriptor } from "../../src/contracts/AgeAssetContracts";
import type { AgeRenderPlan } from "../../src/contracts/AgeRenderPlanContracts";
import type { AgeSceneFrame } from "../../src/core/AgeSceneFrame";

const identityMat4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

export const minimalAgeAssetBundle: AgeAssetBundleDescriptor = {
  id: "fixture.bundle.minimal",
  schemaVersion: AGE_ASSET_BUNDLE_SCHEMA_VERSION,
  source: "compiled",
  geometry: {
    id: "fixture.geometry.minimal",
    binaryUrl: "/fixtures/minimal.geometry.bin",
    vertexStrideFloats: 14,
    assets: [
      {
        id: "fixture.geometry.cube",
        modelKey: "fixture:cube",
        vertexOffset: 0,
        vertexCount: 36,
        triangleCount: 12,
        bounds: {
          min: [-0.5, -0.5, -0.5],
          center: [0, 0, 0],
          size: [1, 1, 1],
        },
        status: "ready",
      },
    ],
  },
  textures: [
    {
      id: "fixture.texture.base-color",
      url: "/fixtures/base-color.webp",
      semantic: "baseColor",
      colorSpace: "srgb",
      layer: 1,
    },
  ],
};

export const minimalAgeRenderPlan: AgeRenderPlan = {
  id: "fixture.plan.minimal",
  schemaVersion: AGE_RENDER_PLAN_SCHEMA_VERSION,
  assetBundleId: minimalAgeAssetBundle.id,
  rooms: [
    {
      id: "fixture.room",
      bounds: {
        min: [-4, 0, -4],
        center: [0, 1.5, 0],
        size: [8, 3, 8],
      },
    },
  ],
  materials: [
    {
      id: "fixture.material.default",
      index: 0,
      name: "fixture_default",
      role: "neutral-surface",
      baseColorFactor: [1, 1, 1, 1],
      roughnessFactor: 0.72,
      metallicFactor: 0,
      alphaMode: "OPAQUE",
    },
  ],
  instances: [
    {
      id: "fixture.instance.cube",
      modelKey: "fixture:cube",
      roomId: "fixture.room",
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialRole: "neutral-surface",
      bounds: {
        min: [-0.5, 0, -0.5],
        center: [0, 0.5, 0],
        size: [1, 1, 1],
      },
      visibility: { type: "room", roomId: "fixture.room" },
    },
  ],
  lights: [
    {
      id: "fixture.light.key",
      type: "point",
      roomId: "fixture.room",
      color: [1, 0.96, 0.86],
      intensity: 1,
      position: [0, 2, 1.5],
      range: 6,
    },
  ],
};

export const minimalAgeSceneFrame: AgeSceneFrame = {
  schemaVersion: AGE_SCENE_FRAME_SCHEMA_VERSION,
  timing: {
    frameIndex: 1,
    deltaSeconds: 1 / 60,
    elapsedSeconds: 1 / 60,
  },
  viewport: {
    width: 1280,
    height: 720,
    pixelRatio: 1,
  },
  qualityTier: "balanced",
  camera: {
    viewMatrix: identityMat4,
    projectionMatrix: identityMat4,
    viewProjectionMatrix: identityMat4,
    position: [0, 1.6, 4],
  },
  lighting: {
    ambient: {
      color: [0.12, 0.14, 0.16],
      intensity: 0.4,
    },
    localLights: [
      {
        id: "fixture.light.key",
        type: "point",
        color: [1, 0.96, 0.86],
        intensity: 1,
        position: [0, 2, 1.5],
        range: 6,
      },
    ],
  },
  instances: [
    {
      id: "fixture.instance.cube",
      meshId: "fixture:cube",
      materialId: "fixture.material.default",
      materialRole: "neutral-surface",
      transform: identityMat4,
      bounds: minimalAgeRenderPlan.instances[0].bounds,
      dynamic: true,
      lastTransformFrameIndex: 1,
    },
  ],
  contacts: [
    {
      id: "fixture.contact.cube",
      instanceId: "fixture.instance.cube",
      position: [0, 0.02, 0],
      halfExtents: [0.6, 0.6],
      strength: 0.24,
      grounded: true,
      source: "derived",
    },
  ],
  portalStates: [
    {
      id: "fixture.portal.door",
      open: false,
      openProgress: 0,
    },
  ],
  animationStates: [
    {
      instanceId: "fixture.instance.cube",
      action: "idle",
      timeSeconds: 0.5,
      loop: true,
    },
  ],
  drawBatches: [
    {
      id: "fixture.instance.cube",
      vertexBufferId: "geometry",
      geometryId: "fixture.geometry.cube",
      materialId: "fixture.material.default",
      materialRole: "neutral-surface",
      vertexOffset: 0,
      vertexCount: 36,
      instanceOffset: 0,
      instanceCount: 1,
      receivesContactShadow: true,
    },
  ],
};
