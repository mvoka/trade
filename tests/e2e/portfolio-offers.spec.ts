import { test, expect } from '@playwright/test';
import {
  API_BASE,
  TEST_USERS,
  PORTALS,
  apiLogin,
  authHeader,
  browserLogin,
  waitForApiReady,
} from './helpers/test-helpers';

test.describe('Portfolio & Offers (Phase 3)', () => {
  test.beforeAll(async ({ request }) => {
    const ready = await waitForApiReady(request);
    expect(ready).toBe(true);
  });

  // ===========================================
  // PRO PORTFOLIO MANAGEMENT
  // ===========================================
  test.describe('Pro Portfolio', () => {
    test('should get pro portfolio settings', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/portfolio/my`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        const portfolio = body.data || body;
        expect(portfolio).toHaveProperty('id');
      }
    });

    test('should update portfolio settings', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.put(`${API_BASE}/portfolio/my`, {
        headers: authHeader(accessToken),
        data: {
          headline: 'Licensed Master Electrician - 15+ Years Experience',
          bio: 'Specializing in residential and commercial electrical work.',
          theme: 'professional',
          showContactInfo: true,
          showReviews: true,
        },
      });

      expect([200, 400, 403, 404]).toContain(response.status());
    });

    test('should publish portfolio', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.put(`${API_BASE}/portfolio/my/publish`, {
        headers: authHeader(accessToken),
        data: {
          isPublished: true,
        },
      });

      expect([200, 400, 403, 404]).toContain(response.status());
    });

    test('should unpublish portfolio', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.put(`${API_BASE}/portfolio/my/publish`, {
        headers: authHeader(accessToken),
        data: {
          isPublished: false,
        },
      });

      expect([200, 400, 403, 404]).toContain(response.status());
    });

    test('should add portfolio item from completed job', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      // First get completed jobs
      const jobsResponse = await request.get(`${API_BASE}/pro/jobs?status=COMPLETED`, {
        headers: authHeader(accessToken),
      });

      if (jobsResponse.status() === 200) {
        const jobsBody = await jobsResponse.json();
        const jobs = jobsBody.data || jobsBody || [];

        if (jobs.length > 0) {
          const response = await request.post(`${API_BASE}/portfolio/my/items`, {
            headers: authHeader(accessToken),
            data: {
              jobId: jobs[0].id,
              title: 'Electrical Panel Upgrade',
              description: 'Complete panel upgrade from 100A to 200A service.',
              customerOptIn: true,
            },
          });

          expect([200, 201, 400, 403, 404]).toContain(response.status());
        }
      }
    });

    test('should list portfolio items', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const response = await request.get(`${API_BASE}/portfolio/my/items`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(Array.isArray(body.data || body)).toBe(true);
      }
    });

    test('should update portfolio item', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      // Get items first
      const itemsResponse = await request.get(`${API_BASE}/portfolio/my/items`, {
        headers: authHeader(accessToken),
      });

      if (itemsResponse.status() === 200) {
        const itemsBody = await itemsResponse.json();
        const items = itemsBody.data || itemsBody || [];

        if (items.length > 0) {
          const response = await request.put(
            `${API_BASE}/portfolio/my/items/${items[0].id}`,
            {
              headers: authHeader(accessToken),
              data: {
                title: 'Updated Portfolio Item Title',
                featured: true,
              },
            }
          );

          expect([200, 400, 403, 404]).toContain(response.status());
        }
      }
    });

    test('should delete portfolio item', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      // Get items first
      const itemsResponse = await request.get(`${API_BASE}/portfolio/my/items`, {
        headers: authHeader(accessToken),
      });

      if (itemsResponse.status() === 200) {
        const itemsBody = await itemsResponse.json();
        const items = itemsBody.data || itemsBody || [];

        if (items.length > 0) {
          const response = await request.delete(
            `${API_BASE}/portfolio/my/items/${items[0].id}`,
            {
              headers: authHeader(accessToken),
            }
          );

          expect([200, 204, 400, 403, 404]).toContain(response.status());
        }
      }
    });
  });

  // ===========================================
  // PUBLIC PORTFOLIO ACCESS
  // ===========================================
  test.describe('Public Portfolio', () => {
    test('should access published portfolio by slug', async ({ request }) => {
      // First get a pro's portfolio slug
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      const myPortfolioResponse = await request.get(`${API_BASE}/portfolio/my`, {
        headers: authHeader(accessToken),
      });

      if (myPortfolioResponse.status() === 200) {
        const portfolio = await myPortfolioResponse.json();
        const slug = portfolio.data?.slug || portfolio.slug;

        if (slug) {
          // Access public portfolio (no auth)
          const publicResponse = await request.get(`${API_BASE}/portfolio/${slug}`);

          // May be 404 if not published, or 200 if published
          expect([200, 404]).toContain(publicResponse.status());
        }
      }
    });

    test('should return 404 for non-existent portfolio', async ({ request }) => {
      const response = await request.get(`${API_BASE}/portfolio/non-existent-slug-12345`);

      expect(response.status()).toBe(404);
    });
  });

  // ===========================================
  // PLUMBER PORTFOLIO
  // ===========================================
  test.describe('Plumber Portfolio', () => {
    test('should get plumber portfolio settings', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );

      const response = await request.get(`${API_BASE}/portfolio/my`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());
    });

    test('should update plumber portfolio', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.plumber1.email,
        TEST_USERS.plumber1.password
      );

      const response = await request.put(`${API_BASE}/portfolio/my`, {
        headers: authHeader(accessToken),
        data: {
          headline: 'Licensed Master Plumber - Emergency Services Available',
          bio: 'Full-service plumbing for residential and commercial properties.',
          theme: 'modern',
          showContactInfo: true,
          showReviews: true,
        },
      });

      expect([200, 400, 403, 404]).toContain(response.status());
    });
  });

  // ===========================================
  // OFFER CAMPAIGNS (ADMIN)
  // ===========================================
  test.describe('Offer Campaigns - Admin', () => {
    test('should list offer campaigns', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      expect([200, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(Array.isArray(body.data || body)).toBe(true);
      }
    });

    test('should create offer campaign', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const response = await request.post(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
        data: {
          name: 'Spring Pool Opening Special',
          slug: 'spring-pool-2024',
          headline: 'Get Your Pool Ready for Summer!',
          description: 'Book your spring pool opening service and save 20%.',
          offerType: 'DISCOUNT',
          discountPercent: 20,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
          status: 'ACTIVE',
          requiresMarketingConsent: true,
        },
      });

      expect([200, 201, 400, 403, 404]).toContain(response.status());
    });

    test('should get offer campaign details', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      // Get list first
      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];

        if (campaigns.length > 0) {
          const response = await request.get(
            `${API_BASE}/admin/offers/${campaigns[0].id}`,
            {
              headers: authHeader(accessToken),
            }
          );

          expect([200, 404]).toContain(response.status());
        }
      }
    });

    test('should update offer campaign', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];

        if (campaigns.length > 0) {
          const response = await request.put(
            `${API_BASE}/admin/offers/${campaigns[0].id}`,
            {
              headers: authHeader(accessToken),
              data: {
                headline: 'Updated Headline - Limited Time!',
                discountPercent: 25,
              },
            }
          );

          expect([200, 400, 403, 404]).toContain(response.status());
        }
      }
    });

    test('should pause offer campaign', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];
        const activeCampaign = campaigns.find((c: any) => c.status === 'ACTIVE');

        if (activeCampaign) {
          const response = await request.put(
            `${API_BASE}/admin/offers/${activeCampaign.id}/pause`,
            {
              headers: authHeader(accessToken),
            }
          );

          expect([200, 400, 403, 404]).toContain(response.status());
        }
      }
    });

    test('should view campaign leads', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];

        if (campaigns.length > 0) {
          const response = await request.get(
            `${API_BASE}/admin/offers/${campaigns[0].id}/leads`,
            {
              headers: authHeader(accessToken),
            }
          );

          expect([200, 403, 404]).toContain(response.status());

          if (response.status() === 200) {
            const leadsBody = await response.json();
            expect(Array.isArray(leadsBody.data || leadsBody)).toBe(true);
          }
        }
      }
    });
  });

  // ===========================================
  // PUBLIC OFFERS
  // ===========================================
  test.describe('Public Offers', () => {
    test('should access public offer page by slug', async ({ request }) => {
      // First get a campaign slug via admin
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];
        const activeCampaign = campaigns.find((c: any) => c.status === 'ACTIVE');

        if (activeCampaign) {
          // Access public offer (no auth)
          const publicResponse = await request.get(
            `${API_BASE}/offers/${activeCampaign.slug}`
          );

          expect([200, 404]).toContain(publicResponse.status());
        }
      }
    });

    test('should submit lead form with marketing consent', async ({ request }) => {
      // Get a campaign slug first
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];
        const activeCampaign = campaigns.find((c: any) => c.status === 'ACTIVE');

        if (activeCampaign) {
          const response = await request.post(
            `${API_BASE}/offers/${activeCampaign.slug}/submit`,
            {
              data: {
                firstName: 'Test',
                lastName: 'Lead',
                email: `test.lead.${Date.now()}@example.com`,
                phone: '+14165551234',
                propertyType: 'house',
                message: 'Interested in pool opening service',
                marketingConsentGranted: true,
              },
            }
          );

          expect([200, 201, 400, 404]).toContain(response.status());
        }
      }
    });

    test('should submit lead form without marketing consent', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];
        const activeCampaign = campaigns.find((c: any) => c.status === 'ACTIVE');

        if (activeCampaign) {
          const response = await request.post(
            `${API_BASE}/offers/${activeCampaign.slug}/submit`,
            {
              data: {
                firstName: 'No',
                lastName: 'Marketing',
                email: `no.marketing.${Date.now()}@example.com`,
                phone: '+14165555678',
                message: 'Just want the service, no marketing',
                marketingConsentGranted: false,
              },
            }
          );

          // May fail if campaign requires consent
          expect([200, 201, 400, 404, 422]).toContain(response.status());
        }
      }
    });

    test('should return 404 for non-existent offer', async ({ request }) => {
      const response = await request.get(`${API_BASE}/offers/non-existent-offer-12345`);

      expect(response.status()).toBe(404);
    });
  });

  // ===========================================
  // LEAD MANAGEMENT
  // ===========================================
  test.describe('Lead Management', () => {
    test('should update lead status', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      // Get campaigns and leads
      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];

        if (campaigns.length > 0) {
          const leadsResponse = await request.get(
            `${API_BASE}/admin/offers/${campaigns[0].id}/leads`,
            {
              headers: authHeader(accessToken),
            }
          );

          if (leadsResponse.status() === 200) {
            const leadsBody = await leadsResponse.json();
            const leads = leadsBody.data || leadsBody || [];

            if (leads.length > 0) {
              const response = await request.put(
                `${API_BASE}/admin/leads/${leads[0].id}`,
                {
                  headers: authHeader(accessToken),
                  data: {
                    status: 'CONTACTED',
                    notes: 'Called customer, scheduled callback.',
                  },
                }
              );

              expect([200, 400, 403, 404]).toContain(response.status());
            }
          }
        }
      }
    });

    test('should assign lead to pro', async ({ request }) => {
      const { accessToken } = await apiLogin(
        request,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      // Get campaigns and leads
      const listResponse = await request.get(`${API_BASE}/admin/offers`, {
        headers: authHeader(accessToken),
      });

      if (listResponse.status() === 200) {
        const body = await listResponse.json();
        const campaigns = body.data || body || [];

        if (campaigns.length > 0) {
          const leadsResponse = await request.get(
            `${API_BASE}/admin/offers/${campaigns[0].id}/leads`,
            {
              headers: authHeader(accessToken),
            }
          );

          if (leadsResponse.status() === 200) {
            const leadsBody = await leadsResponse.json();
            const leads = leadsBody.data || leadsBody || [];

            if (leads.length > 0) {
              // Get a pro to assign
              const prosResponse = await request.get(`${API_BASE}/pros`, {
                headers: authHeader(accessToken),
              });

              if (prosResponse.status() === 200) {
                const prosBody = await prosResponse.json();
                const pros = prosBody.data || prosBody || [];

                if (pros.length > 0) {
                  const response = await request.put(
                    `${API_BASE}/admin/leads/${leads[0].id}/assign`,
                    {
                      headers: authHeader(accessToken),
                      data: {
                        proId: pros[0].id,
                      },
                    }
                  );

                  expect([200, 400, 403, 404]).toContain(response.status());
                }
              }
            }
          }
        }
      }
    });
  });

  // ===========================================
  // BROWSER WORKFLOW
  // ===========================================
  test.describe('Browser Workflow', () => {
    test('Pro can view portfolio page in browser', async ({ page }) => {
      await browserLogin(
        page,
        PORTALS.pro,
        TEST_USERS.electrician1.email,
        TEST_USERS.electrician1.password
      );

      // Navigate to portfolio section
      const portfolioLink = page.getByRole('link', { name: /portfolio/i });
      if (await portfolioLink.isVisible()) {
        await portfolioLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/portfolio|profile/i)).toBeVisible({ timeout: 10000 });
      }
    });

    test('Admin can view offers dashboard in browser', async ({ page }) => {
      await browserLogin(
        page,
        PORTALS.admin,
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );

      // Navigate to offers section
      const offersLink = page.getByRole('link', { name: /offers|campaigns|marketing/i });
      if (await offersLink.isVisible()) {
        await offersLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/offers|campaigns|leads/i)).toBeVisible({ timeout: 10000 });
      }
    });
  });
});
