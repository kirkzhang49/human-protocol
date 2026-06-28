import type { AgeRenderBackend } from "../core/AgeRenderBackend";
import type { AgePlatformAdapter } from "../platform/AgePlatformAdapter";

export class AgeBackendRegistry {
  private readonly backends = new Map<string, AgeRenderBackend>();

  register(backend: AgeRenderBackend) {
    if (this.backends.has(backend.id)) {
      throw new Error(`AgeBackendRegistry already contains backend "${backend.id}".`);
    }
    this.backends.set(backend.id, backend);
    return backend;
  }

  get(id: string) {
    return this.backends.get(id) ?? null;
  }

  list() {
    return [...this.backends.values()];
  }

  async firstAvailable(platform: AgePlatformAdapter) {
    for (const backend of this.backends.values()) {
      const availability = await backend.canRun(platform);
      if (availability.available) return { backend, availability };
    }
    return null;
  }
}
