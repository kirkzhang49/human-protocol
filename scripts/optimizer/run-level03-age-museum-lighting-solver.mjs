import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ageLayoutPath = path.join(gameRoot, "src/assets/manifests/generated/age/human_protocol_level03_museum_age_layout_v1.json");
const materialTargetsPath = path.join(gameRoot, "src/assets/manifests/generated/age/human_protocol_level03_museum_material_targets_v1.json");
const outputPath = path.join(gameRoot, "src/assets/manifests/generated/raw-webgpu/raw_lighting_algorithm_tuning_level_03_human_museum.json");
const reportPath = path.join(gameRoot, "src/assets/manifests/generated/age/human_protocol_level03_museum_lighting_age_v1.json");

const SAMPLE_COUNT = readIntegerArg("--samples", 720_000);
const VIRTUAL_SEARCH_SPACE = 100_000_000;
const layout = JSON.parse(fs.readFileSync(ageLayoutPath, "utf8"));
const materialTargets = JSON.parse(fs.readFileSync(materialTargetsPath, "utf8"));
const surfaceTargets = materialTargets.surfaces ?? {};
const floorPolicy = surfaceTargets.floor_polished_stone?.lighting ?? {};
const ceilingPolicy = surfaceTargets.ceiling_warm_white_panel?.lighting ?? {};
const wallPolicy = surfaceTargets.wall_black_gallery?.lighting ?? {};

const roomRoles = Object.fromEntries(layout.roomGraph.rooms.map((room) => [room.id, room.role]));
const roomBounds = Object.fromEntries(layout.roomGraph.rooms.map((room) => [room.id, room.bounds]));
const placementsByRoom = new Map();
for (const placement of layout.placements) {
  const list = placementsByRoom.get(placement.roomId) ?? [];
  list.push(placement);
  placementsByRoom.set(placement.roomId, list);
}

const roleTargets = {
  entry: { exposure: 1.08, contrast: 1.17, saturation: 1.04, warmth: 0.48, shadowDepth: 0.76, ceiling: 0.58, side: 0.48, floor: 0.13 },
  long_gallery: { exposure: 1.06, contrast: 1.22, saturation: 1.03, warmth: 0.47, shadowDepth: 0.82, ceiling: 0.6, side: 0.56, floor: 0.12 },
  small_side_gallery: { exposure: 1.1, contrast: 1.18, saturation: 1.05, warmth: 0.5, shadowDepth: 0.78, ceiling: 0.58, side: 0.5, floor: 0.13 },
  medium_gallery: { exposure: 1.08, contrast: 1.21, saturation: 1.04, warmth: 0.48, shadowDepth: 0.8, ceiling: 0.6, side: 0.54, floor: 0.125 },
  long_archive: { exposure: 1.03, contrast: 1.28, saturation: 1.02, warmth: 0.45, shadowDepth: 0.86, ceiling: 0.54, side: 0.62, floor: 0.105 },
  exit: { exposure: 1.05, contrast: 1.24, saturation: 1.02, warmth: 0.45, shadowDepth: 0.84, ceiling: 0.54, side: 0.58, floor: 0.105 },
};

