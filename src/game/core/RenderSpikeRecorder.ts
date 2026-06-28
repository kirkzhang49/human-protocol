import type { WebGLRenderer } from "three";
import { captureRenderBudgetSnapshot, type RenderBudgetSnapshot } from "./RenderBudgetSnapshot";
import type { GameWorld } from "./GameWorld";

type SpikeEventDetail = Record<string, unknown>;

export interface HumanProtocolPerfEvent {
  type: string;
  frameIndex: number;
  timeMs: number;
  levelId: string;
  roomId: string | null;
  detail: SpikeEventDetail;
}

interface RendererInfoSample {
  calls: number;
  triangles: number;
  lines: number;
  points: number;
  programs: number;
  geometries: number;
  textures: number;
}

interface SpikeFrameSample {
  frameIndex: number;
  timeMs: number;
  frameMs: number;
  averageMs: number;
  pressure: number;
  levelId: string;
  roomId: string | null;
  sessionMode: string;
  paused: boolean;
  qualityTier: string;
  activeEnemies: number;
  detailedSmallEnemies: number;
  projectiles: number;
  effects: number;
  openDoors: number;
  renderWarmupComplete: boolean;
  renderer: RendererInfoSample;
  recentEventTypes: string[];
}

interface RenderSpikeRecord {
  id: number;
  reasons: string[];
  frame: SpikeFrameSample;
  snapshot: RenderBudgetSnapshot;
  recentFrames: SpikeFrameSample[];
  recentEvents: HumanProtocolPerfEvent[];
}

interface PersistedSpikeSession {
  id: string;
  startedAt: string;
  updatedAt: string;
  pageUrl: string;
  userAgent: string;
  stats?: CumulativeRenderStats;
  frames: SpikeFrameSample[];
  events: HumanProtocolPerfEvent[];
  spikes: RenderSpikeRecord[];
}

interface PersistedSpikeStore {
  version: 1;
  sessions: PersistedSpikeSession[];
}

interface PersistedSpikeSessionSummary {
  id: string;
  startedAt: string;
  updatedAt: string;
  pageUrl: string;
  frames: number;
  events: number;
  spikes: number;
  levelIds: string[];
  roomIds: string[];
}

interface CumulativeRenderStats {
  totalFrames: number;
  gameplayFrames: number;
  totalFrameMs: number;
  gameplayFrameMs: number;
  maxFrameMs: number;
  gameplayMaxFrameMs: number;
  over28: number;
  gameplayOver28: number;
  over50: number;
  gameplayOver50: number;
}

interface SpikeWindowApi {
  getFrames: () => SpikeFrameSample[];
  getSpikes: () => RenderSpikeRecord[];
  getEvents: () => HumanProtocolPerfEvent[];
  getSavedSessions: () => PersistedSpikeSession[];
  getSavedSessionSummaries: () => PersistedSpikeSessionSummary[];
  setDetailedSmallEnemies: (world: GameWorld, ids: readonly number[]) => void;
  exportJson: () => string;
  exportSavedJson: (sessionId?: string) => string;
  clear: () => void;
  clearSaved: () => void;
}

const perfEvents: HumanProtocolPerfEvent[] = [];
const maxEventCount = 180;
const storageKey = "human-protocol:perf-spike-sessions:v1";
const domMirrorElementId = "human-protocol-perf-mirror";
const maxStoredSessionCount = 6;
const persistenceIntervalMs = 2500;
let cachedPerfEnabled: boolean | null = null;

export function isHumanProtocolPerfCaptureEnabled() {
  if (cachedPerfEnabled !== null) return cachedPerfEnabled;
  cachedPerfEnabled = typeof window !== "undefined" && window.location.search.includes("perf=1");
  return cachedPerfEnabled;
}

export function recordHumanProtocolPerfEvent(world: GameWorld, type: string, detail: SpikeEventDetail = {}) {
  if (!isHumanProtocolPerfCaptureEnabled()) return;
  exposePerfEventsWindowApi();
  pushPerfEvent({
    type,
    frameIndex: world.frameIndex,
    timeMs: nowMs(),
    levelId: world.level.id,
    roomId: world.session.mapProgress.currentRoomId ?? null,
    detail,
  });
}

