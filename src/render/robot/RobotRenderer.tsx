import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Mesh } from "three";
import type { GameWorld } from "../../game/core/GameWorld";
import { robotSkins } from "../../game/skins/robotSkins";
import { ThrusterGlow } from "../effects/ThrusterGlow";
import { getRobotPose } from "./RobotAnimation";
import { useRobotMaterials } from "./RobotMaterials";
import { RobotPart } from "./RobotPart";

interface RobotRendererProps {
  world: GameWorld;
}

export function RobotRenderer({ world }: RobotRendererProps) {
  const skin = robotSkins[world.player.skinId];
  const materials = useRobotMaterials(skin);
  const rootRef = useRef<Group>(null);
  const torsoRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const leftCannonRef = useRef<Group>(null);
  const rightCannonRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const player = world.player;
    const pose = getRobotPose(player, clock.elapsedTime);

    if (rootRef.current) {
      rootRef.current.position.copy(player.position);
      rootRef.current.position.y += pose.hoverY;
      rootRef.current.rotation.y = player.rotationY;
    }
    if (torsoRef.current) {
      torsoRef.current.rotation.x = pose.torsoPitch;
    }
    if (leftArmRef.current) leftArmRef.current.rotation.x = pose.armSwing;
    if (rightArmRef.current) rightArmRef.current.rotation.x = -pose.armSwing;
    if (leftLegRef.current) leftLegRef.current.rotation.x = -pose.legSwing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = pose.legSwing;
    if (leftCannonRef.current) leftCannonRef.current.position.z = -player.cannonRecoil.leftCannon * 0.18;
    if (rightCannonRef.current) rightCannonRef.current.position.z = -player.cannonRecoil.rightCannon * 0.18;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pose.coreScale);
      materials.core.emissiveIntensity = pose.coreIntensity;
      materials.coreHot.emissiveIntensity = pose.coreIntensity + 0.8;
    }
  });

  return (
    <group ref={rootRef} scale={[skin.scale.width, skin.scale.height, skin.scale.bulk]}>
      <group ref={torsoRef}>
        <RobotPart geometry="box" material={materials.body} position={[0, 2.18, 0]} scale={[1.18, 1.22, 0.72]} />
        <RobotPart geometry="box" material={materials.armor} position={[0, 2.36, 0.2]} scale={[1.34, 0.54, 0.28]} />
        <RobotPart geometry="box" material={materials.armorSecondary} position={[0, 1.88, 0.28]} scale={[0.98, 0.34, 0.24]} />
        <RobotPart geometry="sphere" material={materials.core} args={[0.31, 32, 20]} position={[0, 2.26, 0.58]} />
        <mesh ref={coreRef} position={[0, 2.26, 0.59]}>
          <sphereGeometry args={[0.18, 32, 18]} />
          <primitive object={materials.coreHot} attach="material" />
        </mesh>
        <RobotPart geometry="box" material={materials.accent} position={[-0.43, 2.34, 0.62]} scale={[0.08, 0.56, 0.035]} />
        <RobotPart geometry="box" material={materials.accent} position={[0.43, 2.34, 0.62]} scale={[0.08, 0.56, 0.035]} />
      </group>

      <RobotPart geometry="box" material={materials.body} position={[0, 3.02, 0.02]} scale={[0.58, 0.34, 0.48]} />
      <RobotPart geometry="box" material={materials.accent} position={[0, 3.04, 0.31]} scale={[0.42, 0.09, 0.04]} />
      <RobotPart geometry="box" material={materials.armor} position={[0, 3.22, -0.05]} scale={[0.46, 0.12, 0.34]} />

      {skin.partVisibility.antenna ? (
        <>
          <RobotPart geometry="cylinder" material={materials.rim} args={[0.025, 0.025, 0.58, 10]} position={[-0.24, 3.52, -0.02]} rotation={[0.28, 0, 0.1]} />
          <RobotPart geometry="sphere" material={materials.accent} args={[0.055, 12, 8]} position={[-0.31, 3.78, -0.11]} />
        </>
      ) : null}

      <RobotPart geometry="box" material={materials.armor} position={[-0.9, 2.54, 0]} scale={[0.52, 0.34, 0.74]} />
      <RobotPart geometry="box" material={materials.armor} position={[0.9, 2.54, 0]} scale={[0.52, 0.34, 0.74]} />

      <group ref={leftArmRef} position={[-1.1, 2.18, 0.05]}>
        <RobotPart geometry="box" material={materials.body} position={[0, 0.03, 0]} scale={[0.28, 0.72, 0.3]} />
        <RobotPart geometry="box" material={materials.armorSecondary} position={[0, -0.42, 0.22]} scale={[0.34, 0.56, 0.38]} />
        <group ref={leftCannonRef}>
          <RobotPart geometry="cylinder" material={materials.body} args={[0.16, 0.19, 0.74, 20]} position={[0, -0.42, 0.58]} rotation={[Math.PI / 2, 0, 0]} />
          <RobotPart geometry="cylinder" material={materials.accent} args={[0.07, 0.07, 0.8, 16]} position={[0, -0.42, 0.74]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      </group>

      <group ref={rightArmRef} position={[1.1, 2.18, 0.05]}>
        <RobotPart geometry="box" material={materials.body} position={[0, 0.03, 0]} scale={[0.28, 0.72, 0.3]} />
        <RobotPart geometry="box" material={materials.armorSecondary} position={[0, -0.42, 0.22]} scale={[0.34, 0.56, 0.38]} />
        <group ref={rightCannonRef}>
          <RobotPart geometry="cylinder" material={materials.body} args={[0.16, 0.19, 0.74, 20]} position={[0, -0.42, 0.58]} rotation={[Math.PI / 2, 0, 0]} />
          <RobotPart geometry="cylinder" material={materials.accent} args={[0.07, 0.07, 0.8, 16]} position={[0, -0.42, 0.74]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      </group>

      <RobotPart geometry="box" material={materials.body} position={[0, 1.42, 0]} scale={[0.9, 0.34, 0.58]} />
      <group ref={leftLegRef} position={[-0.42, 0.85, 0]}>
        <RobotPart geometry="box" material={materials.body} position={[0, 0.42, 0]} scale={[0.34, 0.76, 0.34]} />
        <RobotPart geometry="box" material={materials.armor} position={[0, -0.18, 0.08]} scale={[0.42, 0.68, 0.42]} />
        <RobotPart geometry="box" material={materials.accent} position={[0, -0.12, 0.34]} scale={[0.2, 0.04, 0.04]} />
        <RobotPart geometry="box" material={materials.body} position={[0, -0.76, 0.2]} scale={[0.62, 0.24, 0.92]} />
      </group>
      <group ref={rightLegRef} position={[0.42, 0.85, 0]}>
        <RobotPart geometry="box" material={materials.body} position={[0, 0.42, 0]} scale={[0.34, 0.76, 0.34]} />
        <RobotPart geometry="box" material={materials.armor} position={[0, -0.18, 0.08]} scale={[0.42, 0.68, 0.42]} />
        <RobotPart geometry="box" material={materials.accent} position={[0, -0.12, 0.34]} scale={[0.2, 0.04, 0.04]} />
        <RobotPart geometry="box" material={materials.body} position={[0, -0.76, 0.2]} scale={[0.62, 0.24, 0.92]} />
      </group>

      {skin.partVisibility.shoulderCannons ? (
        <>
          <RobotPart geometry="cylinder" material={materials.body} args={[0.13, 0.16, 0.9, 18]} position={[-0.52, 2.9, 0.48]} rotation={[Math.PI / 2, 0, 0]} />
          <RobotPart geometry="cylinder" material={materials.body} args={[0.13, 0.16, 0.9, 18]} position={[0.52, 2.9, 0.48]} rotation={[Math.PI / 2, 0, 0]} />
          <RobotPart geometry="box" material={materials.accent} position={[-0.52, 2.9, 0.94]} scale={[0.16, 0.04, 0.08]} />
          <RobotPart geometry="box" material={materials.accent} position={[0.52, 2.9, 0.94]} scale={[0.16, 0.04, 0.08]} />
        </>
      ) : null}

      {skin.partVisibility.backThrusters ? (
        <>
          <RobotPart geometry="box" material={materials.armorSecondary} position={[-0.34, 2.16, -0.5]} scale={[0.3, 0.56, 0.28]} />
          <RobotPart geometry="box" material={materials.armorSecondary} position={[0.34, 2.16, -0.5]} scale={[0.3, 0.56, 0.28]} />
          <ThrusterGlow world={world} position={[-0.34, 1.96, -0.82]} />
          <ThrusterGlow world={world} position={[0.34, 1.96, -0.82]} />
        </>
      ) : null}
    </group>
  );
}
