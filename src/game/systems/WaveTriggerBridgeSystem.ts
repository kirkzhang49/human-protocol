import type { LevelWaveTriggerDefinition, WaveDefinition } from "../config/schema/levelConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld, ObjectiveEvent } from "../core/GameWorld";
import { isRoomReachableThroughOpenDoors } from "../core/RoomReachability";

export class WaveTriggerBridgeSystem implements GameSystem {
  update(world: GameWorld) {
    if (world.session.mode !== "playing") return;

    const events = world.consumeObjectiveEvents();
    if (events.length === 0) return;

    for (const event of events) {
      for (const wave of world.level.waves) {
        if (!wave.trigger || !triggerMatches(wave.trigger, event)) continue;
        if (!canTriggerWave(world, wave)) continue;
        world.queueWaveStart(wave.id, wave.trigger.delay ?? wave.startDelay, event);
      }
    }
  }
}

function canTriggerWave(world: GameWorld, wave: WaveDefinition) {
  if (world.session.activeWaveId === wave.id) return false;
  if (world.session.mapProgress.triggeredWaveIds.includes(wave.id)) return false;
  if (world.session.mapProgress.completedWaveIds.includes(wave.id)) return false;
  if (wave.trigger?.type === "room_entered" && !isRoomReachableThroughOpenDoors(world, wave.roomId ?? wave.trigger.id)) return false;
  return true;
}

function triggerMatches(trigger: LevelWaveTriggerDefinition, event: ObjectiveEvent) {
  if (trigger.type !== event.type) return false;
  if (typeof trigger.threshold === "number" && typeof event.value === "number" && event.value > trigger.threshold) return false;
  if (typeof trigger.threshold === "number" && typeof event.value !== "number") return false;
  if (trigger.optionId && trigger.optionId !== event.optionId) return false;
  return !trigger.id || trigger.id === event.id;
}
