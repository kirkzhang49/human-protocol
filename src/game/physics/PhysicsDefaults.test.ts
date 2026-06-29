import { afterEach, describe, expect, it, vi } from "vitest";
import { GameWorld } from "../core/GameWorld";

describe("runtime physics defaults", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Rapier by default in browser runtime without URL params", () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();

    expect(world.debugOptions.physicsMode).toBe("rapier");
    expect(world.physics.mode).toBe("rapier");
  });

  it("keeps a legacy emergency escape hatch", () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=legacy",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();

    expect(world.debugOptions.physicsMode).toBe("legacy");
    expect(world.physics.mode).toBe("legacy");
  });
});
