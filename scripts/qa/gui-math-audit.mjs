import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const stylesDir = path.join(repoRoot, "src/styles");
const manifestDir = path.join(repoRoot, "src/assets/manifests");
const cssFiles = fs
  .readdirSync(stylesDir)
  .filter((file) => file.endsWith(".css"))
  .sort()
  .map((file) => path.join(stylesDir, file));

const cssText = cssFiles.map((file) => `/* ${path.basename(file)} */\n${fs.readFileSync(file, "utf8")}`).join("\n");
const guiMathTs = readText("src/ui/guiMath.ts");
const guiAssetManifest = JSON.parse(readText("src/assets/manifests/runtime/gui_age_v3_asset_manifest.json"));
const blocks = parseCssBlocks(cssText);
const issues = [];

const thresholds = {
  minTouchTargetPx: 44,
  recommendedCombatTouchPx: 58,
  minOverlayButtonPx: 44,
  minProgressBarPx: 6,
  minBodyContrast: 4.5,
  minLargeTextContrast: 3,
  maxUiShadowLoss: 0.34,
  minUiShadowClamp: 0.66,
};

const zIndexBands = [
  { name: "world-hints", min: 1, max: 9, selectors: [".threat-ring", ".cockpit"] },
  { name: "combat-input", min: 10, max: 16, selectors: [".mobile-controls", ".run-progress", ".lower-hud"] },
  { name: "dialogue-reward", min: 17, max: 24, selectors: [".dialogue-toast", ".flow-overlay", ".upgrade-overlay", ".choice-overlay"] },
  { name: "modal-debug", min: 30, max: 120, selectors: [".code-lock", ".pause", ".debug", ".landscape-guard", ".system-settings-button"] },
];

const colorVars = extractRootColors(cssText);
const bg = parseHexColor(colorVars.bg ?? "#05070b");
const colorChecks = [
  { token: "--text", color: colorVars.text, min: thresholds.minBodyContrast },
  { token: "--muted", color: colorVars.muted, min: thresholds.minBodyContrast },
  { token: "--cyan", color: colorVars.cyan, min: thresholds.minLargeTextContrast },
  { token: "--red", color: colorVars.red, min: thresholds.minLargeTextContrast },
  { token: "--orange", color: colorVars.orange, min: thresholds.minLargeTextContrast },
];

for (const check of colorChecks) {
  const fg = check.color ? parseHexColor(check.color) : null;
  if (!fg || !bg) {
    addIssue("critical", "color-token-missing", `${check.token} or --bg is missing/unsupported`, check.token);
    continue;
  }
  const ratio = contrastRatio(fg, bg);
  if (ratio < check.min) {
    addIssue("critical", "contrast-ratio", `${check.token} contrast ${ratio.toFixed(2)} < ${check.min}`, check.token, {
      ratio,
      min: check.min,
    });
  }
}

const touchSelectors = [
  ".joystick",
  ".mobile-dash-button",
  ".mobile-interact-button",
  ".mobile-action",
  ".mobile-action:nth-child(1)",
  ".mobile-action:nth-child(2)",
  ".mobile-action:nth-child(3)",
  ".mobile-action.primary",
];

for (const selector of touchSelectors) {
  const dims = dimensionsFor(selector, blocks);
  if (!dims) {
    addIssue("warning", "touch-selector-missing", `No CSS dimensions found for ${selector}`, selector);
    continue;
  }
  const minAxis = Math.min(dims.width ?? dims.minWidth ?? Infinity, dims.height ?? dims.minHeight ?? Infinity);
  if (minAxis < thresholds.minTouchTargetPx) {
    addIssue("critical", "touch-target-too-small", `${selector} has ${minAxis}px target < ${thresholds.minTouchTargetPx}px`, selector, dims);
  } else if (selector.includes("mobile-action") && minAxis < thresholds.recommendedCombatTouchPx) {
    addIssue("warning", "combat-target-near-floor", `${selector} has ${minAxis}px target; recommended >= ${thresholds.recommendedCombatTouchPx}px`, selector, dims);
  }
}

for (const selector of [".flow-panel button", ".flow-panel .config-pack-actions button", ".flow-panel .config-pack-body > button"]) {
  const dims = dimensionsFor(selector, blocks);
  if (!dims) continue;
  const height = dims.minHeight ?? dims.height;
  if (height && height < thresholds.minOverlayButtonPx) {
    const severity = selector.includes("config-pack") ? "warning" : "critical";
    addIssue(severity, "overlay-button-height", `${selector} min-height ${height}px < ${thresholds.minOverlayButtonPx}px`, selector, dims);
  }
}

const transferBar = dimensionsFor(".level-transfer-bar", blocks);
if (!transferBar || (transferBar.height ?? 0) < thresholds.minProgressBarPx) {
  addIssue("critical", "loading-progress-bar", `.level-transfer-bar height must be >= ${thresholds.minProgressBarPx}px`, ".level-transfer-bar", transferBar ?? {});
}

