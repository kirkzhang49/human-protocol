// Campaign integrity checks for maintained official levels 1-3.
//
// Invoked from smoke-campaign.mjs (headless, no browser). Verifies the
// contracts that the validator and walkability smoke don't cover:
//   - level config rooms == Raw WebGPU render plan rooms (missing plan rooms
//     render as nothing at runtime, silently),
//   - criticalPathRoomIds all present in the Raw plan,
//   - objective guidance targets resolve to a world position whose room is in
//     the Raw plan,
//   - renderWalls:true rooms must also have collisionWalls:true unless listed
//     in WALL_COLLISION_EXCEPTIONS with a documented reason,
//   - collision walls actually carve an opening for every connecting door,
//   - spawn/exit/pickup/key/interaction/puzzle-target points are not embedded
//     in wall segments or prop colliders,
//   - enemy spawn groups resolve (after the runtime's bounds clamp) to points
//     the enemy AI can stand on,
//   - level 1 lockdown pressure stays at or above a legacy-informed baseline.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const OFFICIAL_CAMPAIGN_LEVEL_IDS = [
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
];

/**
 * Rooms allowed to render walls without collision walls. Every entry must
 * carry a reason; an empty map means the policy is "render implies collide".
 */
const WALL_COLLISION_EXCEPTIONS = new Map([
  // (none — official rooms must be physically walled when visually walled)
]);

/**
 * Design-informed lockdown pressure floor for level 1.
 * Legacy (pre-remaster archive, temporary/legacy-official-v1) lockdown HP:
 *   wave_01 780 initial + 960 capped reinforcements
 *   wave_02 780 initial + 1290 capped reinforcements
 *   elite_wave 2722 elite (0.72x) + 300 escorts + ~840 endless allowance
 *   == ~6502 total. Current official tuning intentionally cuts the maintenance
 * leader by 25% (0.54x), so the floor follows that lower boss budget while
 * still catching removed mid waves or accidental elite re-softening.
 */
const LEVEL_01_MIN_LOCKDOWN_PRESSURE = 5600;
const LEVEL_01_MIN_ELITE_HEALTH_MULTIPLIER = 0.54;
const LEVEL_01_LOCKDOWN_WAVE_IDS = ["wave_01", "wave_02", "elite_wave"];

const RAW_PLAN_DIR = "src/assets/manifests/generated/raw-webgpu";

export function runCampaignIntegrityChecks({ basePack, repoRoot, helpers }) {
  const failures = [];
  const reports = [];

  for (const levelId of OFFICIAL_CAMPAIGN_LEVEL_IDS) {
    const level = basePack.levels.find((candidate) => candidate.id === levelId);
    if (!level?.map) {
      failures.push(`${levelId}: missing from base pack or has no map`);
      continue;
    }
    const issues = [];
    const planRoomIds = checkRawPlanRooms(level, repoRoot, issues);
    checkWallCollisionPolicy(level, issues);
    const obstacles = buildObstacles(level, helpers);
    checkDoorOpenings(level, helpers, issues);
    checkAnchoredPositions(level, obstacles, issues);
    checkObjectiveGuidance(level, planRoomIds, issues);
    checkSpawnGroups(level, helpers, obstacles, issues);
    if (levelId === "level_01_maintenance_bay") {
      checkLevel01LockdownPressure(level, helpers.enemyArchetypes, issues);
    }
    reports.push({ levelId, issues: issues.length });
    for (const issue of issues) failures.push(`${levelId}: ${issue}`);
  }

  return { reports, failures };
}

// ---------------------------------------------------------------- raw plan

function checkRawPlanRooms(level, repoRoot, issues) {
  const planPath = path.join(repoRoot, RAW_PLAN_DIR, `render_plan_${level.id}.json`);
  if (!existsSync(planPath)) {
    issues.push(`raw render plan missing: ${planPath}`);
    return null;
  }
  let plan;
  try {
    plan = JSON.parse(readFileSync(planPath, "utf8"));
  } catch (error) {
    issues.push(`raw render plan unreadable: ${error.message}`);
    return null;
  }
  const planRoomIds = new Set((plan.rooms ?? []).map((room) => room.id));
  const configRoomIds = new Set(level.map.rooms.map((room) => room.id));
  for (const id of configRoomIds) {
    if (!planRoomIds.has(id)) issues.push(`config room "${id}" missing from raw render plan (renders as nothing)`);
  }
  for (const id of planRoomIds) {
    if (!configRoomIds.has(id)) issues.push(`raw render plan room "${id}" no longer exists in level config (stale plan)`);
  }
  for (const id of level.map.navigation.criticalPathRoomIds) {
    if (!planRoomIds.has(id)) issues.push(`criticalPathRoomIds entry "${id}" missing from raw render plan`);
  }
  return planRoomIds;
}

