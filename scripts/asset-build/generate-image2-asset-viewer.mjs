#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function usage() {
  console.log(`Usage:
  node scripts/asset-build/generate-image2-asset-viewer.mjs \\
    --out .tmp/level02-image2-asset-viewer.html \\
    --title "Level 02 Image2 家具 Viewer" \\
    --manifest src/assets/manifests/builder/hp_level02_furniture_image2_v1.json

Multiple --manifest flags create one grouped viewer.`);
}

function parseArgs(argv) {
  const args = {
    manifests: [],
    out: ".tmp/image2-asset-viewer.html",
    title: "Human Protocol Image2 Asset Viewer",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--manifest") {
      const value = argv[++i];
      if (!value) throw new Error("--manifest requires a path");
      args.manifests.push(value);
      continue;
    }
    if (arg === "--out") {
      const value = argv[++i];
      if (!value) throw new Error("--out requires a path");
      args.out = value;
      continue;
    }
    if (arg === "--title") {
      const value = argv[++i];
      if (!value) throw new Error("--title requires text");
      args.title = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.manifests.length === 0) {
    throw new Error("At least one --manifest is required.");
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function slash(value) {
  return value.split(path.sep).join("/");
}

function relFromOut(outFile, absolutePath) {
  return slash(path.relative(path.dirname(outFile), absolutePath));
}

function thumbnailDirForPackId(packId) {
  return packId.replaceAll("_", "-");
}

function collectAssets(manifestPath, outFile) {
  const manifestAbs = path.resolve(ROOT, manifestPath);
  const manifest = readJson(manifestAbs);
  const packId = manifest.packId || manifest.id;
  if (!packId) throw new Error(`${manifestPath} is missing packId/id`);
  const thumbDir = path.resolve(ROOT, "src/assets/thumbnails/builder", thumbnailDirForPackId(packId));
  const manifestDir = path.dirname(manifestAbs);
  const lane = manifest.label || packId;

  return (manifest.assets || []).map((asset) => {
    const modelKey = asset.modelKey || asset.id;
    if (!modelKey) throw new Error(`${manifestPath} contains an asset without modelKey/id`);
    if (!asset.glbFile) throw new Error(`${modelKey} is missing glbFile`);
    const glbAbs = path.resolve(manifestDir, asset.glbFile);
    const thumbAbs = path.resolve(thumbDir, `${modelKey}.webp`);
    if (!fs.existsSync(glbAbs)) throw new Error(`Missing GLB for ${modelKey}: ${glbAbs}`);
    if (!fs.existsSync(thumbAbs)) throw new Error(`Missing thumbnail for ${modelKey}: ${thumbAbs}`);

    return {
      lane,
      packId,
      label: asset.label || modelKey,
      key: modelKey,
      group: asset.group || "",
      footprintFamily: asset.footprintFamily || "",
      sizeMeters: Array.isArray(asset.sizeMeters) ? asset.sizeMeters : null,
      thumb: relFromOut(outFile, thumbAbs),
      glb: relFromOut(outFile, glbAbs),
    };
  });
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function htmlTemplate({ title, assets }) {
  const data = {
    title,
    assets,
    generatedAt: new Date().toISOString(),
  };

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="icon" href="data:," />
  <script type="importmap">
    {
      "imports": {
        "three": "/node_modules/three/build/three.module.js",
        "three/addons/": "/node_modules/three/examples/jsm/"
      }
    }
  </script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1011;
      --panel: #12191b;
      --line: rgba(130, 224, 244, 0.22);
      --text: #edfafa;
      --muted: #91a7aa;
      --accent: #78dff1;
      --warn: #f3ba4f;
      --ok: #8af0c2;
    }

    * { box-sizing: border-box; }

    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      background: radial-gradient(circle at 18% 0%, rgba(120, 223, 241, 0.13), transparent 32rem), var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }

    .shell {
      display: grid;
      grid-template-columns: 338px minmax(0, 1fr);
      gap: 16px;
      height: 100%;
      padding: 16px;
    }

    .sidebar, .stage {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: color-mix(in srgb, var(--panel) 92%, black);
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.4);
      overflow: hidden;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .head {
      padding: 16px;
      border-bottom: 1px solid rgba(130, 224, 244, 0.14);
      background: linear-gradient(180deg, rgba(120, 223, 241, 0.06), rgba(0, 0, 0, 0));
    }

    h1 {
      margin: 0;
      font-size: 19px;
      letter-spacing: 0;
      line-height: 1.25;
    }

    .sub {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .list {
      overflow: auto;
      padding: 10px;
    }

    .group-title {
      padding: 12px 8px 7px;
      color: var(--warn);
      font-size: 11px;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .asset-button {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 10px;
      width: 100%;
      margin: 0 0 8px;
      padding: 8px;
      border: 1px solid rgba(130, 224, 244, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .asset-button:hover {
      border-color: rgba(120, 223, 241, 0.36);
      background: rgba(120, 223, 241, 0.06);
    }

    .asset-button.active {
      border-color: rgba(120, 223, 241, 0.75);
      box-shadow: inset 0 0 0 1px rgba(120, 223, 241, 0.35), 0 0 22px rgba(120, 223, 241, 0.13);
      background: rgba(120, 223, 241, 0.1);
    }

    .asset-button img {
      width: 76px;
      height: 58px;
      object-fit: contain;
      border-radius: 5px;
      background: #050708;
    }

    .asset-name {
      display: block;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .asset-key {
      display: block;
      margin-top: 5px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .stage {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-width: 0;
    }

    .toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(130, 224, 244, 0.14);
      background: rgba(8, 12, 13, 0.78);
    }

    .title { min-width: 0; }

    .title strong {
      display: block;
      font-size: 20px;
      overflow-wrap: anywhere;
    }

    .title span {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .tabs {
      display: inline-grid;
      grid-template-columns: 1fr 1fr;
      padding: 3px;
      border: 1px solid rgba(130, 224, 244, 0.26);
      border-radius: 8px;
      background: #0a1011;
    }

    .tab {
      min-width: 86px;
      border: 0;
      border-radius: 6px;
      padding: 8px 12px;
      background: transparent;
      color: var(--muted);
      font-weight: 850;
      cursor: pointer;
    }

    .tab.active {
      background: rgba(120, 223, 241, 0.16);
      color: var(--text);
      box-shadow: inset 0 0 0 1px rgba(120, 223, 241, 0.22);
    }

    .viewer {
      position: relative;
      min-height: 0;
      background:
        linear-gradient(rgba(120, 223, 241, 0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(120, 223, 241, 0.045) 1px, transparent 1px),
        radial-gradient(circle at 50% 25%, rgba(120, 223, 241, 0.12), transparent 34rem),
        #080d0e;
      background-size: 42px 42px, 42px 42px, auto, auto;
    }

    #threeHost, #twoDHost {
      position: absolute;
      inset: 0;
    }

    #threeHost { display: none; }
    #threeHost.active, #twoDHost.active { display: block; }

    #twoDHost {
      display: grid;
      place-items: center;
      padding: 28px;
    }

    #twoDHost img {
      max-width: min(82%, 900px);
      max-height: 78%;
      object-fit: contain;
      border: 1px solid rgba(130, 224, 244, 0.2);
      border-radius: 8px;
      background: #050708;
      box-shadow: 0 22px 90px rgba(0, 0, 0, 0.55);
    }

    .hint, .status {
      position: absolute;
      bottom: 16px;
      font-size: 12px;
      pointer-events: none;
    }

    .hint {
      left: 18px;
      color: rgba(237, 250, 250, 0.62);
    }

    .status {
      right: 18px;
      color: var(--ok);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    @media (max-width: 900px) {
      body { overflow: auto; }
      .shell {
        grid-template-columns: 1fr;
        height: auto;
        min-height: 100%;
      }
      .stage { height: 72vh; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <aside class="sidebar">
      <div class="head">
        <h1 id="pageTitle"></h1>
        <div class="sub">选择左侧资产，在右侧切换 2D 缩略图 / 3D GLB。3D 里可拖拽旋转、滚轮缩放。</div>
      </div>
      <div id="assetList" class="list"></div>
    </aside>

    <section class="stage">
      <div class="toolbar">
        <div class="title">
          <strong id="assetTitle">-</strong>
          <span id="assetKey">-</span>
        </div>
        <div class="tabs" aria-label="View mode">
          <button id="mode2d" class="tab active" type="button">2D View</button>
          <button id="mode3d" class="tab" type="button">3D View</button>
        </div>
      </div>
      <div class="viewer">
        <div id="twoDHost" class="active"><img id="previewImage" alt="" /></div>
        <div id="threeHost"></div>
        <div class="hint" id="hint">2D builder thumbnail</div>
        <div class="status" id="status">ready</div>
      </div>
    </section>
  </main>

  <script type="application/json" id="viewerData">${escapeScriptJson(data)}</script>
  <script type="module">
    import * as THREE from "three";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";

    const data = JSON.parse(document.querySelector("#viewerData").textContent);
    const assets = data.assets;
    const assetList = document.querySelector("#assetList");
    const assetTitle = document.querySelector("#assetTitle");
    const assetKey = document.querySelector("#assetKey");
    const pageTitle = document.querySelector("#pageTitle");
    const previewImage = document.querySelector("#previewImage");
    const twoDHost = document.querySelector("#twoDHost");
    const threeHost = document.querySelector("#threeHost");
    const statusEl = document.querySelector("#status");
    const hintEl = document.querySelector("#hint");
    const mode2d = document.querySelector("#mode2d");
    const mode3d = document.querySelector("#mode3d");

    pageTitle.textContent = data.title;
    let selected = assets[0];
    let mode = "2d";
    let renderer;
    let scene;
    let camera;
    let controls;
    let loader;
    let currentModel;
    let loadToken = 0;

    function renderList() {
      assetList.innerHTML = "";
      let lastLane = "";
      assets.forEach((asset) => {
        if (asset.lane !== lastLane) {
          lastLane = asset.lane;
          const title = document.createElement("div");
          title.className = "group-title";
          title.textContent = asset.lane;
          assetList.append(title);
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = \`asset-button \${asset.key === selected.key ? "active" : ""}\`;

        const image = document.createElement("img");
        image.src = asset.thumb;
        image.alt = "";

        const text = document.createElement("span");
        const name = document.createElement("span");
        name.className = "asset-name";
        name.textContent = asset.label;
        const key = document.createElement("span");
        key.className = "asset-key";
        key.textContent = asset.key;
        text.append(name, key);
        button.append(image, text);
        button.addEventListener("click", () => selectAsset(asset));
        assetList.append(button);
      });
    }

    function setMode(nextMode) {
      mode = nextMode;
      mode2d.classList.toggle("active", mode === "2d");
      mode3d.classList.toggle("active", mode === "3d");
      twoDHost.classList.toggle("active", mode === "2d");
      threeHost.classList.toggle("active", mode === "3d");
      threeHost.style.display = mode === "3d" ? "block" : "none";
      hintEl.textContent = mode === "3d" ? "drag rotate / wheel zoom" : "2D builder thumbnail";
      if (mode === "3d") {
        initThree();
        resizeRenderer();
        loadModel(selected);
      }
    }

    function selectAsset(asset) {
      selected = asset;
      assetTitle.textContent = asset.label;
      assetKey.textContent = asset.key;
      previewImage.src = asset.thumb;
      previewImage.alt = asset.label;
      renderList();
      if (mode === "3d") loadModel(asset);
    }

    function initThree() {
      if (renderer) return;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x080d0e);
      camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
      camera.position.set(3.8, 2.6, 4.2);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      threeHost.append(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.target.set(0, 0.7, 0);

      scene.add(new THREE.HemisphereLight(0xc7f7ff, 0x1a1712, 1.3));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
      keyLight.position.set(4, 7, 5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      scene.add(keyLight);

      const rim = new THREE.DirectionalLight(0x72e3ff, 1.6);
      rim.position.set(-5, 3, -4);
      scene.add(rim);

      const grid = new THREE.GridHelper(8, 16, 0x2a6974, 0x173137);
      grid.position.y = -0.01;
      scene.add(grid);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(4.2, 96),
        new THREE.MeshStandardMaterial({ color: 0x111819, roughness: 0.86, metalness: 0.1 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      loader = new GLTFLoader();
      window.addEventListener("resize", resizeRenderer);
      requestAnimationFrame(animate);
    }

    function resizeRenderer() {
      if (!renderer) return;
      const rect = threeHost.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    function clearModel() {
      if (!currentModel) return;
      scene.remove(currentModel);
      currentModel.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry?.dispose?.();
      });
      currentModel = null;
    }

    function fitCameraToObject(object) {
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      object.position.sub(center);
      object.position.y -= box.min.y - center.y;

      const fittedBox = new THREE.Box3().setFromObject(object);
      const fittedSize = new THREE.Vector3();
      const fittedCenter = new THREE.Vector3();
      fittedBox.getSize(fittedSize);
      fittedBox.getCenter(fittedCenter);
      const radius = Math.max(fittedSize.x, fittedSize.y, fittedSize.z, 0.35);
      const distance = radius * 1.65;
      camera.position.set(distance, Math.max(radius * 0.82, 1.2), distance * 1.08);
      controls.target.copy(fittedCenter);
      controls.update();
    }

    function loadModel(asset) {
      initThree();
      const token = ++loadToken;
      statusEl.textContent = "loading";
      loader.load(
        asset.glb,
        (gltf) => {
          if (token !== loadToken) return;
          clearModel();
          currentModel = gltf.scene;
          currentModel.traverse((node) => {
            if (!node.isMesh) return;
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
              node.material.envMapIntensity = 0.7;
              node.material.needsUpdate = true;
            }
          });
          scene.add(currentModel);
          fitCameraToObject(currentModel);
          statusEl.textContent = "3d loaded";
        },
        undefined,
        (error) => {
          console.error(error);
          statusEl.textContent = "load failed";
        }
      );
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!renderer) return;
      controls?.update();
      renderer.render(scene, camera);
    }

    mode2d.addEventListener("click", () => setMode("2d"));
    mode3d.addEventListener("click", () => setMode("3d"));
    renderList();
    selectAsset(assets[0]);
  </script>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outFile = path.resolve(ROOT, args.out);
  const assets = args.manifests.flatMap((manifestPath) => collectAssets(manifestPath, outFile));
  if (assets.length === 0) throw new Error("No assets found in manifests.");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, htmlTemplate({ title: args.title, assets }));
  console.log(`Wrote ${path.relative(ROOT, outFile)} (${assets.length} assets)`);
}

main();
