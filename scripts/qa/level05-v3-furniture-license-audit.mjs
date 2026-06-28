#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const reportJson = "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_license_audit.json";
const reportMd = "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_license_audit.md";

const packs = [
  {
    packId: "hp_level05_reclamation_furniture_image2_v3_hero",
    manifest: "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_hero.json",
    provenance: "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_hero_source_provenance.json",
    promptLedger: "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_hero_prompt_ledger.md",
  },
  {
    packId: "hp_level05_reclamation_furniture_image2_v3_batch02",
    manifest: "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch02.json",
    provenance: "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_batch02_source_provenance.json",
    promptLedger: "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_batch02_prompt_ledger.md",
  },
  {
    packId: "hp_level05_reclamation_furniture_image2_v3_batch03",
    manifest: "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch03.json",
    provenance: "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_batch03_source_provenance.json",
    promptLedger: "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_batch03_prompt_ledger.md",
  },
  {
    packId: "hp_level05_reclamation_furniture_image2_v3_batch04",
    manifest: "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch04.json",
    provenance: "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_batch04_source_provenance.json",
    promptLedger: "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_batch04_prompt_ledger.md",
  },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repo, relativePath), "utf8"));
}

function existsPath(filePath) {
  if (!filePath) return false;
  return fs.existsSync(path.isAbsolute(filePath) ? filePath : path.join(repo, filePath));
}

function normalizeSources(provenance) {
  if (provenance.image2Sources && typeof provenance.image2Sources === "object") {
    return Object.entries(provenance.image2Sources).map(([sourceId, source]) => ({
      sourceId,
      modelKey: source.modelKey,
      copiedTo: source.copiedTo,
      generatedCache: source.generatedCache,
      prompt: source.prompt,
      toolCallId: source.toolCallId ?? provenance.generationCallId ?? "not-exposed-by-codex-imagegen",
    }));
  }
  if (Array.isArray(provenance.sourceSheets)) {
    return provenance.sourceSheets.map((source, index) => ({
      sourceId: source.sourceId ?? source.modelKey ?? `source_${index + 1}`,
      modelKey: source.modelKey,
      copiedTo: source.copiedTo,
      generatedCache: source.generatedCache,
      prompt: source.prompt,
      toolCallId: source.toolCallId ?? provenance.generationCallId ?? "not-exposed-by-built-in-image-gen",
    }));
  }
  return [];
}

function normalizeAuditEntries(provenance) {
  const entries = Array.isArray(provenance.audit) ? provenance.audit : Array.isArray(provenance.assets) ? provenance.assets : [];
  return new Map(entries.map((entry) => [entry.modelKey, entry]));
}

function modelAssets(manifest) {
  return new Map((manifest.assets ?? []).map((asset) => [asset.modelKey, asset]));
}

const assets = [];
const packReports = [];

for (const pack of packs) {
  const manifest = readJson(pack.manifest);
  const provenance = readJson(pack.provenance);
  const sourceRows = normalizeSources(provenance);
  const auditByModelKey = normalizeAuditEntries(provenance);
  const manifestByModelKey = modelAssets(manifest);
  const licenseLabel = provenance.licenseLabel ?? "openai-generated-output-user-owned-subject-to-openai-terms";
  const classification = provenance.classification ?? "owned-generated-output";
  const generationCallId = provenance.generationCallId ?? "not-exposed-by-codex-imagegen";

  packReports.push({
    packId: pack.packId,
    manifest: pack.manifest,
    provenance: pack.provenance,
    promptLedger: pack.promptLedger,
    licenseLabel,
    classification,
    generationCallId,
    sourceCount: sourceRows.length,
    atlas: provenance.atlas,
    regions: provenance.regions,
    cutoutDirectory: provenance.cutoutDirectory,
    atlasExists: existsPath(provenance.atlas),
    regionsExists: existsPath(provenance.regions),
    cutoutDirectoryExists: existsPath(provenance.cutoutDirectory),
  });

  for (const source of sourceRows) {
    const audit = auditByModelKey.get(source.modelKey) ?? {};
    const manifestAsset = manifestByModelKey.get(source.modelKey) ?? {};
    assets.push({
      modelKey: source.modelKey,
      packId: pack.packId,
      label: manifestAsset.label ?? source.modelKey,
      licenseLabel,
      classification,
      generationCallId: source.toolCallId ?? generationCallId,
      sourceImage: source.copiedTo,
      sourceImageExists: existsPath(source.copiedTo),
      generatedCache: source.generatedCache,
      generatedCacheExists: existsPath(source.generatedCache),
      prompt: source.prompt,
      promptRecorded: typeof source.prompt === "string" && source.prompt.length > 24,
      atlas: provenance.atlas,
      regions: provenance.regions,
      cutoutDirectory: provenance.cutoutDirectory,
      glb: audit.glb ?? manifestAsset.path ?? manifestAsset.modelPath ?? null,
      glbExists: existsPath(audit.glb ?? manifestAsset.path ?? manifestAsset.modelPath),
      sizeMeters: audit.sizeMeters ?? manifestAsset.sizeMeters ?? manifestAsset.footprint ?? null,
      materialsWithBaseColorTexture: audit.materialsWithBaseColorTexture ?? null,
      areaUvNodes: audit.areaUvNodes ?? null,
      missingUvNodes: audit.missingUvNodes ?? null,
    });
  }
}

