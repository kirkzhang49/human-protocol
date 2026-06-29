import { knownDoorSkinKeys, knownMapMaterialKeys, knownMapVisualKeys, knownRoomSkinKeys, mapVisualProfiles } from "../../visual/AssetResolver";
import type { EnemySpawnDefinition, LevelDefinition, LevelInteractionType, LevelPuzzleDefinition } from "../schema/levelConfig";
import { addIssue as add, type ConfigValidationIssue } from "./issues";

const generatedRoomMaterialKeys = new Set([
  "maintenance_bay_wet_floor",
  "maintenance_bay_glass_wall",
  "sterile_lab_floor",
  "sterile_lab_wall",
  "memory_clinic_floor",
  "memory_clinic_wall",
  "hazard_hall_floor",
  "hazard_hall_wall",
  "red_exit_floor",
  "red_exit_wall",
  "reclamation_core_floor",
  "reclamation_core_wall",
  "residential_floor",
  "residential_wall",
  // Old Level 3 闭馆电梯 room prefab for generated Builder exits.
  "museum_floor",
  "service_elevator_metal",
  // Builder museum / core room-style presets.
  "museum_wall",
  // Official Level 3 museum shell art pass.
  "level03_museum_floor_premium_stone",
  "level03_museum_wall_black_gallery",
]);

const generatedDoorMaterialKeys = new Set([
  "service_elevator_metal",
  "yellow_access_metal",
  "terminal_cyan",
  "terminal_red",
  // Premium door-art families pick the matching wall material for the door
  // surround (residential/clinic/reclamation/industrial).
  "residential_wall",
  "sterile_lab_wall",
  "memory_clinic_wall",
  "museum_wall",
  "level03_museum_wall_black_gallery",
  "hazard_hall_wall",
  "reclamation_core_wall",
]);

const generatedKeyVisualKeys = new Set([
  "yellow_access_card",
  "family_access_card",
  "large_yellow_key",
  "route_access_chip",
  "route_output_orb_1",
  "route_output_orb_2",
  "route_output_orb_3",
  "route_output_orb_4",
]);
const generatedKeyMaterialKeys = new Set(["access_card_gold", "terminal_cyan", "terminal_red"]);
const generatedPickupVisualKeys = new Set(["maintenance_crate"]);
const generatedScreenVisualKeys = new Set(["terminal_puzzle_big_screen", "puzzle_big_screen"]);
const generatedCodeClueVisualKeys = new Set(["wall_digit_warning"]);
const generatedPuzzleOrbVisualKeys = new Set([
  "puzzle_orb_red",
  "puzzle_orb_blue",
  "puzzle_orb_green",
  "puzzle_orb_yellow",
  "puzzle_orb_purple",
  "puzzle_orb_white",
  "puzzle_orb_cyan",
]);
const generatedPuzzleMaterialKeys = new Set([
  "puzzle_red_glass",
  "puzzle_blue_glass",
  "puzzle_green_glass",
  "puzzle_yellow_glass",
  "puzzle_purple_glass",
  "puzzle_white_glass",
  "puzzle_cyan_glass",
  "wall_digit_paint",
]);
const generatedInteractionMaterialKeys = new Set([
  "terminal_cyan",
  "terminal_red",
  "service_elevator_metal",
  "yellow_access_metal",
  "access_card_gold",
  "dark_service_crate",
]);
const generatedEnemyTextureAtlases = new Set(["repair_drone", "clamp_bot", "custodian_boss"]);
const generatedEnemyModelKeys = new Set([
  "hp_enemy_repair_drone_horror",
  "hp_enemy_clamp_repair_horror",
  "hp_enemy_shield_technician_horror",
  "hp_enemy_custodian_foreman_horror",
  "hp_enemy_reclamation_mother_final_horror",
]);
const generatedInteractionVisualKeysByType: Partial<Record<LevelInteractionType, ReadonlySet<string>>> = {
  inspect: new Set(["diagnostic_console", "control_bank", "repair_table", "cable_spine", "power_plinth", "home_light_panel"]),
  terminal: new Set(["sleep_record_terminal", "diagnostic_console", "control_bank", "three_color_order_panel", "puzzle_console_archive_merge", "puzzle_console_circuit_grid", "puzzle_console_color_sequence", "puzzle_console_gallery_reading", "puzzle_console_surveillance_match", "puzzle_console_valve_matrix", "home_light_panel", "direction_keypad_panel", "wall_door_switch_button", "none"]),
  door_panel: new Set(["direction_keypad_panel", "service_elevator_panel", "three_color_order_panel", "sleep_record_terminal"]),
  repair_panel: new Set(["diagnostic_console", "repair_table", "control_bank"]),
  memory_echo: new Set(["three_color_order_panel", "sleep_record_terminal", "home_light_panel", "diagnostic_console"]),
  article: new Set(["archive_book", "none"]),
  quiz: new Set(["direction_keypad_panel"]),
  switch: new Set(["direction_keypad_panel", "three_color_order_panel", "wall_door_switch_button"]),
  big_screen: generatedScreenVisualKeys,
  pickup_key: generatedKeyVisualKeys,
  pickup_story: new Set(["iron_rod_pickup", "pistol_pickup"]),
  exit: new Set(["exit_panel", "service_elevator_panel"]),
};

