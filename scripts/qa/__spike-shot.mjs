// TEMP — spike screenshot harness. Generates a deep pack for a key-locked room,
// opens the deep playtest, teleports the player to face the spawn key, and
// screenshots. Pass a label (e.g. "before" / "after") as argv[2].
// Delete after use.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LABEL = process.argv[2] ?? "shot";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "spike-shots");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5191;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find((p) => existsSync(p));
mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROJECT = {
  schemaVersion: "hp.builder.v1",
  projectId: "proj_spike",
  title: "钥匙尖刺取证密室",
  rooms: [
    { id: "room_spawn", label: "出生实验间", style: "sterile", center: [0, 10], size: [10, 6] },
    { id: "room_hall", label: "监控走廊", style: "hazard", center: [0, 3], size: [8, 8] },
    { id: "room_exit", label: "撤离电梯", style: "exit", center: [0, -3.5], size: [6, 5] },
  ],
  doors: [
    // key_item lock with keyRoomId=spawn -> static keys placed in the spawn room
    { id: "door_a", fromRoomId: "room_spawn", toRoomId: "room_hall", lockType: "key_item", keyRoomId: "room_spawn" },
    { id: "door_b", fromRoomId: "room_hall", toRoomId: "room_exit", lockType: "none" },
  ],
  props: [
    { id: "prop_a", modelKey: "room_table_utility", roomId: "room_spawn", position: [3.4, 11.6], rotationY: 0, scale: 1 },
    { id: "prop_c", modelKey: "room_locker_low", roomId: "room_hall", position: [-3.2, 4.4], rotationY: 0, scale: 1 },
  ],
  robots: [{ id: "robot_a", roomId: "room_hall", archetype: "repair_drone", count: 1 }],
  exitRoomId: "room_exit",
};

async function startDevServer() {
  const child = spawn("npx", ["vite", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1", "--logLevel", "error"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", (c) => process.stderr.write(`[vite] ${c}`));
  for (let i = 0; i < 160; i += 1) {
    try { if ((await fetch(`${BASE}/`)).ok) return child; } catch {}
    await sleep(250);
  }
  child.kill("SIGTERM");
  throw new Error("vite did not start");
}

async function startChrome() {
  mkdirSync(PROFILE_DIR, { recursive: true });
  const portFile = path.join(PROFILE_DIR, "DevToolsActivePort");
  try { if (existsSync(portFile)) rmSync(portFile); } catch {}
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${PROFILE_DIR}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "--enable-unsafe-webgpu", "--use-angle=metal", "--window-size=1440,900", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  for (let i = 0; i < 120; i += 1) {
    if (existsSync(portFile)) {
      const [port, browserPath] = readFileSync(portFile, "utf8").trim().split("\n");
      if (port && browserPath) return { child, wsUrl: `ws://127.0.0.1:${port}${browserPath}` };
    }
    await sleep(150);
  }
  child.kill("SIGTERM");
  throw new Error("chrome devtools endpoint missing");
}

class Cdp {
  constructor(ws) { this.ws = ws; this.nextId = 1; this.pending = new Map(); this.listeners = new Set();
    ws.addEventListener("message", (e) => { const m = JSON.parse(typeof e.data === "string" ? e.data : e.data.toString());
      if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
      else if (m.method) for (const l of this.listeners) l(m); }); }
  static connect(url) { return new Promise((resolve, reject) => { const ws = new WebSocket(url); ws.addEventListener("open", () => resolve(new Cdp(ws))); ws.addEventListener("error", () => reject(new Error("ws fail"))); }); }
  send(method, params = {}, sessionId) { const id = this.nextId++; const payload = { id, method, params }; if (sessionId) payload.sessionId = sessionId; this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout ${method}`)); } }, 90000); }); }
  onEvent(l) { this.listeners.add(l); return () => this.listeners.delete(l); }
}

class Page {
  constructor(cdp, sessionId) { this.cdp = cdp; this.sessionId = sessionId; this.consoleErrors = []; this.consoleAll = [];
    this.detach = cdp.onEvent((m) => { if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.consoleAPICalled") { const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(" "); this.consoleAll.push(`[${m.params.type}] ${txt}`); if (m.params.type === "error") this.consoleErrors.push(txt); }
      if (m.method === "Runtime.exceptionThrown") { const d = m.params.exceptionDetails?.exception?.description ?? "exc"; this.consoleAll.push(`[exception] ${d}`); this.consoleErrors.push(d); } }); }
  send(method, params) { return this.cdp.send(method, params, this.sessionId); }
  async evaluate(expression) { const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval fail"); return r.result?.value; }
  async waitFor(expr, timeoutMs, label) { const t0 = Date.now(); for (;;) { let v = null; try { v = await this.evaluate(expr); } catch {} if (v) return v; if (Date.now() - t0 > timeoutMs) throw new Error(`timeout ${label}`); await sleep(400); } }
  async screenshot(name) { const s = await this.send("Page.captureScreenshot", { format: "png" }); const f = path.join(OUT_DIR, `${name}.png`); writeFileSync(f, Buffer.from(s.data, "base64")); console.log(`  screenshot: ${path.relative(ROOT, f)}`); return f; }
}

async function openPage(cdp, url, { seedDraft = null, clearPacks = false } = {}) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const page = new Page(cdp, sessionId); page.targetId = targetId;
  await cdp.send("Target.activateTarget", { targetId });
  await page.send("Page.enable", {}); await page.send("Runtime.enable", {});
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  if (seedDraft) {
    const clearSnippet = clearPacks ? `localStorage.removeItem("human-protocol-builder-runtime-pack-latest-v1");localStorage.removeItem("human-protocol-builder-runtime-pack-recent-v1");try{indexedDB.deleteDatabase("hp-builder-runtime-packs");}catch{}` : "";
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("human-protocol-builder-draft-v1", ${JSON.stringify(JSON.stringify(seedDraft))});${clearSnippet}}catch{}` });
  }
  await page.send("Page.navigate", { url }); await sleep(600); return page;
}

