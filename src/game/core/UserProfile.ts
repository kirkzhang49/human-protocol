import type { LevelSettlementState, PlayerProgress, PlayerProgressStats } from "./PlayerProgress";
import { createDefaultProgress } from "./PlayerProgress";

export type UserRunOutcome = "started" | "death" | "victory";

export interface UserRunSummary {
  levelId: string;
  outcome: Exclude<UserRunOutcome, "started">;
  durationSeconds: number;
  memoryFragments: number;
  memoryReward: number;
  bestKillStreak: number;
  kills: number;
  upgradeIds: string[];
  revivesUsed: number;
  memoryDoubled: boolean;
  endedAt: string;
}

export interface UserLevelRecord {
  id: string;
  unlocked: boolean;
  attempts: number;
  completions: number;
  bestTimeSeconds: number | null;
  bestMemoryReward: number;
  bestKillStreak: number;
  bestUpgradeCount: number;
  lowestRevivesUsed: number | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastOutcome: UserRunOutcome | null;
  lastUpgradeIds: string[];
  upgradePickCounts: Record<string, number>;
  lastRun: UserRunSummary | null;
}

export interface UserUpgradeRecord {
  id: string;
  offered: number;
  picked: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  firstPickedAt: string | null;
  lastPickedAt: string | null;
  levelPickCounts: Record<string, number>;
}

export interface CampaignRouteDeltaRecord {
  routeId: string;
  amount: number;
  label?: string;
}

export interface CampaignRouteScoreRecord {
  id: string;
  label: string;
  score: number;
  changes: number;
  firstSeenAt: string | null;
  lastChangedAt: string | null;
  levelCounts: Record<string, number>;
}

export interface CampaignRouteChoiceRecord {
  levelId: string;
  choiceId: string;
  optionId: string;
  routeDeltas: CampaignRouteDeltaRecord[];
  selectedAt: string;
}

export interface CampaignRouteProfile {
  scores: Record<string, CampaignRouteScoreRecord>;
  choiceHistory: CampaignRouteChoiceRecord[];
  lastDominantRouteId: string | null;
}

export interface UserProfile {
  schemaVersion: 1;
  firstSeenAt: string;
  updatedAt: string;
  runsStarted: number;
  completedLevelIds: string[];
  lastCompletedLevelId: string | null;
  progressSnapshot: PlayerProgress;
  levels: Record<string, UserLevelRecord>;
  upgrades: Record<string, UserUpgradeRecord>;
  campaignRouteProfile: CampaignRouteProfile;
  lastRun: UserRunSummary | null;
}

export interface LevelRunRecordInput {
  levelId: string;
  durationSeconds: number;
  memoryFragments: number;
  bestKillStreak: number;
  kills: number;
  upgradeIds: readonly string[];
  revivesUsed: number;
}

export interface LevelCompletionRecordInput extends LevelRunRecordInput {
  settlement: LevelSettlementState | null;
  memoryDoubled: boolean;
}

export interface CampaignRouteAdjustmentInput {
  levelId: string;
  routeId: string;
  amount: number;
  label?: string;
}

export interface CampaignRouteChoiceInput {
  levelId: string;
  choiceId: string;
  optionId: string;
  routeDeltas: readonly CampaignRouteDeltaRecord[];
}

export const USER_PROFILE_STORAGE_KEY = "human-protocol-user-profile-v1";

export function createDefaultUserProfile(progress: PlayerProgress = createDefaultProgress()): UserProfile {
  const now = nowIso();
  return {
    schemaVersion: 1,
    firstSeenAt: now,
    updatedAt: now,
    runsStarted: 0,
    completedLevelIds: [],
    lastCompletedLevelId: null,
    progressSnapshot: cloneProgress(progress),
    levels: {},
    upgrades: {},
    campaignRouteProfile: createDefaultCampaignRouteProfile(),
    lastRun: null,
  };
}

