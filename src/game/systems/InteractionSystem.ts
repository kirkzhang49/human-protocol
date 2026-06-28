import type {
  LevelCodeLockPuzzleDefinition,
  LevelDoorDefinition,
  LevelInteractionDefinition,
  LevelKeyItemDefinition,
  LevelPuzzleDefinition,
} from "../config/schema/levelConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";

type InteractionCandidate =
  | { kind: "interaction"; id: string; label: string; detail: string; distanceSq: number; radius: number; canInteract: boolean; interaction: LevelInteractionDefinition }
  | { kind: "key"; id: string; label: string; detail: string; distanceSq: number; radius: number; canInteract: boolean; item: LevelKeyItemDefinition }
  | { kind: "door"; id: string; label: string; detail: string; distanceSq: number; radius: number; canInteract: boolean; door: LevelDoorDefinition };

export class InteractionSystem implements GameSystem {
  update(world: GameWorld) {
    if (world.session.mode !== "playing") {
      world.setInteractionPrompt(null);
      return;
    }

    const candidate = nearestCandidate(world);
    if (!candidate) {
      world.setInteractionPrompt(null);
      return;
    }

    world.setInteractionPrompt({
      id: candidate.id,
      label: candidate.label,
      detail: candidate.detail,
      controlLabel: "E",
      canInteract: candidate.canInteract,
    });

    if (candidate.kind === "door" && candidate.canInteract && candidate.door.autoOpenOnApproach) {
      world.openConfiguredDoor(candidate.door.id);
      return;
    }

    if (!world.input.interactPressed) return;
    this.perform(world, candidate);
  }

  private perform(world: GameWorld, candidate: InteractionCandidate) {
    if (!candidate.canInteract) {
      world.setSpawnWarning({ label: candidate.label, detail: candidate.detail }, 1.35);
      return;
    }

    if (candidate.kind === "key") {
      world.collectConfiguredKeyItem(candidate.item);
      return;
    }

    if (candidate.kind === "door") {
      world.openConfiguredDoor(candidate.door.id);
      return;
    }

    const interaction = candidate.interaction;
    const article = world.articleForInteraction(interaction.id);
    if (article) {
      world.openArticle(article.id);
      return;
    }
    const quiz = world.quizForInteraction(interaction.id);
    if (quiz && !world.isQuizCompleted(quiz.id)) {
      world.openQuiz(quiz.id);
      return;
    }
    const bigScreen = world.bigScreenForInteraction(interaction.id);
    if (bigScreen) {
      world.activateBigScreen(bigScreen.id);
      return;
    }
    const runtimeSwitch = world.switchForInteraction(interaction.id);
    if (runtimeSwitch) {
      // Routing consoles open the Image2 route-switch overlay (key-gated output
      // selection); plain switches keep the blind cycling behaviour.
      if (world.routeSwitchForInteraction(interaction.id)) {
        world.openRouteSwitch(runtimeSwitch.id);
      } else if (runtimeSwitch.presentation?.kind === "wall_button" || runtimeSwitch.presentation?.kind === "wall_lever") {
        world.beginSwitchHandInteraction(runtimeSwitch.id);
      } else {
        world.activateSwitch(runtimeSwitch.id);
      }
      return;
    }
    const codeLockPuzzle = world.codeLockPuzzleForInteraction(interaction.id);
    if (codeLockPuzzle && !world.isPuzzleCompleted(codeLockPuzzle.id)) {
      world.openCodeLock(codeLockPuzzle.id);
      return;
    }
    const sequencePlaybackPuzzle = world.sequencePlaybackPuzzleForInteraction(interaction.id);
    if (sequencePlaybackPuzzle && !world.isPuzzleCompleted(sequencePlaybackPuzzle.id)) {
      world.openSequencePlayback(sequencePlaybackPuzzle.id);
      return;
    }
    const toolCalibrationPuzzle = world.toolCalibrationPuzzleForInteraction(interaction.id);
    if (toolCalibrationPuzzle && (toolCalibrationPuzzle.repeatable || !world.isPuzzleCompleted(toolCalibrationPuzzle.id))) {
      world.openToolCalibration(toolCalibrationPuzzle.id);
      return;
    }
    const circuitGridPuzzle = world.circuitGridPuzzleForInteraction(interaction.id);
    if (circuitGridPuzzle && !world.isPuzzleCompleted(circuitGridPuzzle.id)) {
      world.openCircuitGrid(circuitGridPuzzle.id);
      return;
    }
    const surveillancePuzzle = world.surveillancePuzzleForInteraction(interaction.id);
    if (surveillancePuzzle && !world.isPuzzleCompleted(surveillancePuzzle.id)) {
      world.openSurveillance(surveillancePuzzle.id);
      return;
    }
    const valveMatrixPuzzle = world.valveMatrixPuzzleForInteraction(interaction.id);
    if (valveMatrixPuzzle && !world.isPuzzleCompleted(valveMatrixPuzzle.id)) {
      world.openValveMatrix(valveMatrixPuzzle.id);
      return;
    }
    const archiveMergePuzzle = world.archiveMergePuzzleForInteraction(interaction.id);
    if (archiveMergePuzzle && !world.isPuzzleCompleted(archiveMergePuzzle.id)) {
      world.openArchiveMerge(archiveMergePuzzle.id);
      return;
    }
    const galleryReadingPuzzle = world.galleryReadingPuzzleForInteraction(interaction.id);
    if (galleryReadingPuzzle && !world.isPuzzleCompleted(galleryReadingPuzzle.id)) {
      world.openGalleryReading(galleryReadingPuzzle.id);
      return;
    }
    if (interaction.grantsKeyItemId) {
      const keyItem = world.level.map?.keyItems.find((item) => item.id === interaction.grantsKeyItemId);
      if (keyItem) world.collectConfiguredKeyItem(keyItem);
    }
    if (interaction.opensDoorId && interaction.type !== "exit") {
      world.openConfiguredDoor(interaction.opensDoorId);
    }
    if (interaction.dialogueTrigger) {
      world.queueDialogue(interaction.dialogueTrigger);
    }
    if (interaction.rewardPulse) {
      world.setRewardPulse(interaction.rewardPulse, interaction.rewardPulseDuration ?? 1.35);
    }
    world.emitConfiguredAudio(interaction.audio);
    world.completeConfiguredInteraction(interaction.id);

    if (interaction.type === "exit") {
      if (world.session.exitUnlocked) {
        world.activateExit("interaction");
      } else {
        world.setSpawnWarning({ label: interaction.label ?? "出口", detail: "门禁仍在封锁。" }, 1.35);
      }
    }
  }
}

