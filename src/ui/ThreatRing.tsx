import type { GameWorld } from "../game/core/GameWorld";
import type { ThreatSegmentState } from "../game/core/GameMode";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface ThreatRingProps {
  world: GameWorld;
}

export function ThreatRing({ world }: ThreatRingProps) {
  const segments = usePolledSnapshot(() => readThreatSegments(world), 90, sameThreatSegments);

  return (
    <div className="threat-ring" aria-hidden="true">
      {segments.map((segment) => (
        <button
          className={`threat-segment s${segment.index}`}
          key={segment.index}
          style={{ "--threat": segment.intensity.toFixed(2) } as React.CSSProperties}
          type="button"
          onPointerDown={() => {
            if (segment.intensity > 0.08) {
              world.touchInput.requestedThreatTurnAngle = segment.angle;
            }
          }}
        />
      ))}
    </div>
  );
}

function readThreatSegments(world: GameWorld) {
  return world.combatAssist.threatSegments.map((segment) => ({
    ...segment,
    intensity: Math.round(segment.intensity * 100) / 100,
  }));
}

function sameThreatSegments(current: ThreatSegmentState[], next: ThreatSegmentState[]) {
  if (current.length !== next.length) return false;
  for (let index = 0; index < current.length; index += 1) {
    const left = current[index];
    const right = next[index];
    if (left.index !== right.index || left.angle !== right.angle || left.intensity !== right.intensity) return false;
  }
  return true;
}
