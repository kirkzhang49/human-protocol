// Fast iteration loop for player-facing Three viewmodel pose tuning: reuses the deep
// pack persisted by builder-deep-browser-qa.mjs (same Chrome profile) and
// captures one screenshot per weapon. Not part of CI — a tuning tool.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "qa-builder-browser");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5189;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LEVEL_ID = "builder_level_qa_browser";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureServer() {
  try {
    if ((await fetch(`${BASE}/`)).ok) return null;
  } catch {
    // not running
  }
  const child = spawn("npx", ["vite", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1", "--logLevel", "error"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return child;
    } catch {
      // wait
    }
    await sleep(250);
  }
  throw new Error("vite did not start");
}

const portFile = path.join(PROFILE_DIR, "DevToolsActivePort");
if (existsSync(portFile)) rmSync(portFile);
const vite = await ensureServer();
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${PROFILE_DIR}`,
  "--no-first-run",
  "--hide-scrollbars",
  "--mute-audio",
  "--enable-unsafe-webgpu",
  "--window-size=1440,900",
  "about:blank",
]);
let wsUrl = null;
for (let attempt = 0; attempt < 100 && !wsUrl; attempt += 1) {
  if (existsSync(portFile)) {
    const [port, browserPath] = readFileSync(portFile, "utf8").trim().split("\n");
    if (port && browserPath) wsUrl = `ws://127.0.0.1:${port}${browserPath}`;
  }
  await sleep(150);
}
if (!wsUrl) throw new Error("no devtools endpoint");

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", () => reject(new Error("ws failed")));
});
const pending = new Map();
let nextId = 1;
ws.addEventListener("message", (event) => {
  const message = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout ${method}`));
      }
    }, 60000);
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Target.activateTarget", { targetId });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
const VIEW_W = Number(process.env.PEEK_W ?? 1440);
const VIEW_H = Number(process.env.PEEK_H ?? 900);
await send("Emulation.setDeviceMetricsOverride", { width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1, mobile: false }, sessionId);
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  return result.result?.value;
};
await send("Page.navigate", { url: `${BASE}/?level=${LEVEL_ID}&pack=deep&rawViewmodelMode=three&perf=1` }, sessionId);
await sleep(2500);
for (let round = 0; round < 8; round += 1) {
  try {
    const clicked = await evaluate(`(() => { const b = document.querySelector(".flow-overlay button"); if (b) { b.click(); return true; } return false; })()`);
    if (!clicked) break;
  } catch {
    // busy
  }
  await sleep(900);
}
await sleep(2500);
const shoot = async (name) => {
  const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(shot.data, "base64"));
  console.log(`saved ${name}.png`);
};
await shoot(process.env.PEEK_PREFIX ? `${process.env.PEEK_PREFIX}-sidearm` : "peek-sidearm");
await send("Input.dispatchKeyEvent", { type: "keyDown", code: "Digit1", key: "1", windowsVirtualKeyCode: 49 }, sessionId);
await send("Input.dispatchKeyEvent", { type: "keyUp", code: "Digit1", key: "1", windowsVirtualKeyCode: 49 }, sessionId);
await sleep(1400);
await shoot(process.env.PEEK_PREFIX ? `${process.env.PEEK_PREFIX}-rod` : "peek-rod");
chrome.kill("SIGTERM");
if (vite) vite.kill("SIGTERM");
console.log("peek done");
