import { createServer } from "vite";
import { PerspectiveCamera, Vector2, Vector3 } from "three";

const frameDelta = 1 / 30;
const maxObjectiveSeconds = 180;
const maxWaveSeconds = 150;
const physicsMode = readPhysicsModeArg();
const expectedDynamicBodiesByLevelId = new Map([
  ["level_01_maintenance_bay", 1],
  ["level_02_residential_simulation", 1],
  ["level_04_memory_clinic", 1],
]);
let qaPlayerRadius = 0.72;
let qaPlayerCollisionHeight = 1.75;

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const [
    { GameWorld },
    { playerConfig },
    { humanProtocolBasePack },
    { AimSystem },
    { AutoFireSystem },
    { DeathReviveSystem },
    { DialogueSystem },
    { DoorSystem },
    { EffectsSystem },
    { EnemyAISystem },
    { EnvironmentStateSystem },
    { ExitFlowSystem },
    { InteractionSystem },
    { MobileAssistSystem },
    { ObjectiveTrackerSystem },
    { PhysicsSystem },
    { PickupSystem },
    { PlayerMovementSystem },
    { ProjectileSystem },
    { PuzzleSystem },
    { RoomDirectorSystem },
    { SceneFlowSystem },
    { WaveDirectorSystem },
    { WaveTriggerBridgeSystem },
    { WeaponSystem },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/core/GameWorld.ts"),
    server.ssrLoadModule("/src/game/config/playerConfig.ts"),
    server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    server.ssrLoadModule("/src/game/systems/AimSystem.ts"),
    server.ssrLoadModule("/src/game/systems/AutoFireSystem.ts"),
    server.ssrLoadModule("/src/game/systems/DeathReviveSystem.ts"),
    server.ssrLoadModule("/src/game/systems/DialogueSystem.ts"),
    server.ssrLoadModule("/src/game/systems/DoorSystem.ts"),
    server.ssrLoadModule("/src/game/systems/EffectsSystem.ts"),
    server.ssrLoadModule("/src/game/systems/EnemyAISystem.ts"),
    server.ssrLoadModule("/src/game/systems/EnvironmentStateSystem.ts"),
    server.ssrLoadModule("/src/game/systems/ExitFlowSystem.ts"),
    server.ssrLoadModule("/src/game/systems/InteractionSystem.ts"),
    server.ssrLoadModule("/src/game/systems/MobileAssistSystem.ts"),
    server.ssrLoadModule("/src/game/systems/ObjectiveTrackerSystem.ts"),
    server.ssrLoadModule("/src/game/systems/PhysicsSystem.ts"),
    server.ssrLoadModule("/src/game/systems/PickupSystem.ts"),
    server.ssrLoadModule("/src/game/systems/PlayerMovementSystem.ts"),
    server.ssrLoadModule("/src/game/systems/ProjectileSystem.ts"),
    server.ssrLoadModule("/src/game/systems/PuzzleSystem.ts"),
    server.ssrLoadModule("/src/game/systems/RoomDirectorSystem.ts"),
    server.ssrLoadModule("/src/game/systems/SceneFlowSystem.ts"),
    server.ssrLoadModule("/src/game/systems/WaveDirectorSystem.ts"),
    server.ssrLoadModule("/src/game/systems/WaveTriggerBridgeSystem.ts"),
    server.ssrLoadModule("/src/game/systems/WeaponSystem.ts"),
  ]);

  qaPlayerRadius = playerConfig.radius;
  qaPlayerCollisionHeight = playerConfig.collisionHeight;

  const systems = [
    new AimSystem(),
    new MobileAssistSystem(),
    new DoorSystem(),
    new PhysicsSystem(),
    new PlayerMovementSystem(),
    new RoomDirectorSystem(),
    new ObjectiveTrackerSystem(),
    new InteractionSystem(),
    new PickupSystem(),
    new WaveTriggerBridgeSystem(),
    new EnvironmentStateSystem(),
    new WaveDirectorSystem(),
    new EnemyAISystem(),
    new AutoFireSystem(),
    new WeaponSystem(),
    new ProjectileSystem(),
    new PuzzleSystem(),
    new DeathReviveSystem(),
    new DialogueSystem(),
    new ExitFlowSystem(),
    new SceneFlowSystem(),
    new EffectsSystem(),
  ];

  const restoreBrowserShim = installBrowserShimForPhysicsMode(physicsMode);
  const world = new GameWorld();
  restoreBrowserShim();
  world.enableQaNoDamageForTests();
  const kinematicMoveStats = installKinematicMoveStats(world);
  const runner = createRunner(world, systems);
  const fullCampaignIds = humanProtocolBasePack.campaignLevelIds;
  const campaignIds = selectCampaignLevelIds(fullCampaignIds);
  const runsFullCampaign = campaignIds.length === fullCampaignIds.length &&
    campaignIds.every((levelId, index) => levelId === fullCampaignIds[index]);
  const reports = [];

  world.loadLevel(campaignIds[0], "playing");
  await primePhysicsForQa(world, runner);
  for (let index = 0; index < campaignIds.length; index += 1) {
    const expectedLevelId = campaignIds[index];
    if (world.level.id !== expectedLevelId) {
      fail(world, `Expected ${expectedLevelId}, got ${world.level.id}`);
    }
    kinematicMoveStats.reset();
    reports.push(playLevel(runner, expectedLevelId, kinematicMoveStats));

    const expectedNext = campaignIds[index + 1] ?? null;
    const actualNext = world.nextCampaignLevel()?.id ?? null;
    if (expectedNext && actualNext !== expectedNext) {
      fail(world, `Next level after ${expectedLevelId} expected ${expectedNext}, got ${actualNext ?? "END"}`);
    }
    if (!expectedNext && runsFullCampaign && actualNext !== null) {
      fail(world, `Next level after ${expectedLevelId} expected ${expectedNext ?? "END"}, got ${actualNext ?? "END"}`);
    }
    if (expectedNext) {
      world.loadNextCampaignLevel("playing");
      world.enableQaNoDamageForTests();
      await primePhysicsForQa(world, runner);
    }
  }

  for (const report of reports) {
    console.log(`PASS real-play ${report.levelId} physics=${report.physics}`);
    console.log(`  objectives=${report.objectives.join(" -> ")}`);
    console.log(`  kills=${report.kills} health=${report.healthPercent}% memory=${report.memoryFragments} dynamicBodies=${report.dynamicBodies} kinematic=${formatKinematicStats(report.kinematic)}`);
    console.log(`  victory=${report.victoryMessage}`);
  }
  console.log(`PASS real-play campaign=${campaignIds.join(" -> ")} physics=${world.debugOptions.physicsMode}`);
} finally {
  await server.close();
}

