import type { LevelMapConfig, LevelMapPropDefinition, Vec3Tuple } from "./schema/levelConfig";
import type { RoomLightingDefinition } from "./RoomPresentationRegistry";

type LocalLightKind = "point" | "spot" | "area";

interface PropLocalLightAnchorBase {
  id: string;
  kind: LocalLightKind;
  localPosition: Vec3Tuple;
  color: string;
  intensity: number;
  lockdownIntensity?: number;
}

interface PropLocalPointLightAnchor extends PropLocalLightAnchorBase {
  kind: "point";
  distance: number;
  decay: number;
}

interface PropLocalSpotLightAnchor extends PropLocalLightAnchorBase {
  kind: "spot";
  localTarget: Vec3Tuple;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
  castShadow?: boolean;
  beamOpacity?: number;
  beamRadius?: number;
  beamLengthScale?: number;
}

interface PropLocalAreaLightAnchor extends PropLocalLightAnchorBase {
  kind: "area";
  localTarget: Vec3Tuple;
  width: number;
  height: number;
}

type PropLocalLightAnchor = PropLocalPointLightAnchor | PropLocalSpotLightAnchor | PropLocalAreaLightAnchor;

const propLocalLightAnchors: Record<string, readonly PropLocalLightAnchor[]> = {
  light_wall_medical_strip_cyan_1m: [
    {
      id: "cyan_lens_area",
      kind: "area",
      localPosition: [0, 0.5, 0.07],
      localTarget: [0, 0.5, 0.86],
      color: "#65efff",
      intensity: 0.78,
      lockdownIntensity: 0.58,
      width: 0.24,
      height: 1.12,
    },
  ],
  light_ceiling_flicker_cyan_2m: [
    {
      id: "left_broken_lens_spot",
      kind: "spot",
      localPosition: [-0.48, -0.02, 0.1],
      localTarget: [-0.48, -1.55, 0.1],
      color: "#9ef8ff",
      intensity: 0.72,
      lockdownIntensity: 0.44,
      distance: 5.8,
      angle: 0.58,
      penumbra: 0.7,
      decay: 1.9,
      beamOpacity: 0.018,
      beamRadius: 0.16,
      beamLengthScale: 0.58,
    },
    {
      id: "right_broken_lens_spot",
      kind: "spot",
      localPosition: [0.52, -0.02, 0.1],
      localTarget: [0.52, -1.55, 0.1],
      color: "#7feeff",
      intensity: 0.62,
      lockdownIntensity: 0.36,
      distance: 5.4,
      angle: 0.56,
      penumbra: 0.72,
      decay: 1.95,
      beamOpacity: 0.016,
      beamRadius: 0.14,
      beamLengthScale: 0.56,
    },
  ],
  room_l1_img2_body_reference_lightbox: [
    {
      id: "reference_panel_face",
      kind: "area",
      localPosition: [0, 0.72, 0.09],
      localTarget: [0, 0.72, 0.92],
      color: "#dffcff",
      intensity: 0.58,
      lockdownIntensity: 0.42,
      width: 1.08,
      height: 1.34,
    },
  ],
  hp_l2_cc0_ceiling_lamp_polyhaven_v1: [
    {
      id: "warm_inner_glow",
      kind: "point",
      localPosition: [0, 0.198, 0],
      color: "#ffd6a2",
      intensity: 1.05,
      lockdownIntensity: 0.78,
      distance: 5.2,
      decay: 2.1,
    },
  ],
  hp_l4_cineclinic_surgical_light: [
    {
      id: "surgical_lens_cluster",
      kind: "spot",
      localPosition: [0, 0.54, 0],
      localTarget: [0, -1.15, 0],
      color: "#eafcff",
      intensity: 1.55,
      lockdownIntensity: 1.12,
      distance: 6.4,
      angle: 0.52,
      penumbra: 0.68,
      decay: 1.85,
      beamOpacity: 0.024,
      beamRadius: 0.2,
      beamLengthScale: 0.62,
    },
  ],
  room_l5_v3_surgical_light_stand: [
    {
      id: "exam_lamp_lens_cluster",
      kind: "spot",
      localPosition: [0.359, 2.332, -0.39],
      localTarget: [0.28, 0.95, -1.22],
      color: "#dffbff",
      intensity: 1.35,
      lockdownIntensity: 1.02,
      distance: 6.2,
      angle: 0.5,
      penumbra: 0.7,
      decay: 1.9,
      beamOpacity: 0.02,
      beamRadius: 0.22,
      beamLengthScale: 0.6,
    },
  ],
  room_l5_v4_ceiling_service_lamp: [
    {
      id: "lower_cyan_strip_area",
      kind: "area",
      localPosition: [0, 0.235, -0.157],
      localTarget: [0, -1.1, -0.157],
      color: "#a8f8ff",
      intensity: 0.92,
      lockdownIntensity: 0.68,
      width: 1.28,
      height: 0.22,
    },
  ],
};

