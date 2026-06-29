import path from "node:path";

export const DEFAULT_VISUAL_TEXTURE_POLICY = Object.freeze({
  minBytes: 64 * 1024,
  colorEncoder: Object.freeze({
    format: "webp",
    quality: 96,
    effort: 6,
    lossless: false,
    nearLossless: false,
  }),
  materialDataEncoder: Object.freeze({
    format: "webp",
    quality: 100,
    effort: 6,
    lossless: true,
    nearLossless: false,
  }),
  colorThresholds: Object.freeze({
    minSavedRatio: 0.08,
    maxMeanAbsoluteError: 1.25,
    maxAbsoluteError: 28,
    maxChangedPixelRatio: 1,
    maxAlphaAbsoluteError: 0,
  }),
  losslessThresholds: Object.freeze({
    minSavedRatio: 0.02,
    maxMeanAbsoluteError: 0,
    maxAbsoluteError: 0,
    maxChangedPixelRatio: 0,
    maxAlphaAbsoluteError: 0,
  }),
});

const supportedInputExtensions = new Set([".png", ".jpg", ".jpeg"]);
const sourceArchiveSegments = new Set([
  "_source-hdri",
  "image2-generated-sources",
  "image2-sources",
  "incoming",
  "source-original",
  "source-roomfit",
]);

const materialDataPattern =
  /(^|[_\-.])(ao|arm|bump|displacement|gloss|height|mask|metal|metallic|normal|orm|packed|rough|roughness|specular)([_\-.]|$)/i;

const defaultRoots = ["src/assets/textures/environment", "src/assets/gui", "src/assets/environment"];
const defaultReportPath = "src/assets/manifests/reports/visually_lossless_texture_compression_report.json";

export function normalizeAssetPath(value) {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

export function classifyTexturePath(inputPath) {
  const normalized = normalizeAssetPath(inputPath);
  const filename = path.posix.basename(normalized);
  return materialDataPattern.test(filename) ? "material-data" : "color";
}

export function isSourceArchivePath(inputPath) {
  const segments = normalizeAssetPath(inputPath).split("/");
  return segments.some((segment) => sourceArchiveSegments.has(segment));
}

export function planTextureCompression(inputPath, metadata = {}, options = {}) {
  const normalized = normalizeAssetPath(inputPath);
  const ext = path.posix.extname(normalized).toLowerCase();
  const policy = options.policy ?? DEFAULT_VISUAL_TEXTURE_POLICY;

  if (!supportedInputExtensions.has(ext)) {
    return skipPlan(normalized, "unsupported-extension");
  }

  if (!options.includeSourceArchives && isSourceArchivePath(normalized)) {
    return skipPlan(normalized, "source-archive");
  }

  if (!options.force && Number.isFinite(metadata.sizeBytes) && metadata.sizeBytes < policy.minBytes) {
    return skipPlan(normalized, "below-min-bytes");
  }

  const kind = classifyTexturePath(normalized);
  const stem = normalized.slice(0, -ext.length);

  return {
    action: "compress",
    inputPath: normalized,
    outputPath: `${stem}.webp`,
    kind,
    preserveDimensions: true,
    encoder: kind === "material-data" ? policy.materialDataEncoder : policy.colorEncoder,
    thresholds: kind === "material-data" ? policy.losslessThresholds : policy.colorThresholds,
  };
}

export function acceptTextureCandidate({ beforeBytes, afterBytes, metrics, thresholds }) {
  const savedBytes = beforeBytes - afterBytes;
  const savedRatio = beforeBytes > 0 ? savedBytes / beforeBytes : 0;
  const base = {
    savedBytes,
    savedRatio,
  };

  if (savedBytes <= 0 || savedRatio < thresholds.minSavedRatio) {
    return { accepted: false, reason: "savings-too-small", ...base };
  }

  if ((metrics.alphaMaxAbsoluteError ?? 0) > thresholds.maxAlphaAbsoluteError) {
    return { accepted: false, reason: "alpha-changed", ...base };
  }

  if (
    (metrics.meanAbsoluteError ?? 0) > thresholds.maxMeanAbsoluteError ||
    (metrics.maxAbsoluteError ?? 0) > thresholds.maxAbsoluteError ||
    (metrics.changedPixelRatio ?? 0) > thresholds.maxChangedPixelRatio
  ) {
    return { accepted: false, reason: "pixel-error-too-high", ...base };
  }

  return { accepted: true, ...base };
}

export function measureRgbaDelta(original, candidate) {
  if (original.byteLength !== candidate.byteLength) {
    throw new Error(`Decoded RGBA buffers differ in length: ${original.byteLength} !== ${candidate.byteLength}`);
  }
  if (original.byteLength % 4 !== 0) {
    throw new Error(`Decoded RGBA buffer length must be divisible by 4: ${original.byteLength}`);
  }

  let rgbErrorTotal = 0;
  let maxAbsoluteError = 0;
  let alphaMaxAbsoluteError = 0;
  let changedPixels = 0;
  const totalPixels = original.byteLength / 4;

  for (let index = 0; index < original.byteLength; index += 4) {
    let pixelChanged = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const error = Math.abs(original[index + channel] - candidate[index + channel]);
      rgbErrorTotal += error;
      maxAbsoluteError = Math.max(maxAbsoluteError, error);
      pixelChanged ||= error > 0;
    }

    const alphaError = Math.abs(original[index + 3] - candidate[index + 3]);
    alphaMaxAbsoluteError = Math.max(alphaMaxAbsoluteError, alphaError);
    pixelChanged ||= alphaError > 0;
    if (pixelChanged) changedPixels += 1;
  }

  return {
    totalPixels,
    meanAbsoluteError: totalPixels > 0 ? rgbErrorTotal / (totalPixels * 3) : 0,
    maxAbsoluteError,
    alphaMaxAbsoluteError,
    changedPixelRatio: totalPixels > 0 ? changedPixels / totalPixels : 0,
  };
}

export function parseTextureCompressionArgs(args = process.argv.slice(2)) {
  const roots = [];
  const options = {
    write: false,
    audit: false,
    overwrite: false,
    includeSourceArchives: false,
    force: false,
    maxFiles: Number.POSITIVE_INFINITY,
    reportPath: defaultReportPath,
    roots,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--audit") {
      options.audit = true;
    } else if (arg === "--overwrite") {
      options.overwrite = true;
    } else if (arg === "--include-source-archives") {
      options.includeSourceArchives = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--root=")) {
      pushRootValues(roots, arg.slice("--root=".length));
    } else if (arg === "--root") {
      index += 1;
      pushRootValues(roots, args[index] ?? "");
    } else if (arg.startsWith("--max-files=")) {
      options.maxFiles = parsePositiveInteger(arg.slice("--max-files=".length), "--max-files");
    } else if (arg === "--max-files") {
      index += 1;
      options.maxFiles = parsePositiveInteger(args[index], "--max-files");
    } else if (arg.startsWith("--report=")) {
      options.reportPath = normalizeAssetPath(arg.slice("--report=".length));
    } else if (arg === "--report") {
      index += 1;
      options.reportPath = normalizeAssetPath(args[index] ?? "");
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (roots.length === 0) {
    roots.push(...defaultRoots);
  }

  return options;
}

function skipPlan(inputPath, reason) {
  return {
    action: "skip",
    inputPath,
    reason,
  };
}

function pushRootValues(roots, value) {
  for (const raw of String(value).split(",")) {
    const normalized = normalizeAssetPath(raw.trim());
    if (normalized) roots.push(normalized);
  }
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}
