/**
 * Human Protocol builder asset-pack contract (hp.builder.assetPack.v1).
 *
 * This is the single handoff boundary between external asset generators
 * (e.g. the Math-First Asset Factory) and the /build editor. An external tool
 * exports a pack folder:
 *
 *   asset-pack/
 *     manifest.json          ← BuilderAssetPackManifest
 *     models/*.glb           ← referenced by entry.glbFile (manifest-relative)
 *     previews/*.png         ← optional, entry.previewFile
 *     reports/*.json         ← optional, tool-specific
 *
 * Ingestion is handled by scripts/asset-build/generate-builder-asset-pack-registry.mjs
 * (--check validates, --emit regenerates the generated registry/catalog/footprint
 * fragments). Runtime code never reads manifest JSON directly — Vite cannot
 * dynamically import arbitrary files, so the bridge emits static TypeScript.
 */

import type { BuilderPropEntry } from "./BuilderAssetCatalog";
import type { FootprintFamily } from "./BuilderAssetFootprints";

export type BuilderPackAssetKind = "furniture" | "roomKit" | "robot" | "clue" | "material";

export type BuilderPackMount = "floor" | "wall" | "ceiling" | "tabletop";

/** Footprint families the 2D blueprint can draw; "generic" is not allowed for ingested furniture. */
export type BuilderPackFootprintFamily = Exclude<FootprintFamily, "generic">;

export interface BuilderAssetPackEntry {
  /** Globally unique runtime model key, e.g. "hp_l4_cineclinic_triage_kiosk". */
  modelKey: string;
  /** Short Chinese display label shown in the /build catalog. */
  label: string;
  assetKind: BuilderPackAssetKind;
  /** Generator family, e.g. "desk" | "cabinet" — for furniture must match BuilderPropFamily. */
  family: string;
  /** Catalog group tab section (must be an existing BuilderPropGroup; defaults to 自动家具). */
  group?: BuilderPropEntry["group"];
  /** Source tool identity, e.g. "auto-rig-3d" | "math-first-asset-factory". */
  source: string;
  /** Stable id of the asset inside the source tool. */
  sourceAssetId: string;
  presetId?: string;
  themeId?: string;
  /** GLB path relative to the manifest file's directory. */
  glbFile: string;
  /** Optional preview image path relative to the manifest file's directory. */
  previewFile?: string;
  /** Bounding size in meters [w, h, d]; must be finite and > 0.05. */
  sizeMeters: readonly [number, number, number];
  /** Solid furniture gets a collision box at compile time. */
  solid?: boolean;
  mount?: BuilderPackMount;
  wallPreferred?: "back" | "none";
  /** Which local Z side is the readable/front face for wall-mounted props. Defaults to +Z. */
  wallMountFace?: BuilderPropEntry["wallMountFace"];
  canHoldSmallProps?: boolean;
  /** Optional authored/baked support surfaces for tabletop placement. */
  supportSurfaces?: BuilderPropEntry["supportSurfaces"];
  /** Optional small-prop stacking behavior. */
  stacking?: BuilderPropEntry["stacking"];
  clueCapacity?: number;
  /** Required for furniture: which 2D silhouette the blueprint draws. */
  footprintFamily?: BuilderPackFootprintFamily;
  /** Optional generator data carried for future runtime support. */
  colliders?: unknown[];
  sockets?: unknown[];
  score?: number;
  scoreBreakdown?: Record<string, number>;
  tags?: string[];
}

export interface BuilderAssetPackManifest {
  schemaVersion: "hp.builder.assetPack.v1";
  /** Stable pack id, e.g. "hp_level04_memory_clinic_furniture_v1". */
  packId: string;
  label: string;
  /** Exporting tool identity. */
  sourceTool: string;
  generatedAt?: string;
  assets: BuilderAssetPackEntry[];
}

export const builderAssetPackSchemaVersion = "hp.builder.assetPack.v1";

/** Index of ingested packs consumed by the --emit generator. */
export interface BuilderIngestedPacksIndex {
  schemaVersion: "hp.builder.ingestedPacks.v1";
  packs: {
    /** Manifest path relative to the game root, posix separators. */
    manifest: string;
    /**
     * "manual": assets are hand-registered (reference pilot); the pack only
     * reserves its modelKeys. "generated": assets are emitted into the
     * generated registry/catalog/footprint fragments.
     */
    ingest: "manual" | "generated";
  }[];
}