function nearestCandidate(world: GameWorld): InteractionCandidate | null {
  const map = world.level.map;
  if (!map) return null;

  let best: InteractionCandidate | null = null;
  for (const item of map.keyItems) {
    if (item.autoCollect !== false) continue;
    if (world.session.mapProgress.collectedKeyItemIds.includes(item.id)) continue;
    if (!world.isConfiguredKeyItemAvailable(item)) continue;
    const position = world.keyItemPosition(item);
    best = closer(best, {
      kind: "key",
      id: item.id,
      label: item.label,
      detail: "拾取",
      distanceSq: distanceSq(world, position),
      radius: item.collectRadius,
      canInteract: true,
      item,
    });
  }

  for (const interaction of map.interactions) {
    if (interaction.type === "pickup_story") continue;
    if (interaction.type === "exit") continue;
    const repeatablePuzzle = world.toolCalibrationPuzzleForInteraction(interaction.id)?.repeatable === true;
    const repeatableArticle = interaction.type === "article" || Boolean(world.articleForInteraction(interaction.id));
    if (world.session.mapProgress.completedInteractionIds.includes(interaction.id) && !repeatablePuzzle && !repeatableArticle) continue;
    if (!wallControlCanBeReachedFromPlayerSide(world, interaction)) continue;
    const canInteract = canUseInteraction(world, interaction);
    const radius = effectiveInteractionRadius(world, interaction, canInteract);
    best = closer(best, {
      kind: "interaction",
      id: interaction.id,
      label: interaction.label ?? interactionLabel(interaction),
      detail: interactionDetail(world, interaction, canInteract),
      distanceSq: distanceSq(world, interaction.position),
      radius,
      canInteract,
      interaction,
    });
  }

  for (const door of map.doors) {
    if (world.isDoorOpen(door.id)) continue;
    if (shouldDeferDoorToNearbyCodePanel(world, door)) continue;
    const canInteract = world.canOpenDoor(door);
    if (!canInteract && door.lock.type === "survive_wave") continue;
    const radius = effectiveDoorInteractionRadius(door, canInteract);
    best = closer(best, {
      kind: "door",
      id: door.id,
      label: door.label,
      detail: canInteract ? "打开" : door.lock.lockedMessage ?? "门禁条件不足",
      distanceSq: doorInteractionDistanceSq(world, door),
      radius,
      canInteract,
      door,
    });
  }

  if (!best || best.distanceSq > best.radius * best.radius) return null;
  return best;
}

