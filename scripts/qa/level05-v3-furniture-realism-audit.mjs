#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REPORT_JSON = join(ROOT, "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_realism_audit.json");
const REPORT_MD = join(ROOT, "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_realism_audit.md");

const PACKS = [
  {
    id: "batch01_hero",
    manifest: "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_hero.json",
  },
  {
    id: "batch02_living",
    manifest: "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch02.json",
  },
  {
    id: "batch03_medical",
    manifest: "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch03.json",
  },
  {
    id: "batch04_dressing",
    manifest: "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch04.json",
  },
];

const FRONT_CLUTTER = /\b(bead|status|screw|bolt|loose|cap|dot|slit|capsule|tiny|button)\b/i;
const CONNECTOR = /\b(socket|collar|gasket|hinge|knuckle|bridge|support|yoke|integrated|no_gap|no-gap|foot|base|plinth|rim|rail)\b/i;
const ROD_LIKE = /\b(arm|rod|pole|stand|rack|leg|support|hinge|light|yoke)\b/i;

const report = {
  schema: "hp.level05.v3.furniture.realism-audit@1",
  generatedAt: new Date().toISOString(),
  packs: [],
  totals: {
    assets: 0,
    meshNodes: 0,
    texturedMaterials: 0,
    normalTextures: 0,
    occlusionTextures: 0,
    metallicRoughnessTextures: 0,
    highClutterRisk: 0,
    pbrFollowupNeeded: 0,
    normalAttributeFollowupNeeded: 0,
    connectorFollowupNeeded: 0,
  },
  assets: [],
  errors: [],
};

for (const pack of PACKS) {
  const manifestPath = join(ROOT, pack.manifest);
  if (!existsSync(manifestPath)) {
    report.errors.push(`missing manifest: ${pack.manifest}`);
    continue;
  }
  const manifest = readJson(manifestPath);
  const packRow = {
    id: pack.id,
    manifest: pack.manifest,
    packId: manifest.packId,
    assetCount: Array.isArray(manifest.assets) ? manifest.assets.length : 0,
  };
  report.packs.push(packRow);
  for (const asset of manifest.assets ?? []) {
    const glbPath = join(dirname(manifestPath), asset.glbFile);
    const relGlb = relative(ROOT, glbPath);
    if (!existsSync(glbPath)) {
      report.errors.push(`missing glb for ${asset.modelKey}: ${relGlb}`);
      continue;
    }
    const gltf = readGlbJson(glbPath);
    const meshNodes = (gltf.nodes ?? []).filter((node) => Number.isInteger(node.mesh));
    const meshNodeNames = meshNodes.map((node, index) => node.name || `mesh_${index}`);
    const materials = gltf.materials ?? [];
    const texturedMaterials = materials.filter((mat) => mat.pbrMetallicRoughness?.baseColorTexture).length;
    const normalTextures = materials.filter((mat) => mat.normalTexture).length;
    const occlusionTextures = materials.filter((mat) => mat.occlusionTexture).length;
    const metallicRoughnessTextures = materials.filter((mat) => mat.pbrMetallicRoughness?.metallicRoughnessTexture).length;
    const primitives = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
    const primitiveNormalAttributes = primitives.filter((primitive) => primitive.attributes?.NORMAL !== undefined).length;
    const normalAttributeFollowupNeeded = primitiveNormalAttributes < primitives.length;
    const frontClutterNodes = meshNodeNames.filter((name) => FRONT_CLUTTER.test(name));
    const connectorNodes = meshNodeNames.filter((name) => CONNECTOR.test(name));
    const rodLikeNodes = meshNodeNames.filter((name) => ROD_LIKE.test(name));
    const hasNoGapEvidence = !rodLikeNodes.length || connectorNodes.some((name) => /socket|collar|hinge|knuckle|bridge|support|integrated|no_gap|no-gap|yoke/i.test(name));
    const pbrFollowupNeeded = normalTextures === 0 || occlusionTextures === 0 || metallicRoughnessTextures === 0;
    const clutterRisk = frontClutterNodes.length >= 8 ? "high" : frontClutterNodes.length >= 4 ? "medium" : "low";
    const connectorRisk = hasNoGapEvidence ? "low" : "medium";
    const recommendations = [];
    if (clutterRisk !== "low") recommendations.push("Review player-facing tiny status/screw/bead/cap nodes and merge or remove non-gameplay clutter.");
    if (!hasNoGapEvidence) recommendations.push("Add endpoint-based rods plus sockets/collars/bridges to hide gaps.");
    if (pbrFollowupNeeded) recommendations.push("Author or derive normal, metallicRoughness, and occlusion maps; current GLB is baseColor-first.");
    if (normalAttributeFollowupNeeded) recommendations.push("Ensure all primitives export normals before Raw/WebGPU import.");

    const row = {
      packId: manifest.packId,
      modelKey: asset.modelKey,
      label: asset.label,
      glb: relGlb,
      sizeMeters: asset.sizeMeters,
      meshNodes: meshNodes.length,
      materials: materials.length,
      texturedMaterials,
      normalTextures,
      occlusionTextures,
      metallicRoughnessTextures,
      primitives: primitives.length,
      primitiveNormalAttributes,
      normalAttributeFollowupNeeded,
      frontClutterNodes,
      connectorNodes,
      rodLikeNodes,
      clutterRisk,
      connectorRisk,
      pbrFollowupNeeded,
      recommendations,
    };
    report.assets.push(row);
    report.totals.assets += 1;
    report.totals.meshNodes += row.meshNodes;
    report.totals.texturedMaterials += row.texturedMaterials;
    report.totals.normalTextures += row.normalTextures;
    report.totals.occlusionTextures += row.occlusionTextures;
    report.totals.metallicRoughnessTextures += row.metallicRoughnessTextures;
    if (row.clutterRisk === "high") report.totals.highClutterRisk += 1;
    if (row.pbrFollowupNeeded) report.totals.pbrFollowupNeeded += 1;
    if (row.normalAttributeFollowupNeeded) report.totals.normalAttributeFollowupNeeded += 1;
    if (row.connectorRisk !== "low") report.totals.connectorFollowupNeeded += 1;
  }
}

