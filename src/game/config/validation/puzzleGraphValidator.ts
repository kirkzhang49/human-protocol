import type {
  LevelDefinition,
  LevelDoorDefinition,
  LevelEventTriggerDefinition,
  LevelMapConfig,
  LevelObjectiveDefinition,
  LevelPuzzleDefinition,
  LevelRuntimeEventAction,
} from "../schema/levelConfig";
import { bigScreenStateKey, switchStateKey } from "./ids";
import { addIssue as add, type ConfigValidationIssue } from "./issues";
import { roomContaining } from "./mapValidator";

export interface PuzzleGraphStep {
  objectiveId: string;
  title: string;
  startsWhen: string;
  completesWhen: string;
  requiredIds: readonly string[];
}

export interface PuzzleGraphLock {
  doorId: string;
  label: string;
  fromRoomId: string;
  toRoomId: string;
  lockType: string;
  requires: readonly string[];
  blocksCriticalPath: boolean;
}

export interface PuzzleGraphPuzzle {
  puzzleId: string;
  type: LevelPuzzleDefinition["type"];
  label: string;
  roomId: string;
  clue: string;
  expectedInput: string;
  opensDoorId?: string;
  unlocksDoorId?: string;
  unlocksExit: boolean;
  requires: readonly string[];
}

export interface PuzzleGraphReachability {
  rooms: readonly string[];
  doors: readonly string[];
  keyItems: readonly string[];
  interactions: readonly string[];
  puzzles: readonly string[];
  articles: readonly string[];
  quizzes: readonly string[];
  switches: readonly string[];
  bigScreens: readonly string[];
  objectives: readonly string[];
  waves: readonly string[];
  exitUnlocked: boolean;
  exitInteractionReady: boolean;
  solutionPath: readonly PuzzleGraphPlanStep[];
  softlocks: readonly PuzzleGraphSoftlock[];
}

export interface PuzzleGraphPlanStep {
  kind: "room" | "key" | "interaction" | "article" | "quiz" | "switch" | "big_screen" | "puzzle" | "target" | "wave" | "objective" | "event" | "exit";
  id: string;
  label: string;
  roomId?: string;
  detail?: string;
}

export interface PuzzleGraphSoftlock {
  roomIds: readonly string[];
  afterStepId: string | null;
  reason: string;
  path: readonly PuzzleGraphPlanStep[];
}

export interface PuzzleGraphExplanation {
  levelId: string;
  title: string;
  startRoomId: string | null;
  exitRoomId: string | null;
  criticalPathRoomIds: readonly string[];
  objectivePath: readonly PuzzleGraphStep[];
  locks: readonly PuzzleGraphLock[];
  puzzles: readonly PuzzleGraphPuzzle[];
  reachability: PuzzleGraphReachability;
  summary: readonly string[];
}

export function explainPuzzle(level: LevelDefinition): PuzzleGraphExplanation {
  const map = level.map;
  const startRoomId = map ? roomContaining(level.spawnPoint, map)?.id ?? map.navigation.criticalPathRoomIds[0] ?? map.rooms[0]?.id ?? null : null;
  const exitInteraction = map?.interactions.find((interaction) => interaction.type === "exit");
  const exitRoomId = map ? exitInteraction?.roomId ?? roomContaining(level.exit.position, map)?.id ?? null : null;
  const criticalPathRoomIds = map?.navigation.criticalPathRoomIds ?? [];
  const reachability = simulatePuzzleGraph(level, startRoomId);
  const locks = map?.doors
    .filter((door) => door.lock.type !== "none" || door.defaultState === "locked")
    .map((door) => describeLock(door, criticalPathRoomIds)) ?? [];
  const puzzles = level.puzzles?.map(describePuzzle) ?? [];
  const objectivePath = explainObjectivePath(level);
  const summary = [
    `Start room: ${startRoomId ?? "unknown"}`,
    `Exit room: ${exitRoomId ?? "unknown"}`,
    `Critical path: ${criticalPathRoomIds.length > 0 ? criticalPathRoomIds.join(" -> ") : "not configured"}`,
    `Locks: ${locks.length}`,
    `Puzzles: ${puzzles.map((puzzle) => puzzle.puzzleId).join(", ") || "none"}`,
    `Big screens: ${reachability.bigScreens.join(", ") || "none"}`,
    `Reachable rooms after graph simulation: ${reachability.rooms.join(", ") || "none"}`,
    `Exit unlocked by graph: ${reachability.exitUnlocked ? "yes" : "no"}`,
  ];

  return {
    levelId: level.id,
    title: level.title,
    startRoomId,
    exitRoomId,
    criticalPathRoomIds,
    objectivePath,
    locks,
    puzzles,
    reachability,
    summary,
  };
}

export function validatePuzzleGraph(
  level: LevelDefinition,
  graph: PuzzleGraphExplanation,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  const map = level.map;
  if (!map) return;

  const reachableRooms = new Set(graph.reachability.rooms);
  const reachableDoors = new Set(graph.reachability.doors);
  const reachablePuzzles = new Set(graph.reachability.puzzles);
  const reachableObjectives = new Set(graph.reachability.objectives);
  const exitInteraction = map.interactions.find((interaction) => interaction.type === "exit");

  if (graph.exitRoomId && !reachableRooms.has(graph.exitRoomId)) {
    add(errors, "graph.exit.unreachable.locked", "map", `Exit room "${graph.exitRoomId}" is not reachable after solving available key, interaction, and puzzle dependencies.`);
  }

  if (exitInteraction && graph.reachability.exitUnlocked && !graph.reachability.exitInteractionReady) {
    add(errors, "graph.exit.interaction.blocked", `map.interactions.${exitInteraction.id}`, `Exit interaction "${exitInteraction.id}" is still blocked after the graph unlocks the exit.`);
  }

  for (const softlock of graph.reachability.softlocks) {
    add(
      errors,
      "graph.softlock.terminal",
      "map",
      `Reachable player state can become terminal after "${softlock.afterStepId ?? "start"}" in rooms "${softlock.roomIds.join(", ")}": ${softlock.reason}`,
    );
  }

  for (const interaction of map.interactions) {
    if (!interaction.requiresObjectiveId) continue;
    const objective = level.objectiveChain?.find((candidate) => candidate.id === interaction.requiresObjectiveId);
    if (objective?.completesWhen.type === "interaction_completed" && objective.completesWhen.id === interaction.id) {
      add(errors, "graph.interaction.self_blocked", `map.interactions.${interaction.id}.requiresObjectiveId`, `Interaction "${interaction.id}" requires objective "${objective.id}", but that objective completes by using the same interaction.`);
    }
  }

  for (const lock of graph.locks) {
    if (!lock.blocksCriticalPath || reachableDoors.has(lock.doorId)) continue;
    add(errors, "graph.critical_door.blocked", `map.doors.${lock.doorId}`, `Critical-path door "${lock.doorId}" never becomes openable in the graph simulation.`);
  }

  for (const puzzle of graph.puzzles) {
    const gatesProgress = puzzle.unlocksExit || Boolean(puzzle.opensDoorId || puzzle.unlocksDoorId);
    if (gatesProgress && !reachablePuzzles.has(puzzle.puzzleId)) {
      add(errors, "graph.puzzle.unreachable", `puzzles.${puzzle.puzzleId}`, `Puzzle "${puzzle.puzzleId}" gates progress but cannot be solved from reachable rooms and prerequisites.`);
    }
  }

  const objectiveIdsInPath = new Set(graph.objectivePath.map((step) => step.objectiveId));
  const objectives = level.objectiveChain ?? [];
  for (const objective of objectives) {
    if (objective.hiddenUntilStarted) continue;
    if (!objectiveIdsInPath.has(objective.id)) {
      add(warnings, "graph.objective.not_on_main_path", `objectiveChain.${objective.id}`, `Objective "${objective.id}" is not reachable through nextObjectiveId from the level-start objective.`);
    }
    if (!reachableObjectives.has(objective.id) && objective.type !== "boss_dead" && objective.type !== "survive_wave") {
      add(warnings, "graph.objective.not_simulated", `objectiveChain.${objective.id}`, `Objective "${objective.id}" was not completed by the static graph simulation.`);
    }
  }
}

