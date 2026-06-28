import type {
  AgeBackendAvailability,
  AgeRenderBackendKind,
  AgeRendererCapabilities,
  AgeViewport,
} from "./AgeTypes";
import type { AgeSceneFrame } from "./AgeSceneFrame";
import type { AgePlatformAdapter } from "../platform/AgePlatformAdapter";
import type { AgeAssetRegistry } from "../resources/AgeAssetRegistry";
import type { AgeFallbackPolicy } from "../graph/AgeFallbackPolicy";

export interface AgeRenderer {
  readonly backendId: string;
  readonly capabilities: AgeRendererCapabilities;
  resize(viewport: AgeViewport): void | Promise<void>;
  renderFrame(frame: AgeSceneFrame): void | Promise<void>;
  dispose(): void;
}

export interface AgeRendererCreateOptions {
  platform: AgePlatformAdapter;
  assets: AgeAssetRegistry;
  canvas?: unknown;
  viewport?: AgeViewport;
  fallbackPolicy?: AgeFallbackPolicy;
  label?: string;
}

export interface AgeRenderBackend {
  readonly id: string;
  readonly kind: AgeRenderBackendKind;
  canRun(platform: AgePlatformAdapter): Promise<AgeBackendAvailability>;
  createRenderer(options: AgeRendererCreateOptions): Promise<AgeRenderer>;
}
