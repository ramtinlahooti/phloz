import { expect, test } from '@playwright/test';

/**
 * Smoke tests for the unauthenticated product-app routes.
 *
 * Scope: load each public auth page and assert the form fields are
 * present + the cross-link to the sibling page exists. We don't
 * actually submit the forms because that would require a Supabase
 * Auth backend in test mode — that work belongs to the
 * authenticated-tests follow-up.
 *
 * The goal here is the same "is the app up" signal the marketing
 * smoke suite gives us: catch a regression that breaks the login
 * surface before it reaches production.
 */

test.describe('app — /login', () => {
  test('renders the welcome heading and form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible();
    // Email + password fields are the regression signals.
    await expect(page.getByPlaceholder('you@agency.com')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    // Sign-in button.
    await expect(
      page.getByRole('button', { name: /Sign in/i }).first(),
    ).toBeVisible();
  });

  test('links to the signup page', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: /Create one/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/signup');
  });
});

test.describe('app — /signup', () => {
  test('renders the signup heading and required fields', async ({ page }) => {
    await page.goto('/signup');
    // Heading copy may iterate; assert against the `<h1>` rather
    // than a literal string so cosmetic copy changes don't break
    // the smoke test.
    await expect(page.locator('h1').first()).toBeVisible();
    // Three fields the schema requires: name, email, password.
    await expect(page.getByPlaceholder('Alex Chen')).toBeVisible();
    await expect(page.getByPlaceholder('alex@agency.com')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});

test.describe('app — /forgot-password', () => {
  test('renders the reset heading and email field', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(
      page.getByRole('heading', { name: /Reset your password/i }),
    ).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});

test.describe('app — /reset-password', () => {
  // The reset flow lands here with a token in the URL fragment;
  // without one, the form still renders (Supabase Auth handles the
  // invalid-session UX inside its client). We just assert the page
  // boots without a 500.
  test('renders without crashing', async ({ page }) => {
    const response = await page.goto('/reset-password');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

test.describe('app — protected route guard', () => {
  // The middleware bounces unauthenticated visits to /login with
  // a `?next=<original>` round-trip parameter. We assert on both
  // the redirect URL + the absence of dashboard content; the
  // belt-and-braces approach catches a regression on either layer
  // (the redirect not happening, or the redirect leaking some
  // workspace state through into the rendered login page).
  test('redirects an unauthenticated visit to /login with ?next=', async ({
    page,
  }) => {
    const fakeWorkspace = '00000000-0000-0000-0000-000000000000';
    await page.goto(`/${fakeWorkspace}`);
    await expect(page).toHaveURL(/\/login\?next=/);
    // The dashboard's "Recent activity" heading must not be
    // present even after the redirect. Belt and braces.
    await expect(
      page.getByRole('heading', { name: /Recent activity/i }),
    ).toHaveCount(0);
  });

  test('preserves the original path in the next param', async ({ page }) => {
    const target = '/00000000-0000-0000-0000-000000000000/clients';
    await page.goto(target);
    await expect(page).toHaveURL(
      new RegExp(`\\/login\\?next=${encodeURIComponent(target).replace(/-/g, '-')}`),
    );
  });
});
