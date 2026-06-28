export interface ArenaObstacleConfig {
  id: string;
  visualKey: string;
  position: readonly [number, number, number];
  halfSize: readonly [number, number, number];
  color?: string;
}

export const gameBalance = {
  arenaHalfSize: 16,
  cameraLookAhead: 0.72,
  cameraLookAheadSmoothing: 8,
  cameraShakeDecay: 6.5,
  effectPoolSize: 18,
  projectilePoolSize: 36,
};

export const arenaObstacles: readonly ArenaObstacleConfig[] = [
  {
    id: "crate-northwest",
    visualKey: "maintenance_crate",
    position: [-6.2, 0.45, -4.6],
    halfSize: [1.2, 0.45, 1],
    color: "#273241",
  },
  {
    id: "crate-east",
    visualKey: "maintenance_crate",
    position: [5.4, 0.35, -0.8],
    halfSize: [1, 0.35, 1.45],
    color: "#303845",
  },
  {
    id: "west-diagnostic-console-front",
    visualKey: "diagnostic_console",
    position: [-12.25, 0.62, -8.7],
    halfSize: [0.65, 0.62, 1.85],
    color: "#182832",
  },
  {
    id: "west-diagnostic-console-rear",
    visualKey: "diagnostic_console",
    position: [-12.55, 0.62, 2.4],
    halfSize: [0.58, 0.62, 1.75],
    color: "#192b34",
  },
  {
    id: "east-control-bank-front",
    visualKey: "control_bank",
    position: [12.2, 0.58, -7.2],
    halfSize: [0.72, 0.58, 1.65],
    color: "#202733",
  },
  {
    id: "east-control-bank-rear",
    visualKey: "control_bank",
    position: [12.45, 0.58, 3.3],
    halfSize: [0.68, 0.58, 1.5],
    color: "#1d2934",
  },
  {
    id: "repair-table-west",
    visualKey: "repair_table",
    position: [-3.85, 0.38, 1.9],
    halfSize: [1.25, 0.38, 0.65],
    color: "#222d38",
  },
  {
    id: "floor-cable-spine-east",
    visualKey: "cable_spine",
    position: [3.7, 0.16, -5.35],
    halfSize: [0.42, 0.16, 2.25],
    color: "#151b23",
  },
  {
    id: "low-wall-south",
    visualKey: "maintenance_crate",
    position: [-7, 0.3, 7],
    halfSize: [2.2, 0.3, 0.55],
    color: "#252d37",
  },
  {
    id: "south-supply-crate",
    visualKey: "maintenance_crate",
    position: [7.35, 0.42, 7.25],
    halfSize: [1.35, 0.42, 0.72],
    color: "#26313d",
  },
  {
    id: "reactor-plinth",
    visualKey: "power_plinth",
    position: [3.4, 0.5, 4.6],
    halfSize: [0.85, 0.5, 0.85],
    color: "#37262b",
  },
  {
    id: "elevator-left-bollard",
    visualKey: "elevator_bollard",
    position: [-3.35, 0.7, -13.65],
    halfSize: [0.38, 0.7, 0.38],
    color: "#2a333d",
  },
  {
    id: "elevator-right-bollard",
    visualKey: "elevator_bollard",
    position: [3.35, 0.7, -13.65],
    halfSize: [0.38, 0.7, 0.38],
    color: "#2a333d",
  },
];
