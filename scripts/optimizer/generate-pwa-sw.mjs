import { createHash } from "node:crypto";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const distDir = path.join(rootDir, "dist");
const serviceWorkerPath = path.join(distDir, "human-protocol-sw.js");

const files = await walk(distDir);
const distFiles = files
  .map((file) => `./${path.relative(distDir, file).split(path.sep).join("/")}`)
  .filter((file) => file !== "./human-protocol-sw.js")
  .sort();

const shellFiles = unique([
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./game.json",
  "./thumb.jpg",
  ...distFiles.filter((file) => /^\.\/assets\/index-[^/]+\.(?:js|css)$/.test(file)),
]);

const version = createHash("sha256").update(shellFiles.join("\n")).digest("hex").slice(0, 12);
const serviceWorker = `const PRECACHE_CACHE = "human-protocol-precache-${version}";
const RUNTIME_CACHE = "human-protocol-runtime-v1";
const PRECACHE_URLS = ${JSON.stringify(shellFiles, null, 2)};
const RUNTIME_FILE_RE = /\\.(?:js|css|json|png|jpg|jpeg|webp|svg|glb|gltf|bin|mp3|wav|ogg|wasm)$/i;
const RUNTIME_MAX_ENTRIES = 128;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((url) => new URL(url, self.registration.scope).toString())),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== PRECACHE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if (RUNTIME_FILE_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, event));
  }
});

async function navigationNetworkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    return caches.match(new URL("./index.html", self.registration.scope).toString());
  }
}

async function cacheFirst(request, event) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (!response || !response.ok || response.type !== "basic") return response;

  event.waitUntil(cacheRuntimeResponse(request, response.clone()));
  return response;
}

async function cacheRuntimeResponse(request, response) {
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response);
  await trimCache(cache, RUNTIME_MAX_ENTRIES);
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((request) => cache.delete(request)));
}
`;

await writeFile(serviceWorkerPath, serviceWorker);
console.log(`PWA service worker generated: ${path.relative(rootDir, serviceWorkerPath)} (${shellFiles.length} shell files)`);

async function walk(directory) {
  const entries = await readdir(directory);
  const result = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry);
    const stats = await stat(absolute);
    if (stats.isDirectory()) {
      result.push(...await walk(absolute));
    } else if (stats.isFile()) {
      result.push(absolute);
    }
  }
  return result;
}

function unique(values) {
  return [...new Set(values)];
}