interface PuzzleGraphSimulationState {
  /** Current connected rooms from the player's present position after the latest action. */
  rooms: Set<string>;
  /** All rooms reached across the explored timeline; used for reports and critical-path coverage. */
  everRooms: Set<string>;
  /** Doors that are currently open in this timeline branch. */
  currentOpenDoorIds: Set<string>;
  /** Doors unlocked by one-shot actions; they may be opened later when reached. */
  unlockedDoorIds: Set<string>;
  /** Doors that became openable/open at least once; used for door_opened-style progress reporting. */
  doors: Set<string>;
  keyItems: Set<string>;
  interactions: Set<string>;
  puzzles: Set<string>;
  articles: Set<string>;
  quizzes: Set<string>;
  switches: Set<string>;
  activeSwitchStates: Map<string, string>;
  bigScreens: Set<string>;
  objectives: Set<string>;
  waves: Set<string>;
  events: Set<string>;
  hitSequenceProgress: Map<string, number>;
  actionPath: PuzzleGraphPlanStep[];
  exitUnlocked: boolean;
}

function simulatePuzzleGraph(level: LevelDefinition, startRoomId: string | null): PuzzleGraphReachability {
  const map = level.map;
  const initialOpenDoorIds = new Set(map?.doors.filter((door) => door.defaultState === "open").map((door) => door.id) ?? []);
  const initial: PuzzleGraphSimulationState = {
    rooms: new Set(startRoomId ? [startRoomId] : []),
    everRooms: new Set(startRoomId ? [startRoomId] : []),
    currentOpenDoorIds: new Set(initialOpenDoorIds),
    unlockedDoorIds: new Set(),
    doors: new Set(initialOpenDoorIds),
    keyItems: new Set(),
    interactions: new Set(),
    puzzles: new Set(),
    articles: new Set(),
    quizzes: new Set(),
    switches: new Set(),
    activeSwitchStates: initialSwitchStates(level),
    bigScreens: new Set(),
    objectives: new Set(),
    waves: new Set(),
    events: new Set(),
    hitSequenceProgress: new Map(),
    actionPath: startRoomId ? [{ kind: "room", id: startRoomId, roomId: startRoomId, label: `进入 ${startRoomId}` }] : [],
    exitUnlocked: false,
  };
  if (!map) {
    return toReachabilityReport(initial, false, [], []);
  }

  const aggregate = cloneGraphState(initial);
  const queue: PuzzleGraphSimulationState[] = [initial];
  const seen = new Set<string>();
  const softlocks = new Map<string, PuzzleGraphSoftlock>();
  let solutionPath: PuzzleGraphPlanStep[] = [];
  let exitInteractionReady = false;
  let guard = 0;

  while (queue.length > 0 && guard < 1200) {
    guard += 1;
    const state = queue.shift()!;
    closeDeterministicGraphState(level, map, state);
    mergeGraphState(aggregate, state);
    const currentExitReady = graphExitReady(level, map, state);
    if (currentExitReady && solutionPath.length === 0) {
      solutionPath = state.actionPath;
    }
    exitInteractionReady = exitInteractionReady || currentExitReady;
    const signature = graphStateSignature(state);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const transitions = switchTransitions(level, map, state);
    if (!currentExitReady && transitions.length === 0) {
      const softlock = describeSoftlock(state);
      softlocks.set(`${softlock.roomIds.join(",")}|${softlock.afterStepId ?? ""}`, softlock);
    }
    for (const next of transitions) {
      const nextSignature = graphStateSignature(next);
      if (!seen.has(nextSignature)) queue.push(next);
    }
  }

  return toReachabilityReport(aggregate, exitInteractionReady, solutionPath, [...softlocks.values()]);
}

function initialSwitchStates(level: LevelDefinition) {
  const states = new Map<string, string>();
  for (const definition of level.switches ?? []) {
    const stateId = definition.initialStateId ?? definition.states[0]?.id;
    if (stateId) states.set(definition.id, stateId);
  }
  return states;
}

function closeDeterministicGraphState(level: LevelDefinition, map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = true;
  let guard = 0;
  while (changed && guard < 80) {
    guard += 1;
    changed = false;
    changed = applyReachableDoors(map, state) || changed;
    changed = collectReachableKeys(map, state) || changed;
    changed = completeReachableRuntimeEvents(level, map, state) || changed;
    changed = completeReachableInteractions(map, state) || changed;
    changed = completeReachableArticles(level, state) || changed;
    changed = completeReachableQuizzes(level, map, state) || changed;
    changed = completeReachableBigScreens(level, map, state) || changed;
    changed = advanceReachableHitSequences(level, map, state) || changed;
    changed = completeReachablePuzzles(level, map, state) || changed;
    changed = completeReachableWaves(level, state) || changed;
    changed = completeReachableObjectives(level, state) || changed;
  }
}

