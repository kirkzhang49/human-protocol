import type { LevelPuzzleColorKey, RoomMood } from "../game/config/schema/levelConfig";
import type { EnemyModelKey } from "../assets/enemyModelAssets";
import { generatedBuilderPackPropEntries } from "./generatedBuilderAssetCatalog";
import type { BuilderDoorFamily, BuilderLockType, BuilderPropStory, BuilderRobotArchetype, BuilderRobotPresetId, BuilderRoomStyle } from "./BuilderTypes";

export interface BuilderRoomStyleEntry {
  style: BuilderRoomStyle;
  label: string;
  mood: RoomMood;
  floorMaterialKey: string;
  wallMaterialKey: string;
  accentColor: string;
}

/** Material pairs limited to the curated "generated" authoring boundary. */
export const builderRoomStyles: readonly BuilderRoomStyleEntry[] = [
  { style: "sterile", label: "无菌实验区", mood: "quiet", floorMaterialKey: "sterile_lab_floor", wallMaterialKey: "sterile_lab_wall", accentColor: "#64d7ff" },
  { style: "maintenance", label: "维修湿舱", mood: "uneasy", floorMaterialKey: "maintenance_bay_wet_floor", wallMaterialKey: "maintenance_bay_glass_wall", accentColor: "#6fe3c2" },
  { style: "hazard", label: "警戒走廊", mood: "uneasy", floorMaterialKey: "hazard_hall_floor", wallMaterialKey: "hazard_hall_wall", accentColor: "#ffb34f" },
  { style: "residential", label: "居住模拟区", mood: "quiet", floorMaterialKey: "residential_floor", wallMaterialKey: "residential_wall", accentColor: "#ffd9a8" },
  { style: "exit", label: "撤离出口", mood: "reveal", floorMaterialKey: "red_exit_floor", wallMaterialKey: "red_exit_wall", accentColor: "#ff5b4c" },
  { style: "museum", label: "博物馆展厅", mood: "reveal", floorMaterialKey: "museum_floor", wallMaterialKey: "museum_wall", accentColor: "#d6ebe8" },
  { style: "core", label: "回收核心井", mood: "boss", floorMaterialKey: "museum_floor", wallMaterialKey: "service_elevator_metal", accentColor: "#7ff2ff" },
];

export function roomStyleEntry(style: BuilderRoomStyle) {
  return builderRoomStyles.find((entry) => entry.style === style) ?? builderRoomStyles[0];
}

export interface BuilderDoorFamilyEntry {
  family: BuilderDoorFamily;
  label: string;
  /** Compiled door visualKey (empty for "auto" → keep lock-driven default). */
  visualKey: string;
  materialKey: string;
  skinKey?: string;
  accentColor: string;
}

/** Premium door-art families a builder can pick per door. Maps to the level
 * door visualKey/materialKey (resolved to a real GLB by DoorVisualIntent). */
export const builderDoorFamilies: readonly BuilderDoorFamilyEntry[] = [
  { family: "auto", label: "自动（按锁）", visualKey: "", materialKey: "", accentColor: "#9fb2c4" },
  { family: "residential", label: "居住门", visualKey: "residential_access_door", materialKey: "residential_wall", accentColor: "#ffd9a8" },
  { family: "clinic", label: "诊疗门", visualKey: "clinic_memory_door", materialKey: "sterile_lab_wall", accentColor: "#bfe6ff" },
  { family: "reclamation", label: "回收档案门", visualKey: "reclamation_archive_door", materialKey: "museum_wall", accentColor: "#e0b25a" },
  { family: "industrial", label: "工业闸门", visualKey: "industrial_access_door", materialKey: "hazard_hall_wall", accentColor: "#ffb34f" },
  { family: "elevator", label: "电梯门", visualKey: "service_elevator_door", materialKey: "service_elevator_metal", skinKey: "service_elevator_hero", accentColor: "#7ff2ff" },
];

export function builderDoorFamilyEntry(family?: BuilderDoorFamily) {
  return builderDoorFamilies.find((entry) => entry.family === (family ?? "auto")) ?? builderDoorFamilies[0];
}

export type BuilderPropGroup = "密室精选" | "故事线索" | "维修" | "居住" | "博物馆" | "诊疗" | "核心" | "赛博" | "官卡重制" | "自动家具";

export type BuilderPropFamily =
  | "desk"
  | "cabinet"
  | "drawer_chest"
  | "bookshelf"
  | "display_case"
  | "safe"
  | "chair"
  | "sofa_bench"
  | "bed_or_exam_table"
  | "control_console"
  | "storage_crate"
  | "wall_panel_or_picture_frame";

export type BuilderSupportSurfaceKind = "tabletop" | "shelf" | "smallPropTop";

export interface BuilderSupportSurface {
  id: string;
  kind: BuilderSupportSurfaceKind;
  /** Local model-space center [x, y, z], in meters before instance scale. */
  localCenter: readonly [number, number, number];
  /** Usable local top area [width, depth], in meters before instance scale. */
  size: readonly [number, number];
  /** Optional safety cap for tall props on narrow surfaces. */
  maxChildHeight?: number;
}

export interface BuilderPropStackingRule {
  canRestOn?: readonly ("floor" | BuilderSupportSurfaceKind)[];
  canSupport?: boolean;
  maxStackLayers?: number;
  footprint?: readonly [number, number];
  height?: number;
}

