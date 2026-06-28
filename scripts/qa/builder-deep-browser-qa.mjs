// Real-browser QA for the /build playtest pack flow (fast + deep) and the
// Raw WebGPU viewmodel modes. Zero dependencies: drives system Chrome over
// the DevTools protocol using Node's built-in WebSocket, against a local
// vite dev server (real IndexedDB, real fetch, real WebGPU when available).
//
// Honesty rules: if Chrome has no WebGPU adapter in automation, every
// raw-rendering check is reported as SKIP (renderer falls back to Three),
// never as PASS.
//
// Usage: node scripts/qa/builder-deep-browser-qa.mjs [--keep-server]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "qa-builder-browser");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5189;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const results = [];
const record = (status, name, detail = "") => {
  results.push({ status, name, detail });
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ""}`);
};

mkdirSync(OUT_DIR, { recursive: true });

// --------------------------------------------------------------------------
// vite dev server
// --------------------------------------------------------------------------
async function startDevServer() {
  const child = spawn("npx", ["vite", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1", "--logLevel", "error"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  for (let attempt = 0; attempt < 120; attempt += 1) {
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

// --------------------------------------------------------------------------
// Chrome + CDP
// --------------------------------------------------------------------------
function chromePath() {
  for (const candidate of CHROME_CANDIDATES) if (existsSync(candidate)) return candidate;
  return null;
}

async function startChrome(binary) {
  mkdirSync(PROFILE_DIR, { recursive: true });
  // A stale port file from a previous run would point at a dead endpoint.
  const stalePortFile = path.join(PROFILE_DIR, "DevToolsActivePort");
  try {
    if (existsSync(stalePortFile)) rmSync(stalePortFile);
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
  const portFile = path.join(PROFILE_DIR, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
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
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.consoleErrors.push(formatRemoteArgs(message.params.args));
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(message.params.exceptionDetails?.exception?.description ?? "uncaught exception");
      }
    });
  }

  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`page evaluate failed: ${result.exceptionDetails.exception?.description ?? "unknown"}`);
    }
    return result.result?.value;
  }

  async waitFor(expression, timeoutMs, label) {
    const startedAt = Date.now();
    for (;;) {
      let value = null;
      try {
        value = await this.evaluate(expression);
      } catch {
        // Page busy (shader compile / asset boot) — keep polling until timeout.
      }
      if (value) return value;
      if (Date.now() - startedAt > timeoutMs) throw new Error(`timeout waiting for ${label}`);
      await sleep(400);
    }
  }

  async screenshot(name) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    const file = path.join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`  screenshot: ${path.relative(ROOT, file)}`);
    return file;
  }

  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  }
}

function formatRemoteArgs(args = []) {
  return args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ");
}

async function openPage(cdp, url, { width = 1440, height = 900, seedDraft = null, clearPacks = false } = {}) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const page = new PageSession(cdp, sessionId);
  page.targetId = targetId;
  await cdp.send("Target.activateTarget", { targetId });
  await page.send("Page.enable", {});
  await page.send("Runtime.enable", {});
  await page.setViewport(width, height);
  if (seedDraft) {
    const clearSnippet = clearPacks
      ? `localStorage.removeItem("human-protocol-builder-runtime-pack-latest-v1");
         localStorage.removeItem("human-protocol-builder-runtime-pack-recent-v1");
         try { indexedDB.deleteDatabase("hp-builder-runtime-packs"); } catch {}`
      : "";
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try {
        localStorage.setItem("human-protocol-builder-draft-v1", ${JSON.stringify(JSON.stringify(seedDraft))});
        ${clearSnippet}
      } catch {}`,
    });
  }
  await page.send("Page.navigate", { url });
  await sleep(600);
  return page;
}

async function closePage(cdp, page) {
  page.detach();
  try {
    await cdp.send("Target.closeTarget", { targetId: page.targetId });
  } catch {
    // already gone
  }
}

async function terminateChild(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", () => resolve(true)));
  child.kill(signal);
  const graceful = await Promise.race([exited, sleep(2500).then(() => false)]);
  if (graceful) return;
  child.kill("SIGKILL");
  await Promise.race([exited, sleep(1000)]);
}

