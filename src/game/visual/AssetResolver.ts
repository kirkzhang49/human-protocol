import type {
  LevelDoorDefinition,
  LevelInteractionDefinition,
  LevelKeyItemDefinition,
  LevelPuzzleTargetDefinition,
  LevelRoomDefinition,
  RoomAestheticConfig,
  RoomAestheticDetail,
  RoomAestheticStyle,
} from "../config/schema/levelConfig";

export type MapPrimitiveKind =
  | "none"
  | "floor"
  | "wall"
  | "door"
  | "key_card"
  | "terminal"
  | "exit_panel"
  | "pickup"
  | "crate"
  | "puzzle_orb"
  | "digit_decal"
  | "lamp"
  | "archive_book"
  | "big_screen";

export interface MapMaterialProfile {
  key: string;
  color: string;
  activeColor?: string;
  emissive: string;
  activeEmissive?: string;
  accent: string;
  dangerAccent?: string;
  metalness: number;
  roughness: number;
  opacity?: number;
  glowOpacity?: number;
}

export interface MapVisualAssetProfile {
  visualKey: string;
  materialKey: string;
  primitive: MapPrimitiveKind;
  scale: number;
}

export interface RoomSkinProfile {
  key: string;
  floorMaterialKey: string;
  wallMaterialKey: string;
  aesthetic: RoomAestheticConfig;
  accentColor?: string;
  hero?: boolean;
}

export interface DoorSkinProfile {
  key: string;
  visualKey: string;
  materialKey: string;
  frameScale?: number;
  hero?: boolean;
}

export interface RoomAestheticProfile {
  style: Exclude<RoomAestheticStyle, "auto">;
  detail: RoomAestheticDetail;
  accent: string;
  secondaryAccent: string;
  trimColor: string;
  panelColor: string;
  darkColor: string;
  glowOpacity: number;
}

const fallbackMaterial: MapMaterialProfile = {
  key: "fallback_dark_metal",
  color: "#182631",
  activeColor: "#1e3542",
  emissive: "#12313a",
  activeEmissive: "#1f6d80",
  accent: "#75ecff",
  dangerAccent: "#ff6655",
  metalness: 0.62,
  roughness: 0.42,
  opacity: 0.72,
  glowOpacity: 0.48,
};

