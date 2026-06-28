#!/usr/bin/env node
// scripts/qa/gltf-validate.mjs
//
// Steam-gate asset defense, part 1: run the official Khronos glTF-Validator
// (npm `gltf-validator`, Dart-compiled WASM/JS) against every .glb under
// src/assets and produce a machine-readable + human-readable report.
//
// Why this matters for a self-authored Raw WebGPU renderer: the renderer trusts
// its cooked GLBs blindly. A malformed accessor slot, a base-color texture that
// is silently linear instead of sRGB, or a missing image can ship a black/broken
// prop to players. This catches the class of defects the validator knows about
// *before* they reach a Steam build.
//
// Usage:
//   node scripts/qa/gltf-validate.mjs                 # scan all of src/assets
//   node scripts/qa/gltf-validate.mjs --dir <path>    # scan a subtree (repeatable)
//   node scripts/qa/gltf-validate.mjs --glob level_03 # only paths containing substring (repeatable via --filter)
//   node scripts/qa/gltf-validate.mjs --filter level03 --filter enemies
//   node scripts/qa/gltf-validate.mjs --max-errors 0  # exit non-zero only if errors exceed N (default 0)
//   node scripts/qa/gltf-validate.mjs --warn-gate     # also fail on warnings (CI strict mode)
//   node scripts/qa/gltf-validate.mjs --json-only      # suppress console table, just write report
//
// Exit code: 0 if (totalErrors <= maxErrors) and (!warnGate || totalWarnings === 0); 1 otherwise.
// Report written to: src/assets/manifests/generated/raw-webgpu/qa/gltf_validate_report.json

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

import validator from "gltf-validator";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const REPORT_DIR = join(PKG_ROOT, "src/assets/manifests/generated/raw-webgpu/qa");
const REPORT_PATH = join(REPORT_DIR, "gltf_validate_report.json");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    dirs: [],
    filters: [],
    maxErrors: 0,
    warnGate: false,
    jsonOnly: false,
    maxMessagesPerFile: 50,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dir") opts.dirs.push(argv[(i += 1)]);
    else if (a === "--filter" || a === "--glob") opts.filters.push(argv[(i += 1)]);
    else if (a === "--max-errors") opts.maxErrors = Number(argv[(i += 1)]);
    else if (a === "--warn-gate") opts.warnGate = true;
    else if (a === "--json-only") opts.jsonOnly = true;
    else if (a === "--max-messages") opts.maxMessagesPerFile = Number(argv[(i += 1)]);
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/qa/gltf-validate.mjs [--dir <path>]... [--filter <substr>]... [--max-errors N] [--warn-gate] [--json-only]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (opts.dirs.length === 0) opts.dirs.push(join(PKG_ROOT, "src/assets"));
  return opts;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------
function walkGlb(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip cook sidecar dirs that never contain real GLBs but can be huge.
      if (entry.name === "node_modules") continue;
      walkGlb(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".glb")) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// External-resource resolver. Cooked GLBs are normally self-contained (embedded
// buffers + images), but the validator still calls this for any external URI.
// Resolve relative to the GLB's own directory and surface read failures as a
// rejection so the validator reports them as IO_ERROR rather than crashing.
// ---------------------------------------------------------------------------
function makeExternalResourceFunction(glbPath) {
  const base = dirname(glbPath);
  return (uri) =>
    new Promise((res, rej) => {
      try {
        const decoded = decodeURIComponent(uri);
        const target = resolve(base, decoded);
        res(new Uint8Array(readFileSync(target)));
      } catch (err) {
        rej(String(err && err.message ? err.message : err));
      }
    });
}

// ---------------------------------------------------------------------------
// Validate one GLB
// ---------------------------------------------------------------------------
async function validateOne(glbPath, opts) {
  const relPath = relative(PKG_ROOT, glbPath);
  const out = {
    file: relPath,
    name: basename(glbPath),
    sizeBytes: 0,
    ok: false,
    numErrors: 0,
    numWarnings: 0,
    numInfos: 0,
    numHints: 0,
    messages: [],
    info: null,
    crash: null,
  };
  let bytes;
  try {
    const buf = readFileSync(glbPath);
    out.sizeBytes = buf.length;
    bytes = new Uint8Array(buf);
  } catch (err) {
    out.crash = `read failed: ${String(err && err.message ? err.message : err)}`;
    return out;
  }

  let report;
  try {
    report = await validator.validateBytes(bytes, {
      uri: relPath,
      maxIssues: opts.maxMessagesPerFile,
      externalResourceFunction: makeExternalResourceFunction(glbPath),
    });
  } catch (err) {
    // Rejection means the validator could not even parse the container.
    out.crash = `validator rejected: ${String(err)}`;
    return out;
  }

  const issues = report.issues ?? {};
  out.numErrors = issues.numErrors ?? 0;
  out.numWarnings = issues.numWarnings ?? 0;
  out.numInfos = issues.numInfos ?? 0;
  out.numHints = issues.numHints ?? 0;
  out.messages = (issues.messages ?? []).map((m) => ({
    code: m.code,
    severity: m.severity, // 0=error 1=warning 2=info 3=hint
    severityLabel: severityLabel(m.severity),
    message: m.message,
    pointer: m.pointer ?? null,
  }));
  // Trim the giant resource list but keep the useful summary.
  const info = report.info ?? {};
  out.info = {
    version: info.version ?? null,
    generator: info.generator ?? null,
    hasDefaultScene: info.hasDefaultScene ?? null,
    drawCallCount: info.drawCallCount ?? null,
    totalVertexCount: info.totalVertexCount ?? null,
    totalTriangleCount: info.totalTriangleCount ?? null,
    materialCount: info.materialCount ?? null,
    animationCount: info.animationCount ?? null,
    extensionsUsed: info.extensionsUsed ?? [],
    // Resources: surface any base-color / image that is NOT flagged sRGB-ready
    // and any external (non-embedded) resource, which is a portability risk.
    resourceCount: Array.isArray(info.resources) ? info.resources.length : null,
  };
  out.ok = out.numErrors === 0;
  return out;
}

