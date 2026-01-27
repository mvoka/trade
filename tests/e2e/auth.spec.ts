import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('button', { name: /sign in|login/i }).click();

      // Should show validation messages
      await expect(page.getByText(/email|required/i)).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in|login/i }).click();

      // Should show error message (exact text depends on implementation)
      await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 10000 });
    });

    test('should have link to registration', async ({ page }) => {
      await page.goto('/login');

      const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
      await expect(registerLink).toBeVisible();
    });

    test('should have forgot password link', async ({ page }) => {
      await page.goto('/login');

      const forgotLink = page.getByRole('link', { name: /forgot|reset/i });
      await expect(forgotLink).toBeVisible();
    });
  });

  test.describe('Registration Page', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: /register|sign up|create/i })).toBeVisible();
      await expect(page.getByLabel(/first name/i)).toBeVisible();
      await expect(page.getByLabel(/last name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/email/i).blur();

      await expect(page.getByText(/valid email|invalid email/i)).toBeVisible();
    });

    test('should validate password strength', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/^password$/i).fill('weak');
      await page.getByLabel(/^password$/i).blur();

      // Should show password requirements
      await expect(page.getByText(/password|characters|strong/i)).toBeVisible();
    });
  });
});
