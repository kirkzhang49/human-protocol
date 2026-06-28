export interface AgePipelineDescriptor {
  id: string;
  passId: string;
  shaderId: string;
  targetFormat?: string;
  depthFormat?: string;
  variant?: string;
  metadata?: Record<string, unknown>;
}

export class AgePipelineRegistry {
  private readonly pipelines = new Map<string, AgePipelineDescriptor>();

  register(pipeline: AgePipelineDescriptor) {
    if (this.pipelines.has(pipeline.id)) {
      throw new Error(`AgePipelineRegistry already has pipeline "${pipeline.id}".`);
    }
    this.pipelines.set(pipeline.id, pipeline);
    return pipeline;
  }

  get(id: string) {
    return this.pipelines.get(id) ?? null;
  }

  listForPass(passId: string) {
    return [...this.pipelines.values()].filter((pipeline) => pipeline.passId === passId);
  }
}