function readPhysicsModeArg() {
  const physicsArg = process.argv.find((arg) => arg.startsWith("--physics="));
  if (!physicsArg) return null;
  const value = physicsArg.slice("--physics=".length);
  if (value === "rapier" || value === "legacy") return value;
  throw new Error(`Invalid --physics value: ${physicsArg}`);
}

function installBrowserShimForPhysicsMode(mode) {
  if (!mode) return () => undefined;

  const params = new URLSearchParams({ physics: mode, qa: "1", noDamage: "1" });
  const storage = createMemoryStorage();
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const previousWindow = globalThis.window;
  const location = {
    href: `http://localhost/qa-playthrough?${params.toString()}`,
    hostname: "localhost",
    search: `?${params.toString()}`,
  };
  const history = {
    state: null,
    replaceState(state, _title, url) {
      this.state = state;
      if (!url) return;
      const nextUrl = new URL(String(url), location.href);
      location.href = nextUrl.href;
      location.hostname = nextUrl.hostname;
      location.search = nextUrl.search;
    },
  };

  globalThis.window = {
    location,
    history,
    localStorage: storage,
    sessionStorage: storage,
    navigator: { userAgent: "human-protocol-real-playthrough-qa" },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };

  return () => {
    if (hadWindow) {
      globalThis.window = previousWindow;
    } else {
      delete globalThis.window;
    }
  };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(String(key));
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
  };
}

function selectCampaignLevelIds(fullCampaignIds) {
  const firstArg = process.argv.find((arg) => arg.startsWith("--first="));
  if (firstArg) {
    const count = Number.parseInt(firstArg.slice("--first=".length), 10);
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(`Invalid --first value: ${firstArg}`);
    }
    return fullCampaignIds.slice(0, count);
  }

  const levelsArg = process.argv.find((arg) => arg.startsWith("--levels="));
  if (levelsArg) {
    const requested = levelsArg.slice("--levels=".length).split(",").map((value) => value.trim()).filter(Boolean);
    const missing = requested.filter((levelId) => !fullCampaignIds.includes(levelId));
    if (missing.length > 0) {
      throw new Error(`Unknown level ids for --levels: ${missing.join(", ")}`);
    }
    return requested;
  }

  return fullCampaignIds;
}

async function primePhysicsForQa(world, runner) {
  if (world.debugOptions.physicsMode !== "rapier") return;
  if (!(await world.physics.init())) fail(world, "Rapier physics did not initialize for real playthrough QA");
  runner.step(0.06);
  if (!world.syncPhysicsStaticObstacles()) fail(world, "Rapier static obstacle sync failed for real playthrough QA");
  assertRapierDynamicBodyCount(world, "prime");
}

function createRunner(world, systems) {
  const camera = new PerspectiveCamera();
  const context = {
    camera,
    input: {
      snapshot: () => ({
        move: new Vector2(),
        lookDelta: new Vector2(),
        fire: false,
        dashPressed: false,
        sprint: false,
        interactPressed: false,
        pausePressed: false,
        resetPressed: false,
        useItemPressed: false,
        switchWeapon: null,
      }),
    },
  };

  let elapsed = 0;
  return {
    world,
    step(seconds) {
      const frames = Math.max(1, Math.ceil(seconds / frameDelta));
      for (let index = 0; index < frames; index += 1) {
        elapsed += frameDelta;
        if (world.debugOptions.noPlayerDamage) {
          world.player.health = world.player.maxHealth;
        }
        for (const system of systems) {
          if (world.paused && !system.runWhenPaused) continue;
          system.update(world, frameDelta, elapsed, context);
        }
        resolveModal(world);
      }
    },
    place(position, label = "position") {
      world.player.position.set(position[0], 0, position[2]);
      world.player.velocity.set(0, 0, 0);
      world.player.energy = world.player.maxEnergy;
      world.player.heat = 0;
      this.step(0.12);
      if (world.session.mode === "death") fail(world, `Died while moving to ${label}`);
    },
    interact(position, label) {
      this.place(position, label);
      world.input.interactPressed = true;
      this.step(0.08);
      world.input.interactPressed = false;
      this.step(0.18);
    },
    fireAt(position, label, attackPosition = offsetTowardCamera(position)) {
      const previousAutoFire = world.combatAssist.autoFireEnabled;
      world.combatAssist.autoFireEnabled = false;
      world.combatAssist.lockedEnemyId = null;
      world.input.fire = false;
      this.place(attackPosition, label);
      facePosition(world, position);
      world.player.currentWeapon = "pulseRifle";
      world.lastCombatWeapon = "pulseRifle";
      world.player.energy = world.player.maxEnergy;
      world.player.heat = 0;
      world.player.fireCooldownRemaining = 0;
      world.input.fire = true;
      world.input.fireSource = "manual";
      this.step(0.08);
      world.input.fire = false;
      world.input.fireSource = null;
      world.combatAssist.autoFireEnabled = previousAutoFire;
      this.step(0.12);
    },
  };
}

function playLevel(runner, levelId, kinematicMoveStats) {
  const { world } = runner;
  const objectives = [];
  let guard = 0;

  while (world.session.mode !== "victory" && guard < 80) {
    guard += 1;
    const objective = ensureActiveObjective(runner);
    objectives.push(objective.id);
    playObjective(runner, objective);
    drainObjectiveState(runner, objective.id);
  }

  if (guard >= 80) fail(world, `Objective loop exceeded on ${levelId}`);
  if (world.session.mode !== "victory") fail(world, `Did not reach victory on ${levelId}; mode=${world.session.mode}`);
  assertRapierDynamicBodyCount(world, "victory");
  const kinematic = assertRapierKinematicMoveStats(world, kinematicMoveStats);

  return {
    levelId,
    physics: world.debugOptions.physicsMode,
    objectives,
    kills: world.session.kills,
    healthPercent: Math.round((world.player.health / world.player.maxHealth) * 100),
    memoryFragments: world.session.memoryFragments,
    dynamicBodies: world.physicsDebugSnapshot?.().dynamicBodyCount ?? world.dynamicProps?.length ?? 0,
    kinematic,
    victoryMessage: world.session.message,
  };
}

