export interface ConfigValidationIssue {
  code: string;
  path: string;
  message: string;
}

export function addIssue(target: ConfigValidationIssue[], code: string, path: string, message: string) {
  target.push({ code, path, message });
}

export function validateUnitOptional(value: number | undefined, path: string, warnings: ConfigValidationIssue[]) {
  if (typeof value !== "number") return;
  if (Number.isFinite(value) && value >= 0 && value <= 1) return;
  addIssue(warnings, "number.unit.expected", path, "Optional art tuning value should be between 0 and 1.");
}

export function validatePositiveOptional(value: number | undefined, path: string, warnings: ConfigValidationIssue[]) {
  if (typeof value !== "number") return;
  if (Number.isFinite(value) && value > 0) return;
  addIssue(warnings, "number.positive.expected", path, "Optional multiplier should be a positive number; runtime will use tier defaults.");
}

export function validatePositiveDurationOptional(value: number | undefined, path: string, warnings: ConfigValidationIssue[]) {
  if (typeof value !== "number") return;
  if (Number.isFinite(value) && value > 0) return;
  addIssue(warnings, "duration.positive.expected", path, "Optional duration should be a positive number; runtime will keep the state persistent.");
}

export function validateColorOptional(value: string | undefined, path: string, warnings: ConfigValidationIssue[]) {
  if (!value) return;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return;
  addIssue(warnings, "color.hex.expected", path, `Color "${value}" should use #RRGGBB format.`);
}
