import { rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const DIST_DIR = join(ROOT_DIR, "dist");
const OUTPUT_ZIP = join(ROOT_DIR, "human-protocol-crazygames.zip");

await rm(OUTPUT_ZIP, { force: true });
await run("zip", ["-qr", OUTPUT_ZIP, "."], { cwd: DIST_DIR });

const output = await stat(OUTPUT_ZIP);
console.log(`OK Package: human-protocol-crazygames.zip (${format(output.size)})`);

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function format(bytes) {
  const mb = 1024 * 1024;
  if (bytes >= mb) return `${(bytes / mb).toFixed(2)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}