function assertRapierDynamicBodyCount(world, label) {
  if (world.debugOptions.physicsMode !== "rapier") return;
  world.syncPhysicsDynamicProps?.();
  world.syncDynamicPropsFromPhysics?.(0);
  const expected = expectedDynamicBodiesByLevelId.get(world.level.id) ?? 0;
  const actualProps = world.dynamicProps?.length ?? 0;
  const actualBodies = world.physicsDebugSnapshot?.().dynamicBodyCount ?? actualProps;
  const exactInitialCount = label === "prime";
  const matchesContract = exactInitialCount
    ? actualProps === expected && actualBodies === expected
    : actualProps <= expected && actualBodies <= expected && actualProps === actualBodies;
  if (!matchesContract) {
    fail(world, `Rapier dynamic body count mismatch at ${label}: expected=${expected} props=${actualProps} bodies=${actualBodies} exact=${exactInitialCount}`);
  }
}

function installKinematicMoveStats(world) {
  const originalMove = world.moveKinematicCircleWithPhysics.bind(world);
  let stats = createEmptyKinematicMoveStats();
  world.moveKinematicCircleWithPhysics = (move) => {
    const result = originalMove(move);
    recordKinematicMove(stats, move, result);
    return result;
  };
  return {
    reset() {
      stats = createEmptyKinematicMoveStats();
    },
    snapshot() {
      return { ...stats };
    },
  };
}

function createEmptyKinematicMoveStats() {
  return {
    playerCalls: 0,
    enemyCalls: 0,
    enemyMoveCalls: 0,
    enemyRecoveryCalls: 0,
    enemyMovingCalls: 0,
    movingCharacterCalls: 0,
    blockedResults: 0,
    nullResults: 0,
    invalidResults: 0,
    maxTranslation: 0,
  };
}

function recordKinematicMove(stats, move, result) {
  const id = String(move?.id ?? "");
  const characterMove = id === "player" || id.startsWith("enemy:");
  if (!characterMove) return;
  const desiredLength = move?.desiredTranslation?.length?.() ?? 0;
  if (id === "player") stats.playerCalls += 1;
  if (id.startsWith("enemy:")) {
    stats.enemyCalls += 1;
    if (id.endsWith(":recovery")) stats.enemyRecoveryCalls += 1;
    else {
      stats.enemyMoveCalls += 1;
      if (desiredLength > 0.0001) stats.enemyMovingCalls += 1;
    }
  }
  if (desiredLength > 0.0001) stats.movingCharacterCalls += 1;
  if (!result) {
    stats.nullResults += 1;
    return;
  }
  if (result.blocked) stats.blockedResults += 1;
  const translationLength = result.translation?.length?.() ?? 0;
  stats.maxTranslation = Math.max(stats.maxTranslation, translationLength);
  const position = result.position;
  if (
    !Number.isFinite(position?.x) ||
    !Number.isFinite(position?.y) ||
    !Number.isFinite(position?.z) ||
    !Number.isFinite(translationLength)
  ) {
    stats.invalidResults += 1;
  }
}

function assertRapierKinematicMoveStats(world, kinematicMoveStats) {
  const stats = kinematicMoveStats.snapshot();
  if (world.debugOptions.physicsMode !== "rapier") return stats;
  if (stats.nullResults > 0 || stats.invalidResults > 0) {
    fail(world, `Rapier kinematic movement produced unhealthy results: null=${stats.nullResults} invalid=${stats.invalidResults}`);
  }
  if (stats.playerCalls <= 0) {
    fail(world, "Rapier playthrough did not route player movement through kinematic physics");
  }
  if (world.session.kills > 0 && stats.enemyCalls <= 0) {
    fail(world, "Rapier playthrough combat did not route enemy movement through kinematic physics");
  }
  if (world.session.kills > 0 && stats.enemyMoveCalls <= 0) {
    fail(world, "Rapier playthrough combat only recorded enemy recovery; enemy main movement did not route through kinematic physics");
  }
  if (world.session.kills > 0 && stats.enemyMovingCalls <= 0) {
    fail(world, "Rapier playthrough combat recorded enemy movement calls without non-zero enemy movement");
  }
  return stats;
}

function formatKinematicStats(stats) {
  const maxTranslation = Number.isFinite(stats.maxTranslation) ? stats.maxTranslation.toFixed(3) : String(stats.maxTranslation);
  return `player:${stats.playerCalls}/enemy:${stats.enemyCalls}/enemyMove:${stats.enemyMoveCalls}/enemyMoving:${stats.enemyMovingCalls}/enemyRecovery:${stats.enemyRecoveryCalls}/moving:${stats.movingCharacterCalls}/blocked:${stats.blockedResults}/max:${maxTranslation}`;
}

function ensureActiveObjective(runner) {
  const { world } = runner;
  runner.step(0.2);
  let objective = world.activeObjective();
  if (!objective) {
    world.dispatchObjectiveEvent({ type: "level_start" });
    runner.step(0.12);
    objective = world.activeObjective();
  }
  if (!objective) fail(world, "No active objective");
  return objective;
}

function playObjective(runner, objective) {
  const { world } = runner;
  const trigger = objective.completesWhen;
  const triggerId = trigger.id;

  if (objective.type === "collect_story_pickups" || objective.type === "inspect_all") {
    for (const interactionId of objective.requiredIds) {
      if (!world.session.mapProgress.completedInteractionIds.includes(interactionId)) {
        completeInteraction(runner, interactionId);
      }
    }
    return;
  }

  if (trigger.type !== "level_start" && trigger.type !== "exit_unlocked" && !triggerId) {
    fail(world, `Objective ${objective.id} has trigger ${trigger.type} without id`);
  }

  switch (trigger.type) {
    case "interaction_completed":
      return completeInteraction(runner, triggerId);
    case "key_collected":
      return collectKey(runner, triggerId);
    case "door_opened":
      return openDoor(runner, triggerId);
    case "room_entered":
      return enterRoom(runner, triggerId);
    case "puzzle_completed":
      return solvePuzzle(runner, triggerId);
    case "article_read":
      return readArticle(runner, triggerId);
    case "quiz_completed":
      return answerQuiz(runner, triggerId);
    case "switch_activated":
      return activateSwitch(runner, triggerId, trigger.optionId);
    case "big_screen_state":
      return activateBigScreen(runner, triggerId, trigger.optionId);
    case "wave_completed":
      return completeObjectiveWavesByCombat(runner, objective, triggerId);
    case "exit_unlocked":
      return playUntilExitUnlocked(runner);
    case "choice_selected":
      return chooseConfiguredChoice(world, trigger);
    case "objective_completed":
      return waitForObjective(world, runner, triggerId);
    case "environment_state_set":
      if (!world.setEnvironmentState(triggerId)) fail(world, `Could not set environment ${triggerId}`);
      return;
    default:
      fail(world, `Unsupported real QA trigger ${trigger.type} for ${objective.id}`);
  }
}

