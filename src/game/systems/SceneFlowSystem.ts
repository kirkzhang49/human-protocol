import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class SceneFlowSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    if (world.session.mode !== "transition") return;
    if (world.session.activeCampaignTransitionDialogue) return;

    world.session.transitionRemaining = Math.max(0, world.session.transitionRemaining - delta);
    if (world.session.transitionRemaining <= 0) {
      world.completeLevel();
    }
  }
}
