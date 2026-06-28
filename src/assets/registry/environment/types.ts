export interface EnvironmentModelAsset {
  modelKey: string;
  url: string;
  category: "door" | "pickup" | "interaction" | "room";
  sizeMeters: readonly [number, number, number];
}

export type EnvironmentModelRegistry = Record<string, EnvironmentModelAsset>;
