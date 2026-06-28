import type { LevelRuntimeEventAction } from "../../game/config/schema/levelConfig";
import type { BuilderDoor } from "../BuilderTypes";

export function isRouteOpenDoorTargetAllowed(door: BuilderDoor | undefined): boolean {
  return Boolean(door);
}

export function routeOpenDoorActions(door: BuilderDoor | undefined, doorId: string): LevelRuntimeEventAction[] {
  const actions: LevelRuntimeEventAction[] = [];
  if (door?.sourceDoor?.lock?.type === "objective_complete" && door.sourceDoor.lock.objectiveId) {
    actions.push({ type: "complete_objective", objectiveId: door.sourceDoor.lock.objectiveId });
  }
  actions.push(
    { type: "unlock_door", doorId },
    { type: "open_door", doorId },
    { type: "focus_reveal", reveal: { kind: "door", doorId } },
  );
  return actions;
}
