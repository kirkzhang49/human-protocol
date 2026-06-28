import type { BuilderProject } from "./BuilderTypes";

const preservedCachedOfficialDraftLevelIds = new Set<string>();

export function isPreservedCachedOfficialDraftLevel(levelId: string | null | undefined) {
  return Boolean(levelId && preservedCachedOfficialDraftLevelIds.has(levelId));
}

export function shouldResetCachedOfficialDraft(project: BuilderProject) {
  const sourceLevelId = project.sourceLevel?.levelId;
  return Boolean(sourceLevelId && !isPreservedCachedOfficialDraftLevel(sourceLevelId));
}
