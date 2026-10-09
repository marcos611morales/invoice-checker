import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: externalBaseUrl ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Local runs serve the production build; a deployed URL skips the web server.
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: "pnpm start",
          url: "http://localhost:3000/login",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