function graphExitReady(level: LevelDefinition, map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  const exitInteraction = map.interactions.find((interaction) => interaction.type === "exit");
  return Boolean(
    exitInteraction &&
    state.rooms.has(exitInteraction.roomId) &&
    interactionPrerequisitesMet(exitInteraction, state) &&
    state.exitUnlocked,
  );
}

function switchTransitions(level: LevelDefinition, map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  const transitions: PuzzleGraphSimulationState[] = [];
  for (const definition of level.switches ?? []) {
    if (!state.rooms.has(definition.roomId)) continue;
    if (!state.interactions.has(definition.interactionId)) continue;
    if (definition.oneShot && state.switches.has(definition.id)) continue;
    const targetState = nextSwitchStateInGraph(definition, state);
    if (!targetState) continue;
    if (!switchStateKeyRequirementMetInGraph(targetState, state)) continue;
    const next = cloneGraphState(state);
    const stateKey = switchStateKey(definition.id, targetState.id);
    next.activeSwitchStates.set(definition.id, targetState.id);
    next.switches.add(definition.id);
    next.switches.add(stateKey);
    appendGraphStep(next, { kind: "switch", id: stateKey, roomId: definition.roomId, label: targetState.label ?? targetState.id, detail: definition.label });
    for (const action of targetState.actions) {
      applyRuntimeActionToGraph(action, next, map);
    }
    recomputeCurrentRoomsFrom(map, next, definition.roomId);
    transitions.push(next);
  }
  return transitions;
}

function cloneGraphState(state: PuzzleGraphSimulationState): PuzzleGraphSimulationState {
  return {
    rooms: new Set(state.rooms),
    everRooms: new Set(state.everRooms),
    currentOpenDoorIds: new Set(state.currentOpenDoorIds),
    unlockedDoorIds: new Set(state.unlockedDoorIds),
    doors: new Set(state.doors),
    keyItems: new Set(state.keyItems),
    interactions: new Set(state.interactions),
    puzzles: new Set(state.puzzles),
    articles: new Set(state.articles),
    quizzes: new Set(state.quizzes),
    switches: new Set(state.switches),
    activeSwitchStates: new Map(state.activeSwitchStates),
    bigScreens: new Set(state.bigScreens),
    objectives: new Set(state.objectives),
    waves: new Set(state.waves),
    events: new Set(state.events),
    hitSequenceProgress: new Map(state.hitSequenceProgress),
    actionPath: [...state.actionPath],
    exitUnlocked: state.exitUnlocked,
  };
}

function mergeGraphState(target: PuzzleGraphSimulationState, source: PuzzleGraphSimulationState) {
  source.rooms.forEach((id) => target.rooms.add(id));
  source.everRooms.forEach((id) => target.everRooms.add(id));
  source.currentOpenDoorIds.forEach((id) => target.currentOpenDoorIds.add(id));
  source.unlockedDoorIds.forEach((id) => target.unlockedDoorIds.add(id));
  source.doors.forEach((id) => target.doors.add(id));
  source.keyItems.forEach((id) => target.keyItems.add(id));
  source.interactions.forEach((id) => target.interactions.add(id));
  source.puzzles.forEach((id) => target.puzzles.add(id));
  source.articles.forEach((id) => target.articles.add(id));
  source.quizzes.forEach((id) => target.quizzes.add(id));
  source.switches.forEach((id) => target.switches.add(id));
  source.bigScreens.forEach((id) => target.bigScreens.add(id));
  source.objectives.forEach((id) => target.objectives.add(id));
  source.waves.forEach((id) => target.waves.add(id));
  source.events.forEach((id) => target.events.add(id));
  for (const [puzzleId, progress] of source.hitSequenceProgress.entries()) {
    target.hitSequenceProgress.set(puzzleId, Math.max(target.hitSequenceProgress.get(puzzleId) ?? 0, progress));
  }
  if (source.exitUnlocked) target.exitUnlocked = true;
}

function graphStateSignature(state: PuzzleGraphSimulationState) {
  const parts = [
    [...state.rooms].sort().join(","),
    [...state.everRooms].sort().join(","),
    [...state.currentOpenDoorIds].sort().join(","),
    [...state.unlockedDoorIds].sort().join(","),
    [...state.doors].sort().join(","),
    [...state.keyItems].sort().join(","),
    [...state.interactions].sort().join(","),
    [...state.articles].sort().join(","),
    [...state.quizzes].sort().join(","),
    [...state.switches].sort().join(","),
    [...state.bigScreens].sort().join(","),
    [...state.puzzles].sort().join(","),
    [...state.objectives].sort().join(","),
    [...state.waves].sort().join(","),
    [...state.events].sort().join(","),
    [...state.hitSequenceProgress.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([id, progress]) => `${id}:${progress}`).join(","),
    [...state.activeSwitchStates.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([id, stateId]) => `${id}:${stateId}`).join(","),
    state.exitUnlocked ? "exit" : "",
  ];
  return parts.join("|");
}

function applyReachableDoors(map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const door of map.doors) {
    const touchesReachableRoom = state.rooms.has(door.fromRoomId) || state.rooms.has(door.toRoomId);
    if (!touchesReachableRoom || !doorOpenableInGraph(door, state)) continue;
    if (!state.currentOpenDoorIds.has(door.id)) {
      state.currentOpenDoorIds.add(door.id);
      changed = true;
    }
    if (!state.doors.has(door.id)) {
      state.doors.add(door.id);
      changed = true;
    }
    if (!state.rooms.has(door.fromRoomId)) {
      state.rooms.add(door.fromRoomId);
      state.everRooms.add(door.fromRoomId);
      appendGraphStep(state, { kind: "room", id: door.fromRoomId, roomId: door.fromRoomId, label: `进入 ${door.fromRoomId}`, detail: `经由 ${door.label}` });
      changed = true;
    }
    if (!state.rooms.has(door.toRoomId)) {
      state.rooms.add(door.toRoomId);
      state.everRooms.add(door.toRoomId);
      appendGraphStep(state, { kind: "room", id: door.toRoomId, roomId: door.toRoomId, label: `进入 ${door.toRoomId}`, detail: `经由 ${door.label}` });
      changed = true;
    }
  }
  return changed;
}

function recomputeCurrentRoomsFrom(map: LevelMapConfig, state: PuzzleGraphSimulationState, originRoomId: string) {
  if (!map.rooms.some((room) => room.id === originRoomId)) return;
  state.rooms = new Set([originRoomId]);
  state.everRooms.add(originRoomId);
  let changed = true;
  let guard = 0;
  while (changed && guard < 80) {
    guard += 1;
    changed = applyReachableDoors(map, state);
  }
}

