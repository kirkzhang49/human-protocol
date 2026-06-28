import type {
  BuilderLighting,
  BuilderProject,
  BuilderRoom,
  BuilderRoomStyle,
  BuilderSurfaceOverrides,
  BuilderSurfaceSlot,
  BuilderSurfaceRotation,
} from "./BuilderTypes";
import { builderSurfaceModelKeysForRoom } from "./official-bridge/SurfaceKitBridge";
// CC0 photo PBR maps (ambientCG, public-domain) for premium /build surfaces.
import woodColor from "../assets/textures/environment/builder-surfaces/wood_floor_color.webp";
import woodNormal from "../assets/textures/environment/builder-surfaces/wood_floor_normal.webp";
import woodRough from "../assets/textures/environment/builder-surfaces/wood_floor_rough.webp";
import whiteMarbleColor from "../assets/textures/environment/builder-surfaces/white_marble_color.webp";
import whiteMarbleNormal from "../assets/textures/environment/builder-surfaces/white_marble_normal.webp";
import whiteMarbleRough from "../assets/textures/environment/builder-surfaces/white_marble_rough.webp";
import darkMarbleColor from "../assets/textures/environment/builder-surfaces/dark_marble_color.webp";
import darkMarbleNormal from "../assets/textures/environment/builder-surfaces/dark_marble_normal.webp";
import darkMarbleRough from "../assets/textures/environment/builder-surfaces/dark_marble_rough.webp";
import hexColor from "../assets/textures/environment/builder-surfaces/hex_tile_color.webp";
import hexNormal from "../assets/textures/environment/builder-surfaces/hex_tile_normal.webp";
import hexRough from "../assets/textures/environment/builder-surfaces/hex_tile_rough.webp";
import stoneColor from "../assets/textures/environment/builder-surfaces/stone_pavers_color.webp";
import stoneNormal from "../assets/textures/environment/builder-surfaces/stone_pavers_normal.webp";
import stoneRough from "../assets/textures/environment/builder-surfaces/stone_pavers_rough.webp";
import brickColor from "../assets/textures/environment/builder-surfaces/brick_wall_color.webp";
import brickNormal from "../assets/textures/environment/builder-surfaces/brick_wall_normal.webp";
import brickRough from "../assets/textures/environment/builder-surfaces/brick_wall_rough.webp";
import concreteColor from "../assets/textures/environment/builder-surfaces/concrete_color.webp";
import concreteNormal from "../assets/textures/environment/builder-surfaces/concrete_normal.webp";
import concreteRough from "../assets/textures/environment/builder-surfaces/concrete_rough.webp";
import metalColor from "../assets/textures/environment/builder-surfaces/metal_plate_color.webp";
import metalNormal from "../assets/textures/environment/builder-surfaces/metal_plate_normal.webp";
import metalRough from "../assets/textures/environment/builder-surfaces/metal_plate_rough.webp";
import hpWallMuseumLimestonePanelColor from "../assets/textures/environment/builder-surfaces/hp_wall_museum_limestone_panel_color.webp";
import hpWallMuseumLimestonePanelNormal from "../assets/textures/environment/builder-surfaces/hp_wall_museum_limestone_panel_normal.webp";
import hpWallMuseumLimestonePanelRough from "../assets/textures/environment/builder-surfaces/hp_wall_museum_limestone_panel_rough.webp";
import hpWallMuseumBlackDisplayColor from "../assets/textures/environment/builder-surfaces/hp_wall_museum_black_display_color.webp";
import hpWallMuseumBlackDisplayNormal from "../assets/textures/environment/builder-surfaces/hp_wall_museum_black_display_normal.webp";
import hpWallMuseumBlackDisplayRough from "../assets/textures/environment/builder-surfaces/hp_wall_museum_black_display_rough.webp";
import hpWallMuseumBronzeReedColor from "../assets/textures/environment/builder-surfaces/hp_wall_museum_bronze_reed_color.webp";
import hpWallMuseumBronzeReedNormal from "../assets/textures/environment/builder-surfaces/hp_wall_museum_bronze_reed_normal.webp";
import hpWallMuseumBronzeReedRough from "../assets/textures/environment/builder-surfaces/hp_wall_museum_bronze_reed_rough.webp";
import hpWallFacilityGunmetalPanelColor from "../assets/textures/environment/builder-surfaces/hp_wall_facility_gunmetal_panel_color.webp";
import hpWallFacilityGunmetalPanelNormal from "../assets/textures/environment/builder-surfaces/hp_wall_facility_gunmetal_panel_normal.webp";
import hpWallFacilityGunmetalPanelRough from "../assets/textures/environment/builder-surfaces/hp_wall_facility_gunmetal_panel_rough.webp";
import hpWallGalleryFrostedPanelColor from "../assets/textures/environment/builder-surfaces/hp_wall_gallery_frosted_panel_color.webp";
import hpWallGalleryFrostedPanelNormal from "../assets/textures/environment/builder-surfaces/hp_wall_gallery_frosted_panel_normal.webp";
import hpWallGalleryFrostedPanelRough from "../assets/textures/environment/builder-surfaces/hp_wall_gallery_frosted_panel_rough.webp";
import hpWallMuseumTravertineSlabColor from "../assets/textures/environment/builder-surfaces/hp_wall_museum_travertine_slab_color.webp";
import hpWallMuseumTravertineSlabNormal from "../assets/textures/environment/builder-surfaces/hp_wall_museum_travertine_slab_normal.webp";
import hpWallMuseumTravertineSlabRough from "../assets/textures/environment/builder-surfaces/hp_wall_museum_travertine_slab_rough.webp";
import cc0FloorDarkSquareTileColor from "../assets/textures/environment/builder-surfaces/cc0_floor_dark_square_tile_color.webp";
import cc0FloorDarkSquareTileNormal from "../assets/textures/environment/builder-surfaces/cc0_floor_dark_square_tile_normal.webp";
import cc0FloorDarkSquareTileRough from "../assets/textures/environment/builder-surfaces/cc0_floor_dark_square_tile_rough.webp";
import cc0FloorGalleryStoneColor from "../assets/textures/environment/builder-surfaces/cc0_floor_gallery_stone_color.webp";
import cc0FloorGalleryStoneNormal from "../assets/textures/environment/builder-surfaces/cc0_floor_gallery_stone_normal.webp";
import cc0FloorGalleryStoneRough from "../assets/textures/environment/builder-surfaces/cc0_floor_gallery_stone_rough.webp";
import cc0FloorAgedRandomTileColor from "../assets/textures/environment/builder-surfaces/cc0_floor_aged_random_tile_color.webp";
import cc0FloorAgedRandomTileNormal from "../assets/textures/environment/builder-surfaces/cc0_floor_aged_random_tile_normal.webp";
import cc0FloorAgedRandomTileRough from "../assets/textures/environment/builder-surfaces/cc0_floor_aged_random_tile_rough.webp";
import cc0FloorCleanConcreteColor from "../assets/textures/environment/builder-surfaces/cc0_floor_clean_concrete_color.webp";
import cc0FloorCleanConcreteNormal from "../assets/textures/environment/builder-surfaces/cc0_floor_clean_concrete_normal.webp";
import cc0FloorCleanConcreteRough from "../assets/textures/environment/builder-surfaces/cc0_floor_clean_concrete_rough.webp";
import cc0FloorSmoothMetalColor from "../assets/textures/environment/builder-surfaces/cc0_floor_smooth_metal_color.webp";
import cc0FloorSmoothMetalNormal from "../assets/textures/environment/builder-surfaces/cc0_floor_smooth_metal_normal.webp";
import cc0FloorSmoothMetalRough from "../assets/textures/environment/builder-surfaces/cc0_floor_smooth_metal_rough.webp";
import cc0WallLevel02Plaster001FalseHomeV1Color from "../assets/textures/environment/builder-surfaces/cc0_wall_level02_plaster001_false_home_v1_color.webp";
import cc0WallLevel02Plaster001FalseHomeV1Normal from "../assets/textures/environment/builder-surfaces/cc0_wall_level02_plaster001_false_home_v1_normal.webp";
import cc0WallLevel02Plaster001FalseHomeV1Rough from "../assets/textures/environment/builder-surfaces/cc0_wall_level02_plaster001_false_home_v1_rough.webp";
import cc0CeilingLevel02Plaster003SoftPanelV1Color from "../assets/textures/environment/builder-surfaces/cc0_ceiling_level02_plaster003_soft_panel_v1_color.webp";
import cc0CeilingLevel02Plaster003SoftPanelV1Normal from "../assets/textures/environment/builder-surfaces/cc0_ceiling_level02_plaster003_soft_panel_v1_normal.webp";
import cc0CeilingLevel02Plaster003SoftPanelV1Rough from "../assets/textures/environment/builder-surfaces/cc0_ceiling_level02_plaster003_soft_panel_v1_rough.webp";
import hpCeilingMuseumCofferedLimestoneColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_coffered_limestone_color.webp";
import hpCeilingMuseumCofferedLimestoneNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_coffered_limestone_normal.webp";
import hpCeilingMuseumCofferedLimestoneRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_coffered_limestone_rough.webp";
import hpCeilingMuseumLimestoneCofferV2Color from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_limestone_coffer_v2_color.webp";
import hpCeilingMuseumLimestoneCofferV2Normal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_limestone_coffer_v2_normal.webp";
import hpCeilingMuseumLimestoneCofferV2Rough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_limestone_coffer_v2_rough.webp";
import hpCeilingMuseumFrostedSkylightV2Color from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_frosted_skylight_v2_color.webp";
import hpCeilingMuseumFrostedSkylightV2Normal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_frosted_skylight_v2_normal.webp";
import hpCeilingMuseumFrostedSkylightV2Rough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_frosted_skylight_v2_rough.webp";
import hpCeilingMuseumRotundaChandelierV1Color from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_rotunda_chandelier_v1_color.webp";
import hpCeilingMuseumRotundaChandelierV1Normal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_rotunda_chandelier_v1_normal.webp";
import hpCeilingMuseumRotundaChandelierV1Rough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_rotunda_chandelier_v1_rough.webp";
import hpCeilingMuseumLinearLightColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_linear_light_color.webp";
import hpCeilingMuseumLinearLightNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_linear_light_normal.webp";
import hpCeilingMuseumLinearLightRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_linear_light_rough.webp";
import hpCeilingMuseumBlackAcousticGridColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_black_acoustic_grid_color.webp";
import hpCeilingMuseumBlackAcousticGridNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_black_acoustic_grid_normal.webp";
import hpCeilingMuseumBlackAcousticGridRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_black_acoustic_grid_rough.webp";
import hpCeilingMuseumBronzeBaffleColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_bronze_baffle_color.webp";
import hpCeilingMuseumBronzeBaffleNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_bronze_baffle_normal.webp";
import hpCeilingMuseumBronzeBaffleRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_bronze_baffle_rough.webp";
import hpCeilingFacilityServiceRibsColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_facility_service_ribs_color.webp";
import hpCeilingFacilityServiceRibsNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_facility_service_ribs_normal.webp";
import hpCeilingFacilityServiceRibsRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_facility_service_ribs_rough.webp";
import hpCeilingCoreWarningPanelColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_core_warning_panel_color.webp";
import hpCeilingCoreWarningPanelNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_core_warning_panel_normal.webp";
import hpCeilingCoreWarningPanelRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_core_warning_panel_rough.webp";
import hpCeilingMuseumSkylightCofferColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_skylight_coffer_v1_color.webp";
import hpCeilingMuseumSkylightCofferNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_skylight_coffer_v1_normal.webp";
import hpCeilingMuseumSkylightCofferRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_skylight_coffer_v1_rough.webp";
import hpCeilingMuseumArchivalWoodCofferColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_archival_wood_coffer_v1_color.webp";
import hpCeilingMuseumArchivalWoodCofferNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_archival_wood_coffer_v1_normal.webp";
import hpCeilingMuseumArchivalWoodCofferRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_archival_wood_coffer_v1_rough.webp";
import hpCeilingMuseumBlackStarGridColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_black_star_grid_v1_color.webp";
import hpCeilingMuseumBlackStarGridNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_black_star_grid_v1_normal.webp";
import hpCeilingMuseumBlackStarGridRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_black_star_grid_v1_rough.webp";
import hpCeilingMuseumCoveLightPlasterColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_cove_light_plaster_v1_color.webp";
import hpCeilingMuseumCoveLightPlasterNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_cove_light_plaster_v1_normal.webp";
import hpCeilingMuseumCoveLightPlasterRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_cove_light_plaster_v1_rough.webp";
import hpCeilingMuseumLouveredLightWellColor from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_louvered_light_well_v1_color.webp";
import hpCeilingMuseumLouveredLightWellNormal from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_louvered_light_well_v1_normal.webp";
import hpCeilingMuseumLouveredLightWellRough from "../assets/textures/environment/builder-surfaces/hp_ceiling_museum_louvered_light_well_v1_rough.webp";
import image2CeilingMuseumRedrawCofferColor from "../assets/textures/environment/builder-surfaces/image2_ceiling_museum_redraw_coffer_v1_color.webp";
import image2CeilingMuseumRedrawCofferNormal from "../assets/textures/environment/builder-surfaces/image2_ceiling_museum_redraw_coffer_v1_normal.webp";
import image2CeilingMuseumRedrawCofferRough from "../assets/textures/environment/builder-surfaces/image2_ceiling_museum_redraw_coffer_v1_rough.webp";
import level01MaintenanceBayFloorColor from "../assets/textures/environment/hero-floors/level01_image2_maintenance_bay_room_fit_floor.png";
import level03MuseumFloorPremiumStoneColor from "../assets/textures/environment/level03/level03_image2_museum_floor_premium_stone_skin_v6.png";
import level03MuseumBlackGalleryWallColor from "../assets/textures/environment/level03/level03_image2_museum_black_gallery_wall_skin_v6.png";
import level03MuseumCeilingWarmPanelColor from "../assets/textures/environment/level03/level03_image2_museum_ceiling_warm_panel_skin_v6.png";
import level04MemoryClinicFloorImage2TileableV4Color from "../assets/textures/environment/builder-surfaces/level04_memory_clinic_floor_image2_tileable_v4_color.jpg";
import level04MemoryClinicWallImage2TileableV4Color from "../assets/textures/environment/builder-surfaces/level04_memory_clinic_wall_image2_tileable_v4_color.jpg";
import level04MemoryClinicCeilingImage2TileableV4Color from "../assets/textures/environment/builder-surfaces/level04_memory_clinic_ceiling_image2_tileable_v4_color.jpg";
import level05ReclamationFloorV4Color from "../assets/textures/environment/builder-surfaces/cc0_floor_level05_reclamation_metal_panel_v4_color.webp";
import level05ReclamationFloorV4Normal from "../assets/textures/environment/builder-surfaces/cc0_floor_level05_reclamation_metal_panel_v4_normal.webp";
import level05ReclamationFloorV4Rough from "../assets/textures/environment/builder-surfaces/cc0_floor_level05_reclamation_metal_panel_v4_rough.webp";
import level05ReclamationWallV4Color from "../assets/textures/environment/builder-surfaces/cc0_wall_level05_reclamation_graphite_panel_v4_color.webp";
import level05ReclamationWallV4Normal from "../assets/textures/environment/builder-surfaces/cc0_wall_level05_reclamation_graphite_panel_v4_normal.webp";
import level05ReclamationWallV4Rough from "../assets/textures/environment/builder-surfaces/cc0_wall_level05_reclamation_graphite_panel_v4_rough.webp";
import level05ReclamationCeilingV4Color from "../assets/textures/environment/builder-surfaces/cc0_ceiling_level05_reclamation_service_grid_v4_color.webp";
import level05ReclamationCeilingV4Normal from "../assets/textures/environment/builder-surfaces/cc0_ceiling_level05_reclamation_service_grid_v4_normal.webp";
import level05ReclamationCeilingV4Rough from "../assets/textures/environment/builder-surfaces/cc0_ceiling_level05_reclamation_service_grid_v4_rough.webp";

