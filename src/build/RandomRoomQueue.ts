import type { GameLanguage } from "../game/core/GameSettings";
import type { BuilderProject } from "./BuilderTypes";
import { normalizeBuilderPuzzles } from "./BuilderPuzzleCatalog";
import { generateRandomRoom } from "./devGenerateRoom";

export const RANDOM_ROOM_QUEUE_TARGET = 10;

type GenerateRandomRoom = (seed: number, language: GameLanguage) => BuilderProject;
type NormalizeRandomRoom = (project: BuilderProject) => BuilderProject;
type PrepareRandomRoom = (project: BuilderProject) => void;

export interface RandomRoomQueueOptions {
  targetSize?: number;
  seedFactory?: () => number;
  generate?: GenerateRandomRoom;
  normalize?: NormalizeRandomRoom;
  prepare?: PrepareRandomRoom;
}

export interface RandomRoomQueue {
  readonly targetSize: number;
  size(language: GameLanguage): number;
  fillOne(language: GameLanguage): void;
  fillTo(language: GameLanguage, targetSize?: number): void;
  take(language: GameLanguage): BuilderProject;
}

function defaultSeedFactory() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function createRandomRoomQueue(options: RandomRoomQueueOptions = {}): RandomRoomQueue {
  const targetSize = Math.max(1, Math.floor(options.targetSize ?? RANDOM_ROOM_QUEUE_TARGET));
  const seedFactory = options.seedFactory ?? defaultSeedFactory;
  const generate = options.generate ?? generateRandomRoom;
  const normalize = options.normalize ?? normalizeBuilderPuzzles;
  const prepare = options.prepare;
  const buckets = new Map<GameLanguage, BuilderProject[]>();

  const bucketFor = (language: GameLanguage) => {
    let bucket = buckets.get(language);
    if (!bucket) {
      bucket = [];
      buckets.set(language, bucket);
    }
    return bucket;
  };
  const makeProject = (language: GameLanguage) => {
    const project = normalize(generate(seedFactory(), language));
    prepare?.(project);
    return project;
  };

  return {
    targetSize,
    size(language) {
      return bucketFor(language).length;
    },
    fillOne(language) {
      const bucket = bucketFor(language);
      if (bucket.length >= targetSize) return;
      bucket.push(makeProject(language));
    },
    fillTo(language, requestedTargetSize = targetSize) {
      const cappedTarget = Math.max(1, Math.min(targetSize, Math.floor(requestedTargetSize)));
      while (bucketFor(language).length < cappedTarget) this.fillOne(language);
    },
    take(language) {
      return bucketFor(language).shift() ?? makeProject(language);
    },
  };
}

function scheduleIdle(callback: () => void) {
  const idle = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof idle.requestIdleCallback === "function") {
    const id = idle.requestIdleCallback(callback, { timeout: 300 });
    return () => idle.cancelIdleCallback?.(id);
  }
  const id = globalThis.setTimeout(callback, 16);
  return () => globalThis.clearTimeout(id);
}

export function scheduleRandomRoomQueueWarmup(
  queue: RandomRoomQueue,
  language: GameLanguage,
  targetSize = queue.targetSize,
): () => void {
  let cancelled = false;
  let cancelScheduled: (() => void) | undefined;

  const pump = () => {
    if (cancelled) return;
    queue.fillOne(language);
    if (queue.size(language) < targetSize) {
      cancelScheduled = scheduleIdle(pump);
    }
  };

  cancelScheduled = scheduleIdle(pump);
  return () => {
    cancelled = true;
    cancelScheduled?.();
  };
}
