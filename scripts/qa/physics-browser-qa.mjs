// Real-browser QA for the Rapier runtime path. Drives system Chrome over the
// DevTools protocol against a local Vite server, opens the five official levels,
// verifies Rapier debug snapshots, exercises a kinematic move probe, and checks
// Raw WebGPU backend readiness when the automation browser has a WebGPU adapter.
//
// Usage: node scripts/qa/physics-browser-qa.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "qa-physics-browser");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5193;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const PHYSICS_CASES = [
  { name: "level01-desktop", levelId: "level_01_maintenance_bay", width: 1440, height: 900, expectedDynamicBodies: 1 },
  { name: "level02-mobile-landscape", levelId: "level_02_residential_simulation", width: 800, height: 360, mobile: true, expectedDynamicBodies: 1 },
  { name: "level03-furniture-desktop", levelId: "level_03_human_museum", width: 1440, height: 900, expectedDynamicBodies: 0 },
  { name: "level04-desktop", levelId: "level_04_memory_clinic", width: 1366, height: 768, expectedDynamicBodies: 0 },
  { name: "level05-desktop", levelId: "level_05_reclamation_core", width: 1366, height: 768, expectedDynamicBodies: 0 },
];
const levelFilter = process.argv.find((arg) => arg.startsWith("--level="))?.slice("--level=".length) ?? null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];

mkdirSync(OUT_DIR, { recursive: true });

