import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Phloz marketing site smoke tests.
 *
 * Local: spins up `next dev` on :3000 via `webServer` so a single
 * `pnpm --filter @phloz/web test:e2e` run is self-contained — no
 * separate dev-server process needed.
 *
 * CI / preview: pass `PLAYWRIGHT_BASE_URL` to point tests at a
 * deployed preview (or production smoke-checks) instead of spinning
 * up a local dev server.
 *
 * Browser scope: chromium-only for now. The marketing site is
 * pretty plain HTML; cross-browser DOM differences aren't where
 * the bugs hide. We can add firefox/webkit projects later if a
 * specific bug demands it.
 *
 * Setup, one-time:  pnpm --filter @phloz/web test:e2e:install
 */
const PORT = 3000;
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Skip the webServer when an external base URL is supplied — the
  // tests run against a deployed preview / production rather than a
  // local dev server.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @phloz/web dev',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
