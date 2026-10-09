import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { nextCookies } from "better-auth/next-js";

export const DAY_SECONDS = 86_400;

export interface AuthEnv {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

/**
 * Stateless Better Auth options (no persistence adapter configured): the session lives in an
 * encrypted JWE cookie and nothing is stored server-side.
 *
 * Identity plane only (D-01): Google is asked for the default `openid email
 * profile` scopes. Drive access is a separate owner credential.
 *
 * Session policy (D-18): 30 days sliding, 365 days absolute cap. In stateless
 * mode the cookie cache is the only session store, so `cookieCache.maxAge`
 * is the sliding window and `session.expiresIn` is the cap (RESEARCH Pitfall 2).
 */
export function buildAuthOptions(
  env: AuthEnv,
  extraPlugins: BetterAuthPlugin[] = [],
): BetterAuthOptions {
  return {
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    session: {
      expiresIn: 365 * DAY_SECONDS,
      cookieCache: {
        enabled: true,
        strategy: "jwe",
        maxAge: 30 * DAY_SECONDS,
        refreshCache: { updateAge: 29 * DAY_SECONDS },
      },
    },
    account: {
      storeStateStrategy: "cookie",
      storeAccountCookie: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: "select_account",
      },
    },
    // nextCookies() must be the last plugin.
    plugins: [...extraPlugins, nextCookies()],
  };
}
