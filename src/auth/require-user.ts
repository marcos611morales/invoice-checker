import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import {
  evaluateAccess,
  parseAllowlist,
  type AccessDecision,
} from "@/auth/allowlist";
import { env } from "@/env";

export type ApiGate =
  | { ok: true; email: string }
  | { ok: false; response: Response };

/**
 * Resolve the caller's access on EVERY call. The decision is recomputed from
 * the live ALLOWED_EMAILS value and never memoized, so removing an email
 * revokes access on that person's next request even if the cookie is valid (D-19).
 */
export async function getAccess(): Promise<AccessDecision> {
  const session = await auth.api.getSession({ headers: await headers() });
  return evaluateAccess(session, parseAllowlist(env.ALLOWED_EMAILS));
}

/** For pages and layouts: redirect anonymous to /login, denied to /acceso-denegado. */
export async function requireUser(): Promise<{ email: string }> {
  const access = await getAccess();
  if (access.kind === "anonymous") redirect("/login");
  if (access.kind === "denied") redirect("/acceso-denegado");
  return { email: access.email };
}

/** Pure mapping from a decision to the JSON gate used by route handlers. */
export function apiGateFor(decision: AccessDecision): ApiGate {
  switch (decision.kind) {
    case "anonymous":
      return {
        ok: false,
        response: Response.json(
          { code: "no_autenticado", mensaje: "Inicia sesión para continuar." },
          { status: 401 },
        ),
      };
    case "denied":
      return {
        ok: false,
        response: Response.json(
          {
            code: "acceso_denegado",
            mensaje: "Tu cuenta no tiene acceso a esta aplicación.",
          },
          { status: 403 },
        ),
      };
    case "allowed":
      return { ok: true, email: decision.email };
  }
}

/** For route handlers: 401/403 JSON instead of redirects. */
export async function requireUserApi(): Promise<ApiGate> {
  return apiGateFor(await getAccess());
}
