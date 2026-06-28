import { modelKeyForRawPuzzleTarget } from "./raw-webgpu-render-plan-rules.mjs";
import { clampNumber, toScaleVector } from "./raw-webgpu-plan-utils.mjs";

const serviceElevatorDoorKit = {
  archetype: "elevator_exit",
  doorModelKey: "door_service_elevator_inner_cyan",
  thresholdModelKey: "door_threshold_service_elevator",
  panelModelKey: "none",
  openAnimation: { type: "vertical_lift", axis: "y", distance: 3.25 },
};

export function addConfigDrivenInstances({
  addInstance,
  createRoomWallSegments,
  getEnvironmentModelAsset,
  isEnvironmentModelKey,
  level,
  map,
  modelKeyForDoor,
  modelKeyForInteraction,
  modelKeyForKeyVisual,
  modelKeyForPickupType,
  presentation,
  issues,
}) {
  addShellInstances({
    addInstance,
    createRoomWallSegments,
    getEnvironmentModelAsset,
    isEnvironmentModelKey,
    level,
    map,
    presentation,
  });
  addPropInstances({ addInstance, map, isEnvironmentModelKey, issues });
  addDecalInstances({ addInstance, map, isEnvironmentModelKey, issues });
  addPuzzleTargetInstances({ addInstance, level, issues });
  addDoorInstances({ addInstance, getEnvironmentModelAsset, map, modelKeyForDoor, presentation, issues });
  addKeyItemInstances({ addInstance, map, modelKeyForKeyVisual });
  addInteractionInstances({ addInstance, map, modelKeyForInteraction });
  addPickupInstances({ addInstance, map, modelKeyForPickupType });
  addStoryPickupSeedInstances({ addInstance, level, map, modelKeyForPickupType });
}

function propSuppressesShell(prop, surface) {
  const tags = new Set(prop.tags ?? []);
  if (
    tags.has("shell_asset") ||
    tags.has("full_room_shell") ||
    tags.has(`${surface}_shell_asset`) ||
    tags.has(`full_room_${surface}_asset`) ||
    tags.has(`replaces_${surface}_shell`)
  ) {
    return true;
  }
  if (!tags.has(`${surface}_asset`)) return false;

  const modelKey = String(prop.modelKey ?? "");
  if (surface === "floor") return /^room_floor_tile_/.test(modelKey);
  if (surface === "wall") return /^room_wall_panel_/.test(modelKey);
  if (surface === "ceiling") return /^room_ceiling_panel_/.test(modelKey);
  return false;
}

function addShellInstances({
  addInstance,
  createRoomWallSegments,
  getEnvironmentModelAsset,
  isEnvironmentModelKey,
  level,
  map,
  presentation,
}) {
  const shellKit = presentation?.shell ?? null;
  const wallSegments = createRoomWallSegments(level, (room) => Boolean(room.geometry?.renderWalls));

  for (const room of map.rooms) {
    const shell = roomShellKeys(room, shellKit, isEnvironmentModelKey);
    const props = map.props ?? [];
    const hasFloorAsset = props.some((prop) => prop.initiallyVisible !== false && prop.roomId === room.id && propSuppressesShell(prop, "floor"));
    const hasWallAsset = props.some((prop) => prop.initiallyVisible !== false && prop.roomId === room.id && propSuppressesShell(prop, "wall"));
    const hasCeilingAsset = props.some((prop) => prop.initiallyVisible !== false && prop.roomId === room.id && propSuppressesShell(prop, "ceiling"));

    if (room.geometry?.renderFloor && !hasFloorAsset) {
      const floorRenderMode = shellKit?.floorRenderMode ?? "model_tiles";
      if (floorRenderMode === "model_single") {
        addSingleFloor(addInstance, room, shell.floor);
      } else {
        addFloorTiles(addInstance, room, shell.floor);
      }
    }

    if (room.geometry?.renderWalls && !hasWallAsset) {
      const roomSegments = wallSegments.filter((segment) => segment.roomId === room.id);
      addWallSegments(addInstance, roomSegments, shell.wall, getEnvironmentModelAsset);
      addCornerPillars(addInstance, room, shell.pillar);
      addWallWashLights(addInstance, room, shell.wallWash);
    }

    if (room.geometry?.renderFloor !== false && room.geometry?.renderCeiling !== false && !hasCeilingAsset) {
      if ((shellKit?.ceilingRenderMode ?? "model_panel") === "model_panel") {
        addCeilingPanel(addInstance, room, shell.ceiling);
      } else {
        addCeilingPanel(addInstance, room, shell.ceiling);
      }
    }
  }
}

