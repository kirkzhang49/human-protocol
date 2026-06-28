import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, DoubleSide, type Group } from "three";
import type { BuilderDoor } from "../BuilderTypes";

/**
 * Small reusable preview primitives shared across the 3D builder stage.
 * Extracted verbatim from BuilderPreview3D — pure presentational meshes with no
 * editing-state coupling, so behavior is unchanged.
 */

/** Warm under-glow lifting a hovered prop's silhouette without a hard outline. */
export function HoverGlow({ radius }: { radius: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[radius, 28]} />
        <meshBasicMaterial color="#ffd9a0" transparent opacity={0.13} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[radius, radius + 0.1, 32]} />
        <meshBasicMaterial color="#ffe9c4" transparent opacity={0.45} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Soft contact shadow disc grounding props/robots on the floor. */
export function BlobShadow({ radius, strength }: { radius: number; strength: number }) {
  if (strength <= 0.01) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
      <circleGeometry args={[radius, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={strength} depthWrite={false} />
    </mesh>
  );
}

/**
 * In-world 2D screen / wall-decal panel for story-clue art and console screens.
 * Absorbs the WGPU-lab decal recipe (addTexturePlane): emissive glass panel that
 * does NOT write depth, sits proud of its host via polygon offset toward the
 * camera, is toneMapped:false (screen glow), double-sided, and renders after the
 * wall but is kept small so it never occludes interaction focus. No baked text —
 * the clue title/copy stays live in the right-panel / interaction copy.
 */
export function WallScreenDecal({
  width,
  height,
  accent,
  yOffset = 1.35,
  zOffset = 0.06,
}: {
  width: number;
  height: number;
  accent: string;
  yOffset?: number;
  zOffset?: number;
}) {
  return (
    <group position={[0, yOffset, 0]}>
      {/* brass frame just behind the glass */}
      <mesh position={[0, 0, -Math.max(0.012, zOffset * 0.55)]}>
        <planeGeometry args={[width + 0.08, height + 0.08]} />
        <meshStandardMaterial color="#3a2c12" roughness={0.5} metalness={0.55} emissive={accent} emissiveIntensity={0.05} />
      </mesh>
      {/* emissive screen glass: depthWrite false + polygon offset toward camera */}
      <mesh position={[0, 0, zOffset]} renderOrder={5}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.46}
          toneMapped={false}
          depthWrite={false}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  );
}

/** Floating, bobbing lock glyph above a locked door: distinct silhouette per lock type. */
export function LockIcon({ lockType, color }: { lockType: BuilderDoor["lockType"]; color: string }) {
  const groupRef = useRef<Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = 1.95 + Math.sin(state.clock.elapsedTime * 1.8) * 0.1;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.9;
  });
  return (
    <group ref={groupRef} position={[0, 1.95, 0]}>
      <mesh>
        {lockType === "key_item" ? (
          <octahedronGeometry args={[0.34]} />
        ) : lockType === "survive_wave" ? (
          <coneGeometry args={[0.3, 0.55, 4]} />
        ) : lockType === "switch_state" ? (
          <boxGeometry args={[0.48, 0.48, 0.18]} />
        ) : (
          <icosahedronGeometry args={[0.32]} />
        )}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
      </mesh>
    </group>
  );
}
