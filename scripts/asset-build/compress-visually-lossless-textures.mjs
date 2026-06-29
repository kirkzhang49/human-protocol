#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  acceptTextureCandidate,
  measureRgbaDelta,
  parseTextureCompressionArgs,
  planTextureCompression,
} from "./visually-lossless-textures-lib.mjs";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(scriptPath).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export async function main(args = process.argv.slice(2)) {
  const options = parseTextureCompressionArgs(args);
  if (options.help) {
    printHelp();
    return;
  }

  const mode = options.write ? "write" : options.audit ? "audit" : "dry-run";
  const allFiles = await collectInputFiles(options.roots);
  const planned = [];
  const skipped = [];

  for (const file of allFiles.sort((a, b) => b.sizeBytes - a.sizeBytes)) {
    const plan = planTextureCompression(file.relativePath, { sizeBytes: file.sizeBytes }, options);
    if (plan.action === "skip") {
      skipped.push({ ...plan, sizeBytes: file.sizeBytes });
      continue;
    }

    const outputAbs = path.resolve(projectRoot, plan.outputPath);
    if (options.write && !options.overwrite && existsSync(outputAbs)) {
      skipped.push({ action: "skip", inputPath: plan.inputPath, outputPath: plan.outputPath, reason: "output-exists" });
      continue;
    }

    planned.push({ ...plan, absolutePath: file.absolutePath, sizeBytes: file.sizeBytes });
    if (planned.length >= options.maxFiles) break;
  }

  const files = mode === "dry-run" ? dryRunResults(planned) : await encodeCandidates(planned, options);
  const report = buildReport({ mode, options, files, skipped, scannedFiles: allFiles.length });
  const reportAbs = path.resolve(projectRoot, options.reportPath);
  mkdirSync(path.dirname(reportAbs), { recursive: true });
  await writeFile(reportAbs, `${JSON.stringify(report, null, 2)}\n`);

  printSummary(report);
}

async function collectInputFiles(roots) {
  const files = [];
  for (const root of roots) {
    const absoluteRoot = path.resolve(projectRoot, root);
    if (!existsSync(absoluteRoot)) continue;
    await collectFilesRecursive(absoluteRoot, files);
  }
  return files;
}

async function collectFilesRecursive(dir, files) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFilesRecursive(absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(absolutePath);
    files.push({
      absolutePath,
      relativePath: toProjectRelative(absolutePath),
      sizeBytes: info.size,
    });
  }
}

function dryRunResults(planned) {
  return planned.map((plan) => ({
    inputPath: plan.inputPath,
    outputPath: plan.outputPath,
    kind: plan.kind,
    action: "planned",
    beforeBytes: plan.sizeBytes,
    encoder: plan.encoder,
    thresholds: plan.thresholds,
  }));
}

async function encodeCandidates(planned, options) {
  const sharp = await importSharp();
  const files = [];
  for (const plan of planned) {
    const outputAbs = path.resolve(projectRoot, plan.outputPath);
    const encoded = await encodeWebpCandidate(sharp, plan.absolutePath, plan.encoder);
    const metrics = await compareDecodedRgba(sharp, plan.absolutePath, encoded.buffer);
    const acceptance = acceptTextureCandidate({
      beforeBytes: plan.sizeBytes,
      afterBytes: encoded.buffer.byteLength,
      metrics,
      thresholds: plan.thresholds,
    });

    const result = {
      inputPath: plan.inputPath,
      outputPath: plan.outputPath,
      kind: plan.kind,
      action: acceptance.accepted ? (options.write ? "written" : "accepted") : "rejected",
      beforeBytes: plan.sizeBytes,
      afterBytes: encoded.buffer.byteLength,
      encoder: plan.encoder,
      metrics,
      ...acceptance,
    };

    if (acceptance.accepted && options.write) {
      mkdirSync(path.dirname(outputAbs), { recursive: true });
      await writeFile(outputAbs, encoded.buffer);
    }

    files.push(result);
    const label = result.action.padEnd(8);
    const saved = `${(acceptance.savedRatio * 100).toFixed(1)}%`;
    console.log(`${label} ${saved.padStart(6)} ${plan.inputPath}`);
  }
  return files;
}

