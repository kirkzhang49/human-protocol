import { isEnvironmentModelKey } from "../../../assets/environmentModelAssets";
import { isStoryPaintingArtModelKey } from "../../visual/StoryPaintingArtKeys";
import { knownDoorSkinKeys, knownMapMaterialKeys, knownMapVisualKeys, knownRoomSkinKeys, mapVisualProfiles } from "../../visual/AssetResolver";
import { enemyArchetypes } from "../enemyArchetypes";
import {
  isKnownDoorKitId,
  isKnownLightingPresetId,
  isKnownPickupLayoutId,
  isKnownPreviewCameraId,
  isKnownPropSetId,
  isKnownRoomKitId,
  isKnownShellKitId,
  isKnownSpawnLayoutId,
  resolveRoomPresentation,
} from "../RoomPresentationRegistry";
import type {
  LevelDefinition,
  LevelDoorDefinition,
  LevelKeyItemDefinition,
  LevelMapConfig,
  LevelRoomDefinition,
  Vec3Tuple,
} from "../schema/levelConfig";
import { duplicateIds as duplicates, switchStateKey } from "./ids";
import {
  addIssue as add,
  type ConfigValidationIssue,
  validateColorOptional,
  validatePositiveOptional,
  validateUnitOptional,
} from "./issues";
import { createLevelReferenceSets } from "./referenceSets";

