import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

/**
 * Advances the transient 3D target-reveal camera (route switch / puzzle door).
 * Mirrors the SceneFlowSystem / exit-cinematic timer pattern: the reveal lives
 * on `session.activeFocusReveal` and is cleared when it elapses. The camera rigs
 * read the same state to glide to the target; InputSystem freezes the player
 * while it is active.
 */
export class FocusRevealSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    world.updateFocusReveal(delta);
  }
}
