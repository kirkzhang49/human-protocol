import type { EnvironmentModelRegistry } from "./types";
import propArchiveBookOpenUrl from "../../models-cooked/environment/props/hp_prop_archive_book_open.glb?url";
import propArchiveFolderStackUrl from "../../models-cooked/environment/props/hp_prop_archive_folder_stack.glb?url";
import propSmallFloorShadowDiscUrl from "../../models-cooked/environment/props/hp_prop_small_floor_shadow_disc.glb?url";
import abilityProtocolBreachChargeV1Url from "../../models-cooked/environment/props/hp_ability_protocol_breach_charge_v1.glb?url";
import abilityProtocolBreachMissileV1Url from "../../models-cooked/environment/props/hp_ability_protocol_breach_missile_v1.glb?url";
import roomCeilingStripLightUrl from "../../models-cooked/environment/props/hp_room_ceiling_strip_light.glb?url";
import roomChairServiceUrl from "../../models-cooked/environment/props/hp_room_chair_service.glb?url";
import roomCrateStackUrl from "../../models-cooked/environment/props/hp_room_crate_stack.glb?url";
import roomFuseBoxUrl from "../../models-cooked/environment/props/hp_room_fuse_box.glb?url";
import roomLockerLowUrl from "../../models-cooked/environment/props/hp_room_locker_low.glb?url";
import roomMaintenanceSupplyCabinetUrl from "../../models-cooked/environment/props/hp_room_maintenance_supply_cabinet.glb?url";
import roomTableUtilityUrl from "../../models-cooked/environment/props/hp_room_table_utility.glb?url";
import switchPanelFloorLeverUrl from "../../models-cooked/environment/props/hp_switch_panel_floor_lever.glb?url";
import switchPanelWallCyanUrl from "../../models-cooked/environment/props/hp_switch_panel_wall_cyan.glb?url";
import switchPanelWallRedUrl from "../../models-cooked/environment/props/hp_switch_panel_wall_red.glb?url";
import switchStateLightAmberUrl from "../../models-cooked/environment/props/hp_switch_state_light_amber.glb?url";
import switchStateLightCyanUrl from "../../models-cooked/environment/props/hp_switch_state_light_cyan.glb?url";
import switchStateLightRedUrl from "../../models-cooked/environment/props/hp_switch_state_light_red.glb?url";
// CC0 furniture (Poly Haven, public-domain) packed to single GLBs.
import roomCc0SofaUrl from "../../models-cooked/environment/props/hp_room_cc0_sofa.glb?url";
import roomCc0ArmchairUrl from "../../models-cooked/environment/props/hp_room_cc0_armchair.glb?url";
import roomCc0CoffeeTableUrl from "../../models-cooked/environment/props/hp_room_cc0_coffee_table.glb?url";
import roomCc0ShelfUrl from "../../models-cooked/environment/props/hp_room_cc0_shelf.glb?url";
import roomCc0TvUrl from "../../models-cooked/environment/props/hp_room_cc0_tv.glb?url";
import roomCc0Sofa2Url from "../../models-cooked/environment/props/hp_room_cc0_sofa2.glb?url";
import roomCc0Armchair2Url from "../../models-cooked/environment/props/hp_room_cc0_armchair2.glb?url";
import roomCc0BedUrl from "../../models-cooked/environment/props/hp_room_cc0_bed.glb?url";
import roomCc0PlantUrl from "../../models-cooked/environment/props/hp_room_cc0_plant.glb?url";
import roomCc0ClockUrl from "../../models-cooked/environment/props/hp_room_cc0_clock.glb?url";
import roomCc0BustUrl from "../../models-cooked/environment/props/hp_room_cc0_bust.glb?url";
import roomCc0ConsoleUrl from "../../models-cooked/environment/props/hp_room_cc0_console.glb?url";
import roomCc0HorseUrl from "../../models-cooked/environment/props/hp_room_cc0_horse.glb?url";
import roomCc0HorseStatuePlinthUrl from "../../models-cooked/environment/props/hp_room_cc0_horse_statue_plinth.glb?url";
import roomCc0BullHeadPlinthUrl from "../../models-cooked/environment/props/hp_room_cc0_bull_head_plinth.glb?url";
import roomCc0BrassVase02Url from "../../models-cooked/environment/props/hp_room_cc0_brass_vase_02.glb?url";
import roomCc0AntiqueCeramicVase01Url from "../../models-cooked/environment/props/hp_room_cc0_antique_ceramic_vase_01.glb?url";
import roomCc0BarrelUrl from "../../models-cooked/environment/props/hp_room_cc0_barrel.glb?url";
import roomCc0WoodTableUrl from "../../models-cooked/environment/props/hp_room_cc0_wood_table.glb?url";
import roomCc0ChestUrl from "../../models-cooked/environment/props/hp_room_cc0_chest.glb?url";
import roomCc0Plant2Url from "../../models-cooked/environment/props/hp_room_cc0_plant2.glb?url";
import roomCc0LanternUrl from "../../models-cooked/environment/props/hp_room_cc0_lantern.glb?url";
import roomCc0Chandelier02CeilingUrl from "../../models-cooked/environment/props/hp_room_cc0_chandelier_02_ceiling.glb?url";
// Procedurally modeled in Blender (scripts/asset-build/blender-make-specimen-plinth.py).
import roomMuseumSpecimenPlinthUrl from "../../models-cooked/environment/props/hp_room_museum_specimen_plinth.glb?url";
// Museum batch 01 — procedurally modeled in Blender (scripts/asset-build/blender-build-prop.py from JSON specs).
import roomMuseumGlassVitrineSpecimenUrl from "../../models-cooked/environment/props/hp_room_museum_glass_vitrine_specimen.glb?url";
import roomMuseumSpecimenJarTall01Url from "../../models-cooked/environment/props/hp_room_museum_specimen_jar_tall_01.glb?url";
import roomMuseumGalleryBenchUrl from "../../models-cooked/environment/props/hp_room_museum_gallery_bench.glb?url";
import roomMuseumArchiveCabinetDrawersBrassUrl from "../../models-cooked/environment/props/hp_room_museum_archive_cabinet_drawers_brass.glb?url";
import roomMuseumSarcophagusStoneBierUrl from "../../models-cooked/environment/props/hp_room_museum_sarcophagus_stone_bier.glb?url";
import roomMuseumStatuePedestalUrl from "../../models-cooked/environment/props/hp_room_museum_statue_pedestal.glb?url";
import roomMuseumRopeStanchionUrl from "../../models-cooked/environment/props/hp_room_museum_rope_stanchion.glb?url";
import roomMuseumInfoLecternUrl from "../../models-cooked/environment/props/hp_room_museum_info_lectern.glb?url";
import roomMuseumSkeletonMountUrl from "../../models-cooked/environment/props/hp_room_museum_skeleton_mount.glb?url";
import roomMuseumClocheDomeUrl from "../../models-cooked/environment/props/hp_room_museum_cloche_dome.glb?url";
// Furniture factory batch 01 — deterministic Blender-procedural props.
import hpFurnitureMuseumGlassDisplayCaseV1Url from "../../models-cooked/environment/props/hp_furniture_museum_glass_display_case_v1.glb?url";
import hpFurnitureMuseumHorizontalToolCaseV1Url from "../../models-cooked/environment/props/hp_furniture_museum_horizontal_tool_case_v1.glb?url";
import hpFurnitureMuseumGalleryBenchV1Url from "../../models-cooked/environment/props/hp_furniture_museum_gallery_bench_v1.glb?url";
import hpFurnitureArchiveCabinetV1Url from "../../models-cooked/environment/props/hp_furniture_archive_cabinet_v1.glb?url";
import hpFurnitureMaintenanceCartV1Url from "../../models-cooked/environment/props/hp_furniture_maintenance_cart_v1.glb?url";
import hpFurnitureDisplayPlinthV1Url from "../../models-cooked/environment/props/hp_furniture_display_plinth_v1.glb?url";
import hpFurnitureWallArchiveCabinetV1Url from "../../models-cooked/environment/props/hp_furniture_wall_archive_cabinet_v1.glb?url";
import hpFurnitureLabTableV1Url from "../../models-cooked/environment/props/hp_furniture_lab_table_v1.glb?url";
import hpFurnitureColdCeilingLightSlotV1Url from "../../models-cooked/environment/props/hp_furniture_cold_ceiling_light_slot_v1.glb?url";
import hpFurnitureSpecimenPlinthComboV1Url from "../../models-cooked/environment/props/hp_furniture_specimen_plinth_combo_v1.glb?url";
  // generated prop batch (levels 1,2,4-10)
