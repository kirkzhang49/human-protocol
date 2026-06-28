import { MAX_FRAME_DELTA } from "./constants";
import { clamp } from "./math";

export class Time {
  elapsed = 0;
  delta = 0;
  frame = 0;

  step(rawDelta: number) {
    this.delta = clamp(rawDelta, 0, MAX_FRAME_DELTA);
    this.elapsed += this.delta;
    this.frame += 1;
    return this.delta;
  }
}
