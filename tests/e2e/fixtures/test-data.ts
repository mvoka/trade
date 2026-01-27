/**
 * Test Data Fixtures
 *
 * Reusable test data for E2E tests.
 */

export const testUsers = {
  smbUser: {
    email: 'smb-test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'SMBUser',
    role: 'SMB_USER',
  },
  proUser: {
    email: 'pro-test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'ProUser',
    role: 'PRO_USER',
  },
  adminUser: {
    email: 'admin-test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'AdminUser',
    role: 'ADMIN',
  },
  operatorUser: {
    email: 'operator-test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'OperatorUser',
    role: 'OPERATOR',
  },
};

export const testJobs = {
  plumbingJob: {
    serviceType: 'PLUMBING',
    description: 'Leaking faucet in kitchen',
    urgency: 'NORMAL',
    location: {
      address: '123 Test Street',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 1A1',
    },
  },
  electricalJob: {
    serviceType: 'ELECTRICAL',
    description: 'Outlet not working in living room',
    urgency: 'NORMAL',
    location: {
      address: '456 Demo Avenue',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 2B2',
    },
  },
  hvacEmergency: {
    serviceType: 'HVAC',
    description: 'No heat in winter',
    urgency: 'EMERGENCY',
    location: {
      address: '789 Sample Road',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 3C3',
    },
  },
};

export const testAgentSessions = {
  dispatchConcierge: {
    sessionType: 'DISPATCH_CONCIERGE',
    context: {
      channel: 'web',
      locale: 'en-CA',
    },
  },
  jobStatus: {
    sessionType: 'JOB_STATUS',
    context: {
      channel: 'web',
      jobId: 'job_test_123',
    },
  },
};

export const testMessages = {
  greeting: 'Hello, I need help with a plumbing issue.',
  statusInquiry: 'What is the status of my job?',
  quoteRequest: 'Can you give me a quote for fixing a leaky faucet?',
  scheduleRequest: 'I want to schedule a service for next Monday.',
  escalation: 'I need to speak with a human agent.',
};

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}@example.com`;
}

/**
 * Generate unique test job ID
 */
export function generateTestJobId(): string {
  return `job_test_${Date.now()}`;
}

/**
 * Generate unique test session ID
 */
export function generateTestSessionId(): string {
  return `session_test_${Date.now()}`;
}
