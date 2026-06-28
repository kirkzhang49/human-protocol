import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;

const repoRoot = process.cwd();
const jobs = parseJobs(process.argv.slice(2));

for (const job of jobs) {
  const result = await tuneGlb(path.join(repoRoot, job.input), path.join(repoRoot, job.output));
  console.log(`${job.output}: tuned ${result.materials} materials, ${result.bytes} bytes`);
}

function parseJobs(args) {
  if (args[0] === "--in-place") {
    return args.slice(1).map((file) => ({ input: file, output: file }));
  }

  if (args[0] === "--pair" && args.length === 3) {
    return [{ input: args[1], output: args[2] }];
  }

  if (args.length > 0) {
    throw new Error("Usage: node scripts/optimizer/tune-viewmodel-wgpu-aged-materials.mjs [--in-place file.glb ...] [--pair input.glb output.glb]");
  }

  return [
    {
      input: "src/assets/models/viewmodel/hp_viewmodel_iron_rod_wgpu_compact.glb",
      output: "src/assets/models/viewmodel/hp_viewmodel_iron_rod_wgpu_aged.glb",
    },
    {
      input: "src/assets/models/viewmodel/hp_viewmodel_sidearm_wgpu_compact.glb",
      output: "src/assets/models/viewmodel/hp_viewmodel_sidearm_wgpu_aged.glb",
    },
  ];
}

async function tuneGlb(inputPath, outputPath) {
  const input = await readFile(inputPath);
  const { json, chunks } = parseGlb(input);
  let materialCount = 0;

  for (const material of json.materials ?? []) {
    const profile = agedProfile(material.name ?? "");
    if (!profile) continue;
    materialCount += 1;

    material.pbrMetallicRoughness ??= {};
    material.pbrMetallicRoughness.baseColorFactor = profile.baseColorFactor;
    material.pbrMetallicRoughness.metallicFactor = profile.metallicFactor;
    material.pbrMetallicRoughness.roughnessFactor = profile.roughnessFactor;

    if (profile.emissiveFactor) {
      material.emissiveFactor = profile.emissiveFactor;
    } else {
      delete material.emissiveFactor;
    }

    if (material.normalTexture) {
      material.normalTexture.scale = profile.normalScale;
    }

    material.extras = {
      ...(material.extras ?? {}),
      hpAgedViewmodelMaterial: profile.slot,
    };
  }

  const unmappedTextures = dropBaseColorTexturesFromUnmappedMaterials(json);

  const output = writeGlb(json, chunks);
  await writeFile(outputPath, output);
  return { materials: materialCount, unmappedTextures, bytes: output.byteLength };
}

function dropBaseColorTexturesFromUnmappedMaterials(json) {
  const materialsWithoutUv = new Set();
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (typeof primitive.material !== "number") continue;
      if (primitive.attributes?.TEXCOORD_0 === undefined) {
        materialsWithoutUv.add(primitive.material);
      }
    }
  }

  let dropCount = 0;
  for (const materialIndex of materialsWithoutUv) {
    const pbr = json.materials?.[materialIndex]?.pbrMetallicRoughness;
    if (pbr?.baseColorTexture) {
      delete pbr.baseColorTexture;
      dropCount += 1;
    }
  }

  return dropCount;
}

function agedProfile(name) {
  const key = name.toLowerCase();

  if (/hero|scraped|highlight|bright/.test(key)) {
    return {
      slot: "scraped-hero-steel-edge",
      baseColorFactor: [0.9, 0.96, 0.9, 1],
      emissiveFactor: [0.012, 0.018, 0.014],
      metallicFactor: 0.98,
      normalScale: 1.22,
      roughnessFactor: 0.34,
    };
  }

  if (/cyan|glass|energy|lens|window|muzzle/.test(key)) {
    return {
      slot: "smoked-cyan-glass",
      baseColorFactor: [0.48, 0.82, 0.82, 1],
      emissiveFactor: [0.0, 0.055, 0.065],
      metallicFactor: 0.18,
      normalScale: 0.7,
      roughnessFactor: 0.44,
    };
  }

  if (/bronze|copper|amber|inlay|trigger|rail/.test(key)) {
    return {
      slot: "oiled-bronze-highlight",
      baseColorFactor: [0.84, 0.59, 0.31, 1],
      emissiveFactor: [0.018, 0.01, 0.002],
      metallicFactor: 0.94,
      normalScale: 1.08,
      roughnessFactor: 0.52,
    };
  }

  if (/black|wrap|grip|rubber|leather/.test(key)) {
    return {
      slot: "worn-black-wrap",
      baseColorFactor: [0.34, 0.38, 0.36, 1],
      metallicFactor: 0.58,
      normalScale: 1.18,
      roughnessFactor: 0.82,
    };
  }

  if (/shadow|dark|shaft|core|cut/.test(key)) {
    return {
      slot: "oxidized-dark-metal",
      baseColorFactor: [0.25, 0.33, 0.32, 1],
      metallicFactor: 0.9,
      normalScale: 1.16,
      roughnessFactor: 0.72,
    };
  }

  if (/battered|edge|steel|titanium|panel|slide|cap|ring|receiver|plate/.test(key)) {
    return {
      slot: "bruised-titanium-steel",
      baseColorFactor: [0.8, 0.86, 0.8, 1],
      emissiveFactor: [0.006, 0.01, 0.007],
      metallicFactor: 0.98,
      normalScale: 1.12,
      roughnessFactor: 0.44,
    };
  }

  return {
    slot: "neutral-aged-metal",
    baseColorFactor: [0.6, 0.64, 0.6, 1],
    metallicFactor: 0.82,
    normalScale: 1.05,
    roughnessFactor: 0.66,
  };
}

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("Input is not a GLB file.");
  }

  const chunks = [];
  let json = null;
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) {
      json = JSON.parse(data.toString("utf8").trimEnd());
    } else {
      chunks.push({ type, data });
    }
    offset += 8 + length;
  }

  if (!json) throw new Error("GLB file does not contain a JSON chunk.");
  return { json, chunks };
}

function writeGlb(json, chunks) {
  const jsonBuffer = padBuffer(Buffer.from(JSON.stringify(json), "utf8"), 0x20);
  const chunkBuffers = [
    chunkHeader(jsonBuffer.byteLength, CHUNK_JSON),
    jsonBuffer,
    ...chunks.flatMap((chunk) => [chunkHeader(chunk.data.byteLength, chunk.type), chunk.data]),
  ];
  const totalLength = 12 + chunkBuffers.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  return Buffer.concat([header, ...chunkBuffers], totalLength);
}

function chunkHeader(length, type) {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(length, 0);
  header.writeUInt32LE(type, 4);
  return header;
}

function padBuffer(buffer, padByte) {
  const paddedLength = Math.ceil(buffer.byteLength / 4) * 4;
  if (paddedLength === buffer.byteLength) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(paddedLength - buffer.byteLength, padByte)], paddedLength);
}
