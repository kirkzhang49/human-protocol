import { clampNumber, hexToRgb, roundNumber, roundTuple } from "./raw-webgpu-plan-utils.mjs";

export function createLightPlan({ map, presentation, extraLights = [], resolveLightPosition, resolveRoomRelativePosition }) {
  const lights = [...(presentation?.lighting?.lights ?? []), ...extraLights];
  return lights.map((light, index) => ({
    index,
    id: light.id,
    type: light.type,
    roomId: light.roomId ?? null,
    doorId: light.doorId ?? null,
    color: light.color,
    intensity: light.intensity ?? light.opacity ?? 0,
    position: roundTuple(resolveLightPosition(map, light)),
    targetPosition: light.target || light.targetRoomRelative ? roundTuple(resolveLightTargetPosition(map, light, resolveRoomRelativePosition, resolveLightPosition)) : null,
    distance: light.distance ?? null,
    decay: light.decay ?? null,
    angle: light.angle ?? null,
    penumbra: light.penumbra ?? null,
    width: light.width ?? null,
    height: light.height ?? null,
    opacity: light.opacity ?? null,
    castShadow: light.type === "spot" ? Boolean(light.castShadow) : false,
    semanticRole: light.semanticRole ?? null,
    semanticSourceId: light.semanticSourceId ?? null,
  }));
}

export function createRawLightingProfiles({ map, presentation, lights, visibilityScenarios }) {
  const ambient = presentation?.lighting?.ambient?.intensity ?? 0.22;
  const hemisphere = presentation?.lighting?.hemisphereIntensity ?? 0.18;
  const bloom = presentation?.lighting?.bloom?.intensity ?? 0.4;
  const profileByRoomId = new Map();
  for (const room of map.rooms) {
    const [sx, sy, sz] = room.bounds.size;
    const area = Math.max(1, sx * sz);
    const height = Math.max(1, sy);
    const roomLights = lights.filter((light) => light.roomId === room.id || !light.roomId);
    const dynamicLightPressure = averageVisibleLightPressure(visibilityScenarios, room.id);
    const style = rawRoomLightingStyle(room, presentation);
    const lightDensity = roomLights.length / Math.max(1, area / 18);
    const warmLightShare = roomLights.length === 0 ? 0 : roomLights.filter((light) => warmColorScore(light.color) > 0.54).length / roomLights.length;
    const cyanLightShare = roomLights.length === 0 ? 0 : roomLights.filter((light) => cyanColorScore(light.color) > 0.48).length / roomLights.length;
    const floorGlowCount = roomLights.filter((light) => light.type === "floor_glow").length;
    const areaLightCount = roomLights.filter((light) => light.type === "area").length;
    const spotLightCount = roomLights.filter((light) => light.type === "spot").length;
    const museum = style.includes("museum") || style.includes("archive");
    const clinic = style.includes("clinic");
    const residential = style.includes("residential") || style.includes("home");
    const maintenance = style.includes("maintenance") || style.includes("lockdown");

    const exposureBase = 1.02 + (museum ? 0.08 : 0) + (clinic ? 0.12 : 0) + (residential ? 0.05 : 0) - (maintenance ? 0.02 : 0);
    const exposure = clampNumber(exposureBase + ambient * 0.10 + hemisphere * 0.05 - dynamicLightPressure * 0.055, 0.88, 1.28);
    const contrast = clampNumber(1.04 + (museum ? 0.09 : 0) + (maintenance ? 0.07 : 0) - (clinic ? 0.03 : 0) - lightDensity * 0.018, 0.94, 1.22);
    const saturation = clampNumber(1.00 + cyanLightShare * 0.05 + warmLightShare * 0.035 - bloom * 0.025, 0.92, 1.14);
    const warmth = clampNumber(0.46 + warmLightShare * 0.22 - cyanLightShare * 0.18 + (residential ? 0.08 : 0) - (clinic ? 0.05 : 0), 0.26, 0.68);
    const floorBounce = clampNumber(0.18 + floorGlowCount * 0.055 + areaLightCount * 0.032 + (residential ? 0.10 : 0) + (museum ? 0.06 : 0), 0.16, 0.46);
    const ceilingWash = clampNumber(0.14 + Math.min(0.12, height / 30) + areaLightCount * 0.04 + (clinic ? 0.08 : 0), 0.12, 0.40);
    const sideFill = clampNumber(0.12 + Math.min(0.10, Math.sqrt(area) / 70) + spotLightCount * 0.025 + (museum ? 0.04 : 0), 0.10, 0.32);
    const shadowDepth = clampNumber(0.72 + contrast * 0.12 - ambient * 0.08 - floorBounce * 0.08 + (maintenance ? 0.08 : 0), 0.62, 0.92);
    const edgeDensity = clampNumber((sx + sz) / Math.max(1, area) * 4.2, 0.18, 1.12);
    const ao = clampNumber(0.72 + edgeDensity * 0.18 + (museum ? 0.16 : 0) + (maintenance ? 0.12 : 0) - ambient * 0.10, 0.48, 1.14);
    const probe = clampNumber(0.64 + floorBounce * 0.72 + ceilingWash * 0.38 + sideFill * 0.42 + cyanLightShare * 0.10, 0.44, 1.08);
    const material = clampNumber(0.76 + contrast * 0.22 + (museum ? 0.08 : 0) + (clinic ? 0.05 : 0) - bloom * 0.04, 0.58, 1.08);
    const localLight = clampNumber(0.78 + lightDensity * 0.035 + floorGlowCount * 0.045 + areaLightCount * 0.035 + spotLightCount * 0.025, 0.58, 1.16);
    const shadowReceiver = clampNumber(0.62 + shadowDepth * 0.34 + (museum ? 0.08 : 0) - floorBounce * 0.10, 0.48, 0.98);

    profileByRoomId.set(room.id, {
      roomId: room.id,
      style,
      formula: "hp.raw.room-lighting-profile.v2",
      inputs: {
        area: roundNumber(area),
        height: roundNumber(height),
        roomLightCount: roomLights.length,
        floorGlowCount,
        areaLightCount,
        spotLightCount,
        dynamicLightPressure: roundNumber(dynamicLightPressure),
        warmLightShare: roundNumber(warmLightShare),
        cyanLightShare: roundNumber(cyanLightShare),
        edgeDensity: roundNumber(edgeDensity),
      },
      artist: {
        exposure: roundNumber(exposure),
        contrast: roundNumber(contrast),
        saturation: roundNumber(saturation),
        warmth: roundNumber(warmth),
      },
      bounce: {
        floor: roundNumber(floorBounce),
        ceiling: roundNumber(ceilingWash),
        side: roundNumber(sideFill),
        shadowDepth: roundNumber(shadowDepth),
      },
      algorithm: {
        ao: roundNumber(ao),
        probe: roundNumber(probe),
        material: roundNumber(material),
        localLight: roundNumber(localLight),
        shadowReceiver: roundNumber(shadowReceiver),
      },
    });
  }
  return [...profileByRoomId.values()];
}

