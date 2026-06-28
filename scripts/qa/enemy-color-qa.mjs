import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REGISTRY_PATH = path.join(ROOT, "src/game/config/roomPresentationKits.json");
const VISUAL_CONFIG_PATH = path.join(ROOT, "src/game/config/enemyVisualProfiles.json");
const REPORT_PATH = path.join(ROOT, "src/assets/manifests/reports/human_protocol_enemy_palette_math_report.json");

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const enemyVisualConfig = JSON.parse(fs.readFileSync(VISUAL_CONFIG_PATH, "utf8"));
const shell = registry.shellKits["hp:industrial_panel_arena_shell_v3_art_pass"];
const lighting = registry.lightingPresets["hp:cyan_lockdown_arena_v5_age_director"];

const candidates = [
  {
    id: "sterile_gunmetal_teal",
    body: "#b8c2bd",
    armor: "#162229",
    dark: "#081116",
    core: "#74f1ff",
    warning: "#c8a36a",
    note: "clean hospital metal with safe cyan lens",
  },
  {
    id: "oil_slick_cyan_amber",
    body: "#899b98",
    armor: "#0d151a",
    dark: "#050a0d",
    core: "#67e7ff",
    warning: "#e0a24f",
    note: "darker oily service unit with amber caution",
  },
  {
    id: "bone_ceramic_black_teal",
    body: "#d0d7cf",
    armor: "#11191d",
    dark: "#070c0f",
    core: "#5fe0ea",
    warning: "#c4b177",
    note: "recognizable pale medical body, black joints",
  },
  {
    id: "desaturated_surgical_green",
    body: "#9dafaa",
    armor: "#182328",
    dark: "#081013",
    core: "#83ffd8",
    warning: "#d0a45a",
    note: "cold green scanner against cyan/red room lights",
  },
  {
    id: "smoked_titanium_pale_cyan",
    body: "#a4b2b2",
    armor: "#242d31",
    dark: "#10171a",
    core: "#9cf7ff",
    warning: "#b08a4a",
    note: "premium titanium, lower threat read",
  },
  {
    id: "black_chrome_bloodless_blue",
    body: "#6f7c7f",
    armor: "#070d11",
    dark: "#030609",
    core: "#57d2ff",
    warning: "#9b6b4a",
    note: "very dark silhouette, strong horror",
  },
  {
    id: "warm_service_bone_red",
    body: "#c8beb0",
    armor: "#251d1e",
    dark: "#0d090a",
    core: "#6be6ff",
    warning: "#d75a43",
    note: "classic warning red; likely conflicts with locked elevator",
  },
  {
    id: "deep_navy_hospital_cyan",
    body: "#728b92",
    armor: "#081a22",
    dark: "#030b10",
    core: "#7affff",
    warning: "#d1b05d",
    note: "navy stealth body with bright hospital scanner",
  },
  {
    id: "oxide_gold_cyan",
    body: "#a6a093",
    armor: "#171c1d",
    dark: "#080b0c",
    core: "#64eaff",
    warning: "#f1c75d",
    note: "industrial gold contacts, a little warmer",
  },
  {
    id: "ghost_steel_green_lens",
    body: "#bec8c4",
    armor: "#20292d",
    dark: "#0a1114",
    core: "#75f4d6",
    warning: "#bba05d",
    note: "pale ghost steel and green lens",
  },
  {
    id: "ashen_teal_orange",
    body: "#96a7a2",
    armor: "#12191b",
    dark: "#06090a",
    core: "#7be7ee",
    warning: "#d8874a",
    note: "balanced teal/orange but warmer warning",
  },
  {
    id: "white_panels_ice_blue",
    body: "#dfe5df",
    armor: "#2a3338",
    dark: "#11191d",
    core: "#b7fbff",
    warning: "#cabd8d",
    note: "high readability but overexposure risk",
  },
];

const configuredPalette = {
  id: enemyVisualConfig.globalPalette.id,
  body: enemyVisualConfig.globalPalette.body,
  armor: enemyVisualConfig.globalPalette.armor,
  dark: enemyVisualConfig.globalPalette.dark,
  core: enemyVisualConfig.globalPalette.core,
  warning: enemyVisualConfig.globalPalette.warning,
  note: "currently configured Human Protocol runtime enemy palette",
  source: "src/game/config/enemyVisualProfiles.json",
};

