import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class PuzzleSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    world.updatePuzzleFeedback(delta);
  }
}
