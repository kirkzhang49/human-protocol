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
    movementStress: movementStressProbe(world),
    dynamicPropKinematicBlock: dynamicPropKinematicBlockProbe(world),
    dynamicPropImpulse: dynamicPropImpulseProbe(world),
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

  function movementStressProbe(world) {
    if (!world?.moveKinematicCircleWithPhysics || !world?.obstacles) return null;
    const obstaclePrefix = "qa_movement_stress_";
    const base = world.player.position.clone();
    base.y = 0;
    const vector = (x, y, z) => world.player.position.clone().set(base.x + x, y, base.z + z);
    const half = (x, y, z) => world.player.position.clone().set(x, y, z);
    const obstacles = [
      { id: obstaclePrefix + "pass_left", visualKey: "test_door", position: vector(-0.5, 0.75, -1), halfSize: half(0.1, 0.75, 0.2) },
      { id: obstaclePrefix + "pass_right", visualKey: "test_door", position: vector(0.5, 0.75, -1), halfSize: half(0.1, 0.75, 0.2) },
      { id: obstaclePrefix + "tight_left", visualKey: "test_door", position: vector(-0.4, 0.75, -1), halfSize: half(0.1, 0.75, 0.2) },
      { id: obstaclePrefix + "tight_right", visualKey: "test_door", position: vector(0.4, 0.75, -1), halfSize: half(0.1, 0.75, 0.2) },
      { id: obstaclePrefix + "nav_soft", visualKey: "test_soft_prop", position: vector(3.55, 0.5, 2), halfSize: half(0.25, 0.5, 0.65), enemyNavigation: "soft" },
      { id: obstaclePrefix + "nav_solid", visualKey: "test_solid_prop", position: vector(4.45, 0.5, 2), halfSize: half(0.25, 0.5, 0.65) },
      { id: obstaclePrefix + "player_raised_crossbar", visualKey: "test_crossbar", position: vector(1.1, 1.2, 4), halfSize: half(0.22, 0.18, 1) },
      { id: obstaclePrefix + "leader_mid_crossbar", visualKey: "test_crossbar", position: vector(10.1, 1.62, 4), halfSize: half(0.22, 0.18, 1) },
      { id: obstaclePrefix + "boss_raised_crossbar", visualKey: "test_crossbar", position: vector(4.1, 1.75, 4), halfSize: half(0.22, 0.3, 1) },
      { id: obstaclePrefix + "overhead_crossbar", visualKey: "test_crossbar", position: vector(7.1, 2.05, 4), halfSize: half(0.22, 0.16, 1) },
      { id: obstaclePrefix + "lane_left_wall", visualKey: "test_wall", position: vector(-1.05, 0.75, 6.2), halfSize: half(0.12, 0.75, 2.4) },
      { id: obstaclePrefix + "lane_right_wall", visualKey: "test_wall", position: vector(1.65, 0.75, 6.2), halfSize: half(0.12, 0.75, 2.4) },
      { id: obstaclePrefix + "lane_rotated_furniture", visualKey: "test_rotated_console", position: vector(1.42, 0.62, 5.95), halfSize: half(0.16, 0.62, 0.75), yaw: Math.PI / 5 },
      { id: obstaclePrefix + "boss_door_edge_post", visualKey: "test_door", position: vector(10.05, 0.8, 7.2), halfSize: half(0.16, 0.8, 0.85) },
    ];
    const beforeCount = world.obstacles.length;
    try {
      world.obstacles.push(...obstacles);
      world.markObstacleIndexDirty?.();
      world.syncPhysicsStaticObstacles?.();

      const playerRadius = world.player.radius ?? 0.32;
      const passableStart = vector(0, 0, 0);
      const passable = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_player_passable_doorframe",
        position: passableStart,
        radius: playerRadius,
        height: 1.6,
        desiredTranslation: half(0, 0, -1.5),
        filter: (candidate) => candidate.id.startsWith(obstaclePrefix + "pass_"),
      });
      const tightStart = vector(0, 0, 0);
      const tight = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_player_tight_doorframe",
        position: tightStart,
        radius: playerRadius,
        height: 1.6,
        desiredTranslation: half(0, 0, -1.5),
        filter: (candidate) => candidate.id.startsWith(obstaclePrefix + "tight_"),
      });
      const navStart = vector(3, 0, 2);
      const enemyNav = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_enemy_nav_filter",
        position: navStart,
        radius: 0.28,
        height: 1.3,
        desiredTranslation: half(2.4, 0, 0),
        filter: (candidate) => candidate.id.startsWith(obstaclePrefix + "nav_") && candidate.enemyNavigation !== "soft" && candidate.enemyNavigation !== "ignore",
      });
      const playerRaisedStart = vector(0, 0, 4);
      const playerRaised = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_player_raised_crossbar",
        position: playerRaisedStart,
        radius: playerRadius,
        height: 1.6,
        desiredTranslation: half(1.6, 0, 0),
        filter: (candidate) => candidate.id === obstaclePrefix + "player_raised_crossbar",
      });
      const normalLeaderClearanceStart = vector(9, 0, 4);
      const normalLeaderClearance = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_normal_enemy_leader_crossbar_clearance",
        position: normalLeaderClearanceStart,
        radius: 0.3,
        height: 1.3,
        desiredTranslation: half(1.6, 0, 0),
        filter: (candidate) => candidate.id === obstaclePrefix + "leader_mid_crossbar",
      });
      const leaderRaisedStart = vector(9, 0, 4);
      const leaderRaised = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_leader_raised_crossbar",
        position: leaderRaisedStart,
        radius: 0.46,
        height: 1.95,
        desiredTranslation: half(1.6, 0, 0),
        filter: (candidate) => candidate.id === obstaclePrefix + "leader_mid_crossbar",
      });
      const bossRaisedStart = vector(3, 0, 4);
      const bossRaised = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_boss_raised_crossbar",
        position: bossRaisedStart,
        radius: 0.52,
        height: 2.55,
        desiredTranslation: half(1.6, 0, 0),
        filter: (candidate) => candidate.id === obstaclePrefix + "boss_raised_crossbar",
      });
      const playerOverheadStart = vector(6, 0, 4);
      const playerOverhead = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_player_overhead_crossbar",
        position: playerOverheadStart,
        radius: playerRadius,
        height: 1.6,
        desiredTranslation: half(1.6, 0, 0),
        filter: (candidate) => candidate.id === obstaclePrefix + "overhead_crossbar",
      });
      const bossOverheadStart = vector(6, 0, 4);
      const bossOverhead = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_boss_overhead_crossbar",
        position: bossOverheadStart,
        radius: 0.52,
        height: 2.55,
        desiredTranslation: half(1.6, 0, 0),
        filter: (candidate) => candidate.id === obstaclePrefix + "overhead_crossbar",
      });
      const continuousStart = vector(0, 0, 8);
      const continuousPosition = continuousStart.clone();
      const continuousPrevious = continuousStart.clone();
      let continuousMaxStep = 0;
      let continuousBlockedFrames = 0;
      let continuousFinite = true;
      for (let frame = 0; frame < 48; frame += 1) {
        const moved = world.moveKinematicCircleWithPhysics({
          id: "qa_browser_player_continuous_lane",
          position: continuousPosition,
          radius: playerRadius,
          height: 1.6,
          desiredTranslation: half(0, 0, -0.08),
          filter: (candidate) => candidate.id.startsWith(obstaclePrefix + "lane_"),
        });
        if (!moved) {
          continuousFinite = false;
          break;
        }
        if (moved.blocked) continuousBlockedFrames += 1;
        continuousPosition.copy(moved.position);
        continuousMaxStep = Math.max(continuousMaxStep, continuousPosition.distanceTo(continuousPrevious));
        continuousPrevious.copy(continuousPosition);
        if (!Number.isFinite(continuousPosition.x) || !Number.isFinite(continuousPosition.z)) continuousFinite = false;
      }
      const bossDoorStart = vector(9.2, 0, 7.2);
      const bossDoorPosition = bossDoorStart.clone();
      const bossDoorPrevious = bossDoorStart.clone();
      let bossDoorMaxStep = 0;
      let bossDoorBlockedFrames = 0;
      let bossDoorFinite = true;
      for (let frame = 0; frame < 36; frame += 1) {
        const moved = world.moveKinematicCircleWithPhysics({
          id: "qa_browser_boss_continuous_door_edge",
          position: bossDoorPosition,
          radius: 0.52,
          height: 2.55,
          desiredTranslation: half(0.08, 0, -0.03),
          filter: (candidate) => candidate.id === obstaclePrefix + "boss_door_edge_post",
        });
        if (!moved) {
          bossDoorFinite = false;
          break;
        }
        if (moved.blocked) bossDoorBlockedFrames += 1;
        bossDoorPosition.copy(moved.position);
        bossDoorMaxStep = Math.max(bossDoorMaxStep, bossDoorPosition.distanceTo(bossDoorPrevious));
        bossDoorPrevious.copy(bossDoorPosition);
        if (!Number.isFinite(bossDoorPosition.x) || !Number.isFinite(bossDoorPosition.z)) bossDoorFinite = false;
      }
      const passableTravelZ = Number((passable?.position?.z ?? passableStart.z) - passableStart.z);
      const tightTravelZ = Number((tight?.position?.z ?? tightStart.z) - tightStart.z);
      const enemyTravelX = Number((enemyNav?.position?.x ?? navStart.x) - navStart.x);
      const playerRaisedTravelX = Number((playerRaised?.position?.x ?? playerRaisedStart.x) - playerRaisedStart.x);
      const normalLeaderClearanceTravelX = Number((normalLeaderClearance?.position?.x ?? normalLeaderClearanceStart.x) - normalLeaderClearanceStart.x);
      const leaderRaisedTravelX = Number((leaderRaised?.position?.x ?? leaderRaisedStart.x) - leaderRaisedStart.x);
      const bossRaisedTravelX = Number((bossRaised?.position?.x ?? bossRaisedStart.x) - bossRaisedStart.x);
      const playerOverheadTravelX = Number((playerOverhead?.position?.x ?? playerOverheadStart.x) - playerOverheadStart.x);
      const bossOverheadTravelX = Number((bossOverhead?.position?.x ?? bossOverheadStart.x) - bossOverheadStart.x);
      const continuousTravelX = Number(continuousPosition.x - continuousStart.x);
      const continuousTravelZ = Number(continuousPosition.z - continuousStart.z);
      const bossDoorTravelX = Number(bossDoorPosition.x - bossDoorStart.x);
      const bossDoorTravelZ = Number(bossDoorPosition.z - bossDoorStart.z);
      return {
        obstacleCountDelta: world.obstacles.length - beforeCount,
        playerPassable: {
          pass: Boolean(passable && !passable.blocked && passableTravelZ < -1.35),
          blocked: Boolean(passable?.blocked),
          travelZ: passableTravelZ,
        },
        playerTight: {
          pass: Boolean(tight?.blocked && tightTravelZ > -1.15),
          blocked: Boolean(tight?.blocked),
          travelZ: tightTravelZ,
        },
        enemyNavigation: {
          pass: Boolean(enemyNav?.blocked && enemyTravelX > 0.65 && enemyTravelX < 1.2),
          blocked: Boolean(enemyNav?.blocked),
          travelX: enemyTravelX,
        },
        playerRaisedCrossbar: {
          pass: Boolean(playerRaised?.blocked && playerRaisedTravelX < 0.85),
          blocked: Boolean(playerRaised?.blocked),
          travelX: playerRaisedTravelX,
        },
        leaderHeightCrossbar: {
          pass: Boolean(
            normalLeaderClearance &&
            !normalLeaderClearance.blocked &&
            normalLeaderClearanceTravelX > 1.35 &&
            leaderRaised?.blocked &&
            leaderRaisedTravelX < 0.95
          ),
          normalBlocked: Boolean(normalLeaderClearance?.blocked),
          normalTravelX: normalLeaderClearanceTravelX,
          leaderBlocked: Boolean(leaderRaised?.blocked),
          leaderTravelX: leaderRaisedTravelX,
        },
        bossRaisedCrossbar: {
          pass: Boolean(bossRaised?.blocked && bossRaisedTravelX < 0.95),
          blocked: Boolean(bossRaised?.blocked),
          travelX: bossRaisedTravelX,
        },
        overheadClearance: {
          pass: Boolean(playerOverhead && !playerOverhead.blocked && playerOverheadTravelX > 1.35 && bossOverhead?.blocked && bossOverheadTravelX < 0.9),
          playerBlocked: Boolean(playerOverhead?.blocked),
          playerTravelX: playerOverheadTravelX,
          bossBlocked: Boolean(bossOverhead?.blocked),
          bossTravelX: bossOverheadTravelX,
        },
        continuousPlayerLane: {
          pass: Boolean(
            continuousFinite &&
            continuousTravelZ < -2.2 &&
            Math.abs(continuousTravelX) < 0.55 &&
            continuousMaxStep < 0.12 &&
            continuousBlockedFrames === 0
          ),
          travelX: continuousTravelX,
          travelZ: continuousTravelZ,
          maxStep: continuousMaxStep,
          blockedFrames: continuousBlockedFrames,
          finite: continuousFinite,
        },
        continuousBossDoorEdge: {
          pass: Boolean(
            bossDoorFinite &&
            bossDoorBlockedFrames > 0 &&
            bossDoorTravelX > 0.2 &&
            bossDoorTravelX < 0.7 &&
            bossDoorTravelZ < -0.7 &&
            bossDoorMaxStep < 0.12
          ),
          travelX: bossDoorTravelX,
          travelZ: bossDoorTravelZ,
          maxStep: bossDoorMaxStep,
          blockedFrames: bossDoorBlockedFrames,
          finite: bossDoorFinite,
        },
      };
    } finally {
      for (let index = world.obstacles.length - 1; index >= 0; index -= 1) {
        if (world.obstacles[index]?.id?.startsWith(obstaclePrefix)) world.obstacles.splice(index, 1);
      }
      world.markObstacleIndexDirty?.();
      world.syncPhysicsStaticObstacles?.();
    }
  }

  function dynamicPropImpulseProbe(world) {
    const props = world.dynamicProps ?? [];
    if (!Array.isArray(props) || props.length === 0) return { present: false, count: 0 };
    if (!world?.applyDynamicPropImpulse || !world?.syncPhysicsDynamicProps || !world?.syncDynamicPropsFromPhysics) {
      return { present: true, count: props.length, applied: false, moved: false };
    }
    const prop = props[0];
    const start = prop.position?.clone?.();
    if (!start) return { present: true, count: props.length, applied: false, moved: false };
    const startRotation = prop.rotation?.clone?.() ?? null;
    const startYaw = Number(prop.yaw ?? 0);
    const impulse = start.clone().set(2.4, 0, 0);
    let result = { present: true, count: props.length, id: prop.id, applied: false, moved: false };
    try {
      world.syncPhysicsDynamicProps();
      const applied = Boolean(world.applyDynamicPropImpulse(prop.id, impulse));
      for (let frame = 0; frame < 8; frame += 1) {
        world.physics?.step?.(1 / 30);
        world.syncDynamicPropsFromPhysics(1 / 30);
      }
      const deltaX = Number(prop.position.x - start.x);
      const deltaZ = Number(prop.position.z - start.z);
      const distance = Math.hypot(deltaX, deltaZ);
      const yDelta = Number(prop.position.y - start.y);
      result = {
        present: true,
        count: props.length,
        id: prop.id,
        applied,
        moved: distance > 0.015,
        distance,
        deltaX,
        deltaZ,
        yDelta,
        sleeping: Boolean(prop.sleeping),
      };
      return result;
    } finally {
      prop.position.copy(start);
      if (startRotation && prop.rotation?.copy) prop.rotation.copy(startRotation);
      prop.yaw = startYaw;
      prop.sleeping = false;
      world.syncPhysicsDynamicProps();
      world.syncDynamicPropsFromPhysics(0);
    }
  }

  function dynamicPropKinematicBlockProbe(world) {
    if (!world?.spawnDynamicProp || !world?.moveKinematicCircleWithPhysics || !world?.syncPhysicsDynamicProps) return null;
    const propId = "qa_dynamic_kinematic_blocker";
    const start = world.player.position.clone().set(64, 0, 64);
    const propPosition = start.clone();
    propPosition.x += 0.9;
    propPosition.y = 0.35;
    const halfSize = start.clone().set(0.35, 0.35, 0.35);
    const desired = start.clone().set(1.6, 0, 0);
    const beforeCount = Array.isArray(world.dynamicProps) ? world.dynamicProps.length : 0;
    const beforeBodyCount = Number(world.physicsDebugSnapshot?.().dynamicBodyCount ?? beforeCount);
    let prop = null;
    let result = null;
    try {
      prop = world.spawnDynamicProp({
        id: propId,
        modelKey: "test_crate",
        position: propPosition,
        halfSize,
        mass: 1,
      });
      world.syncPhysicsDynamicProps();
      world.physics?.step?.(1 / 120);
      world.syncDynamicPropsFromPhysics?.(0);
      const propStartX = Number(prop?.position?.x ?? propPosition.x);
      const playerMoved = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_player_dynamic_blocker",
        position: start,
        radius: world.player.radius ?? 0.32,
        height: 1.6,
        desiredTranslation: desired,
      });
      const enemyMoved = world.moveKinematicCircleWithPhysics({
        id: "qa_browser_enemy_dynamic_blocker",
        position: start,
        radius: 0.3,
        height: 1.3,
        desiredTranslation: desired,
        filter: (candidate) => candidate.enemyNavigation !== "soft" && candidate.enemyNavigation !== "ignore",
      });
      for (let step = 0; step < 3; step += 1) world.physics?.step?.(1 / 60);
      world.syncDynamicPropsFromPhysics?.(1 / 20);
      const playerTravelX = Number((playerMoved?.position?.x ?? start.x) - start.x);
      const enemyTravelX = Number((enemyMoved?.position?.x ?? start.x) - start.x);
      const propTravelX = Number((prop?.position?.x ?? propStartX) - propStartX);
      const dynamicCountDelta = (world.dynamicProps?.length ?? beforeCount) - beforeCount;
      result = {
        spawned: Boolean(prop),
        playerBlocked: Boolean(playerMoved?.blocked),
        playerTravelX,
        enemyFilteredBlocked: Boolean(enemyMoved?.blocked),
        enemyTravelX,
        propNudged: propTravelX > 0.005,
        propTravelX,
        dynamicCountDelta,
        pass: Boolean(
          prop &&
          playerMoved?.blocked &&
          playerTravelX < 0.45 &&
          enemyMoved?.blocked &&
          enemyTravelX < 0.45 &&
          propTravelX > 0.005 &&
          dynamicCountDelta === 1
        ),
      };
    } finally {
      if (Array.isArray(world.dynamicProps)) {
        for (let index = world.dynamicProps.length - 1; index >= 0; index -= 1) {
          if (world.dynamicProps[index]?.id === propId) world.dynamicProps.splice(index, 1);
        }
      }
      world.syncPhysicsDynamicProps();
      world.syncDynamicPropsFromPhysics?.(0);
    }
    if (!result) return result;
    const cleanupDynamicCountDelta = (world.dynamicProps?.length ?? beforeCount) - beforeCount;
    const cleanupBodyCountDelta = Number(world.physicsDebugSnapshot?.().dynamicBodyCount ?? beforeBodyCount) - beforeBodyCount;
    return {
      ...result,
      cleanupDynamicCountDelta,
      cleanupBodyCountDelta,
      pass: Boolean(result.pass && cleanupDynamicCountDelta === 0 && cleanupBodyCountDelta === 0),
    };
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
      probe.projectileSweep.obstacleCountDelta === 1 &&
      probe?.movementStress?.obstacleCountDelta === 14 &&
      probe.movementStress.playerPassable?.pass &&
      probe.movementStress.playerTight?.pass &&
      probe.movementStress.enemyNavigation?.pass &&
      probe.movementStress.playerRaisedCrossbar?.pass &&
      probe.movementStress.leaderHeightCrossbar?.pass &&
      probe.movementStress.bossRaisedCrossbar?.pass &&
      probe.movementStress.overheadClearance?.pass &&
      probe.movementStress.continuousPlayerLane?.pass &&
      probe.movementStress.continuousBossDoorEdge?.pass &&
      probe.dynamicPropKinematicBlock?.pass &&
      (testCase.expectedDynamicBodies > 0
        ? probe?.dynamicPropImpulse?.present &&
          probe.dynamicPropImpulse.count === testCase.expectedDynamicBodies &&
          probe.dynamicPropImpulse.applied &&
          probe.dynamicPropImpulse.moved &&
          Math.abs(probe.dynamicPropImpulse.yDelta ?? 0) < 0.01
        : probe?.dynamicPropImpulse?.present === false && probe.dynamicPropImpulse.count === 0);
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
        movementStress: probe?.movementStress,
        dynamicPropKinematicBlock: probe?.dynamicPropKinematicBlock,
        dynamicPropImpulse: probe?.dynamicPropImpulse,
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

