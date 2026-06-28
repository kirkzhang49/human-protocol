import { EnvironmentModelInstance } from "../../render/environment/EnvironmentModelInstance";

/**
 * Route-switch console preview mesh: the cooked GLB plus four output status
 * lamps. Extracted verbatim from BuilderPreview3D — visuals are unchanged.
 */
export function RouteSwitchMesh({ selected, hovered }: { selected: boolean; hovered: boolean }) {
  const emissive = selected ? 1.1 : hovered ? 0.8 : 0.45;
  return (
    <group>
      <EnvironmentModelInstance modelKey="builder_route_switch_console" position={[0, 0, 0]} scale={1} />
      {[-0.36, -0.12, 0.12, 0.36].map((offset, index) => (
        <mesh key={offset} position={[offset, 0.72, -0.32]}>
          <boxGeometry args={[0.12, 0.035, 0.05]} />
          <meshStandardMaterial
            color={index === 0 ? "#ff5b4c" : index === 1 ? "#ffd76b" : index === 2 ? "#7bb7ff" : "#5fd47a"}
            emissive={index === 0 ? "#ff5b4c" : index === 1 ? "#ffd76b" : index === 2 ? "#7bb7ff" : "#5fd47a"}
            emissiveIntensity={emissive * 0.7}
          />
        </mesh>
      ))}
    </group>
  );
}
