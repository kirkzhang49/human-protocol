import humanOriginWallArtUrl from "../../assets/gui/museum-wall-art/level03_human_origin.png";
import lastHumanWallArtUrl from "../../assets/gui/museum-wall-art/level03_last_human.png";
import protocolDiagramWallArtUrl from "../../assets/gui/museum-wall-art/level03_protocol_diagram.png";
import robotWorkerWallArtUrl from "../../assets/gui/museum-wall-art/level03_robot_worker.png";
import l4StoryAwakenedMachineUrl from "../../assets/gui/level04-story-paintings/l4_story_awakened_machine_image2_v1.png";
import l4StoryH0DischargeUrl from "../../assets/gui/level04-story-paintings/l4_story_h0_discharge_image2_v1.png";
import l4StoryPreservedChildhoodUrl from "../../assets/gui/level04-story-paintings/l4_story_preserved_childhood_image2_v1.png";
import l4StoryRescueLoopUrl from "../../assets/gui/level04-story-paintings/l4_story_rescue_loop_image2_v1.png";

export { isStoryPaintingArtModelKey, STORY_PAINTING_ART_MODEL_KEYS } from "./StoryPaintingArtKeys";

const storyPaintingArtUrls: Record<string, string> = {
  age_museum_wall_art_human_origin: humanOriginWallArtUrl,
  age_museum_wall_art_robot_worker: robotWorkerWallArtUrl,
  age_museum_wall_art_protocol_diagram: protocolDiagramWallArtUrl,
  age_museum_wall_art_last_human: lastHumanWallArtUrl,
  l4_story_awakened_machine_image2_v1: l4StoryAwakenedMachineUrl,
  l4_story_preserved_childhood_image2_v1: l4StoryPreservedChildhoodUrl,
  l4_story_rescue_loop_image2_v1: l4StoryRescueLoopUrl,
  l4_story_h0_discharge_image2_v1: l4StoryH0DischargeUrl,
};

const storyPaintingArtSpecs: Record<string, { size: readonly [number, number]; frame: number; centerY: number }> = {
  age_museum_wall_art_human_origin: { size: [1.82, 1.34], frame: 0.075, centerY: 0.74 },
  age_museum_wall_art_robot_worker: { size: [1.82, 1.34], frame: 0.075, centerY: 0.74 },
  age_museum_wall_art_protocol_diagram: { size: [1.82, 1.34], frame: 0.075, centerY: 0.74 },
  age_museum_wall_art_last_human: { size: [1.82, 1.34], frame: 0.075, centerY: 0.74 },
  l4_story_awakened_machine_image2_v1: { size: [1.25, 1.25], frame: 0.07, centerY: 0.72 },
  l4_story_preserved_childhood_image2_v1: { size: [1.25, 1.25], frame: 0.07, centerY: 0.72 },
  l4_story_rescue_loop_image2_v1: { size: [1.25, 1.25], frame: 0.07, centerY: 0.72 },
  l4_story_h0_discharge_image2_v1: { size: [1.25, 1.25], frame: 0.07, centerY: 0.72 },
};

export function storyPaintingArtUrl(modelKey: string): string | null {
  return storyPaintingArtUrls[modelKey] ?? null;
}

export function storyPaintingArtRuntimeSpec(modelKey: string) {
  return storyPaintingArtSpecs[modelKey] ?? null;
}