export function setHumanProtocolDetailedSmallEnemies(world: GameWorld, ids: readonly number[]) {
  if (!isHumanProtocolPerfCaptureEnabled()) return;
  const api = (window as typeof window & { __humanProtocolSpikes?: SpikeWindowApi }).__humanProtocolSpikes;
  api?.setDetailedSmallEnemies(world, ids);
}

export class RenderSpikeRecorder {
  private readonly frames: SpikeFrameSample[] = [];
  private readonly spikes: RenderSpikeRecord[] = [];
  private readonly sessionId = createSessionId();
  private readonly startedAt = new Date().toISOString();
  private lastSpikeFrameIndex = -9999;
  private nextSpikeId = 1;
  private lastRoomId: string | null = null;
  private lastQualityTier = "";
  private lastWarmupComplete: boolean | null = null;
  private detailedSmallEnemyCount = 0;
  private readonly cumulativeStats = createCumulativeRenderStats();
  private savedSessions: PersistedSpikeSession[] = [];
  private persistenceQueued = false;
  private lastPersistenceMs = 0;
  private disposed = false;
  private readonly flushOnPageHide = () => this.flushPersistence();
  private readonly flushOnVisibilityHidden = () => {
    if (document.visibilityState === "hidden") this.flushPersistence();
  };

  constructor() {
    this.savedSessions = loadPersistedSessions();
    this.installWindowApi();
    this.installPersistenceHooks();
    this.publishDomMirror();
  }

  recordFrame(world: GameWorld, renderer: WebGLRenderer) {
    this.recordStateTransitions(world);
    if (!isRecordableRuntimeFrame(world)) {
      this.schedulePersistence();
      return;
    }
    const frame = this.captureFrame(world, renderer);
    updateCumulativeRenderStats(this.cumulativeStats, frame);
    this.frames.push(frame);
    if (this.frames.length > 180) this.frames.shift();

    const reasons = this.spikeReasons(frame);
    if (reasons.length === 0) {
      this.schedulePersistence();
      return;
    }
    if (frame.frameIndex - this.lastSpikeFrameIndex < 18) {
      this.schedulePersistence();
      return;
    }
    this.lastSpikeFrameIndex = frame.frameIndex;

    const spike: RenderSpikeRecord = {
      id: this.nextSpikeId,
      reasons,
      frame,
      snapshot: captureRenderBudgetSnapshot(world),
      recentFrames: this.frames.slice(-90),
      recentEvents: recentPerfEvents(frame.timeMs, 1800),
    };
    this.nextSpikeId += 1;
    this.spikes.push(spike);
    if (this.spikes.length > 24) this.spikes.shift();
    publishLatestSpike(spike);
    this.publishDomMirror(spike);
    this.schedulePersistence(true);
  }

  dispose() {
    if (this.disposed) return;
    this.flushPersistence();
    this.disposed = true;
    if (typeof window === "undefined") return;
    window.removeEventListener("pagehide", this.flushOnPageHide);
    window.removeEventListener("beforeunload", this.flushOnPageHide);
    document.removeEventListener("visibilitychange", this.flushOnVisibilityHidden);
  }

  private setDetailedSmallEnemies(world: GameWorld, ids: readonly number[]) {
    this.detailedSmallEnemyCount = ids.length;
    recordHumanProtocolPerfEvent(world, "enemy_detail_selection", {
      ids: [...ids],
      count: ids.length,
    });
  }

  private captureFrame(world: GameWorld, renderer: WebGLRenderer): SpikeFrameSample {
    const quality = world.renderPerformance.quality;
    const timeMs = nowMs();
    return {
      frameIndex: world.frameIndex,
      timeMs,
      frameMs: world.renderPerformance.lastFrameMs,
      averageMs: world.renderPerformance.averageFrameMs,
      pressure: world.renderPerformance.pressure,
      levelId: world.level.id,
      roomId: world.session.mapProgress.currentRoomId ?? null,
      sessionMode: world.session.mode,
      paused: world.paused,
      qualityTier: quality.tier,
      activeEnemies: countAliveEnemies(world),
      detailedSmallEnemies: this.detailedSmallEnemyCount,
      projectiles: world.projectiles.length,
      effects: world.effects.length,
      openDoors: world.session.mapProgress.openedDoorIds.length,
      renderWarmupComplete: world.renderWarmupComplete,
      renderer: captureRendererInfo(renderer),
      recentEventTypes: recentPerfEvents(timeMs, 700).map((event) => event.type),
    };
  }

