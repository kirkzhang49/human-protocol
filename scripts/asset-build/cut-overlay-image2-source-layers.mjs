import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const toolDir = path.join(repoRoot, "src/assets/gui/tool-calibration");
const routeDir = path.join(repoRoot, "src/assets/gui/route-switch");

const toolUiSource = path.join(toolDir, "image2-sources/tool_calibration_complete_ui_image2_source_v3_no_hand.png");
const toolModuleSource = path.join(toolDir, "image2-sources/tool_calibration_hardware_modules_image2_source_v1.png");
const routeSource = path.join(routeDir, "image2-sources/route_switch_output_modules_image2_source_v1.png");

async function writeJson(file, data) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function crop(file, rect, options = {}) {
  let image = sharp(file).extract({ left: rect[0], top: rect[1], width: rect[2], height: rect[3] });
  if (options.resize) image = image.resize(options.resize);
  return image.png().toBuffer();
}

async function makeToolBayLayer() {
  const out = path.join(toolDir, "tool_calibration_left_tool_bay_image2_layer_v3.png");
  const json = path.join(toolDir, "tool_calibration_left_tool_bay_image2_layer_v3.regions.json");
  const toolCrop = await crop(toolUiSource, [210, 171, 281, 240], { resize: { width: 700, height: 520, fit: "inside" } });

  const svgBacking = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600">
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="70%">
          <stop offset="0" stop-color="#142022"/>
          <stop offset="0.58" stop-color="#070b0d"/>
          <stop offset="1" stop-color="#020404"/>
        </radialGradient>
      </defs>
      <rect width="960" height="600" fill="url(#bg)"/>
      <rect x="44" y="44" width="872" height="512" rx="20" fill="#081012" opacity="0.72" stroke="#8e713f" stroke-opacity="0.45" stroke-width="2"/>
      <path d="M78 536 H882" stroke="#54f3ff" stroke-width="4" opacity="0.35"/>
      <path d="M96 70 H864" stroke="#c79a54" stroke-width="3" opacity="0.22"/>
    </svg>`,
  );

  await sharp({
    create: { width: 960, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: svgBacking, left: 0, top: 0 },
      { input: toolCrop, left: 130, top: 42 },
    ])
    .png()
    .toFile(out);

  await writeJson(json, {
    atlasSize: [960, 600],
    source: "src/assets/gui/tool-calibration/image2-sources/tool_calibration_complete_ui_image2_source_v3_no_hand.png",
    sourceCrop: { left: 210, top: 171, width: 281, height: 240 },
    regions: {
      full_layer_16x10: [0, 0, 960, 600],
      left_tool_bay_image: [130, 42, 700, 520],
    },
    constraints: ["no hands", "no skin tones", "no biological forms", "no gore"],
  });
}

async function makeToolModuleLayer() {
  const out = path.join(toolDir, "tool_calibration_tile_module_image2_source_cut_v3.png");
  const json = path.join(toolDir, "tool_calibration_tile_module_image2_source_cut_v3.regions.json");
  const tileBoard = await crop(toolUiSource, [520, 182, 560, 540], { resize: { width: 840, height: 810, fit: "contain" } });
  const hardwareModules = await crop(toolModuleSource, [610, 96, 370, 810], { resize: { width: 240, height: 526, fit: "inside" } });

  const backing = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900">
      <rect width="1280" height="900" fill="#050809"/>
      <rect x="28" y="28" width="1224" height="844" rx="24" fill="#0b1012" stroke="#223638" stroke-width="2"/>
      <path d="M72 836 H1208" stroke="#54f3ff" stroke-width="4" opacity="0.28"/>
      <path d="M72 64 H1208" stroke="#c79a54" stroke-width="3" opacity="0.2"/>
    </svg>`,
  );

  await sharp({
    create: { width: 1280, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: backing, left: 0, top: 0 },
      { input: tileBoard, left: 54, top: 52 },
      { input: hardwareModules, left: 944, top: 168 },
    ])
    .png()
    .toFile(out);

  await writeJson(json, {
    atlasSize: [1280, 900],
    sources: [
      "src/assets/gui/tool-calibration/image2-sources/tool_calibration_complete_ui_image2_source_v3_no_hand.png",
      "src/assets/gui/tool-calibration/image2-sources/tool_calibration_hardware_modules_image2_source_v1.png",
    ],
    regions: {
      tile_board_source_cut: [54, 52, 840, 810],
      cyan_glass_module_source_cut: [944, 168, 240, 526],
    },
    notes: "Source-backed cut sheet for richer cyan tubes, energy cores, edge-lit tiles, and black-gold modules. Runtime text/state remains live.",
  });
}

