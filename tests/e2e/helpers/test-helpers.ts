import { Page, APIRequestContext, expect } from '@playwright/test';

export const API_BASE = 'http://localhost:3000/api/v1';

// Test credentials from seed data
export const TEST_USERS = {
  admin: { email: 'admin@tradesdispatch.com', password: 'Admin123!' },
  operator: { email: 'operator@tradesdispatch.com', password: 'Admin123!' },
  smb: { email: 'smb@example.com', password: 'Admin123!' },
  electrician1: { email: 'pro.electric1@example.com', password: 'Admin123!' },
  electrician2: { email: 'pro.electric2@example.com', password: 'Admin123!' },
  plumber1: { email: 'pro.plumb1@example.com', password: 'Admin123!' },
  plumber2: { email: 'pro.plumb2@example.com', password: 'Admin123!' },
};

export const PORTALS = {
  smb: 'http://localhost:3001',
  pro: 'http://localhost:3002',
  admin: 'http://localhost:3003',
  operator: 'http://localhost:3004',
};

/**
 * Login via API and return auth tokens
 */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  const response = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();

  return {
    accessToken: body.data?.tokens?.accessToken || body.tokens?.accessToken,
    refreshToken: body.data?.tokens?.refreshToken || body.tokens?.refreshToken,
    user: body.data?.user || body.user,
  };
}

/**
 * Create authorization header
 */
export function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Login via browser
 */
export async function browserLogin(
  page: Page,
  portalUrl: string,
  email: string,
  password: string
): Promise<void> {
  await page.goto(`${portalUrl}/login`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Wait for React hydration

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);

  await Promise.all([
    page.waitForURL(/.*dashboard/, { timeout: 20000 }),
    page.locator('button[type="submit"]').click(),
  ]);

  await expect(page).toHaveURL(/.*dashboard/);
}

/**
 * Logout via browser
 */
export async function browserLogout(page: Page): Promise<void> {
  const logoutBtn = page.locator('button:has-text("Logout")');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForURL(/.*login/);
  }
}

/**
 * Create a job via API
 */
export async function createJob(
  request: APIRequestContext,
  accessToken: string,
  jobData: {
    serviceCategoryId: string;
    title: string;
    description: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    serviceAddressLine1: string;
    serviceCity: string;
    serviceProvince: string;
    servicePostalCode: string;
  }
): Promise<any> {
  const response = await request.post(`${API_BASE}/jobs`, {
    headers: authHeader(accessToken),
    data: jobData,
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.data || body;
}

/**
 * Get service categories via API
 */
export async function getServiceCategories(
  request: APIRequestContext,
  accessToken: string
): Promise<any[]> {
  const response = await request.get(`${API_BASE}/service-categories`, {
    headers: authHeader(accessToken),
  });

  if (response.status() === 200) {
    const body = await response.json();
    return body.data || body || [];
  }
  return [];
}

/**
 * Get feature flags via API
 */
export async function getFeatureFlags(
  request: APIRequestContext,
  accessToken: string
): Promise<any[]> {
  const response = await request.get(`${API_BASE}/feature-flags`, {
    headers: authHeader(accessToken),
  });

  if (response.status() === 200) {
    const body = await response.json();
    return body.data || body || [];
  }
  return [];
}

/**
 * Update feature flag via API
 */
export async function updateFeatureFlag(
  request: APIRequestContext,
  accessToken: string,
  flagId: string,
  enabled: boolean
): Promise<any> {
  const response = await request.patch(`${API_BASE}/feature-flags/${flagId}`, {
    headers: authHeader(accessToken),
    data: { enabled },
  });

  return response;
}

/**
 * Create a homeowner/consumer profile via API
 */
export async function createConsumerProfile(
  request: APIRequestContext,
  accessToken: string,
  profileData: {
    propertyType?: string;
    propertyAddressLine1?: string;
    propertyCity?: string;
    propertyProvince?: string;
    propertyPostalCode?: string;
    marketingOptIn?: boolean;
  }
): Promise<any> {
  const response = await request.post(`${API_BASE}/homeowner/profile`, {
    headers: authHeader(accessToken),
    data: profileData,
  });

  const body = await response.json();
  return { status: response.status(), body };
}

/**
 * Get service plans via API
 */
export async function getServicePlans(
  request: APIRequestContext,
  accessToken?: string
): Promise<any[]> {
  const headers = accessToken ? authHeader(accessToken) : {};
  const response = await request.get(`${API_BASE}/service-plans`, { headers });

  if (response.status() === 200) {
    const body = await response.json();
    return body.data?.plans || body.plans || [];
  }
  return [];
}

/**
 * Create subscription via API
 */
export async function createSubscription(
  request: APIRequestContext,
  accessToken: string,
  subscriptionData: {
    servicePlanId: string;
    startDate?: string;
    preferredDayOfWeek?: string;
    preferredTimeSlot?: string;
  }
): Promise<any> {
  const response = await request.post(`${API_BASE}/subscriptions`, {
    headers: authHeader(accessToken),
    data: subscriptionData,
  });

  const body = await response.json();
  return { status: response.status(), body };
}

/**
 * Get portfolio via API
 */
export async function getPortfolio(
  request: APIRequestContext,
  accessToken: string,
  proProfileId: string
): Promise<any> {
  const response = await request.get(`${API_BASE}/my-portfolio/${proProfileId}`, {
    headers: authHeader(accessToken),
  });

  const body = await response.json();
  return { status: response.status(), body };
}

/**
 * Get public portfolio by slug
 */
export async function getPublicPortfolio(
  request: APIRequestContext,
  slug: string
): Promise<any> {
  const response = await request.get(`${API_BASE}/portfolio/${slug}`);
  const body = await response.json();
  return { status: response.status(), body };
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Wait for API to be ready
 */
export async function waitForApiReady(
  request: APIRequestContext,
  maxAttempts: number = 30
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await request.get(`${API_BASE}/health`);
      if (response.status() === 200) {
        return true;
      }
    } catch {
      // Continue trying
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
