import type { BuilderProject, BuilderPuzzleComponent } from "./BuilderTypes";

const EPSILON = 0.001;

export function puzzleComponentAnchorPropId(component: BuilderPuzzleComponent): string | null {
  return component.sourceActor?.anchorPropId ?? component.sourceTarget?.anchorPropId ?? null;
}

export function puzzleComponentY(component: BuilderPuzzleComponent): number {
  return component.sourceActor?.position?.[1] ?? component.sourceTarget?.y ?? 1.15;
}

export function puzzleComponentWithPlacement(
  component: BuilderPuzzleComponent,
  position: readonly [number, number],
  roomId: string,
): BuilderPuzzleComponent {
  const y = puzzleComponentY(component);
  return {
    ...component,
    roomId,
    position: [position[0], position[1]] as const,
    ...(component.sourceActor
      ? {
          sourceActor: {
            ...component.sourceActor,
            roomId,
            position: [position[0], y, position[1]] as [number, number, number],
          },
        }
      : {}),
  };
}

export function projectWithAnchoredPuzzleComponentPlacement(
  project: BuilderProject,
  puzzleId: string,
  componentId: string,
  position: readonly [number, number],
  roomId: string,
): BuilderProject {
  let anchorPropId: string | null = null;
  const puzzles = (project.puzzles ?? []).map((instance) => {
    if (instance.id !== puzzleId) return instance;
    return {
      ...instance,
      components: (instance.components ?? []).map((component) => {
        if (component.id !== componentId) return component;
        anchorPropId = puzzleComponentAnchorPropId(component);
        return puzzleComponentWithPlacement(component, position, roomId);
      }),
    };
  });
  if (!anchorPropId) return { ...project, puzzles };
  return {
    ...project,
    puzzles,
    props: project.props.map((prop) =>
      prop.id === anchorPropId
        ? { ...prop, position: [position[0], position[1]] as [number, number], roomId }
        : prop,
    ),
  };
}

export function projectWithAnchoredPuzzleComponentsForProp(project: BuilderProject, propId: string): BuilderProject {
  const prop = project.props.find((candidate) => candidate.id === propId);
  if (!prop) return project;
  let changed = false;
  const puzzles = (project.puzzles ?? []).map((instance) => {
    let instanceChanged = false;
    const components = (instance.components ?? []).map((component) => {
      if (puzzleComponentAnchorPropId(component) !== propId) return component;
      if (componentPlacementMatches(component, prop.position, prop.roomId)) return component;
      changed = true;
      instanceChanged = true;
      return puzzleComponentWithPlacement(component, prop.position, prop.roomId);
    });
    return instanceChanged ? { ...instance, components } : instance;
  });
  return changed ? { ...project, puzzles } : project;
}

export function normalizeAnchoredPuzzleComponents(project: BuilderProject): BuilderProject {
  const propsById = new Map(project.props.map((prop) => [prop.id, prop]));
  let changed = false;
  const puzzles = (project.puzzles ?? []).map((instance) => {
    let instanceChanged = false;
    const components = (instance.components ?? []).map((component) => {
      const anchorPropId = puzzleComponentAnchorPropId(component);
      const prop = anchorPropId ? propsById.get(anchorPropId) : null;
      if (!prop || componentPlacementMatches(component, prop.position, prop.roomId)) return component;
      changed = true;
      instanceChanged = true;
      return puzzleComponentWithPlacement(component, prop.position, prop.roomId);
    });
    return instanceChanged ? { ...instance, components } : instance;
  });
  return changed ? { ...project, puzzles } : project;
}

function componentPlacementMatches(
  component: BuilderPuzzleComponent,
  position: readonly [number, number],
  roomId: string,
): boolean {
  const actor = component.sourceActor;
  const sameComponent =
    component.roomId === roomId &&
    Math.abs(component.position[0] - position[0]) <= EPSILON &&
    Math.abs(component.position[1] - position[1]) <= EPSILON;
  if (!sameComponent) return false;
  if (!actor) return true;
  return (
    actor.roomId === roomId &&
    Math.abs((actor.position?.[0] ?? position[0]) - position[0]) <= EPSILON &&
    Math.abs((actor.position?.[2] ?? position[1]) - position[1]) <= EPSILON
  );
}
