import type { EnvironmentModelKey } from "../../../assets/environmentModelAssets";
import type { PickupType } from "../../entities/EntityTypes";

export type VisualVec3 = readonly [number, number, number];

export interface PickupRawVisualIntent {
  localYOffset: number;
  localOffset?: VisualVec3;
  rotation?: VisualVec3;
  scale: number | VisualVec3;
}

export interface PickupThreeVisualIntent {
  groupBaseY: number;
  groupBaseScale: number;
  hoverAmplitude: number;
  pulseScale: number;
  spinStep?: number;
  idleYawAmplitude?: number;
  modelPosition?: VisualVec3;
  modelRotation?: VisualVec3;
  modelScale: number | VisualVec3;
}

export interface PickupVisualIntent {
  modelKey: EnvironmentModelKey;
  raw: PickupRawVisualIntent;
  three: PickupThreeVisualIntent;
}

export const pickupVisualIntents = {
  coreCell: {
    modelKey: "pickup_energy_cell_amber",
    raw: {
      localYOffset: 0.18,
      scale: 1,
    },
    three: {
      groupBaseY: 0.48,
      groupBaseScale: 0.92,
      hoverAmplitude: 0.025,
      pulseScale: 0.035,
      spinStep: 0.035,
      modelPosition: [0, -0.45, 0],
      modelScale: 1,
    },
  },
  repairKit: {
    modelKey: "pickup_medkit_white_red",
    raw: {
      localYOffset: 0.08,
      scale: 0.46,
    },
    three: {
      groupBaseY: 0.48,
      groupBaseScale: 1.02,
      hoverAmplitude: 0.025,
      pulseScale: 0.035,
      spinStep: 0.018,
      modelPosition: [0, -0.36, 0],
      modelScale: 1,
    },
  },
  ironRod: {
    modelKey: "pickup_iron_rod_viewmodel_battleworn",
    raw: {
      localYOffset: 0.12,
      scale: 0.52,
      rotation: [0, -0.22, Math.PI / 2],
    },
    three: {
      groupBaseY: 0.16,
      groupBaseScale: 1.0,
      hoverAmplitude: 0.012,
      pulseScale: 0.018,
      idleYawAmplitude: 0.07,
      modelRotation: [0, -0.22, Math.PI / 2],
      modelScale: 0.52,
    },
  },
  pistol: {
    modelKey: "pickup_sidearm_viewmodel_battleworn",
    raw: {
      localYOffset: 0.16,
      scale: 0.42,
      rotation: [0, 0.32, Math.PI / 2],
    },
    three: {
      groupBaseY: 0.16,
      groupBaseScale: 1.0,
      hoverAmplitude: 0.012,
      pulseScale: 0.018,
      idleYawAmplitude: 0.07,
      modelRotation: [0, 0.32, Math.PI / 2],
      modelScale: 0.42,
    },
  },
  breachMissile: {
    modelKey: "ability_protocol_breach_missile_v1",
    raw: {
      localYOffset: 0.2,
      scale: 0.88,
      rotation: [0.08, -0.48, Math.PI / 2],
    },
    three: {
      groupBaseY: 0.38,
      groupBaseScale: 1.0,
      hoverAmplitude: 0.016,
      pulseScale: 0.018,
      idleYawAmplitude: 0.09,
      modelRotation: [0.08, -0.48, Math.PI / 2],
      modelScale: 0.88,
    },
  },
} as const satisfies Record<PickupType, PickupVisualIntent>;

export function pickupVisualIntentForType(type: PickupType): PickupVisualIntent | null {
  return pickupVisualIntents[type] ?? null;
}
