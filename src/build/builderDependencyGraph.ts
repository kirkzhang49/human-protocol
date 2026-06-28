import { propEntry } from "./BuilderAssetCatalog";
import { deriveAssetRoles } from "./builderAssetRoles";
import { builderDoorSelectedGuardIds } from "./BuilderDoorRelations";
import { puzzleInstances } from "./BuilderPuzzleCatalog";
import { robotDisplayPosition } from "./BuilderPlacementRules";
import type { BuilderDoor, BuilderProject } from "./BuilderTypes";
import { sharedEdge } from "./compileBuilderProjectToLevel";

/**
 * Builder-side semantic graph for the 3D/2D overlays: where the level-logic
 * entities live (exits, puzzles, locks, story clues, enemies) and the
 * key/puzzle/wave dependency that unlocks each locked door. Pure read of the
 * BuilderProject — re-implements the small geometry it needs (door positions via
 * `sharedEdge`) rather than importing the compiler's level output, so it never
 * couples to or changes official config compilation.
 */
export type SemanticMarkerKind = "exit" | "puzzle" | "lock" | "story" | "enemy";

export interface SemanticMarker {
  id: string;
  kind: SemanticMarkerKind;
  /** Plan-space position = world x/z. */
  x: number;
  z: number;
}

/** What unlocks a locked door: a key room, a puzzle, or surviving a wave. */
export type SemanticLinkRole = "key" | "puzzle" | "wave";

export interface SemanticLink {
  from: readonly [number, number];
  to: readonly [number, number];
  role: SemanticLinkRole;
}

export interface BuilderSemanticGraph {
  markers: SemanticMarker[];
  links: SemanticLink[];
}

/** Door world x/z via the shared room edge, with a center-midpoint fallback. */
function doorPosition(project: BuilderProject, door: BuilderDoor): [number, number] | null {
  const from = project.rooms.find((room) => room.id === door.fromRoomId);
  const to = project.rooms.find((room) => room.id === door.toRoomId);
  if (from && to) {
    const edge = sharedEdge(from, to);
    if (edge) return [edge.position[0], edge.position[2]];
    return [(from.center[0] + to.center[0]) / 2, (from.center[1] + to.center[1]) / 2];
  }
  const only = from ?? to;
  return only ? [only.center[0], only.center[1]] : null;
}

export function buildSemanticGraph(project: BuilderProject): BuilderSemanticGraph {
  const markers: SemanticMarker[] = [];
  const links: SemanticLink[] = [];
  const roomById = new Map(project.rooms.map((room) => [room.id, room]));
  const puzzles = puzzleInstances(project);

  const exitRoom = roomById.get(project.exitRoomId);
  if (exitRoom) markers.push({ id: `exit:${exitRoom.id}`, kind: "exit", x: exitRoom.center[0], z: exitRoom.center[1] });

  for (const puzzle of puzzles) {
    markers.push({ id: `puzzle:${puzzle.id}`, kind: "puzzle", x: puzzle.position[0], z: puzzle.position[1] });
  }

  for (const prop of project.props) {
    const entry = propEntry(prop.modelKey);
    const isStory = Boolean(prop.story) || (entry ? deriveAssetRoles(entry).includes("story") : false);
    if (isStory) markers.push({ id: `story:${prop.id}`, kind: "story", x: prop.position[0], z: prop.position[1] });
  }

  for (const robot of project.robots) {
    const placed = robotDisplayPosition(project, robot.id);
    if (placed) markers.push({ id: `enemy:${robot.id}`, kind: "enemy", x: placed.x, z: placed.z });
  }

  for (const door of project.doors) {
    if (door.lockType === "none") continue;
    const at = doorPosition(project, door);
    if (!at) continue;
    markers.push({ id: `lock:${door.id}`, kind: "lock", x: at[0], z: at[1] });

    if (door.lockType === "key_item" && door.keyRoomId) {
      const keyRoom = roomById.get(door.keyRoomId);
      if (keyRoom) links.push({ from: [keyRoom.center[0], keyRoom.center[1]], to: at, role: "key" });
    } else if (door.lockType === "puzzle_complete") {
      const puzzle = puzzles.find((candidate) => candidate.linkedDoorId === door.id);
      if (puzzle) links.push({ from: [puzzle.position[0], puzzle.position[1]], to: at, role: "puzzle" });
    } else if (door.lockType === "survive_wave") {
      const guardIds = builderDoorSelectedGuardIds(door, project.robots);
      if (guardIds.length > 0) {
        for (const guardId of guardIds) {
          const placed = robotDisplayPosition(project, guardId);
          if (placed) links.push({ from: [placed.x, placed.z], to: at, role: "wave" });
        }
      } else {
        const fromRoom = roomById.get(door.fromRoomId);
        if (fromRoom) links.push({ from: [fromRoom.center[0], fromRoom.center[1]], to: at, role: "wave" });
      }
    }
  }

  return { markers, links };
}
