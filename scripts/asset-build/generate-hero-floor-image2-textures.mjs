import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "src/assets/textures/environment/hero-floors");
const MANIFEST_PATH = path.join(ROOT, "src/assets/manifests/runtime/human_protocol_hero_floor_image2_manifest.json");
const LONG_EDGE_PX = 4096;
const CONTACT_THUMB_H = 720;

const floorSpecs = [
  {
    id: "level01_maintenance_bay_room_fit_floor",
    levelId: "level_01_maintenance_bay",
    roomId: "maintenance_bay_floor",
    roomMeters: [18, 25],
    file: "level01_image2_maintenance_bay_room_fit_floor.png",
    seed: 10101,
    theme: "maintenance",
    palette: {
      base: "#05090d",
      plate: "#151e24",
      plate2: "#202b31",
      trim: "#06080b",
      seam: "#39464b",
      cyan: "#66efff",
      warm: "#f6f3df",
      amber: "#c98b40",
      red: "#ff4036",
    },
    prompt:
      "One exact room-fit top-down floor image for an 18m x 25m maintenance bay: dark wet gunmetal, large repair-bed light reflections, restrained cyan path strips, red elevator status reflection, bolts, scratches, seams, high-end sci-fi horror.",
  },
  {
    id: "level02_false_residential_room_fit_floor",
    levelId: "level_02_residential_simulation",
    roomId: "level_02_living_room",
    roomMeters: [18.8, 16.6],
    file: "level02_image2_false_residential_room_fit_floor.png",
    seed: 20202,
    theme: "residential",
    palette: {
      base: "#0c0906",
      plate: "#352315",
      plate2: "#5a3a1f",
      trim: "#17100b",
      seam: "#7d5a32",
      cyan: "#58deee",
      warm: "#ffbd66",
      amber: "#d0954f",
      red: "#bd3d35",
    },
    prompt:
      "One exact room-fit top-down floor image for an 18.8m x 16.6m false residential living room: dark warm wood, large muted rug inlay, hidden service seams, amber domestic glow, tiny cold cyan lab cracks, elegant uncanny home.",
  },
  {
    id: "level03_human_museum_room_fit_floor",
    levelId: "level_03_human_museum",
    roomId: "level_03_gallery_lobby",
    roomMeters: [18, 12],
    file: "level03_image2_human_museum_room_fit_floor.png",
    seed: 30303,
    theme: "museum",
    palette: {
      base: "#05090a",
      plate: "#101719",
      plate2: "#1a2324",
      trim: "#5d451a",
      seam: "#d1a64f",
      cyan: "#65dff0",
      warm: "#d7b15c",
      amber: "#9c742c",
      red: "#8c312c",
    },
    prompt:
      "One exact room-fit top-down floor image for an 18m x 12m human museum gallery: polished black stone, aged brass inlays, archive route geometry, smoked glass reflections, luxurious museum horror.",
  },
  {
    id: "level04_memory_clinic_room_fit_floor",
    levelId: "level_04_memory_clinic",
    roomId: "level_04_waiting_room",
    roomMeters: [16, 11],
    file: "level04_image2_memory_clinic_room_fit_floor.png",
    seed: 40404,
    theme: "clinic",
    palette: {
      base: "#cfd7d2",
      plate: "#e4e8e2",
      plate2: "#bcc7c2",
      trim: "#7f918b",
      seam: "#a6b6b0",
      cyan: "#91f7eb",
      warm: "#f4fff6",
      amber: "#c9c09b",
      red: "#d34b41",
    },
    prompt:
      "One exact room-fit top-down floor image for a 16m x 11m memory clinic waiting room: off-white medical resin, pale green-blue sterilization glow, therapy circle markings, soft scuffs, subtle red warning under glass.",
  },
  {
    id: "level05_reclamation_core_room_fit_floor",
    levelId: "level_05_reclamation_core",
    roomId: "level_05_platform",
    roomMeters: [18, 13],
    file: "level05_image2_reclamation_core_room_fit_floor.png",
    seed: 50505,
    theme: "core",
    palette: {
      base: "#050506",
      plate: "#151515",
      plate2: "#262421",
      trim: "#060606",
      seam: "#34302a",
      cyan: "#5de4ff",
      warm: "#f4f7ed",
      amber: "#e18d30",
      red: "#ff493b",
    },
    prompt:
      "One exact room-fit top-down floor image for an 18m x 13m reclamation core platform: black heavy industrial metal, concentric lock rings, deep energy grooves, white identity path, cyan and amber core glow.",
  },
];