function canUseInteraction(world: GameWorld, interaction: LevelInteractionDefinition) {
  if (interaction.requiresObjectiveId && !world.isObjectiveCompleted(interaction.requiresObjectiveId)) return false;
  if (hasUnreadRequiredArticles(world, interaction)) return false;
  if (interaction.requiresSwitchState && world.activeSwitchStateId(interaction.requiresSwitchState.switchId) !== interaction.requiresSwitchState.stateId) return false;
  // Route switches stay openable without the key (the overlay shows the locked,
  // unauthorized state); every other key-gated interaction needs the key first.
  if (
    interaction.consumesKeyItemId &&
    !world.session.mapProgress.collectedKeyItemIds.includes(interaction.consumesKeyItemId) &&
    !world.routeSwitchForInteraction(interaction.id)
  )
    return false;
  const quiz = world.quizForInteraction(interaction.id);
  if (quiz && !world.isQuizCompleted(quiz.id)) return world.canUseQuiz(quiz);
  const codeLockPuzzle = world.codeLockPuzzleForInteraction(interaction.id);
  if (codeLockPuzzle && !world.isPuzzleCompleted(codeLockPuzzle.id)) return world.canUseCodeLockPuzzle(codeLockPuzzle);
  if (interaction.type === "exit") return world.session.exitUnlocked;
  return true;
}

function effectiveInteractionRadius(world: GameWorld, interaction: LevelInteractionDefinition, canInteract: boolean) {
  if (!canInteract) return Math.max(0.55, interaction.radius * 0.5);
  if (isWallDoorControlInteraction(world, interaction)) return wallDoorControlInteractionRadius();
  return interaction.radius;
}

function wallDoorControlInteractionRadius() {
  return 2;
}

function isWallDoorControlInteraction(world: GameWorld, interaction: LevelInteractionDefinition) {
  const runtimeSwitch = world.switchForInteraction(interaction.id);
  return runtimeSwitch?.presentation?.kind === "wall_button" || runtimeSwitch?.presentation?.kind === "wall_lever";
}

function wallControlCanBeReachedFromPlayerSide(world: GameWorld, interaction: LevelInteractionDefinition) {
  if (!isWallDoorControlInteraction(world, interaction)) return true;
  if (typeof interaction.yaw !== "number") return true;
  const dx = world.player.position.x - interaction.position[0];
  const dz = world.player.position.z - interaction.position[2];
  const forwardX = Math.sin(interaction.yaw);
  const forwardZ = Math.cos(interaction.yaw);
  const forwardDistance = dx * forwardX + dz * forwardZ;
  if (forwardDistance < -0.08) return false;
  if (forwardDistance > wallDoorControlInteractionRadius() + 0.18) return false;
  return true;
}

