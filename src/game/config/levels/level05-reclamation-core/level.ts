import type { OfficialBuilderDocument } from "../../../../build/official-builder/OfficialBuilderTypes";
import { validateLevelConfig } from "../../ConfigValidator";
import { requireOfficialBuilderLevel } from "../officialBuilderRuntime";
import level05OfficialBuilderDocumentJson from "./level.official.builder.json";

export const level05ReclamationCore = requireOfficialBuilderLevel(
  level05OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  "Level 5",
);

export const level05ReclamationCoreValidationReport = validateLevelConfig(level05ReclamationCore);
