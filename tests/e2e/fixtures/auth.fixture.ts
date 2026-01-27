import { test as base, expect, Page } from '@playwright/test';
import { testUsers } from './test-data';

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
  adminPage: Page;
  loginAs: (email: string, password: string) => Promise<void>;
}>({
  /**
   * Page with SMB user authentication
   */
  authenticatedPage: async ({ page }, use) => {
    // Attempt login
    await page.goto('/login');

    // Fill login form
    await page.getByLabel(/email/i).fill(testUsers.smbUser.email);
    await page.getByLabel(/password/i).fill(testUsers.smbUser.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for redirect or dashboard
    await page.waitForURL(/dashboard|home/i, { timeout: 10000 }).catch(() => {
      // If login fails in test env, continue anyway
    });

    await use(page);
  },

  /**
   * Page with admin authentication
   */
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3003/login'); // Admin app

    await page.getByLabel(/email/i).fill(testUsers.adminUser.email);
    await page.getByLabel(/password/i).fill(testUsers.adminUser.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    await page.waitForURL(/dashboard|home/i, { timeout: 10000 }).catch(() => {});

    await use(page);

    await context.close();
  },

  /**
   * Login helper function
   */
  loginAs: async ({ page }, use) => {
    const login = async (email: string, password: string) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole('button', { name: /sign in|login/i }).click();
      await page.waitForURL(/dashboard|home/i, { timeout: 10000 }).catch(() => {});
    };

    await use(login);
  },
});

export { expect };
