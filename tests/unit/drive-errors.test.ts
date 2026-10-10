import { describe, expect, it } from "vitest";
import {
  DRIVE_ERROR_MESSAGES,
  DriveError,
  toDriveError,
} from "@/adapters/drive/drive-errors";

// Built from parts so the repo-wide token-prefix scan stays clean.
const ACCESS_PREFIX = ["ya2", "9."].join("");
const REFRESH_PREFIX = ["1", "//"].join("");
const ACCESS_TOKEN = `${ACCESS_PREFIX}a0AfH6SMBsecretAccessTokenValue`;
const REFRESH_TOKEN = `${REFRESH_PREFIX}0gSecretRefreshTokenValue1234567890`;

/** gaxios-shaped error carrying tokens in message, headers and config. */
function gaxiosError(
  status: number | undefined,
  opts: {
    reason?: string;
    data?: unknown;
    code?: string;
    message?: string;
  } = {},
): unknown {
  return Object.assign(
    new Error(
      opts.message ?? `request failed ${ACCESS_TOKEN} ${REFRESH_TOKEN}`,
    ),
    {
      ...(opts.code ? { code: opts.code } : {}),
      config: {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        data: { refresh_token: REFRESH_TOKEN },
      },
      ...(status === undefined
        ? {}
        : {
            response: {
              status,
              data:
                opts.data ??
                (opts.reason
                  ? { error: { errors: [{ reason: opts.reason }] } }
                  : {}),
            },
          }),
    },
  );
}

function expectNoLeak(e: DriveError): void {
  for (const text of [e.mensaje, e.message]) {
    expect(text).not.toContain(ACCESS_PREFIX);
    expect(text).not.toContain(REFRESH_PREFIX);
    expect(text).not.toContain(ACCESS_TOKEN);
    expect(text).not.toContain(REFRESH_TOKEN);
  }
}

describe("toDriveError", () => {
  it("maps invalid_grant to autorizacion_caducada with the exact operator message", () => {
    const e = toDriveError(
      gaxiosError(400, {
        data: { error: "invalid_grant", error_description: "Bad Request" },
      }),
    );
    expect(e.code).toBe("autorizacion_caducada");
    expect(e.retryable).toBe(false);
    expect(e.mensaje).toBe(
      "La autorización de Drive caducó. El dueño debe ejecutar pnpm drive:auth y actualizar DRIVE_REFRESH_TOKEN.",
    );
    expectNoLeak(e);
  });

  it("detects invalid_grant in the message when there is no response body", () => {
    const e = toDriveError(new Error(`invalid_grant ${REFRESH_TOKEN}`));
    expect(e.code).toBe("autorizacion_caducada");
    expectNoLeak(e);
  });

  it("maps 404 to no_encontrado", () => {
    const e = toDriveError(gaxiosError(404));
    expect(e.code).toBe("no_encontrado");
    expect(e.retryable).toBe(false);
    expectNoLeak(e);
  });

  it("maps 403 rateLimitExceeded to retryable limite_de_uso", () => {
    const e = toDriveError(gaxiosError(403, { reason: "rateLimitExceeded" }));
    expect(e.code).toBe("limite_de_uso");
    expect(e.retryable).toBe(true);
    expectNoLeak(e);
  });

  it("maps 403 userRateLimitExceeded to retryable limite_de_uso", () => {
    const e = toDriveError(
      gaxiosError(403, { reason: "userRateLimitExceeded" }),
    );
    expect(e.code).toBe("limite_de_uso");
    expect(e.retryable).toBe(true);
  });

  it("maps 429 to retryable limite_de_uso", () => {
    const e = toDriveError(gaxiosError(429));
    expect(e.code).toBe("limite_de_uso");
    expect(e.retryable).toBe(true);
    expectNoLeak(e);
  });

  it("maps 403 storageQuotaExceeded to sin_espacio", () => {
    const e = toDriveError(
      gaxiosError(403, { reason: "storageQuotaExceeded" }),
    );
    expect(e.code).toBe("sin_espacio");
    expect(e.retryable).toBe(false);
    expectNoLeak(e);
  });

  it("maps any other 403 to sin_permiso", () => {
    const e = toDriveError(gaxiosError(403, { reason: "forbidden" }));
    expect(e.code).toBe("sin_permiso");
    expect(e.retryable).toBe(false);
    expectNoLeak(e);
  });

  it("maps 500 to retryable red", () => {
    const e = toDriveError(gaxiosError(500));
    expect(e.code).toBe("red");
    expect(e.retryable).toBe(true);
    expectNoLeak(e);
  });

  it.each(["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"])(
    "maps network code %s to retryable red",
    (code) => {
      const e = toDriveError(gaxiosError(undefined, { code }));
      expect(e.code).toBe("red");
      expect(e.retryable).toBe(true);
      expectNoLeak(e);
    },
  );

  it("maps a plain Error to desconocido and never echoes its text", () => {
    const e = toDriveError(new Error(`boom ${ACCESS_TOKEN} ${REFRESH_TOKEN}`));
    expect(e.code).toBe("desconocido");
    expect(e.mensaje).toBe(DRIVE_ERROR_MESSAGES.desconocido);
    expect(e.retryable).toBe(false);
    expectNoLeak(e);
  });

  it("passes an existing DriveError through unchanged", () => {
    const original = new DriveError("no_configurado");
    expect(toDriveError(original)).toBe(original);
  });

  it("handles non-object throwables", () => {
    expect(toDriveError("texto").code).toBe("desconocido");
    expect(toDriveError(undefined).code).toBe("desconocido");
  });
});