// ------------------------------------------------------------- wall policy

function checkWallCollisionPolicy(level, issues) {
  for (const room of level.map.rooms) {
    const geometry = room.geometry;
    if (!geometry?.renderWalls) continue;
    if (geometry.collisionWalls) continue;
    const exception = WALL_COLLISION_EXCEPTIONS.get(`${level.id}:${room.id}`);
    if (exception) continue;
    issues.push(`room "${room.id}" renders walls without collision walls (no documented exception)`);
  }
}

// ------------------------------------------------------------ door openings

function checkDoorOpenings(level, helpers, issues) {
  const roomsById = new Map(level.map.rooms.map((room) => [room.id, room]));
  const wallSegments = helpers
    .createRoomWallSegments(level, (room) => Boolean(room.geometry?.collisionWalls))
    .map((segment) => ({
      id: `room-wall:${segment.id}`,
      position: segment.position,
      halfSize: [segment.size[0] / 2, segment.size[1] / 2, segment.size[2] / 2],
    }));

  for (const door of level.map.doors) {
    for (const roomId of new Set([door.fromRoomId, door.toRoomId])) {
      const room = roomsById.get(roomId);
      if (!room?.geometry?.collisionWalls) continue;
      const boundary = doorBoundary(room, door);
      if (!boundary) {
        issues.push(`door "${door.id}" does not align with any collision boundary of room "${roomId}"`);
        continue;
      }
      // The carved opening must actually be clear: probe across the doorway
      // span on the boundary line with a slim test circle.
      const halfWidth = Math.max(0.4, door.size[0] / 2 - 0.2);
      for (const offset of [-halfWidth * 0.6, 0, halfWidth * 0.6]) {
        const point = boundary.axis === "z"
          ? [door.position[0] + offset, 0, boundary.line]
          : [boundary.line, 0, door.position[2] + offset];
        if (!pointPassable(point, wallSegments, 0.3)) {
          issues.push(`door "${door.id}" opening blocked by collision wall of room "${roomId}" near ${point[0].toFixed(2)},${point[2].toFixed(2)}`);
          break;
        }
      }
    }
  }
}

/** Mirrors mapValidator.doorCutsCollisionWall: which boundary does this door cut? */
function doorBoundary(room, door) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const [x, , z] = door.position;
  const minX = cx - sx / 2;
  const maxX = cx + sx / 2;
  const minZ = cz - sz / 2;
  const maxZ = cz + sz / 2;
  const tolerance = Math.max(0.8, door.size[2] + 0.55);
  if (x >= minX - 0.1 && x <= maxX + 0.1) {
    if (Math.abs(z - maxZ) <= tolerance) return { axis: "z", line: maxZ };
    if (Math.abs(z - minZ) <= tolerance) return { axis: "z", line: minZ };
  }
  if (z >= minZ - 0.1 && z <= maxZ + 0.1) {
    if (Math.abs(x - maxX) <= tolerance) return { axis: "x", line: maxX };
    if (Math.abs(x - minX) <= tolerance) return { axis: "x", line: minX };
  }
  return null;
}

// ------------------------------------------------------ anchored positions

function buildObstacles(level, helpers) {
  return [
    ...helpers
      .createRoomWallSegments(level, (room) => Boolean(room.geometry?.collisionWalls))
      .map((segment) => ({
        id: `room-wall:${segment.id}`,
        position: segment.position,
        halfSize: [segment.size[0] / 2, segment.size[1] / 2, segment.size[2] / 2],
      })),
    ...helpers.createPropCollisionProxies(level).map((proxy) => ({
      id: `prop:${proxy.id}`,
      position: proxy.position,
      halfSize: proxy.halfSize,
    })),
  ];
}

