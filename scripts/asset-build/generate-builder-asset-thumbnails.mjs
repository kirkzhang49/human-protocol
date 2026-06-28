#!/usr/bin/env node
// Renders real image thumbnails for every /build catalog GLB.
//
// Drives the dev-only deterministic thumbnail studio (/build?thumbCapture=1,
// see src/build/BuilderThumbnailCapturePage.tsx) in headless Chrome over the
// DevTools protocol — same zero-dependency harness as builder-deep-browser-qa.
// Output: src/assets/thumbnails/builder/<pack-dir>/<modelKey>.webp, consumed
// by src/build/BuilderAssetThumbnails.ts via import.meta.glob.
//
// Usage: node scripts/asset-build/generate-builder-asset-thumbnails.mjs [--only <prefix>]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_ROOT = path.join(ROOT, "src/assets/thumbnails/builder");
const PROFILE_DIR = path.join(ROOT, ".tmp", "thumb-chrome-profile");
const PORT = 5193;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const onlyPrefix = (() => {
  const index = process.argv.indexOf("--only");
  return index >= 0 ? process.argv[index + 1] : null;
})();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stopChild(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      resolve();
    }, 2000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill(signal);
  });
}

/** Pack subfolder per modelKey so curated packs stay browsable on disk. */
function packDirFor(modelKey) {
  if (
    modelKey === "room_l1_img2_warning_barrier" ||
    modelKey === "room_l1_img2_parts_tote_stack" ||
    modelKey === "room_l1_img2_access_diagnostic_cabinet" ||
    modelKey === "room_l1_img2_maintenance_privacy_screen" ||
    modelKey === "room_l1_img2_body_reference_lightbox"
  ) return "hp-level01-safety-storage-image2-v1";
  if (
    modelKey === "room_l1_img2_mobile_repair_cart" ||
    modelKey === "room_l1_img2_hydraulic_lift_table" ||
    modelKey === "room_l1_img2_wall_tool_board" ||
    modelKey === "room_l1_img2_prosthetic_parts_cabinet" ||
    modelKey === "room_l1_img2_sterile_wash_basin"
  ) return "hp-level01-workcell-image2-v1";
  if (
    modelKey === "room_l1_img2_battery_charging_rack" ||
    modelKey === "room_l1_img2_breaker_pylon" ||
    modelKey === "room_l1_img2_valve_manifold_wall" ||
    modelKey === "room_l1_img2_overhead_rail_gantry" ||
    modelKey === "room_l1_img2_robot_docking_post"
  ) return "hp-level01-power-infra-image2-v1";
  if (modelKey.startsWith("room_l1_img2_")) return "hp-level01-furniture-image2-v1";
  if (modelKey.startsWith("room_l2_img2_")) return "hp-level02-furniture-image2-v1";
  if (modelKey.startsWith("room_l3_img2_")) return "hp-level03-furniture-image2-v1";
  if (modelKey.startsWith("hp_l4_cineclinic_")) return "hp-level04-memory-clinic-furniture-v1";
  if (modelKey.startsWith("room_l5_img2_")) return "hp-level05-furniture-image2-v1";
  if (
    modelKey === "room_l5_v3_anemone_lounge_chair" ||
    modelKey === "room_l5_v3_crescent_low_sofa" ||
    modelKey === "room_l5_v3_evidence_coffee_table" ||
    modelKey === "room_l5_v3_human_archive_cabinet" ||
    modelKey === "room_l5_v3_service_side_console"
  ) return "hp-level05-reclamation-furniture-image2-v3-batch02";
  if (
    modelKey === "room_l5_v3_bio_recline_couch" ||
    modelKey === "room_l5_v3_memory_diagnostic_terminal" ||
    modelKey === "room_l5_v3_tissue_freezer_cabinet" ||
    modelKey === "room_l5_v3_limb_calibration_rack" ||
    modelKey === "room_l5_v3_cleaning_robot_dock"
  ) return "hp-level05-reclamation-furniture-image2-v3-batch03";
  if (
    modelKey === "room_l5_v3_curved_archive_shelf" ||
    modelKey === "room_l5_v3_hanging_cable_organizer" ||
    modelKey === "room_l5_v3_surgical_light_stand" ||
    modelKey === "room_l5_v3_specimen_drawer_stack" ||
    modelKey === "room_l5_v3_corner_privacy_screen"
  ) return "hp-level05-reclamation-furniture-image2-v3-batch04";
  if (modelKey.startsWith("room_l5_v3_")) return "hp-level05-reclamation-furniture-image2-v3-hero";
  if (modelKey.startsWith("room_l5_v4_")) return "hp-level05-reclamation-dressing-v4";
  if (modelKey.startsWith("room_desire_")) return "hp-builder-desire-pack01";
  if (modelKey.startsWith("room_cyber_")) return "hp-cyberpunk-batch01";
  if (modelKey.startsWith("room_rm_")) return "hp-official-remaster-batch01";
  if (modelKey.startsWith("room_l610_")) return "hp-level06-10-hero-v1";
  if (modelKey.startsWith("hp_furniture_residential_")) return "hp-residential-reference-furniture-image2-v1";
  if (modelKey.startsWith("hp_l2_cc0_")) return "hp-l2-cc0-domestic-polyhaven-v1";
  if (modelKey.startsWith("pickup_")) return "pickups";
  if (modelKey.startsWith("room_cc0_")) return "hp-cc0-furniture";
  return "core";
}

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
  throw new Error("no Chrome/Chromium found for thumbnail capture");
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
      "--enable-unsafe-swiftshader",
      "--window-size=900,900",
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
        const { resolve, reject, timeout } = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(timeout);
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
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 120000);
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  close() {
    try {
      for (const { timeout } of this.pending.values()) clearTimeout(timeout);
      this.pending.clear();
      this.ws.close();
    } catch {
      // best effort
    }
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description ?? "unknown"}`);
  }
  return result.result?.value;
}

const vite = await startDevServer();
const chrome = await startChrome(chromePath());
let failures = 0;
let cdp = null;
try {
  cdp = await Cdp.connect(chrome.wsUrl);
  const { targetId } = await cdp.send("Target.createTarget", { url: `${BASE}/build?thumbCapture=1` });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Runtime.enable", {}, sessionId);

  for (let attempt = 0; ; attempt += 1) {
    const ready = await evaluate(cdp, sessionId, "Boolean(window.__hpThumbReady)").catch(() => false);
    if (ready) break;
    if (attempt > 100) throw new Error("thumbnail studio did not become ready");
    await sleep(300);
  }

  let keys = await evaluate(cdp, sessionId, "window.__hpThumbKeys");
  if (!Array.isArray(keys) || keys.length === 0) throw new Error("no capturable modelKeys exposed");
  if (onlyPrefix) keys = keys.filter((key) => key.startsWith(onlyPrefix));
  console.log(`capturing ${keys.length} thumbnails…`);

  for (const modelKey of keys) {
    try {
      const dataUrl = await evaluate(cdp, sessionId, `window.__hpThumbCapture(${JSON.stringify(modelKey)})`);
      const match = /^data:image\/webp;base64,(.+)$/.exec(dataUrl ?? "");
      if (!match) throw new Error("capture did not return webp data");
      const dir = path.join(OUT_ROOT, packDirFor(modelKey));
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, `${modelKey}.webp`), Buffer.from(match[1], "base64"));
      console.log(`  ✓ ${modelKey}`);
    } catch (error) {
      failures += 1;
      console.error(`  ✗ ${modelKey}: ${error.message}`);
    }
  }
} finally {
  cdp?.close();
  await Promise.all([stopChild(chrome.child), stopChild(vite)]);
}

if (failures > 0) {
  console.error(`\n${failures} thumbnails failed`);
  process.exit(1);
}
console.log("\nall thumbnails captured");
