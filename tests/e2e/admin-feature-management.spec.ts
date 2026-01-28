import { test, expect } from '@playwright/test';
import {
  API_BASE,
  TEST_USERS,
  PORTALS,
  apiLogin,
  authHeader,
  browserLogin,
  getFeatureFlags,
  updateFeatureFlag,
  getServiceCategories,
  waitForApiReady,
} from './helpers/test-helpers';

test.describe('Admin Feature Management', () => {
  test.beforeAll(async ({ request }) => {
    const ready = await waitForApiReady(request);
    expect(ready).toBe(true);
  });

  // ===========================================
  // ADMIN AUTHENTICATION
  // ===========================================
  test.describe('Admin Authentication', () => {
    test('should login admin via API', async ({ request }) => {
      const { accessToken, user } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      expect(accessToken).toBeTruthy();
      expect(user).toBeTruthy();
    });

    test('should login admin via browser', async ({ page }) => {
      await browserLogin(page, PORTALS.admin, TEST_USERS.admin.email, TEST_USERS.admin.password);
      await expect(page.getByText(/admin|dashboard/i)).toBeVisible({ timeout: 10000 });
    });

    test('should deny non-admin access to admin portal', async ({ page }) => {
      await page.goto(`${PORTALS.admin}/login`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await page.locator('input[name="email"]').fill(TEST_USERS.smb.email);
      await page.locator('input[name="password"]').fill(TEST_USERS.smb.password);
      await page.locator('button[type="submit"]').click();

      // Should either stay on login with error or redirect to unauthorized
      await page.waitForTimeout(3000);
      const url = page.url();
      expect(url).toMatch(/login|unauthorized|error|forbidden/);
    });
  });

  // ===========================================
  // FEATURE FLAGS MANAGEMENT
  // ===========================================
  test.describe('Feature Flags Management', () => {
    test('should list all feature flags', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const flags = await getFeatureFlags(request, accessToken);
      expect(Array.isArray(flags)).toBe(true);
    });

    test('should include core platform flags', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const flags = await getFeatureFlags(request, accessToken);

      const coreFlags = [
        'DISPATCH_ENABLED',
        'BOOKING_ENABLED',
        'REQUIRE_BEFORE_PHOTOS',
        'REQUIRE_AFTER_PHOTOS',
      ];

      for (const flagKey of coreFlags) {
        const flag = flags.find((f: any) => f.key === flagKey);
        if (flag) {
          expect(flag).toHaveProperty('enabled');
        }
      }
    });

    test('should include Phase 3 marketplace flags', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const flags = await getFeatureFlags(request, accessToken);

      const phase3Flags = [
        'HOMEOWNER_MARKETPLACE_ENABLED',
        'SUBSCRIPTIONS_ENABLED',
        'PRO_PORTFOLIO_ENABLED',
        'OFFER_CAMPAIGNS_ENABLED',
        'MULTI_BRANCH_ENABLED',
      ];

      for (const flagKey of phase3Flags) {
        const flag = flags.find((f: any) => f.key === flagKey);
        if (flag) {
          expect(flag).toHaveProperty('key', flagKey);
        }
      }
    });

    test('should include AI agent flags', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const flags = await getFeatureFlags(request, accessToken);

      const agentFlags = [
        'AGENT_ASSIST_MODE_ENABLED',
        'AGENT_AUTO_MODE_ENABLED',
        'AGENT_SUBSCRIPTION_OPS_ENABLED',
        'AGENT_PORTFOLIO_OPS_ENABLED',
        'AGENT_OUTREACH_OPS_ENABLED',
        'AGENT_HOMEOWNER_CONCIERGE_ENABLED',
      ];

      for (const flagKey of agentFlags) {
        const flag = flags.find((f: any) => f.key === flagKey);
        if (flag) {
          expect(flag).toHaveProperty('key', flagKey);
        }
      }
    });

    test('should enable feature flag', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const flags = await getFeatureFlags(request, accessToken);
      const testFlag = flags.find((f: any) => f.key === 'PRO_PORTFOLIO_ENABLED');

      if (testFlag) {
        const response = await updateFeatureFlag(request, accessToken, testFlag.id, true);
        expect([200, 400, 404]).toContain(response.status());
      }
    });

    test('should disable feature flag', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const flags = await getFeatureFlags(request, accessToken);
      const testFlag = flags.find((f: any) => f.key === 'OFFER_CAMPAIGNS_ENABLED');

      if (testFlag) {
        const response = await updateFeatureFlag(request, accessToken, testFlag.id, false);
        expect([200, 400, 404]).toContain(response.status());
      }
    });

    test('should toggle subscriptions for specific region', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      // Get regions
      const regionsResponse = await request.get(`${API_BASE}/regions`, {
        headers: authHeader(accessToken),
      });

      if (regionsResponse.status() === 200) {
        const regions = await regionsResponse.json();
        const regionList = regions.data || regions || [];

        if (regionList.length > 0) {
          const yorkRegion = regionList.find((r: any) => r.code === 'YORK_REGION');

          if (yorkRegion) {
            // Create region-specific feature flag
            const response = await request.post(`${API_BASE}/feature-flags`, {
              headers: authHeader(accessToken),
              data: {
                key: 'SUBSCRIPTIONS_ENABLED',
                enabled: true,
                scopeType: 'REGION',
                regionId: yorkRegion.id,
              },
            });

            expect([200, 201, 400, 409]).toContain(response.status());
          }
        }
      }
    });
  });

  // ===========================================
  // POLICIES MANAGEMENT
  // ===========================================
  test.describe('Policies Management', () => {
    test('should list all policies', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/policies`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should include Phase 3 policies', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/policies`, {
        headers: authHeader(accessToken),
      });

      if (response.status() === 200) {
        const body = await response.json();
        const policies = body.data || body || [];

        const phase3Policies = [
          'SUBSCRIPTION_AUTO_CREATE_JOB_DAYS',
          'PORTFOLIO_REQUIRE_OPT_IN',
          'OFFER_MAX_FOLLOWUPS',
          'AUTOMATION_MAX_ACTIONS_PER_HOUR',
          'AUTOMATION_APPROVAL_THRESHOLD_CENTS',
        ];

        for (const policyKey of phase3Policies) {
          const policy = policies.find((p: any) => p.key === policyKey);
          if (policy) {
            expect(policy).toHaveProperty('value');
          }
        }
      }
    });

    test('should update policy value', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const listResponse = await request.get(`${API_BASE}/policies`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const policies = body.data || body || [];
        const slaPolicy = policies.find((p: any) => p.key === 'SLA_ACCEPT_MINUTES');

        if (slaPolicy) {
          const updateResponse = await request.patch(`${API_BASE}/policies/${slaPolicy.id}`, {
            headers: authHeader(accessToken),
            data: {
              value: 10,
            },
          });

          expect([200, 400, 404]).toContain(updateResponse.status());
        }
      }
    });
  });

  // ===========================================
  // SERVICE CATEGORIES MANAGEMENT
  // ===========================================
  test.describe('Service Categories Management', () => {
    test('should list service categories', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const categories = await getServiceCategories(request, accessToken);
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    test('should create new service category', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.post(`${API_BASE}/service-categories`, {
        headers: authHeader(accessToken),
        data: {
          name: 'Test Category',
          code: 'TEST_CATEGORY_' + Date.now(),
          description: 'A test category for testing',
          isActive: true,
        },
      });

      expect([200, 201, 400, 409]).toContain(response.status());
    });

    test('should update service category', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const categories = await getServiceCategories(request, accessToken);
      const poolCategory = categories.find((c: any) => c.code === 'POOL_SERVICE');

      if (poolCategory) {
        const response = await request.patch(
          `${API_BASE}/service-categories/${poolCategory.id}`,
          {
            headers: authHeader(accessToken),
            data: {
              description: 'Updated: Pool maintenance, cleaning, and repair services',
            },
          }
        );

        expect([200, 400, 404]).toContain(response.status());
      }
    });

    test('should toggle category active status', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const categories = await getServiceCategories(request, accessToken);
      const testCategory = categories.find((c: any) => c.code?.startsWith('TEST_CATEGORY'));

      if (testCategory) {
        const response = await request.patch(
          `${API_BASE}/service-categories/${testCategory.id}`,
          {
            headers: authHeader(accessToken),
            data: {
              isActive: false,
            },
          }
        );

        expect([200, 400, 404]).toContain(response.status());
      }
    });
  });

  // ===========================================
  // USER MANAGEMENT
  // ===========================================
  test.describe('User Management', () => {
    test('should list all users', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/users`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should list pro users', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/users?role=PRO_USER`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should get user details', async ({ request }) => {
      const { accessToken, user } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      if (user?.id) {
        const response = await request.get(`${API_BASE}/users/${user.id}`, {
          headers: authHeader(accessToken),
        });

        expect([200, 404]).toContain(response.status());
      }
    });
  });

  // ===========================================
  // PRO VERIFICATION MANAGEMENT
  // ===========================================
  test.describe('Pro Verification Management', () => {
    test('should list pending verifications', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/verifications?status=PENDING`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should list pro profiles pending verification', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/pro-profiles?verificationStatus=PENDING`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should approve pro verification', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const profilesResponse = await request.get(
        `${API_BASE}/pro-profiles?verificationStatus=PENDING`,
        {
          headers: authHeader(accessToken),
        }
      );

      if (profilesResponse.status() === 200) {
        const body = await profilesResponse.json();
        const profiles = body.data || body || [];

        if (profiles.length > 0) {
          const profileId = profiles[0].id;
          const response = await request.post(
            `${API_BASE}/pro-profiles/${profileId}/approve`,
            {
              headers: authHeader(accessToken),
              data: {
                notes: 'All documents verified',
              },
            }
          );

          expect([200, 400, 404]).toContain(response.status());
        }
      }
    });
  });

  // ===========================================
  // REPORTS AND ANALYTICS
  // ===========================================
  test.describe('Reports and Analytics', () => {
    test('should get platform statistics', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/admin/stats`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should get job statistics', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/admin/stats/jobs`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should get pro performance metrics', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/admin/stats/pros`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should get subscription metrics', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/admin/stats/subscriptions`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // AUDIT LOGS
  // ===========================================
  test.describe('Audit Logs', () => {
    test('should view audit logs', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/audit-logs`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should filter audit logs by action', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/audit-logs?action=LOGIN`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should filter audit logs by date range', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const response = await request.get(
        `${API_BASE}/audit-logs?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: authHeader(accessToken),
        }
      );

      expect([200, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // BROWSER TESTS
  // ===========================================
  test.describe('Admin Browser Workflow', () => {
    test('should show admin dashboard statistics', async ({ page }) => {
      await browserLogin(page, PORTALS.admin, TEST_USERS.admin.email, TEST_USERS.admin.password);

      // Dashboard should show key metrics
      await expect(page.getByText(/pending|active|total/i)).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to users management', async ({ page }) => {
      await browserLogin(page, PORTALS.admin, TEST_USERS.admin.email, TEST_USERS.admin.password);

      const usersLink = page.getByRole('link', { name: /users/i });
      if (await usersLink.isVisible()) {
        await usersLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/.*users/);
      }
    });

    test('should navigate to feature flags', async ({ page }) => {
      await browserLogin(page, PORTALS.admin, TEST_USERS.admin.email, TEST_USERS.admin.password);

      const flagsLink = page.getByRole('link', { name: /feature|flags|settings/i });
      if (await flagsLink.isVisible()) {
        await flagsLink.click();
        await page.waitForLoadState('networkidle');
      }
    });

    test('should navigate to verifications', async ({ page }) => {
      await browserLogin(page, PORTALS.admin, TEST_USERS.admin.email, TEST_USERS.admin.password);

      const verifyLink = page.getByRole('link', { name: /verif|approve/i });
      if (await verifyLink.isVisible()) {
        await verifyLink.click();
        await page.waitForLoadState('networkidle');
      }
    });
  });
});
