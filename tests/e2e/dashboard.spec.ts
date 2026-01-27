import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  // These tests assume unauthenticated access redirects to login
  test.describe('Access Control', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('should redirect protected routes to login', async ({ page }) => {
      const protectedRoutes = ['/jobs', '/settings', '/profile'];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/login/);
      }
    });
  });

  test.describe('Navigation', () => {
    test('should have navigation menu on home page', async ({ page }) => {
      await page.goto('/');

      // Check for main navigation elements
      const nav = page.locator('nav, header');
      await expect(nav).toBeVisible();
    });

    test('should have responsive design', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile
      await page.goto('/');

      // Page should be viewable on mobile
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
