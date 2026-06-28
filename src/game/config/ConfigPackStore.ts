import { level01MaintenanceBay } from "./levelManifest";
import { level03HumanMuseum } from "./levels/level03HumanMuseum";
import { level04MemoryClinic } from "./levels/level04-memory-clinic";
import { level05ReclamationCore } from "./levels/level05-reclamation-core";
import { level02ResidentialSimulation } from "./levels/residentialSimulationLevel";
import {
  circuitGridSmokeLevel,
  galleryReadingSmokeLevel,
  surveillanceMatchSmokeLevel,
  valveMatrixSmokeLevel,
} from "./smoke/cyberPuzzleSmokeLevels";
import { directionCodeSmokeLevel } from "./smoke/directionCodeSmokeLevel";
import { bigScreenFormulaSmokeLevel } from "./smoke/bigScreenFormulaSmokeLevel";
import { doorSwitchSmokeLevel } from "./smoke/doorSwitchSmokeLevel";
import { keyOrbCodeSmokeLevel } from "./smoke/keyOrbCodeSmokeLevel";
import { keyDoorSmokeLevel } from "./smoke/keyDoorSmokeLevel";
import { puzzleOrbSmokeLevel } from "./smoke/puzzleOrbSmokeLevel";
import type { LevelDefinition } from "./schema/levelConfig";
import { assertValidLevelConfig, validateLevelConfig, type ConfigValidationIssue, type ConfigValidationReport } from "./ConfigValidator";
import { BUILDER_PLAYTEST_ENGINE_VERSION } from "./BuilderPlaytestVersion";
import { normalizeLevelExitRoomReference } from "./shared/exitRoomReference";

export interface ConfigPackDefinition {
  schemaVersion: "hp.config.v1";
  packId: string;
  title: string;
  description: string;
  campaignLevelIds: readonly string[];
  levels: readonly LevelDefinition[];
  playtest?: ConfigPackPlaytestMetadata;
}

export interface ConfigPackPlaytestMetadata {
  runtimePackId?: string;
  bakeMode?: "proxy" | "cooked-glb";
  projectHash?: string;
  configHash?: string;
  runtimeResourceHash?: string;
  builderSnapshotId?: string;
  engineVersion?: string;
  updatedAt?: number;
}

export interface CustomConfigPackSlot {
  pack: ConfigPackDefinition;
  savedAt: number;
  reports: readonly {
    levelId: string;
    report: ConfigValidationReport;
  }[];
}

export interface ConfigPackImportResult {
  ok: boolean;
  slot?: CustomConfigPackSlot;
  errors: readonly ConfigValidationIssue[];
  warnings: readonly ConfigValidationIssue[];
}

export interface SaveCustomConfigPackOptions {
  /**
   * Internal builder/trial saves are authoritative snapshots for their level id.
   * They may replace earlier generated/dev-trial packs with the same level id.
   * Manual imports keep the default conflict protection.
   */
  replaceExistingLevelIds?: boolean;
  playtest?: ConfigPackPlaytestMetadata;
}

export interface PlayableLevelEntry {
  id: string;
  title: string;
  packId: string;
  packTitle: string;
  source: "built-in" | "custom";
}

const customPackStorageKey = "human-protocol-custom-config-packs-v1";
const customLevelValidationOptions = { authoringProfile: "generated" as const };

export const humanProtocolBasePack: ConfigPackDefinition = {
  schemaVersion: "hp.config.v1",
  packId: "human-protocol-base-demo",
  title: "Human Protocol Demo",
  description: "Official config pack for levels 1-5 plus generated-level smoke samples.",
  campaignLevelIds: [
    level01MaintenanceBay.id,
    level02ResidentialSimulation.id,
    level03HumanMuseum.id,
    level04MemoryClinic.id,
    level05ReclamationCore.id,
  ],
  levels: [
    level01MaintenanceBay,
    level02ResidentialSimulation,
    level03HumanMuseum,
    level04MemoryClinic,
    level05ReclamationCore,
    keyDoorSmokeLevel,
    puzzleOrbSmokeLevel,
    directionCodeSmokeLevel,
    keyOrbCodeSmokeLevel,
    doorSwitchSmokeLevel,
    bigScreenFormulaSmokeLevel,
    circuitGridSmokeLevel,
    surveillanceMatchSmokeLevel,
    valveMatrixSmokeLevel,
    galleryReadingSmokeLevel,
  ].map(normalizePlayableLevelConfig),
};

function normalizePlayableLevelConfig(level: LevelDefinition): LevelDefinition {
  return normalizeLevelExitRoomReference(level);
}