function completeObjectiveWavesByCombat(runner, objective, triggerId) {
  const requiredWaveIds = objective.type === "survive_wave" || objective.type === "boss_dead"
    ? objective.requiredIds
    : [triggerId];
  const finalIndex = requiredWaveIds.indexOf(triggerId);
  const waveIds = finalIndex >= 0 ? requiredWaveIds.slice(0, finalIndex + 1) : [triggerId];
  for (const waveId of waveIds) {
    if (!runner.world.session.mapProgress.completedWaveIds.includes(waveId)) {
      completeWaveByCombat(runner, waveId);
    }
  }
}

function completeInteraction(runner, interactionId) {
  const { world } = runner;
  const interaction = world.level.map?.interactions.find((candidate) => candidate.id === interactionId);
  if (!interaction) fail(world, `Missing interaction ${interactionId}`);
  const article = world.articleForInteraction(interactionId);
  if (article) {
    readArticle(runner, article.id);
    return;
  }
  const quiz = world.quizForInteraction(interactionId);
  if (quiz) {
    answerQuiz(runner, quiz.id);
    return;
  }
  const runtimeSwitch = world.switchForInteraction(interactionId);
  if (runtimeSwitch) {
    activateSwitch(runner, runtimeSwitch.id);
    return;
  }

  if (interaction.type === "exit") {
    enterExitByProximity(runner, interaction);
    return;
  }

  const bigScreen = world.bigScreenForInteraction(interactionId);
  if (bigScreen) {
    activateBigScreen(runner, bigScreen.id);
    return;
  }

  if (interaction.type === "pickup_story") {
    const storyPickup = world.level.pickups.storyPickups.find((pickup) => pickup.interactionId === interactionId);
    if (!storyPickup) fail(world, `Missing story pickup for ${interactionId}`);
    runner.place(storyPickup.position, interactionId);
    waitUntil(runner, () => world.session.mapProgress.completedInteractionIds.includes(interactionId), `story pickup ${interactionId}`);
    return;
  }

  runner.interact(interaction.position, interactionId);
  if (!world.session.mapProgress.completedInteractionIds.includes(interactionId)) {
    fail(world, `Interaction did not complete: ${interactionId}`);
  }
}

function enterExitByProximity(runner, interaction) {
  const { world } = runner;
  const doorId = world.level.exit.cinematic?.doorId ?? interaction.opensDoorId;
  if (doorId && !world.isDoorOpen(doorId) && !world.openConfiguredDoor(doorId)) {
    fail(world, `Exit door is not open for proximity entry: ${doorId}`);
  }
  if (!world.session.exitUnlocked && !doorId) fail(world, `Exit interaction is still locked: ${interaction.id}`);
  const position = world.level.exit.cinematic?.enterPosition ?? world.level.exit.position ?? interaction.position;
  world.setCurrentRoom(interaction.roomId);
  runner.place(position, interaction.id);
  waitUntil(
    runner,
    () =>
      world.session.mapProgress.completedInteractionIds.includes(interaction.id) ||
      world.session.mode === "exitCinematic" ||
      world.session.mode === "transition" ||
      world.session.mode === "victory",
    `exit proximity ${interaction.id}`,
    3,
  );
}

function readArticle(runner, articleId) {
  const { world } = runner;
  const article = world.level.articles?.find((candidate) => candidate.id === articleId);
  if (!article) fail(world, `Missing article ${articleId}`);
  const interaction = world.level.map?.interactions.find((candidate) => candidate.id === article.interactionId);
  if (!interaction) fail(world, `Missing article interaction ${article.interactionId}`);
  enterRoom(runner, article.roomId);
  runner.interact(interaction.position, article.interactionId);
  if (world.session.activeArticleId !== article.id && !world.isArticleRead(article.id)) {
    if (!world.openArticle(article.id)) fail(world, `Could not open article ${article.id}`);
  }
  if (!world.isArticleRead(article.id) && !world.closeArticle(true)) {
    fail(world, `Could not close/read article ${article.id}`);
  }
  waitUntil(runner, () => world.isArticleRead(article.id), `article ${article.id} read`, 5);
}

function answerQuiz(runner, quizId) {
  const { world } = runner;
  const quiz = world.level.quizzes?.find((candidate) => candidate.id === quizId);
  if (!quiz) fail(world, `Missing quiz ${quizId}`);
  if (quiz.articleId && !world.isArticleRead(quiz.articleId)) {
    readArticle(runner, quiz.articleId);
  }
  const interaction = world.level.map?.interactions.find((candidate) => candidate.id === quiz.interactionId);
  if (!interaction) fail(world, `Missing quiz interaction ${quiz.interactionId}`);
  const wrongOption = quiz.options.find((option) => option.correct !== true);
  const wrongWaveIds = (quiz.wrongAnswer?.actions ?? [])
    .filter((action) => action.type === "start_wave")
    .map((action) => action.waveId);
  if (wrongOption && wrongWaveIds.length > 0 && (world.session.mapProgress.failedQuizCounts[quiz.id] ?? 0) === 0) {
    openQuizFromInteraction(runner, quiz, interaction);
    if (!world.chooseQuizOption(wrongOption.id)) fail(world, `Could not choose wrong quiz option ${wrongOption.id}`);
    for (const waveId of wrongWaveIds) {
      waitForWaveStart(runner, waveId);
      fightUntilWaveComplete(runner, waveId);
    }
  }

  const correctOption = quiz.options.find((option) => option.correct === true);
  if (!correctOption) fail(world, `Quiz ${quiz.id} has no correct option`);
  openQuizFromInteraction(runner, quiz, interaction);
  if (!world.chooseQuizOption(correctOption.id)) fail(world, `Could not choose correct quiz option ${correctOption.id}`);
  waitUntil(runner, () => world.isQuizCompleted(quiz.id), `quiz ${quiz.id} completed`, 5);
}

function openQuizFromInteraction(runner, quiz, interaction) {
  const { world } = runner;
  enterRoom(runner, quiz.roomId);
  runner.interact(interaction.position, quiz.interactionId);
  if (world.session.activeQuizId !== quiz.id && !world.openQuiz(quiz.id)) {
    fail(world, `Could not open quiz ${quiz.id}`);
  }
}

