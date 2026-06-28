export function isMuseumWallArtModelKey(modelKey: string | null | undefined): boolean {
  return /^age_museum_wall_art_/i.test(String(modelKey ?? ""));
}

export function isMuseumWallArtOverlayNode(nodeName: string | null | undefined): boolean {
  const name = String(nodeName ?? "").toLowerCase();
  return /^age_museum_wall_art_/.test(name) && name.endsWith("_gallery_white_wall_washer");
}
