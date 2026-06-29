import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

export class PhysicsSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    world.ensurePhysicsReady();
    if (!world.physics.ready) {
      world.syncDynamicPropsFromPhysics(delta);
      return;
    }
    world.syncPhysicsStaticObstacles();
    world.syncPhysicsDynamicProps();
    world.physics.step(delta);
    world.syncDynamicPropsFromPhysics(delta);
    publishPhysicsDebugSnapshot(world);
  }
}

function publishPhysicsDebugSnapshot(world: GameWorld) {
  if (typeof window === "undefined") return;
  if (world.debugOptions.physicsMode !== "rapier" && !window.location.search.includes("physicsDebug=1")) return;
  (window as typeof window & {
    __humanProtocolPhysicsDebug?: ReturnType<GameWorld["physicsDebugSnapshot"]>;
  }).__humanProtocolPhysicsDebug = world.physicsDebugSnapshot();
}
