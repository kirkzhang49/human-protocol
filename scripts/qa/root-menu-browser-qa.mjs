// Real-browser QA for the root menu (/). Drives headless Chrome over the DevTools
// protocol against a local vite dev server. Captures screenshots at the three
// target resolutions, asserts no console errors, verifies the buttons/actions, and
// checks the prefers-reduced-motion fallback. Zero npm deps (Node WebSocket + CDP).
//
// Usage: node scripts/qa/root-menu-browser-qa.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, ".tmp", "qa-root-menu");
const PROFILE_DIR = path.join(OUT_DIR, "chrome-profile");
const PORT = 5191;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const VIEWPORTS = [
  { name: "2560x1440", width: 2560, height: 1440 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "mobile-landscape-800x360", width: 800, height: 360 },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const record = (status, name, detail = "") => {
  results.push({ status, name, detail });
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ""}`);
};

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
      "--hide-scrollbars",
      "--mute-audio",
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
      }, 45000);
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
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
    return result.result?.value;
  }
  async waitFor(expression, timeoutMs, label) {
    const startedAt = Date.now();
    for (;;) {
      let value = null;
      try {
        value = await this.evaluate(expression);
      } catch {
        // keep polling
      }
      if (value) return value;
      if (Date.now() - startedAt > timeoutMs) throw new Error(`timeout waiting for ${label}`);
      await sleep(250);
    }
  }
  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  }
  async setReducedMotion(reduce) {
    await this.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }],
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

async function openPage(cdp, { width, height, reduce = false, captureNav = false } = {}) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const page = new PageSession(cdp, sessionId);
  page.targetId = targetId;
  await page.send("Page.enable", {});
  await page.send("Runtime.enable", {});
  await page.setViewport(width, height);
  await page.setReducedMotion(reduce);
  if (captureNav) {
    // Capture navigation intent without actually loading the heavy game page.
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { window.__lastNav = null; const a = window.location.assign.bind(window.location); window.location.assign = (u) => { window.__lastNav = String(u); }; } catch (e) {}`,
    });
  }
  await page.send("Page.navigate", { url: `${BASE}/` });
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

