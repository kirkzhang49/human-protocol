// Visual evidence for the redesigned valve_matrix gate-balance overlay.
// Drives the real smoke_valve_matrix level in Chrome, opens the live overlay,
// captures initial, solved, and mobile states, and checks core DOM geometry.
//
// Run: node scripts/qa/gate-balance-overlay-evidence.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAYOUT = JSON.parse(readFileSync(path.join(ROOT, "src/assets/gui/gate-balance-three-row/gate_balance_three_row_layout_v1.json"), "utf8"));
const OUT_DIR = path.join(ROOT, ".tmp", "qa-gate-balance");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5192;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(OUT_DIR, { recursive: true });

function chromePath() {
  for (const candidate of CHROME_CANDIDATES) if (existsSync(candidate)) return candidate;
  return null;
}

async function startDevServer() {
  const child = spawn("npx", ["vite", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1", "--logLevel", "error"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/`);
      if (response.ok) return child;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  child.kill("SIGTERM");
  throw new Error("vite dev server did not start");
}

async function startChrome(binary) {
  mkdirSync(PROFILE_DIR, { recursive: true });
  const portFile = path.join(PROFILE_DIR, "DevToolsActivePort");
  try {
    if (existsSync(portFile)) rmSync(portFile);
  } catch {
    // best effort
  }
  const child = spawn(
    binary,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${PROFILE_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--mute-audio",
      "--enable-unsafe-webgpu",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (existsSync(portFile)) {
      const [port, browserPath] = readFileSync(portFile, "utf8").trim().split("\n");
      if (port && browserPath) return { child, wsUrl: `ws://127.0.0.1:${port}${browserPath}` };
    }
    await sleep(150);
  }
  child.kill("SIGTERM");
  throw new Error("Chrome DevTools endpoint did not appear");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolve(message.result);
      } else if (message.method) {
        for (const listener of this.listeners) listener(message);
      }
    });
  }
  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener("open", () => resolve(new Cdp(ws)));
      ws.addEventListener("error", () => reject(new Error("CDP websocket failed")));
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 90000);
    });
  }
  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

class PageSession {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.consoleErrors = [];
    this.detach = cdp.onEvent((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(message.params.exceptionDetails?.exception?.description ?? "uncaught exception");
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.consoleErrors.push(formatRemoteArgs(message.params.args));
      }
    });
  }
  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "page evaluate failed");
    return result.result?.value;
  }
  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  }
  async waitFor(expression, timeoutMs, label) {
    const startedAt = Date.now();
    for (;;) {
      let value = null;
      try {
        value = await this.evaluate(expression);
      } catch {
        // busy frame
      }
      if (value) return value;
      if (Date.now() - startedAt > timeoutMs) throw new Error(`timeout waiting for ${label}`);
      await sleep(300);
    }
  }
  async screenshot(name) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    const file = path.join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`  screenshot: ${path.relative(ROOT, file)}`);
    return file;
  }
}

function formatRemoteArgs(args = []) {
  return args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ");
}

async function openPage(cdp, url, { width = 1440, height = 900 } = {}) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const page = new PageSession(cdp, sessionId);
  page.targetId = targetId;
  await cdp.send("Target.activateTarget", { targetId });
  await page.send("Page.enable", {});
  await page.send("Runtime.enable", {});
  await page.setViewport(width, height);
  await page.send("Page.navigate", { url });
  return page;
}

async function closePage(cdp, page) {
  page.detach();
  try {
    await cdp.send("Target.closeTarget", { targetId: page.targetId });
  } catch {
    // gone
  }
}

const forceVisibleAndOpen = `(() => {
  try {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  } catch {}
  const world = window.__HUMAN_PROTOCOL_WORLD__;
  if (!world) return { hasWorld: false };
  if (world.session?.mode === "title" && typeof world.startDemo === "function") {
    try { world.startDemo(); } catch {}
  }
  return {
    hasWorld: true,
    opened: typeof world.openValveMatrix === "function" ? world.openValveMatrix("smoke_valve_matrix_puzzle") : false,
    mode: world.session?.mode,
    puzzles: (world.level?.puzzles ?? world.config?.puzzles ?? []).map((p) => p.id),
  };
})()`;