const enemySamplePoints = [
  [0, 1.2, -3.2],
  [-6.48, 1.1, 5.8],
  [6.12, 1.1, 5.3],
  [-2.8, 1.1, 6.8],
  [0, 1.25, -12.7],
];

const backgroundColors = [
  shell.floorBaseColor,
  shell.floorPanelColor,
  shell.floorTrimColor,
  shell.ceilingBaseColor,
  shell.ceilingBeamColor,
  "#020609",
].filter(Boolean);

const ranked = [...candidates, configuredPalette]
  .map((candidate) => scorePalette(candidate))
  .sort((left, right) => right.totalScore - left.totalScore);
const configuredPaletteScore = ranked.find((entry) => entry.id === configuredPalette.id);

const report = {
  id: "human_protocol_enemy_palette_math_report",
  generatedAt: new Date().toISOString(),
  source: {
    registryPath: "src/game/config/roomPresentationKits.json",
    lightingPreset: lighting.id,
    shellKit: shell.id,
    enemyVisualProfilesPath: "src/game/config/enemyVisualProfiles.json",
  },
  formulas: {
    linearLuminance: "Y = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear",
    contrast: "Weber contrast between lit robot surfaces and weighted floor/wall background",
    paletteScore: "0.28*silhouette + 0.18*coreRead + 0.16*horror + 0.14*premiumMetal + 0.12*warningHarmony + 0.12*exposure",
  },
  winner: ranked[0],
  configuredPalette: configuredPaletteScore,
  ranked,
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `PASS enemy palette QA winner=${ranked[0].id} score=${ranked[0].totalScore} configured=${configuredPaletteScore.id} configuredScore=${configuredPaletteScore.totalScore} body=${configuredPaletteScore.palette.body} armor=${configuredPaletteScore.palette.armor} core=${configuredPaletteScore.palette.core} warning=${configuredPaletteScore.palette.warning}`,
);

function scorePalette(palette) {
  const background = averageLinear(backgroundColors.map(hexLinearRgb));
  const roomLight = estimateRoomLight();
  const litBody = litSurface(palette.body, roomLight, "#000000", 0);
  const litArmor = litSurface(palette.armor, roomLight * 0.9, "#000000", 0);
  const litCore = litSurface(palette.core, roomLight * 0.78, palette.core, 1.12);
  const litWarning = litSurface(palette.warning, roomLight * 0.72, palette.warning, 0.34);
  const bodyLum = luminance(litBody);
  const armorLum = luminance(litArmor);
  const coreLum = luminance(litCore);
  const warningLum = luminance(litWarning);
  const bgLum = luminance(background);
  const silhouette = clamp01((Math.abs(bodyLum - bgLum) + Math.abs(armorLum - bgLum) * 1.2) / 0.52);
  const coreRead = clamp01((coreLum - Math.max(bodyLum, armorLum)) / 0.7) * clamp01(colorDistance(litCore, background) / 1.08);
  const bodyChroma = chroma(hexLinearRgb(palette.body));
  const armorChroma = chroma(hexLinearRgb(palette.armor));
  const warningRedConflict = redDominance(hexLinearRgb(palette.warning));
  const warningHarmony = clamp01(colorDistance(litWarning, litCore) / 0.85) * (1 - clamp01((warningRedConflict - 0.38) / 0.42));
  const darkness = clamp01((0.42 - (bodyLum * 0.55 + armorLum * 0.45)) / 0.32);
  const horror = clamp01(darkness * 0.68 + coreRead * 0.32);
  const materialSeparation = clamp01(colorDistance(litBody, litArmor) / 0.42);
  const premiumMetal = clamp01(materialSeparation * 0.46 + (1 - Math.min(1, bodyChroma + armorChroma)) * 0.28 + silhouette * 0.26);
  const brightest = Math.max(coreLum, warningLum, bodyLum, armorLum);
  const exposure = clamp01((1.55 - brightest) / 0.8) * clamp01((brightest - 0.32) / 0.6);

  const totalScore = round(
    100 *
      (0.28 * silhouette +
        0.18 * coreRead +
        0.16 * horror +
        0.14 * premiumMetal +
        0.12 * warningHarmony +
        0.12 * exposure),
  );

  return {
    id: palette.id,
    totalScore,
    palette: {
      body: palette.body,
      armor: palette.armor,
      dark: palette.dark,
      core: palette.core,
      warning: palette.warning,
    },
    note: palette.note,
    metrics: {
      silhouette: round(silhouette),
      coreRead: round(coreRead),
      horror: round(horror),
      premiumMetal: round(premiumMetal),
      warningHarmony: round(warningHarmony),
      exposure: round(exposure),
      bodyLuminance: round(bodyLum),
      armorLuminance: round(armorLum),
      coreLuminance: round(coreLum),
      warningRedConflict: round(warningRedConflict),
    },
  };
}

