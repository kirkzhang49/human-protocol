import type { EnvironmentModelKey } from "../../../assets/environmentModelAssets";
import type { LevelDoorDefinition } from "../../config/schema/levelConfig";

export interface DoorVisualIntent {
  modelKey: EnvironmentModelKey;
}

export function doorVisualIntentForDefinition(door: LevelDoorDefinition): DoorVisualIntent {
  if (door.skinKey === "identity_archive") return { modelKey: "door_identity_archive" };
  if (door.visualKey === "museum_gallery_door") return { modelKey: "age_museum_gallery_door" };
  if (door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero") {
    return { modelKey: "door_service_elevator_inner_cyan" };
  }
  // Premium reusable interior door families (replace the stretched generic
  // security door on L2 residential / L4 clinic / L5 reclamation interiors).
  if (door.visualKey === "residential_access_door") return { modelKey: "door_residential_access" };
  if (door.visualKey === "clinic_memory_door") return { modelKey: "door_clinic_memory" };
  if (door.visualKey === "reclamation_archive_door") return { modelKey: "door_reclamation_archive" };
  // Industrial maintenance/hazard door family — also upgrades the legacy
  // yellow_access_door (the old generic stretched interior) everywhere.
  if (door.visualKey === "industrial_access_door" || door.visualKey === "yellow_access_door") {
    return { modelKey: "door_industrial_access" };
  }
  return { modelKey: door.visualKey.includes("identity") ? "door_identity_archive" : "room_door_security" };
}
