// Deterministic proof that a builder project's exit reuses the unified
// service-elevator (闭馆电梯) room + door kit. The authoritative in-world exit
// room is one baked GLB stage; split shell/button/shaft props remain fallback
// resources that stay unified with the shared exit reference.
// Run: node scripts/qa/builder-exit-elevator-check.mjs
import fs from "node:fs";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });
let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

try {
  const { compileBuilderProjectToLevel } = await server.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts");
  const { compileBuilderRuntimePack } = await server.ssrLoadModule("/src/build/runtime-pack/compileBuilderRuntimePack.ts");
  const { builderRuntimeAssetIndexForProject } = await server.ssrLoadModule("/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts");
  const { RawRoomRuntime } = await server.ssrLoadModule("/src/render/raw-webgpu/RawRoomRuntime.ts");

  // A puzzle-locked exit shell: hall → exit room gated by an archive_merge cabinet.
  const project = {
    schemaVersion: "hp.builder.v1",
    projectId: "proj_exit_elevator_check",
    title: "出口电梯校验",
    rooms: [
      { id: "room_spawn", label: "出生实验间", style: "sterile", center: [0, 10], size: [10, 6] },
      { id: "room_hall", label: "监控走廊", style: "hazard", center: [0, 3], size: [8, 8] },
      { id: "room_exit", label: "撤离电梯", style: "exit", center: [0, -3.5], size: [6, 5] },
    ],
    doors: [
      { id: "door_a", fromRoomId: "room_spawn", toRoomId: "room_hall", lockType: "none" },
      { id: "door_b", fromRoomId: "room_hall", toRoomId: "room_exit", lockType: "puzzle_complete", puzzleKind: "archive_merge", puzzleRoomId: "room_hall" },
    ],
    puzzles: [{ id: "pz_archive_qa", kind: "archive_merge", linkedDoorId: "door_b", roomId: "room_hall", position: [0, 3], rotationY: 0 }],
    props: [],
    robots: [],
    exitRoomId: "room_exit",
  };

  const { level, issues } = compileBuilderProjectToLevel(project);
  check(Boolean(level), "builder project compiles to a level", issues.map((i) => `${i.path}: ${i.message}`).join(" | ") || "no issues");

  if (level) {
    const exitRoom = level.map.rooms.find((room) => room.id === "room_exit");
    check(JSON.stringify(exitRoom?.bounds?.size) === JSON.stringify([6.4, 4, 5.4]), "exit room size = shared service elevator room", JSON.stringify(exitRoom?.bounds?.size));
    check(exitRoom?.skinKey === "service_elevator_hero", "exit room skin = service_elevator_hero", exitRoom?.skinKey);
    check(exitRoom?.floorMaterialKey === "service_elevator_metal", "exit room floor = service_elevator_metal", exitRoom?.floorMaterialKey);
    check(exitRoom?.wallMaterialKey === "service_elevator_metal", "exit room wall = service_elevator_metal", exitRoom?.wallMaterialKey);
    check(exitRoom?.aesthetic?.style === "exit" && exitRoom?.aesthetic?.detail === "high", "exit room aesthetic = exit/high", JSON.stringify(exitRoom?.aesthetic));
    check(exitRoom?.geometry?.renderWalls === false, "exit room uses prop-owned elevator shell", String(exitRoom?.geometry?.renderWalls));
    check(exitRoom?.geometry?.accentColor === "#f3f0df", "exit room bright reveal accent", exitRoom?.geometry?.accentColor);

    const exitDoor = level.map.doors.find((door) => door.toRoomId === "room_exit" || door.fromRoomId === "room_exit");
    check(exitDoor?.skinKey === "service_elevator_hero", "exit door skinKey = service_elevator_hero", exitDoor?.skinKey);
    check(exitDoor?.visualKey === "service_elevator_door", "exit door visualKey = service_elevator_door", exitDoor?.visualKey);
    check(exitDoor?.materialKey === "service_elevator_metal", "exit door materialKey = service_elevator_metal", exitDoor?.materialKey);
    check(exitDoor?.openSpeed === 1.35, "exit door lifts slowly (openSpeed 1.35)", String(exitDoor?.openSpeed));
    check(Boolean(exitDoor?.cameraImpact), "exit door nudges camera on state change", JSON.stringify(exitDoor?.cameraImpact));

    const exitInteraction = level.map.interactions.find((it) => it.type === "exit");
    check(exitInteraction?.visualKey === "service_elevator_panel", "exit panel = service_elevator_panel", exitInteraction?.visualKey);
    check(exitInteraction?.materialKey === "terminal_cyan", "exit panel material = terminal_cyan", exitInteraction?.materialKey);
    check(exitInteraction?.opensDoorId === exitDoor?.id, "exit panel associates with the elevator door", `${exitInteraction?.opensDoorId} == ${exitDoor?.id}`);

    const cinematic = level.exit.cinematic;
    check(cinematic?.type === "elevator_walk_in", "exit uses old elevator walk-in cinematic", cinematic?.type);
    check(cinematic?.duration === 9.65, "exit cinematic duration = official cinematic ascent ride", String(cinematic?.duration));
    check(cinematic?.buttonPressDuration === 1.15, "exit cinematic has a crisp physical button press", String(cinematic?.buttonPressDuration));
    check(cinematic?.ascentDuration === 4.8, "exit cinematic keeps a 4.8s elevator ascent after the button press", String(cinematic?.ascentDuration));
    check(cinematic?.whiteOutTime >= cinematic?.ascentStartTime + cinematic?.ascentDuration, "exit cinematic whiteout waits until the ascent ride finishes", JSON.stringify(cinematic));
    check(cinematic?.doorId === exitDoor?.id, "exit cinematic closes the elevator door", `${cinematic?.doorId} == ${exitDoor?.id}`);
    check(Array.isArray(cinematic?.enterPosition), "exit cinematic enters the empty elevator room", JSON.stringify(cinematic?.enterPosition));
    const doorToCenterLength = Math.hypot(exitDoor.position[0] - exitRoom.bounds.center[0], exitDoor.position[2] - exitRoom.bounds.center[2]);
    const doorForwardX = doorToCenterLength > 0.001 ? (exitDoor.position[0] - exitRoom.bounds.center[0]) / doorToCenterLength : Math.sin(exitDoor.yaw ?? 0);
    const doorForwardZ = doorToCenterLength > 0.001 ? (exitDoor.position[2] - exitRoom.bounds.center[2]) / doorToCenterLength : Math.cos(exitDoor.yaw ?? 0);
    const cinematicForwardOffset =
      (cinematic?.enterPosition?.[0] ?? 0) * doorForwardX +
      (cinematic?.enterPosition?.[2] ?? 0) * doorForwardZ -
      (exitRoom.bounds.center[0] * doorForwardX + exitRoom.bounds.center[2] * doorForwardZ);
    check(
      cinematicForwardOffset > 0.2 && cinematicForwardOffset < 0.65,
      "exit cinematic stops near the cabin center/front instead of rushing the back wall",
      String(cinematicForwardOffset),
    );
    const exitProps = level.map.props.filter((prop) => prop.roomId === "room_exit");
    const exitPropKeys = exitProps.map((prop) => prop.modelKey).sort();
    check(exitProps.length === 5, "test exit room uses real authoritative stage plus fallback shell/button/shaft kit", `${exitProps.length} props`);
    check(exitPropKeys.includes("service_elevator_exit_stage"), "exit prefab includes the baked in-world elevator stage", exitPropKeys.join(", "));
    check(exitPropKeys.includes("service_elevator_interior_shell"), "exit prefab includes static elevator interior shell", exitPropKeys.join(", "));
    check(exitPropKeys.includes("door_threshold_service_elevator"), "exit prefab includes service elevator threshold", exitPropKeys.join(", "));
    check(exitPropKeys.includes("service_elevator_call_buttons"), "exit prefab includes single physical service elevator call button", exitPropKeys.join(", "));
    check(exitPropKeys.includes("service_elevator_ascent_shaft_fx"), "exit prefab includes atlas-free ascent shaft FX", exitPropKeys.join(", "));
    check(!exitPropKeys.includes("terminal_code_keypad"), "exit prefab does not overlay a keypad on baked buttons", exitPropKeys.join(", "));
    check(!exitPropKeys.includes("switch_panel_wall_cyan"), "exit prefab does not overlay a wall switch on baked buttons", exitPropKeys.join(", "));
    check(exitProps.filter((prop) => prop.modelKey === "room_wall_wash_light_museum").length === 0, "exit prefab no longer includes door-like wall wash boxes", exitPropKeys.join(", "));
    check(exitProps.filter((prop) => prop.modelKey === "room_ceiling_strip_light").length === 0, "exit prefab does not include proxy-prone ceiling strip lights", exitPropKeys.join(", "));
    const expectedButtonYaw =
      cinematic?.lookAtPosition && cinematic?.enterPosition
        ? Math.atan2(cinematic.lookAtPosition[0] - cinematic.enterPosition[0], -(cinematic.lookAtPosition[2] - cinematic.enterPosition[2]))
        : null;
    check(
      expectedButtonYaw !== null && Math.abs(angleDelta(cinematic?.faceYaw ?? 0, expectedButtonYaw)) < 0.05,
      "cinematic faces the side-wall button panel, not the door",
      JSON.stringify({ faceYaw: cinematic?.faceYaw, expectedButtonYaw }),
    );

    const assetIndex = builderRuntimeAssetIndexForProject(level, project);
    const assetByKey = new Map(assetIndex.map((entry) => [entry.modelKey, entry]));
    for (const key of ["service_elevator_exit_stage", "service_elevator_interior_shell", "door_threshold_service_elevator", "service_elevator_call_buttons", "service_elevator_ascent_shaft_fx"]) {
      check(Boolean(assetByKey.get(key)?.glbUrl), `deep asset index maps ${key} to a real GLB`, assetByKey.get(key)?.glbUrl ?? "missing");
    }

    const shellGlb = glbSummary("src/assets/models-cooked/environment/shells/hp_service_elevator_interior_shell.glb");
    const stageGlb = glbSummary("src/assets/models-cooked/environment/shells/hp_service_elevator_exit_stage.glb");
    const buttonGlb = glbSummary("src/assets/models-cooked/environment/shells/hp_service_elevator_call_buttons.glb");
    const shaftGlb = glbSummary("src/assets/models-cooked/environment/shells/hp_service_elevator_ascent_shaft_fx.glb");
    const shellNodes = shellGlb.nodeNames;
    const stageNodes = stageGlb.nodeNames;
    const buttonNodes = buttonGlb.nodeNames;
    const shaftNodes = shaftGlb.nodeNames;
    for (const [label, summary] of [
      ["stage", stageGlb],
      ["shell", shellGlb],
      ["button", buttonGlb],
      ["shaft", shaftGlb],
    ]) {
      check(summary.images.length === 0, `${label} GLB embeds no atlas/image textures`, summary.images.join(", "));
      check(summary.texturedMaterials.length === 0, `${label} GLB has no baseColorTexture material slots`, summary.texturedMaterials.join(", "));
      check(summary.forbiddenNames.length === 0, `${label} GLB has no atlas/image2 names`, summary.forbiddenNames.join(", "));
    }
    for (const [label, summary] of [
      ["stage", stageGlb],
      ["shell", shellGlb],
      ["button", buttonGlb],
      ["shaft", shaftGlb],
    ]) {
      check(
        saturatedCinematicAccentMaterials(summary).length === 0,
        `${label} GLB avoids high-saturation game-UI cyan/gold accents`,
        saturatedCinematicAccentMaterials(summary)
          .map((material) => `${material.name}:${JSON.stringify({ base: material.baseColorFactor, emissive: material.emissiveFactor })}`)
          .join(", "),
      );
    }
    check(shellNodes.some((name) => /floor_(?:grate_panel|diamond_plate_panel)/i.test(name)), "shell GLB has modeled metal floor panels", "");
    check(shellNodes.some((name) => /ceiling_metal_panel/i.test(name)), "shell GLB has modeled ceiling metal panel", "");
    check(shellNodes.some((name) => /back_blank_brushed_metal_wall/i.test(name)), "shell GLB back wall is a quiet brushed metal surface", "");
    check(shellNodes.some((name) => /subtle_brushed_metal_line/i.test(name)), "shell GLB adds subtle modeled brushed-metal wall lines", "");
    check(shellNodes.some((name) => /cool_brushed_side_glint/i.test(name)), "shell GLB adds cool brushed-metal glints so the room does not read as flat black", "");
    check(
      !shellNodes.some((name) => /back_(?:left|right)_panel|back_center_glass_seam|back_cyan_vertical|back_amber_status/i.test(name)),
      "shell GLB does not restore poster-like back-wall decoration",
      shellNodes.filter((name) => /back_(?:left|right)_panel|back_center_glass_seam|back_cyan_vertical|back_amber_status/i.test(name)).join(", "),
    );
    const disallowedFrontNodes = shellNodes.filter((name) => /front/i.test(name) && !/gasket|rib|lintel/i.test(name));
    check(disallowedFrontNodes.length === 0, "shell GLB keeps the entry face open except threshold/ribs/lintel", disallowedFrontNodes.join(", "));
    check(stageNodes.some((name) => /stage_shaft_service_elevator_ascent_shaft_/i.test(name)), "stage GLB contains authored ascent shaft layer for cinematic reveal", "");
    check(shaftNodes.some((name) => /static_depth_frame/i.test(name)), "ascent shaft has static depth-frame metal geometry", "");
    check(shaftNodes.some((name) => /static_close_metal_louver/i.test(name)), "ascent shaft has close metal louvers for parallax depth", "");
    check(shaftNodes.some((name) => /moving_crossbeam_near_high/i.test(name)), "ascent shaft has moving near crossbeam geometry", "");
    check(shaftNodes.some((name) => /moving_shadow_louver/i.test(name)), "ascent shaft has moving dark louvers instead of relying on light strips", "");
    check(shaftNodes.some((name) => /moving_scan_band/i.test(name)), "ascent shaft has moving cinematic scan bands", "");
    check(buttonNodes.some((name) => /service_elevator_call_button_plunger_face/i.test(name)), "button GLB has a named physical plunger face", "");
    check(buttonNodes.some((name) => /plunger_metal_concentric_ring/i.test(name)), "button GLB has concentric machined metal detail, not a plain white disk", "");
    check(buttonGlb.materials.some((material) => /smoked_brushed_metal_face/i.test(material.name)), "button GLB plunger face uses smoked brushed metal material", "");
    check(buttonNodes.some((name) => /machined_tick/i.test(name)), "button GLB has small machined ticks to break up the target-like disk silhouette", "");
    check(buttonNodes.some((name) => /brushed_service_plate/i.test(name)), "button GLB has a brushed service plate with calibration notches", "");
    check(buttonNodes.some((name) => /service_elevator_call_button_glass_ring/i.test(name)), "button GLB has a named animated glass ring", "");
    check(!buttonNodes.some((name) => /visible_spring/i.test(name)), "button GLB has no visible spring rods under the main button", buttonNodes.filter((name) => /visible_spring/i.test(name)).join(", "));
    check(!stageNodes.some((name) => /stage_button_.*visible_spring/i.test(name)), "stage GLB has no visible spring rods under the main button", stageNodes.filter((name) => /visible_spring/i.test(name)).join(", "));
    check(!stageNodes.some((name) => /fog/i.test(name)), "stage GLB has no broad fog planes", "");
    check(!shaftNodes.some((name) => /fog/i.test(name)), "ascent shaft GLB has no broad fog planes", "");

    const rawElevatorMaterials = rawPlanMaterialRows("level_03_human_museum", /^hp_elevator_/i);
    const rawPaletteLeaks = rawElevatorMaterials.filter((material) => (material.paletteColorFactor?.[3] ?? 0) > 0.001);
    const rawOpaqueGlass = rawElevatorMaterials.find((material) => material.name === "hp_elevator_opaque_smoked_glass_pbr");
    const rawStageGeometry = rawPlanGeometryAsset("level_03_human_museum", "service_elevator_exit_stage");
    const rawStageFloorChunks = rawStageGeometry?.nodeChunks?.filter((chunk) => /floor|herringbone|slotted|grate/i.test(chunk.nodeName ?? "")) ?? [];
    const rawStageButtonSpringChunks = rawStageGeometry?.nodeChunks?.filter((chunk) => /visible_spring/i.test(chunk.nodeName ?? "")) ?? [];
    const rawStageFloorMaterialNames = rawChunkMaterialNames("level_03_human_museum", rawStageFloorChunks);
    const rawInteractionGlowLeaks = rawElevatorMaterials.filter(
      (material) =>
        material.category === "interaction" &&
        /button_deep_socket|dim_burnished_edge|button_visible_spring|brushed_champagne_trim/i.test(material.name ?? "") &&
        /cyan_emissive|switch_active|switch_inactive/i.test(material.visualRole ?? ""),
    );
    check(rawElevatorMaterials.length >= 24, "raw render plan includes the full service-elevator material family", `${rawElevatorMaterials.length} materials`);
    check(rawStageGeometry?.nodeChunks?.length >= 180, "raw render plan keeps the full baked exit-stage node-chunk set", `${rawStageGeometry?.nodeChunks?.length ?? 0} chunks`);
    check(rawStageButtonSpringChunks.length === 0, "raw render plan has no visible spring rods under the main button", rawStageButtonSpringChunks.map((chunk) => chunk.nodeName).join(", "));
    check(rawStageFloorChunks.length >= 40, "raw render plan keeps authored service-elevator floor line geometry", `${rawStageFloorChunks.length} floor/detail chunks`);
    check(
      ["hp_elevator_floor_blackened_steel_pbr", "hp_elevator_floor_polished_worn_edge_pbr", "hp_elevator_deep_black_anodized_pbr", "hp_elevator_graphite_microbrushed_pbr"].every((name) =>
        rawStageFloorMaterialNames.includes(name),
      ),
      "raw render plan maps elevator floor chunks to authored black-steel/polished-edge materials",
      rawStageFloorMaterialNames.join(", "),
    );
    check(rawPaletteLeaks.length === 0, "raw render plan preserves authored elevator colors without museum/gameplay palette wash", rawPaletteLeaks.map((material) => `${material.name}:${material.paletteColorFactor?.join(",")}`).join(" | "));
    check(
      Boolean(rawOpaqueGlass) &&
        rawOpaqueGlass.baseColorFactor?.[0] < 0.08 &&
        rawOpaqueGlass.baseColorFactor?.[1] < 0.10 &&
        rawOpaqueGlass.baseColorFactor?.[2] < 0.11 &&
        rawOpaqueGlass.roughnessFactor < 0.35,
      "raw render plan keeps opaque smoked elevator glass dark/polished, not the museum grey glass fallback",
      JSON.stringify(rawOpaqueGlass ? rawMaterialAudit(rawOpaqueGlass) : null),
    );
    check(
      rawInteractionGlowLeaks.length === 0,
      "raw render plan does not classify non-emissive elevator button metals as cyan/switch gameplay UI",
      rawInteractionGlowLeaks.map((material) => `${material.category}:${material.name}:${material.visualRole}`).join(" | "),
    );

    const runtimePack = compileBuilderRuntimePack(level, project, { assetIndex });
    const exitDoorLeaf = runtimePack.renderPlan.instances.find((entry) => entry.role === "door_leaf" && entry.state?.doorId === exitDoor?.id);
    check(Boolean(exitDoorLeaf), "runtime exit elevator has a solid closed door leaf (blocks until unlocked, not a hollow frame)", JSON.stringify(exitDoorLeaf?.state));
    check(exitDoorLeaf?.state?.openAnimation?.type === "vertical_lift", "exit door leaf lifts open when unlocked", JSON.stringify(exitDoorLeaf?.state?.openAnimation));
    check(runtimePack.renderPlan.instances.some((entry) => entry.id === "prop_builder_exit_elevator_exit_stage"), "runtime exit elevator keeps baked in-world stage", "");
    check(runtimePack.renderPlan.instances.some((entry) => entry.id === "prop_builder_exit_elevator_interior_shell"), "runtime exit elevator keeps static interior walls", "");
    check(runtimePack.renderPlan.instances.some((entry) => entry.id === "prop_builder_exit_elevator_call_buttons"), "runtime exit elevator keeps single call button", "");
    check(runtimePack.renderPlan.instances.some((entry) => entry.id === "prop_builder_exit_elevator_ascent_shaft_fx"), "runtime exit elevator keeps ascent shaft FX", "");
    const fastStage = runtimePack.renderPlan.instances.find((entry) => entry.id === "prop_builder_exit_elevator_exit_stage");
    const fastButton = runtimePack.renderPlan.instances.find((entry) => entry.id === "prop_builder_exit_elevator_call_buttons");
    check(
      fastStage?.modelKey === "builder:prop:service_elevator_exit_stage" &&
        JSON.stringify(fastStage?.estimatedBounds?.halfSize) === JSON.stringify([3.15, 1.95, 2.5]),
      "fast/proxy fallback for exit stage stays elevator-sized, not the generic white cube",
      JSON.stringify({ modelKey: fastStage?.modelKey, halfSize: fastStage?.estimatedBounds?.halfSize }),
    );
    check(
      fastButton?.modelKey === "builder:prop:service_elevator_call_buttons" &&
        JSON.stringify(fastButton?.estimatedBounds?.halfSize) === JSON.stringify([0.41, 0.54, 0.08]),
      "fast/proxy fallback for call buttons stays small, not the generic white cube",
      JSON.stringify({ modelKey: fastButton?.modelKey, halfSize: fastButton?.estimatedBounds?.halfSize }),
    );
    check(!runtimePack.renderPlan.instances.some((entry) => entry.id.includes("button_panel")), "runtime exit elevator does not overlay the legacy large button panel", "");
    check(!runtimePack.renderPlan.instances.some((entry) => entry.id === `exit_${exitInteraction?.id}` || entry.id === `exit_panel_${exitInteraction?.id}`), "runtime exit interaction stays trigger-only", "");

    const cookedModels = new Map([
      ["service_elevator_exit_stage", cookedTriangleModel("service_elevator_exit_stage", [6.3, 3.9, 5.0])],
      ["service_elevator_call_buttons", cookedTriangleModel("service_elevator_call_buttons", [0.82, 1.08, 0.16])],
      ["service_elevator_ascent_shaft_fx", cookedTriangleModel("service_elevator_ascent_shaft_fx", [6.2, 3.9, 4.2])],
      ["service_elevator_interior_shell", cookedTriangleModel("service_elevator_interior_shell", [6.1, 3.3, 5.0])],
      ["door_threshold_service_elevator", cookedTriangleModel("door_threshold_service_elevator", [4.5, 0.22, 0.74])],
    ]);
    const deepPack = compileBuilderRuntimePack(level, project, {
      assetIndex,
      cooked: { models: cookedModels, missing: [], geometryBytes: 10 * 3 * 4 * cookedModels.size, textureFallbackModels: [] },
    });
    const deepButton = deepPack.renderPlan.instances.find((entry) => entry.id === "prop_builder_exit_elevator_call_buttons");
    const deepShaft = deepPack.renderPlan.instances.find((entry) => entry.id === "prop_builder_exit_elevator_ascent_shaft_fx");
    const deepShell = deepPack.renderPlan.instances.find((entry) => entry.id === "prop_builder_exit_elevator_interior_shell");
    const deepStage = deepPack.renderPlan.instances.find((entry) => entry.id === "prop_builder_exit_elevator_exit_stage");
    check(deepStage?.modelKey === "service_elevator_exit_stage", "deep exit stage renders the cooked GLB, not a proxy", deepStage?.modelKey);
    check(deepButton?.modelKey === "service_elevator_call_buttons", "deep exit call buttons render the cooked GLB, not a proxy", deepButton?.modelKey);
    check(deepShaft?.modelKey === "service_elevator_ascent_shaft_fx", "deep exit ascent shaft renders the cooked GLB, not a proxy", deepShaft?.modelKey);
    check(deepShell?.modelKey === "service_elevator_interior_shell", "deep exit interior shell renders the cooked GLB, not a proxy", deepShell?.modelKey);
    check(!deepPack.manifest.fallbackProxyModels.includes("service_elevator_exit_stage"), "deep manifest does not report exit stage as proxy fallback", deepPack.manifest.fallbackProxyModels.join(", "));
    check(!deepPack.manifest.fallbackProxyModels.includes("service_elevator_call_buttons"), "deep manifest does not report call button as proxy fallback", deepPack.manifest.fallbackProxyModels.join(", "));
    check(!deepPack.manifest.fallbackProxyModels.includes("service_elevator_ascent_shaft_fx"), "deep manifest does not report ascent shaft as proxy fallback", deepPack.manifest.fallbackProxyModels.join(", "));

    const syntheticRuntime = new RawRoomRuntime({
      level: { id: "synthetic_non_level3_exit_room" },
      rooms: [
        { id: "starter_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } },
        { id: "shared_exit_room", skinKey: "service_elevator_hero", bounds: { center: [0, 0, -8], size: [6.4, 4, 5.4] } },
      ],
      instances: [
        {
          id: "stage",
          modelKey: "service_elevator_exit_stage",
          roomId: "shared_exit_room",
          role: "prop",
          tags: ["exit_room_stage"],
          position: [0, 0, -8],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          localOffset: [0, 0, 0],
          estimatedBounds: { center: [0, 0, -8], halfSize: [3.15, 1.95, 2.5] },
          visibility: { type: "always" },
          state: null,
        },
      ],
      visibilityScenarios: [{ currentRoomId: "shared_exit_room", qualityTier: "high", visibleRoomIds: ["shared_exit_room"], visibleDoorIds: [], selectedLights: [] }],
    });
    const syntheticFrame = syntheticRuntime.frame({
      renderPerformance: { quality: { tier: "high" } },
      session: {
        mode: "playing",
        activeFocusReveal: null,
        mapProgress: { currentRoomId: "shared_exit_room", openedDoorIds: [], collectedKeyItemIds: [], completedInteractionIds: [] },
      },
      player: { position: { x: 0, y: 0, z: -8 } },
      level: { map: { keyItems: [] } },
      pickups: [],
      isDoorOpen: () => false,
      isConfiguredKeyItemAvailable: () => true,
    });
    check(
      syntheticFrame.lightingProfile.artist.contrast >= 1.3 &&
        syntheticFrame.lightingProfile.bounce.ceiling < 0.14 &&
        syntheticFrame.lightingProfile.algorithm.probe < 0.32,
      "service-elevator Raw look is keyed by the shared exit room, not by a Level 3 branch",
      JSON.stringify(syntheticFrame.lightingProfile),
    );
  }
} finally {
  await server.close();
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);

function cookedTriangleModel(modelKey, size) {
  const vertices = new Float32Array(10 * 3);
  vertices.set([0, 0, 0, 0, 1, 0, 0, 0, 0, -1], 0);
  vertices.set([size[0], 0, 0, 0, 1, 0, 1, 0, 0, -1], 10);
  vertices.set([0, size[1], 0, 0, 1, 0, 0, 1, 0, -1], 20);
  return {
    modelKey,
    vertices,
    vertexCount: 3,
    triangleCount: 1,
    materials: [
      {
        name: `qa_${modelKey}`,
        baseColorFactor: [0.35, 0.48, 0.52, 1],
        emissiveFactor: [0.02, 0.12, 0.16],
        emissiveStrength: 0.5,
        roughnessFactor: 0.48,
        metallicFactor: 0.45,
        alphaMode: "OPAQUE",
        doubleSided: true,
      },
    ],
    images: [],
    bounds: { min: [0, 0, 0], center: [size[0] / 2, size[1] / 2, size[2] / 2], size },
    warnings: [],
  };
}

function glbSummary(filePath) {
  const buffer = fs.readFileSync(filePath);
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  const materialNames = (json.materials ?? []).map((material, index) => material.name ?? `material_${index}`);
  const materials = (json.materials ?? []).map((material, index) => ({
    name: material.name ?? `material_${index}`,
    baseColorFactor: material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1],
    emissiveFactor: material.emissiveFactor ?? [0, 0, 0],
  }));
  const nodeNames = (json.nodes ?? []).map((node) => node.name ?? "");
  const images = (json.images ?? []).map((image) => image.name ?? image.uri ?? "embedded");
  const texturedMaterials = (json.materials ?? [])
    .filter((material) => Boolean(material.pbrMetallicRoughness?.baseColorTexture))
    .map((material, index) => material.name ?? `material_${index}`);
  const forbiddenNames = [...images, ...materialNames, ...nodeNames].filter((name) => /atlas|image2/i.test(name));
  return { materialNames, materials, nodeNames, images, texturedMaterials, forbiddenNames };
}