await fs.mkdir(OUT_DIR, { recursive: true });

const generated = [];
for (const spec of floorSpecs) {
  const [width, height] = imageSizeForRoom(spec.roomMeters);
  const svg = renderRoomFitFloorSvg(spec, width, height);
  const outputPath = path.join(OUT_DIR, spec.file);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 1, adaptiveFiltering: false }).toFile(outputPath);
  const stat = await fs.stat(outputPath);
  console.error(`wrote ${path.relative(ROOT, outputPath)} ${width}x${height}`);
  generated.push({
    id: spec.id,
    levelId: spec.levelId,
    roomId: spec.roomId,
    roomMeters: spec.roomMeters,
    sourcePath: path.relative(ROOT, outputPath),
    sizePx: [width, height],
    pixelsPerMeter: [round(width / spec.roomMeters[0]), round(height / spec.roomMeters[1])],
    bytes: stat.size,
    prompt: spec.prompt,
    negative: "No text, no UI, no logo, no characters, no props, no walls, no perspective camera, no square-tile stretch artifacts.",
    qaNotes:
      "Room-fit source image: aspect ratio matches the target room footprint. Intended mapping is one plane covering the full room bounds with 1:1 UV, not repeated square tiling.",
  });
}

const contactSheetPath = path.join(OUT_DIR, "human_protocol_room_fit_hero_floor_contact_sheet.png");
await writeContactSheet(generated, contactSheetPath);

const manifest = {
  id: "human_protocol_hero_floor_image2_manifest",
  generatedAt: new Date().toISOString(),
  generator: "scripts/asset-build/generate-hero-floor-image2-textures.mjs",
  purpose:
    "Five room-fit hero floor source images for the five official Human Protocol big-room themes. Each image has the same aspect ratio as the target room bounds.",
  sourcePolicy:
    "Source images only. Runtime integration should place each image on a single room-sized floor plane or GLB surface with matching meters; do not stretch a square texture over a rectangular room.",
  longEdgePx: LONG_EDGE_PX,
  textureCount: generated.length,
  contactSheet: path.relative(ROOT, contactSheetPath),
  textures: generated,
};

await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      manifest: path.relative(ROOT, MANIFEST_PATH),
      contactSheet: manifest.contactSheet,
      textures: generated.map((entry) => ({ path: entry.sourcePath, sizePx: entry.sizePx, roomMeters: entry.roomMeters })),
    },
    null,
    2,
  ),
);

function imageSizeForRoom([roomWidth, roomDepth]) {
  if (roomWidth >= roomDepth) {
    return [LONG_EDGE_PX, Math.round((LONG_EDGE_PX * roomDepth) / roomWidth)];
  }
  return [Math.round((LONG_EDGE_PX * roomWidth) / roomDepth), LONG_EDGE_PX];
}