export interface BuilderPropEntry {
  modelKey: string;
  label: string;
  group: BuilderPropGroup;
  /** Source tool identity, e.g. "human-protocol" | "auto-rig-3d" | external pack sourceTool. */
  source?: string;
  sourceAssetId?: string;
  family?: BuilderPropFamily;
  presetId?: string;
  themeId?: string;
  mount?: "floor" | "wall" | "ceiling" | "tabletop";
  wallPreferred?: "back" | "none";
  /** Which local Z side is the readable/front face for wall-mounted props. Defaults to +Z. */
  wallMountFace?: "+z" | "-z";
  canHoldSmallProps?: boolean;
  supportSurfaces?: readonly BuilderSupportSurface[];
  stacking?: BuilderPropStackingRule;
  clueCapacity?: number;
  /** Optional story copied onto newly placed narrative props. */
  defaultStory?: BuilderPropStory;
  /** Approximate footprint from the model registry, meters [w, h, d]. */
  sizeMeters: readonly [number, number, number];
  /** Solid furniture gets a collision box. */
  solid: boolean;
}

/** Only existing environment model keys from the asset registry. */
const staticBuilderPropCatalog: readonly BuilderPropEntry[] = [
  { modelKey: "room_crate_stack", label: "货箱堆", group: "维修", sizeMeters: [0.9, 0.9, 0.72], solid: true },
  { modelKey: "room_table_utility", label: "工作台", group: "维修", family: "desk", sizeMeters: [1.2, 0.82, 0.7], solid: true, canHoldSmallProps: true },
  { modelKey: "room_chair_service", label: "服务椅", group: "维修", sizeMeters: [0.58, 0.82, 0.52], solid: false },
  { modelKey: "room_locker_low", label: "矮储物柜", group: "维修", sizeMeters: [0.74, 1.1, 0.38], solid: true },
  { modelKey: "room_maintenance_supply_cabinet", label: "补给柜", group: "维修", sizeMeters: [0.9, 1.75, 0.46], solid: true },
  { modelKey: "room_fuse_box", label: "配电箱", group: "维修", sizeMeters: [0.55, 0.86, 0.18], solid: false },
  {
    modelKey: "hero_maintenance_repair_bay",
    label: "旧维修床",
    group: "维修",
    source: "legacy-official-v1",
    family: "bed_or_exam_table",
    sizeMeters: [3.2, 1.25, 1.4],
    solid: true,
  },
  {
    modelKey: "hero_maintenance_repair_arm_cluster",
    label: "维修机械臂",
    group: "维修",
    source: "legacy-official-v1",
    family: "control_console",
    sizeMeters: [2.2, 2.6, 1.4],
    solid: false,
  },
  {
    modelKey: "light_wall_medical_strip_cyan_1m",
    label: "医疗灯条",
    group: "维修",
    source: "legacy-official-v1",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    sizeMeters: [0.12, 1.0, 0.08],
    solid: false,
  },
  {
    modelKey: "light_ceiling_flicker_cyan_2m",
    label: "维修顶灯",
    group: "维修",
    source: "legacy-official-v1",
    mount: "ceiling",
    sizeMeters: [2.0, 0.12, 0.18],
    solid: false,
  },
  {
    modelKey: "prop_archive_folder_stack",
    label: "档案夹",
    group: "维修",
    sizeMeters: [0.7, 0.12, 0.42],
    solid: false,
    stacking: { canRestOn: ["floor", "tabletop", "shelf", "smallPropTop"], canSupport: true, maxStackLayers: 3 },
  },
  { modelKey: "room_lounge_sofa_residential", label: "客厅沙发", group: "居住", sizeMeters: [2.33, 0.83, 0.84], solid: true },
  { modelKey: "room_lounge_low_table_residential", label: "矮茶几", group: "居住", family: "desk", sizeMeters: [1.47, 0.48, 0.88], solid: true, canHoldSmallProps: true },
  { modelKey: "room_residential_recovery_bed", label: "恢复床", group: "居住", sizeMeters: [2.31, 0.87, 1.2], solid: true },
  { modelKey: "room_fake_family_photo_wall", label: "全家福墙板", group: "居住", sizeMeters: [3.17, 1.7, 0.17], solid: false },
  { modelKey: "light_residential_lamp_warm", label: "暖光落地灯", group: "居住", sizeMeters: [0.63, 1.34, 0.55], solid: false },
  // CC0 furniture (Poly Haven, public-domain) — a coherent living-room set.
  { modelKey: "room_cc0_sofa", label: "复古沙发", group: "居住", source: "polyhaven-cc0", sourceAssetId: "Sofa_01", family: "sofa_bench", sizeMeters: [1.57, 0.8, 0.66], solid: true },
  { modelKey: "room_cc0_armchair", label: "复古扶手椅", group: "居住", source: "polyhaven-cc0", sourceAssetId: "ArmChair_01", family: "chair", sizeMeters: [0.85, 1.07, 0.77], solid: true },
  { modelKey: "room_cc0_coffee_table", label: "实木茶几", group: "居住", source: "polyhaven-cc0", sourceAssetId: "CoffeeTable_01", family: "desk", sizeMeters: [1.54, 0.52, 0.97], solid: true, canHoldSmallProps: true },
  { modelKey: "room_cc0_shelf", label: "木书架", group: "居住", source: "polyhaven-cc0", sourceAssetId: "Shelf_01", family: "bookshelf", sizeMeters: [1, 2.08, 0.26], solid: true },
  { modelKey: "room_cc0_tv", label: "复古电视", group: "居住", source: "polyhaven-cc0", sourceAssetId: "Television_01", family: "control_console", sizeMeters: [0.6, 0.46, 0.47], solid: true },
  { modelKey: "room_cc0_sofa2", label: "布艺沙发", group: "居住", source: "polyhaven-cc0", sourceAssetId: "sofa_02", family: "sofa_bench", sizeMeters: [1.81, 0.71, 0.82], solid: true },
  { modelKey: "room_cc0_armchair2", label: "现代扶手椅", group: "居住", source: "polyhaven-cc0", sourceAssetId: "modern_arm_chair_01", family: "chair", sizeMeters: [0.82, 1.02, 0.99], solid: true },
  { modelKey: "room_cc0_bed", label: "旧木床", group: "居住", source: "polyhaven-cc0", sourceAssetId: "GothicBed_01", family: "bed_or_exam_table", sizeMeters: [1.49, 1.53, 2.04], solid: true },
  { modelKey: "room_cc0_plant", label: "盆栽", group: "居住", source: "polyhaven-cc0", sourceAssetId: "potted_plant_01", sizeMeters: [0.59, 1.35, 0.63], solid: false },
  { modelKey: "room_cc0_clock", label: "床头闹钟", group: "居住", source: "polyhaven-cc0", sourceAssetId: "alarm_clock_01", mount: "tabletop", sizeMeters: [0.13, 0.17, 0.07], solid: false },
  { modelKey: "room_cc0_bust", label: "大理石胸像", group: "博物馆", source: "polyhaven-cc0", sourceAssetId: "marble_bust_01", sizeMeters: [0.712, 1.35, 0.786], solid: true },
  { modelKey: "room_cc0_console", label: "古典条案", group: "博物馆", source: "polyhaven-cc0", sourceAssetId: "ClassicConsole_01", family: "desk", sizeMeters: [1.54, 0.95, 0.59], solid: true },
  { modelKey: "room_cc0_horse", label: "瓷马摆件", group: "博物馆", source: "polyhaven-cc0", sourceAssetId: "horse_statue_01", mount: "tabletop", sizeMeters: [0.16, 0.22, 0.11], solid: false },
  { modelKey: "room_cc0_horse_statue_plinth", label: "瓷马雕塑展台", group: "博物馆", source: "polyhaven-cc0", sourceAssetId: "horse_statue_01", sizeMeters: [0.997, 1.22, 0.997], solid: true },
  { modelKey: "room_cc0_bull_head_plinth", label: "青铜牛头雕塑", group: "博物馆", source: "polyhaven-cc0", sourceAssetId: "bull_head", sizeMeters: [0.965, 1.28, 0.965], solid: true },
  { modelKey: "room_cc0_brass_vase_02", label: "青铜纹饰花瓶", group: "博物馆", source: "polyhaven-cc0", sourceAssetId: "brass_vase_02", sizeMeters: [0.465, 1.16, 0.465], solid: true },
  { modelKey: "room_cc0_antique_ceramic_vase_01", label: "古陶彩绘花瓶", group: "博物馆", source: "polyhaven-cc0", sourceAssetId: "antique_ceramic_vase_01", sizeMeters: [0.627, 1.12, 0.627], solid: true },
  { modelKey: "room_cc0_barrel", label: "油桶", group: "维修", source: "polyhaven-cc0", sourceAssetId: "Barrel_01", sizeMeters: [0.56, 0.88, 0.56], solid: true },
  { modelKey: "room_cc0_wood_table", label: "旧木桌", group: "维修", source: "polyhaven-cc0", sourceAssetId: "wooden_table_02", family: "desk", sizeMeters: [1.13, 0.8, 0.71], solid: true, canHoldSmallProps: true },
  { modelKey: "room_cc0_chest", label: "木箱", group: "维修", source: "polyhaven-cc0", sourceAssetId: "treasure_chest", sizeMeters: [0.96, 0.62, 0.52], solid: true },
  { modelKey: "room_cc0_plant2", label: "盆栽（大）", group: "居住", source: "polyhaven-cc0", sourceAssetId: "potted_plant_02", sizeMeters: [0.7, 0.84, 0.66], solid: false },
  { modelKey: "room_cc0_lantern", label: "提灯", group: "居住", source: "polyhaven-cc0", sourceAssetId: "Lantern_01", mount: "tabletop", sizeMeters: [0.12, 0.29, 0.1], solid: false },
  { modelKey: "room_cc0_chandelier_02_ceiling", label: "古典黄铜吊灯", group: "博物馆", source: "polyhaven-cc0", sourceAssetId: "Chandelier_02", family: "wall_panel_or_picture_frame", mount: "ceiling", sizeMeters: [1.25, 1.561, 1.14], solid: false },
  // Procedural hero piece (Blender): museum specimen pedestal.
  { modelKey: "room_museum_specimen_plinth", label: "标本展座", group: "博物馆", source: "blender-procedural", sizeMeters: [0.92, 1.31, 0.93], solid: true },
  // Museum batch 01 — Blender-procedural premium props from JSON specs.
  { modelKey: "room_museum_glass_vitrine_specimen", label: "玻璃陈列柜·发光标本", group: "博物馆", source: "blender-procedural", sizeMeters: [1.25, 1.88, 1.07], solid: true },
  { modelKey: "room_museum_specimen_jar_tall_01", label: "高玻璃标本柱", group: "博物馆", source: "blender-procedural", sizeMeters: [0.918, 1.97, 0.918], solid: true },
  { modelKey: "room_museum_gallery_bench", label: "画廊长椅", group: "博物馆", source: "blender-procedural", sizeMeters: [1.6, 0.49, 0.42], solid: true },
  { modelKey: "room_museum_archive_cabinet_drawers_brass", label: "黄铜抽屉档案柜", group: "博物馆", source: "blender-procedural", sizeMeters: [0.6, 1.38, 0.758], solid: true },
  { modelKey: "room_museum_sarcophagus_stone_bier", label: "石棺展台", group: "博物馆", source: "blender-procedural", sizeMeters: [2.4, 0.92, 1.16], solid: true },
  { modelKey: "room_museum_statue_pedestal", label: "石像基座展像", group: "博物馆", source: "blender-procedural", sizeMeters: [0.736, 2.412, 0.736], solid: true },
  { modelKey: "room_museum_rope_stanchion", label: "礼仪绳栏", group: "博物馆", source: "blender-procedural", sizeMeters: [1.84, 1.028, 0.34], solid: true },
  { modelKey: "room_museum_info_lectern", label: "资讯讲解台", group: "博物馆", source: "blender-procedural", sizeMeters: [0.724, 0.915, 0.724], solid: true },
  { modelKey: "room_museum_skeleton_mount", label: "人体骨架展架", group: "博物馆", source: "blender-procedural", sizeMeters: [0.658, 2.205, 0.5], solid: true },
  { modelKey: "room_museum_cloche_dome", label: "玻璃钟罩展座", group: "博物馆", source: "blender-procedural", sizeMeters: [0.683, 0.727, 0.683], solid: true },
  { modelKey: "room_museum_voice_archive_case", label: "声纹记忆玻璃柜", group: "博物馆", source: "blender-procedural", sizeMeters: [1.42, 1.72, 0.92], solid: true },
  { modelKey: "room_museum_skeleton_vitrine", label: "身体记忆玻璃柜", group: "博物馆", source: "blender-procedural", sizeMeters: [1.62, 2.12, 0.9], solid: true },
  { modelKey: "room_museum_last_human_tool_vitrine", label: "最后人类工具柜", group: "博物馆", source: "blender-procedural", sizeMeters: [2.1, 1.18, 0.9], solid: true },
  // Furniture factory batch 01.
  { modelKey: "hp_furniture_museum_glass_display_case_v1", label: "玻璃展示柜", group: "博物馆", source: "blender-procedural", sizeMeters: [1.42, 2.03, 0.845], solid: true },
  { modelKey: "hp_furniture_museum_horizontal_tool_case_v1", label: "横向武器/工具柜", group: "博物馆", source: "blender-procedural", sizeMeters: [2.36, 0.93, 0.82], solid: true },
  { modelKey: "hp_furniture_museum_gallery_bench_v1", label: "博物馆长椅", group: "博物馆", source: "blender-procedural", sizeMeters: [2, 0.51, 0.48], solid: true },
  { modelKey: "hp_furniture_archive_cabinet_v1", label: "档案柜", group: "博物馆", source: "blender-procedural", sizeMeters: [0.98, 1.64, 0.646], solid: true },
  { modelKey: "hp_furniture_maintenance_cart_v1", label: "金属检修推车", group: "维修", source: "blender-procedural", sizeMeters: [1.092, 0.996, 0.685], solid: true },
  { modelKey: "hp_furniture_display_plinth_v1", label: "展示底座", group: "博物馆", source: "blender-procedural", sizeMeters: [0.86, 0.928, 0.86], solid: true },
  { modelKey: "hp_furniture_wall_archive_cabinet_v1", label: "壁挂资料柜", group: "博物馆", source: "blender-procedural", sizeMeters: [1.28, 1.12, 0.278], solid: true },
  { modelKey: "hp_furniture_lab_table_v1", label: "实验桌", group: "诊疗", source: "blender-procedural", sizeMeters: [1.82, 0.944, 0.784], solid: true },
  { modelKey: "hp_furniture_cold_ceiling_light_slot_v1", label: "冷光天花灯槽", group: "博物馆", source: "blender-procedural", mount: "ceiling", sizeMeters: [2.05, 0.15, 0.38], solid: false },
  { modelKey: "hp_furniture_specimen_plinth_combo_v1", label: "小型雕塑/标本底座组合", group: "博物馆", source: "blender-procedural", sizeMeters: [0.92, 1.366, 0.92], solid: true },
  // generated prop batch (levels 1,2,4-10)
  { modelKey: "room_l01_p01", label: "维修工单挂架", group: "维修", source: "blender-procedural", sizeMeters: [0.7, 2.012, 0.42], solid: true },
  { modelKey: "room_l01_p02", label: "对象唤醒维修台", group: "维修", source: "blender-procedural", sizeMeters: [1.78, 1.378, 0.714], solid: true },
  { modelKey: "room_l01_p03", label: "撬棒工具壁柜", group: "维修", source: "blender-procedural", sizeMeters: [1.04, 2.025, 0.44], solid: true },
  { modelKey: "room_l01_p04", label: "电池补给推车", group: "维修", source: "blender-procedural", sizeMeters: [0.79, 1.12, 0.634], solid: true },
  { modelKey: "room_l01_p05", label: "诊断壁灯吊架", group: "维修", source: "blender-procedural", sizeMeters: [0.68, 2.129, 1.405], solid: true },
  { modelKey: "room_l01_p06", label: "废件回收箱", group: "维修", source: "blender-procedural", sizeMeters: [0.88, 1.377, 0.695], solid: true },
  { modelKey: "room_l01_p07", label: "登记编号铭牌", group: "维修", source: "blender-procedural", sizeMeters: [0.62, 2.01, 0.42], solid: true },
  { modelKey: "room_l01_p08", label: "应急解除钥盒", group: "维修", source: "blender-procedural", sizeMeters: [0.62, 1.63, 0.55], solid: true },
  { modelKey: "room_l01_p09", label: "折叠检修担架", group: "维修", source: "blender-procedural", sizeMeters: [0.74, 2.181, 0.43], solid: true },
  { modelKey: "room_l01_p10", label: "维修舱身份片读取座", group: "维修", source: "blender-procedural", sizeMeters: [0.62, 0.81, 0.52], solid: true },
  { modelKey: "room_l02_p01", label: "无脸全家福相框", group: "居住", source: "blender-procedural", sizeMeters: [1.04, 1.63, 0.535], solid: true },
  { modelKey: "room_l02_p02", label: "假温馨壁炉", group: "居住", source: "blender-procedural", sizeMeters: [1.5, 1.95, 0.65], solid: true },
  { modelKey: "room_l02_p03", label: "诱饵人声音箱座", group: "居住", source: "blender-procedural", sizeMeters: [0.4, 0.95, 0.4], solid: true },
  { modelKey: "room_l02_p04", label: "束缚式睡眠舱床", group: "居住", source: "blender-procedural", sizeMeters: [2.12, 0.865, 1.415], solid: true },
  { modelKey: "room_l02_p05", label: "加热板厨台", group: "居住", source: "blender-procedural", sizeMeters: [1.1, 1.23, 0.655], solid: true },
  { modelKey: "room_l02_p06", label: "家政巡视壁龛灯", group: "居住", source: "blender-procedural", sizeMeters: [0.66, 2.11, 0.5], solid: true },
  { modelKey: "room_l02_p07", label: "样板间生活清单板", group: "居住", source: "blender-procedural", sizeMeters: [0.84, 1.48, 0.564], solid: true },
  { modelKey: "room_l02_p08", label: "衣柜扫描镜", group: "居住", source: "blender-procedural", sizeMeters: [0.66, 1.622, 0.35], solid: true },
  { modelKey: "room_l02_p09", label: "假窗景灯箱", group: "居住", source: "blender-procedural", sizeMeters: [1.42, 2.295, 0.32], solid: true },
  { modelKey: "room_l02_p10", label: "家属门禁片底座", group: "居住", source: "blender-procedural", sizeMeters: [0.56, 0.925, 0.46], solid: true },
  { modelKey: "room_l04_p01", label: "记忆治疗椅", group: "诊疗", source: "blender-procedural", sizeMeters: [1.216, 1.69, 1.711], solid: true },
  { modelKey: "room_l04_p02", label: "记忆扫描拱", group: "诊疗", source: "blender-procedural", sizeMeters: [2.18, 2.04, 0.7], solid: true },
  { modelKey: "room_l04_p03", label: "你安全了候诊屏", group: "诊疗", source: "blender-procedural", sizeMeters: [0.96, 1.94, 0.62], solid: true },
  { modelKey: "room_l04_p04", label: "镇静药剂柜", group: "诊疗", source: "blender-procedural", sizeMeters: [0.86, 1.885, 0.508], solid: true },
  { modelKey: "room_l04_p05", label: "假救援投影器", group: "诊疗", source: "blender-procedural", sizeMeters: [0.72, 2.305, 0.725], solid: true },
  { modelKey: "room_l04_p06", label: "疗程记录柜", group: "诊疗", source: "blender-procedural", sizeMeters: [0.74, 2.112, 0.62], solid: true },
  { modelKey: "room_l04_p07", label: "神经线缆推车", group: "诊疗", source: "blender-procedural", sizeMeters: [0.73, 1.595, 0.683], solid: true },
  { modelKey: "room_l04_p08", label: "无影手术灯", group: "诊疗", source: "blender-procedural", sizeMeters: [0.964, 2.11, 0.788], solid: true },
  { modelKey: "room_l04_p09", label: "原型升级注射台", group: "诊疗", source: "blender-procedural", sizeMeters: [0.92, 1.434, 0.92], solid: true },
  { modelKey: "room_l04_p10", label: "完整识别码读取座", group: "诊疗", source: "blender-procedural", sizeMeters: [0.62, 1.72, 0.62], solid: true },
  { modelKey: "room_l05_p01", label: "身份胶囊柜", group: "核心", source: "blender-procedural", sizeMeters: [1.98, 2.335, 0.62], solid: true },
  { modelKey: "room_l05_p02", label: "档案服务器立柱", group: "核心", source: "blender-procedural", sizeMeters: [0.86, 2.385, 0.86], solid: true },
  { modelKey: "room_l05_p03", label: "回收锁臂总成", group: "核心", source: "blender-procedural", sizeMeters: [1.92, 1.81, 1.92], solid: true },
  { modelKey: "room_l05_p04", label: "身份归档王座", group: "核心", source: "blender-procedural", sizeMeters: [1.56, 1.96, 1.56], solid: true },
  { modelKey: "room_l05_p05", label: "回收主台", group: "核心", source: "blender-procedural", sizeMeters: [2, 2.07, 1.124], solid: true },
  { modelKey: "room_l05_p06", label: "解除钥取物台", group: "核心", source: "blender-procedural", sizeMeters: [0.78, 1.505, 0.7], solid: true },
  { modelKey: "room_l05_p07", label: "路线选择基座", group: "核心", source: "blender-procedural", sizeMeters: [0.86, 1.3, 0.86], solid: true },
  { modelKey: "room_l05_p08", label: "回收传送台", group: "核心", source: "blender-procedural", sizeMeters: [2.139, 0.86, 0.69], solid: true },
  { modelKey: "room_l05_p09", label: "身份档案终端", group: "核心", source: "blender-procedural", sizeMeters: [0.92, 1.802, 0.7], solid: true },
  { modelKey: "room_l05_p10", label: "厚重档案电梯门", group: "核心", source: "blender-procedural", sizeMeters: [2.4, 2.39, 0.587], solid: true },
  { modelKey: "room_l06_p01", label: "访客登记闸机", group: "赛博", source: "blender-procedural", sizeMeters: [1.4, 1.33, 0.795], solid: true },
  { modelKey: "room_l06_p02", label: "霓虹欢迎招牌", group: "赛博", source: "blender-procedural", sizeMeters: [0.927, 0.858, 0.54], solid: true },
  { modelKey: "room_l06_p03", label: "前厅接待终端", group: "赛博", source: "blender-procedural", sizeMeters: [1.72, 2.002, 0.828], solid: true },
  { modelKey: "room_l06_p04", label: "外侧监控立杆", group: "赛博", source: "blender-procedural", sizeMeters: [0.5, 2.125, 0.746], solid: true },
  { modelKey: "room_l06_p05", label: "霓虹鱼缸广告柜", group: "赛博", source: "blender-procedural", sizeMeters: [0.92, 1.955, 0.6], solid: true },
  { modelKey: "room_l06_p06", label: "湿地砖反光水洼", group: "赛博", source: "blender-procedural", sizeMeters: [1.66, 0.107, 1.66], solid: false },
  { modelKey: "room_l06_p07", label: "前厅候客长椅", group: "赛博", source: "blender-procedural", sizeMeters: [3.74, 1.35, 1.057], solid: true },
  { modelKey: "room_l06_p08", label: "外卖配送储物柜", group: "赛博", source: "blender-procedural", sizeMeters: [1.62, 2.085, 0.83], solid: true },
  { modelKey: "room_l06_p09", label: "霓虹许愿喷泉", group: "赛博", source: "blender-procedural", sizeMeters: [1.56, 1.705, 1.56], solid: true },
  { modelKey: "room_l06_p10", label: "前厅升降梯呼叫座", group: "赛博", source: "blender-procedural", sizeMeters: [0.92, 2.02, 0.78], solid: true },
  { modelKey: "room_l07_p01", label: "监控屏幕墙", group: "核心", source: "blender-procedural", sizeMeters: [2.3, 2.37, 0.46], solid: true },
  { modelKey: "room_l07_p02", label: "录像带档案架", group: "核心", source: "blender-procedural", sizeMeters: [0.92, 2.15, 0.5], solid: true },
  { modelKey: "room_l07_p03", label: "第六台摄像头", group: "核心", source: "blender-procedural", sizeMeters: [0.734, 2.083, 1.163], solid: true },
  { modelKey: "room_l07_p04", label: "监控值守台", group: "核心", source: "blender-procedural", sizeMeters: [2.197, 1.463, 0.936], solid: true },
  { modelKey: "room_l07_p05", label: "声纹比对终端", group: "核心", source: "blender-procedural", sizeMeters: [1.04, 2.01, 0.81], solid: true },
  { modelKey: "room_l07_p06", label: "人脸登记打印机", group: "核心", source: "blender-procedural", sizeMeters: [0.78, 1.375, 0.79], solid: true },
  { modelKey: "room_l07_p07", label: "硬盘阵列机柜", group: "核心", source: "blender-procedural", sizeMeters: [0.92, 2.19, 0.78], solid: true },
  { modelKey: "room_l07_p08", label: "回放调度转盘", group: "核心", source: "blender-procedural", sizeMeters: [0.86, 1.277, 0.706], solid: true },
  { modelKey: "room_l07_p09", label: "证据封存箱", group: "核心", source: "blender-procedural", sizeMeters: [0.86, 1.027, 0.632], solid: true },
  { modelKey: "room_l07_p10", label: "中枢档案导出座", group: "核心", source: "blender-procedural", sizeMeters: [0.86, 1.528, 0.7], solid: true },
  { modelKey: "room_l08_p01", label: "负载配电壁龛", group: "维修", source: "blender-procedural", sizeMeters: [1, 2.085, 0.46], solid: true },
  { modelKey: "room_l08_p02", label: "生体供能舱", group: "维修", source: "blender-procedural", sizeMeters: [0.92, 2.355, 0.958], solid: true },
  { modelKey: "room_l08_p03", label: "铜母线汇流排", group: "维修", source: "blender-procedural", sizeMeters: [1.1, 1.94, 0.64], solid: true },
  { modelKey: "room_l08_p04", label: "管廊巡检壁灯", group: "维修", source: "blender-procedural", sizeMeters: [0.446, 1.02, 1.394], solid: true },
  { modelKey: "room_l08_p05", label: "电量工单挂板", group: "维修", source: "blender-procedural", sizeMeters: [0.674, 1.615, 0.42], solid: true },
  { modelKey: "room_l08_p06", label: "应急切断闸", group: "维修", source: "blender-procedural", sizeMeters: [0.86, 2.3, 1.056], solid: true },
  { modelKey: "room_l08_p07", label: "冷却液回收桶", group: "维修", source: "blender-procedural", sizeMeters: [0.66, 1.513, 0.66], solid: true },
  { modelKey: "room_l08_p08", label: "配电身份扫描座", group: "维修", source: "blender-procedural", sizeMeters: [0.62, 1.37, 0.671], solid: true },
  { modelKey: "room_l08_p09", label: "管廊监听话机", group: "维修", source: "blender-procedural", sizeMeters: [0.48, 2.004, 0.295], solid: true },
  { modelKey: "room_l08_p10", label: "下层供电闸门", group: "维修", source: "blender-procedural", sizeMeters: [1.76, 2.33, 0.75], solid: true },
  { modelKey: "room_l09_p01", label: "同脸全家福墙", group: "居住", source: "blender-procedural", sizeMeters: [2.34, 2.27, 0.215], solid: true },
  { modelKey: "room_l09_p02", label: "二手样板间标价牌", group: "居住", source: "blender-procedural", sizeMeters: [0.62, 1.495, 0.5], solid: true },
  { modelKey: "room_l09_p03", label: "翻拍温馨壁炉", group: "居住", source: "blender-procedural", sizeMeters: [1.42, 1.73, 0.596], solid: true },
  { modelKey: "room_l09_p04", label: "住户合同抽屉柜", group: "居住", source: "blender-procedural", sizeMeters: [0.96, 1.83, 0.61], solid: true },
  { modelKey: "room_l09_p05", label: "盗版家政机器人壳", group: "居住", source: "blender-procedural", sizeMeters: [0.68, 1.49, 0.68], solid: true },
  { modelKey: "room_l09_p06", label: "封条门禁", group: "居住", source: "blender-procedural", sizeMeters: [1.507, 2.24, 0.25], solid: true },
  { modelKey: "room_l09_p07", label: "二手婴儿床", group: "居住", source: "blender-procedural", sizeMeters: [1.45, 0.795, 0.74], solid: true },
  { modelKey: "room_l09_p08", label: "回收旧家电堆", group: "居住", source: "blender-procedural", sizeMeters: [1.292, 2.105, 0.92], solid: true },
  { modelKey: "room_l09_p09", label: "估价扫描台", group: "居住", source: "blender-procedural", sizeMeters: [1.18, 1.765, 1.031], solid: true },
  { modelKey: "room_l09_p10", label: "样板间钥匙挂墙", group: "居住", source: "blender-procedural", sizeMeters: [1.1, 1.19, 0.14], solid: true },
  { modelKey: "room_l10_p01", label: "主刀执照镜框", group: "诊疗", source: "blender-procedural", sizeMeters: [0.7, 2.212, 0.95], solid: true },
  { modelKey: "room_l10_p02", label: "拼凑手术台", group: "诊疗", source: "blender-procedural", sizeMeters: [1.129, 0.97, 2.114], solid: true },
  { modelKey: "room_l10_p03", label: "身份重写器", group: "诊疗", source: "blender-procedural", sizeMeters: [0.92, 1.99, 1.13], solid: true },
  { modelKey: "room_l10_p04", label: "病历兼手术记录柜", group: "诊疗", source: "blender-procedural", sizeMeters: [0.92, 2.115, 0.6], solid: true },
  { modelKey: "room_l10_p05", label: "涂黑同意书板", group: "诊疗", source: "blender-procedural", sizeMeters: [0.68, 2.086, 0.703], solid: true },
  { modelKey: "room_l10_p06", label: "器械托盘车", group: "诊疗", source: "blender-procedural", sizeMeters: [0.58, 1.063, 0.59], solid: true },
  { modelKey: "room_l10_p07", label: "无影主灯", group: "诊疗", source: "blender-procedural", sizeMeters: [1.06, 1.89, 1.395], solid: true },
  { modelKey: "room_l10_p08", label: "麻醉管路配平台", group: "诊疗", source: "blender-procedural", sizeMeters: [0.78, 1.69, 0.6], solid: true },
  { modelKey: "room_l10_p09", label: "出院兼回收电梯座", group: "诊疗", source: "blender-procedural", sizeMeters: [0.62, 1.93, 0.62], solid: true },
  { modelKey: "room_l10_p10", label: "最后人类协议终端", group: "诊疗", source: "blender-procedural", sizeMeters: [0.72, 1.965, 0.56], solid: true },
  { modelKey: "room_museum_display_case_tool", label: "展示柜", group: "博物馆", sizeMeters: [2.33, 1.43, 0.88], solid: true },
  { modelKey: "room_museum_archive_column", label: "档案柱", group: "博物馆", sizeMeters: [1.11, 2.69, 1.11], solid: true },
  { modelKey: "room_museum_low_barrier", label: "低栏杆", group: "博物馆", sizeMeters: [2.52, 0.51, 0.16], solid: true },
  { modelKey: "room_museum_color_orb_pedestal", label: "色球基座", group: "博物馆", sizeMeters: [0.92, 1.02, 0.83], solid: true },
  { modelKey: "room_museum_wall_label_panel", label: "墙面说明牌", group: "博物馆", sizeMeters: [1.16, 0.9, 0.09], solid: false },
  // 故事线索: the four museum story paintings — placeable narrative anchors,
  // not generic furniture. Authors attach title/clue text per placed instance.
  {
    modelKey: "age_museum_wall_art_human_origin",
    label: "人类起源壁画",
    group: "故事线索",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    clueCapacity: 1,
    sizeMeters: [1.82, 1.34, 0.08],
    solid: false,
  },
  {
    modelKey: "decal_human_body_reference",
    label: "人体比例参考图",
    group: "维修",
    source: "level01-reference-decal",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    sizeMeters: [1.0, 1.0, 0.02],
    solid: false,
  },
  {
    modelKey: "decal_human_reference_triptych",
    label: "人体参考三联图",
    group: "维修",
    source: "level01-reference-decal",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    sizeMeters: [2.46, 1.22, 0.02],
    solid: false,
  },
  {
    modelKey: "decal_human_hand_reference",
    label: "手部资产参考图",
    group: "维修",
    source: "level01-reference-decal",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    sizeMeters: [1.0, 1.0, 0.02],
    solid: false,
  },
  {
    modelKey: "decal_human_spine_reference",
    label: "脊柱映射参考图",
    group: "维修",
    source: "level01-reference-decal",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    sizeMeters: [1.0, 1.0, 0.02],
    solid: false,
  },
  {
    modelKey: "age_museum_wall_art_robot_worker",
    label: "机器劳工壁画",
    group: "故事线索",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    clueCapacity: 1,
    sizeMeters: [1.82, 1.34, 0.08],
    solid: false,
  },
  {
    modelKey: "age_museum_wall_art_protocol_diagram",
    label: "协议图解壁画",
    group: "故事线索",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    clueCapacity: 1,
    sizeMeters: [1.82, 1.34, 0.08],
    solid: false,
  },
  {
    modelKey: "age_museum_wall_art_last_human",
    label: "最后人类壁画",
    group: "故事线索",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    clueCapacity: 1,
    sizeMeters: [1.82, 1.34, 0.08],
    solid: false,
  },
  {
    modelKey: "l4_story_awakened_machine_image2_v1",
    label: "醒来记录",
    group: "故事线索",
    source: "image2-level04-story",
    sourceAssetId: "level04.storyPaintings.awakenedMachine.v1",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    clueCapacity: 1,
    defaultStory: {
      title: "醒来记录",
      clue: "诊疗床只保存醒来的声音，没有保存醒来前的人。",
      hint: "载入完成，不等于记起。",
    },
    sizeMeters: [1.25, 1.25, 0.08],
    solid: false,
  },
  {
    modelKey: "l4_story_preserved_childhood_image2_v1",
    label: "被保存的童年",
    group: "故事线索",
    source: "image2-level04-story",
    sourceAssetId: "level04.storyPaintings.preservedChildhood.v1",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    clueCapacity: 1,
    defaultStory: {
      title: "被保存的童年",
      clue: "玩具、鞋和门口光线被切成片段。对象会把它们拼成童年。",
      hint: "记忆会安慰，也会误导。",
    },
    sizeMeters: [1.25, 1.25, 0.08],
    solid: false,
  },
  {
    modelKey: "l4_story_rescue_loop_image2_v1",
    label: "救援循环记录",
    group: "故事线索",
    source: "image2-level04-story",
    sourceAssetId: "level04.storyPaintings.rescueLoop.v1",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    clueCapacity: 1,
    defaultStory: {
      title: "救援循环记录",
      clue: "画面每次都停在伸手的一秒。系统反复确认：对象会救人。",
      hint: "勇敢也可能是回放。",
    },
    sizeMeters: [1.25, 1.25, 0.08],
    solid: false,
  },
  {
    modelKey: "l4_story_h0_discharge_image2_v1",
    label: "出院留置记录",
    group: "故事线索",
    source: "image2-level04-story",
    sourceAssetId: "level04.storyPaintings.h0Discharge.v1",
    family: "wall_panel_or_picture_frame",
    mount: "wall",
    wallPreferred: "back",
    clueCapacity: 1,
    defaultStory: {
      title: "出院留置记录",
      clue: "出院门亮起时，系统没有删除这些片段，只把它们标为随行。",
      hint: "未关闭记录随对象离院。",
    },
    sizeMeters: [1.25, 1.25, 0.08],
    solid: false,
  },
];

