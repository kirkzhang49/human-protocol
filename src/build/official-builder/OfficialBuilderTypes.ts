import type { ConfigValidationReport } from "../../game/config/ConfigValidator";
import type { LevelDefinition } from "../../game/config/schema/levelConfig";
import type { BuilderCompileIssue } from "../compileBuilderProjectToLevel";
import type { OfficialBridgeAuditReport } from "../official-bridge/OfficialBridgeAudit";
import type { BuilderProject } from "../BuilderTypes";

export type OfficialBuilderSchemaVersion = "hp.official.builder.v1";

export interface OfficialBuilderCampaignMeta {
  levelId: string;
  title: string;
  ordinal: number;
  packId: string;
  nextLevelId?: string | null;
}

export interface OfficialBuilderContractMeta {
  profileId: string;
  globalRules?: readonly string[];
  roleRules?: readonly string[];
  levelOverrides?: readonly string[];
}

export interface OfficialBuilderDocument {
  schemaVersion: OfficialBuilderSchemaVersion;
  documentId: string;
  title: string;
  campaign: OfficialBuilderCampaignMeta;
  project: BuilderProject;
  contract: OfficialBuilderContractMeta;
  advanced?: {
    notes?: readonly string[];
    runtimeLevel?: LevelDefinition;
    runtimeHints?: Record<string, unknown>;
    rawWebGpu?: Record<string, unknown>;
  };
}

export interface OfficialBuilderCompileReport {
  ok: boolean;
  document: {
    id: string;
    title: string;
    levelId: string;
    schemaVersion: OfficialBuilderSchemaVersion;
  };
  level: LevelDefinition | null;
  compileIssues: BuilderCompileIssue[];
  validationReport: ConfigValidationReport | null;
  bridgeAudit: OfficialBridgeAuditReport | null;
  summary: {
    rooms: number;
    doors: number;
    props: number;
    pickups: number;
    robots: number;
    puzzles: number;
    routeSwitches: number;
    validationErrors: number;
    bridgeErrors: number;
  };
}
