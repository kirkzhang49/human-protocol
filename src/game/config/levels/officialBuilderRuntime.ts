import { compileOfficialBuilderDocument } from "../../../build/official-builder/compileOfficialBuilderProjectToLevel";
import type { OfficialBuilderDocument } from "../../../build/official-builder/OfficialBuilderTypes";
import type { LevelDefinition } from "../schema/levelConfig";

export function requireOfficialBuilderLevel(document: OfficialBuilderDocument, label: string): LevelDefinition {
  const report = compileOfficialBuilderDocument(document);
  if (report.ok && report.level) return report.level;
  const issues = [
    ...report.compileIssues.map((issue) => `${issue.path}: ${issue.message}`),
    ...(report.validationReport?.errors ?? []).map((issue) => `${issue.path ?? issue.code}: ${issue.message}`),
    ...(report.bridgeAudit?.errors ?? []).map((issue) => `${issue.path ?? issue.code}: ${issue.message}`),
  ]
    .slice(0, 5)
    .join("; ");
  throw new Error(`${label} official builder source failed to compile${issues ? `: ${issues}` : "."}`);
}