export function createPropLocalLights(map: LevelMapConfig): RoomLightingDefinition[] {
  return (map.props ?? []).flatMap((prop) => {
    const anchors = propLocalLightAnchors[prop.modelKey];
    if (!anchors || prop.initiallyVisible === false) return [];
    return anchors.map((anchor) => createPropLocalLight(prop, anchor));
  });
}

export function hasPropLocalLightAnchors(modelKey: string) {
  return Boolean(propLocalLightAnchors[modelKey]?.length);
}

function createPropLocalLight(prop: LevelMapPropDefinition, anchor: PropLocalLightAnchor): RoomLightingDefinition {
  const position = localToWorld(prop, anchor.localPosition);
  const base = {
    id: `prop_local:${prop.id}:${anchor.id}`,
    roomId: prop.roomId,
    color: anchor.color,
    intensity: anchor.intensity,
    lockdownIntensity: anchor.lockdownIntensity,
    semanticRole: "prop_local_light",
    semanticSourceId: prop.id,
  };

  if (anchor.kind === "point") {
    return {
      ...base,
      type: "point",
      position,
      distance: scaledDistance(prop, anchor.distance),
      decay: anchor.decay,
    };
  }

  const target = localToWorld(prop, anchor.localTarget);
  if (anchor.kind === "spot") {
    return {
      ...base,
      type: "spot",
      position,
      target,
      distance: scaledDistance(prop, anchor.distance),
      angle: anchor.angle,
      penumbra: anchor.penumbra,
      decay: anchor.decay,
      castShadow: anchor.castShadow ?? false,
      beamOpacity: anchor.beamOpacity,
      beamRadius: anchor.beamRadius,
      beamLengthScale: anchor.beamLengthScale,
    };
  }

  const [sx, sy] = lightPlaneScale(prop);
  return {
    ...base,
    type: "area",
    position,
    target,
    width: anchor.width * sx,
    height: anchor.height * sy,
  };
}

function localToWorld(prop: LevelMapPropDefinition, local: Vec3Tuple): Vec3Tuple {
  const scale = propScale(prop);
  const x = local[0] * scale[0];
  const y = local[1] * scale[1];
  const z = local[2] * scale[2];
  const yaw = propYaw(prop);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    round3(prop.position[0] + x * cos - z * sin),
    round3(prop.position[1] + y),
    round3(prop.position[2] + x * sin + z * cos),
  ];
}

function propYaw(prop: LevelMapPropDefinition) {
  const legacy = prop as LevelMapPropDefinition & { rotationY?: number };
  return prop.rotation?.[1] ?? legacy.rotationY ?? 0;
}

function propScale(prop: LevelMapPropDefinition): Vec3Tuple {
  const rawScale = prop.scale;
  if (typeof rawScale === "number" || rawScale === undefined) {
    const scale = rawScale ?? 1;
    return [scale, scale, scale];
  }
  const scale = rawScale as Vec3Tuple;
  return [scale[0], scale[1], scale[2]];
}

function lightPlaneScale(prop: LevelMapPropDefinition): readonly [number, number] {
  const [sx, sy] = propScale(prop);
  return [sx, sy];
}

function scaledDistance(prop: LevelMapPropDefinition, distance: number) {
  const scale = propScale(prop);
  return round3(distance * Math.max(scale[0], scale[1], scale[2]));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