const solveToTarget = `(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const controls = [...document.querySelectorAll(".gate-balance-three-row-control")];
  const target = [5, 4, 3];
  for (let index = 0; index < controls.length; index += 1) {
    const control = controls[index];
    const minus = control.querySelector(".gate-balance-three-row-minus");
    const plus = control.querySelector(".gate-balance-three-row-plus");
    for (let guard = 0; guard < 16; guard += 1) {
      const value = Number(control.querySelector(".gate-balance-three-row-control-value")?.textContent ?? "0");
      if (value === target[index]) break;
      if (value < target[index]) plus?.click();
      else minus?.click();
      await sleep(70);
    }
  }
  return {
    values: controls.map((control) => Number(control.querySelector(".gate-balance-three-row-control-value")?.textContent ?? "0")),
    status: document.querySelector(".gate-balance-three-row-status")?.textContent ?? "",
    canLock: !document.querySelector(".gate-balance-three-row-lock")?.disabled,
  };
})()`;

const geometryAudit = `(() => {
  const panel = document.querySelector(".gate-balance-three-row-panel");
  if (!panel) return { ok: false, reason: "panel missing" };
  const rect = panel.getBoundingClientRect();
  const count = (selector) => document.querySelectorAll(selector).length;
  const hasOverflow = (el) => {
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return false;
    return el.scrollWidth > Math.ceil(box.width) + 2 || el.scrollHeight > Math.ceil(box.height) + 2;
  };
  const overflowButtons = [...document.querySelectorAll(".gate-balance-three-row-control button")]
    .filter(hasOverflow)
    .map((el) => el.textContent?.trim() ?? el.className);
  const overflowText = [...document.querySelectorAll(".gate-balance-three-row-title strong,.gate-balance-three-row-guidance,.gate-balance-three-row-gauge-label,.gate-balance-three-row-gauge-badge,.gate-balance-three-row-gauge-value,.gate-balance-three-row-control-label,.gate-balance-three-row-control-value-number,.gate-balance-three-row-status,.gate-balance-three-row-countdown,.gate-balance-three-row-lock-text")]
    .filter(hasOverflow)
    .map((el) => el.textContent?.trim() ?? el.className);
  const forbiddenText = document.body.textContent?.includes("达标") || document.body.textContent?.includes("Reset");
  const countdownBackground = getComputedStyle(document.querySelector(".gate-balance-three-row-countdown")).backgroundImage;
  const lockBackground = getComputedStyle(document.querySelector(".gate-balance-three-row-lock")).backgroundImage;
  const duplicateButtonSkins = [countdownBackground, lockBackground].some((value) => value && value !== "none");
  const committing = panel.classList.contains("committing");
  return {
    ok: rect.width > 500 && rect.height > 300 && !forbiddenText && !duplicateButtonSkins,
    panel: [Math.round(rect.width), Math.round(rect.height)],
    gauges: count(".gate-balance-three-row-gauge"),
    controls: count(".gate-balance-three-row-control"),
    ledBars: count(".gate-balance-three-row-control-value-leds i"),
    overflowButtons,
    overflowText,
    forbiddenText,
    duplicateButtonSkins,
    committing,
    buttonBackgrounds: { countdown: countdownBackground, lock: lockBackground },
    title: document.querySelector(".gate-balance-three-row-title strong")?.textContent ?? "",
    status: document.querySelector(".gate-balance-three-row-status")?.textContent ?? "",
    countdown: document.querySelector(".gate-balance-three-row-countdown")?.textContent ?? "",
    lockText: document.querySelector(".gate-balance-three-row-lock-text")?.textContent ?? "",
  };
})()`;