export function loadUserProfile(progress: PlayerProgress = createDefaultProgress()): UserProfile {
  if (!canUseStorage()) return createDefaultUserProfile(progress);

  try {
    const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultUserProfile(progress);
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const profile = normalizeProfile(parsed, progress);
    profile.progressSnapshot = cloneProgress(progress);
    return profile;
  } catch {
    return createDefaultUserProfile(progress);
  }
}

export function saveUserProfile(profile: UserProfile) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // User profile persistence should never block the run.
  }
}

export function syncUserProfileProgress(profile: UserProfile, progress: PlayerProgress) {
  profile.progressSnapshot = cloneProgress(progress);
  touch(profile);
  saveUserProfile(profile);
}

export function recordLevelAttempt(profile: UserProfile, levelId: string) {
  const now = nowIso();
  const level = ensureLevelRecord(profile, levelId);
  level.unlocked = true;
  level.attempts += 1;
  level.lastStartedAt = now;
  level.lastOutcome = "started";
  profile.runsStarted += 1;
  touch(profile, now);
  saveUserProfile(profile);
}

export function recordUpgradeOffer(profile: UserProfile, upgradeIds: readonly string[]) {
  const now = nowIso();
  for (const upgradeId of uniqueIds(upgradeIds)) {
    const upgrade = ensureUpgradeRecord(profile, upgradeId);
    upgrade.offered += 1;
    upgrade.firstSeenAt = upgrade.firstSeenAt ?? now;
    upgrade.lastSeenAt = now;
  }
  touch(profile, now);
  saveUserProfile(profile);
}

export function recordUpgradePick(profile: UserProfile, levelId: string, upgradeId: string) {
  const now = nowIso();
  const upgrade = ensureUpgradeRecord(profile, upgradeId);
  const level = ensureLevelRecord(profile, levelId);

  upgrade.picked += 1;
  upgrade.firstSeenAt = upgrade.firstSeenAt ?? now;
  upgrade.lastSeenAt = now;
  upgrade.firstPickedAt = upgrade.firstPickedAt ?? now;
  upgrade.lastPickedAt = now;
  upgrade.levelPickCounts[levelId] = (upgrade.levelPickCounts[levelId] ?? 0) + 1;

  level.lastUpgradeIds = [...level.lastUpgradeIds, upgradeId].slice(-12);
  level.upgradePickCounts[upgradeId] = (level.upgradePickCounts[upgradeId] ?? 0) + 1;

  touch(profile, now);
  saveUserProfile(profile);
}

export function recordLevelCompletion(profile: UserProfile, input: LevelCompletionRecordInput) {
  const now = nowIso();
  const level = ensureLevelRecord(profile, input.levelId);
  const memoryReward = input.settlement?.memoryGained ?? input.memoryFragments;
  const durationSeconds = safeNumber(input.durationSeconds, 0);
  const summary: UserRunSummary = {
    levelId: input.levelId,
    outcome: "victory",
    durationSeconds,
    memoryFragments: safeInteger(input.memoryFragments, 0),
    memoryReward: safeInteger(memoryReward, 0),
    bestKillStreak: safeInteger(input.bestKillStreak, 0),
    kills: safeInteger(input.kills, 0),
    upgradeIds: [...input.upgradeIds],
    revivesUsed: safeInteger(input.revivesUsed, 0),
    memoryDoubled: input.memoryDoubled,
    endedAt: now,
  };

  level.unlocked = true;
  level.completions += 1;
  level.lastCompletedAt = now;
  level.lastOutcome = "victory";
  level.lastUpgradeIds = [...input.upgradeIds];
  level.lastRun = summary;
  level.bestTimeSeconds = level.bestTimeSeconds === null ? durationSeconds : Math.min(level.bestTimeSeconds, durationSeconds);
  level.bestMemoryReward = Math.max(level.bestMemoryReward, summary.memoryReward);
  level.bestKillStreak = Math.max(level.bestKillStreak, summary.bestKillStreak);
  level.bestUpgradeCount = Math.max(level.bestUpgradeCount, summary.upgradeIds.length);
  level.lowestRevivesUsed =
    level.lowestRevivesUsed === null ? summary.revivesUsed : Math.min(level.lowestRevivesUsed, summary.revivesUsed);

  profile.lastRun = summary;
  profile.lastCompletedLevelId = input.levelId;
  profile.completedLevelIds = addUnique(profile.completedLevelIds, input.levelId);
  touch(profile, now);
  saveUserProfile(profile);
}

