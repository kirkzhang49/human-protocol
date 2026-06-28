import { describe, expect, it } from "vitest";
import { InteractionSystem } from "./InteractionSystem";

function createWorld(overrides: any = {}) {
  const base = {
    session: {
      mode: "playing",
      exitUnlocked: false,
      mapProgress: {
        completedInteractionIds: [],
        collectedKeyItemIds: [],
      },
    },
    input: { interactPressed: false },
    player: { position: { x: 0, z: 0 } },
    level: {
      map: {
        keyItems: [],
        interactions: [],
        doors: [],
      },
      articles: [],
      puzzles: [],
      objectiveChain: [],
    },
    setInteractionPrompt: () => undefined,
    setSpawnWarning: () => undefined,
    articleForInteraction: () => null,
    isArticleRead: () => false,
    toolCalibrationPuzzleForInteraction: () => null,
    activeSwitchStateId: () => null,
    routeSwitchForInteraction: () => null,
    quizForInteraction: () => null,
    canUseQuiz: () => false,
    codeLockPuzzleForInteraction: () => null,
    canUseCodeLockPuzzle: () => false,
    bigScreenForInteraction: () => null,
    switchForInteraction: () => null,
    sequencePlaybackPuzzleForInteraction: () => null,
    circuitGridPuzzleForInteraction: () => null,
    surveillancePuzzleForInteraction: () => null,
    valveMatrixPuzzleForInteraction: () => null,
    archiveMergePuzzleForInteraction: () => null,
    galleryReadingPuzzleForInteraction: () => null,
    isPuzzleCompleted: () => false,
    canOpenDoor: () => false,
    isDoorOpen: () => false,
    isObjectiveCompleted: () => false,
  };

  return {
    ...base,
    ...overrides,
    session: {
      ...base.session,
      ...overrides.session,
      mapProgress: {
        ...base.session.mapProgress,
        ...overrides.session?.mapProgress,
      },
    },
    input: {
      ...base.input,
      ...overrides.input,
    },
    player: {
      ...base.player,
      ...overrides.player,
      position: {
        ...base.player.position,
        ...overrides.player?.position,
      },
    },
    level: {
      ...base.level,
      ...overrides.level,
      map: {
        ...base.level.map,
        ...overrides.level?.map,
      },
    },
  };
}