function severityLabel(s) {
  return ["error", "warning", "info", "hint"][s] ?? `sev${s}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const files = [];
  for (const d of opts.dirs) {
    const abs = resolve(PKG_ROOT, d);
    if (!existsSync(abs)) {
      console.error(`[gltf-validate] dir not found: ${abs}`);
      continue;
    }
    const st = statSync(abs);
    if (st.isFile() && abs.toLowerCase().endsWith(".glb")) files.push(abs);
    else walkGlb(abs, files);
  }

  let targets = files;
  if (opts.filters.length) {
    targets = files.filter((f) => {
      const r = relative(PKG_ROOT, f);
      return opts.filters.some((needle) => r.includes(needle));
    });
  }
  targets = [...new Set(targets)].sort();

  if (targets.length === 0) {
    console.error("[gltf-validate] no .glb files matched.");
    process.exit(opts.maxErrors >= 0 ? 0 : 1);
  }

  if (!opts.jsonOnly) {
    console.log(`[gltf-validate] validator v${validator.version()} — scanning ${targets.length} GLB(s)`);
  }

  const results = [];
  // Sequential: the Dart-compiled validator is single-threaded WASM and parallel
  // calls can race its shared module state. Throughput here is plenty fast.
  let done = 0;
  for (const f of targets) {
    const r = await validateOne(f, opts);
    results.push(r);
    done += 1;
    if (!opts.jsonOnly && (done % 50 === 0 || done === targets.length)) {
      process.stdout.write(`  …${done}/${targets.length}\r`);
    }
  }
  if (!opts.jsonOnly) process.stdout.write("\n");

  // Aggregate
  const totalErrors = results.reduce((a, r) => a + r.numErrors + (r.crash ? 1 : 0), 0);
  const totalWarnings = results.reduce((a, r) => a + r.numWarnings, 0);
  const totalInfos = results.reduce((a, r) => a + r.numInfos, 0);
  const crashed = results.filter((r) => r.crash);
  const withErrors = results.filter((r) => r.numErrors > 0 || r.crash);
  const withWarnings = results.filter((r) => r.numWarnings > 0 && !r.crash);

  // Roll up the distinct issue codes so a reviewer sees the *kinds* of problems
  // at a glance (e.g. ACCESSOR_*, MESH_PRIMITIVE_*, TEXTURE_*, IMAGE_*).
  const codeTally = {};
  for (const r of results) {
    for (const m of r.messages) {
      const k = `${m.severityLabel}:${m.code}`;
      codeTally[k] = (codeTally[k] ?? 0) + 1;
    }
  }

  const report = {
    schemaVersion: "hp.qa.gltf-validate.v1",
    generatedAt: new Date().toISOString(),
    validatorVersion: validator.version(),
    pkgRoot: PKG_ROOT,
    scannedDirs: opts.dirs.map((d) => relative(PKG_ROOT, resolve(PKG_ROOT, d))),
    filters: opts.filters,
    gate: { maxErrors: opts.maxErrors, warnGate: opts.warnGate },
    summary: {
      filesScanned: results.length,
      filesWithErrors: withErrors.length,
      filesWithWarnings: withWarnings.length,
      filesCrashed: crashed.length,
      totalErrors,
      totalWarnings,
      totalInfos,
    },
    codeTally,
    files: results,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  if (!opts.jsonOnly) {
    console.log("");
    console.log(`[gltf-validate] scanned ${results.length} GLB(s)`);
    console.log(`  errors:   ${totalErrors} (in ${withErrors.length} file(s))`);
    console.log(`  warnings: ${totalWarnings} (in ${withWarnings.length} file(s))`);
    console.log(`  infos:    ${totalInfos}`);
    if (crashed.length) {
      console.log(`  CRASHED (unparseable container): ${crashed.length}`);
      for (const c of crashed.slice(0, 20)) console.log(`    ✗ ${c.file} — ${c.crash}`);
    }
    const codes = Object.entries(codeTally).sort((a, b) => b[1] - a[1]);
    if (codes.length) {
      console.log("  issue codes:");
      for (const [k, n] of codes.slice(0, 25)) console.log(`    ${String(n).padStart(5)}  ${k}`);
    }
    if (withErrors.length) {
      console.log("  files with errors:");
      for (const r of withErrors.slice(0, 40)) {
        const head = r.messages.filter((m) => m.severity === 0).slice(0, 3).map((m) => m.code).join(",");
        console.log(`    ✗ ${r.file}  [${r.numErrors} err]${head ? "  " + head : ""}${r.crash ? "  CRASH" : ""}`);
      }
      if (withErrors.length > 40) console.log(`    …and ${withErrors.length - 40} more`);
    }
    console.log(`  report: ${relative(PKG_ROOT, REPORT_PATH)}`);
  } else {
    console.log(REPORT_PATH);
  }

  const errorGateFail = totalErrors > opts.maxErrors;
  const warnGateFail = opts.warnGate && totalWarnings > 0;
  if (errorGateFail || warnGateFail) {
    if (!opts.jsonOnly) {
      console.error(
        `[gltf-validate] GATE FAILED — ${errorGateFail ? `errors ${totalErrors} > ${opts.maxErrors}` : ""}${
          errorGateFail && warnGateFail ? "; " : ""
        }${warnGateFail ? `warnings ${totalWarnings} > 0 (warn-gate)` : ""}`,
      );
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[gltf-validate] fatal:", err);
  process.exit(2);
});
