// THROWAWAY QA: verify the native-raw-enemy vs cooked-furniture baseColor
// texture-array LAYER COLLISION fix in compileBuilderRuntimePack.ts.
//
// The bug: native-raw enemy baseColor textures number from layer 1, and cooked
// furniture baseColor textures USED TO also number from layer 1, so when a deep
// pack contains both, they share GPU array slots and the cooked upload clobbers
// the enemy albedo (colorless robot). The fix offsets cooked layers past the
// native-raw layers.
//
// This driver bakes a deep pack from a project that has BOTH a native-raw enemy
// (archetype repair_drone -> hp_enemy_repair_drone_horror) AND textured cooked
// furniture, then reads renderPlan.geometry.baseColorTextures out of IndexedDB
// and asserts: (a) NO duplicate layer values; (b) at least one enemy texture
// (name prefixed with a source level id) and at least one cooked furniture
// texture (name "<modelKey>:imageN:slotM") are present; (c) the enemy layers do
// not overlap the cooked layers.
//
// Renderer-agnostic — no GPU needed for the data check. If a WebGPU adapter is
// present, it ALSO enters a deep playtest and screenshots the enemy.
//
// Usage: node scripts/qa/verify-enemy-layer-collision.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "qa-enemy-layer-collision");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5191;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Project with a native-raw enemy (repair_drone) AND textured cooked furniture.
const PROJECT = {
  schemaVersion: "hp.builder.v1",
  projectId: "proj_qa_layer_collision",
  title: "QA 图层碰撞验证",
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
    { id: "prop_a", modelKey: "room_table_utility", roomId: "room_hall", position: [3.0, 4.4], rotationY: 0, scale: 1 },
    { id: "prop_current_image2", modelKey: "hp_l4_cineclinic_triage_kiosk", roomId: "room_hall", position: [-3.0, 4.4], rotationY: 0, scale: 1 },
    { id: "prop_c", modelKey: "room_locker_low", roomId: "room_hall", position: [0, 5.6], rotationY: 0, scale: 1 },
  ],
  // Native-raw enemy in the SAME room as the textured furniture.
  robots: [{ id: "robot_a", roomId: "room_hall", archetype: "repair_drone", count: 1 }],
  exitRoomId: "room_exit",
};

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
    } catch {}
    await sleep(250);
  }
  child.kill("SIGTERM");
  throw new Error("vite dev server did not start");
}

async function startChrome(binary) {
  mkdirSync(PROFILE_DIR, { recursive: true });
  const stalePortFile = path.join(PROFILE_DIR, "DevToolsActivePort");
  try {
    if (existsSync(stalePortFile)) rmSync(stalePortFile);
  } catch {}
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
      }, 120000);
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
        this.consoleErrors.push((message.params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(" "));
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
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
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
      } catch {}
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
  } catch {}
}

const clickPackButton = (label) => `(() => {
  const button = [...document.querySelectorAll(".builder-pack-cluster button")].find((b) => b.textContent.includes(${JSON.stringify(label)}));
  if (!button) return false;
  button.click();
  return true;
})()`;
const packButtonText = `[...document.querySelectorAll(".builder-pack-cluster button")].map((b) => b.textContent).join("|")`;

