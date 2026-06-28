import { RoundedBox, useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { AdditiveBlending, ClampToEdgeWrapping, Color, DoubleSide, Group, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, Texture, type Material, type Mesh, type Object3D } from "three";
import refinedIronRodUrl from "../../assets/models/viewmodel/hp_viewmodel_iron_rod_wgpu_battleworn.glb?url";
import refinedSidearmUrl from "../../assets/models/viewmodel/hp_viewmodel_sidearm_wgpu_battleworn.glb?url";
import productionIronRodPrototypeUrl from "../../assets/models/viewmodel/prototypes/hp_viewmodel_iron_rod_production.glb?url";
import productionSidearmPrototypeUrl from "../../assets/models/viewmodel/prototypes/hp_viewmodel_sidearm_production.glb?url";
import scriptedDerivedIronRodPrototypeUrl from "../../assets/models/viewmodel/prototypes/hp_viewmodel_iron_rod_scripted_derived.glb?url";
import scriptedDerivedSidearmLayeredPrototypeUrl from "../../assets/models/viewmodel/prototypes/hp_viewmodel_sidearm_scripted_derived_v2.glb?url";
import referenceRawIronRodPrototypeUrl from "../../assets/models/viewmodel/prototypes/hp_viewmodel_iron_rod_reference_raw_meshopt.glb?url";
import referenceRawSidearmPrototypeUrl from "../../assets/models/viewmodel/prototypes/hp_viewmodel_sidearm_reference_raw_meshopt.glb?url";
import protocolBreachChargeUrl from "../../assets/models-cooked/environment/props/hp_ability_protocol_breach_charge_v1.glb?url";
import protocolBreachMissileUrl from "../../assets/models-cooked/environment/props/hp_ability_protocol_breach_missile_v1.glb?url";
import type { UltimateAbilityId } from "../../game/config/ultimateAbilityConfig";
import viewmodelAtlasUrl from "../../assets/viewmodel/weapon-viewmodel-atlas.jpg";
import type { WeaponId } from "../../game/config/weaponConfig";
import { isExitCinematicViewActive } from "../../game/core/ExitCinematicView";
import { exitButtonTouchProgress } from "../../game/core/ExitCinematicTiming";
import type { GameWorld } from "../../game/core/GameWorld";
import { focusRevealWeaponHidden } from "../focusRevealCamera";
import { ROD_VIEWMODEL_SCREEN_SCALE } from "../viewmodelScaleTuning";
import {
  shouldUseOpaqueSelfDepthForViewmodelMaterial,
  scriptedDerivedSidearmLayerMaterialTuning,
  scriptedDerivedSidearmMotionTuning,
} from "./viewmodelTuning";
import { resolveViewmodelPrototypeModeFromParams, type ViewmodelPrototypeMode } from "./viewmodelPrototypeMode";

interface FirstPersonProtagonistViewProps {
  world: GameWorld;
}

type ViewMaterials = ReturnType<typeof useViewMaterials>;
type TransformTuple = [number, number, number];
type AgedViewmodelMaterialProfile = {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  metalness: number;
  normalScale: number;
  roughness: number;
};
type RodPose = {
  progress: number;
  windup: number;
  strike: number;
  impact: number;
  recover: number;
};
type ViewmodelActionState = {
  weaponId: WeaponId | null;
  prototypeMode: ViewmodelPrototypeMode;
  holdingUltimate: boolean;
  rod: RodPose;
  pistolKick: number;
  muzzleKick: number;
  reloadPose: number;
  recoil: number;
  movement: number;
  elevatorPress: number;
  time: number;
};
type ViewmodelActionRef = MutableRefObject<ViewmodelActionState>;

function createIdleRodPose(): RodPose {
  return { progress: 1, windup: 0, strike: 0, impact: 0, recover: 1 };
}

function createIdleViewmodelActionState(): ViewmodelActionState {
  return {
    weaponId: null,
    prototypeMode: null,
    holdingUltimate: false,
    rod: createIdleRodPose(),
    pistolKick: 0,
    muzzleKick: 0,
    reloadPose: 0,
    recoil: 0,
    movement: 0,
    elevatorPress: 0,
    time: 0,
  };
}

export function FirstPersonProtagonistView({ world }: FirstPersonProtagonistViewProps) {
  const rootRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const ironRodRef = useRef<Group>(null);
  const pistolRef = useRef<Group>(null);
  const coreRef = useRef<Group>(null);
  const missileRef = useRef<Group>(null);
  const actionRef = useRef<ViewmodelActionState>(createIdleViewmodelActionState());
  const rodSwingRef = useRef(0);
  const pistolKickRef = useRef(0);
  const lastFireSequenceRef = useRef(world.player.fireSequence);
  const materials = useViewMaterials();
  const atlasTexture = useViewmodelAtlasTexture();
  const artPreview = isArtPreviewMode();
  const refinedViewmodels = shouldUseRefinedViewmodels();
  const showCombatViewmodelWeapons = shouldShowCombatViewmodelWeapons();
  const viewmodelPrototypeMode = viewmodelPrototypeModeFromUrl();

  useFrame(({ camera, clock }, delta) => {
    if (artPreview) return;

    const player = world.player;
    const exitPress = exitElevatorPressProgress(world);
    const handPress = handInteractionPressProgress(world);
    const handLeverDirection =
      world.session.activeHandInteraction?.handPose === "lever_push_down" ? world.session.activeHandInteraction.leverDirection : null;
    const elevatorPress = Math.max(exitPress, handPress);
    const handInteractionY =
      handLeverDirection === "down" ? -handPress * 0.16 : handLeverDirection === "up" ? handPress * 0.14 : handPress * 0.05;
    const interactionY = exitPress > 0 ? exitPress * 0.05 : handInteractionY;
    const heldUltimate = world.session.deployedUltimate?.phase === "held";
    const combatWeapon = world.weaponUnlocked(player.currentWeapon) && player.currentWeapon !== "flakBurst" ? player.currentWeapon : null;
    const hiddenByHandInteraction = world.session.activeHandInteraction?.hideWeapon === true;
    const hiddenByCinematic = isExitCinematicViewActive(world) || elevatorPress > 0.04 || hiddenByHandInteraction;
    const visibleUltimate = heldUltimate && !hiddenByCinematic;
    const ultimateAbilityId = world.session.deployedUltimate?.abilityId ?? world.session.activeUltimateAbilityId;
    const visibleWeapon = hiddenByCinematic || visibleUltimate ? null : combatWeapon;
    const posedWeapon = showCombatViewmodelWeapons ? visibleWeapon : null;
    const recoil = player.weaponRecoil;
    const hasFired = player.fireSequence !== lastFireSequenceRef.current;
    if (hasFired && posedWeapon === "pulseRifle") rodSwingRef.current = 1;
    if (hasFired && posedWeapon === "railLance") pistolKickRef.current = 1;
    lastFireSequenceRef.current = player.fireSequence;

    rodSwingRef.current = Math.max(0, rodSwingRef.current - delta * 2.75);
    pistolKickRef.current = Math.max(0, pistolKickRef.current - delta * 8.2);
    const rodProgress = clamp01(1 - rodSwingRef.current);
    const rodPose: RodPose = {
      progress: rodProgress,
      windup: easeOutCubic(segment(rodProgress, 0, 0.24)),
      strike: easeInOutCubic(segment(rodProgress, 0.18, 0.56)),
      impact: phase(rodProgress, 0.28, 0.58),
      recover: easeOutCubic(segment(rodProgress, 0.52, 1)),
    };
    const pistolKick = pistolKickRef.current > 0 ? Math.sin((1 - pistolKickRef.current) * Math.PI) : 0;
    const reloadPose = reloadProgress(player.gunReloadRemaining, player.gunReloadDuration, posedWeapon);
    const switchKick = Math.sin(Math.min(1, player.weaponSwitchSequence) * Math.PI) * 0.05;
    const walkSway = Math.sin(clock.elapsedTime * 7.2) * player.movementAmount * 0.03;
    const walkTilt = Math.sin(clock.elapsedTime * 3.6) * player.movementAmount * 0.018;
    const premiumPrototype = viewmodelPrototypeMode === "scriptedDerived";
    const premiumPistolPose = premiumPrototype && posedWeapon === "railLance" ? 1 : 0;
    const premiumRodPose = premiumPrototype && posedWeapon === "pulseRifle" ? 1 : 0;
    const sidearmMotion = premiumPistolPose ? scriptedDerivedSidearmMotionTuning : null;
    const visualPistolKick = sidearmMotion ? pistolKick * sidearmMotion.visualKickScale : pistolKick;
    const premiumIdleX = premiumPrototype ? Math.sin(clock.elapsedTime * 1.45) * (sidearmMotion ? sidearmMotion.rootIdleX : 0.004) : 0;
    const premiumIdleY = premiumPrototype ? Math.sin(clock.elapsedTime * 1.85 + 0.8) * (sidearmMotion ? sidearmMotion.rootIdleY : 0.003) : 0;
    actionRef.current.weaponId = posedWeapon;
    actionRef.current.prototypeMode = viewmodelPrototypeMode;
    actionRef.current.holdingUltimate = visibleUltimate;
    actionRef.current.rod = rodPose;
    actionRef.current.pistolKick = visualPistolKick;
    actionRef.current.muzzleKick = pistolKick;
    actionRef.current.reloadPose = reloadPose;
    actionRef.current.recoil = recoil;
    actionRef.current.movement = player.movementAmount;
    actionRef.current.elevatorPress = elevatorPress;
    actionRef.current.time = clock.elapsedTime;

    // During a 3D focus reveal the facility camera glides away from the player;
    // lower the weapon/hands out of frame (and hide once clear) so the reveal
    // reads as a camera handoff, not a teleport with a glued-on viewmodel.
    // Restores cleanly as the reveal blends back out — never a permanent unequip.
    const revealHidden = focusRevealWeaponHidden(world.session.activeFocusReveal);

    if (rootRef.current) {
      rootRef.current.position.copy(camera.position);
      rootRef.current.quaternion.copy(camera.quaternion);
      rootRef.current.translateX(-0.055 + premiumIdleX + premiumPistolPose * 0.018 + premiumRodPose * 0.025 + rodPose.strike * 0.05 - rodPose.windup * 0.025 + visualPistolKick * (sidearmMotion ? sidearmMotion.rootKickX : 0.014) + elevatorPress * 0.18);
      rootRef.current.translateY(-0.08 + premiumIdleY - premiumPistolPose * 0.008 - premiumRodPose * 0.012 + walkSway - rodPose.impact * 0.035 + reloadPose * 0.025 + interactionY - revealHidden * 1.15);
      rootRef.current.translateZ(-0.04 + premiumPistolPose * 0.028 + premiumRodPose * 0.014 + recoil * 0.08 + switchKick + rodPose.impact * 0.06 + visualPistolKick * (sidearmMotion ? sidearmMotion.rootKickZ : 0.055) - elevatorPress * 0.26 + revealHidden * 0.25);
      rootRef.current.rotateZ(walkTilt + premiumPistolPose * Math.sin(clock.elapsedTime * 1.25 + 0.3) * (sidearmMotion ? sidearmMotion.rootRollIdle : 0.003) + rodPose.strike * 0.035 - visualPistolKick * (sidearmMotion ? sidearmMotion.rootRollKick : 0.025) - elevatorPress * 0.08);
      rootRef.current.visible = revealHidden < 0.985;
    }

    poseArms(posedWeapon, visibleUltimate, viewmodelPrototypeMode, rodPose, visualPistolKick, reloadPose, recoil, elevatorPress, leftArmRef.current, rightArmRef.current);
    poseWeapons(
      posedWeapon,
      visibleUltimate,
      ultimateAbilityId,
      viewmodelPrototypeMode,
      showCombatViewmodelWeapons,
      rodPose,
      visualPistolKick,
      reloadPose,
      recoil,
      ironRodRef.current,
      pistolRef.current,
      coreRef.current,
      missileRef.current,
    );

    materials.rodGhost.opacity = 0.02 + rodPose.strike * 0.08 + rodPose.impact * 0.34;
    materials.rodEdge.opacity = 0.08 + rodPose.strike * 0.12 + rodPose.impact * 0.42;
    materials.muzzleGlow.opacity = pistolKick * 0.78;
    materials.muzzleCore.opacity = pistolKick * 0.92;
    materials.muzzleKnife.opacity = pistolKick * 0.64;
    materials.heat.emissiveIntensity = 0.7 + (player.heat / player.maxHeat) * 2.4;
  });

  if (artPreview) return null;

  return (
    <group ref={rootRef} renderOrder={20}>
      <group ref={leftArmRef}>
        <HumanArm side="left" materials={materials} actionRef={actionRef} />
      </group>
      <group ref={rightArmRef}>
        <HumanArm side="right" materials={materials} actionRef={actionRef} />
      </group>

      {showCombatViewmodelWeapons ? (
        <>
          <group ref={ironRodRef}>
            {refinedViewmodels ? <RefinedIronRod prototypeMode={viewmodelPrototypeMode} /> : <LabIronRod materials={materials} atlasTexture={atlasTexture} />}
          </group>
          <group ref={pistolRef} visible={false}>
            {refinedViewmodels ? <RefinedPistol materials={materials} actionRef={actionRef} prototypeMode={viewmodelPrototypeMode} /> : <LabPistol materials={materials} atlasTexture={atlasTexture} />}
          </group>
        </>
      ) : null}
      <group ref={coreRef} visible={false}>
        <ProtocolBreachChargeViewmodel />
      </group>
      <group ref={missileRef} visible={false}>
        <ProtocolBreachMissileViewmodel />
      </group>
    </group>
  );
}

function isArtPreviewMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("artPreview") === "1" || params.get("roomPreview") === "1";
}

