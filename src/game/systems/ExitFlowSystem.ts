import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class ExitFlowSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    world.exitFlow.update(world, delta);
  }
}
