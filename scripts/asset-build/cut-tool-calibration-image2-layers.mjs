import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const toolDir = path.join(repoRoot, "src/assets/gui/tool-calibration");
const routeDir = path.join(repoRoot, "src/assets/gui/route-switch");
const toolSourcesDir = path.join(toolDir, "image2-sources");
const routeSourcesDir = path.join(routeDir, "image2-sources");

const toolSource = path.join(toolSourcesDir, "tool_calibration_hardware_modules_image2_source_v1.png");
const rodLayer = path.join(toolDir, "tool_calibration_clean_rod_image2_layer_v1.png");
const rodRegions = path.join(toolDir, "tool_calibration_clean_rod_image2_layer_v1.regions.json");
const moduleSheet = path.join(toolDir, "tool_calibration_modules_image2_cut_sheet_v1.png");
const moduleRegions = path.join(toolDir, "tool_calibration_modules_image2_cut_sheet_v1.regions.json");

await fs.mkdir(toolSourcesDir, { recursive: true });
await fs.mkdir(routeSourcesDir, { recursive: true });

async function makeRodLayer() {
  const centerCrop = await sharp(toolSource)
    .extract({ left: 560, top: 115, width: 480, height: 780 })
    .png()
    .toBuffer();
  const centerModule = await sharp(centerCrop)
    .rotate(90, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extract({ left: 0, top: 48, width: 780, height: 388 })
    .resize({ width: 1220, height: 560, fit: "inside" })
    .png()
    .toBuffer();

  const background = await sharp({
    create: {
      width: 1600,
      height: 1000,
      channels: 4,
      background: { r: 8, g: 10, b: 12, alpha: 255 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
            <defs>
              <radialGradient id="g" cx="50%" cy="50%" r="70%">
                <stop offset="0" stop-color="#233033" stop-opacity="0.86"/>
                <stop offset="0.48" stop-color="#0b1012" stop-opacity="0.96"/>
                <stop offset="1" stop-color="#020304" stop-opacity="1"/>
              </radialGradient>
            </defs>
            <rect width="1600" height="1000" fill="url(#g)"/>
            <rect x="130" y="210" width="1340" height="580" rx="46" fill="#050708" opacity="0.38" stroke="#2c3638" stroke-width="2"/>
            <path d="M180 760 H1420" stroke="#54f3ff" stroke-width="4" opacity="0.28"/>
            <path d="M260 238 H1340" stroke="#c79a54" stroke-width="3" opacity="0.22"/>
          </svg>`,
        ),
        left: 0,
        top: 0,
      },
      { input: centerModule, left: 190, top: 255 },
    ])
    .png()
    .toBuffer();

  await fs.writeFile(rodLayer, background);
  await fs.writeFile(
    rodRegions,
    `${JSON.stringify(
      {
        atlasSize: [1600, 1000],
        source: "src/assets/gui/tool-calibration/image2-sources/tool_calibration_hardware_modules_image2_source_v1.png",
        sourceCrop: { left: 560, top: 115, width: 480, height: 780, transform: "rotate90_crop_top48_height388_resize_inside_1220x560" },
        regions: {
          calibration_rod_dark_16x10: [0, 0, 1600, 1000],
          left_tool_bay_calibration_rod: [190, 255, 1220, 560],
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function makeModuleCutSheet() {
  const crops = [
    ["cyan_glass_canister", { left: 75, top: 65, width: 500, height: 835 }],
    ["vertical_calibration_core", { left: 614, top: 105, width: 350, height: 790 }],
    ["round_energy_core", { left: 1060, top: 220, width: 390, height: 430 }],
  ];
  const composites = [];
  const regions = {};
  let x = 36;
  for (const [name, crop] of crops) {
    const img = await sharp(toolSource)
      .extract(crop)
      .resize({ width: 420, height: 700, fit: "inside" })
      .png()
      .toBuffer();
    composites.push({ input: img, left: x, top: 44 });
    regions[name] = [x, 44, 420, 700];
    x += 456;
  }

  const base = await sharp({
    create: {
      width: 1440,
      height: 820,
      channels: 4,
      background: { r: 8, g: 10, b: 12, alpha: 255 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="820">
            <rect width="1440" height="820" fill="#080a0c"/>
            <rect x="20" y="20" width="1400" height="780" rx="32" fill="#101619" opacity="0.74" stroke="#294347" stroke-width="2"/>
            <path d="M58 770 H1382" stroke="#54f3ff" stroke-width="4" opacity="0.24"/>
          </svg>`,
        ),
        left: 0,
        top: 0,
      },
      ...composites,
    ])
    .png()
    .toBuffer();

  await fs.writeFile(moduleSheet, base);
  await fs.writeFile(
    moduleRegions,
    `${JSON.stringify(
      {
        atlasSize: [1440, 820],
        source: "src/assets/gui/tool-calibration/image2-sources/tool_calibration_hardware_modules_image2_source_v1.png",
        regions,
      },
      null,
      2,
    )}\n`,
  );
}

await makeRodLayer();
await makeModuleCutSheet();

console.log(`wrote ${path.relative(repoRoot, rodLayer)}`);
console.log(`wrote ${path.relative(repoRoot, rodRegions)}`);
console.log(`wrote ${path.relative(repoRoot, moduleSheet)}`);
console.log(`wrote ${path.relative(repoRoot, moduleRegions)}`);
