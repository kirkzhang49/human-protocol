import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class EnvironmentStateSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    if (world.session.mode !== "playing" && world.session.mode !== "transition") return;
    world.updateTimedEnvironmentStates(delta);
  }
}