function collectReachableKeys(map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const item of map.keyItems) {
    if (!state.rooms.has(item.roomId) || state.keyItems.has(item.id)) continue;
    if (item.requiresObjectiveId && !state.objectives.has(item.requiresObjectiveId)) continue;
    state.keyItems.add(item.id);
    appendGraphStep(state, { kind: "key", id: item.id, roomId: item.roomId, label: item.label });
    changed = true;
  }
  return changed;
}

function completeReachableRuntimeEvents(level: LevelDefinition, map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const event of level.events ?? []) {
    if (state.events.has(event.id)) continue;
    if (!eventAchieved(event.trigger, state)) continue;
    state.events.add(event.id);
    appendGraphStep(state, { kind: "event", id: event.id, label: event.id, detail: formatTrigger(event.trigger) });
    changed = true;
    let changedDoorState = false;
    for (const action of event.actions ?? []) {
      changed = applyRuntimeActionToGraph(action, state, map) || changed;
      changedDoorState = changedDoorState || actionChangesDoorState(action);
    }
    if (changedDoorState) {
      const originRoomId = event.trigger.type === "room_entered" && event.trigger.id ? event.trigger.id : [...state.rooms][0];
      if (originRoomId) recomputeCurrentRoomsFrom(map, state, originRoomId);
    }
  }
  return changed;
}

function completeReachableInteractions(map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const interaction of map.interactions) {
    if (state.interactions.has(interaction.id)) continue;
    if (!state.rooms.has(interaction.roomId)) continue;
    if (!interactionPrerequisitesMet(interaction, state)) continue;
    if (interaction.type === "exit" && !state.exitUnlocked) continue;
    state.interactions.add(interaction.id);
    appendGraphStep(state, {
      kind: interaction.type === "exit" ? "exit" : "interaction",
      id: interaction.id,
      roomId: interaction.roomId,
      label: interaction.label ?? interaction.id,
      detail: interaction.type,
    });
    changed = true;
    if (interaction.grantsKeyItemId && !state.keyItems.has(interaction.grantsKeyItemId)) {
      state.keyItems.add(interaction.grantsKeyItemId);
      changed = true;
    }
    if (interaction.opensDoorId) {
      changed = openDoorInGraph(state, interaction.opensDoorId) || changed;
    }
  }
  return changed;
}

function completeReachableArticles(level: LevelDefinition, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const article of level.articles ?? []) {
    if (state.articles.has(article.id)) continue;
    if (!state.rooms.has(article.roomId)) continue;
    if (!state.interactions.has(article.interactionId)) continue;
    state.articles.add(article.id);
    appendGraphStep(state, { kind: "article", id: article.id, roomId: article.roomId, label: article.title });
    changed = true;
  }
  return changed;
}

function completeReachableQuizzes(level: LevelDefinition, map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const quiz of level.quizzes ?? []) {
    if (state.quizzes.has(quiz.id)) continue;
    if (!state.rooms.has(quiz.roomId)) continue;
    if (!state.interactions.has(quiz.interactionId)) continue;
    if (quiz.articleId && !state.articles.has(quiz.articleId)) continue;
    state.quizzes.add(quiz.id);
    appendGraphStep(state, { kind: "quiz", id: quiz.id, roomId: quiz.roomId, label: quiz.title });
    changed = true;
    for (const action of quiz.correctAnswer.actions ?? []) {
      changed = applyRuntimeActionToGraph(action, state, map) || changed;
    }
    if ((quiz.correctAnswer.actions ?? []).some(actionChangesDoorState)) {
      recomputeCurrentRoomsFrom(map, state, quiz.roomId);
    }
  }
  return changed;
}

function completeReachableSwitches(level: LevelDefinition, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const definition of level.switches ?? []) {
    if (!state.rooms.has(definition.roomId)) continue;
    if (!state.interactions.has(definition.interactionId)) continue;
    const targetState = nextSwitchStateInGraph(definition, state);
    if (!targetState) continue;
    if (!switchStateKeyRequirementMetInGraph(targetState, state)) continue;
    const stateKey = switchStateKey(definition.id, targetState.id);
    if (state.switches.has(stateKey)) continue;
    state.switches.add(definition.id);
    state.switches.add(stateKey);
    appendGraphStep(state, { kind: "switch", id: stateKey, roomId: definition.roomId, label: targetState.label ?? targetState.id, detail: definition.label });
    changed = true;
    for (const action of targetState.actions) {
      changed = applyRuntimeActionToGraph(action, state) || changed;
    }
  }
  return changed;
}

function nextSwitchStateInGraph(
  definition: NonNullable<LevelDefinition["switches"]>[number],
  state: PuzzleGraphSimulationState,
) {
  if (definition.states.length === 0) return null;
  if (definition.states.length === 1) return definition.states[0];
  const activeStateIds = [...state.switches]
    .filter((id) => id.startsWith(`${definition.id}:`))
    .map((id) => id.slice(definition.id.length + 1));
  const activeStateId = state.activeSwitchStates.get(definition.id) ?? activeStateIds[activeStateIds.length - 1] ?? definition.initialStateId ?? definition.states[0]?.id;
  const currentIndex = definition.states.findIndex((candidate) => candidate.id === activeStateId);
  if (definition.cycling?.wrap === false && currentIndex >= definition.states.length - 1) {
    return definition.states[currentIndex] ?? definition.states[definition.states.length - 1] ?? null;
  }
  return definition.states[currentIndex >= 0 ? (currentIndex + 1) % definition.states.length : 0] ?? definition.states[0] ?? null;
}

function switchStateKeyRequirementMetInGraph(
  stateDefinition: NonNullable<LevelDefinition["switches"]>[number]["states"][number],
  state: PuzzleGraphSimulationState,
) {
  return !stateDefinition.requiredKeyItemId || state.keyItems.has(stateDefinition.requiredKeyItemId);
}

function completeReachableBigScreens(level: LevelDefinition, map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const definition of level.bigScreens ?? []) {
    if (!state.rooms.has(definition.roomId)) continue;
    if (!state.interactions.has(definition.interactionId)) continue;
    const targetState =
      (definition.activationStateId ? definition.states.find((candidate) => candidate.id === definition.activationStateId) : null) ??
      nextBigScreenStateInGraph(definition, state);
    if (!targetState) continue;
    const stateKey = bigScreenStateKey(definition.id, targetState.id);
    if (state.bigScreens.has(stateKey)) continue;
    state.bigScreens.add(definition.id);
    state.bigScreens.add(stateKey);
    appendGraphStep(state, { kind: "big_screen", id: stateKey, roomId: definition.roomId, label: targetState.label ?? targetState.id, detail: definition.label });
    changed = true;
    for (const action of targetState.actions ?? []) {
      changed = applyRuntimeActionToGraph(action, state, map) || changed;
    }
    if ((targetState.actions ?? []).some(actionChangesDoorState)) {
      recomputeCurrentRoomsFrom(map, state, definition.roomId);
    }
  }
  return changed;
}

