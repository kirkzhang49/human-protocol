import path from "node:path";
import { fileURLToPath } from "node:url";

export function gameRootFromScript(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..", "..");
}

export function rawWebGpuGeneratedManifestDir(gameRoot) {
  return path.join(gameRoot, "src/assets/manifests/generated/raw-webgpu");
}

export function resolveFromRoot(gameRoot, value) {
  return path.isAbsolute(value) ? value : path.resolve(gameRoot, value);
}

export function relativeToRoot(gameRoot, value) {
  return path.relative(gameRoot, value).replaceAll(path.sep, "/");
}
