#!/usr/bin/env node
// Image2 state-lab screenshot harness (read-only proof, additive — does NOT
// touch the pinned qa:builder:browser suite).
//
// Opens the dev-only Image2 state lab (/build?image2Lab=1, see
// src/ui/Image2StateLab.tsx) in headless Chrome over the DevTools protocol —
// same zero-dependency harness as generate-builder-asset-thumbnails — captures
// the full state grid, then drives window.__image2Lab.setState(kit, state) to
// screenshot every state of every Batch 01 hero GUI kit. This proves the
// parts/regions atlases really switch locked/active/solved/disabled/danger/
// choice/error layers at runtime, not just that the files exist.
//
// Output: .tmp/level06-10-hero-assets/image2-states/*.png
// Usage: node scripts/qa/image2-state-lab-shots.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp/level06-10-hero-assets/image2-states");
const PROFILE_DIR = path.join(ROOT, ".tmp", "image2-lab-chrome-profile");
const PORT = 5194;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function chromePath() {
  for (const candidate of CHROME_CANDIDATES) if (existsSync(candidate)) return candidate;
  throw new Error("no Chrome/Chromium found for image2 lab capture");
}

async function startChrome(binary) {
  mkdirSync(PROFILE_DIR, { recursive: true });
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
      "--force-device-scale-factor=1",
      "--window-size=1440,1000",
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
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolve(message.result);
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
      }, 120000);
    });
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description ?? "unknown"}`);
  }
  return result.result?.value;
}

async function capture(cdp, sessionId, file, clip) {
  const params = { format: "png", captureBeyondViewport: true };
  if (clip) params.clip = { ...clip, scale: 1 };
  const { data } = await cdp.send("Page.captureScreenshot", params, sessionId);
  writeFileSync(file, Buffer.from(data, "base64"));
}

mkdirSync(OUT_DIR, { recursive: true });
const vite = await startDevServer();
const chrome = await startChrome(chromePath());
let failures = 0;
let shots = 0;
try {
  const cdp = await Cdp.connect(chrome.wsUrl);
  const { targetId } = await cdp.send("Target.createTarget", { url: `${BASE}/build?image2Lab=1` });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.enable", {}, sessionId);

  for (let attempt = 0; ; attempt += 1) {
    const ready = await evaluate(cdp, sessionId, "Boolean(window.__image2LabReady)").catch(() => false);
    if (ready) break;
    if (attempt > 100) throw new Error("image2 lab did not become ready");
    await sleep(300);
  }
  await sleep(700); // let GUI PNGs decode

  // 1) Full state grid (proves every state of every kit renders at once).
  const metrics = await cdp.send("Page.getLayoutMetrics", {}, sessionId);
  const cs = metrics.cssContentSize ?? metrics.contentSize;
  await capture(cdp, sessionId, path.join(OUT_DIR, "image2-state-grid.png"), {
    x: 0,
    y: 0,
    width: Math.ceil(cs.width),
    height: Math.ceil(cs.height),
  });
  shots += 1;
  console.log("  ✓ image2-state-grid.png");

  // 2) Per-kit, per-state focus captures via the runtime setState API.
  const kits = await evaluate(cdp, sessionId, "window.__image2Lab.kits");
  if (!Array.isArray(kits) || kits.length === 0) throw new Error("no kits exposed by __image2Lab");
  for (const kit of kits) {
    for (const state of kit.states) {
      try {
        await evaluate(cdp, sessionId, `window.__image2Lab.setState(${JSON.stringify(kit.id)}, ${JSON.stringify(state)})`);
        await sleep(260);
        const file = path.join(OUT_DIR, `${kit.id}-${state}.png`);
        await capture(cdp, sessionId, file);
        shots += 1;
        console.log(`  ✓ ${kit.id}-${state}.png`);
      } catch (error) {
        failures += 1;
        console.error(`  ✗ ${kit.id}-${state}: ${error.message}`);
      }
    }
  }
  await evaluate(cdp, sessionId, "window.__image2Lab.clear()").catch(() => {});
} finally {
  chrome.child.kill("SIGTERM");
  vite.kill("SIGTERM");
}

console.log(`\nImage2 state lab: ${shots} screenshots → ${path.relative(ROOT, OUT_DIR)}`);
if (failures > 0) {
  console.error(`${failures} captures failed`);
  process.exit(1);
}