function averageVisibleLightPressure(visibilityScenarios, roomId) {
  const scenarios = visibilityScenarios.filter((scenario) => scenario.currentRoomId === roomId);
  if (scenarios.length === 0) return 0;
  const sum = scenarios.reduce((total, scenario) => total + (scenario.snapshot?.visible?.dynamicLights ?? 0) / Math.max(1, scenario.snapshot?.budgets?.dynamicLights ?? 10), 0);
  return clampNumber(sum / scenarios.length, 0, 1);
}

function rawRoomLightingStyle(room, presentation) {
  return [
    room.skinKey,
    room.mood,
    room.aesthetic?.style,
    presentation?.roomKitId,
    presentation?.lightingPresetId,
    presentation?.lighting?.mood,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function warmColorScore(color) {
  const rgb = hexToRgb(color);
  return clampNumber(rgb[0] * 0.72 + rgb[1] * 0.34 - rgb[2] * 0.22, 0, 1);
}

function cyanColorScore(color) {
  const rgb = hexToRgb(color);
  return clampNumber(rgb[1] * 0.42 + rgb[2] * 0.58 - rgb[0] * 0.28, 0, 1);
}

function resolveLightTargetPosition(map, light, resolveRoomRelativePosition, resolveLightPosition) {
  if (light.target) return light.target;
  if (light.targetRoomRelative) {
    return resolveRoomRelativePosition(map, light.targetRoomId ?? light.roomId, light.targetRoomRelative);
  }
  const position = resolveLightPosition(map, light);
  return [position[0], 0.08, position[2]];
}
