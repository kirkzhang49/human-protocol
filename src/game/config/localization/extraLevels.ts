// Barrel of supplemental (patch) English for the original campaign levels 01-05.
import type { LevelEnglishCopy, TextDictionary } from "../LevelLocalization";
import { level01ExtraEnglish, level01ExtraText } from "./level01patch";
import { level02ExtraEnglish, level02ExtraText } from "./level02patch";
import { level03ExtraEnglish, level03ExtraText } from "./level03patch";
import { level04ExtraEnglish, level04ExtraText } from "./level04patch";
import { level05ExtraEnglish, level05ExtraText } from "./level05patch";

export const extraEnglishByLevel: Record<string, LevelEnglishCopy> = {
  level_01_maintenance_bay: level01ExtraEnglish,
  level_02_residential_simulation: level02ExtraEnglish,
  level_03_human_museum: level03ExtraEnglish,
  level_04_memory_clinic: level04ExtraEnglish,
  level_05_reclamation_core: level05ExtraEnglish,
};

export const extraEnglishTextByLevel: Record<string, TextDictionary> = {
  level_01_maintenance_bay: level01ExtraText,
  level_02_residential_simulation: level02ExtraText,
  level_03_human_museum: level03ExtraText,
  level_04_memory_clinic: level04ExtraText,
  level_05_reclamation_core: level05ExtraText,
};
