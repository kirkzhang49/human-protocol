import type { FlowCopy, ObjectiveCopy } from "../LevelLocalization";

/**
 * Shared English objective copy. Lives in its own leaf module (type-only import
 * back to LevelLocalization) so per-level files can spread it at module-eval
 * time without a circular-import TDZ while LevelLocalization assembles copy maps.
 */
export const commonObjectiveEnglish: ObjectiveCopy = {
  upgrade: { title: "Adapt", detail: "Choose one body response.", progressLabel: "Upgrade", progressText: "Pick" },
  preRod: { title: "Pick up the rod", detail: "Do not stay empty-handed." },
  prePistol: { title: "Pick up the pistol", detail: "Twenty rounds before a long reload." },
  default: { title: "Survive", detail: "Keep moving." },
  exitUnlocked: { title: "Reach the exit", detail: "Do not clear the room.", progressLabel: "Exit", progressText: "Go" },
};

/**
 * English for the shared campaignPresentationBase.flow defaults (campaignDefaults.ts),
 * which are spread into every level's presentation.flow. localizedFlow layers this
 * between the zh source and any per-level override, so shared title / death /
 * transition / victory copy is translated for every campaign level at once.
 */
export const commonFlowEnglish: {
  title: Partial<FlowCopy["title"]>;
  death: Partial<FlowCopy["death"]>;
  transition: Partial<FlowCopy["transition"]>;
  victory: Partial<FlowCopy["victory"]>;
} = {
  title: {
    system: "Abnormal Life Signal",
    heading: "Human Protocol",
    body: "You wake inside a protocol that was never meant to hold a person.",
    signalStrip: ["Vitals", "Access", "Radio Noise"],
    startButton: "Start",
  },
  death: {
    system: "Revive Failed",
    heading: "You Went Down",
    itchSuffix: "No ads in the itch build.",
    reviveOfferPrefix: "A few seconds of adrenaline after you wake.",
    cacheReadyText: "Supply is ready.",
    reviveButtonRewarded: "Watch ad to revive",
    reviveButtonLocal: "Revive",
    restartButton: "Replay level",
    restartAfterReviveUsedButton: "Restart",
  },
  transition: {
    system: "Exit",
    heading: "Descending",
  },
  victory: {
    system: "File Fragment",
    heading: "Record Complete",
    body: "The door closes, but the next floor is still lit.",
    doubleMemoryButton: "Ad x2 score",
    doubleMemoryClaimedButton: "x2 score claimed",
    replayButton: "Replay",
  },
};
