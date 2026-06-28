import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class ObjectiveTrackerSystem implements GameSystem {
  update(world: GameWorld) {
    if (world.session.mode !== "playing") return;

    if (
      !world.session.mapProgress.activeObjectiveId &&
      world.session.mapProgress.completedObjectiveIds.length === 0 &&
      world.level.objectiveChain?.length
    ) {
      world.dispatchObjectiveEvent({ type: "level_start" });
    }
  }
}