export type { BuilderLighting, BuilderRoomEnv, BuilderSurfaceRotation } from "./BuilderTypes";

// ---------------------------------------------------------------------------
// Surface presets (floors / walls / ceilings). The editor preview renders
// photo PBR maps directly; Raw playtest can consume their base-color texture as
// a material override while official shell kits keep owning the room geometry.
// ---------------------------------------------------------------------------

export type BuilderSurfacePattern =
  | "tile"
  | "metal"
  | "wood"
  | "hazard"
  | "stone"
  | "rubber"
  | "parquet"
  | "plate"
  | "labtile"
  | "route"
  | "panel"
  | "wainscot"
  | "glass"
  | "trim"
  | "marble"
  | "hex";

export interface BuilderSurfacePreset {
  id: string;
  kind: "floor" | "wall" | "ceiling";
  label: string;
  /** Base surface color (3D mesh tint + 2D pattern background). */
  color: string;
  /** Pattern detail color (2D pattern lines + swatch art). */
  accent: string;
  pattern: BuilderSurfacePattern;
  /** 3D material roughness hint. */
  roughness: number;
  /**
   * Optional CC0 photo PBR maps (webp URLs). When set, the 3D editor preview
   * renders the real texture instead of the procedural canvas pattern. Raw
   * builder playtest packs use `albedoUrl` as a base-color material layer and
   * keep `pattern`/`color` as the schematic fallback. `textureScale` = meters
   * covered by one tile.
   */
  albedoUrl?: string;
  normalUrl?: string;
  roughUrl?: string;
  textureScale?: number;
}