export function recordRunDeath(profile: UserProfile, input: LevelRunRecordInput) {
  const now = nowIso();
  const level = ensureLevelRecord(profile, input.levelId);
  const summary: UserRunSummary = {
    levelId: input.levelId,
    outcome: "death",
    durationSeconds: safeNumber(input.durationSeconds, 0),
    memoryFragments: safeInteger(input.memoryFragments, 0),
    memoryReward: 0,
    bestKillStreak: safeInteger(input.bestKillStreak, 0),
    kills: safeInteger(input.kills, 0),
    upgradeIds: [...input.upgradeIds],
    revivesUsed: safeInteger(input.revivesUsed, 0),
    memoryDoubled: false,
    endedAt: now,
  };

  level.lastOutcome = "death";
  level.lastUpgradeIds = [...input.upgradeIds];
  level.lastRun = summary;
  profile.lastRun = summary;
  touch(profile, now);
  saveUserProfile(profile);
}

export function recordMemoryRewardDoubled(profile: UserProfile, levelId: string, settlement: LevelSettlementState) {
  const now = nowIso();
  const level = ensureLevelRecord(profile, levelId);
  level.bestMemoryReward = Math.max(level.bestMemoryReward, safeInteger(settlement.memoryGained, 0));
  markRunDoubled(level.lastRun, levelId, settlement, now);
  markRunDoubled(profile.lastRun, levelId, settlement, now);
  touch(profile, now);
  saveUserProfile(profile);
}

export function recordCampaignRouteChoice(profile: UserProfile, input: CampaignRouteChoiceInput) {
  const now = nowIso();
  const profileRoutes = ensureCampaignRouteProfile(profile);
  profileRoutes.choiceHistory = [
    ...profileRoutes.choiceHistory,
    {
      levelId: input.levelId,
      choiceId: input.choiceId,
      optionId: input.optionId,
      routeDeltas: normalizeRouteDeltas(input.routeDeltas),
      selectedAt: now,
    },
  ].slice(-80);
  touch(profile, now);
  saveUserProfile(profile);
}

export function adjustCampaignRoute(profile: UserProfile, input: CampaignRouteAdjustmentInput) {
  if (!input.routeId || !Number.isFinite(input.amount) || input.amount === 0) return;
  const now = nowIso();
  const profileRoutes = ensureCampaignRouteProfile(profile);
  const route = ensureCampaignRouteRecord(profileRoutes, input.routeId, input.label);
  route.label = input.label ?? route.label;
  route.score = Math.max(0, route.score + input.amount);
  route.changes += 1;
  route.firstSeenAt = route.firstSeenAt ?? now;
  route.lastChangedAt = now;
  route.levelCounts[input.levelId] = (route.levelCounts[input.levelId] ?? 0) + 1;
  profileRoutes.lastDominantRouteId = dominantCampaignRouteId(profileRoutes);
  touch(profile, now);
  saveUserProfile(profile);
}

function markRunDoubled(run: UserRunSummary | null, levelId: string, settlement: LevelSettlementState, endedAt: string) {
  if (!run || run.levelId !== levelId || run.outcome !== "victory") return;
  run.memoryReward = safeInteger(settlement.memoryGained, run.memoryReward);
  run.memoryDoubled = true;
  run.endedAt = endedAt;
}