function nextBigScreenStateInGraph(
  definition: NonNullable<LevelDefinition["bigScreens"]>[number],
  state: PuzzleGraphSimulationState,
) {
  if (definition.states.length === 0) return null;
  if (definition.states.length === 1) return definition.states[0];
  const activeStateIds = [...state.bigScreens]
    .filter((id) => id.startsWith(`${definition.id}:`))
    .map((id) => id.slice(definition.id.length + 1));
  const activeStateId = activeStateIds[activeStateIds.length - 1] ?? definition.initialStateId ?? definition.states[0]?.id;
  const currentIndex = definition.states.findIndex((candidate) => candidate.id === activeStateId);
  return definition.states[currentIndex >= 0 ? (currentIndex + 1) % definition.states.length : 0] ?? definition.states[0] ?? null;
}

function completeReachablePuzzles(level: LevelDefinition, map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const puzzle of level.puzzles ?? []) {
    if (puzzle.type === "hit_sequence") continue;
    if (state.puzzles.has(puzzle.id) || !puzzleSolvableInGraph(puzzle, state)) continue;
    state.puzzles.add(puzzle.id);
    appendGraphStep(state, { kind: "puzzle", id: puzzle.id, roomId: puzzle.roomId, label: puzzle.label });
    changed = true;
    changed = applyPuzzleSuccessToGraph(puzzle, state, map) || changed;
  }
  return changed;
}

function advanceReachableHitSequences(level: LevelDefinition, map: LevelMapConfig, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const puzzle of level.puzzles ?? []) {
    if (puzzle.type !== "hit_sequence" || state.puzzles.has(puzzle.id)) continue;
    if (!hitSequenceClueReadyInGraph(puzzle, state)) continue;
    let progress = state.hitSequenceProgress.get(puzzle.id) ?? 0;
    while (progress < puzzle.targets.length) {
      const target = puzzle.targets[progress];
      if (!target || !state.rooms.has(target.roomId)) break;
      progress += 1;
      state.hitSequenceProgress.set(puzzle.id, progress);
      appendGraphStep(state, { kind: "target", id: target.id, roomId: target.roomId, label: target.label, detail: puzzle.label });
      changed = true;
      if (progress >= puzzle.targets.length) {
        state.puzzles.add(puzzle.id);
        appendGraphStep(state, { kind: "puzzle", id: puzzle.id, roomId: target.roomId, label: puzzle.label });
        changed = true;
        changed = applyPuzzleSuccessToGraph(puzzle, state, map, target.roomId) || changed;
        break;
      }
    }
  }
  return changed;
}

function applyPuzzleSuccessToGraph(
  puzzle: LevelPuzzleDefinition,
  state: PuzzleGraphSimulationState,
  map: LevelMapConfig,
  originRoomId = puzzle.roomId,
) {
  let changed = false;
  if (puzzle.success.opensDoorId) {
    changed = openDoorInGraph(state, puzzle.success.opensDoorId) || changed;
  }
  if (puzzle.success.unlocksDoorId) {
    changed = unlockDoorInGraph(state, puzzle.success.unlocksDoorId) || changed;
  }
  if (puzzle.success.completesObjectiveId && !state.objectives.has(puzzle.success.completesObjectiveId)) {
    state.objectives.add(puzzle.success.completesObjectiveId);
    changed = true;
  }
  if (puzzle.success.unlockExit && !state.exitUnlocked) {
    state.exitUnlocked = true;
    changed = true;
  }
  for (const action of puzzle.success.actions ?? []) {
    changed = applyRuntimeActionToGraph(action, state, map) || changed;
  }
  if ((puzzle.success.actions ?? []).some(actionChangesDoorState) || puzzle.success.opensDoorId || puzzle.success.unlocksDoorId) {
    recomputeCurrentRoomsFrom(map, state, originRoomId);
  }
  return changed;
}

function applyRuntimeActionToGraph(action: LevelRuntimeEventAction, state: PuzzleGraphSimulationState, map?: LevelMapConfig) {
  switch (action.type) {
    case "open_door": {
      const door = map?.doors.find((candidate) => candidate.id === action.doorId);
      if (action.respectLock && door && !doorMechanismProgressionSatisfiedInGraph(door, state)) return false;
      return openDoorInGraph(state, action.doorId);
    }
    case "unlock_door":
      return unlockDoorInGraph(state, action.doorId);
    case "close_door": {
      const door = map?.doors.find((candidate) => candidate.id === action.doorId);
      if (action.respectLock && door && !doorMechanismProgressionSatisfiedInGraph(door, state)) return false;
      return closeDoorInGraph(state, action.doorId, false);
    }
    case "lock_door": {
      const door = map?.doors.find((candidate) => candidate.id === action.doorId);
      if (action.respectLock && door && !doorMechanismProgressionSatisfiedInGraph(door, state)) return false;
      return closeDoorInGraph(state, action.doorId, true);
    }
    case "grant_key_item":
      if (state.keyItems.has(action.keyItemId)) return false;
      state.keyItems.add(action.keyItemId);
      appendGraphStep(state, { kind: "key", id: action.keyItemId, label: action.keyItemId });
      return true;
    case "start_wave":
      if (state.waves.has(action.waveId)) return false;
      state.waves.add(action.waveId);
      appendGraphStep(state, { kind: "wave", id: action.waveId, label: action.waveId });
      return true;
    case "set_big_screen_state": {
      const stateKey = bigScreenStateKey(action.screenId, action.stateId);
      if (state.bigScreens.has(stateKey)) return false;
      state.bigScreens.add(action.screenId);
      state.bigScreens.add(stateKey);
      appendGraphStep(state, { kind: "big_screen", id: stateKey, label: stateKey });
      return true;
    }
    case "complete_objective":
      if (state.objectives.has(action.objectiveId)) return false;
      state.objectives.add(action.objectiveId);
      appendGraphStep(state, { kind: "objective", id: action.objectiveId, label: action.objectiveId });
      return true;
    case "unlock_exit":
      if (state.exitUnlocked) return false;
      state.exitUnlocked = true;
      return true;
    default:
      return false;
  }
}