import roomL01P01Url from "../../models-cooked/environment/props/hp_room_l01_p01.glb?url";
import roomL01P02Url from "../../models-cooked/environment/props/hp_room_l01_p02.glb?url";
import roomL01P03Url from "../../models-cooked/environment/props/hp_room_l01_p03.glb?url";
import roomL01P04Url from "../../models-cooked/environment/props/hp_room_l01_p04.glb?url";
import roomL01P05Url from "../../models-cooked/environment/props/hp_room_l01_p05.glb?url";
import roomL01P06Url from "../../models-cooked/environment/props/hp_room_l01_p06.glb?url";
import roomL01P07Url from "../../models-cooked/environment/props/hp_room_l01_p07.glb?url";
import roomL01P08Url from "../../models-cooked/environment/props/hp_room_l01_p08.glb?url";
import roomL01P09Url from "../../models-cooked/environment/props/hp_room_l01_p09.glb?url";
import roomL01P10Url from "../../models-cooked/environment/props/hp_room_l01_p10.glb?url";
import roomL02P01Url from "../../models-cooked/environment/props/hp_room_l02_p01.glb?url";
import roomL02P02Url from "../../models-cooked/environment/props/hp_room_l02_p02.glb?url";
import roomL02P03Url from "../../models-cooked/environment/props/hp_room_l02_p03.glb?url";
import roomL02P04Url from "../../models-cooked/environment/props/hp_room_l02_p04.glb?url";
import roomL02P05Url from "../../models-cooked/environment/props/hp_room_l02_p05.glb?url";
import roomL02P06Url from "../../models-cooked/environment/props/hp_room_l02_p06.glb?url";
import roomL02P07Url from "../../models-cooked/environment/props/hp_room_l02_p07.glb?url";
import roomL02P08Url from "../../models-cooked/environment/props/hp_room_l02_p08.glb?url";
import roomL02P09Url from "../../models-cooked/environment/props/hp_room_l02_p09.glb?url";
import roomL02P10Url from "../../models-cooked/environment/props/hp_room_l02_p10.glb?url";
import roomL04P01Url from "../../models-cooked/environment/props/hp_room_l04_p01.glb?url";
import roomL04P02Url from "../../models-cooked/environment/props/hp_room_l04_p02.glb?url";
import roomL04P03Url from "../../models-cooked/environment/props/hp_room_l04_p03.glb?url";
import roomL04P04Url from "../../models-cooked/environment/props/hp_room_l04_p04.glb?url";
import roomL04P05Url from "../../models-cooked/environment/props/hp_room_l04_p05.glb?url";
import roomL04P06Url from "../../models-cooked/environment/props/hp_room_l04_p06.glb?url";
import roomL04P07Url from "../../models-cooked/environment/props/hp_room_l04_p07.glb?url";
import roomL04P08Url from "../../models-cooked/environment/props/hp_room_l04_p08.glb?url";
import roomL04P09Url from "../../models-cooked/environment/props/hp_room_l04_p09.glb?url";
import roomL04P10Url from "../../models-cooked/environment/props/hp_room_l04_p10.glb?url";
import roomL05P01Url from "../../models-cooked/environment/props/hp_room_l05_p01.glb?url";
import roomL05P02Url from "../../models-cooked/environment/props/hp_room_l05_p02.glb?url";
import roomL05P03Url from "../../models-cooked/environment/props/hp_room_l05_p03.glb?url";
import roomL05P04Url from "../../models-cooked/environment/props/hp_room_l05_p04.glb?url";
import roomL05P05Url from "../../models-cooked/environment/props/hp_room_l05_p05.glb?url";
import roomL05P06Url from "../../models-cooked/environment/props/hp_room_l05_p06.glb?url";
import roomL05P07Url from "../../models-cooked/environment/props/hp_room_l05_p07.glb?url";
import roomL05P08Url from "../../models-cooked/environment/props/hp_room_l05_p08.glb?url";
import roomL05P09Url from "../../models-cooked/environment/props/hp_room_l05_p09.glb?url";
import roomL05P10Url from "../../models-cooked/environment/props/hp_room_l05_p10.glb?url";
import roomL06P01Url from "../../models-cooked/environment/props/hp_room_l06_p01.glb?url";
import roomL06P02Url from "../../models-cooked/environment/props/hp_room_l06_p02.glb?url";
import roomL06P03Url from "../../models-cooked/environment/props/hp_room_l06_p03.glb?url";
import roomL06P04Url from "../../models-cooked/environment/props/hp_room_l06_p04.glb?url";
import roomL06P05Url from "../../models-cooked/environment/props/hp_room_l06_p05.glb?url";
import roomL06P06Url from "../../models-cooked/environment/props/hp_room_l06_p06.glb?url";
import roomL06P07Url from "../../models-cooked/environment/props/hp_room_l06_p07.glb?url";
import roomL06P08Url from "../../models-cooked/environment/props/hp_room_l06_p08.glb?url";
import roomL06P09Url from "../../models-cooked/environment/props/hp_room_l06_p09.glb?url";
import roomL06P10Url from "../../models-cooked/environment/props/hp_room_l06_p10.glb?url";
import roomL07P01Url from "../../models-cooked/environment/props/hp_room_l07_p01.glb?url";
import roomL07P02Url from "../../models-cooked/environment/props/hp_room_l07_p02.glb?url";
import roomL07P03Url from "../../models-cooked/environment/props/hp_room_l07_p03.glb?url";
import roomL07P04Url from "../../models-cooked/environment/props/hp_room_l07_p04.glb?url";
import roomL07P05Url from "../../models-cooked/environment/props/hp_room_l07_p05.glb?url";
import roomL07P06Url from "../../models-cooked/environment/props/hp_room_l07_p06.glb?url";
import roomL07P07Url from "../../models-cooked/environment/props/hp_room_l07_p07.glb?url";
import roomL07P08Url from "../../models-cooked/environment/props/hp_room_l07_p08.glb?url";
import roomL07P09Url from "../../models-cooked/environment/props/hp_room_l07_p09.glb?url";
import roomL07P10Url from "../../models-cooked/environment/props/hp_room_l07_p10.glb?url";
import roomL08P01Url from "../../models-cooked/environment/props/hp_room_l08_p01.glb?url";
import roomL08P02Url from "../../models-cooked/environment/props/hp_room_l08_p02.glb?url";
import roomL08P03Url from "../../models-cooked/environment/props/hp_room_l08_p03.glb?url";
import roomL08P04Url from "../../models-cooked/environment/props/hp_room_l08_p04.glb?url";
import roomL08P05Url from "../../models-cooked/environment/props/hp_room_l08_p05.glb?url";
import roomL08P06Url from "../../models-cooked/environment/props/hp_room_l08_p06.glb?url";
import roomL08P07Url from "../../models-cooked/environment/props/hp_room_l08_p07.glb?url";
import roomL08P08Url from "../../models-cooked/environment/props/hp_room_l08_p08.glb?url";
import roomL08P09Url from "../../models-cooked/environment/props/hp_room_l08_p09.glb?url";
import roomL08P10Url from "../../models-cooked/environment/props/hp_room_l08_p10.glb?url";
import roomL09P01Url from "../../models-cooked/environment/props/hp_room_l09_p01.glb?url";
import roomL09P02Url from "../../models-cooked/environment/props/hp_room_l09_p02.glb?url";
import roomL09P03Url from "../../models-cooked/environment/props/hp_room_l09_p03.glb?url";
import roomL09P04Url from "../../models-cooked/environment/props/hp_room_l09_p04.glb?url";
import roomL09P05Url from "../../models-cooked/environment/props/hp_room_l09_p05.glb?url";
import roomL09P06Url from "../../models-cooked/environment/props/hp_room_l09_p06.glb?url";
import roomL09P07Url from "../../models-cooked/environment/props/hp_room_l09_p07.glb?url";
import roomL09P08Url from "../../models-cooked/environment/props/hp_room_l09_p08.glb?url";
import roomL09P09Url from "../../models-cooked/environment/props/hp_room_l09_p09.glb?url";
import roomL09P10Url from "../../models-cooked/environment/props/hp_room_l09_p10.glb?url";
import roomL10P01Url from "../../models-cooked/environment/props/hp_room_l10_p01.glb?url";
import roomL10P02Url from "../../models-cooked/environment/props/hp_room_l10_p02.glb?url";
import roomL10P03Url from "../../models-cooked/environment/props/hp_room_l10_p03.glb?url";
import roomL10P04Url from "../../models-cooked/environment/props/hp_room_l10_p04.glb?url";
import roomL10P05Url from "../../models-cooked/environment/props/hp_room_l10_p05.glb?url";
import roomL10P06Url from "../../models-cooked/environment/props/hp_room_l10_p06.glb?url";
import roomL10P07Url from "../../models-cooked/environment/props/hp_room_l10_p07.glb?url";
import roomL10P08Url from "../../models-cooked/environment/props/hp_room_l10_p08.glb?url";
import roomL10P09Url from "../../models-cooked/environment/props/hp_room_l10_p09.glb?url";
import roomL10P10Url from "../../models-cooked/environment/props/hp_room_l10_p10.glb?url";

