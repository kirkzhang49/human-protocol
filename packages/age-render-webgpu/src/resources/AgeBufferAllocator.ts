export interface AgeBufferAllocation {
  id: string;
  byteOffset: number;
  byteLength: number;
  usage: string;
}

export class AgeBufferAllocator {
  private cursor = 0;
  private readonly allocations = new Map<string, AgeBufferAllocation>();

  allocate(id: string, byteLength: number, usage: string, alignment = 256) {
    if (this.allocations.has(id)) {
      throw new Error(`AgeBufferAllocator already has allocation "${id}".`);
    }
    const alignedOffset = Math.ceil(this.cursor / alignment) * alignment;
    const allocation: AgeBufferAllocation = {
      id,
      byteOffset: alignedOffset,
      byteLength: Math.max(0, byteLength),
      usage,
    };
    this.allocations.set(id, allocation);
    this.cursor = alignedOffset + allocation.byteLength;
    return allocation;
  }

  get(id: string) {
    return this.allocations.get(id) ?? null;
  }

  reset() {
    this.cursor = 0;
    this.allocations.clear();
  }

  get byteLength() {
    return this.cursor;
  }
}
