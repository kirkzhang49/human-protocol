import { AgeDisposableStack } from "./AgeDisposables";
import type { AgeGpuDeviceBundle } from "./AgeGpuDevice";
import type { AgeRenderBackend } from "./AgeRenderBackend";
import type { AgeFrameTiming, AgeRendererCapabilities, AgeViewport } from "./AgeTypes";
import type { AgeRenderGraph } from "../graph/AgeRenderGraph";
import type { AgeAssetRegistry } from "../resources/AgeAssetRegistry";
import type { AgePlatformAdapter } from "../platform/AgePlatformAdapter";
import type { AgeTelemetryAdapter } from "../platform/AgeTelemetryAdapter";

export interface AgeRendererContext {
  readonly backend: AgeRenderBackend;
  readonly capabilities: AgeRendererCapabilities;
  readonly platform: AgePlatformAdapter;
  readonly telemetry?: AgeTelemetryAdapter;
  readonly assets: AgeAssetRegistry;
  readonly graph: AgeRenderGraph;
  readonly gpu?: AgeGpuDeviceBundle;
  readonly disposables: AgeDisposableStack;
  viewport: AgeViewport;
  timing: AgeFrameTiming;
}

export function createAgeRendererContext(options: {
  backend: AgeRenderBackend;
  capabilities: AgeRendererCapabilities;
  platform: AgePlatformAdapter;
  assets: AgeAssetRegistry;
  graph: AgeRenderGraph;
  viewport: AgeViewport;
  gpu?: AgeGpuDeviceBundle;
  telemetry?: AgeTelemetryAdapter;
}): AgeRendererContext {
  return {
    backend: options.backend,
    capabilities: options.capabilities,
    platform: options.platform,
    telemetry: options.telemetry,
    assets: options.assets,
    graph: options.graph,
    gpu: options.gpu,
    disposables: new AgeDisposableStack(),
    viewport: options.viewport,
    timing: {
      frameIndex: 0,
      deltaSeconds: 0,
      elapsedSeconds: 0,
    },
  };
}