function actionChangesDoorState(action: LevelRuntimeEventAction) {
  return action.type === "open_door" || action.type === "unlock_door" || action.type === "close_door" || action.type === "lock_door";
}

function openDoorInGraph(state: PuzzleGraphSimulationState, doorId: string) {
  const wasOpen = state.currentOpenDoorIds.has(doorId);
  const wasRecorded = state.doors.has(doorId);
  state.currentOpenDoorIds.add(doorId);
  state.doors.add(doorId);
  return !wasOpen || !wasRecorded;
}

function unlockDoorInGraph(state: PuzzleGraphSimulationState, doorId: string) {
  if (state.unlockedDoorIds.has(doorId)) return false;
  state.unlockedDoorIds.add(doorId);
  return true;
}

function closeDoorInGraph(state: PuzzleGraphSimulationState, doorId: string, lockDoor: boolean) {
  const wasOpen = state.currentOpenDoorIds.delete(doorId);
  const wasUnlocked = lockDoor ? state.unlockedDoorIds.delete(doorId) : false;
  return wasOpen || wasUnlocked;
}

function completeReachableWaves(level: LevelDefinition, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const wave of level.waves) {
    if (state.waves.has(wave.id)) continue;
    if (wave.trigger && !eventAchieved(wave.trigger, state)) continue;
    state.waves.add(wave.id);
    appendGraphStep(state, { kind: "wave", id: wave.id, label: wave.id });
    changed = true;
    if (wave.reward === "open_exit" && !state.exitUnlocked) {
      state.exitUnlocked = true;
      changed = true;
    }
  }
  return changed;
}

function completeReachableObjectives(level: LevelDefinition, state: PuzzleGraphSimulationState) {
  let changed = false;
  for (const objective of level.objectiveChain ?? []) {
    if (state.objectives.has(objective.id)) continue;
    if (!eventAchieved(objective.startsWhen, state) || !eventAchieved(objective.completesWhen, state)) continue;
    state.objectives.add(objective.id);
    appendGraphStep(state, { kind: "objective", id: objective.id, label: objective.title });
    changed = true;
  }
  return changed;
}

function doorLockWaveIds(door: LevelDoorDefinition) {
  const ids = [...(door.lock.waveIds ?? []), ...(door.lock.waveId ? [door.lock.waveId] : [])];
  return [...new Set(ids.filter(Boolean))];
}

function doorLockPuzzleIds(door: LevelDoorDefinition) {
  const ids = [...(door.lock.puzzleIds ?? []), ...(door.lock.puzzleId ? [door.lock.puzzleId] : [])];
  return [...new Set(ids.filter(Boolean))];
}

function doorOpenableInGraph(door: LevelDoorDefinition, state: PuzzleGraphSimulationState) {
  if (state.currentOpenDoorIds.has(door.id)) return true;
  return doorProgressionSatisfiedInGraph(door, state);
}

function doorProgressionSatisfiedInGraph(door: LevelDoorDefinition, state: PuzzleGraphSimulationState) {
  if (state.unlockedDoorIds.has(door.id)) return true;
  if (door.lock.type === "none") return true;
  if (door.lock.type === "key_item") return Boolean(door.lock.keyItemId && state.keyItems.has(door.lock.keyItemId));
  if (door.lock.type === "objective_complete") return Boolean(door.lock.objectiveId && state.objectives.has(door.lock.objectiveId));
  if (door.lock.type === "survive_wave") {
    const requiredWaveIds = doorLockWaveIds(door);
    return requiredWaveIds.length > 0 && requiredWaveIds.every((id) => state.waves.has(id));
  }
  if (door.lock.type === "puzzle_complete") {
    const requiredPuzzleIds = doorLockPuzzleIds(door);
    const puzzleReady = requiredPuzzleIds.length > 0 && requiredPuzzleIds.every((puzzleId) => state.puzzles.has(puzzleId));
    const keyReady = !door.lock.keyItemId || state.keyItems.has(door.lock.keyItemId);
    return puzzleReady && keyReady;
  }
  if (door.lock.type === "switch_state") {
    if (door.lock.manualOpen === false) return false;
    return Boolean(door.lock.switchId && door.lock.stateId && state.activeSwitchStates.get(door.lock.switchId) === door.lock.stateId);
  }
  if (door.lock.type === "inventory_count") {
    return state.keyItems.size >= (door.lock.requiredCount ?? 1);
  }
  return false;
}

function doorMechanismProgressionSatisfiedInGraph(door: LevelDoorDefinition, state: PuzzleGraphSimulationState) {
  if (door.lock.type === "switch_state") {
    return Boolean(door.lock.switchId && door.lock.stateId && state.activeSwitchStates.get(door.lock.switchId) === door.lock.stateId);
  }
  return doorProgressionSatisfiedInGraph(door, state);
}

function interactionPrerequisitesMet(
  interaction: NonNullable<LevelMapConfig["interactions"][number]>,
  state: PuzzleGraphSimulationState,
) {
  if (interaction.requiresObjectiveId && !state.objectives.has(interaction.requiresObjectiveId)) return false;
  if ((interaction.requiresArticleIds ?? []).some((articleId) => !state.articles.has(articleId))) return false;
  if (interaction.requiresSwitchState && !switchStateRequirementMetInGraph(interaction.requiresSwitchState, state)) return false;
  if (interaction.consumesKeyItemId && !state.keyItems.has(interaction.consumesKeyItemId)) return false;
  return true;
}

function switchStateRequirementMetInGraph(
  requirement: { switchId: string; stateId: string },
  state: PuzzleGraphSimulationState,
) {
  if (state.activeSwitchStates.get(requirement.switchId) === requirement.stateId) return true;
  return state.switches.has(switchStateKey(requirement.switchId, requirement.stateId));
}

function puzzleSolvableInGraph(puzzle: LevelPuzzleDefinition, state: PuzzleGraphSimulationState) {
  if (!state.rooms.has(puzzle.roomId)) return false;
  if (puzzle.type === "hit_sequence") {
    const clueReady = hitSequenceClueReadyInGraph(puzzle, state);
    const targetsReady = puzzle.targets.every((target) => state.rooms.has(target.roomId));
    return clueReady && targetsReady;
  }

  if (puzzle.type === "code_lock") {
    const keyReady = !puzzle.requiredKeyItemId || state.keyItems.has(puzzle.requiredKeyItemId);
    const interactionReady = state.interactions.has(puzzle.interactionId);
    const cluesReady = puzzle.clues.every((clue) => state.rooms.has(clue.roomId));
    return keyReady && interactionReady && cluesReady;
  }

  return state.interactions.has(puzzle.interactionId);
}