function shouldUseRefinedViewmodels() {
  if (typeof window === "undefined") return true;
  const params = new URLSearchParams(window.location.search);
  return params.get("refinedViewmodels") !== "0";
}

function shouldShowCombatViewmodelWeapons() {
  if (typeof window === "undefined") return true;
  const params = new URLSearchParams(window.location.search);
  return params.get("combatViewmodelWeapons") !== "0";
}

function viewmodelPrototypeModeFromUrl(): ViewmodelPrototypeMode {
  if (typeof window === "undefined") return null;
  return resolveViewmodelPrototypeModeFromParams(new URLSearchParams(window.location.search));
}

function useViewmodelAtlasTexture() {
  const texture = useTexture(viewmodelAtlasUrl) as Texture;

  return useMemo(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.anisotropy = 4;
    return texture;
  }, [texture]);
}

function poseArms(
  weaponId: WeaponId | null,
  holdingUltimate: boolean,
  prototypeMode: ViewmodelPrototypeMode,
  rod: RodPose,
  pistolKick: number,
  reloadPose: number,
  recoil: number,
  elevatorPress: number,
  leftArm: Group | null,
  rightArm: Group | null,
) {
  if (holdingUltimate) {
    if (leftArm) {
      leftArm.visible = true;
      leftArm.position.set(-0.26, -0.52, -0.78);
      leftArm.rotation.set(-0.42, 0.31, -0.34);
    }
    if (rightArm) {
      rightArm.visible = true;
      rightArm.position.set(0.28, -0.51, -0.79);
      rightArm.rotation.set(-0.38, -0.26, 0.32);
    }
    return;
  }

  if (weaponId === "pulseRifle") {
    const swing = rod.strike;
    const windup = rod.windup;
    const impact = rod.impact;
    const recover = rod.recover;
    if (leftArm) {
      leftArm.visible = false;
    }
    if (rightArm) {
      rightArm.visible = true;
      rightArm.position.set(0.44 + windup * 0.06 - swing * 0.16 + recover * 0.05, -0.5 + windup * 0.02 - impact * 0.05, -0.76 - windup * 0.08 - swing * 0.22 + recoil * 0.04 + recover * 0.06);
      rightArm.rotation.set(-0.22 - windup * 0.44 - swing * 0.72 - recoil * 0.05 + recover * 0.2, -0.16 + windup * 0.12 + swing * 0.42, 0.18 + windup * 0.5 + swing * 0.92 - recover * 0.28);
    }
    return;
  }

  if (weaponId === "railLance") {
    const premiumPrototype = prototypeMode === "scriptedDerived";
    const sidearmMotion = premiumPrototype ? scriptedDerivedSidearmMotionTuning : null;
    if (leftArm) {
      leftArm.visible = true;
      if (premiumPrototype) {
        leftArm.position.set(
          -0.31 + reloadPose * 0.21,
          -0.61 + (sidearmMotion?.leftHandOffsetY ?? 0) + reloadPose * 0.06,
          -1.0 + (sidearmMotion?.leftHandOffsetZ ?? 0) + reloadPose * 0.14,
        );
        leftArm.rotation.set(-0.3 - reloadPose * 0.26, 0.14 - reloadPose * 0.16, -0.1 + reloadPose * 0.32);
      } else {
        leftArm.position.set(-0.38 + reloadPose * 0.26, -0.58 + reloadPose * 0.08, -0.94 + reloadPose * 0.16);
        leftArm.rotation.set(-0.28 - reloadPose * 0.42, 0.24 - reloadPose * 0.28, -0.22 + reloadPose * 0.52);
      }
    }
    if (rightArm) {
      rightArm.visible = true;
      if (premiumPrototype) {
        rightArm.position.set(
          0.36 + pistolKick * 0.018,
          -0.515 + pistolKick * 0.018 + reloadPose * 0.03,
          -0.74 + recoil * 0.028 + pistolKick * (sidearmMotion?.rightHandKickZ ?? 0.025),
        );
        rightArm.rotation.set(
          -0.12 - recoil * 0.035 - pistolKick * (sidearmMotion?.handWristKick ?? 0.12) - reloadPose * 0.16,
          -0.105 - reloadPose * 0.12,
          0.135 - pistolKick * (sidearmMotion?.weaponRollKick ?? 0.12) + reloadPose * 0.12,
        );
      } else {
        rightArm.position.set(0.34 + pistolKick * 0.038, -0.5 + pistolKick * 0.05 + reloadPose * 0.04, -0.76 + recoil * 0.05 + pistolKick * 0.18);
        rightArm.rotation.set(-0.16 - recoil * 0.08 - pistolKick * 0.34 - reloadPose * 0.24, -0.13 - reloadPose * 0.18, 0.18 - pistolKick * 0.24 + reloadPose * 0.18);
      }
    }
    return;
  }

  if (leftArm) {
    leftArm.visible = true;
    leftArm.position.set(-0.28 - elevatorPress * 0.08, -0.56 + elevatorPress * 0.03, -0.86 + elevatorPress * 0.04);
    leftArm.rotation.set(-0.34 - elevatorPress * 0.12, 0.24 + elevatorPress * 0.08, -0.18 - elevatorPress * 0.08);
  }
  if (rightArm) {
    rightArm.visible = true;
    rightArm.position.set(0.3 + elevatorPress * 0.24, -0.56 + elevatorPress * 0.22, -0.86 - elevatorPress * 0.42);
    rightArm.rotation.set(-0.34 - elevatorPress * 0.72, -0.24 - elevatorPress * 0.32, 0.18 + elevatorPress * 0.22);
  }
}

