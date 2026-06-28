import type { EnvironmentModelRegistry } from "./types";
import doorIdentityArchiveUrl from "../../models-cooked/environment/doors/hp_door_identity_archive.glb?url";
import roomDoorSecurityUrl from "../../models-cooked/environment/doors/hp_room_door_security.glb?url";
import level01ElevatorDoorUrl from "../../models-cooked/environment/level01/hp_door_service_elevator_inner_cyan.glb?url";
import doorResidentialAccessUrl from "../../models-cooked/environment/doors/hp_door_residential_access.glb?url";
import doorClinicMemoryUrl from "../../models-cooked/environment/doors/hp_door_clinic_memory.glb?url";
import doorReclamationArchiveUrl from "../../models-cooked/environment/doors/hp_door_reclamation_archive.glb?url";
import doorIndustrialAccessUrl from "../../models-cooked/environment/doors/hp_door_industrial_access.glb?url";

export const doorEnvironmentModelAssets = {
  door_identity_archive: { modelKey: "door_identity_archive", url: doorIdentityArchiveUrl, category: "door", sizeMeters: [5.2, 3.5, 0.46] },
  door_service_elevator_inner_cyan: {
    modelKey: "door_service_elevator_inner_cyan",
    url: level01ElevatorDoorUrl,
    category: "door",
    sizeMeters: [4.8, 3.24, 0.32],
  },
  room_door_security: { modelKey: "room_door_security", url: roomDoorSecurityUrl, category: "door", sizeMeters: [1.55, 2.35, 0.35] },
  // Premium reusable door families (geometry-owned silhouette, authored at the
  // real opening size so they never stretch). See DoorVisualIntent branches.
  door_residential_access: { modelKey: "door_residential_access", url: doorResidentialAccessUrl, category: "door", sizeMeters: [4.4, 3.3, 0.41] },
  door_clinic_memory: { modelKey: "door_clinic_memory", url: doorClinicMemoryUrl, category: "door", sizeMeters: [4.4, 3.3, 0.42] },
  door_reclamation_archive: { modelKey: "door_reclamation_archive", url: doorReclamationArchiveUrl, category: "door", sizeMeters: [4.4, 3.3, 0.42] },
  door_industrial_access: { modelKey: "door_industrial_access", url: doorIndustrialAccessUrl, category: "door", sizeMeters: [4.4, 3.3, 0.46] },
} as const satisfies EnvironmentModelRegistry;
