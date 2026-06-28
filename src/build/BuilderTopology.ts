import type { BuilderProject } from "./BuilderTypes";
import { sharedEdge } from "./compileBuilderProjectToLevel";

export interface LockChainStep {
  id: string;
  glyph: string;
  label: string;
  color: string;
  kind: "spawn" | "room" | "key" | "wave" | "puzzle" | "exit";
}

export interface BuilderTopology {
  /** Spawn → exit room ids along the shortest valid path ([] when broken). */
  pathRoomIds: string[];
  /** Compiler-style chain readout: spawn, locks along the path, exit. */
  lockChain: LockChainStep[];
  /** 0..1 enemy pressure relative to path length. */
  pressure: number;
  exitReady: boolean;
}

const archetypeWeight: Record<string, number> = {
  repair_drone: 1,
  clamp_bot: 1.6,
  shield_tech: 2.1,
  custodian_elite: 4,
};

export function computeTopology(project: BuilderProject): BuilderTopology {
  const roomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const spawn = project.rooms[0];
  const exit = roomsById.get(project.exitRoomId);

  const validDoors = project.doors.filter((door) => {
    const a = roomsById.get(door.fromRoomId);
    const b = roomsById.get(door.toRoomId);
    return a && b && sharedEdge(a, b);
  });

  // BFS shortest path with door tracking.
  let pathRoomIds: string[] = [];
  let pathDoorIds: string[] = [];
  if (spawn && exit) {
    const queue = [{ roomId: spawn.id, path: [spawn.id], doors: [] as string[] }];
    const visited = new Set([spawn.id]);
    while (queue.length > 0) {
      const current = queue.shift() as (typeof queue)[number];
      if (current.roomId === exit.id) {
        pathRoomIds = current.path;
        pathDoorIds = current.doors;
        break;
      }
      for (const door of validDoors) {
        const next = door.fromRoomId === current.roomId ? door.toRoomId : door.toRoomId === current.roomId ? door.fromRoomId : null;
        if (!next || visited.has(next)) continue;
        visited.add(next);
        queue.push({ roomId: next, path: [...current.path, next], doors: [...current.doors, door.id] });
      }
    }
  }

  const lockChain: LockChainStep[] = [];
  if (spawn) lockChain.push({ id: "spawn", glyph: "◉", label: `出生 · ${spawn.label}`, color: "#7ff2ff", kind: "spawn" });
  for (const doorId of pathDoorIds) {
    const door = project.doors.find((candidate) => candidate.id === doorId);
    if (!door || door.lockType === "none") continue;
    if (door.lockType === "key_item") {
      lockChain.push({ id: doorId, glyph: "钥", label: "钥匙门禁", color: "#ffd24f", kind: "key" });
    } else if (door.lockType === "survive_wave") {
      lockChain.push({ id: doorId, glyph: "战", label: "清剿机器人", color: "#ff7a5c", kind: "wave" });
    } else {
      lockChain.push({ id: doorId, glyph: "谜", label: "颜色顺序谜题", color: "#b47aff", kind: "puzzle" });
    }
  }
  const exitReady = pathRoomIds.length > 0;
  if (exit) lockChain.push({ id: "exit", glyph: "▣", label: exitReady ? `出口 · ${exit.label}` : "出口未连通", color: exitReady ? "#5fd47a" : "#ff5b4c", kind: "exit" });

  const totalThreat = project.robots.reduce(
    (total, robot) => total + (archetypeWeight[robot.archetype] ?? 1) * robot.count * (robot.tier === "elite" ? 1.6 : 1),
    0,
  );
  const pressure = Math.max(0, Math.min(1, totalThreat / Math.max(1, project.rooms.length) / 5));

  return { pathRoomIds, lockChain, pressure, exitReady };
}
