import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Phloz product app smoke tests.
 *
 * Scope (this iteration): unauthenticated routes only — login,
 * signup, password-reset entry. Authenticated tests need a test
 * database + seeded fixtures + Supabase auth state setup; they
 * land in their own focused session.
 *
 * Local: spins up `next dev -p 3001` via `webServer` so a single
 * `pnpm --filter @phloz/app test:e2e` run is self-contained.
 *
 * CI / preview: pass `PLAYWRIGHT_BASE_URL` to point tests at a
 * deployed preview (or production smoke-checks) instead of
 * spinning up a local dev server.
 *
 * Setup, one-time:  pnpm --filter @phloz/app test:e2e:install
 *
 * Local env vars: the dev server reads `apps/app/.env.local`
 * (Supabase URL + key are required even for the unauth routes —
 * the middleware initializes the auth client before deciding to
 * pass through). In a worktree without `.env.local`, symlink it
 * from the main checkout. CI sets dummy values inline at the
 * workflow level, so no symlink is needed there.
 */
const PORT = 3001;
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
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @phloz/app dev',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        // App boots slower than the marketing site (Supabase client
        // init + middleware compile). 180s gives Turbopack room
        // even on a cold runner.
        timeout: 180 * 1000,
      },
});
