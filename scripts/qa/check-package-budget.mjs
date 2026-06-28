import { readdir, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url));
const MB = 1024 * 1024;

const budgets = {
  largestFileBytes: 8 * MB,
  initialJsGzipBytes: 1.5 * MB,
  cssGzipBytes: 256 * 1024,
  fileCount: 1500,
};

const files = await listFiles(DIST_DIR);
const entries = await Promise.all(
  files.map(async (path) => {
    const stats = await stat(path);
    const buffer = await readFile(path);
    return {
      path,
      bytes: stats.size,
      gzipBytes: gzipSync(buffer).byteLength,
    };
  }),
);

const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const largest = entries.reduce((max, entry) => (entry.bytes > max.bytes ? entry : max), entries[0]);
const jsGzipBytes = entries
  .filter((entry) => entry.path.endsWith(".js"))
  .reduce((sum, entry) => sum + entry.gzipBytes, 0);
const cssGzipBytes = entries
  .filter((entry) => entry.path.endsWith(".css"))
  .reduce((sum, entry) => sum + entry.gzipBytes, 0);
const indexHtml = await readFile(join(DIST_DIR, "index.html"), "utf8");
const usesAbsoluteBundlePaths = /\s(?:src|href)=["']\/(?!\/)/.test(indexHtml);

const checks = [
  ["Largest file", largest?.bytes ?? 0, budgets.largestFileBytes, format],
  ["JS gzip", jsGzipBytes, budgets.initialJsGzipBytes, format],
  ["CSS gzip", cssGzipBytes, budgets.cssGzipBytes, format],
  ["File count", entries.length, budgets.fileCount, formatCount],
];

console.log(`INFO Total dist: ${format(totalBytes)} (informational, not budget-gated)`);

for (const [label, value, budget, formatter] of checks) {
  const status = value <= budget ? "OK" : "FAIL";
  console.log(`${status} ${label}: ${formatter(value)} / ${formatter(budget)}`);
}

if (largest) {
  console.log(`Largest: ${relative(largest.path)} (${format(largest.bytes)})`);
}

const pathStatus = usesAbsoluteBundlePaths ? "FAIL" : "OK";
console.log(`${pathStatus} Bundle paths: ${usesAbsoluteBundlePaths ? "absolute /assets path found" : "relative"}`);

const failed = checks.some(([, value, budget]) => value > budget) || usesAbsoluteBundlePaths;
if (failed) {
  process.exitCode = 1;
}

async function listFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    dirents.map((dirent) => {
      const fullPath = join(dir, dirent.name);
      return dirent.isDirectory() ? listFiles(fullPath) : fullPath;
    }),
  );
  return nested.flat();
}

function format(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatCount(count) {
  return `${count}`;
}

function relative(path) {
  return path.replace(`${DIST_DIR}/`, "dist/");
}
