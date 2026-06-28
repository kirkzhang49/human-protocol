import { AdditiveBlending } from "three";
import type { BuilderSemanticGraph, SemanticLinkRole, SemanticMarkerKind } from "../builderDependencyGraph";

/**
 * Toggleable 3D "semantic overlay": draws a colour-coded marker per level-logic
 * entity (exit / puzzle / lock / story / enemy) plus the key→lock dependency
 * lines, turning the diorama from "a room of furniture" into a readable level
 * graph. Markers are static (no per-frame animation) so it scales to large
 * levels without competing with the existing selection ring for draw budget.
 */
/** Shared marker palette — also drives the HTML legend (BuilderOverlayLegend). */
export const SEMANTIC_MARKER_COLOR: Record<SemanticMarkerKind, string> = {
  exit: "#34d27a",
  puzzle: "#a06bff",
  lock: "#ffae3b",
  story: "#ffd86b",
  enemy: "#ff4d3d",
};

const MARKER_RADIUS: Record<SemanticMarkerKind, number> = {
  exit: 1.2,
  puzzle: 0.72,
  lock: 0.6,
  story: 0.5,
  enemy: 0.55,
};

export const SEMANTIC_LINK_COLOR: Record<SemanticLinkRole, string> = {
  key: "#ffae3b",
  puzzle: "#a06bff",
  wave: "#ff4d3d",
};

const MARKER_COLOR = SEMANTIC_MARKER_COLOR;
const LINK_COLOR = SEMANTIC_LINK_COLOR;

export function BuilderSemanticOverlay({ graph }: { graph: BuilderSemanticGraph }) {
  return (
    <group>
      {graph.links.map((link, index) => {
        const [x1, z1] = link.from;
        const [x2, z2] = link.to;
        const length = Math.hypot(x2 - x1, z2 - z1);
        if (length < 0.05) return null;
        return (
          <mesh
            key={`semantic-link-${index}`}
            position={[(x1 + x2) / 2, 0.12, (z1 + z2) / 2]}
            rotation={[0, Math.atan2(x2 - x1, z2 - z1), 0]}
          >
            <boxGeometry args={[0.07, 0.02, length]} />
            <meshBasicMaterial
              color={LINK_COLOR[link.role]}
              transparent
              opacity={0.55}
              toneMapped={false}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}
      {graph.markers.map((marker) => {
        const color = MARKER_COLOR[marker.kind];
        const radius = MARKER_RADIUS[marker.kind];
        return (
          <group key={marker.id} position={[marker.x, 0, marker.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
              <ringGeometry args={[radius, radius + 0.16, 32]} />
              <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
            </mesh>
            {/* Short vertical pin so the marker reads from a low camera angle. */}
            <mesh position={[0, 0.72, 0]}>
              <boxGeometry args={[0.05, 1.44, 0.05]} />
              <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