function normalizeConfigPackExitRooms(pack: ConfigPackDefinition): ConfigPackDefinition {
  return {
    ...pack,
    levels: pack.levels.map(normalizePlayableLevelConfig),
    playtest: normalizePlaytestMetadata(pack.playtest),
  };
}

export const builtInValidationReports = humanProtocolBasePack.levels.map((level) => ({
  levelId: level.id,
  report: validateLevelConfig(level),
}));

export const defaultLevelId = level01MaintenanceBay.id;

export function getBuiltInLevelConfig(levelId = level01MaintenanceBay.id) {
  const level = normalizePlayableLevelConfig(humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId) ?? humanProtocolBasePack.levels[0]);
  assertValidLevelConfig(level);
  return level;
}

export function getLevelConfig(levelId = level01MaintenanceBay.id) {
  const builtInLevel = humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId);
  if (builtInLevel) {
    const level = normalizePlayableLevelConfig(builtInLevel);
    assertValidLevelConfig(level);
    return level;
  }

  for (const slot of loadCustomConfigPackSlots()) {
    const customLevel = slot.pack.levels.find((candidate) => candidate.id === levelId);
    if (!customLevel) continue;
    const level = normalizePlayableLevelConfig(customLevel);
    assertValidLevelConfig(level, customLevelValidationOptions);
    return level;
  }

  return getBuiltInLevelConfig();
}

export function getNextCampaignLevelConfig(levelId: string) {
  const currentIndex = humanProtocolBasePack.campaignLevelIds.indexOf(levelId);
  if (currentIndex >= 0) {
    const nextLevelId = humanProtocolBasePack.campaignLevelIds[currentIndex + 1];
    return nextLevelId ? getLevelConfig(nextLevelId) : null;
  }

  for (const slot of loadCustomConfigPackSlots()) {
    const customIndex = slot.pack.campaignLevelIds.indexOf(levelId);
    if (customIndex < 0) continue;
    const nextLevelId = slot.pack.campaignLevelIds[customIndex + 1];
    return nextLevelId ? getLevelConfig(nextLevelId) : null;
  }

  return null;
}

export function listPlayableLevels(): PlayableLevelEntry[] {
  const builtIn = humanProtocolBasePack.levels.map((level) => ({
    id: level.id,
    title: level.title,
    packId: humanProtocolBasePack.packId,
    packTitle: humanProtocolBasePack.title,
    source: "built-in" as const,
  }));

  const custom = loadCustomConfigPackSlots().flatMap((slot) =>
    slot.pack.levels.map((level) => ({
      id: level.id,
      title: level.title,
      packId: slot.pack.packId,
      packTitle: slot.pack.title,
      source: "custom" as const,
    })),
  );

  return [...builtIn, ...custom];
}

export function loadCustomConfigPackSlots(): CustomConfigPackSlot[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const raw = window.localStorage.getItem(customPackStorageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate) => normalizeStoredSlot(candidate));
  } catch {
    return [];
  }
}

export function saveCustomConfigPackFromText(text: string, options: SaveCustomConfigPackOptions = {}) {
  const result = parseConfigPackText(text);
  if (!result.ok || !result.slot) return result;
  const slot = options.playtest ? slotWithPlaytestMetadata(result.slot, options.playtest) : result.slot;
  const conflict = findSavedLevelConflict(slot);
  if (conflict && !options.replaceExistingLevelIds) {
    return {
      ok: false,
      errors: [issue("pack.level.id.saved_conflict", "levels", `Custom level id ${conflict.levelId} already exists in ${conflict.packTitle}.`)],
      warnings: result.warnings,
    };
  }
  saveCustomConfigPackSlot(slot, options);
  return { ...result, slot };
}

export function deleteCustomConfigPack(packId: string) {
  if (typeof window === "undefined") return false;
  const before = loadCustomConfigPackSlots();
  const after = before.filter((slot) => slot.pack.packId !== packId);
  try {
    window.localStorage.setItem(customPackStorageKey, JSON.stringify(after));
  } catch {
    // Best-effort: storage write may throw (private mode / quota); don't crash.
  }
  return before.length !== after.length;
}

export function parseConfigPackText(text: string): ConfigPackImportResult {
  try {
    return importConfigPack(JSON.parse(text));
  } catch {
    return {
      ok: false,
      errors: [issue("pack.json.invalid", "json", "JSON could not be parsed.")],
      warnings: [],
    };
  }
}

export function importConfigPack(input: unknown): ConfigPackImportResult {
  const pack = normalizeConfigPackInput(input);
  if (!pack) {
    return {
      ok: false,
      errors: [issue("pack.shape.invalid", "pack", "Expected a config pack or a single level config.")],
      warnings: [],
    };
  }

  return validateConfigPackDefinition(pack);
}