function addSingleFloor(addInstance, room, modelKey) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  addInstance({
    id: `shell:${room.id}:floor:single-image2`,
    source: "shell",
    role: "floor",
    roomId: room.id,
    modelKey,
    position: [cx, -0.015, cz],
    rotation: [0, 0, 0],
    scale: [Math.max(0.25, sx / 4.34), 1.02, Math.max(0.25, sz / 3.09)],
    castShadow: false,
    receiveShadow: true,
    visibility: { type: "room" },
  });
}

function addFloorTiles(addInstance, room, modelKey) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const tileWidth = 4.8;
  const tileDepth = 3.25;
  const xCount = Math.max(2, Math.ceil(sx / tileWidth));
  const zCount = Math.max(2, Math.ceil(sz / tileDepth));
  for (let zIndex = 0; zIndex < zCount; zIndex += 1) {
    for (let xIndex = 0; xIndex < xCount; xIndex += 1) {
      addInstance({
        id: `shell:${room.id}:floor:${xIndex}:${zIndex}`,
        source: "shell",
        role: "floor",
        roomId: room.id,
        modelKey,
        position: [
          cx - ((xCount - 1) * tileWidth) / 2 + xIndex * tileWidth,
          -0.015,
          cz - ((zCount - 1) * tileDepth) / 2 + zIndex * tileDepth,
        ],
        rotation: [0, ((xIndex + zIndex) % 2) * Math.PI, 0],
        scale: [1.52, 1.02, 1.48],
        castShadow: false,
        receiveShadow: true,
        visibility: { type: "room" },
      });
    }
  }
}

function addCeilingPanel(addInstance, room, modelKey) {
  const [cx, , cz] = room.bounds.center;
  const [sx, sy, sz] = room.bounds.size;
  addInstance({
    id: `shell:${room.id}:ceiling-panel`,
    source: "shell",
    role: "ceiling",
    roomId: room.id,
    modelKey,
    position: [cx, Math.max(2.85, sy - 0.35), cz],
    rotation: [0, 0, 0],
    scale: [Math.max(0.9, sx / 3.2), 1, Math.max(0.9, sz / 2.2)],
    castShadow: false,
    receiveShadow: true,
    visibility: { type: "room" },
  });
}

function addWallSegments(addInstance, segments, modelKey, getEnvironmentModelAsset) {
  const asset = getEnvironmentModelAsset(modelKey);
  const zUpWallPanel = asset.sizeMeters[2] > asset.sizeMeters[1] * 2.4;
  for (const segment of segments) {
    const horizontal = segment.side === "north" || segment.side === "south";
    const visibleLength = horizontal ? segment.size[0] : segment.size[2];
    const visibleThickness = horizontal ? segment.size[2] : segment.size[0];
    const yaw =
      segment.side === "north"
        ? Math.PI
        : segment.side === "south"
          ? 0
          : segment.side === "east"
            ? -Math.PI / 2
            : Math.PI / 2;
    addInstance({
      id: `shell:${segment.id}:wall`,
      source: "shell",
      role: "wall",
      roomId: segment.roomId,
      modelKey,
      position: [
        segment.position[0] + (segment.side === "east" ? -0.16 : segment.side === "west" ? 0.16 : 0),
        0,
        segment.position[2] + (segment.side === "north" ? -0.16 : segment.side === "south" ? 0.16 : 0),
      ],
      rotation: zUpWallPanel ? zUpWallPanelRotation(segment.side) : [0, yaw, 0],
      scale: zUpWallPanel
        ? [
            Math.max(0.18, visibleLength / asset.sizeMeters[0]),
            Math.max(0.85, visibleThickness / asset.sizeMeters[1]),
            Math.max(0.7, segment.size[1] / asset.sizeMeters[2]),
          ]
        : [
            Math.max(0.18, visibleLength / asset.sizeMeters[0]),
            Math.max(0.7, segment.size[1] / asset.sizeMeters[1]),
            Math.max(0.85, visibleThickness / asset.sizeMeters[2]),
          ],
      castShadow: true,
      receiveShadow: true,
      visibility: { type: "room" },
    });
  }
}

