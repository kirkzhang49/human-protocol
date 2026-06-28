import { Vector3 } from "three";
import { playerConfig } from "../config/playerConfig";
import type { RobotState } from "./RobotState";

export function createPlayerRobot(id = 1): RobotState {
  return {
    id,
    skinId: "CrimsonCoreHeavyMech",
    position: new Vector3(0, 0, 0),
    velocity: new Vector3(),
    aimPoint: new Vector3(0, 1.4, -24),
    aimDirection: new Vector3(0, 0, -1),
    dashDirection: new Vector3(0, 0, -1),
    rotationY: 0,
    cameraPitch: -0.04,
    targetRotationY: 0,
    health: playerConfig.maxHealth,
    maxHealth: playerConfig.maxHealth,
    energy: playerConfig.maxEnergy,
    maxEnergy: playerConfig.maxEnergy,
    dashCooldownRemaining: 0,
    dashTimeRemaining: 0,
    isDashing: false,
    isSprinting: false,
    isMoving: false,
    movementAmount: 0,
    currentWeapon: "pulseRifle",
    fireCooldownRemaining: 0,
    gunAmmo: 20,
    gunMaxAmmo: 20,
    gunReloadRemaining: 0,
    gunReloadDuration: 3.6,
    fireSequence: 0,
    dashSequence: 0,
    weaponSwitchSequence: 0,
    heat: 0,
    maxHeat: 100,
    damageFlash: 0,
    weaponRecoil: 0,
    activeHardpoint: "leftCannon",
    cannonRecoil: {
      leftCannon: 0,
      rightCannon: 0,
    },
  };
}
