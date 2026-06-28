import { validateLevelConfig } from "../../ConfigValidator";
import type { LevelDefinition } from "../../schema/levelConfig";
import level04RuntimeJson from "./level.runtime.json";

export const level04MemoryClinic = level04RuntimeJson as unknown as LevelDefinition;

export const level04MemoryClinicValidationReport = validateLevelConfig(level04MemoryClinic);
