import { describe, expect, it } from "vitest";
import { buildAuthOptions, DAY_SECONDS } from "@/auth/auth-config";

const testEnv = {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-secret",
};

describe("buildAuthOptions", () => {
  const options = buildAuthOptions(testEnv);

  it("uses 86400-second days", () => {
    expect(DAY_SECONDS).toBe(86_400);
  });

  it("is stateless: no database key", () => {
    expect("database" in options).toBe(false);
  });

  it("caps the absolute session at 365 days", () => {
    expect(options.session?.expiresIn).toBe(31536000);
  });

  it("slides a 30-day JWE cookie cache, refreshing after 1 day (29-day updateAge)", () => {
    const cache = options.session?.cookieCache;
    expect(cache?.enabled).toBe(true);
    expect(cache?.strategy).toBe("jwe");
    expect(cache?.maxAge).toBe(2592000);
    expect(cache?.refreshCache).toEqual({ updateAge: 2505600 });
  });

  it("asks Google for identity only: account picker and no extra scopes", () => {
    const google = options.socialProviders?.google;
    if (google === undefined || typeof google === "function") {
      throw new Error("the google provider must be a plain options object");
    }
    expect(google.prompt).toBe("select_account");
    const scopes = google.scope ?? [];
    expect(scopes.some((scope) => scope.includes("drive"))).toBe(false);
    expect(scopes).toEqual([]);
  });

  it("keeps the secrets and URL from the env it is given", () => {
    expect(options.baseURL).toBe(testEnv.BETTER_AUTH_URL);
    expect(options.secret).toBe(testEnv.BETTER_AUTH_SECRET);
  });

  it("registers nextCookies() as the last plugin, after extra plugins", () => {
    const extra = { id: "extra-plugin" };
    const withExtra = buildAuthOptions(testEnv, [extra]);
    const ids = (withExtra.plugins ?? []).map((plugin) => plugin.id);
    expect(ids).toEqual(["extra-plugin", "next-cookies"]);
  });
});
