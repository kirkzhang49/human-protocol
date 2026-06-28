import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class DialogueSystem implements GameSystem {
  runWhenPaused = true;

  update(world: GameWorld, delta: number) {
    const session = world.session;

    if (!session.activeDialogue && session.dialogueQueue.length > 0) {
      session.activeDialogue = session.dialogueQueue.shift() ?? null;
    }

    if (!session.activeDialogue) return;

    session.activeDialogue.remaining -= delta;
    if (session.activeDialogue.remaining <= 0) {
      session.activeDialogue = null;
    }
  }
}
