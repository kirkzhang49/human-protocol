import type { EnvironmentModelRegistry } from "./types";
import doorThresholdServiceElevatorUrl from "../../models-cooked/environment/shells/hp_door_threshold_service_elevator.glb?url";
import serviceElevatorAscentShaftFxUrl from "../../models-cooked/environment/shells/hp_service_elevator_ascent_shaft_fx.glb?url";
import serviceElevatorCallButtonsUrl from "../../models-cooked/environment/shells/hp_service_elevator_call_buttons.glb?url";
import serviceElevatorExitStageUrl from "../../models-cooked/environment/shells/hp_service_elevator_exit_stage.glb?url";
import serviceElevatorInteriorShellUrl from "../../models-cooked/environment/shells/hp_service_elevator_interior_shell.glb?url";
import roomCeilingPanelClinicUrl from "../../models-cooked/environment/shells/hp_room_ceiling_panel_clinic.glb?url";
import roomCeilingPanelCoreUrl from "../../models-cooked/environment/shells/hp_room_ceiling_panel_core.glb?url";
import roomCeilingPanelMaintenanceUrl from "../../models-cooked/environment/shells/hp_room_ceiling_panel_maintenance.glb?url";
import roomCeilingPanelMuseumUrl from "../../models-cooked/environment/shells/hp_room_ceiling_panel_museum.glb?url";
import roomCeilingPanelResidentialUrl from "../../models-cooked/environment/shells/hp_room_ceiling_panel_residential.glb?url";
import roomCornerPillarClinicUrl from "../../models-cooked/environment/shells/hp_room_corner_pillar_clinic.glb?url";
import roomCornerPillarCoreUrl from "../../models-cooked/environment/shells/hp_room_corner_pillar_core.glb?url";
import roomCornerPillarMaintenanceUrl from "../../models-cooked/environment/shells/hp_room_corner_pillar_maintenance.glb?url";
import roomCornerPillarMuseumUrl from "../../models-cooked/environment/shells/hp_room_corner_pillar_museum.glb?url";
import roomCornerPillarResidentialUrl from "../../models-cooked/environment/shells/hp_room_corner_pillar_residential.glb?url";
import roomFloorTileClinicUrl from "../../models-cooked/environment/shells/hp_room_floor_tile_clinic.glb?url";
import roomFloorTileCoreUrl from "../../models-cooked/environment/shells/hp_room_floor_tile_core.glb?url";
import roomFloorTileMaintenanceUrl from "../../models-cooked/environment/shells/hp_room_floor_tile_maintenance.glb?url";
import roomFloorTileMuseumUrl from "../../models-cooked/environment/shells/hp_room_floor_tile_museum.glb?url";
import roomFloorTileResidentialUrl from "../../models-cooked/environment/shells/hp_room_floor_tile_residential.glb?url";
import roomWallPanelClinicUrl from "../../models-cooked/environment/shells/hp_room_wall_panel_clinic.glb?url";
import roomWallPanelCoreUrl from "../../models-cooked/environment/shells/hp_room_wall_panel_core.glb?url";
import roomWallPanelMaintenanceUrl from "../../models-cooked/environment/shells/hp_room_wall_panel_maintenance.glb?url";
import roomWallPanelMuseumUrl from "../../models-cooked/environment/shells/hp_room_wall_panel_museum.glb?url";
import roomWallPanelResidentialUrl from "../../models-cooked/environment/shells/hp_room_wall_panel_residential.glb?url";
import roomWallWashLightClinicUrl from "../../models-cooked/environment/shells/hp_room_wall_wash_light_clinic.glb?url";
import roomWallWashLightCoreUrl from "../../models-cooked/environment/shells/hp_room_wall_wash_light_core.glb?url";
import roomWallWashLightMaintenanceUrl from "../../models-cooked/environment/shells/hp_room_wall_wash_light_maintenance.glb?url";
import roomWallWashLightMuseumUrl from "../../models-cooked/environment/shells/hp_room_wall_wash_light_museum.glb?url";
import roomWallWashLightResidentialUrl from "../../models-cooked/environment/shells/hp_room_wall_wash_light_residential.glb?url";

