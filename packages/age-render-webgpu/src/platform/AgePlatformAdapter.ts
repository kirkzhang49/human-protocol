import type { AgeGpuDeviceBundle, AgeGpuDeviceRequest } from "../core/AgeGpuDevice";
import type { AgeStorageAdapter } from "./AgeStorageAdapter";
import type { AgeTelemetryAdapter } from "./AgeTelemetryAdapter";

export interface AgePlatformCapabilities {
  webGpuAvailable: boolean;
  webGpuUnavailableReason?: string;
  isMobile?: boolean;
  isSteamLikeDesktop?: boolean;
  supportsPersistentStorage?: boolean;
  supportsFileSystemAccess?: boolean;
}

export interface AgePlatformAdapter {
  readonly id: string;
  readonly storage: AgeStorageAdapter;
  readonly telemetry?: AgeTelemetryAdapter;
  now(): number;
  requestAnimationFrame?(callback: (time: number) => void): number;
  cancelAnimationFrame?(handle: number): void;
  detectCapabilities?(): Promise<AgePlatformCapabilities> | AgePlatformCapabilities;
  requestWebGpuDevice?(request: AgeGpuDeviceRequest): Promise<AgeGpuDeviceBundle>;
}
