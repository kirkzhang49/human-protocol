import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "src/assets/manifests/runtime/human_protocol_environment_assets.json");
const sourceAssetPrefix = join(root, "src");
const requiredKeys = [
  "pickup_large_yellow_key",
  "pickup_medkit_white_red",
  "pickup_energy_cell_amber",
  "pickup_memory_chip_cluster",
  "pickup_ammo_magazine",
  "prop_small_floor_shadow_disc",
  "switch_panel_wall_cyan",
  "switch_panel_wall_red",
  "switch_panel_floor_lever",
  "switch_state_light_cyan",
  "switch_state_light_amber",
  "switch_state_light_red",
  "prop_archive_book_open",
  "terminal_archive_reader",
  "terminal_quiz_panel_red",
  "terminal_quiz_panel_cyan",
  "door_identity_archive",
];

const requiredAtlases = [
  "props_pickups_atlas.jpg",
  "switch_panel_atlas.jpg",
  "archive_reader_atlas.jpg",
  "door_terminal_atlas.jpg",
];

const ordinaryBudgetBytes = 180 * 1024;
const heroDoorBudgetBytes = 350 * 1024;

function fail(message) {
  console.error(`Environment asset validation failed: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(manifestPath)) {
  fail(`missing manifest ${manifestPath}`);
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const assets = manifest.assets ?? [];
  const keys = new Set();

  for (const asset of assets) {
    if (!asset.modelKey) fail("asset missing modelKey");
    if (keys.has(asset.modelKey)) fail(`duplicate modelKey ${asset.modelKey}`);
    keys.add(asset.modelKey);

    for (const field of ["file", "category", "sizeMeters", "pivot", "collision", "materialAtlas", "mobileCost", "tags"]) {
      if (asset[field] === undefined) fail(`${asset.modelKey} missing ${field}`);
    }

    const filePath = join(sourceAssetPrefix, asset.file);
    if (!existsSync(filePath)) {
      fail(`${asset.modelKey} file not found at src/${asset.file}`);
      continue;
    }

    const size = statSync(filePath).size;
    const budget = asset.category === "door" && asset.mobileCost === "medium" ? heroDoorBudgetBytes : ordinaryBudgetBytes;
    if (size > budget) {
      console.warn(`Environment asset budget warning: ${asset.modelKey} is ${(size / 1024).toFixed(1)}KB; keeping high-fidelity review asset for current art pass.`);
    }
  }

  for (const key of requiredKeys) {
    if (!keys.has(key)) fail(`missing required modelKey ${key}`);
  }

  for (const atlas of requiredAtlases) {
    const atlasPath = join(root, "src/assets/textures/environment", atlas);
    if (!existsSync(atlasPath)) fail(`missing atlas ${atlas}`);
  }

  if (process.exitCode !== 1) {
    console.log(`Environment asset validation passed: ${assets.length} assets, ${requiredAtlases.length} atlases.`);
  }
}
