#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const repo = process.cwd();
const officialBuilderPath = "src/game/config/levels/level05-reclamation-core/level.official.builder.json";
const campaignBuilderPath = "data/ai/campaign/rb_l5.builder.json";
const campaignLevelPath = "data/ai/campaign/rb_l5.level.json";
const reportJsonPath = "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_official_placement.json";
const reportMdPath = "src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_official_placement.md";
const placementPrefix = "level_05_v3_furniture_";

const manifestPaths = [
  "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_hero.json",
  "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch02.json",
  "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch03.json",
  "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch04.json",
];

const placements = [
  {
    id: "level_05_v3_furniture_intake_identity_gate",
    modelKey: "room_l5_v3_intake_identity_gate",
    roomId: "level_05_core_entry",
    position: [0, 20.04],
    rotationY: Math.PI,
    scale: 1,
    elevation: 0,
    label: "入口身份门廊",
    role: "entry identity threshold",
  },
  {
    id: "level_05_v3_furniture_core_route_map_table",
    modelKey: "room_l5_v3_core_route_map_table",
    roomId: "level_05_lock_hub",
    position: [-2.45, 7.8],
    rotationY: 0.08,
    scale: 0.92,
    elevation: 0,
    label: "中庭路线桌",
    role: "hub planning table",
  },
  {
    id: "level_05_v3_furniture_crescent_low_sofa",
    modelKey: "room_l5_v3_crescent_low_sofa",
    roomId: "level_05_lock_hub",
    position: [-6.15, 10.6],
    rotationY: 2.72,
    scale: 0.9,
    elevation: 0,
    label: "中庭低沙发",
    role: "quiet lounge silhouette",
  },
  {
    id: "level_05_v3_furniture_anemone_lounge_chair",
    modelKey: "room_l5_v3_anemone_lounge_chair",
    roomId: "level_05_lock_hub",
    position: [4.95, 10.15],
    rotationY: -0.72,
    scale: 0.92,
    elevation: 0,
    label: "中庭海葵椅",
    role: "single readable lounge chair",
  },
  {
    id: "level_05_v3_furniture_three_lock_monolith",
    modelKey: "room_l5_v3_three_lock_monolith",
    roomId: "level_05_platform",
    position: [-5.95, -9.2],
    rotationY: Math.PI / 2,
    scale: 0.94,
    elevation: 0,
    label: "三锁碑",
    role: "critical-path lock sculpture",
  },
  {
    id: "level_05_v3_furniture_reclamation_core_altar",
    modelKey: "room_l5_v3_reclamation_core_altar",
    roomId: "level_05_platform",
    position: [0, -12.4],
    rotationY: 0,
    scale: 1,
    elevation: 0,
    label: "回收核心祭台",
    role: "hero focal point",
  },
  {
    id: "level_05_v3_furniture_release_key_vault",
    modelKey: "room_l5_v3_release_key_vault",
    roomId: "level_05_north_lock",
    position: [-3.55, -2.45],
    rotationY: Math.PI / 2,
    scale: 0.92,
    elevation: 0,
    label: "释放钥匙柜",
    role: "lock-room vault",
  },
  {
    id: "level_05_v3_furniture_service_side_console",
    modelKey: "room_l5_v3_service_side_console",
    roomId: "level_05_north_lock",
    position: [3.55, -2.65],
    rotationY: -Math.PI / 2,
    scale: 0.94,
    elevation: 0,
    label: "制动侧控台",
    role: "lock-room service console",
  },
  {
    id: "level_05_v3_furniture_bio_recline_couch",
    modelKey: "room_l5_v3_bio_recline_couch",
    roomId: "level_05_east_lock",
    position: [13.05, 10.55],
    rotationY: Math.PI,
    scale: 0.9,
    elevation: 0,
    label: "生物回收躺椅",
    role: "clinic body-position anchor",
  },
  {
    id: "level_05_v3_furniture_memory_diagnostic_terminal",
    modelKey: "room_l5_v3_memory_diagnostic_terminal",
    roomId: "level_05_east_lock",
    position: [16.15, 7.25],
    rotationY: -Math.PI / 2,
    scale: 0.92,
    elevation: 0,
    label: "记忆诊断终端",
    role: "clinic diagnostic wall station",
  },
  {
    id: "level_05_v3_furniture_tissue_freezer_cabinet",
    modelKey: "room_l5_v3_tissue_freezer_cabinet",
    roomId: "level_05_east_lock",
    position: [10.85, 4.75],
    rotationY: Math.PI / 2,
    scale: 0.9,
    elevation: 0,
    label: "组织冷柜",
    role: "clinic storage mass",
  },
  {
    id: "level_05_v3_furniture_surgical_light_stand",
    modelKey: "room_l5_v3_surgical_light_stand",
    roomId: "level_05_east_lock",
    position: [14.95, 9.45],
    rotationY: -0.62,
    scale: 0.82,
    elevation: 0,
    label: "手术灯架",
    role: "clinic vertical silhouette",
  },
  {
    id: "level_05_v3_furniture_corner_privacy_screen",
    modelKey: "room_l5_v3_corner_privacy_screen",
    roomId: "level_05_east_lock",
    position: [15.95, 10.58],
    rotationY: -2.35,
    scale: 0.86,
    elevation: 0,
    label: "角落隐私屏风",
    role: "clinic corner dressing",
  },
  {
    id: "level_05_v3_furniture_limb_calibration_rack",
    modelKey: "room_l5_v3_limb_calibration_rack",
    roomId: "level_05_west_lock",
    position: [-16.25, 6.35],
    rotationY: Math.PI / 2,
    scale: 0.9,
    elevation: 0,
    label: "肢体校准架",
    role: "reclamation machinery wall rack",
  },
  {
    id: "level_05_v3_furniture_cleaning_robot_dock",
    modelKey: "room_l5_v3_cleaning_robot_dock",
    roomId: "level_05_west_lock",
    position: [-13.2, 10.45],
    rotationY: Math.PI,
    scale: 0.9,
    elevation: 0,
    label: "清洁机器人泊位",
    role: "low maintenance dock",
  },
  {
    id: "level_05_v3_furniture_hanging_cable_organizer",
    modelKey: "room_l5_v3_hanging_cable_organizer",
    roomId: "level_05_west_lock",
    position: [-9.75, 10.45],
    rotationY: -Math.PI / 2,
    scale: 0.82,
    elevation: 1.25,
    label: "悬挂线缆整理架",
    role: "wall-mounted cable dressing",
    wallMount: true,
  },
  {
    id: "level_05_v3_furniture_human_archive_cabinet",
    modelKey: "room_l5_v3_human_archive_cabinet",
    roomId: "level_05_archive_room",
    position: [14.35, -12.3],
    rotationY: -Math.PI / 2,
    scale: 0.88,
    elevation: 0,
    label: "人类档案柜",
    role: "archive identity storage",
  },
  {
    id: "level_05_v3_furniture_curved_archive_shelf",
    modelKey: "room_l5_v3_curved_archive_shelf",
    roomId: "level_05_archive_room",
    position: [11.55, -15.05],
    rotationY: Math.PI,
    scale: 0.88,
    elevation: 0,
    label: "弧形档案架",
    role: "archive back-wall mass",
  },
  {
    id: "level_05_v3_furniture_specimen_drawer_stack",
    modelKey: "room_l5_v3_specimen_drawer_stack",
    roomId: "level_05_archive_room",
    position: [9.25, -14.45],
    rotationY: 2.38,
    scale: 0.86,
    elevation: 0,
    label: "样本抽屉组",
    role: "archive corner vertical stack",
  },
  {
    id: "level_05_v3_furniture_evidence_coffee_table",
    modelKey: "room_l5_v3_evidence_coffee_table",
    roomId: "level_05_archive_room",
    position: [11.15, -10.15],
    rotationY: -0.15,
    scale: 0.88,
    elevation: 0,
    label: "证据咖啡桌",
    role: "low evidence-reading table",
  },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repo, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(repo, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function roundNumber(value) {
  return Number.parseFloat(value.toFixed(4));
}

function normalizedProp(placement) {
  return {
    id: placement.id,
    modelKey: placement.modelKey,
    roomId: placement.roomId,
    position: placement.position.map(roundNumber),
    rotationY: roundNumber(placement.rotationY),
    scale: placement.scale,
    elevation: placement.elevation,
    sourceProp: {
      y: placement.elevation,
      scale: placement.scale,
      label: placement.label,
      tags: [
        "hp:level05_v3_furniture_image2",
        "source:image2",
        "license:owned-generated-output",
        "placement:art_directed",
        placement.wallMount ? "mount:wall" : "mount:floor",
      ],
    },
  };
}

function updateProject(project) {
  const existing = Array.isArray(project.props) ? project.props : [];
  project.props = [
    ...existing.filter((prop) => !String(prop.id ?? "").startsWith(placementPrefix)),
    ...placements.map(normalizedProp),
  ];
}

function loadFootprints() {
  const footprints = new Map();
  for (const manifestPath of manifestPaths) {
    const manifest = readJson(manifestPath);
    for (const asset of manifest.assets ?? []) {
      footprints.set(asset.modelKey, {
        label: asset.label,
        sizeMeters: asset.sizeMeters ?? asset.footprint ?? null,
        family: asset.family ?? null,
        solid: asset.solid ?? null,
        mount: asset.mount ?? null,
      });
    }
  }
  return footprints;
}

function roomBounds(room) {
  const [cx, cz] = room.center;
  const [sx, sz] = room.size;
  return {
    minX: cx - sx / 2,
    maxX: cx + sx / 2,
    minZ: cz - sz / 2,
    maxZ: cz + sz / 2,
  };
}

function clearanceFor(room, placement, footprint) {
  const bounds = roomBounds(room);
  const [x, z] = placement.position;
  const [w = 0, , d = 0] = footprint?.sizeMeters ?? [];
  const radiusX = (w * placement.scale) / 2;
  const radiusZ = (d * placement.scale) / 2;
  return {
    left: roundNumber(x - radiusX - bounds.minX),
    right: roundNumber(bounds.maxX - x - radiusX),
    back: roundNumber(z - radiusZ - bounds.minZ),
    front: roundNumber(bounds.maxZ - z - radiusZ),
  };
}

function surfaceAssessment(project) {
  const rooms = project.rooms.map((room) => ({
    roomId: room.id,
    floorPresetId: room.env?.floorPresetId ?? null,
    wallPresetId: room.env?.wallPresetId ?? null,
    ceilingPresetId: room.env?.ceilingPresetId ?? null,
    surfaceKitId: room.env?.surfaceKitId ?? null,
  }));
  return {
    currentStatus: [
      "Level 5 already has builder surface presets per room.",
      "Only the platform room has a known old runtime Image2 hero floor source; this is not a complete new v3 wall/floor/ceiling evidence chain.",
      "Several core rooms still use procedural floor_reclamation_core_metal / wall_reclamation_core_panel; many ceilings reuse the wall preset.",
    ],
    recommendedPath: "Make a dedicated Image2 L5 v3 surface pack first. Use CC0 only if exact source URLs, authors, license pages, local archives, and redistribution notes are recorded before import.",
    proposedImage2Presets: {
      floor: "floor_level05_reclamation_core_image2_v3",
      wall: "wall_level05_reclamation_core_image2_v3",
      ceiling: "ceiling_level05_reclamation_core_image2_v3",
    },
    rooms,
  };
}

const officialDocument = readJson(officialBuilderPath);
updateProject(officialDocument.project);
writeJson(officialBuilderPath, officialDocument);

const campaignProject = readJson(campaignBuilderPath);
updateProject(campaignProject);
writeJson(campaignBuilderPath, campaignProject);

const server = await createServer({
  root: repo,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

let campaignLevel = null;
let campaignCompileIssues = [];
try {
  const { compileBuilderProjectToLevel } = await server.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts");
  const compiled = compileBuilderProjectToLevel(campaignProject);
  campaignLevel = compiled.level;
  campaignCompileIssues = compiled.issues;
  if (!campaignLevel || campaignCompileIssues.length > 0) {
    throw new Error(`campaign Level 5 builder compile failed: ${JSON.stringify(campaignCompileIssues)}`);
  }
  writeJson(campaignLevelPath, campaignLevel);
} finally {
  await server.close();
}

const footprints = loadFootprints();
const roomsById = new Map(officialDocument.project.rooms.map((room) => [room.id, room]));
const placementReport = placements.map((placement) => {
  const room = roomsById.get(placement.roomId);
  const footprint = footprints.get(placement.modelKey);
  return {
    ...placement,
    rotationY: roundNumber(placement.rotationY),
    footprint: footprint ?? null,
    clearanceMeters: room ? clearanceFor(room, placement, footprint) : null,
    roomExists: Boolean(room),
  };
});

const report = {
  schema: "hp.level05.v3Furniture.officialPlacement.v1",
  generatedAt: "2026-06-27",
  sourceOfTruth: officialBuilderPath,
  syncedCampaignCopy: campaignBuilderPath,
  placementPrefix,
  summary: {
    placements: placementReport.length,
    roomsTouched: [...new Set(placementReport.map((entry) => entry.roomId))],
    officialPropCount: officialDocument.project.props.length,
    campaignPropCount: campaignProject.props.length,
    campaignLevelPropCount: campaignLevel?.map?.props?.length ?? null,
    campaignCompileIssues: campaignCompileIssues.length,
  },
  placementPrinciples: [
    "Hero/critical-path pieces sit in entry, hub, lock room, and platform.",
    "Medical furniture clusters in the east lock room.",
    "Archive/storage furniture clusters in the archive room and west lock room.",
    "Large props stay off door centers and primary north-south/east-west lanes.",
    "Wall-mounted cable organizer uses elevation 1.25m and non-floor placement intent.",
  ],
  placements: placementReport,
  surfaceAssessment: surfaceAssessment(officialDocument.project),
};

writeJson(reportJsonPath, report);

const byRoom = new Map();
for (const entry of placementReport) {
  if (!byRoom.has(entry.roomId)) byRoom.set(entry.roomId, []);
  byRoom.get(entry.roomId).push(entry);
}

const md = [
  "# Level 05 v3 Furniture Official Placement",
  "",
  "- Generated: `2026-06-27`",
  `- Source of truth: \`${officialBuilderPath}\``,
  `- Synced campaign copy: \`${campaignBuilderPath}\``,
  `- Synced campaign level: \`${campaignLevelPath}\``,
  `- Placements: \`${placementReport.length}\``,
  "",
  "## Room Layout",
  "",
  ...[...byRoom.entries()].flatMap(([roomId, entries]) => [
    `### ${roomId}`,
    "",
    "| prop | modelKey | position | rotationY | scale | role |",
    "|---|---|---:|---:|---:|---|",
    ...entries.map((entry) => `| ${entry.label} | \`${entry.modelKey}\` | [${entry.position.join(", ")}] | ${entry.rotationY} | ${entry.scale} | ${entry.role} |`),
    "",
  ]),
  "## Surface Assessment",
  "",
  "- Current Level 5 has builder surface presets, but not a complete new v3 Image2 surface pack for floor/wall/ceiling.",
  "- The platform has an older runtime Image2 hero-floor source; walls and ceilings are still mostly builder presets/procedural surface families.",
  "- Recommended next pass: Image2 first for a coherent L5 v3 shell; CC0 only after exact source/license archiving.",
  "",
];

fs.writeFileSync(path.join(repo, reportMdPath), `${md.join("\n")}\n`);

console.log(`Applied Level 05 v3 furniture placement: ${placementReport.length} props`);
console.log(`  official=${officialBuilderPath}`);
console.log(`  campaign=${campaignBuilderPath}`);
console.log(`  campaignLevel=${campaignLevelPath}`);
console.log(`  report=${reportJsonPath}`);
