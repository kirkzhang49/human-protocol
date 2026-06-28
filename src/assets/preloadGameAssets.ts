import mainBgmUrl from "./audio/music/last-human-bay.mp3";
import { preloadEnemyModelAssets, requiredEnemyModelCount } from "./enemyModelAssets";
import { preloadEnvironmentModelAssets, requiredEnvironmentModelCount } from "./environmentModelAssets";
import { viewmodelModelAssets } from "./viewmodelModelAssets";
import clampBotAtlasUrl from "./enemy-atlas/clamp-bot-atlas.jpg";
import custodianBossAtlasUrl from "./enemy-atlas/custodian-boss-atlas.jpg";
import environmentTrimSheetUrl from "./environment/environment-trim-sheet-01.jpg";
import floorWallSurfaceAtlasUrl from "./environment/floor-wall-surface-atlas-01.jpg";
import repairDroneAtlasUrl from "./enemy-atlas/repair-drone-atlas.jpg";
import propsDecalAtlasUrl from "./environment/props-decal-atlas-01.jpg";
import roomBackdropsUrl from "./environment/room-backdrops-01.jpg";
import clampBotUrl from "./first90/clamp-bot.jpg";
import cockpitWeaponBoardUrl from "./first90/cockpit-weapon-board.jpg";
import iconAssistUrl from "./first90/icon-assist.jpg";
import iconCoreUrl from "./first90/icon-core.jpg";
import iconPulseUrl from "./first90/icon-pulse.jpg";
import iconRailUrl from "./first90/icon-rail.jpg";
import iconShockUrl from "./first90/icon-shock.jpg";
import iconStoryUrl from "./first90/icon-story.jpg";
import maintenancePanelsUrl from "./first90/maintenance-bay-panels.jpg";
import repairDroneUrl from "./first90/repair-drone.jpg";
import shieldTechUrl from "./first90/shield-tech.jpg";
import upgradeIconsUrl from "./first90/upgrade-icons.jpg";
import weaponViewmodelAtlasUrl from "./viewmodel/weapon-viewmodel-atlas.jpg";

interface PreloadAsset {
  kind: "image" | "audio" | "model";
  url: string;
}

const preloadAssets: readonly PreloadAsset[] = [
  { kind: "image", url: maintenancePanelsUrl },
  { kind: "image", url: weaponViewmodelAtlasUrl },
  { kind: "image", url: repairDroneAtlasUrl },
  { kind: "image", url: clampBotAtlasUrl },
  { kind: "image", url: custodianBossAtlasUrl },
  { kind: "image", url: environmentTrimSheetUrl },
  { kind: "image", url: floorWallSurfaceAtlasUrl },
  { kind: "image", url: roomBackdropsUrl },
  { kind: "image", url: propsDecalAtlasUrl },
  { kind: "image", url: cockpitWeaponBoardUrl },
  { kind: "image", url: repairDroneUrl },
  { kind: "image", url: clampBotUrl },
  { kind: "image", url: shieldTechUrl },
  { kind: "image", url: upgradeIconsUrl },
  { kind: "image", url: iconAssistUrl },
  { kind: "image", url: iconCoreUrl },
  { kind: "image", url: iconPulseUrl },
  { kind: "image", url: iconRailUrl },
  { kind: "image", url: iconShockUrl },
  { kind: "image", url: iconStoryUrl },
  { kind: "audio", url: mainBgmUrl },
  ...Object.values(viewmodelModelAssets).map((asset) => ({ kind: "model" as const, url: asset.url })),
];

interface PreloadOptions {
  includeEnvironmentModels?: boolean;
}

let basePreloadPromise: Promise<void> | null = null;
let fullPreloadPromise: Promise<void> | null = null;

export function preloadGameAssets(onProgress?: (progress: number) => void, options: PreloadOptions = {}) {
  if (options.includeEnvironmentModels) {
    if (fullPreloadPromise) {
      fullPreloadPromise.then(() => onProgress?.(1));
      return fullPreloadPromise;
    }
    fullPreloadPromise = preloadGameAssetsComplete(onProgress);
    return fullPreloadPromise;
  }

  if (basePreloadPromise) {
    basePreloadPromise.then(() => onProgress?.(1));
    return basePreloadPromise;
  }

  basePreloadPromise = preloadGameAssetsBase(onProgress);
  return basePreloadPromise;
}

function preloadGameAssetsBase(onProgress?: (progress: number) => void) {
  let finished = 0;
  const total = preloadAssets.length + requiredEnemyModelCount();
  const tick = () => {
    finished += 1;
    onProgress?.(Math.min(1, finished / total));
  };

  return Promise.all([
    Promise.all(
      preloadAssets.map(async (asset) => {
        if (asset.kind === "image") {
          await preloadImage(asset.url);
        } else {
          await preloadFetch(asset.url);
        }
        tick();
      }),
    ),
    preloadEnemyModelAssets(() => tick()),
  ]).then(() => {
    onProgress?.(1);
  });
}

async function preloadGameAssetsComplete(onProgress?: (progress: number) => void) {
  onProgress?.(0.03);
  await preloadGameAssets((progress) => {
    onProgress?.(progress * 0.42);
  });
  onProgress?.(0.44);
  await preloadEnvironmentModelAssets((loaded, total) => {
    onProgress?.(0.44 + (total > 0 ? loaded / total : 1) * 0.56);
  });
  onProgress?.(1);
}

function preloadImage(url: string) {
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const done = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    image.decoding = "async";
    image.onload = () => {
      if (image.decode) {
        const timeout = window.setTimeout(() => done(), 1600);
        image.decode().then(
          () => {
            window.clearTimeout(timeout);
            done();
          },
          () => {
            window.clearTimeout(timeout);
            done();
          },
        );
      } else {
        done();
      }
    };
    image.onerror = () => done(new Error(`Required image asset failed to load: ${url}`));
    image.src = url;
  });
}

async function preloadFetch(url: string) {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Required asset failed to load: ${url}`);
  }
  await response.blob();
}
