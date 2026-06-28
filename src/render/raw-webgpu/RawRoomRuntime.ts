import { isExitCinematicViewActive } from "../../game/core/ExitCinematicView";
import type { GameWorld } from "../../game/core/GameWorld";
import type { RenderQualityTier } from "../../game/core/RenderPerformance";
import type { PickupType } from "../../game/entities/EntityTypes";
import { defaultLightingProfile } from "./RawWebGpuLighting";
import { rawHeroFloorEnabled } from "./RawWebGpuQuality";
import type {
  RawPlanInstance,
  RawPlanRoom,
  RawRenderPlan,
  RawRoomLightingProfile,
  RawVisibilityScenario,
  ResolvedRoomLightingProfile,
} from "./RawWebGpuTypes";

export interface RawRoomFrame {
  currentRoomId: string;
  currentRoom: RawPlanRoom | null;
  scenario: RawVisibilityScenario | null;
  visibleRoomIds: Set<string>;
  visibleDoorIds: Set<string>;
  lightingProfile: ResolvedRoomLightingProfile;
  visibilityKey: string;
}

interface RawDoorRevealLink {
  doorId: string;
  roomA: string;
  roomB: string;
}

export class RawRoomRuntime {
  private readonly roomById: Map<string, RawPlanRoom>;
  private readonly lightingProfileByRoomId: Map<string, RawRoomLightingProfile>;
  private readonly openDoorRevealLinks: RawDoorRevealLink[];
  private readonly hasExitStageInstance: boolean;
  private readonly exitStageRoomIds: Set<string>;

  constructor(private readonly plan: RawRenderPlan) {
    this.roomById = new Map(plan.rooms.map((room) => [room.id, room]));
    this.lightingProfileByRoomId = new Map((plan.lightingProfiles ?? []).map((profile) => [profile.roomId, profile]));
    this.openDoorRevealLinks = createOpenDoorRevealLinks(plan.instances ?? []);
    this.exitStageRoomIds = new Set(
      (plan.instances ?? [])
        .filter((instance) => isExitElevatorStageModelKey(instance.modelKey) && instance.roomId)
        .map((instance) => instance.roomId as string),
    );
    this.hasExitStageInstance = this.exitStageRoomIds.size > 0;
  }

  frame(world: GameWorld): RawRoomFrame {
    const currentRoomId = this.currentRoomId(world);
    const tier = world.renderPerformance.quality.tier;
    const scenario = this.scenarioFor(currentRoomId, tier);
    const visibleRoomIds = new Set(scenario?.visibleRoomIds ?? this.plan.rooms.map((room) => room.id));
    const visibleDoorIds = new Set(scenario?.visibleDoorIds ?? []);
    // During a focus reveal the rotate-only camera stays in the player's room, so
    // we keep currentRoom/lighting on the player's room (the camera's room renders
    // correctly) and ADD the revealed room (+ its baked scenario) to the visible
    // set — so a route-opened room the player's own scenario excludes still shows
    // through the door, instead of swapping the whole current room (which misframed
    // the reveal and could pop geometry above the ceiling line).
    const reveal = world.session.activeFocusReveal;
    if (reveal?.roomId && this.roomById.has(reveal.roomId)) {
      this.addVisibleRoomWithScenario(reveal.roomId, tier, visibleRoomIds, visibleDoorIds);
    }
    this.addRevealedDoorRooms(world, tier, visibleRoomIds, visibleDoorIds);
    this.addRoomsBehindOpenedDoors(world, visibleRoomIds, visibleDoorIds);
    this.addDoorsTouchingVisibleRooms(visibleRoomIds, visibleDoorIds);
    return {
      currentRoomId,
      currentRoom: this.roomById.get(currentRoomId) ?? null,
      scenario,
      visibleRoomIds,
      visibleDoorIds,
      lightingProfile: this.lightingProfileFor(currentRoomId),
      visibilityKey: this.visibilityKey(world, currentRoomId),
    };
  }

