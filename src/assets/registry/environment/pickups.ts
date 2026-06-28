import type { EnvironmentModelRegistry } from "./types";
import pickupAmmoMagazineUrl from "../../models-cooked/environment/props/hp_pickup_ammo_magazine.glb?url";
import pickupEnergyCellAmberUrl from "../../models-cooked/environment/props/hp_pickup_energy_cell_amber.glb?url";
import pickupLargeYellowKeyUrl from "../../models-cooked/environment/props/hp_pickup_large_yellow_key.glb?url";
import pickupMedkitWhiteRedUrl from "../../models-cooked/environment/props/hp_pickup_medkit_white_red.glb?url";
import pickupMemoryChipClusterUrl from "../../models-cooked/environment/props/hp_pickup_memory_chip_cluster.glb?url";
import pickupRouteOutputOrb1Url from "../../models-cooked/environment/props/hp_pickup_route_output_orb_1.glb?url";
import pickupRouteOutputOrb2Url from "../../models-cooked/environment/props/hp_pickup_route_output_orb_2.glb?url";
import pickupRouteOutputOrb3Url from "../../models-cooked/environment/props/hp_pickup_route_output_orb_3.glb?url";
import pickupRouteOutputOrb4Url from "../../models-cooked/environment/props/hp_pickup_route_output_orb_4.glb?url";
import viewmodelIronRodBattlewornUrl from "../../models/viewmodel/hp_viewmodel_iron_rod_wgpu_battleworn.glb?url";
import viewmodelSidearmBattlewornUrl from "../../models/viewmodel/hp_viewmodel_sidearm_wgpu_battleworn.glb?url";

export const pickupEnvironmentModelAssets = {
  pickup_ammo_magazine: { modelKey: "pickup_ammo_magazine", url: pickupAmmoMagazineUrl, category: "pickup", sizeMeters: [0.24, 0.36, 0.13] },
  pickup_energy_cell_amber: { modelKey: "pickup_energy_cell_amber", url: pickupEnergyCellAmberUrl, category: "pickup", sizeMeters: [0.42, 0.9, 0.42] },
  pickup_large_yellow_key: { modelKey: "pickup_large_yellow_key", url: pickupLargeYellowKeyUrl, category: "pickup", sizeMeters: [0.75, 0.28, 0.45] },
  pickup_medkit_white_red: { modelKey: "pickup_medkit_white_red", url: pickupMedkitWhiteRedUrl, category: "pickup", sizeMeters: [0.62, 0.34, 0.42] },
  pickup_memory_chip_cluster: { modelKey: "pickup_memory_chip_cluster", url: pickupMemoryChipClusterUrl, category: "pickup", sizeMeters: [0.45, 0.08, 0.34] },
  pickup_route_output_orb_1: { modelKey: "pickup_route_output_orb_1", url: pickupRouteOutputOrb1Url, category: "pickup", sizeMeters: [0.46, 0.55, 0.46] },
  pickup_route_output_orb_2: { modelKey: "pickup_route_output_orb_2", url: pickupRouteOutputOrb2Url, category: "pickup", sizeMeters: [0.46, 0.55, 0.46] },
  pickup_route_output_orb_3: { modelKey: "pickup_route_output_orb_3", url: pickupRouteOutputOrb3Url, category: "pickup", sizeMeters: [0.46, 0.55, 0.46] },
  pickup_route_output_orb_4: { modelKey: "pickup_route_output_orb_4", url: pickupRouteOutputOrb4Url, category: "pickup", sizeMeters: [0.46, 0.55, 0.46] },
  pickup_iron_rod_viewmodel_battleworn: {
    modelKey: "pickup_iron_rod_viewmodel_battleworn",
    url: viewmodelIronRodBattlewornUrl,
    category: "pickup",
    sizeMeters: [0.31, 2.9, 0.29],
  },
  pickup_sidearm_viewmodel_battleworn: {
    modelKey: "pickup_sidearm_viewmodel_battleworn",
    url: viewmodelSidearmBattlewornUrl,
    category: "pickup",
    sizeMeters: [0.54, 1.52, 2.0],
  },
} as const satisfies EnvironmentModelRegistry;
