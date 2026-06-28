import type { BuilderRoomEnv, BuilderRoomStyle } from "./BuilderTypes";

/**
 * Flagship room kits — internal asset factory batch-01.
 *
 * Data contract only (hp room kits are not yet a /build catalog tab or a
 * compile path; see docs/human-protocol-internal-asset-factory-v1.md §6).
 * Offsets are meters from room center on the floor plane (x → world x,
 * z → world z, +z = back wall), aligned to the 0.05 m fine grid so kits can
 * be stamped onto a BuilderRoom without re-snapping.
 */

export type BuilderRoomKitRole = "hero" | "anchor" | "interactive" | "filler" | "wallModule";

export interface BuilderRoomKitPlacement {
  modelKey: string;
  /** Offset from room center, meters. */
  offsetMeters: readonly [number, number];
  rotationDeg: 0 | 90 | 180 | 270;
  role: BuilderRoomKitRole;
}

export type BuilderRoomKitSuitability = "low" | "medium" | "high";

export interface BuilderRoomKitDefinition {
  kitId: string;
  label: string;
  /** Reuse lane from the asset bible (maintenance/residential/museum/clinic/core/...). */
  lane: string;
  /** One-line room story for level designers. */
  story: string;
  roomStyle: BuilderRoomStyle;
  /** Floor footprint width (x) and depth (z), meters. */
  sizeMeters: readonly [number, number];
  ceilingHeightMeters: number;
  /** Optional per-room surface overrides applied on top of roomStyle. */
  env?: BuilderRoomEnv;
  lighting: { hint: string; accentColor: string };
  placements: readonly BuilderRoomKitPlacement[];
  /** Intended player flow, door-to-door. */
  playerPathIntent: string;
  spawnSuitable: boolean;
  exitSuitable: boolean;
  puzzleSuitability: BuilderRoomKitSuitability;
  combatSuitability: BuilderRoomKitSuitability;
  tags: readonly string[];
}