  private addRoomsBehindOpenedDoors(world: GameWorld, visibleRoomIds: Set<string>, visibleDoorIds: Set<string>) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const link of this.openDoorRevealLinks) {
        if (!world.isDoorOpen(link.doorId)) continue;
        const roomAVisible = visibleRoomIds.has(link.roomA);
        const roomBVisible = visibleRoomIds.has(link.roomB);
        if (!roomAVisible && !roomBVisible) continue;
        visibleDoorIds.add(link.doorId);
        if (roomAVisible || !this.roomById.has(link.roomA)) {
          if (!roomBVisible && this.roomById.has(link.roomB)) {
            visibleRoomIds.add(link.roomB);
            changed = true;
          }
        } else if (this.roomById.has(link.roomA)) {
          visibleRoomIds.add(link.roomA);
          changed = true;
        }
      }
    }
  }

  private addRevealedDoorRooms(world: GameWorld, tier: RenderQualityTier, visibleRoomIds: Set<string>, visibleDoorIds: Set<string>) {
    const reveal = world.session.activeFocusReveal;
    if (reveal?.kind !== "door" || !reveal.targetId) return;
    const link = this.openDoorRevealLinks.find((candidate) => candidate.doorId === reveal.targetId);
    if (!link) return;
    visibleDoorIds.add(link.doorId);
    this.addVisibleRoomWithScenario(link.roomA, tier, visibleRoomIds, visibleDoorIds);
    this.addVisibleRoomWithScenario(link.roomB, tier, visibleRoomIds, visibleDoorIds);
  }

  private addVisibleRoomWithScenario(roomId: string, tier: RenderQualityTier, visibleRoomIds: Set<string>, visibleDoorIds: Set<string>) {
    if (!this.roomById.has(roomId)) return;
    visibleRoomIds.add(roomId);
    const scenario = this.scenarioFor(roomId, tier);
    scenario?.visibleRoomIds?.forEach((visibleRoomId) => visibleRoomIds.add(visibleRoomId));
    scenario?.visibleDoorIds?.forEach((doorId) => visibleDoorIds.add(doorId));
  }

  private addDoorsTouchingVisibleRooms(visibleRoomIds: Set<string>, visibleDoorIds: Set<string>) {
    for (const link of this.openDoorRevealLinks) {
      if (visibleRoomIds.has(link.roomA) || visibleRoomIds.has(link.roomB)) {
        visibleDoorIds.add(link.doorId);
      }
    }
  }

  roomBoundsFor(world: GameWorld, fallbackSize: [number, number, number]) {
    const currentRoom = this.roomById.get(this.currentRoomId(world));
    return {
      center: currentRoom?.bounds.center ?? [world.player.position.x, world.player.position.y, world.player.position.z],
      size: currentRoom?.bounds.size ?? fallbackSize,
    };
  }

  shouldDrawHeroFloor(world: GameWorld) {
    return rawHeroFloorEnabled() && !this.plan.officialBuilderSurfaceBridge?.enabled && this.currentRoomId(world).startsWith("level_03_");
  }

  isWorldPositionVisible(x: number, z: number, visibleRoomIds: Set<string>) {
    const roomId = this.roomIdForPosition(x, z);
    return roomId === null || visibleRoomIds.has(roomId);
  }

  isServiceElevatorExitRoom(roomId: string | null | undefined) {
    if (!roomId) return false;
    const room = this.roomById.get(roomId);
    return this.exitStageRoomIds.has(roomId) || room?.skinKey === "service_elevator_hero";
  }

  currentRoomId(world: GameWorld) {
    // The "current room" is always where the PLAYER (and the rotate-only reveal
    // camera) actually stands, so lighting and the camera's own room render
    // correctly. The revealed room is force-added to the visible set in frame()
    // rather than swapping the whole current room — the camera no longer flies
    // into the revealed room, so swapping it just misframed the shot.
    return world.session.mapProgress.currentRoomId ?? this.roomIdForPosition(world.player.position.x, world.player.position.z) ?? this.plan.rooms[0]?.id ?? "";
  }

  isPlanInstanceVisible(
    world: GameWorld,
    instance: RawPlanInstance,
    visibleRoomIds: Set<string>,
    visibleDoorIds: Set<string>,
    doorProgress: (doorId: string) => number = () => 1,
    doorHidesHardware: (doorId: string) => boolean = () => false,
  ) {
    if (isExitCinematicStageOnly(world)) {
      if (this.hasExitStageInstance) {
        if (!isExitElevatorStageModelKey(instance.modelKey)) return false;
      } else if (!isExitCinematicStageInstance(instance)) {
        return false;
      }
      if (instance.tags?.includes("cinematic_reveal") && !isExitCinematicRevealVisible(world)) return false;
      return true;
    }

    if (instance.roomId && this.exitStageRoomIds.has(instance.roomId) && isExitStageFallbackInstance(instance)) return false;
    if (instance.tags?.includes("raw_asset_seed")) return false;
    if (instance.role === "door_leaf" && instance.state?.doorId && world.isDoorOpen(instance.state.doorId)) {
      // No animation → hide the closed leaf immediately as before. With an
      // animation, keep the leaf visible while it lifts and only hide the
      // closed-style hardware once it is mostly open (matches the Three door
      // renderer's >0.82 threshold) so the slow-open is actually visible.
      if (!instance.state.openAnimation) return false;
      if (instance.state.openVisualPolicy?.hideClosedHardwareAfterOpen && doorProgress(instance.state.doorId) >= 0.82) {
        return false;
      }
    }
    // The door-status / hardware panel (role "door_panel") is a sibling of the
    // leaf with no animation state of its own. It lifts with the leaf (see
    // openDoorVisualOffset) so it never floats; once a door whose policy hides
    // closed hardware is mostly open, retire the lifted panel too so the
    // hardware does not hover above the doorway — mirrors the leaf rule above.
    if (instance.role === "door_panel" && instance.visibility.type === "door") {
      const doorId = instance.visibility.doorId;
      if (doorId && world.isDoorOpen(doorId) && doorHidesHardware(doorId) && doorProgress(doorId) >= 0.82) {
        return false;
      }
    }
    if (instance.role.startsWith("pickup_")) {
      const pickupType = instance.state?.type;
      if (pickupType === "coreCell") return false;
      if (isRuntimePickupType(pickupType) && !hasMatchingRuntimePickup(world, instance, pickupType)) return false;
    }
    if (!isConfiguredKeyItemInstanceVisible(world, instance)) return false;
    if (
      instance.state?.interactionId &&
      instance.state.type !== "exit" &&
      world.session.mapProgress.completedInteractionIds.includes(instance.state.interactionId) &&
      !keepCompletedRawInteractionVisual(instance)
    ) {
      return false;
    }
    if (instance.tags?.includes("cinematic_reveal") && !isExitCinematicRevealVisible(world)) return false;

    const visibility = instance.visibility;
    if (visibility.type === "door") {
      return Boolean(visibility.doorId && visibleDoorIds.has(visibility.doorId));
    }
    if (visibility.type === "key-item") {
      return Boolean(instance.roomId && visibleRoomIds.has(instance.roomId));
    }
    if (visibility.type === "pickup") {
      return Boolean(instance.roomId && visibleRoomIds.has(instance.roomId));
    }
    return Boolean(!instance.roomId || visibleRoomIds.has(instance.roomId));
  }

  private roomIdForPosition(x: number, z: number) {
    for (const room of this.plan.rooms) {
      const halfX = room.bounds.size[0] * 0.5;
      const halfZ = room.bounds.size[2] * 0.5;
      if (
        x >= room.bounds.center[0] - halfX &&
        x <= room.bounds.center[0] + halfX &&
        z >= room.bounds.center[2] - halfZ &&
        z <= room.bounds.center[2] + halfZ
      ) {
        return room.id;
      }
    }
    return null;
  }

  private scenarioFor(roomId: string, tier: RenderQualityTier) {
    return (
      this.plan.visibilityScenarios.find((scenario) => scenario.currentRoomId === roomId && scenario.qualityTier === tier) ??
      this.plan.visibilityScenarios.find((scenario) => scenario.currentRoomId === roomId) ??
      this.plan.visibilityScenarios[0] ??
      null
    );
  }

  private lightingProfileFor(roomId: string): ResolvedRoomLightingProfile {
    const profile = this.lightingProfileByRoomId.get(roomId) ?? defaultLightingProfile;
    const resolved = {
      artist: {
        exposure: profile.artist?.exposure ?? defaultLightingProfile.artist.exposure,
        contrast: profile.artist?.contrast ?? defaultLightingProfile.artist.contrast,
        saturation: profile.artist?.saturation ?? defaultLightingProfile.artist.saturation,
        warmth: profile.artist?.warmth ?? defaultLightingProfile.artist.warmth,
      },
      bounce: {
        floor: profile.bounce?.floor ?? defaultLightingProfile.bounce.floor,
        ceiling: profile.bounce?.ceiling ?? defaultLightingProfile.bounce.ceiling,
        side: profile.bounce?.side ?? defaultLightingProfile.bounce.side,
        shadowDepth: profile.bounce?.shadowDepth ?? defaultLightingProfile.bounce.shadowDepth,
      },
      algorithm: {
        ao: profile.algorithm?.ao ?? defaultLightingProfile.algorithm.ao,
        probe: profile.algorithm?.probe ?? defaultLightingProfile.algorithm.probe,
        material: profile.algorithm?.material ?? defaultLightingProfile.algorithm.material,
        localLight: profile.algorithm?.localLight ?? defaultLightingProfile.algorithm.localLight,
        shadowReceiver: profile.algorithm?.shadowReceiver ?? defaultLightingProfile.algorithm.shadowReceiver,
        specular: profile.algorithm?.specular ?? defaultLightingProfile.algorithm.specular,
        contact: profile.algorithm?.contact ?? defaultLightingProfile.algorithm.contact,
        wallGuard: profile.algorithm?.wallGuard ?? defaultLightingProfile.algorithm.wallGuard,
      },
    };
    if (this.isServiceElevatorExitRoom(roomId)) return serviceElevatorExitLightingProfile();
    return this.plan.level.id === "level_03_human_museum" ? stabilizeHumanMuseumLightingProfile(resolved) : resolved;
  }

  private visibilityKey(world: GameWorld, currentRoomId: string) {
    return [
      world.renderPerformance.quality.tier,
      currentRoomId,
      world.session.activeFocusReveal?.roomId ?? "",
      world.session.activeFocusReveal?.targetId ?? "",
      world.session.mode,
      world.session.mapProgress.openedDoorIds.join(","),
      world.session.mapProgress.collectedKeyItemIds.join(","),
      world.session.mapProgress.completedInteractionIds.join(","),
    ].join("|");
  }
}