export function validateGeneratedAuthoringBoundary(
  level: LevelDefinition,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  if (level.authoringProfile === "internal") {
    add(
      warnings,
      "authoring.generated.internal_claim_ignored",
      "authoringProfile",
      "Generated/custom validation ignores internal authoringProfile; use curated generated style keys instead.",
    );
  }

  const map = level.map;
  if (map) {
    map.rooms.forEach((room, index) => {
      validateGeneratedKnownSkin(room.skinKey, `map.rooms[${index}].skinKey`, "room", errors);
      validateGeneratedMaterialSet(room.floorMaterialKey, `map.rooms[${index}].floorMaterialKey`, generatedRoomMaterialKeys, errors);
      validateGeneratedMaterialSet(room.wallMaterialKey, `map.rooms[${index}].wallMaterialKey`, generatedRoomMaterialKeys, errors);
      validateGeneratedMaterialSet(room.geometry?.floorMaterialKey, `map.rooms[${index}].geometry.floorMaterialKey`, generatedRoomMaterialKeys, errors);
      validateGeneratedMaterialSet(room.geometry?.wallMaterialKey, `map.rooms[${index}].geometry.wallMaterialKey`, generatedRoomMaterialKeys, errors);
    });

    map.doors.forEach((door, index) => {
      validateGeneratedKnownSkin(door.skinKey, `map.doors[${index}].skinKey`, "door", errors);
      validateGeneratedVisualPrimitive(door.visualKey, `map.doors[${index}].visualKey`, "door", errors);
      validateGeneratedMaterialSet(door.materialKey, `map.doors[${index}].materialKey`, generatedDoorMaterialKeys, errors);
    });

    map.keyItems.forEach((item, index) => {
      validateGeneratedVisualSet(item.visualKey, `map.keyItems[${index}].visualKey`, generatedKeyVisualKeys, errors);
      validateGeneratedKeyVisualPrimitive(item.visualKey, `map.keyItems[${index}].visualKey`, errors);
      validateGeneratedMaterialSet(item.materialKey, `map.keyItems[${index}].materialKey`, generatedKeyMaterialKeys, errors);
    });

    map.interactions.forEach((interaction, index) => {
      const visualPath = `map.interactions[${index}].visualKey`;
      validateGeneratedInteractionVisual(interaction.type, interaction.visualKey, interaction.anchorPropId, visualPath, errors);
      validateGeneratedMaterialSet(interaction.materialKey, `map.interactions[${index}].materialKey`, generatedInteractionMaterialKeys, errors);
    });

    map.pickups?.forEach((pickup, index) => {
      validateGeneratedVisualSet(pickup.visualKey, `map.pickups[${index}].visualKey`, generatedPickupVisualKeys, errors);
    });
  }

  level.puzzles?.forEach((puzzle, index) => {
    validateGeneratedPuzzleActors(puzzle, index, errors);
    if (puzzle.type === "hit_sequence") {
      puzzle.clue.surfaces?.forEach((surface, surfaceIndex) => {
        validateGeneratedMaterialSet(surface.materialKey, `puzzles[${index}].clue.surfaces[${surfaceIndex}].materialKey`, generatedPuzzleMaterialKeys, errors);
      });
      puzzle.targets.forEach((target, targetIndex) => {
        validateGeneratedVisualSet(target.visualKey, `puzzles[${index}].targets[${targetIndex}].visualKey`, generatedPuzzleOrbVisualKeys, errors);
        validateGeneratedVisualPrimitive(target.visualKey, `puzzles[${index}].targets[${targetIndex}].visualKey`, "puzzle_orb", errors);
        validateGeneratedMaterialSet(target.materialKey, `puzzles[${index}].targets[${targetIndex}].materialKey`, generatedPuzzleMaterialKeys, errors);
        if (target.visualKey && target.visualKey !== `puzzle_orb_${target.colorKey}`) {
          add(
            warnings,
            "authoring.generated.puzzle_orb.color_mismatch",
            `puzzles[${index}].targets[${targetIndex}].visualKey`,
            `Generated puzzle target "${target.id}" should keep visualKey aligned with colorKey "${target.colorKey}".`,
          );
        }
      });
    } else if (puzzle.type === "code_lock") {
      puzzle.clues.forEach((clue, clueIndex) => {
        validateGeneratedVisualSet(clue.visualKey, `puzzles[${index}].clues[${clueIndex}].visualKey`, generatedCodeClueVisualKeys, errors);
        validateGeneratedMaterialSet(clue.materialKey, `puzzles[${index}].clues[${clueIndex}].materialKey`, generatedPuzzleMaterialKeys, errors);
      });
    }
  });

  level.bigScreens?.forEach((screen, index) => {
    validateGeneratedVisualSet(screen.visualKey ?? screen.modelKey, `bigScreens[${index}].visualKey`, generatedScreenVisualKeys, errors);
    validateGeneratedMaterialSet(screen.materialKey, `bigScreens[${index}].materialKey`, generatedInteractionMaterialKeys, errors);
  });

  level.waves.forEach((wave, waveIndex) => {
    wave.enemies.forEach((spawn, spawnIndex) => {
      validateGeneratedEnemyStyle(spawn, `waves[${waveIndex}].enemies[${spawnIndex}]`, errors, warnings);
    });
    wave.reinforcements?.forEach((spawn, spawnIndex) => {
      validateGeneratedEnemyStyle(spawn, `waves[${waveIndex}].reinforcements[${spawnIndex}]`, errors, warnings);
    });
  });
}

