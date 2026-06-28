import { describe, expect, it } from "vitest";
import type { BuilderProject, BuilderRoom } from "./BuilderTypes";
import { builderProjectSurfaceTextureUrls } from "./BuilderPhotoTextureCache";

function room(id: string): BuilderRoom {
  return {
    id,
    label: id,
    style: "museum",
    center: [0, 0],
    size: [8, 8],
    env: {
      floorPresetId: "floor_photo_marble",
      wallPresetId: "wall_hp_museum_limestone_panel",
      ceilingPresetId: "ceiling_hp_museum_coffered_limestone",
    },
  };
}

describe("builderProjectSurfaceTextureUrls", () => {
  it("collects each unique floor/wall/ceiling PBR texture only once per project", () => {
    const project: BuilderProject = {
      schemaVersion: "hp.builder.v1",
      projectId: "texture-test",
      title: "Texture Test",
      rooms: [room("a"), room("b")],
      doors: [],
      props: [],
      puzzles: [],
      robots: [],
      pickups: [],
      exitRoomId: "a",
    };

    const urls = builderProjectSurfaceTextureUrls(project);

    expect(urls).toHaveLength(9);
    expect(new Set(urls.map((entry) => `${entry.url}:${entry.srgb ? "srgb" : "linear"}`)).size).toBe(9);
    expect(urls.filter((entry) => entry.srgb)).toHaveLength(3);
  });
});
