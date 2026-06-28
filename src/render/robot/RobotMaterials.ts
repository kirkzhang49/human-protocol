import { useEffect, useMemo } from "react";
import { MeshStandardMaterial } from "three";
import type { RobotSkin } from "../../game/skins/SkinTypes";

export interface RobotMaterials {
  body: MeshStandardMaterial;
  armor: MeshStandardMaterial;
  armorSecondary: MeshStandardMaterial;
  joint: MeshStandardMaterial;
  core: MeshStandardMaterial;
  coreHot: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  rim: MeshStandardMaterial;
}

export function useRobotMaterials(skin: RobotSkin) {
  const materials = useMemo<RobotMaterials>(
    () => ({
      body: new MeshStandardMaterial({
        color: skin.colors.body,
        metalness: skin.material.bodyMetalness,
        roughness: skin.material.bodyRoughness,
      }),
      armor: new MeshStandardMaterial({
        color: skin.colors.armor,
        metalness: skin.material.armorMetalness,
        roughness: skin.material.armorRoughness,
      }),
      armorSecondary: new MeshStandardMaterial({
        color: skin.colors.armorSecondary,
        metalness: 0.72,
        roughness: 0.32,
      }),
      joint: new MeshStandardMaterial({
        color: skin.colors.joint,
        metalness: 0.86,
        roughness: 0.46,
      }),
      core: new MeshStandardMaterial({
        color: skin.colors.core,
        emissive: skin.colors.core,
        emissiveIntensity: skin.material.glowIntensity,
        metalness: 0.25,
        roughness: 0.18,
        toneMapped: false,
      }),
      coreHot: new MeshStandardMaterial({
        color: skin.colors.coreHot,
        emissive: skin.colors.coreHot,
        emissiveIntensity: skin.material.glowIntensity * 1.25,
        metalness: 0.1,
        roughness: 0.1,
        toneMapped: false,
      }),
      accent: new MeshStandardMaterial({
        color: skin.colors.accent,
        emissive: skin.colors.accent,
        emissiveIntensity: 1.1,
        metalness: 0.35,
        roughness: 0.22,
        toneMapped: false,
      }),
      rim: new MeshStandardMaterial({
        color: skin.colors.rim,
        emissive: skin.colors.rim,
        emissiveIntensity: 0.55,
        metalness: 0.42,
        roughness: 0.25,
      }),
    }),
    [skin],
  );

  useEffect(
    () => () => {
      Object.values(materials).forEach((material) => material.dispose());
    },
    [materials],
  );

  return materials;
}
