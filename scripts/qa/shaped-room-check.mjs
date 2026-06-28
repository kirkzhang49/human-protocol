// Focused check for non-rectangular /build rooms: door tangent-yaw on an angled
// shared edge, polygon wall generation + door carving, and OBB collision.
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });
let failures = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures += 1;
};

try {
  const { createStarterProject } = await server.ssrLoadModule("/src/build/BuilderTypes.ts");
  const { compileBuilderProjectToLevel, sharedEdge } = await server.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts");
  const { findAutoDoorPlacement } = await server.ssrLoadModule("/src/build/BuilderDirector.ts");
  const { pickAt } = await server.ssrLoadModule("/src/build/BuilderPlacementRules.ts");
  const { snapRoomToNeighbors } = await server.ssrLoadModule("/src/build/BuilderRoomEditing.ts");
  const { createRoomWallSegments } = await server.ssrLoadModule("/src/game/config/MapGeometry.ts");
  const { resolveCircleObb, resolveCircleAabb } = await server.ssrLoadModule("/src/game/core/math.ts");
  const { polygonEdges, rotatedLocalPoints, roomWorldPolygon, shapeBboxSize, signedArea } = await server.ssrLoadModule("/src/build/BuilderRoomShape.ts");
  const { roomShapePresetById } = await server.ssrLoadModule("/src/build/BuilderRoomShapePresets.ts");
  const { previewPlanYawToThreeYaw, previewRoomWallSegments } = await server.ssrLoadModule("/src/build/BuilderPreviewWallSegments.ts");
  const { compileBuilderRuntimePack } = await server.ssrLoadModule("/src/build/runtime-pack/compileBuilderRuntimePack.ts");
  const { GeometryWriter } = await server.ssrLoadModule("/src/build/runtime-pack/GeometryWriter.ts");
  const FPV = 14; // floats per runtime vertex

  // Two right-triangle rooms forming an 8×8 square split on its (0,0)-(8,8)
  // diagonal. Their only shared edge is that 45° diagonal (~11.3m).
  const shapeA = { kind: "polygon", points: [[-4, -4], [4, -4], [4, 4]] }; // lower-right
  const shapeB = { kind: "polygon", points: [[-4, -4], [4, 4], [-4, 4]] }; // upper-left
  const roomA = { id: "room_a", label: "三角A", style: "maintenance", center: [4, 4], size: shapeBboxSize(shapeA), shape: shapeA };
  const roomB = { id: "room_b", label: "三角B", style: "museum", center: [4, 4], size: shapeBboxSize(shapeB), shape: shapeB };

  // 1. sharedEdge yaw follows the 45° diagonal (not cardinal).
  const edge = sharedEdge(roomA, roomB);
  const diagonal = edge && Math.abs(Math.cos(edge.yaw)) > 0.3 && Math.abs(Math.sin(edge.yaw)) > 0.3;
  ok("sharedEdge on a 45° shared wall yields a diagonal door yaw", Boolean(diagonal), edge ? `yaw=${(edge.yaw).toFixed(3)} rad` : "no edge");

  // 2. compile produces a level with the shaped room + a door.
  const base = createStarterProject();
  const project = {
    ...base,
    rooms: [roomA, roomB],
    doors: [{ id: "door_ab", fromRoomId: "room_a", toRoomId: "room_b", lockType: "none" }],
    props: [],
    pickups: [],
    robots: [],
    puzzles: [],
    routeSwitches: [],
    exitRoomId: "room_b",
  };
  const { level, issues } = compileBuilderProjectToLevel(project);
  ok("shaped project compiles to a level", Boolean(level), `issues=${issues.length}`);
  const compiledA = level?.map?.rooms.find((r) => r.id === "room_a");
  ok("compiled spawn room carries bounds.shape (3 pts)", compiledA?.bounds?.shape?.points?.length === 3);
  const door = level?.map?.doors.find((d) => d.id === "door_ab");
  const doorDiagonal = door && Math.abs(Math.cos(door.yaw)) > 0.3 && Math.abs(Math.sin(door.yaw)) > 0.3;
  ok("compiled door yaw is diagonal", Boolean(doorDiagonal), door ? `yaw=${door.yaw.toFixed(3)}` : "no door");

  // 2b. A shaped room can be dragged near a normal room and magnetically snaps
  // its flat polygon edge flush, producing a valid shared edge.
  const normalRoom = { id: "room_rect", label: "矩形房", style: "sterile", center: [0, 0], size: [8, 6] };
  const triShape = { kind: "polygon", points: [[-4, 2.6], [0, -2.6], [4, 2.6]] };
  const nearTriangle = { id: "room_tri", label: "三角房", style: "maintenance", center: [0, -5.05], size: shapeBboxSize(triShape), shape: triShape };
  const snappedTriangle = snapRoomToNeighbors(nearTriangle, [normalRoom]);
  const snappedRoom = { ...nearTriangle, center: snappedTriangle.center };
  ok("polygon room drag snaps a triangle flat edge to a normal room", Boolean(sharedEdge(snappedRoom, normalRoom)), `guides=${snappedTriangle.guides.length}`);

  // 2c. If a wedge/triangle is visually near a normal room by its point rather
  // than by a flat wall, the door tool can rotate + move the shaped room until
  // a true shared edge exists. This prevents "point touching wall" fake doors.
  const wedgeShape = { kind: "polygon", points: [[-4, -2.6], [-4, 2.6], [4, 0]] };
  const pointTouchTriangle = { id: "room_point_tri", label: "尖角三角房", style: "maintenance", center: [5.2, 0], size: shapeBboxSize(wedgeShape), shape: wedgeShape };
  const autoDoorProject = { ...createStarterProject(), rooms: [normalRoom, pointTouchTriangle], doors: [], props: [], robots: [], exitRoomId: pointTouchTriangle.id };
  const autoPlacement = findAutoDoorPlacement(autoDoorProject, pointTouchTriangle.id);
  const autoRooms = autoPlacement?.project.rooms ?? [];
  const autoNormal = autoRooms.find((room) => room.id === normalRoom.id);
  const autoTriangle = autoRooms.find((room) => room.id === pointTouchTriangle.id);
  ok(
    "auto door placement rotates/moves a point-touch triangle onto a real shared edge",
    Boolean(autoPlacement?.aligned && autoNormal && autoTriangle && sharedEdge(autoTriangle, autoNormal)),
    autoTriangle ? `center=${autoTriangle.center.map((value) => value.toFixed(2)).join(",")} rot=${(autoTriangle.shape?.rotation ?? 0).toFixed(3)}` : "no triangle",
  );

  const leftPointTouchTriangle = { ...pointTouchTriangle, id: "room_point_tri_left", center: [-5.2, 0] };
  const leftAutoProject = { ...createStarterProject(), rooms: [normalRoom, leftPointTouchTriangle], doors: [], props: [], robots: [], exitRoomId: leftPointTouchTriangle.id };
  const leftAutoPlacement = findAutoDoorPlacement(leftAutoProject, leftPointTouchTriangle.id);
  const leftRooms = leftAutoPlacement?.project.rooms ?? [];
  const leftNormal = leftRooms.find((room) => room.id === normalRoom.id);
  const leftTriangle = leftRooms.find((room) => room.id === leftPointTouchTriangle.id);
  ok(
    "auto door placement also fixes a triangle point-touching from the left",
    Boolean(leftAutoPlacement?.aligned && leftNormal && leftTriangle && sharedEdge(leftTriangle, leftNormal)),
    leftTriangle ? `center=${leftTriangle.center.map((value) => value.toFixed(2)).join(",")} rot=${(leftTriangle.shape?.rotation ?? 0).toFixed(3)}` : "no triangle",
  );

  const floorPick = pickAt(autoDoorProject, normalRoom.center[0], normalRoom.center[1], () => null, []);
  ok("3D picker treats open room floor as draggable room handle", floorPick?.kind === "room" && floorPick.id === normalRoom.id, floorPick ? `${floorPick.kind}:${floorPick.id}` : "none");

  const trianglePreset = roomShapePresetById("triangle");
  ok("triangle preset points are counter-clockwise for stable 3D floor/wall normals", trianglePreset && signedArea(trianglePreset.points) > 0, trianglePreset ? `area=${signedArea(trianglePreset.points).toFixed(3)}` : "missing preset");
  if (trianglePreset) {
    const zs = trianglePreset.points.map((point) => point[1]);
    const minZ = Math.min(...zs);
    const topEdgePoints = trianglePreset.points.filter((point) => Math.abs(point[1] - minZ) < 1e-6);
    ok(
      "triangle preset presents its flat door wall toward the room above in 2D/3D",
      topEdgePoints.length === 2,
      `topEdgePoints=${topEdgePoints.length}`,
    );
    const previewRoom = {
      id: "room_preview_shifted_triangle",
      label: "偏移三角房",
      style: "maintenance",
      center: [37, 23],
      size: shapeBboxSize({ kind: "polygon", points: trianglePreset.points }),
      shape: { kind: "polygon", points: trianglePreset.points },
    };
    const previewWalls = previewRoomWallSegments(previewRoom, []);
    const localEdges = polygonEdges(rotatedLocalPoints(previewRoom.shape));
    const wallMidpointsMatchLocalEdges =
      previewWalls.length === localEdges.length &&
      previewWalls.every((wall, index) => {
        const edge = localEdges[index];
        const midX = (edge.a[0] + edge.b[0]) / 2;
        const midZ = (edge.a[1] + edge.b[1]) / 2;
        return Math.abs(wall.x - midX) < 1e-6 && Math.abs(wall.z - midZ) < 1e-6;
      });
    const leakedWorldCenter = previewWalls.some((wall) => Math.abs(wall.x) > 10 || Math.abs(wall.z) > 10);
    ok(
      "3D preview shaped walls use the same local polygon coordinates as the floor",
      wallMidpointsMatchLocalEdges && !leakedWorldCenter,
      `walls=${previewWalls.map((wall) => `${wall.x.toFixed(2)},${wall.z.toFixed(2)}`).join(" ")}`,
    );
    const threeWallEndpointsMatchLocalEdges =
      previewWalls.length === localEdges.length &&
      previewWalls.every((wall, index) => {
        const edge = localEdges[index];
        const threeYaw = previewPlanYawToThreeYaw(wall.yaw ?? 0);
        const dx = Math.cos(threeYaw) * (wall.sx / 2);
        const dz = -Math.sin(threeYaw) * (wall.sx / 2);
        const p0 = [wall.x - dx, wall.z - dz];
        const p1 = [wall.x + dx, wall.z + dz];
        const direct =
          Math.hypot(p0[0] - edge.a[0], p0[1] - edge.a[1]) < 1e-6 &&
          Math.hypot(p1[0] - edge.b[0], p1[1] - edge.b[1]) < 1e-6;
        const reverse =
          Math.hypot(p0[0] - edge.b[0], p0[1] - edge.b[1]) < 1e-6 &&
          Math.hypot(p1[0] - edge.a[0], p1[1] - edge.a[1]) < 1e-6;
        return direct || reverse;
      });
    ok(
      "3D preview shaped wall boxes expand along the same edges as the floor polygon",
      threeWallEndpointsMatchLocalEdges,
      `threeYaw=${previewWalls.map((wall) => previewPlanYawToThreeYaw(wall.yaw ?? 0).toFixed(3)).join(",")}`,
    );
  }

  const legacyClockwiseShape = { kind: "polygon", points: [[-4, 2.6], [4, 2.6], [0, -2.6]] };
  const legacyClockwiseRoom = { id: "room_legacy_clockwise", label: "旧三角房", style: "maintenance", center: [0, 0], size: shapeBboxSize(legacyClockwiseShape), shape: legacyClockwiseShape };
  ok(
    "legacy clockwise triangle rooms normalize to a counter-clockwise world footprint",
    signedArea(roomWorldPolygon(legacyClockwiseRoom)) > 0,
    `area=${signedArea(roomWorldPolygon(legacyClockwiseRoom)).toFixed(3)}`,
  );

  const rotatedPresetShape = { kind: "polygon", points: trianglePreset.points, rotation: Math.PI / 12 };
  const rotatedPresetTriangle = { id: "room_rotated_preset_tri", label: "旋转三角房", style: "maintenance", center: [5.2, 0], size: shapeBboxSize(rotatedPresetShape), shape: rotatedPresetShape };
  const rotatedAutoProject = { ...createStarterProject(), rooms: [normalRoom, rotatedPresetTriangle], doors: [], props: [], robots: [], exitRoomId: rotatedPresetTriangle.id };
  const rotatedAutoPlacement = findAutoDoorPlacement(rotatedAutoProject, rotatedPresetTriangle.id);
  const rotatedRooms = rotatedAutoPlacement?.project.rooms ?? [];
  const rotatedNormal = rotatedRooms.find((room) => room.id === normalRoom.id);
  const rotatedTriangle = rotatedRooms.find((room) => room.id === rotatedPresetTriangle.id);
  ok(
    "auto door placement recovers when a triangle was rotated 15 degrees in the inspector",
    Boolean(rotatedAutoPlacement?.aligned && rotatedNormal && rotatedTriangle && sharedEdge(rotatedTriangle, rotatedNormal)),
    rotatedTriangle ? `center=${rotatedTriangle.center.map((value) => value.toFixed(2)).join(",")} rot=${(rotatedTriangle.shape?.rotation ?? 0).toFixed(3)}` : "no triangle",
  );

  const belowPresetTriangle = {
    id: "room_below_preset_tri",
    label: "下方三角房",
    style: "maintenance",
    center: [0, 5.2],
    size: shapeBboxSize({ kind: "polygon", points: trianglePreset.points }),
    shape: { kind: "polygon", points: trianglePreset.points },
  };
  const belowAutoProject = { ...createStarterProject(), rooms: [normalRoom, belowPresetTriangle], doors: [], props: [], robots: [], exitRoomId: belowPresetTriangle.id };
  const belowAutoPlacement = findAutoDoorPlacement(belowAutoProject, belowPresetTriangle.id);
  const belowRooms = belowAutoPlacement?.project.rooms ?? [];
  const belowNormal = belowRooms.find((room) => room.id === normalRoom.id);
  const belowTriangle = belowRooms.find((room) => room.id === belowPresetTriangle.id);
  const belowEdge = belowNormal && belowTriangle ? sharedEdge(belowTriangle, belowNormal) : null;
  ok(
    "auto door placement connects a default triangle below a rectangle by its flat wall, not its apex",
    Boolean(belowAutoPlacement?.aligned && belowEdge && Math.abs(Math.sin(belowEdge.yaw)) < 0.01),
    belowEdge ? `yaw=${belowEdge.yaw.toFixed(3)} center=${belowTriangle.center.map((value) => value.toFixed(2)).join(",")}` : "no edge",
  );

  // 3. polygon wall generation + door carving on room A.
  const segs = level ? createRoomWallSegments(level, (r) => r.id === "room_a") : [];
  const yawed = segs.filter((s) => s.yaw !== undefined);
  const anyDiagonal = yawed.some((s) => Math.abs(Math.cos(s.yaw)) > 0.3 && Math.abs(Math.sin(s.yaw)) > 0.3);
  ok("room A walls are polygon (yaw-tagged) segments", yawed.length === segs.length && segs.length > 0, `segs=${segs.length}`);
  ok("a wall segment runs along the diagonal", anyDiagonal);
  // The 3-edge triangle splits its diagonal into 2 runs around the door → 4 segments.
  ok("door opening carved into the diagonal wall (4 runs)", segs.length === 4, `segs=${segs.length}`);

  // 4. OBB collision pushes a circle out of a 45°-rotated thin wall.
  const center = { x: 0, y: 0, z: 0 };
  const half = { x: 4, y: 1.3, z: 0.2 }; // long thin wall, local X = length
  const yaw = Math.PI / 4;
  const nrm = { x: -Math.sin(yaw), z: Math.cos(yaw) }; // wall normal
  const pos = { x: nrm.x * 0.1, y: 0, z: nrm.z * 0.1 }; // 0.1m inside, along normal
  const hit = resolveCircleObb(pos, 0.4, center, half, yaw);
  const perpAfter = pos.x * nrm.x + pos.z * nrm.z; // distance along normal after resolve
  ok("OBB collision pushes a circle clear of an angled wall", hit && perpAfter >= half.z + 0.4 - 1e-3, `perpAfter=${perpAfter.toFixed(3)}`);

  // 5. OBB at a cardinal yaw matches plain AABB (regression guard).
  const pAabb = { x: 0.05, y: 0, z: 0 };
  const pObb = { x: 0.05, y: 0, z: 0 };
  resolveCircleAabb(pAabb, 0.4, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0.3 });
  resolveCircleObb(pObb, 0.4, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0.3 }, 0);
  ok("OBB at yaw=0 equals AABB", Math.abs(pAabb.x - pObb.x) < 1e-6 && Math.abs(pAabb.z - pObb.z) < 1e-6);

  // 6. GeometryWriter.pushBoxYaw emits an oriented (diagonal-normal) box.
  const gw = new GeometryWriter();
  gw.beginAsset("t");
  gw.pushBoxYaw(0, 1, 0, 4, 2, 0.3, Math.PI / 4, 0);
  gw.endAsset();
  const tbuf = new Float32Array(gw.finish());
  let diagNormal = false;
  for (let v = 0; v < tbuf.length; v += FPV) {
    if (Math.abs(tbuf[v + 3]) > 0.3 && Math.abs(tbuf[v + 5]) > 0.3) { diagNormal = true; break; }
  }
  ok("GeometryWriter.pushBoxYaw produces an angled box", diagNormal);

  // 7. Deep-bake of the shaped room → real triangulated floor + oriented walls (not a box).
  const pack = level ? compileBuilderRuntimePack(level, project) : null;
  const assets = pack?.renderPlan?.geometry?.assets ?? [];
  const wallsAsset = assets.find((a) => a.modelKey === "builder:walls:room_a");
  const floorAsset = assets.find((a) => a.modelKey === "builder:floor:room_a");
  ok("baked shaped walls asset is ready", wallsAsset?.status === "ready" && wallsAsset.vertexCount > 0, `verts=${wallsAsset?.vertexCount ?? 0}`);
  ok("baked shaped floor asset is ready", floorAsset?.status === "ready" && floorAsset.vertexCount > 0, `verts=${floorAsset?.vertexCount ?? 0}`);
  const gbuf = pack ? new Float32Array(pack.geometryBuffer) : new Float32Array();
  let wallDiag = false;
  if (wallsAsset) {
    const startF = wallsAsset.vertexOffset * FPV;
    const endF = startF + wallsAsset.vertexCount * FPV;
    for (let v = startF; v < endF; v += FPV) {
      if (Math.abs(gbuf[v + 3]) > 0.3 && Math.abs(gbuf[v + 5]) > 0.3) { wallDiag = true; break; }
    }
  }
  ok("baked shaped walls run along the diagonal (not a bounding box)", wallDiag);

  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
} finally {
  await server.close();
}
process.exit(failures === 0 ? 0 : 1);
