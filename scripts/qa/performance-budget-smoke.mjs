import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const [{ GameWorld }, { humanProtocolBasePack }, { captureRenderBudgetSnapshot }] = await Promise.all([
    server.ssrLoadModule("/src/game/core/GameWorld.ts"),
    server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    server.ssrLoadModule("/src/game/core/RenderBudgetSnapshot.ts"),
  ]);

  const world = new GameWorld();
  const failures = [];
  const qualityTiers = ["high", "balanced", "rescue"];

  for (const levelId of humanProtocolBasePack.campaignLevelIds) {
    world.loadLevel(levelId, "playing");
    const map = world.level.map;
    if (!map) {
      failures.push(`${levelId}: missing map config`);
      continue;
    }

    console.log(`PASS perf ${levelId}`);
    for (const tier of qualityTiers) {
      world.renderPerformance.setDiagnosticTier(tier);
      const snapshots = captureRoomSnapshots(world, map, captureRenderBudgetSnapshot);
      const summary = summarizeSnapshots(snapshots);
      failures.push(...snapshots.flatMap(assertSnapshot));
      failures.push(...assertVisibilityCull(levelId, tier, summary));
      console.log(
        `  ${tier.padEnd(8)} rooms=${summary.maxVisibleRooms}/${summary.totalRooms} props=${summary.maxVisibleProps}/${summary.totalProps} doors=${summary.maxVisibleDoors}/${summary.totalDoors}`,
      );
      console.log(
        `           markers=${summary.maxVisiblePuzzleMarkers}/${summary.totalPuzzleMarkers} lights dyn=${summary.maxDynamicLights}/${summary.limitDynamicLights} floor=${summary.maxFloorGlows}/${summary.limitFloorGlows} shadow=${summary.maxShadowLights}/${summary.limitShadowLights}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error("FAIL render performance budget");
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`PASS perf campaign=${humanProtocolBasePack.campaignLevelIds.join(" -> ")}`);
  }
} finally {
  await server.close();
}

function captureRoomSnapshots(world, map, captureRenderBudgetSnapshot) {
  const snapshots = [];
  for (const room of map.rooms) {
    world.session.mapProgress.currentRoomId = room.id;
    if (!world.session.mapProgress.visitedRoomIds.includes(room.id)) {
      world.session.mapProgress.visitedRoomIds.push(room.id);
    }
    world.player.position.set(room.bounds.center[0], world.level.spawnPoint[1], room.bounds.center[2]);
    snapshots.push(captureRenderBudgetSnapshot(world));
  }
  return snapshots;
}

function assertSnapshot(snapshot) {
  const failures = [];
  const prefix = `${snapshot.levelId}/${snapshot.currentRoomId ?? "no-room"}`;
  if (snapshot.totals.rooms > 0 && snapshot.visible.rooms <= 0) failures.push(`${prefix}: no visible rooms`);
  if (snapshot.visible.dynamicLights > snapshot.limits.dynamicLights) {
    failures.push(`${prefix}: dynamicLights ${snapshot.visible.dynamicLights} > ${snapshot.limits.dynamicLights}`);
  }
  if (snapshot.visible.floorGlows > snapshot.limits.floorGlows) {
    failures.push(`${prefix}: floorGlows ${snapshot.visible.floorGlows} > ${snapshot.limits.floorGlows}`);
  }
  if (snapshot.visible.shadowLights > snapshot.limits.shadowLights) {
    failures.push(`${prefix}: shadowLights ${snapshot.visible.shadowLights} > ${snapshot.limits.shadowLights}`);
  }
  if (snapshot.activeRuntime.visualEffects > snapshot.limits.effects) {
    failures.push(`${prefix}: visualEffects ${snapshot.activeRuntime.visualEffects} > ${snapshot.limits.effects}`);
  }
  if (snapshot.activeRuntime.visualProjectiles > snapshot.limits.projectiles) {
    failures.push(`${prefix}: visualProjectiles ${snapshot.activeRuntime.visualProjectiles} > ${snapshot.limits.projectiles}`);
  }
  return failures;
}

function assertVisibilityCull(levelId, tier, summary) {
  const failures = [];
  if (levelId !== "level_03_human_museum") return failures;
  const prefix = `${levelId}/${tier}`;
  if (summary.totalRooms > 0 && summary.maxVisibleRooms >= summary.totalRooms) {
    failures.push(`${prefix}: room visibility cull regressed ${summary.maxVisibleRooms}/${summary.totalRooms}`);
  }
  if (summary.totalProps > 0 && summary.maxVisibleProps >= summary.totalProps) {
    failures.push(`${prefix}: prop visibility cull regressed ${summary.maxVisibleProps}/${summary.totalProps}`);
  }
  return failures;
}

function summarizeSnapshots(snapshots) {
  const first = snapshots[0];
  return {
    totalRooms: first?.totals.rooms ?? 0,
    totalProps: first?.totals.props ?? 0,
    totalDoors: first?.totals.doors ?? 0,
    totalPuzzleMarkers: first?.totals.puzzleMarkers ?? 0,
    limitDynamicLights: first?.limits.dynamicLights ?? 0,
    limitFloorGlows: first?.limits.floorGlows ?? 0,
    limitShadowLights: first?.limits.shadowLights ?? 0,
    maxVisibleRooms: maxOf(snapshots, (snapshot) => snapshot.visible.rooms),
    maxVisibleProps: maxOf(snapshots, (snapshot) => snapshot.visible.props),
    maxVisibleDoors: maxOf(snapshots, (snapshot) => snapshot.visible.doors),
    maxVisiblePuzzleMarkers: maxOf(snapshots, (snapshot) => snapshot.visible.puzzleMarkers),
    maxDynamicLights: maxOf(snapshots, (snapshot) => snapshot.visible.dynamicLights),
    maxFloorGlows: maxOf(snapshots, (snapshot) => snapshot.visible.floorGlows),
    maxShadowLights: maxOf(snapshots, (snapshot) => snapshot.visible.shadowLights),
  };
}

function maxOf(items, read) {
  return items.reduce((max, item) => Math.max(max, read(item)), 0);
}
