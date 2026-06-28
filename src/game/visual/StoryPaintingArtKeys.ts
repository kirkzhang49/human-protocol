export const STORY_PAINTING_ART_MODEL_KEYS = [
  "age_museum_wall_art_human_origin",
  "age_museum_wall_art_robot_worker",
  "age_museum_wall_art_protocol_diagram",
  "age_museum_wall_art_last_human",
  "l4_story_awakened_machine_image2_v1",
  "l4_story_preserved_childhood_image2_v1",
  "l4_story_rescue_loop_image2_v1",
  "l4_story_h0_discharge_image2_v1",
] as const;

export type StoryPaintingArtModelKey = (typeof STORY_PAINTING_ART_MODEL_KEYS)[number];

const storyPaintingArtModelKeySet = new Set<string>(STORY_PAINTING_ART_MODEL_KEYS);

export function isStoryPaintingArtModelKey(modelKey: string): modelKey is StoryPaintingArtModelKey {
  return storyPaintingArtModelKeySet.has(modelKey);
}
