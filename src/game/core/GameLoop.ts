import type { Camera } from "three";
import type { KeyboardMouseInput } from "../../input/KeyboardMouseInput";
import type { GameWorld } from "./GameWorld";
import { Time } from "./Time";

export interface SystemContext {
  input: KeyboardMouseInput;
  camera: Camera;
}

export interface GameSystem {
  runWhenPaused?: boolean;
  update(world: GameWorld, delta: number, elapsed: number, context: SystemContext): void;
}

export class GameLoop {
  readonly time = new Time();

  constructor(private readonly systems: readonly GameSystem[]) {}

  update(world: GameWorld, rawDelta: number, context: SystemContext) {
    const delta = this.time.step(rawDelta);
    const simulationDelta = world.consumeCombatDelta(delta);
    world.frameTimeMs = simulationDelta * 1000;
    world.frameIndex = this.time.frame;

    for (const system of this.systems) {
      if (world.paused && !system.runWhenPaused) {
        continue;
      }
      try {
        system.update(world, simulationDelta, this.time.elapsed, context);
      } catch (error) {
        // Isolate systems: one throwing system (e.g. a localStorage write during
        // level-completion settlement, or a renderer-adjacent edge case) must not
        // propagate out of the loop and freeze the whole frame/render path. Log
        // and continue so the game stays alive and recoverable.
        console.error(`[HumanProtocol] system "${system.constructor?.name ?? "unknown"}" threw; continuing frame.`, error);
      }
    }
  }
}
