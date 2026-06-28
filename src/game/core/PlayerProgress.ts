export type ProgressStatId = "health" | "attack" | "defense" | "energy";

export interface PlayerProgressStats {
  health: number;
  attack: number;
  defense: number;
  energy: number;
}

export interface LevelSettlementState {
  memoryGained: number;
  totalMemoryBefore: number;
  totalMemoryAfter: number;
  levelBefore: number;
  levelAfter: number;
  pointsGained: number;
}

export interface PlayerProgress {
  totalMemory: number;
  level: number;
  pendingStatPoints: number;
  stats: PlayerProgressStats;
}

const storageKey = "human-protocol-progress-v1";

export const progressStatEffects = {
  healthPerPoint: 10,
  attackPerPoint: 0.04,
  defensePerPoint: 0.035,
  energyPerPoint: 8,
} as const;

const levelThresholds = [0, 35, 85, 155, 245, 355, 485, 635, 805, 995, 1225, 1490];

export function createDefaultProgress(): PlayerProgress {
  return {
    totalMemory: 0,
    level: 1,
    pendingStatPoints: 0,
    stats: {
      health: 0,
      attack: 0,
      defense: 0,
      energy: 0,
    },
  };
}

export function loadPlayerProgress(): PlayerProgress {
  if (!canUseStorage()) return createDefaultProgress();

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return createDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const progress = createDefaultProgress();
    progress.totalMemory = safeInteger(parsed.totalMemory, 0);
    progress.level = Math.max(1, progressLevelForMemory(progress.totalMemory));
    progress.pendingStatPoints = safeInteger(parsed.pendingStatPoints, 0);
    progress.stats = {
      health: safeInteger(parsed.stats?.health, 0),
      attack: safeInteger(parsed.stats?.attack, 0),
      defense: safeInteger(parsed.stats?.defense, 0),
      energy: safeInteger(parsed.stats?.energy, 0),
    };
    return progress;
  } catch {
    return createDefaultProgress();
  }
}

export function savePlayerProgress(progress: PlayerProgress) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // Best-effort persistence: Safari Private Mode and QuotaExceededError throw
    // from setItem. This runs on the frame path (level-completion settlement via
    // GameLoop), so a throw here must never crash/freeze the render loop —
    // matching saveUserProfile / saveGameSettings which already guard this.
  }
}

export function progressLevelForMemory(totalMemory: number) {
  let level = 1;
  for (let index = 1; index < levelThresholds.length; index += 1) {
    if (totalMemory >= levelThresholds[index]) {
      level = index + 1;
    }
  }
  return level;
}

export function memoryToNextProgressLevel(totalMemory: number) {
  const level = progressLevelForMemory(totalMemory);
  const next = levelThresholds[level];
  return next === undefined ? 0 : Math.max(0, next - totalMemory);
}

export function settleProgressMemory(progress: PlayerProgress, memoryGained: number): LevelSettlementState {
  const totalMemoryBefore = progress.totalMemory;
  const levelBefore = progress.level;
  progress.totalMemory += Math.max(0, Math.round(memoryGained));
  progress.level = progressLevelForMemory(progress.totalMemory);
  const pointsGained = Math.max(0, progress.level - levelBefore);
  progress.pendingStatPoints += pointsGained;
  savePlayerProgress(progress);
  return {
    memoryGained: Math.max(0, Math.round(memoryGained)),
    totalMemoryBefore,
    totalMemoryAfter: progress.totalMemory,
    levelBefore,
    levelAfter: progress.level,
    pointsGained,
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function safeInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}
