import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const routeDir = path.join(repoRoot, "src/assets/gui/route-switch");
const source = path.join(routeDir, "image2-sources/route_switch_rotary_controller_image2_source_v2.png");
const housingSource = path.join(routeDir, "image2-sources/route_switch_integrated_output_module_image2_source_v1.png");
const out = path.join(routeDir, "route_switch_output_rotary_buttons_image2_v1.png");
const regionsOut = path.join(routeDir, "route_switch_output_rotary_buttons_image2_v1.regions.json");

const atlasSize = [1472, 640];
const cell = { width: 184, height: 288 };
const gap = 24;
const rowGap = 28;
const blackKeyThreshold = 16;

const sourceRegions = {
  module_housing: [214, 12, 380, 586],
  knob_enabled: [35, 20, 270, 270],
  knob_disabled: [35, 585, 270, 270],
  knob_selected: [35, 300, 270, 270],
  knob_selected_r0: [35, 300, 270, 270],
  knob_selected_r1: [335, 300, 270, 270],
  knob_selected_r2: [635, 300, 270, 270],
  knob_selected_r3: [940, 300, 270, 270],
};

const states = [
  { name: "button_enabled", knob: "knob_enabled", angle: 0, tone: "enabled" },
  { name: "button_disabled", knob: "knob_disabled", angle: 0, tone: "disabled" },
  { name: "button_selected", knob: "knob_selected", angle: 0, tone: "selected" },
  { name: "button_rotating_0", knob: "knob_selected_r0", tone: "selected" },
  { name: "button_rotating_1", knob: "knob_selected_r1", tone: "selected" },
  { name: "button_rotating_2", knob: "knob_selected_r2", tone: "selected" },
  { name: "button_rotating_3", knob: "knob_selected_r3", tone: "selected" },
];

function cellPosition(index) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    left: gap + col * (cell.width + gap),
    top: gap + row * (cell.height + rowGap),
  };
}

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

function deepMaterialPass(img, tone) {
  if (tone === "disabled") {
    return img
      .modulate({ saturation: 0.16, brightness: 0.56 })
      .linear(1.18, -8)
      .sharpen({ sigma: 0.75, m1: 0.45, m2: 1.05 });
  }
  if (tone === "selected") {
    return img
      .modulate({ saturation: 1.18, brightness: 0.78 })
      .linear(1.2, -12)
      .sharpen({ sigma: 0.85, m1: 0.55, m2: 1.2 });
  }
  return img
    .modulate({ saturation: 1.12, brightness: 0.72 })
    .linear(1.22, -14)
    .sharpen({ sigma: 0.85, m1: 0.55, m2: 1.2 });
}

async function makeKnob(region, _angle, tone) {
  const img = sharp(await cropTransparent(source, region)).resize({ width: 128, height: 128, fit: "contain" });
  return deepMaterialPass(img, tone).png().toBuffer();
}

async function makeHousing() {
  return sharp(await cropTransparent(housingSource, sourceRegions.module_housing))
    .resize({ width: cell.width, height: cell.height, fit: "contain" })
    .modulate({ saturation: 0.94, brightness: 0.74 })
    .linear(1.14, -10)
    .sharpen({ sigma: 0.75, m1: 0.45, m2: 1.05 })
    .png()
    .toBuffer();
}

async function makeButton({ knob, angle, tone }) {
  const knobBuffer = await makeKnob(sourceRegions[knob], angle, tone);
  const housingBuffer = await makeHousing();

  return sharp({
    create: {
      width: cell.width,
      height: cell.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: housingBuffer, left: 0, top: 0 },
      { input: knobBuffer, left: 28, top: 25 },
    ])
    .png()
    .toBuffer();
}

const composites = [];
const regions = {};

for (let i = 0; i < states.length; i += 1) {
  const state = states[i];
  const pos = cellPosition(i);
  composites.push({ input: await makeButton(state), left: pos.left, top: pos.top });
  regions[state.name] = [pos.left, pos.top, cell.width, cell.height];
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
      source: "src/assets/gui/route-switch/image2-sources/route_switch_rotary_controller_image2_source_v2.png",
      housingSource: "src/assets/gui/route-switch/image2-sources/route_switch_integrated_output_module_image2_source_v1.png",
      sourcePolicy:
        "Composed from saved route-switch Image2 rotary controller source pixels plus an integrated output-module Image2 housing. Local script crops, keys the flat black background to transparency, resizes source-painted knob animation frames, composites them into the housing, packs PNG regions, and writes JSON. The rejected long nameplate cut is intentionally not packed; runtime target meaning is carried by separate cut Image2 ancient badges seated in the housing. No text is baked.",
      license: "owned-generated-output",
      sourceRegions,
      regions,
      notes:
        "Runtime uses Image2-backed integrated selector modules: a unified ancient output-module housing, source-painted knob states, and four source-painted rotating knob frames from Image2. The cutter applies a dark material pass so the rotary controls read as deeper smoked metal while retaining cyan/amber light rings. React layers cut Image2 ancient target badges from route_switch_icon_language_image2_v1 into the lower housing seat, while keeping hidden aria labels.",
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${path.relative(repoRoot, out)}`);
console.log(`wrote ${path.relative(repoRoot, regionsOut)}`);