async function importSharp() {
  try {
    const module = await import("sharp");
    return module.default ?? module;
  } catch (error) {
    throw new Error("The visually-lossless texture encoder needs the dev dependency `sharp`. Run `npm install` first.", {
      cause: error,
    });
  }
}

async function encodeWebpCandidate(sharp, inputPath, encoder) {
  const buffer = await sharp(inputPath, { animated: false })
    .webp({
      quality: encoder.quality,
      effort: encoder.effort,
      lossless: encoder.lossless,
      nearLossless: encoder.nearLossless,
      alphaQuality: 100,
      smartSubsample: true,
    })
    .toBuffer();
  return { buffer };
}

async function compareDecodedRgba(sharp, inputPath, candidateBuffer) {
  const original = await sharp(inputPath, { animated: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const candidate = await sharp(candidateBuffer, { animated: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sameShape =
    original.info.width === candidate.info.width &&
    original.info.height === candidate.info.height &&
    original.info.channels === candidate.info.channels;
  if (!sameShape) {
    throw new Error(
      `Decoded texture shape changed for ${toProjectRelative(inputPath)}: ` +
        `${original.info.width}x${original.info.height}x${original.info.channels} -> ` +
        `${candidate.info.width}x${candidate.info.height}x${candidate.info.channels}`,
    );
  }
  return measureRgbaDelta(original.data, candidate.data);
}

function buildReport({ mode, options, files, skipped, scannedFiles }) {
  const totals = files.reduce(
    (sum, file) => {
      const accepted = file.accepted === true || file.action === "planned";
      return {
        beforeBytes: sum.beforeBytes + (file.beforeBytes ?? 0),
        afterBytes: sum.afterBytes + (file.afterBytes ?? 0),
        plannedFiles: sum.plannedFiles + (file.action === "planned" ? 1 : 0),
        acceptedFiles: sum.acceptedFiles + (accepted && file.action !== "planned" ? 1 : 0),
        rejectedFiles: sum.rejectedFiles + (file.action === "rejected" ? 1 : 0),
        writtenFiles: sum.writtenFiles + (file.action === "written" ? 1 : 0),
      };
    },
    { beforeBytes: 0, afterBytes: 0, plannedFiles: 0, acceptedFiles: 0, rejectedFiles: 0, writtenFiles: 0 },
  );
  const savedBytes = totals.afterBytes > 0 ? totals.beforeBytes - totals.afterBytes : 0;

  return {
    generatedAt: new Date().toISOString(),
    mode,
    reportPath: options.reportPath,
    roots: options.roots,
    write: options.write,
    audit: options.audit,
    overwrite: options.overwrite,
    includeSourceArchives: options.includeSourceArchives,
    force: options.force,
    maxFiles: Number.isFinite(options.maxFiles) ? options.maxFiles : null,
    scannedFiles,
    skippedFiles: skipped.length,
    ...totals,
    savedBytes,
    savedRatio: totals.beforeBytes > 0 && totals.afterBytes > 0 ? savedBytes / totals.beforeBytes : null,
    files,
    skipped,
  };
}

function printSummary(report) {
  console.log(
    [
      `Texture compression ${report.mode}: scanned ${report.scannedFiles}, planned ${report.plannedFiles}, accepted ${report.acceptedFiles}, rejected ${report.rejectedFiles}, written ${report.writtenFiles}.`,
      report.savedRatio === null ? null : `Measured savings: ${(report.savedRatio * 100).toFixed(1)}%.`,
      `Report: ${report.reportPath}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function printHelp() {
  console.log(`Usage: node scripts/asset-build/compress-visually-lossless-textures.mjs [options]

Options:
  --write                    Write accepted .webp siblings.
  --audit                    Encode and measure candidates without keeping outputs.
  --overwrite                Allow --write to replace existing .webp siblings.
  --include-source-archives  Include image2/source archive folders.
  --force                    Include files below the default size floor.
  --root <path>              Root to scan. Repeat or comma-separate.
  --max-files <n>            Process at most n planned candidates.
  --report <path>            JSON report path.
`);
}

function toProjectRelative(absolutePath) {
  return path.relative(projectRoot, absolutePath).replaceAll("\\", "/");
}
