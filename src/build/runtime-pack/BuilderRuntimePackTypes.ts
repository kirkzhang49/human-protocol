import { BUILDER_PLAYTEST_ENGINE_VERSION } from "../../game/config/BuilderPlaytestVersion";
import type { RawRenderPlan } from "../../render/raw-webgpu/RawWebGpuTypes";

/** Base color texture stored with a deep pack (recreated as a blob URL at load). */
export interface BuilderPackTextureBlob {
  /** Texture-array page. Missing means page 0 for legacy packs. */
  page?: number | null;
  layer: number;
  mimeType: string;
  bytes: ArrayBuffer;
  name: string;
}

/** Engine/format revision baked into packs; bump to invalidate old packs. */
// v19: deep cook now emits per-node chunks for pickups so the renderer can skip
// their image2 wrap faces (the black spike). Old v18 packs cached pickups
// without those chunks, so the spike survived the fix — bump forces a re-cook.
// v20: the real spike was that the cooker had NO EXT_meshopt_compression /
// KHR_mesh_quantization support, so it read compressed/fallback bufferView bytes
// as raw quantized values — ~70% of vertex positions came out NaN and exploded
// into the black spike (and BYTE-typed octahedral normals decoded to zero). The
// cooker now decodes meshopt up front (cookGlbModels). v19 packs were cached
// with the NaN geometry, so bump forces a re-cook with correct vertices.
// v21: decimated the over-tessellated CC0/museum prop GLBs (weld+simplify+meshopt,
// scripts/asset-build/decimate-glb.mjs) — props dir 1.59GB → 65MB. The cooked
// WebGPU vertex format is unchanged, just far fewer vertices, so old v20 packs
// (cooked from the fat GLBs, ~41MB/1M verts) must re-cook to shrink. In dev the
// GLB URL doesn't carry a content hash, so the asset-hash alone won't invalidate.
// v22: key items use the procedural gold proxy instead of the deep-cooked key
// GLB (whose color is texture-only → renders white). Bump to re-bake.
// v23: deep cook now reads EXT_texture_webp base-color textures (were dropped →
// ~150 furniture rendered solid white) + per-model cook cache is format-guarded
// (was replaying stale 14-float blobs → white). Bump to re-cook with both fixes.
// v24: (a) textureless cooked materials are now normalized into a readable band —
// near-WHITE factors (albedo lived in a stripped texture → defaulted to ~white,
// e.g. the museum specimen_plinth) get compressed down to a pale-stone ceiling
// (MaterialTable.normalizeTexturelessBaseColor), the mirror of the existing
// near-black lift; (b) the exit/elevator room bakes a flush cyan floor pad + the
// switch_panel button only (the bulky 2.2m elevator-portal frame was removed).
// Both are compile-time changes that don't move assetVersionHash, so the cached
// v23 packs would otherwise keep rendering the white blobs + old portal. Bump.
// v26: exit floor-pad estimatedBounds now match the actual 0.04m flush geometry.
// Missing/late geometry used to proxy as a tall white/red cube in front of the
// elevator. Bump so cached packs drop the stale oversized bounds.
// v27: exit rooms that already have a side-wall button panel no longer bake a
// second center-floor exit pad/panel or floor_glow; cached deep packs would keep
// showing the center button + white/cyan circle, so force one more re-bake.
// v28: painted photo floor/wall/ceiling presets now compile into Raw base-color
// texture layers while official surface kits keep owning shell geometry. Cached
// v27 packs would keep showing only procedural color/pattern fallbacks.
// v29: generated exit elevator prefabs no longer include ceiling strip fixtures
// that read as white half-discs in Raw WebGPU, and the route switch console gets
// explicit cooked material colors/emissive values instead of relying on texture
// upload success. Cached v28 packs would keep the old white fixtures/desaturated
// console, so force a re-bake.
// v30: builder_runtime_resources now owns the native hp_enemy_* robot geometry
// instead of relying on whichever official Raw level happened to load first.
// Cached v29 playtest packs can keep rendering robot proxy cubes, so re-bake.
// v31: service-elevator exit prefab props now have explicit fallback geometry
// and the deep-pack contract requires the real call-buttons/interior-shell GLBs.
// Cached v30 packs can keep the oversized generic white proxy over the buttons.
// v32: playtest URLs now pin the exact generated packId and rebake cleanup
// deletes stale records by levelId as well as projectId. Cached v31 packs can
// otherwise survive localStorage clearing and make normal browser profiles show
// old exit/official-import visuals while incognito shows the fresh bake.
// v33: official-import playtest packs inherit official Raw lighting tuning and
// Level 3's editable museum surfaces now point at the same Image2 shell skins
// as the official Raw plan. Cached v32 packs can keep the old white marble /
// limestone surfaces and generic flatter lighting.
// v34: builder gameplay compilation changed for generated Level 2/remake flows:
// finite survive-wave doors, puzzle-gated elevator routing, boss room triggers,
// and generated objective/key semantics can all change without the builder JSON
// changing. Because this version participates in builderProjectHash, bumping it
// prevents old v33 deep packs/config launches from hiding the new gameplay.
// v35: Level 2 survive-wave doors auto-open after clear, and cached official
// imports refresh their door/wave robots so stale normal profiles cannot hide
// the care-room boss.
// v36: edited official imports let builder-authored wave gates own door locks,
// generated objectives, and wave-chain events; old deep packs can contain stale
// source progression and must be regenerated.
// v37: builder waves now carry room ownership, generated/source presentation is
// merged, and official-entry waves bridge into builder wave 1 without exposing
// raw ids. Cached v36 deep packs can keep the stale trigger chain.
// v38: official/source waves imported into /build preserve interruptsActiveWave,
// so door-after-pressure rooms can still spawn their curator/manager host waves.
// Cached v37 packs can keep those source waves stuck behind pressure loops.
// v39: builder pressure-loop waves are nonBlocking background pressure, so later
// room/script/boss waves can start without needing their own interrupt flag.
// v40: Level 1 reference decals use texture-faithful neutral materials, softer
// local fill lights, and non-mirrored two-sided UVs. Cached v39 packs can keep
// the washed-out glowing triptych and reversed text in /build deep playtests.
// v41: Level 1 reference decals flip V into WebGPU image space and their local
// fill is reduced again to match the darker gray maintenance profile.
// v42: deep and official builder-runtime packs now prefer prebuilt native
// Raw/WebGPU geometry for all indexed runtime model kinds, not just enemies.
// Cached v41 packs can keep browser-cooked furniture/pickups that render as
// pale blobs or white circles.
// v43: service-elevator exit rooms use the regenerated one-piece stage, darker
// GLB-authored floor/button materials, and shared exit-room Raw lighting rules.
// Cached v42 packs can keep the old elevator room, missing floor treatment, or
// proxy robot geometry in normal browser profiles while incognito looks correct.
// v44: official builder runtime packs consume map lighting presets and preset
// lights instead of stacking generic builder room lights; exit-room surface keys
// no longer inherit stale museum sourceRoom shells.
// v45: builder runtime packs mark their explicit surface bridge and visibility
// scenarios no longer pre-render closed neighboring rooms; Level 3 hub playtests
// must not reuse v44 packs that show stale rooms through dark museum walls.
// v46: procedural no-lock closed doors bake as full closed leaves instead of
// narrow side panels, so L3 entry/hub walls no longer read as open/transparent.
// v47: official L3 builder surfaces get low-strength readability fill and
// subdued detail strips so the Raw view shows opaque walls instead of bright
// floating linework over a black shell.
// v48: official L3 builder surfaces keep the authored floor/wall/ceiling
// texture shells but suppress procedural grid/seam/top-strip overlays; the
// museum lighting guard also reduces black crush so walls read as solid.
// v49: official L3 procedural door kits use the same quiet readability pass so
// closed entry/gallery doors do not reintroduce floating cyan/trim linework.
// v50: native Raw bundle libraries prune unused material/base-color texture
// layers before merging; L3 official builder packs must stay below WebGPU's
// common 256 material-texture-layer limit instead of falling back to Three.js.
// v51: runtime packs paginate base-color/material texture arrays into fixed
// 5-page budgets (240 layers per page) and fail build-time when unique texture
// usage exceeds the WebGPU-safe budget instead of falling back at runtime.
// v52: texture pagination allocates combat-critical resources first
// (enemy/robot, viewmodel/weapon, pickup/key), pushing large-room decoration
// to later pages instead of starving player-facing assets.
// v53: Raw GLB node mapping resolves repeated mesh instances by world
// transform so cooked enemy parts do not inherit stale rigid nodes.
// v54: shield technician and boss Raw sources use authored enemy GLBs, and
// their animation bridge keeps the authored hierarchy unmodified.
// v55: complex authored shield/boss rigs use static Raw geometry while the
// rigid-node animation palette is rebuilt for GLTF-level fidelity.
// v56: route-switch access keys reuse the ordinary key GLB at a smaller scale
// instead of the memory-chip cluster.
// v57: restore authored shield/boss Raw animation playback instead of the
// static P0 bypass.
// v58: enemy GLB URLs are centralized and Level 2/3 use the same cooked robot
// files instead of mixing cooked Level 2 robots with authored Level 3 rigs.
// v59: wall door switches are no longer classified as route-switch consoles;
// standalone interaction GLBs now bake through their own modelKey.
// v60: builder room-entry prelude waves compile ahead of authored wave-chain
// wave 1 instead of letting both room_entered waves spawn together.
// v61: Image2 story paintings no longer register or preload the legacy museum
// wall-art GLB; cached packs must rebake to get the procedural textured frame.
// v62: procedural Image2 story paintings persist their external PNG art into
// local runtime-pack texture blobs so Raw playtests do not reload as empty gray
// frames when the original dev URL is stale or unavailable.
// v63: story-painting runtime geometry reads the shared Image2 art dimensions
// instead of the old rectangular placeholder, invalidating wrong-sized frames.
// v64: Level 4 Image2 story paintings hang slightly lower in generated playtests.
// v65: procedural Image2 story paintings are excluded from native Raw merging so
// stale same-key Raw assets cannot override their textured runtime geometry.
// v66: wall-mounted story paintings auto-align their +Z art face toward the room
// and procedural Image2 frames no longer bake an extra translucent glass sheet.
// v67: wall-mounted props can declare a -Z front face and compile with
// depth-based wall inset, invalidating deep packs that baked flipped panels.
// v68: builder wave-chain compilation separates source-backed official wave
// echoes from builder-authored waves, invalidating packs that could duplicate
// boss/wave-1 spawns in normal browser profiles while incognito looked fresh.
// v69: route output orb shells and route console glass now compile through the
// native Raw transparent material path, invalidating cached opaque/near-invisible
// route glass packs.
export const BUILDER_RUNTIME_PACK_ENGINE_VERSION = BUILDER_PLAYTEST_ENGINE_VERSION;