// --------------------------------------------------------------------------
// QA project seed: starter-like with an auto-rig furniture piece
// --------------------------------------------------------------------------
const QA_PROJECT = {
  schemaVersion: "hp.builder.v1",
  projectId: "proj_qa_browser",
  title: "QA 浏览器密室",
  rooms: [
    { id: "room_spawn", label: "出生实验间", style: "sterile", center: [0, 10], size: [10, 6] },
    { id: "room_hall", label: "监控走廊", style: "hazard", center: [0, 3], size: [8, 8] },
    { id: "room_exit", label: "撤离电梯", style: "exit", center: [0, -3.5], size: [6, 5] },
  ],
  doors: [
    { id: "door_a", fromRoomId: "room_spawn", toRoomId: "room_hall", lockType: "none" },
    { id: "door_b", fromRoomId: "room_hall", toRoomId: "room_exit", lockType: "none" },
  ],
  props: [
    { id: "prop_a", modelKey: "room_table_utility", roomId: "room_spawn", position: [3.4, 11.6], rotationY: 0, scale: 1 },
    { id: "prop_current_image2", modelKey: "hp_l4_cineclinic_triage_kiosk", roomId: "room_spawn", position: [-3.2, 11.2], rotationY: 0, scale: 1 },
    { id: "prop_c", modelKey: "room_locker_low", roomId: "room_hall", position: [-3.2, 4.4], rotationY: 0, scale: 1 },
  ],
  robots: [{ id: "robot_a", roomId: "room_hall", archetype: "repair_drone", count: 1 }],
  exitRoomId: "room_exit",
};

// Same shell, but door_b is gallery_reading-locked with a placed reader console.
const GALLERY_QA_PROJECT = {
  ...QA_PROJECT,
  projectId: "proj_qa_gallery",
  title: "QA 展画审读密室",
  doors: [
    { id: "door_a", fromRoomId: "room_spawn", toRoomId: "room_hall", lockType: "none" },
    { id: "door_b", fromRoomId: "room_hall", toRoomId: "room_exit", lockType: "puzzle_complete", puzzleKind: "gallery_reading", puzzleRoomId: "room_hall" },
  ],
  puzzles: [
    { id: "pz_gallery_qa", kind: "gallery_reading", linkedDoorId: "door_b", roomId: "room_hall", position: [0, 3], rotationY: 0 },
  ],
};

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clickPackButton = (label) => `(() => {
  const button = [...document.querySelectorAll(".builder-pack-cluster button")].find((b) => b.textContent.includes(${JSON.stringify(label)}));
  if (!button) return false;
  button.click();
  return true;
})()`;

const packButtonText = `[...document.querySelectorAll(".builder-pack-cluster button")].map((b) => b.textContent).join("|")`;

const backendReadyEvent = `(() => {
  const events = window.__humanProtocolPerfEvents?.() ?? window.__humanProtocolSpikes?.getEvents?.() ?? [];
  const event = events.find((entry) => entry.type === "raw_webgpu_backend_ready");
  return event ? { detail: event.detail, levelId: event.levelId } : null;
})()`;

const startPlaytestSession = `(() => {
  const button = document.querySelector(".flow-entry-overlay button");
  if (button) { button.click(); return true; }
  return !document.querySelector(".flow-entry-overlay");
})()`;

