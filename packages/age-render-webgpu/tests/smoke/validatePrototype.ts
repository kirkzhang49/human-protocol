import {
  AgeAssetRegistry,
  AgeGroundingPass,
  ageDefaultEscapeRoomVisualProfile,
  ageDefaultLightingParityProfile,
  ageLocalLightBudgetForTier,
  ageRoomLightBudgetFor,
  ageSelectRoomLights,
  createAgeWebGpuRenderGraph,
  validateAgeAssetBundleSchema,
  validateAgePreBackportReadiness,
  validateAgeSceneFrameRuntime,
} from "../../src";
import {
  minimalAgeAssetBundle,
  minimalAgeRenderPlan,
  minimalAgeSceneFrame,
} from "../fixtures/minimalAgeFixture";

const graph = createAgeWebGpuRenderGraph();
const graphDiagnostics = graph.validate({ strictReadBeforeWrite: true });
const graphErrors = graphDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
if (graphErrors.length > 0) {
  throw new Error(`Default graph has errors:\n${JSON.stringify(graphErrors, null, 2)}`);
}

const assets = new AgeAssetRegistry();
assets.registerBundle(minimalAgeAssetBundle);
const fixtureDiagnostics = [
  ...validateAgeAssetBundleSchema(minimalAgeAssetBundle),
  ...validateAgePreBackportReadiness({
    assets,
    renderPlan: minimalAgeRenderPlan,
    frame: minimalAgeSceneFrame,
  }),
];
const fixtureErrors = fixtureDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
if (fixtureErrors.length > 0) {
  throw new Error(`Minimal fixture has errors:\n${JSON.stringify(fixtureErrors, null, 2)}`);
}

const runtimeDiagnostics = validateAgeSceneFrameRuntime(minimalAgeSceneFrame);
const runtimeProblems = runtimeDiagnostics.filter((diagnostic) => diagnostic.severity !== "info");
if (runtimeProblems.length > 0) {
  throw new Error(`Minimal fixture frame failed runtime validation:\n${JSON.stringify(runtimeProblems, null, 2)}`);
}

const rescueBudget = ageLocalLightBudgetForTier(ageDefaultLightingParityProfile.localLightBudget, "rescue");
if (rescueBudget.maxShaderLights <= 0 || rescueBudget.maxShaderLights > ageDefaultLightingParityProfile.localLightBudget.maxShaderLights) {
  throw new Error("Default lighting parity profile has an inconsistent rescue-tier light budget.");
}

const groundingPass = new AgeGroundingPass();
const groundingQuads = groundingPass.planQuads(minimalAgeSceneFrame.contacts ?? [], ageDefaultEscapeRoomVisualProfile.grounding);
if (groundingQuads.length !== (minimalAgeSceneFrame.contacts?.length ?? 0)) {
  throw new Error(`Grounding pass planned ${groundingQuads.length} quads, expected ${minimalAgeSceneFrame.contacts?.length ?? 0}.`);
}
if (groundingQuads.some((quad) => quad.opacity <= 0 || quad.opacity > 0.42)) {
  throw new Error("Grounding quads must have opacity in (0, 0.42].");
}
const airborneQuads = groundingPass.planQuads(
  [{ id: "air", position: [0, 9, 0], halfExtents: [0.5, 0.5], strength: 0.3, grounded: true, source: "derived" }],
  ageDefaultEscapeRoomVisualProfile.grounding,
);
if (airborneQuads.length !== 0) {
  throw new Error("Contacts above fadeHeight must not produce grounding quads.");
}

const selectionBudget = ageRoomLightBudgetFor(ageDefaultEscapeRoomVisualProfile, "any-room", "rescue");
const selectedLights = ageSelectRoomLights(
  [
    { id: "a", roomId: "room-1", score: 2 },
    { id: "b", roomId: "room-2", score: 5 },
    { id: "c", roomId: "room-1", score: 1 },
    { id: "d", roomId: "room-2", score: 4 },
    { id: "glow", roomId: "room-1", score: 0.2, ambience: true },
  ],
  "room-1",
  selectionBudget,
  ageDefaultEscapeRoomVisualProfile.lightSelection,
);
if (selectedLights.length !== Math.min(5, selectionBudget)) {
  throw new Error(`Room light selection returned ${selectedLights.length} lights for budget ${selectionBudget}.`);
}
if (!selectedLights.some((light) => light.id === "glow")) {
  throw new Error("Room light selection must reserve an ambience slot when configured.");
}

console.log(JSON.stringify({
  graphPasses: graph.listPasses().length,
  graphWarnings: graphDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").map((diagnostic) => diagnostic.code),
  fixtureWarnings: fixtureDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").map((diagnostic) => diagnostic.code),
  runtimeWarnings: runtimeDiagnostics.map((diagnostic) => diagnostic.code),
  parityProfile: ageDefaultLightingParityProfile.id,
}, null, 2));