export interface BuilderRuntimeSurfaceModelKeys {
  floorModelKey: string;
  wallModelKey: string;
  ceilingModelKey: string;
}

export const builderFloorPresets: readonly BuilderSurfacePreset[] = [
  { id: "floor_sterile_tile", kind: "floor", label: "无菌蓝瓷砖", color: "#14222f", accent: "#64d7ff", pattern: "tile", roughness: 0.45 },
  { id: "floor_maintenance_metal", kind: "floor", label: "维修金属", color: "#17231f", accent: "#6fe3c2", pattern: "metal", roughness: 0.4 },
  { id: "floor_level01_maintenance_image2_v1", kind: "floor", label: "L1 旧维修舱地板", color: "#07100f", accent: "#8df6ff", pattern: "metal", roughness: 0.42, albedoUrl: level01MaintenanceBayFloorColor, textureScale: 5.2 },
  { id: "floor_residential_wood", kind: "floor", label: "居住木地板", color: "#261d12", accent: "#d8a86b", pattern: "wood", roughness: 0.7 },
  { id: "floor_hazard_stripe", kind: "floor", label: "警戒斜纹", color: "#231b10", accent: "#ffb34f", pattern: "hazard", roughness: 0.6 },
  { id: "floor_museum_stone", kind: "floor", label: "博物馆石板", color: "#1d2030", accent: "#b9c8ff", pattern: "stone", roughness: 0.55 },
  { id: "floor_dark_rubber", kind: "floor", label: "暗色橡胶", color: "#15171c", accent: "#5a6573", pattern: "rubber", roughness: 0.9 },
  { id: "floor_archive_parquet", kind: "floor", label: "档案拼花木地板", color: "#2a1d10", accent: "#c9a14f", pattern: "parquet", roughness: 0.62 },
  { id: "floor_plate_hazard", kind: "floor", label: "检修压花钢板", color: "#1d1a13", accent: "#ffb34f", pattern: "plate", roughness: 0.5 },
  { id: "floor_lab_tile_dark", kind: "floor", label: "暗色实验地砖", color: "#11171d", accent: "#46586a", pattern: "labtile", roughness: 0.42 },
  { id: "floor_museum_route", kind: "floor", label: "导览石路地面", color: "#1b1f2c", accent: "#7ff2ff", pattern: "route", roughness: 0.55 },
  { id: "floor_memory_clinic_tile", kind: "floor", label: "记忆诊所瓷板", color: "#dbe5e3", accent: "#7ff2ff", pattern: "labtile", roughness: 0.46 },
  { id: "floor_reclamation_core_metal", kind: "floor", label: "回收核心金属地面", color: "#121014", accent: "#ff5b4c", pattern: "plate", roughness: 0.42 },
  // --- Art-direction floor presets (richer palettes / new patterns) ----------
  { id: "floor_white_marble", kind: "floor", label: "白纹大理石", color: "#cdd3de", accent: "#8893a8", pattern: "marble", roughness: 0.3 },
  { id: "floor_black_gold_marble", kind: "floor", label: "黑金大理石", color: "#14130f", accent: "#d4af37", pattern: "marble", roughness: 0.34 },
  { id: "floor_charcoal_hex", kind: "floor", label: "深灰六角砖", color: "#16191f", accent: "#7ea0b8", pattern: "hex", roughness: 0.5 },
  { id: "floor_terracotta_hex", kind: "floor", label: "赤陶六角砖", color: "#2a1812", accent: "#e0895a", pattern: "hex", roughness: 0.62 },
  { id: "floor_walnut_parquet", kind: "floor", label: "胡桃木拼花", color: "#2a1a0e", accent: "#e0b074", pattern: "parquet", roughness: 0.6 },
  { id: "floor_emerald_terrazzo", kind: "floor", label: "翡翠水磨石", color: "#15241f", accent: "#6fe3c2", pattern: "labtile", roughness: 0.42 },
  // --- Photo PBR floors (CC0; render as real textures in the 3D preview) -----
  { id: "floor_photo_wood", kind: "floor", label: "实木地板·照片", color: "#3a2a18", accent: "#d8a86b", pattern: "wood", roughness: 0.62, albedoUrl: woodColor, normalUrl: woodNormal, roughUrl: woodRough, textureScale: 2.4 },
  { id: "floor_level02_false_home_walnut_v1", kind: "floor", label: "L2 假住宅胡桃木地板", color: "#2c2015", accent: "#d8a86b", pattern: "wood", roughness: 0.62, albedoUrl: woodColor, normalUrl: woodNormal, roughUrl: woodRough, textureScale: 2.2 },
  { id: "floor_photo_marble", kind: "floor", label: "白大理石·照片", color: "#c8cdd6", accent: "#8893a8", pattern: "marble", roughness: 0.3, albedoUrl: whiteMarbleColor, normalUrl: whiteMarbleNormal, roughUrl: whiteMarbleRough, textureScale: 3 },
  { id: "floor_photo_hex", kind: "floor", label: "六角砖·照片", color: "#2a2622", accent: "#7ea0b8", pattern: "hex", roughness: 0.5, albedoUrl: hexColor, normalUrl: hexNormal, roughUrl: hexRough, textureScale: 1.4 },
  { id: "floor_photo_stone", kind: "floor", label: "石板路面·照片", color: "#2a2824", accent: "#b9c8ff", pattern: "stone", roughness: 0.6, albedoUrl: stoneColor, normalUrl: stoneNormal, roughUrl: stoneRough, textureScale: 2.6 },
  { id: "floor_cc0_dark_square_tile", kind: "floor", label: "黑石方砖·照片", color: "#17191c", accent: "#6f7c86", pattern: "tile", roughness: 0.62, albedoUrl: cc0FloorDarkSquareTileColor, normalUrl: cc0FloorDarkSquareTileNormal, roughUrl: cc0FloorDarkSquareTileRough, textureScale: 1.6 },
  { id: "floor_cc0_gallery_stone", kind: "floor", label: "展厅石纹地面·照片", color: "#635649", accent: "#c1ab8a", pattern: "marble", roughness: 0.5, albedoUrl: cc0FloorGalleryStoneColor, normalUrl: cc0FloorGalleryStoneNormal, roughUrl: cc0FloorGalleryStoneRough, textureScale: 2.8 },
  { id: "floor_cc0_aged_random_tile", kind: "floor", label: "旧随机石砖·照片", color: "#202326", accent: "#7a6a50", pattern: "stone", roughness: 0.7, albedoUrl: cc0FloorAgedRandomTileColor, normalUrl: cc0FloorAgedRandomTileNormal, roughUrl: cc0FloorAgedRandomTileRough, textureScale: 2.2 },
  { id: "floor_cc0_clean_concrete", kind: "floor", label: "洁净混凝土地面·照片", color: "#b4aa96", accent: "#7e8a8f", pattern: "panel", roughness: 0.76, albedoUrl: cc0FloorCleanConcreteColor, normalUrl: cc0FloorCleanConcreteNormal, roughUrl: cc0FloorCleanConcreteRough, textureScale: 3 },
  { id: "floor_cc0_smooth_metal", kind: "floor", label: "平滑金属地面·照片", color: "#8b9aa6", accent: "#d2e8ff", pattern: "metal", roughness: 0.42, albedoUrl: cc0FloorSmoothMetalColor, normalUrl: cc0FloorSmoothMetalNormal, roughUrl: cc0FloorSmoothMetalRough, textureScale: 2 },
  { id: "floor_level03_museum_premium_stone_shell", kind: "floor", label: "L3 官卡黑钛石展厅地面", color: "#181715", accent: "#c9a253", pattern: "marble", roughness: 0.44, albedoUrl: level03MuseumFloorPremiumStoneColor, textureScale: 3 },
  { id: "floor_level04_memory_clinic_lab_image2_tileable_v4", kind: "floor", label: "L4 Image2 记忆诊所地板", color: "#cfdeda", accent: "#7ff2ff", pattern: "labtile", roughness: 0.5, albedoUrl: level04MemoryClinicFloorImage2TileableV4Color, textureScale: 2.8 },
  { id: "floor_level05_reclamation_cc0_metal_panel_v4", kind: "floor", label: "L5 V4 回收核心金属地面", color: "#070a0d", accent: "#66e5ef", pattern: "plate", roughness: 0.46, albedoUrl: level05ReclamationFloorV4Color, normalUrl: level05ReclamationFloorV4Normal, roughUrl: level05ReclamationFloorV4Rough, textureScale: 3.2 },
];