const clickPackButton = (label) => `(()=>{const b=[...document.querySelectorAll(".builder-pack-cluster button")].find((x)=>x.textContent.includes(${JSON.stringify(label)}));if(!b)return false;b.click();return true;})()`;
const packButtonText = `[...document.querySelectorAll(".builder-pack-cluster button")].map((b)=>b.textContent).join("|")`;

async function enterPlaying(page) {
  for (let r = 0; r < 10; r += 1) {
    try {
      await page.evaluate(`(()=>{const b=document.querySelector(".flow-entry-overlay button");if(b){b.click();return true;}return !document.querySelector(".flow-entry-overlay");})()`);
      await sleep(900);
      const more = await page.evaluate(`Boolean(document.querySelector(".flow-overlay button"))`);
      if (!more) break;
      await page.evaluate(`(()=>{const b=document.querySelector(".flow-overlay button");if(b)b.click();return true;})()`);
    } catch {}
    await sleep(900);
  }
}

const vite = await startDevServer();
const { child: chrome, wsUrl } = await startChrome();
try {
  const cdp = await Cdp.connect(wsUrl);
  // 0. WebGPU adapter probe
  const probe = await openPage(cdp, `${BASE}/`);
  const webgpu = await probe.evaluate(`navigator.gpu ? navigator.gpu.requestAdapter().then((a)=>Boolean(a)).catch(()=>false) : false`);
  console.log(`  webgpu adapter: ${webgpu}`);
  await probe.send("Target.closeTarget", { targetId: probe.targetId }).catch(() => {});
  // 1. bake deep pack
  const build = await openPage(cdp, `${BASE}/build`, { seedDraft: PROJECT, clearPacks: true });
  await build.waitFor(`Boolean(document.querySelector(".builder-pack-cluster"))`, 25000, "pack cluster");
  await sleep(800);
  console.log("  pack buttons:", await build.evaluate(packButtonText));
  if (!(await build.evaluate(clickPackButton("快速生成")))) throw new Error("快速生成 missing");
  try {
    await build.waitFor(`(${packButtonText}).includes("快速试玩")`, 90000, "fast ready");
  } catch (e) {
    console.log("  FAST FAIL buttons:", await build.evaluate(packButtonText).catch(() => "?"));
    console.log("  pop:", await build.evaluate(`document.querySelector(".builder-pack-pop")?.textContent ?? ""`).catch(() => "?"));
    console.log("  consoleErrors:", build.consoleErrors.slice(0, 6).join(" | "));
    await build.screenshot("build-fast-FAILED");
    throw e;
  }
  if (!(await build.evaluate(clickPackButton("深度烘焙")))) throw new Error("深度烘焙 missing");
  await build.waitFor(`(${packButtonText}).includes("深度试玩")`, 200000, "deep ready");
  const pointers = JSON.parse((await build.evaluate(`localStorage.getItem("human-protocol-builder-runtime-pack-latest-v1")`)) ?? "{}");
  const levelId = pointers["proj_spike"]?.levelId;
  if (!levelId) throw new Error("no level id");
  console.log(`  levelId=${levelId}`);
  // Dump bake-related console (worker fallback warnings, meshopt errors, missing models).
  const bakeLogs = build.consoleAll.filter((l) => /meshopt|Meshopt|worker|cook|bake|missing|NaN|spike|decode|WASM|wasm/i.test(l));
  console.log("  bake-related logs:", bakeLogs.length ? bakeLogs.slice(0, 15).join("\n    ") : "(none)");
  await build.send("Target.closeTarget", { targetId: build.targetId }).catch(() => {});

  // 2. open deep playtest
  const play = await openPage(cdp, `${BASE}/?level=${levelId}&pack=deep&perf=1`);
  await cdp.send("Target.activateTarget", { targetId: play.targetId });
  await sleep(1500);
  await enterPlaying(play);
  await cdp.send("Target.activateTarget", { targetId: play.targetId });
  // Wait for the backend-ready event AND the loading/flow overlay to clear so we
  // screenshot live gameplay, not the 36% loading radar.
  const backendReadyEvent = `(()=>{const ev=(window.__humanProtocolPerfEvents?.()??window.__humanProtocolSpikes?.getEvents?.()??[]).find((e)=>e.type==="raw_webgpu_backend_ready");return ev?true:false;})()`;
  try { await play.waitFor(backendReadyEvent, 60000, "backend ready"); } catch (e) { console.log("  WARN backend-ready not seen:", e.message); }
  // Poll until the loading radar disappears (no transfer overlay, no NN% on
  // screen) AND the world reports playing. The deep-pack environment preload is
  // slow in headless, so allow generous time and require N consecutive clean
  // polls so we never screenshot a transient frame at 99%.
  let lastPct = null;
  let cleanStreak = 0;
  for (let r = 0; r < 220; r += 1) {
    await play.evaluate(`(()=>{const b=document.querySelector(".flow-overlay button,.flow-entry-overlay button");if(b)b.click();return true;})()`).catch(() => {});
    const state = await play.evaluate(`(()=>{
      const w = window.__HUMAN_PROTOCOL_WORLD__;
      const transfer = document.querySelector(".level-transfer-overlay,.flow-overlay,.flow-entry-overlay");
      const m = document.body.innerText.match(/(\\d+)%/);
      const playing = Boolean(w && w.session?.mode === "playing" && !transfer);
      return JSON.stringify({ pct: m ? m[1] : null, transfer: Boolean(transfer), playing });
    })()`).catch(() => JSON.stringify({ pct: null, transfer: true, playing: false }));
    const s = JSON.parse(state);
    lastPct = s.pct;
    if (s.playing && !s.transfer && !s.pct) cleanStreak += 1; else cleanStreak = 0;
    if (cleanStreak >= 3) break;
    await sleep(1000);
  }
  console.log(`  last loading pct=${lastPct} cleanStreak=${cleanStreak}`);
  await sleep(2000);

  // 3. find a key, teleport in front of it facing it
  const placed = await play.waitFor(`(()=>{
    const w = window.__HUMAN_PROTOCOL_WORLD__;
    if (!w || !w.level) return null;
    const keys = w.level.map?.keyItems ?? [];
    if (!keys.length) return JSON.stringify({error:"no keyItems", spawn: w.level.spawnPoint});
    return JSON.stringify({ keys: keys.map((k)=>({id:k.id, pos:k.position, visualKey:k.visualKey})), spawn: w.level.spawnPoint });
  })()`, 30000, "world keys");
  console.log("  world:", placed);
  const info = JSON.parse(placed);
  const key = info.keys?.[0];
  if (!key) throw new Error("no key in world: " + placed);

  // Geometry NaN audit straight from the stored deep pack (IndexedDB) — the exact
  // bytes the renderer draws. Find the key_item geometry asset and scan its range.
  const geomAudit = await play.evaluate(`(async()=>{
    const db = await new Promise((res,rej)=>{const r=indexedDB.open("hp-builder-runtime-packs");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    const recs = await new Promise((res,rej)=>{const r=db.transaction("packs").objectStore("packs").getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    db.close();
    const cooked = recs.filter((x)=>x.manifest?.bakeMode==="cooked-glb");
    if (!cooked.length) return JSON.stringify({error:"no cooked-glb pack", records:recs.map((x)=>x.manifest?.bakeMode)});
    const rec = cooked[cooked.length-1];
    const plan = rec.renderPlan ?? rec.manifest?.renderPlan;
    const g = plan?.geometry;
    if (!g) return JSON.stringify({error:"no geometry in plan", planKeys:plan?Object.keys(plan):null, recKeys:Object.keys(rec)});
    const keyInst = (plan.instances||[]).find((i)=>i.role==="key_item");
    const asset = keyInst ? (g.assets||[]).find((a)=>a.modelKey===keyInst.modelKey) : (g.assets||[]).find((a)=>/key/.test(a.modelKey));
    if (!asset) return JSON.stringify({error:"no key asset", assets:(g.assets||[]).map((a)=>a.modelKey)});
    const stride = g.vertexStrideFloats;
    const f32 = new Float32Array(rec.geometryBuffer);
    let nan=0, zeroN=0; const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
    for (let v=asset.vertexOffset; v<asset.vertexOffset+asset.vertexCount; v++){
      const b=v*stride;
      for(let c=0;c<stride;c++) if(Number.isNaN(f32[b+c])) nan++;
      for(let a=0;a<3;a++){const p=f32[b+a]; if(!Number.isNaN(p)){mn[a]=Math.min(mn[a],p);mx[a]=Math.max(mx[a],p);}}
      const nl=Math.hypot(f32[b+3],f32[b+4],f32[b+5]); if(nl<0.1) zeroN++;
    }
    // Audit EVERY geometry asset for NaN, so a different broken model can't hide.
    const allAssets = (g.assets||[]).map((a)=>{
      let an=0, az=0;
      for (let v=a.vertexOffset; v<a.vertexOffset+a.vertexCount; v++){const bb=v*stride;for(let c=0;c<stride;c++)if(Number.isNaN(f32[bb+c]))an++;const nl=Math.hypot(f32[bb+3],f32[bb+4],f32[bb+5]);if(nl<0.1)az++;}
      return {modelKey:a.modelKey, vc:a.vertexCount, nan:an, zeroN:az};
    });
    const broken = allAssets.filter((a)=>a.nan>0 || a.zeroN>a.vc*0.5);
    return JSON.stringify({key:{modelKey:asset.modelKey, schemaVersion:rec.manifest?.schemaVersion, stride, vertexCount:asset.vertexCount, nanFloats:nan, zeroNormals:zeroN, size:[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]].map((n)=>+n.toFixed(3))}, totalAssets:allAssets.length, brokenAssets:broken});
  })()`).catch((e) => "AUDIT-ERR: " + e.message);
  console.log("  STORED PACK GEOM AUDIT:", geomAudit);

  // teleport: stand ~2.6m back from the key, look at it (further back = whole key visible)
  await play.evaluate(`(()=>{
    const w = window.__HUMAN_PROTOCOL_WORLD__;
    const kx=${key.pos[0]}, ky=${key.pos[1]}, kz=${key.pos[2]};
    const dist=2.6;
    const px=kx, pz=kz+dist;
    w.player.position.set(px, 0, pz);
    const dx = kx-px, dz = kz-pz;
    w.player.rotationY = Math.atan2(dx, dz);
    if (w.player.pitch !== undefined) w.player.pitch = 0.0;
    return true;
  })()`);
  // settle several frames
  await sleep(1400);
  await play.screenshot(`spike-${LABEL}-key-front`);
  // a second angle from the side
  await play.evaluate(`(()=>{
    const w = window.__HUMAN_PROTOCOL_WORLD__;
    const kx=${key.pos[0]}, ky=${key.pos[1]}, kz=${key.pos[2]};
    const dist=1.9; const px=kx+dist, pz=kz;
    w.player.position.set(px, 0, pz);
    w.player.rotationY = Math.atan2(kx-px, kz-pz);
    return true;
  })()`);
  await sleep(1200);
  await play.screenshot(`spike-${LABEL}-key-side`);
  console.log("  consoleErrors:", play.consoleErrors.slice(0, 5).join(" | ") || "none");
} finally {
  chrome.kill("SIGTERM");
  if (!process.argv.includes("--keep-server")) vite.kill("SIGTERM");
}
console.log("DONE");
