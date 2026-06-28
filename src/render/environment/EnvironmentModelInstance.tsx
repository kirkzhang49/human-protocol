import { useEffect, useMemo, useState } from "react";
import { DoubleSide, SRGBColorSpace, TextureLoader, type Object3D, type Texture } from "three";
import { useLoader } from "@react-three/fiber";
import {
  getLoadedEnvironmentModelIfReady,
  loadEnvironmentModelAsset,
  type EnvironmentModelKey,
} from "../../assets/environmentModelAssets";
import level01HumanBodyReferenceDecalUrl from "../../assets/textures/environment/level01/reference-decals/hp_decal_human_body_reference.png";
import level01HumanHandReferenceDecalUrl from "../../assets/textures/environment/level01/reference-decals/hp_decal_human_hand_reference.png";
import level01HumanSpineReferenceDecalUrl from "../../assets/textures/environment/level01/reference-decals/hp_decal_human_spine_reference.png";
import level01HumanReferenceTriptychDecalUrl from "../../assets/textures/environment/level01/reference-decals/hp_decal_human_reference_triptych.png";

interface EnvironmentModelInstanceProps {
  modelKey: EnvironmentModelKey;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number] | number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  onObjectReady?: (object: Object3D | null) => void;
  configureObject?: (object: Object3D) => void;
}

const referenceDecalSpecs = {
  decal_human_body_reference: { textureUrl: level01HumanBodyReferenceDecalUrl, size: [1, 1] as const },
  decal_human_hand_reference: { textureUrl: level01HumanHandReferenceDecalUrl, size: [1, 1] as const },
  decal_human_spine_reference: { textureUrl: level01HumanSpineReferenceDecalUrl, size: [1, 1] as const },
  decal_human_reference_triptych: { textureUrl: level01HumanReferenceTriptychDecalUrl, size: [2.46, 1.22] as const },
} as const;

function referenceDecalSpec(modelKey: EnvironmentModelKey) {
  return referenceDecalSpecs[modelKey as keyof typeof referenceDecalSpecs] ?? null;
}

export function EnvironmentModelInstance({
  modelKey,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  castShadow = true,
  receiveShadow = true,
  onObjectReady,
  configureObject,
}: EnvironmentModelInstanceProps) {
  const source = useEnvironmentModelSource(modelKey);
  const referenceDecal = referenceDecalSpec(modelKey);
  const scaleVector: [number, number, number] = typeof scale === "number" ? [scale, scale, scale] : [scale[0], scale[1], scale[2]];
  const object = useMemo(() => {
    if (!source) return null;
    const clone = source.clone(true);
    clone.traverse((child: Object3D) => {
      const mesh = child as Object3D & { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
      if (!mesh.isMesh) return;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
    });
    configureObject?.(clone);
    return clone;
  }, [castShadow, configureObject, receiveShadow, source]);

  useEffect(() => {
    onObjectReady?.(object);
    return () => onObjectReady?.(null);
  }, [object, onObjectReady]);

  if (referenceDecal) {
    return <ReferenceDecalPlane spec={referenceDecal} position={position} rotation={rotation} scale={scaleVector} />;
  }

  if (!object) {
    return <EnvironmentModelLoadingPlaceholder position={position} rotation={rotation} scale={scaleVector} />;
  }

  return (
    <primitive
      object={object}
      position={position}
      rotation={rotation}
      scale={scaleVector}
    />
  );
}

function ReferenceDecalPlane({
  spec,
  position,
  rotation,
  scale,
}: {
  spec: NonNullable<ReturnType<typeof referenceDecalSpec>>;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
}) {
  const texture = useLoader(TextureLoader, spec.textureUrl) as Texture;
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  return (
    <group position={[position[0], position[1], position[2]]} rotation={[rotation[0], rotation[1], rotation[2]]} scale={[scale[0], scale[1], scale[2]]}>
      <mesh>
        <planeGeometry args={[spec.size[0], spec.size[1]]} />
        <meshBasicMaterial map={texture} transparent side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function useEnvironmentModelSource(modelKey: EnvironmentModelKey) {
  const [source, setSource] = useState<Object3D | null>(() => getLoadedEnvironmentModelIfReady(modelKey));

  useEffect(() => {
    let cancelled = false;
    const cached = getLoadedEnvironmentModelIfReady(modelKey);
    if (cached) {
      setSource(cached);
      return () => {
        cancelled = true;
      };
    }

    setSource(null);
    loadEnvironmentModelAsset(modelKey).then((loaded) => {
      if (!cancelled) setSource(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [modelKey]);

  return source;
}

function EnvironmentModelLoadingPlaceholder({
  position,
  rotation,
  scale,
}: {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
}) {
  const positionVector: [number, number, number] = [position[0], position[1], position[2]];
  const rotationVector: [number, number, number] = [rotation[0], rotation[1], rotation[2]];
  return (
    <group position={positionVector} rotation={rotationVector} scale={scale}>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.42, 0.08, 0.42]} />
        <meshBasicMaterial color="#79edff" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