export const builderWallPresets: readonly BuilderSurfacePreset[] = [
  { id: "wall_sterile_panel", kind: "wall", label: "无菌墙板", color: "#1d2c40", accent: "#64d7ff", pattern: "tile", roughness: 0.6 },
  { id: "wall_maintenance_metal", kind: "wall", label: "维修金属墙", color: "#1c2b27", accent: "#6fe3c2", pattern: "metal", roughness: 0.45 },
  { id: "wall_level01_maintenance_gunmetal_v1", kind: "wall", label: "L1 旧维修舱墙板", color: "#101917", accent: "#8df6ff", pattern: "panel", roughness: 0.54, albedoUrl: hpWallFacilityGunmetalPanelColor, normalUrl: hpWallFacilityGunmetalPanelNormal, roughUrl: hpWallFacilityGunmetalPanelRough, textureScale: 2.6 },
  { id: "wall_residential_wood", kind: "wall", label: "居住木墙", color: "#2d2418", accent: "#d8a86b", pattern: "wood", roughness: 0.75 },
  { id: "wall_hazard_stripe", kind: "wall", label: "警戒斜纹墙", color: "#2b2214", accent: "#ffb34f", pattern: "hazard", roughness: 0.6 },
  { id: "wall_museum_stone", kind: "wall", label: "博物馆石墙", color: "#242838", accent: "#b9c8ff", pattern: "stone", roughness: 0.55 },
  { id: "wall_dark_rubber", kind: "wall", label: "暗色橡胶墙", color: "#1a1d23", accent: "#5a6573", pattern: "rubber", roughness: 0.9 },
  { id: "wall_dark_metal_panel", kind: "wall", label: "暗金属拼板", color: "#171b21", accent: "#6f86a8", pattern: "panel", roughness: 0.46 },
  { id: "wall_archive_warm", kind: "wall", label: "暖木护墙板", color: "#2e2114", accent: "#c9a14f", pattern: "wainscot", roughness: 0.68 },
  { id: "wall_observation_glass", kind: "wall", label: "观察玻璃墙", color: "#0e1b22", accent: "#54f1ff", pattern: "glass", roughness: 0.18 },
  { id: "wall_hazard_trim", kind: "wall", label: "警示饰带墙", color: "#20242b", accent: "#ffb34f", pattern: "trim", roughness: 0.58 },
  { id: "wall_clean_lab", kind: "wall", label: "洁净实验墙", color: "#202c3a", accent: "#9fc1e8", pattern: "labtile", roughness: 0.4 },
  { id: "wall_memory_clinic_panel", kind: "wall", label: "记忆诊所墙板", color: "#23343a", accent: "#9ff3ff", pattern: "labtile", roughness: 0.42 },
  { id: "wall_reclamation_core_panel", kind: "wall", label: "回收核心墙板", color: "#21191e", accent: "#ff5b4c", pattern: "panel", roughness: 0.38 },
  // --- Art-direction wall presets (richer palettes / new patterns) -----------
  { id: "wall_gallery_warm", kind: "wall", label: "暖光展厅墙", color: "#2a2118", accent: "#ffcf8a", pattern: "wainscot", roughness: 0.66 },
  { id: "wall_raw_concrete", kind: "wall", label: "清水混凝土墙", color: "#24262b", accent: "#818892", pattern: "panel", roughness: 0.82 },
  { id: "wall_black_gold_flute", kind: "wall", label: "黑金竖纹墙", color: "#15130f", accent: "#d4af37", pattern: "wainscot", roughness: 0.4 },
  { id: "wall_neon_grid", kind: "wall", label: "霓虹格栅墙", color: "#0c1622", accent: "#54f1ff", pattern: "glass", roughness: 0.2 },
  { id: "wall_blue_marble", kind: "wall", label: "深蓝大理石墙", color: "#161d2e", accent: "#9fb6ff", pattern: "marble", roughness: 0.3 },
  { id: "wall_crimson_drape", kind: "wall", label: "暗红绒幕墙", color: "#251215", accent: "#ff7a5c", pattern: "trim", roughness: 0.7 },
  // --- Photo PBR walls (CC0; render as real textures in the 3D preview) ------
  { id: "wall_photo_brick", kind: "wall", label: "红砖墙·照片", color: "#3a2620", accent: "#c98a6a", pattern: "stone", roughness: 0.82, albedoUrl: brickColor, normalUrl: brickNormal, roughUrl: brickRough, textureScale: 2.2 },
  { id: "wall_photo_concrete", kind: "wall", label: "清水混凝土·照片", color: "#3a3c40", accent: "#818892", pattern: "panel", roughness: 0.85, albedoUrl: concreteColor, normalUrl: concreteNormal, roughUrl: concreteRough, textureScale: 3 },
  { id: "wall_photo_marble", kind: "wall", label: "大理石墙·照片", color: "#2a2620", accent: "#d4af37", pattern: "marble", roughness: 0.32, albedoUrl: darkMarbleColor, normalUrl: darkMarbleNormal, roughUrl: darkMarbleRough, textureScale: 3 },
  { id: "wall_photo_metal", kind: "wall", label: "金属板墙·照片", color: "#2c3036", accent: "#8fa6c8", pattern: "metal", roughness: 0.45, albedoUrl: metalColor, normalUrl: metalNormal, roughUrl: metalRough, textureScale: 1.5 },
  { id: "wall_level02_false_home_plaster_v1", kind: "wall", label: "L2 假住宅细灰泥墙", color: "#7e705c", accent: "#d7b57a", pattern: "wainscot", roughness: 0.78, albedoUrl: cc0WallLevel02Plaster001FalseHomeV1Color, normalUrl: cc0WallLevel02Plaster001FalseHomeV1Normal, roughUrl: cc0WallLevel02Plaster001FalseHomeV1Rough, textureScale: 3 },
  { id: "wall_hp_museum_limestone_panel", kind: "wall", label: "HP 博物馆石灰石大板", color: "#b8b09e", accent: "#e0d4b9", pattern: "panel", roughness: 0.68, albedoUrl: hpWallMuseumLimestonePanelColor, normalUrl: hpWallMuseumLimestonePanelNormal, roughUrl: hpWallMuseumLimestonePanelRough, textureScale: 3.2 },
  { id: "wall_hp_museum_black_display", kind: "wall", label: "HP 黑色展墙", color: "#15171b", accent: "#97743e", pattern: "trim", roughness: 0.82, albedoUrl: hpWallMuseumBlackDisplayColor, normalUrl: hpWallMuseumBlackDisplayNormal, roughUrl: hpWallMuseumBlackDisplayRough, textureScale: 2.8 },
  { id: "wall_hp_museum_bronze_reed", kind: "wall", label: "HP 青铜竖格栅墙", color: "#6f5430", accent: "#d4af6a", pattern: "wainscot", roughness: 0.46, albedoUrl: hpWallMuseumBronzeReedColor, normalUrl: hpWallMuseumBronzeReedNormal, roughUrl: hpWallMuseumBronzeReedRough, textureScale: 2.1 },
  { id: "wall_hp_facility_gunmetal_panel", kind: "wall", label: "HP 枪灰设施拼板墙", color: "#2d343a", accent: "#9fb6c4", pattern: "panel", roughness: 0.52, albedoUrl: hpWallFacilityGunmetalPanelColor, normalUrl: hpWallFacilityGunmetalPanelNormal, roughUrl: hpWallFacilityGunmetalPanelRough, textureScale: 2.4 },
  { id: "wall_hp_gallery_frosted_panel", kind: "wall", label: "HP 磨砂玻璃展墙", color: "#b8cdcf", accent: "#7ff2ff", pattern: "glass", roughness: 0.34, albedoUrl: hpWallGalleryFrostedPanelColor, normalUrl: hpWallGalleryFrostedPanelNormal, roughUrl: hpWallGalleryFrostedPanelRough, textureScale: 2.6 },
  { id: "wall_hp_museum_travertine_slab", kind: "wall", label: "HP 洞石展厅墙", color: "#a08b72", accent: "#dcb982", pattern: "marble", roughness: 0.58, albedoUrl: hpWallMuseumTravertineSlabColor, normalUrl: hpWallMuseumTravertineSlabNormal, roughUrl: hpWallMuseumTravertineSlabRough, textureScale: 3 },
  { id: "wall_level03_museum_black_gallery_shell", kind: "wall", label: "L3 官卡黑金展墙", color: "#15171b", accent: "#97743e", pattern: "trim", roughness: 0.82, albedoUrl: level03MuseumBlackGalleryWallColor, textureScale: 2.8 },
  { id: "wall_level04_memory_clinic_lab_image2_tileable_v4", kind: "wall", label: "L4 Image2 记忆诊所墙壁", color: "#28484e", accent: "#8df6ff", pattern: "labtile", roughness: 0.48, albedoUrl: level04MemoryClinicWallImage2TileableV4Color, textureScale: 3 },
  { id: "wall_level05_reclamation_cc0_graphite_panel_v4", kind: "wall", label: "L5 V4 回收核心石墨墙板", color: "#080b0e", accent: "#70e7ef", pattern: "panel", roughness: 0.54, albedoUrl: level05ReclamationWallV4Color, normalUrl: level05ReclamationWallV4Normal, roughUrl: level05ReclamationWallV4Rough, textureScale: 3 },
];

