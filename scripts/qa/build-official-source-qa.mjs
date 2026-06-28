#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const requestedLevelId = args.level ?? null;
const parityMode = args.parity ?? "source-json";
const builderNativeOfficialLevelIds = new Set([
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
  "level_04_memory_clinic",
  "level_05_reclamation_core",
]);
const builderNativeDisallowedSourceKeys = [
  "mapPresentation",
  "mapInteractions",
  "spawnPoint",
  "initialInventory",
  "exit",
  "puzzles",
  "objectiveChain",
  "events",
  "environmentStates",
  "pickups",
  "requiresStoryPickupsBeforeWaves",
  "initialWaveStartDelay",
  "combatLimits",
  "presentation",
];

const server = await createServer({
  root: PKG_ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { officialBuilderDocumentFromBuiltInLevel } = await server.ssrLoadModule("/src/build/official-builder/officialBuilderDocuments.ts");
  const { compileOfficialBuilderDocument } = await server.ssrLoadModule("/src/build/official-builder/compileOfficialBuilderProjectToLevel.ts");
  const { humanProtocolBasePack } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { legacyLevel01MaintenanceBay } = await server.ssrLoadModule("/src/game/config/levels/level01-maintenance-bay/level.ts");
  const { legacyLevel02ResidentialSimulation } = await server.ssrLoadModule("/src/game/config/levels/level02-residential-simulation/level.ts");
  const { legacyLevel03HumanMuseum } = await server.ssrLoadModule("/src/game/config/levels/level03-human-museum/level.ts");
  const levelIds = requestedLevelId ? [requestedLevelId] : humanProtocolBasePack.campaignLevelIds.slice(0, 5);
  const legacyLevelsById = {
    level_01_maintenance_bay: legacyLevel01MaintenanceBay,
    level_02_residential_simulation: legacyLevel02ResidentialSimulation,
    level_03_human_museum: legacyLevel03HumanMuseum,
  };
  const results = levelIds.map((levelId) => {
    const document = officialBuilderDocumentFromBuiltInLevel(levelId);
    const runtimeLevel = humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId);
    const paritySourceLevel = parityMode === "legacy-ts" ? legacyLevelsById[levelId] ?? runtimeLevel : runtimeLevel;
    if (!document) {
      return {
        levelId,
        ok: false,
        error: `No official builder document for ${levelId}.`,
      };
    }
    const report = compileOfficialBuilderDocument(document);
    const contractDiffs = [
      ...builderNativeContractDiffs(levelId, document, report.level),
      ...level03HybridContractDiffs(levelId, document, report.level),
    ];
    const semanticDiffs =
      paritySourceLevel && report.level ? semanticDiffsFor(paritySourceLevel, report.level) : [`Missing ${parityMode} source or compiled level for ${levelId}.`];
    return {
      levelId,
      ok: report.ok && semanticDiffs.length === 0 && contractDiffs.length === 0,
      parityMode,
      paritySource: parityMode === "legacy-ts" ? "legacy-ts" : "runtime-level",
      schemaVersion: document.schemaVersion,
      profileId: document.contract.profileId,
      summary: report.summary,
      compileIssues: report.compileIssues,
      validationErrors: report.validationReport?.errors ?? [],
      bridgeErrors: report.bridgeAudit?.errors ?? [],
      contractDiffs,
      semanticDiffs,
    };
  });

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    console.error(`FAIL build-official source QA: ${failures.length}/${results.length} level(s) failed`);
    for (const failure of failures) {
      console.error(`  - ${failure.levelId}`);
      for (const issue of [...(failure.compileIssues ?? []), ...(failure.validationErrors ?? []), ...(failure.bridgeErrors ?? [])].slice(0, 8)) {
        console.error(`    ${issue.path ?? issue.code ?? "issue"}: ${issue.message}`);
      }
      for (const diff of (failure.contractDiffs ?? []).slice(0, 12)) {
        console.error(`    contract: ${diff}`);
      }
      for (const diff of (failure.semanticDiffs ?? []).slice(0, 12)) {
        console.error(`    semantic: ${diff}`);
      }
      if (failure.error) console.error(`    ${failure.error}`);
    }
    process.exit(1);
  }

  console.log(`PASS build-official source QA: ${results.length} level(s), parity=${parityMode}`);
  for (const result of results) {
    console.log(
      `  - ${result.levelId}: rooms=${result.summary.rooms}, doors=${result.summary.doors}, props=${result.summary.props}, profile=${result.profileId}, source=${result.paritySource}`,
    );
  }
} finally {
  await server.close();
}

