export function duplicateIds(ids: readonly string[]) {
  const seen = new Set<string>();
  const result = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) result.add(id);
    seen.add(id);
  }
  return [...result];
}

export function switchStateKey(switchId: string, stateId: string) {
  return `${switchId}:${stateId}`;
}

export function bigScreenStateKey(screenId: string, stateId: string) {
  return `${screenId}:${stateId}`;
}
