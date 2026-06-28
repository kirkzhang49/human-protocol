import ironRodAdvancedUrl from "./models/viewmodel/hp_iron_rod_advanced.glb?url";

export type ViewmodelModelKey = keyof typeof viewmodelModelAssets;

export interface ViewmodelModelAsset {
  modelKey: string;
  url: string;
  category: "melee";
  gripProfile: "rod";
  sizeMeters: readonly [number, number, number];
  sockets: readonly string[];
}

export const viewmodelModelAssets = {
  iron_rod_advanced: {
    modelKey: "iron_rod_advanced",
    url: ironRodAdvancedUrl,
    category: "melee",
    gripProfile: "rod",
    sizeMeters: [0.24, 0.24, 2.9],
    sockets: [
      "iron_rod_right_hand_grip_socket",
      "iron_rod_hit_tip_socket",
      "iron_rod_hit_base_socket",
      "iron_rod_trail_mid_socket",
    ],
  },
} as const satisfies Record<string, ViewmodelModelAsset>;

export function getViewmodelModelAsset(modelKey: ViewmodelModelKey) {
  return viewmodelModelAssets[modelKey];
}
