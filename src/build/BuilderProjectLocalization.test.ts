import { describe, expect, it } from "vitest";
import { builderTemplates, createBlankProject } from "./BuilderDirector";
import { localizeBuilderProjectSourceCopy } from "./BuilderProjectLocalization";
import { createStarterProject } from "./BuilderTypes";

const cjkPattern = /[\u3400-\u9fff]/u;

function visibleProjectCopy(project: ReturnType<typeof createBlankProject>) {
  return [
    project.title,
    ...project.rooms.map((room) => room.label),
    ...project.doors.map((door) => door.label),
    ...project.props.flatMap((prop) => [prop.story?.title, prop.story?.clue, prop.story?.hint]),
    project.story?.victoryLine,
    project.story?.transitionLine,
  ].filter((value): value is string => Boolean(value));
}

describe("builder project source localization", () => {
  it("localizes default starter and dev template titles before English playtest", () => {
    const projects = [
      createBlankProject(),
      createStarterProject(),
      ...builderTemplates.map((template) => template.create()),
    ].map((project) => localizeBuilderProjectSourceCopy(project, "en"));
    const leaked = projects.flatMap(visibleProjectCopy).filter((text) => cjkPattern.test(text));

    expect(leaked).toEqual([]);
  });
});
