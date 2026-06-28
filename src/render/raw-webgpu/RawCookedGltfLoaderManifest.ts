export interface RawCookedGltfLoaderManifest {
  schemaVersion: "hp.raw-webgpu.cooked-gltf-loader-manifest.v1";
  generatedAt?: string;
  levelId: string;
  generator?: {
    script?: string;
    parser?: string;
    meshoptDecoder?: string;
    outputPolicy?: string;
  };
  summary?: {
    modelCount?: number;
    meshCount?: number;
    materialCount?: number;
    textureCount?: number;
    animationClipCount?: number;
    transparentMaterialCount?: number;
    emissiveMaterialCount?: number;
    preservationGaps?: Array<{ kind: string; count: number; examples: string[] }>;
  };
  models?: RawCookedGltfModelSummary[];
}

export interface RawCookedGltfModelSummary {
  key: string;
  role?: string | null;
  roles?: string[];
  usage?: string[];
  file?: string | null;
  bounds?: {
    min?: number[];
    max?: number[];
    center?: number[];
    size?: number[];
  } | null;
  rawPlan?: {
    status?: string | null;
    vertexCount?: number;
    triangleCount?: number;
    nodeChunkCount?: number;
    animationClipCount?: number;
  } | null;
  gltf?: {
    nodeCount?: number;
    meshCount?: number;
    primitiveCount?: number;
    materialCount?: number;
    textureCount?: number;
    imageCount?: number;
    animationCount?: number;
    skinCount?: number;
    extensionsUsed?: string[];
    extensionsRequired?: string[];
  };
  materials?: RawCookedGltfMaterialSummary[];
  animations?: Array<{
    name?: string | null;
    durationSeconds?: number;
    trackCount?: number;
    targetPaths?: string[];
  }>;
  preservation?: {
    score?: number;
    gaps?: Array<{ kind: string }>;
  };
}

export interface RawCookedGltfMaterialSummary {
  name?: string | null;
  type?: string | null;
  transparent?: boolean;
  opacity?: number;
  color?: number[] | null;
  emissive?: boolean;
  emissiveColor?: number[] | null;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  textureSlots?: string[];
}
