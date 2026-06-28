import type { Vector3 } from "three";

export interface AudioCueOptions {
  intensity?: number;
  position?: Vector3;
}

export interface AudioCueEvent {
  id: number;
  key: string;
  intensity: number;
  position: Vector3 | null;
}

export interface SynthCue {
  key: string;
  intensity: number;
  pan: number;
}
