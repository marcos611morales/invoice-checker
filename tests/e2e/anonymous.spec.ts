import { expect, test } from "@playwright/test";

test("anonymous GET / is redirected (307) to /login", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/login$/);
});

test("/login shows the Spanish Google button under lang es-MX", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión con Google" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
});

test("Google sign-in asks for identity scopes only (no drive)", async ({
  request,
  baseURL,
}) => {
  const origin = baseURL ?? "http://localhost:3000";
  const response = await request.post("/api/auth/sign-in/social", {
    data: { provider: "google", callbackURL: "/" },
    headers: { Origin: origin },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { url?: string };
  expect(body.url).toBeTruthy();
  const consent = new URL(body.url ?? "");
  expect(consent.host).toBe("accounts.google.com");
  const scope = consent.searchParams.get("scope") ?? "";
  expect(scope).toContain("email");
  expect(scope).not.toContain("drive");
});