async function main() {
  const binary = chromePath();
  if (!binary) {
    record("SKIP", "chrome", "no Chrome/Chromium found; install to run browser QA");
    return;
  }
  const server = await startDevServer();
  const { child: chrome, wsUrl } = await startChrome(binary);
  const cdp = await Cdp.connect(wsUrl);

  try {
    // 1. Each viewport: menu renders, buttons present, no console errors, screenshot.
    for (const vp of VIEWPORTS) {
      const page = await openPage(cdp, { width: vp.width, height: vp.height });
      await page.waitFor("document.querySelector('.rm-slot1') ? 1 : 0", 15000, "root menu slots");
      await sleep(900); // let the WebGL bg paint a few frames
      const counts = await page.evaluate(`(() => ({
        slots: document.querySelectorAll('.rm-slot').length,
        start: document.querySelectorAll('.rm-slot--primary').length,
        levelCards: document.querySelectorAll('.rm-tile').length,
        levelText: /关卡选择|Level Select/.test(document.body.innerText) ? 1 : 0,
        workshop: [...document.querySelectorAll('.rm-slot-label')].some(n => /Workshop|创意工坊/.test(n.textContent)),
        settings: [...document.querySelectorAll('.rm-slot-label')].some(n => /Settings|设置/.test(n.textContent)),
        exit: [...document.querySelectorAll('.rm-slot-label')].some(n => /Exit|退出/.test(n.textContent)),
        canvas: document.querySelectorAll('canvas.root-menu-flow').length,
      }))()`);
      await page.screenshot(`root-menu-${vp.name}`);
      const ok = counts.slots === 4 && counts.start === 1 && counts.levelCards === 0 && counts.levelText === 0 && counts.workshop && counts.settings && counts.exit && counts.canvas === 1;
      record(ok ? "PASS" : "FAIL", `menu ${vp.name}`, JSON.stringify(counts));
      if (page.consoleErrors.length) record("FAIL", `console ${vp.name}`, page.consoleErrors.slice(0, 3).join(" | "));
      else record("PASS", `console ${vp.name}`, "no errors");
      await closePage(cdp, page);
    }

    // 2. Settings modal opens + language toggle works.
    {
      const page = await openPage(cdp, { width: 1440, height: 900 });
      await page.waitFor("document.querySelector('.rm-slot1') ? 1 : 0", 15000, "panel");
      await page.evaluate(`(() => {
        const btn = [...document.querySelectorAll('.rm-slot')].find(b => /Settings|设置/.test(b.textContent));
        btn?.click();
      })()`);
      let opened = 0;
      try {
        opened = await page.waitFor("document.querySelector('.root-menu-modal') ? 1 : 0", 3000, "settings modal");
      } catch {
        opened = 0;
      }
      await page.screenshot("root-menu-settings-modal");
      record(opened ? "PASS" : "FAIL", "settings modal opens", opened ? "" : "modal missing");
      const toggled = await page.evaluate(`(() => {
        const before = document.documentElement.lang;
        const en = [...document.querySelectorAll('.root-menu-lang-choice button')].find(b => /English/.test(b.textContent));
        en?.click();
        return { before, after: document.documentElement.lang };
      })()`);
      record(toggled.after === "en" ? "PASS" : "FAIL", "settings language toggle", JSON.stringify(toggled));
      await closePage(cdp, page);
    }

    // 3. Reduced motion: canvas still renders one frame, no errors.
    {
      const page = await openPage(cdp, { width: 1440, height: 900, reduce: true });
      await page.waitFor("document.querySelector('canvas.root-menu-flow') ? 1 : 0", 15000, "canvas");
      await sleep(500);
      const painted = await page.evaluate(`(() => {
        const c = document.querySelector('canvas.root-menu-flow');
        return c && c.width > 0 && c.height > 0 ? 1 : 0;
      })()`);
      await page.screenshot("root-menu-reduced-motion");
      record(painted ? "PASS" : "FAIL", "reduced-motion still frame", painted ? "" : "canvas not sized");
      if (page.consoleErrors.length) record("FAIL", "reduced-motion console", page.consoleErrors.slice(0, 3).join(" | "));
      else record("PASS", "reduced-motion console", "no errors");
      await closePage(cdp, page);
    }

    // 4. Navigation: click an action and read the resulting location (fresh page each,
    //    since clicking navigates away). We read location right after assign — the URL
    //    updates immediately, so we never wait for the heavy game page to finish loading.
    const navCases = [
      { name: "Start route", click: `document.querySelector('.rm-slot1')?.click()`, expect: "/play?level=level_01_maintenance_bay" },
      { name: "Workshop route", click: `[...document.querySelectorAll('.rm-slot')].find(b => /Workshop|创意工坊/.test(b.textContent))?.click()`, expect: "/build" },
    ];
    for (const nav of navCases) {
      const page = await openPage(cdp, { width: 1440, height: 900 });
      await page.waitFor("document.querySelector('.rm-slot1') ? 1 : 0", 15000, "panel");
      // Capture the navigation REQUEST url (before the game page loads + normalizes it).
      const requested = new Promise((resolve) => {
        let done = false;
        const off = cdp.onEvent((m) => {
          if (done || m.sessionId !== page.sessionId) return;
          if (m.method === "Page.frameRequestedNavigation") {
            done = true;
            off();
            resolve(m.params.url);
          }
        });
        setTimeout(() => {
          if (!done) {
            done = true;
            off();
            resolve(null);
          }
        }, 3000);
      });
      await page.evaluate(`(() => { ${nav.click}; })()`);
      const url = await requested;
      const loc = url ? `${new URL(url).pathname}${new URL(url).search}` : "(no navigation)";
      record(loc === nav.expect ? "PASS" : "FAIL", nav.name, loc);
      await closePage(cdp, page);
    }
  } finally {
    try {
      cdp.ws.close();
    } catch {
      // ignore
    }
    chrome.kill("SIGTERM");
    server.kill("SIGTERM");
  }

  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`\n${results.filter((r) => r.status === "PASS").length} pass, ${failed.length} fail, screenshots in ${path.relative(ROOT, OUT_DIR)}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
