import { expect, test } from '@playwright/test';

/**
 * Smoke tests for the marketing site.
 *
 * Goal: catch regressions on the SEO-critical pages (homepage,
 * pricing, blog, sitemap, robots) before they reach production.
 * Each test is intentionally minimal — assert that the page loads
 * + a handful of must-have elements exist. Detailed UI assertions
 * belong in component-level tests; here we want a fast green/red
 * "is the site up" signal.
 */

test.describe('marketing — homepage', () => {
  test('loads with the primary heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/phloz/i);
    // The H1 is the SEO anchor; if it disappears, GSC will notice.
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('exposes a call-to-action that points at the product', async ({
    page,
  }) => {
    await page.goto('/');
    // Must have at least one link that mentions the product. We
    // don't pin to a specific text/href because copy iterates — but
    // a "go to the app" / "start free" / "sign up" link existing at
    // all is the regression signal.
    const cta = page
      .locator(
        'a[href*="/signup"], a[href*="app.phloz.com"], a[href*="/pricing"]',
      )
      .first();
    await expect(cta).toBeVisible();
  });
});

test.describe('marketing — /pricing', () => {
  test('renders five public tier cards', async ({ page }) => {
    await page.goto('/pricing');
    await expect(
      page.getByRole('heading', { name: /Simple, predictable pricing/i }),
    ).toBeVisible();
    // Every tier surfaced by `publicTiers()` must have a card with
    // its display name. Enterprise is intentionally hidden.
    for (const tier of ['Starter', 'Pro', 'Growth', 'Business', 'Scale']) {
      await expect(
        page.getByRole('heading', { name: tier, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole('heading', { name: 'Enterprise', exact: true }),
    ).toHaveCount(0);
  });

  test('shows the comparison matrix with feature rows', async ({ page }) => {
    await page.goto('/pricing');
    await expect(
      page.getByRole('heading', { name: 'Compare plans' }),
    ).toBeVisible();
    // Every matrix row that's user-facing copy. If the table
    // shape changes these assertions tell us right away.
    for (const row of [
      'Active clients',
      'Included paid seats',
      'Extra seat price',
      'Recurring task templates',
      'Tracking infrastructure map',
      'Client portal users',
      'Email + inbound threading',
      'Priority support',
    ]) {
      await expect(
        page.getByRole('rowheader', { name: row }),
      ).toBeVisible();
    }
  });

  test('shows an FAQ section', async ({ page }) => {
    await page.goto('/pricing');
    await expect(
      page.getByRole('heading', { name: /Frequently asked questions/i }),
    ).toBeVisible();
  });
});

test.describe('marketing — blog', () => {
  test('/blog index loads', async ({ page }) => {
    const response = await page.goto('/blog');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

test.describe('marketing — SEO surface', () => {
  test('robots.txt is served', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    // Must reference the sitemap so crawlers can discover it.
    expect(body.toLowerCase()).toContain('sitemap');
  });

  test('sitemap.xml is served', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/xml/);
  });

  test('llms.txt is served', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    // The route handler always emits at least the site name as a
    // header; if the body is empty something has regressed.
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('marketing — programmatic SEO routes', () => {
  // These pages are SSG with generateStaticParams. A 404 on any of
  // them means the static-params list dropped an entry — caught
  // before the next deploy.
  for (const path of [
    '/use-cases/tracking-infrastructure-map',
    '/integrations/ga4',
  ]) {
    test(`${path} renders`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1').first()).toBeVisible();
    });
  }
});
