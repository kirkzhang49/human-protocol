import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class DeathReviveSystem implements GameSystem {
  update(world: GameWorld) {
    if (world.session.mode !== "playing") return;

    const fatalThreshold = Math.max(0.001, world.player.maxHealth * 0.005);
    if (world.player.health <= fatalThreshold) {
      world.player.health = 0;
      world.enterDeath("combat", "你倒下了，但还有一次急救机会。");
    }
  }
}