function activateSwitch(runner, switchId, stateId) {
  const { world } = runner;
  const definition = world.level.switches?.find((candidate) => candidate.id === switchId);
  if (!definition) fail(world, `Missing switch ${switchId}`);
  const interaction = world.level.map?.interactions.find((candidate) => candidate.id === definition.interactionId);
  if (!interaction) fail(world, `Missing switch interaction ${definition.interactionId}`);
  if (interaction.consumesKeyItemId && !world.session.mapProgress.collectedKeyItemIds.includes(interaction.consumesKeyItemId)) {
    collectKey(runner, interaction.consumesKeyItemId);
  }
  const expectedState = stateId ?? definition.states[definition.states.length === 1 ? 0 : 1]?.id;
  const expectedStateDefinition = expectedState
    ? definition.states.find((candidate) => candidate.id === expectedState)
    : null;
  if (
    expectedStateDefinition?.requiredKeyItemId &&
    !world.session.mapProgress.collectedKeyItemIds.includes(expectedStateDefinition.requiredKeyItemId)
  ) {
    collectKey(runner, expectedStateDefinition.requiredKeyItemId);
  }
  enterRoom(runner, definition.roomId);
  runner.interact(interaction.position, definition.interactionId);
  if (expectedState && world.routeSwitchForInteraction(definition.interactionId)) {
    if (!world.chooseRouteSwitchState(definition.id, expectedState)) {
      fail(world, `Could not choose route switch state ${definition.id}:${expectedState}`);
    }
    world.closeRouteSwitch();
  }
  if (expectedState && !world.session.mapProgress.activatedSwitchIds.includes(`${definition.id}:${expectedState}`)) {
    if (!world.activateSwitch(definition.id)) fail(world, `Could not activate switch ${definition.id}`);
  }
  if (expectedState && !world.session.mapProgress.activatedSwitchIds.includes(`${definition.id}:${expectedState}`)) {
    fail(world, `Switch ${definition.id} did not reach state ${expectedState}`);
  }
}

function activateBigScreen(runner, screenId, stateId) {
  const { world } = runner;
  const definition = world.level.bigScreens?.find((candidate) => candidate.id === screenId);
  if (!definition) fail(world, `Missing big screen ${screenId}`);
  const interaction = world.level.map?.interactions.find((candidate) => candidate.id === definition.interactionId);
  if (!interaction) fail(world, `Missing big screen interaction ${definition.interactionId}`);
  enterRoom(runner, definition.roomId);
  runner.interact(interaction.position, definition.interactionId);
  const expectedState = stateId ?? definition.activationStateId ?? definition.states[definition.states.length === 1 ? 0 : 1]?.id;
  if (expectedState && !world.session.mapProgress.activatedBigScreenIds.includes(`${definition.id}:${expectedState}`)) {
    if (!world.activateBigScreen(definition.id)) fail(world, `Could not activate big screen ${definition.id}`);
  }
  if (expectedState && !world.session.mapProgress.activatedBigScreenIds.includes(`${definition.id}:${expectedState}`)) {
    fail(world, `Big screen ${definition.id} did not reach state ${expectedState}`);
  }
}

function collectKey(runner, keyItemId) {
  const { world } = runner;
  const item = world.level.map?.keyItems.find((candidate) => candidate.id === keyItemId);
  if (!item) fail(world, `Missing key ${keyItemId}`);
  if (!world.isConfiguredKeyItemAvailable(item)) {
    const grantingPuzzle = world.level.puzzles?.find((puzzle) =>
      puzzle.success?.actions?.some((action) => action.type === "grant_key_item" && action.keyItemId === keyItemId),
    );
    if (grantingPuzzle && !world.isPuzzleCompleted(grantingPuzzle.id)) solvePuzzle(runner, grantingPuzzle.id);
  }
  runner.interact(world.keyItemPosition(item), keyItemId);
  if (!world.session.mapProgress.collectedKeyItemIds.includes(keyItemId)) {
    fail(world, `Key did not collect: ${keyItemId}`);
  }
}

function openDoor(runner, doorId) {
  const { world } = runner;
  const door = world.level.map?.doors.find((candidate) => candidate.id === doorId);
  if (!door) fail(world, `Missing door ${doorId}`);
  if (!world.isDoorOpen(door.id)) {
    if (door.lock.type === "switch_state" && door.lock.switchId && door.lock.stateId) {
      activateSwitch(runner, door.lock.switchId, door.lock.stateId);
    } else {
      runner.interact(door.position, doorId);
    }
  }
  waitUntil(runner, () => world.isDoorOpen(door.id), `door ${doorId} open`, 4);
}

function enterRoom(runner, roomId) {
  const { world } = runner;
  const room = world.level.map?.rooms.find((candidate) => candidate.id === roomId);
  if (!room) fail(world, `Missing room ${roomId}`);
  if (world.session.mapProgress.currentRoomId !== roomId) {
    const door = world.level.map?.doors.find((candidate) => candidate.toRoomId === roomId || candidate.fromRoomId === roomId);
    if (door && !world.isDoorOpen(door.id) && world.canOpenDoor(door)) {
      openDoor(runner, door.id);
    }
  }
  // The real-play QA runner teleports between authored objective targets; sync
  // the current room before the next DoorSystem pass can auto-close distant doors.
  world.setCurrentRoom(room.id);
  runner.place(room.bounds.center, roomId);
  waitUntil(runner, () => world.session.mapProgress.currentRoomId === roomId, `room ${roomId} entered`, 4);
}

