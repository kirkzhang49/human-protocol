import type { GameSessionState } from "./GameMode";

export function isExitCinematicViewActive(world: {
  session: Pick<GameSessionState, "activeCampaignTransitionDialogue" | "activeExitCinematic" | "mode">;
}) {
  return (
    world.session.mode === "exitCinematic" ||
    (world.session.mode === "transition" &&
      world.session.activeCampaignTransitionDialogue !== null &&
      world.session.activeExitCinematic !== null)
  );
}
