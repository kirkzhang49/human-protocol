import { buildGalleryReadingPreset } from "../content/galleryReadingArchive";
import { level01MaintenanceBay } from "../levelManifest";
import type { LevelDefinition, LevelMapConfig } from "../schema/levelConfig";

/**
 * Minimal smoke levels for the cyberpunk 2D puzzle systems
 * (circuit_grid / surveillance_match / valve_matrix / gallery_reading). Each
 * level is a two-room sample config: panel in the hub, exit behind the
 * puzzle-locked door.
 */

function smokeMap(idPrefix: string, panelLabel: string): LevelMapConfig {
  return {
    id: `${idPrefix}_map`,
    schemaVersion: "hp.map.v1",
    rooms: [
      {
        id: `${idPrefix}_hub`,
        label: "测试大厅",
        bounds: { center: [0, 0, 0], size: [8, 4, 8] },
        mood: "uneasy",
        floorMaterialKey: "sterile_lab_floor",
        wallMaterialKey: "sterile_lab_wall",
        geometry: { renderFloor: true, renderWalls: true, collisionWalls: true, accentColor: "#54f1ff" },
      },
      {
        id: `${idPrefix}_exit_room`,
        label: "测试出口",
        bounds: { center: [0, 0, -6.1], size: [5, 4, 4.2] },
        mood: "reveal",
        floorMaterialKey: "red_exit_floor",
        wallMaterialKey: "red_exit_wall",
        geometry: { renderFloor: true, renderWalls: true, collisionWalls: true, accentColor: "#ff5b4c" },
      },
    ],
    doors: [
      {
        id: `${idPrefix}_door`,
        label: "谜题锁门",
        fromRoomId: `${idPrefix}_hub`,
        toRoomId: `${idPrefix}_exit_room`,
        position: [0, 0, -4],
        size: [3.0, 3.2, 0.35],
        yaw: 0,
        defaultState: "locked",
        lock: {
          type: "puzzle_complete",
          puzzleId: `${idPrefix}_puzzle`,
          lockedMessage: "谜题尚未完成。",
          unlockedMessage: "谜题锁门已打开。",
        },
        visualKey: "service_elevator_door",
        materialKey: "service_elevator_metal",
        panelPosition: [1.8, 0, -3.7],
      },
    ],
    keyItems: [],
    interactions: [
      {
        id: `${idPrefix}_panel`,
        type: "terminal",
        roomId: `${idPrefix}_hub`,
        position: [0, 0, -3.4],
        radius: 1.8,
        visualKey: "direction_keypad_panel",
        materialKey: "terminal_cyan",
        label: panelLabel,
      },
      {
        id: `use_${idPrefix}_exit`,
        type: "exit",
        roomId: `${idPrefix}_exit_room`,
        position: [0, 0, -6.6],
        radius: 1.8,
        visualKey: "exit_panel",
        materialKey: "terminal_red",
        label: "进入测试出口",
        requiresObjectiveId: `${idPrefix}_solve`,
      },
    ],
    navigation: {
      criticalPathRoomIds: [`${idPrefix}_hub`, `${idPrefix}_exit_room`],
      optionalRoomIds: [],
      maxBacktrackSeconds: 0,
      mobileReadableDoorCount: 1,
    },
  };
}

function smokeBase(idPrefix: string, title: string, panelLabel: string): LevelDefinition {
  return {
    ...level01MaintenanceBay,
    id: idPrefix,
    title,
    spawnPoint: [0, 0, 2.4],
    initialWaveStartDelay: 0,
    requiresStoryPickupsBeforeWaves: false,
    events: [],
    environmentStates: [],
    bossPhases: [],
    cinematicBeats: [],
    waves: [],
    articles: [],
    exit: {
      ...level01MaintenanceBay.exit,
      id: `${idPrefix}_exit`,
      position: [0, 0, -6.6],
      radius: 1.8,
      unlockMessage: "测试出口已解锁。",
      unlockWarning: { label: "出口已通电", detail: "谜题完成" },
      transitionMessage: `Smoke 电梯下行：${title}由 config 驱动。`,
      victoryMessage: `Smoke 完成：${title}全流程通过。`,
    },
    pickups: { ...level01MaintenanceBay.pickups, storyPickups: [] },
    map: smokeMap(idPrefix, panelLabel),
    objectiveChain: [
      {
        id: `${idPrefix}_solve`,
        type: "custom",
        title: `完成${title}`,
        detail: "在面板上完成谜题。",
        requiredIds: [`${idPrefix}_puzzle`],
        startsWhen: { type: "level_start" },
        completesWhen: { type: "puzzle_completed", id: `${idPrefix}_puzzle` },
        nextObjectiveId: `${idPrefix}_reach_exit`,
        hudLabel: "谜题",
      },
      {
        id: `${idPrefix}_reach_exit`,
        type: "reach_exit",
        title: "进入测试出口",
        detail: "门已打开。",
        requiredIds: [`${idPrefix}_door`],
        startsWhen: { type: "puzzle_completed", id: `${idPrefix}_puzzle` },
        completesWhen: { type: "interaction_completed", id: `use_${idPrefix}_exit` },
        hudLabel: "测试出口",
      },
    ],
  };
}

