import type { GameWorld } from "./GameWorld";
import { clamp01, exitAscentProgress, exitButtonPressLeadIn, segment, smoothstep } from "./ExitCinematicTiming";

export { exitButtonPressLeadIn } from "./ExitCinematicTiming";

export type ExitActivationSource = "interaction" | "proximity" | "script";

export type ExitFlowDecision =
  | { type: "ignored"; reason: "mode" | "locked" | "already_active"; source: ExitActivationSource }
  | { type: "cinematic"; source: ExitActivationSource }
  | { type: "transition"; source: ExitActivationSource };

export class ExitFlowStateMachine {
  requestActivation(world: GameWorld, source: ExitActivationSource): ExitFlowDecision {
    const decision = this.decideActivation(world, source);
    if (decision.type === "cinematic") {
      world.beginExitCinematic(source);
    } else if (decision.type === "transition") {
      world.beginExitTransition(source);
    }
    return decision;
  }

  update(world: GameWorld, delta: number) {
    const state = world.session.activeExitCinematic;
    if (world.session.mode !== "exitCinematic" || !state) return;

    state.elapsed = Math.min(state.duration, state.elapsed + delta);
    const walkT = smoothstep(clamp01(state.elapsed / Math.max(0.001, state.walkInDuration)));
    const pressLeadIn = exitButtonPressLeadIn(state.buttonPressDuration);
    const turnStart = Math.max(0.35, state.walkInDuration * 0.78);
    const turnEnd = Math.max(
      turnStart + 0.75,
      Math.min(state.buttonPressTime - pressLeadIn - 0.08, state.walkInDuration + 1.2),
    );
    const turnT = smoothstep(segment(state.elapsed, turnStart, turnEnd));
    const player = world.player;
    player.position.set(
      lerp(state.startPosition[0], state.enterPosition[0], walkT),
      lerp(state.startPosition[1], state.enterPosition[1], walkT),
      lerp(state.startPosition[2], state.enterPosition[2], walkT),
    );
    player.velocity.set(0, 0, 0);
    player.isDashing = false;
    player.isSprinting = false;
    player.isMoving = walkT > 0 && walkT < 1;
    player.movementAmount = player.isMoving ? 0.42 : 0;
    player.rotationY = lerpAngle(state.startYaw, state.faceYaw, turnT);
    player.targetRotationY = player.rotationY;
    player.aimDirection.set(Math.sin(player.rotationY), 0, -Math.cos(player.rotationY));
    player.aimPoint.copy(player.position).addScaledVector(player.aimDirection, 18);

    if (state.doorId && state.elapsed >= state.doorOpenTime && !world.session.cinematicBeatFlags.exitElevatorDoorOpened) {
      world.openConfiguredDoor(state.doorId);
      world.session.cinematicBeatFlags.exitElevatorDoorOpened = true;
    }

    if (state.doorId && state.elapsed >= state.doorCloseTime && !world.session.cinematicBeatFlags.exitElevatorDoorClosed) {
      world.closeConfiguredDoor(state.doorId);
      world.session.cinematicBeatFlags.exitElevatorDoorClosed = true;
      world.camera.shake = Math.max(world.camera.shake, 0.16);
      world.emitAudio("system_exit_open", { intensity: 0.68, position: player.position });
    }

    if (state.elapsed >= state.buttonPressTime && !world.session.cinematicBeatFlags.exitElevatorButtonPressed) {
      world.session.cinematicBeatFlags.exitElevatorButtonPressed = true;
      world.camera.fovKick = Math.max(world.camera.fovKick, 1.8);
      world.triggerRenderSurge(1.1, 0.48);
      world.emitAudio("ui_confirm", { intensity: 0.9, position: player.position });
    }

    if (state.elapsed >= state.buttonPressTime + 0.22 && !world.session.cinematicBeatFlags.exitElevatorPanelConfirmed) {
      world.session.cinematicBeatFlags.exitElevatorPanelConfirmed = true;
      world.camera.shake = Math.max(world.camera.shake, 0.12);
      world.triggerRenderSurge(1.06, 0.34);
      world.emitAudio("system_exit_open", { intensity: 0.42, position: player.position });
    }

    const ascentProgress = exitAscentProgress(state);
    if (ascentProgress > 0 && !world.session.cinematicBeatFlags.exitElevatorAscentStarted) {
      world.session.cinematicBeatFlags.exitElevatorAscentStarted = true;
      world.camera.shake = Math.max(world.camera.shake, 0.22);
      world.camera.fovKick = Math.max(world.camera.fovKick, 2.4);
      world.triggerRenderSurge(1.25, Math.min(1.2, state.ascentDuration * 0.3));
      world.emitAudio("system_transition", { intensity: 0.72, position: player.position });
    }
    if (ascentProgress > 0 && ascentProgress < 1) {
      const rumble = Math.sin((state.elapsed - state.ascentStartTime) * 15.5) * 0.035 + 0.075;
      world.camera.shake = Math.max(world.camera.shake, rumble);
    }

    if (state.elapsed >= state.duration) {
      world.beginExitTransition("script");
    }
  }

  private decideActivation(world: GameWorld, source: ExitActivationSource): ExitFlowDecision {
    if (world.session.mode === "exitCinematic" || world.session.mode === "transition" || world.session.mode === "victory") {
      return { type: "ignored", reason: "already_active", source };
    }
    if (world.session.mode !== "playing") {
      return { type: "ignored", reason: "mode", source };
    }
    if (!world.session.exitUnlocked) {
      return { type: "ignored", reason: "locked", source };
    }
    return world.level.exit.cinematic ? { type: "cinematic", source } : { type: "transition", source };
  }
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function lerpAngle(from: number, to: number, t: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * t;
}