const summary = {
  packs: packReports.length,
  assets: assets.length,
  licenseLabels: [...new Set(assets.map((asset) => asset.licenseLabel))],
  classifications: [...new Set(assets.map((asset) => asset.classification))],
  missingSourceImages: assets.filter((asset) => !asset.sourceImageExists).map((asset) => asset.modelKey),
  missingGeneratedCaches: assets.filter((asset) => !asset.generatedCacheExists).map((asset) => asset.modelKey),
  missingPrompts: assets.filter((asset) => !asset.promptRecorded).map((asset) => asset.modelKey),
  missingGlbs: assets.filter((asset) => !asset.glbExists).map((asset) => asset.modelKey),
  missingTextureEvidence: assets
    .filter((asset) => !Number.isFinite(asset.materialsWithBaseColorTexture) || !Number.isFinite(asset.areaUvNodes) || asset.missingUvNodes !== 0)
    .map((asset) => asset.modelKey),
};

const report = {
  schema: "hp.level05.v3Furniture.licenseAudit.v1",
  generatedAt: "2026-06-27",
  policy: {
    licenseLabel: "openai-generated-output-user-owned-subject-to-openai-terms",
    classification: "owned-generated-output",
    termsPointer: "docs/provenance/openai-imagegen-terms-2026-06-19.md",
    callIdPolicy: "Codex built-in image generation did not expose a separate API call id; generated cache paths and prompts are recorded.",
    externalAssetPolicy: "No third-party or CC0 source is bundled by these 20 furniture assets.",
  },
  summary,
  packs: packReports,
  assets,
};

fs.writeFileSync(path.join(repo, reportJson), `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "# Level 05 v3 Furniture License Audit",
  "",
  "- Generated: `2026-06-27`",
  "- Asset count: `20`",
  "- License label: `openai-generated-output-user-owned-subject-to-openai-terms`",
  "- Classification: `owned-generated-output`",
  "- Terms pointer: `docs/provenance/openai-imagegen-terms-2026-06-19.md`",
  "- External assets: none in this v3 furniture set",
  "",
  "## Summary",
  "",
  `- Missing repo source images: ${summary.missingSourceImages.length ? summary.missingSourceImages.join(", ") : "none"}`,
  `- Missing generated cache images: ${summary.missingGeneratedCaches.length ? summary.missingGeneratedCaches.join(", ") : "none"}`,
  `- Missing prompts: ${summary.missingPrompts.length ? summary.missingPrompts.join(", ") : "none"}`,
  `- Missing GLBs: ${summary.missingGlbs.length ? summary.missingGlbs.join(", ") : "none"}`,
  `- Missing texture/UV evidence: ${summary.missingTextureEvidence.length ? summary.missingTextureEvidence.join(", ") : "none"}`,
  "",
  "## Asset Evidence",
  "",
  "| modelKey | pack | source | generated cache | GLB | texture evidence |",
  "|---|---|---:|---:|---:|---|",
  ...assets.map((asset) => {
    const texture = `${asset.materialsWithBaseColorTexture ?? "?"} textured mats, ${asset.areaUvNodes ?? "?"} area UV nodes, missing UV ${asset.missingUvNodes ?? "?"}`;
    return `| \`${asset.modelKey}\` | \`${asset.packId}\` | ${asset.sourceImageExists ? "yes" : "NO"} | ${asset.generatedCacheExists ? "yes" : "NO"} | ${asset.glbExists ? "yes" : "NO"} | ${texture} |`;
  }),
  "",
];

fs.writeFileSync(path.join(repo, reportMd), `${lines.join("\n")}\n`);

console.log(`Level 05 v3 furniture license audit: assets=${assets.length}`);
console.log(`  missingSourceImages=${summary.missingSourceImages.length}`);
console.log(`  missingGeneratedCaches=${summary.missingGeneratedCaches.length}`);
console.log(`  missingPrompts=${summary.missingPrompts.length}`);
console.log(`  missingGlbs=${summary.missingGlbs.length}`);
console.log(`  missingTextureEvidence=${summary.missingTextureEvidence.length}`);
console.log(`  report=${reportJson}`);
