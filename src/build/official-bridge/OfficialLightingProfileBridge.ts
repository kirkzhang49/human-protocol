import level03MuseumLightingTuning from "../../assets/manifests/generated/raw-webgpu/raw_lighting_algorithm_tuning_level_03_human_museum.json";
import type { RawRoomLightingProfile } from "../../render/raw-webgpu/RawWebGpuTypes";

interface OfficialLightingRoomTuning {
  artist?: Partial<NonNullable<RawRoomLightingProfile["artist"]>>;
  bounce?: Partial<NonNullable<RawRoomLightingProfile["bounce"]>>;
  algorithm?: Partial<NonNullable<RawRoomLightingProfile["algorithm"]>>;
}

interface OfficialLightingTuning {
  rooms?: Record<string, OfficialLightingRoomTuning>;
}

const officialLightingTuningByLevelId: Record<string, OfficialLightingTuning> = {
  level_03_human_museum: level03MuseumLightingTuning as OfficialLightingTuning,
};

export function hasOfficialLightingTuning(sourceLevelId: string | null | undefined): boolean {
  return Boolean(sourceLevelId && officialLightingTuningByLevelId[sourceLevelId]?.rooms);
}

export function applyOfficialLightingTuning(
  sourceLevelId: string | null | undefined,
  profiles: RawRoomLightingProfile[],
): RawRoomLightingProfile[] {
  const tuning = sourceLevelId ? officialLightingTuningByLevelId[sourceLevelId] : null;
  if (!tuning?.rooms) return profiles;

  let applied = false;
  const tuned = profiles.map((profile) => {
    const roomTuning = tuning.rooms?.[profile.roomId];
    if (!roomTuning) return profile;
    applied = true;
    return {
      ...profile,
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

  return applied ? tuned : profiles;
}

function numericFields<T extends Record<string, number | undefined>>(value: unknown): Partial<T> {
  if (!value || typeof value !== "object") return {};
  const fields: Partial<Record<keyof T, number>> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      fields[key as keyof T] = raw;
    }
  }
  return fields as Partial<T>;
}