export function validateMap(
  level: LevelDefinition,
  map: LevelMapConfig,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const {
    roomIds,
    doorIds,
    keyItemIds,
    objectiveIds,
    articleIds,
    waveIds,
    puzzleIds,
    choiceIds,
    choiceOptionIds,
    switchIds,
    switchStateIds,
    environmentStateIds,
  } = createLevelReferenceSets(level);
  const duplicateRooms = duplicates(map.rooms.map((room) => room.id));
  const duplicateDoors = duplicates(map.doors.map((door) => door.id));

  for (const id of duplicateRooms) add(errors, "room.duplicate", `map.rooms.${id}`, `Duplicate room id "${id}".`);
  for (const id of duplicateDoors) add(errors, "door.duplicate", `map.doors.${id}`, `Duplicate door id "${id}".`);
  if (map.rooms.length === 0) add(errors, "rooms.empty", "map.rooms", "Map needs at least one room.");

  validateMapPresentation(map, errors, warnings);

  map.rooms.forEach((room, index) => {
    if (room.bounds.size[0] <= 0 || room.bounds.size[2] <= 0) {
      add(errors, "room.bounds.invalid", `map.rooms[${index}].bounds`, `Room "${room.id}" has invalid horizontal bounds.`);
    }
    validateRoomSkinKey(room.skinKey, `map.rooms[${index}].skinKey`, warnings);
    validateMaterialKey(room.floorMaterialKey, `map.rooms[${index}].floorMaterialKey`, warnings);
    validateMaterialKey(room.wallMaterialKey, `map.rooms[${index}].wallMaterialKey`, warnings);
    validateMaterialKey(room.geometry?.floorMaterialKey, `map.rooms[${index}].geometry.floorMaterialKey`, warnings);
    validateMaterialKey(room.geometry?.wallMaterialKey, `map.rooms[${index}].geometry.wallMaterialKey`, warnings);
  });

  map.doors.forEach((door, index) => {
    if (!roomIds.has(door.fromRoomId)) add(errors, "door.from.missing", `map.doors[${index}].fromRoomId`, `Door "${door.id}" references missing room "${door.fromRoomId}".`);
    if (!roomIds.has(door.toRoomId)) add(errors, "door.to.missing", `map.doors[${index}].toRoomId`, `Door "${door.id}" references missing room "${door.toRoomId}".`);
    if (door.lock.type === "key_item" && (!door.lock.keyItemId || !keyItemIds.has(door.lock.keyItemId))) {
      add(errors, "door.lock.key.missing", `map.doors[${index}].lock.keyItemId`, `Door "${door.id}" requires missing key item "${door.lock.keyItemId ?? ""}".`);
    }
    if (door.lock.type === "objective_complete" && (!door.lock.objectiveId || !objectiveIds.has(door.lock.objectiveId))) {
      add(errors, "door.lock.objective.missing", `map.doors[${index}].lock.objectiveId`, `Door "${door.id}" requires missing objective "${door.lock.objectiveId ?? ""}".`);
    }
    if (door.lock.type === "survive_wave") {
      const requiredWaveIds = [...(door.lock.waveIds ?? []), ...(door.lock.waveId ? [door.lock.waveId] : [])];
      if (requiredWaveIds.length === 0) {
        add(errors, "door.lock.wave.missing", `map.doors[${index}].lock.waveId`, `Door "${door.id}" requires a wave.`);
      }
      for (const requiredWaveId of requiredWaveIds) {
        if (!waveIds.has(requiredWaveId)) {
          add(errors, "door.lock.wave.missing", `map.doors[${index}].lock.waveId`, `Door "${door.id}" requires missing wave "${requiredWaveId}".`);
        }
      }
    }
    if (door.lock.type === "puzzle_complete") {
      const requiredPuzzleIds = [...(door.lock.puzzleIds ?? []), ...(door.lock.puzzleId ? [door.lock.puzzleId] : [])];
      const uniquePuzzleIds = [...new Set(requiredPuzzleIds.filter(Boolean))];
      if (uniquePuzzleIds.length === 0) {
        add(errors, "door.lock.puzzle.missing", `map.doors[${index}].lock.puzzleId`, `Door "${door.id}" requires a puzzle.`);
      }
      for (const requiredPuzzleId of uniquePuzzleIds) {
        if (!puzzleIds.has(requiredPuzzleId)) {
          add(errors, "door.lock.puzzle.missing", `map.doors[${index}].lock.puzzleId`, `Door "${door.id}" requires missing puzzle "${requiredPuzzleId}".`);
        }
      }
    }
    if (door.lock.type === "puzzle_complete" && door.lock.keyItemId && !keyItemIds.has(door.lock.keyItemId)) {
      add(errors, "door.lock.puzzle.key.missing", `map.doors[${index}].lock.keyItemId`, `Door "${door.id}" requires missing puzzle key "${door.lock.keyItemId}".`);
    }
    if ((door.lock.type === "memory_choice" || door.lock.type === "choice_selected") && (!door.lock.choiceId || !choiceIds.has(door.lock.choiceId))) {
      add(errors, "door.lock.choice.missing", `map.doors[${index}].lock.choiceId`, `Door "${door.id}" requires missing choice "${door.lock.choiceId ?? ""}".`);
    }
    if (
      (door.lock.type === "memory_choice" || door.lock.type === "choice_selected") &&
      door.lock.choiceId &&
      door.lock.choiceOptionId &&
      !choiceOptionIds.has(`${door.lock.choiceId}:${door.lock.choiceOptionId}`)
    ) {
      add(errors, "door.lock.choice.option.missing", `map.doors[${index}].lock.choiceOptionId`, `Door "${door.id}" requires missing choice option "${door.lock.choiceOptionId}".`);
    }
    if (door.lock.type === "environment_state" && (!door.lock.environmentStateId || !environmentStateIds.has(door.lock.environmentStateId))) {
      add(errors, "door.lock.environment.missing", `map.doors[${index}].lock.environmentStateId`, `Door "${door.id}" requires missing environment state "${door.lock.environmentStateId ?? ""}".`);
    }
    if (door.lock.type === "switch_state") {
      if (!door.lock.switchId || !switchIds.has(door.lock.switchId)) {
        add(errors, "door.lock.switch.missing", `map.doors[${index}].lock.switchId`, `Door "${door.id}" requires missing switch "${door.lock.switchId ?? ""}".`);
      } else if (!door.lock.stateId || !switchStateIds.has(switchStateKey(door.lock.switchId, door.lock.stateId))) {
        add(errors, "door.lock.switch.state.missing", `map.doors[${index}].lock.stateId`, `Door "${door.id}" requires missing switch state "${door.lock.switchId}:${door.lock.stateId ?? ""}".`);
      }
    }
    if (door.lock.type === "inventory_count" && (!door.lock.requiredCount || door.lock.requiredCount <= 0)) {
      add(errors, "door.lock.count.invalid", `map.doors[${index}].lock.requiredCount`, `Door "${door.id}" needs a positive requiredCount.`);
    }
    if (door.defaultState === "locked" && !door.lock.lockedMessage) {
      add(warnings, "door.lock.message.missing", `map.doors[${index}].lock.lockedMessage`, `Locked door "${door.id}" should tell the player what is missing.`);
    }
    validateVisualKey(door.visualKey, `map.doors[${index}].visualKey`, warnings);
    validateMaterialKey(door.materialKey, `map.doors[${index}].materialKey`, warnings);
    validateDoorSkinKey(door.skinKey, `map.doors[${index}].skinKey`, warnings);
  });

  validateDoorCollisionOpenings(map, errors);

  map.keyItems.forEach((item, index) => {
    if (!roomIds.has(item.roomId)) add(errors, "key.room.missing", `map.keyItems[${index}].roomId`, `Key item "${item.id}" references missing room "${item.roomId}".`);
    for (const doorId of item.requiredForDoorIds) {
      if (!doorIds.has(doorId)) add(errors, "key.door.missing", `map.keyItems[${index}].requiredForDoorIds`, `Key item "${item.id}" references missing door "${doorId}".`);
    }
    if (item.requiresObjectiveId && !objectiveIds.has(item.requiresObjectiveId)) {
      add(errors, "key.objective.missing", `map.keyItems[${index}].requiresObjectiveId`, `Key item "${item.id}" requires missing objective "${item.requiresObjectiveId}".`);
    }
    if (item.dropFromArchetypeId && !Object.prototype.hasOwnProperty.call(enemyArchetypes, item.dropFromArchetypeId)) {
      add(errors, "key.drop.actor.missing", `map.keyItems[${index}].dropFromArchetypeId`, `Key item "${item.id}" drops from unknown archetype "${item.dropFromArchetypeId}".`);
    }
    if (!pointInsideAnyRoom(item.position, map)) {
      add(warnings, "key.position.outside", `map.keyItems[${index}].position`, `Key item "${item.id}" is outside every room bounds.`);
    }
    validateVisualKey(item.visualKey, `map.keyItems[${index}].visualKey`, warnings);
    validateMaterialKey(item.materialKey, `map.keyItems[${index}].materialKey`, warnings);
    validateKeyItemSalience(item, index, warnings);
  });

  map.interactions.forEach((interaction, index) => {
    if (!roomIds.has(interaction.roomId)) add(errors, "interaction.room.missing", `map.interactions[${index}].roomId`, `Interaction "${interaction.id}" references missing room "${interaction.roomId}".`);
    if (interaction.opensDoorId && !doorIds.has(interaction.opensDoorId)) {
      add(errors, "interaction.door.missing", `map.interactions[${index}].opensDoorId`, `Interaction "${interaction.id}" opens missing door "${interaction.opensDoorId}".`);
    }
    if (interaction.grantsKeyItemId && !keyItemIds.has(interaction.grantsKeyItemId)) {
      add(errors, "interaction.key.missing", `map.interactions[${index}].grantsKeyItemId`, `Interaction "${interaction.id}" grants missing key item "${interaction.grantsKeyItemId}".`);
    }
    if (interaction.requiresObjectiveId && !objectiveIds.has(interaction.requiresObjectiveId)) {
      add(errors, "interaction.objective.missing", `map.interactions[${index}].requiresObjectiveId`, `Interaction "${interaction.id}" requires missing objective "${interaction.requiresObjectiveId}".`);
    }
    (interaction.requiresArticleIds ?? []).forEach((articleId, articleIndex) => {
      if (!articleIds.has(articleId)) {
        add(errors, "interaction.article.missing", `map.interactions[${index}].requiresArticleIds[${articleIndex}]`, `Interaction "${interaction.id}" requires missing article "${articleId}".`);
      }
    });
    if (interaction.requiresSwitchState) {
      const { switchId, stateId } = interaction.requiresSwitchState;
      if (!switchIds.has(switchId)) {
        add(errors, "interaction.switch.missing", `map.interactions[${index}].requiresSwitchState.switchId`, `Interaction "${interaction.id}" requires missing switch "${switchId}".`);
      } else if (!switchStateIds.has(switchStateKey(switchId, stateId))) {
        add(errors, "interaction.switch.state.missing", `map.interactions[${index}].requiresSwitchState.stateId`, `Interaction "${interaction.id}" requires missing switch state "${switchId}:${stateId}".`);
      }
    }
    if (interaction.startsObjectiveId && !objectiveIds.has(interaction.startsObjectiveId)) {
      add(errors, "interaction.objective.start.missing", `map.interactions[${index}].startsObjectiveId`, `Interaction "${interaction.id}" starts missing objective "${interaction.startsObjectiveId}".`);
    }
    if (interaction.completesObjectiveId && !objectiveIds.has(interaction.completesObjectiveId)) {
      add(errors, "interaction.objective.complete.missing", `map.interactions[${index}].completesObjectiveId`, `Interaction "${interaction.id}" completes missing objective "${interaction.completesObjectiveId}".`);
    }
    if (!pointInsideAnyRoom(interaction.position, map)) {
      add(warnings, "interaction.position.outside", `map.interactions[${index}].position`, `Interaction "${interaction.id}" is outside every room bounds.`);
    }
    validateVisualKey(interaction.visualKey, `map.interactions[${index}].visualKey`, warnings);
    validateMaterialKey(interaction.materialKey, `map.interactions[${index}].materialKey`, warnings);
  });

  map.pickups?.forEach((pickup, index) => {
    if (!roomIds.has(pickup.roomId)) {
      add(errors, "pickup.room.missing", `map.pickups[${index}].roomId`, `Static pickup "${pickup.id}" references missing room "${pickup.roomId}".`);
    }
    if (!pointInsideAnyRoom(pickup.position, map)) {
      add(warnings, "pickup.position.outside", `map.pickups[${index}].position`, `Static pickup "${pickup.id}" is outside every room bounds.`);
    }
    validateVisualKey(pickup.visualKey, `map.pickups[${index}].visualKey`, warnings);
  });

  map.props?.forEach((prop, index) => {
    if (!roomIds.has(prop.roomId)) {
      add(errors, "prop.room.missing", `map.props[${index}].roomId`, `Map prop "${prop.id}" references missing room "${prop.roomId}".`);
    }
    if (!isEnvironmentModelKey(prop.modelKey) && !isStoryPaintingArtModelKey(prop.modelKey)) {
      add(errors, "prop.model.missing", `map.props[${index}].modelKey`, `Map prop "${prop.id}" references unknown environment model "${prop.modelKey}".`);
    }
    if (!pointInsideAnyRoom(prop.position, map)) {
      add(warnings, "prop.position.outside", `map.props[${index}].position`, `Map prop "${prop.id}" is outside every room bounds.`);
    }
    if (prop.collider?.halfSize.some((value) => value <= 0)) {
      add(errors, "prop.collider.invalid", `map.props[${index}].collider.halfSize`, `Map prop "${prop.id}" has non-positive collider halfSize.`);
    }
  });

  map.decals?.forEach((decal, index) => {
    if (!roomIds.has(decal.roomId)) {
      add(errors, "decal.room.missing", `map.decals[${index}].roomId`, `Map decal "${decal.id}" references missing room "${decal.roomId}".`);
    }
    if (!pointInsideAnyRoom(decal.position, map)) {
      add(warnings, "decal.position.outside", `map.decals[${index}].position`, `Map decal "${decal.id}" is outside every room bounds.`);
    }
    if (decal.size[0] <= 0 || decal.size[1] <= 0) {
      add(errors, "decal.size.invalid", `map.decals[${index}].size`, `Map decal "${decal.id}" needs a positive size.`);
    }
  });

  for (const roomId of map.navigation.criticalPathRoomIds) {
    if (!roomIds.has(roomId)) add(errors, "navigation.room.missing", "map.navigation.criticalPathRoomIds", `Critical path references missing room "${roomId}".`);
  }
  if (map.navigation.criticalPathRoomIds.length > Math.max(1, map.navigation.mobileReadableDoorCount + 1)) {
    add(warnings, "navigation.mobile.complex", "map.navigation", "Critical path may be too complex for mobile readability.");
  }

  validateReachability(level, map, errors);
  validateKeyPlacement(level, map, errors);
}

