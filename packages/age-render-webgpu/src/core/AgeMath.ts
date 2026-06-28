import type { AgeTuple3, AgeTuple4 } from "./AgeTypes";

export function ageClamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ageClampTuple3(value: AgeTuple3, min = 0, max = 1): AgeTuple3 {
  return [
    ageClamp(value[0], min, max),
    ageClamp(value[1], min, max),
    ageClamp(value[2], min, max),
  ];
}

export function ageClampTuple4(value: AgeTuple4, min = 0, max = 1): AgeTuple4 {
  return [
    ageClamp(value[0], min, max),
    ageClamp(value[1], min, max),
    ageClamp(value[2], min, max),
    ageClamp(value[3], min, max),
  ];
}

export function ageMix(a: number, b: number, amount: number) {
  return a + (b - a) * ageClamp(amount, 0, 1);
}

export function ageMixTuple3(a: AgeTuple3, b: AgeTuple3, amount: number): AgeTuple3 {
  const t = ageClamp(amount, 0, 1);
  return [ageMix(a[0], b[0], t), ageMix(a[1], b[1], t), ageMix(a[2], b[2], t)];
}

export function ageSrgbByteToLinear(value: number) {
  const x = ageClamp(value / 255, 0, 1);
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