function record(status, name, detail = "") {
  results.push({ status, name, detail });
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ""}`);
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
  return null;
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
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
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

function formatRemoteArgs(args = []) {
  return args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ");
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
        // Shader compile, asset boot, or a busy frame can make evaluate fail once.
      }
      if (value) return value;
      if (Date.now() - startedAt > timeoutMs) throw new Error(`timeout waiting for ${label}`);
      await sleep(400);
    }
  }

  async setViewport(width, height, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenOrientation: { type: width >= height ? "landscapePrimary" : "portraitPrimary", angle: width >= height ? 90 : 0 },
    });
  }

  async screenshot(name) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    const file = path.join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`  screenshot: ${path.relative(ROOT, file)}`);
    return file;
  }
}

async function openPage(cdp, url, { width, height, mobile = false }) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const page = new PageSession(cdp, sessionId);
  page.targetId = targetId;
  await cdp.send("Target.activateTarget", { targetId });
  await page.send("Page.enable", {});
  await page.send("Runtime.enable", {});
  await page.setViewport(width, height, mobile);
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

const physicsReadySnapshot = `(() => {
  const world = window.__HUMAN_PROTOCOL_WORLD__;
  if (world?.ensurePhysicsReady) world.ensurePhysicsReady();
  if (world?.physics?.ready && world?.syncPhysicsStaticObstacles) world.syncPhysicsStaticObstacles();
  const snapshot = world?.physicsDebugSnapshot?.() ?? window.__humanProtocolPhysicsDebug;
  if (snapshot) window.__humanProtocolPhysicsDebug = snapshot;
  if (!snapshot || snapshot.mode !== "rapier" || !snapshot.ready || snapshot.staticColliderCount <= 0) return null;
  return snapshot;
})()`;

const worldSnapshot = `(() => {
  const world = window.__HUMAN_PROTOCOL_WORLD__;
  if (!world) return null;
  const physics = world.physicsDebugSnapshot?.() ?? null;
  const aliveEnemies = (world.enemies ?? []).filter((enemy) => enemy.isAlive).length;
  const rooms = world.level?.map?.rooms ?? [];
  return {
    levelId: world.level?.id ?? "",
    mode: world.session?.mode ?? "",
    frameIndex: Number(world.frameIndex ?? 0),
    renderWarmupComplete: Boolean(world.renderWarmupComplete),
    currentRoomId: world.session?.mapProgress?.currentRoomId ?? null,
    physicsMode: world.debugOptions?.physicsMode ?? "",
    physicsReady: Boolean(world.physics?.ready),
    rooms: rooms.length,
    collisionRooms: rooms.filter((room) => room.geometry?.collisionWalls).length,
    props: world.level?.map?.props?.length ?? 0,
    doors: world.level?.map?.doors?.length ?? 0,
    obstacles: world.obstacles?.length ?? 0,
    aliveEnemies,
    dynamicProps: world.dynamicProps?.length ?? 0,
    player: {
      x: Number(world.player?.position?.x ?? 0),
      z: Number(world.player?.position?.z ?? 0),
      health: Number(world.player?.health ?? 0),
    },
    physics,
  };
})()`;

const enterPlayingSession = `(() => {
  const world = window.__HUMAN_PROTOCOL_WORLD__;
  if (!world) return false;
  if (world.session?.mode !== "playing" && world.startDemo) {
    try { world.startDemo(); } catch {}
  }
  const button = document.querySelector(".flow-entry-overlay button, .flow-overlay button");
  if (button) button.click();
  return world.session?.mode === "playing" || !document.querySelector(".flow-entry-overlay");
})()`;

const rawBackendReadyEvent = `(() => {
  const events = window.__humanProtocolPerfEvents?.() ?? window.__humanProtocolSpikes?.getEvents?.() ?? [];
  const event = events.find((entry) => entry.type === "raw_webgpu_backend_ready");
  return event ? { levelId: event.levelId, detail: event.detail } : null;
})()`;

const kinematicProbe = `(() => {
  const world = window.__HUMAN_PROTOCOL_WORLD__;
  if (!world?.player || !world?.moveKinematicCircleWithPhysics) return null;
  const desired = world.player.position.clone().set(0.08, 0, 0);
  const playerResult = world.moveKinematicCircleWithPhysics({
    id: "qa_browser_player_probe",
    position: world.player.position,
    radius: world.player.radius ?? 0.38,
    height: 1.6,
    desiredTranslation: desired,
  });
  const enemy = (world.enemies ?? []).find((entry) => entry.isAlive);
  let enemyResult = null;
  if (enemy) {
    const enemyDesired = enemy.position.clone().set(-0.06, 0, 0);
    enemyResult = world.moveKinematicCircleWithPhysics({
      id: "qa_browser_enemy_probe",
      position: enemy.position,
      radius: enemy.radius ?? 0.42,
      height: enemy.height ?? 1.5,
      desiredTranslation: enemyDesired,
    });
  }
  return {
    player: playerResult ? {
      blocked: Boolean(playerResult.blocked),
      translation: Number(playerResult.translation?.length?.() ?? 0),
      x: Number(playerResult.position?.x ?? 0),
      z: Number(playerResult.position?.z ?? 0),
    } : null,
    enemy: enemyResult ? {
      blocked: Boolean(enemyResult.blocked),
      translation: Number(enemyResult.translation?.length?.() ?? 0),
    } : null,
    projectileSweep: projectileSweepProbe(world),
  };

  function projectileSweepProbe(world) {
    if (!world?.projectileSegmentHitObstacle || !world?.obstacles) return null;
    const obstacleId = "qa_projectile_sweep_cover";
    const start = world.player.position.clone();
    start.y = 1.2;
    const end = start.clone();
    end.z -= 3.4;
    const obstaclePosition = start.clone();
    obstaclePosition.y = 1;
    obstaclePosition.z -= 1.45;
    const halfSize = start.clone();
    halfSize.set(1.2, 1, 0.08);
    const beforeCount = world.obstacles.length;
    try {
      world.obstacles.push({
        id: obstacleId,
        visualKey: "test_wall",
        position: obstaclePosition,
        halfSize,
      });
      world.markObstacleIndexDirty?.();
      world.syncPhysicsStaticObstacles?.();
      const hit = world.projectileSegmentHitObstacle(start, end, 0.15);
      return hit ? {
        hit: true,
        impactTravelZ: Number(hit.position.z - start.z),
        timeOfImpact: Number(hit.timeOfImpact ?? -1),
        obstacleId: hit.obstacle?.id ?? null,
        obstacleCountDelta: world.obstacles.length - beforeCount,
      } : { hit: false, obstacleCountDelta: world.obstacles.length - beforeCount };
    } finally {
      for (let index = world.obstacles.length - 1; index >= 0; index -= 1) {
        if (world.obstacles[index]?.id === obstacleId) world.obstacles.splice(index, 1);
      }
      world.markObstacleIndexDirty?.();
      world.syncPhysicsStaticObstacles?.();
    }
  }
})()`;

async function probeWebGpuAdapter(cdp) {
  const page = await openPage(cdp, `${BASE}/`, { width: 800, height: 600 });
  try {
    return await page.evaluate(`navigator.gpu ? navigator.gpu.requestAdapter().then((adapter) => Boolean(adapter)).catch(() => false) : false`);
  } finally {
    await closePage(cdp, page);
  }
}

async function runPhysicsCase(cdp, testCase, webgpuAvailable) {
  const params = new URLSearchParams({
    levelId: testCase.levelId,
    physics: "rapier",
    physicsDebug: "1",
    qa: "1",
    noDamage: "1",
    perf: "1",
    lang: "zh",
  });
  const page = await openPage(cdp, `${BASE}/play?${params.toString()}`, testCase);
  try {
    await page.waitFor("Boolean(window.__HUMAN_PROTOCOL_WORLD__)", 45000, `${testCase.name} world`);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.evaluate(enterPlayingSession).catch(() => false);
      await sleep(650);
    }

    let rawEvent = null;
    if (webgpuAvailable) {
      rawEvent = await page.waitFor(rawBackendReadyEvent, 70000, `${testCase.name} Raw WebGPU ready`);
      const rawOk = rawEvent?.levelId === testCase.levelId && rawEvent.detail?.renderer === "raw-webgpu-proxy";
      record(rawOk ? "PASS" : "FAIL", `${testCase.name} Raw WebGPU backend`, JSON.stringify(rawEvent));
    } else {
      record("SKIP", `${testCase.name} Raw WebGPU backend`, "no WebGPU adapter in automation Chrome");
    }
    await page.evaluate(`(() => { window.__hpPhysicsQaRafProbe = 0; requestAnimationFrame(() => { window.__hpPhysicsQaRafProbe = 1; }); return true; })()`);
    const rafProbe = await page.waitFor(`window.__hpPhysicsQaRafProbe === 1 ? 1 : 0`, 20000, `${testCase.name} browser RAF`);
    record(rafProbe ? "PASS" : "FAIL", `${testCase.name} browser RAF`, rafProbe ? "frame callback fired" : "no frame callback");
    await page.waitFor(`window.__HUMAN_PROTOCOL_WORLD__?.frameIndex > 0 ? window.__HUMAN_PROTOCOL_WORLD__.frameIndex : 0`, 15000, `${testCase.name} game loop frame`);

    const physics = await page.waitFor(physicsReadySnapshot, 45000, `${testCase.name} Rapier ready`);
    const world = await page.waitFor(worldSnapshot, 15000, `${testCase.name} world snapshot`);
    const probe = await page.evaluate(kinematicProbe);
    await sleep(800);
    await page.screenshot(`physics-${testCase.name}`);

    const physicsOk =
      world?.levelId === testCase.levelId &&
      world.physicsMode === "rapier" &&
      world.physicsReady &&
      world.obstacles > 0 &&
      physics.staticColliderCount > 0 &&
      physics.dynamicBodyCount === testCase.expectedDynamicBodies &&
      probe?.player?.translation > 0 &&
      probe?.projectileSweep?.hit &&
      probe.projectileSweep.impactTravelZ > -1.32 &&
      probe.projectileSweep.impactTravelZ < -1.05 &&
      probe.projectileSweep.obstacleCountDelta === 1;
    record(
      physicsOk ? "PASS" : "FAIL",
      `${testCase.name} Rapier runtime`,
      JSON.stringify({
        levelId: world?.levelId,
        mode: world?.mode,
        obstacles: world?.obstacles,
        aliveEnemies: world?.aliveEnemies,
        staticColliders: physics.staticColliderCount,
        dynamicBodies: physics.dynamicBodyCount,
        expectedDynamicBodies: testCase.expectedDynamicBodies,
        playerProbe: probe?.player,
        enemyProbe: probe?.enemy,
        projectileSweep: probe?.projectileSweep,
      }),
    );

    if (page.consoleErrors.length) record("FAIL", `${testCase.name} console`, page.consoleErrors.slice(0, 3).join(" | "));
    else record("PASS", `${testCase.name} console`, "no errors");
  } catch (error) {
    const world = await page.evaluate(worldSnapshot).catch(() => null);
    const physics = await page.evaluate(`window.__HUMAN_PROTOCOL_WORLD__?.physicsDebugSnapshot?.() ?? window.__humanProtocolPhysicsDebug ?? null`).catch(() => null);
    await page.screenshot(`physics-${testCase.name}-failure`).catch(() => null);
    const details = {
      error: error instanceof Error ? error.message : String(error),
      world,
      physics,
      console: page.consoleErrors.slice(0, 3),
    };
    record("FAIL", `${testCase.name} runtime`, JSON.stringify(details));
  } finally {
    await closePage(cdp, page);
  }
}

async function main() {
  const binary = chromePath();
  if (!binary) {
    record("SKIP", "chrome", "no Chrome/Chromium found; install to run browser QA");
    return;
  }

  let server = null;
  let chrome = null;
  let cdp = null;
  try {
    server = await startDevServer();
    const startedChrome = await startChrome(binary);
    chrome = startedChrome.child;
    cdp = await Cdp.connect(startedChrome.wsUrl);

    const webgpuAvailable = await probeWebGpuAdapter(cdp);
    record(webgpuAvailable ? "PASS" : "SKIP", "webgpu adapter in automation", webgpuAvailable ? "adapter available" : "no adapter");

    const activeCases = levelFilter ? PHYSICS_CASES.filter((testCase) => testCase.levelId === levelFilter || testCase.name === levelFilter) : PHYSICS_CASES;
    if (levelFilter && activeCases.length === 0) {
      throw new Error(`No physics browser QA case matched --level=${levelFilter}`);
    }
    for (const testCase of activeCases) {
      await runPhysicsCase(cdp, testCase, webgpuAvailable);
    }
  } finally {
    try {
      cdp?.ws?.close();
    } catch {
      // ignore
    }
    await terminateChild(chrome);
    await terminateChild(server);
  }

  const failed = results.filter((result) => result.status === "FAIL");
  console.log(
    `\n${results.filter((result) => result.status === "PASS").length} pass, ${results.filter((result) => result.status === "SKIP").length} skip, ${failed.length} fail, screenshots in ${path.relative(ROOT, OUT_DIR)}`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