function interactionDetail(world: GameWorld, interaction: LevelInteractionDefinition, canInteract: boolean) {
  const codeLockPuzzle = world.codeLockPuzzleForInteraction(interaction.id);
  const toolCalibrationPuzzle = world.toolCalibrationPuzzleForInteraction(interaction.id);
  const quiz = world.quizForInteraction(interaction.id);
  if (!canInteract) {
    if (hasUnreadRequiredArticles(world, interaction)) {
      const progress = requiredArticleProgress(world, interaction);
      return `先读画作 ${progress.read}/${progress.total}`;
    }
    if (codeLockPuzzle?.requiredKeyItemId) {
      const key = world.level.map?.keyItems.find((item) => item.id === codeLockPuzzle.requiredKeyItemId);
      return key ? `缺少${key.label}` : "缺少门禁钥匙";
    }
    if (interaction.type === "exit") return "门禁仍在封锁";
    if (interaction.requiresObjectiveId) {
      const objective = world.level.objectiveChain?.find((candidate) => candidate.id === interaction.requiresObjectiveId);
      return objective ? `先完成：${objective.hudLabel ?? objective.title}` : "目标尚未完成";
    }
    if (interaction.requiresSwitchState) return "先改接路由";
    if (interaction.consumesKeyItemId) return "缺少门禁物";
    if (quiz?.articleId && !world.isArticleRead(quiz.articleId)) return "先读档案";
  }
  const article = world.articleForInteraction(interaction.id);
  if (article && !world.isArticleRead(article.id)) return "阅读";
  if (quiz && !world.isQuizCompleted(quiz.id)) return "回答";
  if (world.bigScreenForInteraction(interaction.id)) return "查看屏幕";
  if (world.routeSwitchForInteraction(interaction.id)) {
    const route = world.switchForInteraction(interaction.id);
    return route && !world.routeSwitchHasKey(route.id) ? "查看路由（缺授权）" : "改接路由";
  }
  const runtimeSwitch = world.switchForInteraction(interaction.id);
  if (runtimeSwitch?.presentation?.kind === "wall_button" || runtimeSwitch?.presentation?.kind === "wall_lever") return "使用门控";
  if (runtimeSwitch) return "切换";
  if (codeLockPuzzle && !world.isPuzzleCompleted(codeLockPuzzle.id)) return "输入密码";
  const sequencePlaybackPuzzle = world.sequencePlaybackPuzzleForInteraction(interaction.id);
  if (sequencePlaybackPuzzle && !world.isPuzzleCompleted(sequencePlaybackPuzzle.id)) return "看灯墙";
  if (toolCalibrationPuzzle && (toolCalibrationPuzzle.repeatable || !world.isPuzzleCompleted(toolCalibrationPuzzle.id))) return "校准工具";
  const circuitGridPuzzle = world.circuitGridPuzzleForInteraction(interaction.id);
  if (circuitGridPuzzle && !world.isPuzzleCompleted(circuitGridPuzzle.id)) return "接通电路";
  const surveillancePuzzle = world.surveillancePuzzleForInteraction(interaction.id);
  if (surveillancePuzzle && !world.isPuzzleCompleted(surveillancePuzzle.id)) return "比对监控";
  const valveMatrixPuzzle = world.valveMatrixPuzzleForInteraction(interaction.id);
  if (valveMatrixPuzzle && !world.isPuzzleCompleted(valveMatrixPuzzle.id)) return "配平阀组";
  const galleryReadingPuzzle = world.galleryReadingPuzzleForInteraction(interaction.id);
  if (galleryReadingPuzzle && !world.isPuzzleCompleted(galleryReadingPuzzle.id)) return "审读展画";
  if (interaction.type === "inspect") return "检查";
  if (interaction.type === "terminal") return "读取";
  if (interaction.type === "door_panel") return "使用门禁";
  if (interaction.type === "repair_panel") return "修复";
  if (interaction.type === "memory_echo") return "触发回声";
  if (interaction.type === "article") return "阅读";
  if (interaction.type === "quiz") return "回答";
  if (interaction.type === "switch") return "切换";
  if (interaction.type === "big_screen") return "查看屏幕";
  if (interaction.type === "pickup_key" || interaction.type === "pickup_story") return "拾取";
  if (interaction.type === "exit") return world.session.exitUnlocked ? "进入" : "等待解锁";
  return "互动";
}

function hasUnreadRequiredArticles(world: GameWorld, interaction: LevelInteractionDefinition) {
  return (interaction.requiresArticleIds ?? []).some((articleId) => !world.isArticleRead(articleId));
}

