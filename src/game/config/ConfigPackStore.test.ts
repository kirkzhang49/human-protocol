import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSingleLevelConfigPack,
  getLevelPlaytestMetadata,
  getBuiltInLevelConfig,
  getLevelConfig,
  loadCustomConfigPackSlots,
  saveCustomConfigPackFromText,
} from "./ConfigPackStore";
import { BUILDER_PLAYTEST_ENGINE_VERSION } from "./BuilderPlaytestVersion";
import type { LevelDefinition } from "./schema/levelConfig";

describe("ConfigPackStore generated playtest saves", () => {
  beforeEach(() => {
    installWindowStorage();
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
  });

  it("keeps manual conflict protection by default", () => {
    const level = generatedLevel("test_generated_level_conflict");
    const trialPack = createSingleLevelConfigPack(level, "dev-trial-test-generated-level-conflict");
    const generatedPack = createSingleLevelConfigPack({ ...level, title: "Updated Trial" }, "generated-test-generated-level-conflict");

    expect(saveCustomConfigPackFromText(JSON.stringify(trialPack)).ok).toBe(true);
    const blocked = saveCustomConfigPackFromText(JSON.stringify(generatedPack));

    expect(blocked.ok).toBe(false);
    expect(blocked.errors[0]?.code).toBe("pack.level.id.saved_conflict");
  });

  it("lets builder/trial saves replace older packs with the same level id", () => {
    const level = generatedLevel("test_generated_level_replace");
    const trialPack = createSingleLevelConfigPack(level, "dev-trial-test-generated-level-replace");
    const generatedPack = createSingleLevelConfigPack({ ...level, title: "Updated Builder Level" }, "generated-test-generated-level-replace");

    expect(saveCustomConfigPackFromText(JSON.stringify(trialPack)).ok).toBe(true);
    const replaced = saveCustomConfigPackFromText(JSON.stringify(generatedPack), { replaceExistingLevelIds: true });

    expect(replaced.ok).toBe(true);
    const slots = loadCustomConfigPackSlots();
    expect(slots).toHaveLength(1);
    expect(slots[0].pack.packId).toBe("generated-test-generated-level-replace");
    expect(slots[0].pack.levels[0].title).toBe("Updated Builder Level");
  });

  it("stores generated playtest metadata as a lightweight pack pointer", () => {
    const level = generatedLevel("test_generated_level_metadata");
    const pack = createSingleLevelConfigPack(level, "generated-test-generated-level-metadata");
    const saved = saveCustomConfigPackFromText(JSON.stringify(pack), {
      replaceExistingLevelIds: true,
      playtest: {
        runtimePackId: "pack_deep_latest",
        bakeMode: "cooked-glb",
        projectHash: "project-hash",
        configHash: "config-hash",
        runtimeResourceHash: "resource-hash",
        builderSnapshotId: "snapshot-id",
        engineVersion: BUILDER_PLAYTEST_ENGINE_VERSION,
        updatedAt: 123,
      },
    });

    expect(saved.ok).toBe(true);
    expect(getLevelPlaytestMetadata(level.id)).toEqual({
      runtimePackId: "pack_deep_latest",
      bakeMode: "cooked-glb",
      projectHash: "project-hash",
      configHash: "config-hash",
      runtimeResourceHash: "resource-hash",
      builderSnapshotId: "snapshot-id",
      engineVersion: BUILDER_PLAYTEST_ENGINE_VERSION,
      updatedAt: 123,
    });
  });

  it("ignores stale generated playtest config packs from older builder engines", () => {
    const level = generatedLevel("test_generated_level_stale_playtest");
    const pack = createSingleLevelConfigPack(level, "generated-test-generated-level-stale-playtest");

    expect(saveCustomConfigPackFromText(JSON.stringify(pack), {
      replaceExistingLevelIds: true,
      playtest: {
        runtimePackId: "pack_from_old_engine",
        bakeMode: "proxy",
        projectHash: "old-project-hash",
        engineVersion: "hp.builder.raw-runtime-pack.v67",
      },
    }).ok).toBe(true);

    expect(loadCustomConfigPackSlots()).toEqual([]);
    expect(getLevelPlaytestMetadata(level.id)).toBeNull();
    expect(getLevelConfig(level.id).id).not.toBe(level.id);
  });

  it("canonicalizes custom pack exit rooms to the shared elevator reference", () => {
    const base = generatedLevel("test_generated_exit_reference");
    const exitInteraction = base.map?.interactions.find((interaction) => interaction.type === "exit");
    const exitRoomId = exitInteraction?.roomId;
    expect(exitRoomId).toBeTruthy();

    const drifted: LevelDefinition = {
      ...base,
      map: {
        ...base.map!,
        doors: base.map!.doors.map((door) =>
          door.id === exitInteraction?.opensDoorId ? driftExitDoorVisual(door) : door,
        ),
        interactions: base.map!.interactions.map((interaction) =>
          interaction.id === exitInteraction?.id ? { ...interaction, visualKey: "exit_panel", materialKey: "terminal_red" } : interaction,
        ),
        props: [
          ...(base.map!.props ?? []),
          {
            id: "handwritten_exit_console",
            roomId: exitRoomId!,
            modelKey: "terminal_code_keypad",
            position: [0, 0, 0],
          },
        ],
      },
    };

    const pack = createSingleLevelConfigPack(drifted, "generated-exit-reference-pack");
    expectCanonicalExitReference(pack.levels[0]);
    expect(saveCustomConfigPackFromText(JSON.stringify(pack)).ok).toBe(true);
    expectCanonicalExitReference(getLevelConfig(drifted.id));
  });
});

function expectCanonicalExitReference(level: LevelDefinition) {
  const exitInteraction = level.map?.interactions.find((interaction) => interaction.type === "exit");
  expect(exitInteraction).toMatchObject({
    visualKey: "service_elevator_panel",
    materialKey: "terminal_cyan",
  });
  const exitRoomId = exitInteraction?.roomId;
  const exitRoom = level.map?.rooms.find((room) => room.id === exitRoomId);
  expect(exitRoom).toMatchObject({
    skinKey: "service_elevator_hero",
    floorMaterialKey: "service_elevator_metal",
    wallMaterialKey: "service_elevator_metal",
    aesthetic: { style: "exit" },
  });
  const exitDoor = level.map?.doors.find((door) => door.id === exitInteraction?.opensDoorId);
  expect(exitDoor).toMatchObject({
    skinKey: "service_elevator_hero",
    visualKey: "service_elevator_door",
    materialKey: "service_elevator_metal",
  });
  expect(level.map?.props?.filter((prop) => prop.roomId === exitRoomId).map((prop) => prop.modelKey).sort()).toEqual([
    "door_threshold_service_elevator",
    "service_elevator_ascent_shaft_fx",
    "service_elevator_call_buttons",
    "service_elevator_exit_stage",
    "service_elevator_interior_shell",
  ]);
}

function driftExitDoorVisual(door: NonNullable<LevelDefinition["map"]>["doors"][number]) {
  const { skinKey: _skinKey, ...withoutSkin } = door;
  return { ...withoutSkin, visualKey: "yellow_access_door", materialKey: "yellow_access_metal" };
}

function generatedLevel(id: string): LevelDefinition {
  return {
    ...getBuiltInLevelConfig("level_01_maintenance_bay"),
    id,
    title: "Generated Test Level",
    authoringProfile: "generated",
  };
}

function installWindowStorage() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      location: { search: "" },
    },
  });
}

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}
