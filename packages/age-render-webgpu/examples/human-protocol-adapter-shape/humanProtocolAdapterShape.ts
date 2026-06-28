import {
  AGE_ASSET_BUNDLE_SCHEMA_VERSION,
  AGE_RENDER_PLAN_SCHEMA_VERSION,
  AGE_SCENE_FRAME_SCHEMA_VERSION,
  AgeAssetRegistry,
  type AgeAssetBundleDescriptor,
  type AgeGameAdapter,
  type AgeRenderPlan,
  type AgeSceneFrame,
} from "../../src";

type MockHumanRawRenderPlan = {
  level: { id: string };
  geometry?: {
    binaryFile: string;
    vertexStrideFloats: number;
    assets: Array<{
      modelKey: string;
      vertexOffset: number;
      vertexCount: number;
      triangleCount?: number;
      status: "ready" | "empty" | "missing";
    }>;
    materials?: Array<{
      index: number;
      id: string;
      name: string;
      category?: string;
      visualRole?: string | null;
      baseColorFactor: [number, number, number, number];
      emissiveFactor?: [number, number, number];
      emissiveStrength?: number;
      roughnessFactor?: number;
      metallicFactor?: number;
      alphaMode?: "OPAQUE" | "MASK" | "BLEND";
    }>;
  };
  instances: Array<{
    id: string;
    modelKey: string;
    roomId: string | null;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    role?: string;
  }>;
};

type MockHumanRuntimeWorld = {
  frameIndex: number;
  elapsedSeconds: number;
  qualityTier: "high" | "balanced" | "rescue";
};

type MockHumanCamera = {
  viewProjectionMatrix: readonly number[];
  position: [number, number, number];
};

export const humanProtocolAdapterShape: AgeGameAdapter<MockHumanRawRenderPlan, MockHumanRuntimeWorld, MockHumanCamera> = {
  id: "human-protocol.adapter-shape",

  createAssetBundles(level) {
    const bundle: AgeAssetBundleDescriptor = {
      id: `human-protocol.bundle.${level.level.id}`,
      schemaVersion: AGE_ASSET_BUNDLE_SCHEMA_VERSION,
      source: "compiled",
      geometry: level.geometry
        ? {
            id: `human-protocol.geometry.${level.level.id}`,
            binaryUrl: level.geometry.binaryFile,
            vertexStrideFloats: level.geometry.vertexStrideFloats,
            assets: level.geometry.assets.map((asset) => ({
              id: `geometry:${asset.modelKey}`,
              modelKey: asset.modelKey,
              vertexOffset: asset.vertexOffset,
              vertexCount: asset.vertexCount,
              triangleCount: asset.triangleCount,
              status: asset.status,
            })),
          }
        : undefined,
    };
    return { value: [bundle] };
  },

  createRenderPlan(level) {
    const plan: AgeRenderPlan = {
      id: `human-protocol.plan.${level.level.id}`,
      schemaVersion: AGE_RENDER_PLAN_SCHEMA_VERSION,
      assetBundleId: `human-protocol.bundle.${level.level.id}`,
      rooms: [],
      materials: (level.geometry?.materials ?? []).map((material) => ({
        id: material.id,
        index: material.index,
        name: material.name,
        category: material.category,
        role: humanRoleToAgeRole(material.visualRole ?? material.category ?? "default"),
        baseColorFactor: material.baseColorFactor,
        emissiveFactor: material.emissiveFactor,
        emissiveStrength: material.emissiveStrength,
        roughnessFactor: material.roughnessFactor,
        metallicFactor: material.metallicFactor,
        alphaMode: material.alphaMode,
      })),
      instances: level.instances.map((instance) => ({
        id: instance.id,
        modelKey: instance.modelKey,
        roomId: instance.roomId,
        position: instance.position,
        rotation: instance.rotation,
        scale: instance.scale,
        materialRole: humanRoleToAgeRole(instance.role ?? "default"),
        visibility: instance.roomId ? { type: "room", roomId: instance.roomId } : { type: "always" },
      })),
    };
    return { value: plan };
  },

  createSceneFrame({ world, camera, renderPlan, assets }) {
    const registry = assets instanceof AgeAssetRegistry ? assets : new AgeAssetRegistry();
    void registry;
    const frame: AgeSceneFrame = {
      schemaVersion: AGE_SCENE_FRAME_SCHEMA_VERSION,
      timing: {
        frameIndex: world.frameIndex,
        deltaSeconds: 1 / 60,
        elapsedSeconds: world.elapsedSeconds,
      },
      viewport: {
        width: 1,
        height: 1,
        pixelRatio: 1,
      },
      qualityTier: world.qualityTier,
      camera: {
        viewMatrix: camera.viewProjectionMatrix,
        projectionMatrix: camera.viewProjectionMatrix,
        viewProjectionMatrix: camera.viewProjectionMatrix,
        position: camera.position,
      },
      lighting: {
        ambient: { color: [0.12, 0.14, 0.16], intensity: 0.4 },
        localLights: [],
      },
      instances: [],
      drawBatches: renderPlan.instances.map((instance, index) => ({
        id: instance.id,
        vertexBufferId: "geometry",
        geometryId: `geometry:${instance.modelKey}`,
        vertexOffset: 0,
        vertexCount: 1,
        instanceOffset: index,
        instanceCount: 1,
        materialRole: instance.materialRole,
      })),
    };
    return { value: frame };
  },
};

function humanRoleToAgeRole(role: string) {
  if (/glass|transparent/i.test(role)) return "transparent-glass";
  if (/floor/i.test(role)) return "floor-surface";
  if (/ceiling/i.test(role)) return "ceiling-surface";
  if (/robot|enemy|character/i.test(role)) return "character-body";
  if (/pickup|key|cell|ammo/i.test(role)) return "pickup";
  if (/screen|emissive|light|route|danger|door/i.test(role)) return "emissive-accent";
  return "neutral-surface";
}