async function writeContactSheet(entries, outputPath) {
  const thumbs = await Promise.all(
    entries.map(async (entry) => {
      const source = path.join(ROOT, entry.sourcePath);
      const width = Math.round((CONTACT_THUMB_H * entry.sizePx[0]) / entry.sizePx[1]);
      return {
        buffer: await sharp(source).resize(width, CONTACT_THUMB_H).png().toBuffer(),
        width,
        height: CONTACT_THUMB_H,
      };
    }),
  );
  const gap = 24;
  const width = thumbs.reduce((sum, thumb) => sum + thumb.width, gap * (thumbs.length + 1));
  const composites = [];
  let left = gap;
  for (const thumb of thumbs) {
    composites.push({ input: thumb.buffer, left, top: gap });
    left += thumb.width + gap;
  }
  await sharp({
    create: {
      width,
      height: CONTACT_THUMB_H + gap * 2,
      channels: 4,
      background: "#050607",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 1, adaptiveFiltering: false })
    .toFile(outputPath);
  console.error(`wrote ${path.relative(ROOT, outputPath)}`);
}

function renderRoomFitFloorSvg(spec, width, height) {
  const p = spec.palette;
  const rand = mulberry32(spec.seed);
  const parts = [];
  const defs = `
    <defs>
      <linearGradient id="baseGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${p.plate2}" stop-opacity="0.78"/>
        <stop offset="0.52" stop-color="${p.base}" stop-opacity="1"/>
        <stop offset="1" stop-color="${p.trim}" stop-opacity="0.98"/>
      </linearGradient>
      <radialGradient id="centerGlow" cx="50%" cy="50%" r="62%">
        <stop offset="0" stop-color="${p.warm}" stop-opacity="${spec.theme === "clinic" ? 0.36 : 0.2}"/>
        <stop offset="0.54" stop-color="${p.cyan}" stop-opacity="0.06"/>
        <stop offset="1" stop-color="${p.base}" stop-opacity="0"/>
      </radialGradient>
    </defs>`;
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="url(#baseGrad)"/>`);
  drawSurfaceGrain(parts, p, rand, width, height);

  if (spec.theme === "maintenance") drawMaintenance(parts, p, rand, width, height);
  if (spec.theme === "residential") drawResidential(parts, p, rand, width, height);
  if (spec.theme === "museum") drawMuseum(parts, p, rand, width, height);
  if (spec.theme === "clinic") drawClinic(parts, p, rand, width, height);
  if (spec.theme === "core") drawCore(parts, p, rand, width, height);

  const margin = Math.round(Math.min(width, height) * 0.055);
  parts.push(`<rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" rx="${Math.round(margin * 0.18)}" fill="none" stroke="${p.trim}" stroke-width="${Math.max(10, margin * 0.22)}" opacity="0.72"/>`);
  parts.push(`<rect x="${margin * 1.42}" y="${margin * 1.42}" width="${width - margin * 2.84}" height="${height - margin * 2.84}" rx="${Math.round(margin * 0.12)}" fill="none" stroke="${p.seam}" stroke-width="${Math.max(3, margin * 0.045)}" opacity="0.42"/>`);
  parts.push(`<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.42}" ry="${height * 0.35}" fill="url(#centerGlow)" opacity="0.8"/>`);
  drawScratches(parts, p, rand, width, height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}${parts.join("")}</svg>`;
}

function drawMaintenance(parts, p, rand, w, h) {
  panelGrid(parts, p, 5, 8, w * 0.07, h * 0.055, w * 0.86, h * 0.89, rand, 0.28);
  glowLine(parts, p.cyan, w * 0.15, h * 0.12, w * 0.15, h * 0.86, w * 0.006, 0.62);
  glowLine(parts, p.cyan, w * 0.85, h * 0.12, w * 0.85, h * 0.86, w * 0.006, 0.62);
  glowLine(parts, p.warm, w * 0.41, h * 0.33, w * 0.41, h * 0.62, w * 0.014, 0.52);
  glowLine(parts, p.warm, w * 0.59, h * 0.33, w * 0.59, h * 0.62, w * 0.014, 0.52);
  glowLine(parts, p.red, w * 0.38, h * 0.91, w * 0.62, h * 0.91, w * 0.007, 0.58);
  for (let i = 0; i < 64; i++) bolt(parts, p.trim, rand() * w, rand() * h, Math.min(w, h) * (0.003 + rand() * 0.003), 0.42);
}

function drawResidential(parts, p, rand, w, h) {
  parquet(parts, p, rand, w, h);
  const rugX = w * 0.21;
  const rugY = h * 0.2;
  const rugW = w * 0.58;
  const rugH = h * 0.58;
  parts.push(`<rect x="${rugX}" y="${rugY}" width="${rugW}" height="${rugH}" rx="${Math.min(w, h) * 0.018}" fill="#5a3a20" opacity="0.58" stroke="${p.amber}" stroke-width="${Math.max(8, w * 0.003)}"/>`);
  parts.push(`<rect x="${rugX + rugW * 0.07}" y="${rugY + rugH * 0.07}" width="${rugW * 0.86}" height="${rugH * 0.86}" rx="${Math.min(w, h) * 0.012}" fill="#42301f" opacity="0.74" stroke="${p.warm}" stroke-width="${Math.max(3, w * 0.0012)}"/>`);
  for (let i = 0; i < 6; i++) {
    const inset = (i + 1) * Math.min(rugW, rugH) * 0.045;
    parts.push(`<rect x="${rugX + inset}" y="${rugY + inset}" width="${rugW - inset * 2}" height="${rugH - inset * 2}" rx="8" fill="none" stroke="${p.amber}" stroke-width="3" opacity="${0.16 - i * 0.018}"/>`);
  }
  glowLine(parts, p.cyan, w * 0.08, h * 0.18, w * 0.08, h * 0.82, w * 0.003, 0.34);
  glowLine(parts, p.cyan, w * 0.92, h * 0.18, w * 0.92, h * 0.82, w * 0.003, 0.3);
  glowLine(parts, p.warm, w * 0.5, h * 0.12, w * 0.5, h * 0.2, w * 0.008, 0.48);
}

function drawMuseum(parts, p, rand, w, h) {
  panelGrid(parts, p, 4, 3, w * 0.06, h * 0.08, w * 0.88, h * 0.84, rand, 0.16);
  marbleVeins(parts, rand, w, h);
  parts.push(`<path d="M${w * 0.5} ${h * 0.08} L${w * 0.5} ${h * 0.92} M${w * 0.08} ${h * 0.5} L${w * 0.92} ${h * 0.5}" stroke="${p.trim}" stroke-width="${w * 0.004}" opacity="0.75"/>`);
  parts.push(`<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.2}" ry="${h * 0.26}" fill="none" stroke="${p.trim}" stroke-width="${w * 0.004}" opacity="0.82"/>`);
  parts.push(`<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.12}" ry="${h * 0.16}" fill="none" stroke="${p.amber}" stroke-width="${w * 0.0025}" opacity="0.65"/>`);
  glowLine(parts, p.cyan, w * 0.5, h * 0.09, w * 0.5, h * 0.2, w * 0.004, 0.48);
  glowLine(parts, p.cyan, w * 0.5, h * 0.8, w * 0.5, h * 0.91, w * 0.004, 0.48);
}

