import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { builderPropCatalog } from "./BuilderAssetCatalog";
import { builderPickupCatalog } from "./BuilderPickupCatalog";
import { isEnvironmentModelKey, loadEnvironmentModelAsset, type EnvironmentModelKey } from "../assets/environmentModelAssets";

declare global {
  interface Window {
    __hpThumbReady?: boolean;
    __hpThumbKeys?: string[];
    __hpThumbCapture?: (modelKey: string) => Promise<string>;
  }
}

const captureSize = 512;

/**
 * Dev-only deterministic thumbnail studio (route: /build?thumbCapture=1).
 * scripts/asset-build/generate-builder-asset-thumbnails.mjs drives it over CDP:
 * each catalog GLB is framed with a fixed 3/4 camera + warm key / soft neutral rim
 * lighting and returned as a webp data URL. Transparent background so the
 * catalog card gradient shows through.
 */
export function BuilderThumbnailCapturePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("初始化拍摄台…");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(captureSize, captureSize, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const camera = new PerspectiveCamera(30, 1, 0.05, 100);

    const buildStage = () => {
      const scene = new Scene();
      scene.add(new AmbientLight(0xfff2e2, 0.62));
      const hemi = new HemisphereLight(0xcdd6e4, 0x32220f, 0.42);
      scene.add(hemi);
      const key = new DirectionalLight(0xffdcae, 2.6);
      key.position.set(2.2, 3.1, 2.4);
      scene.add(key);
      const rim = new DirectionalLight(0xf0e6d2, 0.28);
      rim.position.set(-2.6, 2, -2.8);
      scene.add(rim);
      const fill = new DirectionalLight(0xb89a78, 0.45);
      fill.position.set(-1.4, 0.8, 2.6);
      scene.add(fill);
      return scene;
    };

    const thumbnailModelKeys = new Set<string>();
    for (const entry of builderPropCatalog) thumbnailModelKeys.add(entry.modelKey);
    for (const entry of builderPickupCatalog) thumbnailModelKeys.add(entry.modelKey);
    window.__hpThumbKeys = [...thumbnailModelKeys].filter((key) => isEnvironmentModelKey(key));
    window.__hpThumbCapture = async (modelKey: string) => {
      if (!isEnvironmentModelKey(modelKey)) throw new Error(`unknown modelKey ${modelKey}`);
      const source = await loadEnvironmentModelAsset(modelKey as EnvironmentModelKey);
      const model = source.clone(true);
      const scene = buildStage();
      scene.add(model);
      model.updateMatrixWorld(true);

      const bounds = new Box3().setFromObject(model);
      const center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      model.position.sub(center);
      const radius = Math.max(0.35, size.length() / 2);

      // Fixed 3/4 hero angle; wall pieces are flat, shoot them more frontally.
      const flat = size.z < size.x * 0.35 && size.z < size.y * 0.6;
      const azimuth = flat ? 0.3 : 0.7;
      const elevation = flat ? 0.18 : 0.42;
      const distance = radius * 3.35 + 0.45;
      camera.position.set(
        Math.sin(azimuth) * Math.cos(elevation) * distance,
        Math.sin(elevation) * distance,
        Math.cos(azimuth) * Math.cos(elevation) * distance,
      );
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/webp", 0.92);
    };
    window.__hpThumbReady = true;
    setStatus(`拍摄台就绪：${window.__hpThumbKeys.length} 个资产待拍摄`);

    return () => {
      window.__hpThumbReady = false;
      delete window.__hpThumbCapture;
      delete window.__hpThumbKeys;
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ background: "#0b101a", color: "#8da4c4", minHeight: "100vh", padding: 16, fontFamily: "monospace" }}>
      <p>{status}</p>
      <canvas ref={canvasRef} width={captureSize} height={captureSize} style={{ border: "1px solid #24344f", width: 256, height: 256 }} />
    </div>
  );
}
