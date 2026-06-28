import { Vector3 } from "three";
import { gameBalance } from "../config/gameBalance";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class CameraFollowSystem implements GameSystem {
  private readonly desiredLookAhead = new Vector3();

  update(world: GameWorld, delta: number) {
    const player = world.player;
    const targetBlend = 1 - Math.exp(-gameBalance.cameraLookAheadSmoothing * delta);
    this.desiredLookAhead.copy(player.aimDirection).multiplyScalar(gameBalance.cameraLookAhead);
    world.camera.lookAhead.lerp(this.desiredLookAhead, targetBlend);
    world.camera.target.copy(player.position).add(world.camera.lookAhead);
  }
}