function validateGeneratedPuzzleActors(
  puzzle: LevelPuzzleDefinition,
  index: number,
  errors: ConfigValidationIssue[],
) {
  puzzle.actors?.forEach((actor, actorIndex) => {
    const actorPath = `puzzles[${index}].actors[${actorIndex}]`;
    if (actor.kind === "target" && actor.colorKey) {
      validateGeneratedVisualSet(actor.visualKey, `${actorPath}.visualKey`, generatedPuzzleOrbVisualKeys, errors);
      validateGeneratedMaterialSet(actor.materialKey, `${actorPath}.materialKey`, generatedPuzzleMaterialKeys, errors);
      return;
    }
    validateGeneratedKnownVisual(actor.visualKey, `${actorPath}.visualKey`, errors);
    validateGeneratedMaterialSet(
      actor.materialKey,
      `${actorPath}.materialKey`,
      actor.kind === "control" || actor.kind === "hotspot" ? generatedInteractionMaterialKeys : generatedPuzzleMaterialKeys,
      errors,
    );
  });
}

function validateGeneratedEnemyStyle(
  spawn: EnemySpawnDefinition,
  path: string,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const visual = spawn.visual;
  if (!visual) return;
  if (visual.bodyColor || visual.armorColor) {
    add(errors, "authoring.generated.enemy.body_style", `${path}.visual`, "Generated enemy config may not recolor robot body or armor; use tier/archetype plus core/warning lights.");
  }
  if (visual.textureAtlasKey && !generatedEnemyTextureAtlases.has(visual.textureAtlasKey)) {
    add(errors, "authoring.generated.enemy.texture_atlas", `${path}.visual.textureAtlasKey`, `Generated enemy textureAtlasKey "${visual.textureAtlasKey}" is not curated.`);
  }
  if (visual.modelKey && !generatedEnemyModelKeys.has(visual.modelKey)) {
    add(errors, "authoring.generated.enemy.model_key", `${path}.visual.modelKey`, `Generated enemy modelKey "${visual.modelKey}" is not curated.`);
  }
  if (visual.scaleMultiplier !== undefined && (visual.scaleMultiplier < 0.72 || visual.scaleMultiplier > 1.45)) {
    add(warnings, "authoring.generated.enemy.scale_range", `${path}.visual.scaleMultiplier`, "Generated enemy scale should stay between 0.72 and 1.45 to preserve silhouette quality.");
  }
  if (visual.lightIntensityMultiplier !== undefined && (visual.lightIntensityMultiplier < 0.65 || visual.lightIntensityMultiplier > 1.9)) {
    add(warnings, "authoring.generated.enemy.light_range", `${path}.visual.lightIntensityMultiplier`, "Generated enemy light intensity should stay between 0.65 and 1.9.");
  }
}

