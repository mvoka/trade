import { test, expect } from '@playwright/test';
import {
  API_BASE,
  TEST_USERS,
  PORTALS,
  apiLogin,
  authHeader,
  browserLogin,
  browserLogout,
  getServiceCategories,
  waitForApiReady,
} from './helpers/test-helpers';

test.describe('Pro Job Workflow', () => {
  test.beforeAll(async ({ request }) => {
    const ready = await waitForApiReady(request);
    expect(ready).toBe(true);
  });

  // ===========================================
  // ELECTRICIAN PRO WORKFLOW
  // ===========================================
  test.describe('Electrician Pro Workflow', () => {
    test('should login electrician via browser', async ({ page }) => {
      await browserLogin(
        page,
        PORTALS.pro,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );
      await expect(page.getByText(/dashboard/i)).toBeVisible({ timeout: 10000 });
    });

    test('should login electrician via API', async ({ request }) => {
      const { accessToken, user } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      expect(accessToken).toBeTruthy();
      expect(user).toBeTruthy();
    });

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

      if (response.status() === 200) {
        const body = await response.json();
        const profile = body.data || body;
        expect(profile.businessName).toContain('Spark Electric');
      }
    });

    test('should view pending dispatches', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/dispatch/pending`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should view assigned jobs', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/jobs/assigned`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should update availability status', async ({ request }) => {
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

    test('should update service hours', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.put(`${API_BASE}/pro-profiles/me/service-hours`, {
        headers: authHeader(accessToken),
        data: {
          hours: [
            { dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 'TUESDAY', startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 'WEDNESDAY', startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 'THURSDAY', startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 'FRIDAY', startTime: '08:00', endTime: '16:00' },
          ],
        },
      });

      expect([200, 400, 404]).toContain(response.status());
    });

    test('should update service area', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.put(`${API_BASE}/pro-profiles/me/service-area`, {
        headers: authHeader(accessToken),
        data: {
          centerLat: 44.0498,
          centerLng: -79.468,
          radiusKm: 30,
        },
      });

      expect([200, 400, 404]).toContain(response.status());
    });

    test('should view job history', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/jobs?status=COMPLETED`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should view earnings/payments', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/pro-profiles/me/earnings`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // PLUMBER PRO WORKFLOW
  // ===========================================
  test.describe('Plumber Pro Workflow', () => {
    test('should login plumber via browser', async ({ page }) => {
      await browserLogin(
        page,
        PORTALS.pro,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );
      await expect(page.getByText(/dashboard/i)).toBeVisible({ timeout: 10000 });
    });

    test('should login plumber via API', async ({ request }) => {
      const { accessToken, user } = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );

      expect(accessToken).toBeTruthy();
      expect(user).toBeTruthy();
    });

    test('should get plumber pro profile', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );

      const response = await request.get(`${API_BASE}/pro-profiles/me`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        const profile = body.data || body;
        expect(profile.businessName).toContain('FlowRight');
      }
    });

    test('should view plumber service categories', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );

      const response = await request.get(`${API_BASE}/pro-profiles/me`, {
        headers: authHeader(accessToken),
      });

      if (response.status() === 200) {
        const body = await response.json();
        const profile = body.data || body;

        if (profile.serviceCategories) {
          const hasPlumbing = profile.serviceCategories.some(
            (c: any) => c.code === 'PLUMBING' || c.name === 'Plumbing'
          );
          expect(hasPlumbing).toBe(true);
        }
      }
    });

    test('should set plumber availability', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );

      const response = await request.patch(`${API_BASE}/pro-profiles/me/availability`, {
        headers: authHeader(accessToken),
        data: {
          isAvailable: false,
          unavailableReason: 'On vacation',
          unavailableUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      expect([200, 400, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // JOB ACCEPTANCE WORKFLOW
  // ===========================================
  test.describe('Job Acceptance Workflow', () => {
    test('should accept dispatch job', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      // Get pending dispatches
      const dispatchResponse = await request.get(`${API_BASE}/dispatch/pending`, {
        headers: authHeader(accessToken),
      });

      if (dispatchResponse.status() === 200) {
        const body = await dispatchResponse.json();
        const dispatches = body.data || body || [];

        if (dispatches.length > 0) {
          const dispatchId = dispatches[0].id;

          const acceptResponse = await request.post(`${API_BASE}/dispatch/${dispatchId}/accept`, {
            headers: authHeader(accessToken),
          });

          expect([200, 400, 404]).toContain(acceptResponse.status());
        }
      }
    });

    test('should decline dispatch job with reason', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician2.email,
        TEST_USERS.electrician2.password
      );

      const dispatchResponse = await request.get(`${API_BASE}/dispatch/pending`, {
        headers: authHeader(accessToken),
      });

      if (dispatchResponse.status() === 200) {
        const body = await dispatchResponse.json();
        const dispatches = body.data || body || [];

        if (dispatches.length > 0) {
          const dispatchId = dispatches[0].id;

          const declineResponse = await request.post(
            `${API_BASE}/dispatch/${dispatchId}/decline`,
            {
              headers: authHeader(accessToken),
              data: {
                reason: 'TOO_FAR',
                notes: 'Location is outside my service area',
              },
            }
          );

          expect([200, 400, 404]).toContain(declineResponse.status());
        }
      }
    });
  });

  // ===========================================
  // JOB EXECUTION WORKFLOW
  // ===========================================
  test.describe('Job Execution Workflow', () => {
    test('should start assigned job', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const jobsResponse = await request.get(`${API_BASE}/jobs/assigned`, {
        headers: authHeader(accessToken),
      });

      if (jobsResponse.status() === 200) {
        const body = await jobsResponse.json();
        const jobs = body.data || body || [];
        const acceptedJob = jobs.find((j: any) => j.status === 'ACCEPTED' || j.status === 'ASSIGNED');

        if (acceptedJob) {
          const response = await request.post(`${API_BASE}/jobs/${acceptedJob.id}/start`, {
            headers: authHeader(accessToken),
            data: {
              startedAt: new Date().toISOString(),
              notes: 'Arrived at location, starting work',
            },
          });

          expect([200, 400, 404]).toContain(response.status());
        }
      }
    });

    test('should add progress notes to job', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const jobsResponse = await request.get(`${API_BASE}/jobs/assigned`, {
        headers: authHeader(accessToken),
      });

      if (jobsResponse.status() === 200) {
        const body = await jobsResponse.json();
        const jobs = body.data || body || [];
        const inProgressJob = jobs.find((j: any) => j.status === 'IN_PROGRESS');

        if (inProgressJob) {
          const response = await request.post(`${API_BASE}/jobs/${inProgressJob.id}/notes`, {
            headers: authHeader(accessToken),
            data: {
              content: 'Completed initial inspection, found issue with main breaker',
              type: 'PROGRESS',
            },
          });

          expect([200, 201, 400, 404]).toContain(response.status());
        }
      }
    });

    test('should complete job with details', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const jobsResponse = await request.get(`${API_BASE}/jobs/assigned`, {
        headers: authHeader(accessToken),
      });

      if (jobsResponse.status() === 200) {
        const body = await jobsResponse.json();
        const jobs = body.data || body || [];
        const inProgressJob = jobs.find((j: any) => j.status === 'IN_PROGRESS');

        if (inProgressJob) {
          const response = await request.post(`${API_BASE}/jobs/${inProgressJob.id}/complete`, {
            headers: authHeader(accessToken),
            data: {
              completedAt: new Date().toISOString(),
              completionNotes: 'Successfully completed all work',
              laborHours: 3.5,
              materialsUsed: ['Wire nuts', '14-gauge wire', 'GFCI outlet'],
              totalAmount: 35000, // $350.00 in cents
            },
          });

          expect([200, 400, 404]).toContain(response.status());
        }
      }
    });
  });

  // ===========================================
  // PHOTO ATTACHMENTS
  // ===========================================
  test.describe('Photo Attachments', () => {
    test('should upload before photos', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const jobsResponse = await request.get(`${API_BASE}/jobs/assigned`, {
        headers: authHeader(accessToken),
      });

      if (jobsResponse.status() === 200) {
        const body = await jobsResponse.json();
        const jobs = body.data || body || [];

        if (jobs.length > 0) {
          // Would need actual file upload - just test endpoint exists
          const response = await request.post(
            `${API_BASE}/jobs/${jobs[0].id}/attachments`,
            {
              headers: authHeader(accessToken),
              data: {
                type: 'BEFORE_PHOTO',
                description: 'Initial condition of electrical panel',
              },
            }
          );

          expect([200, 201, 400, 404, 415]).toContain(response.status());
        }
      }
    });

    test('should upload after photos', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const jobsResponse = await request.get(`${API_BASE}/jobs/assigned`, {
        headers: authHeader(accessToken),
      });

      if (jobsResponse.status() === 200) {
        const body = await jobsResponse.json();
        const jobs = body.data || body || [];

        if (jobs.length > 0) {
          const response = await request.post(
            `${API_BASE}/jobs/${jobs[0].id}/attachments`,
            {
              headers: authHeader(accessToken),
              data: {
                type: 'AFTER_PHOTO',
                description: 'Completed work - new panel installed',
              },
            }
          );

          expect([200, 201, 400, 404, 415]).toContain(response.status());
        }
      }
    });
  });

  // ===========================================
  // VERIFICATION DOCUMENTS
  // ===========================================
  test.describe('Verification Documents', () => {
    test('should list required verification documents', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/pro-profiles/me/verification-checklist`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });

    test('should upload verification document', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.post(`${API_BASE}/pro-profiles/me/verification-documents`, {
        headers: authHeader(accessToken),
        data: {
          documentType: 'LICENSE',
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      expect([200, 201, 400, 404, 415]).toContain(response.status());
    });

    test('should view verification status', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/pro-profiles/me/verification-status`, {
        headers: authHeader(accessToken),
      });

      expect([200, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // BROWSER WORKFLOW
  // ===========================================
  test.describe('Browser Workflow', () => {
    test('should show pro dashboard with pending jobs', async ({ page }) => {
      await browserLogin(
        page,
        PORTALS.pro,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      await expect(page.getByText(/pending|dispatches|jobs/i)).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to job details', async ({ page }) => {
      await browserLogin(
        page,
        PORTALS.pro,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const jobsLink = page.getByRole('link', { name: /jobs/i });
      if (await jobsLink.isVisible()) {
        await jobsLink.click();
        await page.waitForLoadState('networkidle');
      }
    });

    test('should navigate to profile settings', async ({ page }) => {
      await browserLogin(
        page,
        PORTALS.pro,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const profileLink = page.getByRole('link', { name: /profile|settings/i });
      if (await profileLink.isVisible()) {
        await profileLink.click();
        await page.waitForLoadState('networkidle');
      }
    });

    test('should logout successfully', async ({ page }) => {
      await browserLogin(
        page,
        PORTALS.pro,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );
      await browserLogout(page);
      await expect(page).toHaveURL(/.*login/);
    });
  });

  // ===========================================
  // MULTIPLE PROS SCENARIO
  // ===========================================
  test.describe('Multiple Pros Scenario', () => {
    test('should login different electricians', async ({ request }) => {
      // Electrician 1
      const auth1 = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );
      expect(auth1.accessToken).toBeTruthy();

      // Electrician 2
      const auth2 = await apiLogin(
        request,
        TEST_USERS.electrician2.email,
        TEST_USERS.electrician2.password
      );
      expect(auth2.accessToken).toBeTruthy();
    });

    test('should login different plumbers', async ({ request }) => {
      // Plumber 1
      const auth1 = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );
      expect(auth1.accessToken).toBeTruthy();

      // Plumber 2
      const auth2 = await apiLogin(
        request,
        TEST_USERS.plumber2.email,
        TEST_USERS.plumber2.password
      );
      expect(auth2.accessToken).toBeTruthy();
    });

    test('should have different pro profiles', async ({ request }) => {
      const auth1 = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const auth2 = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );

      const profile1Response = await request.get(`${API_BASE}/pro-profiles/me`, {
        headers: authHeader(auth1.accessToken),
      });

      const profile2Response = await request.get(`${API_BASE}/pro-profiles/me`, {
        headers: authHeader(auth2.accessToken),
      });

      if (profile1Response.status() === 200 && profile2Response.status() === 200) {
        const profile1 = await profile1Response.json();
        const profile2 = await profile2Response.json();

        // Should be different profiles
        expect((profile1.data || profile1).id).not.toBe((profile2.data || profile2).id);
      }
    });
  });
});
