import rawOfficialRoomPresentationRegistry from "./roomPresentationKits.json";
import type { LevelMapConfig, Vec3Tuple } from "./schema/levelConfig";
import type { RoomKitDefinition, RoomPresentationId, RoomPresentationRegistry, ResolvedRoomPresentation } from "./RoomPresentationTypes";
export type * from "./RoomPresentationTypes";

export const officialRoomPresentationRegistry = rawOfficialRoomPresentationRegistry as unknown as RoomPresentationRegistry;

export function resolveRoomPresentation(map?: LevelMapConfig | null): ResolvedRoomPresentation | null {
  const source = map?.presentation;
  if (!source) return null;

  const roomKit = source.roomKit ? resolveRoomKit(source.roomKit) : null;
  const overrides = { ...(roomKit?.overrides ?? {}), ...(source.overrides ?? {}) };
  const shellKitId = source.shellKit ?? overrides.shellKit ?? roomKit?.shellKit;
  const lightingPresetId = source.lightingPreset ?? overrides.lightingPreset ?? roomKit?.lightingPreset;
  const doorKitId = source.doorKit ?? overrides.doorKit ?? roomKit?.doorKit;
  const propSetId = source.propSet ?? overrides.propSet ?? roomKit?.defaultPropSet;
  const layoutAnchorSetId = roomKit?.layoutAnchorSet;
  const spawnLayoutId = source.spawnLayout ?? overrides.spawnLayout ?? roomKit?.spawnLayout;
  const pickupLayoutId = source.pickupLayout ?? overrides.pickupLayout ?? roomKit?.pickupLayout;
  const previewCameraId = source.previewCamera ?? roomKit?.previewCamera;

  return {
    source,
    roomKitId: source.roomKit,
    archetype: source.archetype ?? roomKit?.archetype,
    roomKit,
    shellKitId,
    shell: shellKitId ? officialRoomPresentationRegistry.shellKits[shellKitId] ?? null : null,
    lightingPresetId,
    lighting: lightingPresetId ? officialRoomPresentationRegistry.lightingPresets[lightingPresetId] ?? null : null,
    doorKitId,
    doorKit: doorKitId ? officialRoomPresentationRegistry.doorKits[doorKitId] ?? null : null,
    propSetId,
    propSet: propSetId ? officialRoomPresentationRegistry.propSets[propSetId] ?? null : null,
    layoutAnchorSetId,
    layoutAnchorSet: layoutAnchorSetId ? officialRoomPresentationRegistry.layoutAnchorSets[layoutAnchorSetId] ?? null : null,
    spawnLayoutId,
    spawnLayout: spawnLayoutId ? officialRoomPresentationRegistry.spawnLayouts[spawnLayoutId] ?? null : null,
    pickupLayoutId,
    pickupLayout: pickupLayoutId ? officialRoomPresentationRegistry.pickupLayouts[pickupLayoutId] ?? null : null,
    previewCameraId,
    previewCamera: previewCameraId ? officialRoomPresentationRegistry.previewCameras[previewCameraId] ?? null : null,
    overrides,
  };
}

export function resolveRoomRelativePosition(map: LevelMapConfig, roomId: string | undefined, position: Vec3Tuple): Vec3Tuple {
  const room = (roomId ? map.rooms.find((candidate) => candidate.id === roomId) : null) ?? largestRoom(map);
  if (!room) return position;
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  return [cx + position[0] * sx, position[1], cz + position[2] * sz];
}

export function isKnownRoomKitId(id: string) {
  return Object.prototype.hasOwnProperty.call(officialRoomPresentationRegistry.roomKits, id);
}

export function isKnownShellKitId(id: string) {
  return Object.prototype.hasOwnProperty.call(officialRoomPresentationRegistry.shellKits, id);
}

export function isKnownLightingPresetId(id: string) {
  return Object.prototype.hasOwnProperty.call(officialRoomPresentationRegistry.lightingPresets, id);
}

export function isKnownDoorKitId(id: string) {
  return Object.prototype.hasOwnProperty.call(officialRoomPresentationRegistry.doorKits, id);
}

export function isKnownPropSetId(id: string) {
  return Object.prototype.hasOwnProperty.call(officialRoomPresentationRegistry.propSets, id);
}

export function isKnownSpawnLayoutId(id: string) {
  return Object.prototype.hasOwnProperty.call(officialRoomPresentationRegistry.spawnLayouts, id);
}

export function isKnownPickupLayoutId(id: string) {
  return Object.prototype.hasOwnProperty.call(officialRoomPresentationRegistry.pickupLayouts, id);
}

export function isKnownPreviewCameraId(id: string) {
  return Object.prototype.hasOwnProperty.call(officialRoomPresentationRegistry.previewCameras, id);
}

function resolveRoomKit(id: RoomPresentationId, stack: readonly RoomPresentationId[] = []): RoomKitDefinition | null {
  const kit = officialRoomPresentationRegistry.roomKits[id];
  if (!kit) return null;
  if (!kit.extends) return kit;
  if (stack.includes(id)) return null;

  const parent = resolveRoomKit(kit.extends, [...stack, id]);
  if (!parent) return kit;
  return {
    ...parent,
    ...kit,
    id: kit.id,
    overrides: { ...(parent.overrides ?? {}), ...(kit.overrides ?? {}) },
  };
}

function largestRoom(map: LevelMapConfig) {
  return map.rooms.reduce<(typeof map.rooms)[number] | null>((largest, room) => {
    if (!largest) return room;
    const [, , largestZ] = largest.bounds.size;
    const [largestX] = largest.bounds.size;
    const [, , roomZ] = room.bounds.size;
    const [roomX] = room.bounds.size;
    return roomX * roomZ > largestX * largestZ ? room : largest;
  }, null);
}
