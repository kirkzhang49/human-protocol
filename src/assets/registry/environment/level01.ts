import type { EnvironmentModelRegistry } from "./types";
import level01RobotStorageWindowUrl from "../../models-cooked/environment/level01/hp_backdrop_robot_storage_window_dark.glb?url";
import level01RepairArmClusterUrl from "../../models-cooked/environment/level01/hp_hero_maintenance_repair_arm_cluster.glb?url";
import level01RepairBayUrl from "../../models-cooked/environment/level01/hp_hero_maintenance_repair_bay.glb?url";
import level01CeilingFlickerCyanUrl from "../../models-cooked/environment/level01/hp_light_ceiling_flicker_cyan_2m.glb?url";
import level01WallMedicalStripCyanUrl from "../../models-cooked/environment/level01/hp_light_wall_medical_strip_cyan_1m.glb?url";
import level01HumanBodyReferenceDecalUrl from "../../models-cooked/environment/level01/hp_decal_human_body_reference.glb?url";
import level01HumanHandReferenceDecalUrl from "../../models-cooked/environment/level01/hp_decal_human_hand_reference.glb?url";
import level01HumanSpineReferenceDecalUrl from "../../models-cooked/environment/level01/hp_decal_human_spine_reference.glb?url";
import level01HumanReferenceTriptychDecalUrl from "../../models-cooked/environment/level01/hp_decal_human_reference_triptych.glb?url";
import level01MaintenanceHalfPanelUrl from "../../models-cooked/environment/level01/hp_room_wall_occluder_maintenance_half_panel.glb?url";

export const level01EnvironmentModelAssets = {
  hero_maintenance_repair_bay: {
    modelKey: "hero_maintenance_repair_bay",
    url: level01RepairBayUrl,
    category: "room",
    sizeMeters: [3.2, 1.25, 1.4],
  },
  hero_maintenance_repair_arm_cluster: {
    modelKey: "hero_maintenance_repair_arm_cluster",
    url: level01RepairArmClusterUrl,
    category: "room",
    sizeMeters: [2.2, 2.6, 1.4],
  },
  backdrop_robot_storage_window_dark: {
    modelKey: "backdrop_robot_storage_window_dark",
    url: level01RobotStorageWindowUrl,
    category: "room",
    sizeMeters: [7.5, 3.2, 0.35],
  },
  room_wall_occluder_maintenance_half_panel: {
    modelKey: "room_wall_occluder_maintenance_half_panel",
    url: level01MaintenanceHalfPanelUrl,
    category: "room",
    sizeMeters: [2.4, 1.45, 0.32],
  },
  light_ceiling_flicker_cyan_2m: {
    modelKey: "light_ceiling_flicker_cyan_2m",
    url: level01CeilingFlickerCyanUrl,
    category: "room",
    sizeMeters: [2.0, 0.12, 0.18],
  },
  light_wall_medical_strip_cyan_1m: {
    modelKey: "light_wall_medical_strip_cyan_1m",
    url: level01WallMedicalStripCyanUrl,
    category: "room",
    sizeMeters: [0.12, 1.0, 0.08],
  },
  decal_human_body_reference: {
    modelKey: "decal_human_body_reference",
    url: level01HumanBodyReferenceDecalUrl,
    category: "room",
    sizeMeters: [1.0, 1.0, 0.02],
  },
  decal_human_hand_reference: {
    modelKey: "decal_human_hand_reference",
    url: level01HumanHandReferenceDecalUrl,
    category: "room",
    sizeMeters: [1.0, 1.0, 0.02],
  },
  decal_human_spine_reference: {
    modelKey: "decal_human_spine_reference",
    url: level01HumanSpineReferenceDecalUrl,
    category: "room",
    sizeMeters: [1.0, 1.0, 0.02],
  },
  decal_human_reference_triptych: {
    modelKey: "decal_human_reference_triptych",
    url: level01HumanReferenceTriptychDecalUrl,
    category: "room",
    sizeMeters: [2.46, 1.22, 0.02],
  },
} as const satisfies EnvironmentModelRegistry;
