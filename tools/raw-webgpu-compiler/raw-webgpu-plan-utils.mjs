import { execSync } from "node:child_process";

export function toScaleVector(scale) {
  if (Array.isArray(scale)) return [scale[0], scale[1], scale[2]];
  return [scale, scale, scale];
}

export function roundTuple(tuple) {
  return tuple.map((value) => roundNumber(value));
}

export function roundNumber(value) {
  return Math.round(Number(value) * 1000000) / 1000000;
}

export function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function slugify(value) {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "material"
  );
}

export function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function hexToRgb(value) {
  const fallback = [0.7, 0.9, 1];
  if (!value) return fallback;
  const normalized = String(value).trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  const intValue = Number.parseInt(normalized, 16);
  return [((intValue >> 16) & 255) / 255, ((intValue >> 8) & 255) / 255, (intValue & 255) / 255];
}

export function readArg(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

export function hasArg(name) {
  return process.argv.includes(name);
}

export function git(command, cwd) {
  try {
    return execSync(`git ${command}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