function zUpWallPanelRotation(side) {
  switch (side) {
    case "north":
      return [-Math.PI / 2, Math.PI, 0];
    case "east":
      return [Math.PI / 2, 0, Math.PI / 2];
    case "west":
      return [Math.PI / 2, 0, -Math.PI / 2];
    case "south":
    default:
      return [Math.PI / 2, 0, 0];
  }
}

function addCornerPillars(addInstance, room, modelKey) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const x = sx / 2 - 0.34;
  const z = sz / 2 - 0.34;
  const corners = [
    { id: "front-left", position: [cx - x, 0, cz - z], yaw: 0 },
    { id: "front-right", position: [cx + x, 0, cz - z], yaw: -Math.PI / 2 },
    { id: "back-left", position: [cx - x, 0, cz + z], yaw: Math.PI / 2 },
    { id: "back-right", position: [cx + x, 0, cz + z], yaw: Math.PI },
  ];
  for (const corner of corners) {
    addInstance({
      id: `shell:${room.id}:pillar:${corner.id}`,
      source: "shell",
      role: "pillar",
      roomId: room.id,
      modelKey,
      position: corner.position,
      rotation: [0, corner.yaw, 0],
      scale: [1, 1, 1],
      castShadow: true,
      receiveShadow: true,
      visibility: { type: "room" },
    });
  }
}

function addWallWashLights(addInstance, room, modelKey) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const y = 0.16;
  const frontZ = cz - sz / 2 + 0.25;
  const backZ = cz + sz / 2 - 0.25;
  const leftX = cx - sx / 2 + 0.25;
  const rightX = cx + sx / 2 - 0.25;
  const lights = [
    { id: "front-left", position: [cx - sx * 0.22, y, frontZ], yaw: 0 },
    { id: "front-right", position: [cx + sx * 0.22, y, frontZ], yaw: 0 },
    { id: "back-left", position: [cx - sx * 0.22, y, backZ], yaw: Math.PI },
    { id: "back-right", position: [cx + sx * 0.22, y, backZ], yaw: Math.PI },
    { id: "left-mid", position: [leftX, y, cz], yaw: Math.PI / 2 },
    { id: "right-mid", position: [rightX, y, cz], yaw: -Math.PI / 2 },
  ];
  for (const light of lights) {
    addInstance({
      id: `shell:${room.id}:wall-wash:${light.id}`,
      source: "shell",
      role: "wall_wash_light_mesh",
      roomId: room.id,
      modelKey,
      position: light.position,
      rotation: [0, light.yaw, 0],
      scale: [1, 1, 1],
      castShadow: false,
      receiveShadow: false,
      visibility: { type: "room", rescuePolicy: "current-room-only" },
    });
  }
}

function addPropInstances({ addInstance, map, isEnvironmentModelKey, issues }) {
  for (const prop of map.props ?? []) {
    if (prop.initiallyVisible === false) continue;
    if (!isEnvironmentModelKey(prop.modelKey)) {
      issues.push({
        severity: "warning",
        type: "unknown_prop_model_key",
        id: prop.id,
        modelKey: prop.modelKey,
      });
      continue;
    }
    addInstance({
      id: `prop:${prop.id}`,
      source: "map.props",
      role: "prop",
      roomId: prop.roomId,
      modelKey: prop.modelKey,
      position: prop.position,
      rotation: prop.rotation ?? [0, 0, 0],
      scale: toScaleVector(prop.scale ?? 1),
      castShadow: true,
      receiveShadow: true,
      tags: prop.tags ?? [],
      visibility: { type: "room" },
    });
  }
}