function validateMapPresentation(
  map: LevelMapConfig,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const presentation = map.presentation;
  if (!presentation) return;

  if (presentation.roomKit && !isKnownRoomKitId(presentation.roomKit)) {
    add(errors, "roomKit.unknown", "map.presentation.roomKit", `Unknown room kit "${presentation.roomKit}".`);
  }
  validateKnownPresentationId(presentation.shellKit, "map.presentation.shellKit", isKnownShellKitId, "shellKit", errors);
  validateKnownPresentationId(presentation.lightingPreset, "map.presentation.lightingPreset", isKnownLightingPresetId, "lightingPreset", errors);
  validateKnownPresentationId(presentation.doorKit, "map.presentation.doorKit", isKnownDoorKitId, "doorKit", errors);
  validateKnownPresentationId(presentation.propSet, "map.presentation.propSet", isKnownPropSetId, "propSet", errors);
  validateKnownPresentationId(presentation.spawnLayout, "map.presentation.spawnLayout", isKnownSpawnLayoutId, "spawnLayout", errors);
  validateKnownPresentationId(presentation.pickupLayout, "map.presentation.pickupLayout", isKnownPickupLayoutId, "pickupLayout", errors);
  validateKnownPresentationId(presentation.previewCamera, "map.presentation.previewCamera", isKnownPreviewCameraId, "previewCamera", errors);

  const overrides = presentation.overrides;
  validateKnownPresentationId(overrides?.shellKit, "map.presentation.overrides.shellKit", isKnownShellKitId, "shellKit", errors);
  validateKnownPresentationId(overrides?.lightingPreset, "map.presentation.overrides.lightingPreset", isKnownLightingPresetId, "lightingPreset", errors);
  validateKnownPresentationId(overrides?.doorKit, "map.presentation.overrides.doorKit", isKnownDoorKitId, "doorKit", errors);
  validateKnownPresentationId(overrides?.propSet, "map.presentation.overrides.propSet", isKnownPropSetId, "propSet", errors);
  validateKnownPresentationId(overrides?.spawnLayout, "map.presentation.overrides.spawnLayout", isKnownSpawnLayoutId, "spawnLayout", errors);
  validateKnownPresentationId(overrides?.pickupLayout, "map.presentation.overrides.pickupLayout", isKnownPickupLayoutId, "pickupLayout", errors);
  validateUnitOptional(overrides?.floorWear, "map.presentation.overrides.floorWear", warnings);
  validatePositiveOptional(overrides?.ceilingLightIntensity, "map.presentation.overrides.ceilingLightIntensity", warnings);
  validatePositiveOptional(overrides?.fogFar, "map.presentation.overrides.fogFar", warnings);

  const resolved = resolveRoomPresentation(map);
  if (!resolved) return;
  if (resolved.shellKitId && !resolved.shell) {
    add(errors, "roomKit.shell.missing", "map.presentation", `Room presentation references missing shell kit "${resolved.shellKitId}".`);
  }
  if (resolved.lightingPresetId && !resolved.lighting) {
    add(errors, "roomKit.lighting.missing", "map.presentation", `Room presentation references missing lighting preset "${resolved.lightingPresetId}".`);
  }
  if (resolved.doorKitId && !resolved.doorKit) {
    add(errors, "roomKit.door.missing", "map.presentation", `Room presentation references missing door kit "${resolved.doorKitId}".`);
  }
  if (resolved.propSetId && !resolved.propSet) {
    add(errors, "roomKit.propSet.missing", "map.presentation", `Room presentation references missing prop set "${resolved.propSetId}".`);
  }
  if (resolved.spawnLayoutId && !resolved.spawnLayout) {
    add(errors, "roomKit.spawnLayout.missing", "map.presentation", `Room presentation references missing spawn layout "${resolved.spawnLayoutId}".`);
  }
  if (resolved.pickupLayoutId && !resolved.pickupLayout) {
    add(errors, "roomKit.pickupLayout.missing", "map.presentation", `Room presentation references missing pickup layout "${resolved.pickupLayoutId}".`);
  }
  if (resolved.previewCameraId && !resolved.previewCamera) {
    add(errors, "roomKit.previewCamera.missing", "map.presentation", `Room presentation references missing preview camera "${resolved.previewCameraId}".`);
  }
  if (resolved.shell) {
    validateKnownEnvironmentModelKey(resolved.shell.floorModelKey, "roomKit.shell.floorModelKey", errors);
    validateKnownEnvironmentModelKey(resolved.shell.wallModelKey, "roomKit.shell.wallModelKey", errors);
    validateKnownEnvironmentModelKey(resolved.shell.ceilingModelKey, "roomKit.shell.ceilingModelKey", errors);
    validateKnownEnvironmentModelKey(resolved.shell.cornerPillarModelKey, "roomKit.shell.cornerPillarModelKey", errors);
    validateKnownEnvironmentModelKey(resolved.shell.wallWashLightModelKey, "roomKit.shell.wallWashLightModelKey", errors);
    validateColorOptional(resolved.shell.floorBaseColor, "roomKit.shell.floorBaseColor", warnings);
    validateColorOptional(resolved.shell.floorPanelColor, "roomKit.shell.floorPanelColor", warnings);
    validateColorOptional(resolved.shell.floorTrimColor, "roomKit.shell.floorTrimColor", warnings);
    validateColorOptional(resolved.shell.floorAccentColor, "roomKit.shell.floorAccentColor", warnings);
    validateUnitOptional(resolved.shell.floorReflectionOpacity, "roomKit.shell.floorReflectionOpacity", warnings);
    validatePositiveOptional(resolved.shell.floorReflectionStrength, "roomKit.shell.floorReflectionStrength", warnings);
    validateColorOptional(resolved.shell.ceilingBaseColor, "roomKit.shell.ceilingBaseColor", warnings);
    validateColorOptional(resolved.shell.ceilingBeamColor, "roomKit.shell.ceilingBeamColor", warnings);
    validateColorOptional(resolved.shell.ceilingPanelColor, "roomKit.shell.ceilingPanelColor", warnings);
    validateColorOptional(resolved.shell.ceilingAccentColor, "roomKit.shell.ceilingAccentColor", warnings);
    validateUnitOptional(resolved.shell.guideLineOpacity, "roomKit.shell.guideLineOpacity", warnings);
    validateUnitOptional(resolved.shell.ceilingLightOpacity, "roomKit.shell.ceilingLightOpacity", warnings);
  }
  if (resolved.lighting) {
    validateColorOptional(resolved.lighting.ambient.color, "roomKit.lighting.ambient.color", warnings);
    validateUnitOptional(resolved.lighting.ambient.intensity, "roomKit.lighting.ambient.intensity", warnings);
    validatePositiveOptional(resolved.lighting.hemisphereIntensity, "roomKit.lighting.hemisphereIntensity", warnings);
    validateColorOptional(resolved.lighting.directional?.color, "roomKit.lighting.directional.color", warnings);
    validatePositiveOptional(resolved.lighting.directional?.intensity, "roomKit.lighting.directional.intensity", warnings);
    validateColorOptional(resolved.lighting.fog.color, "roomKit.lighting.fog.color", warnings);
    validatePositiveOptional(resolved.lighting.fog.far, "roomKit.lighting.fog.far", warnings);
    validatePositiveOptional(resolved.lighting.bloom.intensity, "roomKit.lighting.bloom.intensity", warnings);
    validateUnitOptional(resolved.lighting.bloom.threshold, "roomKit.lighting.bloom.threshold", warnings);
    resolved.lighting.lights.forEach((light, index) => {
      validateColorOptional(light.color, `roomKit.lighting.lights[${index}].color`, warnings);
      if (light.type === "point" || light.type === "spot" || light.type === "area") {
        validateColorOptional(light.lockedColor, `roomKit.lighting.lights[${index}].lockedColor`, warnings);
        validateColorOptional(light.unlockedColor, `roomKit.lighting.lights[${index}].unlockedColor`, warnings);
        validatePositiveOptional(light.intensity, `roomKit.lighting.lights[${index}].intensity`, warnings);
        if (light.type !== "area") {
          validatePositiveOptional(light.distance, `roomKit.lighting.lights[${index}].distance`, warnings);
        }
        if (light.type === "spot") {
          validatePositiveOptional(light.angle, `roomKit.lighting.lights[${index}].angle`, warnings);
          validateUnitOptional(light.penumbra, `roomKit.lighting.lights[${index}].penumbra`, warnings);
        }
        if (light.type === "area") {
          validatePositiveOptional(light.width, `roomKit.lighting.lights[${index}].width`, warnings);
          validatePositiveOptional(light.height, `roomKit.lighting.lights[${index}].height`, warnings);
        }
      } else {
        validateUnitOptional(light.opacity, `roomKit.lighting.lights[${index}].opacity`, warnings);
        validateUnitOptional(light.lockdownOpacity, `roomKit.lighting.lights[${index}].lockdownOpacity`, warnings);
      }
    });
  }
  if (resolved.doorKit) {
    validateKnownEnvironmentModelKey(resolved.doorKit.doorModelKey, "roomKit.doorKit.doorModelKey", errors);
    validateKnownEnvironmentModelKey(resolved.doorKit.thresholdModelKey, "roomKit.doorKit.thresholdModelKey", errors);
    if (resolved.doorKit.panelModelKey !== "none") {
      validateKnownEnvironmentModelKey(resolved.doorKit.panelModelKey, "roomKit.doorKit.panelModelKey", errors);
    }
    validateColorOptional(resolved.doorKit.statusColors?.locked, "roomKit.doorKit.statusColors.locked", warnings);
    validateColorOptional(resolved.doorKit.statusColors?.unlocked, "roomKit.doorKit.statusColors.unlocked", warnings);
    validateColorOptional(resolved.doorKit.statusColors?.open, "roomKit.doorKit.statusColors.open", warnings);
    validatePositiveOptional(resolved.doorKit.statusGlow?.lockedIntensity, "roomKit.doorKit.statusGlow.lockedIntensity", warnings);
    validatePositiveOptional(resolved.doorKit.statusGlow?.unlockedIntensity, "roomKit.doorKit.statusGlow.unlockedIntensity", warnings);
    validatePositiveOptional(resolved.doorKit.statusGlow?.openIntensity, "roomKit.doorKit.statusGlow.openIntensity", warnings);
    validateUnitOptional(resolved.doorKit.statusGlow?.opacityLocked, "roomKit.doorKit.statusGlow.opacityLocked", warnings);
    validateUnitOptional(resolved.doorKit.statusGlow?.opacityUnlocked, "roomKit.doorKit.statusGlow.opacityUnlocked", warnings);
  }
  if (resolved.pickupLayout) {
    validatePositiveOptional(resolved.pickupLayout.avoidCombatLaneRadius, "roomKit.pickupLayout.avoidCombatLaneRadius", warnings);
    validatePositiveOptional(resolved.pickupLayout.dynamicSpacingRadius, "roomKit.pickupLayout.dynamicSpacingRadius", warnings);
    validatePositiveOptional(resolved.pickupLayout.dropScatterRadius, "roomKit.pickupLayout.dropScatterRadius", warnings);
    validatePositiveOptional(resolved.pickupLayout.energyGlowIntensity, "roomKit.pickupLayout.energyGlowIntensity", warnings);
    validateColorOptional(resolved.pickupLayout.energyGlowColor, "roomKit.pickupLayout.energyGlowColor", warnings);
    validateColorOptional(resolved.pickupLayout.repairBeaconColor, "roomKit.pickupLayout.repairBeaconColor", warnings);
  }
  if (resolved.propSet) {
    resolved.propSet.requiredModelKeys.forEach((modelKey, index) => {
      validateKnownEnvironmentModelKey(modelKey, `roomKit.propSet.requiredModelKeys[${index}]`, errors);
    });
    resolved.propSet.optionalModelKeys.forEach((modelKey, index) => {
      validateKnownEnvironmentModelKey(modelKey, `roomKit.propSet.optionalModelKeys[${index}]`, errors);
    });
  }

  if (resolved.archetype === "large_combat_arena") {
    const largestRoomArea = map.rooms.reduce((area, room) => Math.max(area, room.bounds.size[0] * room.bounds.size[2]), 0);
    if (!resolved.spawnLayout) {
      add(errors, "roomKit.largeArena.spawnLayout.missing", "map.presentation.spawnLayout", "Large combat arena room kits need a spawn layout.");
    }
    if (!resolved.pickupLayout) {
      add(warnings, "roomKit.largeArena.pickupLayout.missing", "map.presentation.pickupLayout", "Large combat arena room kits should include a readable pickup layout.");
    }
    if (largestRoomArea < 120) {
      add(warnings, "roomKit.largeArena.area.small", "map.rooms", "Large combat arena room kit is attached to a small room; waves may feel cramped.");
    }
  }
}

