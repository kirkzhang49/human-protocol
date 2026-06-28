import { AdditiveBlending } from "three";
import { EnvironmentModelInstance } from "../../render/environment/EnvironmentModelInstance";
import { orbColorHex } from "../BuilderPuzzleCatalog";
import { puzzleConsoleModelKey } from "../BuilderPuzzleRuntimeRegistry";
import type { BuilderPuzzleInstance } from "../BuilderTypes";

/**
 * Puzzle console preview mesh: the cooked GLB plus a per-kind signal overlay
 * (lamp dots / archive plate / gallery ring / generic core). Extracted verbatim
 * from BuilderPreview3D — model key comes from the puzzle runtime registry and
 * the overlay visuals are unchanged.
 */
export function PuzzleMachineMesh({ instance, accent }: { instance: BuilderPuzzleInstance; accent: string }) {
  return (
    <group>
      <EnvironmentModelInstance modelKey={puzzleConsoleModelKey(instance.kind)} position={[0, 0, 0]} scale={1} />
      <PuzzleMachineSignalOverlay instance={instance} accent={accent} />
    </group>
  );
}

function PuzzleMachineSignalOverlay({ instance, accent }: { instance: BuilderPuzzleInstance; accent: string }) {
  if (instance.kind === "valve_matrix") return null;
  if (instance.kind === "color_sequence") {
    const colors = (instance.components ?? []).map((component) => orbColorHex(component.role)).slice(0, 7);
    const dots = colors.length >= 2 ? colors : ["#ff5b4c", "#4f8cff", "#ffd65a", "#5fd47a"];
    const spread = Math.min(0.86, dots.length * 0.14);
    return (
      <group position={[0, 0, 0]}>
        {dots.map((hex, index) => {
          const t = dots.length <= 1 ? 0.5 : index / (dots.length - 1);
          return (
            <mesh key={`${hex}-${index}`} position={[-spread / 2 + spread * t, 1.1, -0.145]}>
              <sphereGeometry args={[0.045, 14, 10]} />
              <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={1.1} roughness={0.24} />
            </mesh>
          );
        })}
      </group>
    );
  }
  if (instance.kind === "archive_merge") {
    return (
      <mesh position={[0.31, 1.46, -0.25]}>
        <boxGeometry args={[0.12, 0.08, 0.035]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.95} roughness={0.2} />
      </mesh>
    );
  }
  if (instance.kind === "gallery_reading") {
    return (
      <mesh position={[0, 1.42, -0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.012, 8, 40]} />
        <meshBasicMaterial color={accent} transparent opacity={0.55} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 1.22, -0.22]}>
      <sphereGeometry args={[0.055, 14, 10]} />
      <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} roughness={0.24} />
    </mesh>
  );
}
