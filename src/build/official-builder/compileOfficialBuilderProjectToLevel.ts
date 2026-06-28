import { validateLevelConfig } from "../../game/config/ConfigValidator";
import type { LevelDefinition } from "../../game/config/schema/levelConfig";
import { compileBuilderProjectToLevel } from "../compileBuilderProjectToLevel";
import { auditBuilderOfficialBridge } from "../official-bridge/OfficialBridgeAudit";
import type { OfficialBuilderCompileReport, OfficialBuilderDocument } from "./OfficialBuilderTypes";

export function compileOfficialBuilderDocument(document: OfficialBuilderDocument): OfficialBuilderCompileReport {
  const compileResult = compileBuilderProjectToLevel(document.project);
  const compiledLevel = compileResult.level ? canonicalizeOfficialLevel(compileResult.level, document) : null;
  const runtimeLevel = document.advanced?.runtimeLevel ? canonicalizeOfficialLevel(document.advanced.runtimeLevel, document) : null;
  const level = runtimeLevel ?? compiledLevel;
  const validationReport = level ? validateLevelConfig(level, { authoringProfile: "generated" }) : null;
  const bridgeAudit = compiledLevel ? auditBuilderOfficialBridge(compiledLevel, document.project) : null;
  const validationErrors = validationReport?.errors.length ?? 0;
  const bridgeErrors = bridgeAudit?.errors.length ?? 0;

  return {
    ok: Boolean(level) && compileResult.issues.length === 0 && validationErrors === 0 && bridgeErrors === 0,
    document: {
      id: document.documentId,
      title: document.title,
      levelId: document.campaign.levelId,
      schemaVersion: document.schemaVersion,
    },
    level,
    compileIssues: compileResult.issues,
    validationReport,
    bridgeAudit,
    summary: {
      rooms: document.project.rooms.length,
      doors: document.project.doors.length,
      props: document.project.props.length,
      pickups: document.project.pickups?.length ?? 0,
      robots: document.project.robots.length,
      puzzles: document.project.puzzles?.length ?? 0,
      routeSwitches: document.project.routeSwitches?.length ?? 0,
      validationErrors,
      bridgeErrors,
    },
  };
}

function canonicalizeOfficialLevel(level: LevelDefinition, document: OfficialBuilderDocument): LevelDefinition {
  return {
    ...level,
    id: document.campaign.levelId,
    title: document.campaign.title,
    authoringProfile: "internal",
  };
}
