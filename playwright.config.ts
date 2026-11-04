import { defineConfig, devices } from "@playwright/test";

// E2E contra la app completa (Next + Postgres).
//
// - Local en contenedor: ./scripts/dev-test.sh e2e levanta un segundo
//   `next dev` en el puerto 3100 (base *_e2e y distDir .next-e2e) para no
//   chocar con el servidor de desarrollo de 3000.
// - CI: se compila con `npm run build` y Playwright arranca `npm run start`.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_NO_WEBSERVER === "1"
      ? undefined
      : {
          command: process.env.PLAYWRIGHT_WEB_SERVER_CMD ?? "npm run start",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
});
