#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const repo = process.cwd();
const officialBuilderPath = "src/game/config/levels/level05-reclamation-core/level.official.builder.json";
const campaignBuilderPath = "data/ai/campaign/rb_l5.builder.json";
const campaignLevelPath = "data/ai/campaign/rb_l5.level.json";
const manifestPath = "src/assets/manifests/builder/hp_level05_reclamation_dressing_v4.json";
const reportJsonPath = "src/assets/manifests/reports/level05_reclamation_dressing_v4_official_placement.json";
const reportMdPath = "src/assets/manifests/reports/level05_reclamation_dressing_v4_official_placement.md";

const placementPrefix = "level_05_v4_dressing_";
const v4SurfaceKitId = "hp:reclamation_core_shell_v4_cc0";
const v4SurfacePresets = {
  floor: "floor_level05_reclamation_cc0_metal_panel_v4",
  wall: "wall_level05_reclamation_cc0_graphite_panel_v4",
  ceiling: "ceiling_level05_reclamation_cc0_service_grid_v4",
};

const placements = [
  {
    id: "level_05_v4_dressing_entry_ceiling_service_lamp",
    modelKey: "room_l5_v4_ceiling_service_lamp",
    roomId: "level_05_core_entry",
    position: [0, 17.25],
    rotationY: 0,
    scale: 1,
    elevation: 3.2,
    label: "入口顶部服务灯",
    role: "entry ceiling production light",
    mount: "ceiling",
  },
  {
    id: "level_05_v4_dressing_entry_wall_pipe_manifold",
    modelKey: "room_l5_v4_wall_pipe_manifold",
    roomId: "level_05_core_entry",
    position: [-4.62, 16.25],
    rotationY: Math.PI / 2,
    scale: 0.88,
    elevation: 1.22,
    label: "入口壁挂管汇",
    role: "left wall technical dressing",
    mount: "wall",
  },
  {
    id: "level_05_v4_dressing_hub_ceiling_cable_tray",
    modelKey: "room_l5_v4_ceiling_cable_tray",
    roomId: "level_05_lock_hub",
    position: [0.4, 7.35],
    rotationY: 0.08,
    scale: 1,
    elevation: 3.26,
    label: "中庭顶部线缆槽",
    role: "hub overhead cable run",
    mount: "ceiling",
  },
  {
    id: "level_05_v4_dressing_hub_floor_cable_bridge",
    modelKey: "room_l5_v4_floor_cable_bridge",
    roomId: "level_05_lock_hub",
    position: [5.55, 6.05],
    rotationY: Math.PI / 2,
    scale: 0.92,
    elevation: 0.02,
    label: "中庭地面电缆桥",
    role: "low nonblocking service trunk",
    mount: "floor",
  },
  {
    id: "level_05_v4_dressing_hub_warning_beacon",
    modelKey: "room_l5_v4_warning_beacon_pylon",
    roomId: "level_05_lock_hub",
    position: [-7.35, 3.15],
    rotationY: 0.2,
    scale: 0.9,
    elevation: 0,
    label: "中庭警示信标",
    role: "corner danger silhouette",
    mount: "floor",
  },
  {
    id: "level_05_v4_dressing_north_sample_rack",
    modelKey: "room_l5_v4_sample_canister_rack",
    roomId: "level_05_north_lock",
    position: [3.68, -5.02],
    rotationY: -Math.PI / 2,
    scale: 0.86,
    elevation: 0,
    label: "北侧样本罐架",
    role: "brake-room wall rack",
    mount: "floor",
  },
  {
    id: "level_05_v4_dressing_north_clamp_relay",
    modelKey: "room_l5_v4_clamp_relay_column",
    roomId: "level_05_north_lock",
    position: [-3.76, -4.95],
    rotationY: 0.15,
    scale: 0.88,
    elevation: 0,
    label: "北侧夹钳继电柱",
    role: "lock-room corner device",
    mount: "floor",
  },
  {
    id: "level_05_v4_dressing_east_ceiling_service_lamp",
    modelKey: "room_l5_v4_ceiling_service_lamp",
    roomId: "level_05_east_lock",
    position: [13, 7.6],
    rotationY: Math.PI / 2,
    scale: 0.92,
    elevation: 3.26,
    label: "东侧顶部服务灯",
    role: "clinic-zone ceiling light",
    mount: "ceiling",
  },
  {
    id: "level_05_v4_dressing_east_wall_pipe_manifold",
    modelKey: "room_l5_v4_wall_pipe_manifold",
    roomId: "level_05_east_lock",
    position: [16.68, 6.1],
    rotationY: -Math.PI / 2,
    scale: 0.82,
    elevation: 1.18,
    label: "东侧壁挂管汇",
    role: "east wall sterile-service dressing",
    mount: "wall",
  },
  {
    id: "level_05_v4_dressing_west_ceiling_cable_tray",
    modelKey: "room_l5_v4_ceiling_cable_tray",
    roomId: "level_05_west_lock",
    position: [-13, 7.45],
    rotationY: Math.PI / 2,
    scale: 0.9,
    elevation: 3.26,
    label: "西侧顶部线缆槽",
    role: "west room overhead cable run",
    mount: "ceiling",
  },
  {
    id: "level_05_v4_dressing_west_crate_stack",
    modelKey: "room_l5_v4_maintenance_crate_stack",
    roomId: "level_05_west_lock",
    position: [-16.25, 4.32],
    rotationY: 0.22,
    scale: 0.82,
    elevation: 0,
    label: "西侧维护箱堆",
    role: "edge storage mass",
    mount: "floor",
  },
  {
    id: "level_05_v4_dressing_west_wall_pipe_manifold",
    modelKey: "room_l5_v4_wall_pipe_manifold",
    roomId: "level_05_west_lock",
    position: [-16.68, 8.25],
    rotationY: Math.PI / 2,
    scale: 0.82,
    elevation: 1.18,
    label: "西侧壁挂管汇",
    role: "west wall service dressing",
    mount: "wall",
  },
  {
    id: "level_05_v4_dressing_platform_left_beacon",
    modelKey: "room_l5_v4_warning_beacon_pylon",
    roomId: "level_05_platform",
    position: [-6.9, -16.85],
    rotationY: -0.35,
    scale: 0.9,
    elevation: 0,
    label: "内台左警示信标",
    role: "arena rear corner beacon",
    mount: "floor",
  },
  {
    id: "level_05_v4_dressing_platform_right_beacon",
    modelKey: "room_l5_v4_warning_beacon_pylon",
    roomId: "level_05_platform",
    position: [6.9, -16.85],
    rotationY: 0.35,
    scale: 0.9,
    elevation: 0,
    label: "内台右警示信标",
    role: "arena rear corner beacon",
    mount: "floor",
  },
  {
    id: "level_05_v4_dressing_platform_ceiling_service_lamp",
    modelKey: "room_l5_v4_ceiling_service_lamp",
    roomId: "level_05_platform",
    position: [0, -12.25],
    rotationY: 0,
    scale: 1.08,
    elevation: 3.32,
    label: "内台顶部服务灯",
    role: "boss-platform overhead focus",
    mount: "ceiling",
  },
  {
    id: "level_05_v4_dressing_archive_ceiling_service_lamp",
    modelKey: "room_l5_v4_ceiling_service_lamp",
    roomId: "level_05_archive_room",
    position: [11.5, -12],
    rotationY: Math.PI / 2,
    scale: 0.86,
    elevation: 3.24,
    label: "档案室顶部服务灯",
    role: "archive ceiling focus",
    mount: "ceiling",
  },
  {
    id: "level_05_v4_dressing_archive_wall_pipe_manifold",
    modelKey: "room_l5_v4_wall_pipe_manifold",
    roomId: "level_05_archive_room",
    position: [8.22, -12.2],
    rotationY: Math.PI / 2,
    scale: 0.78,
    elevation: 1.16,
    label: "档案室壁挂管汇",
    role: "archive side-wall service dressing",
    mount: "wall",
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

function v4SurfaceOverrides() {
  return {
    floor: { presetId: v4SurfacePresets.floor, authored: true },
    wall: { presetId: v4SurfacePresets.wall, authored: true },
    ceiling: { presetId: v4SurfacePresets.ceiling, authored: true },
  };
}

function updateRoomSurface(room) {
  if (room.style === "exit") return;
  room.env = {
    ...(room.env ?? {}),
    surfaceKitId: v4SurfaceKitId,
    floorPresetId: v4SurfacePresets.floor,
    wallPresetId: v4SurfacePresets.wall,
    ceilingPresetId: v4SurfacePresets.ceiling,
    ceilingVisible: room.env?.ceilingVisible ?? true,
    wallHeight: room.env?.wallHeight ?? 3.6,
    ceilingHeight: room.env?.ceilingHeight ?? 3.6,
    surfaceOverrides: v4SurfaceOverrides(),
  };
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
        "hp:level05_v4_dressing",
        "source:deterministic-math-script",
        "license:project-owned-clean",
        "placement:art_directed",
        `mount:${placement.mount}`,
      ],
    },
  };
}

