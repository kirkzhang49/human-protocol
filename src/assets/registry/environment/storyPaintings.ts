import type { EnvironmentModelRegistry } from "./types";

// L4 Image2 story paintings are procedural picture-frame surfaces, not GLB
// environment models. Keeping this registry empty prevents preload/fallback
// paths from showing the old museum wall-art placeholder behind the real image.
export const storyPaintingEnvironmentModelAssets = {} as const satisfies EnvironmentModelRegistry;