export type BuilderRuntimePackBakeMode = "proxy" | "cooked-glb";
export type BuilderRuntimeWgpuResourceStatus = "native-raw" | "cooked-glb" | "proxy" | "missing";

export interface BuilderRuntimeWgpuResourceEntry {
  modelKey: string;
  kind: string;
  roles: string[];
  status: BuilderRuntimeWgpuResourceStatus;
  geometryModelKey: string | null;
  sourceLevelId?: string;
  reason?: string;
}

export interface BuilderRuntimePackManifest {
  schemaVersion: typeof BUILDER_RUNTIME_PACK_ENGINE_VERSION;
  levelId: string;
  title: string;
  bakeMode: BuilderRuntimePackBakeMode;
  counts: {
    rooms: number;
    walls: number;
    doors: number;
    props: number;
    markers: number;
    robots: number;
    materials: number;
    lights: number;
    instances: number;
    vertices: number;
    triangles: number;
  };
  /** Deep-bake diagnostics; empty/zero for proxy packs. */
  cookedModels: string[];
  /** Models whose base color textures fell back to approximate tints. */
  textureFallbackModels: string[];
  /** Native Raw WebGPU modelKeys copied from official baked geometry. */
  nativeRawModels: string[];
  /** Native Raw robot modelKeys copied from official baked geometry. */
  nativeRawEnemyModels: string[];
  /** Native Raw furniture modelKeys copied from official baked geometry. */
  nativeRawFurnitureModels: string[];
  /** Canonical modelKey -> WGPU geometry mapping for builder runtime assets. */
  wgpuResources: BuilderRuntimeWgpuResourceEntry[];
  cookedMaterials: number;
  transparentMaterials: number;
  missingModels: { modelKey: string; reason: string }[];
  fallbackProxyModels: string[];
  bakeDurationMs: number;
  geometryBytes: number;
  textureBytes: number;
  assetVersionHash: string;
  /** Robots: "bridge" = official skeletal animation bridge, "static" = cooked pose. */
  enemyAnimationMode: "static" | "bridge";
  enemyAnimationFallbackReason?: string;
}

/** Full record persisted in IndexedDB (one row per generated pack). */
export interface BuilderRuntimePackRecord {
  packId: string;
  projectId: string;
  projectHash: string;
  builderSnapshotId?: string;
  configHash?: string;
  runtimeResourceHash?: string;
  engineVersion: string;
  levelId: string;
  createdAt: number;
  updatedAt: number;
  manifest: BuilderRuntimePackManifest;
  renderPlan: RawRenderPlan;
  geometryBuffer: ArrayBuffer;
  textureBlobs?: BuilderPackTextureBlob[];
  thumbnailDataUrl?: string;
  diagnostics: string[];
  sizeBytes: number;
}

/** Lightweight pointer kept in localStorage (never holds binary data). */
export interface BuilderRuntimePackPointer {
  packId: string;
  projectId: string;
  projectHash: string;
  builderSnapshotId?: string;
  configHash?: string;
  runtimeResourceHash?: string;
  engineVersion: string;
  levelId: string;
  updatedAt: number;
  sizeBytes: number;
}