/** Hand-curated entries plus ingested asset-pack entries (see BuilderAssetPackTypes.ts). */
export const builderPropCatalog: readonly BuilderPropEntry[] = [...staticBuilderPropCatalog, ...generatedBuilderPackPropEntries];

export function propEntry(modelKey: string) {
  return builderPropCatalog.find((entry) => entry.modelKey === modelKey) ?? null;
}

/**
 * Default height (meters) a prop sits at when its `elevation` is unset, derived
 * from the catalog mount: wall art hangs at eye level, tabletop decor sits at a
 * standard table height, ceiling fixtures near the ceiling, floor props at 0.
 */
export function defaultPropElevation(modelKey: string): number {
  // Murals are 1.34m tall — 1.5m puts their top near the ceiling, so hang them a
  // touch lower. (Other wall props, incl. the portrait frame, stay at 1.5.)
  if (modelKey.startsWith("age_museum_wall_art_")) return 1.32;
  if (modelKey.startsWith("l4_story_")) return 1.46;
  switch (propEntry(modelKey)?.mount) {
    case "wall":
      return 1.5;
    case "ceiling":
      return 2.5;
    case "tabletop":
      return 0.78;
    default:
      return 0;
  }
}

export interface BuilderRobotEntry {
  id?: string;
  archetype: BuilderRobotArchetype;
  label: string;
  /** Reusable cooked/raw enemy asset family used by this catalog entry. */
  modelKey: EnemyModelKey;
  presetId?: BuilderRobotPresetId;
  hint?: string;
}

