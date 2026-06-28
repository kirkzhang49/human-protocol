export type AgeDiagnosticSeverity = "info" | "warning" | "error";

export interface AgeDiagnostic {
  code: string;
  severity: AgeDiagnosticSeverity;
  message: string;
  subject?: string;
  detail?: Record<string, unknown>;
}

export function ageError(code: string, message: string, subject?: string): AgeDiagnostic {
  return { code, severity: "error", message, subject };
}

export function ageWarning(code: string, message: string, subject?: string): AgeDiagnostic {
  return { code, severity: "warning", message, subject };
}

export function ageInfo(code: string, message: string, subject?: string): AgeDiagnostic {
  return { code, severity: "info", message, subject };
}

export function ageThrowOnErrors(diagnostics: readonly AgeDiagnostic[]) {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length <= 0) return;
  throw new Error(errors.map((diagnostic) => `[${diagnostic.code}] ${diagnostic.message}`).join("\n"));
}
