import { Box3, Vector3, type Object3D } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { EnemyState } from "../game/entities/EnemyState";
import { enemyArchetypes } from "../game/config/enemyArchetypes";
import { enemyVisualProfiles } from "../game/visual/VisualProfile";
import { enemyRobotModelFiles } from "./enemyRobotModelFiles";

export type EnemyModelKey = keyof typeof enemyModelAssets;

interface EnemyModelAsset {
  modelKey: string;
  url: string;
  runtimePreload: true;
  warmupTargetHeight: number;
}

interface LoadedEnemyModel {
  scene: Object3D;
  animations: GLTF["animations"];
  bounds: {
    min: Vector3;
    center: Vector3;
    size: Vector3;
  };
}

export const enemyModelAssets = {
  hp_enemy_repair_drone_horror: {
    modelKey: "hp_enemy_repair_drone_horror",
    url: enemyRobotModelFiles.hp_enemy_repair_drone_horror,
    runtimePreload: true,
    warmupTargetHeight: 1.32,
  },
  hp_enemy_clamp_repair_horror: {
    modelKey: "hp_enemy_clamp_repair_horror",
    url: enemyRobotModelFiles.hp_enemy_clamp_repair_horror,
    runtimePreload: true,
    warmupTargetHeight: 1.42,
  },
  hp_enemy_shield_technician_horror: {
    modelKey: "hp_enemy_shield_technician_horror",
    url: enemyRobotModelFiles.hp_enemy_shield_technician_horror,
    runtimePreload: true,
    warmupTargetHeight: 1.62,
  },
  hp_enemy_custodian_foreman_horror: {
    modelKey: "hp_enemy_custodian_foreman_horror",
    url: enemyRobotModelFiles.hp_enemy_custodian_foreman_horror,
    runtimePreload: true,
    warmupTargetHeight: 2.65,
  },
  hp_enemy_reclamation_mother_final_horror: {
    modelKey: "hp_enemy_reclamation_mother_final_horror",
    url: enemyRobotModelFiles.hp_enemy_reclamation_mother_final_horror,
    runtimePreload: true,
    warmupTargetHeight: 3.05,
  },
} as const satisfies Record<string, EnemyModelAsset>;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const loadedModels = new Map<EnemyModelKey, LoadedEnemyModel>();
let preloadPromise: Promise<void> | null = null;

export function requiredEnemyModelCount() {
  return Object.keys(enemyModelAssets).length;
}

export function getLoadedEnemyModel(modelKey: EnemyModelKey) {
  const model = loadedModels.get(modelKey);
  if (!model) {
    throw new Error(`Required enemy model "${modelKey}" has not finished loading.`);
  }
  return model;
}

export function preloadEnemyModelAssets(onProgress?: (loaded: number, total: number) => void) {
  if (preloadPromise) return preloadPromise;

  const entries = Object.entries(enemyModelAssets) as [EnemyModelKey, EnemyModelAsset][];
  let loaded = 0;
  const tick = () => {
    loaded += 1;
    onProgress?.(loaded, entries.length);
  };

  preloadPromise = Promise.all(
    entries.map(async ([modelKey, asset]) => {
      const gltf = await loadGltf(asset.url);
      loadedModels.set(modelKey, { scene: gltf.scene, animations: gltf.animations, bounds: computeBounds(gltf.scene) });
      tick();
    }),
  ).then(() => undefined);

  return preloadPromise;
}

export function modelKeyForEnemy(enemy: EnemyState): EnemyModelKey | null {
  if (enemy.archetypeId === "signal_turret") return null;
  if (enemy.modelKey && isEnemyModelKey(enemy.modelKey)) return enemy.modelKey;
  if (enemy.tier === "boss" && enemy.textureAtlasKey === "custodian_boss") return "hp_enemy_reclamation_mother_final_horror";
  const archetype = enemyArchetypes[enemy.archetypeId];
  const visualModelKey = enemyVisualProfiles[archetype.visualKey]?.modelKey;
  if (visualModelKey && isEnemyModelKey(visualModelKey)) return visualModelKey;
  if (enemy.archetypeId === "repair_drone") return "hp_enemy_repair_drone_horror";
  if (enemy.archetypeId === "clamp_bot") return "hp_enemy_clamp_repair_horror";
  if (enemy.archetypeId === "shield_tech") return "hp_enemy_shield_technician_horror";
  if (enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss") {
    return "hp_enemy_custodian_foreman_horror";
  }
  return "hp_enemy_clamp_repair_horror";
}

export function isEnemyModelKey(modelKey: string): modelKey is EnemyModelKey {
  return Object.prototype.hasOwnProperty.call(enemyModelAssets, modelKey);
}

function computeBounds(scene: Object3D): LoadedEnemyModel["bounds"] {
  const box = new Box3().setFromObject(scene);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  return {
    min: box.min.clone(),
    center,
    size,
  };
}

function loadGltf(url: string) {
  return new Promise<GLTF>((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}
