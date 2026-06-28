import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const routeDir = path.join(repoRoot, "src/assets/gui/route-switch");
const source = path.join(routeDir, "image2-sources/route_switch_icon_language_image2_source_v1.png");
const targetSource = path.join(routeDir, "image2-sources/route_switch_target_badges_ancient_image2_source_v1.png");
const out = path.join(routeDir, "route_switch_icon_language_image2_v1.png");
const regionsOut = path.join(routeDir, "route_switch_icon_language_image2_v1.regions.json");

const atlasSize = [1024, 768];
const blackKeyThreshold = 78;

const sourceRegions = {
  title_archive_router: [18, 72, 520, 330],
  auth_authorized: [870, 430, 350, 370],
  auth_locked: [65, 845, 355, 345],
  footer_branch: [470, 845, 350, 350],
  auth_denied: [850, 840, 380, 355],
};

const targetSourceRegions = {
  icon_door: [50, 48, 555, 555],
  icon_terminal: [650, 48, 555, 555],
  icon_robot: [50, 650, 555, 555],
  icon_gate: [650, 650, 555, 555],
};

const outputs = [
  { name: "title_archive_router", sheet: "legacy", src: "title_archive_router", left: 24, top: 24, width: 360, height: 220, drawWidth: 330, drawHeight: 198 },
  { name: "icon_door", sheet: "target", src: "icon_door", left: 416, top: 24, width: 156, height: 156, drawWidth: 154, drawHeight: 154, tone: "ancientTarget" },
  { name: "icon_terminal", sheet: "target", src: "icon_terminal", left: 592, top: 24, width: 156, height: 156, drawWidth: 154, drawHeight: 154, tone: "ancientTarget" },
  { name: "icon_robot", sheet: "target", src: "icon_robot", left: 768, top: 24, width: 156, height: 156, drawWidth: 154, drawHeight: 154, tone: "ancientTarget" },
  { name: "icon_gate", sheet: "target", src: "icon_gate", left: 416, top: 208, width: 156, height: 156, drawWidth: 154, drawHeight: 154, tone: "ancientTarget" },
  { name: "auth_authorized", sheet: "legacy", src: "auth_authorized", left: 592, top: 208, width: 156, height: 156, drawWidth: 140, drawHeight: 140, tone: "auth" },
  { name: "auth_locked", sheet: "legacy", src: "auth_locked", left: 768, top: 208, width: 156, height: 156, drawWidth: 136, drawHeight: 136, tone: "locked" },
  { name: "footer_branch", sheet: "legacy", src: "footer_branch", left: 416, top: 392, width: 156, height: 156, drawWidth: 142, drawHeight: 142, tone: "target" },
  { name: "auth_denied", sheet: "legacy", src: "auth_denied", left: 592, top: 392, width: 156, height: 156, drawWidth: 140, drawHeight: 140, tone: "auth" },
];

async function cropTransparent(imagePath, region) {
  const { data, info } = await sharp(imagePath)
    .extract({ left: region[0], top: region[1], width: region[2], height: region[3] })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
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
  for (let i = 0; i < width * height; i += 1) {
    if (background[i]) data[i * channels + 3] = 0;
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function toneSprite(input, width, height, tone) {
  let core = sharp(input);
  if (tone === "ancientTarget") {
    core = core.modulate({ saturation: 1.08, brightness: 0.9 }).linear(1.18, -9).sharpen({ sigma: 0.8, m1: 0.55, m2: 1.15 });
  } else if (tone === "target") {
    core = core.modulate({ saturation: 1.24, brightness: 1.08 }).linear(1.16, -5).sharpen({ sigma: 0.75, m1: 0.55, m2: 1.12 });
  } else if (tone === "auth") {
    core = core.modulate({ saturation: 1.14, brightness: 1.08 }).linear(1.1, -4).sharpen({ sigma: 0.7, m1: 0.5, m2: 1.05 });
  } else if (tone === "locked") {
    core = core.modulate({ saturation: 0.72, brightness: 0.92 }).linear(1.08, -6).sharpen({ sigma: 0.65, m1: 0.45, m2: 0.95 });
  }
  const coreBuffer = await core.png().toBuffer();
  if (tone !== "target" && tone !== "ancientTarget") return coreBuffer;

  const glowBuffer = await sharp(coreBuffer)
    .modulate({ saturation: tone === "ancientTarget" ? 1.1 : 1.4, brightness: tone === "ancientTarget" ? 1.03 : 1.22 })
    .blur(tone === "ancientTarget" ? 1.6 : 2.8)
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: glowBuffer, left: 0, top: 0 },
      { input: coreBuffer, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

const composites = [];
const regions = {};

for (const output of outputs) {
  const drawWidth = output.drawWidth ?? output.width;
  const drawHeight = output.drawHeight ?? output.height;
  const imagePath = output.sheet === "target" ? targetSource : source;
  const sourceRegion = output.sheet === "target" ? targetSourceRegions[output.src] : sourceRegions[output.src];
  const resized = await sharp(await cropTransparent(imagePath, sourceRegion))
    .resize({ width: drawWidth, height: drawHeight, fit: "contain" })
    .png()
    .toBuffer();
  const input = await toneSprite(resized, drawWidth, drawHeight, output.tone);
  composites.push({
    input,
    left: output.left + Math.round((output.width - drawWidth) / 2),
    top: output.top + Math.round((output.height - drawHeight) / 2),
  });
  regions[output.name] = [output.left, output.top, output.width, output.height];
}

await sharp({
  create: {
    width: atlasSize[0],
    height: atlasSize[1],
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(out);

await fs.writeFile(
  regionsOut,
  `${JSON.stringify(
    {
      atlasSize,
      source: "src/assets/gui/route-switch/image2-sources/route_switch_icon_language_image2_source_v1.png",
      targetBadgeSource: "src/assets/gui/route-switch/image2-sources/route_switch_target_badges_ancient_image2_source_v1.png",
      sourcePolicy:
        "Composed from saved route-switch Image2 icon-language source pixels plus a dedicated ancient target-badge Image2 source. Local script crops, keys only edge-connected black background to transparency, preserves internal dark metal faces, applies a restrained material/visibility pass, resizes, packs PNG regions, and writes JSON. No text is baked.",
      license: "owned-generated-output",
      sourceRegions,
      targetSourceRegions,
      regions,
      notes:
        "Runtime uses Image2 icons to replace visible explanatory text: title emblem, output-kind symbols, authorization state, footer branch, and denied state. The four output-kind symbols are ancient brass/black-iron target medallions without blue line-dot language. React keeps hidden aria labels and state semantics.",
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${path.relative(repoRoot, out)}`);
console.log(`wrote ${path.relative(repoRoot, regionsOut)}`);
