import {
  createSingleLevelConfigPack,
  saveCustomConfigPackFromText,
  type ConfigPackPlaytestMetadata,
  type ConfigPackImportResult,
} from "../game/config/ConfigPackStore";
import { validateLevelConfig, type ConfigValidationReport } from "../game/config/ConfigValidator";
import type { LevelDefinition } from "../game/config/schema/levelConfig";
import { compileBuilderProjectToLevel, type BuilderCompileIssue } from "./compileBuilderProjectToLevel";
import { createStarterProject, type BuilderProject } from "./BuilderTypes";

const draftStorageKey = "human-protocol-builder-draft-v1";
const saveSlotsStorageKey = "human-protocol-builder-save-slots-v1";

export const BUILDER_SAVE_SLOT_COUNT = 10;

export interface BuilderSaveSlotSummary {
  rooms: number;
  doors: number;
  props: number;
  pickups: number;
  robots: number;
  puzzles: number;
  routeSwitches: number;
  exitLabel: string;
}

export interface BuilderSaveSlot {
  index: number;
  title: string;
  savedAt: string | null;
  project: BuilderProject | null;
  summary: BuilderSaveSlotSummary | null;
}

interface StoredBuilderSaveSlot {
  title?: string;
  savedAt?: string;
  project?: unknown;
  summary?: Partial<BuilderSaveSlotSummary>;
}

export function loadBuilderDraft(): BuilderProject {
  if (typeof window === "undefined") return createStarterProject();
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return createStarterProject();
    const parsed = JSON.parse(raw) as BuilderProject;
    if (parsed?.schemaVersion !== "hp.builder.v1" || !Array.isArray(parsed.rooms)) return createStarterProject();
    return parsed;
  } catch {
    return createStarterProject();
  }
}

export function saveBuilderDraft(project: BuilderProject) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(draftStorageKey, JSON.stringify(project));
}

const onboardingSeenKey = "hp-builder-onboarding-seen-v1";

/** True once the creator has a real saved draft (vs the synthetic starter). */
export function hasBuilderDraft(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return Boolean(window.localStorage.getItem(draftStorageKey));
  } catch {
    return true;
  }
}

/** Whether the first-run template picker has already been shown/answered. */
export function hasSeenBuilderOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(onboardingSeenKey) === "1";
  } catch {
    return true;
  }
}

export function markBuilderOnboardingSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(onboardingSeenKey, "1");
  } catch {
    /* best-effort */
  }
}

export function loadBuilderSaveSlots(): BuilderSaveSlot[] {
  if (typeof window === "undefined") return emptyBuilderSaveSlots();
  try {
    const raw = window.localStorage.getItem(saveSlotsStorageKey);
    if (!raw) return emptyBuilderSaveSlots();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return emptyBuilderSaveSlots();
    return Array.from({ length: BUILDER_SAVE_SLOT_COUNT }, (_, index) => normalizeBuilderSaveSlot(parsed[index], index));
  } catch {
    return emptyBuilderSaveSlots();
  }
}

export function saveBuilderProjectSlot(slotIndex: number, project: BuilderProject): BuilderSaveSlot[] {
  if (typeof window === "undefined") return emptyBuilderSaveSlots();
  const index = normalizeSlotIndex(slotIndex);
  const slots = loadBuilderSaveSlots();
  if (index === null) return slots;
  const snapshot = cloneBuilderProject(project);
  const savedAt = new Date().toISOString();
  slots[index] = {
    index,
    title: builderSaveSlotTitle(snapshot),
    savedAt,
    project: snapshot,
    summary: summarizeBuilderSaveProject(snapshot),
  };
  writeBuilderSaveSlots(slots);
  return slots;
}

export function loadBuilderProjectFromSlot(slotIndex: number): BuilderProject | null {
  const index = normalizeSlotIndex(slotIndex);
  if (index === null) return null;
  const project = loadBuilderSaveSlots()[index]?.project ?? null;
  return project ? cloneBuilderProject(project) : null;
}

export function clearBuilderProjectSlot(slotIndex: number): BuilderSaveSlot[] {
  if (typeof window === "undefined") return emptyBuilderSaveSlots();
  const index = normalizeSlotIndex(slotIndex);
  const slots = loadBuilderSaveSlots();
  if (index === null) return slots;
  slots[index] = emptyBuilderSaveSlot(index);
  writeBuilderSaveSlots(slots);
  return slots;
}

export function summarizeBuilderSaveProject(project: BuilderProject): BuilderSaveSlotSummary {
  const exitRoom = project.rooms.find((room) => room.id === project.exitRoomId);
  return {
    rooms: project.rooms.length,
    doors: project.doors.length,
    props: project.props.length,
    pickups: project.pickups?.length ?? 0,
    robots: project.robots.reduce((total, robot) => total + robot.count, 0),
    puzzles: project.puzzles?.length ?? (project.puzzle ? 1 : 0),
    routeSwitches: project.routeSwitches?.length ?? 0,
    exitLabel: exitRoom?.label ?? "未设置出口",
  };
}

export interface BuilderValidationResult {
  level: LevelDefinition | null;
  compileIssues: BuilderCompileIssue[];
  report: ConfigValidationReport | null;
  ok: boolean;
}