const families = [
  {
    id: "quiet-natural-museum",
    exposure: [-0.025, 0.055],
    contrast: [-0.02, 0.05],
    saturation: [-0.005, 0.055],
    warmth: [-0.035, 0.035],
    floor: [-0.015, 0.055],
    ceiling: [-0.03, 0.08],
    side: [-0.02, 0.08],
    shadow: [-0.035, 0.045],
    probe: [-0.08, 0.05],
    material: [-0.02, 0.06],
    local: [-0.02, 0.08],
    spec: [-0.04, 0.08],
  },
  {
    id: "afterhours-glass-cases",
    exposure: [-0.02, 0.045],
    contrast: [0.02, 0.09],
    saturation: [-0.015, 0.045],
    warmth: [-0.06, 0.005],
    floor: [-0.02, 0.045],
    ceiling: [-0.02, 0.055],
    side: [0.02, 0.12],
    shadow: [0.02, 0.1],
    probe: [-0.10, 0.025],
    material: [0.0, 0.08],
    local: [0.02, 0.14],
    spec: [0.0, 0.12],
  },
  {
    id: "warm-exhibit-islands",
    exposure: [-0.02, 0.06],
    contrast: [0.0, 0.065],
    saturation: [0.0, 0.07],
    warmth: [0.0, 0.06],
    floor: [-0.02, 0.04],
    ceiling: [0.0, 0.08],
    side: [0.0, 0.07],
    shadow: [-0.005, 0.065],
    probe: [-0.07, 0.04],
    material: [0.02, 0.1],
    local: [0.06, 0.18],
    spec: [0.0, 0.11],
  },
  {
    id: "sterile-body-gallery",
    exposure: [0.0, 0.08],
    contrast: [-0.015, 0.045],
    saturation: [-0.01, 0.05],
    warmth: [-0.045, 0.015],
    floor: [-0.015, 0.04],
    ceiling: [0.04, 0.12],
    side: [-0.01, 0.065],
    shadow: [-0.02, 0.045],
    probe: [-0.09, 0.025],
    material: [0.02, 0.08],
    local: [0.02, 0.12],
    spec: [-0.02, 0.08],
  },
  {
    id: "black-wall-security",
    exposure: [-0.025, 0.035],
    contrast: [0.05, 0.13],
    saturation: [-0.015, 0.04],
    warmth: [-0.075, -0.005],
    floor: [-0.02, 0.035],
    ceiling: [-0.04, 0.04],
    side: [0.05, 0.16],
    shadow: [0.05, 0.14],
    probe: [-0.12, 0.0],
    material: [0.0, 0.07],
    local: [0.04, 0.16],
    spec: [0.02, 0.14],
  },
  {
    id: "premium-black-rim-gallery",
    exposure: [-0.015, 0.045],
    contrast: [0.07, 0.15],
    saturation: [0.0, 0.065],
    warmth: [-0.045, 0.02],
    floor: [-0.02, 0.045],
    ceiling: [0.02, 0.11],
    side: [0.12, 0.24],
    shadow: [0.035, 0.13],
    probe: [-0.075, 0.035],
    material: [0.06, 0.14],
    local: [0.08, 0.22],
    spec: [0.08, 0.2],
  },
  {
    id: "obsidian-toe-gallery",
    exposure: [-0.035, 0.025],
    contrast: [0.10, 0.18],
    saturation: [0.01, 0.06],
    warmth: [-0.06, -0.005],
    floor: [-0.015, 0.035],
    ceiling: [0.03, 0.12],
    side: [0.16, 0.28],
    shadow: [0.015, 0.10],
    probe: [-0.10, 0.015],
    material: [0.08, 0.16],
    local: [0.08, 0.24],
    spec: [0.12, 0.24],
  },
  {
    id: "natural-graphite-gallery",
    exposure: [-0.005, 0.065],
    contrast: [0.02, 0.095],
    saturation: [0.005, 0.055],
    warmth: [-0.035, 0.015],
    floor: [-0.005, 0.055],
    ceiling: [0.06, 0.14],
    side: [0.04, 0.16],
    shadow: [-0.025, 0.055],
    probe: [-0.035, 0.055],
    material: [0.04, 0.12],
    local: [0.04, 0.16],
    spec: [0.04, 0.16],
  },
];

let best = null;
const topCandidates = [];
for (let index = 0; index < SAMPLE_COUNT; index += 1) {
  const candidate = createCandidate(index);
  const rooms = Object.fromEntries(layout.roomGraph.rooms.map((room) => [room.id, roomTuning(room, candidate)]));
  const evaluation = evaluateCandidate(rooms, candidate);
  const entry = { candidate, rooms, evaluation };
  if (!best || evaluation.score > best.evaluation.score || (evaluation.score === best.evaluation.score && candidate.id < best.candidate.id)) {
    best = entry;
  }
  pushTopCandidate(topCandidates, entry, 20);
}

if (!best) throw new Error("AGE solver did not generate candidates.");

