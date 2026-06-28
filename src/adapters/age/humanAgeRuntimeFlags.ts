/**
 * Opt-in URL flags for the experimental AGE rendering paths. All flags
 * default to off; the default URL must behave exactly like the pre-AGE build.
 *
 *   ?ageBridge=1         periodic GameWorld -> AgeSceneFrame conversion with
 *                        validation, parity stats, overlay, and perf events
 *   ?ageVisualProfile=1  raw renderer consumes the AGE escape-room visual
 *                        profile (room tone, light budgets, bloom/fog intent,
 *                        contact strength, emissive role boost)
 *   ?ageGrounding=1      AGE grounding pass plans + encodes dynamic contact
 *                        shadows (raw pass kept as automatic fallback)
 *   ?ageGrounding=parity AGE grounding pass plans quads but raw pass keeps
 *                        drawing; counts are compared in bridge stats
 */
export type HumanAgeGroundingMode = "off" | "on" | "parity";

export function ageBridgeEnabled() {
  return readFlag("ageBridge") === "1";
}

export function ageVisualProfileEnabled() {
  return readFlag("ageVisualProfile") === "1";
}

export function ageGroundingMode(): HumanAgeGroundingMode {
  const value = readFlag("ageGrounding");
  if (value === "1" || value === "on") return "on";
  if (value === "parity") return "parity";
  return "off";
}

function readFlag(name: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}