if (!/loadingProgressFloor:\s*0\.025/.test(guiMathTs) || !/visibleProgressScale/.test(readText("src/ui/GameFlowOverlay.tsx"))) {
  addIssue("critical", "loading-progress-floor", "Level transfer bar needs a visible progress floor of 2.5%", "GameFlowOverlay");
}
if (!/1 - Math\.pow\(1 - clamped,\s*3\)/.test(guiMathTs)) {
  addIssue("warning", "loading-ease-missing", "Level transfer should use monotonic ease-out progress for perceived continuity", "GameFlowOverlay");
}

const zIndexes = [];
for (const block of blocks) {
  const z = numberProp(block.body, "z-index");
  if (z === undefined) continue;
  zIndexes.push({ selector: block.selector, zIndex: z });
  const band = zIndexBands.find((candidate) => candidate.selectors.some((prefix) => block.selector.includes(prefix)));
  if (band && (z < band.min || z > band.max)) {
    addIssue("warning", "z-index-band", `${block.selector} z-index ${z} outside ${band.name} band ${band.min}-${band.max}`, block.selector, {
      zIndex: z,
      band: band.name,
    });
  }
}

const letterSpacingMatches = [...cssText.matchAll(/letter-spacing\s*:\s*([^;]+);/g)].map((match) => match[1].trim());
const nonZeroLetterSpacing = letterSpacingMatches.filter((value) => value !== "0");
if (nonZeroLetterSpacing.length > 0) {
  addIssue("warning", "letter-spacing-nonzero", `Non-zero letter-spacing appears ${nonZeroLetterSpacing.length} time(s); keep compact GUI text at 0 unless specifically art-directed`, "css", {
    values: [...new Set(nonZeroLetterSpacing)],
  });
}

const image2GuiSpec = {
  targetResolution: "author at 2x UI scale, export with transparent alpha",
  sourceOfTruth: "/Users/zhengkaizhang/Documents/webgpu-robot-lab/asset-lab/math/gui/HUMAN_PROTOCOL_IMAGE2_GUI_MATH_SYSTEM.md",
  safeZone: {
    landscape: "keep critical labels inside inset max(24px, env(safe-area-inset-*)); leave right/bottom combat controls unobstructed",
    portrait: "landscape guard owns z-index 120 and should hide gameplay GUI behind it",
  },
  linearCompositing: {
    srgbToLinear: "c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4",
    uiComposite: "C = alpha * C_ui_linear + (1 - alpha) * C_scene_linear",
    shadowClamp: `readabilityShadow = max(${thresholds.minUiShadowClamp}, 1 - shadowLoss)`,
  },
  depthAwareOverlay: {
    visibility: "visible_ui = z_ui <= z_scene + epsilon",
    epsilonMeters: 0.03,
    mode: "overlay samples scene exposure/depth stats; world-space panels may write depth",
  },
};

const guiAssets = Object.entries(guiAssetManifest.assets).map(([key, relativePath]) => {
  const absolutePath = path.join(repoRoot, relativePath);
  const exists = fs.existsSync(absolutePath);
  const bytes = exists ? fs.statSync(absolutePath).size : 0;
  const basename = path.basename(relativePath);
  const cssSelectors = guiAssetManifest.cssBindings?.[key] ?? [];
  if (!exists) {
    addIssue("critical", "gui-asset-missing", `${key} image2 GUI asset is missing: ${relativePath}`, relativePath);
  } else if (bytes > 512 * 1024) {
    addIssue("warning", "gui-asset-large", `${key} image2 GUI asset is ${(bytes / 1024).toFixed(1)}KB; keep direct GUI plates lean`, relativePath, {
      bytes,
    });
  }
  if (exists && cssSelectors.length > 0 && !cssText.includes(basename)) {
    addIssue("critical", "gui-asset-css-unbound", `${key} exists but CSS does not reference ${basename}`, relativePath);
  }
  for (const selector of cssSelectors) {
    const selectorBlocks = blocks.filter((block) => block.selector.split(",").map((part) => part.trim()).includes(selector));
    const bound = selectorBlocks.some((block) => block.body.includes(basename));
    if (!bound) {
      addIssue("warning", "gui-selector-binding", `${selector} is expected to use ${basename}; check cascade/order if intentional`, selector, {
        asset: key,
      });
    }
  }
  return { key, path: relativePath, exists, bytes, cssSelectors };
});

const report = {
  generatedAt: new Date().toISOString(),
  sourcePdf: "/Users/zhengkaizhang/Downloads/面向3D艺术与游戏引擎 Agent 建模的高等数学、二进制编码与光影控制研究报告.pdf",
  thresholds,
  summary: {
    critical: issues.filter((issue) => issue.severity === "critical").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    cssFiles: cssFiles.map((file) => path.relative(repoRoot, file)),
  },
  formulas: {
    srgbToLinear: "c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4",
    relativeLuminance: "Y = 0.2126 R_linear + 0.7152 G_linear + 0.0722 B_linear",
    wcagContrast: "(max(Y1,Y2)+0.05)/(min(Y1,Y2)+0.05)",
    overlayCompositeLinear: "C_out = alpha*C_ui + (1-alpha)*C_scene",
    depthVisibility: "visible_ui = z_ui <= z_scene + epsilon",
    shadowCompare: "shadow = z_light > z_shadow + bias",
    readableShadowClamp: `shadow_ui = max(${thresholds.minUiShadowClamp}, shadow_raw)`,
    loadingProgress: "p = 0.72 + (0.92 - 0.72) * (1 - (1 - t)^3)",
  },
  colorVars,
  colorChecks: colorChecks.map((check) => ({
    token: check.token,
    color: check.color,
    contrast: check.color && bg ? contrastRatio(parseHexColor(check.color), bg) : null,
    min: check.min,
  })),
  zIndexes,
  guiAssets,
  image2GuiSpec,
  issues,
};