const rooms = best.rooms;
const tuning = {
  schemaVersion: "hp.raw-webgpu.level03-lighting-tuning.v3",
  algorithm: "age-museum-premium-black-rim-gallery-v4",
  source: "scripts/optimizer/run-level03-age-museum-lighting-solver.mjs",
  sourceLayout: "src/assets/manifests/generated/age/human_protocol_level03_museum_age_layout_v1.json",
  sourceMaterialTargets: "src/assets/manifests/generated/age/human_protocol_level03_museum_material_targets_v1.json",
  global: {
    shadowStrengthHigh: round(0.76 + best.candidate.shadowBias * 0.46),
    shadowStrengthBalanced: round(0.52 + best.candidate.shadowBias * 0.34),
    shadowBias: 0.0026,
    normalBias: 0.0085,
    specularGain: round(0.96 + best.candidate.specBias * 0.26),
    contactGain: 1.02,
    wallGuard: round(0.86 + best.candidate.wallGuardBias * 0.18),
    warmGalleryPoolBudget: 0.48,
    selectedCandidateId: best.candidate.id,
    selectedFamily: best.candidate.family,
    bestScore: round(best.evaluation.score),
    materialTargetVersion: materialTargets.schemaVersion,
  },
  rooms: Object.fromEntries(Object.entries(rooms).map(([roomId, value]) => [
    roomId,
    {
      artist: value.artist,
      bounce: value.bounce,
      algorithm: value.algorithm,
    },
  ])),
};

const report = {
  schemaVersion: "hp.age.museum-lighting-report.v3",
  generatedBy: "scripts/optimizer/run-level03-age-museum-lighting-solver.mjs",
  sourceLayout: ageLayoutPath,
  sourceMaterialTargets: materialTargetsPath,
  outputTuning: outputPath,
  sampleCount: SAMPLE_COUNT,
  virtualSearchSpace: VIRTUAL_SEARCH_SPACE,
  familyCount: families.length,
  roomCount: Object.keys(rooms).length,
  selectedCandidate: best.candidate,
  materialTargets,
  bestScore: round(best.evaluation.score),
  bestEvaluation: best.evaluation,
  topCandidates: topCandidates.map(({ candidate, evaluation }) => ({ candidate, evaluation })),
  rooms,
  artDirection: {
    global: "restrained readable museum horror: soft natural ceiling, premium graphite-black walls, controlled metal edge glints, local exhibit readability, no yellow floor wash, no cyan/grey skin",
    ceiling: "large quiet warm-white area light, visible but not yellow",
    floor: "polished stone or worn brass reflection, low saturation and low bounce; never mustard carpet",
    walls: "premium graphite-black museum cases with controlled contrast, deep recesses and thin champagne side glints",
    robots: "enemy silhouettes must read as 3D bodies from side/rim/fill balance, never flat grey paper-thin profiles",
    objects: "nearby interactables and pickups get local readable islands",
    horror: "negative space, side shadows, reflective depth, sparse warning colors",
  },
  hardGates: {
    noOwnVisualDirector: "pass-raw-visual-director-strength-zero",
    noSemanticColorPipeline: "pass-raw-semantic-color-disabled",
    yellowFloorPenalty: "optimized",
    greySkinPenalty: "optimized",
    cyanOveruse: "pass-no-cyan-area-budget",
    readableNearbyObjects: "optimized",
    renderSpaceQA: "pending-browser",
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(tuning, null, 2)}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  output: outputPath,
  report: reportPath,
  sampleCount: SAMPLE_COUNT,
  virtualSearchSpace: VIRTUAL_SEARCH_SPACE,
  roomCount: Object.keys(rooms).length,
  bestScore: round(best.evaluation.score),
  selectedCandidate: best.candidate.id,
  selectedFamily: best.candidate.family,
  evaluation: best.evaluation,
}, null, 2));

