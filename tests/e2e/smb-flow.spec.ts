import { test, expect } from '@playwright/test';

test.describe('SMB User Flow', () => {
  test('should show login page with form', async ({ page }) => {
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // Form should be visible
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
  });

  test('should allow SMB user to login and see dashboard', async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => console.log('Browser console:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('Page error:', err.message));

    // Go directly to login page
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // Wait for React hydration by checking if the form has event listeners
    // We do this by waiting a bit and ensuring JS is loaded
    await page.waitForTimeout(2000);

    // Wait for form to be visible
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });

    // Fill form using type instead of fill to simulate user typing
    await page.locator('input[name="email"]').click();
    await page.locator('input[name="email"]').type('smb@example.com');
    await page.locator('input[name="password"]').click();
    await page.locator('input[name="password"]').type('Admin123!');

    // Click submit and wait for navigation
    await Promise.all([
      page.waitForURL(/.*dashboard|.*login.*error/, { timeout: 20000 }).catch(() => {}),
      page.locator('button[type="submit"]').click(),
    ]);

    // Check URL - if we got query params, JS didn't work
    const currentUrl = page.url();
    console.log('Current URL after submit:', currentUrl);

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
    await expect(page.getByText(/SMB Dashboard/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Welcome/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Active Jobs' })).toBeVisible({ timeout: 10000 });
  });

  test('should allow logout after login', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('Page error:', err.message));

    // Login first
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });

    await page.locator('input[name="email"]').click();
    await page.locator('input[name="email"]').type('smb@example.com');
    await page.locator('input[name="password"]').click();
    await page.locator('input[name="password"]').type('Admin123!');

    await Promise.all([
      page.waitForURL(/.*dashboard|.*login.*error/, { timeout: 20000 }).catch(() => {}),
      page.locator('button[type="submit"]').click(),
    ]);

    // Wait for dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
    await expect(page.locator('button:has-text("Logout")')).toBeVisible({ timeout: 10000 });

    // Click logout
    await page.click('button:has-text("Logout")');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
  });
});