export const builderCeilingPresets: readonly BuilderSurfacePreset[] = [
  { id: "ceiling_clean_lab_panel", kind: "ceiling", label: "洁净实验顶板", color: "#1c2a36", accent: "#9fc1e8", pattern: "panel", roughness: 0.48 },
  { id: "ceiling_service_panel", kind: "ceiling", label: "维修服务顶板", color: "#1b2724", accent: "#6fe3c2", pattern: "metal", roughness: 0.5 },
  { id: "ceiling_level01_maintenance_service_ribs_v1", kind: "ceiling", label: "L1 旧维修舱天花", color: "#07100f", accent: "#8df6ff", pattern: "metal", roughness: 0.56, albedoUrl: hpCeilingFacilityServiceRibsColor, normalUrl: hpCeilingFacilityServiceRibsNormal, roughUrl: hpCeilingFacilityServiceRibsRough, textureScale: 2.3 },
  { id: "ceiling_dark_museum_panel", kind: "ceiling", label: "暗色展厅顶板", color: "#191d2a", accent: "#b9c8ff", pattern: "panel", roughness: 0.55 },
  { id: "ceiling_memory_clinic_tile", kind: "ceiling", label: "记忆诊所顶板", color: "#d6e1df", accent: "#7ff2ff", pattern: "labtile", roughness: 0.46 },
  { id: "ceiling_reclamation_core_plate", kind: "ceiling", label: "回收核心顶板", color: "#171216", accent: "#ff5b4c", pattern: "plate", roughness: 0.42 },
  { id: "ceiling_level02_false_home_plaster_v1", kind: "ceiling", label: "L2 假住宅暖白石膏顶", color: "#8e8474", accent: "#79d7df", pattern: "panel", roughness: 0.62, albedoUrl: cc0CeilingLevel02Plaster003SoftPanelV1Color, normalUrl: cc0CeilingLevel02Plaster003SoftPanelV1Normal, roughUrl: cc0CeilingLevel02Plaster003SoftPanelV1Rough, textureScale: 3 },
  { id: "ceiling_hp_museum_limestone_coffer_v2", kind: "ceiling", label: "HP 博物馆石材藻井顶", color: "#bfb69f", accent: "#d8b46a", pattern: "panel", roughness: 0.68, albedoUrl: hpCeilingMuseumLimestoneCofferV2Color, normalUrl: hpCeilingMuseumLimestoneCofferV2Normal, roughUrl: hpCeilingMuseumLimestoneCofferV2Rough, textureScale: 3.1 },
  { id: "ceiling_hp_museum_frosted_skylight_v2", kind: "ceiling", label: "HP 博物馆磨砂天窗顶", color: "#9eb8b6", accent: "#9df0ef", pattern: "glass", roughness: 0.34, albedoUrl: hpCeilingMuseumFrostedSkylightV2Color, normalUrl: hpCeilingMuseumFrostedSkylightV2Normal, roughUrl: hpCeilingMuseumFrostedSkylightV2Rough, textureScale: 3 },
  { id: "ceiling_hp_museum_rotunda_chandelier_v1", kind: "ceiling", label: "HP 博物馆圆厅柔光顶", color: "#b4aa96", accent: "#d3a861", pattern: "trim", roughness: 0.6, albedoUrl: hpCeilingMuseumRotundaChandelierV1Color, normalUrl: hpCeilingMuseumRotundaChandelierV1Normal, roughUrl: hpCeilingMuseumRotundaChandelierV1Rough, textureScale: 2.6 },
  { id: "ceiling_hp_museum_coffered_limestone", kind: "ceiling", label: "HP 博物馆石膏格顶", color: "#b9b4a6", accent: "#e0d4b9", pattern: "panel", roughness: 0.66, albedoUrl: hpCeilingMuseumCofferedLimestoneColor, normalUrl: hpCeilingMuseumCofferedLimestoneNormal, roughUrl: hpCeilingMuseumCofferedLimestoneRough, textureScale: 3 },
  { id: "ceiling_hp_museum_linear_light", kind: "ceiling", label: "HP 展厅线性灯顶", color: "#aeb8b7", accent: "#7ff2ff", pattern: "trim", roughness: 0.42, albedoUrl: hpCeilingMuseumLinearLightColor, normalUrl: hpCeilingMuseumLinearLightNormal, roughUrl: hpCeilingMuseumLinearLightRough, textureScale: 2.6 },
  { id: "ceiling_hp_museum_black_acoustic_grid", kind: "ceiling", label: "HP 黑色吸音格顶", color: "#171a1e", accent: "#8da4c4", pattern: "tile", roughness: 0.86, albedoUrl: hpCeilingMuseumBlackAcousticGridColor, normalUrl: hpCeilingMuseumBlackAcousticGridNormal, roughUrl: hpCeilingMuseumBlackAcousticGridRough, textureScale: 2.4 },
  { id: "ceiling_hp_museum_bronze_baffle", kind: "ceiling", label: "HP 青铜线性格栅顶", color: "#6f5430", accent: "#d4af6a", pattern: "wainscot", roughness: 0.48, albedoUrl: hpCeilingMuseumBronzeBaffleColor, normalUrl: hpCeilingMuseumBronzeBaffleNormal, roughUrl: hpCeilingMuseumBronzeBaffleRough, textureScale: 2.1 },
  { id: "ceiling_hp_facility_service_ribs", kind: "ceiling", label: "HP 设施管线肋顶", color: "#2a3034", accent: "#9fb6c4", pattern: "metal", roughness: 0.56, albedoUrl: hpCeilingFacilityServiceRibsColor, normalUrl: hpCeilingFacilityServiceRibsNormal, roughUrl: hpCeilingFacilityServiceRibsRough, textureScale: 2.3 },
  { id: "ceiling_hp_core_warning_panel", kind: "ceiling", label: "HP 核心警戒顶板", color: "#3c2d1e", accent: "#ffd34f", pattern: "hazard", roughness: 0.64, albedoUrl: hpCeilingCoreWarningPanelColor, normalUrl: hpCeilingCoreWarningPanelNormal, roughUrl: hpCeilingCoreWarningPanelRough, textureScale: 2.4 },
  { id: "ceiling_hp_museum_skylight_coffer_v1", kind: "ceiling", label: "HP 博物馆天窗格顶", color: "#8fa0a0", accent: "#a6eef4", pattern: "glass", roughness: 0.36, albedoUrl: hpCeilingMuseumSkylightCofferColor, normalUrl: hpCeilingMuseumSkylightCofferNormal, roughUrl: hpCeilingMuseumSkylightCofferRough, textureScale: 3.2 },
  { id: "ceiling_hp_museum_archival_wood_coffer_v1", kind: "ceiling", label: "HP 档案木格顶", color: "#3f2d1b", accent: "#cc9c4e", pattern: "wood", roughness: 0.62, albedoUrl: hpCeilingMuseumArchivalWoodCofferColor, normalUrl: hpCeilingMuseumArchivalWoodCofferNormal, roughUrl: hpCeilingMuseumArchivalWoodCofferRough, textureScale: 2.8 },
  { id: "ceiling_hp_museum_black_star_grid_v1", kind: "ceiling", label: "HP 黑金星点格顶", color: "#121316", accent: "#d4af6a", pattern: "tile", roughness: 0.74, albedoUrl: hpCeilingMuseumBlackStarGridColor, normalUrl: hpCeilingMuseumBlackStarGridNormal, roughUrl: hpCeilingMuseumBlackStarGridRough, textureScale: 2.2 },
  { id: "ceiling_hp_museum_cove_light_plaster_v1", kind: "ceiling", label: "HP 洗墙灯槽石膏顶", color: "#aaa397", accent: "#7ee8ef", pattern: "trim", roughness: 0.58, albedoUrl: hpCeilingMuseumCoveLightPlasterColor, normalUrl: hpCeilingMuseumCoveLightPlasterNormal, roughUrl: hpCeilingMuseumCoveLightPlasterRough, textureScale: 3 },
  { id: "ceiling_hp_museum_louvered_light_well_v1", kind: "ceiling", label: "HP 百叶光井顶", color: "#4a453a", accent: "#d4af6a", pattern: "wainscot", roughness: 0.48, albedoUrl: hpCeilingMuseumLouveredLightWellColor, normalUrl: hpCeilingMuseumLouveredLightWellNormal, roughUrl: hpCeilingMuseumLouveredLightWellRough, textureScale: 2.4 },
  { id: "ceiling_image2_museum_redraw_coffer_v1", kind: "ceiling", label: "Image2 博物馆黑金藻井顶", color: "#161511", accent: "#d6a253", pattern: "trim", roughness: 0.58, albedoUrl: image2CeilingMuseumRedrawCofferColor, normalUrl: image2CeilingMuseumRedrawCofferNormal, roughUrl: image2CeilingMuseumRedrawCofferRough, textureScale: 3 },
  { id: "ceiling_level03_museum_warm_panel_shell", kind: "ceiling", label: "L3 官卡暖白格顶", color: "#b9b4a6", accent: "#d6a253", pattern: "panel", roughness: 0.66, albedoUrl: level03MuseumCeilingWarmPanelColor, textureScale: 3 },
  { id: "ceiling_level04_memory_clinic_lab_image2_tileable_v4", kind: "ceiling", label: "L4 Image2 记忆诊所天花", color: "#d6e0dc", accent: "#7ff2ff", pattern: "labtile", roughness: 0.54, albedoUrl: level04MemoryClinicCeilingImage2TileableV4Color, textureScale: 2.8 },
  { id: "ceiling_level05_reclamation_cc0_service_grid_v4", kind: "ceiling", label: "L5 V4 回收核心服务格顶", color: "#05070a", accent: "#7feeff", pattern: "metal", roughness: 0.58, albedoUrl: level05ReclamationCeilingV4Color, normalUrl: level05ReclamationCeilingV4Normal, roughUrl: level05ReclamationCeilingV4Rough, textureScale: 2.6 },
];

