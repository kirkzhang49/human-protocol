import type {
  AgeAssetBundleDescriptor,
  AgeGeometryAssetDescriptor,
  AgeTextureDescriptor,
} from "../contracts/AgeAssetContracts";

export class AgeAssetRegistry {
  private readonly bundles = new Map<string, AgeAssetBundleDescriptor>();

  registerBundle(bundle: AgeAssetBundleDescriptor) {
    if (this.bundles.has(bundle.id)) {
      throw new Error(`AgeAssetRegistry already contains bundle "${bundle.id}".`);
    }
    this.bundles.set(bundle.id, bundle);
    return bundle;
  }

  upsertBundle(bundle: AgeAssetBundleDescriptor) {
    this.bundles.set(bundle.id, bundle);
    return bundle;
  }

  getBundle(bundleId: string) {
    return this.bundles.get(bundleId) ?? null;
  }

  listBundles() {
    return [...this.bundles.values()];
  }

  resolveGeometry(modelKey: string): AgeGeometryAssetDescriptor | null {
    for (const bundle of this.bundles.values()) {
      const asset = bundle.geometry?.assets.find((candidate) => candidate.modelKey === modelKey);
      if (asset) return asset;
    }
    return null;
  }

  resolveTexture(textureId: string): AgeTextureDescriptor | null {
    for (const bundle of this.bundles.values()) {
      const texture = bundle.textures?.find((candidate) => candidate.id === textureId);
      if (texture) return texture;
    }
    return null;
  }
}
