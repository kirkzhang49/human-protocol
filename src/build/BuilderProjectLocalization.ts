import type { GameLanguage } from "../game/core/GameSettings";
import type { BuilderProject } from "./BuilderTypes";
import { bl } from "./i18n/catalogLabels";

function localizeText(text: string | undefined, language: GameLanguage) {
  if (!text || language !== "en") return text;
  return bl(text, language);
}

export function localizeBuilderProjectSourceCopy(project: BuilderProject, language: GameLanguage): BuilderProject {
  if (language !== "en") return project;
  return {
    ...project,
    title: localizeText(project.title, language) ?? project.title,
    rooms: project.rooms.map((room) => ({ ...room, label: localizeText(room.label, language) ?? room.label })),
    doors: project.doors.map((door) => ({
      ...door,
      label: localizeText(door.label, language),
    })),
    props: project.props.map((prop) => ({
      ...prop,
      story: prop.story
        ? {
            ...prop.story,
            title: localizeText(prop.story.title, language),
            clue: localizeText(prop.story.clue, language),
            hint: localizeText(prop.story.hint, language),
          }
        : prop.story,
    })),
    routeSwitches: project.routeSwitches?.map((route) => ({
      ...route,
      label: localizeText(route.label, language) ?? route.label,
      outputs: route.outputs.map((output) => ({
        ...output,
        label: localizeText(output.label, language),
      })),
    })),
    wallDoorSwitches: project.wallDoorSwitches?.map((wallSwitch) => ({
      ...wallSwitch,
      label: localizeText(wallSwitch.label, language) ?? wallSwitch.label,
      states: wallSwitch.states.map((state) => ({
        ...state,
        label: localizeText(state.label, language) ?? state.label,
        message: localizeText(state.message, language),
      })),
    })),
    story: project.story
      ? {
          ...project.story,
          victoryLine: localizeText(project.story.victoryLine, language),
          transitionLine: localizeText(project.story.transitionLine, language),
        }
      : project.story,
  };
}