  private recordStateTransitions(world: GameWorld) {
    const roomId = world.session.mapProgress.currentRoomId ?? null;
    if (this.lastRoomId !== roomId) {
      this.lastRoomId = roomId;
      recordHumanProtocolPerfEvent(world, "room_change", { roomId });
    }

    const qualityTier = world.renderPerformance.quality.tier;
    if (this.lastQualityTier !== qualityTier) {
      this.lastQualityTier = qualityTier;
      recordHumanProtocolPerfEvent(world, "quality_tier", { qualityTier });
    }

    if (this.lastWarmupComplete !== world.renderWarmupComplete) {
      this.lastWarmupComplete = world.renderWarmupComplete;
      recordHumanProtocolPerfEvent(world, "render_warmup", { complete: world.renderWarmupComplete });
    }
  }

  private spikeReasons(frame: SpikeFrameSample) {
    const reasons: string[] = [];
    if (frame.frameMs >= 50) reasons.push("hard_frame_spike");
    if (frame.frameMs >= 34 && frame.frameMs > frame.averageMs * 1.65) reasons.push("relative_frame_spike");
    if (frame.frameMs >= 28 && frame.recentEventTypes.length > 0) reasons.push("event_near_spike");
    if (reasons.length === 0) return reasons;
    if (frame.renderer.calls > 260) reasons.push("high_draw_calls");
    if (frame.renderer.triangles > 420000) reasons.push("high_triangle_count");
    return reasons;
  }

  private installWindowApi() {
    if (typeof window === "undefined") return;
    const api: SpikeWindowApi = {
      getFrames: () => this.frames.slice(),
      getSpikes: () => this.spikes.slice(),
      getEvents: () => perfEvents.slice(),
      getSavedSessions: () => {
        this.flushPersistence();
        return this.savedSessions.slice();
      },
      getSavedSessionSummaries: () => {
        this.flushPersistence();
        return this.savedSessions.map(toSessionSummary);
      },
      setDetailedSmallEnemies: (world, ids) => this.setDetailedSmallEnemies(world, ids),
      exportJson: () => {
        this.flushPersistence();
        return JSON.stringify({
          generatedAt: new Date().toISOString(),
          currentSessionId: this.sessionId,
          frames: this.frames,
          events: perfEvents,
          spikes: this.spikes,
          savedSessions: this.savedSessions,
        }, null, 2);
      },
      exportSavedJson: (sessionId) => {
        this.flushPersistence();
        const payload = sessionId
          ? this.savedSessions.find((session) => session.id === sessionId) ?? null
          : { version: 1, sessions: this.savedSessions };
        return JSON.stringify(payload, null, 2);
      },
      clear: () => {
        this.frames.length = 0;
        this.spikes.length = 0;
        perfEvents.length = 0;
        this.savedSessions = this.savedSessions.filter((session) => session.id !== this.sessionId);
        writePersistedSessions(this.savedSessions);
        this.publishDomMirror();
      },
      clearSaved: () => {
        this.savedSessions = [];
        if (canUseLocalStorage()) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            // Ignore storage failures in the debug-only recorder.
          }
        }
        this.publishDomMirror();
      },
    };
    (window as typeof window & { __humanProtocolSpikes?: SpikeWindowApi }).__humanProtocolSpikes = api;
  }

  private installPersistenceHooks() {
    if (typeof window === "undefined") return;
    window.addEventListener("pagehide", this.flushOnPageHide);
    window.addEventListener("beforeunload", this.flushOnPageHide);
    document.addEventListener("visibilitychange", this.flushOnVisibilityHidden);
  }

  private schedulePersistence(force = false) {
    if (this.disposed || !canUseLocalStorage()) return;
    const timeMs = nowMs();
    if (!force && timeMs - this.lastPersistenceMs < persistenceIntervalMs) return;
    if (this.persistenceQueued) return;

    this.persistenceQueued = true;
    const run = () => {
      this.persistenceQueued = false;
      this.flushPersistence();
    };
    const win = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    if (win.requestIdleCallback) {
      win.requestIdleCallback(run, { timeout: 1200 });
    } else {
      window.setTimeout(run, 0);
    }
  }

  private flushPersistence() {
    if (this.disposed || !canUseLocalStorage()) return;
    if (this.frames.length === 0 && this.spikes.length === 0 && perfEvents.length === 0) return;
    this.persistenceQueued = false;
    this.lastPersistenceMs = nowMs();
    const currentSession = this.buildPersistedSession();
    this.savedSessions = writePersistedSessions(mergePersistedSession(this.savedSessions, currentSession));
    this.publishDomMirror();
  }

  private buildPersistedSession(): PersistedSpikeSession {
    return {
      id: this.sessionId,
      startedAt: this.startedAt,
      updatedAt: new Date().toISOString(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      stats: { ...this.cumulativeStats },
      frames: this.frames.slice(),
      events: perfEvents.slice(),
      spikes: this.spikes.slice(),
    };
  }

  private publishDomMirror(latestSpike = this.spikes.length > 0 ? this.spikes[this.spikes.length - 1] : null) {
    if (typeof document === "undefined") return;
    const currentSession = this.buildPersistedSession();
    writePerfDomMirror({
      generatedAt: new Date().toISOString(),
      storageKey,
      currentSession: toSessionSummary(currentSession),
      currentStats: summarizeSessionStats(currentSession),
      savedSessions: this.savedSessions.map(toSessionSummary),
      latestSpike: latestSpike ? summarizeSpike(latestSpike) : null,
    });
  }
}