export const builderRoomKitCatalog: readonly BuilderRoomKitDefinition[] = [
  {
    kitId: "kit_maintenance_bay",
    label: "维修舱",
    lane: "maintenance",
    story: "为比人更大的东西准备的检修间——中央的检修台空着，束带是松开的。",
    roomStyle: "maintenance",
    sizeMeters: [7, 5.5],
    ceilingHeightMeters: 2.6,
    lighting: { hint: "单点顶光打中央检修台，配电塔指示灯青色呼吸，四周压暗。", accentColor: "#6fe3c2" },
    placements: [
      { modelKey: "hero_maintenance_repair_bay", offsetMeters: [0, 0.4], rotationDeg: 0, role: "hero" },
      { modelKey: "room_l1_img2_wall_tool_board", offsetMeters: [-2.35, 2.45], rotationDeg: 0, role: "interactive" },
      { modelKey: "room_l1_img2_breaker_pylon", offsetMeters: [2.65, 1.55], rotationDeg: 270, role: "interactive" },
      { modelKey: "room_l1_img2_utility_crate", offsetMeters: [-2.55, -1.6], rotationDeg: 90, role: "filler" },
      { modelKey: "room_l1_img2_service_stool", offsetMeters: [0.9, -0.45], rotationDeg: 180, role: "filler" },
      { modelKey: "room_l1_img2_parts_cabinet", offsetMeters: [1.9, 2.1], rotationDeg: 0, role: "interactive" },
      { modelKey: "room_fuse_box", offsetMeters: [-0.9, 2.65], rotationDeg: 0, role: "wallModule" },
    ],
    playerPathIntent: "南门进入，绕检修台两翼通行；电力谜题在东墙配电塔，搜索链在西北工具抽屉墙。",
    spawnSuitable: true,
    exitSuitable: false,
    puzzleSuitability: "high",
    combatSuitability: "medium",
    tags: ["lane:maintenance", "repair-horror", "power-puzzle", "search-room"],
  },
  {
    kitId: "kit_fake_living_room",
    label: "虚假客厅",
    lane: "residential",
    story: "样板间级别的家。电视永远在播放，沙发正对屏幕，屏幕也正对沙发。",
    roomStyle: "residential",
    sizeMeters: [6.5, 5],
    ceilingHeightMeters: 2.4,
    lighting: { hint: "均匀暖白主光，无影子死角；电视蓝光间歇闪在沙发上。", accentColor: "#ffd9a8" },
    placements: [
      { modelKey: "room_l2_img2_family_portrait_console", offsetMeters: [0, 2.05], rotationDeg: 180, role: "hero" },
      { modelKey: "room_l2_img2_modular_sofa", offsetMeters: [0, -0.6], rotationDeg: 0, role: "anchor" },
      { modelKey: "hp_l2_cc0_dining_chair_polyhaven_v1", offsetMeters: [2.3, -1.5], rotationDeg: 270, role: "filler" },
      { modelKey: "room_l2_img2_observation_bookshelf", offsetMeters: [-2.05, 0.3], rotationDeg: 90, role: "filler" },
      { modelKey: "room_l2_img2_observation_dining_table", offsetMeters: [2.1, 1.2], rotationDeg: 270, role: "interactive" },
      { modelKey: "room_l2_img2_nursery_bed", offsetMeters: [-2.15, -1.55], rotationDeg: 90, role: "filler" },
      { modelKey: "hp_l2_cc0_wall_mirror_polyhaven_v1", offsetMeters: [1.4, 2.35], rotationDeg: 0, role: "wallModule" },
    ],
    playerPathIntent: "南门进入即被电视-沙发轴线接住；线索在写字桌抽屉与全家福背后暗格。",
    spawnSuitable: true,
    exitSuitable: true,
    puzzleSuitability: "medium",
    combatSuitability: "low",
    tags: ["lane:residential", "uncanny-home", "clue-cache", "quiet-room"],
  },
  {
    kitId: "kit_human_archive",
    label: "人类档案室",
    lane: "museum",
    story: "人类是展品。主展柜的玻璃罩亮着底座灯，里面应该有东西。",
    roomStyle: "residential",
    sizeMeters: [8, 6],
    ceilingHeightMeters: 3,
    env: { wallColor: "#46332a", floorColor: "#2b2622", ceilingHeight: 3 },
    lighting: { hint: "环境光压到最低，每个展柜独立暖黄底座灯，黄铜反光做导路。", accentColor: "#ffc46e" },
    placements: [
      { modelKey: "room_l3_img2_preservation_case", offsetMeters: [0, 0.8], rotationDeg: 0, role: "hero" },
      { modelKey: "room_l3_img2_mural_lightbox", offsetMeters: [-2.6, 2.75], rotationDeg: 0, role: "wallModule" },
      { modelKey: "room_l3_img2_archive_card_cabinet", offsetMeters: [3.2, 1.2], rotationDeg: 270, role: "interactive" },
      { modelKey: "room_l3_img2_evidence_round_table", offsetMeters: [2.7, -1.9], rotationDeg: 180, role: "interactive" },
      { modelKey: "room_l3_img2_specimen_bench", offsetMeters: [0, -1.6], rotationDeg: 0, role: "filler" },
      { modelKey: "room_l3_img2_label_terminal", offsetMeters: [-3.3, -0.4], rotationDeg: 90, role: "interactive" },
      { modelKey: "room_l3_img2_display_plinth", offsetMeters: [1.6, 2.35], rotationDeg: 0, role: "wallModule" },
    ],
    playerPathIntent: "中轴对称大厅：进门正对主展柜；谜题链从展签板读起，经珍本架锁，终点在标本抽屉墙。",
    spawnSuitable: false,
    exitSuitable: false,
    puzzleSuitability: "high",
    combatSuitability: "medium",
    tags: ["lane:museum", "exhibit-hall", "lock-chain", "set-piece"],
  },
  {
    kitId: "kit_sedation_suite",
    label: "镇静诊疗间",
    lane: "clinic",
    story: "温柔的恶意：床朝向一切，一切朝向床。值守椅还是温的。",
    roomStyle: "sterile",
    sizeMeters: [6, 5],
    ceilingHeightMeters: 2.4,
    lighting: { hint: "无影冷白手术光，体征终端绿色波形微光；唯一暖光来自门缝。", accentColor: "#64d7ff" },
    placements: [
      { modelKey: "hp_l4_cineclinic_exam_table", offsetMeters: [0.3, 0.5], rotationDeg: 90, role: "hero" },
      { modelKey: "hp_l4_cineclinic_lime_ottoman", offsetMeters: [1.6, -0.5], rotationDeg: 270, role: "filler" },
      { modelKey: "hp_l4_cineclinic_med_cabinet", offsetMeters: [-2.2, 2.05], rotationDeg: 0, role: "interactive" },
      { modelKey: "hp_l4_cineclinic_record_wall_cabinet", offsetMeters: [-2.55, 0.2], rotationDeg: 90, role: "interactive" },
      { modelKey: "hp_l4_cineclinic_triage_kiosk", offsetMeters: [1.8, 2.05], rotationDeg: 0, role: "interactive" },
      { modelKey: "hp_l4_cineclinic_cable_trolley", offsetMeters: [2.3, -1.65], rotationDeg: 0, role: "filler" },
      { modelKey: "hp_l4_cineclinic_rescue_speaker_panel", offsetMeters: [-0.8, 2.4], rotationDeg: 0, role: "wallModule" },
    ],
    playerPathIntent: "进门视线先落在镇静床；数值谜题在体征终端，钥匙链经剂量抽屉到药剂柜。",
    spawnSuitable: true,
    exitSuitable: false,
    puzzleSuitability: "high",
    combatSuitability: "low",
    tags: ["lane:clinic", "medical-sedation", "numeric-puzzle", "quiet-room"],
  },
  {
    kitId: "kit_core_anteroom",
    label: "回收核心前室",
    lane: "core",
    story: "终点站的等候室：两排长椅面向封存库门——排队，然后被回收。",
    roomStyle: "hazard",
    sizeMeters: [7, 6],
    ceilingHeightMeters: 3.2,
    env: { wallColor: "#15181c", floorColor: "#1b1f24", ceilingHeight: 3.2 },
    lighting: { hint: "青色发光缝是唯一持续光源；警示屏间歇红闪（红色只属于这里）。", accentColor: "#37e0ff" },
    placements: [
      { modelKey: "room_cyber_core_power_spine", offsetMeters: [0, 2.45], rotationDeg: 0, role: "hero" },
      { modelKey: "room_cyber_security_desk", offsetMeters: [2.35, 1.2], rotationDeg: 270, role: "interactive" },
      { modelKey: "room_cyber_server_rack", offsetMeters: [-2.3, 2.25], rotationDeg: 0, role: "interactive" },
      { modelKey: "room_cyber_hazard_barrier", offsetMeters: [2.75, -1.8], rotationDeg: 90, role: "filler" },
      { modelKey: "room_desire_brass_safe", offsetMeters: [-2.7, 0.4], rotationDeg: 90, role: "interactive" },
      { modelKey: "room_l3_img2_specimen_bench", offsetMeters: [-1, -2.1], rotationDeg: 0, role: "filler" },
      { modelKey: "room_l3_img2_specimen_bench", offsetMeters: [1, -2.1], rotationDeg: 0, role: "filler" },
      { modelKey: "room_cyber_monitor_wall", offsetMeters: [2, 2.45], rotationDeg: 0, role: "wallModule" },
    ],
    playerPathIntent: "南门进入，穿过两排等候长椅的走道直面封存库；密码链在监控台与锁箱之间，暗门机柜藏撤离捷径。",
    spawnSuitable: false,
    exitSuitable: true,
    puzzleSuitability: "high",
    combatSuitability: "high",
    tags: ["lane:core", "finale-approach", "code-chain", "arena"],
  },
];

export function roomKitEntry(kitId: string): BuilderRoomKitDefinition | undefined {
  return builderRoomKitCatalog.find((kit) => kit.kitId === kitId);
}
