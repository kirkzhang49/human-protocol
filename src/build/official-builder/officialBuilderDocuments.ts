import { humanProtocolBasePack } from "../../game/config/ConfigPackStore";
import level01OfficialBuilderDocumentJson from "../../game/config/levels/level01-maintenance-bay/level.official.builder.json";
import level02OfficialBuilderDocumentJson from "../../game/config/levels/level02-residential-simulation/level.official.builder.json";
import level03OfficialBuilderDocumentJson from "../../game/config/levels/level03-human-museum/level.official.builder.json";
import level04OfficialBuilderDocumentJson from "../../game/config/levels/level04-memory-clinic/level.official.builder.json";
import level05OfficialBuilderDocumentJson from "../../game/config/levels/level05-reclamation-core/level.official.builder.json";
import type { LevelDefinition } from "../../game/config/schema/levelConfig";
import { builderProjectFromBuiltInLevel, normalizeOfficialBuilderProject } from "../BuilderLevelImport";
import type { BuilderProject } from "../BuilderTypes";
import type { OfficialBuilderDocument } from "./OfficialBuilderTypes";

const formalOfficialLevelCount = 5;
const canonicalDocumentsByLevelId: Partial<Record<string, OfficialBuilderDocument>> = {
  level_01_maintenance_bay: level01OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  level_02_residential_simulation: level02OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  level_03_human_museum: level03OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  level_04_memory_clinic: level04OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  level_05_reclamation_core: level05OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
};

export interface OfficialBuilderDocumentOptions {
  preferCanonical?: boolean;
}

export function listOfficialBuilderLevelOptions() {
  return humanProtocolBasePack.campaignLevelIds.slice(0, formalOfficialLevelCount).map((levelId, index) => {
    const level = humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId);
    return {
      levelId,
      ordinal: index + 1,
      title: level?.title ?? levelId,
    };
  });
}

export function officialBuilderDocumentFromBuiltInLevel(levelId: string, options: OfficialBuilderDocumentOptions = {}): OfficialBuilderDocument | null {
  if (options.preferCanonical !== false) {
    const canonical = canonicalDocumentsByLevelId[levelId];
    if (canonical) return canonical;
  }
  const level = humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId);
  if (!level) return null;
  const ordinal = humanProtocolBasePack.campaignLevelIds.indexOf(level.id) + 1;
  const project = builderProjectFromBuiltInLevel(level.id);
  if (!project) return null;
  return {
    schemaVersion: "hp.official.builder.v1",
    documentId: `official_builder_${level.id}`,
    title: `${level.title} · Official Builder Source`,
    campaign: {
      levelId: level.id,
      title: level.title,
      ordinal,
      packId: humanProtocolBasePack.packId,
      nextLevelId: humanProtocolBasePack.campaignLevelIds[ordinal] ?? null,
    },
    project,
    contract: {
      profileId: profileIdForLevel(level),
      globalRules: ["no_proxy_geometry", "no_fallback_materials", "source_role_traceability"],
      roleRules: ["roomSurface", "door", "keyItem", "interaction", "puzzleStation", "enemy", "exitFixture"],
      levelOverrides: level.id === "level_03_human_museum" ? ["builder_surfaces_preserve_official_doors", "deny_legacy_exit_overlay"] : [],
    },
    advanced: {
      notes: [
        "Dev-only seed document generated from the current built-in LevelDefinition.",
        "This is not canonical source until the level has passed round-trip parity checks.",
      ],
    },
  };
}

export function officialBuilderDocumentFromProject(levelId: string, project: BuilderProject): OfficialBuilderDocument | null {
  const base = officialBuilderDocumentFromBuiltInLevel(levelId);
  if (!base) return null;
  const sourceProject = base.project;
  const proposedProject = normalizeOfficialBuilderProject({
    ...project,
    projectId: `official_${levelId}_proposal`,
    title: project.title.trim() || `${base.campaign.title} · Proposed Official Source`,
    sourceLevel: {
      ...sourceProject.sourceLevel,
      ...project.sourceLevel,
      levelId,
    },
  });
  return {
    ...base,
    documentId: `official_builder_${levelId}_proposal`,
    title: `${base.campaign.title} · Proposed Official Builder Source`,
    project: proposedProject,
    advanced: {
      ...base.advanced,
      notes: [
        "Proposed document built from the current /build localStorage draft.",
        "Export this JSON or run a dev write step before it becomes repository source.",
      ],
    },
  };
}

function profileIdForLevel(level: LevelDefinition) {
  if (level.id.includes("human_museum")) return "human_museum";
  if (level.id.includes("residential")) return "residential_simulation";
  if (level.id.includes("memory_clinic")) return "memory_clinic";
  if (level.id.includes("reclamation")) return "reclamation_core";
  return "maintenance_bay";
}