export function validateConfigPackDefinition(pack: ConfigPackDefinition): ConfigPackImportResult {
  pack = normalizeConfigPackExitRooms(pack);
  const errors: ConfigValidationIssue[] = [];
  const warnings: ConfigValidationIssue[] = [];

  if (pack.schemaVersion !== "hp.config.v1") {
    errors.push(issue("pack.schema.unsupported", "schemaVersion", "Only hp.config.v1 packs are supported."));
  }
  if (!pack.packId || !safeId(pack.packId)) {
    errors.push(issue("pack.id.invalid", "packId", "Pack id must use letters, numbers, dash or underscore."));
  }
  if (pack.packId === humanProtocolBasePack.packId) {
    errors.push(issue("pack.id.built_in_conflict", "packId", "Custom pack id cannot match the built-in pack."));
  }
  if (!pack.levels.length) {
    errors.push(issue("pack.levels.empty", "levels", "Pack must include at least one level."));
  }

  const builtInLevelIds = new Set(humanProtocolBasePack.levels.map((level) => level.id));
  const packLevelIds = new Set<string>();
  for (const [index, level] of pack.levels.entries()) {
    if (packLevelIds.has(level.id)) {
      errors.push(issue("pack.level.id.duplicate", `levels.${index}.id`, `Duplicate level id ${level.id}.`));
    }
    if (builtInLevelIds.has(level.id)) {
      errors.push(issue("pack.level.id.built_in_conflict", `levels.${index}.id`, `Custom level id ${level.id} conflicts with a built-in level.`));
    }
    packLevelIds.add(level.id);

    const report = validateLevelConfig(level, customLevelValidationOptions);
    errors.push(...report.errors.map((error) => prefixIssue(error, `levels.${index}`)));
    warnings.push(...report.warnings.map((warning) => prefixIssue(warning, `levels.${index}`)));
  }

  for (const [index, levelId] of pack.campaignLevelIds.entries()) {
    if (!packLevelIds.has(levelId)) {
      errors.push(issue("pack.campaign.unknown_level", `campaignLevelIds.${index}`, `Campaign level ${levelId} is not included in this pack.`));
    }
  }

  const slot: CustomConfigPackSlot = {
    pack,
    savedAt: Date.now(),
    reports: pack.levels.map((level) => ({
      levelId: level.id,
      report: validateLevelConfig(level, customLevelValidationOptions),
    })),
  };

  return {
    ok: errors.length === 0,
    slot: errors.length === 0 ? slot : undefined,
    errors,
    warnings,
  };
}

export function createSingleLevelConfigPack(level: LevelDefinition, packId = `generated-${level.id}`): ConfigPackDefinition {
  const generatedLevel: LevelDefinition = normalizePlayableLevelConfig({
    ...level,
    authoringProfile: level.authoringProfile ?? "generated",
  });
  return {
    schemaVersion: "hp.config.v1",
    packId: uniqueCustomPackId(packId),
    title: `${generatedLevel.title} Pack`,
    description: `Single-level config pack for ${generatedLevel.title}.`,
    campaignLevelIds: [generatedLevel.id],
    levels: [generatedLevel],
  };
}

export function getLevelPlaytestMetadata(levelId: string): ConfigPackPlaytestMetadata | null {
  for (const slot of loadCustomConfigPackSlots()) {
    if (slot.pack.levels.some((level) => level.id === levelId)) return slot.pack.playtest ?? null;
  }
  return null;
}

export function exportLevelConfigPackJson(level: LevelDefinition) {
  const exportedLevel = isBuiltInLevelId(level.id)
    ? { ...level, id: `${level.id}_custom`, title: `${level.title} Copy` }
    : level;
  return JSON.stringify(createSingleLevelConfigPack(exportedLevel), null, 2);
}

export function exportBaseConfigPackJson() {
  return JSON.stringify(humanProtocolBasePack, null, 2);
}

function requestedLevelId() {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("level") ?? undefined;
}

export const activeLevelConfig = initialActiveLevelConfig();

function initialActiveLevelConfig() {
  const levelId = requestedLevelId();
  if (levelId) return getLevelConfig(levelId);
  // Keep module import side-effect-light for asset compilers and SSR tools:
  // they often create a GameWorld only to immediately load a specific level.
  // Dedicated validation still lives in builtInValidationReports/smoke tests.
  return normalizePlayableLevelConfig(humanProtocolBasePack.levels[0]);
}

