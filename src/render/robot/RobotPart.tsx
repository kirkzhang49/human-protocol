import { RoundedBox } from "@react-three/drei";
import type { Material } from "three";

type GeometryKind = "box" | "sphere" | "cylinder" | "cone";

interface RobotPartProps {
  geometry: GeometryKind;
  material: Material;
  args?: readonly number[];
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function RobotPart({
  geometry,
  material,
  args,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  castShadow = true,
  receiveShadow = true,
}: RobotPartProps) {
  if (geometry === "box") {
    return (
      <RoundedBox
        args={(args ?? [1, 1, 1]) as [number, number, number]}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        material={material}
        position={position}
        rotation={rotation}
        scale={scale}
        radius={0.035}
        smoothness={2}
      />
    );
  }

  return (
    <mesh
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {geometry === "sphere" ? (
        <sphereGeometry args={(args ?? [0.5, 24, 16]) as [number, number, number]} />
      ) : null}
      {geometry === "cylinder" ? (
        <cylinderGeometry args={(args ?? [0.5, 0.5, 1, 24]) as [number, number, number, number]} />
      ) : null}
      {geometry === "cone" ? (
        <coneGeometry args={(args ?? [0.5, 1, 24]) as [number, number, number]} />
      ) : null}
    </mesh>
  );
}
