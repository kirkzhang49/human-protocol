import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const sourceRoot = join(root, "src/assets/models");
const outputRoot = join(root, "src/assets/models-cooked");
const reportPath = join(root, "src/assets/manifests/reports/runtime_glb_cooking_report.json");
const cookPolicies = {
  environment: {
    id: "static_environment_meshopt_webp",
    runtimeDecodeSensitive: false,
    args: ["--simplify", "false", "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "2048"],
  },
  enemies: {
    id: "enemy_no_runtime_geometry_or_texture_recompression",
    runtimeDecodeSensitive: true,
    args: ["--simplify", "false", "--compress", "false", "--texture-compress", "false", "--texture-size", "2048", "--palette", "false"],
  },
};
const includeDirs = new Set(Object.keys(cookPolicies));
const onlyFiles = parseOnlyFiles();

if (!existsSync(sourceRoot)) {
  console.error(`Source model root not found: ${sourceRoot}`);
  process.exit(1);
}

mkdirSync(outputRoot, { recursive: true });

const inputs = (await listGlbs(sourceRoot))
  .filter((path) => includeDirs.has(relative(sourceRoot, path).split("/")[0]))
  .filter((path) => {
    if (!onlyFiles) return true;
    return onlyFiles.has(normalizePath(relative(sourceRoot, path)));
  });
if (inputs.length === 0) {
  console.error(`No runtime GLBs found in ${sourceRoot}${onlyFiles ? ` for --only=${[...onlyFiles].join(",")}` : ""}`);
  process.exit(1);
}

const results = [];
for (const inputFile of inputs) {
  const rel = relative(sourceRoot, inputFile);
  const outputFile = join(outputRoot, rel);
  const topDir = rel.split("/")[0];
  const policy = cookPolicies[topDir];
  mkdirSync(dirname(outputFile), { recursive: true });

  const before = statSync(inputFile).size;
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "@gltf-transform/cli",
      "optimize",
      inputFile,
      outputFile,
      ...policy.args,
    ],
    { stdio: "pipe", encoding: "utf8" },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const after = statSync(outputFile).size;
  const savedBytes = before - after;
  results.push({
    file: rel,
    policy: policy.id,
    runtimeDecodeSensitive: policy.runtimeDecodeSensitive,
    beforeBytes: before,
    afterBytes: after,
    savedBytes,
    savedRatio: before > 0 ? savedBytes / before : 0,
  });
  console.log(`${basename(inputFile)} ${policy.id} ${(before / 1024).toFixed(1)}KB -> ${(after / 1024).toFixed(1)}KB`);
}

const totals = results.reduce(
  (sum, item) => ({
    beforeBytes: sum.beforeBytes + item.beforeBytes,
    afterBytes: sum.afterBytes + item.afterBytes,
    savedBytes: sum.savedBytes + item.savedBytes,
  }),
  { beforeBytes: 0, afterBytes: 0, savedBytes: 0 },
);

const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot: "src/assets/models",
  outputRoot: "src/assets/models-cooked",
  command: "gltf-transform optimize with per-directory runtime decode policy",
  includedDirs: [...includeDirs],
  policies: Object.fromEntries(
    Object.entries(cookPolicies).map(([dir, policy]) => [
      dir,
      {
        id: policy.id,
        runtimeDecodeSensitive: policy.runtimeDecodeSensitive,
        args: policy.args,
      },
    ]),
  ),
  totalFiles: results.length,
  ...totals,
  savedRatio: totals.beforeBytes > 0 ? totals.savedBytes / totals.beforeBytes : 0,
  files: results.sort((a, b) => b.savedBytes - a.savedBytes),
};

mkdirSync(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Runtime GLB cooking report written: ${relative(root, reportPath)}`);

async function listGlbs(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    dirents.map((dirent) => {
      const path = join(dir, dirent.name);
      if (dirent.isDirectory()) return listGlbs(path);
      return extname(dirent.name).toLowerCase() === ".glb" ? [path] : [];
    }),
  );
  return nested.flat();
}

function parseOnlyFiles() {
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  if (!onlyArg) return null;
  const files = onlyArg
    .slice("--only=".length)
    .split(",")
    .map((value) => normalizePath(value.trim()))
    .filter(Boolean);
  return files.length > 0 ? new Set(files) : null;
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}
