import { useEffect, useMemo, useState } from "react";
import { InstancedMesh, Matrix4, Mesh, Object3D } from "three";
import {
  getLoadedEnvironmentModelIfReady,
  loadEnvironmentModelAsset,
  type EnvironmentModelKey,
} from "../../assets/environmentModelAssets";

export interface EnvironmentModelTransform {
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number] | number;
}

interface InstancedEnvironmentModelSetProps {
  modelKey: EnvironmentModelKey;
  instances: readonly EnvironmentModelTransform[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function InstancedEnvironmentModelSet({
  modelKey,
  instances,
  castShadow = true,
  receiveShadow = true,
}: InstancedEnvironmentModelSetProps) {
  const source = useEnvironmentModelSource(modelKey);
  const meshes = useMemo(() => {
    if (!source) return [];
    source.updateMatrixWorld(true);
    const sourceMeshes: Mesh[] = [];
    source.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) sourceMeshes.push(mesh);
    });

    const root = new Object3D();
    const finalMatrix = new Matrix4();
    return sourceMeshes.map((sourceMesh) => {
      const instanced = new InstancedMesh(sourceMesh.geometry, sourceMesh.material, instances.length);
      instanced.castShadow = castShadow;
      instanced.receiveShadow = receiveShadow;

      instances.forEach((instance, index) => {
        const scale = instance.scale ?? 1;
        root.position.fromArray(instance.position ?? [0, 0, 0]);
        root.rotation.set(...(instance.rotation ?? [0, 0, 0]));
        if (typeof scale === "number") root.scale.setScalar(scale);
        else root.scale.fromArray(scale);
        root.updateMatrix();
        finalMatrix.multiplyMatrices(root.matrix, sourceMesh.matrixWorld);
        instanced.setMatrixAt(index, finalMatrix);
      });
      instanced.instanceMatrix.needsUpdate = true;
      return instanced;
    });
  }, [castShadow, instances, receiveShadow, source]);

  return (
    <>
      {meshes.map((mesh, index) => (
        <primitive key={`${modelKey}:${index}`} object={mesh} />
      ))}
    </>
  );
}

function useEnvironmentModelSource(modelKey: EnvironmentModelKey) {
  const [source, setSource] = useState(() => getLoadedEnvironmentModelIfReady(modelKey));

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