async function makeToolNoTextTileAtlas() {
  const out = path.join(toolDir, "tool_calibration_tile_module_image2_atlas_v3_no_text.png");
  const json = path.join(toolDir, "tool_calibration_tile_module_image2_atlas_v3_no_text.regions.json");
  const picks = [
    ["source_tile_straight_off", 0, 0],
    ["source_tile_corner_off", 1, 0],
    ["source_tile_tee_off", 2, 0],
    ["source_tile_blocked", 3, 0],
    ["source_tile_turn_off", 4, 0],
    ["source_tile_straight_on", 0, 2],
    ["source_tile_corner_on", 1, 2],
    ["source_tile_tee_on", 2, 2],
    ["source_tile_cross_on", 4, 2],
    ["source_tile_socket_empty", 5, 2],
    ["source_tile_corner_alt", 1, 3],
    ["source_tile_tee_alt", 2, 3],
    ["source_tile_straight_alt", 3, 3],
    ["source_tile_turn_alt", 4, 3],
    ["cyan_glass_module", "module", 0],
    ["round_energy_core_module", "module", 1],
  ];
  const cell = 192;
  const gap = 24;
  const regions = {};
  const composites = [];
  const backing = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${gap * 5 + cell * 4}" height="${gap * 5 + cell * 4}">
      <rect width="100%" height="100%" fill="#050809"/>
    </svg>`,
  );
  composites.push({ input: backing, left: 0, top: 0 });

  for (let i = 0; i < picks.length; i += 1) {
    const [name, col, row] = picks[i];
    const x = gap + (i % 4) * (cell + gap);
    const y = gap + Math.floor(i / 4) * (cell + gap);
    let input;
    if (col === "module" && row === 0) {
      input = await crop(toolModuleSource, [614, 105, 350, 790], { resize: { width: cell, height: cell, fit: "contain" } });
    } else if (col === "module" && row === 1) {
      input = await crop(toolModuleSource, [1060, 220, 390, 430], { resize: { width: cell, height: cell, fit: "contain" } });
    } else {
      input = await crop(toolUiSource, [528 + col * 93, 272 + row * 93, 84, 84], {
        resize: { width: cell, height: cell, fit: "fill" },
      });
    }
    composites.push({ input, left: x, top: y });
    regions[name] = [x, y, cell, cell];
  }

  const atlasSize = [gap * 5 + cell * 4, gap * 5 + cell * 4];
  await sharp({
    create: { width: atlasSize[0], height: atlasSize[1], channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toFile(out);

  await writeJson(json, {
    atlasSize,
    sources: [
      "src/assets/gui/tool-calibration/image2-sources/tool_calibration_complete_ui_image2_source_v3_no_hand.png",
      "src/assets/gui/tool-calibration/image2-sources/tool_calibration_hardware_modules_image2_source_v1.png",
    ],
    sourcePolicy: "Image2 crops only; script packs and writes regions. No local-drawn tile art.",
    regions,
    notes: "No baked text tiles selected from the Image2 source; use this atlas before the broader source cut sheet when runtime text/state ownership matters.",
  });
}

async function makeRouteOutputLayer() {
  const out = path.join(routeDir, "route_switch_output_button_image2_layer_v1.png");
  const json = path.join(routeDir, "route_switch_output_button_image2_layer_v1.regions.json");
  const panel = await crop(routeSource, [794, 18, 520, 300], { resize: { width: 600, height: 346, fit: "fill" } });
  const hero = await crop(routeSource, [994, 430, 420, 220], { resize: { width: 504, height: 264, fit: "fill" } });
  const buttons = await Promise.all([
    crop(routeSource, [18, 336, 256, 76], { resize: { width: 260, height: 78, fit: "fill" } }),
    crop(routeSource, [292, 336, 256, 76], { resize: { width: 260, height: 78, fit: "fill" } }),
    crop(routeSource, [566, 336, 256, 76], { resize: { width: 260, height: 78, fit: "fill" } }),
  ]);
  const status = await crop(routeSource, [18, 748, 714, 104], { resize: { width: 714, height: 104, fit: "fill" } });
  const detail = await crop(routeSource, [1432, 430, 420, 86], { resize: { width: 420, height: 86, fit: "fill" } });

  const backing = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
      <rect width="1280" height="720" fill="#050809"/>
      <rect x="36" y="34" width="1208" height="652" rx="26" fill="#0b1012" stroke="#253c3f" stroke-width="2"/>
      <path d="M74 650 H1206" stroke="#54f3ff" stroke-width="4" opacity="0.3"/>
      <path d="M86 70 H1194" stroke="#c79a54" stroke-width="3" opacity="0.22"/>
    </svg>`,
  );

  await sharp({
    create: { width: 1280, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: backing, left: 0, top: 0 },
      { input: panel, left: 74, top: 96 },
      { input: hero, left: 704, top: 116 },
      { input: buttons[0], left: 96, top: 500 },
      { input: buttons[1], left: 386, top: 500 },
      { input: buttons[2], left: 676, top: 500 },
      { input: status, left: 450, top: 372 },
      { input: detail, left: 760, top: 594 },
    ])
    .png()
    .toFile(out);

  await writeJson(json, {
    atlasSize: [1280, 720],
    source: "src/assets/gui/route-switch/image2-sources/route_switch_output_modules_image2_source_v1.png",
    regions: {
      full_layer_16x9: [0, 0, 1280, 720],
      output_panel_plate: [74, 96, 600, 346],
      route_output_display: [704, 116, 504, 264],
      button_enabled: [96, 500, 260, 78],
      button_disabled: [386, 500, 260, 78],
      button_selected: [676, 500, 260, 78],
      status_icon_bank: [450, 372, 714, 104],
      detail_strip: [760, 594, 420, 86],
    },
    notes: "Composed only from the Level07 route-switch Image2 parts source; no local-drawn primary art.",
  });
}

await makeToolBayLayer();
await makeToolModuleLayer();
await makeToolNoTextTileAtlas();
await makeRouteOutputLayer();

console.log("wrote source-backed overlay layers");
