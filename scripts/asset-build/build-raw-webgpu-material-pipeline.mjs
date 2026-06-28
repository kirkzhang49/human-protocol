import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(scriptPath), "../..");
const levelId = readArg("--level") ?? "level_03_human_museum";
const textureSize = clampInteger(Number.parseInt(readArg("--size") ?? process.env.HP_RAW_MATERIAL_PIPELINE_SIZE ?? "256", 10), 64, 512);
const minimumPortableTextureArrayLayers = 256;
const safeMaterialTextureLayerBudget = 224;
const manifestDir = path.join(gameRoot, "src/assets/manifests/generated/raw-webgpu");
const renderPlanPath = path.join(manifestDir, `render_plan_${levelId}.json`);
const outputPath = path.join(manifestDir, `raw_material_pipeline_${levelId}.json`);
const publicBase = `/assets/human-protocol/raw-webgpu/${levelId}/material-pipeline`;
const outputDir = path.join(gameRoot, "public", publicBase.replace(/^\//, ""));
// Shared PBR library (src-only, not served from public/). High-confidence materials are routed
// to ONE stable published URL per key+slot so the render-plan compiler's URL dedup collapses
// many per-material synthetic textures into a single shared layer.
const sharedPbrSourceDir = path.join(gameRoot, "src/assets/textures/environment/shared-pbr");
const sharedPbrPublicBase = `${publicBase}/shared`;
const sharedPbrOutputDir = path.join(gameRoot, "public", sharedPbrPublicBase.replace(/^\//, ""));
const sharedPbrPublishCache = new Map();

const sharp = await import("sharp").then((module) => module.default ?? module);

if (!fsSync.existsSync(renderPlanPath)) {
  throw new Error(`Missing render plan ${path.relative(gameRoot, renderPlanPath)}. Run npm run compile:raw-webgpu-plan first.`);
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const plan = JSON.parse(await fs.readFile(renderPlanPath, "utf8"));
const assetMaterialFacts = await collectAssetMaterialFacts(plan);
const assetFactsByMaterialName = groupAssetFactsByMaterialName(assetMaterialFacts);
const supplements = [];
const materials = [];
const supplementalTextureCache = new Map();
const summary = {
  totalMaterials: 0,
  generatedSlots: 0,
  existingSlots: 0,
  sharedPbrSlots: 0,
  generatedTextures: 0,
  glassMaterials: 0,
  transparentCandidates: 0,
  roleCounts: {},
};

for (const material of plan.geometry?.materials ?? []) {
  if (material.category === "builtin") continue;
  summary.totalMaterials += 1;
  summary.roleCounts[material.visualRole ?? "default"] = (summary.roleCounts[material.visualRole ?? "default"] ?? 0) + 1;
  if (material.visualRole === "glass_shell") summary.glassMaterials += 1;
  if (material.alphaMode === "BLEND" || (material.baseColorFactor?.[3] ?? 1) < 0.92 || material.visualRole === "glass_shell") {
    summary.transparentCandidates += 1;
  }

  const pipelineId = materialPipelineId(material);
  const existingSlots = materialSlotsBySemantic(material);
  const rolePolicy = roleMaterialPolicy(material);
  const slots = {};
  const generatedForMaterial = [];

  for (const semantic of ["baseColor", "normal", "metallicRoughness", "ao", "emissive"]) {
    const existing = existingSlots.get(semantic);
    if (existing?.url && !isSelfGeneratedMaterialPipelineSlot(existing)) {
      summary.existingSlots += 1;
      slots[semantic] = normalizeExistingSlot(existing);
      continue;
    }

    if (!shouldGenerateSlot(semantic, material, rolePolicy)) {
      slots[semantic] = { present: false, generated: false, reason: "not-needed-for-role" };
      continue;
    }

    // Shared-PBR-first routing (conservative): for materials whose name/role map confidently to a
    // shared-pbr key, bind normal/metallicRoughness to that key's single published URL instead of
    // emitting a per-material synthetic texture. The compiler dedups material textures by
    // semantic:colorSpace:url, so every routed material collapses onto one shared layer per
    // key+slot. AO is intentionally dropped (the ORM R-channel already carries AO), mirroring the
    // builder-resource precedent. baseColor and emissive are never routed (baseColor is never
    // generated here; emissive uses emissiveFactor, not a shared texture).
    const sharedPbrKey = sharedPbrKeyFor(material);
    if (sharedPbrKey) {
      const sharedSlot = await resolveSharedPbrSlot(sharedPbrKey, semantic);
      if (sharedSlot) {
        slots[semantic] = sharedSlot;
        if (sharedSlot.present) summary.sharedPbrSlots = (summary.sharedPbrSlots ?? 0) + 1;
        continue;
      }
    }

    const generated = await generateSupplementalTexture({ material, semantic, pipelineId, rolePolicy });
    slots[semantic] = generated;
    generatedForMaterial.push(generated);
    summary.generatedSlots += 1;
    if (!generated.reused) {
      supplements.push({
        materialId: pipelineId,
        materialName: material.name,
        category: material.category,
        visualRole: material.visualRole,
        ...generated,
      });
      summary.generatedTextures += 1;
    }
  }

  materials.push({
    materialId: pipelineId,
    sourceMaterialId: material.id,
    index: material.index,
    name: material.name,
    category: material.category,
    visualRole: material.visualRole ?? "default",
    materialKind: material.materialKind ?? 0,
    alphaMode: material.alphaMode ?? "OPAQUE",
    doubleSided: material.doubleSided !== false,
    baseColorFactor: material.baseColorFactor ?? [1, 1, 1, 1],
    emissiveFactor: material.emissiveFactor ?? [0, 0, 0],
    emissiveStrength: material.emissiveStrength ?? 0,
    roughnessFactor: material.roughnessFactor ?? 0.72,
    metallicFactor: material.metallicFactor ?? 0,
    aoStrength: material.aoStrength ?? 1,
    semanticParams: material.semanticParams ?? null,
    paletteColorFactor: material.paletteColorFactor ?? null,
    rolePolicy,
    assets: assetFactsByMaterialName.get(material.name)?.slice(0, 16) ?? [],
    slots,
    completeness: {
      baseColor: Boolean(slots.baseColor?.present),
      normal: Boolean(slots.normal?.present),
      metallicRoughness: Boolean(slots.metallicRoughness?.present),
      ao: Boolean(slots.ao?.present),
      emissive: Boolean(slots.emissive?.present),
      generatedSlotCount: generatedForMaterial.length,
    },
  });
}

summary.textureLayerBudget = estimateTextureLayerBudget(materials);
if (summary.textureLayerBudget.materialTextureLayerCount > summary.textureLayerBudget.safeMaterialTextureLayerBudget) {
  console.warn(
    `[HumanProtocol] Raw material texture budget warning: ${summary.textureLayerBudget.materialTextureLayerCount}/` +
      `${summary.textureLayerBudget.safeMaterialTextureLayerBudget} material texture array layers. Reduce generated variants before adding more assets.`,
  );
}

const manifest = {
  schemaVersion: "hp.raw-webgpu.material-pipeline.v1",
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/asset-build/build-raw-webgpu-material-pipeline.mjs",
  levelId,
  sourcePlan: path.relative(gameRoot, renderPlanPath),
  textureSize,
  publicBase,
  purpose:
    "Unified raw WebGPU material facts and supplemental material texture stack. Compiler consumes this manifest to complete normal/ORM/AO/emissive channels when source GLBs omit them.",
  summary,
  assets: assetMaterialFacts,
  supplements,
  materials,
};

await fs.mkdir(manifestDir, { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`PASS raw WebGPU material pipeline level=${levelId}`);
console.log(`  output=${path.relative(gameRoot, outputPath)}`);
console.log(`  textures=${summary.generatedTextures} materials=${summary.totalMaterials} size=${textureSize}`);
console.log(`  glassMaterials=${summary.glassMaterials} transparentCandidates=${summary.transparentCandidates}`);
console.log(
  `  materialTextureLayers=${summary.textureLayerBudget.materialTextureLayerCount}/${summary.textureLayerBudget.safeMaterialTextureLayerBudget} ` +
    `baseColorLayers=${summary.textureLayerBudget.baseColorTextureLayerCount}`,
);

async function collectAssetMaterialFacts(renderPlan) {
  const facts = [];
  for (const asset of renderPlan.geometry?.assets ?? []) {
    if (asset.status !== "ready" || !asset.rawFile) continue;
    const filePath = path.join(gameRoot, asset.rawFile);
    const container = await readGlbContainer(filePath);
    const materials = [];
    const json = container?.json;
    for (let index = 0; index < (json?.materials?.length ?? 0); index += 1) {
      const material = json.materials[index];
      materials.push({
        index,
        name: material?.name ?? `material_${index}`,
        alphaMode: material?.alphaMode ?? null,
        doubleSided: Boolean(material?.doubleSided),
        textures: glbTextureFacts(material, json),
      });
    }
    facts.push({
      modelKey: asset.modelKey,
      rawFile: asset.rawFile,
      sourceFile: asset.sourceFile ?? null,
      vertexCount: asset.vertexCount ?? 0,
      triangleCount: asset.triangleCount ?? 0,
      materialCount: materials.length,
      materials,
    });
  }
  return facts;
}

function groupAssetFactsByMaterialName(assetFacts) {
  const result = new Map();
  for (const asset of assetFacts) {
    for (const material of asset.materials) {
      const list = result.get(material.name) ?? [];
      list.push({
        modelKey: asset.modelKey,
        rawFile: asset.rawFile,
        materialIndex: material.index,
        triangleCount: asset.triangleCount,
      });
      result.set(material.name, list);
    }
  }
  return result;
}

function glbTextureFacts(material, json) {
  const facts = {};
  const entries = [
    ["baseColor", material?.pbrMetallicRoughness?.baseColorTexture?.index],
    ["normal", material?.normalTexture?.index],
    ["metallicRoughness", material?.pbrMetallicRoughness?.metallicRoughnessTexture?.index],
    ["ao", material?.occlusionTexture?.index],
    ["emissive", material?.emissiveTexture?.index],
  ];
  for (const [semantic, textureIndex] of entries) {
    if (!Number.isInteger(textureIndex)) {
      facts[semantic] = { present: false };
      continue;
    }
    const texture = json.textures?.[textureIndex];
    const imageIndex = textureSourceImageIndex(texture, textureIndex, json);
    const image = Number.isInteger(imageIndex) ? json.images?.[imageIndex] : null;
    facts[semantic] = {
      present: true,
      textureIndex,
      imageIndex,
      textureName: texture?.name ?? null,
      imageName: image?.name ?? null,
      mimeType: image?.mimeType ?? null,
      uri: image?.uri ?? null,
    };
  }
  return facts;
}

async function readGlbContainer(filePath) {
  const buffer = await fs.readFile(filePath);
  if (buffer.readUInt32LE(0) !== 0x46546c67) return null;
  let offset = 12;
  let json = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
    offset += length;
  }
  return json ? { json } : null;
}

function textureSourceImageIndex(texture, textureIndex, json) {
  if (Number.isInteger(texture?.source)) return texture.source;
  const webpSource = texture?.extensions?.EXT_texture_webp?.source;
  if (Number.isInteger(webpSource)) return webpSource;
  const basisSource = texture?.extensions?.KHR_texture_basisu?.source;
  if (Number.isInteger(basisSource)) return basisSource;
  return Number.isInteger(textureIndex) && json.images?.[textureIndex] ? textureIndex : null;
}

function materialSlotsBySemantic(material) {
  const result = new Map();
  for (const slot of material.textures ?? []) {
    result.set(slot.semantic, slot);
  }
  return result;
}

function isSelfGeneratedMaterialPipelineSlot(slot) {
  return Boolean(slot?.generated) || String(slot?.sourceFile ?? "").includes("/material-pipeline/");
}

function normalizeExistingSlot(slot) {
  return {
    semantic: slot.semantic,
    present: true,
    generated: false,
    colorSpace: slot.colorSpace ?? (slot.semantic === "baseColor" || slot.semantic === "emissive" ? "srgb" : "linear"),
    url: slot.url ?? null,
    sourceFile: slot.sourceFile ?? null,
    mimeType: slot.mimeType ?? null,
    stats: slot.stats ?? null,
  };
}

function estimateTextureLayerBudget(manifestMaterials) {
  const baseColorUrls = new Set();
  const materialUrls = new Set();
  for (const material of manifestMaterials) {
    for (const [semantic, slot] of Object.entries(material.slots ?? {})) {
      if (!slot?.present || !slot?.url) continue;
      if (semantic === "baseColor") {
        baseColorUrls.add(slot.url);
      } else {
        materialUrls.add(`${semantic}:${slot.url}`);
      }
    }
  }
  return {
    minimumPortableTextureArrayLayers,
    safeMaterialTextureLayerBudget,
    reservedFallbackLayer: 1,
    baseColorTextureLayerCount: baseColorUrls.size + 1,
    materialTextureLayerCount: materialUrls.size + 1,
    generatedTextureCount: supplementalTextureCache.size,
    note:
      "WebGPU devices commonly guarantee at least 256 2D-array layers. Raw material textures keep a margin so future furniture and robot variants do not create invalid bind groups.",
  };
}

function shouldGenerateSlot(semantic, material, policy) {
  if (material.category === "builtin") return false;
  if (semantic === "baseColor") return false;
  if (semantic === "emissive") return material.visualRole !== "glass_shell" && policy.emissiveStrength > 0.035;
  if (semantic === "normal") return policy.normalStrength > 0.012;
  // Keep AO texture layers for source GLBs that already authored them, but do
  // not synthesize new AO maps. Level 3 already uses room/light/grounding AO,
  // and generated AO variants pushed portable WebGPU texture arrays past 256.
  if (semantic === "ao") return false;
  return true;
}

// Conservative material.name/visualRole -> shared-pbr key classifier. Name substrings drive the
// decision (more reliable than role alone), with role used only as a guard for ambiguous metal/
// glass/gold buckets. Returns null for anything emissive, screen/label, art/wrap, decal/overlay,
// gameplay-coded, or otherwise uncertain so it falls back to the procedural generator. The rule of
// thumb: never paint a metal key onto a non-metal surface (or vice versa); when in doubt, return
// null (keep generating) rather than risk a visual regression.
function sharedPbrKeyFor(material) {
  const name = String(material?.name ?? "").toLowerCase();
  const role = material?.visualRole ?? "default";

  // Hard blocklist: emissive/light/screen/art/wrap/decal/gameplay/soft-detail materials must never
  // be routed to a solid-surface PBR set. baseColor (art) is untouched anyway, but their
  // normal/ORM carry intentional procedural detail or are near-flat overlays.
  const blocked = [
    "light", "glow", "lamp", "emissive", "screen", "waveform", "vitals", "art", "wrap",
    "label", "shadow", "dust", "grime", "wash_warm", "soft_gallery", "warm_panel", "amber",
    "core", "energy", "medkit", "key_wrap", "protocol_diagram", "robot_worker", "human_origin",
    "last_human", "voice", "champagne", "edge_wear", "trim_light", "rust_patina", "rubber",
    "plastic", "contact", "joint",
  ];
  if (blocked.some((token) => name.includes(token))) return null;

  // Frosted glass cases/shells (surface only; emissive + alpha stay on the generator).
  if (role === "glass_shell" && name.includes("glass")) return "pbr_glass_frosted";

  // Solid brass/gold trim and holders (aged is the safer, more common look in L03).
  if (role === "route_gold" && (name.includes("brass") || name.includes("gold"))) return "pbr_brass_aged";

  // Wood (drawers, walnut, generic wood) — highest priority so structural_dark wood still routes wood.
  if (name.includes("wood") || name.includes("walnut") || name.includes("drawer")) return "pbr_wood_walnut";

  // Marble figures/surfaces.
  if (name.includes("marble")) return "pbr_white_marble";


  // Dark brushed steel / gunmetal structural surfaces (role-guarded to the dark-structure bucket).
  if (
    role === "structural_dark" &&
    (name.includes("steel") ||
      name.includes("metal") ||
      name.includes("gunmetal") ||
      name.includes("titanium") ||
      name.includes("graphite") ||
      name.includes("iron"))
  ) {
    return "pbr_steel_brushed";
  }

  // Stone / concrete plinths, slabs, walls. Dark stone reads better as dark marble.
  if (name.includes("stone") || name.includes("concrete") || name.includes("slab") || name.includes("plinth")) {
    if (name.includes("dark") || name.includes("black") || name.includes("deep")) return "pbr_dark_marble";
    return "pbr_stone_concrete";
  }

  return null;
}

// Maps a shared-pbr key + render semantic to its published file slot. Only normal and
// metallicRoughness are served from the shared library (ORM file = R:AO/G:rough/B:metal, exactly
// the glTF metallicRoughness layout). AO is dropped (carried by the ORM R channel) so it collapses
// out of the layer count. baseColor/emissive are never routed here.
async function resolveSharedPbrSlot(key, semantic) {
  if (semantic === "normal") {
    const url = await publishSharedPbrMap(key, "normal");
    if (!url) return null;
    return sharedPbrSlot(semantic, key, "normal", url, "linear");
  }
  if (semantic === "metallicRoughness") {
    const url = await publishSharedPbrMap(key, "orm");
    if (!url) return null;
    return sharedPbrSlot(semantic, key, "orm", url, "linear");
  }
  if (semantic === "ao") {
    // Dropped: the ORM R-channel already carries AO (matches the builder-resource precedent and
    // keeps the routed materials from adding a separate AO layer).
    return { present: false, generated: false, shared: true, sharedKey: key, reason: "ao-folded-into-orm" };
  }
  return null;
}

function sharedPbrSlot(semantic, key, slot, url, colorSpace) {
  return {
    semantic,
    present: true,
    generated: false,
    shared: true,
    sharedKey: key,
    sharedSlot: slot,
    colorSpace,
    url,
    sourceFile: path.relative(gameRoot, path.join(sharedPbrOutputDir, sharedPbrFileName(key, slot))),
    mimeType: "image/png",
    stats: null,
  };
}

function sharedPbrFileName(key, slot) {
  return `${key}_${slot}.png`;
}

// Lazily copies a shared-pbr source PNG into the level's public material-pipeline/shared dir,
// returning ONE stable URL per key+slot (so all routed materials reference the same URL and the
// compiler collapses them to a single layer). Re-encoded through sharp to a deterministic PNG.
// Returns null if the source file is missing (caller then falls back to the generator).
async function publishSharedPbrMap(key, slot) {
  const cacheKey = `${key}:${slot}`;
  if (sharedPbrPublishCache.has(cacheKey)) return sharedPbrPublishCache.get(cacheKey);

  const sourceFile = path.join(sharedPbrSourceDir, sharedPbrFileName(key, slot));
  if (!fsSync.existsSync(sourceFile)) {
    console.warn(`[HumanProtocol] Shared-PBR source missing, falling back to generator: ${path.relative(gameRoot, sourceFile)}`);
    sharedPbrPublishCache.set(cacheKey, null);
    return null;
  }

  await fs.mkdir(sharedPbrOutputDir, { recursive: true });
  const fileName = sharedPbrFileName(key, slot);
  const outputFile = path.join(sharedPbrOutputDir, fileName);
  await sharp(sourceFile).png({ compressionLevel: 9 }).toFile(outputFile);
  const url = `${sharedPbrPublicBase}/${fileName}`;
  sharedPbrPublishCache.set(cacheKey, url);
  return url;
}

async function generateSupplementalTexture({ material, semantic, pipelineId, rolePolicy }) {
  const cacheKey = supplementalTextureCacheKey(material, semantic, rolePolicy);
  const cached = supplementalTextureCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      reused: true,
    };
  }

  const pixels = new Uint8Array(textureSize * textureSize * 4);
  const seed = hashNumber(cacheKey);
  const colorSpace = semantic === "emissive" ? "srgb" : "linear";
  const statsSamples = [];

  if (semantic === "normal") {
    const height = createHeightField(material, rolePolicy, seed);
    writeNormalMap(pixels, height, rolePolicy.normalStrength);
  } else {
    for (let y = 0; y < textureSize; y += 1) {
      for (let x = 0; x < textureSize; x += 1) {
        const u = (x + 0.5) / textureSize;
        const v = (y + 0.5) / textureSize;
        const index = (y * textureSize + x) * 4;
        const shade = proceduralSurfaceValue(u, v, seed, material.visualRole, material.name);
        if (semantic === "metallicRoughness") {
          const roughness = clamp01(rolePolicy.roughness + (shade - 0.5) * rolePolicy.roughnessVariance);
          const metallic = clamp01(rolePolicy.metallic + (shade - 0.5) * rolePolicy.metallicVariance);
          pixels[index] = Math.round(255 * rolePolicy.aoBase);
          pixels[index + 1] = Math.round(255 * roughness);
          pixels[index + 2] = Math.round(255 * metallic);
          pixels[index + 3] = 255;
          statsSamples.push(roughness);
        } else if (semantic === "ao") {
          const ao = clamp01(rolePolicy.aoBase - shade * rolePolicy.aoContrast);
          pixels[index] = Math.round(255 * ao);
          pixels[index + 1] = Math.round(255 * ao);
          pixels[index + 2] = Math.round(255 * ao);
          pixels[index + 3] = 255;
          statsSamples.push(ao);
        } else if (semantic === "emissive") {
          const line = emissiveMask(u, v, seed, material.visualRole, material.name);
          const color = rolePolicy.emissiveColor;
          pixels[index] = Math.round(255 * color[0] * line * rolePolicy.emissiveStrength);
          pixels[index + 1] = Math.round(255 * color[1] * line * rolePolicy.emissiveStrength);
          pixels[index + 2] = Math.round(255 * color[2] * line * rolePolicy.emissiveStrength);
          pixels[index + 3] = 255;
          statsSamples.push(line * rolePolicy.emissiveStrength);
        }
      }
    }
  }

  const fileName = `${slugify(cacheKey)}-${hashString(`${seed}:${textureSize}`).slice(0, 8)}.png`;
  const outputFile = path.join(outputDir, fileName);
  await sharp(pixels, { raw: { width: textureSize, height: textureSize, channels: 4 } }).png({ compressionLevel: 9 }).toFile(outputFile);
  const stats = textureStatsFromPixels(pixels, textureSize, textureSize);
  if (statsSamples.length > 0 && semantic !== "normal") {
    stats.lumaMean = roundNumber(statsSamples.reduce((sum, value) => sum + value, 0) / statsSamples.length);
  }
  const generated = {
    semantic,
    present: true,
    generated: true,
    reused: false,
    sharedKey: cacheKey,
    generator: "procedural-role-material-v1",
    colorSpace,
    url: `${publicBase}/${fileName}`,
    sourceFile: path.relative(gameRoot, outputFile),
    mimeType: "image/png",
    stats,
  };
  supplementalTextureCache.set(cacheKey, generated);
  return generated;
}

function supplementalTextureCacheKey(material, semantic, rolePolicy) {
  const role = material.visualRole ?? "default";
  const category = material.category ?? "asset";
  const variant = supplementalVariant(material.name, category, semantic, role);
  if (semantic === "metallicRoughness") {
    return [
      semantic,
      role,
      `r${quantize(rolePolicy.roughness, 0.12)}`,
      `m${quantize(rolePolicy.metallic, 0.18)}`,
      `v${variant}`,
    ].join(":");
  }
  if (semantic === "emissive") {
    return [
      semantic,
      role,
      `e${quantize(rolePolicy.emissiveStrength, 0.12)}`,
      `c${rolePolicy.emissiveColor.map((value) => quantize(value, 0.25)).join("-")}`,
      `v${variant}`,
    ].join(":");
  }
  return [semantic, role, category, `v${variant}`].join(":");
}

function supplementalVariant(name, category, semantic, role) {
  const highIdentityRole = role === "robot_body" || role === "floor_surface" || role === "glass_shell";
  const variantCount = semantic === "emissive" || !highIdentityRole ? 2 : 3;
  return hashNumber(`${category}:${semantic}:${role}:${name}`) % variantCount;
}

function quantize(value, step) {
  return Math.round(clamp01(value) / step);
}

function roleMaterialPolicy(material) {
  const role = material.visualRole ?? "default";
  const kind = material.materialKind ?? 0;
  const alpha = material.baseColorFactor?.[3] ?? 1;
  const baseRoughness = material.roughnessFactor ?? 0.72;
  const baseMetallic = material.metallicFactor ?? 0;
  const emissivePeak = Math.max(material.emissiveFactor?.[0] ?? 0, material.emissiveFactor?.[1] ?? 0, material.emissiveFactor?.[2] ?? 0);
  const policies = {
    default: { normalStrength: 0.035, roughnessVariance: 0.08, metallicVariance: 0.02, aoBase: 0.88, aoContrast: 0.08 },
    neutral_surface: { normalStrength: 0.045, roughnessVariance: 0.10, metallicVariance: 0.03, aoBase: 0.84, aoContrast: 0.12 },
    floor_surface: { normalStrength: 0.075, roughnessVariance: 0.16, metallicVariance: 0.06, aoBase: 0.78, aoContrast: 0.18 },
    ceiling_surface: { normalStrength: 0.055, roughnessVariance: 0.12, metallicVariance: 0.04, aoBase: 0.82, aoContrast: 0.14 },
    structural_dark: { normalStrength: 0.060, roughnessVariance: 0.14, metallicVariance: 0.08, aoBase: 0.72, aoContrast: 0.20 },
    glass_shell: { normalStrength: 0.018, roughnessVariance: 0.05, metallicVariance: 0.02, aoBase: 0.92, aoContrast: 0.05 },
    exhibit_warm: { normalStrength: 0.052, roughnessVariance: 0.12, metallicVariance: 0.06, aoBase: 0.80, aoContrast: 0.15 },
    cyan_emissive: { normalStrength: 0.035, roughnessVariance: 0.08, metallicVariance: 0.04, aoBase: 0.88, aoContrast: 0.08 },
    route_gold: { normalStrength: 0.046, roughnessVariance: 0.10, metallicVariance: 0.10, aoBase: 0.84, aoContrast: 0.10 },
    danger_red: { normalStrength: 0.038, roughnessVariance: 0.08, metallicVariance: 0.04, aoBase: 0.86, aoContrast: 0.08 },
    screen_label: { normalStrength: 0.026, roughnessVariance: 0.06, metallicVariance: 0.02, aoBase: 0.90, aoContrast: 0.06 },
    robot_body: { normalStrength: 0.082, roughnessVariance: 0.16, metallicVariance: 0.10, aoBase: 0.72, aoContrast: 0.22 },
  };
  const rolePolicy = policies[role] ?? policies.default;
  return {
    ...rolePolicy,
    roughness: clamp01(baseRoughness),
    metallic: clamp01(baseMetallic),
    emissiveStrength: clamp01(Math.max(material.emissiveStrength ?? 0, emissivePeak) * emissiveRoleBoost(role, kind)),
    emissiveColor: emissiveColorFor(material, role),
    transparent: material.alphaMode === "BLEND" || alpha < 0.92 || role === "glass_shell",
  };
}

function emissiveRoleBoost(role, kind) {
  if (role === "cyan_emissive" || role === "screen_label") return 1.0;
  if (role === "danger_red" || role === "route_gold") return 0.62;
  if (role === "glass_shell") return 0.24;
  if (kind > 3.5 && kind < 4.5) return 0.86;
  return 0.0;
}

function emissiveColorFor(material, role) {
  const factor = material.emissiveFactor ?? [0, 0, 0];
  const peak = Math.max(factor[0], factor[1], factor[2]);
  if (peak > 0.01) return factor.map((value) => clamp01(value / peak));
  if (role === "danger_red") return [1.0, 0.22, 0.10];
  if (role === "route_gold") return [1.0, 0.78, 0.24];
  if (role === "screen_label") return [0.22, 0.92, 1.0];
  return [0.12, 0.88, 0.95];
}

function createHeightField(material, policy, seed) {
  const field = new Float32Array(textureSize * textureSize);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const u = (x + 0.5) / textureSize;
      const v = (y + 0.5) / textureSize;
      field[y * textureSize + x] = proceduralSurfaceValue(u, v, seed, material.visualRole, material.name);
    }
  }
  return field;
}

function writeNormalMap(pixels, height, strength) {
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const left = height[y * textureSize + ((x - 1 + textureSize) % textureSize)];
      const right = height[y * textureSize + ((x + 1) % textureSize)];
      const up = height[((y - 1 + textureSize) % textureSize) * textureSize + x];
      const down = height[((y + 1) % textureSize) * textureSize + x];
      const dx = (left - right) * strength * 10.0;
      const dy = (up - down) * strength * 10.0;
      const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const nx = dx * nz;
      const ny = dy * nz;
      const index = (y * textureSize + x) * 4;
      pixels[index] = Math.round((nx * 0.5 + 0.5) * 255);
      pixels[index + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      pixels[index + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      pixels[index + 3] = 255;
    }
  }
}

function proceduralSurfaceValue(u, v, seed, role, name) {
  const scaleA = 8 + (seed % 7);
  const scaleB = 19 + (seed % 13);
  const noise = valueNoise(u * scaleA, v * scaleA, seed) * 0.55 + valueNoise(u * scaleB + 3.1, v * scaleB - 4.7, seed ^ 0x9e3779b9) * 0.45;
  const materialName = String(name ?? "").toLowerCase();
  const grid = 1 - Math.min(edgeDistance(fract(u * (materialName.includes("floor") ? 7 : 4))), edgeDistance(fract(v * (materialName.includes("floor") ? 5 : 3)))) * 18;
  const line = Math.max(0, grid) * 0.30;
  const brushed = Math.abs(Math.sin((u * 41 + v * 5 + (seed % 17)) * Math.PI)) * 0.12;
  if (role === "floor_surface") return clamp01(noise * 0.52 + line + brushed);
  if (role === "robot_body") return clamp01(noise * 0.48 + panelLine(u, v, seed) * 0.38 + brushed);
  if (role === "structural_dark") return clamp01(noise * 0.55 + brushed * 1.4);
  if (role === "glass_shell") return clamp01(noise * 0.22 + Math.abs(Math.sin((u - v) * 15 + seed)) * 0.035);
  if (role === "route_gold") return clamp01(noise * 0.35 + panelLine(u, v, seed) * 0.18);
  if (role === "screen_label" || role === "cyan_emissive") return clamp01(noise * 0.20 + stripe(u, v, seed) * 0.12);
  return clamp01(noise * 0.62 + line * 0.16);
}

function emissiveMask(u, v, seed, role, name) {
  if (role === "screen_label") return clamp01(0.35 + stripe(u, v, seed) * 0.65);
  if (role === "cyan_emissive") return clamp01(0.42 + stripe(v, u, seed) * 0.58);
  if (role === "route_gold") return clamp01(0.24 + panelLine(u, v, seed) * 0.46);
  if (role === "danger_red") return clamp01(0.20 + pulseDot(u, v, seed) * 0.65);
  if (String(name ?? "").toLowerCase().includes("light")) return 0.55;
  return 0;
}

function panelLine(u, v, seed) {
  const a = 1 - smoothstep(0.010, 0.040, Math.abs(fract(u * (4 + (seed % 5))) - 0.5));
  const b = 1 - smoothstep(0.012, 0.052, Math.abs(fract(v * (3 + (seed % 4))) - 0.5));
  return Math.max(a, b);
}

function stripe(u, v, seed) {
  void v;
  return 1 - smoothstep(0.20, 0.48, Math.abs(fract(u * (8 + (seed % 6))) - 0.5));
}

function pulseDot(u, v, seed) {
  const x = fract(u * (3 + (seed % 3))) - 0.5;
  const y = fract(v * (2 + (seed % 4))) - 0.5;
  return 1 - smoothstep(0.02, 0.20, Math.sqrt(x * x + y * y));
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hashUnit(xi, yi, seed);
  const b = hashUnit(xi + 1, yi, seed);
  const c = hashUnit(xi, yi + 1, seed);
  const d = hashUnit(xi + 1, yi + 1, seed);
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  return mix(mix(a, b, sx), mix(c, d, sx), sy);
}

function textureStatsFromPixels(pixels, width, height) {
  const count = width * height;
  let lumaSum = 0;
  let lumaSqSum = 0;
  let chromaSum = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index] / 255;
    const g = pixels[index + 1] / 255;
    const b = pixels[index + 2] / 255;
    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
    lumaSum += luma;
    lumaSqSum += luma * luma;
    chromaSum += Math.max(r, g, b) - Math.min(r, g, b);
  }
  const mean = lumaSum / count;
  const variance = Math.max(0, lumaSqSum / count - mean * mean);
  return {
    lumaMean: roundNumber(mean),
    contrast: roundNumber(Math.min(1, Math.sqrt(variance) * 1.65)),
    chroma: roundNumber(Math.min(1, (chromaSum / count) * 1.55)),
    detail: 0.5,
  };
}

function materialPipelineId(material) {
  return `mat:${material.category}:${slugify(material.name)}`;
}

function slugify(value) {
  return String(value ?? "material")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "material";
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function hashNumber(value) {
  return Number.parseInt(hashString(value), 16) >>> 0;
}

function hashUnit(x, y, seed) {
  let hash = seed >>> 0;
  hash ^= Math.imul(x + 374761393, 668265263);
  hash ^= Math.imul(y + 1274126177, 2246822519);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489917);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

function edgeDistance(value) {
  return Math.min(value, 1 - value);
}

function fract(value) {
  return value - Math.floor(value);
}

function mix(a, b, t) {
  return a * (1 - t) + b * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(0.00001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function roundNumber(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round((Number(value) || 0) * scale) / scale;
}

function readArg(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}
