import type { RawWebGpuDeviceBundle } from "./RawWebGpuTypes";

let rawWebGpuDeviceBundlePromise: Promise<RawWebGpuDeviceBundle> | null = null;

export async function requestRawWebGpuDeviceBundle() {
  if (!rawWebGpuDeviceBundlePromise) {
    rawWebGpuDeviceBundlePromise = createRawWebGpuDeviceBundle().catch((error: unknown) => {
      rawWebGpuDeviceBundlePromise = null;
      throw error;
    });
  }
  return rawWebGpuDeviceBundlePromise;
}

async function createRawWebGpuDeviceBundle(): Promise<RawWebGpuDeviceBundle> {
  const navigatorWithGpu = navigator as Navigator & {
    gpu?: {
      requestAdapter: (options?: Record<string, unknown>) => Promise<any>;
      getPreferredCanvasFormat: () => string;
    };
  };
  const gpu = navigatorWithGpu.gpu;
  if (!gpu) {
    throw new Error("WebGPU is not available in this browser.");
  }

  const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) {
    throw new Error("WebGPU adapter was not granted.");
  }
  // Negotiate optional features the engine can exploit when present. Only ones
  // the adapter advertises are requested, so this never makes requestDevice()
  // reject on hardware that lacks them. `timestamp-query` unlocks the per-pass
  // GPU profiler (?rawGpuProfile=1); absent it, the profiler stays a no-op.
  const requiredFeatures = ["timestamp-query"].filter((feature) => adapter.features?.has?.(feature));
  const deviceDescriptor: any = requiredFeatures.length ? { requiredFeatures } : undefined;
  const device = await adapter.requestDevice(deviceDescriptor);
  device.addEventListener?.("uncapturederror", (event: { error?: { message?: string } }) => {
    console.warn("[HumanProtocol] Raw WebGPU validation error.", event.error?.message ?? event.error);
  });
  device.lost?.then?.((info: { reason?: string; message?: string }) => {
    console.warn("[HumanProtocol] Raw WebGPU device lost.", info.reason, info.message);
    // Invalidate the shared cache so the next requestRawWebGpuDeviceBundle()
    // (e.g. when a new level constructs a fresh RawWebGpuLevelRenderer)
    // re-requests a live adapter/device instead of handing back this dead one.
    // Recovery previously depended solely on a per-frame render() throw, which
    // never fires on the next level's construction path.
    rawWebGpuDeviceBundlePromise = null;
  });
  return {
    device,
    format: gpu.getPreferredCanvasFormat(),
  };
}