function hitSequenceClueReadyInGraph(puzzle: Extract<LevelPuzzleDefinition, { type: "hit_sequence" }>, state: PuzzleGraphSimulationState) {
  const clueRoomIds = [
    ...(puzzle.clue.roomId ? [puzzle.clue.roomId] : []),
    ...(puzzle.clue.surfaces?.map((surface) => surface.roomId) ?? []),
  ];
  const clueRoomsVisited = clueRoomIds.every((roomId) => state.everRooms.has(roomId));
  const clueInteractionReady = !puzzle.clue.interactionId || state.interactions.has(puzzle.clue.interactionId);
  return clueRoomsVisited && clueInteractionReady;
}

function eventAchieved(trigger: LevelEventTriggerDefinition, state: PuzzleGraphSimulationState) {
  if (trigger.type === "level_start") return true;
  if (trigger.type === "exit_unlocked") return state.exitUnlocked;
  if (!trigger.id) return true;
  if (trigger.type === "room_entered") return state.everRooms.has(trigger.id);
  if (trigger.type === "interaction_completed") return state.interactions.has(trigger.id);
  if (trigger.type === "key_collected") return state.keyItems.has(trigger.id);
  if (trigger.type === "door_opened") return state.doors.has(trigger.id);
  if (trigger.type === "wave_completed") return state.waves.has(trigger.id);
  if (trigger.type === "objective_completed") return state.objectives.has(trigger.id);
  if (trigger.type === "puzzle_completed" || trigger.type === "puzzle_failed") return state.puzzles.has(trigger.id);
  if (trigger.type === "article_read") return state.articles.has(trigger.id);
  if (trigger.type === "quiz_completed" || trigger.type === "quiz_failed") return state.quizzes.has(trigger.id);
  if (trigger.type === "switch_activated") {
    return trigger.optionId ? state.switches.has(switchStateKey(trigger.id, trigger.optionId)) : state.switches.has(trigger.id);
  }
  if (trigger.type === "big_screen_state") {
    return trigger.optionId ? state.bigScreens.has(bigScreenStateKey(trigger.id, trigger.optionId)) : state.bigScreens.has(trigger.id);
  }
  return false;
}

function appendGraphStep(state: PuzzleGraphSimulationState, step: PuzzleGraphPlanStep) {
  if (state.actionPath.some((candidate) => candidate.kind === step.kind && candidate.id === step.id)) return;
  state.actionPath.push(step);
}

function describeSoftlock(state: PuzzleGraphSimulationState): PuzzleGraphSoftlock {
  const lastStep = state.actionPath[state.actionPath.length - 1] ?? null;
  return {
    roomIds: [...state.rooms].sort(),
    afterStepId: lastStep?.id ?? null,
    reason: "当前玩家状态没有可继续推进的交互、门控、谜题或可用出口。",
    path: state.actionPath,
  };
}

function toReachabilityReport(
  state: PuzzleGraphSimulationState,
  exitInteractionReady: boolean,
  solutionPath: readonly PuzzleGraphPlanStep[],
  softlocks: readonly PuzzleGraphSoftlock[],
): PuzzleGraphReachability {
  return {
    rooms: [...state.everRooms].sort(),
    doors: [...state.doors].sort(),
    keyItems: [...state.keyItems].sort(),
    interactions: [...state.interactions].sort(),
    puzzles: [...state.puzzles].sort(),
    articles: [...state.articles].sort(),
    quizzes: [...state.quizzes].sort(),
    switches: [...state.switches].sort(),
    bigScreens: [...state.bigScreens].sort(),
    objectives: [...state.objectives].sort(),
    waves: [...state.waves].sort(),
    exitUnlocked: state.exitUnlocked,
    exitInteractionReady,
    solutionPath,
    softlocks,
  };
}

function describeLock(door: LevelDoorDefinition, criticalPathRoomIds: readonly string[]): PuzzleGraphLock {
  const requires: string[] = [];
  if (door.lock.keyItemId) requires.push(`key:${door.lock.keyItemId}`);
  if (door.lock.objectiveId) requires.push(`objective:${door.lock.objectiveId}`);
  for (const waveId of doorLockWaveIds(door)) requires.push(`wave:${waveId}`);
  if (door.lock.actorId) requires.push(`actor:${door.lock.actorId}`);
  for (const puzzleId of doorLockPuzzleIds(door)) requires.push(`puzzle:${puzzleId}`);
  if (door.lock.requiredCount) requires.push(`count:${door.lock.requiredCount}`);

  const fromIndex = criticalPathRoomIds.indexOf(door.fromRoomId);
  const toIndex = criticalPathRoomIds.indexOf(door.toRoomId);
  const blocksCriticalPath = fromIndex >= 0 && toIndex >= 0 && Math.abs(fromIndex - toIndex) === 1;
  return {
    doorId: door.id,
    label: door.label,
    fromRoomId: door.fromRoomId,
    toRoomId: door.toRoomId,
    lockType: door.lock.type,
    requires,
    blocksCriticalPath,
  };
}