function isExitCinematicStageOnly(world: GameWorld) {
  return isExitCinematicViewActive(world);
}

function createOpenDoorRevealLinks(instances: readonly RawPlanInstance[]): RawDoorRevealLink[] {
  const links = new Map<string, RawDoorRevealLink>();
  for (const instance of instances) {
    if (instance.visibility.type !== "door") continue;
    const doorId = instance.visibility.doorId ?? instance.state?.doorId;
    if (!doorId || !instance.roomId || !instance.secondaryRoomId || instance.roomId === instance.secondaryRoomId) continue;
    if (!links.has(doorId)) {
      links.set(doorId, {
        doorId,
        roomA: instance.roomId,
        roomB: instance.secondaryRoomId,
      });
    }
  }
  return [...links.values()];
}

function isExitCinematicStageInstance(instance: RawPlanInstance) {
  const modelKey = instance.modelKey;
  return (
    isExitElevatorStageModelKey(modelKey) ||
    modelKey === "service_elevator_interior_shell" ||
    modelKey === "builder:prop:service_elevator_interior_shell" ||
    modelKey === "door_threshold_service_elevator" ||
    modelKey === "builder:prop:door_threshold_service_elevator" ||
    modelKey === "service_elevator_call_buttons" ||
    modelKey === "builder:prop:service_elevator_call_buttons" ||
    modelKey === "service_elevator_ascent_shaft_fx" ||
    modelKey === "builder:prop:service_elevator_ascent_shaft_fx" ||
    modelKey === "door_service_elevator_inner_cyan"
  );
}

