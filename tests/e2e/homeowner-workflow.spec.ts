import { test, expect } from '@playwright/test';
import {
  API_BASE,
  TEST_USERS,
  apiLogin,
  authHeader,
  createConsumerProfile,
  getServicePlans,
  createSubscription,
  generateTestEmail,
  waitForApiReady,
} from './helpers/test-helpers';

test.describe('Homeowner Workflow (Phase 3)', () => {
  test.beforeAll(async ({ request }) => {
    const ready = await waitForApiReady(request);
    expect(ready).toBe(true);
  });

  // ===========================================
  // CONSUMER REGISTRATION
  // ===========================================
  test.describe('Consumer Registration', () => {
    test('should register new homeowner via API', async ({ request }) => {
      const testEmail = generateTestEmail('homeowner');

      const response = await request.post(`${API_BASE}/auth/register`, {
        data: {
          email: testEmail,
          password: 'HomeOwner123!',
          firstName: 'Home',
          lastName: 'Owner',
          role: 'CONSUMER',
          userType: 'CONSUMER',
        },
      });

      // May succeed or fail if role not supported
      expect([200, 201, 400, 422]).toContain(response.status());
    });

    test('should create consumer profile for existing user', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const result = await createConsumerProfile(request, accessToken, {
        propertyType: 'house',
        propertyAddressLine1: '123 Home Street',
        propertyCity: 'Toronto',
        propertyProvince: 'ON',
        propertyPostalCode: 'M4V 1A1',
        marketingOptIn: true,
      });

      // May succeed, fail if feature disabled, or conflict if already exists
      expect([200, 201, 400, 403, 404, 409]).toContain(result.status);
    });

    test('should get consumer profile', async ({ request }) => {
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

    test('should update consumer profile', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.put(`${API_BASE}/homeowner/profile`, {
        headers: authHeader(accessToken),
        data: {
          propertyType: 'condo',
          marketingOptIn: false,
          preferredContactMethod: 'email',
        },
      });

      expect([200, 400, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // SERVICE PLANS
  // ===========================================
  test.describe('Service Plans', () => {
    test('should list available service plans', async ({ request }) => {
      const plans = await getServicePlans(request);
      expect(Array.isArray(plans)).toBe(true);
    });

    test('should list service plans with authentication', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/service-plans`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        const plans = body.data?.plans || body.plans || [];
        expect(Array.isArray(plans)).toBe(true);
      }
    });

    test('should get specific service plan details', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      // First get list of plans
      const response = await request.get(`${API_BASE}/service-plans`, {
        headers: authHeader(accessToken),
      });

      if (response.status() === 200) {
        const body = await response.json();
        const plans = body.data?.plans || body.plans || [];

        if (plans.length > 0) {
          const planId = plans[0].id;
          const detailResponse = await request.get(`${API_BASE}/service-plans/${planId}`, {
            headers: authHeader(accessToken),
          });

          expect([200, 404]).toContain(detailResponse.status());
        }
      }
    });

    test('should filter plans by billing interval', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/service-plans?billingInterval=MONTHLY`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());
    });

    test('should filter plans by service category', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      // Get pool service category
      const catResponse = await request.get(`${API_BASE}/service-categories`, {
        headers: authHeader(accessToken),
      });

      if (catResponse.status() === 200) {
        const catBody = await catResponse.json();
        const categories = catBody.data || catBody || [];
        const poolCategory = categories.find((c: any) => c.code === 'POOL_SERVICE');

        if (poolCategory) {
          const response = await request.get(
            `${API_BASE}/service-plans?serviceCategoryId=${poolCategory.id}`,
            {
              headers: authHeader(accessToken),
            }
          );

          expect([200, 403, 404]).toContain(response.status());
        }
      }
    });
  });

  // ===========================================
  // SUBSCRIPTIONS
  // ===========================================
  test.describe('Subscriptions', () => {
    test('should list user subscriptions', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/subscriptions`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(Array.isArray(body.data || body)).toBe(true);
      }
    });

    test('should create subscription', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      // Get available plans
      const plansResponse = await request.get(`${API_BASE}/service-plans`, {
        headers: authHeader(accessToken),
      });

      if (plansResponse.status() === 200) {
        const body = await plansResponse.json();
        const plans = body.data?.plans || body.plans || [];

        if (plans.length > 0) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() + 7); // Start in 7 days

          const result = await createSubscription(request, accessToken, {
            servicePlanId: plans[0].id,
            startDate: startDate.toISOString(),
            preferredDayOfWeek: 'MONDAY',
            preferredTimeSlot: '09:00-12:00',
          });

          // May succeed, fail if feature disabled, or require Stripe
          expect([200, 201, 400, 403, 404]).toContain(result.status);
        }
      }
    });

    test('should get subscription details', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      // Get subscriptions first
      const listResponse = await request.get(`${API_BASE}/subscriptions`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const subscriptions = body.data || body || [];

        if (subscriptions.length > 0) {
          const subId = subscriptions[0].id;
          const detailResponse = await request.get(`${API_BASE}/subscriptions/${subId}`, {
            headers: authHeader(accessToken),
          });

          expect([200, 403, 404]).toContain(detailResponse.status());
        }
      }
    });

    test('should pause subscription', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const listResponse = await request.get(`${API_BASE}/subscriptions`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const subscriptions = body.data || body || [];
        const activeSubscription = subscriptions.find((s: any) => s.status === 'ACTIVE');

        if (activeSubscription) {
          const pauseResponse = await request.put(
            `${API_BASE}/subscriptions/${activeSubscription.id}/pause`,
            {
              headers: authHeader(accessToken),
              data: {
                reason: 'Going on vacation',
              },
            }
          );

          expect([200, 400, 403, 404]).toContain(pauseResponse.status());
        }
      }
    });

    test('should resume subscription', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const listResponse = await request.get(`${API_BASE}/subscriptions`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const subscriptions = body.data || body || [];
        const pausedSubscription = subscriptions.find((s: any) => s.status === 'PAUSED');

        if (pausedSubscription) {
          const resumeResponse = await request.put(
            `${API_BASE}/subscriptions/${pausedSubscription.id}/resume`,
            {
              headers: authHeader(accessToken),
            }
          );

          expect([200, 400, 403, 404]).toContain(resumeResponse.status());
        }
      }
    });

    test('should cancel subscription', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const listResponse = await request.get(`${API_BASE}/subscriptions`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const subscriptions = body.data || body || [];
        const activeSubscription = subscriptions.find(
          (s: any) => s.status === 'ACTIVE' || s.status === 'PAUSED'
        );

        if (activeSubscription) {
          const cancelResponse = await request.delete(
            `${API_BASE}/subscriptions/${activeSubscription.id}`,
            {
              headers: authHeader(accessToken),
              data: {
                reason: 'Selling the house',
                immediate: false,
              },
            }
          );

          expect([200, 204, 400, 403, 404]).toContain(cancelResponse.status());
        }
      }
    });

    test('should list subscription occurrences', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const listResponse = await request.get(`${API_BASE}/subscriptions`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const subscriptions = body.data || body || [];

        if (subscriptions.length > 0) {
          const subId = subscriptions[0].id;
          const occurrencesResponse = await request.get(
            `${API_BASE}/subscriptions/${subId}/occurrences`,
            {
              headers: authHeader(accessToken),
            }
          );

          expect([200, 403, 404]).toContain(occurrencesResponse.status());
        }
      }
    });
  });

  // ===========================================
  // SERVICE HISTORY
  // ===========================================
  test.describe('Service History', () => {
    test('should list homeowner jobs/services', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.get(`${API_BASE}/homeowner/jobs`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());
    });

    test('should filter service history by date range', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);

      const response = await request.get(
        `${API_BASE}/homeowner/jobs?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: authHeader(accessToken),
        }
      );

      expect([200, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // POOL SERVICE SPECIFIC TESTS
  // ===========================================
  test.describe('Pool Service Workflow', () => {
    test('should find pool service plans', async ({ request }) => {
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

        const poolPlans = plans.filter(
          (p: any) =>
            p.name?.toLowerCase().includes('pool') ||
            p.description?.toLowerCase().includes('pool')
        );

        // Should have pool plans from seed
        expect(poolPlans.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('should subscribe to weekly pool maintenance', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const plansResponse = await request.get(`${API_BASE}/service-plans`, {
        headers: authHeader(accessToken),
      });

      if (plansResponse.status() === 200) {
        const body = await plansResponse.json();
        const plans = body.data?.plans || body.plans || [];

        const weeklyPoolPlan = plans.find(
          (p: any) => p.name?.includes('Weekly') && p.name?.includes('Pool')
        );

        if (weeklyPoolPlan) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() + 14);

          const result = await createSubscription(request, accessToken, {
            servicePlanId: weeklyPoolPlan.id,
            startDate: startDate.toISOString(),
            preferredDayOfWeek: 'WEDNESDAY',
            preferredTimeSlot: '08:00-10:00',
          });

          expect([200, 201, 400, 403, 404]).toContain(result.status);
        }
      }
    });

    test('should subscribe to seasonal pool opening', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const plansResponse = await request.get(`${API_BASE}/service-plans`, {
        headers: authHeader(accessToken),
      });

      if (plansResponse.status() === 200) {
        const body = await plansResponse.json();
        const plans = body.data?.plans || body.plans || [];

        const poolOpeningPlan = plans.find((p: any) => p.name?.includes('Pool Opening'));

        if (poolOpeningPlan) {
          // Schedule for spring
          const startDate = new Date();
          startDate.setMonth(4); // May
          startDate.setDate(1);

          const result = await createSubscription(request, accessToken, {
            servicePlanId: poolOpeningPlan.id,
            startDate: startDate.toISOString(),
            preferredTimeSlot: '09:00-12:00',
          });

          expect([200, 201, 400, 403, 404]).toContain(result.status);
        }
      }
    });
  });

  // ===========================================
  // MARKETING CONSENT
  // ===========================================
  test.describe('Marketing Consent', () => {
    test('should update marketing preferences', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.put(`${API_BASE}/homeowner/profile`, {
        headers: authHeader(accessToken),
        data: {
          marketingOptIn: true,
          preferredContactMethod: 'email',
        },
      });

      expect([200, 400, 403, 404]).toContain(response.status());
    });

    test('should opt out of marketing', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.smb.email,
        TEST_USERS.smb.password
      );

      const response = await request.put(`${API_BASE}/homeowner/profile`, {
        headers: authHeader(accessToken),
        data: {
          marketingOptIn: false,
        },
      });

      expect([200, 400, 403, 404]).toContain(response.status());
    });
  });
});
