#!/usr/bin/env node
// scripts/qa/render-plan-audit.mjs
//
// Steam-gate asset defense, part 2: a custom auditor for the Raw WebGPU render
// plans at src/assets/manifests/generated/raw-webgpu/render_plan_*.json.
//
// The Raw WebGPU renderer uploads two GPU texture-arrays per level — a base-color
// array and a material (normal/ORM/AO/emissive) array — plus a flattened material
// table. glTF-Validator (see gltf-validate.mjs) can vet the source GLBs, but it
// cannot see the *cooked* render plan: the layer budget, whether every texture URL
// still resolves on disk, whether color-spaces survived cooking, and whether the
// per-material layer references line up with the texture arrays. That is what this
// script checks. Each finding is the kind of defect that ships a black prop, a
// wrong-gamma surface, or a GPU upload that silently overflows the array cap.
//
// CHECKS (per render plan):
//   1. LAYER BUDGET     — baseColor + material texture-array layer counts < 256
//                          (WebGPU maxTextureArrayLayers floor). Reports per-level
//                          budget headroom.
//   2. URL RESOLVE      — every texture url resolves to a real file on disk
//                          (/assets/* -> public/assets/*, /src/assets/* -> src/*).
//   3. SEMANTIC↔LAYER   — layer numbering is dense & unique within each array; each
//                          material.textures[].layer points at an existing layer of
//                          the matching semantic.
//   4. COLOR SPACE      — baseColor & emissive textures are tagged sRGB; normal, ORM
//                          (metallicRoughness), and AO are tagged linear. A mistag
//                          here is the classic "why is my metal too dark / my albedo
//                          washed out" bug.
//
// Usage:
//   node scripts/qa/render-plan-audit.mjs                       # audit every render_plan_*.json
//   node scripts/qa/render-plan-audit.mjs --level level_03      # only matching plans (repeatable)
//   node scripts/qa/render-plan-audit.mjs --max-layers 256      # override array-layer cap
//   node scripts/qa/render-plan-audit.mjs --json-only
//
// Exit code: 1 if any ERROR-severity finding exists; 0 otherwise (warnings do not gate).
// Report: src/assets/manifests/generated/raw-webgpu/qa/render_plan_audit_report.json

