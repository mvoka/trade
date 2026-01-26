import { test, expect } from '@playwright/test';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state
    await page.goto('http://localhost:3003/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show login page for unauthenticated users', async ({ page }) => {
    await page.goto('http://localhost:3003');
    // Home page redirects to login
    await page.waitForURL(/.*login/);
    await expect(page).toHaveURL(/.*login/);
  });

  test('should allow Admin user to login', async ({ page }) => {
    await page.goto('http://localhost:3003/login');

    await page.fill('input[name="email"]', 'admin@tradesdispatch.com');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText(/Admin Dashboard/i)).toBeVisible();
  });

  test('should show dashboard with statistics', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3003/login');
    await page.fill('input[name="email"]', 'admin@tradesdispatch.com');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Check dashboard elements
    await page.waitForURL('**/dashboard');
    await expect(page.getByText(/Pending Verifications/i)).toBeVisible();
    await expect(page.getByText(/Active Pros/i)).toBeVisible();
    await expect(page.getByText(/Total Jobs/i)).toBeVisible();
  });

  test('should allow logout', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3003/login');
    await page.fill('input[name="email"]', 'admin@tradesdispatch.com');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/dashboard');

    // Click logout
    await page.click('button:has-text("Logout")');

    // Should redirect to login
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/.*login/);
  });
});
