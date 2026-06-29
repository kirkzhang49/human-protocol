import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { resolveRoomPresentation, resolveRoomRelativePosition } from "../game/config/RoomPresentationRegistry";
import { playerConfig } from "../game/config/playerConfig";
import type { GameWorld } from "../game/core/GameWorld";
import { applyFocusRevealCameraBlend, focusRevealCameraApproach } from "./focusRevealCamera";

interface CameraRigProps {
  world: GameWorld;
}

export function CameraRig({ world }: CameraRigProps) {
  const lookTarget = new Vector3();
  const shakeOffset = new Vector3();
  const cameraPosition = new Vector3();
  const revealPosition = new Vector3();
  const revealTarget = new Vector3();
  const artPreview = isArtPreviewMode();
  const lastRevealWasCameraCut = useRef(false);

  useFrame(({ camera, clock }, delta) => {
    const map = world.level.map;
    const previewCamera = resolveRoomPresentation(map)?.previewCamera;
    if (artPreview && map && previewCamera) {
      const position =
        previewCamera.positionMode === "room_relative_xz"
          ? resolveRoomRelativePosition(map, previewCamera.roomId, previewCamera.position)
          : previewCamera.position;
      const target =
        previewCamera.positionMode === "room_relative_xz"
          ? resolveRoomRelativePosition(map, previewCamera.roomId, previewCamera.target)
          : previewCamera.target;
      cameraPosition.fromArray(position);
      lookTarget.fromArray(target);
      camera.position.lerp(cameraPosition, 1 - Math.exp(-10 * delta));
      camera.lookAt(lookTarget);
      if ("fov" in camera && "updateProjectionMatrix" in camera) {
        camera.fov = previewCamera.fov;
        camera.updateProjectionMatrix();
      }
      return;
    }

    const player = world.player;
    const shake = world.camera.shake;
    const rumble = world.camera.rumbleRemaining > 0 ? world.camera.rumble : 0;
    const rumbleEnvelope = rumble > 0 ? Math.min(1, world.camera.rumbleRemaining * 4) : 0;
    const seed = world.camera.shakeSeed;
    const recoil = player.weaponRecoil * 0.055;
    shakeOffset.set(
      Math.sin(clock.elapsedTime * 55 + seed * 1.7) * shake * 0.1,
      Math.cos(clock.elapsedTime * 45 + seed) * shake * 0.045,
      Math.sin(clock.elapsedTime * 47 + seed * 2.4) * shake * 0.1 + recoil,
    );
    if (rumble > 0) {
      shakeOffset.x += Math.sin(clock.elapsedTime * 17 + seed * 0.8) * rumble * rumbleEnvelope * 0.11;
      shakeOffset.y += Math.cos(clock.elapsedTime * 13 + seed * 1.1) * rumble * rumbleEnvelope * 0.055;
      shakeOffset.z += Math.sin(clock.elapsedTime * 11 + seed * 1.4) * rumble * rumbleEnvelope * 0.14;
    }

    cameraPosition.copy(player.position);
    cameraPosition.y += playerConfig.cockpitHeight;
    cameraPosition.add(shakeOffset);
    lookTarget.copy(cameraPosition).addScaledVector(player.aimDirection, 10);
    const combatFocus =
      world.camera.combatFocusTotal > 0
        ? Math.max(0, Math.min(1, world.camera.combatFocusRemaining / world.camera.combatFocusTotal)) * world.camera.combatFocusStrength
        : 0;
    if (combatFocus > 0.001) {
      lookTarget.lerp(world.camera.combatFocusTarget, Math.min(0.68, combatFocus));
      cameraPosition.addScaledVector(player.aimDirection, combatFocus * 0.18);
    }

    const reveal = world.session.activeFocusReveal;
    applyFocusRevealCameraBlend(reveal, cameraPosition, lookTarget, revealPosition, revealTarget);
    const snapReturnFromCameraCut = !reveal && lastRevealWasCameraCut.current;
    lastRevealWasCameraCut.current = Boolean(reveal?.cameraCut);

    camera.position.lerp(
      cameraPosition,
      1 - Math.exp(-focusRevealCameraApproach(reveal, { snapReturnFromCameraCut }) * delta),
    );
    camera.lookAt(lookTarget);
    if ("fov" in camera && "updateProjectionMatrix" in camera) {
      camera.fov = 72 + world.camera.fovKick;
      camera.updateProjectionMatrix();
    }
  }, -50);

  return null;
}

function isArtPreviewMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("artPreview") === "1" || params.get("roomPreview") === "1";
}