export const mapMaterialProfiles: Record<string, MapMaterialProfile> = {
  fallback_dark_metal: fallbackMaterial,
  maintenance_bay_wet_floor: {
    key: "maintenance_bay_wet_floor",
    color: "#101820",
    activeColor: "#122834",
    emissive: "#12313a",
    activeEmissive: "#1d5665",
    accent: "#64d7ff",
    metalness: 0.5,
    roughness: 0.55,
    opacity: 0.72,
    glowOpacity: 0.42,
  },
  maintenance_bay_glass_wall: {
    key: "maintenance_bay_glass_wall",
    color: "#0d141a",
    activeColor: "#121d24",
    emissive: "#07191f",
    activeEmissive: "#10313b",
    accent: "#64d7ff",
    metalness: 0.62,
    roughness: 0.48,
    opacity: 0.9,
    glowOpacity: 0.34,
  },
  sterile_lab_floor: {
    key: "sterile_lab_floor",
    color: "#111b21",
    activeColor: "#162c35",
    emissive: "#10323b",
    activeEmissive: "#287585",
    accent: "#64d7ff",
    metalness: 0.54,
    roughness: 0.5,
    opacity: 0.74,
    glowOpacity: 0.44,
  },
  sterile_lab_wall: {
    key: "sterile_lab_wall",
    color: "#17252d",
    activeColor: "#203845",
    emissive: "#123844",
    activeEmissive: "#2f8192",
    accent: "#64d7ff",
    metalness: 0.66,
    roughness: 0.38,
    opacity: 0.92,
    glowOpacity: 0.42,
  },
  memory_clinic_floor: {
    key: "memory_clinic_floor",
    color: "#dbe5e3",
    activeColor: "#eefaf8",
    emissive: "#183941",
    activeEmissive: "#4fb8c8",
    accent: "#7ff2ff",
    dangerAccent: "#ff6655",
    metalness: 0.32,
    roughness: 0.48,
    opacity: 0.86,
    glowOpacity: 0.34,
  },
  memory_clinic_wall: {
    key: "memory_clinic_wall",
    color: "#23343a",
    activeColor: "#31494f",
    emissive: "#173940",
    activeEmissive: "#4ab0bf",
    accent: "#9ff3ff",
    dangerAccent: "#ff6655",
    metalness: 0.5,
    roughness: 0.42,
    opacity: 0.94,
    glowOpacity: 0.38,
  },
  hazard_hall_floor: {
    key: "hazard_hall_floor",
    color: "#171713",
    activeColor: "#2b2418",
    emissive: "#3a2712",
    activeEmissive: "#805017",
    accent: "#ffb34f",
    metalness: 0.58,
    roughness: 0.48,
    opacity: 0.74,
    glowOpacity: 0.38,
  },
  hazard_hall_wall: {
    key: "hazard_hall_wall",
    color: "#211f1a",
    activeColor: "#32281c",
    emissive: "#4a2a0f",
    activeEmissive: "#a05b18",
    accent: "#ffb34f",
    dangerAccent: "#ff6655",
    metalness: 0.68,
    roughness: 0.36,
    opacity: 0.92,
    glowOpacity: 0.42,
  },
  red_exit_floor: {
    key: "red_exit_floor",
    color: "#171719",
    activeColor: "#2b1d1e",
    emissive: "#441a1d",
    activeEmissive: "#92333a",
    accent: "#ff5b4c",
    dangerAccent: "#ff6655",
    metalness: 0.56,
    roughness: 0.46,
    opacity: 0.74,
    glowOpacity: 0.38,
  },
  red_exit_wall: {
    key: "red_exit_wall",
    color: "#221c1e",
    activeColor: "#352123",
    emissive: "#4a1519",
    activeEmissive: "#aa3038",
    accent: "#ff5b4c",
    dangerAccent: "#ff6655",
    metalness: 0.7,
    roughness: 0.34,
    opacity: 0.92,
    glowOpacity: 0.46,
  },
  reclamation_core_floor: {
    key: "reclamation_core_floor",
    color: "#121014",
    activeColor: "#2a1a1f",
    emissive: "#3d1519",
    activeEmissive: "#8e2b31",
    accent: "#ff5b4c",
    dangerAccent: "#ff6655",
    metalness: 0.64,
    roughness: 0.42,
    opacity: 0.82,
    glowOpacity: 0.42,
  },
  reclamation_core_wall: {
    key: "reclamation_core_wall",
    color: "#21191e",
    activeColor: "#342026",
    emissive: "#4a1519",
    activeEmissive: "#a62f37",
    accent: "#ff5b4c",
    dangerAccent: "#ff6655",
    metalness: 0.72,
    roughness: 0.34,
    opacity: 0.94,
    glowOpacity: 0.48,
  },
  residential_floor: {
    key: "residential_floor",
    color: "#131819",
    activeColor: "#1a211f",
    emissive: "#171c18",
    activeEmissive: "#3f3824",
    accent: "#d6b678",
    dangerAccent: "#ff6655",
    metalness: 0.46,
    roughness: 0.52,
    opacity: 0.78,
    glowOpacity: 0.34,
  },
  residential_wall: {
    key: "residential_wall",
    color: "#171d1c",
    activeColor: "#242822",
    emissive: "#151b18",
    activeEmissive: "#4c442b",
    accent: "#d6b678",
    dangerAccent: "#ff6655",
    metalness: 0.42,
    roughness: 0.5,
    opacity: 0.94,
    glowOpacity: 0.32,
  },
  museum_floor: {
    key: "museum_floor",
    color: "#1d2627",
    activeColor: "#2c3a3a",
    emissive: "#152a2d",
    activeEmissive: "#31595f",
    accent: "#cfe7e5",
    dangerAccent: "#b84b43",
    metalness: 0.42,
    roughness: 0.43,
    opacity: 0.82,
    glowOpacity: 0.28,
  },
  level03_museum_floor_premium_stone: {
    key: "level03_museum_floor_premium_stone",
    color: "#181715",
    activeColor: "#2b271d",
    emissive: "#11100e",
    activeEmissive: "#3d3218",
    accent: "#c9a253",
    dangerAccent: "#b84b43",
    metalness: 0.56,
    roughness: 0.44,
    opacity: 0.9,
    glowOpacity: 0.24,
  },
  museum_wall: {
    key: "museum_wall",
    color: "#202b2d",
    activeColor: "#344144",
    emissive: "#173236",
    activeEmissive: "#426e72",
    accent: "#d6ebe8",
    dangerAccent: "#b84b43",
    metalness: 0.52,
    roughness: 0.36,
    opacity: 0.94,
    glowOpacity: 0.32,
  },
  level03_museum_wall_black_gallery: {
    key: "level03_museum_wall_black_gallery",
    color: "#15171b",
    activeColor: "#24221d",
    emissive: "#0c1012",
    activeEmissive: "#322917",
    accent: "#d6a253",
    dangerAccent: "#b84b43",
    metalness: 0.58,
    roughness: 0.56,
    opacity: 0.96,
    glowOpacity: 0.22,
  },
  service_elevator_metal: {
    key: "service_elevator_metal",
    color: "#111a22",
    activeColor: "#172832",
    emissive: "#13323b",
    activeEmissive: "#2b6d7a",
    accent: "#7ff2ff",
    dangerAccent: "#ff6655",
    metalness: 0.68,
    roughness: 0.34,
    opacity: 1,
    glowOpacity: 0.62,
  },
  yellow_access_metal: {
    key: "yellow_access_metal",
    color: "#1f211e",
    activeColor: "#302a1d",
    emissive: "#463211",
    activeEmissive: "#b27819",
    accent: "#f7c65c",
    dangerAccent: "#ff6655",
    metalness: 0.66,
    roughness: 0.36,
    opacity: 1,
    glowOpacity: 0.58,
  },
  access_card_gold: {
    key: "access_card_gold",
    color: "#f6d46b",
    activeColor: "#ffe28d",
    emissive: "#8a6b20",
    activeEmissive: "#dcae32",
    accent: "#ffd86f",
    metalness: 0.55,
    roughness: 0.32,
    opacity: 1,
    glowOpacity: 0.55,
  },
  terminal_cyan: {
    key: "terminal_cyan",
    color: "#17242d",
    activeColor: "#1b3039",
    emissive: "#154a56",
    activeEmissive: "#31bbce",
    accent: "#7ff2ff",
    metalness: 0.62,
    roughness: 0.34,
    opacity: 1,
    glowOpacity: 0.72,
  },
  terminal_red: {
    key: "terminal_red",
    color: "#211c20",
    activeColor: "#332024",
    emissive: "#55191e",
    activeEmissive: "#c83a44",
    accent: "#ff5b4c",
    dangerAccent: "#ff6655",
    metalness: 0.62,
    roughness: 0.34,
    opacity: 1,
    glowOpacity: 0.72,
  },
  dark_service_crate: {
    key: "dark_service_crate",
    color: "#293340",
    emissive: "#111f29",
    accent: "#6df0ff",
    metalness: 0.68,
    roughness: 0.34,
  },
  cyan_exit_pad: {
    key: "cyan_exit_pad",
    color: "#2ca6d2",
    emissive: "#115a72",
    accent: "#70eaff",
    metalness: 0.64,
    roughness: 0.3,
  },
  puzzle_red_glass: {
    key: "puzzle_red_glass",
    color: "#321617",
    activeColor: "#5b2223",
    emissive: "#8a1d20",
    activeEmissive: "#ff5757",
    accent: "#ff6b5f",
    dangerAccent: "#ff6655",
    metalness: 0.28,
    roughness: 0.22,
    opacity: 0.92,
    glowOpacity: 0.62,
  },
  puzzle_blue_glass: {
    key: "puzzle_blue_glass",
    color: "#132134",
    activeColor: "#1e3c61",
    emissive: "#1a4f8f",
    activeEmissive: "#55b8ff",
    accent: "#63c7ff",
    metalness: 0.28,
    roughness: 0.22,
    opacity: 0.92,
    glowOpacity: 0.62,
  },
  puzzle_green_glass: {
    key: "puzzle_green_glass",
    color: "#13291f",
    activeColor: "#1f5239",
    emissive: "#1d7143",
    activeEmissive: "#64ff9b",
    accent: "#68f0a0",
    metalness: 0.28,
    roughness: 0.22,
    opacity: 0.92,
    glowOpacity: 0.62,
  },
  puzzle_yellow_glass: {
    key: "puzzle_yellow_glass",
    color: "#352711",
    activeColor: "#674716",
    emissive: "#946114",
    activeEmissive: "#ffd45f",
    accent: "#ffd063",
    metalness: 0.3,
    roughness: 0.24,
    opacity: 0.92,
    glowOpacity: 0.62,
  },
  puzzle_purple_glass: {
    key: "puzzle_purple_glass",
    color: "#251a36",
    activeColor: "#483061",
    emissive: "#693b9c",
    activeEmissive: "#bc83ff",
    accent: "#c692ff",
    metalness: 0.28,
    roughness: 0.23,
    opacity: 0.92,
    glowOpacity: 0.62,
  },
  puzzle_white_glass: {
    key: "puzzle_white_glass",
    color: "#d7e5ec",
    activeColor: "#ffffff",
    emissive: "#8fb9c7",
    activeEmissive: "#ecfbff",
    accent: "#ecfbff",
    metalness: 0.22,
    roughness: 0.2,
    opacity: 0.9,
    glowOpacity: 0.58,
  },
  puzzle_cyan_glass: {
    key: "puzzle_cyan_glass",
    color: "#0f3337",
    activeColor: "#1c6972",
    emissive: "#1a8a96",
    activeEmissive: "#5ff3ff",
    accent: "#72f7ff",
    metalness: 0.28,
    roughness: 0.22,
    opacity: 0.92,
    glowOpacity: 0.64,
  },
  wall_digit_paint: {
    key: "wall_digit_paint",
    color: "#1b2329",
    activeColor: "#222e36",
    emissive: "#203744",
    activeEmissive: "#64d7ff",
    accent: "#dff8ff",
    dangerAccent: "#ff6655",
    metalness: 0.38,
    roughness: 0.58,
    opacity: 1,
    glowOpacity: 0.5,
  },
};

