import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const [
    { builtInValidationReports, humanProtocolBasePack },
    {
      doorSkinProfiles,
      resolveDoorMaterial,
      resolveDoorSkin,
      resolveDoorVisual,
      resolveRoomAesthetic,
      resolveRoomFloorMaterial,
      resolveRoomSkin,
      resolveRoomWallMaterial,
      roomSkinProfiles,
    },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    server.ssrLoadModule("/src/game/visual/AssetResolver.ts"),
  ]);

  const campaignLevels = humanProtocolBasePack.campaignLevelIds.map((levelId) => {
    const level = humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId);
    if (!level) fail(`Missing campaign level ${levelId}`);
    return level;
  });

  assertBuiltInValidationClean(builtInValidationReports);
  assertCampaignArtContracts(campaignLevels, { resolveRoomAesthetic, resolveRoomFloorMaterial, resolveRoomWallMaterial });
  assertLevel01HeroArt(campaignLevels[0], {
    doorSkinProfiles,
    resolveDoorMaterial,
    resolveDoorSkin,
    resolveDoorVisual,
    resolveRoomAesthetic,
    resolveRoomFloorMaterial,
    resolveRoomSkin,
    resolveRoomWallMaterial,
    roomSkinProfiles,
  });

  console.log(`PASS art config QA campaign=${campaignLevels.map((level) => level.id).join(" -> ")}`);
} finally {
  await server.close();
}

function assertBuiltInValidationClean(reports) {
  const broken = reports.filter(({ report }) => !report.ok || report.errors.length > 0 || report.warnings.length > 0);
  if (broken.length > 0) {
    const summary = broken
      .map(({ levelId, report }) => `${levelId}: errors=${report.errors.length} warnings=${report.warnings.length}`)
      .join("; ");
    fail(`Built-in config validation has art/config issues: ${summary}`);
  }
  console.log(`PASS art built-in validation=${reports.length} levels`);
}

function assertCampaignArtContracts(levels, resolvers) {
  for (const level of levels) {
    const map = level.map;
    if (!map) fail(`${level.id}: missing map`);
    for (const room of map.rooms) {
      const floor = resolvers.resolveRoomFloorMaterial(room);
      const wall = resolvers.resolveRoomWallMaterial(room);
      const aesthetic = resolvers.resolveRoomAesthetic(room);
      if (!floor?.key || !wall?.key) fail(`${level.id}/${room.id}: room material did not resolve`);
      if (!aesthetic) fail(`${level.id}/${room.id}: room aesthetic did not resolve`);
      if (room.geometry?.renderFloor && !room.geometry?.renderWalls) {
        fail(`${level.id}/${room.id}: floor renders without walls; room reads unfinished`);
      }
    }
    for (const door of map.doors) {
      if (!door.visualKey && !door.skinKey) fail(`${level.id}/${door.id}: door has no visual or skin`);
    }
  }
  console.log(`PASS art campaign contracts=${levels.length} levels`);
}

function assertLevel01HeroArt(level, resolvers) {
  if (level.id !== "level_01_maintenance_bay") fail(`Expected Level01 first, got ${level.id}`);
  const map = level.map;
  if (!map) fail("Level01 missing map");

  for (const room of map.rooms) {
    if (!room.skinKey) fail(`Level01 room ${room.id} must use skinKey`);
    const skin = resolvers.resolveRoomSkin(room);
    if (!skin || skin.key !== room.skinKey) fail(`Level01 room ${room.id} skin did not resolve`);
    const aesthetic = resolvers.resolveRoomAesthetic(room);
    if (aesthetic?.detail !== "high") fail(`Level01 room ${room.id} should use high-detail art`);
    if (!room.geometry?.renderFloor || !room.geometry?.renderWalls) {
      fail(`Level01 room ${room.id} must render config-driven floor and walls`);
    }
    const floor = resolvers.resolveRoomFloorMaterial(room);
    const wall = resolvers.resolveRoomWallMaterial(room);
    if (floor.key !== skin.floorMaterialKey || wall.key !== skin.wallMaterialKey) {
      fail(`Level01 room ${room.id} skin material mismatch: floor=${floor.key} wall=${wall.key}`);
    }
  }

  const mainRoom = map.rooms.find((room) => room.id === "maintenance_bay_floor");
  if (!mainRoom) fail("Level01 missing maintenance_bay_floor");
  const mainSkin = resolvers.resolveRoomSkin(mainRoom);
  if (!mainSkin?.hero) fail("Level01 maintenance_bay_floor must use hero room skin");

  for (const door of map.doors) {
    if (!door.skinKey) fail(`Level01 door ${door.id} must use skinKey`);
    const skin = resolvers.resolveDoorSkin(door);
    if (!skin || skin.key !== door.skinKey) fail(`Level01 door ${door.id} skin did not resolve`);
    const visual = resolvers.resolveDoorVisual(door);
    const material = resolvers.resolveDoorMaterial(door);
    if (visual.visualKey !== skin.visualKey || material.key !== skin.materialKey) {
      fail(`Level01 door ${door.id} skin mismatch: visual=${visual.visualKey} material=${material.key}`);
    }
  }

  const elevatorDoor = map.doors.find((door) => door.id === "service_elevator_door");
  if (!elevatorDoor || !resolvers.resolveDoorSkin(elevatorDoor)?.hero) {
    fail("Level01 service elevator must use hero door skin");
  }

  console.log(`PASS art level01 hero rooms=${map.rooms.length} doors=${map.doors.length}`);
}

function fail(message) {
  throw new Error(message);
}
