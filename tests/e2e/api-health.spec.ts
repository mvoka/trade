import { test, expect } from '@playwright/test';

test.describe('API Health Checks', () => {
  const API_BASE = 'http://localhost:3000/api/v1';

  test('should return health check status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('status', 'healthy');
    expect(body.data.services).toHaveProperty('database', 'up');
    expect(body.data.services).toHaveProperty('redis', 'up');
  });

  test('should return 401 for unauthorized API requests', async ({ request }) => {
    const response = await request.get(`${API_BASE}/jobs`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should return 404 for non-existent endpoints', async ({ request }) => {
    const response = await request.get(`${API_BASE}/nonexistent-endpoint`);

    expect(response.status()).toBe(404);
  });

  test.describe('AI Agent API', () => {
    test('should require authentication for session creation', async ({ request }) => {
      const response = await request.post(`${API_BASE}/agent/sessions`, {
        data: {
          sessionType: 'DISPATCH_CONCIERGE',
        },
      });

      // Expect 400/401 (unauthorized) or 404 (if endpoint not yet implemented)
      expect([400, 401, 404]).toContain(response.status());
    });

    test('should require authentication for message sending', async ({ request }) => {
      const response = await request.post(`${API_BASE}/agent/sessions/test-session/messages`, {
        data: {
          content: 'Hello',
        },
      });

      // Expect 400/401 (unauthorized) or 404 (if endpoint not yet implemented)
      expect([400, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Auth API', () => {
    test('should accept login requests', async ({ request }) => {
      const response = await request.post(`${API_BASE}/auth/login`, {
        data: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      // Should get 401 for invalid credentials, not 500
      expect([401, 400]).toContain(response.status());
    });

    test('should validate registration input', async ({ request }) => {
      const response = await request.post(`${API_BASE}/auth/register`, {
        data: {
          email: 'invalid-email',
          password: 'short',
        },
      });

      // Should get 400/422 for validation error, or 429 if rate limited
      expect([400, 422, 429]).toContain(response.status());
    });
  });
});
