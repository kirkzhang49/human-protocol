import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const routeDir = path.join(repoRoot, "src/assets/gui/route-switch");
const source = path.join(routeDir, "image2-sources/route_switch_output_rack_image2_source_v1.png");
const out = path.join(routeDir, "route_switch_output_rack_image2_v1.png");
const regionsOut = path.join(routeDir, "route_switch_output_rack_image2_v1.regions.json");

const atlasSize = [1160, 450];
const rackRegion = [40, 30, 1080, 390];
const blackKeyThreshold = 34;

async function keyOuterBlack(imagePath) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const background = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const qx = new Int32Array(width * height);
  const qy = new Int32Array(width * height);

  const isKey = (x, y) => {
    const offset = (y * width + x) * channels;
    return Math.max(data[offset], data[offset + 1], data[offset + 2]) <= blackKeyThreshold;
  };

  let head = 0;
  let tail = 0;
  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index] || !isKey(x, y)) return;
    visited[index] = 1;
    background[index] = 1;
    qx[tail] = x;
    qy[tail] = y;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    head += 1;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * channels;
      if (background[index]) data[offset + 3] = 0;
      if (data[offset + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const pad = 8;
  const crop = {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width, maxX + pad + 1) - Math.max(0, minX - pad),
    height: Math.min(height, maxY + pad + 1) - Math.max(0, minY - pad),
  };

  return sharp(data, { raw: { width, height, channels } }).extract(crop).png().toBuffer();
}

const rack = await sharp(await keyOuterBlack(source))
  .resize({ width: rackRegion[2], height: rackRegion[3], fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .modulate({ saturation: 0.92, brightness: 0.72 })
  .linear(1.16, -12)
  .sharpen({ sigma: 0.8, m1: 0.5, m2: 1.1 })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: atlasSize[0],
    height: atlasSize[1],
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: rack, left: rackRegion[0], top: rackRegion[1] }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(out);

await fs.writeFile(
  regionsOut,
  `${JSON.stringify(
    {
      atlasSize,
      source: "src/assets/gui/route-switch/image2-sources/route_switch_output_rack_image2_source_v1.png",
      sourcePolicy:
        "Owned generated Image2 output-rack source. Cutter keys only the flood-connected black exterior to transparency, preserving the black recessed socket cavities, then packs one shared four-slot rack for the route switch deck.",
      license: "owned-generated-output",
      regions: {
        output_rack: rackRegion,
      },
      notes:
        "Runtime places this shared Image2 rack behind the individual rotary selector modules so the four outputs read as one integrated route-control console, not separate buttons. No text, labels, or CSS-drawn symbols are baked into the asset.",
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${path.relative(repoRoot, out)}`);
console.log(`wrote ${path.relative(repoRoot, regionsOut)}`);
