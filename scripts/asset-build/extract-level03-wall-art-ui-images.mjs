import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, "src/assets/gui/museum-wall-art");

const wallArtGlbs = [
  {
    id: "human_origin",
    file: "src/assets/models-cooked/environment/level03/age_museum_wall_art_human_origin.glb",
  },
  {
    id: "robot_worker",
    file: "src/assets/models-cooked/environment/level03/age_museum_wall_art_robot_worker.glb",
  },
  {
    id: "last_human",
    file: "src/assets/models-cooked/environment/level03/age_museum_wall_art_last_human.glb",
  },
  {
    id: "protocol_diagram",
    file: "src/assets/models-cooked/environment/level03/age_museum_wall_art_protocol_diagram.glb",
  },
];

fs.mkdirSync(outputDir, { recursive: true });

for (const entry of wallArtGlbs) {
  const glbPath = path.join(repoRoot, entry.file);
  const image = extractFirstEmbeddedImage(glbPath);
  const extension = extensionForMime(image.mimeType);
  const outputPath = path.join(outputDir, `level03_${entry.id}${extension}`);
  fs.writeFileSync(outputPath, image.bytes);
  console.log(`wrote ${path.relative(repoRoot, outputPath)} (${image.name ?? image.mimeType})`);
}

function extractFirstEmbeddedImage(glbPath) {
  const glb = fs.readFileSync(glbPath);
  if (glb.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`${glbPath} is not a GLB file.`);
  }
  const chunks = readGlbChunks(glb);
  const jsonChunk = chunks.find((chunk) => chunk.type === "JSON");
  const binChunk = chunks.find((chunk) => chunk.type === "BIN\0");
  if (!jsonChunk || !binChunk) {
    throw new Error(`${glbPath} is missing JSON or BIN chunks.`);
  }
  const gltf = JSON.parse(glb.subarray(jsonChunk.start, jsonChunk.end).toString("utf8"));
  const image = gltf.images?.[0];
  if (!image?.bufferView || !image.mimeType) {
    throw new Error(`${glbPath} does not have an embedded bufferView image.`);
  }
  const view = gltf.bufferViews?.[image.bufferView];
  if (!view) {
    throw new Error(`${glbPath} image references missing bufferView ${image.bufferView}.`);
  }
  const start = binChunk.start + (view.byteOffset ?? 0);
  const end = start + view.byteLength;
  return {
    mimeType: image.mimeType,
    name: image.name,
    bytes: glb.subarray(start, end),
  };
}

function readGlbChunks(glb) {
  const chunks = [];
  let offset = 12;
  while (offset < glb.length) {
    const length = glb.readUInt32LE(offset);
    const type = glb.toString("utf8", offset + 4, offset + 8);
    const start = offset + 8;
    chunks.push({ type, start, end: start + length });
    offset = start + length;
  }
  return chunks;
}

function extensionForMime(mimeType) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  throw new Error(`Unsupported image mime type ${mimeType}.`);
}