export const shellEnvironmentModelAssets = {
  room_floor_tile_maintenance: {
    modelKey: "room_floor_tile_maintenance",
    url: roomFloorTileMaintenanceUrl,
    category: "room",
    sizeMeters: [3.2, 0.08, 2.25],
  },
  room_wall_panel_maintenance: {
    modelKey: "room_wall_panel_maintenance",
    url: roomWallPanelMaintenanceUrl,
    category: "room",
    sizeMeters: [2.4, 1.65, 0.28],
  },
  room_ceiling_panel_maintenance: {
    modelKey: "room_ceiling_panel_maintenance",
    url: roomCeilingPanelMaintenanceUrl,
    category: "room",
    sizeMeters: [2.4, 0.28, 1.45],
  },
  room_corner_pillar_maintenance: {
    modelKey: "room_corner_pillar_maintenance",
    url: roomCornerPillarMaintenanceUrl,
    category: "room",
    sizeMeters: [0.58, 2.62, 0.58],
  },
  room_wall_wash_light_maintenance: {
    modelKey: "room_wall_wash_light_maintenance",
    url: roomWallWashLightMaintenanceUrl,
    category: "room",
    sizeMeters: [1.7, 0.22, 0.12],
  },
  room_floor_tile_residential: {
    modelKey: "room_floor_tile_residential",
    url: roomFloorTileResidentialUrl,
    category: "room",
    sizeMeters: [3.2, 0.08, 2.25],
  },
  room_wall_panel_residential: {
    modelKey: "room_wall_panel_residential",
    url: roomWallPanelResidentialUrl,
    category: "room",
    sizeMeters: [2.4, 1.65, 0.28],
  },
  room_ceiling_panel_residential: {
    modelKey: "room_ceiling_panel_residential",
    url: roomCeilingPanelResidentialUrl,
    category: "room",
    sizeMeters: [2.4, 0.28, 1.45],
  },
  room_corner_pillar_residential: {
    modelKey: "room_corner_pillar_residential",
    url: roomCornerPillarResidentialUrl,
    category: "room",
    sizeMeters: [0.58, 2.62, 0.58],
  },
  room_wall_wash_light_residential: {
    modelKey: "room_wall_wash_light_residential",
    url: roomWallWashLightResidentialUrl,
    category: "room",
    sizeMeters: [1.7, 0.22, 0.12],
  },
  room_floor_tile_museum: {
    modelKey: "room_floor_tile_museum",
    url: roomFloorTileMuseumUrl,
    category: "room",
    sizeMeters: [3.2, 0.08, 2.25],
  },
  room_wall_panel_museum: {
    modelKey: "room_wall_panel_museum",
    url: roomWallPanelMuseumUrl,
    category: "room",
    sizeMeters: [3.2, 0.163, 2.9],
  },
  room_ceiling_panel_museum: {
    modelKey: "room_ceiling_panel_museum",
    url: roomCeilingPanelMuseumUrl,
    category: "room",
    sizeMeters: [2.4, 0.28, 1.45],
  },
  room_corner_pillar_museum: {
    modelKey: "room_corner_pillar_museum",
    url: roomCornerPillarMuseumUrl,
    category: "room",
    sizeMeters: [0.58, 2.62, 0.58],
  },
  room_wall_wash_light_museum: {
    modelKey: "room_wall_wash_light_museum",
    url: roomWallWashLightMuseumUrl,
    category: "room",
    sizeMeters: [1.7, 0.22, 0.12],
  },
  room_floor_tile_clinic: {
    modelKey: "room_floor_tile_clinic",
    url: roomFloorTileClinicUrl,
    category: "room",
    sizeMeters: [3.2, 0.08, 2.25],
  },
  room_wall_panel_clinic: {
    modelKey: "room_wall_panel_clinic",
    url: roomWallPanelClinicUrl,
    category: "room",
    sizeMeters: [2.4, 1.65, 0.28],
  },
  room_ceiling_panel_clinic: {
    modelKey: "room_ceiling_panel_clinic",
    url: roomCeilingPanelClinicUrl,
    category: "room",
    sizeMeters: [2.4, 0.28, 1.45],
  },
  room_corner_pillar_clinic: {
    modelKey: "room_corner_pillar_clinic",
    url: roomCornerPillarClinicUrl,
    category: "room",
    sizeMeters: [0.58, 2.62, 0.58],
  },
  room_wall_wash_light_clinic: {
    modelKey: "room_wall_wash_light_clinic",
    url: roomWallWashLightClinicUrl,
    category: "room",
    sizeMeters: [1.7, 0.22, 0.12],
  },
  room_floor_tile_core: {
    modelKey: "room_floor_tile_core",
    url: roomFloorTileCoreUrl,
    category: "room",
    sizeMeters: [3.2, 0.08, 2.25],
  },
  room_wall_panel_core: {
    modelKey: "room_wall_panel_core",
    url: roomWallPanelCoreUrl,
    category: "room",
    sizeMeters: [2.4, 1.65, 0.28],
  },
  room_ceiling_panel_core: {
    modelKey: "room_ceiling_panel_core",
    url: roomCeilingPanelCoreUrl,
    category: "room",
    sizeMeters: [2.4, 0.28, 1.45],
  },
  room_corner_pillar_core: {
    modelKey: "room_corner_pillar_core",
    url: roomCornerPillarCoreUrl,
    category: "room",
    sizeMeters: [0.58, 2.62, 0.58],
  },
  room_wall_wash_light_core: {
    modelKey: "room_wall_wash_light_core",
    url: roomWallWashLightCoreUrl,
    category: "room",
    sizeMeters: [1.7, 0.22, 0.12],
  },
  door_threshold_service_elevator: {
    modelKey: "door_threshold_service_elevator",
    url: doorThresholdServiceElevatorUrl,
    category: "room",
    sizeMeters: [4.5, 0.22, 0.74],
  },
  service_elevator_exit_stage: {
    modelKey: "service_elevator_exit_stage",
    url: serviceElevatorExitStageUrl,
    category: "room",
    sizeMeters: [6.3, 3.9, 5.0],
  },
  service_elevator_interior_shell: {
    modelKey: "service_elevator_interior_shell",
    url: serviceElevatorInteriorShellUrl,
    category: "room",
    sizeMeters: [6.1, 3.3, 5.0],
  },
  service_elevator_call_buttons: {
    modelKey: "service_elevator_call_buttons",
    url: serviceElevatorCallButtonsUrl,
    category: "interaction",
    sizeMeters: [0.82, 1.08, 0.16],
  },
  service_elevator_ascent_shaft_fx: {
    modelKey: "service_elevator_ascent_shaft_fx",
    url: serviceElevatorAscentShaftFxUrl,
    category: "room",
    sizeMeters: [6.2, 3.9, 4.2],
  },
} as const satisfies EnvironmentModelRegistry;
