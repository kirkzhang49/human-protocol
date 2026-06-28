/**
 * Node ESM loader：把 Vite 资产静态导入（.glb/.webp/...）桩成字符串 URL，
 * 让纯 config/validator/compiler 能在 Node(tsx) 下被 import 而不炸 ERR_UNKNOWN_FILE_EXTENSION。
 * 只影响资产扩展名，其余一律透传给下游 loader（tsx）。纯工具，不进 runtime。
 */
const ASSET_RE =
  /\.(glb|gltf|bin|webp|png|jpe?g|gif|hdr|exr|ktx2|basis|draco|mp3|wav|ogg|m4a|aac|svg|fbx|obj|vrm|ttf|woff2?|mp4|webm|css)(\?.*)?$/i;

export async function resolve(specifier, context, nextResolve) {
  if (ASSET_RE.test(specifier)) {
    const url = new URL(specifier, context.parentURL).href;
    return { url, shortCircuit: true, format: "asset-stub" };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (context.format === "asset-stub" || ASSET_RE.test(url)) {
    return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(url)};` };
  }
  return nextLoad(url, context);
}