async function enterPlaying(page) {
  // Click through title/intro overlays until none remain (best-effort; the
  // page can stall on shader compilation, so every evaluate may fail once).
  for (let round = 0; round < 8; round += 1) {
    try {
      await page.evaluate(startPlaytestSession);
      await sleep(900);
      const overlayButton = await page.evaluate(`Boolean(document.querySelector(".flow-overlay button"))`);
      if (!overlayButton) break;
      await page.evaluate(`(() => { const b = document.querySelector(".flow-overlay button"); if (b) b.click(); return true; })()`);
    } catch {
      // busy frame — retry next round
    }
    await sleep(900);
  }
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------
const binary = chromePath();
if (!binary) {
  record("SKIP", "browser QA", "no Chrome/Chromium binary found — browser QA not performed");
  process.exit(0);
}

const vite = await startDevServer();
const { child: chrome, wsUrl } = await startChrome(binary);
let hardFailures = 0;
let cdp = null;

try {
  cdp = await Cdp.connect(wsUrl);

  // 0. WebGPU availability in this automation environment.
  const probe = await openPage(cdp, `${BASE}/`);
  const webgpu = await probe.evaluate(
    `navigator.gpu ? navigator.gpu.requestAdapter().then((adapter) => Boolean(adapter)).catch(() => false) : false`,
  );
  await closePage(cdp, probe);
  record(webgpu ? "PASS" : "SKIP", "webgpu adapter in automation", webgpu ? "adapter available" : "no adapter — raw rendering checks below are SKIPPED, fallback behavior still verified");

  // 0b. Catalog furniture drag/drop: card dragstart must arm placement and
  // dropping over the blueprint room floor must create a new furniture node.
  const dragBuild = await openPage(cdp, `${BASE}/build`, { seedDraft: QA_PROJECT, clearPacks: true });
  await dragBuild.waitFor(`Boolean(document.querySelector(".builder-pack-cluster"))`, 20000, "/build drag smoke");
  const groupChipDragReport = JSON.parse(
    (await dragBuild.evaluate(`(async () => {
      const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      const propsTool = [...document.querySelectorAll(".builder-tool, button")]
        .find((button) => /家具|Furniture/.test(button.textContent ?? ""));
      const planView = [...document.querySelectorAll(".builder-viewswitch button")]
        .find((button) => /2D\\s*(视图|View)/.test(button.textContent ?? ""));
      click(planView);
      click(propsTool);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const strip = document.querySelector(".builder-catalog-groupchips");
      const firstButton = strip?.querySelector("button");
      if (!strip || !firstButton) return JSON.stringify({ ok: false, reason: "missing group chip strip" });
      const canScroll = strip.scrollWidth > strip.clientWidth + 4;
      strip.scrollLeft = 0;
      const rect = strip.getBoundingClientRect();
      firstButton.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 17,
        pointerType: "mouse",
        button: 0,
        clientX: rect.right - 18,
        clientY: rect.top + rect.height / 2,
      }));
      strip.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 17,
        pointerType: "mouse",
        buttons: 1,
        clientX: rect.left + 18,
        clientY: rect.top + rect.height / 2,
      }));
      strip.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 17,
        pointerType: "mouse",
        button: 0,
        clientX: rect.left + 18,
        clientY: rect.top + rect.height / 2,
      }));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const repairButton = [...strip.querySelectorAll("button")].find((button) => /维修|Repair/.test(button.textContent ?? ""));
      click(repairButton);
      await new Promise((resolve) => setTimeout(resolve, 120));
      const activeLabel = strip.querySelector("button.active")?.textContent?.replace(/\\s+/g, "").trim() ?? "";
      const visibleHeadings = [...document.querySelectorAll(".builder-catalog-scroll section > h3")]
        .map((heading) => heading.textContent?.replace(/\\s+/g, "").trim() ?? "");
      const filterClickOk = Boolean(repairButton) && /维修|Repair/.test(activeLabel) && visibleHeadings.some((heading) => /维修|Repair/.test(heading));
      return JSON.stringify({
        ok: (!canScroll || strip.scrollLeft > 8) && filterClickOk,
        canScroll,
        before: 0,
        after: strip.scrollLeft,
        filterClickOk,
        activeLabel,
        visibleHeadings: visibleHeadings.slice(0, 6),
        scrollWidth: strip.scrollWidth,
        clientWidth: strip.clientWidth,
      });
    })()`)) ?? "{}",
  );
  record(
    groupChipDragReport.ok ? "PASS" : "FAIL",
    "furniture group chips horizontal drag scrolls",
    JSON.stringify(groupChipDragReport),
  );
  if (!groupChipDragReport.ok) hardFailures += 1;
  const furnitureDragReport = JSON.parse(
    (await dragBuild.evaluate(`(async () => {
      const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      const propsTool = [...document.querySelectorAll(".builder-tool, button")]
        .find((button) => /家具|Furniture/.test(button.textContent ?? ""));
      const planView = [...document.querySelectorAll(".builder-viewswitch button")]
        .find((button) => /2D\\s*(视图|View)/.test(button.textContent ?? ""));
      click(planView);
      click(propsTool);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const card = document.querySelector(".builder-asset-card-main");
      const canvas = document.querySelector(".builder-canvas.editor");
      const floor = document.querySelector(".builder-canvas.editor .builder-room-group .builder-floor");
      if (!card || !canvas || !floor) {
        return JSON.stringify({
          ok: false,
          reason: "missing drag target",
          card: Boolean(card),
          canvas: Boolean(canvas),
          floor: Boolean(floor),
        });
      }
      const before = document.querySelectorAll(".builder-prop-group").length;
      const rect = floor.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;
      const dataTransfer = new DataTransfer();
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const armed = /放置模式|Placement mode/.test(document.body.textContent ?? "");
      const dragOverCanceled = !canvas.dispatchEvent(new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      }));
      canvas.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      }));
      await new Promise((resolve) => setTimeout(resolve, 160));
      const after = document.querySelectorAll(".builder-prop-group").length;
      const status = document.querySelector(".builder-toolbar-status")?.textContent?.trim() ?? "";
      return JSON.stringify({
        ok: card.draggable === true && armed && dragOverCanceled && after > before,
        cardDraggable: card.draggable === true,
        armed,
        dragOverCanceled,
        before,
        after,
        status: status.slice(0, 120),
      });
    })()`)) ?? "{}",
  );
  record(
    furnitureDragReport.ok ? "PASS" : "FAIL",
    "furniture catalog drag/drop places onto blueprint",
    JSON.stringify(furnitureDragReport),
  );
  if (!furnitureDragReport.ok) {
    hardFailures += 1;
    await dragBuild.screenshot("builder-furniture-drag-drop-failed");
  }
  await closePage(cdp, dragBuild);

  // 1. /build flows at 1440x900.
  const build = await openPage(cdp, `${BASE}/build`, { seedDraft: QA_PROJECT, clearPacks: true });
  await build.waitFor(`Boolean(document.querySelector(".builder-pack-cluster"))`, 20000, "/build pack cluster");

  if (!(await build.evaluate(clickPackButton("快速生成")))) throw new Error("快速生成 button not found");
  try {
    await build.waitFor(`(${packButtonText}).includes("快速试玩")`, 60000, "fast pack ready");
    record("PASS", "fast pack generates", "快速生成 → 快速试玩");
  } catch (error) {
    const clusterText = await build.evaluate(packButtonText).catch(() => "?");
    const popText = await build.evaluate(`document.querySelector(".builder-pack-pop")?.textContent ?? ""`).catch(() => "?");
    await build.screenshot("builder-fast-FAILED");
    throw new Error(`fast pack did not become ready. buttons="${clusterText}" pop="${popText}" (${error.message})`);
  }
  await build.screenshot("builder-fast-ready-1440x900");

  if (!(await build.evaluate(clickPackButton("深度烘焙")))) throw new Error("深度烘焙 button not found");
  try {
    await build.waitFor(`(${packButtonText}).includes("深度试玩")`, 180000, "deep pack ready");
    record("PASS", "deep pack bakes", "深度烘焙 → 深度试玩");
  } catch (error) {
    const failure = await build.evaluate(`document.querySelector(".builder-pack-pop.error")?.textContent ?? ""`);
    record("FAIL", "deep pack bakes", failure || String(error));
    hardFailures += 1;
  }
  await build.screenshot("builder-deep-ready-1440x900");

  const pointers = await build.evaluate(`localStorage.getItem("human-protocol-builder-runtime-pack-latest-v1")`);
  const pointerMap = JSON.parse(pointers ?? "{}");
  const fastPointer = pointerMap["proj_qa_browser"];
  const deepPointer = pointerMap["proj_qa_browser::deep"];
  if (!fastPointer?.levelId) throw new Error("fast pointer missing after generation");
  record(deepPointer ? "PASS" : "FAIL", "fast/deep pointers stored per mode", `fast=${Boolean(fastPointer)} deep=${Boolean(deepPointer)}`);
  if (!deepPointer) hardFailures += 1;
  const levelId = fastPointer.levelId;
  const buildConsoleErrors = build.consoleErrors.slice();
  await closePage(cdp, build);

  // 1b. /build at 1366x768 (layout + console + CJK overflow audit).
  const buildSmall = await openPage(cdp, `${BASE}/build`, { width: 1366, height: 768, seedDraft: QA_PROJECT });
  await buildSmall.waitFor(`Boolean(document.querySelector(".builder-pack-cluster"))`, 20000, "/build small viewport");
  await sleep(1500);
  await buildSmall.screenshot("builder-1366x768");
  const overflowReport = await buildSmall.evaluate(`(() => {
    const issues = [];
    for (const selector of [".builder-inspector", ".builder-catalog"]) {
      const el = document.querySelector(selector);
      if (el && el.scrollWidth > el.clientWidth + 1) issues.push(selector + " horizontal overflow " + el.scrollWidth + ">" + el.clientWidth);
    }
    for (const chip of document.querySelectorAll(".builder-asset-card-chip")) {
      const card = chip.closest(".builder-asset-card");
      if (!card) continue;
      const a = chip.getBoundingClientRect();
      const b = card.getBoundingClientRect();
      if (a.right > b.right + 1 || a.left < b.left - 1) {
        issues.push("asset chip out of card: " + chip.textContent.trim().slice(0, 12));
        break;
      }
    }
    const story = document.querySelector(".builder-story-template-card");
    const inspector = document.querySelector(".builder-inspector");
    if (story && inspector) {
      const sr = story.getBoundingClientRect();
      const ir = inspector.getBoundingClientRect();
      if (sr.top > ir.top + ir.height) issues.push("story card below first screen");
    }
    return JSON.stringify(issues);
  })()`);
  const overflowIssues = JSON.parse(overflowReport ?? "[]");
  record(overflowIssues.length === 0 ? "PASS" : "FAIL", "no CJK overflow at 1366x768 (inspector/catalog/chips/story-first-screen)", overflowIssues.slice(0, 3).join(" | ") || "clean");
  if (overflowIssues.length > 0) hardFailures += 1;
  const smallErrors = buildSmall.consoleErrors.slice();
  await closePage(cdp, buildSmall);
  record(
    buildConsoleErrors.length + smallErrors.length === 0 ? "PASS" : "FAIL",
    "builder console clean at 1440x900 + 1366x768",
    buildConsoleErrors.concat(smallErrors).slice(0, 3).join(" | ") || "no console errors",
  );
  if (buildConsoleErrors.length + smallErrors.length > 0) hardFailures += 1;

  // 1c. premium puzzle roster + gallery_reading chip: select the seeded gallery
  // puzzle and confirm the inspector offers the full premium family roster.
  const galleryBuild = await openPage(cdp, `${BASE}/build`, { seedDraft: GALLERY_QA_PROJECT });
  await sleep(1100);
  const nodeFound = await galleryBuild.evaluate(`(() => {
    const node = document.querySelector(".builder-puzzle-node");
    if (!node) return false;
    for (const type of ["pointerdown", "pointerup", "click"]) {
      node.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0 }));
    }
    return true;
  })()`);
  await sleep(500);
  const chipReport = await galleryBuild.evaluate(`(() => {
    const buttons = [...document.querySelectorAll(".builder-puzzlekind-grid button")];
    const labels = buttons.map((b) => b.textContent.replace(/\\s+/g, "").trim());
    return JSON.stringify({ count: buttons.length, labels });
  })()`);
  const chips = JSON.parse(chipReport ?? "{}");
  if (!nodeFound) chips.error = "no puzzle node in canvas";
  const expectedPremium = ["灯序记忆锁", "工具档案校准", "身份压缩柜", "阀门配平台", "展画审读机"];
  const hasAllPremium = expectedPremium.every((label) => (chips.labels ?? []).some((text) => text.includes(label)));
  const galleryPremiumOk = chips.count === expectedPremium.length && hasAllPremium;
  record(
    galleryPremiumOk ? "PASS" : "FAIL",
    `build offers ${expectedPremium.length} premium puzzle chips incl. 展画审读机`,
    chips.error ? chips.error : `count=${chips.count} labels=${(chips.labels ?? []).join("/")}`,
  );
  if (!galleryPremiumOk) hardFailures += 1;
  await galleryBuild.screenshot("builder-gallery-puzzle-chips");
  // Fast pack must bake from a gallery-puzzle project.
  const galleryPackOk = await galleryBuild.evaluate(clickPackButton("快速生成"));
  await sleep(2600);
  const galleryPackText = await galleryBuild.evaluate(packButtonText);
  record(
    galleryPackOk && /试玩/.test(galleryPackText ?? "") ? "PASS" : "FAIL",
    "gallery puzzle project generates a playtest pack",
    `packButtons=${galleryPackText ?? "none"}`,
  );
  const galleryBuildErrors = galleryBuild.consoleErrors.slice();
  await closePage(cdp, galleryBuild);
  record(galleryBuildErrors.length === 0 ? "PASS" : "FAIL", "gallery build console clean", galleryBuildErrors.slice(0, 3).join(" | ") || "no console errors");

  // 1d. gallery reading overlay: open the reader on the smoke gallery level,
  // screenshot the museum evidence desk, answer every drawn question, unlock door.
  const galleryPlay = await openPage(cdp, `${BASE}/?level=smoke_gallery_reading&compat=1&perf=1`);
  await cdp.send("Target.activateTarget", { targetId: galleryPlay.targetId });
  await sleep(1500);
  await enterPlaying(galleryPlay);
  await cdp.send("Target.activateTarget", { targetId: galleryPlay.targetId });
  await sleep(800);
  // Re-open on the freshest world each attempt: the playtest can remount the
  // GameWorld during shader warm-up, and the overlay mounts off a polled
  // snapshot, so keep opening until both the world and the DOM agree.
  let overlayMounted = false;
  let overlayOpened = false;
  let overlayShotTaken = false;
  for (let attempt = 0; attempt < 16 && !overlayShotTaken; attempt += 1) {
    overlayOpened = await galleryPlay.evaluate(`(() => {
      const world = window.__HUMAN_PROTOCOL_WORLD__;
      if (!world || typeof world.openGalleryReading !== "function") return false;
      if (world.activeGalleryReadingPuzzle?.()) return true;
      return world.openGalleryReading("smoke_gallery_reading_puzzle");
    })()`);
    await sleep(300);
    overlayMounted = await galleryPlay.evaluate(`Boolean(document.querySelector(".gallery-reading-overlay .gallery-reading-card"))`);
    if (overlayMounted) {
      // Capture immediately while the panel is up — the world can remount and
      // tear the polled overlay down within a frame or two.
      await galleryPlay.screenshot("gallery-reading-overlay");
      overlayShotTaken = await galleryPlay.evaluate(`Boolean(document.querySelector(".gallery-reading-overlay .gallery-reading-card"))`);
    }
  }
  record(overlayOpened && overlayShotTaken ? "PASS" : "FAIL", "gallery reading overlay opens (evidence desk)", `opened=${overlayOpened} mounted=${overlayMounted} shot=${overlayShotTaken}`);
  if (!(overlayOpened && overlayShotTaken)) hardFailures += 1;
  // Answer each question correctly: match the displayed prompt to the puzzle's
  // answer painting title, then click the matching answer card.
  let answered = 0;
  for (let round = 0; round < 12; round += 1) {
    const completedNow = await galleryPlay.evaluate(`Boolean(window.__HUMAN_PROTOCOL_WORLD__?.isPuzzleCompleted?.("smoke_gallery_reading_puzzle"))`);
    if (completedNow) break;
    const stillOpen = await galleryPlay.evaluate(`(() => {
      if (document.querySelector(".gallery-reading-overlay .gallery-reading-card")) return true;
      // World may have remounted mid-run; re-open on the current world.
      const world = window.__HUMAN_PROTOCOL_WORLD__;
      if (world && typeof world.openGalleryReading === "function") world.openGalleryReading("smoke_gallery_reading_puzzle");
      return false;
    })()`);
    if (!stillOpen) {
      await sleep(400);
      continue;
    }
    const clicked = await galleryPlay.evaluate(`(() => {
      const world = window.__HUMAN_PROTOCOL_WORLD__;
      const puzzle = world?.activeGalleryReadingPuzzle?.();
      const prompt = document.querySelector(".gallery-reading-prompt strong")?.textContent?.trim();
      if (!puzzle || !prompt) return false;
      const question = puzzle.questions.find((q) => q.prompt.trim() === prompt);
      if (!question) return false;
      const choice = question.choices.find((c) => c.id === question.answerId);
      const title = choice?.label;
      const button = [...document.querySelectorAll(".gallery-reading-choice")].find((b) => b.textContent.trim() === title);
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (clicked) answered += 1;
    // Wait past the reveal/advance animation (620ms) before the next question.
    await sleep(1100);
  }
  const galleryUnlocked = await galleryPlay.evaluate(`(() => {
    const world = window.__HUMAN_PROTOCOL_WORLD__;
    return Boolean(world && world.isPuzzleCompleted("smoke_gallery_reading_puzzle"));
  })()`);
  record(galleryUnlocked ? "PASS" : "FAIL", "gallery reading: answer questions unlocks door", `answered=${answered} completed=${galleryUnlocked}`);
  if (!galleryUnlocked) hardFailures += 1;
  const galleryPlayErrors = galleryPlay.consoleErrors.slice();
  await closePage(cdp, galleryPlay);
  record(galleryPlayErrors.length === 0 ? "PASS" : "FAIL", "gallery playtest console clean", galleryPlayErrors.slice(0, 3).join(" | ") || "no console errors");

  // 2. playtest flows.
  const playtest = async (name, query, { expectEvent = true, timeoutMs = 40000 } = {}) => {
    const page = await openPage(cdp, `${BASE}/?level=${levelId}${query}&perf=1`);
    await sleep(1500);
    await enterPlaying(page);
    let event = null;
    if (expectEvent) {
      try {
        event = await page.waitFor(backendReadyEvent, timeoutMs, `${name} backend ready`);
      } catch {
        event = null;
      }
    } else {
      await sleep(6000);
      event = await page.evaluate(backendReadyEvent);
    }
    await sleep(1200);
    return { page, event };
  };

  if (webgpu) {
    const fast = await playtest("fast", "&pack=fast");
    const fastDetail = fast.event?.detail ?? {};
    record(
      fastDetail.assetSource === "builder-runtime-pack-v1" ? "PASS" : "FAIL",
      "fast playtest uses proxy pack",
      `assetSource=${fastDetail.assetSource ?? "none"}`,
    );
    if (fastDetail.assetSource !== "builder-runtime-pack-v1") hardFailures += 1;
    await fast.page.screenshot("playtest-fast");
    await closePage(cdp, fast.page);

    const deep = await playtest("deep", "&pack=deep");
    const deepDetail = deep.event?.detail ?? {};
    record(
      deepDetail.assetSource === "builder-runtime-pack-v2+cooked-glb" ? "PASS" : "FAIL",
      "deep playtest uses cooked pack",
      `assetSource=${deepDetail.assetSource ?? "none"} viewmodelMode=${deepDetail.viewmodelMode ?? "?"}`,
    );
    if (deepDetail.assetSource !== "builder-runtime-pack-v2+cooked-glb") hardFailures += 1;
    await deep.page.screenshot("playtest-deep-furniture");
    const deepConsole = deep.page.consoleErrors.slice();
    await closePage(cdp, deep.page);
    record(deepConsole.length === 0 ? "PASS" : "FAIL", "deep playtest console clean", deepConsole.slice(0, 3).join(" | ") || "no console errors");
    if (deepConsole.length > 0) hardFailures += 1;

    // Viewmodel modes on the deep pack. The old native raw weapon path is
    // retired: even legacy raw URLs must resolve to the Three new-equipment
    // overlay so QA cannot accidentally showcase the wrong first-person kit.
    const vmRaw = await playtest("viewmodel raw retired alias", "&pack=deep&rawViewmodelMode=raw&rawViewmodelExperimental=1");
    const vmRawDetail = vmRaw.event?.detail ?? {};
    record(
      vmRawDetail.viewmodelMode === "three" ? "PASS" : "FAIL",
      "rawViewmodelMode=raw resolves to the Three new-equipment overlay",
      `viewmodelMode=${vmRawDetail.viewmodelMode ?? "?"} assets=${vmRawDetail.viewmodelAssetSource ?? "?"}`,
    );
    record(
      vmRawDetail.viewmodelArticulated && vmRawDetail.viewmodelArticulated !== "none" ? "PASS" : "FAIL",
      "deep pack still cooks utility viewmodel node chunks for skill deployables",
      `articulated=${vmRawDetail.viewmodelArticulated ?? "?"}`,
    );
    if (vmRawDetail.viewmodelMode !== "three") hardFailures += 1;
    const overlayInRaw = await vmRaw.page.evaluate(`Boolean(document.querySelector(".raw-webgpu-viewmodel-layer"))`);
    record(overlayInRaw ? "PASS" : "FAIL", "legacy raw mode mounts the Three overlay", `overlay=${overlayInRaw}`);
    if (!overlayInRaw) hardFailures += 1;
    await vmRaw.page.screenshot("viewmodel-three-sidearm-from-raw-alias");
    // Fire the sidearm and capture mid-recoil (slide back + muzzle flash).
    await vmRaw.page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 720, y: 450, button: "left", clickCount: 1 });
    await vmRaw.page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 720, y: 450, button: "left", clickCount: 1 });
    await sleep(70);
    await vmRaw.page.screenshot("viewmodel-three-sidearm-firing-from-raw-alias");
    await sleep(900);
    // Switch to the rod (Digit1) for the second weapon screenshot.
    await vmRaw.page.send("Input.dispatchKeyEvent", { type: "keyDown", code: "Digit1", key: "1", windowsVirtualKeyCode: 49 });
    await vmRaw.page.send("Input.dispatchKeyEvent", { type: "keyUp", code: "Digit1", key: "1", windowsVirtualKeyCode: 49 });
    await sleep(1400);
    await vmRaw.page.screenshot("viewmodel-three-rod-from-raw-alias");
    await closePage(cdp, vmRaw.page);

    const vmThree = await playtest("viewmodel three", "&pack=deep&rawViewmodelMode=three");
    const threeOverlay = await vmThree.page.evaluate(`Boolean(document.querySelector(".raw-webgpu-viewmodel-layer"))`);
    record(threeOverlay ? "PASS" : "FAIL", "rawViewmodelMode=three mounts overlay", `overlay=${threeOverlay}`);
    if (!threeOverlay) hardFailures += 1;
    await closePage(cdp, vmThree.page);

    const vmOff = await playtest("viewmodel off", "&pack=deep&rawViewmodelMode=off");
    const offOverlay = await vmOff.page.evaluate(`Boolean(document.querySelector(".raw-webgpu-viewmodel-layer"))`);
    const offDetail = vmOff.event?.detail ?? {};
    record(
      !offOverlay && offDetail.viewmodelMode === "off" ? "PASS" : "FAIL",
      "rawViewmodelMode=off hides weapon",
      `viewmodelMode=${offDetail.viewmodelMode ?? "?"} overlay=${offOverlay}`,
    );
    if (offOverlay || offDetail.viewmodelMode !== "off") hardFailures += 1;
    await closePage(cdp, vmOff.page);

    // Official level 01 with a legacy raw URL should still use the Three overlay.
    const official = await openPage(cdp, `${BASE}/?level=level_01_maintenance_bay&rawViewmodelMode=raw&rawViewmodelExperimental=1&perf=1`);
    await sleep(1500);
    await enterPlaying(official);
    let officialEvent = null;
    try {
      officialEvent = await official.waitFor(backendReadyEvent, 60000, "official level backend ready");
    } catch {
      officialEvent = null;
    }
    const officialDetail = officialEvent?.detail ?? {};
    record(
      officialDetail.viewmodelMode === "three" ? "PASS" : "FAIL",
      "official level 01 legacy raw URL resolves to Three viewmodel",
      `viewmodelMode=${officialDetail.viewmodelMode ?? "?"} assets=${officialDetail.viewmodelAssetSource ?? "?"} assetSource=${officialDetail.assetSource ?? "?"}`,
    );
    if (officialDetail.viewmodelMode !== "three") hardFailures += 1;
    const officialOverlay = await official.evaluate(`Boolean(document.querySelector(".raw-webgpu-viewmodel-layer"))`);
    record(officialOverlay ? "PASS" : "FAIL", "official legacy raw URL mounts overlay", `overlay=${officialOverlay}`);
    if (!officialOverlay) hardFailures += 1;
    await sleep(1500);
    await official.screenshot("official-level01-three-viewmodel-from-raw-alias");
    await closePage(cdp, official);
  } else {
    record("SKIP", "fast/deep playtest raw rendering", "WebGPU unavailable in automation — would fall back to Three");
    record("SKIP", "viewmodel raw/three/off rendering", "WebGPU unavailable in automation");
    record("SKIP", "official level 01 Three viewmodel overlay", "WebGPU unavailable in automation");
  }

  // compat must force Three regardless of WebGPU.
  const compat = await playtest("compat", "&compat=1", { expectEvent: false });
  const compatHasRawCanvas = await compat.page.evaluate(`Boolean(document.querySelector(".raw-webgpu-canvas"))`);
  const compatOk = !compat.event && !compatHasRawCanvas;
  record(compatOk ? "PASS" : "FAIL", "?compat=1 forces ThreeJS", `rawBackendEvent=${Boolean(compat.event)} rawCanvas=${compatHasRawCanvas}`);
  if (!compatOk) hardFailures += 1;
  await compat.page.screenshot("playtest-compat-three");
  await closePage(cdp, compat.page);
} finally {
  try {
    cdp?.ws?.close();
  } catch {
    // best effort; process cleanup below handles Chrome itself.
  }
  await terminateChild(chrome);
  if (!process.argv.includes("--keep-server")) await terminateChild(vite);
}

writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log(`report: ${path.relative(ROOT, path.join(OUT_DIR, "report.json"))}`);
if (hardFailures > 0) {
  console.error(`BROWSER QA FAILED: ${hardFailures} failing check(s)`);
  process.exit(1);
}
console.log("BROWSER QA DONE");
process.exit(0);