function keepCompletedRawInteractionVisual(instance: RawPlanInstance) {
  const key = `${instance.modelKey}:${instance.id}`;
  return (
    instance.modelKey === "hp_wall_door_switch_button_v1" ||
    instance.modelKey.startsWith("puzzle_console_") ||
    key.includes("wall_door_switch") ||
    key.includes("puzzle_console_")
  );
}

function isExitStageFallbackInstance(instance: RawPlanInstance) {
  const modelKey = instance.modelKey;
  return (
    modelKey === "service_elevator_interior_shell" ||
    modelKey === "builder:prop:service_elevator_interior_shell" ||
    modelKey === "door_threshold_service_elevator" ||
    modelKey === "builder:prop:door_threshold_service_elevator" ||
    modelKey === "service_elevator_call_buttons" ||
    modelKey === "builder:prop:service_elevator_call_buttons" ||
    modelKey === "service_elevator_ascent_shaft_fx" ||
    modelKey === "builder:prop:service_elevator_ascent_shaft_fx" ||
    modelKey === "door_service_elevator_inner_cyan"
  );
}

function isExitElevatorStageModelKey(modelKey: string | null | undefined) {
  return modelKey === "service_elevator_exit_stage" || modelKey === "builder:prop:service_elevator_exit_stage";
}

