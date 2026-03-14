export const TELEMETRY_ERROR_KIND = {
  SOURCE: "source",
  VALIDATION: "validation",
} as const;

type TelemetryErrorKind = (typeof TELEMETRY_ERROR_KIND)[keyof typeof TELEMETRY_ERROR_KIND];

export class TelemetryError extends Error {
  kind: TelemetryErrorKind;
  retriable: boolean;

  constructor(message: string, kind: TelemetryErrorKind, retriable: boolean) {
    super(message);
    this.name = "TelemetryError";
    this.kind = kind;
    this.retriable = retriable;
  }
}

export class TelemetryValidationError extends TelemetryError {
  constructor(message: string) {
    super(message, TELEMETRY_ERROR_KIND.VALIDATION, false);
    this.name = "TelemetryValidationError";
  }
}

export class TelemetrySourceError extends TelemetryError {
  constructor(message: string, retriable: boolean = true) {
    super(message, TELEMETRY_ERROR_KIND.SOURCE, retriable);
    this.name = "TelemetrySourceError";
  }
}
