# API Coverage — Google OAuth 2.0 via Better Auth (identity plane)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Rewritten 2026-10-12 for the Phase 1 re-scope (browser XML upload, no Drive, D-20). The detector `api-coverage.cjs`, run over the live Phase 1 plans (01-01, 01-03, 01-04, 01-11..01-17; the same day's split into 01-18..01-22 moved tasks without adding an external API) plus the ROADMAP Phase 1 section, returned `detected: false`. The matrix is kept anyway because Phase 1 still signs users in through Google OAuth via Better Auth 1.7.7, so that surface stays decided. What the browser does with invoices (File API, IndexedDB through `idb`, BroadcastChannel, the `Clear-Site-Data` header) uses platform APIs in the user's own browser, not an external service. Vercel is the hosting target through its Git integration, not an API the code calls.

## Better Auth 1.7.7 + Google OAuth 2.0 (identity plane, stateless, identity scopes only)

| capability | decision | reason |
|---|---|---|
| signIn.social (Google, prompt select_account, scopes openid email profile) | INTEGRATE | |
| OAuth callback handler (/api/auth/callback/google) | INTEGRATE | |
| Google identity claims: email and email_verified (input to the allowlist, D-16) | INTEGRATE | |
| getSession (server DAL and client SessionKeepAlive) | INTEGRATE | |
| signOut (Clear-Site-Data wrapper, Plan 01-18; IndexedDB wiped first, Plan 01-14) | INTEGRATE | |
| Stateless JWE cookie cache with sliding renewal (D-18) | INTEGRATE | |
| State and account cookies (storeStateStrategy cookie, storeAccountCookie) | INTEGRATE | |
| testUtils plugin (in-process sessions for DAL unit tests) | INTEGRATE | tests only |
| better-auth/crypto symmetricEncodeJWT (minted e2e sessions, Plan 01-11) | INTEGRATE | tests only; never against a deployed URL |
| getSessionCookie (optimistic redirect in proxy.ts) | OPT-OUT | not needed: src/proxy.ts sets only the CSP (D-31) and requireUser() in every page does the redirect (D-19) |
| getAccessToken / refreshToken (Google API access with the account tokens) | OPT-OUT | explicitly out of scope: Phase 1 calls no Google API (D-20); Drive returns in Phase 6 with its own credential |
| Additional Google scopes / incremental authorization | OPT-OUT | explicitly out of scope: identity scopes only (D-20, D-34) |
| Google token revocation endpoint | OPT-OUT | not needed: sign-out clears the session cookies; the owner can revoke the app at myaccount.google.com/permissions |

## Google Drive API v3 and the Drive OAuth plane — Phase 6 reference

Phase 1 makes no Drive call (D-20). The 2026-10-09 Drive matrix (files.list, files.get, files.create, files.update, about.get, the If-Match probe, and the owner's refresh-token flow with `google-auth-library` and `pnpm drive:auth`) belongs to Phase 6 (Shared Invoices on Drive: AUTH-05, ING-01, ING-02, ING-03, STOR-01, STOR-02). It is preserved in git history (`git show 67151bb:.planning/phases/01-real-spend-by-supplier/COVERAGE.md`) and in the superseded plans 01-02 and 01-05..01-10, and Phase 6 re-decides every capability from a full-coverage baseline. The dormant code (`src/ports/drive-api.ts`, `src/adapters/drive/*`, `scripts/drive-*.ts`) is imported by no Phase 1 route.

| capability | decision | reason |
|---|---|---|
| Google Drive API v3 (every capability) | OPT-OUT | not needed yet: moved to Phase 6 by the 2026-10-12 re-scope (D-20) |
| Drive OAuth plane (owner refresh token, google-auth-library, pnpm drive:auth) | OPT-OUT | not needed yet: moved to Phase 6 (D-20); D-01 is deferred |

## Better Auth surface not used in Phase 1

| capability | decision | reason |
|---|---|---|
| linkSocial / unlinkAccount / listAccounts | OPT-OUT | not needed: one provider, one account per user |
| listSessions / revokeSession / revokeSessions / revokeOtherSessions | OPT-OUT | not needed: stateless mode has no session store; removing an email from ALLOWED_EMAILS revokes access on the next request (D-19) |
| updateUser / deleteUser / changeEmail | OPT-OUT | not needed: no user database |
| Other auth methods and plugins (password, magic link, OTP, passkey, 2FA) | OPT-OUT | explicitly out of scope: Google sign-in only, two users, no roles |
| databaseHooks.user.create.before (reject at sign-in) | OPT-OUT | not needed: D-17 shows the denied account's own email, so denial happens in the DAL |