function requiredArticleProgress(world: GameWorld, interaction: LevelInteractionDefinition) {
  const ids = interaction.requiresArticleIds ?? [];
  return {
    read: ids.filter((articleId) => world.isArticleRead(articleId)).length,
    total: ids.length,
  };
}

function shouldDeferDoorToNearbyCodePanel(world: GameWorld, door: LevelDoorDefinition) {
  const map = world.level.map;
  if (!map) return false;
  const codePanelPuzzle = (world.level.puzzles ?? []).find(
    (puzzle): puzzle is LevelCodeLockPuzzleDefinition =>
      isCodeLockPuzzle(puzzle) &&
      !world.isPuzzleCompleted(puzzle.id) &&
      (puzzle.success.opensDoorId === door.id || puzzle.success.unlocksDoorId === door.id),
  );
  if (!codePanelPuzzle) return false;
  const panel = map.interactions.find((interaction) => interaction.id === codePanelPuzzle.interactionId);
  if (!panel) return false;
  return distanceSq(world, panel.position) <= panel.radius * panel.radius;
}

function isCodeLockPuzzle(puzzle: LevelPuzzleDefinition): puzzle is LevelCodeLockPuzzleDefinition {
  return puzzle.type === "code_lock";
}

function interactionLabel(interaction: LevelInteractionDefinition) {
  if (interaction.type === "exit") return "出口";
  if (interaction.type === "terminal") return "终端";
  if (interaction.type === "door_panel") return "门禁";
  if (interaction.type === "repair_panel") return "维修面板";
  if (interaction.type === "memory_echo") return "记忆回声";
  if (interaction.type === "article") return "档案";
  if (interaction.type === "quiz") return "问答";
  if (interaction.type === "switch") return "开关";
  if (interaction.type === "big_screen") return "大屏";
  return "互动物";
}

function closer(current: InteractionCandidate | null, next: InteractionCandidate) {
  if (next.distanceSq > next.radius * next.radius) return current;
  if (!current) return next;
  const currentPriority = candidatePriority(current);
  const nextPriority = candidatePriority(next);
  if (nextPriority !== currentPriority) return nextPriority > currentPriority ? next : current;
  if (next.distanceSq < current.distanceSq) return next;
  return current;
}

function candidatePriority(candidate: InteractionCandidate) {
  if (!candidate.canInteract) return 0;
  if (candidate.kind === "interaction" && isWallDoorControlCandidate(candidate)) return 4;
  if (candidate.kind === "interaction" && isArticleLikeCandidate(candidate)) return 2;
  return 3;
}

function isWallDoorControlCandidate(candidate: InteractionCandidate) {
  return candidate.kind === "interaction" && (candidate.detail === "使用门控" || candidate.interaction.visualKey === "wall_door_switch_button");
}

function isArticleLikeCandidate(candidate: InteractionCandidate) {
  return candidate.kind === "interaction" && (candidate.interaction.type === "article" || candidate.detail === "阅读");
}

function distanceSq(world: GameWorld, position: readonly [number, number, number]) {
  const dx = world.player.position.x - position[0];
  const dz = world.player.position.z - position[2];
  return dx * dx + dz * dz;
}

function doorInteractionRadius(door: LevelDoorDefinition) {
  return Math.max(1.35, Math.min(2.1, Math.max(door.size[0], door.size[2]) * 0.18 + 1.05));
}

function effectiveDoorInteractionRadius(door: LevelDoorDefinition, canInteract: boolean) {
  const radius = doorInteractionRadius(door);
  return canInteract ? radius : Math.max(0.55, radius * 0.5);
}

function doorInteractionDistanceSq(world: GameWorld, door: LevelDoorDefinition) {
  const dx = world.player.position.x - door.position[0];
  const dz = world.player.position.z - door.position[2];
  const cos = Math.cos(door.yaw);
  const sin = Math.sin(door.yaw);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  const halfWidth = door.size[0] / 2 + 0.55;
  const halfDepth = Math.max(door.size[2] / 2, 0.36) + 1.05;
  const outsideX = Math.max(0, Math.abs(localX) - halfWidth);
  const outsideZ = Math.max(0, Math.abs(localZ) - halfDepth);
  return outsideX * outsideX + outsideZ * outsideZ;
}