function solvePuzzle(runner, puzzleId) {
  const { world } = runner;
  const puzzle = world.level.puzzles?.find((candidate) => candidate.id === puzzleId);
  if (!puzzle) fail(world, `Missing puzzle ${puzzleId}`);

  if (puzzle.type === "hit_sequence") {
    const previousAutoFire = world.combatAssist.autoFireEnabled;
    world.combatAssist.autoFireEnabled = false;
    world.combatAssist.lockedEnemyId = null;
    try {
      if (puzzle.clue.roomId) enterRoom(runner, puzzle.clue.roomId);
      if (puzzle.clue.playback?.requireReplayBeforeInput) {
        const clueInteraction = puzzle.clue.interactionId
          ? world.level.map?.interactions.find((candidate) => candidate.id === puzzle.clue.interactionId)
          : null;
        if (clueInteraction) {
          runner.interact(clueInteraction.position, clueInteraction.id);
        }
        if (world.session.activeSequencePlaybackPuzzleId === puzzle.id) {
          world.markSequencePlaybackComplete(puzzle.id);
          world.closeSequencePlayback();
        } else if (!world.markSequencePlaybackComplete(puzzle.id)) {
          fail(world, `Could not mark sequence playback complete for ${puzzle.id}`);
        }
      }
      world.player.fireCooldownRemaining = 0;
      world.player.heat = 0;
      for (const targetId of puzzle.clue.sequence) {
        const target = puzzle.targets.find((candidate) => candidate.id === targetId);
        if (!target) fail(world, `Missing puzzle target ${targetId}`);
        if (target.roomId && world.session.mapProgress.currentRoomId !== target.roomId) enterRoom(runner, target.roomId);
        runner.place(puzzleAttackPosition(world, puzzle, target), targetId);
        facePosition(world, target.position);
        if (!world.hitConfiguredPuzzleTarget(puzzle.id, target.id, "pulseRifle")) {
          fail(world, `Puzzle target ${targetId} could not be hit for ${puzzle.id}`);
        }
        runner.step(0.12);
        const sequence = world.session.mapProgress.activePuzzleSequences[puzzle.id] ?? [];
        const expectedLength = puzzle.clue.sequence.indexOf(targetId) + 1;
        if (!world.isPuzzleCompleted(puzzle.id) && sequence.length !== expectedLength) {
          fail(world, `Puzzle target ${targetId} did not advance ${puzzle.id}; sequence=${sequence.join(",") || "empty"} failed=${world.session.mapProgress.failedPuzzleCounts[puzzle.id] ?? 0} pulses=${puzzlePulseKeys(world, puzzle.id)}`);
        }
      }
    } finally {
      world.combatAssist.autoFireEnabled = previousAutoFire;
    }
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, `Puzzle did not complete: ${puzzle.id}; pulses=${puzzlePulseKeys(world, puzzle.id)}`);
    return;
  }

  if (puzzle.type === "code_lock") {
    const interaction = world.level.map?.interactions.find((candidate) => candidate.id === puzzle.interactionId);
    if (!interaction) fail(world, `Missing code lock interaction ${puzzle.interactionId}`);
    enterRoom(runner, interaction.roomId);
    runner.interact(interaction.position, puzzle.interactionId);
    if (world.session.activeCodeLockPuzzleId !== puzzle.id) {
      runner.step(0.45);
    }
    if (world.session.activeCodeLockPuzzleId !== puzzle.id && !world.openCodeLock(puzzle.id)) {
      fail(world, `Could not open code lock ${puzzle.id} from interaction ${puzzle.interactionId}`);
    }
    const code = world.expectedCodeForPuzzle(puzzle);
    for (const digit of code) {
      if (!world.inputCodeLockDigit(digit)) fail(world, `Could not input digit ${digit} for ${puzzle.id}`);
    }
    if (!world.submitCodeLock()) fail(world, `Could not submit code ${code} for ${puzzle.id}`);
    return;
  }

  if (puzzle.type === "tool_calibration") {
    const interaction = world.level.map?.interactions.find((candidate) => candidate.id === puzzle.interactionId);
    if (!interaction) fail(world, `Missing tool calibration interaction ${puzzle.interactionId}`);
    enterRoom(runner, interaction.roomId);
    runner.interact(interaction.position, puzzle.interactionId);
    if (world.session.activeToolCalibrationPuzzleId !== puzzle.id) {
      runner.step(0.45);
    }
    if (world.session.activeToolCalibrationPuzzleId !== puzzle.id && !world.openToolCalibration(puzzle.id)) {
      fail(world, `Could not open tool calibration ${puzzle.id} from interaction ${puzzle.interactionId}`);
    }
    if (!world.submitToolCalibration(true)) fail(world, `Could not submit tool calibration ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, `Tool calibration puzzle did not complete: ${puzzle.id}`);
    return;
  }

  if (puzzle.type === "circuit_grid") {
    const interaction = world.level.map?.interactions.find((candidate) => candidate.id === puzzle.interactionId);
    if (!interaction) fail(world, `Missing circuit grid interaction ${puzzle.interactionId}`);
    enterRoom(runner, interaction.roomId);
    runner.interact(interaction.position, puzzle.interactionId);
    if (world.session.activeCircuitGridPuzzleId !== puzzle.id) {
      runner.step(0.45);
    }
    if (world.session.activeCircuitGridPuzzleId !== puzzle.id && !world.openCircuitGrid(puzzle.id)) {
      fail(world, `Could not open circuit grid ${puzzle.id} from interaction ${puzzle.interactionId}`);
    }
    if (!world.submitCircuitGrid()) fail(world, `Could not submit circuit grid ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, `Circuit grid puzzle did not complete: ${puzzle.id}`);
    return;
  }

  if (puzzle.type === "surveillance_match") {
    const interaction = world.level.map?.interactions.find((candidate) => candidate.id === puzzle.interactionId);
    if (!interaction) fail(world, `Missing surveillance interaction ${puzzle.interactionId}`);
    enterRoom(runner, interaction.roomId);
    runner.interact(interaction.position, puzzle.interactionId);
    if (world.session.activeSurveillancePuzzleId !== puzzle.id) {
      runner.step(0.45);
    }
    if (world.session.activeSurveillancePuzzleId !== puzzle.id && !world.openSurveillance(puzzle.id)) {
      fail(world, `Could not open surveillance match ${puzzle.id} from interaction ${puzzle.interactionId}`);
    }
    if (!world.submitSurveillanceMatch()) fail(world, `Could not submit surveillance match ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, `Surveillance match puzzle did not complete: ${puzzle.id}`);
    return;
  }

  if (puzzle.type === "valve_matrix") {
    const interaction = world.level.map?.interactions.find((candidate) => candidate.id === puzzle.interactionId);
    if (!interaction) fail(world, `Missing valve matrix interaction ${puzzle.interactionId}`);
    enterRoom(runner, interaction.roomId);
    runner.interact(interaction.position, puzzle.interactionId);
    if (world.session.activeValveMatrixPuzzleId !== puzzle.id) {
      runner.step(0.45);
    }
    if (world.session.activeValveMatrixPuzzleId !== puzzle.id && !world.openValveMatrix(puzzle.id)) {
      fail(world, `Could not open valve matrix ${puzzle.id} from interaction ${puzzle.interactionId}`);
    }
    if (!world.submitValveMatrix()) fail(world, `Could not submit valve matrix ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, `Valve matrix puzzle did not complete: ${puzzle.id}`);
    return;
  }

  if (puzzle.type === "archive_merge") {
    const interaction = world.level.map?.interactions.find((candidate) => candidate.id === puzzle.interactionId);
    if (!interaction) fail(world, `Missing archive merge interaction ${puzzle.interactionId}`);
    enterRoom(runner, puzzle.roomId);
    runner.interact(interaction.position, puzzle.interactionId);
    if (world.session.activeArchiveMergePuzzleId !== puzzle.id) {
      runner.step(0.45);
    }
    if (world.session.activeArchiveMergePuzzleId !== puzzle.id && !world.openArchiveMerge(puzzle.id)) {
      fail(world, `Could not open archive merge ${puzzle.id} from interaction ${puzzle.interactionId}`);
    }
    if (!world.submitArchiveMerge()) fail(world, `Could not submit archive merge ${puzzle.id}`);
    if (!world.isPuzzleCompleted(puzzle.id)) fail(world, `Archive merge puzzle did not complete: ${puzzle.id}`);
    return;
  }

  fail(world, `Unsupported puzzle type ${puzzle.type}`);
}

