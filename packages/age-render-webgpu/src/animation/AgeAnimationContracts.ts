import type { AgeId, AgeMat4 } from "../core/AgeTypes";

export interface AgeAnimationClipDescriptor {
  id: AgeId;
  name: string;
  action?: string;
  durationSeconds: number;
  loopDefault?: boolean;
}

export interface AgeAnimationPose {
  clipId: AgeId;
  timeSeconds: number;
  worldMatrices: readonly AgeMat4[];
}

export interface AgeAnimationSampler {
  hasModel(modelKey: string): boolean;
  listClips(modelKey: string): readonly AgeAnimationClipDescriptor[];
  sample(modelKey: string, action: string, timeSeconds: number, loop: boolean): AgeAnimationPose | null;
}

export interface AgeRigidNodePalette {
  modelKey: string;
  jointCount: number;
  paletteOffset: number;
  matrices: readonly AgeMat4[];
}
