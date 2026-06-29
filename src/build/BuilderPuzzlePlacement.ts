import type { BuilderProject, BuilderProp, BuilderPuzzleComponent, BuilderPuzzleInstance, BuilderRouteSwitch } from "./BuilderTypes";

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
    let nextInstance = instance;
    if (instance.sourceInteraction?.hostPropId === propId && !puzzleInteractionPlacementMatches(instance, prop)) {
      changed = true;
      nextInstance = puzzleInteractionWithPropPlacement(nextInstance, prop);
    }
    let componentsChanged = false;
    const components = (nextInstance.components ?? []).map((component) => {
      if (puzzleComponentAnchorPropId(component) !== propId) return component;
      if (componentPlacementMatches(component, prop.position, prop.roomId)) return component;
      changed = true;
      componentsChanged = true;
      return puzzleComponentWithPlacement(component, prop.position, prop.roomId);
    });
    return componentsChanged ? { ...nextInstance, components } : nextInstance;
  });
  const routeSwitches = (project.routeSwitches ?? []).map((route) => {
    if (route.hostPropId !== propId || routePlacementMatches(route, prop)) return route;
    changed = true;
    return routeWithPropPlacement(route, prop);
  });
  if (!changed) return project;
  return { ...project, puzzles, routeSwitches };
}

export function normalizeAnchoredPuzzleComponents(project: BuilderProject): BuilderProject {
  const propsById = new Map(project.props.map((prop) => [prop.id, prop]));
  let changed = false;
  const puzzles = (project.puzzles ?? []).map((instance) => {
    let nextInstance = instance;
    const hostProp = instance.sourceInteraction?.hostPropId ? propsById.get(instance.sourceInteraction.hostPropId) : null;
    if (hostProp && !puzzleInteractionPlacementMatches(instance, hostProp)) {
      changed = true;
      nextInstance = puzzleInteractionWithPropPlacement(nextInstance, hostProp);
    }
    let componentsChanged = false;
    const components = (nextInstance.components ?? []).map((component) => {
      const anchorPropId = puzzleComponentAnchorPropId(component);
      const prop = anchorPropId ? propsById.get(anchorPropId) : null;
      if (!prop || componentPlacementMatches(component, prop.position, prop.roomId)) return component;
      changed = true;
      componentsChanged = true;
      return puzzleComponentWithPlacement(component, prop.position, prop.roomId);
    });
    return componentsChanged ? { ...nextInstance, components } : nextInstance;
  });
  const routeSwitches = (project.routeSwitches ?? []).map((route) => {
    const prop = route.hostPropId ? propsById.get(route.hostPropId) : null;
    if (!prop || routePlacementMatches(route, prop)) return route;
    changed = true;
    return routeWithPropPlacement(route, prop);
  });
  return changed ? { ...project, puzzles, routeSwitches } : project;
}

export function projectWithHostedRouteSwitchProp(project: BuilderProject, routeId: string, prop: BuilderProp): BuilderProject {
  const route = (project.routeSwitches ?? []).find((candidate) => candidate.id === routeId);
  if (route?.hostPropId !== prop.id) return project;
  return projectWithAnchoredPuzzleComponentsForProp({
    ...project,
    props: project.props.map((candidate) => (candidate.id === prop.id ? prop : candidate)),
  }, prop.id);
}

function puzzleInteractionWithPropPlacement(instance: BuilderPuzzleInstance, prop: BuilderProp): BuilderPuzzleInstance {
  return {
    ...instance,
    roomId: prop.roomId,
    position: [prop.position[0], prop.position[1]] as const,
    rotationY: prop.rotationY,
    wallMount: undefined,
  };
}

function routeWithPropPlacement(route: BuilderRouteSwitch, prop: BuilderProp): BuilderRouteSwitch {
  return {
    ...route,
    roomId: prop.roomId,
    position: [prop.position[0], prop.position[1]] as const,
    rotationY: prop.rotationY,
    wallMount: undefined,
  };
}

function puzzleInteractionPlacementMatches(instance: BuilderPuzzleInstance, prop: BuilderProp): boolean {
  return (
    instance.roomId === prop.roomId &&
    Math.abs(instance.position[0] - prop.position[0]) <= EPSILON &&
    Math.abs(instance.position[1] - prop.position[1]) <= EPSILON &&
    Math.abs(instance.rotationY - prop.rotationY) <= EPSILON &&
    !instance.wallMount
  );
}

function routePlacementMatches(route: BuilderRouteSwitch, prop: BuilderProp): boolean {
  return (
    route.roomId === prop.roomId &&
    Math.abs(route.position[0] - prop.position[0]) <= EPSILON &&
    Math.abs(route.position[1] - prop.position[1]) <= EPSILON &&
    Math.abs(route.rotationY - prop.rotationY) <= EPSILON &&
    !route.wallMount
  );
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