function validateDoorCollisionOpenings(map: LevelMapConfig, errors: ConfigValidationIssue[]) {
  const roomsById = new Map(map.rooms.map((room) => [room.id, room]));

  map.doors.forEach((door, index) => {
    const endpointIds = [...new Set([door.fromRoomId, door.toRoomId])];
    for (const roomId of endpointIds) {
      const room = roomsById.get(roomId);
      if (!room?.geometry?.collisionWalls) continue;
      if (doorCutsCollisionWall(room, door)) continue;
      add(
        errors,
        "door.geometry.opening.misaligned",
        `map.doors[${index}].position`,
        `Door "${door.id}" connects to collision-walled room "${room.id}" but is not close enough to a room boundary; generated walls may block the doorway.`,
      );
    }
  });
}

function doorCutsCollisionWall(room: LevelRoomDefinition, door: LevelDoorDefinition) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const [x, , z] = door.position;
  const minX = cx - sx / 2;
  const maxX = cx + sx / 2;
  const minZ = cz - sz / 2;
  const maxZ = cz + sz / 2;
  const edgePadding = 0.1;
  const boundaryTolerance = Math.max(0.8, door.size[2] + 0.55);
  const insideXSpan = x >= minX - edgePadding && x <= maxX + edgePadding;
  const insideZSpan = z >= minZ - edgePadding && z <= maxZ + edgePadding;
  const cutsNorthSouth = insideXSpan && (Math.abs(z - maxZ) <= boundaryTolerance || Math.abs(z - minZ) <= boundaryTolerance);
  const cutsEastWest = insideZSpan && (Math.abs(x - maxX) <= boundaryTolerance || Math.abs(x - minX) <= boundaryTolerance);
  return cutsNorthSouth || cutsEastWest;
}

