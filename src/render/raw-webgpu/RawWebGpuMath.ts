import type { Tuple3 } from "./RawWebGpuTypes";

export function colorFromHex(value: string | null | undefined, fallback: Tuple3): Tuple3 {
  if (!value) return fallback;
  const normalized = value.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((channel) => `${channel}${channel}`)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return fallback;
  const intValue = Number.parseInt(expanded, 16);
  return [
    ((intValue >> 16) & 255) / 255,
    ((intValue >> 8) & 255) / 255,
    (intValue & 255) / 255,
  ];
}

export function normalizeTuple(value: Tuple3, fallback: Tuple3): Tuple3 {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= 0.0001) return fallback;
  return [value[0] / length, value[1] / length, value[2] / length];
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