function builderNativeContractDiffs(levelId, document, compiledLevel) {
  if (!builderNativeOfficialLevelIds.has(levelId)) return [];
  const diffs = [];
  const sourceLevel = document.project?.sourceLevel ?? {};
  for (const key of builderNativeDisallowedSourceKeys) {
    if (levelId === "level_03_human_museum" && key === "environmentStates") continue;
    if (Object.prototype.hasOwnProperty.call(sourceLevel, key)) {
      diffs.push(`builder-native ${levelId} sourceLevel must not carry legacy ${key}`);
    }
  }
  if (!compiledLevel) return diffs;
  if (levelId === "level_02_residential_simulation") {
    const colorPuzzle = document.project?.puzzles?.find((puzzle) => puzzle.id === "level_02_light_sequence");
    if (colorPuzzle?.sourcePuzzle) diffs.push("Level 2 color_sequence puzzle must not inherit sourcePuzzle");
    if (colorPuzzle?.sourceInteraction) diffs.push("Level 2 color_sequence puzzle must not inherit sourceInteraction");
    const lightDoor = compiledLevel.map?.doors?.find((door) => door.id === "level_02_light_room_door");
    if (lightDoor?.lock?.type !== "key_item") diffs.push("Level 2 light-room door must compile as key_item");
    if (lightDoor?.defaultState !== "locked") diffs.push("Level 2 light-room door must stay locked until key pickup");
  }
  if (levelId === "level_01_maintenance_bay") {
    const modelKeys = new Set((document.project?.props ?? []).map((prop) => prop.modelKey));
    for (const modelKey of ["hero_maintenance_repair_bay", "decal_human_reference_triptych"]) {
      if (!modelKeys.has(modelKey)) diffs.push(`Level 1 official builder JSON is missing ${modelKey}`);
    }
    const leader = compiledLevel.waves
      ?.find((wave) => wave.id === "elite_wave")
      ?.enemies.find((enemy) => enemy.tier === "leader");
    if (leader?.healthMultiplier !== 0.54) diffs.push("Level 1 maintenance leader healthMultiplier must be 0.54");
  }
  return diffs;
}