function estimateRoomLight() {
  const ambient = hexLuminance(lighting.ambient.color) * lighting.ambient.intensity * 1.35;
  const hemisphere = hexLuminance("#9cefff") * (lighting.hemisphereIntensity ?? 0) * 0.42;
  const directional = hexLuminance(lighting.directional?.color ?? "#ffffff") * (lighting.directional?.intensity ?? 0) * 0.18;
  const reflection = (shell.floorReflectionOpacity ?? 0) * (shell.floorReflectionStrength ?? 0) * 0.58;
  const lightEntries = lighting.lights.filter((light) => light.type === "point" || light.type === "spot" || light.type === "area");
  const direct = enemySamplePoints.reduce((sum, point) => {
    return sum + lightEntries.reduce((lightSum, light) => lightSum + estimateLightAtPoint(light, point), 0);
  }, 0);
  return ambient + hemisphere + directional + reflection + direct / Math.max(1, enemySamplePoints.length);
}

function estimateLightAtPoint(light, point) {
  const position = resolveLightPosition(light);
  const lightLum = hexLuminance(light.color);
  const intensity = light.lockdownIntensity ?? light.intensity ?? 0;
  const dist = vecDistance(position, point);
  if (light.type === "area") {
    return (lightLum * intensity * Math.sqrt(Math.max(0.1, light.width * light.height))) / (dist * dist + 1.1);
  }
  const distanceLimit = light.distance ?? 8;
  const rangeFalloff = Math.max(0, 1 - dist / distanceLimit);
  const inverseFalloff = 1 / (1 + (dist / Math.max(0.1, distanceLimit * 0.45)) ** 2);
  return lightLum * intensity * rangeFalloff * inverseFalloff;
}

function litSurface(baseHex, lightAmount, emissiveHex, emissiveStrength) {
  const base = hexLinearRgb(baseHex);
  const emissive = hexLinearRgb(emissiveHex);
  return [
    base[0] * lightAmount + emissive[0] * emissiveStrength,
    base[1] * lightAmount + emissive[1] * emissiveStrength,
    base[2] * lightAmount + emissive[2] * emissiveStrength,
  ];
}

function resolveLightPosition(light) {
  if (light.position) return light.position;
  if (!light.roomRelative) return [0, 0, 0];
  const room = { center: [0, 0, -3.2], size: [18, 4, 25] };
  return [room.center[0] + light.roomRelative[0] * room.size[0], light.roomRelative[1], room.center[2] + light.roomRelative[2] * room.size[2]];
}

function averageLinear(colors) {
  return colors.reduce((sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]], [0, 0, 0]).map((channel) => channel / colors.length);
}

function hexLuminance(hex) {
  return luminance(hexLinearRgb(hex));
}

function luminance(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function chroma(rgb) {
  return Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]);
}

function redDominance(rgb) {
  return rgb[0] - Math.max(rgb[1], rgb[2]);
}

function colorDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function hexLinearRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((digit) => digit + digit).join("") : normalized;
  return [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map((pair) => srgbToLinear(Number.parseInt(pair, 16) / 255));
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function vecDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function round(value) {
  return Number(value.toFixed(4));
}
