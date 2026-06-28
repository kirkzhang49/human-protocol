import type { AgePlatformAdapter } from "../AgePlatformAdapter";
import type { AgeStorageAdapter } from "../AgeStorageAdapter";
import { ageNoopTelemetryAdapter } from "../AgeTelemetryAdapter";

export function createBrowserAgePlatformAdapter(storage: AgeStorageAdapter): AgePlatformAdapter {
  return {
    id: "browser",
    storage,
    telemetry: ageNoopTelemetryAdapter,
    now: () => performance.now(),
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
    detectCapabilities() {
      const nav = navigator as Navigator & { gpu?: unknown };
      return {
        webGpuAvailable: Boolean(nav.gpu),
        webGpuUnavailableReason: nav.gpu ? undefined : "navigator.gpu is not available.",
        isMobile: window.matchMedia("(pointer: coarse), (max-width: 900px)").matches,
        supportsPersistentStorage: Boolean(navigator.storage?.persist),
        supportsFileSystemAccess: "showOpenFilePicker" in window,
      };
    },
  };
}