function createDefaultCampaignRouteProfile(): CampaignRouteProfile {
  return {
    scores: {},
    choiceHistory: [],
    lastDominantRouteId: null,
  };
}

function ensureCampaignRouteProfile(profile: UserProfile) {
  profile.campaignRouteProfile = normalizeCampaignRouteProfile(profile.campaignRouteProfile);
  return profile.campaignRouteProfile;
}

function ensureCampaignRouteRecord(profile: CampaignRouteProfile, routeId: string, label?: string) {
  const existing = profile.scores[routeId];
  if (existing) return existing;

  const record: CampaignRouteScoreRecord = {
    id: routeId,
    label: label ?? routeId,
    score: 0,
    changes: 0,
    firstSeenAt: null,
    lastChangedAt: null,
    levelCounts: {},
  };
  profile.scores[routeId] = record;
  return record;
}

function dominantCampaignRouteId(profile: CampaignRouteProfile) {
  let bestRouteId: string | null = null;
  let bestScore = -Infinity;
  for (const route of Object.values(profile.scores)) {
    if (route.score <= bestScore) continue;
    bestScore = route.score;
    bestRouteId = route.id;
  }
  return bestRouteId;
}

function ensureLevelRecord(profile: UserProfile, levelId: string) {
  const existing = profile.levels[levelId];
  if (existing) return existing;

  const record: UserLevelRecord = {
    id: levelId,
    unlocked: false,
    attempts: 0,
    completions: 0,
    bestTimeSeconds: null,
    bestMemoryReward: 0,
    bestKillStreak: 0,
    bestUpgradeCount: 0,
    lowestRevivesUsed: null,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastOutcome: null,
    lastUpgradeIds: [],
    upgradePickCounts: {},
    lastRun: null,
  };
  profile.levels[levelId] = record;
  return record;
}

function ensureUpgradeRecord(profile: UserProfile, upgradeId: string) {
  const existing = profile.upgrades[upgradeId];
  if (existing) return existing;

  const record: UserUpgradeRecord = {
    id: upgradeId,
    offered: 0,
    picked: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    firstPickedAt: null,
    lastPickedAt: null,
    levelPickCounts: {},
  };
  profile.upgrades[upgradeId] = record;
  return record;
}

function normalizeProfile(raw: Partial<UserProfile>, progress: PlayerProgress): UserProfile {
  const fallback = createDefaultUserProfile(progress);
  const profile: UserProfile = {
    schemaVersion: 1,
    firstSeenAt: safeString(raw.firstSeenAt, fallback.firstSeenAt),
    updatedAt: safeString(raw.updatedAt, fallback.updatedAt),
    runsStarted: safeInteger(raw.runsStarted, 0),
    completedLevelIds: safeStringArray(raw.completedLevelIds),
    lastCompletedLevelId: safeNullableString(raw.lastCompletedLevelId),
    progressSnapshot: normalizeProgress(raw.progressSnapshot, progress),
    levels: {},
    upgrades: {},
    campaignRouteProfile: normalizeCampaignRouteProfile(raw.campaignRouteProfile),
    lastRun: normalizeRun(raw.lastRun),
  };

  const levels = asRecord(raw.levels);
  if (levels) {
    for (const [levelId, value] of Object.entries(levels)) {
      const levelRecord = normalizeLevelRecord(levelId, value);
      if (levelRecord) profile.levels[levelId] = levelRecord;
    }
  }

  const upgrades = asRecord(raw.upgrades);
  if (upgrades) {
    for (const [upgradeId, value] of Object.entries(upgrades)) {
      const upgradeRecord = normalizeUpgradeRecord(upgradeId, value);
      if (upgradeRecord) profile.upgrades[upgradeId] = upgradeRecord;
    }
  }

  return profile;
}