function validateKeyItemSalience(item: LevelKeyItemDefinition, index: number, warnings: ConfigValidationIssue[]) {
  if (!item.dropFromArchetypeId || item.requiredForDoorIds.length === 0) return;
  const visual = mapVisualProfiles[item.visualKey];
  if (!visual) return;

  if (visual.primitive !== "key_card" || visual.scale < 1.6) {
    add(
      warnings,
      "key.visual.low_salience",
      `map.keyItems[${index}].visualKey`,
      `Dropped critical key "${item.id}" should use a large key-card visual so players can find it after combat.`,
    );
  }
  if (item.collectRadius < 2.4) {
    add(
      warnings,
      "key.collect.radius.small",
      `map.keyItems[${index}].collectRadius`,
      `Dropped critical key "${item.id}" has a small collect radius and may be missed during mobile play.`,
    );
  }
}

function validateReachability(level: LevelDefinition, map: LevelMapConfig, errors: ConfigValidationIssue[]) {
  const startRoomId = roomContaining(level.spawnPoint, map)?.id ?? map.navigation.criticalPathRoomIds[0] ?? map.rooms[0]?.id;
  const exitInteraction = map.interactions.find((interaction) => interaction.type === "exit");
  const exitRoomId = exitInteraction?.roomId ?? roomContaining(level.exit.position, map)?.id;
  if (!startRoomId || !exitRoomId) return;

  const reachable = reachableRooms(startRoomId, map.doors);
  if (!reachable.has(exitRoomId)) {
    add(errors, "map.exit.unreachable", "map.doors", `Exit room "${exitRoomId}" is not connected to spawn room "${startRoomId}".`);
  }
}

