import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_INPUT_DIR = path.join(ROOT, "src/assets/textures/environment/hero-floors/image2/incoming");
const BASE_OUT_DIR = path.join(ROOT, "src/assets/textures/environment/hero-floors/image2");
const ORIGINAL_DIR = path.join(BASE_OUT_DIR, "source-original");
const ROOMFIT_DIR = path.join(BASE_OUT_DIR, "source-roomfit");
const RUNTIME_DIR = path.join(BASE_OUT_DIR, "runtime");
const REVIEW_DIR = path.join(BASE_OUT_DIR, "review");
const MANIFEST_PATH = path.join(ROOT, "src/assets/manifests/runtime/human_protocol_hero_floor_image2_ingested_manifest.json");

const specs = [
  {
    level: "level01",
    id: "level01_image2_full_room_maintenance_bay_floor",
    levelId: "level_01_maintenance_bay",
    roomId: "maintenance_bay_floor",
    roomMeters: [18, 25],
    roomfitFile: "level01_image2_full_room_maintenance_bay_floor_18x25.png",
    runtimeFile: "level01_image2_full_room_maintenance_bay_floor_18x25_runtime.webp",
  },
  {
    level: "level02",
    id: "level02_image2_full_room_false_residential_floor",
    levelId: "level_02_residential_simulation",
    roomId: "level_02_living_room",
    roomMeters: [18.8, 16.6],
    roomfitFile: "level02_image2_full_room_false_residential_floor_18p8x16p6.png",
    runtimeFile: "level02_image2_full_room_false_residential_floor_18p8x16p6_runtime.webp",
  },
  {
    level: "level03",
    id: "level03_image2_full_room_human_museum_gallery_floor",
    levelId: "level_03_human_museum",
    roomId: "level_03_gallery_lobby",
    roomMeters: [18, 12],
    roomfitFile: "level03_image2_full_room_human_museum_gallery_floor_18x12.png",
    runtimeFile: "level03_image2_full_room_human_museum_gallery_floor_18x12_runtime.webp",
  },
  {
    level: "level04",
    id: "level04_image2_full_room_memory_clinic_floor",
    levelId: "level_04_memory_clinic",
    roomId: "level_04_waiting_room",
    roomMeters: [16, 11],
    roomfitFile: "level04_image2_full_room_memory_clinic_floor_16x11.png",
    runtimeFile: "level04_image2_full_room_memory_clinic_floor_16x11_runtime.webp",
  },
  {
    level: "level05",
    id: "level05_image2_full_room_reclamation_core_floor",
    levelId: "level_05_reclamation_core",
    roomId: "level_05_platform",
    roomMeters: [18, 13],
    roomfitFile: "level05_image2_full_room_reclamation_core_floor_18x13.png",
    runtimeFile: "level05_image2_full_room_reclamation_core_floor_18x13_runtime.webp",
  },
];

const inputDir = path.resolve(getArg("--input-dir") ?? DEFAULT_INPUT_DIR);

await Promise.all([ORIGINAL_DIR, ROOMFIT_DIR, RUNTIME_DIR, REVIEW_DIR].map((dir) => fs.mkdir(dir, { recursive: true })));