function level03HybridContractDiffs(levelId, document, compiledLevel) {
  if (levelId !== "level_03_human_museum") return [];
  const diffs = [];
  const project = document.project ?? {};
  const sourceLevel = project.sourceLevel ?? {};
  for (const key of ["dialogues", "cinematicBeats", "bossPhases", "enemyDeathBeats", "environmentStates", "economy", "revive"]) {
    if (!Object.prototype.hasOwnProperty.call(sourceLevel, key)) {
      diffs.push(`Level 3 builder-native official sourceLevel must keep museum ${key}`);
    }
  }

  const propIds = new Set((project.props ?? []).map((prop) => prop.id));
  const voiceCases = (project.props ?? []).filter((prop) => prop.modelKey === "room_museum_voice_archive_case");
  if (voiceCases.length !== 1 || voiceCases[0]?.id !== "level_03_voice_archive_case_asset") {
    diffs.push("Level 3 official builder JSON must carry exactly one voice archive case prop.");
  }
  if ((project.rooms ?? []).some((room) => /副本/u.test(room.label ?? ""))) {
    diffs.push("Level 3 official builder rooms must not expose duplicate-room labels.");
  }
  if ((project.doors ?? []).some((door) => /副本/u.test(door.label ?? "") || /副本/u.test(door.sourceDoor?.label ?? ""))) {
    diffs.push("Level 3 official builder doors must not expose duplicate-room labels.");
  }

  const toolPuzzle = (project.puzzles ?? []).find((puzzle) => puzzle.id === "level_03_tool_calibration");
  if (toolPuzzle?.sourceInteraction?.hostPropId !== "level_03_tool_last_human_tool_vitrine") {
    diffs.push("Level 3 tool calibration must use the museum vitrine as its puzzle interaction host");
  }
  if (toolPuzzle?.sourceInteraction?.hostPropId && !propIds.has(toolPuzzle.sourceInteraction.hostPropId)) {
    diffs.push(`Level 3 tool calibration host prop is missing: ${toolPuzzle.sourceInteraction.hostPropId}`);
  }

  const expectedOrbAnchors = {
    orb_red: "level_03_orb_red_pedestal",
    orb_blue: "level_03_orb_blue_pedestal",
    orb_yellow: "level_03_orb_yellow_pedestal",
    orb_green: "level_03_orb_green_pedestal",
    orb_purple: "level_03_orb_purple_pedestal",
  };
  const colorPuzzle = (project.puzzles ?? []).find((puzzle) => puzzle.id === "builder_color_lock");
  const colorComponents = new Map((colorPuzzle?.components ?? []).map((component) => [component.id, component]));
  for (const [componentId, anchorPropId] of Object.entries(expectedOrbAnchors)) {
    const component = colorComponents.get(componentId);
    const actorAnchor = component?.sourceActor?.anchorPropId;
    const targetAnchor = component?.sourceTarget?.anchorPropId;
    if (actorAnchor !== anchorPropId || targetAnchor !== anchorPropId) {
      diffs.push(`Level 3 ${componentId} must round-trip as a hosted puzzle actor on ${anchorPropId}`);
    }
    if (!propIds.has(anchorPropId)) diffs.push(`Level 3 ${componentId} anchor prop is missing: ${anchorPropId}`);
  }

  const boss = compiledLevel?.waves
    ?.flatMap((wave) => wave.enemies ?? [])
    .find((enemy) => enemy.archetype === "custodian_elite" || enemy.tier === "boss");
  if (boss?.visual?.modelKey !== "hp_enemy_shield_technician_horror") {
    diffs.push("Level 3 boss must compile to hp_enemy_shield_technician_horror");
  }
  return diffs;
}

function semanticDiffsFor(sourceLevel, compiledLevel) {
  const source = semanticSnapshot(sourceLevel);
  const compiled = semanticSnapshot(compiledLevel);
  const diffs = [];
  compareObject("", source, compiled, diffs);
  return diffs;
}

function semanticSnapshot(level) {
  const map = level.map ?? {};
  return stableClone({
    id: level.id,
    title: level.title,
    spawnPoint: level.spawnPoint,
    initialInventory: level.initialInventory,
    initialWaveStartDelay: level.initialWaveStartDelay,
    requiresStoryPickupsBeforeWaves: level.requiresStoryPickupsBeforeWaves,
    exit: level.exit,
    authoringMetadata: {
      builderEnvironment: level.authoringMetadata?.builderEnvironment ?? null,
    },
    map: {
      id: map.id,
      presentation: map.presentation,
      rooms: byId(map.rooms, roomSemantic),
      doors: byId(map.doors, doorSemantic),
      keyItems: byId(map.keyItems, keyItemSemantic),
      interactions: byId(map.interactions, interactionSemantic),
      pickups: byId(map.pickups, stableClone),
      props: byId(map.props, propSemantic),
      navigation: map.navigation,
    },
    puzzles: byId(level.puzzles, stableClone),
    articles: byId(level.articles, stableClone),
    switches: byId(level.switches, stableClone),
    bigScreens: byId(level.bigScreens, stableClone),
    objectiveChain: level.objectiveChain,
    waves: byId(level.waves, stableClone),
    events: byId(level.events, stableClone),
    dialogues: level.dialogues,
    spawnGroups: byId(level.spawnGroups, stableClone),
    cinematicBeats: level.cinematicBeats,
    pickups: level.pickups,
    economy: level.economy,
    revive: level.revive,
    combatLimits: level.combatLimits,
    environmentStates: level.environmentStates,
    bossPhases: level.bossPhases,
    enemyDeathBeats: level.enemyDeathBeats,
    presentation: level.presentation,
  });
}

