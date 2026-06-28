import { describe, expect, it } from "vitest";
import { reflowAttachedProps, resolvePropStacking, propWithStacking } from "./BuilderPropStacking";
import type { BuilderProject, BuilderProp } from "./BuilderTypes";

function projectWithProps(props: BuilderProp[]): BuilderProject {
  return {
    schemaVersion: "hp.builder.v1",
    projectId: "stacking_test",
    title: "Stacking Test",
    rooms: [{ id: "room", label: "Room", center: [0, 0], size: [8, 8], style: "maintenance" }],
    doors: [],
    props,
    robots: [],
    exitRoomId: "room",
  };
}

describe("BuilderPropStacking", () => {
  it("attaches a tabletop prop to a support surface", () => {
    const table: BuilderProp = { id: "table", modelKey: "room_table_utility", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 };
    const project = projectWithProps([table]);
    const lamp: BuilderProp = { id: "lamp", modelKey: "room_cc0_lantern", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 };
    const resolved = resolvePropStacking(project, lamp, 0, 0, "room");
    expect(resolved.valid).toBe(true);
    expect(resolved.hit?.parentPropId).toBe("table");
    expect(resolved.elevation).toBeGreaterThan(0.7);
  });

  it("requires tabletop-only props to land on a support surface", () => {
    const lamp: BuilderProp = { id: "lamp", modelKey: "room_cc0_lantern", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 };
    const resolved = resolvePropStacking(projectWithProps([]), lamp, 0, 0, "room");
    expect(resolved.valid).toBe(false);
    expect(resolved.reason).toBe("no_support");
  });

  it("uses bookshelf assets as shelf support surfaces", () => {
    const shelf: BuilderProp = { id: "shelf", modelKey: "room_cc0_shelf", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 };
    const clock: BuilderProp = { id: "clock", modelKey: "room_cc0_clock", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 };
    const resolved = resolvePropStacking(projectWithProps([shelf]), clock, 0, 0, "room");
    expect(resolved.valid).toBe(true);
    expect(resolved.hit?.surfaceKind).toBe("shelf");
  });

  it("reflows attached props when the parent moves", () => {
    const table: BuilderProp = { id: "table", modelKey: "room_table_utility", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 };
    const project = projectWithProps([table]);
    const lamp = propWithStacking(
      { id: "lamp", modelKey: "room_cc0_lantern", roomId: "room", position: [0.2, 0.1], rotationY: 0, scale: 1 },
      resolvePropStacking(project, { id: "lamp", modelKey: "room_cc0_lantern", rotationY: 0, scale: 1 }, 0.2, 0.1, "room"),
    );
    const moved = reflowAttachedProps(projectWithProps([{ ...table, position: [2, 1] }, lamp]));
    const movedLamp = moved.props.find((prop) => prop.id === "lamp");
    expect(movedLamp?.position[0]).toBeCloseTo(2.2);
    expect(movedLamp?.position[1]).toBeCloseTo(1.1);
  });

  it("rejects two small props occupying the same parent surface spot", () => {
    const table: BuilderProp = { id: "table", modelKey: "room_table_utility", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 };
    const project = projectWithProps([table]);
    const first = propWithStacking(
      { id: "first", modelKey: "room_cc0_clock", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 },
      resolvePropStacking(project, { id: "first", modelKey: "room_cc0_clock", rotationY: 0, scale: 1 }, 0, 0, "room"),
    );
    const blocked = resolvePropStacking(projectWithProps([table, first]), { id: "second", modelKey: "room_cc0_clock", rotationY: 0, scale: 1 }, 0, 0, "room");
    expect(blocked.valid).toBe(false);
    expect(blocked.overlapPropId).toBe("first");
  });

  it("prevents infinitely stacking support props", () => {
    const table: BuilderProp = { id: "table", modelKey: "room_table_utility", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 };
    let project = projectWithProps([table]);
    const makeFolder = (id: string) =>
      propWithStacking(
        { id, modelKey: "prop_archive_folder_stack", roomId: "room", position: [0, 0], rotationY: 0, scale: 1 },
        resolvePropStacking(project, { id, modelKey: "prop_archive_folder_stack", rotationY: 0, scale: 1 }, 0, 0, "room"),
      );
    const first = makeFolder("first");
    project = projectWithProps([table, first]);
    const second = makeFolder("second");
    project = projectWithProps([table, first, second]);
    const third = makeFolder("third");
    project = projectWithProps([table, first, second, third]);
    const blocked = resolvePropStacking(project, { id: "fourth", modelKey: "prop_archive_folder_stack", rotationY: 0, scale: 1 }, 0, 0, "room");
    expect(blocked.valid).toBe(false);
  });
});
