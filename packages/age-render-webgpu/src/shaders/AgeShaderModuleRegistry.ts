export interface AgeShaderModuleDescriptor {
  id: string;
  language: "wgsl";
  code: string;
  entryPoints?: readonly string[];
  defines?: Readonly<Record<string, string | number | boolean>>;
}

export class AgeShaderModuleRegistry {
  private readonly modules = new Map<string, AgeShaderModuleDescriptor>();

  register(module: AgeShaderModuleDescriptor) {
    if (this.modules.has(module.id)) {
      throw new Error(`AgeShaderModuleRegistry already has shader "${module.id}".`);
    }
    this.modules.set(module.id, module);
    return module;
  }

  get(id: string) {
    return this.modules.get(id) ?? null;
  }

  list() {
    return [...this.modules.values()];
  }
}
