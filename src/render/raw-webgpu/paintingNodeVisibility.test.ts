import { describe, expect, it } from "vitest";
import {
  isMuseumWallArtModelKey,
  isMuseumWallArtOverlayNode,
} from "./paintingNodeVisibility";

describe("wall-art raw node visibility", () => {
  it("recognizes the legacy museum wall-art model family", () => {
    expect(isMuseumWallArtModelKey("age_museum_wall_art_human_origin")).toBe(true);
    expect(isMuseumWallArtModelKey("l4_story_awakened_machine_image2_v1")).toBe(false);
    expect(isMuseumWallArtModelKey("room_museum_glass_vitrine_specimen")).toBe(false);
  });

  it("hides the old museum white washer overlay without hiding the readable face", () => {
    expect(isMuseumWallArtOverlayNode("age_museum_wall_art_human_origin_gallery_white_wall_washer")).toBe(true);
    expect(isMuseumWallArtOverlayNode("age_museum_wall_art_human_origin_front_image2_readable_face")).toBe(false);
    expect(isMuseumWallArtOverlayNode("room_museum_glass_vitrine_specimen_gallery_white_wall_washer")).toBe(false);
  });
});
