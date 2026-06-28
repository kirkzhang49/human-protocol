// Visual evidence: drive the real /build → playtest flow, open the identity
// compression cabinet (archive_merge) overlay, and screenshot it so the robot
// identity-tier sprites + recessed slots are confirmed in a real browser.
//
// Standalone (reuses the same CDP harness shape as builder-deep-browser-qa).
// Usage: node scripts/qa/builder-archive-overlay-evidence.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "qa-archive-evidence");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5191;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(OUT_DIR, { recursive: true });

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
      /* not up yet */
    }
    await sleep(250);
  }
  child.kill("SIGTERM");
  throw new Error("vite dev server did not start");
}

function chromePath() {
  for (const candidate of CHROME_CANDIDATES) if (existsSync(candidate)) return candidate;
  return null;
}

async function startChrome(binary) {
  mkdirSync(PROFILE_DIR, { recursive: true });
  const stalePortFile = path.join(PROFILE_DIR, "DevToolsActivePort");
  try {
    if (existsSync(stalePortFile)) rmSync(stalePortFile);
  } catch {
    /* best effort */
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
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") this.consoleErrors.push(formatRemoteArgs(message.params.args));
      if (message.method === "Runtime.exceptionThrown") this.consoleErrors.push(message.params.exceptionDetails?.exception?.description ?? "uncaught exception");
    });
  }
  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(`page evaluate failed: ${result.exceptionDetails.exception?.description ?? "unknown"}`);
    return result.result?.value;
  }
  async waitFor(expression, timeoutMs, label) {
    const startedAt = Date.now();
    for (;;) {
      let value = null;
      try {
        value = await this.evaluate(expression);
      } catch {
        /* busy frame */
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
      source: `try { localStorage.setItem("human-protocol-builder-draft-v1", ${JSON.stringify(JSON.stringify(seedDraft))}); ${clearSnippet} } catch {}`,
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
    /* gone */
  }
}

const clickPackButton = (label) => `(() => {
  const button = [...document.querySelectorAll(".builder-pack-cluster button")].find((b) => b.textContent.includes(${JSON.stringify(label)}));
  if (!button) return false;
  button.click();
  return true;
})()`;
const packButtonText = `[...document.querySelectorAll(".builder-pack-cluster button")].map((b) => b.textContent).join("|")`;
const startPlaytestSession = `(() => {
  const button = document.querySelector(".flow-entry-overlay button");
  if (button) { button.click(); return true; }
  return !document.querySelector(".flow-entry-overlay");
})()`;

async function enterPlaying(page) {
  for (let round = 0; round < 8; round += 1) {
    try {
      await page.evaluate(startPlaytestSession);
      await sleep(900);
      const overlayButton = await page.evaluate(`Boolean(document.querySelector(".flow-overlay button"))`);
      if (!overlayButton) break;
      await page.evaluate(`(() => { const b = document.querySelector(".flow-overlay button"); if (b) b.click(); return true; })()`);
    } catch {
      /* busy */
    }
    await sleep(900);
  }
}

// Archive-merge-locked exit shell: door_b → 撤离电梯 gated by an identity cabinet.
const ARCHIVE_PROJECT = {
  schemaVersion: "hp.builder.v1",
  projectId: "proj_qa_archive",
  title: "QA 身份压缩密室",
  rooms: [
    { id: "room_spawn", label: "出生实验间", style: "sterile", center: [0, 10], size: [10, 6] },
    { id: "room_hall", label: "监控走廊", style: "hazard", center: [0, 3], size: [8, 8] },
    { id: "room_exit", label: "撤离电梯", style: "exit", center: [0, -3.5], size: [6, 5] },
  ],
  doors: [
    { id: "door_a", fromRoomId: "room_spawn", toRoomId: "room_hall", lockType: "none" },
    { id: "door_b", fromRoomId: "room_hall", toRoomId: "room_exit", lockType: "puzzle_complete", puzzleKind: "archive_merge", puzzleRoomId: "room_hall" },
  ],
  puzzles: [{ id: "pz_archive_qa", kind: "archive_merge", linkedDoorId: "door_b", roomId: "room_hall", position: [0, 3], rotationY: 0 }],
  props: [],
  robots: [],
  exitRoomId: "room_exit",
};

const binary = chromePath();
if (!binary) {
  console.log("SKIP — no Chrome/Chromium binary found");
  process.exit(0);
}

const vite = await startDevServer();
const { child: chrome, wsUrl } = await startChrome(binary);
let ok = false;
try {
  const cdp = await Cdp.connect(wsUrl);

  // Generate a fast pack for the archive project (overlay is DOM — fast suffices).
  const build = await openPage(cdp, `${BASE}/build`, { seedDraft: ARCHIVE_PROJECT, clearPacks: true });
  await build.waitFor(`Boolean(document.querySelector(".builder-pack-cluster"))`, 20000, "/build pack cluster");
  if (!(await build.evaluate(clickPackButton("快速生成")))) throw new Error("快速生成 not found");
  try {
    await build.waitFor(`(${packButtonText}).includes("快速试玩")`, 90000, "fast pack ready");
  } catch (error) {
    const buttons = await build.evaluate(packButtonText).catch(() => "?");
    const pop = await build.evaluate(`document.querySelector(".builder-pack-pop")?.textContent ?? ""`).catch(() => "?");
    await build.screenshot("archive-build-FAILED");
    throw new Error(`${error.message} | buttons="${buttons}" pop="${pop}"`);
  }
  const pointers = JSON.parse((await build.evaluate(`localStorage.getItem("human-protocol-builder-runtime-pack-latest-v1")`)) ?? "{}");
  const levelId = pointers["proj_qa_archive"]?.levelId;
  await closePage(cdp, build);
  if (!levelId) throw new Error("fast pointer missing");
  console.log(`  levelId=${levelId}`);

  // Playtest, then drive the archive cabinet overlay open on the live world.
  const play = await openPage(cdp, `${BASE}/?level=${levelId}&pack=fast&compat=1&perf=1`);
  await cdp.send("Target.activateTarget", { targetId: play.targetId });
  await sleep(1500);
  await enterPlaying(play);
  await cdp.send("Target.activateTarget", { targetId: play.targetId });
  await sleep(900);

  // Builder-pack playtest sits behind the title flow; start the run directly on
  // the live world (the entry button just calls world.startDemo()).
  for (let round = 0; round < 16; round += 1) {
    const mode = await play.evaluate(`(() => {
      const world = window.__HUMAN_PROTOCOL_WORLD__;
      if (!world) return "?";
      if (world.session?.mode === "title" && typeof world.startDemo === "function") { try { world.startDemo(); } catch {} }
      return world.session?.mode ?? "?";
    })()`).catch(() => "?");
    if (round === 0) console.log(`  startMode=${mode}`);
    if (mode === "playing") break;
    await sleep(700);
  }
  await cdp.send("Target.activateTarget", { targetId: play.targetId });
  // Headless reports document.hidden=true even when activated, and the overlay's
  // polled snapshot bails while hidden. Force visibility so the poll runs.
  await play.evaluate(`(() => {
    try {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    } catch {}
    return true;
  })()`).catch(() => false);
  await sleep(600);

  const diag = await play.evaluate(`(() => {
    const world = window.__HUMAN_PROTOCOL_WORLD__;
    return JSON.stringify({
      hasWorld: Boolean(world),
      hasOpen: typeof world?.openArchiveMerge,
      puzzleIds: (world?.level?.puzzles ?? world?.config?.puzzles ?? []).map((p) => p.id),
      mode: world?.session?.mode,
      flow: Boolean(document.querySelector(".flow-overlay, .flow-entry-overlay")),
    });
  })()`).catch((e) => `diag-error: ${e.message}`);
  console.log(`  diag=${diag}`);

  let shot = false;
  for (let attempt = 0; attempt < 18 && !shot; attempt += 1) {
    const opened = await play.evaluate(`(() => {
      const world = window.__HUMAN_PROTOCOL_WORLD__;
      if (!world || typeof world.openArchiveMerge !== "function") return false;
      if (world.activeArchiveMergePuzzle?.()) return true;
      const ids = (world.level?.puzzles ?? world.config?.puzzles ?? []).map((p) => p.id);
      const archiveId = ids.find((id) => id.includes("door_b")) ?? "pz_door_b";
      return world.openArchiveMerge(archiveId);
    })()`).catch(() => false);
    await sleep(350);
    // Seed a few filled tiles so the robot sprites are guaranteed visible.
    const mounted = await play.evaluate(`Boolean(document.querySelector(".archive-merge-board"))`).catch(() => false);
    if (attempt < 3) {
      const st = await play.evaluate(`(() => {
        const w = window.__HUMAN_PROTOCOL_WORLD__;
        return JSON.stringify({ opened: ${opened === true}, active: Boolean(w?.activeArchiveMergePuzzle?.()), mode: w?.session?.mode, overlay: Boolean(document.querySelector(".archive-merge-overlay")), board: Boolean(document.querySelector(".archive-merge-board")) });
      })()`).catch((e) => `err:${e.message}`);
      console.log(`  attempt#${attempt}: ${st}`);
    }
    if (mounted) {
      // Play a couple of moves to populate/merge tiles for a richer shot.
      for (const key of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"]) {
        await play.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: key === "ArrowLeft" ? 37 : key === "ArrowUp" ? 38 : key === "ArrowRight" ? 39 : 40 });
        await play.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key });
        await sleep(180);
      }
      const filled = await play.evaluate(`document.querySelectorAll(".archive-merge-tile.filled").length`).catch(() => 0);
      await play.screenshot("archive-merge-overlay");
      console.log(`  opened=${opened} filledTiles=${filled}`);
      shot = (filled ?? 0) > 0;
    }
  }
  const consoleErrors = play.consoleErrors.slice();
  await closePage(cdp, play);
  console.log(`  console errors: ${consoleErrors.length ? consoleErrors.slice(0, 4).join(" | ") : "none"}`);
  ok = shot;
  console.log(ok ? "\nPASS archive cabinet overlay captured with robot tiles" : "\nFAIL archive overlay not captured");
} finally {
  try {
    chrome.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  try {
    vite.kill("SIGTERM");
  } catch {
    /* ignore */
  }
}
process.exit(ok ? 0 : 1);
