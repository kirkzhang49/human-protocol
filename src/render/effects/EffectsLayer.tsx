import type { GameWorld } from "../../game/core/GameWorld";
import { BatchedEffects } from "./BatchedEffects";
import { PickupRenderer } from "./PickupRenderer";
import { ProjectileRenderer } from "./ProjectileRenderer";
import { UltimateAbilityRenderer } from "./UltimateAbilityRenderer";

interface EffectsLayerProps {
  world: GameWorld;
}

export function EffectsLayer({ world }: EffectsLayerProps) {
  return (
    <>
      <ProjectileRenderer world={world} />
      <PickupRenderer world={world} />
      <UltimateAbilityRenderer world={world} />
      <BatchedEffects world={world} />
    </>
  );
}
