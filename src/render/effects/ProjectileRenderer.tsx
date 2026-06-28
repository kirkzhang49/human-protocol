import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { gameBalance } from "../../game/config/gameBalance";
import type { GameWorld } from "../../game/core/GameWorld";
import { weaponSkins } from "../../game/skins/weaponSkins";

const FORWARD = new Vector3(0, 0, 1);

interface ProjectileRendererProps {
  world: GameWorld;
}

export function ProjectileRenderer({ world }: ProjectileRendererProps) {
  const coreRef = useRef<InstancedMesh>(null);
  const trailRef = useRef<InstancedMesh>(null);
  const scratch = useMemo(
    () => ({
      root: new Object3D(),
      local: new Object3D(),
      quaternion: new Quaternion(),
      matrix: new Matrix4(),
      color: new Color(),
    }),
    [],
  );

  useFrame(() => {
    const core = coreRef.current;
    const trail = trailRef.current;
    if (!core || !trail) return;
    ensureInstanceAlpha(core, gameBalance.projectilePoolSize);
    ensureInstanceAlpha(trail, gameBalance.projectilePoolSize);

    const count = Math.min(world.projectiles.length, gameBalance.projectilePoolSize, world.renderPerformance.quality.projectilePoolSize);
    for (let index = 0; index < count; index += 1) {
      const projectile = world.projectiles[index];
      const life = 1 - projectile.age / projectile.lifetime;
      const skin = weaponSkins[projectile.weaponId];
      scratch.quaternion.setFromUnitVectors(FORWARD, projectile.direction);
      scratch.root.position.copy(projectile.position);
      scratch.root.quaternion.copy(scratch.quaternion);
      scratch.root.scale.setScalar(1);
      scratch.root.updateMatrix();

      scratch.color.set(skin.boltColor);
      writeProjectilePart(core, index, scratch, scratch.color, 0.5 + life * 0.5, [0, 0, 0], [Math.PI / 2, 0, 0]);
      scratch.color.set(skin.trailColor);
      writeProjectilePart(trail, index, scratch, scratch.color, Math.max(0.12, life * 0.52), [0, 0, -0.32], [Math.PI / 2, 0, 0]);
    }

    finishMesh(core, count);
    finishMesh(trail, count);
  });

  return (
    <>
      <instancedMesh ref={coreRef} args={[undefined, undefined, gameBalance.projectilePoolSize]}>
        <cylinderGeometry args={[0.065, 0.065, 0.78, 14]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={trailRef} args={[undefined, undefined, gameBalance.projectilePoolSize]}>
        <cylinderGeometry args={[0.16, 0.03, 0.74, 14]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function writeProjectilePart(
  mesh: InstancedMesh,
  index: number,
  scratch: {
    root: Object3D;
    local: Object3D;
    matrix: Matrix4;
  },
  color: Color,
  alpha: number,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number],
) {
  scratch.local.position.fromArray(position);
  scratch.local.rotation.set(...rotation);
  scratch.local.scale.setScalar(1);
  scratch.local.updateMatrix();
  scratch.matrix.multiplyMatrices(scratch.root.matrix, scratch.local.matrix);
  mesh.setMatrixAt(index, scratch.matrix);
  if (markInstanceColorDirty(mesh, index, color.getHex())) {
    mesh.setColorAt(index, color);
  }
  setInstanceAlpha(mesh, index, alpha);
}

function markInstanceColorDirty(mesh: InstancedMesh, index: number, colorKey: number) {
  const userData = mesh.userData as {
    hpProjectileColorKeys?: Int32Array;
    hpProjectileColorDirty?: boolean;
  };
  const capacity = mesh.instanceMatrix.count;
  if (!userData.hpProjectileColorKeys || userData.hpProjectileColorKeys.length < capacity) {
    userData.hpProjectileColorKeys = new Int32Array(capacity).fill(-1);
  }
  if (mesh.instanceColor && userData.hpProjectileColorKeys[index] === colorKey) return false;
  userData.hpProjectileColorKeys[index] = colorKey;
  userData.hpProjectileColorDirty = true;
  return true;
}

function ensureInstanceAlpha(mesh: InstancedMesh, capacity: number) {
  if (!mesh.geometry.getAttribute("instanceAlpha")) {
    mesh.geometry.setAttribute("instanceAlpha", new InstancedBufferAttribute(new Float32Array(capacity), 1));
  }
  const material = mesh.material as MeshBasicMaterial & { userData: { instanceAlphaPatched?: boolean } };
  if (material.userData.instanceAlphaPatched) return;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "attribute float instanceAlpha;\nvarying float vInstanceAlpha;\nvoid main() {")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vInstanceAlpha = instanceAlpha;");
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying float vInstanceAlpha;\nvoid main() {")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse, opacity * vInstanceAlpha );");
  };
  material.userData.instanceAlphaPatched = true;
  material.needsUpdate = true;
}

function setInstanceAlpha(mesh: InstancedMesh, index: number, alpha: number) {
  const attribute = mesh.geometry.getAttribute("instanceAlpha") as InstancedBufferAttribute | undefined;
  if (!attribute) return;
  attribute.setX(index, alpha);
}

function finishMesh(mesh: InstancedMesh, count: number) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  const userData = mesh.userData as {
    hpProjectileColorKeys?: Int32Array;
    hpProjectileColorDirty?: boolean;
    hpProjectileLiveCount?: number;
  };
  const previousLiveCount = userData.hpProjectileLiveCount ?? 0;
  if (userData.hpProjectileColorKeys && count < previousLiveCount) {
    for (let index = count; index < previousLiveCount; index += 1) {
      userData.hpProjectileColorKeys[index] = -1;
    }
  }
  userData.hpProjectileLiveCount = count;
  if (mesh.instanceColor && userData.hpProjectileColorDirty) {
    mesh.instanceColor.needsUpdate = true;
    userData.hpProjectileColorDirty = false;
  }
  const alpha = mesh.geometry.getAttribute("instanceAlpha") as InstancedBufferAttribute | undefined;
  if (alpha) alpha.needsUpdate = true;
}
