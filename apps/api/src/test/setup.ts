import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-32chars';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.STORAGE_ENDPOINT = 'http://localhost:9000';
process.env.STORAGE_ACCESS_KEY = 'test-access-key';
process.env.STORAGE_SECRET_KEY = 'test-secret-key';
process.env.STORAGE_BUCKET = 'test-bucket';
process.env.API_PORT = '3000';
process.env.API_PREFIX = '/api/v1';

// Mock Redis
vi.mock('ioredis', () => {
  const Redis = vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(() => []),
    exists: vi.fn(() => 0),
    incr: vi.fn(() => 1),
    expire: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
  }));
  return { default: Redis };
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG=true
  log: process.env.DEBUG ? console.log : vi.fn(),
  error: console.error,
  warn: console.warn,
};
