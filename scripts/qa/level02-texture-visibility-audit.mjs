import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const RENDER_DIR = path.join(ROOT, "src/assets/renders");
const REPORT_PATH = path.join(ROOT, "src/assets/manifests/reports/human_protocol_level02_texture_visibility_audit_v2.json");
const SHEET_PATH = path.join(RENDER_DIR, "level02_texture_contact_sheet_v2.png");

const textures = [
  {
    id: "source_furniture_atlas",
    file: "src/assets/textures/environment/wgpu-room-props/hp_image2_furniture_material_atlas_v1.png",
    role: "primary furniture panels, drawers, worn metal, handles",
  },
  {
    id: "source_terminal_atlas",
    file: "src/assets/textures/environment/wgpu-room-props/hp_image2_terminal_screen_atlas_v1.png",
    role: "screens, glass readouts, light-control terminal faces",
  },
  {
    id: "source_surface_atlas",
    file: "src/assets/textures/environment/wgpu-room-props/hp_image2_environment_surfaces_atlas_v1.png",
    role: "floor/rug panels and architectural surface language",
  },
  {
    id: "source_clean_atlas",
    file: "src/assets/textures/environment/wgpu-room-props/hp_image2_clean_atlas_v1.png",
    role: "smoked glass and clean high-quality fallback panels",
  },
  {
    id: "level02_sofa_fabric",
    file: "src/assets/textures/environment/level02/level02_image2_false_home_fabric_weave.png",
    role: "residential sofa fabric, seams, edge wear, cyan stitch",
  },
  {
    id: "level02_service_panel",
    file: "src/assets/textures/environment/level02/level02_image2_cool_gray_service_panel.png",
    role: "backup cool-gray panel with screws and inset guides",
  },
  {
    id: "level02_photo_glass",
    file: "src/assets/textures/environment/level02/level02_image2_absent_family_photo_glass.png",
    role: "fake family photo wall, absent human silhouettes",
  },
  {
    id: "level02_floor_panel",
    file: "src/assets/textures/environment/level02/level02_image2_residential_floor_reflection_panel.png",
    role: "residential floor panel fallback with cyan line",
  },
  {
    id: "level02_lamp_warm",
    file: "src/assets/textures/environment/level02/level02_image2_lamp_lens_warm.png",
    role: "warm tricolor puzzle lamp lens",
  },
  {
    id: "level02_lamp_white",
    file: "src/assets/textures/environment/level02/level02_image2_lamp_lens_white.png",
    role: "white tricolor puzzle lamp lens",
  },
  {
    id: "level02_lamp_blue",
    file: "src/assets/textures/environment/level02/level02_image2_lamp_lens_blue.png",
    role: "blue tricolor puzzle lamp lens",
  },
];

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

async function statsForTexture(texture) {
  const absolute = path.join(ROOT, texture.file);
  const { data, info } = await sharp(absolute)
    .resize(160, 160, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminance = new Float64Array(info.width * info.height);
  let sum = 0;
  let min = 1;
  let max = 0;
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * info.channels;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[index] = y;
    sum += y;
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  const mean = sum / luminance.length;
  let variance = 0;
  let edgeSum = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      const d = luminance[index] - mean;
      variance += d * d;
      if (x + 1 < info.width) edgeSum += Math.abs(luminance[index] - luminance[index + 1]);
      if (y + 1 < info.height) edgeSum += Math.abs(luminance[index] - luminance[index + info.width]);
    }
  }
  const contrast = Math.sqrt(variance / luminance.length);
  const edgeDensity = edgeSum / (info.width * info.height * 2);
  const visibilityScore = clamp01((contrast / 0.18) * 0.52 + (edgeDensity / 0.055) * 0.38 + ((max - min) / 0.72) * 0.1);
  return {
    ...texture,
    sizeBytes: fs.statSync(absolute).size,
    luminanceMean: Number(mean.toFixed(6)),
    luminanceRange: Number((max - min).toFixed(6)),
    contrast: Number(contrast.toFixed(6)),
    edgeDensity: Number(edgeDensity.toFixed(6)),
    visibilityScore: Number(visibilityScore.toFixed(6)),
  };
}

async function tileForTexture(entry) {
  const absolute = path.join(ROOT, entry.file);
  const image = await sharp(absolute).resize(320, 320, { fit: "cover" }).png().toBuffer();
  const label = `
    <svg width="320" height="92" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="92" fill="#071014"/>
      <text x="12" y="24" fill="#c8f8ff" font-family="Arial, sans-serif" font-size="16" font-weight="700">${entry.id}</text>
      <text x="12" y="48" fill="#d9c38d" font-family="Arial, sans-serif" font-size="13">score ${entry.visibilityScore.toFixed(3)} / contrast ${entry.contrast.toFixed(3)}</text>
      <text x="12" y="72" fill="#8ca1a7" font-family="Arial, sans-serif" font-size="11">${entry.role.slice(0, 48)}</text>
    </svg>`;
  return sharp({
    create: {
      width: 320,
      height: 412,
      channels: 4,
      background: "#071014",
    },
  })
    .composite([
      { input: image, left: 0, top: 0 },
      { input: Buffer.from(label), left: 0, top: 320 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(RENDER_DIR, { recursive: true });
  const scored = await Promise.all(textures.map(statsForTexture));
  const tiles = await Promise.all(scored.map(tileForTexture));
  const columns = 4;
  const gap = 18;
  const tileWidth = 320;
  const tileHeight = 412;
  const rows = Math.ceil(tiles.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = rows * tileHeight + (rows + 1) * gap;
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#02070a",
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: gap + (index % columns) * (tileWidth + gap),
        top: gap + Math.floor(index / columns) * (tileHeight + gap),
      })),
    )
    .png()
    .toFile(SHEET_PATH);

  const averageVisibilityScore = scored.reduce((sum, entry) => sum + entry.visibilityScore, 0) / scored.length;
  fs.writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        schema: "human-protocol/level02-texture-visibility-audit@2",
        summary: {
          averageVisibilityScore: Number(averageVisibilityScore.toFixed(6)),
          contactSheet: path.relative(ROOT, SHEET_PATH),
          conclusion:
            "Level 02 now uses the existing high-quality project-owned image2 atlases for primary furniture/surface/screen materials, plus stronger Level 02 narrative textures for sofa/photo/lamp identity.",
        },
        textures: scored,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`wrote ${path.relative(ROOT, SHEET_PATH)}`);
  console.log(`wrote ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`average visibility ${averageVisibilityScore.toFixed(6)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