import { readdirSync, readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PLAN_DIR = join(PKG_ROOT, "src/assets/manifests/generated/raw-webgpu");
const REPORT_DIR = join(PLAN_DIR, "qa");
const REPORT_PATH = join(REPORT_DIR, "render_plan_audit_report.json");

// WebGPU guarantees at least 256 array layers (maxTextureArrayLayers). We treat
// the cooked layer count for each texture-array as having to stay strictly below
// that so there is always head-room for runtime-added layers.
const DEFAULT_MAX_LAYERS = 256;

// Expected color-space per semantic. baseColor & emissive carry authored color and
// must be decoded through sRGB; everything else is data and must stay linear.
const EXPECTED_COLOR_SPACE = {
  baseColor: "srgb",
  emissive: "srgb",
  normal: "linear",
  metallicRoughness: "linear",
  orm: "linear",
  ao: "linear",
  occlusion: "linear",
};

function parseArgs(argv) {
  const opts = { levels: [], maxLayers: DEFAULT_MAX_LAYERS, jsonOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--level") opts.levels.push(argv[(i += 1)]);
    else if (a === "--max-layers") opts.maxLayers = Number(argv[(i += 1)]);
    else if (a === "--json-only") opts.jsonOnly = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/qa/render-plan-audit.mjs [--level <substr>]... [--max-layers N] [--json-only]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

// Map a render-plan URL to an absolute path on disk.
//   /assets/...      -> <pkg>/public/assets/...
//   /src/assets/...  -> <pkg>/src/assets/...
//   src/assets/...   -> <pkg>/src/assets/...  (sourceFile style, repo-relative)
//   public/assets/.. -> <pkg>/public/assets/.. (sourceFile style)
function urlToDiskPath(url) {
  if (!url) return null;
  if (url.startsWith("/src/")) return join(PKG_ROOT, url.slice(1));
  if (url.startsWith("/assets/")) return join(PKG_ROOT, "public", url.slice(1));
  if (url.startsWith("/")) return join(PKG_ROOT, "public", url.slice(1));
  // repo-relative (sourceFile) form
  return join(PKG_ROOT, url);
}

function finding(severity, code, message, extra = {}) {
  return { severity, code, message, ...extra };
}

// ---------------------------------------------------------------------------
// Audit a single texture-array (baseColor or material).
// ---------------------------------------------------------------------------
function auditTextureArray(arrayName, textures, maxLayers, findings, diskCache) {
  if (!Array.isArray(textures) || textures.length === 0) {
    return { arrayName, layerCount: 0, declaredSize: null, semantics: {} };
  }

  const layers = textures.map((t) => t.layer).filter((l) => Number.isFinite(l));
  const layerCount = layers.length ? Math.max(...layers) : 0;

  // CHECK 1: layer budget
  if (layerCount >= maxLayers) {
    findings.push(
      finding("error", "LAYER_BUDGET_EXCEEDED", `${arrayName} array uses ${layerCount} layers (>= ${maxLayers} cap)`, {
        array: arrayName,
        layerCount,
        maxLayers,
      }),
    );
  } else if (layerCount >= maxLayers - 16) {
    findings.push(
      finding("warning", "LAYER_BUDGET_TIGHT", `${arrayName} array at ${layerCount}/${maxLayers} layers (<16 head-room)`, {
        array: arrayName,
        layerCount,
        maxLayers,
      }),
    );
  }

  // CHECK 3a: dense & unique layer indices (1-based, contiguous expected).
  const seen = new Map();
  for (const t of textures) {
    if (!Number.isFinite(t.layer)) {
      findings.push(
        finding("error", "LAYER_MISSING", `${arrayName} texture "${t.name ?? t.url}" has no numeric layer`, { array: arrayName, url: t.url }),
      );
      continue;
    }
    if (seen.has(t.layer)) {
      findings.push(
        finding("error", "LAYER_DUPLICATE", `${arrayName} layer ${t.layer} assigned to multiple textures`, {
          array: arrayName,
          layer: t.layer,
          urls: [seen.get(t.layer), t.url],
        }),
      );
    } else {
      seen.set(t.layer, t.url);
    }
  }
  // Contiguity: layers should be 1..N with no gaps (the GPU array is allocated
  // densely; a gap means a wasted/uninitialized slot a shader might sample).
  for (let layer = 1; layer <= layerCount; layer += 1) {
    if (!seen.has(layer)) {
      findings.push(
        finding("warning", "LAYER_GAP", `${arrayName} array missing layer ${layer} (allocated 1..${layerCount})`, {
          array: arrayName,
          layer,
        }),
      );
    }
  }

  // CHECK 2: URL resolves on disk. CHECK 4: color-space matches semantic.
  const semantics = {};
  for (const t of textures) {
    const sem = t.semantic ?? "unknown";
    semantics[sem] = (semantics[sem] ?? 0) + 1;

    // URL resolve (de-duped via cache so a shared PBR map is only stat'd once).
    const disk = urlToDiskPath(t.url);
    if (!disk) {
      findings.push(finding("error", "TEXTURE_URL_MALFORMED", `${arrayName} texture has no url`, { array: arrayName, name: t.name }));
    } else if (!diskCache.has(disk)) {
      const ok = existsSync(disk) && statSync(disk).isFile();
      diskCache.set(disk, ok);
      if (!ok) {
        findings.push(
          finding("error", "TEXTURE_URL_UNRESOLVED", `${arrayName} L${t.layer} url does not resolve: ${t.url}`, {
            array: arrayName,
            layer: t.layer,
            url: t.url,
            expectedPath: relative(PKG_ROOT, disk),
          }),
        );
      }
    } else if (diskCache.get(disk) === false) {
      findings.push(
        finding("error", "TEXTURE_URL_UNRESOLVED", `${arrayName} L${t.layer} url does not resolve: ${t.url}`, {
          array: arrayName,
          layer: t.layer,
          url: t.url,
          expectedPath: relative(PKG_ROOT, disk),
        }),
      );
    }

    // Color space
    const expected = EXPECTED_COLOR_SPACE[sem];
    if (expected && t.colorSpace && t.colorSpace !== expected) {
      findings.push(
        finding("error", "COLORSPACE_MISTAG", `${arrayName} L${t.layer} semantic "${sem}" tagged ${t.colorSpace}, expected ${expected}`, {
          array: arrayName,
          layer: t.layer,
          semantic: sem,
          colorSpace: t.colorSpace,
          expected,
          url: t.url,
        }),
      );
    } else if (expected && !t.colorSpace) {
      findings.push(
        finding("warning", "COLORSPACE_MISSING", `${arrayName} L${t.layer} semantic "${sem}" has no colorSpace tag`, {
          array: arrayName,
          layer: t.layer,
          semantic: sem,
          url: t.url,
        }),
      );
    }
  }

  return {
    arrayName,
    layerCount,
    declaredSize: null,
    semantics,
    layersByName: Object.fromEntries(textures.map((t) => [t.layer, t.semantic])),
  };
}

// ---------------------------------------------------------------------------
// CHECK 3b: material.textures[].layer references must hit an existing layer of
// the matching semantic in the CORRECT texture-array.
//
// The render plan uses two independent GPU texture-arrays with independent
// 1-based layer numbering:
//   - baseColor refs  -> the baseColor array  (geometry.baseColorTextures)
//   - everything else -> the material array   (geometry.materialTextures:
//                          normal / metallicRoughness / ao / emissive)
// So a baseColor ref at layer 1 and a normal ref at layer 1 are unrelated; each
// must be resolved against its own array.
// ---------------------------------------------------------------------------
function auditMaterialReferences(materials, baseArraySummary, materialArraySummary, findings) {
  if (!Array.isArray(materials)) return;
  const baseLayerSemantic = baseArraySummary.layersByName ?? {};
  const matLayerSemantic = materialArraySummary.layersByName ?? {};
  // Normalize occlusion -> ao so the AO supplement matches an "ao" ref.
  const norm = (s) => (s === "occlusion" ? "ao" : s);
  const routeArray = (semantic) => (norm(semantic) === "baseColor" ? "baseColor" : "material");
  for (const m of materials) {
    if (!Array.isArray(m.textures)) continue;
    for (const ref of m.textures) {
      if (ref.present === false) continue;
      // A ref with no URL is a placeholder slot: the material declares the
      // semantic (so the shader binds a default) but no cooked texture was
      // bound, so it falls back to baseColorFactor / a neutral default. The
      // cooker omits `layer` for these on purpose — not a defect. Only a ref
      // that carries a real URL is expected to have resolved into a layer.
      if (ref.url === null || ref.url === undefined) continue;
      if (!Number.isFinite(ref.layer)) {
        findings.push(
          finding("error", "MATERIAL_REF_NO_LAYER", `material ${m.id} ${ref.semantic} ref has url but no layer: ${ref.url}`, {
            material: m.id,
            semantic: ref.semantic,
            url: ref.url,
          }),
        );
        continue;
      }
      const arrayName = routeArray(ref.semantic);
      const layerSemantic = arrayName === "baseColor" ? baseLayerSemantic : matLayerSemantic;
      const haveSem = layerSemantic[ref.layer];
      if (haveSem === undefined) {
        findings.push(
          finding("error", "MATERIAL_REF_DANGLING", `material ${m.id} ${ref.semantic} references missing ${arrayName}-array layer ${ref.layer}`, {
            material: m.id,
            semantic: ref.semantic,
            array: arrayName,
            layer: ref.layer,
          }),
        );
      } else if (norm(haveSem) !== norm(ref.semantic)) {
        findings.push(
          finding("error", "MATERIAL_REF_SEMANTIC_MISMATCH", `material ${m.id} ${ref.semantic} ref -> ${arrayName} layer ${ref.layer} which holds ${haveSem}`, {
            material: m.id,
            refSemantic: ref.semantic,
            array: arrayName,
            layer: ref.layer,
            layerSemantic: haveSem,
          }),
        );
      }
    }
  }
}

function auditProceduralPlaceholders(plan, findings) {
  const placeholders = (plan.instances ?? []).filter(
    (instance) => instance.source === "procedural-placeholder" || instance.state?.compilerPlaceholder,
  );
  if (placeholders.length === 0) return;

  const levelId = plan.level?.id ?? "unknown-level";
  findings.push(
    finding("warning", "PROCEDURAL_PLACEHOLDER", `${levelId} has ${placeholders.length} raw compiler placeholder instance(s)`, {
      levelId,
      count: placeholders.length,
      instances: placeholders.slice(0, 16).map((instance) => ({
        id: instance.id,
        roomId: instance.roomId,
        role: instance.role,
        modelKey: instance.modelKey,
        scale: instance.scale,
        message: instance.state?.message,
      })),
    }),
  );
}

// ---------------------------------------------------------------------------
// Audit one render plan.
// ---------------------------------------------------------------------------
function auditPlan(planPath, opts) {
  const rel = relative(PKG_ROOT, planPath);
  const result = {
    plan: rel,
    levelId: null,
    findings: [],
    budget: {},
    error: null,
  };
  let plan;
  try {
    plan = JSON.parse(readFileSync(planPath, "utf8"));
  } catch (err) {
    result.error = `parse failed: ${String(err && err.message ? err.message : err)}`;
    result.findings.push(finding("error", "PLAN_PARSE_FAILED", result.error));
    return result;
  }

  result.levelId = plan.level?.id ?? basename(planPath).replace(/^render_plan_/, "").replace(/\.json$/, "");
  const g = plan.geometry ?? {};
  const diskCache = new Map();

  const baseSummary = auditTextureArray("baseColor", g.baseColorTextures ?? [], opts.maxLayers, result.findings, diskCache);
  const matSummary = auditTextureArray("material", g.materialTextures ?? [], opts.maxLayers, result.findings, diskCache);
  auditMaterialReferences(g.materials ?? [], baseSummary, matSummary, result.findings);
  auditProceduralPlaceholders(plan, result.findings);

  result.budget = {
    baseColorLayers: baseSummary.layerCount,
    materialLayers: matSummary.layerCount,
    maxLayers: opts.maxLayers,
    baseColorHeadroom: opts.maxLayers - baseSummary.layerCount,
    materialHeadroom: opts.maxLayers - matSummary.layerCount,
    baseColorTextureSize: g.baseColorTextureSize ?? null,
    materialTextureSize: g.materialTextureSize ?? null,
    materialCount: Array.isArray(g.materials) ? g.materials.length : null,
    baseColorSemantics: baseSummary.semantics,
    materialSemantics: matSummary.semantics,
    texturesResolved: [...diskCache.values()].filter(Boolean).length,
    texturesUnresolved: [...diskCache.values()].filter((v) => v === false).length,
  };
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv.slice(2));

  let plans = readdirSync(PLAN_DIR)
    .filter((f) => /^render_plan_.*\.json$/.test(f))
    .map((f) => join(PLAN_DIR, f));
  if (opts.levels.length) {
    plans = plans.filter((p) => opts.levels.some((needle) => basename(p).includes(needle)));
  }
  plans.sort();

  if (plans.length === 0) {
    console.error("[render-plan-audit] no render_plan_*.json matched.");
    process.exit(1);
  }

  const results = plans.map((p) => auditPlan(p, opts));

  let totalErrors = 0;
  let totalWarnings = 0;
  for (const r of results) {
    totalErrors += r.findings.filter((f) => f.severity === "error").length;
    totalWarnings += r.findings.filter((f) => f.severity === "warning").length;
  }

  const report = {
    schemaVersion: "hp.qa.render-plan-audit.v1",
    generatedAt: new Date().toISOString(),
    pkgRoot: PKG_ROOT,
    maxLayers: opts.maxLayers,
    summary: {
      plansAudited: results.length,
      totalErrors,
      totalWarnings,
      plansWithErrors: results.filter((r) => r.findings.some((f) => f.severity === "error")).length,
    },
    plans: results,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  if (!opts.jsonOnly) {
    console.log(`[render-plan-audit] audited ${results.length} render plan(s)`);
    for (const r of results) {
      const errs = r.findings.filter((f) => f.severity === "error");
      const warns = r.findings.filter((f) => f.severity === "warning");
      const tag = errs.length ? "✗" : warns.length ? "!" : "✓";
      console.log(
        `  ${tag} ${r.levelId}  base=${r.budget.baseColorLayers ?? "?"}L (hr ${r.budget.baseColorHeadroom ?? "?"})  ` +
          `mat=${r.budget.materialLayers ?? "?"}L (hr ${r.budget.materialHeadroom ?? "?"})  ` +
          `tex ${r.budget.texturesResolved ?? 0} ok / ${r.budget.texturesUnresolved ?? 0} missing  ` +
          `[${errs.length} err, ${warns.length} warn]`,
      );
      for (const f of errs.slice(0, 8)) console.log(`      ✗ ${f.code}: ${f.message}`);
      if (errs.length > 8) console.log(`      …and ${errs.length - 8} more errors`);
      // Surface a couple representative warnings only (gaps/colorspace-missing get noisy).
      const warnCodes = [...new Set(warns.map((w) => w.code))];
      if (warnCodes.length) console.log(`      ! warnings: ${warnCodes.join(", ")} (${warns.length})`);
    }
    console.log(`  totals: ${totalErrors} error(s), ${totalWarnings} warning(s)`);
    console.log(`  report: ${relative(PKG_ROOT, REPORT_PATH)}`);
  } else {
    console.log(REPORT_PATH);
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