/**
 * Read-only perf-event hook for QA harnesses (gated behind ?perf=1). The raw
 * WebGPU path records events without mounting the Three governor's spike
 * recorder, so this is the only window-visible surface there.
 */
function exposePerfEventsWindowApi() {
  if (typeof window === "undefined") return;
  const target = window as typeof window & { __humanProtocolPerfEvents?: () => HumanProtocolPerfEvent[] };
  if (!target.__humanProtocolPerfEvents) {
    target.__humanProtocolPerfEvents = () => perfEvents.slice();
  }
}

function pushPerfEvent(event: HumanProtocolPerfEvent) {
  perfEvents.push(event);
  if (perfEvents.length > maxEventCount) perfEvents.shift();
}

function recentPerfEvents(timeMs: number, windowMs: number) {
  const events: HumanProtocolPerfEvent[] = [];
  for (let index = perfEvents.length - 1; index >= 0; index -= 1) {
    const event = perfEvents[index];
    if (timeMs - event.timeMs > windowMs) break;
    events.push(event);
  }
  events.reverse();
  return events;
}

function captureRendererInfo(renderer: WebGLRenderer): RendererInfoSample {
  const info = renderer.info;
  return {
    calls: info.render.calls,
    triangles: info.render.triangles,
    lines: info.render.lines,
    points: info.render.points,
    programs: info.programs?.length ?? 0,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
  };
}

function countAliveEnemies(world: GameWorld) {
  let count = 0;
  for (const enemy of world.enemies) {
    if (enemy.isAlive) count += 1;
  }
  return count;
}