function updateProject(project) {
  for (const room of project.rooms ?? []) updateRoomSurface(room);
  const existing = Array.isArray(project.props) ? project.props : [];
  project.props = [
    ...existing.filter((prop) => !String(prop.id ?? "").startsWith(placementPrefix)),
    ...placements.map(normalizedProp),
  ];
}

function loadFootprints() {
  const manifest = readJson(manifestPath);
  return new Map(
    (manifest.assets ?? []).map((asset) => [
      asset.modelKey,
      {
        label: asset.label,
        sizeMeters: asset.sizeMeters ?? null,
        family: asset.family ?? null,
        solid: asset.solid ?? null,
        mount: asset.mount ?? null,
      },
    ]),
  );
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

function surfaceReport(project) {
  return (project.rooms ?? []).map((room) => ({
    roomId: room.id,
    style: room.style,
    surfaceKitId: room.env?.surfaceKitId ?? null,
    floorPresetId: room.env?.floorPresetId ?? null,
    wallPresetId: room.env?.wallPresetId ?? null,
    ceilingPresetId: room.env?.ceilingPresetId ?? null,
    surfaceOverrides: room.env?.surfaceOverrides ?? null,
  }));
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
  schema: "hp.level05.reclamation.dressingV4.officialPlacement.v1",
  generatedAt: "2026-06-28",
  sourceOfTruth: officialBuilderPath,
  syncedCampaignCopy: campaignBuilderPath,
  syncedCampaignLevel: campaignLevelPath,
  placementPrefix,
  surfaceKitId: v4SurfaceKitId,
  surfacePresets: v4SurfacePresets,
  summary: {
    placements: placementReport.length,
    roomsTouched: [...new Set(placementReport.map((entry) => entry.roomId))],
    officialPropCount: officialDocument.project.props.length,
    campaignPropCount: campaignProject.props.length,
    campaignLevelPropCount: campaignLevel?.map?.props?.length ?? null,
    campaignCompileIssues: campaignCompileIssues.length,
    nonExitRoomsWithV4Surface: officialDocument.project.rooms.filter((room) => room.style !== "exit" && room.env?.surfaceKitId === v4SurfaceKitId).length,
  },
  placementPrinciples: [
    "Ceiling and wall dressing carry most of the production-value increase without shrinking combat lanes.",
    "Solid furniture stays against room edges or rear corners.",
    "Platform beacons are non-solid and live at rear corners so boss movement and shooting lanes remain open.",
    "The exit elevator room keeps its existing bright service-elevator surface logic.",
  ],
  surfaces: surfaceReport(officialDocument.project),
  placements: placementReport,
};

writeJson(reportJsonPath, report);

const byRoom = new Map();
for (const entry of placementReport) {
  if (!byRoom.has(entry.roomId)) byRoom.set(entry.roomId, []);
  byRoom.get(entry.roomId).push(entry);
}

const md = [
  "# Level 05 v4 Dressing Official Placement",
  "",
  "- Generated: `2026-06-28`",
  `- Source of truth: \`${officialBuilderPath}\``,
  `- Synced campaign copy: \`${campaignBuilderPath}\``,
  `- Synced campaign level: \`${campaignLevelPath}\``,
  `- Surface kit: \`${v4SurfaceKitId}\``,
  `- Placements: \`${placementReport.length}\``,
  "",
  "## Surface Pass",
  "",
  ...surfaceReport(officialDocument.project).map(
    (room) =>
      `- \`${room.roomId}\`: kit \`${room.surfaceKitId ?? "none"}\`, floor \`${room.floorPresetId ?? "none"}\`, wall \`${room.wallPresetId ?? "none"}\`, ceiling \`${room.ceilingPresetId ?? "none"}\``,
  ),
  "",
  "## Placements",
  "",
];

for (const [roomId, entries] of byRoom.entries()) {
  md.push(`### ${roomId}`);
  for (const entry of entries) {
    md.push(
      `- \`${entry.id}\` -> \`${entry.modelKey}\` at \`${JSON.stringify(entry.position)}\`, elevation \`${entry.elevation}\`, scale \`${entry.scale}\`, clearance \`${JSON.stringify(entry.clearanceMeters)}\``,
    );
  }
  md.push("");
}

writeJson(reportJsonPath, report);
fs.writeFileSync(path.join(repo, reportMdPath), `${md.join("\n")}\n`);

console.log(`applied ${placements.length} Level 05 v4 dressing placements`);
console.log(`compiled campaign Level 5 with ${campaignLevel?.map?.props?.length ?? 0} props`);
console.log(`wrote ${reportJsonPath}`);