function completeWaveByCombat(runner, waveId) {
  const { world } = runner;
  const wave = world.level.waves.find((candidate) => candidate.id === waveId);
  if (!wave) fail(world, `Missing wave ${waveId}`);
  if (world.session.activeWaveId && world.session.activeWaveId !== waveId && !wave.interruptsActiveWave) {
    fightUntilWaveComplete(runner, world.session.activeWaveId);
  }
  prepareWaveTrigger(runner, wave);
  if (world.session.activeWaveId && world.session.activeWaveId !== waveId && !wave.interruptsActiveWave) {
    fightUntilWaveComplete(runner, world.session.activeWaveId);
  }
  waitForWaveStart(runner, waveId);
  fightUntilWaveComplete(runner, waveId);
}

function prepareWaveTrigger(runner, wave) {
  const { world } = runner;
  if (!wave.trigger) return;
  if (wave.trigger.type === "room_entered" && wave.trigger.id) enterRoom(runner, wave.trigger.id);
  if (wave.trigger.type === "door_opened" && wave.trigger.id) openDoor(runner, wave.trigger.id);
  if (wave.trigger.type === "key_collected" && wave.trigger.id) collectKey(runner, wave.trigger.id);
  if (wave.trigger.type === "interaction_completed" && wave.trigger.id) completeInteraction(runner, wave.trigger.id);
  if (wave.trigger.type === "puzzle_completed" && wave.trigger.id) solvePuzzle(runner, wave.trigger.id);
  if (wave.trigger.type === "article_read" && wave.trigger.id && !world.isArticleRead(wave.trigger.id)) readArticle(runner, wave.trigger.id);
  if (wave.trigger.type === "quiz_completed" && wave.trigger.id && !world.isQuizCompleted(wave.trigger.id)) answerQuiz(runner, wave.trigger.id);
  if (wave.trigger.type === "switch_activated" && wave.trigger.id && !world.session.mapProgress.activatedSwitchIds.includes(wave.trigger.id)) activateSwitch(runner, wave.trigger.id, wave.trigger.optionId);
  if (wave.trigger.type === "big_screen_state" && wave.trigger.id && !world.session.mapProgress.activatedBigScreenIds.includes(wave.trigger.id)) activateBigScreen(runner, wave.trigger.id, wave.trigger.optionId);
}

function waitForWaveStart(runner, waveId) {
  const { world } = runner;
  waitUntil(
    runner,
    () => world.session.activeWaveId === waveId || world.session.mapProgress.completedWaveIds.includes(waveId),
    `wave ${waveId} start`,
    14,
  );
}

function fightUntilWaveComplete(runner, waveId) {
  const { world } = runner;
  let elapsed = 0;
  while (!world.session.mapProgress.completedWaveIds.includes(waveId) && elapsed < maxWaveSeconds) {
    const target = world.enemies.find((enemy) => enemy.isAlive && enemy.waveId === waveId) ??
      world.enemies.find((enemy) => enemy.isAlive);
    if (target) {
      attackEnemy(runner, target);
    } else {
      runner.step(0.25);
    }
    elapsed += 0.25;
    resolveModal(world);
  }
  if (!world.session.mapProgress.completedWaveIds.includes(waveId)) {
    fail(world, `Wave did not complete through combat: ${waveId}`);
  }
}

function playUntilExitUnlocked(runner) {
  const { world } = runner;
  let elapsed = 0;
  while (!world.session.exitUnlocked && elapsed < maxObjectiveSeconds) {
    const target = world.enemies.find((enemy) => enemy.isAlive);
    if (target) {
      attackEnemy(runner, target);
    } else {
      runner.step(0.25);
    }
    elapsed += 0.25;
    resolveModal(world);
  }
  if (!world.session.exitUnlocked) fail(world, "Exit did not unlock through real wave combat");
}

function attackEnemy(runner, enemy) {
  const { world } = runner;
  const attackPosition = meleeAttackPosition(world, enemy);
  runner.place(attackPosition, `enemy ${enemy.id}`);
  facePosition(world, [enemy.position.x, enemy.position.y, enemy.position.z]);
  world.player.currentWeapon = "pulseRifle";
  world.lastCombatWeapon = "pulseRifle";
  world.player.energy = world.player.maxEnergy;
  world.player.heat = 0;
  world.player.fireCooldownRemaining = 0;
  world.input.fire = true;
  world.input.fireSource = "manual";
  runner.step(0.08);
  world.input.fire = false;
  world.input.fireSource = null;
  runner.step(0.17);
}

function meleeAttackPosition(world, enemy) {
  const distance = Math.max(1.18, Math.min(1.52, enemy.radius + 0.82));
  const target = new Vector3(enemy.position.x, enemy.position.y + 0.8, enemy.position.z);
  const room = (enemy.spawnRoomId ? world.level.map?.rooms.find((candidate) => candidate.id === enemy.spawnRoomId) : null) ??
    roomForPosition(world, enemy.position.x, enemy.position.z);
  const directions = [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
    [0.707, 0.707],
    [-0.707, 0.707],
    [0.707, -0.707],
    [-0.707, -0.707],
  ];

  for (const [x, z] of directions) {
    const candidate = new Vector3(enemy.position.x + x * distance, 0, enemy.position.z + z * distance);
    const standPosition = resolveQaStandPosition(world, candidate);
    if (!standPosition) continue;
    if (room && !pointInsideRoomForQa(room, standPosition.x, standPosition.z, 0.36)) continue;
    if (world.hasLineOfSight(standPosition, target, 0.14)) {
      return [standPosition.x, 0, standPosition.z];
    }
  }

  if (room) {
    const [cx, , cz] = room.bounds.center;
    const dx = cx - enemy.position.x;
    const dz = cz - enemy.position.z;
    const length = Math.hypot(dx, dz) || 1;
    const fallback = new Vector3(
      clamp(enemy.position.x + (dx / length) * distance, room.bounds.center[0] - room.bounds.size[0] / 2 + 0.72, room.bounds.center[0] + room.bounds.size[0] / 2 - 0.72),
      0,
      clamp(enemy.position.z + (dz / length) * distance, room.bounds.center[2] - room.bounds.size[2] / 2 + 0.72, room.bounds.center[2] + room.bounds.size[2] / 2 - 0.72),
    );
    const standPosition = resolveQaStandPosition(world, fallback) ?? fallback;
    return [standPosition.x, 0, standPosition.z];
  }

  const fallback = new Vector3(enemy.position.x, 0, enemy.position.z + distance);
  const standPosition = resolveQaStandPosition(world, fallback) ?? fallback;
  return [standPosition.x, 0, standPosition.z];
}