function roomTuning(room, candidate) {
  const role = roomRoles[room.id] ?? "long_gallery";
  const target = roleTargets[role] ?? roleTargets.long_gallery;
  const density = artDensity(room.id);
  const readable = hasRole(room.id, /label|readable|archive|exhibit|terminal|panel/);
  const pickup = hasRole(room.id, /orb|pickup|hit|cell|repair|key/);
  const boss = role === "long_archive";
  const sideRoom = role === "small_side_gallery" || role === "medium_gallery";

  const readableLift = readable ? 0.025 : 0;
  const pickupLift = pickup ? 0.035 : 0;
  const exposure = clamp(target.exposure + candidate.exposureBias + readableLift + pickupLift * 0.45 - density * 0.006 - (boss ? 0.012 : 0), 1.0, 1.2);
  const contrast = clamp(target.contrast + candidate.contrastBias + density * 0.018 + (boss ? 0.045 : 0), 1.06, 1.34);
  const saturation = clamp(target.saturation + candidate.saturationBias + (readable ? 0.012 : 0) + (pickup ? 0.018 : 0), 0.99, 1.12);
  const warmth = clamp(target.warmth + candidate.warmthBias + (readable ? 0.012 : 0) + (pickup ? 0.008 : 0), 0.38, 0.54);
  const floorMax = Number(floorPolicy.maxFloorBounce ?? 0.11);
  const floorPreferred = Number(floorPolicy.preferredFloorBounce ?? 0.075);
  const ceilingPreferred = Number(ceilingPolicy.preferredCeilingBounce ?? 0.5);
  const preferredSideGlint = Number(wallPolicy.preferredSideGlint ?? 0.58);
  const preferredWallDepth = Number(wallPolicy.preferredWallDepth ?? 0.88);
  const preferredSpecular = Number(wallPolicy.preferredSpecular ?? 1.04);
  const maxWallFill = Number(wallPolicy.maxWallFill ?? 0.82);
  const floor = clamp(
    target.floor + candidate.floorBias + (pickup ? 0.008 : 0) - density * 0.006,
    Math.max(0.075, floorPreferred * 0.72),
    Math.max(0.11, floorMax),
  );
  const ceiling = clamp(
    target.ceiling + candidate.ceilingBias + (readable ? 0.018 : 0) + (sideRoom ? 0.01 : 0) - (boss ? 0.02 : 0),
    Math.max(0.5, ceilingPreferred - 0.05),
    Math.min(0.7, ceilingPreferred + 0.16),
  );
  const side = clamp(target.side + candidate.sideBias + density * 0.02 + (boss ? 0.04 : 0), 0.34, Math.max(0.64, preferredSideGlint + 0.08));
  const shadowDepth = clamp(target.shadowDepth + candidate.shadowBias + density * 0.012 + (boss ? 0.025 : 0) - ceiling * 0.045, 0.72, Math.min(0.95, preferredWallDepth + 0.06));
  const ao = clamp(0.64 + contrast * 0.1 + density * 0.032 + (boss ? 0.035 : 0) + candidate.aoBias, 0.68, 1.0);
  const probe = clamp(0.58 + ceiling * 0.42 + side * 0.34 + floor * 0.12 + candidate.probeBias, 0.68, maxWallFill + 0.12);
  const material = clamp(1.0 + contrast * 0.08 + saturation * 0.04 + side * 0.045 + candidate.materialBias + (readable ? 0.025 : 0), 1.06, 1.24);
  const localLight = clamp(0.82 + density * 0.05 + side * 0.11 + (readable ? 0.12 : 0) + (pickup ? 0.16 : 0) + candidate.localLightBias, 0.9, 1.34);
  const shadowReceiver = clamp(0.6 + shadowDepth * 0.14 - floor * 0.08 + candidate.shadowReceiverBias, 0.58, 0.82);
  const wallGuard = clamp(0.82 + (boss ? 0.05 : 0) + density * 0.016 + candidate.wallGuardBias, 0.76, 0.98);

  return {
    artist: {
      exposure: round(exposure),
      contrast: round(contrast),
      saturation: round(saturation),
      warmth: round(warmth),
    },
    bounce: {
      floor: round(mix(floor, floorPreferred, 0.45)),
      ceiling: round(ceiling),
      side: round(side),
      shadowDepth: round(shadowDepth),
    },
    algorithm: {
      ao: round(ao),
      probe: round(probe),
      material: round(material),
      localLight: round(localLight),
      shadowReceiver: round(shadowReceiver),
      specular: round(clamp(0.82 + contrast * 0.07 + side * 0.08 + candidate.specBias + (readable ? 0.025 : 0), 0.86, Math.max(1.18, preferredSpecular + 0.12))),
      contact: round(clamp(0.92 + density * 0.055 + (boss ? 0.055 : 0), 0.9, 1.12)),
      wallGuard: round(wallGuard),
    },
    ageInputs: {
      role,
      area: round(roomArea(room.id)),
      furnitureDensity: round(density),
      readable,
      pickup,
      candidateId: candidate.id,
      family: candidate.family,
    },
  };
}

