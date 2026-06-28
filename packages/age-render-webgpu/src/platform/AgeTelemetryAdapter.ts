export type AgeTelemetryLevel = "debug" | "info" | "warn" | "error";

export interface AgeTelemetryEvent {
  name: string;
  level?: AgeTelemetryLevel;
  data?: Record<string, unknown>;
}

export interface AgeTelemetryAdapter {
  emit(event: AgeTelemetryEvent): void;
}

export const ageNoopTelemetryAdapter: AgeTelemetryAdapter = {
  emit() {
    // Intentionally empty for embedders that do not want renderer telemetry.
  },
};