const presetsById = new Map([...builderFloorPresets, ...builderWallPresets, ...builderCeilingPresets].map((preset) => [preset.id, preset]));
const legacyPresetAliases: Readonly<Record<string, string>> = {
  wall_cc0_concrete_clean: "wall_hp_museum_limestone_panel",
  wall_cc0_concrete_fluted: "wall_hp_museum_limestone_panel",
  wall_cc0_bunker_panel: "wall_hp_facility_gunmetal_panel",
  wall_cc0_aged_plaster: "wall_hp_museum_black_display",
  wall_cc0_industrial_brick: "wall_photo_brick",
  wall_cc0_dark_corrugated_steel: "wall_hp_facility_gunmetal_panel",
  wall_cc0_bare_corrugated_steel: "wall_hp_facility_gunmetal_panel",
  wall_cc0_patina_painted_metal: "wall_hp_museum_black_display",
  wall_cc0_wave_concrete: "wall_hp_museum_limestone_panel",
  wall_cc0_museum_clean_plaster: "wall_hp_museum_limestone_panel",
  wall_cc0_museum_stone_tile: "wall_hp_museum_travertine_slab",
  ceiling_cc0_office_clean: "ceiling_hp_museum_coffered_limestone",
  ceiling_cc0_service_tile: "ceiling_hp_facility_service_ribs",
  ceiling_cc0_acoustic_clinic: "ceiling_hp_museum_black_acoustic_grid",
  ceiling_cc0_maintenance_panel: "ceiling_hp_facility_service_ribs",
  ceiling_cc0_museum_backroom: "ceiling_hp_museum_linear_light",
  ceiling_cc0_dark_corrugated_steel: "ceiling_hp_facility_service_ribs",
  ceiling_cc0_bare_corrugated_steel: "ceiling_hp_facility_service_ribs",
  ceiling_cc0_wave_concrete: "ceiling_hp_museum_coffered_limestone",
  ceiling_cc0_patina_painted_metal: "ceiling_hp_museum_black_acoustic_grid",
  ceiling_cc0_hazard_stripe_metal: "ceiling_hp_core_warning_panel",
  ceiling_cc0_museum_clean_plaster: "ceiling_image2_museum_redraw_coffer_v1",
  ceiling_cc0_museum_stone_tile: "ceiling_image2_museum_redraw_coffer_v1",
};

