import { useEffect, useRef, useState } from "react";

export function usePolledSnapshot<T>(
  readSnapshot: () => T,
  intervalMs: number,
  isEqual: (current: T, next: T) => boolean = Object.is,
) {
  const readRef = useRef(readSnapshot);
  const equalRef = useRef(isEqual);
  const [snapshot, setSnapshot] = useState(() => readSnapshot());
  const snapshotRef = useRef(snapshot);

  readRef.current = readSnapshot;
  equalRef.current = isEqual;

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const update = () => {
      if (document.hidden) return;
      const next = readRef.current();
      if (equalRef.current(snapshotRef.current, next)) return;
      snapshotRef.current = next;
      setSnapshot(next);
    };

    update();
    const id = window.setInterval(update, intervalMs);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [intervalMs]);

  return snapshot;
}

export function shallowEqualSnapshot<T extends object>(current: T, next: T) {
  const currentRecord = current as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  let currentKeyCount = 0;

  for (const key in currentRecord) {
    if (!Object.prototype.hasOwnProperty.call(currentRecord, key)) continue;
    currentKeyCount += 1;
    if (!Object.is(currentRecord[key], nextRecord[key])) return false;
  }
  let nextKeyCount = 0;
  for (const key in nextRecord) {
    if (Object.prototype.hasOwnProperty.call(nextRecord, key)) nextKeyCount += 1;
  }
  if (currentKeyCount !== nextKeyCount) return false;
  return true;
}