const commitLock = `(() => {
  const button = document.querySelector(".gate-balance-three-row-lock");
  if (!button) return { clicked: false, reason: "lock missing" };
  button.click();
  return {
    clicked: true,
    lockText: document.querySelector(".gate-balance-three-row-lock-text")?.textContent ?? "",
    mode: window.__HUMAN_PROTOCOL_WORLD__?.session?.mode ?? "",
  };
})()`;

const completionAudit = `(() => {
  const world = window.__HUMAN_PROTOCOL_WORLD__;
  return {
    panelVisible: Boolean(document.querySelector(".gate-balance-three-row-panel")),
    mode: world?.session?.mode ?? "",
    completed: Boolean(world?.session?.mapProgress?.completedPuzzleIds?.includes("smoke_valve_matrix_puzzle")),
    interactionCompleted: Boolean(world?.session?.mapProgress?.completedInteractionIds?.includes("smoke_valve_matrix_panel")),
  };
})()`;

const pixelAlignmentAudit = (layout) => `(() => {
  const layout = ${JSON.stringify(layout)};
  const [canvasW, canvasH] = layout.canvas;
  const regions = layout.regions;
  const panel = document.querySelector(".gate-balance-three-row-panel");
  if (!panel) return { ok: false, reason: "panel missing" };
  const panelRect = panel.getBoundingClientRect();
  const toSourceCenter = (el) => {
    const rect = el.getBoundingClientRect();
    return [
      ((rect.left + rect.width / 2 - panelRect.left) / panelRect.width) * canvasW,
      ((rect.top + rect.height / 2 - panelRect.top) / panelRect.height) * canvasH,
    ];
  };
  const targetCenter = (name) => {
    const [x, y, w, h] = regions[name];
    return [x + w / 2, y + h / 2];
  };
  const entries = [];
  const add = (label, el, targetName, tolerance = 2.5) => {
    if (!el) {
      entries.push({ label, targetName, ok: false, missing: true });
      return;
    }
    const actual = toSourceCenter(el);
    const target = targetCenter(targetName);
    const dx = actual[0] - target[0];
    const dy = actual[1] - target[1];
    const dist = Math.hypot(dx, dy);
    entries.push({ label, targetName, actual: actual.map((v) => Math.round(v * 10) / 10), target, dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10, dist: Math.round(dist * 10) / 10, ok: dist <= tolerance });
  };
  const controls = [...document.querySelectorAll(".gate-balance-three-row-control")];
  const gauges = [...document.querySelectorAll(".gate-balance-three-row-gauge")];
  gauges.forEach((gauge, index) => {
    const row = layout.rows[index];
    add(\`row\${index}GaugeLabel\`, gauge.querySelector(".gate-balance-three-row-gauge-label"), row.slots.gaugeLabel);
    add(\`row\${index}GaugeBadge\`, gauge.querySelector(".gate-balance-three-row-gauge-badge"), row.slots.gaugeBadge);
    add(\`row\${index}GaugeBar\`, gauge.querySelector(".gate-balance-three-row-gauge-bar"), row.slots.gaugeBar);
    add(\`row\${index}GaugeValue\`, gauge.querySelector(".gate-balance-three-row-gauge-value"), row.slots.gaugeValue);
  });
  controls.forEach((control, index) => {
    const row = layout.rows[index];
    add(\`row\${index}ControlMinus\`, control.querySelector(".gate-balance-three-row-minus"), row.slots.minus);
    add(\`row\${index}ControlValue\`, control.querySelector(".gate-balance-three-row-control-value"), row.slots.value);
    add(\`row\${index}ControlPlus\`, control.querySelector(".gate-balance-three-row-plus"), row.slots.plus);
    add(\`row\${index}ControlTrack\`, control.querySelector(".gate-balance-three-row-control-track"), row.slots.controlTrack);
  });
  add("countdown", document.querySelector(".gate-balance-three-row-countdown"), "countdownText", 3);
  add("lockButton", document.querySelector(".gate-balance-three-row-lock"), "lockButton", 3);
  add("lockText", document.querySelector(".gate-balance-three-row-lock-text"), "lockButtonText", 3);
  const failed = entries.filter((entry) => !entry.ok);
  return { ok: failed.length === 0, failed, entries };
})()`;