function isExitCinematicRevealVisible(world: GameWorld) {
  const cinematic = world.session.activeExitCinematic;
  if (!isExitCinematicViewActive(world) || !cinematic) return false;
  return cinematic.elapsed >= cinematic.buttonPressTime - Math.max(0.2, cinematic.buttonPressDuration);
}

function serviceElevatorExitLightingProfile(): ResolvedRoomLightingProfile {
  return {
    artist: {
      exposure: 0.7,
      contrast: 1.55,
      saturation: 0.98,
      warmth: 0.14,
    },
    bounce: {
      floor: 0.018,
      ceiling: 0.048,
      side: 0.03,
      shadowDepth: 1.02,
    },
    algorithm: {
      ao: 1.14,
      probe: 0.16,
      material: 1.2,
      localLight: 1.22,
      shadowReceiver: 1.08,
      specular: 1.52,
      contact: 1.34,
      wallGuard: 0.58,
    },
  };
}

function hasMatchingRuntimePickup(world: GameWorld, instance: RawPlanInstance, type: GameWorld["pickups"][number]["type"]) {
  const [x, , z] = instance.position;
  return world.pickups.some((pickup) => {
    if (pickup.collected || pickup.type !== type) return false;
    const dx = pickup.position.x - x;
    const dz = pickup.position.z - z;
    return dx * dx + dz * dz < 0.85 * 0.85;
  });
}

function isRuntimePickupType(type: unknown): type is PickupType {
  return type === "coreCell" || type === "repairKit" || type === "ironRod" || type === "pistol" || type === "breachMissile";
}

function isConfiguredKeyItemInstanceVisible(world: GameWorld, instance: RawPlanInstance) {
  const keyItemId = keyItemIdForInstance(instance);
  if (!keyItemId) return true;
  if (world.session.mapProgress.collectedKeyItemIds.includes(keyItemId)) return false;
  const item = world.level.map?.keyItems.find((candidate) => candidate.id === keyItemId);
  if (item && !world.isConfiguredKeyItemAvailable(item)) return false;
  return true;
}

function keyItemIdForInstance(instance: RawPlanInstance) {
  if (instance.visibility.type === "key-item") return instance.visibility.keyItemId ?? instance.state?.keyItemId ?? null;
  return instance.state?.keyItemId ?? null;
}

function stabilizeHumanMuseumLightingProfile(profile: ResolvedRoomLightingProfile): ResolvedRoomLightingProfile {
  return {
    artist: {
      exposure: clamp(profile.artist.exposure, 1.08, 1.28),
      contrast: clamp(profile.artist.contrast, 1.0, 1.16),
      saturation: clamp(profile.artist.saturation, 0.96, 1.12),
      warmth: clamp(profile.artist.warmth, 0.42, 0.56),
    },
    bounce: {
      floor: clamp(profile.bounce.floor, 0.16, 0.28),
      ceiling: clamp(profile.bounce.ceiling, 0.46, 0.76),
      side: clamp(profile.bounce.side, 0.5, 0.82),
      shadowDepth: clamp(profile.bounce.shadowDepth, 0.5, 0.72),
    },
    algorithm: {
      ao: clamp(profile.algorithm.ao, 0.45, 0.68),
      probe: clamp(profile.algorithm.probe, 0.72, 1.0),
      material: clamp(profile.algorithm.material, 1.02, 1.22),
      localLight: clamp(profile.algorithm.localLight, 0.95, 1.28),
      shadowReceiver: clamp(profile.algorithm.shadowReceiver, 0.5, 0.74),
      specular: clamp(profile.algorithm.specular, 0.94, 1.16),
      contact: clamp(profile.algorithm.contact, 0.72, 0.94),
      wallGuard: clamp(profile.algorithm.wallGuard, 0.42, 0.68),
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