function describePuzzle(puzzle: LevelPuzzleDefinition): PuzzleGraphPuzzle {
  if (puzzle.type === "hit_sequence") {
    const clueSurfaces = puzzle.clue.surfaces?.map((surface) => `clueSurface:${surface.surface}@${surface.roomId}`) ?? [];
    return {
      puzzleId: puzzle.id,
      type: puzzle.type,
      label: puzzle.label,
      roomId: puzzle.roomId,
      clue: puzzle.clue.roomEnterDetail ?? puzzle.clue.label ?? `${puzzle.clue.type}:${puzzle.clue.sequence.join(" -> ")}`,
      expectedInput: puzzle.clue.sequence.join(" -> "),
      opensDoorId: puzzle.success.opensDoorId,
      unlocksDoorId: puzzle.success.unlocksDoorId,
      unlocksExit: Boolean(puzzle.success.unlockExit),
      requires: [
        ...(puzzle.clue.roomId ? [`clueRoom:${puzzle.clue.roomId}`] : []),
        ...(puzzle.clue.interactionId ? [`clueInteraction:${puzzle.clue.interactionId}`] : []),
        ...clueSurfaces,
        ...(puzzle.input.allowedWeapons?.map((weapon) => `weapon:${weapon}`) ?? []),
      ],
    };
  }

  if (puzzle.type === "tool_calibration") {
    return {
      puzzleId: puzzle.id,
      type: puzzle.type,
      label: puzzle.label,
      roomId: puzzle.roomId,
      clue: `route ${puzzle.columns}x${puzzle.rows}`,
      expectedInput: `${puzzle.entry.x}:${puzzle.entry.y} -> ${puzzle.targets.map((target) => `${target.x}:${target.y}`).join(", ")}`,
      opensDoorId: puzzle.success.opensDoorId,
      unlocksDoorId: puzzle.success.unlocksDoorId,
      unlocksExit: Boolean(puzzle.success.unlockExit),
      requires: [`interaction:${puzzle.interactionId}`],
    };
  }

  if (puzzle.type === "circuit_grid") {
    return {
      puzzleId: puzzle.id,
      type: puzzle.type,
      label: puzzle.label,
      roomId: puzzle.roomId,
      clue: `power ${puzzle.columns}x${puzzle.rows}`,
      expectedInput: `${puzzle.sources.map((port) => `${port.x}:${port.y}`).join("+")} -> ${puzzle.targets.map((port) => `${port.x}:${port.y}`).join(", ")}`,
      opensDoorId: puzzle.success.opensDoorId,
      unlocksDoorId: puzzle.success.unlocksDoorId,
      unlocksExit: Boolean(puzzle.success.unlockExit),
      requires: [`interaction:${puzzle.interactionId}`],
    };
  }

  if (puzzle.type === "surveillance_match") {
    return {
      puzzleId: puzzle.id,
      type: puzzle.type,
      label: puzzle.label,
      roomId: puzzle.roomId,
      clue: `match ${puzzle.channels.length} feeds`,
      expectedInput: puzzle.channels.map((channel) => `${channel.id}=${channel.answerOptionId}`).join(", "),
      opensDoorId: puzzle.success.opensDoorId,
      unlocksDoorId: puzzle.success.unlocksDoorId,
      unlocksExit: Boolean(puzzle.success.unlockExit),
      requires: [`interaction:${puzzle.interactionId}`],
    };
  }

  if (puzzle.type === "valve_matrix") {
    return {
      puzzleId: puzzle.id,
      type: puzzle.type,
      label: puzzle.label,
      roomId: puzzle.roomId,
      clue: `balance ${puzzle.gauges.length} gauges`,
      expectedInput: puzzle.valves.map((valve, valveIndex) => `${valve.id}=${puzzle.solution[valveIndex]}`).join(", "),
      opensDoorId: puzzle.success.opensDoorId,
      unlocksDoorId: puzzle.success.unlocksDoorId,
      unlocksExit: Boolean(puzzle.success.unlockExit),
      requires: [`interaction:${puzzle.interactionId}`],
    };
  }

  if (puzzle.type === "archive_merge") {
    return {
      puzzleId: puzzle.id,
      type: puzzle.type,
      label: puzzle.label,
      roomId: puzzle.roomId,
      clue: `merge to ${puzzle.targetValue}`,
      expectedInput: `${puzzle.gridSize}x${puzzle.gridSize} target ${puzzle.targetValue}`,
      opensDoorId: puzzle.success.opensDoorId,
      unlocksDoorId: puzzle.success.unlocksDoorId,
      unlocksExit: Boolean(puzzle.success.unlockExit),
      requires: [`interaction:${puzzle.interactionId}`],
    };
  }

  if (puzzle.type === "gallery_reading") {
    const perRun = Math.min(6, Math.max(3, puzzle.questionsPerRun ?? Math.min(puzzle.questions.length, 3)));
    return {
      puzzleId: puzzle.id,
      type: puzzle.type,
      label: puzzle.label,
      roomId: puzzle.roomId,
      clue: `read ${puzzle.paintings.length} paintings`,
      expectedInput: `answer ${puzzle.requiredCorrect ?? perRun}/${perRun} questions`,
      opensDoorId: puzzle.success.opensDoorId,
      unlocksDoorId: puzzle.success.unlocksDoorId,
      unlocksExit: Boolean(puzzle.success.unlockExit),
      requires: [`interaction:${puzzle.interactionId}`],
    };
  }

  return {
    puzzleId: puzzle.id,
    type: puzzle.type,
    label: puzzle.label,
    roomId: puzzle.roomId,
    clue: puzzle.code.directionOrder?.join(" -> ") ?? puzzle.code.source,
    expectedInput: expectedCodeForPuzzleConfig(puzzle),
    opensDoorId: puzzle.success.opensDoorId,
    unlocksDoorId: puzzle.success.unlocksDoorId,
    unlocksExit: Boolean(puzzle.success.unlockExit),
    requires: [
      `interaction:${puzzle.interactionId}`,
      ...(puzzle.requiredKeyItemId ? [`key:${puzzle.requiredKeyItemId}`] : []),
      ...puzzle.clues.map((clue) => `clue:${clue.direction}:${clue.value}@${clue.roomId}`),
    ],
  };
}

function explainObjectivePath(level: LevelDefinition): PuzzleGraphStep[] {
  const objectives = level.objectiveChain ?? [];
  if (objectives.length === 0) return [];

  const byId = new Map(objectives.map((objective) => [objective.id, objective]));
  let current: LevelObjectiveDefinition | undefined = objectives.find((objective) => objective.startsWhen.type === "level_start") ?? objectives[0];
  const seen = new Set<string>();
  const path: PuzzleGraphStep[] = [];

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push({
      objectiveId: current.id,
      title: current.title,
      startsWhen: formatTrigger(current.startsWhen),
      completesWhen: formatTrigger(current.completesWhen),
      requiredIds: current.requiredIds,
    });
    current = current.nextObjectiveId ? byId.get(current.nextObjectiveId) : undefined;
  }

  return path;
}

function expectedCodeForPuzzleConfig(puzzle: Extract<LevelPuzzleDefinition, { type: "code_lock" }>) {
  if (puzzle.code.source === "fixed") return (puzzle.code.value ?? "").slice(0, puzzle.input.length);
  if (puzzle.code.source === "formula") {
    const formula = puzzle.code.formula;
    return (formula?.answer ?? formula?.display ?? formula?.expression ?? "?").slice(0, Math.max(puzzle.input.length, 1));
  }
  return (puzzle.code.directionOrder ?? [])
    .map((direction) => puzzle.clues.find((clue) => clue.direction === direction)?.value ?? "?")
    .join("")
    .slice(0, puzzle.input.length);
}

function formatTrigger(trigger: LevelEventTriggerDefinition) {
  return trigger.id ? `${trigger.type}:${trigger.id}` : trigger.type;
}