function validateKeyPlacement(level: LevelDefinition, map: LevelMapConfig, errors: ConfigValidationIssue[]) {
  const startRoomId = roomContaining(level.spawnPoint, map)?.id ?? map.navigation.criticalPathRoomIds[0] ?? map.rooms[0]?.id;
  if (!startRoomId) return;

  for (const door of map.doors) {
    if (door.lock.type !== "key_item" || !door.lock.keyItemId) continue;
    const key = map.keyItems.find((item) => item.id === door.lock.keyItemId);
    if (!key) continue;
    const reachableWithoutDoor = reachableRooms(startRoomId, map.doors.filter((candidate) => candidate.id !== door.id));
    if (!reachableWithoutDoor.has(key.roomId)) {
      add(errors, "key.behind.own.lock", `map.doors.${door.id}.lock.keyItemId`, `Key "${key.id}" appears to be behind its own locked door "${door.id}".`);
    }
  }
}

export function reachableRooms(startRoomId: string, doors: readonly LevelDoorDefinition[]) {
  const visited = new Set<string>([startRoomId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const door of doors) {
      if (visited.has(door.fromRoomId) && !visited.has(door.toRoomId)) {
        visited.add(door.toRoomId);
        changed = true;
      }
      if (visited.has(door.toRoomId) && !visited.has(door.fromRoomId)) {
        visited.add(door.fromRoomId);
        changed = true;
      }
    }
  }
  return visited;
}

