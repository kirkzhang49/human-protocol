import type { GpuGlobals } from "./RawWebGpuTypes";

/**
 * Per-pass GPU timing for the raw renderer, gated behind `?rawGpuProfile=1`.
 *
 * WebGPU only surfaces GPU-side timing through timestamp queries written into a
 * pass descriptor (`timestampWrites`), and only when the device was created with
 * the optional `timestamp-query` feature (see RawWebGpuDevice). When the flag is
 * off OR the feature is unavailable the profiler is a strict no-op: every method
 * short-circuits and no query resources are allocated, so the default render path
 * is byte-identical to before.
 *
 * Lifecycle per frame:
 *   beginFrame()                         // reset the armed-slot mask
 *   beginRenderPass({ timestampWrites: timestampWrites("scene") })   // arm + time
 *   ...
 *   resolve(encoder)                     // before encoder.finish()
 *   queue.submit(...)
 *   collect()                            // after submit → async map + readback
 */
const PROFILE_SLOTS = ["compute", "scene", "viewmodel", "bloom"] as const;
export type RawGpuProfileSlot = (typeof PROFILE_SLOTS)[number];

const SLOT_INDEX = PROFILE_SLOTS.reduce<Record<string, number>>((map, slot, index) => {
  map[slot] = index;
  return map;
}, {});

// Two timestamps (begin/end) per slot; each timestamp is a u64 (8 bytes).
const TIMESTAMP_COUNT = PROFILE_SLOTS.length * 2;
const TIMESTAMP_BYTES = TIMESTAMP_COUNT * 8;
// A small pool so we never map a readback buffer the GPU is still writing.
const READBACK_POOL_SIZE = 3;

interface RawGpuTimestampWrites {
  querySet: any;
  beginningOfPassWriteIndex: number;
  endOfPassWriteIndex: number;
}

type ReadbackState = "free" | "filled" | "mapping";
interface ReadbackSlot {
  buffer: any;
  state: ReadbackState;
  armedMask: number;
}

export class RawGpuProfiler {
  enabled: boolean;
  private readonly device: any;
  private readonly gpuGlobals = globalThis as typeof globalThis & GpuGlobals;
  private querySet: any = null;
  private resolveBuffer: any = null;
  private readonly readbackPool: ReadbackSlot[] = [];
  private armedMask = 0;
  private hasSample = false;
  private readonly latestMs: Record<RawGpuProfileSlot, number> = {
    compute: 0,
    scene: 0,
    viewmodel: 0,
    bloom: 0,
  };

  constructor(device: any, enabledByFlag: boolean) {
    this.device = device;
    const supported = !!device?.features?.has?.("timestamp-query");
    if (enabledByFlag && !supported) {
      console.warn(
        "[HumanProtocol] rawGpuProfile requested but this device exposes no timestamp-query feature; GPU profiler disabled.",
      );
    }
    this.enabled = enabledByFlag && supported;
    if (!this.enabled) return;

    try {
      const usage = this.gpuGlobals.GPUBufferUsage;
      this.querySet = device.createQuerySet({
        label: "hp.raw.gpu-profiler.timestamps",
        type: "timestamp",
        count: TIMESTAMP_COUNT,
      });
      this.resolveBuffer = device.createBuffer({
        label: "hp.raw.gpu-profiler.resolve",
        size: TIMESTAMP_BYTES,
        usage: usage.QUERY_RESOLVE | usage.COPY_SRC,
      });
      for (let index = 0; index < READBACK_POOL_SIZE; index += 1) {
        this.readbackPool.push({
          buffer: device.createBuffer({
            label: `hp.raw.gpu-profiler.readback-${index}`,
            size: TIMESTAMP_BYTES,
            usage: usage.COPY_DST | usage.MAP_READ,
          }),
          state: "free",
          armedMask: 0,
        });
      }
    } catch (error) {
      console.warn("[HumanProtocol] GPU profiler setup failed; disabling.", error);
      this.enabled = false;
    }
  }

  beginFrame() {
    if (this.enabled) this.armedMask = 0;
  }

  /**
   * Arm a slot and return the pass-descriptor `timestampWrites` for it. Call this
   * ONLY at the point a pass is actually encoded, so an armed slot always has its
   * two timestamps written (otherwise resolve would read a stale/garbage range).
   */
  timestampWrites(slot: RawGpuProfileSlot): RawGpuTimestampWrites | undefined {
    if (!this.enabled) return undefined;
    const index = SLOT_INDEX[slot];
    this.armedMask |= 1 << index;
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: index * 2,
      endOfPassWriteIndex: index * 2 + 1,
    };
  }

  /** Resolve this frame's queries into a free readback buffer. Call before finish(). */
  resolve(encoder: any) {
    if (!this.enabled || this.armedMask === 0) return;
    const slot = this.readbackPool.find((candidate) => candidate.state === "free");
    if (!slot) return; // readback is lagging; drop this frame's sample rather than stall.
    encoder.resolveQuerySet(this.querySet, 0, TIMESTAMP_COUNT, this.resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, slot.buffer, 0, TIMESTAMP_BYTES);
    slot.state = "filled";
    slot.armedMask = this.armedMask;
  }

  /** Map any filled buffers and fold their deltas into the latest sample. Call after submit(). */
  collect() {
    if (!this.enabled) return;
    const mapRead = (globalThis as any).GPUMapMode?.READ ?? 0x0001;
    for (const slot of this.readbackPool) {
      if (slot.state !== "filled") continue;
      slot.state = "mapping";
      slot.buffer
        .mapAsync(mapRead)
        .then(() => {
          const copy = slot.buffer.getMappedRange().slice(0);
          slot.buffer.unmap();
          const values = new BigUint64Array(copy);
          for (const name of PROFILE_SLOTS) {
            const index = SLOT_INDEX[name];
            if (!(slot.armedMask & (1 << index))) continue;
            const begin = values[index * 2];
            const end = values[index * 2 + 1];
            if (end > begin) this.latestMs[name] = Number(end - begin) / 1_000_000;
          }
          this.hasSample = true;
          slot.state = "free";
        })
        .catch(() => {
          slot.state = "free";
        });
    }
  }

  /** One-line overlay summary, or null when the profiler is off / has no sample yet. */
  latestSummary(): string | null {
    if (!this.enabled || !this.hasSample) return null;
    const total = PROFILE_SLOTS.reduce((sum, slot) => sum + this.latestMs[slot], 0);
    const parts = PROFILE_SLOTS.map((slot) => `${slot} ${this.latestMs[slot].toFixed(2)}`).join("  ");
    return `GPU ~${total.toFixed(2)}ms   ${parts}`;
  }

  dispose() {
    this.querySet?.destroy?.();
    this.resolveBuffer?.destroy?.();
    for (const slot of this.readbackPool) slot.buffer?.destroy?.();
  }
}
