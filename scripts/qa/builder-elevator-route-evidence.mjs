// Visual evidence: deep-pack Raw WebGPU playtest of a project with a route
// switch + service-elevator exit. Screenshots the spawn corridor (route switch
// + lift door) and the elevator lobby, proving the premium assets render.
// Usage: node scripts/qa/builder-elevator-route-evidence.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "qa-elevator-route");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5193;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(OUT_DIR, { recursive: true });

async function startDevServer() {
  const child = spawn("npx", ["vite", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1", "--logLevel", "error"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return child;
    } catch {}
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
  try {
    const f = path.join(PROFILE_DIR, "DevToolsActivePort");
    if (existsSync(f)) rmSync(f);
  } catch {}
  const child = spawn(binary, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${PROFILE_DIR}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "--enable-unsafe-webgpu", "--use-angle=metal", "--window-size=1440,900", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
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
      const m = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method) for (const l of this.listeners) l(m);
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
  onEvent(l) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
class PageSession {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.consoleErrors = [];
    cdp.onEvent((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") this.consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(" "));
      if (m.method === "Runtime.exceptionThrown") this.consoleErrors.push(m.params.exceptionDetails?.exception?.description ?? "uncaught");
    });
  }
  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }
  async evaluate(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    return r.result?.value;
  }
  async waitFor(expression, timeoutMs, label) {
    const start = Date.now();
    for (;;) {
      let v = null;
      try {
        v = await this.evaluate(expression);
      } catch {}
      if (v) return v;
      if (Date.now() - start > timeoutMs) throw new Error(`timeout: ${label}`);
      await sleep(400);
    }
  }
  async screenshot(name) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    const file = path.join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`  screenshot: ${path.relative(ROOT, file)}`);
  }
  async setViewport(w, h) {
    await this.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  }
}
async function openPage(cdp, url, { seedDraft = null, clearPacks = false } = {}) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const page = new PageSession(cdp, sessionId);
  page.targetId = targetId;
  await cdp.send("Target.activateTarget", { targetId });
  await page.send("Page.enable", {});
  await page.send("Runtime.enable", {});
  await page.setViewport(1440, 900);
  if (seedDraft) {
    const clear = clearPacks ? `localStorage.removeItem("human-protocol-builder-runtime-pack-latest-v1");localStorage.removeItem("human-protocol-builder-runtime-pack-recent-v1");try{indexedDB.deleteDatabase("hp-builder-runtime-packs");}catch{}` : "";
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("human-protocol-builder-draft-v1", ${JSON.stringify(JSON.stringify(seedDraft))});${clear}}catch{}` });
  }
  await page.send("Page.navigate", { url });
  await sleep(600);
  return page;
}
async function closePage(cdp, page) {
  try {
    await cdp.send("Target.closeTarget", { targetId: page.targetId });
  } catch {}
}
const clickPackButton = (label) => `(()=>{const b=[...document.querySelectorAll(".builder-pack-cluster button")].find((x)=>x.textContent.includes(${JSON.stringify(label)}));if(!b)return false;b.click();return true;})()`;
const packButtonText = `[...document.querySelectorAll(".builder-pack-cluster button")].map((b)=>b.textContent).join("|")`;
const backendReady = `(()=>{const e=(window.__humanProtocolPerfEvents?.()??[]).find((x)=>x.type==="raw_webgpu_backend_ready");return e?{ready:true}:null;})()`;

// Route switch in the hall + archive-merge gated service-elevator exit.
const PROJECT = {
  schemaVersion: "hp.builder.v1", projectId: "proj_elev_route", title: "QA 电梯路由密室",
  rooms: [
    { id: "room_spawn", label: "出生实验间", style: "sterile", center: [0, 10], size: [10, 6] },
    { id: "room_hall", label: "监控走廊", style: "hazard", center: [0, 3], size: [9, 9] },
    { id: "room_exit", label: "撤离电梯", style: "exit", center: [0, -4], size: [6.4, 5.4] },
  ],
  doors: [
    { id: "door_a", fromRoomId: "room_spawn", toRoomId: "room_hall", lockType: "none" },
    { id: "door_b", fromRoomId: "room_hall", toRoomId: "room_exit", lockType: "puzzle_complete", puzzleKind: "archive_merge", puzzleRoomId: "room_hall" },
  ],
  puzzles: [{ id: "pz_a", kind: "archive_merge", linkedDoorId: "door_b", roomId: "room_hall", position: [-2.4, 3], rotationY: 0 }],
  routeSwitches: [{ id: "rt1", label: "管制路由台", roomId: "room_hall", keyRoomId: "room_spawn", position: [2.4, 3], rotationY: 0, outputs: [{ id: "o1", kind: "open_door", doorId: "door_b" }] }],
  robots: [], props: [], pickups: [], exitRoomId: "room_exit",
};

const binary = chromePath();
if (!binary) {
  console.log("SKIP — no Chrome");
  process.exit(0);
}
const vite = await startDevServer();
const { child: chrome, wsUrl } = await startChrome(binary);
try {
  const cdp = await Cdp.connect(wsUrl);
  // Fast pack: lighter shader warm-up completes headless, and it renders exactly
  // the new work — procedural route-console fallback + elevator-metal exit room.
  const build = await openPage(cdp, `${BASE}/build`, { seedDraft: PROJECT, clearPacks: true });
  await build.waitFor(`Boolean(document.querySelector(".builder-pack-cluster"))`, 20000, "pack cluster");
  await build.evaluate(clickPackButton("快速生成"));
  await build.waitFor(`(${packButtonText}).includes("快速试玩")`, 90000, "fast ready");
  const pointers = JSON.parse((await build.evaluate(`localStorage.getItem("human-protocol-builder-runtime-pack-latest-v1")`)) ?? "{}");
  const levelId = pointers["proj_elev_route"]?.levelId;
  await closePage(cdp, build);
  if (!levelId) throw new Error("fast pointer missing");
  console.log(`  levelId=${levelId}`);

  const play = await openPage(cdp, `${BASE}/?level=${levelId}&pack=fast&perf=1`);
  await cdp.send("Target.activateTarget", { targetId: play.targetId });
  // Force visibility so the warm-up rAF loop isn't throttled (headless reports
  // document.hidden=true, which freezes the shader warm-up progress overlay).
  await play.evaluate(`(()=>{try{Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});document.dispatchEvent(new Event("visibilitychange"));}catch{}return true;})()`).catch(() => false);
  await sleep(1500);
  // Wait for the renderer backend, then start the run directly — this skips the
  // cosmetic warm-up overlay (whose rAF is throttled headless) and, because the
  // backend is already up, the world no longer remounts out from under us.
  try {
    await play.waitFor(backendReady, 60000, "raw backend ready");
    console.log("  raw backend ready");
  } catch {
    console.log("  raw backend not ready (will still try)");
  }
  let playing = false;
  for (let r = 0; r < 30 && !playing; r += 1) {
    await play.evaluate(`(()=>{const w=window.__HUMAN_PROTOCOL_WORLD__;if(w&&w.session?.mode!=="playing"&&w.startDemo)try{w.startDemo();}catch{};return true;})()`).catch(() => false);
    await sleep(600);
    playing = await play.evaluate(`(()=>{const w=window.__HUMAN_PROTOCOL_WORLD__;return w&&w.session?.mode==="playing"&&!document.querySelector(".flow-overlay");})()`).catch(() => false);
  }
  console.log(`  flow cleared / playing=${playing}`);
  await cdp.send("Target.activateTarget", { targetId: play.targetId });
  await sleep(2000);

  const aim = async (x, z, dirX, dirZ) => {
    await play.evaluate(`(()=>{const w=window.__HUMAN_PROTOCOL_WORLD__;if(!w?.player)return false;if(w.player.position?.set)w.player.position.set(${x}, w.player.position.y, ${z});if(w.player.aimDirection?.set)w.player.aimDirection.set(${dirX},0,${dirZ});return true;})()`).catch(() => false);
  };
  // Spawn corridor view (route switch + lift door down the hall).
  await aim(0, 7.5, 0, -1);
  await sleep(1500);
  await play.screenshot("deep-spawn-corridor");
  // Hall: stand beside the route switch looking at it.
  await aim(0.2, 3, 1, 0);
  await sleep(1500);
  await play.screenshot("deep-route-switch");
  // Elevator lobby: inside the exit room.
  await aim(0, -2.2, 0, -1);
  await sleep(1500);
  await play.screenshot("deep-elevator-room");
  console.log(`  console errors: ${play.consoleErrors.length ? play.consoleErrors.slice(0, 4).join(" | ") : "none"}`);
  await closePage(cdp, play);
} finally {
  try {
    chrome.kill("SIGTERM");
  } catch {}
  try {
    vite.kill("SIGTERM");
  } catch {}
}
console.log("done");