export function surfacePreset(id: string | undefined, fallback: BuilderSurfacePreset): BuilderSurfacePreset {
  return (id ? presetsById.get(id) ?? presetsById.get(legacyPresetAliases[id] ?? "") : undefined) ?? fallback;
}

/** Default presets per room style so old projects keep their current look. */
const styleFloorDefault: Record<BuilderRoomStyle, string> = {
  sterile: "floor_sterile_tile",
  maintenance: "floor_maintenance_metal",
  residential: "floor_residential_wood",
  hazard: "floor_hazard_stripe",
  exit: "floor_dark_rubber",
  museum: "floor_museum_stone",
  core: "floor_lab_tile_dark",
};

const styleWallDefault: Record<BuilderRoomStyle, string> = {
  sterile: "wall_sterile_panel",
  maintenance: "wall_maintenance_metal",
  residential: "wall_residential_wood",
  hazard: "wall_hazard_stripe",
  exit: "wall_dark_rubber",
  museum: "wall_museum_stone",
  core: "wall_dark_metal_panel",
};

// ---------------------------------------------------------------------------
// Effective per-room environment (env fields are optional → old drafts load
// with style-derived defaults)
// ---------------------------------------------------------------------------

// Walls/ceiling raised ~20% (2.8 → 3.36) so /build rooms feel less cramped.
export const defaultWallHeight = 3.36;
export const defaultCeilingHeight = 3.36;

export interface EffectiveFloor {
  preset: BuilderSurfacePreset;
  color: string;
  scale: number;
  rotation: BuilderSurfaceRotation;
}

export interface EffectiveWall {
  preset: BuilderSurfacePreset;
  color: string;
  height: number;
}

export interface EffectiveCeiling {
  visible: boolean;
  height: number;
  preset: BuilderSurfacePreset;
  color: string;
}

export interface BuilderRuntimeSurfaceTextureOverride {
  slot: BuilderSurfaceSlot;
  preset: BuilderSurfacePreset;
  color: string;
  albedoUrl: string;
}

export function roomFloor(room: BuilderRoom): EffectiveFloor {
  const preset = surfacePreset(room.env?.floorPresetId ?? styleFloorDefault[room.style], builderFloorPresets[0]);
  return {
    preset,
    color: room.env?.floorColor ?? preset.color,
    scale: clamp(room.env?.floorScale ?? 1, 0.5, 3),
    rotation: room.env?.floorRotation ?? 0,
  };
}

export function roomWall(room: BuilderRoom): EffectiveWall {
  const preset = surfacePreset(room.env?.wallPresetId ?? styleWallDefault[room.style], builderWallPresets[0]);
  return {
    preset,
    color: room.env?.wallColor ?? preset.color,
    height: clamp(room.env?.wallHeight ?? defaultWallHeight, 0.8, 3.6),
  };
}

export function roomCeiling(room: BuilderRoom): EffectiveCeiling {
  const preset = surfacePreset(room.env?.ceilingPresetId ?? styleWallDefault[room.style], builderCeilingPresets[0]);
  return {
    visible: room.env?.ceilingVisible ?? true,
    height: clamp(room.env?.ceilingHeight ?? defaultCeilingHeight, 2, 4),
    preset,
    color: room.env?.ceilingColor ?? preset.color,
  };
}

export function surfaceOverridesWithPreset(
  current: BuilderSurfaceOverrides | undefined,
  slot: BuilderSurfaceSlot,
  presetId: string,
): BuilderSurfaceOverrides {
  return { ...(current ?? {}), [slot]: { presetId, authored: true } };
}

export function roomSurfaceTextureOverride(
  room: BuilderRoom,
  slot: BuilderSurfaceSlot,
): BuilderRuntimeSurfaceTextureOverride | null {
  const floor = slot === "floor" ? roomFloor(room) : null;
  const wall = slot === "wall" ? roomWall(room) : null;
  const ceiling = slot === "ceiling" ? roomCeiling(room) : null;
  const preset = floor?.preset ?? wall?.preset ?? ceiling?.preset ?? null;
  const color = floor?.color ?? wall?.color ?? ceiling?.color ?? null;
  if (!preset?.albedoUrl || !color) return null;
  return {
    slot,
    preset,
    color,
    albedoUrl: preset.albedoUrl,
  };
}

/**
 * Runtime shell asset IDs for the room's effective surfaces. The Raw playtest
 * pack can audit these IDs like furniture modelKeys while still falling back to
 * procedural baked geometry when no native Raw shell is available.
 */
