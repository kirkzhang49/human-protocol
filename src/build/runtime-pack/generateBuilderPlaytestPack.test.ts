import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStarterProject } from "../BuilderTypes";
import { createMemoryRuntimePackBackend } from "./BuilderRuntimePackStore";
import { generateBuilderPlaytestPack } from "./generateBuilderPlaytestPack";
import type { CookedGlbLibrary } from "./cookGlbModels";

describe("generateBuilderPlaytestPack runtime-pack cache identity", () => {
  beforeEach(() => {
    installWindowStorage();
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
  });

  it("rebakes deep packs when the pointer record lacks the current config/runtime identity", async () => {
    const backend = createMemoryRuntimePackBackend();
    const project = { ...createStarterProject(), projectId: "proj_runtime_identity_test" };
    const first = await generateBuilderPlaytestPack(project, {
      mode: "deep",
      backend,
      headless: false,
      cookedLibraryForTests: emptyCookedLibrary(),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.cached).toBe(false);

    const staleRecord = await backend.get(first.packId);
    expect(staleRecord).not.toBeNull();
    if (!staleRecord) return;
    delete staleRecord.configHash;
    delete staleRecord.runtimeResourceHash;
    await backend.put(staleRecord);

    const second = await generateBuilderPlaytestPack(project, {
      mode: "deep",
      backend,
      headless: false,
      cookedLibraryForTests: emptyCookedLibrary(),
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.cached).toBe(false);
    expect(second.packId).not.toBe(first.packId);
  });
});

function emptyCookedLibrary(): CookedGlbLibrary {
  return {
    models: new Map(),
    missing: [],
    geometryBytes: 0,
    textureFallbackModels: [],
  };
}

function installWindowStorage() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      location: { search: "" },
      setTimeout: globalThis.setTimeout.bind(globalThis),
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
