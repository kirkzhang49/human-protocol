import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = join(root, "src/assets/models/environment/level02");
const outputDir = join(root, "src/assets/models-runtime/environment/level02");
const reportPath = join(root, "src/assets/manifests/reports/level02_runtime_lite_cooking_report.json");
const maxTextureSize = 768;
const jpegQuality = 80;
const jpegSafeAlphaMin = 240;

if (!existsSync(sourceDir)) {
  console.error(`Level 02 source model directory not found: ${sourceDir}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });

const inputs = (await readdir(sourceDir))
  .filter((name) => extname(name).toLowerCase() === ".glb")
  .map((name) => join(sourceDir, name))
  .sort();

const files = [];
for (const inputFile of inputs) {
  const outputFile = join(outputDir, basename(inputFile));
  const result = await cookRuntimeLiteGlb(inputFile, outputFile);
  files.push(result);
  console.log(`${basename(inputFile)} ${(result.beforeBytes / 1024).toFixed(1)}KB -> ${(result.afterBytes / 1024).toFixed(1)}KB`);
}

const totals = files.reduce(
  (sum, file) => ({
    beforeBytes: sum.beforeBytes + file.beforeBytes,
    afterBytes: sum.afterBytes + file.afterBytes,
    savedBytes: sum.savedBytes + file.savedBytes,
  }),
  { beforeBytes: 0, afterBytes: 0, savedBytes: 0 },
);

await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      schema: "human-protocol/level02-runtime-lite-cooking@1",
      generatedAt: new Date().toISOString(),
      sourceDir: relative(root, sourceDir),
      outputDir: relative(root, outputDir),
      policy: {
        geometryCompression: "none",
        blockedRuntimeExtensions: ["EXT_meshopt_compression", "EXT_texture_webp", "KHR_draco_mesh_compression"],
        texturePolicy: `PNG with alpha preserved; opaque PNG converted to JPEG q${jpegQuality}; max ${maxTextureSize}px`,
      },
      ...totals,
      savedRatio: totals.beforeBytes > 0 ? totals.savedBytes / totals.beforeBytes : 0,
      files,
    },
    null,
    2,
  )}\n`,
);
console.log(`Level 02 runtime-lite report written: ${relative(root, reportPath)}`);

async function cookRuntimeLiteGlb(inputFile, outputFile) {
  const source = readFileSync(inputFile);
  const { json, binary } = parseGlb(source);
  if ((json.buffers?.length ?? 0) !== 1) {
    throw new Error(`${basename(inputFile)} expected exactly one GLB buffer.`);
  }

  json.extensionsUsed = dropExtensions(json.extensionsUsed, ["EXT_meshopt_compression", "EXT_texture_webp", "KHR_draco_mesh_compression"]);
  json.extensionsRequired = dropExtensions(json.extensionsRequired, ["EXT_meshopt_compression", "EXT_texture_webp", "KHR_draco_mesh_compression"]);
  if (json.extensionsUsed?.length === 0) delete json.extensionsUsed;
  if (json.extensionsRequired?.length === 0) delete json.extensionsRequired;

  const replacements = new Map();
  const imageReports = [];
  for (const [index, image] of (json.images ?? []).entries()) {
    const bufferViewIndex = image.bufferView;
    if (typeof bufferViewIndex !== "number") continue;

    const view = json.bufferViews?.[bufferViewIndex];
    if (!view) throw new Error(`${basename(inputFile)} image ${index} references missing bufferView ${bufferViewIndex}.`);

    const before = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    let after = before;
    let outputMime = image.mimeType ?? "application/octet-stream";
    let converted = false;

    if (image.mimeType === "image/png") {
      const metadata = await sharp(before).metadata();
      const pipeline = sharp(before).resize({
        width: maxTextureSize,
        height: maxTextureSize,
        fit: "inside",
        withoutEnlargement: true,
      });
      const alphaRange = metadata.hasAlpha ? await readAlphaRange(before) : null;
      if (metadata.hasAlpha && (!alphaRange || alphaRange.min < jpegSafeAlphaMin)) {
        after = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
        outputMime = "image/png";
      } else {
        after = await pipeline.flatten({ background: "#000000" }).jpeg({ quality: jpegQuality, mozjpeg: true }).toBuffer();
        outputMime = "image/jpeg";
      }
      converted = true;
    }

    image.mimeType = outputMime;
    delete image.uri;
    replacements.set(bufferViewIndex, after);
    imageReports.push({
      image: image.name ?? `image_${index}`,
      beforeBytes: before.byteLength,
      afterBytes: after.byteLength,
      mimeType: outputMime,
      converted,
      alpha: image.mimeType === "image/png" ? await readAlphaRange(before) : null,
    });
  }

  for (const texture of json.textures ?? []) {
    if (texture.extensions?.EXT_texture_webp) {
      const webp = texture.extensions.EXT_texture_webp;
      texture.source = webp.source;
      delete texture.extensions.EXT_texture_webp;
      if (Object.keys(texture.extensions).length === 0) delete texture.extensions;
    }
  }

  const newBinary = repackBufferViews(json, binary, replacements);
  json.buffers[0].byteLength = newBinary.byteLength;

  const cooked = buildGlb(json, newBinary);
  writeFileSync(outputFile, cooked);

  const beforeBytes = statSync(inputFile).size;
  const afterBytes = statSync(outputFile).size;
  return {
    file: relative(root, inputFile),
    outputFile: relative(root, outputFile),
    beforeBytes,
    afterBytes,
    savedBytes: beforeBytes - afterBytes,
    savedRatio: beforeBytes > 0 ? (beforeBytes - afterBytes) / beforeBytes : 0,
    images: imageReports,
    extensionsUsed: json.extensionsUsed ?? [],
    extensionsRequired: json.extensionsRequired ?? [],
  };
}

function parseGlb(data) {
  if (data.toString("utf8", 0, 4) !== "glTF") throw new Error("Input is not a GLB.");
  const version = data.readUInt32LE(4);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}.`);

  const jsonLength = data.readUInt32LE(12);
  const jsonType = data.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error("GLB JSON chunk missing.");

  const jsonStart = 20;
  const json = JSON.parse(data.subarray(jsonStart, jsonStart + jsonLength).toString("utf8"));
  const binHeader = jsonStart + align4(jsonLength);
  const binLength = data.readUInt32LE(binHeader);
  const binType = data.readUInt32LE(binHeader + 4);
  if (binType !== 0x004e4942) throw new Error("GLB BIN chunk missing.");

  return {
    json,
    binary: data.subarray(binHeader + 8, binHeader + 8 + binLength),
  };
}

function repackBufferViews(json, binary, replacements) {
  const chunks = [];
  let byteOffset = 0;
  for (const [index, view] of json.bufferViews.entries()) {
    const source = replacements.get(index) ?? binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const padding = align4(source.byteLength) - source.byteLength;
    view.byteOffset = byteOffset;
    view.byteLength = source.byteLength;
    chunks.push(source, Buffer.alloc(padding));
    byteOffset += source.byteLength + padding;
  }
  return Buffer.concat(chunks);
}

function buildGlb(json, binary) {
  const jsonBuffer = Buffer.from(JSON.stringify(json));
  const jsonPadding = align4(jsonBuffer.byteLength) - jsonBuffer.byteLength;
  const paddedJson = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
  const binaryPadding = align4(binary.byteLength) - binary.byteLength;
  const paddedBinary = Buffer.concat([binary, Buffer.alloc(binaryPadding)]);

  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + paddedJson.byteLength + 8 + paddedBinary.byteLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.byteLength, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(paddedBinary.byteLength, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, paddedJson, binaryHeader, paddedBinary]);
}

function dropExtensions(extensions, blocked) {
  if (!Array.isArray(extensions)) return undefined;
  return extensions.filter((extension) => !blocked.includes(extension));
}

function align4(value) {
  return (value + 3) & ~3;
}

async function readAlphaRange(bytes) {
  const raw = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let min = 255;
  let max = 0;
  for (let index = 3; index < raw.data.length; index += 4) {
    const alpha = raw.data[index];
    min = Math.min(min, alpha);
    max = Math.max(max, alpha);
  }
  return { min, max };
}