function startupRetryReason(testCase, caseRecords) {
  const runtimeFailure = caseRecords.find((entry) => entry.status === "FAIL" && entry.name === `${testCase.name} runtime`);
  if (!runtimeFailure) return null;
  let details = null;
  try {
    details = JSON.parse(runtimeFailure.detail);
  } catch {
    return null;
  }
  const error = typeof details?.error === "string" ? details.error : "";
  const consoleText = Array.isArray(details?.console) ? details.console.join(" | ") : "";
  if (consoleText.includes("Failed to fetch dynamically imported module")) return "dynamic import fetch failed before runtime warmed";
  if (!error.startsWith("timeout waiting for ")) return null;
  const startupLabels = [
    `${testCase.name} world`,
    `${testCase.name} Raw WebGPU ready`,
    `${testCase.name} browser RAF`,
    `${testCase.name} game loop frame`,
    `${testCase.name} Rapier ready`,
  ];
  return startupLabels.some((label) => error.includes(label)) ? error : null;
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
      const beforeCount = results.length;
      await runPhysicsCase(cdp, testCase, webgpuAvailable);
      const retryReason = startupRetryReason(testCase, results.slice(beforeCount));
      if (retryReason) {
        results.splice(beforeCount);
        console.log(`RETRY ${testCase.name} startup — ${retryReason}`);
        await sleep(1000);
        await runPhysicsCase(cdp, testCase, webgpuAvailable);
      }
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
