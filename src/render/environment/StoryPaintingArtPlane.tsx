import { useEffect } from "react";
import { useLoader } from "@react-three/fiber";
import { ClampToEdgeWrapping, DoubleSide, SRGBColorSpace, TextureLoader, type Texture } from "three";
import { storyPaintingArtUrl } from "../../game/visual/StoryPaintingArt";

interface StoryPaintingArtPlaneProps {
  modelKey: string;
  width: number;
  height: number;
  yOffset?: number;
  zOffset?: number;
  accent?: string;
}

export function StoryPaintingArtPlane({
  modelKey,
  width,
  height,
  yOffset = 0.72,
  zOffset = 0.075,
  accent = "#ffce8a",
}: StoryPaintingArtPlaneProps) {
  const url = storyPaintingArtUrl(modelKey);
  if (!url) return null;
  return <StoryPaintingArtTexturePlane url={url} width={width} height={height} yOffset={yOffset} zOffset={zOffset} accent={accent} />;
}

function StoryPaintingArtTexturePlane({
  url,
  width,
  height,
  yOffset,
  zOffset,
  accent,
}: {
  url: string;
  width: number;
  height: number;
  yOffset: number;
  zOffset: number;
  accent: string;
}) {
  const texture = useLoader(TextureLoader, url) as Texture;
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  const rail = Math.max(0.035, Math.min(width, height) * 0.055);
  const frameDepth = 0.028;
  const backingZ = -Math.max(0.018, zOffset * 0.55);
  return (
    <group position={[0, yOffset, 0]}>
      <mesh position={[0, 0, backingZ]}>
        <planeGeometry args={[width + rail * 2.7, height + rail * 2.6]} />
        <meshStandardMaterial color="#140f08" roughness={0.54} metalness={0.46} emissive={accent} emissiveIntensity={0.035} />
      </mesh>
      <mesh position={[0, height * 0.5 + rail * 0.5, 0]}>
        <boxGeometry args={[width + rail * 2.5, rail, frameDepth]} />
        <meshStandardMaterial color="#5b3f16" roughness={0.38} metalness={0.64} emissive={accent} emissiveIntensity={0.04} />
      </mesh>
      <mesh position={[0, -height * 0.5 - rail * 0.5, 0]}>
        <boxGeometry args={[width + rail * 2.5, rail, frameDepth]} />
        <meshStandardMaterial color="#5b3f16" roughness={0.38} metalness={0.64} emissive={accent} emissiveIntensity={0.04} />
      </mesh>
      <mesh position={[-width * 0.5 - rail * 0.5, 0, 0]}>
        <boxGeometry args={[rail, height + rail * 2.2, frameDepth]} />
        <meshStandardMaterial color="#2b2113" roughness={0.44} metalness={0.58} emissive={accent} emissiveIntensity={0.025} />
      </mesh>
      <mesh position={[width * 0.5 + rail * 0.5, 0, 0]}>
        <boxGeometry args={[rail, height + rail * 2.2, frameDepth]} />
        <meshStandardMaterial color="#2b2113" roughness={0.44} metalness={0.58} emissive={accent} emissiveIntensity={0.025} />
      </mesh>
      <mesh position={[0, 0, zOffset]} renderOrder={8}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          transparent
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}