function resolveQaStandPosition(world, candidate) {
  if (world.debugOptions.physicsMode !== "rapier") return candidate;
  const result = world.moveKinematicCircleWithPhysics({
    id: "qa-stand-probe",
    position: candidate,
    radius: qaPlayerRadius,
    height: qaPlayerCollisionHeight,
    desiredTranslation: new Vector3(),
  });
  if (!result) return candidate;
  const resolved = result.position.clone().setY(0);
  return resolved.distanceTo(candidate) <= 0.18 ? resolved : null;
}

function roomForPosition(world, x, z) {
  return world.level.map?.rooms.find((room) => pointInsideRoomForQa(room, x, z, 0));
}

function pointInsideRoomForQa(room, x, z, margin) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  return x >= cx - sx / 2 + margin &&
    x <= cx + sx / 2 - margin &&
    z >= cz - sz / 2 + margin &&
    z <= cz + sz / 2 - margin;
}

function drainObjectiveState(runner, previousObjectiveId) {
  const { world } = runner;
  let elapsed = 0;
  while (elapsed < 10) {
    resolveModal(world);
    if (world.session.mode === "exitCinematic") {
      runner.step(0.4);
      elapsed += 0.4;
      continue;
    }
    if (world.session.mode === "transition") {
      runner.step(2.6);
      return;
    }
    if (world.session.mode === "victory") return;
    const active = world.activeObjective();
    if (active?.id && active.id !== previousObjectiveId) return;
    if (!active && world.level.objectiveChain?.some((objective) => !world.isObjectiveCompleted(objective.id))) {
      runner.step(0.2);
      elapsed += 0.2;
      continue;
    }
    return;
  }
}

function chooseConfiguredChoice(world, trigger) {
  if (world.session.mode !== "choice") {
    world.openChoice(trigger.id);
  }
  const choice = world.activeChoice();
  const option = trigger.optionId ? choice?.options.find((candidate) => candidate.id === trigger.optionId) : choice?.options[0];
  if (!option) fail(world, `Missing choice option for ${trigger.id}`);
  if (!world.chooseRuntimeChoice(option.id)) fail(world, `Could not choose ${option.id}`);
}

function waitForObjective(world, runner, objectiveId) {
  waitUntil(runner, () => world.isObjectiveCompleted(objectiveId), `objective ${objectiveId}`, 8);
}

function waitUntil(runner, predicate, label, maxSeconds = maxObjectiveSeconds) {
  let elapsed = 0;
  while (!predicate() && elapsed < maxSeconds) {
    runner.step(0.1);
    elapsed += 0.1;
  }
  if (!predicate()) fail(runner.world, `Timed out waiting for ${label}`);
}

function puzzlePulseKeys(world, puzzleId) {
  return Object.keys(world.session.mapProgress.puzzleTargetPulses)
    .filter((key) => key.startsWith(`${puzzleId}:`))
    .join(",") || "none";
}

function resolveModal(world) {
  let guard = 0;
  while (
    (
      world.session.mode === "upgrade" ||
      world.session.mode === "choice" ||
      world.session.activeCampaignTransitionDialogue
    ) &&
    guard < 20
  ) {
    guard += 1;
    if (world.session.activeCampaignTransitionDialogue) {
      world.advanceCampaignTransitionDialogue();
      continue;
    }

    if (world.session.mode === "upgrade") {
      const pick = world.session.pendingUpgradeIds[0];
      if (!pick) fail(world, "Upgrade modal opened without choices");
      world.chooseUpgrade(pick);
      continue;
    }

    const choice = world.activeChoice();
    const option = choice?.options[0];
    if (!option) fail(world, "Choice modal opened without options");
    world.chooseRuntimeChoice(option.id);
  }
  if (guard >= 20) fail(world, "Modal resolution exceeded");
}

function facePosition(world, position) {
  const dx = position[0] - world.player.position.x;
  const dz = position[2] - world.player.position.z;
  world.player.rotationY = Math.atan2(dx, -dz);
  world.player.targetRotationY = world.player.rotationY;
  world.player.aimDirection.set(Math.sin(world.player.rotationY), 0, -Math.cos(world.player.rotationY)).normalize();
}

function offsetTowardCamera(position) {
  return [position[0], 0, position[2] + 2.1];
}

function puzzleAttackPosition(world, puzzle, target) {
  const room = world.level.map?.rooms.find((candidate) => candidate.id === target.roomId || candidate.id === puzzle.roomId);
  const center = room?.bounds.center ?? [target.position[0], 0, target.position[2] + 2.4];
  const dx = target.position[0] - center[0];
  const dz = target.position[2] - center[2];
  const length = Math.hypot(dx, dz) || 1;
  const distance = Math.min(2.3, Math.max(1.55, target.radius + 1.15));
  const unclamped = [
    target.position[0] + (dx / length) * distance,
    0,
    target.position[2] + (dz / length) * distance,
  ];
  if (!room) return unclamped;
  const margin = 0.72;
  const halfWidth = room.bounds.size[0] / 2 - margin;
  const halfDepth = room.bounds.size[2] / 2 - margin;
  return [
    clamp(unclamped[0], room.bounds.center[0] - halfWidth, room.bounds.center[0] + halfWidth),
    0,
    clamp(unclamped[2], room.bounds.center[2] - halfDepth, room.bounds.center[2] + halfDepth),
  ];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fail(world, message) {
  const active = world.activeObjective()?.id ?? "none";
  const alive = world.enemies.filter((enemy) => enemy.isAlive).length;
  throw new Error(
    `${message} | level=${world.level.id} mode=${world.session.mode} active=${active} wave=${world.session.activeWaveId ?? "none"} waveIndex=${world.session.waveIndex} waveDelay=${world.session.waveStartDelay.toFixed(2)} hasRod=${world.session.hasRod} hasPistol=${world.session.hasPistol} alive=${alive} kills=${world.session.kills}`,
  );
}