function drawClinic(parts, p, rand, w, h) {
  panelGrid(parts, p, 4, 3, w * 0.06, h * 0.08, w * 0.88, h * 0.84, rand, 0.12);
  parts.push(`<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.26}" ry="${h * 0.34}" fill="none" stroke="${p.trim}" stroke-width="${w * 0.002}" opacity="0.36"/>`);
  parts.push(`<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.105}" ry="${h * 0.14}" fill="none" stroke="${p.trim}" stroke-width="${w * 0.003}" opacity="0.46"/>`);
  parts.push(`<line x1="${w * 0.5}" y1="${h * 0.12}" x2="${w * 0.5}" y2="${h * 0.88}" stroke="${p.seam}" stroke-width="${w * 0.0013}" opacity="0.32"/>`);
  glowLine(parts, p.cyan, w * 0.16, h * 0.18, w * 0.28, h * 0.18, w * 0.004, 0.38);
  glowLine(parts, p.cyan, w * 0.72, h * 0.18, w * 0.84, h * 0.18, w * 0.004, 0.38);
  glowLine(parts, p.red, w * 0.12, h * 0.5, w * 0.18, h * 0.5, w * 0.0028, 0.34);
  for (let i = 0; i < 150; i++) {
    parts.push(`<circle cx="${(rand() * w).toFixed(1)}" cy="${(rand() * h).toFixed(1)}" r="${(1 + rand() * 3).toFixed(1)}" fill="#5d6d67" opacity="${(0.025 + rand() * 0.05).toFixed(3)}"/>`);
  }
}

function drawCore(parts, p, rand, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  for (const [rx, ry, sw, o] of [
    [0.41, 0.47, 0.026, 0.7],
    [0.31, 0.36, 0.018, 0.9],
    [0.21, 0.24, 0.012, 0.7],
    [0.11, 0.13, 0.008, 0.92],
  ]) {
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${w * rx}" ry="${h * ry}" fill="none" stroke="${p.plate2}" stroke-width="${Math.min(w, h) * sw}" opacity="${o}"/>`);
  }
  for (let a = 0; a < 360; a += 30) {
    const r = (a * Math.PI) / 180;
    const x1 = cx + Math.cos(r) * w * 0.13;
    const y1 = cy + Math.sin(r) * h * 0.15;
    const x2 = cx + Math.cos(r) * w * 0.45;
    const y2 = cy + Math.sin(r) * h * 0.48;
    glowLine(parts, a % 90 === 0 ? p.warm : p.amber, x1, y1, x2, y2, Math.min(w, h) * (a % 90 === 0 ? 0.006 : 0.003), a % 90 === 0 ? 0.4 : 0.22);
  }
  glowLine(parts, p.warm, cx, h * 0.08, cx, h * 0.92, w * 0.01, 0.5);
  glowLine(parts, p.cyan, cx, cy - h * 0.08, cx, cy + h * 0.08, w * 0.006, 0.72);
}