describe("InteractionSystem article interactions", () => {
  it("keeps read wall-art articles interactable after their interaction is completed", () => {
    let prompt: unknown = null;
    const interaction = {
      id: "story_level_03_tool_human_origin_wall_art",
      type: "article",
      roomId: "level_03_tool_exhibit",
      position: [0, 0, 0],
      radius: 1.6,
      visualKey: "none",
      label: "人类起源壁画",
    };
    const article = {
      id: "level_03_human_origin_article",
      interactionId: interaction.id,
      title: "人类起源",
      pages: [],
    };
    const world = {
      session: {
        mode: "playing",
        exitUnlocked: false,
        mapProgress: {
          completedInteractionIds: [interaction.id],
          collectedKeyItemIds: [],
        },
      },
      input: { interactPressed: false },
      player: { position: { x: 0, z: 0 } },
      level: {
        map: {
          keyItems: [],
          interactions: [interaction],
          doors: [],
        },
        articles: [article],
        puzzles: [],
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      articleForInteraction(id: string) {
        return id === interaction.id ? article : null;
      },
      isArticleRead: () => true,
      toolCalibrationPuzzleForInteraction: () => null,
      activeSwitchStateId: () => null,
      routeSwitchForInteraction: () => null,
      quizForInteraction: () => null,
      canUseQuiz: () => false,
      codeLockPuzzleForInteraction: () => null,
      bigScreenForInteraction: () => null,
      switchForInteraction: () => null,
      sequencePlaybackPuzzleForInteraction: () => null,
      circuitGridPuzzleForInteraction: () => null,
      surveillancePuzzleForInteraction: () => null,
      valveMatrixPuzzleForInteraction: () => null,
      archiveMergePuzzleForInteraction: () => null,
      galleryReadingPuzzleForInteraction: () => null,
      isPuzzleCompleted: () => false,
      canOpenDoor: () => false,
      isDoorOpen: () => false,
    };

    new InteractionSystem().update(world as any);

    expect(prompt).toMatchObject({
      id: interaction.id,
      label: interaction.label,
      detail: "阅读",
      canInteract: true,
    });
  });

  it("blocks puzzle interactions until required paintings have been read", () => {
    let prompt: unknown = null;
    let warning: unknown = null;
    let openedGallery = false;
    const interaction = {
      id: "pz_memory_gate_panel",
      type: "terminal",
      roomId: "memory_gallery",
      position: [0, 0, 0],
      radius: 1.6,
      visualKey: "none",
      label: "记忆审读机",
      requiresArticleIds: ["article_l4_story_awakened_machine_image2_v1_prop_a"],
    };
    const world = {
      session: {
        mode: "playing",
        exitUnlocked: false,
        mapProgress: {
          completedInteractionIds: [],
          collectedKeyItemIds: [],
        },
      },
      input: { interactPressed: true },
      player: { position: { x: 0, z: 0 } },
      level: {
        map: {
          keyItems: [],
          interactions: [interaction],
          doors: [],
        },
        articles: [],
        puzzles: [],
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      setSpawnWarning(next: unknown) {
        warning = next;
      },
      articleForInteraction: () => null,
      isArticleRead: () => false,
      toolCalibrationPuzzleForInteraction: () => null,
      activeSwitchStateId: () => null,
      routeSwitchForInteraction: () => null,
      quizForInteraction: () => null,
      canUseQuiz: () => false,
      codeLockPuzzleForInteraction: () => null,
      canUseCodeLockPuzzle: () => false,
      bigScreenForInteraction: () => null,
      switchForInteraction: () => null,
      sequencePlaybackPuzzleForInteraction: () => null,
      circuitGridPuzzleForInteraction: () => null,
      surveillancePuzzleForInteraction: () => null,
      valveMatrixPuzzleForInteraction: () => null,
      archiveMergePuzzleForInteraction: () => null,
      galleryReadingPuzzleForInteraction: () => ({ id: "pz_memory_gate" }),
      openGalleryReading: () => {
        openedGallery = true;
      },
      isPuzzleCompleted: () => false,
      canOpenDoor: () => false,
      isDoorOpen: () => false,
    };

    new InteractionSystem().update(world as any);

    expect(prompt).toMatchObject({
      id: interaction.id,
      label: interaction.label,
      detail: "先读画作 0/1",
      canInteract: false,
    });
    expect(warning).toMatchObject({ label: interaction.label, detail: "先读画作 0/1" });
    expect(openedGallery).toBe(false);
  });

  it("does not offer E prompts for locked survive-wave doors", () => {
    let prompt: unknown = "unchanged";
    const door = {
      id: "living_gate",
      label: "家政维修间门",
      fromRoomId: "living",
      toRoomId: "care",
      position: [0, 0, 0],
      size: [3, 3, 0.4],
      yaw: 0,
      defaultState: "locked",
      lock: {
        type: "survive_wave",
        waveId: "builder_living_gate_1",
        lockedMessage: "清掉守门组，门才会开。",
      },
    };
    const world = {
      session: {
        mode: "playing",
        exitUnlocked: false,
        mapProgress: {
          completedInteractionIds: [],
          collectedKeyItemIds: [],
        },
      },
      input: { interactPressed: false },
      player: { position: { x: 0, z: 0 } },
      level: {
        map: {
          keyItems: [],
          interactions: [],
          doors: [door],
        },
        articles: [],
        puzzles: [],
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      articleForInteraction: () => null,
      isArticleRead: () => false,
      toolCalibrationPuzzleForInteraction: () => null,
      activeSwitchStateId: () => null,
      routeSwitchForInteraction: () => null,
      quizForInteraction: () => null,
      canUseQuiz: () => false,
      codeLockPuzzleForInteraction: () => null,
      bigScreenForInteraction: () => null,
      switchForInteraction: () => null,
      sequencePlaybackPuzzleForInteraction: () => null,
      circuitGridPuzzleForInteraction: () => null,
      surveillancePuzzleForInteraction: () => null,
      valveMatrixPuzzleForInteraction: () => null,
      archiveMergePuzzleForInteraction: () => null,
      galleryReadingPuzzleForInteraction: () => null,
      isPuzzleCompleted: () => false,
      canOpenDoor: () => false,
      isDoorOpen: () => false,
    };

    new InteractionSystem().update(world as any);

    expect(prompt).toBeNull();
  });

  it.each(["wall_button", "wall_lever"] as const)("offers usable %s controls from the front within about two meters", (kind) => {
    let prompt: unknown = null;
    const interaction = {
      id: `wall_${kind}_control`,
      type: "switch",
      roomId: "memory_clinic",
      position: [0, 0, 0],
      radius: 1.6,
      yaw: 0,
      visualKey: "none",
      label: kind === "wall_button" ? "墙上按钮" : "墙上拉杆",
    };
    const world = createWorld({
      player: { position: { x: 0, z: 1.85 } },
      level: {
        map: {
          interactions: [interaction],
        },
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      switchForInteraction(id: string) {
        return id === interaction.id ? { id: `${interaction.id}_switch`, interactionId: interaction.id, presentation: { kind } } : null;
      },
    });

    new InteractionSystem().update(world as any);

    expect(prompt).toMatchObject({
      id: interaction.id,
      label: interaction.label,
      detail: "使用门控",
      canInteract: true,
    });
  });

  it.each(["wall_button", "wall_lever"] as const)("does not offer %s controls from behind the wall", (kind) => {
    let prompt: unknown = "unchanged";
    const interaction = {
      id: `wall_${kind}_backside_control`,
      type: "switch",
      roomId: "memory_clinic",
      position: [0, 0, 0],
      radius: 1.6,
      yaw: 0,
      visualKey: "none",
      label: kind === "wall_button" ? "墙上按钮" : "墙上拉杆",
    };
    const world = createWorld({
      player: { position: { x: 0, z: -0.42 } },
      level: {
        map: {
          interactions: [interaction],
        },
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      switchForInteraction(id: string) {
        return id === interaction.id ? { id: `${interaction.id}_switch`, interactionId: interaction.id, presentation: { kind } } : null;
      },
    });

    new InteractionSystem().update(world as any);

    expect(prompt).toBeNull();
  });

  it("prefers a usable wall door control over a locked door hint", () => {
    let prompt: unknown = null;
    const interaction = {
      id: "wall_button_near_locked_door",
      type: "switch",
      roomId: "memory_clinic",
      position: [1.8, 0, 0],
      radius: 1.6,
      yaw: 0,
      visualKey: "none",
      label: "门旁按钮",
    };
    const door = {
      id: "memory_clinic_locked_gate",
      label: "记忆诊所封锁门",
      fromRoomId: "memory_clinic",
      toRoomId: "records",
      position: [0, 0, 0],
      size: [3, 3, 0.4],
      yaw: 0,
      defaultState: "locked",
      visualKey: "none",
      lock: {
        type: "key_item",
        keyItemId: "memory_clinic_key",
        lockedMessage: "门关着，要找门控。",
      },
    };
    const world = createWorld({
      player: { position: { x: 0, z: 0 } },
      level: {
        map: {
          interactions: [interaction],
          doors: [door],
        },
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      switchForInteraction(id: string) {
        return id === interaction.id ? { id: "switch_wall_button_near_locked_door", interactionId: interaction.id, presentation: { kind: "wall_button" } } : null;
      },
      canOpenDoor: () => false,
    });

    new InteractionSystem().update(world as any);

    expect(prompt).toMatchObject({
      id: interaction.id,
      label: interaction.label,
      detail: "使用门控",
      canInteract: true,
    });
  });

  it("prefers a wall door control over a nearer painting interaction", () => {
    let prompt: unknown = null;
    const wallControl = {
      id: "wall_button_near_painting",
      type: "switch",
      roomId: "memory_clinic",
      position: [0, 0, -0.4],
      radius: 2,
      yaw: 0,
      visualKey: "wall_door_switch_button",
      label: "门旁按钮",
    };
    const painting = {
      id: "story_memory_wall_art",
      type: "article",
      roomId: "memory_clinic",
      position: [0, 0, 0.3],
      radius: 1.6,
      visualKey: "none",
      label: "诊所壁画",
    };
    const world = createWorld({
      player: { position: { x: 0, z: 0.35 } },
      level: {
        map: {
          interactions: [painting, wallControl],
        },
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      switchForInteraction(id: string) {
        return id === wallControl.id ? { id: "switch_wall_button_near_painting", interactionId: wallControl.id, presentation: { kind: "wall_button" } } : null;
      },
    });

    new InteractionSystem().update(world as any);

    expect(prompt).toMatchObject({
      id: wallControl.id,
      label: wallControl.label,
      detail: "使用门控",
      canInteract: true,
    });
  });

  it("prefers a painting interaction over a locked door hint", () => {
    let prompt: unknown = null;
    const painting = {
      id: "story_memory_locked_gate_wall_art",
      type: "article",
      roomId: "memory_clinic",
      position: [0, 0, 0.4],
      radius: 1.6,
      visualKey: "none",
      label: "封锁门旁壁画",
    };
    const door = {
      id: "memory_clinic_locked_gate",
      label: "记忆诊所封锁门",
      fromRoomId: "memory_clinic",
      toRoomId: "records",
      position: [0, 0, 0],
      size: [3, 3, 0.4],
      yaw: 0,
      defaultState: "locked",
      visualKey: "none",
      lock: {
        type: "key_item",
        keyItemId: "memory_clinic_key",
        lockedMessage: "缺少记忆诊所钥匙。",
      },
    };
    const world = createWorld({
      player: { position: { x: 0, z: 0.25 } },
      level: {
        map: {
          interactions: [painting],
          doors: [door],
        },
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      canOpenDoor: () => false,
    });

    new InteractionSystem().update(world as any);

    expect(prompt).toMatchObject({
      id: painting.id,
      label: painting.label,
      detail: "阅读",
      canInteract: true,
    });
  });

  it("hides locked interaction prompts outside the tightened locked radius", () => {
    let prompt: unknown = "unchanged";
    const interaction = {
      id: "locked_memory_panel",
      type: "terminal",
      roomId: "memory_clinic",
      position: [0, 0, 0],
      radius: 2,
      visualKey: "none",
      label: "封锁记忆终端",
      requiresObjectiveId: "read_triage_chart",
    };
    const world = createWorld({
      player: { position: { x: 1.25, z: 0 } },
      level: {
        map: {
          interactions: [interaction],
        },
        objectiveChain: [{ id: "read_triage_chart", title: "读完分诊记录" }],
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      isObjectiveCompleted: () => false,
    });

    new InteractionSystem().update(world as any);

    expect(prompt).toBeNull();
  });

  it("hides locked door prompts outside the tightened locked radius", () => {
    let prompt: unknown = "unchanged";
    const door = {
      id: "memory_clinic_locked_gate",
      label: "记忆诊所封锁门",
      fromRoomId: "memory_clinic",
      toRoomId: "records",
      position: [0, 0, 0],
      size: [3, 3, 0.4],
      yaw: 0,
      defaultState: "locked",
      visualKey: "none",
      lock: {
        type: "key_item",
        keyItemId: "memory_clinic_key",
        lockedMessage: "缺少记忆诊所钥匙。",
      },
    };
    const world = createWorld({
      player: { position: { x: 3.25, z: 0 } },
      level: {
        map: {
          doors: [door],
        },
      },
      setInteractionPrompt(next: unknown) {
        prompt = next;
      },
      canOpenDoor: () => false,
    });

    new InteractionSystem().update(world as any);

    expect(prompt).toBeNull();
  });
});