function poseWeapons(
  weaponId: WeaponId | null,
  holdingUltimate: boolean,
  ultimateAbilityId: UltimateAbilityId,
  prototypeMode: ViewmodelPrototypeMode,
  showCombatWeapons: boolean,
  rodPose: RodPose,
  pistolKick: number,
  reloadPose: number,
  recoil: number,
  rod: Group | null,
  pistol: Group | null,
  core: Group | null,
  missile: Group | null,
) {
  if (rod) {
    const swing = rodPose.strike;
    const windup = rodPose.windup;
    const impact = rodPose.impact;
    const recover = rodPose.recover;
    const premiumPrototype = prototypeMode === "scriptedDerived";
    rod.visible = showCombatWeapons && weaponId === "pulseRifle";
    rod.position.set(0.42 + (premiumPrototype ? 0.02 : 0) + windup * 0.14 - swing * 0.3 + recover * 0.08, -0.34 - (premiumPrototype ? 0.015 : 0) + windup * 0.055 - impact * 0.095 + recover * 0.02, -0.92 + (premiumPrototype ? 0.018 : 0) - windup * 0.1 - swing * 0.36 + recover * 0.09 + impact * 0.05);
    rod.rotation.set(-0.42 + windup * 0.78 - swing * 1.2 - impact * 0.12 + recover * 0.26, -0.18 - windup * 0.25 + swing * 0.54 + impact * 0.05, -0.4 - windup * 0.86 + swing * 2.06 + impact * 0.18 - recover * 0.36);
    rod.scale.setScalar(ROD_VIEWMODEL_SCREEN_SCALE * (premiumPrototype ? 0.98 : 1) * (1 + impact * 0.055));
  }
  if (pistol) {
    const premiumPrototype = prototypeMode === "scriptedDerived";
    const sidearmMotion = premiumPrototype ? scriptedDerivedSidearmMotionTuning : null;
    pistol.visible = showCombatWeapons && weaponId === "railLance";
    pistol.position.set(
      (premiumPrototype ? 0.3 : 0.27) + pistolKick * (sidearmMotion?.weaponKickX ?? 0.06) - reloadPose * 0.055,
      (premiumPrototype ? -0.405 : -0.39) + pistolKick * (sidearmMotion?.weaponKickY ?? 0.068) - reloadPose * 0.08,
      (premiumPrototype ? -1.035 : -1.055) + recoil * (sidearmMotion?.weaponRecoilZ ?? 0.13) + pistolKick * (sidearmMotion?.weaponKickZ ?? 0.28) + reloadPose * 0.1,
    );
    pistol.rotation.set(
      (premiumPrototype ? 0.012 : -0.04) - recoil * (premiumPrototype ? 0.045 : 0.09) - pistolKick * (sidearmMotion?.weaponPitchKick ?? 0.7) - reloadPose * (premiumPrototype ? 0.36 : 0.55),
      (premiumPrototype ? -0.035 : -0.06) + reloadPose * 0.2 + pistolKick * (sidearmMotion?.weaponYawKick ?? 0.032),
      (premiumPrototype ? -0.025 : -0.045) - pistolKick * (sidearmMotion?.weaponRollKick ?? 0.3) + reloadPose * 0.28,
    );
    pistol.scale.set(premiumPrototype ? 1.22 : 1.18, premiumPrototype ? 1.03 : 1.04, premiumPrototype ? 1.12 : 1.08);
  }
  if (core) {
    core.visible = holdingUltimate && ultimateAbilityId === "coreBomb";
    core.position.set(0.02, -0.33, -0.82 + recoil * 0.04);
    core.rotation.set(-0.72 - recoil * 0.03, 0.1, 0.06);
    core.scale.setScalar(1.06);
  }
  if (missile) {
    missile.visible = holdingUltimate && ultimateAbilityId === "breachMissile";
    missile.position.set(0.06, -0.34, -0.9 + recoil * 0.04);
    missile.rotation.set(-0.12 - recoil * 0.02, 0.04, -0.08);
    missile.scale.setScalar(0.92);
  }
}