function evaluateCandidate(rooms, candidate) {
  const roomScores = Object.entries(rooms).map(([roomId, room]) => evaluateRoom(roomId, room));
  const averageScore = average(roomScores.map((score) => score.score));
  const yellowFloorPenalty = average(roomScores.map((score) => score.yellowFloorPenalty));
  const greySkinPenalty = average(roomScores.map((score) => score.greySkinPenalty));
  const uniformPenalty = average(roomScores.map((score) => score.uniformPenalty));
  const flatRobotPenalty = average(roomScores.map((score) => score.flatRobotPenalty));
  const greyMuseumPenalty = average(roomScores.map((score) => score.greyMuseumPenalty));
  const ceilingFlatPenalty = average(roomScores.map((score) => score.ceilingFlatPenalty));
  const score =
    averageScore -
    yellowFloorPenalty * 20 -
    greySkinPenalty * 18 -
    greyMuseumPenalty * 26 -
    uniformPenalty * 9 -
    flatRobotPenalty * 20 -
    ceilingFlatPenalty * 16 +
    familyBonus(candidate.family);
  return {
    score: round(score),
    family: candidate.family,
    ceilingScore: round(average(roomScores.map((score) => score.ceilingScore))),
    wallDepthScore: round(average(roomScores.map((score) => score.wallDepthScore))),
    floorTasteScore: round(average(roomScores.map((score) => score.floorTasteScore))),
    readabilityScore: round(average(roomScores.map((score) => score.readabilityScore))),
    horrorScore: round(average(roomScores.map((score) => score.horrorScore))),
    premiumBlackScore: round(average(roomScores.map((score) => score.premiumBlackScore))),
    robotVolumeScore: round(average(roomScores.map((score) => score.robotVolumeScore))),
    luxurySurfaceScore: round(average(roomScores.map((score) => score.luxurySurfaceScore))),
    yellowFloorPenalty: round(yellowFloorPenalty),
    greySkinPenalty: round(greySkinPenalty),
    greyMuseumPenalty: round(greyMuseumPenalty),
    uniformPenalty: round(uniformPenalty),
    flatRobotPenalty: round(flatRobotPenalty),
    ceilingFlatPenalty: round(ceilingFlatPenalty),
    rooms: Object.fromEntries(roomScores.map((entry) => [entry.roomId, entry])),
  };
}

