import fs from "node:fs";
import path from "node:path";

const manifestDir = path.join(process.cwd(), "src/assets/manifests");
const viewports = [
  [2048, 1280],
  [1920, 1080],
  [1600, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [900, 540],
  [812, 375],
  // Small landscape phones (the campaign forces landscape via LandscapeGuard).
  [768, 375], // iPhone landscape
  [667, 375], // iPhone SE2/8 landscape
  [568, 320], // iPhone SE1 / smallest supported landscape
];

const issues = [];
const reports = viewports.map(([width, height]) => auditViewport(width, height));
const report = {
  generatedAt: new Date().toISOString(),
  objective: "human_protocol_combat_gui_non_overlapping_viewport_layout",
  formulas: {
    scale: "sqrt((w*h)/(1920*1080)) clamped to [0.74, 1.14]",
    reservedTopRows: "hud/settings occupy first row; objective fits between reserved left and right, or moves below hud in compact viewports",
    reservedBottomRows: "weapon panel owns bottom-right; aim/mission prompts are centered with width reduced by action panel reserve",
    warningNotice: "spawn and critical warnings use --hp-notice-y, below the objective/guidance stack and above bottom controls",
    overlap: "intersection_area(rectA, rectB) must be 0 for active combat GUI rectangles",
  },
  viewports: reports,
  summary: {
    critical: issues.length,
    checkedViewports: viewports.length,
  },
  issues,
};

fs.mkdirSync(manifestDir, { recursive: true });
fs.writeFileSync(path.join(manifestDir, "gui_layout_audit_report.json"), `${JSON.stringify(report, null, 2)}\n`);

if (issues.length > 0) {
  console.error(`GUI layout audit failed: ${issues.length} overlap issue(s)`);
  for (const issue of issues) {
    console.error(`  ${issue.viewport}: ${issue.a} overlaps ${issue.b} area=${issue.area}`);
  }
  process.exit(1);
}

console.log(`GUI layout audit passed: ${viewports.length} viewports`);
console.log("Wrote src/assets/manifests/reports/gui_layout_audit_report.json");

function auditViewport(width, height) {
  const layout = computeCombatGuiLayout(width, height);
  const compact = width < 1180 || height < 680;
  const mobile = width <= 900;
  const rects = [];

  rects.push({
    id: "hud",
    x: layout.edge,
    y: layout.edge,
    w: layout.hudWidth,
    h: layout.hudHeight,
  });
  rects.push({
    id: "settings",
    x: width - layout.edge - layout.settingsWidth,
    y: layout.edge,
    w: layout.settingsWidth,
    h: layout.settingsHeight,
  });

  const objective = objectiveRect(width, height, layout, compact, mobile);
  rects.push(objective);

  if (!mobile) {
    const actionHeight = layout.actionCluster + 92;
    rects.push({
      id: "actionHud",
      x: width - layout.edge - layout.actionPanelWidth,
      y: height - layout.edge - actionHeight,
      w: layout.actionPanelWidth,
      h: actionHeight,
    });
  }

  const promptWidth = Math.max(0, Math.min(380, mobile ? width - layout.edge * 2 : width - layout.actionPanelWidth - layout.edge * 4));
  if (promptWidth > 0) {
    rects.push({
      id: "desktopAimOrMission",
      x: (width - promptWidth) / 2,
      y: height - layout.edge - 54,
      w: promptWidth,
      h: 54,
    });
    rects.push({
      id: "interactionOrReward",
      x: (width - promptWidth) / 2,
      y: height - layout.edge - 124,
      w: promptWidth,
      h: 58,
    });
  }

  const warningWidth = height < 560 ? 0 : Math.max(0, Math.min(420, width - layout.edge * 2));
  if (warningWidth > 0) {
    rects.push({
      id: "warningNotice",
      x: (width - warningWidth) / 2,
      y: layout.noticeY,
      w: warningWidth,
      h: 54,
    });
  }

  for (let left = 0; left < rects.length; left += 1) {
    for (let right = left + 1; right < rects.length; right += 1) {
      const a = rects[left];
      const b = rects[right];
      if (isAllowedStack(a.id, b.id)) continue;
      const area = intersectionArea(a, b);
      if (area > 0.5) {
        issues.push({
          viewport: `${width}x${height}`,
          a: a.id,
          b: b.id,
          area: round(area),
          rectA: roundRect(a),
          rectB: roundRect(b),
        });
      }
    }
  }

  return {
    viewport: `${width}x${height}`,
    layout,
    rects: rects.map(roundRect),
  };
}

function objectiveRect(width, height, layout, compact, mobile) {
  if (compact) {
    const rightReserve = mobile ? layout.edge : layout.edge + layout.settingsWidth + layout.gap;
    const availableWidth = Math.max(320, width - layout.edge - rightReserve);
    const boxWidth = Math.min(layout.objectiveWidth, availableWidth);
    return {
      id: "objective",
      x: layout.edge + Math.max(0, (availableWidth - boxWidth) / 2),
      y: layout.edge + layout.hudHeight + 6,
      w: boxWidth,
      h: layout.objectiveHeight,
    };
  }

  const left = layout.edge + layout.hudWidth + layout.gap;
  const right = layout.edge + layout.settingsWidth + layout.gap;
  const availableWidth = Math.max(320, width - left - right);
  const boxWidth = Math.min(layout.objectiveWidth, availableWidth);
  return {
    id: "objective",
    x: left + (availableWidth - boxWidth) / 2,
    y: layout.edge,
    w: boxWidth,
    h: layout.objectiveHeight,
  };
}

function computeCombatGuiLayout(widthInput, heightInput) {
  const width = Math.max(320, Math.round(widthInput));
  const height = Math.max(240, Math.round(heightInput));
  const shortSide = Math.min(width, height);
  const areaScale = clamp(Math.sqrt((width * height) / (1920 * 1080)), 0.74, 1.14);
  const compact = width < 1180 || height < 680;
  const shallow = height < 720;

  const edge = round(clamp(shortSide * 0.018, 12, 28) * (compact ? 0.9 : 1));
  const gap = round(clamp(width * 0.014, 14, 34));
  const hudWidth = round(clamp(width * 0.165, compact ? 220 : 250, compact ? 300 : 340) * (shallow ? 0.88 : 1));
  const hudHeight = round(hudWidth * (228 / 560));
  const settingsWidth = round(clamp(width * 0.054, 84, 116));
  const settingsHeight = round(clamp(height * 0.044, 42, 56));
  const objectiveAvailable = Math.max(320, width - edge * 2 - hudWidth - settingsWidth - gap * 2);
  const objectiveMax = round(Math.min(clamp(width * 0.36, 420, 720), objectiveAvailable));
  const objectiveWidth = objectiveMax;
  const objectiveHeight = round(objectiveWidth * (165 / 880));
  const actionCluster = round(clamp(Math.min(width * 0.15, height * 0.23), compact ? 170 : 190, compact ? 230 : 260));
  const actionPanelWidth = round(actionCluster + clamp(actionCluster * 0.16, 26, 40));
  const actionSlot = round(actionCluster * 0.38);
  const actionMainSlot = round(actionCluster * 0.43);
  const actionItemSlot = round(actionCluster * 0.36);
  const topReserve = round(edge + Math.max(hudHeight, settingsHeight) + gap);
  const bottomReserve = round(edge + actionCluster + 84);
  const objectiveY = compact ? edge + hudHeight + 6 : edge;
  const noticeMaxY = Math.max(edge, height - bottomReserve - 72);
  const noticeY = round(Math.min(noticeMaxY, Math.max(topReserve, objectiveY + objectiveHeight + 8)));

  return {
    width,
    height,
    scale: round(areaScale, 3),
    edge,
    gap,
    hudWidth,
    hudHeight,
    settingsWidth,
    settingsHeight,
    objectiveWidth,
    objectiveHeight,
    objectiveMax,
    actionCluster,
    actionPanelWidth,
    actionSlot,
    actionMainSlot,
    actionItemSlot,
    topReserve,
    bottomReserve,
    noticeY,
    typeXs: round(clamp(height * 0.0092 * areaScale, 9, 12)),
    typeSm: round(clamp(height * 0.0108 * areaScale, 10, 14)),
    typeMd: round(clamp(height * 0.0145 * areaScale, 13, 18)),
    typeLg: round(clamp(height * 0.019 * areaScale, 16, 24)),
  };
}

function isAllowedStack(a, b) {
  const pair = new Set([a, b]);
  return pair.has("desktopAimOrMission") && pair.has("interactionOrReward");
}

function intersectionArea(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundRect(rect) {
  return {
    id: rect.id,
    x: round(rect.x),
    y: round(rect.y),
    w: round(rect.w),
    h: round(rect.h),
  };
}
