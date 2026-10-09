/**
 * Pure access decision. No `server-only` import so it can be unit-tested and
 * reused. The allowlist itself only ever comes from the server-side
 * ALLOWED_EMAILS env var (D-16).
 */

export type AccessDecision =
  | { kind: "anonymous" }
  | { kind: "denied"; email: string }
  | { kind: "allowed"; email: string };

export interface SessionLike {
  user: { email: string; emailVerified: boolean };
}

/** Split on commas and whitespace, trim, lowercase, drop empties. */
export function parseAllowlist(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

/**
 * `allowed` only when the Google account email is verified AND its trimmed,
 * lowercased form is an exact member of the allowlist (so `a+1@x.com` never
 * matches `a@x.com`). Evaluated on every call, never cached (D-19).
 */
export function evaluateAccess(
  session: SessionLike | null,
  allowlist: ReadonlySet<string>,
): AccessDecision {
  if (!session) return { kind: "anonymous" };
  const email = session.user.email.trim().toLowerCase();
  if (session.user.emailVerified && allowlist.has(email)) {
    return { kind: "allowed", email };
  }
  return { kind: "denied", email };
}