fs.mkdirSync(manifestDir, { recursive: true });
fs.writeFileSync(path.join(manifestDir, "gui_math_audit_report.json"), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(manifestDir, "gui_math_audit_report.md"), markdownReport(report));

if (report.summary.critical > 0) {
  console.error(`GUI math audit failed: ${report.summary.critical} critical, ${report.summary.warning} warning`);
  process.exit(1);
}

console.log(`GUI math audit passed: ${report.summary.critical} critical, ${report.summary.warning} warning`);
console.log("Wrote src/assets/manifests/reports/gui_math_audit_report.json");

function parseCssBlocks(text) {
  const result = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const cleanText = text.replace(/\/\*[\s\S]*?\*\//g, "");
  let match;
  while ((match = re.exec(cleanText))) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2];
    if (selector.startsWith("@")) continue;
    result.push({ selector, body });
  }
  return result;
}

function dimensionsFor(selector, allBlocks) {
  const matches = allBlocks.filter((block) => block.selector.split(",").map((part) => part.trim()).includes(selector));
  if (matches.length === 0) return null;
  const dims = {};
  for (const block of matches) {
    const width = pxProp(block.body, "width");
    const height = pxProp(block.body, "height");
    const minWidth = pxProp(block.body, "min-width");
    const minHeight = pxProp(block.body, "min-height");
    if (width !== undefined) dims.width = width;
    if (height !== undefined) dims.height = height;
    if (minWidth !== undefined) dims.minWidth = minWidth;
    if (minHeight !== undefined) dims.minHeight = minHeight;
  }
  return Object.keys(dims).length > 0 ? dims : null;
}

function pxProp(body, prop) {
  const match = body.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`));
  if (!match) return undefined;
  const values = [...match[1].matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((candidate) => Number(candidate[1]));
  if (values.length === 0) return undefined;
  if (match[1].includes("min(") || match[1].includes("max(") || match[1].includes("clamp(")) {
    return Math.min(...values);
  }
  return values[0];
}

function numberProp(body, prop) {
  const match = body.match(new RegExp(`${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?);`));
  return match ? Number(match[1]) : undefined;
}

function extractRootColors(text) {
  // Merge custom properties from EVERY :root block (there are ~5 across the
  // concatenated stylesheets); later definitions win, matching CSS cascade.
  const colors = {};
  for (const root of text.matchAll(/:root\s*\{([\s\S]*?)\}/g)) {
    for (const match of root[1].matchAll(/--([a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      colors[match[1]] = match[2];
    }
  }
  return colors;
}

function parseHexColor(hex) {
  if (!hex) return null;
  const normalized = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const match = normalized.match(/^#([0-9a-fA-F]{6})/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
  return 0.2126 * srgbToLinear(color.r) + 0.7152 * srgbToLinear(color.g) + 0.0722 * srgbToLinear(color.b);
}

function contrastRatio(a, b) {
  const y1 = luminance(a);
  const y2 = luminance(b);
  return (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function addIssue(severity, code, message, selector, data = {}) {
  issues.push({ severity, code, message, selector, ...data });
}

function markdownReport(reportData) {
  const lines = [
    "# Human Protocol GUI Math Audit",
    "",
    `Generated: ${reportData.generatedAt}`,
    "",
    `Critical: ${reportData.summary.critical}`,
    `Warning: ${reportData.summary.warning}`,
    "",
    "## Formula Contract",
    "",
    `- sRGB -> linear: \`${reportData.formulas.srgbToLinear}\``,
    `- luminance: \`${reportData.formulas.relativeLuminance}\``,
    `- contrast: \`${reportData.formulas.wcagContrast}\``,
    `- linear overlay: \`${reportData.formulas.overlayCompositeLinear}\``,
    `- depth visibility: \`${reportData.formulas.depthVisibility}\``,
    `- UI shadow clamp: \`${reportData.formulas.readableShadowClamp}\``,
    `- loading progress: \`${reportData.formulas.loadingProgress}\``,
    "",
    "## Image2 GUI Contract",
    "",
    `- Source of truth: ${reportData.image2GuiSpec.sourceOfTruth}`,
    `- Target export: ${reportData.image2GuiSpec.targetResolution}`,
    `- Depth mode: ${reportData.image2GuiSpec.depthAwareOverlay.mode}`,
    "",
    "## Issues",
    "",
  ];
  if (reportData.issues.length === 0) {
    lines.push("No issues.");
  } else {
    for (const issue of reportData.issues) {
      lines.push(`- [${issue.severity}] ${issue.code}: ${issue.message}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