function validateGeneratedKnownSkin(key: string | undefined, path: string, kind: "room" | "door", errors: ConfigValidationIssue[]) {
  if (!key) return;
  const known = kind === "room" ? knownRoomSkinKeys : knownDoorSkinKeys;
  if (known.has(key)) return;
  add(errors, `authoring.generated.${kind}_skin.unknown`, path, `Generated config may only use curated ${kind} skinKey values; "${key}" is unknown.`);
}

function validateGeneratedKnownVisual(key: string | undefined, path: string, errors: ConfigValidationIssue[]) {
  if (!key || knownMapVisualKeys.has(key)) return;
  add(errors, "authoring.generated.visual.unknown", path, `Generated config may only use curated visualKey values; "${key}" is unknown.`);
}

function validateGeneratedInteractionVisual(
  type: LevelInteractionType,
  key: string | undefined,
  anchorPropId: string | undefined,
  path: string,
  errors: ConfigValidationIssue[],
) {
  if (!key) return;
  validateGeneratedKnownVisual(key, path, errors);
  if (!knownMapVisualKeys.has(key)) return;
  // Interaction visualKey "none" is a curated hidden-hotspot sentinel. The
  // builder bake bridge resolves it to either hosted_prop (when anchored) or
  // hidden (when unanchored), so no standalone model is expected.
  if (key === "none") return;
  const allowed = generatedInteractionVisualKeysByType[type];
  if (!allowed || allowed.has(key)) return;
  add(errors, "authoring.generated.visual.disallowed", path, `Generated config cannot use visualKey "${key}" for this object family.`);
}

function validateGeneratedVisualSet(
  key: string | undefined,
  path: string,
  allowed: ReadonlySet<string>,
  errors: ConfigValidationIssue[],
) {
  if (!key) return;
  validateGeneratedKnownVisual(key, path, errors);
  if (!knownMapVisualKeys.has(key) || allowed.has(key)) return;
  add(errors, "authoring.generated.visual.disallowed", path, `Generated config cannot use visualKey "${key}" for this object family.`);
}

function validateGeneratedVisualPrimitive(
  key: string | undefined,
  path: string,
  primitive: string,
  errors: ConfigValidationIssue[],
) {
  if (!key || !knownMapVisualKeys.has(key)) return;
  const profile = mapVisualProfiles[key];
  // `none` is an explicit no-standalone-mesh sentinel for hosted interactions
  // (for example story/article hotspots anchored to an existing prop). The
  // caller's allow-list still decides where it is legal; primitive checks should
  // not reinterpret it as a wrong family.
  if (!profile || profile.primitive === "none" || profile.primitive === primitive) return;
  add(errors, "authoring.generated.visual.primitive", path, `Generated config expected a "${primitive}" visual family, but "${key}" is "${profile.primitive}".`);
}

function validateGeneratedKeyVisualPrimitive(
  key: string | undefined,
  path: string,
  errors: ConfigValidationIssue[],
) {
  if (!key || !knownMapVisualKeys.has(key)) return;
  const profile = mapVisualProfiles[key];
  if (!profile || profile.primitive === "none" || profile.primitive === "key_card") return;
  if (/^route_output_orb_[1-4]$/.test(key) && profile.primitive === "puzzle_orb") return;
  add(errors, "authoring.generated.visual.primitive", path, `Generated config expected a key pickup visual family, but "${key}" is "${profile.primitive}".`);
}

function validateGeneratedMaterialSet(
  key: string | undefined,
  path: string,
  allowed: ReadonlySet<string>,
  errors: ConfigValidationIssue[],
) {
  if (!key) return;
  if (!knownMapMaterialKeys.has(key)) {
    add(errors, "authoring.generated.material.unknown", path, `Generated config may only use curated materialKey values; "${key}" is unknown.`);
    return;
  }
  if (allowed.has(key)) return;
  add(errors, "authoring.generated.material.disallowed", path, `Generated config cannot use materialKey "${key}" for this object family.`);
}
