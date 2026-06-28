// Captures real-Chrome screenshots of the recomposed route-switch overlay in
// its locked (no-key) and authorized states, at desktop and mobile-landscape
// sizes, so the diegetic-machine composition can be reviewed as pixels rather
// than described. Self-contained: spawns a vite dev server + headless Chrome
// over the DevTools protocol (Node's built-in WebSocket), mounts the REAL
// overlay via /route-overlay-preview.html, and writes PNGs to
// .tmp/qa-route-overlay/. Honest: any state that fails to render is reported.
//
// Run: node scripts/qa/route-overlay-shot.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "qa-route-overlay");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5191;
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
      const response = await fetch(`${BASE}/route-overlay-preview.html`);
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
      "--force-device-scale-factor=2",
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
        if (message.error) reject(new Error(`${message.error.message}`));
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
      }, 60000);
    });
  }
  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

async function main() {
  const binary = chromePath();
  if (!binary) {
    console.log("SKIP route-overlay-shot — no Chrome/Chromium installed");
    process.exit(0);
  }

  const vite = await startDevServer();
  const { child: chrome, wsUrl } = await startChrome(binary);
  const cdp = await Cdp.connect(wsUrl);
  let failures = 0;

  const shots = [
    { state: "locked", w: 1440, h: 810, name: "route-overlay-locked-1440x810" },
    { state: "authorized", w: 1440, h: 810, name: "route-overlay-authorized-1440x810" },
    { state: "rotating", w: 1440, h: 810, name: "route-overlay-rotating-1440x810", settleMs: 340 },
    { state: "authorized", w: 844, h: 390, name: "route-overlay-authorized-mobile-844x390" },
  ];

  try {
    for (const shot of shots) {
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      const errors = [];
      const detach = cdp.onEvent((message) => {
        if (message.sessionId !== sessionId) return;
        if (message.method === "Runtime.exceptionThrown") {
          errors.push(message.params.exceptionDetails?.exception?.description ?? "uncaught exception");
        }
      });
      const send = (method, params) => cdp.send(method, params, sessionId);
      await send("Page.enable", {});
      await send("Runtime.enable", {});
      await send("Emulation.setDeviceMetricsOverride", { width: shot.w, height: shot.h, deviceScaleFactor: 2, mobile: false });
      await send("Page.navigate", { url: `${BASE}/route-overlay-preview.html?state=${shot.state}` });

      // Wait for the panel + its console background image to be laid out.
      const started = Date.now();
      let ready = false;
      while (Date.now() - started < 20000) {
        const result = await send("Runtime.evaluate", {
          expression: `(() => {
            const p = document.querySelector('.route-switch-panel');
            if (!p) return false;
            const bays = document.querySelectorAll('.route-switch-plate').length;
            const lens = document.querySelector('.route-switch-key');
            return Boolean(p && bays >= 4 && lens);
          })()`,
          returnByValue: true,
        });
        if (result.result?.value) {
          ready = true;
          break;
        }
        await sleep(300);
      }
      if (!ready) {
        failures += 1;
        console.error(`FAIL ${shot.name} — panel did not render`);
      } else {
        // Let the atlas-sliced parts + fonts settle, then capture.
        await sleep(shot.settleMs ?? 900);
        const png = await send("Page.captureScreenshot", { format: "png" });
        const file = path.join(OUT_DIR, `${shot.name}.png`);
        writeFileSync(file, Buffer.from(png.data, "base64"));
        const bays = await send("Runtime.evaluate", {
          expression: `document.querySelectorAll('.route-switch-plate').length`,
          returnByValue: true,
        });
        console.log(`PASS ${shot.name} — ${bays.result?.value} output bays — ${path.relative(ROOT, file)}`);
      }
      if (errors.length) console.error(`  page errors: ${errors.join(" | ")}`);
      detach();
      await cdp.send("Target.closeTarget", { targetId });
    }
  } finally {
    try {
      chrome.kill("SIGTERM");
    } catch {
      // best effort
    }
    try {
      vite.kill("SIGTERM");
    } catch {
      // best effort
    }
  }

  console.log(failures === 0 ? "ALL PASS route-overlay-shot" : `FAILED route-overlay-shot (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("FAIL route-overlay-shot threw:", error?.stack ?? error);
  process.exit(1);
});
