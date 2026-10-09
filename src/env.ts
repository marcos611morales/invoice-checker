import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Server-only, zod-validated environment. There are no client variables on
 * purpose: the allowlist and every secret stay on the server (D-16).
 */
export const env = createEnv({
  server: {
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    ALLOWED_EMAILS: z.string().min(1),
    // The Drive plane (owner refresh token) is configured by Plan 01-02.
    DRIVE_CLIENT_ID: z.string().min(1).optional(),
    DRIVE_CLIENT_SECRET: z.string().min(1).optional(),
    DRIVE_REFRESH_TOKEN: z.string().min(1).optional(),
    DRIVE_FOLDER_ID: z.string().min(1).optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
