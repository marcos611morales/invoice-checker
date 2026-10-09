# API Coverage — Google Drive API v3 and Google OAuth / Better Auth

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Detector: `api-coverage.cjs` over the Phase 1 plans + ROADMAP section returned `detected: true` (signal: "Enable the Google Drive API"). Phase 1 integrates two external surfaces: Google Drive v3 (data plane, owner refresh token) and Google OAuth via Better Auth (identity plane).

## Google Drive API v3 (via `@googleapis/drive`, behind the `DriveApi` port)

| capability | decision | reason |
|---|---|---|
| files.list (query, pagination, field masks) | INTEGRATE | |
| files.get (metadata) | INTEGRATE | |
| files.get alt=media (download bytes) | INTEGRATE | |
| files.create (folder and JSON media) | INTEGRATE | |
| files.update (media upload) | INTEGRATE | |
| about.get (token owner account) | INTEGRATE | |
| files.update If-Match precondition probe | INTEGRATE | spike only (Plan 01-09); result picks the Phase 3 policy |
| files.update metadata (rename, move, trash) | OPT-OUT | explicitly out of scope: the app never renames, moves or trashes user files (prohibition in Plan 01-06); only the spike trashes its own throwaway folder |
| files.delete | OPT-OUT | explicitly out of scope: state files are rewritten, never deleted; user files are never deleted |
| files.copy | OPT-OUT | not needed |
| files.export (Google-native docs) | OPT-OUT | not needed: native Docs are ignored and counted (ignoredNative); CFDI are XML files |
| files.download (long-running operation) | OPT-OUT | not needed: files are under 10 KB, alt=media suffices |
| files.emptyTrash | OPT-OUT | explicitly out of scope: destructive and unrelated |
| files.generateIds | OPT-OUT | not needed: ids come from create responses and are cached |
| files.watch / channels.stop | OPT-OUT | not needed yet: sync is manual (D-05); push notifications would need a public webhook |
| files.listLabels / modifyLabels | OPT-OUT | not needed: Workspace labels do not apply to a personal Gmail |
| changes.getStartPageToken / changes.list / changes.watch | OPT-OUT | not needed yet: full listing + manifest diff is cheaper below ~50k files (ARCHITECTURE Pattern 2) |
| permissions.* | OPT-OUT | explicitly out of scope: sharing is managed by the owner in Drive |
| revisions.* | OPT-OUT | not needed yet: Drive revision history is the manual undo for `_app/` files |
| comments.* / replies.* | OPT-OUT | not needed |
| drives.* (shared drives) | OPT-OUT | not needed: personal Gmail, no Workspace shared drives |
| apps.* | OPT-OUT | not needed |
| accessproposals.* / approvals.* | OPT-OUT | not needed |
| Shortcut resolution (shortcutDetails.targetId) | OPT-OUT | not needed yet: shortcuts are counted and reported, not followed (Plan 01-02 tree walk) |
| appDataFolder (drive.appdata scope) | OPT-OUT | rejected for the D-03 pointer: hidden from the user and needs an extra scope (RESEARCH Pattern 4) |

## Google OAuth 2.0 (Drive plane, `google-auth-library` + `pnpm drive:auth`)

| capability | decision | reason |
|---|---|---|
| Auth code flow, PKCE S256 + state, loopback redirect (Desktop client) | INTEGRATE | |
| access_type=offline + prompt=consent (refresh token issuance) | INTEGRATE | |
| Token endpoint: code exchange | INTEGRATE | |
| Token endpoint: access-token refresh (automatic in OAuth2Client) | INTEGRATE | |
| invalid_grant detection and Spanish operator message | INTEGRATE | |
| Token revocation endpoint | OPT-OUT | not needed yet: the owner revokes at myaccount.google.com/permissions (runbook) |
| Tokeninfo / ID-token verification for the Drive plane | OPT-OUT | not needed: the Drive plane never authenticates users |
| Incremental authorization / granular consent handling | OPT-OUT | not needed: one scope (`drive`), one consenting account |

## Better Auth 1.7.7 (identity plane, Google social provider, stateless)

| capability | decision | reason |
|---|---|---|
| signIn.social (Google, prompt select_account) | INTEGRATE | |
| OAuth callback handler (`/api/auth/callback/google`) | INTEGRATE | |
| getSession (server `auth.api.getSession`, client `authClient.getSession`) | INTEGRATE | |
| signOut | INTEGRATE | |
| Stateless cookie cache (JWE) with refreshCache sliding renewal | INTEGRATE | |
| getSessionCookie (optimistic proxy check) | INTEGRATE | |
| testUtils plugin (in-process sessions for DAL tests) | INTEGRATE | tests only |
| getAccessToken / refreshToken / account-cookie Google tokens | OPT-OUT | explicitly out of scope: D-01 keeps Drive on the env refresh token; login stays identity-only |
| linkSocial / unlinkAccount / listAccounts | OPT-OUT | not needed: one provider, one account per user |
| listSessions / revokeSession / revokeSessions / revokeOtherSessions | OPT-OUT | not needed: stateless mode has no session store; revoke-all = bump cookie cache version and redeploy; allowlist removal revokes access on the next request (D-19) |
| updateUser / deleteUser / changeEmail | OPT-OUT | not needed: no user database |
| Other auth methods and plugins (password, magic link, OTP, passkey, 2FA, orgs) | OPT-OUT | explicitly out of scope: Google login only, two users, no roles |
| databaseHooks.user.create.before (sign-in rejection) | OPT-OUT | not needed: D-17 requires showing the denied user's email, so denial happens in the DAL |