function saveCustomConfigPackSlot(slot: CustomConfigPackSlot, options: SaveCustomConfigPackOptions = {}) {
  if (typeof window === "undefined") return;
  const slots = loadCustomConfigPackSlots();
  const replacingLevelIds = options.replaceExistingLevelIds ? new Set(slot.pack.levels.map((level) => level.id)) : null;
  const next = [
    slot,
    ...slots.filter((candidate) => {
      if (candidate.pack.packId === slot.pack.packId) return false;
      if (replacingLevelIds && candidate.pack.levels.some((level) => replacingLevelIds.has(level.id))) return false;
      return true;
    }),
  ];
  try {
    window.localStorage.setItem(customPackStorageKey, JSON.stringify(next.slice(0, 12)));
  } catch {
    // Best-effort: storage write may throw (private mode / quota); don't crash.
  }
}

function findSavedLevelConflict(slot: CustomConfigPackSlot) {
  const importedIds = new Set(slot.pack.levels.map((level) => level.id));
  for (const saved of loadCustomConfigPackSlots()) {
    if (saved.pack.packId === slot.pack.packId) continue;
    const conflict = saved.pack.levels.find((level) => importedIds.has(level.id));
    if (conflict) {
      return {
        levelId: conflict.id,
        packTitle: saved.pack.title,
      };
    }
  }
  return null;
}

function normalizeStoredSlot(input: unknown): CustomConfigPackSlot[] {
  if (!isRecord(input) || !isRecord(input.pack)) return [];
  const result = validateConfigPackDefinition(input.pack as unknown as ConfigPackDefinition);
  if (!result.ok || !result.slot) return [];
  if (isStalePlaytestSlot(result.slot)) return [];
  return [{
    ...result.slot,
    savedAt: typeof input.savedAt === "number" ? input.savedAt : result.slot.savedAt,
  }];
}

function isStalePlaytestSlot(slot: CustomConfigPackSlot) {
  const playtest = slot.pack.playtest;
  return Boolean(playtest && playtest.engineVersion !== BUILDER_PLAYTEST_ENGINE_VERSION);
}

function normalizeConfigPackInput(input: unknown): ConfigPackDefinition | null {
  if (!isRecord(input)) return null;

  if (Array.isArray(input.levels)) {
    const levels = input.levels.filter(isRecord) as unknown as LevelDefinition[];
    const campaignLevelIds = Array.isArray(input.campaignLevelIds)
      ? input.campaignLevelIds.filter((id): id is string => typeof id === "string")
      : levels.map((level) => level.id);
    return {
      schemaVersion: input.schemaVersion as "hp.config.v1",
      packId: typeof input.packId === "string" ? input.packId : uniqueCustomPackId("generated-pack"),
      title: typeof input.title === "string" ? input.title : "Generated Config Pack",
      description: typeof input.description === "string" ? input.description : "Imported local config pack.",
      campaignLevelIds: campaignLevelIds.length ? campaignLevelIds : levels.map((level) => level.id),
      levels,
      playtest: normalizePlaytestMetadata(input.playtest),
    };
  }

  if (typeof input.id === "string" && isRecord(input.map)) {
    return createSingleLevelConfigPack(input as unknown as LevelDefinition);
  }

  return null;
}

function slotWithPlaytestMetadata(slot: CustomConfigPackSlot, metadata: ConfigPackPlaytestMetadata): CustomConfigPackSlot {
  const playtest = normalizePlaytestMetadata(metadata);
  return {
    ...slot,
    pack: {
      ...slot.pack,
      ...(playtest ? { playtest } : {}),
    },
  };
}

function normalizePlaytestMetadata(value: unknown): ConfigPackPlaytestMetadata | undefined {
  if (!isRecord(value)) return undefined;
  const bakeMode = value.bakeMode === "proxy" || value.bakeMode === "cooked-glb" ? value.bakeMode : undefined;
  return {
    runtimePackId: typeof value.runtimePackId === "string" ? value.runtimePackId : undefined,
    bakeMode,
    projectHash: typeof value.projectHash === "string" ? value.projectHash : undefined,
    configHash: typeof value.configHash === "string" ? value.configHash : undefined,
    runtimeResourceHash: typeof value.runtimeResourceHash === "string" ? value.runtimeResourceHash : undefined,
    builderSnapshotId: typeof value.builderSnapshotId === "string" ? value.builderSnapshotId : undefined,
    engineVersion: typeof value.engineVersion === "string" ? value.engineVersion : undefined,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : undefined,
  };
}

function uniqueCustomPackId(baseId: string) {
  const normalized = baseId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || `generated-pack-${Date.now()}`;
}

function safeId(id: string) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

function isBuiltInLevelId(levelId: string) {
  return humanProtocolBasePack.levels.some((level) => level.id === levelId);
}

function issue(code: string, path: string, message: string): ConfigValidationIssue {
  return { code, path, message };
}

function prefixIssue(issueToPrefix: ConfigValidationIssue, prefix: string): ConfigValidationIssue {
  return {
    ...issueToPrefix,
    path: `${prefix}.${issueToPrefix.path}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
