import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

/**
 * Advances short first-person hand interactions such as wall-mounted door
 * controls. The interaction stays in playing mode so doors and reveals keep
 * running, but input is frozen while the hand reaches the control.
 */
export class HandInteractionSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    world.updateHandInteraction(delta);
  }
}
