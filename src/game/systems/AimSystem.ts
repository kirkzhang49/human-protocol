import { playerConfig } from "../config/playerConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { clamp } from "../core/math";

export class AimSystem implements GameSystem {
  update(world: GameWorld) {
    if (world.session.mode !== "playing") return;

    const player = world.player;
    player.rotationY += world.input.lookDelta.x * playerConfig.lookSensitivity;
    player.cameraPitch = clamp(
      player.cameraPitch - world.input.lookDelta.y * playerConfig.lookSensitivity,
      playerConfig.minPitch,
      playerConfig.maxPitch,
    );
    player.targetRotationY = player.rotationY;

    const cosPitch = Math.cos(player.cameraPitch);
    player.aimDirection.set(
      Math.sin(player.rotationY) * cosPitch,
      Math.sin(player.cameraPitch),
      -Math.cos(player.rotationY) * cosPitch,
    );
    player.aimPoint.copy(player.position).addScaledVector(player.aimDirection, 24);
  }
}