function checkAnchoredPositions(level, obstacles, issues) {
  // The spawn point itself must be standable — the player materializes there.
  const spawnHit = firstObstacleHit(level.spawnPoint, obstacles, 0.6);
  if (spawnHit) issues.push(`spawn point at ${fmt(level.spawnPoint)} is inside collider ${spawnHit.id}`);

  // Anchors are routinely co-located with their own prop (a terminal IS its
  // console; orbs sit ON pedestals), and the player uses them from within a
  // usable radius. The physical contract: a standable point must exist inside
  // that radius — an anchor fully buried in walls/colliders fails.
  const anchors = [
    { label: "exit", position: level.exit.position, radius: Math.max(1.2, level.exit.radius ?? 1.2) },
  ];
  for (const item of level.map.keyItems) anchors.push({ label: `key item ${item.id}`, position: item.position, radius: Math.max(1.2, item.collectRadius ?? 1.2) });
  for (const interaction of level.map.interactions) anchors.push({ label: `interaction ${interaction.id}`, position: interaction.position, radius: Math.max(1.2, interaction.radius ?? 1.2) });
  for (const pickup of level.map.pickups ?? []) anchors.push({ label: `pickup ${pickup.id}`, position: pickup.position, radius: 1.25 });
  for (const pickup of level.pickups.storyPickups ?? []) anchors.push({ label: `story pickup ${pickup.type}`, position: pickup.position, radius: Math.max(1.2, pickup.collectRadius ?? 1.2) });
  for (const puzzle of level.puzzles ?? []) {
    if (puzzle.type === "hit_sequence") {
      for (const target of puzzle.targets) anchors.push({ label: `puzzle target ${target.id}`, position: target.position, radius: Math.max(1.4, target.radius + 0.8) });
    }
  }

  for (const anchor of anchors) {
    if (!hasPassableNear(anchor.position, obstacles, 0.6, anchor.radius)) {
      issues.push(`${anchor.label} at ${fmt(anchor.position)} has no standable point within ${anchor.radius.toFixed(1)}m (buried in colliders)`);
    }
  }
}

// ------------------------------------------------------ objective guidance

function checkObjectiveGuidance(level, planRoomIds, issues) {
  for (const objective of level.objectiveChain ?? []) {
    const guidance = objective.guidance;
    if (!guidance) continue;
    const resolved = resolveGuidancePosition(level, guidance);
    if (!resolved || resolved.some((value) => !Number.isFinite(value))) {
      issues.push(`objective "${objective.id}" guidance (${guidance.targetType}:${guidance.targetId ?? ""}) does not resolve to a world position`);
      continue;
    }
    const room = roomContaining(level, resolved);
    if (room && planRoomIds && !planRoomIds.has(room.id)) {
      issues.push(`objective "${objective.id}" guidance resolves into room "${room.id}" which is missing from the raw render plan`);
    }
  }
}

/** Static mirror of RunProgressOverlay.guidanceTarget (no GameWorld needed). */
function resolveGuidancePosition(level, guidance) {
  const map = level.map;
  if (guidance.targetType === "exit") return level.exit.position;
  if (guidance.targetType === "room") return map.rooms.find((room) => room.id === guidance.targetId)?.bounds.center ?? null;
  if (guidance.targetType === "door") return map.doors.find((door) => door.id === guidance.targetId)?.position ?? null;
  if (guidance.targetType === "key_item") return map.keyItems.find((item) => item.id === guidance.targetId)?.position ?? null;
  if (guidance.targetType === "interaction") return map.interactions.find((entry) => entry.id === guidance.targetId)?.position ?? null;
  if (guidance.targetType === "puzzle") {
    const puzzle = level.puzzles?.find((candidate) => candidate.id === guidance.targetId);
    if (!puzzle) return null;
    return map.rooms.find((room) => room.id === puzzle.roomId)?.bounds.center ?? null;
  }
  if (guidance.targetType === "wave") {
    const wave = level.waves.find((candidate) => candidate.id === guidance.targetId);
    const groupId = wave?.enemies[0]?.from;
    const group = level.spawnGroups.find((candidate) => candidate.id === groupId);
    return group?.center ?? group?.positions?.[0] ?? null;
  }
  return null;
}

function roomContaining(level, position) {
  return level.map.rooms.find((room) => {
    const [cx, , cz] = room.bounds.center;
    const [sx, , sz] = room.bounds.size;
    return Math.abs(position[0] - cx) <= sx / 2 && Math.abs(position[2] - cz) <= sz / 2;
  }) ?? null;
}

