import type { RobotState } from "../../game/entities/RobotState";
import { clamp } from "../../game/core/math";

export interface RobotPose {
  hoverY: number;
  torsoPitch: number;
  armSwing: number;
  legSwing: number;
  coreScale: number;
  coreIntensity: number;
  thrusterIntensity: number;
}

export function getRobotPose(player: RobotState, elapsed: number): RobotPose {
  const move = clamp(player.movementAmount, 0, 1);
  const stride = Math.sin(elapsed * 9.2) * move;
  const hover = Math.sin(elapsed * 2.1) * 0.035;
  const dashBoost = player.isDashing ? 1 : 0;
  const sprintBoost = player.isSprinting ? 0.42 : 0;
  const corePulse = 0.5 + Math.sin(elapsed * 4.8) * 0.5;

  return {
    hoverY: hover + dashBoost * 0.05,
    torsoPitch: -move * 0.045 - dashBoost * 0.09,
    armSwing: stride * 0.22,
    legSwing: stride * 0.34,
    coreScale: 1 + corePulse * 0.12 + dashBoost * 0.08,
    coreIntensity: 2.1 + corePulse * 1.2 + dashBoost * 1.2,
    thrusterIntensity: 0.35 + sprintBoost + dashBoost * 1.6,
  };
}
