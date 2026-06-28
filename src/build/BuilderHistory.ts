import { useCallback, useRef, useState } from "react";
import type { BuilderProject } from "./BuilderTypes";

const historyLimit = 50;

export interface BuilderHistoryControls {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Snapshot the current project before a gesture (e.g. drag) whose steps should collapse into one undo entry. */
  mark: () => void;
}

export type BuilderUpdate = (mutate: (draft: BuilderProject) => BuilderProject, options?: { record?: boolean }) => void;

/**
 * Undo/redo state for the builder. History bookkeeping happens outside React
 * updater functions (StrictMode double-invokes those, which would duplicate
 * undo entries); `latestRef` is the single source of truth for "current".
 */
export function useBuilderHistory(initial: () => BuilderProject): [BuilderProject, BuilderUpdate, (project: BuilderProject) => void, BuilderHistoryControls] {
  const [project, setProject] = useState<BuilderProject>(initial);
  const latestRef = useRef(project);
  const pastRef = useRef<BuilderProject[]>([]);
  const futureRef = useRef<BuilderProject[]>([]);
  const [, setHistoryVersion] = useState(0);
  const bumpHistory = () => setHistoryVersion((value) => value + 1);

  const update = useCallback<BuilderUpdate>((mutate, options) => {
    const current = latestRef.current;
    const next = mutate(current);
    if (next === current) return;
    if (options?.record !== false) {
      pastRef.current = [...pastRef.current.slice(-historyLimit + 1), current];
      futureRef.current = [];
    }
    latestRef.current = next;
    setProject(next);
    bumpHistory();
  }, []);

  const replace = useCallback((next: BuilderProject) => {
    latestRef.current = next;
    pastRef.current = [];
    futureRef.current = [];
    setProject(next);
    bumpHistory();
  }, []);

  const mark = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-historyLimit + 1), latestRef.current];
    futureRef.current = [];
    bumpHistory();
  }, []);

  const undo = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, latestRef.current];
    latestRef.current = previous;
    setProject(previous);
    bumpHistory();
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) return;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, latestRef.current];
    latestRef.current = next;
    setProject(next);
    bumpHistory();
  }, []);

  return [
    project,
    update,
    replace,
    { undo, redo, mark, canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0 },
  ];
}
