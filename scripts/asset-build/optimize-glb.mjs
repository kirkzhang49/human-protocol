import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

const inputArg = process.argv[2] ?? "src/assets/external/raw";
const outputDir = process.argv[3] ?? "src/assets/external/optimized";

if (!existsSync(inputArg)) {
  console.error(`Input path not found: ${inputArg}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

const inputFiles = statSync(inputArg).isDirectory()
  ? readdirSync(inputArg)
      .filter((file) => extname(file).toLowerCase() === ".glb")
      .map((file) => join(inputArg, file))
  : [inputArg];

if (inputFiles.length === 0) {
  console.error(`No .glb files found in ${inputArg}`);
  process.exit(1);
}

for (const inputFile of inputFiles) {
  const base = basename(inputFile, extname(inputFile));
  const outputFile = join(outputDir, `${base}.glb`);
  const before = statSync(inputFile).size;

  const result = spawnSync(
    "npx",
    [
      "--yes",
      "@gltf-transform/cli",
      "optimize",
      inputFile,
      outputFile,
      "--texture-compress",
      "webp",
      "--texture-size",
      "512",
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const after = statSync(outputFile).size;
  const delta = before > 0 ? ((1 - after / before) * 100).toFixed(1) : "0.0";
  console.log(`${basename(inputFile)} -> ${basename(outputFile)} ${(before / 1024).toFixed(1)}KB -> ${(after / 1024).toFixed(1)}KB (${delta}% smaller)`);
}
