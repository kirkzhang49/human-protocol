import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class PickupSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    if (world.session.mode !== "playing") return;

    this.collectNearbyKeyItems(world);

    for (let index = world.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = world.pickups[index];
      pickup.age += delta;
      const permanentStoryPickup = pickup.type === "ironRod" || pickup.type === "pistol";
      const expires = pickup.expires !== false && !permanentStoryPickup;
      if (pickup.collected || (expires && pickup.age > world.level.pickups.dynamicLifetimeSec)) {
        world.pickups.splice(index, 1);
        continue;
      }

      const dx = pickup.position.x - world.player.position.x;
      const dz = pickup.position.z - world.player.position.z;
      const collectRadius = world.pickupCollectRadius(pickup);
      if (dx * dx + dz * dz <= collectRadius * collectRadius && world.shouldCollectPickup(pickup)) {
        world.collectPickup(pickup);
      }
    }
  }

  private collectNearbyKeyItems(world: GameWorld) {
    for (const item of world.level.map?.keyItems ?? []) {
      if (item.autoCollect === false) continue;
      if (world.session.mapProgress.collectedKeyItemIds.includes(item.id)) continue;
      if (!world.isConfiguredKeyItemAvailable(item)) continue;

      const position = world.keyItemPosition(item);
      const dx = position[0] - world.player.position.x;
      const dz = position[2] - world.player.position.z;
      if (dx * dx + dz * dz <= item.collectRadius * item.collectRadius) {
        world.collectConfiguredKeyItem(item);
      }
    }
  }
}
