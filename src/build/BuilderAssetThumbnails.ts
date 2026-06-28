/**
 * Real rendered thumbnails for catalog assets, keyed by modelKey.
 *
 * Images are deterministic GLB studio renders (webp, transparent background)
 * produced by scripts/asset-build/generate-builder-asset-thumbnails.mjs and
 * stored under src/assets/thumbnails/builder/<pack-dir>/<modelKey>.webp.
 * SVG footprint thumbnails (BuilderAssetFootprints) remain as fallback for
 * keys without a render — never the primary visual for desirable assets.
 */

const thumbnailModules = import.meta.glob(["../assets/thumbnails/builder/**/*.webp", "../assets/gui/level04-story-paintings/*.png"], {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const thumbnailsByModelKey = new Map<string, string>();
for (const [filePath, url] of Object.entries(thumbnailModules)) {
  const match = /\/([a-z][a-z0-9_]*)\.(?:webp|png)$/.exec(filePath);
  if (match) thumbnailsByModelKey.set(match[1], url);
}

/** Rendered thumbnail URL for a catalog modelKey, or null (caller falls back to SVG). */
export function assetThumbnailUrl(modelKey: string): string | null {
  return thumbnailsByModelKey.get(modelKey) ?? null;
}

export function assetThumbnailCount() {
  return thumbnailsByModelKey.size;
}

export const assetThumbnailModelKeys: readonly string[] = [...thumbnailsByModelKey.keys()];
