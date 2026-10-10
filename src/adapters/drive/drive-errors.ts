/**
 * Maps raw Drive/gaxios failures to fixed Spanish operator messages.
 *
 * The `mensaje` is a constant per code and NEVER interpolates the raw error
 * text, headers or request config: those can carry access or refresh tokens
 * (T-01-08).
 */

export type DriveErrorCode =
  | "no_configurado"
  | "autorizacion_caducada"
  | "no_encontrado"
  | "sin_permiso"
  | "limite_de_uso"
  | "sin_espacio"
  | "red"
  | "desconocido";

export const DRIVE_ERROR_MESSAGES: Record<DriveErrorCode, string> = {
  no_configurado:
    "Falta configurar Drive: define DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET y DRIVE_REFRESH_TOKEN.",
  autorizacion_caducada:
    "La autorización de Drive caducó. El dueño debe ejecutar pnpm drive:auth y actualizar DRIVE_REFRESH_TOKEN.",
  no_encontrado: "No se encontró el archivo o la carpeta en Drive.",
  sin_permiso:
    "La cuenta autorizada no tiene permiso para esta operación en Drive.",
  limite_de_uso:
    "Drive limitó temporalmente las solicitudes. Intenta de nuevo en unos minutos.",
  sin_espacio: "El Drive del dueño no tiene espacio disponible.",
  red: "No se pudo conectar con Drive. Intenta de nuevo.",
  desconocido: "Error inesperado al hablar con Drive.",
};

const RETRYABLE: ReadonlySet<DriveErrorCode> = new Set<DriveErrorCode>([
  "limite_de_uso",
  "red",
]);

export class DriveError extends Error {
  readonly code: DriveErrorCode;
  readonly mensaje: string;
  readonly retryable: boolean;

  constructor(code: DriveErrorCode, mensaje?: string) {
    const text = mensaje ?? DRIVE_ERROR_MESSAGES[code];
    super(text);
    this.name = "DriveError";
    this.code = code;
    this.mensaje = text;
    this.retryable = RETRYABLE.has(code);
  }
}

const NETWORK_CODES: ReadonlySet<string> = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "EPIPE",
]);

/** Reads a property off an unknown value without trusting its shape. */
function prop(value: unknown, key: string): unknown {
  if (typeof value === "object" && value !== null && key in value) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function statusOf(err: unknown): number | undefined {
  const candidates = [
    prop(prop(err, "response"), "status"),
    prop(err, "status"),
    prop(err, "code"),
  ];
  for (const c of candidates) {
    if (typeof c === "number") return c;
    if (typeof c === "string" && /^\d{3}$/.test(c)) return Number(c);
  }
  return undefined;
}

/** Collects Drive `reason` strings from gaxios' `response.data.error.errors`. */
function reasonsOf(err: unknown): string[] {
  const data = prop(prop(err, "response"), "data");
  const errorNode = prop(data, "error");
  const errors = prop(errorNode, "errors");
  const reasons: string[] = [];
  if (Array.isArray(errors)) {
    for (const e of errors as unknown[]) {
      const reason = prop(e, "reason");
      if (typeof reason === "string") reasons.push(reason);
    }
  }
  const topReason = prop(errorNode, "status");
  if (typeof topReason === "string") reasons.push(topReason);
  return reasons;
}

function mentionsInvalidGrant(err: unknown): boolean {
  const data = prop(prop(err, "response"), "data");
  const haystacks: unknown[] = [
    prop(err, "message"),
    prop(data, "error"),
    prop(data, "error_description"),
    typeof data === "string" ? data : undefined,
  ];
  return haystacks.some(
    (h) => typeof h === "string" && h.toLowerCase().includes("invalid_grant"),
  );
}

export function toDriveError(err: unknown): DriveError {
  if (err instanceof DriveError) return err;

  if (mentionsInvalidGrant(err)) return new DriveError("autorizacion_caducada");

  const status = statusOf(err);
  const reasons = reasonsOf(err);

  if (status === 404) return new DriveError("no_encontrado");
  if (status === 429) return new DriveError("limite_de_uso");
  if (status === 403) {
    if (
      reasons.includes("rateLimitExceeded") ||
      reasons.includes("userRateLimitExceeded")
    ) {
      return new DriveError("limite_de_uso");
    }
    if (reasons.includes("storageQuotaExceeded")) {
      return new DriveError("sin_espacio");
    }
    return new DriveError("sin_permiso");
  }
  if (status !== undefined && status >= 500 && status <= 599) {
    return new DriveError("red");
  }

  const code = prop(err, "code");
  if (typeof code === "string" && NETWORK_CODES.has(code)) {
    return new DriveError("red");
  }

  return new DriveError("desconocido");
}