// ---------------------------------------------------------- spawn groups

function checkSpawnGroups(level, helpers, obstacles, issues) {
  const reported = new Set();
  const entries = [];
  for (const wave of level.waves) {
    for (const group of wave.enemies) entries.push({ waveId: wave.id, ...group });
    for (const group of wave.reinforcements ?? []) entries.push({ waveId: wave.id, ...group });
  }

  for (const entry of entries) {
    const archetype = helpers.enemyArchetypes[entry.archetype];
    const radius = archetype?.radius ?? 0.7;
    const bounds = helpers.movementBoundsForLevel(level, radius);
    const total = Math.max(1, Math.min(entry.count, 6));
    for (let index = 0; index < total; index += 1) {
      for (const seed of [0, 3, 7]) {
        const raw = spawnPositionMirror(level, entry.from, index, total, seed);
        if (!raw) {
          report(reported, issues, `${entry.waveId}: spawn group "${entry.from}" is not defined in spawnGroups`);
          break;
        }
        // Runtime clamps enemies into movement bounds each frame and resolves
        // AABB overlaps — mirror that, then require a standable point nearby.
        const clamped = [
          clamp(raw[0], bounds.minX, bounds.maxX),
          raw[1],
          clamp(raw[2], bounds.minZ, bounds.maxZ),
        ];
        if (!hasPassableNear(clamped, obstacles, radius, 2.4)) {
          report(
            reported,
            issues,
            `${entry.waveId}: spawn group "${entry.from}" (${entry.archetype}) resolves to ${fmt(clamped)} with no standable point within 2.4m`,
          );
        }
      }
    }
  }
}

function report(reported, issues, message) {
  if (reported.has(message)) return;
  reported.add(message);
  issues.push(message);
}

/** Mirror of WaveDirectorSystem.spawnPosition (keep the math in sync). */
function spawnPositionMirror(level, groupId, index, total, seed) {
  const definition = level.spawnGroups.find((candidate) => candidate.id === groupId);
  if (!definition) return null;
  const layout = definition.layout ?? groupId;
  const [baseX, baseY, baseZ] = definition.center ?? [0, 0, 0];
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const spread = (t - 0.5) * (definition.spread ?? 14);
  const wave = Math.sin(index * 1.7) * 1.2;

  if (definition.positions?.length) {
    const point = definition.positions[index % definition.positions.length];
    const jitter = total <= 1 ? 0 : (((seed + index) % 5) - 2) * 0.16;
    return [point[0] + jitter, point[1], point[2] - jitter];
  }
  if (layout === "front") return [baseX + spread * 0.2, baseY, baseZ - 9.5 - index * 0.2];
  if (layout === "front_arc") return [baseX + spread, baseY, baseZ - 12.5 + wave];
  if (layout === "side_rear") {
    const side = index % 2 === 0 ? -1 : 1;
    return [baseX + side * (9.5 + (index % 3)), baseY, baseZ + 5.5 + Math.floor(index / 2) * 2.2];
  }
  if (layout === "front_gate") return [baseX, baseY, baseZ - 14];
  if (layout === "turret_rail") {
    const side = index % 2 === 0 ? -1 : 1;
    return [baseX + side * 7.8, baseY, baseZ - 6 - Math.floor(index / 2) * 4];
  }
  if (layout === "around_ring") {
    const angle = (index / Math.max(1, total)) * Math.PI * 2 + (seed % 9) * 0.7;
    const ringRadius = definition.radius ?? 13.6 + (seed % 3) * 0.55;
    return [baseX + Math.sin(angle) * ringRadius, baseY, baseZ + Math.cos(angle) * ringRadius];
  }
  if (layout === "rear_ring") {
    const side = index % 2 === 0 ? -1 : 1;
    const laneOffset = ((seed + index) % 3) * 1.15;
    return [baseX + side * (6.2 + laneOffset), baseY, baseZ + 11.4 + Math.floor(index / 2) * 1.8];
  }
  return [baseX + spread * 0.65, baseY, baseZ - 10.5];
}

// --------------------------------------------------- level 1 pressure gate