// Read renderPlan.geometry.baseColorTextures (+ manifest) for the deep pack out
// of IndexedDB. Distinguishes enemy textures (native-raw, name prefixed with a
// source level id) from cooked furniture textures (name "<modelKey>:imageN:slotM").
const readDeepPackPlan = `(async () => {
  const pointers = JSON.parse(localStorage.getItem("human-protocol-builder-runtime-pack-latest-v1") || "{}");
  const pointer = pointers["proj_qa_layer_collision::deep"];
  if (!pointer || !pointer.packId) return { error: "no deep pointer", pointers: Object.keys(pointers) };
  const record = await new Promise((res, rej) => {
    const open = indexedDB.open("hp-builder-runtime-packs");
    open.onsuccess = () => {
      try {
        const req = open.result.transaction("packs", "readonly").objectStore("packs").get(pointer.packId);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      } catch (e) { rej(e); }
    };
    open.onerror = () => rej(open.error);
  });
  if (!record) return { error: "no record for packId " + pointer.packId };
  const bct = record.renderPlan?.geometry?.baseColorTextures ?? [];
  const manifest = record.manifest ?? {};
  const enemyKeys = manifest.nativeRawEnemyModels ?? [];
  const cookedKeys = manifest.cookedModels ?? [];
  const entries = bct.map((t) => ({ layer: t.layer, name: t.name ?? null }));
  const isCooked = (name) => /:image\\d+:slot\\d+$/.test(name || "");
  const enemyEntries = entries.filter((e) => !isCooked(e.name));
  const cookedEntries = entries.filter((e) => isCooked(e.name));
  return {
    packId: pointer.packId,
    bakeMode: manifest.bakeMode ?? null,
    assetSource: record.renderPlan?.assetSource ?? null,
    enemyModelKeys: enemyKeys,
    cookedModelKeys: cookedKeys,
    entries,
    enemyEntries,
    cookedEntries,
    enemyLayers: enemyEntries.map((e) => e.layer),
    cookedLayers: cookedEntries.map((e) => e.layer),
  };
})()`;

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
  for (let round = 0; round < 8; round += 1) {
    try {
      await page.evaluate(startPlaytestSession);
      await sleep(900);
      const overlayButton = await page.evaluate(`Boolean(document.querySelector(".flow-overlay button"))`);
      if (!overlayButton) break;
      await page.evaluate(`(() => { const b = document.querySelector(".flow-overlay button"); if (b) b.click(); return true; })()`);
    } catch {}
    await sleep(900);
  }
}

