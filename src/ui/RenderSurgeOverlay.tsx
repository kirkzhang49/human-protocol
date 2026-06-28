import type { GameWorld } from "../game/core/GameWorld";
import { shallowEqualSnapshot, usePolledSnapshot } from "./usePolledSnapshot";

interface RenderSurgeOverlayProps {
  world: GameWorld;
}

interface RenderSurgeSnapshot {
  active: boolean;
  id: number;
  progress: number;
  intensity: number;
}

export function RenderSurgeOverlay({ world }: RenderSurgeOverlayProps) {
  const snapshot = usePolledSnapshot(() => readRenderSurge(world), 40, shallowEqualSnapshot);

  if (!snapshot.active) return null;

  return (
    <div
      key={snapshot.id}
      className="render-surge"
      style={
        {
          "--surge-progress": snapshot.progress,
          "--surge-intensity": snapshot.intensity,
        } as React.CSSProperties
      }
      aria-hidden="true"
    />
  );
}

function readRenderSurge(world: GameWorld): RenderSurgeSnapshot {
  const total = world.session.renderSurgeTotal;
  const remaining = world.session.renderSurgeRemaining;
  const active = world.session.mode === "playing" && total > 0 && remaining > 0;

  return {
    active,
    id: world.session.renderSurgeId,
    progress: active ? Math.round((1 - remaining / total) * 100) / 100 : 1,
    intensity: active ? Math.round(world.session.renderSurgeIntensity * 100) / 100 : 0,
  };
}