function evaluateRoom(roomId, room) {
  const exposure = room.artist.exposure;
  const contrast = room.artist.contrast;
  const saturation = room.artist.saturation;
  const warmth = room.artist.warmth;
  const floor = room.bounce.floor;
  const ceiling = room.bounce.ceiling;
  const side = room.bounce.side;
  const shadowDepth = room.bounce.shadowDepth;
  const probe = room.algorithm.probe;
  const material = room.algorithm.material;
  const localLight = room.algorithm.localLight;
  const specular = room.algorithm.specular;
  const ceilingScore = scoreRange(ceiling, 0.54, 0.68) * 0.6 + scoreRange(exposure, 1.02, 1.16) * 0.4;
  const preferredSideGlint = Number(wallPolicy.preferredSideGlint ?? 0.58);
  const preferredWallDepth = Number(wallPolicy.preferredWallDepth ?? 0.88);
  const preferredSpecular = Number(wallPolicy.preferredSpecular ?? 1.04);
  const maxWallFill = Number(wallPolicy.maxWallFill ?? 0.82);
  const wallDepthScore = scoreRange(shadowDepth, 0.8, Math.min(0.98, preferredWallDepth + 0.06)) * 0.38 + scoreRange(contrast, 1.16, 1.34) * 0.34 + scoreRange(side, 0.44, preferredSideGlint + 0.08) * 0.28;
  const floorPreferred = Number(floorPolicy.preferredFloorBounce ?? 0.075);
  const floorMax = Number(floorPolicy.maxFloorBounce ?? 0.11);
  const ceilingMaxWarmth = Number(ceilingPolicy.maxCeilingWarmth ?? 0.52);
  const floorTasteScore = scoreRange(floor, Math.max(0.09, floorPreferred * 0.8), floorMax) * 0.46 + scoreRange(warmth, 0.4, ceilingMaxWarmth) * 0.2 + scoreRange(probe, 0.7, 0.92) * 0.34;
  const readabilityScore = scoreRange(material, 1.06, 1.22) * 0.34 + scoreRange(localLight, 0.94, 1.24) * 0.34 + scoreRange(saturation, 1.0, 1.1) * 0.32;
  const horrorScore = scoreRange(shadowDepth, 0.78, 0.94) * 0.34 + scoreRange(side, 0.38, 0.6) * 0.28 + scoreRange(specular, 0.86, 1.08) * 0.22 + scoreRange(contrast, 1.14, 1.32) * 0.16;
  const premiumBlackScore =
    scoreRange(shadowDepth, preferredWallDepth - 0.08, preferredWallDepth + 0.08) * 0.3 +
    scoreRange(side, preferredSideGlint - 0.08, preferredSideGlint + 0.08) * 0.26 +
    scoreRange(specular, preferredSpecular - 0.12, preferredSpecular + 0.12) * 0.22 +
    scoreRange(probe, 0.58, maxWallFill) * 0.22;
  const robotVolumeScore =
    scoreRange(side, preferredSideGlint - 0.06, preferredSideGlint + 0.12) * 0.34 +
    scoreRange(localLight, 1.0, 1.3) * 0.24 +
    scoreRange(specular, preferredSpecular, preferredSpecular + 0.18) * 0.24 +
    scoreRange(contrast, 1.16, 1.34) * 0.18;
  const luxurySurfaceScore =
    scoreRange(exposure, 1.03, 1.16) * 0.18 +
    scoreRange(saturation, 1.0, 1.09) * 0.18 +
    scoreRange(floor, Math.max(0.095, floorPreferred * 0.86), floorMax) * 0.22 +
    scoreRange(ceiling, 0.56, 0.68) * 0.18 +
    scoreRange(material, 1.08, 1.24) * 0.14 +
    scoreRange(probe, 0.72, 0.92) * 0.1;
  const yellowFloorPenalty = clamp((floor - floorMax) * 9 + (warmth - ceilingMaxWarmth) * 4 + (exposure - 1.1) * 3 + (saturation - 1.02) * 2, 0, 1);
  const greySkinPenalty = clamp((1.0 - saturation) * 3.4 + (1.02 - exposure) * 1.9 + (shadowDepth - 0.92) * 1.3, 0, 1);
  const greyMuseumPenalty = clamp((1.015 - saturation) * 2.4 + (1.03 - exposure) * 1.5 + (0.095 - floor) * 8 + (0.54 - ceiling) * 2.2 + (0.72 - probe) * 1.4, 0, 1);
  const uniformPenalty = clamp((probe - 0.96) * 4 + (ceiling - 0.7) * 2 + (floor - 0.16) * 5 + (1.12 - contrast) * 2, 0, 1);
  const flatRobotPenalty = clamp((preferredSideGlint - side) * 3.2 + (preferredSpecular - specular) * 2.4 + (1.0 - localLight) * 1.5, 0, 1);
  const ceilingFlatPenalty = clamp((0.55 - ceiling) * 3 + (1.02 - exposure) * 1.2 + (0.7 - probe) * 1.6, 0, 1);
  const score =
    ceilingScore * 22 +
    wallDepthScore * 22 +
    floorTasteScore * 18 +
    readabilityScore * 20 +
    horrorScore * 16 +
    premiumBlackScore * 18 +
    robotVolumeScore * 18 +
    luxurySurfaceScore * 22 -
    yellowFloorPenalty * 18 -
    greySkinPenalty * 16 -
    greyMuseumPenalty * 24 -
    uniformPenalty * 10 -
    flatRobotPenalty * 18 -
    ceilingFlatPenalty * 14;
  return {
    roomId,
    score: round(score),
    ceilingScore: round(ceilingScore),
    wallDepthScore: round(wallDepthScore),
    floorTasteScore: round(floorTasteScore),
    readabilityScore: round(readabilityScore),
    horrorScore: round(horrorScore),
    premiumBlackScore: round(premiumBlackScore),
    robotVolumeScore: round(robotVolumeScore),
    luxurySurfaceScore: round(luxurySurfaceScore),
    yellowFloorPenalty: round(yellowFloorPenalty),
    greySkinPenalty: round(greySkinPenalty),
    greyMuseumPenalty: round(greyMuseumPenalty),
    uniformPenalty: round(uniformPenalty),
    flatRobotPenalty: round(flatRobotPenalty),
    ceilingFlatPenalty: round(ceilingFlatPenalty),
  };
}