// --------------------------------------------------------------------------
const results = [];
function record(status, name, detail = "") {
  results.push({ status, name, detail });
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ""}`);
}

const binary = chromePath();
if (!binary) {
  console.error("no Chrome/Chromium — cannot run");
  process.exit(2);
}

const vite = await startDevServer();
const { child: chrome, wsUrl } = await startChrome(binary);
let hardFailures = 0;
let levelId = null;

try {
  const cdp = await Cdp.connect(wsUrl);

  // WebGPU availability probe.
  const probe = await openPage(cdp, `${BASE}/`);
  const webgpu = await probe.evaluate(
    `navigator.gpu ? navigator.gpu.requestAdapter().then((a) => Boolean(a)).catch(() => false) : false`,
  );
  await closePage(cdp, probe);
  record(webgpu ? "PASS" : "SKIP", "webgpu adapter in automation", webgpu ? "adapter available" : "no adapter — visual check skipped, data check still authoritative");

  // Open /build, bake fast then deep.
  const build = await openPage(cdp, `${BASE}/build`, { seedDraft: PROJECT, clearPacks: true });
  await build.waitFor(`Boolean(document.querySelector(".builder-pack-cluster"))`, 25000, "/build pack cluster");
  if (!(await build.evaluate(clickPackButton("快速生成")))) throw new Error("快速生成 button not found");
  await build.waitFor(`(${packButtonText}).includes("快速试玩")`, 60000, "fast pack ready");
  record("PASS", "fast pack generates", "快速生成 → 快速试玩");

  if (!(await build.evaluate(clickPackButton("深度烘焙")))) throw new Error("深度烘焙 button not found");
  try {
    await build.waitFor(`(${packButtonText}).includes("深度试玩")`, 240000, "deep pack ready");
    record("PASS", "deep pack bakes", "深度烘焙 → 深度试玩");
  } catch (error) {
    const failure = await build.evaluate(`document.querySelector(".builder-pack-pop.error")?.textContent ?? ""`).catch(() => "");
    record("FAIL", "deep pack bakes", failure || String(error));
    hardFailures += 1;
  }

  const pointers = await build.evaluate(`localStorage.getItem("human-protocol-builder-runtime-pack-latest-v1")`);
  const pointerMap = JSON.parse(pointers ?? "{}");
  levelId = pointerMap["proj_qa_layer_collision"]?.levelId ?? null;

  // ---- PRIMARY DATA CHECK ----
  const plan = await build.evaluate(readDeepPackPlan);
  writeFileSync(path.join(OUT_DIR, "deep-pack-plan.json"), JSON.stringify(plan, null, 2));
  console.log("\n=== deep pack renderPlan.geometry.baseColorTextures ===");
  console.log(JSON.stringify(plan, null, 2));

  if (plan.error) {
    record("FAIL", "deep pack plan readable", plan.error);
    hardFailures += 1;
  } else {
    record("PASS", "deep pack plan readable", `packId=${plan.packId} bakeMode=${plan.bakeMode} assetSource=${plan.assetSource}`);

    const allLayers = plan.entries.map((e) => e.layer);
    const seen = new Set();
    const dups = [];
    for (const l of allLayers) {
      if (seen.has(l)) dups.push(l);
      seen.add(l);
    }
    record(
      dups.length === 0 ? "PASS" : "FAIL",
      "no duplicate baseColor texture layers (collision gone)",
      `layers=[${allLayers.join(",")}] duplicates=[${dups.join(",") || "none"}]`,
    );
    if (dups.length > 0) hardFailures += 1;

    const hasEnemyTex = plan.enemyEntries.length > 0;
    const hasCookedTex = plan.cookedEntries.length > 0;
    record(
      hasEnemyTex && hasCookedTex ? "PASS" : "FAIL",
      "deep pack contains BOTH native-raw enemy + cooked furniture textures",
      `enemyTextures=${plan.enemyEntries.length} cookedTextures=${plan.cookedEntries.length} enemyModels=[${plan.enemyModelKeys.join(",")}] cookedModels=[${plan.cookedModelKeys.join(",")}]`,
    );
    if (!(hasEnemyTex && hasCookedTex)) hardFailures += 1;

    // The decisive check: no enemy layer is also a cooked layer.
    const cookedSet = new Set(plan.cookedLayers);
    const overlap = plan.enemyLayers.filter((l) => cookedSet.has(l));
    record(
      overlap.length === 0 ? "PASS" : "FAIL",
      "enemy texture layers do NOT overlap cooked furniture layers",
      `enemyLayers=[${plan.enemyLayers.join(",")}] cookedLayers=[${plan.cookedLayers.join(",")}] overlap=[${overlap.join(",") || "none"}]`,
    );
    if (overlap.length > 0) hardFailures += 1;

    // Cooked layers should start strictly above the max enemy layer (the offset).
    const maxEnemy = plan.enemyLayers.length ? Math.max(...plan.enemyLayers) : 0;
    const minCooked = plan.cookedLayers.length ? Math.min(...plan.cookedLayers) : Infinity;
    record(
      minCooked > maxEnemy ? "PASS" : "FAIL",
      "cooked layers offset above the native-raw enemy range",
      `maxEnemyLayer=${maxEnemy} minCookedLayer=${minCooked === Infinity ? "n/a" : minCooked}`,
    );
    if (!(minCooked > maxEnemy)) hardFailures += 1;
  }
  await closePage(cdp, build);

  // ---- SECONDARY VISUAL CHECK (only if WebGPU adapter) ----
  if (webgpu && levelId) {
    const play = await openPage(cdp, `${BASE}/?level=${levelId}&pack=deep&perf=1`);
    await sleep(1500);
    await enterPlaying(play);
    let event = null;
    try {
      event = await play.waitFor(backendReadyEvent, 60000, "deep backend ready");
    } catch {}
    const detail = event?.detail ?? {};
    record(
      detail.assetSource === "builder-runtime-pack-v2+cooked-glb" ? "PASS" : "SKIP",
      "deep playtest renders via raw WebGPU cooked pack",
      `assetSource=${detail.assetSource ?? "none"}`,
    );
    // Give the enemy time to spawn in room_hall and walk toward the player.
    await sleep(4000);
    await play.screenshot("deep-playtest-enemy-1");
    await sleep(3000);
    await play.screenshot("deep-playtest-enemy-2");
    await closePage(cdp, play);
    record("PASS", "visual screenshots captured", "deep-playtest-enemy-1.png / deep-playtest-enemy-2.png (inspect for robot color)");
  } else {
    record("SKIP", "visual enemy color check", webgpu ? "no levelId" : "no WebGPU adapter in automation");
  }
} finally {
  chrome.kill("SIGTERM");
  vite.kill("SIGTERM");
}

writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log(`\nreport: ${path.relative(ROOT, path.join(OUT_DIR, "report.json"))}`);
if (hardFailures > 0) {
  console.error(`\nLAYER-COLLISION QA FAILED: ${hardFailures} failing check(s)`);
  process.exit(1);
}
console.log("\nLAYER-COLLISION QA DONE — fix verified at data level");
