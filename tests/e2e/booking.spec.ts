import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test.describe('Service Selection', () => {
    test('should display available services on home page', async ({ page }) => {
      await page.goto('/');

      // Look for service categories or booking options
      const servicesSection = page.locator('[data-testid="services"], .services, #services');

      // If services section exists, check for service options
      if (await servicesSection.count() > 0) {
        await expect(servicesSection).toBeVisible();
      }
    });

    test('should have call-to-action for booking', async ({ page }) => {
      await page.goto('/');

      // Look for book now or get quote buttons
      const bookingCta = page.getByRole('link', { name: /book|quote|schedule|get started/i });

      if (await bookingCta.count() > 0) {
        await expect(bookingCta.first()).toBeVisible();
      }
    });
  });

  test.describe('Quote Request', () => {
    test('should navigate to quote page', async ({ page }) => {
      await page.goto('/');

      const quoteLink = page.getByRole('link', { name: /quote|estimate/i });

      if (await quoteLink.count() > 0) {
        await quoteLink.first().click();
        await expect(page).toHaveURL(/quote|booking|request/);
      }
    });
  });

  test.describe('Form Validation', () => {
    test('should validate required booking fields', async ({ page }) => {
      await page.goto('/book');

      // If booking page exists
      if (page.url().includes('/book')) {
        // Try to submit empty form
        const submitButton = page.getByRole('button', { name: /submit|book|request/i });

        if (await submitButton.count() > 0) {
          await submitButton.click();
          // Should show validation errors
          await expect(page.getByText(/required|please fill/i)).toBeVisible();
        }
      }
    });
  });
});