export const circuitGridSmokeLevel: LevelDefinition = {
  ...smokeBase("smoke_circuit_grid", "电路回路 Smoke", "电路面板"),
  puzzles: [
    {
      id: "smoke_circuit_grid_puzzle",
      type: "circuit_grid",
      label: "测试电路回路",
      roomId: "smoke_circuit_grid_hub",
      interactionId: "smoke_circuit_grid_panel",
      guidance: "把电源接到节点。",
      columns: 3,
      rows: 3,
      sources: [{ x: 0, y: 1, label: "电源" }],
      targets: [{ x: 2, y: 1, label: "节点" }],
      cells: [
        { x: 0, y: 1, kind: "cross", locked: true },
        { x: 1, y: 1, kind: "straight", rotation: 0 },
        { x: 2, y: 1, kind: "cross", locked: true },
      ],
      success: {
        opensDoorId: "smoke_circuit_grid_door",
        unlockExit: true,
        completesObjectiveId: "smoke_circuit_grid_solve",
        rewardPulse: { label: "回路闭合", detail: "测试通过", rarity: "rare" },
      },
      fail: { message: "回路未闭合。" },
    },
  ],
};

export const surveillanceMatchSmokeLevel: LevelDefinition = {
  ...smokeBase("smoke_surveillance_match", "监控比对 Smoke", "监控比对台"),
  puzzles: [
    {
      id: "smoke_surveillance_match_puzzle",
      type: "surveillance_match",
      label: "测试监控比对",
      roomId: "smoke_surveillance_match_hub",
      interactionId: "smoke_surveillance_match_panel",
      guidance: "给每个画面选对位置。",
      channels: [
        { id: "cam_a", label: "CAM-A", symbol: "◍", feedDetail: "湿地板。", answerOptionId: "loc_hall" },
        { id: "cam_b", label: "CAM-B", symbol: "✕", feedDetail: "纯黑画面。", answerOptionId: "loc_fake" },
      ],
      options: [
        { id: "loc_hall", label: "大厅", symbol: "◍" },
        { id: "loc_fake", label: "假摄像头", symbol: "✕" },
      ],
      maxMistakes: 3,
      success: {
        opensDoorId: "smoke_surveillance_match_door",
        unlockExit: true,
        completesObjectiveId: "smoke_surveillance_match_solve",
        rewardPulse: { label: "比对通过", detail: "测试通过", rarity: "rare" },
      },
      fail: { message: "比对失败。" },
    },
  ],
};

export const valveMatrixSmokeLevel: LevelDefinition = {
  ...smokeBase("smoke_valve_matrix", "闸门配平 Smoke", "闸门配平台"),
  puzzles: [
    {
      id: "smoke_valve_matrix_puzzle",
      type: "valve_matrix",
      label: "测试闸门配平",
      roomId: "smoke_valve_matrix_hub",
      interactionId: "smoke_valve_matrix_panel",
      guidance: "调左闸、中闸、右闸，让三块状态表全部进绿区。",
      valves: [
        { id: "gate_left", label: "左闸", min: 0, max: 8, initial: 2, gaugeShift: [6, 2, 0] },
        { id: "gate_mid", label: "中闸", min: 0, max: 8, initial: 1, gaugeShift: [-2, 5, 2] },
        { id: "gate_right", label: "右闸", min: 0, max: 8, initial: 0, gaugeShift: [0, -3, 7] },
      ],
      gauges: [
        { id: "gauge_seal_pressure", label: "密封压", base: 8, target: 30, tolerance: 2, unit: "bar" },
        { id: "gauge_track_delta", label: "轨道差", base: 6, target: 27, tolerance: 2, unit: "" },
        { id: "gauge_cutoff_temp", label: "熔断温", base: 36, target: 65, tolerance: 3, unit: "°" },
      ],
      solution: [5, 4, 3],
      success: {
        opensDoorId: "smoke_valve_matrix_door",
        unlockExit: true,
        completesObjectiveId: "smoke_valve_matrix_solve",
        rewardPulse: { label: "闸门配平", detail: "测试通过", rarity: "rare" },
      },
      fail: { message: "闸门防误触保护启动。" },
    },
  ],
};

const galleryReadingSmokePreset = buildGalleryReadingPreset({ seed: "smoke_gallery_reading_puzzle", questionCount: 3 });

export const galleryReadingSmokeLevel: LevelDefinition = {
  ...smokeBase("smoke_gallery_reading", "展画审读 Smoke", "展画审读机"),
  puzzles: [
    {
      id: "smoke_gallery_reading_puzzle",
      type: "gallery_reading",
      label: "测试展画审读",
      roomId: "smoke_gallery_reading_hub",
      interactionId: "smoke_gallery_reading_panel",
      guidance: "读展画线索，答对档案问询。",
      paintings: galleryReadingSmokePreset.paintings,
      questions: galleryReadingSmokePreset.questions,
      questionsPerRun: 3,
      maxMistakes: 2,
      success: {
        opensDoorId: "smoke_gallery_reading_door",
        unlockExit: true,
        completesObjectiveId: "smoke_gallery_reading_solve",
        rewardPulse: { label: "审读通过", detail: "测试通过", rarity: "rare" },
      },
      fail: { message: "审读未通过。" },
    },
  ],
};
