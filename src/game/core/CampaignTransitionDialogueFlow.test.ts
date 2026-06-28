import { describe, expect, it } from "vitest";
import { SceneFlowSystem } from "../systems/SceneFlowSystem";
import { GameWorld } from "./GameWorld";

describe("campaign elevator transition dialogue flow", () => {
  it("shows the authored branch dialogue only after the elevator cinematic finishes", () => {
    const world = new GameWorld();
    const sceneFlow = new SceneFlowSystem();

    world.loadLevel("level_02_residential_simulation", "playing");
    world.unlockExit();
    world.beginExitCinematic("interaction");

    const cinematic = world.session.activeExitCinematic;
    expect(cinematic).toBeTruthy();
    expect(world.session.mode).toBe("exitCinematic");
    expect(world.session.activeCampaignTransitionDialogue).toBeNull();

    if (!cinematic) return;
    world.exitFlow.update(world, cinematic.duration + 0.1);

    expect(world.session.mode).toBe("transition");
    expect(world.session.activeCampaignTransitionDialogue).toMatchObject({
      fromLevelId: "level_02_residential_simulation",
      toLevelId: "level_03_human_museum",
      lineIndex: 0,
    });
    expect(world.session.activeExitCinematic).toBeTruthy();

    sceneFlow.update(world, 99);
    expect(world.session.mode).toBe("transition");
    expect(world.session.activeCampaignTransitionDialogue?.lineIndex).toBe(0);

    expect(world.advanceCampaignTransitionDialogue()).toBe(false);
    expect(world.advanceCampaignTransitionDialogue()).toBe(false);
    expect(world.advanceCampaignTransitionDialogue()).toBe(false);
    expect(world.session.activeCampaignTransitionDialogue?.lineIndex).toBe(3);

    expect(world.advanceCampaignTransitionDialogue()).toBe(true);
    expect(world.session.activeCampaignTransitionDialogue).toBeNull();
    expect(world.session.activeExitCinematic).toBeNull();
    expect(world.session.mode).toBe("victory");
  });

  it("leaves the level 1 to level 2 branch on the original transition flow", () => {
    const world = new GameWorld();

    world.loadLevel("level_01_maintenance_bay", "playing");
    world.beginExitTransition("script");

    expect(world.session.mode).toBe("transition");
    expect(world.session.activeCampaignTransitionDialogue).toBeNull();
  });

  it("leaves the final level 5 transition on the normal victory flow", () => {
    const world = new GameWorld();
    const sceneFlow = new SceneFlowSystem();

    world.loadLevel("level_05_reclamation_core", "playing");
    world.unlockExit();
    world.beginExitCinematic("interaction");

    const cinematic = world.session.activeExitCinematic;
    expect(cinematic).toBeTruthy();
    expect(world.session.mode).toBe("exitCinematic");

    if (!cinematic) return;
    world.exitFlow.update(world, cinematic.duration + 0.1);

    expect(world.session.mode).toBe("transition");
    expect(world.session.activeCampaignTransitionDialogue).toBeNull();

    sceneFlow.update(world, 99);
    expect(world.session.mode).toBe("victory");
  });
});
