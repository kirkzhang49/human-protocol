export type AgeGraphResourceKind =
  | "external"
  | "frame-data"
  | "color-target"
  | "depth-target"
  | "storage-buffer"
  | "uniform-buffer"
  | "texture"
  | "texture-array"
  | "sampler"
  | "pipeline"
  | "bind-group"
  | "custom";

export interface AgeGraphResource {
  id: string;
  kind: AgeGraphResourceKind;
  external?: boolean;
  transient?: boolean;
  description?: string;
}

export type AgeGraphResourceRef = string | AgeGraphResource;

export function ageGraphResourceId(resource: AgeGraphResourceRef) {
  return typeof resource === "string" ? resource : resource.id;
}

export function ageExternalResource(id: string, kind: AgeGraphResourceKind = "external"): AgeGraphResource {
  return { id, kind, external: true };
}

export function ageTransientResource(id: string, kind: AgeGraphResourceKind): AgeGraphResource {
  return { id, kind, transient: true };
}

export const AGE_GRAPH_EXTERNAL_RESOURCES: readonly AgeGraphResource[] = [
  ageExternalResource("assets"),
  ageExternalResource("geometry", "storage-buffer"),
  ageExternalResource("materials", "storage-buffer"),
  ageExternalResource("textures", "texture-array"),
  ageExternalResource("lighting", "frame-data"),
  ageExternalResource("drawBatches", "frame-data"),
  ageExternalResource("projectiles", "frame-data"),
  ageExternalResource("particleEmitters", "frame-data"),
  ageExternalResource("canvas", "color-target"),
  ageExternalResource("depth", "depth-target"),
];