function addDecalInstances({ addInstance, map, isEnvironmentModelKey, issues }) {
  if ((map.decals ?? []).length > 0 && !isEnvironmentModelKey("room_wall_panel_maintenance")) {
    issues.push({
      severity: "warning",
      type: "unknown_decal_model_key",
      id: "map.decals",
      modelKey: "room_wall_panel_maintenance",
    });
    return;
  }

  for (const decal of map.decals ?? []) {
    const modelKey = modelKeyForDecalKind(decal.kind, isEnvironmentModelKey);
    if (!isEnvironmentModelKey(modelKey)) {
      issues.push({
        severity: "warning",
        type: "unknown_decal_model_key",
        id: decal.id,
        modelKey,
      });
      continue;
    }
    const [width = 0.72, height = 1.0] = decal.size ?? [];
    const usesReferenceTexture = modelKey.startsWith("decal_human_");
    addInstance({
      id: `decal:${decal.id}`,
      source: "map.decals",
      role: `decal_${decal.kind ?? "reference"}`,
      roomId: decal.roomId,
      modelKey,
      position: decal.position,
      rotation: decal.rotation ?? [0, 0, 0],
      scale: usesReferenceTexture
        ? [Math.max(0.12, width), Math.max(0.12, height), 1]
        : [Math.max(0.12, width / 2.4), Math.max(0.12, height / 1.65), 0.06],
      castShadow: false,
      receiveShadow: true,
      tags: decal.tags ?? [],
      visibility: { type: "room" },
      state: {
        decalId: decal.id,
        decalKind: decal.kind ?? "reference",
        opacity: clampNumber(Number(decal.opacity ?? 0.84), 0.2, 1),
      },
    });
  }
}

function modelKeyForDecalKind(kind, isEnvironmentModelKey) {
  const typedModelKey = {
    human_body_reference: "decal_human_body_reference",
    human_hand_reference: "decal_human_hand_reference",
    human_spine_reference: "decal_human_spine_reference",
  }[kind];
  if (typedModelKey && isEnvironmentModelKey(typedModelKey)) return typedModelKey;
  const fallbackModelKey = "room_wall_panel_maintenance";
  if (isEnvironmentModelKey(fallbackModelKey)) return fallbackModelKey;
  return typedModelKey ?? fallbackModelKey;
}

function addPuzzleTargetInstances({ addInstance, level, issues }) {
  for (const puzzle of level.puzzles ?? []) {
    if (puzzle.type !== "hit_sequence") continue;
    for (const target of puzzle.targets ?? []) {
      const modelKey = modelKeyForRawPuzzleTarget(target);
      if (!modelKey) {
        issues.push({
          severity: "warning",
          type: "unknown_puzzle_target_color",
          id: target.id,
          colorKey: target.colorKey,
        });
        continue;
      }
      const visualScale = clampNumber(Number(target.radius ?? 0.72) / 0.72, 0.62, 1.5);
      addInstance({
        id: `puzzle-target:${puzzle.id}:${target.id}`,
        source: "level.puzzles.targets",
        role: "puzzle_target",
        roomId: target.roomId,
        modelKey,
        position: target.position,
        rotation: [0, 0, 0],
        scale: toScaleVector(visualScale),
        castShadow: true,
        receiveShadow: true,
        tags: ["puzzle_target", `color:${target.colorKey}`, target.visualKey ?? ""].filter(Boolean),
        visibility: { type: "room" },
        state: {
          puzzleId: puzzle.id,
          targetId: target.id,
          colorKey: target.colorKey,
        },
      });
    }
  }
}