function checkLevel01LockdownPressure(level, enemyArchetypes, issues) {
  const wavesById = new Map(level.waves.map((wave) => [wave.id, wave]));
  const survive = level.objectiveChain?.find((objective) => objective.id === "obj_survive_service_elevator_door");
  if (!survive) {
    issues.push("missing obj_survive_service_elevator_door objective");
    return;
  }
  const elevatorDoor = level.map?.doors.find((door) => door.id === "service_elevator_door");
  const elevatorDoorWaveIds = elevatorDoor?.lock?.type === "survive_wave"
    ? [...(elevatorDoor.lock.waveIds ?? []), ...(elevatorDoor.lock.waveId ? [elevatorDoor.lock.waveId] : [])]
    : [];
  if (elevatorDoor?.lock?.type !== "survive_wave") {
    issues.push("service_elevator_door is no longer locked by finite combat waves");
  }
  for (const waveId of LEVEL_01_LOCKDOWN_WAVE_IDS) {
    if (!wavesById.has(waveId)) issues.push(`lockdown wave "${waveId}" missing from waves`);
    if (!survive.requiredIds.includes(waveId)) issues.push(`lockdown wave "${waveId}" missing from survive objective requiredIds (progression could skip it)`);
    if (!elevatorDoorWaveIds.includes(waveId)) issues.push(`lockdown wave "${waveId}" missing from service_elevator_door wave lock`);
  }
  for (const requiredId of survive.requiredIds) {
    if (!wavesById.has(requiredId)) issues.push(`survive objective requires unknown wave "${requiredId}" (progression would deadlock)`);
  }

  const eliteEntry = level.waves
    .flatMap((wave) => wave.enemies)
    .find((entry) => entry.archetype === "custodian_elite");
  const eliteMultiplier = eliteEntry?.healthMultiplier ?? 1;
  if (!eliteEntry) {
    issues.push("lockdown has no custodian_elite entry");
  } else if (eliteMultiplier < LEVEL_01_MIN_ELITE_HEALTH_MULTIPLIER) {
    issues.push(`custodian_elite healthMultiplier ${eliteMultiplier} below legacy-informed floor ${LEVEL_01_MIN_ELITE_HEALTH_MULTIPLIER}`);
  }

  let pressure = 0;
  for (const waveId of LEVEL_01_LOCKDOWN_WAVE_IDS) {
    const wave = wavesById.get(waveId);
    if (!wave) continue;
    for (const entry of wave.enemies) {
      const hp = (enemyArchetypes[entry.archetype]?.maxHealth ?? 0) * (entry.healthMultiplier ?? 1);
      pressure += hp * entry.count;
    }
    for (const entry of wave.reinforcements ?? []) {
      const hp = (enemyArchetypes[entry.archetype]?.maxHealth ?? 0) * (entry.healthMultiplier ?? 1);
      // Endless streams contribute a fixed allowance (2 full concurrency
      // refills); bounded streams contribute their full capped budget.
      pressure += entry.endless ? hp * (entry.maxAlive ?? entry.count) * 2 : hp * entry.count * entry.maxGroups;
    }
  }
  if (pressure < LEVEL_01_MIN_LOCKDOWN_PRESSURE) {
    issues.push(`lockdown pressure ${Math.round(pressure)} HP below legacy-informed floor ${LEVEL_01_MIN_LOCKDOWN_PRESSURE}`);
  }
}

// ------------------------------------------------------------------ helpers

function firstObstacleHit(position, obstacles, radius) {
  for (const obstacle of obstacles) {
    if (circleIntersectsAabb(position, radius, obstacle.position, obstacle.halfSize)) return obstacle;
  }
  return null;
}

function pointPassable(position, obstacles, radius) {
  return !firstObstacleHit(position, obstacles, radius);
}

function hasPassableNear(position, obstacles, radius, searchRadius) {
  const step = 0.4;
  for (let dx = -searchRadius; dx <= searchRadius; dx += step) {
    for (let dz = -searchRadius; dz <= searchRadius; dz += step) {
      if (pointPassable([position[0] + dx, 0, position[2] + dz], obstacles, radius)) return true;
    }
  }
  return false;
}

function circleIntersectsAabb(position, radius, center, halfSize) {
  const closestX = Math.min(center[0] + halfSize[0], Math.max(center[0] - halfSize[0], position[0]));
  const closestZ = Math.min(center[2] + halfSize[2], Math.max(center[2] - halfSize[2], position[2]));
  const dx = position[0] - closestX;
  const dz = position[2] - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fmt(position) {
  return `${position[0].toFixed(2)},${position[2].toFixed(2)}`;
}