function phase(value: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return Math.sin(t * Math.PI);
}

function segment(value: number, start: number, end: number) {
  return clamp01((value - start) / (end - start));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function reloadProgress(remaining: number, duration: number, weaponId: WeaponId | null) {
  if (weaponId !== "railLance" || remaining <= 0 || duration <= 0) return 0;
  const progress = 1 - remaining / duration;
  const dip = phase(progress, 0, 0.38) * 0.75;
  const insert = phase(progress, 0.34, 0.82);
  return Math.max(dip, insert);
}

function exitElevatorPressProgress(world: GameWorld) {
  const cinematic = world.session.activeExitCinematic;
  if (world.session.mode !== "exitCinematic" || !cinematic) return 0;
  return exitButtonTouchProgress(cinematic);
}

function handInteractionPressProgress(world: GameWorld) {
  const active = world.session.activeHandInteraction;
  if (!active || active.duration <= 0) return 0;
  const reach = easeOutCubic(segment(active.elapsed, 0, active.commitAt));
  const leave = easeInOutCubic(segment(active.elapsed, active.commitAt, active.duration));
  return Math.max(0, Math.min(1, reach * (1 - leave)));
}

const fingerXs = [-0.064, -0.022, 0.022, 0.065] as const;
const fingerSpreads = [-0.12, -0.04, 0.04, 0.13] as const;

function HumanArm({
  side,
  materials,
  actionRef,
}: {
  side: "left" | "right";
  materials: ViewMaterials;
  actionRef: ViewmodelActionRef;
}) {
  const sign = side === "left" ? -1 : 1;
  const rootRef = useRef<Group>(null);
  const palmRef = useRef<Group>(null);
  const fingerRefs = useRef<Array<Group | null>>([]);
  const thumbRef = useRef<Group>(null);

  useFrame(() => {
    const action = actionRef.current;
    const isRight = side === "right";
    const usingRod = action.weaponId === "pulseRifle";
    const usingGun = action.weaponId === "railLance";
    const holdingUltimate = action.holdingUltimate;
    const sidearmMotion = action.prototypeMode === "scriptedDerived" && usingGun ? scriptedDerivedSidearmMotionTuning : null;
    const idleScale = sidearmMotion ? 0.3 : 1;
    const idle = Math.sin(action.time * 3.2 + (isRight ? 0.4 : 1.7));
    const rodGrip = usingRod && isRight ? 0.32 + action.rod.windup * 0.16 + action.rod.strike * 0.22 + action.rod.impact * 0.54 : 0;
    const gunGrip = usingGun
      ? isRight
        ? 0.18 + action.pistolKick * (sidearmMotion?.rightHandGripKick ?? 0.72) + action.reloadPose * 0.2
        : 0.055 + action.reloadPose * 0.32
      : 0;
    const ultimateGrip = holdingUltimate ? (isRight ? 0.34 : 0.28) : 0;
    const relaxedGrip = action.weaponId || holdingUltimate ? 0.08 : 0.02;
    const pressGrip = isRight ? action.elevatorPress * 0.34 : action.elevatorPress * 0.08;
    const curl = clamp01(relaxedGrip + rodGrip + gunGrip + ultimateGrip + pressGrip + action.recoil * 0.08);
    const wristKick = (usingGun ? action.pistolKick * (sidearmMotion?.handWristKick ?? 0.12) : 0) + (usingRod && isRight ? action.rod.impact * 0.1 - action.rod.windup * 0.06 : 0);
    const scriptedDerivedRodScale = action.prototypeMode === "scriptedDerived" ? 0.9 : 1;
    const scriptedDerivedGunScale = action.prototypeMode === "scriptedDerived" && usingGun ? (isRight ? 0.92 : sidearmMotion?.leftHandScale ?? 0.9) : 1;
    const rodHandScale = usingRod && isRight ? 0.78 * scriptedDerivedRodScale : holdingUltimate ? 0.94 : 1;
    const handScale = usingRod && isRight ? rodHandScale : holdingUltimate ? 0.94 : scriptedDerivedGunScale;

    if (rootRef.current) {
      rootRef.current.scale.set(sign * handScale, handScale, handScale);
      rootRef.current.position.set(
        0,
        -wristKick * 0.018 + (!isRight && sidearmMotion ? sidearmMotion.leftHandOffsetY : 0),
        usingGun ? action.pistolKick * (isRight ? sidearmMotion?.rightHandKickZ ?? 0.025 : 0) + (!isRight && sidearmMotion ? sidearmMotion.leftHandOffsetZ : 0) : -action.rod.impact * 0.014,
      );
      rootRef.current.rotation.set(
        -wristKick - action.elevatorPress * (isRight ? 0.2 : 0.04) + idle * 0.006 * idleScale * (1 - curl * 0.4),
        (usingGun && isRight ? -action.pistolKick * (sidearmMotion ? 0.018 : 0.05) : 0) + (usingRod && isRight ? action.rod.strike * 0.04 : 0) - action.elevatorPress * (isRight ? 0.18 : 0),
        (usingRod && isRight ? action.rod.impact * 0.05 : 0) + idle * 0.004 * idleScale + action.elevatorPress * (isRight ? 0.08 : -0.02),
      );
    }

    if (palmRef.current) {
      palmRef.current.rotation.set(-0.04 - curl * 0.08, 0, 0);
      palmRef.current.scale.set(1 + curl * 0.025, 1 - curl * 0.018, 1 + curl * 0.018);
    }

    fingerRefs.current.forEach((finger, index) => {
      if (!finger) return;
      const triggerBias = usingGun && isRight && index === 1 ? 0.28 + action.pistolKick * (sidearmMotion?.triggerFingerKick ?? 0.34) : 0;
      const middleBias = index === 1 || index === 2 ? 1.02 : 0.9;
      finger.rotation.set(0.08 + curl * middleBias + triggerBias, 0, fingerSpreads[index] * (1 - curl * 0.22));
      finger.position.y = -0.095 - curl * 0.014;
      finger.position.z = -0.405 + curl * 0.018;
    });

    if (thumbRef.current) {
      thumbRef.current.rotation.set(0.68 + curl * 0.16, -0.1 - (usingGun && isRight ? action.pistolKick * (sidearmMotion?.thumbKick ?? 0.06) : 0), 0.34 + curl * 0.24);
    }
  });

  return (
    <group ref={rootRef} scale={[sign, 1, 1]}>
      <RoundedBox args={[0.18, 0.16, 0.58]} position={[0, 0.03, 0.12]} rotation={[0.08, 0, 0]} radius={0.06} material={materials.labSleeve} />
      <RoundedBox args={[0.2, 0.06, 0.18]} position={[0, -0.02, -0.19]} rotation={[0.04, 0, 0]} radius={0.025} material={materials.wristBand} />
      <group ref={palmRef}>
        <RoundedBox args={[0.18, 0.12, 0.21]} position={[0, -0.075, -0.35]} rotation={[-0.08, 0, 0]} radius={0.055} material={materials.glovePalm} />
        <RoundedBox args={[0.205, 0.085, 0.245]} position={[0, -0.018, -0.36]} rotation={[-0.24, 0, 0]} radius={0.065} material={materials.gloveBack} />
        <RoundedBox args={[0.11, 0.012, 0.105]} position={[0, -0.118, -0.302]} rotation={[-0.08, 0, 0]} radius={0.006} material={materials.softPalmWarmth} />
      </group>
      <RoundedBox args={[0.15, 0.026, 0.055]} position={[0, 0.028, -0.5]} rotation={[-0.18, 0, 0]} radius={0.012} material={materials.knuckleRidge} />
      {fingerXs.map((x, index) => (
        <RoundedBox key={x} args={[0.032, 0.02, 0.04]} position={[x, 0.04, -0.47]} rotation={[-0.18, 0, fingerSpreads[index] * 0.18]} radius={0.011} material={materials.knuckleRidge} />
      ))}
      <RoundedBox args={[0.09, 0.055, 0.12]} position={[0.082, -0.018, -0.36]} rotation={[-0.2, -0.1, 0.28]} radius={0.035} material={materials.gloveBack} />
      <group ref={thumbRef} position={[0.088, -0.054, -0.414]} rotation={[0.72, -0.08, 0.52]}>
        <RoundedBox args={[0.07, 0.052, 0.18]} position={[0, 0, 0]} radius={0.022} material={materials.glove} />
        <RoundedBox args={[0.052, 0.042, 0.11]} position={[-0.022, -0.062, -0.085]} rotation={[0.28, 0, -0.16]} radius={0.019} material={materials.glovePalm} />
        <RoundedBox args={[0.028, 0.006, 0.032]} position={[-0.025, -0.093, -0.124]} rotation={[0.34, 0, -0.16]} radius={0.004} material={materials.softNailHint} />
      </group>
      {fingerXs.map((x, index) => (
        <Finger
          key={x}
          x={x}
          spread={fingerSpreads[index]}
          materials={materials}
          rootRef={(node) => {
            fingerRefs.current[index] = node;
          }}
        />
      ))}
      <RoundedBox args={[0.12, 0.034, 0.04]} position={[0, 0.002, -0.25]} radius={0.01} material={materials.braceTape} />
    </group>
  );
}

function Finger({
  x,
  spread,
  materials,
  rootRef,
}: {
  x: number;
  spread: number;
  materials: ViewMaterials;
  rootRef?: (node: Group | null) => void;
}) {
  return (
    <group ref={rootRef} position={[x, -0.095, -0.405]} rotation={[0.1, 0, spread]}>
      <RoundedBox args={[0.035, 0.052, 0.135]} position={[0, -0.002, -0.036]} rotation={[0.58, 0, 0]} radius={0.016} material={materials.glove} />
      <RoundedBox args={[0.032, 0.046, 0.108]} position={[0, -0.034, -0.125]} rotation={[1.02, 0, 0]} radius={0.015} material={materials.glovePalm} />
      <RoundedBox args={[0.028, 0.035, 0.048]} position={[0, -0.058, -0.185]} rotation={[1.18, 0, 0]} radius={0.014} material={materials.glovePalm} />
      <RoundedBox args={[0.018, 0.004, 0.024]} position={[0, -0.069, -0.198]} rotation={[1.18, 0, 0]} radius={0.003} material={materials.softNailHint} />
    </group>
  );
}

type ViewAtlasRegion = "rodSteel" | "hazardTape" | "redWhiteTape" | "rubber" | "pistolSlide" | "pistolFrame" | "ammoWindow" | "sleeve" | "coreCell";

const viewAtlasRegions: Record<ViewAtlasRegion, { offset: [number, number]; repeat: [number, number] }> = {
  rodSteel: { offset: [0.14, 0.08], repeat: [0.12, 0.84] },
  hazardTape: { offset: [0.29, 0.9], repeat: [0.26, 0.08] },
  redWhiteTape: { offset: [0.54, 0.9], repeat: [0.3, 0.08] },
  rubber: { offset: [0.28, 0.58], repeat: [0.08, 0.22] },
  pistolSlide: { offset: [0.52, 0.6], repeat: [0.34, 0.28] },
  pistolFrame: { offset: [0.52, 0.42], repeat: [0.34, 0.16] },
  ammoWindow: { offset: [0.88, 0.14], repeat: [0.08, 0.26] },
  sleeve: { offset: [0.29, 0.02], repeat: [0.52, 0.18] },
  coreCell: { offset: [0.84, 0.05], repeat: [0.13, 0.32] },
};

function ViewDecalPlate({
  texture,
  region,
  position,
  scale,
  rotation = [0, 0, 0],
  opacity = 0.96,
}: {
  texture: Texture;
  region: ViewAtlasRegion;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  opacity?: number;
}) {
  const decalTexture = useMemo(() => {
    const regionConfig = viewAtlasRegions[region];
    const clone = texture.clone();
    clone.offset.set(regionConfig.offset[0], regionConfig.offset[1]);
    clone.repeat.set(regionConfig.repeat[0], regionConfig.repeat[1]);
    clone.colorSpace = texture.colorSpace;
    clone.needsUpdate = true;
    return clone;
  }, [region, texture]);

  useEffect(() => () => decalTexture.dispose(), [decalTexture]);

  return (
    <mesh position={position} rotation={rotation} scale={scale} renderOrder={32}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={decalTexture}
        transparent={opacity < 0.999}
        opacity={opacity}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        side={DoubleSide}
      />
    </mesh>
  );
}

function RefinedIronRod({ prototypeMode }: { prototypeMode: ViewmodelPrototypeMode }) {
  const referenceRawPrototype = prototypeMode === "referenceRaw";
  const scriptedDerivedPrototype = prototypeMode === "scriptedDerived";
  const productionPrototype = prototypeMode === "production";
  const url = scriptedDerivedPrototype
    ? scriptedDerivedIronRodPrototypeUrl
    : productionPrototype
      ? productionIronRodPrototypeUrl
      : referenceRawPrototype
        ? referenceRawIronRodPrototypeUrl
        : refinedIronRodUrl;
  const position: TransformTuple = [-0.04, 0.46, 0.01];
  const rotation: TransformTuple = referenceRawPrototype || scriptedDerivedPrototype ? [-Math.PI / 2, 0, 0] : [0, 0, 0];
  const scale: TransformTuple = scriptedDerivedPrototype ? [1.755, 1.17, 2.232] : referenceRawPrototype ? [1.95, 1.3, 2.48] : [1.05, 0.84, 1.05];

  return (
    <RefinedViewmodelWeapon url={url} position={position} rotation={rotation} scale={scale} />
  );
}

function RefinedPistol({
  materials,
  actionRef,
  prototypeMode,
}: {
  materials: ViewMaterials;
  actionRef: ViewmodelActionRef;
  prototypeMode: ViewmodelPrototypeMode;
}) {
  const slideRef = useRef<Group>(null);
  const muzzleFlashRef = useRef<Group>(null);
  const referenceRawPrototype = prototypeMode === "referenceRaw";
  const scriptedDerivedPrototype = prototypeMode === "scriptedDerived";
  const productionPrototype = prototypeMode === "production";
  const url = scriptedDerivedPrototype
    ? scriptedDerivedSidearmLayeredPrototypeUrl
    : productionPrototype
      ? productionSidearmPrototypeUrl
      : referenceRawPrototype
        ? referenceRawSidearmPrototypeUrl
        : refinedSidearmUrl;
  const position: TransformTuple = scriptedDerivedPrototype ? [0, -0.08, -0.22] : referenceRawPrototype ? [0, -0.1, -0.18] : [0, -0.08, -0.15];
  const rotation: TransformTuple = [0, 0, 0];
  const scale: TransformTuple = scriptedDerivedPrototype ? [1.25, 1.05, 1.1] : referenceRawPrototype ? [1.01, 1.01, 1.01] : [0.74, 0.67, 0.70];

  useFrame(() => {
    const action = actionRef.current;
    const kick = action.weaponId === "railLance" ? action.pistolKick : 0;
    const muzzleKick = action.weaponId === "railLance" ? action.muzzleKick : 0;
    const reload = action.weaponId === "railLance" ? action.reloadPose : 0;
    if (slideRef.current) {
      slideRef.current.position.set(0, 0.25 + kick * 0.012 - reload * 0.01, -0.56 + kick * 0.09 + reload * 0.035);
      slideRef.current.rotation.set(-kick * 0.08, 0, -kick * 0.035 + reload * 0.08);
      slideRef.current.scale.set(1 + kick * 0.04, 1, 1 + kick * 0.015);
    }
    if (muzzleFlashRef.current) {
      muzzleFlashRef.current.visible = muzzleKick > 0.025;
      muzzleFlashRef.current.position.set(0, 0.18 + muzzleKick * 0.015, -0.9 - muzzleKick * 0.035);
      muzzleFlashRef.current.rotation.set(0, 0, action.time * 18);
      muzzleFlashRef.current.scale.set(0.72 + muzzleKick * 1.2, 0.72 + muzzleKick * 1.2, 0.72 + muzzleKick * 1.2);
    }
  });

  return (
    <group>
      <RefinedViewmodelWeapon url={url} position={position} rotation={rotation} scale={scale} />
      {!referenceRawPrototype && !scriptedDerivedPrototype ? (
        <group ref={slideRef} position={[0, 0.25, -0.56]}>
          <RoundedBox args={[0.18, 0.026, 0.42]} position={[0, 0, 0]} radius={0.008} material={materials.scrapedSteel} />
          <RoundedBox args={[0.11, 0.018, 0.18]} position={[0, 0.026, -0.08]} radius={0.006} material={materials.brass} />
          <RoundedBox args={[0.052, 0.014, 0.13]} position={[0.082, 0.023, 0.1]} radius={0.005} material={materials.sightGlow} />
        </group>
      ) : null}
      <group ref={muzzleFlashRef} visible={false} position={[0, 0.18, -0.9]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.muzzleGlow}>
          <coneGeometry args={[0.14, 0.44, 18]} />
        </mesh>
        <mesh material={materials.muzzleCore}>
          <sphereGeometry args={[0.078, 18, 10]} />
        </mesh>
        <RoundedBox args={[0.42, 0.018, 0.052]} position={[0, 0, 0.02]} radius={0.006} material={materials.muzzleKnife} />
        <RoundedBox args={[0.018, 0.34, 0.052]} position={[0, 0, 0.025]} radius={0.006} material={materials.muzzleKnife} />
      </group>
    </group>
  );
}

function ProtocolBreachChargeViewmodel() {
  return (
    <RefinedViewmodelWeapon
      url={protocolBreachChargeUrl}
      position={[0, -0.02, -0.02]}
      rotation={[0.04, -0.12, 0.08]}
      scale={[1.16, 1.16, 1.16]}
    />
  );
}

function ProtocolBreachMissileViewmodel() {
  return (
    <RefinedViewmodelWeapon
      url={protocolBreachMissileUrl}
      position={[0, -0.02, -0.04]}
      rotation={[0, -0.08, 0.04]}
      scale={[1.05, 1.05, 1.05]}
    />
  );
}

function RefinedViewmodelWeapon({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: {
  url: string;
  position?: TransformTuple;
  rotation?: TransformTuple;
  scale?: number | TransformTuple;
}) {
  const gltf = useGLTF(url) as { scene: Object3D };
  const scene = useMemo(() => prepareRefinedViewmodelScene(gltf.scene), [gltf.scene]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

function prepareRefinedViewmodelScene(source: Object3D) {
  const clone = source.clone(true);
  clone.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 31;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prepareRefinedMaterial) : prepareRefinedMaterial(mesh.material);
  });
  return clone;
}

function prepareRefinedMaterial(material: Material) {
  const clone = material.clone();
  const target = clone as Material & {
    color?: Color;
    emissive?: Color;
    emissiveIntensity?: number;
    envMapIntensity?: number;
    map?: unknown;
    metalness?: number;
    normalScale?: { setScalar: (value: number) => void };
    roughness?: number;
    toneMapped?: boolean;
  };
  const name = clone.name.toLowerCase();
  const hasBaseColorTexture = Boolean(target.map);
  const agedProfile = getAgedViewmodelMaterialProfile(name);

  if (agedProfile) {
    if (target.color) target.color.set(agedProfile.color);
    if (typeof target.metalness === "number") target.metalness = agedProfile.metalness;
    if (typeof target.roughness === "number") target.roughness = agedProfile.roughness;
    if (target.normalScale) target.normalScale.setScalar(agedProfile.normalScale);
    if (typeof target.envMapIntensity === "number") target.envMapIntensity = agedProfile.envMapIntensity ?? 0.42;
    if (target.emissive) target.emissive.set(agedProfile.emissive ?? "#000000");
    if (typeof target.emissiveIntensity === "number") target.emissiveIntensity = agedProfile.emissiveIntensity ?? 0;
    if ("toneMapped" in target && agedProfile.emissive) target.toneMapped = false;
  } else if (target.color && !hasBaseColorTexture) {
    if (/cyan|energy|sight|window|muzzle/.test(name)) {
      target.color.set("#8cf1ff");
      if (target.emissive) target.emissive.set("#31cfe4");
      if (typeof target.emissiveIntensity === "number") target.emissiveIntensity = 1.15;
      if ("toneMapped" in target) target.toneMapped = false;
    } else if (/red|warning|status|collar/.test(name)) {
      target.color.set("#e64836");
      if (target.emissive) target.emissive.set("#7a140e");
      if (typeof target.emissiveIntensity === "number") target.emissiveIntensity = 0.38;
    } else if (/amber|inlay|trigger|rail|band/.test(name)) {
      target.color.set("#c99a45");
      if (target.emissive) target.emissive.set("#5a340b");
      if (typeof target.emissiveIntensity === "number") target.emissiveIntensity = 0.28;
    } else if (/panel|steel|slide|cap|ring/.test(name)) {
      target.color.set("#aeb8b2");
    } else if (/gunmetal|frame|spine|cut|shadow/.test(name)) {
      target.color.set("#1d2a2b");
    } else if (/rubber|grip|dark/.test(name)) {
      target.color.set("#080b0d");
    }
  }
  if (!agedProfile && typeof target.metalness === "number" && /steel|slide|panel|gunmetal|cap|ring/.test(name)) target.metalness = 0.82;
  if (!agedProfile && typeof target.roughness === "number" && /steel|slide|panel|gunmetal|cap|ring/.test(name)) target.roughness = 0.26;
  const preserveOpaqueSelfDepth = shouldUseOpaqueSelfDepthForViewmodelMaterial(name);
  clone.depthTest = preserveOpaqueSelfDepth;
  clone.depthWrite = preserveOpaqueSelfDepth;
  if ("toneMapped" in clone && /cyan|energy|glow|sight|warning|red/.test(name)) {
    clone.toneMapped = false;
  }
  clone.needsUpdate = true;
  return clone;
}

function getAgedViewmodelMaterialProfile(name: string): AgedViewmodelMaterialProfile {
  if (/sidearm_layer_slide_opaque/.test(name)) {
    return { ...scriptedDerivedSidearmLayerMaterialTuning.slide };
  }
  if (/sidearm_layer_barrel_opaque/.test(name)) {
    return { ...scriptedDerivedSidearmLayerMaterialTuning.barrel };
  }
  if (/sidearm_layer_frame_opaque/.test(name)) {
    return { ...scriptedDerivedSidearmLayerMaterialTuning.frame };
  }
  if (/sidearm_layer_grip_opaque/.test(name)) {
    return { ...scriptedDerivedSidearmLayerMaterialTuning.grip };
  }
  if (/sidearm_layer_trim_opaque/.test(name)) {
    return { ...scriptedDerivedSidearmLayerMaterialTuning.trim };
  }
  if (/sidearm_layer_emissive_opaque/.test(name)) {
    return { ...scriptedDerivedSidearmLayerMaterialTuning.emissive };
  }
  if (/scripted_reference_texture_material/.test(name)) {
    return {
      color: "#ffffff",
      emissive: "#000000",
      emissiveIntensity: 0,
      envMapIntensity: /sidearm/.test(name) ? 1 : 0.84,
      metalness: /sidearm/.test(name) ? 0.9 : 0.7,
      normalScale: 1.12,
      roughness: /sidearm/.test(name) ? 0.38 : 0.46,
    };
  }
  if (/hero|scraped|highlight|bright/.test(name)) {
    return {
      color: "#e8f2e8",
      emissive: "#0d1512",
      emissiveIntensity: 0.055,
      envMapIntensity: 0.95,
      metalness: 0.99,
      normalScale: 1.22,
      roughness: 0.32,
    };
  }
  if (/cyan|energy|sight|window|muzzle|glass|lens/.test(name)) {
    return {
      color: "#7ad1d0",
      emissive: "#09363b",
      emissiveIntensity: 0.18,
      envMapIntensity: 0.52,
      metalness: 0.18,
      normalScale: 0.7,
      roughness: 0.44,
    };
  }
  if (/bronze|copper|amber|inlay|trigger|rail/.test(name)) {
    return {
      color: "#d19a51",
      emissive: "#1c0f04",
      emissiveIntensity: 0.05,
      envMapIntensity: 0.72,
      metalness: 0.94,
      normalScale: 1.08,
      roughness: 0.52,
    };
  }
  if (/black|wrap|grip|rubber|leather/.test(name)) {
    return {
      color: "#565f5a",
      metalness: 0.58,
      normalScale: 1.18,
      roughness: 0.82,
    };
  }
  if (/shadow|dark|shaft|core|cut/.test(name)) {
    return {
      color: "#34433f",
      envMapIntensity: 0.46,
      metalness: 0.9,
      normalScale: 1.16,
      roughness: 0.72,
    };
  }
  if (/battered|edge|steel|titanium|panel|slide|cap|ring|receiver|plate/.test(name)) {
    return {
      color: "#ccd8cf",
      emissive: "#07100d",
      emissiveIntensity: 0.03,
      envMapIntensity: 0.82,
      metalness: 0.98,
      normalScale: 1.12,
      roughness: 0.44,
    };
  }
  return {
    color: "#aeb9ae",
    envMapIntensity: 0.58,
    metalness: 0.82,
    normalScale: 1.05,
    roughness: 0.56,
  };
}

function LabIronRod({ materials, atlasTexture }: { materials: ViewMaterials; atlasTexture: Texture }) {
  return (
    <group>
      <mesh position={[0, 0.57, 0]} material={materials.rawSteel}>
        <cylinderGeometry args={[0.08, 0.075, 1.74, 32]} />
      </mesh>
      <mesh position={[0, -0.36, 0.01]} material={materials.blackRubber}>
        <cylinderGeometry args={[0.12, 0.11, 0.48, 28]} />
      </mesh>
      <mesh position={[0, -0.11, 0.01]} material={materials.hazardRed}>
        <cylinderGeometry args={[0.13, 0.13, 0.07, 28]} />
      </mesh>
      <mesh position={[0, 1.52, 0]} material={materials.scrapedSteel}>
        <cylinderGeometry args={[0.12, 0.105, 0.3, 32]} />
      </mesh>
      <RoundedBox args={[0.3, 0.045, 0.22]} position={[0, 1.66, 0.01]} radius={0.012} material={materials.dentDark} />
      <RoundedBox args={[0.055, 0.2, 0.2]} position={[-0.13, 1.58, 0.01]} radius={0.012} material={materials.dentDark} />
      <RoundedBox args={[0.055, 0.2, 0.2]} position={[0.13, 1.58, 0.01]} radius={0.012} material={materials.dentDark} />
      {[-0.56, -0.44, -0.32, 0.08, 0.42, 0.98].map((y, index) => (
        <mesh key={y} position={[0, y, 0.012]} material={index === 4 ? materials.hazardRed : materials.mutedTape}>
          <cylinderGeometry args={[0.095, 0.095, 0.055, 24]} />
        </mesh>
      ))}
      <RoundedBox args={[0.09, 0.04, 0.08]} position={[-0.04, 1.1, 0.09]} rotation={[0.02, 0, 0.2]} radius={0.012} material={materials.dentDark} />
      <RoundedBox args={[0.18, 0.02, 0.08]} position={[0, -0.59, 0.09]} radius={0.006} material={materials.brass} />
      <RoundedBox args={[0.13, 0.018, 0.07]} position={[0, -0.47, 0.095]} radius={0.006} material={materials.brass} />
      <RoundedBox args={[0.12, 0.018, 0.06]} position={[0, -0.35, 0.098]} radius={0.006} material={materials.brass} />
      <ViewDecalPlate texture={atlasTexture} region="rodSteel" position={[0, 0.66, 0.083]} scale={[0.16, 1.22, 1]} opacity={0.82} />
      <ViewDecalPlate texture={atlasTexture} region="rubber" position={[0, -0.42, 0.115]} scale={[0.2, 0.34, 1]} opacity={0.9} />
      <ViewDecalPlate texture={atlasTexture} region="hazardTape" position={[0, 0.22, 0.112]} scale={[0.2, 0.11, 1]} opacity={0.38} />
      <ViewDecalPlate texture={atlasTexture} region="hazardTape" position={[0, 0.93, 0.112]} scale={[0.2, 0.11, 1]} opacity={0.38} />
    </group>
  );
}

function LabPistol({ materials, atlasTexture }: { materials: ViewMaterials; atlasTexture: Texture }) {
  return (
    <group>
      <RoundedBox args={[0.34, 0.16, 0.62]} position={[0, 0.06, -0.12]} radius={0.026} material={materials.pistolFrame} />
      <RoundedBox args={[0.36, 0.11, 0.72]} position={[0, 0.2, -0.24]} radius={0.022} material={materials.pistolSlide} />
      <RoundedBox args={[0.14, 0.12, 0.42]} position={[0, 0.18, -0.68]} radius={0.024} material={materials.blackRubber} />
      <RoundedBox args={[0.16, 0.36, 0.18]} position={[0, -0.25, 0.12]} rotation={[-0.22, 0, 0]} radius={0.032} material={materials.pistolGrip} />
      <RoundedBox args={[0.18, 0.08, 0.2]} position={[0, -0.45, 0.23]} rotation={[-0.22, 0, 0]} radius={0.018} material={materials.magBase} />
      <RoundedBox args={[0.04, 0.2, 0.025]} position={[0.095, -0.18, -0.04]} radius={0.01} material={materials.pistolSlide} />
      <RoundedBox args={[0.16, 0.04, 0.035]} position={[0, 0.3, 0.02]} radius={0.008} material={materials.hazardRed} />
      <RoundedBox args={[0.1, 0.035, 0.14]} position={[0, 0.29, -0.6]} radius={0.008} material={materials.sightGlow} />
      <mesh position={[0, 0.18, -0.9]} rotation={[Math.PI / 2, 0, 0]} material={materials.muzzleGlow}>
        <coneGeometry args={[0.11, 0.34, 18]} />
      </mesh>
      <RoundedBox args={[0.07, 0.03, 0.2]} position={[0, 0.13, -0.02]} radius={0.01} material={materials.brass} />
      <RoundedBox args={[0.09, 0.035, 0.12]} position={[-0.12, 0.28, -0.02]} rotation={[0, 0, 0.28]} radius={0.008} material={materials.brass} />
      <RoundedBox args={[0.2, 0.02, 0.12]} position={[0, -0.02, -0.1]} rotation={[0.2, 0, 0]} radius={0.008} material={materials.blackRubber} />
      <RoundedBox args={[0.12, 0.045, 0.38]} position={[0, 0.24, -0.34]} radius={0.012} material={materials.dentDark} />
      <RoundedBox args={[0.04, 0.05, 0.34]} position={[-0.16, 0.19, -0.28]} radius={0.008} material={materials.sightGlow} />
      <ViewDecalPlate texture={atlasTexture} region="pistolSlide" position={[0, 0.265, 0.14]} scale={[0.34, 0.12, 1]} opacity={0.9} />
      <ViewDecalPlate texture={atlasTexture} region="pistolFrame" position={[0, 0.075, 0.2]} scale={[0.34, 0.14, 1]} opacity={0.9} />
      <ViewDecalPlate texture={atlasTexture} region="ammoWindow" position={[0.082, -0.22, 0.22]} rotation={[0, 0, -0.2]} scale={[0.08, 0.28, 1]} opacity={0.95} />
    </group>
  );
}

function CoreBurstBrace({ materials, atlasTexture }: { materials: ViewMaterials; atlasTexture: Texture }) {
  return (
    <group>
      <RoundedBox args={[0.58, 0.18, 0.28]} position={[0, 0.02, 0.0]} radius={0.04} material={materials.wristBand} />
      <RoundedBox args={[0.42, 0.08, 0.1]} position={[0, 0.12, -0.12]} radius={0.02} material={materials.hazardRed} />
      <mesh position={[0, 0.1, -0.32]} rotation={[Math.PI / 2, 0, 0]} material={materials.heat}>
        <cylinderGeometry args={[0.16, 0.2, 0.16, 24]} />
      </mesh>
      <RoundedBox args={[0.1, 0.08, 0.42]} position={[-0.26, 0.03, -0.26]} rotation={[0, 0.25, 0]} radius={0.025} material={materials.scrapedSteel} />
      <RoundedBox args={[0.1, 0.08, 0.42]} position={[0.26, 0.03, -0.26]} rotation={[0, -0.25, 0]} radius={0.025} material={materials.scrapedSteel} />
      <ViewDecalPlate texture={atlasTexture} region="coreCell" position={[0, 0.18, -0.22]} scale={[0.38, 0.24, 1]} opacity={0.94} />
      <ViewDecalPlate texture={atlasTexture} region="redWhiteTape" position={[0, 0.16, 0.08]} scale={[0.36, 0.08, 1]} opacity={0.82} />
    </group>
  );
}

function useViewMaterials() {
  return useMemo(() => {
    const standard = (color: string, metalness: number, roughness: number) =>
      new MeshStandardMaterial({ color, metalness, roughness, depthTest: false, depthWrite: false });

    return {
      labSleeve: standard("#d7ddd7", 0.02, 0.72),
      wristBand: standard("#24282d", 0.48, 0.36),
      glove: standard("#111418", 0.18, 0.52),
      glovePalm: standard("#15191e", 0.18, 0.5),
      gloveBack: standard("#242a30", 0.2, 0.42),
      knuckleRidge: standard("#2f363d", 0.24, 0.38),
      softPalmWarmth: standard("#2b2220", 0.1, 0.58),
      softNailHint: standard("#d8d6cd", 0.04, 0.5),
      blackRubber: standard("#08090b", 0.32, 0.48),
      rawSteel: standard("#6c7374", 0.86, 0.26),
      scrapedSteel: standard("#b3b5b0", 0.8, 0.24),
      dentDark: standard("#2a3032", 0.72, 0.44),
      protocolScrape: standard("#d2ded7", 0.94, 0.34),
      pistolFrame: standard("#151a20", 0.74, 0.32),
      pistolSlide: standard("#9ca2a0", 0.82, 0.24),
      pistolGrip: standard("#20252a", 0.44, 0.46),
      magBase: standard("#0c0f12", 0.55, 0.4),
      brass: standard("#9a8060", 0.62, 0.3),
      protocolBronze: standard("#b58b50", 0.82, 0.38),
      braceTape: standard("#dfe8e1", 0.04, 0.66),
      hazardYellow: new MeshStandardMaterial({
        color: "#8e948c",
        metalness: 0.2,
        roughness: 0.42,
        depthTest: false,
        depthWrite: false,
      }),
      mutedTape: standard("#8e948c", 0.28, 0.42),
      hazardRed: new MeshStandardMaterial({
        color: "#e64836",
        emissive: "#7a140e",
        emissiveIntensity: 0.35,
        metalness: 0.22,
        roughness: 0.3,
        depthTest: false,
        depthWrite: false,
      }),
      sightGlow: new MeshStandardMaterial({
        color: "#8cf1ff",
        emissive: "#31cfe4",
        emissiveIntensity: 0.95,
        metalness: 0.08,
        roughness: 0.16,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
      rodEdge: new MeshBasicMaterial({
        color: "#cfd8d4",
        transparent: true,
        opacity: 0.18,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
      }),
      rodGhost: new MeshBasicMaterial({
        color: "#718080",
        transparent: true,
        opacity: 0.06,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
      }),
      muzzleGlow: new MeshBasicMaterial({
        color: "#ffd48a",
        transparent: true,
        opacity: 0.05,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        side: DoubleSide,
      }),
      muzzleCore: new MeshBasicMaterial({
        color: "#fff4cf",
        transparent: true,
        opacity: 0.04,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
      muzzleKnife: new MeshBasicMaterial({
        color: "#ffb55c",
        transparent: true,
        opacity: 0.03,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        side: DoubleSide,
      }),
      heat: new MeshStandardMaterial({
        color: "#ff6b35",
        emissive: "#ff4b2f",
        emissiveIntensity: 1.3,
        metalness: 0.2,
        roughness: 0.16,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    };
  }, []);
}
