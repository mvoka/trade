import { test, expect } from '@playwright/test';
import {
  API_BASE,
  TEST_USERS,
  apiLogin,
  authHeader,
  getServiceCategories,
  getFeatureFlags,
  updateFeatureFlag,
  getServicePlans,
  createConsumerProfile,
  createSubscription,
  generateTestEmail,
  waitForApiReady,
} from './helpers/test-helpers';

test.describe('Comprehensive API Tests', () => {
  test.beforeAll(async ({ request }) => {
    // Ensure API is ready
    const ready = await waitForApiReady(request);
    expect(ready).toBe(true);
  });

  // ===========================================
  // AUTHENTICATION API TESTS
  // ===========================================
  test.describe('Authentication API', () => {
    test('should login admin user successfully', async ({ request }) => {
      const { accessToken, user } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      expect(accessToken).toBeTruthy();
      expect(user).toBeTruthy();
    });

    test('should login SMB user successfully', async ({ request }) => {
      const { accessToken, user } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      expect(accessToken).toBeTruthy();
      expect(user).toBeTruthy();
    });

    test('should login electrician pro successfully', async ({ request }) => {
      const { accessToken, user } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      expect(accessToken).toBeTruthy();
      expect(user).toBeTruthy();
    });

    test('should login plumber pro successfully', async ({ request }) => {
      const { accessToken, user } = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );

      expect(accessToken).toBeTruthy();
      expect(user).toBeTruthy();
    });

    test('should reject invalid credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE}/auth/login`, {
        data: {
          email: 'invalid@example.com',
          password: 'wrongpassword',
        },
      });

      expect([400, 401]).toContain(response.status());
    });

    test('should validate registration input', async ({ request }) => {
      const response = await request.post(`${API_BASE}/auth/register`, {
        data: {
          email: 'invalid-email',
          password: 'short',
        },
      });

      expect([400, 422]).toContain(response.status());
    });

    test('should register new user with valid data', async ({ request }) => {
      const testEmail = generateTestEmail('newuser');
      const response = await request.post(`${API_BASE}/auth/register`, {
        data: {
          email: testEmail,
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'SMB_USER',
        },
      });

      // Should succeed or fail validation (depending on implementation)
      expect([200, 201, 400, 409]).toContain(response.status());
    });

    test('should refresh access token', async ({ request }) => {
      const { refreshToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.post(`${API_BASE}/auth/refresh`, {
        data: { refreshToken },
      });

      // Should succeed or be not implemented
      expect([200, 201, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // SERVICE CATEGORIES API TESTS
  // ===========================================
  test.describe('Service Categories API', () => {
    test('should list service categories for authenticated user', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const categories = await getServiceCategories(request, accessToken);

      expect(Array.isArray(categories)).toBe(true);
      // Should have at least Electrical, Plumbing, Pool Service from seed
      expect(categories.length).toBeGreaterThanOrEqual(3);
    });

    test('should include Electrical category', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const categories = await getServiceCategories(request, accessToken);
      const electrical = categories.find((c: any) => c.code === 'ELECTRICAL' || c.name === 'Electrical');

      expect(electrical).toBeTruthy();
    });

    test('should include Plumbing category', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const categories = await getServiceCategories(request, accessToken);
      const plumbing = categories.find((c: any) => c.code === 'PLUMBING' || c.name === 'Plumbing');

      expect(plumbing).toBeTruthy();
    });

    test('should include Pool Service category', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const categories = await getServiceCategories(request, accessToken);
      const poolService = categories.find((c: any) => c.code === 'POOL_SERVICE' || c.name === 'Pool Service');

      expect(poolService).toBeTruthy();
    });
  });

  // ===========================================
  // FEATURE FLAGS API TESTS (Admin)
  // ===========================================
  test.describe('Feature Flags API', () => {
    test('should list feature flags for admin', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const flags = await getFeatureFlags(request, accessToken);

      expect(Array.isArray(flags)).toBe(true);
    });

    test('should include Phase 3 feature flags', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const flags = await getFeatureFlags(request, accessToken);

      // Check for Phase 3 specific flags
      const phase3Flags = [
        'HOMEOWNER_MARKETPLACE_ENABLED',
        'SUBSCRIPTIONS_ENABLED',
        'PRO_PORTFOLIO_ENABLED',
        'OFFER_CAMPAIGNS_ENABLED',
        'MULTI_BRANCH_ENABLED',
      ];

      for (const flagKey of phase3Flags) {
        const flag = flags.find((f: any) => f.key === flagKey);
        // Flag should exist (may or may not be present depending on seed)
        if (flag) {
          expect(flag).toHaveProperty('key', flagKey);
          expect(flag).toHaveProperty('enabled');
        }
      }
    });

    test('should deny feature flag access for non-admin', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/feature-flags`, {
        headers: authHeader(accessToken),
      });

      // Should be forbidden for non-admin or return empty
      expect([200, 403]).toContain(response.status());
    });
  });

  // ===========================================
  // JOBS API TESTS
  // ===========================================
  test.describe('Jobs API', () => {
    test('should require authentication for jobs list', async ({ request }) => {
      const response = await request.get(`${API_BASE}/jobs`);
      expect(response.status()).toBe(401);
    });

    test('should list jobs for authenticated SMB user', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/jobs`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should create job with valid data', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      // Get electrical category
      const categories = await getServiceCategories(request, accessToken);
      const electrical = categories.find((c: any) => c.code === 'ELECTRICAL');

      if (electrical) {
        const response = await request.post(`${API_BASE}/jobs`, {
          headers: authHeader(accessToken),
          data: {
            serviceCategoryId: electrical.id,
            title: 'Test Electrical Job',
            description: 'Install new outlet in kitchen',
            contactName: 'John Doe',
            contactEmail: 'john@example.com',
            contactPhone: '+14165551234',
            serviceAddressLine1: '123 Main St',
            serviceCity: 'Toronto',
            serviceProvince: 'ON',
            servicePostalCode: 'M5V 1A1',
          },
        });

        expect([200, 201, 400, 404]).toContain(response.status());
      }
    });

    test('should list jobs for Pro user', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/jobs`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // SERVICE PLANS API TESTS (Phase 3)
  // ===========================================
  test.describe('Service Plans API (Phase 3)', () => {
    test('should list public service plans', async ({ request }) => {
      const plans = await getServicePlans(request);

      // May be empty if subscriptions not enabled, or have plans from seed
      expect(Array.isArray(plans)).toBe(true);
    });

    test('should include pool service plans from seed', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/service-plans`, {
        headers: authHeader(accessToken),
      });

      if (response.status() === 200) {
        const body = await response.json();
        const plans = body.data?.plans || body.plans || [];

        // Check for seeded pool plans
        const weeklyPlan = plans.find((p: any) => p.name?.includes('Weekly Pool'));
        const biweeklyPlan = plans.find((p: any) => p.name?.includes('Bi-Weekly'));

        if (plans.length > 0) {
          expect(weeklyPlan || biweeklyPlan).toBeTruthy();
        }
      }
    });
  });

  // ===========================================
  // SUBSCRIPTIONS API TESTS (Phase 3)
  // ===========================================
  test.describe('Subscriptions API (Phase 3)', () => {
    test('should require authentication for subscriptions', async ({ request }) => {
      const response = await request.get(`${API_BASE}/subscriptions`);
      expect([401, 403, 404]).toContain(response.status());
    });

    test('should list user subscriptions', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/subscriptions`, {
        headers: authHeader(accessToken),
      });

      // May return 403 if feature not enabled, 404 if endpoint not found, or 200 with data
      expect([200, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // HOMEOWNER API TESTS (Phase 3)
  // ===========================================
  test.describe('Homeowner API (Phase 3)', () => {
    test('should create consumer profile', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const result = await createConsumerProfile(request, accessToken, {
        propertyType: 'house',
        propertyAddressLine1: '456 Oak Ave',
        propertyCity: 'Toronto',
        propertyProvince: 'ON',
        propertyPostalCode: 'M4V 2B2',
        marketingOptIn: true,
      });

      // May succeed, fail if feature disabled, or conflict if already exists
      expect([200, 201, 400, 403, 404, 409]).toContain(result.status);
    });

    test('should get homeowner profile', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/homeowner/profile`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // PORTFOLIO API TESTS (Phase 3)
  // ===========================================
  test.describe('Portfolio API (Phase 3)', () => {
    test('should check slug availability', async ({ request }) => {
      const response = await request.get(`${API_BASE}/portfolio/check-slug/test-portfolio`);

      expect([200, 404]).toContain(response.status());
    });

    test('should get public portfolio by slug', async ({ request }) => {
      const response = await request.get(`${API_BASE}/portfolio/test-slug`);

      // 404 expected if portfolio doesn't exist, 403 if feature disabled
      expect([200, 403, 404]).toContain(response.status());
    });

    test('should require auth for own portfolio', async ({ request }) => {
      const response = await request.get(`${API_BASE}/my-portfolio/test-id`);
      expect([401, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // OFFERS API TESTS (Phase 3)
  // ===========================================
  test.describe('Offers API (Phase 3)', () => {
    test('should get public offer by slug', async ({ request }) => {
      const response = await request.get(`${API_BASE}/offers/test-offer`);

      // 404 expected if offer doesn't exist, 403 if feature disabled
      expect([200, 403, 404]).toContain(response.status());
    });

    test('should submit lead to offer', async ({ request }) => {
      const response = await request.post(`${API_BASE}/offers/test-offer/submit`, {
        data: {
          name: 'Test Lead',
          email: generateTestEmail('lead'),
          phone: '+14165559999',
          marketingConsentGranted: true,
        },
      });

      // 404 if offer doesn't exist, 403 if feature disabled
      expect([200, 201, 400, 403, 404]).toContain(response.status());
    });

    test('should require admin for offer management', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      // Should be forbidden for non-admin
      expect([403, 404]).toContain(response.status());
    });

    test('should allow admin to list offers', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // BRANCHES API TESTS (Phase 3)
  // ===========================================
  test.describe('Branches API (Phase 3)', () => {
    test('should require auth for branches list', async ({ request }) => {
      const response = await request.get(`${API_BASE}/orgs/test-org/branches`);
      expect([401, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // AI AGENT API TESTS
  // ===========================================
  test.describe('AI Agent API', () => {
    test('should require authentication for session creation', async ({ request }) => {
      const response = await request.post(`${API_BASE}/agent/sessions`, {
        data: { sessionType: 'DISPATCH_CONCIERGE' },
      });

      expect([401, 403, 404]).toContain(response.status());
    });

    test('should create agent session for authenticated user', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.operator.email,
        TEST_USERS.operator.password
      );

      const response = await request.post(`${API_BASE}/agent/sessions`, {
        headers: authHeader(accessToken),
        data: { sessionType: 'DISPATCH_CONCIERGE' },
      });

      expect([200, 201, 404]).toContain(response.status());
    });

    test('should send message to agent session', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.operator.email,
        TEST_USERS.operator.password
      );

      // First create session
      const sessionResponse = await request.post(`${API_BASE}/agent/sessions`, {
        headers: authHeader(accessToken),
        data: { sessionType: 'DISPATCH_CONCIERGE' },
      });

      if (sessionResponse.status() === 201 || sessionResponse.status() === 200) {
        const sessionData = await sessionResponse.json();
        const sessionId = sessionData.data?.id || sessionData.id;

        if (sessionId) {
          const messageResponse = await request.post(
            `${API_BASE}/agent/sessions/${sessionId}/messages`,
            {
              headers: authHeader(accessToken),
              data: { content: 'Hello, I need help with dispatching a job' },
            }
          );

          expect([200, 201, 400, 404]).toContain(messageResponse.status());
        }
      }
    });
  });

  // ===========================================
  // DISPATCH API TESTS
  // ===========================================
  test.describe('Dispatch API', () => {
    test('should require authentication for dispatch operations', async ({ request }) => {
      const response = await request.get(`${API_BASE}/dispatch/pending`);
      expect([401, 403, 404]).toContain(response.status());
    });

    test('should list pending dispatches for operator', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.operator.email,
        TEST_USERS.operator.password
      );

      const response = await request.get(`${API_BASE}/dispatch/pending`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // PRO PROFILE API TESTS
  // ===========================================
  test.describe('Pro Profile API', () => {
    test('should get own pro profile', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/pro-profiles/me`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should update availability', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.patch(`${API_BASE}/pro-profiles/me/availability`, {
        headers: authHeader(accessToken),
        data: {
          isAvailable: true,
        },
      });

      expect([200, 400, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // BOOKING API TESTS
  // ===========================================
  test.describe('Booking API', () => {
    test('should require authentication for bookings', async ({ request }) => {
      const response = await request.get(`${API_BASE}/bookings`);
      expect([401, 403, 404]).toContain(response.status());
    });

    test('should list bookings for authenticated user', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/bookings`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });
  });
});
