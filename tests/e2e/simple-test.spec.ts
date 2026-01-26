import { test, expect } from '@playwright/test';

test('should load the login page', async ({ page }) => {
  await page.goto('http://localhost:3001/login');

  // Debug: log what we see
  const content = await page.content();
  console.log('Page content length:', content.length);
  console.log('Title:', await page.title());

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-screenshot.png' });

  // Wait for any element to be visible
  await page.waitForLoadState('domcontentloaded');

  // Try to find any form element
  const emailInput = await page.$('input[name="email"]');
  console.log('Email input found:', !!emailInput);

  // Check if page has any visible elements
  const bodyText = await page.locator('body').textContent();
  console.log('Body text:', bodyText?.substring(0, 100));

  expect(content.length).toBeGreaterThan(100);
});