export function roomContaining(position: Vec3Tuple, map: LevelMapConfig) {
  return map.rooms.find((room) => {
    const [cx, , cz] = room.bounds.center;
    const [sx, , sz] = room.bounds.size;
    return Math.abs(position[0] - cx) <= sx / 2 && Math.abs(position[2] - cz) <= sz / 2;
  }) ?? null;
}

function pointInsideAnyRoom(position: Vec3Tuple, map: LevelMapConfig) {
  return Boolean(roomContaining(position, map));
}

export function validateVisualKey(key: string | undefined, path: string, warnings: ConfigValidationIssue[]) {
  if (!key || knownMapVisualKeys.has(key)) return;
  add(warnings, "asset.visual.unknown", path, `Unknown visualKey "${key}" will use fallback geometry.`);
}

export function validateMaterialKey(key: string | undefined, path: string, warnings: ConfigValidationIssue[]) {
  if (!key || knownMapMaterialKeys.has(key)) return;
  add(warnings, "asset.material.unknown", path, `Unknown materialKey "${key}" will use fallback material.`);
}

function validateRoomSkinKey(key: string | undefined, path: string, warnings: ConfigValidationIssue[]) {
  if (!key || knownRoomSkinKeys.has(key)) return;
  add(warnings, "asset.roomSkin.unknown", path, `Unknown room skin "${key}" will use material/aesthetic fallback.`);
}

function validateDoorSkinKey(key: string | undefined, path: string, warnings: ConfigValidationIssue[]) {
  if (!key || knownDoorSkinKeys.has(key)) return;
  add(warnings, "asset.doorSkin.unknown", path, `Unknown door skin "${key}" will use visual/material fallback.`);
}

function validateKnownPresentationId(
  key: string | undefined,
  path: string,
  isKnown: (id: string) => boolean,
  kind: string,
  errors: ConfigValidationIssue[],
) {
  if (!key || isKnown(key)) return;
  add(errors, `roomKit.${kind}.unknown`, path, `Unknown ${kind} "${key}".`);
}

function validateKnownEnvironmentModelKey(key: string | undefined, path: string, errors: ConfigValidationIssue[]) {
  if (!key || isEnvironmentModelKey(key)) return;
  add(errors, "roomKit.model.unknown", path, `Unknown environment model "${key}".`);
}