export function builderRuntimeSurfaceModelKeys(room: BuilderRoom): BuilderRuntimeSurfaceModelKeys {
  if (room.style === "exit") {
    const floorFamily = shellFamilyForFloor(roomFloor(room).preset);
    const wallFamily = shellFamilyForWall(roomWall(room).preset, room.style);
    const ceilingFamily = shellFamilyForWall(roomCeiling(room).preset, room.style);
    return {
      floorModelKey: `room_floor_tile_${floorFamily}`,
      wallModelKey: `room_wall_panel_${wallFamily}`,
      ceilingModelKey: `room_ceiling_panel_${ceilingFamily}`,
    };
  }
  const officialKeys = builderSurfaceModelKeysForRoom(room);
  if (officialKeys) return officialKeys;
  const floorFamily = shellFamilyForFloor(roomFloor(room).preset);
  const wallFamily = shellFamilyForWall(roomWall(room).preset, room.style);
  const ceilingFamily = shellFamilyForWall(roomCeiling(room).preset, room.style);
  return {
    floorModelKey: `room_floor_tile_${floorFamily}`,
    wallModelKey: `room_wall_panel_${wallFamily}`,
    ceilingModelKey: `room_ceiling_panel_${ceilingFamily}`,
  };
}

type BuilderShellFamily = "maintenance" | "residential" | "museum" | "clinic" | "core";

function shellFamilyForFloor(preset: BuilderSurfacePreset): BuilderShellFamily {
  if (/level01|maintenance|facility|gunmetal/.test(preset.id)) return "maintenance";
  if (/museum|route|stone/.test(preset.id) || preset.pattern === "stone" || preset.pattern === "route") return "museum";
  if (/residential|archive|wood|parquet/.test(preset.id) || preset.pattern === "wood" || preset.pattern === "parquet") return "residential";
  if (/lab|sterile|tile/.test(preset.id) || preset.pattern === "labtile" || preset.pattern === "tile") return "clinic";
  if (/dark|rubber|core/.test(preset.id) || preset.pattern === "rubber") return "core";
  return "maintenance";
}

function shellFamilyForWall(preset: BuilderSurfacePreset, roomStyle: BuilderRoomStyle): BuilderShellFamily {
  if (/level01|maintenance|facility|gunmetal|service_ribs/.test(preset.id)) return "maintenance";
  if (/museum|observation|glass|stone/.test(preset.id) || preset.pattern === "glass" || preset.pattern === "stone") return "museum";
  if (/residential|archive|wood|warm|wainscot/.test(preset.id) || preset.pattern === "wood" || preset.pattern === "wainscot") return "residential";
  if (/lab|sterile|clean/.test(preset.id) || preset.pattern === "labtile" || preset.pattern === "tile") return "clinic";
  if (/dark|core|rubber|panel/.test(preset.id) || roomStyle === "exit") return "core";
  return "maintenance";
}

// ---------------------------------------------------------------------------
// Project lighting (single rig: ambient + key light + fog/bloom/shadow)
// ---------------------------------------------------------------------------

export const defaultLighting: BuilderLighting = {
  ambient: 0.6,
  keyColor: "#ffffff",
  keyIntensity: 0.85,
  fog: 0.35,
  bloom: 0.5,
  shadow: 0.5,
};

export function clampLighting(partial: Partial<BuilderLighting> | undefined): BuilderLighting {
  return {
    ambient: clamp(partial?.ambient ?? defaultLighting.ambient, 0.1, 1.2),
    keyColor: typeof partial?.keyColor === "string" && /^#[0-9a-fA-F]{6}$/.test(partial.keyColor) ? partial.keyColor : defaultLighting.keyColor,
    keyIntensity: clamp(partial?.keyIntensity ?? defaultLighting.keyIntensity, 0, 2),
    fog: clamp(partial?.fog ?? defaultLighting.fog, 0, 1),
    bloom: clamp(partial?.bloom ?? defaultLighting.bloom, 0, 1),
    shadow: clamp(partial?.shadow ?? defaultLighting.shadow, 0, 1),
  };
}

export function projectLighting(project: BuilderProject): BuilderLighting {
  return clampLighting(project.lighting);
}

// ---------------------------------------------------------------------------
// Brush + color chips
// ---------------------------------------------------------------------------

export type BuilderBrush =
  | { kind: "floor"; presetId: string }
  | { kind: "wall"; presetId: string }
  | { kind: "ceiling"; presetId: string };

/** The preset a brush would paint with. */
export function brushPreset(brush: BuilderBrush): BuilderSurfacePreset {
  if (brush.kind === "floor") return surfacePreset(brush.presetId, builderFloorPresets[0]);
  if (brush.kind === "wall") return surfacePreset(brush.presetId, builderWallPresets[0]);
  return surfacePreset(brush.presetId, builderCeilingPresets[0]);
}

/** One-shot paint confirmation pulse shown in both canvases (token restarts the animation). */
export interface BuilderPaintFlash {
  roomId: string;
  token: number;
  color: string;
}

export interface BrushApplication {
  rooms: BuilderProject["rooms"];
  /** Confirmation line, e.g. 已应用地板：监控走廊 → 警戒斜纹. */
  status: string;
  /** Accent color for the paint confirmation flash. */
  flashColor: string;
}

/**
 * Pure brush application: returns the new rooms array (input untouched) plus
 * confirmation metadata. Applying a preset clears the matching color override.
 */
export function applyBrushToRooms(project: BuilderProject, brush: BuilderBrush, roomId: string): BrushApplication | null {
  const target = project.rooms.find((room) => room.id === roomId);
  if (!target) return null;
  const preset = brushPreset(brush);
  let status = "";
  let flashColor = "#8da4c4";
  const rooms = project.rooms.map((room) => {
    if (room.id !== roomId) return room;
    if (brush.kind === "floor" && preset) {
      status = `已应用地板：${room.label} → ${preset.label}`;
      flashColor = preset.accent;
      return {
        ...room,
        env: {
          ...room.env,
          surfaceOverrides: surfaceOverridesWithPreset(room.env?.surfaceOverrides, "floor", brush.presetId),
          floorPresetId: brush.presetId,
          floorColor: undefined,
        },
      };
    }
    if (brush.kind === "wall" && preset) {
      status = `已应用墙壁：${room.label} → ${preset.label}`;
      flashColor = preset.accent;
      return {
        ...room,
        env: {
          ...room.env,
          surfaceOverrides: surfaceOverridesWithPreset(room.env?.surfaceOverrides, "wall", brush.presetId),
          wallPresetId: brush.presetId,
          wallColor: undefined,
        },
      };
    }
    if (brush.kind === "ceiling" && preset) {
      status = `已应用天花板：${room.label} → ${preset.label}`;
      flashColor = preset.accent;
      return {
        ...room,
        env: {
          ...room.env,
          surfaceOverrides: surfaceOverridesWithPreset(room.env?.surfaceOverrides, "ceiling", brush.presetId),
          ceilingVisible: true,
          ceilingPresetId: brush.presetId,
          ceilingColor: undefined,
        },
      };
    }
    return room;
  });
  return { rooms, status, flashColor };
}

/** Surface tint chips (shared by floor/wall/ceiling color rows). */
export const surfaceColorChips: readonly string[] = [
  "#64d7ff",
  "#6fe3c2",
  "#d8a86b",
  "#ffb34f",
  "#ff7a5c",
  "#b47aff",
  "#8da4c4",
  "#3a4356",
];

/** Key-light color chips. */
export const keyLightColorChips: readonly string[] = [
  "#ffffff",
  "#bcd6ff",
  "#ffe2b8",
  "#7ff2ff",
  "#ff9d8a",
  "#b47aff",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
