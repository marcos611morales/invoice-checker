import { describe, expect, it, vi } from "vitest";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { testUtils, type TestHelpers } from "better-auth/plugins";
import { buildAuthOptions } from "@/auth/auth-config";
import { evaluateAccess, parseAllowlist } from "@/auth/allowlist";

// require-user.ts reads the real app singleton (env + cookies). Replace those
// edges so only the pure gate mapping is under test here.
vi.mock("@/auth/auth", () => ({ auth: { api: {} } }));
vi.mock("@/env", () => ({ env: { ALLOWED_EMAILS: "" } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { apiGateFor } = await import("@/auth/require-user");

const testEnv = {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-secret",
};

describe("apiGateFor (route handler gate)", () => {
  it("answers 401 no_autenticado with a Spanish message for anonymous callers", async () => {
    const gate = apiGateFor({ kind: "anonymous" });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(401);
    const body = (await gate.response.json()) as {
      code: string;
      mensaje: string;
    };
    expect(body.code).toBe("no_autenticado");
    expect(body.mensaje).toBe("Inicia sesión para continuar.");
  });

  it("answers 403 acceso_denegado with a Spanish message for denied callers", async () => {
    const gate = apiGateFor({ kind: "denied", email: "x@gmail.com" });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(403);
    const body = (await gate.response.json()) as {
      code: string;
      mensaje: string;
    };
    expect(body.code).toBe("acceso_denegado");
    expect(body.mensaje).toBe("Tu cuenta no tiene acceso a esta aplicación.");
    // The denied body must not leak the caller's address or any data.
    expect(JSON.stringify(body)).not.toContain("x@gmail.com");
  });

  it("lets allowed callers through with their email", () => {
    expect(apiGateFor({ kind: "allowed", email: "a@x.com" })).toEqual({
      ok: true,
      email: "a@x.com",
    });
  });
});

describe("allowlist is re-evaluated on every request (D-19, in-process Better Auth)", () => {
  async function signedInSession(email: string, emailVerified: boolean) {
    // testUtils() is typed more strictly than BetterAuthPlugin allows under
    // exactOptionalPropertyTypes, so it is widened once, here, for tests only.
    const plugin = testUtils() as unknown as BetterAuthPlugin;
    const instance = betterAuth(buildAuthOptions(testEnv, [plugin]));
    // The plugin adds `test` to the runtime context; buildAuthOptions returns
    // plain BetterAuthOptions, so the static type does not know about it.
    const ctx = (await instance.$context) as unknown as { test: TestHelpers };
    const helpers = ctx.test;
    const user = helpers.createUser({ email, emailVerified });
    await helpers.saveUser(user);
    const { headers } = await helpers.login({ userId: user.id });
    return { instance, headers };
  }

  it("allows a verified user whose email differs only by case", async () => {
    const { instance, headers } = await signedInSession(
      "Dueno@Example.com",
      true,
    );
    const session = await instance.api.getSession({ headers });
    expect(evaluateAccess(session, parseAllowlist("dueno@example.com"))).toEqual(
      { kind: "allowed", email: "dueno@example.com" },
    );
  });

  it("denies the SAME valid session on the next call once the email leaves the allowlist", async () => {
    const { instance, headers } = await signedInSession(
      "Dueno@Example.com",
      true,
    );

    const first = await instance.api.getSession({ headers });
    expect(first).not.toBeNull();
    expect(evaluateAccess(first, parseAllowlist("dueno@example.com")).kind).toBe(
      "allowed",
    );

    // Same cookie, same instance, allowlist changed: no cached allow.
    const second = await instance.api.getSession({ headers });
    expect(second).not.toBeNull();
    expect(evaluateAccess(second, parseAllowlist("otro@example.com"))).toEqual({
      kind: "denied",
      email: "dueno@example.com",
    });
  });

  it("evaluates concurrent requests independently", async () => {
    const { instance, headers } = await signedInSession(
      "dueno@example.com",
      true,
    );
    const decisions = await Promise.all([
      instance.api
        .getSession({ headers })
        .then((s) => evaluateAccess(s, parseAllowlist("dueno@example.com"))),
      instance.api
        .getSession({ headers })
        .then((s) => evaluateAccess(s, parseAllowlist("otro@example.com"))),
      instance.api
        .getSession({ headers })
        .then((s) => evaluateAccess(s, parseAllowlist("dueno@example.com"))),
    ]);
    expect(decisions.map((d) => d.kind)).toEqual([
      "allowed",
      "denied",
      "allowed",
    ]);
  });

  it("denies an unverified user even when the email is listed", async () => {
    const { instance, headers } = await signedInSession(
      "dueno@example.com",
      false,
    );
    const session = await instance.api.getSession({ headers });
    expect(
      evaluateAccess(session, parseAllowlist("dueno@example.com")).kind,
    ).toBe("denied");
  });
});