function addDoorInstances({ addInstance, getEnvironmentModelAsset, map, modelKeyForDoor, presentation, issues }) {
  for (const door of map.doors) {
    const kit = doorUsesServiceElevatorKit(door) ? serviceElevatorDoorKit : (presentation?.doorKit ?? null);
    const useKitDoorModel =
      Boolean(kit?.doorModelKey) &&
      (kit?.archetype === "security_door" || door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero");
    const modelKey = useKitDoorModel ? kit.doorModelKey : modelKeyForDoor(door);
    const doorModel = getEnvironmentModelAsset(modelKey);
    const [sx, sy, sz] = door.size;
    // Service-elevator door leaves are grounded-modelled (Y origin at the floor),
    // so the 0.11m kit floor clearance lifts them off the frame and exposes an
    // ~11cm gap at the bottom ("门空了"). Only the security_door kit needs it.
    const configuredFloorClearance = useKitDoorModel && !doorUsesServiceElevatorKit(door) ? 0.11 : 0;
    addInstance({
      id: `door:${door.id}:leaf`,
      source: "map.doors",
      role: "door_leaf",
      roomId: door.fromRoomId,
      secondaryRoomId: door.toRoomId,
      modelKey,
      position: [door.position[0], sy / 2 + configuredFloorClearance, door.position[2]],
      localOffset: [0, -sy / 2, 0],
      rotation: [0, door.yaw, 0],
      scale: [sx / doorModel.sizeMeters[0], sy / doorModel.sizeMeters[1], Math.max(0.78, sz / doorModel.sizeMeters[2])],
      castShadow: false,
      receiveShadow: true,
      state: {
        doorId: door.id,
        openAnimation: kit?.openAnimation ?? null,
        openVisualPolicy: door.openVisualPolicy ?? null,
      },
      visibility: { type: "door", doorId: door.id },
    });

    if (door.panelPosition && kit?.panelModelKey !== "none") {
      const panelModelKey = kit?.panelModelKey ?? "terminal_code_keypad";
      addInstance({
        id: `door:${door.id}:panel`,
        source: "map.doors",
        role: "door_panel",
        roomId: door.fromRoomId,
        secondaryRoomId: door.toRoomId,
        modelKey: panelModelKey,
        position: [door.panelPosition[0], 0.035, door.panelPosition[2]],
        rotation: [0, door.yaw, 0],
        scale: [0.78, 0.78, 0.78],
        castShadow: true,
        receiveShadow: true,
        state: { doorId: door.id },
        visibility: { type: "door", doorId: door.id },
      });
    } else if (kit?.panelModelKey !== "none") {
      issues.push({
        severity: "info",
        type: "door_without_panel_position",
        id: door.id,
      });
    }
  }
}

function doorUsesServiceElevatorKit(door) {
  return door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero";
}

function addKeyItemInstances({ addInstance, map, modelKeyForKeyVisual }) {
  for (const item of map.keyItems ?? []) {
    const routeChip = item.visualKey === "route_access_chip";
    addInstance({
      id: `key-item:${item.id}`,
      source: "map.keyItems",
      role: "key_item",
      roomId: item.roomId,
      modelKey: modelKeyForKeyVisual(item.visualKey),
      position: item.position,
      rotation: [0, 0, 0],
      scale: routeChip ? [1.18, 1.18, 1.18] : [1, 1, 1],
      castShadow: true,
      receiveShadow: true,
      state: {
        keyItemId: item.id,
        visualKey: item.visualKey,
        requiresObjectiveId: item.requiresObjectiveId ?? null,
        dropRuntimePosition: true,
      },
      visibility: { type: "key-item", keyItemId: item.id },
    });
  }
}

function addInteractionInstances({ addInstance, map, modelKeyForInteraction }) {
  const sideHostedExitRooms = new Set(
    (map.props ?? [])
      .filter((prop) => prop.tags?.includes("button_panel") && prop.tags?.includes("elevator"))
      .map((prop) => prop.roomId),
  );
  for (const interaction of map.interactions ?? []) {
    if (interaction.type === "exit" && sideHostedExitRooms.has(interaction.roomId)) continue;
    const modelKey = modelKeyForInteraction(interaction);
    if (!modelKey) continue;
    addInstance({
      id: `interaction:${interaction.id}`,
      source: "map.interactions",
      role: `interaction_${interaction.type}`,
      roomId: interaction.roomId,
      modelKey,
      position: interaction.position,
      rotation: [0, interaction.yaw ?? 0, 0],
      scale: [1, 1, 1],
      castShadow: true,
      receiveShadow: true,
      state: {
        interactionId: interaction.id,
        type: interaction.type,
        requiresObjectiveId: interaction.requiresObjectiveId ?? null,
      },
      visibility: { type: "room" },
    });
  }
}

function addPickupInstances({ addInstance, map, modelKeyForPickupType }) {
  for (const pickup of map.pickups ?? []) {
    const modelKey = modelKeyForPickupType(pickup.type);
    if (!modelKey) continue;
    addInstance({
      id: `pickup:${pickup.id}`,
      source: "map.pickups",
      role: `pickup_${pickup.type}`,
      roomId: pickup.roomId,
      modelKey,
      position: pickup.position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      castShadow: true,
      receiveShadow: true,
      state: { pickupId: pickup.id, type: pickup.type },
      visibility: { type: "pickup", pickupId: pickup.id },
    });
  }
}

function addStoryPickupSeedInstances({ addInstance, level, map, modelKeyForPickupType }) {
  for (const pickup of level.pickups?.storyPickups ?? []) {
    const modelKey = modelKeyForPickupType(pickup.type);
    if (!modelKey) continue;
    const interaction = map.interactions?.find((candidate) => candidate.id === pickup.interactionId);
    addInstance({
      id: `story-pickup-seed:${pickup.interactionId}`,
      source: "level.pickups.storyPickups",
      role: `pickup_${pickup.type}`,
      roomId: interaction?.roomId ?? null,
      modelKey,
      position: pickup.position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      castShadow: false,
      receiveShadow: true,
      tags: ["raw_asset_seed", "story_pickup"],
      state: {
        pickupId: pickup.interactionId,
        interactionId: pickup.interactionId,
        type: pickup.type,
      },
      visibility: { type: "pickup", pickupId: pickup.interactionId },
    });
  }
}

function roomShellKeys(room, shellKit, isEnvironmentModelKey) {
  if (isServiceElevatorRoom(room)) {
    return {
      floor: "room_floor_tile_maintenance",
      wall: "room_wall_panel_maintenance",
      ceiling: "room_ceiling_panel_maintenance",
      pillar: "room_corner_pillar_maintenance",
      wallWash: "room_wall_wash_light_maintenance",
    };
  }
  if (shellKit) {
    return {
      floor: modelKeyOrFallback(shellKit.floorModelKey, "room_floor_tile_maintenance", isEnvironmentModelKey),
      wall: modelKeyOrFallback(shellKit.wallModelKey, "room_wall_panel_maintenance", isEnvironmentModelKey),
      ceiling: modelKeyOrFallback(shellKit.ceilingModelKey, "room_ceiling_panel_maintenance", isEnvironmentModelKey),
      pillar: modelKeyOrFallback(shellKit.cornerPillarModelKey, "room_corner_pillar_maintenance", isEnvironmentModelKey),
      wallWash: modelKeyOrFallback(shellKit.wallWashLightModelKey, "room_wall_wash_light_maintenance", isEnvironmentModelKey),
    };
  }
  if (room.skinKey?.includes("museum") || room.skinKey?.includes("archive") || room.aesthetic?.style === "museum") {
    return {
      floor: "room_floor_tile_museum",
      wall: "room_wall_panel_museum",
      ceiling: "room_ceiling_panel_museum",
      pillar: "room_corner_pillar_museum",
      wallWash: "room_wall_wash_light_museum",
    };
  }
  return {
    floor: "room_floor_tile_maintenance",
    wall: "room_wall_panel_maintenance",
    ceiling: "room_ceiling_panel_maintenance",
    pillar: "room_corner_pillar_maintenance",
    wallWash: "room_wall_wash_light_maintenance",
  };
}

function isServiceElevatorRoom(room) {
  const text = `${room.skinKey ?? ""} ${room.floorMaterialKey ?? ""} ${room.wallMaterialKey ?? ""} ${room.aesthetic?.style ?? ""}`.toLowerCase();
  return text.includes("service_elevator_metal") || room.aesthetic?.style === "exit";
}

function modelKeyOrFallback(modelKey, fallback, isEnvironmentModelKey) {
  return isEnvironmentModelKey(modelKey) ? modelKey : fallback;
}

function addProceduralIssue(addInstance, room, role, message) {
  addInstance({
    id: `procedural:${room.id}:${role}`,
    source: "procedural-placeholder",
    role,
    roomId: room.id,
    modelKey: "prop_small_floor_shadow_disc",
    position: room.bounds.center,
    rotation: [0, 0, 0],
    scale: [0.001, 0.001, 0.001],
    castShadow: false,
    receiveShadow: false,
    visibility: { type: "room" },
    state: { compilerPlaceholder: true, message },
  });
}