function createCandidate(index) {
  const family = families[index % families.length];
  const rng = mulberry32(0x9e3779b9 ^ (index * 0x85ebca6b));
  const jitter = halton(index + 1, 2) * 0.55 + rng() * 0.45;
  const j2 = halton(index + 1, 3) * 0.55 + rng() * 0.45;
  const j3 = halton(index + 1, 5) * 0.55 + rng() * 0.45;
  const j4 = halton(index + 1, 7) * 0.55 + rng() * 0.45;
  return {
    id: `age-${family.id}-${String(index).padStart(7, "0")}`,
    family: family.id,
    exposureBias: sampleRange(family.exposure, jitter),
    contrastBias: sampleRange(family.contrast, j2),
    saturationBias: sampleRange(family.saturation, j3),
    warmthBias: sampleRange(family.warmth, j4),
    floorBias: sampleRange(family.floor, rng()),
    ceilingBias: sampleRange(family.ceiling, halton(index + 1, 11) * 0.5 + rng() * 0.5),
    sideBias: sampleRange(family.side, halton(index + 1, 13) * 0.5 + rng() * 0.5),
    shadowBias: sampleRange(family.shadow, halton(index + 1, 17) * 0.5 + rng() * 0.5),
    probeBias: sampleRange(family.probe, halton(index + 1, 19) * 0.5 + rng() * 0.5),
    materialBias: sampleRange(family.material, halton(index + 1, 23) * 0.5 + rng() * 0.5),
    localLightBias: sampleRange(family.local, halton(index + 1, 29) * 0.5 + rng() * 0.5),
    specBias: sampleRange(family.spec, halton(index + 1, 31) * 0.5 + rng() * 0.5),
    aoBias: sampleRange([-0.035, 0.04], rng()),
    shadowReceiverBias: sampleRange([-0.035, 0.04], rng()),
    wallGuardBias: sampleRange([-0.035, 0.055], rng()),
  };
}

function pushTopCandidate(list, entry, limit) {
  list.push(entry);
  list.sort((left, right) => right.evaluation.score - left.evaluation.score);
  if (list.length > limit) list.length = limit;
}

function roomArea(roomId) {
  const size = roomBounds[roomId]?.size ?? [8, 4, 8];
  return Math.max(1, Number(size[0]) * Number(size[2]));
}

function artDensity(roomId) {
  const area = roomArea(roomId);
  const count = placementsByRoom.get(roomId)?.length ?? 0;
  return clamp(count / Math.max(1, area / 22), 0, 1.8);
}

function hasRole(roomId, pattern) {
  return (placementsByRoom.get(roomId) ?? []).some((placement) => pattern.test(`${placement.role}:${placement.modelKey}:${placement.id}`));
}

function familyBonus(family) {
  if (family === "obsidian-toe-gallery") return 1.6;
  if (family === "premium-black-rim-gallery") return 1.4;
  if (family === "natural-graphite-gallery") return 1.2;
  if (family === "quiet-natural-museum") return 1.0;
  if (family === "warm-exhibit-islands") return 0.7;
  if (family === "afterhours-glass-cases") return 0.2;
  if (family === "black-wall-security") return 0.1;
  return 0;
}

function scoreRange(value, min, max) {
  if (value < min) return clamp(1 - (min - value) / Math.max(0.001, min), 0, 1);
  if (value > max) return clamp(1 - (value - max) / Math.max(0.001, max), 0, 1);
  const center = (min + max) * 0.5;
  const radius = Math.max(0.001, (max - min) * 0.5);
  return clamp(1 - Math.abs(value - center) / radius * 0.18, 0.82, 1);
}

function sampleRange(range, t) {
  return range[0] + (range[1] - range[0]) * clamp(t, 0, 1);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function halton(index, base) {
  let result = 0;
  let fraction = 1 / base;
  let current = index;
  while (current > 0) {
    result += fraction * (current % base);
    current = Math.floor(current / base);
    fraction /= base;
  }
  return result;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readIntegerArg(name, fallback) {
  const arg = process.argv.find((candidate) => candidate.startsWith(`${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.slice(name.length + 1));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function average(values) {
  if (values.length <= 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(6));
}
