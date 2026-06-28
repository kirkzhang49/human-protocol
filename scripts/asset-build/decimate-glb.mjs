import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { basename, extname, join } from "node:path";

// Geometry decimation for over-tessellated GLBs (CC0 photogrammetry props are
// 100k+ tris each → the browser deep-cook expands them to non-indexed geometry
// and the pack balloons to tens of MB / ~1M vertices, slowing every load+bake).
//
// This welds + simplifies (meshoptimizer) + meshopt-compresses + caps textures,
// IN PLACE. The simplify error cap keeps quality bounded; low-poly models barely
// change. The browser cook (cookGlbModels) decodes meshopt + KHR_mesh_quantization
// since pack v20, so the cooked WebGPU vertex format is byte-for-byte unchanged —
// there are simply far fewer vertices.
//
// Usage: node scripts/asset-build/decimate-glb.mjs [dir] [ratio] [error] [minKB]

const inputDir = process.argv[2] ?? "src/assets/models-cooked/environment/props";
const ratio = process.argv[3] ?? "0.3"; // target fraction of vertices to keep
const error = process.argv[4] ?? "0.02"; // max simplify error (fraction of mesh radius)
const minKB = Number(process.argv[5] ?? "150"); // skip already-small models
const textureSize = "1024";

if (!existsSync(inputDir)) {
  console.error(`Input path not found: ${inputDir}`);
  process.exit(1);
}

const files = (
  statSync(inputDir).isDirectory()
    ? readdirSync(inputDir)
        .filter((file) => extname(file).toLowerCase() === ".glb")
        .map((file) => join(inputDir, file))
    : [inputDir]
).filter((file) => statSync(file).size / 1024 >= minKB);

if (files.length === 0) {
  console.error(`No .glb files >= ${minKB}KB found in ${inputDir}`);
  process.exit(1);
}

let beforeTotal = 0;
let afterTotal = 0;
let changed = 0;

for (const file of files) {
  const before = statSync(file).size;
  const tmp = file.replace(/\.glb$/i, ".decimated.tmp.glb");
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "@gltf-transform/cli",
      "optimize",
      file,
      tmp,
      "--simplify", "true",
      "--simplify-ratio", ratio,
      "--simplify-error", error,
      "--weld", "true",
      "--compress", "meshopt",
      "--texture-compress", "webp",
      "--texture-size", textureSize,
      "--join", "false",
      "--instance", "false",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  if (result.status !== 0 || !existsSync(tmp)) {
    console.log(`SKIP ${basename(file)} (optimize failed)`);
    if (existsSync(tmp)) unlinkSync(tmp);
    continue;
  }
  // Validate the output is still a readable glTF before clobbering the source.
  const valid = spawnSync("npx", ["--yes", "@gltf-transform/cli", "validate", tmp], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  const after = statSync(tmp).size;
  if (valid.status !== 0 || after >= before) {
    console.log(`SKIP ${basename(file)} (${valid.status !== 0 ? "invalid output" : "no size gain"})`);
    unlinkSync(tmp);
    continue;
  }
  renameSync(tmp, file);
  beforeTotal += before;
  afterTotal += after;
  changed += 1;
  console.log(
    `${basename(file)}  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB  (${((1 - after / before) * 100).toFixed(0)}% smaller)`,
  );
}

console.log(
  `\n${changed}/${files.length} decimated  ${(beforeTotal / 1024).toFixed(0)}KB -> ${(afterTotal / 1024).toFixed(0)}KB  ` +
    `(${beforeTotal > 0 ? ((1 - afterTotal / beforeTotal) * 100).toFixed(0) : 0}% smaller overall)`,
);
