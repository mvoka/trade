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

// LLM Configuration (AI Agents)
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.CLAUDE_MODEL_ID = 'claude-sonnet-4-20250514';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.OPENAI_MODEL_ID = 'gpt-4-turbo';
process.env.LLM_MAX_TOKENS = '4096';
process.env.LLM_TEMPERATURE = '0.7';
process.env.LLM_STREAMING_ENABLED = 'false';
process.env.LLM_FALLBACK_ENABLED = 'true';

// Mock Redis
vi.mock('ioredis', () => {
  const mockRedisInstance = {
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
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const Redis = vi.fn(() => mockRedisInstance);
  return { default: Redis, Redis };
});

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    id: 'msg_test123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Mock LLM response' }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  });

  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
    Anthropic: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG=true
  log: process.env.DEBUG ? console.log : vi.fn(),
  error: console.error,
  warn: console.warn,
};

// Test helper factories
export const createMockPrisma = () => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  agentSession: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversationTurn: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
  job: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  proProfile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  featureFlag: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn({
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    agentSession: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  })),
});

export const createMockFeatureFlags = () => ({
  isEnabled: vi.fn().mockResolvedValue(true),
  getValue: vi.fn().mockResolvedValue(null),
  getAllFlags: vi.fn().mockResolvedValue({}),
});

export const createMockRedis = () => ({
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
  connect: vi.fn(),
  disconnect: vi.fn(),
});
