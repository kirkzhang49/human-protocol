export type ViewmodelPrototypeMode = "production" | "referenceRaw" | "scriptedDerived" | null;

export function resolveViewmodelPrototypeModeFromParams(params: URLSearchParams): ViewmodelPrototypeMode {
  const mode = params.get("viewmodelPrototype");
  if (mode === "scripted-derived") return "scriptedDerived";
  if (mode === "reference-raw") return "referenceRaw";
  if (mode === "production" || mode === "referenceRaw" || mode === "scriptedDerived") return mode;
  return "scriptedDerived";
}