const binary = chromePath();
if (!binary) {
  console.log("SKIP gate-balance-overlay-evidence — no Chrome/Chromium installed");
  process.exit(0);
}

const vite = await startDevServer();
const { child: chrome, wsUrl } = await startChrome(binary);
let ok = false;
try {
  const cdp = await Cdp.connect(wsUrl);
  const page = await openPage(cdp, `${BASE}/?level=smoke_valve_matrix&debug=1&perf=1`, { width: 1440, height: 900 });
  await page.waitFor(`Boolean(window.__HUMAN_PROTOCOL_WORLD__)`, 45000, "game world");
  await sleep(1200);
  const opened = await page.evaluate(forceVisibleAndOpen);
  console.log(`  open: ${JSON.stringify(opened)}`);
  await page.waitFor(`Boolean(document.querySelector(".gate-balance-three-row-panel"))`, 15000, "gate balance overlay");
  await sleep(900);
  const initialAudit = await page.evaluate(geometryAudit);
  if (!initialAudit.ok || initialAudit.gauges !== 3 || initialAudit.controls !== 3) {
    throw new Error(`geometry audit failed: ${JSON.stringify(initialAudit)}`);
  }
  await page.screenshot("gate-balance-overlay-initial-1440x900");

  const solved = await page.evaluate(solveToTarget);
  console.log(`  solved: ${JSON.stringify(solved)}`);
  await sleep(450);
  const solvedAudit = await page.evaluate(geometryAudit);
  if (!solved.canLock || solvedAudit.overflowButtons.length) {
    throw new Error(`solved audit failed: ${JSON.stringify({ solved, solvedAudit })}`);
  }
  const solvedPixelAudit = await page.evaluate(pixelAlignmentAudit(LAYOUT));
  console.log(`  pixelAlign: ${JSON.stringify({ ok: solvedPixelAudit.ok, failed: solvedPixelAudit.failed })}`);
  if (!solvedPixelAudit.ok) throw new Error(`pixel alignment failed: ${JSON.stringify(solvedPixelAudit.failed)}`);
  await page.screenshot("gate-balance-overlay-solved-1440x900");

  await page.setViewport(844, 390);
  await sleep(900);
  const mobileAudit = await page.evaluate(geometryAudit);
  if (!mobileAudit.ok || mobileAudit.gauges !== 3 || mobileAudit.controls !== 3) {
    throw new Error(`mobile audit failed: ${JSON.stringify(mobileAudit)}`);
  }
  await page.screenshot("gate-balance-overlay-solved-mobile-844x390");

  await page.setViewport(1440, 900);
  await sleep(450);
  const committed = await page.evaluate(commitLock);
  console.log(`  commit: ${JSON.stringify(committed)}`);
  await sleep(260);
  const commitAudit = await page.evaluate(geometryAudit);
  if (!committed.clicked || !commitAudit.committing || !/已锁定|Locked/.test(commitAudit.lockText)) {
    throw new Error(`commit linger failed: ${JSON.stringify({ committed, commitAudit })}`);
  }
  await page.screenshot("gate-balance-overlay-commit-1440x900");
  await sleep(1050);
  const doneAudit = await page.evaluate(completionAudit);
  if (doneAudit.panelVisible || doneAudit.mode !== "playing" || !doneAudit.completed || !doneAudit.interactionCompleted) {
    throw new Error(`completion audit failed: ${JSON.stringify(doneAudit)}`);
  }
  const consoleErrors = page.consoleErrors.slice();
  await closePage(cdp, page);
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.slice(0, 4).join(" | ")}`);
  ok = true;
  console.log("\nPASS gate-balance overlay captured and audited");
} finally {
  try {
    chrome.kill("SIGTERM");
  } catch {
    // ignore
  }
  try {
    vite.kill("SIGTERM");
  } catch {
    // ignore
  }
}

process.exit(ok ? 0 : 1);