function panelGrid(parts, p, cols, rows, x, y, w, h, rand, variance) {
  const cellW = w / cols;
  const cellH = h / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = x + col * cellW + cellW * 0.035;
      const py = y + row * cellH + cellH * 0.035;
      parts.push(`<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${(cellW * 0.93).toFixed(1)}" height="${(cellH * 0.93).toFixed(1)}" rx="${Math.min(cellW, cellH) * 0.025}" fill="${rand() > 0.45 ? p.plate : p.plate2}" opacity="${(0.46 + rand() * variance).toFixed(3)}" stroke="${p.trim}" stroke-width="${Math.max(3, Math.min(w, h) * 0.002)}"/>`);
    }
  }
}

function parquet(parts, p, rand, w, h) {
  const margin = Math.min(w, h) * 0.06;
  const tile = Math.min(w, h) * 0.085;
  for (let y = margin; y < h - margin; y += tile) {
    for (let x = margin; x < w - margin; x += tile) {
      const rotate = (Math.floor((x + y) / tile) % 2) * 90;
      parts.push(`<g transform="rotate(${rotate} ${x + tile / 2} ${y + tile / 2})"><rect x="${x}" y="${y}" width="${tile * 0.95}" height="${tile * 0.95}" fill="${rand() > 0.45 ? p.plate : p.plate2}" opacity="${(0.52 + rand() * 0.18).toFixed(3)}" stroke="${p.trim}" stroke-width="3"/><path d="M${x + tile * 0.12} ${y + tile * 0.12} L${x + tile * 0.82} ${y + tile * 0.82}" stroke="${p.amber}" stroke-width="2" opacity="0.16"/></g>`);
    }
  }
}

function marbleVeins(parts, rand, w, h) {
  for (let i = 0; i < 46; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const dx = (rand() - 0.5) * w * 0.18;
    const dy = (rand() - 0.5) * h * 0.24;
    parts.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} C${(x + dx * 0.4).toFixed(1)} ${(y + dy * 0.15).toFixed(1)}, ${(x + dx * 0.55).toFixed(1)} ${(y + dy * 0.75).toFixed(1)}, ${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}" stroke="#d9d0b8" stroke-width="${(1.2 + rand() * 2.2).toFixed(1)}" opacity="${(0.06 + rand() * 0.1).toFixed(3)}" fill="none"/>`);
  }
}

function drawScratches(parts, p, rand, w, h) {
  for (let i = 0; i < 150; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = Math.min(w, h) * (0.006 + rand() * 0.03);
    const angle = rand() * Math.PI;
    parts.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.cos(angle) * len).toFixed(1)}" y2="${(y + Math.sin(angle) * len).toFixed(1)}" stroke="${rand() > 0.5 ? "#ffffff" : p.trim}" stroke-width="${(0.8 + rand() * 1.5).toFixed(1)}" opacity="${(0.035 + rand() * 0.08).toFixed(3)}"/>`);
  }
}

function drawSurfaceGrain(parts, p, rand, w, h) {
  for (let i = 0; i < 260; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const rw = Math.min(w, h) * (0.002 + rand() * 0.012);
    const rh = Math.min(w, h) * (0.0008 + rand() * 0.004);
    const rotate = rand() * 180;
    const color = rand() > 0.5 ? "#ffffff" : p.trim;
    parts.push(
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="${(rh * 0.5).toFixed(1)}" fill="${color}" opacity="${(0.018 + rand() * 0.035).toFixed(3)}" transform="rotate(${rotate.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`,
    );
  }
}

function glowLine(parts, color, x1, y1, x2, y2, width, opacity) {
  parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width * 7}" opacity="${(opacity * 0.065).toFixed(3)}" stroke-linecap="round"/>`);
  parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width * 2.4}" opacity="${(opacity * 0.24).toFixed(3)}" stroke-linecap="round"/>`);
  parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" opacity="${opacity.toFixed(3)}" stroke-linecap="round"/>`);
}

function bolt(parts, color, x, y, r, opacity) {
  parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="${opacity}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.38).toFixed(1)}" fill="#000" opacity="${opacity * 0.55}"/>`);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
