import type { GameWorld } from "../game/core/GameWorld";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface CrosshairProps {
  world: GameWorld;
}

export function Crosshair({ world }: CrosshairProps) {
  const snapshot = usePolledSnapshot(
    () => ({
      locked: world.combatAssist.lockedEnemyId !== null,
      // A reveal hands the camera to a facility view; an aiming reticle there
      // would falsely imply the player is still in control.
      revealActive: Boolean(world.session.activeFocusReveal || world.session.activeHandInteraction),
    }),
    100,
    (current, next) => current.locked === next.locked && current.revealActive === next.revealActive,
  );

  if (snapshot.revealActive) return null;

  return (
    <div className={snapshot.locked ? "crosshair locked" : "crosshair"} aria-hidden="true">
      <span className="crosshair-dot" />
    </div>
  );
}