export const mapVisualProfiles: Record<string, MapVisualAssetProfile> = {
  none: { visualKey: "none", materialKey: "terminal_cyan", primitive: "none", scale: 1 },
  generated_room_wall: { visualKey: "generated_room_wall", materialKey: "maintenance_bay_glass_wall", primitive: "wall", scale: 1 },
  museum_gallery_door: { visualKey: "museum_gallery_door", materialKey: "level03_museum_wall_black_gallery", primitive: "door", scale: 1 },
  service_elevator_door: { visualKey: "service_elevator_door", materialKey: "service_elevator_metal", primitive: "door", scale: 1 },
  yellow_access_door: { visualKey: "yellow_access_door", materialKey: "yellow_access_metal", primitive: "door", scale: 1 },
  industrial_access_door: { visualKey: "industrial_access_door", materialKey: "hazard_hall_wall", primitive: "door", scale: 1 },
  yellow_access_card: { visualKey: "yellow_access_card", materialKey: "access_card_gold", primitive: "key_card", scale: 1 },
  large_yellow_key: { visualKey: "large_yellow_key", materialKey: "access_card_gold", primitive: "key_card", scale: 1.75 },
  route_access_chip: { visualKey: "route_access_chip", materialKey: "terminal_cyan", primitive: "key_card", scale: 1.25 },
  route_output_orb_1: { visualKey: "route_output_orb_1", materialKey: "terminal_cyan", primitive: "puzzle_orb", scale: 1.05 },
  route_output_orb_2: { visualKey: "route_output_orb_2", materialKey: "terminal_cyan", primitive: "puzzle_orb", scale: 1.05 },
  route_output_orb_3: { visualKey: "route_output_orb_3", materialKey: "terminal_cyan", primitive: "puzzle_orb", scale: 1.05 },
  route_output_orb_4: { visualKey: "route_output_orb_4", materialKey: "terminal_cyan", primitive: "puzzle_orb", scale: 1.05 },
  sleep_record_terminal: { visualKey: "sleep_record_terminal", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  exit_panel: { visualKey: "exit_panel", materialKey: "terminal_red", primitive: "exit_panel", scale: 1 },
  service_elevator_panel: { visualKey: "service_elevator_panel", materialKey: "terminal_cyan", primitive: "exit_panel", scale: 1 },
  iron_rod_pickup: { visualKey: "iron_rod_pickup", materialKey: "service_elevator_metal", primitive: "pickup", scale: 1 },
  pistol_pickup: { visualKey: "pistol_pickup", materialKey: "terminal_cyan", primitive: "pickup", scale: 1 },
  maintenance_crate: { visualKey: "maintenance_crate", materialKey: "dark_service_crate", primitive: "crate", scale: 1 },
  diagnostic_console: { visualKey: "diagnostic_console", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  control_bank: { visualKey: "control_bank", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  repair_table: { visualKey: "repair_table", materialKey: "terminal_cyan", primitive: "crate", scale: 1 },
  cable_spine: { visualKey: "cable_spine", materialKey: "dark_service_crate", primitive: "crate", scale: 1 },
  power_plinth: { visualKey: "power_plinth", materialKey: "yellow_access_metal", primitive: "crate", scale: 1 },
  elevator_bollard: { visualKey: "elevator_bollard", materialKey: "terminal_red", primitive: "crate", scale: 1 },
  puzzle_orb_red: { visualKey: "puzzle_orb_red", materialKey: "puzzle_red_glass", primitive: "puzzle_orb", scale: 1 },
  puzzle_orb_blue: { visualKey: "puzzle_orb_blue", materialKey: "puzzle_blue_glass", primitive: "puzzle_orb", scale: 1 },
  puzzle_orb_green: { visualKey: "puzzle_orb_green", materialKey: "puzzle_green_glass", primitive: "puzzle_orb", scale: 1 },
  puzzle_orb_yellow: { visualKey: "puzzle_orb_yellow", materialKey: "puzzle_yellow_glass", primitive: "puzzle_orb", scale: 1 },
  puzzle_orb_purple: { visualKey: "puzzle_orb_purple", materialKey: "puzzle_purple_glass", primitive: "puzzle_orb", scale: 1 },
  puzzle_orb_white: { visualKey: "puzzle_orb_white", materialKey: "puzzle_white_glass", primitive: "puzzle_orb", scale: 1 },
  puzzle_orb_cyan: { visualKey: "puzzle_orb_cyan", materialKey: "puzzle_cyan_glass", primitive: "puzzle_orb", scale: 1 },
  three_color_order_panel: { visualKey: "three_color_order_panel", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  puzzle_console_archive_merge: { visualKey: "puzzle_console_archive_merge", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  puzzle_console_circuit_grid: { visualKey: "puzzle_console_circuit_grid", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  puzzle_console_color_sequence: { visualKey: "puzzle_console_color_sequence", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  puzzle_console_gallery_reading: { visualKey: "puzzle_console_gallery_reading", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  puzzle_console_surveillance_match: { visualKey: "puzzle_console_surveillance_match", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  puzzle_console_valve_matrix: { visualKey: "puzzle_console_valve_matrix", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  wall_door_switch_button: { visualKey: "wall_door_switch_button", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  terminal_puzzle_big_screen: { visualKey: "terminal_puzzle_big_screen", materialKey: "terminal_cyan", primitive: "big_screen", scale: 1 },
  puzzle_big_screen: { visualKey: "puzzle_big_screen", materialKey: "terminal_cyan", primitive: "big_screen", scale: 1 },
  wall_digit_warning: { visualKey: "wall_digit_warning", materialKey: "wall_digit_paint", primitive: "digit_decal", scale: 1 },
  direction_keypad_panel: { visualKey: "direction_keypad_panel", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  archive_book: { visualKey: "archive_book", materialKey: "terminal_cyan", primitive: "archive_book", scale: 1.22 },
  residential_access_door: { visualKey: "residential_access_door", materialKey: "residential_wall", primitive: "door", scale: 1 },
  clinic_memory_door: { visualKey: "clinic_memory_door", materialKey: "memory_clinic_wall", primitive: "door", scale: 1 },
  reclamation_archive_door: { visualKey: "reclamation_archive_door", materialKey: "reclamation_core_wall", primitive: "door", scale: 1 },
  family_access_card: { visualKey: "family_access_card", materialKey: "access_card_gold", primitive: "key_card", scale: 1.35 },
  home_light_panel: { visualKey: "home_light_panel", materialKey: "terminal_cyan", primitive: "terminal", scale: 1 },
  residential_lamp_warm: { visualKey: "residential_lamp_warm", materialKey: "puzzle_yellow_glass", primitive: "lamp", scale: 1 },
  residential_lamp_white: { visualKey: "residential_lamp_white", materialKey: "puzzle_white_glass", primitive: "lamp", scale: 1 },
  residential_lamp_blue: { visualKey: "residential_lamp_blue", materialKey: "puzzle_blue_glass", primitive: "lamp", scale: 1 },
};

export const roomSkinProfiles: Record<string, RoomSkinProfile> = {
  maintenance_bay_hero: {
    key: "maintenance_bay_hero",
    floorMaterialKey: "maintenance_bay_wet_floor",
    wallMaterialKey: "maintenance_bay_glass_wall",
    aesthetic: { style: "maintenance", detail: "high", trim: true, wallPanels: true, ceilingLights: true, floorLines: true },
    accentColor: "#8df6ff",
    hero: true,
  },
  maintenance_service: {
    key: "maintenance_service",
    floorMaterialKey: "maintenance_bay_wet_floor",
    wallMaterialKey: "maintenance_bay_glass_wall",
    aesthetic: { style: "maintenance", detail: "high" },
    accentColor: "#64d7ff",
  },
  service_exit_red: {
    key: "service_exit_red",
    floorMaterialKey: "red_exit_floor",
    wallMaterialKey: "red_exit_wall",
    aesthetic: { style: "exit", detail: "high", trim: true, wallPanels: true, ceilingLights: true, floorLines: true },
    accentColor: "#ff6655",
  },
  sterile_blue_lab: {
    key: "sterile_blue_lab",
    floorMaterialKey: "sterile_lab_floor",
    wallMaterialKey: "sterile_lab_wall",
    aesthetic: { style: "sterile", detail: "high" },
    accentColor: "#7ff2ff",
  },
  memory_clinic_sterile: {
    key: "memory_clinic_sterile",
    floorMaterialKey: "memory_clinic_floor",
    wallMaterialKey: "memory_clinic_wall",
    aesthetic: { style: "sterile", detail: "high", trim: true, wallPanels: true, ceilingLights: true, floorLines: true },
    accentColor: "#9ff3ff",
    hero: true,
  },
  hazard_yellow_service: {
    key: "hazard_yellow_service",
    floorMaterialKey: "hazard_hall_floor",
    wallMaterialKey: "hazard_hall_wall",
    aesthetic: { style: "hazard", detail: "high" },
    accentColor: "#ffb34f",
  },
  residential_sim_dark: {
    key: "residential_sim_dark",
    floorMaterialKey: "residential_floor",
    wallMaterialKey: "residential_wall",
    aesthetic: { style: "residential", detail: "high" },
    accentColor: "#d6b678",
  },
  human_museum_gallery: {
    key: "human_museum_gallery",
    floorMaterialKey: "level03_museum_floor_premium_stone",
    wallMaterialKey: "level03_museum_wall_black_gallery",
    aesthetic: { style: "museum", detail: "high", trim: true, wallPanels: true, ceilingLights: true, floorLines: true },
    accentColor: "#d6a253",
  },
  service_elevator_hero: {
    key: "service_elevator_hero",
    floorMaterialKey: "service_elevator_metal",
    wallMaterialKey: "service_elevator_metal",
    aesthetic: { style: "exit", detail: "high", trim: true, wallPanels: true, ceilingLights: true, floorLines: true },
    accentColor: "#7ff2ff",
    hero: true,
  },
  reclamation_core_chamber: {
    key: "reclamation_core_chamber",
    floorMaterialKey: "reclamation_core_floor",
    wallMaterialKey: "reclamation_core_wall",
    aesthetic: { style: "hazard", detail: "high", trim: true, wallPanels: true, ceilingLights: true, floorLines: true },
    accentColor: "#ff5b4c",
    hero: true,
  },
};

export const doorSkinProfiles: Record<string, DoorSkinProfile> = {
  service_elevator_hero: {
    key: "service_elevator_hero",
    visualKey: "service_elevator_door",
    materialKey: "service_elevator_metal",
    frameScale: 1.08,
    hero: true,
  },
  service_elevator_red: {
    key: "service_elevator_red",
    visualKey: "service_elevator_door",
    materialKey: "terminal_red",
    frameScale: 1.04,
  },
  yellow_access_service: {
    key: "yellow_access_service",
    visualKey: "yellow_access_door",
    materialKey: "yellow_access_metal",
  },
  cyan_lab_access: {
    key: "cyan_lab_access",
    visualKey: "yellow_access_door",
    materialKey: "terminal_cyan",
  },
  residential_access_clean: {
    key: "residential_access_clean",
    visualKey: "residential_access_door",
    materialKey: "service_elevator_metal",
  },
  red_locked_blast: {
    key: "red_locked_blast",
    visualKey: "service_elevator_door",
    materialKey: "terminal_red",
    frameScale: 1.04,
  },
  identity_archive: {
    key: "identity_archive",
    visualKey: "service_elevator_door",
    materialKey: "terminal_red",
    frameScale: 1.04,
  },
};

export const knownMapMaterialKeys = new Set(Object.keys(mapMaterialProfiles));
export const knownMapVisualKeys = new Set(Object.keys(mapVisualProfiles));
export const knownRoomSkinKeys = new Set(Object.keys(roomSkinProfiles));
export const knownDoorSkinKeys = new Set(Object.keys(doorSkinProfiles));

export function resolveMapMaterial(materialKey?: string | null) {
  if (!materialKey) return fallbackMaterial;
  return mapMaterialProfiles[materialKey] ?? fallbackMaterial;
}

export function resolveMapVisual(visualKey?: string | null) {
  if (!visualKey) return mapVisualProfiles.generated_room_wall;
  return mapVisualProfiles[visualKey] ?? {
    visualKey,
    materialKey: fallbackMaterial.key,
    primitive: "crate" as const,
    scale: 1,
  };
}

export function resolveRoomSkin(room: LevelRoomDefinition) {
  return room.skinKey ? roomSkinProfiles[room.skinKey] ?? null : null;
}

export function resolveDoorSkin(door: LevelDoorDefinition) {
  return door.skinKey ? doorSkinProfiles[door.skinKey] ?? null : null;
}

export function resolveDoorVisual(door: LevelDoorDefinition) {
  const skin = resolveDoorSkin(door);
  return resolveMapVisual(skin?.visualKey ?? door.visualKey);
}

export function resolveRoomFloorMaterial(room: LevelRoomDefinition) {
  const skin = resolveRoomSkin(room);
  return resolveMapMaterial(room.floorMaterialKey ?? room.geometry?.floorMaterialKey ?? skin?.floorMaterialKey ?? "maintenance_bay_wet_floor");
}

export function resolveRoomWallMaterial(room?: LevelRoomDefinition) {
  const skin = room ? resolveRoomSkin(room) : null;
  return resolveMapMaterial(room?.wallMaterialKey ?? room?.geometry?.wallMaterialKey ?? skin?.wallMaterialKey ?? room?.floorMaterialKey ?? "maintenance_bay_glass_wall");
}

export function resolveDoorMaterial(door: LevelDoorDefinition) {
  const skin = resolveDoorSkin(door);
  return resolveMapMaterial(door.materialKey ?? skin?.materialKey ?? resolveDoorVisual(door).materialKey);
}

export function resolveKeyItemMaterial(item: LevelKeyItemDefinition) {
  return resolveMapMaterial(item.materialKey ?? resolveMapVisual(item.visualKey).materialKey);
}

export function resolveInteractionMaterial(interaction: LevelInteractionDefinition) {
  return resolveMapMaterial(interaction.materialKey ?? resolveMapVisual(interaction.visualKey).materialKey);
}

export function resolvePuzzleTargetMaterial(target: LevelPuzzleTargetDefinition) {
  return resolveMapMaterial(target.materialKey ?? resolveMapVisual(target.visualKey).materialKey);
}

export function resolveRoomAesthetic(room: LevelRoomDefinition): RoomAestheticProfile | null {
  if (room.aesthetic?.enabled === false) return null;
  const skin = resolveRoomSkin(room);
  const skinAesthetic = skin?.aesthetic;
  const floor = resolveRoomFloorMaterial(room);
  const wall = resolveRoomWallMaterial(room);
  const style = normalizeRoomAestheticStyle(room.aesthetic?.style ?? skinAesthetic?.style, room);
  const detail = room.aesthetic?.detail ?? skinAesthetic?.detail ?? defaultDetailForRoom(room);
  const accent = room.geometry?.accentColor ?? skin?.accentColor ?? floor.accent;

  return {
    style,
    detail,
    accent,
    secondaryAccent: secondaryAccentForStyle(style, floor, wall),
    trimColor: trimColorForStyle(style, wall),
    panelColor: wall.activeColor ?? wall.color,
    darkColor: wall.color,
    glowOpacity: floor.glowOpacity ?? wall.glowOpacity ?? 0.36,
  };
}

function normalizeRoomAestheticStyle(style: RoomAestheticStyle | undefined, room: LevelRoomDefinition): RoomAestheticProfile["style"] {
  if (style && style !== "auto") return style;
  const keys = [room.floorMaterialKey, room.wallMaterialKey, room.geometry?.floorMaterialKey, room.geometry?.wallMaterialKey].join(" ");
  if (keys.includes("memory_clinic") || room.skinKey?.includes("memory_clinic")) return "sterile";
  if (keys.includes("reclamation_core") || room.skinKey?.includes("reclamation_core")) return "hazard";
  if (keys.includes("museum") || room.skinKey?.includes("museum") || room.skinKey?.includes("archive")) return "museum";
  if (keys.includes("residential")) return "residential";
  if (keys.includes("hazard")) return "hazard";
  if (keys.includes("red_exit") || room.mood === "reveal") return "exit";
  if (keys.includes("sterile")) return "sterile";
  return room.mood === "boss" ? "hazard" : "maintenance";
}

function defaultDetailForRoom(room: LevelRoomDefinition): RoomAestheticDetail {
  if (room.mood === "quiet") return "medium";
  if (room.mood === "combat" || room.mood === "boss") return "high";
  return "medium";
}

function secondaryAccentForStyle(style: RoomAestheticProfile["style"], floor: MapMaterialProfile, wall: MapMaterialProfile) {
  if (style === "residential") return "#7ff2ff";
  if (style === "museum") return "#7ff2ff";
  if (style === "hazard") return wall.dangerAccent ?? "#ff6655";
  if (style === "exit") return "#ffffff";
  return wall.accent ?? floor.accent;
}

function trimColorForStyle(style: RoomAestheticProfile["style"], wall: MapMaterialProfile) {
  if (style === "residential") return "#252c2c";
  if (style === "museum") return "#53605d";
  if (style === "sterile") return "#203845";
  if (style === "hazard") return "#302716";
  if (style === "exit") return "#2e1d20";
  return wall.activeColor ?? "#20313c";
}