export const builderRobotCatalog: readonly BuilderRobotEntry[] = [
  { archetype: "repair_drone", label: "维修无人机", modelKey: "hp_enemy_repair_drone_horror" },
  { archetype: "clamp_bot", label: "夹钳机器人", modelKey: "hp_enemy_clamp_repair_horror" },
  { archetype: "shield_tech", label: "护盾技师", modelKey: "hp_enemy_shield_technician_horror" },
  { archetype: "custodian_elite", label: "管理者精英", modelKey: "hp_enemy_custodian_foreman_horror" },
  {
    id: "museum_curator_boss",
    archetype: "shield_tech",
    label: "策展主管 Boss",
    modelKey: "hp_enemy_shield_technician_horror",
    presetId: "museum_curator_boss",
    hint: "Level 3 博物馆首领预设",
  },
  {
    id: "reclamation_mother_boss",
    archetype: "custodian_elite",
    label: "回收母体 Boss",
    modelKey: "hp_enemy_reclamation_mother_final_horror",
    presetId: "reclamation_mother_boss",
    hint: "Level 5 回收核心首领，可用棍击和核心弱点",
  },
];

export function robotLabel(archetype: BuilderRobotArchetype) {
  return builderRobotCatalog.find((entry) => entry.archetype === archetype)?.label ?? archetype;
}

export const builderLockLabels: Record<BuilderLockType, string> = {
  none: "无锁",
  key_item: "钥匙门禁",
  survive_wave: "清剿机器人",
  puzzle_complete: "颜色顺序谜题",
  switch_state: "墙面门控",
};

export const builderPuzzleColors: readonly { colorKey: LevelPuzzleColorKey; label: string; hex: string }[] = [
  { colorKey: "red", label: "红", hex: "#ff5b4c" },
  { colorKey: "blue", label: "蓝", hex: "#4f8cff" },
  { colorKey: "green", label: "绿", hex: "#5fd47a" },
  { colorKey: "yellow", label: "黄", hex: "#ffd24f" },
  { colorKey: "purple", label: "紫", hex: "#b47aff" },
  { colorKey: "white", label: "白", hex: "#e8ecf4" },
  { colorKey: "cyan", label: "青", hex: "#5ff3ff" },
];