function publishLatestSpike(spike: RenderSpikeRecord) {
  if (typeof window === "undefined") return;
  (window as typeof window & { __humanProtocolLatestSpike?: RenderSpikeRecord }).__humanProtocolLatestSpike = spike;
  console.warn("[HumanProtocol spike]", {
    id: spike.id,
    reasons: spike.reasons,
    frame: spike.frame,
    snapshot: spike.snapshot,
  });
  if (spike.recentEvents.length > 0) {
    console.table(spike.recentEvents.map((event) => ({
      frame: event.frameIndex,
      type: event.type,
      level: event.levelId,
      room: event.roomId,
      detail: JSON.stringify(event.detail),
    })));
  }
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function createSessionId() {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${randomSuffix}`;
}

function canUseLocalStorage() {
  if (typeof window === "undefined") return false;
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function loadPersistedSessions(): PersistedSpikeSession[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<PersistedSpikeStore>;
    if (!Array.isArray(parsed.sessions)) return [];
    return parsed.sessions.filter(isPersistedSpikeSession).slice(0, maxStoredSessionCount);
  } catch {
    return [];
  }
}

function writePersistedSessions(sessions: readonly PersistedSpikeSession[]) {
  if (!canUseLocalStorage()) return sessions.slice(0, maxStoredSessionCount);
  let next = trimPersistedSessions(sessions);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, sessions: next }));
      return next;
    } catch (error) {
      next = compactPersistedSessions(next);
      if (attempt === 3) {
        console.warn("[HumanProtocol spike] Unable to persist performance session.", error);
      }
    }
  }
  return next;
}

function mergePersistedSession(
  sessions: readonly PersistedSpikeSession[],
  currentSession: PersistedSpikeSession,
) {
  const merged = [
    currentSession,
    ...sessions.filter((session) => session.id !== currentSession.id),
  ];
  return trimPersistedSessions(merged);
}

function trimPersistedSessions(sessions: readonly PersistedSpikeSession[]) {
  return sessions
    .filter(hasSessionPayload)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, maxStoredSessionCount)
    .map((session) => ({
      ...session,
      frames: session.frames.slice(-180),
      events: session.events.slice(-maxEventCount),
      spikes: session.spikes.slice(-24),
    }));
}

function compactPersistedSessions(sessions: readonly PersistedSpikeSession[]) {
  const nextSessionCount = Math.max(1, Math.min(sessions.length - 1, 3));
  return sessions.slice(0, nextSessionCount).map((session) => ({
    ...session,
    frames: session.frames.slice(-60),
    events: session.events.slice(-80),
    spikes: session.spikes.slice(-8).map((spike) => ({
      ...spike,
      recentFrames: spike.recentFrames.slice(-30),
      recentEvents: spike.recentEvents.slice(-60),
    })),
  }));
}

function hasSessionPayload(session: PersistedSpikeSession) {
  return session.frames.length > 0 || session.events.length > 0 || session.spikes.length > 0;
}

function isPersistedSpikeSession(value: unknown): value is PersistedSpikeSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<PersistedSpikeSession>;
  return (
    typeof session.id === "string" &&
    typeof session.startedAt === "string" &&
    typeof session.updatedAt === "string" &&
    typeof session.pageUrl === "string" &&
    typeof session.userAgent === "string" &&
    Array.isArray(session.frames) &&
    Array.isArray(session.events) &&
    Array.isArray(session.spikes)
  );
}

function toSessionSummary(session: PersistedSpikeSession): PersistedSpikeSessionSummary {
  const levelIds = uniqueCompact([
    ...session.frames.map((frame) => frame.levelId),
    ...session.events.map((event) => event.levelId),
  ]);
  const roomIds = uniqueCompact([
    ...session.frames.map((frame) => frame.roomId),
    ...session.events.map((event) => event.roomId),
  ]);
  return {
    id: session.id,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    pageUrl: session.pageUrl,
    frames: session.stats?.totalFrames ?? session.frames.length,
    events: session.events.length,
    spikes: session.spikes.length,
    levelIds,
    roomIds,
  };
}

function uniqueCompact(values: readonly (string | null)[]) {
  const unique: string[] = [];
  for (const value of values) {
    if (!value || unique.includes(value)) continue;
    unique.push(value);
  }
  return unique.slice(0, 12);
}

function summarizeSpike(spike: RenderSpikeRecord) {
  return {
    id: spike.id,
    reasons: spike.reasons,
    frame: spike.frame,
    snapshot: spike.snapshot,
    recentEvents: spike.recentEvents,
    recentFrames: spike.recentFrames.slice(-20),
  };
}

function summarizeSessionStats(session: PersistedSpikeSession) {
  const gameplayFrames = session.frames.filter(isGameplayFrameSample);
  return {
    frames: session.stats?.totalFrames ?? session.frames.length,
    retainedFrames: session.frames.length,
    gameplayFrames: session.stats?.gameplayFrames ?? gameplayFrames.length,
    retainedGameplayFrames: gameplayFrames.length,
    events: session.events.length,
    spikes: session.spikes.length,
    cumulativeFrameMs: session.stats ? summarizeCumulativeFrameMs(session.stats) : null,
    frameMs: summarizeFrameMs(session.frames),
    gameplayFrameMs: summarizeFrameMs(gameplayFrames),
    eventCounts: countBy(session.events.map((event) => event.type)),
    spikeReasonCounts: countBy(session.spikes.flatMap((spike) => spike.reasons)),
    topSpikes: session.spikes
      .slice()
      .sort((left, right) => right.frame.frameMs - left.frame.frameMs)
      .slice(0, 8)
      .map(summarizeCompactSpike),
  };
}

function createCumulativeRenderStats(): CumulativeRenderStats {
  return {
    totalFrames: 0,
    gameplayFrames: 0,
    totalFrameMs: 0,
    gameplayFrameMs: 0,
    maxFrameMs: 0,
    gameplayMaxFrameMs: 0,
    over28: 0,
    gameplayOver28: 0,
    over50: 0,
    gameplayOver50: 0,
  };
}

function updateCumulativeRenderStats(stats: CumulativeRenderStats, frame: SpikeFrameSample) {
  stats.totalFrames += 1;
  stats.totalFrameMs += frame.frameMs;
  stats.maxFrameMs = Math.max(stats.maxFrameMs, frame.frameMs);
  if (frame.frameMs >= 28) stats.over28 += 1;
  if (frame.frameMs >= 50) stats.over50 += 1;
  if (!isGameplayFrameSample(frame)) return;
  stats.gameplayFrames += 1;
  stats.gameplayFrameMs += frame.frameMs;
  stats.gameplayMaxFrameMs = Math.max(stats.gameplayMaxFrameMs, frame.frameMs);
  if (frame.frameMs >= 28) stats.gameplayOver28 += 1;
  if (frame.frameMs >= 50) stats.gameplayOver50 += 1;
}

function isRecordableRuntimeFrame(world: GameWorld) {
  if (typeof document !== "undefined" && document.hidden) return false;
  return world.renderWarmupComplete && world.session.mode === "playing" && !world.paused;
}

function isGameplayFrameSample(frame: SpikeFrameSample) {
  return (
    frame.renderWarmupComplete &&
    Boolean(frame.roomId) &&
    frame.paused !== true &&
    frame.sessionMode !== "title" &&
    frame.sessionMode !== "transition"
  );
}

function summarizeCumulativeFrameMs(stats: CumulativeRenderStats) {
  return {
    count: stats.totalFrames,
    average: stats.totalFrames > 0 ? roundOne(stats.totalFrameMs / stats.totalFrames) : 0,
    max: roundOne(stats.maxFrameMs),
    over28: stats.over28,
    over50: stats.over50,
    gameplayCount: stats.gameplayFrames,
    gameplayAverage: stats.gameplayFrames > 0 ? roundOne(stats.gameplayFrameMs / stats.gameplayFrames) : 0,
    gameplayMax: roundOne(stats.gameplayMaxFrameMs),
    gameplayOver28: stats.gameplayOver28,
    gameplayOver50: stats.gameplayOver50,
  };
}

function summarizeFrameMs(frames: readonly SpikeFrameSample[]) {
  if (frames.length === 0) {
    return {
      count: 0,
      average: 0,
      p50: 0,
      p95: 0,
      max: 0,
      over28: 0,
      over50: 0,
    };
  }
  const values = frames.map((frame) => frame.frameMs).sort((left, right) => left - right);
  let total = 0;
  let over28 = 0;
  let over50 = 0;
  for (const value of values) {
    total += value;
    if (value >= 28) over28 += 1;
    if (value >= 50) over50 += 1;
  }
  return {
    count: values.length,
    average: roundOne(total / values.length),
    p50: roundOne(percentile(values, 0.5)),
    p95: roundOne(percentile(values, 0.95)),
    max: roundOne(values[values.length - 1]),
    over28,
    over50,
  };
}

function summarizeCompactSpike(spike: RenderSpikeRecord) {
  return {
    id: spike.id,
    reasons: spike.reasons,
    frameIndex: spike.frame.frameIndex,
    frameMs: roundOne(spike.frame.frameMs),
    averageMs: roundOne(spike.frame.averageMs),
    qualityTier: spike.frame.qualityTier,
    levelId: spike.frame.levelId,
    roomId: spike.frame.roomId,
    activeEnemies: spike.frame.activeEnemies,
    detailedSmallEnemies: spike.frame.detailedSmallEnemies,
    renderer: spike.frame.renderer,
    recentEventTypes: uniqueCompact(spike.recentEvents.map((event) => event.type)),
  };
}

function percentile(sortedValues: readonly number[], ratio: number) {
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[index];
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function countBy(values: readonly string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function writePerfDomMirror(payload: unknown) {
  let element = document.getElementById(domMirrorElementId) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = domMirrorElementId;
    element.type = "application/json";
    element.hidden = true;
    document.body.appendChild(element);
  }
  element.textContent = JSON.stringify(payload);
  document.documentElement.dataset.humanProtocolPerfCapture = "1";
}
