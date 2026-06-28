import type { LevelPuzzleDefinition } from "../../schema/levelConfig";

export const level01Puzzles: readonly LevelPuzzleDefinition[] = [
  {
    id: "level_01_power_circuit",
    type: "circuit_grid",
    label: "维修舱配电重接",
    roomId: "level_01_tool_alcove",
    interactionId: "level_01_power_panel",
    guidance: "市电从左侧进。把导线转到位，同时喂给维修电梯和主照明——工具挂板下的线路图就是接法。",
    columns: 4,
    rows: 3,
    sources: [{ x: 0, y: 1, label: "市电" }],
    targets: [
      { x: 3, y: 0, label: "电梯" },
      { x: 3, y: 2, label: "照明" },
    ],
    cells: [
      { x: 0, y: 1, kind: "cross", locked: true },
      { x: 1, y: 1, kind: "straight", rotation: 0 },
      { x: 2, y: 1, kind: "tee", rotation: 2 },
      { x: 2, y: 0, kind: "corner", rotation: 2 },
      { x: 3, y: 0, kind: "cross", locked: true },
      { x: 2, y: 2, kind: "corner", rotation: 3 },
      { x: 3, y: 2, kind: "cross", locked: true },
      { x: 1, y: 0, kind: "blocked" },
      { x: 1, y: 2, kind: "blocked" },
    ],
    fail: {
      message: "回路没有闭合。",
      cameraImpact: { shake: 0.14, fovKick: 0.6 },
      audio: { key: "enemy_hit", intensity: 0.36 },
    },
    success: {
      completesObjectiveId: "level_01_route_power",
      dialogueTrigger: "lockdown_started",
      rewardPulse: { label: "供电恢复", detail: "电梯亮了——广播也注意到了", rarity: "epic" },
      rewardPulseDuration: 1.7,
      cameraImpact: { shake: 0.3, fovKick: 1.5 },
      audio: { key: "system_exit_open", intensity: 0.9 },
    },
  },
];