function saturatedCinematicAccentMaterials(summary) {
  return summary.materials.filter((material) => {
    const name = material.name ?? "";
    if (!/(cyan|cold|amber|gold|button|shaft)/i.test(name)) return false;
    const base = material.baseColorFactor ?? [1, 1, 1, 1];
    const emissive = material.emissiveFactor ?? [0, 0, 0];
    const electricCyan = (base[1] > 0.78 || base[2] > 0.78 || emissive[1] > 0.62 || emissive[2] > 0.62) && base[0] < 0.35;
    const loudGold = (base[0] > 0.78 || emissive[0] > 0.78) && (base[1] > 0.38 || emissive[1] > 0.34);
    return electricCyan || loudGold;
  });
}

function rawPlanMaterialRows(levelId, namePattern) {
  const plan = rawPlanFor(levelId);
  return (plan.geometry?.materials ?? []).filter((material) => namePattern.test(material.name ?? ""));
}

function rawPlanGeometryAsset(levelId, modelKey) {
  const plan = rawPlanFor(levelId);
  return (plan.geometry?.assets ?? []).find((asset) => asset.modelKey === modelKey) ?? null;
}

function rawChunkMaterialNames(levelId, chunks) {
  const plan = rawPlanFor(levelId);
  const binaryFile = plan.geometry?.binaryFile;
  if (!binaryFile || chunks.length === 0) return [];
  const binaryPath = `src/assets/manifests/generated/raw-webgpu/${binaryFile.split("/").pop()}`;
  const buffer = fs.readFileSync(binaryPath);
  const floats = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
  const stride = plan.geometry?.vertexStrideFloats ?? 10;
  const materialNames = new Set();
  for (const chunk of chunks) {
    for (let vertex = 0; vertex < Math.min(chunk.vertexCount ?? 0, 36); vertex += 1) {
      const materialIndex = Math.round(floats[((chunk.vertexOffset ?? 0) + vertex) * stride + 8] ?? -1);
      const material = plan.geometry?.materials?.[materialIndex];
      if (material?.name) materialNames.add(material.name);
    }
  }
  return [...materialNames].sort();
}

function rawPlanFor(levelId) {
  const planPath = `src/assets/manifests/generated/raw-webgpu/render_plan_${levelId}.json`;
  return fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, "utf8")) : {};
}

function rawMaterialAudit(material) {
  return {
    name: material.name,
    category: material.category,
    visualRole: material.visualRole,
    baseColorFactor: material.baseColorFactor,
    roughnessFactor: material.roughnessFactor,
    metallicFactor: material.metallicFactor,
    paletteColorFactor: material.paletteColorFactor,
  };
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
