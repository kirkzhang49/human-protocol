import handIronRodOnehandHpBakedUrl from "./models/viewmodel/hand-rod-onehand-v1-hp-baked.glb?url";
import handSidearmOnehandHpBakedUrl from "./models/viewmodel/hand-sidearm-onehand-v1-hp-baked.glb?url";
import { RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS, type RawViewmodelHandGripFamily } from "../render/raw-webgpu/RawViewmodelMode";

export interface RawViewmodelCookAsset {
  modelKey: string;
  url: string;
  role: "hand";
  gripFamily: RawViewmodelHandGripFamily;
  sizeMeters: readonly [number, number, number];
}

export const rawViewmodelCookAssets = {
  [RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.cylindrical]: {
    modelKey: RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.cylindrical,
    url: handIronRodOnehandHpBakedUrl,
    role: "hand",
    gripFamily: "cylindrical",
    sizeMeters: [0.62, 0.72, 0.52],
  },
  [RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.pistol]: {
    modelKey: RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS.pistol,
    url: handSidearmOnehandHpBakedUrl,
    role: "hand",
    gripFamily: "pistol",
    sizeMeters: [0.58, 0.68, 0.5],
  },
} as const satisfies Record<string, RawViewmodelCookAsset>;
