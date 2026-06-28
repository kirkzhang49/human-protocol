import fsSync from "node:fs";
import path from "node:path";
import { roundNumber } from "./raw-webgpu-plan-utils.mjs";

export function loadRawLightingAlgorithmTuning({ enabled, gameRoot, filePath }) {
  const tuning = loadJsonTuning({ enabled, gameRoot, filePath, label: "raw lighting algorithm tuning", validate: (value) => value?.rooms && typeof value.rooms === "object" });
  return tuning;
}

export function loadRawVisualColorTuning({ enabled, gameRoot, filePath }) {
  return loadJsonTuning({ enabled, gameRoot, filePath, label: "raw visual color tuning", validate: (value) => value?.params && typeof value.params === "object" });
}

export function loadRawRolePaletteTuning({ enabled, gameRoot, filePath }) {
  return loadJsonTuning({ enabled, gameRoot, filePath, label: "raw role palette tuning", validate: (value) => value?.roles && typeof value.roles === "object" });
}

export function loadRawMaterialPipeline({ enabled, gameRoot, filePath }) {
  const pipeline = loadJsonTuning({
    enabled,
    gameRoot,
    filePath,
    label: "raw material pipeline",
    validate: (value) => Array.isArray(value?.materials),
  });
  if (!pipeline) return null;
  const materialsById = new Map();
  const materialsByName = new Map();
  for (const material of pipeline.materials) {
    if (!material?.materialId) continue;
    materialsById.set(material.materialId, material);
    const nameKey = `${material.category ?? "unknown"}:${String(material.name ?? "").trim().toLowerCase()}`;
    if (!materialsByName.has(nameKey)) materialsByName.set(nameKey, material);
  }
  return {
    ...pipeline,
    materialsById,
    materialsByName,
  };
}

export function applyRawLightingAlgorithmTuning(profiles, tuning) {
  if (!tuning?.rooms) return profiles;
  return profiles.map((profile) => {
    const roomTuning = tuning.rooms[profile.roomId];
    if (!roomTuning) return profile;
    return {
      ...profile,
      formula: `${profile.formula}+${tuning.algorithm ?? "cpp-objective"}`,
      optimizerTuning: {
        schemaVersion: tuning.schemaVersion ?? null,
        algorithm: tuning.algorithm ?? null,
      },
      artist: {
        ...profile.artist,
        ...numericFields(roomTuning.artist),
      },
      bounce: {
        ...profile.bounce,
        ...numericFields(roomTuning.bounce),
      },
      algorithm: {
        ...profile.algorithm,
        ...numericFields(roomTuning.algorithm),
      },
    };
  });
}

export function summarizeRawLightingAlgorithmTuning(tuning, { gameRoot, fallbackPath }) {
  if (!tuning) return null;
  return {
    schemaVersion: tuning.schemaVersion ?? null,
    algorithm: tuning.algorithm ?? null,
    source: tuning.source ?? null,
    file: path.relative(gameRoot, tuning.filePath ?? fallbackPath),
    roomCount: Object.keys(tuning.rooms ?? {}).length,
    global: tuning.global ?? null,
  };
}

export function summarizeRawVisualColorTuning(tuning, { gameRoot, fallbackPath }) {
  if (!tuning) return null;
  return {
    schemaVersion: tuning.schemaVersion ?? null,
    algorithm: tuning.algorithm ?? null,
    source: tuning.source ?? null,
    file: path.relative(gameRoot, tuning.filePath ?? fallbackPath),
    candidatesEvaluated: tuning.candidatesEvaluated ?? null,
    score: tuning.score ?? null,
    currentScore: tuning.currentScore ?? null,
    improvement: tuning.improvement ?? null,
    inputMetrics: tuning.inputMetrics ?? null,
    params: numericFields(tuning.params),
  };
}

export function summarizeRawRolePaletteTuning(tuning, { gameRoot, fallbackPath }) {
  if (!tuning) return null;
  return {
    schemaVersion: tuning.schemaVersion ?? null,
    algorithm: tuning.algorithm ?? null,
    source: tuning.source ?? null,
    file: path.relative(gameRoot, tuning.filePath ?? fallbackPath),
    candidatesEvaluated: tuning.candidatesEvaluated ?? null,
    score: tuning.score ?? null,
    currentScore: tuning.currentScore ?? null,
    improvement: tuning.improvement ?? null,
    roleCount: Object.keys(tuning.roles ?? {}).length,
    roles: Object.fromEntries(
      Object.entries(tuning.roles ?? {}).map(([role, value]) => [
        role,
        {
          targetColor: Array.isArray(value?.targetColor) ? value.targetColor.slice(0, 3).map(roundNumber) : null,
          mix: roundNumber(Number(value?.mix) || 0),
        },
      ]),
    ),
  };
}

export function summarizeRawMaterialPipeline(pipeline, { gameRoot, fallbackPath }) {
  if (!pipeline) return null;
  return {
    schemaVersion: pipeline.schemaVersion ?? null,
    generatedBy: pipeline.generatedBy ?? null,
    file: path.relative(gameRoot, pipeline.filePath ?? fallbackPath),
    textureSize: pipeline.textureSize ?? null,
    publicBase: pipeline.publicBase ?? null,
    summary: pipeline.summary ?? null,
  };
}

function loadJsonTuning({ enabled, gameRoot, filePath, label, validate }) {
  if (!enabled) return null;
  if (!fsSync.existsSync(filePath)) return null;
  try {
    const value = JSON.parse(fsSync.readFileSync(filePath, "utf8"));
    if (!value || typeof value !== "object" || !validate(value)) {
      throw new Error("unexpected schema");
    }
    return {
      ...value,
      filePath,
    };
  } catch (error) {
    throw new Error(`Invalid ${label} ${path.relative(gameRoot, filePath)}: ${error.message}`);
  }
}

function numericFields(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => typeof fieldValue === "number" && Number.isFinite(fieldValue)));
}