function roomSemantic(room) {
  return stableClone({
    id: room.id,
    label: room.label,
    center: room.center,
    size: room.size,
    mood: room.mood,
    skinKey: room.skinKey,
    floorMaterialKey: room.floorMaterialKey,
    wallMaterialKey: room.wallMaterialKey,
    geometry: room.geometry,
    aesthetic: room.aesthetic,
    ambientPressure: room.ambientPressure,
    entryDialogueTrigger: room.entryDialogueTrigger,
    exitDialogueTrigger: room.exitDialogueTrigger,
  });
}

function doorSemantic(door) {
  return stableClone({
    id: door.id,
    fromRoomId: door.fromRoomId,
    toRoomId: door.toRoomId,
    position: door.position,
    size: door.size,
    yaw: door.yaw,
    label: door.label,
    defaultState: door.defaultState,
    lock: door.lock,
    skinKey: door.skinKey,
    visualKey: door.visualKey,
    materialKey: door.materialKey,
    panelPosition: door.panelPosition,
    openSpeed: door.openSpeed,
    autoOpenOnApproach: door.autoOpenOnApproach,
    openVisualPolicy: door.openVisualPolicy,
    closedDialogueTrigger: door.closedDialogueTrigger,
    openedDialogueTrigger: door.openedDialogueTrigger,
    cameraImpact: door.cameraImpact,
  });
}

function keyItemSemantic(item) {
  return stableClone({
    id: item.id,
    roomId: item.roomId,
    position: item.position,
    label: item.label,
    collectRadius: item.collectRadius,
    autoCollect: item.autoCollect,
    visualKey: item.visualKey,
    materialKey: item.materialKey,
    requiresObjectiveId: item.requiresObjectiveId,
    dropFromArchetypeId: item.dropFromArchetypeId,
    dialogueTrigger: item.dialogueTrigger,
    rewardPulse: item.rewardPulse,
    rewardPulseDuration: item.rewardPulseDuration,
    audio: item.audio,
  });
}

function interactionSemantic(interaction) {
  return stableClone({
    id: interaction.id,
    type: interaction.type,
    roomId: interaction.roomId,
    position: interaction.position,
    radius: interaction.radius,
    visualKey: interaction.visualKey,
    materialKey: interaction.materialKey,
    label: interaction.label,
    hostPropId: interaction.hostPropId,
    startsObjectiveId: interaction.startsObjectiveId,
    completesObjectiveId: interaction.completesObjectiveId,
    grantsKeyItemId: interaction.grantsKeyItemId,
    consumesKeyItemId: interaction.consumesKeyItemId,
    opensDoorId: interaction.opensDoorId,
    requiresObjectiveId: interaction.requiresObjectiveId,
    requiresSwitchState: interaction.requiresSwitchState,
    dialogueTrigger: interaction.dialogueTrigger,
    rewardPulse: interaction.rewardPulse,
    rewardPulseDuration: interaction.rewardPulseDuration,
    audio: interaction.audio,
  });
}

function propSemantic(prop) {
  return stableClone({
    id: prop.id,
    modelKey: prop.modelKey,
    roomId: prop.roomId,
    position: prop.position,
    rotation: prop.rotation,
    scale: prop.scale,
    collider: prop.collider,
    label: prop.label,
    tags: prop.tags,
    initiallyVisible: prop.initiallyVisible,
  });
}

function byId(values, mapper) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => mapper(value)).sort((left, right) => String(left.id ?? "").localeCompare(String(right.id ?? "")));
}

function compareObject(path, left, right, diffs) {
  if (JSON.stringify(left) === JSON.stringify(right)) return;
  if (!isRecord(left) || !isRecord(right)) {
    diffs.push(`${path || "root"} differs`);
    return;
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    const nextPath = path ? `${path}.${key}` : key;
    if (!(key in left)) {
      diffs.push(`${nextPath} missing from source`);
      continue;
    }
    if (!(key in right)) {
      diffs.push(`${nextPath} missing from compiled`);
      continue;
    }
    compareObject(nextPath, left[key], right[key], diffs);
    if (diffs.length >= 80) return;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stableClone(entry)]));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (value.startsWith("--level=")) parsed.level = value.slice("--level=".length);
    else if (value.startsWith("--parity=")) parsed.parity = value.slice("--parity=".length);
    else if (value === "--legacy-parity") parsed.parity = "legacy-ts";
  }
  return parsed;
}