export const roomPropEnvironmentModelAssets = {
  prop_archive_book_open: {
    modelKey: "prop_archive_book_open",
    url: propArchiveBookOpenUrl,
    category: "interaction",
    sizeMeters: [0.85, 0.12, 0.55],
  },
  prop_archive_folder_stack: {
    modelKey: "prop_archive_folder_stack",
    url: propArchiveFolderStackUrl,
    category: "interaction",
    sizeMeters: [0.7, 0.12, 0.42],
  },
  prop_small_floor_shadow_disc: {
    modelKey: "prop_small_floor_shadow_disc",
    url: propSmallFloorShadowDiscUrl,
    category: "room",
    sizeMeters: [1.2, 0.02, 1.2],
  },
  ability_protocol_breach_charge_v1: {
    modelKey: "ability_protocol_breach_charge_v1",
    url: abilityProtocolBreachChargeV1Url,
    category: "interaction",
    sizeMeters: [0.268, 0.592, 0.268],
  },
  ability_protocol_breach_missile_v1: {
    modelKey: "ability_protocol_breach_missile_v1",
    url: abilityProtocolBreachMissileV1Url,
    category: "interaction",
    sizeMeters: [0.339, 0.296, 0.915],
  },
  room_ceiling_strip_light: {
    modelKey: "room_ceiling_strip_light",
    url: roomCeilingStripLightUrl,
    category: "room",
    sizeMeters: [1.35, 0.08, 0.14],
  },
  room_chair_service: {
    modelKey: "room_chair_service",
    url: roomChairServiceUrl,
    category: "room",
    sizeMeters: [0.58, 0.82, 0.52],
  },
  room_crate_stack: {
    modelKey: "room_crate_stack",
    url: roomCrateStackUrl,
    category: "room",
    sizeMeters: [0.9, 0.9, 0.72],
  },
  room_fuse_box: {
    modelKey: "room_fuse_box",
    url: roomFuseBoxUrl,
    category: "room",
    sizeMeters: [0.55, 0.86, 0.18],
  },
  room_locker_low: {
    modelKey: "room_locker_low",
    url: roomLockerLowUrl,
    category: "room",
    sizeMeters: [0.74, 1.1, 0.38],
  },
  room_maintenance_supply_cabinet: {
    modelKey: "room_maintenance_supply_cabinet",
    url: roomMaintenanceSupplyCabinetUrl,
    category: "room",
    sizeMeters: [0.9, 1.75, 0.46],
  },
  room_table_utility: {
    modelKey: "room_table_utility",
    url: roomTableUtilityUrl,
    category: "room",
    sizeMeters: [1.2, 0.82, 0.7],
  },
  room_cc0_sofa: {
    modelKey: "room_cc0_sofa",
    url: roomCc0SofaUrl,
    category: "room",
    sizeMeters: [1.57, 0.8, 0.66],
  },
  room_cc0_armchair: {
    modelKey: "room_cc0_armchair",
    url: roomCc0ArmchairUrl,
    category: "room",
    sizeMeters: [0.85, 1.07, 0.77],
  },
  room_cc0_coffee_table: {
    modelKey: "room_cc0_coffee_table",
    url: roomCc0CoffeeTableUrl,
    category: "room",
    sizeMeters: [1.54, 0.52, 0.97],
  },
  room_cc0_shelf: {
    modelKey: "room_cc0_shelf",
    url: roomCc0ShelfUrl,
    category: "room",
    sizeMeters: [1, 2.08, 0.26],
  },
  room_cc0_tv: { modelKey: "room_cc0_tv", url: roomCc0TvUrl, category: "room", sizeMeters: [0.6, 0.46, 0.47] },
  room_cc0_sofa2: { modelKey: "room_cc0_sofa2", url: roomCc0Sofa2Url, category: "room", sizeMeters: [1.81, 0.71, 0.82] },
  room_cc0_armchair2: { modelKey: "room_cc0_armchair2", url: roomCc0Armchair2Url, category: "room", sizeMeters: [0.82, 1.02, 0.99] },
  room_cc0_bed: { modelKey: "room_cc0_bed", url: roomCc0BedUrl, category: "room", sizeMeters: [1.49, 1.53, 2.04] },
  room_cc0_plant: { modelKey: "room_cc0_plant", url: roomCc0PlantUrl, category: "room", sizeMeters: [0.59, 1.35, 0.63] },
  room_cc0_clock: { modelKey: "room_cc0_clock", url: roomCc0ClockUrl, category: "room", sizeMeters: [0.13, 0.17, 0.07] },
  room_cc0_bust: { modelKey: "room_cc0_bust", url: roomCc0BustUrl, category: "room", sizeMeters: [0.712, 1.35, 0.786] },
  room_cc0_console: { modelKey: "room_cc0_console", url: roomCc0ConsoleUrl, category: "room", sizeMeters: [1.54, 0.95, 0.59] },
  room_cc0_horse: { modelKey: "room_cc0_horse", url: roomCc0HorseUrl, category: "room", sizeMeters: [0.16, 0.22, 0.11] },
  room_cc0_horse_statue_plinth: { modelKey: "room_cc0_horse_statue_plinth", url: roomCc0HorseStatuePlinthUrl, category: "room", sizeMeters: [0.997, 1.22, 0.997] },
  room_cc0_bull_head_plinth: { modelKey: "room_cc0_bull_head_plinth", url: roomCc0BullHeadPlinthUrl, category: "room", sizeMeters: [0.965, 1.28, 0.965] },
  room_cc0_brass_vase_02: { modelKey: "room_cc0_brass_vase_02", url: roomCc0BrassVase02Url, category: "room", sizeMeters: [0.465, 1.16, 0.465] },
  room_cc0_antique_ceramic_vase_01: { modelKey: "room_cc0_antique_ceramic_vase_01", url: roomCc0AntiqueCeramicVase01Url, category: "room", sizeMeters: [0.627, 1.12, 0.627] },
  room_cc0_barrel: { modelKey: "room_cc0_barrel", url: roomCc0BarrelUrl, category: "room", sizeMeters: [0.56, 0.88, 0.56] },
  room_cc0_wood_table: { modelKey: "room_cc0_wood_table", url: roomCc0WoodTableUrl, category: "room", sizeMeters: [1.13, 0.8, 0.71] },
  room_cc0_chest: { modelKey: "room_cc0_chest", url: roomCc0ChestUrl, category: "room", sizeMeters: [0.96, 0.62, 0.52] },
  room_cc0_plant2: { modelKey: "room_cc0_plant2", url: roomCc0Plant2Url, category: "room", sizeMeters: [0.7, 0.84, 0.66] },
  room_cc0_lantern: { modelKey: "room_cc0_lantern", url: roomCc0LanternUrl, category: "room", sizeMeters: [0.12, 0.29, 0.1] },
  room_cc0_chandelier_02_ceiling: { modelKey: "room_cc0_chandelier_02_ceiling", url: roomCc0Chandelier02CeilingUrl, category: "room", sizeMeters: [1.25, 1.561, 1.14] },
  room_museum_specimen_plinth: { modelKey: "room_museum_specimen_plinth", url: roomMuseumSpecimenPlinthUrl, category: "room", sizeMeters: [0.92, 1.31, 0.93] },
  room_museum_glass_vitrine_specimen: { modelKey: "room_museum_glass_vitrine_specimen", url: roomMuseumGlassVitrineSpecimenUrl, category: "room", sizeMeters: [1.25, 1.88, 1.07] },
  room_museum_specimen_jar_tall_01: { modelKey: "room_museum_specimen_jar_tall_01", url: roomMuseumSpecimenJarTall01Url, category: "room", sizeMeters: [0.918, 1.97, 0.918] },
  room_museum_gallery_bench: { modelKey: "room_museum_gallery_bench", url: roomMuseumGalleryBenchUrl, category: "room", sizeMeters: [1.6, 0.49, 0.42] },
  room_museum_archive_cabinet_drawers_brass: { modelKey: "room_museum_archive_cabinet_drawers_brass", url: roomMuseumArchiveCabinetDrawersBrassUrl, category: "room", sizeMeters: [0.6, 1.38, 0.758] },
  room_museum_sarcophagus_stone_bier: { modelKey: "room_museum_sarcophagus_stone_bier", url: roomMuseumSarcophagusStoneBierUrl, category: "room", sizeMeters: [2.4, 0.92, 1.16] },
  room_museum_statue_pedestal: { modelKey: "room_museum_statue_pedestal", url: roomMuseumStatuePedestalUrl, category: "room", sizeMeters: [0.736, 2.412, 0.736] },
  room_museum_rope_stanchion: { modelKey: "room_museum_rope_stanchion", url: roomMuseumRopeStanchionUrl, category: "room", sizeMeters: [1.84, 1.028, 0.34] },
  room_museum_info_lectern: { modelKey: "room_museum_info_lectern", url: roomMuseumInfoLecternUrl, category: "room", sizeMeters: [0.724, 0.915, 0.724] },
  room_museum_skeleton_mount: { modelKey: "room_museum_skeleton_mount", url: roomMuseumSkeletonMountUrl, category: "room", sizeMeters: [0.658, 2.205, 0.5] },
  room_museum_cloche_dome: { modelKey: "room_museum_cloche_dome", url: roomMuseumClocheDomeUrl, category: "room", sizeMeters: [0.683, 0.727, 0.683] },
  hp_furniture_museum_glass_display_case_v1: { modelKey: "hp_furniture_museum_glass_display_case_v1", url: hpFurnitureMuseumGlassDisplayCaseV1Url, category: "room", sizeMeters: [1.42, 2.03, 0.845] },
  hp_furniture_museum_horizontal_tool_case_v1: { modelKey: "hp_furniture_museum_horizontal_tool_case_v1", url: hpFurnitureMuseumHorizontalToolCaseV1Url, category: "room", sizeMeters: [2.36, 0.93, 0.82] },
  hp_furniture_museum_gallery_bench_v1: { modelKey: "hp_furniture_museum_gallery_bench_v1", url: hpFurnitureMuseumGalleryBenchV1Url, category: "room", sizeMeters: [2, 0.51, 0.48] },
  hp_furniture_archive_cabinet_v1: { modelKey: "hp_furniture_archive_cabinet_v1", url: hpFurnitureArchiveCabinetV1Url, category: "room", sizeMeters: [0.98, 1.64, 0.646] },
  hp_furniture_maintenance_cart_v1: { modelKey: "hp_furniture_maintenance_cart_v1", url: hpFurnitureMaintenanceCartV1Url, category: "room", sizeMeters: [1.092, 0.996, 0.685] },
  hp_furniture_display_plinth_v1: { modelKey: "hp_furniture_display_plinth_v1", url: hpFurnitureDisplayPlinthV1Url, category: "room", sizeMeters: [0.86, 0.928, 0.86] },
  hp_furniture_wall_archive_cabinet_v1: { modelKey: "hp_furniture_wall_archive_cabinet_v1", url: hpFurnitureWallArchiveCabinetV1Url, category: "room", sizeMeters: [1.28, 1.12, 0.278] },
  hp_furniture_lab_table_v1: { modelKey: "hp_furniture_lab_table_v1", url: hpFurnitureLabTableV1Url, category: "room", sizeMeters: [1.82, 0.944, 0.784] },
  hp_furniture_cold_ceiling_light_slot_v1: { modelKey: "hp_furniture_cold_ceiling_light_slot_v1", url: hpFurnitureColdCeilingLightSlotV1Url, category: "room", sizeMeters: [2.05, 0.15, 0.38] },
  hp_furniture_specimen_plinth_combo_v1: { modelKey: "hp_furniture_specimen_plinth_combo_v1", url: hpFurnitureSpecimenPlinthComboV1Url, category: "room", sizeMeters: [0.92, 1.366, 0.92] },
  room_l01_p01: { modelKey: "room_l01_p01", url: roomL01P01Url, category: "room", sizeMeters: [0.7, 2.012, 0.42] },
  room_l01_p02: { modelKey: "room_l01_p02", url: roomL01P02Url, category: "room", sizeMeters: [1.78, 1.378, 0.714] },
  room_l01_p03: { modelKey: "room_l01_p03", url: roomL01P03Url, category: "room", sizeMeters: [1.04, 2.025, 0.44] },
  room_l01_p04: { modelKey: "room_l01_p04", url: roomL01P04Url, category: "room", sizeMeters: [0.79, 1.12, 0.634] },
  room_l01_p05: { modelKey: "room_l01_p05", url: roomL01P05Url, category: "room", sizeMeters: [0.68, 2.129, 1.405] },
  room_l01_p06: { modelKey: "room_l01_p06", url: roomL01P06Url, category: "room", sizeMeters: [0.88, 1.377, 0.695] },
  room_l01_p07: { modelKey: "room_l01_p07", url: roomL01P07Url, category: "room", sizeMeters: [0.62, 2.01, 0.42] },
  room_l01_p08: { modelKey: "room_l01_p08", url: roomL01P08Url, category: "room", sizeMeters: [0.62, 1.63, 0.55] },
  room_l01_p09: { modelKey: "room_l01_p09", url: roomL01P09Url, category: "room", sizeMeters: [0.74, 2.181, 0.43] },
  room_l01_p10: { modelKey: "room_l01_p10", url: roomL01P10Url, category: "room", sizeMeters: [0.62, 0.81, 0.52] },
  room_l02_p01: { modelKey: "room_l02_p01", url: roomL02P01Url, category: "room", sizeMeters: [1.04, 1.63, 0.535] },
  room_l02_p02: { modelKey: "room_l02_p02", url: roomL02P02Url, category: "room", sizeMeters: [1.5, 1.95, 0.65] },
  room_l02_p03: { modelKey: "room_l02_p03", url: roomL02P03Url, category: "room", sizeMeters: [0.4, 0.95, 0.4] },
  room_l02_p04: { modelKey: "room_l02_p04", url: roomL02P04Url, category: "room", sizeMeters: [2.12, 0.865, 1.415] },
  room_l02_p05: { modelKey: "room_l02_p05", url: roomL02P05Url, category: "room", sizeMeters: [1.1, 1.23, 0.655] },
  room_l02_p06: { modelKey: "room_l02_p06", url: roomL02P06Url, category: "room", sizeMeters: [0.66, 2.11, 0.5] },
  room_l02_p07: { modelKey: "room_l02_p07", url: roomL02P07Url, category: "room", sizeMeters: [0.84, 1.48, 0.564] },
  room_l02_p08: { modelKey: "room_l02_p08", url: roomL02P08Url, category: "room", sizeMeters: [0.66, 1.622, 0.35] },
  room_l02_p09: { modelKey: "room_l02_p09", url: roomL02P09Url, category: "room", sizeMeters: [1.42, 2.295, 0.32] },
  room_l02_p10: { modelKey: "room_l02_p10", url: roomL02P10Url, category: "room", sizeMeters: [0.56, 0.925, 0.46] },
  room_l04_p01: { modelKey: "room_l04_p01", url: roomL04P01Url, category: "room", sizeMeters: [1.216, 1.69, 1.711] },
  room_l04_p02: { modelKey: "room_l04_p02", url: roomL04P02Url, category: "room", sizeMeters: [2.18, 2.04, 0.7] },
  room_l04_p03: { modelKey: "room_l04_p03", url: roomL04P03Url, category: "room", sizeMeters: [0.96, 1.94, 0.62] },
  room_l04_p04: { modelKey: "room_l04_p04", url: roomL04P04Url, category: "room", sizeMeters: [0.86, 1.885, 0.508] },
  room_l04_p05: { modelKey: "room_l04_p05", url: roomL04P05Url, category: "room", sizeMeters: [0.72, 2.305, 0.725] },
  room_l04_p06: { modelKey: "room_l04_p06", url: roomL04P06Url, category: "room", sizeMeters: [0.74, 2.112, 0.62] },
  room_l04_p07: { modelKey: "room_l04_p07", url: roomL04P07Url, category: "room", sizeMeters: [0.73, 1.595, 0.683] },
  room_l04_p08: { modelKey: "room_l04_p08", url: roomL04P08Url, category: "room", sizeMeters: [0.964, 2.11, 0.788] },
  room_l04_p09: { modelKey: "room_l04_p09", url: roomL04P09Url, category: "room", sizeMeters: [0.92, 1.434, 0.92] },
  room_l04_p10: { modelKey: "room_l04_p10", url: roomL04P10Url, category: "room", sizeMeters: [0.62, 1.72, 0.62] },
  room_l05_p01: { modelKey: "room_l05_p01", url: roomL05P01Url, category: "room", sizeMeters: [1.98, 2.335, 0.62] },
  room_l05_p02: { modelKey: "room_l05_p02", url: roomL05P02Url, category: "room", sizeMeters: [0.86, 2.385, 0.86] },
  room_l05_p03: { modelKey: "room_l05_p03", url: roomL05P03Url, category: "room", sizeMeters: [1.92, 1.81, 1.92] },
  room_l05_p04: { modelKey: "room_l05_p04", url: roomL05P04Url, category: "room", sizeMeters: [1.56, 1.96, 1.56] },
  room_l05_p05: { modelKey: "room_l05_p05", url: roomL05P05Url, category: "room", sizeMeters: [2, 2.07, 1.124] },
  room_l05_p06: { modelKey: "room_l05_p06", url: roomL05P06Url, category: "room", sizeMeters: [0.78, 1.505, 0.7] },
  room_l05_p07: { modelKey: "room_l05_p07", url: roomL05P07Url, category: "room", sizeMeters: [0.86, 1.3, 0.86] },
  room_l05_p08: { modelKey: "room_l05_p08", url: roomL05P08Url, category: "room", sizeMeters: [2.139, 0.86, 0.69] },
  room_l05_p09: { modelKey: "room_l05_p09", url: roomL05P09Url, category: "room", sizeMeters: [0.92, 1.802, 0.7] },
  room_l05_p10: { modelKey: "room_l05_p10", url: roomL05P10Url, category: "room", sizeMeters: [2.4, 2.39, 0.587] },
  room_l06_p01: { modelKey: "room_l06_p01", url: roomL06P01Url, category: "room", sizeMeters: [1.4, 1.33, 0.795] },
  room_l06_p02: { modelKey: "room_l06_p02", url: roomL06P02Url, category: "room", sizeMeters: [0.927, 0.858, 0.54] },
  room_l06_p03: { modelKey: "room_l06_p03", url: roomL06P03Url, category: "room", sizeMeters: [1.72, 2.002, 0.828] },
  room_l06_p04: { modelKey: "room_l06_p04", url: roomL06P04Url, category: "room", sizeMeters: [0.5, 2.125, 0.746] },
  room_l06_p05: { modelKey: "room_l06_p05", url: roomL06P05Url, category: "room", sizeMeters: [0.92, 1.955, 0.6] },
  room_l06_p06: { modelKey: "room_l06_p06", url: roomL06P06Url, category: "room", sizeMeters: [1.66, 0.107, 1.66] },
  room_l06_p07: { modelKey: "room_l06_p07", url: roomL06P07Url, category: "room", sizeMeters: [3.74, 1.35, 1.057] },
  room_l06_p08: { modelKey: "room_l06_p08", url: roomL06P08Url, category: "room", sizeMeters: [1.62, 2.085, 0.83] },
  room_l06_p09: { modelKey: "room_l06_p09", url: roomL06P09Url, category: "room", sizeMeters: [1.56, 1.705, 1.56] },
  room_l06_p10: { modelKey: "room_l06_p10", url: roomL06P10Url, category: "room", sizeMeters: [0.92, 2.02, 0.78] },
  room_l07_p01: { modelKey: "room_l07_p01", url: roomL07P01Url, category: "room", sizeMeters: [2.3, 2.37, 0.46] },
  room_l07_p02: { modelKey: "room_l07_p02", url: roomL07P02Url, category: "room", sizeMeters: [0.92, 2.15, 0.5] },
  room_l07_p03: { modelKey: "room_l07_p03", url: roomL07P03Url, category: "room", sizeMeters: [0.734, 2.083, 1.163] },
  room_l07_p04: { modelKey: "room_l07_p04", url: roomL07P04Url, category: "room", sizeMeters: [2.197, 1.463, 0.936] },
  room_l07_p05: { modelKey: "room_l07_p05", url: roomL07P05Url, category: "room", sizeMeters: [1.04, 2.01, 0.81] },
  room_l07_p06: { modelKey: "room_l07_p06", url: roomL07P06Url, category: "room", sizeMeters: [0.78, 1.375, 0.79] },
  room_l07_p07: { modelKey: "room_l07_p07", url: roomL07P07Url, category: "room", sizeMeters: [0.92, 2.19, 0.78] },
  room_l07_p08: { modelKey: "room_l07_p08", url: roomL07P08Url, category: "room", sizeMeters: [0.86, 1.277, 0.706] },
  room_l07_p09: { modelKey: "room_l07_p09", url: roomL07P09Url, category: "room", sizeMeters: [0.86, 1.027, 0.632] },
  room_l07_p10: { modelKey: "room_l07_p10", url: roomL07P10Url, category: "room", sizeMeters: [0.86, 1.528, 0.7] },
  room_l08_p01: { modelKey: "room_l08_p01", url: roomL08P01Url, category: "room", sizeMeters: [1, 2.085, 0.46] },
  room_l08_p02: { modelKey: "room_l08_p02", url: roomL08P02Url, category: "room", sizeMeters: [0.92, 2.355, 0.958] },
  room_l08_p03: { modelKey: "room_l08_p03", url: roomL08P03Url, category: "room", sizeMeters: [1.1, 1.94, 0.64] },
  room_l08_p04: { modelKey: "room_l08_p04", url: roomL08P04Url, category: "room", sizeMeters: [0.446, 1.02, 1.394] },
  room_l08_p05: { modelKey: "room_l08_p05", url: roomL08P05Url, category: "room", sizeMeters: [0.674, 1.615, 0.42] },
  room_l08_p06: { modelKey: "room_l08_p06", url: roomL08P06Url, category: "room", sizeMeters: [0.86, 2.3, 1.056] },
  room_l08_p07: { modelKey: "room_l08_p07", url: roomL08P07Url, category: "room", sizeMeters: [0.66, 1.513, 0.66] },
  room_l08_p08: { modelKey: "room_l08_p08", url: roomL08P08Url, category: "room", sizeMeters: [0.62, 1.37, 0.671] },
  room_l08_p09: { modelKey: "room_l08_p09", url: roomL08P09Url, category: "room", sizeMeters: [0.48, 2.004, 0.295] },
  room_l08_p10: { modelKey: "room_l08_p10", url: roomL08P10Url, category: "room", sizeMeters: [1.76, 2.33, 0.75] },
  room_l09_p01: { modelKey: "room_l09_p01", url: roomL09P01Url, category: "room", sizeMeters: [2.34, 2.27, 0.215] },
  room_l09_p02: { modelKey: "room_l09_p02", url: roomL09P02Url, category: "room", sizeMeters: [0.62, 1.495, 0.5] },
  room_l09_p03: { modelKey: "room_l09_p03", url: roomL09P03Url, category: "room", sizeMeters: [1.42, 1.73, 0.596] },
  room_l09_p04: { modelKey: "room_l09_p04", url: roomL09P04Url, category: "room", sizeMeters: [0.96, 1.83, 0.61] },
  room_l09_p05: { modelKey: "room_l09_p05", url: roomL09P05Url, category: "room", sizeMeters: [0.68, 1.49, 0.68] },
  room_l09_p06: { modelKey: "room_l09_p06", url: roomL09P06Url, category: "room", sizeMeters: [1.507, 2.24, 0.25] },
  room_l09_p07: { modelKey: "room_l09_p07", url: roomL09P07Url, category: "room", sizeMeters: [1.45, 0.795, 0.74] },
  room_l09_p08: { modelKey: "room_l09_p08", url: roomL09P08Url, category: "room", sizeMeters: [1.292, 2.105, 0.92] },
  room_l09_p09: { modelKey: "room_l09_p09", url: roomL09P09Url, category: "room", sizeMeters: [1.18, 1.765, 1.031] },
  room_l09_p10: { modelKey: "room_l09_p10", url: roomL09P10Url, category: "room", sizeMeters: [1.1, 1.19, 0.14] },
  room_l10_p01: { modelKey: "room_l10_p01", url: roomL10P01Url, category: "room", sizeMeters: [0.7, 2.212, 0.95] },
  room_l10_p02: { modelKey: "room_l10_p02", url: roomL10P02Url, category: "room", sizeMeters: [1.129, 0.97, 2.114] },
  room_l10_p03: { modelKey: "room_l10_p03", url: roomL10P03Url, category: "room", sizeMeters: [0.92, 1.99, 1.13] },
  room_l10_p04: { modelKey: "room_l10_p04", url: roomL10P04Url, category: "room", sizeMeters: [0.92, 2.115, 0.6] },
  room_l10_p05: { modelKey: "room_l10_p05", url: roomL10P05Url, category: "room", sizeMeters: [0.68, 2.086, 0.703] },
  room_l10_p06: { modelKey: "room_l10_p06", url: roomL10P06Url, category: "room", sizeMeters: [0.58, 1.063, 0.59] },
  room_l10_p07: { modelKey: "room_l10_p07", url: roomL10P07Url, category: "room", sizeMeters: [1.06, 1.89, 1.395] },
  room_l10_p08: { modelKey: "room_l10_p08", url: roomL10P08Url, category: "room", sizeMeters: [0.78, 1.69, 0.6] },
  room_l10_p09: { modelKey: "room_l10_p09", url: roomL10P09Url, category: "room", sizeMeters: [0.62, 1.93, 0.62] },
  room_l10_p10: { modelKey: "room_l10_p10", url: roomL10P10Url, category: "room", sizeMeters: [0.72, 1.965, 0.56] },
  switch_panel_floor_lever: {
    modelKey: "switch_panel_floor_lever",
    url: switchPanelFloorLeverUrl,
    category: "interaction",
    sizeMeters: [0.6, 0.75, 0.46],
  },
  switch_panel_wall_cyan: {
    modelKey: "switch_panel_wall_cyan",
    url: switchPanelWallCyanUrl,
    category: "interaction",
    sizeMeters: [0.7, 1.1, 0.18],
  },
  switch_panel_wall_red: {
    modelKey: "switch_panel_wall_red",
    url: switchPanelWallRedUrl,
    category: "interaction",
    sizeMeters: [0.7, 1.1, 0.18],
  },
  switch_state_light_amber: {
    modelKey: "switch_state_light_amber",
    url: switchStateLightAmberUrl,
    category: "interaction",
    sizeMeters: [0.32, 0.32, 0.12],
  },
  switch_state_light_cyan: {
    modelKey: "switch_state_light_cyan",
    url: switchStateLightCyanUrl,
    category: "interaction",
    sizeMeters: [0.32, 0.32, 0.12],
  },
  switch_state_light_red: {
    modelKey: "switch_state_light_red",
    url: switchStateLightRedUrl,
    category: "interaction",
    sizeMeters: [0.32, 0.32, 0.12],
  },
} as const satisfies EnvironmentModelRegistry;