function normalizeCampaignRouteProfile(value: unknown): CampaignRouteProfile {
  const raw = asRecord(value);
  if (!raw) return createDefaultCampaignRouteProfile();

  const scores: Record<string, CampaignRouteScoreRecord> = {};
  const rawScores = asRecord(raw.scores);
  if (rawScores) {
    for (const [routeId, routeValue] of Object.entries(rawScores)) {
      const route = normalizeCampaignRouteRecord(routeId, routeValue);
      if (route) scores[route.id] = route;
    }
  }

  const choiceHistory = Array.isArray(raw.choiceHistory)
    ? raw.choiceHistory.map(normalizeCampaignChoiceRecord).filter((record): record is CampaignRouteChoiceRecord => Boolean(record)).slice(-80)
    : [];
  const result: CampaignRouteProfile = {
    scores,
    choiceHistory,
    lastDominantRouteId: safeNullableString(raw.lastDominantRouteId),
  };
  result.lastDominantRouteId = result.lastDominantRouteId && scores[result.lastDominantRouteId]
    ? result.lastDominantRouteId
    : dominantCampaignRouteId(result);
  return result;
}

function normalizeCampaignRouteRecord(routeId: string, value: unknown): CampaignRouteScoreRecord | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = safeString(raw.id, routeId);
  return {
    id,
    label: safeString(raw.label, id),
    score: safeNumber(raw.score, 0),
    changes: safeInteger(raw.changes, 0),
    firstSeenAt: safeNullableString(raw.firstSeenAt),
    lastChangedAt: safeNullableString(raw.lastChangedAt),
    levelCounts: safeCountMap(raw.levelCounts),
  };
}

function normalizeCampaignChoiceRecord(value: unknown): CampaignRouteChoiceRecord | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const levelId = safeString(raw.levelId, "");
  const choiceId = safeString(raw.choiceId, "");
  const optionId = safeString(raw.optionId, "");
  if (!levelId || !choiceId || !optionId) return null;
  return {
    levelId,
    choiceId,
    optionId,
    routeDeltas: normalizeRouteDeltas(Array.isArray(raw.routeDeltas) ? raw.routeDeltas : []),
    selectedAt: safeString(raw.selectedAt, nowIso()),
  };
}

function normalizeLevelRecord(levelId: string, value: unknown): UserLevelRecord | null {
  const raw = asRecord(value);
  if (!raw) return null;
  return {
    id: safeString(raw.id, levelId),
    unlocked: raw.unlocked === true,
    attempts: safeInteger(raw.attempts, 0),
    completions: safeInteger(raw.completions, 0),
    bestTimeSeconds: safeNullableNumber(raw.bestTimeSeconds),
    bestMemoryReward: safeInteger(raw.bestMemoryReward, 0),
    bestKillStreak: safeInteger(raw.bestKillStreak, 0),
    bestUpgradeCount: safeInteger(raw.bestUpgradeCount, 0),
    lowestRevivesUsed: safeNullableInteger(raw.lowestRevivesUsed),
    lastStartedAt: safeNullableString(raw.lastStartedAt),
    lastCompletedAt: safeNullableString(raw.lastCompletedAt),
    lastOutcome: normalizeOutcome(raw.lastOutcome),
    lastUpgradeIds: safeStringArray(raw.lastUpgradeIds),
    upgradePickCounts: safeCountMap(raw.upgradePickCounts),
    lastRun: normalizeRun(raw.lastRun),
  };
}

function normalizeUpgradeRecord(upgradeId: string, value: unknown): UserUpgradeRecord | null {
  const raw = asRecord(value);
  if (!raw) return null;
  return {
    id: safeString(raw.id, upgradeId),
    offered: safeInteger(raw.offered, 0),
    picked: safeInteger(raw.picked, 0),
    firstSeenAt: safeNullableString(raw.firstSeenAt),
    lastSeenAt: safeNullableString(raw.lastSeenAt),
    firstPickedAt: safeNullableString(raw.firstPickedAt),
    lastPickedAt: safeNullableString(raw.lastPickedAt),
    levelPickCounts: safeCountMap(raw.levelPickCounts),
  };
}