const entries = [];
for (const spec of specs) {
  const inputPath = await findLevelSource(inputDir, spec.level);
  const metadata = await sharp(inputPath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Cannot read image size: ${inputPath}`);
  }

  const ext = path.extname(inputPath).toLowerCase() || ".png";
  const originalPath = path.join(ORIGINAL_DIR, `${spec.level}_image2_original${ext}`);
  await fs.copyFile(inputPath, originalPath);

  const crop = centerCropForAspect(metadata.width, metadata.height, spec.roomMeters[0] / spec.roomMeters[1]);
  const roomfitPath = path.join(ROOMFIT_DIR, spec.roomfitFile);
  await sharp(inputPath)
    .extract(crop)
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toFile(roomfitPath);

  const runtimeSize = runtimeDimensions(crop.width, crop.height, 2048);
  const runtimePath = path.join(RUNTIME_DIR, spec.runtimeFile);
  await sharp(roomfitPath)
    .resize(runtimeSize.width, runtimeSize.height, { fit: "fill" })
    .webp({ quality: 90, effort: 4 })
    .toFile(runtimePath);

  entries.push({
    id: spec.id,
    levelId: spec.levelId,
    roomId: spec.roomId,
    roomMeters: spec.roomMeters,
    targetAspect: round(spec.roomMeters[0] / spec.roomMeters[1], 6),
    originalPath: rel(originalPath),
    originalSizePx: [metadata.width, metadata.height],
    sourceRoomfitPath: rel(roomfitPath),
    sourceRoomfitSizePx: [crop.width, crop.height],
    runtimePath: rel(runtimePath),
    runtimeSizePx: [runtimeSize.width, runtimeSize.height],
    crop,
    qaNotes:
      "Image2 source ingested without stretching. Source-roomfit output uses center crop only to match the room footprint aspect ratio. Runtime WebP is preview/runtime-ready but is not wired into level config yet.",
  });
  console.log(`ingested ${spec.level}: ${metadata.width}x${metadata.height} -> ${crop.width}x${crop.height}`);
}

const contactSheetPath = path.join(REVIEW_DIR, "human_protocol_image2_floor_ingest_contact_sheet.jpg");
await writeContactSheet(entries, contactSheetPath);

await fs.writeFile(
  MANIFEST_PATH,
  `${JSON.stringify(
    {
      id: "human_protocol_hero_floor_image2_ingested_manifest",
      generatedAt: new Date().toISOString(),
      inputDir: rel(inputDir),
      sourcePolicy: "These are real image2 floor sources supplied in order by the user. The ingest crop is ratio-safe and never stretches pixels.",
      runtimePolicy: "Runtime WebP files are generated for later wiring. Final high-performance path should prefer KTX2/Basis when the floor planes are integrated.",
      contactSheet: rel(contactSheetPath),
      assets: entries,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      manifest: rel(MANIFEST_PATH),
      contactSheet: rel(contactSheetPath),
      assets: entries.map((entry) => ({
        id: entry.id,
        sourceRoomfit: entry.sourceRoomfitPath,
        sourceRoomfitSizePx: entry.sourceRoomfitSizePx,
        runtime: entry.runtimePath,
        runtimeSizePx: entry.runtimeSizePx,
      })),
    },
    null,
    2,
  ),
);

async function findLevelSource(dir, level) {
  const files = await fs.readdir(dir);
  const candidates = files
    .filter((file) => {
      const lower = file.toLowerCase();
      return (
        lower.startsWith(level) &&
        [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(lower))
      );
    })
    .sort();
  if (candidates.length === 0) {
    throw new Error(`Missing ${level} image. Put it in ${dir} as ${level}.png, ${level}.jpg, or ${level}_*.png`);
  }
  return path.join(dir, candidates[0]);
}

function centerCropForAspect(width, height, targetAspect) {
  const inputAspect = width / height;
  if (inputAspect > targetAspect) {
    const cropWidth = Math.round(height * targetAspect);
    return {
      left: Math.floor((width - cropWidth) / 2),
      top: 0,
      width: cropWidth,
      height,
    };
  }
  const cropHeight = Math.round(width / targetAspect);
  return {
    left: 0,
    top: Math.floor((height - cropHeight) / 2),
    width,
    height: cropHeight,
  };
}

function runtimeDimensions(width, height, longEdge) {
  if (width >= height) {
    const runtimeWidth = Math.min(width, longEdge);
    return { width: runtimeWidth, height: Math.round((height * runtimeWidth) / width) };
  }
  const runtimeHeight = Math.min(height, longEdge);
  return { width: Math.round((width * runtimeHeight) / height), height: runtimeHeight };
}

async function writeContactSheet(entries, outputPath) {
  const thumbH = 520;
  const gap = 20;
  const thumbs = await Promise.all(
    entries.map(async (entry) => {
      const source = path.join(ROOT, entry.sourceRoomfitPath);
      const metadata = await sharp(source).metadata();
      const width = Math.round((thumbH * metadata.width) / metadata.height);
      return {
        width,
        height: thumbH,
        buffer: await sharp(source).resize(width, thumbH).jpeg({ quality: 88 }).toBuffer(),
      };
    }),
  );
  const sheetWidth = thumbs.reduce((sum, thumb) => sum + thumb.width, gap * (thumbs.length + 1));
  const sheetHeight = thumbH + gap * 2;
  const composite = [];
  let left = gap;
  for (const thumb of thumbs) {
    composite.push({ input: thumb.buffer, left, top: gap });
    left += thumb.width + gap;
  }
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 3,
      background: "#050607",
    },
  })
    .composite(composite)
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