export function validateBuilderProject(project: BuilderProject): BuilderValidationResult {
  const { level, issues } = compileBuilderProjectToLevel(project);
  if (!level) return { level: null, compileIssues: issues, report: null, ok: false };
  const report = validateLevelConfig(level, { authoringProfile: "generated" });
  return { level, compileIssues: issues, report, ok: report.ok };
}

export interface BuilderSaveResult extends BuilderValidationResult {
  importResult: ConfigPackImportResult | null;
  levelId: string | null;
}

export function saveBuilderProjectAsPack(
  project: BuilderProject,
  options: { playtest?: ConfigPackPlaytestMetadata } = {},
): BuilderSaveResult {
  const validation = validateBuilderProject(project);
  if (!validation.ok || !validation.level) {
    return { ...validation, importResult: null, levelId: null };
  }
  const pack = createSingleLevelConfigPack(validation.level);
  const importResult = saveCustomConfigPackFromText(JSON.stringify(pack), {
    replaceExistingLevelIds: true,
    playtest: options.playtest,
  });
  return {
    ...validation,
    importResult,
    levelId: importResult.ok ? validation.level.id : null,
  };
}

export function exportBuilderProjectJson(project: BuilderProject): string | null {
  const { level } = compileBuilderProjectToLevel(project);
  if (!level) return null;
  return JSON.stringify(createSingleLevelConfigPack(level), null, 2);
}

function emptyBuilderSaveSlots(): BuilderSaveSlot[] {
  return Array.from({ length: BUILDER_SAVE_SLOT_COUNT }, (_, index) => emptyBuilderSaveSlot(index));
}

function emptyBuilderSaveSlot(index: number): BuilderSaveSlot {
  return {
    index,
    title: "",
    savedAt: null,
    project: null,
    summary: null,
  };
}

function normalizeBuilderSaveSlot(raw: unknown, index: number): BuilderSaveSlot {
  if (!raw || typeof raw !== "object") return emptyBuilderSaveSlot(index);
  const stored = raw as StoredBuilderSaveSlot;
  if (!isBuilderProject(stored.project)) return emptyBuilderSaveSlot(index);
  const summary = summarizeBuilderSaveProject(stored.project);
  return {
    index,
    title: typeof stored.title === "string" && stored.title.trim() ? stored.title.trim() : builderSaveSlotTitle(stored.project),
    savedAt: typeof stored.savedAt === "string" ? stored.savedAt : null,
    project: stored.project,
    summary: {
      ...summary,
      ...normalizeBuilderSaveSlotSummary(stored.summary, summary),
    },
  };
}

function normalizeBuilderSaveSlotSummary(
  summary: Partial<BuilderSaveSlotSummary> | undefined,
  fallback: BuilderSaveSlotSummary,
): BuilderSaveSlotSummary {
  if (!summary || typeof summary !== "object") return fallback;
  return {
    rooms: safeCount(summary.rooms, fallback.rooms),
    doors: safeCount(summary.doors, fallback.doors),
    props: safeCount(summary.props, fallback.props),
    pickups: safeCount(summary.pickups, fallback.pickups),
    robots: safeCount(summary.robots, fallback.robots),
    puzzles: safeCount(summary.puzzles, fallback.puzzles),
    routeSwitches: safeCount(summary.routeSwitches, fallback.routeSwitches),
    exitLabel: typeof summary.exitLabel === "string" && summary.exitLabel.trim() ? summary.exitLabel.trim() : fallback.exitLabel,
  };
}

function writeBuilderSaveSlots(slots: readonly BuilderSaveSlot[]) {
  if (typeof window === "undefined") return;
  const stored = Array.from({ length: BUILDER_SAVE_SLOT_COUNT }, (_, index) => {
    const slot = slots[index];
    if (!slot?.project) return null;
    return {
      title: slot.title || builderSaveSlotTitle(slot.project),
      savedAt: slot.savedAt ?? new Date().toISOString(),
      summary: slot.summary ?? summarizeBuilderSaveProject(slot.project),
      project: slot.project,
    };
  });
  window.localStorage.setItem(saveSlotsStorageKey, JSON.stringify(stored));
}

function isBuilderProject(value: unknown): value is BuilderProject {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as BuilderProject).schemaVersion === "hp.builder.v1" &&
      typeof (value as BuilderProject).projectId === "string" &&
      typeof (value as BuilderProject).title === "string" &&
      Array.isArray((value as BuilderProject).rooms) &&
      Array.isArray((value as BuilderProject).doors) &&
      Array.isArray((value as BuilderProject).props) &&
      Array.isArray((value as BuilderProject).robots),
  );
}

function cloneBuilderProject(project: BuilderProject): BuilderProject {
  // structuredClone is ~2-4x faster than JSON round-tripping and runs on every
  // debounced autosave; the project is plain serializable data so it's safe.
  // Fall back to JSON for any environment without structuredClone.
  if (typeof structuredClone === "function") return structuredClone(project);
  return JSON.parse(JSON.stringify(project)) as BuilderProject;
}

function builderSaveSlotTitle(project: BuilderProject): string {
  return project.title.trim() || "未命名密室";
}

function safeCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

function normalizeSlotIndex(slotIndex: number): number | null {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= BUILDER_SAVE_SLOT_COUNT) return null;
  return slotIndex;
}