function normalizeRun(value: unknown): UserRunSummary | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const outcome = raw.outcome === "victory" || raw.outcome === "death" ? raw.outcome : null;
  if (!outcome) return null;
  return {
    levelId: safeString(raw.levelId, ""),
    outcome,
    durationSeconds: safeNumber(raw.durationSeconds, 0),
    memoryFragments: safeInteger(raw.memoryFragments, 0),
    memoryReward: safeInteger(raw.memoryReward, 0),
    bestKillStreak: safeInteger(raw.bestKillStreak, 0),
    kills: safeInteger(raw.kills, 0),
    upgradeIds: safeStringArray(raw.upgradeIds),
    revivesUsed: safeInteger(raw.revivesUsed, 0),
    memoryDoubled: raw.memoryDoubled === true,
    endedAt: safeString(raw.endedAt, nowIso()),
  };
}

function normalizeProgress(value: unknown, fallback: PlayerProgress): PlayerProgress {
  const raw = asRecord(value);
  if (!raw) return cloneProgress(fallback);
  const stats = asRecord(raw.stats);
  const normalizedStats: PlayerProgressStats = {
    health: safeInteger(stats?.health, fallback.stats.health),
    attack: safeInteger(stats?.attack, fallback.stats.attack),
    defense: safeInteger(stats?.defense, fallback.stats.defense),
    energy: safeInteger(stats?.energy, fallback.stats.energy),
  };
  return {
    totalMemory: safeInteger(raw.totalMemory, fallback.totalMemory),
    level: Math.max(1, safeInteger(raw.level, fallback.level)),
    pendingStatPoints: safeInteger(raw.pendingStatPoints, fallback.pendingStatPoints),
    stats: normalizedStats,
  };
}

function cloneProgress(progress: PlayerProgress): PlayerProgress {
  return {
    totalMemory: safeInteger(progress.totalMemory, 0),
    level: Math.max(1, safeInteger(progress.level, 1)),
    pendingStatPoints: safeInteger(progress.pendingStatPoints, 0),
    stats: {
      health: safeInteger(progress.stats.health, 0),
      attack: safeInteger(progress.stats.attack, 0),
      defense: safeInteger(progress.stats.defense, 0),
      energy: safeInteger(progress.stats.energy, 0),
    },
  };
}

function normalizeOutcome(value: unknown): UserRunOutcome | null {
  if (value === "started" || value === "death" || value === "victory") return value;
  return null;
}

function safeCountMap(value: unknown): Record<string, number> {
  const raw = asRecord(value);
  const result: Record<string, number> = {};
  if (!raw) return result;
  for (const [key, count] of Object.entries(raw)) {
    result[key] = safeInteger(count, 0);
  }
  return result;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueIds(value.filter((item): item is string => typeof item === "string"));
}

function normalizeRouteDeltas(value: readonly unknown[]): CampaignRouteDeltaRecord[] {
  const result: CampaignRouteDeltaRecord[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    if (!raw) continue;
    const routeId = safeString(raw.routeId, "");
    const amount = safeSignedNumber(raw.amount, 0);
    if (!routeId || amount === 0) continue;
    const label = safeNullableString(raw.label);
    result.push(label ? { routeId, amount, label } : { routeId, amount });
  }
  return result;
}

function addUnique(items: string[], id: string) {
  return items.includes(id) ? items : [...items, id];
}

function uniqueIds(ids: readonly string[]) {
  return Array.from(new Set(ids.filter((id) => id.length > 0)));
}

function safeNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function safeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function safeNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null;
}

function safeNullableInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function safeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function safeSignedNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function touch(profile: UserProfile, timestamp = nowIso()) {
  profile.updatedAt = timestamp;
}

function nowIso() {
  return new Date().toISOString();
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
