import type { EnvironmentModelRegistry } from "./types";
import level02ResidentialLampBlueUrl from "../../models-runtime/environment/level02/hp_light_residential_lamp_blue.glb?url";
import level02ResidentialLampWarmUrl from "../../models-runtime/environment/level02/hp_light_residential_lamp_warm.glb?url";
import level02ResidentialLampWhiteUrl from "../../models-runtime/environment/level02/hp_light_residential_lamp_white.glb?url";
import level02CarekeeperServiceClosetUrl from "../../models-runtime/environment/level02/hp_room_carekeeper_service_closet.glb?url";
import level02FakeFamilyPhotoWallUrl from "../../models-runtime/environment/level02/hp_room_fake_family_photo_wall.glb?url";
import level02LoungeLowTableResidentialUrl from "../../models-runtime/environment/level02/hp_room_lounge_low_table_residential.glb?url";
import level02LoungeSofaResidentialUrl from "../../models-runtime/environment/level02/hp_room_lounge_sofa_residential.glb?url";
import level02ResidentialCeilingSoftboxUrl from "../../models-runtime/environment/level02/hp_room_residential_ceiling_softbox.glb?url";
import level02ResidentialFloorPathInlayUrl from "../../models-runtime/environment/level02/hp_room_residential_floor_path_inlay.glb?url";
import level02ResidentialObservationWindowUrl from "../../models-runtime/environment/level02/hp_room_residential_observation_window.glb?url";
import level02ResidentialRecoveryBedUrl from "../../models-runtime/environment/level02/hp_room_residential_recovery_bed.glb?url";
import level02ResidentialRugPanelUrl from "../../models-runtime/environment/level02/hp_room_residential_rug_panel.glb?url";
import level02ResidentialServiceWallRuptureUrl from "../../models-runtime/environment/level02/hp_room_residential_service_wall_rupture.glb?url";
import level02ResidentialTvWallDirectorUrl from "../../models-runtime/environment/level02/hp_room_residential_tv_wall_director.glb?url";
import level02ServiceRobotDockResidentialUrl from "../../models-runtime/environment/level02/hp_room_service_robot_dock_residential.glb?url";
import level02FamilyLightControlPedestalUrl from "../../models-runtime/environment/level02/hp_terminal_family_light_control_pedestal.glb?url";

export const level02EnvironmentModelAssets = {
  room_lounge_sofa_residential: {
    modelKey: "room_lounge_sofa_residential",
    url: level02LoungeSofaResidentialUrl,
    category: "room",
    sizeMeters: [2.33, 0.83, 0.84],
  },
  room_lounge_low_table_residential: {
    modelKey: "room_lounge_low_table_residential",
    url: level02LoungeLowTableResidentialUrl,
    category: "room",
    sizeMeters: [1.47, 0.48, 0.88],
  },
  room_fake_family_photo_wall: {
    modelKey: "room_fake_family_photo_wall",
    url: level02FakeFamilyPhotoWallUrl,
    category: "room",
    sizeMeters: [3.17, 1.7, 0.17],
  },
  room_residential_rug_panel: {
    modelKey: "room_residential_rug_panel",
    url: level02ResidentialRugPanelUrl,
    category: "room",
    sizeMeters: [3.94, 0.06, 2.31],
  },
  room_residential_ceiling_softbox: {
    modelKey: "room_residential_ceiling_softbox",
    url: level02ResidentialCeilingSoftboxUrl,
    category: "room",
    sizeMeters: [3.811, 0.185, 1.126],
  },
  room_residential_floor_path_inlay: {
    modelKey: "room_residential_floor_path_inlay",
    url: level02ResidentialFloorPathInlayUrl,
    category: "room",
    sizeMeters: [4.719, 0.056, 0.704],
  },
  room_residential_observation_window: {
    modelKey: "room_residential_observation_window",
    url: level02ResidentialObservationWindowUrl,
    category: "room",
    sizeMeters: [3.897, 1.694, 0.229],
  },
  room_residential_recovery_bed: {
    modelKey: "room_residential_recovery_bed",
    url: level02ResidentialRecoveryBedUrl,
    category: "room",
    sizeMeters: [2.314, 0.871, 1.204],
  },
  room_residential_service_wall_rupture: {
    modelKey: "room_residential_service_wall_rupture",
    url: level02ResidentialServiceWallRuptureUrl,
    category: "room",
    sizeMeters: [2.617, 2.19, 0.324],
  },
  room_residential_tv_wall_director: {
    modelKey: "room_residential_tv_wall_director",
    url: level02ResidentialTvWallDirectorUrl,
    category: "room",
    sizeMeters: [4.396, 2.017, 0.293],
  },
  light_residential_lamp_warm: {
    modelKey: "light_residential_lamp_warm",
    url: level02ResidentialLampWarmUrl,
    category: "room",
    sizeMeters: [0.63, 1.34, 0.55],
  },
  light_residential_lamp_white: {
    modelKey: "light_residential_lamp_white",
    url: level02ResidentialLampWhiteUrl,
    category: "room",
    sizeMeters: [0.65, 1.4, 0.53],
  },
  light_residential_lamp_blue: {
    modelKey: "light_residential_lamp_blue",
    url: level02ResidentialLampBlueUrl,
    category: "room",
    sizeMeters: [0.58, 1.39, 0.56],
  },
  terminal_family_light_control_pedestal: {
    modelKey: "terminal_family_light_control_pedestal",
    url: level02FamilyLightControlPedestalUrl,
    category: "interaction",
    sizeMeters: [1.28, 1.16, 0.64],
  },
  room_carekeeper_service_closet: {
    modelKey: "room_carekeeper_service_closet",
    url: level02CarekeeperServiceClosetUrl,
    category: "room",
    sizeMeters: [1.18, 2.2, 0.68],
  },
  room_service_robot_dock_residential: {
    modelKey: "room_service_robot_dock_residential",
    url: level02ServiceRobotDockResidentialUrl,
    category: "room",
    sizeMeters: [1.35, 0.92, 0.91],
  },
} as const satisfies EnvironmentModelRegistry;