mkdirSync(dirname(REPORT_JSON), { recursive: true });
writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(REPORT_MD, renderMarkdown(report));

console.log("Level 05 v3 furniture realism audit");
console.log(`  assets: ${report.totals.assets}`);
console.log(`  mesh nodes: ${report.totals.meshNodes}`);
console.log(`  textured materials: ${report.totals.texturedMaterials}`);
console.log(`  high clutter risk: ${report.totals.highClutterRisk}`);
console.log(`  connector follow-up: ${report.totals.connectorFollowupNeeded}`);
console.log(`  PBR follow-up: ${report.totals.pbrFollowupNeeded}`);
console.log(`  normal attribute follow-up: ${report.totals.normalAttributeFollowupNeeded}`);
console.log(`  report: ${relative(ROOT, REPORT_JSON)}`);

if (report.errors.length > 0) {
  for (const error of report.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}
if (report.totals.normalAttributeFollowupNeeded > 0) {
  console.error(`ERROR ${report.totals.normalAttributeFollowupNeeded} assets are missing GLB primitive NORMAL attributes.`);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readGlbJson(path) {
  const data = readFileSync(path);
  if (data.toString("utf8", 0, 4) !== "glTF") throw new Error(`not a GLB: ${path}`);
  const jsonLength = data.readUInt32LE(12);
  const chunkType = data.toString("utf8", 16, 20);
  if (chunkType !== "JSON") throw new Error(`first GLB chunk is not JSON: ${path}`);
  return JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
}

function renderMarkdown(data) {
  const lines = [
    "# Level 05 v3 Furniture Realism Audit",
    "",
    `Generated: ${data.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Assets: ${data.totals.assets}`,
    `- Mesh nodes: ${data.totals.meshNodes}`,
    `- Textured materials: ${data.totals.texturedMaterials}`,
    `- High clutter risk: ${data.totals.highClutterRisk}`,
    `- Connector follow-up needed: ${data.totals.connectorFollowupNeeded}`,
    `- PBR follow-up needed: ${data.totals.pbrFollowupNeeded}`,
    `- Normal attribute follow-up needed: ${data.totals.normalAttributeFollowupNeeded}`,
    "",
    "## Findings",
    "",
    "| Asset | Nodes | Texture | PBR Maps | Primitive Normals | Clutter | Connector | Recommendation |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- | --- |",
  ];
  for (const asset of data.assets) {
    const pbr = `${asset.normalTextures}/${asset.occlusionTextures}/${asset.metallicRoughnessTextures}`;
    const primitiveNormals = `${asset.primitiveNormalAttributes}/${asset.primitives}`;
    const rec = asset.recommendations.length ? asset.recommendations.join(" ") : "No immediate geometry cleanup flagged.";
    lines.push(`| \`${asset.modelKey}\` | ${asset.meshNodes} | ${asset.texturedMaterials}/${asset.materials} | ${pbr} | ${primitiveNormals} | ${asset.clutterRisk} | ${asset.connectorRisk} | ${rec} |`);
  }
  if (data.errors.length) {
    lines.push("", "## Errors", "");
    for (const error of data.errors) lines.push(`- ${error}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
